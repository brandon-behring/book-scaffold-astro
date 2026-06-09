/**
 * tests/exam-engine.test.mjs — the PURE practice-exam engine (#112): sampling +
 * scoring. No browser — this is the verifiable core under the PracticeExam /
 * AssessmentTest islands. A seeded rng makes sampling/shuffle deterministic.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { sampleExam, scoreExam, shuffle } from '../dist/index.mjs';

// Deterministic rng (mulberry32) so sampling/shuffle tests are stable.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mcq = (id, domain, correctId) => ({
  id,
  domain,
  options: [
    { id: 'a', correct: correctId === 'a' },
    { id: 'b', correct: correctId === 'b' },
    { id: 'c', correct: correctId === 'c' },
  ],
});

const POOL = [
  mcq('q1', 'D1', 'a'),
  mcq('q2', 'D1', 'b'),
  mcq('q3', 'D1', 'c'),
  mcq('q4', 'D2', 'a'),
  mcq('q5', 'D2', 'b'),
  mcq('q6', 'D3', 'c'),
];

// ===== scoreExam =====

test('scoreExam: all correct → 100% and no weak domains', () => {
  const r = scoreExam([POOL[0], POOL[1], POOL[3]], { q1: 'a', q2: 'b', q4: 'a' });
  assert.equal(r.correct, 3);
  assert.equal(r.total, 3);
  assert.equal(r.pct, 100);
  assert.deepEqual(r.weakDomains, []);
});

test('scoreExam: wrong + unanswered → 0% and every domain weak', () => {
  const r = scoreExam([POOL[0], POOL[3]], { q1: 'b' /* wrong; q4 unanswered */ });
  assert.equal(r.correct, 0);
  assert.equal(r.pct, 0);
  assert.deepEqual(r.weakDomains.sort(), ['D1', 'D2']);
});

test('scoreExam: per-domain rollup + weak flag at the 0.7 mark', () => {
  const qs = [POOL[0], POOL[1], POOL[2], POOL[3], POOL[4]];
  // D1: 1/3 correct (weak); D2: 2/2 correct (strong).
  const answers = { q1: 'a', q2: 'a', q3: 'a', q4: 'a', q5: 'b' };
  const r = scoreExam(qs, answers);
  assert.deepEqual(r.byDomain.find((d) => d.domain === 'D1'), { domain: 'D1', correct: 1, total: 3 });
  assert.deepEqual(r.byDomain.find((d) => d.domain === 'D2'), { domain: 'D2', correct: 2, total: 2 });
  assert.deepEqual(r.weakDomains, ['D1']);
  assert.equal(r.pct, 60); // 3/5
});

test('scoreExam: empty set → 0% no throw', () => {
  const r = scoreExam([], {});
  assert.equal(r.total, 0);
  assert.equal(r.pct, 0);
  assert.deepEqual(r.byDomain, []);
});

// ===== sampleExam =====

test('sampleExam: count clamps to pool size; no duplicates', () => {
  const form = sampleExam(POOL, { count: 99 }, seeded(1));
  assert.equal(form.length, POOL.length);
  assert.equal(new Set(form.map((q) => q.id)).size, form.length);
});

test('sampleExam: respects per-domain quota, tops up to count', () => {
  const form = sampleExam(POOL, { count: 4, perDomain: { D1: 2, D2: 1 } }, seeded(2));
  assert.equal(form.length, 4);
  const inDomain = (d) => form.filter((q) => q.domain === d).length;
  assert.ok(inDomain('D1') >= 2, 'at least the D1 quota');
  assert.ok(inDomain('D2') >= 1, 'at least the D2 quota');
  assert.equal(new Set(form.map((q) => q.id)).size, 4);
});

test('sampleExam: deterministic under a seeded rng', () => {
  const a = sampleExam(POOL, { count: 3 }, seeded(42)).map((q) => q.id);
  const b = sampleExam(POOL, { count: 3 }, seeded(42)).map((q) => q.id);
  assert.deepEqual(a, b);
});

// ===== shuffle =====

test('shuffle: is a permutation (same multiset), pure (no mutation)', () => {
  const input = ['a', 'b', 'c', 'd'];
  const out = shuffle(input, seeded(7));
  assert.deepEqual([...out].sort(), [...input].sort());
  assert.deepEqual(input, ['a', 'b', 'c', 'd']); // unchanged
});
