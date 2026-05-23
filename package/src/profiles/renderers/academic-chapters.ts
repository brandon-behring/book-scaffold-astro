/**
 * src/profiles/renderers/academic-chapters.ts — ChaptersRenderer implementation
 * for the academic profile. Owns: string-enum part grouping (foundations,
 * ssm-core, beyond-ssm, integration, synthesis), Week N numbering, status
 * badge (7-state). No freshness/last_verified, no tools_compared.
 *
 * Mirrors the v3.5.2 academic branch of pages/chapters.astro — DOM output
 * intended to match exactly so academic visual baselines stay stable.
 */
import type {
  ChaptersRenderer,
  PartKey,
  StatusBadge,
} from '../../lib/chapters-renderer.js';

/**
 * Ordinal positions for the academic-profile `part` enum (src/schemas.ts:
 * academicParts). Order is load-bearing — drives both grouping order and
 * sort key. Must match academicParts in schemas.ts.
 */
const ACADEMIC_PART_ORDINAL: Record<string, number> = {
  foundations: 1,
  'ssm-core': 2,
  'beyond-ssm': 3,
  integration: 4,
  synthesis: 5,
};

const UNKNOWN_PART_ORDINAL = 99;

/** Title-case an enum string: "ssm-core" → "Ssm Core". */
function titleCase(part: string): string {
  return part
    .split('-')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export const academicChaptersRenderer: ChaptersRenderer = {
  partKey(data) {
    return (data.part as PartKey) ?? '';
  },

  formatPartLabel(part) {
    if (typeof part === 'string' && part.length > 0) {
      return titleCase(part);
    }
    return String(part);
  },

  isAppendix(_part) {
    // Academic profile doesn't have appendices in the tools sense.
    return false;
  },

  formatChapterNumber(data, _appendix) {
    const week = (data.week as number) ?? 0;
    return `Week ${week}`;
  },

  getToolsAttr(_data) {
    // Academic chapters opt out of the ToolFilter island by claiming
    // "cross-tool" — they remain visible regardless of filter selection.
    return 'cross-tool';
  },

  getVolatilityData(_data) {
    // Academic profile uses status, not volatility.
    return null;
  },

  getStatusData(data): StatusBadge | null {
    const status = data.status as string | undefined;
    if (!status) return null;
    return { status, label: status };
  },

  getFreshnessData(_data, _now) {
    // Academic profile doesn't track last_verified.
    return null;
  },

  getVerifiedDateLabel(_data) {
    return null;
  },

  getToolsCompared(_data) {
    return [];
  },

  sortKey(data) {
    const partRaw = data.part;
    const partOrdinal =
      typeof partRaw === 'string'
        ? (ACADEMIC_PART_ORDINAL[partRaw] ?? UNKNOWN_PART_ORDINAL)
        : typeof partRaw === 'number'
          ? partRaw
          : UNKNOWN_PART_ORDINAL;
    const week = typeof data.week === 'number' ? data.week : 0;
    return partOrdinal * 1000 + week;
  },
};
