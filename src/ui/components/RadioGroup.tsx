// A generic WAI-ARIA radiogroup (DESIGN.md R6.5: no dropdowns — every fork
// is one visible tap): a visible legend plus `role="radio"` options with
// roving tabindex. Right/Down selects the next option (wrapping), Left/Up
// the previous — focus moves WITH the new selection, exactly like a native
// <input type="radio"> group. Extracted from SpecControls.tsx (post-review
// fix: the ≤150-line component cap) so all six of its knobs share one
// implementation instead of inlining it six times.
import type { KeyboardEvent } from 'react';
import './RadioGroup.css';

export interface RadioOption<T> {
  value: T;
  label: string;
}

export interface RadioGroupProps<T extends string | number> {
  name: string;
  legend: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}

export function RadioGroup<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
}: RadioGroupProps<T>) {
  const legendId = `ph-spec-${name}-legend`;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length;
    if (next === -1) return;
    e.preventDefault();
    onChange(options[next].value);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons[next]?.focus();
  }

  return (
    <div className="ph-spec-group">
      <p className="ph-spec-group__legend" id={legendId}>
        {legend}
      </p>
      <div className="ph-spec-group__options" role="radiogroup" aria-labelledby={legendId} onKeyDown={handleKeyDown}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              className={selected ? 'ph-radio ph-radio--selected' : 'ph-radio'}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
