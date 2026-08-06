import { afterEach, describe, expect, it } from 'vitest';
import {
  bankIndex,
  daysBetween,
  isPractice,
  localIsoDate,
  msToNextLocalMidnight,
  practiceSeed,
  puzzleNumber,
} from '../../src/game/daily';
import { content as enContent } from '../../src/content/en';
import { content as itContent } from '../../src/content/it';
import { content as esContent } from '../../src/content/es';
import { EPOCH } from '../../src/game/tuning';

describe('daysBetween', () => {
  it('counts one day between consecutive dates', () => {
    expect(daysBetween('2026-08-10', '2026-08-11')).toBe(1);
  });

  it('counts one day across the US 2026 spring-forward DST boundary (Mar 8 -> Mar 9, "23-hour" local day)', () => {
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1);
  });

  it('counts one day across the US 2026 fall-back DST boundary (Nov 1 -> Nov 2, "25-hour" local day)', () => {
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
  });

  it('counts a multi-day span', () => {
    expect(daysBetween('2026-08-10', '2026-08-20')).toBe(10);
  });

  it('is negative when the second date precedes the first', () => {
    expect(daysBetween('2026-08-11', '2026-08-10')).toBe(-1);
  });
});

describe('puzzleNumber', () => {
  it('is 1 on the epoch date', () => {
    expect(puzzleNumber(EPOCH)).toBe(1);
  });

  it('increments by one per day after the epoch', () => {
    expect(puzzleNumber('2026-08-11')).toBe(2);
    expect(puzzleNumber('2026-08-20')).toBe(11);
  });

  // gr6-021's PREMISE, pinned so the guard below is never mistaken for
  // defence against something that cannot happen. Every pre-launch day is a
  // practice day (isPractice: "today < EPOCH"), and every practice day before
  // the day preceding EPOCH has a negative puzzle number.
  it('is zero or negative before the epoch (the premise gr6-021 guards)', () => {
    expect(puzzleNumber('2026-08-09')).toBe(0);
    expect(puzzleNumber('2026-08-06')).toBe(-3);
    expect(puzzleNumber('2026-07-10')).toBe(-30);
  });
});

// --- bankIndex (gr6-021) ----------------------------------------------------
describe('bankIndex — the rotation index for a puzzle-number-keyed bank', () => {
  it('agrees with the bare remainder for every non-negative puzzle number', () => {
    for (let n = 0; n < 100; n++) expect(bankIndex(n, 14)).toBe(n % 14);
  });

  it('is a EUCLIDEAN modulus: never negative, whatever the sign of the input', () => {
    // The bare `%` answers -3 here, and `bank[-3]` is `undefined`.
    expect(-3 % 14).toBe(-3); // the defect, stated as an executable fact
    expect(bankIndex(-3, 14)).toBe(11);
    expect(bankIndex(-1, 14)).toBe(13);
    expect(bankIndex(-14, 14)).toBe(0);
    expect(bankIndex(-15, 14)).toBe(13);
  });

  it('lands inside [0, length) for a full year of pre-EPOCH and post-EPOCH days, at every bank size the corpus uses', () => {
    for (const length of [1, 2, 7, 10, 14, 22]) {
      for (let n = -365; n <= 365; n++) {
        const i = bankIndex(n, length);
        expect(Number.isInteger(i), `bankIndex(${n}, ${length}) is not an integer`).toBe(true);
        expect(i, `bankIndex(${n}, ${length}) = ${i} is out of [0, ${length})`).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(length);
      }
    }
  });

  it('returns 0 rather than NaN for an empty bank (0 % 0 is NaN, and NaN is a silent subscript)', () => {
    expect(bankIndex(-3, 0)).toBe(0);
    expect(bankIndex(7, 0)).toBe(0);
  });
});

// gr6-021's REAL SUBJECT — the two §4.5 verdict banks, walked in full.
//
// This is the test the backlog row asks for, and it is deliberately written
// over the SHIPPED content rather than over a synthetic array: the defect was
// that `bank[puzzleNumber % bank.length]` returned `undefined` and the Reveal
// renders `undefined` as "this stamp has no subline", so the failure mode is
// a MISSING STRING, not an exception. Asserting that every day of a
// pre-EPOCH year selects a real, non-empty line from every bank in every
// locale is the only form of this check that would have caught it.
describe('the §4.5 verdict banks survive a pre-EPOCH (negative) puzzle number, in all three locales', () => {
  const LOCALES = [
    ['en', enContent],
    ['it', itContent],
    ['es', esContent],
  ] as const;

  it.each(LOCALES)('%s: every day from a year before EPOCH to a year after selects a real subline', (_name, content) => {
    const banks = [
      ['retractionSublines', content.retractionSublines],
      ['nullReportedSublines', content.nullReportedSublines],
    ] as const;
    const misses: string[] = [];
    for (const [bankName, bank] of banks) {
      expect(bank.length, `${bankName} is empty — this guard would pass over nothing`).toBeGreaterThan(0);
      for (let n = -365; n <= 365; n++) {
        const line = bank[bankIndex(n, bank.length)];
        if (typeof line !== 'string' || line.trim() === '') {
          misses.push(`${bankName}[bankIndex(${n}, ${bank.length})] = ${String(line)}`);
        }
      }
    }
    expect(misses, `a puzzle number selected no subline at all:\n${misses.slice(0, 5).join('\n')}`).toEqual([]);
  });

  it.each(LOCALES)('%s: the bare remainder the fix replaced really does lose lines (the guard is not vacuous)', (_name, content) => {
    const bank = content.retractionSublines;
    const len = bank.length;

    // THE MEASURED CASE, not a hypothetical: this game was played on
    // 2026-08-06 against EPOCH 2026-08-10, i.e. at puzzleNumber -3.
    expect(bank[-3 % len], 'the bare remainder no longer loses the -3 day — has the defect moved?').toBeUndefined();
    expect(typeof bank[bankIndex(-3, len)]).toBe('string');

    const lost: number[] = [];
    for (let n = -365; n < 0; n++) if (bank[n % len] === undefined) lost.push(n);
    // The bare form survives only on the exact multiples of the bank length
    // (where the remainder is -0, and `bank[-0]` is `bank[0]`), so it loses
    // 365 minus those — the overwhelming majority of a pre-EPOCH year.
    expect(lost.length).toBe(365 - Math.floor(365 / len));
    expect(lost.length).toBeGreaterThan(330);
  });
});

describe('localIsoDate', () => {
  it('formats local date components as YYYY-MM-DD', () => {
    expect(localIsoDate(new Date(2026, 7, 10))).toBe('2026-08-10');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isPractice', () => {
  it('is true whenever ?practice=1 is present, regardless of the wall clock', () => {
    expect(isPractice('?practice=1')).toBe(true);
    expect(isPractice('?foo=bar&practice=1')).toBe(true);
  });

  it('falls back to "today < EPOCH" when no practice param is given', () => {
    // Self-consistent check (no clock mocking): isPractice must agree with the
    // same epoch comparison the implementation is documented to use.
    const expected = localIsoDate() < EPOCH;
    expect(isPractice('')).toBe(expected);
    expect(isPractice('?foo=bar')).toBe(expected);
  });
});

describe('practiceSeed', () => {
  it('returns an integer usable as a PRNG seed', () => {
    const seed = practiceSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});

// --- msToNextLocalMidnight (T17: Summary's countdown) -----------------------
//
// Unlike daysBetween (bare UTC-parsed ISO strings, immune to the local
// timezone), this reads the WALL CLOCK: `new Date(y, m, d, ...)`'s
// local-component overload, which the JS engine resolves against the host's
// own DST rules for that specific calendar date. Real DST transitions are
// exercised by switching process.env.TZ for the duration of one test (Node
// re-resolves tz rules per Date call, no caching) -- restored in afterEach so
// no other suite in this run observes a non-default timezone.
describe('msToNextLocalMidnight — real wall-clock countdown to 00:00 local', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('is exactly 2h on an ordinary (non-DST-transition) evening', () => {
    process.env.TZ = 'Europe/Madrid';
    const now = new Date(2026, 7, 10, 22, 0, 0, 0); // Aug 10 2026, 22:00 — no transition nearby
    expect(msToNextLocalMidnight(now)).toBe(2 * 3_600_000);
  });

  it('spans the full 25 real hours across the Europe/Madrid 2026 fall-back day (Oct 25 -> 26)', () => {
    process.env.TZ = 'Europe/Madrid';
    // Confirmed transition (see task report): CEST (UTC+2) -> CET (UTC+1) at
    // 03:00 local on 2026-10-25, making that calendar day 25 real hours long.
    // From 00:30 (before the repeated hour) to the FOLLOWING midnight is the
    // nominal 23.5h PLUS the one extra hour the fall-back inserts = 24.5h.
    // A naive fixed-UTC-offset countdown would answer 23.5h (84_600_000ms) —
    // exactly 1h short — so this test fails a DST-naive implementation.
    const now = new Date(2026, 9, 25, 0, 30, 0, 0);
    expect(msToNextLocalMidnight(now)).toBe(24.5 * 3_600_000);
  });

  it('spans exactly 22.5 real hours across the Europe/Madrid 2026 spring-forward day (Mar 29 -> 30)', () => {
    process.env.TZ = 'Europe/Madrid';
    // The other direction: CET -> CEST at 02:00 local on 2026-03-29 deletes an
    // hour, so the same 00:30 starting point is only 22.5 real hours from the
    // next midnight (23.5h nominal minus the missing hour).
    const now = new Date(2026, 2, 29, 0, 30, 0, 0);
    expect(msToNextLocalMidnight(now)).toBe(22.5 * 3_600_000);
  });

  it('is exactly 1ms just before local midnight', () => {
    process.env.TZ = 'Europe/Madrid';
    const now = new Date(2026, 7, 10, 23, 59, 59, 999);
    expect(msToNextLocalMidnight(now)).toBe(1);
  });

  it('rolls over the year boundary (Dec 31 -> Jan 1)', () => {
    process.env.TZ = 'Europe/Madrid';
    const now = new Date(2026, 11, 31, 23, 0, 0, 0);
    expect(msToNextLocalMidnight(now)).toBe(3_600_000);
  });

  it('agrees with the same fall-back arithmetic in a different real IANA zone (America/New_York, 2026-11-01 -> 02)', () => {
    process.env.TZ = 'America/New_York';
    const now = new Date(2026, 10, 1, 0, 30, 0, 0);
    expect(msToNextLocalMidnight(now)).toBe(24.5 * 3_600_000);
  });
});
