/**
 * tests/font-display.test.mjs — delayed Roboto CLS policy (#187).
 *
 * Exercise the real Vite plugin installed by defineBookConfig so the test
 * proves both registration and the deliberately narrow Fontsource transform.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defineBookConfig, minimalStyle } from '../dist/index.mjs';

async function resolveFontDisplayPlugin() {
  const config = await defineBookConfig({
    styles: [minimalStyle],
    site: 'https://font-policy.test.invalid',
  });
  const integration = config.integrations.find(
    ({ name }) => name === 'book-scaffold-astro',
  );
  assert.ok(integration, 'defineBookConfig should install the scaffold integration');

  let injectedConfig;
  await integration.hooks['astro:config:setup']({
    injectScript() {},
    injectRoute() {},
    updateConfig(next) {
      injectedConfig = next;
    },
    config: { root: new URL('../', import.meta.url) },
  });

  const plugin = injectedConfig?.vite?.plugins?.find(
    ({ name }) => name === 'book-scaffold:roboto-font-display',
  );
  assert.ok(plugin, 'the integration should install the Roboto display plugin');
  return plugin;
}

const robotoCss = `
@font-face {
  font-family: 'Roboto Variable';
  font-display: swap;
  src: url(./files/roboto-latin-wght-normal.woff2);
}
`;

test('#187: the package-owned Roboto entry changes swap to optional', async () => {
  const plugin = await resolveFontDisplayPlugin();
  const result = plugin.transform(
    robotoCss,
    '/repo/node_modules/@fontsource-variable/roboto/index.css?direct',
  );
  assert.ok(result && typeof result === 'object');
  assert.match(result.code, /font-display: optional/);
  assert.doesNotMatch(result.code, /font-display:\s*swap/);
});

test('#187: Windows paths receive the same package-owned transform', async () => {
  const plugin = await resolveFontDisplayPlugin();
  const result = plugin.transform(
    robotoCss,
    String.raw`C:\repo\node_modules\@fontsource-variable\roboto\index.css`,
  );
  assert.match(result.code, /font-display: optional/);
});

test('#187: consumer and non-Roboto font CSS remain untouched', async () => {
  const plugin = await resolveFontDisplayPlugin();
  assert.equal(plugin.transform(robotoCss, '/consumer/src/fonts.css'), null);
  assert.equal(
    plugin.transform(
      robotoCss.replaceAll('Roboto', 'Source Code Pro'),
      '/repo/node_modules/@fontsource-variable/source-code-pro/index.css',
    ),
    null,
  );
});

test('#187: Base preloads the same Latin variable face with CORS enabled', () => {
  const base = readFileSync(new URL('../layouts/Base.astro', import.meta.url), 'utf8');
  assert.match(
    base,
    /roboto-latin-wght-normal\.woff2\?url/,
    'Base should import the Vite-managed Latin font asset',
  );
  assert.match(base, /rel="preload"[\s\S]*href=\{robotoLatinUrl\}[\s\S]*as="font"/);
  assert.match(base, /crossorigin="anonymous"/);
});
