# Task T11 report — Web Worker RPC layer

**Status: DONE.** Full gate green: 523 tests / 23 files, `tsc --noEmit` clean, `eslint .` clean,
`vite build` clean. Branch `worktree-agent-ab4e862764c425d31` (worktree), base `d58a7d4`.

Commits:

```
7ec6943 feat: engineClient — main-thread RPC client over the worker boundary
8c87fd0 feat: worker RPC — engine owns data, day type sealed until reveal
d58a7d4 Merge T10: reveal metrics + calibration suite GREEN — all §3.9 bands pass (review approved)  <- base
```

---

## 1. WHAT WAS IMPLEMENTED

### 1.1 `src/engine/protocol.ts` — types (T1, untouched) + `handleRequest`/`WorkerState` (T11, new)

Structural choice (brief left this open): **`handleRequest` and `WorkerState` live in `protocol.ts`
itself**, not in `worker.ts`. `worker.ts` is a thin shim (below). This keeps all dispatch logic in
one plain, non-Worker-dependent function that tests call directly.

- `WorkerState { day: GeneratedDay | null; n: WindowN; peeks: number }` + `createInitialWorkerState()`.
- `handleRequest(state, req): Res` — an if-chain on `req.op` (not a switch; avoids TS narrowing
  quirks with the closed 4-member union), mutating `state` in place:
  - **init**: asserts the p_hit table checksum (see §1.3), then `practiceSeed !== undefined ?
    generatePractice(seed, scenarioCount) : generateDay(iso, scenarioCount)`; resets
    `day`/`n=N_SCHEDULE[0]`/`peeks=0` unconditionally (re-init always resets — no guard against an
    already-populated `state.day`, per the midnight-rollover requirement); returns
    `{scenarioIndex: Number(day.puzzle.scenarioId), n}` — never `dayType`, never `puzzleNumber`.
  - **runSpec**: `analyze.runSpec(state.day.data, req.spec, state.n)` — current window, verbatim.
  - **extend**: `N_SCHEDULE.indexOf(state.n)`, advances to the next entry and increments
    `state.peeks` on success; returns `{ok:false, error:'max N'}` without touching `n`/`peeks` once
    already at 400 (or on any `n` not found in the schedule, defensively).
  - **reveal**: `enumerateCurve(state.day.data, state.n)` **at the current window, not a hardcoded
    400** — then `buildRevealMetrics(state.day, curve, published, explored, state.peeks)`, with
    `{dayType, trueOutcome, trueBeta, hetero}` spread on top from `state.day.puzzle`. This is the
    only op whose `Res` may carry the truth.
  - Any op outside the closed union → `{ok:false, error:'unknown op: <value>'}`, never a throw.
  - Any op before the first `init` → `{ok:false, error:'engine not initialized — call init first'}`.
- `RevealPayload.trueBeta`'s doc-comment was extended (comment-only, per the brief's "extend with
  a comment" allowance) to record that it carries the injected raw-units magnitude, not the
  standardized `d` draw — see §1.2.

### 1.2 `trueBeta` — extending `DailyPuzzle`/`GeneratedDay` (controller-authorized)

The controller's pin says `trueBeta` must be "the injected d·sd product," not the bare
standardized `d`. Before this task, `day.ts`'s `assemblePuzzle` set `trueBeta: params.d` — the
raw draw, not the injected magnitude. I read `dgp.ts`'s `generateRows`: the effect injection is
`target[i] += effect.d * sd * multiplier` where `sd` is the **pre-injection** sample sd of the
true-outcome column, computed in a private, unexported `meanAndSd`. By the time `day.ts` holds the
accepted `Dataset`, the injection has already happened, so `sd` can't be read back off it (the
injection itself shifts the treated group's mean, changing the column's sd too).

Fix (minimal, contained entirely to `day.ts` — **no change to `dgp.ts`, `Dataset`, or any T3-owned
file**): `generateRows`'s own per-row loop never consults `effect` at all — only the one
post-loop injection pass does (this is explicit in its header comment on the "one deliberate
exception" to its prefix property, and is exactly what `tests/engine/dgp.test.ts`'s own
`"diff-in-diff: ... == d*sd"` test already relies on). So `generateDataset(seedForAttempt(attemptUsed),
null)` reproduces the exact pre-injection column byte-for-byte. `day.ts` now has a local
`sampleSd` (bit-identical duplicate of `dgp.ts`'s private `meanAndSd`, same loop order — mirroring
this file's own already-documented `puzzleNumberFor` precedent, and `dgp.ts`'s own precedent of
duplicating `meanAndSd` rather than cross-importing `stats.ts`'s) and a new `effectMagnitude(seed,
outcome, d)` helper; `assemblePuzzle`'s effect-day branch now sets
`trueBeta: effectMagnitude(seedForAttempt(attemptUsed), params.outcome, params.d)`.

Cost: one extra full-400-row `generateDataset` call per effect day's puzzle assembly — negligible
next to the up-to-`MAX_ATTEMPTS` calls the acceptance loop above it already pays.

`types.ts`: added a comment-only clarification above `DailyPuzzle` documenting `trueBeta`'s
raw-units meaning. No shape change — `trueBeta?: number` is untouched syntactically.

I checked before making this change that no other production code reads `DailyPuzzle.trueBeta`
(only `day.ts` sets it; `tests/game/store.test.ts` and `tests/engine/reveal.test.ts` construct
independent fake literals, unaffected), and confirmed via `docs/implementation_plan.md`'s §2.7.1
reveal-line example (`"β = 0.24"`) that the number is meant to be shown in raw units, consistent
with — not contradicting — the controller's pin.

### 1.3 The p_hit table checksum fold-in (T10 review ⚠️)

`reveal.ts`'s `assertPHitTable(table)` needs the parsed JSON table as its argument, and the module
constant holding it (`TABLE`) isn't exported. `pHitAtK(k)` calls `assertPHitTable(TABLE)`
unconditionally as its own first statement, so `init` calls `pHitAtK(1)` and discards the result —
using only `reveal.ts`'s public surface to trigger the exact same assertion. A stale table throws
out of `handleRequest` **uncaught** (deliberately not converted to `{ok:false}`): this is framed as
a deploy defect, not a protocol error, and an uncaught throw inside a real worker's `onmessage`
fires the worker's `error` event — i.e., it crashes the worker, which is exactly the `onCrash` /
`errors.workerCrash` path a stale build artifact should land on, not a swallowed error string.

### 1.4 `src/engine/worker.ts` (new)

Thin shim: one module-level `WorkerState` (via `createInitialWorkerState()`), `self.onmessage =
(ev) => postMessage(handleRequest(state, ev.data))`. `self` is asserted to a narrow
`{onmessage, postMessage}` shape locally in this file rather than changing `tsconfig.json`'s `lib`
array — the project's one shared tsconfig uses `["ES2022","DOM","DOM.Iterable"]` for the React UI,
and DOM + WebWorker lib.d.ts declare incompatible global scopes that can't coexist in one program
(under `"DOM"`, `self` types as `Window`, whose `postMessage` requires a `targetOrigin` a worker's
does not take). Untestable by unit test (needs a real Worker global scope) — see §3.

### 1.5 `src/game/engineClient.ts` (new)

`createEngineClient(makeWorker?)`. Only imports `protocol.ts`/`types.ts` **types** (verified below,
§4). Promise-map keyed by a monotonically-increasing `nextId` (starts at 1); `dispatch<T>(req)`
sets a 10s `setTimeout` before `postMessage`, storing `{resolve,reject,timeoutHandle}` in the map.
On `message`: look up by `res.id`; **absent → dropped silently** (late/unknown id); else delete the
entry, `clearTimeout`, resolve/reject per `res.ok`. On `error` (worker crash): reject every
still-pending entry immediately (rather than each waiting out its own 10s), clear the map, then
call every registered `onCrash` callback (an array, so multiple registrations all fire — the brief's
signature returns `void` with no unsubscribe, so I treat repeat calls as additive registrations).
Default worker factory: `new Worker(new URL('../engine/worker.ts', import.meta.url), {type:'module'})`,
matching Vite's documented module-worker idiom exactly.

---

## 2. TDD — RED then GREEN, with commands and output

### 2.1 Protocol layer

RED (file created, `handleRequest`/`createInitialWorkerState` didn't exist yet):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/engine/protocol.test.ts
...
 Test Files  1 failed (1)
      Tests  23 failed (23)
```
(All 23 failed with `TypeError: createInitialWorkerState is not a function` — RED for the right
reason: missing implementation, not a typo/compile error in the test itself.)

GREEN (after implementing `handleRequest`/`WorkerState` in `protocol.ts` and `worker.ts`):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/engine/protocol.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)
```

Full-suite regression check (day.ts/types.ts were touched too — §1.2):

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  22 passed (22)
      Tests  511 passed (511)
```

(511 = the pre-existing suite, 21 files, 488 tests, **plus** `protocol.test.ts`'s own 23 — this run
was taken after `protocol.test.ts` already existed and passed, before `engineClient.test.ts` was
written. `day.test.ts`/`dgp.test.ts` are confirmed still green despite the `trueBeta` formula
change; neither references `trueBeta`'s value at all, per a full-repo grep done before making the
change.)

### 2.2 engineClient layer

RED (module didn't exist):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/engineClient.test.ts
 FAIL  tests/game/engineClient.test.ts [ tests/game/engineClient.test.ts ]
Error: Cannot find module '../../src/game/engineClient' imported from .../tests/game/engineClient.test.ts
      Tests  no tests
```

GREEN, after implementing `src/game/engineClient.ts` (one intermediate RED caught along the way —
see §5, "bugs found during self-testing"):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/engineClient.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

### 2.3 Final full gate

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  23 passed (23)
      Tests  523 passed (523)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npx eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npx vite build
✓ 33 modules transformed.
✓ built in 122ms
```

Reconciliation: 21 pre-existing files (19 `.test.ts` + 2 `.test.tsx`, confirmed via
`git ls-tree -r --name-only d58a7d4 -- tests/`) carry 488 pre-existing tests. `protocol.test.ts`
adds 1 file / 23 tests → the `22 files / 511 tests` snapshot in §2.1. `engineClient.test.ts` adds
1 more file / 12 tests → `488 + 23 + 12 = 523`, matching the `23 files / 523 tests` final run
above exactly.

---

## 3. VITEST-VS-E2E COVERAGE DIVISION (brief-required statement)

- **`handleRequest` (protocol.ts)** — tested **directly**, node environment, **real engine**: real
  `generateDay`/`generatePractice` on real (scanned, not hand-picked) calendar ISO dates, real
  `runSpec`/`enumerateCurve`/`buildRevealMetrics`. No mocking of engine logic, with **one narrow,
  explicitly-scoped exception**: one test (`"throws ... if the shipped p_hit table is stale"`) uses
  `vi.doMock` to substitute `src/data/p_hit_by_k.json`'s *data* (not any engine logic) with a
  deliberately-wrong checksum, specifically because the real shipped table is — by construction —
  never stale against the real current DGP, so there is no way to exercise that fail-fast branch
  with unmodified real data. `vi.resetModules()`/dynamic `import()`/`vi.doUnmock()` scope this to
  one test only. A second test (`vi.spyOn(reveal, 'pHitAtK')`, no `mockImplementation`) proves the
  call happens at all, against the real, unmodified implementation (a spy that wraps rather than
  replaces).
- **`engineClient.ts`** — tested against a **scripted fake Worker** (a plain object implementing
  just `postMessage`/`addEventListener`/`removeEventListener`/`terminate`, driven synchronously by
  the test). Plain `node` environment (no jsdom pragma) — the fake never needed real
  `MessageEvent`/`ErrorEvent` constructors, since `engineClient.ts` only reads `.data` off whatever
  object arrives, which works identically on a real or fake event object.
- **`worker.ts` (the real `self.onmessage`/`postMessage` wiring) and the real
  `new Worker(new URL(...), {type:'module'})` construction/module-loading path** — **not covered by
  this task's Vitest suite** (node/jsdom have no real Worker global; a real Worker needs a browser
  or a browser-like runtime). Per the brief, this is intentionally left to **E2E** (a later task).
  The one thing I could and did verify at the unit level: the default factory's *construction
  arguments* (URL pointed at `src/engine/worker.ts`, `{type:'module'}`) via `vi.stubGlobal('Worker',
  ctorSpy)` — this proves the call shape is right without needing a real Worker to actually run.

---

## 4. SELF-REVIEW (brief-required checklist)

**"The JSON-scan spoiler test actually parses every op's Res."** Confirmed:
`tests/engine/protocol.test.ts`'s `spoiler guard (§5.4)` describe block calls `assertSpoilerClean`
(real `JSON.stringify` + substring scan for `"dayType"`/`"trueOutcome"`/`"trueBeta"` keys and
`"effect"`/`"null"` literals) on: `init`'s Res, `runSpec`'s Res, every successful `extend` Res
(200→250→300→350→400), the `extend` **error** Res once already at 400 (`'max N'`), an unknown-op
error Res, and the pre-init "not initialized" error Res — for **both** a null-day and an
effect-day iso (found by scanning, not hardcoded). A final sanity test proves the scan mechanism
itself isn't vacuous: it asserts `reveal`'s Res **does** contain `"dayType"` and `"effect"` for an
effect day, so a broken/no-op scanner would have been caught failing to distinguish clean from dirty.

**"No engine import from client beyond types."** Confirmed by direct inspection —
`src/game/engineClient.ts`'s only two imports are:
```
import type { EngineClient, ExtendInfo, InitInfo, Req, Res, RevealPayload } from '../engine/protocol';
import type { PathResult, Spec } from '../engine/types';
```
Both `import type`. `worker.ts` (which DOES import real runtime engine code) lives in
`src/engine/`, not `src/game/`, so it's outside this constraint by design — confirmed
`eslint.config.js`'s engine-purity rule (`no-restricted-imports` on `src/engine/**`, blocking
`**/game/*` except `**/game/tuning`) doesn't apply to `engineClient.ts` (it's in `src/game/`) and
passes with zero errors either way.

**"Timeout cleans up its map entry."** Confirmed — `dispatch`'s `setTimeout` callback:
```ts
const timeoutHandle = setTimeout(() => {
  pending.delete(id);
  reject(new Error(`Engine request timed out after ${TIMEOUT_MS}ms (op: ${req.op}, id: ${id})`));
}, TIMEOUT_MS);
```
`pending.delete(id)` runs before `reject`. Also confirmed the reverse paths clean up too: normal
resolution (`message` handler) does `pending.delete(res.id); clearTimeout(entry.timeoutHandle)`
before resolving/rejecting (so a since-answered request's now-redundant 10s timer never fires
uselessly later); crash handling clears every entry's timeout then `pending.clear()`s the whole map.

---

## 5. FILES CHANGED

```
 src/engine/day.ts               |  57 ++++-   (M — trueBeta = injected d*sd, not bare d; +sampleSd/effectMagnitude helpers)
 src/engine/protocol.ts          | 140 +++++++++++-  (M — +WorkerState, +createInitialWorkerState, +handleRequest)
 src/engine/types.ts             |   4 +        (M — comment-only: DailyPuzzle.trueBeta clarified)
 src/engine/worker.ts            |  32 +++      (A — new)
 src/game/engineClient.ts        |  88 ++++++++ (A — new)
 tests/engine/protocol.test.ts   | 461 +++++++++ (A — new, 23 tests)
 tests/game/engineClient.test.ts | 314 +++++++++ (A — new, 12 tests)
 7 files changed, 1094 insertions(+), 2 deletions(-)
```

Base `d58a7d4`; final commit `7ec694338ba584a70bac504324f0790ee358f661`.

---

## 6. BUGS FOUND DURING SELF-TESTING (fixed before commit)

All caught by running the tests, not by inspection alone — worth recording since they're the kind
of mistake the "verify RED/GREEN, don't just read the diff" discipline exists to catch:

1. **Test-only timing bug** in the "late response after timeout" `engineClient` test: both
   requests were created before a single `advanceTimersByTimeAsync(10_000)`, so *both* timed out
   instead of only the first — the test's premise (a fresh, still-genuinely-pending second
   request) required creating request #2 *after* advancing past request #1's timeout. Fixed by
   reordering; not a production bug.
2. **Runtime**: `new Worker(...)` requires an actually-constructible function; `vi.fn(() => ({...}))`
   (arrow function) cannot be called with `new` — `TypeError: ... is not a constructor`. Fixed by
   using a named `function` expression as the mock implementation (test-only).
3. **Lint/typecheck tension** on that same fake constructor's unused `(url, opts)` parameters:
   TypeScript's `noUnusedParameters` auto-exempts leading-underscore names, but this project's
   ESLint config has no `argsIgnorePattern` override for `@typescript-eslint/no-unused-vars`, so
   the two rules disagree on plain vs. underscore names. Resolved with underscore-prefixed names
   *plus* a targeted `eslint-disable-next-line`, mirroring this repo's own established convention
   (`daily.ts`'s inline-disabled `Math.random` exception, per `eslint.config.js`'s own comment).
4. Two `no-useless-assignment` lint errors in `protocol.test.ts` from a trailing `id++` whose
   post-incremented value was never subsequently read (last statement in its scope) — fixed by
   dropping the increment where the value truly wasn't needed again.

No production-code bug was found by the tests beyond what TDD is supposed to catch on the first
pass — `handleRequest` and `engineClient` both went RED→GREEN cleanly on the first real
implementation attempt; the four items above were test-file/tooling issues surfaced while getting
the gate fully clean.

---

## 7. CONCERNS / THINGS A REVIEWER SHOULD LOOK AT

1. **`trueBeta` semantics changed** (§1.2): pre-T11, `DailyPuzzle.trueBeta` held the bare
   standardized `d` (already in `EFFECT_D_RANGE = [0.18, 0.30]`, matching
   `docs/implementation_plan.md`'s illustrative `"β = 0.24"` line almost too neatly). Post-T11, it
   holds `d * sd` (raw units, potentially a very different magnitude per outcome family — Y2 is an
   exp-scale positive-skew family, Y3/Y4 are count/bounded-discrete). I followed the controller's
   explicit pin over the design doc's flavor-text example (the pin names this exact ambiguity and
   resolves it), and confirmed no other current code depends on the old meaning — but **whichever
   future task renders the reveal's "True effect on X: β = ___" line should sanity-check that a
   raw-units number reads sensibly for all four outcome families**, since it's no longer bounded to
   a tidy `[0.18, 0.30]`-ish range the way the design doc's one example implied.
2. **One narrow mock exception** to the "no mocks of the engine" Vitest strategy (§3): the
   stale-p_hit-table test substitutes the JSON data file, not engine logic, and only for that one
   test. Flagging explicitly in case a reviewer considers even data-level mocking out of bounds
   here — the alternative (no test at all for the "throws on stale table" behavior, only the
   "was `pHitAtK` called" spy) seemed like a worse trade.
3. **`worker.ts`'s `self` typing** casts around the project's single-tsconfig DOM/WebWorker lib
   conflict (§1.4) rather than introducing a second tsconfig. This is untested by this task's
   Vitest suite by construction (needs a real Worker global) — first real verification will be
   whichever E2E task actually exercises the browser path.
4. **`onCrash` rejecting all pending requests immediately** (rather than only firing the callback,
   letting each pending request time out on its own 10s clock) was my own design addition, not
   explicitly spelled out in the brief's one-line description of `onCrash`. It seemed like the
   obviously-correct behavior (the worker is provably gone; waiting up to 10 more seconds per
   in-flight request serves no purpose), and is exercised by its own test, but it's a place I made
   a judgment call beyond the letter of the pinned interface.

---

## 8. FIX ROUND (post-approval review finding)

**Verdict on the original submission: Approved, with one Important entering a short fix round.**
The reviewer independently re-verified `engineClient.ts:63-64` (`pending.delete(id)` before
`reject(...)`) and confirmed the three adjudicated self-review items held (scoped JSON mock ruled
properly isolated; `worker.ts`'s thinness confirmed by line count; the spoiler-guard design —
scanned dates, vacuity-checked scanner — called out as a strength). Two Minors were ledgered
(single-spec spoiler `runSpec` sample; the reused `'max N'` string on the unreachable `idx===-1`
branch) with an explicit instruction **not** to touch them, and the `trueBeta` display-scale
caveat (§7.1 above) was confirmed as recorded for T16, not mine to resolve now.

### 8.1 The Important: timeout cleanup was black-box-unprovable

**Finding:** `tests/game/engineClient.test.ts` passes identically whether or not the timeout
handler's `pending.delete(id)` line exists, because a stale map entry receiving a late
resolve/reject on an already-settled promise is itself a silent JS no-op — "no throw" was the only
thing the old tests checked, and that assertion can't tell a cleaned-up map from a leaked one.

**Fix:** Added a test-only introspection seam to `src/game/engineClient.ts` — `createEngineClient`'s
return type widened from `EngineClient` to `EngineClient & { pendingCount(): number }` (an
intersection, so `store.ts`/`store.test.ts`, which type against plain `EngineClient`, need no
changes and are structurally unaffected — confirmed by `tsc --noEmit` staying clean). The returned
object gained one method, `pendingCount() { return pending.size; }`, documented
`/** test-only: number of in-flight requests (the pending map's size) */`.

Tightened two tests with the two required assertions:
- `createEngineClient — timeout > rejects with a descriptive Error after 10s of no response`: now
  asserts `pendingCount()===1` right after the request is created, `===1` again just under 10s (not
  yet cleaned up), and **`===0` immediately after the timeout fires** — the load-bearing assertion.
- `createEngineClient — unknown/late responses > a late response for an id that already timed out
  ...`: now asserts `pendingCount()===1` when created, `===0` right after its timeout fires (before
  any late response exists), **`===0` again after the late response for that same id arrives** (the
  second required assertion), then `===1` once a genuinely new request exists, and `===0` again
  once that one resolves — the full lifecycle, not just the two endpoints.

### 8.2 Verifying the fix is load-bearing (mutation check)

Per the reviewer's own verification method (temporarily deleting the production line and
confirming the old suite didn't notice), I did the same to the NEW assertions before trusting them:

```
$ # (temporarily removed `pending.delete(id);` from the timeout handler)
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/engineClient.test.ts
 ❯ tests/game/engineClient.test.ts (12 tests | 2 failed) 27ms
     × a late response for an id that already timed out is dropped silently and does not affect other requests 8ms
     × rejects with a descriptive Error after 10s of no response 1ms

 FAIL  ... > a late response for an id that already timed out ...
AssertionError: expected 1 to be +0 // Object.is equality
 ❯ tests/game/engineClient.test.ts:226:35

 FAIL  ... > rejects with a descriptive Error after 10s of no response
AssertionError: expected 1 to be +0 // Object.is equality
 ❯ tests/game/engineClient.test.ts:269:35

 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)
```

Both new assertions fail exactly as predicted, confirming they're real proof of cleanup, not
decoration. Restored `pending.delete(id);` and reconfirmed green:

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/engineClient.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

### 8.3 Full gate, post-fix

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  23 passed (23)
      Tests  523 passed (523)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npx eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npx vite build
✓ 33 modules transformed.
✓ built in 126ms
```

Test count unchanged (523) — this fix round added assertions to two existing tests, no new test
cases and no new test files.

### 8.4 Files changed (fix round)

```
 src/game/engineClient.ts        | 18 +++++++++++++++++-  (M — +pendingCount test hook, widened return type)
 tests/game/engineClient.test.ts | 27 +++++++++++++++++++++++----  (M — pendingCount assertions in 2 tests)
 2 files changed, 40 insertions(+), 5 deletions(-)
```

Commit `7753e35e7ea98d796b1563c391a2a1355ac79c4f` — `test: prove timeout cleanup with a
pendingCount introspection seam`.

### 8.5 Minors — explicitly not touched

Per instruction: the single-spec spoiler-guard `runSpec` sample and the reused `'max N'` string on
the unreachable `idx===-1` defensive branch in `handleRequest`'s `extend` case are left exactly as
they were in the original submission.
