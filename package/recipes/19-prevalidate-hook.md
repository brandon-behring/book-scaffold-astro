# Recipe 19 — `prevalidate` npm hook (v4.6.0+)

`book-scaffold validate` checks `<Cite key="...">` against `src/data/references.json` (academic profile) and `<XRef id="...">` against `src/data/labels.json`. Both JSON files are **derived artifacts** regenerated from `bibliography.bib` + chapter MDX by `book-scaffold build-bib` + `book-scaffold build-labels`. Both are gitignored.

When `npm run validate` runs **standalone** (e.g., a reusable deploy workflow runs only the validate command, without the full `npm run build` chain), the prereq scripts don't fire and the validator chokes on apparently-missing keys.

The `prevalidate` npm lifecycle hook is the canonical fix: it auto-runs the prereqs whenever `npm run validate` is invoked, regardless of how validate is called.

---

## TL;DR

```json
{
  "scripts": {
    "prevalidate": "npm run build:bib && npm run build:labels --if-present",
    "validate": "book-scaffold validate"
  }
}
```

`npm run validate` → automatically runs `prevalidate` first (build:bib + build:labels) → then runs `validate`. CI and local behave identically; no separate `ci:validate` wrapper script needed.

---

## Why the workaround was needed

`brandon-behring/deploy-workflows@v1` (the reusable Cloudflare Workers deploy) runs `npm run <validate-command>` between `npm ci` and `npm run build`. Without the `prevalidate` hook OR an explicit wrapper script, the validate step ran against missing artifacts.

The Phase 1c first-deploy of `ssm-foundations` (2026-05-26) hit this — validate emitted 25+ "Unknown bibkey" errors that pointed at chapter content instead of the missing `references.json` artifact. The deploy-time fix shipped as a `ci:validate` wrapper:

```json
{
  "scripts": {
    "ci:validate": "npm run build:bib && npm run build:labels --if-present && npm run validate"
  }
}
```

…with `validate-command: ci:validate` in `.github/workflows/deploy.yml`. This worked but introduced consumer-side ceremony for what is structurally a scaffold-level convention.

The cleaner long-term fix is the `prevalidate` npm-lifecycle hook (this recipe). v4.6.0's `create-book` automatically scaffolds it for academic + research-portfolio profiles.

---

## Migration: from `ci:validate` to `prevalidate`

Existing consumers (DML, ssm, dlai when it ships) that adopted the `ci:validate` wrapper during 2026-05-26 deploys can migrate when they bump to scaffold `^4.6.0`. Three-file mechanical change per consumer:

### 1. `package.json` — rename `ci:validate` → `prevalidate`

```diff
 {
   "scripts": {
-    "ci:validate": "npm run build:bib && npm run build:labels --if-present && npm run validate",
+    "prevalidate": "npm run build:bib && npm run build:labels --if-present",
     "validate": "book-scaffold validate"
   }
 }
```

Note the renamed script no longer needs to call `validate` itself — npm's lifecycle invokes it automatically after `prevalidate` completes.

### 2. `.github/workflows/deploy.yml` — revert `validate-command`

```diff
 jobs:
   deploy:
     uses: brandon-behring/deploy-workflows/.github/workflows/deploy-astro-worker.yml@v2
     secrets: inherit
     with:
       working-directory: web
-      validate-command: ci:validate
+      validate-command: validate
       enable-pr-previews: true
```

The reusable workflow's `validate-command` now points at the native `validate` script; the `prevalidate` hook handles its own prereqs transparently.

### 3. Simplify `prebuild` (optional)

If the consumer's `prebuild` still has the long chain:

```diff
 {
   "scripts": {
-    "prebuild": "npm run build:bib --if-present && npm run build:labels --if-present && npm run validate --if-present",
+    "prebuild": "npm run validate --if-present",
     "build": "astro build && pagefind --site dist"
   }
 }
```

Now `npm run build` → triggers `prebuild` (which runs `validate`) → triggers `prevalidate` (which runs the prereqs) → validate runs cleanly. Single source of truth for the prereq chain.

---

## When `prevalidate` is NOT needed

Profiles that don't run cite-key or XRef validation don't need `prevalidate`. Specifically:

- `tools`, `minimal`: no `<Cite>` resolution against `references.json`.
- `course-notes`: depends on whether the consumer uses `<Cite>` (some do for source-tier attribution).

For these profiles, `book-scaffold validate` operates on chapter structure + XRef IDs only; `prevalidate` would be a no-op. The v4.6.0 create-book template adds `prevalidate` ONLY for academic + research-portfolio.

---

## Why this matters

Recipe 19 is part of [issue #76](https://github.com/brandon-behring/book-scaffold-astro/issues/76)'s v4.6 bundle. Companion: [recipe 18 — chapter-route ownership](./18-chapter-route-ownership.md), which fixes another silent-CI surface from the same Phase 1c first-deploys.

The `prevalidate` convention also closes [issue #77](https://github.com/brandon-behring/book-scaffold-astro/issues/77) — the v4.6 validator now emits a single re-framed error pointing at this recipe when `references.json` is missing, replacing the noisy 25-symptom output.
