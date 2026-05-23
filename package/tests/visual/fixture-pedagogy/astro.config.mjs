// @ts-check
// Visual regression fixture for v4.1.1 pedagogy components.
//
// Academic preset (KaTeX wiring on) — covers Pitfall + WorkedExample +
// YouWillLearn + PocLayout in one fixture. Plan F7.
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'http://127.0.0.1:4177',
});
