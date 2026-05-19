/**
 * Tools profile — AI-CLI comparison content with volatility + sources.
 *
 * Reference consumer: book-template-astro. Schema + inferred type live in
 * src/schemas.ts; this module composes with routes + styles.
 */
import { defineProfile } from '../profile-kit.js';
import { toolsChapterSchema } from '../schemas.js';

export type { ToolsChapter } from '../schemas.js';

export const toolsProfile = defineProfile({
  name: 'tools',
  schema: toolsChapterSchema,
  routes: {
    references: true,
    search: true,
    print: true,
    chapters: true,         // tools profile ships a flat chapter index
    convergence: true,      // tools profile ships convergence dashboard
  },
  styles: [
    'tokens.css', 'layout.css', 'callouts.css', 'chapter.css',
    'typography.css', 'print.css', 'convergence.css', 'tool-filter.css',
  ],
});
