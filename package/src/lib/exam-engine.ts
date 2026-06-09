/**
 * exam-engine.ts — PURE sampling + scoring for the interactive practice exam
 * (#112) and the cross-domain assessment test (#113).
 *
 * No DOM, no Preact: this is the testable core both the PracticeExam island and
 * the AssessmentTest reuse, exercised in tests/exam-engine.test.mjs (node:test,
 * no browser). The islands are thin UI over these functions — selection state +
 * rendering only — so the *logic* (which questions, what score, which weak
 * domains) is verified without a headless browser.
 *
 * Randomness is injected (`rng`, default Math.random) so the sampler is
 * deterministic under test (pass a seeded rng) and varied in the browser.
 */

/** The minimum a question contributes to sampling + scoring. The stem (MDX
 *  body) is rendered server-side, NOT carried here. */
export interface ExamQuestion {
  id: string;
  domain: string;
  /** MCQ options; exactly one carries `correct: true` (enforced by the schema). */
  options: ReadonlyArray<{ id: string; correct?: boolean }>;
}

export interface ExamBlueprint {
  /** Total questions to sample (clamped to pool size). */
  count: number;
  /** Optional per-domain quota (a Bloom/weight blueprint). Filled first, then
   *  topped up from the rest of the pool to reach `count`. */
  perDomain?: Readonly<Record<string, number>>;
}

/**
 * Fisher–Yates shuffle with an injectable rng (default Math.random). Pure: it
 * copies the input rather than mutating it.
 *
 * `rng` MUST return a value in `[0, 1)` (Math.random's contract). `j` is
 * additionally clamped to `i` so a defective rng returning exactly `1.0` can't
 * index out of bounds (`Math.floor(1.0 * (i+1)) === i+1`), which would otherwise
 * punch a hole into `a` and grow its length.
 */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    // Clamp to i: a no-op for a correct [0,1) rng; guards a bad rng = 1.0.
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const ai = a[i]!; // i, j ∈ [0, i] are valid indices (noUncheckedIndexedAccess)
    a[i] = a[j]!;
    a[j] = ai;
  }
  return a;
}

/**
 * Sample a question form from the pool. With a `perDomain` blueprint, each
 * domain's quota is filled first (clamped to availability), then the form is
 * topped up from the remaining pool to reach `count`. Never returns duplicates;
 * never more than the pool holds. The result is shuffled so domain-grouped
 * picks aren't clustered.
 *
 * Caller contracts: `rng` returns `[0, 1)` (passed through to `shuffle`); and
 * `Σ perDomain ≤ count` — quotas summing past `count` are honored in
 * `Object.entries` order until the budget is spent, so later-listed domains are
 * silently starved. Validating/clamping the blueprint sum is the caller's job;
 * a guard can graduate here once a real consumer needs it.
 */
export function sampleExam(
  pool: readonly ExamQuestion[],
  blueprint: ExamBlueprint,
  rng: () => number = Math.random,
): ExamQuestion[] {
  const count = Math.max(0, Math.min(blueprint.count, pool.length));
  const picked: ExamQuestion[] = [];
  const used = new Set<string>();

  if (blueprint.perDomain) {
    for (const [domain, quota] of Object.entries(blueprint.perDomain)) {
      const inDomain = shuffle(
        pool.filter((q) => q.domain === domain && !used.has(q.id)),
        rng,
      );
      for (const q of inDomain.slice(0, Math.max(0, quota))) {
        if (picked.length >= count) break;
        picked.push(q);
        used.add(q.id);
      }
    }
  }
  // Top up to `count` from whatever's left.
  for (const q of shuffle(pool.filter((q) => !used.has(q.id)), rng)) {
    if (picked.length >= count) break;
    picked.push(q);
    used.add(q.id);
  }
  return shuffle(picked, rng);
}

export interface DomainScore {
  domain: string;
  correct: number;
  total: number;
}

export interface ExamResult {
  correct: number;
  total: number;
  /** Whole-percent score, 0–100 (0 when no questions). */
  pct: number;
  /** Per-domain rollup, in first-seen order. */
  byDomain: DomainScore[];
  /** Domains scoring below `passMark` — what the assessment routes the reader to. */
  weakDomains: string[];
}

/**
 * Score a set of answered questions. `answers` maps question id → chosen option
 * id; a question is correct when the chosen option is the one flagged
 * `correct`. Unanswered or wrongly-answered questions count as incorrect.
 * Rolls up per domain and flags domains below `passMark` (default 0.7) as weak.
 */
export function scoreExam(
  questions: readonly ExamQuestion[],
  answers: Readonly<Record<string, string>>,
  passMark = 0.7,
): ExamResult {
  const order: string[] = [];
  const tally = new Map<string, { correct: number; total: number }>();
  let correct = 0;

  for (const q of questions) {
    const chosen = answers[q.id];
    const right = chosen !== undefined && q.options.some((o) => o.correct === true && o.id === chosen);
    if (right) correct++;
    if (!tally.has(q.domain)) {
      tally.set(q.domain, { correct: 0, total: 0 });
      order.push(q.domain);
    }
    const t = tally.get(q.domain)!;
    t.total++;
    if (right) t.correct++;
  }

  const total = questions.length;
  const byDomain = order.map((domain) => ({ domain, ...tally.get(domain)! }));
  const weakDomains = byDomain
    .filter((d) => d.total > 0 && d.correct / d.total < passMark)
    .map((d) => d.domain);

  return {
    correct,
    total,
    pct: total === 0 ? 0 : Math.round((correct / total) * 100),
    byDomain,
    weakDomains,
  };
}
