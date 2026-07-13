import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineBookConfig, minimalStyle } from '../dist/index.mjs';

async function captureWarnings(run) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await run();
  } finally {
    console.warn = original;
  }
  return warnings;
}

test('built-in deploy metadata does not warn every consumer (#180)', async () => {
  const warnings = await captureWarnings(() =>
    defineBookConfig({ styles: [minimalStyle], site: 'https://example.invalid' }),
  );
  assert.deepEqual(warnings, []);
});

test('explicit top-level deploy warns that it is inert and removed in v5 (#180)', async () => {
  const warnings = await captureWarnings(() =>
    defineBookConfig({
      styles: [minimalStyle],
      site: 'https://example.invalid',
      deploy: 'pages',
    }),
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /deploy.*inert.*deprecated/i);
  assert.match(warnings[0], /v5/);
});
