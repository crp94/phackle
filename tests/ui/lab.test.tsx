// @vitest-environment jsdom
//
// T14: the Lab screen (SpecControls, PValueDial, CoefPlot, ForkTrail) and
// their wiring into src/ui/screens/Lab.tsx. Follows tests/ui/shell.test.tsx's
// own conventions (no @testing-library/jest-dom; plain DOM property reads;
// a local `hasClass` helper for SVG-safe class checks) and
// tests/game/store.test.ts's fixture shapes (makeResult/makeFakeClient).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within, act } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { content as enContent } from '../../src/content/en';
import { copy as enCopy } from '../../src/content/en/copy';
import { SpecControls } from '../../src/ui/components/SpecControls';
import { PValueDial, PValueDialCaption } from '../../src/ui/components/PValueDial';
import { CoefPlot } from '../../src/ui/components/CoefPlot';
import { ForkTrail } from '../../src/ui/components/ForkTrail';
import { Lab } from '../../src/ui/screens/Lab';
import { LEGEND_ENTRIES } from '../../src/ui/screens/Legend';
import { coefCssPixelsPerUnit } from '../../src/ui/components/CoefPlot';
import { gameStore, DEFAULT_SPEC } from '../../src/game/store';
import { loadState, saveSettings } from '../../src/game/storage';
import { DEBOUNCE_MS, EPOCH, N_SCHEDULE } from '../../src/game/tuning';
import type { EngineClient, ExtendInfo, InitInfo, RevealPayload } from '../../src/engine/protocol';
import type { PathResult, PlayerAction, Spec } from '../../src/engine/types';

// getAttribute('class'), not .className — an <svg>'s .className is an
// SVGAnimatedString (no .split), matching tests/ui/shell.test.tsx's helper.
function hasClass(el: Element | null, className: string): boolean {
  return !!el && (el.getAttribute('class') ?? '').split(/\s+/).includes(className);
}

const scenario = enContent.scenarios[0]; // 'cat-crypto'

function makeResult(overrides: Partial<PathResult> = {}): PathResult {
  return {
    spec: DEFAULT_SPEC,
    n: 200,
    beta: 0.12,
    se: 0.05,
    t: 2.4,
    p: 0.02,
    ci: [0.02, 0.22],
    excludedCount: 0,
    valid: true,
    ...overrides,
  };
}

function makeRevealPayload(overrides: Partial<RevealPayload> = {}): RevealPayload {
  return {
    totalPaths: 1792,
    sigPaths: 87,
    sigFraction: 0.0486,
    playerExplored: 1,
    pHitAtK: 0.52,
    curve: [],
    stamp: 'RETRACTED',
    peeks: 0,
    dayType: 'null',
    trueOutcome: null,
    trueBeta: 0,
    hetero: null,
    ...overrides,
  };
}

function makeFakeClient(): EngineClient {
  return {
    init: vi.fn().mockResolvedValue({ scenarioIndex: 0, n: 200 } satisfies InitInfo),
    runSpec: vi.fn().mockResolvedValue(makeResult()),
    extend: vi.fn().mockResolvedValue({ n: 250 } satisfies ExtendInfo),
    reveal: vi.fn().mockResolvedValue(makeRevealPayload()),
    onCrash: vi.fn(),
  };
}

async function bootIntoLab(client: EngineClient) {
  await act(async () => {
    await gameStore.getState().boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: enContent.scenarios.length });
    gameStore.getState().openData();
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// SpecControls
// ---------------------------------------------------------------------------

describe('SpecControls', () => {
  it('renders exactly six ARIA radiogroups, each containing role="radio" options (R6.5: no dropdowns)', async () => {
    const { container } = render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={vi.fn()} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    const groups = await screen.findAllByRole('radiogroup');
    expect(groups).toHaveLength(6);
    for (const g of groups) {
      expect(within(g).getAllByRole('radio').length).toBeGreaterThan(0);
    }
    expect(container.querySelector('select')).toBeNull();
  });

  it('marks exactly the option matching the current spec as aria-checked=true', async () => {
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={vi.fn()} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    const checkedOutcome = screen.getByRole('radio', { name: scenario.outcomeLabels[0] });
    const uncheckedOutcome = screen.getByRole('radio', { name: scenario.outcomeLabels[1] });
    expect(checkedOutcome.getAttribute('aria-checked')).toBe('true');
    expect(uncheckedOutcome.getAttribute('aria-checked')).toBe('false');
  });

  it('uses roving tabindex: only the checked option in a group is tabbable', async () => {
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={vi.fn()} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    const checked = screen.getByRole('radio', { name: 'Two-tailed' });
    const unchecked = screen.getByRole('radio', { name: 'One-tailed' });
    expect(checked.getAttribute('tabindex')).toBe('0');
    expect(unchecked.getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowRight moves selection to the next option and fires onChange with the updated spec', async () => {
    const onChange = vi.fn();
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={onChange} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    const twoTailed = screen.getByRole('radio', { name: 'Two-tailed' });
    twoTailed.focus();
    fireEvent.keyDown(twoTailed, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SPEC, tails: 'one' });
  });

  it('ArrowRight wraps from the last option back to the first', async () => {
    const onChange = vi.fn();
    render(
      <LocaleProvider>
        <SpecControls spec={{ ...DEFAULT_SPEC, tails: 'one' }} onChange={onChange} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    const oneTailed = screen.getByRole('radio', { name: 'One-tailed' });
    oneTailed.focus();
    fireEvent.keyDown(oneTailed, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SPEC, tails: 'two' });
  });

  it('ArrowLeft moves to the previous option, wrapping from the first to the last', async () => {
    const onChange = vi.fn();
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={onChange} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    const twoTailed = screen.getByRole('radio', { name: 'Two-tailed' }); // first of two
    twoTailed.focus();
    fireEvent.keyDown(twoTailed, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SPEC, tails: 'one' });
  });

  it('moves focus to the newly-selected option on an arrow key', async () => {
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={vi.fn()} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    const twoTailed = screen.getByRole('radio', { name: 'Two-tailed' });
    twoTailed.focus();
    fireEvent.keyDown(twoTailed, { key: 'ArrowRight' });
    expect(document.activeElement?.textContent).toBe('One-tailed');
  });

  it('clicking an option calls onChange with the updated spec (covariates: both)', async () => {
    const onChange = vi.fn();
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={onChange} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    const bothLabel = `${scenario.covariateLabels.income} + ${scenario.covariateLabels.risk}`;
    fireEvent.click(screen.getByRole('radio', { name: bothLabel }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SPEC, covariates: { income: true, risk: true } });
  });

  it('disables every option when disabled=true (kept for future prereg reuse)', async () => {
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={vi.fn()} scenario={scenario} disabled={true} />
      </LocaleProvider>
    );
    const radios = await screen.findAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    for (const r of radios) {
      expect((r as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PValueDial
// ---------------------------------------------------------------------------

describe('PValueDial', () => {
  it('formats a p-value with three decimals ("p = 0.049")', async () => {
    render(
      <LocaleProvider>
        <PValueDial result={makeResult({ p: 0.049 })} pending={false} />
      </LocaleProvider>
    );
    expect(await screen.findByText('p = 0.049')).toBeTruthy();
  });

  it('formats a very small p-value as "p < 0.001" rather than rounding to zero', async () => {
    render(
      <LocaleProvider>
        <PValueDial result={makeResult({ p: 0.0004 })} pending={false} />
      </LocaleProvider>
    );
    expect(await screen.findByText('p < 0.001')).toBeTruthy();
  });

  it('shows N and df beneath the p-value', async () => {
    render(
      <LocaleProvider>
        <PValueDial result={makeResult({ p: 0.02, n: 200 })} pending={false} />
      </LocaleProvider>
    );
    await screen.findByText('p = 0.020');
    expect(screen.getByText('n = 200', { exact: false })).toBeTruthy();
    expect(screen.getByText('df = 198', { exact: false })).toBeTruthy();
  });

  it('is NOT in the significant state at p=0.06 (submit-relevant boundary)', async () => {
    const { container } = render(
      <LocaleProvider>
        <PValueDial result={makeResult({ p: 0.06 })} pending={false} />
      </LocaleProvider>
    );
    await screen.findByText('p = 0.060');
    expect(hasClass(container.querySelector('[data-testid="pvalue-dial"]'), 'ph-dial--significant')).toBe(false);
  });

  it('IS in the significant ("+glow") state at p=0.049', async () => {
    const { container } = render(
      <LocaleProvider>
        <PValueDial result={makeResult({ p: 0.049 })} pending={false} />
      </LocaleProvider>
    );
    await screen.findByText('p = 0.049');
    expect(hasClass(container.querySelector('[data-testid="pvalue-dial"]'), 'ph-dial--significant')).toBe(true);
  });

  // DESIGN.md R1.8 (post-review fix): a discrete 5-state colour ramp, never a
  // continuous opacity blend — see the band boundaries in PValueDial.tsx's
  // own dialBand(). One test per boundary (0.5 / 0.2 / 0.1 / 0.05).
  describe('R1.8 stepped colour band (0.5 / 0.2 / 0.1 / 0.05 boundaries)', () => {
    const cases: Array<[p: number, band: string | null]> = [
      [0.6, null], // p > .5 -> the --muted default, no step/significant class
      [0.5, 'ph-dial--step-1'], // .2 < p <= .5
      [0.2, 'ph-dial--step-2'], // .1 < p <= .2
      [0.1, 'ph-dial--step-3'], // .05 <= p <= .1
      [0.05, 'ph-dial--step-3'], // boundary: never itself significant (submit needs p < .05 strictly)
      [0.049, 'ph-dial--significant'], // p < .05
    ];

    it.each(cases)('p=%s maps to %s', async (p, band) => {
      const { container } = render(
        <LocaleProvider>
          <PValueDial result={makeResult({ p })} pending={false} />
        </LocaleProvider>
      );
      await screen.findByText(/^p [=<]/);
      const dial = container.querySelector('[data-testid="pvalue-dial"]');
      for (const candidate of ['ph-dial--step-1', 'ph-dial--step-2', 'ph-dial--step-3', 'ph-dial--significant']) {
        expect(hasClass(dial, candidate)).toBe(candidate === band);
      }
    });

    it('never sets an inline opacity on the value element, at any band', async () => {
      for (const p of [0.9, 0.5, 0.2, 0.1, 0.049]) {
        const { container, unmount } = render(
          <LocaleProvider>
            <PValueDial result={makeResult({ p })} pending={false} />
          </LocaleProvider>
        );
        await screen.findByText(/^p [=<]/);
        const value = container.querySelector('.ph-dial__value') as HTMLElement;
        expect(value.style.opacity).toBe('');
        unmount();
      }
    });
  });

  it('renders the insufficient-data copy instead of the numeral when valid=false, even with a plausible p', async () => {
    render(
      <LocaleProvider>
        <PValueDial result={makeResult({ p: 0.01, valid: false })} pending={false} />
      </LocaleProvider>
    );
    expect(await screen.findByText(enCopy['lab.insufficient'])).toBeTruthy();
    expect(screen.queryByText('p = 0.010')).toBeNull();
  });

  it('renders a neutral placeholder when no result is available yet', () => {
    const { container } = render(
      <LocaleProvider>
        <PValueDial result={null} pending={false} />
      </LocaleProvider>
    );
    expect(container.querySelector('[data-testid="pvalue-dial"]')).toBeTruthy();
    expect(hasClass(container.querySelector('[data-testid="pvalue-dial"]'), 'ph-dial--significant')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CoefPlot
// ---------------------------------------------------------------------------

describe('CoefPlot', () => {
  it('renders an SVG with a zero-reference line, the CI interval, and the estimate point when valid', async () => {
    const { container } = render(
      <LocaleProvider>
        <CoefPlot result={makeResult({ beta: 0.12, ci: [0.02, 0.22] })} unit="%" />
      </LocaleProvider>
    );
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
    expect(container.querySelectorAll('svg line').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('svg circle')).toBeTruthy();
  });

  it('gives the figure an accessible caption naming the estimate and CI', async () => {
    render(
      <LocaleProvider>
        <CoefPlot result={makeResult({ beta: 0.12, ci: [0.02, 0.22] })} unit="%" />
      </LocaleProvider>
    );
    expect(await screen.findByText('Estimate 0.12 % (95% CI 0.02 to 0.22)')).toBeTruthy();
  });

  it('renders only the zero line (no CI/point marks) when the result is invalid', async () => {
    const { container } = render(
      <LocaleProvider>
        <CoefPlot result={makeResult({ valid: false })} unit="%" />
      </LocaleProvider>
    );
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
    expect(container.querySelector('svg circle')).toBeNull();
  });

  it('renders only the zero line when there is no result yet', () => {
    const { container } = render(
      <LocaleProvider>
        <CoefPlot result={null} unit="%" />
      </LocaleProvider>
    );
    expect(container.querySelector('svg circle')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ForkTrail
// ---------------------------------------------------------------------------

describe('ForkTrail', () => {
  function view(spec: Spec, seen: boolean, at: number): PlayerAction {
    return { t: 'VIEW_SPEC', spec, seen, at };
  }
  function peekAction(at: number): PlayerAction {
    return { t: 'PEEK_AND_EXTEND', newN: 250, at };
  }

  // T29 (owner ruling, src/game/share.ts's FORK_EMOJI): 'spec' and 'subgroup'
  // are still two distinct fork KINDS — classifyChange is untouched and the
  // achievements read it — but both now PRINT 🍴. The log and the transitions
  // below are unchanged; only the expected glyph run is.
  it('shows 🍴🍴 for a free view, then a spec-fork, then a subgroup-fork', async () => {
    const s0 = DEFAULT_SPEC;
    const s1: Spec = { ...DEFAULT_SPEC, outcome: 1 }; // differs only in outcome -> 'spec' (🍴)
    const s2: Spec = { ...s1, subgroup: 'urban' }; // differs only in subgroup -> 'subgroup' (🍴)
    const log: PlayerAction[] = [view(s0, false, 0), view(s1, true, 1), view(s2, true, 2)];
    render(
      <LocaleProvider>
        <ForkTrail log={log} mode="hack" />
      </LocaleProvider>
    );
    expect(await screen.findByText('🍴🍴')).toBeTruthy();
  });

  it('includes a peek marker for PEEK_AND_EXTEND', async () => {
    const s0 = DEFAULT_SPEC;
    const s1: Spec = { ...DEFAULT_SPEC, outcome: 1 };
    const log: PlayerAction[] = [view(s0, false, 0), peekAction(1), view(s1, true, 2)];
    render(
      <LocaleProvider>
        <ForkTrail log={log} mode="hack" />
      </LocaleProvider>
    );
    expect(await screen.findByText('➕🍴')).toBeTruthy();
  });

  it('prefixes the trail with 🧾 in prereg mode', async () => {
    const log: PlayerAction[] = [view(DEFAULT_SPEC, false, 0)];
    render(
      <LocaleProvider>
        <ForkTrail log={log} mode="prereg" />
      </LocaleProvider>
    );
    expect(await screen.findByText('🧾')).toBeTruthy();
  });

  it('shows an em-dash placeholder before any fork has happened in hack mode', async () => {
    const log: PlayerAction[] = [view(DEFAULT_SPEC, false, 0)];
    render(
      <LocaleProvider>
        <ForkTrail log={log} mode="hack" />
      </LocaleProvider>
    );
    expect(await screen.findByText('—')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Lab (full integration against the real store singleton + a fake client)
// ---------------------------------------------------------------------------

describe('Lab', () => {
  it('boots into the lab, showing controls, the dial and the fork trail', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    expect(await screen.findByTestId('lab-screen')).toBeTruthy();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(6);
    expect(screen.getByTestId('pvalue-dial')).toBeTruthy();
  });

  it('an arrow-key move on a radiogroup fires exactly one debounced runSpec after settling', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const callsBefore = (client.runSpec as Mock).mock.calls.length; // 1, from boot's own prefetch

    const twoTailed = screen.getByRole('radio', { name: 'Two-tailed' });
    twoTailed.focus();
    fireEvent.keyDown(twoTailed, { key: 'ArrowRight' });

    // Still debouncing immediately after the key press.
    expect((client.runSpec as Mock).mock.calls.length).toBe(callsBefore);

    await waitFor(() => expect((client.runSpec as Mock).mock.calls.length).toBe(callsBefore + 1), {
      timeout: DEBOUNCE_MS + 1000,
    });
    expect(client.runSpec).toHaveBeenLastCalledWith({ ...DEFAULT_SPEC, tails: 'one' });
  });

  it('disables Submit while p >= .05', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.06 }));
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const submitBtn = await screen.findByRole('button', { name: enCopy['lab.submit'] });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Submit (and shows the significant dial state) once p < .05', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.049 }));
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const submitBtn = await screen.findByRole('button', { name: enCopy['lab.submit'] });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    expect(hasClass(container.querySelector('[data-testid="pvalue-dial"]'), 'ph-dial--significant')).toBe(true);
  });

  it('disables Submit and shows the insufficient-data copy when valid=false, even at a plausible p', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.01, valid: false }));
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const submitBtn = await screen.findByRole('button', { name: enCopy['lab.submit'] });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(enCopy['lab.insufficient'])).toBeTruthy();
  });

  it('shows the sincere peek footnote after the first peek, and the Armitage wink only after the second', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);

    expect(screen.queryByText(enCopy['lab.peekFootnote'])).toBeNull();
    expect(screen.queryByText(enCopy['lab.peekFootnoteArmitage'])).toBeNull();

    const collectBtn = () => screen.getByRole('button', { name: /Collect \d+ more/ });
    fireEvent.click(collectBtn());
    await waitFor(() => expect(screen.getByText(enCopy['lab.peekFootnote'])).toBeTruthy());
    expect(screen.queryByText(enCopy['lab.peekFootnoteArmitage'])).toBeNull();

    fireEvent.click(collectBtn());
    await waitFor(() => expect(screen.getByText(enCopy['lab.peekFootnoteArmitage'])).toBeTruthy());
    // Co-presence: the Armitage wink is ADDITIONAL, not a replacement — the
    // sincere 1st-peek line must still be on screen after the 2nd peek.
    expect(screen.getByText(enCopy['lab.peekFootnote'])).toBeTruthy();
  });

  it('disables "Collect more" once N has reached 400', async () => {
    const client = makeFakeClient();
    const rest = N_SCHEDULE.slice(1);
    for (const step of rest) {
      (client.extend as Mock).mockResolvedValueOnce({ n: step } satisfies ExtendInfo);
    }
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);

    const collectBtn = () => screen.getByRole('button', { name: /Collect \d+ more/ });
    for (let i = 0; i < rest.length; i++) {
      const before = (client.extend as Mock).mock.calls.length;
      fireEvent.click(collectBtn());
      await waitFor(() => expect((client.extend as Mock).mock.calls.length).toBe(before + 1));
    }
    await waitFor(() => expect((collectBtn() as HTMLButtonElement).disabled).toBe(true));
  });

  it('"Report a null result" is always available and moves off the lab', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const abandonBtn = await screen.findByRole('button', { name: enCopy['lab.reportNull'] });
    expect((abandonBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(abandonBtn);
    await waitFor(() => expect(gameStore.getState().screen).toBe('call'));
  });

  it('lays out results before controls in the DOM (mobile: results pinned top)', async () => {
    const client = makeFakeClient();
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');
    const lab = container.querySelector('[data-testid="lab-screen"]') as HTMLElement;
    const children = Array.from(lab.children);
    const resultsIdx = children.findIndex((c) => c.querySelector('[data-testid="pvalue-dial"]'));
    const controlsIdx = children.findIndex((c) => c.querySelector('[role="radiogroup"]'));
    expect(resultsIdx).toBeGreaterThanOrEqual(0);
    expect(controlsIdx).toBeGreaterThan(resultsIdx);
  });
});

// ---------------------------------------------------------------------------
// T31: the explanations half of the play-test round ("the UX/UI needs graphs
// at least; and explanations; it feels too barebone"). Six methods notes, a
// first-run intro that persists its own dismissal, and a CoefPlot that reads
// as a labelled figure rather than an unlabelled line.
// ---------------------------------------------------------------------------

describe('SpecControls methods notes (T31)', () => {
  const NOTE_KEYS = [
    'lab.explain.outcome',
    'lab.explain.subgroup',
    'lab.explain.covariates',
    'lab.explain.exclusion',
    'lab.explain.transform',
    'lab.explain.tails',
  ] as const;

  it('renders one note under each of the six groups, from the copy catalog', async () => {
    render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={vi.fn()} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    await screen.findAllByRole('radiogroup');
    for (const key of NOTE_KEYS) {
      expect(screen.getByText(enCopy[key]), `missing note for ${key}`).toBeTruthy();
    }
    expect(screen.getAllByTestId('spec-group-note')).toHaveLength(6);
  });

  it('associates each note with its own radiogroup via aria-describedby', async () => {
    const { container } = render(
      <LocaleProvider>
        <SpecControls spec={DEFAULT_SPEC} onChange={vi.fn()} scenario={scenario} disabled={false} />
      </LocaleProvider>
    );
    const groups = await screen.findAllByRole('radiogroup');
    expect(groups).toHaveLength(6);
    for (const group of groups) {
      const id = group.getAttribute('aria-describedby');
      expect(id, 'every radiogroup must point at its note').toBeTruthy();
      const note = container.querySelector(`#${id}`);
      expect(note, `no note element with id ${id}`).toBeTruthy();
      expect(note?.getAttribute('data-testid')).toBe('spec-group-note');
      expect(note?.textContent).not.toBe('');
    }
  });

  it('keeps every note in the Act-I sincere register: no note calls the choice into question', () => {
    // The reveal owns the indictment (and lab.peekFootnoteArmitage is the one
    // sanctioned Act-I wink). A note that hedged would spoil the turn.
    const suspicious =
      /\b(cheat|cheating|naughty|suspicious|dubious|questionable|p-hack|fish|nudge|convenient|trick|bias(?:ed)?)\b/i;
    for (const key of NOTE_KEYS) {
      expect(enCopy[key], `${key} breaks the sincere register`).not.toMatch(suspicious);
    }
  });
});

describe('PValueDial caption (T31) — the app\'s single most important explanation', () => {
  // The play-test said the UI is "beautiful but hard to fully grasp". This
  // line is the answer: whatever state the dial is in, it must say what the
  // number means and what makes it publishable — including BEFORE the first
  // result, which is the very moment a first-timer is most lost.
  //
  // T29 (controller ruling, dial-alone-sticky): the caption is now a SIBLING
  // of the dial block rather than a child of it, because the Lab makes that
  // block `position: sticky` on mobile and a sticky element taller than its
  // share of the viewport paints over the controls (T31's measured bug). The
  // requirement this suite exists for is unchanged and is asserted below
  // against the LAB — the only place either of them actually renders — so it
  // is now stated about the real screen instead of about a component in
  // isolation.
  it.each([
    ['a real result', makeResult({ p: 0.4 })],
    ['an invalid result', makeResult({ valid: false })],
    ['no result yet', null],
  ] as const)('renders in every dial state: %s', async (_label, result) => {
    render(
      <LocaleProvider>
        <>
          <PValueDial result={result} pending={false} />
          <PValueDialCaption />
        </>
      </LocaleProvider>
    );
    expect(await screen.findByText(enCopy['lab.dialCaption'])).toBeTruthy();
  });

  it('sits immediately under the dial block in the Lab, so it reads as that number\'s caption', async () => {
    const client = makeFakeClient();
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');
    await screen.findByText(enCopy['lab.dialCaption']);

    const dialBlock = container.querySelector('.ph-lab__dial') as HTMLElement;
    const caption = container.querySelector('.ph-dial__caption') as HTMLElement;
    // Outside the sticky block (pin 1's height constraint)...
    expect(dialBlock.contains(caption)).toBe(false);
    expect(caption.textContent).toBe(enCopy['lab.dialCaption']);
    // ...but the very next thing after it in the document.
    expect(dialBlock.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const results = container.querySelector('.ph-lab__results') as HTMLElement;
    expect(results.firstElementChild).toBe(caption);
  });

  it('names 0.05 in plain words, with no statistics vocabulary a first-timer would have to look up', () => {
    const jargon = /\b(null hypothesis|significance|significant|alpha|type i|two-tailed|distribution|estimator)\b/i;
    expect(enCopy['lab.dialCaption']).toMatch(/0\.05/);
    expect(enCopy['lab.dialCaption']).not.toMatch(jargon);
  });
});

describe('CoefPlot figure labels (T31)', () => {
  it('labels the axis with the outcome unit', async () => {
    render(
      <LocaleProvider>
        <CoefPlot result={makeResult()} unit="%" />
      </LocaleProvider>
    );
    expect(await screen.findByText(enCopy['lab.coefPlotAxis'].replace('{unit}', '%'))).toBeTruthy();
  });

  it('labels the zero reference line', async () => {
    render(
      <LocaleProvider>
        <CoefPlot result={makeResult()} unit="%" />
      </LocaleProvider>
    );
    expect(await screen.findByText(enCopy['lab.coefPlotZero'])).toBeTruthy();
  });

  it('labels the zero line even with no result yet, so the empty figure still reads', async () => {
    render(
      <LocaleProvider>
        <CoefPlot result={null} unit="%" />
      </LocaleProvider>
    );
    expect(await screen.findByText(enCopy['lab.coefPlotZero'])).toBeTruthy();
  });

  it('tracks its container so one viewBox unit is one CSS pixel at every width', () => {
    for (const width of [320, 660, 1088, 272, 520]) {
      expect(coefCssPixelsPerUnit(width)).toBe(1);
    }
  });
});

describe('Lab first-run intro (T31)', () => {
  const intro = () => screen.queryByTestId('lab-intro');

  it('shows on a first visit, collapsible, with the title and all four steps in order', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const el = await screen.findByTestId('lab-intro');
    expect(el.tagName.toLowerCase()).toBe('details'); // collapsible, no JS, no animation (R5.5)
    expect(within(el).getByText(enCopy['lab.howThisWorks.title'])).toBeTruthy();

    const steps = within(el).getAllByTestId('lab-intro-step');
    expect(steps.map((s) => s.textContent)).toEqual([
      enCopy['lab.howThisWorks.step1'],
      enCopy['lab.howThisWorks.step2'],
      enCopy['lab.howThisWorks.step3'],
      enCopy['lab.howThisWorks.step4'],
    ]);
  });

  it('numbers the steps as a real ordered list, so the sequence survives a screen reader', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const el = await screen.findByTestId('lab-intro');
    expect(el.querySelector('ol')).toBeTruthy();
  });

  it('starts expanded: a first-timer must not have to discover the instructions', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    const el = (await screen.findByTestId('lab-intro')) as HTMLDetailsElement;
    expect(el.open).toBe(true);
  });

  it('dismissing it persists settings.introSeen and removes it from the screen', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-intro');

    fireEvent.click(screen.getByRole('button', { name: enCopy['lab.howThisWorks.dismiss'] }));
    await waitFor(() => expect(intro()).toBeNull());
    expect(loadState().settings.introSeen).toBe(true);
  });

  it('never renders again once introSeen is persisted', async () => {
    saveSettings({ introSeen: true });
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');
    expect(intro()).toBeNull();
  });

  it('leaves the rest of the persisted settings alone when it writes', async () => {
    saveSettings({ locale: 'en', theme: 'dark' });
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-intro');
    fireEvent.click(screen.getByRole('button', { name: enCopy['lab.howThisWorks.dismiss'] }));
    await waitFor(() => expect(loadState().settings.introSeen).toBe(true));
    expect(loadState().settings.theme).toBe('dark');
    expect(loadState().settings.locale).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// T31 FIX ROUND — finding 4 ("RESTORED REQUIREMENT — Legend pointer"): the
// live fork trail's own emoji carry no explanation anywhere in the Lab; this
// pins the quiet --muted line next to it, and that it actually points at the
// Legend page by name.
// ---------------------------------------------------------------------------

describe('Lab fork trail Legend pointer (T31 fix round, finding 4)', () => {
  it('renders a muted hint next to the fork trail, from the copy catalog', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    expect(await screen.findByText(enCopy['lab.forkTrailHint'])).toBeTruthy();
    expect(enCopy['lab.forkTrailHint']).toMatch(/Legend/i);
  });

  it('sits after the fork trail in the DOM, not before it', async () => {
    const client = makeFakeClient();
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');
    const results = container.querySelector('.ph-lab__results') as HTMLElement;
    const children = Array.from(results.children);
    const trailIdx = children.findIndex((c) => c.querySelector('.ph-fork-trail') || c.classList.contains('ph-fork-trail'));
    const hintIdx = children.findIndex((c) => c.getAttribute('data-testid') === 'lab-fork-trail-hint');
    expect(trailIdx).toBeGreaterThanOrEqual(0);
    expect(hintIdx).toBeGreaterThan(trailIdx);
  });
});

describe('Lab data figure (T31)', () => {
  it("renders the DataCut from the current result's cut", async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(
      makeResult({ cut: { control: [1, 2, 3], treated: [4, 5, 6], excludedControl: [], excludedTreated: [99] } })
    );
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');
    await waitFor(() => expect(container.querySelectorAll('[data-role="cut-dot"]')).toHaveLength(6));
    expect(container.querySelectorAll('[data-role="cut-excluded"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-role="cut-mean"]')).toHaveLength(2);
  });

  it("names the treated column with the day's own treatment label", async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    expect(await screen.findByText(scenario.treatmentLabel)).toBeTruthy();
  });

  it('still renders the figure frame before the first result lands', async () => {
    const client = makeFakeClient();
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');
    expect(container.querySelector('.ph-datacut')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T29 — the controller's dial-alone-sticky ruling (pin 1), the scenario
// question header (pin 10), and the fork trail's own key (pin 11-NEW-b).
// ---------------------------------------------------------------------------

describe('T29 pin 1 — dial-alone-sticky DOM structure', () => {
  it('makes the dial block a direct child of .ph-lab, ahead of both panes', async () => {
    const client = makeFakeClient();
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');

    const lab = container.querySelector('[data-testid="lab-screen"]') as HTMLElement;
    const children = Array.from(lab.children);
    const dialIdx = children.findIndex((c) => c.classList.contains('ph-lab__dial'));
    const resultsIdx = children.findIndex((c) => c.classList.contains('ph-lab__results'));
    const controlsIdx = children.findIndex((c) => c.classList.contains('ph-lab__controls'));

    // A DIRECT child: its containing block has to span the controls, or a
    // sticky dial cannot stay on screen while a knob at the bottom is turned.
    expect(dialIdx).toBeGreaterThanOrEqual(0);
    // ...ahead of the results pane and the controls — the stacked mobile
    // reading order, and what the >=768px grid then re-forms into two panes.
    expect(resultsIdx).toBeGreaterThan(dialIdx);
    expect(controlsIdx).toBeGreaterThan(resultsIdx);
  });

  it('keeps the sticky block to the numeral and n/df — nothing that would make it tall', async () => {
    const client = makeFakeClient();
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');
    await screen.findByText(enCopy['lab.dialCaption']);

    const dialBlock = container.querySelector('.ph-lab__dial') as HTMLElement;
    expect(dialBlock.querySelector('.ph-dial__value')).toBeTruthy();
    expect(dialBlock.querySelector('.ph-dial__meta')).toBeTruthy();
    // The things that made T31's whole-pane sticky taller than the viewport
    // are all OUTSIDE it — this assertion IS the regression guard.
    expect(dialBlock.querySelector('.ph-dial__caption')).toBeNull();
    expect(dialBlock.querySelector('.ph-coef-plot')).toBeNull();
    expect(dialBlock.querySelector('.ph-datacut')).toBeNull();
    expect(dialBlock.querySelector('button')).toBeNull();
  });

  // T29 FIX ROUND (review finding: a guard the caption refactor lost).
  // PValueDialCaption is now state-independent — it reads nothing from the
  // store — so every other assertion about it happens to run against a Lab
  // that already has a result, and NOTHING in the suite would catch someone
  // wrapping it in `{result && …}` in Lab.tsx. That would silently delete the
  // app's single most important explanation from the one screen where a
  // first-time player needs it most: the empty dial, before their first run.
  // Pinned here, at exactly that moment.
  it('renders the dial caption BEFORE any first result exists', async () => {
    const client: EngineClient = {
      ...makeFakeClient(),
      // Deliberately never resolves: boot parks on this await, so the store
      // sits in its genuine pre-first-result Lab state for the whole test
      // (result === null, pending === true) rather than one faked with
      // setState after the fact.
      runSpec: vi.fn(() => new Promise<PathResult>(() => {})),
    };
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await act(async () => {
      void gameStore
        .getState()
        .boot(client, EPOCH, { practice: false, mode: 'hack', scenarioCount: enContent.scenarios.length });
    });
    await waitFor(() => expect(gameStore.getState().pending).toBe(true));
    await act(async () => {
      gameStore.getState().openData();
    });

    // The precondition this test exists for: no result has ever arrived.
    expect(gameStore.getState().result).toBeNull();

    const caption = container.querySelector('.ph-dial__caption') as HTMLElement;
    expect(caption, 'the dial caption must not be gated on a result').toBeTruthy();
    expect(caption.textContent).toBe(enCopy['lab.dialCaption']);
    expect((container.querySelector('.ph-lab__results') as HTMLElement).firstElementChild).toBe(caption);
  });
});

describe("T29 pin 10 — the day's question lives on the Lab too", () => {
  it("renders the scenario's own question, from content, above everything else", async () => {
    const client = makeFakeClient();
    const { container } = render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    await screen.findByTestId('lab-screen');

    const scenario = enContent.scenarios[gameStore.getState().scenarioIndex];
    const header = await screen.findByTestId('lab-question');
    expect(header.textContent).toBe(scenario.question);

    const lab = container.querySelector('[data-testid="lab-screen"]') as HTMLElement;
    expect(lab.firstElementChild).toBe(header);
    // ...and NOT inside the sticky dial block: pin 1's height constraint
    // stands, and a scenario question is one to three lines of serif.
    expect((container.querySelector('.ph-lab__dial') as HTMLElement).contains(header)).toBe(false);
  });

  it('shows the question and the how-to-play steps at the same time', async () => {
    const client = makeFakeClient();
    render(
      <LocaleProvider>
        <Lab />
      </LocaleProvider>
    );
    await bootIntoLab(client);
    expect(await screen.findByTestId('lab-question')).toBeTruthy();
    expect(await screen.findByTestId('lab-intro')).toBeTruthy();
    expect((await screen.findAllByTestId('lab-intro-step')).length).toBe(4);
  });
});

describe('T29 pin 11-NEW-b — the key, where the symbols are', () => {
  function renderTrail() {
    return render(
      <LocaleProvider>
        <ForkTrail log={[]} mode="hack" />
      </LocaleProvider>
    );
  }

  it('offers a legend affordance next to the trail, closed by default', async () => {
    renderTrail();
    const button = await screen.findByTestId('fork-trail-key');
    expect(button.textContent).toBe(enCopy['nav.legend']);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();
  });

  it('opens on hover and closes again on pointer-leave', async () => {
    const { container } = renderTrail();
    const wrap = container.querySelector('.ph-fork-trail__key') as HTMLElement;
    fireEvent.mouseEnter(wrap);
    expect(await screen.findByTestId('fork-trail-popover')).toBeTruthy();
    fireEvent.mouseLeave(wrap);
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();
  });

  it('opens on keyboard focus and closes on Escape', async () => {
    renderTrail();
    const button = await screen.findByTestId('fork-trail-key');
    fireEvent.focus(button);
    const popover = await screen.findByTestId('fork-trail-popover');
    expect(button.getAttribute('aria-controls')).toBe(popover.getAttribute('id'));
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();
  });

  it('closes when focus leaves the control entirely', async () => {
    renderTrail();
    const button = await screen.findByTestId('fork-trail-key');
    fireEvent.focus(button);
    await screen.findByTestId('fork-trail-popover');
    fireEvent.blur(button, { relatedTarget: document.body });
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();
  });

  it('opens on a bare click — the keyboard/AT activation path, and toggles closed on the next one', async () => {
    renderTrail();
    const button = await screen.findByTestId('fork-trail-key');
    fireEvent.click(button);
    expect(await screen.findByTestId('fork-trail-popover')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();
  });

  // T29 FIX ROUND — the review's touch-robustness finding. The comment this
  // block replaced claimed a click "is all a touch device fires". It is not:
  // a first tap fires the COMPATIBILITY mouseenter first and the click after
  // it, so hover opened the popover and the click closed it again a moment
  // later. On a phone the key flashed and vanished, and the same sequence
  // driven in real headless Chrome against the built app left it closed.
  it('ends OPEN on the real mobile sequence: compatibility mouseenter, then click', async () => {
    const { container } = renderTrail();
    const wrap = container.querySelector('.ph-fork-trail__key') as HTMLElement;
    const button = await screen.findByTestId('fork-trail-key');

    fireEvent.mouseEnter(wrap);
    fireEvent.click(button);

    expect(screen.queryByTestId('fork-trail-popover'), 'the tap must not close what its own hover opened').toBeTruthy();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    // ...and the tap after that still dismisses it, or the key could never
    // be put away on a device with no pointer to move off it.
    fireEvent.click(button);
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();
  });

  it('ends OPEN when the pointer identifies itself as touch before the compatibility events', async () => {
    const { container } = renderTrail();
    const wrap = container.querySelector('.ph-fork-trail__key') as HTMLElement;
    const button = await screen.findByTestId('fork-trail-key');

    // pointerenter always precedes the compatibility mouseenter and carries
    // the real device, so a touch pointer suppresses the hover-open outright
    // and leaves the tap to the click handler.
    fireEvent.pointerEnter(wrap, { pointerType: 'touch' });
    fireEvent.mouseEnter(wrap);
    fireEvent.click(button);

    expect(screen.queryByTestId('fork-trail-popover')).toBeTruthy();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('still opens on a mouse hover after a touch interaction (a hybrid laptop re-arms per enter)', async () => {
    const { container } = renderTrail();
    const wrap = container.querySelector('.ph-fork-trail__key') as HTMLElement;

    fireEvent.pointerEnter(wrap, { pointerType: 'touch' });
    fireEvent.mouseEnter(wrap);
    fireEvent.mouseLeave(wrap);
    expect(screen.queryByTestId('fork-trail-popover')).toBeNull();

    fireEvent.pointerEnter(wrap, { pointerType: 'mouse' });
    fireEvent.mouseEnter(wrap);
    expect(await screen.findByTestId('fork-trail-popover')).toBeTruthy();
  });

  it('lists exactly the current vocabulary, derived from the Legend page\'s own mapping', async () => {
    const { container } = renderTrail();
    fireEvent.click(await screen.findByTestId('fork-trail-key'));
    const rows = container.querySelectorAll('.ph-fork-trail__popover-row');
    expect(rows).toHaveLength(LEGEND_ENTRIES.length);
    LEGEND_ENTRIES.forEach((entry, i) => {
      expect(rows[i].querySelector('.ph-fork-trail__popover-glyph')?.textContent).toBe(entry.glyph);
      expect(rows[i].querySelector('.ph-fork-trail__popover-label')?.textContent).toBe(enCopy[entry.labelKey]);
    });
    // No glyph appears twice: the reduced set is the whole point.
    const glyphs = [...rows].map((r) => r.querySelector('.ph-fork-trail__popover-glyph')?.textContent);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  // T34 (owner play-test finding — see Legend.test.tsx's own T34 case for
  // the full context): the popover's glyph column, same as the Legend
  // page's, routes every glyph through GlyphMark rather than a bare text
  // node, so the CALL_CORRECT/CALL_INCORRECT compound sequence (⚖️✅/⚖️❌)
  // always carries letter-spacing independent of the row's own flex `gap`.
  it('renders every popover glyph through GlyphMark (ph-glyph-mark)', async () => {
    const { container } = renderTrail();
    fireEvent.click(await screen.findByTestId('fork-trail-key'));
    const glyphSpans = container.querySelectorAll('.ph-fork-trail__popover-glyph');
    expect(glyphSpans).toHaveLength(LEGEND_ENTRIES.length);
    glyphSpans.forEach((span) => {
      expect(span.classList.contains('ph-glyph-mark')).toBe(true);
    });
  });
});
