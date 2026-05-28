/**
 * tests/provenance-component.test.mjs — source-contract tests for the v4.8.0
 * Provenance.astro component + its route-layer wiring.
 *
 * Same pattern as book-genre-components.test.mjs / pedagogy-callouts.test.mjs:
 * assert on the .astro source (Props, logic-bearing literals, render branches).
 * These lock the render contract that the schema tests can't reach and that the
 * visual suite does NOT cover (the visual fixtures define their own chapter
 * routes that shadow the package-injected route, so they never render this
 * block). Full DOM proof lives in the demo build (grepped at release).
 *
 * Run: node --test tests/provenance-component.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = join(__dirname, '..');
const component = readFileSync(join(PKG, 'components', 'Provenance.astro'), 'utf8');
const route = readFileSync(join(PKG, 'pages', 'chapters', '[...slug].astro'), 'utf8');

// ===== Props contract =====

test('Provenance: Props.data is `Provenance | null`', () => {
  assert.match(component, /data:\s*Provenance\s*\|\s*null/);
});

// ===== Opt-out fallback (the headline behavior) =====

test('Provenance: renders the opt-out fallback string', () => {
  assert.match(component, /Audit history not yet recorded/);
});

test('Provenance: gates the populated block on a hasContent disjunction', () => {
  assert.match(component, /const hasContent\s*=/);
  // hasContent OR-s the substantive fields → fallback only when all empty.
  assert.match(component, /hasContent\s*\?/);
});

// ===== Claim-safety: relative paths render as <code>, only http(s) link =====

test('Provenance: isUrl uses an anchored https? test (no dead links)', () => {
  assert.match(component, /isUrl\s*=/);
  assert.match(component, /\^https\?:/);
});

test('Provenance: references use the isUrl ? <a> : <code> decision', () => {
  assert.match(component, /isUrl\(promptsArchive\)/);
  assert.match(component, /isUrl\(decisionsLog\)/);
  assert.match(component, /<code>\{promptsArchive\}<\/code>/);
});

test('Provenance: audit file uses the same link/code decision', () => {
  assert.match(component, /isUrl\(a\.file\)/);
});

// ===== Teaser digest (signal visible while collapsed) =====

test('Provenance: teaser falls back to bare "How this was made"', () => {
  assert.match(component, /How this was made/);
  assert.match(component, /teaserParts/);
});

test('Provenance: teaser pluralizes audits and prefers audits over tools', () => {
  assert.match(component, /audits\.length > 1 \? 's' : ''/);
  // ai_tools only contributes when there are no audits/backstop parts yet.
  assert.match(component, /!teaserParts\.length && aiTools\.length/);
});

// ===== House style =====

test('Provenance: collapsible native <details>, warm-plum aside', () => {
  assert.match(component, /<aside class="provenance"/);
  assert.match(component, /<details class="provenance-details">/);
});

test('Provenance: citation_backstop drives a backstop-* badge class', () => {
  assert.match(component, /backstop-\$\{backstop\}/);
});

test('Provenance: dates formatted as YYYY-MM-DD', () => {
  assert.match(component, /toISOString\(\)\.slice\(0, 10\)/);
});

// ===== Route wiring (the injection the visual fixtures bypass) =====

test('route: imports the Provenance component', () => {
  assert.match(route, /from '\.\.\/\.\.\/components\/Provenance\.astro'/);
});

test('route: renders <ProvenanceBlock> with the chapter provenance', () => {
  assert.match(route, /<ProvenanceBlock\s+data=/);
  assert.match(route, /entry\.data[\s\S]*provenance/);
});
