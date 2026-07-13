import { defineBookCorpus } from '@brandon_m_behring/book-scaffold-astro';

export default defineBookCorpus({
  preset: 'research-portfolio',
  books: [
    {
      id: 'evaluation',
      title: 'Evaluation Engineering',
      description: 'Measurement and evaluation systems.',
      apparatus: ['references', 'print', 'convergence', 'practice-exam', 'glossary', 'answers'],
    },
    {
      id: 'llm-app-engineering',
      title: 'LLM Application Engineering',
      description: 'Production application patterns.',
      apparatus: ['references', 'print', 'convergence', 'tips', 'exercises', 'glossary', 'flashcards'],
    },
  ],
});
