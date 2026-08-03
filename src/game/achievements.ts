// Master spec §2.11 — achievements. Pure function of today's outcome plus the
// PRIOR history (not including today — see the docstring on
// evaluateAchievements below and storage.ts's data-flow comment for the
// intended call order relative to saveDay).
import type { AchievementId } from '../content/types';
import type { DayRecord, Outcome, PlayerAction, Spec } from '../engine/types';
import { distinctExplored } from './forkLog';

/**
 * §5.6 extension (ruling, ties to storage.ts): one play per mode per day
 * means history cannot be a flat `Record<IsoDate, DayRecord>` (the brief's
 * literal signature) — the same date can hold a 'hack' record, a 'prereg'
 * record, or both. This mirrors storage.ts's PersistedState['history']
 * shape structurally (both files define it independently — no import
 * between them — but the shapes must and do match).
 */
export type ModeHistory = Record<string, Partial<Record<'hack' | 'prereg', DayRecord>>>;

export interface AchievementCtx {
  log: PlayerAction[];
  published: Spec | null;
  /** Precomputed by the caller: did p cross .05 on the fork that flipped the
   * spec to one-tailed? (§2.11 "The One-Tailed Bandit".) */
  decisiveTails: boolean;
  history: ModeHistory;
  call: 'real' | 'noise' | null;
  callCorrect: boolean | null;
  mode: string;
  stamp: string;
}

function historyDays(history: ModeHistory): DayRecord[] {
  const out: DayRecord[] = [];
  for (const day of Object.values(history)) {
    if (day.hack) out.push(day.hack);
    if (day.prereg) out.push(day.prereg);
  }
  return out;
}

/** Raw count of times the outcome variable's value changed across the day's
 * VIEW_SPEC entries (§2.11 HARKing: "change outcome variable >=3 times") —
 * every transition counts, not just fork-counted ones, since HARKing is
 * about the hunting behavior itself. */
function countOutcomeChanges(log: PlayerAction[]): number {
  let count = 0;
  let prevOutcome: Outcome | null = null;
  for (const a of log) {
    if (a.t !== 'VIEW_SPEC') continue;
    if (prevOutcome !== null && a.spec.outcome !== prevOutcome) count++;
    prevOutcome = a.spec.outcome;
  }
  return count;
}

function countPeeks(log: PlayerAction[]): number {
  return log.filter((a) => a.t === 'PEEK_AND_EXTEND').length;
}

function distinctSubgroupsViewed(log: PlayerAction[]): number {
  const seen = new Set<Spec['subgroup']>();
  for (const a of log) if (a.t === 'VIEW_SPEC') seen.add(a.spec.subgroup);
  return seen.size;
}

function countPreregDays(history: ModeHistory): number {
  return Object.values(history).filter((day) => day.prereg !== undefined).length;
}

/** Every historical call, in chronological (ISO-date-lexical) order. ISO
 * `YYYY-MM-DD` keys sort lexically = chronologically. When both modes were
 * played on the same date, hack's call is treated as preceding prereg's —
 * an arbitrary but deterministic tie-break for a rare same-day double-play;
 * it never affects the primary single-mode-per-day test scenarios. */
function chronologicalCalls(history: ModeHistory): boolean[] {
  const calls: boolean[] = [];
  for (const iso of Object.keys(history).sort()) {
    const day = history[iso];
    if (day.hack?.callCorrect !== undefined) calls.push(day.hack.callCorrect);
    if (day.prereg?.callCorrect !== undefined) calls.push(day.prereg.callCorrect);
  }
  return calls;
}

function trailingCorrectStreak(calls: boolean[]): number {
  let streak = 0;
  for (let i = calls.length - 1; i >= 0; i--) {
    if (!calls[i]) break;
    streak++;
  }
  return streak;
}

/**
 * Master spec §2.11, pure: given today's outcome (ctx) and the history prior
 * to today, returns every achievement newly earned today. "Newly" matters
 * for the four first-occurrence achievements (first_blood, first_retraction,
 * monk, true_detective): each checks "the condition holds today AND did not
 * already hold before today", so a caller may call this once per day and
 * simply record `achievements[id] ??= todayIso` for whatever comes back,
 * without separately tracking "already unlocked" state itself.
 */
export function evaluateAchievements(ctx: AchievementCtx): AchievementId[] {
  const out: AchievementId[] = [];
  const days = historyDays(ctx.history);

  // First Blood: first publication, ever.
  const priorPublished = days.some((d) => d.stamp !== 'NULL_REPORTED');
  if (ctx.published !== null && !priorPublished) out.push('first_blood');

  // First Retraction: first RETRACTED stamp (unlocks Prereg Mode).
  const priorRetracted = days.some((d) => d.stamp === 'RETRACTED');
  if (ctx.stamp === 'RETRACTED' && !priorRetracted) out.push('first_retraction');

  // HARKing: outcome variable changed >=3 times today, then published.
  if (ctx.published !== null && countOutcomeChanges(ctx.log) >= 3) out.push('harking');

  // The One-Tailed Bandit: published where flipping to one-tailed was the
  // decisive fork (precomputed by the caller into ctx.decisiveTails).
  if (ctx.published !== null && ctx.decisiveTails) out.push('one_tailed_bandit');

  // Outlier Surgeon: published with the most aggressive exclusion (|z|>2) active.
  if (ctx.published !== null && ctx.published.exclusion === 'z2') out.push('outlier_surgeon');

  // Subgroup Safari: viewed results in >=5 distinct subgroup filters today
  // (no publish requirement — this is about exploration, not the outcome).
  if (distinctSubgroupsViewed(ctx.log) >= 5) out.push('subgroup_safari');

  // Just One More Batch: 3+ peek-and-extends today.
  if (countPeeks(ctx.log) >= 3) out.push('one_more_batch');

  // Garden of Forking Paths: >=25 distinct specs viewed today.
  if (distinctExplored(ctx.log).length >= 25) out.push('garden');

  // The Monk: 20 Prereg Mode days played, first time crossing the threshold.
  const priorPreregDays = countPreregDays(ctx.history);
  const todayPrereg = ctx.mode === 'prereg' ? 1 : 0;
  if (priorPreregDays < 20 && priorPreregDays + todayPrereg >= 20) out.push('monk');

  // Well, Actually: correct "noise" call on a day you published (you knew,
  // and did it anyway).
  if (ctx.published !== null && ctx.call === 'noise' && ctx.callCorrect === true) out.push('well_actually');

  // True Detective: 10 consecutive correct calls, first time crossing 10.
  const priorStreak = trailingCorrectStreak(chronologicalCalls(ctx.history));
  if (ctx.callCorrect === true && priorStreak < 10 && priorStreak + 1 >= 10) out.push('true_detective');

  return out;
}
