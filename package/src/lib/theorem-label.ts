/**
 * theorem-label — resolve a `<Theorem>` component's label from its props,
 * failing loud instead of rendering a silent empty label (#121).
 *
 * Vocabulary: `kind` is canonical; `type` is an accepted **legacy alias** (many
 * consumer books — ssm-foundations ch1–11 — and the LaTeX `\begin{<env>}`
 * mental model pass `type=`). Likewise `name` is canonical with `title`/`label`
 * accepted as aliases. Aliases keep existing content valid; they are synonyms,
 * not deprecations, so they neither warn nor throw.
 *
 * Failure mode: an absent or unrecognized kind THROWS a build-failing,
 * actionable error rather than computing `KIND_LABEL[undefined]` → a bare "."
 * (the v4.8–4.14 silent defect, live across 32+ ssm-foundations theorems). A
 * typo'd kind — silent before — now stops the build with the offending value.
 *
 * Extracted from the `Theorem.astro` frontmatter so the contract is unit-tested
 * in the pure `node --test` suite (see tests/theorem-label.test.mjs) — the same
 * single-source-of-truth move as `academic-parts.ts` (#95).
 */

export const THEOREM_KINDS = [
  'theorem',
  'proposition',
  'lemma',
  'corollary',
  'definition',
  'example',
  'exercise',
  'remark',
  'proof',
] as const;

export type TheoremKind = (typeof THEOREM_KINDS)[number];

export const KIND_LABEL: Record<TheoremKind, string> = {
  theorem: 'Theorem',
  proposition: 'Proposition',
  lemma: 'Lemma',
  corollary: 'Corollary',
  definition: 'Definition',
  example: 'Example',
  exercise: 'Exercise',
  remark: 'Remark',
  proof: 'Proof',
};

export interface TheoremLabelProps {
  /** Canonical environment selector. */
  kind?: string;
  /** Legacy alias for `kind` (LaTeX-env mental model; ssm-foundations ch1–11). */
  type?: string;
  /** Explicit number, e.g. "4.2"; omit for an unnumbered environment. */
  n?: string;
  /** Canonical display name shown in parentheses. */
  name?: string;
  /** Legacy aliases for `name`. */
  title?: string;
  label?: string;
}

export interface ResolvedTheoremLabel {
  /** The validated, canonical kind (for `data-kind`). */
  kind: TheoremKind;
  /** The composed "Kind N (Name)" label (never empty). */
  fullLabel: string;
}

function isTheoremKind(value: string | undefined): value is TheoremKind {
  return value !== undefined && (THEOREM_KINDS as readonly string[]).includes(value);
}

/**
 * Resolve a `<Theorem>`'s `kind` (canonical or legacy `type=`) and compose its
 * full label. Throws — never returns an empty label — when the kind is absent
 * or not one of {@link THEOREM_KINDS}.
 */
export function theoremLabel(props: TheoremLabelProps): ResolvedTheoremLabel {
  const raw = props.kind ?? props.type;
  if (!isTheoremKind(raw)) {
    const detail =
      raw === undefined
        ? 'no kind= (or legacy type=) prop was passed'
        : `kind="${raw}" is not one of ${THEOREM_KINDS.join(', ')}`;
    const hint =
      props.type !== undefined && props.kind === undefined
        ? ' (you passed type=; kind= is canonical, type= is accepted)'
        : '';
    throw new Error(
      `<Theorem>: cannot resolve a label — ${detail}. ` +
        `Pass a valid kind, e.g. kind="theorem"${hint}.`,
    );
  }

  const name = props.name ?? props.title ?? props.label;
  const numbered = props.n ? `${KIND_LABEL[raw]} ${props.n}` : KIND_LABEL[raw];
  const fullLabel = name ? `${numbered} (${name})` : numbered;
  return { kind: raw, fullLabel };
}
