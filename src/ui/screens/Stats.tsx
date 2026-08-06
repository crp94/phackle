// T17 — Stats nav page (master spec §2.8/§7.3): call accuracy (all-time +
// rolling-20), the prereg-vs-hacking "success" rate comparison that makes α
// visible (ALWAYS both panels, even at zero prereg days — the juxtaposition
// IS the lesson), a fork histogram as plain CSS bars (no chart lib), and the
// achievement wall (locked = an embossed blind stamp that leaks no name).
import { useId, useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { CopyKey } from '../../content/en/copy';
import type { AchievementId } from '../../content/types';
import { loadState, type PersistedStats } from '../../game/storage';
import { modeSuccessRate, recordsForMode, rollingCallAccuracy, type ModeHistory } from '../../game/statsAgg';
import './Stats.css';

type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

const ROLLING_WINDOW = 20;

/** `null` (no data yet) renders the always-visible em-dash (`stats.noData`);
 * a real number renders as a whole-percent string. Percent formatting is a
 * numeral, not prose — same "handled by content modules, not the copy
 * catalog" bucket as decimals/DOIs (see copy.ts's own header comment). */
function formatPct(value: number | null, t: TFunction): string {
  return value === null ? t('stats.noData') : `${Math.round(value * 100)}%`;
}

export interface StatsProps {
  t: TFunction;
  stats: PersistedStats;
  history: ModeHistory;
  achievements: Partial<Record<AchievementId, string>>;
  achievementDefs: Record<AchievementId, { name: string; citation: string }>;
  onClose?: () => void;
}

export function Stats({ t, stats, history, achievements, achievementDefs, onClose }: StatsProps) {
  const titleId = useId();
  const played = stats.hackDays + stats.preregDays;
  const allTimeAccuracy = stats.callsTotal === 0 ? null : stats.callsCorrect / stats.callsTotal;
  const rolling = rollingCallAccuracy(history, ROLLING_WINDOW);
  const hackRate = modeSuccessRate(recordsForMode(history, 'hack'));
  const preregRate = modeSuccessRate(recordsForMode(history, 'prereg'));
  const maxForkCount = Math.max(1, ...stats.forkHistogram);
  // Insertion order of the Record literal in content/en/index.ts matches the
  // master spec §2.11 table's own order exactly (First Blood ... True
  // Detective) — no separate ordering list to keep in sync.
  const achievementIds = Object.keys(achievementDefs) as AchievementId[];

  return (
    // T22: a NAMED region, and an <h1> to name it with. The three nav pages
    // replace <main>'s whole content, so each is its own document to
    // assistive technology and each needs its own level-one heading (they all
    // started at level 2 with no level 1 on the page). Naming the <section>
    // from that heading additionally exposes it as a landmark, which is what
    // gives the plain "Close" button below the context its old aria-label was
    // faking.
    <section className="ph-page ph-stats" aria-labelledby={titleId}>
      <h1 className="ph-stats__title" id={titleId}>
        {t('stats.title')}
      </h1>

      <dl className="ph-stats__summary">
        <div className="ph-stats__stat">
          <dt className="ph-label">{t('stats.played')}</dt>
          <dd>{played}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt className="ph-label">{t('stats.currentStreak')}</dt>
          <dd>{stats.streak}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt className="ph-label">{t('stats.maxStreak')}</dt>
          <dd>{stats.maxStreak}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt className="ph-label">{t('stats.callAccuracy')}</dt>
          <dd>{formatPct(allTimeAccuracy, t)}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt className="ph-label">{t('stats.callAccuracyLast20')}</dt>
          <dd>{formatPct(rolling, t)}</dd>
        </div>
      </dl>

      <h2 className="ph-stats__subtitle">{t('stats.successRateTitle')}</h2>
      {/* ALWAYS both panels, even with zero prereg days: the juxtaposition
          IS the α lesson (§2.8) — an empty mode is an em-dash, never a
          hidden panel. */}
      <div className="ph-stats__success">
        <div className="ph-stats__success-panel" data-testid="success-panel-hack">
          <p className="ph-stats__success-label ph-label">{t('stats.hackModeLabel')}</p>
          <p className="ph-stats__success-value">{formatPct(hackRate, t)}</p>
        </div>
        <div className="ph-stats__success-panel" data-testid="success-panel-prereg">
          <p className="ph-stats__success-label ph-label">{t('stats.preregModeLabel')}</p>
          <p className="ph-stats__success-value">{formatPct(preregRate, t)}</p>
        </div>
      </div>

      <h2 className="ph-stats__subtitle">{t('stats.forkHistogramTitle')}</h2>
      {stats.forkHistogram.length === 0 ? (
        <p className="ph-stats__empty" data-testid="fork-histogram-empty">
          {t('stats.noData')}
        </p>
      ) : (
        <ul className="ph-stats__histogram" role="list">
          {stats.forkHistogram.map((count, forks) => (
            <li className="ph-stats__hist-row" key={forks}>
              <span className="ph-stats__hist-label">{forks}</span>
              {/* CSS bar, DESIGN.md R4.1: no background/fill anywhere — the
                  "bar" is a 2px --ink border (the same sanctioned stroke
                  weight R4.6 uses for a selected segment), never a filled
                  rectangle, so this never competes with SpecCurve's single
                  registered --sig-band fill.

                  T22: role="img". A bare <span> maps to `generic`, a role
                  that PROHIBITS an accessible name, so this aria-label was
                  silently dropped by the accessibility tree (axe
                  `aria-prohibited-attr`, serious) — and the label is the only
                  place the bar's meaning exists, since the count beside it is
                  aria-hidden. role="img" is what the element actually is: a
                  graphic whose whole content is its text alternative. */}
              <span
                className="ph-stats__hist-bar"
                role="img"
                style={{ width: `${(count / maxForkCount) * 100}%` }}
                aria-label={t('stats.forkHistogramBar', { forks, count })}
              />
              <span className="ph-stats__hist-count" aria-hidden="true">
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="ph-stats__subtitle">{t('stats.achievementsTitle')}</h2>
      <ul className="ph-stats__achievements" role="list">
        {achievementIds.map((id) => {
          const unlocked = achievements[id] !== undefined;
          return (
            <li className="ph-stats__ach" key={id} data-testid="achievement-row">
              {unlocked ? (
                <>
                  <strong className="ph-stats__ach-name">
                    {/* R1.6: gold marks (non-text) are sanctioned here by
                        name — "the achievement-wall glyph strokes" — the
                        NAME text itself uses --hack-gold-ink (R1.6: gold a
                        reader must read is never raw --hack-gold). */}
                    <span className="ph-stats__ach-mark" aria-hidden="true">
                      ★
                    </span>
                    {achievementDefs[id].name}
                  </strong>
                  <span className="ph-stats__ach-citation">{achievementDefs[id].citation}</span>
                </>
              ) : (
                // Embossed blind stamp: NEITHER the id's name NOR its
                // citation appears anywhere here — only the generic
                // stats.locked aria text and a decorative glyph.
                //
                // T22: role="img", for the same reason as the histogram bar
                // above — aria-label on a role-less <span> is prohibited and
                // was being discarded, which left every locked row announcing
                // nothing at all (its only other content is aria-hidden). The
                // blind stamp IS an image; saying so is what makes its one
                // sanctioned, name-free text alternative reach a reader.
                //
                // gr6-013 — `▦▦▦` READ AS BROKEN GLYPHS, six rows deep. The
                // blind-stamp idea was right and its execution was a tofu
                // box: U+25A6 has no coverage in either shipped face
                // (DESIGN.md R2.1 vendors STIX Two Text + JetBrains Mono,
                // latin and latin-ext only), so the fallback chain decided
                // what a locked award looked like, and on the measured build
                // it looked like a font that had failed. The row keeps the
                // name-free contract exactly — no id, no name, no citation,
                // the same `stats.locked` label — and borrows the UNLOCKED
                // row's anatomy instead of inventing a texture: the mark
                // column takes ☆, the outline of the ★ beside it, and the
                // name column takes a --muted rule where the name will go.
                // An award you have not won, drawn in the same hand as the
                // ones you have; and both glyphs are in the vendored latin
                // range, so what ships is what renders.
                <span className="ph-stats__ach-locked" role="img" aria-label={t('stats.locked')}>
                  <span className="ph-stats__ach-mark ph-stats__ach-mark--locked" aria-hidden="true">
                    ☆
                  </span>
                  <span className="ph-stats__ach-blank" aria-hidden="true" />
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* T22: no aria-label. This carried a11y.closeDialog ("Close dialog"),
          and this is not a dialog — it is a nav page that replaces <main>'s
          content, with no modality, no focus trap and nothing for Escape to
          do. Telling a screen-reader user otherwise promises behaviour that
          does not exist. The visible "Close" is an accurate accessible name
          on its own, and the labelled region above supplies the context the
          false label was standing in for. */}
      {onClose && (
        <button type="button" className="ph-stats__close ph-focusable" onClick={onClose}>
          {t('stats.close')}
        </button>
      )}
    </section>
  );
}

/** Standalone nav-page wrapper — a NAV page, not a machine screen. Reads
 * localStorage directly (freshly, on every mount, so revisiting Stats always
 * shows the latest saved state) and the locale's achievement definitions;
 * everything else is pure props on `Stats` above. */
export default function StatsScreen({ onClose }: { onClose?: () => void }) {
  const { copy, t, content } = useLocale();
  const [state] = useState(() => loadState());
  if (!copy || !content) return <div aria-busy="true" data-testid="stats-loading" />;
  return (
    <Stats
      t={t}
      stats={state.stats}
      history={state.history}
      achievements={state.achievements}
      achievementDefs={content.achievements}
      onClose={onClose}
    />
  );
}
