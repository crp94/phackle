# Task T40 — fix the two E2E-found product bugs (F1, F2)

**Agent:** implementer · **Worktree:** `.claude/worktrees/task-t40` · **Branch:** `task-t40`
**Base:** `748817b` (verified at STEP 0) · **Commit:** see below · **Not pushed.**
**Files touched:** `src/game/store.ts`, `src/ui/App.tsx`, `src/ui/App.css`, `e2e/booked.spec.ts`,
`tests/game/store.test.ts`, `tests/ui/router.test.tsx`, `tests/ui/storageNotice.test.tsx` (new).

---

## 0. What the two `.fixme` tests demanded

`e2e/booked.spec.ts` carried two live, skipped tests written by T23 to spec the *correct*
behaviour, both traced to T23's own report (`task-T23-report.md` §4):

- **FINDING F1** — `errors.storageOff` was written, translated in en/it/es, and `isStorageOff()`
  was exported and unit-tested (`tests/game/storage.test.ts`), but nothing under `src/ui/**`
  rendered it. A player whose browser blocks `localStorage` played, scored and streaked an entire
  day into the in-memory fallback and was told nothing before it evaporated on reload.
- **FINDING F2** — `App.tsx`'s loading gate held the shell until locale *content* resolved, then
  mounted the Briefing — but `store.boot()` was still awaiting `client.init()` (the day's actual
  assembly, in the worker). Until that landed, `scenarioIndex`/`iso`/`puzzleNumber` were
  `initialState()`'s placeholders (`0`/`''`/`0`), so the Briefing rendered scenario #0's question,
  cover story and — via a wrong-date Grantwell email — flashed the wrong study for 74–117ms on a
  fast desktop (measured by T23) before swapping to the real one.

## 1. Fix F2 — the boot gate (done first; it constrains F1's placement)

**New store signal, not a proxy.** `src/game/store.ts` gained `booted: boolean` on `GameStore`:
false from `initialState()`, reset to false at the top of every `boot()` (via the existing
`{ ...initialState() }` spread), and set `true` inside the **same `set()` call** that already
fixes `scenarioIndex`/`n`/`puzzleNumber`/`iso` — i.e. exactly the moment `client.init()` resolves,
not at the end of `boot()`'s whole async body (the DEFAULT_SPEC prefetch still runs after, but the
UI doesn't need to wait out an extra `runSpec` round trip once the day itself is correct).

I considered and rejected two alternatives before adding this field:
- `iso !== ''` — technically equivalent (iso is set in the same `set()` call), but overloads a
  field whose *type* just happens to make emptiness meaningful, rather than a field whose meaning
  *is* "day fixed." Less legible at the call site, and not what the task asked for.
- `scenarioIndex !== 0` — explicitly the wrong heuristic per the brief: scenario #0 is a real,
  playable scenario one day in twenty.

`booted` stays **false** on a boot failure (`client.init()` rejecting, or the worker crashing
mid-init via `onCrash`) — the day genuinely was never fixed, so a `booted` reading `true` there
would be a lie the gate would act on. `error` is the signal for that path instead.

**`App.tsx`'s gate.** The existing `if (!content || !copy) return <loading/>` is now followed by:

```tsx
if (!booted && !storeError) {
  return (
    <div className="ph-app" aria-busy="true" data-testid="app-loading" role="status" aria-label={t('a11y.loading')} />
  );
}
```

`storeError` is `useGameStore((s) => s.error)`, read fresh in App.tsx for this purpose. Opening the
gate on `booted || storeError` means a genuine boot crash still surfaces (ScreenRouter's existing
`.ph-error` banner, layered over whatever's underneath — no change there) instead of spinning
forever waiting for a day that will never arrive.

**`a11y.loading` finally gets wired up.** It existed, translated in all three locales, since before
this task, and nothing rendered it. The *first* loading phase (before `content`/`copy` load) is
left exactly as it was — unlabeled — because `t()` falls back to the raw copy key pre-load, and an
`aria-label` flashing the literal string `"a11y.loading"` at a screen reader is the audio version of
the text-flash bug the existing gate comment already warns against. The *second* phase (content
loaded, day not yet fixed) can safely carry `aria-label={t('a11y.loading')}` because `t()` now
translates correctly — so it does, plus `role="status"`, mirroring `PValueDial`'s own
`role="status"`/`aria-busy` pairing (T22/DESIGN.md) rather than inventing a new announcement idiom.

**Constraints verified, not just claimed:**
- **T33's no-focus-on-first-mount guard.** The focus-restore effect keys off `screenKey =
  page === 'game' ? \`game:${gameScreen}\` : page`. `gameScreen` stays `'briefing'` throughout the
  entire boot sequence (boot's own `set({ ...initialState(), ... })` resets `screen` to
  `'briefing'` at the top, and nothing advances it before `openData()`), so `screenKey` never
  changes across any of the loading-phase re-renders — the effect's dependency array never fires a
  second time, so `mainRef.current?.focus()` is never called during the whole gate-extension
  window. `<main>` mounts for the first time only once the gate opens, with `previous === null`
  on the very first commit (unaffected by the gate's new timing) — the "not on the first mount"
  invariant holds exactly as before.
- **T35's screen transition.** `<main>` (keyed by `screenKey`, the one entrance-animation site)
  never rendered at all during either loading phase both before and after this change — it was
  already absent during the `!content` phase, and now stays absent through the `!booted` phase
  too. There is exactly one `<main>` mount in this whole flow, so there is nothing to double-fire.
- **Boot-retained-iso persistence anchoring** — untouched; `iso` is still set in the same place, by
  the same code, for the same reason (Summary.tsx's own anchoring is unaffected).
- **Practice mode** — `boot()`'s control flow does not branch on `opts.practice` anywhere near
  where `booted` is set; the practice-seed-only branch (`practiceSeed()`) happens strictly before
  `client.init()`. Verified directly: `tests/game/store.test.ts`'s existing practice-mode boot test
  now also asserts `booted === true` after boot (see §3).

## 2. Fix F1 — the storage notice

`App.tsx` now renders, in the shell (above `<main>`, so visible on every screen including the
Briefing — a superset of "visible on the Briefing at minimum"):

```tsx
{isStorageOff() ? (
  <p className="ph-storage-notice" role="status">{t('errors.storageOff')}</p>
) : null}
```

`isStorageOff()` (from `storage.ts`) is read directly in the render body, not cached into React
state: `storageOff` is a one-way flag (false → true, never back, per `storage.ts`'s own module
design) and `App` already re-renders constantly during boot/play (subscribed to `puzzleNumber`,
`screen`, now `booted`/`error` too), so the next render after storage actually fails will pick it
up without any extra plumbing.

**Styling** (`src/ui/App.css`, `.ph-storage-notice`): the same hairline-bottomed, no-fill block
shape as `ScreenRouter.css`'s pre-existing `.ph-error`, but `color: var(--muted)` instead of
`var(--ink)` — R1.2 reserves `--muted` for captions/footnotes/quiet asides, and this is not a
crash (the game stays fully playable; nothing evaporates except future persistence). No new color,
no new token, no `transition`/`animation` anywhere in the diff (confirmed — `git diff src/ui/App.css
| grep -i "transition\|animation\|@keyframes"` returns nothing).

**Role.** `role="status"` (implicit `aria-live="polite"`, `aria-atomic="true"`), explicitly *not*
`"alert"` — this mirrors `errors.workerCrash`'s `role="alert"` treatment in `ScreenRouter.tsx` by
contrast: that one is a crash, this one is an honest aside about what will not survive a reload.

**"Dismissable-not-required," as built.** I read this as: unlike a modal, nothing about the notice
blocks play, so there is nothing the player is forced to dismiss to keep going — not as "must ship
an explicit dismiss control." I did not add one, for two reasons: (1) the e2e spec's own assertion
is pure visibility (`getByText(...).toBeVisible()`), with no dismiss interaction tested; (2) a
dismiss control's obvious implementation — persisting "dismissed" via `saveSettings` — cannot work
when storage is exactly what's broken, and a session-only (non-persisted) dismiss felt like
complexity fighting the same problem the notice exists to name. Flagging this reading explicitly
in case the controller wanted an actual button — it's a small, additive follow-up if so.

**Correctness of "only when actually off."** `isStorageOff()` is the single source of truth
(`storage.ts`); the notice's ternary is a direct, uncached read of it — there is no other
condition, cache, or derived state that could desync from the real flag.

## 3. Tests

**Un-fixme'd**, both `e2e/booked.spec.ts` tests — no other change to their bodies; both pass
against the real production build unmodified (see §4).

**`tests/game/store.test.ts`** (jsdom-free, plain Node) — extended existing boot tests and added
one new one:
- Pre-boot assertion block now also checks `booted === false`.
- The main "initializes the engine…" test now also checks `booted === true` post-boot.
- The practice-mode boot test now also checks `booted === true` (verifies F2's fix is
  practice-mode-agnostic, per the brief's "verify both paths" ask — done at the store level, where
  `booted` is actually implemented, rather than duplicating a whole App-level practice-mode
  integration test).
- The init-failure test now also checks `booted === false` (a crash must never fake "day fixed").
- **New**: `[FINDING F2] booted stays false while client.init() is in flight, and flips true in the
  SAME update that fixes scenarioIndex/iso/puzzleNumber` — holds `client.init()` open with a
  deferred promise, asserts `booted`/`scenarioIndex`/`iso` are still placeholders mid-flight,
  subscribes to the store to prove **no intermediate notification ever shows `iso` fixed while
  `booted` is still false** (the exact ordering guarantee the App gate depends on), then resolves
  and asserts the final state.

**`tests/ui/router.test.tsx`** (jsdom, App-level) — added one new test to the existing "App boot
wiring" describe block (which already had the `vi.hoisted`/`vi.mock('../../src/game/engineClient')`
plumbing needed to control what `createEngineClient()` returns without touching a real `Worker`):
holds a fake client's `init()` open via a deferred promise, asserts the loading placeholder carries
`aria-label` = `a11y.loading`'s English copy and `role="status"` while pending, asserts the
Briefing button and "P-hackle" header are **absent** during that window (the literal shape of
FINDING F2 — the old gate would already show them here), resolves, then asserts the button appears
and `app-loading` disappears. All five pre-existing tests in that describe block were re-verified
by inspection and by running them — none needed changes; they either read state through `waitFor`/
`findBy*` (which tolerate the extra render tick the gate now takes) or set `error` directly
(which opens the gate on its own, independent of `booted`).

**`tests/ui/storageNotice.test.tsx`** (new file) — two tests: absence while storage works
(negative control, run first) and presence + `role="status"` once storage throws (reusing
`tests/game/storage.test.ts`'s own `installThrowingLocalStorage` verbatim, for a *real* throw
through the real code path rather than mocking `isStorageOff` itself). Kept in its own file
deliberately: `storage.ts`'s `storageOff` is module-level, one-way (false→true, never resets)
state, and vitest's default per-file module isolation is what lets this test flip it without
contaminating any other file's assertions.

**Unit total: 52 files, 1418 tests, all passing** (T23's baseline recorded 51/1357 — the other
+50 tests across the intervening merges from `748817b`'s history are pre-existing, not mine; my
diff is `+4` new tests in `tests/game/store.test.ts`/`tests/ui/router.test.tsx`/
`tests/ui/storageNotice.test.tsx` combined, `+1` new file).

## 4. Gate — every command, every exit code

```
1. UNIT      npx vitest run            EXIT 0    52 files, 1418 tests passed  (~12s)
2. TSC       npx tsc --noEmit          EXIT 0    (no output)
3. ESLINT    npx eslint .              EXIT 0    (no output)
4. BUILD     npm run build             EXIT 0    (same pre-existing INEFFECTIVE_DYNAMIC_IMPORT
                                                   warning as T23's report notes — unrelated,
                                                   pre-existing, harmless)
5. E2E #1    npm run e2e               EXIT 0    15 passed, 0 skipped   (~11.5s)
6. E2E #2    npm run e2e               EXIT 0    15 passed, 0 skipped   (~11.3s)  [immediately consecutive]
   STRESS    npx playwright test --repeat-each=3   EXIT 0   45 passed, 0 skipped (~24s)
```

Both `.fixme` tests now pass as ordinary tests in every run above:
- `booked.spec.ts:283` — `(e) blocked storage tells the player their progress will not be saved [FINDING F1]`
- `booked.spec.ts:326` — `the briefing never shows a scenario other than the day's own [FINDING F2]`

**No flake observed.** The brief named a "known dgp flake" to isolate if it surfaced; I searched
the reports directory and the codebase for any documented DGP-related flake and found none (the
`flaky`/`flake` hits that exist are comments describing tests as deliberately *non*-flaky, e.g.
`tests/engine/dgp.test.ts`'s fixed-seed convention). The `--repeat-each=3` stress run (45/45, one
full extra pass beyond the required two) turned up nothing intermittent either. Nothing needed
isolating.

## 5. Concerns for the controller

1. **F1's "dismissable-not-required" phrase** — I read it as "does not block play, needs no
   dismissal to proceed," and shipped a persistent (non-dismissable) notice rather than adding a
   dismiss button. See §2's fuller reasoning. If an explicit dismiss affordance was actually
   wanted, it's a small additive follow-up — happy to add it, but wanted to flag the interpretation
   rather than guess silently.
2. **`booted` is a new field on `GameStore`.** I checked `tests/game/store.test.ts` and
   `tests/ui/a11y.test.tsx` for any full-object `toEqual`/snapshot assertions of store state that a
   new field could break — found none (every existing assertion reads specific fields or uses
   `toMatchObject`), so this should be a safe, additive change, but flagging the surface area since
   `GameStore` is imported widely.
3. **`a11y.loading` and `errors.storageOff` were both pre-written, translated copy keys sitting
   unused before this task** — strong evidence they were prepared ahead of time for exactly this
   fix. Both are now wired up; no copy changes were needed in any locale.
4. Everything in `.superpowers/sdd/2026-08-03-phackle-v1/task-T23-report.md` §6 that isn't about
   F1/F2 (EPOCH placeholder, pinned-day search cost, `[INEFFECTIVE_DYNAMIC_IMPORT]`) is unchanged
   and still applies as written there.
