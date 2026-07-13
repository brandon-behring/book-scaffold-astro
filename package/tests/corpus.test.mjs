import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  defineBookCorpus,
  resolveCorpusBook,
  corpusBookIdOf,
  corpusBookIdFromPath,
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
