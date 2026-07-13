# Migrating from v4.x to v5.0.0

**Audience**: existing users of `@brandon_m_behring/book-scaffold-astro@^4`.

v5 makes two previously deprecated configuration changes and adds an opt-in
book-corpus mode. Existing single-book routes and generated JSON stay unchanged;
corpus mode is the only feature that changes their shape.

## Required changes for every application

### 1. Make the preset explicit

v4 could fall back to `minimal` when no preset was configured. v5 fails instead,
because a missing `.env` in CI must not silently select the wrong schema and
rendering behavior.

For `defineBookConfig`, include a built-in Style or a custom Style with a
`preset`:

```ts
import {
  defineBookConfig,
  academicStyle,
} from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://book.example/',
});
```

Give `defineBookSchemas` the matching preset directly:

```ts
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';

export const { collections } = defineBookSchemas({ preset: 'academic' });
```

`BOOK_PRESET` in the process environment or project `.env` remains a supported
shared source for a preset-less Style/schema call. `BOOK_PROFILE` and the
`profile` schema option remain backward-compatible aliases. Prefer the canonical
names in new configuration:

```dotenv
BOOK_PRESET=academic
```

The resolution order remains explicit argument, `BOOK_PRESET`, `BOOK_PROFILE`,
then the same two keys in `.env`. There is no final default.

### 2. Delete `deploy` from book and Style configuration

Remove `deploy` from both locations if present:

```diff
 export const brandStyle = defineStyle({
   name: 'brand',
-  deploy: 'workers',
 });

 export default await defineBookConfig({
   styles: [brandStyle, academicStyle],
-  deploy: 'workers',
   site: 'https://book.example/',
 });
```

The v4 field was inert: it never changed an existing deployment and never chose
the file emitted by `create-book`. v5 removes it from the types and built-in
Styles; JavaScript configurations and v4 Style objects that still carry it fail
with a migration error.

Configure the real deployment surface instead:

- edit `wrangler.toml` for Cloudflare Workers or Pages;
- edit the deployment platform's project settings or workflow; and
- keep `site` in `defineBookConfig` as the public canonical origin.

`create-book --preset` still chooses an initial `wrangler.toml` shape for a new
project. That scaffold-time choice is separate from book configuration.

## Corpus opt-in

Corpus mode is optional. A Recipe 21 multi-guide application migrates in six
steps:

1. Extract the ordered book metadata into one `defineBookCorpus` manifest.
2. Pass that same manifest to `defineBookConfig` and `defineBookSchemas`.
3. Remove the hand-written chapter collection and its custom `generateId`.
4. Keep book folders under `src/content/`, or set one explicit `chaptersBase`
   when the shared base lives elsewhere.
5. Compare consumer-owned per-book index pages with the injected pages, then
   remove the duplicates.
6. Run every content-derived command (`build-labels`, `build-bib`,
   `build-tips`, `build-exercises`, and `validate`); update scripts that read
   generated corpus JSON to select a book from the versioned envelope. Figure
   and notebook conversion remain application-wide.

A minimal shared manifest looks like this:

```ts
// src/book-corpus.ts
import { defineBookCorpus } from '@brandon_m_behring/book-scaffold-astro';

export const corpus = defineBookCorpus({
  preset: 'tools',
  books: [
    { id: 'evaluation', title: 'Evaluation Engineering' },
    { id: 'llm-apps', title: 'LLM Application Engineering' },
  ],
});
```

```ts
// astro.config.mjs
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
import { corpus } from './src/book-corpus.js';

export default await defineBookConfig({
  corpus,
  site: 'https://guides.example/',
});
```

```ts
// src/content.config.ts
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
import { corpus } from './book-corpus.js';

export const { collections } = defineBookSchemas({ corpus });
```

The manifest's preset is an explicit preset source. If a composed Style also
sets a preset, it must match the manifest.

Book ids may not be `questions`, `glossary`, or `frontmatter`; those names own
shared scaffold collection roots beneath `src/content/`, rather than chapter
directories. `defineBookCorpus` rejects such collisions before content sync.

Existing Recipe 21 chapter URLs remain
`/chapters/<book>/<slug>/`; no redirect is needed. In corpus mode, generated
labels, references, tips, and exercise data use the versioned envelope:

```json
{
  "schemaVersion": 1,
  "books": {
    "evaluation": {},
    "llm-apps": {}
  }
}
```

Consumers must select the current book before looking up an entry.

If the corpus exposes convergence dashboards, move the v4 root collateral into
one directory per manifest id:

```text
changelog/<book>/patterns.yaml
changelog/<book>/tools/*.yaml
```

Corpus routes never reuse a root-level pattern/timeline collection across
books. Flashcard progress is automatically isolated under per-book storage
keys; no authoring change is required.

## Single-book compatibility

A single-book application does not need `defineBookCorpus`. Its
`/chapters/<slug>/` and `/chapters/` routes, flat apparatus routes, schemas, and
generated JSON retain their v4 shapes. Only the explicit-preset requirement and
the removed `deploy` field apply.

## Upgrade checklist

1. Remove every `deploy` key from book configs and shared Styles.
2. Confirm both Astro config and content schemas resolve the intended preset.
3. Run `npm run validate` and `npm run build`; the generated prevalidation hook
   refreshes the applicable bibliography and label artifacts. Run optional
   tips/exercises build scripts when the application enables those surfaces.
4. For a corpus, inspect every book's routes and update generated-JSON readers.
