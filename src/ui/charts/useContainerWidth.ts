// The scale-invariance mechanism, extracted so more than one figure can use it.
//
// ORIGIN (T16 review finding I3, see SpecCurve.tsx's FIGURE_* block for the
// full argument): an SVG with a FIXED viewBox scales its own interior, so a
// 13-unit label in a 720-unit box renders at 5.8 CSS px on a 320px phone and
// at 19.6 CSS px on a 1088px desktop — illegible on one, ballooned on the
// other, and invisible at exactly the ~660px width a figure tends to get
// reviewed at.
//
// The fix is to make the viewBox TRACK the container: one user unit is then
// one CSS pixel at every width, `font-size: var(--text-13)` really is 13px
// everywhere, and no geometry has to divide by a scale factor. The figure
// simply gets narrower on a phone, which is what should happen.
//
// This hook is only the measurement half. Each figure keeps its own
// `geometryFor(width)` — the layouts differ, the mechanism does not.
// SpecCurve.tsx still carries its own inline copy of this effect: it is
// outside this task's file set and behaviourally identical, so it was left
// alone rather than churned. A later pass can collapse the two.
import { useEffect, useState, type RefObject } from 'react';

/**
 * Observes `ref`'s content-box width. Returns `null` until a real measurement
 * arrives, and in environments without ResizeObserver (jsdom, SSR) — callers
 * substitute their own documented default so layout is deterministic there
 * rather than zero-width.
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      if (measured > 0) setWidth(measured);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
