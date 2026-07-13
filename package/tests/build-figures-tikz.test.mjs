/**
 * tests/build-figures-tikz.test.mjs — TikZ → PDF → SVG pipeline (v4.2.0 #17).
 *
 * Verifies stage 1 (pdflatex) of build-figures.mjs runs cleanly on a minimal
 * standalone TikZ source and produces an SVG via the existing stage 2
 * (pdftocairo). Skipped if pdflatex or pdftocairo aren't on PATH (CI runners
 * may not have TeX installed; local devs with TexLive run the full check).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TIKZ_FIXTURE = join(__dirname, 'fixtures/figures/tikz-basic.tex');
const BUILD_FIGURES = join(__dirname, '..', 'scripts/build-figures.mjs');

function hasBinary(cmd) {
  const r = spawnSync('which', [cmd], { stdio: 'pipe' });
  return r.status === 0;
}

// Node 22's test runner treats `{ skip: <anything-not-undefined> }` as
// "skip with reason" — including `{ skip: null }`. Use undefined when we
// want the test to actually run.
const SKIP_REASON = !hasBinary('pdflatex')
  ? 'pdflatex not on PATH; install TeX Live (https://www.tug.org/texlive/) to run TikZ tests'
  : !hasBinary('pdftocairo')
    ? 'pdftocairo not on PATH; install poppler-utils to run TikZ tests'
    : undefined;

test('build-figures TikZ: pipeline produces SVG from .tex source', { skip: SKIP_REASON }, async () => {
  // Build a temp project layout that build-figures expects:
  //   <root>/figures/topic/tikz-basic.tex
  //   <root>/public/figures/  (output dir; auto-created)
  const projectRoot = mkdtempSync(join(tmpdir(), 'tikz-test-'));
  try {
    const figuresDir = join(projectRoot, 'figures/sample');
    mkdirSync(figuresDir, { recursive: true });
    copyFileSync(TIKZ_FIXTURE, join(figuresDir, 'tikz-basic.tex'));

    // Run build-figures.mjs from the temp root.
    const r = spawnSync('node', [BUILD_FIGURES], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: { ...process.env, PATH: process.env.PATH },
    });
    if (r.status !== 0) {
      console.error('build-figures stderr:', (r.stderr ?? Buffer.from('')).toString());
      console.error('build-figures stdout:', (r.stdout ?? Buffer.from('')).toString());
    }
    assert.equal(r.status, 0, 'build-figures should exit 0');

    // Verify stage 1: tikz-basic.pdf exists alongside the .tex source.
    const pdfPath = resolve(figuresDir, 'tikz-basic.pdf');
    assert.ok(existsSync(pdfPath), `pdflatex should produce ${pdfPath}`);

    // Verify stage 2: tikz-basic.svg exists under public/figures/sample/.
    const svgPath = resolve(projectRoot, 'public/figures/sample/tikz-basic.svg');
    assert.ok(existsSync(svgPath), `pdftocairo should produce ${svgPath}`);

    // Verify the SVG is a non-trivial file containing actual SVG markup.
    const svgContent = readFileSync(svgPath, 'utf8');
    assert.ok(svgContent.length > 200, 'SVG should be > 200 bytes');
    assert.match(svgContent, /<svg\b/, 'SVG file should contain <svg> element');
    assert.match(svgContent, /xmlns=/, 'SVG should declare xmlns');

    // v4.11.0 (#84): the generated SVG is rewritten to be accessible +
    // dark-mode-aware. The fixture draws black line art, so the baked
    // rgb(0%, 0%, 0%) ink must remap to var(--diagram-ink, …).
    assert.match(svgContent, /<svg\b[^>]*\brole="img"/, 'root <svg> should carry role="img"');
    assert.match(svgContent, /<style data-diagram-theme>/, 'should inject the standalone theme block');
    assert.match(svgContent, /<style data-diagram-map="2">/, 'should inject the current color-map block');
    assert.match(svgContent, /var\(--diagram-ink,\s*rgb\(0%, 0%, 0%\)\)/, 'black ink should remap to var(--diagram-ink, <orig>)');
    assert.match(svgContent, /var\(--fig-blue,\s*rgb\(/, 'canonical Warm–Tol blue should remap to --fig-blue');
    assert.match(svgContent, /var\(--series-1,\s*rgb\(/, 'canonical Okabe–Ito orange should remap to --series-1');
    assert.match(svgContent, /fill-opacity="0\.14/, 'semantic fill should retain separate opacity');
    assert.ok(!/data-diagram-map[\s\S]*data-diagram-map/.test(svgContent), 'map block should be injected exactly once');

    // Verify the console output mentions tikz compilation + theming.
    const stdout = (r.stdout ?? Buffer.from('')).toString();
    assert.match(stdout, /tikz/, 'output should mention tikz compilation count');
    assert.match(stdout, /themed/, 'output should report themed figures');

    // A normal cached run must neither reconvert nor rewrite the already-v2
    // artifact. Byte equality catches accidental timestamp-only churn too.
    const cachedRun = spawnSync('node', [BUILD_FIGURES], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: { ...process.env, PATH: process.env.PATH },
    });
    assert.equal(cachedRun.status, 0, 'cached build-figures run should exit 0');
    assert.equal(readFileSync(svgPath, 'utf8'), svgContent, 'current cached SVG should remain byte-identical');
    assert.match((cachedRun.stdout ?? Buffer.from('')).toString(), /0 converted[\s\S]*1 cached/);

    // Simulate an SVG generated by the old neutral-only cache format. The PDF
    // remains older, so this exercises build-figures' cached migration path,
    // not the fresh pdftocairo conversion path.
    const oldCached = svgContent.replace(
      /<style data-diagram-map="2">[\s\S]*?<\/style>/,
      '<style data-diagram-map>[stroke="rgb(0%, 0%, 0%)"]{stroke:var(--diagram-ink, rgb(0%, 0%, 0%))}</style>',
    );
    assert.notEqual(oldCached, svgContent, 'test should produce a pre-v2 cached map');
    writeFileSync(svgPath, oldCached, 'utf8');

    const migrationRun = spawnSync('node', [BUILD_FIGURES], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: { ...process.env, PATH: process.env.PATH },
    });
    assert.equal(migrationRun.status, 0, 'cached map migration should exit 0');
    const migrated = readFileSync(svgPath, 'utf8');
    assert.equal(migrated, svgContent, 'cached pre-v2 map should migrate to the exact current artifact');
    assert.match((migrationRun.stdout ?? Buffer.from('')).toString(), /0 converted[\s\S]*1 cached[\s\S]*1 themed/);

    const stableRun = spawnSync('node', [BUILD_FIGURES], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: { ...process.env, PATH: process.env.PATH },
    });
    assert.equal(stableRun.status, 0, 'post-migration cached run should exit 0');
    assert.equal(readFileSync(svgPath, 'utf8'), migrated, 'post-migration cached run should be byte-stable');
    assert.doesNotMatch((stableRun.stdout ?? Buffer.from('')).toString(), /themed/);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('build-figures TikZ: missing pdflatex prints helpful ERROR when .tex sources exist', { skip: !hasBinary('pdftocairo') ? 'pdftocairo required' : undefined }, async () => {
  // Simulate the no-pdflatex case by stripping PATH so `which pdflatex` fails.
  const projectRoot = mkdtempSync(join(tmpdir(), 'tikz-no-pdflatex-'));
  try {
    const figuresDir = join(projectRoot, 'figures/sample');
    mkdirSync(figuresDir, { recursive: true });
    copyFileSync(TIKZ_FIXTURE, join(figuresDir, 'tikz-basic.tex'));

    // Trim PATH to a minimum that has pdftocairo but no pdflatex. This is
    // tricky cross-platform; simpler: just verify the message text from the
    // script (we know `check('pdflatex')` returns false → ERROR is printed).
    // We use process.env.PATH but replace any TeX paths.
    const filteredPath = (process.env.PATH || '')
      .split(':')
      .filter((p) => !/tex/i.test(p))
      .join(':');
    const r = spawnSync('node', [BUILD_FIGURES], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: { ...process.env, PATH: filteredPath },
    });

    const stderr = (r.stderr ?? Buffer.from('')).toString();
    const stdout = (r.stdout ?? Buffer.from('')).toString();

    // If pdflatex was filtered out, expect the helpful ERROR message.
    // If pdflatex was NOT filtered (e.g., it's at /usr/bin/pdflatex with no "tex" in path),
    // the test is degenerate — skip the assertion.
    const which = spawnSync('which', ['pdflatex'], { env: { ...process.env, PATH: filteredPath } });
    if (which.status === 0) {
      return; // pdflatex still on filtered PATH; can't simulate missing case here
    }

    assert.match(
      stderr,
      /pdflatex not on \$PATH/,
      'should print pdflatex-missing ERROR',
    );
    assert.match(
      stderr,
      /tug\.org/,
      'should include TeX Live install link',
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
