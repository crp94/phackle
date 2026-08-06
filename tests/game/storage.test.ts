// @vitest-environment jsdom
//
// Master spec §5.6 — versioned localStorage persistence. jsdom pragma because
// this module touches window.localStorage. Each test gets an ISOLATED module
// instance (vi.resetModules() + dynamic import) since storage.ts intentionally
// keeps module-level state (the in-memory fallback + its storageOff flag,
// mirroring a real browser session) — without this, one test's throwing-mock
// scenario would leak into the next test's assertions.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { DayRecord } from '../../src/engine/types';
// Type-only import: fully erased at compile time, so it does not instantiate
// the module and cannot defeat the vi.resetModules() isolation below.
import type { ModeHistory } from '../../src/game/storage';

async function freshStorage() {
  vi.resetModules();
  return import('../../src/game/storage');
}

function day(overrides: Partial<DayRecord> = {}): DayRecord {
  return { mode: 'hack', score: 100, forks: 2, stamp: 'RETRACTED', shareString: 'x', ...overrides };
}

let originalLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
  window.localStorage.clear();
});

afterEach(() => {
  if (originalLocalStorage) Object.defineProperty(window, 'localStorage', originalLocalStorage);
});

function installThrowingLocalStorage() {
  const boom = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  const throwing: Storage = {
    getItem: boom,
    setItem: boom,
    removeItem: boom,
    clear: boom,
    key: () => null,
    length: 0,
  };
  Object.defineProperty(window, 'localStorage', { value: throwing, configurable: true });
}

// --- round trip ---------------------------------------------------------------

describe('loadState / saveDay — round trip', () => {
  it('a fresh session has version 1 and empty history/achievements', async () => {
    const { loadState } = await freshStorage();
    const state = loadState();
    expect(state.version).toBe(1);
    expect(state.history).toEqual({});
    expect(state.achievements).toEqual({});
  });

  it('saveDay persists under the given mode, readable back via loadState', async () => {
    const { loadState, saveDay } = await freshStorage();
    saveDay('2026-08-01', day({ mode: 'hack', score: 140 }));
    const state = loadState();
    expect(state.history['2026-08-01'].hack?.score).toBe(140);
    expect(state.history['2026-08-01'].prereg).toBeUndefined();
  });

  it('hack and prereg on the SAME date coexist as separate sub-records (ruling #1)', async () => {
    const { loadState, saveDay } = await freshStorage();
    saveDay('2026-08-01', day({ mode: 'hack', score: 140 }));
    saveDay('2026-08-01', day({ mode: 'prereg', score: 150 }));
    const state = loadState();
    expect(state.history['2026-08-01'].hack?.score).toBe(140);
    expect(state.history['2026-08-01'].prereg?.score).toBe(150);
  });

  it('saveDay updates call-accuracy stats', async () => {
    const { loadState, saveDay } = await freshStorage();
    saveDay('2026-08-01', day({ callCorrect: true }));
    saveDay('2026-08-02', day({ callCorrect: false }));
    saveDay('2026-08-03', day({ callCorrect: true }));
    const stats = loadState().stats;
    expect(stats.callsTotal).toBe(3);
    expect(stats.callsCorrect).toBe(2);
  });

  it('saveDay increments hackDays/preregDays and the fork histogram', async () => {
    const { loadState, saveDay } = await freshStorage();
    saveDay('2026-08-01', day({ mode: 'hack', forks: 4 }));
    saveDay('2026-08-02', day({ mode: 'prereg', forks: 4 }));
    const stats = loadState().stats;
    expect(stats.hackDays).toBe(1);
    expect(stats.preregDays).toBe(1);
    expect(stats.forkHistogram[4]).toBe(2);
  });

  it('saveDay awards +25 career points for a published (non-abandoned) hack day only', async () => {
    const { loadState, saveDay } = await freshStorage();
    saveDay('2026-08-01', day({ mode: 'hack', stamp: 'REPLICATED' }));
    saveDay('2026-08-02', day({ mode: 'hack', stamp: 'NULL_REPORTED' })); // abandoned: no career points
    saveDay('2026-08-03', day({ mode: 'prereg', stamp: 'REPLICATED' })); // prereg: no career track
    expect(loadState().stats.careerPoints).toBe(25);
  });

  it('persists across a fresh module load (survives a "reload")', async () => {
    const first = await freshStorage();
    first.saveDay('2026-08-01', day({ score: 77 }));
    const second = await freshStorage(); // simulates a page reload: new module instance, same localStorage
    expect(second.loadState().history['2026-08-01'].hack?.score).toBe(77);
  });
});

// --- migrate --------------------------------------------------------------

describe('migrate — v1 identity + unknown version -> fresh', () => {
  it('returns v1 data unchanged (identity)', async () => {
    const { migrate } = await freshStorage();
    const v1: unknown = {
      version: 1,
      history: { '2026-08-01': { hack: day() } },
      stats: { streak: 1, maxStreak: 1, callsCorrect: 1, callsTotal: 1, careerPoints: 25, preregDays: 0, hackDays: 1, forkHistogram: [] },
      achievements: {},
      settings: {},
    };
    expect(migrate(1, v1)).toBe(v1);
  });

  it('an unknown version number produces a fresh state', async () => {
    const { migrate } = await freshStorage();
    const fresh = migrate(2, { version: 2, garbage: true });
    expect(fresh.version).toBe(1);
    expect(fresh.history).toEqual({});
  });

  it('a version-1-tagged but malformed blob also produces a fresh state', async () => {
    const { migrate } = await freshStorage();
    const fresh = migrate(1, { version: 1, history: 'not-an-object' });
    expect(fresh.history).toEqual({});
  });
});

// --- corrupted JSON -----------------------------------------------------------

describe('corrupted JSON -> fresh state, storageOff stays false (corruption != unavailability)', () => {
  it('unparseable JSON under phackle.v1 yields a fresh, usable state', async () => {
    window.localStorage.setItem('phackle.v1', '{not valid json!!');
    const { loadState, isStorageOff } = await freshStorage();
    const state = loadState();
    expect(state.version).toBe(1);
    expect(state.history).toEqual({});
    expect(isStorageOff()).toBe(false);
  });

  it('overwrites the corrupted blob with a fresh one so it does not recur', async () => {
    window.localStorage.setItem('phackle.v1', 'garbage');
    const { loadState } = await freshStorage();
    loadState();
    const raw = window.localStorage.getItem('phackle.v1');
    expect(() => JSON.parse(raw ?? '')).not.toThrow();
  });
});

// --- localStorage throwing -> memory fallback ----------------------------------

describe('localStorage throwing (quota/disabled) -> in-memory fallback', () => {
  it('loadState degrades gracefully and flags storageOff', async () => {
    installThrowingLocalStorage();
    const { loadState, isStorageOff } = await freshStorage();
    expect(() => loadState()).not.toThrow();
    expect(isStorageOff()).toBe(true);
    expect(loadState().version).toBe(1);
  });

  it('saveDay still works against the in-memory fallback (no crash, data retrievable this session)', async () => {
    installThrowingLocalStorage();
    const { loadState, saveDay, isStorageOff } = await freshStorage();
    expect(() => saveDay('2026-08-01', day({ score: 55 }))).not.toThrow();
    expect(isStorageOff()).toBe(true);
    expect(loadState().history['2026-08-01'].hack?.score).toBe(55);
  });

  it('a working localStorage never sets storageOff', async () => {
    const { loadState, isStorageOff } = await freshStorage();
    loadState();
    expect(isStorageOff()).toBe(false);
  });
});

// --- streakAfter ----------------------------------------------------------

describe('streakAfter — consecutive local dates, any mode counts, gap resets, maxStreak retained', () => {
  it('consecutive dates increment the streak', async () => {
    const { streakAfter } = await freshStorage();
    const history: ModeHistory = {
      '2026-08-01': { hack: day() },
      '2026-08-02': { hack: day() },
      '2026-08-03': { hack: day() },
    };
    expect(streakAfter(history, '2026-08-03')).toEqual({ streak: 3, maxStreak: 3 });
  });

  it('any mode counts: a prereg-only day still extends the streak', async () => {
    const { streakAfter } = await freshStorage();
    const history: ModeHistory = {
      '2026-08-01': { hack: day() },
      '2026-08-02': { prereg: day({ mode: 'prereg' }) },
    };
    expect(streakAfter(history, '2026-08-02').streak).toBe(2);
  });

  it('a gap resets the current streak but the earlier run stays as maxStreak', async () => {
    const { streakAfter } = await freshStorage();
    const history: ModeHistory = {
      '2026-08-01': { hack: day() },
      '2026-08-02': { hack: day() },
      '2026-08-03': { hack: day() },
      // gap on 08-04
      '2026-08-05': { hack: day() },
    };
    expect(streakAfter(history, '2026-08-05')).toEqual({ streak: 1, maxStreak: 3 });
  });

  it('an unplayed "today" reports a 0 current streak but retains maxStreak', async () => {
    const { streakAfter } = await freshStorage();
    const history: ModeHistory = {
      '2026-08-01': { hack: day() },
      '2026-08-02': { hack: day() },
    };
    expect(streakAfter(history, '2026-08-04')).toEqual({ streak: 0, maxStreak: 2 });
  });

  it('is exact across a month boundary (no off-by-one from month length)', async () => {
    const { streakAfter } = await freshStorage();
    const history: ModeHistory = {
      '2026-01-30': { hack: day() },
      '2026-01-31': { hack: day() },
      '2026-02-01': { hack: day() },
    };
    expect(streakAfter(history, '2026-02-01').streak).toBe(3);
  });

  it('saveDay wires streakAfter results into stats.streak/maxStreak', async () => {
    const { loadState, saveDay } = await freshStorage();
    saveDay('2026-08-01', day());
    saveDay('2026-08-02', day());
    let stats = loadState().stats;
    expect(stats.streak).toBe(2);
    expect(stats.maxStreak).toBe(2);
    saveDay('2026-08-10', day()); // a gap
    stats = loadState().stats;
    expect(stats.streak).toBe(1);
    expect(stats.maxStreak).toBe(2);
  });
});

// --- legacy phackle.settings fold-in (ruling #2) -------------------------------

describe('legacy phackle.settings fold-in (T4/T5 interim key)', () => {
  it('folds an existing phackle.settings blob into settings and removes the old key', async () => {
    window.localStorage.setItem('phackle.settings', JSON.stringify({ locale: 'es', theme: 'dark' }));
    const { loadState } = await freshStorage();
    const state = loadState();
    expect(state.settings.locale).toBe('es');
    expect(state.settings.theme).toBe('dark');
    expect(window.localStorage.getItem('phackle.settings')).toBeNull();
    expect(window.localStorage.getItem('phackle.v1')).not.toBeNull();
  });

  it('does not fold in the legacy key once phackle.v1 already exists', async () => {
    const first = await freshStorage();
    first.saveDay('2026-08-01', day());
    // A legacy blob shows up later (e.g. stale tab) — must not overwrite the
    // already-migrated v1 state.
    window.localStorage.setItem('phackle.settings', JSON.stringify({ locale: 'it' }));
    const second = await freshStorage();
    const state = second.loadState();
    expect(state.settings.locale).toBeUndefined();
    expect(state.history['2026-08-01']).toBeDefined();
  });

  it('an unparseable legacy blob is ignored, not fatal', async () => {
    window.localStorage.setItem('phackle.settings', 'not json');
    const { loadState } = await freshStorage();
    expect(() => loadState()).not.toThrow();
    expect(loadState().settings).toEqual({});
  });
});

// --- saveSettings / isStorageOff (small helpers added for LocaleProvider delegation) --

describe('saveSettings — the write-side helper LocaleProvider delegates to', () => {
  it('persists a settings patch and preserves other fields already there', async () => {
    const { loadState, saveSettings } = await freshStorage();
    saveSettings({ locale: 'it' });
    saveSettings({ theme: 'dark' });
    const settings = loadState().settings;
    expect(settings.locale).toBe('it');
    expect(settings.theme).toBe('dark');
  });
});

// --- saveAchievements (T30) — merge-only, first date wins ------------------

describe('saveAchievements — merge-only: existing unlock dates are never overwritten', () => {
  it('sets the unlock date for a newly-unlocked id', async () => {
    const { loadState, saveAchievements } = await freshStorage();
    saveAchievements(['first_retraction'], '2026-08-10');
    expect(loadState().achievements.first_retraction).toBe('2026-08-10');
  });

  it('never overwrites an existing unlock date — first date wins', async () => {
    const { loadState, saveAchievements } = await freshStorage();
    saveAchievements(['first_retraction'], '2026-08-10');
    saveAchievements(['first_retraction'], '2026-08-11'); // re-supplied on a later day
    expect(loadState().achievements.first_retraction).toBe('2026-08-10');
  });

  it('merges multiple ids in one call without disturbing already-set ones', async () => {
    const { loadState, saveAchievements } = await freshStorage();
    saveAchievements(['first_blood'], '2026-08-01');
    saveAchievements(['first_retraction', 'harking'], '2026-08-10');
    const achievements = loadState().achievements;
    expect(achievements.first_blood).toBe('2026-08-01');
    expect(achievements.first_retraction).toBe('2026-08-10');
    expect(achievements.harking).toBe('2026-08-10');
  });

  it('a no-op call (empty ids) leaves existing achievements untouched', async () => {
    const { loadState, saveAchievements } = await freshStorage();
    saveAchievements(['first_blood'], '2026-08-01');
    saveAchievements([], '2026-08-02');
    expect(loadState().achievements).toEqual({ first_blood: '2026-08-01' });
  });

  it('persists across a fresh module load, same as saveDay', async () => {
    const first = await freshStorage();
    first.saveAchievements(['monk'], '2026-08-05');
    const second = await freshStorage();
    expect(second.loadState().achievements.monk).toBe('2026-08-05');
  });

  it('still works against the in-memory fallback when localStorage throws', async () => {
    installThrowingLocalStorage();
    const { loadState, saveAchievements, isStorageOff } = await freshStorage();
    expect(() => saveAchievements(['first_retraction'], '2026-08-10')).not.toThrow();
    expect(isStorageOff()).toBe(true);
    expect(loadState().achievements.first_retraction).toBe('2026-08-10');
  });
});

// --- gr6-044: a v1 tag is not a promise about the SHAPE underneath ----------
//
// The defect (final-002): `isValidV1` only checked that `stats` was an
// object, so `{version: 1, ..., stats: {}}` passed straight through as a
// PersistedState. Every counter in it is then `undefined`, and `saveDay`'s
// arithmetic (`state.stats.callsTotal + 1`) turns the whole block into NaN —
// or, for `forkHistogram`, throws outright on `.slice()`. The Stats wall then
// renders NaN forever, and no later day can repair it.
describe('gr6-044 — a version-1-tagged blob with unusable stats is repaired, never trusted', () => {
  const CORRUPT = {
    version: 1,
    history: { '2026-08-01': { hack: day() } },
    stats: {},
    achievements: { first_blood: '2026-08-01' },
    settings: { theme: 'dark' },
  };

  it('does not accept a v1 blob whose stats object is empty', async () => {
    const { migrate } = await freshStorage();
    const out = migrate(1, CORRUPT);
    // Not the identity path (that is reserved for a blob that really IS a
    // PersistedState — see the "returns v1 data unchanged" test above).
    expect(out).not.toBe(CORRUPT);
    expect(out.stats).toEqual({
      streak: 0,
      maxStreak: 0,
      callsCorrect: 0,
      callsTotal: 0,
      careerPoints: 0,
      preregDays: 0,
      hackDays: 0,
      forkHistogram: [],
    });
  });

  it('keeps the parts of the blob that WERE sound (history/achievements/settings survive the repair)', async () => {
    const { migrate } = await freshStorage();
    const out = migrate(1, CORRUPT);
    expect(out.history).toEqual(CORRUPT.history);
    expect(out.achievements).toEqual(CORRUPT.achievements);
    expect(out.settings).toEqual(CORRUPT.settings);
  });

  it.each([
    ['a string counter', { ...freshStats(), callsTotal: '3' }],
    ['a NaN counter', { ...freshStats(), careerPoints: Number.NaN }],
    ['an Infinity counter', { ...freshStats(), streak: Number.POSITIVE_INFINITY }],
    ['a null counter', { ...freshStats(), hackDays: null }],
    ['a missing counter', (() => { const s: Record<string, unknown> = { ...freshStats() }; delete s.preregDays; return s; })()],
    ['a non-array histogram', { ...freshStats(), forkHistogram: 3 }],
    ['a histogram holding a non-number', { ...freshStats(), forkHistogram: [1, 'two', 3] }],
  ])('replaces %s with the fresh default rather than persisting it', async (_label, stats) => {
    const { migrate } = await freshStorage();
    const out = migrate(1, { version: 1, history: {}, stats, achievements: {}, settings: {} });
    for (const value of Object.values(out.stats)) {
      if (Array.isArray(value)) expect(value.every((n) => Number.isFinite(n))).toBe(true);
      else expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('keeps every individually-sound counter while repairing only the broken one', async () => {
    const { migrate } = await freshStorage();
    const out = migrate(1, {
      version: 1,
      history: {},
      stats: { ...freshStats(), streak: 4, maxStreak: 9, forkHistogram: 'nope' },
      achievements: {},
      settings: {},
    });
    expect(out.stats.streak).toBe(4);
    expect(out.stats.maxStreak).toBe(9);
    expect(out.stats.forkHistogram).toEqual([]);
  });

  it('saveDay over a corrupt-stats blob yields finite counters, not NaN and not a throw', async () => {
    window.localStorage.setItem(
      'phackle.v1',
      JSON.stringify({ version: 1, history: {}, stats: {}, achievements: {}, settings: {} })
    );
    const { loadState, saveDay } = await freshStorage();

    expect(() => saveDay('2026-08-10', day({ callCorrect: true }))).not.toThrow();

    const stats = loadState().stats;
    expect(stats.hackDays).toBe(1);
    expect(stats.callsTotal).toBe(1);
    expect(stats.callsCorrect).toBe(1);
    expect(stats.careerPoints).toBe(25); // RETRACTED hack day earns the +25 track
    expect(stats.streak).toBe(1);
    expect(stats.forkHistogram).toEqual([0, 0, 1]);
    for (const value of Object.values(stats)) {
      if (Array.isArray(value)) expect(value.every((n) => Number.isFinite(n))).toBe(true);
      else expect(Number.isFinite(value)).toBe(true);
    }
  });
});

function freshStats() {
  return {
    streak: 0,
    maxStreak: 0,
    callsCorrect: 0,
    callsTotal: 0,
    careerPoints: 0,
    preregDays: 0,
    hackDays: 0,
    forkHistogram: [] as number[],
  };
}
