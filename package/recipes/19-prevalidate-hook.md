# Recipe 19 — generated data before validation (v4.27+)

`book-scaffold validate` checks citations and cross-references against two derived, normally gitignored files:

- `src/data/references.json`, emitted by `book-scaffold build-bib`
- `src/data/labels.json`, emitted by `book-scaffold build-labels`

Every profile can use theorem/Figure IDs and XRefs, so every generated book now carries the same npm lifecycle:

```json
{
  "scripts": {
    "prevalidate": "npm run build:bib --if-present && npm run build:labels --if-present",
    "validate": "book-scaffold validate",
    "prebuild": "npm run validate --if-present"
  }
}
```

`npm run validate` runs `prevalidate` automatically. `npm run build` runs `prebuild`, which delegates to that same path. Academic, tools, minimal, course-notes, and research-portfolio scaffolds use this identical contract.

## Direct CLI calls self-heal too

An npm hook cannot protect `npx book-scaffold validate` or a direct bin invocation. Starting in v4.27, the validator itself regenerates each missing artifact before loading it:

1. Missing `labels.json` invokes `build-labels`.
2. Missing `references.json` invokes `build-bib`, even when no default `bibliography.bib` exists; that valid no-bibliography case emits `{}`.
3. Existing files are not rewritten.
4. A child failure stops validation and preserves the original child diagnostic and non-zero status.

This makes fresh checkouts deterministic without hiding stale existing data. After changing theorem IDs, kinds, slugs, bibliography entries, or `numberStyle`, explicitly rerun the corresponding build command.

## Bibliography path precedence

Books with a shared or non-root bibliography can set:

```dotenv
BOOK_BIB_PATH=../shared/references.bib
```

`build-bib` resolves the process environment first, then the project-root `.env`, then `./bibliography.bib`. Relative paths are resolved from the book root. This same precedence applies when validation invokes `build-bib` during self-healing.

## Migrating older consumers

Replace custom `ci:validate` wrappers and profile-conditional hooks with the uniform scripts above. A reusable deploy workflow can call the normal `validate` script; no wrapper needs to repeat the artifact chain.

```diff
 {
   "scripts": {
-    "ci:validate": "npm run build:bib && npm run build:labels && npm run validate",
+    "prevalidate": "npm run build:bib --if-present && npm run build:labels --if-present",
     "validate": "book-scaffold validate",
-    "prebuild": "npm run build:bib && npm run build:labels && npm run validate"
+    "prebuild": "npm run validate --if-present"
   }
 }
```

The historical profile split is intentionally gone: non-academic profiles still need labels, and an empty bibliography build is a supported no-op that creates the importable empty artifact.
