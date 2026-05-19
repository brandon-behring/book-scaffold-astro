/**
 * Consumer's MDX-components registry. The scaffold auto-detects this file
 * (src/mdx-components.{ts,js,mjs}) and threads the default export through
 * the virtual:book-scaffold/mdx-components module. Scaffold-injected routes
 * (/print, future /pdf, /epub) render with these components in scope.
 *
 * defineMdxComponents is an identity helper that preserves the exact
 * key→component type mapping for IntelliSense.
 */
import { defineMdxComponents } from '@brandon_m_behring/book-scaffold-astro';
import NarrativeBox from './components/NarrativeBox.astro';

export default defineMdxComponents({
  NarrativeBox,
});
