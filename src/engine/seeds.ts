// Master spec §3.1 — pure hash derivations for the day's seed, day type,
// scenario, and (on effect days) the true effect parameters. Engine-side:
// imports only prng (sibling) and game/tuning (the one allowed exception to
// engine purity, for shared constants) — see docs/implementation_plan.md §5.
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
// scenarioIndexFor needs to look at the previous 13 calendar dates, but
// `new Date` is banned in src/engine/** (the engine must be a pure function
// of its string/number inputs, never the wall clock or any host Date
// implementation quirk). So we do calendar arithmetic ourselves, in pure
// integer math: Howard Hinnant's civil_from_days / days_from_civil algorithm
// (http://howardhinnant.github.io/date_algorithms.html), which converts
// between a y/m/d triple and a day count using only +,-,*,/ and Math.floor.

function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400; // [0, 399]
  const mp = (m + 9) % 12; // Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468; // days since 1970-01-01
}

function civilFromDays(z: number): [number, number, number] {
  const zz = z + 719468;
  const era = Math.floor((zz >= 0 ? zz : zz - 146096) / 146097);
  const doe = zz - era * 146097; // [0, 146096]
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365); // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153); // [0, 11]
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const m = mp + (mp < 10 ? 3 : -9); // [1, 12]
  return [m <= 2 ? y + 1 : y, m, d];
}

function parseIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

function formatIso(y: number, m: number, d: number): string {
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function isoMinusDays(iso: string, n: number): string {
  const [y, m, d] = parseIso(iso);
  return formatIso(...civilFromDays(daysFromCivil(y, m, d) - n));
}

// Pure memoization (not "state" in the determinism sense — every entry is
// exactly what a fresh computation would produce; it only avoids the
// exponential blowup of re-walking the same date's dependency chain).
const scenarioIndexCache = new Map<string, number>();

/**
 * `idx0 = fnv1a32('scenario:'+iso) % count`; walk forward (wrapping) past any
 * index used by the previous 13 calendar dates, so no scenario repeats within
 * a 14-day window. Dates at/before EPOCH are the base case (no game history
 * yet, so no exclusion set) — deterministic, no external state.
 */
export function scenarioIndexFor(iso: string, count: number): number {
  const key = `${iso}|${count}`;
  const cached = scenarioIndexCache.get(key);
  if (cached !== undefined) return cached;

  const idx0 = fnv1a32(`scenario:${iso}`) % count;
  let idx = idx0;

  if (iso > EPOCH) {
    const excluded = new Set<number>();
    for (let back = 1; back <= 13; back++) {
      excluded.add(scenarioIndexFor(isoMinusDays(iso, back), count));
    }
    while (excluded.has(idx)) {
      idx = (idx + 1) % count;
    }
  }

  scenarioIndexCache.set(key, idx);
  return idx;
}
