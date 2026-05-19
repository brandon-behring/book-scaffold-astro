// @ts-check
// Explicit profile pass: tests/visual/ is checked into git but .env is
// gitignored at repo root, so a fresh CI checkout has no BOOK_PROFILE in
// either .env or process.env. Passing it via defineBookConfig keeps the
// fixture self-contained and deterministic.
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  site: 'http://127.0.0.1:4173',
  profile: 'academic',
});
