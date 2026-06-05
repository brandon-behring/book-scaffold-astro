/**
 * repo-url — resolve and build GitHub source links for CodeRef / CodeBlock.
 *
 * The repo is no longer hardcoded (#109). `buildGithubUrl` takes an explicit
 * `repo` + `branch`; the integration resolves them per book — from
 * `defineBookConfig({ githubRepo })` (override), else auto-detected from the
 * consumer's own `package.json` `repository` (or git remote) via
 * `parseRepoSlug`. When nothing resolves, the components throw rather than
 * emit links to the wrong repo (the old silent default was
 * `brandon-behring/post_transformers`).
 */

/** Default branch when a book configures a repo but no branch. */
export const DEFAULT_GITHUB_BRANCH = 'main';

/**
 * Derive an `owner/repo` slug from an npm `repository` field (string or
 * `{ url }`) or a raw git remote URL. Handles https, ssh, the `git+` prefix,
 * a trailing `.git`, and the `github:owner/repo` npm shorthand. Returns null
 * for anything that isn't a recognizable GitHub repo — no silent guess.
 */
export function parseRepoSlug(
  repository: string | { url?: string } | null | undefined,
): string | null {
  const raw =
    typeof repository === 'string'
      ? repository
      : repository && typeof repository === 'object'
        ? repository.url
        : undefined;
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s === '') return null;

  // npm shorthand: github:owner/repo
  const shorthand = s.match(/^github:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
  if (shorthand) return `${shorthand[1]}/${shorthand[2]}`;

  // https://github.com/owner/repo(.git), git+https://…, ssh git@github.com:owner/repo(.git)
  const m = s
    .replace(/^git\+/, '')
    .match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Extract the `origin` remote URL from the text of a `.git/config` file. */
export function originUrlFromGitConfig(gitConfigText: string): string | null {
  const m = gitConfigText.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
  return m ? m[1]! : null;
}

/**
 * Resolve a GitHub `owner/repo` by precedence (#109) — the rule that keeps a
 * book from ever silently linking to the wrong repo:
 *   1. explicit `override` (defineBookConfig `githubRepo`)
 *   2. the consumer's `package.json` `repository`
 *   3. the `origin` remote in `.git/config`
 *   4. null — the components then throw rather than guess.
 */
export function resolveGithubRepo(sources: {
  override?: string | null;
  packageJsonRepository?: string | { url?: string } | null;
  gitConfigText?: string | null;
}): string | null {
  if (sources.override) return sources.override;
  const fromPkg = parseRepoSlug(sources.packageJsonRepository ?? null);
  if (fromPkg) return fromPkg;
  if (sources.gitConfigText) {
    const fromGit = parseRepoSlug(originUrlFromGitConfig(sources.gitConfigText));
    if (fromGit) return fromGit;
  }
  return null;
}

/**
 * Build a GitHub line-anchor URL for an explicit repo + branch.
 *   buildGithubUrl('o/r', 'main', 'a/b.py')        -> https://github.com/o/r/blob/main/a/b.py
 *   buildGithubUrl('o/r', 'main', 'a/b.py', 42)     -> …/a/b.py#L42
 *   buildGithubUrl('o/r', 'main', 'a/b.py', 42, 58) -> …/a/b.py#L42-L58
 */
export function buildGithubUrl(
  repo: string,
  branch: string,
  path: string,
  line?: number,
  lineEnd?: number,
): string {
  const cleanPath = path.replace(/^\/+/, '');
  let url = `https://github.com/${repo}/blob/${branch}/${cleanPath}`;
  if (line !== undefined) {
    url += `#L${line}`;
    if (lineEnd !== undefined && lineEnd !== line) {
      url += `-L${lineEnd}`;
    }
  }
  return url;
}
