// Master spec §2.7 (REVEAL — the verdict stamp and the accounting paragraph),
// §3.7 (reveal metrics + the P(>=1 hit | k explored) lookup table), §6
// (RevealMetrics). The engine's last step: turn one finished day (the puzzle,
// its enumerated specification curve, and what the player actually did) into
// the numbers Act II reads out loud.
//
// Nothing here re-runs a regression: `curve` arrives already enumerated (T8's
// enumerateCurve) and every count below is a pass over it. §2.7.3 pins the
// chance line as "computed exactly from the enumerated curve" — never
// estimated, never re-derived analytically.
//
// Determinism (§3.1): pure functions of the arguments plus two module
// constants (the DGP constant vector and the checked-in p_hit table). No
// Math.random, no wall clock, no mutable module state — the checksum guard
// below deliberately recomputes on every call rather than memoizing a
// "already validated" flag, so this module has no state at all to get out of
// sync (the cost is one fnv1a32 over a ~700-char string, once per reveal).

import {
  AGE_BASE,
  AGE_L1_COEF,
  AGE_MAX,
  AGE_MIN,
  AR1_RHO,
  INCOME_BASE,
  INCOME_L4_COEF,
  LATENT_DIM,
  RHO_SHARED,
  RISK_BASE,
  RISK_L5_COEF,
  RISK_MAX,
  RISK_MIN,
  TERTILE_Z,
  TREATMENT_EPS_COEF,
  TREATMENT_L1_COEF,
  TREATMENT_L4_COEF,
  URBAN_L1_COEF,
  Y1_LOADINGS,
  Y2_LOADINGS,
  Y3_LOADINGS,
  Y4_LOADINGS,
} from './dgpConstants';
import type { GeneratedDay } from './day';
import { fnv1a32 } from './prng';
import type { CurvePoint } from './specGrid';
import { AXES, specKey } from './specGrid';
import type { DayType, Outcome, RevealMetrics, Spec } from './types';
import { EFFECT_D_RANGE, HETERO_MULTIPLIER, HETERO_PROB_PCT, MIN_CELL, NULL_SIG_BAND } from '../game/tuning';
import pHitTableJson from '../data/p_hit_by_k.json';

// ---- verdict stamp (§2.7.4) ----

/**
 * The rubber stamp that slams onto the journal cover (§2.7.4):
 *  - nothing published (the player abandoned, §2.5) -> the honest pair, split
 *    BY DAY TYPE: a null day whose player reported nothing is a CONFIRMED_NULL
 *    and an effect day whose player reported nothing is a MISSED_DISCOVERY;
 *  - null day + published -> RETRACTED (the game's signature moment);
 *  - effect day + published on the TRUE outcome -> REPLICATED;
 *  - effect day + published on any OTHER outcome -> RETRACTED. This is the
 *    case §2.7.4 calls out explicitly: "you can fabricate a false positive on
 *    a true-effect day by publishing the wrong outcome".
 *
 * "The player's spec family actually captured it" is judged on the OUTCOME
 * alone (T10 brief: `published.outcome === trueOutcome`) — subgroup,
 * covariates, exclusion, transform and tails are all free. That is the honest
 * reading of "family": the day's truth is "an effect on outcome j*, and only
 * that outcome" (§2.7.1), so any analysis of j* has captured a real effect,
 * however baroque the rest of its recipe.
 *
 * `trueOutcome === null` on an effect day cannot happen for a puzzle built by
 * day.ts (assemblePuzzle always sets trueOutcome on effect days), but the
 * signature admits it, so it is resolved explicitly rather than left to a
 * `undefined === undefined` accident: with no true outcome recorded there is
 * nothing to have captured, so the claim is RETRACTED.
 *
 * §1(j)(2) — WHY THE HONEST VERDICT IS TWO VERDICTS (owner ruling 2026-08-06,
 * "BOTH"). This returned a single `NULL_REPORTED` for every unpublished day,
 * so a player who reported a null could not reach a positive verdict even
 * when they were right and the game was paying them 80 points for it (§2.8's
 * `abandonNull`). Two nameable outcomes were collapsed into one grey stamp:
 * abandoning an effect day is a missed discovery, abandoning a null day is a
 * confirmed null, and only the second is an achievement. The score already
 * knew the difference — `scoreDay` pays 80 for one and 20 for the other — so
 * the stamp was the one surface still telling the honest player that being
 * right and being wrong came to the same thing.
 *
 * NO NEW INPUT. `dayType` was already the first parameter; the split reads a
 * fact this function has always had, in a branch it always had.
 *
 * NOT A SPOILER CHANNEL. The stamp is Act II, and Act II has already printed
 * the day's truth (`reveal.truthEffect`/`truthNull`) two blocks above it. It
 * never enters `shareString` — see that module's header for why day type has
 * no channel into the share grid at all — and the 300-draw property test
 * still holds byte-for-byte.
 */
export function verdictStamp(
  dayType: DayType,
  published: Spec | null,
  trueOutcome: Outcome | null,
): RevealMetrics['stamp'] {
  // WRITTEN OUT HERE RATHER THAN CALLED. `game/verdict.ts`'s `honestStampFor`
  // is the same one-line rule, and store.ts's prereg correction reads it —
  // but the compiled layering law (eslint's no-restricted-imports on
  // src/engine/**) allows this module exactly two outside dependencies,
  // game/tuning.ts and the checksum-guarded tables in src/data, and importing
  // a game helper here would breach it. Pulling this module the other way, so
  // store.ts imported the engine's copy, is worse: reveal.ts carries the DGP
  // constants and the p_hit table, which is why the engine lives in a worker.
  //
  // Two sites, one ternary, and the agreement is COMPILED rather than
  // trusted: tests/game/verdict.test.ts drives this function on both day
  // types and asserts it returns exactly what `honestStampFor` does, so the
  // two cannot drift without a red test.
  if (published === null) return dayType === 'effect' ? 'MISSED_DISCOVERY' : 'CONFIRMED_NULL';
  if (dayType !== 'effect') return 'RETRACTED';
  if (trueOutcome === null) return 'RETRACTED';
  return published.outcome === trueOutcome ? 'REPLICATED' : 'RETRACTED';
}

// ---- P(>=1 hit | k explored) lookup table (§3.7) ----

/** The table's largest k. Beyond this the reveal reports the k=40 value (a
 * player who explored 60 paths is, for this sentence's purposes, in the same
 * place as one who explored 40 — the curve is flat and ~1 by then). */
export const P_HIT_MAX_K = 40;

/**
 * The shape of `src/data/p_hit_by_k.json`.
 *
 * TWO VECTORS, one per day type (gr6-002). The table used to be a single
 * `pHit` built from ACCEPTED NULL DAYS ONLY (`simulate_calibration.ts` iterates
 * `nullDays`), and `buildRevealMetrics` quoted it on every day — so an effect
 * day's accounting read out a null day's number. In the SHIPPED table the gap
 * at the commonest k is a factor of 2.72 (k = 5: pHitNull 0.2256 against
 * pHitEffect 0.6136), which is not a rounding difference in a sentence the
 * reveal reads out loud as a headline percentage.
 *
 * (w1-r-006: this comment used to quote 0.514 / 2.3x. That is GR1a's original
 * figure, measured over UNCONDITIONED effect draws; the shipped vector is
 * simulated on ACCEPTED days — the population a player is actually served — and
 * comes out higher. A doc comment must quote the number in the file it
 * documents, so the backlog's "51% at k=5" is superseded by 61.4%.)
 *
 * EXPORTED DELIBERATELY (gr6-098), not by oversight: it is the parameter type
 * of `assertPHitTable` below, which is itself exported so a startup path or a
 * test can assert a table it constructed. Without this type in the public
 * surface that argument cannot be named from outside this module. It has no
 * other consumer, and that is the whole reason it is here.
 */
export interface PHitTable {
  checksum: number;
  /** P(>=1 hit within k) on ACCEPTED NULL days. */
  pHitNull: number[];
  /** P(>=1 hit within k) on ACCEPTED EFFECT days. */
  pHitEffect: number[];
}

const TABLE = pHitTableJson as PHitTable;

/**
 * The exact vector the p_hit table's freshness checksum is computed over.
 * Serialization order is this object literal's own key order (every key is a
 * non-numeric string, so JSON.stringify never reorders them).
 *
 * Membership rule, so a future editor can tell at a glance whether a new
 * constant belongs here: **every exported constant of
 * src/engine/dgpConstants.ts (in that file's declaration order), plus the
 * §3.9 tuning knobs that change what a "null day" or a "path" even is.** The
 * T10 brief pins the first group's core (R's rho, all loadings/noise scales,
 * RHO_SHARED, the treatment coefficients, EFFECT_D_RANGE, the HETERO
 * constants); the covariate constructions are included too because they
 * decide subgroup membership and therefore every subgroup spec's sample.
 *
 * The four trailing entries go beyond the brief's list on purpose, because
 * each one demonstrably invalidates a table generated before it changed:
 *  - NULL_SIG_BAND: the table is built from ACCEPTED null days, and this band
 *    is exactly the acceptance filter (§3.3). It is also the TUNABLE the
 *    calibration suite is most likely to move (§3.9: "Calibrate via §8.3"),
 *    so leaving it out would let the single most likely edit ship a stale
 *    table silently.
 *  - MIN_CELL: decides which paths are `valid` at all, i.e. which count as
 *    hits.
 *  - pathSpaceSize: §3.9's tuning table says in so many words "Path-space
 *    size 1,792 — change only with p_hit table regen".
 * Deliberately NOT included: EPOCH, P_EFFECT_PCT, N_SCHEDULE, the scoring
 * constants, DEBOUNCE_MS, MAX_ATTEMPTS and TIER_FORKS — none of them can
 * change a null day's specification curve. (MAX_ATTEMPTS only decides how
 * long the acceptance loop keeps trying for the same band.)
 */
export function dgpConstantVector(): Record<string, number> {
  return {
    // --- src/engine/dgpConstants.ts, in file order ---
    ar1Rho: AR1_RHO,
    latentDim: LATENT_DIM,
    ageBase: AGE_BASE,
    ageL1Coef: AGE_L1_COEF,
    ageMin: AGE_MIN,
    ageMax: AGE_MAX,
    urbanL1Coef: URBAN_L1_COEF,
    incomeBase: INCOME_BASE,
    incomeL4Coef: INCOME_L4_COEF,
    riskBase: RISK_BASE,
    riskL5Coef: RISK_L5_COEF,
    riskMin: RISK_MIN,
    riskMax: RISK_MAX,
    tertileZ: TERTILE_Z,
    treatmentL1Coef: TREATMENT_L1_COEF,
    treatmentL4Coef: TREATMENT_L4_COEF,
    treatmentEpsCoef: TREATMENT_EPS_COEF,
    rhoShared: RHO_SHARED,
    y1L1: Y1_LOADINGS.l1,
    y1L4: Y1_LOADINGS.l4,
    y1L6: Y1_LOADINGS.l6,
    y1T5Scale: Y1_LOADINGS.t5Scale,
    y2LScale: Y2_LOADINGS.lScale,
    y2L1: Y2_LOADINGS.l1,
    y2L5: Y2_LOADINGS.l5,
    y2L6: Y2_LOADINGS.l6,
    y2ZScale: Y2_LOADINGS.zScale,
    y3Base: Y3_LOADINGS.base,
    y3L3: Y3_LOADINGS.l3,
    y3L4: Y3_LOADINGS.l4,
    y3L6: Y3_LOADINGS.l6,
    y3ZScale: Y3_LOADINGS.zScale,
    y4Base: Y4_LOADINGS.base,
    y4LScale: Y4_LOADINGS.lScale,
    y4L5: Y4_LOADINGS.l5,
    y4L6: Y4_LOADINGS.l6,
    y4ZScale: Y4_LOADINGS.zScale,
    y4Min: Y4_LOADINGS.min,
    y4Max: Y4_LOADINGS.max,
    // --- §3.9 knobs that decide what a null day / a path is ---
    effectDLo: EFFECT_D_RANGE[0],
    effectDHi: EFFECT_D_RANGE[1],
    heteroMultiplier: HETERO_MULTIPLIER,
    heteroProbPct: HETERO_PROB_PCT,
    nullSigBandLo: NULL_SIG_BAND[0],
    nullSigBandHi: NULL_SIG_BAND[1],
    minCell: MIN_CELL,
    pathSpaceSize:
      AXES.outcome.length *
      AXES.subgroup.length *
      AXES.covariates.length *
      AXES.exclusion.length *
      AXES.transform.length *
      AXES.tails.length,
  };
}

/** `fnv1a32(JSON.stringify(dgpConstantVector()))` — the value
 * `src/data/p_hit_by_k.json` carries so a table generated under a different
 * DGP can never be read as if it described this one (§3.7: "checksum of DGP
 * constants embedded in the JSON; engine asserts match at startup"). */
export function pHitTableChecksum(): number {
  return fnv1a32(JSON.stringify(dgpConstantVector()));
}

/**
 * Throws unless `table` was generated under the current DGP constants. Called
 * on every `pHitAtK`, and exported so an app-startup path (or a test) can
 * assert it directly.
 *
 * Note the direction of the dependency: this module reads the JSON, and
 * scripts/simulate_calibration.ts imports `pHitTableChecksum` from HERE to
 * stamp the file it writes. That is why validation is a function call rather
 * than a module-load-time assertion: a top-level `throw` would make a stale
 * table unregenerable (importing this module to compute the new checksum
 * would throw on the old one first — a bootstrap deadlock). Failing loudly at
 * the first read is early enough; nothing consumes the table before the
 * reveal.
 */
export function assertPHitTable(table: PHitTable): void {
  const expected = pHitTableChecksum();
  if (table.checksum !== expected) {
    throw new Error(
      `p_hit_by_k.json is stale: embedded DGP checksum ${table.checksum} != current ${expected}. ` +
        `The DGP constants (or a §3.9 knob that feeds them) changed since the table was simulated — ` +
        `regenerate it with \`npm run cal\` (scripts/simulate_calibration.ts).`,
    );
  }
  // Per vector, and naming the offender. The checksum cannot do this job: it
  // is fnv1a32 over the DGP constant vector, which knows nothing about how
  // many vectors the FILE carries — so a table half-regenerated under an older
  // shape would pass the freshness check and then read `undefined` at every k.
  for (const name of ['pHitNull', 'pHitEffect'] as const) {
    const vector = table[name];
    if (!Array.isArray(vector) || vector.length !== P_HIT_MAX_K + 1) {
      throw new Error(
        `p_hit_by_k.json has the wrong length for ${name}: ${Array.isArray(vector) ? vector.length : 'missing'}, ` +
          `expected ${P_HIT_MAX_K + 1} (index 0 unused, then k = 1..${P_HIT_MAX_K}). ` +
          `Regenerate it with \`npm run cal\`.`,
      );
    }
  }
}

/**
 * P(a random-order explorer hits at least one significant path within its
 * first `k`), read off the build-time simulation (§3.7), **on a day of type
 * `dayType`**. `k` is clamped into [1, P_HIT_MAX_K]; non-integers are floored
 * first.
 *
 * The `dayType` argument is gr6-002's fix and is deliberately REQUIRED rather
 * than defaulted: the old single-argument signature silently answered every
 * caller with the null-day vector, and a default would preserve exactly that
 * failure mode for the next caller who forgets.
 *
 * KNOWN APPROXIMATION (w1-r-005, informational, pre-existing and unchanged by
 * the two-vector split): both vectors are simulated at `CURVE_N = 200`
 * (scripts/simulate_calibration.ts), while the reveal enumerates its curve at
 * `state.n` — 250 to 400 once the player has peeked. A larger window makes hits
 * easier, so on a peeked day this lookup slightly understates. The single null
 * vector had exactly the same property; it is recorded here because W1 now owns
 * the line, not because the split introduced it. reveal.peekSurcharge is the
 * copy that addresses the same distortion from the other side.
 *
 * Deliberately a LOOKUP, never `1 - (1 - q)^k`: paths that share an outcome
 * column are strongly correlated, so the analytic form materially overstates
 * the hit rate (§3.7 says so in as many words). The table bakes the real
 * correlation in because it was simulated on real days.
 */
export function pHitAtK(k: number, dayType: DayType): number {
  assertPHitTable(TABLE);
  const clamped = Math.min(Math.max(Math.floor(k), 1), P_HIT_MAX_K);
  return (dayType === 'effect' ? TABLE.pHitEffect : TABLE.pHitNull)[clamped];
}

// ---- reveal metrics (§3.7, §6) ----

/** One plotted point in the reveal payload: §6's `RevealMetrics['curve']`
 * entry plus the full `spec`, which T16's SpecCurve needs to render the
 * published path's recipe callout and every point's hover tooltip. A
 * superset, so `RevealCurveEntry[]` stays assignable to §6's declared entry
 * type and `RevealMetricsFull` stays assignable to `RevealMetrics` (which is
 * what src/engine/protocol.ts's RevealPayload is typed against). */
export interface RevealCurveEntry {
  p: number;
  explored: boolean;
  published: boolean;
  outcome: Outcome;
  spec: Spec;
}

/**
 * §6's RevealMetrics with the richer curve entries (see RevealCurveEntry) and
 * the day-typed hit split gr6-001 needs.
 *
 * WHY THE SPLIT LIVES HERE AND NOT ON §6's `RevealMetrics`: the two counts are
 * a partition of `sigPaths`, and `sigPaths` is computed here against the p <
 * .05 threshold over VALID points only. §6's declared `curve` entries carry
 * neither the threshold nor the invalid points, so the split cannot be
 * re-derived downstream without re-declaring the significance rule in the view
 * layer — the one place it must never be duplicated. `src/engine/types.ts` is
 * not this wave's to edit, so the fields ride the same widening
 * `RevealPayload` already uses for `curve` (see Reveal.tsx's `RevealPayloadFull`);
 * hoisting them onto `RevealMetrics` is a two-line follow-up for whoever owns
 * that file next, and would need no change here.
 */
export interface RevealMetricsFull extends Omit<RevealMetrics, 'curve'> {
  curve: RevealCurveEntry[];
  /** Valid p < .05 paths whose outcome IS the day's true outcome. Always 0 on
   * a null day: there is no true outcome for a hit to be on. */
  sigTrueOutcome: number;
  /** Valid p < .05 paths on any OTHER outcome. `sigTrueOutcome +
   * sigOtherOutcome === sigPaths`, on every day type, by construction. */
  sigOtherOutcome: number;
}

/**
 * The Act II accounting (§2.7.3), computed exactly from this day's enumerated
 * curve:
 *
 *  - `totalPaths` — the size of the enumerated grid (1,792), INCLUDING points
 *    that turned out invalid. This is the denominator §2.7.3's copy quotes
 *    ("Of 1,792 possible analyses, 87 (4.9%)...") and the one T16's SpecCurve
 *    subtracts its plotted-point count from to footnote "n specs had
 *    insufficient data".
 *  - `sigPaths` / `sigFraction` — valid points with p < .05, over
 *    `totalPaths`. An invalid point is never a hit: `runSpec` returns p = 1
 *    for a singular fit, and a below-MIN_CELL cell is not an analysis anyone
 *    could have published.
 *  - `curve` — VALID points only (§3.4: sub-MIN_CELL specs "render
 *    'insufficient data' and are excluded from the curve"). The payload entry
 *    has no `valid` flag to filter on downstream, so the filtering has to
 *    happen here; the count of what was dropped stays recoverable as
 *    `totalPaths - curve.length`.
 *  - `explored` / `published` flags — matched by `specKey` VALUE, never by
 *    object identity: the specs the player's store recorded are separate
 *    objects from the ones `allSpecs()` built, and a worker round-trip
 *    (structuredClone, §5) guarantees they are never even the same instance.
 *  - `playerExplored` — the caller's list length, verbatim. The published
 *    spec is NOT implicitly added: the store (T12) owns fork accounting
 *    (§2.10) and hands over the authoritative list.
 *  - `sigTrueOutcome` / `sigOtherOutcome` — gr6-001's partition of `sigPaths`
 *    by whether the hit sits on the outcome the day declared real. One extra
 *    comparison in the loop below and no second enumeration: the true outcome
 *    is already in hand on `day.puzzle`, and `point.spec.outcome` is already
 *    being read to build the payload entry. On a null day `trueOutcome` is
 *    absent and every hit lands on the "other" side, which is the honest
 *    reading: none of them is on an outcome where something was real.
 *  - `pHitAtK` — the lookup at k = playerExplored (clamped), on THIS DAY'S
 *    vector (gr6-002), never the null-day one on an effect day.
 */
export function buildRevealMetrics(
  day: GeneratedDay,
  curve: CurvePoint[],
  published: Spec | null,
  explored: Spec[],
  peeks: number,
): RevealMetricsFull {
  const exploredKeys = new Set(explored.map(specKey));
  const publishedKey = published === null ? null : specKey(published);
  // `?? null` rather than a bare read: an effect day whose trueOutcome went
  // missing must count zero true-outcome hits, not compare against `undefined`
  // and accidentally match an outcome that is also undefined. Same discipline
  // verdictStamp already applies to the same field.
  const trueOutcome = day.puzzle.trueOutcome ?? null;

  const totalPaths = curve.length;
  let sigPaths = 0;
  let sigTrueOutcome = 0;
  const entries: RevealCurveEntry[] = [];

  for (const point of curve) {
    if (!point.valid) continue;
    if (point.p < 0.05) {
      sigPaths++;
      if (point.spec.outcome === trueOutcome) sigTrueOutcome++;
    }
    const key = specKey(point.spec);
    entries.push({
      p: point.p,
      explored: exploredKeys.has(key),
      published: publishedKey !== null && key === publishedKey,
      outcome: point.spec.outcome,
      spec: point.spec,
    });
  }

  return {
    totalPaths,
    sigPaths,
    sigFraction: totalPaths === 0 ? 0 : sigPaths / totalPaths,
    sigTrueOutcome,
    // Subtraction, not a second counter: the two are a PARTITION of sigPaths by
    // definition, and deriving one from the other makes that impossible to
    // break by editing one branch of the loop.
    sigOtherOutcome: sigPaths - sigTrueOutcome,
    playerExplored: explored.length,
    pHitAtK: pHitAtK(explored.length, day.puzzle.dayType),
    curve: entries,
    stamp: verdictStamp(day.puzzle.dayType, published, trueOutcome),
    peeks,
  };
}
