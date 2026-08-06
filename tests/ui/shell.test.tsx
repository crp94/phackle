// @vitest-environment jsdom
//
// T5: app shell (loading gate, running header, theme/locale toggles) and the
// shared visual components (Stamp, ConfettiLayer, EmailCard, useReducedMotion).
//
// This project has no @testing-library/jest-dom (see tests/i18n/LocaleProvider.test.tsx
// for the same convention) — assertions read plain DOM properties
// (.textContent, .getAttribute, .className) rather than jest-dom matchers.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within, act } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { AVAILABLE_LOCALES } from '../../src/i18n/locale';
import App, { ThemeToggle, LocaleToggle } from '../../src/ui/App';
import { gameStore } from '../../src/game/store';
import { copy as enCopy } from '../../src/content/en/copy';
import { Stamp, type StampProps } from '../../src/ui/components/Stamp';
import { ConfettiLayer } from '../../src/ui/components/ConfettiLayer';
import { EmailCard } from '../../src/ui/components/EmailCard';
import { useReducedMotion } from '../../src/ui/hooks/useReducedMotion';

/**
 * jsdom has no matchMedia (brief note). This fakes one MediaQueryList per
 * query string, independently, so a test can drive
 * '(prefers-reduced-motion: reduce)' and '(prefers-color-scheme: dark)'
 * separately and fire "change" events for the reactivity tests.
 */
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
      addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => entry.listeners.add(cb),
      removeEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => entry.listeners.delete(cb),
      addListener: (cb: (e: { matches: boolean }) => void) => entry.listeners.add(cb),
      removeListener: (cb: (e: { matches: boolean }) => void) => entry.listeners.delete(cb),
      dispatchEvent: () => true,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;

  return {
    set(query: string, matches: boolean) {
      const entry = entryFor(query);
      entry.matches = matches;
      entry.listeners.forEach((cb) => cb({ matches }));
    },
  };
}

// getAttribute('class'), not .className: on an <svg> element .className is an
// SVGAnimatedString (no .split), not a plain string — getAttribute works the
// same way for both HTML and SVG elements.
function hasClass(el: Element | null, className: string): boolean {
  return !!el && (el.getAttribute('class') ?? '').split(/\s+/).includes(className);
}


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
  document.documentElement.lang = '';
  installMatchMedia();
  gameStore.setState({ booted: true });
});

// This project doesn't enable vitest's test.globals, so @testing-library/react's
// automatic afterEach(cleanup) never registers (see LocaleProvider.test.tsx).
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App loading gate', () => {
  it('renders only a paper-background placeholder before content loads, then mounts the header and children', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <div data-testid="child">child content</div>
        </App>
      </LocaleProvider>
    );

    // Synchronous assertion: getContent()'s dynamic import never resolves
    // within the same microtask, so this always observes the pre-load state.
    expect(screen.getByTestId('app-loading')).toBeTruthy();
    expect(screen.queryByTestId('child')).toBeNull();
    expect(screen.queryByText('P-hackle')).toBeNull();

    await waitFor(() => expect(screen.queryByTestId('child')).not.toBeNull());
    expect(screen.queryByTestId('app-loading')).toBeNull();
    expect(screen.getByText('P-hackle')).toBeTruthy();
  });
});

/* ==========================================================================
   gr6-007 (BLOCKER) — A BOOT FAILURE MUST NOT RENDER A STUDY.

   Before this row, `storeError && !booted` fell through to the whole shell,
   and the shell mounted the Briefing on initialState()'s placeholders: the
   WRONG scenario's question, cover story, Grantwell email and issue number,
   under a one-line error banner, with a live "Open the data" CTA into a Lab
   that can never compute a p-value (nothing ever answers runSpec). The error
   is the screen now.

   These tests deliberately do NOT seed `booted` — they want the failure the
   file's own beforeEach otherwise papers over.
   ========================================================================== */
describe('boot failure (gr6-007)', () => {
  async function renderFailedBoot() {
    gameStore.setState({ booted: false, error: 'engine crashed' });
    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <div data-testid="child">the running game</div>
        </App>
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByTestId('app-boot-error')).toBeTruthy());
  }

  it('renders the error as the WHOLE screen — no header, no nav, and above all no placeholder study', async () => {
    await renderFailedBoot();
    // The study, and every route into it, is gone.
    expect(screen.queryByTestId('child')).toBeNull();
    expect(screen.queryByText('P-hackle')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it("gives the screen the copy's own sentence as its one h1 (R6.6)", async () => {
    await renderFailedBoot();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(enCopy['errors.workerCrash']);
  });

  it('offers the reload control the copy promises, and reloading is what it does', async () => {
    await renderFailedBoot();
    const reload = screen.getByTestId('app-boot-error-reload');
    const spy = vi.fn();
    // jsdom's location.reload is a non-configurable no-op that logs "Not
    // implemented"; replacing the whole descriptor is how this file's
    // sibling suites stub browser APIs it cannot drive.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: spy },
    });
    fireEvent.click(reload);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a MID-DAY crash keeps the shell — only a boot that never produced a day takes the page', async () => {
    gameStore.setState({ booted: true, error: 'engine crashed' });
    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <div data-testid="child">the running game</div>
        </App>
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByTestId('child')).toBeTruthy());
    expect(screen.queryByTestId('app-boot-error')).toBeNull();
    expect(screen.getByText('P-hackle')).toBeTruthy();
  });
});

/* ==========================================================================
   gr6-017 — the skip link. Nine chrome tab stops sat ahead of the first
   content control on every screen, with no way past them.
   ========================================================================== */
describe('skip link (gr6-017)', () => {
  async function renderShell() {
    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <div data-testid="child">the running game</div>
        </App>
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
  }

  it('is the very FIRST focusable thing in the document, ahead of the masthead', async () => {
    await renderShell();
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])')
    );
    expect(focusable[0]).toBe(screen.getByTestId('app-skip-link'));
  });

  it('points at the <main> R6.6 already made focusable — no second focus target invented', async () => {
    await renderShell();
    const link = screen.getByTestId('app-skip-link') as HTMLAnchorElement;
    const target = document.querySelector('main.ph-screen') as HTMLElement;
    expect(link.getAttribute('href')).toBe(`#${target.id}`);
    expect(target.getAttribute('tabindex')).toBe('-1');
    expect(target.id).not.toBe('');
  });

  it('is hidden by R6.6\'s own clip idiom rather than by display/visibility (it must stay in the a11y tree)', async () => {
    await renderShell();
    const link = screen.getByTestId('app-skip-link');
    expect(link.className.split(' ')).toContain('ph-visually-hidden');
    expect(link.className.split(' ')).toContain('ph-skip-link');
  });
});

describe('running header', () => {
  it('shows the wordmark and "Vol. 1, No. {puzzleNumber}"', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={12} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
    expect(screen.getByText('Vol. 1, No. 12')).toBeTruthy();
  });
});

describe('theme toggle', () => {
  it('defaults to paper/light, switches to dark, and persists the explicit choice', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    // T33: a two-option group, not a single flip-flop button — BOTH options
    // are on screen at all times, so the control names what it does and which
    // side is active without anyone having to click it to find out.
    expect(screen.getByRole('button', { name: 'Paper' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Paper' }).getAttribute('aria-pressed')).toBe('false');

    // T13 fix-up: the persisted contract is now `phackle.v1` (storage.ts) —
    // not the retired interim `phackle.settings` key. See
    // tests/i18n/LocaleProvider.test.tsx's "does not resurrect the legacy
    // phackle.settings key" test for the regression guard on this change.
    const stored = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(stored.settings.theme).toBe('dark');
  });

  it('reads a previously-stored theme on mount, ahead of any content load', () => {
    window.localStorage.setItem('phackle.settings', JSON.stringify({ theme: 'dark' }));
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    // The theme effect doesn't depend on locale content, so this is synchronous.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to the system dark preference when nothing is stored', () => {
    installMatchMedia({ '(prefers-color-scheme: dark)': true });
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('re-selecting the already-active side is a no-op, not a flip', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Paper' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('labels the group so the two options read as one control', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    // W2/gr6-067: the group's accessible name is a11y.themeToggle, and it is
    // now the noun 'Theme' -- looked up rather than retyped, so the next
    // wording pass does not red a test about GROUPING.
    const group = screen.getByRole('group', { name: enCopy['a11y.themeToggle'] });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Paper', 'Dark']);
  });
});

describe('locale toggle', () => {
  // T19 (Italian shipped, so AVAILABLE_LOCALES is no longer a single entry):
  // this used to assert the toggle stays hidden, which was a statement about
  // the locale list's CURRENT length rather than about the App's behaviour.
  // Phrased against the list itself, it holds for ['en'], ['en','it'] and
  // ['en','it','es'] alike, so neither transcreation landing can falsify it.
  it('renders the toggle in the real App exactly when AVAILABLE_LOCALES has more than one entry', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    if (AVAILABLE_LOCALES.length <= 1) {
      expect(screen.queryByRole('group', { name: 'Language' })).toBeNull();
      return;
    }
    // T37 (audit §5.4): a11y.localeToggle NAMES the group; it stopped being
    // 'Change language' because a group label is not an action.
    const group = screen.getByRole('group', { name: 'Language' });
    expect(within(group).getAllByRole('button')).toHaveLength(AVAILABLE_LOCALES.length);
  });

  it('renders one button per locale once more than one is available', () => {
    const setLocale = vi.fn();
    render(<LocaleToggle locales={['en', 'it', 'es']} locale="en" setLocale={setLocale} t={(key) => key} />);

    const group = screen.getByRole('group', { name: 'a11y.localeToggle' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(buttons[1]);
    expect(setLocale).toHaveBeenCalledWith('it');
  });

  // T33 (owner: "the language menu should have a little flag"). Flag PLUS
  // code, never a flag alone: Windows Chrome ships no flag glyphs at all and
  // renders a regional-indicator pair as the two letters "GB"/"IT"/"ES", so
  // the code text is what keeps the control legible there. The flag is
  // aria-hidden decoration; the accessible name is the language's own
  // endonym, which is the one name a speaker of that language can find.
  it('shows a flag beside the code, with the language endonym as the accessible name', () => {
    render(<LocaleToggle locales={['en', 'it', 'es']} locale="en" setLocale={vi.fn()} t={(key) => key} />);
    const buttons = within(screen.getByRole('group', { name: 'a11y.localeToggle' })).getAllByRole('button');

    expect(buttons.map((b) => b.textContent)).toEqual(['🇬🇧EN', '🇮🇹IT', '🇪🇸ES']);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'nav.localeNameEn',
      'nav.localeNameIt',
      'nav.localeNameEs',
    ]);
    for (const b of buttons) {
      expect(b.querySelector('[aria-hidden="true"]')?.textContent).toMatch(/^[\u{1F1E6}-\u{1F1FF}]{2}$/u);
    }
  });

  it('names each locale in its own language, identically in every UI language', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
    for (const name of ['English', 'Italiano', 'Español']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });
});

describe('ThemeToggle (unit)', () => {
  it('renders both options with the active one pressed, and selects on click', () => {
    const setTheme = vi.fn();
    render(<ThemeToggle theme="paper" setTheme={setTheme} t={(key) => key} />);

    expect(screen.getByRole('button', { name: 'nav.themePaper' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'nav.themeDark' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'nav.themeDark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('selects paper from dark', () => {
    const setTheme = vi.fn();
    render(<ThemeToggle theme="dark" setTheme={setTheme} t={(key) => key} />);
    fireEvent.click(screen.getByRole('button', { name: 'nav.themePaper' }));
    expect(setTheme).toHaveBeenCalledWith('paper');
  });
});

describe('Stamp', () => {
  it('renders the verdict label as real, accessible text', () => {
    render(<Stamp kind="RETRACTED" label="RETRACTED" animate={false} />);
    expect(screen.getByText('RETRACTED')).toBeTruthy();
  });

  // gr6-011: `role="img"` + `aria-label` is the ONE channel that announces the
  // verdict. It used to be two — the label was also exposed as an SVG <text>
  // node — and the AX tree read "image: RETRACTED / StaticText: RETRACTED" at
  // Act II's loudest moment. R8.2's "always also present as text" is satisfied
  // by either channel alone.
  it('announces the verdict exactly once, and keeps the glyphs out of the AX tree', () => {
    const { container } = render(<Stamp kind="CONFIRMED_NULL" label="NULL CONFIRMED" animate={false} />);
    const svg = container.querySelector('.ph-stamp__mark')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('NULL CONFIRMED');
    const texts = [...svg.querySelectorAll('text')];
    expect(texts).toHaveLength(1);
    expect(texts[0].getAttribute('aria-hidden')).toBe('true');
    // Still a real, queryable text node on screen — only its second trip
    // through the accessibility tree is gone.
    expect(screen.getByText('NULL CONFIRMED')).toBeTruthy();
  });

  // gr6-010: the filter region is pinned to the viewBox in USER SPACE, so what
  // the mark paints is a subset of its own box whatever the label says. It used
  // to be `objectBoundingBox` at 140%, i.e. a fraction of however wide the text
  // inside happened to be — measured at 555.6 user units in a 320-unit viewBox
  // on the production build, painting 72px outside the window at 768.
  it('pins the distress filter to the viewBox, in user space, not to the text\'s bbox', () => {
    const { container } = render(<Stamp kind="RETRACTED" label="RETRACTED" animate={false} />);
    const svg = container.querySelector('.ph-stamp__mark')!;
    const filter = svg.querySelector('filter')!;
    expect(filter.getAttribute('filterUnits')).toBe('userSpaceOnUse');
    const region = ['x', 'y', 'width', 'height'].map((a) => Number(filter.getAttribute(a)));
    const viewBox = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(region).toEqual(viewBox);
  });

  // w1-r-011: pinning the region made it a hard CLIP, which exposed that the
  // label had never fitted the box: the honest verdict overran it in all three
  // locales and rendered sheared ("RISULTATO NULLO" as "ULTATO NUL") — the
  // stamp an HONEST player gets. The advance is an input now, not an output.
  //
  // This is the STRUCTURAL half of the guard, and it is all jsdom can do: jsdom
  // has no text metrics at all, so the real strings are measured against the
  // region in a real browser by e2e/stamp.spec.ts — twelve of them since
  // §1(j)(2) split the honest verdict in two. Both are needed — this one
  // catches the attribute being dropped, that one catches the constant
  // drifting past the frame.
  it('fixes the label\'s advance so no locale\'s verdict can overrun the frame', () => {
    const { container } = render(<Stamp kind="MISSED_DISCOVERY" label="MANCATA SCOPERTA" animate={false} />);
    const svg = container.querySelector('.ph-stamp__mark')!;
    const text = svg.querySelector('text.ph-stamp__label')!;

    const textLength = Number(text.getAttribute('textLength'));
    expect(textLength, 'the label sets no textLength, so its width is whatever the string happens to be').toBeGreaterThan(0);
    expect(text.getAttribute('lengthAdjust')).toBe('spacingAndGlyphs');

    // The advance must fit the region with the frame's own inset to spare:
    // textLength is centred on x=160 (textAnchor="middle"), so it spans
    // 160 +/- textLength/2, and that has to sit inside the filter region.
    const [regionX, , regionW] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(160 - textLength / 2).toBeGreaterThanOrEqual(regionX);
    expect(160 + textLength / 2).toBeLessThanOrEqual(regionX + regionW);
    // And inside the inner frame rect (x=16, width=288), not merely inside the
    // region: a label touching the region edge would sit on top of the border.
    expect(160 - textLength / 2).toBeGreaterThanOrEqual(16);
    expect(160 + textLength / 2).toBeLessThanOrEqual(16 + 288);
  });

  it('animates when animate=true and motion is not reduced', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const { container } = render(<Stamp kind="RETRACTED" label="RETRACTED" animate={true} />);
    expect(hasClass(container.querySelector('.ph-stamp'), 'ph-stamp--animate')).toBe(true);
  });

  it('skips the animation class under reduced motion even when animate=true', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const { container } = render(<Stamp kind="RETRACTED" label="RETRACTED" animate={true} />);
    expect(hasClass(container.querySelector('.ph-stamp'), 'ph-stamp--animate')).toBe(false);
  });

  it('never animates when animate=false', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const { container } = render(<Stamp kind="RETRACTED" label="RETRACTED" animate={false} />);
    expect(hasClass(container.querySelector('.ph-stamp'), 'ph-stamp--animate')).toBe(false);
  });

  // DESIGN.md R1.3/R1.5 (§0 registry): RETRACTED is one of R1.3's four
  // --sig-red places; REPLICATED is R1.5's one registered --assist-green
  // exception (a verdict-stamp parallel to R1.3's entry); BOTH honest verdicts
  // have no registered exception and stay on R1.2's default, --ink —
  // CONFIRMED_NULL included, deliberately, since a third registered colour
  // would be a DESIGN.md amendment (see Stamp.tsx's own note).
  it('maps each kind to its sanctioned colour class', () => {
    const cases: Array<[StampProps['kind'], string]> = [
      ['RETRACTED', 'ph-stamp__mark--red'],
      ['REPLICATED', 'ph-stamp__mark--green'],
      ['CONFIRMED_NULL', 'ph-stamp__mark--ink'],
      ['MISSED_DISCOVERY', 'ph-stamp__mark--ink'],
    ];
    for (const [kind, expectedClass] of cases) {
      const { container, unmount } = render(<Stamp kind={kind} label={kind} animate={false} />);
      const mark = container.querySelector('.ph-stamp__mark');
      expect(hasClass(mark, expectedClass)).toBe(true);
      unmount();
    }
  });
});

describe('ConfettiLayer', () => {
  function mockCanvasContext() {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    return ctx;
  }

  it('renders no canvas and calls onDone immediately under reduced motion', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const onDone = vi.fn();
    const { container } = render(<ConfettiLayer particles={100} durationMs={3000} onDone={onDone} />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('caps particles at 400 regardless of how many are requested', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const ctx = mockCanvasContext();
    // Draw exactly one frame, then stop the recursive rAF chain from firing
    // again so the test doesn't spin: only the *first* call invokes its callback.
    let calls = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      calls += 1;
      if (calls === 1) cb(0);
      return calls;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    render(<ConfettiLayer particles={4000} durationMs={3000} onDone={vi.fn()} />);

    expect(ctx.fillRect).toHaveBeenCalledTimes(400);
  });

  it('draws exactly as many particles as requested when under the cap', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const ctx = mockCanvasContext();
    let calls = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      calls += 1;
      if (calls === 1) cb(0);
      return calls;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    render(<ConfettiLayer particles={30} durationMs={3000} onDone={vi.fn()} />);

    expect(ctx.fillRect).toHaveBeenCalledTimes(30);
  });

  it('cancels its animation frame on unmount, leaking no RAF', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    mockCanvasContext();
    let idCounter = 0;
    // Never invoke the callback: simulates "a frame is scheduled" so unmount's
    // cleanup is the only thing that can resolve it.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      idCounter += 1;
      return idCounter;
    });
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { unmount } = render(<ConfettiLayer particles={10} durationMs={3000} onDone={vi.fn()} />);
    unmount();

    expect(cancelSpy).toHaveBeenCalledWith(idCounter);
  });
});

describe('EmailCard', () => {
  it('renders from/subject/body with labelled header lines', async () => {
    render(
      <LocaleProvider>
        <EmailCard from="Prof. R. Grantwell" subject="Friday" body="Make it significant." />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByText('From:')).toBeTruthy());
    expect(screen.getByText('Prof. R. Grantwell')).toBeTruthy();
    expect(screen.getByText('Subject:')).toBeTruthy();
    expect(screen.getByText('Friday')).toBeTruthy();
    expect(screen.getByText('Make it significant.')).toBeTruthy();
  });
});

describe('useReducedMotion', () => {
  function Probe() {
    const reduced = useReducedMotion();
    return <span data-testid="reduced">{String(reduced)}</span>;
  }

  it('reflects the current matchMedia state and reacts to a later change', () => {
    const mm = installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('false');

    act(() => {
      mm.set('(prefers-reduced-motion: reduce)', true);
    });

    expect(screen.getByTestId('reduced').textContent).toBe('true');
  });
});
