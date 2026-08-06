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
import { copy as enCopy } from '../../src/content/en/copy';
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
    // gr6-070: the subject is DATA now, not the one `briefing.emailSubject`
    // constant that used to sit over all twenty-two bodies. It comes off the
    // parallel bank at the same index as the body, so the pair on screen is
    // the pair that was written together.
    const expectedSubject = pickGrantwellEmail(enContent.grantwellSubjects, iso);

    renderBriefing({ puzzleNumber: 1 });

    await waitFor(() => expect(screen.getByText('Prof. R. Grantwell')).toBeTruthy());
    expect(screen.getByText(expectedSubject)).toBeTruthy();
    expect(screen.getByText(expectedBody)).toBeTruthy();
  });

  it('pairs the subject with ITS OWN body — index for index, not two independent rotations (gr6-070)', async () => {
    // The defect is only visible across days: a subject bank rotated on its
    // own seed would still pair correctly some of the time. This walks
    // several puzzle numbers and requires the rendered pair to be at the same
    // bank index every time.
    for (const puzzleNumber of [1, 2, 3, 7, 13]) {
      const iso = isoFromPuzzleNumber(puzzleNumber);
      const bodyIndex = enContent.grantwell.indexOf(pickGrantwellEmail(enContent.grantwell, iso));
      const subjectIndex = enContent.grantwellSubjects.indexOf(pickGrantwellEmail(enContent.grantwellSubjects, iso));
      expect(subjectIndex, `puzzle ${puzzleNumber}: subject and body came off different indices`).toBe(bodyIndex);

      renderBriefing({ puzzleNumber });
      await waitFor(() => expect(screen.getByText('Prof. R. Grantwell')).toBeTruthy());
      expect(screen.getByText(enContent.grantwellSubjects[bodyIndex])).toBeTruthy();
      expect(screen.getByText(enContent.grantwell[bodyIndex])).toBeTruthy();
      cleanup();
    }
  });

  it('picks a different Grantwell line for a different puzzle number (different iso)', async () => {
    // Any two puzzle numbers whose isos land on different bank indices --
    // computed directly, not hand-guessed, exactly like the pickPress tests.
    const bodies = new Set(
      Array.from({ length: 30 }, (_, i) => pickGrantwellEmail(enContent.grantwell, isoFromPuzzleNumber(i + 1)))
    );
    expect(bodies.size).toBeGreaterThan(1);
  });

  // T37: the CTA's English value is 'Open the data' (T36 audit §5.1) -- it was
  // 'Open Data', the catalog's one Title-Cased action and a homograph of the
  // open-data badge noun, which is exactly how both locales mistranslated it.
  it('clicking "Open the data" calls store.openData() and nothing else', async () => {
    const openDataSpy = vi.fn();
    renderBriefing({ openData: openDataSpy as unknown as GameStore['openData'] });
    await waitFor(() => expect(screen.getByText('Open the data')).toBeTruthy());

    fireEvent.click(screen.getByText('Open the data'));

    expect(openDataSpy).toHaveBeenCalledTimes(1);
  });

  // T31 (second play-test round: "the UX/UI is hard to understand, it
  // requires more explanation"). The briefing now states the task outright,
  // before the cover story's fiction gets a chance to bury it.
  it('states the goal in one line, directly under the title card', async () => {
    const { container } = renderBriefing();
    await waitFor(() => expect(screen.getByText(enCopy['briefing.goal'])).toBeTruthy());

    const goal = container.querySelector('[data-testid="briefing-goal"]');
    expect(goal?.textContent).toBe(enCopy['briefing.goal']);

    // "Under the title card" = after the question + corresponding-author
    // line, and before the cover story — the first thing read after the title.
    const order = Array.from(container.querySelectorAll('h1, [data-testid="briefing-goal"], .ph-briefing__cover-story'));
    expect(order.map((el) => el.tagName.toLowerCase() === 'h1' ? 'title' : el.getAttribute('data-testid') ?? 'cover')).toEqual([
      'title',
      'briefing-goal',
      'cover',
    ]);
  });

  it('names the target explicitly, so nobody has to infer what "significant" means here', () => {
    expect(enCopy['briefing.goal']).toMatch(/0\.05/);
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

  // §1(j)(1): "not unlocked" is now "no day has ever been completed" — i.e.
  // day one, for everybody, which is the only state that still hides the
  // chooser. `freshV1()` has an empty history, so this fixture says exactly
  // that and needed no edit.
  it('renders no chooser — only the plain "Open the data" CTA — when Prereg Mode is NOT unlocked (no day completed yet)', async () => {
    seedStorage(freshV1());
    renderBriefing();
    await waitFor(() => expect(screen.getByText(copy['briefing.openData'])).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
    expect(screen.queryByText(copy['briefing.playPrereg'])).toBeNull();
  });

  // §1(j)(1): the unlock fixture is a COMPLETED DAY, not an achievement.
  // `achievements` is left empty on purpose — this is the honest player, who
  // never earns first_retraction and used to never see this chooser at all.
  it('renders the chooser once a day has been completed (no achievement required) and today is unspent', async () => {
    seedStorage(freshV1({ history: { '2026-08-01': { hack: { mode: 'hack', score: 80, forks: 0, stamp: 'NULL_REPORTED', shareString: '' } } } }));
    renderBriefing({ puzzleNumber: 1 });
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());
    expect(screen.getByRole('button', { name: copy['briefing.playHacking'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: copy['briefing.playPrereg'] })).toBeTruthy();
    // The chooser REPLACES the plain "Open the data" CTA, not shown alongside it.
    expect(screen.queryByRole('button', { name: copy['briefing.openData'] })).toBeNull();
  });

  // §1(j) SAME-DAY REOPENING IS REFUSED (the decision, at Briefing.tsx's
  // `preregAvailable`). This used to fall back to the plain "Open the data"
  // CTA — a second play of the same puzzle, after Act II had shown the day
  // type, the true outcome and every significant path. The day is finished.
  it('a prereg day already played today FINISHES the day — no chooser and no hacking fallback', async () => {
    const iso = isoFromPuzzleNumber(1);
    seedStorage(
      freshV1({
        history: { [iso]: { prereg: { mode: 'prereg', score: 100, forks: 0, stamp: 'REPLICATED', shareString: '' } } },
      })
    );
    renderBriefing({ puzzleNumber: 1 });
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
    expect(screen.queryByRole('button', { name: copy['briefing.openData'] })).toBeNull();
  });

  // The other half of the same decision, and the direction that actually
  // changes: a hack day spent today used to leave prereg open ("Prereg is a
  // SEPARATE guard"), which is the reopening §1(j) refused. One attempt, one
  // mode — `briefing.modeChooserIntro` says so where the choice is offered.
  it('a hack day already played today FINISHES the day — prereg is not offered as a second attempt', async () => {
    const iso = isoFromPuzzleNumber(1);
    seedStorage(
      freshV1({
        history: {
          '2026-08-01': { hack: { mode: 'hack', score: 10, forks: 0, stamp: 'NULL_REPORTED', shareString: '' } },
          [iso]: { hack: { mode: 'hack', score: 100, forks: 0, stamp: 'RETRACTED', shareString: '' } },
        },
      })
    );
    renderBriefing({ puzzleNumber: 1 });
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
    expect(screen.queryByRole('button', { name: copy['briefing.playPrereg'] })).toBeNull();
  });

  it('clicking "Play Hacking Mode" calls the existing, already-tested store.openData() — nothing else', async () => {
    const openDataSpy = vi.fn();
    seedStorage(freshV1({ history: { '2026-08-01': { hack: { mode: 'hack', score: 80, forks: 0, stamp: 'NULL_REPORTED', shareString: '' } } } }));
    renderBriefing({ puzzleNumber: 1, openData: openDataSpy as unknown as GameStore['openData'] });
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: copy['briefing.playHacking'] }));

    expect(openDataSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking "Play Prereg Mode" calls store.chooseMode(\'prereg\') — nothing else', async () => {
    const chooseModeSpy = vi.fn();
    seedStorage(freshV1({ history: { '2026-08-01': { hack: { mode: 'hack', score: 80, forks: 0, stamp: 'NULL_REPORTED', shareString: '' } } } }));
    renderBriefing({ puzzleNumber: 1, chooseMode: chooseModeSpy as unknown as GameStore['chooseMode'] });
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: copy['briefing.playPrereg'] }));

    expect(chooseModeSpy).toHaveBeenCalledTimes(1);
    expect(chooseModeSpy).toHaveBeenCalledWith('prereg');
  });
});
