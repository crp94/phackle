# T17 patch notes — registry integration + App.tsx nav wiring

T14's `src/ui/screens/registry.ts` is not in this worktree (T14 is a sibling
task running in parallel — see the T17 brief's controller amendment). This
file gives the controller everything needed to reconcile T17's work with
whatever `registry.ts` and `App.tsx` look like by the time both branches
merge.

**Update, written after T14's own report became readable (T14 finished while
this task was in progress — same shared `.superpowers/sdd/` path, different
worktree; nothing from it was pulled into this branch or read beyond its own
report text, per STEP 0's isolation rules).** T14's report confirms the
registry shape assumed below almost exactly, so §1 stands unchanged. Two
things worth flagging precisely for reconciliation:

1. **`registry.ts` exists, with exactly this shape** (T14's own report, §
   "Implemented → The glue"): `SCREENS: Record<Screen, ComponentType>`,
   currently `{ briefing: BriefingStub, lab: Lab, published: PublishedStub,
   call: CallStub, reveal: RevealStub, summary: SummaryStub }`, consumed by a
   new `src/ui/ScreenRouter.tsx` that reads `useGameStore(s => s.screen)` and
   renders `SCREENS[screen]`. T17's replacement is exactly `summary:
   SummaryStub` → `summary: SummaryScreen` (import from `./Summary`) — §1's
   guidance is unchanged by this.
2. **T14 ALSO modified `App.tsx`** — from the SAME base commit (`8035462`)
   this branch started from, so the two diffs do NOT stack cleanly and need
   a real (if small) manual merge, not a simple patch-apply. Per T14's
   report, their change is: a `useEffect` (guarded by its own ref) that boots
   the engine (`createEngineClient()` + `store.boot(...)`, wrapped in
   try/catch so a missing `Worker` global — e.g. jsdom — degrades to the
   existing crash-banner path instead of throwing), and switching the
   header's `puzzleNumber` source to `useGameStore(s => s.puzzleNumber)`
   (falling back to the prop pre-boot). By their own account this is
   additive to the component **body** (a new hook + one value swap) and
   does not touch the `<header>`/`<main>` JSX structure — T17's diff below
   is additive to the JSX **return** (new buttons + a page-state) and
   doesn't touch the boot effect. The two probably merge cleanly by hand
   (different regions of the same function), but they were written against
   the same starting file independently, so this is flagged rather than
   assumed.
3. **`src/game/store.ts` is ALSO touched by both branches independently** —
   a second collision point, surfaced only in review round 2 (controller
   authorized ONE minimal T17 change there to fix the nav-remount/midnight-
   straddle bug in §2a below). T14's report: `gameStore` (the module
   singleton) changed from an unexported `const` to `export const gameStore
   = createGameStore()`. T17's change (this round): `GameStore` gained one
   new field, `iso: string` (empty-string initial, set by `boot()` alongside
   `puzzleNumber`, extend-not-contradict — nothing else in `store.ts` was
   touched). Both changes are purely additive and touch different lines
   (an export keyword vs. a new interface field + one `set({...})` call), so
   they should merge without real conflict, but — same caveat as `App.tsx`
   above — flagged because both were written against the same starting file
   independently. `tests/game/store.test.ts`'s one comprehensive `boot()`
   assertion was extended (not weakened) with `expect(s.iso).toBe(EPOCH)`;
   nothing else in that file changed.

## 1. Registry replacement line (machine screens)

T17 owns exactly **one** entry in whatever `Screen -> component` mapping
`registry.ts` builds — the `'summary'` screen (see `src/game/store.ts`'s
`Screen` union: `'briefing' | 'lab' | 'published' | 'call' | 'reveal' |
'summary'`). Wherever the registry lists the other five (owned by T14/T15/T16),
T17's row is:

```ts
import SummaryScreen from './Summary'; // default export — reads the store itself

// ...
summary: SummaryScreen,
```

`SummaryScreen` (the default export of `src/ui/screens/Summary.tsx`) takes
**no props** — it is a fully "standalone store-reading screen" per the
controller pin: it reads `useGameStore` (mode, practice, puzzleNumber, forks,
published, call, reveal, log) and `useLocale()` directly, computes the day's
score + persists it (see `persistAndComputeSummary`, exported alongside it,
for the pure-ish core of that logic), and renders the invoice/streak/
countdown/share/prereg-upsell UI. If the registry's convention for the other
five screens is "component receives no props either" (store-reading all the
way down), this drops in unchanged. If instead the other five take some
common prop shape (e.g. a shared `onNext`/navigation callback), the
controller should tell me and I'll adjust `SummaryScreen`'s signature to
match — nothing about `persistAndComputeSummary` or the presentational
`Summary` component needs to change either way, only the wrapper's own
prop list.

Note: `'summary'` is currently the terminal screen in `Screen` — nothing
transitions out of it yet (no "play again" / loop-to-next-puzzle action in
`store.ts`). Out of scope for T17; flagging in case the registry or a future
task wants a `finishReveal`-style transition out of `summary`.

## 2. App.tsx nav wiring (stats/legend/about — NOT machine screens)

Per the controller pin, Stats/Legend/About are **NAV pages**, driven by a
tiny **local page-state** inside `App.tsx`, deliberately independent of
`store.ts`'s `Screen` machine. The exact diff applied to
`src/ui/App.tsx` (already committed in this branch):

```diff
+import { useState, type ReactNode } from 'react';
-import type { ReactNode } from 'react';
 import { useLocale, type Theme } from '../i18n/LocaleProvider';
 import { AVAILABLE_LOCALES } from '../i18n/locale';
 import type { Locale } from '../engine/types';
 import type { CopyKey } from '../content/en/copy';
+import StatsScreen from './screens/Stats';
+import LegendScreen from './screens/Legend';
+import AboutScreen from './screens/About';
 import './App.css';

 type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

+type NavPage = 'game' | 'stats' | 'legend' | 'about';
+
 export interface AppProps {
   puzzleNumber: number;
   children?: ReactNode;
 }

 export default function App({ puzzleNumber, children }: AppProps) {
   const { content, copy, t, theme, setTheme, locale, setLocale } = useLocale();
+  const [page, setPage] = useState<NavPage>('game');

   if (!content || !copy) {
     return <div className="ph-app" aria-busy="true" data-testid="app-loading" />;
   }

+  const backToGame = () => setPage('game');
+
   return (
     <div className="ph-app">
       <header className="ph-header">
         <p className="ph-header__masthead">
           <span className="ph-header__wordmark">P-hackle</span>
           <span className="ph-header__vol">{t('briefing.vol', { volume: 1, issue: puzzleNumber })}</span>
         </p>
         <div className="ph-header__controls">
+          <div className="ph-header__nav">
+            <button type="button" className="ph-seg" aria-pressed={page === 'stats'} onClick={() => setPage('stats')}>
+              {t('nav.stats')}
+            </button>
+            <button type="button" className="ph-seg" aria-pressed={page === 'legend'} onClick={() => setPage('legend')}>
+              {t('nav.legend')}
+            </button>
+            <button type="button" className="ph-seg" aria-pressed={page === 'about'} onClick={() => setPage('about')}>
+              {t('nav.about')}
+            </button>
+          </div>
           <ThemeToggle theme={theme} setTheme={setTheme} t={t} />
           <LocaleToggle locales={AVAILABLE_LOCALES} locale={locale} setLocale={setLocale} t={t} />
         </div>
       </header>
-      <main>{children}</main>
+      <main>
+        {page === 'game' && children}
+        {page === 'stats' && <StatsScreen onClose={backToGame} />}
+        {page === 'legend' && <LegendScreen onClose={backToGame} />}
+        {page === 'about' && <AboutScreen onClose={backToGame} />}
+      </main>
     </div>
   );
 }
```

Plus one small CSS addition in `src/ui/App.css` (`.ph-header__nav { display:
flex; gap: var(--space-4); }`, reusing the existing `.ph-seg` button styling
— no new interaction pattern).

**Reconciliation guidance if T14's own `App.tsx` diverges:**

- If T14 needs to add its OWN state/props to `App.tsx` (e.g. a store
  subscription for the real `puzzleNumber` instead of the current
  placeholder prop), the nav block above is a self-contained, appendable
  unit — it only reads `t` (already destructured) and owns its own `page`
  state; it doesn't touch anything T14 is likely to change.
- If T14's registry wants `<main>` to *always* render the machine's current
  screen component with no manual `children` prop at all (i.e. `App` reads
  the store's own `screen` internally rather than receiving `children`),
  the `page === 'game' && children` branch above becomes `page === 'game' &&
  <CurrentScreen />` (whatever T14 names it) — everything else (the nav
  buttons, the other 3 branches) is unaffected.
- `tests/ui/shell.test.tsx` (T5's file) was left **completely untouched** —
  re-run green, unmodified, after this change. New nav-specific coverage
  lives in `tests/ui/appNav.test.tsx` (T17's own file) instead, to respect
  file ownership boundaries.

## 2a. The nav-remount interaction (review fix — read this before merging)

**This is the reason `persistAndComputeSummary` has a durable (storage-based,
not React-ref-based) idempotency guard, and it is exactly the interaction the
merge controller needs to re-verify survives whatever the final, reconciled
`App.tsx` looks like.**

§2's wiring means the header nav and the game machine are siblings under the
same `<main>`, switched by `page`: `{page === 'game' && children}` — where
`children` is (per T14's report) `<ScreenRouter />`, which in turn renders
whatever `SCREENS[screen]` is, i.e. `SummaryScreen` once `screen ===
'summary'`. Clicking "Stats" sets `page` to `'stats'`; React UNMOUNTS the
`page === 'game'` branch entirely (and everything under it, including
`ScreenRouter` and `SummaryScreen`) rather than merely hiding it. Clicking
"Close" on the Stats page sets `page` back to `'game'`, which REMOUNTS that
whole branch — a fresh `SummaryScreen`, with a fresh `savedRef` (`useRef(false)`
re-initializes on every mount), and the underlying game-store singleton is
completely unaffected by any of this (`screen` is still `'summary'`, `reveal`
is still populated, exactly as before the detour).

Before the round-1 review fix, `SummaryScreen`'s only guard against
re-persisting was that `savedRef`, so this exact click sequence — finish a
day, land on Summary (persists once, correctly), open Stats, close Stats —
fired `persistAndComputeSummary` a SECOND time for the SAME (day, mode), and
`storage.ts`'s `saveDay` builds `callsTotal`/`callsCorrect`/`careerPoints`/
`hackDays`/`preregDays`/`forkHistogram` as INCREMENTS (not an upsert), so every
such visit silently inflated every one of those numbers — exactly the ones
the Stats page the player just came from was displaying.

**Round-1 fix (superseded by round 2 below — kept here for the full history):**
`persistAndComputeSummary` was changed to check `loadState().history[todayIso]?.[mode]`
before calling `saveDay`, where `todayIso` was `localIsoDate()` — a LIVE
wall-clock read taken at persist time. This closed the bare-remount case
above, but round 2's re-review found it does NOT close a remount that
straddles a real midnight: finish puzzle day D before midnight (persists
correctly under D) → sit on the Stats page past midnight (the countdown
itself invites exactly this) → close back to Summary → `localIsoDate()` now
returns D+1 → the guard checks `history[D+1]` (empty) → D's already-correct
snapshot re-persists a SECOND time, under D+1's key → stats inflate again,
`streakAfter` counts a phantom D+1 play, and the player's REAL D+1 game later
finds that slot already occupied and silently gets skipped. The round-1
fix's own patch notes overclaimed this guard was safe "independent of how
the remount is triggered" — true only for a BARE remount; false for one that
also crosses a midnight. Corrected here.

**Round-2 fix (current):** the durable guard now keys on the puzzle's OWN
day, not the wall clock. `store.ts`'s `GameStore` gained one field, `iso:
string` (empty until `boot()` completes), set by `boot()` alongside
`puzzleNumber` — `set({ ..., puzzleNumber: puzzleNumber(iso), iso })`, using
`boot()`'s own `iso` parameter. `persistAndComputeSummary`'s field is now
named `puzzleIso` (not `todayIso`), and `SummaryScreen` passes
`useGameStore((s) => s.iso)` — `localIsoDate()` no longer appears anywhere in
the persistence path (only the countdown DISPLAY still reads the wall clock,
via `now`/`msToNextLocalMidnight`, which is a genuinely different concern:
"how long until the next puzzle" legitimately needs the real time; "which
day did I just finish" does not). Because `iso` is fixed once per boot and
never drifts with wall-clock time, the guard is now correct **regardless of
how much real time passes between mounts, and regardless of how the remount
is triggered** — a bare remount and a midnight-straddling remount are both
just "the same `iso` seen again," with no special-casing needed for either.
What it still does NOT cover (unchanged from round 1): two genuinely
different puzzle days wanting the same key (impossible — each `boot()` sets
its own `iso`), or `saveDay` being invoked by something other than this
function (nothing else in this codebase does).

`SummaryScreen`'s `savedRef` still exists as a cheap same-mount optimization
(avoids redundant `loadState()`/`scoreDay()` work within one mount, e.g.
under StrictMode's dev-only double-effect), but it is not, and was never
meant to be, the correctness guard — the durable, `iso`-anchored one is.

**Verified directly**, three tests in `tests/ui/summary.test.tsx`: (1) "does
not persist a finished day twice across a real unmount/remount (the nav
path)" — renders the actual `SummaryScreen` default export against a real,
store-driven 'summary' state (booted via a fake `EngineClient` through
`submit`→`makeCall`→`finishReveal`, the same sequence `store.test.ts` itself
uses), asserts the persisted `PersistedStats` numbers after the first mount,
unmounts, remounts, and asserts those exact numbers are UNCHANGED; (2) "a
real midnight rollover while sitting on a nav page does not create a
phantom next-day entry" — the round-2 regression test: same setup, but
`vi.setSystemTime` actually advances the clock past midnight between the two
mounts (`shouldAdvanceTime: true` keeps `waitFor`'s own polling working via
real elapsed time throughout), and asserts BOTH no phantom next-day entry
AND the original day's numbers stay unchanged; (3) `tests/game/store.test.ts`
extends its existing comprehensive `boot()` assertion with `expect(s.iso).toBe(EPOCH)`,
plus a pre-boot check that `iso` starts `''`. All three were confirmed to
have teeth: reverting the fix (restoring `localIsoDate()` in the persistence
path) makes tests (1) and (2) fail with the exact symptom described above —
verified directly, not merely asserted; see the T17 report's round-2
fix-report appendix for the actual command output.

## 3. Files this task added under `src/ui/screens/`

`Summary.tsx`/`.css`, `Stats.tsx`/`.css`, `Legend.tsx`/`.css`, `About.tsx`/
`.css` — each exports a named, prop-driven, directly-testable component
(`Summary`, `Stats`, `Legend`, `About`) alongside a default-exported
"Screen" wrapper that reads real data (store for Summary; `loadState()` +
`useLocale()` for the other three, which take only an optional `onClose`).
