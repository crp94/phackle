// Act I's signature (DESIGN.md R8.1): the big p-value. Master spec §2.4/§7.2
// + the controller's ACT-I COLOUR RULE pin, now folded into DESIGN.md R1.8
// (amended by this task — see §0's dial-prose reconciliation row and R1.5's
// second registered exception):
//   p >= .05 -> reads --muted, growing more "solid" (opacity) as p -> .05
//   p <  .05 -> solid --assist-green ("the glow" -- SUBMIT is now legal)
//   --sig-red NEVER appears here -- it belongs to Act II (R1.3's four places
//   are all on the reveal: the RETRACTED stamp, the .05 threshold rule+label,
//   the published path+leader line, and the Act II accounting figures).
//
// The blend is an OPACITY ramp between the two tokens, never a literal
// color-mix(): R1.3a bans color-mix()/color-contrast() outside tokens.css,
// and tests/ui/tokens.test.ts's R1.7 suite ("finds no inline colour
// derivation outside tokens.css") enforces that mechanically, failing the
// build on any hit in this file. Two tokens, never mixed, never a third
// colour, never a literal shadow/halo (R8.1 bans those outright regardless).
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { PathResult } from '../../engine/types';
import './PValueDial.css';

export interface PValueDialProps {
  result: PathResult | null;
  pending: boolean;
}

/** 0 at p=1 (as far from .05 as a p-value gets), 1 at p<=.05. Drives the
 * dial's opacity ramp toward full saturation as significance approaches. */
function pProximity(p: number): number {
  if (!Number.isFinite(p) || p >= 1) return 0;
  if (p <= 0.05) return 1;
  return (1 - p) / 0.95;
}

/** n - p, p = 2 (intercept + treatment) + one per active covariate — the
 * SAME formula src/engine/stats.ts's ols() uses for its own `df`. PathResult
 * doesn't carry df directly (see its own type comment: fields may carry
 * plausible numbers even when invalid, so nothing here is computed except
 * from the two fields (`n`, `spec.covariates`) the type actually promises. */
function degreesOfFreedom(result: PathResult): number {
  const covCount = (result.spec.covariates.income ? 1 : 0) + (result.spec.covariates.risk ? 1 : 0);
  return result.n - 2 - covCount;
}

const TICK_MS = 120; // mirrors --dur-tick (R5.1) for the JS-driven translateY bump's own timing.

export function PValueDial({ result, pending }: PValueDialProps) {
  const { t } = useLocale();
  const reducedMotion = useReducedMotion();
  const [ticking, setTicking] = useState(false);
  const prevKeyRef = useRef<string | null>(null);

  // Keyed on the values that actually change the DISPLAYED number (not
  // merely a same-valued re-render), so the tick fires once per genuinely
  // new result rather than on every parent re-render.
  const tickKey = result ? `${result.p}|${result.n}|${result.spec.outcome}` : null;

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    prevKeyRef.current = tickKey;
    if (prevKey !== null && tickKey !== null && tickKey !== prevKey && !reducedMotion) {
      setTicking(true);
      const handle = setTimeout(() => setTicking(false), TICK_MS);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [tickKey, reducedMotion]);

  if (!result) {
    return (
      <div className="ph-dial" data-testid="pvalue-dial" aria-busy={pending}>
        <p className="ph-dial__value">—</p>
      </div>
    );
  }

  if (!result.valid) {
    return (
      <div className="ph-dial" data-testid="pvalue-dial" aria-busy={pending}>
        <p className="ph-dial__insufficient">{t('lab.insufficient')}</p>
      </div>
    );
  }

  const significant = result.p < 0.05;
  const proximity = pProximity(result.p);
  const opacity = significant ? 1 : 0.35 + 0.65 * proximity;
  const formatted = result.p < 0.001 ? t('lab.pBelow') : t('lab.pEquals', { p: result.p.toFixed(3) });
  const df = degreesOfFreedom(result);

  return (
    <div
      className={significant ? 'ph-dial ph-dial--significant' : 'ph-dial'}
      data-testid="pvalue-dial"
      aria-busy={pending}
    >
      <p
        className={ticking ? 'ph-dial__value ph-dial__value--tick' : 'ph-dial__value'}
        style={{ opacity }}
      >
        {formatted}
      </p>
      <p className="ph-dial__meta">
        {t('lab.nLabel', { n: result.n })} · {t('lab.dfLabel', { df })}
      </p>
    </div>
  );
}
