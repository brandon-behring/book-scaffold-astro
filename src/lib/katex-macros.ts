/**
 * src/lib/katex-macros.ts — KaTeX macro definitions ported from the LaTeX guide.
 *
 * Source files in the LaTeX tree:
 *   - guides/shared/ssm-notation.tex   (20 SSM-specific macros)
 *   - guides/shared/ssm-guide-preamble.sty:387-413  (16 general math macros)
 *
 * Wired into astro.config.mjs via:
 *   rehypeKatex({ strict: 'error', macros: ssmMacros, trust: true })
 *
 * KaTeX-specific adaptations:
 *   - \bm is not part of KaTeX; aliased to \boldsymbol (visually identical
 *     in stix-two / Computer Modern math fonts).
 *   - \DeclareMathOperator and \DeclareMathOperator* are translated to
 *     \operatorname / \operatorname* respectively.
 *   - \psmallmatrix is an environment in amsmath, not a macro. KaTeX
 *     macros operate at command level; substitution happens in the
 *     converter script (latex-to-mdx.mjs in Phase 2.7) — search for
 *     \begin{psmallmatrix} and replace with \begin{pmatrix}.
 *
 * Equation numbering is handled by a separate remark plugin (deferred to
 * a follow-up session per plan Phase 2.1 Task #9).
 */

export const ssmMacros: Record<string, string> = {
  // -----------------------------------------------------------------
  // Compatibility alias: \bm{x} -> \boldsymbol{x}
  // KaTeX does not ship \bm. The LaTeX source uses \bm extensively in
  // ssm-notation.tex for vectors and matrices.
  // -----------------------------------------------------------------
  '\\bm': '\\boldsymbol{#1}',

  // -----------------------------------------------------------------
  // SSM state space variables (ssm-notation.tex:5-13)
  // -----------------------------------------------------------------
  '\\statevec': '\\boldsymbol{h}', // state vector h_t
  '\\statemat': '\\boldsymbol{A}', // dynamics matrix A
  '\\inputmat': '\\boldsymbol{B}', // input matrix B
  '\\outputmat': '\\boldsymbol{C}', // output matrix C
  '\\feedmat': '\\boldsymbol{D}', // feedthrough matrix D
  '\\stepsize': '\\Delta', // discretization step
  '\\discA': '\\bar{\\boldsymbol{A}}', // discretized A
  '\\discB': '\\bar{\\boldsymbol{B}}', // discretized B

  // -----------------------------------------------------------------
  // Dimensions (ssm-notation.tex:16-18)
  // -----------------------------------------------------------------
  '\\seqlen': 'L', // sequence length
  '\\statedim': 'N', // state dimension
  '\\inputdim': 'D', // input / model dimension

  // -----------------------------------------------------------------
  // Scan operator (ssm-notation.tex:23-24)
  // -----------------------------------------------------------------
  '\\scanop': '\\oplus', // associative binary operator for diagonal SSMs
  '\\elemwise': '\\odot', // element-wise product

  // -----------------------------------------------------------------
  // Dynamical systems (ssm-notation.tex:27-30)
  // -----------------------------------------------------------------
  '\\monodromy': '\\boldsymbol{Z}', // monodromy matrix Z(T)
  '\\floquet': '\\mu', // Floquet multiplier
  '\\lyapexp': '\\lambda', // Lyapunov exponent
  '\\jacobian': '\\boldsymbol{J}', // Jacobian matrix

  // -----------------------------------------------------------------
  // Calculus shortcuts (ssm-notation.tex:33-35)
  // -----------------------------------------------------------------
  '\\ddt': '\\frac{d}{dt}',
  '\\pderiv': '\\frac{\\partial #1}{\\partial #2}', // 2 args
  '\\spectralradius': '\\rho',

  // -----------------------------------------------------------------
  // Common sets (preamble:390-393)
  // -----------------------------------------------------------------
  '\\R': '\\mathbb{R}',
  '\\C': '\\mathbb{C}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',

  // -----------------------------------------------------------------
  // Probability / statistics (preamble:396-397)
  // -----------------------------------------------------------------
  '\\E': '\\mathbb{E}',
  '\\Prob': '\\mathbb{P}',

  // -----------------------------------------------------------------
  // Norms and inner products (preamble:400-402)
  // -----------------------------------------------------------------
  '\\norm': '\\lVert #1 \\rVert',
  '\\ip': '\\langle #1, #2 \\rangle',
  '\\abs': '\\lvert #1 \\rvert',

  // -----------------------------------------------------------------
  // Operators (preamble:405-410)
  // \DeclareMathOperator* -> \operatorname* (with limits below in display)
  // \DeclareMathOperator  -> \operatorname
  // -----------------------------------------------------------------
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\argmin': '\\operatorname*{arg\\,min}',
  '\\diag': '\\operatorname{diag}',
  '\\tr': '\\operatorname{tr}',
  '\\spec': '\\operatorname{spec}',
  '\\rank': '\\operatorname{rank}',

  // -----------------------------------------------------------------
  // Complexity (preamble:413)
  // -----------------------------------------------------------------
  '\\bigO': '\\mathcal{O}(#1)',
};
