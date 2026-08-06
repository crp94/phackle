// T17: pure aggregation helpers behind the Stats screen (§2.8's "call
// accuracy all-time + rolling-20" and "prereg-vs-hacking success rates side
// by side"). Pure logic over already-persisted history — plain node env,
// same as storage.test.ts's own streakAfter suite (no localStorage touched
// here; that lives in storage.ts, not this module).
import { describe, expect, it } from 'vitest';
import { modeSuccessRate, recordsForMode, rollingCallAccuracy, type ModeHistory } from '../../src/game/statsAgg';
import type { DayRecord } from '../../src/engine/types';

function day(overrides: Partial<DayRecord> = {}): DayRecord {
  return { mode: 'hack', score: 100, forks: 0, stamp: 'RETRACTED', shareString: '', ...overrides };
}

// --- rollingCallAccuracy -----------------------------------------------------

describe('rollingCallAccuracy — windows to the last N calls, chronologically, across both modes', () => {
  it('returns null when no day in history has ever recorded a call (empty state)', () => {
    expect(rollingCallAccuracy({}, 20)).toBeNull();
    const history: ModeHistory = { '2026-08-01': { hack: day({ callCorrect: undefined }) } };
    expect(rollingCallAccuracy(history, 20)).toBeNull();
  });

  it('averages over however many calls exist, when fewer than the window size', () => {
    const history: ModeHistory = {
      '2026-08-01': { hack: day({ callCorrect: true }) },
      '2026-08-02': { hack: day({ callCorrect: false }) },
      '2026-08-03': { hack: day({ callCorrect: true }) },
    };
    expect(rollingCallAccuracy(history, 20)).toBeCloseTo(2 / 3);
  });

  // The 25-day fixture the RED plan calls for: first 5 days all correct,
  // remaining 20 all incorrect. All-time accuracy over all 25 would be 20%
  // (5/25) — a clearly DIFFERENT number from the windowed one — so this
  // proves the function actually windows to the last 20 rather than quietly
  // averaging the whole history.
  it('a 25-day history: last-20 accuracy (0%) differs from the all-time figure it would otherwise collapse to (20%)', () => {
    const history: ModeHistory = {};
    for (let d = 1; d <= 25; d++) {
      const iso = `2026-08-${String(d).padStart(2, '0')}`;
      const correct = d <= 5; // first 5 correct, last 20 wrong
      history[iso] = { hack: day({ callCorrect: correct }) };
    }
    const allCorrect = Object.values(history).filter((r) => r.hack?.callCorrect).length;
    expect(allCorrect / 25).toBeCloseTo(0.2); // sanity: the all-time figure this WOULD be if unwindowed
    expect(rollingCallAccuracy(history, 20)).toBe(0); // last 20 (days 6-25) are all wrong
  });

  // gr6-111 / gr1c-023: the boundary. 0, 3 (fewer than the window), 25 and 30
  // (more than it) were covered; `length === window` exactly was not. It is
  // the value the whole off-by-one family turns on — `slice(-20)` on a
  // length-20 array, `slice(len - window)` with a negative index, a
  // `length > window` guard that skips the slice — and the pair below pins
  // both sides of it: at exactly 20 nothing may be dropped, and at 21 exactly
  // one must be, from the FRONT.
  it('exactly 20 calls (length === window): every call counts, nothing is dropped', () => {
    const history: ModeHistory = {};
    for (let d = 1; d <= 20; d++) {
      const iso = `2026-08-${String(d).padStart(2, '0')}`;
      history[iso] = { hack: day({ callCorrect: d <= 10 }) }; // first 10 correct, last 10 wrong
    }
    // 10/20 = 0.5. An implementation that dropped the oldest at exactly the
    // window size would report 9/19; one that kept only 19 from the end would
    // report 9/19 too. Both are visibly different numbers.
    expect(rollingCallAccuracy(history, 20)).toBe(0.5);
  });

  it('21 calls: exactly one is dropped, and it is the OLDEST', () => {
    const history: ModeHistory = {};
    // Day 1 is the only correct call. In the last 20 (days 2-21) there is none,
    // so the windowed figure is 0 while the all-time figure would be 1/21.
    for (let d = 1; d <= 21; d++) {
      const iso = `2026-08-${String(d).padStart(2, '0')}`;
      history[iso] = { hack: day({ callCorrect: d === 1 }) };
    }
    expect(rollingCallAccuracy(history, 20)).toBe(0);
    // ...and with a window of 21 the same history includes it, which is what
    // makes the line above an exclusion rather than an accident of the fixture.
    expect(rollingCallAccuracy(history, 21)).toBeCloseTo(1 / 21);
  });

  it('takes the chronologically LAST 20, not an arbitrary 20, when there are more than 20 calls', () => {
    const history: ModeHistory = {};
    for (let d = 1; d <= 30; d++) {
      const iso = `2026-08-${String(d).padStart(2, '0')}`;
      // last 20 calendar days (11..30) are all correct; the earlier 10 are wrong.
      history[iso] = { hack: day({ callCorrect: d > 10 }) };
    }
    expect(rollingCallAccuracy(history, 20)).toBe(1);
  });

  it('any mode counts, and same-day hack+prereg both contribute (hack ordered before prereg on a tie, matching achievements.ts)', () => {
    const history: ModeHistory = {
      '2026-08-01': {
        hack: day({ mode: 'hack', callCorrect: true }),
        prereg: day({ mode: 'prereg', callCorrect: false }),
      },
    };
    expect(rollingCallAccuracy(history, 20)).toBeCloseTo(0.5);
  });

  it('ignores day-records with no call at all (prereg abandoned days, or hack days abandoned with no callCorrect recorded)', () => {
    const history: ModeHistory = {
      '2026-08-01': { hack: day({ callCorrect: true }) },
      '2026-08-02': { hack: day({ callCorrect: undefined }) },
    };
    expect(rollingCallAccuracy(history, 20)).toBe(1);
  });
});

// --- recordsForMode -----------------------------------------------------------

describe('recordsForMode — chronological DayRecords for one mode', () => {
  it('returns an empty array for a mode with no history at all', () => {
    expect(recordsForMode({}, 'prereg')).toEqual([]);
  });

  it('only returns the given mode, in ISO date order', () => {
    const history: ModeHistory = {
      '2026-08-03': { hack: day({ score: 3 }) },
      '2026-08-01': { hack: day({ score: 1 }), prereg: day({ mode: 'prereg', score: 100 }) },
      '2026-08-02': { hack: day({ score: 2 }) },
    };
    expect(recordsForMode(history, 'hack').map((r) => r.score)).toEqual([1, 2, 3]);
    expect(recordsForMode(history, 'prereg').map((r) => r.score)).toEqual([100]);
  });
});

// --- modeSuccessRate (the α-lesson panels) -----------------------------------

describe('modeSuccessRate — fraction of days that ended published/replicated, not null-reported', () => {
  it('returns null for an empty record set (renders as the em-dash empty state upstream)', () => {
    expect(modeSuccessRate([])).toBeNull();
  });

  // §1(j)(2): BOTH honest verdicts are excluded from the numerator, and the
  // mixed set is here rather than two homogeneous ones because the predicate
  // this figure now reads (`isPublishedStamp`) was previously the fail-open
  // `stamp !== 'NULL_REPORTED'` — under which MISSED_DISCOVERY would have
  // counted as a published claim and pushed this percentage up silently.
  it('counts REPLICATED and RETRACTED as "success" (something was published), and NEITHER honest verdict', () => {
    const records = [
      day({ stamp: 'REPLICATED' }),
      day({ stamp: 'RETRACTED' }),
      day({ stamp: 'CONFIRMED_NULL' }),
      day({ stamp: 'MISSED_DISCOVERY' }),
    ];
    expect(modeSuccessRate(records)).toBeCloseTo(0.5);
  });

  it('is 1 when every day was published, matching the "unloseable" hacking-mode intuition', () => {
    const records = [day({ stamp: 'REPLICATED' }), day({ stamp: 'RETRACTED' }), day({ stamp: 'RETRACTED' })];
    expect(modeSuccessRate(records)).toBe(1);
  });

  it('is 0 when every day reported nothing, whichever honest verdict it earned', () => {
    const records = [day({ stamp: 'CONFIRMED_NULL' }), day({ stamp: 'MISSED_DISCOVERY' })];
    expect(modeSuccessRate(records)).toBe(0);
  });
});
