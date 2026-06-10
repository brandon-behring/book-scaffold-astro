/**
 * tests/exam-manifest.test.mjs — node:test suite for the PURE manifest/routing
 * bridge between the questions collection and the ExamRunner island
 * (v4.21.0, #112-UI/#113).
 *
 * Pure (no astro:content) — imports straight from dist/. Mock entries use the
 * same `{ data: {...} }` shape as a CollectionEntry. Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildExamManifest,
  deriveDomainRouting,
  spreadBlueprint,
  sampleExam,
} from '../dist/index.mjs';

const mcq = (id, domain, chapter, extra = {}) => ({
  data: {
    id,
    type: 'mcq',
    domain,
    chapter,
    draft: false,
    options: [
      { id: 'a', text: 'A', correct: true },
      { id: 'b', text: 'B', correct: false },
    ],
    ...extra,
  },
});
const free = (id, domain, chapter) => ({
  data: { id, type: 'free', domain, chapter, draft: false, answer: 'model answer' },
});

const BANK = [
  mcq('q1', 'arrays', 1),
  mcq('q2', 'arrays', 2),
  free('q3', 'arrays', 1),
  mcq('q4', 'strings', 'appendix-strings'),
  mcq('q5', 'strings', 1, { draft: true }),
  { data: { id: 'q6', type: 'cloze', domain: 'strings', chapter: 2, draft: false } },
];

test('buildExamManifest keeps only published MCQs with options', () => {
  const manifest = buildExamManifest(BANK);
  assert.deepEqual(manifest.map((q) => q.id), ['q1', 'q2', 'q4']);
});

test('buildExamManifest strips to the pure ExamQuestion shape (no stems, no text needed)', () => {
  const [q1] = buildExamManifest(BANK);
  assert.deepEqual(q1, {
    id: 'q1',
    domain: 'arrays',
    options: [
      { id: 'a', correct: true },
      { id: 'b', correct: false },
    ],
  });
});

test('buildExamManifest output feeds sampleExam directly (engine contract)', () => {
  const manifest = buildExamManifest(BANK);
  const form = sampleExam(manifest, { count: 2 }, () => 0.5);
  assert.equal(form.length, 2);
  for (const q of form) assert.ok(manifest.some((m) => m.id === q.id));
});

test('deriveDomainRouting links string chapters, labels numeric ones (#113 — no fabricated URLs)', () => {
  const routing = deriveDomainRouting(BANK);
  assert.deepEqual(routing.arrays, [
    { label: '1', href: null },
    { label: '2', href: null },
  ]);
  // q5 is draft but routing derives from ALL entries passed in — callers pass
  // getAllQuestions() output (already draft-filtered); q4's slug chapter links.
  assert.deepEqual(
    routing.strings.find((c) => c.label === 'appendix-strings'),
    { label: 'appendix-strings', href: '/chapters/appendix-strings/' },
  );
});

test('deriveDomainRouting dedupes chapters per domain, in book order (numeric before string)', () => {
  const routing = deriveDomainRouting([
    mcq('a1', 'd', 'zeta'),
    mcq('a2', 'd', 2),
    mcq('a3', 'd', 2),
    mcq('a4', 'd', 1),
  ]);
  assert.deepEqual(routing.d.map((c) => c.label), ['1', '2', 'zeta']);
});

test('spreadBlueprint spreads count evenly across pool domains (min 1 each)', () => {
  const pool = buildExamManifest([
    mcq('q1', 'arrays', 1),
    mcq('q2', 'strings', 1),
    mcq('q3', 'recursion', 1),
  ]);
  assert.deepEqual(spreadBlueprint(pool, 9), {
    count: 9,
    perDomain: { arrays: 3, strings: 3, recursion: 3 },
  });
  // count below domain count: 1 per domain, sampleExam honors until budget spent.
  assert.deepEqual(spreadBlueprint(pool, 2).perDomain, {
    arrays: 1,
    strings: 1,
    recursion: 1,
  });
});

test('spreadBlueprint on an empty pool is a bare count (no perDomain)', () => {
  assert.deepEqual(spreadBlueprint([], 5), { count: 5 });
});

test('spreadBlueprint + sampleExam covers every domain when count allows (#113 cross-domain)', () => {
  const pool = buildExamManifest([
    mcq('q1', 'arrays', 1),
    mcq('q2', 'arrays', 1),
    mcq('q3', 'arrays', 1),
    mcq('q4', 'strings', 1),
    mcq('q5', 'recursion', 1),
  ]);
  // Deterministic rng; 3 of 5 with a 1-per-domain quota → all 3 domains present.
  const form = sampleExam(pool, spreadBlueprint(pool, 3), () => 0.25);
  const domains = new Set(form.map((q) => q.domain));
  assert.deepEqual([...domains].sort(), ['arrays', 'recursion', 'strings']);
});
