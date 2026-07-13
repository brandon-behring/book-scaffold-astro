import type {
  BookConfigOptions,
  OgCardsConfig,
} from '@brandon_m_behring/book-scaffold-astro';

declare const ogCards: OgCardsConfig;

export const defaultCards: BookConfigOptions = {
  site: 'https://example.invalid',
  seo: { ogCards: true },
};
export const configuredCards: BookConfigOptions = {
  site: 'https://example.invalid',
  seo: {
    ogCards: {
      enabled: true,
      exclude: ['/print/', '/answers/**'],
    },
  },
};
export const disabledCards: BookConfigOptions = {
  site: 'https://example.invalid',
  seo: { ogCards: { enabled: false } },
};

// @ts-expect-error OgCardsConfig is a real object type, never a number
export const guardOgCards: number = ogCards;
// @ts-expect-error enabled must be boolean
export const invalidEnabled: OgCardsConfig = { enabled: 'yes' };
// @ts-expect-error every exclusion must be a string
export const invalidExclude: OgCardsConfig = { exclude: ['/print/', 42] };
export const invalidCardsConfig: BookConfigOptions = {
  site: 'https://example.invalid',
  // @ts-expect-error seo.ogCards accepts a boolean or OgCardsConfig, not a string
  seo: { ogCards: 'yes' },
};
