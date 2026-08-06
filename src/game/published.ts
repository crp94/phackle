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

/**
 * `10.1337/phk.{issue}` — master spec §7.3's fake DOI, exactly.
 *
 * gr6-021: the parameter is the issue LABEL, not the raw puzzle number. A
 * practice day has no issue number (see src/ui/masthead.ts's `issueLabel`,
 * which is what the one call site passes), and this used to print
 * `10.1337/phk.-3` on every pre-EPOCH day — a DOI with a negative registrant
 * suffix, on the one screen whose entire job is to be believed. The type is
 * widened rather than the practice flag being plumbed in here on purpose:
 * `src/game/**` must not import from `src/ui/**`, and the rule about what a
 * practice day prints belongs beside the masthead formula it also governs,
 * not duplicated in two modules.
 */
export function fakeDoi(issue: string | number): string {
  return `10.1337/phk.${issue}`;
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
 * The day's three press slots, in the order Published renders them, keyed by
 * the salt each one appends to `iso`. Position in this array IS the slot's
 * rotation offset within its pool (see pickPress) — which is what makes the
 * three items pairwise distinct by construction instead of by luck.
 *
 * Fix round 1 [M1]. The reviewer found that `fnv1a32`'s low bit is just the
 * input's byte parity, so two salted seeds of the same parity can never land on
 * opposite halves of an even-sized pool: card 1 and the chyron collided on
 * 17.9% of tier-3 days, and card 2 and the chyron on 0.0% — neither number
 * designed, both artifacts of how many characters "#2" and "#chyron" happen to
 * have. Mixing the hash better (below) removes the correlation but replaces one
 * artifact with honest independent draws, which still collide: measured, the
 * mixing alone moves the day's overall duplicate rate from 12.9% to 17.0%
 * (card 2 vs chyron 0.0% -> 16.5%). Independence is not the goal; DISTINCTNESS
 * is. Rotating each slot by its own index makes a same-pool collision
 * arithmetically impossible whenever the pool has room, measured at 0.0%.
 *
 * The cost, stated plainly: on a day where all three slots draw from the same
 * pool, they are three CONSECUTIVE pool entries rather than three independent
 * ones, so that day has `poolSize` possible presentations instead of
 * `poolSize³`. That trade is worth taking — which three of six generic chyrons
 * appear is imperceptible, whereas the same line printed twice on one screen is
 * the defect this whole mechanism exists to prevent.
 */
const PRESS_SLOT_SALTS = ['', `${PRESS_SALT_MARKER}2`, `${PRESS_SALT_MARKER}chyron`];

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
 * (bank, tier, scenarioId, iso) always yields the same blurb.
 *
 * SEEDING (fix round 1 [M1]). The day's hash is taken from the UNSALTED date,
 * so all three slots share one base draw, and the slot's own position in
 * PRESS_SLOT_SALTS rotates it. `fnv1a32` itself is left spec-verbatim
 * (Appendix A) — the extra `h ^ (h >>> 15)` avalanche happens here, at the
 * consumer, where a weak low bit actually matters. An unregistered salt still
 * works: it falls back to a hash-derived offset, which is best-effort variety
 * rather than a distinctness guarantee, and is documented as such.
 */
export function pickPress(press: PressBlurb[], tier: EgregiousnessTier, scenarioId: string, iso: string): PressBlurb {
  const cut = iso.indexOf(PRESS_SALT_MARKER);
  const isFollowUp = cut !== -1;
  const day = isFollowUp ? iso.slice(0, cut) : iso;
  const salt = isFollowUp ? iso.slice(cut) : '';
  const slot = PRESS_SLOT_SALTS.indexOf(salt);

  // An UNREGISTERED salt keeps its documented behaviour exactly: a
  // hash-derived offset, which is best-effort variety rather than a
  // distinctness guarantee. There is no slot pedigree to reconstruct for it,
  // so it also gets no dedup history — it is not one of the day's three
  // rendered slots.
  if (slot === -1) return resolveSlot(press, tier, scenarioId, day, fnv1a32(salt), isFollowUp, []);

  // gr6-064: a follow-up slot must know what the slots BEFORE it already put
  // on screen, and it can — every slot is a pure, deterministic function of
  // the same (press, tier, scenarioId, day), so the earlier ones are simply
  // recomputed here. At most two of them, both cheap. This is what lets the
  // outlet exclusion hold at each of the three existing four-argument call
  // sites without any of them growing an "exclude" parameter.
  const taken: PressBlurb[] = [];
  for (let earlier = 0; earlier < slot; earlier++) {
    taken.push(resolveSlot(press, tier, scenarioId, day, earlier, earlier !== 0, taken));
  }
  return resolveSlot(press, tier, scenarioId, day, slot, isFollowUp, taken);
}

/**
 * One slot's pick: choose the pool, hash the day into it, then walk forward
 * from that index past anything the earlier slots already used.
 *
 * WHY THE SCENARIO ID SALTS THE AGNOSTIC HASH (gr6-064). The day's hash was
 * `fnv1a32(day + tier)` for every pool, so the generic slots' index depended
 * on the DATE alone — two dates whose hashes land on the same residue produce
 * the identical generic pair for every scenario at that tier, which is how
 * GR2 caught the same two agnostic blurbs running on 2026-08-12 and
 * 2026-08-15. Folding the scenario id into the hash for the agnostic pool
 * only (the bound pool's draw is byte-for-byte unchanged, so T39a's
 * covered-by-name guarantee is untouched) decorrelates the twenty scenarios
 * from each other: a residue collision on the date now has to coincide with
 * the same scenario running again, which pushes the repetition out from
 * "somewhere in the same week" to the scenario cycle itself.
 *
 * WHY REJECT-AND-ADVANCE, NEVER RE-RANDOMISE. `(index + step) % pool.length`
 * walks the pool in its own fixed order from the slot's own rotated start, so
 * the result stays a pure function of the arguments and stays reproducible
 * from the date. A second hash on rejection would be neither.
 *
 * The two-tier preference — a new OUTLET if the pool has one, otherwise at
 * least a line nobody has printed yet — matters because the previous
 * distinctness guarantee was by TEXT. Two clippings could carry different
 * headlines under the same masthead, and on puzzle #11 they did: "NIGHTLY
 * CHYRON NETWORK" headed both cards on the day's payoff screen, against
 * R5.2's own stated reason for staggering their entrance ("coverage arrives
 * outlet by outlet, which is what coverage does").
 */
function resolveSlot(
  press: PressBlurb[],
  tier: EgregiousnessTier,
  scenarioId: string,
  day: string,
  offset: number,
  isFollowUp: boolean,
  taken: PressBlurb[]
): PressBlurb {
  const tierMatched = press.filter((p) => p.tier === tier);
  const bound = tierMatched.filter((p) => p.scenarioIds?.includes(scenarioId));
  const agnostic = tierMatched.filter((p) => !p.scenarioIds || p.scenarioIds.length === 0);
  const preferred = isFollowUp ? agnostic : bound;
  const fallback = isFollowUp ? bound : agnostic;
  const usedPreferred = preferred.length > 0;
  const pool = usedPreferred ? preferred : fallback;
  // Defensive backstop (content guarantees every tier has >=1 agnostic
  // blurb): widen rather than crash if some future edit ever left a tier
  // with neither a bound nor an agnostic entry for this scenario.
  const safePool = pool.length > 0 ? pool : tierMatched.length > 0 ? tierMatched : press;
  const drewAgnostic = safePool === agnostic;
  const h = fnv1a32(drewAgnostic ? `${day}${tier}|${scenarioId}` : day + String(tier));
  const index = (((h ^ (h >>> 15)) >>> 0) + offset) % safePool.length;

  if (taken.length === 0) return safePool[index];

  const usedOutlets = new Set(taken.map((b) => b.outlet));
  const usedTexts = new Set(taken.map((b) => b.text));
  let textDistinct: PressBlurb | null = null;
  for (let step = 0; step < safePool.length; step++) {
    const candidate = safePool[(index + step) % safePool.length];
    if (usedTexts.has(candidate.text)) continue;
    if (!usedOutlets.has(candidate.outlet)) return candidate;
    textDistinct ??= candidate;
  }
  // Every outlet in this pool is already on screen. Prefer at least an unseen
  // LINE; if even that is impossible the pool is smaller than the number of
  // slots, and a repeat is the content's shortage, not the picker's.
  return textDistinct ?? safePool[index];
}

/**
 * THE DAY'S PRESS, assembled exactly as the Published screen renders it
 * (gr6-091): two cards at the day's tier, plus a tier-3-only chyron.
 *
 * The three seeds used to live at three call sites in `screens/Published.tsx`
 * and were mirrored, by hand, in a test helper — with a `readFileSync`
 * regex-over-source scan standing guard over the mirror. That scan was the one
 * test in this suite that broke on an innocent rename, and it tested a
 * SPELLING rather than a behaviour. One audited function replaces both: the
 * seeds are stated once, here, and every property the picker owes the screen
 * (bound first card, generic follow-ups, pairwise-distinct items, distinct
 * outlets, whole-bank reachability) is asserted against THIS function's real
 * output.
 *
 * This is also the prerequisite the 60-cell press matrix work is sequenced
 * behind: a new bank needs exactly one picker to be audited against.
 */
export function pressForDay(
  press: PressBlurb[],
  tier: EgregiousnessTier,
  scenarioId: string,
  iso: string
): PressBlurb[] {
  const cards = [
    pickPress(press, tier, scenarioId, `${iso}${PRESS_SLOT_SALTS[0]}`),
    pickPress(press, tier, scenarioId, `${iso}${PRESS_SLOT_SALTS[1]}`),
  ];
  if (tier === 3) cards.push(pickPress(press, 3, scenarioId, `${iso}${PRESS_SLOT_SALTS[2]}`));
  return cards;
}
