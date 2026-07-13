/**
 * Type-surface guard (#133).
 *
 * Imports the symbols that dist/index.d.ts re-exports through the shared
 * hashed declaration chunk (dist/types-<hash>.d.ts). If a build stops
 * shipping that file — as `tsup && rm -f dist/types-*.d.ts` did — runtime
 * stays green (dist/index.mjs is self-contained) so node:test never
 * notices, while every symbol below silently degrades to `any` for
 * TypeScript consumers: tsc reports the unresolved import only *inside*
 * the .d.ts, which skipLibCheck suppresses (and skipLibCheck:false drowns
 * in third-party d.ts noise — astro/unstorage optional peers).
 *
 * So each symbol is guarded by inversion: a deliberately illegal
 * assignment under `@ts-expect-error`. A real type rejects the assignment
 * and the directive consumes that error; a degraded `any` accepts it and
 * the directive itself fails the build (TS2578 "Unused '@ts-expect-error'
 * directive") — an error in THIS file, which skipLibCheck never skips.
 * (`0 extends 1 & T` any-detection does NOT work here: the unresolved
 * import yields TS's error type, which collapses the conditional so both
 * branches satisfy.)
 *
 * `npm run check:types` compiles this against the built dist via package
 * self-reference — the same exports-map path a real consumer resolves.
 */
import type {
  GlossaryTerm,
  BookConfigOptions,
  NumberStyle,
  PartialRouteToggles,
  Question,
  ReleaseStatusConfig,
  SecurityHeadersConfig,
  RouteToggles,
  StyleInput,
} from '@brandon_m_behring/book-scaffold-astro';
import {
  defineStyle,
  glossarySchema,
  questionSchema,
} from '@brandon_m_behring/book-scaffold-astro';
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
import VersionSelector, {
  type VersionEntry,
  type VersionSelectorProps,
} from '@brandon_m_behring/book-scaffold-astro/components/VersionSelector';
import {
  DemoFrame,
  Slider,
  StatCards,
  useThemeColors,
  type DemoFrameProps,
  type DemoHeadingLevel,
  type SliderProps,
  type StatCardTone,
  type StatCardsProps,
  type ThemeColorToken,
} from '@brandon_m_behring/book-scaffold-astro/demo';

declare const glossaryTerm: GlossaryTerm;
declare const routeToggles: RouteToggles;
declare const partialRouteToggles: PartialRouteToggles;
declare const question: Question;
declare const releaseStatus: ReleaseStatusConfig;
declare const numberStyle: NumberStyle;
declare const securityHeaders: SecurityHeadersConfig;

// Public opt-out must be accepted both on a Style and at book level.
export const suppressedStyleStatus: StyleInput = { releaseStatus: false };
export const suppressedBookStatus: BookConfigOptions = {
  site: 'https://example.invalid',
  releaseStatus: false,
};
export const defaultSecurityHeaders: BookConfigOptions = {
  site: 'https://example.invalid',
  securityHeaders: {},
};
export const customSecurityHeaders: BookConfigOptions = {
  site: 'https://example.invalid',
  securityHeaders: { contentSecurityPolicy: "default-src 'self'" },
};
export const suppressedSecurityHeaders: BookConfigOptions = {
  site: 'https://example.invalid',
  securityHeaders: false,
};

const version: VersionEntry = {
  href: '/versions/v4/',
  label: 'v4',
  date: '2026-07-13',
  current: true,
};
export const versionSelectorProps: VersionSelectorProps = { versions: [version] };
export const versionSelectorComponent: typeof VersionSelector = VersionSelector;

export const demoFrameProps: DemoFrameProps = {
  id: 'sampling-demo',
  title: 'Sampling distribution',
  description: 'Adjust the sample size.',
  headingLevel: 2,
};
export const demoHeadingLevel: DemoHeadingLevel = 4;
export const sliderProps: SliderProps = {
  label: 'Sample size',
  value: 20,
  min: 10,
  max: 100,
  onValueChange(value) { void value; },
  formatValue: (value) => `${value}%`,
  getValueText: (value) => `${value} percent`,
};
export const statCardsProps: StatCardsProps = {
  items: [{ label: 'Bias', value: 0, tone: 'positive' }],
};
export const demoFrameComponent: typeof DemoFrame = DemoFrame;
export const sliderComponent: typeof Slider = Slider;
export const statCardsComponent: typeof StatCards = StatCards;
export const themeToken: ThemeColorToken = '--color-text';
export const themeSnapshot = useThemeColors({
  ink: ['--color-text', '#111111'],
  accent: ['--color-link', '#225588'],
} as const);
export const resolvedInk: string = themeSnapshot.colors.ink;
export const validStatTone: StatCardTone = 'warning';

// @ts-expect-error VersionEntry takes a resolved href, not the retired stub id field
export const invalidVersionEntry: VersionEntry = { id: 'v4', label: 'v4', date: '2026-07-13' };
// @ts-expect-error slider callbacks receive a number, not a native Event
export const invalidSlider: SliderProps = { label: 'x', value: 1, min: 0, max: 2, onValueChange(event: Event) { void event; } };
// @ts-expect-error ThemeColorToken must be a CSS custom-property name
export const invalidThemeToken: ThemeColorToken = 'color-text';
// @ts-expect-error StatCardTone is a closed semantic union
export const invalidStatTone: StatCardTone = 'danger';
// @ts-expect-error Demo headings use the closed h2-h6 range
export const invalidDemoHeading: DemoHeadingLevel = 1;

// Each line must keep erroring; if one stops, that symbol degraded to `any`.
// @ts-expect-error GlossaryTerm is a real object type, never a number
export const guardGlossaryTerm: number = glossaryTerm;
// @ts-expect-error RouteToggles is a real object type, never a number
export const guardRouteToggles: number = routeToggles;
// @ts-expect-error PartialRouteToggles is a real object type, never a number
export const guardPartialRouteToggles: number = partialRouteToggles;
// @ts-expect-error Question is a real object type, never a number
export const guardQuestion: number = question;
// @ts-expect-error ReleaseStatusConfig is a real object type, never a number
export const guardReleaseStatus: number = releaseStatus;
// @ts-expect-error NumberStyle is a closed string union, never a number
export const guardNumberStyle: number = numberStyle;
// @ts-expect-error SecurityHeadersConfig is a real object type, never a number
export const guardSecurityHeaders: number = securityHeaders;
// @ts-expect-error contentSecurityPolicy must be a string
export const invalidSecurityHeaders: BookConfigOptions = { site: 'https://example.invalid', securityHeaders: { contentSecurityPolicy: 42 } };
// @ts-expect-error glossarySchema is a real zod schema, never a number
export const guardGlossarySchema: number = glossarySchema;
// @ts-expect-error questionSchema is a real zod schema, never a number
export const guardQuestionSchema: number = questionSchema;
// @ts-expect-error defineBookSchemas is a real function, never a number
export const guardDefineBookSchemas: number = defineBookSchemas;

defineStyle({ numberStyle: 'per-kind' });
// @ts-expect-error numberStyle rejects values outside shared | per-kind
defineStyle({ numberStyle: 'separate' });
