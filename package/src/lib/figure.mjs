/**
 * src/lib/figure.mjs — pure SVG transforms for the figure pipeline (v4.11.0, #84).
 *
 * Two concerns, one module so the `data-diagram-*` sentinels stay DRY:
 *
 *   • BUILD side — `recolorSvg()` rewrites a pdftocairo SVG to be theme-aware
 *     (called by scripts/build-figures.mjs after each PDF→SVG conversion).
 *   • RENDER side — `shouldInline()` + `assembleSvg()` let Figure.astro inline a
 *     local pipeline SVG with a11y <title>/<desc> from the <Figure> props.
 *
 * Why a stylesheet, not presentation attributes: `var()` inside a presentation
 * attribute (`fill="var(--x, …)"`) has unreliable browser support, whereas
 * `var()` in a real <style> rule is universal. So `recolorSvg` injects an
 * attribute-selector rule per distinct themeable color and never mutates a
 * drawing element — the untouched `fill=""`/`stroke=""` attribute is the
 * automatic fallback where `var()` is unsupported.
 *
 * Why inline (vs <img>): an SVG loaded via <img> is CSS-isolated, so a host
 * page's `var(--diagram-*)` cannot reach it — it could only follow the OS
 * prefers-color-scheme via the embedded <style data-diagram-theme>. Inlining
 * puts the SVG in the host DOM, so the host's tokens.css (which tracks the
 * in-page [data-theme] toggle) themes it. `assembleSvg` therefore STRIPS the
 * embedded theme block so the host is the sole source of --fig-*, --series-*,
 * and the backward-compatible --diagram-* aliases.
 *
 * Pure string ops only — no `node:` imports — so the module bundles for any
 * consumer (Figure.astro imports it; fs lives in the .astro/.mjs callers).
 */

import {
  FIGURE_AUTHORING_COLOR_MAP,
  renderStandaloneFigureThemeCss,
} from './figure-palette.mjs';

// Standalone self-theming defaults: used only when the SVG is NOT inlined
// (direct file open / <img>). Hex literals because host CSS vars don't exist
// there. Generated from the same pure manifest as the host tokens.css block.
export const DIAGRAM_THEME_CSS = renderStandaloneFigureThemeCss();

const DIAGRAM_VAR = {
  ink: '--diagram-ink',
  paper: '--diagram-paper',
  grid: '--diagram-grid',
};

// Exact canonical authoring colors. Match by parsed RGB rather than source
// spelling so #3B6FA0, rgb(59,111,160), and Poppler's rgb(23.137%,…) all
// resolve to one semantic variable. Palette recognition MUST run before the
// neutral heuristic: base hue + fill-opacity remains themeable, whereas a
// pre-blended pale tint can otherwise look neutral and collapse to paper.
function rgbKeyFromHex(hex) {
  return [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
    .join(',');
}

const PALETTE_VAR_BY_RGB = new Map(
  FIGURE_AUTHORING_COLOR_MAP.map(({ authoring, variable }) => [
    rgbKeyFromHex(authoring),
    variable,
  ]),
);

/**
 * Parse a solid SVG paint into {r,g,b} in [0,1], or null when it is not a
 * concrete color we should remap (none / url(...) / currentColor / inherit).
 * Handles pdftocairo's `rgb(R%, G%, B%)` plus `rgb(r,g,b)` and #hex for safety.
 */
export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  let m;
  if ((m = v.match(/^rgb\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i))) {
    return { r: +m[1] / 100, g: +m[2] / 100, b: +m[3] / 100 };
  }
  if ((m = v.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i))) {
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255 };
  }
  if ((m = v.match(/^#([0-9a-f]{3})$/i))) {
    const [a, b, c] = m[1];
    return { r: parseInt(a + a, 16) / 255, g: parseInt(b + b, 16) / 255, b: parseInt(c + c, 16) / 255 };
  }
  if ((m = v.match(/^#([0-9a-f]{6})$/i))) {
    return {
      r: parseInt(m[1].slice(0, 2), 16) / 255,
      g: parseInt(m[1].slice(2, 4), 16) / 255,
      b: parseInt(m[1].slice(4, 6), 16) / 255,
    };
  }
  return null;
}

/**
 * Classify a color as 'ink' | 'paper' | 'grid', or null to leave it untouched.
 * Saturated colors (chroma over threshold) are intentional accents and keep
 * their hue across themes; only near-neutral colors are remapped, split by
 * relative luminance into dark ink / light paper / mid gridlines.
 */
export function classifyColor(value) {
  const c = parseColor(value);
  if (!c) return null;
  const chroma = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  if (chroma > 0.12) return null; // saturated accent — preserve as authored
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (lum < 0.3) return 'ink';
  if (lum > 0.9) return 'paper';
  return 'grid';
}

/**
 * Return the CSS custom property for a known Warm–Tol / Okabe–Ito color, or
 * for a neutral paint classified as ink/paper/grid. Unknown saturated colors
 * return null and stay exactly as authored.
 */
export function figureColorVariable(value) {
  const c = parseColor(value);
  if (c && [c.r, c.g, c.b].every((channel) => channel >= 0 && channel <= 1)) {
    const key = [c.r, c.g, c.b].map((channel) => Math.round(channel * 255)).join(',');
    const paletteVar = PALETTE_VAR_BY_RGB.get(key);
    if (paletteVar) return paletteVar;
  }

  const cls = classifyColor(value);
  return cls ? DIAGRAM_VAR[cls] : null;
}

// Escape a value for use inside a CSS [attr="…"] selector string.
function cssAttrEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const THEME_BLOCK_RE = /<style\b[^>]*\bdata-diagram-theme\b[^>]*>[\s\S]*?<\/style>/gi;
const MAP_BLOCK_RE = /<style\b[^>]*\bdata-diagram-map\b[^>]*>[\s\S]*?<\/style>/gi;
const CURRENT_MAP_RE = /\bdata-diagram-map=(?:"2"|'2')/i;

/**
 * Rewrite a pdftocairo SVG to be theme-aware + carry role="img". Pure and
 * idempotent (a second pass is a no-op). `opts.optOut` short-circuits, returning
 * the input unchanged (the `%! no-theme` authoring escape hatch).
 *
 * Injects, right after the opening <svg> tag:
 *   <style data-diagram-theme> — standalone var defaults + @media(dark).
 *   <style data-diagram-map="2"> — `[fill="C"]{fill:var(--fig-X, C)}` … per
 *                                 distinct known-palette or neutral color C.
 *                                 Elements are NOT modified; the attribute
 *                                 stays as fallback.
 */
export function recolorSvg(svg, { optOut = false } = {}) {
  if (typeof svg !== 'string') return svg;
  if (optOut || CURRENT_MAP_RE.test(svg)) return svg;
  if (!/<svg\b[^>]*>/i.test(svg)) return svg;

  // A pre-v2 map contains only neutral roles. Remove its generated blocks and
  // rebuild from the untouched presentation attributes so cached SVGs gain
  // palette mappings after an upgrade without needing a source-file touch.
  const cleanSvg = svg.includes('data-diagram-map')
    ? svg.replace(THEME_BLOCK_RE, '').replace(MAP_BLOCK_RE, '')
    : svg;

  const openMatch = cleanSvg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg; // defensive: generated-block cleanup never removes <svg>

  // Distinct concrete colors used as fill="" / stroke="" attributes.
  const found = new Map(); // original string → CSS custom property
  const attrRe = /\b(?:fill|stroke)="([^"]+)"/g;
  let am;
  while ((am = attrRe.exec(cleanSvg)) !== null) {
    if (found.has(am[1])) continue;
    const variable = figureColorVariable(am[1]);
    if (variable) found.set(am[1], variable);
  }

  let openTag = openMatch[0];
  if (!/\srole=/i.test(openTag)) openTag = openTag.replace(/<svg\b/i, '<svg role="img"');

  // Nothing themeable to remap — still surface role="img" for a11y, no <style>.
  if (found.size === 0) {
    return openTag === openMatch[0]
      ? cleanSvg
      : cleanSvg.slice(0, openMatch.index) + openTag + cleanSvg.slice(openMatch.index + openMatch[0].length);
  }

  let mapCss = '';
  for (const [orig, variable] of found) {
    const sel = cssAttrEscape(orig);
    mapCss +=
      `[fill="${sel}"]{fill:var(${variable}, ${orig})}` +
      `[stroke="${sel}"]{stroke:var(${variable}, ${orig})}`;
  }

  const styleBlocks =
    `<style data-diagram-theme>${DIAGRAM_THEME_CSS}</style>` +
    `<style data-diagram-map="2">${mapCss}</style>`;

  return (
    cleanSvg.slice(0, openMatch.index) +
    openTag +
    styleBlocks +
    cleanSvg.slice(openMatch.index + openMatch[0].length)
  );
}

// ── Render side ────────────────────────────────────────────────────────────

/** Should <Figure> inline `src` (local pipeline .svg) vs render <img>? */
export function shouldInline(src) {
  return (
    typeof src === 'string' &&
    src.startsWith('/') &&
    !src.startsWith('//') && // protocol-relative = remote host
    /\.svg$/i.test(src)
  );
}

/**
 * Convert a local SVG URL into a path relative to the consumer's `public/`
 * directory. Astro prefixes dynamic asset URLs with BASE_URL on non-root
 * deployments, but that prefix is a URL concern and is not present on disk.
 * Literal root URLs remain supported so this helper is backward-compatible.
 *
 * Reject dot segments and backslashes before the filesystem boundary. Figure
 * sources are author-controlled, but an inline helper should never make an
 * out-of-tree file available to `set:html` accidentally.
 */
export function publicSvgPath(src, base = '/') {
  if (!shouldInline(src) || src.includes('\\')) return null;

  const baseSegments = typeof base === 'string'
    ? base.split('/').filter(Boolean)
    : [];
  const normalizedBase = baseSegments.length ? `/${baseSegments.join('/')}/` : '/';
  const withoutBase = normalizedBase !== '/' && src.startsWith(normalizedBase)
    ? src.slice(normalizedBase.length)
    : src.replace(/^\/+/, '');
  const segments = withoutBase.split('/');

  if (!segments.length || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }
  return segments.join('/');
}

/** Remove the standalone self-theming block so host tokens.css is the sole
 *  source of figure variables once the SVG is inlined into the page. */
export function stripThemeBlock(svg) {
  return typeof svg === 'string' ? svg.replace(THEME_BLOCK_RE, '') : svg;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ensureSvgAttr(openTag, name, value) {
  const re = new RegExp(`\\s${name}=`, 'i');
  if (re.test(openTag)) return openTag;
  return openTag.replace(/<svg\b/i, `<svg ${name}="${value}"`);
}

function setSvgAttr(openTag, name, value) {
  const re = new RegExp(`\\s${name}="[^"]*"`, 'i');
  if (re.test(openTag)) return openTag.replace(re, ` ${name}="${value}"`);
  return openTag.replace(/<svg\b/i, `<svg ${name}="${value}"`);
}

function mergeSvgStyle(openTag, css) {
  const re = /\sstyle="([^"]*)"/i;
  const m = openTag.match(re);
  if (m) {
    const existing = m[1].trim().replace(/;\s*$/, '');
    return openTag.replace(re, ` style="${existing ? existing + ';' : ''}${css}"`);
  }
  return openTag.replace(/<svg\b/i, `<svg style="${css}"`);
}

/**
 * Prepare a raw pipeline SVG for inline embedding in <Figure>:
 *   - strip the standalone <style data-diagram-theme> (host tokens.css themes it);
 *   - replace any pre-existing <title>/<desc> with ones from the call-site props
 *     (alt ?? caption → <title>, desc → <desc>) and wire aria-labelledby;
 *   - ensure role="img" and a responsive width on the root <svg>.
 * Pure string transform; output is a trusted local build artifact (set:html).
 */
export function assembleSvg(raw, opts = {}) {
  const { caption, alt, desc, width = '100%', idBase = 'figure' } = opts;
  if (typeof raw !== 'string') return '';

  let svg = stripThemeBlock(raw);
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg;

  let openTag = openMatch[0];
  let body = svg
    .slice(openMatch.index + openTag.length)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, '');

  // Match the raster fallback: `alt` is the short accessible name. A caption
  // is only its fallback, while `desc` remains the optional long description.
  const titleText = alt ?? caption ?? '';
  const descText = desc ?? '';
  const id = String(idBase).replace(/[^a-zA-Z0-9_-]/g, '-');

  const a11y = [];
  if (titleText) {
    a11y.push(`<title id="${id}-title">${escapeXml(titleText)}</title>`);
  }
  if (descText) {
    a11y.push(`<desc id="${id}-desc">${escapeXml(descText)}</desc>`);
  }

  openTag = ensureSvgAttr(openTag, 'role', 'img');
  if (titleText) openTag = setSvgAttr(openTag, 'aria-labelledby', `${id}-title`);
  if (descText) openTag = setSvgAttr(openTag, 'aria-describedby', `${id}-desc`);
  openTag = mergeSvgStyle(openTag, `width:${width};max-width:100%;height:auto`);

  return `${svg.slice(0, openMatch.index)}${openTag}${a11y.join('')}${body}`;
}
