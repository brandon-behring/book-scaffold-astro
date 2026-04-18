/**
 * VersionSelector — Preact island for the version dropdown.
 *
 * Stage 0: stub data. The real version list arrives in Stage 3 when
 * multi-version CI deploys exist; the component is wired now to prove
 * the islands architecture works with hydration, state, and event
 * handlers.
 *
 * Hydrated with `client:idle` from Base.astro — won't run until the
 * main thread is idle, keeping initial paint fast.
 *
 * Stage 3 will replace the STUB_VERSIONS constant with a runtime fetch
 * or a build-time-injected prop that lists all deployed versions.
 */
import { useState, useRef, useEffect } from 'preact/hooks';

type VersionEntry = {
  id: string;        // URL subpath segment ('' for latest)
  label: string;     // display label
  date: string;      // release date
  current: boolean;  // mark the version being viewed
};

// Stub data for Stage 0. Stage 3 will inject the real list.
const STUB_VERSIONS: VersionEntry[] = [
  { id: '',     label: 'Latest (main)', date: '2026-04-17', current: true },
  { id: 'v1.0', label: 'v1.0',          date: '2026-05-01', current: false },
];

export default function VersionSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = STUB_VERSIONS.find((v) => v.current) || STUB_VERSIONS[0];

  return (
    <div class="version-selector" ref={ref}>
      <button
        type="button"
        class="chrome-button version-selector-trigger"
        aria-label="Select book version"
        title={`Current: ${current.label} (${current.date})`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">v</span>
      </button>
      {open && (
        <ul class="version-selector-menu" role="listbox">
          {STUB_VERSIONS.map((v) => (
            <li role="option" aria-selected={v.current}>
              <a
                href={v.id ? `/${v.id}/` : '/'}
                class={v.current ? 'version-current' : ''}
              >
                <span class="version-label">{v.label}</span>
                <span class="version-date">{v.date}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
