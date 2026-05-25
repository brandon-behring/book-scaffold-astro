/**
 * Course-notes profile — chapters derived from a video course / MOOC / book.
 *
 * Reference consumer (forthcoming): DLAI knowledge-graphs-rag pilot. Schema
 * + inferred type live in src/schemas.ts; this module composes with routes
 * + styles. Multi-book corpus pattern is supported by consumer-side schema
 * extension via Zod .extend() with a `book` discriminator.
 *
 * Distinct from the tools profile (which has tools_compared as an enum of
 * AI CLIs) and academic profile (which is week-based). Don't reuse either.
 */
import { defineProfile } from '../profile-kit.js';
import { courseNotesChapterSchema } from '../schemas.js';
import { fallbackChaptersRenderer } from './renderers/fallback-chapters.js';

export type { CourseNotesChapter } from '../schemas.js';

export const courseNotesProfile = defineProfile({
  name: 'course-notes',
  schema: courseNotesChapterSchema,
  routes: {
    references: true,
    search: true,
    print: true,
    chapters: false,        // multi-book consumers route via [book]/[slug] themselves
    convergence: false,
    frontmatter: false,     // opt-in per book; see #7
    tips: false,            // v4.3.0 #70: opt-in per book
  },
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css'],
  // v3.7.0 (#35): course-notes schema has tools-style fields (chapter, volatility, sources) — fallback renderer dispatches via tools renderer
  chaptersRenderer: fallbackChaptersRenderer,
});
