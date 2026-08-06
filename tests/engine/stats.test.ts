import { describe, expect, it } from 'vitest';
import { betacf, meanSd, ols, regIncBeta, tTwoTailedP, zScores } from '../../src/engine/stats';
import olsFixtures from './fixtures/ols_fixtures.json';
import tcdfFixtures from './fixtures/tcdf_fixtures.json';

interface OlsFixture {
  name: string;
  y: number[];
  x: number[];
  covs: number[][];
  expect_invalid: boolean;
  beta: number | null;
  se: number | null;
  t: number | null;
  p: number | null;
}

interface TcdfFixture {
  df: number;
  t: number;
  p: number;
}

const fixtures = olsFixtures as OlsFixture[];
const tcdfTable = tcdfFixtures as TcdfFixture[];

function relErr(got: number, want: number): number {
  if (want === 0) return Math.abs(got);
  return Math.abs(got - want) / Math.abs(want);
}

function runOls(f: OlsFixture) {
  return ols(
    new Float64Array(f.y),
    new Float64Array(f.x),
    f.covs.map((c) => new Float64Array(c)),
  );
}

describe('ols — scipy-validated fixtures', () => {
  it('has at least 10 fixtures, exactly one flagged invalid', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    expect(fixtures.filter((f) => f.expect_invalid).length).toBe(1);
  });

  for (const f of fixtures) {
    if (f.expect_invalid) continue;

    it(`${f.name}: beta/se/t within 1e-9 relative, p within 1e-9 relative via tTwoTailedP`, () => {
      const result = runOls(f);
      expect(result.valid).toBe(true);
      expect(result.df).toBe(f.y.length - (2 + f.covs.length));

      expect(relErr(result.beta, f.beta as number)).toBeLessThanOrEqual(1e-9);
      expect(relErr(result.se, f.se as number)).toBeLessThanOrEqual(1e-9);
      expect(relErr(result.t, f.t as number)).toBeLessThanOrEqual(1e-9);

      const p = tTwoTailedP(result.t, result.df);
      expect(relErr(p, f.p as number)).toBeLessThanOrEqual(1e-9);
    });
  }

  it('flags the near-collinear fixture invalid (valid === false)', () => {
    const collinear = fixtures.find((f) => f.expect_invalid);
    expect(collinear).toBeDefined();
    const result = runOls(collinear as OlsFixture);
    expect(result.valid).toBe(false);
  });

  it('n=31 cases match to a much tighter bound than the general 1e-9 (near machine precision)', () => {
    // Observed worst case across the three n=31 fixtures is ~2.5e-11 relative
    // (Gauss-Jordan vs. LAPACK solve/inv genuinely round differently) --
    // 1e-10 keeps a comfortable margin above that while still being 10x
    // tighter than the general 1e-9 bound used for every other fixture.
    const n31Cases = fixtures.filter((f) => !f.expect_invalid && f.y.length === 31);
    expect(n31Cases.length).toBeGreaterThan(0);
    for (const f of n31Cases) {
      const result = runOls(f);
      expect(relErr(result.beta, f.beta as number)).toBeLessThanOrEqual(1e-10);
      expect(relErr(result.se, f.se as number)).toBeLessThanOrEqual(1e-10);
      expect(relErr(result.t, f.t as number)).toBeLessThanOrEqual(1e-10);
    }
  });

  // --- gr6-093: the singularity gate is scale-relative, and it actually fires ---
  //
  // Before gr6-093 the gate was an ABSOLUTE `maxAbs < 1e-10` compared against a
  // raw pivot of an unnormalised XtX. With log(income) ~ 10.5 that matrix's
  // leading entries are O(n*110) ~ 2e4, so the threshold sat ~14 orders of
  // magnitude below the matrix scale, and an exactly-collinear design's
  // residual pivot (~eps*||XtX|| ~ 2e-12) could sail through it and return a
  // garbage beta/se the game would render as a real p-value. These tests are
  // the only way that would ever be noticed: MIN_CELL and the singularity
  // guard between them have never fired on real game data (0 invalid points in
  // 215,040 enumerated).
  describe('singularity guard (scale-relative)', () => {
    it('flags an exactly collinear design invalid: x === the intercept column', () => {
      // Every row treated, so the x column IS the all-ones intercept column.
      // This is a real, reachable shape: a subgroup in which everyone got the
      // treatment.
      const n = 60;
      const y = new Float64Array(n);
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        x[i] = 1;
        y[i] = 3 + (i % 7) * 0.5;
      }
      expect(ols(y, x, []).valid).toBe(false);
    });

    it('flags a collinear COVARIATE invalid: cov === 2*x exactly', () => {
      const n = 60;
      const y = new Float64Array(n);
      const x = new Float64Array(n);
      const cov = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        x[i] = i % 2;
        cov[i] = 2 * x[i];
        y[i] = 1 + 0.4 * x[i] + (i % 5) * 0.1;
      }
      expect(ols(y, x, [cov]).valid).toBe(false);
    });

    it('is scale-relative, not absolute: a design collinear only up to rounding is invalid at BOTH covariate scales', () => {
      // THE discriminating case, and the exact shape gr6-093 describes. The
      // two designs below are the same problem in different units: `cov`
      // differs from `x` only by a perturbation ~1e-13 relative, so both
      // matrices are numerically singular (residual pivot / matrix scale ~
      // 1.4e-16, i.e. f64 epsilon) and both must be rejected.
      //
      // Under the OLD absolute 1e-10 gate they are judged differently, purely
      // because of units: at unit scale the residual pivot is 1.8e-12 (below
      // 1e-10 -> correctly rejected), but scaled up by 1e4 the SAME singular
      // design's pivot is 1.2e-4 (above 1e-10 -> accepted, returning a garbage
      // beta/se the game would render as a real p-value). Measured, both.
      // A relative gate rejects both, which is the point.
      const n = 60;
      const build = (scale: number) => {
        const y = new Float64Array(n);
        const x = new Float64Array(n);
        const cov = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const base = (10.5 + (i % 9) * 0.37) * scale; // log(income)-shaped
          x[i] = base;
          cov[i] = base + 1e-9 * scale * (i % 3);
          y[i] = 1 + (i % 5) * 0.1;
        }
        return ols(y, x, [cov]);
      };
      expect(build(1).valid).toBe(false);
      expect(build(1e4).valid).toBe(false);
    });

    it('does NOT flag a well-conditioned design with large-magnitude covariates (no false positive)', () => {
      // log(income) ~ 10.5 is the real magnitude in this engine; a relative
      // gate must leave it alone.
      const n = 60;
      const y = new Float64Array(n);
      const x = new Float64Array(n);
      const income = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        x[i] = i % 2;
        income[i] = 10.5 + Math.sin(i) * 0.6; // test file: trig is fine here, not src/engine/**
        y[i] = 2 + 0.3 * x[i] + 0.1 * income[i] + (i % 3) * 0.05;
      }
      const result = ols(y, x, [income]);
      expect(result.valid).toBe(true);
      expect(Number.isFinite(result.beta)).toBe(true);
      expect(Number.isFinite(result.se)).toBe(true);
    });
  });

  it('reports valid: false (not a thrown error) when df <= 0', () => {
    // n=3 rows, p=4 columns (intercept + x + 2 covs) -> df = 3-4 = -1.
    const y = new Float64Array([1, 2, 3]);
    const x = new Float64Array([1, 2, 3]);
    const covs = [new Float64Array([2, 4, 6]), new Float64Array([1, 1, 2])];
    const result = ols(y, x, covs);
    expect(result.valid).toBe(false);
  });

  it('hand-computed sanity case, independent of the Python fixture pipeline', () => {
    // Simple regression (no covariates), chosen so every intermediate is a
    // clean fraction: x = [1..5], y = [2,4,5,4,5].
    // xbar=3, ybar=4; Sxx = sum((x-xbar)^2) = 10; Sxy = sum((x-xbar)(y-ybar)) = 6
    // beta1 = Sxy/Sxx = 0.6; beta0 = ybar - beta1*xbar = 2.2
    // fitted = [2.8, 3.4, 4.0, 4.6, 5.2]; resid = [-0.8, 0.6, 1.0, -0.6, -0.2]
    // RSS = 2.4; df = 5-2 = 3; sigma2 = 0.8
    // se(beta1) = sqrt(sigma2/Sxx) = sqrt(0.08); t = beta1/se, t^2 = 0.36/0.08 = 4.5 exactly
    const y = new Float64Array([2, 4, 5, 4, 5]);
    const x = new Float64Array([1, 2, 3, 4, 5]);
    const result = ols(y, x, []);

    expect(result.valid).toBe(true);
    expect(result.df).toBe(3);
    expect(result.beta).toBeCloseTo(0.6, 12);
    expect(result.se).toBeCloseTo(Math.sqrt(0.08), 12);
    expect(result.t).toBeCloseTo(Math.sqrt(4.5), 12);
  });
});

describe('tTwoTailedP — t-CDF table (scipy.stats.t.sf, two-tailed)', () => {
  it('has the expected 4 df x 8 t = 32 entries', () => {
    expect(tcdfTable.length).toBe(32);
  });

  // TOLERANCE (gr6-097). This bound used to be 1e-10, which is not a bound the
  // engine can honour — it is where this particular 4-df x 8-t grid happens to
  // land. The binding accuracy constraint is `gammln`'s 6-coefficient Lanczos
  // approximation (published accuracy ~2e-10 relative), NOT `BETACF_EPS`,
  // which the old comment in stats.ts blamed and which measurement clears
  // easily (betacf converges in <=45 iterations to 1e-15 across the whole
  // (df, t) grid this game produces). Against an exact finite-sum reference the
  // relative error reaches 1.76e-9, at (df=396, t=5) — so a 1e-10 assertion is
  // a trap armed for whoever next widens this fixture's t grid: they would get
  // an unexplained failure on a value that is exactly as accurate as every
  // value already here.
  //
  // 1e-8 is a bound that stays true off-grid. On the grid as shipped the
  // measured worst case is 1.67e-12 (df=50, t=-1), so this is not a licence to
  // regress: a real accuracy regression would blow past 1e-8 by orders of
  // magnitude. And none of this reaches a player — at p = .05, where every
  // decision in the game is made, the absolute error is <=6.8e-16 (measured at
  // df 28/100/198/398, i.e. the f64 noise floor for the one number the game
  // acts on).
  const TCDF_REL_TOL = 1e-8;

  for (const row of tcdfTable) {
    it(`df=${row.df}, t=${row.t}: within ${TCDF_REL_TOL} relative`, () => {
      const p = tTwoTailedP(row.t, row.df);
      expect(relErr(p, row.p)).toBeLessThanOrEqual(TCDF_REL_TOL);
    });
  }

  it('is in fact far tighter than the guaranteed bound on the grid as shipped (regression canary)', () => {
    // Documents where the shipped grid actually sits, so a change that
    // degrades accuracy inside the guaranteed 1e-8 envelope is still visible.
    let worst = 0;
    for (const row of tcdfTable) worst = Math.max(worst, relErr(tTwoTailedP(row.t, row.df), row.p));
    expect(worst).toBeLessThanOrEqual(1e-11);
  });

  it('is accurate to f64 noise at the p = .05 decision boundary, for every df the game produces', () => {
    // The only accuracy that is player-visible: every verdict in the game is a
    // comparison against .05, so this is the number that must not drift.
    for (const df of [28, 100, 198, 398]) {
      let lo = 0;
      let hi = 100;
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (tTwoTailedP(mid, df) > 0.05) lo = mid;
        else hi = mid;
      }
      expect(Math.abs(tTwoTailedP((lo + hi) / 2, df) - 0.05)).toBeLessThanOrEqual(1e-15);
    }
  });

  it('is symmetric in t (two-tailed p depends only on |t|)', () => {
    expect(tTwoTailedP(2.5, 50)).toBeCloseTo(tTwoTailedP(-2.5, 50), 14);
  });

  it('equals 1 at t=0 for any df (whole distribution, two-tailed)', () => {
    expect(tTwoTailedP(0, 10)).toBeCloseTo(1, 14);
    expect(tTwoTailedP(0, 398)).toBeCloseTo(1, 14);
  });
});

describe('regIncBeta', () => {
  it('edges: x=0 -> 0, x=1 -> 1 (for representative a, b)', () => {
    expect(regIncBeta(2, 3, 0)).toBe(0);
    expect(regIncBeta(2, 3, 1)).toBe(1);
    expect(regIncBeta(5, 0.5, 0)).toBe(0);
    expect(regIncBeta(5, 0.5, 1)).toBe(1);
  });

  it('matches the symmetry identity I_x(a,b) = 1 - I_{1-x}(b,a)', () => {
    const a = 4;
    const b = 7;
    const x = 0.3;
    const lhs = regIncBeta(a, b, x);
    const rhs = 1 - regIncBeta(b, a, 1 - x);
    expect(lhs).toBeCloseTo(rhs, 12);
  });

  it('regIncBeta(a, a, 0.5) = 0.5 (symmetric beta distribution, midpoint)', () => {
    expect(regIncBeta(3, 3, 0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('betacf', () => {
  it('is finite and in a sane range for representative inputs', () => {
    const cf = betacf(2, 3, 0.4);
    expect(Number.isFinite(cf)).toBe(true);
    expect(cf).toBeGreaterThan(0);
  });
});

describe('meanSd', () => {
  it('computes mean and sample sd (n-1) for [1,2,3,4]', () => {
    // mean = 2.5; variance (n-1) = ((1.5^2)*2 + (0.5^2)*2)/3 = 5/3; sd = sqrt(5/3)
    const { mean, sd } = meanSd(new Float64Array([1, 2, 3, 4]));
    expect(mean).toBeCloseTo(2.5, 12);
    expect(sd).toBeCloseTo(Math.sqrt(5 / 3), 12);
  });
});

describe('zScores', () => {
  it('matches hand-computed values for [1,2,3,4]', () => {
    // mean=2.5, sd=sqrt(5/3) ~ 1.2909944487358056
    // z = (v-mean)/sd -> [-1.161895003862225, -0.387298334620742, 0.387298334620742, 1.161895003862225]
    const z = zScores(new Float64Array([1, 2, 3, 4]));
    const expected = [
      -1.161895003862225, -0.387298334620742, 0.387298334620742, 1.161895003862225,
    ];
    expect(z.length).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(z[i]).toBeCloseTo(expected[i], 12);
    }
  });

  it('is invariant to a shift and scale (z-scores of a+k*v equal sign(k)*z-scores of v)', () => {
    const v = new Float64Array([3, 7, 1, 9, 5]);
    const shiftedScaled = new Float64Array(v.map((x) => 2 * x + 10));
    const z1 = zScores(v);
    const z2 = zScores(shiftedScaled);
    for (let i = 0; i < v.length; i++) {
      expect(z2[i]).toBeCloseTo(z1[i], 9);
    }
  });
});
