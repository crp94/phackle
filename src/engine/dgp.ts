// Master spec §3.2 (data-generating process) + Appendix A. Pure, deterministic
// data generation for one day's full N=400 sample: correlated latents (Cholesky
// of a fixed 8x8 AR(1) matrix), confounded treatment, four outcome families
// (heavy-tailed / positive-skew / count / bounded-discrete) with shared-factor
// cross-outcome correlation, and optional effect injection. No acceptance loop
// here (§3.3 rejection sampling is a later task) — generateDataset is a plain
// function of (seed, effect).
//
// Determinism (src/engine/** constraint): only +,-,*,/,sqrt,exp,log on f64,
// plus Math.imul (inside prng.ts) and exact integer ops (round/min/max, all
// spec-exact per ECMAScript, unlike e.g. Math.pow with a non-integer exponent).
// Never Math.pow — the AR(1) matrix's rho^|i-j| entries (integer exponents
// <=7) are built multiplicatively in buildAr1Matrix. Never Math.random,
// Date.now, or new Date.

import { gaussPair, mulberry32 } from './prng';
import type { Outcome, Spec } from './types';
import {
  AGE_BASE,
  AGE_L1_COEF,
  AGE_MAX,
  AGE_MIN,
  INCOME_BASE,
  INCOME_L4_COEF,
  LATENT_DIM,
  AR1_RHO,
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

// ---- Correlation matrix + Cholesky (computed once, at module load) ----

/** R[i][j] = rho^|i-j|, built multiplicatively (never Math.pow — see file
 * header). Exported for direct unit testing against the python fixture. */
export function buildAr1Matrix(rho: number, dim: number): number[][] {
  const powers = new Array<number>(dim);
  powers[0] = 1;
  for (let k = 1; k < dim; k++) powers[k] = powers[k - 1] * rho;

  const matrix: number[][] = [];
  for (let i = 0; i < dim; i++) {
    const row = new Array<number>(dim);
    for (let j = 0; j < dim; j++) row[j] = powers[Math.abs(i - j)];
    matrix.push(row);
  }
  return matrix;
}

/** Textbook Cholesky-Banachiewicz decomposition: returns lower-triangular L
 * such that L @ L^T == matrix. Allowed ops only (+,-,*,/,sqrt). Exported for
 * direct unit testing against the python fixture. */
export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (let j = 0; j < n; j++) {
    let diagSum = matrix[j][j];
    for (let k = 0; k < j; k++) diagSum -= L[j][k] * L[j][k];
    L[j][j] = Math.sqrt(diagSum);

    for (let i = j + 1; i < n; i++) {
      let s = matrix[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = s / L[j][j];
    }
  }
  return L;
}

/** The pinned 8x8 AR(1) correlation matrix (§3.2). */
export const CORRELATION_R: number[][] = buildAr1Matrix(AR1_RHO, LATENT_DIM);

/** CORRELATION_R's Cholesky factor, computed once at module load. Unit-tested
 * against tests/engine/fixtures/chol_fixture.json (python/scipy) to 1e-12. */
export const CHOLESKY: number[][] = cholesky(CORRELATION_R);

// ---- small numeric helpers ----

function clampNum(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

/** Mean and sample standard deviation (n-1 denominator). Deliberately a local,
 * private copy rather than an import from the sibling T2 stats.ts task (whose
 * meanSd has the same contract): T3 and T2 are independent, parallel-dispatch
 * worktrees with no shared build order, so dgp.ts cannot depend on stats.ts. */
function meanAndSd(v: Float64Array): { mean: number; sd: number } {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i];
  const mean = sum / v.length;

  let sq = 0;
  for (let i = 0; i < v.length; i++) {
    const d = v[i] - mean;
    sq += d * d;
  }
  return { mean, sd: Math.sqrt(sq / (v.length - 1)) };
}

/** Hetero-effect subgroup membership for one row. Strictly local to effect
 * injection below — the analysis engine's own Spec-filtering (all seven
 * `subgroup` values, including 'all') is a sibling task's concern. */
function inHeteroSubgroup(
  subgroup: Spec['subgroup'],
  i: number,
  age: Float64Array,
  urban: Uint8Array,
  experience: Uint8Array,
): boolean {
  switch (subgroup) {
    case 'age_lt40':
      return age[i] < 40;
    case 'age_ge40':
      return age[i] >= 40;
    case 'exp_high':
      return experience[i] === 2;
    case 'exp_low':
      return experience[i] === 0;
    case 'urban':
      return urban[i] === 1;
    case 'rural':
      return urban[i] === 0;
    case 'all':
      // Not a meaningful hetero designation (effectParamsFor in seeds.ts only
      // ever draws from the six non-'all' subgroups); guard rather than
      // silently treat as "everyone", since that would mask a real caller bug.
      throw new Error("'all' is not a valid hetero subgroup");
  }
}

// ---- public types ----

/** Full N=400 sample, engine-internal (§3.2). */
export interface Dataset {
  n: 400;
  x: Uint8Array;
  age: Float64Array;
  urban: Uint8Array;
  experience: Uint8Array;
  income: Float64Array;
  risk: Float64Array;
  y: [Float64Array, Float64Array, Float64Array, Float64Array];
}

/** Named form of the brief's pinned (inline) effect-parameter shape. */
export interface EffectSpec {
  outcome: Outcome;
  d: number;
  hetero: { subgroup: Spec['subgroup']; multiplier: number } | null;
}

interface GeneratedRows {
  n: number;
  x: Uint8Array;
  age: Float64Array;
  urban: Uint8Array;
  experience: Uint8Array;
  income: Float64Array;
  risk: Float64Array;
  y: [Float64Array, Float64Array, Float64Array, Float64Array];
}

// ---- generation ----

/**
 * Generates `n` rows in strict row order from a single continuous RNG stream
 * (mulberry32(seed)): row i's random draws never depend on n or on any row
 * after it, so generateRows(seed, 200, effect) is always exactly the first
 * 200 rows of generateRows(seed, 400, effect) — the "extending N never
 * re-rolls" prefix property (§3.8) — for the per-row generative core.
 *
 * The one deliberate exception is effect injection (below): §3.2 defines it
 * as "generate all Y first with beta=0; compute sd = meanSd(y[j*]).sd; add
 * d*sd*x[i]" — a single pass over the *complete* generated array. Since
 * generateDataset always generates the full 400 in one call (there is no
 * partial-N entry point in its public signature at all), this one-time,
 * whole-array sd computation never actually re-rolls anything in practice.
 *
 * Exported (beyond the brief's pinned surface) so dgp.test.ts can exercise the
 * prefix property directly; generateDataset is a thin n=400 wrapper below.
 */
export function generateRows(seed: number, n: number, effect: EffectSpec | null): GeneratedRows {
  const rng = mulberry32(seed);

  const x = new Uint8Array(n);
  const age = new Float64Array(n);
  const urban = new Uint8Array(n);
  const experience = new Uint8Array(n);
  const income = new Float64Array(n);
  const risk = new Float64Array(n);
  const y1 = new Float64Array(n);
  const y2 = new Float64Array(n);
  const y3 = new Float64Array(n);
  const y4 = new Float64Array(n);

  // Shared-factor mixing weights (regenerated brief + controller ruling):
  // epsilon_j = sqrtOneMinusShared*eta_j + sqrtShared*eta_shared. Hoisted out
  // of the row loop since they're seed-independent constants.
  const sqrtOneMinusShared = Math.sqrt(1 - RHO_SHARED);
  const sqrtShared = Math.sqrt(RHO_SHARED);

  const z = new Float64Array(LATENT_DIM);
  const L = new Float64Array(LATENT_DIM);

  for (let i = 0; i < n; i++) {
    // 1. Eight correlated latents: 4 gaussPair() calls -> Cholesky multiply.
    //    L ~ MVN(0, R8); only L1..L6 (index 0..5) are used below — L7/L8
    //    ("Z7, Z8" in §3.2's "held latent") are drawn to realize the full
    //    8-dim MVN faithfully but never read past this point.
    for (let k = 0; k < LATENT_DIM; k += 2) {
      const [a, b] = gaussPair(rng);
      z[k] = a;
      z[k + 1] = b;
    }
    for (let r = 0; r < LATENT_DIM; r++) {
      let s = 0;
      for (let c = 0; c <= r; c++) s += CHOLESKY[r][c] * z[c];
      L[r] = s;
    }
    const l1 = L[0];
    const l2 = L[1];
    const l3 = L[2];
    const l4 = L[3];
    const l5 = L[4];
    const l6 = L[5];

    // 2. Treatment noise + Y2's idiosyncratic noise share a gaussPair() call.
    const [eps, y2z] = gaussPair(rng);
    // 3. Y3's + Y4's idiosyncratic noise share a gaussPair() call.
    const [y3z, y4z] = gaussPair(rng);
    // 4. t5's six components (three gaussPair() calls): t5 = z0/sqrt(mean(zk^2)).
    const [t0, t1] = gaussPair(rng);
    const [t2, t3] = gaussPair(rng);
    const [t4, t5v] = gaussPair(rng);
    // 5. Shared error factor (regenerated brief): one more standard normal,
    //    reused across all four outcomes' epsilon_j below. 19 draws/row is
    //    odd, so this 10th gaussPair() call's second value is a documented,
    //    fixed-position discard — not a leak, just parity bookkeeping.
    const [etaShared] = gaussPair(rng);

    age[i] = clampNum(AGE_BASE + AGE_L1_COEF * l1, AGE_MIN, AGE_MAX);
    urban[i] = l2 + URBAN_L1_COEF * l1 > 0 ? 1 : 0;
    experience[i] = l3 < -TERTILE_Z ? 0 : l3 > TERTILE_Z ? 2 : 1;
    income[i] = Math.exp(INCOME_BASE + INCOME_L4_COEF * l4);
    risk[i] = clampNum(RISK_BASE + RISK_L5_COEF * l5, RISK_MIN, RISK_MAX);

    const treatmentScore = TREATMENT_L1_COEF * l1 + TREATMENT_L4_COEF * l4 + TREATMENT_EPS_COEF * eps;
    x[i] = treatmentScore > 0 ? 1 : 0;

    const t5 = t0 / Math.sqrt((t1 * t1 + t2 * t2 + t3 * t3 + t4 * t4 + t5v * t5v) / 5);
    const eps1 = sqrtOneMinusShared * t5 + sqrtShared * etaShared;
    const eps2 = sqrtOneMinusShared * y2z + sqrtShared * etaShared;
    const eps3 = sqrtOneMinusShared * y3z + sqrtShared * etaShared;
    const eps4 = sqrtOneMinusShared * y4z + sqrtShared * etaShared;

    y1[i] = Y1_LOADINGS.l1 * l1 + Y1_LOADINGS.l4 * l4 + Y1_LOADINGS.l6 * l6 + Y1_LOADINGS.t5Scale * eps1;

    y2[i] = Math.exp(
      Y2_LOADINGS.lScale * (Y2_LOADINGS.l1 * l1 + Y2_LOADINGS.l5 * l5 + Y2_LOADINGS.l6 * l6) +
        Y2_LOADINGS.zScale * eps2,
    );

    const y3raw =
      Y3_LOADINGS.base +
      Y3_LOADINGS.l3 * l3 +
      Y3_LOADINGS.l4 * l4 +
      Y3_LOADINGS.l6 * l6 +
      Y3_LOADINGS.zScale * eps3;
    y3[i] = Math.round(Math.exp(y3raw));

    const y4raw =
      Y4_LOADINGS.base + Y4_LOADINGS.lScale * (Y4_LOADINGS.l5 * l5 + Y4_LOADINGS.l6 * l6) + Y4_LOADINGS.zScale * eps4;
    y4[i] = clampNum(Math.round(y4raw), Y4_LOADINGS.min, Y4_LOADINGS.max);
  }

  const y: [Float64Array, Float64Array, Float64Array, Float64Array] = [y1, y2, y3, y4];

  // Effect injection (§3.2): all four Y are already fully generated above with
  // beta=0 (no x[i] term anywhere in the loop). Only the chosen true outcome
  // gets a treatment bump now, scaled by that outcome's own baseline sd.
  if (effect !== null) {
    const target = y[effect.outcome];
    const { sd } = meanAndSd(target);
    for (let i = 0; i < n; i++) {
      if (x[i] === 1) {
        let multiplier = 1;
        if (effect.hetero !== null && inHeteroSubgroup(effect.hetero.subgroup, i, age, urban, experience)) {
          multiplier = effect.hetero.multiplier;
        }
        target[i] += effect.d * sd * multiplier;
      }
    }
  }

  return { n, x, age, urban, experience, income, risk, y };
}

/** Generates the full N=400 sample for one day (§3.2). Pure function of
 * (seed, effect) — same seed and effect always produce byte-identical
 * Float64Arrays. No acceptance/rejection loop here (§3.3 is a later task);
 * `seed` is whatever the caller already resolved (e.g. daySeed(iso, attempt)
 * from seeds.ts). */
export function generateDataset(seed: number, effect: EffectSpec | null): Dataset {
  const rows = generateRows(seed, 400, effect);
  return {
    n: 400,
    x: rows.x,
    age: rows.age,
    urban: rows.urban,
    experience: rows.experience,
    income: rows.income,
    risk: rows.risk,
    y: rows.y,
  };
}
