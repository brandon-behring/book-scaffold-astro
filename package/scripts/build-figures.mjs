#!/usr/bin/env node
/**
 * scripts/build-figures.mjs — Figure pipeline.
 *
 * Walks the figures source tree and converts every PDF to SVG via
 * pdftocairo, emitting under public/figures/. SVG preserves zoom/quality
 * and stays small for matplotlib-style plots.
 *
 * Default source: figures/ at scaffold root. Override via BOOK_FIGURES_PATH
 * env var (absolute path or path relative to scaffold root) — useful for
 * books that share figures with a LaTeX sibling at e.g. ../shared/figures/.
 *
 * Subdirectory structure is mirrored to public/figures/ (e.g. figures/foo/x.pdf
 * → public/figures/foo/x.svg). PDFs at the top level become public/figures/x.svg.
 *
 * Falls back to pdftoppm (PNG @ 200 DPI) if pdftocairo produces an
 * unreasonably small (likely malformed) SVG.
 *
 * Idempotent: skips when the target SVG is newer than the source PDF.
 * Run on `prebuild` so Astro always sees fresh figures.
 *
 * Graceful skip: when pdftocairo / pdftoppm aren't on PATH (e.g. Cloudflare
 * build container), the script warns and exits 0. Committed SVGs/PNGs under
 * public/figures/ are served as-is. Local devs with poppler-utils regenerate
 * from PDFs on every `npm run dev`.
 */
import { readdir, stat, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Default: figures/ at scaffold root.
// Override via BOOK_FIGURES_PATH=path/to/figures (absolute or relative to
// scaffold root) — used by post_transformers to point at guides/figures.
const FIGURES_SRC = process.env.BOOK_FIGURES_PATH
  ? resolve(PROJECT_ROOT, process.env.BOOK_FIGURES_PATH)
  : resolve(PROJECT_ROOT, 'figures');
const FIGURES_DST = resolve(PROJECT_ROOT, 'public/figures');

// Threshold below which we treat a generated SVG as suspect and
// re-render as PNG via pdftoppm. Tuned empirically: anything under
// 200 bytes is almost certainly a stub or error output.
const MIN_SVG_BYTES = 200;

function check(cmd) {
  const r = spawnSync('which', [cmd], { stdio: 'pipe' });
  return r.status === 0;
}

function bail(cmd) {
  console.warn(
    `build-figures: '${cmd}' not on $PATH — skipping regeneration. ` +
      `Committed SVGs under public/figures/ will be served as-is. ` +
      `(Install poppler-utils locally to regenerate from PDFs.)`,
  );
}

/**
 * Recursively collect PDFs under FIGURES_SRC. Returns an array of
 * { relPath: 'subdir/file.pdf' | 'file.pdf' } objects so the output
 * mirrors the input directory structure.
 */
async function listPdfsRecursive(root, prefix = '') {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listPdfsRecursive(resolve(root, entry.name), relPath)));
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      out.push({ relPath });
    }
  }
  return out;
}

function isUpToDate(srcPath, dstPath) {
  if (!existsSync(dstPath)) return false;
  const srcMtime = statSync(srcPath).mtimeMs;
  const dstMtime = statSync(dstPath).mtimeMs;
  return dstMtime >= srcMtime;
}

function convertToSvg(srcPath, dstPath) {
  // pdftocairo wants the destination *without* the .svg extension when
  // -svg is specified — it appends the extension itself. Strip it.
  const dstStem = dstPath.replace(/\.svg$/, '');
  const r = spawnSync('pdftocairo', ['-svg', srcPath, `${dstStem}.svg`], {
    stdio: 'pipe',
  });
  if (r.status !== 0) {
    const stderr = (r.stderr ?? Buffer.from('')).toString().trim();
    throw new Error(
      `pdftocairo failed for ${srcPath}: ${stderr || `exit code ${r.status}`}`,
    );
  }
  // Sanity-check the output size.
  const size = statSync(dstPath).size;
  return size >= MIN_SVG_BYTES;
}

function convertToPng(srcPath, pngStem) {
  // pdftoppm: -r 200 (DPI), -png, single page (first only).
  const r = spawnSync(
    'pdftoppm',
    ['-r', '200', '-png', '-singlefile', srcPath, pngStem],
    { stdio: 'pipe' },
  );
  if (r.status !== 0) {
    const stderr = (r.stderr ?? Buffer.from('')).toString().trim();
    throw new Error(
      `pdftoppm failed for ${srcPath}: ${stderr || `exit code ${r.status}`}`,
    );
  }
}

async function main() {
  // Graceful skip when poppler is unavailable (e.g. Cloudflare build
  // container). The committed SVGs under public/figures/ serve as the
  // CI artifact; local devs with poppler can refresh them.
  if (!check('pdftocairo')) { bail('pdftocairo'); return; }
  if (!check('pdftoppm')) { bail('pdftoppm'); return; }

  if (!existsSync(FIGURES_SRC)) {
    console.log(
      `build-figures: ${FIGURES_SRC.replace(PROJECT_ROOT + '/', '')} not found — ` +
        `skipping (no figures to process).`,
    );
    return;
  }

  const pdfs = await listPdfsRecursive(FIGURES_SRC);
  if (pdfs.length === 0) {
    console.log('build-figures: no PDFs found; nothing to do.');
    return;
  }

  let total = 0;
  let converted = 0;
  let skipped = 0;
  let pngFallback = 0;

  for (const { relPath } of pdfs) {
    total++;
    const srcPath = resolve(FIGURES_SRC, relPath);
    const stem = relPath.replace(/\.pdf$/, '');
    const svgPath = resolve(FIGURES_DST, `${stem}.svg`);
    const pngPath = resolve(FIGURES_DST, `${stem}.png`);

    if (isUpToDate(srcPath, svgPath) || isUpToDate(srcPath, pngPath)) {
      skipped++;
      continue;
    }

    await mkdir(dirname(svgPath), { recursive: true });
    const svgOK = convertToSvg(srcPath, svgPath);
    if (!svgOK) {
      convertToPng(srcPath, svgPath.replace(/\.svg$/, ''));
      pngFallback++;
    }
    converted++;
  }

  console.log(
    `build-figures: ${total} total, ${converted} converted ` +
      `(${pngFallback} png fallback), ${skipped} cached`,
  );
}

main().catch((err) => {
  console.error('build-figures: failed');
  console.error(err.message ?? err);
  process.exit(1);
});
