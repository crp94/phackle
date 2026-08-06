// Master spec §3.4 (analysis engine) + §3.5 (transforms). The single-
// specification pipeline: window prefix -> subgroup filter -> transform
// outcome -> outlier exclusion -> OLS -> t -> p -> CI. This is the function
// the whole game loop calls on every knob turn, and (per §3.6) what the
// later spec-curve enumeration runs ~1,792 times per player N.
//
// Determinism (§3.1): every primitive here is +,-,*,/,sqrt,exp,log (all via
// stats.ts) plus plain comparisons/averaging for the bisection loop -- no
// Math.pow, no Math.random, no wall clock.

import { MIN_CELL } from '../game/tuning';
import type { Dataset } from './dgp';
import { ols, tTwoTailedP, zScores } from './stats';
import type { DataCut, PathResult, Spec, WindowN } from './types';

/** True iff row `i` of `d` belongs to subgroup `s` (§3.4/brief, pinned
 * comparisons): age_lt40 = age<40, age_ge40 = age>=40, exp_high =
 * experience===2, exp_low = experience===0, urban = urban===1,
 * rural = urban===0, all = everyone. */
function inSubgroup(d: Dataset, s: Spec['subgroup'], i: number): boolean {
  switch (s) {
    case 'all':
      return true;
    case 'age_lt40':
      return d.age[i] < 40;
    case 'age_ge40':
      return d.age[i] >= 40;
    case 'exp_high':
      return d.experience[i] === 2;
    case 'exp_low':
      return d.experience[i] === 0;
    case 'urban':
      return d.urban[i] === 1;
    case 'rural':
      return d.urban[i] === 0;
  }
}

/** Boolean (0/1) mask selecting which of the window's first `n` rows belong
 * to subgroup `s`. Scoped strictly to the window prefix: the returned array
 * has length `n` and never reads or reports on rows past it. */
export function subgroupMask(d: Dataset, s: Spec['subgroup'], n: number): Uint8Array {
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    mask[i] = inSubgroup(d, s, i) ? 1 : 0;
  }
  return mask;
}

/**
 * `raw`: an independent copy of `y` (never an alias -- callers must be able
 * to treat the result as owned). `log1p`: log(1 + y - min(0, min(y))) --
 * shifts only when a negative value is actually present in `y` (min(y) < 0);
 * an all-nonnegative `y` (including one whose minimum is exactly 0) is left
 * unshifted. `y` is expected to already be the filtered (subgroup-restricted)
 * sample -- the shift is always relative to *this* array's own minimum, not
 * some larger window it was drawn from (§3.5).
 */
export function applyTransform(y: Float64Array, t: Spec['transform']): Float64Array {
  const n = y.length;
  const out = new Float64Array(n);
  if (t === 'raw') {
    out.set(y);
    return out;
  }
  let minY = Infinity;
  for (let i = 0; i < n; i++) {
    if (y[i] < minY) minY = y[i];
  }
  const shift = Math.min(0, minY);
  for (let i = 0; i < n; i++) {
    out[i] = Math.log(1 + y[i] - shift);
  }
  return out;
}

// Exported (beyond the brief's original three-helper surface) so specGrid.ts
// (T8) can replicate runSpec's exclusion-threshold lookup exactly when
// building its own memoized "kept" sets, instead of duplicating this table --
// a pure re-export of an existing internal, not a logic change.
export const EXCLUSION_THRESHOLD: Record<Exclude<Spec['exclusion'], 'none'>, number> = {
  z3: 3,
  z2_5: 2.5,
  z2: 2,
};

/**
 * Assembles the DataCut figure payload (T31; see types.ts's DataCut doc) from
 * the intermediates runSpec already has in hand at the point exclusion has
 * been decided: `filteredIdx` (window rows surviving the subgroup filter, in
 * source order), `transformedY` (parallel to it), and `keptLocal` (the
 * ascending local indices exclusion kept).
 *
 * One pass over the filtered sample, walking `keptLocal` with a moving cursor
 * instead of building a Set: keptLocal is ascending by construction (both
 * branches that produce it push in index order), so "is local index i kept?"
 * is one comparison. Pure array bookkeeping — no arithmetic beyond the
 * cursor's `+1`, so §3.1's determinism op-set is untouched, and the four
 * arrays are a pure function of (d, spec, n) like everything else here.
 *
 * Excluded points are SEPARATED, never dropped: that separation is the whole
 * figure — the player watches specific people leave their analysis when they
 * turn the exclusion knob.
 */
function buildCut(
  d: Dataset,
  filteredIdx: number[],
  transformedY: Float64Array,
  keptLocal: number[]
): DataCut {
  const cut: DataCut = { treated: [], control: [], excludedTreated: [], excludedControl: [] };
  let cursor = 0;
  for (let i = 0; i < filteredIdx.length; i++) {
    const kept = cursor < keptLocal.length && keptLocal[cursor] === i;
    if (kept) cursor++;
    const treated = d.x[filteredIdx[i]] === 1;
    const value = transformedY[i];
    if (kept) {
      if (treated) cut.treated.push(value);
      else cut.control.push(value);
    } else if (treated) {
      cut.excludedTreated.push(value);
    } else {
      cut.excludedControl.push(value);
    }
  }
  return cut;
}

const TWO_TAILED_ALPHA = 0.05;
const CRITICAL_T_LO = 0;
const CRITICAL_T_HI = 100;
const CRITICAL_T_ITERATIONS = 20;

/**
 * The (two-tailed) critical t-value solving tTwoTailedP(t, df) = 0.05, found
 * by bisection on the deterministic bracket [0, 100] over exactly 20
 * iterations (pinned, not adaptive). tTwoTailedP(., df) is 1 at t=0 and
 * strictly decreasing towards 0 as t grows for any df>0, so the bracket
 * always contains the root: no search-direction ambiguity to resolve.
 */
function criticalT(df: number): number {
  let lo = CRITICAL_T_LO;
  let hi = CRITICAL_T_HI;
  for (let iter = 0; iter < CRITICAL_T_ITERATIONS; iter++) {
    const mid = (lo + hi) / 2;
    if (tTwoTailedP(mid, df) > TWO_TAILED_ALPHA) {
      // p is still above target -- the crossing point is further right.
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Everything `runSpec` computes, plus the three intermediates `buildCut` needs
 * — so a caller that only wants the statistics can skip the figure payload
 * entirely. Engine-internal (not on the wire, not a §6 type): `PathResult` is
 * unchanged and is still what `runSpec` returns.
 */
export interface SpecCore {
  n: number;
  beta: number;
  se: number;
  t: number;
  p: number;
  ci: [number, number];
  excludedCount: number;
  valid: boolean;
  /** Window rows surviving the subgroup filter, in source order. */
  filteredIdx: number[];
  /** The transformed outcome, parallel to `filteredIdx`. */
  transformedY: Float64Array;
  /** Ascending local indices (into `filteredIdx`) that exclusion kept. */
  keptLocal: number[];
}

/**
 * The single-specification pipeline (§3.4), WITHOUT the `DataCut` figure
 * payload: subgroup filter -> transform the (filtered) outcome -> outlier
 * exclusion (z-scores of the *transformed* outcome computed *within the
 * filtered sample*, order matters) -> OLS of [1, x, log(income)?, risk?] ->
 * t/p per `spec.tails` -> a 95% CI around beta. `valid` is false whenever the
 * post-exclusion count is below MIN_CELL or the OLS itself is invalid
 * (singular design or df<=0); beta/se/t/p/ci/excludedCount are always
 * populated with real numbers whenever OLS could run at all, even when
 * `valid` ends up false purely for falling short of MIN_CELL.
 *
 * Split out from `runSpec` (gr6-046) because day.ts's null-day precheck calls
 * this pipeline 256 times per acceptance attempt purely to read `.valid` and
 * `.p`, and `buildCut` was a measurable fraction of that pass's wall clock
 * (~5-50% depending on machine and load; every measurement agrees it is
 * pure waste on that path) — a four-array
 * payload built and immediately discarded, up to `MAX_ATTEMPTS = 20` times per
 * day boot. `runSpec` below is this function plus one `buildCut` call, so the
 * numbers cannot diverge: same helpers, same inputs, same order, one code
 * path. specGrid.test.ts's runSpec-parity suite is the regression net.
 */
export function runSpecCore(d: Dataset, spec: Spec, n: WindowN): SpecCore {
  const mask = subgroupMask(d, spec.subgroup, n);
  const filteredIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (mask[i] === 1) filteredIdx.push(i);
  }

  const sourceY = d.y[spec.outcome];
  const rawY = new Float64Array(filteredIdx.length);
  for (let i = 0; i < filteredIdx.length; i++) rawY[i] = sourceY[filteredIdx[i]];

  const transformedY = applyTransform(rawY, spec.transform);

  let keptLocal: number[];
  if (spec.exclusion === 'none') {
    keptLocal = [];
    for (let i = 0; i < transformedY.length; i++) keptLocal.push(i);
  } else {
    const threshold = EXCLUSION_THRESHOLD[spec.exclusion];
    const z = zScores(transformedY);
    keptLocal = [];
    for (let i = 0; i < z.length; i++) {
      if (Math.abs(z[i]) <= threshold) keptLocal.push(i);
    }
  }
  const excludedCount = transformedY.length - keptLocal.length;
  const finalN = keptLocal.length;

  const useIncome = spec.covariates.income;
  const useRisk = spec.covariates.risk;
  const xArr = new Float64Array(finalN);
  const yArr = new Float64Array(finalN);
  const incomeArr = useIncome ? new Float64Array(finalN) : null;
  const riskArr = useRisk ? new Float64Array(finalN) : null;

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

  let p: number;
  let ci: [number, number];
  if (fit.valid) {
    const p2 = tTwoTailedP(fit.t, fit.df);
    p = spec.tails === 'two' ? p2 : fit.t > 0 ? p2 / 2 : 1 - p2 / 2;
    const tCrit = criticalT(fit.df);
    ci = [fit.beta - tCrit * fit.se, fit.beta + tCrit * fit.se];
  } else {
    // Unreachable in practice, not dead by accident: MIN_CELL has never bound
    // and no fit has ever come back singular (0 invalid points in 215,040
    // enumerated: 60 days x {200,400} x all 1,792 specs; smallest OLS pivot
    // ever observed 1.159, against a scale-relative threshold ~1e-8). Kept as
    // the defensive branch it is — see MIN_CELL's note at `valid` below.
    p = 1;
    ci = [0, 0];
  }

  // MIN_CELL is a defensive guard that has never bound. The smallest
  // post-exclusion cell measured across 40 days x every (subgroup, outcome,
  // transform, exclusion) combination was 46 rows — the binding case is
  // exp_high/exp_low (about a third of 200) minus a |z|>2 exclusion, still
  // clear of 30 by 16. It is not reachable with the current N_SCHEDULE, so
  // `valid === false` is an unreached state by design, not a state the player
  // is expected to hit. Do not delete it on that evidence: it is what keeps a
  // future subgroup or N-schedule change from silently rendering a p-value
  // computed on a handful of rows.
  const valid = fit.valid && finalN >= MIN_CELL;

  return { n: finalN, beta: fit.beta, se: fit.se, t: fit.t, p, ci, excludedCount, valid, filteredIdx, transformedY, keptLocal };
}

/**
 * `runSpecCore` plus the Lab's `DataCut` figure payload — the function the
 * game loop calls on every knob turn. Public surface and `PathResult` are
 * exactly as before; `cut` is still always attached.
 */
export function runSpec(d: Dataset, spec: Spec, n: WindowN): PathResult {
  const core = runSpecCore(d, spec, n);
  return {
    spec,
    n: core.n,
    beta: core.beta,
    se: core.se,
    t: core.t,
    p: core.p,
    ci: core.ci,
    excludedCount: core.excludedCount,
    valid: core.valid,
    // T31: always attached, including when `valid` is false — the Lab's
    // DataCut still draws the sample the dial has declined to analyse.
    // Cheap by construction (one pass, <=400 pushes) but NOT free: it was
    // a measurable fraction of the null-day precheck's 256-spec pass
    // (machine-dependent; measured 5-50% across runs), which is why
    // `runSpecCore` exists and why day.ts's precheck calls that instead
    // (gr6-046). specGrid.enumerateCurve reimplements this pipeline with its
    // own memoized intermediates and never calls either function, so the
    // 1,792-path reveal enumeration pays nothing for this field.
    cut: buildCut(d, core.filteredIdx, core.transformedY, core.keptLocal),
  };
}
