// The Act II signature moment (DESIGN.md R8.2, master spec §7.1/§7.3): an
// oversized, rotated, distressed rubber stamp, rendered once at the reveal's
// accounting beat.
import { useId } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './Stamp.css';

export interface StampProps {
  kind: 'RETRACTED' | 'REPLICATED' | 'NULL_REPORTED';
  label: string;
  subline?: string;
  animate: boolean;
}

// DESIGN.md R1.3 reserves --sig-red for exactly four named places, and the
// RETRACTED stamp is the only one of the three kinds on that list. R1.5 confines
// --assist-green to inline text at <=1em ("Don't: background: var(--assist-green)
// ...on a success banner -- green is never a fill"), which an oversized stamp
// mark plainly is. Both non-RETRACTED kinds therefore render in --ink here --
// see the task report for this deviation from the brief's literal
// "--sig-red (--assist-green for REPLICATED)" note; R8.2 also warns that reusing
// the stamp *texture* elsewhere turns a signature into a pattern, which reads as
// a second reason the REPLICATED/NULL_REPORTED cases shouldn't reach for a second
// loud colour of their own.
const MARK_CLASS: Record<StampProps['kind'], string> = {
  RETRACTED: 'ph-stamp__mark--red',
  REPLICATED: 'ph-stamp__mark--ink',
  NULL_REPORTED: 'ph-stamp__mark--ink',
};

export function Stamp({ kind, label, subline, animate }: StampProps) {
  // R5.6: JS-driven motion (this is one of the two, alongside ConfettiLayer)
  // must consult reduced-motion itself rather than lean solely on tokens.css
  // collapsing --dur-stamp -- the caller's `animate` prop is honoured only when
  // the user hasn't asked to reduce motion.
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;
  const filterId = useId();

  // R6.3 / R8.2: the verdict must exist as real text, not only as the shape of
  // the stamp -- aria-label gives the graphic an accessible name, and the
  // <text> glyphs below are themselves a literal, queryable text node too.
  const accessibleName = subline ? `${label}: ${subline}` : label;

  return (
    <div className={shouldAnimate ? 'ph-stamp ph-stamp--animate' : 'ph-stamp'}>
      <svg
        className={`ph-stamp__mark ${MARK_CLASS[kind]}`}
        viewBox="0 0 320 160"
        role="img"
        aria-label={accessibleName}
      >
        <defs>
          {/* Distressed rubber-stamp texture: no image asset, an SVG filter only. */}
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045 0.9" numOctaves="2" seed="7" result="ph-noise" />
            <feDisplacementMap in="SourceGraphic" in2="ph-noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <rect className="ph-stamp__border" x="6" y="6" width="308" height="148" rx="0" />
          <rect className="ph-stamp__border" x="16" y="16" width="288" height="128" rx="0" />
          <text className="ph-stamp__label" x="160" y={subline ? 82 : 92} textAnchor="middle">
            {label}
          </text>
          {subline ? (
            <text className="ph-stamp__subline" x="160" y="118" textAnchor="middle">
              {subline}
            </text>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
