// Act I's signature (DESIGN.md R8.1): the big p-value. Master spec §2.4/§7.2
// + the controller's ACT-I COLOUR RULE pin, folded into DESIGN.md R1.8
// (amended by this task — see §0's dial-prose reconciliation row, R1.5's
// second registered exception, and the §7.3 contrast table):
//   p >  .5        -> --muted (the resting default)
//   .2 < p <= .5    -> --dial-step-1
//   .1 < p <= .2    -> --dial-step-2
//   .05 <= p <= .1  -> --dial-step-3
//   p <  .05        -> solid --assist-green ("the glow" -- SUBMIT is legal)
//   --sig-red NEVER appears here -- it belongs to Act II (R1.3's four places
//   are all on the reveal: the RETRACTED stamp, the .05 threshold rule+label,
//   the published path+leader line, and the Act II accounting figures).
//
// FIX ROUND (post-review): an earlier version of this component read a
// continuous opacity ramp (0.35 + 0.65*proximity) on a --muted-coloured
// element instead of these five discrete steps. That fails DESIGN.md's own
// "stays >= 4.5:1" claim: reducing a token's opacity alpha-composites it
// toward --paper, and at low proximity (p near 1) the effective rendered
// contrast collapsed to ~1.6:1 (light) / ~1.7:1 (dark) -- nowhere near the
// floor, and invisible to the static token suite because it only ever reads
// tokens.css's literal declarations, never a runtime opacity value. The fix:
// full opacity always, and the "as p approaches .05" ramp is now a genuine
// perceptible colour STEP through --dial-step-1/-2/-3 -- three NEW derived
// tokens (color-mix(in srgb, var(--muted), var(--assist-green) 25/50/75%),
// computed offline and hardcoded as literal hex in tokens.css, per §0's
// derived-colour registry) that are themselves in tokens.test.ts's
// TEXT_TOKENS contrast set, so R1.8's contrast claim is now mechanically
// enforced rather than merely asserted.
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { PathResult } from '../../engine/types';
import './PValueDial.css';

export interface PValueDialProps {
  result: PathResult | null;
  pending: boolean;
}

type DialBand = 'step-1' | 'step-2' | 'step-3' | 'significant' | null;

/** The dial's discrete Act-I colour band for a given p (DESIGN.md R1.8):
 * `null` is the --muted default (p > .5); every other value names the
 * `ph-dial--<band>` modifier class PValueDial.css maps to a token. Boundaries
 * are inclusive on their lower edge except .05 itself, which reads as the
 * highest non-significant step (matching store.submit()'s own strict
 * `p < 0.05` — p===.05 is never itself significant). */
function dialBand(p: number): DialBand {
  if (p < 0.05) return 'significant';
  if (p <= 0.1) return 'step-3';
  if (p <= 0.2) return 'step-2';
  if (p <= 0.5) return 'step-1';
  return null;
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

  const band = dialBand(result.p);
  const dialClassName = band ? `ph-dial ph-dial--${band}` : 'ph-dial';
  const formatted = result.p < 0.001 ? t('lab.pBelow') : t('lab.pEquals', { p: result.p.toFixed(3) });
  const df = degreesOfFreedom(result);

  return (
    <div className={dialClassName} data-testid="pvalue-dial" aria-busy={pending}>
      <p className={ticking ? 'ph-dial__value ph-dial__value--tick' : 'ph-dial__value'}>{formatted}</p>
      <p className="ph-dial__meta">
        {t('lab.nLabel', { n: result.n })} · {t('lab.dfLabel', { df })}
      </p>
    </div>
  );
}
