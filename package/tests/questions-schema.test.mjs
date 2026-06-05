/**
 * tests/questions-schema.test.mjs — node:test suite for the study-guide
 * `questions` collection schema (v4.17.0, Tier 3 #112).
 *
 * The collection registers `questionSchema.superRefine(refineQuestion)`
 * (schemas-entry.ts). We exercise that exact composed form: the flat envelope
 * validates structure + `.strict()` rejects stray keys; refineQuestion enforces
 * the per-type invariants (exactly-one-correct MCQ option, etc.). Malformed
 * questions must fail the build — the fail-loud invariant applied to authoring.
 *
 * Tests import from dist/ (node:test can't load TS). Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { questionSchema, refineQuestion } from '../dist/index.mjs';

// The exact form Astro validates against (refine wrapped at registration).
const schema = questionSchema.superRefine(refineQuestion);

const validMcq = {
  id: 'q-tls-1',
  type: 'mcq',
  chapter: 1,
  domain: 'crypto',
  options: [
    { id: 'a', correct: true, text: 'Confidentiality + integrity' },
    { id: 'b', text: 'Availability only' },
    { id: 'c', text: 'Nothing' },
  ],
};

test('accepts a valid MCQ; applies defaults (draft/tags, option.correct)', () => {
  const r = schema.safeParse(validMcq);
  assert.ok(r.success, r.success ? '' : JSON.stringify(r.error.issues));
  assert.equal(r.data.draft, false);
  assert.deepEqual(r.data.tags, []);
  // option `correct` defaults to false where omitted
  assert.equal(r.data.options[1].correct, false);
});

test('REJECTS an MCQ with two correct options (exactly-one invariant)', () => {
  const r = schema.safeParse({
    ...validMcq,
    options: [
      { id: 'a', correct: true },
      { id: 'b', correct: true },
    ],
  });
  assert.ok(!r.success);
  assert.match(r.error.issues[0].message, /EXACTLY ONE option with correct: true/);
});

test('REJECTS an MCQ with zero correct options', () => {
  const r = schema.safeParse({
    ...validMcq,
    options: [{ id: 'a' }, { id: 'b' }],
  });
  assert.ok(!r.success);
  assert.match(r.error.issues[0].message, /EXACTLY ONE option/);
});

test('REJECTS an MCQ with fewer than 2 options', () => {
  const r = schema.safeParse({ ...validMcq, options: [{ id: 'a', correct: true }] });
  assert.ok(!r.success);
  assert.match(r.error.issues[0].message, /needs ≥2 options/);
});

test('REJECTS an MCQ with duplicate option ids', () => {
  const r = schema.safeParse({
    ...validMcq,
    options: [
      { id: 'a', correct: true },
      { id: 'a' },
    ],
  });
  assert.ok(!r.success);
  assert.match(r.error.issues[0].message, /duplicate option ids/);
});

test('accepts a free-response with a model answer', () => {
  const r = schema.safeParse({
    id: 'q-free-1',
    type: 'free',
    chapter: 2,
    domain: 'crypto',
    answer: 'Because the handshake derives session keys via the KDF.',
  });
  assert.ok(r.success, r.success ? '' : JSON.stringify(r.error.issues));
});

test('REJECTS a free-response without an answer (appendix needs it)', () => {
  const r = schema.safeParse({ id: 'q-free-2', type: 'free', chapter: 2, domain: 'crypto' });
  assert.ok(!r.success);
  assert.match(r.error.issues[0].message, /needs an "answer"/);
});

test('REJECTS a free-response that also defines MCQ options', () => {
  const r = schema.safeParse({
    id: 'q-free-3',
    type: 'free',
    chapter: 2,
    domain: 'crypto',
    answer: 'x',
    options: [{ id: 'a', correct: true }, { id: 'b' }],
  });
  assert.ok(!r.success);
  assert.match(r.error.issues[0].message, /must not define MCQ options/);
});

test('accepts a cloze question (reserved type — schema-accepted, no invariants)', () => {
  const r = schema.safeParse({ id: 'q-cloze-1', type: 'cloze', chapter: 3, domain: 'crypto' });
  assert.ok(r.success, r.success ? '' : JSON.stringify(r.error.issues));
});

test('REJECTS an unknown frontmatter key (.strict — typo fails loud)', () => {
  const r = schema.safeParse({ ...validMcq, bogusField: 'oops' });
  assert.ok(!r.success);
});

test('REJECTS a missing required field (no domain)', () => {
  const { domain, ...noDomain } = validMcq;
  void domain;
  const r = schema.safeParse(noDomain);
  assert.ok(!r.success);
});

test('REJECTS an unknown type value', () => {
  const r = schema.safeParse({ ...validMcq, type: 'matching' });
  assert.ok(!r.success);
});

test('accepts an academic-style string chapter + optional bloom/difficulty', () => {
  const r = schema.safeParse({
    ...validMcq,
    chapter: 'appendix-a',
    bloom_level: 'analyze',
    difficulty: '3',
    objective_id: '2.1',
  });
  assert.ok(r.success, r.success ? '' : JSON.stringify(r.error.issues));
});
