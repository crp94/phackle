### Task T11: Web Worker RPC

**Files:** Create `src/engine/worker.ts`, `src/engine/protocol.ts`, `src/game/engineClient.ts`; Test `tests/engine/protocol.test.ts`
**Depends:** T9, T10. **Master spec:** §5.3, §5.4 (merged `enumerate` into `reveal` — flagged simplification, approved in delta-spec review: UI never needs the curve pre-reveal).

**Interfaces (produces):**
```ts
// protocol.ts — these TYPES were created in T1; T11 implements them:
export type Req =
  | { id: number; op: 'init'; iso: string; scenarioCount: number; practiceSeed?: number }
  | { id: number; op: 'runSpec'; spec: Spec }
  | { id: number; op: 'extend' }
  | { id: number; op: 'reveal'; published: Spec | null; explored: Spec[] };
export interface InitInfo { scenarioIndex: number; n: WindowN }   // NEVER dayType; puzzleNumber is computed game-side (EPOCH is game knowledge)
export interface ExtendInfo { n: WindowN }
export interface RevealPayload extends RevealMetrics { dayType: DayType; trueOutcome: Outcome | null;
  trueBeta: number; hetero: { subgroup: Spec['subgroup']; multiplier: number } | null }
export type Res = { id: number; ok: true; data: InitInfo | PathResult | ExtendInfo | RevealPayload }
                | { id: number; ok: false; error: string };
export function handleRequest(state: WorkerState, req: Req): Res;    // pure — unit-testable without a real Worker
// worker.ts: onmessage → handleRequest against module-held state; peeks counted worker-side on 'extend'.
// engineClient.ts — NOTE: the EngineClient INTERFACE itself lives in src/engine/protocol.ts since T1 (types-only);
// engineClient.ts implements it and re-exports the type for convenience.
export function createEngineClient(makeWorker?: () => Worker): EngineClient;  // default: new Worker(new URL(...), {type:'module'})
export interface EngineClient {
  init(iso: string, scenarioCount: number, practiceSeed?: number): Promise<InitInfo>;
  runSpec(spec: Spec): Promise<PathResult>; extend(): Promise<ExtendInfo>;
  reveal(published: Spec | null, explored: Spec[]): Promise<RevealPayload>;
  onCrash(cb: () => void): void;             // worker 'error' event → errors.workerCrash screen
}
```

**Steps:**
- [ ] **RED**: protocol.test.ts drives `handleRequest` directly: init → runSpec returns PathResult matching direct `runSpec()` call; extend advances 200→250…→400 then errors `'max N'`; **spoiler guard**: `JSON.stringify` of every pre-reveal Res contains neither `dayType` nor `trueOutcome` (also greps for `"effect"`/`"null"` literals); reveal includes peeks === number of extends; unknown op → ok:false.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: worker RPC — engine owns data, day type sealed until reveal`.

---

