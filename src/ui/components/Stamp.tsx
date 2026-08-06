// The Act II signature moment (DESIGN.md R8.2, master spec §7.1/§7.3): an
// oversized, rotated, distressed rubber stamp, rendered once at the reveal's
// accounting beat.
import { useId } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { RevealMetrics } from '../../engine/types';
import './Stamp.css';

export interface StampProps {
  kind: RevealMetrics['stamp'];
  label: string;
  animate: boolean;
}

// Controller-ratified carve-out (DESIGN.md R1.5, §0 registry): master spec
// §7.2 names --assist-green for "REPLICATED" among its uses, and the
// REPLICATED verdict stamp is the exact parallel of R1.3's RETRACTED-stamp
// entry for --sig-red -- a signature moment (R8.2), not the ambient chrome
// R1.5's inline-only/never-a-fill discipline targets.
//
// §1(j)(2): BOTH honest verdicts stay on R1.2's default, --ink, including
// CONFIRMED_NULL — which is the day the player was RIGHT, and which therefore
// has a real case for --assist-green. It does not get one HERE. The green and
// red carve-outs are named selectors in DESIGN.md's R1.3/R1.5 registry and
// compiled by tests/ui/tokens.test.ts's allow-list; adding a third would be a
// lawbook amendment, and no wave amends the lawbook as a side effect of a
// content change. The positive beat this ruling asks for is carried by the
// WORD (a verdict that says the player was right), by §2.8's 80-point
// `abandonNull` row and by the subline beneath — none of which need a colour.
// Recorded as a candidate follow-up for the controller, not taken here.
const MARK_CLASS: Record<StampProps['kind'], string> = {
  RETRACTED: 'ph-stamp__mark--red',
  REPLICATED: 'ph-stamp__mark--green',
  CONFIRMED_NULL: 'ph-stamp__mark--ink',
  MISSED_DISCOVERY: 'ph-stamp__mark--ink',
};

/**
 * THE GEOMETRY, and why the numbers below are the ones they are (gr6-010).
 *
 * The mark is rotated -12deg by CSS on the `<svg>` element and its ink is
 * pushed around by an SVG displacement filter. A filter paints wherever its
 * FILTER REGION reaches, and the region used to be declared in
 * objectBoundingBox units (`x="-20%" width="140%"`) — i.e. as a fraction of
 * whatever the group's bounding box happened to be. Measured on the production
 * build at 768: the group's bbox was **555.6 user units wide inside a 320-unit
 * viewBox**, because the retraction subline was a `<text>` node in here and a
 * 49-character mono string at 15 units does not fit in 320. The 140% region
 * around that bbox painted **72px outside the left edge of the window**, with
 * no horizontal scrollbar to give it away (left overflow never makes one).
 *
 * Two changes fix it at the root and make it insensitive to what the text
 * says, which is the part that matters — a locale with a longer label must not
 * be able to reopen this:
 *
 *  1. THE SUBLINE IS NOT IN HERE ANY MORE (gr6-059). It is set horizontally
 *     beneath the cover card by Reveal.tsx, where it is legible; it was the
 *     single largest contributor to the bbox and the least readable string in
 *     the product while it was rotated across the question.
 *  2. THE FILTER REGION IS IN USER SPACE, pinned to the viewBox. `viewBox` and
 *     the region are the same rectangle, so painted ink is a subset of the
 *     element's own box by construction, at any label length, in any locale.
 *     The bleed either side (BLEED units) covers the filter's own
 *     displacement: `scale="7"` moves a pixel by at most +/-3.5 units.
 *
 * `.ph-stamp__mark { width: min(100%, 320px) }` is deliberately untouched: the
 * fix is in SVG coordinates only, as gr4-005 measured it should be.
 */
const BLEED = 12;
const BOX_W = 320;
const BOX_H = 160;
const VIEW_BOX = `${-BLEED} ${-BLEED} ${BOX_W + 2 * BLEED} ${BOX_H + 2 * BLEED}`;

/**
 * THE LABEL FITS THE FRAME, in every locale, by construction (w1-r-011).
 *
 * Pinning the filter region to the viewBox made the region a hard CLIP on
 * filter output — and that exposed a defect the old unbounded region had been
 * hiding since the stamp was written: the label has never fitted the 320-unit
 * box. Measured in the production build (geometry bbox in user units, which is
 * what `getBBox` reports and what `getBoundingClientRect` cannot, since on a
 * filtered element the latter returns the filter region):
 *
 *   RETRACTED        268.8   fits          RITIRATO           219.8  fits
 *   REPLICATED       281.7   fits          REPLICATO          253.5  fits
 *   NULL REPORTED    370.4   OVER by 13.2  RISULTATO NULLO    419.8  OVER by 37.9
 *   RETRACTADO       305.3   fits          RESULTADO NULO     406.9  OVER by 31.4
 *   REPLICADO        257.7   fits
 *
 * All three over-runs are NULL_REPORTED — the verdict an honest player gets for
 * reporting a null result. Before the containment fix they painted outside the
 * window; after it they were sheared ("RISULTATO NULLO" rendered as
 * "ULTATO NUL"). Neither is shippable, and the choice between them is a false
 * one: the real defect is fit.
 *
 * `textLength` + `lengthAdjust="spacingAndGlyphs"` makes the advance an input
 * rather than an output, so no string in any future locale can reopen this.
 * TEXT_W is set to RETRACTED's own measured advance (268.8 -> 268), so the
 * signature label — the one the game is built around and the one on screen
 * most often — renders within 0.3% of its natural width and every other verdict
 * is set to match it. That is also why the numbers above are recorded here:
 * the constant is a measurement, and a future font change invalidates it.
 * The label-fit guard is `tests/ui/shell.test.tsx` (structure, all jsdom can
 * see) and `e2e/stamp.spec.ts` (the nine real strings, measured in a real
 * browser).
 */
const TEXT_W = 268;

export function Stamp({ kind, label, animate }: StampProps) {
  // R5.6: JS-driven motion (this is one of the two, alongside ConfettiLayer)
  // must consult reduced-motion itself rather than lean solely on tokens.css
  // collapsing --dur-stamp -- the caller's `animate` prop is honoured only when
  // the user hasn't asked to reduce motion.
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;
  const filterId = useId();

  return (
    <div className={shouldAnimate ? 'ph-stamp ph-stamp--animate' : 'ph-stamp'}>
      <svg
        className={`ph-stamp__mark ${MARK_CLASS[kind]}`}
        viewBox={VIEW_BOX}
        role="img"
        aria-label={label}
      >
        <defs>
          {/* Distressed rubber-stamp texture: no image asset, an SVG filter only.
              userSpaceOnUse, not the default objectBoundingBox — see the note
              above the constants. */}
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            x={-BLEED}
            y={-BLEED}
            width={BOX_W + 2 * BLEED}
            height={BOX_H + 2 * BLEED}
          >
            <feTurbulence type="fractalNoise" baseFrequency="0.045 0.9" numOctaves="2" seed="7" result="ph-noise" />
            <feDisplacementMap in="SourceGraphic" in2="ph-noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <rect className="ph-stamp__border" x="6" y="6" width="308" height="148" rx="0" />
          <rect className="ph-stamp__border" x="16" y="16" width="288" height="128" rx="0" />
          {/* R6.3 / R8.2: the verdict must exist as real text, not only as the
              shape of the stamp — `aria-label` on the role="img" graphic is the
              channel that carries it, and it is the one that survives however
              the mark is drawn.
              gr6-011: `aria-hidden` here because the two channels were BOTH
              exposed and Act II's signature beat was announced twice in a row
              ("image: RETRACTED" then "StaticText: RETRACTED"). R8.2 is
              satisfied by either channel alone; shipping both makes the game
              stutter at its loudest moment. The text NODE is untouched, so it
              is still queryable and still the thing on screen — only its
              second trip through the accessibility tree is gone. */}
          <text
            className="ph-stamp__label ph-label"
            x="160"
            y="92"
            textAnchor="middle"
            textLength={TEXT_W}
            lengthAdjust="spacingAndGlyphs"
            aria-hidden="true"
          >
            {label}
          </text>
        </g>
      </svg>
    </div>
  );
}
