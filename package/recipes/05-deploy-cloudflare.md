# Recipe 05 — Deploy to Cloudflare Workers + Static Assets

**Profile**: any (deploy mechanism is profile-agnostic).

**TL;DR**: Cloudflare unified Pages → Workers + Static Assets (late 2025). For new static sites, use the Workers flow: `wrangler.toml` + `npx wrangler deploy`. Legacy Pages OAuth still works for existing projects; see "Legacy Pages alternative" below.

## Setup (one-time, ~10 minutes in the dashboard)

1. **Sign up** at cloudflare.com (free tier covers everything: 500 builds/month, unlimited bandwidth, unlimited sites).

2. **Workers & Pages → Create → Connect to Git**:
   - Authorize Cloudflare's GitHub app
   - Grant repo access (scope to just your book repo)

3. **Configure build**:
   - **Project name**: hyphens only (e.g. `my-book-guide`) — becomes the subdomain
   - **Production branch**: `main`
   - **Build command**: `npm install && npm run build`
     (or `cd guides/web && npm install && npm run build` for monorepo setups)
   - **Deploy command**: `npx wrangler deploy`
     (or `cd guides/web && npx wrangler deploy` for monorepo)

4. **Customize `wrangler.toml`** at scaffold root (or your Astro project root):
   - Edit `name = "your-book-name"` to match the dashboard project name
   - `[assets] directory = "./dist/"` — should match Astro's build output

5. **Save and Deploy.** First build takes ~5-7 minutes (mostly npm install). After: every push to main auto-deploys.

URL: `https://<project-name>.<your-account>.workers.dev`.

## The `cd` prefix for monorepo Astro projects

When `wrangler.toml` lives in a subdirectory (e.g. `guides/web/wrangler.toml`), Cloudflare runs commands from the repo root by default. Wrangler can't find its config there → deploy fails with "Could not detect a directory containing static files".

Fix: prefix both **build** and **deploy** commands with `cd <subdir> &&` so they execute in the same working directory as `wrangler.toml`. Build commands also need this since they produce the `./dist/` that wrangler.toml's `[assets]` reads.

## Build-container quirks: poppler + uv missing

Cloudflare's build container ships Node + npm but **not** `pdftocairo` (poppler-utils) or `uv` (Python venv manager). If your book uses the figure or notebook pipelines (recipe 03):

- The scripts already graceful-skip on missing tools — build won't fail
- **But** the public/figures/ and public/notebooks/ directories will be empty
- Two solutions documented in recipe 03; the recommended one is committing the derived artifacts (remove their lines from .gitignore)

## Legacy Pages alternative

For accounts still on the Pages-only flow (or by explicit preference):

- Use the `.github/workflows/deploy.yml` template that ships in v2.0 (legacy path)
- Add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` GitHub secrets
- Token created at **My Profile → API Tokens → Create Custom Token** with permissions: `Account / Cloudflare Pages / Edit`
- Push to main triggers the workflow

This path doesn't use `wrangler.toml`. URL: `<project>.pages.dev`.

## Common gotchas

- **First deploy 404s** — Cloudflare takes ~30s after the deploy completes to propagate DNS. Refresh after a minute.
- **Build succeeds but deploy fails with "Could not detect static files"** — `wrangler.toml` is in a subdir; the deploy command needs the `cd` prefix.
- **Project name with underscores** breaks the subdomain. Always hyphens (e.g. `my-book` not `my_book`).
- **Deploy command field doesn't exist in older dashboard UI** — Cloudflare migrated the dashboard; some older accounts see only "Build command" and skip Deploy. In that case, `npx wrangler deploy` runs automatically after the build command if `wrangler.toml` is present.

## Custom domain

See `recipes/10-custom-domain.md`.

## Canonical files

- `wrangler.toml` at scaffold root — Workers + Static Assets config
- `.github/workflows/deploy.yml` (preserved from v1) — legacy Pages OAuth path

## Reference implementation

[`~/Claude/post_transformers/guides/web/wrangler.toml`](../../post_transformers/guides/web/wrangler.toml) — production-deployed to `post-transformers-guide.brandon-m-behring.workers.dev` since 2026-05-18.
