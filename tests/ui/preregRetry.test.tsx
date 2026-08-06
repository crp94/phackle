// @vitest-environment jsdom
//
// w6-r-002 (review fix round 1) — the Prereg freeze-release was ONE-SHOT.
//
// gr6-043 gave Prereg.tsx a release for its local `submitting` freeze:
// `frozen = submitting && storeError === null`, so a commit that FAILED left
// the form usable rather than moving the dead end one layer up. But nothing in
// the store ever cleared `error` except `boot`, so after the session's first
// failure `storeError === null` was permanently false — and therefore `frozen`
// was permanently false. Measured consequence, on a mode whose entire premise
// is irreversible commitment:
//
//   * the SECOND commit rendered an unlocked, re-submittable form while it was
//     in flight, with "Locked in. No more changes until the reveal." absent;
//   * a THIRD click therefore dispatched into `preregCommit`'s own
//     `|| s.pending` guard, which throws — past `void preregCommit(spec)`, an
//     unhandled rejection, the exact class gr6-043 exists to kill.
//
// Driven here against the REAL store and a scripted client, through the REAL
// component: reject once, then hang.
//
// A separate file from tests/ui/prereg.test.tsx deliberately — that file
// belongs to another wave in this review, and a new file cannot collide with
// whatever it becomes.
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { createGameStore, type GameStore } from '../../src/game/store';
import { copy as enCopy } from '../../src/content/en/copy';
import { Prereg } from '../../src/ui/screens/Prereg';
import type { EngineClient, ExtendInfo, InitInfo, RevealPayload } from '../../src/engine/protocol';
import type { PathResult } from '../../src/engine/types';
import { EPOCH } from '../../src/game/tuning';

function makeResult(): PathResult {
  return {
    spec: {
      outcome: 0,
      subgroup: 'all',
      covariates: { income: false, risk: false },
      exclusion: 'none',
      transform: 'raw',
      tails: 'two',
    },
    n: 400,
    beta: 0.1,
    se: 0.05,
    t: 2,
    p: 0.2,
    ci: [0, 0.2],
    excludedCount: 0,
    valid: true,
  };
}

function makeRevealPayload(): RevealPayload {
  return {
    totalPaths: 1792,
    sigPaths: 87,
    sigFraction: 0.0486,
    playerExplored: 1,
    pHitAtK: 0.52,
    curve: [],
    stamp: 'NULL_REPORTED',
    peeks: 0,
    dayType: 'null',
    trueOutcome: null,
    trueBeta: 0,
    hetero: null,
  };
}

/** Rejects the first `extend`, then hangs forever on the next one — the
 * reviewer's own scenario, and the shape a wedged worker actually produces. */
function rejectOnceThenHang(): EngineClient {
  let extendCalls = 0;
  return {
    init: vi.fn().mockResolvedValue({ scenarioIndex: 0, n: 200 } satisfies InitInfo),
    runSpec: vi.fn().mockResolvedValue(makeResult()),
    extend: vi.fn(() => {
      extendCalls += 1;
      if (extendCalls === 1) return Promise.reject(new Error('engine worker crashed'));
      return new Promise<ExtendInfo>(() => {});
    }),
    reveal: vi.fn().mockResolvedValue(makeRevealPayload()),
    onCrash: vi.fn(),
  };
}

async function renderPrereg(client: EngineClient) {
  const store = createGameStore();
  await store.getState().boot(client, EPOCH, { practice: false, mode: 'prereg', scenarioCount: 20 });
  store.getState().chooseMode('prereg');

  // The REAL action, wrapped so the test can count what the screen actually
  // dispatched and catch what it rejected with. `void preregCommit(spec)` in
  // Prereg.tsx discards the promise, and jsdom does not reliably surface an
  // `unhandledrejection` event for that — so asserting on a window listener
  // would be a test that cannot fail. This records the rejection at the seam
  // instead, which is the same fact stated somewhere it can be observed.
  const realCommit = store.getState().preregCommit;
  const dispatches: string[] = [];
  const rejections: string[] = [];
  store.setState({
    preregCommit: ((spec) => {
      dispatches.push('call');
      return realCommit(spec).catch((err: unknown) => {
        rejections.push(err instanceof Error ? err.message : String(err));
        throw err;
      });
    }) as GameStore['preregCommit'],
  });

  function useFakeStore<T>(selector: (s: GameStore) => T): T {
    return zustandUseStore(store, selector);
  }
  const utils = render(
    <LocaleProvider>
      <Prereg useStore={useFakeStore} />
    </LocaleProvider>
  );
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy());
  return { store, dispatches, rejections, ...utils };
}

const submitButton = () => screen.getByRole('button', { name: enCopy['prereg.submit'] });
const lockedLine = () => screen.queryByText(enCopy['prereg.locked']);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Prereg — the freeze survives a failed attempt (w6-r-002)', () => {
  it('the SECOND in-flight commit freezes the form exactly like the first', async () => {
    const client = rejectOnceThenHang();
    const { store } = await renderPrereg(client);

    // --- attempt 1: freeze, then fail ---------------------------------
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());
    expect(lockedLine(), 'attempt 1 did not freeze').toBeTruthy();

    await waitFor(() => expect(store.getState().error).toBe('engine worker crashed'));
    // The release gr6-043 added: the day is playable again, so the form is too.
    await waitFor(() => expect(lockedLine()).toBeNull());
    expect(store.getState().pending).toBe(false);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false);

    // --- attempt 2: must freeze AGAIN ---------------------------------
    fireEvent.click(submitButton());
    await waitFor(() => expect(store.getState().pending).toBe(true));

    expect(lockedLine(), 'the second in-flight commit left the form unlocked').toBeTruthy();
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect(submitButton().hasAttribute('disabled')).toBe(true);
    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('a third and fourth click while the second commit is in flight dispatch nothing, so nothing rejects into the void', async () => {
    const client = rejectOnceThenHang();
    const { store, dispatches, rejections } = await renderPrereg(client);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton()); // attempt 1 -> rejects inside the store
    await waitFor(() => expect(store.getState().error).toBe('engine worker crashed'));
    await waitFor(() => expect(lockedLine()).toBeNull());

    fireEvent.click(submitButton()); // attempt 2 -> hangs; the form must freeze
    await waitFor(() => expect(store.getState().pending).toBe(true));

    fireEvent.click(submitButton()); // attempt 3 -> must be a no-op
    fireEvent.click(submitButton()); // attempt 4 -> must be a no-op
    await new Promise((resolve) => setTimeout(resolve, 0));

    // TWO dispatches, not four. The frozen form is the only thing standing
    // between those clicks and preregCommit's `|| s.pending` guard, which
    // THROWS — and `void preregCommit(spec)` has nowhere to put a throw.
    expect(dispatches).toHaveLength(2);
    // gr6-043's own contract, restated here where it is easy to break: the
    // store surfaces failures through `error` and never by rejecting.
    expect(rejections).toEqual([]);
    expect(store.getState().pending).toBe(true);
  });

  it('the error banner does not outlive the crash: the retry clears it as it dispatches', async () => {
    const client = rejectOnceThenHang();
    const { store } = await renderPrereg(client);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());
    await waitFor(() => expect(store.getState().error).toBe('engine worker crashed'));
    await waitFor(() => expect(lockedLine()).toBeNull());

    fireEvent.click(submitButton());
    await waitFor(() => expect(store.getState().pending).toBe(true));
    expect(store.getState().error).toBeNull();
  });
});
