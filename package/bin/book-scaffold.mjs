#!/usr/bin/env node
/**
 * book-scaffold — single-dispatcher CLI for the book-scaffold-astro toolkit.
 *
 * Per PACKAGE_DESIGN.md §8: one bin entry, sub-command parsed from argv[2].
 * Sub-commands import the corresponding script module; the script's own
 * argv parsing handles flags.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const handlers = {
  validate: '../scripts/validate.mjs',
  'build-labels': '../scripts/build-labels.mjs',
  'build-bib': '../scripts/build-bib.mjs',
  'build-figures': '../scripts/build-figures.mjs',
  'build-tips': '../scripts/build-tips.mjs',
  'render-notebooks': '../scripts/render-notebooks.mjs',
};

const HELP = `Usage: book-scaffold <sub-command> [args...]

Sub-commands:
  validate           Pre-flight content validator (XRef ids, Cite keys, Figure srcs).
  build-labels       Emit src/data/labels.json for cross-references (Phase C).
  build-bib          BibTeX -> CSL JSON for the <Cite> component.
  build-figures      PDF -> SVG via pdftocairo / pdftoppm fallback (+ TikZ in v4.2.0).
  build-tips         Scan chapters for <Tip> instances; emit src/data/tips.json (v4.3.0).
  render-notebooks   ipynb -> HTML via Jupyter nbconvert.

  --help, -h         This message.
  --version, -v      Print the package version.

See: https://github.com/brandon-behring/book-scaffold-astro
`;

const [, , sub, ...rest] = process.argv;

if (!sub || sub === '--help' || sub === '-h') {
  process.stdout.write(HELP);
  process.exit(sub ? 0 : 1);
}

if (sub === '--version' || sub === '-v') {
  const pkgPath = resolve(__dirname, '../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

if (!(sub in handlers)) {
  process.stderr.write(`book-scaffold: unknown sub-command '${sub}'.\n\n${HELP}`);
  process.exit(2);
}

// Hand off argv to the sub-command's script. The script reads process.argv
// directly so flag parsing stays consistent with v2.0 standalone usage.
const scriptPath = resolve(__dirname, handlers[sub]);
process.argv = [process.argv[0], scriptPath, ...rest];
await import(scriptPath);
