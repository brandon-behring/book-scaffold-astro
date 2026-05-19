/**
 * tests/freshness.test.mjs — node:test suite for src/lib/freshness.ts.
 *
 * Run after `npm run build`: tests import from dist/ since node:test can't
 * load TS directly. Covers the v3.3.0 tolerant signature (undefined input
 * returns null) + the three status bands.
 *
 * Run: node --test tests/freshness.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getFreshness, freshnessLabel } from '../dist/index.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const fixed = (offsetDays) => new Date(Date.UTC(2026, 0, 1) - offsetDays * DAY_MS);
const NOW = new Date(Date.UTC(2026, 0, 1));

test('freshness: undefined lastVerified returns null (closes #1)', () => {
  const result = getFreshness(undefined, 'feature-surface', NOW);
  assert.equal(result, null);
});

test('freshness: non-Date lastVerified returns null', () => {
  // Hostile inputs that the type system forbids but real consumers hit.
  const result = getFreshness(/** @type {any} */ ('2026-01-01'), 'feature-surface', NOW);
  assert.equal(result, null);
});

test('freshness: fresh status when daysOld < 75% of threshold', () => {
  // feature-surface threshold = 90; 75% = 67.5 days. 60 days old → fresh.
  const result = getFreshness(fixed(60), 'feature-surface', NOW);
  assert.notEqual(result, null);
  assert.equal(result.status, 'fresh');
  assert.equal(result.daysOld, 60);
  assert.equal(result.thresholdDays, 90);
});

test('freshness: verify-soon status when 75% <= daysOld < 100%', () => {
  // feature-surface threshold = 90; 75-89 → verify-soon. 80 days old.
  const result = getFreshness(fixed(80), 'feature-surface', NOW);
  assert.notEqual(result, null);
  assert.equal(result.status, 'verify-soon');
  assert.equal(result.daysOld, 80);
});

test('freshness: stale status when daysOld >= threshold', () => {
  // feature-surface threshold = 90; 100 days old → stale.
  const result = getFreshness(fixed(100), 'feature-surface', NOW);
  assert.notEqual(result, null);
  assert.equal(result.status, 'stale');
  assert.equal(result.daysOld, 100);
  assert.equal(result.daysUntil, -10);
});

test('freshness: stable-principle has 365-day threshold', () => {
  // 200 days old < 75% of 365 (273) → still fresh
  const result = getFreshness(fixed(200), 'stable-principle', NOW);
  assert.equal(result.status, 'fresh');
});

test('freshness: architectural-pattern has 180-day threshold', () => {
  // 150 days old; 75% of 180 = 135 → verify-soon
  const result = getFreshness(fixed(150), 'architectural-pattern', NOW);
  assert.equal(result.status, 'verify-soon');
});

test('freshnessLabel: returns sentinel string for null input', () => {
  assert.equal(freshnessLabel(null), 'Verification status unknown');
});

test('freshnessLabel: renders status-specific text for non-null', () => {
  const fresh = getFreshness(fixed(10), 'feature-surface', NOW);
  const label = freshnessLabel(fresh);
  assert.match(label, /^Fresh \(10d old/);
});
