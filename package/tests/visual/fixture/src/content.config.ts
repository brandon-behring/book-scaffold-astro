import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';

// #179: preset made explicit — this fixture previously leaned on the
// package.json script env (BOOK_PROFILE=academic), which anything running
// content-sync outside npm scripts never saw.
export const { collections } = defineBookSchemas({ preset: 'academic' });
