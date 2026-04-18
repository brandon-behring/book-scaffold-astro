# Volatility classes

Every chapter declares a `volatility` class in its frontmatter. The
class encodes how fast the chapter's claims are expected to date. The
freshness badge on the chapter header reads this class and computes
"fresh" / "verify soon" / "stale" against three thresholds.

## The three classes

### `stable-principle` — 365-day threshold

Claims that trace back to a durable principle or an argument the author
has defended over many years. These age slowly; re-verify annually.

Examples:
- Chapters on the *shape* of agentic interaction (the session loop,
  context as a finite resource, briefing documents as a stable pattern).
- Chapters on pedagogy and reading methodology (how to calibrate trust
  against source tier, how to audit your own practice).
- Chapters whose claims would still be defensible after a major tool
  release because they're not about any specific tool's surface.

Freshness bands: fresh < 274d, verify-soon 274-365d, stale > 365d.

### `architectural-pattern` — 180-day threshold

Claims about cross-tool design patterns that change on major version
releases but not minor ones. Re-verify every 6 months.

Examples:
- Chapter on subagent delegation (the *pattern* is stable; specific
  interface names and tool signatures can shift on major releases).
- Chapter on hooks / MCP / plugins (the pattern of "tool extends its
  own behavior via a lifecycle event" is architectural; the specific
  event names and payload shapes are feature-surface).
- Chapter on automation modes (the *categorization* into interactive /
  headless / scheduled is architectural).

Freshness bands: fresh < 135d, verify-soon 135-180d, stale > 180d.

### `feature-surface` — 90-day threshold

Claims about specific tool features, flags, file paths, command names,
or configuration schemas. These age fastest; re-verify quarterly.

Examples:
- Tool-specific companion appendices (Claude Code's specific flags,
  Gemini CLI's specific file layout, Codex CLI's specific commands).
- Chapters on pricing, hook event lists, specific env var names.
- Any chapter where the example code contains current-release-specific
  API calls.

Freshness bands: fresh < 68d, verify-soon 68-90d, stale > 90d.

## Choosing the class

The dominant rule: **classify by the claim type, not by the topic.**

A chapter titled "Subagents" sounds like it should be feature-surface
(subagent interfaces change), but if the chapter argues the *pattern*
and uses specific tool syntax only as illustration, it's an
architectural-pattern chapter. The same chapter could be
feature-surface if it's a concrete reference document for a specific
tool's subagent flags.

A test: *if this tool ships a major version tomorrow, what changes?*
- Nothing conceptual → stable-principle.
- Interfaces but not the pattern → architectural-pattern.
- Named flags / paths / commands change → feature-surface.

## Why three (not two, not five)

Three classes encode distinct re-verification cadences:
- Annual (stable-principle) — corresponds to the book's major-edition
  cycle.
- Semi-annual (architectural-pattern) — corresponds to tool major
  version release cadence.
- Quarterly (feature-surface) — corresponds to tool minor release
  cadence.

Two classes would collapse annual + semi-annual, hiding cases where a
chapter is almost-principle-but-not-quite. Four classes would
over-resolve and create arguments about edge cases. Three is the
minimum that captures the essential granularity without encouraging
bikeshedding.

## How the scaffold uses this

- `src/lib/freshness.ts` maps volatility to threshold. Three status
  bands derived from % of threshold: fresh (<75%), verify-soon (75-100%),
  stale (>100%).
- `src/components/ChapterHeader.astro` renders a colored badge next to
  the chapter's last-verified date (green / gold / rose).
- `src/pages/chapters.astro` renders the same badge on every card in
  the chapter index, so readers can assess drift across the whole book
  at a glance.

## Authoring tips

- **Default to feature-surface on first publication.** You'll almost
  always be wrong about how durable a specific claim is. Letting the
  freshness badge age the claim down to stale is honest; pretending
  it was stable-principle when it wasn't is a drift trap.
- **Promote to architectural-pattern when the claim survives a major
  release unchanged.** The promotion is evidence, not guess.
- **Promote to stable-principle only after multiple tools have
  adopted.** Principle-shaped claims should be defended by convergence
  evidence, not by aspiration.
- **Freshness is not a quality signal.** A stale feature-surface chapter
  isn't wrong; it's old. Re-verify before demoting the chapter.
