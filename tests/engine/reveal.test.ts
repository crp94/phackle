// Master spec §2.7 (reveal: verdict stamp + the accounting paragraph), §3.7
// (reveal metrics + the P(>=1 hit | k explored) lookup table), §6
// (RevealMetrics). reveal.ts's contract, per the T10 brief and controller
// amendments:
//   (a) verdictStamp is a pure truth table over (dayType, published,
//       trueOutcome) -- including the spec's signature edge case, §2.7.4's
//       "you can fabricate a false positive on a true-effect day by
//       publishing the WRONG outcome" => RETRACTED, not REPLICATED;
//   (b) buildRevealMetrics counts straight off the enumerated curve (the
//       chance line is "computed exactly from the enumerated curve", §2.7.3)
//       and marks explored/published by SPEC VALUE, never object identity;
//   (c) pHitAtK reads src/data/p_hit_by_k.json at k = explored.length clamped
//       into [1, 40] -- never an analytic 1-(1-q)^k (§3.7: that would
//       overstate, since paths are correlated);
//   (d) a stale table (checksum != the DGP constant vector's) throws rather
//       than silently reporting numbers generated under a different DGP.
import { describe, expect, it } from 'vitest';
import type { GeneratedDay } from '../../src/engine/day';
import { generateDataset } from '../../src/engine/dgp';
import { fnv1a32 } from '../../src/engine/prng';
import {
  P_HIT_MAX_K,
  assertPHitTable,
  buildRevealMetrics,
  dgpConstantVector,
  pHitAtK,
  pHitTableChecksum,
  verdictStamp,
} from '../../src/engine/reveal';
import { allSpecs, specKey } from '../../src/engine/specGrid';
import type { CurvePoint } from '../../src/engine/specGrid';
import type { DailyPuzzle, DayType, Outcome, Spec } from '../../src/engine/types';
import shippedTable from '../../src/data/p_hit_by_k.json';

const SPECS = allSpecs();

/** A dataset is required by GeneratedDay's shape but never read by
 * buildRevealMetrics (which only consults `day.puzzle`) -- generated once here
 * so the tests can pass a REAL GeneratedDay instead of a cast. */
const DATA = generateDataset(fnv1a32('reveal-test'), null);

function fakeDay(overrides: Partial<DailyPuzzle>): GeneratedDay {
  const puzzle: DailyPuzzle = {
    isoDate: '2026-09-01',
    puzzleNumber: 23,
    scenarioId: '7',
    dayType: 'null',
    attemptUsed: 0,
    capExhausted: false,
    nFull: 400,
    ...overrides,
  };
  return { puzzle, data: DATA };
}

/** A spec with the given outcome, taken from the real 1,792-spec grid (so
 * specKey round-trips and the "same value, different object" test below is
 * about VALUES, not about hand-rolled shapes). */
function specWithOutcome(outcome: Outcome, offset = 0): Spec {
  const matches = SPECS.filter((s) => s.outcome === outcome);
  return matches[offset];
}

/** Structural clone -- same field values, different object identity. */
function cloneSpec(s: Spec): Spec {
  return { ...s, covariates: { ...s.covariates } };
}

function point(spec: Spec, p: number, valid = true): CurvePoint {
  return { spec, p, valid };
}

// --- (a) verdict stamp truth table (§2.7.4) ---

describe('verdictStamp', () => {
  const published0 = specWithOutcome(0);
  const published2 = specWithOutcome(2);

  const cases: { name: string; dayType: DayType; published: Spec | null; trueOutcome: Outcome | null; want: string }[] =
    [
      // §1(j)(2) — THE HONEST VERDICT IS DAY-TYPED. Both rows used to want
      // the single NULL_REPORTED, which is why an honest player could not
      // reach a positive verdict on the day they were right: the stamp said
      // the same thing whether they had confirmed a null or walked past a
      // real effect, while the score paid 80 for one and 20 for the other.
      // These two rows are the whole of the ruling's stamp half.
      {
        name: 'null day, nothing published (abandoned) -> CONFIRMED_NULL — the honest player was RIGHT',
        dayType: 'null',
        published: null,
        trueOutcome: null,
        want: 'CONFIRMED_NULL',
      },
      {
        name: 'effect day, nothing published (abandoned) -> MISSED_DISCOVERY — a real effect went unreported',
        dayType: 'effect',
        published: null,
        trueOutcome: 2,
        want: 'MISSED_DISCOVERY',
      },
      // The distinction is on the DAY, not on what the player happened to
      // have looked at: an abandoned effect day whose trueOutcome is missing
      // (the defensive shape the signature admits) is still a missed
      // discovery, because `published === null` is resolved first.
      {
        name: 'effect day, nothing published, no recorded trueOutcome -> MISSED_DISCOVERY',
        dayType: 'effect',
        published: null,
        trueOutcome: null,
        want: 'MISSED_DISCOVERY',
      },
      {
        name: 'null day, published -> RETRACTED (the signature moment)',
        dayType: 'null',
        published: published0,
        trueOutcome: null,
        want: 'RETRACTED',
      },
      {
        name: 'effect day, published on the true outcome -> REPLICATED',
        dayType: 'effect',
        published: published2,
        trueOutcome: 2,
        want: 'REPLICATED',
      },
      {
        name: 'effect day, published on the WRONG outcome -> RETRACTED (§2.7.4)',
        dayType: 'effect',
        published: published0,
        trueOutcome: 2,
        want: 'RETRACTED',
      },
      {
        name: 'effect day with no recorded trueOutcome (defensive) -> RETRACTED',
        dayType: 'effect',
        published: published2,
        trueOutcome: null,
        want: 'RETRACTED',
      },
    ];

  for (const c of cases) {
    it(c.name, () => {
      expect(verdictStamp(c.dayType, c.published, c.trueOutcome)).toBe(c.want);
    });
  }

  it('is REPLICATED exactly on the diagonal across all 4x4 (trueOutcome, published outcome) pairs', () => {
    const outcomes: Outcome[] = [0, 1, 2, 3];
    for (const trueOutcome of outcomes) {
      for (const publishedOutcome of outcomes) {
        const stamp = verdictStamp('effect', specWithOutcome(publishedOutcome), trueOutcome);
        expect(stamp).toBe(trueOutcome === publishedOutcome ? 'REPLICATED' : 'RETRACTED');
      }
    }
  });

  it('ignores every spec field except outcome (subgroup/covariates/exclusion/transform/tails are not "the family")', () => {
    const canonical = SPECS.filter((s) => s.outcome === 1);
    for (const spec of [canonical[0], canonical[100], canonical[447]]) {
      expect(verdictStamp('effect', spec, 1)).toBe('REPLICATED');
    }
  });
});

// --- (b) metrics counted off a synthetic curve (§2.7.3, §3.7) ---

describe('buildRevealMetrics — counts from a synthetic curve', () => {
  // 10 points: 3 significant-and-valid, 1 significant-looking but INVALID
  // (n < MIN_CELL -- must not count and must not reach the payload), 6 plainly
  // non-significant.
  const s = (i: number) => SPECS[i * 37]; // spread across outcomes/subgroups
  const curve: CurvePoint[] = [
    point(s(0), 0.001),
    point(s(1), 0.02),
    point(s(2), 0.049),
    point(s(3), 0.0001, false), // invalid: significant p, excluded everywhere
    point(s(4), 0.05), // exactly at the threshold -> NOT significant (p < .05)
    point(s(5), 0.2),
    point(s(6), 0.31),
    point(s(7), 0.5),
    point(s(8), 0.77),
    point(s(9), 0.99),
  ];

  const published = s(1);
  const explored = [s(0), s(1), s(5)];

  it('counts totalPaths over the whole enumerated grid and sigPaths over valid p<.05 only', () => {
    const m = buildRevealMetrics(fakeDay({ dayType: 'null' }), curve, published, explored, 0);
    expect(m.totalPaths).toBe(10);
    expect(m.sigPaths).toBe(3);
    expect(m.sigFraction).toBeCloseTo(3 / 10, 12);
  });

  it('reports playerExplored as the caller-supplied fork count', () => {
    const m = buildRevealMetrics(fakeDay({}), curve, published, explored, 0);
    expect(m.playerExplored).toBe(3);
  });

  it('passes peeks through untouched', () => {
    expect(buildRevealMetrics(fakeDay({}), curve, published, explored, 0).peeks).toBe(0);
    expect(buildRevealMetrics(fakeDay({}), curve, published, explored, 4).peeks).toBe(4);
  });

  it('omits invalid points from the payload curve (§3.4: excluded from the curve)', () => {
    const m = buildRevealMetrics(fakeDay({}), curve, published, explored, 0);
    expect(m.curve).toHaveLength(9);
    expect(m.curve.map((e) => e.p)).not.toContain(0.0001);
    // T16's SpecCurve derives its "n specs had insufficient data" footnote
    // from exactly this difference.
    expect(m.totalPaths - m.curve.length).toBe(1);
  });

  it('carries each payload entry as {p, explored, published, outcome, spec}', () => {
    const m = buildRevealMetrics(fakeDay({}), curve, published, explored, 0);
    const entry = m.curve.find((e) => specKey(e.spec) === specKey(published));
    expect(entry).toBeDefined();
    expect(Object.keys(entry!).sort()).toEqual(['explored', 'outcome', 'p', 'published', 'spec']);
    expect(entry!.outcome).toBe(published.outcome);
    expect(entry!.p).toBe(0.02);
  });

  it('marks explored/published by spec VALUE, not object identity', () => {
    const m = buildRevealMetrics(
      fakeDay({}),
      curve,
      cloneSpec(published),
      explored.map(cloneSpec),
      0,
    );
    const flagged = m.curve.filter((e) => e.explored).map((e) => specKey(e.spec));
    expect(flagged.sort()).toEqual(explored.map(specKey).sort());
    const publishedEntries = m.curve.filter((e) => e.published).map((e) => specKey(e.spec));
    expect(publishedEntries).toEqual([specKey(published)]);
  });

  it('marks nothing as published when the player abandoned', () => {
    const m = buildRevealMetrics(fakeDay({}), curve, null, explored, 0);
    expect(m.curve.some((e) => e.published)).toBe(false);
    expect(m.stamp).toBe('CONFIRMED_NULL');
  });

  it('flags a spec that was both explored and published on both axes', () => {
    const m = buildRevealMetrics(fakeDay({}), curve, published, explored, 0);
    const entry = m.curve.find((e) => specKey(e.spec) === specKey(published))!;
    expect(entry.explored).toBe(true);
    expect(entry.published).toBe(true);
  });

  it('takes the stamp from the day + published spec (effect day, wrong outcome -> RETRACTED)', () => {
    const trueOutcome = ((published.outcome + 1) % 4) as Outcome;
    const m = buildRevealMetrics(
      fakeDay({ dayType: 'effect', trueOutcome, trueBeta: 0.24 }),
      curve,
      published,
      explored,
      0,
    );
    expect(m.stamp).toBe('RETRACTED');

    const right = buildRevealMetrics(
      fakeDay({ dayType: 'effect', trueOutcome: published.outcome, trueBeta: 0.24 }),
      curve,
      published,
      explored,
      0,
    );
    expect(right.stamp).toBe('REPLICATED');
  });

  it('handles an all-invalid curve without dividing by zero', () => {
    const dead = curve.map((pt) => ({ ...pt, valid: false }));
    const m = buildRevealMetrics(fakeDay({}), dead, null, [], 0);
    expect(m.sigPaths).toBe(0);
    expect(m.sigFraction).toBe(0);
    expect(m.curve).toHaveLength(0);
  });
});

// --- (e) gr6-001: the day-typed hit split (§2.7.3's accounting) ---
//
// GR1a measured that ~70% of an effect day's significant paths sit on the
// outcome the day declared real one line earlier, and the reveal called all of
// them "chance alone". The accounting cannot be honest without the split, and
// the split cannot be computed downstream: `RevealPayload['curve']` carries
// VALID points only and no p < .05 threshold, so the count belongs where the
// threshold already lives.

describe('buildRevealMetrics — the day-typed hit split (gr6-001)', () => {
  /** Four significant points on outcome 1, three on other outcomes, one
   * significant-but-INVALID on outcome 1 (must count nowhere), plus filler. */
  const sigOn = (outcome: Outcome, offset: number) => specWithOutcome(outcome, offset);
  const curve: CurvePoint[] = [
    point(sigOn(1, 0), 0.001),
    point(sigOn(1, 1), 0.01),
    point(sigOn(1, 2), 0.02),
    point(sigOn(1, 3), 0.049),
    point(sigOn(1, 4), 0.0001, false), // invalid: counts nowhere
    point(sigOn(0, 0), 0.004),
    point(sigOn(2, 0), 0.03),
    point(sigOn(3, 0), 0.041),
    point(sigOn(1, 5), 0.5), // valid, not significant
    point(sigOn(0, 1), 0.9),
  ];

  it('splits an effect day into true-outcome hits and everything else', () => {
    const m = buildRevealMetrics(
      fakeDay({ dayType: 'effect', trueOutcome: 1, trueBeta: 0.24 }),
      curve,
      null,
      [],
      0,
    );
    expect(m.sigPaths).toBe(7);
    expect(m.sigTrueOutcome).toBe(4);
    expect(m.sigOtherOutcome).toBe(3);
  });

  it('always partitions sigPaths exactly — the two counts sum to it, on every day type', () => {
    for (const day of [
      fakeDay({ dayType: 'effect', trueOutcome: 1, trueBeta: 0.24 }),
      fakeDay({ dayType: 'effect', trueOutcome: 0, trueBeta: 0.24 }),
      fakeDay({ dayType: 'effect', trueOutcome: 3, trueBeta: 0.24 }),
      fakeDay({ dayType: 'null' }),
    ]) {
      const m = buildRevealMetrics(day, curve, null, [], 0);
      expect(m.sigTrueOutcome + m.sigOtherOutcome).toBe(m.sigPaths);
    }
  });

  it('puts every hit on the "other" side of a NULL day: there is no true outcome to be on', () => {
    const m = buildRevealMetrics(fakeDay({ dayType: 'null' }), curve, null, [], 0);
    expect(m.sigTrueOutcome).toBe(0);
    expect(m.sigOtherOutcome).toBe(7);
  });

  it('never counts an invalid point on either side (an unanalyzable spec is not a hit)', () => {
    // The invalid point sits on outcome 1 at p = 0.0001: if the split counted
    // it, the effect day above would read 5 true-outcome hits, not 4.
    const m = buildRevealMetrics(
      fakeDay({ dayType: 'effect', trueOutcome: 1, trueBeta: 0.24 }),
      curve,
      null,
      [],
      0,
    );
    expect(m.sigTrueOutcome).toBe(4);
    expect(m.curve.some((e) => e.p === 0.0001)).toBe(false);
  });

  it('reads p < .05 strictly, on the true-outcome side too (0.05 is not a hit)', () => {
    const boundary: CurvePoint[] = [point(sigOn(1, 0), 0.05), point(sigOn(1, 1), 0.0499)];
    const m = buildRevealMetrics(
      fakeDay({ dayType: 'effect', trueOutcome: 1, trueBeta: 0.24 }),
      boundary,
      null,
      [],
      0,
    );
    expect(m.sigPaths).toBe(1);
    expect(m.sigTrueOutcome).toBe(1);
    expect(m.sigOtherOutcome).toBe(0);
  });

  it('treats an effect day whose trueOutcome went missing as having no true-outcome hits', () => {
    // day.ts's assemblePuzzle always sets trueOutcome on an effect day, but the
    // type admits the absence and verdictStamp already resolves it explicitly
    // rather than by a `undefined === undefined` accident. Same discipline here.
    const m = buildRevealMetrics(fakeDay({ dayType: 'effect', trueBeta: 0.24 }), curve, null, [], 0);
    expect(m.sigTrueOutcome).toBe(0);
    expect(m.sigOtherOutcome).toBe(m.sigPaths);
  });
});

// --- (c) pHitAtK reads the table (§3.7) ---

describe('pHitAtK', () => {
  it('reads the shipped table verbatim at 1..40, per day type', () => {
    for (const k of [1, 2, 7, 14, 25, P_HIT_MAX_K]) {
      expect(pHitAtK(k, 'null')).toBe(shippedTable.pHitNull[k]);
      expect(pHitAtK(k, 'effect')).toBe(shippedTable.pHitEffect[k]);
    }
  });

  it('clamps k into [1, 40]', () => {
    expect(pHitAtK(0, 'null')).toBe(shippedTable.pHitNull[1]);
    expect(pHitAtK(-5, 'null')).toBe(shippedTable.pHitNull[1]);
    expect(pHitAtK(41, 'null')).toBe(shippedTable.pHitNull[P_HIT_MAX_K]);
    expect(pHitAtK(10_000, 'effect')).toBe(shippedTable.pHitEffect[P_HIT_MAX_K]);
  });

  it('is fed by buildRevealMetrics at k = explored.length, on the DAY\'S OWN vector (gr6-002)', () => {
    const curve = [point(SPECS[0], 0.01)];
    for (const k of [0, 1, 5, 40, 60]) {
      const explored = SPECS.slice(0, k);
      const nullDay = buildRevealMetrics(fakeDay({ dayType: 'null' }), curve, null, explored, 0);
      expect(nullDay.playerExplored).toBe(k);
      expect(nullDay.pHitAtK).toBe(pHitAtK(k, 'null'));

      const effectDay = buildRevealMetrics(
        fakeDay({ dayType: 'effect', trueOutcome: 0, trueBeta: 0.24 }),
        curve,
        null,
        explored,
        0,
      );
      expect(effectDay.pHitAtK).toBe(pHitAtK(k, 'effect'));
    }
  });

  it('does NOT quote the null-day number on an effect day (the defect gr6-002 names)', () => {
    // GR1a measured 23% shown against 51% true at k = 5. The two vectors must
    // therefore be genuinely different objects, not the same numbers twice.
    const curve = [point(SPECS[0], 0.01)];
    const explored = SPECS.slice(0, 5);
    const nullDay = buildRevealMetrics(fakeDay({ dayType: 'null' }), curve, null, explored, 0);
    const effectDay = buildRevealMetrics(
      fakeDay({ dayType: 'effect', trueOutcome: 0, trueBeta: 0.24 }),
      curve,
      null,
      explored,
      0,
    );
    expect(effectDay.pHitAtK).not.toBe(nullDay.pHitAtK);
  });

  it('ships two vectors, each a probability non-decreasing in k (index 0 unused)', () => {
    for (const vector of [shippedTable.pHitNull, shippedTable.pHitEffect]) {
      expect(vector).toHaveLength(P_HIT_MAX_K + 1);
      expect(vector[0]).toBe(0);
      for (let k = 1; k <= P_HIT_MAX_K; k++) {
        expect(vector[k]).toBeGreaterThanOrEqual(0);
        expect(vector[k]).toBeLessThanOrEqual(1);
        if (k > 1) expect(vector[k]).toBeGreaterThanOrEqual(vector[k - 1]);
      }
    }
  });

  it('finds significance sooner on an effect day than on a null one, at every k', () => {
    // Not a tautology of the simulation: it is the substantive claim that makes
    // the day-typed selection worth making. An effect day's true-outcome family
    // is dense with hits, so a random walk trips over one earlier.
    for (let k = 1; k <= P_HIT_MAX_K; k++) {
      expect(shippedTable.pHitEffect[k]).toBeGreaterThan(shippedTable.pHitNull[k]);
    }
  });

  it('carries no legacy single-vector `pHit` key that could be read as either day', () => {
    expect(Object.keys(shippedTable).sort()).toEqual(['checksum', 'pHitEffect', 'pHitNull']);
  });
});

// --- (d) staleness: checksum mismatch throws (§3.7) ---

describe('pHitTableChecksum', () => {
  it('matches the checksum embedded in the shipped table', () => {
    expect(shippedTable.checksum).toBe(pHitTableChecksum());
  });

  it('is fnv1a32 of the JSON-serialized DGP constant vector', () => {
    expect(pHitTableChecksum()).toBe(fnv1a32(JSON.stringify(dgpConstantVector())));
  });

  it('is stable across calls (pure function of the constants)', () => {
    expect(pHitTableChecksum()).toBe(pHitTableChecksum());
  });

  it('changes when any constant in the vector changes', () => {
    const base = dgpConstantVector();
    const keys = Object.keys(base);
    expect(keys.length).toBeGreaterThan(20);
    const seen = new Set<number>();
    for (const key of keys) {
      const mutated = { ...base, [key]: base[key] + 0.017 };
      seen.add(fnv1a32(JSON.stringify(mutated)));
    }
    // every single-constant perturbation produces a checksum distinct from the
    // real one (and, here, from each other -- no accidental collisions).
    expect(seen.has(pHitTableChecksum())).toBe(false);
    expect(seen.size).toBe(keys.length);
  });

  it('covers every §3.9 knob that invalidates the table', () => {
    const keys = Object.keys(dgpConstantVector());
    for (const required of [
      'ar1Rho',
      'rhoShared',
      'treatmentL1Coef',
      'y1T5Scale',
      'y2ZScale',
      'y3ZScale',
      'y4ZScale',
      'effectDLo',
      'effectDHi',
      'heteroMultiplier',
      'nullSigBandLo',
      'nullSigBandHi',
      'pathSpaceSize',
    ]) {
      expect(keys).toContain(required);
    }
  });
});

describe('assertPHitTable', () => {
  it('accepts the shipped table', () => {
    expect(() => assertPHitTable(shippedTable)).not.toThrow();
  });

  it('throws on a stale checksum, naming the regeneration command', () => {
    const stale = {
      checksum: (pHitTableChecksum() ^ 0xdeadbeef) >>> 0,
      pHitNull: shippedTable.pHitNull,
      pHitEffect: shippedTable.pHitEffect,
    };
    expect(() => assertPHitTable(stale)).toThrow(/npm run cal/);
    expect(() => assertPHitTable(stale)).toThrow(/checksum/i);
  });

  it('throws on a wrong-length vector, naming WHICH one (gr6-002: the shape guard, not the checksum)', () => {
    // The checksum guards the DGP the table was simulated under; it cannot see
    // the table's SHAPE at all (dgpConstantVector knows nothing about how many
    // vectors the file carries). A two-vector table therefore needs the length
    // guard to run per vector, or a half-regenerated file reads as fresh.
    const shortNull = {
      checksum: pHitTableChecksum(),
      pHitNull: shippedTable.pHitNull.slice(0, 10),
      pHitEffect: shippedTable.pHitEffect,
    };
    expect(() => assertPHitTable(shortNull)).toThrow(/length/i);
    expect(() => assertPHitTable(shortNull)).toThrow(/pHitNull/);

    const shortEffect = {
      checksum: pHitTableChecksum(),
      pHitNull: shippedTable.pHitNull,
      pHitEffect: shippedTable.pHitEffect.slice(0, 10),
    };
    expect(() => assertPHitTable(shortEffect)).toThrow(/length/i);
    expect(() => assertPHitTable(shortEffect)).toThrow(/pHitEffect/);
  });

  it('is reached through pHitAtK on both day types (the engine never reads a stale table silently)', () => {
    // The shipped table is fresh, so this is the positive half of the guard;
    // the negative half is covered by the stale-checksum case above, which
    // exercises the exact function pHitAtK delegates to.
    expect(() => pHitAtK(12, 'null')).not.toThrow();
    expect(() => pHitAtK(12, 'effect')).not.toThrow();
  });
});
