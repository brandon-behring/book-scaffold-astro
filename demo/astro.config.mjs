// @ts-check
/**
 * demo/astro.config.mjs — v4.0.0 consumer config (v4.6.0 SEO surface added).
 *
 * defineBookConfig composes the academic built-in style + registers the
 * package's dual-purpose Integration (route + style injection) + applies
 * profile-conditional KaTeX wiring. See PACKAGE_DESIGN.md §4 and
 * recipes/15-defining-styles.md.
 *
 * v4.6.0 (D14 of the v4.6.0 plan): the demo is now the visible exemplar
 * of the new SEO API. Sets `title`, `description`, `author` + a `seo`
 * block (ogImage + twitterHandle) so the demo build exercises the full
 * propagation chain: defineBookConfig → virtual:book-scaffold/book-config
 * → Base.astro meta tags → emitted HTML. Catches integration bugs that
 * unit tests miss.
 *
 * Migrated from `preset: 'academic'` to `styles: [academicStyle]` in
 * v4.0.0. See MIGRATION-v3-to-v4.md.
 */
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://example.invalid',
  // CI sets DEMO_BASE=/foo/ for the non-root regression build (#154).
  // Keeping this environment-only avoids changing the normal demo URL.
  base: process.env.DEMO_BASE ?? '/',
  title: 'book-scaffold-astro demo',
  // v4.23.0 (#135): sidebar brand subtitle — smoke-covers the new config field.
  subtitle: 'Integration smoke book',
  description:
    'In-repo demo + integration smoke test for @brandon_m_behring/book-scaffold-astro. ' +
    'Exercises the academic profile end-to-end (KaTeX, BibTeX cite resolution, ' +
    'XRef labels, auto-injected routes, v4.6.0 SEO meta tags).',
  author: 'Brandon Behring',
  seo: {
    ogImage: '/og-default.png',
    twitterHandle: '@brandonbehring',
  },
});
