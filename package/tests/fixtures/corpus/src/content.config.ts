import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
import corpus from '../corpus.mjs';

export const collections = defineBookSchemas({ corpus }).collections;
