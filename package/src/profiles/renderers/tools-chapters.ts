/**
 * src/profiles/renderers/tools-chapters.ts — ChaptersRenderer implementation
 * for the tools profile. Owns: numeric part grouping (with Appendix splitting
 * at part >= 6), Chapter N numbering, volatility badge, freshness affordance
 * from last_verified + volatility class, tools_compared tags.
 *
 * Mirrors the pre-v3.7.0 logic in pages/chapters.astro for tools-shape
 * chapters — DOM output is intended to be byte-equivalent so the existing
 * visual-regression baselines (package/tests/visual/fixture/) pass without
 * recapture.
 */
import type {
  ChaptersRenderer,
  PartKey,
  VolatilityBadge,
  StatusBadge,
  FreshnessAffordance,
} from '../../lib/chapters-renderer.js';
import { getFreshness, freshnessLabel, type VolatilityLevel } from '../../lib/freshness.js';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function freshnessText(status: 'fresh' | 'verify-soon' | 'stale'): string {
  switch (status) {
    case 'fresh':
      return 'Fresh';
    case 'verify-soon':
      return 'Verify soon';
    case 'stale':
      return 'Stale';
  }
}

export const toolsChaptersRenderer: ChaptersRenderer = {
  partKey(data) {
    return (data.part as number) ?? 0;
  },

  formatPartLabel(part) {
    if (typeof part === 'number') {
      return part >= 6 ? 'Appendices' : `Part ${part}`;
    }
    // Defensive: unknown shape passed in. Render as-is.
    return String(part);
  },

  isAppendix(part) {
    return typeof part === 'number' && part >= 6;
  },

  formatChapterNumber(data, appendix) {
    const chapter = (data.chapter as number) ?? 0;
    if (appendix) {
      // 'a', 'b', 'c', ... — matches pre-v3.7.0 String.fromCharCode(64 + chapter).toLowerCase()
      return `Appendix ${String.fromCharCode(64 + chapter).toLowerCase()}`;
    }
    return `Chapter ${chapter}`;
  },

  getToolsAttr(data) {
    const tools = (data.tools_compared as string[]) ?? [];
    return tools.join(' ');
  },

  getVolatilityData(data): VolatilityBadge | null {
    const level = data.volatility as string | undefined;
    if (!level) return null;
    return { level, label: level };
  },

  getStatusData(_data): StatusBadge | null {
    // Tools profile uses volatility, not status. Status is academic-only.
    return null;
  },

  getFreshnessData(data, now): FreshnessAffordance | null {
    const lastVerified = data.last_verified as Date | undefined;
    const volatility = data.volatility as VolatilityLevel | undefined;
    if (!lastVerified || !volatility) return null;
    const f = getFreshness(lastVerified, volatility, now);
    if (!f) return null;
    return { status: f.status, label: freshnessLabel(f) };
  },

  getVerifiedDateLabel(data) {
    const lastVerified = data.last_verified as Date | undefined;
    if (!(lastVerified instanceof Date)) return null;
    return `verified ${formatDate(lastVerified)}`;
  },

  getToolsCompared(data) {
    return ((data.tools_compared as string[]) ?? []).slice();
  },

  sortKey(data) {
    const part = (data.part as number) ?? 0;
    const chapter = (data.chapter as number) ?? 0;
    return part * 1000 + chapter;
  },
};
