/**
 * tests/repo-url.test.mjs — node:test suite for configurable GitHub repo
 * resolution (v4.15.0, #109).
 *
 * Before this, CodeRef/CodeBlock built links from a HARDCODED
 * `GITHUB_REPO = 'brandon-behring/post_transformers'` with no override, so
 * every other consumer book emitted links to the wrong repo (a silent
 * wrong-but-valid failure). The fix makes `buildGithubUrl` take an explicit
 * repo+branch, and `parseRepoSlug` derives `owner/repo` from the consumer's
 * own `package.json` `repository` field (or git remote) for zero-config
 * correctness; the component throws when nothing resolves rather than linking
 * to post_transformers.
 *
 * Tests import from dist/ since node:test can't load TS. Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseRepoSlug,
  resolveGithubRepo,
  originUrlFromGitConfig,
  buildGithubUrl,
} from '../dist/index.mjs';

test('parseRepoSlug: npm `repository` object forms → owner/repo', () => {
  assert.equal(
    parseRepoSlug({ url: 'git+https://github.com/brandon-behring/post_transformers.git' }),
    'brandon-behring/post_transformers',
  );
  assert.equal(parseRepoSlug({ type: 'git', url: 'https://github.com/owner/repo' }), 'owner/repo');
});

test('parseRepoSlug: string URL forms (https / ssh / git+ / shorthand)', () => {
  assert.equal(parseRepoSlug('https://github.com/owner/repo.git'), 'owner/repo');
  assert.equal(parseRepoSlug('git@github.com:owner/repo.git'), 'owner/repo');
  assert.equal(parseRepoSlug('git+ssh://git@github.com/owner/repo.git'), 'owner/repo');
  assert.equal(parseRepoSlug('github:owner/repo'), 'owner/repo'); // npm shorthand
  // hyphens, underscores, dots in names
  assert.equal(parseRepoSlug('https://github.com/a-b/c_d.e'), 'a-b/c_d.e');
});

test('parseRepoSlug: unresolvable input → null (no silent wrong default)', () => {
  assert.equal(parseRepoSlug(undefined), null);
  assert.equal(parseRepoSlug(null), null);
  assert.equal(parseRepoSlug(''), null);
  assert.equal(parseRepoSlug({}), null);
  assert.equal(parseRepoSlug('not a url'), null);
  assert.equal(parseRepoSlug('https://gitlab.com/owner/repo'), null); // non-GitHub host
});

test('buildGithubUrl: explicit repo + branch (no hardcoded default)', () => {
  assert.equal(
    buildGithubUrl('me/mybook', 'main', 'src/app.ts'),
    'https://github.com/me/mybook/blob/main/src/app.ts',
  );
  // leading slashes in path are stripped
  assert.equal(
    buildGithubUrl('me/mybook', 'trunk', '/src/app.ts'),
    'https://github.com/me/mybook/blob/trunk/src/app.ts',
  );
});

test('buildGithubUrl: line + range anchors', () => {
  assert.equal(
    buildGithubUrl('o/r', 'main', 'a/b.py', 42),
    'https://github.com/o/r/blob/main/a/b.py#L42',
  );
  assert.equal(
    buildGithubUrl('o/r', 'main', 'a/b.py', 42, 58),
    'https://github.com/o/r/blob/main/a/b.py#L42-L58',
  );
  // single-line range collapses to #L42 (no -L42)
  assert.equal(
    buildGithubUrl('o/r', 'main', 'a/b.py', 42, 42),
    'https://github.com/o/r/blob/main/a/b.py#L42',
  );
});

test('originUrlFromGitConfig: extracts the origin remote url only', () => {
  const cfg =
    '[core]\n\trepositoryformatversion = 0\n' +
    '[remote "origin"]\n\turl = git@github.com:owner/repo.git\n\tfetch = +refs/heads/*\n' +
    '[branch "main"]\n\tremote = origin\n';
  assert.equal(originUrlFromGitConfig(cfg), 'git@github.com:owner/repo.git');
  // a non-origin remote is ignored
  assert.equal(originUrlFromGitConfig('[remote "upstream"]\n\turl = x'), null);
  assert.equal(originUrlFromGitConfig(''), null);
});

test('resolveGithubRepo: precedence override > package.json > git > null (#109)', () => {
  // override wins over everything
  assert.equal(
    resolveGithubRepo({
      override: 'me/override',
      packageJsonRepository: { url: 'https://github.com/pkg/repo' },
      gitConfigText: '[remote "origin"]\n url = git@github.com:git/repo.git',
    }),
    'me/override',
  );
  // package.json beats git remote
  assert.equal(
    resolveGithubRepo({
      packageJsonRepository: { url: 'https://github.com/pkg/repo.git' },
      gitConfigText: '[remote "origin"]\n url = git@github.com:git/repo.git',
    }),
    'pkg/repo',
  );
  // git remote is the last resort
  assert.equal(
    resolveGithubRepo({ gitConfigText: '[remote "origin"]\n url = git@github.com:git/repo.git' }),
    'git/repo',
  );
  // a non-GitHub package.json repository falls through to the git remote
  assert.equal(
    resolveGithubRepo({
      packageJsonRepository: 'https://gitlab.com/x/y',
      gitConfigText: '[remote "origin"]\n url = https://github.com/git/repo',
    }),
    'git/repo',
  );
  // nothing resolvable → null, NEVER a silent wrong default
  assert.equal(resolveGithubRepo({}), null);
  assert.equal(resolveGithubRepo({ packageJsonRepository: null, gitConfigText: null }), null);
});
