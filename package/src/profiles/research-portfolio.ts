/**
 * Research-portfolio profile — books that combine academic structure (week/
 * part/status + math + BibTeX + Theorem family) with tools-style provenance
 * (volatility class, tier-tagged sources, last_verified freshness signal).
 *
 * Closes issue #6 (v3.5.0). Reference consumer (forthcoming):
 * prompt-injection-portfolio.
 *
 * Schema + inferred type live in src/schemas.ts; this module composes with
 * routes + styles + katex flag.
 *
 * Distinguishing features vs other profiles:
 *
 * - Routes: /references + /search + /print + /frontmatter all auto-injected
 *   by default (research portfolios universally need a title-page /
 *   ai-disclosure / pre-release-banner under /frontmatter). /chapters and
 *   /convergence stay off — portfolios typically have a custom landing
 *   page enumerating chapters by part.
 * - Styles: same as academic (chapter.css/typography.css/etc.) — KaTeX
 *   math is on by default since most portfolio chapters reference equations.
 * - katex: true — math typesetting wired in (same as academic).
 */
import { defineProfile } from '../profile-kit.js';
import { researchPortfolioChapterSchema } from '../schemas.js';

export type { ResearchPortfolioChapter } from '../schemas.js';

export const researchPortfolioProfile = defineProfile({
  name: 'research-portfolio',
  schema: researchPortfolioChapterSchema,
  routes: {
    references: true,
    search: true,
    print: true,
    chapters: false,             // portfolio books ship their own landing/index
    convergence: false,          // tools-profile-specific
    frontmatter: true,           // portfolios universally need title/disclosure/banner pages
  },
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css'],
  katex: true,                   // math is common in research content
});
