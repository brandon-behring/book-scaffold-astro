# Recipe 04 — Component library

**Profile**: components are profile-flavored. Tools family always available; academic family available when `BOOK_PROFILE=academic`. Utility components (Cite, XRef, Figure, …) work in any profile.

**TL;DR**: Two callout families coexist (per Q3). Authors `import` what they need. The scaffold doesn't force migration of existing tools-profile books to academic, or vice versa.

## Callout families

### Tools family (8 components, default in `BOOK_PROFILE=tools`)

`src/components/callouts/`:

| Component | Use for | Visual |
|---|---|---|
| `SkillBox` | A skill the reader practices | green left-bar (tip) |
| `CaseStudy` | Concrete worked example with date stamp | blue left-bar (info) |
| `ConceptBox` | Term + crisp definition | plum left-bar (authority) |
| `KeyIdea` | Bold short principle | gold left-bar (insight) |
| `TryThis` | Reader exercise / activity | green left-bar (tip) |
| `Recovery` | Anti-pattern + fix | rose left-bar (warning) |
| `Convergence` | Multiple tools agree (with `tools` array) | gold left-bar |
| `Divergence` | Tools disagree (with `axis` label) | gold dashed left-bar |

### Academic family (10 components, default in `BOOK_PROFILE=academic`)

`src/components/callouts/`:

| Component | Use for |
|---|---|
| `NoteBox` | Aside / clarification |
| `ExampleBox` | Worked example |
| `DynConnect` | Cross-chapter conceptual link |
| `InsightBox` | High-level "why this matters" |
| `WarnBox` | Reader pitfall |
| `CounterBox` | Counter-example / wrong-but-instructive |
| `TipBox` | Practical advice |
| `OpenQuestion` | Research gap |
| `PaperBox` | Reference to a specific paper |
| `ResultBox` | Theorem / proposition / lemma headline |

For full theorem-like environments (proof scaffolding, numbering), use `<Theorem>` (below).

## Theorem family (academic profile)

`src/components/Theorem.astro` — unified component for nine LaTeX-style environments via the `type` prop:

```mdx
<Theorem type="theorem" id="thm:zoh-stability" label="ZOH stability">
The bilinear discretization preserves stability iff $|\lambda \Delta t| < 1$.
</Theorem>

<Theorem type="proof">
Direct algebra on the bilinear map.
</Theorem>
```

Supported `type` values: `theorem`, `proposition`, `lemma`, `corollary`, `definition`, `example`, `exercise`, `remark`, `proof`. Each gets its own bar color and numbering counter.

## Utility components (any profile)

`src/components/`:

| Component | Purpose | Example |
|---|---|---|
| `Cite` | Inline citation linked to `/references` | `<Cite key="gu2024mamba" page="3" />` |
| `XRef` | Cross-reference to a labeled element | `<XRef id="thm:zoh-stability" />` |
| `Figure` | Image/SVG + caption + id; local SVGs inline for a11y + dark mode (`alt`, `desc`) | `<Figure src="/figures/week04/eigenvalues.svg" caption="…" alt="…" id="fig-eig" />` |
| `MarginFigure` | A `Figure` that **floats into the right gutter** (Tufte margin figure; ≥64rem, inline on mobile). Same props as `Figure`; rendering delegated to it. For full-bleed use `<Figure class="wide">` | `<MarginFigure src="/figures/week04/eig.svg" caption="…" alt="…" id="fig-eig-m" />` |
| `MarginNote` | **Inline** colored callout in the text column (does **not** float to the margin, despite the name) — load-bearing aside the reader must see | `<MarginNote>side comment</MarginNote>` |
| `Sidenote` | Auto-numbered Tufte marginalia that **floats into the right gutter** on desktop (inline on mobile) | `<Sidenote>numbered note</Sidenote>` |
| `EvidenceTag` | Inline claim-confidence pill after a claim (`verified`/`inference`/`audit-corrected`) | `<EvidenceTag kind="verified" /> … <EvidenceTag kind="inference" />` |
| `Newthought` | Tufte run-in small-caps section opener | `<p><Newthought>In practice</Newthought>, …</p>` |
| `Epigraph` | Chapter-opening italic quotation with right-aligned attribution | `<Epigraph>…<Fragment slot="attribution">Hamming</Fragment></Epigraph>` |
| `WeekRef` | Jump-link to a week chapter | `<WeekRef week={4} />` |
| `CodeRef` | GitHub-deep-link to file:line | `<CodeRef path="experiments/jax/foo.py" line={42} />` |
| `CodeBlock` | Embed code-file range with syntax highlight | `<CodeBlock src="…" lines="10-30" />` |
| `Tag` | Inline volatility/topic tag | `<Tag>stable-principle</Tag>` |
| `StatusBadge` | Render frontmatter `status` value with color | `<StatusBadge status={frontmatter.status} />` |
| `ChapterHeader` | Auto-rendered metadata block (week, part, status, companion links) | placed at top of each chapter automatically by Chapter.astro |
| `Provenance` | Auto-rendered per-chapter audit trail (v4.8.0) | placed at the end of each chapter by the chapter route — not imported |

## Per-chapter provenance (v4.8.0, auto-injected)

`Provenance` renders a collapsible "How this was made" block on **every** chapter — you don't import or place it. It reads the optional `provenance` frontmatter and is **opt-out**: a chapter with no `provenance` shows a fallback ("Audit history not yet recorded"). It surfaces *process* (the audit trail); `ChapterHeader` still owns *freshness*. Distinct from `AICollaborationDisclosure` (book-level, manual model+role disclosure).

```yaml
provenance:
  ai_tools: ['Claude Code (Opus 4.8)', 'research-kb']
  prompts_archive: docs/sessions/2026-05-22--ch07.md   # repo-relative path or URL
  decisions_log: DECISIONS.md#ch07-derivation           # repo-relative path or URL
  audit_history:
    - { date: 2026-05-15, type: routine, file: audits/AUDIT_2026-05-15.md }
    - { date: 2026-05-22, type: independent, file: audits/AUDIT_2026-05-22.md }
  citation_backstop: research-kb                         # research-kb | manual | unverified
```

Repo-relative paths render as `<code>`; only `http(s)` values become links (no dead links). If present, the `provenance` object must be non-empty (omit the key to opt out — unknown keys are rejected). `citation_backstop` is a closed set; `audit_history[].type` is free text.

## Conditional imports

Authors are responsible for importing what they use. The scaffold doesn't auto-import; this keeps build output clean and makes intent explicit:

```mdx
---
title: "Week 4 — Discretization"
week: 4
part: ssm-core
status: implemented
---
import NoteBox from '../../components/callouts/NoteBox.astro';
import Theorem from '../../components/Theorem.astro';
import Cite from '../../components/Cite.astro';

<NoteBox>This is the heart of S4.</NoteBox>

<Theorem type="theorem">…</Theorem>

The HiPPO theory <Cite key="gu2020hippo" /> shows that …
```

## Study-guide components (v4.17.0+, #112)

Opt-in exam-prep surfaces backed by the `questions` content collection (`src/content/questions/**.{md,mdx}`). Declare your domains in `defineBookConfig({ examDomains: [...] })`; enable the bank with `routes: { practiceExam: true }`.

```mdx
---
id: q-tls-handshake          # unique cross-ref key (required)
type: mcq                    # mcq | free | cloze
chapter: 4
domain: crypto               # must be in examDomains, else build throws
bloom_level: understand      # optional
difficulty: "2"              # optional, 1–4
options:
  - { id: a, text: "Confidentiality + integrity", correct: true }
  - { id: b, text: "Availability only" }
---
import Rationale from '@brandon_m_behring/book-scaffold-astro/components/Rationale.astro';

What security properties does a TLS session provide?

<Rationale>
TLS provides confidentiality and integrity via the negotiated cipher suite… <Cite key="rfc8446" />
</Rationale>
```

- **`<Rationale title? appendix? for?>`** — collapsible answer/explanation for a question's MDX body (rich prose: math, `<Cite>`, code). Hidden behind a `<details>` so the answer stays delayed (Bjork desirable-difficulties). **Appendix mode** (v4.21.0, #114): `<Rationale appendix for="q-tls-handshake">` keeps the body clean Sybex-style — it renders as a link to `/answers#answer-<id>` everywhere except on `/answers` itself, where the full rationale renders. Fail-loud: `appendix` without `for=`, or with `routes.answers` disabled, throws at build.
- **`<ObjectiveMap title?>`** — exam-domain → chapter coverage matrix, auto-derived from `getCollection('questions')` (no data file to maintain). Drop into a front-matter / intro page. A domain with no questions renders an honest gap.
- **`<Diagnostic title? skimTo? routing?>`** (v4.19.0, #110) — a per-chapter pre-reading "Do I Know This Already?" (DIKTA) self-check: a slotted retrieval-question list + a skip/skim/read routing rubric (`skimTo` names the section to skim to when confident; `routing` overrides the whole sentence) + an *optional* collapsible answer key via `<Fragment slot="answers">…</Fragment>` (presence-gated). Pedagogy-family callout (teal), visually distinct from the post-chapter `<Exercise>`/`<Practice>`; the answer reveal is a native `<details>` (no JS — pre-testing wants the retrieval attempt before the answer).
- **`<PartReview part={N} title?>`** (v4.19.0, #111) — aggregates a Part's `<Exercise>` items into one interleaved-review block (Cisco/Pearson "Part Review"). Reuses the `build-exercises` index (`src/data/exercises.json`) + the chapters collection's `part` field — no new build step; run `npx book-scaffold build-exercises` first. `part` is a number (tools/minimal/…) or a string (academic enum). Presence-gated: renders a build hint when the index is absent. (`<Practice>` aggregation + a book-level `/review` route are later increments.)
- **`<Term id="…">…</Term>` + the `/glossary` route** (v4.19.0, #115) — a searchable key-terms glossary. Author terms under `src/content/glossary/**.{md,mdx}` (frontmatter `term` / `aliases?` / `domain?` / `see?` / `tags?`; MDX body = the definition); enable via `defineBookConfig({ routes: { glossary: true } })`. `<Term id="agentic-loop">agent loop</Term>` links inline to `/glossary#term-agentic-loop`. The collection auto-registers when `src/content/glossary/` exists; the route is presence-gated (twin-gate).

- **`<AssessmentTest title? count? passMark?>`** (v4.21.0, #113) — the Sybex-style whole-book front-matter assessment: a cross-domain sampled form (every domain gets a quota, `spreadBlueprint`) scored client-side, with a weak-domain readout routing the reader to the chapters carrying those domains' questions (string chapters link to `/chapters/<slug>/`; numeric chapters render as labels). Drop into a front-matter / intro page like `<ObjectiveMap>`. Presence-gated; only scoreable MCQs render.

- **`/flashcards` route** (v4.22.0, #116; `routes: { flashcards: true }`) — Sybex-style electronic flashcards generated from the glossary collection (front = term, back = the rendered MDX definition). The island shuffles a deck, shows one card at a time (recall first — the back hides until Flip), sorts cards into knew-it/still-learning buckets persisted to localStorage (`book:flashcards:known`), and offers a "review unknown only" pass. Appendix-style surface, deliberately not inline (Bjork: recall practice, not re-reading). No JS → the full front+back list stays readable. Question/objective-derived cards are a later increment.

The `/practice-exam` route renders the bank grouped by domain with each answer behind a "Show answer" reveal — and (v4.21.0, #112-UI) mounts the **ExamRunner island** (`client:idle`): Start samples a form client-side (pure `sampleExam`), hides the rest of the bank, hides answer reveals while the exam is active, scores checked radio options on submit (`scoreExam`), and renders a per-domain readout with weak-domain anchors. No JS → the static bank with radios + reveals is the fallback. The `/answers` route (v4.21.0, #114; `routes: { answers: true }`) is the back-appendix: every question grouped by chapter with options, the correct answer, and rationales pre-expanded. `cloze` questions are reserved (schema-accepted, render-deferred). (`<Diagnostic>` #110, `<PartReview>` #111, and `/glossary` #115 shipped in v4.19.0; the interactive layer #112-UI/#113/#114 in v4.21.0; flashcards #116 in v4.22.0 — completing epic #122. History: `docs/plans/implemented/study-guide-epic_*.md`.)

## Mixing families

You can use tools-family callouts in an academic book or vice versa — nothing stops you. The "default family" per profile is only about what `examples/chapter-template-*.mdx` import for you. Drop in a `<SkillBox>` in an academic chapter when it fits.

## Common gotchas

- **Path depth**: chapters in `src/content/chapters/foo.mdx` import via `../../components/...`. If you nest chapters in a subfolder (`src/content/chapters/week04/intro.mdx`), use `../../../components/...`.
- **Cite throws on unknown bibkey**: this is intentional (recipe 02). Run `npm run build:bib` after editing `bibliography.bib`.
- **XRef silently renders `[?label]` for unknown ids**: the validator (recipe 09) catches these — don't rely on visual inspection.
- **Theorem id collisions across chapters**: include a chapter prefix (e.g. `id="w4:thm:zoh"` not `id="thm:zoh"`).

## Canonical files

- `src/components/callouts/` — both families, 18 components total
- `src/components/Theorem.astro` — unified theorem-like environment
- `src/components/{Cite,XRef,Figure,…}.astro` — utility components (10 total)

## Reference implementation

[`~/Claude/post_transformers/guides/web/src/content/chapters/`](../../post_transformers/guides/web/src/content/chapters/) — 6 chapters exercising the academic family. [`~/Claude/book-template-astro/src/content/chapters/`](../../book-template-astro/src/content/chapters/) — 23 chapters exercising the tools family.
