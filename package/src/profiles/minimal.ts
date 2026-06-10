/**
 * Minimal profile — single-author essays / manifestos. Currently aliases
 * the tools chapter schema (defined in src/schemas.ts as
 * minimalChapterSchema). If minimal-specific fields emerge from a real
 * consumer, this is where they land.
 */
import { defineProfile } from '../profile-kit.js';
import { minimalChapterSchema } from '../schemas.js';
import { fallbackChaptersRenderer } from './renderers/fallback-chapters.js';

export type { MinimalChapter } from '../schemas.js';

export const minimalProfile = defineProfile({
  name: 'minimal',
  schema: minimalChapterSchema,
  routes: {
    references: true,
    search: true,
    print: true,
    chapters: true,         // v4.6.1 (#75 follow-up): default-on across all profiles. Consumer override via routes: { chapters: false }.
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
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css'],
  // v3.7.0 (#35): minimal aliases tools schema; fallback renderer field-dispatches if a consumer opts into routes.chapters
  chaptersRenderer: fallbackChaptersRenderer,
});
