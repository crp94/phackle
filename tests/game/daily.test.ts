import { describe, expect, it } from 'vitest';
import { daysBetween, isPractice, localIsoDate, practiceSeed, puzzleNumber } from '../../src/game/daily';
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
