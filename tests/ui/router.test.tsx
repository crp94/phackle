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
import { StrictMode } from 'react';
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
    capExhausted: false, // gr6-102 (W5): required field on RevealPayload
    ...overrides,
  };
}

/** Same idiom as tests/game/store.test.ts's own `deferred` — a promise this
 * test resolves on its own schedule, so a fake client's init() can be held
 * "in flight" for as long as an assertion needs it. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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
  it('renders the real Briefing once booted (screen stays "briefing" until openData()) -- updated at merge integration: registry now maps briefing to the T15 component', async () => {
    const client = makeFakeClient();
    await act(async () => {
      await gameStore.getState().boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: 1 });
    });
    render(
      <LocaleProvider>
        <ScreenRouter />
      </LocaleProvider>
    );
    expect(await screen.findByRole('button', { name: enCopy['briefing.openData'] })).toBeTruthy();
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

  it('the Briefing CTA calls store.openData() and flips the router to the lab', async () => {
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
    await screen.findByRole('button', { name: enCopy['briefing.openData'] });

    const crashHandler = (client.onCrash as Mock).mock.calls[0][0] as () => void;
    act(() => {
      crashHandler();
    });

    expect(await screen.findByText(enCopy['errors.workerCrash'])).toBeTruthy();
    expect(screen.getByRole('button', { name: enCopy['briefing.openData'] })).toBeTruthy();
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
    await screen.findByRole('button', { name: enCopy['briefing.openData'] });
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

  it('boots the engine on mount, once content has loaded, and stays on the Briefing screen', async () => {
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

    expect(await screen.findByRole('button', { name: enCopy['briefing.openData'] })).toBeTruthy();
  });

  // gr6-110 / gr1c-022. THREE tests for the `didBootRef` guard (App.tsx:79,
  // checked at :123), because the one that was here tested none of it, and
  // because the fix gr1c-022 proposed does not — measured — discriminate it
  // either. What each one is worth, stated honestly:
  //
  //  1. RE-RENDER with a changed prop. Does not exercise the guard at all: the
  //     effect's dependency array is [content, boot], neither of which moves,
  //     so React never re-runs the effect and the test passes against an
  //     implementation with no ref in the effect whatsoever. Kept as a
  //     composition regression test; it is not evidence about the ref.
  //
  //  2. STRICTMODE, the mode the real app ships with (src/main.tsx:29). React
  //     19's dev double-invoke mounts, runs the effect, tears it down and runs
  //     it again — but ONLY on mount. Probed directly in this environment:
  //     an effect whose dep is null at mount and set asynchronously afterwards
  //     runs `[null, null, loaded]` — the mount pass doubles, the later dep
  //     change does not. App's boot effect is behind exactly such a gate
  //     (`content` is null until LocaleProvider's dynamic import resolves), so
  //     both double-invoke passes take the `!content` early return and the
  //     guard is never reached. Deleting `didBootRef` therefore leaves this
  //     test GREEN. It is kept because it pins boot-once under the mode that
  //     ships, but it is NOT the discriminating case, and gr1c-022's proposed
  //     fix would have shipped believing it was.
  //
  //  3. LOCALE SWITCH — the discriminating case, and the production one. The
  //     header ships a LocaleToggle (App.tsx:227), so `content` really does
  //     change identity mid-session: null -> EN -> null -> IT. That re-runs
  //     the boot effect on the SAME instance with `content` truthy, which is
  //     precisely the arm `didBootRef` guards. Deleting the ref makes this go
  //     red (a second createEngineClient + a second boot(), silently resetting
  //     the player's log mid-day). Note App.tsx's own comment there — "locale
  //     never switches after first load" — is stale; this test is the proof.
  it('boots exactly once under <StrictMode> (the mode the real app ships with — src/main.tsx)', async () => {
    const client = makeFakeClient();
    mocks.createEngineClient.mockReturnValue(client);

    render(
      <StrictMode>
        <LocaleProvider>
          <App puzzleNumber={1}>
            <ScreenRouter />
          </App>
        </LocaleProvider>
      </StrictMode>
    );

    await waitFor(() => expect(client.init).toHaveBeenCalled());
    // Settle the second effect pass before counting, so this asserts "exactly
    // once after the double-invoke has happened", not "once, so far".
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(client.init).toHaveBeenCalledTimes(1);
    expect(mocks.createEngineClient).toHaveBeenCalledTimes(1);
  });

  it('boots exactly once across a live locale switch — the header control really does change `content` mid-session', async () => {
    const client = makeFakeClient();
    mocks.createEngineClient.mockReturnValue(client);

    render(
      <StrictMode>
        <LocaleProvider>
          <App puzzleNumber={1}>
            <ScreenRouter />
          </App>
        </LocaleProvider>
      </StrictMode>
    );
    await waitFor(() => expect(client.init).toHaveBeenCalledTimes(1));

    // Driven through the app's OWN header control, not through setLocale
    // directly, so the test breaks if the toggle stops being wired up.
    fireEvent.click(await screen.findByRole('button', { name: enCopy['nav.localeNameIt'] }));

    // The Italian bundle is a dynamic import, and App's loading gate unmounts
    // the whole header (including this toggle) while it is in flight — so the
    // button must be RE-QUERIED, not held across the switch. Wait for the
    // switch to actually land before counting, or this asserts nothing.
    await waitFor(() => {
      const itButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.ph-seg--locale')).find(
        (b) => b.textContent?.includes('IT')
      );
      expect(itButton?.getAttribute('aria-pressed')).toBe('true');
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(client.init).toHaveBeenCalledTimes(1);
    expect(mocks.createEngineClient).toHaveBeenCalledTimes(1);
  });

  it('boots exactly once even if App re-renders (composition regression; does NOT exercise didBootRef — see above)', async () => {
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

  // T40 (FINDING F2) — the jsdom-blind gap the T23 report named explicitly:
  // every OTHER test in this describe block injects a client whose init()
  // resolves on the same microtask it's called, so the "content loaded, day
  // not yet fixed" window this test targets never lasts long enough for an
  // assertion to land inside it. Holding init() open with a controlled
  // deferred is what makes that window observable at all.
  it('holds the loading placeholder — labeled via a11y.loading — until store.boot() has fixed the day, not merely once content has loaded', async () => {
    const init = deferred<{ scenarioIndex: number; n: 200 }>();
    const client: EngineClient = {
      init: () => init.promise,
      runSpec: vi.fn().mockResolvedValue(makeResult()),
      extend: vi.fn().mockResolvedValue({ n: 250 } satisfies ExtendInfo),
      reveal: vi.fn().mockResolvedValue(makeRevealPayload()),
      onCrash: vi.fn(),
    };
    mocks.createEngineClient.mockReturnValue(client);

    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );

    // Content has loaded (the pre-T40 gate would already show the header and
    // the Briefing here — that IS finding F2), but client.init() is still
    // pending, so the day is not fixed. `waitFor` rather than a single
    // assertion: the FIRST loading render (content itself still in flight)
    // shares the same data-testid but carries no aria-label, so this polls
    // past that phase into the one this test is actually about.
    await waitFor(() => {
      const loading = screen.getByTestId('app-loading');
      expect(loading.getAttribute('aria-label')).toBe(enCopy['a11y.loading']);
      expect(loading.getAttribute('role')).toBe('status');
    });
    expect(screen.queryByText('P-hackle')).toBeNull();
    expect(screen.queryByRole('button', { name: enCopy['briefing.openData'] })).toBeNull();

    await act(async () => {
      init.resolve({ scenarioIndex: 0, n: 200 });
    });

    expect(await screen.findByRole('button', { name: enCopy['briefing.openData'] })).toBeTruthy();
    expect(screen.queryByTestId('app-loading')).toBeNull();
  });
});
