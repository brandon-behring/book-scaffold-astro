/**
 * src/styles/built-in.ts — toolkit-shipped Styles, one per BookPreset (v4.0.0).
 *
 * Each profile that the toolkit shipped in v3 (academic, tools, minimal,
 * course-notes, research-portfolio) is now mirrored by a built-in Style
 * importable by consumers:
 *
 *   import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';
 *   export default await defineBookConfig({ styles: [academicStyle], site: '...' });
 *
 * Consumers can compose built-in styles with their own:
 *
 *   import { researchPortfolioStyle, defineStyle } from '@brandon_m_behring/book-scaffold-astro';
 *   const guidesFamilyStyle = defineStyle({ site: 'https://guides.brandon-behring.dev/' });
 *   export default await defineBookConfig({
 *     styles: [researchPortfolioStyle, guidesFamilyStyle],
 *     // ...
 *   });
 *
 * The v3 `preset: '...'` shorthand is replaced by this explicit style chain.
 * See MIGRATION-v3-to-v4.md.
 */
import { defineStyle, type Style } from '../lib/define-style.js';
import type { BookPreset } from '../types.js';

/** Academic preset — weekly curriculum, 7-state status, KaTeX wired, BibTeX pipeline. */
export const academicStyle: Style = defineStyle({
  name: 'academic',
  preset: 'academic',
  deploy: 'workers',
});

/** Tools preset — AI-CLI comparison content with volatility + sources. */
export const toolsStyle: Style = defineStyle({
  name: 'tools',
  preset: 'tools',
  deploy: 'workers',
});

/** Minimal preset — single-author essays / manifestos. */
export const minimalStyle: Style = defineStyle({
  name: 'minimal',
  preset: 'minimal',
  deploy: 'workers',
});

/** Course-notes preset — chapters derived from a video course / MOOC / book.
 *  `deploy` is retained as deprecated metadata only (#180). */
export const courseNotesStyle: Style = defineStyle({
  name: 'course-notes',
  preset: 'course-notes',
  deploy: 'pages',
});

/** Research-portfolio preset — academic structure + tools-style provenance + portfolio components.
 *  `deploy` is retained as deprecated metadata only (#180); frontmatter routes remain enabled. */
export const researchPortfolioStyle: Style = defineStyle({
  name: 'research-portfolio',
  preset: 'research-portfolio',
  deploy: 'pages',
  routes: { frontmatter: { enabled: true, prefix: 'frontmatter' } },
});

/**
 * Registry of all toolkit-shipped styles, keyed by their preset name.
 *
 * `satisfies` (TS 4.9+) keeps the inferred narrow type while validating the
 * shape: `BUILTIN_STYLES['academic']` resolves to `typeof academicStyle`,
 * not to generic `Style`. Used by the v3 → v4 migration error path
 * (config.ts) to construct auto-suggested replacements.
 */
export const BUILTIN_STYLES = {
  academic: academicStyle,
  tools: toolsStyle,
  minimal: minimalStyle,
  'course-notes': courseNotesStyle,
  'research-portfolio': researchPortfolioStyle,
} as const satisfies Record<BookPreset, Style>;
