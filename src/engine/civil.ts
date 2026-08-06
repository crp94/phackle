// Civil-calendar arithmetic for src/engine/** — the one copy (gr6-047).
//
// `new Date` is banned in src/engine/** (eslint no-restricted-syntax): the
// engine must be a pure function of its string/number inputs, never the wall
// clock and never a host Date implementation's quirks. So the engine does its
// own calendar arithmetic, in pure integer math: Howard Hinnant's
// days_from_civil / civil_from_days algorithm
// (http://howardhinnant.github.io/date_algorithms.html), which converts
// between a y/m/d triple and a day count using only +,-,*,/,% and Math.floor
// — all spec-exact per ECMA-262, so this module is byte-identical on every
// engine (unlike Math.exp/Math.log; see stats.ts's header).
//
// Until gr6-047 this algorithm existed as two byte-identical copies inside
// src/engine/ (seeds.ts and day.ts). It is now imported by both. A THIRD copy
// lives in src/game/daily.ts and deliberately stays there: src/engine/** may
// not import src/game/* (bar tuning.ts), and daily.ts is on the game side of
// that boundary, so that duplication is purity-forced rather than a matter of
// taste. day.test.ts cross-checks the two byte-for-byte.

/** Days since 1970-01-01 for the civil date (y, m, d). `m` is 1..12, `d` is
 * 1..31; the algorithm is exact for the whole proleptic Gregorian range. */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400; // [0, 399]
  const mp = (m + 9) % 12; // Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468; // days since 1970-01-01
}

/** Inverse of `daysFromCivil`: the (y, m, d) triple `z` days after
 * 1970-01-01. */
export function civilFromDays(z: number): [number, number, number] {
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

/** `"YYYY-MM-DD"` -> `[y, m, d]`. No validation: every caller in the engine
 * receives its date string from the game layer, which owns that check. */
export function parseIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** `[y, m, d]` -> `"YYYY-MM-DD"` (month and day zero-padded to two digits). */
export function formatIso(y: number, m: number, d: number): string {
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
