// @vitest-environment jsdom
//
// T22 — THE ACCESSIBILITY PASS (master spec §7.5, DESIGN.md §6, plan Task
// T22). Every assertion here pins a defect that was REPRODUCED in real
// Chrome against this build before it was fixed, not a rule copied out of a
// checklist. The measurements themselves live in
// .superpowers/sdd/2026-08-03-phackle-v1/task-T22-report.md; what each block
// below states is the behaviour that measurement forced.
//
// What this file deliberately does NOT try to be: an axe run. jsdom has no
// layout, no paint and no accessibility tree of its own, so contrast, reflow
// and "does a screen reader really say this" are all answered in a real
// browser and written up in the report. What IS mechanically checkable here
// is structure — roles, names, heading levels, live-region attributes, and
// where focus is after a transition — and that is what this file owns.
//
// Same conventions as the rest of tests/ui/*: no @testing-library/jest-dom,
// explicit afterEach(cleanup), a hand-rolled matchMedia where a component
// reads one.
import { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act, within } from '@testing-library/react';
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App from '../../src/ui/App';
import { ScreenRouter } from '../../src/ui/ScreenRouter';
import { Reveal } from '../../src/ui/screens/Reveal';
import { Published } from '../../src/ui/screens/Published';
import type { CallScreenComponent } from '../../src/ui/screens/Published';
import { Stats } from '../../src/ui/screens/Stats';
import { LEGEND_ENTRIES } from '../../src/ui/screens/Legend';
import { Summary } from '../../src/ui/screens/Summary';
import { PValueDial } from '../../src/ui/components/PValueDial';
import { ForkTrail } from '../../src/ui/components/ForkTrail';
import { SpecCurve } from '../../src/ui/charts/SpecCurve';
import { createGameStore, gameStore, useGameStore, DEFAULT_SPEC, type GameStore } from '../../src/game/store';
import { copy } from '../../src/content/en/copy';
import { content as en } from '../../src/content/en';
import { t as translate } from '../../src/i18n/t';
import type { EngineClient, RevealPayload } from '../../src/engine/protocol';
import type { RevealCurveEntry } from '../../src/engine/reveal';
import type { Outcome, PathResult, PlayerAction, Spec } from '../../src/engine/types';

/** Same bound-t convention as tests/ui/stats.test.tsx and summary.test.tsx:
 * the real helper takes the catalog first, components take it curried. */
const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate(copy, key, params);

const ROOT = process.cwd();
const APP_CSS = readFileSync(resolve(ROOT, 'src/ui/App.css'), 'utf8');
const FORK_TRAIL_TSX = readFileSync(resolve(ROOT, 'src/ui/components/ForkTrail.tsx'), 'utf8');

const ISO = '2026-09-01';
const SPEC: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function result(p: number, over: Partial<PathResult> = {}): PathResult {
  return { spec: SPEC, n: 200, beta: 0.4, se: 0.1, t: 4, p, ci: [0.2, 0.6], excludedCount: 0, valid: true, ...over };
}

function curveEntry(p: number, over: Partial<RevealCurveEntry> = {}): RevealCurveEntry {
  return { p, explored: false, published: false, outcome: 0 as Outcome, spec: SPEC, ...over };
}

function payload(over: Partial<RevealPayload> = {}): RevealPayload {
  return {
    totalPaths: 1792,
    sigPaths: 87,
    sigFraction: 87 / 1792,
    playerExplored: 14,
    pHitAtK: 0.52,
    curve: [
      curveEntry(0.01, { explored: true, published: true }),
      curveEntry(0.2, { explored: true, outcome: 1, spec: { ...SPEC, outcome: 1 } }),
      curveEntry(0.6, { outcome: 2, spec: { ...SPEC, outcome: 2 } }),
      curveEntry(0.9, { outcome: 3, spec: { ...SPEC, outcome: 3 } }),
    ],
    stamp: 'RETRACTED',
    peeks: 0,
    dayType: 'null',
    trueOutcome: null,
    trueBeta: 0,
    hetero: null,
    capExhausted: false, // gr6-102 (W5): required field on RevealPayload
    ...over,
  };
}

function fakeClient(over: Partial<EngineClient> = {}): EngineClient {
  return {
    init: async () => ({ scenarioIndex: 0, n: 200 }),
    runSpec: async () => result(0.2),
    extend: async () => ({ n: 250 }),
    reveal: async () => payload(),
    onCrash: () => {},
    ...over,
  };
}

/** Captures the real store so a test can drive the app's real flow. Written
 * from an effect, never during render (the idiom the rest of tests/ui uses). */
const harness: { store: GameStore | null } = { store: null };
function Capture() {
  const store = useGameStore((s) => s);
  useEffect(() => {
    harness.store = store;
  }, [store]);
  return null;
}
const live = () => harness.store as GameStore;

function installMatchMedia(initial: Record<string, boolean> = {}) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        media: query,
        matches: initial[query] ?? false,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
        onchange: null,
      }) as unknown as MediaQueryList
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  installMatchMedia({ '(prefers-reduced-motion: reduce)': true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ==================================================================
   DESIGN.md R6.6 (booked item b) — FOCUS FOLLOWS THE SCREEN CHANGE.

   MEASURED BEFORE THE FIX, in real Chrome against this build:
   document.activeElement was <body> after every one of briefing->lab,
   lab->published, call->reveal, reveal->summary and nav-page->game,
   because <main> is keyed and React removes the focused element with
   it. The first Tab afterwards resumed where the removed button had
   been, so the running header was skipped entirely, and a screen
   reader got no signal that the page had changed at all.
   ================================================================== */

/** The app shell around a stand-in child: no game screen is mounted, so the
 * document has exactly one <header> and the header's own controls are
 * unambiguous. (The Lab renders a second, NESTED <header> for the scenario
 * question — correctly NOT a banner, since it sits inside a <section>, but
 * testing-library's role mapping does not implement that scoping rule and
 * reports two banners. Real Chrome does: axe's landmark-no-duplicate-banner
 * is clean on the Lab, checked in the browser.) */
async function renderShell() {
  // gr6-007: App renders the boot-failure screen instead of the shell when a
  // boot never produced a day, and jsdom has no `Worker`, so App's own boot
  // attempt fails harmlessly into store.error on every render here. These
  // tests are about the BOOTED shell's landmarks and focus behaviour; the
  // boot-failure screen has its own coverage in shell.test.tsx.
  gameStore.setState({ booted: true });
  render(
    <LocaleProvider>
      <App puzzleNumber={1}>
        <div data-testid="game-child">the running game</div>
      </App>
    </LocaleProvider>
  );
  await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
}

/** The app shell around the REAL router, driven by the REAL store. */
async function renderGame() {
  gameStore.setState({ booted: true }); // see renderShell above (gr6-007)
  render(
    <LocaleProvider>
      <Capture />
      <App puzzleNumber={1}>
        <ScreenRouter />
      </App>
    </LocaleProvider>
  );
  await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
}

const mainEl = () => document.querySelector('main.ph-screen') as HTMLElement;

describe('R6.6 — focus moves to the new screen on every swap, and only on a swap', () => {
  it('does NOT steal focus on the first mount — a fresh load starts at the top of the document', async () => {
    await renderShell();
    expect(document.activeElement).toBe(document.body);
  });

  it('makes <main> programmatically focusable without adding a tab stop', async () => {
    await renderShell();
    expect(mainEl().getAttribute('tabindex')).toBe('-1');
  });

  it('focuses the new <main> on a GAME screen change (briefing -> lab)', async () => {
    await renderGame();
    await act(async () => {
      await live().boot(fakeClient(), ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    // boot() itself is a screen change (initial -> briefing); focus must be
    // on the freshly built <main>, not stranded on the removed one.
    await act(async () => live().openData());
    await waitFor(() => expect(screen.getByTestId('lab-screen')).toBeTruthy());
    expect(document.activeElement).toBe(mainEl());
  });

  it('focuses the new <main> on a NAV page change, and again on the way back', async () => {
    await renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    expect(document.activeElement).toBe(mainEl());

    fireEvent.click(screen.getByRole('button', { name: t('stats.close') }));
    expect(document.activeElement).toBe(mainEl());
    expect(screen.getByTestId('game-child')).toBeTruthy();
  });

  it('declares the focus ring on the screen container, at a NEGATED offset (full-bleed <main>)', () => {
    const body = APP_CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const rule = /\.ph-screen:focus-visible\s*\{([^}]*)\}/.exec(body)?.[1] ?? '';
    expect(rule, '.ph-screen must declare its own :focus-visible, or Chrome paints the UA ring').not.toBe('');
    expect(rule).toContain('outline: var(--focus-ring)');
    expect(rule).toMatch(/outline-offset:\s*calc\(-1 \* var\(--focus-offset\)\)/);
    // R5.5 / the brief: focus is instant. A focus indicator that fades in is
    // a focus indicator that is briefly absent.
    expect(rule).not.toMatch(/transition/);
  });
});

/* ==================================================================
   Landmarks + heading hierarchy: one h1 per screen, a real <nav>.
   ================================================================== */

describe('landmarks and headings', () => {
  it('exposes banner / navigation / main, with exactly one navigation landmark', async () => {
    await renderShell();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    // Exactly one, which is why it needs no aria-label to be unambiguous.
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: 'Stats' })).toBeTruthy();
    // The nav is a real <nav>, not a div with a role bolted on.
    expect(screen.getByRole('navigation').tagName).toBe('NAV');
  });

  it('gives the Briefing, the Lab and each nav page exactly one h1 — its own title', async () => {
    await renderGame();
    await act(async () => {
      await live().boot(fakeClient(), ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    const question = en.scenarios[live().scenarioIndex].question;

    await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(question);

    await act(async () => live().openData());
    await waitFor(() => expect(screen.getByTestId('lab-screen')).toBeTruthy());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(question);

    for (const [nav, title] of [
      ['Stats', copy['stats.title']],
      ['Legend', copy['legend.title']],
      ['About', copy['about.title']],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: nav }));
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    }
  });

  it('never skips a level: every heading under <main> is h1 then h2, never h1 then h3', async () => {
    await renderShell();
    for (const nav of ['Stats', 'Legend', 'About'] as const) {
      fireEvent.click(screen.getByRole('button', { name: nav }));
      const levels = [...screen.getByRole('main').querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
        Number(h.tagName.slice(1))
      );
      expect(levels[0], `${nav} must open at level 1`).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1], `${nav} skips a heading level at index ${i}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

/* ==================================================================
   The Lab's dial: the core loop, made audible.

   MEASURED BEFORE THE FIX: turning a knob with the arrow keys moved
   the dial from p = 0.087 to p = 0.570 and the page announced
   nothing. document.querySelectorAll('[aria-live],[role=status]')
   was empty on every screen of the game.
   ================================================================== */

describe('the p-value dial announces a new result (sweep item 2)', () => {
  function renderDial(props: { result: PathResult | null; pending: boolean }) {
    return render(
      <LocaleProvider>
        <PValueDial {...props} />
      </LocaleProvider>
    );
  }

  it('is a polite, atomic live region — the numeral AND its n/df line, read together', async () => {
    const { container } = renderDial({ result: result(0.04), pending: false });
    await waitFor(() => expect(container.querySelector('[data-testid="pvalue-dial"]')).toBeTruthy());
    const dial = container.querySelector('[data-testid="pvalue-dial"]') as HTMLElement;
    // role="status" carries aria-live="polite" + aria-atomic="true"
    // implicitly, which is exactly the pair this needs: the whole block is
    // re-read, so the p-value is never announced without its sample size.
    expect(dial.getAttribute('role')).toBe('status');
    expect(dial.textContent).toContain(t('lab.pEquals', { p: '0.040' }));
    expect(dial.textContent).toContain(t('lab.nLabel', { n: 200 }));
  });

  it('holds the announcement while a result is in flight (aria-busy gates the live region)', async () => {
    const { container } = renderDial({ result: result(0.04), pending: true });
    await waitFor(() => expect(container.querySelector('[data-testid="pvalue-dial"]')).toBeTruthy());
    const dial = container.querySelector('[data-testid="pvalue-dial"]') as HTMLElement;
    expect(dial.getAttribute('aria-busy')).toBe('true');
    expect(dial.getAttribute('role')).toBe('status');
  });

  it('changes its announced text when — and only when — the result itself changes', async () => {
    const { container, rerender } = renderDial({ result: result(0.087), pending: false });
    await waitFor(() => expect(container.querySelector('[data-testid="pvalue-dial"]')).toBeTruthy());
    const read = () => (container.querySelector('[data-testid="pvalue-dial"]') as HTMLElement).textContent;

    const before = read();
    expect(before).toContain('0.087');

    // A re-render with the SAME result mutates no text, so a live region
    // announces nothing: this is what "on result change only, not on every
    // render" means mechanically.
    rerender(
      <LocaleProvider>
        <PValueDial result={result(0.087)} pending={false} />
      </LocaleProvider>
    );
    expect(read()).toBe(before);

    rerender(
      <LocaleProvider>
        <PValueDial result={result(0.57)} pending={false} />
      </LocaleProvider>
    );
    expect(read()).not.toBe(before);
    expect(read()).toContain('0.570');
  });

  it('keeps the live region in the insufficient-data and pre-first-result states too', async () => {
    const { container, rerender } = renderDial({ result: null, pending: false });
    await waitFor(() => expect(container.querySelector('[data-testid="pvalue-dial"]')).toBeTruthy());
    expect((container.querySelector('[data-testid="pvalue-dial"]') as HTMLElement).getAttribute('role')).toBe('status');

    rerender(
      <LocaleProvider>
        <PValueDial result={result(0.5, { valid: false, n: 12 })} pending={false} />
      </LocaleProvider>
    );
    const dial = container.querySelector('[data-testid="pvalue-dial"]') as HTMLElement;
    expect(dial.getAttribute('role')).toBe('status');
    expect(dial.textContent).toContain(copy['lab.insufficient']);
  });
});

/* ==================================================================
   DESIGN.md R6.7 (booked item a) — the trail key is a DISCLOSURE.
   ================================================================== */

describe('R6.7 — the fork-trail key is a disclosure, not a tooltip wearing one', () => {
  const log: PlayerAction[] = [
    { t: 'VIEW_SPEC', spec: SPEC, seen: true, at: 0 },
    { t: 'VIEW_SPEC', spec: { ...SPEC, subgroup: 'urban' }, seen: true, at: 1 },
  ];

  function renderTrail() {
    return render(
      <LocaleProvider>
        <ForkTrail log={log} mode="hack" />
      </LocaleProvider>
    );
  }

  it('never renders role="tooltip" anywhere — the two patterns may not coexist', async () => {
    const { container } = renderTrail();
    await waitFor(() => expect(screen.getByTestId('fork-trail-key')).toBeTruthy());
    fireEvent.click(screen.getByTestId('fork-trail-key'));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    // and the source carries none either, so it cannot come back by copy-paste
    expect(FORK_TRAIL_TSX.replace(/\/\*[\s\S]*?\*\//g, ' ')).not.toContain('role="tooltip"');
  });

  it('reports its state on the trigger and points at the panel only while the panel exists', async () => {
    renderTrail();
    await waitFor(() => expect(screen.getByTestId('fork-trail-key')).toBeTruthy());
    const button = screen.getByTestId('fork-trail-key');

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls'), 'aria-controls must not point at a node that is not rendered').toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByTestId('fork-trail-popover');
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.id).not.toBe('');
  });

  it('exposes the key as a LIST, which is what a tooltip could never have been', async () => {
    renderTrail();
    fireEvent.click(screen.getByTestId('fork-trail-key'));
    const panel = screen.getByTestId('fork-trail-popover');
    expect(panel.getAttribute('role')).toBe('list');
    const items = within(panel).getAllByRole('listitem');
    // Against LEGEND_ENTRIES rather than a magic number: the popover and the
    // Legend page are built from the same deduped list by design (T29), so
    // this is the invariant that matters — they can never disagree about how
    // many rows the vocabulary has. (Seven today, after the four spec-change
    // kinds collapsed onto one glyph; verified in the rendered popover.)
    expect(items).toHaveLength(LEGEND_ENTRIES.length);
    expect(items[0].textContent).not.toBe('');
  });

  it('keeps every behaviour T29 pinned: focus opens, Escape dismisses', async () => {
    renderTrail();
    const button = screen.getByTestId('fork-trail-key');
    fireEvent.focus(button);
    expect(screen.getByTestId('fork-trail-popover')).toBeTruthy();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();
  });
});

/* ==================================================================
   Sweep item 3 — figures say what they actually draw.
   ================================================================== */

describe('figures: the two SpecCurve plates are different pictures and say so', () => {
  const points = payload().curve.map((e) => ({
    p: e.p,
    outcome: (e as RevealCurveEntry).outcome,
    explored: (e as RevealCurveEntry).explored,
    published: (e as RevealCurveEntry).published,
    spec: (e as RevealCurveEntry).spec,
  }));

  function label(grouped: boolean) {
    const { container } = render(
      <SpecCurve points={points} grouped={grouped} outcomeLabels={en.scenarios[0].outcomeLabels} copy={copy} />
    );
    return container.querySelector('svg[role="img"]')?.getAttribute('aria-label');
  }

  it('names the sorted plate and the grouped plate differently', () => {
    const sorted = label(false);
    cleanup();
    const grouped = label(true);
    expect(sorted).toBe(copy['a11y.specCurveChart']);
    expect(grouped).toBe(copy['a11y.specCurveGrouped']);
    expect(sorted).not.toBe(grouped);
  });

  it('claims no publication in either label — that is the caption\'s and the recipe line\'s job', () => {
    // The old string said "with your published specification highlighted"
    // unconditionally, which is false on the abandon path (nothing is
    // published, and the chart's own legend drops its published row).
    for (const key of ['a11y.specCurveChart', 'a11y.specCurveGrouped'] as const) {
      expect(copy[key].toLowerCase()).not.toContain('published');
    }
  });
});

/* ==================================================================
   Sweep item 7 — the two axe `aria-prohibited-attr` failures (serious).
   ================================================================== */

describe('Stats: a text alternative that actually reaches the accessibility tree', () => {
  const stats = {
    hackDays: 3,
    preregDays: 0,
    streak: 2,
    maxStreak: 4,
    callsTotal: 3,
    callsCorrect: 2,
    careerPoints: 75,
    forkHistogram: [1, 0, 2],
  };

  function renderStats() {
    return render(
      <Stats
        t={t}
        stats={stats}
        history={{}}
        achievements={{}}
        achievementDefs={en.achievements}
        onClose={() => {}}
      />
    );
  }

  it('gives each histogram bar role="img", so its aria-label is not discarded', () => {
    const { container } = renderStats();
    const bars = [...container.querySelectorAll('.ph-stats__hist-bar')];
    expect(bars.length).toBe(stats.forkHistogram.length);
    for (const bar of bars) {
      // aria-label on a role-less <span> maps to `generic`, which PROHIBITS a
      // name — the label was being dropped, and it is the only place the
      // bar's meaning exists (the count beside it is aria-hidden).
      expect(bar.getAttribute('role')).toBe('img');
      expect(bar.getAttribute('aria-label')).not.toBe(null);
    }
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('gives every locked achievement stamp role="img", so the wall is not silent', () => {
    const { container } = renderStats();
    const locked = [...container.querySelectorAll('.ph-stats__ach-locked')];
    expect(locked.length).toBeGreaterThan(0);
    for (const stamp of locked) {
      expect(stamp.getAttribute('role')).toBe('img');
      expect(stamp.getAttribute('aria-label')).toBe(copy['stats.locked']);
    }
  });

  it('names its region from its own h1, so the plain "Close" button is never heard bare', () => {
    const { container } = renderStats();
    const region = container.querySelector('.ph-stats') as HTMLElement;
    const heading = screen.getByRole('heading', { level: 1, name: copy['stats.title'] });
    expect(region.getAttribute('aria-labelledby')).toBe(heading.id);
    // and the button no longer claims to close a dialog that does not exist
    expect(screen.getByRole('button', { name: copy['stats.close'] })).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy['a11y.closeDialog'] })).toBeNull();
  });
});

/* ==================================================================
   Sweep item 1 / WCAG 2.1.2 — the Call overlay has a keyboard exit.

   MEASURED BEFORE THE FIX: the overlay traps Tab between the two
   cards, and Escape did nothing. A keyboard player who opened "Face
   the truth" to look could not reach the cover, the header or the
   theme toggle again without committing to a verdict.
   ================================================================== */

describe('the Call overlay is a modal you can leave (WCAG 2.1.2)', () => {
  function FakeCallScreen() {
    return (
      <div>
        <button type="button">Real</button>
        <button type="button">Noise</button>
      </div>
    );
  }
  const fakeCallScreen = FakeCallScreen as CallScreenComponent;

  function renderPublished() {
    const store = createGameStore();
    store.setState({
      screen: 'published',
      scenarioIndex: 0,
      puzzleNumber: 1,
      published: DEFAULT_SPEC,
      result: result(0.02),
    });
    function useFakeStore<T>(selector: (s: GameStore) => T): T {
      return zustandUseStore(store, selector);
    }
    return render(
      <LocaleProvider>
        <Published useStore={useFakeStore} callScreen={fakeCallScreen} />
      </LocaleProvider>
    );
  }

  // FIX ROUND 1 (review I1). This test used to assert only the OUTCOME —
  // `document.activeElement === cta` — and that assertion is permanently
  // vacuous here: jsdom does not implement `inert`'s focus blocking, so it
  // passed against an implementation that focused the CTA while the cover was
  // still inert, which in a real browser is a silent no-op (measured: focus
  // stayed on <body>). What jsdom CAN see is the ORDERING, so that is what is
  // asserted now: at the moment `focus()` is called, the cover must already
  // have shed its `inert` attribute — i.e. the restore ran after React's
  // commit, not before it. Reverting the fix (focusing synchronously inside
  // closeCall) fails this on the inert assertion, checked by doing exactly
  // that before committing.
  it('closes on Escape and restores focus only AFTER the cover has stopped being inert', async () => {
    const { container } = renderPublished();
    await waitFor(() => expect(screen.getByText(copy['published.faceTruth'])).toBeTruthy());
    const cta = screen.getByText(copy['published.faceTruth']) as HTMLButtonElement;
    const cover = () => container.querySelector('.ph-published__cover') as HTMLElement;

    // Record the DOM's inert state at the instant focus() is invoked, then
    // call through so the outcome below still means something.
    let inertWhenFocused: boolean | null = null;
    const realFocus = HTMLElement.prototype.focus.bind(cta);
    const focusSpy = vi.spyOn(cta, 'focus').mockImplementation(() => {
      inertWhenFocused = cover().hasAttribute('inert');
      realFocus();
    });

    fireEvent.click(cta);
    await waitFor(() => expect(screen.getByText('Real')).toBeTruthy());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(cover().hasAttribute('inert')).toBe(true);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(focusSpy, 'the CTA must be re-focused exactly once on dismissal').toHaveBeenCalledTimes(1);
    expect(
      inertWhenFocused,
      'focus() ran while the cover was still inert — in a real browser that is a no-op and focus is lost to <body>'
    ).toBe(false);
    expect(document.activeElement).toBe(cta);
  });

  it('does not steal focus on mount, only on a genuine open -> closed edge', async () => {
    renderPublished();
    await waitFor(() => expect(screen.getByText(copy['published.faceTruth'])).toBeTruthy());
    // `callOpen` starts false, so the restore effect runs once at mount with
    // nothing to restore. It must do nothing at all.
    expect(document.activeElement).toBe(document.body);
  });

  it('restores the cover to the accessibility tree on the way out', async () => {
    const { container } = renderPublished();
    await waitFor(() => expect(screen.getByText(copy['published.faceTruth'])).toBeTruthy());
    const cover = () => container.querySelector('.ph-published__cover') as HTMLElement;

    fireEvent.click(screen.getByText(copy['published.faceTruth']));
    await waitFor(() => expect(screen.getByText('Real')).toBeTruthy());
    expect(cover().getAttribute('aria-hidden')).toBe('true');
    expect(cover().hasAttribute('inert')).toBe(true);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(cover().getAttribute('aria-hidden')).toBeNull();
    expect(cover().hasAttribute('inert')).toBe(false);
  });

  it('reopens cleanly, so leaving costs nothing', async () => {
    renderPublished();
    await waitFor(() => expect(screen.getByText(copy['published.faceTruth'])).toBeTruthy());
    fireEvent.click(screen.getByText(copy['published.faceTruth']));
    await waitFor(() => expect(screen.getByText('Real')).toBeTruthy());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByText(copy['published.faceTruth']));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });
});

/* ==================================================================
   Booked items c + e — the Reveal.
   ================================================================== */

describe('the Reveal (booked items c and e)', () => {
  async function mountReveal(over: Partial<RevealPayload> = {}, path: 'abandon' | 'submit' = 'submit') {
    const p = payload(over);
    const view = render(
      <LocaleProvider>
        <Capture />
        <Reveal />
      </LocaleProvider>
    );
    await act(async () => {
      await live().boot(fakeClient({ reveal: async () => p, runSpec: async () => result(0.01) }), ISO, {
        practice: false,
        mode: 'hack',
        scenarioCount: 20,
      });
    });
    await act(async () => live().openData());
    await act(async () => {
      if (path === 'submit') await live().submit();
      else await live().abandon();
    });
    await act(async () => {
      await live().makeCall('noise');
    });
    await waitFor(() => expect(view.container.querySelector('.ph-reveal')).toBeTruthy());
    return view;
  }

  it('has exactly one h1 — the manuscript question — and keeps it out of the layout', async () => {
    const { container } = await mountReveal();
    const h1s = [...container.querySelectorAll('h1')];
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(en.scenarios[live().scenarioIndex].question);
    // Visually hidden, NOT display:none / visibility:hidden — both of which
    // would take it back out of the accessibility tree, which is the point.
    expect(h1s[0].className).toContain('ph-visually-hidden');
    const util = APP_CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const rule = /\.ph-visually-hidden\s*\{([^}]*)\}/.exec(util)?.[1] ?? '';
    expect(rule).not.toBe('');
    expect(rule).not.toMatch(/display:\s*none/);
    expect(rule).not.toMatch(/visibility:\s*hidden/);
    expect(rule).toMatch(/clip-path/);
  });

  it('booked (c): every scroll-gated block is in the DOM and in the a11y tree before it has "entered"', async () => {
    // jsdom has no IntersectionObserver, so useEnterOnce fails OPEN and every
    // block carries ph-fade--in here (reveal.test.tsx pins that separately).
    // What THIS asserts is the property that makes the opacity gate safe in a
    // real browser, where three of the six are still un-entered at mount:
    // the gate is opacity ONLY — no display:none, no visibility:hidden, no
    // aria-hidden, no hidden attribute — so the whole account is readable in
    // browse mode before a single pixel of it has faded in. Measured in
    // Chrome at 1280x900: stamp/call/fig2 sat at computed opacity 0 with
    // display:block and visibility:visible, and their text was reachable.
    const { container } = await mountReveal();
    const blocks = [...container.querySelectorAll('[data-block]')];
    expect(blocks).toHaveLength(6);
    for (const block of blocks) {
      expect(block.getAttribute('aria-hidden'), `${block.getAttribute('data-block')} is hidden from AT`).toBeNull();
      expect(block.hasAttribute('hidden')).toBe(false);
      expect((block as HTMLElement).textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
    const css = readFileSync(resolve(ROOT, 'src/ui/screens/Reveal.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const base = /\.ph-fade\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(base).toContain('opacity: 0');
    expect(base, 'the entrance gate must never remove the block from the a11y tree').not.toMatch(
      /display:\s*none|visibility:\s*hidden|content-visibility/
    );
  });

  it('booked (e): tells Act II\'s story in §2.7\'s order, verdict and figures included', async () => {
    const { container } = await mountReveal();
    const order = [...container.querySelectorAll('[data-block]')].map((b) => b.getAttribute('data-block'));
    expect(order).toEqual(['truth', 'fig1', 'accounting', 'stamp', 'call', 'fig2']);

    // And the same order is what the accessible text sequence actually reads.
    const text = container.textContent ?? '';
    const at = (needle: string) => text.indexOf(needle);
    expect(at(copy['reveal.truthNull'].replace('{beta}', '0.000'))).toBeGreaterThanOrEqual(0);
    expect(at(copy['reveal.fig1'])).toBeGreaterThan(at(copy['reveal.truthNull'].replace('{beta}', '0.000')));
    expect(at(copy['reveal.curveCaption'])).toBeGreaterThan(at(copy['reveal.fig1']));
    expect(at(copy['reveal.fig2'])).toBeGreaterThan(at(copy['reveal.curveCaption']));
    expect(at(copy['reveal.groupedCaption'])).toBeGreaterThan(at(copy['reveal.fig2']));
    expect(at(copy['reveal.toSummary'])).toBeGreaterThan(at(copy['reveal.groupedCaption']));
  });

  it('gives the verdict stamp a real text alternative, ahead of the call resolution', async () => {
    const { container } = await mountReveal();
    const stampBlock = container.querySelector('[data-block="stamp"]') as HTMLElement;
    const graphic = stampBlock.querySelector('[role="img"]') as HTMLElement;
    expect(graphic.getAttribute('aria-label')).toContain(copy['reveal.retracted']);
    const blocks = [...container.querySelectorAll('[data-block]')].map((b) => b.getAttribute('data-block'));
    expect(blocks.indexOf('stamp')).toBeLessThan(blocks.indexOf('call'));
  });

  it('carries both figures with their own caption, and fig. 2 with its own description', async () => {
    const { container } = await mountReveal();
    const figures = [...container.querySelectorAll('figure.ph-figure')];
    expect(figures).toHaveLength(2);
    expect(figures[0].querySelector('figcaption')?.textContent).toContain(copy['reveal.curveCaption']);
    expect(figures[1].querySelector('figcaption')?.textContent).toContain(copy['reveal.groupedCaption']);
    expect(figures[0].querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe(copy['a11y.specCurveChart']);
    expect(figures[1].querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe(copy['a11y.specCurveGrouped']);
  });
});

/* ==================================================================
   Booked item d — the Summary's unlock block needs no live region.
   ================================================================== */

describe('booked (d): the unlock block is first-render content, not an interruption', () => {
  const unlocked = [{ id: 'first_blood' as const, ...en.achievements.first_blood }];

  function renderSummary(withUnlocks: boolean) {
    return render(
      <Summary
        t={t}
        breakdown={[['summary.breakdownParsimony', 10]]}
        score={10}
        streak={1}
        now={new Date('2026-09-01T12:00:00')}
        shareText="x"
        preregUnlocked={false}
        unlocked={withUnlocks ? unlocked : []}
      />
    );
  }

  it('declares no live region of its own — a screen reader reaches it in document order', () => {
    const { container } = renderSummary(true);
    const block = container.querySelector('.ph-summary__unlock') as HTMLElement;
    expect(block).toBeTruthy();
    expect(block.getAttribute('aria-live')).toBeNull();
    expect(block.getAttribute('role')).toBeNull();
    expect(block.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('is a level-2 section under the screen\'s own h1, between the invoice and the share button', () => {
    const { container } = renderSummary(true);
    expect(screen.getByRole('heading', { level: 1, name: copy['summary.invoiceTitle'] })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: copy['summary.unlockedToday'] })).toBeTruthy();
    const html = container.innerHTML;
    expect(html.indexOf('ph-summary__unlock')).toBeGreaterThan(html.indexOf('ph-summary__invoice'));
    expect(html.indexOf('ph-summary__unlock')).toBeLessThan(html.indexOf('ph-summary__share'));
  });

  it('renders nothing at all on a day that unlocked nothing (no empty heading to announce)', () => {
    const { container } = renderSummary(false);
    expect(container.querySelector('.ph-summary__unlock')).toBeNull();
  });

  // The share button's own accessible name is pinned by summary.test.tsx's
  // WCAG 2.5.3 note; re-asserted here because the label it must NOT wear
  // (a11y.shareButton) still exists in the catalog for the clipboard path.
  it('leaves the Share button named by its visible label (WCAG 2.5.3)', () => {
    renderSummary(false);
    const button = screen.getByRole('button', { name: copy['summary.share'] });
    expect(button.getAttribute('aria-label')).toBeNull();
  });
});
