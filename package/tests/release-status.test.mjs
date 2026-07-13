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
import {
  defineBookConfig,
  defineStyle,
  academicStyle,
} from '../dist/index.mjs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

async function resolveVirtualBookConfig(opts) {
  const cfg = await defineBookConfig(opts);
  const integration = cfg.integrations.find(({ name }) => name === 'book-scaffold-astro');
  assert.ok(integration, 'defineBookConfig should install the scaffold integration');

  let injectedConfig;
  await integration.hooks['astro:config:setup']({
    injectScript() {},
    injectRoute() {},
    updateConfig(config) {
      injectedConfig = config;
    },
    config: { root: new URL('../', import.meta.url) },
  });
  assert.ok(injectedConfig, 'the integration should update Astro config');

  const plugin = injectedConfig.vite.plugins.find(
    ({ name }) => name === 'book-scaffold:book-config',
  );
  assert.ok(plugin, 'the integration should install the book-config virtual plugin');
  const resolvedId = plugin.resolveId('virtual:book-scaffold/book-config');
  const source = plugin.load(resolvedId);
  assert.match(source, /^export default .*;$/);
  return JSON.parse(source.slice('export default '.length, -1));
}

test('#149: the threading chain carries releaseStatus end-to-end (source pins)', () => {
  assert.match(read('src/types.ts'), /releaseStatus\?: ReleaseStatusConfig \| false/,
    'types.ts: public option');
  const config = read('src/config.ts');
  assert.match(config, /opts\.releaseStatus !== undefined \? opts\.releaseStatus : composed\.releaseStatus/,
    'config.ts: preserves explicit false while applying top-level-over-chain precedence');
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

test('#149: a style-chain releaseStatus reaches the rendered virtual config', async () => {
  const bookConfig = await resolveVirtualBookConfig({
    styles: [
      academicStyle,
      defineStyle({ releaseStatus: { state: 'alpha', message: 'Family preview' } }),
    ],
    site: 'https://test.invalid',
  });
  assert.deepEqual(bookConfig.releaseStatus, {
    state: 'alpha',
    message: 'Family preview',
  });
});

test('#149: a later style releaseStatus replaces the whole inherited object', async () => {
  const bookConfig = await resolveVirtualBookConfig({
    styles: [
      academicStyle,
      defineStyle({
        releaseStatus: {
          state: 'alpha',
          dismissAt: 'v1.0.0',
          message: 'Family preview',
        },
      }),
      defineStyle({ releaseStatus: { state: 'rc' } }),
    ],
    site: 'https://test.invalid',
  });
  assert.deepEqual(bookConfig.releaseStatus, { state: 'rc' });
});

test('#149: releaseStatus=false in a later style suppresses an inherited banner', async () => {
  const bookConfig = await resolveVirtualBookConfig({
    styles: [
      academicStyle,
      defineStyle({ releaseStatus: { state: 'beta' } }),
      defineStyle({ releaseStatus: false }),
    ],
    site: 'https://test.invalid',
  });
  assert.equal(bookConfig.releaseStatus, null);
});

test('#149: top-level releaseStatus wins over the composed style chain', async () => {
  const objectOverride = await resolveVirtualBookConfig({
    styles: [
      academicStyle,
      defineStyle({
        releaseStatus: { state: 'alpha', message: 'Inherited message' },
      }),
    ],
    site: 'https://test.invalid',
    releaseStatus: { state: 'locked' },
  });
  assert.deepEqual(objectOverride.releaseStatus, { state: 'locked' });

  const falseOverride = await resolveVirtualBookConfig({
    styles: [
      academicStyle,
      defineStyle({ releaseStatus: { state: 'beta' } }),
    ],
    site: 'https://test.invalid',
    releaseStatus: false,
  });
  assert.equal(falseOverride.releaseStatus, null);
});
