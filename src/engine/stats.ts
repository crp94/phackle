// Master spec §3.4 (analysis engine) + Appendix A (numerical recipes,
// implement exactly). Pure math: no imports, no wall clock, no randomness --
// every function here is a deterministic function of its numeric arguments.
//
// Determinism/purity constraint (§3.1): only +,-,*,/,sqrt,exp,log on f64
// (plus Math.imul, unused here). In particular no Math.pow with a
// non-integer exponent -- gammln below needs no pow at all (the Lanczos
// formula is expressed with log/exp only); every squaring elsewhere is
// written as an explicit multiplication.
//
// What that op set does and does not guarantee across engines (gr6-048): the
// arithmetic and Math.sqrt are exact everywhere, but Math.exp and Math.log --
// which this file leans on heavily (gammln, regIncBeta) -- are
// implementation-approximated per ECMA-262 and may differ by up to 1 ULP
// between V8, SpiderMonkey and JavaScriptCore. So results here are exactly
// reproducible on the same engine and agree to ~1 ULP across engines; they are
// NOT byte-identical across engines by construction. See prng.ts's header for
// the full statement and the empirical check that backs it.

/** Mean and sample standard deviation (Bessel-corrected, divides by n-1). */
export function meanSd(v: Float64Array): { mean: number; sd: number } {
  const n = v.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += v[i];
  const mean = sum / n;

  let ss = 0;
  for (let i = 0; i < n; i++) {
    const d = v[i] - mean;
    ss += d * d;
  }
  const sd = Math.sqrt(ss / (n - 1));
  return { mean, sd };
}

/** z-scores of v: (v[i] - mean) / sd, sd with n-1. */
export function zScores(v: Float64Array): Float64Array {
  const { mean, sd } = meanSd(v);
  const n = v.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (v[i] - mean) / sd;
  return out;
}

// --- Regularized incomplete beta function, via Lentz continued fractions ---
// (Appendix A: "standard NR implementation, ~40 lines"; the classic
// Numerical Recipes betacf/betai/gammln, transcribed for f64.)

// Standard Numerical Recipes Lanczos coefficients. The second one is spelled
// ...78 rather than the textbook's printed ...77: both decimal strings parse
// to the exact same float64 (verified: -86.50532032941677 === -86.50532032941678),
// so this is the same constant written in its canonical round-trip form,
// which also happens to satisfy the no-loss-of-precision lint rule.
const GAMMLN_COF = [
  76.18009172947146, -86.50532032941678, 24.01409824083091, -1.231739572450155,
  0.1208650973866179e-2, -0.5395239384953e-5,
];

/** log(Gamma(xx)) via the Lanczos approximation (xx > 0). Uses only
 * +,-,*,/,log -- no pow, no exp needed here (the caller exponentiates). */
function gammln(xx: number): number {
  const x = xx;
  let y = xx;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += GAMMLN_COF[j] / y;
  }
  // sqrt(2*pi), same canonical-round-trip-spelling note as GAMMLN_COF above
  // (textbook prints ...05; ...07 is the identical float64, verified equal).
  return -tmp + Math.log((2.5066282746310007 * ser) / x);
}

const BETACF_MAXIT = 200;
// Double-precision convergence threshold. The textbook Numerical Recipes value
// (EPS=3e-7) targets 32-bit float precision; f64 can do much better, so this
// is tightened to just clear machine epsilon (~2.22e-16).
//
// This is NOT the engine's accuracy floor, despite what this comment used to
// claim (gr6-097). Measured: betacf converges in <=45 iterations to 1e-15
// across the entire (df, t) grid the game produces, so it is comfortably not
// the binding term. The binding term is `gammln`'s 6-coefficient Lanczos
// approximation above, whose published accuracy is ~2e-10 relative — which is
// exactly what surfaces as the 4.2e-11 discontinuity at regIncBeta's branch
// switch (a=199, i.e. df=398) and the 1.35e-11 worst error against closed
// forms; against an exact finite-sum reference the relative error reaches
// 1.76e-9 at (df=396, t=5). None of that is player-visible: at p = .05, where
// every decision in this game is made, the absolute error is <=3.5e-14
// (measured at df 28/100/198/398). tests/engine/stats.test.ts's t-CDF fixture
// tolerance is set from gammln's floor, not from this constant.
const BETACF_EPS = 1e-15;
const BETACF_FPMIN = 1e-300;

/** Continued fraction for the incomplete beta function (Lentz's method,
 * modified per Numerical Recipes to avoid division by zero). */
export function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= BETACF_MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_FPMIN) c = BETACF_FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_FPMIN) c = BETACF_FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < BETACF_EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b), a,b > 0, x in [0,1]. */
export function regIncBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const bt = Math.exp(
    gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x),
  );

  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p-value for a t-statistic with `df` degrees of freedom:
 * p = I_{df/(df+t^2)}(df/2, 1/2) (Appendix A). */
export function tTwoTailedP(t: number, df: number): number {
  const x = df / (df + t * t);
  return regIncBeta(df / 2, 0.5, x);
}

// --- OLS via normal equations, Gaussian elimination with partial pivoting ---

export interface OlsResult {
  beta: number;
  se: number;
  t: number;
  df: number;
  valid: boolean;
}

// Singularity threshold, RELATIVE to the matrix's own scale (gr6-093). It used
// to be an absolute 1e-10 compared against a raw pivot of an unnormalised
// XtX: with log(income) ~ 10.5 that matrix's leading entries are O(n*110) ~
// 2e4, so the gate sat ~14 orders of magnitude below the matrix scale. A
// design that is exactly collinear up to rounding (say a subgroup in which
// every row is treated, so the x column equals the intercept column) leaves a
// residual pivot around eps*||XtX|| ~ 1e-16 * 2e4 = 2e-12 — the right order to
// sometimes PASS a 1e-10 gate and hand back a garbage beta/se that the game
// would render as a real p-value. Scaling by max_a |XtX[a][a]| removes the
// dependence on the covariates' units; 1e-12 relative is ~4 orders above f64
// epsilon, tight enough to keep well clear of any well-conditioned fit
// (smallest pivot ever observed over 40 days x every spec x {200,400}: 1.159)
// and loose enough to catch the collinear case (unit-tested).
const SINGULAR_EPS = 1e-12;

/**
 * OLS of y on [1, x, ...covs] (p = 2 + covs.length <= 4 predictors, per
 * Appendix A). Builds the (p x p) normal-equations matrix XtX and solves
 * XtX @ beta = Xty *and* computes [XtX]^-1 in one pass, via Gauss-Jordan
 * elimination with partial pivoting on the augmented matrix
 * [XtX | I | Xty] -- the inverse's (x,x) entry is needed for se, not just
 * beta, so a plain solve (without the inverse) isn't enough here.
 *
 * valid=false, without throwing, when a pivot's absolute value falls below
 * SINGULAR_EPS * (the matrix's own scale) — singular/near-singular design
 * matrix — or when df=n-p<=0. beta/se/t always refer to the x column
 * (index 1: 0=intercept, 1=x, 2..=covariates).
 */
export function ols(y: Float64Array, x: Float64Array, covs: Float64Array[]): OlsResult {
  const n = y.length;
  const p = 2 + covs.length;
  const df = n - p;
  const invalid: OlsResult = { beta: 0, se: 0, t: 0, df, valid: false };

  if (df <= 0) return invalid;

  // colVal(a, i): value of design column `a` at row i. Column 0 is the
  // implicit intercept (all ones); column 1 is x; columns 2.. are covs.
  const colVal = (col: number, i: number): number => {
    if (col === 0) return 1;
    if (col === 1) return x[i];
    return covs[col - 2][i];
  };

  // XtX (p x p, symmetric) and Xty (p).
  const XtX: number[][] = [];
  for (let a = 0; a < p; a++) XtX.push(new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    const yi = y[i];
    for (let a = 0; a < p; a++) {
      const va = colVal(a, i);
      Xty[a] += va * yi;
      for (let b = a; b < p; b++) {
        XtX[a][b] += va * colVal(b, i);
      }
    }
  }
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
  }

  // The matrix's own scale, captured BEFORE elimination: the largest absolute
  // diagonal entry of XtX. Every pivot test below is relative to this, so the
  // singularity gate does not silently depend on the covariates' units (see
  // SINGULAR_EPS). All-zero XtX cannot arise (column 0 is the intercept, so
  // XtX[0][0] === n > 0), but guard the degenerate scale anyway rather than
  // compare against 0.
  let scale = 0;
  for (let a = 0; a < p; a++) {
    const dv = Math.abs(XtX[a][a]);
    if (dv > scale) scale = dv;
  }
  if (scale === 0) return invalid;
  const pivotFloor = SINGULAR_EPS * scale;

  // Augmented matrix [XtX | I | Xty], p x (2p+1).
  const w = 2 * p + 1;
  const M: number[][] = [];
  for (let a = 0; a < p; a++) {
    const row = new Array(w).fill(0);
    for (let b = 0; b < p; b++) row[b] = XtX[a][b];
    row[p + a] = 1;
    row[2 * p] = Xty[a];
    M.push(row);
  }

  // Gauss-Jordan elimination with partial pivoting.
  for (let col = 0; col < p; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < p; r++) {
      const av = Math.abs(M[r][col]);
      if (av > maxAbs) {
        maxAbs = av;
        pivotRow = r;
      }
    }
    if (maxAbs < pivotFloor) return invalid;

    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivot = M[col][col];
    const pivotRowArr = M[col];
    for (let c = col; c < w; c++) pivotRowArr[c] = pivotRowArr[c] / pivot;

    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      const rowArr = M[r];
      for (let c = col; c < w; c++) {
        rowArr[c] -= factor * pivotRowArr[c];
      }
    }
  }

  const betaFull: number[] = new Array(p);
  for (let a = 0; a < p; a++) {
    betaFull[a] = M[a][2 * p];
  }
  // [XtX]^-1's (x,x) entry: row 1 (the x column), column p+1 (the identity
  // block's column 1) of the reduced augmented matrix. That's the only
  // entry of the inverse se needs.
  const xtxInv11 = M[1][p + 1];

  let rss = 0;
  for (let i = 0; i < n; i++) {
    let fitted = 0;
    for (let a = 0; a < p; a++) fitted += betaFull[a] * colVal(a, i);
    const resid = y[i] - fitted;
    rss += resid * resid;
  }
  const sigma2 = rss / df;

  const beta = betaFull[1];
  const se = Math.sqrt(sigma2 * xtxInv11);
  const t = beta / se;

  return { beta, se, t, df, valid: true };
}
