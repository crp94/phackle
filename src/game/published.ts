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

/**
 * Master spec §2.5's fifth celebration element, "a fake altmetric counter
 * spinning up" — review fix (Important): the "spinning up" motion would be a
 * fifth, un-budgeted animation (DESIGN.md's four-item list is exhaustive),
 * exactly the same conflict the press-card "sliding in" language raised —
 * resolved the same way, one documented precedence note: rendered as a
 * STATIC, tier-scaled figure instead.
 *
 * Non-overlapping per-tier ranges (not a single scaled multiplier) so
 * "bigger tier -> more absurd score" is a HARD invariant — true for every
 * iso, not just on average: tier 1 always lands below tier 2, which always
 * lands below tier 3. `fnv1a32('altmetric:'+iso)` picks the offset within
 * the tier's own band, so the score still varies day to day.
 */
const ALTMETRIC_SCORE_RANGE_BY_TIER: Record<EgregiousnessTier, [number, number]> = {
  1: [40, 90], // "a modest amount of notice" -- still sincere, not yet absurd
  2: [300, 900], // picked up by the aggregators
  3: [9000, 9999], // "went viral"
};

export function altmetricScore(iso: string, tier: EgregiousnessTier): number {
  const [min, max] = ALTMETRIC_SCORE_RANGE_BY_TIER[tier];
  const span = max - min;
  const offset = fnv1a32(`altmetric:${iso}`) % (span + 1);
  return min + offset;
}

/**
 * The companion percentile line (the joke escalates the OTHER direction: a
 * SMALLER top-N% reads as more impressive). Same non-overlapping-ranges
 * technique as `altmetricScore`, descending by tier, bottoming out at the
 * controller-suggested "Top 1%" territory for tier 3.
 */
const ALTMETRIC_PERCENTILE_RANGE_BY_TIER: Record<EgregiousnessTier, [number, number]> = {
  1: [50, 80], // "top 50-80%" reads as faint praise, deliberately unremarkable
  2: [15, 40],
  3: [1, 5], // "Top 1% of all research outputs, all time"
};

export function altmetricPercentile(iso: string, tier: EgregiousnessTier): number {
  const [min, max] = ALTMETRIC_PERCENTILE_RANGE_BY_TIER[tier];
  const span = max - min;
  const offset = fnv1a32(`altmetric-pct:${iso}`) % (span + 1);
  return min + offset;
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
 * The salt marker a caller appends to `iso` when it wants a SECOND, usually
 * distinct blurb for the same day (Published's 2nd press card, `${iso}#2`, and
 * its tier-3 chyron, `${iso}#chyron`). Salting the seed argument was already
 * the house idiom — it is how the callers avoid this function growing a
 * bespoke "exclude" parameter — and T39a promotes it from a seeding trick to
 * a documented part of the contract, because pickPress now has to tell the
 * day's FIRST pick from its follow-ups (see below).
 *
 * Unambiguous by construction: `isoFromPuzzleNumber` emits `YYYY-MM-DD` and a
 * calendar date has no '#' in it, so `iso.includes(PRESS_SALT_MARKER)` is
 * exactly "this is a follow-up pick", never a false positive on a real date.
 */
export const PRESS_SALT_MARKER = '#';

/**
 * Press picker (T6 review adoption; T39a guarantee).
 *
 * THE T39a GUARANTEE. Owner directive from play-testing: "Can we do the
 * 'simulated press' page a bit more game-dependent? so at least some of the
 * news are related to the research question of the game." Every scenario now
 * ships at least one scenario-bound blurb (src/content/en/index.ts), and the
 * guarantee lives HERE rather than at the call sites: whenever the bank holds
 * a blurb bound to today's scenario at today's tier, the day's FIRST pick — the
 * unsalted one, Published's first press card — is one of them. The call sites
 * pass the scenarioId already and need no change.
 *
 * WHY THE FOLLOW-UPS INVERT THE PREFERENCE. Before T39a only two scenarios had
 * bound blurbs, so "both picks prefer the bound pool" was harmless: the
 * pool-of-one collision the second card could land in was rare enough for
 * Published.tsx's own comment to wave at ("harmless on the rare pool-of-one
 * day"). With every scenario bound, that rare case becomes the COMMON case —
 * the same blurb printed two or three times on the same screen, every day.
 * So a follow-up pick (a salted `iso`) prefers the scenario-AGNOSTIC pool
 * instead, which turns a probabilistic near-collision into a structural
 * distinction: card 1 names the study, cards 2/3 give it generic coverage.
 *
 * Each preference is a preference, not a filter: either side falls back to the
 * other when its own pool is empty, so a tier with no bound blurb for today
 * still yields a first card, and a hypothetical tier with no agnostic blurb
 * still yields a follow-up. What NEVER happens either way is a blurb bound to a
 * DIFFERENT scenario leaking in — that is exactly what PressBlurb.scenarioIds
 * exists to prevent (see src/content/types.ts: "a fern chyron could run over a
 * sourdough study"), and neither branch ever reaches for one.
 *
 * Still a pure, deterministic function of its four arguments: same
 * (bank, tier, scenarioId, iso) always yields the same blurb, via
 * `fnv1a32(iso + tier)`.
 */
export function pickPress(press: PressBlurb[], tier: EgregiousnessTier, scenarioId: string, iso: string): PressBlurb {
  const tierMatched = press.filter((p) => p.tier === tier);
  const bound = tierMatched.filter((p) => p.scenarioIds?.includes(scenarioId));
  const agnostic = tierMatched.filter((p) => !p.scenarioIds || p.scenarioIds.length === 0);
  const isFollowUp = iso.includes(PRESS_SALT_MARKER);
  const preferred = isFollowUp ? agnostic : bound;
  const fallback = isFollowUp ? bound : agnostic;
  const pool = preferred.length > 0 ? preferred : fallback;
  // Defensive backstop (content guarantees every tier has >=1 agnostic
  // blurb): widen rather than crash if some future edit ever left a tier
  // with neither a bound nor an agnostic entry for this scenario.
  const safePool = pool.length > 0 ? pool : tierMatched.length > 0 ? tierMatched : press;
  const idx = fnv1a32(iso + String(tier)) % safePool.length;
  return safePool[idx];
}
