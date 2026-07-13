import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  academicStyle,
  defineBookConfig,
  defineStyle,
  BookConfigError,
} from '../dist/index.mjs';
import { loadResolvedBookConfig } from '../scripts/resolve-book-config.mjs';

const DIST_INDEX_URL = pathToFileURL(resolve(import.meta.dirname, '..', 'dist', 'index.mjs')).href;

function integrationMetadata(config) {
  return config.integrations.find((integration) => integration.name === 'book-scaffold-astro')
    .__bookScaffoldResolvedConfig;
}

test('#179: a composed preset wins over an invalid environment value', async () => {
  const saved = process.env.BOOK_PRESET;
  process.env.BOOK_PRESET = 'bogus';
  try {
    const config = await defineBookConfig({
      styles: [academicStyle],
      site: 'https://test.invalid',
    });
    assert.equal(integrationMetadata(config).preset, 'academic');
  } finally {
    if (saved === undefined) delete process.env.BOOK_PRESET;
    else process.env.BOOK_PRESET = saved;
  }
});

test('#179: a preset-less style chain bridges through process environment', async () => {
  const saved = process.env.BOOK_PRESET;
  process.env.BOOK_PRESET = 'tools';
  try {
    const config = await defineBookConfig({
      styles: [defineStyle({ site: 'https://test.invalid' })],
    });
    assert.equal(integrationMetadata(config).preset, 'tools');
  } finally {
    if (saved === undefined) delete process.env.BOOK_PRESET;
    else process.env.BOOK_PRESET = saved;
  }
});

test('#179: .env bridges preset-less config and exhausted resolution warns once then uses minimal', () => {
  for (const withDotenv of [true, false]) {
    const root = mkdtempSync(join(tmpdir(), 'book-scaffold-preset-'));
    try {
      if (withDotenv) writeFileSync(join(root, '.env'), 'BOOK_PRESET=course-notes\n');
      const source = `
        import { defineBookConfig, defineStyle } from ${JSON.stringify(DIST_INDEX_URL)};
        delete process.env.BOOK_PRESET;
        delete process.env.BOOK_PROFILE;
        for (let i = 0; i < 2; i++) {
          const config = await defineBookConfig({ styles: [defineStyle({ site: 'https://test.invalid' })] });
          const integration = config.integrations.find((item) => item.name === 'book-scaffold-astro');
          console.log(integration.__bookScaffoldResolvedConfig.preset);
        }
      `;
      const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
        cwd: root,
        encoding: 'utf8',
        env: Object.fromEntries(
          Object.entries(process.env).filter(([key]) => key !== 'BOOK_PRESET' && key !== 'BOOK_PROFILE'),
        ),
      });
      assert.equal(result.status, 0, result.stderr);
      const expected = withDotenv ? 'course-notes\ncourse-notes\n' : 'minimal\nminimal\n';
      assert.equal(result.stdout, expected);
      const warningCount = (result.stderr.match(/fallback will be removed in v5/g) ?? []).length;
      assert.equal(warningCount, withDotenv ? 0 : 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('#179: invalid fallback candidate fails with the preset enum', async () => {
  const saved = process.env.BOOK_PRESET;
  process.env.BOOK_PRESET = 'bogus';
  try {
    await assert.rejects(
      defineBookConfig({ styles: [defineStyle({})], site: 'https://test.invalid' }),
      BookConfigError,
    );
  } finally {
    if (saved === undefined) delete process.env.BOOK_PRESET;
    else process.env.BOOK_PRESET = saved;
  }
});

test('#175: resolved integration metadata carries top-level-over-style numberStyle', async () => {
  const config = await defineBookConfig({
    styles: [academicStyle, defineStyle({ numberStyle: 'per-kind' })],
    numberStyle: 'shared',
    site: 'https://test.invalid',
  });
  assert.deepEqual(integrationMetadata(config), {
    preset: 'academic',
    numberStyle: 'shared',
    siblingBooks: {},
    chapterRoute: '/chapters/:id/',
    bookField: 'book',
  });
  assert.equal(
    Object.prototype.propertyIsEnumerable.call(
      config.integrations.find((item) => item.name === 'book-scaffold-astro'),
      '__bookScaffoldResolvedConfig',
    ),
    false,
  );
});

test('#175: invalid numberStyle values fail at config and tooling boundaries', async () => {
  await assert.rejects(
    defineBookConfig({
      styles: [academicStyle],
      numberStyle: 'separate',
      site: 'https://test.invalid',
    }),
    (error) => error instanceof BookConfigError && /shared \| per-kind/.test(error.message),
  );

  const root = mkdtempSync(join(tmpdir(), 'book-scaffold-config-'));
  try {
    writeFileSync(
      join(root, 'astro.config.mjs'),
      `export default { integrations: [{ name: 'book-scaffold-astro', ` +
        `__bookScaffoldResolvedConfig: { preset: 'minimal', numberStyle: 'separate' } }] };\n`,
    );
    await assert.rejects(loadResolvedBookConfig(root), /invalid numberStyle.*separate/);

    writeFileSync(
      join(root, 'astro.config.mjs'),
      `export default { integrations: [{ name: 'book-scaffold-astro', ` +
        `__bookScaffoldResolvedConfig: { preset: 'minimal', numberStyle: 'shared', ` +
        `siblingBooks: { design: { labels: './vendor/design-labels.json' } } } }] };\n`,
    );
    await assert.rejects(
      loadResolvedBookConfig(root),
      /invalid siblingBooks\.design.*\{ url: string, labels\?: string \}/,
    );

    writeFileSync(
      join(root, 'astro.config.mjs'),
      `export default { integrations: [{ name: 'book-scaffold-astro', ` +
        `__bookScaffoldResolvedConfig: { preset: 'minimal', numberStyle: 'shared', ` +
        `chapterRoute: '', bookField: 'book' } }] };\n`,
    );
    await assert.rejects(loadResolvedBookConfig(root), /invalid chapterRoute.*non-empty string/);

    writeFileSync(join(root, 'astro.config.mjs'), 'export default { base: 42 };\n');
    await assert.rejects(loadResolvedBookConfig(root), /invalid Astro base 42.*expected a string/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#175/#190: Vite loader reads composed metadata, evaluated base, and defaults', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-scaffold-config-'));
  try {
    writeFileSync(
      join(root, 'astro.config.mjs'),
      `import { defineBookConfig, minimalStyle, defineStyle } from ${JSON.stringify(DIST_INDEX_URL)};\n` +
        `const key = ['de', 'sign'].join('');\n` +
        `const labels = ['./vendor', 'design-labels.json'].join('/');\n` +
        `const chapterRoute = ['/', ':id', '/'].join('');\n` +
        `const mount = ['/library', 'books'].join('/');\n` +
        `export default await defineBookConfig({ styles: [minimalStyle, defineStyle({ numberStyle: 'per-kind' })], ` +
        `site: 'https://test.invalid', base: mount, chapterRoute, bookField: 'volume', ` +
        `siblingBooks: { [key]: { url: 'https://hub.example/library/design/', labels } } });\n`,
    );
    assert.deepEqual(await loadResolvedBookConfig(root), {
      preset: 'minimal',
      numberStyle: 'per-kind',
      siblingBooks: {
        design: {
          url: 'https://hub.example/library/design/',
          labels: './vendor/design-labels.json',
        },
      },
      chapterRoute: '/:id/',
      bookField: 'volume',
      base: '/library/books',
      integrationFound: true,
    });

    // Metadata emitted by pre-#147 integrations has no route fields. Tooling
    // must retain the historical single-book route during rolling upgrades.
    writeFileSync(
      join(root, 'astro.config.mjs'),
      `export default { integrations: [{ name: 'book-scaffold-astro', ` +
        `__bookScaffoldResolvedConfig: { preset: 'minimal', numberStyle: 'shared' } }] };\n`,
    );
    assert.deepEqual(await loadResolvedBookConfig(root), {
      preset: 'minimal',
      numberStyle: 'shared',
      siblingBooks: {},
      chapterRoute: '/chapters/:id/',
      bookField: 'book',
      base: '/',
      integrationFound: true,
    });

    writeFileSync(
      join(root, 'astro.config.mjs'),
      'export default { site: "https://test.invalid", base: "standalone/" };\n',
    );
    assert.deepEqual(await loadResolvedBookConfig(root), {
      preset: null,
      numberStyle: 'shared',
      siblingBooks: {},
      chapterRoute: '/chapters/:id/',
      bookField: 'book',
      base: 'standalone/',
      integrationFound: false,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#175: Vite loader fails loudly when Astro config evaluation fails', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-scaffold-config-'));
  try {
    writeFileSync(join(root, 'astro.config.mjs'), 'throw new Error("fixture exploded");\n');
    await assert.rejects(loadResolvedBookConfig(root), /failed to evaluate.*fixture exploded/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
