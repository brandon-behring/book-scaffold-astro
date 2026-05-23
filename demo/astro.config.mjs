// @ts-check
/**
 * demo/astro.config.mjs — v4.0.0 consumer config.
 *
 * defineBookConfig composes the academic built-in style + registers the
 * package's dual-purpose Integration (route + style injection) + applies
 * profile-conditional KaTeX wiring. See PACKAGE_DESIGN.md §4 and
 * recipes/15-defining-styles.md.
 *
 * Migrated from `preset: 'academic'` to `styles: [academicStyle]` in
 * v4.0.0. See MIGRATION-v3-to-v4.md.
 */
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://example.invalid',
});
