// @vitest-environment jsdom
//
// jsdom for `localStorage`: two of the four sites below are storage's own, and
// this file drives them through the real module rather than a stub.
//
// §1(j)(2) — THE HONEST VERDICT IS TWO VERDICTS, AND FOUR PREDICATES USED TO
// GET IT WRONG BY DEFAULT.
//
// `verdictStamp` returned one `NULL_REPORTED` for every unpublished day, so a
// player who reported a null could not reach a positive verdict even on the
// day they were right — while §2.8's own score paid 80 for confirming a null
// and 20 for walking past a real effect. The stamp was the last surface still
// telling the honest player that the two came to the same thing.
//
// Splitting it moved risk somewhere specific. Four sites in the game layer
// asked "was this day published" as `stamp !== 'NULL_REPORTED'`, which is
// FAIL-OPEN: any verdict added to the union counts as a publication, silently,
// inside a career-points total and a success-rate percentage. Both new
// verdicts mean the opposite. This file is the net under that: the predicate
// they all read now, and each of the four sites driven with a MISSED_DISCOVERY
// record — the value the old spelling would have mis-classified.
import { describe, expect, it, beforeEach } from 'vitest';
import { honestStampFor, isHonestStamp, isPublishedStamp } from '../../src/game/verdict';
import { verdictStamp } from '../../src/engine/reveal';
import { modeSuccessRate } from '../../src/game/statsAgg';
import { evaluateAchievements } from '../../src/game/achievements';
import { loadState, migrate, saveDay } from '../../src/game/storage';
import type { DayRecord, DayType, PlayerAction, RevealMetrics, Spec } from '../../src/engine/types';

type Verdict = RevealMetrics['stamp'];

/** Every member of the union, written out. If the union grows and this list
 * does not, the totality test below says so — it is the one place in the
 * suite that knows how many verdicts there are supposed to be. */
const ALL_VERDICTS: Verdict[] = ['RETRACTED', 'REPLICATED', 'CONFIRMED_NULL', 'MISSED_DISCOVERY'];
const PUBLISHED_VERDICTS: Verdict[] = ['RETRACTED', 'REPLICATED'];
const HONEST_VERDICTS: Verdict[] = ['CONFIRMED_NULL', 'MISSED_DISCOVERY'];

const spec: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function record(overrides: Partial<DayRecord> = {}): DayRecord {
  return { mode: 'hack', score: 0, forks: 0, stamp: 'CONFIRMED_NULL', shareString: '', ...overrides };
}

describe('isPublishedStamp / isHonestStamp — the predicate the four sites share', () => {
  it('partitions the union: every verdict is exactly one of published or honest', () => {
    for (const v of ALL_VERDICTS) {
      expect(isPublishedStamp(v), v).toBe(!isHonestStamp(v));
    }
    expect(ALL_VERDICTS.filter(isPublishedStamp)).toEqual(PUBLISHED_VERDICTS);
    expect(ALL_VERDICTS.filter(isHonestStamp)).toEqual(HONEST_VERDICTS);
  });

  // The totality claim, stated where a reader can check it: `PUBLISHED` in
  // verdict.ts is a `Record<Verdict, boolean>`, so a fifth verdict is a
  // compile error there rather than a quiet `undefined`. A test cannot
  // reproduce a compile error, so it asserts the observable consequence — no
  // member of the union falls through the map — and names the mechanism.
  it('has an answer for every member of the union, with nothing falling through', () => {
    for (const v of ALL_VERDICTS) {
      expect(typeof isPublishedStamp(v), `no entry for ${v}`).toBe('boolean');
    }
    expect(ALL_VERDICTS).toHaveLength(4);
  });

  // A DayRecord read back out of localStorage is only structurally typed. A
  // record written by a build older than this ruling carries the retired
  // 'NULL_REPORTED', which is not a key in the map; it must read as
  // unpublished, which is what that verdict meant.
  it('reads a pre-split stored verdict as unpublished rather than as undefined', () => {
    const legacy = 'NULL_REPORTED' as unknown as Verdict;
    expect(isPublishedStamp(legacy)).toBe(false);
    expect(isHonestStamp(legacy)).toBe(true);
  });
});

describe('honestStampFor — one home for "which honest verdict", read by two layers', () => {
  it('is the day type and nothing else', () => {
    expect(honestStampFor('null')).toBe('CONFIRMED_NULL');
    expect(honestStampFor('effect')).toBe('MISSED_DISCOVERY');
  });

  // The engine's own branch must be this function, not a second copy of it:
  // store.ts's prereg correction re-resolves the same question for a commit
  // the engine cannot judge, and the two disagreeing would put a
  // MISSED_DISCOVERY on a null day.
  it('is exactly what verdictStamp returns for an unpublished day, on both day types', () => {
    for (const dayType of ['null', 'effect'] as DayType[]) {
      expect(verdictStamp(dayType, null, dayType === 'effect' ? 1 : null)).toBe(honestStampFor(dayType));
    }
  });
});

// --- the four sites, each driven with the value that used to slip through ---

describe('MISSED_DISCOVERY is not a publication, at every site that asks', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('statsAgg: it does not enter the success-rate numerator', () => {
    expect(modeSuccessRate([record({ stamp: 'MISSED_DISCOVERY' })])).toBe(0);
    expect(modeSuccessRate([record({ stamp: 'MISSED_DISCOVERY' }), record({ stamp: 'RETRACTED' })])).toBe(0.5);
  });

  it('storage/saveDay: a hack day that reported nothing earns no career points', () => {
    saveDay('2026-08-10', record({ mode: 'hack', stamp: 'MISSED_DISCOVERY' }));
    expect(loadState().stats.careerPoints).toBe(0);

    saveDay('2026-08-11', record({ mode: 'hack', stamp: 'RETRACTED' }));
    expect(loadState().stats.careerPoints).toBe(25);
  });

  it('storage/repair: the rebuilt career total treats it the same way saveDay does', () => {
    // w6-r-010's repair path reads `rec.stamp` off a blob `history` was only
    // ever validated as "is an object" — the one site where the value is not
    // even typed as a verdict, and therefore the one that most needed the
    // fail-open comparison replaced.
    const repaired = migrate(1, {
      version: 1,
      history: {
        '2026-08-10': { hack: record({ stamp: 'MISSED_DISCOVERY' }) },
        '2026-08-11': { hack: record({ stamp: 'REPLICATED' }) },
      },
      // An empty stats block: present (so the container is recognised) but
      // carrying none of the counters, which is the shape that sends every
      // one of them through `rebuildStatsFromHistory`.
      stats: {},
      achievements: {},
      settings: {},
    });
    expect(repaired.stats.careerPoints).toBe(25);
    expect(repaired.stats.hackDays).toBe(2);
  });

  it('achievements: a past MISSED_DISCOVERY day does not spend First Blood', () => {
    const log: PlayerAction[] = [
      { t: 'VIEW_SPEC', spec, seen: false, at: 0 },
      { t: 'SUBMIT', spec, p: 0.01, at: 1 },
    ];
    const earned = evaluateAchievements({
      log,
      published: spec,
      decisiveTails: false,
      history: { '2026-08-10': { hack: record({ stamp: 'MISSED_DISCOVERY' }) } },
      call: 'real',
      callCorrect: true,
      mode: 'hack',
      stamp: 'REPLICATED',
    });
    expect(earned, 'a day that published nothing was counted as a prior publication').toContain('first_blood');

    // ...and a genuine prior publication still spends it, so the assertion
    // above is about the verdict and not about the history being read at all.
    const afterARealOne = evaluateAchievements({
      log,
      published: spec,
      decisiveTails: false,
      history: { '2026-08-10': { hack: record({ stamp: 'RETRACTED' }) } },
      call: 'real',
      callCorrect: true,
      mode: 'hack',
      stamp: 'REPLICATED',
    });
    expect(afterARealOne).not.toContain('first_blood');
  });
});
