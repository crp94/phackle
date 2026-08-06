// Pure, framework-free selection logic behind the PUBLISHED screen (T15;
// master spec §2.5/§4.3/§4.4). No React, no store access — everything here
// is a plain function of its arguments, unit-tested directly in
// tests/game/published.test.ts, and called by src/ui/screens/Published.tsx.
import { fnv1a32 } from '../engine/prng';
import { LAB_DEFAULT_SPEC } from '../engine/day';
import { JOURNALS } from '../content/journals';
import type { PressBlurb } from '../content/types';
import type { Spec } from '../engine/types';
import { TIER_FORKS, TIER_MOVES } from './tuning';

export type EgregiousnessTier = 1 | 2 | 3;

/**
 * tuning.TIER_FORKS: `forks <= polite` -> tier 1 ("polite acceptance
 * letter"); `forks >= editorsPick` -> tier 3 ("Editor's Pick"); otherwise
 * tier 2. Reads the live tuning constants (never retypes their values) so a
 * future tuning change can't silently drift out of sync with this function.
 *
 * @deprecated GR6 RULING §1(h) REPLACES THIS RULE with
 * `egregiousnessTierFromSpec` below. This function still ships, and is still
 * tested, only because its ONE call site is `src/ui/screens/Published.tsx`,
 * which W11 was scoped out of (the wave owns the engine, tuning, the
 * calibration script and the data; another wave was live in the screens at the
 * same time). The adoption is two lines and is BOOKED, not optional — see
 * `egregiousnessTierFromSpec`'s own comment for the exact patch. Delete this
 * function, `TIER_FORKS`, and this file's `forks` import in the same commit
 * that lands it.
 */
export function egregiousnessTier(forks: number): EgregiousnessTier {
  if (forks <= TIER_FORKS.polite) return 1;
  if (forks >= TIER_FORKS.editorsPick) return 3;
  return 2;
}

/**
 * §1(h)'s "distance from the default spec": how many of the four moves a
 * methods section would have to confess are switched on in `spec` — a
 * one-tailed test, a subgroup restriction, an outlier exclusion, a transform.
 *
 * WHY THESE FOUR AND NOT SIX. The two axes left out are the two that leave no
 * mark on the paper:
 *  - OUTCOME. Publishing Y3 instead of Y1 is a hack, but it is the SEARCH that
 *    was hacky, not the write-up: a straight regression on one outcome reads
 *    identically however many outcomes were tried first, and the reader cannot
 *    see the others. That move is priced by §2.8's parsimony row, which since
 *    §1(f) charges per distinct outcome family the player looked at — so the
 *    two rows divide the work rather than double-count it: parsimony prices
 *    what was SEARCHED, the tier prices what was PUBLISHED.
 *  - COVARIATES. Adjusting for income and risk is the one move here that is
 *    ordinary good practice (it is in the canonical spec, day.ts), and the
 *    default spec has both switched OFF — so counting them would award
 *    egregiousness for doing the honest thing.
 *
 * Read against `LAB_DEFAULT_SPEC`'s own values via the engine's copy of the
 * default (day.ts), never against retyped literals: "distance from the
 * default" has to move if the default ever does.
 */
export function hackingMoves(spec: Spec): number {
  let moves = 0;
  if (spec.tails !== LAB_DEFAULT_SPEC.tails) moves++;
  if (spec.subgroup !== LAB_DEFAULT_SPEC.subgroup) moves++;
  if (spec.exclusion !== LAB_DEFAULT_SPEC.exclusion) moves++;
  if (spec.transform !== LAB_DEFAULT_SPEC.transform) moves++;
  return moves;
}

/**
 * THE §1(h) TIER RULE: `hackingMoves(published) <= TIER_MOVES.polite` -> tier 1,
 * `>= TIER_MOVES.editorsPick` -> tier 3, otherwise tier 2. A day with no
 * published spec cannot have escalated anything, so it is tier 1 — the same
 * answer the fork rule gave for a player who never forked, and unreachable in
 * the app anyway (this screen only renders after a publish).
 *
 * THE ADOPTION THIS FUNCTION IS WAITING ON (booked to whoever next owns
 * `src/ui/screens/Published.tsx`; W11 was scoped out of `src/ui/**`):
 *
 *     -  const tier = egregiousnessTier(forks);
 *     +  const tier = egregiousnessTierFromSpec(result?.spec ?? null);
 *
 * `result` is already read there (its `beta` feeds `substituteEffect`) and
 * `PathResult` carries the spec it was run for, so nothing new has to be
 * plumbed and the `forks` selector on line ~176 becomes dead with it. Until
 * that lands, the shipped screen still uses the fork rule and gr2-018 is
 * measured-but-unfixed on the live tier; the rule below, its constants and its
 * tests are ready, and this file is the only thing the patch needs.
 */
export function egregiousnessTierFromSpec(published: Spec | null): EgregiousnessTier {
  if (published === null) return 1;
  const moves = hackingMoves(published);
  if (moves <= TIER_MOVES.polite) return 1;
  if (moves >= TIER_MOVES.editorsPick) return 3;
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
 * The magnitude `{effect}` prints, as a string that is TRUE at the scale it is
 * given: whole numbers at or above 1 (24.6 -> "25", T6's rounding rule,
 * unchanged), two significant figures below it (0.043 -> "0.043", 0.5 -> "0.5").
 *
 * THE FLOOR THIS REPLACES, AND WHY NEITHER OF THE OBVIOUS MOVES WAS TAKEN
 * (booked to W11 by W3's review, with w3-r-011's re-measured attribution).
 *
 * The rule here was `Math.max(1, Math.round(Math.abs(beta)))`. Measured over 20
 * consecutive days from EPOCH, all 1,792 specs at both windows: 71,680 of
 * 71,680 valid paths printed "1" — 69,336 of them (96.7%) lifted there by the
 * floor from a rounding of 0, and 2,344 (3.3%) rounding to 1 unaided. Median
 * |beta| runs 0.04 to 0.08.
 *
 *  - KEEPING THE FLOOR was not an option: it prints "1" for a measured 0.04.
 *    On the largest string of the celebration screen, in a game whose whole
 *    subject is numbers that are not what they are presented as, that is the
 *    one lie this codebase cannot ship — and it is dormant rather than gone,
 *    since it fires again the moment any author re-adds a token.
 *  - DELETING THE FLOOR was the move W3's review explicitly warned against:
 *    96.7% of paths round to 0, so "1 Minutes" would become "0 Minutes".
 *
 * Both are symptoms of the same defect, and neither is the floor: the rule
 * ROUNDED A 0.0x QUANTITY TO AN INTEGER. Formatting it at its own scale is
 * true at every magnitude — "0.04" is exactly what the regression found — and
 * it prints "0" only when beta really is 0.
 *
 * WHAT THIS DOES NOT FIX, deliberately. gr3-001's deeper finding stands: the
 * frame is fixed per scenario ("... Minutes Longer") while the number comes
 * from whichever of the four outcomes — and under whichever transform — the
 * player published, so a log1p coefficient can be printed as minutes and a
 * 1-10 self-rating as euros. No formatter can fix that; only a unit-free
 * effect can (gr3-001's percentage-of-control-mean alternative). So the token
 * stays RETIRED from all 20 scenarios in all three locales, the retirement
 * condition in tests/content/shape.test.ts is unchanged and still names the
 * unit-free expression AND the independent "1 Minutes" plural trap as its two
 * prerequisites, and this function keeps being a no-op on every shipped
 * headline. What changed is only that the code no longer contains a rule that
 * manufactures a false number if the token ever comes back.
 */
function formatEffectMagnitude(beta: number): string {
  const magnitude = Math.abs(beta);
  if (magnitude >= 1) return String(Math.round(magnitude));
  if (magnitude === 0) return '0';
  // Two significant figures, however small: 0.043, 0.0075, 0.00061. Capped at
  // six decimals so a pathologically tiny beta degrades to "0" rather than to
  // toPrecision's exponential form, which no headline frame could carry.
  const decimals = Math.min(6, 1 - Math.floor(Math.log10(magnitude)));
  return magnitude.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * T6 ruling (controller pin): substitutes the headline's optional `{effect}`
 * token with the published spec's effect magnitude — `Math.abs` because the
 * headline's own wording carries the direction ("Faster", "Higher Returns"),
 * formatted by `formatEffectMagnitude` above (READ ITS COMMENT: it carries the
 * GR6 ruling on the floor that used to live on this line). A headline with no
 * token (content: legal, no rule requires one, and as of GR6 no shipped
 * headline has one) is returned unchanged — `.replace` is a no-op when there's
 * nothing to match. At most one token ever appears (shape-tested in
 * tests/content/shape.test.ts), so a single non-global replace is exact.
 */
export function substituteEffect(headline: string, beta: number): string {
  return headline.replace('{effect}', formatEffectMagnitude(beta));
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
