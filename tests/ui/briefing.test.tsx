// @vitest-environment jsdom
//
// T15: the BRIEFING screen (manuscript title page + Prof. Grantwell's daily
// email, Act I's setup). Same conventions as tests/ui/published.test.tsx:
// no @testing-library/jest-dom, afterEach(cleanup) (test.globals is off), a
// fake, isolated createGameStore() instance injected via the `useStore` prop
// rather than touching the app's real singleton.
//
// pickGrantwellEmail's own algorithm (determinism, pool membership,
// rotation) is unit-tested directly in tests/game/briefing.test.ts; it is
// only imported here to compute the EXPECTED value for the wiring tests
// below, the same "test the wiring, not the algorithm" split
// tests/ui/published.test.tsx uses for pickJournal/pickPress.
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { createGameStore, type GameStore } from '../../src/game/store';
import { content as enContent } from '../../src/content/en';
import { isoFromPuzzleNumber } from '../../src/game/puzzleDate';
import { pickGrantwellEmail } from '../../src/game/briefing';
import type { PersistedState } from '../../src/game/storage';
import { Briefing } from '../../src/ui/screens/Briefing';

function makeFakeStoreHook(overrides: Partial<GameStore>) {
  const store = createGameStore();
  store.setState(overrides);
  function useFakeStore<T>(selector: (s: GameStore) => T): T {
    return zustandUseStore(store, selector);
  }
  return { useFakeStore, store };
}

function renderBriefing(overrides: Partial<GameStore> = {}) {
  const { useFakeStore, store } = makeFakeStoreHook({ scenarioIndex: 0, puzzleNumber: 1, ...overrides });
  const utils = render(
    <LocaleProvider>
      <Briefing useStore={useFakeStore} />
    </LocaleProvider>
  );
  return { store, ...utils };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Briefing', () => {
  it('renders the scenario question as the manuscript title', async () => {
    renderBriefing();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(enContent.scenarios[0].question);
  });

  it('renders the scenario cover story', async () => {
    renderBriefing();
    await waitFor(() => expect(screen.getByText(enContent.scenarios[0].coverStory)).toBeTruthy());
  });

  it('renders "Corresponding author: You" (review fix: the player is the author, Grantwell is only the PI emailing them)', async () => {
    renderBriefing();
    await waitFor(() => expect(screen.getByText('Corresponding author: You')).toBeTruthy());
  });

  it("renders Prof. Grantwell's EmailCard with the correct from/subject/body, rotated by date", async () => {
    const iso = isoFromPuzzleNumber(1);
    const expectedBody = pickGrantwellEmail(enContent.grantwell, iso);

    renderBriefing({ puzzleNumber: 1 });

    await waitFor(() => expect(screen.getByText('Prof. R. Grantwell')).toBeTruthy());
    expect(screen.getByText('Re: the deadline')).toBeTruthy();
    expect(screen.getByText(expectedBody)).toBeTruthy();
  });

  it('picks a different Grantwell line for a different puzzle number (different iso)', async () => {
    // Any two puzzle numbers whose isos land on different bank indices --
    // computed directly, not hand-guessed, exactly like the pickPress tests.
    const bodies = new Set(
      Array.from({ length: 30 }, (_, i) => pickGrantwellEmail(enContent.grantwell, isoFromPuzzleNumber(i + 1)))
    );
    expect(bodies.size).toBeGreaterThan(1);
  });

  it('clicking "Open Data" calls store.openData() and nothing else', async () => {
    const openDataSpy = vi.fn();
    renderBriefing({ openData: openDataSpy as unknown as GameStore['openData'] });
    await waitFor(() => expect(screen.getByText('Open Data')).toBeTruthy());

    fireEvent.click(screen.getByText('Open Data'));

    expect(openDataSpy).toHaveBeenCalledTimes(1);
  });

  it('renders nothing before content has loaded (behind the app-level gate)', () => {
    const { store } = makeFakeStoreHook({ scenarioIndex: 0, puzzleNumber: 1 });
    function useFakeStore<T>(selector: (s: GameStore) => T): T {
      return zustandUseStore(store, selector);
    }
    const { container } = render(
      <LocaleProvider>
        <Briefing useStore={useFakeStore} />
      </LocaleProvider>
    );
    // Synchronous assertion (see tests/ui/shell.test.tsx's own "App loading
    // gate" test): getContent()'s dynamic import never resolves within the
    // same microtask, so this always observes the pre-load state.
    expect(container.textContent).toBe('');
  });
});

// --- T18: the mode chooser (§2.2 "prereg unlocked: choose mode first") ------
//
// loadState()-driven (Briefing.tsx reads it directly, same convention as
// Summary.tsx's persistAndComputeSummary — see that file's own precedent),
// so every test here seeds real localStorage first.
describe('Briefing — the mode chooser', () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  const copy = enContent.copy;

  it('renders no chooser — only the plain Open Data CTA — when Prereg Mode is NOT unlocked', async () => {
    seedStorage(freshV1());
    renderBriefing();
    await waitFor(() => expect(screen.getByText(copy['briefing.openData'])).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
    expect(screen.queryByText(copy['briefing.playPrereg'])).toBeNull();
  });

  it('renders the chooser once unlocked (achievements.first_retraction set) and prereg not yet played today', async () => {
    seedStorage(freshV1({ achievements: { first_retraction: '2026-08-01' } }));
    renderBriefing({ puzzleNumber: 1 });
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());
    expect(screen.getByRole('button', { name: copy['briefing.playHacking'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: copy['briefing.playPrereg'] })).toBeTruthy();
    // The chooser REPLACES the plain "Open Data" CTA, not shown alongside it.
    expect(screen.queryByRole('button', { name: copy['briefing.openData'] })).toBeNull();
  });

  it('hides the chooser entirely once prereg has already been played today (falls back to the plain Open Data CTA)', async () => {
    const iso = isoFromPuzzleNumber(1);
    seedStorage(
      freshV1({
        achievements: { first_retraction: '2026-08-01' },
        history: { [iso]: { prereg: { mode: 'prereg', score: 100, forks: 0, stamp: 'REPLICATED', shareString: '' } } },
      })
    );
    renderBriefing({ puzzleNumber: 1 });
    await waitFor(() => expect(screen.getByText(copy['briefing.openData'])).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
  });

  it('disables the hacking option and shows "already played today" when hack was already played (belt and suspenders on top of the persist-layer guard)', async () => {
    const iso = isoFromPuzzleNumber(1);
    seedStorage(
      freshV1({
        achievements: { first_retraction: '2026-08-01' },
        history: { [iso]: { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'RETRACTED', shareString: '' } } },
      })
    );
    renderBriefing({ puzzleNumber: 1 });
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());

    const hackButton = screen.getByRole('button', { name: copy['briefing.playHacking'] });
    expect(hackButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(copy['briefing.alreadyPlayedToday'])).toBeTruthy();
    // Prereg is a SEPARATE guard — still open, since only hack was played.
    expect(screen.getByRole('button', { name: copy['briefing.playPrereg'] }).hasAttribute('disabled')).toBe(false);
  });

  it('clicking "Play Hacking Mode" calls the existing, already-tested store.openData() — nothing else', async () => {
    const openDataSpy = vi.fn();
    seedStorage(freshV1({ achievements: { first_retraction: '2026-08-01' } }));
    renderBriefing({ puzzleNumber: 1, openData: openDataSpy as unknown as GameStore['openData'] });
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: copy['briefing.playHacking'] }));

    expect(openDataSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking "Play Prereg Mode" calls store.chooseMode(\'prereg\') — nothing else', async () => {
    const chooseModeSpy = vi.fn();
    seedStorage(freshV1({ achievements: { first_retraction: '2026-08-01' } }));
    renderBriefing({ puzzleNumber: 1, chooseMode: chooseModeSpy as unknown as GameStore['chooseMode'] });
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: copy['briefing.playPrereg'] }));

    expect(chooseModeSpy).toHaveBeenCalledTimes(1);
    expect(chooseModeSpy).toHaveBeenCalledWith('prereg');
  });
});
