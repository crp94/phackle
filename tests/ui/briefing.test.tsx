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
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { createGameStore, type GameStore } from '../../src/game/store';
import { content as enContent } from '../../src/content/en';
import { isoFromPuzzleNumber } from '../../src/game/puzzleDate';
import { pickGrantwellEmail } from '../../src/game/briefing';
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

  it('renders "Corresponding author: Prof. R. Grantwell" (existing copy key)', async () => {
    renderBriefing();
    await waitFor(() => expect(screen.getByText('Corresponding author: Prof. R. Grantwell')).toBeTruthy());
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
