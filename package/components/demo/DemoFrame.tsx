/**
 * DemoFrame — accessible shell for a consumer-owned interactive teaching
 * figure (#143).
 *
 * The scaffold owns only the stable chrome: figure semantics, an explicit
 * accessible name/description, a body region, and an optional caption. The
 * consumer still owns the visualization, data, and interaction model.
 */
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

export interface DemoFrameProps {
  /** Visible accessible name for the teaching figure. */
  title: string;
  /** Short explanation rendered directly below the title. */
  description?: string;
  /** Figure caption rendered after the interactive body. */
  caption?: ComponentChildren;
  /** Consumer-owned controls and visualization. */
  children?: ComponentChildren;
  /** Optional stable root id for deep links and deterministic child ids. */
  id?: string;
  /** Additional class on the root figure. */
  className?: string;
  /** Reflect a consumer-owned recomputation/loading state to assistive tech. */
  busy?: boolean;
}

function assertNonEmpty(value: string, prop: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`DemoFrame: ${prop} must be a non-empty string.`);
  }
}

function generatedBaseId(id: string | undefined, generated: string): string {
  if (id !== undefined) {
    assertNonEmpty(id, 'id');
    if (/\s/.test(id)) {
      throw new Error('DemoFrame: id must not contain whitespace.');
    }
    return id;
  }
  return `demo-${generated.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function DemoFrame({
  title,
  description,
  caption,
  children,
  id,
  className,
  busy = false,
}: DemoFrameProps) {
  assertNonEmpty(title, 'title');
  if (description !== undefined) assertNonEmpty(description, 'description');
  if (typeof caption === 'string') assertNonEmpty(caption, 'caption');

  const baseId = generatedBaseId(id, useId());
  const titleId = `${baseId}-title`;
  const descriptionId = description ? `${baseId}-description` : null;
  const captionId = caption != null ? `${baseId}-caption` : null;
  const describedBy = [descriptionId, captionId].filter(Boolean).join(' ') || undefined;
  const classes = ['demo-frame', className].filter(Boolean).join(' ');

  return (
    <figure
      id={id}
      class={classes}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
    >
      <header class="demo-frame__header">
        <h3 id={titleId} class="demo-frame__title">{title}</h3>
        {description && (
          <p id={descriptionId!} class="demo-frame__description">{description}</p>
        )}
      </header>
      <div class="demo-frame__body">{children}</div>
      {caption != null && (
        <figcaption id={captionId!} class="demo-frame__caption">{caption}</figcaption>
      )}
    </figure>
  );
}
