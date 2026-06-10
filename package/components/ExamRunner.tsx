/**
 * ExamRunner — Preact island driving the interactive practice exam (#112-UI)
 * and the front-matter assessment test (#113).
 *
 * Architecture: a CONTROLLER over server-rendered question cards, not a
 * client-side renderer. MDX stems can't serialize into island props, so the
 * .astro side renders every card statically (QuestionCard.astro: stem, options
 * as radio inputs named `exam-<qid>`, answer behind <details>) and this island
 * receives only the pure manifest — the exact `ExamQuestion` shape
 * sampleExam/scoreExam consume. The island samples a form client-side, hides
 * the cards that aren't in it, collects the checked radios on submit, scores
 * with the SAME engine the node:test suite verifies, and renders the
 * score/per-domain/weak-domain readout. No JS → the static bank with
 * <details> reveals is untouched.
 *
 * DOM contract with the .astro side (QuestionCard inside a [data-exam-root]):
 *   [data-exam-root]                      wrapper section; gains
 *                                         data-exam-phase="active|review"
 *   [data-question-id="<id>"]             one card per question; toggled via
 *                                         the `hidden` attribute; gains
 *                                         data-exam-result="correct|incorrect"
 *   input[name="exam-<id>"]:checked       the reader's chosen option id
 *   details.question-reveal               force-opened on review
 *
 * Hydrated with `client:idle`. Theme via CSS tokens only (no canvas — no
 * book:theme:change listener needed).
 */
import { useRef, useState } from 'preact/hooks';
import {
  sampleExam,
  scoreExam,
  type ExamQuestion,
  type ExamResult,
} from '../src/lib/exam-engine';
import { spreadBlueprint, type RoutingChapter } from '../src/lib/exam-manifest';

interface Props {
  /** Scoreable MCQ pool (buildExamManifest output) — ids/domains/options only. */
  manifest: ExamQuestion[];
  /** practice: domain-agnostic sampling, weak domains anchor to #domain-<d> on
   *  the same page. assessment: cross-domain spread blueprint, weak domains
   *  route to chapters via `domainRouting`. */
  mode: 'practice' | 'assessment';
  /** Default form size (clamped to the pool; reader can adjust before start). */
  count?: number;
  /** Weak-domain threshold passed to scoreExam (default 0.7). */
  passMark?: number;
  /** Assessment mode: domain → chapters carrying its questions (deriveDomainRouting). */
  domainRouting?: Record<string, RoutingChapter[]>;
  /** Assessment mode: href of the practice bank when that route is enabled, else null. */
  practiceExamHref?: string | null;
}

type Phase = 'idle' | 'active' | 'review';

export default function ExamRunner({
  manifest,
  mode,
  count,
  passMark = 0.7,
  domainRouting = {},
  practiceExamHref = null,
}: Props) {
  const poolSize = manifest.length;
  const defaultCount = Math.min(count ?? (mode === 'assessment' ? 12 : 10), poolSize);
  const [phase, setPhase] = useState<Phase>('idle');
  const [requested, setRequested] = useState(defaultCount);
  const [form, setForm] = useState<ExamQuestion[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function root(): HTMLElement | null {
    return ref.current?.closest('[data-exam-root]') ?? null;
  }
  function cards(r: HTMLElement): HTMLElement[] {
    // Array.from, not spread — the dts tsconfig lib lacks DOM.Iterable.
    return Array.from(r.querySelectorAll<HTMLElement>('[data-question-id]'));
  }
  function radios(r: HTMLElement): HTMLInputElement[] {
    return Array.from(r.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  }

  function start(): void {
    const r = root();
    if (!r) return;
    const n = Math.max(1, Math.min(requested, poolSize));
    const sampled =
      mode === 'assessment'
        ? sampleExam(manifest, spreadBlueprint(manifest, n))
        : sampleExam(manifest, { count: n });
    const inForm = new Set(sampled.map((q) => q.id));
    for (const card of cards(r)) {
      card.hidden = !inForm.has(card.dataset.questionId ?? '');
      card.removeAttribute('data-exam-result');
      const reveal = card.querySelector<HTMLDetailsElement>('details.question-reveal');
      if (reveal) reveal.open = false;
    }
    for (const input of radios(r)) {
      input.checked = false;
    }
    r.setAttribute('data-exam-phase', 'active');
    setForm(sampled);
    setResult(null);
    setPhase('active');
  }

  function submit(): void {
    const r = root();
    if (!r) return;
    const answers: Record<string, string> = {};
    for (const q of form) {
      const checked = r.querySelector<HTMLInputElement>(`input[name="exam-${q.id}"]:checked`);
      if (checked) answers[q.id] = checked.value;
    }
    for (const q of form) {
      const card = r.querySelector<HTMLElement>(`[data-question-id="${q.id}"]`);
      if (!card) continue;
      const right = q.options.some((o) => o.correct === true && o.id === answers[q.id]);
      card.setAttribute('data-exam-result', right ? 'correct' : 'incorrect');
      const reveal = card.querySelector<HTMLDetailsElement>('details.question-reveal');
      if (reveal) reveal.open = true;
    }
    r.setAttribute('data-exam-phase', 'review');
    setResult(scoreExam(form, answers, passMark));
    setPhase('review');
  }

  function reset(): void {
    const r = root();
    if (!r) return;
    for (const card of cards(r)) {
      card.hidden = false;
      card.removeAttribute('data-exam-result');
    }
    for (const input of radios(r)) {
      input.checked = false;
    }
    r.removeAttribute('data-exam-phase');
    setForm([]);
    setResult(null);
    setPhase('idle');
  }

  if (poolSize === 0) {
    return (
      <p class="exam-runner-empty">
        No auto-scoreable (multiple-choice) questions available — free-response and
        cloze items can't be machine-scored.
      </p>
    );
  }

  return (
    <div class="exam-runner" ref={ref}>
      {phase === 'idle' && (
        <div class="exam-runner-controls">
          <p class="exam-runner-intro">
            {mode === 'assessment'
              ? 'Take a cross-domain assessment: a sampled form spread over every exam domain, scored with a weak-domain readout routing you to the chapters to (re)read.'
              : 'Take a scored practice exam: a random form sampled from the bank below, with a per-domain score readout.'}
          </p>
          <label class="exam-runner-count-label">
            Questions:{' '}
            <input
              type="number"
              class="exam-runner-count"
              min={1}
              max={poolSize}
              value={requested}
              onInput={(e) => {
                const v = Number.parseInt((e.target as HTMLInputElement).value, 10);
                if (Number.isFinite(v)) setRequested(Math.max(1, Math.min(v, poolSize)));
              }}
            />{' '}
            of {poolSize}
          </label>
          <button type="button" class="exam-runner-button exam-runner-start" onClick={start}>
            Start {mode === 'assessment' ? 'assessment' : 'practice exam'}
          </button>
        </div>
      )}

      {phase === 'active' && (
        <div class="exam-runner-controls">
          <p class="exam-runner-status" role="status">
            {form.length} question{form.length === 1 ? '' : 's'} below — answers stay
            hidden until you submit.
          </p>
          <button type="button" class="exam-runner-button exam-runner-submit" onClick={submit}>
            Submit answers
          </button>
          <button type="button" class="exam-runner-button exam-runner-cancel" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {phase === 'review' && result && (
        <div class="exam-runner-scoreboard" aria-live="polite">
          <p class="exam-runner-score">
            <strong>{result.pct}%</strong> — {result.correct} of {result.total} correct
          </p>
          <table class="exam-runner-domains">
            <thead>
              <tr>
                <th scope="col">Domain</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {result.byDomain.map((d) => (
                <tr class={result.weakDomains.includes(d.domain) ? 'exam-runner-weak' : undefined}>
                  <th scope="row">{d.domain}</th>
                  <td>
                    {d.correct}/{d.total}
                    {result.weakDomains.includes(d.domain) && (
                      <span class="exam-runner-weak-mark"> — review</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.weakDomains.length > 0 && (
            <div class="exam-runner-routing">
              <p class="exam-runner-routing-lead">
                {mode === 'assessment'
                  ? 'Weak domains — start with these chapters:'
                  : 'Weak domains — review these sections of the bank:'}
              </p>
              <ul class="exam-runner-routing-list">
                {result.weakDomains.map((domain) => (
                  <li>
                    <strong class="exam-runner-routing-domain">{domain}</strong>
                    {mode === 'practice' && (
                      <>
                        {' '}
                        — <a href={`#domain-${domain}`}>jump to {domain} questions</a>
                      </>
                    )}
                    {mode === 'assessment' && (domainRouting[domain]?.length ?? 0) > 0 && (
                      <>
                        {' — '}
                        {domainRouting[domain]!.map((ch, i) => (
                          <>
                            {i > 0 && ', '}
                            {ch.href ? (
                              <a href={ch.href}>chapter {ch.label}</a>
                            ) : (
                              <span>chapter {ch.label}</span>
                            )}
                          </>
                        ))}
                      </>
                    )}
                    {mode === 'assessment' && practiceExamHref && (
                      <>
                        {' '}
                        (<a href={`${practiceExamHref}#domain-${domain}`}>practice more</a>)
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" class="exam-runner-button exam-runner-retake" onClick={start}>
            Retake
          </button>
          <button type="button" class="exam-runner-button exam-runner-reset" onClick={reset}>
            {mode === 'assessment' ? 'Show all questions' : 'Show full bank'}
          </button>
        </div>
      )}
    </div>
  );
}
