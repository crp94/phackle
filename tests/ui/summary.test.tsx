// @vitest-environment jsdom
//
// T17: the Summary screen — the score invoice (styled as a journal fee
// invoice, DESIGN.md hairline table rules), the share button (navigator.share
// -> clipboard fallback -> summary.copied toast), the streak strip, the
// countdown to next local midnight, and the (disabled-for-now,
// achievement-gated) Prereg Mode upsell. jsdom pragma because
// persistAndComputeSummary touches localStorage (via storage.ts) — same
// convention as tests/game/storage.test.ts.
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import SummaryScreen, { Summary, type UnlockedAchievement } from '../../src/ui/screens/Summary';
import { AppNavContext } from '../../src/ui/nav';
// gr6-081: the persistence moment moved out of the screen file it never belonged in.
import { persistAndComputeSummary } from '../../src/game/dayComplete';
import { scoreDay } from '../../src/game/scoring';
import { copy as enCopy } from '../../src/content/en/copy';
// T38: the achievement NAMES and CITATIONS are content, not chrome — they
// live in each locale's bank, and the unlock block renders them from there.
import { content as enContent } from '../../src/content/en';
import { MAX_STAGGER_STEPS } from '../../src/ui/hooks/useEnterOnce';
import { t as translate } from '../../src/i18n/t';
import type { PersistedState } from '../../src/game/storage';
import { DEFAULT_SPEC, useGameStore } from '../../src/game/store';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { localIsoDate } from '../../src/game/daily';
import type { EngineClient } from '../../src/engine/protocol';
import type { PathResult, PlayerAction } from '../../src/engine/types';

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

  // --- review fix (Important #1): shareViaNavigator's whole chain can
  // reject (no share API AND a failing clipboard write) — share.ts's own
  // doc comment says that's deliberate, "so the caller can surface an
  // error." Before this fix, handleShare had no catch and the onClick
  // voided the promise, so a player in that exact situation saw nothing.
  it('shows summary.shareFailed when BOTH navigator.share is absent and the clipboard write rejects', async () => {
    expect('share' in navigator).toBe(false);
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
    renderSummary();

    fireEvent.click(screen.getByRole('button', { name: t('summary.share') }));

    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe(t('summary.shareFailed'));
    expect(screen.queryByText(t('summary.copied'))).toBeNull();
  });

  it('shows summary.shareFailed when navigator.share itself rejects and there is no clipboard to fall back to', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    (navigator as unknown as { share: typeof share }).share = share;
    expect('clipboard' in navigator).toBe(false);
    renderSummary();

    fireEvent.click(screen.getByRole('button', { name: t('summary.share') }));

    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe(t('summary.shareFailed'));
  });

  it('a retry that succeeds clears a previous failure message', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('blocked once')).mockResolvedValueOnce(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
    renderSummary();
    const button = screen.getByRole('button', { name: t('summary.share') });

    fireEvent.click(button);
    await screen.findByRole('alert');

    fireEvent.click(button);
    await screen.findByText(t('summary.copied'));
    expect(screen.queryByText(t('summary.shareFailed'))).toBeNull();
  });
});

describe('Summary — prereg block (gr6-020): gated on the unlock AND on the day still having one to give', () => {
  const props = {
    t,
    breakdown: [['summary.breakdownCallCorrect', 100]] as [Parameters<typeof t>[0], number][],
    score: 100,
    streak: 1,
    now: new Date(2026, 7, 10, 20, 0, 0, 0),
    shareText: 'x',
  };

  it('renders nothing prereg-related when not unlocked', () => {
    render(<Summary {...props} preregUnlocked={false} />);
    expect(screen.queryByText(t('summary.preregUpsell'))).toBeNull();
    expect(screen.queryByText(t('prereg.title'))).toBeNull();
  });

  it('renders the block when unlocked and prereg has NOT been played today', () => {
    render(<Summary {...props} preregUnlocked={true} />);
    expect(screen.getByText(t('summary.preregUpsell'))).toBeTruthy();
  });

  it('renders NO dead CTA: the block is heading + sentence, never a permanently disabled button', () => {
    // gr6-020, pinned STRUCTURALLY. This used to assert the absence of a
    // button named `summary.playPrereg` — which meant the key for a control
    // W6 deleted had to stay alive in three catalogs purely so this line
    // could name it, and a translator maintaining a string whose only
    // remaining consumer is an assertion that it never appears. The shape is
    // what gr6-020 actually decided: this block is a heading and a sentence,
    // and it has no control of any kind. Naming the shape also catches a CTA
    // that comes back under a DIFFERENT label, which naming the old string
    // never could.
    const { container } = render(<Summary {...props} preregUnlocked={true} />);
    const block = container.querySelector('.ph-summary__prereg') as HTMLElement;
    expect(block).not.toBeNull();
    expect(block.querySelectorAll('button, a, input, [role="button"]')).toHaveLength(0);
    expect(Array.from(block.children).map((el) => el.tagName)).toEqual(['H2', 'P']);
    for (const button of screen.getAllByRole('button')) {
      expect(button.hasAttribute('disabled'), `"${button.textContent}" is a dead control`).toBe(false);
    }
  });

  it('hides the block entirely on a prereg day — the mode being advertised is the one just played', () => {
    render(<Summary {...props} preregUnlocked={true} preregPlayedToday={true} />);
    expect(screen.queryByText(t('summary.preregUpsell'))).toBeNull();
  });
});

// --- gr6-018: the invoice itemises, career track included -------------------

describe('Summary — the career line (gr6-018)', () => {
  const props = {
    t,
    breakdown: [
      ['summary.breakdownCallIncorrect', 0],
      ['summary.breakdownParsimony', 0],
    ] as [Parameters<typeof t>[0], number][],
    score: 0,
    streak: 1,
    now: new Date(2026, 7, 10, 20, 0, 0, 0),
    shareText: 'x',
    preregUnlocked: false,
  };

  it('reconciles with what the Published screen printed two screens earlier', () => {
    render(<Summary {...props} career={25} />);
    expect(screen.getByTestId('summary-career').textContent).toBe(t('published.careerPoints', { n: 25 }));
  });

  it('shows the career track at 0 on an abandoned day rather than omitting it', () => {
    render(<Summary {...props} career={0} />);
    expect(screen.getByTestId('summary-career').textContent).toBe(t('published.careerPoints', { n: 0 }));
  });

  it('omits the line entirely on a prereg day, which has no career track at all (§2.8)', () => {
    render(<Summary {...props} career={null} />);
    expect(screen.queryByTestId('summary-career')).toBeNull();
  });

  it('the career figure is NOT an invoice row: it never joins the sum that must equal the score', () => {
    render(<Summary {...props} career={25} />);
    const rowValues = screen.getAllByTestId('invoice-row-value').map((el) => Number(el.textContent));
    expect(rowValues).toEqual([0, 0]);
    expect(rowValues.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('the modal first day is no longer a one-line table of zeros', () => {
    render(<Summary {...props} career={25} />);
    expect(screen.getAllByTestId('invoice-row-value').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(t('summary.breakdownParsimony'))).toBeTruthy();
    expect(screen.getByTestId('summary-career')).toBeTruthy();
  });
});

// --- gr6-062: the day ends where the day's reward is ------------------------

describe('Summary — the "your stats" action (gr6-062)', () => {
  const props = {
    t,
    breakdown: [['summary.breakdownCallCorrect', 100]] as [Parameters<typeof t>[0], number][],
    score: 100,
    streak: 1,
    now: new Date(2026, 7, 10, 20, 0, 0, 0),
    shareText: 'x',
    preregUnlocked: false,
  };

  it('renders an enabled action that calls back to the app shell', () => {
    const onViewStats = vi.fn();
    render(<Summary {...props} onViewStats={onViewStats} />);
    const button = screen.getByTestId('summary-stats-action');
    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.click(button);
    expect(onViewStats).toHaveBeenCalledTimes(1);
  });

  it('is labelled as an ACTION, not as the header tab of the same name', () => {
    // gr6-062: this rendered `nav.stats` ("Stats") as a placeholder. A tab in
    // a row of tabs is a destination and is right to be a noun; this is the
    // last control of a finished day and reads as what it does. They must not
    // be the same string — a screen reader meeting the identical accessible
    // name twice on one screen has no way to tell the two controls apart.
    render(<Summary {...props} onViewStats={vi.fn()} />);
    const button = screen.getByTestId('summary-stats-action');
    expect(button.textContent).toBe(t('summary.viewStats'));
    expect(button.textContent).not.toBe(t('nav.stats'));
  });

  it('sits AFTER the countdown, where the day actually ends', () => {
    render(<Summary {...props} onViewStats={vi.fn()} />);
    const section = document.querySelector('.ph-summary') as HTMLElement;
    const children = Array.from(section.children);
    const countdown = children.findIndex((el) => el.classList.contains('ph-summary__countdown'));
    const action = children.findIndex((el) => el.querySelector('[data-testid="summary-stats-action"]') || el.matches('[data-testid="summary-stats-action"]'));
    expect(countdown).toBeGreaterThanOrEqual(0);
    expect(action).toBeGreaterThan(countdown);
  });

  it('renders nothing at all when the shell supplies no route (never a dead control)', () => {
    render(<Summary {...props} />);
    expect(screen.queryByTestId('summary-stats-action')).toBeNull();
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
      puzzleIso: '2026-08-10',
      resultLog: [],
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
      puzzleIso: '2026-08-10',
      resultLog: [],
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
      puzzleIso: '2026-08-10',
      resultLog: [],
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
      puzzleIso: '2026-08-10',
      resultLog: [],
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
      puzzleIso: '2026-08-11',
      resultLog: [],
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
      puzzleIso: '2026-08-10',
      resultLog: [],
    });
    expect(result.shareText.startsWith('P-hackle #7')).toBe(true);
    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(saved.history['2026-08-10'].hack.shareString).toBe(result.shareText);
  });

  // --- review fix (CRITICAL): durable idempotency, not merely mount-scoped ---
  //
  // Unit level first (calling the pure function itself twice for the same
  // day+mode, no React involved), then the REQUIRED full integration test
  // below (a real unmount/remount of the actual SummaryScreen component,
  // driven through a real store instance — the exact "nav away and back"
  // shape the review flagged, which a savedRef alone cannot survive).
  it('a second call for the SAME (puzzleIso, mode) does not inflate the running stats', () => {
    const fields = {
      mode: 'hack' as const,
      practice: false,
      puzzleNumber: 1,
      forks: 3,
      published: true,
      call: 'real' as const,
      dayType: 'effect' as const,
      stamp: 'REPLICATED' as const,
      log: [],
      copy: enCopy,
      puzzleIso: '2026-08-10',
      resultLog: [],
    };

    const first = persistAndComputeSummary(fields);
    const afterFirst = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(afterFirst.stats.hackDays).toBe(1);
    expect(afterFirst.stats.callsTotal).toBe(1);
    expect(afterFirst.stats.callsCorrect).toBe(1);
    expect(afterFirst.stats.careerPoints).toBe(25);
    expect(afterFirst.stats.forkHistogram[3]).toBe(1);

    const second = persistAndComputeSummary(fields);
    const afterSecond = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    // The exact numbers the review named — UNCHANGED, not doubled.
    expect(afterSecond.stats.hackDays).toBe(1);
    expect(afterSecond.stats.callsTotal).toBe(1);
    expect(afterSecond.stats.callsCorrect).toBe(1);
    expect(afterSecond.stats.careerPoints).toBe(25);
    expect(afterSecond.stats.forkHistogram[3]).toBe(1);
    // The rendered invoice/streak/share text are IDENTICAL both times — only
    // the actual storage write was skipped the second time.
    expect(second).toEqual(first);
  });

  it('a second call for a DIFFERENT mode on the same day still persists separately (one play per mode per day, §5.6)', () => {
    const base = {
      puzzleNumber: 1,
      forks: 0,
      published: true,
      call: null,
      dayType: 'effect' as const,
      stamp: 'REPLICATED' as const,
      log: [],
      copy: enCopy,
      puzzleIso: '2026-08-10',
      resultLog: [],
    };
    persistAndComputeSummary({ ...base, mode: 'hack', call: 'real', practice: false });
    persistAndComputeSummary({ ...base, mode: 'prereg', practice: false });

    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(saved.stats.hackDays).toBe(1);
    expect(saved.stats.preregDays).toBe(1);
    expect(saved.history['2026-08-10'].hack).toBeDefined();
    expect(saved.history['2026-08-10'].prereg).toBeDefined();
  });
});

// --- shared harness: drives the REAL store singleton to 'summary' ---------
//
// Reproduces the exact review-flagged path: App.tsx's header nav is a local
// page-state that UNMOUNTS the running game machine (children, including
// SummaryScreen) when the player opens Stats/Legend/About, and REMOUNTS it —
// with a fresh `savedRef` — on the way back. `useGameStore` is bound to a
// module-level singleton (game/store.ts) that is NOT itself exported, so the
// only way to drive it into a real 'summary' state for this test is through
// its own real actions (boot -> openData -> submit -> makeCall ->
// finishReveal), via a small harness component — the same sequence
// tests/game/store.test.ts itself uses to reach 'summary', with the same
// fake EngineClient shape. Hoisted to module scope (T30) so both the
// original nav-remount describe block below AND the newer achievements-wiring
// describe block can share it without duplicating ~30 lines of harness.
function makeFakeClient(): EngineClient {
  return {
    init: vi.fn().mockResolvedValue({ scenarioIndex: 0, n: 200 }),
    runSpec: vi.fn().mockResolvedValue({
      spec: DEFAULT_SPEC,
      n: 200,
      beta: 0.12,
      se: 0.05,
      t: 2.4,
      p: 0.02, // valid + significant: store.submit()'s own guard requires this
      ci: [0.02, 0.22] as [number, number],
      excludedCount: 0,
      valid: true,
    }),
    extend: vi.fn().mockResolvedValue({ n: 250 }),
    reveal: vi.fn().mockResolvedValue({
      totalPaths: 1792,
      sigPaths: 87,
      sigFraction: 0.0486,
      playerExplored: 1,
      pHitAtK: 0.52,
      curve: [],
      stamp: 'RETRACTED',
      peeks: 0,
      dayType: 'null',
      trueOutcome: null,
      trueBeta: 0,
      hetero: null,
    }),
    onCrash: vi.fn(),
  };
}

/** Drives the REAL store singleton (via useGameStore) through the exact
 * sequence tests/game/store.test.ts uses to reach 'summary': boot (with a
 * fake client) -> openData -> submit (boot's own prefetched result is
 * p=0.02, valid) -> makeCall('real') -> finishReveal. Calls `onReady` once
 * `screen` is actually 'summary'. `practice` (T30 addition, defaults false —
 * every existing call site is unaffected) drives boot's own practice flag,
 * for the "practice never persists achievements" case. */
function DriveToSummary({ onReady, practice = false }: { onReady: () => void; practice?: boolean }) {
  const boot = useGameStore((s) => s.boot);
  const openData = useGameStore((s) => s.openData);
  const submit = useGameStore((s) => s.submit);
  const makeCall = useGameStore((s) => s.makeCall);
  const finishReveal = useGameStore((s) => s.finishReveal);
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = makeFakeClient();
      await boot(client, '2026-08-10', { practice, mode: 'hack', scenarioCount: 20 });
      if (cancelled) return;
      openData();
      await submit();
      if (cancelled) return;
      await makeCall('real');
      if (cancelled) return;
      finishReveal();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen === 'summary') onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  return null;
}

// --- REQUIRED test: a real unmount/remount cycle of the actual SummaryScreen,
// driven through a real store instance (not just the pure function above) ---
describe('SummaryScreen — a real unmount/remount cycle does not double-persist (the nav path)', () => {
  it('does not persist a finished day twice across a real unmount/remount, and the persisted NUMBERS (not just call counts) stay unchanged', async () => {
    const ready = vi.fn();
    const harness = render(
      <LocaleProvider>
        <DriveToSummary onReady={ready} />
      </LocaleProvider>
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    harness.unmount();

    // The boot iso ITSELF (never localIsoDate()) — this is the exact
    // distinction review round 2 found: persistence keys on the puzzle's
    // own day (store.iso, fixed by boot() below), not on whatever the real
    // wall clock happens to read when this test executes.
    const puzzleIso = '2026-08-10';

    // --- First mount: the initial, correct persistence -----------------
    const first = render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
      expect(saved.history?.[puzzleIso]?.hack).toBeDefined();
    });

    const afterFirst = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(afterFirst.stats.hackDays).toBe(1);
    expect(afterFirst.stats.callsTotal).toBe(1);
    expect(afterFirst.stats.careerPoints).toBe(25); // published, stamp !== NULL_REPORTED
    expect(afterFirst.stats.forkHistogram[0]).toBe(1);

    first.unmount(); // <- "click Stats" (App.tsx's page-state unmounts this branch)

    // --- Second mount: the exact nav-remount path the review flagged ----
    const second = render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());

    const afterSecond = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    // The exact fields the review named — asserted as NUMBERS, not as a
    // saveDay/localStorage.setItem call count.
    expect(afterSecond.stats.hackDays).toBe(1);
    expect(afterSecond.stats.callsTotal).toBe(1);
    expect(afterSecond.stats.careerPoints).toBe(25);
    expect(afterSecond.stats.forkHistogram[0]).toBe(1);
    expect(afterSecond.history[puzzleIso].hack).toEqual(afterFirst.history[puzzleIso].hack);

    second.unmount();
  });

  // --- review round 2: the exact straddle — a bare remount is not the only
  // way to reach SummaryScreen twice; sitting on a nav page (which the
  // countdown itself invites) can carry the player across a REAL midnight
  // rollover too. `vi.setSystemTime` actually moves `Date`/`Date.now()`
  // forward between the two mounts (shouldAdvanceTime keeps waitFor's own
  // polling working via real elapsed time throughout) -- a strictly
  // stronger simulation than mocking `localIsoDate`'s return value, since it
  // proves the fix however the wall clock is read, not just through the one
  // function this codebase happens to call it.
  it('a real midnight rollover while sitting on a nav page does not create a phantom next-day entry (the exact straddle review round 2 found)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.setSystemTime(new Date(2026, 7, 10, 23, 0, 0, 0)); // 23:00 on the puzzle's own day

      const ready = vi.fn();
      const harness = render(
        <LocaleProvider>
          <DriveToSummary onReady={ready} />
        </LocaleProvider>
      );
      await waitFor(() => expect(ready).toHaveBeenCalled());
      harness.unmount();

      // First mount: persists correctly under the puzzle's own day
      // (DriveToSummary always boots with iso '2026-08-10').
      const first = render(
        <LocaleProvider>
          <SummaryScreen />
        </LocaleProvider>
      );
      await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());
      await waitFor(() => {
        const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
        expect(saved.history?.['2026-08-10']?.hack).toBeDefined();
      });
      first.unmount(); // <- "click Stats" — the player sits on a nav page...

      // ...past a REAL midnight rollover. localIsoDate() would now return
      // 2026-08-11 if the persistence path still consulted it — sanity-
      // checked directly below, then proven irrelevant to persistence.
      vi.setSystemTime(new Date(2026, 7, 11, 0, 30, 0, 0));
      expect(localIsoDate()).toBe('2026-08-11'); // the straddle is real, not hypothetical

      const second = render(
        <LocaleProvider>
          <SummaryScreen />
        </LocaleProvider>
      );
      await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());

      const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
      // No phantom next-day entry, under the date the wall clock now reads:
      expect(saved.history['2026-08-11']).toBeUndefined();
      // The original day's record is untouched — no second persist, ever:
      expect(saved.stats.hackDays).toBe(1);
      expect(saved.stats.callsTotal).toBe(1);
      expect(saved.stats.careerPoints).toBe(25);
      expect(saved.stats.forkHistogram[0]).toBe(1);
      expect(Object.keys(saved.history)).toEqual(['2026-08-10']);

      second.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

// --- T30: achievement evaluation wired into the SAME persist moment --------
//
// Before T30, evaluateAchievements (T13) had zero call sites: the wall stayed
// all-locked and the prereg upsell (gated on achievements.first_retraction)
// was dead. These tests drive a real RETRACTED day end-to-end (same harness
// as the nav-remount describe block above — its fake client's `reveal`
// always returns stamp: 'RETRACTED') and prove the achievement actually
// unlocks, the upsell renders on the SAME summary that earned it, a remount
// never moves the unlock date, and practice mode never persists anything.
describe('SummaryScreen — achievement evaluation wired into the one persist moment (T30)', () => {
  it('a first-ever RETRACTED day unlocks first_retraction under the PUZZLE iso, and the SAME summary already shows the prereg upsell', async () => {
    const ready = vi.fn();
    const harness = render(
      <LocaleProvider>
        <DriveToSummary onReady={ready} />
      </LocaleProvider>
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    harness.unmount();

    render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());

    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    // The boot iso itself ('2026-08-10', DriveToSummary's own fixed boot
    // call) — never a wall-clock read.
    expect(saved.achievements.first_retraction).toBe('2026-08-10');

    // The block renders on THIS SAME render — proving preregUnlocked flips
    // true the instant the achievement is earned, not only on some later day.
    expect(screen.getByText(t('summary.preregUpsell'))).toBeTruthy();
    // gr6-020: and it is a sentence, not a permanently disabled button.
    // Pinned as the block's SHAPE rather than by the deleted CTA's old label
    // — see the sibling assertion in "renders NO dead CTA" above for why.
    const block = document.querySelector('.ph-summary__prereg') as HTMLElement;
    expect(block.querySelectorAll('button, a, input, [role="button"]')).toHaveLength(0);
  });

  it('a remount does not move the unlock date (saveAchievements is not re-invoked; alreadySaved skips the whole persist block)', async () => {
    const ready = vi.fn();
    const harness = render(
      <LocaleProvider>
        <DriveToSummary onReady={ready} />
      </LocaleProvider>
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    harness.unmount();

    const first = render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());
    const afterFirst = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(afterFirst.achievements.first_retraction).toBe('2026-08-10');
    first.unmount(); // <- "click Stats"

    const second = render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());
    const afterSecond = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');

    expect(afterSecond.achievements.first_retraction).toBe(afterFirst.achievements.first_retraction);
    expect(screen.getByText(t('summary.preregUpsell'))).toBeTruthy(); // still shown, from persisted state

    second.unmount();
  });

  it('practice mode never persists achievements, even on a RETRACTED day that would otherwise unlock first_retraction', async () => {
    const ready = vi.fn();
    const harness = render(
      <LocaleProvider>
        <DriveToSummary onReady={ready} practice />
      </LocaleProvider>
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    harness.unmount();

    render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());

    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(saved.achievements ?? {}).toEqual({});
    expect(screen.queryByText(t('summary.preregUpsell'))).toBeNull();
  });
});

// --- T38: the unlock block — the day's award ceremony ----------------------
//
// T35's motion review found the gap this closes: persistAndComputeSummary
// computed `unlockedToday`, persisted it via saveAchievements, and DISCARDED
// it, so a player who had just earned "The One-Tailed Bandit" was told
// nothing at all on the screen that had just decided it. The block renders
// each award's NAME and CITATION straight out of the active locale's content
// bank (never re-stated in copy.ts), behind DESIGN.md R5.2 site 9's staggered
// entrance.

/** Two awards, in a fixed order, resolved exactly as SummaryScreen resolves
 * them: ids -> the English bank's own name/citation. */
const TWO_AWARDS: UnlockedAchievement[] = (['one_tailed_bandit', 'harking'] as const).map((id) => ({
  id,
  ...enContent.achievements[id],
}));

function renderWithUnlocks(unlocked: UnlockedAchievement[]) {
  return render(
    <Summary
      t={t}
      breakdown={[['summary.breakdownCallCorrect', 100]]}
      score={100}
      streak={1}
      now={new Date(2026, 7, 10, 20, 0, 0, 0)}
      shareText="x"
      preregUnlocked={false}
      unlocked={unlocked}
    />
  );
}

describe('Summary — the unlock block renders iff something was unlocked today', () => {
  it('names every award and prints its citation, in the order they were earned', () => {
    renderWithUnlocks(TWO_AWARDS);

    expect(screen.getByText(t('summary.unlockedToday'))).toBeTruthy();
    const items = screen.getAllByTestId('unlock-item');
    expect(items.map((el) => el.textContent)).toEqual([
      `${enContent.achievements.one_tailed_bandit.name}${enContent.achievements.one_tailed_bandit.citation}`,
      `${enContent.achievements.harking.name}${enContent.achievements.harking.citation}`,
    ]);
    // The strings are the CONTENT BANK's, not a rewrite living in copy.ts.
    expect(screen.getByText(enContent.achievements.one_tailed_bandit.citation)).toBeTruthy();
    expect(screen.getByText(enContent.achievements.harking.name)).toBeTruthy();
  });

  it('renders NOTHING on a day that unlocked nothing — no heading, no empty-state line', () => {
    renderWithUnlocks([]);
    expect(screen.queryByText(t('summary.unlockedToday'))).toBeNull();
    expect(screen.queryAllByTestId('unlock-item')).toEqual([]);
  });

  it('omits the block entirely when the prop is omitted (the default is "nothing happened")', () => {
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
    expect(screen.queryByText(t('summary.unlockedToday'))).toBeNull();
  });

  it('sits between the invoice and the share button (the ceremony precedes the bragging)', () => {
    const { container } = renderWithUnlocks(TWO_AWARDS);
    const order = [...container.querySelectorAll('.ph-summary__invoice, .ph-summary__unlock, .ph-summary__share')].map(
      (el) => el.className
    );
    expect(order).toEqual(['ph-summary__invoice', 'ph-summary__unlock', 'ph-summary__share']);
  });
});

describe('Summary — R5.2 site 9: one staggered group, capped, and never hiding content', () => {
  /** An observer that mounts and NEVER fires, so `entered` can only be true
   * because something other than the viewport made it true. jsdom ships no
   * IntersectionObserver at all, and without this stub `useEnterOnce` fails
   * open on that alone — which would make every assertion below vacuous. */
  function installSilentObserver() {
    class SilentObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = SilentObserver;
    return () => {
      delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    };
  }

  /** jsdom has no matchMedia; useReducedMotion reads exactly this query. */
  function installReducedMotion(reduce: boolean) {
    window.matchMedia = vi.fn((query: string) => ({
      media: query,
      matches: query.includes('prefers-reduced-motion') ? reduce : false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
      onchange: null,
    })) as unknown as typeof window.matchMedia;
  }

  it('indexes the group in DOM order and caps it at MAX_STAGGER_STEPS (R5.7)', () => {
    const four: UnlockedAchievement[] = (['first_blood', 'harking', 'garden', 'well_actually'] as const).map((id) => ({
      id,
      ...enContent.achievements[id],
    }));
    renderWithUnlocks(four);
    const indices = screen.getAllByTestId('unlock-item').map((el) => el.style.getPropertyValue('--ph-stagger-index'));
    // 0, 1, 2, then capped — the 4th award must not wait 4 steps for arriving
    // alone at the bottom of the page.
    expect(indices).toEqual(['0', '1', '2', `${MAX_STAGGER_STEPS}`]);
  });

  it('is the screen\'s ONLY staggered group: the share toast carries no index (R5.7\'s one-group budget)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
    const { container } = renderWithUnlocks(TWO_AWARDS);
    fireEvent.click(screen.getByRole('button', { name: t('summary.share') }));
    const toast = await screen.findByRole('status');

    expect(toast.style.getPropertyValue('--ph-stagger-index')).toBe('');
    expect(container.querySelectorAll('[style*="--ph-stagger-index"]')).toHaveLength(TWO_AWARDS.length);
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  });

  it('is visible FROM MOUNT under reduced motion, with an observer that never fires (R5.6 parity)', () => {
    const restore = installSilentObserver();
    installReducedMotion(true);
    try {
      renderWithUnlocks(TWO_AWARDS);
      // The restoring class is present on the very first render: the citation
      // is held visible by the CLASS, and no movement is waited on.
      for (const item of screen.getAllByTestId('unlock-item')) {
        expect(item.className).toContain('ph-entered');
      }
      // ...and the text is in the document regardless of any animation.
      expect(screen.getByText(enContent.achievements.harking.citation)).toBeTruthy();
    } finally {
      restore();
    }
  });

  it('the reduced-motion assertion is not vacuous: with full motion the same observer withholds the class', () => {
    const restore = installSilentObserver();
    installReducedMotion(false);
    try {
      renderWithUnlocks(TWO_AWARDS);
      for (const item of screen.getAllByTestId('unlock-item')) {
        expect(item.className).toBe('ph-summary__unlock-item');
      }
    } finally {
      restore();
    }
  });

  it('fails OPEN where there is no IntersectionObserver at all (jsdom\'s own case)', () => {
    expect(typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver).toBe('undefined');
    renderWithUnlocks(TWO_AWARDS);
    for (const item of screen.getAllByTestId('unlock-item')) {
      expect(item.className).toContain('ph-entered');
    }
  });
});

/** The committed spec's own N=400 result on a prereg day (store.preregResult):
 * valid and significant, which is what T18 made the real prereg signal. */
const PREREG_RESULT: PathResult = {
  spec: DEFAULT_SPEC,
  n: 400,
  beta: 0.2,
  se: 0.05,
  t: 4,
  p: 0.01,
  ci: [0.1, 0.3],
  excludedCount: 0,
  valid: true,
};

describe('persistAndComputeSummary — unlockedToday is returned from the SAME computation it persists', () => {
  const submitLog = (spec: typeof DEFAULT_SPEC): PlayerAction[] => [{ t: 'SUBMIT', spec, p: 0.01, at: 0 }];

  it('returns exactly what saveAchievements just wrote, and returns it once', () => {
    const fields = {
      mode: 'hack' as const,
      practice: false,
      puzzleNumber: 1,
      forks: 0,
      published: true,
      call: 'real' as const,
      dayType: 'effect' as const,
      stamp: 'REPLICATED' as const,
      log: submitLog({ ...DEFAULT_SPEC, exclusion: 'z2' as const }),
      copy: enCopy,
      puzzleIso: '2026-08-10',
      resultLog: [],
    };

    const first = persistAndComputeSummary(fields);
    expect(first.unlockedToday).toEqual(['first_blood', 'outlier_surgeon']);
    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(Object.keys(saved.achievements).sort()).toEqual([...first.unlockedToday].sort());
    for (const id of first.unlockedToday) expect(saved.achievements[id]).toBe('2026-08-10');

    // A re-visit (the nav path) re-derives nothing and claims nothing: the
    // ceremony belongs to the day it happened, and the persistence block that
    // produced it is skipped wholesale by `alreadySaved`.
    const second = persistAndComputeSummary(fields);
    expect(second.unlockedToday).toEqual([]);
    expect(second.breakdown).toEqual(first.breakdown); // ...everything else is unchanged
    expect(JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}').achievements).toEqual(saved.achievements);
  });

  it('claims nothing on a practice day (the persistence moment never runs)', () => {
    const result = persistAndComputeSummary({
      mode: 'hack',
      practice: true,
      puzzleNumber: 1,
      forks: 0,
      published: true,
      call: 'real',
      dayType: 'effect',
      stamp: 'REPLICATED',
      log: submitLog({ ...DEFAULT_SPEC, exclusion: 'z2' }),
      copy: enCopy,
      puzzleIso: '2026-08-10',
      resultLog: [],
    });
    expect(result.unlockedToday).toEqual([]);
  });

  it('carries a PREREG day\'s unlocks identically — the block is blind to the mode', () => {
    const result = persistAndComputeSummary({
      mode: 'prereg',
      practice: false,
      puzzleNumber: 1,
      forks: 0,
      published: true,
      call: null,
      dayType: 'effect',
      stamp: 'REPLICATED',
      log: submitLog({ ...DEFAULT_SPEC, exclusion: 'z2' }),
      copy: enCopy,
      puzzleIso: '2026-08-10',
      resultLog: [],
      preregResult: PREREG_RESULT,
    });
    expect(result.unlockedToday).toEqual(['first_blood', 'outlier_surgeon']);
    // Same shape the hack-mode day returns, so the same block renders: the
    // presentational half never receives `mode` at all.
    renderWithUnlocks(result.unlockedToday.map((id) => ({ id, ...enContent.achievements[id] })));
    expect(screen.getByText(t('summary.unlockedToday'))).toBeTruthy();
    expect(screen.getAllByTestId('unlock-item')).toHaveLength(2);
  });
});

describe('SummaryScreen — the day that earns an award shows it, and only that day (T38, end to end)', () => {
  it('renders the real names and citations of everything the finished day unlocked', async () => {
    const ready = vi.fn();
    const harness = render(
      <LocaleProvider>
        <DriveToSummary onReady={ready} />
      </LocaleProvider>
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    harness.unmount();

    render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());

    // The harness publishes (p = 0.02) into a RETRACTED reveal: first ever
    // publication AND first ever retraction, in evaluateAchievements' order.
    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(Object.keys(saved.achievements).sort()).toEqual(['first_blood', 'first_retraction']);

    expect(screen.getByText(t('summary.unlockedToday'))).toBeTruthy();
    expect(screen.getAllByTestId('unlock-item').map((el) => el.textContent)).toEqual([
      `${enContent.achievements.first_blood.name}${enContent.achievements.first_blood.citation}`,
      `${enContent.achievements.first_retraction.name}${enContent.achievements.first_retraction.citation}`,
    ]);
  });

  it('shows nothing on a later re-visit of the same day, while the upsell it earned stays (nav path)', async () => {
    const ready = vi.fn();
    const harness = render(
      <LocaleProvider>
        <DriveToSummary onReady={ready} />
      </LocaleProvider>
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    harness.unmount();

    const first = render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());
    expect(screen.getAllByTestId('unlock-item')).toHaveLength(2);
    first.unmount(); // <- "click Stats"

    render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());
    expect(screen.queryAllByTestId('unlock-item')).toEqual([]);
    expect(screen.queryByText(t('summary.unlockedToday'))).toBeNull();
    // The achievement itself is untouched — only the CEREMONY is once.
    expect(screen.getByText(t('summary.preregUpsell'))).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(saved.achievements.first_retraction).toBe('2026-08-10');
  });
});

/* ==========================================================================
   gr6-062's other half, and the one an explicit-prop test cannot see: the
   SCREEN wrapper is the registry's 'summary' entry, and the registry types
   every screen as a bare `ComponentType` — no props at all. So the wrapper
   has to find the route itself, and src/ui/nav.ts's context is it (App.tsx
   provides it around <main>). Driven through the same real store + real
   SummaryScreen harness as the remount test above, because the action only
   exists on a finished day.
   Mutation-checked: deleting the `?? nav?.viewStats` fallback in Summary.tsx
   leaves the whole rest of this file green and reds the first test here.
   ========================================================================== */
describe('SummaryScreen — the stats route comes from the shell context (gr6-062)', () => {
  async function driveToFinishedDay() {
    const ready = vi.fn();
    const harness = render(
      <LocaleProvider>
        <DriveToSummary onReady={ready} />
      </LocaleProvider>
    );
    await waitFor(() => expect(ready).toHaveBeenCalled());
    harness.unmount();
  }

  it('picks the route up from the context, with no prop at all', async () => {
    await driveToFinishedDay();
    const viewStats = vi.fn();
    render(
      <LocaleProvider>
        <AppNavContext.Provider value={{ viewStats }}>
          <SummaryScreen />
        </AppNavContext.Provider>
      </LocaleProvider>
    );
    const button = await screen.findByTestId('summary-stats-action');
    fireEvent.click(button);
    expect(viewStats).toHaveBeenCalledTimes(1);
  });

  it('renders no action at all when there is neither a prop nor a shell — never a dead control', async () => {
    await driveToFinishedDay();
    render(
      <LocaleProvider>
        <SummaryScreen />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(t('summary.invoiceTitle'))).toBeTruthy());
    expect(screen.queryByTestId('summary-stats-action')).toBeNull();
  });
});
