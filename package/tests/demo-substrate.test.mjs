/** Regression coverage for the opt-in interactive-demo substrate (#143). */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import render from 'preact-render-to-string';
import { h } from 'preact';
import {
  DemoFrame,
  Slider,
  StatCards,
  useThemeColors,
} from '../dist/demo.mjs';

const css = readFileSync(new URL('../styles/demo.css', import.meta.url), 'utf8');
const hookSource = readFileSync(
  new URL('../components/demo/useThemeColors.ts', import.meta.url),
  'utf8',
);
const baseSource = readFileSync(new URL('../layouts/Base.astro', import.meta.url), 'utf8');

test('DemoFrame owns figure naming, description, and caption semantics', () => {
  const html = render(h(DemoFrame, {
    id: 'sampling-demo',
    title: 'Sampling distribution',
    description: 'Adjust the sample size.',
    caption: 'A consumer-owned simulation.',
    children: h('svg', { role: 'img', 'aria-label': 'A dot plot' }),
  }));

  assert.match(html, /^<figure id="sampling-demo" class="demo-frame"/);
  assert.match(html, /aria-labelledby="sampling-demo-title"/);
  assert.match(html, /aria-describedby="sampling-demo-description sampling-demo-caption"/);
  assert.match(html, /<h3 id="sampling-demo-title" class="demo-frame__title">Sampling distribution<\/h3>/);
  assert.match(html, /<figcaption id="sampling-demo-caption" class="demo-frame__caption">/);
  assert.match(html, /<svg role="img" aria-label="A dot plot"><\/svg>/);

  const generated = render(h(DemoFrame, { title: 'Generated relationship' }));
  const labelledBy = generated.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(labelledBy, 'a frame without id must generate an aria-labelledby target');
  assert.match(generated, new RegExp(`id="${labelledBy}"`));
});

test('DemoFrame fails loudly for invalid accessible text and ids', () => {
  assert.throws(() => render(h(DemoFrame, { title: '   ' })), /title must be a non-empty string/);
  assert.throws(
    () => render(h(DemoFrame, { id: 'not valid', title: 'Valid title' })),
    /id must not contain whitespace/,
  );
  assert.throws(
    () => render(h(DemoFrame, { title: 'Valid title', caption: '' })),
    /caption must be a non-empty string/,
  );
});

test('Slider renders a visible label, output, description, and spoken value', () => {
  const html = render(h(Slider, {
    id: 'sample-size',
    label: 'Sample size',
    description: 'Number of observations per draw.',
    min: 10,
    max: 100,
    step: 10,
    value: 20,
    onValueChange() {},
    formatValue: (value) => `${value}%`,
    getValueText: (value) => `${value} percent`,
  }));

  assert.match(html, /<label class="demo-slider__label" for="sample-size">Sample size<\/label>/);
  assert.match(html, /<output class="demo-slider__value" for="sample-size">20%<\/output>/);
  assert.match(html, /aria-describedby="sample-size-description"/);
  assert.match(html, /aria-valuetext="20 percent"/);
  assert.match(html, /type="range"/);

  const generated = render(h(Slider, {
    label: 'Generated control relationship',
    min: 0,
    max: 1,
    value: 0,
    onValueChange() {},
  }));
  const generatedId = generated.match(/<input id="([^"]+)"/)?.[1];
  assert.ok(generatedId, 'a slider without id must generate an input id');
  assert.match(generated, new RegExp(`for="${generatedId}"`));
});

test('Slider validates numeric bounds and formatter output', () => {
  const props = {
    label: 'Sample size',
    min: 1,
    max: 10,
    value: 2,
    onValueChange() {},
  };
  assert.throws(() => render(h(Slider, { ...props, max: 1 })), /max must be greater than min/);
  assert.throws(() => render(h(Slider, { ...props, value: 11 })), /must be within \[1, 10\]/);
  assert.throws(
    () => render(h(Slider, { ...props, formatValue: () => '' })),
    /formatValue must return a non-empty string/,
  );
  assert.throws(
    () => render(h(Slider, { ...props, onValueChange: null })),
    /onValueChange must be a function/,
  );
});

test('StatCards renders a semantic definition list and does not announce by default', () => {
  const html = render(h(StatCards, {
    label: 'Simulation summary',
    items: [
      { label: 'Estimate', value: '1.25', tone: 'accent' },
      { label: 'Bias', value: 0, unit: 'points', detail: 'Near zero', tone: 'positive' },
    ],
  }));

  assert.match(html, /^<dl class="demo-stat-cards" aria-label="Simulation summary" aria-live="off">/);
  assert.match(html, /<dt class="demo-stat-card__label">Estimate<\/dt>/);
  assert.match(html, /data-tone="positive"/);
  assert.match(html, /<span class="demo-stat-card__unit">points<\/span>/);
  assert.doesNotMatch(html, /role="status"/);

  const polite = render(h(StatCards, {
    live: 'polite',
    items: [{ label: 'Runs complete', value: 25 }],
  }));
  assert.match(polite, /^<dl class="demo-stat-cards" aria-label="Key statistics" aria-live="polite"/);
  assert.doesNotMatch(polite, /role="status"/);
});

test('StatCards rejects empty, non-finite, and duplicate statistics', () => {
  assert.throws(() => render(h(StatCards, { items: [] })), /at least one statistic/);
  assert.throws(
    () => render(h(StatCards, { items: [{ label: 'Bias', value: Number.NaN }] })),
    /value must be finite/,
  );
  assert.throws(
    () => render(h(StatCards, {
      items: [{ label: 'Bias', value: 1 }, { label: 'Bias', value: 2 }],
    })),
    /duplicate item key/,
  );
  assert.throws(
    () => render(h(StatCards, { items: [{ label: 'Bias', value: true }] })),
    /value must be a string or number/,
  );
});

test('useThemeColors is SSR-safe and exposes typed fallback colors before hydration', () => {
  function ThemeProbe() {
    const snapshot = useThemeColors({
      ink: ['--color-text', '#111111'],
      accent: ['--color-link', '#225588'],
    });
    return h('output', {
      'data-theme': snapshot.theme ?? 'unresolved',
      'data-reduced-motion': String(snapshot.reducedMotion),
    }, `${snapshot.colors.ink}|${snapshot.colors.accent}`);
  }

  const html = render(h(ThemeProbe, {}));
  assert.equal(
    html,
    '<output data-theme="unresolved" data-reduced-motion="false">#111111|#225588</output>',
  );

  function InvalidThemeProbe() {
    useThemeColors({});
    return null;
  }
  assert.throws(
    () => render(h(InvalidThemeProbe, {})),
    /provide at least one CSS token mapping/,
  );
});

test('theme hook subscribes and cleans up theme and preference listeners', () => {
  assert.match(hookSource, /addEventListener\('book:theme:change', onThemeChange\)/);
  assert.match(hookSource, /removeEventListener\('book:theme:change', onThemeChange\)/);
  assert.match(hookSource, /colorScheme\.addEventListener\('change', onMediaChange\)/);
  assert.match(hookSource, /colorScheme\.removeEventListener\('change', onMediaChange\)/);
  assert.match(hookSource, /reducedMotion\.addEventListener\('change', onMediaChange\)/);
  assert.match(hookSource, /reducedMotion\.removeEventListener\('change', onMediaChange\)/);
});

test('demo styles are opt-in, token-based, SVG-aware, and reduced-motion safe', () => {
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.demo-frame \[data-demo-fill='accent'\]/);
  assert.match(css, /\.demo-frame \[data-demo-stroke='ink'\]/);
  assert.match(css, /\.demo-slider__input:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration: 0\.01ms !important/);
  assert.doesNotMatch(declarations, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(baseSource, /styles\/demo\.css/);
});
