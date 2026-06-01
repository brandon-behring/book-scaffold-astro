/**
 * tests/chapters-renderer.test.mjs — node:test suite for the v3.7.0
 * per-profile ChaptersRenderer strategy (closes #35).
 *
 * Tests run after `npm run build` and import from dist/ since node:test
 * can't load TS directly. Three renderers + their interactions:
 *
 *   - toolsChaptersRenderer (the v3.5.2 tools branch, extracted)
 *   - academicChaptersRenderer (the v3.5.2 academic branch, extracted)
 *   - fallbackChaptersRenderer (field-presence dispatch; safety net for
 *     minimal / course-notes / research-portfolio when a consumer opts
 *     into routes.chapters: true on a profile without a dedicated renderer)
 *
 * Run: node --test tests/chapters-renderer.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  toolsChaptersRenderer,
  academicChaptersRenderer,
  fallbackChaptersRenderer,
  chapterSortKey,
} from '../dist/index.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date(Date.UTC(2026, 0, 1));
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS);

// ===== Tools renderer =====

test('tools: partKey returns numeric part', () => {
  assert.equal(toolsChaptersRenderer.partKey({ part: 2 }), 2);
});

test('tools: formatPartLabel returns "Part N" for parts 0-5', () => {
  assert.equal(toolsChaptersRenderer.formatPartLabel(1), 'Part 1');
  assert.equal(toolsChaptersRenderer.formatPartLabel(5), 'Part 5');
});

test('tools: formatPartLabel returns "Appendices" for parts >= 6', () => {
  assert.equal(toolsChaptersRenderer.formatPartLabel(6), 'Appendices');
  assert.equal(toolsChaptersRenderer.formatPartLabel(10), 'Appendices');
});

test('tools: isAppendix true for part >= 6', () => {
  assert.equal(toolsChaptersRenderer.isAppendix(5), false);
  assert.equal(toolsChaptersRenderer.isAppendix(6), true);
});

test('tools: formatChapterNumber non-appendix returns "Chapter N"', () => {
  assert.equal(toolsChaptersRenderer.formatChapterNumber({ chapter: 3 }, false), 'Chapter 3');
});

test('tools: formatChapterNumber appendix returns "Appendix x" (letter)', () => {
  // chapter 1 → 'a', chapter 2 → 'b' (preserves v3.5.2 String.fromCharCode mapping)
  assert.equal(toolsChaptersRenderer.formatChapterNumber({ chapter: 1 }, true), 'Appendix a');
  assert.equal(toolsChaptersRenderer.formatChapterNumber({ chapter: 3 }, true), 'Appendix c');
});

test('tools: getToolsAttr returns space-joined tools_compared', () => {
  const attr = toolsChaptersRenderer.getToolsAttr({ tools_compared: ['claude-code', 'cross-tool'] });
  assert.equal(attr, 'claude-code cross-tool');
});

test('tools: getVolatilityData returns badge from volatility field', () => {
  const badge = toolsChaptersRenderer.getVolatilityData({ volatility: 'architectural-pattern' });
  assert.deepEqual(badge, { level: 'architectural-pattern', label: 'architectural-pattern' });
});

test('tools: getStatusData returns null (status is academic-only)', () => {
  assert.equal(toolsChaptersRenderer.getStatusData({ status: 'implemented' }), null);
});

test('tools: getFreshnessData returns null when last_verified missing', () => {
  assert.equal(toolsChaptersRenderer.getFreshnessData({ volatility: 'stable-principle' }, NOW), null);
});

test('tools: getFreshnessData computes status from volatility threshold', () => {
  // feature-surface threshold = 90 days; 30 days old = fresh
  const f = toolsChaptersRenderer.getFreshnessData(
    { last_verified: daysAgo(30), volatility: 'feature-surface' },
    NOW,
  );
  assert.ok(f);
  assert.equal(f.status, 'fresh');
  assert.match(f.label, /Fresh \(30d old/);
});

test('tools: getVerifiedDateLabel formats ISO date', () => {
  assert.equal(
    toolsChaptersRenderer.getVerifiedDateLabel({ last_verified: new Date(Date.UTC(2026, 4, 1)) }),
    'verified 2026-05-01',
  );
});

test('tools: sortKey = part * 1000 + chapter', () => {
  assert.equal(toolsChaptersRenderer.sortKey({ part: 2, chapter: 5 }), 2005);
  assert.equal(toolsChaptersRenderer.sortKey({ part: 0, chapter: 0 }), 0);
});

// ===== Academic renderer =====

test('academic: partKey returns string-enum part', () => {
  assert.equal(academicChaptersRenderer.partKey({ part: 'foundations' }), 'foundations');
});

test('academic: formatPartLabel maps the part enum acronym-correctly (#91)', () => {
  assert.equal(academicChaptersRenderer.formatPartLabel('foundations'), 'Foundations');
  // acronym preserved via explicit label map — was "Ssm Core" under naive title-casing
  assert.equal(academicChaptersRenderer.formatPartLabel('ssm-core'), 'SSM Core');
  assert.equal(academicChaptersRenderer.formatPartLabel('beyond-ssm'), 'Beyond SSM');
  assert.equal(academicChaptersRenderer.formatPartLabel('integration'), 'Integration');
  assert.equal(academicChaptersRenderer.formatPartLabel('synthesis'), 'Synthesis');
  // unknown/custom part → titleCase fallback (no map entry)
  assert.equal(academicChaptersRenderer.formatPartLabel('consumer-custom'), 'Consumer Custom');
});

test('academic: isAppendix always false', () => {
  assert.equal(academicChaptersRenderer.isAppendix('foundations'), false);
  assert.equal(academicChaptersRenderer.isAppendix(6), false);
});

test('academic: formatChapterNumber returns "Week N"', () => {
  assert.equal(academicChaptersRenderer.formatChapterNumber({ week: 5 }, false), 'Week 5');
});

test('academic: getToolsAttr returns "cross-tool" (filter opt-out)', () => {
  assert.equal(academicChaptersRenderer.getToolsAttr({}), 'cross-tool');
});

test('academic: getVolatilityData returns null', () => {
  assert.equal(academicChaptersRenderer.getVolatilityData({ volatility: 'stable-principle' }), null);
});

test('academic: getStatusData returns badge from status field', () => {
  const badge = academicChaptersRenderer.getStatusData({ status: 'implemented' });
  assert.deepEqual(badge, { status: 'implemented', label: 'implemented' });
});

test('academic: getFreshnessData returns null (no last_verified tracking)', () => {
  assert.equal(academicChaptersRenderer.getFreshnessData({ last_verified: NOW }, NOW), null);
});

test('academic: getVerifiedDateLabel returns null', () => {
  assert.equal(academicChaptersRenderer.getVerifiedDateLabel({ last_verified: NOW }), null);
});

test('academic: sortKey uses ACADEMIC_PART_ORDINAL × 1000 + week', () => {
  // foundations=1, ssm-core=2, beyond-ssm=3, integration=4, synthesis=5
  assert.equal(academicChaptersRenderer.sortKey({ part: 'foundations', week: 1 }), 1001);
  assert.equal(academicChaptersRenderer.sortKey({ part: 'ssm-core', week: 3 }), 2003);
  assert.equal(academicChaptersRenderer.sortKey({ part: 'synthesis', week: 1 }), 5001);
});

test('academic: sortKey orders foundations < ssm-core < beyond-ssm < integration < synthesis', () => {
  const ord = ['foundations', 'ssm-core', 'beyond-ssm', 'integration', 'synthesis'].map((p) =>
    academicChaptersRenderer.sortKey({ part: p, week: 1 }),
  );
  for (let i = 1; i < ord.length; i++) {
    assert.ok(ord[i] > ord[i - 1], `enum position ${i} not strictly greater`);
  }
});

test('academic: sortKey unknown part sorts to end', () => {
  const known = academicChaptersRenderer.sortKey({ part: 'synthesis', week: 99 });
  const unknown = academicChaptersRenderer.sortKey({ part: 'consumer-custom', week: 1 });
  assert.ok(unknown > known);
});

// ===== Fallback renderer =====

test('fallback: dispatches to tools renderer on tools-shape data', () => {
  const data = { chapter: 3, volatility: 'feature-surface', part: 1, tools_compared: ['claude-code'] };
  assert.equal(fallbackChaptersRenderer.formatChapterNumber(data, false), 'Chapter 3');
  assert.equal(fallbackChaptersRenderer.getToolsAttr(data), 'claude-code');
  assert.equal(fallbackChaptersRenderer.sortKey(data), 1003);
});

test('fallback: dispatches to academic renderer on academic-shape data', () => {
  const data = { week: 4, status: 'implemented', part: 'beyond-ssm' };
  assert.equal(fallbackChaptersRenderer.formatChapterNumber(data, false), 'Week 4');
  assert.equal(fallbackChaptersRenderer.getToolsAttr(data), 'cross-tool');
  assert.equal(fallbackChaptersRenderer.sortKey(data), 3004); // beyond-ssm=3 × 1000 + 4
});

test('fallback: unknown shape uses tools defaults (no crash)', () => {
  const data = { title: 'Hello' };
  const k = fallbackChaptersRenderer.sortKey(data);
  assert.equal(typeof k, 'number');
  assert.ok(Number.isFinite(k));
});

// ===== Cross-renderer agreement (sort-key consistency) =====

test('cross: academic + fallback agree on sort key for academic data', () => {
  const data = { part: 'ssm-core', week: 3, status: 'implemented' };
  assert.equal(
    fallbackChaptersRenderer.sortKey(data),
    academicChaptersRenderer.sortKey(data),
  );
});

test('cross: tools + fallback agree on sort key for tools data', () => {
  const data = { part: 2, chapter: 7, volatility: 'stable-principle' };
  assert.equal(
    fallbackChaptersRenderer.sortKey(data),
    toolsChaptersRenderer.sortKey(data),
  );
});

test('cross: chapterSortKey public export agrees with renderers', () => {
  // chapterSortKey is the v3.5.2 backward-compat helper; it must continue
  // matching the per-profile renderers for shared shapes.
  const tools = { part: 2, chapter: 5 };
  const academic = { part: 'foundations', week: 3 };
  assert.equal(chapterSortKey(tools), toolsChaptersRenderer.sortKey(tools));
  assert.equal(chapterSortKey(academic), academicChaptersRenderer.sortKey(academic));
});
