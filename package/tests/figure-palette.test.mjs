/**
 * Figure palette contract (#161, #164).
 *
 * Locks the public token names/values, exact PDF→SVG palette recognition,
 * standalone light/dark defaults, and graphical contrast of semantic roles.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIAGRAM_THEME_CSS,
  assembleSvg,
  figureColorVariable,
  recolorSvg,
} from '../src/lib/figure.mjs';
import {
  FIGURE_TOKEN_BLOCK_END,
  FIGURE_TOKEN_BLOCK_START,
  FIGURE_TOKEN_DEFINITIONS,
  SEMANTIC_FIGURE_TOKENS,
  SERIES_FIGURE_TOKENS,
  STRUCTURAL_FIGURE_TOKENS,
  renderFigureTokenCssBlock,
} from '../src/lib/figure-palette.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8');

const WARM_TOL_AUTHORING = SEMANTIC_FIGURE_TOKENS.map(
  ({ authoring, token }) => [authoring, token],
);

const OKABE_ITO = SERIES_FIGURE_TOKENS.slice(0, 7).map(
  ({ authoring, token }) => [authoring, token],
);

function token(name) {
  const entry = FIGURE_TOKEN_DEFINITIONS.find(({ token: candidate }) => candidate === name);
  assert.ok(entry, `palette manifest is missing ${name}`);
  return entry;
}

const contrastRoles = [
  ...SEMANTIC_FIGURE_TOKENS,
  ...STRUCTURAL_FIGURE_TOKENS.filter(({ token }) => token !== '--fig-paper'),
];

const FIGURE_THEME_VALUES = {
  light: {
    paper: token('--fig-paper').standaloneLight,
    roles: Object.fromEntries(contrastRoles.map((entry) => [entry.token, entry.standaloneLight])),
  },
  dark: {
    paper: token('--fig-paper').standaloneDark,
    roles: Object.fromEntries(contrastRoles.map((entry) => [entry.token, entry.standaloneDark])),
  },
};

function declarationCount(name) {
  return (TOKENS_CSS.match(new RegExp(`${name.replace(/-/g, '\\-')}\\s*:`, 'g')) || []).length;
}

function rgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function relativeLuminance(hex) {
  return rgb(hex)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

test('tokens.css exposes semantic figure and categorical series contracts in both dark paths', () => {
  const names = FIGURE_TOKEN_DEFINITIONS.map(({ token }) => token);

  for (const name of names) {
    assert.equal(
      declarationCount(name),
      3,
      `${name} must have a light declaration plus OS-dark and explicit-dark declarations`,
    );
  }

  assert.match(TOKENS_CSS, /--series-8:\s*var\(--fig-ink\)/, 'series 8 follows theme ink');
  assert.match(TOKENS_CSS, /--diagram-ink:\s*var\(--fig-ink\)/, 'legacy diagram role aliases fig ink');
  assert.match(TOKENS_CSS, /--diagram-paper:\s*var\(--fig-paper\)/, 'legacy diagram role aliases fig paper');
  assert.match(TOKENS_CSS, /--diagram-grid:\s*var\(--fig-grid\)/, 'legacy diagram role aliases fig grid');

  for (const [hex, variable] of OKABE_ITO) {
    const declarations = TOKENS_CSS.match(new RegExp(`${variable}:\\s*${hex}`, 'gi')) || [];
    assert.equal(declarations.length, 3, `${variable} keeps its canonical ordinal value in every theme`);
  }
  for (const [variable, hex] of Object.entries(FIGURE_THEME_VALUES.dark.roles)) {
    if (variable === '--fig-ink') continue; // host CSS deliberately aliases --color-text
    const declarations = TOKENS_CSS.match(new RegExp(`${variable}:\\s*${hex}`, 'gi')) || [];
    assert.equal(declarations.length, 2, `${variable} has the documented value in both dark selectors`);
  }
});

test('tokens.css generated block exactly matches the canonical palette manifest', () => {
  const start = TOKENS_CSS.indexOf(FIGURE_TOKEN_BLOCK_START);
  const endStart = TOKENS_CSS.indexOf(FIGURE_TOKEN_BLOCK_END, start);
  assert.ok(start >= 0, 'generated figure-token start marker is present');
  assert.ok(endStart >= 0, 'generated figure-token end marker is present');
  const actual = TOKENS_CSS.slice(start, endStart + FIGURE_TOKEN_BLOCK_END.length);
  assert.equal(actual, renderFigureTokenCssBlock());
});

test('palette manifest keeps Warm–Tol meaning separate from Okabe–Ito ordinals', () => {
  assert.ok(SEMANTIC_FIGURE_TOKENS.every(({ token }) => token.startsWith('--fig-')));
  assert.ok(
    SEMANTIC_FIGURE_TOKENS.every(({ hostLight }) => /^#[0-9A-F]{6}$/i.test(hostLight)),
    'semantic light values are owned directly by the figure manifest, not aliased to a second palette',
  );
  assert.deepEqual(
    SERIES_FIGURE_TOKENS.map(({ token }) => token),
    Array.from({ length: 8 }, (_, index) => `--series-${index + 1}`),
  );
  assert.equal(token('--series-8').svgVariable, '--diagram-ink');
  assert.equal(token('--series-8').hostLight, 'var(--fig-ink)');
  assert.equal(token('--series-8').hostDark, 'var(--fig-ink)');
});

test('known authoring colors map exactly before neutral/saturation classification', () => {
  for (const [color, variable] of [...WARM_TOL_AUTHORING, ...OKABE_ITO]) {
    assert.equal(figureColorVariable(color), variable, `${color} should map to ${variable}`);
    assert.equal(figureColorVariable(color.toLowerCase()), variable, 'hex matching is case-insensitive');
  }

  assert.equal(
    figureColorVariable('rgb(23.137255%, 43.529412%, 62.745098%)'),
    '--fig-blue',
    'Poppler percentage spelling rounds to canonical Warm–Tol blue',
  );
  assert.equal(figureColorVariable('rgb(0, 114, 178)'), '--series-5');
  assert.equal(
    figureColorVariable('#000000'),
    '--diagram-ink',
    'canonical series-8 black is structurally indistinguishable from ink after export',
  );
  assert.equal(figureColorVariable('#D020F0'), null, 'unknown saturated colors remain authored');
});

test('base color plus opacity stays semantic and dual-theme after SVG export', () => {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60">' +
    '<rect fill="rgb(23.137255%, 43.529412%, 62.745098%)" fill-opacity="0.14" ' +
    'stroke="#3B6FA0" x="1" y="1" width="50" height="40"/>' +
    '<path fill="none" stroke="#0072B2" d="M60 40 L115 5"/>' +
    '</svg>';
  const built = recolorSvg(source);

  assert.match(built, /fill:var\(--fig-blue, rgb\(23\.137255%, 43\.529412%, 62\.745098%\)\)/);
  assert.match(built, /stroke:var\(--fig-blue, #3B6FA0\)/);
  assert.match(built, /stroke:var\(--series-5, #0072B2\)/);
  assert.match(built, /fill-opacity="0\.14"/, 'opacity remains separate instead of becoming a pale RGB');
  assert.match(built, /--fig-blue:#3B6FA0/, 'standalone SVG includes light role');
  assert.match(built, /--fig-blue:#7297BB/, 'standalone SVG includes dark role');

  const inlined = assembleSvg(built, {
    caption: 'Two theme-aware categories',
    desc: 'A blue semantic node and a categorical series line.',
    idBase: 'palette-proof',
  });
  assert.ok(!inlined.includes('data-diagram-theme'), 'host tokens become the sole theme source');
  assert.match(inlined, /var\(--fig-blue/, 'semantic map survives inlining');
  assert.match(inlined, /var\(--series-5/, 'categorical map survives inlining');
  assert.match(inlined, /<title id="palette-proof-title">Two theme-aware categories<\/title>/);
  assert.match(inlined, /<desc id="palette-proof-desc">A blue semantic node and a categorical series line\.<\/desc>/);
});

test('standalone SVG defaults contain the complete light/dark palette', () => {
  for (const [, variable] of [...WARM_TOL_AUTHORING, ...OKABE_ITO]) {
    assert.ok(DIAGRAM_THEME_CSS.includes(`${variable}:`), `${variable} embedded for standalone SVGs`);
  }
  assert.match(DIAGRAM_THEME_CSS, /--series-8:var\(--fig-ink\)/);
  assert.match(DIAGRAM_THEME_CSS, /@media \(prefers-color-scheme:dark\)/);
  assert.equal((DIAGRAM_THEME_CSS.match(/--fig-blue:/g) || []).length, 2, 'fig blue has light + dark values');
  assert.equal((DIAGRAM_THEME_CSS.match(/--series-1:/g) || []).length, 2, 'series 1 is explicit in both themes');
  for (const theme of Object.values(FIGURE_THEME_VALUES)) {
    assert.ok(DIAGRAM_THEME_CSS.includes(`--fig-paper:${theme.paper}`));
    for (const [variable, hex] of Object.entries(theme.roles)) {
      assert.ok(DIAGRAM_THEME_CSS.includes(`${variable}:${hex}`), `${variable} embeds ${hex}`);
    }
  }
});

test('semantic figure strokes and structural roles clear 3:1 against their paper', () => {
  for (const [name, theme] of Object.entries(FIGURE_THEME_VALUES)) {
    for (const color of Object.values(theme.roles)) {
      assert.ok(
        contrast(color, theme.paper) >= 3,
        `${name} ${color} should clear WCAG non-text contrast against ${theme.paper}`,
      );
    }
  }
});

test('Okabe–Ito ordinal hues stay canonical, ordered, and distinct', () => {
  const expected = OKABE_ITO.map(([hex]) => hex);
  assert.deepEqual(expected, [
    '#E69F00',
    '#56B4E9',
    '#009E73',
    '#F0E442',
    '#0072B2',
    '#D55E00',
    '#CC79A7',
  ]);
  assert.equal(new Set(expected).size, expected.length, 'no chromatic ordinal is duplicated');
  for (const color of expected) {
    assert.ok(contrast(color, FIGURE_THEME_VALUES.dark.paper) >= 3, `${color} stays visible on dark paper`);
  }
});
