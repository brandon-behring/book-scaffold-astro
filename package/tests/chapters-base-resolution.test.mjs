/**
 * tests/chapters-base-resolution.test.mjs — readChaptersBase (v4.1.1 #63)
 *                                          + readBookSchemaConfig (v4.7.0 #75).
 *
 * Verifies the helpers that let validate.mjs + build-labels.mjs honor
 * both consumer config forms:
 *   - Raw Astro `chapters: defineCollection({ loader: glob({ base: ... }) })`
 *     (v4.1.1 form, closed #63)
 *   - v4.5+ `defineBookSchemas({ preset, chaptersBase })` form (v4.7.0, #75)
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
 *   - v4.5+ defineBookSchemas({ chaptersBase }) form picked up (#75)
 *   - v4.5+ defineBookSchemas({ preset }) extracted by readBookSchemaConfig (#75)
 *   - `profile` accepted as backward-compat alias for `preset` (#75)
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readChaptersBase, readBookSchemaConfig } from '../scripts/walk-mdx.mjs';

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

test('#80: corpus mode defaults to the shared content root', async () => {
  await withProject(
    () => {},
    async (root) => {
      assert.equal(
        await readChaptersBase(root, { corpus: { books: [] } }),
        resolve(root, 'src/content'),
      );
    },
  );
});

test('#80: corpus mode still honors BOOK_CHAPTERS_DIR', async () => {
  await withProject(
    () => {},
    async (root) => {
      const previous = process.env.BOOK_CHAPTERS_DIR;
      process.env.BOOK_CHAPTERS_DIR = './corpus-content';
      try {
        assert.equal(
          await readChaptersBase(root, { corpus: { books: [] } }),
          resolve(root, 'corpus-content'),
        );
      } finally {
        if (previous === undefined) delete process.env.BOOK_CHAPTERS_DIR;
        else process.env.BOOK_CHAPTERS_DIR = previous;
      }
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

test('#147: comments/spread scaffold do not steal a later supplements base', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `/** The scaffold supplies the default chapters collection. */
const scaffold = defineBookSchemas();
// Example only: const chapters = defineCollection({ loader: glob({ base: './wrong' }) });
const supplements = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/supplements' }),
});
export const collections = { ...scaffold.collections, supplements };
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

test('readChaptersBase: inline chapters property collection remains supported', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `export const collections = {
  chapters: defineCollection({ loader: glob({ base: './src/content/inline-chapters' }) }),
};
`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/inline-chapters'),
      );
    },
  );
});

// ===== v4.7.0 (#75): defineBookSchemas({ preset, chaptersBase }) form =====

test('readChaptersBase: v4.5+ defineBookSchemas({ chaptersBase }) form is picked up (#75)', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
export const { collections } = defineBookSchemas({
  preset: 'research-portfolio',
  chaptersBase: './src/content/textbook',
});
`,
      );
    },
    async (root) => {
      assert.equal(
        await readChaptersBase(root),
        resolve(root, 'src/content/textbook'),
      );
    },
  );
});

test('readChaptersBase: defineBookSchemas without chaptersBase returns default', async () => {
  // Regression: setting only `preset` should not change directory resolution.
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
export const { collections } = defineBookSchemas({ preset: 'research-portfolio' });
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

test('readBookSchemaConfig: missing content.config returns both nulls', async () => {
  await withProject(
    () => {},
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.deepEqual(result, { preset: null, chaptersBase: null });
    },
  );
});

test('readBookSchemaConfig: defineBookSchemas({ preset }) extracts preset', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `export const { collections } = defineBookSchemas({ preset: 'research-portfolio' });`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.equal(result.preset, 'research-portfolio');
      assert.equal(result.chaptersBase, null);
    },
  );
});

test('readBookSchemaConfig: profile accepted as backward-compat alias', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `export const { collections } = defineBookSchemas({ profile: 'academic' });`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.equal(result.preset, 'academic');
    },
  );
});

test('readBookSchemaConfig: preset wins when both preset and profile present', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `export const { collections } = defineBookSchemas({
  preset: 'research-portfolio',
  profile: 'academic',
});`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.equal(result.preset, 'research-portfolio');
    },
  );
});

test('readBookSchemaConfig: extracts both preset and chaptersBase', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `export const { collections } = defineBookSchemas({
  preset: 'research-portfolio',
  chaptersBase: './src/content/textbook',
});`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.equal(result.preset, 'research-portfolio');
      assert.equal(result.chaptersBase, './src/content/textbook');
    },
  );
});

test('readBookSchemaConfig: double-quoted strings work', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `export const { collections } = defineBookSchemas({ preset: "tools", chaptersBase: "src/content/foo" });`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.equal(result.preset, 'tools');
      assert.equal(result.chaptersBase, 'src/content/foo');
    },
  );
});

test('readBookSchemaConfig: template-literal values fall back to null', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `const dir = 'textbook';
export const { collections } = defineBookSchemas({
  preset: 'research-portfolio',
  chaptersBase: \`./src/content/\${dir}\`,
});`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      // preset still extracts (string literal), chaptersBase is dynamic → null.
      assert.equal(result.preset, 'research-portfolio');
      assert.equal(result.chaptersBase, null);
    },
  );
});

test('readBookSchemaConfig: .mjs config variant also parses', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.mjs'),
        `export const { collections } = defineBookSchemas({ preset: 'course-notes' });`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.equal(result.preset, 'course-notes');
    },
  );
});

test('readBookSchemaConfig: no defineBookSchemas call returns both nulls', async () => {
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        // Raw Astro form only — no defineBookSchemas call anywhere.
        `const chapters = defineCollection({ loader: glob({ base: './src/content/foo' }) });
export const collections = { chapters };`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.deepEqual(result, { preset: null, chaptersBase: null });
    },
  );
});

test('readBookSchemaConfig: tabs + irregular whitespace in options object', async () => {
  // Real-world configs sometimes use tabs or unusual whitespace. The
  // regex must be permissive about whitespace around the colon.
  await withProject(
    (root) => {
      writeFileSync(
        join(root, 'src/content.config.ts'),
        `export const { collections } = defineBookSchemas({\n\tpreset:\t'minimal',\n});`,
      );
    },
    async (root) => {
      const result = await readBookSchemaConfig(root);
      assert.equal(result.preset, 'minimal');
    },
  );
});
