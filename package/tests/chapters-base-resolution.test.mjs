/**
 * tests/chapters-base-resolution.test.mjs — readChaptersBase (v4.1.1 #63).
 *
 * Verifies the helper that lets validate.mjs + build-labels.mjs honor
 * `loader.base` overrides in the consumer's content.config.{ts,mjs,js}.
 *
 * Coverage:
 *   - No content.config file → default src/content/chapters
 *   - Default content.config (defineBookSchemas) → default path
 *   - Custom loader.base with single-quoted string → resolved path
 *   - Custom loader.base with double-quoted string → resolved path
 *   - Custom loader.base with no leading `./` → resolved path
 *   - .mjs and .js extensions also work
 *   - Dynamic base (template literal) falls back to default
 *   - BOOK_CHAPTERS_DIR env wins over file parse
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readChaptersBase } from '../scripts/walk-mdx.mjs';

async function withProject(setup, fn) {
  // BUG FIX (v4.1.2): make the harness ACTUALLY async — `try { return fn(dir) }
  // finally { rm(dir) }` was running the cleanup synchronously, while `fn` (an
  // async test) was still in flight. CI hit a race where the dir was deleted
  // before readChaptersBase's readFile() completed, causing readFile to fail
  // and the helper to return its DEFAULT_BASE fallback. Local + CI both pass
  // when the cleanup awaits the async test.
  const dir = mkdtempSync(join(tmpdir(), 'chapters-base-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    setup(dir);
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('readChaptersBase: missing content.config returns default', async () => {
  await withProject(
    () => {},
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/chapters'),
      );
    },
  );
});

test('readChaptersBase: default defineBookSchemas config returns default', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';\nexport const { collections } = defineBookSchemas();\n`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/chapters'),
      );
    },
  );
});

test('readChaptersBase: single-quoted loader.base override returns custom path', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
const chapters = defineCollection({
  loader: glob({
    pattern: ['**/*.{md,mdx}', '!**/_*'],
    base: './src/content/experimentation',
  }),
  schema: anySchema,
});
export const collections = { chapters };
`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/experimentation'),
      );
    },
  );
});

test('readChaptersBase: double-quoted loader.base override works', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `const chapters = defineCollection({
  loader: glob({ base: "src/content/guides" }),
});
export const collections = { chapters };
`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/guides'),
      );
    },
  );
});

test('readChaptersBase: .mjs config also parses', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.mjs'),
        `const chapters = defineCollection({ loader: glob({ base: './src/content/mjs-test' }) });\nexport const collections = { chapters };`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/mjs-test'),
      );
    },
  );
});

test('readChaptersBase: dynamic base (template literal) falls back to default', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        // Template literal — regex won't match (only string literals supported).
        `const dir = 'guides';
const chapters = defineCollection({
  loader: glob({ base: \`./src/content/\${dir}\` }),
});
export const collections = { chapters };
`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/chapters'),
      );
    },
  );
});

test('readChaptersBase: BOOK_CHAPTERS_DIR env wins over file parse', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `const chapters = defineCollection({ loader: glob({ base: './src/content/from-config' }) });`,
      );
    },
    async (root) => {
      const prev = process.env.BOOK_CHAPTERS_DIR;
      process.env.BOOK_CHAPTERS_DIR = './src/content/from-env';
      try {
        assert.equal(
          await readChaptersBase(root),
          resolve(root, 'src/content/from-env'),
        );
      } finally {
        if (prev === undefined) delete process.env.BOOK_CHAPTERS_DIR;
        else process.env.BOOK_CHAPTERS_DIR = prev;
      }
    },
  );
});

test('readChaptersBase: file exists with no chapters collection returns default', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        // No `chapters` identifier anywhere.
        `const notes = defineCollection({ loader: glob({ base: './src/content/notes' }) });
export const collections = { notes };
`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/chapters'),
      );
    },
  );
});
