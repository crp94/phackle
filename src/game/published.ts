// Pure, framework-free selection logic behind the PUBLISHED screen (T15;
// master spec §2.5/§4.3/§4.4). No React, no store access — everything here
// is a plain function of its arguments, unit-tested directly in
// tests/game/published.test.ts, and called by src/ui/screens/Published.tsx.
import { fnv1a32 } from '../engine/prng';
import { JOURNALS } from '../content/journals';
import type { PressBlurb } from '../content/types';
import { TIER_FORKS } from './tuning';

export type EgregiousnessTier = 1 | 2 | 3;

/**
 * tuning.TIER_FORKS: `forks <= polite` -> tier 1 ("polite acceptance
 * letter"); `forks >= editorsPick` -> tier 3 ("Editor's Pick"); otherwise
 * tier 2. Reads the live tuning constants (never retypes their values) so a
 * future tuning change can't silently drift out of sync with this function.
 */
export function egregiousnessTier(forks: number): EgregiousnessTier {
  if (forks <= TIER_FORKS.polite) return 1;
  if (forks >= TIER_FORKS.editorsPick) return 3;
  return 2;
}

/** R5.4: confetti is capped at 400 particles regardless of tier; 150/250/400
 * by tier is the celebration's own egregiousness scaling (master spec §2.5).
 * ConfettiLayer (T5) clamps independently too — this is belt-and-suspenders,
 * not the only place the cap is enforced. */
const CONFETTI_PARTICLES_BY_TIER: Record<EgregiousnessTier, number> = { 1: 150, 2: 250, 3: 400 };

export function confettiParticlesForTier(tier: EgregiousnessTier): number {
  return CONFETTI_PARTICLES_BY_TIER[tier];
}

/** `10.1337/phk.{puzzleNumber}` — master spec §7.3's fake DOI, exactly. */
export function fakeDoi(puzzleNumber: number): string {
  return `10.1337/phk.${puzzleNumber}`;
}

/**
 * T6 ruling (controller pin): substitutes the headline's optional `{effect}`
 * token with the published spec's effect magnitude — `Math.abs` because the
 * headline's own wording carries the direction ("Faster", "Higher Returns"),
 * rounded to the nearest whole number, and floored at 1 so no headline ever
 * prints "0%" or "€0k". A headline with no token (content: legal, no rule
 * requires one) is returned unchanged — `.replace` is a no-op when there's
 * nothing to match. At most one token ever appears (shape-tested in
 * tests/content/shape.test.ts), so a single non-global replace is exact.
 */
export function substituteEffect(headline: string, beta: number): string {
  const magnitude = Math.max(1, Math.round(Math.abs(beta)));
  return headline.replace('{effect}', String(magnitude));
}

/**
 * Tag-filtered pool (a journal qualifies if any of its own tags appears in
 * the scenario's `journalTags`), picked deterministically by `fnv1a32(iso)`.
 * Every scenario's tags intersect at least one journal's by construction
 * (tests/content/shape.test.ts's `journalTag` check guarantees this), but the
 * fallback to the full pool is a defensive backstop against a future content
 * change breaking that invariant — a wrong-but-plausible journal is much
 * better than a crash on the celebration screen.
 */
export function pickJournal(tags: string[], iso: string): { name: string } {
  const matched = JOURNALS.filter((j) => j.tags.some((t) => tags.includes(t)));
  const pool = matched.length > 0 ? matched : JOURNALS;
  const idx = fnv1a32(iso) % pool.length;
  return { name: pool[idx].name };
}

/**
 * Press picker (T6 review adoption). Prefers a blurb whose `scenarioIds`
 * names today's scenario AND matches `tier`; falls back to the
 * scenario-agnostic pool at that same tier (blurbs with no `scenarioIds` at
 * all) so a blurb written for a DIFFERENT scenario never leaks in (that is
 * exactly what PressBlurb.scenarioIds exists to prevent — see
 * src/content/types.ts's own doc comment: "a fern chyron could run over a
 * sourdough study"). Deterministic via `fnv1a32(iso + tier)`.
 *
 * Callers needing a second, usually-distinct pick (Published's 2nd press
 * card, and the tier-3 chyron blurb) salt the `iso` argument itself (e.g.
 * `` `${iso}#2` ``) rather than this function growing a bespoke "exclude"
 * parameter — still a pure, deterministic function of its four arguments.
 */
export function pickPress(press: PressBlurb[], tier: EgregiousnessTier, scenarioId: string, iso: string): PressBlurb {
  const tierMatched = press.filter((p) => p.tier === tier);
  const preferred = tierMatched.filter((p) => p.scenarioIds?.includes(scenarioId));
  const agnostic = tierMatched.filter((p) => !p.scenarioIds || p.scenarioIds.length === 0);
  const pool = preferred.length > 0 ? preferred : agnostic;
  // Defensive backstop (content guarantees every tier has >=1 agnostic
  // blurb): widen rather than crash if some future edit ever left a tier
  // with only scenario-bound entries.
  const safePool = pool.length > 0 ? pool : tierMatched.length > 0 ? tierMatched : press;
  const idx = fnv1a32(iso + String(tier)) % safePool.length;
  return safePool[idx];
}
