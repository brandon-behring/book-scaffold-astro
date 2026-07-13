# Recipe 26 — Generate Open Graph cards at build time

**Profile**: any, in single-book or corpus mode.

**TL;DR**: Set `seo.ogCards: true` to generate a deterministic 1200×630 PNG
for each eligible rendered HTML page that does not already have an authored
Open Graph image. Generation runs offline after all other integrations, writes
content-addressed files beneath `_og/`, and patches only the missing image
metadata. A page image, corpus-book manifest image, or static `seo.ogImage`
always wins.

## Opt in

The short form enables generation with only the built-in exclusions:

```ts
import {
  academicStyle,
  defineBookConfig,
} from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://book.example/',
  seo: {
    ogCards: true,
  },
});
```

Use the object form when particular routes should not receive cards:

```ts
seo: {
  ogCards: {
    enabled: true,
    exclude: [
      '/print/',       // exact route
      '/drafts/*/',    // one complete path segment
      '/archive/**',   // zero or more complete path segments
    ],
  },
}
```

`ogCards` is `false` by default. `false` and `{ enabled: false }` both disable
the generator. Exclusion patterns are base-relative route paths, even when
Astro `base` is not `/`; do not repeat the deployment base in the pattern.

The accepted grammar is deliberately small:

| Form | Meaning |
|---|---|
| `/some/route/` | Match that normalized route exactly |
| `*` path segment | Match exactly one complete segment |
| `**` path segment | Match zero or more complete segments |

Wildcards are whole segments, not substring syntax, and a trailing slash is
significant. Patterns must start `/` and cannot contain a host, query,
fragment, backslash, control character, empty internal segment, `.`/`..`, or
unsupported `?`/`[]`/`{}` glob syntax. Invalid and duplicate patterns fail
configuration instead of being ignored. The configured list augments built-in
skips for emitted 404/500 files, meta-refresh redirects, and
`robots`/`googlebot` `noindex` pages.

## Know which image wins

Image precedence is strict:

1. a page/layout `ogImage`, including chapter frontmatter `image`;
2. the current corpus book's manifest `image`;
3. the static application default at `seo.ogImage`;
4. a generated per-page card.

The integration inspects the final HTML. If it finds a valid
`<meta property="og:image">`, it leaves that tag and the page untouched. This
makes a one-page override, corpus-book image, and application-wide static
default reliable opt-outs from generation without a second exclusion list.

When generation is selected, the integration adds this complete image set:

```html
<meta property="og:image" content="https://book.example/_og/0123abcd4567ef89.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta name="twitter:image" content="https://book.example/_og/0123abcd4567ef89.png">
```

Existing title, description, canonical, and Twitter text metadata remain
authoritative. The integration does not change sitemap or Pagefind inclusion.

## What the build emits

The generator runs in the final `astro:build:done` hook, after scaffold and
consumer integrations have rendered their output. It walks emitted HTML in
stable pathname order, derives the card from the rendered metadata, renders an
SVG tree with Satori, converts it with `@resvg/resvg-js`, and writes a 1200×630
PNG at:

```text
_og/<first-16-hex-of-content-sha256>.png
```

The hash covers template version 1, dimensions, resolved preset and exact
corpus book id (or `null`), the clamped book/page/description strings, and the
rendered canonical hostname. The route is not drawn on the card. Two pages
with the same visual payload reuse one file; changing a visual input produces
a new immutable URL. A same-hash/different-bytes collision fails the build.

Only images referenced by the current build remain. Astro normally empties the
output directory first; when `emptyOutDir: false` preserves it, the integration
automatically prunes stale scaffold-owned `_og` filenames matching exactly 16
hex characters plus `.png`. It leaves every other file untouched, so there is
no user-managed cache or cleanup step.

## Offline fonts and deterministic content

Cards contain the page title, optional description, resolved book or corpus
title, canonical hostname, and a small scaffold/profile mark. After whitespace
normalization, values are clamped by Unicode code point: page title 96,
description 180, book/corpus title 72, and hostname 80. Truncated values use a
word-boundary ellipsis when possible.

Satori receives the package-owned Inter v4.1 assets
`assets/og-fonts/Inter-Regular.ttf` and `Inter-Bold.ttf` under the OFL 1.1. The
build never downloads a web font or uses a consumer machine's installed fonts,
so an unchanged payload produces unchanged bytes on supported platforms. The
five presets use one accessible layout and type scale with preset-specific
colors. Corpus books keep the corpus-wide preset; the generator never invents
a per-book profile.

## Corpus identity and Astro base

Corpus pages use the identity marker emitted by the scaffold runtime. A book
chapter therefore receives its registered book title, even when two books
reuse the same local slug or page title. Corpus-level landing and search pages
use corpus identity and are not attributed to the first manifest book.

The physical file is `<outDir>/_og/<hash>.png`. Its metadata URL combines the
Astro `site` origin, normalized `base`, and `_og/<hash>.png` exactly once. Keep
exclusion patterns base-relative: a deployment at `base: '/manual/'` still
excludes its print page with `/print/`, while emitted metadata points beneath
`https://book.example/manual/_og/…`.

## Failure and skip behavior

An enabled generator is fail-loud. A generated card requires one absolute
`http(s)` canonical link and a non-empty rendered `og:title` or `<title>`.
Missing, invalid, duplicate, or contradictory metadata/identity; unreadable
output; font or renderer failure; a hash collision; or inability to patch the
selected HTML fails the Astro build. It never publishes image metadata without
the corresponding PNG and never silently downgrades a requested card.

Expected exclusions are skips, not errors: a valid absolute `http(s)` authored
image, configured patterns, emitted 404/500 files, meta-refresh redirects,
`robots`/`googlebot` `noindex`, and non-HTML output do not generate a PNG.
Corpus/static precedence injects its image URL without rendering a PNG.
Server/SSR routes, runtime image services, remote templates, arbitrary
consumer JSX card templates, and animation are outside this build-time
contract.

## Verify a deployment

Build normally, then inspect both the metadata and referenced file:

```bash
npm run build
find dist -path '*/_og/*.png' -print
grep -R 'property="og:image"' dist --include='*.html'
```

For a subpath deployment, confirm the absolute meta URL includes `base` once.
Build twice without changing metadata and confirm the same payload keeps the
same filename. Add a page override and confirm its authored image remains
unchanged.

## Common gotchas

- **Setting both `seo.ogImage` and `seo.ogCards`** — the static image wins on
  every page without a page or corpus-book image, so no generated fallback is
  needed there.
- **Including Astro `base` in `exclude`** — patterns are matched after base
  normalization; write `/print/`, not `/manual/print/`.
- **Using `*` for nested paths** — `*` crosses exactly one segment; use `**`
  for any depth.
- **Expecting runtime generation** — cards are created only for static HTML
  present at `astro:build:done`.

## Canonical files

- `src/types.ts` — `OgCardsConfig` and `seo.ogCards`
- `src/config.ts` — opt-in normalization and final integration ordering
- `src/lib/og-cards.ts` — route matching, rendered-metadata extraction, rendering,
  hashing, emission, and HTML patching
- `assets/og-fonts/` — package-owned Inter v4.1 TTF assets, `LICENSE.txt`, and
  provenance in `SOURCE.md`
- `tests/og-cards.test.mjs` — precedence, routes, corpus/base, determinism, and
  failure contracts

## Reference implementation

The package fixtures exercise all five presets, root and non-root bases, and a
two-book corpus. A consumer needs no page source or runtime endpoint beyond the
`seo.ogCards` opt-in shown above.
