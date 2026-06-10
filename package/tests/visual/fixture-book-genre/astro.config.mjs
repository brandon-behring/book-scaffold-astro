// @ts-check
// Visual regression fixture for v4.3.0+ book-genre components.
//
// Academic preset (KaTeX wiring on) + opt into 4 auto-routes:
//   - routes.chapters: dynamic /chapters/<slug>/ (v4.3.0 #69)
//   - routes.tips: /tips auto-route (v4.3.0 #70)
//   - routes.exercises: /exercises auto-route (v4.4.0)
//   - routes.practiceExam: /practice-exam auto-route (v4.17.0 #112) — reads the
//     questions collection; examDomains is the per-book fail-loud taxonomy.
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'http://127.0.0.1:4178',
  routes: {
    chapters: true,
    tips: true,
    exercises: true,
    practiceExam: true,
    // v4.21.0 (#114): answer-rationale back-appendix; q-arrays-bounds uses
    // <Rationale appendix for=…> which throws at build unless this is on.
    answers: true,
    // This fixture owns src/pages/index.astro — declare the landing override
    // so the scaffold doesn't inject a colliding "/" (#129).
    landing: false,
  },
  // v4.17.0 (#112): closed exam-domain taxonomy. A question whose `domain` is
  // not listed here throws at build (assertKnownDomain) — fail-loud. `recursion`
  // has NO questions on purpose: it exercises the <ObjectiveMap> honest gap row.
  examDomains: ['arrays', 'strings', 'recursion'],
});
