// Master spec §5.6 — versioned localStorage persistence, single key
// `phackle.v1`. Extends (does not contradict) the master spec in two ways,
// both flagged in the T13 report:
//   1. `history` is keyed per-mode (`Partial<Record<'hack'|'prereg', DayRecord>>`
//      per date), not the literal `Record<IsoDate, DayRecord>` — one play per
//      mode per day means the same date can hold both a hack and a prereg
//      record.
//   2. `achievements` is `Partial<Record<AchievementId, IsoDate>>` (not every
//      id is unlocked from day one), matching the same "not every key is
//      always present" shape as (1).
import type { AchievementId } from '../content/types';
import type { DayRecord, Locale } from '../engine/types';
import { SCORING } from './tuning';

export type ModeRecord = Partial<Record<'hack' | 'prereg', DayRecord>>;
/** Same shape as achievements.ts's own ModeHistory (defined independently
 * there — no import between the two files — but the shapes must and do
 * match; both mirror this module's PersistedState['history']). */
export type ModeHistory = Record<string, ModeRecord>;

export interface PersistedStats {
  streak: number;
  maxStreak: number;
  callsCorrect: number;
  callsTotal: number;
  careerPoints: number;
  preregDays: number;
  hackDays: number;
  forkHistogram: number[];
}

export interface PersistedSettings {
  reducedMotion?: boolean;
  theme?: 'paper' | 'dark';
  locale?: Locale;
  /** SCHEMA EXTENSION (T31), on the same footing as `locale` above: master
   * spec §5.6 names `{ reducedMotion?, theme? }` for this object, and each
   * later addition extends rather than contradicts it. `introSeen` records
   * that the player has dismissed the Lab's first-run "How to play" panel, so
   * it is shown exactly once per browser and never again. Absent means
   * not-yet-dismissed, which is the correct default for a fresh install AND
   * for a state written before this field existed — no migration needed. */
  introSeen?: boolean;
}

export interface PersistedState {
  version: 1;
  history: ModeHistory;
  stats: PersistedStats;
  achievements: Partial<Record<AchievementId, string>>;
  settings: PersistedSettings;
}

const KEY = 'phackle.v1';
// T4/T5's interim key (flagged at the time): {locale, theme} only. Folded
// into `settings` on first load, then removed — see loadFromLocalStorage.
const LEGACY_SETTINGS_KEY = 'phackle.settings';

function freshState(): PersistedState {
  return {
    version: 1,
    history: {},
    stats: {
      streak: 0,
      maxStreak: 0,
      callsCorrect: 0,
      callsTotal: 0,
      careerPoints: 0,
      preregDays: 0,
      hackDays: 0,
      forkHistogram: [],
    },
    achievements: {},
    settings: {},
  };
}

// --- localStorage access, with a single failure channel --------------------
//
// Every localStorage call in this module goes through safeGet/safeSet/
// safeRemove, which convert a THROW (quota exceeded, storage disabled,
// private-browsing lockout, ...) into a StorageUnavailable exception. Exactly
// one try/catch per public entry point (see withStorage) converts that into
// the in-memory fallback + storageOff=true. This keeps the "what if
// localStorage itself is unusable" concern in one place, separate from "what
// if the DATA in it is corrupt" (handled entirely differently — see
// loadFromLocalStorage — corruption is not unavailability).

class StorageUnavailable extends Error {}

let storageOff = false;
let memoryState: PersistedState | null = null;

export function isStorageOff(): boolean {
  return storageOff;
}

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeGet(key: string): string | null {
  try {
    return hasWindow() ? window.localStorage.getItem(key) : null;
  } catch {
    throw new StorageUnavailable();
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (hasWindow()) window.localStorage.setItem(key, value);
  } catch {
    throw new StorageUnavailable();
  }
}

function safeRemove(key: string): void {
  try {
    if (hasWindow()) window.localStorage.removeItem(key);
  } catch {
    throw new StorageUnavailable();
  }
}

/** Runs `fn` against real localStorage; on a StorageUnavailable throw (from
 * any safeGet/safeSet/safeRemove inside it), flips to the in-memory fallback
 * for the rest of the session and runs `fallback` instead. Once storageOff is
 * already true, `fn` (which would only fail again) is skipped entirely. */
function withStorage<T>(fn: () => T, fallback: () => T): T {
  if (storageOff) return fallback();
  try {
    return fn();
  } catch (err) {
    if (err instanceof StorageUnavailable) {
      storageOff = true;
      return fallback();
    }
    throw err;
  }
}

function isPersistedSettings(value: unknown): value is PersistedSettings {
  return typeof value === 'object' && value !== null;
}

function pickValidSettings(value: unknown): PersistedSettings {
  if (!isPersistedSettings(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: PersistedSettings = {};
  if (raw.locale === 'en' || raw.locale === 'it' || raw.locale === 'es') out.locale = raw.locale;
  if (raw.theme === 'paper' || raw.theme === 'dark') out.theme = raw.theme;
  if (typeof raw.reducedMotion === 'boolean') out.reducedMotion = raw.reducedMotion;
  if (typeof raw.introSeen === 'boolean') out.introSeen = raw.introSeen;
  return out;
}

function isValidV1(data: unknown): data is PersistedState {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.version === 1 &&
    typeof d.history === 'object' &&
    d.history !== null &&
    typeof d.stats === 'object' &&
    d.stats !== null &&
    typeof d.achievements === 'object' &&
    d.achievements !== null &&
    typeof d.settings === 'object' &&
    d.settings !== null
  );
}

/**
 * v1 -> v1 identity (defensively re-validated — a version tag lying about
 * its own shape is treated as corrupt); any other version -> fresh. This is
 * intentionally a stub: v1 is the only version that has ever existed, so
 * there is nothing to migrate FROM yet ("Migration function stub from day
 * one... because there will be a v2" — master spec §5.6).
 */
export function migrate(version: number, data: unknown): PersistedState {
  if (version === 1 && isValidV1(data)) return data;
  return freshState();
}

function loadFromLocalStorage(): PersistedState {
  const rawV1 = safeGet(KEY);
  if (rawV1 !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawV1);
    } catch {
      // Corrupted JSON -> fresh state, but this is a DATA problem, not a
      // storage-mechanism problem: storageOff must stay false.
      const fresh = freshState();
      safeSet(KEY, JSON.stringify(fresh));
      return fresh;
    }
    const versionField = (parsed as { version?: unknown } | null)?.version;
    const version = typeof versionField === 'number' ? versionField : -1;
    return migrate(version, parsed);
  }

  // No v1 record yet: fold the interim phackle.settings key in, if present
  // (ruling amending the brief — see the module doc comment), then remove it.
  const rawLegacy = safeGet(LEGACY_SETTINGS_KEY);
  let state = freshState();
  if (rawLegacy !== null) {
    try {
      state = { ...state, settings: pickValidSettings(JSON.parse(rawLegacy)) };
    } catch {
      // Legacy blob unreadable — nothing to fold in; proceed with fresh settings.
    }
  }
  safeSet(KEY, JSON.stringify(state));
  if (rawLegacy !== null) safeRemove(LEGACY_SETTINGS_KEY);
  return state;
}

/**
 * Loads the persisted state, falling back to an in-memory session if
 * localStorage throws (quota exceeded, disabled, private-browsing lockout).
 * Corrupted JSON is a different failure class entirely — handled inside
 * loadFromLocalStorage — and does NOT set storageOff.
 */
export function loadState(): PersistedState {
  return withStorage(loadFromLocalStorage, () => (memoryState ??= freshState()));
}

function persistState(next: PersistedState): void {
  withStorage(
    () => safeSet(KEY, JSON.stringify(next)),
    () => {
      memoryState = next;
    }
  );
}

/** Merges a settings patch into the persisted settings object. This is the
 * helper src/i18n/LocaleProvider.tsx's write-side persistence functions
 * delegate to (see that file and the T13 report). */
export function saveSettings(patch: Partial<PersistedSettings>): void {
  const state = loadState();
  persistState({ ...state, settings: { ...state.settings, ...patch } });
}

function incrementHistogram(hist: number[], forks: number): number[] {
  const next = hist.slice();
  while (next.length <= forks) next.push(0);
  next[forks] += 1;
  return next;
}

// --- streaks -----------------------------------------------------------------

/** Bare ISO-string arithmetic: `iso` is parsed as UTC midnight (bare
 * `YYYY-MM-DD` per ECMA-262), stepped back exactly one calendar day in UTC,
 * and re-formatted — immune to DST (UTC has none) and to the local
 * timezone. This is calendar math on an already-known date string, distinct
 * from daily.ts's localIsoDate (which reads the real wall clock in the
 * player's OWN local timezone to decide "what date is today"). */
function previousIsoDate(iso: string): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function playedOn(history: ModeHistory, iso: string): boolean {
  const day = history[iso];
  return day !== undefined && (day.hack !== undefined || day.prereg !== undefined);
}

/**
 * Master spec §5.6 stats.streak/maxStreak, per the controller ruling:
 * consecutive LOCAL dates, any mode counts as "played" that day, a gap
 * resets the current streak, and maxStreak is retained (a longer PAST run
 * stays remembered even after a later gap) — computed fresh from the full
 * history every call, so "retention" simply falls out of the days still
 * being there, rather than needing a separate running accumulator.
 */
export function streakAfter(history: ModeHistory, iso: string): { streak: number; maxStreak: number } {
  let streak = 0;
  let cursor = iso;
  while (playedOn(history, cursor)) {
    streak++;
    cursor = previousIsoDate(cursor);
  }

  const playedDates = Object.keys(history)
    .filter((d) => playedOn(history, d))
    .sort();
  let longest = 0;
  let run = 0;
  let prevDate: string | null = null;
  for (const d of playedDates) {
    run = prevDate !== null && previousIsoDate(d) === prevDate ? run + 1 : 1;
    longest = Math.max(longest, run);
    prevDate = d;
  }

  return { streak, maxStreak: Math.max(longest, streak) };
}

// --- saveDay -------------------------------------------------------------

/**
 * Persists today's DayRecord under its own mode's sub-key (§5.6 extension:
 * one play per mode per day), and folds it into the running stats: call
 * accuracy, the fork histogram, per-mode day counts, career points (+25,
 * mirroring SCORING.publishedCareer, whenever a hack-mode day was actually
 * published rather than abandoned — a stamp of anything but NULL_REPORTED),
 * and the streak (recomputed via streakAfter over the updated history).
 */
export function saveDay(iso: string, rec: DayRecord): void {
  const state = loadState();

  const history: ModeHistory = { ...state.history, [iso]: { ...state.history[iso], [rec.mode]: rec } };
  const { streak, maxStreak } = streakAfter(history, iso);

  const earnedCareer = rec.mode === 'hack' && rec.stamp !== 'NULL_REPORTED' ? SCORING.publishedCareer : 0;
  const stats: PersistedStats = {
    streak,
    maxStreak,
    callsTotal: state.stats.callsTotal + (rec.callCorrect !== undefined ? 1 : 0),
    callsCorrect: state.stats.callsCorrect + (rec.callCorrect === true ? 1 : 0),
    careerPoints: state.stats.careerPoints + earnedCareer,
    preregDays: state.stats.preregDays + (rec.mode === 'prereg' ? 1 : 0),
    hackDays: state.stats.hackDays + (rec.mode === 'hack' ? 1 : 0),
    forkHistogram: incrementHistogram(state.stats.forkHistogram, rec.forks),
  };

  persistState({ ...state, history, stats });
}

export function loadStats(): PersistedState['stats'] {
  return loadState().stats;
}
