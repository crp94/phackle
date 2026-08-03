// @vitest-environment jsdom
//
// T17: the Summary screen — the score invoice (styled as a journal fee
// invoice, DESIGN.md hairline table rules), the share button (navigator.share
// -> clipboard fallback -> summary.copied toast), the streak strip, the
// countdown to next local midnight, and the (disabled-for-now,
// achievement-gated) Prereg Mode upsell. jsdom pragma because
// persistAndComputeSummary touches localStorage (via storage.ts) — same
// convention as tests/game/storage.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Summary, persistAndComputeSummary } from '../../src/ui/screens/Summary';
import { scoreDay } from '../../src/game/scoring';
import { copy as enCopy } from '../../src/content/en/copy';
import { t as translate } from '../../src/i18n/t';
import type { PersistedState } from '../../src/game/storage';

const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate(enCopy, key, params);

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function freshV1(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    version: 1,
    history: {},
    stats: {
      streak: 0,
      maxStreak: 0,
      callsCorrect: 0,
      callsTotal: 0,
      careerPoints: 0,
      preregDays: 0,
      hackDays: 0,
      forkHistogram: [],
    },
    achievements: {},
    settings: {},
    ...overrides,
  };
}

function seedStorage(state: PersistedState) {
  window.localStorage.setItem('phackle.v1', JSON.stringify(state));
}

// --- Summary (presentational): the invoice ----------------------------------

describe('Summary — invoice rows sum to the total score (3 scoreDay fixtures)', () => {
  const now = new Date(2026, 7, 10, 20, 0, 0, 0);

  const fixtures = [
    scoreDay({ mode: 'hack', dayType: 'effect', published: true, callCorrect: true, forks: 3, stamp: 'REPLICATED' }),
    scoreDay({ mode: 'hack', dayType: 'null', published: false, callCorrect: true, forks: 0, stamp: 'NULL_REPORTED' }),
    scoreDay({
      mode: 'prereg',
      dayType: 'effect',
      published: true,
      callCorrect: null,
      forks: 0,
      stamp: 'REPLICATED',
      preregSig: true,
    }),
  ];

  it.each(fixtures.map((r, i) => [i, r] as const))('fixture %i: rendered row values sum exactly to the displayed score', (_i, result) => {
    const { unmount } = render(
      <Summary
        t={t}
        breakdown={result.breakdown}
        score={result.score}
        streak={1}
        now={now}
        shareText="x"
        preregUnlocked={false}
      />
    );
    const rowValues = screen.getAllByTestId('invoice-row-value').map((el) => Number(el.textContent));
    expect(rowValues.reduce((a, b) => a + b, 0)).toBe(result.score);
    expect(rowValues).toHaveLength(result.breakdown.length);
    unmount();
  });

  it('renders one invoice row per breakdown entry, labelled by its CopyKey', () => {
    const result = fixtures[0];
    render(
      <Summary t={t} breakdown={result.breakdown} score={result.score} streak={1} now={now} shareText="x" preregUnlocked={false} />
    );
    for (const [key] of result.breakdown) {
      expect(screen.getByText(t(key))).toBeTruthy();
    }
  });

  it('renders the total via the existing summary.score key', () => {
    const result = fixtures[0];
    render(
      <Summary t={t} breakdown={result.breakdown} score={result.score} streak={1} now={now} shareText="x" preregUnlocked={false} />
    );
    expect(screen.getByText(t('summary.score', { score: result.score }))).toBeTruthy();
  });
});

describe('Summary — streak strip and countdown', () => {
  it('renders the streak via summary.streak', () => {
    render(
      <Summary
        t={t}
        breakdown={[['summary.breakdownCallCorrect', 100]]}
        score={100}
        streak={5}
        now={new Date(2026, 7, 10, 20, 0, 0, 0)}
        shareText="x"
        preregUnlocked={false}
      />
    );
    expect(screen.getByText(t('summary.streak', { n: 5 }))).toBeTruthy();
  });

  it('renders the countdown to next local midnight via summary.nextIn, wired through msToNextLocalMidnight', () => {
    render(
      <Summary
        t={t}
        breakdown={[['summary.breakdownCallCorrect', 100]]}
        score={100}
        streak={1}
        now={new Date(2026, 7, 10, 22, 0, 0, 0)}
        shareText="x"
        preregUnlocked={false}
      />
    );
    expect(screen.getByText(t('summary.nextIn', { hours: 2, minutes: 0 }))).toBeTruthy();
  });
});

describe('Summary — share button: navigator.share -> clipboard fallback -> toast', () => {
  afterEach(() => {
    delete (navigator as unknown as { share?: unknown }).share;
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  });

  function renderSummary() {
    return render(
      <Summary
        t={t}
        breakdown={[['summary.breakdownCallCorrect', 100]]}
        score={100}
        streak={1}
        now={new Date(2026, 7, 10, 20, 0, 0, 0)}
        shareText="P-hackle #1"
        preregUnlocked={false}
      />
    );
  }

  it('uses navigator.share when available and shows NO copied-toast (the OS share sheet is its own confirmation)', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { share: typeof share }).share = share;
    renderSummary();

    fireEvent.click(screen.getByRole('button', { name: t('summary.share') }));

    await waitFor(() => expect(share).toHaveBeenCalledWith({ text: 'P-hackle #1' }));
    expect(screen.queryByText(t('summary.copied'))).toBeNull();
  });

  it('falls back to the clipboard and shows the summary.copied toast when navigator.share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
    renderSummary();

    fireEvent.click(screen.getByRole('button', { name: t('summary.share') }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('P-hackle #1'));
    expect(await screen.findByText(t('summary.copied'))).toBeTruthy();
  });

  it('the copied toast is an aria-live status region', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
    renderSummary();
    fireEvent.click(screen.getByRole('button', { name: t('summary.share') }));
    const toast = await screen.findByRole('status');
    expect(toast.textContent).toBe(t('summary.copied'));
  });

  it('schedules the toast to hide itself again (a plain setTimeout, not a 5th CSS animation per DESIGN.md R5.5)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    renderSummary();

    fireEvent.click(screen.getByRole('button', { name: t('summary.share') }));
    await screen.findByText(t('summary.copied'));

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
  });
});

describe('Summary — prereg upsell, gated on achievements.first_retraction, disabled-for-now', () => {
  it('renders nothing prereg-related when not unlocked', () => {
    render(
      <Summary
        t={t}
        breakdown={[['summary.breakdownCallCorrect', 100]]}
        score={100}
        streak={1}
        now={new Date(2026, 7, 10, 20, 0, 0, 0)}
        shareText="x"
        preregUnlocked={false}
      />
    );
    expect(screen.queryByText(t('summary.preregUpsell'))).toBeNull();
    expect(screen.queryByText(t('summary.playPrereg'))).toBeNull();
  });

  it('renders the upsell body text and a DISABLED playPrereg affordance when unlocked', () => {
    render(
      <Summary
        t={t}
        breakdown={[['summary.breakdownCallCorrect', 100]]}
        score={100}
        streak={1}
        now={new Date(2026, 7, 10, 20, 0, 0, 0)}
        shareText="x"
        preregUnlocked={true}
      />
    );
    expect(screen.getByText(t('summary.preregUpsell'))).toBeTruthy();
    const button = screen.getByRole('button', { name: t('summary.playPrereg') });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});

// --- persistAndComputeSummary (the store-reading wrapper's pure-ish core) ---

describe('persistAndComputeSummary — scoring, streak-inclusive-of-today, persistence, achievement gating', () => {
  it('persists a hack-mode day and returns a streak that includes TODAY (continuing an existing run)', () => {
    seedStorage(
      freshV1({
        history: {
          '2026-08-08': { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'REPLICATED', shareString: '' } },
          '2026-08-09': { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'REPLICATED', shareString: '' } },
        },
      })
    );

    const result = persistAndComputeSummary({
      mode: 'hack',
      practice: false,
      puzzleNumber: 3,
      forks: 2,
      published: true,
      call: 'real',
      dayType: 'effect',
      stamp: 'REPLICATED',
      log: [],
      copy: enCopy,
      todayIso: '2026-08-10',
    });

    expect(result.streak).toBe(3); // 08-08, 08-09, 08-10 (today) consecutive
    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(saved.history['2026-08-10'].hack.score).toBe(result.score);
  });

  it('the persisted score matches scoreDay for the same inputs exactly', () => {
    const result = persistAndComputeSummary({
      mode: 'hack',
      practice: false,
      puzzleNumber: 1,
      forks: 0,
      published: true,
      call: 'real',
      dayType: 'effect',
      stamp: 'REPLICATED',
      log: [],
      copy: enCopy,
      todayIso: '2026-08-10',
    });
    const expected = scoreDay({
      mode: 'hack',
      dayType: 'effect',
      published: true,
      callCorrect: true,
      forks: 0,
      stamp: 'REPLICATED',
    });
    expect(result.score).toBe(expected.score);
    expect(result.breakdown).toEqual(expected.breakdown);
  });

  it('does NOT record a history entry in practice mode (loadState() may still lazily seed a fresh v1 blob — that is storage.ts s own documented behavior, not a save)', () => {
    persistAndComputeSummary({
      mode: 'hack',
      practice: true,
      puzzleNumber: 1,
      forks: 0,
      published: true,
      call: 'real',
      dayType: 'effect',
      stamp: 'REPLICATED',
      log: [],
      copy: enCopy,
      todayIso: '2026-08-10',
    });
    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(saved.history?.['2026-08-10']).toBeUndefined();
    expect(saved.stats?.hackDays ?? 0).toBe(0);
  });

  it('preregUnlocked is true iff achievements.first_retraction is already set', () => {
    seedStorage(freshV1({ achievements: { first_retraction: '2026-08-01' } }));
    const unlocked = persistAndComputeSummary({
      mode: 'hack',
      practice: false,
      puzzleNumber: 1,
      forks: 0,
      published: false,
      call: 'noise',
      dayType: 'null',
      stamp: 'NULL_REPORTED',
      log: [],
      copy: enCopy,
      todayIso: '2026-08-10',
    });
    expect(unlocked.preregUnlocked).toBe(true);

    window.localStorage.clear();
    seedStorage(freshV1());
    const locked = persistAndComputeSummary({
      mode: 'hack',
      practice: false,
      puzzleNumber: 1,
      forks: 0,
      published: false,
      call: 'noise',
      dayType: 'null',
      stamp: 'NULL_REPORTED',
      log: [],
      copy: enCopy,
      todayIso: '2026-08-11',
    });
    expect(locked.preregUnlocked).toBe(false);
  });

  it('the share text is built via shareString and included in the persisted DayRecord', () => {
    const result = persistAndComputeSummary({
      mode: 'hack',
      practice: false,
      puzzleNumber: 7,
      forks: 0,
      published: true,
      call: 'real',
      dayType: 'effect',
      stamp: 'REPLICATED',
      log: [],
      copy: enCopy,
      todayIso: '2026-08-10',
    });
    expect(result.shareText.startsWith('P-hackle #7')).toBe(true);
    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(saved.history['2026-08-10'].hack.shareString).toBe(result.shareText);
  });
});
