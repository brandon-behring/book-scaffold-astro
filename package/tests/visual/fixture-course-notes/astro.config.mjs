// @ts-check
// course-notes preset visual fixture. The defineBookConfig integration
// auto-detects src/mdx-components.ts which registers NarrativeBox.
//
// v4.0.0 (BREAKING): migrated from `preset: 'course-notes'` to
// `styles: [courseNotesStyle]` composition. See MIGRATION-v3-to-v4.md.
import { defineBookConfig, courseNotesStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [courseNotesStyle],
  site: 'http://127.0.0.1:4174',
});
