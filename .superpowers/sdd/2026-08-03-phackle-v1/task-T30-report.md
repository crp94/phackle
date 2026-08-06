# Task T30 report — Day-completion achievements wiring

**Branch:** `worktree-agent-ae5a714dfcfb85376` (worktree at
`/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-ae5a714dfcfb85376`)
**Base:** `a9e21e0` (per STEP 0's mandatory `git reset --hard`)
**Final commit:** `e648659` — `feat: wire achievement evaluation into the day-completion persist moment`

## Implemented

T13's `evaluateAchievements` (`src/game/achievements.ts`) had zero call sites: the achievement wall
stayed all-locked forever and the §2.11 `first_retraction` → Prereg Mode unlock was dead. This task
wires it into the one real day-completion moment.

### 1. `src/game/store.ts` — additive `resultLog`

- New exported `ResultLogEntry { key: string; p: number; valid: boolean }` and a new `GameStore.resultLog:
  ResultLogEntry[]` field, initialized to `[]` in `initialState()` (reset by every `boot()`, same as
  `log`/`forks`).
- Appended inside `commitSettledSpec`'s existing `store.setState` call, guarded by the SAME `seenPrev`
  boolean the `VIEW_SPEC` log entry's own `seen` flag already uses — i.e. an entry is recorded only when
  a result had genuinely rendered for the spec being replaced, never for one still `pending`.
- **Correctness detail worth flagging explicitly:** the entry is keyed off `st.result.spec` (the spec
  embedded in the `PathResult` itself), **not** `st.spec`. `changeSpec()` updates the visible control
  spec synchronously, before the debounce timer even starts, so by the time the debounced commit runs,
  `st.spec` may already be a later spec (per the existing "three rapid changes collapse into one" test) —
  only `st.result.spec` reliably names the spec the *currently displayed* result actually belongs to. I
  caught this by tracing through `changeSpec`'s eager `set({ spec: next })` call before writing the
  implementation; a naive `st.spec` version would have silently mis-keyed entries.
- `key` is `engine/specGrid.ts`'s existing, already-exported, already-tested `specKey()` — the "real"
  canonical spec-shape key `forkLog.ts`'s own comment explicitly names as the eventual replacement for its
  private stand-in. Reusing it meant **no change to `forkLog.ts` at all**, keeping the diff smaller and
  avoiding a second, independently-drifting key encoding.
- New tests: one assertion added to the existing `boot` test (`resultLog` starts `[]`), plus a new
  `resultLog` describe block (3 tests: append-on-supersede, no-append-while-pending, reset-on-reboot).

### 2. `src/game/storage.ts` — `saveAchievements`

- New `saveAchievements(ids: AchievementId[], iso: string): void` — merge-only: an id that already has an
  unlock date keeps it forever ("first date wins"); only fills in missing dates. Empty `ids` short-circuits
  before any read/write. Uses the module's existing `loadState`/`persistState` pair, so it inherits the
  same localStorage/memory-fallback semantics as `saveDay`/`saveSettings` with no new try/catch.
- New tests: set-on-first-unlock, never-overwrite (first date wins), multi-id merge without disturbing
  others, no-op empty call, cross-module-reload persistence, in-memory-fallback behavior.

### 3. `src/game/dayComplete.ts` (new file)

- `computeDecisiveTails(resultLog: ResultLogEntry[], published: Spec | null): boolean` — the "One-Tailed
  Bandit" truth table: `published.tails === 'one'` AND the same spec with every other knob identical but
  `tails: 'two'` appears in `resultLog` with `p >= .05` and `valid === true`.
- `unlockAchievements(input: DayCompleteInput): AchievementId[]` — assembles the `AchievementCtx`
  `evaluateAchievements` needs: `published` is derived from the log's own `SUBMIT` action (never a
  separately-passed flag that could drift out of sync with it), `decisiveTails` from
  `computeDecisiveTails`, `history`/`call`/`callCorrect`/`mode`/`stamp` passed straight through. Pure — no
  storage access.
- New test file `tests/game/dayComplete.test.ts`: full `computeDecisiveTails` truth table (null-published,
  two-tailed-published, no-sibling, sibling-also-significant, invalid-sibling, N-independence, exact-match-
  on-every-other-knob, p=.05 boundary) + `unlockAchievements` ctx-assembly tests (published-from-SUBMIT,
  no-SUBMIT-means-null, decisiveTails wiring end-to-end, history pass-through, mode/call/callCorrect
  pass-through, first-blood+one_tailed_bandit combo).

### 4. `src/ui/screens/Summary.tsx` — the one persist moment, extended

- `FinishedGameFields` gained one new required field, `resultLog: ResultLogEntry[]` (threaded from the
  store in `SummaryScreen`'s default export).
- Inside the **existing** `if (!practice && !alreadySaved) { ... }` block, immediately after `saveDay`:
  calls `unlockAchievements({ log, resultLog, history: state.history, call, callCorrect, mode, stamp })`
  then `saveAchievements(unlockedToday, puzzleIso)`. `state.history` is the history captured **before**
  `saveDay`'s write (never `historyForStreak`, which may carry a synthetic today-placeholder) — satisfying
  achievements.ts's own "history prior to today" contract.
- `preregUnlocked` in the returned `ComputedSummary` is now `state.achievements.first_retraction !==
  undefined || unlockedToday.includes('first_retraction')` — the `unlockedToday` half is what makes the
  upsell render on the **same** summary that just earned it, not only on a later day's remount. The old
  stale comment ("Achievement UNLOCKING isn't wired yet either... future task") was removed and replaced.
- No second persistence guard was created — `saveDay` and `saveAchievements` sit inside the identical
  `!practice && !alreadySaved` conditional, confirmed by direct file inspection (self-review below).

## Tested + results (genuine RED then GREEN)

**RED** (all four before implementation): `npx vitest run tests/game/dayComplete.test.ts
tests/game/store.test.ts tests/game/storage.test.ts tests/ui/summary.test.tsx` → 12 failures + 1 failed
suite (`dayComplete.test.ts`: `Cannot find module '../../src/game/dayComplete'`; `store.test.ts`:
`resultLog` undefined in 4 places; `storage.test.ts`: `saveAchievements is not a function` x2;
`summary.test.tsx`: `achievements.first_retraction` undefined in the two new end-to-end tests) — all
failing for the expected missing-implementation reasons, none from a typo/setup mistake.

**GREEN** after implementation: same four files → 144/144 passed. Full suite: `npx vitest run` → **43
files, 958/958 tests passed**. `npx tsc --noEmit` → exit 0 (after also adding `resultLog: []` to 8
pre-existing unit-level `persistAndComputeSummary(...)` call sites in `summary.test.tsx` that predate this
task — `resultLog` becoming a required field broke their literals; fixed by adding the field, changing
nothing else). `npx eslint .` → exit 0. `npx vite build` → exit 0 (PWA precache regenerated cleanly).
Re-verified once more after the commit, on the clean committed tree: same 958/958 + tsc/lint/build all
green.

## Self-review

- **Exactly one persistence moment:** grepped `saveDay(\|saveAchievements(\|persistState(` across `src/`
  — the only two write call sites in UI code are `Summary.tsx:301` (`saveDay`) and `Summary.tsx:329`
  (`saveAchievements`), both inside the same `if (!practice && !alreadySaved)` block opened at line 300
  and closed at line 330 (confirmed by direct read of the compiled function body). `alreadySaved` itself
  appears exactly once as a guard in `src/` (`Summary.tsx:300`) — no second, independently-invented guard
  was created anywhere.
- **No wall-clock reads:** grepped `Math\.random|Date\.now|new Date\(` across every new/changed line in
  `dayComplete.ts` (new file), and across the diffs of `store.ts`, `storage.ts`, `Summary.tsx` — zero
  matches in anything I added. `saveAchievements`'s unlock date is always the caller-supplied `iso`
  (Summary.tsx's own `puzzleIso`, the store's `boot()`-set day, never `localIsoDate()`). Store.ts's
  pre-existing `Date.now()` calls (for `PlayerAction.at` timestamps) are untouched, pre-date this task, and
  are unrelated to achievement unlock dates.
- **No `Math.random`** anywhere in new/changed code or new tests (fixtures are all literal spec/history
  objects).
- **Additive-only `store.ts`:** the only removed line is the single `return` statement inside
  `commitSettledSpec`'s `setState` callback, replaced by an equivalent `forks` extraction plus the new
  conditional `resultLog` branch — no existing field, guard, or behavior was weakened. Full diff reviewed
  line-by-line (included below for the record).
- **Ownership boundary respected:** `git status --porcelain` after commit shows exactly the 8 files I
  intended (`dayComplete.ts` + test new; `store.ts`, `storage.ts`, `Summary.tsx` + 3 test files modified).
  T31's files (`Lab.tsx`, `analyze.ts`, `protocol.ts`, `copy.ts`) were never touched. `forkLog.ts` was
  **not** touched either — I initially planned to export its private `specKey` stand-in, then found
  `engine/specGrid.ts` already exports the "real" canonical `specKey` (forkLog.ts's own comment names it
  as such), so I imported that instead, touching one fewer file than originally planned.

## Concerns

1. **`computeDecisiveTails`'s "published p < .05" clause is not independently re-checked inside the
   function** — its pinned signature is exactly `(resultLog, published)`, and `published` is a bare `Spec`
   with no p-value attached, so there is nothing for the function to check that condition against. I
   resolved this by relying on `store.submit()`'s own hard invariant (`s.result.valid && s.result.p <
   0.05`, unconditionally enforced — there is no code path to a non-significant `published` in the real
   app), documented prominently in `computeDecisiveTails`'s own doc comment. This mirrors
   `evaluateAchievements`'s own pre-existing contract (it likewise never independently verifies
   "`ctx.published` implies an actual publish happened" — it takes that as given from the caller). I
   flagged this as exactly the kind of edge the brief said to surface rather than invent silently; I was
   not able to get a blocking answer before implementing (no interactive path back to a human mid-task in
   this run), so I made the most defensible call available and documented it here and in-code rather than
   guessing quietly.
2. **The "sibling seen only at a different N" edge case** (also named in the task brief as needing
   resolution) resolves naturally from `specKey`'s existing design: it never encodes the sample window N,
   so a two-tailed sibling seen at any N counts as long as its spec-shape matches. This is pre-existing
   behavior of the key function I reused, not a new judgment call I introduced — but I'm naming it
   explicitly since the brief called it out. Covered by a dedicated test
   (`tests/game/dayComplete.test.ts`: "true regardless of which N the sibling was viewed at").
3. Both concerns above are pure-function edges with direct test coverage proving the actual chosen
   behavior; nothing here is silently untested.

## Files changed

- `src/game/dayComplete.ts` (new)
- `src/game/store.ts` (modified — additive `resultLog`)
- `src/game/storage.ts` (modified — added `saveAchievements`)
- `src/ui/screens/Summary.tsx` (modified — wired into the one persist block)
- `tests/game/dayComplete.test.ts` (new)
- `tests/game/store.test.ts` (modified — extended)
- `tests/game/storage.test.ts` (modified — extended)
- `tests/ui/summary.test.tsx` (modified — extended; hoisted `makeFakeClient`/`DriveToSummary` to module
  scope so the new achievements-wiring describe block could reuse them without duplication; added an
  optional `practice` prop to `DriveToSummary`, defaulted `false` so every pre-existing call site is
  unaffected)
