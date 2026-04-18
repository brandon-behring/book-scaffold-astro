# Koller-Friedman chapter shape

Every chapter in a book-scaffold-astro project uses a uniform three-part
skeleton: **Representation**, **Operation**, **Evolution**. The idea
comes from Daphne Koller and Nir Friedman's *Probabilistic Graphical
Models: Principles and Techniques* (MIT Press, 2009), where every
chapter on a graphical model type follows this sequence.

## The three parts

### Representation

What is the thing, conceptually? Define the object the chapter is
about. Give its structural properties, its type signature, the
invariants that make it itself. Answer: **what are we looking at?**

A chapter on agents might define: what an agent is as a computational
object; what makes an agent distinct from a script; what invariants
(context, tools, permissions) every agent carries.

### Operation

How does the thing behave? Show the dynamics — how it's used, how it
fails, how it composes. Include the verification / testing perspective.
Answer: **what does it do, and how do we know it's doing the right
thing?**

For the same agent chapter, Operation would cover: the session loop,
how agents consume context, how multi-step tasks decompose, common
failure modes, and how to detect them.

### Evolution

How does the thing change over time? Show comparative and historical
evidence. This is where the book's "convergence / divergence" callouts
live — which tools adopted this pattern, when, and where they still
differ. Answer: **is this idea stable, or is it still being argued?**

For the agent chapter, Evolution would cover: when each tool shipped
agent primitives, which design decisions converged, what's still open.

## Why this shape

Three reasons:

1. **Drift-resistance.** When every chapter looks the same structurally,
   the skeleton is legible at a glance. Drift into feature documentation
   becomes visible because it won't fit the shape. A chapter that
   accidentally turns into a feature catalogue has no Evolution section
   — the gap is the alarm.

2. **Reader fluency.** A reader learns the skeleton once and reads every
   subsequent chapter fluently. They know where to find the invariants
   (Representation), where to find the failure modes (Operation), and
   where to find the historical context (Evolution). No hunting.

3. **Comparative pedagogy.** The Evolution section makes cross-tool
   comparison first-class. When tools converge on a pattern, the
   Convergence callout renders in gold. When tools diverge on a
   design choice, the Divergence callout renders with a dashed
   accent. Neither is hidden; both are expected.

## How the scaffold enforces this

The scaffold doesn't validate chapter structure at build time (too
brittle), but it ships visual affordances that make the structure
visible:

- `/chapters/` index renders volatility + freshness + tools badges on
  every card — the reader sees the Evolution metadata before they even
  open the chapter.
- `Convergence` and `Divergence` callouts signal stability state
  within a chapter. Both live in the Evolution section by convention.
- `last_verified` + `volatility` frontmatter fields power the freshness
  badge. Since freshness is tied to volatility class, Evolution pressure
  on a chapter directly surfaces as a stale badge.

## Authoring tips

- **Start every chapter with Representation.** Even if you know the
  reader has seen the concept before, restate it in the chapter's own
  terms. Assume no prior chapter.
- **Operation goes second, not last.** Tempting to put examples last;
  the KF structure asks you to argue the object first, then show how
  it behaves.
- **Evolution is the longest section in early-stage chapters.** When
  the topic is young, the "how did we get here" story is the most
  valuable part of the chapter. As the topic matures, Evolution shrinks
  while Representation and Operation grow.

## References

- Koller, D., & Friedman, N. (2009). *Probabilistic Graphical Models:
  Principles and Techniques*. MIT Press.
- The agentic-coding book's `00-design.mdx` explains how the scaffold
  implements these ideas — read it as a worked example.
