/** Semantic metric-card list for interactive teaching figures (#143). */

export const STAT_CARD_TONES = ['neutral', 'accent', 'positive', 'warning'] as const;
export type StatCardTone = (typeof STAT_CARD_TONES)[number];

export interface StatCardItem {
  /** Optional stable key. Defaults to the label, which must then be unique. */
  id?: string;
  label: string;
  value: string | number;
  /** Optional unit rendered beside the primary value. */
  unit?: string;
  /** Secondary explanatory line. */
  detail?: string;
  tone?: StatCardTone;
}

export interface StatCardsProps {
  items: readonly StatCardItem[];
  /** Accessible name for the definition list. */
  label?: string;
  /** Opt-in announcements for values that change independently of a control. */
  live?: 'off' | 'polite';
  className?: string;
}

function assertText(value: string, path: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`StatCards: ${path} must be a non-empty string.`);
  }
}

function assertItems(items: readonly StatCardItem[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('StatCards: items must contain at least one statistic.');
  }
  const keys = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (item === null || typeof item !== 'object') {
      throw new Error(`StatCards: items[${index}] must be a statistic object.`);
    }
    assertText(item.label, `items[${index}].label`);
    if (typeof item.value !== 'string' && typeof item.value !== 'number') {
      throw new Error(`StatCards: items[${index}].value must be a string or number.`);
    }
    if (typeof item.value === 'number' && !Number.isFinite(item.value)) {
      throw new Error(`StatCards: items[${index}].value must be finite.`);
    }
    if (typeof item.value === 'string') assertText(item.value, `items[${index}].value`);
    if (item.unit !== undefined) assertText(item.unit, `items[${index}].unit`);
    if (item.detail !== undefined) assertText(item.detail, `items[${index}].detail`);
    const tone = item.tone ?? 'neutral';
    if (!(STAT_CARD_TONES as readonly string[]).includes(tone)) {
      throw new Error(
        `StatCards: items[${index}].tone must be one of ${STAT_CARD_TONES.join(' | ')}.`,
      );
    }
    const key = item.id ?? item.label;
    assertText(key, `items[${index}].id`);
    if (keys.has(key)) throw new Error(`StatCards: duplicate item key "${key}".`);
    keys.add(key);
  }
}

export function StatCards({
  items,
  label = 'Key statistics',
  live = 'off',
  className,
}: StatCardsProps) {
  assertItems(items);
  assertText(label, 'label');
  if (live !== 'off' && live !== 'polite') {
    throw new Error('StatCards: live must be off | polite.');
  }
  const classes = ['demo-stat-cards', className].filter(Boolean).join(' ');

  return (
    <dl
      class={classes}
      aria-label={label}
      aria-live={live}
      aria-atomic={live === 'polite' || undefined}
    >
      {items.map((item) => {
        const tone = item.tone ?? 'neutral';
        return (
          <div class="demo-stat-card" data-tone={tone} key={item.id ?? item.label}>
            <dt class="demo-stat-card__label">{item.label}</dt>
            <dd class="demo-stat-card__value">
              {item.value}
              {item.unit && <> <span class="demo-stat-card__unit">{item.unit}</span></>}
            </dd>
            {item.detail && <dd class="demo-stat-card__detail">{item.detail}</dd>}
          </div>
        );
      })}
    </dl>
  );
}
