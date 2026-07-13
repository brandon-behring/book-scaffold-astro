import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BookConfigError, defineBookConfig, minimalStyle } from '../dist/index.mjs';

test('#211: built-in styles no longer expose deploy metadata', () => {
  assert.equal(Object.hasOwn(minimalStyle, 'deploy'), false);
});

test('#211: legacy top-level deploy fails with an actionable migration', async () => {
  await assert.rejects(
    defineBookConfig({
      styles: [minimalStyle],
      site: 'https://example.invalid',
      deploy: 'pages',
    }),
    (error) =>
      error instanceof BookConfigError &&
      /v5 removed defineBookConfig\(\{ deploy \}\)/i.test(error.message) &&
      /wrangler\.toml/i.test(error.message) &&
      /MIGRATION-v4-to-v5\.md/.test(error.message),
  );
});
