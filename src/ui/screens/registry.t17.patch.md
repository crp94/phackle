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

## 3. Files this task added under `src/ui/screens/`

`Summary.tsx`/`.css`, `Stats.tsx`/`.css`, `Legend.tsx`/`.css`, `About.tsx`/
`.css` — each exports a named, prop-driven, directly-testable component
(`Summary`, `Stats`, `Legend`, `About`) alongside a default-exported
"Screen" wrapper that reads real data (store for Summary; `loadState()` +
`useLocale()` for the other three, which take only an optional `onClose`).
