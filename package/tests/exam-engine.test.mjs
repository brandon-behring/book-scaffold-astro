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

// ===== hardening (PR #131 review — "green ≠ correct" on the sampler) =====

test('shuffle: unbiased — each element reaches each position ~uniformly (F1)', () => {
  // A biased Fisher-Yates (drawing j from [0, len) instead of [0, i]) is still a
  // permutation, so the permutation/purity test can't see it. This pins
  // uniformity: over N shuffles of [0,1,2], every (position, value) cell lands
  // near N/3. The classic bias skews cells well past the band; a correct shuffle
  // stays within ~±2%.
  const N = 60000;
  const counts = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // counts[position][value]
  const rng = seeded(123);
  for (let k = 0; k < N; k++) {
    const out = shuffle([0, 1, 2], rng);
    for (let pos = 0; pos < 3; pos++) counts[pos][out[pos]]++;
  }
  const expected = N / 3;
  const tol = expected * 0.1; // ±10%
  for (let pos = 0; pos < 3; pos++) {
    for (let v = 0; v < 3; v++) {
      assert.ok(
        Math.abs(counts[pos][v] - expected) < tol,
        `cell [pos ${pos}][val ${v}] = ${counts[pos][v]}, expected ~${expected} (±${tol})`,
      );
    }
  }
});

test('sampleExam: the final shuffle runs — quota picks not locked to front slots (F2)', () => {
  // perDomain {D1:2, D2:1}, count 3 (= the quota sum, so NO top-up). Pre-final-
  // shuffle the picked order is [D1, D1, D2] (Object.entries order), so slot 2
  // would ALWAYS be D2. The final shuffle(picked) breaks that lock — drop it and
  // this fails.
  const pool = [
    mcq('a1', 'D1', 'a'), mcq('a2', 'D1', 'a'), mcq('a3', 'D1', 'a'),
    mcq('b1', 'D2', 'a'), mcq('b2', 'D2', 'a'),
  ];
  let lastIsD1 = 0;
  const rng = seeded(99);
  for (let k = 0; k < 200; k++) {
    const form = sampleExam(pool, { count: 3, perDomain: { D1: 2, D2: 1 } }, rng);
    assert.equal(form.length, 3);
    if (form[2].domain === 'D1') lastIsD1++;
  }
  assert.ok(lastIsD1 > 0, 'final shuffle should sometimes place a D1 pick in the last slot');
});

test('sampleExam: per-domain quota is exact, not just a lower bound (F3)', () => {
  // 3 of each domain; ask for exactly one each. An over-fill (quota+1) that steals
  // another domain's slot must be caught — assert EXACTLY one per domain.
  const pool = [
    mcq('a1', 'D1', 'a'), mcq('a2', 'D1', 'a'), mcq('a3', 'D1', 'a'),
    mcq('b1', 'D2', 'a'), mcq('b2', 'D2', 'a'), mcq('b3', 'D2', 'a'),
    mcq('c1', 'D3', 'a'), mcq('c2', 'D3', 'a'), mcq('c3', 'D3', 'a'),
  ];
  const form = sampleExam(pool, { count: 3, perDomain: { D1: 1, D2: 1, D3: 1 } }, seeded(3));
  const inDomain = (d) => form.filter((q) => q.domain === d).length;
  assert.equal(form.length, 3);
  assert.equal(inDomain('D1'), 1);
  assert.equal(inDomain('D2'), 1);
  assert.equal(inDomain('D3'), 1);
});

test('scoreExam: weak-domain threshold is strict < at exactly 0.7 (F4)', () => {
  const qs = [];
  const answers = {};
  for (let i = 0; i < 10; i++) { qs.push(mcq(`a${i}`, 'D1', 'a')); answers[`a${i}`] = i < 7 ? 'a' : 'b'; } // 7/10
  for (let i = 0; i < 10; i++) { qs.push(mcq(`b${i}`, 'D2', 'a')); answers[`b${i}`] = i < 6 ? 'a' : 'b'; } // 6/10
  const r = scoreExam(qs, answers);
  assert.ok(!r.weakDomains.includes('D1'), '7/10 (== 0.7) must NOT be weak');
  assert.ok(r.weakDomains.includes('D2'), '6/10 (< 0.7) must be weak');
});

test('scoreExam: pct uses Math.round, not truncation (F5)', () => {
  // q1 ✓, q2 ✓, q3 ✗ → 2/3 = 66.67 → round 67 (floor would give 66).
  const r = scoreExam([POOL[0], POOL[1], POOL[2]], { q1: 'a', q2: 'b', q3: 'a' });
  assert.equal(r.correct, 2);
  assert.equal(r.pct, 67);
});

test('scoreExam: byDomain + weakDomains keep first-seen order, not alphabetical (F6)', () => {
  const qs = [mcq('z', 'D3', 'a'), mcq('x', 'D1', 'a'), mcq('y', 'D2', 'a')];
  const r = scoreExam(qs, { z: 'b', x: 'b', y: 'b' }); // all wrong → all weak
  assert.deepEqual(r.byDomain.map((d) => d.domain), ['D3', 'D1', 'D2']);
  assert.deepEqual(r.weakDomains, ['D3', 'D1', 'D2']);
});
