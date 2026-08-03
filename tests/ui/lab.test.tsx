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
import { PValueDial } from '../../src/ui/components/PValueDial';
import { CoefPlot } from '../../src/ui/components/CoefPlot';
import { ForkTrail } from '../../src/ui/components/ForkTrail';
import { Lab } from '../../src/ui/screens/Lab';
import { gameStore, DEFAULT_SPEC } from '../../src/game/store';
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

  it('shows 🍴🎯 for a free view, then a spec-fork, then a subgroup-fork', async () => {
    const s0 = DEFAULT_SPEC;
    const s1: Spec = { ...DEFAULT_SPEC, outcome: 1 }; // differs only in outcome -> 'spec' (🍴)
    const s2: Spec = { ...s1, subgroup: 'urban' }; // differs only in subgroup -> 'subgroup' (🎯)
    const log: PlayerAction[] = [view(s0, false, 0), view(s1, true, 1), view(s2, true, 2)];
    render(
      <LocaleProvider>
        <ForkTrail log={log} mode="hack" />
      </LocaleProvider>
    );
    expect(await screen.findByText('🍴🎯')).toBeTruthy();
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
