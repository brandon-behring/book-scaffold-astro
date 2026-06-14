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
import { fallbackChaptersRenderer } from './renderers/fallback-chapters.js';

export type { ResearchPortfolioChapter } from '../schemas.js';

export const researchPortfolioProfile = defineProfile({
  name: 'research-portfolio',
  schema: researchPortfolioChapterSchema,
  routes: {
    references: true,
    search: true,
    print: true,
    chapters: true,              // v4.6.1 (#75 follow-up): default-on. Portfolios still ship their own /frontmatter/* + landing; /chapters/* renders the underlying chapter list.
    convergence: false,          // tools-profile-specific
    frontmatter: true,           // portfolios universally need title/disclosure/banner pages
    tips: false,                 // v4.3.0 #70: opt-in per book
    exercises: false,            // v4.4.0: opt-in per book
    practiceExam: false,         // v4.17.0 #112: opt-in per book; requires src/content/questions/
    glossary: false,             // v4.19.0 #115: opt-in per book; requires src/content/glossary/
    answers: false, // v4.21.0 #114: opt-in per book; requires src/content/questions/
    flashcards: false, // v4.22.0 #116: opt-in per book; requires src/content/glossary/
    landing: true,               // v4.5.0: auto-inject minimal root landing
  },
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css', 'section-map.css'],
  katex: true,                   // math is common in research content
  // v3.7.0 (#35): portfolio schema is a union of academic + tools shapes — fallback renderer dispatches per chapter via field presence
  chaptersRenderer: fallbackChaptersRenderer,
});
