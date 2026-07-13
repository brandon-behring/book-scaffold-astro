/**
 * tests/release-status.test.mjs — defineBookConfig({ releaseStatus }) → the
 * site-wide <PreReleaseBanner> (#149; the 8th application of the
 * config-threading pattern — see sidebar-brand.test.mjs for the template).
 *
 * Source-contract pins on each threading slot (the same style sidebar-brand
 * uses) + a runtime check that the option never leaks into AstroUserConfig.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { defineBookConfig, academicStyle } from '../dist/index.mjs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('#149: the threading chain carries releaseStatus end-to-end (source pins)', () => {
  assert.match(read('src/types.ts'), /releaseStatus\?: \{ state: 'alpha' \| 'beta' \| 'rc' \| 'locked'/,
    'types.ts: public option');
  const config = read('src/config.ts');
  assert.match(config, /releaseStatus: opts\.releaseStatus \?\? composed\.releaseStatus/,
    'config.ts: passes top-level-over-chain into the integration');
  assert.match(config, /releaseStatus: _releaseStatus/, 'config.ts: strips it from AstroUserConfig');
  const integration = read('src/integration.ts');
  assert.match(integration, /releaseStatus: .*\| null;/, 'integration.ts: plugin config type');
  assert.match(integration, /releaseStatus: releaseStatus \?\? null,/, 'integration.ts: virtual-module payload');
  assert.match(read('src/astro-ambient.d.ts'), /releaseStatus: \{ state:/, 'ambient d.ts: virtual-module type');
});

test('#149: Base.astro renders PreReleaseBanner from the virtual module, conditionally', () => {
  const base = read('layouts/Base.astro');
  assert.match(base, /import PreReleaseBanner from '\.\.\/components\/PreReleaseBanner\.astro'/);
  assert.match(base, /bookConfig\.releaseStatus &&/, 'render is gated on the config being set (default: no banner)');
  assert.match(base, /state=\{bookConfig\.releaseStatus\.state\}/);
});

test('#149: releaseStatus never leaks into the returned AstroUserConfig', async () => {
  const cfg = await defineBookConfig({
    styles: [academicStyle],
    site: 'https://test.invalid',
    releaseStatus: { state: 'beta', dismissAt: 'v0.7.0' },
  });
  assert.ok(!('releaseStatus' in cfg), 'must be stripped before forwarding to Astro');
});

test('#149: a style-chain releaseStatus applies when no top-level value is set', async () => {
  // Style objects merge unknown-future fields shallow-override; the config
  // pass reads opts.releaseStatus ?? composed.releaseStatus, so a shared
  // family style can declare the banner once for every book in the family.
  const cfg = await defineBookConfig({
    styles: [academicStyle, { __styleVersion: 1, releaseStatus: { state: 'alpha' } }],
    site: 'https://test.invalid',
  });
  assert.ok(!('releaseStatus' in cfg), 'still stripped from AstroUserConfig');
});
