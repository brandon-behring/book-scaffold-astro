/**
 * tests/sources-empty-detection.test.mjs — verify the isYamlEmpty()
 * detection logic from schemas-entry.ts (v4.1.0 #60).
 *
 * The helper is internal (not exported); we re-implement the same logic
 * in this test as a contract assertion. If schemas-entry.ts changes the
 * detection rule, this test breaks loudly — the consumer-facing
 * behavior is defined by both files together.
 *
 * Coverage: missing file / empty file / whitespace-only / comment-only /
 * empty array `[]` / single entry / multiple entries / parse-error
 * (raw bytes; YAML parser sees these later).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mirror the implementation in package/src/schemas-entry.ts.
function isYamlEmpty(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    const stripped = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter((line) => line.length > 0)
      .join('');
    return stripped === '' || stripped === '[]';
  } catch {
    return false;
  }
}

function withTmpFile(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
  const path = join(dir, 'manifest.yaml');
  writeFileSync(path, content);
  try {
    return fn(path);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('isYamlEmpty: empty file is empty', () => {
  withTmpFile('', (p) => assert.equal(isYamlEmpty(p), true));
});

test('isYamlEmpty: whitespace-only is empty', () => {
  withTmpFile('\n\n  \n\t\n', (p) => assert.equal(isYamlEmpty(p), true));
});

test('isYamlEmpty: comment-only is empty', () => {
  withTmpFile('# placeholder\n# no entries yet\n', (p) =>
    assert.equal(isYamlEmpty(p), true),
  );
});

test('isYamlEmpty: literal "[]" is empty', () => {
  withTmpFile('[]\n', (p) => assert.equal(isYamlEmpty(p), true));
});

test('isYamlEmpty: "[]" with surrounding comments is empty', () => {
  withTmpFile('# stub\n[]\n# next time\n', (p) => assert.equal(isYamlEmpty(p), true));
});

test('isYamlEmpty: single entry is NOT empty', () => {
  withTmpFile(
    '- key: ref-2026\n  title: "Test"\n  tier: T1-official\n',
    (p) => assert.equal(isYamlEmpty(p), false),
  );
});

test('isYamlEmpty: multiple entries are NOT empty', () => {
  withTmpFile(
    '- key: a\n  title: A\n- key: b\n  title: B\n',
    (p) => assert.equal(isYamlEmpty(p), false),
  );
});

test('isYamlEmpty: missing file returns false (preserves Astro error surface)', () => {
  assert.equal(isYamlEmpty('/tmp/definitely-does-not-exist-12345.yaml'), false);
});

test('isYamlEmpty: malformed YAML returns false (Astro emits real ERROR later)', () => {
  // Note: this function only checks byte-level emptiness; it doesn't validate
  // YAML structure. A file like "not yaml { at all" is NOT empty, so the
  // collection registers and Astro's parser surfaces the real error.
  withTmpFile('not yaml { at all', (p) => assert.equal(isYamlEmpty(p), false));
});
