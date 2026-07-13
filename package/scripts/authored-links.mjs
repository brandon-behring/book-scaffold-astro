/**
 * Structural authored-link discovery for `book-scaffold validate` (#190).
 *
 * Markdown and MDX are parsed into their real syntax trees so code examples,
 * comments, nested labels, JSX expressions, and literal decoding follow the
 * same grammar as the rendered book. Raw HTML is parsed only from ranges that
 * the Markdown AST identified as HTML. This module never rewrites content.
 */
import { parseFragment } from 'parse5';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const ORIGIN = 'https://book-scaffold.invalid';
const processors = new Map();

/** Normalize the portion of Astro's `base` relevant to containment checks. */
export function normalizeAstroBase(base = '/') {
  const value = typeof base === 'string' && base.length > 0 ? base : '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  const pathname = new URL(withLeadingSlash, ORIGIN).pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Parse a browser-rooted same-origin target. A single leading backslash is
 * included because WHATWG HTTP URL parsing treats it as a root slash. True
 * protocol-relative URLs and inputs that resolve onto another host are not
 * internal authored targets.
 */
function rootTargetUrl(target) {
  if (typeof target !== 'string') return null;
  const value = target.trim();
  if (!value.startsWith('/') && !value.startsWith('\\')) return null;
  if (value.startsWith('//') || value.startsWith('\\\\')) return null;

  try {
    const url = new URL(value, ORIGIN);
    return url.origin === ORIGIN ? url : null;
  } catch {
    return null;
  }
}

/** Browser-normalized pathname for a same-origin root target, else null. */
export function rootTargetPathname(target) {
  const url = rootTargetUrl(target);
  return url ? url.pathname.replace(/\/+$/, '') || '/' : null;
}

/**
 * True only for a same-origin root target outside `base`.
 * Protocols, protocol-relative URLs, fragments, relative URLs, and targets
 * already under the configured base all return false.
 */
export function rootTargetEscapesBase(target, base) {
  const normalizedBase = normalizeAstroBase(base);
  if (normalizedBase === '/') return false;

  const pathname = rootTargetPathname(target);
  if (pathname === null) return false;
  return pathname !== normalizedBase && !pathname.startsWith(`${normalizedBase}/`);
}

/**
 * Return a browser-normalized, base-contained suggestion for a violating
 * target. Normalizing before prefixing prevents `..` (including percent-
 * encoded dot segments) from escaping the base a second time.
 */
export function suggestBaseContainedTarget(target, base) {
  const normalizedBase = normalizeAstroBase(base);
  const url = rootTargetUrl(target);
  if (!url) return target;
  const prefix = normalizedBase === '/' ? '' : normalizedBase;
  return `${prefix}${url.pathname}${url.search}${url.hash}`;
}

function blankFrontmatter(content) {
  return content.replace(
    /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/,
    (match) => match.replace(/[^\r\n]/g, ' '),
  );
}

function processorFor(format) {
  if (!processors.has(format)) {
    const processor = unified().use(remarkParse);
    if (format === 'mdx') processor.use(remarkMdx);
    processors.set(format, processor);
  }
  return processors.get(format);
}

function positionStart(node) {
  return node?.position?.start?.offset ?? 0;
}

function attributeValueOffset(source, start, end) {
  const attribute = source.slice(start, end);
  const equals = attribute.indexOf('=');
  if (equals < 0) return start;

  let offset = equals + 1;
  while (/\s/.test(attribute[offset] ?? '')) offset += 1;
  if (attribute[offset] === '"' || attribute[offset] === "'") offset += 1;
  return start + offset;
}

function markdownDestinationOffset(node, source) {
  const start = positionStart(node);
  const end = node?.position?.end?.offset ?? start;
  const authored = source.slice(start, end);
  const marker = node.type === 'definition' ? authored.lastIndexOf(']:') : authored.lastIndexOf('](');
  if (marker < 0) return start;

  let offset = marker + 2;
  while (/\s/.test(authored[offset] ?? '')) offset += 1;
  if (authored[offset] === '<') offset += 1;
  return start + offset;
}

function literalMdxAttribute(attribute, source) {
  if (typeof attribute.value === 'string') {
    return {
      target: attribute.value,
      index: attributeValueOffset(
        source,
        positionStart(attribute),
        attribute.position?.end?.offset ?? positionStart(attribute),
      ),
    };
  }

  if (attribute.value?.type !== 'mdxJsxAttributeValueExpression') return null;
  const program = attribute.value.data?.estree;
  if (program?.body?.length !== 1 || program.body[0]?.type !== 'ExpressionStatement') return null;
  const expression = program.body[0].expression;

  if (expression?.type === 'Literal' && typeof expression.value === 'string') {
    return { target: expression.value, index: expression.start ?? positionStart(attribute) };
  }
  if (
    expression?.type === 'TemplateLiteral' &&
    expression.expressions?.length === 0 &&
    expression.quasis?.length === 1 &&
    typeof expression.quasis[0].value?.cooked === 'string'
  ) {
    return {
      target: expression.quasis[0].value.cooked,
      index: expression.quasis[0].start ?? expression.start ?? positionStart(attribute),
    };
  }
  return null;
}

/**
 * Resolve one JSX prop in source order. A later explicit literal overrides an
 * earlier spread, while a later spread or dynamic expression makes the final
 * runtime value unknowable. This mirrors JSX object-spread semantics.
 */
function literalMdxProp(element, name, source) {
  let result = null;
  for (const attribute of element.attributes ?? []) {
    if (attribute.type === 'mdxJsxExpressionAttribute') {
      result = null;
      continue;
    }
    if (
      attribute.type !== 'mdxJsxAttribute' ||
      typeof attribute.name !== 'string' ||
      attribute.name.toLowerCase() !== name
    ) {
      continue;
    }
    result = literalMdxAttribute(attribute, source);
  }
  return result;
}

function htmlSourceFromRanges(source, ranges) {
  const chars = new Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    chars[i] = source[i] === '\n' || source[i] === '\r' ? source[i] : ' ';
  }
  for (const [start, end] of ranges) {
    for (let i = start; i < end; i += 1) chars[i] = source[i];
  }
  return chars.join('');
}

function collectParsedHtmlTargets(source, ranges, add) {
  if (ranges.length === 0) return;
  const htmlSource = htmlSourceFromRanges(source, ranges);
  const tree = parseFragment(htmlSource, { sourceCodeLocationInfo: true });

  const visit = (node, insideCode = false) => {
    const tagName = typeof node.tagName === 'string' ? node.tagName.toLowerCase() : null;
    const inCodeContainer = insideCode || tagName === 'pre' || tagName === 'code';

    if (tagName && !inCodeContainer) {
      for (const attribute of node.attrs ?? []) {
        const name = attribute.name.toLowerCase();
        if (name !== 'href' && name !== 'src') continue;
        const location = node.sourceCodeLocation?.attrs?.[attribute.name];
        const start = location?.startOffset ?? node.sourceCodeLocation?.startOffset ?? 0;
        const end = location?.endOffset ?? start;
        add(attribute.value, attributeValueOffset(source, start, end), `${name} attribute`);
      }
    }

    for (const child of node.childNodes ?? []) visit(child, inCodeContainer);
    if (node.content) visit(node.content, inCodeContainer);
  };

  visit(tree);
}

function formatFrom(options) {
  const format = typeof options === 'string' ? options : options?.format ?? 'mdx';
  if (format !== 'md' && format !== 'mdx') {
    throw new TypeError(`authored link parser format must be "md" or "mdx" (got ${JSON.stringify(format)})`);
  }
  return format;
}

/**
 * Return every statically knowable authored Markdown/HTML/MDX href/src target.
 * Result indices use the original source's UTF-16 offsets and are intended for
 * file/line diagnostics; decoded targets need not occur verbatim at that index.
 */
export function findAuthoredTargets(content, options = {}) {
  if (typeof content !== 'string') throw new TypeError('authored link content must be a string');
  const format = formatFrom(options);
  const source = blankFrontmatter(content);
  const tree = processorFor(format).parse(source);
  const targets = [];
  const seen = new Set();
  const rawHtmlRanges = [];
  const referencedIdentifiers = new Set();
  const definitions = new Map();

  const add = (target, index, kind) => {
    if (typeof target !== 'string') return;
    const value = target.trim();
    const key = `${index}:${kind}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ target: value, index, kind });
  };

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'link' || node.type === 'image') {
      const kind = node.type === 'image' ? 'Markdown image destination' : 'Markdown link destination';
      add(node.url, markdownDestinationOffset(node, source), kind);
    }

    if (
      (node.type === 'linkReference' || node.type === 'imageReference') &&
      typeof node.identifier === 'string'
    ) {
      referencedIdentifiers.add(node.identifier);
    }

    if (node.type === 'definition' && typeof node.identifier === 'string') {
      // CommonMark resolves duplicate labels to the first definition.
      if (!definitions.has(node.identifier)) definitions.set(node.identifier, node);
    }

    if (node.type === 'html') {
      const start = positionStart(node);
      rawHtmlRanges.push([start, node.position?.end?.offset ?? start]);
      return;
    }

    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const name = typeof node.name === 'string' ? node.name : '';
      if (name === 'pre' || name === 'code') return;
      for (const attributeName of ['href', 'src']) {
        const literal = literalMdxProp(node, attributeName, source);
        if (literal) add(literal.target, literal.index, `${attributeName} attribute`);
      }
    }

    // Code nodes contain source text but no rendered links. MDX expressions and
    // ESM nodes are also opaque unless they are a parsed JSX attribute above.
    if (
      node.type === 'code' ||
      node.type === 'inlineCode' ||
      node.type === 'mdxFlowExpression' ||
      node.type === 'mdxTextExpression' ||
      node.type === 'mdxjsEsm'
    ) {
      return;
    }

    for (const child of node.children ?? []) visit(child);
  };

  visit(tree);
  for (const identifier of referencedIdentifiers) {
    const definition = definitions.get(identifier);
    if (definition) {
      add(
        definition.url,
        markdownDestinationOffset(definition, source),
        'Markdown reference destination',
      );
    }
  }
  if (format === 'md') collectParsedHtmlTargets(source, rawHtmlRanges, add);
  return targets.sort((a, b) => a.index - b.index);
}

/** Find only literal targets that browser-resolve outside `base`. */
export function findEscapingAuthoredTargets(content, base, options = {}) {
  if (normalizeAstroBase(base) === '/') return [];
  return findAuthoredTargets(content, options).filter(({ target }) =>
    rootTargetEscapesBase(target, base),
  );
}
