/**
 * Minimal profile — single-author essays / manifestos. Currently aliases
 * the tools chapter schema (defined in src/schemas.ts as
 * minimalChapterSchema). If minimal-specific fields emerge from a real
 * consumer, this is where they land.
 */
import { defineProfile } from '../profile-kit.js';
import { minimalChapterSchema } from '../schemas.js';

export type { MinimalChapter } from '../schemas.js';

export const minimalProfile = defineProfile({
  name: 'minimal',
  schema: minimalChapterSchema,
  routes: {
    references: true,
    search: true,
    print: true,
    chapters: false,
    convergence: false,
    frontmatter: false,     // opt-in per book; see #7
  },
  styles: ['tokens.css', 'layout.css', 'callouts.css', 'chapter.css', 'typography.css', 'print.css'],
});
