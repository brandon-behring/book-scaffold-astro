# LaTeX → MDX component mapping

A consumer-facing reference for converting LaTeX book sources into MDX that consumes `@brandon_m_behring/book-scaffold-astro` components.

The scaffold ships **38 components**. Without this map, a `.tex → .mdx` conversion ends up rediscovering them by grep — and frequently rebuilding duplicates. This doc is the canonical "if your LaTeX source has `\begin{<env>}`, here's the component" reference.

> Pair with [PACKAGE_DESIGN.md](./PACKAGE_DESIGN.md) §17 for the broader migration story and the `defineMdxComponents` helper for consumer-shipped extensions.

## Components shipped by the scaffold

| LaTeX construct | MDX component | Import path | Signature | Notes |
|---|---|---|---|---|
| `\begin{tcolorbox}[narrativebox]` | `SkillBox` | `…/components/SkillBox.astro` | `title: string` | Recipe / how-to box |
| `\begin{tcolorbox}[conceptbox]` | `ConceptBox` | `…/components/ConceptBox.astro` | `term: string` | Single-term definition |
| `\begin{tcolorbox}[insightbox]` | `InsightBox` | `…/components/InsightBox.astro` | `title?: string` | Non-obvious observation |
| `\begin{keyconcept}` | `KeyIdea` | `…/components/KeyIdea.astro` | — | Crystallized takeaway |
| `\begin{warnbox}` / `\warningmargin{}` | `WarnBox` | `…/components/WarnBox.astro` | `title?: string` | Caveats / failure modes |
| `\begin{notebox}` | `NoteBox` | `…/components/NoteBox.astro` | `title?: string` | Chapter overviews |
| `\begin{paperbox}` | `PaperBox` | `…/components/PaperBox.astro` | `title?: string` | Paper restatement |
| `\begin{counterbox}` | `CounterBox` | `…/components/CounterBox.astro` | `title?: string` | Counter-evidence |
| `\begin{examplebox}` | `ExampleBox` | `…/components/ExampleBox.astro` | `title?: string` | Extended walkthrough |
| `\begin{openquestion}` | `OpenQuestion` | `…/components/OpenQuestion.astro` | `title?: string` | Research questions |
| `\begin{trythis}` | `TryThis` | `…/components/TryThis.astro` | `title?: string` | Practice exercise |
| `\begin{tipbox}` | `TipBox` | `…/components/TipBox.astro` | `title?: string` | Pro tips / shortcuts |
| `\begin{dynconnect}` | `DynConnect` | `…/components/DynConnect.astro` | `title?: string` | Cross-domain connection |
| `\begin{theorem}` / `\begin{proposition}` / `\begin{lemma}` / `\begin{corollary}` / `\begin{definition}` / `\begin{remark}` / `\begin{proof}` | `Theorem` | `…/components/Theorem.astro` | `kind, n?, name?, id?` | amsthm family — single component dispatches via `kind` prop |
| `\marginnote{}` / `\marginnotebox{}` / `\marginwarning{}` / `\margintip{}` | `MarginNote` | `…/components/MarginNote.astro` | `variant?: 'note' \| 'warning' \| 'tip'; label?: string` | `\marginnotebox` → `variant="note"` (blue), `\marginwarning` → `variant="warning"` (rose), `\margintip` → `variant="tip"` (green). `label` overrides the variant's default badge text. Body has a 25-word soft cap. |
| `\sidenote{}` | `Sidenote` | `…/components/Sidenote.astro` | — | Auto-numbered marginalia (Tufte) |
| `\includegraphics + \caption` | `Figure` | `…/components/Figure.astro` | `src, caption?, id?` | XRef-registered |
| `\cite{}` / `\parencite{}` | `Citation` | `…/components/Citation.astro` | `src, as?` | Resolves `sources` collection |
| `\cite{}` (inline) | `Cite` | `…/components/Cite.astro` | `key` | Inline citation key |
| `\xref{}` / `\cref{}` | `XRef` | `…/components/XRef.astro` | `id` | Cross-reference resolver |
| `\code{path:N}` / inline file refs | `CodeRef` | `…/components/CodeRef.astro` | `path, line?, lineEnd?` | GitHub-linked source ref |
| (custom Shiki blocks) | `CodeBlock` | `…/components/CodeBlock.astro` | `lang, title?` | Wrapped fenced code |
| `\recovery{}` | `Recovery` | `…/components/Recovery.astro` | `pattern, symptom?` | Anti-pattern escape |
| `\casestudy{}` | `CaseStudy` | `…/components/CaseStudy.astro` | `date, title?` | Dated anecdote |
| `\weekref{}` (academic) | `WeekRef` | `…/components/WeekRef.astro` | `week` | Cross-chapter week ref |

Component subset table for tools-profile-specific UI (volatility dashboards, convergence timelines):

| Construct | Component | Use case |
|---|---|---|
| Volatility badge | `Tag` | `volatility` enum chip in chapter meta |
| Practice tag (`\official{}` / `\practitioner{}` / `\convergence{}`, also `\tagofficial{}` / `\tagpractitioner{}` / `\tagconvergence{}`) | `Tag` | `kind="official" \| "practitioner" \| "convergence"` — inline assertion of source authority. Both the bare and `\tag*` prefixed LaTeX forms map to the same component (see `package/components/Tag.astro`). |
| Tool comparison | `ToolFilter` (island) | Interactive comparison gate |
| Version selector | `VersionSelector` (island) | Manual opt-in; pass real `{ href, label, date, current? }` deployment entries |
| Convergence event | `Convergence` | "All tools converged here" timeline marker |
| Divergence event | `Divergence` | "Tool X went its own way" annotation |
| Pattern timeline | `PatternTimeline` | Multi-event convergence dashboard |
| Status badge | `StatusBadge` | 7→3-state translation (academic) |
| Source archive | `SourceArchive` | Tier-tagged source listing |

## What is NOT shipped (extension candidates)

The scaffold deliberately doesn't ship these. Add to your consumer via the [`defineMdxComponents`](#consumer-side-extensions-definemdxcomponents) helper described below; surface as a tracked issue if the gap recurs across pilots.

- `\begin{problem}` / `\begin{solution}` — interview-prep problem cards
- `\begin{vignette}` — multi-step scenario walkthroughs
- `\begin{decisiontree}` — branching decision logic
- `\begin{interviewcontext}` — interview-tied learning-outcome callouts
- `<AnkiCard>` — flashcard widget
- `<Term>` — glossary term reference with tooltip
- `<RedFlag>` — escalated warning beyond `WarnBox`
- `<NarrativeBox>` (with extended props) — if a consumer needs richer narrative annotations beyond `SkillBox`

## Consumer-side extensions: `defineMdxComponents`

When your book uses custom MDX components, create `src/mdx-components.ts` (or `.js` / `.mjs`) at your project root. The scaffold auto-detects it and threads the components through all auto-injected routes (`/print`, future `/pdf`, `/epub`).

```ts
// consumer's src/mdx-components.ts
import { defineMdxComponents } from '@brandon_m_behring/book-scaffold-astro';
import AnkiCard from './components/AnkiCard.astro';
import NarrativeBox from './components/NarrativeBox.astro';
import Term from './components/Term.astro';

export default defineMdxComponents({
  AnkiCard,
  NarrativeBox,
  Term,
});
```

The `defineMdxComponents<T>()` helper is a TypeScript identity function — it returns the value unchanged, but preserves the exact key→component type mapping for IntelliSense. Same pattern as Vite/Astro `defineConfig`, Zod `z.object`, Drizzle `pgTable`.

To use a non-default path, pass it explicitly:

```ts
// astro.config.mjs
export default defineBookConfig({
  site: '...',
  mdxComponentsModule: './src/my-custom-components.ts',
});
```

## Disabling auto-injected routes

The scaffold auto-injects per-profile defaults (see [PACKAGE_DESIGN.md](./PACKAGE_DESIGN.md) §6). Multi-book consumers (one Astro app, many books under `[book]/[chapter]`) typically want the flat `/chapters` route off:

```ts
// astro.config.mjs
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';

export default defineBookConfig({
  site: '...',
  profile: 'course-notes',
  routes: {
    chapters: false,        // override the profile default
    convergence: false,
  },
});
```

The shape is fixed (`references | search | print | chapters | convergence`) and TypeScript catches typos like `convergance: false`.

## Common conversion mistakes

Errors observed during the DLAI pilot (closed in v3.3.0 issue #5):

1. **Built `NarrativeBox` from scratch** → should have used `SkillBox`. Same vertical box semantic; `SkillBox` already has the `title` prop.
2. **Built `ConceptBox` (block container)** → conflicts with scaffold's `ConceptBox` (term-definition signature). Either rename the consumer one (`ConceptBlock`) or use scaffold's signature.
3. **Built `KeyConcept`** → should have used `KeyIdea`. Same crystallized-takeaway role; the scaffold's name comes from the Tufte-style margin-emphasis convention.
4. **Built `RedFlag`** → should have used `WarnBox`. Add a higher-severity variant via consumer-side `defineMdxComponents` if needed instead of duplicating WarnBox's semantic.
5. **Built `Sidenote` with category prop** → conflicts with scaffold's auto-numbered `Sidenote`. The scaffold uses CSS counters; consumer-side category metadata can wrap (e.g., `<TypedSidenote category="recovery"><Sidenote>...</Sidenote></TypedSidenote>`).
6. **Built duplicate `Citation` and `Figure`** → scaffold's versions are XRef-registered. Use them; extend behavior via wrapper components if richer attribution is needed.

## See also

- [PACKAGE_DESIGN.md](./PACKAGE_DESIGN.md) — full API contract + Phase A planning decisions
- [README.md](./README.md) — toolkit overview + getting started
- [CHANGELOG.md](../CHANGELOG.md) — release notes (issue #5 closed in v3.3.0)
