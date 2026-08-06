// T17 — Summary screen (master spec §2.8/§7.3): the score breakdown, styled
// as a journal fee invoice (Act I academia meets Act II accounting — DESIGN.md
// hairline table rules); the share button (navigator.share -> clipboard
// fallback -> a summary.copied toast, shown only for the clipboard path — the
// OS's own share sheet is already the confirmation for the other one); the
// streak strip; the countdown to next local midnight; T38's unlock block (the
// achievements TODAY earned, named and cited — DESIGN.md R5.2 site 9, and the
// screen's only entrance); the route back to the honours board the day just
// added to (gr6-062); and the achievement-gated Prereg Mode block (gr6-020 —
// no longer a permanently disabled button).
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
import { useAppNav } from '../nav';
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
  /** gr6-020 — whether a prereg day has ALREADY been played for this puzzle
   * date. The block below is an invitation to a mode; on the day that mode
   * was just played, and on any day it has already been spent, there is
   * nothing to invite. Defaults to false so every existing caller keeps its
   * behaviour. */
  preregPlayedToday?: boolean;
  /** gr6-018 — the day's career-points figure (`scoreDay`'s `career`), or
   * `null` on a Prereg Mode day, which has no career track at all (§2.8
   * lists it only among the Hacking Mode rows). Deliberately NOT a breakdown
   * row: career points are a separate cosmetic account and are never a
   * summand of `score`, so folding them into the invoice table would break
   * the "rows sum to the total" contract that makes the invoice honest. */
  career?: number | null;
  /** gr6-062 — the route to the honours board this day just added to. The
   * app shell owns page state (App.tsx's `setPage`), so the action is a
   * callback, and it renders ONLY when one is supplied: a screen with no
   * route to offer shows no control rather than a disabled one. */
  onViewStats?: () => void;
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
      className={entered ? 'ph-summary__unlock-item ph-entered' : 'ph-summary__unlock-item'}
      style={staggerStyle(index)}
      data-testid="unlock-item"
    >
      <p className="ph-summary__unlock-name">{award.name}</p>
      <p className="ph-summary__unlock-citation">{award.citation}</p>
    </li>
  );
}

export function Summary({
  t,
  breakdown,
  score,
  streak,
  now,
  shareText,
  preregUnlocked,
  preregPlayedToday = false,
  career = null,
  onViewStats,
  unlocked = [],
}: SummaryProps) {
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
    <section className="ph-page ph-summary">
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

      {/* gr6-018 — the career track, reconciled with the cover the player saw
          two screens ago. Its own line beside the total rather than a table
          row, deliberately: `career` is a separate cosmetic account (§2.8) and
          is never a summand of `score`, so it must not enter the invoice's
          "rows sum to the total" arithmetic. Rendered at its computed value
          including 0 — an invoice itemises what you did not earn too — and
          omitted entirely on a prereg day, which has no career track.

          RULED, NOT PENDING. This asked W2 for a summary-side key in invoice
          register ("Career points +25 — separate account"). W2 DECLINED, and
          the reasoning is recorded beside the key itself in en/copy.ts: this
          line exists to AGREE with the number the Published screen printed two
          screens earlier, and rendering the identical string is the strongest
          available form of that agreement — a second key would let the two
          drift silently, and the drift would land on the one figure §2.8 says
          is never a summand of the score. The register objection does not
          hold either, because gr6-018 renders career as its own LINE beside
          the total rather than as an invoice row, so it is not sitting among
          labelled rows asking to be labelled like one. Reusing
          `published.careerPoints` is therefore the answer, not a stand-in. */}
      {career !== null && (
        <p className="ph-summary__career" data-testid="summary-career">
          {t('published.careerPoints', { n: career })}
        </p>
      )}

      <p className="ph-summary__streak">{t('summary.streak', { n: streak })}</p>

      <p className="ph-summary__countdown">{t('summary.nextIn', { hours, minutes })}</p>

      {/* gr6-062 — the day ends where the day's reward is. The screen's last
          word used to be an upsell, with no route to the honours board it had
          just added to; getting to Stats meant going back up to the header.
          Rendered only when the shell hands down a route (App.tsx owns the
          nav page-state), so this is never the disabled control gr6-020 just
          removed from the block below.
          `summary.viewStats` ("See your stats") replaces the `nav.stats`
          placeholder this comment used to describe. The header's own tab says
          "Stats" because a tab in a row of tabs is a destination; this is an
          action at the end of a day, and it reads as one. The two are
          deliberately not the same string: they are not the same control, and
          a screen reader meeting the identical name twice on one screen would
          have no way to tell them apart. */}
      {onViewStats && (
        <div className="ph-summary__next">
          <button
            type="button"
            className="ph-summary__next-button ph-focusable"
            data-testid="summary-stats-action"
            onClick={onViewStats}
          >
            {t('summary.viewStats')}
          </button>
        </div>
      )}

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
          <h2 className="ph-summary__unlock-title ph-label">{t('summary.unlockedToday')}</h2>
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
        <button type="button" className="ph-summary__share-button ph-focusable" onClick={() => void handleShare()}>
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

      {/* gr6-020 — the block that announced Prereg Mode used to end in a
          permanently disabled "Try Prereg Mode" button, whose comment still
          claimed T18 would wire it. T18 shipped and wired the BRIEFING chooser
          instead; this control was never revisited, so the one screen that
          explains what Prereg Mode is offered a dead control and never said
          where the live entrance was. The CTA is gone rather than enabled:
          today's play is already spent, so it could only ever have meant
          "tomorrow", which is a sentence, not a destination. And the whole
          block is now gated on the day still HAVING a prereg play to offer —
          it used to render on prereg days too, advertising the mode the
          player had just finished.
          The missing sentence has landed, and it landed IN `summary.preregUpsell`
          rather than beside it: W2 rewrote the key's value in all three
          locales instead of adding a "replacement" key, so this block already
          renders the door it was failing to point at — "Preregistration is
          unlocked. Tomorrow you can choose it before you see a single
          number." Rewriting in place is the right shape here, because there
          was never a second thing to say; there was one sentence that stopped
          one clause short of the only question the block raises. */}
      {preregUnlocked && !preregPlayedToday && (
        <div className="ph-summary__prereg">
          <h2 className="ph-summary__prereg-title">{t('prereg.title')}</h2>
          <p className="ph-summary__prereg-body">{t('summary.preregUpsell')}</p>
        </div>
      )}
    </section>
  );
}

export interface SummaryScreenProps {
  /** gr6-062 — handed down by the app shell, which owns the nav page-state
   * (App.tsx's `setPage`). Optional so the screen still renders standalone
   * (the registry types every screen as a bare `ComponentType`); when it is
   * absent the "your stats" action is simply not rendered, never rendered
   * dead.
   *
   * W7 WIRED IT (gr6-062 closed). The chain is not a prop threaded through
   * `registry.ts` — that file types every screen as a bare `ComponentType`,
   * so there is nowhere to thread one — but `src/ui/nav.ts`'s context, which
   * App.tsx provides around <main> with `viewStats: () => setPage('stats')`.
   * This prop stays as the explicit override the tests already use; the
   * context is the fallback, and when NEITHER is supplied (a screen rendered
   * outside the shell) the action is still simply not rendered. */
  onViewStats?: () => void;
}

/** Standalone, store-reading machine screen (T17 controller pin) — the
 * registry's ONE 'summary' screen. Reads the finished day's fields off the
 * store, persists + scores them exactly once per mount, and renders the
 * presentational `Summary` above. */
export default function SummaryScreen({ onViewStats }: SummaryScreenProps = {}) {
  const { content, copy, t } = useLocale();
  // The shell's route, when there is a shell (see src/ui/nav.ts). An explicit
  // prop still wins, which is what keeps every existing caller and test
  // unchanged.
  const nav = useAppNav();
  const viewStats = onViewStats ?? nav?.viewStats;
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
    return <div className="ph-page ph-summary" aria-busy="true" data-testid="summary-loading" />;
  }

  return (
    <Summary
      t={t}
      breakdown={computed.breakdown}
      score={computed.score}
      streak={computed.streak}
      now={now}
      shareText={computed.shareText}
      career={computed.career}
      preregUnlocked={computed.preregUnlocked}
      preregPlayedToday={computed.preregPlayedToday}
      onViewStats={viewStats}
      // T38: ids -> the locale's OWN name/citation, resolved here (§2.11's
      // award ceremony is content, not chrome — see UnlockedAchievement).
      // Order is unlockAchievements' order, preserved end to end.
      unlocked={computed.unlockedToday.map((id) => ({ id, ...content.achievements[id] }))}
    />
  );
}
