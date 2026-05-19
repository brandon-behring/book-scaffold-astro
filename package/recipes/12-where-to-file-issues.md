# Recipe 12 — Where to file issues (consumer-driven evolution)

This toolkit grows through cross-consumer dogfooding. Each new book project you stand up — academic curriculum, AI-CLI comparison, course notes, research portfolio, or something new — is both content work *and* a structured test of the scaffold's abstraction.

## When to file an issue

File against [`brandon-behring/book-scaffold-astro/issues`](https://github.com/brandon-behring/book-scaffold-astro/issues) when:

- The scaffold's current schemas don't fit your book's content shape (e.g. course notes needing freeform `tags` instead of the `tools_compared` enum).
- An auto-injected route conflicts with your book's URL structure (e.g. multi-book corpus that routes via `[book]/[slug]/`).
- A scaffold-injected route can't render your custom MDX components (e.g. you have `<AnkiCard>` that needs to appear on `/print`).
- A CLI subcommand crashes or behaves unexpectedly (e.g. `validate` reports zero chapters).
- A scaffold component you rebuilt has an exact equivalent already shipped (waste signal — file as `docs: missing in LATEX_TO_MDX_MAPPING.md`).
- An API decision blocks one of your downstream projects.

## Issue shape

Mirror the pattern used by issues [#1–#14](https://github.com/brandon-behring/book-scaffold-astro/issues?q=is%3Aissue+sort%3Acreated-desc):

```markdown
## Problem
<observed behavior + repro steps + which consumer surfaced it>

## Evidence
<command output, file paths, version pin (`npm view @brandon_m_behring/book-scaffold-astro version`)>

## Suggested fix
<one or more concrete options; trade-offs noted>

## Acceptance criteria
<bulleted checklist a reviewer can verify>
```

Label with `bug` / `enhancement` / `documentation`. Reference the consumer repo + line where the friction was hit.

## Why this matters (the loop)

Each batch of cross-consumer issues drives a minor toolkit release:

- **v3.0–v3.2** absorbed Phase B/C/D feedback from `post_transformers` + `book-template-astro`.
- **v3.3.0** closed 5 issues surfaced from the DLAI knowledge-graphs-rag pilot (course-notes profile + defineMdxComponents + per-route override + LaTeX migration doc).
- **v3.4.0** closed 8 more (preset vocabulary + propagation + frontmatter helper + validate root fix + CI hygiene + docs).
- **v3.5.0** (future) is expected to add the `research-portfolio` preset per issue #6 once cross-repo coordination with `prompt-injection-portfolio` is ready.

Profile-by-profile growth is the explicit strategy: the toolkit gets a new profile when a real consumer needs one, not before.

## What NOT to file

- Bug reports from external users of a single book — file those against the book's repo, not the scaffold's.
- Style preferences that already have an escape hatch (e.g. `extraStyles` array, consumer-side `<style>` blocks).
- Speculative features ("we might one day want X"). Wait for the second consumer to actually need it.

## Where to find prior decisions

- [`CHANGELOG.md`](../../CHANGELOG.md) — release-by-release breakdown.
- [`PACKAGE_DESIGN.md`](../PACKAGE_DESIGN.md) §1 Q1–Q6 — original Phase A locked decisions.
- [`LATEX_TO_MDX_MAPPING.md`](../LATEX_TO_MDX_MAPPING.md) — 38-component reference.
- [Closed issues](https://github.com/brandon-behring/book-scaffold-astro/issues?q=is%3Aissue+is%3Aclosed) — many problems already have rejected-alternative discussion attached.
