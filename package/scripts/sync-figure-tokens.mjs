#!/usr/bin/env node
/** Regenerate or verify the manifest-owned block in styles/tokens.css. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FIGURE_TOKEN_BLOCK_END,
  FIGURE_TOKEN_BLOCK_START,
  renderFigureTokenCssBlock,
} from '../src/lib/figure-palette.mjs';

const TOKENS_PATH = fileURLToPath(new URL('../styles/tokens.css', import.meta.url));
const args = new Set(process.argv.slice(2));
const write = args.has('--write');
if (args.size > 1 || (args.size === 1 && !write && !args.has('--check'))) {
  console.error('Usage: node scripts/sync-figure-tokens.mjs [--check|--write]');
  process.exit(2);
}

const css = readFileSync(TOKENS_PATH, 'utf8');
const start = css.indexOf(FIGURE_TOKEN_BLOCK_START);
const endStart = css.indexOf(FIGURE_TOKEN_BLOCK_END, start);
if (start < 0 || endStart < 0) {
  throw new Error('tokens.css is missing the generated figure-token block markers.');
}
const end = endStart + FIGURE_TOKEN_BLOCK_END.length;
const expected = renderFigureTokenCssBlock();
const actual = css.slice(start, end);

if (write) {
  if (actual === expected) {
    console.log('sync-figure-tokens: tokens.css already current');
  } else {
    writeFileSync(TOKENS_PATH, css.slice(0, start) + expected + css.slice(end), 'utf8');
    console.log('sync-figure-tokens: updated styles/tokens.css');
  }
} else if (actual !== expected) {
  console.error(
    'sync-figure-tokens: styles/tokens.css drifted from src/lib/figure-palette.mjs; ' +
    'run npm run sync:figure-tokens --workspace package',
  );
  process.exit(1);
} else {
  console.log('sync-figure-tokens: tokens.css matches the palette manifest');
}
