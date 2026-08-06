import { describe, expect, it } from 'vitest';
import { applyTransform, runSpec, subgroupMask } from '../../src/engine/analyze';
import type { Dataset } from '../../src/engine/dgp';
import { generateDataset } from '../../src/engine/dgp';
import { tTwoTailedP } from '../../src/engine/stats';
import type { Outcome, Spec, WindowN } from '../../src/engine/types';
import { MIN_CELL } from '../../src/game/tuning';
import micro12 from './fixtures/micro12.json';

// --- shared helpers (test-only) ---

/** Builds a Dataset-shaped object from plain-array columns. `n: 400` is a
 * type-satisfying placeholder only -- analyze.ts never reads Dataset.n (every
 * function here takes its own explicit window-size parameter), so a dataset
 * whose arrays are shorter than 400 is safe as long as callers never pass a
 * window bigger than the arrays actually are (exactly what every test below
 * does: the micro12 fixture is windowed at n=12, never at n=400). */
function buildDataset(cols: {
  age: number[];
  urban: number[];
  experience: number[];
  income: number[];
  risk: number[];
  x: number[];
  y0: number[];
  y1?: number[];
  y2?: number[];
  y3?: number[];
}): Dataset {
  return {
    n: 400,
    x: Uint8Array.from(cols.x),
    age: Float64Array.from(cols.age),
    urban: Uint8Array.from(cols.urban),
    experience: Uint8Array.from(cols.experience),
    income: Float64Array.from(cols.income),
    risk: Float64Array.from(cols.risk),
    y: [
      Float64Array.from(cols.y0),
      Float64Array.from(cols.y1 ?? cols.y0),
      Float64Array.from(cols.y2 ?? cols.y0),
      Float64Array.from(cols.y3 ?? cols.y0),
    ],
  };
}

function relErr(got: number, want: number): number {
  if (want === 0) return Math.abs(got);
  return Math.abs(got - want) / Math.abs(want);
}

function asWindow(n: number): WindowN {
  return n as unknown as WindowN;
}

// --- the micro12 fixture (scripts/gen_analyze_fixtures.py) ---

interface Micro12Spec {
  name: string;
  spec: Spec;
  n: number;
  beta: number;
  se: number;
  t: number;
  p: number;
  ci: [number, number];
  excludedCount: number;
  valid: boolean;
}

interface Micro12Fixture {
  dataset: {
    age: number[];
    urban: number[];
    experience: number[];
    income: number[];
    risk: number[];
    x: number[];
    y0: number[];
    y1: number[];
    y2: number[];
    y3: number[];
  };
  specs: Micro12Spec[];
}

const fixture = micro12 as Micro12Fixture;
const micro12Dataset = buildDataset(fixture.dataset);
const MICRO_N = fixture.dataset.age.length; // 12

function specByName(name: string): Micro12Spec {
  const found = fixture.specs.find((s) => s.name === name);
  if (!found) throw new Error(`fixture spec not found: ${name}`);
  return found;
}

describe('micro12 fixture sanity', () => {
  it('has 12 rows and exactly 6 specs', () => {
    expect(MICRO_N).toBe(12);
    expect(fixture.specs.length).toBe(6);
  });
});

describe('subgroupMask — hand-derived membership over the micro12 dataset', () => {
  // age = [25,30,35,45,50,55,28,32,60,22,48,38]
  // urban = [1,1,1,1,1,1,0,0,0,0,0,0]
  // experience = [1,2,0,2,1,0,2,1,0,2,1,0]
  const cases: { s: Spec['subgroup']; expected: number[] }[] = [
    { s: 'all', expected: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    { s: 'age_lt40', expected: [1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1] },
    { s: 'age_ge40', expected: [0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0] },
    { s: 'exp_high', expected: [0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0] },
    { s: 'exp_low', expected: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1] },
    { s: 'urban', expected: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0] },
    { s: 'rural', expected: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1] },
  ];

  for (const { s, expected } of cases) {
    it(`${s}: matches hand-derived mask`, () => {
      const mask = subgroupMask(micro12Dataset, s, MICRO_N);
      expect(Array.from(mask)).toEqual(expected);
    });
  }

  it('is scoped to the window prefix n (ignores rows past n)', () => {
    // First 6 rows are all urban -- masking with n=6 must not "see" the
    // rural rows 6-11 at all (not just exclude them from the result: the
    // returned array itself should be length 6).
    const mask = subgroupMask(micro12Dataset, 'urban', 6);
    expect(mask.length).toBe(6);
    expect(Array.from(mask)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe('applyTransform', () => {
  it('raw: passes values through unchanged (and does not alias the input)', () => {
    const y = new Float64Array([1, 2, 3]);
    const out = applyTransform(y, 'raw');
    expect(Array.from(out)).toEqual([1, 2, 3]);
    out[0] = 999;
    expect(y[0]).toBe(1); // caller's array must be untouched
  });

  it('log1p: shifts only when a negative value is present (min=-1 -> shift=-1)', () => {
    // shift = min(0, min(y)) = min(0, -1) = -1; log(1 + y - (-1)) = log(2+y)
    const y = new Float64Array([-1, 0, 5]);
    const out = applyTransform(y, 'log1p');
    expect(out[0]).toBeCloseTo(Math.log(1), 12); // log(2 + -1) = log(1) = 0
    expect(out[1]).toBeCloseTo(Math.log(2), 12);
    expect(out[2]).toBeCloseTo(Math.log(7), 12);
  });

  it('log1p: leaves an all-positive sample unshifted (min=4 > 0 -> shift=0)', () => {
    const y = new Float64Array([4, 9, 24]);
    const out = applyTransform(y, 'log1p');
    expect(out[0]).toBeCloseTo(Math.log(5), 12);
    expect(out[1]).toBeCloseTo(Math.log(10), 12);
    expect(out[2]).toBeCloseTo(Math.log(25), 12);
  });

  it('log1p: a sample whose minimum is exactly 0 is also unshifted (0 is not negative)', () => {
    // shift = min(0, min(y)) = min(0, 0) = 0 -- boundary of "negatives exist"
    const y = new Float64Array([0, 1, 4]);
    const out = applyTransform(y, 'log1p');
    expect(out[0]).toBeCloseTo(Math.log(1), 12);
    expect(out[1]).toBeCloseTo(Math.log(2), 12);
    expect(out[2]).toBeCloseTo(Math.log(5), 12);
  });

  it('log1p: empty input returns empty output without throwing', () => {
    const out = applyTransform(new Float64Array([]), 'log1p');
    expect(out.length).toBe(0);
  });
});

describe('runSpec — micro12 fixture (scripts/gen_analyze_fixtures.py, numpy/scipy ground truth)', () => {
  for (const fx of fixture.specs) {
    it(`${fx.name}: n/excludedCount/valid exact, beta/se/t/p/ci within 1e-9 relative`, () => {
      const result = runSpec(micro12Dataset, fx.spec, asWindow(MICRO_N));

      expect(result.n).toBe(fx.n);
      expect(result.excludedCount).toBe(fx.excludedCount);
      expect(result.valid).toBe(fx.valid);

      expect(relErr(result.beta, fx.beta)).toBeLessThanOrEqual(1e-9);
      expect(relErr(result.se, fx.se)).toBeLessThanOrEqual(1e-9);
      expect(relErr(result.t, fx.t)).toBeLessThanOrEqual(1e-9);
      expect(relErr(result.p, fx.p)).toBeLessThanOrEqual(1e-9);
      expect(relErr(result.ci[0], fx.ci[0])).toBeLessThanOrEqual(1e-9);
      expect(relErr(result.ci[1], fx.ci[1])).toBeLessThanOrEqual(1e-9);
    });
  }
});

describe('runSpec — z-exclusion is computed within the filtered sample, not the full window (order proof)', () => {
  // Spec A: subgroup='urban' (rows 0-5, y0=[10,10.2,9.8,10.1,9.9,13]), z2.
  // Within the urban-only sample (mean~10.5, sd~1.233), row 5 (y=13) has
  // z~2.03 -> excluded (n=5, excludedCount=1). Computed the *wrong* way --
  // z across all 12 rows first (mean~8.17, sd~9.74, because rural includes
  // wide/negative values) -- row 5's z is only ~0.50, comfortably under the
  // z2 threshold, so a same-spec run that (incorrectly) pooled the full
  // window before excluding would report n=6, excludedCount=0 instead.
  it('spec A (urban/z2/raw) excludes exactly the urban-relative outlier: n=5, excludedCount=1', () => {
    const fx = specByName('A_urban_z2_raw_order_proof');
    const result = runSpec(micro12Dataset, fx.spec, asWindow(MICRO_N));
    expect(result.n).toBe(5);
    expect(result.excludedCount).toBe(1);
    // beta=-0.25 exactly: mean(y|x=1 kept)=9.9, mean(y|x=0 kept)=10.15.
    expect(result.beta).toBeCloseTo(-0.25, 9);
  });

  it('a full-window z-score would NOT flag urban row 5 (y=13) as an outlier (the bug this proves against)', () => {
    // Direct demonstration of *why* order matters: z-scoring the full
    // 12-row window's raw y before ever filtering to urban gives row 5
    // (index 5, y=13) a z-score well under 2, so a "filter after excluding"
    // implementation would silently keep it -- contradicting the fixture's
    // pinned n=5/excludedCount=1 above.
    const fullY = fixture.dataset.y0;
    const mean = fullY.reduce((a, b) => a + b, 0) / fullY.length;
    const variance = fullY.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (fullY.length - 1);
    const sd = Math.sqrt(variance);
    const zRow5 = (fullY[5] - mean) / sd;
    expect(Math.abs(zRow5)).toBeLessThan(2);
  });
});

describe('runSpec — log1p shift only when negatives exist', () => {
  it('spec B (subgroup=all): filtered sample has negatives (min=-10) -> shifted', () => {
    const fx = specByName('B_all_log1p_shifted_income');
    const result = runSpec(micro12Dataset, fx.spec, asWindow(MICRO_N));
    expect(relErr(result.beta, fx.beta)).toBeLessThanOrEqual(1e-9);
    expect(result.n).toBe(12);
  });

  it('spec C (subgroup=urban): filtered sample is all-positive (min=9.8) -> unshifted', () => {
    const fx = specByName('C_urban_log1p_unshifted');
    const result = runSpec(micro12Dataset, fx.spec, asWindow(MICRO_N));
    expect(relErr(result.beta, fx.beta)).toBeLessThanOrEqual(1e-9);
    expect(result.n).toBe(6);
    // Directly confirm "unshifted": log1p(9.8) = log(1+9.8) = log(10.8) is
    // the smallest transformed value actually produced -- there is no
    // shift term folded in (if there were, the smallest transformed value
    // would be log(1 + 9.8 - 9.8) = log(1) = 0, not log(10.8)).
    expect(Math.log(10.8)).toBeGreaterThan(0.001);
  });
});

describe('runSpec — one-tailed sign rule, both directions', () => {
  it('t <= 0: p1 = 1 - p2/2 (spec D, age_ge40/risk, one-tailed)', () => {
    const fx = specByName('D_age_ge40_z2_5_risk_onetail');
    const result = runSpec(micro12Dataset, fx.spec, asWindow(MICRO_N));
    expect(result.t).toBeLessThanOrEqual(0);

    const twoTailSpec: Spec = { ...fx.spec, tails: 'two' };
    const twoTailResult = runSpec(micro12Dataset, twoTailSpec, asWindow(MICRO_N));
    const p2 = tTwoTailedP(result.t, result.n - 3); // p=3: intercept+x+risk
    expect(relErr(p2, twoTailResult.p)).toBeLessThanOrEqual(1e-9);
    expect(relErr(result.p, 1 - p2 / 2)).toBeLessThanOrEqual(1e-9);
  });

  it('t > 0: p1 = p2/2 (urban/z2/raw with y negated -- algebraic mirror of spec A)', () => {
    // Negating y negates beta and t but leaves |t|, se, and p2 unchanged
    // (residuals just negate too, so RSS is identical) -- an exact,
    // algebraically-known t>0 companion to fixture spec A's t=-3 (t<0),
    // which every fixture-driven spec above happens to share the sign of
    // (this 12-row dataset's x=1 rows are all lower-y by construction).
    const negated = buildDataset({
      ...fixture.dataset,
      y0: fixture.dataset.y0.map((v) => -v),
    });
    const spec: Spec = {
      outcome: 0,
      subgroup: 'urban',
      covariates: { income: false, risk: false },
      exclusion: 'z2',
      transform: 'raw',
      tails: 'one',
    };
    const twoTailSpec: Spec = { ...spec, tails: 'two' };

    const result = runSpec(negated, spec, asWindow(MICRO_N));
    const twoTailResult = runSpec(negated, twoTailSpec, asWindow(MICRO_N));

    expect(result.t).toBeGreaterThan(0);
    expect(result.beta).toBeCloseTo(0.25, 9); // -(-0.25) from spec A
    expect(relErr(result.p, twoTailResult.p / 2)).toBeLessThanOrEqual(1e-9);
  });
});

describe('runSpec — insufficient data (valid=false)', () => {
  it('every micro12 spec is invalid: a 12-row dataset can never reach MIN_CELL=30', () => {
    for (const fx of fixture.specs) {
      expect(fx.valid).toBe(false);
    }
  });

  it('spec F: OLS itself is invalid (df=4-4=0), not just below MIN_CELL -- beta/se/t=0, p=1, ci=[0,0]', () => {
    const fx = specByName('F_exp_low_both_covs_df0_onetail');
    const result = runSpec(micro12Dataset, fx.spec, asWindow(MICRO_N));
    expect(result.n).toBe(4);
    expect(result.valid).toBe(false);
    expect(result.beta).toBe(0);
    expect(result.se).toBe(0);
    expect(result.t).toBe(0);
    expect(result.p).toBe(1);
    expect(result.ci).toEqual([0, 0]);
  });

  it('MIN_CELL boundary: n=30 is valid, n=29 (same data, one row shorter) is not', () => {
    // 30 rows, x alternating with a clear (non-degenerate: nonzero residual
    // variance) positive relationship to y, subgroup='all'/exclusion='none'
    // so filtering never changes the count -- isolates the MIN_CELL
    // comparison itself (n>=30 iff valid, holding OLS validity fixed).
    const rows = 30;
    const x: number[] = [];
    const y0: number[] = [];
    for (let i = 0; i < rows; i++) {
      const xi = i % 2;
      x.push(xi);
      const wiggle = i % 2 === 0 ? 0.1 : -0.1;
      y0.push(10 + 3 * xi + wiggle);
    }
    const ds = buildDataset({
      age: new Array(rows).fill(30),
      urban: new Array(rows).fill(1),
      experience: new Array(rows).fill(1),
      income: new Array(rows).fill(1000),
      risk: new Array(rows).fill(0.5),
      x,
      y0,
    });
    const spec: Spec = {
      outcome: 0,
      subgroup: 'all',
      covariates: { income: false, risk: false },
      exclusion: 'none',
      transform: 'raw',
      tails: 'two',
    };

    const at30 = runSpec(ds, spec, asWindow(30));
    expect(at30.n).toBe(30);
    expect(at30.valid).toBe(true);

    const at29 = runSpec(ds, spec, asWindow(29));
    expect(at29.n).toBe(29);
    expect(at29.valid).toBe(false);
  });
});

describe('runSpec — all-excluded subgroup (zero rows match)', () => {
  it('no urban rows at all: finalN=0, no throw, deterministic zeroed-out result', () => {
    const rows = 5;
    const ds = buildDataset({
      age: new Array(rows).fill(25),
      urban: new Array(rows).fill(0), // no urban=1 rows anywhere
      experience: new Array(rows).fill(1),
      income: new Array(rows).fill(1000),
      risk: new Array(rows).fill(0.5),
      x: [1, 0, 1, 0, 1],
      y0: [1, 2, 3, 4, 5],
    });
    const spec: Spec = {
      outcome: 0,
      subgroup: 'urban',
      covariates: { income: false, risk: false },
      exclusion: 'z2', // also exercises zScores() on a zero-length array
      transform: 'raw',
      tails: 'two',
    };

    const result = runSpec(ds, spec, asWindow(rows));
    expect(result.n).toBe(0);
    expect(result.excludedCount).toBe(0);
    expect(result.valid).toBe(false);
    expect(result.beta).toBe(0);
    expect(result.se).toBe(0);
    expect(result.t).toBe(0);
    expect(result.p).toBe(1);
    expect(result.ci).toEqual([0, 0]);
    expect(Number.isNaN(result.beta)).toBe(false);
  });
});

describe('runSpec — CI property (50 specs over generateDataset(seed 7), no effect)', () => {
  const SUBGROUPS: Spec['subgroup'][] = ['all', 'age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'];
  const EXCLUSIONS: Spec['exclusion'][] = ['none', 'z3', 'z2_5', 'z2'];
  const TRANSFORMS: Spec['transform'][] = ['raw', 'log1p'];
  const TAILS: Spec['tails'][] = ['two', 'one'];
  const OUTCOMES: Outcome[] = [0, 1, 2, 3];
  // gr6-113: 40 is deliberately BELOW the product's own N_SCHEDULE (200..400)
  // and is here for one measured reason. Over generateDataset(7) the smallest
  // post-filter, post-exclusion cell any of these subgroup/exclusion
  // combinations reaches at n=200 is 57 — comfortably above MIN_CELL=30 — so
  // with the schedule windows alone all 50 sampled specs come back
  // `valid: true` and runSpec's invalid branch is never exercised at all. The
  // sixth window puts 11 of the 50 under MIN_CELL, which is what makes the
  // branch-hit counters below meaningful rather than decorative. Windowing
  // below the schedule is this file's established idiom (`asWindow`, already
  // used for the micro12 fixture at n=12 and for the n=29/30 MIN_CELL
  // boundary above) — runSpec takes its window as an explicit parameter and
  // has no schedule opinion.
  const WINDOWS: WindowN[] = [asWindow(40), 200, 250, 300, 350, 400];

  /** The number of design columns runSpec's OLS fits: intercept + x + covariates. */
  function designColumns(spec: Spec): number {
    return 2 + (spec.covariates.income ? 1 : 0) + (spec.covariates.risk ? 1 : 0);
  }

  // Deterministic mixed-radix enumeration over the combination space (no
  // Math.random -- fully reproducible). `index` is decomposed digit-by-digit
  // across each option list; a fixed stride (137, comfortably larger than
  // any single radix and not a divisor of the ~9000-combo space) spreads 50
  // samples across the space without repeats.
  function specAt(index: number): { spec: Spec; n: WindowN } {
    let idx = index;
    const outcome = OUTCOMES[idx % OUTCOMES.length];
    idx = Math.floor(idx / OUTCOMES.length);
    const subgroup = SUBGROUPS[idx % SUBGROUPS.length];
    idx = Math.floor(idx / SUBGROUPS.length);
    const income = idx % 2 === 1;
    idx = Math.floor(idx / 2);
    const risk = idx % 2 === 1;
    idx = Math.floor(idx / 2);
    const exclusion = EXCLUSIONS[idx % EXCLUSIONS.length];
    idx = Math.floor(idx / EXCLUSIONS.length);
    const transform = TRANSFORMS[idx % TRANSFORMS.length];
    idx = Math.floor(idx / TRANSFORMS.length);
    const tails = TAILS[idx % TAILS.length];
    idx = Math.floor(idx / TAILS.length);
    const n = WINDOWS[idx % WINDOWS.length];
    return { spec: { outcome, subgroup, covariates: { income, risk }, exclusion, transform, tails }, n };
  }

  const dataset = generateDataset(7, null);

  // gr6-113 (1): the relationship between runSpec's OWN `valid` and the two
  // things a test could re-derive from the result, pinned ONCE, here, instead
  // of being re-assumed by every branch key elsewhere. analyze.ts computes
  // `valid = fit.valid && finalN >= MIN_CELL`, and `fit.valid` is
  // `df > 0 && the design is non-singular`. On this dataset no sampled design
  // is singular, so `valid` is exactly `df > 0 && n >= MIN_CELL` — and if a
  // future change ever makes one singular, THIS test is the one that goes red,
  // in one place, with the spec named, rather than some downstream branch
  // quietly taking the wrong arm.
  it('runSpec.valid is exactly (df > 0 && n >= MIN_CELL) over the sampled specs — the definition every branch below reads', () => {
    const bad: string[] = [];
    for (let i = 0; i < 50; i++) {
      const { spec, n } = specAt(i * 137 + 5);
      const result = runSpec(dataset, spec, n);
      const df = result.n - designColumns(spec);
      const expected = df > 0 && result.n >= MIN_CELL;
      if (result.valid !== expected) {
        bad.push(
          `sample ${i} (window ${n}, ${spec.subgroup}/${spec.exclusion}, n=${result.n}, df=${df}): ` +
            `runSpec says valid=${result.valid}, (df > 0 && n >= ${MIN_CELL}) says ${expected} ` +
            `— a singular design is the only legitimate way these can disagree`,
        );
      }
    }
    expect(bad).toEqual([]);
  });

  // gr6-113 (2): this used to branch on a RE-DERIVED `df > 0` rather than on
  // runSpec's own answer, and — measured — every one of the 50 samples took
  // the `df > 0` arm, so it was a 50-iteration single-branch test whose else
  // arm nothing proved was reachable. It now branches on `result.valid`,
  // counts how often each arm is taken, and fails if either arm is dead.
  it('for 50 deterministically-sampled specs: ci always brackets beta; valid results relate ci to p; invalid ones are branched on runSpec\'s own verdict', () => {
    let validHits = 0;
    let invalidUnderMinCell = 0;
    let invalidOlsCouldNotRun = 0;

    for (let i = 0; i < 50; i++) {
      const { spec, n } = specAt(i * 137 + 5);
      const result = runSpec(dataset, spec, n);
      const where = `sample ${i} (window ${n}, ${spec.subgroup}/${spec.exclusion}, n=${result.n})`;

      expect(result.ci[0], where).toBeLessThanOrEqual(result.beta);
      expect(result.ci[1], where).toBeGreaterThanOrEqual(result.beta);

      const df = result.n - designColumns(spec);
      const excludesZero = result.ci[0] > 0 || result.ci[1] < 0;

      if (result.valid) {
        validHits++;
        const p2 = tTwoTailedP(result.t, df);
        expect(excludesZero, where).toBe(p2 < 0.05);
      } else if (df > 0) {
        // OLS ran; only MIN_CELL fell short. analyze.ts's own doc comment is
        // explicit that beta/se/t/p/ci carry REAL numbers here — the result is
        // withheld by the `valid` flag alone, never by zeroing — so the ci<->p
        // relation still holds and is worth asserting. This is precisely the
        // case the old `df > 0` branch key swallowed into the valid arm, where
        // it would have been checked against a placeholder the moment runSpec
        // started emitting one.
        invalidUnderMinCell++;
        expect(result.n, where).toBeLessThan(MIN_CELL);
        const p2 = tTwoTailedP(result.t, df);
        expect(excludesZero, where).toBe(p2 < 0.05);
      } else {
        // OLS itself could not run (df <= 0, or a singular design) —
        // runSpec's documented placeholder, not a meaningful CI at all.
        invalidOlsCouldNotRun++;
        expect(result.ci, where).toEqual([0, 0]);
        expect(result.p, where).toBe(1);
        expect(result.beta, where).toBe(0);
      }
    }

    // Both arms must be live. Without this the test can silently decay back
    // into the single-branch shape it had before gr6-113 — e.g. if the window
    // set or the dataset changes and every sample becomes valid again.
    expect(validHits, 'no sampled spec produced a VALID result').toBeGreaterThan(0);
    expect(
      invalidUnderMinCell + invalidOlsCouldNotRun,
      'no sampled spec produced an INVALID result — widen WINDOWS until one does',
    ).toBeGreaterThan(0);
    // Measured on the current dataset/window set: 39 valid, 11 invalid (all of
    // them the df > 0 / under-MIN_CELL kind), 0 df <= 0.
    expect(validHits + invalidUnderMinCell + invalidOlsCouldNotRun).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// T31: PathResult.cut — the Lab's DataCut figure payload (§2.4's "tiny
// scatter/box visual of the current cut"). A §6 extend-not-contradict
// addition: the TRANSFORMED outcome values of the CURRENT filtered window,
// split control/treated, with the excluded points kept separate rather than
// dropped — the figure's whole point is that outlier surgery is VISIBLE.
//
// Hand-computed fixture (`cutMicro`), 10 rows, so every number below is
// checkable by hand rather than by re-running the implementation:
//
//   y0 = [0,0,0,0,0, 0,0,0,0,10]   x = [0,0,0,0,0, 1,1,1,1,1]
//   mean = 1;  ss = 9*1 + 81 = 90;  sd = sqrt(90/9) = sqrt(10)   (stats.ts
//   uses the n-1 denominator)
//   z(0)  = (0-1)/sqrt(10)  = -1/sqrt(10) ≈ -0.3162
//   z(10) = (10-1)/sqrt(10) =  9/sqrt(10) ≈  2.8460
//
// so the single high value sits OUTSIDE |z|>2 and |z|>2.5 but INSIDE |z|>3 —
// one dataset that exercises both sides of the exclusion knob exactly.
describe('runSpec cut (T31: the DataCut figure payload)', () => {
  const CUT_Y0 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 10];
  const CUT_X = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
  // Five under 40 (rows 0-2 control, 5-6 treated) so a subgroup filter cuts
  // BOTH columns and the 10-outlier (row 9) drops out of the window entirely.
  const CUT_AGE = [30, 30, 30, 50, 50, 30, 30, 50, 50, 50];

  const cutMicro = buildDataset({
    age: CUT_AGE,
    urban: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    experience: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    income: [100, 110, 120, 130, 140, 150, 160, 170, 180, 190],
    risk: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    x: CUT_X,
    y0: CUT_Y0,
  });

  const baseSpec: Spec = {
    outcome: 0,
    subgroup: 'all',
    covariates: { income: false, risk: false },
    exclusion: 'none',
    transform: 'raw',
    tails: 'two',
  };

  const cut = (spec: Partial<Spec>) => runSpec(cutMicro, { ...baseSpec, ...spec }, asWindow(10)).cut;

  it('splits the window by treatment, with every value present and nothing excluded, at exclusion=none', () => {
    expect(cut({})).toEqual({
      control: [0, 0, 0, 0, 0],
      treated: [0, 0, 0, 0, 10],
      excludedControl: [],
      excludedTreated: [],
    });
  });

  it('moves the |z| = 9/sqrt(10) ≈ 2.85 point into excludedTreated at |z|>2.5, leaving the control column untouched', () => {
    expect(cut({ exclusion: 'z2_5' })).toEqual({
      control: [0, 0, 0, 0, 0],
      treated: [0, 0, 0, 0],
      excludedControl: [],
      excludedTreated: [10],
    });
  });

  it('excludes the same point at |z|>2', () => {
    expect(cut({ exclusion: 'z2' })).toEqual({
      control: [0, 0, 0, 0, 0],
      treated: [0, 0, 0, 0],
      excludedControl: [],
      excludedTreated: [10],
    });
  });

  it('keeps it at |z|>3 (2.846 <= 3): the knob really is the boundary, not a blanket "drop the max"', () => {
    expect(cut({ exclusion: 'z3' })).toEqual({
      control: [0, 0, 0, 0, 0],
      treated: [0, 0, 0, 0, 10],
      excludedControl: [],
      excludedTreated: [],
    });
  });

  it('carries TRANSFORMED values, not raw ones: log1p turns the 10 into log(11)', () => {
    const c = cut({ transform: 'log1p' });
    expect(c?.control).toEqual([0, 0, 0, 0, 0]);
    expect(c?.treated).toEqual([0, 0, 0, 0, Math.log(11)]);
  });

  it('re-splits under log1p: the transformed column has its own z-scores, so |z|>2 no longer bites', () => {
    // log1p compresses the outlier: values are nine 0s and one log(11) ≈
    // 2.3979, mean = 0.23979, sd = sqrt((9*0.23979^2 + (2.3979-0.23979)^2)/9)
    // = sqrt(10)/10 * 2.3979 ≈ 0.7583, so z(log 11) = 9/sqrt(10) ≈ 2.846 —
    // the SAME z, because log1p here is a monotone relabelling of a two-point
    // distribution. Exclusion therefore still bites at 2.5 and not at 3.
    expect(cut({ transform: 'log1p', exclusion: 'z2_5' })?.excludedTreated).toEqual([Math.log(11)]);
    expect(cut({ transform: 'log1p', exclusion: 'z3' })?.excludedTreated).toEqual([]);
  });

  it('is scoped to the subgroup-filtered window: age<40 keeps 3 control + 2 treated and drops the outlier row', () => {
    expect(cut({ subgroup: 'age_lt40' })).toEqual({
      control: [0, 0, 0],
      treated: [0, 0],
      excludedControl: [],
      excludedTreated: [],
    });
  });

  it('is still assembled when the fit is invalid (n < MIN_CELL) — the figure shows the data the dial cannot analyse', () => {
    const result = runSpec(cutMicro, baseSpec, asWindow(10));
    expect(result.valid).toBe(false);
    expect(result.cut).toBeDefined();
    expect((result.cut?.control.length ?? 0) + (result.cut?.treated.length ?? 0)).toBe(10);
  });

  it('accounts for every windowed row exactly once, and agrees with excludedCount, across the real DGP at every window', () => {
    const dataset = generateDataset(11, null);
    for (const n of [200, 400] as WindowN[]) {
      for (const exclusion of ['none', 'z3', 'z2_5', 'z2'] as Spec['exclusion'][]) {
        const result = runSpec(dataset, { ...baseSpec, exclusion }, n);
        const c = result.cut;
        expect(c).toBeDefined();
        const kept = (c?.control.length ?? 0) + (c?.treated.length ?? 0);
        const dropped = (c?.excludedControl.length ?? 0) + (c?.excludedTreated.length ?? 0);
        expect(kept).toBe(result.n);
        expect(dropped).toBe(result.excludedCount);
        expect(kept + dropped).toBe(n); // subgroup 'all' -> the whole window
        expect(kept + dropped).toBeLessThanOrEqual(400); // the pinned cap
      }
    }
  });

  it('never exceeds 400 values in total, for any subgroup, at the largest window', () => {
    const dataset = generateDataset(12, null);
    const subgroups: Spec['subgroup'][] = ['all', 'age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'];
    for (const subgroup of subgroups) {
      const c = runSpec(dataset, { ...baseSpec, subgroup, exclusion: 'z2' }, 400).cut;
      const total =
        (c?.control.length ?? 0) + (c?.treated.length ?? 0) + (c?.excludedControl.length ?? 0) + (c?.excludedTreated.length ?? 0);
      expect(total).toBeLessThanOrEqual(400);
    }
  });

  it('is a pure function of its inputs: two runs of the same spec produce identical arrays', () => {
    const dataset = generateDataset(13, null);
    const spec: Spec = { ...baseSpec, subgroup: 'urban', exclusion: 'z2', transform: 'log1p' };
    expect(runSpec(dataset, spec, 250).cut).toEqual(runSpec(dataset, spec, 250).cut);
  });
});
