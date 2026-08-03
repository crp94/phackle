// @vitest-environment jsdom
//
// T16: THE CALL (master spec §2.6, §7.3 "Call"). The skill moment: two large
// option cards over a dimmed cover, and — the point of the whole screen — the
// truth is not fetched until the player has committed.
//
// The store is the real singleton (src/game/store.ts) driven through its real
// flow with a fake EngineClient, so "reveal is not called before the choice"
// is asserted against the actual wiring rather than a mock of it.
import { describe, expect, it, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, cleanup, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { copy } from '../../src/content/en/copy';
import { useGameStore, type GameStore } from '../../src/game/store';
import type { EngineClient, RevealPayload } from '../../src/engine/protocol';
import type { PathResult, Spec } from '../../src/engine/types';
import { Call } from '../../src/ui/screens/Call';

afterEach(cleanup);

const ISO = '2026-09-01';

function payload(): RevealPayload {
  return {
    totalPaths: 1792,
    sigPaths: 87,
    sigFraction: 87 / 1792,
    playerExplored: 14,
    pHitAtK: 0.52,
    curve: [],
    stamp: 'NULL_REPORTED',
    peeks: 0,
    dayType: 'null',
    trueOutcome: null,
    trueBeta: 0,
    hetero: null,
  };
}

function result(p: number): PathResult {
  return {
    spec: { outcome: 0, subgroup: 'all', covariates: { income: false, risk: false }, exclusion: 'none', transform: 'raw', tails: 'two' },
    n: 200,
    beta: 0.4,
    se: 0.1,
    t: 4,
    p,
    ci: [0.2, 0.6],
    excludedCount: 0,
    valid: true,
  };
}

function fakeClient() {
  const calls = { init: 0, runSpec: 0, extend: 0, reveal: 0 };
  const revealArgs: { published: Spec | null; explored: Spec[] }[] = [];
  const client: EngineClient = {
    init: async () => {
      calls.init++;
      return { scenarioIndex: 0, n: 200 };
    },
    runSpec: async () => {
      calls.runSpec++;
      return result(0.01);
    },
    extend: async () => {
      calls.extend++;
      return { n: 250 };
    },
    reveal: async (published, explored) => {
      calls.reveal++;
      revealArgs.push({ published, explored });
      return payload();
    },
    onCrash: () => {},
  };
  return { client, calls, revealArgs };
}

/**
 * Captures the live store so a test can drive the app's REAL flow. Written
 * from an effect, not from render: reassigning an outer binding during render
 * is a side effect, and every driver below awaits `act`, which flushes
 * effects before it returns.
 */
const harness: { store: GameStore | null } = { store: null };
function Capture() {
  const store = useGameStore((s) => s);
  useEffect(() => {
    harness.store = store;
  }, [store]);
  return null;
}
const live = () => harness.store as GameStore;

async function mount(path: 'abandon' | 'submit') {
  const fake = fakeClient();
  const view = render(
    <LocaleProvider>
      <Capture />
      <Call />
    </LocaleProvider>
  );
  await act(async () => {
    await live().boot(fake.client, ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
  });
  act(() => live().openData());
  await act(async () => {
    if (path === 'abandon') await live().abandon();
    else await live().submit();
  });
  await waitFor(() => expect(screen.queryByText(copy['call.real'])).not.toBeNull());
  return { ...fake, view };
}

describe('§2.6 the call — options first, truth strictly after', () => {
  it('renders both option cards without fetching the reveal', async () => {
    const { calls } = await mount('abandon');
    expect(screen.getByText(copy['call.real'])).not.toBeNull();
    expect(screen.getByText(copy['call.noise'])).not.toBeNull();
    expect(screen.getByText(copy['call.realSub'])).not.toBeNull();
    expect(screen.getByText(copy['call.noiseSub'])).not.toBeNull();
    expect(screen.getByText(copy['call.prompt'])).not.toBeNull();
    expect(calls.reveal).toBe(0);
  });

  it('fetches the reveal only once a card is chosen', async () => {
    const { calls, revealArgs } = await mount('abandon');
    expect(calls.reveal).toBe(0);

    await act(async () => {
      fireEvent.click(screen.getByText(copy['call.noise']).closest('button') as HTMLButtonElement);
    });

    await waitFor(() => expect(calls.reveal).toBe(1));
    expect(live().call).toBe('noise');
    expect(live().screen).toBe('reveal');
    expect(live().reveal).not.toBeNull();
    expect(revealArgs[0].published).toBeNull();
  });

  it('carries the published spec into the reveal request on the publish path', async () => {
    const { revealArgs } = await mount('submit');
    await act(async () => {
      fireEvent.click(screen.getByText(copy['call.real']).closest('button') as HTMLButtonElement);
    });
    await waitFor(() => expect(revealArgs.length).toBe(1));
    expect(revealArgs[0].published).not.toBeNull();
    expect(live().call).toBe('real');
  });

  it('does not double-fire while the reveal request is in flight', async () => {
    const { calls } = await mount('abandon');
    const button = screen.getByText(copy['call.real']).closest('button') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await waitFor(() => expect(calls.reveal).toBe(1));
  });
});

describe('§7.3 / R6 the call is a keyboard-operable dialog', () => {
  it('names itself as a dialog for assistive technology', async () => {
    await mount('abandon');
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain(copy['call.prompt']);
  });

  it('moves focus between the two cards with the arrow keys', async () => {
    await mount('abandon');
    const real = screen.getByText(copy['call.real']).closest('button') as HTMLButtonElement;
    const noise = screen.getByText(copy['call.noise']).closest('button') as HTMLButtonElement;

    real.focus();
    fireEvent.keyDown(real, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(noise);

    fireEvent.keyDown(noise, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(real);

    fireEvent.keyDown(real, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(noise);
  });

  it('commits on Enter, because the options are real buttons', async () => {
    const { calls } = await mount('abandon');
    const real = screen.getByText(copy['call.real']).closest('button') as HTMLButtonElement;
    expect(real.tagName).toBe('BUTTON');
    await act(async () => {
      fireEvent.click(real); // Enter on a <button> is a native click
    });
    await waitFor(() => expect(calls.reveal).toBe(1));
  });
});

describe('container-agnostic', () => {
  it('renders the same content whether it is the screen or an overlay child', async () => {
    const fake = fakeClient();
    const view = render(
      <LocaleProvider>
        <Capture />
        <div data-testid="overlay">
          <Call />
        </div>
      </LocaleProvider>
    );
    await act(async () => {
      await live().boot(fake.client, ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    act(() => live().openData());
    await act(async () => {
      await live().submit();
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
    // No full-screen/backdrop assumption: the dialog is simply inside whatever
    // container it was given.
    expect(view.getByTestId('overlay').querySelector('[role="dialog"]')).not.toBeNull();
    expect(fake.calls.reveal).toBe(0);
  });

  it('renders nothing before the player has published or abandoned', async () => {
    const fake = fakeClient();
    render(
      <LocaleProvider>
        <Capture />
        <Call />
      </LocaleProvider>
    );
    await act(async () => {
      await live().boot(fake.client, ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    act(() => live().openData());
    await waitFor(() => expect(live().screen).toBe('lab'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fake.calls.reveal).toBe(0);
  });
});

// Guard against a future refactor that "helpfully" prefetches the payload.
describe('spoiler safety', () => {
  it('never touches the reveal RPC during boot, lab work, or publication', async () => {
    const fake = fakeClient();
    render(
      <LocaleProvider>
        <Capture />
        <Call />
      </LocaleProvider>
    );
    await act(async () => {
      await live().boot(fake.client, ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    act(() => live().openData());
    await act(async () => {
      await live().peekAndExtend();
    });
    await act(async () => {
      await live().submit();
    });
    await waitFor(() => expect(live().screen).toBe('published'));
    expect(fake.calls.reveal).toBe(0);
  });
});
