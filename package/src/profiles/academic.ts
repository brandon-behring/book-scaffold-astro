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
    chapters: true,         // v4.6.1 (#75 follow-up): auto-injected /chapters/[...slug]/ + /chapters/ index. Pre-v4.3.0 academic books shipped their own listing; v4.6.0 (#76 Layer 3c) removed the consumer template assuming auto-injection. Default flipped here to close the gap. Consumers wanting their own listing override via `routes: { chapters: false }` + their own src/pages/chapters/* — see recipe 18.
    convergence: false,     // tools-profile-specific
    frontmatter: false,     // opt-in per book; see #7
    tips: false,            // v4.3.0 #70: opt-in per book; requires build-tips
    exercises: false,       // v4.4.0: opt-in per book; requires build-exercises
    practiceExam: false,    // v4.17.0 #112: opt-in per book; requires src/content/questions/
    glossary: false,        // v4.19.0 #115: opt-in per book; requires src/content/glossary/
    landing: true,          // v4.5.0: auto-inject minimal root landing; consumers override via src/pages/index.astro
  },
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css'],
  katex: true,
  chaptersRenderer: academicChaptersRenderer,   // v3.7.0 (#35) — owns /chapters semantics if consumer opts in via routes.chapters
  // v4.6.0 (#76 Secondary): exclude /print/ from sitemap — print-friendly
  // view, crawl-redundant. Academic-profile default.
  sitemapFilter: (page: string) => !page.includes('/print/'),
});
