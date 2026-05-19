import { defineBookSchemas, frontmatterCollection } from '@brandon_m_behring/book-scaffold-astro/schemas';
import { z } from 'astro/zod';

const baseCollections = defineBookSchemas({ preset: 'research-portfolio' }).collections;

export const collections = {
  ...baseCollections,
  // v3.4.0 (#7) frontmatter collection helper; required because the research-
  // portfolio preset auto-enables /frontmatter/[slug] and the fixture exercises it.
  frontmatter: frontmatterCollection(
    z.object({
      slug: z.string(),
      title: z.string(),
      order: z.number().int().min(0),
      description: z.string().optional(),
    }),
  ),
};
