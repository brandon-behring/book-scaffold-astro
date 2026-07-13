/**
 * tests/define-style.test.mjs — node:test suite for the v4.0.0 defineStyle API
 * + composition + built-in styles.
 *
 * Run after `npm run build`: tests import from dist/ since node:test can't
 * load TS directly. Covers:
 *   - defineStyle identity + branding + version marker
 *   - composeStyles per-key merge semantics (one test per field in the merge table)
 *   - Conflict resolution + last-wins
 *   - routes.frontmatter widening (boolean form vs object form)
 *   - normalizeFrontmatterConfig helper
 *   - BUILTIN_STYLES integrity (all 5 presets present, each has correct preset field)
 *
 * Run: node --test tests/define-style.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  defineStyle,
  composeStyles,
  normalizeFrontmatterConfig,
  academicStyle,
  toolsStyle,
  minimalStyle,
  courseNotesStyle,
  researchPortfolioStyle,
  BUILTIN_STYLES,
} from '../dist/index.mjs';

// ===== defineStyle: identity + branding =====

test('defineStyle: returns input opts plus __styleVersion=1', () => {
  const s = defineStyle({ name: 'test', preset: 'academic' });
  assert.equal(s.__styleVersion, 1);
  assert.equal(s.name, 'test');
  assert.equal(s.preset, 'academic');
});

test('defineStyle: empty input produces a valid Style with version marker', () => {
  const s = defineStyle({});
  assert.equal(s.__styleVersion, 1);
});

test('defineStyle: preserves all known optional fields', () => {
  const s = defineStyle({
    name: 'full',
    preset: 'tools',
    site: 'https://example.com/',
    routes: { chapters: false },
    katexMacros: { '\\E': '\\mathbb{E}' },
    extraStyles: ['a.css'],
    extraIntegrations: [],
    mdxComponentsModule: 'src/x.ts',
    markdown: { remarkPlugins: [], rehypePlugins: [] },
    deploy: 'pages',
    releaseStatus: { state: 'beta', message: 'Preview' },
    extra: { foo: 'bar' },
  });
  assert.equal(s.name, 'full');
  assert.equal(s.preset, 'tools');
  assert.equal(s.site, 'https://example.com/');
  assert.deepEqual(s.routes, { chapters: false });
  assert.deepEqual(s.katexMacros, { '\\E': '\\mathbb{E}' });
  assert.deepEqual(s.extraStyles, ['a.css']);
  assert.equal(s.mdxComponentsModule, 'src/x.ts');
  assert.equal(s.deploy, 'pages');
  assert.deepEqual(s.releaseStatus, { state: 'beta', message: 'Preview' });
  assert.deepEqual(s.extra, { foo: 'bar' });
});

// ===== composeStyles: empty + single =====

test('composeStyles: empty array returns Style with no fields set', () => {
  const merged = composeStyles([]);
  assert.equal(merged.__styleVersion, 1);
  assert.equal(merged.preset, undefined);
  assert.equal(merged.site, undefined);
});

test('composeStyles: single-style chain returns Style with same fields', () => {
  const s = defineStyle({ preset: 'academic', site: 'https://x.com/' });
  const merged = composeStyles([s]);
  assert.equal(merged.preset, 'academic');
  assert.equal(merged.site, 'https://x.com/');
});

// ===== composeStyles: shallow override for primitives =====

test('composeStyles: site shallow-override (last wins)', () => {
  const merged = composeStyles([
    defineStyle({ site: 'https://a.com/' }),
    defineStyle({ site: 'https://b.com/' }),
  ]);
  assert.equal(merged.site, 'https://b.com/');
});

test('composeStyles: preset shallow-override (last wins)', () => {
  const merged = composeStyles([
    defineStyle({ preset: 'academic' }),
    defineStyle({ preset: 'research-portfolio' }),
  ]);
  assert.equal(merged.preset, 'research-portfolio');
});

test('composeStyles: deploy shallow-override (last wins)', () => {
  const merged = composeStyles([
    defineStyle({ deploy: 'workers' }),
    defineStyle({ deploy: 'pages' }),
  ]);
  assert.equal(merged.deploy, 'pages');
});

test('composeStyles: undefined values do NOT override set values', () => {
  const merged = composeStyles([
    defineStyle({ site: 'https://a.com/' }),
    defineStyle({}),  // no site set
  ]);
  assert.equal(merged.site, 'https://a.com/');
});

test('composeStyles: name shallow-override (last wins)', () => {
  const merged = composeStyles([
    defineStyle({ name: 'base' }),
    defineStyle({ name: 'override' }),
  ]);
  assert.equal(merged.name, 'override');
});

test('composeStyles: mdxComponentsModule shallow-override (last wins)', () => {
  const merged = composeStyles([
    defineStyle({ mdxComponentsModule: 'src/a.ts' }),
    defineStyle({ mdxComponentsModule: 'src/b.ts' }),
  ]);
  assert.equal(merged.mdxComponentsModule, 'src/b.ts');
});

test('composeStyles: releaseStatus is inherited when later styles omit it', () => {
  const merged = composeStyles([
    defineStyle({ releaseStatus: { state: 'alpha', message: 'Family preview' } }),
    defineStyle({ name: 'project' }),
  ]);
  assert.deepEqual(merged.releaseStatus, {
    state: 'alpha',
    message: 'Family preview',
  });
});

test('composeStyles: releaseStatus shallow-override replaces the whole object', () => {
  const merged = composeStyles([
    defineStyle({
      releaseStatus: {
        state: 'alpha',
        dismissAt: 'v1.0.0',
        message: 'Family preview',
      },
    }),
    defineStyle({ releaseStatus: { state: 'rc' } }),
  ]);
  assert.deepEqual(merged.releaseStatus, { state: 'rc' });
});

test('composeStyles: releaseStatus=false suppresses an inherited status', () => {
  const merged = composeStyles([
    defineStyle({ releaseStatus: { state: 'beta' } }),
    defineStyle({ releaseStatus: false }),
  ]);
  assert.equal(merged.releaseStatus, false);
});

// ===== composeStyles: per-route spread =====

test('composeStyles: routes per-route spread (different keys)', () => {
  const merged = composeStyles([
    defineStyle({ routes: { chapters: true } }),
    defineStyle({ routes: { convergence: false } }),
  ]);
  assert.deepEqual(merged.routes, { chapters: true, convergence: false });
});

test('composeStyles: routes per-route spread (same key, last wins)', () => {
  const merged = composeStyles([
    defineStyle({ routes: { chapters: true } }),
    defineStyle({ routes: { chapters: false } }),
  ]);
  assert.deepEqual(merged.routes, { chapters: false });
});

// ===== composeStyles: routes.frontmatter widening (boolean + object) =====

test('routes.frontmatter: boolean form preserved through merge', () => {
  const merged = composeStyles([
    defineStyle({ routes: { frontmatter: true } }),
  ]);
  assert.equal(merged.routes.frontmatter, true);
});

test('routes.frontmatter: object form preserved through merge', () => {
  const merged = composeStyles([
    defineStyle({ routes: { frontmatter: { enabled: true, prefix: '' } } }),
  ]);
  assert.deepEqual(merged.routes.frontmatter, { enabled: true, prefix: '' });
});

test('routes.frontmatter: later object overrides earlier boolean (whole value replaced)', () => {
  const merged = composeStyles([
    defineStyle({ routes: { frontmatter: true } }),
    defineStyle({ routes: { frontmatter: { enabled: true, prefix: 'pages' } } }),
  ]);
  assert.deepEqual(merged.routes.frontmatter, { enabled: true, prefix: 'pages' });
});

// ===== composeStyles: katexMacros per-macro spread =====

test('composeStyles: katexMacros per-macro spread (different keys)', () => {
  const merged = composeStyles([
    defineStyle({ katexMacros: { '\\E': '\\mathbb{E}' } }),
    defineStyle({ katexMacros: { '\\Var': '\\mathrm{Var}' } }),
  ]);
  assert.deepEqual(merged.katexMacros, {
    '\\E': '\\mathbb{E}',
    '\\Var': '\\mathrm{Var}',
  });
});

test('composeStyles: katexMacros per-macro spread (same key, last wins)', () => {
  const merged = composeStyles([
    defineStyle({ katexMacros: { '\\E': '\\mathbb{E}' } }),
    defineStyle({ katexMacros: { '\\E': '\\mathcal{E}' } }),
  ]);
  assert.deepEqual(merged.katexMacros, { '\\E': '\\mathcal{E}' });
});

// ===== composeStyles: array concat for extraStyles, extraIntegrations =====

test('composeStyles: extraStyles array concat (additive, no dedup)', () => {
  const merged = composeStyles([
    defineStyle({ extraStyles: ['a.css', 'b.css'] }),
    defineStyle({ extraStyles: ['c.css'] }),
  ]);
  assert.deepEqual(merged.extraStyles, ['a.css', 'b.css', 'c.css']);
});

test('composeStyles: extraStyles duplicate entries NOT deduped (D9 pure concat)', () => {
  const merged = composeStyles([
    defineStyle({ extraStyles: ['tokens.css'] }),
    defineStyle({ extraStyles: ['tokens.css', 'brand.css'] }),
  ]);
  assert.deepEqual(merged.extraStyles, ['tokens.css', 'tokens.css', 'brand.css']);
});

test('composeStyles: extraIntegrations array concat (additive)', () => {
  const fakeIntegration = (name) => ({ name, hooks: {} });
  const merged = composeStyles([
    defineStyle({ extraIntegrations: [fakeIntegration('a'), fakeIntegration('b')] }),
    defineStyle({ extraIntegrations: [fakeIntegration('c')] }),
  ]);
  assert.equal(merged.extraIntegrations.length, 3);
  assert.deepEqual(
    merged.extraIntegrations.map((i) => i.name),
    ['a', 'b', 'c'],
  );
});

// ===== composeStyles: extra per-key spread =====

test('composeStyles: extra per-key spread (different keys)', () => {
  const merged = composeStyles([
    defineStyle({ extra: { tier: 'experimental' } }),
    defineStyle({ extra: { team: 'engineering' } }),
  ]);
  assert.deepEqual(merged.extra, { tier: 'experimental', team: 'engineering' });
});

test('composeStyles: extra per-key spread (same key, last wins)', () => {
  const merged = composeStyles([
    defineStyle({ extra: { tier: 'experimental' } }),
    defineStyle({ extra: { tier: 'production' } }),
  ]);
  assert.deepEqual(merged.extra, { tier: 'production' });
});

// ===== composeStyles: markdown deep-merge with plugin array concat =====

test('composeStyles: markdown.remarkPlugins concat across chain', () => {
  const plugin = (name) => () => name;
  const merged = composeStyles([
    defineStyle({ markdown: { remarkPlugins: [plugin('a')] } }),
    defineStyle({ markdown: { remarkPlugins: [plugin('b')] } }),
  ]);
  assert.equal(merged.markdown.remarkPlugins.length, 2);
});

test('composeStyles: markdown.rehypePlugins concat across chain', () => {
  const plugin = (name) => () => name;
  const merged = composeStyles([
    defineStyle({ markdown: { rehypePlugins: [plugin('a')] } }),
    defineStyle({ markdown: { rehypePlugins: [plugin('b')] } }),
  ]);
  assert.equal(merged.markdown.rehypePlugins.length, 2);
});

test('composeStyles: markdown scalar fields override (last wins)', () => {
  const merged = composeStyles([
    defineStyle({ markdown: { syntaxHighlight: 'shiki' } }),
    defineStyle({ markdown: { syntaxHighlight: 'prism' } }),
  ]);
  assert.equal(merged.markdown.syntaxHighlight, 'prism');
});

// ===== normalizeFrontmatterConfig =====

test('normalizeFrontmatterConfig: undefined → undefined', () => {
  assert.equal(normalizeFrontmatterConfig(undefined), undefined);
});

test('normalizeFrontmatterConfig: true → { enabled: true }', () => {
  assert.deepEqual(normalizeFrontmatterConfig(true), { enabled: true });
});

test('normalizeFrontmatterConfig: false → { enabled: false }', () => {
  assert.deepEqual(normalizeFrontmatterConfig(false), { enabled: false });
});

test('normalizeFrontmatterConfig: object form returned as-is', () => {
  assert.deepEqual(
    normalizeFrontmatterConfig({ enabled: true, prefix: 'pages' }),
    { enabled: true, prefix: 'pages' },
  );
});

// ===== BUILTIN_STYLES integrity =====

test('BUILTIN_STYLES: contains all 5 presets', () => {
  const keys = Object.keys(BUILTIN_STYLES).sort();
  assert.deepEqual(keys, [
    'academic',
    'course-notes',
    'minimal',
    'research-portfolio',
    'tools',
  ]);
});

test('BUILTIN_STYLES: each style has matching preset field', () => {
  for (const [key, style] of Object.entries(BUILTIN_STYLES)) {
    assert.equal(style.preset, key, `BUILTIN_STYLES['${key}'].preset should be '${key}'`);
  }
});

test('BUILTIN_STYLES: each style has a name matching the preset', () => {
  for (const [key, style] of Object.entries(BUILTIN_STYLES)) {
    assert.equal(style.name, key, `BUILTIN_STYLES['${key}'].name should be '${key}'`);
  }
});

test('BUILTIN_STYLES: each style has the __styleVersion marker', () => {
  for (const style of Object.values(BUILTIN_STYLES)) {
    assert.equal(style.__styleVersion, 1);
  }
});

test('BUILTIN_STYLES.academic: deploy = workers', () => {
  assert.equal(academicStyle.deploy, 'workers');
});

test("BUILTIN_STYLES['research-portfolio']: deploy = pages", () => {
  assert.equal(researchPortfolioStyle.deploy, 'pages');
});

test("BUILTIN_STYLES['research-portfolio']: routes.frontmatter enabled by default", () => {
  assert.equal(researchPortfolioStyle.routes?.frontmatter?.enabled, true);
});

test("BUILTIN_STYLES['course-notes']: deploy = pages", () => {
  assert.equal(courseNotesStyle.deploy, 'pages');
});

// ===== Composition with built-in styles =====

test('Composition: BUILTIN_STYLES.research-portfolio + custom style overrides', () => {
  const customStyle = defineStyle({
    site: 'https://my-portfolio.example/',
    routes: { frontmatter: { enabled: true, prefix: '' } },  // override prefix
  });
  const merged = composeStyles([researchPortfolioStyle, customStyle]);
  assert.equal(merged.preset, 'research-portfolio');         // from built-in
  assert.equal(merged.deploy, 'pages');                      // from built-in
  assert.equal(merged.site, 'https://my-portfolio.example/'); // from custom
  assert.deepEqual(merged.routes.frontmatter, { enabled: true, prefix: '' }); // overrides built-in's prefix:'frontmatter'
});

test('Composition: 3-style chain (base + brand + project) all contribute', () => {
  const base = defineStyle({ preset: 'tools' });
  const brand = defineStyle({ site: 'https://brand.example/' });
  const project = defineStyle({ extraStyles: ['project.css'] });
  const merged = composeStyles([base, brand, project]);
  assert.equal(merged.preset, 'tools');
  assert.equal(merged.site, 'https://brand.example/');
  assert.deepEqual(merged.extraStyles, ['project.css']);
});
