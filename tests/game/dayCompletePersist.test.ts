// @vitest-environment jsdom
//
// gr6-019 — the award ceremony, and what it is allowed to celebrate.
//
// `evaluateAchievements` applies "newly earned" logic to exactly four of the
// eleven ids (first_blood, first_retraction, monk, true_detective). The other
// seven re-fire every single day their condition holds, and the Summary
// rendered that raw list as "UNLOCKED TODAY". Measured over 32 consecutive
// days of an informed caller: Subgroup Safari on 30 of 32 days, Well Actually
// on 22, HARKing on 13 — 21 "unlocks" in week one out of an 11-item set. The
// Stats wall, fed by the merge-only `saveAchievements`, quietly disagreed with
// the ceremony the whole time.
//
// jsdom because persistAndComputeSummary IS the persistence moment: without a
// window, storage.ts's own hasWindow() guard turns every load into a fresh
// state and every save into a no-op, which would make a multi-day script
// vacuous.
import { describe, expect, it, beforeEach } from 'vitest';
import { persistAndComputeSummary, type FinishedGameFields } from '../../src/game/dayComplete';
import { loadState } from '../../src/game/storage';
import { copy as enCopy } from '../../src/content/en/copy';
import type { PlayerAction, Spec } from '../../src/engine/types';

const baseSpec: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

const SUBGROUPS: Spec['subgroup'][] = ['all', 'urban', 'rural', 'age_lt40', 'age_ge40', 'exp_high'];

/** A day that trips Subgroup Safari (>=5 distinct subgroups viewed) and then
 * publishes — the exact shape that re-fired 30 days out of 32. */
function safariDay(day: number): PlayerAction[] {
  const log: PlayerAction[] = [{ t: 'VIEW_SPEC', spec: baseSpec, seen: false, at: 0 }];
  SUBGROUPS.forEach((subgroup, i) => {
    log.push({ t: 'VIEW_SPEC', spec: { ...baseSpec, subgroup }, seen: true, at: day * 100 + i + 1 });
  });
  log.push({ t: 'SUBMIT', spec: { ...baseSpec, subgroup: 'exp_high' }, p: 0.01, at: day * 100 + 90 });
  log.push({ t: 'CALL', verdict: 'real', at: day * 100 + 91 });
  return log;
}

function fields(overrides: Partial<FinishedGameFields> = {}): FinishedGameFields {
  return {
    mode: 'hack',
    practice: false,
    puzzleNumber: 1,
    forks: 6,
    published: true,
    call: 'real',
    dayType: 'null',
    stamp: 'RETRACTED',
    log: safariDay(1),
    copy: enCopy,
    puzzleIso: '2026-08-10',
    resultLog: [],
    ...overrides,
  };
}

/** ISO dates walking forward from EPOCH, so the streak is unbroken and the
 * script exercises the real merge-save rather than a series of first days. */
function isoForDay(dayIndex: number): string {
  const d = new Date(Date.UTC(2026, 7, 10));
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('persistAndComputeSummary (gr6-019) — the ceremony celebrates only what is genuinely new', () => {
  it('fires a repeat-condition trophy exactly ONCE across a scripted eight-day run', () => {
    const firings: string[][] = [];
    for (let day = 0; day < 8; day++) {
      const result = persistAndComputeSummary(
        fields({ puzzleNumber: day + 1, puzzleIso: isoForDay(day), log: safariDay(day) })
      );
      firings.push(result.unlockedToday);
    }

    const safariFirings = firings.filter((ids) => ids.includes('subgroup_safari'));
    expect(safariFirings).toHaveLength(1);
    expect(firings[0]).toContain('subgroup_safari');
    // Days 2..8 met the SAME condition and must celebrate nothing at all.
    for (let day = 1; day < 8; day++) {
      expect(firings[day], `day ${day + 1} re-ran the ceremony`).toEqual([]);
    }
  });

  it('day one still celebrates everything it genuinely earned', () => {
    const result = persistAndComputeSummary(fields({ puzzleIso: isoForDay(0) }));
    // first_blood (first publication ever), first_retraction (first RETRACTED
    // stamp), subgroup_safari (>=5 subgroups) — all three genuinely new.
    expect(result.unlockedToday).toEqual(['first_blood', 'first_retraction', 'subgroup_safari']);
  });

  it('the Stats wall and the ceremony now agree: every celebrated id is exactly a NEW storage entry', () => {
    for (let day = 0; day < 5; day++) {
      const before = Object.keys(loadState().achievements).sort();
      const result = persistAndComputeSummary(
        fields({ puzzleNumber: day + 1, puzzleIso: isoForDay(day), log: safariDay(day) })
      );
      const after = Object.keys(loadState().achievements).sort();
      const added = after.filter((id) => !before.includes(id)).sort();
      expect([...result.unlockedToday].sort(), `day ${day + 1}`).toEqual(added);
    }
  });

  it('an id first earned on a LATER day still gets its ceremony on that day', () => {
    persistAndComputeSummary(fields({ puzzleIso: isoForDay(0) }));
    // Day 2 adds three peeks — "Just One More Batch", earned for the first
    // time on a day that had already unlocked three other things.
    const day2Log = safariDay(2);
    day2Log.splice(1, 0,
      { t: 'PEEK_AND_EXTEND', newN: 250, at: 201 },
      { t: 'PEEK_AND_EXTEND', newN: 300, at: 202 },
      { t: 'PEEK_AND_EXTEND', newN: 350, at: 203 }
    );
    const result = persistAndComputeSummary(fields({ puzzleNumber: 2, puzzleIso: isoForDay(1), log: day2Log }));
    expect(result.unlockedToday).toEqual(['one_more_batch']);
  });

  it('still unlocks the prereg door on the very summary that earned it (preregUnlocked is not filtered away)', () => {
    const result = persistAndComputeSummary(fields({ puzzleIso: isoForDay(0) }));
    expect(result.unlockedToday).toContain('first_retraction');
    expect(result.preregUnlocked).toBe(true);
  });

  it('a practice day celebrates nothing and persists nothing (the guard is inherited, not reimplemented)', () => {
    const result = persistAndComputeSummary(fields({ practice: true, puzzleIso: isoForDay(0) }));
    expect(result.unlockedToday).toEqual([]);
    expect(loadState().achievements).toEqual({});
  });
});

// --- gr6-018 / gr6-020: what the finished day hands the screen -------------

describe('persistAndComputeSummary — career (gr6-018) and preregPlayedToday (gr6-020)', () => {
  it('carries the +25 career track a published hack day earned, so the invoice and the cover agree', () => {
    const result = persistAndComputeSummary(fields({ puzzleIso: isoForDay(0) }));
    expect(result.career).toBe(25);
  });

  it('carries a real 0 on an abandoned hack day rather than dropping the line', () => {
    const abandonLog: PlayerAction[] = [
      { t: 'VIEW_SPEC', spec: baseSpec, seen: false, at: 0 },
      { t: 'ABANDON', at: 1 },
      { t: 'CALL', verdict: 'noise', at: 2 },
    ];
    const result = persistAndComputeSummary(
      fields({ puzzleIso: isoForDay(0), published: false, call: 'noise', stamp: 'NULL_REPORTED', log: abandonLog })
    );
    expect(result.career).toBe(0);
  });

  it('carries null on a prereg day — §2.8 gives Prereg Mode no career track at all', () => {
    const result = persistAndComputeSummary(
      fields({ mode: 'prereg', puzzleIso: isoForDay(0), call: null, stamp: 'NULL_REPORTED' })
    );
    expect(result.career).toBeNull();
  });

  it('reports preregPlayedToday on the prereg day being finished right now', () => {
    const result = persistAndComputeSummary(
      fields({ mode: 'prereg', puzzleIso: isoForDay(0), call: null, stamp: 'NULL_REPORTED' })
    );
    expect(result.preregPlayedToday).toBe(true);
  });

  it('reports preregPlayedToday on a HACK summary for a date whose prereg play is already spent', () => {
    persistAndComputeSummary(fields({ mode: 'prereg', puzzleIso: isoForDay(0), call: null, stamp: 'NULL_REPORTED' }));
    const result = persistAndComputeSummary(fields({ puzzleIso: isoForDay(0) }));
    expect(result.preregPlayedToday).toBe(true);
  });

  it('reports false on an ordinary hack day that still has its prereg attempt', () => {
    const result = persistAndComputeSummary(fields({ puzzleIso: isoForDay(0) }));
    expect(result.preregPlayedToday).toBe(false);
  });
});

// --- gr6-078: a practice day must not move the streak it never joins --------
//
// The invoice said N+1, storage said N, and the Stats wall (which prints
// `stats.streak`) said N too — with the overclaimed number embedded in the
// share text, so it left the app. The fix is measured here in the only terms
// that matter: the number this function returns, against the number the rest
// of the product is showing that same player.
describe('persistAndComputeSummary (gr6-078) — the streak on a practice day', () => {
  /** Play `days` consecutive REAL days ending at isoForDay(days - 1). */
  function playRealDays(days: number): void {
    for (let day = 0; day < days; day++) {
      persistAndComputeSummary(fields({ puzzleNumber: day + 1, puzzleIso: isoForDay(day), log: safariDay(day) }));
    }
  }

  it('agrees with the Stats wall instead of claiming a day that was never saved', () => {
    playRealDays(7);
    const stored = loadState().stats.streak;
    expect(stored, 'the fixture did not actually build a streak').toBe(7);

    // The practice run is on the NEXT day, which has no record and never will.
    const practiceResult = persistAndComputeSummary(
      fields({ practice: true, puzzleNumber: 8, puzzleIso: isoForDay(7), log: safariDay(8) })
    );

    expect(practiceResult.streak, 'the invoice claimed a day storage does not hold').toBe(stored);
    expect(loadState().history[isoForDay(7)], 'a practice day wrote a record').toBeUndefined();
    expect(loadState().stats.streak, 'a practice day moved the stored streak').toBe(stored);
  });

  it('puts the same, unmoved number in the share text (it is the figure that leaves the app)', () => {
    playRealDays(7);
    const practiceResult = persistAndComputeSummary(
      fields({ practice: true, puzzleNumber: 8, puzzleIso: isoForDay(7), log: safariDay(8) })
    );
    expect(practiceResult.shareText).toContain(`${enCopy['share.streakWord']}: 7`);
    expect(practiceResult.shareText, 'the overclaimed streak is still in the paste').not.toContain(
      `${enCopy['share.streakWord']}: 8`
    );
  });

  it('does NOT answer 0 — the failure mode of the obvious fix, and the one a player would read as a lost streak', () => {
    playRealDays(7);
    const practiceResult = persistAndComputeSummary(
      fields({ practice: true, puzzleNumber: 8, puzzleIso: isoForDay(7), log: safariDay(8) })
    );
    // `streakAfter(state.history, puzzleIso)` walks back from a day with no
    // record and stops immediately. Dropping the placeholder without reading
    // `stats.streak` therefore prints "Streak: 0" at a player on a 7-day run.
    expect(practiceResult.streak).not.toBe(0);
  });

  it('a REAL day still counts itself: the placeholder branch is untouched', () => {
    playRealDays(7);
    const realResult = persistAndComputeSummary(
      fields({ puzzleNumber: 8, puzzleIso: isoForDay(7), log: safariDay(8) })
    );
    expect(realResult.streak).toBe(8);
    expect(loadState().stats.streak).toBe(8);
  });

  it('a practice run on a day the player HAS already really played reads that day\'s own streak', () => {
    playRealDays(7);
    // The real day 8 is played for real; the practice replay follows it.
    persistAndComputeSummary(fields({ puzzleNumber: 8, puzzleIso: isoForDay(7), log: safariDay(8) }));
    const practiceResult = persistAndComputeSummary(
      fields({ practice: true, puzzleNumber: 8, puzzleIso: isoForDay(7), log: safariDay(9) })
    );
    expect(practiceResult.streak).toBe(8);
  });

  it('the practice paste says it is practice (gr6-022, at the one call site that builds it)', () => {
    playRealDays(1);
    const practiceResult = persistAndComputeSummary(
      fields({ practice: true, puzzleNumber: 2, puzzleIso: isoForDay(1), log: safariDay(2) })
    );
    expect(practiceResult.shareText.split('\n')[0]).toBe(`P-hackle (${enCopy['nav.practiceMode']})`);
  });
});
