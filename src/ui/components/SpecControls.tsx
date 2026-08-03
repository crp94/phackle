// The Lab's six specification knobs (master spec §2.4, §7.3; DESIGN.md
// R6.5): every fork is a segmented radiogroup, never a <select> — a dropdown
// hides the garden of forking paths, which is the whole lesson. The shared
// radiogroup mechanics (roving tabindex, arrow keys move + select) live in
// RadioGroup.tsx (post-review fix: extracted so this file stays under the
// ≤150-line component cap) — this file only maps each of the six Spec axes
// to its own set of options and wires onChange to a full, updated Spec. The
// debounce itself lives in store.changeSpec; this component just calls the
// `onChange` prop it's given.
import { useLocale } from '../../i18n/LocaleProvider';
import { RadioGroup } from './RadioGroup';
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

export function SpecControls({ spec, onChange, scenario, disabled }: SpecControlsProps) {
  const { t } = useLocale();

  return (
    <div className="ph-spec-controls">
      <RadioGroup<Outcome>
        name="outcome"
        legend={t('lab.outcome')}
        value={spec.outcome}
        disabled={disabled}
        onChange={(outcome) => onChange({ ...spec, outcome })}
        options={scenario.outcomeLabels.map((label, i) => ({ value: i as Outcome, label }))}
      />
      <RadioGroup<Spec['subgroup']>
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
      <RadioGroup<CovariateChoice>
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
      <RadioGroup<Spec['exclusion']>
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
      <RadioGroup<Spec['transform']>
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
      <RadioGroup<Spec['tails']>
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
