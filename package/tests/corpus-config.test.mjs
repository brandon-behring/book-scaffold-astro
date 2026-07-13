import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  BookConfigError,
  bookScaffoldIntegration,
  defineBookConfig,
  defineBookCorpus,
  defineStyle,
} from '../dist/index.mjs';

function corpus() {
  return defineBookCorpus({
    preset: 'minimal',
    books: [{ id: 'guide', title: 'Guide' }],
  });
}

test('corpus config rejects every consumer-owned route override', async () => {
  const values = {
    chapterRoute: '/library/:book/:id/',
    bookField: 'volume',
    apparatusRoute: '/library/:book/:route/',
    apparatusRoutes: ['references'],
  };

  for (const [field, value] of Object.entries(values)) {
    await assert.rejects(
      defineBookConfig({
        corpus: corpus(),
        styles: [defineStyle({ site: 'https://test.invalid' })],
        [field]: value,
      }),
      (error) =>
        error instanceof BookConfigError &&
        error.message.includes(`Corpus mode owns ${field}`) &&
        error.message.includes('injected routes and navigation agree'),
      field,
    );
  }

  assert.throws(
    () =>
      bookScaffoldIntegration({
        profile: 'minimal',
        corpus: corpus(),
        chapterRoute: undefined,
      }),
    /Corpus mode owns chapterRoute/,
    'an explicit undefined remains an override, matching defineBookConfig',
  );
});

test('direct integration validates profile and branded corpus preset identity', () => {
  assert.throws(
    () => bookScaffoldIntegration({ profile: 'unknown-profile' }),
    (error) =>
      error instanceof BookConfigError &&
      error.message.includes('profile must be one of') &&
      error.message.includes('unknown-profile'),
  );

  assert.throws(
    () =>
      bookScaffoldIntegration({
        profile: 'minimal',
        corpus: Object.freeze({
          __bookCorpusVersion: 1,
          preset: 'minimal',
          books: Object.freeze([{ id: 'guide', title: 'Guide' }]),
        }),
      }),
    /must be created by defineBookCorpus/,
  );

  assert.throws(
    () => bookScaffoldIntegration({ profile: 'tools', corpus: corpus() }),
    (error) =>
      error instanceof BookConfigError &&
      error.message.includes('corpus preset "minimal"') &&
      error.message.includes('does not match profile "tools"'),
  );

  assert.doesNotThrow(() =>
    bookScaffoldIntegration({ profile: 'minimal', corpus: corpus() }),
  );
});

test('direct integration rejects every corpus-owned route override', () => {
  const values = {
    chapterRoute: '/library/:book/:id/',
    bookField: 'volume',
    apparatusRoute: '/library/:book/:route/',
    apparatusRoutes: ['references'],
  };

  for (const [field, value] of Object.entries(values)) {
    assert.throws(
      () =>
        bookScaffoldIntegration({
          profile: 'minimal',
          corpus: corpus(),
          [field]: value,
        }),
      (error) =>
        error instanceof BookConfigError &&
        error.message.includes(`Corpus mode owns ${field}`) &&
        error.message.includes('injected routes and navigation agree'),
      field,
    );
  }
});
