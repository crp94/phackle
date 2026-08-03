// Master spec §5.3 — the actual Web Worker entry point. Deliberately thin:
// all dispatch logic lives in protocol.ts's handleRequest (a plain function,
// unit-tested directly in tests/engine/protocol.test.ts); this file just owns
// the one module-level WorkerState instance and wires the worker's
// message-in/message-out plumbing to it. Untestable by unit test (it needs a
// real Worker global scope) -- covered later by E2E, per the brief's Vitest
// strategy (see task-T11-report.md's coverage-division note).
//
// tsconfig.json's single `lib` array is `["ES2022", "DOM", "DOM.Iterable"]`
// (no "WebWorker") -- the project also has a React UI that needs the DOM
// lib, and TypeScript's DOM and WebWorker lib.d.ts files declare two
// mutually-incompatible global scopes (Window vs DedicatedWorkerGlobalScope)
// that cannot both be in one program. Rather than fork a second tsconfig for
// this one file, `self` is asserted locally to the narrow worker-shaped
// surface this file actually uses -- postMessage(message) and an
// onmessage(ev) assignment -- instead of the Window shape "DOM" would
// otherwise give it (whose postMessage requires a targetOrigin, which a
// worker's does not take).
import { createInitialWorkerState, handleRequest } from './protocol';
import type { Req, Res } from './protocol';

const state = createInitialWorkerState();

const workerSelf = self as unknown as {
  onmessage: ((ev: MessageEvent<Req>) => void) | null;
  postMessage: (message: Res) => void;
};

workerSelf.onmessage = (ev) => {
  const res = handleRequest(state, ev.data);
  workerSelf.postMessage(res);
};
