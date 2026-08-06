// @vitest-environment jsdom
//
// W8 — THE MID-PLAY MIDNIGHT NOTICE, and the rollover it sits beside.
//
// e2e/midnight.spec.ts (w7-r-003) already pins the two halves of the ROLLOVER
// itself in a real browser: a day in progress survives, and a briefing left
// open overnight picks up the new day. What it could not pin, because the
// affordance did not exist, is what a mid-play player is TOLD. That is
// `errors.newDay`, authored by W8 in all three locales and rendered by
// App.tsx's shell.
//
// WHY THIS CAN BE A UNIT TEST AT ALL. w7-r-003's own finding was that the
// rollover effect is unreachable under jsdom by construction: its first line
// read `clientRef.current`, which is null here because `createEngineClient()`
// needs a Worker. W8 moved that guard down to the one branch that actually
// uses the client (the re-boot), because the STALENESS question needs neither
// the worker nor the content bundle to answer. Mocking `createEngineClient`
// the way tests/ui/router.test.tsx does gets a real, booted store, and from
// there the effect runs exactly as it does in production.
//
// The clock is moved by mocking `localIsoDate` — the single function the
// effect consults — rather than by faking `Date` globally: `msToNextLocalMidnight`,
// the storage layer's date arithmetic and React's own scheduling all read
// `Date` too, and a global fake would be testing the fake.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App from '../../src/ui/App';
import { gameStore } from '../../src/game/store';
import { copy as enCopy } from '../../src/content/en/copy';
import { copy as itCopy } from '../../src/content/it/copy';
import type { EngineClient, ExtendInfo, InitInfo, RevealPayload } from '../../src/engine/protocol';
import type { PathResult } from '../../src/engine/types';

const mocks = vi.hoisted(() => ({
  createEngineClient: vi.fn(),
  /** What `localIsoDate()` answers. Null = defer to the real implementation,
   * which is what boot itself uses so the store starts on a real date. */
  today: { value: null as string | null },
}));

vi.mock('../../src/game/engineClient', () => ({
  createEngineClient: mocks.createEngineClient,
}));

vi.mock('../../src/game/daily', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/game/daily')>();
  return {
    ...actual,
    localIsoDate: (d?: Date) => (mocks.today.value === null ? actual.localIsoDate(d) : mocks.today.value),
  };
});

function makeResult(overrides: Partial<PathResult> = {}): PathResult {
  return {
    spec: { outcome: 0, subgroup: 'all', covariates: { income: false, risk: false }, exclusion: 'none', transform: 'raw', tails: 'two' },
    n: 200,
    beta: 0.12,
    se: 0.05,
    t: 2.4,
    p: 0.02,
    ci: [0.02, 0.22],
    excludedCount: 0,
    valid: true,
    ...overrides,
  };
}

function makeRevealPayload(overrides: Partial<RevealPayload> = {}): RevealPayload {
  return {
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
    capExhausted: false,
    ...overrides,
  };
}

function makeFakeClient(): EngineClient {
  return {
    init: vi.fn().mockResolvedValue({ scenarioIndex: 0, n: 200 } satisfies InitInfo),
    runSpec: vi.fn().mockResolvedValue(makeResult()),
    extend: vi.fn().mockResolvedValue({ n: 250 } satisfies ExtendInfo),
    reveal: vi.fn().mockResolvedValue(makeRevealPayload()),
    onCrash: vi.fn(),
  };
}

/** jsdom has no matchMedia; the shell reads it through useReducedMotion. */
function installMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    media: query,
    matches: true, // reduced motion: keeps entrance animations out of the way
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

/** Boot the real shell on a real day, then hand back a control that moves the
 * clock and fires the same `visibilitychange` a returning player fires. */
async function bootShell(): Promise<{ bootedIso: string }> {
  mocks.createEngineClient.mockReturnValue(makeFakeClient());
  // The shell ALONE, with no game screen inside it. That is not a shortcut:
  // the notice is rendered by the shell above <main>, so which screen the
  // player is standing on is exactly what it must not depend on — the
  // rollover check reads the STORE's `screen`, which these tests set
  // directly, and mounting the real Lab here would only add its own data
  // requirements (a `result` object) to a test about the header's clock.
  render(
    <LocaleProvider>
      <App puzzleNumber={1} />
    </LocaleProvider>
  );
  await waitFor(() => expect(gameStore.getState().booted).toBe(true));
  return { bootedIso: gameStore.getState().iso };
}

/** The half of the check that matters: a backgrounded tab's timers are
 * throttled, and "came back to it" is when a player actually returns. */
async function returnToTab(): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function tomorrowOf(iso: string): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  window.localStorage.clear();
  installMatchMedia();
  mocks.createEngineClient.mockReset();
  mocks.today.value = null;
  // `gameStore` is the app's SINGLETON and App.tsx is the only thing that
  // boots it, so a previous test's booted store would otherwise satisfy
  // `bootShell`'s wait instantly — and the fresh boot would then land
  // asynchronously, WITH THE CLOCK ALREADY MOVED, writing tomorrow into
  // `iso` and quietly making the notice unreachable. Measured while writing
  // this file: exactly one test passed and the rest failed for that reason.
  // Clearing `booted` is what makes each test wait for its own boot.
  gameStore.setState({ booted: false, iso: '', screen: 'briefing', error: null });
});

afterEach(() => {
  cleanup();
  mocks.today.value = null;
  vi.restoreAllMocks();
});

describe('the mid-play midnight notice (errors.newDay)', () => {
  it('is absent while the day on screen is still today', async () => {
    await bootShell();
    await returnToTab();
    expect(screen.queryByTestId('app-new-day-notice')).toBeNull();
  });

  it('appears when the date turns over on a player who is mid-play, and says the day still counts', async () => {
    const { bootedIso } = await bootShell();

    // Mid-play: anywhere the rollover deliberately will NOT re-boot. The Lab
    // is the case w7-r-003 measured — a half-hacked spec is exactly what a
    // re-boot would throw away.
    act(() => {
      gameStore.setState({ screen: 'lab' });
    });
    mocks.today.value = tomorrowOf(bootedIso);
    await returnToTab();

    const notice = await screen.findByTestId('app-new-day-notice');
    expect(notice.textContent).toBe(enCopy['errors.newDay']);
    // It is announced, because unlike every other line in the shell it can
    // ARRIVE while the player is already reading the screen.
    expect(notice.getAttribute('role')).toBe('status');
  });

  it('does NOT offer a reload control: mid-play, reloading is the destructive action', async () => {
    const { bootedIso } = await bootShell();
    act(() => {
      gameStore.setState({ screen: 'lab' });
    });
    mocks.today.value = tomorrowOf(bootedIso);
    await returnToTab();

    await screen.findByTestId('app-new-day-notice');
    // `errors.reload` belongs to the boot-failure screen (gr6-007), where
    // there is no day to lose. Nothing that appears DURING play may offer it:
    // the store holds the whole in-progress day and nothing is persisted
    // until the Summary, so a reload here throws the day away — the very
    // thing App.tsx's rollover ruling refuses to do to the player.
    expect(screen.queryByText(enCopy['errors.reload'])).toBeNull();
    expect(screen.queryByTestId('app-boot-error-reload')).toBeNull();
  });

  it('KEEPS THE DAY: the notice is the whole intervention, and nothing in the store moves', async () => {
    const { bootedIso } = await bootShell();
    act(() => {
      gameStore.setState({ screen: 'lab' });
    });
    const before = gameStore.getState();
    const snapshot = { iso: before.iso, screen: before.screen, log: before.log, puzzleNumber: before.puzzleNumber };

    mocks.today.value = tomorrowOf(bootedIso);
    await returnToTab();
    await screen.findByTestId('app-new-day-notice');

    const after = gameStore.getState();
    expect(after.iso, 'MIDNIGHT MOVED A DAY IN PROGRESS').toBe(snapshot.iso);
    expect(after.screen).toBe(snapshot.screen);
    expect(after.log).toBe(snapshot.log);
    expect(after.puzzleNumber).toBe(snapshot.puzzleNumber);
  });

  it('retires itself once the store is on the new day again', async () => {
    const { bootedIso } = await bootShell();
    act(() => {
      gameStore.setState({ screen: 'lab' });
    });
    const tomorrow = tomorrowOf(bootedIso);
    mocks.today.value = tomorrow;
    await returnToTab();
    await screen.findByTestId('app-new-day-notice');

    // Whatever gets the store onto the new day — a reload the player chose, a
    // re-boot from the briefing — clears the notice through the same check
    // that raised it.
    act(() => {
      gameStore.setState({ iso: tomorrow });
    });
    await returnToTab();
    await waitFor(() => expect(screen.queryByTestId('app-new-day-notice')).toBeNull());
  });

  it('never appears on the BRIEFING, where the rollover re-boots instead', async () => {
    const { bootedIso } = await bootShell();
    expect(gameStore.getState().screen).toBe('briefing');

    const tomorrow = tomorrowOf(bootedIso);
    mocks.today.value = tomorrow;
    await returnToTab();

    // The two are mutually exclusive by construction: one reading of the
    // clock decides both, so a tree that showed the notice here would be one
    // that had stopped re-booting.
    await waitFor(() => expect(gameStore.getState().iso).toBe(tomorrow));
    expect(screen.queryByTestId('app-new-day-notice')).toBeNull();
  });

  it('speaks the active locale', async () => {
    const { bootedIso } = await bootShell();
    act(() => {
      gameStore.setState({ screen: 'lab' });
    });
    mocks.today.value = tomorrowOf(bootedIso);
    await returnToTab();
    await screen.findByTestId('app-new-day-notice');

    await act(async () => {
      screen.getByRole('button', { name: 'Italiano' }).click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('app-new-day-notice').textContent).toBe(itCopy['errors.newDay'])
    );
    expect(itCopy['errors.newDay']).not.toBe(enCopy['errors.newDay']);
  });
});
