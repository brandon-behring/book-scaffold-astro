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
    chapters: true,         // v4.6.1 (#75 follow-up): default-on. Multi-book consumers (DLAI-style) override via routes: { chapters: false } + own [book]/[slug] routes — see #15 deferred.
    convergence: false,
    frontmatter: false,     // opt-in per book; see #7
    tips: false,            // v4.3.0 #70: opt-in per book
    exercises: false,       // v4.4.0: opt-in per book
    practiceExam: false,    // v4.17.0 #112: opt-in per book; requires src/content/questions/
    glossary: false,        // v4.19.0 #115: opt-in per book; requires src/content/glossary/
    answers: false, // v4.21.0 #114: opt-in per book; requires src/content/questions/
    flashcards: false, // v4.22.0 #116: opt-in per book; requires src/content/glossary/
    landing: true,          // v4.5.0: auto-inject minimal root landing
  },
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css', 'section-map.css'],
  // v3.7.0 (#35): course-notes schema has tools-style fields (chapter, volatility, sources) — fallback renderer dispatches via tools renderer
  chaptersRenderer: fallbackChaptersRenderer,
  // v4.6.0 (#76 Secondary): exclude /print/ from sitemap — print-friendly
  // view, crawl-redundant. Course-notes-profile default.
  sitemapFilter: (page: string) => !page.includes('/print/'),
});
