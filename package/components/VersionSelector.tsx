/**
 * VersionSelector — Preact island for the version dropdown.
 *
 * Multi-version deployment is owned by the consuming book, so this component
 * accepts its complete version manifest as a prop. It is a manual opt-in and
 * is not mounted by Base.astro. With no manifest it renders nothing rather
 * than presenting package-owned placeholder releases as real navigation.
 */
import { useState, useRef, useEffect } from 'preact/hooks';

export interface VersionEntry {
  /** Resolved destination for this deployed version. */
  href: string;
  /** Human-readable release label, for example `v4.27`. */
  label: string;
  /** Human-readable release date. */
  date: string;
  /** Marks the version represented by the current page. */
  current?: boolean;
}

export interface VersionSelectorProps {
  /** Consumer-owned deployed-version manifest. Empty/omitted renders nothing. */
  versions?: readonly VersionEntry[];
}

export default function VersionSelector({ versions = [] }: VersionSelectorProps) {
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

  if (versions.length === 0) return null;

  // If the consumer omits `current`, present the first supplied release as
  // the current label. The non-empty guard above makes the fallback defined.
  const current = versions.find((version) => version.current) ?? versions[0]!;

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
          {versions.map((version) => {
            const isCurrent = version === current;
            return (
              <li key={version.href} role="option" aria-selected={isCurrent}>
                <a
                  href={version.href}
                  class={isCurrent ? 'version-current' : ''}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  <span class="version-label">{version.label}</span>
                  <span class="version-date">{version.date}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
