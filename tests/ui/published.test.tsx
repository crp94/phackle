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

/**
 * W8 — the one seam between the shipped catalogs and this screen.
 *
 * `Published` reads its scenario from `useLocale().content`, which
 * `LocaleProvider` fetches through `getContent`. Wrapping that ONE function is
 * how a test can hand the screen a headline the corpus does not contain,
 * without mocking React context, without a second Published harness, and
 * without any test that does not opt in seeing anything different: while
 * `headlineOverride.value` is null this is byte-for-byte the real loader, for
 * every locale.
 *
 * `vi.hoisted` because a `vi.mock` factory may not close over an ordinary
 * module-level binding — the same idiom, for the same reason, as
 * tests/ui/router.test.tsx's `createEngineClient` mock.
 */
const headlineOverride = vi.hoisted(() => ({ value: null as string | null }));

vi.mock('../../src/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content')>();
  return {
    ...actual,
    getContent: async (locale: Parameters<typeof actual.getContent>[0]) => {
      const loaded = await actual.getContent(locale);
      if (headlineOverride.value === null) return loaded;
      return {
        ...loaded,
        scenarios: loaded.scenarios.map((s, i) =>
          i === 0 ? { ...s, headline: headlineOverride.value as string } : s
        ),
      };
    },
  };
});
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { createGameStore, gameStore, DEFAULT_SPEC, type GameStore } from '../../src/game/store';
import type { PathResult } from '../../src/engine/types';
import { content as enContent } from '../../src/content/en';
import { copy as enCopy } from '../../src/content/en/copy';
import { JOURNALS } from '../../src/content/journals';
import { isoFromPuzzleNumber } from '../../src/game/puzzleDate';
import { saveSettings } from '../../src/game/storage';
import { altmetricPercentile, altmetricScore, pickJournal, pickPress, substituteEffect, fakeDoi } from '../../src/game/published';
import { SCORING } from '../../src/game/tuning';
import { Published, type CallScreenComponent } from '../../src/ui/screens/Published';
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

function renderPublished(overrides: Partial<GameStore> = {}, callScreen?: CallScreenComponent) {
  const { useFakeStore, store } = makeFakeStoreHook({ ...BASE_STATE, ...overrides });
  const utils = render(
    <LocaleProvider>
      <Published useStore={useFakeStore} {...(callScreen ? { callScreen } : {})} />
    </LocaleProvider>
  );
  return { store, ...utils };
}

beforeEach(() => {
  installMatchMedia({ '(prefers-reduced-motion: reduce)': true }); // skip canvas/RAF noise unless a test overrides it
  // T33: one test below stores an Italian locale choice, which is now the only
  // way to run the app in anything but English. Cleared here rather than reset
  // in afterEach, so it cannot leak into a test that has not asked for it
  // whatever order the file runs in. (This replaced a navigator.language
  // override, which detectLocale no longer reads at all.)
  window.localStorage.clear();
  // Same reasoning as the localStorage clear above: set here rather than
  // reset in afterEach, so a fixture headline can never leak into a test
  // that did not ask for one, whatever order the file runs in.
  headlineOverride.value = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
  // W8, from W3's review (booking confirmed "TRUE AND STRONGER"): this test
  // WAS VACUOUS. gr6-005 retired the `{effect}` token from all twenty
  // headlines in all three locales, so `substituteEffect(headline, beta)`
  // became a no-op returning its input, and W3's reviewer measured the
  // consequence — severing `substituteEffect` in Published.tsx left the ENTIRE
  // suite green on the head tree while it reds on the base. The coverage was
  // genuinely gone, and the substitution path still ships (the corpus rule
  // that LICENSES the token is still on the books; en/index.ts:25 says so).
  //
  // Retiring the test was the wrong answer for the same reason. So it is
  // re-pinned against a FIXTURE headline that carries the token — injected at
  // the content loader, which is the only seam between the catalogs and the
  // screen — and it asserts the two things a no-op cannot do: the token is
  // gone from the rendered cover, and the number that replaced it is the one
  // derived from the store's beta.
  it('substitutes the {effect} token end-to-end from the store result beta', async () => {
    // A token-carrying headline of exactly the shape the corpus rule permits
    // ("at most one {effect}, never {n}"). Not taken from the shipped corpus,
    // deliberately: no headline there has one today, and a test that reads its
    // input from the same place the component does could go quiet again the
    // next time the corpus is re-cut — which is precisely how this one died.
    headlineOverride.value = 'Cat Owners See {effect}% Higher Returns, Study Finds';

    renderPublished({ forks: 1, result: makeResult({ beta: 24.6 }) });

    // substituteEffect's own rounding/flooring contract is proven in isolation
    // in tests/game/published.test.ts; this proves the WIRING, so the expected
    // string is computed the same way Published itself computes it rather than
    // hand-typing a duplicate of the arithmetic.
    const expected = substituteEffect(headlineOverride.value, 24.6);
    expect(expected, 'the fixture lost its token — this test would be vacuous again').not.toBe(headlineOverride.value);
    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());

    // The two assertions a severed substituteEffect cannot survive.
    expect(screen.queryByText(headlineOverride.value), 'the raw {effect} token is on the journal cover').toBeNull();
    expect(screen.getByText(/\b25% Higher Returns\b/), 'the beta never reached the headline').toBeTruthy();
  });

  // The other half of the pin: the shipped corpus is token-free today, and a
  // token-free headline must pass through untouched. Together these two say
  // "the path works AND it is inert on the content that actually ships",
  // which is the whole of what gr6-005 left behind.
  it('leaves a token-free headline exactly as the corpus wrote it', async () => {
    renderPublished({ forks: 1, result: makeResult({ beta: 24.6 }) });
    await waitFor(() => expect(screen.getByText(enContent.scenarios[0].headline)).toBeTruthy());
    expect(enContent.scenarios[0].headline).not.toContain('{effect}');
  });

  it('shows the fake DOI 10.1337/phk.{puzzleNumber}', async () => {
    renderPublished({ puzzleNumber: 42 });
    await waitFor(() => expect(screen.getByText(fakeDoi(String(42)), { exact: false })).toBeTruthy());
  });

  // gr6-021 — THE DOI ON A PRACTICE DAY. Pre-EPOCH the puzzle number is
  // negative and this cover registered "10.1337/phk.-3", on the one screen in
  // the product whose entire job is to be believed; under `?practice=1` it
  // registered the REAL day's DOI for a session that was never played on that
  // day. Same rule as the masthead, from the same function.
  it('registers no issue number in the DOI on a practice day', async () => {
    renderPublished({ puzzleNumber: -3, practice: true });
    await waitFor(() => expect(screen.getByText('10.1337/phk.—', { exact: false })).toBeTruthy());
    expect(screen.queryByText('10.1337/phk.-3', { exact: false }), 'a negative DOI suffix shipped').toBeNull();
  });

  it('suppresses a plausible POSITIVE DOI under ?practice=1 too (the post-launch case)', async () => {
    renderPublished({ puzzleNumber: 42, practice: true });
    await waitFor(() => expect(screen.getByText('10.1337/phk.—', { exact: false })).toBeTruthy());
    expect(screen.queryByText(fakeDoi(String(42)), { exact: false }), 'a practice run wore the real issue DOI').toBeNull();
  });

  it('shows the inline career-points figure (R1.6: the one place --hack-gold-ink paints characters)', async () => {
    renderPublished();
    await waitFor(() => expect(screen.getByText(`+${SCORING.publishedCareer} career points`)).toBeTruthy());
  });

  it('picks the journal from the tag-filtered pool via pickJournal(tags, iso) -- English, regardless of the active locale', async () => {
    // T33: the app runs in Italian because a STORED choice says so. This used
    // to set `navigator.language = 'it'`, which stopped selecting anything the
    // moment the owner's round-5 directive made English the unconditional
    // default (src/i18n/locale.ts) — a stored setting is now the only thing
    // that moves the interface off English, and it is what a real Italian
    // player has. The assertion itself is untouched: the masthead stays
    // English while the app genuinely runs in Italian.
    saveSettings({ locale: 'it' });
    const iso = isoFromPuzzleNumber(1);
    const expectedJournal = pickJournal(enContent.scenarios[0].journalTags, iso).name;
    expect(JOURNALS.some((j) => j.name === expectedJournal)).toBe(true);

    renderPublished();
    // T19: wait for CONTENT, not for the <html lang> attribute. LocaleProvider
    // sets lang as soon as the locale is *detected*, one tick before
    // getContent() resolves; that gap was invisible while 'it' aliased the
    // already-imported English module and became a real (empty-render) race the
    // moment src/content/it/ shipped as its own dynamic import. The lang
    // assertion is kept below, so this still proves the masthead is English
    // while the app is genuinely running in Italian.
    await waitFor(() => expect(screen.getByText(expectedJournal)).toBeTruthy());
    expect(document.documentElement.lang).toBe('it');
  });
});

// T32 (copy punch-up): the two lines are asserted through the copy catalog
// rather than as English literals. The wording of published.altmetricScore is
// owned by the content pass -- the third play-test moved it off "Attention
// score" and onto a plainly countable line -- and a UI test that hard-codes a
// value re-breaks every time that value is edited.
const altmetricScoreLine = (n: number) => enContent.copy['published.altmetricScore'].replace('{n}', String(n));
// gr6-086: the token is `{pct}`, not `{n}` — it is the catalog's one
// percentage, and this substitution is the assertion that the binding site
// spells the same name the value does. Renaming one without the other prints
// the raw token on the press card, which is exactly what this line catches.
const altmetricPercentileLine = (pct: number) =>
  enContent.copy['published.altmetricPercentile'].replace('{pct}', String(pct));

describe('Published: altmetric counter (review fix -- master spec §2.5\'s 5th celebration element, static/tier-scaled, never animated)', () => {
  it('shows the tier-scaled attention score and percentile line, computed the same way Published itself does', async () => {
    const iso = isoFromPuzzleNumber(1);
    const tier = 2; // forks=5 below
    const expectedScore = altmetricScore(iso, tier);
    const expectedPercentile = altmetricPercentile(iso, tier);

    renderPublished({ forks: 5 });

    await waitFor(() => expect(screen.getByText(altmetricScoreLine(expectedScore))).toBeTruthy());
    expect(screen.getByText(altmetricPercentileLine(expectedPercentile))).toBeTruthy();
  });

  it('scales up with egregiousness tier -- a tier-3 (forks>=10) score is always bigger than a tier-1 (forks<=3) score, same day', async () => {
    const iso = isoFromPuzzleNumber(1);

    const tier1Score = altmetricScore(iso, 1);
    const tier1 = renderPublished({ forks: 1 });
    await waitFor(() => expect(screen.getByText(altmetricScoreLine(tier1Score))).toBeTruthy());
    tier1.unmount();

    const tier3Score = altmetricScore(iso, 3);
    const tier3 = renderPublished({ forks: 12 });
    await waitFor(() => expect(screen.getByText(altmetricScoreLine(tier3Score))).toBeTruthy());
    expect(tier3Score).toBeGreaterThan(tier1Score);
    tier3.unmount();
  });

  it('renders no animation/transition class on the altmetric block (§2.5\'s "spinning up" would be a 5th, un-budgeted motion)', async () => {
    const { container } = renderPublished({ forks: 1 });
    await waitFor(() =>
      expect(screen.getByText(altmetricScoreLine(altmetricScore(isoFromPuzzleNumber(1), 1)))).toBeTruthy()
    );

    const block = container.querySelector('.ph-altmetric');
    expect(block).toBeTruthy();
    // Structural proof, not just a visual read: no element inside the block
    // (or the block itself) declares a `class` naming an animation/transition
    // hook, and the CSS file backing it is grepped for transition/animation
    // properties in the DESIGN.md self-audit (tracked in the fix report).
    const allNodes = [block, ...(block ? Array.from(block.querySelectorAll('*')) : [])];
    for (const node of allNodes) {
      const classAttr = node?.getAttribute('class') ?? '';
      expect(classAttr).not.toMatch(/animate|spin|transition/i);
    }
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
    // The FIRST card is the scenario-bound one (T39a's guarantee: an unsalted
    // pickPress prefers the bound pool); the second salts `iso` and therefore
    // takes the generic pool, so this asserts presence, not count --
    // getAllByText, not getByText.
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
  const fakeLoader = FakeCallScreen as CallScreenComponent;

  /* gr6-014 — nothing locked the page behind the modal. Measured before the
     fix: with the overlay up, the document scrolled 0 -> 250 and the dimmed
     cover slid under the dialog. `inert` covers focus and hit-testing; it
     says nothing about the scrolling element. */
  it('locks the scrolling element while the overlay is up, and restores exactly what was there before', async () => {
    document.documentElement.style.overflow = 'scroll'; // a pre-existing value, not the empty default
    const { unmount } = renderPublished({}, fakeLoader);
    await waitFor(() => expect(screen.getByText('Face the truth')).toBeTruthy());
    expect(document.documentElement.style.overflow).toBe('scroll');

    fireEvent.click(screen.getByText('Face the truth'));
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(document.documentElement.style.overflow).toBe('scroll');

    // ...and the case closeCall alone cannot cover: the store swaps the
    // screen out from under an OPEN overlay when makeCall resolves.
    fireEvent.click(screen.getByText('Face the truth'));
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('scroll');
    document.documentElement.style.overflow = '';
  });

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

  // These two tests originally pinned the PRE-MERGE interim reality (registry
  // absent in T15's worktree -> loader resolves null). Updated at merge
  // integration (controller, per registry.t15.patch.md) to pin the composed
  // reality: the registry exists and 'call' maps to T16's real Call. gr6-083
  // retires the loader entirely — the seam is a component, not a promise — so
  // what these two now pin is the property that replaced it: the default IS
  // the real Call, and it is there on the FIRST commit rather than a render
  // later (which is what made the old shape move focus twice per open).
  it('end-to-end with the real default (no fake injected): the overlay opens with the real Call already mounted inside it, on the same commit', async () => {
    // The real Call reads the real gameStore SINGLETON (not this test's fake
    // store hook) and self-gates on screen === 'published' | 'call'. Driving
    // that singleton onto 'published' is what makes this an end-to-end pin of
    // the DEFAULT rather than of an injected stand-in: the prompt below is
    // Call.tsx's own <h1>, rendered by the component Published imports.
    gameStore.setState({ screen: 'published' });
    renderPublished(); // no callScreen override -> uses the real Call
    // The one await is the locale bundle, which every test in this file waits
    // for; the overlay itself is asserted synchronously below.
    await waitFor(() => expect(screen.getByText('Face the truth')).toBeTruthy());
    fireEvent.click(screen.getByText('Face the truth'));

    // No `await`, deliberately, and that IS the gr6-083 assertion: with a
    // static import there is nothing to wait for. Under the dynamic loader
    // this needed a waitFor(), because the overlay's first commit was EMPTY —
    // which is also what made focus move twice per open.
    const dialog = screen.getByRole('dialog');
    const prompt = dialog.querySelector('#ph-call-prompt');
    expect(prompt?.textContent).toBe(enCopy['call.prompt']);
    // gr6-015: the dialog is named by that question, not by the eyebrow.
    expect(dialog.getAttribute('aria-labelledby')).toBe('ph-call-prompt');
    expect(dialog.getAttribute('aria-label')).toBeNull();
    // ...and there is exactly ONE dialog in the tree: the overlay. The Call
    // section inside it is a named region now, never a nested dialog.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
