# Recipe 23 — Interactive demo substrate

**Profile:** any

## TL;DR

Build the domain logic in your book, then compose the package's opt-in Preact
primitives for the repeated shell and accessibility plumbing. Import the
stylesheet explicitly and hydrate your own island; the scaffold never mounts a
demo, chooses data, or ships statistical/visualization kernels for you.

```astro
---
import SamplingDemo from '../components/SamplingDemo.tsx';
import '@brandon_m_behring/book-scaffold-astro/styles/demo.css';
---

<SamplingDemo client:visible />
```

Inside the island:

```tsx
import { useState } from 'preact/hooks';
import { DemoFrame, Slider, StatCards } from '@brandon_m_behring/book-scaffold-astro/demo';

export default function SamplingDemo() {
  const [size, setSize] = useState(20);

  return (
    <DemoFrame id="sampling-demo" title="Sampling distribution"
      description="Adjust sample size and compare uncertainty."
      caption="Simulation and chart logic remain in this book.">
      <Slider
        label="Sample size"
        value={size} min={10} max={100} step={10}
        onValueChange={setSize}
        formatValue={(value) => `n = ${value}`}
        getValueText={(value) => `${value} observations`}
      />
      <StatCards items={[
        { label: 'Sample size', value: size, tone: 'accent' },
        { label: 'Standard error', value: (1 / Math.sqrt(size)).toFixed(3) },
      ]} />
    </DemoFrame>
  );
}
```

## Theme-aware visuals

Inline SVG should normally stay in CSS. Give the SVG an accessible name and
use the stylesheet's semantic attributes; they recolor without JavaScript:

```tsx
<div class="demo-frame__visual">
  <svg data-demo-visual role="img" aria-labelledby="plot-title plot-desc" viewBox="0 0 320 120">
    <title id="plot-title">Estimate by sample size</title>
    <desc id="plot-desc">The estimate approaches the reference line.</desc>
    <path data-demo-stroke="accent" fill="none" d="M0 90 L320 30" />
    <circle data-demo-fill="warning" cx="80" cy="70" r="5" />
  </svg>
</div>
```

Canvas and JS-computed drawing attributes need concrete colors. Resolve an
explicit token map with `useThemeColors`; it is SSR-safe, refreshes after
`book:theme:change` and system color-scheme changes, and reports reduced motion:

```tsx
import { useThemeColors } from '@brandon_m_behring/book-scaffold-astro/demo';

const TOKENS = { ink: ['--color-text', '#1a1a19'], accent: ['--color-link', '#3b6fa0'] } as const;

const { colors, theme, reducedMotion } = useThemeColors(TOKENS);
// Repaint from colors; theme is null during SSR. Skip animation when reducedMotion.
```

## Contracts and gotchas

- `DemoFrame` owns `<figure>`, heading, description, caption, and generated ID relationships. Give the visualization itself `role="img"` and a useful `<title>`/`<desc>` or `aria-label`; the frame cannot describe chart content.
- `Slider` is controlled. Update its `value` in `onValueChange`. Its label and
  current value are always visible; use `getValueText` when visible shorthand
  would be unclear when spoken.
- `StatCards` renders a semantic definition list. It is not live by default so
  dragging a slider does not create announcement spam. Use `live="polite"`
  only for changes that occur independently of the user's control.
- `demo.css` scopes its reduced-motion guard to `.demo-frame`; the hook exposes the same preference for canvas or requestAnimationFrame logic.
- Props fail loudly for empty labels, invalid numeric ranges, non-finite values,
  invalid tones, duplicate metric keys, and malformed token maps.

Not included: OLS/residualization/sampling kernels, chart primitives, data loaders,
tabs, predict/reveal policy, or domain logic. Keep those consumer-owned.

## Canonical files

- `components/demo/` — component and hook source
- `styles/demo.css` — explicitly imported styling and SVG token helpers
- `tests/demo-substrate.test.mjs` — semantics and fail-loud contracts
- `gallery/src/pages/demo-substrate.astro` — interaction/theme fixture
