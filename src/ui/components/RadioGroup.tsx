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
  /** T31: one quiet line under the options saying what this control does
   * (the play-test's "and explanations"). Rendered BELOW the options and
   * wired to the radiogroup with aria-describedby, so a screen reader reads
   * the legend, then the note, then the choices — the same order a sighted
   * player reads them in. Optional: a group with nothing to explain simply
   * omits it and no empty element is emitted. */
  note?: string;
}

export function RadioGroup<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
  note,
}: RadioGroupProps<T>) {
  const legendId = `ph-spec-${name}-legend`;
  const noteId = `ph-spec-${name}-note`;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // gr6-104 — the buttons carry `disabled`, so a POINTER cannot reach them
    // while a spec change is in flight; the keyboard could. Arrow keys ran
    // the full roving-focus path and called onChange, which is the one
    // interaction in this component that is supposed to be shut off. A
    // guard, not a `tabindex` change: the group must stay reachable and
    // readable while it is inert.
    if (disabled) return;
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
      <div
        className="ph-spec-group__options"
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={note === undefined ? undefined : noteId}
        onKeyDown={handleKeyDown}
      >
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
              className={selected ? 'ph-radio ph-radio--selected ph-focusable' : 'ph-radio ph-focusable'}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {note === undefined ? null : (
        <p className="ph-spec-group__note" id={noteId} data-testid="spec-group-note">
          {note}
        </p>
      )}
    </div>
  );
}
