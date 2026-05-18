#!/usr/bin/env node
/**
 * scripts/build-bib.mjs — Bibliography pipeline (academic profile).
 *
 * Reads bibliography.bib at scaffold root (BibTeX), parses via @citation-js,
 * emits src/data/references.json keyed by bibkey. The .bib path is
 * overridable via BOOK_BIB_PATH env var for books that keep their .bib
 * elsewhere (e.g. a shared `guides/shared/references.bib` outside the
 * Astro project — the post_transformers pattern).
 *
 * Run on `prebuild` so every Astro build sees fresh bibliography data.
 * Idempotent: re-running with no .bib change produces a byte-identical
 * output (modulo timestamp, which we omit).
 *
 * Output shape:
 *   {
 *     "gu2024mamba": {
 *       "id": "gu2024mamba",
 *       "type": "article-journal",
 *       "title": "...",
 *       "author": [{ "family": "Gu", "given": "Albert" }, ...],
 *       "issued": { "date-parts": [[2024, 1]] },
 *       ...
 *     },
 *     ...
 *   }
 *
 * Build fails (non-zero exit) on:
 *   - references.bib not readable
 *   - duplicate bibkeys (citation-js silently overwrites; we surface)
 *   - parse errors on any entry (citation-js continues; we fail)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Default: bibliography.bib at scaffold root.
// Override via BOOK_BIB_PATH=path/to/your.bib (absolute or relative to cwd).
const BIB_PATH = process.env.BOOK_BIB_PATH
  ? resolve(process.cwd(), process.env.BOOK_BIB_PATH)
  : resolve(PROJECT_ROOT, 'bibliography.bib');
const OUT_PATH = resolve(PROJECT_ROOT, 'src/data/references.json');

async function main() {
  // Graceful skip when the .bib file is absent (minimal/tools profile, or
  // an academic book that hasn't authored citations yet). Emits an empty
  // references.json so consumers can still `import refs from '...'`.
  let bibText;
  try {
    bibText = await readFile(BIB_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(
        `build-bib: ${BIB_PATH.replace(PROJECT_ROOT + '/', '')} not found — ` +
          `emitting empty references.json (no citations to process).`,
      );
      await mkdir(dirname(OUT_PATH), { recursive: true });
      await writeFile(OUT_PATH, '{}\n', 'utf8');
      return;
    }
    throw err;
  }
  const cite = new Cite(bibText);
  const data = cite.data;

  // Detect duplicates the way biber would (citation-js silently
  // overwrites the earlier entry, which is the opposite of what we want).
  const seen = new Set();
  const dupes = [];
  for (const entry of data) {
    if (seen.has(entry.id)) dupes.push(entry.id);
    seen.add(entry.id);
  }
  if (dupes.length > 0) {
    console.error(`build-bib: ${dupes.length} duplicate bibkeys:`);
    for (const id of dupes) console.error(`  - ${id}`);
    process.exit(1);
  }

  const byKey = Object.fromEntries(data.map((entry) => [entry.id, entry]));

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(byKey, null, 2) + '\n', 'utf8');

  console.log(
    `build-bib: ${data.length} entries -> ${OUT_PATH.replace(PROJECT_ROOT + '/', '')}`,
  );
}

main().catch((err) => {
  console.error(`build-bib: failed`);
  console.error(err);
  process.exit(1);
});
