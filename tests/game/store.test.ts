import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { EngineClient, ExtendInfo, InitInfo, RevealPayload } from '../../src/engine/protocol';
import type { PathResult, Spec } from '../../src/engine/types';
import { specKey } from '../../src/engine/specGrid';
import { createGameStore, DEFAULT_SPEC } from '../../src/game/store';
import { DEBOUNCE_MS, EPOCH, N_SCHEDULE } from '../../src/game/tuning';

// --- fixtures / helpers -----------------------------------------------------

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

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const specA: Spec = { ...DEFAULT_SPEC, outcome: 1 };
const specB: Spec = { ...DEFAULT_SPEC, subgroup: 'urban' };

const BOOT_OPTS = { practice: false, mode: 'hack' as const, scenarioCount: 1792 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- boot --------------------------------------------------------------

describe('boot', () => {
  it('initializes the engine, prefetches the default spec, and stays on briefing until openData()', async () => {
    const client = makeFakeClient();
    const store = createGameStore();

    expect(store.getState().screen).toBe('briefing');
    expect(store.getState().iso).toBe(''); // unset until boot() completes

    await store.getState().boot(client, EPOCH, BOOT_OPTS);

    const s = store.getState();
    // §2.3: "Open the data" is a player CTA — boot() prefetches the default
    // spec's result but must not itself advance past briefing.
    expect(s.screen).toBe('briefing');
    expect(s.mode).toBe('hack');
    expect(s.practice).toBe(false);
    expect(s.puzzleNumber).toBe(1); // EPOCH is puzzle #1
    // T17 review round 2: boot() retains its own iso (the puzzle's day),
    // distinct from any later live wall-clock read — see GameStore['iso'].
    expect(s.iso).toBe(EPOCH);
    expect(s.scenarioIndex).toBe(0);
    expect(s.n).toBe(200);
    expect(s.spec).toEqual(DEFAULT_SPEC);
    expect(s.result).toEqual(makeResult());
    expect(s.pending).toBe(false);
    expect(s.error).toBeNull();

    // The default spec's initial viewing is logged but free (§2.10).
    expect(s.log).toEqual([{ t: 'VIEW_SPEC', spec: DEFAULT_SPEC, seen: false, at: expect.any(Number) }]);
    expect(s.forks).toBe(0);
    // T30: resultLog starts empty — nothing has been superseded yet.
    expect(s.resultLog).toEqual([]);

    expect(client.init).toHaveBeenCalledWith(EPOCH, 1792, undefined);
    expect(client.runSpec).toHaveBeenCalledTimes(1);
    expect(client.runSpec).toHaveBeenCalledWith(DEFAULT_SPEC);
    expect(client.onCrash).toHaveBeenCalledTimes(1);
  });

  it('sets the practice flag and forwards a generated seed when opts.practice is true', async () => {
    const client = makeFakeClient();
    const store = createGameStore();

    await store.getState().boot(client, EPOCH, { practice: true, mode: 'hack', scenarioCount: 1792 });

    expect(store.getState().practice).toBe(true);
    expect(client.init).toHaveBeenCalledTimes(1);
    const call = (client.init as Mock).mock.calls[0];
    expect(call[0]).toBe(EPOCH);
    expect(call[1]).toBe(1792);
    expect(typeof call[2]).toBe('number');
  });

  it('sets prereg mode when requested', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, { practice: false, mode: 'prereg', scenarioCount: 1792 });
    expect(store.getState().mode).toBe('prereg');
  });

  it('registers an onCrash handler that surfaces an error without touching screen', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);

    const crashHandler = (client.onCrash as Mock).mock.calls[0][0] as () => void;
    crashHandler();

    expect(store.getState().error).toBe('engine crashed');
    expect(store.getState().screen).toBe('briefing');
  });

  it('captures an init failure into `error` instead of throwing, and does not advance past briefing', async () => {
    const client = makeFakeClient();
    (client.init as Mock).mockRejectedValueOnce(new Error('worker unavailable'));
    const store = createGameStore();

    await expect(store.getState().boot(client, EPOCH, BOOT_OPTS)).resolves.toBeUndefined();

    expect(store.getState().screen).toBe('briefing');
    expect(store.getState().error).toBe('worker unavailable');
    expect(store.getState().pending).toBe(false);
  });
});

// --- openData (§2.3 "Open the data" CTA) ----------------------------------

describe('openData (§2.2/§2.3 briefing -> lab)', () => {
  it('flips briefing -> lab with no log entry and no fork implications (pure navigation)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);

    const before = store.getState();
    expect(before.screen).toBe('briefing');
    // Prefetch already happened during boot(); the initial spec stays free.
    expect(before.log).toHaveLength(1);
    expect(before.forks).toBe(0);

    store.getState().openData();

    const after = store.getState();
    expect(after.screen).toBe('lab');
    // Pure navigation: nothing else about the prefetched state changes.
    expect(after.log).toEqual(before.log);
    expect(after.forks).toBe(0);
    expect(after.result).toEqual(before.result);
  });

  it('throws when called from any screen reached after the briefing (lab/published/reveal/summary)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    expect(store.getState().screen).toBe('lab');
    expect(() => store.getState().openData()).toThrow();

    await store.getState().submit(); // boot's own prefetched result is p=0.02, valid
    expect(store.getState().screen).toBe('published');
    expect(() => store.getState().openData()).toThrow();

    await store.getState().makeCall('real');
    expect(store.getState().screen).toBe('reveal');
    expect(() => store.getState().openData()).toThrow();

    store.getState().finishReveal();
    expect(store.getState().screen).toBe('summary');
    expect(() => store.getState().openData()).toThrow();
  });

  it('throws when called from "call" (post-abandon)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();
    await store.getState().abandon();

    expect(store.getState().screen).toBe('call');
    expect(() => store.getState().openData()).toThrow();
  });
});

// --- changeSpec / debounce ------------------------------------------------

describe('changeSpec (debounce + §2.10 logging)', () => {
  it('throws when called after boot() but before openData() (still on briefing)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    // No openData() — screen is still 'briefing', despite boot's prefetch
    // having already populated a live result (the exact gap fix round 2
    // closes: lab actions must not work from briefing).

    expect(() => store.getState().changeSpec(specA)).toThrow();
    // No side effects: no debounce scheduled, no extra dispatch, spec unchanged.
    expect(client.runSpec).toHaveBeenCalledTimes(1); // only boot's own call
    expect(store.getState().spec).toEqual(DEFAULT_SPEC);
    expect(store.getState().screen).toBe('briefing');
  });

  it('updates the visible spec immediately, independent of the debounce', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    expect(store.getState().spec).toEqual(specA);
    // But nothing has been dispatched or logged yet.
    expect(client.runSpec).toHaveBeenCalledTimes(1);
    expect(store.getState().log).toHaveLength(1);
  });

  it('does not dispatch runSpec or log a fork until DEBOUNCE_MS has elapsed', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 50);

    expect(client.runSpec).toHaveBeenCalledTimes(1); // still just boot's call
    expect(store.getState().log).toHaveLength(1);
    expect(store.getState().pending).toBe(false);
  });

  it('dispatches exactly once and logs exactly one VIEW_SPEC entry once DEBOUNCE_MS elapses', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockResolvedValueOnce(makeResult({ spec: specA, p: 0.03 }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(client.runSpec).toHaveBeenCalledTimes(2);
    expect(client.runSpec).toHaveBeenLastCalledWith(specA);
    expect(store.getState().result).toEqual(makeResult({ spec: specA, p: 0.03 }));
    expect(store.getState().pending).toBe(false);

    const s = store.getState();
    expect(s.log).toHaveLength(2);
    expect(s.log[1]).toEqual({ t: 'VIEW_SPEC', spec: specA, seen: true, at: expect.any(Number) });
    expect(s.forks).toBe(1); // a result (boot's) had been seen for the previous spec
  });

  it('collapses three rapid changes within DEBOUNCE_MS into ONE runSpec call and ONE log entry, using the settled (last) spec', async () => {
    const specC: Spec = { ...DEFAULT_SPEC, exclusion: 'z2' };
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(100);
    store.getState().changeSpec(specB);
    await vi.advanceTimersByTimeAsync(100);
    store.getState().changeSpec(specC);
    await vi.advanceTimersByTimeAsync(100); // 300ms since the FIRST call, but only 100ms since the last

    // Not yet settled: the timer keeps resetting on every call.
    expect(client.runSpec).toHaveBeenCalledTimes(1);
    expect(store.getState().log).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100 + 1); // now >=300ms since the LAST call

    expect(client.runSpec).toHaveBeenCalledTimes(2);
    expect(client.runSpec).toHaveBeenLastCalledWith(specC);
    const s = store.getState();
    expect(s.spec).toEqual(specC);
    expect(s.log).toHaveLength(2);
    expect(s.log[1].t).toBe('VIEW_SPEC');
    expect(s.log[1]).toMatchObject({ spec: specC });
  });

  it('discards a stale runSpec response that resolves after a newer request has already settled (last-write-wins)', async () => {
    const d1 = deferred<PathResult>();
    const d2 = deferred<PathResult>();
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult()) // boot's initial call
      .mockImplementationOnce(() => d1.promise) // changeSpec(specA)'s call
      .mockImplementationOnce(() => d2.promise); // changeSpec(specB)'s call

    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().pending).toBe(true); // waiting on d1

    // A second settled change fires BEFORE d1 resolves — seen must be false,
    // since no result had rendered for specA by the time specB settles.
    store.getState().changeSpec(specB);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().pending).toBe(true); // now waiting on d2
    expect(store.getState().log.at(-1)).toEqual({ t: 'VIEW_SPEC', spec: specB, seen: false, at: expect.any(Number) });

    // The STALE response (specA's) resolves late — must be discarded.
    d1.resolve(makeResult({ spec: specA, p: 0.9 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().pending).toBe(true);
    expect(store.getState().result?.spec).not.toEqual(specA);

    // The CURRENT response (specB's) resolves — must be applied.
    d2.resolve(makeResult({ spec: specB, p: 0.01 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().pending).toBe(false);
    expect(store.getState().result).toEqual(makeResult({ spec: specB, p: 0.01 }));
  });

  it('surfaces a rejected runSpec into `error` and clears pending', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockRejectedValueOnce(new Error('boom'));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(store.getState().pending).toBe(false);
    expect(store.getState().error).toBe('boom');
  });
});

// --- resultLog (T30 — feeds dayComplete.ts's computeDecisiveTails) -------

describe('resultLog (§2.11 — every settled result actually displayed, feeding computeDecisiveTails)', () => {
  it('appends the OUTGOING spec (by its own result.spec, not the eagerly-updated control spec) once superseded, using the exact seenPrev check the VIEW_SPEC log already computes', async () => {
    const specOneTailed: Spec = { ...DEFAULT_SPEC, tails: 'one' };
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult()) // boot: DEFAULT_SPEC (two-tailed), p=0.02, valid
      .mockResolvedValueOnce(makeResult({ spec: specOneTailed, p: 0.01 }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    expect(store.getState().resultLog).toEqual([]); // nothing superseded yet

    store.getState().changeSpec(specOneTailed);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    // The boot-prefetched DEFAULT_SPEC result WAS being displayed (seenPrev),
    // so it is now durably recorded — this is exactly what lets a later
    // one-tailed publish look back and find its two-tailed sibling.
    expect(store.getState().resultLog).toEqual([{ key: specKey(DEFAULT_SPEC), p: 0.02, valid: true }]);
  });

  it('does not record anything for a spec whose result never rendered before the next settle (seenPrev=false)', async () => {
    const specA: Spec = { ...DEFAULT_SPEC, outcome: 1 };
    const specB: Spec = { ...DEFAULT_SPEC, subgroup: 'urban' };
    const d1 = deferred<PathResult>();
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult()) // boot
      .mockImplementationOnce(() => d1.promise) // changeSpec(specA) hangs forever
      .mockResolvedValueOnce(makeResult({ spec: specB, p: 0.04 }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().pending).toBe(true); // still waiting on d1
    // DEFAULT_SPEC's boot-prefetched result WAS seen before specA settled:
    expect(store.getState().resultLog).toEqual([{ key: specKey(DEFAULT_SPEC), p: 0.02, valid: true }]);

    // specB settles while specA is STILL pending — specA's own result never
    // rendered, so nothing new is appended for it.
    store.getState().changeSpec(specB);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(store.getState().resultLog).toEqual([{ key: specKey(DEFAULT_SPEC), p: 0.02, valid: true }]);
  });

  it('is reset to empty by a fresh boot() (additive-only within a day, but never across days)', async () => {
    const specA: Spec = { ...DEFAULT_SPEC, outcome: 1 };
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockResolvedValueOnce(makeResult({ spec: specA, p: 0.03 }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();
    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().resultLog.length).toBe(1);

    await store.getState().boot(client, EPOCH, BOOT_OPTS); // e.g. a fresh puzzle day
    expect(store.getState().resultLog).toEqual([]);
  });
});

// --- peekAndExtend -------------------------------------------------------

describe('peekAndExtend', () => {
  it('throws when called before boot', async () => {
    const store = createGameStore();
    await expect(store.getState().peekAndExtend()).rejects.toThrow('not booted');
  });

  it('throws when called after boot() but before openData() (still on briefing)', async () => {
    const client = makeFakeClient(); // default result: p=0.02, valid, not pending — would satisfy every other guard
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    // No openData() — screen is still 'briefing'.

    await expect(store.getState().peekAndExtend()).rejects.toThrow();
    expect(client.extend).not.toHaveBeenCalled();
    expect(store.getState().screen).toBe('briefing');
  });

  it('throws while a result is not yet visible (pending)', async () => {
    const client = makeFakeClient();
    // boot's own runSpec resolves normally; the NEXT call (from changeSpec
    // below) hangs forever, so `pending` stays true for the assertion.
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockImplementationOnce(() => new Promise(() => {}));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().pending).toBe(true);

    await expect(store.getState().peekAndExtend()).rejects.toThrow('no result visible to extend');
  });

  it('extends N, logs PEEK_AND_EXTEND (always a fork), and refreshes the result for the current spec', async () => {
    const client = makeFakeClient();
    (client.extend as Mock).mockResolvedValueOnce({ n: 250 } satisfies ExtendInfo);
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockResolvedValueOnce(makeResult({ n: 250, p: 0.03 }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    await store.getState().peekAndExtend();

    const s = store.getState();
    expect(s.n).toBe(250);
    expect(client.extend).toHaveBeenCalledTimes(1);
    expect(client.runSpec).toHaveBeenCalledTimes(2); // boot's + the post-extend refresh
    expect(s.result).toEqual(makeResult({ n: 250, p: 0.03 }));
    expect(s.log.at(-1)).toEqual({ t: 'PEEK_AND_EXTEND', newN: 250, at: expect.any(Number) });
    expect(s.forks).toBe(1); // peek always counts
    expect(s.pending).toBe(false);
  });

  it('rejects with "max N" once N has reached the top of the schedule, without calling client.extend again', async () => {
    const maxN = N_SCHEDULE[N_SCHEDULE.length - 1];
    const rest = N_SCHEDULE.slice(1); // schedule steps beyond the initial 200
    const client = makeFakeClient();
    for (const step of rest) {
      (client.extend as Mock).mockResolvedValueOnce({ n: step } satisfies ExtendInfo);
    }
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    for (let i = 0; i < rest.length; i++) {
      await store.getState().peekAndExtend();
    }
    expect(store.getState().n).toBe(maxN);
    expect(client.extend).toHaveBeenCalledTimes(rest.length);

    await expect(store.getState().peekAndExtend()).rejects.toThrow('max N');
    expect(client.extend).toHaveBeenCalledTimes(rest.length); // not called again
  });
});

// --- submit ----------------------------------------------------------------

describe('submit (§2.2 lab -> published)', () => {
  it('throws when called after boot() but before openData() (still on briefing)', async () => {
    // Uses the fixture's default result (p=0.02, valid=true) — exactly the
    // "concrete demonstration" from the re-review: without the screen guard,
    // this would satisfy submit()'s old guard and flip briefing straight to
    // published, skipping the lab entirely.
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    // No openData() — screen is still 'briefing'.

    await expect(store.getState().submit()).rejects.toThrow();
    expect(store.getState().screen).toBe('briefing');
    expect(store.getState().published).toBeNull();
  });

  it('publishes when the result is settled, valid, and significant', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockResolvedValueOnce(makeResult({ spec: specA, p: 0.01, valid: true }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();
    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    await store.getState().submit();

    const s = store.getState();
    expect(s.screen).toBe('published');
    expect(s.published).toEqual(specA);
    expect(s.log.at(-1)).toEqual({ t: 'SUBMIT', spec: specA, p: 0.01, at: expect.any(Number) });
  });

  it('rejects when p >= .05', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.06, valid: true }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    await expect(store.getState().submit()).rejects.toThrow();
    expect(store.getState().screen).toBe('lab');
    expect(store.getState().published).toBeNull();
  });

  it('rejects when the result is stale (pending)', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.01 })).mockImplementationOnce(() => new Promise(() => {}));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    store.getState().changeSpec(specA); // starts an in-flight (hanging) request
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().pending).toBe(true);

    await expect(store.getState().submit()).rejects.toThrow();
    expect(store.getState().screen).toBe('lab');
  });

  it('rejects when the result is not valid (n < 30 after exclusions)', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.01, valid: false }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    await expect(store.getState().submit()).rejects.toThrow();
    expect(store.getState().screen).toBe('lab');
  });
});

// --- abandon -----------------------------------------------------------

describe('abandon (§2.2 lab -> call)', () => {
  it('moves to call, clears published, and logs ABANDON, from anywhere in the lab', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    await store.getState().abandon();

    const s = store.getState();
    expect(s.screen).toBe('call');
    expect(s.published).toBeNull();
    expect(s.log.at(-1)).toEqual({ t: 'ABANDON', at: expect.any(Number) });
  });

  it('throws when not currently in the lab', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.01 }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();
    await store.getState().submit(); // now on 'published'

    await expect(store.getState().abandon()).rejects.toThrow();
    expect(store.getState().screen).toBe('published');
  });
});

// --- makeCall ------------------------------------------------------------

describe('makeCall (§2.2 published|call -> reveal)', () => {
  it('throws before the lab has been exited (neither published nor abandoned)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();

    await expect(store.getState().makeCall('real')).rejects.toThrow();
    expect(store.getState().screen).toBe('lab');
  });

  it('logs CALL, fetches the reveal with the published spec, and lands on reveal', async () => {
    const payload = makeRevealPayload({ stamp: 'REPLICATED' });
    const client = makeFakeClient();
    (client.reveal as Mock).mockResolvedValueOnce(payload);
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult({ p: 0.01 }));
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();
    await store.getState().submit();

    await store.getState().makeCall('real');

    const s = store.getState();
    expect(s.screen).toBe('reveal');
    expect(s.call).toBe('real');
    expect(s.reveal).toEqual(payload);
    expect(s.log.at(-1)).toEqual({ t: 'CALL', verdict: 'real', at: expect.any(Number) });
    expect(client.reveal).toHaveBeenCalledWith(DEFAULT_SPEC, [DEFAULT_SPEC]);
  });

  it('supports the abandon -> call -> reveal path (published is null when abandoned)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();
    await store.getState().abandon();

    await store.getState().makeCall('noise');

    const s = store.getState();
    expect(s.screen).toBe('reveal');
    expect(s.call).toBe('noise');
    expect(client.reveal).toHaveBeenCalledWith(null, [DEFAULT_SPEC]);
  });
});

// --- finishReveal --------------------------------------------------------

describe('finishReveal (§2.2 reveal -> summary)', () => {
  it('moves to summary', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    store.getState().openData();
    await store.getState().abandon();
    await store.getState().makeCall('real');

    store.getState().finishReveal();

    expect(store.getState().screen).toBe('summary');
  });
});

// --- full happy path (§2.2) ------------------------------------------------

describe('full happy path: briefing -> lab -> published -> reveal -> summary', () => {
  it('walks every screen in order with the expected side effects', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockResolvedValueOnce(makeResult({ spec: specA, p: 0.01 }));
    const store = createGameStore();

    expect(store.getState().screen).toBe('briefing');

    await store.getState().boot(client, EPOCH, BOOT_OPTS);
    // §2.3: boot() prefetches but the player must open the data themselves.
    expect(store.getState().screen).toBe('briefing');

    store.getState().openData();
    expect(store.getState().screen).toBe('lab');

    store.getState().changeSpec(specA);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().screen).toBe('lab');
    expect(store.getState().forks).toBe(1);

    await store.getState().submit();
    expect(store.getState().screen).toBe('published');

    await store.getState().makeCall('real');
    expect(store.getState().screen).toBe('reveal');

    store.getState().finishReveal();
    expect(store.getState().screen).toBe('summary');
  });
});
