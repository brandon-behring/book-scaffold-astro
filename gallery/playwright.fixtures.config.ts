import { defineConfig } from '@playwright/test';

// Phase 3: route-level visual coverage for the 6 profile fixtures — the parity
// that lets Phase 5 retire the raw-chrome `run.sh`. Each fixture is a real
// consumer book (its own BOOK_PROFILE/PRESET + chapters collection), so these
// routes exercise the book-coupled chrome (Sidebar/ChapterNav/ChapterHeader/
// Citation) the bare component gallery deliberately can't.
//
// Full-page `toHaveScreenshot` replaces run.sh's `--window-size=Wx2000`
// viewport cap (the #82 fold). Two widths cover the real responsive states
// (mobile + desktop); run.sh's 1440/1920 were redundant with 1280.
const FIX = '../package/tests/visual';
const FIXTURES: [string, number][] = [
  ['fixture', 4173],
  ['fixture-course-notes', 4174],
  ['fixture-research-portfolio', 4175],
  ['fixture-academic-chapters', 4176],
  ['fixture-pedagogy', 4177],
  ['fixture-book-genre', 4178],
];

export default defineConfig({
  testDir: './tests/fixtures',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { channel: 'chrome' },
  expect: { toHaveScreenshot: { maxDiffPixels: 400 } },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 768, height: 900 } } },
  ],
  // Each fixture's preview script sets its own profile env + binds its port.
  webServer: FIXTURES.map(([dir, port]) => ({
    command: `npm --prefix ${FIX}/${dir} run build && npm --prefix ${FIX}/${dir} run preview`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  })),
});
