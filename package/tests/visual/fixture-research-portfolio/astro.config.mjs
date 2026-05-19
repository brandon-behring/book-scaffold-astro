// @ts-check
// research-portfolio preset (v3.5.0, closes #6).
// Explicit preset pass via the canonical v3.4.0+ `preset:` key.
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  site: 'http://127.0.0.1:4175',
  preset: 'research-portfolio',
  // routes.frontmatter is ALREADY default-true for research-portfolio per the
  // profile config, so no override needed here. Exercises the #7 plumbing.
});
