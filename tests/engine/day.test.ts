// Master spec §3.3 (hackability guarantee / rejection sampling) + §3.1
// (determinism). day.ts's contract, per the T9 brief and controller
// amendments:
//   (a) generateDay(iso, scenarioCount) is a pure function of its inputs:
//       same call twice => deep-equal DailyPuzzle + byte-identical Dataset;
//   (b) the acceptance loop's guarantee actually holds over real calendar
//       dates: every null day's sigCount@200 lands in NULL_SIG_BAND, every
//       effect day's canonical spec clears both the @200 and @400 gates;
//   (c) when the loop is forced to exhaust MAX_ATTEMPTS (mocked-impossible
//       band), it falls back to the best-scoring attempt and warns exactly
//       once (§3.3's cap rule, controller-amended with an explicit scoring
//       formula for both day types);
//   (d) generatePractice mirrors the same acceptance loop from a numeric
//       seed instead of a calendar date, with a plain-modulo scenario index
//       (no 14-day rotation check).
import { describe, expect, it, vi } from 'vitest';
import { runSpec } from '../../src/engine/analyze';
import type { SpecCore } from '../../src/engine/analyze';
import {
  bandDistance,
  canonicalSpecFor,
  canonicalTransform,
  generateDay,
  generatePractice,
  hashCurve,
  hashRows,
  LAB_DEFAULT_SPEC,
  labDefaultGateApplies,
  pickBestEffectAttempt,
  preferCleanDefault,
} from '../../src/engine/day';
import { DEFAULT_SPEC as STORE_DEFAULT_SPEC } from '../../src/game/store';
import { fnv1a32 } from '../../src/engine/prng';
import { daySeed } from '../../src/engine/seeds';
import { puzzleNumber as gamePuzzleNumber } from '../../src/game/daily';
import { MAX_ATTEMPTS, NULL_SIG_BAND } from '../../src/game/tuning';
import { enumerateCurve, sigCount, specKey } from '../../src/engine/specGrid';
import type { CurvePoint } from '../../src/engine/specGrid';
import type { PathResult, Spec } from '../../src/engine/types';

const SCENARIO_COUNT = 20; // production scenario count (T6: 20 English scenarios)

/** Consecutive local ISO dates, starting at `startIso`. Test-only helper --
 * `new Date` is fine here, this file is not under src/engine/** (mirrors the
 * identical helper in tests/engine/seeds.test.ts). */
function consecutiveIsoDates(startIso: string, count: number): string[] {
  const [y, m, d] = startIso.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(start + i * 86_400_000);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// --- determinism (§3.1) ---

describe('generateDay — determinism', () => {
  it('produces deep-equal puzzles across two independent calls on the same (iso, scenarioCount)', () => {
    const a = generateDay('2026-09-01', SCENARIO_COUNT);
    const b = generateDay('2026-09-01', SCENARIO_COUNT);
    expect(a.puzzle).toEqual(b.puzzle);
  });

  it('produces byte-identical first-40-row data (hash AND raw arrays) across two independent calls', () => {
    const a = generateDay('2026-09-01', SCENARIO_COUNT);
    const b = generateDay('2026-09-01', SCENARIO_COUNT);
    expect(hashRows(a.data, 40)).toBe(hashRows(b.data, 40));
    // Byte-identical, not just same hash bucket -- guards against a hash
    // collision masking a real divergence.
    expect(Array.from(a.data.x)).toEqual(Array.from(b.data.x));
    expect(Array.from(a.data.age)).toEqual(Array.from(b.data.age));
    expect(Array.from(a.data.y[0])).toEqual(Array.from(b.data.y[0]));
    expect(Array.from(a.data.y[1])).toEqual(Array.from(b.data.y[1]));
  });

  it('differs across different isoDates (sanity: not a constant)', () => {
    const a = generateDay('2026-09-01', SCENARIO_COUNT);
    const b = generateDay('2026-09-02', SCENARIO_COUNT);
    expect(hashRows(a.data, 40)).not.toBe(hashRows(b.data, 40));
  });

  it("puzzleNumber matches the game-side src/game/daily.ts formula (daysBetween(EPOCH, iso) + 1)", () => {
    // day.ts cannot import src/game/daily.ts (engine purity: tuning.ts is the
    // only allowed game/* import) or use `new Date` (banned in src/engine/**),
    // so it recomputes puzzleNumber via pure calendar math off the same EPOCH
    // constant. This cross-checks that duplicate arithmetic against the
    // authoritative game-side implementation, which the store (T12) actually
    // reads from -- see the T9 report's "concerns" section.
    for (const iso of ['2026-08-10', '2026-09-01', '2026-12-31', '2027-01-01', '2027-07-04']) {
      expect(generateDay(iso, SCENARIO_COUNT).puzzle.puzzleNumber).toBe(gamePuzzleNumber(iso));
    }
  });
});

// --- the lab default: one spec, two files (GR6 §1(d)) ---

describe('LAB_DEFAULT_SPEC', () => {
  it("is byte-for-byte src/game/store.ts's DEFAULT_SPEC — the spec a player actually starts on", () => {
    // Same class of duplication, and the same reason, as the puzzleNumber
    // cross-check above: engine purity lets src/engine/** import
    // src/game/tuning.ts and nothing else from the game layer, and the store is
    // a zustand store. The §1(d) acceptance gate is only meaningful if the spec
    // it judges IS the one the Lab opens on, so the mirror is pinned here
    // rather than trusted. A field added to one and not the other fails this.
    expect(LAB_DEFAULT_SPEC).toEqual(STORE_DEFAULT_SPEC);
    expect(Object.keys(LAB_DEFAULT_SPEC).sort()).toEqual(Object.keys(STORE_DEFAULT_SPEC).sort());
  });
});

describe('labDefaultGateApplies — the boundary of §1(d)\'s one documented exception', () => {
  it('applies on every null day (the trueOutcome argument cannot except one)', () => {
    expect(labDefaultGateApplies('null', null)).toBe(true);
    // A null day carrying a stray trueOutcome is not a thing day.ts builds,
    // but the signature admits it and the exception must still not fire: it is
    // an EFFECT-day exception, and reading it as "outcome 0" alone would
    // silently exempt a quarter of the null days from the gate.
    expect(labDefaultGateApplies('null', 0)).toBe(true);
  });

  it("does NOT apply on an effect day whose true outcome is the lab default's own", () => {
    expect(labDefaultGateApplies('effect', LAB_DEFAULT_SPEC.outcome)).toBe(false);
  });

  it('applies on every other effect day — the false-positive-in-one-tap case §1(d) exists for', () => {
    for (const outcome of [1, 2, 3] as const) {
      expect(labDefaultGateApplies('effect', outcome)).toBe(true);
    }
    // and on an effect day with no true outcome recorded at all (verdictStamp
    // resolves that case explicitly too): nothing to be the day's own truth,
    // so nothing to except.
    expect(labDefaultGateApplies('effect', null)).toBe(true);
  });
});

// --- acceptance guarantee over 30 consecutive real calendar days (§3.3) ---

describe('generateDay — acceptance guarantee over 30 consecutive days', () => {
  const dates = consecutiveIsoDates('2026-09-01', 30);

  it('every null day lands sigCount@200 inside NULL_SIG_BAND; every effect day clears both canonical-spec gates', () => {
    for (const iso of dates) {
      const { puzzle, data } = generateDay(iso, SCENARIO_COUNT);

      expect(puzzle.attemptUsed).toBeGreaterThanOrEqual(0);
      expect(puzzle.attemptUsed).toBeLessThan(MAX_ATTEMPTS);
      expect(puzzle.isoDate).toBe(iso);
      expect(puzzle.nFull).toBe(400);
      // gr6-102: every one of these days passed its gate, so none of them may
      // claim the cap was exhausted. Paired with the two cap-exhaustion tests
      // below (which assert `true`), this pins the flag in both directions --
      // an always-false field would pass here and fail there.
      expect(puzzle.capExhausted).toBe(false);

      // GR6 §1(d) (gr2-013): on every day the gate applies to, the accepted
      // day's LAB DEFAULT must not be significant at N=200. Before this
      // predicate the measured rate over 120 consecutive real dates was 14/120
      // (11.7%), and on such a day Act I is one tap with an empty fork trail.
      // Asserted on null AND effect days here (not just null), so a predicate
      // silently scoped back to one day type fails; the ONE documented
      // exception is read from labDefaultGateApplies itself rather than
      // re-spelled, so the test and the code can only disagree about the
      // exception by disagreeing about that function.
      if (labDefaultGateApplies(puzzle.dayType, puzzle.trueOutcome ?? null)) {
        const defaultResult = runSpec(data, LAB_DEFAULT_SPEC, 200);
        expect(defaultResult.valid && defaultResult.p < 0.05).toBe(false);
      }

      if (puzzle.dayType === 'null') {
        expect(puzzle.trueOutcome).toBeUndefined();
        const sig = sigCount(enumerateCurve(data, 200));
        expect(sig).toBeGreaterThanOrEqual(NULL_SIG_BAND[0]);
        expect(sig).toBeLessThanOrEqual(NULL_SIG_BAND[1]);
      } else {
        expect(puzzle.trueOutcome).toBeDefined();
        const canonical = canonicalSpecFor(puzzle.trueOutcome!);
        const p200 = runSpec(data, canonical, 200).p;
        const p400 = runSpec(data, canonical, 400).p;
        expect(p200).toBeLessThan(0.15);
        expect(p400).toBeLessThan(0.05);
      }
    }
  });
});

// --- gr6-009: the number the prereg copy quotes, measured here ------------

describe('the prereg false-positive rate the reveal copy quotes (gr6-009 / ruling §1(a))', () => {
  it('keeps `reveal.preregFalsePositive`\'s "about one in five" true of the lab default at N=400 on null days', () => {
    // WHAT THIS DEFENDS. The copy used to say "about 5%". It is not 5%: a
    // prereg commitment is judged at the FULL sample (store.ts's preregCommit
    // walks the whole N_SCHEDULE before its one runSpec), and X is assigned
    // from the same latents Y1 loads on, so the plain default spec — the one
    // the prereg form opens on — rejects far above alpha on days with no
    // effect at all. Re-measured for W11 over 591 accepted null days (the
    // calibration population plus 120 real dates): 18.6% and 25.3%, pooled
    // 19.6%. The string now says "about one in five", and this is the assertion
    // that makes that a measurement rather than a claim.
    //
    // THE WINDOW AND THE BAND. 90 consecutive dates (68 of them null on this
    // seed set) measure 25.0%, se 5.3pp. The band is deliberately wide — this
    // is a guard against the copy going stale, not a pin on a sample statistic
    // — but both edges bite: at 0.10 the copy's "one in five" would be an
    // overstatement worth rewording, and at 0.35 an understatement. A DGP or
    // acceptance change that moves the rate out of it must re-measure the
    // three locales' strings in the same commit.
    //
    // COST. One regression per date, no curve enumeration: this runs in
    // milliseconds, which is why it can afford 90 real days.
    const dates = consecutiveIsoDates('2026-09-01', 90);
    let nullDays = 0;
    let significant = 0;
    for (const iso of dates) {
      const { puzzle, data } = generateDay(iso, SCENARIO_COUNT);
      if (puzzle.dayType !== 'null') continue;
      nullDays++;
      const result = runSpec(data, LAB_DEFAULT_SPEC, 400);
      if (result.valid && result.p < 0.05) significant++;
    }

    expect(nullDays).toBeGreaterThan(50); // the sample is real, not a rounding
    const rate = significant / nullDays;
    expect(rate, `reveal.preregFalsePositive quotes "about one in five"; measured ${significant}/${nullDays}`)
      .toBeGreaterThan(0.1);
    expect(rate, `reveal.preregFalsePositive quotes "about one in five"; measured ${significant}/${nullDays}`)
      .toBeLessThan(0.35);
    // ...and it is emphatically not the 5% the string used to claim, which is
    // the assertion the whole ruling turns on.
    expect(rate).toBeGreaterThan(0.05 * 2);
  });
});

// --- best-attempt fallback at the cap (§3.3 controller amendment) ---

describe('best-attempt fallback — direct unit tests of the scoring helpers', () => {
  describe('bandDistance', () => {
    it('is 0 strictly inside the band', () => {
      expect(bandDistance(100, [30, 180])).toBe(0);
    });
    it('is 0 exactly at either closed boundary', () => {
      expect(bandDistance(30, [30, 180])).toBe(0);
      expect(bandDistance(180, [30, 180])).toBe(0);
    });
    it('is the gap below the band when under it', () => {
      expect(bandDistance(10, [30, 180])).toBe(20);
    });
    it('is the gap above the band when over it', () => {
      expect(bandDistance(200, [30, 180])).toBe(20);
    });
  });

  describe('preferCleanDefault (§1(d)\'s cap preference)', () => {
    it('keeps only the attempts whose lab default is non-significant when any exist', () => {
      const candidates = [
        { attempt: 0, defaultSig: true },
        { attempt: 1, defaultSig: false },
        { attempt: 2, defaultSig: true },
        { attempt: 3, defaultSig: false },
      ];
      expect(preferCleanDefault(candidates)).toEqual([candidates[1], candidates[3]]);
    });

    it('returns every candidate, in order, when the gate rejected all of them', () => {
      // The "can never be worse than before §1(d)" property: with nothing clean
      // to prefer, the day type's own tie-break must still see the whole field.
      const candidates = [
        { attempt: 0, defaultSig: true },
        { attempt: 1, defaultSig: true },
      ];
      expect(preferCleanDefault(candidates)).toEqual(candidates);
    });

    it('returns every candidate when the gate never applied (no attempt is marked)', () => {
      const candidates = [
        { attempt: 0, defaultSig: false },
        { attempt: 1, defaultSig: false },
      ];
      expect(preferCleanDefault(candidates)).toEqual(candidates);
    });

    it('preserves attempt order, so the downstream tie-breaks still keep the earliest attempt', () => {
      const candidates = [
        { attempt: 0, defaultSig: true },
        { attempt: 1, defaultSig: false },
        { attempt: 2, defaultSig: false },
      ];
      expect(preferCleanDefault(candidates).map((c) => c.attempt)).toEqual([1, 2]);
    });

    it('composes with pickBestEffectAttempt: a clean attempt wins over a better-scoring dirty one', () => {
      // The composition IS the effect-day fallback (see acceptEffectDay), and
      // it is the composition that carries the ruling: attempt 0 has both the
      // smallest p400 and a qualifying p200, and still must not be chosen.
      const candidates = [
        { attempt: 0, p200: 0.01, p400: 0.001, defaultSig: true },
        { attempt: 1, p200: 0.1, p400: 0.04, defaultSig: false },
      ];
      expect(pickBestEffectAttempt(preferCleanDefault(candidates))).toEqual(candidates[1]);
    });
  });

  describe('pickBestEffectAttempt', () => {
    it('picks the smallest p400 among candidates with p200 < .15 when any exist, ignoring worse-p200 candidates with even smaller p400', () => {
      const candidates = [
        { attempt: 0, p200: 0.5, p400: 0.001 }, // smallest p400 overall, but p200 too big to qualify
        { attempt: 1, p200: 0.1, p400: 0.03 },
        { attempt: 2, p200: 0.05, p400: 0.02 }, // smallest p400 among the p200<.15 subset
      ];
      expect(pickBestEffectAttempt(candidates)).toEqual(candidates[2]);
    });

    it('falls back to the smallest p400 overall when no candidate has p200 < .15', () => {
      const candidates = [
        { attempt: 0, p200: 0.4, p400: 0.09 },
        { attempt: 1, p200: 0.35, p400: 0.02 },
        { attempt: 2, p200: 0.5, p400: 0.5 },
      ];
      expect(pickBestEffectAttempt(candidates)).toEqual(candidates[1]);
    });

    it('breaks exact ties by picking the earlier attempt (deterministic)', () => {
      const candidates = [
        { attempt: 0, p200: 0.1, p400: 0.02 },
        { attempt: 1, p200: 0.1, p400: 0.02 },
      ];
      expect(pickBestEffectAttempt(candidates)).toEqual(candidates[0]);
    });
  });
});

describe('best-attempt fallback — end-to-end via mocked tuning constants', () => {
  it('null day: an unreachable NULL_SIG_BAND exhausts MAX_ATTEMPTS, falls back to a real attempt, and warns exactly once with the iso and the attempt count', async () => {
    vi.resetModules();
    vi.doMock('../../src/game/tuning', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/game/tuning')>();
      // An unreachable band (sigCount can never exceed 1792) forces every
      // attempt to fail acceptance, so the loop always hits the cap -- a
      // small MAX_ATTEMPTS keeps this test fast (real null-day full
      // enumerations, just few of them).
      return { ...actual, NULL_SIG_BAND: [99_999, 100_000] as [number, number], MAX_ATTEMPTS: 3 };
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { generateDay: generateDayMocked } = await import('../../src/engine/day');
      // 2026-09-02 is a verified NULL day for this seed set (checked directly
      // against src/engine/seeds.ts's dayTypeFor before writing this test).
      const { puzzle } = generateDayMocked('2026-09-02', SCENARIO_COUNT);

      expect(puzzle.dayType).toBe('null');
      expect(puzzle.attemptUsed).toBeGreaterThanOrEqual(0);
      expect(puzzle.attemptUsed).toBeLessThan(3);
      // gr6-102: the console.warn is kept, but it is no longer the ONLY
      // channel -- the fallback is on the puzzle (and from there on
      // RevealPayload) so something downstream can actually know.
      expect(puzzle.capExhausted).toBe(true);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0].join(' ');
      expect(message).toContain('2026-09-02');
      expect(message).toContain('3'); // the mocked MAX_ATTEMPTS
    } finally {
      warnSpy.mockRestore();
      vi.doUnmock('../../src/game/tuning');
      vi.resetModules();
    }
  });

  it('effect day: MAX_ATTEMPTS=1 exhausts on a real attempt-0 rejection, falls back to that same attempt, and warns exactly once', async () => {
    // The effect-day p-value thresholds (.05/.15/.3) are hardcoded in day.ts,
    // not tuning.ts, so they can't be mocked into "impossible" the way
    // NULL_SIG_BAND can. Instead this uses a REAL, already-observed fact
    // about the unmocked pipeline: for iso '2026-09-01' (a real effect day),
    // attempt 0 does NOT clear the acceptance gate on its own (with the real
    // MAX_ATTEMPTS=20, this date only accepts at attemptUsed=1, meaning
    // attempt 0 was tried and rejected first -- verified directly against
    // seeds.ts/dgp.ts/analyze.ts before writing this test). Mocking
    // MAX_ATTEMPTS down to 1 makes the loop try only that one (real,
    // genuinely-failing) attempt, so it deterministically hits the cap
    // without needing to fabricate any data.
    vi.resetModules();
    vi.doMock('../../src/game/tuning', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/game/tuning')>();
      return { ...actual, MAX_ATTEMPTS: 1 };
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { generateDay: generateDayMocked } = await import('../../src/engine/day');
      const { puzzle } = generateDayMocked('2026-09-01', SCENARIO_COUNT);

      expect(puzzle.dayType).toBe('effect');
      expect(puzzle.attemptUsed).toBe(0); // the only attempt MAX_ATTEMPTS=1 permits
      // gr6-102: set on BOTH day types -- which is precisely why the flag is
      // not spoiler-bearing and may ride along on RevealPayload.
      expect(puzzle.capExhausted).toBe(true);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0].join(' ');
      expect(message).toContain('2026-09-01');
      expect(message).toContain('1'); // the mocked MAX_ATTEMPTS
    } finally {
      warnSpy.mockRestore();
      vi.doUnmock('../../src/game/tuning');
      vi.resetModules();
    }
  });
});

// --- null-day precheck actually GATES enumerateCurve (T9 review round 1 fix) ---
//
// Round 1 review caught that the precheck was being *read off* an
// unconditionally-computed enumerateCurve result rather than actually
// deciding whether to compute it -- letter-correct decision, zero gating.
// These two tests force each side of that branch deterministically (via a
// mocked runSpec, since the precheck itself calls runSpec directly -- see
// day.ts's nullDayPrecheckHit) and spy on enumerateCurve (specGrid.ts) to
// prove the expensive step really is skipped/run accordingly.

describe('null-day precheck gates enumerateCurve', () => {
  it('a precheck-failing attempt completes without enumerateCurve ever being invoked', async () => {
    vi.resetModules();

    let enumerateCurveCalls = 0;
    vi.doMock('../../src/engine/specGrid', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/engine/specGrid')>();
      return {
        ...actual,
        enumerateCurve: (...args: Parameters<typeof actual.enumerateCurve>) => {
          enumerateCurveCalls++;
          return actual.enumerateCurve(...args);
        },
      };
    });
    vi.doMock('../../src/engine/analyze', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/engine/analyze')>();
      return {
        ...actual,
        // Force every precheck spec-check to be non-significant, regardless
        // of the real underlying data -- guarantees the precheck fails on
        // every attempt, deterministically (no date-mining required to find
        // a real day whose fixed 256-spec subsample happens to miss).
        // nullDayPrecheckHit calls runSpecCore, not runSpec (gr6-046: runSpec
        // additionally builds a DataCut the precheck never reads — a
        // machine-dependent but always-positive share of the pass). Both are mocked: runSpecCore is what the precheck actually
        // reads, runSpec is mocked to match so nothing else in day.ts can
        // observe a different verdict from the same mocked pipeline.
        runSpecCore: (): SpecCore => ({
          n: 200,
          beta: 0,
          se: 1,
          t: 0.1,
          p: 0.9,
          ci: [0, 0],
          excludedCount: 0,
          valid: true,
          filteredIdx: [],
          transformedY: new Float64Array(0),
          keptLocal: [],
        }),
        runSpec: (): PathResult => ({
          spec: {} as Spec,
          n: 200,
          beta: 0,
          se: 1,
          t: 0.1,
          p: 0.9,
          ci: [0, 0],
          excludedCount: 0,
          valid: true,
        }),
      };
    });
    vi.doMock('../../src/game/tuning', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/game/tuning')>();
      return { ...actual, MAX_ATTEMPTS: 2 }; // small, keeps this (cap-exhaustion) test fast
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { generateDay: generateDayMocked } = await import('../../src/engine/day');
      // 2026-09-02 is a verified NULL day for this seed set.
      const { puzzle } = generateDayMocked('2026-09-02', SCENARIO_COUNT);

      expect(puzzle.dayType).toBe('null');
      expect(enumerateCurveCalls).toBe(0);
      // Fallback-of-last-resort: no attempt ever got a sigCount computed, so
      // the loop deterministically falls back to the first attempt (see
      // acceptNullDay's comment) rather than paying for an enumeration.
      expect(puzzle.attemptUsed).toBe(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0].join(' ')).toContain('n/a (precheck never passed)');
    } finally {
      warnSpy.mockRestore();
      vi.doUnmock('../../src/engine/specGrid');
      vi.doUnmock('../../src/engine/analyze');
      vi.doUnmock('../../src/game/tuning');
      vi.resetModules();
    }
  });

  it('a precheck-passing attempt invokes enumerateCurve exactly once', async () => {
    vi.resetModules();

    let enumerateCurveCalls = 0;
    vi.doMock('../../src/engine/specGrid', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/engine/specGrid')>();
      return {
        ...actual,
        enumerateCurve: (...args: Parameters<typeof actual.enumerateCurve>) => {
          enumerateCurveCalls++;
          return actual.enumerateCurve(...args);
        },
      };
    });
    vi.doMock('../../src/engine/analyze', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/engine/analyze')>();
      return {
        ...actual,
        // Force every precheck spec-check to be significant --
        // nullDayPrecheckHit early-exits on the very first one, so this
        // alone guarantees the precheck passes deterministically,
        // independent of whether the real underlying data's fixed
        // 256-subsample happens to contain a hit. Both entry points are
        // mocked for the reason given in the sibling test above (gr6-046).
        //
        // §1(d): the mock is now SPEC-AWARE, because the same runSpecCore
        // entry point serves two gates that want opposite verdicts here. The
        // lab default has to come back NON-significant (otherwise §1(d)
        // rejects the attempt before the precheck runs, and this test would
        // "pass" its enumerateCurve assertion for the wrong reason -- or
        // rather fail it, which is exactly how the ordering was verified);
        // every other spec comes back significant so the precheck passes on
        // its first probe. Keyed on specKey, never on object identity: day.ts
        // builds its own object.
        runSpecCore: (_data: unknown, spec: Spec): SpecCore =>
          specKey(spec) === specKey(LAB_DEFAULT_SPEC)
            ? {
                n: 200,
                beta: 0,
                se: 1,
                t: 0.1,
                p: 0.9,
                ci: [0, 0],
                excludedCount: 0,
                valid: true,
                filteredIdx: [],
                transformedY: new Float64Array(0),
                keptLocal: [],
              }
            : {
                n: 200,
                beta: 1,
                se: 0.1,
                t: 8,
                p: 0.0001,
                ci: [0, 0],
                excludedCount: 0,
                valid: true,
                filteredIdx: [],
                transformedY: new Float64Array(0),
                keptLocal: [],
              },
        runSpec: (): PathResult => ({
          spec: {} as Spec,
          n: 200,
          beta: 1,
          se: 0.1,
          t: 8,
          p: 0.0001,
          ci: [0, 0],
          excludedCount: 0,
          valid: true,
        }),
      };
    });
    vi.doMock('../../src/game/tuning', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/game/tuning')>();
      return { ...actual, MAX_ATTEMPTS: 1 }; // exactly one attempt -- makes "exactly once" unambiguous
    });

    try {
      const { generateDay: generateDayMocked } = await import('../../src/engine/day');
      const { puzzle } = generateDayMocked('2026-09-02', SCENARIO_COUNT);

      expect(puzzle.dayType).toBe('null');
      expect(enumerateCurveCalls).toBe(1);
    } finally {
      vi.doUnmock('../../src/engine/specGrid');
      vi.doUnmock('../../src/engine/analyze');
      vi.doUnmock('../../src/game/tuning');
      vi.resetModules();
    }
  });
});

// --- canonicalTransform / canonicalSpecFor (controller-pinned rule) ---

describe('canonicalTransform', () => {
  it("is 'log1p' for outcome 1 (Y2, the skewed family)", () => {
    expect(canonicalTransform(1)).toBe('log1p');
  });
  it("is 'raw' for every other outcome", () => {
    expect(canonicalTransform(0)).toBe('raw');
    expect(canonicalTransform(2)).toBe('raw');
    expect(canonicalTransform(3)).toBe('raw');
  });
});

describe('canonicalSpecFor', () => {
  it('matches the pinned canonical spec shape (all/both covariates/no exclusion/two-tailed)', () => {
    const spec: Spec = canonicalSpecFor(2);
    expect(spec).toEqual({
      outcome: 2,
      subgroup: 'all',
      covariates: { income: true, risk: true },
      exclusion: 'none',
      transform: 'raw',
      tails: 'two',
    });
  });
});

// --- generatePractice (§3.3 controller amendment) ---

describe('generatePractice', () => {
  it("uses isoDate 'practice' and scenario index = seed % scenarioCount (no rotation check)", () => {
    const { puzzle } = generatePractice(12_345, SCENARIO_COUNT);
    expect(puzzle.isoDate).toBe('practice');
    expect(puzzle.scenarioId).toBe(String(12_345 % SCENARIO_COUNT));
  });

  it('is deterministic for the same (seed, scenarioCount)', () => {
    const a = generatePractice(777, SCENARIO_COUNT);
    const b = generatePractice(777, SCENARIO_COUNT);
    expect(a.puzzle).toEqual(b.puzzle);
    expect(hashRows(a.data, 40)).toBe(hashRows(b.data, 40));
  });

  it('uses a distinct attempt-seed hash namespace from the real daily flow (never accidentally reuses daySeed)', () => {
    // The controller amendment pins attempt seeds for practice as
    // fnv1a32('practice:' + seed + ':' + attempt) -- deliberately a
    // different prefix from the real daily flow's daySeed(iso, attempt) =
    // fnv1a32('phackle:' + iso + ':' + attempt) (src/engine/seeds.ts), so a
    // practice run can never collide with a real calendar date's dataset.
    // Checked directly at the hash level (not by routing a numeric seed
    // through generateDay as if it were an iso string: seeds.ts's
    // scenarioIndexFor does real calendar arithmetic on its `iso` argument,
    // so a non-YYYY-MM-DD string there is a misuse of that function, not a
    // meaningful test of this property).
    const seed = 20_260_901;
    expect(fnv1a32(`practice:${seed}:0`)).not.toBe(daySeed(String(seed), 0));
  });

  it('satisfies the same acceptance gates as generateDay across a spread of seeds (null band / effect canonical gates)', () => {
    const seeds = [0, 1, 2, 3, 4, 5, 100, 4242, 999_999, 2 ** 31];
    for (const seed of seeds) {
      const { puzzle, data } = generatePractice(seed, SCENARIO_COUNT);
      expect(puzzle.attemptUsed).toBeGreaterThanOrEqual(0);
      expect(puzzle.attemptUsed).toBeLessThan(MAX_ATTEMPTS);

      // §1(d) holds on the practice path too -- which matters beyond practice
      // mode itself: scripts/simulate_calibration.ts builds all 1,000 of its
      // days through generatePractice, so a gate that held only in
      // generateDay would be certified by a suite that never ran it.
      if (labDefaultGateApplies(puzzle.dayType, puzzle.trueOutcome ?? null)) {
        const practiceDefault = runSpec(data, LAB_DEFAULT_SPEC, 200);
        expect(practiceDefault.valid && practiceDefault.p < 0.05).toBe(false);
      }

      if (puzzle.dayType === 'null') {
        const sig = sigCount(enumerateCurve(data, 200));
        expect(sig).toBeGreaterThanOrEqual(NULL_SIG_BAND[0]);
        expect(sig).toBeLessThanOrEqual(NULL_SIG_BAND[1]);
      } else {
        const canonical = canonicalSpecFor(puzzle.trueOutcome!);
        expect(runSpec(data, canonical, 200).p).toBeLessThan(0.15);
        expect(runSpec(data, canonical, 400).p).toBeLessThan(0.05);
      }
    }
  });
});

// --- hashRows / hashCurve (golden-fixture hashing helpers) ---

describe('hashRows', () => {
  it('is deterministic for the same (data, k)', () => {
    const { data } = generateDay('2026-09-01', SCENARIO_COUNT);
    expect(hashRows(data, 40)).toBe(hashRows(data, 40));
  });

  it('differs when k differs (more rows folded into the hash)', () => {
    const { data } = generateDay('2026-09-01', SCENARIO_COUNT);
    expect(hashRows(data, 40)).not.toBe(hashRows(data, 41));
  });

  it('differs between two datasets that differ only in one row', () => {
    const { data: a } = generateDay('2026-09-01', SCENARIO_COUNT);
    const { data: b } = generateDay('2026-09-02', SCENARIO_COUNT);
    expect(hashRows(a, 40)).not.toBe(hashRows(b, 40));
  });
});

describe('hashCurve', () => {
  const specA: Spec = {
    outcome: 0,
    subgroup: 'all',
    covariates: { income: false, risk: false },
    exclusion: 'none',
    transform: 'raw',
    tails: 'two',
  };
  const specB: Spec = {
    outcome: 1,
    subgroup: 'urban',
    covariates: { income: true, risk: false },
    exclusion: 'z2',
    transform: 'log1p',
    tails: 'one',
  };

  it('is order-independent (same points, shuffled array order, same hash) -- T8 review ruling: never key on array position', () => {
    const forward: CurvePoint[] = [
      { spec: specA, p: 0.01, valid: true },
      { spec: specB, p: 0.2, valid: true },
    ];
    const shuffled: CurvePoint[] = [forward[1], forward[0]];
    expect(hashCurve(shuffled)).toBe(hashCurve(forward));
  });

  it('excludes invalid points from the hash entirely', () => {
    const withoutInvalid: CurvePoint[] = [{ spec: specA, p: 0.01, valid: true }];
    const withInvalid: CurvePoint[] = [
      { spec: specA, p: 0.01, valid: true },
      { spec: specB, p: 0.0001, valid: false },
    ];
    expect(hashCurve(withInvalid)).toBe(hashCurve(withoutInvalid));
  });

  it('differs when a valid p-value differs', () => {
    const a: CurvePoint[] = [{ spec: specA, p: 0.01, valid: true }];
    const b: CurvePoint[] = [{ spec: specA, p: 0.011, valid: true }];
    expect(hashCurve(a)).not.toBe(hashCurve(b));
  });

  it('is deterministic on a real enumerated curve', () => {
    const { data } = generateDay('2026-10-31', SCENARIO_COUNT);
    const curve = enumerateCurve(data, 200);
    expect(hashCurve(curve)).toBe(hashCurve(curve));
  });
});
