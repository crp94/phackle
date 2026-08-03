// GameStore (T12) exposes `puzzleNumber` but not the ISO date string itself
// (see src/game/store.ts's InitInfo-derived state — deliberately: the master
// spec pins `InitInfo` as "NEVER dayType", and iso isn't part of it either).
// T15's Briefing/Published screens need `iso` itself, though: pickJournal,
// the press picker and Grantwell's rotation all hash `iso` directly (the
// controller's pinned formulas, mirroring src/engine/seeds.ts's own
// `fnv1a32(domain + ':' + iso)` convention). Rather than modify store.ts (not
// owned by this task) to also carry `iso`, this is the exact left inverse of
// src/game/daily.ts's `puzzleNumber(iso) = daysBetween(EPOCH, iso) + 1`, so
// any screen holding only `puzzleNumber` can recover the same `iso` the app
// originally booted with.
import { EPOCH } from './tuning';

const MS_PER_DAY = 86_400_000;

/**
 * Inverse of `puzzleNumber` (src/game/daily.ts). `EPOCH` is a bare
 * `YYYY-MM-DD` string, which parses as UTC midnight per the ECMA-262 Date
 * Time String Format (same fact daily.ts's own `daysBetween` relies on) —
 * so the offset is added in UTC and read back with UTC getters, never local
 * ones (unlike `localIsoDate`, which is deliberately local-timezone "today").
 * Whole-day arithmetic only: no rounding, so this is an exact inverse, not an
 * approximation — verified by the round-trip test against `puzzleNumber()`.
 */
export function isoFromPuzzleNumber(n: number): string {
  const epochMs = new Date(EPOCH).getTime();
  const d = new Date(epochMs + (n - 1) * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const pad2 = (x: number) => (x < 10 ? `0${x}` : `${x}`);
  return `${y}-${pad2(m)}-${pad2(day)}`;
}
