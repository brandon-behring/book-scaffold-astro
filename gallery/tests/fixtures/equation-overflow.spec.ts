import { test } from '@playwright/test';

/* Warning-level equation-overflow check — docs/responsive-reading.md.
 *
 * The authoring standard is that display equations are written multiline
 * (`aligned`/`split`/`gather`) to FIT the reading measure rather than scroll
 * sideways (KaTeX cannot auto-break). This check renders the math fixtures and
 * reports any `.katex-display` whose content is wider than its box.
 *
 * NON-GATING by design: it never fails the build. On GitHub CI an overflow
 * surfaces as a `::warning::` PR annotation (yellow, non-blocking); locally it
 * prints to the console. The `mobile` project (768px) is the tablet-portrait
 * target where the standard must hold; `desktop` (1280px) is reported too. */

const MATH_FIXTURES: { name: string; port: number; routes: string[] }[] = [
  { name: 'research-portfolio', port: 4175, routes: ['/chapters/ch02-math/'] },
];

for (const fx of MATH_FIXTURES) {
  for (const path of fx.routes) {
    test(`equation-overflow ${fx.name}${path}`, async ({ page }, info) => {
      const resp = await page.goto(`http://127.0.0.1:${fx.port}${path}`);
      // Route availability is the visual check's job; here we only measure.
      if (!resp?.ok()) return;

      const result = await page.evaluate(() => {
        const blocks = Array.from(document.querySelectorAll('.katex-display'));
        const over = blocks
          .map((el, i) => ({
            i,
            client: Math.round((el as HTMLElement).clientWidth),
            scroll: Math.round(el.scrollWidth),
          }))
          .filter((b) => b.scroll - b.client > 2);
        return { total: blocks.length, over };
      });

      const vw = page.viewportSize()?.width ?? 0;
      if (result.over.length > 0) {
        const detail = result.over
          .map((o) => `eqn#${o.i} ${o.scroll}px>${o.client}px (+${o.scroll - o.client})`)
          .join('; ');
        const msg =
          `${result.over.length}/${result.total} display equations overflow at ${vw}px on ` +
          `${fx.name}${path} — author them multiline (aligned/split) to fit the measure ` +
          `(docs/responsive-reading.md): ${detail}`;
        info.annotations.push({ type: 'equation-overflow', description: msg });
        // GitHub Actions warning annotation — visible on the PR, does NOT fail the run.
        console.log(`::warning title=Equation overflow (${vw}px)::${msg}`);
      } else {
        console.log(
          `✓ equation-overflow ${fx.name}${path} @${vw}px: ${result.total} display equations fit.`,
        );
      }
      // Intentionally no assertion — warning-level, not a hard gate.
    });
  }
}
