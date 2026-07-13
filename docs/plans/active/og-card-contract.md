# Build-time Open Graph card contract

**Date:** 2026-07-13 · **Issue:** #157 · **Status:** accepted design; implementation in progress for v5.2.0

The scaffold will generate social cards after Astro renders static HTML. This
post-render design covers scaffold and consumer-owned pages uniformly, derives
the final canonical metadata rather than guessing it from source files, and
adds no runtime service.

## Opt-in configuration

```ts
defineBookConfig({
  // ...
  seo: {
    ogCards: true,
  },
});
```

The forward-compatible object form is also accepted:

```ts
seo: {
  ogCards: {
    enabled: true,
    exclude: ['/print/', '/answers/'],
  },
}
```

The feature defaults to `false` in the first release. `false` and
`{ enabled: false }` disable it; an object with omitted `enabled` enables it.
`exclude` contains base-relative route patterns and is matched after base
normalization. A literal path is exact, a complete `*` segment crosses exactly
one segment, and a complete `**` segment crosses zero or more. Wildcards are
not substring syntax, and a trailing slash is significant. Patterns start `/`;
hosts, query/fragment syntax, backslashes, control characters, empty internal
or dot segments, unsupported `?`/`[]`/`{}` glob tokens, and duplicates fail
config evaluation. Consumer patterns augment the built-in exclusions for
emitted 404/500 files, meta-refresh redirects, `robots`/`googlebot` `noindex`
pages, and non-HTML output.

## Metadata precedence

The selected precedence is strict:

1. page/layout `ogImage` (including chapter frontmatter `image`);
2. the current corpus book's manifest `image`;
3. static application `seo.ogImage`;
4. generated per-page card.

After rendering, any valid existing `<meta property="og:image">` therefore
prevents generation and remains untouched. The generator never overwrites an
authored, corpus, or static image. When none of those levels exists and
generation is enabled, the integration creates the card and adds:

- `og:image` with an absolute URL;
- `og:image:width` = `1200`;
- `og:image:height` = `630`;
- `og:image:type` = `image/png`; and
- `twitter:image` with the same URL.

Existing `og:title`, `og:description`, canonical URL, Twitter title, and Twitter
description remain authoritative.

## Build pipeline

The integration is appended after every scaffold, Style, and consumer
integration, then runs in `astro:build:done`:

1. walk emitted HTML in stable pathname order;
2. skip excluded/non-indexable pages and pages with an existing OG image;
3. read the rendered title, description, canonical URL, resolved preset, and
   book identity;
4. render a 1200×630 SVG tree with Satori;
5. convert it to PNG with `@resvg/resvg-js`;
6. write the content-addressed image under the build output; and
7. patch only the missing image meta tags in that HTML file.

Generation failure fails the build. Emitting a social URL without its image or
silently skipping a requested card would be a false-success contract.

The output path is:

```text
<outDir>/_og/<first-16-hex-of-content-sha256>.png
```

The hash covers template version 1, dimensions, preset, exact corpus book id
(or null), the clamped book/page/description strings, and canonical hostname.
(The route itself is not drawn on the card.) Identical visual payloads reuse
one file; changed card metadata produces a new immutable URL. A hash collision
with different bytes is a build error.
Only cards referenced by the current build remain. When Astro preserves the
output directory with `emptyOutDir: false`, the integration prunes stale
scaffold-owned `_og` filenames matching exactly 16 hexadecimal characters plus
`.png` and leaves all other files untouched. No user-managed cache cleanup is
required.

## Card content and themes

Every generated card contains:

- page title, clamped to 96 Unicode code points after whitespace normalization;
- optional description, clamped the same way at 180 code points;
- resolved book title (or corpus title for corpus surfaces), clamped at 72;
- canonical hostname, clamped at 80; and
- a small scaffold/profile mark that does not imply third-party endorsement.

The five presets share one accessible layout and typography scale but select
their accent/background pair from existing scaffold tokens. Corpus books use
their resolved book title and the corpus-wide preset. No per-book profile is
invented. Text contrast must meet WCAG AA for normal text in every theme.

Fonts are package-owned Inter v4.1 Regular/Bold TTF assets under the OFL 1.1.
The build performs no network requests, does not download consumer fonts, and
produces the same bytes for the same payload on supported platforms.

## Corpus and base behavior

The #80 runtime marks each rendered page with resolved book identity. Corpus
book pages therefore receive distinct book titles even when two books reuse a
chapter slug or page title. Corpus landing/search pages use corpus identity and
are never attributed to the first book by accident.

The physical `_og` directory is relative to Astro's output directory. Meta URLs
combine the `site` origin and normalized Astro `base`; root and subpath
deployments must resolve the exact emitted PNG. The generator never applies a
second base prefix to paths already containing it.

## Scope boundaries

- The first implementation covers all rendered static HTML, including
  consumer-owned pages, because it works from build output rather than only the
  chapters collection.
- Server/SSR routes, on-demand runtime generation, remote templates, arbitrary
  consumer JSX, and animation are out of scope.
- Consumers needing a bespoke card keep using page, corpus-book, or static
  `ogImage`; those paths outrank generation.
- The generator does not change sitemap inclusion, Pagefind inclusion, or page
  canonicalization.

## Acceptance gates

Implementation is complete when:

1. all five presets generate deterministic, non-empty 1200×630 PNGs;
2. page override, corpus-book image, static default, generated, and disabled
   precedence branches are independently proven;
3. single-book, family-style multi-page, and two-book corpus fixtures get
   distinct cards where their payloads differ;
4. root and non-root-base builds contain matching absolute meta URLs and files;
5. excluded/noindex/error pages produce no card;
6. unchanged payloads reuse the same hash and duplicate payloads deduplicate;
7. generated HTML contains complete OG/Twitter image metadata; and
8. a packed-package consumer builds without network access or runtime OG
   dependencies.
