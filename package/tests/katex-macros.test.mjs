/**
 * tests/katex-macros.test.mjs — defineBookConfig({ katexMacros }) merges
 * consumer macros onto ssmMacros (closes #22).
 *
 * Verifies:
 *   1. Without katexMacros: rehype-katex receives unchanged ssmMacros.
 *   2. With katexMacros: receives a shallow merge (ssm + consumer).
 *   3. Consumer wins on key collision (override semantics).
 *   4. Omitting katexMacros is backward compatible.
 *
 * Tested via the compiled dist/index.mjs so the test exercises the same
 * code path consumers see post-publish.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { defineBookConfig } from '../dist/index.mjs';
import { ssmMacros } from '../dist/lib/katex-macros.mjs';

/**
 * Walk the returned Astro config and pull out the rehype-katex plugin's
 * options object. The scaffold registers rehype-katex as a [plugin, options]
 * tuple; we identify it by the presence of `strict` + `macros` keys.
 */
function findRehypeKatexOptions(config) {
  const rehypePlugins = config?.markdown?.rehypePlugins ?? [];
  for (const entry of rehypePlugins) {
    if (Array.isArray(entry) && entry.length === 2 && typeof entry[1] === 'object') {
      const opts = entry[1];
      if (opts && 'strict' in opts && 'macros' in opts) {
        return opts;
      }
    }
  }
  return null;
}

test('katex-macros: omitting katexMacros yields the scaffold ssmMacros (backward compat)', async () => {
  const config = await defineBookConfig({
    site: 'https://test.invalid',
    preset: 'academic',
  });
  const katexOpts = findRehypeKatexOptions(config);
  assert.ok(katexOpts, 'rehype-katex should be registered on academic profile');
  assert.deepEqual(
    katexOpts.macros,
    ssmMacros,
    'omitting katexMacros must yield exactly ssmMacros',
  );
});

test('katex-macros: consumer macros are merged onto ssmMacros (closes #22)', async () => {
  const consumerMacros = {
    '\\Var': '\\mathrm{Var}',
    '\\Cov': '\\mathrm{Cov}',
  };
  const config = await defineBookConfig({
    site: 'https://test.invalid',
    preset: 'academic',
    katexMacros: consumerMacros,
  });
  const katexOpts = findRehypeKatexOptions(config);
  assert.ok(katexOpts, 'rehype-katex should be registered on academic profile');
  // ssmMacros entries all present
  for (const [key, value] of Object.entries(ssmMacros)) {
    assert.equal(
      katexOpts.macros[key],
      value,
      `ssmMacros key ${key} should still be present after consumer merge`,
    );
  }
  // Consumer entries present
  assert.equal(katexOpts.macros['\\Var'], '\\mathrm{Var}', 'consumer \\Var macro should be in merged set');
  assert.equal(katexOpts.macros['\\Cov'], '\\mathrm{Cov}', 'consumer \\Cov macro should be in merged set');
});

test('katex-macros: consumer wins on key collision (override semantics, closes #22)', async () => {
  // Pick a key that exists in ssmMacros and override its expansion.
  const collidingKey = Object.keys(ssmMacros)[0];
  assert.ok(collidingKey, 'ssmMacros must export at least one macro for this test');
  const consumerMacros = { [collidingKey]: '\\overridden{}' };
  const config = await defineBookConfig({
    site: 'https://test.invalid',
    preset: 'academic',
    katexMacros: consumerMacros,
  });
  const katexOpts = findRehypeKatexOptions(config);
  assert.equal(
    katexOpts.macros[collidingKey],
    '\\overridden{}',
    `consumer override of ${collidingKey} must win over the scaffold default`,
  );
});

test('katex-macros: tools profile does NOT register rehype-katex (no leak)', async () => {
  const config = await defineBookConfig({
    site: 'https://test.invalid',
    preset: 'tools',
    katexMacros: { '\\Var': '\\mathrm{Var}' },
  });
  const katexOpts = findRehypeKatexOptions(config);
  assert.equal(
    katexOpts,
    null,
    'rehype-katex should not be registered on tools profile, even when katexMacros is supplied',
  );
});
