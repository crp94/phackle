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
 *  - nothing published (the player abandoned, §2.5) -> NULL_REPORTED, on
 *    either day type: there is no claim to retract or replicate;
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
 */
export function verdictStamp(
  dayType: DayType,
  published: Spec | null,
  trueOutcome: Outcome | null,
): RevealMetrics['stamp'] {
  if (published === null) return 'NULL_REPORTED';
  if (dayType !== 'effect') return 'RETRACTED';
  if (trueOutcome === null) return 'RETRACTED';
  return published.outcome === trueOutcome ? 'REPLICATED' : 'RETRACTED';
}

// ---- P(>=1 hit | k explored) lookup table (§3.7) ----

/** The table's largest k. Beyond this the reveal reports the k=40 value (a
 * player who explored 60 paths is, for this sentence's purposes, in the same
 * place as one who explored 40 — the curve is flat and ~1 by then). */
export const P_HIT_MAX_K = 40;

export interface PHitTable {
  checksum: number;
  pHit: number[];
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
  if (table.pHit.length !== P_HIT_MAX_K + 1) {
    throw new Error(
      `p_hit_by_k.json has the wrong length: ${table.pHit.length}, expected ${P_HIT_MAX_K + 1} ` +
        `(index 0 unused, then k = 1..${P_HIT_MAX_K}). Regenerate it with \`npm run cal\`.`,
    );
  }
}

/**
 * P(a random-order explorer hits at least one significant path within its
 * first `k`), read off the build-time simulation (§3.7). `k` is clamped into
 * [1, P_HIT_MAX_K]; non-integers are floored first.
 *
 * Deliberately a LOOKUP, never `1 - (1 - q)^k`: paths that share an outcome
 * column are strongly correlated, so the analytic form materially overstates
 * the hit rate (§3.7 says so in as many words). The table bakes the real
 * correlation in because it was simulated on real days.
 */
export function pHitAtK(k: number): number {
  assertPHitTable(TABLE);
  const clamped = Math.min(Math.max(Math.floor(k), 1), P_HIT_MAX_K);
  return TABLE.pHit[clamped];
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

/** §6's RevealMetrics with the richer curve entries (see RevealCurveEntry). */
export interface RevealMetricsFull extends Omit<RevealMetrics, 'curve'> {
  curve: RevealCurveEntry[];
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
 *  - `pHitAtK` — the lookup at k = playerExplored (clamped, see pHitAtK).
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

  const totalPaths = curve.length;
  let sigPaths = 0;
  const entries: RevealCurveEntry[] = [];

  for (const point of curve) {
    if (!point.valid) continue;
    if (point.p < 0.05) sigPaths++;
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
    playerExplored: explored.length,
    pHitAtK: pHitAtK(explored.length),
    curve: entries,
    stamp: verdictStamp(day.puzzle.dayType, published, day.puzzle.trueOutcome ?? null),
    peeks,
  };
}
