// @ts-check
// Explicit profile pass: course-notes. The defineBookConfig integration
// auto-detects src/mdx-components.ts which registers NarrativeBox.
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  site: 'http://127.0.0.1:4174',
  profile: 'course-notes',
});
