/**
 * VersionSelector is an opt-in island: the consuming book owns the deployed
 * version manifest and passes it as props. The package must never invent
 * releases or mount the selector globally without that data.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import render from 'preact-render-to-string';
import { h } from 'preact';
import VersionSelector from '../dist/components/VersionSelector.mjs';

const componentSource = readFileSync(
  new URL('../components/VersionSelector.tsx', import.meta.url),
  'utf8',
);
const baseSource = readFileSync(new URL('../layouts/Base.astro', import.meta.url), 'utf8');

test('VersionSelector renders nothing until a consumer supplies real versions', () => {
  assert.equal(render(h(VersionSelector, {})), '');
  assert.equal(render(h(VersionSelector, { versions: [] })), '');
});

test('VersionSelector derives its current-version label from consumer props', () => {
  const html = render(h(VersionSelector, {
    versions: [
      { href: '/archive/v1/', label: 'v1.0', date: '2025-01-01' },
      { href: '/archive/v2/', label: 'v2.0', date: '2026-02-03', current: true },
    ],
  }));

  assert.match(html, /Current: v2\.0 \(2026-02-03\)/);
  assert.doesNotMatch(html, /Latest \(main\)|2026-04-17|2026-05-01/);
});

test('VersionSelector source has no package-owned fake version manifest', () => {
  assert.doesNotMatch(componentSource, /STUB_VERSIONS/);
  assert.doesNotMatch(componentSource, /Latest \(main\)|2026-04-17|2026-05-01/);
  assert.match(componentSource, /href=\{version\.href\}/);
});

test('Base does not import or auto-mount VersionSelector', () => {
  assert.doesNotMatch(baseSource, /import\s+VersionSelector\s+from/);
  assert.doesNotMatch(baseSource, /<VersionSelector\b/);
});
