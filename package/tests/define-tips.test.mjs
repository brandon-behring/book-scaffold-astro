/**
 * tests/define-tips.test.mjs — defineTips() identity + branding (v4.3.0 #70).
 *
 * Mirrors define-style.test.mjs pattern. Asserts the helper preserves opts
 * verbatim + auto-sets __tipsConfigVersion to 1 + doesn't pollute the
 * runtime with brand symbols.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { defineTips } from '../dist/index.mjs';

test('defineTips: returns object with __tipsConfigVersion = 1', () => {
  const tips = defineTips({});
  assert.equal(tips.__tipsConfigVersion, 1);
});

test('defineTips: preserves volumeOffset + volumeLabel', () => {
  const tips = defineTips({ volumeOffset: 25, volumeLabel: 'Vol B' });
  assert.equal(tips.volumeOffset, 25);
  assert.equal(tips.volumeLabel, 'Vol B');
});

test('defineTips: preserves extra metadata', () => {
  const tips = defineTips({
    extra: { internalNote: 'workspace shares this offset' },
  });
  assert.deepEqual(tips.extra, { internalNote: 'workspace shares this offset' });
});

test('defineTips: empty opts → only version marker on object', () => {
  const tips = defineTips({});
  assert.equal(tips.__tipsConfigVersion, 1);
  // No volumeOffset / volumeLabel / extra fields present
  assert.equal(Object.keys(tips).length, 1);
});

test('defineTips: type-only brand is NOT a runtime property', () => {
  const tips = defineTips({ volumeOffset: 10 });
  // Brand is type-only via `declare const StyleBrand: unique symbol` — no Symbol key emitted
  const symbolKeys = Object.getOwnPropertySymbols(tips);
  assert.equal(symbolKeys.length, 0, 'no Symbol-keyed brand should leak into runtime');
});

test('defineTips: spreading a TipsConfig preserves all data fields', () => {
  const tips = defineTips({ volumeOffset: 5, volumeLabel: 'Vol A' });
  const spread = { ...tips };
  assert.equal(spread.__tipsConfigVersion, 1);
  assert.equal(spread.volumeOffset, 5);
  assert.equal(spread.volumeLabel, 'Vol A');
});
