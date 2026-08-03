// T30 — wires T13's evaluateAchievements (achievements.ts) into the actual
// day-completion moment. T17's review confirmed evaluateAchievements had
// ZERO call sites before this file existed: the achievement wall stayed
// all-locked forever and the §2.11 first_retraction -> Prereg Mode unlock
// was dead. Two pieces:
//
//  - computeDecisiveTails: the "One-Tailed Bandit" truth table.
//  - unlockAchievements: assembles the AchievementCtx evaluateAchievements
//    needs from raw store/history data and wraps the call. Pure — no storage
//    access; Summary.tsx's persistAndComputeSummary is the one place that
//    actually persists what this returns (via storage.ts's saveAchievements),
//    inside its single sanctioned persistence moment.
import type { AchievementId } from '../content/types';
import type { PlayerAction, RevealMetrics, Spec } from '../engine/types';
import { specKey } from '../engine/specGrid';
import { evaluateAchievements, type AchievementCtx, type ModeHistory } from './achievements';
import type { ResultLogEntry } from './store';

/**
 * §2.11 "The One-Tailed Bandit": true iff (a) the published spec is
 * one-tailed, and (b) the SAME spec — every other knob identical — but
 * two-tailed was actually displayed to the player at some point today with
 * p >= .05. That combination is exactly "the two-tailed version came back
 * non-significant, and flipping to one-tailed is what made it publishable."
 *
 * The published spec's OWN p < .05 is NOT independently re-derived here:
 * `computeDecisiveTails`'s pinned signature takes only `resultLog` and
 * `published` (a bare `Spec`, no p attached), and `store.submit()`'s own
 * guard (`s.result.valid && s.result.p < 0.05 && !s.pending`) makes "any
 * spec that ever reaches `published` had p < .05 at submission" a hard
 * invariant of the real app — there is no code path to a non-significant
 * `published`. This function takes that invariant as given, exactly as
 * `evaluateAchievements` already takes "ctx.published is non-null only on an
 * actual publish" as given (see achievements.ts's own module doc comment).
 *
 * `resultLog` keys are spec-SHAPE only — `engine/specGrid.ts`'s `specKey`
 * does not encode the sample window N — deliberately: a two-tailed sibling
 * seen at N=200 (before a later peek-and-extend, or before flipping tails)
 * still counts, since this achievement is about which spec SHAPES were
 * explored, not what window they happened to be viewed at.
 */
export function computeDecisiveTails(resultLog: ResultLogEntry[], published: Spec | null): boolean {
  if (published === null || published.tails !== 'one') return false;
  const siblingKey = specKey({ ...published, tails: 'two' });
  return resultLog.some((r) => r.key === siblingKey && r.valid && r.p >= 0.05);
}

/**
 * Raw inputs `unlockAchievements` needs to assemble an `AchievementCtx` —
 * everything evaluateAchievements' ctx wants EXCEPT `published` (derived
 * below from `log`'s own SUBMIT entry — see `publishedSpecFromLog` — so
 * callers never have to keep a separately-collapsed `Spec | null` in sync
 * with the log by hand) and `decisiveTails` (computed here via
 * `computeDecisiveTails`).
 *
 * `history` MUST be the history PRIOR to today (see achievements.ts's own
 * module doc comment: evaluateAchievements is a pure function of "today's
 * outcome... and the history prior to today"). Summary.tsx's
 * persistAndComputeSummary passes its own pre-saveDay `state.history` for
 * exactly this reason — never a copy that already has today folded in
 * (e.g. the streak-computation's own synthetic placeholder).
 */
export interface DayCompleteInput {
  log: PlayerAction[];
  resultLog: ResultLogEntry[];
  history: ModeHistory;
  call: 'real' | 'noise' | null;
  callCorrect: boolean | null;
  mode: 'hack' | 'prereg';
  stamp: RevealMetrics['stamp'];
}

/** The day's published spec, if any — the log's own SUBMIT entry's `spec`.
 * At most one SUBMIT ever appears in a single day's log: store.submit() is
 * guarded to fire only once and always leaves 'lab' for good afterward
 * (see store.ts), so `.find` is exactly "the" SUBMIT entry, not merely the
 * first of several. */
function publishedSpecFromLog(log: PlayerAction[]): Spec | null {
  const submitEntry = log.find((a): a is Extract<PlayerAction, { t: 'SUBMIT' }> => a.t === 'SUBMIT');
  return submitEntry?.spec ?? null;
}

/**
 * Wraps T13's evaluateAchievements (§2.11): assembles its ctx from raw
 * log/resultLog/history data and returns whatever it decides is newly
 * earned today. Pure — see the module doc comment for why persistence is
 * deliberately not this function's job.
 */
export function unlockAchievements(input: DayCompleteInput): AchievementId[] {
  const published = publishedSpecFromLog(input.log);
  const ctx: AchievementCtx = {
    log: input.log,
    published,
    decisiveTails: computeDecisiveTails(input.resultLog, published),
    history: input.history,
    call: input.call,
    callCorrect: input.callCorrect,
    mode: input.mode,
    stamp: input.stamp,
  };
  return evaluateAchievements(ctx);
}
