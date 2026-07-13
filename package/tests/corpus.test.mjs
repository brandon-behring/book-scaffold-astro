import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  defineBookCorpus,
  assertBookCorpus,
  resolveCorpusBook,
  corpusBookIdOf,
  corpusBookIdFromPath,
  corpusApparatusRoutesForBook,
  corpusBookHasApparatusRoute,
  selectBookArtifact,
  filterCorpusEntries,
  localCorpusEntryId,
  corpusCollectionEntryId,
  CORPUS_APPARATUS_TOGGLE_BY_ROUTE,
  RESERVED_CORPUS_BOOK_IDS,
} from '../dist/index.mjs';

function validInput() {
  return {
    preset: 'research-portfolio',
    books: [
      {
        id: 'evaluation',
        title: 'Evaluation Engineering',
        apparatus: ['references', 'glossary'],
      },
      {
        id: 'llm-app-engineering',
        title: 'LLM Application Engineering',
        description: 'Production application patterns.',
      },
    ],
  };
}

test('defineBookCorpus preserves manifest order and deeply freezes public values', () => {
  const corpus = defineBookCorpus(validInput());
  assert.equal(corpus.__bookCorpusVersion, 1);
  assert.equal(corpus.preset, 'research-portfolio');
  assert.deepEqual(corpus.books.map((book) => book.id), [
    'evaluation',
    'llm-app-engineering',
  ]);
  assert.equal(Object.isFrozen(corpus), true);
  assert.equal(Object.isFrozen(corpus.books), true);
  assert.equal(Object.isFrozen(corpus.books[0]), true);
  assert.equal(Object.isFrozen(corpus.books[0].apparatus), true);
  assert.doesNotThrow(() => assertBookCorpus(corpus));
  assert.equal(JSON.stringify(corpus).includes('BookCorpus/v1'), false);
  assert.equal(
    corpus[Symbol.for('@brandon_m_behring/book-scaffold-astro/BookCorpus/v1')],
    true,
  );
});

test('assertBookCorpus rejects a forged serializable marker and malformed branded clones', () => {
  const markerOnly = Object.freeze({
    __bookCorpusVersion: 1,
    preset: 'research-portfolio',
    books: Object.freeze([]),
  });
  assert.throws(() => assertBookCorpus(markerOnly), /must be created by defineBookCorpus/);

  const malformed = {
    __bookCorpusVersion: 1,
    preset: 'research-portfolio',
    books: Object.freeze([Object.freeze({ id: 'Bad_Id', title: 'Bad' })]),
  };
  Object.defineProperty(
    malformed,
    Symbol.for('@brandon_m_behring/book-scaffold-astro/BookCorpus/v1'),
    { value: true },
  );
  Object.freeze(malformed);
  assert.throws(() => assertBookCorpus(malformed), /must be created by defineBookCorpus/);
});

test('defineBookCorpus rejects invalid, duplicate, reserved, and unknown ids/fields', () => {
  assert.throws(
    () => defineBookCorpus({ preset: 'bogus', books: [{ id: 'ok', title: 'OK' }] }),
    /preset must be one of/,
  );
  assert.throws(() => defineBookCorpus({ preset: 'minimal', books: [] }), /non-empty/);
  assert.throws(
    () => defineBookCorpus({ preset: 'minimal', books: [{ id: 'Bad_Id', title: 'Bad' }] }),
    /must match/,
  );
  assert.throws(
    () => defineBookCorpus({ preset: 'minimal', books: [{ id: 'chapters', title: 'Bad' }] }),
    /reserved/,
  );
  assert.throws(
    () =>
      defineBookCorpus({
        preset: 'minimal',
        books: [
          { id: 'same', title: 'One' },
          { id: 'same', title: 'Two' },
        ],
      }),
    /duplicated/,
  );
  assert.throws(
    () => defineBookCorpus({ preset: 'minimal', books: [{ id: 'ok', title: 'OK', extra: true }] }),
    /unknown field.*extra/,
  );
  assert.ok(RESERVED_CORPUS_BOOK_IDS.includes('_og'));
});

test('defineBookCorpus reserves scaffold-owned content collection roots', () => {
  const roots = {
    questions: 'dedicated questions collection root',
    glossary: 'dedicated glossary collection root',
    frontmatter: 'shared frontmatter collection root',
  };

  for (const [id, ownership] of Object.entries(roots)) {
    assert.ok(RESERVED_CORPUS_BOOK_IDS.includes(id), `${id} must remain reserved`);
    assert.throws(
      () => defineBookCorpus({ preset: 'minimal', books: [{ id, title: 'Collision' }] }),
      (error) =>
        error.message.includes(`src/content/${id}/`) &&
        error.message.includes(ownership),
      `${id} must explain why the collection root cannot also own chapters`,
    );
  }
});

test('defineBookCorpus validates book metadata and apparatus routes', () => {
  assert.throws(
    () => defineBookCorpus({ preset: 'minimal', books: [{ id: 'ok', title: '   ' }] }),
    /title must be a non-blank string/,
  );
  assert.throws(
    () =>
      defineBookCorpus({
        preset: 'minimal',
        books: [{ id: 'ok', title: 'OK', apparatus: ['unknown'] }],
      }),
    /expected a subset/,
  );
  assert.throws(
    () =>
      defineBookCorpus({
        preset: 'minimal',
        books: [{ id: 'ok', title: 'OK', apparatus: ['glossary', 'glossary'] }],
      }),
    /duplicate route/,
  );
});

test('corpus lookup helpers fail loud and never infer an unregistered prefix', () => {
  const corpus = defineBookCorpus(validInput());
  assert.equal(resolveCorpusBook(corpus, 'evaluation').title, 'Evaluation Engineering');
  assert.throws(() => resolveCorpusBook(corpus, 'missing'), /evaluation \| llm-app-engineering/);
  assert.equal(corpusBookIdOf(corpus, 'evaluation/introduction'), 'evaluation');
  assert.equal(corpusBookIdOf(corpus, 'missing/introduction'), null);
  assert.equal(corpusBookIdOf(corpus, 'flat-slug'), null);
  assert.equal(corpusBookIdFromPath(corpus, '/evaluation/'), 'evaluation');
  assert.equal(
    corpusBookIdFromPath(corpus, '/docs/chapters/llm-app-engineering/intro/', '/docs/'),
    'llm-app-engineering',
  );
  assert.equal(corpusBookIdFromPath(corpus, '/chapters/'), null);
});

test('corpus apparatus mapping handles the practice-exam camelCase toggle explicitly', () => {
  const corpus = defineBookCorpus(validInput());
  assert.deepEqual(corpusApparatusRoutesForBook(corpus, 'evaluation'), [
    'references',
    'glossary',
  ]);
  assert.deepEqual(corpusApparatusRoutesForBook(corpus, 'llm-app-engineering', ['print']), [
    'print',
  ]);
  assert.equal(CORPUS_APPARATUS_TOGGLE_BY_ROUTE['practice-exam'], 'practiceExam');
  assert.equal(corpusBookHasApparatusRoute(corpus, 'evaluation', 'glossary'), true);
  assert.equal(corpusBookHasApparatusRoute(corpus, 'evaluation', 'tips'), false);
});

test('corpus artifact selection is strict while single-book payloads stay unchanged', () => {
  const corpus = defineBookCorpus(validInput());
  const legacy = { theorem: { href: '/chapters/one/' } };
  assert.equal(selectBookArtifact(legacy, null, null, 'labels.json'), legacy);

  const envelope = {
    schemaVersion: 1,
    books: {
      evaluation: { theorem: { href: '/chapters/evaluation/one/' } },
      'llm-app-engineering': { theorem: { href: '/chapters/llm-app-engineering/one/' } },
    },
  };
  assert.deepEqual(selectBookArtifact(envelope, corpus, 'evaluation', 'labels.json'), {
    theorem: { href: '/chapters/evaluation/one/' },
  });
  assert.throws(() => selectBookArtifact(envelope, corpus, null, 'labels.json'), /current book/);
  assert.throws(
    () => selectBookArtifact({ schemaVersion: 1, books: { evaluation: {} } }, corpus, 'evaluation'),
    /missing llm-app-engineering/,
  );
  assert.throws(
    () =>
      selectBookArtifact(
        { ...envelope, books: { ...envelope.books, intruder: {} } },
        corpus,
        'evaluation',
    ),
    /unknown intruder/,
  );
  assert.throws(
    () => selectBookArtifact({ ...envelope, checksum: 'forged' }, corpus, 'evaluation'),
    /unknown field.*checksum/,
  );
});

test('collection entry helpers keep repeated local ids isolated by registered book', () => {
  const corpus = defineBookCorpus(validInput());
  const entries = [
    { id: 'evaluation/shared' },
    { id: 'llm-app-engineering/shared' },
  ];
  assert.deepEqual(filterCorpusEntries(entries, corpus, 'evaluation'), [entries[0]]);
  assert.equal(localCorpusEntryId(corpus, 'evaluation', entries[0].id), 'shared');
  assert.throws(
    () => localCorpusEntryId(corpus, 'evaluation', entries[1].id),
    /outside corpus book/,
  );
});

test('corpus collection ids derive ownership from paths and reject frontmatter mismatch', () => {
  const corpus = defineBookCorpus(validInput());
  assert.equal(
    corpusCollectionEntryId(corpus, 'evaluation/shared.mdx', {}, { label: 'Chapter' }),
    'evaluation/shared',
  );
  assert.equal(
    corpusCollectionEntryId(
      corpus,
      'llm-app-engineering/source.mdx',
      { slug: 'shared', book: 'llm-app-engineering' },
      { label: 'Chapter', slugField: 'slug' },
    ),
    'llm-app-engineering/shared',
  );
  assert.throws(
    () =>
      corpusCollectionEntryId(
        corpus,
        'evaluation/shared.mdx',
        { book: 'llm-app-engineering' },
        { label: 'Chapter' },
      ),
    /frontmatter book "llm-app-engineering".*path owner is "evaluation"/,
  );
  assert.throws(
    () => corpusCollectionEntryId(corpus, 'unregistered/shared.mdx', {}),
    /outside the registered corpus books/,
  );
  for (const slug of ['%2e%2e', '%2Ffoo', '%5cfoo', 'malformed%']) {
    assert.throws(
      () =>
        corpusCollectionEntryId(
          corpus,
          'evaluation/source.mdx',
          { slug },
          { label: 'Chapter', slugField: 'slug' },
        ),
      /resolved invalid corpus id/,
    );
  }
  assert.throws(
    () => corpusCollectionEntryId(corpus, 'evaluation/%2e%2e.mdx', {}),
    /resolved invalid corpus id/,
  );
});
