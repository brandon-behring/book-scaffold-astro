/**
 * tests/validate-walker.test.mjs — node:test suite for the walkMdx
 * generator in scripts/validate.mjs (closes #52).
 *
 * Imports from scripts/validate.mjs directly (the script exports walkMdx
 * for testability; the rest of the script self-executes on import only
 * if invoked as a CLI, which node:test doesn't do).
 *
 * Run: node --test tests/validate-walker.test.mjs
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkMdx } from '../scripts/walk-mdx.mjs';

let workRoot;
before(async () => {
  workRoot = await mkdtemp(join(tmpdir(), 'validate-walker-'));
});
after(async () => {
  await rm(workRoot, { recursive: true, force: true });
});

async function collect(asyncIter) {
  const out = [];
  for await (const item of asyncIter) out.push(item);
  return out.sort();
}

test('walkMdx: empty dir yields nothing', async () => {
  const dir = join(workRoot, 'empty');
  await mkdir(dir, { recursive: true });
  const files = await collect(walkMdx(dir));
  assert.deepEqual(files, []);
});

test('walkMdx: yields .md and .mdx files in flat dir', async () => {
  const dir = join(workRoot, 'flat');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'a.mdx'), '');
  await writeFile(join(dir, 'b.md'), '');
  await writeFile(join(dir, 'c.txt'), ''); // should NOT be yielded
  const files = await collect(walkMdx(dir));
  assert.deepEqual(files, ['a.mdx', 'b.md']);
});

test('walkMdx: recurses into subdirs with forward-slash separator', async () => {
  const dir = join(workRoot, 'nested');
  await mkdir(join(dir, 'sub', 'deeper'), { recursive: true });
  await writeFile(join(dir, 'top.mdx'), '');
  await writeFile(join(dir, 'sub', 'mid.mdx'), '');
  await writeFile(join(dir, 'sub', 'deeper', 'leaf.md'), '');
  const files = await collect(walkMdx(dir));
  assert.deepEqual(files, ['sub/deeper/leaf.md', 'sub/mid.mdx', 'top.mdx']);
});

test('walkMdx: excludes files and every nested path segment beginning with underscore', async () => {
  const dir = join(workRoot, 'hidden');
  await mkdir(join(dir, '_drafts', 'nested'), { recursive: true });
  await mkdir(join(dir, 'visible', '_private'), { recursive: true });
  await writeFile(join(dir, '_chapter.mdx'), '');
  await writeFile(join(dir, '_drafts', 'nested', 'draft.mdx'), '');
  await writeFile(join(dir, 'visible', '_private', 'draft.mdx'), '');
  await writeFile(join(dir, 'visible', 'chapter.mdx'), '');
  const files = await collect(walkMdx(dir));
  assert.deepEqual(files, ['visible/chapter.mdx']);
});

test('walkMdx: missing dir returns gracefully (zero yields)', async () => {
  const files = await collect(walkMdx(join(workRoot, 'does-not-exist')));
  assert.deepEqual(files, []);
});

test('walkMdx: ignores non-.md/.mdx extensions', async () => {
  const dir = join(workRoot, 'mixed');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'real.mdx'), '');
  await writeFile(join(dir, 'image.png'), '');
  await writeFile(join(dir, 'notes.txt'), '');
  await writeFile(join(dir, 'config.json'), '');
  await writeFile(join(dir, 'script.mjs'), '');
  const files = await collect(walkMdx(dir));
  assert.deepEqual(files, ['real.mdx']);
});

test('walkMdx: yields case-sensitive .MD/.MDX (regex is case-sensitive)', async () => {
  // Match the historical glob('**/*.{md,mdx}') behavior — case-sensitive on POSIX.
  // If consumers want case-insensitive, they should fix their filenames.
  const dir = join(workRoot, 'case');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'lower.mdx'), '');
  await writeFile(join(dir, 'upper.MDX'), '');
  await writeFile(join(dir, 'mixed.Mdx'), '');
  const files = await collect(walkMdx(dir));
  assert.deepEqual(files, ['lower.mdx']);
});
