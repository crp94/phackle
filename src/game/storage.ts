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
import { isPublishedStamp } from './verdict';

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

/** The CONTAINER check: every top-level field is present and of the right
 * broad kind. Necessary but — as gr6-044 (final-002) found the hard way —
 * nowhere near sufficient for `stats`, whose fields are arithmetic operands.
 * Kept as its own predicate because `migrate` below distinguishes the two
 * failure modes: a wrong-shaped container is unusable, a wrong-shaped
 * `stats` block inside an otherwise sound container is repairable. */
function isV1Container(data: unknown): data is Record<string, unknown> {
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

/** The seven scalar counters of PersistedStats, listed once so the numeric
 * validation below and `freshState()`'s own literal cannot drift apart —
 * `satisfies` makes a future field addition a compile error here rather than
 * a silently-unvalidated counter. */
const STATS_COUNTERS = [
  'streak',
  'maxStreak',
  'callsCorrect',
  'callsTotal',
  'careerPoints',
  'preregDays',
  'hackDays',
] as const satisfies readonly (keyof PersistedStats)[];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** One persisted day-record, as much of it as can be trusted. The blob being
 * repaired is by definition one whose shape has already lied once, so every
 * field is re-checked rather than assumed — `history` itself was only ever
 * validated as "is an object". */
function readRecord(value: unknown): { mode: 'hack' | 'prereg'; forks: number; callCorrect?: boolean; published: boolean } | null {
  if (typeof value !== 'object' || value === null) return null;
  const rec = value as Record<string, unknown>;
  if (rec.mode !== 'hack' && rec.mode !== 'prereg') return null;
  if (!isFiniteNumber(rec.forks) || rec.forks < 0 || !Number.isInteger(rec.forks)) return null;
  return {
    mode: rec.mode,
    forks: rec.forks,
    callCorrect: typeof rec.callCorrect === 'boolean' ? rec.callCorrect : undefined,
    // `saveDay`'s own career rule: a hack day that ended in a standing claim
    // was published. Read through the same predicate `saveDay` uses, over a
    // value this function has deliberately NOT narrowed (`history` was only
    // ever validated as "is an object", and this is the repair path) — an
    // unrecognised or absent stamp reads as unpublished, which is the
    // fail-safe direction for a career-points total.
    published: typeof rec.stamp === 'string' && isPublishedStamp(rec.stamp as DayRecord['stamp']),
  };
}

/**
 * w6-r-010 — RE-DERIVE, DO NOT ZERO.
 *
 * `history` already carries, per day and per mode, precisely the four things
 * `saveDay` increments from: `mode`, `callCorrect`, `stamp` and `forks`. So a
 * counter that cannot be trusted does not have to become 0 — it can be
 * recomputed from the record it was only ever a running total OF. Every line
 * below mirrors `saveDay`'s own arithmetic exactly (there is a test that plays
 * the same days through the real `saveDay` and asserts the two blocks are
 * equal, which is what keeps the mirror honest).
 *
 * Total over garbage by construction: a malformed day, or a malformed record
 * inside a sound day, contributes nothing rather than throwing — see
 * `readRecord`.
 *
 * `streak` is the one field that cannot be fully re-derived, because "the
 * current streak" depends on what day it is TODAY and this module deliberately
 * holds no wall clock (`loadState` runs on every render; a date read here
 * would be a new source of drift). It is rebuilt as the run ENDING ON THE LAST
 * PLAYED DAY — a true statement about the history, and one the very next
 * `saveDay` recomputes from scratch anyway. `maxStreak` needs no such caveat:
 * `streakAfter` derives it from the whole history independently.
 */
function rebuildStatsFromHistory(history: unknown): PersistedStats {
  const out = freshState().stats;
  if (typeof history !== 'object' || history === null) return out;
  const days = history as Record<string, unknown>;

  // Built as we go, holding ONLY the records that survived validation, so the
  // streak math below runs over something whose shape is known. `streakAfter`
  // reads `day.hack`/`day.prereg` directly and is not total over a junk
  // history (a literal `null` day throws); handing it a sanitised copy reuses
  // the real calendar logic instead of restating it here.
  const sanitised: ModeHistory = {};
  let lastPlayedIso: string | null = null;

  for (const iso of Object.keys(days).sort()) {
    const day = days[iso];
    if (typeof day !== 'object' || day === null) continue;
    const modes = day as Record<string, unknown>;
    for (const key of ['hack', 'prereg'] as const) {
      const rec = readRecord(modes[key]);
      if (rec === null || rec.mode !== key) continue;
      if (rec.mode === 'hack') out.hackDays += 1;
      else out.preregDays += 1;
      if (rec.callCorrect !== undefined) {
        out.callsTotal += 1;
        if (rec.callCorrect) out.callsCorrect += 1;
      }
      if (rec.mode === 'hack' && rec.published) out.careerPoints += SCORING.publishedCareer;
      out.forkHistogram = incrementHistogram(out.forkHistogram, rec.forks);
      sanitised[iso] = { ...sanitised[iso], [key]: modes[key] as DayRecord };
      lastPlayedIso = iso;
    }
  }

  if (lastPlayedIso !== null) {
    const { streak, maxStreak } = streakAfter(sanitised, lastPlayedIso);
    out.streak = streak;
    out.maxStreak = maxStreak;
  }
  return out;
}

/** gr6-044: `stats` is the one block whose fields are read as ARITHMETIC
 * OPERANDS (`saveDay`'s `state.stats.callsTotal + 1`, `incrementHistogram`'s
 * `hist.slice()`), so "is an object" is not a check — it is an assumption.
 * A `{version: 1, ..., stats: {}}` blob used to pass validation and then
 * NaN-poison every counter on the very next `saveDay`, permanently and
 * invisibly (the histogram case did not even get that far: `.slice()` of
 * `undefined` throws). Every counter is therefore validated as a FINITE
 * number and the histogram as an array of finite numbers; anything else
 * falls back — per field, so one bad counter costs the player one counter and
 * never their history — to what `rebuildStatsFromHistory` can re-derive from
 * the days that survived (w6-r-010). On an empty or unusable history that
 * rebuild IS `freshState().stats`, so the previous behaviour is the floor,
 * not the default. */
function pickValidStats(value: unknown, history: unknown): PersistedStats {
  const out = rebuildStatsFromHistory(history);
  if (typeof value !== 'object' || value === null) return out;
  const raw = value as Record<string, unknown>;
  for (const key of STATS_COUNTERS) {
    if (isFiniteNumber(raw[key])) out[key] = raw[key];
  }
  if (Array.isArray(raw.forkHistogram) && raw.forkHistogram.every(isFiniteNumber)) {
    out.forkHistogram = raw.forkHistogram as number[];
  }
  return out;
}

function isValidV1(data: unknown): data is PersistedState {
  if (!isV1Container(data)) return false;
  const stats = data.stats as Record<string, unknown>;
  return (
    STATS_COUNTERS.every((key) => isFiniteNumber(stats[key])) &&
    Array.isArray(stats.forkHistogram) &&
    stats.forkHistogram.every(isFiniteNumber)
  );
}

/**
 * v1 -> v1 identity (defensively re-validated — a version tag lying about
 * its own shape is treated as corrupt); any other version -> fresh. This is
 * intentionally a stub: v1 is the only version that has ever existed, so
 * there is nothing to migrate FROM yet ("Migration function stub from day
 * one... because there will be a v2" — master spec §5.6).
 *
 * gr6-044 adds one middle case between "identity" and "fresh". A blob whose
 * CONTAINER is sound but whose `stats` block is not numerically usable is
 * REPAIRED rather than discarded: throwing the whole record away would cost
 * the player their history, their achievements and their settings to fix a
 * counter, which is a far worse outcome than the corruption itself. The
 * identity path is unchanged and still returns the very same object
 * reference for a blob that genuinely is a PersistedState.
 */
export function migrate(version: number, data: unknown): PersistedState {
  if (version !== 1) return freshState();
  if (isValidV1(data)) return data;
  if (isV1Container(data)) return { ...(data as unknown as PersistedState), stats: pickValidStats(data.stats, data.history) };
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
 * published rather than abandoned — `isPublishedStamp`, §1(j)(2)),
 * and the streak (recomputed via streakAfter over the updated history).
 */
export function saveDay(iso: string, rec: DayRecord): void {
  const state = loadState();

  const history: ModeHistory = { ...state.history, [iso]: { ...state.history[iso], [rec.mode]: rec } };
  const { streak, maxStreak } = streakAfter(history, iso);

  const earnedCareer = rec.mode === 'hack' && isPublishedStamp(rec.stamp) ? SCORING.publishedCareer : 0;
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

// --- saveAchievements (T30) -------------------------------------------------

/**
 * Merges newly-unlocked achievement ids into the persisted set (§2.11):
 * MERGE-ONLY — an id that already has an unlock date keeps that date
 * forever ("first date wins"); this only ever fills in a MISSING date, never
 * overwrites an existing one. `iso` is the puzzle day being persisted (the
 * caller's own `puzzleIso`, never a live wall-clock read — see
 * Summary.tsx's persistAndComputeSummary, the only real caller). Same
 * localStorage/memory-fallback semantics as the rest of this module (via
 * the existing loadState/persistState pair — no separate try/catch here).
 * A no-op `ids` list (nothing newly unlocked today, the common case) skips
 * the read+write entirely.
 */
export function saveAchievements(ids: AchievementId[], iso: string): void {
  if (ids.length === 0) return;

  const state = loadState();
  const achievements = { ...state.achievements };
  let changed = false;
  for (const id of ids) {
    if (achievements[id] === undefined) {
      achievements[id] = iso;
      changed = true;
    }
  }
  if (!changed) return; // every id already had an earlier date — nothing to write

  persistState({ ...state, achievements });
}
