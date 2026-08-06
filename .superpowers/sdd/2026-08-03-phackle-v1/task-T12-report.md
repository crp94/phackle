# Task T12 report — game state machine + §2.10 fork accounting

**Branch:** `worktree-agent-a6bc55665d937744c` (worktree `.claude/worktrees/agent-a6bc55665d937744c`, forked at `1137c75` per STEP 0)
**Final commit:** `51309ef8ef7c4bbc20c14bf41a6ea1789ca70f7b`
**Status:** DONE

## STEP 0 (infra)

1. `git reset --hard 1137c75` — confirmed `src/engine/protocol.ts` exists and exports `EngineClient` (read in full before starting).
2. `pwd` confirmed worktree: `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6bc55665d937744c`. All Write/Edit calls in this task used that absolute prefix.
3. `PATH="/usr/bin:$PATH" npm ci` (clean, 250 packages), then `PATH="/usr/bin:$PATH" npm i zustand@^5` → resolved `zustand@5.0.14`, landed in `dependencies`. Confirmed via `node_modules/zustand/package.json` and the vanilla/react `.d.ts` files (curried `createStore<T>()(initializer)`, `useStore(api, selector)`) before writing any store code.

## Implemented

- **`src/game/forkLog.ts`** — pure §2.10 functions, no engine/store side effects:
  - `classifyChange(prev, next): ForkKind` — priority `subgroup > exclusion > tails > spec`, falls through to `'spec'` if nothing differs.
  - `countForks(log): number` — a `VIEW_SPEC` entry counts iff its own `seen` field is `true`, **except** the very first `VIEW_SPEC` entry in the whole log (always free, regardless of its `seen` value); `PEEK_AND_EXTEND` always counts; `SUBMIT`/`ABANDON`/`CALL` never contribute.
  - `distinctExplored(log): Spec[]` — distinct specs from `VIEW_SPEC` entries only, in order of first view, deduped via a local tuple-based `specKey` (not raw `JSON.stringify(spec)`, to stay immune to object key-insertion-order). Comment flags this as a stand-in for T8's shared `specKey` once merged.

- **`src/game/store.ts`** — Zustand **vanilla** store (`createStore` from `zustand/vanilla`) implementing the full §2.2 machine, plus a thin `useGameStore` React hook (`zustand/react`'s `useStore`) bound to a module-level singleton for app code. `createGameStore()` is the framework-free factory tests use directly.
  - State: exactly the `GameStore` shape pinned in the brief (`screen, mode, practice, puzzleNumber, scenarioIndex, spec, result, pending, n, log, forks, published, call, reveal, error`).
  - `boot(client, iso, opts: {practice, mode, scenarioCount})` — resets to a clean initial state (mode/practice from opts), registers `client.onCrash(() => set({error:'engine crashed'}))`, calls `client.init(iso, scenarioCount, opts.practice ? practiceSeed() : undefined)` (seed from `src/game/daily.ts`, only generated for practice mode), sets `puzzleNumber` via `daily.ts`'s `puzzleNumber(iso)`, then runs `client.runSpec(DEFAULT_SPEC)` once and lands on `'lab'` with that result already showing. The initial `VIEW_SPEC` log entry is written with `seen:false` (vacuous — no previous spec) and is exempted from `forks` regardless (per `countForks`'s "first entry free" rule). Engine failures during boot are caught into `error` (boot resolves, never rejects); guard-violation failures elsewhere (see below) reject/throw instead — these are deliberately different channels (engine/runtime failure vs. programmer/UI precondition violation).
  - `changeSpec(next)` — updates `spec` **immediately** (so bound UI controls track live edits), then (re)arms a `setTimeout(DEBOUNCE_MS)`; only when it fires does it log **one** `VIEW_SPEC` entry for the settled spec and dispatch `runSpec`. `seen` on that entry is computed as `!pending && result !== null`, read at the instant just before the new request is marked pending — i.e., "was a result visible for the spec being replaced, right now." A shared `requestSeq` counter (closure-scoped per store instance) is bumped on every dispatch; a response is applied only if its captured id still matches the counter when it resolves — anything superseded is silently discarded (stale-response / last-write-wins).
  - `peekAndExtend()` — guarded on `!pending && result` (throws `'no result visible to extend'`) and on `n !== MAX_N` (`N_SCHEDULE.at(-1)` = 400; throws exactly `'max N'` per the controller's clarifying pin — no invented copy key). On success: `client.extend()` → log `PEEK_AND_EXTEND{newN}` (always a fork) → `client.runSpec(currentSpec)` to refresh `result` at the new N. Shares the same `requestSeq` staleness mechanism.
  - `submit()` — guard `result.valid && result.p < .05 && !pending`; throws otherwise. On success: logs `SUBMIT{spec,p}`, sets `published = spec`, `screen = 'published'`; invalidates any in-flight request first.
  - `abandon()` — guard `screen === 'lab'`; throws otherwise. On success: logs `ABANDON`, `published = null`, `screen = 'call'`.
  - `makeCall(v)` — guard `screen === 'published' || screen === 'call'` (i.e., the lab has been exited one way or the other); throws `'cannot call before publishing or abandoning'` otherwise. Logs `CALL{verdict}`, then `client.reveal(published, distinctExplored(log))` → `reveal = payload`, `screen = 'reveal'`.
  - `finishReveal()` — unconditional `screen = 'summary'` (sync, matches its `void` signature).
  - Every log mutation recomputes `forks = countForks(log)` inline via `forkLog.ts`, so the fork trail is always live/consistent, not just finalized at reveal time.

- **`src/engine/types.ts`** — the one authorized change: `VIEW_SPEC` variant gains `seen: boolean` with the exact required comment:
  ```ts
  | { t: 'VIEW_SPEC'; spec: Spec; seen: boolean; at: number } // seen: result was displayed for the previous spec (fork rule §2.10)
  ```

## Design decisions on underdetermined points (documented per "ask before implementing")

The brief's `GameStore` interface lists exactly 7 actions (`boot/changeSpec/peekAndExtend/submit/abandon/makeCall/finishReveal`) with no dedicated "leave briefing" action, yet `Screen` includes `'briefing'` and `'lab'` as distinct values. Rather than inventing an 8th action not in the pinned interface, I resolved this as: **`boot()` itself is the briefing→lab transition** — `screen` starts at `'briefing'` (the store's initial value, before `boot()` is ever called) and `boot()` drives all the way through engine init + the first `runSpec(DEFAULT_SPEC)` to land on `'lab'` with a result already visible. This reads consistently with §2.4 ("the player configures a specification and sees live results for it" — implying a result is already showing on arrival) and with the initial-spec-is-free rule needing *some* first `VIEW_SPEC` log entry to anchor `distinctExplored`/`countForks`. Similarly, `'published'` and `'call'` are treated as two alternate ways of reaching the same "pre-call" moment (submit → published; abandon → call, skipping published), and `makeCall` accepts either — matching the controller's exact phrasing "makeCall before published/abandoned throws" (i.e., the guard is "has the lab been exited," not "is screen specifically `'call'`").

Property-test generator (`forkLog.test.ts`): a literal `distinctExplored(log).length ≤ countForks(log)+1` is **not** a tautology over arbitrary `PlayerAction[]` arrays — it's easy to construct a counterexample (e.g. `[VIEW(A,false), VIEW(B,false), VIEW(C,false)]` gives k=3, forks=0). The invariant holds under the *causal* constraint the real store enforces in ordinary play: a genuinely new distinct spec is only reached once a result has rendered for whatever came before it (revisits of already-seen specs are unconstrained and may freely have `seen: true|false`, since they never add to `distinctExplored`). The seeded-LCG generator encodes exactly this — "introduce a new distinct spec" is only ever emitted with `seen:true`; revisits get a random `seen`. This is flagged here explicitly as a modeling assumption, not a general mathematical law over unconstrained logs.

## TDD evidence

### RED → GREEN: `forkLog.ts`

RED (module did not exist yet):
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/forkLog.test.ts
 FAIL  tests/game/forkLog.test.ts [ tests/game/forkLog.test.ts ]
Error: Cannot find module '../../src/game/forkLog' imported from .../tests/game/forkLog.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN (after implementing `src/game/forkLog.ts` and the `types.ts` `seen` field):
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/forkLog.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

19 tests: initial-spec-free (both `seen` values), change-after-seen counts 1, change-before-render counts 0, PEEK always counts, mixed-sequence accumulation, SUBMIT/ABANDON/CALL ignored, empty log, `classifyChange` single-knob for each of the 4 kinds + 3 priority-ordering tests (subgroup-over-all, exclusion-over-tails/spec, tails-over-spec), `distinctExplored` ordering/dedup/structural-equality/non-VIEW_SPEC-ignoring/empty, and the 200-trial seeded-LCG property test.

### RED → GREEN: `store.ts`

RED — implementation temporarily moved aside (`mv src/game/store.ts <scratchpad>/store.ts.bak`) to get a genuine failure against the full test file (not just a stub):
```
$ mv src/game/store.ts <scratchpad>/store.ts.bak
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/store.test.ts
 FAIL  tests/game/store.test.ts [ tests/game/store.test.ts ]
Error: Cannot find module '../../src/game/store' imported from .../tests/game/store.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN — implementation restored:
```
$ mv <scratchpad>/store.ts.bak src/game/store.ts
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/store.test.ts
 Test Files  1 passed (1)
      Tests  26 passed (26)
```

26 tests across: `boot` (happy path incl. exact log/forks/init-args assertions, practice flag + generated seed, prereg mode, onCrash wiring, graceful init-failure capture into `error` without advancing past briefing), `changeSpec`/debounce (immediate spec update, no dispatch before `DEBOUNCE_MS`, exactly-one dispatch+log-entry once it elapses, three-rapid-changes-collapse-to-one using the last settled spec, **stale-response discard** with manually-controlled deferred promises resolving out of order, rejected-runSpec → `error`), `peekAndExtend` (not-booted guard, pending guard, happy path incl. fork count and refreshed result, exhausting `N_SCHEDULE` then rejecting exactly `'max N'` without an extra `client.extend` call), `submit` (happy path, p≥.05 rejection, pending/stale rejection, invalid-result rejection), `abandon` (happy path, throws outside lab), `makeCall` (throws before published/abandoned, published→reveal with exact `reveal(spec, explored)` args, abandon→call→reveal with `reveal(null, explored)`), `finishReveal`, and one end-to-end "full happy path" walking all 6 screens in order.

### Full gate (after every GREEN, and again after a final test cleanup)

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  10 passed (10)
      Tests  183 passed (183)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(no output — clean)

$ PATH="/usr/bin:$PATH" npx eslint .
(no output — clean)

$ PATH="/usr/bin:$PATH" npx vite build
✓ 16 modules transformed.
dist/assets/index-C2nDUzGv.js   190.41 kB │ gzip: 59.97 kB
✓ built in 87ms
```

All 183 repo-wide tests pass (T2/T3/T4's suites untouched and still green), typecheck clean, lint clean, build succeeds.

## Files changed

- `src/game/forkLog.ts` (new, 82 lines) — pure §2.10 functions.
- `src/game/store.ts` (new, 250 lines) — Zustand vanilla store + `useGameStore` hook.
- `src/engine/types.ts` (1 line changed) — `VIEW_SPEC` gains `seen: boolean` + required comment.
- `tests/game/forkLog.test.ts` (new, 206 lines).
- `tests/game/store.test.ts` (new, 516 lines).
- `package.json` / `package-lock.json` — added `zustand@^5.0.14` to `dependencies` only.

## Self-review

- **Every §2.2 transition has a test, including rejection/guard cases**: briefing→lab (boot, + graceful init-failure variant that stays on briefing), lab→published (submit happy path + 3 distinct rejection causes: p≥.05, pending/stale, invalid), lab→call (abandon happy path + throws-outside-lab), published→reveal and call→reveal (both makeCall paths, with distinct `reveal(published, ...)` args asserted), makeCall guard failure (throws while still in lab), reveal→summary (finishReveal). Confirmed via the "full happy path" test walking all 6 screens in sequence.
- **Debounce single-log proof**: explicit test asserts `client.runSpec` called exactly twice (boot's + one settled call) and `log` has exactly 2 entries after three `changeSpec` calls spaced 100ms apart (each resetting the 300ms timer), settling on the *last* spec.
- **Stale-response discard proof**: explicit test using hand-rolled deferred promises resolves the *older* (superseded) `runSpec` response *after* a newer one has been dispatched, and asserts the older response's payload is never applied (`pending` stays `true`, `result.spec` never becomes the stale spec) while the newer one, once resolved, is applied correctly.
- **§2.10 exactness**: `countForks`/`distinctExplored` are pure and unit-tested independently of the store (19 tests), including the exact "initial free / change-after-seen=1 / change-before-render=0 / peek-always-counts" cases named in the brief, plus the 200-trial seeded property test (`k ≤ forks+1`).
- **Scope discipline**: `git diff --stat` / `git status --porcelain` confirmed only the 7 authorized paths changed; `src/engine/types.ts`'s diff is exactly the one pinned line; `package.json`'s diff is exactly the one `zustand` line. No import of `src/ui` or `src/content` anywhere in `src/game/**` (manually verified — no such ESLint rule exists for `src/game/**`, so this was a self-check, not a mechanical gate).
- **`client` is closure-held, not store state**: matches the brief's exact signatures (only `boot` takes a client) without polluting `GameStore`'s public shape with a non-serializable field.

## Concerns (flag for controller/adjudication)

1. **No explicit "leave briefing" action in the pinned interface** — resolved by making `boot()` itself perform the briefing→lab transition (see "Design decisions" above). I'm confident this is the intended reading (it's the only way to reconcile 7 pinned actions with 6 distinct screen values and the "initial spec is free" rule needing a first log entry), but it's worth a controller sanity check before UI tasks (T14+) start wiring a "Open the data" CTA — if the CTA is expected to call some *other* not-yet-specified store method instead of just awaiting `boot()`'s promise, that would need a plan amendment.
2. **`error` field uses plain lowercase English strings** (e.g. `'engine crashed'`), not copy keys — per the controller's explicit "do not invent copy keys" instruction (given in the peekAndExtend context, which I applied uniformly). `src/game/**` cannot import `src/content` regardless (global constraint), so any future UI mapping from these strings to localized copy will need to happen in the UI layer by convention, not by type-sharing.
3. **`peekAndExtend`'s "no result visible" guard message** (`'no result visible to extend'`) and other guard-violation messages (`submit`, `abandon`, `makeCall`) are my own wording — only `'max N'` was pinned exactly by the controller. Tests assert `.rejects.toThrow()` generically for the un-pinned ones (not matching exact text) so a future wording tweak won't break them.
4. **`forks` is recomputed via `countForks(log)` on every log-mutating action** (not just at reveal time), so the UI can bind directly to `store.forks` for a live fork-trail during lab play (§2.4's "fork trail so far"). This is slightly more than the brief's literal ask (which only requires forks to be right by reveal time) but seemed clearly intended given §2.4's live-trail description; flagging in case a reviewer wants it computed lazily instead.
5. **`docs/superpowers/specs/2026-08-03-phackle-v1-design.md` vs `docs/implementation_plan.md`**: the master spec sections referenced by task numbering (§2.2/§2.4/§2.10) live in `docs/implementation_plan.md`, not the "design.md" delta file — noting this in case future task briefs assume the delta file is the canonical location.

No other deviations from the brief/pins. Ready for review.

---

## Fix round 1 — review finding (Important): BRIEFING→LAB must be player-gated

**Fix commit:** `b0af61d417bd32c4bfd8c10fb3ac6c1125ef761c`

### Finding

Task review verdict: Needs fixes. One Important: master spec §2.3 makes "Open the data" a player CTA and §2.2's diagram starts the machine at BRIEFING, but `boot()` (as originally implemented) drove all the way to `screen: 'lab'` with no intervening player gesture — the concern flagged in my own original report (#1) was adjudicated against my reading. Controller-mandated shape:
- `boot()` keeps all its existing work (init, default-spec prefetch, the initial free `VIEW_SPEC` log entry) but lands on and stays at `screen: 'briefing'`.
- Add `openData(): void` to `GameStore` — guard `screen === 'briefing'` (throw otherwise), sets `screen: 'lab'`. Pure navigation: no log entry, no fork implications.
- Tests: boot lands on `'briefing'`; `openData` flips to `'lab'`; `openData` throws from any other screen; update the 6-screen happy-path walk to `briefing → openData → lab → …`; confirm the initial `VIEW_SPEC` free-entry semantics are unchanged (fork count still 0 after boot+openData).
- Explicitly scoped out: the four ledgered Minors (two exact-string guard assertions, the pending-flag-after-abandon inconsistency, the `forks===countForks` invariant test, `useGameStore` coverage) — leave for final review unless this fix naturally touches the same lines.

### Fix implemented

**`src/game/store.ts`:**
- `boot()`'s final `set(...)` call (inside the default-spec-prefetch block) no longer includes `screen: 'lab'` — screen stays at whatever `initialState()` set it to (`'briefing'`) for the whole of `boot()`. Comment added explaining prefetch-during-briefing is intentional.
- New action `openData()`: `if (get().screen !== 'briefing') throw new Error('can only open the data from the briefing'); set({ screen: 'lab' });` — added to the `GameStore` interface (with doc comment) and to `initialState()`'s `Omit<...>` exclusion list.
- `abandon()` was **not** touched — the pending-flag-after-abandon minor was left exactly as ledgered, since this fix doesn't naturally intersect that code (per the controller's explicit scoping).

**`tests/game/store.test.ts`:**
- Renamed/updated the `boot` happy-path test: now asserts `screen === 'briefing'` after `boot()` (previously asserted `'lab'`), with everything else (prefetched `result`, the free initial `VIEW_SPEC{seen:false}` log entry, `forks === 0`) unchanged.
- Updated the `onCrash` test's screen assertion from `'lab'` to `'briefing'`.
- New `describe('openData (§2.2/§2.3 briefing -> lab)', ...)` block, 3 tests:
  1. Happy path: boot → assert `briefing`/log length 1/forks 0 → `openData()` → assert `lab`, and — the coordinator's explicit ask — log and forks are **byte-identical** before/after (`after.log` deep-equals `before.log`, `after.forks` still `0`), proving the initial-free-spec invariant survives the boot/openData split.
  2. Throws from every screen reached after briefing: walks `lab → published → reveal → summary` (via `openData→submit→makeCall→finishReveal`) asserting `openData()` throws synchronously at each stop.
  3. Throws from `'call'` specifically (the abandon path's alternate exit), tested separately since it's mutually exclusive with the `published` branch above.
- Every other existing test that previously relied on `boot()` landing on `'lab'` now calls `store.getState().openData();` immediately after `boot()`, before exercising any lab action (`changeSpec`/`peekAndExtend`/`submit`/`abandon`-direct/`makeCall`-preconditions). This was **required**, not cosmetic, in several cases — e.g. `submit`'s three rejection tests assert `screen === 'lab'` afterward, which only holds if `openData()` ran first; `abandon`'s and `makeCall`'s abandon-path tests would otherwise throw immediately (`abandon()` guards on `screen === 'lab'`).
- Rewrote the full happy-path test to walk `briefing → (boot, stays briefing) → openData → lab → … → summary`, matching the coordinator's required shape exactly.
- Did **not** touch: `forkLog.ts`/`forkLog.test.ts`, `types.ts`, `package.json`/lock, or any of the four ledgered Minors (confirmed via `git diff --stat` below — only `store.ts` and `store.test.ts` changed).

### Test evidence

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/store.test.ts tests/game/forkLog.test.ts
 Test Files  2 passed (2)
      Tests  48 passed (48)
```
(29 store tests — the original 26 plus 3 new `openData` tests — + 19 forkLog tests, unchanged.)

### Full gate (re-run)

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  10 passed (10)
      Tests  186 passed (186)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(no output — clean)

$ PATH="/usr/bin:$PATH" npx eslint .
(no output — clean)

$ PATH="/usr/bin:$PATH" npx vite build
✓ 16 modules transformed.
dist/assets/index-C2nDUzGv.js   190.41 kB │ gzip: 59.97 kB
✓ built in 88ms
```

### Scope check

```
$ git status --porcelain
 M src/game/store.ts
 M tests/game/store.test.ts

$ git diff --stat
 src/game/store.ts        | 21 +++++++++---
 tests/game/store.test.ts | 89 ++++++++++++++++++++++++++++++++++++++++++++++--
 2 files changed, 103 insertions(+), 7 deletions(-)
```
Exactly the two files the fix should touch; the four ledgered Minors remain untouched (verified by inspecting the diff — `abandon()`'s body has no hunk).

### Concerns update

Concern #1 from the original report ("no explicit leave-briefing action in the pinned interface") is now resolved by this fix — `openData()` fills that gap. Concerns #2–#5 stand unchanged. No new concerns from this fix.

---

## Fix round 2 — re-review finding (Important): lab actions were not screen-guarded

**Fix commit:** `64dce8476b2044d4896545940d0435884bb67c80`

### Finding

Re-review verdict on fix round 1: the `openData()` fix itself was correctly and fully addressed, but the split it introduced created a new gap. Dropping `screen: 'lab'` from `boot()`'s final `set()` left a newly-reachable state — `screen: 'briefing'`, `result` populated, `pending: false` — in which `changeSpec`/`peekAndExtend`/`submit` all still worked, since none of the three checked `screen` (only `abandon` and `makeCall` did). Concrete demonstration from the re-review: calling `submit()` immediately after `boot()` — no `openData()`, no `changeSpec()` — succeeds against the fixture's default significant result (`p=0.02, valid=true`) and flips `screen` straight from `'briefing'` to `'published'`, skipping `'lab'` entirely. `changeSpec` would likewise log genuine forks from the briefing screen. Latent (no UI exists yet to trigger it) but it defeats the exact property fix round 1 exists to guarantee.

### Fix implemented

**`src/game/store.ts`** — added the same guard pattern `abandon()`/`makeCall()` already use to all three actions:
- `changeSpec(next)`: `if (get().screen !== 'lab') throw new Error('can only change the spec from the lab');` as the very first line, before the immediate `set({ spec: next })` — so a rejected call has zero side effects (no spec update, no debounce scheduled).
- `peekAndExtend()`: `if (s.screen !== 'lab') throw new Error('can only collect more data from the lab');` — placed *after* the existing `if (!client) throw new Error('not booted')` check (so the pre-boot test's exact `'not booted'` message is preserved) and *before* the pending/result/max-N checks.
- `submit()`: `if (s.screen !== 'lab') throw new Error('can only submit from the lab');` — placed first, before the result-validity guard.
- Updated the three methods' doc comments on the `GameStore` interface to state the new "only fires from lab" guard.
- Did **not** touch `abandon()`, `makeCall()`, `openData()`, `boot()`, `forkLog.ts`/test, `types.ts`, or package files — confirmed by `git diff --stat` (only `store.ts` + `store.test.ts`) and by grepping the diff for `abandon` (no hunk touches it), matching the controller's explicit "touch nothing else" / four-ledgered-Minors-remain-out-of-scope instruction.

**`tests/game/store.test.ts`** — one new test per guarded action, all using the *exact skip order* the re-reviewer demonstrated (`boot()` then the action directly, no `openData()`):
- `changeSpec`: throws; asserts `client.runSpec` was called only once (boot's own call — no extra dispatch), `spec` is still `DEFAULT_SPEC` (never updated), `screen` still `'briefing'`.
- `peekAndExtend`: throws (using the fixture's default result, which would have satisfied every *other* guard — not pending, result present, n not maxed); asserts `client.extend` was never called.
- `submit`: throws (using the fixture's default `p=0.02, valid=true` result — precisely the re-reviewer's demonstration case); asserts `screen` stays `'briefing'` and `published` stays `null`.

All pre-existing tests (which already called `openData()` before exercising lab actions, per fix round 1) needed no changes — re-ran unmodified and pass, confirming the new guards don't disturb any post-`openData()` path.

### Test evidence

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/store.test.ts tests/game/forkLog.test.ts
 Test Files  2 passed (2)
      Tests  51 passed (51)
```
(32 store tests — 29 from fix round 1 plus 3 new lab-guard tests — + 19 forkLog tests, unchanged.)

### Full gate (re-run)

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  10 passed (10)
      Tests  189 passed (189)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(no output — clean)

$ PATH="/usr/bin:$PATH" npx eslint .
(no output — clean)

$ PATH="/usr/bin:$PATH" npx vite build
✓ 16 modules transformed.
dist/assets/index-C2nDUzGv.js   190.41 kB │ gzip: 59.97 kB
✓ built in 76ms
```

### Scope check

```
$ git status --porcelain
 M src/game/store.ts
 M tests/game/store.test.ts

$ git diff --stat
 src/game/store.ts        | 12 +++++++++---
 tests/game/store.test.ts | 41 +++++++++++++++++++++++++++++++++++++++++
 2 files changed, 50 insertions(+), 3 deletions(-)

$ git diff src/game/store.ts | grep -A5 -B5 "async abandon"
(no output — abandon() untouched)
```

### Concerns update

No new concerns. This closes out both rounds of the §2.2/§2.3 briefing-gating review thread; the four ledgered Minors (two exact-string guard assertions, `abandon`'s pending-flag-after-abandon, the `forks===countForks` invariant test, `useGameStore` coverage) remain exactly as originally ledgered, untouched across both fix rounds, for final review to dispose of.

