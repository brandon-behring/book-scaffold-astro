/**
 * Deterministic, build-time Open Graph cards (#157).
 *
 * The integration intentionally works from Astro's rendered HTML rather than
 * source collections. That keeps consumer-owned pages in scope and makes the
 * rendered canonical metadata the single source of truth.
 */
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { parse } from 'parse5';
import type { BookCorpus } from '../types.js';
import type { BookProfile } from '../profiles/index.js';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const TEMPLATE_VERSION = 1;
const TITLE_LIMIT = 96;
const DESCRIPTION_LIMIT = 180;
const BOOK_TITLE_LIMIT = 72;
const HOSTNAME_LIMIT = 80;

const ALLOWED_CONFIG_KEYS = new Set(['enabled', 'exclude']);
const UNSUPPORTED_GLOB_TOKENS = /[?\[\]{}]/u;

export interface ResolvedOgCardsConfig {
  readonly enabled: true;
  readonly exclude: readonly string[];
}

interface CorpusBookLike {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly image?: string;
}

interface OgCardsIntegrationOptions {
  profile: BookProfile;
  corpus?: BookCorpus | null;
  title?: string;
  description?: string;
  ogCards: ResolvedOgCardsConfig;
  /** Top-level `seo.ogImage`; exact corpus-book images take precedence. */
  staticOgImage?: string;
}

interface HtmlAttribute {
  name: string;
  value: string;
}

interface HtmlLocation {
  startOffset: number;
  endOffset: number;
  startTag?: { startOffset: number; endOffset: number };
  endTag?: { startOffset: number; endOffset: number };
}

interface HtmlNode {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: HtmlAttribute[];
  childNodes?: HtmlNode[];
  sourceCodeLocation?: HtmlLocation | null;
}

interface ParsedPage {
  document: HtmlNode;
  head: HtmlNode;
  route: string;
  file: string;
}

interface PageIdentity {
  book: CorpusBookLike | null;
  surface: 'corpus' | null;
}

interface CardPayload {
  templateVersion: number;
  width: number;
  height: number;
  profile: BookProfile;
  bookId: string | null;
  bookTitle: string;
  title: string;
  description: string;
  hostname: string;
}

interface PlannedCard {
  page: ParsedPage;
  source: string;
  payload: CardPayload;
  payloadJson: string;
  hash: string;
  imageUrl: string;
}

interface PlannedStaticImage {
  page: ParsedPage;
  source: string;
  imageUrl: string;
}

interface Theme {
  background: string;
  accent: string;
}

const PROFILE_THEMES: Readonly<Record<BookProfile, Theme>> = Object.freeze({
  academic: Object.freeze({ background: '#1A1816', accent: '#7297BB' }),
  tools: Object.freeze({ background: '#26231F', accent: '#AB80A5' }),
  minimal: Object.freeze({ background: '#1A1816', accent: '#D2B575' }),
  'course-notes': Object.freeze({ background: '#1A1816', accent: '#7DA275' }),
  'research-portfolio': Object.freeze({ background: '#26231F', accent: '#D29287' }),
});

/** Fail-loud config normalization shared by defineBookConfig and tests. */
export function normalizeOgCardsConfig(value: unknown): ResolvedOgCardsConfig | null {
  if (value === undefined || value === false) return null;
  if (value === true) return Object.freeze({ enabled: true, exclude: Object.freeze([]) });

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      'seo.ogCards must be true, false, or an object with enabled and exclude fields.',
    );
  }

  const input = value as Record<string, unknown>;
  const unknown = Object.keys(input).filter((key) => !ALLOWED_CONFIG_KEYS.has(key));
  if (unknown.length > 0) {
    throw new Error(`seo.ogCards contains unknown ${unknown.length === 1 ? 'field' : 'fields'}: ${unknown.join(', ')}.`);
  }
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    throw new Error('seo.ogCards.enabled must be a boolean.');
  }
  if (input.exclude !== undefined && !Array.isArray(input.exclude)) {
    throw new Error('seo.ogCards.exclude must be an array of route patterns.');
  }

  const exclude = (input.exclude ?? []) as unknown[];
  const normalized = Array.from(exclude, (pattern, index) => validateExcludePattern(pattern, index));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('seo.ogCards.exclude must not contain duplicate patterns.');
  }

  if (input.enabled === false) return null;
  return Object.freeze({ enabled: true, exclude: Object.freeze(normalized) });
}

function validateExcludePattern(value: unknown, index: number): string {
  const label = `seo.ogCards.exclude[${index}]`;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  if (!value.startsWith('/')) {
    throw new Error(`${label} must be base-relative and start with "/".`);
  }
  if (value.startsWith('//') || value.includes('\\') || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new Error(`${label} must be a local route pattern without a host, backslash, or control character.`);
  }
  if (value.includes('?') || value.includes('#')) {
    throw new Error(`${label} must not contain a query string or fragment.`);
  }
  if (UNSUPPORTED_GLOB_TOKENS.test(value)) {
    throw new Error(`${label} supports only literal segments plus whole "*" and "**" segments.`);
  }

  const segments = value.slice(1).split('/');
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    const trailingSlash = segmentIndex === segments.length - 1 && segment === '';
    if (!trailingSlash && segment === '') {
      throw new Error(`${label} must not contain an empty route segment.`);
    }
    if (segment === '.' || segment === '..') {
      throw new Error(`${label} must not contain "." or ".." route segments.`);
    }
    if (segment.includes('*') && segment !== '*' && segment !== '**') {
      throw new Error(`${label}: "*" and "**" must occupy a complete route segment.`);
    }
  }
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&');
}

function exclusionMatcher(pattern: string): RegExp {
  const segments = pattern.split('/');
  let source = '^';

  // The first split segment is empty because every valid pattern starts `/`.
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    if (segment === '' && isLast) {
      source += '/';
      continue;
    }
    if (segment === '**') {
      source += isLast ? '(?:/.*)?' : '(?:/[^/]+)*';
      continue;
    }
    if (segment === '*') {
      source += '/[^/]+';
      continue;
    }
    source += `/${escapeRegExp(segment)}`;
  }
  return new RegExp(`${source}$`, 'u');
}

function normalizeBase(base: string | undefined): string {
  const trimmed = (base ?? '/').trim();
  if (!trimmed || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

function cardUrl(site: URL, base: string, hash: string): string {
  const url = new URL(site.origin);
  url.pathname = `${normalizeBase(base)}_og/${hash}.png`.replace(/\/{2,}/g, '/');
  return url.toString();
}

function resolveStaticImageUrl(value: string, site: URL, base: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('OG card static image must not be blank.');
  if (/^https?:\/\//iu.test(trimmed)) {
    return absoluteHttpUrl(trimmed, 'static OG image', '(config)').toString();
  }
  if (trimmed.startsWith('//')) {
    if (trimmed.startsWith('///')) {
      throw new Error(`OG card static image has an invalid protocol-relative URL: ${JSON.stringify(value)}.`);
    }
    return absoluteHttpUrl(`${site.protocol}${trimmed}`, 'static OG image', '(config)').toString();
  }
  if (/^[a-z][a-z\d+.-]*:/iu.test(trimmed)) {
    throw new Error(
      `OG card static image must be local, protocol-relative, or http(s) (got ${JSON.stringify(value)}).`,
    );
  }
  if (trimmed.includes('\\') || /[\u0000-\u001F\u007F]/u.test(trimmed)) {
    throw new Error('OG card local static image must not contain a backslash or control character.');
  }

  const rawPath = trimmed.split(/[?#]/u, 1)[0];
  if (!rawPath) throw new Error('OG card local static image must contain a path.');
  for (const rawSegment of rawPath.split('/')) {
    let decoded = rawSegment;
    try {
      for (let pass = 0; pass < 4; pass += 1) {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      }
    } catch {
      throw new Error(`OG card local static image contains invalid percent encoding: ${JSON.stringify(value)}.`);
    }
    if (
      decoded === '.'
      || decoded === '..'
      || decoded.includes('/')
      || decoded.includes('\\')
      || /[\u0000-\u001F\u007F]/u.test(decoded)
    ) {
      throw new Error(`OG card local static image must not contain encoded path traversal: ${JSON.stringify(value)}.`);
    }
  }

  const localPath = `/${rawPath.replace(/^\/+/, '')}`;
  const suffix = trimmed.slice(rawPath.length);
  const normalizedBase = normalizeBase(base);
  const baseWithoutTrailingSlash = normalizedBase.replace(/\/+$/u, '');
  const alreadyPrefixed = normalizedBase === '/'
    || localPath === baseWithoutTrailingSlash
    || localPath.startsWith(normalizedBase);
  const resolvedPath = alreadyPrefixed
    ? localPath
    : `${normalizedBase}${localPath.slice(1)}`;

  let url: URL;
  try {
    url = new URL(`${resolvedPath}${suffix}`, site.origin);
  } catch {
    throw new Error(`OG card static image ${JSON.stringify(value)} is not a valid URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`OG card static image must resolve to an http(s) URL (got ${JSON.stringify(value)}).`);
  }
  return url.toString();
}

function walk(node: HtmlNode, visit: (node: HtmlNode) => void): void {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

function attr(node: HtmlNode, name: string): string | null {
  const found = node.attrs?.find((candidate) => candidate.name.toLowerCase() === name);
  return found?.value ?? null;
}

function elements(document: HtmlNode, tagName: string): HtmlNode[] {
  const found: HtmlNode[] = [];
  walk(document, (node) => {
    if (node.tagName?.toLowerCase() === tagName) found.push(node);
  });
  return found;
}

function textContent(node: HtmlNode): string {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textContent).join('');
}

function metas(document: HtmlNode, attribute: 'name' | 'property', value: string): HtmlNode[] {
  const normalizedValue = value.toLowerCase();
  return elements(document, 'meta').filter(
    (node) => attr(node, attribute)?.trim().toLowerCase() === normalizedValue,
  );
}

function contentOfUniqueMeta(
  document: HtmlNode,
  attribute: 'name' | 'property',
  value: string,
  file: string,
): string | null {
  const matches = metas(document, attribute, value);
  if (matches.length > 1) {
    throw new Error(`${file}: duplicate <meta ${attribute}=${JSON.stringify(value)}> tags are ambiguous.`);
  }
  if (matches.length === 0) return null;
  const content = attr(matches[0], 'content')?.trim() ?? '';
  if (!content) {
    throw new Error(`${file}: <meta ${attribute}=${JSON.stringify(value)}> requires non-empty content.`);
  }
  return content;
}

function absoluteHttpUrl(value: string, label: string, file: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${file}: ${label} must be an absolute http(s) URL.`);
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
    throw new Error(`${file}: ${label} must be an absolute http(s) URL.`);
  }
  return url;
}

function parsePage(source: string, file: string, route: string): ParsedPage {
  const document = parse(source, { sourceCodeLocationInfo: true }) as unknown as HtmlNode;
  const html = elements(document, 'html');
  const heads = elements(document, 'head');
  if (html.length !== 1 || heads.length !== 1) {
    throw new Error(`${file}: generated OG cards require exactly one <html> and one <head> element.`);
  }
  const head = heads[0];
  return { document, head, route, file };
}

function isBuiltInErrorRoute(route: string): boolean {
  return /(?:^|\/)(?:404|500)(?:\/|\.html)$/u.test(route);
}

function isRedirect(document: HtmlNode): boolean {
  return elements(document, 'meta').some(
    (node) => attr(node, 'http-equiv')?.trim().toLowerCase() === 'refresh',
  );
}

function isNoIndex(document: HtmlNode): boolean {
  return elements(document, 'meta').some((node) => {
    const name = attr(node, 'name')?.trim().toLowerCase();
    if (name !== 'robots' && name !== 'googlebot') return false;
    const directives = (attr(node, 'content') ?? '')
      .toLowerCase()
      .split(/[\s,]+/u);
    return directives.includes('noindex') || directives.includes('none');
  });
}

function existingAuthoredOgImage(document: HtmlNode, file: string): string | null {
  const value = contentOfUniqueMeta(document, 'property', 'og:image', file);
  if (value === null) return null;
  absoluteHttpUrl(value, 'og:image content', file);
  return value;
}

function uniqueMarker(document: HtmlNode, name: string, file: string): string | null {
  const values: string[] = [];
  walk(document, (node) => {
    const value = attr(node, name);
    if (value !== null) values.push(value.trim());
  });
  if (values.length > 1) {
    throw new Error(`${file}: duplicate ${name} identity markers are ambiguous.`);
  }
  if (values.length === 0) return null;
  if (!values[0]) throw new Error(`${file}: ${name} identity marker must not be empty.`);
  return values[0];
}

function pagefindIdentities(document: HtmlNode): { books: string[]; corpusSurface: boolean } {
  const books = new Set<string>();
  let corpusSurface = false;
  walk(document, (node) => {
    const filter = attr(node, 'data-pagefind-filter');
    if (filter === null) return;
    for (const token of filter.split(/[;,\s]+/u)) {
      if (token.startsWith('book:') && token.length > 5) books.add(token.slice(5));
      if (token === 'surface:corpus') corpusSurface = true;
    }
  });
  return { books: [...books].sort(), corpusSurface };
}

function resolvePageIdentity(
  document: HtmlNode,
  file: string,
  corpus: BookCorpus | null | undefined,
): PageIdentity {
  const markerBook = uniqueMarker(document, 'data-book-scaffold-book', file);
  const markerSurface = uniqueMarker(document, 'data-book-scaffold-surface', file);
  const fallback = pagefindIdentities(document);

  if (markerSurface !== null && markerSurface !== 'corpus') {
    throw new Error(`${file}: unknown data-book-scaffold-surface ${JSON.stringify(markerSurface)}.`);
  }
  if (fallback.books.length > 1) {
    throw new Error(`${file}: multiple Pagefind book identities are ambiguous.`);
  }
  const fallbackBook = fallback.books[0] ?? null;
  if (markerBook && fallbackBook && markerBook !== fallbackBook) {
    throw new Error(`${file}: book identity marker ${JSON.stringify(markerBook)} disagrees with Pagefind ${JSON.stringify(fallbackBook)}.`);
  }

  const bookId = markerBook ?? fallbackBook;
  const corpusSurface = markerSurface === 'corpus' || fallback.corpusSurface;
  if (bookId && corpusSurface) {
    throw new Error(`${file}: a page cannot carry both book and corpus-surface identity.`);
  }
  if (!corpus) {
    if (bookId || corpusSurface) {
      throw new Error(`${file}: corpus identity markers were rendered without a configured corpus.`);
    }
    return { book: null, surface: null };
  }
  if (!bookId) return { book: null, surface: corpusSurface ? 'corpus' : null };

  const book = corpus.books.find((candidate) => candidate.id === bookId) ?? null;
  if (!book) {
    throw new Error(
      `${file}: unknown rendered corpus book ${JSON.stringify(bookId)}; expected ${corpus.books.map(({ id }) => id).join(' | ')}.`,
    );
  }
  return { book, surface: null };
}

function uniqueTitle(document: HtmlNode, file: string): string | null {
  const ogTitle = contentOfUniqueMeta(document, 'property', 'og:title', file);
  if (ogTitle) return ogTitle;
  const titles = elements(document, 'title');
  if (titles.length > 1) throw new Error(`${file}: duplicate <title> elements are ambiguous.`);
  if (titles.length === 0) return null;
  const title = textContent(titles[0]).trim();
  if (!title) throw new Error(`${file}: <title> must not be empty.`);
  return title;
}

function pageDescription(document: HtmlNode, file: string): string | null {
  return (
    contentOfUniqueMeta(document, 'property', 'og:description', file) ??
    contentOfUniqueMeta(document, 'name', 'description', file)
  );
}

function canonicalUrl(document: HtmlNode, file: string): URL {
  const canonicals = elements(document, 'link').filter((node) =>
    (attr(node, 'rel') ?? '')
      .toLowerCase()
      .split(/\s+/u)
      .includes('canonical'),
  );
  if (canonicals.length !== 1) {
    throw new Error(`${file}: generated OG cards require exactly one rendered canonical link.`);
  }
  const href = attr(canonicals[0], 'href')?.trim() ?? '';
  return absoluteHttpUrl(href, 'canonical href', file);
}

/** Normalize whitespace and truncate by Unicode code point at a word boundary. */
function clampText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  const points = Array.from(normalized);
  if (points.length <= limit) return normalized;

  const budget = limit - 1;
  const prefix = points.slice(0, budget).join('');
  const boundary = prefix.lastIndexOf(' ');
  const wordSafe = boundary >= Math.floor(budget * 0.6)
    ? prefix.slice(0, boundary)
    : prefix;
  return `${wordSafe.replace(/[\s,.;:!?\-–—]+$/u, '')}…`;
}

function payloadForPage(
  page: ParsedPage,
  options: OgCardsIntegrationOptions,
  identity: PageIdentity,
): CardPayload {
  const rawTitle = uniqueTitle(page.document, page.file);
  if (!rawTitle) throw new Error(`${page.file}: generated OG cards require og:title or <title>.`);
  const canonical = canonicalUrl(page.document, page.file);
  const rawBookTitle = identity.book?.title ?? options.title ?? 'book-scaffold-astro';
  const rawDescription =
    pageDescription(page.document, page.file) ??
    identity.book?.description ??
    options.description ??
    '';

  return {
    templateVersion: TEMPLATE_VERSION,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    profile: options.profile,
    bookId: identity.book?.id ?? null,
    bookTitle: clampText(rawBookTitle, BOOK_TITLE_LIMIT),
    title: clampText(rawTitle, TITLE_LIMIT),
    description: clampText(rawDescription, DESCRIPTION_LIMIT),
    hostname: clampText(canonical.hostname.toLowerCase(), HOSTNAME_LIMIT),
  };
}

function stablePayloadJson(payload: CardPayload): string {
  // CardPayload is constructed in this exact property order. JSON is the hash
  // input so template changes remain explicit and reviewable.
  return JSON.stringify(payload);
}

function shortHash(payloadJson: string): string {
  return createHash('sha256').update(payloadJson, 'utf8').digest('hex').slice(0, 16);
}

function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function insertIntoHead(page: ParsedPage, source: string, tags: readonly string[]): string {
  if (tags.length === 0) return source;
  const insertionOffset = page.head.sourceCodeLocation?.endTag?.startOffset;
  if (insertionOffset === undefined) {
    throw new Error(`${page.file}: cannot locate </head> for OG metadata insertion.`);
  }
  const block = `${tags.map((tag) => `    ${tag}`).join('\n')}\n`;
  return `${source.slice(0, insertionOffset)}${block}${source.slice(insertionOffset)}`;
}

function ensureNoDuplicateImageMetadata(document: HtmlNode, file: string): void {
  for (const [attribute, value] of [
    ['property', 'og:image:width'],
    ['property', 'og:image:height'],
    ['property', 'og:image:type'],
    ['name', 'twitter:image'],
  ] as const) {
    const matches = metas(document, attribute, value);
    if (matches.length > 1) {
      throw new Error(`${file}: duplicate ${value} metadata is ambiguous.`);
    }
    if (matches.length === 1 && !(attr(matches[0], 'content') ?? '').trim()) {
      throw new Error(`${file}: ${value} metadata requires non-empty content.`);
    }
  }
}

function staticImageTags(page: ParsedPage, imageUrl: string): string[] {
  ensureNoDuplicateImageMetadata(page.document, page.file);
  const tags = [
    `<meta property="og:image" content="${htmlEscape(imageUrl)}">`,
  ];
  if (metas(page.document, 'name', 'twitter:image').length === 0) {
    tags.push(`<meta name="twitter:image" content="${htmlEscape(imageUrl)}">`);
  }
  return tags;
}

function generatedImageTags(page: ParsedPage, imageUrl: string): string[] {
  ensureNoDuplicateImageMetadata(page.document, page.file);
  const expected = [
    { attribute: 'property' as const, name: 'og:image:width', content: String(CARD_WIDTH) },
    { attribute: 'property' as const, name: 'og:image:height', content: String(CARD_HEIGHT) },
    { attribute: 'property' as const, name: 'og:image:type', content: 'image/png' },
    { attribute: 'name' as const, name: 'twitter:image', content: imageUrl },
  ];
  const tags = [`<meta property="og:image" content="${htmlEscape(imageUrl)}">`];

  for (const item of expected) {
    const matches = metas(page.document, item.attribute, item.name);
    if (matches.length === 1) {
      const actual = attr(matches[0], 'content')?.trim() ?? '';
      if (actual !== item.content) {
        throw new Error(
          `${page.file}: existing ${item.name}=${JSON.stringify(actual)} conflicts with generated value ${JSON.stringify(item.content)}.`,
        );
      }
      continue;
    }
    tags.push(
      `<meta ${item.attribute}="${item.name}" content="${htmlEscape(item.content)}">`,
    );
  }
  return tags;
}

function routeForHtml(outputDir: string, file: string): string {
  const local = relative(outputDir, file).split(sep).join('/');
  if (local === 'index.html') return '/';
  if (local.endsWith('/index.html')) return `/${local.slice(0, -'index.html'.length)}`;
  return `/${local}`;
}

async function htmlFiles(outputDir: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && extname(entry.name).toLowerCase() === '.html') files.push(target);
    }
  }
  await visit(outputDir);
  return files.sort((left, right) =>
    routeForHtml(outputDir, left).localeCompare(routeForHtml(outputDir, right), 'en'),
  );
}

function cardTree(payload: CardPayload, theme: Theme): Record<string, unknown> {
  const children: Record<string, unknown>[] = [
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: '#F7F5F0',
        },
        children: payload.bookTitle,
      },
    },
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          marginTop: 32,
          maxWidth: 1040,
          fontSize: payload.title.length > 70 ? 53 : 62,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: '-0.035em',
          color: '#FDFCF9',
        },
        children: payload.title,
      },
    },
  ];

  if (payload.description) {
    children.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          marginTop: 25,
          maxWidth: 1010,
          fontSize: 25,
          lineHeight: 1.35,
          color: '#E8E5DD',
        },
        children: payload.description,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
        fontSize: 20,
        lineHeight: 1,
        color: '#E8E5DD',
      },
      children: [
        {
          type: 'div',
          props: { style: { display: 'flex' }, children: payload.hostname },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#F7F5F0',
            },
            children: `BOOK SCAFFOLD · ${payload.profile.replaceAll('-', ' ')}`,
          },
        },
      ],
    },
  });

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        padding: '66px 72px 58px',
        borderTop: `14px solid ${theme.accent}`,
        backgroundColor: theme.background,
        color: '#FDFCF9',
        fontFamily: 'Inter',
      },
      children,
    },
  };
}

async function readFont(name: string): Promise<Buffer> {
  const candidates = [
    new URL(`../../assets/og-fonts/${name}`, import.meta.url),
    new URL(`../assets/og-fonts/${name}`, import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Cannot locate package-owned OG font asset ${name}.`);
}

async function renderCard(payload: CardPayload): Promise<Buffer> {
  const [{ default: satori }, { Resvg }, regular, bold] = await Promise.all([
    import('satori'),
    loadResvg(),
    readFont('Inter-Regular.ttf'),
    readFont('Inter-Bold.ttf'),
  ]);
  const svg = await satori(cardTree(payload, PROFILE_THEMES[payload.profile]), {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: 'Inter', data: regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: bold, weight: 700, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: CARD_WIDTH },
  }).render().asPng();
  return Buffer.from(png);
}

async function loadResvg(): Promise<typeof import('@resvg/resvg-js')> {
  try {
    return await import('@resvg/resvg-js');
  } catch (error) {
    throw new Error(
      'Generated OG cards could not load the @resvg/resvg-js platform binding. ' +
        'Reinstall dependencies for this platform without `--omit=optional` and rebuild.',
      { cause: error },
    );
  }
}

async function writeCollisionSafeImage(file: string, bytes: Buffer): Promise<void> {
  try {
    await access(file, fsConstants.F_OK);
  } catch {
    await writeFile(file, bytes, { flag: 'wx' });
    return;
  }
  const existing = await readFile(file);
  if (!existing.equals(bytes)) {
    throw new Error(`${file}: OG content hash collision produced different PNG bytes.`);
  }
}

async function pruneStaleCards(ogDir: string, expectedHashes: ReadonlySet<string>): Promise<number> {
  let entries;
  try {
    entries = await readdir(ogDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }

  let removed = 0;
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
  for (const entry of entries) {
    const match = /^([a-f\d]{16})\.png$/u.exec(entry.name);
    if (!entry.isFile() || !match || expectedHashes.has(match[1])) continue;
    await unlink(join(ogDir, entry.name));
    removed += 1;
  }
  return removed;
}

async function processBuild(
  outputDir: string,
  site: URL,
  base: string,
  options: OgCardsIntegrationOptions,
): Promise<{
  generated: number;
  reused: number;
  staticImages: number;
  skipped: number;
  pruned: number;
}> {
  const matchers = options.ogCards.exclude.map(exclusionMatcher);
  const generatedPlans: PlannedCard[] = [];
  const staticPlans: PlannedStaticImage[] = [];
  let skipped = 0;

  for (const file of await htmlFiles(outputDir)) {
    const route = routeForHtml(outputDir, file);
    if (isBuiltInErrorRoute(route) || matchers.some((matcher) => matcher.test(route))) {
      skipped += 1;
      continue;
    }

    const source = await readFile(file, 'utf8');
    const page = parsePage(source, file, route);
    if (isRedirect(page.document) || isNoIndex(page.document)) {
      skipped += 1;
      continue;
    }
    if (existingAuthoredOgImage(page.document, file)) {
      skipped += 1;
      continue;
    }

    const identity = resolvePageIdentity(page.document, file, options.corpus);
    const staticImage = identity.book?.image ?? options.staticOgImage;
    if (staticImage !== undefined) {
      staticPlans.push({
        page,
        source,
        imageUrl: resolveStaticImageUrl(staticImage, site, base),
      });
      continue;
    }

    const payload = payloadForPage(page, options, identity);
    const payloadJson = stablePayloadJson(payload);
    const hash = shortHash(payloadJson);
    generatedPlans.push({
      page,
      source,
      payload,
      payloadJson,
      hash,
      imageUrl: cardUrl(site, base, hash),
    });
  }

  // Catch a truncated SHA-256 collision before rendering or mutating output.
  const payloadByHash = new Map<string, string>();
  for (const plan of generatedPlans) {
    const previous = payloadByHash.get(plan.hash);
    if (previous !== undefined && previous !== plan.payloadJson) {
      throw new Error(`OG payload hash collision at ${plan.hash}; refusing to overwrite card output.`);
    }
    payloadByHash.set(plan.hash, plan.payloadJson);
  }

  const ogDir = join(outputDir, '_og');
  if (generatedPlans.length > 0) await mkdir(ogDir, { recursive: true });
  const rendered = new Map<string, Buffer>();
  let reused = 0;
  for (const plan of generatedPlans) {
    if (rendered.has(plan.hash)) {
      reused += 1;
      continue;
    }
    const bytes = await renderCard(plan.payload);
    if (bytes.length === 0) throw new Error(`${plan.page.file}: OG renderer returned an empty PNG.`);
    await writeCollisionSafeImage(join(ogDir, `${plan.hash}.png`), bytes);
    rendered.set(plan.hash, bytes);
  }
  const pruned = await pruneStaleCards(ogDir, new Set(generatedPlans.map(({ hash }) => hash)));

  // Patch after every requested image exists. Only append absent tags; parse5
  // is an inspector, never a serializer, so consumer HTML bytes stay stable.
  for (const plan of staticPlans) {
    const tags = staticImageTags(plan.page, plan.imageUrl);
    await writeFile(plan.page.file, insertIntoHead(plan.page, plan.source, tags), 'utf8');
  }
  for (const plan of generatedPlans) {
    const tags = generatedImageTags(plan.page, plan.imageUrl);
    await writeFile(plan.page.file, insertIntoHead(plan.page, plan.source, tags), 'utf8');
  }

  return {
    generated: rendered.size,
    reused,
    staticImages: staticPlans.length,
    skipped,
    pruned,
  };
}

/**
 * Create the last-in-chain Astro integration that patches fully rendered
 * static HTML and emits package-owned deterministic PNGs.
 */
export function createOgCardsIntegration(options: OgCardsIntegrationOptions): AstroIntegration {
  if (!options.ogCards?.enabled) {
    throw new Error('createOgCardsIntegration requires an enabled normalized ogCards config.');
  }

  let site: URL | null = null;
  let base = '/';
  let output: string | null = null;

  return {
    name: 'book-scaffold-og-cards',
    hooks: {
      'astro:config:done': ({ config }) => {
        output = config.output;
        base = normalizeBase(config.base);
        if (output !== 'static') {
          throw new Error(
            `Generated OG cards require Astro output "static" (received ${JSON.stringify(output)}).`,
          );
        }
        if (!config.site) {
          throw new Error('Generated OG cards require an absolute http(s) Astro site URL.');
        }
        site = new URL(config.site);
        if ((site.protocol !== 'http:' && site.protocol !== 'https:') || !site.hostname) {
          throw new Error('Generated OG cards require an absolute http(s) Astro site URL.');
        }
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (output !== 'static' || !site) {
          throw new Error(
            'Generated OG cards were not initialized with a supported static Astro site configuration.',
          );
        }
        const outputDir = fileURLToPath(dir);
        const info = await stat(outputDir);
        if (!info.isDirectory()) {
          throw new Error(`Generated OG card output is not a directory: ${outputDir}`);
        }
        const result = await processBuild(outputDir, site, base, options);
        logger.info(
          `OG cards: ${result.generated} generated, ${result.reused} reused, ` +
            `${result.staticImages} static-precedence, ${result.skipped} skipped, ` +
            `${result.pruned} stale pruned.`,
        );
      },
    },
  };
}
