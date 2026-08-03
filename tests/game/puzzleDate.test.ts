import { describe, expect, it } from 'vitest';
import { isoFromPuzzleNumber } from '../../src/game/puzzleDate';
import { puzzleNumber } from '../../src/game/daily';
import { EPOCH } from '../../src/game/tuning';

/**
 * T15 needs today's ISO date string inside Briefing/Published (pickJournal,
 * the press picker, and Grantwell's rotation all hash `iso`, per the
 * controller's pinned formulas) but GameStore (T12, frozen — not owned by
 * this task) exposes only `puzzleNumber`, not `iso` itself. This is the exact
 * inverse of src/game/daily.ts's `puzzleNumber(iso) = daysBetween(EPOCH, iso)
 * + 1`, kept in its own tiny module (not bolted onto daily.ts, which this
 * task does not own) so both Briefing.tsx and Published.tsx can share one
 * implementation instead of duplicating the arithmetic.
 */
describe('isoFromPuzzleNumber', () => {
  it('maps puzzle #1 back to EPOCH', () => {
    expect(isoFromPuzzleNumber(1)).toBe(EPOCH);
  });

  it('adds whole days forward for later puzzle numbers', () => {
    expect(isoFromPuzzleNumber(2)).toBe('2026-08-11');
    expect(isoFromPuzzleNumber(22)).toBe('2026-08-31'); // crosses into September next
    expect(isoFromPuzzleNumber(23)).toBe('2026-09-01'); // month boundary
  });

  it('is the exact left inverse of puzzleNumber() across a spread of dates, including a year boundary', () => {
    for (const n of [1, 2, 30, 145, 365, 366, 1000]) {
      expect(puzzleNumber(isoFromPuzzleNumber(n))).toBe(n);
    }
  });

  it('handles pre-EPOCH (dev/practice) puzzle numbers without throwing', () => {
    // isPractice()'s own doc comment: "today (locally) is before EPOCH" is a
    // legal pre-launch/dev state, so puzzleNumber can be <= 0 there too.
    expect(isoFromPuzzleNumber(0)).toBe('2026-08-09');
    expect(puzzleNumber(isoFromPuzzleNumber(-5))).toBe(-5);
  });
});
