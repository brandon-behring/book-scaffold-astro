import {
  defineBookConfig,
  researchPortfolioStyle,
} from '@brandon_m_behring/book-scaffold-astro';
import corpus from './corpus.mjs';

const base = process.env.CORPUS_BASE ?? '/';
const outDir = process.env.CORPUS_OUT_DIR ?? './dist';

export default await defineBookConfig({
  styles: [researchPortfolioStyle],
  corpus,
  site: `https://corpus.example${base}`,
  base,
  outDir,
  title: 'Research Engineering Library',
  description: 'Two independently navigable books in one build.',
  examDomains: ['engineering'],
  routes: {
    frontmatter: false,
    references: true,
    print: true,
    convergence: true,
    chapters: true,
    landing: true,
    search: true,
    tips: true,
    exercises: true,
    practiceExam: true,
    glossary: true,
    flashcards: true,
    answers: true,
  },
  extraStyles: ['convergence.css'],
});
