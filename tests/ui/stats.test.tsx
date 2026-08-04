// @vitest-environment jsdom
//
// T17: the Stats nav page — call accuracy (all-time + rolling-20),
// prereg-vs-hacking "success" rates ALWAYS both visible (§2.8's α lesson —
// the juxtaposition is the point, so an empty mode renders an em-dash, never
// a hidden panel), a CSS-only fork histogram, and the achievement wall
// (locked = no name/citation leak, ever).
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { afterEach } from 'vitest';
import { Stats } from '../../src/ui/screens/Stats';
import type { PersistedStats } from '../../src/game/storage';
import type { ModeHistory } from '../../src/game/statsAgg';
import type { AchievementId } from '../../src/content/types';
import { copy as enCopy } from '../../src/content/en/copy';
import { content as enContent } from '../../src/content/en';
import { t as translate } from '../../src/i18n/t';

afterEach(() => cleanup());

const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate(enCopy, key, params);

function baseStats(overrides: Partial<PersistedStats> = {}): PersistedStats {
  return {
    streak: 0,
    maxStreak: 0,
    callsCorrect: 0,
    callsTotal: 0,
    careerPoints: 0,
    preregDays: 0,
    hackDays: 0,
    forkHistogram: [],
    ...overrides,
  };
}

describe('Stats — summary numbers', () => {
  it('renders played (hack+prereg days), current/max streak, and all-time call accuracy', () => {
    const stats = baseStats({ hackDays: 7, preregDays: 3, streak: 4, maxStreak: 9, callsCorrect: 6, callsTotal: 8 });
    render(<Stats t={t} stats={stats} history={{}} achievements={{}} achievementDefs={enContent.achievements} />);
    expect(screen.getByText('10')).toBeTruthy(); // played = 7+3
    expect(screen.getByText('4')).toBeTruthy(); // current streak
    expect(screen.getByText('9')).toBeTruthy(); // max streak
    expect(screen.getByText('75%')).toBeTruthy(); // 6/8 all-time
  });

  it('shows the em-dash for all-time accuracy when no call has ever been made', () => {
    render(<Stats t={t} stats={baseStats()} history={{}} achievements={{}} achievementDefs={enContent.achievements} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders rolling-20 call accuracy from history, distinct from the all-time figure', () => {
    // 25-day fixture (same shape as statsAgg.test.ts): first 5 correct, last
    // 20 wrong -> all-time 20/25=80% wrong is NOT what's asserted here; we
    // assert the ROLLING (last-20) figure specifically renders as 0%, while
    // the all-time figure (from `stats`, independent of history) is passed as 100%.
    const history: ModeHistory = {};
    for (let d = 1; d <= 25; d++) {
      const iso = `2026-08-${String(d).padStart(2, '0')}`;
      history[iso] = { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'RETRACTED', shareString: '', callCorrect: d <= 5 } };
    }
    const stats = baseStats({ callsCorrect: 5, callsTotal: 25 });
    render(<Stats t={t} stats={stats} history={history} achievements={{}} achievementDefs={enContent.achievements} />);
    expect(screen.getByText('20%')).toBeTruthy(); // all-time 5/25
    expect(screen.getByText('0%')).toBeTruthy(); // rolling-20 (days 6-25, all wrong)
  });
});

describe('Stats — prereg-vs-hacking success rates, ALWAYS both panels (the α lesson)', () => {
  it('renders both panel labels even with a completely empty history', () => {
    render(<Stats t={t} stats={baseStats()} history={{}} achievements={{}} achievementDefs={enContent.achievements} />);
    expect(screen.getByText(t('stats.hackModeLabel'))).toBeTruthy();
    expect(screen.getByText(t('stats.preregModeLabel'))).toBeTruthy();
  });

  it('shows a real percentage for hacking mode and the em-dash for prereg when zero prereg days exist (never hides the prereg panel)', () => {
    const history: ModeHistory = {
      '2026-08-01': { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'REPLICATED', shareString: '' } },
      '2026-08-02': { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'RETRACTED', shareString: '' } },
    };
    render(<Stats t={t} stats={baseStats()} history={history} achievements={{}} achievementDefs={enContent.achievements} />);
    const hackPanel = screen.getByTestId('success-panel-hack');
    const preregPanel = screen.getByTestId('success-panel-prereg');
    expect(within(hackPanel).getByText('100%')).toBeTruthy();
    expect(within(preregPanel).getByText('—')).toBeTruthy();
    // The panel itself is still in the document, not conditionally omitted.
    expect(preregPanel).toBeTruthy();
  });

  it('renders distinct hack vs prereg rates when both exist (the collapse from ~100% to a real rate)', () => {
    const history: ModeHistory = {
      '2026-08-01': { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'REPLICATED', shareString: '' } },
      '2026-08-02': { prereg: { mode: 'prereg', score: 0, forks: 0, stamp: 'NULL_REPORTED', shareString: '' } },
      '2026-08-03': { prereg: { mode: 'prereg', score: 0, forks: 0, stamp: 'NULL_REPORTED', shareString: '' } },
    };
    render(<Stats t={t} stats={baseStats()} history={history} achievements={{}} achievementDefs={enContent.achievements} />);
    expect(within(screen.getByTestId('success-panel-hack')).getByText('100%')).toBeTruthy();
    expect(within(screen.getByTestId('success-panel-prereg')).getByText('0%')).toBeTruthy();
  });
});

describe('Stats — fork histogram, CSS bars only (no chart lib)', () => {
  it('renders one row per fork count with an accessible label combining forks and day count', () => {
    const stats = baseStats({ forkHistogram: [2, 5, 0, 1] });
    render(<Stats t={t} stats={stats} history={{}} achievements={{}} achievementDefs={enContent.achievements} />);
    expect(screen.getByLabelText(t('stats.forkHistogramBar', { forks: 0, count: 2 }))).toBeTruthy();
    expect(screen.getByLabelText(t('stats.forkHistogramBar', { forks: 1, count: 5 }))).toBeTruthy();
    expect(screen.getByLabelText(t('stats.forkHistogramBar', { forks: 2, count: 0 }))).toBeTruthy();
    expect(screen.getByLabelText(t('stats.forkHistogramBar', { forks: 3, count: 1 }))).toBeTruthy();
  });

  it('sizes the largest bar at 100% width and scales the rest relative to it', () => {
    const stats = baseStats({ forkHistogram: [2, 8] });
    render(<Stats t={t} stats={stats} history={{}} achievements={{}} achievementDefs={enContent.achievements} />);
    const big = screen.getByLabelText(t('stats.forkHistogramBar', { forks: 1, count: 8 }));
    const small = screen.getByLabelText(t('stats.forkHistogramBar', { forks: 0, count: 2 }));
    expect(big.style.width).toBe('100%');
    expect(small.style.width).toBe('25%');
  });

  it('declares no background/fill on the bar element itself (DESIGN.md R4.1: exactly one filled area exists in the whole product, and it is not this)', () => {
    const stats = baseStats({ forkHistogram: [3] });
    render(<Stats t={t} stats={stats} history={{}} achievements={{}} achievementDefs={enContent.achievements} />);
    const bar = screen.getByLabelText(t('stats.forkHistogramBar', { forks: 0, count: 3 }));
    expect(bar.style.background).toBe('');
    expect(bar.style.backgroundColor).toBe('');
  });

  it('shows the em-dash empty state when nothing has ever been played', () => {
    render(<Stats t={t} stats={baseStats({ forkHistogram: [] })} history={{}} achievements={{}} achievementDefs={enContent.achievements} />);
    expect(screen.getByTestId('fork-histogram-empty').textContent).toBe('—');
  });
});

describe('Stats — achievement wall: unlocked shows name+citation, locked leaks nothing', () => {
  const achievements: Partial<Record<AchievementId, string>> = { first_blood: '2026-08-01' };

  it('shows the real name and citation for an unlocked achievement', () => {
    render(<Stats t={t} stats={baseStats()} history={{}} achievements={achievements} achievementDefs={enContent.achievements} />);
    expect(screen.getByText(enContent.achievements.first_blood.name)).toBeTruthy();
    expect(screen.getByText(enContent.achievements.first_blood.citation)).toBeTruthy();
  });

  it('never renders a locked achievement\'s name or citation text anywhere in the DOM', () => {
    const { container } = render(
      <Stats t={t} stats={baseStats()} history={{}} achievements={achievements} achievementDefs={enContent.achievements} />
    );
    // first_retraction is NOT in `achievements` above -> locked.
    expect(container.textContent).not.toContain(enContent.achievements.first_retraction.name);
    expect(container.textContent).not.toContain(enContent.achievements.first_retraction.citation);
    expect(container.textContent).not.toContain(enContent.achievements.true_detective.name);
  });

  it('labels each locked achievement with the stats.locked aria text, with no other accessible name leaking it', () => {
    render(<Stats t={t} stats={baseStats()} history={{}} achievements={achievements} achievementDefs={enContent.achievements} />);
    const locked = screen.getAllByLabelText(t('stats.locked'));
    // 11 total achievements, 1 unlocked (first_blood) -> 10 locked entries.
    expect(locked).toHaveLength(10);
  });

  it('renders all 11 achievement slots regardless of how many are unlocked', () => {
    const { container } = render(
      <Stats t={t} stats={baseStats()} history={{}} achievements={{}} achievementDefs={enContent.achievements} />
    );
    expect(container.querySelectorAll('[data-testid="achievement-row"]')).toHaveLength(11);
  });
});

describe('Stats — close affordance', () => {
  // T22: named by its own visible label, not by a11y.closeDialog — a nav page
  // is not a dialog. See tests/ui/legend.test.tsx for the full note.
  it('calls onClose when the close button is activated', () => {
    const onClose = vi.fn();
    render(<Stats t={t} stats={baseStats()} history={{}} achievements={{}} achievementDefs={enContent.achievements} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: t('stats.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
