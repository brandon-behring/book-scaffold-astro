import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  findAuthoredTargets,
  findEscapingAuthoredTargets,
  normalizeAstroBase,
  rootTargetEscapesBase,
  rootTargetPathname,
  suggestBaseContainedTarget,
} from '../scripts/authored-links.mjs';

const BASE = '/library/books/';

test('#190: Astro base containment and suggestions follow browser path semantics', () => {
  assert.equal(normalizeAstroBase(), '/');
  assert.equal(normalizeAstroBase('library/books/'), '/library/books');
  assert.equal(normalizeAstroBase('/library/books///'), '/library/books');

  assert.equal(rootTargetEscapesBase('/chapters/one/', BASE), true);
  assert.equal(rootTargetEscapesBase('/', BASE), true);
  assert.equal(rootTargetEscapesBase('/library/books', BASE), false);
  assert.equal(rootTargetEscapesBase('/library/books/chapters/one/', BASE), false);
  assert.equal(rootTargetEscapesBase('/library/bookshelf/', BASE), true);
  assert.equal(rootTargetEscapesBase('/library/books/../outside/', BASE), true);
  assert.equal(rootTargetEscapesBase('\\outside/path', BASE), true, 'WHATWG treats one backslash as root');
  assert.equal(rootTargetEscapesBase('/\\outside/path', BASE), false, 'different host is external');

  for (const excluded of [
    'chapters/one/',
    '../chapters/one/',
    '#section',
    'https://example.com/chapters/one/',
    'mailto:editor@example.com',
    'data:image/svg+xml;base64,abc',
    '//cdn.example.com/image.png',
  ]) {
    assert.equal(rootTargetEscapesBase(excluded, BASE), false, excluded);
  }
  assert.equal(rootTargetEscapesBase('/chapters/one/', '/'), false);
  assert.equal(rootTargetPathname('/foo/../outside/?q=1#part'), '/outside');

  for (const target of ['/../outside/', '/../../outside/', '/%2e%2e/outside/?q=1#part']) {
    const suggestion = suggestBaseContainedTarget(target, BASE);
    assert.equal(rootTargetEscapesBase(suggestion, BASE), false, suggestion);
  }
  assert.equal(
    suggestBaseContainedTarget('/%2e%2e/outside/?q=1#part', BASE),
    '/library/books/outside/?q=1#part',
  );
});

test('#190: structural Markdown parsing covers nested prose, decoded HTML, and exact destinations', () => {
  const content = `\uFEFF---
example: '<a href="/frontmatter">'
---
Unicode before target: π.
[nested [label]](/chapters/one/#start)
![diagram](</figures/diagram.svg> "Diagram")
[reference][docs]

[docs]: /references/#entry
[balanced](/foo_(bar))
- list item

    [list prose](/chapters/list-item/)
<a title="2 > 1" href="&#47;search/">Search</a>
<img src=/raw-image alt=Raw>
<a href="/corporate/" rel="external noopener">Still host-root</a>
`;

  const violations = findEscapingAuthoredTargets(content, BASE, { format: 'md' });
  assert.deepEqual(
    violations.map(({ target, kind }) => ({ target, kind })),
    [
      { target: '/chapters/one/#start', kind: 'Markdown link destination' },
      { target: '/figures/diagram.svg', kind: 'Markdown image destination' },
      { target: '/references/#entry', kind: 'Markdown reference destination' },
      { target: '/foo_(bar)', kind: 'Markdown link destination' },
      { target: '/chapters/list-item/', kind: 'Markdown link destination' },
      { target: '/search/', kind: 'href attribute' },
      { target: '/raw-image', kind: 'src attribute' },
      { target: '/corporate/', kind: 'href attribute' },
    ],
  );

  for (const violation of violations.filter(({ target }) => content.includes(target))) {
    assert.equal(content.slice(violation.index, violation.index + violation.target.length), violation.target);
  }
});

test('#190: Markdown references follow first-definition-wins renderer semantics', () => {
  const content = `[full][MiXeD   Target]
[collapsed][]
[shortcut]
[full again][mixed target]
![image full][IMAGE]
![collapsed image][]
![image shortcut]

[mixed target]: /first-definition/
[MIXED   TARGET]: /ignored-duplicate/
[collapsed]: /collapsed/
[shortcut]: /shortcut/
[image]: /image/
[collapsed image]: /collapsed-image/
[image shortcut]: /shortcut-image/
[unused]: /unused/
`;

  const violations = findEscapingAuthoredTargets(content, BASE, { format: 'md' });
  assert.deepEqual(
    violations.map(({ target, kind }) => ({ target, kind })),
    [
      { target: '/first-definition/', kind: 'Markdown reference destination' },
      { target: '/collapsed/', kind: 'Markdown reference destination' },
      { target: '/shortcut/', kind: 'Markdown reference destination' },
      { target: '/image/', kind: 'Markdown reference destination' },
      { target: '/collapsed-image/', kind: 'Markdown reference destination' },
      { target: '/shortcut-image/', kind: 'Markdown reference destination' },
    ],
  );
  assert.ok(!violations.some(({ target }) => target === '/ignored-duplicate/'));
  assert.ok(!violations.some(({ target }) => target === '/unused/'));
  for (const violation of violations) {
    assert.equal(content.slice(violation.index, violation.index + violation.target.length), violation.target);
  }
});

test('#190: structural MDX parsing handles real attributes and evaluated static literals', () => {
  const content = `---
example: '<a href="/frontmatter">'
---
<Card disabled={count > 1} href="/comparison/" />
<Card title="2 > 1" src="/quoted-greater/" />
<Card note={'href="/not-an-attribute"'} />
<a data-note='rel="external"' href="/rel-text/">Text</a>
<a rel="external noopener" href="/rel-external/">Still host-root</a>
<a href="&#47;entity/">Entity</a>
<Card href={'\\u002Fescaped/'} />
<Card href={\`\\x2Ftemplate/\`} />
<Card href={('/parenthesized/')} />
<Card href={'/commented-literal/' /* static */} />
<Card href={computedHref} src={\`\${base}/dynamic.png\`} />
<Card href="/overridden-by-spread/" {...props} />
<Card {...props} href="/after-spread/" />
`;

  const violations = findEscapingAuthoredTargets(content, BASE, { format: 'mdx' });
  assert.deepEqual(
    violations.map(({ target, kind }) => ({ target, kind })),
    [
      { target: '/comparison/', kind: 'href attribute' },
      { target: '/quoted-greater/', kind: 'src attribute' },
      { target: '/rel-text/', kind: 'href attribute' },
      { target: '/rel-external/', kind: 'href attribute' },
      { target: '/entity/', kind: 'href attribute' },
      { target: '/escaped/', kind: 'href attribute' },
      { target: '/template/', kind: 'href attribute' },
      { target: '/parenthesized/', kind: 'href attribute' },
      { target: '/commented-literal/', kind: 'href attribute' },
      { target: '/after-spread/', kind: 'href attribute' },
    ],
  );
  assert.ok(!violations.some(({ target }) => target.includes('not-an-attribute')));
});

test('#190: AST boundaries exclude comments and every rendered code-example form', () => {
  const markdown = `---
example: '[frontmatter](/frontmatter)'
---
<!-- <a href="/commented">commented</a> -->

\`[inline example](/inline-code)\`
\`code starts
<a href="/multiline-inline-code">example</a>\`

\`\`\`md
[fenced](/fenced)
<a href="/fenced-html">example</a>
\`\`\`

text <code><a href="/inline-code-tag">example</a></code> end
<pre>
<a href="/preformatted">example</a>
</pre>
    [indented](/indented-code)
`;
  assert.deepEqual(findEscapingAuthoredTargets(markdown, BASE, { format: 'md' }), []);

  const mdx = `---
example: '<Card href="/frontmatter" />'
---
{/* <Card href="/mdx-comment" /> */}
\`<a href="/inline-html">example</a>\`
\`\`\`mdx
<Card href="/fenced-jsx" />
\`\`\`
<pre><a href="/preformatted">example</a></pre>
<code><img src="/code-example.png" /></code>
<Card href={computedHref} src={\`\${base}/dynamic.png\`} />
`;
  assert.deepEqual(findEscapingAuthoredTargets(mdx, BASE, { format: 'mdx' }), []);
});

test('#190: root-base validation is inert before parsing malformed MDX', () => {
  const malformedMdx = '<!-- HTML comments are not valid MDX -->';
  assert.throws(() => findAuthoredTargets(malformedMdx, { format: 'mdx' }), /Unexpected character/);
  assert.deepEqual(findEscapingAuthoredTargets(malformedMdx, '/', { format: 'mdx' }), []);
});
