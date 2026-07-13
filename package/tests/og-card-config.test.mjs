/**
 * Focused public-wiring and Base metadata coverage for build-time OG cards
 * (#157). The renderer itself has separate unit/integration coverage; this
 * file guards config stripping/order plus the page > corpus > static metadata
 * contract consumers observe before post-render generation runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative as relativePath, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  defineBookConfig,
  defineStyle,
  minimalStyle,
} from '../dist/index.mjs';

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '..');
const astro = join(repoRoot, 'node_modules', '.bin', 'astro');

function integration(name) {
  return { name, hooks: {} };
}

test('#157: OG generation is opt-in, stripped, and installed after every extra integration', async () => {
  const styleExtra = integration('fixture:style-extra');
  const topExtra = integration('fixture:top-extra');
  const common = {
    styles: [minimalStyle, defineStyle({ extraIntegrations: [styleExtra] })],
    site: 'https://cards.test.invalid',
    extraIntegrations: [topExtra],
  };

  const disabled = await defineBookConfig(common);
  const explicitFalse = await defineBookConfig({
    ...common,
    seo: { ogCards: false },
  });
  const objectFalse = await defineBookConfig({
    ...common,
    seo: { ogCards: { enabled: false, exclude: ['/print/'] } },
  });
  const enabled = await defineBookConfig({
    ...common,
    seo: {
      ogImage: '/static.png',
      twitterHandle: '@fixture',
      ogCards: { exclude: ['/print/'] },
    },
  });

  const disabledNames = disabled.integrations.map(({ name }) => name);
  assert.deepEqual(explicitFalse.integrations.map(({ name }) => name), disabledNames);
  assert.deepEqual(objectFalse.integrations.map(({ name }) => name), disabledNames);
  assert.deepEqual(disabledNames.slice(-2), [styleExtra.name, topExtra.name]);
  assert.deepEqual(
    enabled.integrations.slice(0, -1).map(({ name }) => name),
    disabledNames,
    'enabling cards should add exactly one final integration',
  );
  assert.equal(enabled.integrations.at(-1)?.name, 'book-scaffold-og-cards');
  assert.equal(
    typeof enabled.integrations.at(-1)?.hooks?.['astro:build:done'],
    'function',
    'the final integration should own post-render generation',
  );
  assert.ok(!('seo' in enabled), 'the package SEO block must not leak into Astro config');

  const scaffold = enabled.integrations.find(({ name }) => name === 'book-scaffold-astro');
  let injectedConfig;
  await scaffold.hooks['astro:config:setup']({
    injectScript() {},
    injectRoute() {},
    updateConfig(value) { injectedConfig = value; },
    config: { root: new URL('../', import.meta.url) },
  });
  const plugin = injectedConfig.vite.plugins.find(
    ({ name }) => name === 'book-scaffold:book-config',
  );
  const resolvedId = plugin.resolveId('virtual:book-scaffold/book-config');
  const source = plugin.load(resolvedId);
  const virtualConfig = JSON.parse(source.slice('export default '.length, -1));
  assert.deepEqual(virtualConfig.seo, {
    ogImage: '/static.png',
    twitterHandle: '@fixture',
  });
  assert.ok(!('ogCards' in virtualConfig.seo), 'build policy must stay out of runtime SEO');
});

const routesOff = {
  references: false,
  search: false,
  print: false,
  chapters: false,
  convergence: false,
  landing: false,
  frontmatter: false,
  tips: false,
  exercises: false,
  practiceExam: false,
  glossary: false,
  answers: false,
  flashcards: false,
};

function page({ title, ogImage, bookId, pagefindSurface }) {
  const props = [
    `title=${JSON.stringify(title)}`,
    'showSidebar={false}',
    'showChrome={false}',
    ogImage === undefined ? null : `ogImage=${JSON.stringify(ogImage)}`,
    bookId === undefined ? null : `bookId=${JSON.stringify(bookId)}`,
    pagefindSurface === undefined
      ? null
      : `pagefindSurface=${JSON.stringify(pagefindSurface)}`,
  ].filter(Boolean).join(' ');
  return `---\nimport Base from '@brandon_m_behring/book-scaffold-astro/layouts/Base.astro';\n---\n<Base ${props}><p>${title}</p></Base>\n`;
}

async function readRoute(root, route) {
  return readFile(join(root, 'dist', route, 'index.html'), 'utf8');
}

test('#157: Base resolves image precedence/base exactly once and emits exact corpus markers', async () => {
  // Clone the known-green corpus fixture under the workspace. This preserves
  // Astro's content virtual-module setup while keeping the test isolated from
  // the corpus suite, which Node may run concurrently.
  const fixture = join(packageRoot, 'tests', 'fixtures', 'corpus');
  const sandbox = await mkdtemp(join(packageRoot, '.test-og-base-'));
  const root = join(sandbox, 'consumer');
  try {
    const generated = new Set([
      '.astro',
      'node_modules',
      'dist',
      '.test-debug-dist',
      '.test-dist-root',
      '.test-dist-canary',
    ]);
    await cp(fixture, root, {
      recursive: true,
      filter(source) {
        const first = relativePath(fixture, source).split(sep)[0];
        return !generated.has(first);
      },
    });
    await mkdir(join(root, 'src', 'pages'), { recursive: true });
    await writeFile(
      join(root, 'corpus.mjs'),
      `import { defineBookCorpus } from '@brandon_m_behring/book-scaffold-astro';
export default defineBookCorpus({
  preset: 'research-portfolio',
  books: [
    { id: 'evaluation', title: 'Corpus Volume', image: '/book.png' },
    { id: 'llm-app-engineering', title: 'Second Volume' },
  ],
});
`,
    );
    await writeFile(
      join(root, 'astro.config.mjs'),
      `import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';
import corpus from './corpus.mjs';
export default await defineBookConfig({
  styles: [researchPortfolioStyle],
  corpus,
  site: 'https://assets.example/library/',
  base: '/library/',
  outDir: './dist',
  routes: ${JSON.stringify(routesOff)},
  seo: { ogImage: '/static.png' },
});
`,
    );
    const pages = {
      'index.astro': page({
        title: 'Corpus surface',
        pagefindSurface: 'corpus',
      }),
      'book.astro': page({ title: 'Book default', bookId: 'evaluation' }),
      'page.astro': page({
        title: 'Page override',
        bookId: 'evaluation',
        ogImage: '/page.png',
      }),
      'relative.astro': page({ title: 'Relative asset', ogImage: 'relative.png' }),
      'prefixed.astro': page({
        title: 'Already prefixed',
        ogImage: '/library/prefixed.png',
      }),
      'absolute.astro': page({
        title: 'Absolute asset',
        ogImage: 'https://cdn.example/card.png?version=1',
      }),
      'trimmed.astro': page({
        title: 'Trimmed absolute asset',
        ogImage: '  https://cdn.example/trimmed.png  ',
      }),
      'protocol-relative.astro': page({
        title: 'Protocol-relative asset',
        ogImage: '//cdn.example/protocol-relative.png',
      }),
    };
    await Promise.all(
      Object.entries(pages).map(([name, source]) =>
        writeFile(join(root, 'src', 'pages', name), source)),
    );

    await execFileAsync(astro, ['build'], {
      cwd: root,
      env: { ...process.env },
      maxBuffer: 8 * 1024 * 1024,
    });

    const [
      surface,
      book,
      pageOverride,
      relative,
      prefixed,
      absolute,
      trimmed,
      protocolRelative,
    ] = await Promise.all([
      readRoute(root, ''),
      readRoute(root, 'book'),
      readRoute(root, 'page'),
      readRoute(root, 'relative'),
      readRoute(root, 'prefixed'),
      readRoute(root, 'absolute'),
      readRoute(root, 'trimmed'),
      readRoute(root, 'protocol-relative'),
    ]);

    assert.match(surface, /<html[^>]*data-book-scaffold-surface="corpus"/);
    assert.doesNotMatch(surface, /data-book-scaffold-book=/);
    assert.match(surface, /property="og:image" content="https:\/\/assets\.example\/library\/static\.png"/);

    assert.match(book, /<html[^>]*data-book-scaffold-book="evaluation"/);
    assert.doesNotMatch(book, /data-book-scaffold-surface=/);
    assert.match(book, /property="og:image" content="https:\/\/assets\.example\/library\/book\.png"/);

    assert.match(pageOverride, /property="og:image" content="https:\/\/assets\.example\/library\/page\.png"/);
    assert.doesNotMatch(pageOverride, /library\/library\/page\.png/);
    assert.match(relative, /property="og:image" content="https:\/\/assets\.example\/library\/relative\.png"/);
    assert.match(prefixed, /property="og:image" content="https:\/\/assets\.example\/library\/prefixed\.png"/);
    assert.doesNotMatch(prefixed, /library\/library\/prefixed\.png/);
    assert.match(absolute, /property="og:image" content="https:\/\/cdn\.example\/card\.png\?version=1"/);
    assert.match(trimmed, /property="og:image" content="https:\/\/cdn\.example\/trimmed\.png"/);
    assert.match(
      protocolRelative,
      /property="og:image" content="https:\/\/cdn\.example\/protocol-relative\.png"/,
    );

    await writeFile(
      join(root, 'src', 'pages', 'invalid-image.astro'),
      page({ title: 'Invalid traversal', ogImage: '/%252e%252e/private.png' }),
    );
    await assert.rejects(
      () => execFileAsync(astro, ['build'], {
        cwd: root,
        env: { ...process.env },
        maxBuffer: 8 * 1024 * 1024,
      }),
      (error) => {
        assert.match(
          `${error.stdout ?? ''}\n${error.stderr ?? ''}`,
          /Open Graph image must not contain decoded .* path segments/,
        );
        return true;
      },
    );
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
