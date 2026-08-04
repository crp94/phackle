# T15 patch for `src/ui/screens/registry.ts`

T14 builds `src/ui/screens/registry.ts` in a sibling worktree; it does not
exist in this tree (STEP 0 reset it to a commit before either T14 or T15
existed — see the T15 report for confirmation). This file cannot be applied
automatically; the controller splices it in by hand at merge, adjusting the
exact syntax to match T14's real file if it differs from the shape assumed
below.

## Assumed shape of `registry.ts`

Based on the T14 brief ("creates `src/ui/screens/registry.ts` with one stub
line per screen") and `Screen` (`src/game/store.ts`: `'briefing' | 'lab' |
'published' | 'call' | 'reveal' | 'summary'`), the registry is assumed to be
a `SCREENS: Record<Screen, ComponentType>` map with one stub entry per
screen, e.g.:

```ts
import type { ComponentType } from 'react';
import type { Screen } from '../../game/store';

export const SCREENS: Record<Screen, ComponentType> = {
  briefing: () => null, // stub -- T15 replaces
  lab: () => null, // stub -- T14 replaces with its own Lab.tsx
  published: () => null, // stub -- T15 replaces
  call: () => null, // stub -- T16 replaces
  reveal: () => null, // stub -- T16 replaces
  summary: () => null, // stub -- T17 replaces
};
```

`src/ui/screens/Published.tsx`'s `loadCallScreenFromRegistry` reads
`mod.SCREENS?.call` (a `Partial<Record<string, ComponentType<Record<string,
never>>>>` cast) — if T14's real export is named differently, or the module
shape differs, that one read site is the only place needing a matching edit.

## The two replacement lines

Add these two imports near the top of `registry.ts` (alongside its other
screen imports):

```ts
import { Briefing } from './Briefing';
import { Published } from './Published';
```

Then replace the two stub entries in the `SCREENS` map:

```ts
  briefing: Briefing,
```
```ts
  published: Published,
```

## Notes for the controller

- `Briefing` and `Published` are both zero-required-prop components
  (`export function Briefing({ useStore = useGameStore }: BriefingProps =
  {}) {…}` / same pattern for `Published`, which also defaults
  `loadCallScreen`) — `SCREENS.briefing` / `SCREENS.published` can reference
  them directly with no wrapper, exactly like every other stub entry.
- Neither reads any prop from whatever mounts them; both read the app's real
  store singleton (`useGameStore`, `src/game/store.ts`) and `useLocale()`
  content directly, gated the same way `src/ui/App.tsx` already gates
  `children` (content non-null). No change to `App.tsx` or `main.tsx` is
  needed beyond wiring the registry itself.
- `Published`'s "Face the truth" overlay reaches `SCREENS.call` through its
  own `loadCallScreenFromRegistry`, so it will pick up whatever `call` ends
  up wired to (T16's real `Call.tsx`, once merged) with no further change on
  this task's side.

  **CORRECTED — T29 fix round. Do not reinstate the pattern this bullet used
  to recommend.** It described that loader as "a fully dynamic,
  `/* @vite-ignore */` import of `./registry`" and treated the ignore pragma
  as the way to reference a module that did not exist yet. That was true only
  while `registry.ts` was genuinely absent. Once the controller's merge made
  the module real, the pragma became a **shipping blocker**: an unanalyzable
  specifier is never rewritten to the built chunk's content-hashed URL, so in
  a production build the request resolved to `/assets/registry`, 404'd, hit
  the loader's `catch` and returned `null` — "Face the truth" opened an empty
  overlay, and jsdom could not see it because the tests inject their own
  loader. `Published.tsx` now uses a plain literal `import('./registry')`
  (the Published -> registry -> Published cycle is harmless because the
  import is dynamic), and `tests/ui/tokens.test.ts` fails the build if the
  pragma reappears anywhere under `src/**`. This file is exempt from that
  scan only because it has to name the pragma in order to warn about it.
