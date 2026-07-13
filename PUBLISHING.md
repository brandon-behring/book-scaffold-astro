# Publishing `book-scaffold-astro`

The toolkit and bootstrap CLI publish automatically from
`.github/workflows/publish.yml` when a main-reachable `vX.Y.Z` tag is pushed.
npm trusted publishing uses GitHub OIDC; no long-lived `NPM_TOKEN` is part of
the release path.

Last verified: 2026-07-13 (`v5.1.0`).

## Canonical release state

- npm's `latest` tag is the canonical current release.
- `CHANGELOG.md` is the canonical release history.
- Git tags identify the exact source for each release.
- GitHub Release objects are not maintained as a second release ledger. They
  stop at v4.9.0 by design; do not infer package freshness from that page.

## Invariants

1. `package/package.json` and `create-book/package.json` have the same version.
2. The corresponding two workspace entries in `package-lock.json` match.
3. The tag is exactly `v<package version>`.
4. The tagged commit is reachable from `origin/main`.
5. `package-lock.json` contains no `file:*.tgz` dependency.
6. Both packages pass their tests and pack the required runtime/docs/license
   files before either irreversible publish begins.

The workflow enforces these conditions. Do not bypass them by publishing from
a feature branch or by publishing either workspace manually.

## Prepare a release

Work from an integrated, clean branch that is ready to fast-forward `main`.

```bash
git fetch origin main --tags
git merge-base --is-ancestor origin/main HEAD

npm install
npm run build --workspace package
npm test --workspace package
npm run check:types --workspace package
npm test --workspace create-book
npm run build --workspace demo
```

Run any risk-specific gates too: gallery interaction/visual checks for rendered
UI changes, root/subpath builds for URL work, and a generated-book/PDF smoke for
scaffold changes.

Update `CHANGELOG.md`, then bump both public workspaces without creating npm's
own tag:

```bash
npm version X.Y.Z --workspace package --no-git-tag-version
npm version X.Y.Z --workspace create-book --no-git-tag-version
npm install --package-lock-only
```

Verify lock-step and the lockfile guard:

```bash
node - <<'NODE'
const lock = require('./package-lock.json');
const toolkit = require('./package/package.json').version;
const cli = require('./create-book/package.json').version;
const lockedToolkit = lock.packages.package.version;
const lockedCli = lock.packages['create-book'].version;
if (new Set([toolkit, cli, lockedToolkit, lockedCli]).size !== 1) {
  throw new Error(JSON.stringify({ toolkit, cli, lockedToolkit, lockedCli }));
}
console.log(`lock-step ${toolkit}`);
NODE

! grep -nE 'file:[^" ]*\.tgz' package-lock.json
```

Commit the release metadata only after all four values and the changelog agree.

## Publish

Push the release commit to `main` first. Confirm the remote advanced to the
exact commit, then create and push the annotated tag:

```bash
git push origin HEAD:main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Watch the workflow to completion:

```bash
gh run list --workflow publish.yml --limit 3
gh run watch <run-id> --exit-status
```

The job performs:

1. tag-ancestry and lockfile guards;
2. workspace install, toolkit build/tests, create-book tests, and lock-step
   tag verification;
3. a fresh academic scaffold installed from the local toolkit tarball, then
   validate/build (and the current PDF smoke contract);
4. OIDC publication of the toolkit, then create-book; and
5. retrying registry verification for both versions.

After success, verify independently:

```bash
npm view @brandon_m_behring/book-scaffold-astro version
npm view @brandon_m_behring/create-book version
git merge-base --is-ancestor vX.Y.Z origin/main
```

Close the shipped milestone/issues with tag, commit, test, and workflow receipts.

## Dry run and recovery

`workflow_dispatch` accepts an existing tag and `dry_run=true`; it runs every
guard and smoke step but skips both publishes and registry verification. Use it
to test workflow changes before a real release.

`force=true` bypasses ancestry only for legitimate historical-tag replay. It is
not a normal release escape hatch.

If the pre-publish smoke fails before either publish step and the repair changes
the tagged source, first verify both registry versions are absent, delete the
unpublished tag locally and remotely, land the repair on `main`, then recreate
the tag at the repaired commit. Do not move a tag after either npm artifact
exists.

npm versions are immutable. If one package publishes and the second fails:

- do not overwrite or unpublish the successful version;
- diagnose the failed workspace/trusted-publisher state;
- retry the same tag only when the failed version is still absent and the
  workflow can safely reach its publish step; otherwise cut the next patch
  version for both packages and document the partial artifact explicitly.

## One-time trusted-publisher setup

Each npm package must name this repository and `.github/workflows/publish.yml`
as its trusted GitHub Actions publisher. The workflow requires `id-token: write`
and pins npm 11.7.0 (above trusted publishing's 11.5.1 minimum) on the Node 22
runner. Account/password,
2FA, and local token instructions are intentionally outside the recurring
release procedure because local `npm publish` is not the supported path.
