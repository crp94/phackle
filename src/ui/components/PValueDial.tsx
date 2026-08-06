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
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

// How long the settle class stays on before it is removed so the next result
// can replay it. FIX ROUND 1 (M7): READ from the cascade rather than retyped,
// which is the idiom src/ui/screens/Published.tsx's readDurConfettiMs()
// already sets for exactly this problem — R5.6's own worked example ("read
// the token ... or [it] will still block ... for reduced-motion users"). A
// literal 140 here would survive tokens.css's reduced-motion collapse
// untouched and hold the class on for 140ms in a build that has no motion at
// all; reading --dur-quick means this timer shortens with the animation it
// re-arms, to 1ms.
//
// Vitest does not process CSS under jsdom (no `css: true` in
// vite.config.ts's test block), so getComputedStyle returns '' there,
// parseFloat('') is NaN, and the guard falls through to the same value
// tokens.css declares — no mocking needed, exactly as in Published.tsx.
const FALLBACK_DUR_QUICK_MS = 140;
/** R5.1's scene duration, the loud half of gr6-063's pair. */
const FALLBACK_DUR_SCENE_MS = 260;

function readDurMs(token: '--dur-quick' | '--dur-scene', fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * A shell rather than three copies of the same markup: `data-testid` and the
 * band modifier class stay on this one element so R1.8's own tests keep
 * addressing it whatever state the dial is in.
 *
 * T29 (controller ruling, dial-alone-sticky): this block holds the NUMERAL
 * AND THE n/df LINE ONLY. The caption moved out to `PValueDialCaption`
 * below, because on mobile the Lab makes exactly this block `position:
 * sticky` — and a sticky element taller than its share of the viewport does
 * not pin, it slides to the end of its containing block and paints over its
 * siblings (T31's measured bug, written up in Lab.css). The caption roughly
 * triples this block's height, so it cannot be inside it.
 *
 * T22 — THE DIAL IS A LIVE REGION, and this is the single biggest thing the
 * accessibility pass changed about how the game plays. Measured in real
 * Chrome before this task: turning a knob with the arrow keys moved the
 * p-value from 0.087 to 0.570 and the page announced NOTHING — the entire
 * §2.4 loop (turn a knob, watch the number) was inaudible, because focus
 * stays on the radio while the number that answers it lives elsewhere in the
 * DOM. `role="status"` (implicitly aria-live="polite", aria-atomic="true")
 * re-reads this whole block — the numeral AND its n/df line — whenever its
 * text changes, and only then: a re-render that produces identical text (the
 * settle-class toggle below, a parent's state change) mutates nothing and
 * announces nothing, so this fires once per genuinely new result rather than
 * on every render.
 *
 * `aria-busy` is what makes "only when it has settled" true rather than
 * merely likely: a live region marked busy holds its announcement until the
 * flag clears, so the in-flight state of a debounced spec change is never
 * read out as a result. It was already here for its own reasons; pairing it
 * with the live role is what turns it into the settle gate.
 *
 * WHAT IS NOT ANNOUNCED, and why: the colour BAND (R1.8's five steps). The
 * band is a redundant encoding of the number that is already being read —
 * `p = 0.043` IS the significant state, and `lab.dialCaption`, which renders
 * directly beneath this block in every state and is read like any other
 * prose, is the sentence that states the rule ("Below 0.05, you can
 * publish"). Announcing a band name on top of the number would be the same
 * fact twice, and would need a vocabulary the copy catalog does not have.
 * The second channel a sighted player gets — SUBMIT TO JOURNAL becoming
 * enabled — is a native disabled-state change on a real button, which every
 * screen reader reports on arrival.
 */
function DialShell({
  className,
  pending,
  children,
}: {
  className: string;
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <div className={className} data-testid="pvalue-dial" role="status" aria-busy={pending}>
      {children}
    </div>
  );
}

/**
 * T31 (second play-test round: "beautiful but hard to fully grasp"). The
 * dial's own caption, and — by the controller's framing — the single most
 * important explanation in the app: a first-timer has to understand the big
 * number from this line alone. It therefore renders in EVERY state, including
 * the pre-first-result placeholder and the n<30 state, which are precisely
 * the moments someone is most likely to be looking at the dial without
 * knowing what it is — so it is a sibling that is always rendered, never a
 * branch of the dial's own three states.
 *
 * Split out of the dial block by T29's dial-alone-sticky ruling (see
 * DialShell above): it renders immediately under the dial, as the first thing
 * in the Lab's results pane.
 */
export function PValueDialCaption() {
  const { t } = useLocale();
  return (
    <p className="ph-dial__caption" data-testid="pvalue-dial-caption">
      {t('lab.dialCaption')}
    </p>
  );
}

export function PValueDial({ result, pending }: PValueDialProps) {
  const { t } = useLocale();
  const reducedMotion = useReducedMotion();
  /** gr6-063: which of site 2's two settles is armed, if either. */
  const [settle, setSettle] = useState<'quiet' | 'band' | null>(null);
  const prevKeyRef = useRef<string | null>(null);
  const prevBandRef = useRef<DialBand | undefined>(undefined);

  // Keyed on the values that actually change the DISPLAYED number (not
  // merely a same-valued re-render), so the tick fires once per genuinely
  // new result rather than on every parent re-render.
  const tickKey = result ? `${result.p}|${result.n}|${result.spec.outcome}` : null;
  // R5.2 row 2's trigger, narrowed by Grant 1: the LOUD settle is keyed on
  // the band, not on the number. `undefined` (never seen a band) is
  // deliberately distinct from `null` (the resting p > .5 band), so the
  // first result of the day cannot be read as a crossing.
  const currentBand = result && result.valid ? dialBand(result.p) : undefined;

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    const prevBand = prevBandRef.current;
    prevKeyRef.current = tickKey;
    prevBandRef.current = currentBand;
    if (prevKey !== null && tickKey !== null && tickKey !== prevKey && !reducedMotion) {
      // A band CHANGE — a move between R1.8's five steps — takes R5.3's loud
      // pair; a re-settle inside the same band keeps the quiet one. Both
      // collapse to one imperceptible frame under reduced motion, because
      // both read tokens tokens.css collapses (R5.6) — and the timer that
      // re-arms the class reads the SAME token as the animation it re-arms,
      // so it shortens with it instead of holding a class on for 260ms in a
      // build that has no motion at all.
      const crossed = prevBand !== undefined && currentBand !== undefined && currentBand !== prevBand;
      setSettle(crossed ? 'band' : 'quiet');
      const handle = setTimeout(
        () => setSettle(null),
        crossed ? readDurMs('--dur-scene', FALLBACK_DUR_SCENE_MS) : readDurMs('--dur-quick', FALLBACK_DUR_QUICK_MS)
      );
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [tickKey, currentBand, reducedMotion]);

  const valueClassName =
    settle === 'band'
      ? 'ph-dial__value ph-dial__value--tick-band'
      : settle === 'quiet'
        ? 'ph-dial__value ph-dial__value--tick'
        : 'ph-dial__value';

  if (!result) {
    return (
      <DialShell className="ph-dial" pending={pending}>
        <p className="ph-dial__value">—</p>
      </DialShell>
    );
  }

  if (!result.valid) {
    return (
      <DialShell className="ph-dial" pending={pending}>
        <p className="ph-dial__insufficient">{t('lab.insufficient')}</p>
      </DialShell>
    );
  }

  const band = dialBand(result.p);
  const dialClassName = band ? `ph-dial ph-dial--${band}` : 'ph-dial';
  const formatted = result.p < 0.001 ? t('lab.pBelow') : t('lab.pEquals', { p: result.p.toFixed(3) });
  const df = degreesOfFreedom(result);

  return (
    <DialShell className={dialClassName} pending={pending}>
      <p className={valueClassName}>{formatted}</p>
      <p className="ph-dial__meta">
        {t('lab.nLabel', { n: result.n })} · {t('lab.dfLabel', { df })}
      </p>
    </DialShell>
  );
}
