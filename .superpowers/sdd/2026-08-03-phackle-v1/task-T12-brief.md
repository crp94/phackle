### Task T12: Store + state machine + fork logging

**Files:** Create `src/game/store.ts`, `src/game/forkLog.ts`; Test `tests/game/store.test.ts`, `tests/game/forkLog.test.ts`
**Depends:** T1 only (protocol types incl. EngineClient exist since T1; inject a fake EngineClient in tests — never a real worker). **Master spec:** §2.2, §2.10. Store computes puzzleNumber via `src/game/daily.ts`.

**Interfaces (produces):**
```ts
// forkLog.ts (pure)
export type ForkKind = 'subgroup' | 'exclusion' | 'tails' | 'spec' | 'peek';
export function classifyChange(prev: Spec, next: Spec): ForkKind;   // priority: subgroup > exclusion > tails > spec (🎯🔪🌗🍴)
export function countForks(log: PlayerAction[]): number;            // §2.10: VIEW_SPEC counts iff a result was seen for the
// previous spec (log carries seenResult flag on VIEW_SPEC — extend PlayerAction VIEW_SPEC with { seen: boolean });
// initial spec free; PEEK_AND_EXTEND always counts.
export function distinctExplored(log: PlayerAction[]): Spec[];      // by specKey, order of first view
// store.ts — Zustand vanilla + react hook. State:
export type Screen = 'briefing' | 'lab' | 'published' | 'call' | 'reveal' | 'summary';
export interface GameStore {
  screen: Screen; mode: 'hack' | 'prereg'; practice: boolean;
  puzzleNumber: number; scenarioIndex: number;
  spec: Spec; result: PathResult | null; pending: boolean; n: WindowN;
  log: PlayerAction[]; forks: number; published: Spec | null; call: 'real' | 'noise' | null;
  reveal: RevealPayload | null; error: string | null;
  // actions:
  boot(client: EngineClient, iso: string, opts: { practice: boolean; mode: 'hack' | 'prereg' }): Promise<void>;
  changeSpec(next: Spec): void;        // debounced DEBOUNCE_MS then runSpec; logs VIEW_SPEC{seen} per §2.10
  peekAndExtend(): Promise<void>;      // guarded: only while result visible; logs PEEK_AND_EXTEND
  submit(): Promise<void>;             // guard result.p < .05 && result.valid → 'published'
  abandon(): Promise<void>;            // from lab anytime → 'call'
  makeCall(v: 'real' | 'noise'): Promise<void>;  // logs CALL, fetches reveal → 'reveal'
  finishReveal(): void;                // → 'summary'
}
export const DEFAULT_SPEC: Spec = { outcome: 0, subgroup: 'all', covariates: { income: false, risk: false },
  exclusion: 'none', transform: 'raw', tails: 'two' };
```

**Steps:**
- [ ] **RED** forkLog: initial spec free (log [VIEW seen] → 0 forks); change-after-seen counts 1; change-before-render (seen:false on previous) counts 0; PEEK always counts; classifyChange priority when multiple knobs differ; distinctExplored dedupes revisits; k ≤ forks+1 property over 200 random logs.
- [ ] **RED** store (fake client + fake timers): full happy path transitions §2.2; submit rejected when p=.06 (guard) and when result stale (pending); abandon → call → reveal path; debounce: three changeSpec within 250 ms → one runSpec call + one log entry; makeCall before published/abandoned throws; peekAndExtend at N=400 surfaces error copy key; boot with practice sets practice flag.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: game state machine + exact §2.10 fork accounting`.

---

