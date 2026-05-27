# Recipe 07 — Chapter shapes (skeleton patterns)

**Profile**: profile-aware; pick the chapter shape that matches your book's pedagogy.

**TL;DR**: Two opinionated chapter skeletons ship in `examples/`. Copy whichever matches your profile to `src/content/chapters/` and edit. Both are 1-file MDX templates with frontmatter pre-filled.

## The two shapes

### Academic (week-based)

`examples/chapter-template-academic.mdx`:

```
1. Overview (½ page)        — what this week covers + why
2. Theory                   — core math/definitions/theorems
3. Examples (worked)        — concrete instances
4. Reflections              — what the reader should walk away with
5. Forward-map              — how this chapter connects to next week
```

Designed for textbook-style sequencing. Frontmatter required: `week`, `part` (enum), `status` (7-state).

When to use: lecture-note format, curricular sequencing (W01 → W02 → … → W21), every chapter teaches a single body of math.

### Tools (Koller-Friedman)

`examples/chapter-template-tools.mdx`:

```
1. Representation           — what the artifact / concept LOOKS LIKE
2. Operation                — what you DO with it
3. Evolution                — what's converging / diverging across the field
```

Designed for comparative-practitioner books where multiple tools (Claude Code, Gemini CLI, Codex CLI, …) share an underlying capability that you're tracking over time.

When to use: cross-tool reviews, "what does X look like in each tool", evolving-technology books with versioned content.

Source: Koller & Friedman, *Probabilistic Graphical Models*, 2009 — chapter structure that separates static representation from operations on it from evolutionary dynamics. Adapted from PGM models to apply to tools.

## Picking a shape

| If your book is … | Use shape | Profile |
|---|---|---|
| A textbook with sequential dependency | Academic | `academic` |
| Lecture notes (one topic per chapter) | Academic | `academic` |
| Research synthesis (one paper or theorem per chapter) | Academic | `academic` |
| A practitioner field-guide across multiple tools | Tools | `tools` |
| A versioned tech survey with convergence tracking | Tools | `tools` |
| A research-portfolio with mixed evidence types + AI disclosure | Hybrid | `research-portfolio` (see [Recipe 13](13-research-portfolio-getting-started.md)) |
| A course-notes / study-derived corpus | Hybrid | `course-notes` |
| A solo essay collection | either, lean Academic | `minimal` (uses tools schema) |

## Hybrid books

You're allowed to mix. The frontmatter Zod schema is what's enforced; the chapter shape is only a template. Build a chapter however you want as long as:

1. Frontmatter passes its schema (`academicChapterSchema` or `toolsChapterSchema`).
2. The rendered output fits the layout (don't break out of `.prose` without `.wide`).

post_transformers uses academic for all 6 published chapters. book-template-astro uses tools for all 23. Mixing has not been tested in production — proceed with sense.

## Customizing a shape

Both templates are starting points. Common customizations:

- **Add more sections**: append after Forward-map (academic) or after Evolution (tools). Use `<h2>` for top-level sections.
- **Skip a section**: just delete it. Nothing in the scaffold requires Theory or Operation to exist.
- **Add a sidebar of running examples**: use `<MarginNote>` for short notes, or `<aside class="wide">` for full-width sidebars.

## Common gotchas

- **Forgetting the import block**: each template imports the components it uses (NoteBox, Theorem, Cite for academic; SkillBox, KeyIdea, Convergence for tools). If you delete a section, also delete the unused import — astro warns but doesn't fail.
- **Frontmatter `week` vs `chapter`**: academic uses `week`; tools uses `chapter`. The wrong key under the wrong profile is a Zod error caught at content-sync time.
- **`status` field is required under academic**: pick one of `implemented` / `chapter_only` / `prose_only` / `code_only` / `reading_only` / `scaffolded` / `planned`. See `~/Claude/post_transformers/docs/STATUS.md` for the canonical state-machine.

## Canonical files

- `examples/chapter-template-academic.mdx` — week-based skeleton
- `examples/chapter-template-tools.mdx` — Koller-Friedman skeleton
- `pedagogy/kf-chapter-shape.md` — full KF pedagogy methodology

## Reference implementation

- Academic: [`~/Claude/post_transformers/guides/web/src/content/chapters/week04.mdx`](../../post_transformers/guides/web/src/content/chapters/week04.mdx) — exemplar
- Tools: [`~/Claude/book-template-astro/src/content/chapters/05-context-as-currency.mdx`](../../book-template-astro/src/content/chapters/05-context-as-currency.mdx) — exemplar
