/**
 * ToolFilter — Preact island for per-tool chapter filtering.
 *
 * Renders a filter button in the chrome row that opens a chip panel.
 * Each chip toggles one tool slug in the active filter set. Empty set
 * means "show all". The selection persists to localStorage and is
 * announced via CustomEvent so non-hydrated pages (e.g., /chapters/)
 * can react without a hydration cost of their own.
 *
 * Hydrated with `client:idle` from Base.astro. Keeps initial paint fast.
 *
 * Event contract (commit 2 emits; commit 3 adds a consumer on
 * /chapters/):
 *   event name:   "book:tool-filter:change"
 *   event detail: { selected: string[] }   // tool slugs, may be empty
 *
 * Note: 'cross-tool' is intentionally not a chip. Chapters tagged as
 * cross-tool should remain visible under any filter selection; the
 * consumer script handles that rule.
 */
import { useState, useRef, useEffect } from 'preact/hooks';

const STORAGE_KEY = 'book:tool-filter';
const EVENT_NAME = 'book:tool-filter:change';

// Filter chips. 'cross-tool' is omitted on purpose (see module doc).
const FILTERABLE_TOOLS = ['claude-code', 'gemini-cli', 'codex-cli'] as const;
type FilterableTool = (typeof FILTERABLE_TOOLS)[number];

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

function writeSaved(selected: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    /* localStorage unavailable — keep in-memory state only */
  }
}

function announce(selected: string[]): void {
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { selected } }),
  );
}

export default function ToolFilter() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount, then announce so consumers
  // apply the persisted filter immediately after hydration.
  useEffect(() => {
    const saved = readSaved();
    setSelected(saved);
    announce(saved);
  }, []);

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

  function toggle(tool: FilterableTool): void {
    const next = selected.includes(tool)
      ? selected.filter((s) => s !== tool)
      : [...selected, tool];
    setSelected(next);
    writeSaved(next);
    announce(next);
  }

  function clearAll(): void {
    setSelected([]);
    writeSaved([]);
    announce([]);
  }

  const activeCount = selected.length;
  const buttonLabel =
    activeCount === 0
      ? 'Filter chapters by tool (showing all)'
      : `Filter chapters by tool (${activeCount} active)`;

  return (
    <div class="tool-filter" ref={ref}>
      <button
        type="button"
        class="chrome-button tool-filter-trigger"
        aria-label={buttonLabel}
        title={buttonLabel}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⚐</span>
        {activeCount > 0 && (
          <span class="tool-filter-count" aria-hidden="true">{activeCount}</span>
        )}
      </button>
      {open && (
        <div class="tool-filter-panel" role="group" aria-label="Tool filters">
          <p class="tool-filter-heading">Show chapters for</p>
          <ul class="tool-filter-chips">
            {FILTERABLE_TOOLS.map((tool) => {
              const on = selected.includes(tool);
              return (
                <li>
                  <button
                    type="button"
                    class={`tool-filter-chip${on ? ' tool-filter-chip-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggle(tool)}
                  >
                    {tool}
                  </button>
                </li>
              );
            })}
          </ul>
          <div class="tool-filter-footer">
            <button
              type="button"
              class="tool-filter-clear"
              onClick={clearAll}
              disabled={activeCount === 0}
            >Clear</button>
            <span class="tool-filter-note">
              Cross-tool chapters stay visible under any filter.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
