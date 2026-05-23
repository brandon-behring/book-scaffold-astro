// @ts-check
// Fixture for the v3.7.0 academic /chapters route refactor (#35 + #36).
// Exercises the AcademicChaptersRenderer end-to-end: multiple parts,
// Week N numbering, status badges, the chapters listing route.
//
// Explicit profile + routes config: tests/visual/ is checked into git but
// .env is gitignored at repo root, so a fresh CI checkout has no
// BOOK_PROFILE in either .env or process.env. Passing both via
// defineBookConfig keeps the fixture self-contained and deterministic.
//
// routes.chapters: true is what makes this fixture exercise the academic
// chapters route — the same opt-in pattern double-ml-time-series used in
// the bug #24 report.
// v4.0.0 (BREAKING): migrated from `profile: 'academic'` to the
// `styles: [academicStyle]` composition. See MIGRATION-v3-to-v4.md.
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'http://127.0.0.1:4176',
  routes: { chapters: true },
});
