/**
 * tests/schema-layout.test.mjs — 1d: the optional `layout` per-page width knob
 * is accepted by EVERY profile chapter schema (a closed enum 'default'|'wide').
 * Chapter.astro threads it as data-layout on <article class="prose"> and
 * layout.css maps [data-layout="wide"] → a wider --measure-main. A closed
 * z.enum fail-louds on an invalid value at content load — that IS the
 * validation (no assertEnumProp needed for a schema field).
 *
 * Run after `npm run build`: imports from dist/ since node:test can't load TS
 * directly (same pattern as schema-slug.test.mjs).
 * Run: node --test tests/schema-layout.test.mjs
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
// schema-slug.test.mjs so the two suites stay in sync.
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
  test(`layout: 'wide' accepted + preserved on the ${name} schema`, () => {
    const res = schema.safeParse({ ...minimal[name], layout: 'wide' });
    assert.ok(res.success, `layout should be accepted: ${res.error?.message}`);
    assert.equal(res.data.layout, 'wide');
  });

  test(`layout: 'default' accepted on the ${name} schema`, () => {
    const res = schema.safeParse({ ...minimal[name], layout: 'default' });
    assert.ok(res.success, res.error?.message);
    assert.equal(res.data.layout, 'default');
  });

  test(`layout: optional on the ${name} schema (omitted → undefined, no error)`, () => {
    const res = schema.safeParse({ ...minimal[name] });
    assert.ok(res.success, res.error?.message);
    assert.equal(res.data.layout, undefined);
  });

  test(`layout: a bogus value fails loud (closed enum) on the ${name} schema`, () => {
    const res = schema.safeParse({ ...minimal[name], layout: 'ultrawide' });
    assert.ok(!res.success, 'an out-of-enum layout must be rejected at content load');
  });
}
