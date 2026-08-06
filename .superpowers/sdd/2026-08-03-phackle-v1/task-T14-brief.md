### Task T14: LAB screen

**Files:** Create `src/ui/screens/Lab.tsx`, `src/ui/components/SpecControls.tsx`, `src/ui/components/PValueDial.tsx`, `src/ui/components/CoefPlot.tsx`, `src/ui/components/ForkTrail.tsx`; Test `tests/ui/lab.test.tsx`
**Depends:** T5, T11, T12 (+T4 copy). **Master spec:** §2.4, §7.3 Lab, §7.2 type rules.

**Interfaces (produces/consumes):**
```ts
export function SpecControls(p: { spec: Spec; onChange: (s: Spec) => void; scenario: Scenario; disabled: boolean }): JSX.Element;
// six segmented radiogroups (NO dropdowns §7.3), labels from scenario/copy; roving tabindex, arrow keys per WAI-ARIA radiogroup.
export function PValueDial(p: { result: PathResult | null; pending: boolean }): JSX.Element;
// JetBrains Mono tabular, 64–96px, "p = 0.049" format 3 decimals (< .001 → "p < 0.001");
// ACT-I COLOR RULE: p ≥ .05 → color interpolates --muted → --assist-green as p decreases toward .05;
// p < .05 → --assist-green + glow (significance is DESIRABLE in Act I; --sig-red belongs to Act II only).
// 1-frame tick animation on value change; N + df shown small below.
export function CoefPlot(p: { result: PathResult | null; unit: string }): JSX.Element;  // SVG: CI interval vs zero line
export function ForkTrail(p: { log: PlayerAction[]; mode: 'hack' | 'prereg' }): JSX.Element; // live emoji strip per share map
// Lab.tsx: controls left / results right ≥768px, stacked mobile (results pinned top);
// "Collect 50 more participants" button (disabled at 400, logs peek). Footnotes (T6 review ruling): after the 1st
// peek render lab.peekFootnote (sincere Act-I line); after the 2nd peek ALSO render lab.peekFootnoteArmitage — the
// §2.4 verbatim Armitage wink, quiet footnote styling, the game's only sanctioned Act-I wink.
// SUBMIT enabled iff result.valid && p < .05; "Report a null result" quiet text button.
```

**Steps:**
- [ ] **RED** (testing-library, fake client from T12 tests): submit disabled at p=.06, enabled+glow at p=.049; footnote absent after 1 peek, present after 2; radiogroup arrow-key moves selection & fires one debounced runSpec; insufficient-data result renders copy `lab.insufficient` and disables submit; ForkTrail shows 🍴🎯 sequence for a scripted log; p formatting rules incl. `p < 0.001`.
- [ ] **Verify fail** → **GREEN** (build to §7 layout with tokens; keep components ≤150 lines each) → **Verify pass** → **Commit** `feat: Lab — the workbench (controls, dial, coef plot, fork trail, optional stopping)`.

---

