// T17 — Summary screen (master spec §2.8/§7.3): the score breakdown, styled
// as a journal fee invoice (Act I academia meets Act II accounting — DESIGN.md
// hairline table rules); the share button (navigator.share -> clipboard
// fallback -> a summary.copied toast, shown only for the clipboard path — the
// OS's own share sheet is already the confirmation for the other one); the
// streak strip; the countdown to next local midnight; T38's unlock block (the
// achievements TODAY earned, named and cited — DESIGN.md R5.2 site 9, and the
// screen's only entrance); and a (currently disabled-for-now,
// achievement-gated) Prereg Mode upsell.
//
// A "standalone store-reading screen" (T17 controller pin): the default
// export reads the game store + storage/locale directly. The named `Summary`
// export is the pure presentational half, driven entirely by props, so the
// invoice/countdown/share/upsell logic is directly unit-testable without
// touching zustand or React context at all (tests/ui/summary.test.tsx).
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../game/store';
import type { ResultLogEntry } from '../../game/store';
import { useLocale } from '../../i18n/LocaleProvider';
import type { CopyKey } from '../../content/en/copy';
import type { AchievementId, LocaleContent } from '../../content/types';
import type { DayType, PathResult, PlayerAction, RevealMetrics } from '../../engine/types';
import { callIsCorrect, scoreDay } from '../../game/scoring';
import { loadState, saveAchievements, saveDay, streakAfter } from '../../game/storage';
import { unlockAchievements } from '../../game/dayComplete';
import { shareString, shareViaNavigator } from '../../game/share';
import { msToNextLocalMidnight } from '../../game/daily';
import { staggerStyle, useEnterOnce } from '../hooks/useEnterOnce';
import './Summary.css';

type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

// How long the clipboard-fallback "Copied to clipboard" toast stays up.
// T35 gives its ARRIVAL a --dur-quick beat (DESIGN.md R5.2 site 7,
// Summary.css's .ph-summary__toast) because a clipboard write is otherwise
// invisible; the DISMISSAL after this timeout stays instant, since a toast
// leaving carries no information.
const TOAST_MS = 3000;
// How often the countdown's displayed hours/minutes are refreshed. A plain
// text update on an interval, not a CSS animation/transition, so it is not
// a motion site under R5.2 at all.
const COUNTDOWN_REFRESH_MS = 30_000;

/** T38 — one achievement earned TODAY, already resolved against the active
 * locale's own bank (`LocaleContent['achievements']`). The screen wrapper
 * below does the resolving so the presentational half stays prop-driven; the
 * `name`/`citation` strings are the content bank's, never restated here or in
 * copy.ts (that bank is the ONLY place an achievement is named). */
export type UnlockedAchievement = LocaleContent['achievements'][AchievementId] & { id: AchievementId };

export interface SummaryProps {
  t: TFunction;
  /** scoreDay's own [CopyKey, number][] — see scoring.ts: summing these
   * values always reconstructs `score` exactly. */
  breakdown: [CopyKey, number][];
  score: number;
  streak: number;
  now: Date;
  shareText: string;
  preregUnlocked: boolean;
  /** T38 — what today unlocked, in `unlockAchievements`' own order. Defaults
   * to none: an EMPTY day renders no block at all (no heading, no
   * empty-state line), which is the whole point of an award ceremony that
   * only happens when something was awarded. */
  unlocked?: UnlockedAchievement[];
}

/** One line of the ceremony: the award's name, then its citation.
 *
 * DESIGN.md R5.2 site 9's animation hook and nothing else — the same
 * `useEnterOnce` idiom as the reveal's blocks (site 3) and Published's
 * clippings (site 5), for the same reason those two stopped being
 * mount-gated: on a phone this block sits below the invoice, the total, the
 * streak and the countdown, so a mount-triggered entrance would run to
 * completion off screen and the player would scroll down to an award that had
 * always been there. `index` is its position in the one staggered group,
 * capped by `staggerStyle` (R5.7's MAX_STAGGER_STEPS). */
function UnlockLine({ award, index }: { award: UnlockedAchievement; index: number }) {
  const { ref, entered } = useEnterOnce<HTMLLIElement>();
  return (
    <li
      ref={ref}
      className={entered ? 'ph-summary__unlock-item ph-summary__unlock-item--in' : 'ph-summary__unlock-item'}
      style={staggerStyle(index)}
      data-testid="unlock-item"
    >
      <p className="ph-summary__unlock-name">{award.name}</p>
      <p className="ph-summary__unlock-citation">{award.citation}</p>
    </li>
  );
}

export function Summary({ t, breakdown, score, streak, now, shareText, preregUnlocked, unlocked = [] }: SummaryProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
  }, []);

  async function handleShare() {
    // A fresh attempt always clears any previous failure message — a retry
    // that succeeds shouldn't leave a stale error sitting on screen.
    setShareFailed(false);
    try {
      const result = await shareViaNavigator(shareText);
      // Only the clipboard path gets a toast — navigator.share already shows
      // the OS's own share sheet, which is its own confirmation.
      if (result === 'copied') {
        setToastVisible(true);
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        toastTimeout.current = setTimeout(() => setToastVisible(false), TOAST_MS);
      }
    } catch {
      // share.ts's own doc comment: a rejection here (no share API AND a
      // failing clipboard write) is "not swallowed... so the caller can
      // surface an error" — this is that surface. Quiet clinical register
      // (Act II), role="alert" (not "status" like the success toast): this
      // is a failure, not a passive confirmation.
      setShareFailed(true);
    }
  }

  const ms = msToNextLocalMidnight(now);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  return (
    <section className="ph-summary">
      <h2 className="ph-summary__title">{t('summary.invoiceTitle')}</h2>

      <table className="ph-summary__invoice">
        <tbody>
          {breakdown.map(([key, value], i) => (
            <tr className="ph-summary__row" key={`${key}-${i}`}>
              <th scope="row" className="ph-summary__label">
                {t(key)}
              </th>
              <td className="ph-summary__value" data-testid="invoice-row-value">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ph-summary__total">{t('summary.score', { score })}</p>

      <p className="ph-summary__streak">{t('summary.streak', { n: streak })}</p>

      <p className="ph-summary__countdown">{t('summary.nextIn', { hours, minutes })}</p>

      {/* T38 — the day's best beat, and until now the one it swallowed:
          persistAndComputeSummary computed `unlockedToday`, persisted it, and
          threw it away, so a player who had just earned "The One-Tailed
          Bandit" was told nothing. Rendered between the invoice and the share
          button, so the ceremony happens before you are invited to brag about
          it. Nothing at all on a day that unlocked nothing — an "achievements
          unlocked: none" line would be the opposite of a ceremony. */}
      {unlocked.length > 0 && (
        <div className="ph-summary__unlock">
          <h3 className="ph-summary__unlock-title">{t('summary.unlockedToday')}</h3>
          <ul className="ph-summary__unlock-list">
            {unlocked.map((award, i) => (
              <UnlockLine key={award.id} award={award} index={i} />
            ))}
          </ul>
        </div>
      )}

      <div className="ph-summary__share">
        {/* No aria-label here: the visible "Share" text (summary.share) is
            already an accurate, always-correct accessible name. a11y.shareButton
            ("Copy share result to clipboard") specifically names the CLIPBOARD
            path only — attaching it unconditionally would be misleading on
            the (preferred) navigator.share path, and ARIA's aria-label would
            override the visible text as the accessible name entirely, which
            is exactly the WCAG 2.5.3 "Label in Name" trap: an accessible name
            that doesn't even contain the visible label. */}
        <button type="button" className="ph-summary__share-button" onClick={() => void handleShare()}>
          {t('summary.share')}
        </button>
        {toastVisible && (
          <p role="status" aria-live="polite" className="ph-summary__toast">
            {t('summary.copied')}
          </p>
        )}
        {/* Same quiet, --muted styling as the success toast (DESIGN.md R1.3:
            --sig-red is reserved for exactly 4 places, none of which is a
            transient share-failure line) — only the ARIA role differs:
            "alert" for a failure, "status" for a passive confirmation. */}
        {shareFailed && (
          <p role="alert" className="ph-summary__toast">
            {t('summary.shareFailed')}
          </p>
        )}
      </div>

      {preregUnlocked && (
        <div className="ph-summary__prereg">
          <h3 className="ph-summary__prereg-title">{t('prereg.title')}</h3>
          <p className="ph-summary__prereg-body">{t('summary.preregUpsell')}</p>
          {/* T18 wires the actual mode switch (boot(client, iso, {mode:
              'prereg'})); this affordance is intentionally disabled-for-now —
              rendering the achievement-gated upsell is T17's whole job here. */}
          <button type="button" className="ph-summary__prereg-button" disabled>
            {t('summary.playPrereg')}
          </button>
        </div>
      )}
    </section>
  );
}

// --- persistAndComputeSummary (the store-reading wrapper's pure-ish core) --

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
  preregUnlocked: boolean;
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
 * Co-located with the `Summary` component (same tradeoff LocaleProvider.tsx
 * makes for its useLocale hook) so the persistence logic and the screen that
 * depends on it can't drift apart across files.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function persistAndComputeSummary(fields: FinishedGameFields): ComputedSummary {
  const { mode, practice, puzzleNumber, forks, published, call, dayType, stamp, log, copy, puzzleIso, resultLog, preregResult } =
    fields;

  const callCorrect = call !== null ? callIsCorrect(call, dayType) : null;
  const preregSig = mode === 'prereg' ? Boolean(preregResult && preregResult.valid && preregResult.p < 0.05) : undefined;
  const scoreResult = scoreDay({ mode, dayType, published, callCorrect, forks, stamp, preregSig });

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
  const { streak } = streakAfter(historyForStreak, puzzleIso);

  // Post-review fix: `callCorrect` is passed through AS-IS (never `?? false`)
  // — share.ts's own ShareStringInput.callCorrect is `boolean | null` exactly
  // so a real `null` (no call was ever made — every Prereg Mode day, since
  // §2.8 has no CALL step at all) reaches shareString and suppresses the
  // "→ ⚖️…" suffix entirely, rather than being coerced into a false "wrong
  // call" reading that every single prereg day previously got by construction.
  const shareText = shareString({ puzzleNumber, log, mode, callCorrect, streak, copy });

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
    unlockedToday = unlockAchievements({
      log,
      resultLog,
      history: state.history,
      call,
      callCorrect,
      mode,
      stamp,
    });
    saveAchievements(unlockedToday, puzzleIso);
  }

  return {
    breakdown: scoreResult.breakdown,
    score: scoreResult.score,
    streak,
    shareText,
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

/** Standalone, store-reading machine screen (T17 controller pin) — the
 * registry's ONE 'summary' screen. Reads the finished day's fields off the
 * store, persists + scores them exactly once per mount, and renders the
 * presentational `Summary` above. */
export default function SummaryScreen() {
  const { content, copy, t } = useLocale();
  const mode = useGameStore((s) => s.mode);
  const practice = useGameStore((s) => s.practice);
  const puzzleNumber = useGameStore((s) => s.puzzleNumber);
  const iso = useGameStore((s) => s.iso);
  const forks = useGameStore((s) => s.forks);
  const published = useGameStore((s) => s.published);
  const call = useGameStore((s) => s.call);
  const reveal = useGameStore((s) => s.reveal);
  const log = useGameStore((s) => s.log);
  const resultLog = useGameStore((s) => s.resultLog);
  // T18: the committed spec's own result, on prereg days — see
  // FinishedGameFields.preregResult's own doc comment for why this is passed
  // through unconditionally (it is a no-op on hack days: persistAndComputeSummary
  // never reads it outside mode === 'prereg').
  const preregResult = useGameStore((s) => s.preregResult);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const savedRef = useRef(false);
  const [computed, setComputed] = useState<ComputedSummary | null>(null);

  useEffect(() => {
    if (savedRef.current || !reveal || !copy) return;
    savedRef.current = true;
    setComputed(
      persistAndComputeSummary({
        mode,
        practice,
        puzzleNumber,
        forks,
        published: published !== null,
        call,
        dayType: reveal.dayType,
        stamp: reveal.stamp,
        log,
        copy,
        // The puzzle's OWN day (store.iso, set once by boot()) — never
        // localIsoDate() here (see persistAndComputeSummary's doc comment
        // and FinishedGameFields.puzzleIso for exactly why: a live
        // wall-clock read is the T17 review round-2 bug).
        puzzleIso: iso,
        resultLog,
        preregResult,
      })
    );
    // Deliberately NOT re-running on every store field change: this fires
    // once, guarded by savedRef, exactly when the reveal payload and copy
    // both first become available on this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, copy]);

  // `content` rather than `copy` (they are the same object's presence —
  // LocaleProvider derives `copy` as `content.copy`): T38 needs the
  // achievements bank below, and narrowing on the bundle itself is what makes
  // that read type-safe without a second guard.
  if (!content || !computed) {
    return <div className="ph-summary" aria-busy="true" data-testid="summary-loading" />;
  }

  return (
    <Summary
      t={t}
      breakdown={computed.breakdown}
      score={computed.score}
      streak={computed.streak}
      now={now}
      shareText={computed.shareText}
      preregUnlocked={computed.preregUnlocked}
      // T38: ids -> the locale's OWN name/citation, resolved here (§2.11's
      // award ceremony is content, not chrome — see UnlockedAchievement).
      // Order is unlockAchievements' order, preserved end to end.
      unlocked={computed.unlockedToday.map((id) => ({ id, ...content.achievements[id] }))}
    />
  );
}
