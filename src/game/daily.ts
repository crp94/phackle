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

/**
 * gr6-021 — THE ROTATION INDEX FOR A BANK KEYED ON `puzzleNumber`, and the
 * one place the sign is handled.
 *
 * `puzzleNumber` above is `daysBetween(EPOCH, iso) + 1`, so it is NEGATIVE
 * on every date before the day before EPOCH — which is not a hypothetical:
 * `isPractice` treats exactly those dates as practice mode, so every
 * pre-launch run of this game has one. Measured on 2026-08-06 against
 * `EPOCH = '2026-08-10'`: `puzzleNumber = -3`.
 *
 * JavaScript's `%` is a REMAINDER, not a modulus: it keeps the sign of the
 * dividend, so `-3 % 14 === -3`. A bank indexed with the bare expression
 * therefore reads `bank[-3]`, which is `undefined` — and because the two
 * call sites (src/ui/screens/Reveal.tsx, §4.5's verdict sublines) treat
 * `undefined` as "this stamp has no subline", the ENTIRE 14-line retraction
 * bank and the entire 10-line null-reported bank silently vanish on every
 * pre-EPOCH day. Silently is the operative word: nothing throws, nothing
 * logs, and the screen simply renders one paragraph less than it was
 * written to.
 *
 * `((n % len) + len) % len` is the standard euclidean form and is exact for
 * every integer, of either sign, at any magnitude the date arithmetic can
 * produce. A zero-length bank has no index at all and returns 0 rather than
 * `NaN` (`0 % 0`), so a caller that has already checked `length > 0` — both
 * of today's do — is unaffected, and one that has not gets a number instead
 * of a `NaN` subscript.
 *
 * THE SWEEP, corrected and complete (w8-r-003 — the first version of this
 * count was wrong in the wave report, so the enumeration lives here now,
 * where the next reader of this function will find it). Every `%` over a pool
 * or range in `src/`, and why each is safe:
 *
 *   - `engine/seeds.ts:82` (`fnv1a32(...) % count`) and `game/briefing.ts:16`,
 *     `game/published.ts` altmetric ×2 and `pickJournal` — all seeded by
 *     `fnv1a32`, which returns `h >>> 0` and is therefore unsigned.
 *   - `engine/seeds.ts:136` (`(idx + 1) % count`) and `published.ts`'s
 *     reject-and-advance walk (`index`, `(index + step) % len`) — the left
 *     operand is built from an unsigned hash plus a slot index 0-2, never
 *     negative.
 *   - `components/RadioGroup.tsx:54,55` and `screens/Call.tsx:76` — the
 *     roving-focus sites, which already do the `+ length` dance. Their worst
 *     input is `findIndex` returning -1 (nothing focused), which lands on
 *     `len - 2`: non-negative for any group of 2 or more, and every group in
 *     this product is.
 *   - `engine/day.ts`'s `generatePractice` — the one genuine residual, an
 *     exported entry point taking a caller-supplied `seed`. Given its own
 *     euclidean guard in the same round; it cannot call this function,
 *     because eslint bars `src/engine/**` from importing `src/game/**`.
 *
 * So the conclusion the fix rests on holds — nothing else was silently
 * dropping content — but it holds over thirteen sites, not five.
 */
export function bankIndex(puzzleNumber: number, length: number): number {
  if (length <= 0) return 0;
  return ((puzzleNumber % length) + length) % length;
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
