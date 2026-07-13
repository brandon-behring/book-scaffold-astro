#!/usr/bin/env node
/**
 * scripts/build-bib.mjs — Bibliography + source-manifest pipeline.
 *
 * Reads bibliography.bib at scaffold root (BibTeX), parses via @citation-js,
 * emits src/data/references.json keyed by bibkey. The .bib path is
 * overridable via BOOK_BIB_PATH env var for books that keep their .bib
 * elsewhere (e.g. a shared `guides/shared/references.bib` outside the
 * Astro project — the post_transformers pattern).
 *
 * v4.10.0 (#85): ALSO reads sources/manifest.yaml (tools-profile sources,
 * cited inline via <Citation src>) and emits src/data/sources.json so the
 * auto-injected /references page can surface them. The two steps are
 * independent — a tools book with a manifest and no .bib still gets a
 * populated /references.
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
import { readEnvFile } from './read-env.mjs';

// --help / -h: non-mutating (closes #14).
const USAGE = `Usage: book-scaffold build-bib

Bibliography + source-manifest pipeline. Reads bibliography.bib (or
BOOK_BIB_PATH if set) -> src/data/references.json (BibTeX via @citation-js),
AND sources/manifest.yaml -> src/data/sources.json (tools-profile sources for
the /references page). Either input may be absent.

Env:
  BOOK_BIB_PATH      Override path to .bib file (process env wins, then root
                     .env; default: ./bibliography.bib).

Options:
  --help, -h         Print this message and exit (non-mutating).
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.cwd();
const dotenv = readEnvFile(PROJECT_ROOT);

// Default: bibliography.bib at scaffold root.
// Override via BOOK_BIB_PATH=path/to/your.bib (absolute or relative to cwd).
const configuredBibPath = process.env.BOOK_BIB_PATH ?? dotenv.BOOK_BIB_PATH;
const BIB_PATH = configuredBibPath
  ? resolve(PROJECT_ROOT, configuredBibPath)
  : resolve(PROJECT_ROOT, 'bibliography.bib');
const OUT_PATH = resolve(PROJECT_ROOT, 'src/data/references.json');
const SOURCES_PATH = resolve(PROJECT_ROOT, 'sources/manifest.yaml');
const SOURCES_OUT = resolve(PROJECT_ROOT, 'src/data/sources.json');

async function buildReferences() {
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
  // v4.0.0 (closes #54): strip `%`-comment lines before passing to citation-js.
  // The plugin-bibtex lexer doesn't honor BibTeX's %-line-comment semantics —
  // any `@TYPE` token inside a commented block is consumed as an entry start,
  // then fails at the first real entry below. This caused 4 hotfix releases
  // in v3.6.1→v3.6.4 chasing the same parse quirk; the pre-pass eliminates the
  // entire class of bug.
  //
  // BibTeX's real comment grammar is "% at the start of a line (after optional
  // whitespace) to end of line". Mid-line `%` (e.g., `note = {50% confidence}`)
  // is NOT a comment and is preserved.
  const sanitizedBib = bibText
    .split(/\r?\n/)
    .map((line) => (line.trimStart().startsWith('%') ? '' : line))
    .join('\n');

  const cite = new Cite(sanitizedBib);
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

// v4.10.0 (closes #85): tools-profile books keep their sources in
// sources/manifest.yaml (cited inline via <Citation src="id" />); the BibTeX
// path above never sees them, so the auto-injected /references page rendered
// blank. Emit those sources to src/data/sources.json so references.astro can
// surface them via the same defensive import.meta.glob it uses for
// references.json. Absent manifest -> no file written (academic/minimal books
// degrade to empty, exactly like a missing .bib). YAML is lazy-imported so the
// --help / no-manifest paths stay dependency-free.
async function buildSources() {
  let yamlText;
  try {
    yamlText = await readFile(SOURCES_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return; // no manifest — nothing to emit
    throw err;
  }

  const { parse } = await import('yaml');
  const parsed = parse(yamlText);
  // The manifest is a YAML array of source objects. Keep only well-formed
  // entries (a string `id` is the citation key + the /references anchor target).
  // A blank or comments-only manifest parses to null/undefined/[].
  const sources = Array.isArray(parsed)
    ? parsed.filter((s) => s && typeof s.id === 'string')
    : [];

  await mkdir(dirname(SOURCES_OUT), { recursive: true });
  await writeFile(SOURCES_OUT, JSON.stringify(sources, null, 2) + '\n', 'utf8');
  console.log(
    `build-bib: ${sources.length} source${sources.length === 1 ? '' : 's'} -> ` +
      `${SOURCES_OUT.replace(PROJECT_ROOT + '/', '')}`,
  );
}

async function main() {
  await buildReferences();
  await buildSources();
}

main().catch((err) => {
  console.error(`build-bib: failed`);
  console.error(err);
  process.exit(1);
});
