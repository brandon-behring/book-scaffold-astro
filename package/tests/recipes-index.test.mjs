/**
 * Recipe numbering contract.
 *
 * A recipe number is a public documentation address. Keep filename prefixes
 * and index numbers unique so independently-landed recipes cannot silently
 * claim the same slot (the demo/figure Recipe 23 collision caught by #161).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = join(__dirname, '../recipes');
const INDEX = readFileSync(join(RECIPES_DIR, 'README.md'), 'utf8');

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

test('recipe filename prefixes and index numbers are unique and aligned', () => {
  const numberedFiles = readdirSync(RECIPES_DIR)
    .filter((name) => /^\d{2}-.*\.md$/.test(name))
    .sort();
  const filePrefixes = numberedFiles.map((name) => name.slice(0, 2));
  assert.deepEqual(
    duplicateValues(filePrefixes),
    [],
    `duplicate recipe filename prefix(es): ${duplicateValues(filePrefixes).join(', ')}`,
  );

  const rows = [...INDEX.matchAll(/^\|\s*(\d{2})\s*\|\s*\[[^\]]+\]\((\d{2}-[^)]+\.md)\)/gm)];
  const indexNumbers = rows.map((match) => match[1]);
  assert.deepEqual(
    duplicateValues(indexNumbers),
    [],
    `duplicate recipe index number(s): ${duplicateValues(indexNumbers).join(', ')}`,
  );

  for (const [, number, target] of rows) {
    assert.equal(target.slice(0, 2), number, `Recipe ${number} must link to a ${number}- prefixed file`);
    assert.ok(existsSync(join(RECIPES_DIR, target)), `Recipe ${number} target is missing: ${target}`);
  }
});
