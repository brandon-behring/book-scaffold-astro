#!/usr/bin/env node
/**
 * scripts/render-notebooks.mjs — Notebook rendering pipeline.
 *
 * Walks the notebooks source tree and renders each .ipynb to standalone
 * HTML under public/notebooks/. Chapter pages link to /notebooks/<stem>.html
 * as "View executable companion."
 *
 * Default source: notebooks/ at scaffold root. Override via
 * BOOK_NOTEBOOKS_PATH env var (absolute or relative to scaffold root) —
 * used by post_transformers to point at guides/notebooks/.
 *
 * Per the post_transformers convention (and recommended for academic books),
 * source notebooks are output-free — so the rendered HTML shows code +
 * markdown only, no embedded matplotlib output. The chapter prose is
 * canonical; the notebook is a code companion.
 *
 * Idempotent: skips when the target HTML is newer than the source .ipynb.
 * Run on `prebuild` so Astro always sees fresh notebook HTML.
 *
 * Style scoping: nbconvert's `basic` template emits HTML without nbviewer
 * chrome, but with embedded <style> tags. To prevent CSS bleed, each
 * rendered notebook body is wrapped in <div class="notebook-frame">.
 *
 * Graceful skip: when `uv` is not on PATH (e.g. Cloudflare build container),
 * the script warns and exits 0. Committed HTML under public/notebooks/
 * serves as the CI artifact; local devs with uv regenerate.
 *
 * Prerequisites (local): `uv` on PATH with `jupyter nbconvert` installed
 * in the active environment (`uv pip install jupyter` or via a `pyproject.toml`).
 */
import { readdir, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.cwd();

// Default: notebooks/ at scaffold root.
// Override via BOOK_NOTEBOOKS_PATH (absolute or relative to scaffold root)
// — used by post_transformers to point at guides/notebooks/.
const NOTEBOOKS_SRC = process.env.BOOK_NOTEBOOKS_PATH
  ? resolve(PROJECT_ROOT, process.env.BOOK_NOTEBOOKS_PATH)
  : resolve(PROJECT_ROOT, 'notebooks');
const NOTEBOOKS_DST = resolve(PROJECT_ROOT, 'public/notebooks');

// uv runs from this working directory so its venv discovery climbs to
// find pyproject.toml / .venv. Defaults to PROJECT_ROOT but post_transformers
// needs it set to the wider repo root.
const UV_CWD = process.env.BOOK_UV_CWD
  ? resolve(PROJECT_ROOT, process.env.BOOK_UV_CWD)
  : PROJECT_ROOT;

// Skip threshold: source notebooks tagged as "stub" are tiny (<1.5 KB)
// and not worth rendering until they grow real content. Configurable
// via env if you want to render every notebook regardless of size.
const STUB_BYTES = parseInt(process.env.NOTEBOOK_STUB_BYTES ?? '1500', 10);

function check(cmd) {
  const r = spawnSync('which', [cmd], { stdio: 'pipe' });
  return r.status === 0;
}

function bail(cmd) {
  console.warn(
    `render-notebooks: '${cmd}' not on $PATH — skipping regeneration. ` +
      `Committed HTML under public/notebooks/ will be served as-is. ` +
      `(Install uv locally to refresh from .ipynb sources.)`,
  );
}

async function listNotebooks() {
  if (!existsSync(NOTEBOOKS_SRC)) {
    console.error(`render-notebooks: ${NOTEBOOKS_SRC} does not exist; skipping.`);
    return [];
  }
  const entries = await readdir(NOTEBOOKS_SRC, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.ipynb'))
    .map((e) => e.name)
    .sort();
}

function isUpToDate(srcPath, dstPath) {
  if (!existsSync(dstPath)) return false;
  const srcMtime = statSync(srcPath).mtimeMs;
  const dstMtime = statSync(dstPath).mtimeMs;
  return dstMtime >= srcMtime;
}

function isStub(srcPath) {
  const size = statSync(srcPath).size;
  return size < STUB_BYTES;
}

function nbconvertToHtml(srcPath, outDir) {
  // Use --template=basic to get minimal HTML without nbviewer chrome.
  // --output specifies just the stem; nbconvert appends .html.
  const stem = basename(srcPath, '.ipynb');
  const r = spawnSync(
    'uv',
    [
      'run',
      'jupyter',
      'nbconvert',
      '--to',
      'html',
      '--template',
      'basic',
      '--output',
      stem,
      '--output-dir',
      outDir,
      srcPath,
    ],
    {
      stdio: 'pipe',
      cwd: UV_CWD,
    },
  );
  if (r.status !== 0) {
    const stderr = (r.stderr ?? Buffer.from('')).toString().trim();
    throw new Error(
      `nbconvert failed for ${srcPath}: ${stderr || `exit code ${r.status}`}`,
    );
  }
  return resolve(outDir, `${stem}.html`);
}

async function wrapInFrame(htmlPath, sourceName) {
  // Read nbconvert output, wrap body in .notebook-frame so its CSS
  // doesn't bleed into site styles, and emit a minimal HTML doc.
  // We don't use Astro's Base layout here — these pages are static
  // standalone artifacts, not Astro-managed routes.
  const original = await readFile(htmlPath, 'utf8');
  const wrapped = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${sourceName} — executable companion</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; padding: 0 1rem; }
    .notebook-frame { font-size: 0.95rem; line-height: 1.55; }
    .notebook-frame pre { background: #f5f5f4; padding: 0.5rem 0.8rem; border-radius: 4px; overflow-x: auto; }
    .notebook-frame code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .notebook-frame h1, .notebook-frame h2, .notebook-frame h3 { line-height: 1.2; }
    .notebook-frame img { max-width: 100%; height: auto; }
    .notebook-frame table { border-collapse: collapse; }
    .notebook-frame table td, .notebook-frame table th { padding: 0.3em 0.6em; border: 1px solid #ddd; }
    .companion-header { padding: 0.5rem 0; border-bottom: 1px solid #ddd; margin-bottom: 1.5rem; font-size: 0.85rem; color: #666; }
    .companion-header a { color: #3B6FA0; }
  </style>
</head>
<body>
  <div class="companion-header">
    Executable companion — <code>${sourceName}</code>.
  </div>
  <div class="notebook-frame">
    ${original}
  </div>
</body>
</html>
`;
  await writeFile(htmlPath, wrapped, 'utf8');
}

async function main() {
  // Graceful skip when uv is unavailable (e.g. Cloudflare build
  // container). Committed HTML under public/notebooks/ serves as the
  // CI artifact; local devs with uv can refresh.
  if (!check('uv')) { bail('uv'); return; }

  const notebooks = await listNotebooks();
  if (notebooks.length === 0) {
    console.log('render-notebooks: no notebooks found; nothing to do.');
    return;
  }

  await mkdir(NOTEBOOKS_DST, { recursive: true });

  let total = 0;
  let rendered = 0;
  let skipped = 0;
  let stubsSkipped = 0;

  for (const nb of notebooks) {
    total++;
    const srcPath = resolve(NOTEBOOKS_SRC, nb);
    const stem = basename(nb, '.ipynb');
    const dstPath = resolve(NOTEBOOKS_DST, `${stem}.html`);

    // Don't bother rendering 1-cell stubs.
    if (isStub(srcPath)) {
      stubsSkipped++;
      // Clean up a stale rendered version if one exists.
      if (existsSync(dstPath)) await unlink(dstPath);
      continue;
    }

    if (isUpToDate(srcPath, dstPath)) {
      skipped++;
      continue;
    }

    nbconvertToHtml(srcPath, NOTEBOOKS_DST);
    await wrapInFrame(dstPath, nb);
    rendered++;
  }

  console.log(
    `render-notebooks: ${total} total, ${rendered} rendered, ` +
      `${skipped} cached, ${stubsSkipped} stubs skipped`,
  );
}

main().catch((err) => {
  console.error('render-notebooks: failed');
  console.error(err.message ?? err);
  process.exit(1);
});
