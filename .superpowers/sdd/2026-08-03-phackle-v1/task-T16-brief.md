### Task T16: CALL modal + REVEAL sequence + SpecCurve

**Files:** Create `src/ui/screens/Call.tsx`, `src/ui/screens/Reveal.tsx`, `src/ui/charts/SpecCurve.tsx`; Test `tests/ui/{call,reveal,speccurve}.test.tsx`
**Depends:** T5, T11, T12, T10. **Master spec:** §2.6, §2.7, §7.4, §7.5.

**Interfaces:**
```ts
export function SpecCurve(p: { points: { p: number; outcome: Outcome; explored: boolean; published: boolean; spec: Spec }[];
  grouped: boolean; outcomeLabels: string[]; copy: Record<CopyKey, string> }): JSX.Element;
// Custom SVG, render-once. X: rank sorted by p asc (grouped=true: 4 outcome bands, sorted within). Y mapping (zoom band):
//   f(p) = p <= 0.10 ? (p/0.10)*0.60 : 0.60 + ((p-0.10)/0.90)*0.40;  y = H·(1−f)  → p=0 bottom, band boundary at 60% height
// Threshold dashed rule at p=.05 (--sig-red) + label; region below tinted (sig-red at 7% opacity).
// Points: base r1.5 --rule; explored r4 --ink; published r6 --sig-red PLUS ring stroke (shape, not color alone §7.5)
//   + leader line to recipe callout text (short spec recipe via localized labels, e.g. "Y₂ · Age<40 · +Income · |z|>2.5 · log · one-tailed").
// Hover/tap any point → tooltip: recipe + "p = 0.041". Invalid points omitted; count surfaced via prop-computed footnote.
// Reveal.tsx sequence (§2.7 order, scroll-fade blocks; reduced-motion → all visible instantly):
// 1 truth line (reveal.truthNull / reveal.truthEffect with {beta},{outcome}) 2 SpecCurve fig.1 + caption
// 3 accounting paragraph: reveal.accounting1 {total}{sig}{sigPct} · accounting2 {k} · accounting3 {pHitPct} · peekSurcharge {peeks}{mult}
// 4 Stamp slam (kind from reveal.stamp, animate = !reducedMotion) over the JournalCover 5 call resolution line
// 6 fig.2 grouped SpecCurve + caption reveal.groupedCaption ("Real effects cluster. Noise scatters.")
// Call.tsx: modal over dimmed cover, two large option cards (call.real / call.noise), keyboard accessible,
// fires store.makeCall — reveal RPC happens strictly AFTER the choice (no truth in client beforehand: only enforced by protocol tests).
```

**Steps:**
- [ ] **RED** speccurve: y(0)=H, y(0.10)=0.40H boundary, y(1)=0; sig points below rule; published point has ring element + callout text; grouped mode renders 4 band labels; tooltip appears on pointerover with recipe from Italian labels when locale content is IT (labels localized, format stable).
- [ ] **RED** reveal: blocks render in §2.7 order (DOM order assertion); accounting interpolates exact numbers from a fixture RevealPayload (e.g. 1792/87/"4.9%"/k=14/"~52%"); stamp text matches verdict; effect-day shows fig.2, truth line names only the true outcome.
- [ ] **RED** call: options render before any reveal fetch (fake client asserts reveal not called until choice).
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: the call, the reveal, and the specification curve (figs 1+2)`.

---

