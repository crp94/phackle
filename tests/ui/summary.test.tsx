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
import SummaryScreen, { Summary, persistAndComputeSummary } from '../../src/ui/screens/Summary';
import { scoreDay } from '../../src/game/scoring';
import { copy as enCopy } from '../../src/content/en/copy';
import { t as translate } from '../../src/i18n/t';
import type { PersistedState } from '../../src/game/storage';
import { DEFAULT_SPEC, useGameStore } from '../../src/game/store';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { localIsoDate } from '../../src/game/daily';
import type { EngineClient } from '../../src/engine/protocol';

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
      puzzleIso: '2026-08-10',
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

// --- REQUIRED test: a real unmount/remount cycle of the actual SummaryScreen,
// driven through a real store instance (not just the pure function above) ---
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
// fake EngineClient shape.
describe('SummaryScreen — a real unmount/remount cycle does not double-persist (the nav path)', () => {
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
   * `screen` is actually 'summary'. */
  function DriveToSummary({ onReady }: { onReady: () => void }) {
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
        await boot(client, '2026-08-10', { practice: false, mode: 'hack', scenarioCount: 20 });
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
