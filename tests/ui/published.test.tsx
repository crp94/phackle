// @vitest-environment jsdom
//
// T15: the PUBLISHED screen (full-bleed fake-journal celebration, Act I's
// sincere payoff) and its JournalCover component. Follows the established
// jsdom conventions from tests/ui/shell.test.tsx: no @testing-library/jest-dom
// (plain DOM property assertions only), a hand-rolled per-query matchMedia
// fake, and afterEach(cleanup) since this project doesn't enable vitest's
// test.globals (so @testing-library/react's own automatic cleanup never runs).
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { createGameStore, DEFAULT_SPEC, type GameStore } from '../../src/game/store';
import type { PathResult } from '../../src/engine/types';
import { content as enContent } from '../../src/content/en';
import { JOURNALS } from '../../src/content/journals';
import { isoFromPuzzleNumber } from '../../src/game/puzzleDate';
import { pickJournal, pickPress, substituteEffect, fakeDoi } from '../../src/game/published';
import { SCORING } from '../../src/game/tuning';
import { Published, loadCallScreenFromRegistry, type LazyScreenComponent } from '../../src/ui/screens/Published';
import { JournalCover } from '../../src/ui/components/JournalCover';

/** Same per-query fake as tests/ui/shell.test.tsx (jsdom has no matchMedia). */
function installMatchMedia(initial: Record<string, boolean> = {}) {
  const registry = new Map<string, { matches: boolean; listeners: Set<(e: { matches: boolean }) => void> }>();
  const entryFor = (query: string) => {
    let entry = registry.get(query);
    if (!entry) {
      entry = { matches: initial[query] ?? false, listeners: new Set() };
      registry.set(query, entry);
    }
    return entry;
  };
  window.matchMedia = vi.fn((query: string) => {
    const entry = entryFor(query);
    return {
      media: query,
      get matches() {
        return entry.matches;
      },
      addEventListener: (_t: string, cb: (e: { matches: boolean }) => void) => entry.listeners.add(cb),
      removeEventListener: (_t: string, cb: (e: { matches: boolean }) => void) => entry.listeners.delete(cb),
      addListener: (cb: (e: { matches: boolean }) => void) => entry.listeners.add(cb),
      removeListener: (cb: (e: { matches: boolean }) => void) => entry.listeners.delete(cb),
      dispatchEvent: () => true,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;
}

function makeResult(overrides: Partial<PathResult> = {}): PathResult {
  return {
    spec: DEFAULT_SPEC,
    n: 200,
    beta: 24.6,
    se: 0.05,
    t: 2.4,
    p: 0.02,
    ci: [0.02, 0.22],
    excludedCount: 0,
    valid: true,
    ...overrides,
  };
}

/** Isolated fake store: a real (non-singleton) createGameStore() instance,
 * seeded directly via setState, bound through zustand/react's own generic
 * useStore -- never the app's real singleton (src/game/store.ts's own
 * useGameStore), so no test can leak state into another. */
function makeFakeStoreHook(overrides: Partial<GameStore>) {
  const store = createGameStore();
  store.setState(overrides);
  function useFakeStore<T>(selector: (s: GameStore) => T): T {
    return zustandUseStore(store, selector);
  }
  return { useFakeStore, store };
}

const BASE_STATE: Partial<GameStore> = {
  screen: 'published',
  scenarioIndex: 0, // 'cat-crypto'
  puzzleNumber: 1, // -> iso === EPOCH ('2026-08-10')
  published: DEFAULT_SPEC,
  result: makeResult(),
};

function renderPublished(overrides: Partial<GameStore> = {}, loadCallScreen?: () => Promise<LazyScreenComponent | null>) {
  const { useFakeStore, store } = makeFakeStoreHook({ ...BASE_STATE, ...overrides });
  const utils = render(
    <LocaleProvider>
      <Published useStore={useFakeStore} {...(loadCallScreen ? { loadCallScreen } : {})} />
    </LocaleProvider>
  );
  return { store, ...utils };
}

beforeEach(() => {
  installMatchMedia({ '(prefers-reduced-motion: reduce)': true }); // skip canvas/RAF noise unless a test overrides it
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window.navigator, 'language', { value: 'en-US', configurable: true });
});

// --------------------------------------------------------------------------

describe('JournalCover', () => {
  it('renders the masthead, headline, authors, DOI and SIMULATED PRESS watermark', async () => {
    render(
      <LocaleProvider>
        <JournalCover journal="Nature Feline Finance" headline="Cat Owners See 25% Higher Returns" authors="You, et al." doi="10.1337/phk.1" tier={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('Nature Feline Finance')).toBeTruthy());
    expect(screen.getByText('Cat Owners See 25% Higher Returns')).toBeTruthy();
    expect(screen.getByText('You, et al.')).toBeTruthy();
    // "DOI:" and the value render as one text node together (`{prefix} {doi}`
    // inside a single <p>), so match the DOI line's full, combined content.
    expect(screen.getByText('DOI: 10.1337/phk.1')).toBeTruthy();
    expect(screen.getByText('SIMULATED PRESS')).toBeTruthy();
  });

  it('carries the SIMULATED PRESS watermark at every tier (S4.4: every fake-press asset carries it)', async () => {
    for (const tier of [1, 2, 3] as const) {
      const { unmount } = render(
        <LocaleProvider>
          <JournalCover journal="J" headline="H" authors="A" doi="D" tier={tier} />
        </LocaleProvider>
      );
      await waitFor(() => expect(screen.getByText('SIMULATED PRESS')).toBeTruthy());
      unmount();
    }
  });
});

describe('Published: journal cover wiring', () => {
  it('substitutes the {effect} token end-to-end from the store result beta', async () => {
    // substituteEffect's own rounding/flooring contract is proven in
    // isolation in tests/game/published.test.ts -- this proves the WIRING
    // (store.result.beta reaches the headline), so it computes the expected
    // string the same way Published itself does, rather than a hand-typed
    // duplicate of the rounding arithmetic.
    const expectedHeadline = substituteEffect(enContent.scenarios[0].headline, 24.6);
    renderPublished({ forks: 1, result: makeResult({ beta: 24.6 }) });
    await waitFor(() => expect(screen.getByText(expectedHeadline)).toBeTruthy());
  });

  it('shows the fake DOI 10.1337/phk.{puzzleNumber}', async () => {
    renderPublished({ puzzleNumber: 42 });
    await waitFor(() => expect(screen.getByText(fakeDoi(42), { exact: false })).toBeTruthy());
  });

  it('shows the inline career-points figure (R1.6: the one place --hack-gold-ink paints characters)', async () => {
    renderPublished();
    await waitFor(() => expect(screen.getByText(`+${SCORING.publishedCareer} career points`)).toBeTruthy());
  });

  it('picks the journal from the tag-filtered pool via pickJournal(tags, iso) -- English, regardless of the active locale', async () => {
    Object.defineProperty(window.navigator, 'language', { value: 'it', configurable: true });
    const iso = isoFromPuzzleNumber(1);
    const expectedJournal = pickJournal(enContent.scenarios[0].journalTags, iso).name;
    expect(JOURNALS.some((j) => j.name === expectedJournal)).toBe(true);

    renderPublished();
    await waitFor(() => expect(document.documentElement.lang).toBe('it'));
    expect(screen.getByText(expectedJournal)).toBeTruthy();
  });
});

describe('Published: egregiousness tiers and press blurbs', () => {
  it('renders exactly two tier-matched press cards, each watermarked SIMULATED PRESS', async () => {
    const iso = isoFromPuzzleNumber(1);
    const scenario = enContent.scenarios[0]; // cat-crypto, forks=5 -> tier 2 -> no scenario-bound blurb -> agnostic pool
    const card1 = pickPress(enContent.press, 2, scenario.id, iso);
    const card2 = pickPress(enContent.press, 2, scenario.id, `${iso}#2`);
    // The two salted picks usually differ, but a coincidental match (both
    // landing on the same pool index) is legal, not a bug -- de-duplicate
    // before asserting presence, and use getAllByText either way, exactly
    // like the scenario-bound-preference test above.
    const expectedTexts = [...new Set([card1.text, card2.text])];

    renderPublished({ forks: 5 });
    await waitFor(() => {
      for (const text of expectedTexts) {
        expect(screen.getAllByText(text).length).toBeGreaterThan(0);
      }
    });
    // cover watermark + 2 press-card watermarks, tier < 3 so no chyron's 4th.
    expect(screen.getAllByText('SIMULATED PRESS')).toHaveLength(3);
  });

  it('prefers a scenario-bound press blurb when one exists for the tier (cat-crypto tier 1 -> Morning Chirp)', async () => {
    renderPublished({ forks: 1 }); // tier 1
    // cat-crypto's tier-1 preferred pool is a singleton (only Morning
    // Chirp's blurb is scenario-bound at this tier), so BOTH press cards
    // legitimately land on it -- getAllByText, not getByText.
    await waitFor(() => expect(screen.getAllByText(/Morning Chirp/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('Scientists say: your cat may be your best financial advisor.').length).toBeGreaterThan(0);
  });

  it('adds the chyron bar with the editors-pick copy + a tier-3 blurb only at tier 3 (forks >= 10)', async () => {
    const iso = isoFromPuzzleNumber(1);
    const scenario = enContent.scenarios[0];
    const chyron = pickPress(enContent.press, 3, scenario.id, `${iso}#chyron`);

    const { unmount } = renderPublished({ forks: 12 });
    await waitFor(() => expect(screen.getByText("Editor's Pick")).toBeTruthy());
    // getAllByText: the chyron's blurb text could coincidentally match one of
    // the two press cards' picks (same pool, different salted index) --
    // legal, not a bug, so this asserts presence, not singularity.
    expect(screen.getAllByText(chyron.text).length).toBeGreaterThan(0);
    expect(screen.getAllByText('SIMULATED PRESS')).toHaveLength(4); // cover + 2 cards + chyron
    unmount();

    renderPublished({ forks: 9 }); // one below the editorsPick boundary -> tier 2, no chyron
    await waitFor(() => expect(screen.getAllByText('SIMULATED PRESS')).toHaveLength(3));
    expect(screen.queryByText("Editor's Pick")).toBeNull();
  });
});

describe('Published: confetti (R5.4: 150/250/400 particles by tier, capped at 400)', () => {
  function mockCanvasContext() {
    const ctx = { save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    return ctx;
  }

  it('requests exactly 150 particles at tier 1 (forks=1)', async () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const ctx = mockCanvasContext();
    let calls = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      calls += 1;
      if (calls === 1) cb(0);
      return calls;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    renderPublished({ forks: 1 });

    // content (and so <ConfettiLayer>) mounts only once useLocale's dynamic
    // import resolves, one tick after this synchronous render() call.
    await waitFor(() => expect(ctx.fillRect).toHaveBeenCalledTimes(150));
  });

  it('is gone from the DOM once ConfettiLayer signals done (onDone), matching R5.4', async () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': true }); // reduced motion resolves onDone synchronously-ish
    const { container } = renderPublished({ forks: 1 });
    await waitFor(() => expect(container.querySelector('canvas')).toBeNull());
  });
});

describe('Published: "Face the truth" overlay', () => {
  function FakeCallScreen() {
    return (
      <div>
        <button type="button">Real</button>
        <button type="button">Noise</button>
      </div>
    );
  }
  const fakeLoader = () => Promise.resolve(FakeCallScreen as LazyScreenComponent);

  it('does not show any dialog before the CTA is clicked', async () => {
    renderPublished({}, fakeLoader);
    await waitFor(() => expect(screen.getByText('Face the truth')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking "Face the truth" immediately dims the cover and opens the overlay, without calling store.makeCall itself', async () => {
    const makeCallSpy = vi.fn();
    const { container, store } = renderPublished({ makeCall: makeCallSpy as unknown as GameStore['makeCall'] }, fakeLoader);
    await waitFor(() => expect(screen.getByText('Face the truth')).toBeTruthy());

    fireEvent.click(screen.getByText('Face the truth'));

    // The dimmed-backdrop *visual* is the overlay's own var(--scrim)
    // background (DESIGN.md R4.2/§0), rendered on top of the cover -- what
    // this asserts is the cover's a11y state (inert + hidden from the tree)
    // and that the overlay (the scrim's host) exists.
    expect(screen.getByRole('dialog')).toBeTruthy();
    const cover = container.querySelector('.ph-published__cover');
    expect(cover?.getAttribute('aria-hidden')).toBe('true');
    expect(cover?.hasAttribute('inert')).toBe(true);
    expect(makeCallSpy).not.toHaveBeenCalled();
    expect(store.getState().call).toBeNull();
  });

  it('renders whatever the registry-loaded call screen resolves to inside the overlay, and moves focus into it', async () => {
    renderPublished({}, fakeLoader);
    await waitFor(() => expect(screen.getByText('Face the truth')).toBeTruthy());

    fireEvent.click(screen.getByText('Face the truth'));

    await waitFor(() => expect(screen.getByText('Real')).toBeTruthy());
    expect(screen.getByText('Noise')).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Real'));
  });

  it('traps Tab focus inside the overlay (wraps last -> first and first -> last)', async () => {
    renderPublished({}, fakeLoader);
    await waitFor(() => expect(screen.getByText('Face the truth')).toBeTruthy());
    fireEvent.click(screen.getByText('Face the truth'));
    await waitFor(() => expect(screen.getByText('Real')).toBeTruthy());

    const dialog = screen.getByRole('dialog');
    const real = screen.getByText('Real');
    const noise = screen.getByText('Noise');

    noise.focus();
    expect(document.activeElement).toBe(noise);
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(real);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(noise);
  });

  it('the registry loader default (no fake injected) resolves to null without throwing -- todays reality: T14s registry.ts does not exist in this worktree', async () => {
    await expect(loadCallScreenFromRegistry()).resolves.toBeNull();
  });

  it('does not crash when the real (today: absent) registry loader is used end-to-end -- overlay opens with nothing rendered inside yet', async () => {
    renderPublished(); // no loadCallScreen override -> uses the real default
    await waitFor(() => expect(screen.getByText('Face the truth')).toBeTruthy());

    fireEvent.click(screen.getByText('Face the truth'));

    expect(screen.getByRole('dialog')).toBeTruthy();
    await waitFor(() => expect(loadCallScreenFromRegistry()).resolves.toBeNull());
  });
});
