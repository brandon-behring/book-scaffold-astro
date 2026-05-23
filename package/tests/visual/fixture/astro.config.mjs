// @ts-check
// Explicit style pass: tests/visual/ is checked into git but .env is
// gitignored at repo root, so a fresh CI checkout has no BOOK_PROFILE in
// either .env or process.env. Passing via defineBookConfig keeps the
// fixture self-contained and deterministic.
//
// v4.0.0 (BREAKING): migrated from `preset: 'academic'` to the
// `styles: [academicStyle]` composition. See MIGRATION-v3-to-v4.md.
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'http://127.0.0.1:4173',
});
