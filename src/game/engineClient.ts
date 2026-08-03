// Master spec §5.3 — the main-thread side of the worker RPC boundary. Talks
// to the worker exclusively over postMessage/onmessage; the only thing it
// imports from src/engine/** is protocol.ts's TYPES (see the `import type`
// below) — never the engine's actual runtime logic, which stays worker-side
// so the day's sealed truth (§5.4) never has a code path onto the main
// thread before the reveal.
import type { EngineClient, ExtendInfo, InitInfo, Req, Res, RevealPayload } from '../engine/protocol';
import type { PathResult, Spec } from '../engine/types';

export type { EngineClient } from '../engine/protocol';

/** Brief-pinned: a request with no matching response within this window
 * rejects with a descriptive timeout Error rather than hanging forever
 * (e.g. a worker wedged mid-computation, or a message lost to a bug). */
const TIMEOUT_MS = 10_000;

interface PendingEntry {
  resolve: (data: InitInfo | PathResult | ExtendInfo | RevealPayload) => void;
  reject: (err: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

/**
 * Constructs the main-thread RPC client (§5.3). `makeWorker` is a test seam:
 * omitted, it builds the real module worker; a test passes a scripted fake
 * satisfying just the surface this file calls (postMessage,
 * addEventListener('message'|'error')) — see tests/game/engineClient.test.ts.
 *
 * Return type is `EngineClient & {pendingCount}` rather than the brief's
 * plain `EngineClient` — review finding (post-approval fix round): a
 * black-box test cannot otherwise distinguish "the timeout handler deleted
 * its pending-map entry" from "it didn't, but a stale resolve/reject on an
 * already-settled promise is a silent no-op anyway" (both look identical
 * from outside). `pendingCount` is a one-line, read-only size accessor, not
 * the map itself; the intersection keeps every existing `EngineClient`-typed
 * consumer (src/game/store.ts and its own tests) unaffected, since a value
 * with an extra method still structurally satisfies the narrower type.
 */
export function createEngineClient(makeWorker?: () => Worker): EngineClient & { pendingCount(): number } {
  const worker = (makeWorker ?? (() => new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' })))();

  let nextId = 1;
  const pending = new Map<number, PendingEntry>();
  const crashCallbacks: (() => void)[] = [];

  worker.addEventListener('message', (ev: MessageEvent<Res>) => {
    const res = ev.data;
    const entry = pending.get(res.id);
    if (!entry) return; // late (already timed out) or unknown id — dropped silently, per brief
    pending.delete(res.id);
    clearTimeout(entry.timeoutHandle);
    if (res.ok) entry.resolve(res.data);
    else entry.reject(new Error(res.error));
  });

  worker.addEventListener('error', () => {
    // The worker thread itself crashed: nothing still in flight will ever
    // get a real response, so reject everything now rather than making each
    // caller wait out its own 10s timeout, then tell the registered
    // callback(s) — the game routes this to errors.workerCrash.
    for (const entry of pending.values()) {
      clearTimeout(entry.timeoutHandle);
      entry.reject(new Error('engine worker crashed'));
    }
    pending.clear();
    for (const cb of crashCallbacks) cb();
  });

  function dispatch<T extends InitInfo | PathResult | ExtendInfo | RevealPayload>(req: Req): Promise<T> {
    const { id } = req;
    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Engine request timed out after ${TIMEOUT_MS}ms (op: ${req.op}, id: ${id})`));
      }, TIMEOUT_MS);
      pending.set(id, { resolve: resolve as PendingEntry['resolve'], reject, timeoutHandle });
      worker.postMessage(req);
    });
  }

  return {
    init(iso: string, scenarioCount: number, practiceSeed?: number) {
      return dispatch<InitInfo>({ id: nextId++, op: 'init', iso, scenarioCount, practiceSeed });
    },
    runSpec(spec: Spec) {
      return dispatch<PathResult>({ id: nextId++, op: 'runSpec', spec });
    },
    extend() {
      return dispatch<ExtendInfo>({ id: nextId++, op: 'extend' });
    },
    reveal(published: Spec | null, explored: Spec[]) {
      return dispatch<RevealPayload>({ id: nextId++, op: 'reveal', published, explored });
    },
    onCrash(cb: () => void) {
      crashCallbacks.push(cb);
    },
    /** test-only: number of in-flight requests (the pending map's size). Not
     * part of the brief's pinned EngineClient interface — see this
     * function's own doc comment for why it exists and why it's safe to add. */
    pendingCount() {
      return pending.size;
    },
  };
}
