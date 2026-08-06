// Master spec §3.1 — pure hash derivations for the day's seed, day type,
// scenario, and (on effect days) the true effect parameters. Engine-side:
// imports only its siblings prng and civil, plus game/tuning (an allowed
// exception to engine purity, for shared constants) — see
// docs/implementation_plan.md §5 and eslint.config.js's engine-purity block.
import { civilFromDays, daysFromCivil, formatIso, parseIso } from './civil';
import { fnv1a32 } from './prng';
import type { DayType, Outcome, Spec } from './types';
import { EFFECT_D_RANGE, EPOCH, HETERO_PROB_PCT, P_EFFECT_PCT } from '../game/tuning';

/** `seed = fnv1a32("phackle:" + isoDate + ":" + attempt)` — §3.1. `attempt` is
 * the rejection-sampling counter (§3.3). */
export function daySeed(iso: string, attempt: number): number {
  return fnv1a32(`phackle:${iso}:${attempt}`);
}

/** `effect iff (fnv1a32("daytype:" + isoDate) % 100) < 25` — §3.1. */
export function dayTypeFor(iso: string): DayType {
  return fnv1a32(`daytype:${iso}`) % 100 < P_EFFECT_PCT ? 'effect' : 'null';
}

// The six non-'all' subgroups, in the order they appear in the Spec union
// (src/engine/types.ts) — this order is part of the deterministic derivation
// and must stay in sync with that union.
const NON_ALL_SUBGROUPS: Spec['subgroup'][] = ['age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'];

export function effectParamsFor(iso: string): {
  outcome: Outcome;
  d: number;
  hetero: boolean;
  heteroSubgroup: Spec['subgroup'];
} {
  const outcome = (fnv1a32(`effoutcome:${iso}`) % 4) as Outcome;
  const span = EFFECT_D_RANGE[1] - EFFECT_D_RANGE[0];
  const d = EFFECT_D_RANGE[0] + (span * (fnv1a32(`effsize:${iso}`) % 1000)) / 1000;
  const hetero = fnv1a32(`hetero:${iso}`) % 100 < HETERO_PROB_PCT;
  const heteroSubgroup = NON_ALL_SUBGROUPS[fnv1a32(`heterosub:${iso}`) % 6];
  return { outcome, d, hetero, heteroSubgroup };
}

// --- Scenario rotation (no-repeat-within-14-days), stateless ---
//
// scenarioIndexFor needs to look at the previous 13 calendar dates. `new Date`
// is banned in src/engine/** (the engine must be a pure function of its
// string/number inputs, never the wall clock or any host Date implementation
// quirk), so the calendar arithmetic is our own pure-integer implementation —
// see src/engine/civil.ts, which this file imports.

/** The rolling exclusion window: the number of preceding calendar dates whose
 * scenario indices a date must avoid. 13 back + the date itself = the 14-day
 * no-repeat window (§3.1). */
const WINDOW = 13;

// Pure memoization (not "state" in the determinism sense — every entry is
// exactly what a fresh computation would produce; it only avoids re-walking
// the same date's dependency chain on every call).
const scenarioIndexCache = new Map<string, number>();

/** Resumable forward-walk state, one per `count`. `lastDay` is the most recent
 * day (in days-since-1970) whose index has been assigned; `window` holds the
 * indices of days `lastDay-12 .. lastDay` in that order. Everything here is a
 * pure cache of values the walk would recompute identically — see
 * scenarioIndexFor's own note on why memoization is not "state". */
interface WalkState {
  lastDay: number;
  window: number[];
}
const walkStates = new Map<number, WalkState>();

const EPOCH_DAY = daysFromCivil(...parseIso(EPOCH));

/** The canonical `YYYY-MM-DD` string for a day count — the exact spelling the
 * recursive formulation's `isoMinusDays` produced for every date it walked
 * into, and therefore the exact string its `fnv1a32` saw. */
function isoForDay(day: number): string {
  return formatIso(...civilFromDays(day));
}

/** The base-case index for a date at/before EPOCH: no game history yet, so no
 * exclusion set — just the raw hash. */
function baseIndex(iso: string, count: number): number {
  return fnv1a32(`scenario:${iso}`) % count;
}

/** Fresh walk state for `count`, seeded at EPOCH: the window holds the
 * base-case indices of EPOCH-12 .. EPOCH, which are exactly the values the
 * recursive formulation would have produced for those dates (all at/before
 * EPOCH, hence all base cases). */
function seedWalkState(count: number): WalkState {
  const window: number[] = [];
  for (let back = WINDOW - 1; back >= 0; back--) {
    window.push(baseIndex(isoForDay(EPOCH_DAY - back), count));
  }
  return { lastDay: EPOCH_DAY, window };
}

// One Set, allocated once at module load and reused for every day of every
// walk — cleared and refilled from the rolling window on each use, never read
// across calls (a scratch buffer, not carried state; the recursive version
// allocated a fresh 13-entry Set per date instead). Safe because the engine is
// single-threaded and nothing here is re-entrant or async.
const excluded = new Set<number>();

/**
 * Advances `count`'s forward walk so that every day up to and including
 * `throughDay` has an assigned index, and returns the walk state. O(1) stack
 * and O(days not yet walked) work; a resumed walk (the normal case: yesterday
 * was already computed) does no work at all.
 */
function walkThrough(count: number, throughDay: number): WalkState {
  let state = walkStates.get(count);
  if (state === undefined) {
    state = seedWalkState(count);
    walkStates.set(count, state);
  }

  for (let day = state.lastDay + 1; day <= throughDay; day++) {
    const iso = isoForDay(day);
    const idx = advancePastWindow(baseIndex(iso, count), count, state.window);
    state.window.shift();
    state.window.push(idx);
    state.lastDay = day;
    scenarioIndexCache.set(`${iso}|${count}`, idx);
  }
  return state;
}

/** `idx0` advanced forward (wrapping) past every index in `window` — the exact
 * `while (excluded.has(idx)) idx = (idx + 1) % count` loop the recursive
 * version ran, against the same 13 values. */
function advancePastWindow(idx0: number, count: number, window: number[]): number {
  excluded.clear();
  for (let i = 0; i < window.length; i++) excluded.add(window[i]);
  let idx = idx0;
  while (excluded.has(idx)) {
    idx = (idx + 1) % count;
  }
  return idx;
}

/**
 * `idx0 = fnv1a32('scenario:'+iso) % count`; walk forward (wrapping) past any
 * index used by the previous 13 calendar dates, so no scenario repeats within
 * a 14-day window. Dates at/before EPOCH are the base case (no game history
 * yet, so no exclusion set) — deterministic, no external state.
 *
 * Implemented as an ITERATIVE forward walk from EPOCH (gr6-045). The earlier
 * formulation recursed into the 13 preceding dates, each of which recursed
 * into *its* 13 — memoised, so the work was O(days since EPOCH), but the STACK
 * DEPTH was O(days since EPOCH) too: measured RangeError at EPOCH+9,131 days
 * (2051) and ~230 ms at EPOCH+5,479 days, a linearly growing tax paid on every
 * day-boot and a reachable crash on any device with a badly-set clock. The
 * walk below produces BIT-IDENTICAL indices (43,547 Object.is comparisons over
 * 6,221 consecutive dates x 7 scenario counts, old vs new, zero mismatches)
 * with O(1) stack, one reused Set, and one fnv1a32 per day instead of 13
 * string conversions plus a fresh Set.
 */
export function scenarioIndexFor(iso: string, count: number): number {
  const key = `${iso}|${count}`;
  const cached = scenarioIndexCache.get(key);
  if (cached !== undefined) return cached;

  const idx0 = baseIndex(iso, count);

  // At/before EPOCH there is no history to avoid, so no exclusion walk — and
  // therefore no `count` requirement either.
  if (!(iso > EPOCH)) {
    scenarioIndexCache.set(key, idx0);
    return idx0;
  }

  // gr6-099: with 13 excluded indices and `count <= 13` there may be no free
  // index at all, and the advance loop below would spin forever — inside a Web
  // Worker with no message pump, i.e. a silent hang with no error and no crash
  // handler. Unreachable today (tests/content/shape.test.ts enforces
  // MIN_SCENARIOS = 20 for every locale), but a thrown error routes to the
  // existing worker-crash path and a hang does not.
  if (count <= WINDOW) {
    throw new Error(
      `scenarioIndexFor: scenarioCount=${count} cannot satisfy the ${WINDOW}-day ` +
        `no-repeat exclusion window (needs at least ${WINDOW + 1} scenarios).`,
    );
  }

  // The 13 preceding dates' indices, via the resumable forward walk.
  const targetDay = daysFromCivil(...parseIso(iso));
  const { window } = walkThrough(count, targetDay - 1);
  const idx = advancePastWindow(idx0, count, window);

  scenarioIndexCache.set(key, idx);
  return idx;
}

/** Regression-test hook (tests/engine/seeds.test.ts): drops every memoised
 * index and every walk cursor, so a test can prove a value is reproduced from
 * scratch rather than served from a cache an earlier test warmed. Never called
 * by the engine itself — clearing is a no-op on the values, since every entry
 * is exactly what a fresh computation produces. */
export function resetScenarioIndexCacheForTests(): void {
  scenarioIndexCache.clear();
  walkStates.clear();
}
