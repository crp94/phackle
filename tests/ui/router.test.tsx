// @vitest-environment jsdom
//
// T14's "glue": ScreenRouter (screen -> component mapping + the worker-crash
// error banner) and App.tsx's boot wiring (createEngineClient() + store.boot()
// on mount, once, inside the loading gate). Two describe blocks:
//  - 'ScreenRouter' drives the exported `gameStore` singleton directly with a
//    hand-built fake client (never touching game/engineClient at all), so it
//    needs no module mock.
//  - 'App boot wiring' mocks src/game/engineClient's createEngineClient
//    (via vi.hoisted, the documented pattern for referencing a value from
//    inside a vi.mock factory) so App's real, unmodified boot effect never
//    constructs a real Worker — jsdom has none (verified against this repo's
//    own test environment before writing this file).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App from '../../src/ui/App';
import { ScreenRouter } from '../../src/ui/ScreenRouter';
import { gameStore } from '../../src/game/store';
import { EPOCH } from '../../src/game/tuning';
import { isPractice } from '../../src/game/daily';
import { copy as enCopy } from '../../src/content/en/copy';
import type { EngineClient, ExtendInfo, InitInfo, RevealPayload } from '../../src/engine/protocol';
import type { PathResult } from '../../src/engine/types';

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

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// ScreenRouter — drives the singleton directly, no engineClient mock needed.
// ---------------------------------------------------------------------------

describe('ScreenRouter', () => {
  it('renders the briefing stub once booted (screen stays "briefing" until openData())', async () => {
    const client = makeFakeClient();
    await act(async () => {
      await gameStore.getState().boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: 1 });
    });
    render(
      <LocaleProvider>
        <ScreenRouter />
      </LocaleProvider>
    );
    expect(await screen.findByTestId('stub-briefing')).toBeTruthy();
  });

  it('renders the Lab once openData() has been called', async () => {
    const client = makeFakeClient();
    await act(async () => {
      await gameStore.getState().boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: 1 });
      gameStore.getState().openData();
    });
    render(
      <LocaleProvider>
        <ScreenRouter />
      </LocaleProvider>
    );
    expect(await screen.findByTestId('lab-screen')).toBeTruthy();
  });

  it('the briefing stub\'s CTA calls store.openData() and flips the router to the lab', async () => {
    const client = makeFakeClient();
    await act(async () => {
      await gameStore.getState().boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: 1 });
    });
    render(
      <LocaleProvider>
        <ScreenRouter />
      </LocaleProvider>
    );
    const openBtn = await screen.findByRole('button', { name: enCopy['briefing.openData'] });
    fireEvent.click(openBtn);
    expect(await screen.findByTestId('lab-screen')).toBeTruthy();
  });

  it('renders the worker-crash copy above the current screen when store.error is set, without replacing it', async () => {
    const client = makeFakeClient();
    await act(async () => {
      await gameStore.getState().boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: 1 });
    });
    render(
      <LocaleProvider>
        <ScreenRouter />
      </LocaleProvider>
    );
    await screen.findByTestId('stub-briefing');

    const crashHandler = (client.onCrash as Mock).mock.calls[0][0] as () => void;
    act(() => {
      crashHandler();
    });

    expect(await screen.findByText(enCopy['errors.workerCrash'])).toBeTruthy();
    expect(screen.getByTestId('stub-briefing')).toBeTruthy();
  });

  it('shows no error banner when store.error is null', async () => {
    const client = makeFakeClient();
    await act(async () => {
      await gameStore.getState().boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: 1 });
    });
    render(
      <LocaleProvider>
        <ScreenRouter />
      </LocaleProvider>
    );
    await screen.findByTestId('stub-briefing');
    expect(screen.queryByText(enCopy['errors.workerCrash'])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// App boot wiring — mocks game/engineClient so App's real code path never
// constructs a real Worker (unavailable under jsdom).
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({ createEngineClient: vi.fn() }));
vi.mock('../../src/game/engineClient', () => ({
  createEngineClient: mocks.createEngineClient,
}));

describe('App boot wiring', () => {
  beforeEach(() => {
    mocks.createEngineClient.mockReset();
  });

  it('boots the engine on mount, once content has loaded, and stays on the briefing stub', async () => {
    const client = makeFakeClient();
    mocks.createEngineClient.mockReturnValue(client);

    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );

    await waitFor(() => expect(client.init).toHaveBeenCalledTimes(1));
    const call = (client.init as Mock).mock.calls[0];
    expect(typeof call[0]).toBe('string'); // iso date
    expect(call[1]).toBeGreaterThanOrEqual(20); // real EN content's scenario count

    await waitFor(() => expect(gameStore.getState().mode).toBe('hack'));
    // Whether "today" is pre- or post-EPOCH, isPractice() is the single
    // source of truth the app itself consults — assert against IT, not a
    // hardcoded true/false, so this test can't rot once EPOCH passes.
    expect(gameStore.getState().practice).toBe(isPractice(window.location.search));

    expect(await screen.findByTestId('stub-briefing')).toBeTruthy();
  });

  it('boots exactly once even if App re-renders (mount-once guard)', async () => {
    const client = makeFakeClient();
    mocks.createEngineClient.mockReturnValue(client);

    const { rerender } = render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );
    await waitFor(() => expect(client.init).toHaveBeenCalledTimes(1));

    rerender(
      <LocaleProvider>
        <App puzzleNumber={2}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(client.init).toHaveBeenCalledTimes(1);
  });

  it('surfaces a post-boot crash from the booted client into the error banner', async () => {
    const client = makeFakeClient();
    mocks.createEngineClient.mockReturnValue(client);

    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );
    await waitFor(() => expect(client.onCrash).toHaveBeenCalledTimes(1));

    const crashHandler = (client.onCrash as Mock).mock.calls[0][0] as () => void;
    act(() => {
      crashHandler();
    });

    expect(await screen.findByText(enCopy['errors.workerCrash'])).toBeTruthy();
  });

  it('surfaces a synchronous createEngineClient() failure the same way, instead of crashing the render', async () => {
    mocks.createEngineClient.mockImplementation(() => {
      throw new Error('Worker is not defined');
    });

    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );

    expect(await screen.findByText(enCopy['errors.workerCrash'])).toBeTruthy();
    // The header/shell must survive: this is a friendly banner, not a crash.
    expect(screen.getByText('P-hackle')).toBeTruthy();
  });

  it('keeps the header and toggles intact alongside the new wiring', async () => {
    const client = makeFakeClient();
    mocks.createEngineClient.mockReturnValue(client);
    render(
      <LocaleProvider>
        <App puzzleNumber={7}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );
    expect(await screen.findByText('P-hackle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Paper' })).toBeTruthy();
  });
});
