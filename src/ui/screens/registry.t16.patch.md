# T16 → `src/ui/screens/registry.ts` (apply at merge)

T14 owns `registry.ts`; it does not exist in T16's tree. T16 built `Call.tsx`
and `Reveal.tsx` as standalone, store-reading screen components so the wiring
is two map entries and two imports — nothing else changes.

## 1. Imports — add these two lines

```ts
import { Call } from './Call';
import { Reveal } from './Reveal';
```

## 2. Screen map — the two EXACT replacement lines

Replace whatever placeholders the `'call'` and `'reveal'` keys currently hold:

```ts
  call: Call,
  reveal: Reveal,
```

(If the registry maps to elements rather than component references, the two
lines are `call: <Call />,` and `reveal: <Reveal />,` — both components take
**no props**.)

## Contract

* `Call: () => JSX.Element | null` — takes no props. Reads `screen` and
  `makeCall` from the store. Renders `null` unless `screen` is `'published'`
  or `'call'`, and `null` while the locale bundle is still loading, so it is
  safe to mount unconditionally.
* `Reveal: () => JSX.Element | null` — takes no props. Reads `reveal`, `call`,
  `published`, `scenarioIndex` and `puzzleNumber` from the store. Renders
  `null` until `store.reveal` is populated (i.e. until after `makeCall`).

## Note for T15 (Published screen) — MOUNT CONDITION

**Mount `<Call />` behind the Published screen's "Face the truth" action, not
unconditionally.** `Call` self-gates on `screen === 'published' | 'call'`, so an
unconditional mount would put the dialog on screen the instant the paper is
published — stepping on §2.5's celebration, which is played 100% straight. Do
not rely on discovering the self-gate: gate it on the CTA as well.

`Call` is deliberately container-agnostic: it renders a `role="dialog"`
section and *nothing* around it — no backdrop, no fixed positioning, no focus
trap. The Published screen can mount `<Call />` inside its own overlay
(§7.3's "modal over dimmed cover") without fighting any of T16's layout, and
owns the dim + the focus trap itself. Because the dialog role lives on T16's
section, the container should not add a second one — set `aria-modal` on this
element (or wrap without a role) rather than nesting dialogs.

One design-law snag the overlay author should know about: DESIGN.md R4.2's
worked example spells the backdrop as `--ink` at 60% alpha "via `color-mix`",
but R1.3a forbids `color-mix()` anywhere under `src/ui` outside `tokens.css`,
and `tests/ui/tokens.test.ts` enforces that mechanically. The dim therefore
needs a **derived token declared in `tokens.css` and registered in DESIGN.md
§0's table** (e.g. `--scrim`) before it can be used — not an inline mix.
T16 does not render the backdrop, so it did not need to open that question.
