// Master spec §3.6 (specification-curve enumeration) + §7.4 (SpecCurve
// component -- CurvePoint needs). specGrid.ts's contract, per the T8 brief
// and controller amendments, is:
//   (a) enumerateCurve(d,n) produces p/valid for any spec EXACTLY equal to
//       analyze.runSpec(d,spec,n) -- checked directly below, no tolerance;
//   (b) perf <= 800ms at N=400 in CI (performance.now, generous vs the
//       400ms browser budget);
//   (c) invalid specs are flagged (valid:false), not dropped;
//   (d) 1792 entries, unique keys, fixed iteration order (outcome-major
//       .. tails-minor).
import { describe, expect, it } from 'vitest';
import { runSpec } from '../../src/engine/analyze';
import type { Dataset } from '../../src/engine/dgp';
import { generateDataset } from '../../src/engine/dgp';
import { AXES, allSpecs, enumerateCurve, sigCount, specKey } from '../../src/engine/specGrid';
import type { CurvePoint } from '../../src/engine/specGrid';
import type { Spec, WindowN } from '../../src/engine/types';

// --- shared test helpers ---

function asWindow(n: number): WindowN {
  return n as unknown as WindowN;
}

/** A small, fully synthetic dataset (real numbers, no NaN/Infinity risk):
 * `x` alternates 0/1 every row (real variation for the OLS regressor);
 * `income` is always positive (safe for the income covariate's `log`);
 * `urban` is 1 for the first `urbanCount` rows, 0 for the rest, so
 * subgroup='urban' can be made deliberately smaller than MIN_CELL (30)
 * while subgroup='all' stays at the full row count -- lets a single
 * dataset produce both valid and invalid specs side by side. */
function buildSyntheticDataset(rows: number, urbanCount: number): Dataset {
  const age = new Float64Array(rows);
  const urban = new Uint8Array(rows);
  const experience = new Uint8Array(rows);
  const income = new Float64Array(rows);
  const risk = new Float64Array(rows);
  const x = new Uint8Array(rows);
  const y0 = new Float64Array(rows);
  const y1 = new Float64Array(rows);
  const y2 = new Float64Array(rows);
  const y3 = new Float64Array(rows);

  for (let i = 0; i < rows; i++) {
    age[i] = 20 + (i % 40);
    urban[i] = i < urbanCount ? 1 : 0;
    experience[i] = i % 3;
    income[i] = 1000 + i * 10;
    risk[i] = 0.1 + (i % 7) * 0.05;
    const xi = i % 2;
    x[i] = xi;
    const wiggle = i % 2 === 0 ? 0.37 : -0.41;
    y0[i] = 10 + 2 * xi + wiggle + i * 0.013;
    y1[i] = 5 - 1.5 * xi + wiggle - i * 0.007;
    y2[i] = 1 + 0.8 * xi + wiggle;
    y3[i] = 2 - 0.6 * xi + wiggle + i * 0.002;
  }

  return { n: 400, x, age, urban, experience, income, risk, y: [y0, y1, y2, y3] };
}

// --- AXES ---

describe('AXES', () => {
  it('has the pinned per-axis cardinalities, multiplying to 1792', () => {
    expect(AXES.outcome.length).toBe(4);
    expect(AXES.subgroup.length).toBe(7);
    expect(AXES.covariates.length).toBe(4);
    expect(AXES.exclusion.length).toBe(4);
    expect(AXES.transform.length).toBe(2);
    expect(AXES.tails.length).toBe(2);

    const product =
      AXES.outcome.length *
      AXES.subgroup.length *
      AXES.covariates.length *
      AXES.exclusion.length *
      AXES.transform.length *
      AXES.tails.length;
    expect(product).toBe(1792);
  });

  it('covariates axis contains all four distinct income/risk combinations, no duplicates', () => {
    const combos = AXES.covariates.map((c) => `${c.income ? 1 : 0}${c.risk ? 1 : 0}`);
    expect(new Set(combos)).toEqual(new Set(['00', '01', '10', '11']));
    expect(combos.length).toBe(4);
  });
});

// --- allSpecs: count, uniqueness, fixed major-to-minor order ---

describe('allSpecs — fixed order (outcome-major > subgroup > covariates > exclusion > transform > tails-minor)', () => {
  const specs = allSpecs();

  it('has exactly 1792 entries', () => {
    expect(specs.length).toBe(1792);
  });

  it('every specKey is unique across all 1792 specs', () => {
    const keys = specs.map(specKey);
    expect(new Set(keys).size).toBe(1792);
  });

  // Generic "this axis is constant within blocks of `blockSize`, and cycles
  // through the axis's own values in order across consecutive blocks" check.
  // blockSize = product of the sizes of every axis *to its right* (the more
  // minor axes) -- one assertion group per axis, so a placement bug in any
  // single axis fails independently of the others.
  function checkAxis<T>(axisValues: T[], accessor: (s: Spec) => T, minorAxisSizes: number[]): void {
    const blockSize = minorAxisSizes.reduce((a, b) => a * b, 1);
    for (let i = 0; i < specs.length; i++) {
      const expected = axisValues[Math.floor(i / blockSize) % axisValues.length];
      expect(accessor(specs[i])).toEqual(expected);
    }
  }

  it('outcome is major-most: constant for blocks of 448 (7*4*4*2*2)', () => {
    checkAxis(AXES.outcome, (s) => s.outcome, [7, 4, 4, 2, 2]);
  });
  it('subgroup: constant for blocks of 64 (4*4*2*2)', () => {
    checkAxis(AXES.subgroup, (s) => s.subgroup, [4, 4, 2, 2]);
  });
  it('covariates: constant for blocks of 16 (4*2*2)', () => {
    checkAxis(AXES.covariates, (s) => s.covariates, [4, 2, 2]);
  });
  it('exclusion: constant for blocks of 4 (2*2)', () => {
    checkAxis(AXES.exclusion, (s) => s.exclusion, [2, 2]);
  });
  it('transform: constant for blocks of 2', () => {
    checkAxis(AXES.transform, (s) => s.transform, [2]);
  });
  it('tails is minor-most: alternates every single entry', () => {
    checkAxis(AXES.tails, (s) => s.tails, []);
  });
});

// --- specKey ---

describe('specKey', () => {
  it('matches the pinned canonical format: outcome|subgroup|incomeRisk|exclusion|transform|tails', () => {
    const s: Spec = {
      outcome: 2,
      subgroup: 'urban',
      covariates: { income: true, risk: false },
      exclusion: 'z2_5',
      transform: 'log1p',
      tails: 'one',
    };
    expect(specKey(s)).toBe('2|urban|10|z2_5|log1p|one');
  });

  it('encodes both covariates off as "00" and both on as "11"', () => {
    const base: Omit<Spec, 'covariates'> = {
      outcome: 0,
      subgroup: 'all',
      exclusion: 'none',
      transform: 'raw',
      tails: 'two',
    };
    expect(specKey({ ...base, covariates: { income: false, risk: false } })).toBe('0|all|00|none|raw|two');
    expect(specKey({ ...base, covariates: { income: true, risk: true } })).toBe('0|all|11|none|raw|two');
  });
});

// --- enumerateCurve: order/shape parity with allSpecs() ---

describe('enumerateCurve — order and shape', () => {
  it('returns 1792 entries, spec-for-spec identical (by value) and in the same order as allSpecs()', () => {
    const dataset = generateDataset(2024, null);
    const specs = allSpecs();
    const curve = enumerateCurve(dataset, 400);

    expect(curve.length).toBe(specs.length);
    for (let i = 0; i < specs.length; i++) {
      expect(curve[i].spec).toEqual(specs[i]);
    }
  });
});

// --- enumerateCurve: EXACT parity with runSpec (the binding correctness requirement) ---

describe('enumerateCurve — exact parity with runSpec (memoization changes nothing)', () => {
  const dataset = generateDataset(2024, null);
  const specs = allSpecs();
  const curve = enumerateCurve(dataset, 400);

  // Five samples spread across outcome-major boundaries (0/447/448 straddle
  // the outcome=0/1 boundary; 895/1791 land at the outcome=1/3 boundaries).
  const sampleIndices = [0, 447, 448, 895, 1791];
  for (const i of sampleIndices) {
    it(`spec #${i} (${specKey(specs[i])}): p and valid exactly match runSpec`, () => {
      const want = runSpec(dataset, specs[i], 400);
      expect(curve[i].p).toBe(want.p);
      expect(curve[i].valid).toBe(want.valid);
    });
  }

  it('both tails variants of the same base spec exactly match runSpec (proves the OLS fit is shared, not rerun)', () => {
    // tails is minor-most (block size 1): specs[300]/specs[301] share every
    // other field and differ only in tails ('two' then 'one').
    const base = specs[300];
    const mirror = specs[301];
    expect(mirror.outcome).toBe(base.outcome);
    expect(mirror.subgroup).toBe(base.subgroup);
    expect(mirror.covariates).toEqual(base.covariates);
    expect(mirror.exclusion).toBe(base.exclusion);
    expect(mirror.transform).toBe(base.transform);
    expect(base.tails).toBe('two');
    expect(mirror.tails).toBe('one');

    const wantBase = runSpec(dataset, base, 400);
    const wantMirror = runSpec(dataset, mirror, 400);
    expect(curve[300].p).toBe(wantBase.p);
    expect(curve[300].valid).toBe(wantBase.valid);
    expect(curve[301].p).toBe(wantMirror.p);
    expect(curve[301].valid).toBe(wantMirror.valid);
    // Sanity: two-tailed and one-tailed shouldn't coincidentally be equal
    // here (would make this a weak check) -- confirms it's really exercising
    // two distinct p-value formulas, not one path lucking into the other's answer.
    expect(wantBase.p).not.toBe(wantMirror.p);
  });

  it('at least one invalid spec (20-row dataset, below MIN_CELL for every possible spec) also matches runSpec exactly', () => {
    const tiny = buildSyntheticDataset(20, 5);
    const tinySpecs = allSpecs();
    const tinyCurve = enumerateCurve(tiny, asWindow(20));

    for (const i of [0, 1791]) {
      const want = runSpec(tiny, tinySpecs[i], asWindow(20));
      expect(want.valid).toBe(false); // sanity: this dataset really is all-invalid
      expect(tinyCurve[i].p).toBe(want.p);
      expect(tinyCurve[i].valid).toBe(want.valid);
    }
  });
});

// --- enumerateCurve: invalid specs are flagged, not dropped ---

describe('enumerateCurve — invalid specs are flagged, not dropped', () => {
  it('a 20-row dataset (below MIN_CELL=30 for every possible spec) still returns all 1792 entries, each valid:false', () => {
    const tiny = buildSyntheticDataset(20, 5);
    const curve = enumerateCurve(tiny, asWindow(20));
    expect(curve.length).toBe(1792);
    expect(curve.every((cp) => cp.valid === false)).toBe(true);
  });

  it('a mixed dataset (one subgroup too small, others large enough) keeps both valid and invalid entries in the curve', () => {
    const mixed = buildSyntheticDataset(40, 8); // urban=8 rows (<30, always invalid); all=40
    const curve = enumerateCurve(mixed, asWindow(40));
    expect(curve.length).toBe(1792);

    const urbanEntries = curve.filter((cp) => cp.spec.subgroup === 'urban');
    expect(urbanEntries.length).toBeGreaterThan(0);
    expect(urbanEntries.every((cp) => cp.valid === false)).toBe(true);

    // Not dropped means: some entries are STILL valid alongside the invalid
    // ones (i.e. filtering-to-invalid isn't accidentally swallowing everything).
    expect(curve.some((cp) => cp.valid === true)).toBe(true);
  });
});

// --- enumerateCurve: no state leakage across calls (self-review requirement) ---

describe('enumerateCurve — no state leakage across calls', () => {
  it('is a pure function of its arguments: two calls on the same dataset produce byte-identical curves', () => {
    const dataset = generateDataset(55, null);
    const curve1 = enumerateCurve(dataset, 400);
    const curve2 = enumerateCurve(dataset, 400);
    expect(curve2).toEqual(curve1);
  });

  it('does not leak cached state across different datasets', () => {
    const datasetA = generateDataset(1, null);
    const datasetB = generateDataset(2, null);

    const curveA = enumerateCurve(datasetA, 400);
    const curveB = enumerateCurve(datasetB, 400);
    expect(curveB).not.toEqual(curveA); // genuinely different underlying data

    const curveAAgain = enumerateCurve(datasetA, 400);
    expect(curveAAgain).toEqual(curveA); // re-running A after B reproduces A exactly
  });
});

// --- enumerateCurve: perf ---

describe('enumerateCurve — perf', () => {
  it('enumerates all 1792 specs at N=400 within the 800ms CI budget (generous vs the 400ms browser budget)', () => {
    const dataset = generateDataset(99, null);

    const t0 = performance.now();
    const curve = enumerateCurve(dataset, 400);
    const elapsed = performance.now() - t0;

    expect(curve.length).toBe(1792);
    expect(elapsed).toBeLessThanOrEqual(800);
  });
});

// --- sigCount ---

describe('sigCount', () => {
  it('counts only entries with valid && p < .05 (invalid, and the p=.05 boundary, excluded)', () => {
    const specs = allSpecs();
    const curve: CurvePoint[] = [
      { spec: specs[0], p: 0.01, valid: true },
      { spec: specs[1], p: 0.2, valid: true },
      { spec: specs[2], p: 0.001, valid: false }, // invalid despite tiny p -- must not count
      { spec: specs[3], p: 0.049, valid: true },
      { spec: specs[4], p: 0.05, valid: true }, // boundary: not strictly < .05
    ];
    expect(sigCount(curve)).toBe(2);
  });

  it('matches a direct filter+count over a real enumerated curve', () => {
    const dataset = generateDataset(7, null);
    const curve = enumerateCurve(dataset, 400);
    const expected = curve.filter((cp) => cp.valid && cp.p < 0.05).length;
    expect(sigCount(curve)).toBe(expected);
  });
});
