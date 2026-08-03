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
