// Master spec §2.8 — daily scoring. Pure logic, no DOM — plain node env
// (vite.config.ts default; no jsdom pragma needed).
import { describe, expect, it } from 'vitest';
import { callIsCorrect, scoreDay } from '../../src/game/scoring';
import { SCORING } from '../../src/game/tuning';

// --- callIsCorrect ---------------------------------------------------------

describe('callIsCorrect (real<->effect, noise<->null)', () => {
  it('real is correct on an effect day', () => {
    expect(callIsCorrect('real', 'effect')).toBe(true);
  });
  it('real is incorrect on a null day', () => {
    expect(callIsCorrect('real', 'null')).toBe(false);
  });
  it('noise is correct on a null day', () => {
    expect(callIsCorrect('noise', 'null')).toBe(true);
  });
  it('noise is incorrect on an effect day', () => {
    expect(callIsCorrect('noise', 'effect')).toBe(false);
  });
});

// --- scoreDay: the 10 §2.8 rows, exhaustively -------------------------------

describe('scoreDay — §2.8 table, all 10 rows', () => {
  // Row 1+2: Correct/incorrect call (hack mode, published, one outcome family
  // so parsimony is at its max and does not obscure the base call points).
  it('row 1: correct call scores +100 (+ max parsimony at one family)', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'effect',
      published: true,
      callCorrect: true,
      outcomeFamilies: 1,
      stamp: 'REPLICATED',
    });
    expect(r.score).toBe(SCORING.correctCall + SCORING.parsimonyMax);
  });

  it('row 2: incorrect call scores +0, no parsimony', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: true,
      callCorrect: false,
      outcomeFamilies: 1,
      stamp: 'RETRACTED',
    });
    expect(r.score).toBe(SCORING.incorrectCall);
  });

  // Row 3: parsimony bonus, only when callCorrect — GR6 §1(f) charges per
  // distinct OUTCOME FAMILY beyond the first, not per fork.
  it('row 3: parsimony bonus is max(0, 40 - 14*(families - 1)) when call is correct', () => {
    const outcomeFamilies = 3;
    const r = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: true,
      callCorrect: true,
      outcomeFamilies,
      stamp: 'RETRACTED',
    });
    expect(r.score).toBe(
      SCORING.correctCall + Math.max(0, SCORING.parsimonyMax - SCORING.parsimonyPerExtraFamily * (outcomeFamilies - 1)),
    );
  });

  it('the whole scale, family by family: 1 -> 40, 2 -> 26, 3 -> 12, 4 -> 0', () => {
    // Pinned as literals, not recomputed from the constants: this is the table
    // §1(f) was ruled on ("the two intermediate steps are worth playing for"),
    // and a formula-shaped assertion would follow parsimonyPerExtraFamily
    // anywhere a future edit moved it, including to a value that re-kills the
    // row. There are exactly four outcome families, so this IS the whole scale.
    const scoreAt = (outcomeFamilies: number) =>
      scoreDay({
        mode: 'hack',
        dayType: 'null',
        published: true,
        callCorrect: true,
        outcomeFamilies,
        stamp: 'RETRACTED',
      }).breakdown.find(([k]) => k === 'summary.breakdownParsimony')![1];
    expect([1, 2, 3, 4].map(scoreAt)).toEqual([40, 26, 12, 0]);
  });

  it('probing ONE family is free however many forks it took (the §1(f) point)', () => {
    // gr2-007's actual complaint: the informed caller — the only model that
    // beats the base rate — earned the bonus on 2 days in 32, because checking
    // robustness inside a family costs forks. The input no longer carries a
    // fork count at all, so this is now true by construction; the test states
    // the property the construction exists for.
    expect(Object.keys(scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: true,
      callCorrect: true,
      outcomeFamilies: 1,
      stamp: 'RETRACTED',
    }))).not.toContain('forks');
  });

  it('parsimony clamps at 0 (all four families — the row 3 clamp case)', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: true,
      callCorrect: true,
      outcomeFamilies: 4,
      stamp: 'RETRACTED',
    });
    expect(r.score).toBe(SCORING.correctCall + 0);
  });

  it('parsimony is denied entirely on a wrong call, however few the families', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: true,
      callCorrect: false,
      outcomeFamilies: 1,
      stamp: 'RETRACTED',
    });
    expect(r.score).toBe(SCORING.incorrectCall);
  });

  // Row 4: Published career points — a separate cosmetic counter, unconditional
  // on call correctness, only present when the day was actually published.
  it('row 4: published awards +25 career points regardless of call correctness', () => {
    const correct = scoreDay({
      mode: 'hack',
      dayType: 'effect',
      published: true,
      callCorrect: true,
      outcomeFamilies: 1,
      stamp: 'REPLICATED',
    });
    const incorrect = scoreDay({
      mode: 'hack',
      dayType: 'effect',
      published: true,
      callCorrect: false,
      outcomeFamilies: 1,
      stamp: 'RETRACTED',
    });
    expect(correct.career).toBe(SCORING.publishedCareer);
    expect(incorrect.career).toBe(SCORING.publishedCareer);
  });

  it('abandoning (not published) earns no career points', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: false,
      callCorrect: true,
      outcomeFamilies: 1,
      stamp: 'CONFIRMED_NULL',
    });
    expect(r.career).toBe(0);
  });

  // Row 5: honest abandon, null day ("integrity bonus") — on top of the call.
  it('row 5: honest abandon on a null day adds the +80 integrity bonus', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: false,
      callCorrect: true,
      outcomeFamilies: 2,
      stamp: 'CONFIRMED_NULL',
    });
    const expectedParsimony = Math.max(0, SCORING.parsimonyMax - SCORING.parsimonyPerExtraFamily * 1);
    expect(r.score).toBe(SCORING.correctCall + expectedParsimony + SCORING.abandonNull);
  });

  // Row 6: honest abandon, effect day ("missed discovery").
  it('row 6: honest abandon on an effect day adds the +20 missed-discovery bonus', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'effect',
      published: false,
      callCorrect: false,
      outcomeFamilies: 1,
      stamp: 'MISSED_DISCOVERY',
    });
    // callCorrect is false here, so no call points and no parsimony — isolates
    // the abandonEffect bonus itself.
    expect(r.score).toBe(SCORING.incorrectCall + SCORING.abandonEffect);
  });

  it('honest abandon bonus applies independent of the call outcome', () => {
    const correctCall = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: false,
      callCorrect: true,
      outcomeFamilies: 1,
      stamp: 'CONFIRMED_NULL',
    });
    const wrongCall = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: false,
      callCorrect: false,
      outcomeFamilies: 1,
      stamp: 'CONFIRMED_NULL',
    });
    // The integrity bonus itself (isolate it by subtracting the call component).
    expect(correctCall.score - (SCORING.correctCall + SCORING.parsimonyMax)).toBe(SCORING.abandonNull);
    expect(wrongCall.score - SCORING.incorrectCall).toBe(SCORING.abandonNull);
  });

  // Row 7: Prereg, significant on effect day (true discovery).
  it('row 7: prereg significant + effect day scores +150', () => {
    const r = scoreDay({
      mode: 'prereg',
      dayType: 'effect',
      published: true,
      callCorrect: null,
      outcomeFamilies: 1,
      stamp: 'REPLICATED',
      preregSig: true,
    });
    expect(r.score).toBe(SCORING.preregSigEffect);
    expect(r.career).toBe(0);
  });

  // Row 8: Prereg, non-significant on null day.
  it('row 8: prereg non-significant + null day scores +100', () => {
    const r = scoreDay({
      mode: 'prereg',
      dayType: 'null',
      published: true,
      callCorrect: null,
      outcomeFamilies: 1,
      stamp: 'CONFIRMED_NULL',
      preregSig: false,
    });
    expect(r.score).toBe(SCORING.preregNonsigNull);
  });

  // Row 9: Prereg, non-significant on effect day (underpowered luck).
  it('row 9: prereg non-significant + effect day scores +40', () => {
    const r = scoreDay({
      mode: 'prereg',
      dayType: 'effect',
      published: true,
      callCorrect: null,
      outcomeFamilies: 1,
      stamp: 'MISSED_DISCOVERY',
      preregSig: false,
    });
    expect(r.score).toBe(SCORING.preregNonsigEffect);
  });

  // Row 10: Prereg, significant on null day (a real false positive) — scores 0.
  it('row 10: prereg significant + null day scores 0', () => {
    const r = scoreDay({
      mode: 'prereg',
      dayType: 'null',
      published: true,
      callCorrect: null,
      outcomeFamilies: 1,
      stamp: 'RETRACTED',
      preregSig: true,
    });
    expect(r.score).toBe(SCORING.preregSigNull);
    expect(r.score).toBe(0);
  });

  it('prereg families/callCorrect never leak into the prereg score (rows 7-10 ignore them)', () => {
    const withForks = scoreDay({
      mode: 'prereg',
      dayType: 'effect',
      published: true,
      callCorrect: null,
      outcomeFamilies: 4,
      stamp: 'REPLICATED',
      preregSig: true,
    });
    expect(withForks.score).toBe(SCORING.preregSigEffect);
  });

  // --- breakdown: non-tautological, uses distinct CopyKeys per applicable row ---
  describe('breakdown — distinct CopyKey per applicable §2.8 row (not a restated total)', () => {
    it('hack + correct + published: call row and parsimony row, not a single lump total', () => {
      const r = scoreDay({
        mode: 'hack',
        dayType: 'effect',
        published: true,
        callCorrect: true,
        outcomeFamilies: 1,
        stamp: 'REPLICATED',
      });
      const keys = r.breakdown.map(([k]) => k);
      expect(keys).toContain('summary.breakdownCallCorrect');
      expect(keys).toContain('summary.breakdownParsimony');
      // Not a tautology: no entry merely restates the total score under a
      // generic label — every breakdown entry's value is a strict summand.
      expect(r.breakdown.some(([, v]) => v === r.score)).toBe(r.breakdown.length === 1);
      const sum = r.breakdown.reduce((acc, [, v]) => acc + v, 0);
      expect(sum).toBe(r.score);
    });

    it('honest abandon on a null day: distinct call-row and integrity-row entries', () => {
      const r = scoreDay({
        mode: 'hack',
        dayType: 'null',
        published: false,
        callCorrect: true,
        outcomeFamilies: 1,
        stamp: 'CONFIRMED_NULL',
      });
      const keys = r.breakdown.map(([k]) => k);
      expect(keys).toContain('summary.breakdownCallCorrect');
      expect(keys).toContain('summary.breakdownIntegrity');
      expect(new Set(keys).size).toBe(keys.length); // no duplicate labels
      const sum = r.breakdown.reduce((acc, [, v]) => acc + v, 0);
      expect(sum).toBe(r.score);
    });

    it('each of the 4 prereg rows gets its own distinct breakdown label', () => {
      const trueDiscovery = scoreDay({
        mode: 'prereg',
        dayType: 'effect',
        published: true,
        callCorrect: null,
        outcomeFamilies: 1,
        stamp: 'REPLICATED',
        preregSig: true,
      });
      const confirmedNull = scoreDay({
        mode: 'prereg',
        dayType: 'null',
        published: true,
        callCorrect: null,
        outcomeFamilies: 1,
        stamp: 'CONFIRMED_NULL',
        preregSig: false,
      });
      const underpoweredLuck = scoreDay({
        mode: 'prereg',
        dayType: 'effect',
        published: true,
        callCorrect: null,
        outcomeFamilies: 1,
        stamp: 'MISSED_DISCOVERY',
        preregSig: false,
      });
      const falsePositive = scoreDay({
        mode: 'prereg',
        dayType: 'null',
        published: true,
        callCorrect: null,
        outcomeFamilies: 1,
        stamp: 'RETRACTED',
        preregSig: true,
      });
      expect(trueDiscovery.breakdown).toEqual([['summary.breakdownTrueDiscovery', SCORING.preregSigEffect]]);
      expect(confirmedNull.breakdown).toEqual([['summary.breakdownConfirmedNull', SCORING.preregNonsigNull]]);
      expect(underpoweredLuck.breakdown).toEqual([
        ['summary.breakdownUnderpoweredLuck', SCORING.preregNonsigEffect],
      ]);
      expect(falsePositive.breakdown).toEqual([['summary.breakdownFalsePositive', SCORING.preregSigNull]]);
      // All four distinct — proves the prereg branch isn't reusing one key
      // across different outcomes (that would be the tautology to catch).
      const allKeys = [trueDiscovery, confirmedNull, underpoweredLuck, falsePositive].map(
        (r) => r.breakdown[0][0]
      );
      expect(new Set(allKeys).size).toBe(4);
    });
  });
});

// --- gr6-018: the invoice itemises, including the zeros ---------------------
//
// The modal Hacking Mode day is "published, called wrong" — 75% of days are
// null, the credulous first-timer publishes and calls "real", and
// `incorrectCall` is worth 0. Parsimony was gated behind `callCorrect ===
// true`, so that day produced a breakdown of exactly ONE row reading 0: a
// screen titled "Invoice", one line item of zero, and a total of zero, two
// screens after the same day printed "+25 career points" in gold.
//
// The scoring is untouched (0 for a wrong call is correct and pointed). What
// changes is that the row a player did NOT earn is now shown at its computed
// value instead of being omitted — which is what an invoice does.
describe('gr6-018 — the parsimony row is always itemised, at its computed value', () => {
  it('a published, wrongly-called day shows parsimony at 0 rather than omitting the row', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'null',
      published: true,
      callCorrect: false,
      outcomeFamilies: 1,
      stamp: 'RETRACTED',
    });
    expect(r.breakdown).toEqual([
      ['summary.breakdownCallIncorrect', 0],
      ['summary.breakdownParsimony', 0],
    ]);
    expect(r.score).toBe(0); // NO scoring change
    expect(r.career).toBe(SCORING.publishedCareer);
  });

  it('a correct call still shows parsimony at its real computed value', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'effect',
      published: true,
      callCorrect: true,
      outcomeFamilies: 2,
      stamp: 'REPLICATED',
    });
    const parsimony = Math.max(0, SCORING.parsimonyMax - SCORING.parsimonyPerExtraFamily * 1);
    expect(r.breakdown).toContainEqual(['summary.breakdownParsimony', parsimony]);
    expect(r.score).toBe(SCORING.correctCall + parsimony);
  });

  it('a correct call that shopped every outcome shows the same honest 0', () => {
    const r = scoreDay({
      mode: 'hack',
      dayType: 'effect',
      published: true,
      callCorrect: true,
      outcomeFamilies: 4,
      stamp: 'REPLICATED',
    });
    expect(r.breakdown).toContainEqual(['summary.breakdownParsimony', 0]);
    expect(r.score).toBe(SCORING.correctCall);
  });

  it('every hack-mode breakdown still sums exactly to the score (the zero row is a strict summand)', () => {
    for (const published of [true, false]) {
      for (const callCorrect of [true, false]) {
        for (const dayType of ['null', 'effect'] as const) {
          for (const outcomeFamilies of [0, 1, 2, 3, 4]) {
            const r = scoreDay({ mode: 'hack', dayType, published, callCorrect, outcomeFamilies, stamp: 'RETRACTED' });
            const sum = r.breakdown.reduce((acc, [, v]) => acc + v, 0);
            expect(sum, `${dayType}/${published}/${callCorrect}/${outcomeFamilies}`).toBe(r.score);
            expect(r.breakdown.length).toBeGreaterThanOrEqual(2);
            const keys = r.breakdown.map(([k]) => k);
            expect(new Set(keys).size).toBe(keys.length);
          }
        }
      }
    }
  });

  it('Prereg Mode keeps its own self-contained single row (no parsimony there at all)', () => {
    const r = scoreDay({
      mode: 'prereg',
      dayType: 'null',
      published: true,
      callCorrect: null,
      outcomeFamilies: 1,
      stamp: 'CONFIRMED_NULL',
      preregSig: false,
    });
    expect(r.breakdown.map(([k]) => k)).toEqual(['summary.breakdownConfirmedNull']);
  });
});
