/**
 * tests/schema-slug.test.mjs — v4.9.0: the optional `slug` URL-override field
 * is now accepted by EVERY profile chapter schema (was research-portfolio-only).
 * The package-injected chapter route serves `/chapters/<entry.id>`, and Astro's
 * glob loader derives `entry.id` from a frontmatter `slug:` when present — so a
 * universal `slug` field lets any profile use numbered filenames + clean URLs.
 *
 * Run after `npm run build`: imports from dist/ since node:test can't load TS
 * directly (same pattern as provenance.test.mjs).
 * Run: node --test tests/schema-slug.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  academicChapterSchema,
  toolsChapterSchema,
  minimalChapterSchema,
  courseNotesChapterSchema,
  researchPortfolioChapterSchema,
} from '../dist/index.mjs';

// Minimal valid bodies per profile (required fields only) — mirrors
// provenance.test.mjs so the two suites stay in sync.
const minimal = {
  academic: { week: 7, part: 'ssm-core', title: 'Ch7', status: 'planned' },
  tools: {
    title: 'Ch1',
    part: 1,
    chapter: 1,
    volatility: 'stable-principle',
    tools_compared: ['claude-code'],
    last_verified: new Date('2026-05-01'),
  },
  minimal: {
    title: 'Ch1',
    part: 1,
    chapter: 1,
    volatility: 'stable-principle',
    tools_compared: ['claude-code'],
    last_verified: new Date('2026-05-01'),
  },
  courseNotes: { title: 'Ch1', chapter: 1, last_verified: new Date('2026-05-01') },
  researchPortfolio: { title: 'Ch1', last_verified: new Date('2026-05-01') },
};

const schemas = {
  academic: academicChapterSchema,
  tools: toolsChapterSchema,
  minimal: minimalChapterSchema,
  courseNotes: courseNotesChapterSchema,
  researchPortfolio: researchPortfolioChapterSchema,
};

for (const [name, schema] of Object.entries(schemas)) {
  test(`slug: accepted + preserved on the ${name} schema`, () => {
    const res = schema.safeParse({ ...minimal[name], slug: 'clean-name' });
    assert.ok(res.success, `slug should be accepted: ${res.error?.message}`);
    assert.equal(res.data.slug, 'clean-name');
  });

  test(`slug: optional on the ${name} schema (omitted → undefined, no error)`, () => {
    const res = schema.safeParse({ ...minimal[name] });
    assert.ok(res.success, res.error?.message);
    assert.equal(res.data.slug, undefined);
  });
}
