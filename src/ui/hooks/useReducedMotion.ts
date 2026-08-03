// Reactive `prefers-reduced-motion` read (DESIGN.md R5.6). tokens.css already
// collapses the CSS-driven durations to ~0 under the media query, but the two
// JS-driven motions (Stamp's slam, ConfettiLayer's canvas loop) can't rely on
// that — they must decide, in JS, whether to run at all. This hook is the
// single place that decision is made, so both components (and any future one)
// consult the same reactive source instead of re-reading matchMedia ad hoc.
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function matches(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(matches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => setReduced(event.matches);

    // Modern addEventListener API, with the legacy addListener fallback some
    // older engines (and test mocks) may still expose instead.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(handleChange);
      return () => mql.removeListener(handleChange);
    }
    return undefined;
  }, []);

  return reduced;
}
