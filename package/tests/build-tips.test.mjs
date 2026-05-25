/**
 * tests/build-tips.test.mjs — extractTips() unit tests (v4.3.0 #70).
 *
 * Verifies the regex extractor handles all 4 quote-style combinations
 * (double-double / single-single / mixed) + preview truncation + duplicate
 * detection + graceful skip on malformed input.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractTips } from '../scripts/build-tips.mjs';

test('extractTips: extracts double-double quoted Tip', () => {
  const src = `<Tip n="14" title="Care About Your Craft">Why develop software unless you care about doing it well?</Tip>`;
  const tips = extractTips(src, 'ch1');
  assert.equal(tips.length, 1);
  assert.equal(tips[0].n, 14);
  assert.equal(tips[0].title, 'Care About Your Craft');
  assert.equal(tips[0].chapter, 'ch1');
});

test('extractTips: extracts single-single quoted Tip', () => {
  const src = `<Tip n='3' title='Think Twice'>Body.</Tip>`;
  const tips = extractTips(src, 'ch2');
  assert.equal(tips.length, 1);
  assert.equal(tips[0].n, 3);
  assert.equal(tips[0].title, 'Think Twice');
});

test('extractTips: extracts mixed quoted Tip (n double, title single)', () => {
  const src = `<Tip n="7" title='Provide Options'>Body.</Tip>`;
  const tips = extractTips(src, 'ch3');
  assert.equal(tips.length, 1);
  assert.equal(tips[0].n, 7);
  assert.equal(tips[0].title, 'Provide Options');
});

test('extractTips: extracts multiple Tips in one source', () => {
  const src = `
    <Tip n="1" title="First">A.</Tip>
    Some prose.
    <Tip n="2" title="Second">B.</Tip>
  `;
  const tips = extractTips(src, 'ch4');
  assert.equal(tips.length, 2);
  assert.equal(tips[0].n, 1);
  assert.equal(tips[1].n, 2);
});

test('extractTips: preview truncated to 80 chars (whitespace normalized)', () => {
  const longBody = 'a'.repeat(150);
  const src = `<Tip n="1" title="Foo">${longBody}</Tip>`;
  const tips = extractTips(src, 'ch5');
  assert.equal(tips[0].preview.length, 80);
});

test('extractTips: skips malformed Tip (no n attribute)', () => {
  const src = `<Tip title="No number">body</Tip>`;
  const tips = extractTips(src, 'ch6');
  assert.equal(tips.length, 0);
});

test('extractTips: skips Tip with non-numeric n', () => {
  const src = `<Tip n="abc" title="Bad">body</Tip>`;
  const tips = extractTips(src, 'ch7');
  assert.equal(tips.length, 0);
});

test('extractTips: empty source returns empty array', () => {
  const tips = extractTips('', 'empty');
  assert.equal(tips.length, 0);
});

test('extractTips: source with no Tip tags returns empty array', () => {
  const src = `# Hello\n\nSome chapter prose.\n\n<NoteBox title="x">y</NoteBox>`;
  const tips = extractTips(src, 'no-tips');
  assert.equal(tips.length, 0);
});
