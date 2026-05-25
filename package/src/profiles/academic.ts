/**
 * Academic profile — weekly curriculum with 7-state status taxonomy.
 *
 * Reference consumer: post_transformers. Schema definition + inferred
 * chapter type live in src/schemas.ts (consolidated to keep all Zod-using
 * code in one file — see schemas.ts header for the DTS-bundler rationale).
 * This module composes the schema with routes + styles via defineProfile.
 */
import { defineProfile } from '../profile-kit.js';
import { academicChapterSchema } from '../schemas.js';
import { academicChaptersRenderer } from './renderers/academic-chapters.js';

// Re-export for consumer ergonomics (`import { AcademicChapter } from '@brandon_m_behring/book-scaffold-astro'`).
export type { AcademicChapter } from '../schemas.js';

export const academicProfile = defineProfile({
  name: 'academic',
  schema: academicChapterSchema,
  routes: {
    references: true,
    search: true,
    print: true,
    chapters: false,        // academic consumers ship their own week-based /chapters listing
    convergence: false,     // tools-profile-specific
    frontmatter: false,     // opt-in per book; see #7
    tips: false,            // v4.3.0 #70: opt-in per book; requires build-tips
    exercises: false,       // v4.4.0: opt-in per book; requires build-exercises
  },
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css'],
  katex: true,
  chaptersRenderer: academicChaptersRenderer,   // v3.7.0 (#35) — owns /chapters semantics if consumer opts in via routes.chapters
});
