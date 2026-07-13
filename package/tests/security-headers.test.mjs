/**
 * tests/security-headers.test.mjs — build-time `_headers` contract (#188).
 *
 * These tests invoke the integration's real `astro:build:done` hook through
 * defineBookConfig. That covers the public option, config-to-integration
 * propagation, output-file behavior, and consumer-file precedence without
 * relying on source-text assertions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defineBookConfig,
  minimalStyle,
} from '../dist/index.mjs';

async function runBuildDone({ securityHeaders, existing } = {}) {
  const config = await defineBookConfig({
    styles: [minimalStyle],
    site: 'https://headers.test.invalid',
    securityHeaders,
  });
  assert.ok(!('securityHeaders' in config), 'package option must not leak into Astro config');

  const integration = config.integrations.find(
    ({ name }) => name === 'book-scaffold-astro',
  );
  assert.ok(integration, 'defineBookConfig should install the scaffold integration');

  const hook = integration.hooks['astro:build:done'];
  assert.equal(typeof hook, 'function', 'integration should expose astro:build:done');

  const dir = mkdtempSync(join(tmpdir(), 'book-scaffold-headers-'));
  const target = join(dir, '_headers');
  const messages = [];

  try {
    if (existing !== undefined) writeFileSync(target, existing);
    await hook({
      dir: pathToFileURL(`${dir}${sep}`),
      logger: { info: (message) => messages.push(message) },
    });
    return {
      exists: existsSync(target),
      content: existsSync(target) ? readFileSync(target) : null,
      messages,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('#188: omission emits the complete scaffold security-header default', async () => {
  const result = await runBuildDone();
  assert.equal(result.exists, true);

  const headers = result.content.toString('utf8');
  for (const name of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
  ]) {
    assert.match(headers, new RegExp(`^  ${name}:`, 'm'), `${name} should be emitted`);
  }

  assert.match(headers, /script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'/,
    'theme/drawer inline scripts and Pagefind WASM should remain usable');
  assert.match(headers, /https:\/\/static\.cloudflareinsights\.com/,
    'Cloudflare Web Analytics script should be allowed');
  assert.match(headers, /style-src 'self' 'unsafe-inline'/,
    'Astro inline component styles should be allowed');
  assert.match(headers, /img-src 'self' data: https:/,
    'self-hosted, data-URI, and HTTPS consumer images should be allowed');
  assert.match(headers, /connect-src 'self' https:\/\/cloudflareinsights\.com/,
    'Cloudflare Web Analytics beacon should be allowed');
  assert.equal((headers.match(/^  Content-Security-Policy:/gm) ?? []).length, 1);
});

test('#188: securityHeaders=false emits no scaffold-owned file', async () => {
  const result = await runBuildDone({ securityHeaders: false });
  assert.equal(result.exists, false);
  assert.match(result.messages.join('\n'), /disabled/);
});

test('#188: a custom CSP replaces only CSP and retains the other defaults', async () => {
  const contentSecurityPolicy =
    "default-src 'none'; img-src https://images.example; frame-ancestors 'none'";
  const result = await runBuildDone({
    securityHeaders: { contentSecurityPolicy },
  });
  const headers = result.content.toString('utf8');

  assert.match(headers, new RegExp(
    `^  Content-Security-Policy: ${contentSecurityPolicy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'm',
  ));
  for (const name of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ]) {
    assert.match(headers, new RegExp(`^  ${name}:`, 'm'), `${name} should be retained`);
  }
  assert.doesNotMatch(headers, /wasm-unsafe-eval|cloudflareinsights/,
    'the default CSP must not be merged into a consumer replacement');
});

test('#188: an existing consumer _headers file wins byte-for-byte', async () => {
  const existing = Buffer.from(
    "/private/*\r\n  Cache-Control: no-store\r\n  Content-Security-Policy: default-src 'none'\r\n",
  );
  const result = await runBuildDone({
    securityHeaders: { contentSecurityPolicy: "default-src 'self'" },
    existing,
  });
  assert.equal(result.exists, true);
  assert.deepEqual(result.content, existing);
  assert.match(result.messages.join('\n'), /consumer public\/_headers present/);
});
