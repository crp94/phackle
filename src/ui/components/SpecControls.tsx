// The Lab's six specification knobs (master spec §2.4, §7.3; DESIGN.md
// R6.5): every fork is a segmented radiogroup, never a <select> — a dropdown
// hides the garden of forking paths, which is the whole lesson. Each group
// is a WAI-ARIA radiogroup with roving tabindex: arrow keys both move focus
// AND change the selection (native radio-button behavior), matching the
// brief's "arrow-key moves selection & fires one debounced runSpec" (the
// debounce itself lives in store.changeSpec — this component only calls the
// `onChange` prop it's given).
import type { KeyboardEvent } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { Outcome, Spec } from '../../engine/types';
import type { Scenario } from '../../content/types';
import './SpecControls.css';

export interface SpecControlsProps {
  spec: Spec;
  onChange: (next: Spec) => void;
  scenario: Scenario;
  disabled: boolean;
}

type CovariateChoice = 'none' | 'income' | 'risk' | 'both';

function covariateChoice(c: Spec['covariates']): CovariateChoice {
  if (c.income && c.risk) return 'both';
  if (c.income) return 'income';
  if (c.risk) return 'risk';
  return 'none';
}

function covariatesFromChoice(choice: CovariateChoice): Spec['covariates'] {
  return { income: choice === 'income' || choice === 'both', risk: choice === 'risk' || choice === 'both' };
}

interface RadioOption<T> {
  value: T;
  label: string;
}

interface GroupProps<T extends string | number> {
  name: string;
  legend: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}

/** One radiogroup: a visible legend (`--muted`, uppercase per R2.7) plus its
 * `role="radio"` options. WAI-ARIA radiogroup pattern: Right/Down selects
 * the next option (wrapping), Left/Up the previous — focus moves WITH the
 * new selection, exactly like a native <input type="radio"> group. */
function Group<T extends string | number>({ name, legend, options, value, onChange, disabled }: GroupProps<T>) {
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

export function SpecControls({ spec, onChange, scenario, disabled }: SpecControlsProps) {
  const { t } = useLocale();

  return (
    <div className="ph-spec-controls">
      <Group<Outcome>
        name="outcome"
        legend={t('lab.outcome')}
        value={spec.outcome}
        disabled={disabled}
        onChange={(outcome) => onChange({ ...spec, outcome })}
        options={scenario.outcomeLabels.map((label, i) => ({ value: i as Outcome, label }))}
      />
      <Group<Spec['subgroup']>
        name="subgroup"
        legend={t('lab.subgroup')}
        value={spec.subgroup}
        disabled={disabled}
        onChange={(subgroup) => onChange({ ...spec, subgroup })}
        options={[
          { value: 'all', label: t('lab.subgroupAll') },
          { value: 'age_lt40', label: t('lab.subgroupAgeLt40') },
          { value: 'age_ge40', label: t('lab.subgroupAgeGe40') },
          { value: 'exp_high', label: t('lab.subgroupExpHigh') },
          { value: 'exp_low', label: t('lab.subgroupExpLow') },
          { value: 'urban', label: t('lab.subgroupUrban') },
          { value: 'rural', label: t('lab.subgroupRural') },
        ]}
      />
      <Group<CovariateChoice>
        name="covariates"
        legend={t('lab.covariates')}
        value={covariateChoice(spec.covariates)}
        disabled={disabled}
        onChange={(choice) => onChange({ ...spec, covariates: covariatesFromChoice(choice) })}
        options={[
          { value: 'none', label: t('lab.covariatesNone') },
          { value: 'income', label: scenario.covariateLabels.income },
          { value: 'risk', label: scenario.covariateLabels.risk },
          {
            value: 'both',
            label: t('lab.covariatesBoth', {
              income: scenario.covariateLabels.income,
              risk: scenario.covariateLabels.risk,
            }),
          },
        ]}
      />
      <Group<Spec['exclusion']>
        name="exclusion"
        legend={t('lab.exclusion')}
        value={spec.exclusion}
        disabled={disabled}
        onChange={(exclusion) => onChange({ ...spec, exclusion })}
        options={[
          { value: 'none', label: t('lab.exclusionNone') },
          { value: 'z3', label: t('lab.exclusionZ3') },
          { value: 'z2_5', label: t('lab.exclusionZ2_5') },
          { value: 'z2', label: t('lab.exclusionZ2') },
        ]}
      />
      <Group<Spec['transform']>
        name="transform"
        legend={t('lab.transform')}
        value={spec.transform}
        disabled={disabled}
        onChange={(transform) => onChange({ ...spec, transform })}
        options={[
          { value: 'raw', label: t('lab.transformRaw') },
          { value: 'log1p', label: t('lab.transformLog1p') },
        ]}
      />
      <Group<Spec['tails']>
        name="tails"
        legend={t('lab.tails')}
        value={spec.tails}
        disabled={disabled}
        onChange={(tails) => onChange({ ...spec, tails })}
        options={[
          { value: 'two', label: t('lab.tailsTwo') },
          { value: 'one', label: t('lab.tailsOne') },
        ]}
      />
    </div>
  );
}
