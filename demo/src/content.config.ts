/**
 * demo/src/content.config.ts — v3.0 consumer config.
 *
 * defineBookSchemas returns the package's fixed collections (chapters +
 * tools-collateral). Consumer extends via JS spread + Zod .extend()
 * per Q5 — see PACKAGE_DESIGN.md §5.
 */
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';

export const { collections } = defineBookSchemas({ preset: 'academic' });
