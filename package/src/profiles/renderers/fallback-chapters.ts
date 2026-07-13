/**
 * src/profiles/renderers/fallback-chapters.ts — ChaptersRenderer used by
 * profiles that don't ship a dedicated renderer (minimal, course-notes).
 * Dispatches by field presence — exactly the v3.5.2
 * logic that lived inline in pages/chapters.astro before #35.
 *
 * Safety net for shapes we haven't designed for explicitly. If a consumer
 * opts a course-notes book into `routes.chapters: true`,
 * the fallback renders reasonably without crashing. Custom output for those
 * profiles is a v4+ extension point (consumer-overridable renderer).
 */
import type {
  ChaptersRenderer,
  PartKey,
  VolatilityBadge,
  StatusBadge,
  FreshnessAffordance,
} from '../../lib/chapters-renderer.js';
import { toolsChaptersRenderer } from './tools-chapters.js';
import { academicChaptersRenderer } from './academic-chapters.js';

function isToolsShape(data: Record<string, unknown>): boolean {
  return 'volatility' in data && 'chapter' in data;
}

function isAcademicShape(data: Record<string, unknown>): boolean {
  return 'week' in data && 'status' in data;
}

/** Per-chapter dispatch to whichever known renderer matches the data shape. */
function dispatch(data: Record<string, unknown>): ChaptersRenderer {
  if (isToolsShape(data)) return toolsChaptersRenderer;
  if (isAcademicShape(data)) return academicChaptersRenderer;
  // Unknown shape — return tools as the most-feature-complete default. The
  // individual method results below short-circuit to safe values when fields
  // are missing.
  return toolsChaptersRenderer;
}

export const fallbackChaptersRenderer: ChaptersRenderer = {
  partKey(data) {
    return (data.part as PartKey) ?? 0;
  },

  formatPartLabel(part) {
    if (typeof part === 'number') {
      return part >= 6 ? 'Appendices' : `Part ${part}`;
    }
    return dispatch({ part } as Record<string, unknown>).formatPartLabel(part);
  },

  isAppendix(part) {
    return typeof part === 'number' && part >= 6;
  },

  formatChapterNumber(data, appendix) {
    return dispatch(data).formatChapterNumber(data, appendix);
  },

  getToolsAttr(data) {
    return dispatch(data).getToolsAttr(data);
  },

  getVolatilityData(data): VolatilityBadge | null {
    return dispatch(data).getVolatilityData(data);
  },

  getStatusData(data): StatusBadge | null {
    return dispatch(data).getStatusData(data);
  },

  getFreshnessData(data, now): FreshnessAffordance | null {
    return dispatch(data).getFreshnessData(data, now);
  },

  getVerifiedDateLabel(data) {
    return dispatch(data).getVerifiedDateLabel(data);
  },

  getToolsCompared(data) {
    return dispatch(data).getToolsCompared(data);
  },

  sortKey(data) {
    return dispatch(data).sortKey(data);
  },
};
