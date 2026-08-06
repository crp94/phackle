// T30 — wires T13's evaluateAchievements (achievements.ts) into the actual
// day-completion moment. T17's review confirmed evaluateAchievements had
// ZERO call sites before this file existed: the achievement wall stayed
// all-locked forever and the §2.11 first_retraction -> Prereg Mode unlock
// was dead. Two pieces:
//
//  - computeDecisiveTails: the "One-Tailed Bandit" truth table.
//  - unlockAchievements: assembles the AchievementCtx evaluateAchievements
//    needs from raw store/history data and wraps the call. Pure — no storage
//    access; persistAndComputeSummary (below, relocated here by gr6-081) is
//    the one place that actually persists what this returns (via storage.ts's
//    saveAchievements), inside its single sanctioned persistence moment.
import type { AchievementId } from '../content/types';
import type { CopyKey } from '../content/en/copy';
import type { DayType, PathResult, PlayerAction, RevealMetrics, Spec } from '../engine/types';
import { specKey } from '../engine/specGrid';
import { distinctOutcomeFamilies } from './forkLog';
import { callIsCorrect, scoreDay } from './scoring';
import { shareString } from './share';
import { loadState, saveAchievements, saveDay, streakAfter } from './storage';
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

// === The day-completion moment (gr6-081, relocated from screens/Summary.tsx) ===

export interface FinishedGameFields {
  mode: 'hack' | 'prereg';
  practice: boolean;
  puzzleNumber: number;
  forks: number;
  /** Whether the day ended in a publish (vs. an honest abandon) — the
   * store's `published: Spec | null` collapsed to a boolean, all scoreDay
   * itself needs (see scoring.ts's ScoreDayInput). */
  published: boolean;
  call: 'real' | 'noise' | null;
  dayType: DayType;
  stamp: RevealMetrics['stamp'];
  log: PlayerAction[];
  copy: Record<CopyKey, string>;
  /** The store's OWN `iso` — the puzzle's day, as `boot()` was called with
   * it (see `store.ts`'s `GameStore['iso']`) — NEVER `localIsoDate()` (a
   * live wall-clock read). This is deliberate, not merely "passed in for
   * testability": a live wall-clock read here is exactly the T17 review
   * round-2 bug (finish puzzle day D before midnight → sit on a nav page
   * past midnight, where `localIsoDate()` now returns D+1 → remount →
   * "today's" key is wrongly D+1, so the already-correct D save is
   * invisible to the `alreadySaved` check and D's snapshot re-persists a
   * second time, under D+1's key, phantom-extending the streak and later
   * silently blocking the real D+1 play). Anchoring to the puzzle's own day
   * instead makes this whole function immune to what time it happens to be
   * called at — see the doc comment below for exactly what that does and
   * does not cover. */
  puzzleIso: string;
  /** T30: every settled spec's result that was actually displayed today
   * (store.ts's own `resultLog`) — feeds dayComplete.ts's
   * computeDecisiveTails via unlockAchievements, inside this same
   * function's one persistence moment (see below). */
  resultLog: ResultLogEntry[];
  /** T18: the committed spec's own N=400 result (store.ts's `preregResult`,
   * set exactly once by preregCommit()) — the REAL prereg significance
   * signal, replacing T17's documented `stamp !== 'NULL_REPORTED'`
   * approximation (see persistAndComputeSummary's own doc comment below).
   * Optional and ignored outside `mode === 'prereg'`: a hack-mode caller may
   * omit it (existing call sites do), and SummaryScreen passes the store's
   * `result` through unconditionally regardless of mode — harmless, since
   * it is only ever consulted below the mode guard. */
  preregResult?: PathResult | null;
}

export interface ComputedSummary {
  breakdown: [CopyKey, number][];
  score: number;
  streak: number;
  shareText: string;
  /** gr6-018 — `scoreDay`'s own `career` figure, or `null` on a Prereg Mode
   * day (§2.8 lists the career track only among the Hacking Mode rows).
   * Carried here rather than recomputed by the screen so the invoice and the
   * Published cover cannot disagree about the same day's +25. */
  career: number | null;
  preregUnlocked: boolean;
  /** gr6-020 — whether Prereg Mode has already been spent on this puzzle
   * date, today's own play included. The Summary's prereg block is an
   * invitation, and there is nothing to invite on a day whose prereg attempt
   * is already gone. */
  preregPlayedToday: boolean;
  /** T38 — the achievements this call newly unlocked, straight out of the
   * SAME `unlockedToday` the function already persisted (see below): the
   * value is returned, not recomputed, so the screen can never disagree with
   * storage about what happened today. Empty on a practice day, on a
   * re-visit (`alreadySaved`), and on a day that simply earned nothing —
   * all three are the same statement, "nothing was unlocked HERE, now", and
   * all three correctly render no unlock block. */
  unlockedToday: AchievementId[];
}

/**
 * Turns one finished day into the numbers Summary renders, AND is the one
 * place in the app that actually persists it (§5.6) — flagged as an open
 * seam by T13's own report ("a natural seam for whichever task ... wires
 * Reveal -> Summary").
 *
 * IDEMPOTENT against being called more than once for the same (puzzleIso,
 * mode) — this is load-bearing, not a nicety: `SummaryScreen`'s own
 * mount-scoped `savedRef` guard only protects a SINGLE mount (e.g. React
 * StrictMode's dev-only double-effect); it does NOT survive App.tsx's
 * header nav, whose local page-state unmounts the running game machine
 * (including this screen) when the player clicks "Stats"/"Legend"/"About"
 * and remounts it — with a FRESH `savedRef` — on the way back (see
 * `src/ui/screens/registry.t17.patch.md`'s "nav-remount interaction"
 * section). `storage.ts`'s `saveDay` builds `callsTotal`/`callsCorrect`/
 * `careerPoints`/`hackDays`/`preregDays`/`forkHistogram` as INCREMENTS, not
 * an upsert, so a second `saveDay` for the same day+mode would silently
 * inflate every one of those numbers on every such visit. The durable guard
 * below is `loadState().history[puzzleIso]?.[mode]` — real storage, which
 * survives remounts, StrictMode, and any other component-lifecycle event.
 *
 * SAFE SPECIFICALLY BECAUSE `puzzleIso` is the puzzle's OWN day (the store's
 * `iso`, set once by `boot()`), never a live wall-clock read — round 2 of
 * review found that keying this same guard on `localIsoDate()` (this
 * function's original shape) is safe against a bare remount ALONE, but not
 * against a remount that straddles a real midnight: finish puzzle day D
 * before midnight (persists correctly under D) → sit on a nav page past
 * midnight (the countdown itself invites exactly this) → remount ->
 * `localIsoDate()` now returns D+1 -> the guard checks `history[D+1]`
 * (empty) -> D's already-correct snapshot re-persists a SECOND time, under
 * D+1's key -> stats inflate again, `streakAfter` counts a phantom D+1 play,
 * and the player's REAL D+1 game later finds that slot already occupied and
 * silently gets skipped. `puzzleIso` cannot drift like this: it is fixed for
 * this whole finished day at boot time, so the guard is correct regardless
 * of what the wall clock reads when this function happens to run, and
 * regardless of how many times or from how many mounts it runs. What it
 * does NOT cover: two genuinely different puzzle days both wanting the same
 * key (impossible — each boot() sets its own `iso`) or `saveDay` being
 * called directly by something other than this function (nothing else in
 * this codebase does). The invoice/streak/share text still render
 * identically either way (this function recomputes them fresh every call,
 * from the same deterministic inputs); only the actual `saveDay` write is
 * skipped once the record already exists.
 *
 * Prereg Mode's own flow (commit-before-data, no significance gate on
 * submit — unlike Hacking Mode, where store.submit() only ever fires once
 * p < .05, which is exactly why verdictStamp's RETRACTED/REPLICATED pair is
 * a safe read of "was published" for hack records) is wired by T18:
 * `preregSig` is now the REAL signal — `preregResult.valid &&
 * preregResult.p < 0.05`, read off the committed spec's own N=400
 * PathResult (store.ts's `preregResult`, set exactly once by
 * preregCommit()) — not derived from `stamp` at all. (T17's prior
 * approximation, "stamp !== NULL_REPORTED", is no longer even equivalent by
 * accident: store.ts's preregCommit() ALSO corrects `stamp` itself before
 * it ever reaches here, downgrading it to NULL_REPORTED whenever the
 * commit was non-significant — see that action's own doc comment — so the
 * two signals agree by construction today, but `preregSig` is computed
 * independently on purpose: a bug in one must not silently corrupt the
 * other.)
 *
 * gr6-081 — WHERE THIS LIVES, AND WHY IT MOVED. This shipped inside
 * `src/ui/screens/Summary.tsx`, co-located with the component that calls it
 * (the same tradeoff LocaleProvider.tsx makes for its useLocale hook). That
 * put the app's ONE persistence moment — a hundred lines of it, plus the
 * comment above, plus an `eslint-disable react-refresh/only-export-components`
 * waiver bought specifically to keep it there — inside a React screen file,
 * where nothing about it is React at all. It is framework-free by
 * construction (no hooks, no JSX, no context; a pure function of its fields
 * plus storage.ts), and this module already owned `unlockAchievements`, which
 * it calls. The move is pure relocation: not one line of its logic changed,
 * and the waiver is gone rather than relocated.
 */
export function persistAndComputeSummary(fields: FinishedGameFields): ComputedSummary {
  const { mode, practice, puzzleNumber, forks, published, call, dayType, stamp, log, copy, puzzleIso, resultLog, preregResult } =
    fields;

  const callCorrect = call !== null ? callIsCorrect(call, dayType) : null;
  const preregSig = mode === 'prereg' ? Boolean(preregResult && preregResult.valid && preregResult.p < 0.05) : undefined;
  // GR6 §1(f): the parsimony row is scored on distinct outcome FAMILIES now,
  // not on `forks`. Derived here from the day's own log rather than added to
  // `FinishedGameFields`, for the reason `publishedSpecFromLog` above gives for
  // the published spec: the log is already the authoritative record of what the
  // player looked at, and a second, separately-maintained count would be one
  // more thing that can disagree with it. `forks` stays in the fields — the
  // share string, the day record and the achievements all still count forks.
  const outcomeFamilies = distinctOutcomeFamilies(log);
  const scoreResult = scoreDay({ mode, dayType, published, callCorrect, outcomeFamilies, stamp, preregSig });

  const state = loadState();
  // The DURABLE idempotency guard (see the doc comment above): keyed on the
  // PUZZLE's own day (never a live wall-clock read), so it survives an
  // unmount/remount of this whole screen (the nav path) AND a real midnight
  // rollover happening while the player is sitting on a nav page — not
  // merely a StrictMode double-effect.
  const alreadySaved = state.history[puzzleIso]?.[mode] !== undefined;

  // The resulting streak (INCLUDING today) is needed before the DayRecord
  // can be built (its shareString embeds it). If today's record already
  // exists, `state.history` already reflects it — streakAfter can read it
  // directly. Otherwise, mirror storage.ts's own saveDay history-merge via
  // the already-exported streakAfter over a PLACEHOLDER entry (streakAfter
  // only checks presence of `.hack`/`.prereg`, never field values, so a
  // placeholder is exact for this purpose) — computing what the streak
  // WOULD BE once saved, without a second, redundant persistState round-trip.
  const historyForStreak = alreadySaved
    ? state.history
    : {
        ...state.history,
        [puzzleIso]: { ...state.history[puzzleIso], [mode]: { mode, score: 0, forks: 0, stamp, shareString: '' } },
      };
  //
  // gr6-078 — A PRACTICE DAY MUST NOT MOVE THE STREAK IT DOES NOT JOIN.
  //
  // The placeholder above answers "what will the streak BE once today is
  // saved", which is exactly right for a real day and a fiction on a practice
  // one: `saveDay` is skipped entirely below (`!practice`), so the day is
  // never written, and the invoice was printing N+1 while storage — and the
  // Stats wall, which reads `stats.streak` — held N. The number is also
  // embedded in the share text three lines down, so the overclaim left the
  // app in the paste.
  //
  // DEVIATION FROM THE BACKLOG ROW'S SUGGESTED ONE-LINER, measured. That row
  // proposes `alreadySaved || practice ? state.history : {…}`, which does stop
  // the overclaim but replaces it with a different wrong number: `streakAfter`
  // walks BACKWARDS from the day it is given and stops at the first day with
  // no record, so on a practice day whose real day has not been played it
  // returns 0 — a player on a 7-day streak would be shown "Streak: 0" for
  // running a practice session, and would have every reason to believe they
  // had just lost it. The honest figure is the one the rest of the app is
  // already showing that player: `stats.streak`, which is what the Stats
  // screen prints (Stats.tsx) and what `saveDay` last computed through the
  // last day actually recorded. Reading it here makes the invoice AGREE with
  // the honours board by construction rather than by arithmetic that happens
  // to coincide.
  //
  // The `alreadySaved` arm is unchanged and still comes first, so a practice
  // session run on a day whose real record exists reads that record's own
  // streak — the same number either branch would produce.
  const { streak } = practice && !alreadySaved ? { streak: state.stats.streak } : streakAfter(historyForStreak, puzzleIso);

  // Post-review fix: `callCorrect` is passed through AS-IS (never `?? false`)
  // — share.ts's own ShareStringInput.callCorrect is `boolean | null` exactly
  // so a real `null` (no call was ever made — every Prereg Mode day, since
  // §2.8 has no CALL step at all) reaches shareString and suppresses the
  // "→ ⚖️…" suffix entirely, rather than being coerced into a false "wrong
  // call" reading that every single prereg day previously got by construction.
  // gr6-022: `practice` reaches the share string as an explicit input, so a
  // practice run's paste says what it is instead of naming an issue number it
  // has no claim to. See ShareStringInput.practice for why it is passed rather
  // than derived (the spoiler property).
  const shareText = shareString({ puzzleNumber, log, mode, callCorrect, streak, practice, copy });

  // T30: achievements newly unlocked TODAY — stays empty unless the block
  // below actually runs. Folded into `preregUnlocked` regardless (see the
  // return statement) so the achievement-gated upsell can render on the
  // SAME summary that just earned it (§2.11: RETRACTED -> first_retraction
  // -> Prereg Mode), not only on some later day's.
  let unlockedToday: AchievementId[] = [];

  if (!practice && !alreadySaved) {
    saveDay(puzzleIso, {
      mode,
      score: scoreResult.score,
      forks,
      callCorrect: callCorrect ?? undefined,
      stamp,
      shareString: shareText,
    });

    // T30: evaluated against the history PRIOR to today — `state.history`,
    // captured above BEFORE saveDay's write, never `historyForStreak` (which
    // may carry a synthetic today-placeholder; see that variable's own doc
    // comment) — and persisted via storage.ts's merge-only saveAchievements.
    // Deliberately INSIDE this exact `!practice && !alreadySaved` guard, the
    // app's one sanctioned persistence moment (see this function's own doc
    // comment above), rather than a second guard of its own: a practice day
    // must never unlock anything, and a re-visit must never re-evaluate —
    // idempotence is inherited from the SAME check saveDay already uses, not
    // reimplemented.
    const earnedToday = unlockAchievements({
      log,
      resultLog,
      history: state.history,
      call,
      callCorrect,
      mode,
      stamp,
    });

    // gr6-019 — WHAT AN AWARD CEREMONY IS ALLOWED TO CELEBRATE.
    //
    // `evaluateAchievements` applies "newly earned" logic to exactly four of
    // the eleven ids (first_blood, first_retraction, monk, true_detective);
    // the other seven simply re-report their condition, which is correct for
    // a predicate and wrong for a ceremony. The Summary rendered the raw
    // return value as "UNLOCKED TODAY", so an informed caller measured over
    // 32 consecutive days got Subgroup Safari on 30 of them, Well Actually on
    // 22 and HARKing on 13 — 21 "unlocks" in week one from an 11-item set.
    // The day's one warm beat, and the screen's only entrance animation, was
    // worthless by day three. Meanwhile the Stats wall (fed by the merge-only
    // saveAchievements, where the first date wins) was quietly correct all
    // along, so the two disagreed on screen.
    //
    // The filter is against `state.achievements` — the snapshot taken BEFORE
    // this call's own merge-save, the same pre-today reading `history` already
    // uses for exactly this reason — so "no prior unlock date" means precisely
    // "the wall did not already have this one".
    //
    // Passing the FILTERED list to saveAchievements is not a second decision:
    // saveAchievements is merge-only ("an id that already has an unlock date
    // keeps that date forever"), so every id removed here is one it would have
    // discarded anyway. Persistence is byte-identical either way; only the
    // ceremony changes. Repeat conditions keep earning score and flavour —
    // they just stop being applauded.
    unlockedToday = earnedToday.filter((id) => state.achievements[id] === undefined);
    saveAchievements(unlockedToday, puzzleIso);
  }

  return {
    breakdown: scoreResult.breakdown,
    score: scoreResult.score,
    streak,
    shareText,
    career: mode === 'prereg' ? null : scoreResult.career,
    // `state` is the PRE-save snapshot, so today's own prereg record is not in
    // it yet — `mode === 'prereg'` is what covers the day being finished right
    // now, and the history read covers a prereg day finished earlier and
    // revisited (or a hack day played after this date's prereg one).
    preregPlayedToday: mode === 'prereg' || state.history[puzzleIso]?.prereg !== undefined,
    // True if EITHER a past day already unlocked first_retraction, OR today
    // just did (`unlockedToday` — see its own doc comment above for why
    // "today" must be included here, not only what was already in storage
    // before this call started).
    preregUnlocked: state.achievements.first_retraction !== undefined || unlockedToday.includes('first_retraction'),
    // T38: the same array, handed on rather than re-derived. Re-running
    // unlockAchievements here (or, worse, diffing storage before/after) would
    // be a SECOND evaluation of the day and a second thing to keep in step
    // with the guard above; this way the unlock block shows exactly what
    // saveAchievements just wrote, and on a re-visit — where the persistence
    // block is skipped entirely — it stays empty, which is correct: the
    // ceremony belongs to the day it happened, not to every later visit.
    unlockedToday,
  };
}
