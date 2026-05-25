/**
 * src/lib/define-tips.ts — `defineTips()` API for cross-volume tip registry
 * (v4.3.0, closes #70).
 *
 * Pragmatic Programmer-style numbered tips can be distributed across multiple
 * volumes (e.g., Handbook tips 1-25, Architect's Reference 26-40, Field-Guide
 * 41-50). Authors write `<Tip n="14" ...>` with explicit numbers; defineTips()
 * lets per-volume books offset their displayed numbers + label without
 * renumbering source tags.
 *
 * Branded type follows the same convention as `defineStyle` (v4.0.0 D6):
 * type-only `unique symbol` brand, closed shape, readonly fields, no public
 * index signature. Consumer-side metadata goes in scoped `extra` if needed.
 */

// ===== Branded nominal type =====

declare const TipsConfigBrand: unique symbol;

export interface TipsConfig {
  /** Type-only brand for nominal typing. Set automatically by defineTips. */
  readonly [TipsConfigBrand]: true;
  /** Internal version marker; auto-set to 1 by defineTips. */
  readonly __tipsConfigVersion: 1;
  /** Display offset added to each `<Tip n="N">` for cross-volume coordination.
   *  Example: Vol B with volumeOffset=25 renders `<Tip n="1">` as "Tip 26". */
  readonly volumeOffset?: number;
  /** Optional label shown alongside tip numbers in the /tips index + TipsCard.
   *  Example: "Vol B" → "Vol B Tip 26". */
  readonly volumeLabel?: string;
  /** Scoped consumer-side metadata (matches defineStyle pattern). */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/** Input type for defineTips — omits the auto-set internal fields. */
export type TipsConfigInput = Omit<TipsConfig, typeof TipsConfigBrand | '__tipsConfigVersion'>;

/**
 * Identity helper that creates a typed, branded TipsConfig.
 * Zero runtime overhead beyond an object spread + version marker.
 *
 * Usage:
 *
 *   import { defineTips } from '@brandon_m_behring/book-scaffold-astro';
 *
 *   export const tipsConfig = defineTips({
 *     volumeOffset: 25,
 *     volumeLabel: 'Vol B',
 *   });
 *
 * Consumed by `<Tip>` and `<TipsCard>` components + the auto-injected
 * `/tips` route to compute display numbers from `<Tip n="N">` source tags.
 */
export function defineTips(opts: TipsConfigInput): TipsConfig {
  return { __tipsConfigVersion: 1, ...opts } as TipsConfig;
}
