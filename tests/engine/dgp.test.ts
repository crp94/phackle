import { describe, expect, it } from 'vitest';
import {
  buildAr1Matrix,
  cholesky,
  CHOLESKY,
  CORRELATION_R,
  generateDataset,
  generateRows,
  type Dataset,
} from '../../src/engine/dgp';
import { AR1_RHO, LATENT_DIM, TERTILE_Z } from '../../src/engine/dgpConstants';
import cholFixture from './fixtures/chol_fixture.json';

// --- shared helpers (test-only; not the engine's own stats — dgp.ts owns none
// of these, they exist purely to check its output from the outside) ---

function mean(v: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i];
  return sum / v.length;
}

function sampleSd(v: ArrayLike<number>): number {
  const m = mean(v);
  let sq = 0;
  for (let i = 0; i < v.length; i++) sq += (v[i] - m) * (v[i] - m);
  return Math.sqrt(sq / (v.length - 1));
}

function pearsonCorr(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) * (a[i] - ma);
    db += (b[i] - mb) * (b[i] - mb);
  }
  return num / Math.sqrt(da * db);
}

function excessKurtosis(v: ArrayLike<number>): number {
  const m = mean(v);
  let m2 = 0;
  let m4 = 0;
  for (let i = 0; i < v.length; i++) {
    const d = v[i] - m;
    const d2 = d * d;
    m2 += d2;
    m4 += d2 * d2;
  }
  m2 /= v.length;
  m4 /= v.length;
  return m4 / (m2 * m2) - 3;
}

function skewness(v: ArrayLike<number>): number {
  const m = mean(v);
  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < v.length; i++) {
    const d = v[i] - m;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= v.length;
  m3 /= v.length;
  return m3 / Math.sqrt(m2 * m2 * m2);
}

/** Distinct-value count and the largest single-value frequency (as a fraction
 * of the sample), for the Y3 marginal-character guard. */
function valueSpread(v: ArrayLike<number>): { distinct: number; maxFrequencyFraction: number } {
  const counts = new Map<number, number>();
  for (let i = 0; i < v.length; i++) counts.set(v[i], (counts.get(v[i]) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  return { distinct: counts.size, maxFrequencyFraction: maxCount / v.length };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Fixed, reproducible seed sets — never Math.random, never flaky (same
// conversation instructions as everywhere else in this repo's tests).
const SEEDS_200 = Array.from({ length: 200 }, (_, i) => i);
const SEEDS_50 = Array.from({ length: 50 }, (_, i) => i);

// GR6 gr6-052: ONE 200-seed sweep for the whole file. generateDataset is a
// pure function of (seed, effect), so the 200 null-effect datasets every
// property below needs are identical whoever generates them — the four
// structural-range tests and the six aggregate-moment tests used to each
// re-run this same loop for themselves (ten identical sweeps). Measured cost
// of the sweep itself: ~290ms; the assertion machinery the structural tests
// wrapped around it: ~27s. DATASETS[seed] is generateDataset(seed, null), by
// construction — the array index IS the seed, which is what makes the
// "seed N row M" failure locators below exact.
const DATASETS: Dataset[] = SEEDS_200.map((seed) => generateDataset(seed, null));

describe('correlation matrix + Cholesky (module-load constants)', () => {
  it('builds the pinned 8x8 AR(1) matrix R[i][j] = 0.35^|i-j|', () => {
    const R = buildAr1Matrix(AR1_RHO, LATENT_DIM);
    for (let i = 0; i < LATENT_DIM; i++) {
      for (let j = 0; j < LATENT_DIM; j++) {
        const expected = cholFixture.R[i][j];
        expect(R[i][j]).toBeCloseTo(expected, 12);
      }
    }
  });

  it('matches the python/scipy-generated Cholesky fixture to 1e-12', () => {
    for (let i = 0; i < LATENT_DIM; i++) {
      for (let j = 0; j < LATENT_DIM; j++) {
        expect(CHOLESKY[i][j]).toBeCloseTo(cholFixture.chol[i][j], 12);
      }
    }
  });

  it('is PSD by construction: every Cholesky diagonal entry is strictly positive', () => {
    for (let i = 0; i < LATENT_DIM; i++) {
      expect(CHOLESKY[i][i]).toBeGreaterThan(0);
    }
  });

  it('cholesky(R) reconstructs R (L @ L^T == R) to 1e-12', () => {
    const n = CORRELATION_R.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k <= Math.min(i, j); k++) sum += CHOLESKY[i][k] * CHOLESKY[j][k];
        expect(sum).toBeCloseTo(CORRELATION_R[i][j], 12);
      }
    }
  });

  it('the standalone cholesky() helper matches the fixture too (direct unit test)', () => {
    const R = buildAr1Matrix(AR1_RHO, LATENT_DIM);
    const L = cholesky(R);
    for (let i = 0; i < LATENT_DIM; i++) {
      for (let j = 0; j <= i; j++) {
        expect(L[i][j]).toBeCloseTo(cholFixture.chol[i][j], 12);
      }
    }
  });

  it('TERTILE_Z matches the fixture-computed qnorm(2/3)', () => {
    expect(TERTILE_Z).toBeCloseTo(cholFixture.tertileZ, 12);
  });
});

describe('generateDataset — determinism', () => {
  it('produces byte-identical Float64Arrays for the same seed, called twice', () => {
    const a = generateDataset(42, null);
    const b = generateDataset(42, null);

    expect(a.age).toEqual(b.age);
    expect(a.income).toEqual(b.income);
    expect(a.risk).toEqual(b.risk);
    expect(a.x).toEqual(b.x);
    expect(a.urban).toEqual(b.urban);
    expect(a.experience).toEqual(b.experience);
    for (let j = 0; j < 4; j++) {
      expect(a.y[j]).toEqual(b.y[j]);
    }
  });

  it('produces a different dataset for a different seed', () => {
    const a = generateDataset(1, null);
    const b = generateDataset(2, null);
    expect(a.age).not.toEqual(b.age);
  });

  it('n is always exactly 400', () => {
    const d = generateDataset(7, null);
    expect(d.n).toBe(400);
    expect(d.age.length).toBe(400);
    expect(d.x.length).toBe(400);
    expect(d.y[0].length).toBe(400);
  });
});

// §3.1's structural guarantees, swept over 200 seeds. Each `it` is a plain-JS
// scan of the SHARED `DATASETS` sweep collecting every violation, closed by a
// single `expect(bad).toEqual([])`.
//
// gr6-052/gr1c-013: these four used to be ~800,000 individual `expect()` calls
// (200 seeds x 400 rows x 2-3 assertions, each test re-generating the same 200
// datasets). Measured: the engine plus the comparisons cost ~0.3s; the
// assertion machinery cost ~27s — 87% of the whole unit suite's wall time.
// Coverage is unchanged (identical properties, identical seeds, identical
// rows) and the failure message is strictly better: instead of "expected 21 to
// be >= 22" with no locator, the array names the exact seed, row and value of
// every offender at once. gr1c-014: the `{ timeout: 20_000 }` this describe
// carried — justified by a comment whose "measured 1.7-2.0s per test solo" was
// off by 5.5x against re-measurement — is deleted rather than re-tuned; the
// whole describe now runs in milliseconds, nowhere near vitest's 5000ms
// default.
describe('generateDataset — structural ranges (200 seeds)', () => {
  it('age is always within [22, 70]', () => {
    const bad: string[] = [];
    DATASETS.forEach((d, seed) => {
      for (let i = 0; i < d.n; i++) {
        if (!(d.age[i] >= 22 && d.age[i] <= 70)) bad.push(`seed ${seed} row ${i}: age = ${d.age[i]}`);
      }
    });
    expect(bad).toEqual([]);
  });

  it('Y4 (satisfaction) is always within [1, 10]', () => {
    const bad: string[] = [];
    DATASETS.forEach((d, seed) => {
      for (let i = 0; i < d.n; i++) {
        if (!(d.y[3][i] >= 1 && d.y[3][i] <= 10)) bad.push(`seed ${seed} row ${i}: Y4 = ${d.y[3][i]}`);
      }
    });
    expect(bad).toEqual([]);
  });

  it('Y3 (count) is always a non-negative integer', () => {
    const bad: string[] = [];
    DATASETS.forEach((d, seed) => {
      for (let i = 0; i < d.n; i++) {
        const v = d.y[2][i];
        if (!Number.isInteger(v)) bad.push(`seed ${seed} row ${i}: Y3 = ${v} is not an integer`);
        if (!(v >= 0)) bad.push(`seed ${seed} row ${i}: Y3 = ${v} is negative`);
      }
    });
    expect(bad).toEqual([]);
  });

  it('experience is always 0, 1, or 2; urban and x are always 0 or 1', () => {
    const bad: string[] = [];
    DATASETS.forEach((d, seed) => {
      for (let i = 0; i < d.n; i++) {
        if (![0, 1, 2].includes(d.experience[i])) bad.push(`seed ${seed} row ${i}: experience = ${d.experience[i]}`);
        if (![0, 1].includes(d.urban[i])) bad.push(`seed ${seed} row ${i}: urban = ${d.urban[i]}`);
        if (![0, 1].includes(d.x[i])) bad.push(`seed ${seed} row ${i}: x = ${d.x[i]}`);
      }
    });
    expect(bad).toEqual([]);
  });
});

describe('generateDataset — aggregate moments (200 seeds, pooled/aggregated — never per-seed-flaky)', () => {
  // Computed once, shared by the assertions below — same 200-seed sweep,
  // several independent properties. (Splitting into "one behavior per test"
  // would just mean redoing this identical loop six times; the assertions below
  // are kept in separate `it`s anyway, for clear failure attribution, but only
  // after this shared pass to avoid 6x the runtime.)
  //
  // gr6-052: "computed once" is now true. The previous version called sweep()
  // fresh inside each of the six `it`s, so the loop the comment claimed to
  // share ran six times — and re-generated the same 200 datasets each time.
  // Memoized here, and reading the file-level DATASETS sweep rather than
  // calling generateDataset again.
  let cached: ReturnType<typeof computeSweep> | null = null;
  function sweep(): ReturnType<typeof computeSweep> {
    cached ??= computeSweep();
    return cached;
  }

  function computeSweep() {
    const allAge: number[] = [];
    const allLogIncome: number[] = [];
    const allX: number[] = [];
    const kurtosesY1: number[] = [];
    const skewnessesY2: number[] = [];
    const y3DistinctPerSeed: number[] = [];
    const y3MaxFreqPerSeed: number[] = [];
    const pairwiseMeansPerSeed: number[] = [];

    for (const d of DATASETS) {
      for (let i = 0; i < d.n; i++) {
        allAge.push(d.age[i]);
        allLogIncome.push(Math.log(d.income[i]));
        allX.push(d.x[i]);
      }
      kurtosesY1.push(excessKurtosis(d.y[0]));
      skewnessesY2.push(skewness(d.y[1]));
      const spread = valueSpread(d.y[2]);
      y3DistinctPerSeed.push(spread.distinct);
      y3MaxFreqPerSeed.push(spread.maxFrequencyFraction);
      const pairs: [Float64Array, Float64Array][] = [
        [d.y[0], d.y[1]],
        [d.y[0], d.y[2]],
        [d.y[0], d.y[3]],
        [d.y[1], d.y[2]],
        [d.y[1], d.y[3]],
        [d.y[2], d.y[3]],
      ];
      pairwiseMeansPerSeed.push(mean(pairs.map(([a, b]) => pearsonCorr(a, b))));
    }

    return {
      allAge,
      allLogIncome,
      allX,
      kurtosesY1,
      skewnessesY2,
      y3DistinctPerSeed,
      y3MaxFreqPerSeed,
      pairwiseMeansPerSeed,
    };
  }

  it('pooled corr(age, log(income)) is within ±0.05 of the R-implied value (0.35^3)', () => {
    const { allAge, allLogIncome } = sweep();
    const rImplied = AR1_RHO * AR1_RHO * AR1_RHO; // R[0][3] = rho^|0-3|, built multiplicatively
    const pooled = pearsonCorr(allAge, allLogIncome);
    expect(Math.abs(pooled - rImplied)).toBeLessThan(0.05);
  });

  it('pooled treatment share is 0.5 ± 0.05', () => {
    const { allX } = sweep();
    expect(mean(allX)).toBeGreaterThanOrEqual(0.45);
    expect(mean(allX)).toBeLessThanOrEqual(0.55);
  });

  it('median excess kurtosis of Y1 (over 200 seeds) exceeds 1 (heavy tail)', () => {
    const { kurtosesY1 } = sweep();
    expect(median(kurtosesY1)).toBeGreaterThan(1);
  });

  it('mean pairwise corr(Yi,Yj) over 200 seeds is in [0.15, 0.45]', () => {
    const { pairwiseMeansPerSeed } = sweep();
    const overall = mean(pairwiseMeansPerSeed);
    expect(overall).toBeGreaterThanOrEqual(0.15);
    expect(overall).toBeLessThanOrEqual(0.45);
  });

  // Marginal-character guards (regenerated brief, controller ruling): the
  // shared-factor mechanism used to hit the corr band above must not
  // silently collapse either outcome's own distributional character. These
  // exist specifically to catch the failure mode a noise-shrinking "fix"
  // would have introduced (verified, then reverted, during T3 development).
  it('median skewness(Y2) across 200 seeds exceeds 0.8 (log-normal-ish positive skew preserved)', () => {
    const { skewnessesY2 } = sweep();
    expect(median(skewnessesY2)).toBeGreaterThan(0.8);
  });

  it('Y3 keeps >=6 distinct values per seed, no single value >50% frequency (medians over 200 seeds)', () => {
    const { y3DistinctPerSeed, y3MaxFreqPerSeed } = sweep();
    expect(median(y3DistinctPerSeed)).toBeGreaterThanOrEqual(6);
    expect(median(y3MaxFreqPerSeed)).toBeLessThanOrEqual(0.5);
  });
});

describe('generateDataset — effect injection', () => {
  // The brief's literal criterion ("mean(Y1|X=1)-mean(Y1|X=0) ~= 0.25*sd") is
  // confounded by design: X shares L1/L4 with Y1's own baseline (that's the
  // documented "adjustment matters" confounding — see §3.2), so even a d=0
  // dataset shows a nonzero raw group difference. Testing the raw difference
  // directly would need a loose, empirically-reverse-engineered tolerance that
  // mostly just measures the confound, not the injection. Instead we test the
  // diff-in-diff against the null (d=0) baseline for the SAME seed, which is an
  // exact algebraic identity given how injection is defined (a constant d*sd
  // added only to x[i]=1 rows). Controller-approved (tol 1e-12, not raw
  // float-noise exactness, so this stays robust to legitimate summation-order
  // refactors while still being far tighter than any "within noise" band).
  //
  // gr6-113: parametrized over ALL FOUR outcomes. Both tests below used to run
  // `outcome: 0` only, so the three outcomes with their own post-generation
  // shaping — Y2's exp(), Y3's Math.round(exp()), Y4's clamp+round — were
  // never checked against the injection identity at all, even though the
  // injection deliberately lands AFTER that shaping (dgp.ts: the bump is added
  // to the already-rounded/clamped column, so d*sd is the exact, unrounded
  // shift for every outcome). Worst measured deviation across all four:
  // 2.7e-14 (Y4), comfortably inside the same 1e-12 tolerance.
  const OUTCOMES = [0, 1, 2, 3] as const;

  const groupDiff = (y: Float64Array, x: Uint8Array) => {
    const treated: number[] = [];
    const control: number[] = [];
    for (let i = 0; i < x.length; i++) (x[i] === 1 ? treated : control).push(y[i]);
    return mean(treated) - mean(control);
  };

  it.each(OUTCOMES)(
    'diff-in-diff on Y%i: (mean(Y|X=1)-mean(Y|X=0))_effect - (...)_null == d*sd, tol 1e-12',
    (outcome) => {
      const bad: string[] = [];
      for (const seed of SEEDS_50) {
        // Same seed, same null baseline the whole file shares (DATASETS[seed]
        // IS generateDataset(seed, null)).
        const nullData = DATASETS[seed];
        const effectData = generateDataset(seed, { outcome, d: 0.25, hetero: null });

        const nullDiff = groupDiff(nullData.y[outcome], nullData.x);
        const effectDiff = groupDiff(effectData.y[outcome], effectData.x);
        const sd = sampleSd(nullData.y[outcome]);
        const err = Math.abs(effectDiff - nullDiff - 0.25 * sd);

        if (!(err < 1e-12)) bad.push(`seed ${seed}: |diff-in-diff - 0.25*sd| = ${err} (sd = ${sd})`);
      }
      expect(bad).toEqual([]);
    },
  );

  it.each(OUTCOMES)(
    'an effect on Y%i leaves the other three outcomes completely unaffected (beta=0 off the true outcome)',
    (outcome) => {
      const nullData = generateDataset(3, null);
      const effectData = generateDataset(3, { outcome, d: 0.25, hetero: null });
      for (const other of OUTCOMES) {
        if (other === outcome) continue;
        expect(effectData.y[other], `Y${other} moved when the effect was injected into Y${outcome}`).toEqual(
          nullData.y[other],
        );
      }
    },
  );

  it('applies HETERO_MULTIPLIER only to treated rows inside the hetero subgroup', () => {
    const seed = 11;
    const nullData = generateDataset(seed, null);
    const plain = generateDataset(seed, { outcome: 0, d: 0.25, hetero: null });
    const hetero = generateDataset(seed, {
      outcome: 0,
      d: 0.25,
      hetero: { subgroup: 'urban', multiplier: 1.6 },
    });

    const sd = sampleSd(nullData.y[0]);
    for (let i = 0; i < nullData.n; i++) {
      if (nullData.x[i] === 1 && nullData.urban[i] === 1) {
        // treated + in-subgroup: hetero adds the 1.6x-scaled bump instead of plain's 1x bump
        expect(Math.abs(hetero.y[0][i] - nullData.y[0][i] - 0.25 * sd * 1.6)).toBeLessThan(1e-12);
      } else if (nullData.x[i] === 1) {
        // treated but outside the hetero subgroup: same bump as the non-hetero case
        expect(Math.abs(hetero.y[0][i] - plain.y[0][i])).toBeLessThan(1e-12);
      } else {
        // untreated: no bump either way
        expect(Math.abs(hetero.y[0][i] - nullData.y[0][i])).toBeLessThan(1e-12);
      }
    }
  });
});

describe('generateDataset — row-order generation / prefix property', () => {
  // generateDataset always generates the full N=400 in one deterministic pass
  // (no partial-N entry point exists in its public signature at all — "extending
  // N never re-rolls" is therefore structurally guaranteed for the *baseline*
  // per-row generation). generateRows(seed, n, null) is the internal,
  // n-parameterized generator that generateDataset(seed, null) wraps; this test
  // exercises it directly to prove rows are generated strictly in row order,
  // with no row depending on any row after it — i.e. the thing that could
  // actually break the guarantee (e.g. a vectorized/column-major
  // implementation, or a global renormalization pass) is what's under test.
  //
  // effect=null deliberately: with an effect active, sd is computed once over
  // the complete (always-400) y[j*] array by spec ("generate all Y first...
  // compute sd... add effect") — that full-array sd is a documented, one-time
  // per-day computation, not a re-roll, but it does mean row 0's *final* value
  // legitimately depends on all 400 rows whenever an effect is present. Testing
  // prefix-stability against a moving sd (200-row sd vs 400-row sd,
  // necessarily unequal) would not be testing this property at all.
  const PREFIX_SEEDS = [0, 1, 42];

  it('rows 0..199 from a 200-row generation equal rows 0..199 of the full 400-row generation', () => {
    for (const seed of PREFIX_SEEDS) {
      const partial = generateRows(seed, 200, null);
      const full = generateRows(seed, 400, null);

      expect(partial.age).toEqual(full.age.slice(0, 200));
      expect(partial.income).toEqual(full.income.slice(0, 200));
      expect(partial.risk).toEqual(full.risk.slice(0, 200));
      expect(partial.x).toEqual(full.x.slice(0, 200));
      expect(partial.urban).toEqual(full.urban.slice(0, 200));
      expect(partial.experience).toEqual(full.experience.slice(0, 200));
      for (let j = 0; j < 4; j++) {
        expect(partial.y[j]).toEqual(full.y[j].slice(0, 200));
      }
    }
  });

  it('generateDataset(seed, null) is exactly generateRows(seed, 400, null) (no extra transform)', () => {
    const viaDataset = generateDataset(9, null);
    const viaRows = generateRows(9, 400, null);
    expect(viaDataset.age).toEqual(viaRows.age);
    expect(viaDataset.y[0]).toEqual(viaRows.y[0]);
  });

  // gr6-094: effect injection is whole-array (scales by the sample sd), so a
  // partial generation with an effect would silently break the prefix property
  // this describe exists to pin. The guard makes the trap unreachable.
  it('generateRows throws when an effect is requested at any n other than 400', () => {
    const effect = { outcome: 0, d: 0.25 } as Parameters<typeof generateRows>[2];
    for (const n of [200, 250, 399, 401]) {
      expect(() => generateRows(1, n, effect)).toThrow();
    }
    expect(() => generateRows(1, 400, effect)).not.toThrow();
    expect(() => generateRows(1, 200, null)).not.toThrow();
  });
});
