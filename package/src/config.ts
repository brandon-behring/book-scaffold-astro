/**
 * defineBookConfig — thin wrapper around Astro's defineConfig that
 * composes the resolved Style chain, threads the preset through
 * `bookScaffoldIntegration`, and applies profile-conditional KaTeX wiring.
 *
 * v4.0.0 (BREAKING, closes #35 architecture work): replaces the v3.x
 * `preset:`/`profile:` top-level fields with `styles: Style[]` composition.
 * Consumers using v3 fields receive an auto-suggested migration error
 * pointing at the exact replacement (D11). See MIGRATION-v3-to-v4.md.
 *
 * See PACKAGE_DESIGN.md §4.
 */
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import type { AstroUserConfig } from 'astro';
import type { BookConfigOptions } from './types.js';
import { BOOK_PRESETS, BookConfigError } from './types.js';
import { bookScaffoldIntegration } from './integration.js';
import { PROFILES } from './profiles/index.js';
import { composeStyles, type Style } from './lib/define-style.js';
import { BUILTIN_STYLES } from './styles/built-in.js';

/**
 * v4.5.0: Default portfolio backlink baked into the scaffold. Rendered in
 * the auto-injected `/` landing footer for every consumer that doesn't
 * explicitly override `portfolio` in defineBookConfig.
 *
 * Single source of truth for the brandon-behring.dev URL across all
 * consumers — update here, bump scaffold version, every consumer inherits
 * on next build. This is the intentional Brandon-specific default
 * discussed in plan §Phase 6-pre. Consumers outside the brandon-behring.dev
 * ecosystem set `portfolio: false` (no link) or pass `{ url, label }` to
 * override.
 */
export const BRANDON_PORTFOLIO_DEFAULT = {
  url: 'https://brandon-behring.dev',
  label: 'brandon-behring.dev',
} as const;

/**
 * v4.0.0 migration error (D11) — emitted when consumer code passes the v3
 * `preset:` or `profile:` field. Builds a per-value auto-suggested
 * replacement showing the exact `styles: [<preset>Style]` syntax + import line.
 */
function v3MigrationError(opts: Record<string, unknown>): BookConfigError {
  const v3Value = (opts.preset ?? opts.profile) as string | undefined;
  const v3FieldUsed = 'preset' in opts ? 'preset' : 'profile';

  // Map preset value → style export name.
  const styleExportName =
    v3Value && BOOK_PRESETS.includes(v3Value as (typeof BOOK_PRESETS)[number])
      ? `${v3Value === 'research-portfolio'
          ? 'researchPortfolio'
          : v3Value === 'course-notes'
            ? 'courseNotes'
            : v3Value}Style`
      : null;

  const knownReplacement = styleExportName
    ? `
Replace this:
  defineBookConfig({ ${v3FieldUsed}: ${JSON.stringify(v3Value)}, ... })

With this:
  import { defineBookConfig, ${styleExportName} } from '@brandon_m_behring/book-scaffold-astro';
  defineBookConfig({ styles: [${styleExportName}], ... })
`
    : `
Replace the \`${v3FieldUsed}: <value>\` field with a \`styles: [<...Style>]\` array.
The v4 toolkit exports built-in styles for each preset: academicStyle, toolsStyle,
minimalStyle, courseNotesStyle, researchPortfolioStyle.
`;

  return new BookConfigError(
    `book-scaffold-astro v4.0.0 removed the \`${v3FieldUsed}\` field on defineBookConfig.
${knownReplacement}
See https://github.com/brandon-behring/book-scaffold-astro/blob/main/package/MIGRATION-v3-to-v4.md
for the full migration guide. If you hit friction migrating, please file an issue at
https://github.com/brandon-behring/book-scaffold-astro/issues — v4 is fresh and the API
will evolve based on real friction reports.`,
  );
}

export async function defineBookConfig(
  opts: BookConfigOptions,
): Promise<AstroUserConfig> {
  // 0. v3 → v4 migration check (D11). Hard break per D5; no shim.
  if ('preset' in opts || 'profile' in opts) {
    throw v3MigrationError(opts as Record<string, unknown>);
  }

  // 1. Compose the style chain. Empty chain returns an empty Style; defaults
  //    fall back to 'minimal' preset below (matches v3 behavior when no
  //    BOOK_PROFILE was set anywhere).
  const composed = composeStyles((opts.styles as readonly Style[] | undefined) ?? []);

  // 2. Apply top-level opts on top of composed (top-level wins for shared fields).
  const profile = (opts.styles === undefined && composed.preset === undefined
    ? 'minimal'
    : composed.preset ?? 'minimal') as (typeof BOOK_PRESETS)[number];

  const site = opts.site ?? composed.site;
  if (!site) {
    throw new BookConfigError(
      'book-scaffold-astro v4.0.0: `site` is required. Provide it via the top-level ' +
        '`site` field in defineBookConfig OR via a Style in the `styles` array.',
    );
  }

  // Merge routes: composed style routes + top-level opts.routes (top-level wins per-key).
  const mergedRoutes = {
    ...(composed.routes ?? {}),
    ...(opts.routes ?? {}),
  };

  // Merge katexMacros: composed style macros + top-level (top-level wins per-key).
  const consumerKatexMacros = {
    ...(composed.katexMacros ?? {}),
    ...((opts.katexMacros as Record<string, string> | undefined) ?? {}),
  };

  // Extra styles + integrations: concat composed + top-level.
  const mergedExtraStyles = [
    ...(composed.extraStyles ?? []),
    ...((opts.extraStyles as readonly string[] | undefined) ?? []),
  ];
  const mergedExtraIntegrations = [
    ...(composed.extraIntegrations ?? []),
    ...((opts.extraIntegrations as readonly NonNullable<AstroUserConfig['integrations']>[number][] | undefined) ?? []),
  ];

  // mdxComponentsModule: top-level beats composed.
  const mdxComponentsModule =
    (opts.mdxComponentsModule as string | undefined) ?? composed.mdxComponentsModule;

  // markdown: composed + top-level (top-level remark/rehype concat after composed).
  const composedMarkdown = composed.markdown ?? {};
  const userMarkdown = (opts.markdown as AstroUserConfig['markdown'] | undefined) ?? {};

  // 3. Profile-conditional KaTeX wiring. v3.7.1 (#51) gate: PROFILES[profile]?.katex.
  const wantsKatex = PROFILES[profile]?.katex === true;
  const remarkPlugins: NonNullable<NonNullable<AstroUserConfig['markdown']>['remarkPlugins']> = [];
  const rehypePlugins: NonNullable<NonNullable<AstroUserConfig['markdown']>['rehypePlugins']> = [];

  if (wantsKatex) {
    const { default: remarkMath } = await import(/* @vite-ignore */ 'remark-math');
    const { default: rehypeKatex } = await import(/* @vite-ignore */ 'rehype-katex');
    const { ssmMacros } = await import('./lib/katex-macros.js');
    const macros = { ...ssmMacros, ...consumerKatexMacros };
    remarkPlugins.push(remarkMath);
    rehypePlugins.push([
      rehypeKatex,
      {
        strict: 'error',
        trust: true,
        macros,
      },
    ]);
  }

  // v4.5.0: resolve portfolio backlink. Explicit `false` disables; explicit
  // `{ url, label }` overrides; absent → BRANDON_PORTFOLIO_DEFAULT.
  const resolvedPortfolio: { url: string; label: string } | false =
    opts.portfolio === false
      ? false
      : opts.portfolio ?? BRANDON_PORTFOLIO_DEFAULT;

  // v4.6.0 (#76 Secondary): resolve sitemap filter per D7 (consumer's
  // filter REPLACES profile default; only the profile default applies
  // when consumer omits the filter entirely). `customPages` passes
  // through unchanged.
  const profileSitemapFilter = PROFILES[profile]?.sitemapFilter;
  const sitemapFilter = opts.seo?.sitemap?.filter ?? profileSitemapFilter;
  const sitemapCustomPages = opts.seo?.sitemap?.customPages;
  const sitemapOptions: Record<string, unknown> = {};
  if (sitemapFilter) sitemapOptions.filter = sitemapFilter;
  if (sitemapCustomPages) sitemapOptions.customPages = sitemapCustomPages;

  const integrations = [
    mdx(),
    preact(),
    // v4.6.0: @astrojs/sitemap default integration. Emits
    // /sitemap-index.xml + per-route sitemaps from the resolved `site:`
    // (defineBookConfig throws above if site is missing, so the URL is
    // always available to the sitemap integration here).
    sitemap(sitemapOptions),
    bookScaffoldIntegration({
      profile,
      routes: mergedRoutes,
      mdxComponentsModule,
      extraStyles: mergedExtraStyles,
      // v4.5.0: pass landing-page data through to the integration so it can
      // be exposed to the auto-injected /index.astro via the virtual module.
      title: opts.title,
      description: opts.description,
      portfolio: resolvedPortfolio,
      // v4.6.0: book-level author + SEO config (ogImage, twitterHandle),
      // propagated through the renamed `book-config` virtual module to
      // Base.astro + Chapter.astro. `seo.sitemap` is NOT passed through —
      // it's consumed below at config-time by the @astrojs/sitemap call.
      author: opts.author,
      seo: opts.seo
        ? { ogImage: opts.seo.ogImage, twitterHandle: opts.seo.twitterHandle }
        : undefined,
    }),
    ...mergedExtraIntegrations,
  ];

  // Consumer's `markdown` spreads after the package defaults so they can
  // override fields; the remark/rehype arrays merge additively from composed
  // styles → top-level user markdown.
  const finalRemark = [
    ...remarkPlugins,
    ...(composedMarkdown.remarkPlugins ?? []),
    ...(userMarkdown.remarkPlugins ?? []),
  ];
  const finalRehype = [
    ...rehypePlugins,
    ...(composedMarkdown.rehypePlugins ?? []),
    ...(userMarkdown.rehypePlugins ?? []),
  ];

  const markdown: AstroUserConfig['markdown'] = {
    shikiConfig: {
      theme: 'css-variables',
      wrap: false,
      ...((userMarkdown.shikiConfig ?? composedMarkdown.shikiConfig) ?? {}),
    },
    ...composedMarkdown,
    ...userMarkdown,
    remarkPlugins: finalRemark,
    rehypePlugins: finalRehype,
  };

  // Strip the package-specific options out of the rest before forwarding to Astro.
  const {
    styles: _styles,
    site: _site,
    routes: _routes,
    deploy: _deploy,
    mdxComponentsModule: _mdxComponentsModule,
    extraIntegrations: _extraIntegrations,
    extraStyles: _extraStyles,
    markdown: _markdown,
    katexMacros: _katexMacros,
    // v4.5.0: strip new landing-related opts so they don't leak into AstroUserConfig.
    title: _title,
    description: _description,
    portfolio: _portfolio,
    // v4.6.0: strip new book-level SEO opts (author + seo block).
    author: _author,
    seo: _seo,
    ...rest
  } = opts;
  void _styles;
  void _site;
  void _routes;
  void _deploy;
  void _mdxComponentsModule;
  void _extraIntegrations;
  void _extraStyles;
  void _markdown;
  void _katexMacros;
  void _title;
  void _description;
  void _portfolio;
  void _author;
  void _seo;

  // KaTeX externals — same v3.7.1 pattern, now gated on the composed preset.
  const katexExternals = wantsKatex ? [] : ['remark-math', 'rehype-katex', 'katex'];

  const config: AstroUserConfig = {
    site,
    ...rest,
    integrations,
    markdown,
    vite: {
      build: {
        rollupOptions: {
          external: katexExternals,
        },
      },
      ...((rest as Record<string, unknown>).vite as object | undefined ?? {}),
    },
  } as AstroUserConfig;
  return config;
}
