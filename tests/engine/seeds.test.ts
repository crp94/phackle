import { describe, expect, it } from 'vitest';
import {
  daySeed,
  dayTypeFor,
  effectParamsFor,
  resetScenarioIndexCacheForTests,
  scenarioIndexFor,
} from '../../src/engine/seeds';
import { EPOCH, EFFECT_D_RANGE, P_EFFECT_PCT } from '../../src/game/tuning';

/** Consecutive local ISO dates, starting at `startIso`. Test-only helper — `new
 * Date` is fine here, this file is not under src/engine/**. */
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

describe('daySeed', () => {
  it('is deterministic for the same (iso, attempt)', () => {
    expect(daySeed('2026-09-01', 0)).toBe(daySeed('2026-09-01', 0));
  });

  it('differs across attempts (rejection-sampling counter)', () => {
    expect(daySeed('2026-09-01', 0)).not.toBe(daySeed('2026-09-01', 1));
  });

  it('differs across dates', () => {
    expect(daySeed('2026-09-01', 0)).not.toBe(daySeed('2026-09-02', 0));
  });
});

describe('scenarioIndexFor', () => {
  it('never repeats a scenario index within any 14-day sliding window (60 dates, count=20)', () => {
    const count = 20;
    const dates = consecutiveIsoDates(EPOCH, 60);
    const indices = dates.map((iso) => scenarioIndexFor(iso, count));

    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(count);
    }

    for (let start = 0; start + 14 <= indices.length; start++) {
      const window = indices.slice(start, start + 14);
      expect(new Set(window).size).toBe(window.length);
    }
  });

  it('is deterministic and stateless (repeated calls agree)', () => {
    const iso = consecutiveIsoDates(EPOCH, 30)[29];
    expect(scenarioIndexFor(iso, 20)).toBe(scenarioIndexFor(iso, 20));
  });

  // --- gr6-045: the iterative forward walk ---
  //
  // scenarioIndexFor used to recurse into the previous 13 dates, each of which
  // recursed into ITS previous 13 -- memoised, so O(days since EPOCH) work, but
  // the STACK DEPTH was O(days since EPOCH) as well. Measured on the
  // pre-refactor tree, cold, one call per fresh process:
  //     EPOCH+365d   idx=17  20.2 ms
  //     EPOCH+1826d  idx=8  127.2 ms
  //     EPOCH+5479d  idx=10 229.6 ms
  //     EPOCH+9131d  RangeError: Maximum call stack size exceeded
  //     EPOCH+10000d RangeError: Maximum call stack size exceeded
  // That is a linearly growing tax on every day-boot and a hard crash roughly
  // 25 years out -- reachable today by any device with a badly-set clock, and
  // it escapes handleRequest into the worker-crash path, whose copy
  // ("Reloading usually fixes it") would be false in exactly that state.
  describe('far-future dates (gr6-045 regression)', () => {
    it('EPOCH + 10,000 days returns a valid index instead of blowing the stack', () => {
      resetScenarioIndexCacheForTests();
      const iso = consecutiveIsoDates(EPOCH, 10_001)[10_000];
      const idx = scenarioIndexFor(iso, 20);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(20);
    });

    it('EPOCH + 10,000 days still honours the 14-day no-repeat window', () => {
      resetScenarioIndexCacheForTests();
      // The 14 consecutive dates ending at EPOCH+10,000 must all differ.
      const dates = consecutiveIsoDates(EPOCH, 10_001).slice(-14);
      const indices = dates.map((iso) => scenarioIndexFor(iso, 20));
      expect(new Set(indices).size).toBe(14);
    });

    it('is reproducible from a cold cache: clearing every memo returns the same index', () => {
      const iso = consecutiveIsoDates(EPOCH, 10_001)[10_000];
      const warm = scenarioIndexFor(iso, 20);
      resetScenarioIndexCacheForTests();
      const cold = scenarioIndexFor(iso, 20);
      expect(Object.is(cold, warm)).toBe(true);
    });

    it('does not depend on the order dates are asked for (walk resumption is not observable)', () => {
      const dates = consecutiveIsoDates(EPOCH, 401);
      resetScenarioIndexCacheForTests();
      const forward = dates.map((iso) => scenarioIndexFor(iso, 20));
      resetScenarioIndexCacheForTests();
      // Ask backwards, so the very first call has to walk the whole way.
      const backward = [...dates].reverse().map((iso) => scenarioIndexFor(iso, 20)).reverse();
      resetScenarioIndexCacheForTests();
      // And in a shuffled-but-deterministic order.
      const order = dates.map((_, i) => (i * 137) % dates.length);
      const scattered = new Array<number>(dates.length);
      for (const i of order) scattered[i] = scenarioIndexFor(dates[i], 20);

      expect(backward).toEqual(forward);
      expect(scattered).toEqual(forward);
    });
  });

  // --- gr6-099: unsatisfiable exclusion set ---
  //
  // `while (excluded.has(idx)) idx = (idx + 1) % count` cannot terminate when
  // the 13-entry exclusion set covers every index, i.e. whenever count <= 13.
  // Unreachable today (tests/content/shape.test.ts pins MIN_SCENARIOS = 20 for
  // all three locales), but it would be an infinite loop inside a Web Worker
  // with no message pump: the tab spins forever, with no error and nothing for
  // the crash handler to catch. A throw routes to the existing crash path.
  describe('unsatisfiable exclusion set (gr6-099)', () => {
    it('throws, rather than hanging, for a post-EPOCH date when count <= 13', () => {
      resetScenarioIndexCacheForTests();
      const iso = consecutiveIsoDates(EPOCH, 2)[1]; // EPOCH + 1 day
      for (const count of [1, 2, 7, 13]) {
        expect(() => scenarioIndexFor(iso, count)).toThrow(/no-repeat exclusion window/);
      }
    });

    it('does NOT throw at count = 14, the smallest satisfiable count', () => {
      resetScenarioIndexCacheForTests();
      const dates = consecutiveIsoDates(EPOCH, 60);
      const indices = dates.map((iso) => scenarioIndexFor(iso, 14));
      for (const idx of indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(14);
      }
      for (let start = 0; start + 14 <= indices.length; start++) {
        expect(new Set(indices.slice(start, start + 14)).size).toBe(14);
      }
    });

    it('does NOT throw at/before EPOCH for any count: there is no history to exclude', () => {
      resetScenarioIndexCacheForTests();
      // EPOCH itself and the day before it are base cases -- no exclusion walk,
      // so no count requirement.
      const before = consecutiveIsoDates('2026-08-06', 2); // EPOCH-1, EPOCH
      for (const iso of before) {
        expect(() => scenarioIndexFor(iso, 3)).not.toThrow();
        expect(scenarioIndexFor(iso, 3)).toBeLessThan(3);
      }
    });
  });
});

describe('dayTypeFor', () => {
  it('lands "effect" on ~P_EFFECT_PCT% of days, within 3 points, over 2000 dates', () => {
    const dates = consecutiveIsoDates('2020-01-01', 2000);
    const effectCount = dates.filter((iso) => dayTypeFor(iso) === 'effect').length;
    const pct = (effectCount / dates.length) * 100;

    expect(pct).toBeGreaterThanOrEqual(P_EFFECT_PCT - 3);
    expect(pct).toBeLessThanOrEqual(P_EFFECT_PCT + 3);
  });

  it('is deterministic', () => {
    expect(dayTypeFor('2026-09-01')).toBe(dayTypeFor('2026-09-01'));
  });
});

describe('effectParamsFor', () => {
  const NON_ALL_SUBGROUPS = ['age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'];

  it('draws d from within EFFECT_D_RANGE', () => {
    for (const iso of consecutiveIsoDates('2026-01-01', 200)) {
      const { d } = effectParamsFor(iso);
      expect(d).toBeGreaterThanOrEqual(EFFECT_D_RANGE[0]);
      expect(d).toBeLessThan(EFFECT_D_RANGE[1]);
    }
  });

  it('returns a valid outcome index and a non-"all" heteroSubgroup', () => {
    for (const iso of consecutiveIsoDates('2026-01-01', 50)) {
      const params = effectParamsFor(iso);
      expect([0, 1, 2, 3]).toContain(params.outcome);
      expect(typeof params.hetero).toBe('boolean');
      expect(NON_ALL_SUBGROUPS).toContain(params.heteroSubgroup);
    }
  });

  it('is deterministic for the same iso', () => {
    expect(effectParamsFor('2026-09-01')).toEqual(effectParamsFor('2026-09-01'));
  });
});
