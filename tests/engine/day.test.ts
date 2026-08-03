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
import {
  bandDistance,
  canonicalSpecFor,
  canonicalTransform,
  generateDay,
  generatePractice,
  hashCurve,
  hashRows,
  pickBestEffectAttempt,
} from '../../src/engine/day';
import { fnv1a32 } from '../../src/engine/prng';
import { daySeed } from '../../src/engine/seeds';
import { puzzleNumber as gamePuzzleNumber } from '../../src/game/daily';
import { MAX_ATTEMPTS, NULL_SIG_BAND } from '../../src/game/tuning';
import { enumerateCurve, sigCount } from '../../src/engine/specGrid';
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
        // 256-subsample happens to contain a hit.
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
