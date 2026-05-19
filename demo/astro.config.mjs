// @ts-check
/**
 * demo/astro.config.mjs — v3.0 consumer config.
 *
 * defineBookConfig threads BOOK_PROFILE env, registers the package's
 * dual-purpose Integration (route + style injection), and applies
 * profile-conditional KaTeX wiring. See PACKAGE_DESIGN.md §4.
 */
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  site: 'https://example.invalid',
});
