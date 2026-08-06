// Master spec §2.11 — achievements. Pure logic, plain node env.
import { describe, expect, it } from 'vitest';
import { evaluateAchievements, type ModeHistory } from '../../src/game/achievements';
import type { DayRecord, Outcome, PlayerAction, Spec } from '../../src/engine/types';

// --- fixtures ---------------------------------------------------------------

const baseSpec: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function spec(overrides: Partial<Omit<Spec, 'covariates'>> & { covariates?: Partial<Spec['covariates']> } = {}): Spec {
  return { ...baseSpec, ...overrides, covariates: { ...baseSpec.covariates, ...overrides.covariates } };
}

function view(s: Spec, seen: boolean, at = 0): PlayerAction {
  return { t: 'VIEW_SPEC', spec: s, seen, at };
}

function peek(at = 0): PlayerAction {
  return { t: 'PEEK_AND_EXTEND', newN: 250, at };
}

function day(overrides: Partial<DayRecord> = {}): DayRecord {
  return { mode: 'hack', score: 100, forks: 0, stamp: 'RETRACTED', shareString: '', ...overrides };
}

/** Builds a ModeHistory with one hack-mode record per given ISO date, all
 * sharing the same DayRecord overrides (used for monk/true_detective bulk
 * fixtures where only the count/order of days matters). */
function bulkHistory(isoDates: string[], overrides: Partial<DayRecord> = {}, mode: 'hack' | 'prereg' = 'hack'): ModeHistory {
  const h: ModeHistory = {};
  for (const iso of isoDates) h[iso] = { [mode]: day({ mode, ...overrides }) };
  return h;
}

function isoSeq(n: number, startDay = 1): string[] {
  return Array.from({ length: n }, (_, i) => `2026-01-${String(startDay + i).padStart(2, '0')}`);
}

const SUBGROUPS: Spec['subgroup'][] = ['all', 'age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'];
const OUTCOMES: Outcome[] = [0, 1, 2, 3];

/** The nth of 28 structurally-distinct specs (4 outcomes x 7 subgroups),
 * enough to cover both subgroup_safari (>=5) and garden (>=25). */
function nthSpec(n: number): Spec {
  return spec({ outcome: OUTCOMES[n % 4], subgroup: SUBGROUPS[Math.floor(n / 4) % 7] });
}

function baseCtx(): Parameters<typeof evaluateAchievements>[0] {
  return {
    log: [view(baseSpec, false)],
    published: null,
    decisiveTails: false,
    history: {},
    call: null,
    callCorrect: null,
    mode: 'hack',
    stamp: 'CONFIRMED_NULL',
  };
}

// --- First Blood -------------------------------------------------------------

describe('first_blood — first publication', () => {
  it('triggers on the first-ever publish', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), stamp: 'REPLICATED', history: {} });
    expect(out).toContain('first_blood');
  });

  it('does not re-trigger once a prior day was already published', () => {
    const history = bulkHistory(['2026-01-01'], { stamp: 'REPLICATED' });
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), stamp: 'REPLICATED', history });
    expect(out).not.toContain('first_blood');
  });

  it('does not trigger on an abandoned day', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: null, stamp: 'CONFIRMED_NULL' });
    expect(out).not.toContain('first_blood');
  });
});

// --- First Retraction --------------------------------------------------------

describe('first_retraction — first RETRACTED stamp', () => {
  it('triggers on the first RETRACTED stamp', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), stamp: 'RETRACTED', history: {} });
    expect(out).toContain('first_retraction');
  });

  it('does not re-trigger once a prior day was already RETRACTED', () => {
    const history = bulkHistory(['2026-01-01'], { stamp: 'RETRACTED' });
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), stamp: 'RETRACTED', history });
    expect(out).not.toContain('first_retraction');
  });

  it('does not trigger on a REPLICATED stamp', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), stamp: 'REPLICATED', history: {} });
    expect(out).not.toContain('first_retraction');
  });
});

// --- HARKing ------------------------------------------------------------------

describe('harking — outcome changed >=3 times, then published', () => {
  it('triggers with 3 outcome changes before publishing', () => {
    const log: PlayerAction[] = [
      view(spec({ outcome: 0 }), false, 0),
      view(spec({ outcome: 1 }), true, 1),
      view(spec({ outcome: 2 }), true, 2),
      view(spec({ outcome: 3 }), true, 3),
    ];
    const out = evaluateAchievements({ ...baseCtx(), log, published: spec({ outcome: 3 }), stamp: 'RETRACTED' });
    expect(out).toContain('harking');
  });

  it('does not trigger with only 2 outcome changes', () => {
    const log: PlayerAction[] = [
      view(spec({ outcome: 0 }), false, 0),
      view(spec({ outcome: 1 }), true, 1),
      view(spec({ outcome: 2 }), true, 2),
    ];
    const out = evaluateAchievements({ ...baseCtx(), log, published: spec({ outcome: 2 }), stamp: 'RETRACTED' });
    expect(out).not.toContain('harking');
  });

  it('does not trigger without publishing, however many outcome changes', () => {
    const log: PlayerAction[] = [
      view(spec({ outcome: 0 }), false, 0),
      view(spec({ outcome: 1 }), true, 1),
      view(spec({ outcome: 2 }), true, 2),
      view(spec({ outcome: 3 }), true, 3),
    ];
    const out = evaluateAchievements({ ...baseCtx(), log, published: null, stamp: 'CONFIRMED_NULL' });
    expect(out).not.toContain('harking');
  });
});

// --- The One-Tailed Bandit ----------------------------------------------------

describe('one_tailed_bandit — decisive fork was the flip to one-tailed', () => {
  it('triggers when published and decisiveTails is true', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec({ tails: 'one' }), decisiveTails: true, stamp: 'RETRACTED' });
    expect(out).toContain('one_tailed_bandit');
  });

  it('does not trigger when decisiveTails is false', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec({ tails: 'one' }), decisiveTails: false, stamp: 'RETRACTED' });
    expect(out).not.toContain('one_tailed_bandit');
  });

  it('does not trigger without publishing, even if decisiveTails is true', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: null, decisiveTails: true, stamp: 'CONFIRMED_NULL' });
    expect(out).not.toContain('one_tailed_bandit');
  });
});

// --- Outlier Surgeon -----------------------------------------------------------

describe('outlier_surgeon — published with |z|>2 active', () => {
  it('triggers when the published spec uses the z2 exclusion', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec({ exclusion: 'z2' }), stamp: 'RETRACTED' });
    expect(out).toContain('outlier_surgeon');
  });

  it('does not trigger with a less aggressive exclusion', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec({ exclusion: 'z2_5' }), stamp: 'RETRACTED' });
    expect(out).not.toContain('outlier_surgeon');
  });
});

// --- Subgroup Safari -----------------------------------------------------------

describe('subgroup_safari — >=5 distinct subgroup filters viewed in one day', () => {
  it('triggers after viewing 5 distinct subgroups', () => {
    const log: PlayerAction[] = SUBGROUPS.slice(0, 5).map((subgroup, idx) => view(spec({ subgroup }), idx > 0, idx));
    const out = evaluateAchievements({ ...baseCtx(), log, published: null });
    expect(out).toContain('subgroup_safari');
  });

  it('does not trigger with only 4 distinct subgroups', () => {
    const log: PlayerAction[] = SUBGROUPS.slice(0, 4).map((subgroup, idx) => view(spec({ subgroup }), idx > 0, idx));
    const out = evaluateAchievements({ ...baseCtx(), log, published: null });
    expect(out).not.toContain('subgroup_safari');
  });
});

// --- Just One More Batch --------------------------------------------------------

describe('one_more_batch — 3+ peek-and-extends in one day', () => {
  it('triggers on the 3rd peek', () => {
    const log: PlayerAction[] = [peek(0), peek(1), peek(2)];
    const out = evaluateAchievements({ ...baseCtx(), log });
    expect(out).toContain('one_more_batch');
  });

  it('does not trigger on only 2 peeks', () => {
    const log: PlayerAction[] = [peek(0), peek(1)];
    const out = evaluateAchievements({ ...baseCtx(), log });
    expect(out).not.toContain('one_more_batch');
  });
});

// --- Garden of Forking Paths ------------------------------------------------------

describe('garden — >=25 distinct specs viewed in one day', () => {
  it('triggers at 25 distinct specs', () => {
    const log: PlayerAction[] = Array.from({ length: 25 }, (_, i) => view(nthSpec(i), i > 0, i));
    const out = evaluateAchievements({ ...baseCtx(), log });
    expect(out).toContain('garden');
  });

  it('does not trigger at 24 distinct specs', () => {
    const log: PlayerAction[] = Array.from({ length: 24 }, (_, i) => view(nthSpec(i), i > 0, i));
    const out = evaluateAchievements({ ...baseCtx(), log });
    expect(out).not.toContain('garden');
  });
});

// --- The Monk ------------------------------------------------------------------

describe('monk — 20 Prereg Mode days played', () => {
  it('triggers the day the 20th prereg day is played', () => {
    const history = bulkHistory(isoSeq(19), {}, 'prereg');
    const out = evaluateAchievements({ ...baseCtx(), history, mode: 'prereg' });
    expect(out).toContain('monk');
  });

  it('does not trigger before the 20th prereg day', () => {
    const history = bulkHistory(isoSeq(15), {}, 'prereg');
    const out = evaluateAchievements({ ...baseCtx(), history, mode: 'prereg' });
    expect(out).not.toContain('monk');
  });

  it('does not re-trigger on prereg day 21', () => {
    const history = bulkHistory(isoSeq(20), {}, 'prereg');
    const out = evaluateAchievements({ ...baseCtx(), history, mode: 'prereg' });
    expect(out).not.toContain('monk');
  });
});

// --- Well, Actually ----------------------------------------------------------

describe('well_actually — correct "noise" call on a day you published', () => {
  it('triggers when published + call noise + correct', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), call: 'noise', callCorrect: true, stamp: 'RETRACTED' });
    expect(out).toContain('well_actually');
  });

  it('does not trigger on a correct "real" call', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), call: 'real', callCorrect: true, stamp: 'REPLICATED' });
    expect(out).not.toContain('well_actually');
  });

  it('does not trigger when the noise call was wrong', () => {
    const out = evaluateAchievements({ ...baseCtx(), published: spec(), call: 'noise', callCorrect: false, stamp: 'REPLICATED' });
    expect(out).not.toContain('well_actually');
  });
});

// --- True Detective ----------------------------------------------------------

describe('true_detective — 10 consecutive correct calls', () => {
  it('triggers on the 10th consecutive correct call', () => {
    const history = bulkHistory(isoSeq(9), { callCorrect: true });
    const out = evaluateAchievements({ ...baseCtx(), history, callCorrect: true });
    expect(out).toContain('true_detective');
  });

  it('does not trigger on the 9th consecutive correct call', () => {
    const history = bulkHistory(isoSeq(8), { callCorrect: true });
    const out = evaluateAchievements({ ...baseCtx(), history, callCorrect: true });
    expect(out).not.toContain('true_detective');
  });

  it('a broken streak resets the count — an intervening wrong call blocks the trigger', () => {
    const history: ModeHistory = bulkHistory(isoSeq(9), { callCorrect: true });
    history['2026-01-09'] = { hack: day({ callCorrect: false }) }; // most recent prior call was wrong
    const out = evaluateAchievements({ ...baseCtx(), history, callCorrect: true });
    expect(out).not.toContain('true_detective');
  });

  it('does not re-trigger once the streak has already passed 10', () => {
    const history = bulkHistory(isoSeq(10), { callCorrect: true });
    const out = evaluateAchievements({ ...baseCtx(), history, callCorrect: true });
    expect(out).not.toContain('true_detective');
  });

  it('does not trigger when today\'s call is wrong', () => {
    const history = bulkHistory(isoSeq(9), { callCorrect: true });
    const out = evaluateAchievements({ ...baseCtx(), history, callCorrect: false });
    expect(out).not.toContain('true_detective');
  });
});

// --- multiple achievements in one call ----------------------------------------

describe('multiple simultaneous achievements', () => {
  it('a first publish that is also a HARK returns both ids', () => {
    const log: PlayerAction[] = [
      view(spec({ outcome: 0 }), false, 0),
      view(spec({ outcome: 1 }), true, 1),
      view(spec({ outcome: 2 }), true, 2),
      view(spec({ outcome: 3 }), true, 3),
    ];
    const out = evaluateAchievements({ ...baseCtx(), log, published: spec({ outcome: 3 }), stamp: 'RETRACTED', history: {} });
    expect(out).toEqual(expect.arrayContaining(['first_blood', 'first_retraction', 'harking']));
  });
});
