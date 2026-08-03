// Master spec §5.3 (worker RPC, client side). engineClient.ts's contract, per
// the T11 brief and controller amendments:
//   (a) createEngineClient(makeWorker?) — a custom makeWorker is used
//       verbatim (never the real `new Worker(...)`) when supplied; the
//       default factory constructs `new Worker(new URL('../engine/worker.ts',
//       import.meta.url), {type:'module'})`;
//   (b) every call assigns a monotonically increasing request id and resolves
//       the matching promise by id when a Res with that id arrives;
//   (c) an {ok:false} Res rejects with an Error carrying its `error` string;
//   (d) a request that gets no response within 10s rejects with a descriptive
//       timeout Error, and cleans up its own pending-map entry;
//   (e) a Res whose id was never requested (or was already settled) is
//       dropped silently — no throw, no effect on other in-flight requests;
//   (f) onCrash(cb) fires on the worker's 'error' event; every still-pending
//       request is rejected then too (rather than each waiting out its own
//       10s timeout for a worker that is already gone).
//
// Tested throughout with a scripted fake Worker (a plain object satisfying
// just the surface engineClient.ts actually calls: postMessage/
// addEventListener), per the brief's Vitest strategy — the real-Worker path
// is covered later by E2E (see task-T11-report.md).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEngineClient } from '../../src/game/engineClient';
import type { InitInfo, Req, Res } from '../../src/engine/protocol';
import type { Spec } from '../../src/engine/types';

const SAMPLE_SPEC: Spec = {
  outcome: 2,
  subgroup: 'exp_high',
  covariates: { income: true, risk: false },
  exclusion: 'z3',
  transform: 'raw',
  tails: 'two',
};

type Listener = (ev: { data?: Res }) => void;

/** A scripted fake Worker: just enough surface for engineClient.ts to talk
 * to (postMessage out, addEventListener('message'|'error') in), fully under
 * the test's control — `respond`/`crash` synchronously invoke whatever
 * engineClient.ts registered, exactly like a real worker's event dispatch
 * would (Worker is an EventTarget; a real message/error event is
 * asynchronous, but nothing in engineClient.ts depends on that asynchrony
 * itself, only on eventually receiving the event). */
function makeFakeWorker() {
  const messageListeners: Listener[] = [];
  const errorListeners: Listener[] = [];
  const posted: Req[] = [];

  const fake = {
    postMessage: vi.fn((msg: Req) => {
      posted.push(msg);
    }),
    addEventListener: vi.fn((type: string, cb: Listener) => {
      if (type === 'message') messageListeners.push(cb);
      else if (type === 'error') errorListeners.push(cb);
    }),
    removeEventListener: vi.fn(),
    terminate: vi.fn(),
  };

  return {
    worker: fake as unknown as Worker,
    posted,
    respond(res: Res) {
      for (const cb of messageListeners) cb({ data: res });
    },
    crash() {
      for (const cb of errorListeners) cb({});
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createEngineClient — request/response routing', () => {
  it('init sends {op:"init", iso, scenarioCount, practiceSeed} and resolves with the matching Res.data', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const promise = client.init('2026-09-01', 20, 7);
    expect(fake.posted).toHaveLength(1);
    expect(fake.posted[0]).toMatchObject({ op: 'init', iso: '2026-09-01', scenarioCount: 20, practiceSeed: 7 });

    const info: InitInfo = { scenarioIndex: 3, n: 200 };
    fake.respond({ id: fake.posted[0].id, ok: true, data: info });

    await expect(promise).resolves.toEqual(info);
  });

  it('runSpec/extend/reveal each resolve with their own Res.data', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const runSpecPromise = client.runSpec(SAMPLE_SPEC);
    const pathResult = {
      spec: SAMPLE_SPEC,
      n: 200,
      beta: 0.1,
      se: 0.05,
      t: 2,
      p: 0.04,
      ci: [0.01, 0.19] as [number, number],
      excludedCount: 0,
      valid: true,
    };
    fake.respond({ id: fake.posted[0].id, ok: true, data: pathResult });
    await expect(runSpecPromise).resolves.toEqual(pathResult);

    const extendPromise = client.extend();
    fake.respond({ id: fake.posted[1].id, ok: true, data: { n: 250 } });
    await expect(extendPromise).resolves.toEqual({ n: 250 });

    const revealPromise = client.reveal(null, []);
    const revealPayload = {
      totalPaths: 1792,
      sigPaths: 87,
      sigFraction: 0.0486,
      playerExplored: 0,
      pHitAtK: 0.1,
      curve: [],
      stamp: 'NULL_REPORTED' as const,
      peeks: 0,
      dayType: 'null' as const,
      trueOutcome: null,
      trueBeta: 0,
      hetero: null,
    };
    fake.respond({ id: fake.posted[2].id, ok: true, data: revealPayload });
    await expect(revealPromise).resolves.toEqual(revealPayload);
  });

  it('resolution is routed by id — responses arriving out of request order still reach the right caller', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const first = client.runSpec(SAMPLE_SPEC);
    const second = client.extend();
    const third = client.runSpec(SAMPLE_SPEC);
    expect(fake.posted.map((r) => r.id)).toEqual([1, 2, 3]);

    // Respond out of order: third, then first, then second.
    fake.respond({ id: 3, ok: true, data: { spec: SAMPLE_SPEC, n: 400, beta: 3, se: 1, t: 3, p: 0.01, ci: [1, 5], excludedCount: 0, valid: true } });
    fake.respond({ id: 1, ok: true, data: { spec: SAMPLE_SPEC, n: 200, beta: 1, se: 1, t: 1, p: 0.3, ci: [-1, 3], excludedCount: 0, valid: true } });
    fake.respond({ id: 2, ok: true, data: { n: 250 } });

    await expect(first).resolves.toMatchObject({ beta: 1 });
    await expect(second).resolves.toEqual({ n: 250 });
    await expect(third).resolves.toMatchObject({ beta: 3 });
  });

  it('an {ok:false} Res rejects with an Error carrying the error string', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const promise = client.extend();
    fake.respond({ id: fake.posted[0].id, ok: false, error: 'max N' });

    await expect(promise).rejects.toThrow('max N');
  });
});

describe('createEngineClient — request ids', () => {
  it('are monotonically increasing across calls, never reused', () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    void client.init('2026-09-01', 20);
    void client.extend();
    void client.runSpec(SAMPLE_SPEC);
    void client.reveal(null, []);

    const ids = fake.posted.map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });
});

describe('createEngineClient — unknown/late responses', () => {
  it('a Res with an id that was never requested is dropped silently (no throw)', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const promise = client.extend();
    expect(() => fake.respond({ id: 9999, ok: true, data: { n: 200 } })).not.toThrow();

    // The real request is still perfectly servable afterward.
    fake.respond({ id: fake.posted[0].id, ok: true, data: { n: 250 } });
    await expect(promise).resolves.toEqual({ n: 250 });
  });

  it('a late response for an id that already timed out is dropped silently and does not affect other requests', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const timedOut = client.extend();
    const timedOutId = fake.posted[0].id;
    // Attached immediately (before advancing timers) so Node never sees this
    // rejection as briefly "unhandled" -- purely to keep the test run's
    // output clean; functionally equivalent to `await expect(...).rejects`.
    const timedOutSettled = timedOut.catch((e: Error) => e);

    // Let ONLY this first request time out before the second one even
    // exists, so the second request's own 10s window starts fresh afterward
    // (otherwise advancing 10s would time out both, proving nothing about
    // cross-request isolation).
    await vi.advanceTimersByTimeAsync(10_000);
    const timeoutErr = await timedOutSettled;
    expect(timeoutErr).toBeInstanceOf(Error);
    expect((timeoutErr as Error).message).toMatch(/timed out/i);

    const stillPending = client.runSpec(SAMPLE_SPEC);

    // A very late response for the already-timed-out id must not throw and
    // must not resolve/reject the OTHER, still-pending request.
    expect(() => fake.respond({ id: timedOutId, ok: true, data: { n: 400 } })).not.toThrow();

    fake.respond({ id: fake.posted[1].id, ok: true, data: { spec: SAMPLE_SPEC, n: 200, beta: 0, se: 1, t: 0, p: 1, ci: [-1, 1], excludedCount: 0, valid: true } });
    await expect(stillPending).resolves.toMatchObject({ beta: 0 });
  });
});

describe('createEngineClient — timeout', () => {
  it('rejects with a descriptive Error after 10s of no response', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const promise = client.runSpec(SAMPLE_SPEC);
    // Prevent an unhandled-rejection warning while we assert timing below.
    const settled = promise.catch((e: Error) => e);

    await vi.advanceTimersByTimeAsync(9_999);
    const raceSentinel = Symbol('pending');
    const notYet = await Promise.race([settled, Promise.resolve(raceSentinel)]);
    expect(notYet).toBe(raceSentinel); // still pending just under 10s

    await vi.advanceTimersByTimeAsync(1);
    const err = await settled;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/timed out/i);
    expect((err as Error).message).toContain('runSpec');
  });
});

describe('createEngineClient — onCrash', () => {
  it('fires registered callbacks on the worker error event', () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);
    const cb = vi.fn();
    client.onCrash(cb);

    fake.crash();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('supports multiple registered callbacks, all firing', () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    client.onCrash(cb1);
    client.onCrash(cb2);

    fake.crash();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('rejects every still-pending request when the worker crashes, rather than waiting out each 10s timeout', async () => {
    const fake = makeFakeWorker();
    const client = createEngineClient(() => fake.worker);

    const a = client.extend();
    const b = client.runSpec(SAMPLE_SPEC);

    fake.crash();

    await expect(a).rejects.toThrow();
    await expect(b).rejects.toThrow();
  });
});

describe('createEngineClient — default Worker factory', () => {
  it('with no makeWorker argument, constructs a module Worker pointed at src/engine/worker.ts', () => {
    // `new Worker(...)` requires an actually-constructible function (an
    // arrow function can never be called with `new`), so this has to be a
    // `function`, not `vi.fn(() => ...)` -- the two params are required by
    // the constructor signature (and give `.mock.calls[0]` its type below)
    // but the fake body itself doesn't need to read them.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tsc's own noUnusedParameters already exempts leading-underscore names; this project's eslint rule doesn't share that convention.
    const ctorSpy = vi.fn<(url: URL, opts?: WorkerOptions) => Worker>(function fakeWorkerCtor(_url, _opts) {
      return { postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), terminate: vi.fn() } as unknown as Worker;
    });
    vi.stubGlobal('Worker', ctorSpy);
    try {
      createEngineClient();
      expect(ctorSpy).toHaveBeenCalledTimes(1);
      const [urlArg, optsArg] = ctorSpy.mock.calls[0];
      expect(String(urlArg)).toContain('/src/engine/worker.ts');
      expect(optsArg).toEqual({ type: 'module' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
