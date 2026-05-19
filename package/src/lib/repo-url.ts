/**
 * Repository URL constants used by CodeRef and CodeBlock components.
 *
 * Centralized here so renaming the repo or moving branches is a one-file
 * change rather than a hunt across components.
 *
 * If the repo is later mirrored to a different host, update GITHUB_BASE
 * accordingly; the components do not assume GitHub-specific anchor syntax
 * beyond #L<N>-L<M>, which all major hosts (GitHub, GitLab, Codeberg)
 * support.
 */
export const GITHUB_REPO = 'brandon-behring/post_transformers';
export const GITHUB_BRANCH = 'main';
export const GITHUB_BASE = `https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}`;

/**
 * Build a GitHub line-anchor URL.
 *   buildGithubUrl('experiments/jax/week04/s4.py', 42)        -> .../s4.py#L42
 *   buildGithubUrl('experiments/jax/week04/s4.py', 42, 58)    -> .../s4.py#L42-L58
 *   buildGithubUrl('experiments/jax/week04/s4.py')            -> .../s4.py
 */
export function buildGithubUrl(path: string, line?: number, lineEnd?: number): string {
  const cleanPath = path.replace(/^\/+/, '');
  let url = `${GITHUB_BASE}/${cleanPath}`;
  if (line !== undefined) {
    url += `#L${line}`;
    if (lineEnd !== undefined && lineEnd !== line) {
      url += `-L${lineEnd}`;
    }
  }
  return url;
}
