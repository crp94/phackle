// @vitest-environment jsdom
//
// T17: App.tsx's header nav (stats/legend/about) — a tiny local page-state,
// deliberately separate from tests/ui/shell.test.tsx (T5's file, unmodified
// here; App.tsx's pre-existing behaviour is still covered by that whole
// suite, re-run green above). Same no-jest-dom convention as the rest of
// tests/ui/*.
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App from '../../src/ui/App';
import { ScreenRouter } from '../../src/ui/ScreenRouter';
import { useGameStore, type GameStore } from '../../src/game/store';
import type { EngineClient } from '../../src/engine/protocol';
import type { PathResult, Spec } from '../../src/engine/types';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => cleanup());

async function renderApp() {
  render(
    <LocaleProvider>
      <App puzzleNumber={1}>
        <div data-testid="game-child">the running game</div>
      </App>
    </LocaleProvider>
  );
  await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
}

describe('App header nav — stats/legend/about, a local page-state (not the game machine)', () => {
  it('shows the game (children) by default, with no nav page mounted', async () => {
    await renderApp();
    expect(screen.getByTestId('game-child')).toBeTruthy();
    expect(screen.queryByText('Your stats')).toBeNull();
  });

  it('Stats: clicking the nav button swaps <main> to the Stats page and hides the game', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.getByText('Your stats')).toBeTruthy();
    expect(screen.queryByTestId('game-child')).toBeNull();
  });

  it('Legend: clicking the nav button swaps <main> to the Legend page', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    expect(screen.getByText('How to read a shared result.')).toBeTruthy();
    expect(screen.queryByTestId('game-child')).toBeNull();
  });

  it('About: clicking the nav button swaps <main> to the About page', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByText('About P-hackle')).toBeTruthy();
    expect(screen.queryByTestId('game-child')).toBeNull();
  });

  it('marks the current nav page with aria-pressed=true, and the others false', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    expect(screen.getByRole('button', { name: 'Legend' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Stats' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'About' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('each nav page\'s own Close button returns to the game', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.queryByTestId('game-child')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByTestId('game-child')).toBeTruthy();
    expect(screen.queryByText('Your stats')).toBeNull();
  });

  it('navigating directly from one nav page to another works without detouring through the game', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.getByText('Your stats')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByText('About P-hackle')).toBeTruthy();
    expect(screen.queryByText('Your stats')).toBeNull();
  });

  it('the theme and locale toggles keep working once the nav has been used (still "live", per the T17 brief)', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

/* ================================================================
   T33 — getting BACK (owner, play-test round 5: "hard to go back to the
   main page when you click one of the menus"). Two affordances, both in
   the shell: the masthead wordmark, and an explicit Play item that is on
   screen for exactly as long as a nav page is.
   ================================================================ */

describe('App header — Home/Play affordances', () => {
  it('makes the masthead wordmark a real control back to the game', async () => {
    await renderApp();
    const home = screen.getByRole('button', { name: "P-hackle: back to today's puzzle" });
    expect(home.textContent).toBe('P-hackle');

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.queryByTestId('game-child')).toBeNull();

    fireEvent.click(home);
    expect(screen.getByTestId('game-child')).toBeTruthy();
    expect(screen.queryByText('About P-hackle')).toBeNull();
  });

  it('shows the Play item on every nav page and hides it on the game itself', async () => {
    await renderApp();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();

    for (const page of ['Stats', 'Legend', 'About']) {
      fireEvent.click(screen.getByRole('button', { name: page }));
      expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByTestId('game-child')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('returns from every nav page in one tap', async () => {
    await renderApp();
    for (const page of ['Stats', 'Legend', 'About']) {
      fireEvent.click(screen.getByRole('button', { name: page }));
      expect(screen.queryByTestId('game-child')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      expect(screen.getByTestId('game-child')).toBeTruthy();
    }
  });
});

/* ================================================================
   T33 — "never restarts the day": the nav's page-state is orthogonal to
   the game machine, so coming back resumes whatever screen the STORE is
   on, with the day's log intact. Driven through the real store and the
   real ScreenRouter, not a stand-in child.
   ================================================================ */

const SPEC: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function result(p: number): PathResult {
  return { spec: SPEC, n: 200, beta: 0.4, se: 0.1, t: 4, p, ci: [0.2, 0.6], excludedCount: 0, valid: true };
}

const fakeClient: EngineClient = {
  init: async () => ({ scenarioIndex: 0, n: 200 }),
  runSpec: async () => result(0.2),
  extend: async () => ({ n: 250 }),
  reveal: async () => {
    throw new Error('not reached');
  },
  onCrash: () => {},
};

const harness: { store: GameStore | null } = { store: null };
function Capture() {
  const store = useGameStore((s) => s);
  useEffect(() => {
    harness.store = store;
  }, [store]);
  return null;
}
const live = () => harness.store as GameStore;

describe('App header — a nav detour never restarts the day', () => {
  it('resumes the store\'s own screen, with the day\'s state, after Legend/About/Stats', async () => {
    render(
      <LocaleProvider>
        <Capture />
        <App puzzleNumber={1}>
          <ScreenRouter />
        </App>
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    // Boot the REAL store over a scripted client (App's own boot attempt has
    // already failed harmlessly: jsdom has no Worker, and boot() resets the
    // whole state anyway), then walk the day as far as the Lab.
    await act(async () => {
      await live().boot(fakeClient, '2026-09-01', { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    act(() => live().openData());
    await waitFor(() => expect(screen.getByTestId('lab-screen')).toBeTruthy());
    const logBefore = live().log.length;
    expect(live().screen).toBe('lab');

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.queryByTestId('lab-screen')).toBeNull();
    // The detour is a VIEW change only: the machine never moved.
    expect(live().screen).toBe('lab');

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByTestId('lab-screen')).toBeTruthy();
    expect(live().screen).toBe('lab');
    expect(live().log.length).toBe(logBefore);
    expect(live().result).not.toBeNull();
  });
});
