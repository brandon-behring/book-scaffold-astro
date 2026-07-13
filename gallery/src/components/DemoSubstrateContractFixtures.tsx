import { useState } from 'preact/hooks';
import {
  DemoFrame,
  Slider,
  useThemeColors,
} from '@brandon_m_behring/book-scaffold-astro/demo';

export interface GeneratedIdFixtureProps {
  instance: string;
}

/** Hidden gallery fixture: separate Astro roots must retain unique hydrated IDs. */
export function GeneratedIdFixture({ instance }: GeneratedIdFixtureProps) {
  const [value, setValue] = useState(1);
  return (
    <DemoFrame title={`Generated ID fixture ${instance}`}>
      <Slider
        label={`Generated slider ${instance}`}
        min={0}
        max={2}
        value={value}
        onValueChange={setValue}
      />
    </DemoFrame>
  );
}

/** Hidden gallery fixture: changing the token-map shape must never expose stale keys. */
export function ThemeSpecFixture() {
  const [variant, setVariant] = useState<'ink' | 'accent'>('ink');
  const specs = variant === 'ink'
    ? { ink: ['--missing-demo-ink', '#123456'] } as const
    : { accent: ['--missing-demo-accent', '#345678'] } as const;
  const snapshot = useThemeColors(specs);
  const resolved = variant === 'ink'
    ? (snapshot.colors as { ink: string }).ink
    : (snapshot.colors as { accent: string }).accent;

  return (
    <div>
      <output data-testid="theme-spec-value">{resolved}</output>
      <button
        type="button"
        data-testid="theme-spec-toggle"
        onClick={() => setVariant('accent')}
      >
        Change token map
      </button>
    </div>
  );
}
