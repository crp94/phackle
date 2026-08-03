import { afterEach, describe, expect, it } from 'vitest';
import { daysBetween, isPractice, localIsoDate, msToNextLocalMidnight, practiceSeed, puzzleNumber } from '../../src/game/daily';
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
