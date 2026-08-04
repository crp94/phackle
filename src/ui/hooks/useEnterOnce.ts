// The one entrance idiom in P-hackle (DESIGN.md R5.2 sites 3 and 5, R5.7).
//
// WHY THIS IS A SHARED HOOK AND NOT TWO COPIES. T35 fix round 1: the press
// clippings on Published were originally gated on MOUNT, and that reproduced
// — exactly — the defect T35 had just fixed for the stamp. Measured at
// 360x780 on the real build, the three clippings sit at document tops
// 952/1143/1373 against a 780px viewport: every one of them ran its 260ms
// entrance to completion while below the fold, so the day's payoff cascade
// played to an empty room and the player scrolled down to press that had
// always been there. At 1088 they happen to be in view at mount, which is
// why a desktop-only look never showed it.
//
// A mount-triggered entrance is only ever correct for something that is
// guaranteed on screen at mount, and almost nothing below the first fold is.
// So the trigger belongs to the viewport, not to the lifecycle — and once
// that is true for two sites it must be ONE implementation, or the next
// screen to want an entrance will copy whichever version it happened to
// read first.
//
// FAILS OPEN IN EVERY DIRECTION THAT COULD HIDE CONTENT (R5.6's
// no-content-behind-motion clause): reduced motion, an engine with no
// IntersectionObserver, and a node that never mounts all resolve to "entered
// now" rather than "entered never". Callers pair `entered` with a class that
// carries the visibility itself, so the animation only ever decorates a
// state the stylesheet already holds.
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * DESIGN.md R5.7's cap. The most delay steps any single item may wait before
 * its own entrance runs.
 *
 * A stagger exists to break up items that arrive SIMULTANEOUSLY — the
 * reveal's first three blocks share IntersectionObserver's very first
 * callback, and so do all three clippings on a desktop-height Published. An
 * uncapped index would tax an item that arrives ALONE (scrolled to, one at a
 * time) purely for sitting further down the document, which is a delay the
 * player experiences as lag with nothing to show for it.
 */
export const MAX_STAGGER_STEPS = 2;

/**
 * R5.7's inline hook, and the only inline style motion may set. The
 * stylesheet multiplies this by `--dur-stagger`; the value itself is an
 * index, never a duration, so `tokens.css`'s reduced-motion block still
 * controls the actual timing (there, 0ms).
 */
export function staggerStyle(index: number): CSSProperties {
  return { '--ph-stagger-index': Math.min(index, MAX_STAGGER_STEPS) } as CSSProperties;
}

export interface EnterOnce<T extends HTMLElement> {
  /** Attach to the element whose entrance is being gated. */
  ref: RefObject<T | null>;
  /** True once the element has been in view — never returns to false. */
  entered: boolean;
}

/**
 * One-way viewport gate: flips `entered` true the first time the element
 * intersects and disconnects immediately, so nothing re-triggers on the way
 * back up. `rootMargin`'s -8% bottom inset means an element counts as
 * arrived once it is properly on screen rather than one pixel into it.
 */
export function useEnterOnce<T extends HTMLElement>(): EnterOnce<T> {
  const reducedMotion = useReducedMotion();
  const ref = useRef<T | null>(null);
  const [entered, setEntered] = useState(() => reducedMotion || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (entered || typeof IntersectionObserver === 'undefined') return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entered]);

  return { ref, entered };
}
