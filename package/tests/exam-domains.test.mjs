/**
 * tests/exam-domains.test.mjs — node:test suite for exam-domain membership
 * validation (v4.17.0, Tier 3 #112).
 *
 * Exam domains are a per-book closed taxonomy (defineBookConfig({ examDomains }));
 * a question whose `domain` is not registered throws at build rather than
 * silently bucketing into a phantom domain — the per-book analogue of
 * <BookLink>'s unknown-book throw (lib/book-link.ts).
 *
 * Tests import from dist/. Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assertKnownDomain } from '../dist/index.mjs';

const DOMAINS = ['crypto', 'identity', 'network-security'];

test('returns the domain unchanged when it is registered', () => {
  assert.equal(assertKnownDomain(DOMAINS, 'identity', { id: 'q1' }), 'identity');
});

test('THROWS on an unknown domain, naming the question + listing known domains', () => {
  assert.throws(
    () => assertKnownDomain(DOMAINS, 'quantum', { id: 'q-7' }),
    /question "q-7".*unknown exam domain "quantum".*known: crypto, identity, network-security/s,
  );
});

test('THROWS when no examDomains registry is configured — no silent pass', () => {
  assert.throws(
    () => assertKnownDomain(undefined, 'crypto', { id: 'q1' }),
    /no examDomains configured/,
  );
  assert.throws(
    () => assertKnownDomain(null, 'crypto', { id: 'q1' }),
    /no examDomains configured/,
  );
  assert.throws(
    () => assertKnownDomain([], 'crypto', { id: 'q1' }),
    /no examDomains configured/,
  );
});

test('the throw message suggests the exact defineBookConfig remedy', () => {
  assert.throws(
    () => assertKnownDomain(DOMAINS, 'quantum', { id: 'q1' }),
    /defineBookConfig\(\{ examDomains: \["quantum", …\] \}\)/,
  );
});
