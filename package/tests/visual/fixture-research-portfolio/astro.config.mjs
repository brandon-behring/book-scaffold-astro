// @ts-check
// research-portfolio preset (v3.5.0, closes #6).
//
// v4.0.0 (BREAKING): migrated from `preset: 'research-portfolio'` to
// `styles: [researchPortfolioStyle]` composition. The built-in style
// already sets `routes.frontmatter: { enabled: true, prefix: 'frontmatter' }`
// so no override needed here. Exercises the #7 plumbing.
import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [researchPortfolioStyle],
  site: 'http://127.0.0.1:4175',
});
