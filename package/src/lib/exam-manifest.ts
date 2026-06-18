/**
 * exam-manifest.ts — PURE bridge between the `questions` collection and the
 * ExamRunner island (#112-UI / #113).
 *
 * The island can't receive MDX stems (render() yields an Astro component, not
 * serializable HTML), so the .astro side server-renders every question card and
 * passes the island ONLY this manifest — exactly the `ExamQuestion` shape the
 * pure engine (sampleExam/scoreExam) consumes. One source of truth: the island
 * never re-derives correctness; it reads the same per-option `correct` flags
 * the schema enforced (exactly-one-correct).
 *
 * No astro:content import — node-tested straight from dist/
 * (tests/exam-manifest.test.mjs), same split as questions-derive.ts.
 */
import type { Question } from '../schemas.js';
import type { ExamBlueprint, ExamQuestion } from './exam-engine.js';
import { chapterLabel, sortQuestions } from './questions-derive.js';

/** The entry shape both helpers accept — a CollectionEntry-like wrapper. */
type QuestionLike = {
  data: Pick<Question, 'id' | 'type' | 'domain' | 'chapter' | 'draft' | 'options'>;
};

/**
 * Filter a question bank down to the auto-scoreable form pool: published
 * (non-draft) MCQs with options. `free` and `cloze` questions can't be scored
 * client-side, so they never enter the manifest — the cards stay in the static
 * bank and hide during an active exam (data-exam-scoreable="false").
 */
export function buildExamManifest(entries: readonly QuestionLike[]): ExamQuestion[] {
  return entries
    .filter((e) => !e.data.draft && e.data.type === 'mcq' && (e.data.options?.length ?? 0) > 0)
    .map((e) => ({
      id: e.data.id,
      domain: e.data.domain,
      options: (e.data.options ?? []).map((o) => ({ id: o.id, correct: o.correct === true })),
    }));
}

/** One chapter a weak domain routes the reader to. `href` is null when the
 *  question's `chapter` is numeric — a number is a label, not a slug, so
 *  fabricating `/chapters/<n>/` would 404 by construction. */
export interface RoutingChapter {
  label: string;
  href: string | null;
}

/**
 * Derive the weak-domain → chapters routing map for `<AssessmentTest>` (#113):
 * for each domain, the distinct chapters (in book order) that carry ≥1 question
 * in it. String chapters are slugs (the schema's kebab-case branch) and link to
 * `${baseUrl}chapters/<slug>/`; numeric chapters render as plain labels.
 *
 * `baseUrl` (default '/') is the deploy base, injected by the .astro caller from
 * import.meta.env.BASE_URL — NOT read here, because this lib ships pre-compiled
 * in dist/ where Vite's env replacement does not reach, so a self-read would
 * silently drop the base under a non-root deploy (#142).
 */
export function deriveDomainRouting(
  entries: readonly (QuestionLike & { data: Pick<Question, 'id' | 'chapter' | 'domain'> })[],
  baseUrl = '/',
): Record<string, RoutingChapter[]> {
  // #142: normalize so a no-trailing-slash base ('/foo') still yields '/foo/chapters/'
  // rather than '/foochapters/' (Astro does NOT guarantee a trailing slash on base).
  const base = baseUrl.replace(/\/?$/, '/');
  const out: Record<string, RoutingChapter[]> = {};
  const seen = new Set<string>(); // domain\u0000label pairs already routed
  for (const e of sortQuestions(entries)) {
    const label = chapterLabel(e.data.chapter);
    const key = `${e.data.domain}\u0000${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (out[e.data.domain] ??= []).push({
      label,
      href: typeof e.data.chapter === 'string' ? `${base}chapters/${e.data.chapter}/` : null,
    });
  }
  return out;
}

/**
 * Build the cross-domain blueprint for assessment mode: spread `count` evenly
 * across the domains present in the pool (floor, minimum 1 per domain), letting
 * sampleExam's top-up fill the remainder. With more domains than `count`,
 * quotas are honored in pool-domain order until the budget is spent — same
 * caller contract sampleExam documents.
 */
export function spreadBlueprint(
  pool: readonly ExamQuestion[],
  count: number,
): ExamBlueprint {
  const domains = [...new Set(pool.map((q) => q.domain))];
  if (domains.length === 0) return { count };
  const quota = Math.max(1, Math.floor(count / domains.length));
  return {
    count,
    perDomain: Object.fromEntries(domains.map((d) => [d, quota])),
  };
}
