// T30 — wiring evaluateAchievements (T13) into day completion. Pure logic,
// plain node env, same convention as tests/game/achievements.test.ts.
//
// Two things under test:
//  - computeDecisiveTails: the "One-Tailed Bandit" (§2.11) truth table —
//    published one-tailed, p < .05 (an invariant of store.submit() itself —
//    see the doc comment on computeDecisiveTails for why this function does
//    not re-derive that p independently), and the SAME spec (every other
//    knob identical) but two-tailed was actually seen today with p >= .05.
//  - unlockAchievements: assembles the AchievementCtx evaluateAchievements
//    needs from raw log/resultLog/history — `published` is derived from the
//    log's own SUBMIT entry (never a separately-passed flag that could drift
//    out of sync with it).
import { describe, expect, it } from 'vitest';
import { computeDecisiveTails, unlockAchievements, type DayCompleteInput } from '../../src/game/dayComplete';
import { specKey } from '../../src/engine/specGrid';
import type { ModeHistory } from '../../src/game/achievements';
import type { ResultLogEntry } from '../../src/game/store';
import type { PlayerAction, Spec } from '../../src/engine/types';

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

function resultEntry(overrides: Partial<ResultLogEntry> = {}): ResultLogEntry {
  return { key: specKey(baseSpec), p: 0.2, valid: true, ...overrides };
}

function view(s: Spec, seen: boolean, at = 0): PlayerAction {
  return { t: 'VIEW_SPEC', spec: s, seen, at };
}

function submitAction(s: Spec, p: number, at = 1): PlayerAction {
  return { t: 'SUBMIT', spec: s, p, at };
}

function day(overrides: Partial<import('../../src/engine/types').DayRecord> = {}): import('../../src/engine/types').DayRecord {
  return { mode: 'hack', score: 100, forks: 0, stamp: 'RETRACTED', shareString: '', ...overrides };
}

function baseInput(overrides: Partial<DayCompleteInput> = {}): DayCompleteInput {
  return {
    log: [view(baseSpec, false)],
    resultLog: [],
    history: {},
    call: null,
    callCorrect: null,
    mode: 'hack',
    stamp: 'CONFIRMED_NULL',
    ...overrides,
  };
}

// --- computeDecisiveTails -----------------------------------------------------

describe('computeDecisiveTails — the One-Tailed Bandit truth table', () => {
  it('false when nothing was published', () => {
    expect(computeDecisiveTails([], null)).toBe(false);
  });

  it('false when the published spec is two-tailed, however resultLog looks', () => {
    const published = spec({ tails: 'two' });
    const resultLog = [resultEntry({ key: specKey(spec({ tails: 'two' })), p: 0.2, valid: true })];
    expect(computeDecisiveTails(resultLog, published)).toBe(false);
  });

  it('false when published is one-tailed but the two-tailed sibling was never seen (no-sibling case)', () => {
    const published = spec({ tails: 'one' });
    expect(computeDecisiveTails([], published)).toBe(false);
  });

  it('false when resultLog has entries, but none for the matching sibling spec', () => {
    const published = spec({ tails: 'one', subgroup: 'urban' });
    // A totally unrelated spec (different outcome/subgroup/exclusion), still
    // two-tailed and non-significant — must not be confused for THE sibling.
    const unrelated = [resultEntry({ key: specKey(spec({ outcome: 3, subgroup: 'rural', exclusion: 'z2', tails: 'two' })), p: 0.9, valid: true })];
    expect(computeDecisiveTails(unrelated, published)).toBe(false);
  });

  it('true when the two-tailed sibling was seen non-significant (p >= .05)', () => {
    const published = spec({ tails: 'one' });
    const siblingKey = specKey({ ...published, tails: 'two' });
    const resultLog = [resultEntry({ key: siblingKey, p: 0.2, valid: true })];
    expect(computeDecisiveTails(resultLog, published)).toBe(true);
  });

  it('true at the exact p = .05 boundary (>= , not >)', () => {
    const published = spec({ tails: 'one' });
    const siblingKey = specKey({ ...published, tails: 'two' });
    const resultLog = [resultEntry({ key: siblingKey, p: 0.05, valid: true })];
    expect(computeDecisiveTails(resultLog, published)).toBe(true);
  });

  it('false when the two-tailed sibling was ALSO significant (p < .05) — flipping tails was not decisive', () => {
    const published = spec({ tails: 'one' });
    const siblingKey = specKey({ ...published, tails: 'two' });
    const resultLog = [resultEntry({ key: siblingKey, p: 0.01, valid: true })];
    expect(computeDecisiveTails(resultLog, published)).toBe(false);
  });

  it('false when the matching-key entry is not valid (n<30 after exclusions — its p is not meaningful)', () => {
    const published = spec({ tails: 'one' });
    const siblingKey = specKey({ ...published, tails: 'two' });
    const resultLog = [resultEntry({ key: siblingKey, p: 0.9, valid: false })];
    expect(computeDecisiveTails(resultLog, published)).toBe(false);
  });

  it('true regardless of which N the sibling was viewed at — resultLog keys carry no N at all', () => {
    const published = spec({ tails: 'one', subgroup: 'urban' });
    const siblingKey = specKey({ ...published, tails: 'two' });
    // Two sightings of the same spec-shape sibling (e.g. once before a peek,
    // once after) — ResultLogEntry has no N field, so either is sufficient.
    const resultLog = [resultEntry({ key: siblingKey, p: 0.4, valid: true }), resultEntry({ key: siblingKey, p: 0.06, valid: true })];
    expect(computeDecisiveTails(resultLog, published)).toBe(true);
  });

  it('matches the sibling on EVERY other knob, not just tails', () => {
    const published = spec({ tails: 'one', exclusion: 'z2', subgroup: 'urban' });
    const wrongSibling = resultEntry({ key: specKey(spec({ tails: 'two', exclusion: 'none', subgroup: 'urban' })), p: 0.9, valid: true });
    const rightSibling = resultEntry({ key: specKey({ ...published, tails: 'two' }), p: 0.2, valid: true });
    expect(computeDecisiveTails([wrongSibling], published)).toBe(false);
    expect(computeDecisiveTails([wrongSibling, rightSibling], published)).toBe(true);
  });
});

// --- unlockAchievements — ctx assembly ----------------------------------------

describe('unlockAchievements — assembles AchievementCtx from log/resultLog/history and wraps evaluateAchievements', () => {
  it("derives `published` from the log's own SUBMIT entry — outlier_surgeon fires from the submitted spec's exclusion", () => {
    const published = spec({ exclusion: 'z2' });
    const log: PlayerAction[] = [view(baseSpec, false), submitAction(published, 0.01)];
    const out = unlockAchievements(baseInput({ log, stamp: 'RETRACTED' }));
    expect(out).toContain('outlier_surgeon');
  });

  it('no SUBMIT anywhere in the log means published stays null — publish-gated achievements never fire', () => {
    const log: PlayerAction[] = [view(baseSpec, false), { t: 'ABANDON', at: 1 }];
    const out = unlockAchievements(baseInput({ log, stamp: 'CONFIRMED_NULL' }));
    expect(out).not.toContain('first_blood');
    expect(out).not.toContain('outlier_surgeon');
    expect(out).not.toContain('one_tailed_bandit');
  });

  it('wires decisiveTails through to one_tailed_bandit, end-to-end from a real SUBMIT + resultLog pair', () => {
    const published = spec({ tails: 'one' });
    const siblingKey = specKey({ ...published, tails: 'two' });
    const log: PlayerAction[] = [view(baseSpec, false), submitAction(published, 0.01)];
    const resultLog: ResultLogEntry[] = [{ key: siblingKey, p: 0.3, valid: true }];
    const out = unlockAchievements(baseInput({ log, resultLog, stamp: 'RETRACTED' }));
    expect(out).toContain('one_tailed_bandit');
  });

  it('does not unlock one_tailed_bandit when the two-tailed sibling was never seen', () => {
    const published = spec({ tails: 'one' });
    const log: PlayerAction[] = [view(baseSpec, false), submitAction(published, 0.01)];
    const out = unlockAchievements(baseInput({ log, resultLog: [], stamp: 'RETRACTED' }));
    expect(out).not.toContain('one_tailed_bandit');
  });

  it('passes `history` through unchanged — a prior RETRACTED day blocks first_retraction from re-firing', () => {
    const history: ModeHistory = { '2026-08-01': { hack: day({ stamp: 'RETRACTED' }) } };
    const log: PlayerAction[] = [view(baseSpec, false), submitAction(baseSpec, 0.01)];
    const out = unlockAchievements(baseInput({ log, history, stamp: 'RETRACTED' }));
    expect(out).not.toContain('first_retraction');
  });

  it('a first-ever RETRACTED day (empty history) DOES unlock first_retraction', () => {
    const log: PlayerAction[] = [view(baseSpec, false), submitAction(baseSpec, 0.01)];
    const out = unlockAchievements(baseInput({ log, history: {}, stamp: 'RETRACTED' }));
    expect(out).toContain('first_retraction');
  });

  it('passes mode/call/callCorrect through — well_actually fires on a correct "noise" call on a published day', () => {
    const log: PlayerAction[] = [view(baseSpec, false), submitAction(baseSpec, 0.01)];
    const out = unlockAchievements(baseInput({ log, call: 'noise', callCorrect: true, stamp: 'RETRACTED' }));
    expect(out).toContain('well_actually');
  });

  it('a first-ever publish that is ALSO a decisive one-tailed flip returns both ids', () => {
    const published = spec({ tails: 'one' });
    const siblingKey = specKey({ ...published, tails: 'two' });
    const log: PlayerAction[] = [view(baseSpec, false), submitAction(published, 0.01)];
    const resultLog: ResultLogEntry[] = [{ key: siblingKey, p: 0.3, valid: true }];
    const out = unlockAchievements(baseInput({ log, resultLog, history: {}, stamp: 'REPLICATED' }));
    expect(out).toEqual(expect.arrayContaining(['first_blood', 'one_tailed_bandit']));
  });
});
