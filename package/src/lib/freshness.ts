/**
 * src/lib/freshness.ts — volatility-aware staleness computation.
 *
 * Each chapter carries a `last_verified` date and a `volatility` class.
 * This module maps those to a freshness status the reader can trust.
 *
 * Thresholds chosen to align with Ch 15's source-tier audit cadences:
 *   stable-principle      → 365 days (principles drift annually at most)
 *   architectural-pattern → 180 days (between annual and quarterly; "on
 *                                     major release" isn't derivable from
 *                                     frontmatter)
 *   feature-surface       → 90 days  (quarterly)
 *
 * Status bands (fraction of threshold):
 *   fresh       (<75%)   — green dot, unobtrusive
 *   verify-soon (75-100%) — yellow, mild warning
 *   stale       (>100%)  — amber/red, "verify before trusting"
 *
 * Example assertions (verified by visual inspection during Stage 3.1):
 *   getFreshness(today, 'feature-surface').status     === 'fresh'
 *   getFreshness(today-70d, 'feature-surface').status === 'verify-soon'
 *   getFreshness(today-100d, 'feature-surface').status === 'stale'
 *   getFreshness(today-200d, 'stable-principle').status === 'fresh'
 *   getFreshness(today-300d, 'stable-principle').status === 'verify-soon'
 */
import type { volatilityLevels } from '../content.config';

export type VolatilityLevel = (typeof volatilityLevels)[number];

export type FreshnessStatus = 'fresh' | 'verify-soon' | 'stale';

export interface Freshness {
  status: FreshnessStatus;
  daysOld: number;
  thresholdDays: number;
  /** Days until stale; negative when already stale. */
  daysUntil: number;
}

const THRESHOLDS: Record<VolatilityLevel, number> = {
  'stable-principle': 365,
  'architectural-pattern': 180,
  'feature-surface': 90,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Compute freshness for a chapter given its last_verified date + volatility.
 *
 * Pure function; caller supplies `now` only in tests. Production callers omit.
 */
export function getFreshness(
  lastVerified: Date,
  volatility: VolatilityLevel,
  now: Date = new Date(),
): Freshness {
  const thresholdDays = THRESHOLDS[volatility];
  const daysOld = Math.floor((now.getTime() - lastVerified.getTime()) / MS_PER_DAY);
  const daysUntil = thresholdDays - daysOld;

  let status: FreshnessStatus;
  if (daysOld < thresholdDays * 0.75) {
    status = 'fresh';
  } else if (daysOld < thresholdDays) {
    status = 'verify-soon';
  } else {
    status = 'stale';
  }

  return { status, daysOld, thresholdDays, daysUntil };
}

/** Human-readable label for each status; used for ARIA + tooltips. */
export function freshnessLabel(f: Freshness): string {
  switch (f.status) {
    case 'fresh':
      return `Fresh (${f.daysOld}d old; verify within ${f.daysUntil}d)`;
    case 'verify-soon':
      return `Verify soon (${f.daysOld}d old; ${f.daysUntil}d until stale)`;
    case 'stale':
      return `Stale (${f.daysOld}d old; ${Math.abs(f.daysUntil)}d past threshold)`;
  }
}
