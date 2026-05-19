# Publishing setup — `@brandon_m_behring/book-scaffold-astro`

> One-time prerequisites and recurring commands for publishing the v3.0+
> npm package. Untracked until you decide it belongs in-repo.
> Last verified: 2026-05-18 (Phase A close).

## 0. Goal

Get `npm whoami` to return your username instead of `ENEEDAUTH`, then
publish `@brandon_m_behring/book-scaffold-astro@3.0.0-alpha.0` from the
`package/` workspace once Phase B builds it.

---

## 1. One-time account setup

1. **Account** — if you don't already have one, sign up at
   <https://www.npmjs.com/signup>. Free tier covers public scoped packages.
   *Current account*: username `brandon_m_behring` (verified 2026-05-18).

2. **Enable 2FA for publishing** — **mandatory** since 2022; npm rejects
   `npm publish` with `403 Forbidden` if 2FA is off, *regardless* of what
   `npm profile get` says about the account flag. The registry enforces
   per-publish; the account flag only controls whether the OTP prompt
   appears at login.

   Two paths:

   - **Account-wide 2FA** (recommended):
     ```bash
     npm profile enable-2fa auth-and-writes
     # prints QR; scan with Authy / 1Password / GitHub Mobile;
     # enter the resulting OTP to confirm enrollment.
     # SAVE THE RECOVERY CODES that print after enrollment.
     ```
     Then re-login (`npm login`) — token type changes to include 2FA. Each
     `npm publish` now prompts for an OTP (or pass `--otp=XXXXXX`).

   - **Granular access token with bypass-2FA** (CI-friendly):
     <https://www.npmjs.com/settings/brandon_m_behring/tokens> → "Generate
     New Token" → **Granular Access Token**. Permissions: *Read and write*
     for the specific package; check "Bypass 2FA when accessing this
     package". Copy token to `~/.npmrc` as
     `//registry.npmjs.org/:_authToken=npm_XXXXX`. Subsequent publishes
     skip the OTP prompt.

3. **Scope** — `@brandon_m_behring` is your **personal scope** (npm
   auto-attaches one personal scope per user, name = username verbatim).
   No org creation needed; the scope auto-claims on first publish.

   *Scope decision history*: master plan originally locked
   `@brandon-behring` (dashes). User account was created with
   underscores (`brandon_m_behring`); 2026-05-18 the scope was renamed
   to match — 78 references across PACKAGE_DESIGN, master plan,
   PUBLISHING.md, and memory.

4. **Verify the scope is unclaimed** (one-time, pre-publish):
   ```bash
   npm view @brandon_m_behring/book-scaffold-astro    # expect 404 (= OK to publish)
   ```

---

## 2. The login command

`npm adduser` is the legacy alias; the canonical command is `npm login`.
It opens a browser tab for the 2FA flow.

### From a desktop terminal (default path)

```bash
npm login
```

A URL prints; either the browser opens automatically or you copy-paste.
Log in, approve 2FA, return to the terminal. The session writes the auth
token to `~/.npmrc` as a line shaped like
`//registry.npmjs.org/:_authToken=npm_…`.

### Inside vscode-Claude / Claude bash sandbox — DON'T

This shell is snap-sandboxed (per `~/Claude/post_transformers/CLAUDE.md`
memory `env_uv_vscode_quirk.md`); it can't reliably spawn a browser
for the OAuth callback, and `~/.npmrc` may land in an XDG-shifted path
that doesn't survive shell exit.

→ Open a real terminal (the system Terminal app or a non-sandboxed VS
Code window) and run `npm login` there. The `~/.npmrc` token then
applies to every shell on this user account.

### Headless / SSH-only environments (e.g. a RunPod box)

Use the legacy username/password flow:
```bash
npm login --auth-type=legacy
# prompts for username, password, email, then a 2FA OTP code
```
This skips the browser. Not recommended for desktop use — the web flow
is more secure.

---

## 3. Verification

After login succeeds, all three should pass:

```bash
npm whoami                                   # your username, not ENEEDAUTH
npm config get registry                      # https://registry.npmjs.org/
cat ~/.npmrc | grep -c '_authToken'          # ≥1 line
```

If `npm whoami` still says `ENEEDAUTH`, `~/.npmrc` is probably in a
non-standard location (npm reads `~/.npmrc` then `$PREFIX/etc/npmrc`):
```bash
npm config get userconfig                    # path npm actually reads
npm config get globalconfig
```
If those don't point to `~/.npmrc`, set them:
```bash
npm config set userconfig "$HOME/.npmrc" --location=user
```

---

## 4. First publish (Phase B opener)

`npm` defaults scoped packages to `private` — which fails on the free
tier. The `--access public` flag claims the scope as public on the
first publish; subsequent publishes inherit visibility.

```bash
cd ~/Claude/book-scaffold-astro/package    # after Phase B restructure

npm run build                              # tsup; emits dist/
npm pack --dry-run                         # inspect what's about to ship
npm publish --tag alpha --access public    # first alpha — claims scope as public
```

Recurring publishes (after the first):
```bash
npm publish --tag alpha                    # alpha line (3.0.0-alpha.N)
# OR
npm publish                                # latest tag (3.x.y stable)
```

Verify the registry got it:
```bash
npm view @brandon_m_behring/book-scaffold-astro versions
npm view @brandon_m_behring/book-scaffold-astro@alpha
```

---

## 5. Maintenance

### Logout / switch accounts
```bash
npm logout                                 # revokes token in ~/.npmrc
```

### Token rotation
```bash
# Web UI: npmjs.com → Profile → Access Tokens → Revoke / Generate
# Then: npm logout && npm login
```

### Inspect tokens
```bash
cat ~/.npmrc                               # current token + registry config
npm token list                             # all active tokens for the account
```

---

## 6. Common snags

1. **`npm ERR! 404 Not Found - GET .../-/user/org.couchdb.user:…`** —
   stale registry config. Check `~/.npmrc` and any `.npmrc` in the
   current directory; remove non-default `registry=` lines.
   ```bash
   npm config set registry https://registry.npmjs.org/ --location=user
   ```

2. **`npm ERR! 403 Forbidden - PUT .../-/user/org.couchdb.user:…`** —
   you're logged in but the account lacks publish permission for the
   target scope. Likely the scope is owned by someone else; verify
   `@brandon_m_behring` is unclaimed via §1 step 3.

3. **`EAUTHIP` / `EAUTHUNKNOWN`** — IP allowlisting or network reaches
   npm via a proxy that strips auth. Browser flow handles it; the
   `--auth-type=legacy` path sometimes doesn't.

4. **`npm ERR! 402 Payment Required`** — first publish without
   `--access public`. The free tier requires explicit-public on the
   first scoped publish. Re-run with `npm publish --tag alpha --access public`.

5. **`npm ERR! cannot publish over previously published version`** —
   versions are immutable. Bump `package/package.json#version`
   (e.g. `3.0.0-alpha.0` → `3.0.0-alpha.1`) and re-publish.

6. **Two-factor flows show `OTP` prompt at publish time** — expected.
   Enter the 6-digit code from your TOTP app and continue.

---

## 7. References

- npm docs — *Creating and publishing scoped public packages*:
  <https://docs.npmjs.com/creating-and-publishing-scoped-public-packages>
- npm docs — *Configuring two-factor authentication*:
  <https://docs.npmjs.com/configuring-two-factor-authentication>
- `~/.claude/plans/i-want-to-investigate-recursive-yao.md` — master plan
  (D6 = npm scope choice, D8 = migration sequence).
- `~/Claude/book-scaffold-astro/PACKAGE_DESIGN.md` §13 — pre-publish
  verification recipe (after Phase B is built).
