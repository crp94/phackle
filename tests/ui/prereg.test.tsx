// @vitest-environment jsdom
//
// T18: the PREREG screen (master spec §2.6/§7.3) — the preregistration FORM.
// Same conventions as tests/ui/briefing.test.tsx (no @testing-library/jest-dom,
// afterEach(cleanup), a fake isolated createGameStore() instance injected via
// the `useStore` prop rather than the real singleton).
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { createGameStore, DEFAULT_SPEC, type GameStore } from '../../src/game/store';
import { copy as enCopy } from '../../src/content/en/copy';
import { Prereg } from '../../src/ui/screens/Prereg';

function makeFakeStoreHook(overrides: Partial<GameStore>) {
  const store = createGameStore();
  store.setState(overrides);
  function useFakeStore<T>(selector: (s: GameStore) => T): T {
    return zustandUseStore(store, selector);
  }
  return { useFakeStore, store };
}

function renderPrereg(overrides: Partial<GameStore> = {}) {
  const preregCommit = vi.fn().mockResolvedValue(undefined);
  const changeSpec = vi.fn(() => {
    throw new Error('Prereg.tsx must never call store.changeSpec — it is guarded to screen==="lab" only');
  });
  const { useFakeStore, store } = makeFakeStoreHook({
    scenarioIndex: 0,
    preregCommit: preregCommit as unknown as GameStore['preregCommit'],
    changeSpec: changeSpec as unknown as GameStore['changeSpec'],
    ...overrides,
  });
  const utils = render(
    <LocaleProvider>
      <Prereg useStore={useFakeStore} />
    </LocaleProvider>
  );
  return { store, preregCommit, ...utils };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Prereg screen — the preregistration form', () => {
  it('renders the manuscript-register title and intro', async () => {
    renderPrereg();
    await waitFor(() => expect(screen.getByText(enCopy['prereg.title'])).toBeTruthy());
    expect(screen.getByText(enCopy['prereg.intro'])).toBeTruthy();
  });

  it('renders all six SpecControls groups (reused, undisabled, no live result panel)', async () => {
    renderPrereg();
    await waitFor(() => expect(screen.getAllByRole('radiogroup')).toHaveLength(6));
    // No PValueDial/CoefPlot: the whole point is nothing is ever shown before
    // commit (§2.8's α lesson). "p =" never appears anywhere on this screen.
    expect(screen.queryByText(/^p [=<]/)).toBeNull();
  });

  it('renders the solemn commit checkbox, unchecked by default, with §7.3\'s pinned wording', async () => {
    renderPrereg();
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy());
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText(enCopy['prereg.commit'])).toBeTruthy();
  });

  it('the submit CTA is disabled until the checkbox is ticked', async () => {
    renderPrereg();
    await waitFor(() => expect(screen.getByRole('button', { name: enCopy['prereg.submit'] })).toBeTruthy());
    const submit = screen.getByRole('button', { name: enCopy['prereg.submit'] });
    expect(submit.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit.hasAttribute('disabled')).toBe(false);
  });

  it('clicking submit while unchecked calls preregCommit zero times', async () => {
    const { preregCommit } = renderPrereg();
    await waitFor(() => expect(screen.getByRole('button', { name: enCopy['prereg.submit'] })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: enCopy['prereg.submit'] }));

    expect(preregCommit).not.toHaveBeenCalled();
  });

  it('ticking the box then submitting calls preregCommit exactly once, with the DEFAULT spec unchanged', async () => {
    const { preregCommit } = renderPrereg();
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy());

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: enCopy['prereg.submit'] }));

    expect(preregCommit).toHaveBeenCalledTimes(1);
    expect(preregCommit).toHaveBeenCalledWith(DEFAULT_SPEC);
  });

  it('changing a knob before commit updates the LOCAL spec passed to preregCommit — never store.changeSpec', async () => {
    const { preregCommit } = renderPrereg();
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy());

    // Flip the subgroup knob to "Urban" (one of the six groups) via its
    // radiogroup option — this must NOT throw (renderPrereg's changeSpec spy
    // throws if Prereg.tsx ever calls the store's changeSpec, which is
    // guarded to screen==='lab' only).
    fireEvent.click(screen.getByRole('radio', { name: enCopy['lab.subgroupUrban'] }));

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: enCopy['prereg.submit'] }));

    expect(preregCommit).toHaveBeenCalledWith({ ...DEFAULT_SPEC, subgroup: 'urban' });
  });

  it('after submitting, the controls, checkbox and submit button are all disabled, and the "locked" status shows', async () => {
    renderPrereg();
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy());

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: enCopy['prereg.submit'] }));

    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: enCopy['prereg.submit'] }).hasAttribute('disabled')).toBe(true);
    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
    }
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(enCopy['prereg.locked'])).toBeTruthy();
  });

  it('renders nothing before content has loaded (behind the app-level gate)', () => {
    const { store } = makeFakeStoreHook({ scenarioIndex: 0 });
    function useFakeStore<T>(selector: (s: GameStore) => T): T {
      return zustandUseStore(store, selector);
    }
    const { container } = render(
      <LocaleProvider>
        <Prereg useStore={useFakeStore} />
      </LocaleProvider>
    );
    expect(container.textContent).toBe('');
  });
});
