/**
 * tests/academic-parts.test.mjs — node:test suite for the single source of
 * truth for academic-profile part labels (v4.14.0, #95).
 *
 * Before v4.14.0 the enum→label map lived in three places (the /chapters
 * renderer, Sidebar.astro, ChapterHeader.astro) and had diverged on
 * `beyond-ssm` (singular "Beyond SSM" on the index vs plural "Beyond SSMs"
 * in the nav). These assertions lock in the consolidation:
 *
 *   - academicPartHeading() reproduces the OLD hardcoded Sidebar/ChapterHeader
 *     strings byte-for-byte for all five parts (the byte-identical proof —
 *     so visual baselines for those two surfaces are provably unchanged), and
 *   - the unknown/custom-part fallback is now consistent (titleCase, no
 *     ordinal) across name and heading.
 *
 * Tests import from dist/ since node:test can't load TS. Run after build:
 *   node --test tests/academic-parts.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ACADEMIC_PART_NAMES,
  academicPartName,
  academicPartHeading,
  academicPartOrdinal,
  UNKNOWN_PART_ORDINAL,
} from '../dist/index.mjs';

test('ACADEMIC_PART_NAMES: five known parts, beyond-ssm is plural (#95)', () => {
  assert.deepEqual(ACADEMIC_PART_NAMES, {
    foundations: 'Foundations',
    'ssm-core': 'SSM Core',
    'beyond-ssm': 'Beyond SSMs',
    integration: 'Integration',
    synthesis: 'Synthesis',
  });
});

test('academicPartName: bare names for the /chapters index; titleCase fallback', () => {
  assert.equal(academicPartName('foundations'), 'Foundations');
  assert.equal(academicPartName('ssm-core'), 'SSM Core');
  assert.equal(academicPartName('beyond-ssm'), 'Beyond SSMs');
  assert.equal(academicPartName('integration'), 'Integration');
  assert.equal(academicPartName('synthesis'), 'Synthesis');
  // unknown/custom part → titleCase (no map entry)
  assert.equal(academicPartName('consumer-custom'), 'Consumer Custom');
});

test('academicPartHeading: byte-identical to the pre-v4.14.0 nav strings (#95)', () => {
  // These five literals are the exact strings Sidebar.astro + ChapterHeader.astro
  // hardcoded before the consolidation — reproducing them proves those two
  // surfaces render unchanged, so their visual baselines need no regeneration.
  assert.equal(academicPartHeading('foundations'), 'Part I · Foundations');
  assert.equal(academicPartHeading('ssm-core'), 'Part II · SSM Core');
  assert.equal(academicPartHeading('beyond-ssm'), 'Part III · Beyond SSMs');
  assert.equal(academicPartHeading('integration'), 'Part IV · Integration');
  assert.equal(academicPartHeading('synthesis'), 'Part V · Synthesis');
});

test('academicPartHeading: unknown/custom part → titleCase, no ordinal prefix', () => {
  // Unified fallback: unknown parts have no position in academicParts, so no
  // "Part {roman}" prefix — replaces the old divergent fallbacks (Sidebar's
  // raw key, ChapterHeader's "Part: key").
  assert.equal(academicPartHeading('consumer-custom'), 'Consumer Custom');
});

test('academicPartOrdinal: 1-based academicParts position; UNKNOWN for custom (#99)', () => {
  // These five MUST equal the old hardcoded { foundations: 1 … synthesis: 5 }
  // maps removed from academic-chapters.ts + chapter-sort.ts, so the on-page
  // sort order is byte-preserved by the consolidation.
  assert.equal(academicPartOrdinal('foundations'), 1);
  assert.equal(academicPartOrdinal('ssm-core'), 2);
  assert.equal(academicPartOrdinal('beyond-ssm'), 3);
  assert.equal(academicPartOrdinal('integration'), 4);
  assert.equal(academicPartOrdinal('synthesis'), 5);
  // unknown/custom part sorts to the end (was UNKNOWN_PART_ORDINAL in both maps)
  assert.equal(academicPartOrdinal('consumer-custom'), UNKNOWN_PART_ORDINAL);
  assert.equal(UNKNOWN_PART_ORDINAL, 99);
});
