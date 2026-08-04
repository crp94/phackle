// T24 CI finalize — the EPOCH guard, booked from T23's review.
//
// e2e/harness.ts pins ONE fixed instant (PUZZLE_ISO = '2026-08-14') as
// "today" for the whole Playwright flow suite. daily.ts's `isPractice()`
// treats any real date STRICTLY BEFORE `tuning.ts`'s EPOCH as practice mode:
// a fresh `Math.random()` seed every load (so no two runs share a puzzle),
// negative puzzle numbers, and the entire persistence path
// (`Summary`'s saveDay/saveAchievements) skipped. The whole e2e suite's
// claim — that it exercises the REAL daily-puzzle product, not practice mode
// — depends entirely on PUZZLE_ISO landing after EPOCH.
//
// T25 will freeze EPOCH to the real launch date. If that freeze ever lands
// ON OR AFTER this stale PUZZLE_ISO, every e2e flow would silently degrade
// into practice mode — and, because practice mode still renders a full game,
// the suite would keep reporting green while testing nothing real. This
// test is the tripwire: a cheap, fast assertion that fails LOUDLY, with the
// exact dates in the message and a pointer to both files to fix, instead of
// letting that happen quietly.
import { describe, expect, it } from 'vitest';
import { PUZZLE_ISO, PUZZLE_NUMBER } from '../../e2e/harness';
import { daysBetween, puzzleNumber } from '../../src/game/daily';
import { EPOCH } from '../../src/game/tuning';

describe('EPOCH guard — e2e/harness.ts PUZZLE_ISO vs. src/game/tuning.ts EPOCH', () => {
  it('PUZZLE_ISO is strictly after EPOCH (bare-string compare, independent of daysBetween)', () => {
    // Lexicographic comparison on bare `YYYY-MM-DD` strings sorts identically
    // to calendar order, so this does not lean on daily.ts's own date math to
    // check daily.ts's own precondition.
    expect(
      PUZZLE_ISO > EPOCH,
      `EPOCH GUARD FAILED: e2e/harness.ts's PUZZLE_ISO ('${PUZZLE_ISO}') is not strictly after ` +
        `src/game/tuning.ts's EPOCH ('${EPOCH}'). daily.ts's isPractice() treats any real date ` +
        `before EPOCH as practice mode, which would silently degrade every e2e flow (hack/abandon/` +
        `prereg/i18n) into practice mode: fresh Math.random() seeds, negative puzzle numbers, no ` +
        `persistence — and the suite would keep reporting green while testing nothing real. ` +
        `Fix: bump PUZZLE_ISO in e2e/harness.ts (and its PUZZLE_NUMBER/scenario comments) to a date ` +
        `strictly after the new EPOCH.`,
    ).toBe(true);
  });

  it('daysBetween(EPOCH, PUZZLE_ISO) is positive, and matches harness.ts\'s own PUZZLE_NUMBER comment', () => {
    const gap = daysBetween(EPOCH, PUZZLE_ISO);
    expect(
      gap,
      `EPOCH GUARD FAILED: daysBetween(EPOCH='${EPOCH}', PUZZLE_ISO='${PUZZLE_ISO}') = ${gap}, not > 0. ` +
        `This is the same arithmetic daily.ts's puzzleNumber()/isPractice() use in production, so a ` +
        `non-positive gap here means the e2e suite's fixed day IS the practice-mode boundary.`,
    ).toBeGreaterThan(0);

    // Belt-and-braces: harness.ts hand-comments `PUZZLE_NUMBER = 5; //
    // daysBetween(EPOCH, PUZZLE_ISO) + 1`. If EPOCH moves and that comment is
    // not updated alongside it, this catches the drift too.
    expect(
      PUZZLE_NUMBER,
      `e2e/harness.ts's exported PUZZLE_NUMBER (${PUZZLE_NUMBER}) no longer matches ` +
        `puzzleNumber(PUZZLE_ISO) computed from the current EPOCH ('${EPOCH}') = ${puzzleNumber(PUZZLE_ISO)}. ` +
        `Update the PUZZLE_NUMBER constant (and its comment) in e2e/harness.ts.`,
    ).toBe(puzzleNumber(PUZZLE_ISO));
  });
});
