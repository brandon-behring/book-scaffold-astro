/**
 * Research-portfolio /chapters renderer.
 *
 * The portfolio schema intentionally permits numeric Parts through 20. The
 * generic fallback renderer inherits the tools profile's historical
 * `part >= 6` appendix convention, which mislabels a portfolio's sixth Part
 * as "Appendices" and its chapters as Appendix a/b/.... Keep the fallback's
 * field-shape dispatch for every other affordance, but make numeric Parts
 * ordinary numbered Parts throughout the portfolio schema's full range.
 */
import type { ChaptersRenderer } from '../../lib/chapters-renderer.js';
import { fallbackChaptersRenderer } from './fallback-chapters.js';

export const researchPortfolioChaptersRenderer: ChaptersRenderer = {
  ...fallbackChaptersRenderer,

  formatPartLabel(part) {
    return typeof part === 'number'
      ? `Part ${part}`
      : fallbackChaptersRenderer.formatPartLabel(part);
  },

  isAppendix(_part) {
    return false;
  },
};
