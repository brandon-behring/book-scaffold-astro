# RFC: Study-guide system (epic #122)

**Status:** COMPLETE (2026-06-10) — all eight issues (#110–#117) shipped across v4.17.0 → v4.22.0.
**Issues:** epic #122; #110–#117. **Tracking plan:** `~/.claude/plans/examine-the-git-issue-steady-goose.md` (Tier 3).

## Problem

The scaffold has inline `<Exercise>`/`<Practice>` items but no *assessment apparatus* — the Cisco-Press / Sybex / Pearson "Official Cert Guide" machinery (pooled practice exams, per-chapter diagnostics, a front-matter assessment test, an answer-rationale appendix, a searchable glossary, electronic flashcards, an objective-coverage map). Eight issues (#110–#117) request these. They are not eight independent tickets: six of them hang off one lynchpin — **how assessment items are stored** (#112).

## The organizing insight: static spine before interactive layer

The 8 issues split along an architectural seam:

- **Static spine** (build-time, Zod-guaranteed, *no new client architecture*): the `questions` collection (#112-data), static question rendering with collapsible answers, the answer-rationale appendix (#114), the objective-map (#117), the glossary listing (#115).
- **Interactive layer** (client-side state / islands): the scored pooled practice-exam (#112-engine), the weak-domain-routing assessment test (#113), flashcards (#116).

Build order is **spine-first**: land the data model + static surfaces (where Zod gives correctness for free and the fail-loud invariant holds), then build behavior on a *proven* model. The schema is the lynchpin; the engine is a consumer of it. This mirrors the scaffold's static-first nature (only 2 islands exist: `ToolFilter`, the theme hook) and the broader fail-loud through-line (push correctness to the earliest static gate).

The static spine is **not hollow**: Bjork "desirable difficulties" pedagogy wants *delayed/hidden* answers, which `<details>` delivers with zero JS; Sybex's own answer-delay mechanism is a *static* back-appendix (#114). v1 is framed as a **"practice question bank"**; "Practice Exam" (scored, sampled) is the explicit Increment-2 headline.

## Resolved design forks (via `/exploring-options`, 2026-06-05 — all toward the fail-loud / lowest-coupling option)

1. **Question types** — required `type` enum `['mcq','free','cloze']`, modeled now. v1 renders `mcq` + `free`; `cloze` is schema-accepted but render-deferred (reserved branch ~3 lines). Retrofitting a discriminator after authors write banks is the expensive path; reserving cloze is cheap.
2. **Schema shape** — a **flat envelope `z.object`**, NOT a top-level `z.discriminatedUnion`: Astro's content layer augments the collection schema via `ZodObject` methods (`image()` injection, `id`/`slug` merge) and breaks on a top-level union/effects (all 13 existing schemas are flat objects). Per-type invariants live in `refineQuestion`, attached via `.superRefine` **at registration** (`schemas-entry.ts`) so the exported `questionSchema` stays a bare, `.extend()`-able object.
3. **MCQ options** — `correct: boolean` (default false) *on each option*; `superRefine` enforces exactly-one-correct + unique option ids. Correctness lives inside the array the refine iterates — no separate `answer` index to drift.
4. **Bloom taxonomy** — universal closed `z.enum(['remember','understand','apply','analyze','evaluate','create'])`, optional.
5. **Domain taxonomy** — per-book (Cisco ≠ CompTIA ≠ a math syllabus), so NOT a hardcoded enum. Consumer declares `defineBookConfig({ examDomains: [...] })`; `domain` is `z.string()`; membership is validated at the **route/build + `validate.mjs` layers** (the schema is built outside consumer context — same constraint that put `siblingBooks` validation in `lib/book-link.ts`), throwing on an unknown domain (`assertKnownDomain`).
6. **Scoring** — deferred to Increment 2. v1 renders statically (`<details>` reveal), no JS. The schema carries `difficulty` + `bloom_level` + per-option `id` now so the future sampler is purely additive.
7. **First surface** — a static `/practice-exam` reading the collection directly (like `chapters.astro`), grouped by domain.
8. **`id` + rationale** — `id` is an explicit required frontmatter field (stable cross-ref key for #114/#116; distinct from the file-derived `entry.id`); rationale lives in the MDX body behind a `<Rationale>` marker (rich prose; the #114 appendix hoist seam).
9. **#117 objective-map** — folded into Increment 1: auto-derived from `getCollection('questions')` (no separate data file), the cheapest proof the domain taxonomy pays off.

## The `questions` schema (shipped in `package/src/schemas.ts`)

Frontmatter: `id` (req), `type` (req: `mcq`|`free`|`cloze`), `chapter` (req: number | string), `domain` (req), `part?`, `bloom_level?`, `objective_id?`, `difficulty?` (1–4), `options?` (MCQ: `{id, correct?, text?}[]`), `answer?` (free-response model answer), `draft?`, `tags?`. Body = stem (MDX). `.strict()`. Invariants in `refineQuestion`: MCQ ≥2 options / exactly-one-correct / unique ids; free needs `answer` and no options.

## Increment roadmap (as shipped — grouping drifted from the original plan; content didn't)

- **Inc. 1 — static spine → v4.17.0 (2026-06-05).** `questions` collection + `examDomains` registry + `assertKnownDomain` + `lib/questions(-derive)` + static `/practice-exam` + `<ObjectiveMap>` (#117) + `<Rationale>` + `validate` #8 + tests + fixture route-snapshots.
- **Inc. 2 — statics + pure engine → v4.19.0 (2026-06-10).** `<Diagnostic>` (#110), `<PartReview>` (#111), glossary + `<Term>` + `/glossary` (#115 — pulled forward from the planned Inc. 4), and the PURE exam engine (`sampleExam`/`scoreExam`, #112-core) — engine before island, so the logic was node-tested before any browser entered the picture.
- **Inc. 3 — interactive layer → v4.21.0 (2026-06-10).** The ExamRunner island over server-rendered QuestionCards (#112-UI; stems can't serialize into island props — controller-over-DOM architecture), `<AssessmentTest>` (#113, `spreadBlueprint` cross-domain form + weak-domain chapter routing), and the `/answers` appendix (#114, `<Rationale appendix for=…>` with build-time throws). The planned `book:theme:change` canvas dependency proved unnecessary — CSS tokens recolor everything. Pre-merge multi-lens review hardened the island to the same fail-loud bar as the build half (named throws over silent no-ops, `CSS.escape`, prop validation, per-domain floor).
- **Inc. 4 — flashcards → v4.22.0 (2026-06-10).** `/flashcards` + the Flashcards island over the glossary (#116): shuffled recall-first deck, localStorage knew-it/still-learning buckets, review-unknown-only pass. Question/objective-derived cards deferred (noted on #116); `examDomains` blueprint-weights widening deferred until a consumer needs it.

## Reuse inventory

`schemas.ts` (Zod, `.strict()`, `z.infer`) · `schemas-entry.ts` (`defineBookSchemas` + `existsSync` conditional registration) · `lib/chapters.ts`/`chapter-sort.ts` (Astro wrapper + pure split) · Tier-2 `siblingBooks`→`lib/book-link.ts` (the `examDomains`→`lib/exam-domains.ts` template) · `ROUTE_REGISTRY`/`RouteToggles`/profiles + `convergence.astro` twin-gate · `validate.mjs` checks #6/#7.
