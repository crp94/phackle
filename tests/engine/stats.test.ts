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

  for (const row of tcdfTable) {
    it(`df=${row.df}, t=${row.t}: within 1e-10 relative`, () => {
      const p = tTwoTailedP(row.t, row.df);
      expect(relErr(p, row.p)).toBeLessThanOrEqual(1e-10);
    });
  }

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
