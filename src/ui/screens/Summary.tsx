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
import { useLocale } from '../../i18n/LocaleProvider';
import type { CopyKey } from '../../content/en/copy';
import type { TFunction } from '../../i18n/t';
import type { AchievementId, LocaleContent } from '../../content/types';
// gr6-081: the day's persistence moment lives in src/game/dayComplete.ts —
// it is framework-free, and it always was. This screen consumes it.
import { persistAndComputeSummary, type ComputedSummary } from '../../game/dayComplete';
import { shareViaNavigator } from '../../game/share';
import { msToNextLocalMidnight } from '../../game/daily';
import { staggerStyle, useEnterOnce } from '../hooks/useEnterOnce';
import './Summary.css';

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
      {/* T22: <h1>. Each screen of this single-page app is its own document to
          assistive technology (App.tsx rebuilds <main> on every swap), so the
          screen's own title is its level-one heading and the unlock/prereg
          blocks below stay at level 2. Semantics only — .ph-summary__title
          declares every type value itself. */}
      <h1 className="ph-summary__title">{t('summary.invoiceTitle')}</h1>

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
      {/* T22 (booked item d) — NO LIVE REGION HERE, and the assumption that
          makes that correct, pinned so a later change cannot quietly break it:
          this block is present in the screen's FIRST rendered output, not
          inserted into a screen the player is already reading. `unlocked` is
          computed once, in SummaryScreen's own mount effect, before this
          component renders anything but its aria-busy placeholder; nothing
          afterwards can add to it. App.tsx moves focus to <main> on the
          reveal -> summary swap, so a screen reader reads this screen from the
          top and reaches the ceremony in document order, between the invoice
          and the share button, exactly as a sighted player does. A live region
          would announce it a SECOND time, out of order, on top of that read.
          If a future task ever unlocks an achievement while this screen is
          already on screen, that is the change that needs role="status" —
          nothing before it does. */}
      {unlocked.length > 0 && (
        <div className="ph-summary__unlock">
          <h2 className="ph-summary__unlock-title">{t('summary.unlockedToday')}</h2>
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
          <h2 className="ph-summary__prereg-title">{t('prereg.title')}</h2>
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
