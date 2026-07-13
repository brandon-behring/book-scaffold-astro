# book-scaffold-astro — repository guide

This is the canonical, cross-tool guide for contributors and coding agents.
`AGENTS.md` points here so both discovery conventions load one maintained set
of instructions.

## Repository layout

- `package/` — published `@brandon_m_behring/book-scaffold-astro` toolkit.
- `create-book/` — lock-step `@brandon_m_behring/create-book` bootstrap CLI.
- `demo/` — in-repository academic consumer and build smoke target.
- `gallery/` — component gallery and browser interaction coverage.
- `docs/` — audits, roadmaps, and release planning records.

Read `package/CLAUDE.md` before changing consumer-facing authoring behavior; it
is also the guide shipped to downstream books. The API contract lives in
`PACKAGE_DESIGN.md`, and release history lives in `CHANGELOG.md`.

## Working rules

- Preserve unrelated local changes. Never reset, discard, or overwrite a
  contributor's dirty worktree.
- Add or update a regression test with every behavioral fix.
- Prefer fail-loud behavior for invalid configuration and authoring errors.
- Keep toolkit and create-book versions identical (D12). Release tags use the
  same version and must be reachable from `main`.
- Keep public documentation truthful for the code in the same commit.
- Both `CLAUDE.md` and `AGENTS.md` must exist at the repository root, in the
  toolkit tarball, and in every generated book. `AGENTS.md` is a pointer, not a
  second independently maintained guide.

## Verification

From the repository root:

```bash
npm install
npm run build --workspace package
npm test --workspace package
npm run check:types --workspace package
npm test --workspace create-book
npm run build --workspace demo
```

Run focused tests while iterating, then the full relevant gates before a
commit. Browser/visual changes also require the gallery interaction and visual
suites described in `package/CLAUDE.md`.

## Commits and releases

Use `type(scope): Imperative subject`. Explain the reason and externally
observable contract in the body when it is not obvious. Do not push, tag,
publish, or mutate GitHub state unless the user explicitly authorizes it.
Follow `PUBLISHING.md` for every release.
