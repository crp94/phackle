// T17 — Stats nav page (master spec §2.8/§7.3): call accuracy (all-time +
// rolling-20), the prereg-vs-hacking "success" rate comparison that makes α
// visible (ALWAYS both panels, even at zero prereg days — the juxtaposition
// IS the lesson), a fork histogram as plain CSS bars (no chart lib), and the
// achievement wall (locked = an embossed blind stamp that leaks no name).
import { useState } from 'react';
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
    <section className="ph-stats">
      <h2 className="ph-stats__title">{t('stats.title')}</h2>

      <dl className="ph-stats__summary">
        <div className="ph-stats__stat">
          <dt>{t('stats.played')}</dt>
          <dd>{played}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt>{t('stats.currentStreak')}</dt>
          <dd>{stats.streak}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt>{t('stats.maxStreak')}</dt>
          <dd>{stats.maxStreak}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt>{t('stats.callAccuracy')}</dt>
          <dd>{formatPct(allTimeAccuracy, t)}</dd>
        </div>
        <div className="ph-stats__stat">
          <dt>{t('stats.callAccuracyLast20')}</dt>
          <dd>{formatPct(rolling, t)}</dd>
        </div>
      </dl>

      <h3 className="ph-stats__subtitle">{t('stats.successRateTitle')}</h3>
      {/* ALWAYS both panels, even with zero prereg days: the juxtaposition
          IS the α lesson (§2.8) — an empty mode is an em-dash, never a
          hidden panel. */}
      <div className="ph-stats__success">
        <div className="ph-stats__success-panel" data-testid="success-panel-hack">
          <p className="ph-stats__success-label">{t('stats.hackModeLabel')}</p>
          <p className="ph-stats__success-value">{formatPct(hackRate, t)}</p>
        </div>
        <div className="ph-stats__success-panel" data-testid="success-panel-prereg">
          <p className="ph-stats__success-label">{t('stats.preregModeLabel')}</p>
          <p className="ph-stats__success-value">{formatPct(preregRate, t)}</p>
        </div>
      </div>

      <h3 className="ph-stats__subtitle">{t('stats.forkHistogramTitle')}</h3>
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
                  registered --sig-band fill. */}
              <span
                className="ph-stats__hist-bar"
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

      <h3 className="ph-stats__subtitle">{t('stats.achievementsTitle')}</h3>
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
                <span className="ph-stats__ach-locked" aria-label={t('stats.locked')}>
                  <span aria-hidden="true">▦▦▦</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {onClose && (
        <button type="button" className="ph-stats__close" onClick={onClose} aria-label={t('a11y.closeDialog')}>
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
