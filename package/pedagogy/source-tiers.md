# Source tiers

Every source cited in a book-scaffold-astro book carries a `tier` field
in `sources/manifest.yaml`. The tier calibrates reader trust at the
point of use — a citation renders with a tier badge, and the source
archive page groups entries by tier descending.

Four tiers in descending authority. This methodology migrated from the
predecessor LaTeX book `claude-best-practices`'s `docs/source-hierarchy.md`
(2025-2026), where it evolved across v2.0 → v2.9.

## The four tiers

### T1-official

Vendor-official documentation or release notes. Highest trust for
factual claims about the vendor's own tool.

Examples:
- `anthropic.com/docs/...` for claims about Claude Code behavior.
- `cloud.google.com/gemini-code-assist/...` for Gemini CLI.
- `platform.openai.com/docs/codex/...` for Codex CLI.

Use when the claim is about the vendor's tool's specification — what
a flag does, what a command name is, what an event payload looks like.

### T2-release-notes

Release blog posts, changelogs, conference talks from the vendor.
Trustworthy for intent and availability claims. Slightly less formal
than T1 docs because release notes describe what the vendor
*announced*, not necessarily what the shipped artifact behaves like.

Examples:
- `anthropic.com/news/...` for a feature announcement.
- A YouTube talk from a Google Next session about Gemini CLI.
- An OpenAI DevDay blog post about Codex CLI release.

Use when the claim is about vendor intent, a ship date, or a feature
preview that may not yet have docs.

### T3-practitioner

Respected community writing with a durable argument the author has
defended over time. The author is not the vendor; the writing's
authority comes from the argument's staying power.

Examples:
- Gwern Branwen on sidenote UX (`gwern.net/sidenote`) — decade-defended
  argument.
- Edward Tufte's design books — foundational, long-defended typography
  principles.
- Specific practitioner posts where the author has repeatedly revisited
  and defended the argument.

Use when citing a pattern, principle, or methodology that the vendor
hasn't formally documented but that a serious community author has
argued over time.

### T4-conjecture

Blog posts, tweets, unverified claims. Use as pointers to investigate
rather than as authority.

Examples:
- A tweet claiming a tool does X (without a linked authoritative source).
- A blog post describing a workaround that worked once.
- A Reddit thread with consensus but no authoritative confirmation.

Use sparingly. If a T4 source is load-bearing for a claim, either
elevate the claim (find a T1-T3 source) or drop the claim.

## Tier is not a judgment of the author

A brilliant tweet is T4 until someone does the work to elevate it;
a bland vendor page is T1 because the vendor is the definitive source
for their own tool's behavior.

This is important. The tier reflects the relationship between the
source and the claim it supports. A practitioner's blog post *about
Claude Code's behavior* is T3 (or T4); the same practitioner's blog
post *about their own methodology for using Claude Code* could be T3
if the methodology is original and defended.

## Re-verification cadence per tier

Each tier implies an audit cadence. The scaffold's quarterly audit
workflow (post-v1.0) operationalizes this:

| Tier | Re-verify cadence | Rationale |
|------|-------------------|-----------|
| T1-official | On major vendor release | Triggered by release, not calendar |
| T2-release-notes | Quarterly | Release notes drift as ship dates slip |
| T3-practitioner | Annually | Authors rarely retract; arguments evolve slowly |
| T4-conjecture | Before citing | If the claim still matters, verify it; otherwise drop |

## How the scaffold uses this

- `sources/manifest.yaml` is the source-of-truth. Each entry has a
  `tier` field validated against the `sourceTiers` enum.
- `<Citation src="slug" />` renders a tier badge at the point of
  citation. Readers calibrate their trust mid-sentence.
- Appendix D (source archive) groups entries by tier descending
  (T1 → T4). Empty tiers render honest "no entries yet" placeholders.
- The scaffold does not automate re-verification. That's intentional:
  the human audit is load-bearing; automating it would create a false
  sense of security.

## Authoring tips

- **Over-cite rather than under-cite.** If a claim rests on external
  evidence, cite it even if you think the evidence is obvious.
- **Favor T1-T2 for claims about specific tools.** If a T3 practitioner
  post is the best you have for a tool-behavior claim, note the gap;
  the T1 source will likely appear later.
- **A T4 citation is a research todo.** If you're citing a tweet, ask
  yourself whether the claim belongs in a future-draft note rather than
  a published chapter.
- **The archive's integrity is the book's integrity.** A source whose
  content shifted beneath a citation silently demotes the chapter that
  cited it to an unknown state.
