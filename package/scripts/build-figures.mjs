#!/usr/bin/env node
/**
 * scripts/build-figures.mjs — Figure pipeline.
 *
 * Walks the figures source tree and converts every PDF to SVG via
 * pdftocairo, emitting under public/figures/. SVG preserves zoom/quality
 * and stays small for matplotlib-style plots.
 *
 * v4.2.0 (closes #17): TikZ standalone `.tex` sources are auto-compiled
 * to `.pdf` via pdflatex before the existing PDF→SVG pass runs. Discovery
 * rule: if `figures/<topic>/<name>.tex` exists AND no sibling `.pdf`
 * (or `.tex` is newer than `.pdf`), pdflatex runs. Graceful skip when
 * pdflatex is not on PATH (only emits ERROR if .tex sources exist).
 * See recipes/16-tikz-figures.md for the workflow + install pointers.
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
 * v4.11.0 (closes #84): each generated SVG gets a post-export rewrite
 * (recolorSvg) that injects role="img" + a CSS-variable theming layer so one
 * SVG serves light + dark. Neutral fills/strokes are remapped to
 * var(--diagram-ink|paper|grid, <original>) via injected attribute-selector
 * rules (the original attribute stays as the fallback); saturated accent colors
 * are left untouched. A `%! no-theme` line in the source .tex opts a figure out.
 * <Figure> inlines local SVGs so they track the in-page [data-theme] toggle.
 *
 * Idempotent: skips when the target SVG is newer than the source PDF (and the
 * recolor itself is a no-op on an already-themed SVG, so re-runs after an
 * upgrade safely theme pre-existing figures).
 * Run on `prebuild` so Astro always sees fresh figures.
 *
 * Graceful skip: when pdftocairo / pdftoppm aren't on PATH (e.g. Cloudflare
 * build container), the script warns and exits 0. Committed SVGs/PNGs under
 * public/figures/ are served as-is. Local devs with poppler-utils regenerate
 * from PDFs on every `npm run dev`.
 */
import { readdir, stat, mkdir } from 'node:fs/promises';
import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { recolorSvg } from '../src/lib/figure.mjs';

// --help / -h: non-mutating (closes #14).
const USAGE = `Usage: book-scaffold build-figures

Figure pipeline. PDF -> SVG via pdftocairo (PNG fallback via pdftoppm at
200dpi). Walks figures/ (or BOOK_FIGURES_PATH), emits to public/figures/.
Graceful-skip if pdftocairo / pdftoppm not on PATH.

Each SVG is rewritten to be accessible + dark-mode-aware: role="img" plus
var(--diagram-ink|paper|grid, orig) fills (a "%! no-theme" line in the
source .tex opts out). <Figure> inlines local SVGs so they track the theme.

Env:
  BOOK_FIGURES_PATH   Override figures source (default: figures/).

Options:
  --help, -h          Print this message and exit (non-mutating).
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.cwd();

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

/**
 * v4.2.0 (#17): recursively collect .tex sources under FIGURES_SRC.
 * Same shape as listPdfsRecursive but for `.tex` extension. TikZ
 * standalone files at any subdirectory depth are picked up.
 */
async function listTexRecursive(root, prefix = '') {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listTexRecursive(resolve(root, entry.name), relPath)));
    } else if (entry.isFile() && entry.name.endsWith('.tex')) {
      out.push({ relPath });
    }
  }
  return out;
}

/**
 * v4.2.0 (#17): compile a TikZ standalone .tex to .pdf via pdflatex.
 * Run in the source directory so TikZ \input{} relative paths resolve
 * + intermediate .aux/.log files land alongside the source.
 * Returns true on success; throws Error with stderr on failure.
 */
function compileTikz(srcPath) {
  const srcDir = dirname(srcPath);
  const srcName = basename(srcPath);
  const r = spawnSync(
    'pdflatex',
    [
      '-halt-on-error',
      '-interaction=nonstopmode',
      '-output-directory=.',
      srcName,
    ],
    { cwd: srcDir, stdio: 'pipe' },
  );
  if (r.status !== 0) {
    const stderr = (r.stderr ?? Buffer.from('')).toString().trim();
    const stdout = (r.stdout ?? Buffer.from('')).toString().trim();
    throw new Error(
      `pdflatex failed for ${srcPath}: ${stderr || stdout || `exit code ${r.status}`}`,
    );
  }
  return true;
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

// v4.11.0 (#84): a `%! no-theme` line (anywhere in the source .tex) opts a
// figure out of the dark-mode/a11y rewrite. Matches `%!` then `no-theme`,
// tolerant of surrounding whitespace — distinct from BibTeX `%`-line comments.
const NO_THEME_RE = /^\s*%!\s*no-theme\b/m;

/**
 * v4.11.0 (#84): apply the theming rewrite to a generated SVG in place.
 * No-op (returns false) if the file is absent or recolorSvg leaves it unchanged
 * (already themed / nothing neutral to remap). Idempotent.
 */
function themeIfSvg(svgPath, optOut) {
  if (!existsSync(svgPath)) return false;
  const original = readFileSync(svgPath, 'utf8');
  const themed = recolorSvg(original, { optOut });
  if (themed === original) return false;
  writeFileSync(svgPath, themed, 'utf8');
  return true;
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

  // v4.2.0 (#17): stage 1 — compile any TikZ standalone .tex sources to .pdf
  // BEFORE the PDF→SVG loop. Topic-walk discovers .tex files; compiles those
  // where no sibling .pdf exists OR .tex is newer than .pdf.
  const texSources = await listTexRecursive(FIGURES_SRC);
  let tikzCompiled = 0;
  if (texSources.length > 0) {
    if (!check('pdflatex')) {
      console.error(
        `build-figures: pdflatex not on $PATH but ${texSources.length} ` +
          `.tex source(s) detected. Install TeX Live to enable TikZ ` +
          `compilation (see https://www.tug.org/texlive/). Skipping ` +
          `.tex sources; pre-compiled .pdf siblings (if any) will still ` +
          `be converted to SVG.`,
      );
    } else {
      for (const { relPath } of texSources) {
        const srcPath = resolve(FIGURES_SRC, relPath);
        const pdfPath = srcPath.replace(/\.tex$/, '.pdf');
        if (existsSync(pdfPath) && statSync(pdfPath).mtimeMs >= statSync(srcPath).mtimeMs) {
          continue; // pdf is up-to-date
        }
        try {
          compileTikz(srcPath);
          tikzCompiled++;
        } catch (err) {
          console.error(`build-figures: ${err.message ?? err}`);
          // Continue — don't fail the whole build on one broken .tex file.
        }
      }
    }
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
  let themed = 0;

  for (const { relPath } of pdfs) {
    total++;
    const srcPath = resolve(FIGURES_SRC, relPath);
    const stem = relPath.replace(/\.pdf$/, '');
    const svgPath = resolve(FIGURES_DST, `${stem}.svg`);
    const pngPath = resolve(FIGURES_DST, `${stem}.png`);

    // Opt-out via `%! no-theme` in the source .tex (TikZ figures only).
    const texSibling = resolve(FIGURES_SRC, `${stem}.tex`);
    const optOut =
      existsSync(texSibling) && NO_THEME_RE.test(readFileSync(texSibling, 'utf8'));

    // Cached SVG: still run the (idempotent) rewrite so an upgrade themes
    // pre-existing figures without forcing a source touch. PNG fallbacks are
    // raster — nothing to theme.
    if (isUpToDate(srcPath, svgPath)) {
      if (themeIfSvg(svgPath, optOut)) themed++;
      skipped++;
      continue;
    }
    if (isUpToDate(srcPath, pngPath)) {
      skipped++;
      continue;
    }

    await mkdir(dirname(svgPath), { recursive: true });
    const svgOK = convertToSvg(srcPath, svgPath);
    if (!svgOK) {
      convertToPng(srcPath, svgPath.replace(/\.svg$/, ''));
      pngFallback++;
    } else if (themeIfSvg(svgPath, optOut)) {
      themed++;
    }
    converted++;
  }

  const tikzNote = tikzCompiled > 0 ? `, ${tikzCompiled} tikz→pdf` : '';
  const themedNote = themed > 0 ? `, ${themed} themed` : '';
  console.log(
    `build-figures: ${total} total, ${converted} converted ` +
      `(${pngFallback} png fallback), ${skipped} cached${themedNote}${tikzNote}`,
  );
}

main().catch((err) => {
  console.error('build-figures: failed');
  console.error(err.message ?? err);
  process.exit(1);
});
