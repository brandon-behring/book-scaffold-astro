/**
 * tests/resolve-preset.test.mjs — fail-loud preset resolution (#179).
 *
 * v4.27.0 converts the silent 'minimal' fallback into a BookConfigError, in
 * all three resolvers (resolvePreset / defineBookConfig's composed chain /
 * validate.mjs — the last covered in validate-root.test.mjs). Same
 * silent→loud conversion as the Theorem kind change (v4.14.3, #121).
 *
 * Tested via the compiled dist/index.mjs so the tests exercise the same code
 * path consumers see post-publish. Env vars are scrubbed/restored per test —
 * resolvePreset reads process.env and ./.env (cwd = package/, which has none).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  resolvePreset,
  resolveProfile,
  defineBookConfig,
  defineStyle,
  academicStyle,
  BookConfigError,
  BOOK_PRESETS,
} from '../dist/index.mjs';

function withScrubbedEnv(fn) {
  const saved = { PRESET: process.env.BOOK_PRESET, PROFILE: process.env.BOOK_PROFILE };
  delete process.env.BOOK_PRESET;
  delete process.env.BOOK_PROFILE;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (saved.PRESET !== undefined) process.env.BOOK_PRESET = saved.PRESET;
      if (saved.PROFILE !== undefined) process.env.BOOK_PROFILE = saved.PROFILE;
    });
}

test('#179: resolvePreset throws BookConfigError when nothing sets a preset', async () => {
  await withScrubbedEnv(() => {
    assert.throws(
      () => resolvePreset(),
      (err) => {
        assert.ok(err instanceof BookConfigError, `expected BookConfigError, got ${err?.constructor?.name}`);
        assert.match(err.message, /#179/, 'error should cite the issue');
        assert.match(err.message, /BOOK_PRESET/, 'error should name the env var to set');
        assert.match(err.message, /minimal/, 'error should mention the old silent default');
        return true;
      },
    );
  });
});

test('#179: resolveProfile (back-compat alias) throws the same way', async () => {
  await withScrubbedEnv(() => {
    assert.throws(() => resolveProfile(), BookConfigError);
  });
});

test('#179: explicit param still resolves without env', async () => {
  await withScrubbedEnv(() => {
    assert.equal(resolvePreset('academic'), 'academic');
    assert.equal(resolvePreset(undefined, 'course-notes'), 'course-notes');
  });
});

test('#179: environment variable still resolves', async () => {
  await withScrubbedEnv(() => {
    process.env.BOOK_PRESET = 'tools';
    try {
      assert.equal(resolvePreset(), 'tools');
    } finally {
      delete process.env.BOOK_PRESET;
    }
  });
});

test('#179: invalid value still throws the enum error (pre-existing contract)', async () => {
  await withScrubbedEnv(() => {
    assert.throws(
      () => resolvePreset('bogus'),
      (err) =>
        err instanceof BookConfigError && new RegExp(BOOK_PRESETS.join('.*')).test(err.message.replace(/\n/g, ' ')),
    );
  });
});

test('#179: defineBookConfig with no styles throws (was silent minimal)', async () => {
  await withScrubbedEnv(async () => {
    await assert.rejects(
      defineBookConfig({ site: 'https://test.invalid' }),
      (err) => {
        assert.ok(err instanceof BookConfigError);
        assert.match(err.message, /#179/);
        assert.match(err.message, /minimalStyle/, 'error should show the exact remediation');
        return true;
      },
    );
  });
});

test('#179: defineBookConfig with a preset-less custom chain throws with the chain remediation', async () => {
  await withScrubbedEnv(async () => {
    const presetless = defineStyle({ name: 'no-preset-style', site: 'https://test.invalid' });
    await assert.rejects(
      defineBookConfig({ styles: [presetless] }),
      (err) => {
        assert.ok(err instanceof BookConfigError);
        assert.match(err.message, /never sets `preset`/);
        return true;
      },
    );
  });
});

test('#179: a built-in style in the chain resolves as before (no behavior change when set)', async () => {
  await withScrubbedEnv(async () => {
    const config = await defineBookConfig({ styles: [academicStyle], site: 'https://test.invalid' });
    assert.ok(config, 'academicStyle chain must still compose');
  });
});
