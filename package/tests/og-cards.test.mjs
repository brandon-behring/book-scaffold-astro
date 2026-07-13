/** Focused runtime contract for deterministic build-time OG cards (#157). */
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createOgCardsIntegration,
  normalizeOgCardsConfig,
} from '../src/lib/og-cards.ts';

const PROFILES = [
  'academic',
  'tools',
  'minimal',
  'course-notes',
  'research-portfolio',
];

function page({
  title = 'Deterministic Systems',
  description = 'A stable description for a stable card.',
  canonical = 'https://cards.test.invalid/chapters/determinism/',
  htmlAttrs = '',
  head = '',
  body = '<p>sentinel body bytes</p>',
} = {}) {
  return `<!doctype html>
<html lang="en"${htmlAttrs ? ` ${htmlAttrs}` : ''}>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <meta property="og:title" content="${title}">
    ${description === null ? '' : `<meta property="og:description" content="${description}">`}
    ${canonical === null ? '' : `<link rel="canonical" href="${canonical}">`}
    ${head}
  </head>
  <body>${body}</body>
</html>
`;
}

async function fixture() {
  return mkdtemp(join(tmpdir(), 'book-scaffold-og-'));
}

async function writeRoute(root, route, source) {
  const file = route === '/'
    ? join(root, 'index.html')
    : route.endsWith('.html')
      ? join(root, route.slice(1))
      : join(root, route.slice(1), 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, source, 'utf8');
  return file;
}

async function runIntegration(root, {
  profile = 'minimal',
  corpus = null,
  title = 'The Stable Book',
  description = 'Book-level fallback description.',
  staticOgImage,
  exclude = [],
  base = '/',
  site = 'https://cards.test.invalid/catalog/',
} = {}) {
  const messages = [];
  const integration = createOgCardsIntegration({
    profile,
    corpus,
    title,
    description,
    staticOgImage,
    ogCards: normalizeOgCardsConfig({ exclude }),
  });
  await integration.hooks['astro:config:done']({
    config: {
      output: 'static',
      base,
      site: new URL(site),
    },
  });
  await integration.hooks['astro:build:done']({
    dir: pathToFileURL(`${root}${sep}`),
    logger: { info: (message) => messages.push(message) },
  });
  return messages;
}

function metaContent(source, attribute, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forward = new RegExp(
    `<meta\\s+[^>]*${attribute}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'gi',
  );
  const reverse = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${escaped}["'][^>]*>`,
    'gi',
  );
  return [...source.matchAll(forward), ...source.matchAll(reverse)].map((match) => match[1]);
}

function generatedImageUrl(source) {
  const values = metaContent(source, 'property', 'og:image');
  assert.equal(values.length, 1, 'expected exactly one og:image');
  return values[0];
}

function hashFromUrl(url) {
  const match = /\/_og\/([a-f0-9]{16})\.png$/u.exec(url);
  assert.ok(match, `not a content-addressed OG URL: ${url}`);
  return match[1];
}

async function pngInfo(file) {
  const bytes = await readFile(file);
  assert.deepEqual(
    bytes.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    'renderer must emit a PNG signature',
  );
  return {
    bytes,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test('#157 config normalization is strict, frozen, and defaults object form to enabled', () => {
  assert.equal(normalizeOgCardsConfig(undefined), null);
  assert.equal(normalizeOgCardsConfig(false), null);
  assert.equal(normalizeOgCardsConfig({ enabled: false }), null);

  for (const value of [true, {}, { enabled: true }]) {
    const resolved = normalizeOgCardsConfig(value);
    assert.deepEqual(resolved, { enabled: true, exclude: [] });
    assert.equal(Object.isFrozen(resolved), true);
    assert.equal(Object.isFrozen(resolved.exclude), true);
  }

  const resolved = normalizeOgCardsConfig({ exclude: ['/print/', '/drafts/*/', '/private/**'] });
  assert.deepEqual(resolved.exclude, ['/print/', '/drafts/*/', '/private/**']);

  for (const invalid of [
    null,
    'true',
    [],
    { enabled: 'yes' },
    { exclude: '/print/' },
    { exclude: [1] },
    { exclude: ['print/'] },
    { exclude: ['//host/path'] },
    { exclude: ['/a//b/'] },
    { exclude: ['/../print/'] },
    { exclude: ['/draft-*/'] },
    { exclude: ['/***/'] },
    { exclude: ['/print/?mode=all'] },
    { exclude: ['/print/#top'] },
    { exclude: ['/print/', '/print/'] },
    { unknown: true },
  ]) {
    assert.throws(() => normalizeOgCardsConfig(invalid), /seo\.ogCards/);
  }
});

test('#157 all five presets emit deterministic non-empty 1200x630 PNGs', async () => {
  const firstBytes = new Map();

  for (const profile of PROFILES) {
    const first = await fixture();
    const second = await fixture();
    try {
      const source = page();
      await writeRoute(first, '/', source);
      await writeRoute(second, '/', source);
      await runIntegration(first, { profile, base: '/canary/' });
      await runIntegration(second, { profile, base: '/canary/' });

      const firstHtml = await readFile(join(first, 'index.html'), 'utf8');
      const secondHtml = await readFile(join(second, 'index.html'), 'utf8');
      const firstUrl = generatedImageUrl(firstHtml);
      const secondUrl = generatedImageUrl(secondHtml);
      assert.equal(firstUrl, secondUrl, `${profile} URL should be deterministic`);
      assert.match(firstUrl, /^https:\/\/cards\.test\.invalid\/canary\/_og\/[a-f0-9]{16}\.png$/u);

      const hash = hashFromUrl(firstUrl);
      const firstPng = await pngInfo(join(first, '_og', `${hash}.png`));
      const secondPng = await pngInfo(join(second, '_og', `${hash}.png`));
      assert.equal(firstPng.width, 1200);
      assert.equal(firstPng.height, 630);
      assert.ok(firstPng.bytes.length > 1_000, 'card should contain rendered pixels');
      assert.deepEqual(firstPng.bytes, secondPng.bytes, `${profile} PNG bytes should be deterministic`);
      firstBytes.set(profile, firstPng.bytes);

      assert.deepEqual(metaContent(firstHtml, 'property', 'og:image:width'), ['1200']);
      assert.deepEqual(metaContent(firstHtml, 'property', 'og:image:height'), ['630']);
      assert.deepEqual(metaContent(firstHtml, 'property', 'og:image:type'), ['image/png']);
      assert.deepEqual(metaContent(firstHtml, 'name', 'twitter:image'), [firstUrl]);
      assert.match(firstHtml, /<body><p>sentinel body bytes<\/p><\/body>/u);
    } finally {
      await rm(first, { recursive: true, force: true });
      await rm(second, { recursive: true, force: true });
    }
  }

  assert.equal(firstBytes.size, 5);
  const distinct = new Set(
    [...firstBytes.values()].map((bytes) => createHash('sha256').update(bytes).digest('hex')),
  );
  assert.equal(distinct.size, 5, 'the five profile theme pairs must produce distinct cards');
});

test('#157 route is not drawn or hashed and identical payloads deduplicate', async () => {
  const root = await fixture();
  try {
    const source = page();
    await writeRoute(root, '/', source);
    await writeRoute(root, '/same/', source);
    await writeRoute(root, '/different/', page({ title: 'A Different Page' }));
    const messages = await runIntegration(root);

    const rootHtml = await readFile(join(root, 'index.html'), 'utf8');
    const sameHtml = await readFile(join(root, 'same', 'index.html'), 'utf8');
    const differentHtml = await readFile(join(root, 'different', 'index.html'), 'utf8');
    assert.equal(generatedImageUrl(rootHtml), generatedImageUrl(sameHtml));
    assert.notEqual(generatedImageUrl(rootHtml), generatedImageUrl(differentHtml));
    assert.equal((await readdir(join(root, '_og'))).length, 2);
    assert.match(messages.join('\n'), /2 generated, 1 reused/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('#157 exact, one-segment *, and zero-or-more ** exclusions are route-stable', async () => {
  const root = await fixture();
  try {
    for (const route of [
      '/print/',
      '/drafts/one/',
      '/drafts/one/nested/',
      '/private/',
      '/section/private/',
      '/section/deep/private/',
      '/public/',
    ]) {
      await writeRoute(root, route, page({
        title: `Page ${route}`,
        canonical: `https://cards.test.invalid${route}`,
      }));
    }
    await runIntegration(root, {
      exclude: ['/print/', '/drafts/*/', '/**/private/'],
    });

    for (const skipped of [
      '/print/',
      '/drafts/one/',
      '/private/',
      '/section/private/',
      '/section/deep/private/',
    ]) {
      const source = await readFile(join(root, skipped.slice(1), 'index.html'), 'utf8');
      assert.equal(metaContent(source, 'property', 'og:image').length, 0, skipped);
    }
    for (const generated of ['/drafts/one/nested/', '/public/']) {
      const source = await readFile(join(root, generated.slice(1), 'index.html'), 'utf8');
      assert.equal(metaContent(source, 'property', 'og:image').length, 1, generated);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('#157 authored, corpus-book, and global static images outrank generation', async () => {
  const root = await fixture();
  const authored = page({
    head: '<meta property="og:image" content="https://author.test/custom.png">',
  });
  const corpus = {
    books: [
      { id: 'alpha', title: 'Alpha Book', image: '/social/alpha.png' },
      { id: 'beta', title: 'Beta Book' },
    ],
  };
  try {
    const authoredFile = await writeRoute(root, '/authored/', authored);
    await writeRoute(root, '/alpha/', page({
      htmlAttrs: 'data-book-scaffold-book="alpha"',
      canonical: 'https://cards.test.invalid/alpha/',
    }));
    await writeRoute(root, '/alpha-fallback/', page({
      canonical: 'https://cards.test.invalid/alpha-fallback/',
      body: '<main data-pagefind-filter="book:alpha">fallback marker</main>',
    }));
    await writeRoute(root, '/beta/', page({
      htmlAttrs: 'data-book-scaffold-book="beta"',
      canonical: 'https://cards.test.invalid/beta/',
    }));
    await writeRoute(root, '/corpus/', page({
      htmlAttrs: 'data-book-scaffold-surface="corpus"',
      canonical: 'https://cards.test.invalid/corpus/',
    }));

    await runIntegration(root, {
      corpus,
      staticOgImage: '/social/global.png',
      base: '/canary/',
    });

    assert.equal(await readFile(authoredFile, 'utf8'), authored, 'authored page must remain byte-for-byte');
    for (const route of ['/alpha/', '/alpha-fallback/']) {
      const source = await readFile(join(root, route.slice(1), 'index.html'), 'utf8');
      assert.deepEqual(metaContent(source, 'property', 'og:image'), [
        'https://cards.test.invalid/canary/social/alpha.png',
      ]);
      assert.deepEqual(metaContent(source, 'name', 'twitter:image'), [
        'https://cards.test.invalid/canary/social/alpha.png',
      ]);
      assert.equal(metaContent(source, 'property', 'og:image:width').length, 0);
    }
    for (const route of ['/beta/', '/corpus/']) {
      const source = await readFile(join(root, route.slice(1), 'index.html'), 'utf8');
      assert.deepEqual(metaContent(source, 'property', 'og:image'), [
        'https://cards.test.invalid/canary/social/global.png',
      ]);
      assert.equal(metaContent(source, 'property', 'og:image:width').length, 0);
    }
    await assert.rejects(() => readdir(join(root, '_og')), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('#157 already-base-prefixed and absolute static images are not rewritten', async () => {
  for (const [value, expected] of [
    ['/canary/social/card.png', 'https://cards.test.invalid/canary/social/card.png'],
    ['/canary/social/card.png?v=1', 'https://cards.test.invalid/canary/social/card.png?v=1'],
    ['social/card.png', 'https://cards.test.invalid/canary/social/card.png'],
    ['https://cdn.test.invalid/card.png', 'https://cdn.test.invalid/card.png'],
    ['//cdn.test.invalid/card.png', 'https://cdn.test.invalid/card.png'],
  ]) {
    const root = await fixture();
    try {
      await writeRoute(root, '/', page());
      await runIntegration(root, { staticOgImage: value, base: '/canary/' });
      const source = await readFile(join(root, 'index.html'), 'utf8');
      assert.deepEqual(metaContent(source, 'property', 'og:image'), [expected]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('#157 local static image URLs reject blanks, schemes, and decoded traversal', async () => {
  for (const value of [
    '',
    '   ',
    'data:image/png;base64,abc',
    'javascript:alert(1)',
    '../social/card.png',
    '/social/%2e%2e/card.png',
    '/social/%252e%252e/card.png',
    '/social/%2Fescape.png',
    '/social/card\\name.png',
    '?version=1',
  ]) {
    const root = await fixture();
    try {
      await writeRoute(root, '/', page());
      await assert.rejects(
        runIntegration(root, { staticOgImage: value }),
        /OG card (?:local )?static image/,
        value,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('#157 corpus markers create exact book identities and corpus surfaces never borrow book one', async () => {
  const root = await fixture();
  const corpus = {
    books: [
      { id: 'alpha', title: 'Alpha Book', description: 'Alpha description.' },
      { id: 'beta', title: 'Beta Book', description: 'Beta description.' },
    ],
  };
  try {
    for (const [route, marker] of [
      ['/alpha/', 'data-book-scaffold-book="alpha"'],
      ['/beta/', 'data-book-scaffold-book="beta"'],
      ['/corpus/', 'data-book-scaffold-surface="corpus"'],
    ]) {
      await writeRoute(root, route, page({
        title: 'Shared Page Title',
        description: null,
        canonical: `https://cards.test.invalid${route}`,
        htmlAttrs: marker,
      }));
    }
    await runIntegration(root, { corpus, title: 'Corpus Library', description: 'Corpus description.' });

    const urls = [];
    for (const route of ['/alpha/', '/beta/', '/corpus/']) {
      const source = await readFile(join(root, route.slice(1), 'index.html'), 'utf8');
      urls.push(generatedImageUrl(source));
    }
    assert.equal(new Set(urls).size, 3, 'book id/title and corpus title must hash distinctly');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('#157 exclusions, noindex, redirects, errors, and authored images create no files', async () => {
  const root = await fixture();
  try {
    await writeRoute(root, '/excluded/', page());
    await writeRoute(root, '/noindex/', page({ head: '<meta name="robots" content="follow, NOINDEX">' }));
    await writeRoute(
      root,
      '/none-minimal/',
      '<!doctype html><meta name="robots" content="none"><body>skip without explicit head end</body>',
    );
    await writeRoute(root, '/redirect/', page({ head: '<meta http-equiv="Refresh" content="0;url=/target/">' }));
    await writeRoute(
      root,
      '/redirect-minimal/',
      '<!doctype html><meta http-equiv="refresh" content="0;url=/target/"><body>redirect</body>',
    );
    await writeRoute(root, '/404.html', page());
    await writeRoute(root, '/500/', page());
    await writeRoute(root, '/authored/', page({
      head: '<meta property="og:image" content="https://author.test/card.png">',
    }));
    await runIntegration(root, { exclude: ['/excluded/'] });
    await assert.rejects(() => readdir(join(root, '_og')), /ENOENT/);

    for (const file of [
      join(root, 'excluded', 'index.html'),
      join(root, 'noindex', 'index.html'),
      join(root, 'none-minimal', 'index.html'),
      join(root, 'redirect', 'index.html'),
      join(root, 'redirect-minimal', 'index.html'),
      join(root, '404.html'),
      join(root, '500', 'index.html'),
    ]) {
      assert.equal(metaContent(await readFile(file, 'utf8'), 'property', 'og:image').length, 0);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('#157 stale scaffold hashes are pruned while unrelated _og files are preserved', async () => {
  const root = await fixture();
  try {
    await writeRoute(root, '/', page());
    await mkdir(join(root, '_og'), { recursive: true });
    await writeFile(join(root, '_og', 'deadbeefdeadbeef.png'), 'stale scaffold card');
    await writeFile(join(root, '_og', 'consumer-card.png'), 'consumer owned');
    await writeFile(join(root, '_og', 'DEADBEEFDEADBEEF.png'), 'not scaffold namespace');

    const messages = await runIntegration(root, { staticOgImage: '/social/static.png' });
    assert.deepEqual(
      (await readdir(join(root, '_og'))).sort(),
      ['DEADBEEFDEADBEEF.png', 'consumer-card.png'],
    );
    assert.match(messages.join('\n'), /1 stale pruned/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('#157 only missing image tags are spliced and conflicts fail instead of overwriting', async () => {
  const root = await fixture();
  try {
    await writeRoute(root, '/', page({
      head: '<meta property="og:image:width" content="1200">',
    }));
    await runIntegration(root);
    const source = await readFile(join(root, 'index.html'), 'utf8');
    assert.equal(metaContent(source, 'property', 'og:image:width').length, 1);
    assert.equal(metaContent(source, 'property', 'og:image:height').length, 1);
    assert.equal(metaContent(source, 'property', 'og:image:type').length, 1);
    assert.equal(metaContent(source, 'name', 'twitter:image').length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  const conflict = await fixture();
  try {
    await writeRoute(conflict, '/', page({
      head: '<meta property="og:image:width" content="600">',
    }));
    await assert.rejects(
      runIntegration(conflict),
      /og:image:width.*conflicts with generated value "1200"/,
    );
  } finally {
    await rm(conflict, { recursive: true, force: true });
  }
});

test('#157 malformed rendered metadata and identity fail the requested build', async () => {
  const cases = [
    {
      source: page({ head: '<meta property="og:image" content="/relative.png">' }),
      error: /og:image content must be an absolute http\(s\) URL/,
      corpus: null,
    },
    {
      source: page({ canonical: null }),
      error: /exactly one rendered canonical link/,
      corpus: null,
    },
    {
      source: page({ canonical: 'mailto:author@example.com' }),
      error: /canonical href must be an absolute http\(s\) URL/,
      corpus: null,
    },
    {
      source: page({ htmlAttrs: 'data-book-scaffold-book="missing"' }),
      error: /unknown rendered corpus book "missing"/,
      corpus: { books: [{ id: 'known', title: 'Known' }] },
    },
    {
      source: page({
        htmlAttrs: 'data-book-scaffold-book="known" data-book-scaffold-surface="corpus"',
      }),
      error: /both book and corpus-surface identity/,
      corpus: { books: [{ id: 'known', title: 'Known' }] },
    },
  ];

  for (const { source, error, corpus } of cases) {
    const root = await fixture();
    try {
      await writeRoute(root, '/', source);
      await assert.rejects(runIntegration(root, { corpus }), error);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('#157 enabled cards reject SSR output and missing/non-http site during config', async () => {
  const integration = createOgCardsIntegration({
    profile: 'minimal',
    corpus: null,
    title: 'Book',
    ogCards: normalizeOgCardsConfig(true),
  });
  assert.throws(
    () => integration.hooks['astro:config:done']({
      config: { output: 'server', base: '/', site: new URL('https://cards.test.invalid') },
    }),
    /require Astro output "static"/,
  );

  for (const site of [undefined, new URL('file:///tmp/book/')]) {
    const candidate = createOgCardsIntegration({
      profile: 'minimal',
      corpus: null,
      title: 'Book',
      ogCards: normalizeOgCardsConfig(true),
    });
    assert.throws(
      () => candidate.hooks['astro:config:done']({
        config: { output: 'static', base: '/', site },
      }),
      /absolute http\(s\) Astro site URL/,
    );
  }
});

test('#157 package-owned fonts retain exact official OFL provenance', async () => {
  const assets = join(dirname(new URL(import.meta.url).pathname), '..', 'assets', 'og-fonts');
  const expected = new Map([
    ['Inter-Regular.ttf', '40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82'],
    ['Inter-Bold.ttf', '288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f'],
  ]);
  for (const [name, digest] of expected) {
    const bytes = await readFile(join(assets, name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  }
  assert.match(await readFile(join(assets, 'LICENSE.txt'), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(await readFile(join(assets, 'SOURCE.md'), 'utf8'), /Inter-4\.1\.zip/);
});
