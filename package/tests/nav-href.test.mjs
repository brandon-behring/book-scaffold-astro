/**
 * tests/nav-href.test.mjs — the PURE route-href resolver (#80 multi-book nav).
 *
 * Imports from dist/ (no astro:content). Locks the contract the book-aware nav
 * relies on: the single-book DEFAULT is byte-identical to the old hardcoded
 * `/chapters/<id>/`, the multi-book opt-in resolves `/<book>/<slug>/`, tokens
 * expand correctly, a non-root BASE_URL normalizes (the #142 trailing-slash
 * hazard), and current-page matching tolerates a missing trailing slash.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  chapterHref,
  apparatusHref,
  bookOf,
  slugOf,
  isCurrentChapter,
} from '../dist/index.mjs';

const single = (id) => ({ id, data: {} }); // academic/tools/minimal: no `book` field
const multi = (book, slug) => ({ id: `${book}/${slug}`, data: { book } });

// ===== bookOf / slugOf =====
test('bookOf: null when the field is absent (single-book)', () => {
  assert.equal(bookOf(single('01-intro')), null);
});

test('bookOf: reads the field (multi-book); blank → null', () => {
  assert.equal(bookOf(multi('kg', '01-intro')), 'kg');
  assert.equal(bookOf({ id: 'x', data: { book: '' } }), null);
});

test('bookOf: honors a custom bookField name', () => {
  assert.equal(bookOf({ id: 'x', data: { guide: 'kg' } }, 'guide'), 'kg');
});

test('slugOf: strips the leading <book>/ only when it matches', () => {
  assert.equal(slugOf(multi('kg', '01-intro')), '01-intro');
  assert.equal(slugOf(single('01-intro')), '01-intro'); // no book → unchanged
  assert.equal(slugOf({ id: 'kg/sub/01', data: { book: 'kg' } }), 'sub/01');
});

// ===== chapterHref: the single-book default must be byte-identical to old nav =====
test('chapterHref: default pattern reproduces /chapters/<id>/', () => {
  assert.equal(chapterHref(single('01-intro')), '/chapters/01-intro/');
  assert.equal(chapterHref(single('01-intro'), '/chapters/:id/', '/'), '/chapters/01-intro/');
});

test('chapterHref: multi-book /:id/ → /<book>/<slug>/', () => {
  assert.equal(chapterHref(multi('kg', '01-intro'), '/:id/'), '/kg/01-intro/');
});

test('chapterHref: explicit :book/:slug tokens', () => {
  assert.equal(chapterHref(multi('kg', '01-intro'), '/:book/:slug/'), '/kg/01-intro/');
});

test('chapterHref: applies + normalizes a non-root base (#142)', () => {
  assert.equal(chapterHref(single('01'), '/chapters/:id/', '/guide'), '/guide/chapters/01/');
  assert.equal(chapterHref(single('01'), '/chapters/:id/', '/guide/'), '/guide/chapters/01/');
  assert.equal(chapterHref(multi('kg', '01'), '/:id/', '/guide/'), '/guide/kg/01/');
});

// ===== apparatusHref =====
test('apparatusHref: single-book default /:route/', () => {
  assert.equal(apparatusHref('glossary', null), '/glossary/');
});

test('apparatusHref: multi-book /:book/:route/ (+ base)', () => {
  assert.equal(apparatusHref('practice-exam', 'kg', '/:book/:route/'), '/kg/practice-exam/');
  assert.equal(apparatusHref('glossary', 'kg', '/:book/:route/', '/guide/'), '/guide/kg/glossary/');
});

// ===== isCurrentChapter: trailing-slash tolerant =====
test('isCurrentChapter: matches with and without trailing slash', () => {
  const e = single('01-intro');
  assert.equal(isCurrentChapter(e, '/chapters/01-intro/'), true);
  assert.equal(isCurrentChapter(e, '/chapters/01-intro'), true);
  assert.equal(isCurrentChapter(e, '/chapters/02-other/'), false);
});

test('isCurrentChapter: multi-book pattern', () => {
  const e = multi('kg', '01-intro');
  assert.equal(isCurrentChapter(e, '/kg/01-intro/', '/:id/'), true);
  assert.equal(isCurrentChapter(e, '/eval/01-intro/', '/:id/'), false);
});
