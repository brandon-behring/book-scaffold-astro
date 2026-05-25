// @ts-check
// Visual regression fixture for v4.3.0+ book-genre components.
//
// Academic preset (KaTeX wiring on) + opt into 3 auto-routes:
//   - routes.chapters: dynamic /chapters/<slug>/ (v4.3.0 #69)
//   - routes.tips: /tips auto-route (v4.3.0 #70)
//   - routes.exercises: /exercises auto-route (v4.4.0)
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'http://127.0.0.1:4178',
  routes: {
    chapters: true,
    tips: true,
    exercises: true,
  },
});
