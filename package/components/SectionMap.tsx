/**
 * SectionMap — Preact island driving the right-gutter "On this page" scrollspy
 * (#section-map).
 *
 * Architecture: a CONTROLLER over server-rendered nav links, not a renderer.
 * SectionMap.astro renders the <nav data-section-map-root> with one
 * `a[data-section-id="<slug>"]` per h2/h3 (so the nav is a real anchor list with
 * no JS — but on mobile/no-JS the collapsed ChapterTOC is the fallback and this
 * gutter nav is CSS-hidden below 64rem). This island receives only the pure
 * heading manifest (slug/depth/text), observes the matching heading ELEMENTS
 * (`#<slug>`) in the document via IntersectionObserver, computes the active slug
 * with the pure `pickActive`, and sets `aria-current="page"` + an `active` class
 * on the corresponding link (clearing the others). It NEVER injects markup, so
 * there's zero layout shift — only a class/attribute toggle on existing links.
 *
 * DOM contract with SectionMap.astro:
 *   [data-section-map-root]            the SSR <nav> wrapper (ancestor of this
 *                                      island's mount point)
 *   a[data-section-id="<slug>"]        one link per heading; gains/loses
 *                                      aria-current="page" + class "active"
 *   #<slug>                            the heading element in the article body
 *                                      (Astro's MDX slug) — observed, not owned
 *
 * Fail-loud (house invariant, like ExamRunner/Flashcards): a missing wrapper
 * throws. A heading id with no element in the document is skipped gracefully
 * (the TOC filter can include a heading Astro slugged differently / a deferred
 * section), BUT if NONE of the manifest's headings resolve to an element, that's
 * manifest/DOM drift and we throw rather than mount a silently dead nav.
 *
 * No animation → no prefers-reduced-motion handling needed (instant class
 * toggle). No canvas → no book:theme:change listener (CSS tokens recolor the
 * nav from [data-theme] automatically). Hydrated with `client:idle`.
 */
import { useEffect, useRef } from 'preact/hooks';
import { pickActive, type VisibleHeading } from '../src/lib/section-map';
import type { MarkdownHeading } from 'astro';

interface Props {
  /** TOC headings (tocHeadings output) — slug/depth/text only, serializable. */
  headings: MarkdownHeading[];
}

export default function SectionMap({ headings }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-section-map-root]');
    if (!root) {
      // Fail loud: a silently dead scrollspy (no active highlight, ever) is the
      // worst failure mode — surface it as an uncaught console error.
      throw new Error(
        'SectionMap: no [data-section-map-root] ancestor — mount the island inside ' +
          'the <nav> that contains its links (see the DOM contract in SectionMap.tsx).',
      );
    }

    // Resolve each manifest heading to its body element. CSS.escape: a slug with
    // an unusual char would otherwise break the selector and throw a DOMException
    // mid-observe (a frozen scrollspy).
    type Tracked = { slug: string; el: Element };
    const tracked: Tracked[] = [];
    for (const h of headings) {
      const el = document.getElementById(h.slug);
      if (el) tracked.push({ slug: h.slug, el });
      // else: skip gracefully — a filtered heading Astro slugged differently or
      // a section not in this document. The drift guard below catches a TOTAL miss.
    }
    if (tracked.length === 0) {
      // None resolved → manifest/DOM drift (mirror ExamRunner). A nav whose every
      // link points at a missing anchor must not pretend to work.
      throw new Error(
        `SectionMap: manifest/DOM drift — none of the ${headings.length} heading id(s) ` +
          `resolve to an element (#${headings.map((h) => h.slug).join(', #')}).`,
      );
    }
    // The last tracked heading in document order (bound here, where the length
    // guard above proves it exists — `at(-1)`'s type is still `Tracked | undefined`
    // under noUncheckedIndexedAccess, so narrow it once). Used by the
    // scrolled-to-bottom path to force the final section active.
    const lastTracked = tracked[tracked.length - 1] as Tracked;

    // Link lookup by slug (CSS.escape on every slug used in a selector).
    function linkFor(slug: string): HTMLElement | null {
      return root!.querySelector<HTMLElement>(
        `a[data-section-id="${CSS.escape(slug)}"]`,
      );
    }

    // Which tracked headings are currently intersecting; recompute reads `tracked`
    // (document order) and filters by membership so `visible` is document-ordered
    // too — pickActive's "ties resolve to document order" then actually holds.
    const inView = new Set<Element>();
    let active: string | null = null;

    // Set the active slug: clear the previous link, light the next one. Toggle
    // ONLY class/attr on existing SSR links → no layout shift. Shared by the
    // observer path (via recompute) and the scrolled-to-bottom path below.
    function setActive(next: string | null): void {
      if (next === active) return;
      if (active !== null) {
        const prevLink = linkFor(active);
        if (prevLink) {
          prevLink.classList.remove('active');
          prevLink.removeAttribute('aria-current');
        }
      }
      if (next !== null) {
        const nextLink = linkFor(next);
        if (nextLink) {
          nextLink.classList.add('active');
          nextLink.setAttribute('aria-current', 'page');
        }
      }
      active = next;
    }

    function recompute(): void {
      // Iterate `tracked` (document order) filtering by inView — NOT the Set
      // (insertion order) — so equal-top ties resolve to document order.
      const visible: VisibleHeading[] = [];
      for (const t of tracked) {
        if (inView.has(t.el)) {
          visible.push({ slug: t.slug, top: t.el.getBoundingClientRect().top });
        }
      }
      setActive(pickActive(visible, active));
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inView.add(entry.target);
          else inView.delete(entry.target);
        }
        recompute();
      },
      // A negative bottom margin biases "active" toward the heading nearest the
      // top of the viewport (the section you're reading INTO), not the last one
      // peeking in at the bottom.
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    for (const t of tracked) observer.observe(t.el);

    // Last-section reachability: the -70% bottom margin confines "active" to the
    // top 30% of the viewport, so a final heading with little content below it
    // can never scroll INTO that zone — it would never light. When the page is
    // scrolled to the bottom, force the LAST tracked heading active so the foot
    // of the chapter always highlights its own section. Passive listeners (no
    // preventDefault) keep scrolling smooth.
    function onScroll(): void {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) setActive(lastTracked.slug);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  // A zero-footprint anchor: the island renders only this <span> so it can find
  // [data-section-map-root] via closest(); all visible nav links are SSR'd by
  // SectionMap.astro. No markup injected → no layout shift.
  return <span ref={ref} class="section-map-mount" hidden aria-hidden="true" />;
}
