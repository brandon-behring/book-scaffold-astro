/**
 * Canonical figure palette contract (#161, #164).
 *
 * This pure manifest owns every authored RGB, host token value, and standalone
 * SVG value. `figure.mjs` derives its exact SVG mappings and embedded theme CSS
 * from it; `tokens.css` carries a checked generated block rendered below.
 * Keep semantic Warm–Tol roles separate from ordinal Okabe–Ito series.
 */

function frozenEntries(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

export const SEMANTIC_FIGURE_TOKENS = frozenEntries([
  {
    family: 'semantic', name: 'blue', token: '--fig-blue', label: 'default / lightweight',
    authoring: '#3B6FA0', hostLight: 'var(--warm-blue)', standaloneLight: '#3B6FA0',
    hostDark: '#7297BB', standaloneDark: '#7297BB',
  },
  {
    family: 'semantic', name: 'rose', token: '--fig-rose', label: 'caution / problem',
    authoring: '#C06858', hostLight: 'var(--warm-rose)', standaloneLight: '#C06858',
    hostDark: '#D29287', standaloneDark: '#D29287',
  },
  {
    family: 'semantic', name: 'green', token: '--fig-green', label: 'positive outcome',
    authoring: '#4A7E3F', hostLight: 'var(--warm-green)', standaloneLight: '#4A7E3F',
    hostDark: '#7DA275', standaloneDark: '#7DA275',
  },
  {
    family: 'semantic', name: 'plum', token: '--fig-plum', label: 'authority / heaviest',
    authoring: '#8A4E82', hostLight: 'var(--warm-plum)', standaloneLight: '#8A4E82',
    hostDark: '#AB80A5', standaloneDark: '#AB80A5',
  },
  {
    family: 'semantic', name: 'gold', token: '--fig-gold', label: 'packaging / coordination',
    // Export the canonical Warm–Tol gold; the light host value is deliberately
    // darker so an essential stroke clears 3:1 against figure paper.
    authoring: '#C09840', hostLight: '#9D7D34', standaloneLight: '#9D7D34',
    hostDark: '#D2B575', standaloneDark: '#D2B575',
  },
  {
    family: 'semantic', name: 'crimson', token: '--fig-crimson', label: 'failure / severe problem',
    authoring: '#A03838', hostLight: 'var(--warm-crimson)', standaloneLight: '#A03838',
    hostDark: '#BB7070', standaloneDark: '#BB7070',
  },
]);

export const STRUCTURAL_FIGURE_TOKENS = frozenEntries([
  {
    family: 'structural', name: 'ink', token: '--fig-ink', label: 'labels / axes / outlines',
    hostLight: 'var(--color-text)', standaloneLight: '#1A1A19',
    hostDark: 'var(--color-text)', standaloneDark: '#E8E5DD',
  },
  {
    family: 'structural', name: 'paper', token: '--fig-paper', label: 'figure background',
    hostLight: 'var(--color-bg)', standaloneLight: '#FDFCF9',
    hostDark: 'var(--color-bg)', standaloneDark: '#1A1816',
  },
  {
    family: 'structural', name: 'grid', token: '--fig-grid', label: 'essential secondary structure',
    hostLight: '#8C8981', standaloneLight: '#8C8981',
    hostDark: '#746E67', standaloneDark: '#746E67',
  },
]);

export const SERIES_FIGURE_TOKENS = frozenEntries([
  { family: 'series', ordinal: 1, name: 'orange', token: '--series-1', authoring: '#E69F00', hostLight: '#E69F00', standaloneLight: '#E69F00', hostDark: '#E69F00', standaloneDark: '#E69F00' },
  { family: 'series', ordinal: 2, name: 'sky blue', token: '--series-2', authoring: '#56B4E9', hostLight: '#56B4E9', standaloneLight: '#56B4E9', hostDark: '#56B4E9', standaloneDark: '#56B4E9' },
  { family: 'series', ordinal: 3, name: 'bluish green', token: '--series-3', authoring: '#009E73', hostLight: '#009E73', standaloneLight: '#009E73', hostDark: '#009E73', standaloneDark: '#009E73' },
  { family: 'series', ordinal: 4, name: 'yellow', token: '--series-4', authoring: '#F0E442', hostLight: '#F0E442', standaloneLight: '#F0E442', hostDark: '#F0E442', standaloneDark: '#F0E442' },
  { family: 'series', ordinal: 5, name: 'blue', token: '--series-5', authoring: '#0072B2', hostLight: '#0072B2', standaloneLight: '#0072B2', hostDark: '#0072B2', standaloneDark: '#0072B2' },
  { family: 'series', ordinal: 6, name: 'vermillion', token: '--series-6', authoring: '#D55E00', hostLight: '#D55E00', standaloneLight: '#D55E00', hostDark: '#D55E00', standaloneDark: '#D55E00' },
  { family: 'series', ordinal: 7, name: 'reddish purple', token: '--series-7', authoring: '#CC79A7', hostLight: '#CC79A7', standaloneLight: '#CC79A7', hostDark: '#CC79A7', standaloneDark: '#CC79A7' },
  {
    family: 'series', ordinal: 8, name: 'neutral ink', token: '--series-8',
    authoring: '#000000', hostLight: 'var(--fig-ink)', standaloneLight: 'var(--fig-ink)',
    hostDark: 'var(--fig-ink)', standaloneDark: 'var(--fig-ink)',
    // PDF export loses the distinction between categorical black and labels.
    // Both aliases resolve through --fig-ink, so the rendered value agrees.
    svgVariable: '--diagram-ink',
  },
]);

export const FIGURE_TOKEN_DEFINITIONS = Object.freeze([
  ...SEMANTIC_FIGURE_TOKENS,
  ...STRUCTURAL_FIGURE_TOKENS,
  ...SERIES_FIGURE_TOKENS,
]);

export const FIGURE_COMPATIBILITY_ALIASES = frozenEntries([
  { token: '--diagram-ink', value: 'var(--fig-ink)' },
  { token: '--diagram-paper', value: 'var(--fig-paper)' },
  { token: '--diagram-grid', value: 'var(--fig-grid)' },
]);

export const FIGURE_AUTHORING_COLOR_MAP = Object.freeze([
  ...SEMANTIC_FIGURE_TOKENS,
  ...SERIES_FIGURE_TOKENS,
].map((entry) => Object.freeze({
  family: entry.family,
  authoring: entry.authoring,
  token: entry.token,
  variable: entry.svgVariable ?? entry.token,
})));

export const FIGURE_TOKEN_BLOCK_START = '/* BEGIN GENERATED FIGURE TOKENS — source: src/lib/figure-palette.mjs */';
export const FIGURE_TOKEN_BLOCK_END = '/* END GENERATED FIGURE TOKENS */';

function declarations(entries, key, { comments = false } = {}) {
  return entries.map((entry) => {
    const comment = comments ? ` /* ${entry.label ?? entry.name} */` : '';
    return `  ${entry.token}: ${entry[key]};${comment}`;
  });
}

/** Render the checked block committed in styles/tokens.css. */
export function renderFigureTokenCssBlock() {
  const light = [
    ...declarations(SEMANTIC_FIGURE_TOKENS, 'hostLight', { comments: true }),
    ...declarations(STRUCTURAL_FIGURE_TOKENS, 'hostLight', { comments: true }),
    '',
    '  /* Canonical Okabe–Ito order. Never reorder ordinals per chart or theme. */',
    ...declarations(SERIES_FIGURE_TOKENS, 'hostLight', { comments: true }),
    '',
    '  /* Backward-compatible aliases used by build-figures since v4.11.0. */',
    ...FIGURE_COMPATIBILITY_ALIASES.map((entry) => `  ${entry.token}: ${entry.value};`),
  ];
  const dark = declarations(FIGURE_TOKEN_DEFINITIONS, 'hostDark');

  return [
    FIGURE_TOKEN_BLOCK_START,
    '/* Do not edit this block by hand. Semantic Warm–Tol roles and ordinal',
    ' * Okabe–Ito series are intentionally separate public contracts. */',
    ':root {',
    ...light,
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="light"]) {',
    ...dark.map((line) => `  ${line}`),
    '  }',
    '}',
    '',
    ':root[data-theme="dark"] {',
    ...dark,
    '}',
    FIGURE_TOKEN_BLOCK_END,
  ].join('\n');
}

/** Render minified defaults embedded into standalone generated SVGs. */
export function renderStandaloneFigureThemeCss() {
  const themed = (key) => FIGURE_TOKEN_DEFINITIONS
    .map((entry) => `${entry.token}:${entry[key]}`)
    .join(';');
  const aliases = FIGURE_COMPATIBILITY_ALIASES
    .map((entry) => `${entry.token}:${entry.value}`)
    .join(';');
  return `:root{${themed('standaloneLight')};${aliases}}` +
    `@media (prefers-color-scheme:dark){:root{${themed('standaloneDark')}}}`;
}
