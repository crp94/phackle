// Master spec §3.6 (specification-curve enumeration) + §7.4 (SpecCurve
// component -- CurvePoint needs). Exhaustively enumerates the 1,792 specs
// (4 outcome x 7 subgroup x 4 covariates x 4 exclusion x 2 transform x 2
// tails) the reveal's "Figure 1" plots, at a given player window N.
//
// enumerateCurve is built for *exact* parity with analyze.ts's per-spec
// runSpec: every intermediate below is produced by calling the SAME pure,
// already-tested helpers (subgroupMask, applyTransform, zScores, ols,
// tTwoTailedP) with the SAME inputs, in the SAME order, that runSpec uses
// internally for a single spec -- just shared across the many specs that
// happen to agree on a prefix of the pipeline (subgroup -> outcome's raw Y
// -> transform -> z-scores -> exclusion -> covariates -> OLS -> tails-only
// p conversion), per §3.6's "~112 preps x cheap regressions" memoization
// idea, instead of recomputing that shared prefix from scratch per spec.
// Because every one of those helpers is a pure function of its arguments
// (no hidden state, no randomness), caching and reusing an intermediate
// across multiple specs can never change the floating-point value any
// single spec would have produced on its own: same inputs, same function,
// same output, whether computed once and reused or recomputed from scratch
// each time (see tests/engine/specGrid.test.ts's direct runSpec-equality
// checks, and the T8 report's self-review section, for the full argument).
//
// Determinism (§3.1): the only arithmetic this file performs directly is
// array-index bookkeeping (+,-,*,/ on plain integers) and string-key
// concatenation for the memoization maps -- every floating point number
// that ends up in a CurvePoint flows through the reused engine helpers,
// none of which use Math.pow, Math.random, Date.now, or new Date.

import { EXCLUSION_THRESHOLD, applyTransform, subgroupMask } from './analyze';
import type { Dataset } from './dgp';
import type { OlsResult } from './stats';
import { ols, tTwoTailedP, zScores } from './stats';
import { MIN_CELL } from '../game/tuning';
import type { Outcome, Spec, WindowN } from './types';

/**
 * The six enumeration axes, in the exact major-to-minor order `allSpecs`/
 * `enumerateCurve` iterate them: outcome changes slowest, tails fastest.
 * Sizes 4*7*4*4*2*2 = 1,792 (the full path space, §3.6).
 *
 * Value orders within outcome/subgroup/exclusion/transform/tails match the
 * corresponding `Spec` field's declared union order (src/engine/types.ts) --
 * the same order analyze.ts and its tests already use, so this isn't a new
 * convention. `covariates` has no such pinned union (it's a `{income,risk}`
 * record, not a string literal union); its four entries are ordered as a
 * 2-bit binary count with income as the high bit -- (0,0),(0,1),(1,0),(1,1)
 * -- matching `specKey`'s income-digit-then-risk-digit reading below.
 */
export const AXES: {
  outcome: Outcome[];
  subgroup: Spec['subgroup'][];
  covariates: Spec['covariates'][];
  exclusion: Spec['exclusion'][];
  transform: Spec['transform'][];
  tails: Spec['tails'][];
} = {
  outcome: [0, 1, 2, 3],
  subgroup: ['all', 'age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'],
  covariates: [
    { income: false, risk: false },
    { income: false, risk: true },
    { income: true, risk: false },
    { income: true, risk: true },
  ],
  exclusion: ['none', 'z3', 'z2_5', 'z2'],
  transform: ['raw', 'log1p'],
  tails: ['two', 'one'],
};

/** One point on the specification curve (§7.4): just enough for the plot
 * and the significance count. The richer per-path detail (`beta`/`se`/`ci`/
 * `n`/`excludedCount`) lives on `PathResult` (analyze.ts's single-spec
 * result, used for the player's own explored/published paths) -- recomputing
 * and carrying all of that for every one of 1,792 curve points would be
 * pure waste when the curve only ever plots/counts by `p` and `valid`. */
export interface CurvePoint {
  spec: Spec;
  p: number;
  valid: boolean;
}

/** Visits all 1,792 specs in fixed, outcome-major/tails-minor order (mirrors
 * `AXES`'s own field order exactly: outcome > subgroup > covariates >
 * exclusion > transform > tails). `allSpecs` and `enumerateCurve` both
 * delegate to this single traversal, so their orders can never drift apart
 * from each other. */
function forEachSpec(visit: (spec: Spec) => void): void {
  for (const outcome of AXES.outcome) {
    for (const subgroup of AXES.subgroup) {
      for (const covariates of AXES.covariates) {
        for (const exclusion of AXES.exclusion) {
          for (const transform of AXES.transform) {
            for (const tails of AXES.tails) {
              visit({ outcome, subgroup, covariates, exclusion, transform, tails });
            }
          }
        }
      }
    }
  }
}

/** All 1,792 specs, fixed order (see `forEachSpec`). */
export function allSpecs(): Spec[] {
  const specs: Spec[] = [];
  forEachSpec((spec) => specs.push(spec));
  return specs;
}

/** Canonical short key for a spec, e.g. `"2|urban|10|z2_5|log1p|one"`
 * (outcome=2, subgroup=urban, income=1/risk=0, z2_5 exclusion, log1p
 * transform, one-tailed). Every field is represented verbatim except
 * covariates, packed as its two 0/1 digits (income digit, then risk digit)
 * -- unique across all 1,792 specs, since the six inputs are exactly the
 * cartesian product `allSpecs` enumerates. */
export function specKey(s: Spec): string {
  const income = s.covariates.income ? 1 : 0;
  const risk = s.covariates.risk ? 1 : 0;
  return `${s.outcome}|${s.subgroup}|${income}${risk}|${s.exclusion}|${s.transform}|${s.tails}`;
}

/** `valid && p < .05` count -- the reveal's "chance line" numerator (§3.7). */
export function sigCount(curve: CurvePoint[]): number {
  let count = 0;
  for (const point of curve) {
    if (point.valid && point.p < 0.05) count++;
  }
  return count;
}

/** The one OLS fit shared by both tails variants of a given (outcome,
 * subgroup, transform, exclusion, covariates) combination, plus its
 * precomputed two-tailed p (`p2`) and the post-exclusion row count
 * (`finalN`) -- everything a spec needs beyond its own `tails` value. `p2`
 * is meaningless when `fit.valid` is false (never read in that case, same
 * as runSpec's own `else { p = 1; ... }` branch never computing one). */
interface FitPrep {
  fit: OlsResult;
  p2: number;
  finalN: number;
}

/**
 * Runs all 1,792 specs against dataset `d` at window `n`, in `allSpecs()`
 * order. For any single spec, `{p, valid}` here is EXACTLY (bit-for-bit)
 * what `analyze.runSpec(d, spec, n)` returns for that same spec -- see the
 * file header for why sharing intermediates can't change that value.
 *
 * Memoization (§3.6), mirroring runSpec's own pipeline order (filter ->
 * transform -> z-score -> exclude -> [covariates] -> OLS -> [tails]):
 *  - subgroup mask / filtered-index list: memoized per subgroup (7 entries).
 *  - raw (filtered, untransformed) outcome column: per (outcome, subgroup)
 *    -- 28 entries.
 *  - transformed column + its z-scores: per (outcome, subgroup, transform)
 *    -- 56 entries each. (z-scores are computed once per that triple and
 *    reused by all three non-'none' exclusion thresholds -- zScores is a
 *    pure function of the transformed column alone, so which threshold is
 *    later compared against it can't change the z-scores themselves.)
 *  - the kept/excluded index set: per (outcome, subgroup, transform,
 *    exclusion) -- 224 entries.
 *  - the OLS fit (+ its precomputed two-tailed p): per (outcome, subgroup,
 *    transform, exclusion, covariates) -- 896 distinct fits. Both tails
 *    values for that same 5-tuple reuse this ONE fit and just convert its
 *    two-tailed p differently (p1 = t>0 ? p2/2 : 1-p2/2) -- never a second
 *    regression.
 *
 * All cache tables are created fresh inside this call (local to this one
 * invocation, plain closures over `d`/`n`) -- nothing here is stored at
 * module scope, so there is no cross-call or cross-dataset state to leak:
 * two calls, whether on the same dataset or different ones, never interact.
 */
export function enumerateCurve(d: Dataset, n: WindowN): CurvePoint[] {
  const filteredIdxCache = new Map<Spec['subgroup'], number[]>();
  const rawYCache = new Map<string, Float64Array>();
  const transformedYCache = new Map<string, Float64Array>();
  const zCache = new Map<string, Float64Array>();
  const keptCache = new Map<string, { keptLocal: number[]; finalN: number }>();
  const fitCache = new Map<string, FitPrep>();

  function getFilteredIdx(subgroup: Spec['subgroup']): number[] {
    const cached = filteredIdxCache.get(subgroup);
    if (cached !== undefined) return cached;

    const mask = subgroupMask(d, subgroup, n);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask[i] === 1) idx.push(i);
    }
    filteredIdxCache.set(subgroup, idx);
    return idx;
  }

  function getRawY(outcome: Outcome, subgroup: Spec['subgroup']): Float64Array {
    const key = `${outcome}|${subgroup}`;
    const cached = rawYCache.get(key);
    if (cached !== undefined) return cached;

    const filteredIdx = getFilteredIdx(subgroup);
    const source = d.y[outcome];
    const rawY = new Float64Array(filteredIdx.length);
    for (let i = 0; i < filteredIdx.length; i++) rawY[i] = source[filteredIdx[i]];
    rawYCache.set(key, rawY);
    return rawY;
  }

  function getTransformedY(outcome: Outcome, subgroup: Spec['subgroup'], transform: Spec['transform']): Float64Array {
    const key = `${outcome}|${subgroup}|${transform}`;
    const cached = transformedYCache.get(key);
    if (cached !== undefined) return cached;

    const transformedY = applyTransform(getRawY(outcome, subgroup), transform);
    transformedYCache.set(key, transformedY);
    return transformedY;
  }

  function getZ(outcome: Outcome, subgroup: Spec['subgroup'], transform: Spec['transform']): Float64Array {
    const key = `${outcome}|${subgroup}|${transform}`;
    const cached = zCache.get(key);
    if (cached !== undefined) return cached;

    const z = zScores(getTransformedY(outcome, subgroup, transform));
    zCache.set(key, z);
    return z;
  }

  function getKept(
    outcome: Outcome,
    subgroup: Spec['subgroup'],
    transform: Spec['transform'],
    exclusion: Spec['exclusion'],
  ): { keptLocal: number[]; finalN: number } {
    const key = `${outcome}|${subgroup}|${transform}|${exclusion}`;
    const cached = keptCache.get(key);
    if (cached !== undefined) return cached;

    const transformedY = getTransformedY(outcome, subgroup, transform);
    let keptLocal: number[];
    if (exclusion === 'none') {
      keptLocal = [];
      for (let i = 0; i < transformedY.length; i++) keptLocal.push(i);
    } else {
      const threshold = EXCLUSION_THRESHOLD[exclusion];
      const z = getZ(outcome, subgroup, transform);
      keptLocal = [];
      for (let i = 0; i < z.length; i++) {
        if (Math.abs(z[i]) <= threshold) keptLocal.push(i);
      }
    }
    const result = { keptLocal, finalN: keptLocal.length };
    keptCache.set(key, result);
    return result;
  }

  function getFitPrep(
    outcome: Outcome,
    subgroup: Spec['subgroup'],
    transform: Spec['transform'],
    exclusion: Spec['exclusion'],
    covariates: Spec['covariates'],
  ): FitPrep {
    const key = `${outcome}|${subgroup}|${transform}|${exclusion}|${covariates.income ? 1 : 0}${covariates.risk ? 1 : 0}`;
    const cached = fitCache.get(key);
    if (cached !== undefined) return cached;

    const filteredIdx = getFilteredIdx(subgroup);
    const transformedY = getTransformedY(outcome, subgroup, transform);
    const { keptLocal, finalN } = getKept(outcome, subgroup, transform, exclusion);

    const incomeArr = covariates.income ? new Float64Array(finalN) : null;
    const riskArr = covariates.risk ? new Float64Array(finalN) : null;
    const xArr = new Float64Array(finalN);
    const yArr = new Float64Array(finalN);

    for (let i = 0; i < finalN; i++) {
      const origIdx = filteredIdx[keptLocal[i]];
      xArr[i] = d.x[origIdx];
      yArr[i] = transformedY[keptLocal[i]];
      if (incomeArr) incomeArr[i] = Math.log(d.income[origIdx]);
      if (riskArr) riskArr[i] = d.risk[origIdx];
    }

    const covs: Float64Array[] = [];
    if (incomeArr) covs.push(incomeArr);
    if (riskArr) covs.push(riskArr);

    const fit = ols(yArr, xArr, covs);
    const p2 = fit.valid ? tTwoTailedP(fit.t, fit.df) : 1;
    const prep: FitPrep = { fit, p2, finalN };
    fitCache.set(key, prep);
    return prep;
  }

  const points: CurvePoint[] = [];
  forEachSpec((spec) => {
    const prep = getFitPrep(spec.outcome, spec.subgroup, spec.transform, spec.exclusion, spec.covariates);
    const valid = prep.fit.valid && prep.finalN >= MIN_CELL;
    const p = !prep.fit.valid ? 1 : spec.tails === 'two' ? prep.p2 : prep.fit.t > 0 ? prep.p2 / 2 : 1 - prep.p2 / 2;
    points.push({ spec, p, valid });
  });
  return points;
}
