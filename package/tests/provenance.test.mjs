/**
 * tests/provenance.test.mjs — node:test suite for the v4.8.0 `provenance`
 * frontmatter field + its attachment to every profile chapter schema.
 *
 * Run after `npm run build`: tests import from dist/ since node:test can't
 * load TS directly. Run: node --test tests/provenance.test.mjs
 *
 * Covers: enum contents; the nested object's defaults; the deliberate
 * choices that the schema must honor —
 *   - `citation_backstop` is a CONTROLLED enum (rejects typos),
 *   - `prompts_archive` / `decisions_log` are plain strings (repo-relative
 *     paths must be accepted — guards against a `.url()` regression),
 *   - `audit_history.type` is a FREE string (real audit types vary),
 *   - `provenance` is OPTIONAL on all four base schemas (opt-out works at
 *     the schema level; existing chapters without it still validate).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  provenanceObject,
  citationBackstops,
  academicChapterSchema,
  toolsChapterSchema,
  courseNotesChapterSchema,
  researchPortfolioChapterSchema,
} from '../dist/index.mjs';

const fullProvenance = {
  ai_tools: ['Claude Code (Opus 4.8)', 'research-kb'],
  prompts_archive: 'docs/sessions/2026-05-22--ch07.md',
  decisions_log: 'DECISIONS.md#ch07-hippo-derivation',
  audit_history: [
    { date: new Date('2026-05-15'), type: 'routine', file: 'audits/AUDIT_2026-05-15.md' },
    { date: new Date('2026-05-22'), type: 'independent', file: 'audits/AUDIT_2026-05-22.md' },
  ],
  citation_backstop: 'research-kb',
};

// Minimal valid bodies per profile (required fields only).
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
  courseNotes: { title: 'Lec1', chapter: 1, last_verified: new Date('2026-05-01') },
  researchPortfolio: { title: 'Note1', last_verified: new Date('2026-05-01') },
};

const schemas = {
  academic: academicChapterSchema,
  tools: toolsChapterSchema,
  courseNotes: courseNotesChapterSchema,
  researchPortfolio: researchPortfolioChapterSchema,
};

test('citationBackstops is the controlled 3-value vocabulary', () => {
  assert.deepEqual([...citationBackstops], ['research-kb', 'manual', 'unverified']);
});

test('provenanceObject: full valid object parses', () => {
  const r = provenanceObject.safeParse(fullProvenance);
  assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error?.issues));
});

test('provenanceObject: empty object parses; array fields default to []', () => {
  const r = provenanceObject.safeParse({});
  assert.equal(r.success, true);
  assert.deepEqual(r.data.ai_tools, []);
  assert.deepEqual(r.data.audit_history, []);
});

test('provenanceObject: repo-relative paths accepted (no .url() regression)', () => {
  const r = provenanceObject.safeParse({
    prompts_archive: 'DECISIONS.md#anchor',
    decisions_log: 'docs/sessions/x.md',
  });
  assert.equal(r.success, true, 'relative paths must NOT be rejected as non-URLs');
});

test('provenanceObject: bad citation_backstop is rejected (controlled enum)', () => {
  const r = provenanceObject.safeParse({ citation_backstop: 'reseach-kb' });
  assert.equal(r.success, false);
});

test('provenanceObject: audit_history.type accepts arbitrary free strings', () => {
  const r = provenanceObject.safeParse({
    audit_history: [{ date: new Date('2026-05-26'), type: 'repo_content_quality_audit', file: 'audits/x.md' }],
  });
  assert.equal(r.success, true, 'free-form audit types (real ssm data) must be accepted');
});

for (const [name, schema] of Object.entries(schemas)) {
  test(`${name} schema: validates WITHOUT provenance (opt-out / backward-compat)`, () => {
    const r = schema.safeParse({ ...minimal[name] });
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error?.issues));
    assert.equal(r.data.provenance, undefined);
  });

  test(`${name} schema: validates WITH a full provenance block`, () => {
    const r = schema.safeParse({ ...minimal[name], provenance: fullProvenance });
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error?.issues));
    assert.equal(r.data.provenance.citation_backstop, 'research-kb');
    assert.equal(r.data.provenance.audit_history.length, 2);
  });

  test(`${name} schema: rejects an invalid provenance backstop`, () => {
    const r = schema.safeParse({ ...minimal[name], provenance: { citation_backstop: 'nope' } });
    assert.equal(r.success, false);
  });
}
