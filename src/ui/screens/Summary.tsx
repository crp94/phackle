// T17 — Summary screen (master spec §2.8/§7.3): the score breakdown, styled
// as a journal fee invoice (Act I academia meets Act II accounting — DESIGN.md
// hairline table rules); the share button (navigator.share -> clipboard
// fallback -> a summary.copied toast, shown only for the clipboard path — the
// OS's own share sheet is already the confirmation for the other one); the
// streak strip; the countdown to next local midnight; and a (currently
// disabled-for-now, achievement-gated) Prereg Mode upsell.
//
// A "standalone store-reading screen" (T17 controller pin): the default
// export reads the game store + storage/locale directly. The named `Summary`
// export is the pure presentational half, driven entirely by props, so the
// invoice/countdown/share/upsell logic is directly unit-testable without
// touching zustand or React context at all (tests/ui/summary.test.tsx).
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../game/store';
import { useLocale } from '../../i18n/LocaleProvider';
import type { CopyKey } from '../../content/en/copy';
import type { DayType, PlayerAction, RevealMetrics } from '../../engine/types';
import { callIsCorrect, scoreDay } from '../../game/scoring';
import { loadState, saveDay, streakAfter } from '../../game/storage';
import { shareString, shareViaNavigator } from '../../game/share';
import { localIsoDate, msToNextLocalMidnight } from '../../game/daily';
import './Summary.css';

type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

// How long the clipboard-fallback "Copied to clipboard" toast stays up.
// Appears/disappears instantly (no transition) — a fifth CSS animation would
// violate DESIGN.md §5's exhaustive four-animation motion budget.
const TOAST_MS = 3000;
// How often the countdown's displayed hours/minutes are refreshed. A plain
// text update on an interval, not a CSS animation/transition, so it isn't a
// 5th entry in that same budget.
const COUNTDOWN_REFRESH_MS = 30_000;

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
}

export function Summary({ t, breakdown, score, streak, now, shareText, preregUnlocked }: SummaryProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
  }, []);

  async function handleShare() {
    const result = await shareViaNavigator(shareText);
    // Only the clipboard path gets a toast — navigator.share already shows
    // the OS's own share sheet, which is its own confirmation.
    if (result === 'copied') {
      setToastVisible(true);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setToastVisible(false), TOAST_MS);
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
  /** localIsoDate(), passed in rather than computed here so this whole
   * function stays a deterministic function of its arguments — no wall
   * clock read buried inside it (easy to unit test any date). */
  todayIso: string;
}

export interface ComputedSummary {
  breakdown: [CopyKey, number][];
  score: number;
  streak: number;
  shareText: string;
  preregUnlocked: boolean;
}

/**
 * Turns one finished day into the numbers Summary renders, AND is the one
 * place in the app that actually persists it (§5.6) — flagged as an open
 * seam by T13's own report ("a natural seam for whichever task ... wires
 * Reveal -> Summary"). Not itself idempotent against being CALLED twice for
 * the same day (storage.ts's stats fields are running increments, not an
 * upsert) — SummaryScreen below guards that with a mount-scoped ref, which
 * covers the realistic risk (React StrictMode's dev-only double-effect); a
 * genuine full page reload resets the whole in-memory game store back to
 * 'briefing' anyway, so there is no path back to 'summary' for the same
 * finished day without replaying it.
 *
 * Prereg Mode's own flow (commit-before-data, no significance gate on
 * submit — unlike Hacking Mode, where store.submit() only ever fires once
 * p < .05, which is exactly why verdictStamp's RETRACTED/REPLICATED pair is
 * a safe read of "was published" for hack records) isn't wired yet (T18).
 * `verdictStamp` has no notion of "committed but non-significant," so
 * `preregSig` is approximated here as "stamp !== NULL_REPORTED" until a real
 * prereg RevealPayload contract exists — see the T17 report's concerns
 * section. This only affects a mode nothing can reach yet (no UI sets
 * mode: 'prereg' before T18 lands a chooser), so the approximation's blast
 * radius today is zero.
 *
 * Co-located with the `Summary` component (same tradeoff LocaleProvider.tsx
 * makes for its useLocale hook) so the persistence logic and the screen that
 * depends on it can't drift apart across files.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function persistAndComputeSummary(fields: FinishedGameFields): ComputedSummary {
  const { mode, practice, puzzleNumber, forks, published, call, dayType, stamp, log, copy, todayIso } = fields;

  const callCorrect = call !== null ? callIsCorrect(call, dayType) : null;
  const preregSig = mode === 'prereg' ? stamp !== 'NULL_REPORTED' : undefined;
  const scoreResult = scoreDay({ mode, dayType, published, callCorrect, forks, stamp, preregSig });

  const state = loadState();

  // The resulting streak (INCLUDING today) is needed before the DayRecord
  // can be built (its shareString embeds it) — computed by mirroring
  // storage.ts's own saveDay history-merge via the already-exported
  // streakAfter, rather than calling saveDay first and reading its result
  // back (which would need a second, redundant persistState round-trip).
  const placeholderRec = { mode, score: 0, forks: 0, stamp, shareString: '' };
  const mergedHistory = { ...state.history, [todayIso]: { ...state.history[todayIso], [mode]: placeholderRec } };
  const { streak } = streakAfter(mergedHistory, todayIso);

  const shareText = shareString({ puzzleNumber, log, mode, callCorrect: callCorrect ?? false, streak, copy });

  if (!practice) {
    saveDay(todayIso, {
      mode,
      score: scoreResult.score,
      forks,
      callCorrect: callCorrect ?? undefined,
      stamp,
      shareString: shareText,
    });
  }

  return {
    breakdown: scoreResult.breakdown,
    score: scoreResult.score,
    streak,
    shareText,
    // Achievement UNLOCKING isn't wired yet either (same T13-flagged seam) —
    // this only ever READS whatever is already in storage, so the upsell
    // stays correctly dormant until a future task starts writing it.
    preregUnlocked: state.achievements.first_retraction !== undefined,
  };
}

/** Standalone, store-reading machine screen (T17 controller pin) — the
 * registry's ONE 'summary' screen. Reads the finished day's fields off the
 * store, persists + scores them exactly once per mount, and renders the
 * presentational `Summary` above. */
export default function SummaryScreen() {
  const { copy, t } = useLocale();
  const mode = useGameStore((s) => s.mode);
  const practice = useGameStore((s) => s.practice);
  const puzzleNumber = useGameStore((s) => s.puzzleNumber);
  const forks = useGameStore((s) => s.forks);
  const published = useGameStore((s) => s.published);
  const call = useGameStore((s) => s.call);
  const reveal = useGameStore((s) => s.reveal);
  const log = useGameStore((s) => s.log);

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
        todayIso: localIsoDate(),
      })
    );
    // Deliberately NOT re-running on every store field change: this fires
    // once, guarded by savedRef, exactly when the reveal payload and copy
    // both first become available on this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, copy]);

  if (!copy || !computed) {
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
    />
  );
}
