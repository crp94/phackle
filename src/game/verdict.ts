// §1(j)(2) — READING THE VERDICT STAMP, IN ONE PLACE.
//
// `verdictStamp` (engine/reveal.ts) now returns four values: two that mean a
// claim was published (RETRACTED, REPLICATED) and two that mean the player
// reported nothing (CONFIRMED_NULL on a null day, MISSED_DISCOVERY on an
// effect day). Four sites in this layer needed "was this day published" and
// each spelled it `stamp !== 'NULL_REPORTED'`:
//
//   * storage.ts's `readRecord` (the stats-repair path's `published` flag),
//   * storage.ts's `saveDay` (whether the day earned career points),
//   * statsAgg.ts's `modeSuccessRate` (the §2.8 "alpha made visible" figure),
//   * achievements.ts's `priorPublished` (First Blood's "ever published").
//
// Every one of those was FAIL-OPEN: a verdict added to the union counted as a
// publication by default, silently, in a career-points arithmetic and a
// success-rate percentage. Splitting the honest verdict in two would have
// walked straight into it — both new values are unpublished, and all four
// comparisons would have said "published" and stayed green.
//
// So the predicate is a total MAP rather than a comparison. Adding a fifth
// verdict is a missing-property type error here, at the one place that has to
// decide what the new verdict means, instead of four quiet wrong answers.
import type { DayType, RevealMetrics } from '../engine/types';

type Verdict = RevealMetrics['stamp'];

/**
 * WHICH honest verdict an unpublished day earns — the whole of §1(j)(2)'s new
 * rule, in the one place both callers read it from.
 *
 * TWO SITES, AND THE LAW SAYS THEY MUST BE TWO. `verdictStamp`
 * (engine/reveal.ts) resolves the ordinary day; `store.ts`'s `preregCommit`
 * re-resolves it for the one case the engine cannot see — a preregistered
 * commit that came back non-significant, which is a report of nothing
 * however the engine stamped it. Those two disagreeing would put a
 * MISSED_DISCOVERY on a null day.
 *
 * One home was the first shape and eslint rejected it, correctly: the
 * compiled layering rule on `src/engine/**` allows the engine two outside
 * dependencies (game/tuning.ts and the checksum-guarded tables in src/data)
 * and a verdict helper is neither. Importing the engine's copy from store.ts
 * instead would drag the DGP constants and the p_hit table into the main
 * bundle, which is the thing the worker exists to prevent.
 *
 * So the rule is written twice and its agreement is COMPILED:
 * tests/game/verdict.test.ts drives the real `verdictStamp` on both day types
 * and asserts it returns exactly this. A drift is a red test, not a wrong
 * stamp.
 */
export function honestStampFor(dayType: DayType): Verdict {
  return dayType === 'effect' ? 'MISSED_DISCOVERY' : 'CONFIRMED_NULL';
}

/** Exhaustive by type: `Record<Verdict, …>` cannot lose a member without tsc
 * saying so, and cannot gain one without a decision being written here. */
const PUBLISHED: Record<Verdict, boolean> = {
  RETRACTED: true,
  REPLICATED: true,
  CONFIRMED_NULL: false,
  MISSED_DISCOVERY: false,
};

/**
 * True iff the day ended in a published claim (§2.7.4), whatever became of
 * it. `=== true` rather than a bare lookup because a `DayRecord` read back
 * out of `localStorage` is only structurally typed: a record written by a
 * build older than §1(j)(2) carries the retired `'NULL_REPORTED'`, which is
 * not a key here and would otherwise return `undefined`. It reads as
 * unpublished, which is exactly what that verdict meant.
 *
 * Deliberately NOT migrated on load: a stored `DayRecord` carries no day
 * type, so a legacy honest day cannot be resolved into CONFIRMED_NULL or
 * MISSED_DISCOVERY without inventing the one fact that distinguishes them.
 * It stays what it was, and every consumer of it in this file's list reads it
 * correctly.
 */
export function isPublishedStamp(stamp: Verdict): boolean {
  return PUBLISHED[stamp] === true;
}

/**
 * The complement: the player reported nothing. Written as the negation of
 * the map rather than as its own enumeration so the two can never disagree,
 * and so a new verdict is decided once.
 *
 * The Reveal's NULL REPORTED subline bank (gr6-037) gates on THIS, not on
 * either honest verdict by name — see Reveal.tsx, and W3's standing rule that
 * the bank is day-type-agnostic by construction and gets no branch.
 */
export function isHonestStamp(stamp: Verdict): boolean {
  return !isPublishedStamp(stamp);
}
