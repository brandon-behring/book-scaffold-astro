/**
 * defineBookConfig — thin wrapper around Astro's defineConfig that
 * threads the resolved profile through `bookScaffoldIntegration` and
 * applies profile-conditional KaTeX wiring.
 *
 * See PACKAGE_DESIGN.md §4.
 */
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import type { AstroUserConfig } from 'astro';
import type { BookConfigOptions } from './types.js';
import { resolveProfile } from './types.js';
import { bookScaffoldIntegration } from './integration.js';

export async function defineBookConfig(
  opts: BookConfigOptions,
): Promise<AstroUserConfig> {
  const profile = resolveProfile(opts.profile);

  // Profile-conditional KaTeX wiring (ported from v2.0 astro.config.mjs:23-42).
  // Dynamic import keeps the dep graph clean for tools/minimal profiles.
  const remarkPlugins: NonNullable<NonNullable<AstroUserConfig['markdown']>['remarkPlugins']> = [];
  const rehypePlugins: NonNullable<NonNullable<AstroUserConfig['markdown']>['rehypePlugins']> = [];

  if (profile === 'academic') {
    // `/* @vite-ignore */` tells the consumer's Vite to skip static analysis
    // of these dynamic imports — tools/minimal consumers don't install
    // remark-math/rehype-katex, and Vite would otherwise fail to resolve
    // them even though the runtime branch never executes.
    const { default: remarkMath } = await import(/* @vite-ignore */ 'remark-math');
    const { default: rehypeKatex } = await import(/* @vite-ignore */ 'rehype-katex');
    const { ssmMacros } = await import('./lib/katex-macros.js');
    remarkPlugins.push(remarkMath);
    rehypePlugins.push([
      rehypeKatex,
      {
        // Strict mode: build fails on undefined macros, malformed expressions,
        // unsupported AMS environments. Trades developer pain at write-time
        // for catching errors before deploy.
        strict: 'error',
        trust: true,
        macros: ssmMacros,
      },
    ]);
  }

  const integrations = [
    mdx(),
    preact(),
    bookScaffoldIntegration({ profile, extraStyles: opts.extraStyles }),
    ...(opts.extraIntegrations ?? []),
  ];

  // Consumer's `markdown` spreads after the package defaults so they
  // can override fields, but the remark/rehype arrays merge additively.
  const userMarkdown = opts.markdown ?? {};
  const markdown: AstroUserConfig['markdown'] = {
    shikiConfig: {
      // css-variables mode lets code blocks switch dark/light theme without
      // rebuilding. Tokens map to --astro-code-* CSS vars in tokens.css.
      theme: 'css-variables',
      wrap: false,
      ...(userMarkdown.shikiConfig ?? {}),
    },
    remarkPlugins: [...remarkPlugins, ...(userMarkdown.remarkPlugins ?? [])],
    rehypePlugins: [...rehypePlugins, ...(userMarkdown.rehypePlugins ?? [])],
    ...userMarkdown,
  };

  // Strip the package-specific options out of the rest before forwarding.
  const {
    profile: _profile,
    extraIntegrations: _extraIntegrations,
    extraStyles: _extraStyles,
    markdown: _markdown,
    ...rest
  } = opts;
  void _profile;
  void _extraIntegrations;
  void _extraStyles;
  void _markdown;

  // defineConfig from 'astro/config' is documented as an identity function
  // that only carries types; we skip it and assemble the AstroUserConfig
  // directly. This sidesteps a generic-inference cascade where
  // AstroUserConfig's Locales/SessionDriverName/FontProvider params don't
  // thread through our wrapper without explicit type plumbing.
  //
  // KaTeX peer-deps are dynamic-imported only on the academic branch, but
  // Rollup's static analyzer sees the literal string and tries to resolve
  // anyway. Marking them external for non-academic builds skips the
  // resolution attempt; the runtime branch never executes, so no runtime
  // miss.
  const katexExternals =
    profile === 'academic' ? [] : ['remark-math', 'rehype-katex', 'katex'];

  const config: AstroUserConfig = {
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
