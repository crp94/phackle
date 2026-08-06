### Task T5: App shell, Preprint Gothic theme, shared visual components

**Files:** Modify `src/ui/theme/tokens.css` (authored by T28 — extend only for DESIGN.md-consistent gaps), Create `src/ui/App.tsx` (real shell), `src/ui/components/Stamp.tsx`, `src/ui/components/ConfettiLayer.tsx`, `src/ui/components/EmailCard.tsx`, `src/ui/hooks/useReducedMotion.ts`; fonts via `@fontsource/stix-two-text` + `@fontsource/jetbrains-mono` (vendored, no external requests); Test `tests/ui/shell.test.tsx`
**Depends:** T1, T28 (`docs/DESIGN.md` is BINDING on all visual choices), +T4 for copy keys. **Master spec:** §7.1, §7.2, §7.5.

**Interfaces (produces):**
```ts
// tokens.css custom props exactly §7.2: --paper --ink --rule --sig-red --assist-green --hack-gold --muted
// + dark overrides under [data-theme='dark'] (§7.2 values); fonts: .font-serif → STIX Two Text, .font-mono → JetBrains Mono (tabular-nums)
export function Stamp(props: { kind: 'RETRACTED' | 'REPLICATED' | 'NULL_REPORTED'; label: string; subline?: string; animate: boolean }): JSX.Element;
// SVG rubber stamp: rotate(-12deg), distressed via feTurbulence+feDisplacementMap, --sig-red (green for REPLICATED);
// animate=true → single slam (translateY+scale overshoot, ~450ms) + 4px paper-shake on container; animate=false → instant.
export function ConfettiLayer(props: { particles: number; durationMs: number; onDone: () => void }): JSX.Element;
// canvas, cap particles at 400 regardless of prop, gold/paper palette; if reduced motion → render nothing, call onDone immediately.
export function EmailCard(props: { from: string; subject: string; body: string }): JSX.Element;
export function useReducedMotion(): boolean;
// App shell: running header "P-hackle · Vol. 1, No. {puzzleNumber}" (copy key briefing.vol), theme toggle
// (paper/dark, persisted via settings), locale toggle (renders AVAILABLE_LOCALES; hidden when length===1), <main> slot.
```

**Steps:**
- [ ] **RED**: `shell.test.tsx` — Stamp renders its `label` as accessible text (§7.5: verdict also as text) and skips animation class under reduced motion (mock `matchMedia`); ConfettiLayer with `particles: 4000` creates ≤400; header shows `Vol. 1, No. 12` given puzzleNumber 12; `data-theme` toggles and persists to localStorage `phackle.v1` settings; `<html lang>` syncs with locale.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: Preprint Gothic theme tokens, stamp, confetti, app shell`.

---

