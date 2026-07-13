import { useState } from 'preact/hooks';
import {
  DemoFrame,
  Slider,
  StatCards,
  useThemeColors,
} from '@brandon_m_behring/book-scaffold-astro/demo';

const CHART_COLORS = {
  ink: ['--color-text', '#1a1a19'],
  accent: ['--color-link', '#3b6fa0'],
} as const;

function effectiveTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function DemoSubstrateFixture() {
  const [sampleSize, setSampleSize] = useState(40);
  const { theme, colors, reducedMotion } = useThemeColors(CHART_COLORS);
  const uncertainty = (1 / Math.sqrt(sampleSize)).toFixed(3);
  const pointX = 42 + sampleSize * 2.2;

  function toggleTheme(): void {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    window.dispatchEvent(new CustomEvent('book:theme:change', {
      detail: { theme: next },
    }));
  }

  return (
    <DemoFrame
      id="gallery-demo-substrate"
      title="Sampling uncertainty"
      description="A consumer-owned calculation composed with the shared shell, control, metrics, and theme plumbing."
      caption="The substrate renders the interface; this fixture owns the formula and chart geometry."
    >
      <Slider
        id="gallery-sample-size"
        label="Sample size"
        description="Observations in each simulated sample."
        value={sampleSize}
        min={20}
        max={100}
        step={10}
        onValueChange={setSampleSize}
        formatValue={(value) => `n = ${value}`}
        getValueText={(value) => `${value} observations`}
      />

      <StatCards
        label="Simulation summary"
        items={[
          { label: 'Sample size', value: sampleSize, tone: 'accent' },
          {
            label: 'Uncertainty',
            value: uncertainty,
            detail: '1 divided by the square root of n',
            tone: sampleSize >= 60 ? 'positive' : 'warning',
          },
        ]}
      />

      <div class="demo-frame__visual">
        <svg
          data-demo-visual
          viewBox="0 0 360 150"
          role="img"
          aria-labelledby="gallery-chart-title gallery-chart-description"
        >
          <title id="gallery-chart-title">Uncertainty by sample size</title>
          <desc id="gallery-chart-description">
            A reference line and estimate point move as the sample-size slider changes.
          </desc>
          <rect data-demo-fill="surface" width="360" height="150" rx="4" />
          <line
            data-testid="css-themed-mark"
            data-demo-stroke="accent"
            x1="32"
            y1="112"
            x2="328"
            y2="38"
            stroke-width="5"
            stroke-linecap="round"
          />
          <circle
            data-testid="hook-themed-mark"
            cx={pointX}
            cy={42 + Number(uncertainty) * 180}
            r="9"
            fill={colors.ink}
            stroke={colors.accent}
            stroke-width="3"
          />
        </svg>
      </div>

      <div class="demo-gallery-status">
        <p>
          Hook theme: <output data-testid="theme-status">{theme ?? 'unresolved'}</output>
          {' · '}
          Reduced motion: <output data-testid="motion-status">{String(reducedMotion)}</output>
        </p>
        <span class="demo-gallery-pulse" data-testid="motion-sample" aria-hidden="true" />
        <button type="button" class="demo-gallery-toggle" onClick={toggleTheme}>
          Toggle demo theme
        </button>
      </div>
    </DemoFrame>
  );
}
