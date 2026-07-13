import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  BookConfigError,
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
});
