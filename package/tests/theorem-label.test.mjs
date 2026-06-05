/**
 * tests/theorem-label.test.mjs — node:test suite for the fail-loud Theorem
 * label resolver (v4.14.3, #121).
 *
 * Before this, components/Theorem.astro computed `KIND_LABEL[props.kind]` with
 * `kind` required — but ssm-foundations ch1–11 (32+ theorems) and the LaTeX
 * `\begin{<env>}` mental model pass `type=`/`title=`, so `kind` was undefined
 * and every label rendered as a bare "." — a SILENT production defect. The fix
 * extracts the logic into a pure `theoremLabel()` that (a) accepts
 * `type`/`title`/`label` as legacy aliases so existing content renders, and
 * (b) THROWS on an unresolvable kind instead of returning an empty label.
 *
 * Tests import from dist/ since node:test can't load TS. Run after build:
 *   npm run build && node --test tests/theorem-label.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { theoremLabel, resolveTheoremNumber, THEOREM_KINDS, KIND_LABEL } from '../dist/index.mjs';

test('theoremLabel: canonical kind= resolves the label', () => {
  assert.equal(theoremLabel({ kind: 'theorem' }).fullLabel, 'Theorem');
  assert.equal(theoremLabel({ kind: 'definition' }).fullLabel, 'Definition');
  assert.equal(theoremLabel({ kind: 'proof' }).kind, 'proof');
});

test('theoremLabel: legacy type= aliases kind= so existing books render (#121)', () => {
  assert.equal(theoremLabel({ type: 'theorem' }).fullLabel, 'Theorem');
  assert.equal(theoremLabel({ type: 'proposition' }).fullLabel, 'Proposition');
  // kind= wins when both present
  assert.equal(theoremLabel({ kind: 'lemma', type: 'remark' }).kind, 'lemma');
});

test('theoremLabel: number + name/title/label aliases compose the full label', () => {
  assert.equal(
    theoremLabel({ kind: 'theorem', n: '4.2', name: 'Stable eigenvalues' }).fullLabel,
    'Theorem 4.2 (Stable eigenvalues)',
  );
  assert.equal(
    theoremLabel({ type: 'definition', n: '4.1', title: 'HiPPO-LegS' }).fullLabel,
    'Definition 4.1 (HiPPO-LegS)',
  );
  assert.equal(theoremLabel({ kind: 'lemma', label: 'Custom' }).fullLabel, 'Lemma (Custom)');
});

test('theoremLabel: THROWS on absent kind/type — no silent empty label (#121)', () => {
  assert.throws(() => theoremLabel({}), /Theorem/);
  assert.throws(() => theoremLabel({ name: 'orphan', n: '1' }), /kind/);
});

test('theoremLabel: THROWS on an unknown kind value — catches typos', () => {
  assert.throws(() => theoremLabel({ kind: 'thereom' }), /thereom|not one of/);
  assert.throws(() => theoremLabel({ type: 'lemmas' }), /lemmas|not one of/);
});

test('THEOREM_KINDS + KIND_LABEL: nine amsthm environments, stable contract', () => {
  assert.equal(THEOREM_KINDS.length, 9);
  assert.equal(KIND_LABEL.corollary, 'Corollary');
  assert.equal(KIND_LABEL.proof, 'Proof');
});

test('theoremLabel: word-only resolution (no n/name) — the form build-labels reuses (#126)', () => {
  // build-labels derives the kind-aware xref word via theoremLabel({kind}).fullLabel,
  // so heading and cross-reference agree on the kind word, not just the number.
  assert.equal(theoremLabel({ kind: 'proposition' }).fullLabel, 'Proposition');
  assert.equal(theoremLabel({ kind: 'lemma' }).fullLabel, 'Lemma');
  assert.equal(theoremLabel({ type: 'corollary' }).fullLabel, 'Corollary'); // legacy alias
});

test('resolveTheoremNumber: labels.json number wins; n= is the fallback (#126)', () => {
  // THE #126 guarantee: when an id resolves in labels.json, the index wins over
  // a stale hand-passed n= — so heading and <XRef> can never disagree.
  assert.equal(resolveTheoremNumber({ number: '9.5' }, '4.2'), '9.5');
  // No entry (un-id'd theorem, or labels.json not built) → explicit n= fallback.
  assert.equal(resolveTheoremNumber(undefined, '4.2'), '4.2');
  // label= override (number:null) with an explicit n= → falls through to n=.
  assert.equal(resolveTheoremNumber({ number: null }, '4.2'), '4.2');
  // number:null and no n= → undefined (unnumbered, not the string "null").
  assert.equal(resolveTheoremNumber({ number: null }, undefined), undefined);
  // Neither → undefined.
  assert.equal(resolveTheoremNumber(undefined, undefined), undefined);
});
