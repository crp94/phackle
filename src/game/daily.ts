// Game-side date/URL concerns. Unlike src/engine/**, this file is allowed to
// touch the wall clock (`new Date`, `Math.random`) — it is what decides
// "which puzzle is today" for this player, not part of the deterministic
// engine itself.
import { EPOCH } from './tuning';

/** Local calendar components (not UTC) — "today" for the player wherever
 * they are. */
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

/** UTC-midnight diff, Math.round. Bare `YYYY-MM-DD` strings parse as UTC
 * midnight per the ECMA-262 Date Time String Format, so this is exact and
 * unaffected by the local time zone's DST transitions. */
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** `daysBetween(EPOCH, iso) + 1` — puzzle #1 on launch day. */
export function puzzleNumber(iso: string): number {
  return daysBetween(EPOCH, iso) + 1;
}

/** `?practice=1` or "today (locally) is before EPOCH" (pre-launch/dev). */
export function isPractice(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('practice') === '1' || localIsoDate() < EPOCH;
}

/**
 * T17: ms remaining until the next local (wall-clock) midnight — Summary's
 * countdown to tomorrow's puzzle. Uses the `Date` constructor's LOCAL-
 * component overload (`new Date(y, m, d, ...)`), which the JS engine resolves
 * against the host's own DST rules for that specific calendar date, so a
 * fall-back day (25 local hours) or spring-forward day (23 local hours)
 * between `now` and the following midnight is reflected automatically in the
 * returned ms — no special-casing needed, and no drift the way a naive
 * "24h minus elapsed-today" calculation would have on either transition day.
 */
export function msToNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Non-daily entropy for practice mode: unlike the real daily puzzle, practice
 * play is intentionally fresh every time, not derived from the date. */
export function practiceSeed(): number {
  // Practice mode is the one sanctioned non-deterministic path: it deliberately
  // does NOT reuse the day's seed, so repeated practice runs don't all replay
  // the same puzzle.
  // eslint-disable-next-line no-restricted-properties -- practice-mode entropy, see comment above
  return Math.floor(Math.random() * 4_294_967_296);
}
