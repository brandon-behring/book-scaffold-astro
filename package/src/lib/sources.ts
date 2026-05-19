/**
 * src/lib/sources.ts — helpers for the sources collection.
 *
 * `sources/manifest.yaml` drives every citation in the book. This
 * module centralizes tier grouping + ordering so the SourceArchive
 * component and any future dashboards share a single source of truth.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { sourceTiers } from '../content.config';

export type SourceEntry = CollectionEntry<'sources'>;
export type SourceTier = (typeof sourceTiers)[number];

/**
 * Grouped source entries keyed by tier, in descending authority
 * (T1-official → T4-conjecture). Empty tiers map to an empty array
 * so callers can render "no sources yet" placeholders without
 * checking for undefined.
 *
 * Within each tier, entries sort by publish_date descending (newest
 * first); entries without a publish_date sort after those with one.
 */
export async function getSourcesByTier(): Promise<Record<SourceTier, SourceEntry[]>> {
  const all = await getCollection('sources');
  const grouped: Record<SourceTier, SourceEntry[]> = {
    'T1-official': [],
    'T2-release-notes': [],
    'T3-practitioner': [],
    'T4-conjecture': [],
  };
  for (const entry of all) {
    grouped[entry.data.tier].push(entry);
  }
  for (const tier of sourceTiers) {
    grouped[tier].sort((a, b) => {
      const ad = a.data.publish_date?.getTime() ?? -Infinity;
      const bd = b.data.publish_date?.getTime() ?? -Infinity;
      return bd - ad;
    });
  }
  return grouped;
}

/** Human-readable description for each tier (used as empty-state label). */
export const TIER_LABELS: Record<SourceTier, string> = {
  'T1-official': 'T1 · Official',
  'T2-release-notes': 'T2 · Release notes',
  'T3-practitioner': 'T3 · Practitioner',
  'T4-conjecture': 'T4 · Conjecture',
};

/** One-line explanation per tier (shown under the heading). */
export const TIER_DESCRIPTIONS: Record<SourceTier, string> = {
  'T1-official':
    'Vendor-official documentation or release notes. Highest trust for factual claims about the vendor\u2019s own tool.',
  'T2-release-notes':
    'Release blog posts, changelogs, conference talks. Trustworthy for intent and availability claims.',
  'T3-practitioner':
    'Respected community writing with a durable argument the author has defended over time.',
  'T4-conjecture':
    'Blog posts, tweets, or unverified claims. Pointers to investigate, not authorities.',
};
