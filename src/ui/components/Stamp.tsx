// The Act II signature moment (DESIGN.md R8.2, master spec §7.1/§7.3): an
// oversized, rotated, distressed rubber stamp, rendered once at the reveal's
// accounting beat.
import { useId } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './Stamp.css';

export interface StampProps {
  kind: 'RETRACTED' | 'REPLICATED' | 'NULL_REPORTED';
  label: string;
  animate: boolean;
}

// Controller-ratified carve-out (DESIGN.md R1.5, §0 registry): master spec
// §7.2 names --assist-green for "REPLICATED" among its uses, and the
// REPLICATED verdict stamp is the exact parallel of R1.3's RETRACTED-stamp
// entry for --sig-red -- a signature moment (R8.2), not the ambient chrome
// R1.5's inline-only/never-a-fill discipline targets. NULL_REPORTED has no
// such registered exception, so it stays on R1.2's default, --ink.
const MARK_CLASS: Record<StampProps['kind'], string> = {
  RETRACTED: 'ph-stamp__mark--red',
  REPLICATED: 'ph-stamp__mark--green',
  NULL_REPORTED: 'ph-stamp__mark--ink',
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
          <text className="ph-stamp__label" x="160" y="92" textAnchor="middle" aria-hidden="true">
            {label}
          </text>
        </g>
      </svg>
    </div>
  );
}
