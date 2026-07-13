/** Controlled, visibly-labelled range input for interactive demos (#143). */
import { useId } from 'preact/hooks';

export interface SliderProps {
  /** Visible label associated with the native range input. */
  label: string;
  /** Controlled numeric value. */
  value: number;
  min: number;
  max: number;
  /** Positive increment. Defaults to the native range-input step of 1. */
  step?: number;
  /** Receives the parsed numeric value for every native input event. */
  onValueChange: (value: number) => void;
  /** Optional stable input id. A hydration-stable id is generated otherwise. */
  id?: string;
  name?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Formats the visible current-value output. */
  formatValue?: (value: number) => string;
  /** Optional spoken value text when the visible format is not descriptive. */
  getValueText?: (value: number) => string;
}

function assertFinite(value: number, prop: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Slider: ${prop} must be a finite number.`);
  }
}

function assertSliderProps({
  label,
  value,
  min,
  max,
  step = 1,
  id,
  description,
  onValueChange,
  formatValue,
  getValueText,
}: SliderProps): void {
  if (typeof label !== 'string' || label.trim() === '') {
    throw new Error('Slider: label must be a non-empty string.');
  }
  assertFinite(value, 'value');
  assertFinite(min, 'min');
  assertFinite(max, 'max');
  assertFinite(step, 'step');
  if (max <= min) throw new Error('Slider: max must be greater than min.');
  if (step <= 0) throw new Error('Slider: step must be greater than 0.');
  if (value < min || value > max) {
    throw new Error(`Slider: value ${value} must be within [${min}, ${max}].`);
  }
  if (id !== undefined && (
    typeof id !== 'string' || id.trim() === '' || /\s/.test(id)
  )) {
    throw new Error('Slider: id must be a non-empty string without whitespace.');
  }
  if (description !== undefined && (
    typeof description !== 'string' || description.trim() === ''
  )) {
    throw new Error('Slider: description must be a non-empty string.');
  }
  if (typeof onValueChange !== 'function') {
    throw new Error('Slider: onValueChange must be a function.');
  }
  if (formatValue !== undefined && typeof formatValue !== 'function') {
    throw new Error('Slider: formatValue must be a function.');
  }
  if (getValueText !== undefined && typeof getValueText !== 'function') {
    throw new Error('Slider: getValueText must be a function.');
  }
}

export function Slider(props: SliderProps) {
  assertSliderProps(props);
  const {
    label,
    value,
    min,
    max,
    step = 1,
    onValueChange,
    id,
    name,
    description,
    disabled = false,
    className,
    formatValue = String,
    getValueText = formatValue,
  } = props;

  const generated = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const inputId = id ?? `demo-slider-${generated}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const displayValue = formatValue(value);
  if (typeof displayValue !== 'string' || displayValue.trim() === '') {
    throw new Error('Slider: formatValue must return a non-empty string.');
  }
  const valueText = getValueText(value);
  if (typeof valueText !== 'string' || valueText.trim() === '') {
    throw new Error('Slider: getValueText must return a non-empty string.');
  }
  const classes = ['demo-slider', className].filter(Boolean).join(' ');

  return (
    <div class={classes} data-disabled={disabled || undefined}>
      <div class="demo-slider__head">
        <label class="demo-slider__label" for={inputId}>{label}</label>
        <output class="demo-slider__value" for={inputId}>{displayValue}</output>
      </div>
      {description && (
        <p id={descriptionId} class="demo-slider__description">{description}</p>
      )}
      <input
        id={inputId}
        class="demo-slider__input"
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-describedby={descriptionId}
        aria-valuetext={valueText}
        onInput={(event) => {
          const next = Number.parseFloat(event.currentTarget.value);
          if (!Number.isFinite(next)) {
            throw new Error('Slider: native input produced a non-finite value.');
          }
          onValueChange(next);
        }}
      />
    </div>
  );
}
