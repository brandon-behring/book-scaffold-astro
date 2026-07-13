/**
 * Theme-token resolver for SVG/canvas islands (#143).
 *
 * CSS-authored visuals should keep using var(--token) directly. Canvas and
 * SVG attributes sometimes need concrete strings, so this hook resolves an
 * explicit token map, refreshes it on `book:theme:change`, and exposes the
 * user's reduced-motion preference to consumer animation code.
 */
import { useEffect, useState } from 'preact/hooks';

export type BookTheme = 'light' | 'dark';
export type ThemeColorToken = `--${string}`;
export type ThemeColorSpec = readonly [token: ThemeColorToken, fallback: string];
export type ThemeColorMap = Readonly<Record<string, ThemeColorSpec>>;
export type ResolvedThemeColors<T extends ThemeColorMap> = {
  readonly [Key in keyof T]: string;
};

export interface ThemeColorsSnapshot<T extends ThemeColorMap> {
  /** Null during SSR; resolved on the first client effect. */
  theme: BookTheme | null;
  colors: ResolvedThemeColors<T>;
  reducedMotion: boolean;
}

function fallbackColors<T extends ThemeColorMap>(specs: T): ResolvedThemeColors<T> {
  return Object.fromEntries(
    Object.entries(specs).map(([key, [, fallback]]) => [key, fallback]),
  ) as ResolvedThemeColors<T>;
}

function assertSpecs(specs: ThemeColorMap): void {
  if (specs === null || typeof specs !== 'object' || Array.isArray(specs)) {
    throw new Error('useThemeColors: specs must be a token-map object.');
  }
  const entries = Object.entries(specs);
  if (entries.length === 0) {
    throw new Error('useThemeColors: provide at least one CSS token mapping.');
  }
  for (const [key, spec] of entries) {
    if (key.trim() === '') {
      throw new Error('useThemeColors: color keys must be non-empty strings.');
    }
    if (!Array.isArray(spec) || spec.length !== 2) {
      throw new Error(`useThemeColors: "${key}" must be a [token, fallback] pair.`);
    }
    const [token, fallback] = spec;
    if (typeof token !== 'string' || !/^--\S+$/.test(token)) {
      throw new Error(`useThemeColors: "${key}" token must start with -- and contain no whitespace.`);
    }
    if (typeof fallback !== 'string' || fallback.trim() === '') {
      throw new Error(`useThemeColors: "${key}" fallback must be a non-empty string.`);
    }
  }
}

function effectiveTheme(): BookTheme {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function snapshot<T extends ThemeColorMap>(
  specs: T,
  themeHint?: BookTheme,
): ThemeColorsSnapshot<T> {
  const computed = getComputedStyle(document.documentElement);
  const colors = Object.fromEntries(
    Object.entries(specs).map(([key, [token, fallback]]) => {
      const resolved = computed.getPropertyValue(token).trim();
      return [key, resolved || fallback];
    }),
  ) as ResolvedThemeColors<T>;
  return {
    theme: themeHint ?? effectiveTheme(),
    colors,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

/**
 * Resolve CSS custom properties and refresh after theme/motion changes.
 *
 * Keep the spec object outside the component (or otherwise stable) so its
 * intent is obvious and the hook does not need to re-subscribe each render.
 */
export function useThemeColors<const T extends ThemeColorMap>(
  specs: T,
): ThemeColorsSnapshot<T> {
  assertSpecs(specs);
  const signature = JSON.stringify(specs);
  const [current, setCurrent] = useState<ThemeColorsSnapshot<T>>(() => ({
    theme: null,
    colors: fallbackColors(specs),
    reducedMotion: false,
  }));

  useEffect(() => {
    const refresh = (themeHint?: BookTheme) => setCurrent(snapshot(specs, themeHint));
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: unknown }>).detail;
      const theme = detail?.theme === 'light' || detail?.theme === 'dark'
        ? detail.theme
        : undefined;
      refresh(theme);
    };
    const onMediaChange = () => refresh();
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    refresh();
    window.addEventListener('book:theme:change', onThemeChange);
    colorScheme.addEventListener('change', onMediaChange);
    reducedMotion.addEventListener('change', onMediaChange);
    return () => {
      window.removeEventListener('book:theme:change', onThemeChange);
      colorScheme.removeEventListener('change', onMediaChange);
      reducedMotion.removeEventListener('change', onMediaChange);
    };
    // signature tracks semantic changes while allowing an inline object whose
    // identity changes but token/fallback pairs do not.
  }, [signature]);

  return current;
}
