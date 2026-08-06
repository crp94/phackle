// @vitest-environment jsdom
//
// T17: App.tsx's header nav (stats/legend/about) — a tiny local page-state,
// deliberately separate from tests/ui/shell.test.tsx (T5's file, unmodified
// here; App.tsx's pre-existing behaviour is still covered by that whole
// suite, re-run green above). Same no-jest-dom convention as the rest of
// tests/ui/*.
import { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App from '../../src/ui/App';
import { useAppNav } from '../../src/ui/nav';
import { ScreenRouter } from '../../src/ui/ScreenRouter';
import { gameStore, useGameStore, type GameStore } from '../../src/game/store';
import { copy as enCopy } from '../../src/content/en/copy';
import type { EngineClient } from '../../src/engine/protocol';
import type { PathResult, Spec } from '../../src/engine/types';


// gr6-007 — THE SHELL UNDER TEST IS THE BOOTED SHELL.
//
// App now renders the boot-failure screen INSTEAD of the shell when a boot
// never produced a day (`storeError && !booted`), because the alternative was
// a real-looking briefing for scenario #0 with a live CTA into a Lab that can
// never compute. Every test in this file exercises the shell, and jsdom has
// no `Worker`, so App's own boot attempt throws harmlessly into `store.error`
// and would now take the page. Seeding `booted` says out loud what these
// tests always assumed: the header, the nav and the screen slot are what a
// player sees AFTER a day exists. The boot-failure screen has its own tests
// (tests/ui/shell.test.tsx's "boot failure" block).
beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  gameStore.setState({ booted: true });
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
    // W2/gr6-030: looked up, not retyped -- the assertion is "the Legend page
    // rendered", not "the Legend page says this exact sentence".
    expect(screen.getByText(enCopy['legend.intro'])).toBeTruthy();
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

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

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

/* ================================================================
   T33 fix round 1 — the header's nested rows must all wrap.

   THE INCIDENT this pins. T33 added a fourth item (Play) to
   .ph-header__nav and a second option to the theme control, then "fixed"
   the header's known horizontal overflow by putting `flex-wrap: wrap` on
   the PARENT row (.ph-header__controls) only. That bought nothing: a
   nested flex row that cannot wrap is a single unbreakable flex item to
   its parent, so the four nav buttons stayed one rigid block. Measured
   against the production build at 360w with Play showing — the exact
   configuration the original measurement never visited — Italian
   overflowed the document by 68px and pushed the ES locale button
   entirely off-screen: an Italian player could not reach Spanish. English
   on the game screen, the one cell that WAS measured, is also the one
   cell where Play does not exist and the labels are shortest.

   WHY THIS IS A SOURCE-TEXT CHECK. jsdom implements no layout: every
   width in it is 0, so a real overflow assertion is impossible here at
   any price. This is the cheapest HONEST guard available in this suite —
   it cannot see an overflow, only the absence of the property whose
   absence caused one. The real pin is a locale-aware layout check at 360
   with Play showing, which belongs to T23's E2E scope and is booked
   there. Same regex-over-source-text idiom as tests/ui/tokens.test.ts.
   ================================================================ */

// Resolved from the vitest root, NOT from `import.meta.url`: this file runs
// under @vitest-environment jsdom, where import.meta.url is an http:// URL
// and fileURLToPath rejects it ("The URL must be of scheme file").
// tests/ui/tokens.test.ts can use the import.meta idiom because it has no
// environment pragma and therefore runs in node.
const APP_CSS = readFileSync(resolve(process.cwd(), 'src/ui/App.css'), 'utf8');

/** The declaration block of one selector, comments already stripped. */
function ruleBody(selector: string): string {
  const css = APP_CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const match = new RegExp(`(^|[},])\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!match) throw new Error(`no rule found for ${selector}`);
  return match[2];
}

describe('App header — every nested row wraps (360w overflow regression)', () => {
  it.each(['.ph-header__controls', '.ph-header__nav'])('%s declares flex-wrap: wrap', (selector) => {
    expect(ruleBody(selector)).toMatch(/flex-wrap:\s*wrap/);
  });

  it('still finds the rules it claims to be checking (guards the guard)', () => {
    expect(ruleBody('.ph-header__nav')).toMatch(/display:\s*flex/);
    expect(() => ruleBody('.ph-header__nonexistent')).toThrow(/no rule found/);
  });
});

/* ==========================================================================
   gr6-060 — the nav's buttons used to move under the finger. PLAY was
   INSERTED AT THE HEAD of this row the instant a nav page opened, so every
   remaining item shifted right by the width of the word and the next tap,
   aimed at Legend, landed on Stats.
   ========================================================================== */
describe('gr6-060 — the nav row keeps its coordinates when PLAY appears', () => {
  const navLabels = () =>
    Array.from(document.querySelectorAll('.ph-header__nav .ph-seg')).map((b) => b.textContent);

  it('appends PLAY rather than prepending it: the three page tabs never change index', async () => {
    await renderApp();
    expect(navLabels()).toEqual(['Stats', 'Legend', 'About']);

    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(navLabels()).toEqual(['Stats', 'Legend', 'About', 'Play']);

    // The property that matters, stated as the thing a finger experiences:
    // every tab that existed before is still at the same index afterwards.
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    expect(navLabels().slice(0, 3)).toEqual(['Stats', 'Legend', 'About']);
  });
});

/* ==========================================================================
   gr6-062 — the Summary's "your stats" action, wired. W6 shipped the control
   behind an `onViewStats` prop and left it dark, because registry.ts types
   every screen as a bare ComponentType and there was nowhere to thread a
   callback. src/ui/nav.ts's context is the route.
   ========================================================================== */
describe('gr6-062 — the shell hands machine screens a route to Stats', () => {
  function StatsProbe() {
    const nav = useAppNav();
    return (
      <button type="button" data-testid="probe-view-stats" onClick={() => nav?.viewStats()}>
        {nav ? 'wired' : 'dark'}
      </button>
    );
  }

  it('provides the route around <main>, and using it swaps the nav page to Stats', async () => {
    gameStore.setState({ booted: true });
    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <StatsProbe />
        </App>
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByTestId('probe-view-stats')).toBeTruthy());
    expect(screen.getByTestId('probe-view-stats').textContent).toBe('wired');

    fireEvent.click(screen.getByTestId('probe-view-stats'));
    expect(screen.getByRole('button', { name: 'Stats' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('is null outside the shell, so a screen rendered standalone shows no dead control', () => {
    render(<StatsProbe />);
    expect(screen.getByTestId('probe-view-stats').textContent).toBe('dark');
  });
});
