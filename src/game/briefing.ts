// Pure, framework-free selection logic behind the BRIEFING screen (T15;
// master spec §2.3/§4.2). No React, no store access -- a plain function of
// its arguments, unit-tested directly in tests/game/briefing.test.ts, and
// called by src/ui/screens/Briefing.tsx. Mirrors src/game/published.ts's own
// split (pure logic in game/, rendering in ui/screens/); kept in its own
// module (rather than co-located inside Briefing.tsx) so that file exports
// only the component, matching this codebase's react-refresh/only-export-
// components convention (see e.g. src/ui/App.tsx, src/ui/components/*).
import { fnv1a32 } from '../engine/prng';

/**
 * Grantwell rotation (controller pin): `fnv1a32('grantwell:'+iso) %
 * bank.length`.
 */
export function pickGrantwellEmail(bank: string[], iso: string): string {
  const idx = fnv1a32(`grantwell:${iso}`) % bank.length;
  return bank[idx];
}
