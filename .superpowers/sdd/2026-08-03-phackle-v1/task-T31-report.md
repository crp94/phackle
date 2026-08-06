# Task T31 report — Lab data visual + inline explanations

**Branch:** `main` (worktree `agent-aa3e3ed1ad792e9a9`), base `a9e21e0`
**Commits:** `35a9e01` (engine), `0bd846f` (UI). Final SHA **`0bd846f`**.
**Gate at each commit:** 1000 tests / 43 files pass, `tsc --noEmit` clean, `eslint .` clean,
`vite build` clean, DESIGN §10 tier-C greps clean.

Scope covers BOTH rounds: the original dispatch (DataCut, six methods notes, first-run intro,
CoefPlot labels) and the mid-flight upgrade from the owner's second play-test (briefing goal
strip, four-step how-to-play, dial caption).

---

## 1. What was implemented

### Engine — `PathResult.cut`
- `src/engine/types.ts`: new `DataCut` interface (`treated` / `control` / `excludedTreated` /
  `excludedControl`, all `number[]`) and `PathResult.cut?: DataCut`. Documented at the type as a
  §6 **extend-not-contradict** addition: §6's `PathResult` is unchanged and the new field is
  optional, so every literal written against §6 still type-checks. The doc also pins spoiler
  safety by construction, the ≤400 bound, and the "source-row order, never sorted" ordering
  contract.
- `src/engine/analyze.ts`: `buildCut()` assembles it at the end of `runSpec`'s pipeline from the
  intermediates already in scope (`filteredIdx`, `transformedY`, `keptLocal`). One pass, using
  an ascending cursor over `keptLocal` rather than a `Set` — `keptLocal` is ascending by
  construction in both branches that build it. No arithmetic beyond the cursor's `+1`, so §3.1's
  determinism op-set is untouched.
- Attached **even when `valid === false`**: the figure should still show the sample the dial has
  declined to analyse. This is the one `PathResult` field that stays meaningful when invalid, and
  the type comment says so.
- **Zero cost on the reveal's hot path.** `specGrid.enumerateCurve` reimplements the pipeline with
  its own memoized intermediates and never calls `runSpec` (verified by grep: the only callers are
  `protocol.handleRequest`, `day.ts`'s calibration, and tests), so the 1,792-path enumeration pays
  nothing for this field.

### `src/ui/components/DataCut.tsx` + `.css` (new)
Two-column strip plot: comparison group left, treated right; analysed points as filled `--ink`
dots; **excluded points still drawn**, as hollow crossed `--muted` marks; group mean bars over the
included values only; a hairline baseline; HTML column labels; a three-item mono legend carrying
the live counts. `role="img"` + `aria-label`. Nothing animates (§5's budget is exhaustive).

### Explanations
- **Six methods notes** — `RadioGroup` gained an optional `note` prop rendered under the options
  and wired with `aria-describedby`; `SpecControls` passes the six `lab.explain.*` keys.
- **First-run "How to play"** — native `<details open>` in `Lab.tsx` with a real `<ol>` of four
  steps and a "Got it" button; dismissal persists as `settings.introSeen`.
- **Dial caption** — `PValueDial` gained a `DialShell` wrapper so the caption renders in all three
  states (real result / invalid / no result yet) without duplicating markup, and `data-testid` +
  the R1.8 band modifier stay on the same element the existing tests address.
- **Briefing goal strip** — one hairline-ruled line under the title card, before the cover story.
- **CoefPlot** — axis label + zero-line label, and the scale-invariance fix those forced.
- `src/ui/charts/useContainerWidth.ts` (new): T16's viewBox-tracks-container mechanism extracted
  for its two new consumers. `SpecCurve.tsx` keeps its inline copy — it is outside this task's file
  set and behaviourally identical, so it was left alone rather than churned; noted for a later pass.

### Storage
`PersistedSettings.introSeen?: boolean`, documented as a §5.6 schema extension on the same footing
as `locale`. Absent means not-yet-dismissed, which is correct both for a fresh install and for a
state written before the field existed — **no migration needed**. `pickValidSettings` carries it
through for consistency. Written via `saveSettings`, which merges, so theme/locale survive (pinned
by a test).

---

## 2. TDD — genuine RED/GREEN transcripts

**RED 1, engine cut** (`npx vitest run tests/engine/analyze.test.ts`):
```
 FAIL  tests/engine/analyze.test.ts > runSpec cut (T31...) > is still assembled when the fit is invalid
AssertionError: expected undefined to be defined
 ❯ tests/engine/analyze.test.ts:554:24
     554|     expect(result.cut).toBeDefined();
 Test Files  1 failed (1)
      Tests  9 failed | 33 passed (42)
```

**RED 2, protocol spoiler extension** (`npx vitest run tests/engine/protocol.test.ts`):
```
AssertionError: 2026-09-02/none: runSpec must attach a cut: expected undefined to be defined
SyntaxError: "undefined" is not valid JSON        <- the JSON round-trip test
 Test Files  1 failed (1)
      Tests  2 failed | 23 passed (25)
```

**GREEN 1** (`npx vitest run tests/engine/`): `Test Files 9 passed (9) · Tests 257 passed (257)`.

**RED 3, DataCut** (`npx vitest run tests/ui/dataCut.test.tsx`) — the component did not exist:
```
Failed to resolve import "../../src/ui/components/DataCut" from "tests/ui/dataCut.test.tsx"
 Test Files  1 failed (1) · Tests  no tests
```
After the component landed, an intermediate run showed `4 failed | 29 passed (33)` — three from the
locale content loading asynchronously (fixed by `findByText`) and one real test bug: the
`Math.random` scan matched the *doc comment* explaining why the file does not use it. Fixed by
stripping comments the way `tokens.test.ts` does, plus a guards-the-guard assertion. Then
`Tests 33 passed (33)`.

**RED 4, explanations + intro + dial caption + goal strip**
(`npx vitest run tests/ui/lab.test.tsx tests/ui/briefing.test.tsx`):
```
 Test Files  2 failed (2)
      Tests  19 failed | 51 passed (70)
```
**GREEN 4:** `Test Files 2 passed (2) · Tests 70 passed (70)`.

**Full gate, final:**
```
 Test Files  43 passed (43)
      Tests  1000 passed (1000)
```
`npm run typecheck` → exit 0. `npm run lint` → exit 0. `npm run build` → clean.

### Tests added (52 new cases)
- `tests/engine/analyze.test.ts` +12. A hand-computed 10-row fixture: `y0 = [0×9, 10]`,
  `x = [0×5, 1×5]` → mean 1, ss 90, sd = √(90/9) = **√10**, z(10) = **9/√10 ≈ 2.846** — outside
  `|z|>2` and `|z|>2.5`, inside `|z|>3`. So both sides of the exclusion knob are checked against
  numbers derivable by hand rather than by re-running the implementation. Plus: transform carries
  through (`log(11)`), log1p re-splits on its own z-scores, subgroup scoping, exact accounting
  against `excludedCount` and the window across the real DGP, the ≤400 cap over all seven
  subgroups, purity.
- `tests/engine/protocol.test.ts` +2 (spoiler-scan extension): `cut` has **exactly** the four keys
  and nothing else; every member is a plain `Array` of finite `number`s; JSON round-trips
  unchanged (structured-clone-safe on the worker wire); and the scan is non-vacuous (`|z|>2` on a
  real day removes somebody, asserted).
- `tests/ui/dataCut.test.tsx` +33 (new file).
- `tests/ui/lab.test.tsx` +17, `tests/ui/briefing.test.tsx` +2.

---

## 3. Design decisions that deviate from the brief, with the reasoning

**(a) Jitter is seeded by the VALUE, not the value index.** The brief pinned "fnv1a32 of value
index". Keying on the index breaks the mechanic the brief is asking for: a point's array
membership changes when the exclusion knob moves (`treated[7]` becomes `excludedTreated[0]`), so
index-keyed jitter reshuffles the entire column on every turn, and "watch these specific people
leave your analysis" reads as a reshuffle. Keyed on the datum (`fnv1a32(value.toFixed(6))`), the
mark stays exactly where it was and only changes shape. Still fully deterministic, still zero
`Math.random` (scanned by test). Pinned by a test that renders the same datum first included and
then excluded and asserts the x is unchanged. Documented at the function.

**(b) Included dots use `--dot-all` (1.5px), not `--dot-explored` (4px).** Arithmetic, not taste:
at the largest window a column holds 200 points in roughly 122×72px. At r=4 that is
200 × 50px² = 10,000px² of ink in an 8,784px² box — **114% coverage**, a solid slab. At
`--dot-all` the same column reads at ~16% and the distribution survives. `--dot-explored` goes to
the **excluded** marks instead, which are rarer and are the point of the figure — so the visual
weight lands on the surgery rather than on the cloud. Both numbers are in `DataCut.css`.

**(c) Mean bars are 0.8× the column width.** Self-review finding: at full width the two bars very
nearly meet across the 12px gap and read as one rule spanning the whole plot — the opposite of
"here are two averages, compare them". Fixed and pinned by a test asserting the inter-bar gap
exceeds twice the column gap. (`shots/lab-660-excluded.png` is the *before*, `lab-1088-excluded.png`
the *after*.)

**(d) The vertical domain spans excluded points too.** A domain fitted to the survivors would push
the excluded outliers out of frame — the figure refusing to show the thing it exists to show.
Pinned by a test (`-20` and `30` excluded against an included range of 1..5 both land inside the
plot box).

**(e) `lab.howThisWorks.body` was replaced, not supplemented.** The upgrade to four steps made the
3-sentence paragraph dead weight; leaving it in the union would have handed T19/T20 a key nobody
renders. It never shipped, so nothing is lost.

---

## 4. LAYOUT CHANGE — flagged for the controller

`.ph-lab__results` **is no longer `position: sticky` on mobile.**

T14 made the whole results pane sticky with an opaque `--paper` background at `--z-sticky`, so the
dial stayed on screen while the knobs scrolled beneath. That works only while the pane is a modest
fraction of the viewport. With the explanation layer in place the pane measures **998px on a
360×640 phone** — taller than the viewport. A sticky flex item that tall does not pin: it slides to
the end of its containing block and, being opaque and above `--z-sticky`, paints straight over its
sibling.

Measured at the bottom of the document, 360×640, **before** the fix:
```
resultsPaneH 998   viewportH 640
results box  [-390, 608]     controls box [-802, 608]
firstRadioTop -776   firstRadioVisible: FALSE   resultsPosition: "sticky"
```
i.e. **the six knobs were unreachable on a phone.** `shots/phone-bottom-BEFORE.png` shows what the
player saw at maximum scroll: the results pane, and nothing else, forever.

After (`resultsPosition: "static"`), the knobs and their notes are on screen at the bottom of the
page — `shots/phone-bottom-AFTER.png`.

Why this fix: no DOM change, no second breakpoint (R3.4 intact), and what DESIGN.md R3.4 actually
quotes from §7.3 for this width is "stacked below", which DOM order already satisfies (`Lab.tsx`
still renders results before controls, pinned by a pre-existing test). **The cost is real:** on
mobile the dial is no longer visible while a knob at the bottom of the page is turned. Restoring it
properly needs the dial ALONE to be the sticky element **as a direct child of `.ph-lab`** — its
containing block must span the controls — which touches the ≥768px two-pane rule and is therefore
the controller's call, not this task's. The whole argument is written up in a comment at the rule
in `Lab.css`.

---

## 5. Screenshots taken, and what they showed

Method (honest): the **real built app** driven in headless Chrome over CDP — no jsdom, no static
harness. `Emulation.setDeviceMetricsOverride` sets the *layout* viewport, which sidesteps the
window-width clamping T16 hit, so the figures' `ResizeObserver` reports the true container width
and the viewBox tracks it for real. `Storage.clearDataForOrigin` is issued before each navigation
because the PWA service worker otherwise serves the *previous* build's content-hashed CSS — this
bit me once mid-review (a "fixed" run still reported `position: sticky`).

Saved to `task-T31-shots/`.

| Shot | What it showed |
|---|---|
| `lab-320.png`, `lab-660.png`, `lab-1088.png` | Lab at all three widths, first run. Intro panel with 4 steps, dial + caption, labelled CoefPlot, DataCut, six notes. At 1088 the two-pane layout is correct (controls left, results right). |
| `lab-*-excluded.png` | The same, after clicking `|z| > 2`. **This is the task working:** at 660, p 0.383 → 0.155, n 200 → 186, and 14 crossed marks appear at the top and bottom of both columns — exactly where outliers live. Legend flips to `Analysed: 186 · Excluded: 14`. The fork trail gains its marker. |
| `datacut-zoom-light.png` | 4× zoom of the figure, light theme. The columns read instantly; the ⊗ marks are unmistakable against the ink cloud; mean bars clear. This is the shot that exposed the full-width mean-bar problem (c). |
| `briefing-1088.png`, `briefing-320.png` | The goal strip: hairline above and below, display face, `--ink`, under the title card and before the cover story. Prominent with no fill, no shadow, no second colour. |
| `phone-bottom-BEFORE/AFTER.png` | §4's blocker and its fix. |

Measured, all three widths:

| width | cut viewBox | cut CSS width | coef viewBox | coef CSS width | notes | mean bars |
|---|---|---|---|---|---|---|
| 320 | `0 0 256 76` | 256 | `0 0 256 52` | 256 | 6 | 2 |
| 660 | `0 0 596 76` | 596 | `0 0 596 52` | 596 | 6 | 2 |
| 1088 | `0 0 500 76` | 500 | `0 0 500 52` | 500 | 6 | 2 |

**Scale invariance confirmed in the real browser**, not just in unit tests: viewBox width equals
measured CSS width at every viewport, for both figures — 1 user unit = 1 CSS px, so
`var(--text-13)` really is 13px everywhere. Geometry audit at 660: excluded-mark y range
`[10, 70]` against an axis at 76 — nothing escapes the plot box.

Note for anyone reproducing this: today (2026-08-03) is before `EPOCH` (2026-08-10), so the app is
in **practice mode with a fresh `practiceSeed()` per load** — which is why each screenshot shows a
different scenario ("Takes cold showers", "Folds their socks", "Reviews from a café"...). That is
pre-existing, expected behaviour, not non-determinism in this work.

---

## 6. Copy keys added — 21, for the T19/T20 IT/ES roster

**Six methods notes** (Act-I sincere; a test asserts none of them hedges):
`lab.explain.outcome`, `lab.explain.subgroup`, `lab.explain.covariates`, `lab.explain.exclusion`,
`lab.explain.transform`, `lab.explain.tails`

**First-run intro** (four steps; `lab.howThisWorks.body` was **replaced** by step1–4 and does not
exist): `lab.howThisWorks.title`, `lab.howThisWorks.step1`, `lab.howThisWorks.step2`,
`lab.howThisWorks.step3`, `lab.howThisWorks.step4`, `lab.howThisWorks.dismiss`

**Dial caption:** `lab.dialCaption`

**Briefing goal strip:** `briefing.goal`

**CoefPlot:** `lab.coefPlotAxis` (takes `{unit}`), `lab.coefPlotZero`

**DataCut:** `lab.cutControl`, `lab.cutLegendIncluded` (`{n}`), `lab.cutLegendExcluded` (`{n}`),
`lab.cutLegendMean`

**a11y:** `a11y.dataCut`

Interpolation tokens used: `{unit}` (existing convention, as `lab.coefPlotCaption`) and `{n}` for
sample sizes (existing convention, as `lab.nLabel` / `lab.collectMore`). No new token names.

Translator note for T19/T20: `lab.howThisWorks.step4` deliberately reuses the wording of the
existing `published.faceTruth` — it is the same beat and should stay parallel in every locale.

---

## 7. Files changed

**Modified:** `src/engine/types.ts`, `src/engine/analyze.ts`, `src/game/storage.ts`,
`src/content/en/copy.ts`, `src/ui/screens/Lab.tsx`, `src/ui/screens/Lab.css`,
`src/ui/screens/Briefing.tsx`, `src/ui/screens/Briefing.css`,
`src/ui/components/CoefPlot.tsx`, `src/ui/components/CoefPlot.css`,
`src/ui/components/PValueDial.tsx`, `src/ui/components/PValueDial.css`,
`src/ui/components/RadioGroup.tsx`, `src/ui/components/RadioGroup.css`,
`src/ui/components/SpecControls.tsx`,
`tests/engine/analyze.test.ts`, `tests/engine/protocol.test.ts`,
`tests/ui/lab.test.tsx`, `tests/ui/briefing.test.tsx`

**Created:** `src/ui/components/DataCut.tsx`, `src/ui/components/DataCut.css`,
`src/ui/charts/useContainerWidth.ts`, `tests/ui/dataCut.test.tsx`

`src/engine/worker.ts` needed no change — it is a thin shim over `handleRequest`, and the new field
rides the existing `PathResult` across the wire.

**`store.ts` and `Summary.tsx` were NOT touched** (T30 owns them). `PathResult.cut` reaches the UI
with no store change at all: `Lab.tsx` reads `result?.cut ?? null` from the existing `result`
selector.

---

## 8. DESIGN.md compliance

Tier-C greps, run after the final commit:
- `border:\s` · `z-index:\s*[0-9]` · `<select` · non-768px `@media (min-width:` ·
  `transition: all` — **all five print nothing** (the one `<select` hit is the word inside a
  comment in `SpecControls.tsx`, pre-existing).
- `(transition|animation):` — still exactly four hits, all pre-existing (Stamp ×2, PValueDial tick,
  Reveal fade). **This work adds no fifth animation.**
- `var(--sig-red)` — unchanged; **none in the Lab** (R1.8's explicit "don't").
- `:\s*[0-9.]+px` outside `tokens.css` — unchanged set; every one is a 1px hairline, a 2px
  selection underline, a 2px underline offset, or the 768px breakpoint. **My new CSS contributes
  zero raw px:** every size, space, radius and colour comes from a token.

Tier-A (`tests/ui/tokens.test.ts`) passes, which is what proves no hex/rgb/named colour/`color-mix`
/`outline: none` entered the four new or fifteen modified files.

Rule-by-rule on the new figure: R1.1 (no surface but `--paper`), R1.2 (`--ink` marks, `--muted`
captions and excluded marks — no faded ink anywhere), R1.4 (the baseline is a `--rule` hairline),
R2.1/R2.4 (mono + tabular on the legend's counts, UI face on the words), R3.1 (all spacing from the
scale), R4.1 (**no fill anywhere** — the product's one filled area stays the reveal's significance
band), R4.5 (the goal strip and the intro use two edges, never four), R5.5 (nothing animates),
R6.1 (focus ring on the new `<summary>` and the dismiss button), R6.3 (excluded marks are muted
**and** hollow **and** crossed — three signals, none of them hue alone), R8.3 (the figure is quiet:
1.5px dots, hairline axis, `--muted` legend — the dial is still the only thing asking to be looked
at first).

---

## 9. Self-review — do the columns read? Do exclusions bite?

Yes to both, and I have the frames. At 660 the two clouds separate instantly under their labels,
and clicking `|z| > 2` makes 14 crossed marks appear at the tails while p moves 0.383 → 0.155 and
n moves 200 → 186. The excluded marks land where outliers actually are — the sparse top and bottom
of the column — so they never fight the cloud for space; that is a property of the data, not of the
layout, and it is what makes the figure work at 200 points per column.

Three things I changed *because* of looking rather than because a test failed: the mean-bar length
(c), the mobile sticky pane (§4), and the excluded-mark size (`--dot-explored` rather than
`--dot-all`, so the surgery outweighs the cloud).

---

## 10. Concerns / notes for the controller

1. **The mobile sticky change (§4) is the one thing I'd want a second opinion on.** It is a
   correctness fix — the knobs were unreachable — but it costs the live dial on a phone. The
   proper fix (dial alone sticky, as a direct child of `.ph-lab`) touches the ≥768px two-pane rule,
   so I left it.
2. **`storage.ts` is shared with T30.** My change is `PersistedSettings` (the type, near the top)
   plus one line in `pickValidSettings`. T30 adds `saveAchievements` near the bottom. Different
   regions, but the merge is worth watching.
3. **`copy.ts` will conflict if T30 also adds keys.** Mine are in three contiguous blocks
   (`lab.*` union + values, `briefing.goal`, `a11y.dataCut`).
4. **Pre-existing, not mine, but visible in `lab-1088.png`:** at 1088 the dial numeral
   `p = 0.588` wraps to two lines, because `--text-dial` clamps at 96px while the two-pane results
   column is only ~500px. R2.5 pins that clamp, so changing it is a law change and out of scope —
   flagging it because it is now easier to see with a caption underneath.
5. **`SpecCurve.tsx` still holds its own copy of the container-tracking effect** that
   `charts/useContainerWidth.ts` now generalises. Deliberate (outside this task's file set); a
   one-line follow-up whenever someone else is in that file.
6. **`cut` is always attached, not opt-in.** Cheap on the only path that calls `runSpec` (one knob
   turn), and free on the reveal because `specGrid` does not call `runSpec`. If a future caller
   ever runs `runSpec` in bulk, that is the moment to add an options flag — noted at the call site.

---

## 11. FIX ROUND (review findings) — this session

**Setup:** existing worktree `agent-aa3e3ed1ad792e9a9`, no reset, no new branch. Started at
`0bd846f` (this file's own §1–§10 above), verified via `git log --oneline -2` before any edit.
**New commit:** `d495236cc211098e5330af3267df66f759e6187a` (`fix: T31 review round — tie-collapsed
jitter, dial caption, figure pixels, Legend pointer`). **Final SHA: `d495236`.**

The prior implementer's session was lost to a power-off; this section is written from scratch
against the review's four findings, using §1–§10 above as the only record of what was built and
why. Files touched this round: `src/ui/components/DataCut.tsx`, `src/content/en/copy.ts`,
`src/ui/screens/Lab.tsx`, `tests/ui/dataCut.test.tsx`, `tests/ui/lab.test.tsx` — no other file.

### Finding 1 (CRITICAL) — tie-collapsed jitter

**Diagnosis confirmed.** `jitterUnit(value)` hashed the value alone. Outcomes 2 (count) and 3
(1–10 bounded scale) have only 8–10 distinct integer values in their entire range; at n=200 that is
20+ points sharing one value, and value-only seeding put every one of them at the exact same
`(x, y)` — a column of 200 rendered as a handful of visually distinct dots while the legend still
(correctly) said 200.

**Fix (the review's pinned minimal shape).** `jitterUnit` now takes an optional `occurrence`
parameter (default 0) and hashes `` `${value.toFixed(6)}#${occurrence}` ``. `placeCut` computes it
via a `Map<string, number>` keyed `` `${column}|${value.toFixed(6)}` ``, walked in the function's
own existing paint order (`control → treated → excludedControl → excludedTreated`) — exactly the
brief's pin, adapted to a per-column key (needed so control's and treated's counters don't collide)
rather than a bare value key. Value stays the *primary* seed — the prior implementer's
value-over-index deviation was adjudicated correct in the original review and is untouched;
`occurrence` is purely a same-value tiebreaker. A continuous outcome never ties, so its `occurrence`
is always 0 and `jitterUnit(v, 0)` is definitionally identical in shape to the old `jitterUnit(v)` —
a strict extension, not a behaviour change, for every pre-existing test.

**Why this is stable across an exclusion-knob turn (the property that mattered for finding 1's own
"don't revert to index-seeding" constraint).** Two points with the exact same *transformed* value
have the exact same z-score, so an exclusion threshold always keeps or drops an entire tied group
together — it can never split it unevenly. A surviving member's occurrence count therefore never
shifts when the knob moves, for the same underlying reason value-keying itself doesn't reshuffle.

**Tests.**
- `tests/ui/dataCut.test.tsx`, new describe block `DataCut tie-collapsed jitter regression (T31 fix
  round, finding 1)`: `it.each` over outcome 2 (count, seed 20260804) and outcome 3 (1–10 scale, seed
  20260805), built from the **real DGP** (`generateDataset` + `runSpec`, not a hand fixture) at
  n=400. Asserts (a) `analysedCount > 50` (sanity: this really exercises the many-ties case), (b)
  rendered `[data-role="cut-dot"]` count equals the analysed count (the literal ask), and (c) the
  count of **distinct** `(cx, cy)` string pairs among those marks also equals the analysed count —
  the actual regression pin: pre-fix, tied values collapsed onto identical coordinates and this
  assertion would fail.
- A restated `leaves the continuous-outcome stable-x guarantee untouched` test, identical in
  substance to the pre-existing "KEEPS A POINT'S X..." test (which itself was left completely
  unmodified and still passes) — documents that the fix is additive.

**RED → GREEN (genuine transcript).** Implementation was written and committed first this round
(pre-existing time pressure), which meant the first `vitest` run of the new tests was already GREEN
against the fixed code — not an honest RED/GREEN pair. To produce a real one, `src/ui/components
/DataCut.tsx` was temporarily overwritten with `git show 0bd846f:src/ui/components/DataCut.tsx`
(the exact pre-fix version, byte for byte — confirmed via `git diff --stat` before and after), the
new test file run against it unmodified, then the working tree restored from the post-fix copy and
re-verified `git status`/`git diff` clean against the commit before continuing. Genuine RED, against
the real pre-fix `jitterUnit(value)`/unmodified `placeCut`, real DGP, n=400:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/dataCut.test.tsx
 ❯ tests/ui/dataCut.test.tsx (39 tests | 4 failed) 152ms
     × renders one visually distinguishable mark per analysed point for outcome 2 (real DGP) 33ms
     × renders one visually distinguishable mark per analysed point for outcome 3 (real DGP) 22ms
     × caps the jitter band at 64px, however wide the container gets 0ms
     × gives the plot more vertical room than the pre-fix 72px, while staying under the dial 0ms

 FAIL  tests/ui/dataCut.test.tsx > DataCut tie-collapsed jitter regression (T31 fix round, finding 1) > renders one visually distinguishable mark per analysed point for outcome 2 (real DGP)
AssertionError: expected 19 to be 400 // Object.is equality
 FAIL  tests/ui/dataCut.test.tsx > DataCut tie-collapsed jitter regression (T31 fix round, finding 1) > renders one visually distinguishable mark per analysed point for outcome 3 (real DGP)
AssertionError: expected 18 to be 400 // Object.is equality
 FAIL  tests/ui/dataCut.test.tsx > DataCut scale invariance > caps the jitter band at 64px, however wide the container gets
AssertionError: expected 304 to be less than or equal to 64
 FAIL  tests/ui/dataCut.test.tsx > DataCut scale invariance > gives the plot more vertical room than the pre-fix 72px, while staying under the dial
AssertionError: expected 72 to be greater than 72

 Test Files  1 failed (1)
      Tests  4 failed | 35 passed (39)
```
400 analysed points, **19** and **18** distinct rendered positions respectively — almost exactly the
review's own description of the bug ("~200 points render as ~9 dots") at double the sample size.
After restoring the fixed file (verified byte-identical to the committed version via `git diff` —
clean):
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/dataCut.test.tsx
 Test Files  1 passed (1)
      Tests  39 passed (39)
```

**Live-app corroboration (not just unit tests).** Drove the real built app (`npm run build` +
`vite preview`) in real headless Chrome over CDP (raw WebSocket RPC, Node 25's native
`fetch`/`WebSocket`, no puppeteer/playwright dependency added), landed on the Lab, switched the
Outcome control to the 1–10-scale outcome, and queried the live DOM directly:
```
$ node verify_live.mjs
{"totalDots":200,"distinctPositions":200,"byGroup":{"control":106,"treated":94},"url":"http://localhost:4173/"}
```
200 analysed points, 200 distinct rendered positions, in the actual production build — not a jsdom
approximation. Visible in `task-T31-shots/datacut-660-fix-zoom.png`: same-value rows visibly fan
out across the jitter band instead of stacking as single points.

### Finding 2 (IMPORTANT) — dial caption inverted

**Diagnosis confirmed.** The old copy — "how surprising your result would be if nothing were really
going on... Get it below 0.05" — reads as if a *large* number is the alarming one; backwards. A
*small* p is what makes a result hard to dismiss as luck.

**Fix.** `src/content/en/copy.ts`'s `lab.dialCaption` value replaced verbatim with the brief's
pinned text: *"This number is how often plain luck alone would produce a result like yours. The
smaller it is, the harder your result is to dismiss as luck — below 0.05 and you can publish."* No
key change (same `CopyKey` member), so no roster churn for T19/T20 beyond re-translating this one
value once it's built — flagged here for that reason instead.

**Tests.** The pre-existing `tests/ui/lab.test.tsx` assertions (`describe('PValueDial caption
(T31)...')`) were **not modified** and still pass unmodified against the new text:
`expect(enCopy['lab.dialCaption']).toMatch(/0\.05/)` and the no-jargon regex both hold for the new
wording. Confirmed live in `task-T31-shots/lab-660-fix.png`'s dial caption line.

### Finding 3 (IMPORTANT) — figure pixels on the informationless axis

**Fix.** In `src/ui/components/DataCut.tsx`:
- `cutGeometryFor`'s `jitterSpread` is now `Math.min(Math.max(1, columnWidth - CUT_MARK_INSET * 2),
  64)` — capped at 64px regardless of how wide the container gets.
- `CUT_PLOT_HEIGHT` raised `72 → 88` (SVG height `76 → 92`, still under the `--text-dial` 96px
  ceiling R8.3 pins).

**Tests** (`tests/ui/dataCut.test.tsx`, `DataCut scale invariance` describe block): `caps the jitter
band at 64px, however wide the container gets` (checked at 660/1088/1600/`CUT_MAX_WIDTH`=2048) and
`gives the plot more vertical room than the pre-fix 72px, while staying under the dial`
(`plotHeight > 72` and `height <= 96`).

**Re-screenshot at 660px, real app, real headless Chrome.** Forced the *layout* viewport (not
window size) to 660 via `Emulation.setDeviceMetricsOverride` — the mechanism the original report
found necessary to sidestep headless Chrome's window-width clamping — and issued
`Storage.clearDataForOrigin` before each navigation so the PWA service worker never served a stale
build. Practice mode (pre-EPOCH) reseeds `Math.random`-based per page load (`src/game/daily.ts`'s
`practiceSeed()`), so this is a *sampling* problem, not a scripting one: DEFAULT_SPEC studies
outcome 0 (heavy-tailed), whose auto-fit domain intentionally spans the excluded outliers too and
is therefore wide enough that even a real effect shows only a few px of mean separation at this
figure's scale — a property of that outcome family's shape, not of the geometry fix. Looped real
navigations (up to 20), each time switching the Outcome control to the count or 1–10-scale outcome
(bounded, much narrower domain — a real effect there is a much larger *fraction* of the plot
height), measuring the two `[data-role="cut-mean"]` `y1` values' gap in the live DOM, and keeping
the best real capture seen (screenshotted immediately whenever a new best appeared, so every saved
file is a real render, not a composite). Condensed from the real run's stdout (full log had 20
lines, one per attempt; `...` elides attempts that didn't beat the running best):
```
attempt 1: outcome=2 scenario="Owns a backyard telescope" dots=200 meanGapPx=0.23
  -> new best (0.23px), saved
attempt 3: outcome=2 scenario="Owns a label maker" dots=200 meanGapPx=2.91
  -> new best (2.91px), saved
attempt 6: outcome=3 scenario="Keeps a sourdough starter" dots=200 meanGapPx=3.12
  -> new best (3.12px), saved
attempt 12: outcome=3 scenario="Folds their socks" dots=200 meanGapPx=5.54
  -> new best (5.54px), saved
...
FINAL best: {"ys":[47.78,42.24],"label":"Folds their socks","dots":200,"outcomeIdx":3} gapPx= 5.54
```
Saved as `task-T31-shots/lab-660-fix.png` (full Lab, dial p=0.007/significant, "Folds their socks"
day) and `task-T31-shots/datacut-660-fix-zoom.png` (3× clip of just the figure). In the zoom, the
two group-mean bars sit at visibly different heights and each tied-value row fans out across the
(now-capped) jitter band — findings 1 and 3 are both visible in the same real capture. Every number
above is a real measurement of a real render; none of it is synthesized.

### Finding 4 (RESTORED REQUIREMENT) — Legend pointer

**Fix.** New copy key `lab.forkTrailHint` (added to the `CopyKey` union and the catalog value:
*"Each symbol is a move you made — the Legend page has the key."*), rendered as a `<p
className="ph-lab__footnote" data-testid="lab-fork-trail-hint">` immediately after `<ForkTrail
.../>` in `src/ui/screens/Lab.tsx`. Deliberately reuses `.ph-lab__footnote`'s existing `--muted`/
`--text-13` styling rather than adding a new CSS rule — zero new Tier-A/B/C surface, and R8.3-quiet
by construction (identical to the two peek footnotes already living in that slot).

**Tests** (`tests/ui/lab.test.tsx`, new describe `Lab fork trail Legend pointer (T31 fix round,
finding 4)`): renders the exact copy-catalog string and that it names "Legend"; and that it sits
**after** the fork trail in the DOM (not before). Visible in `task-T31-shots/lab-660-fix.png`,
directly under "FORKS SO FAR".

### Subsumed-welcome items

- **Done** (already in the copy.ts lines this round was editing for findings 2/4):
  `lab.explain.outcome` → *"Which of the four things you measured this analysis tries to
  explain."*; `lab.explain.covariates` → *"Also account for background differences between people
  when comparing the two groups."* Both re-checked against the existing sincere-register regex test
  in `tests/ui/lab.test.tsx` (no hedging words) — still passes.
- **Not done, and why:** tap-target padding on the intro `<summary>`/dismiss button, and the "Got
  it" button's `2px transparent border-block-end` affordance (`Lab.css`). None of this round's four
  findings touches `Lab.css` or those specific elements, so per the brief's own "only if you're
  already in those lines" scoping, this was left for whichever task next opens that file.

### Copy-key roster note for T19/T20 (update to §6 above)

§6's table of 21 keys is otherwise unchanged and still accurate for what it enumerates. This round:
- Added **one new key**: `lab.forkTrailHint` (22nd key for the roster; plain, no interpolation
  tokens; sincere register).
- **Changed the VALUE, not the key**, of three already-rostered keys: `lab.dialCaption`,
  `lab.explain.outcome`, `lab.explain.covariates`. Translators working from the pre-fix-round
  English text should re-pull these three before translating — the `CopyKey` type itself is
  unaffected, so `tsc` gives no signal that the source text moved.

### Full gate (this round, genuine output)

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/dataCut.test.tsx
 Test Files  1 passed (1)
      Tests  39 passed (39)

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/lab.test.tsx
 Test Files  1 passed (1)
      Tests  63 passed (63)

$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  43 passed (43)
      Tests  1007 passed (1007)

$ PATH="/usr/bin:$PATH" npm run typecheck   # tsc --noEmit
(exit 0, no output)

$ PATH="/usr/bin:$PATH" npm run lint        # eslint .
(exit 0, no output)

$ PATH="/usr/bin:$PATH" npm run build       # vite build
✓ built in 182ms
(PWA precache: 9 entries, 346.59 KiB)
```
1007 vs. the pre-round baseline's 1000. Verified exactly, not by arithmetic on the file diffs alone:
spun up a disposable `git worktree add --detach <scratch> 0bd846f` and ran each affected file there.
`dataCut.test.tsx` baseline was **34** (not the 33 §2 states above — that earlier number appears to
have been counted before this file's very last pre-existing test was added, or was simply imprecise;
not investigated further, as it doesn't affect anything this round), this round's file is **39**
(+5: one `it.each` covering 2 outcomes plus 3 individual assertions). `lab.test.tsx` baseline was
**61**, this round's is **63** (+2). `5 + 2 = 7`, matching the full-suite delta exactly — the
worktree-verified baseline reconciles cleanly, unlike a same-session before/after comparison would
have (this session never ran the un-fixed test files against a genuine unmodified baseline in one
sitting; the disposable worktree is what makes the count trustworthy).

**DESIGN.md tier-C greps, re-run after this round's commit** — all five still print nothing, and the
three enumerating greps still map to exactly the pre-existing closed lists (no new hit from any file
touched this round; `DataCut.css` was not modified, so no new raw px/animation/z-index/border/select
was even possible):
```
grep -rnE 'border:\s' src/ui                                   # (nothing)
grep -rnE '\bz-index:\s*[0-9]' src/ui                           # (nothing)
grep -rn '<select' src/ui                                       # comment only, pre-existing
grep -rnE '@media \(min-width:' src/ui | grep -v '768px'        # (nothing)
grep -rn 'transition: all' src/ui                                # (nothing)
grep -rn 'var(--sig-red)' src/ui                                 # unchanged 9 hits, all pre-existing
grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css             # unchanged set, all 2px/768px
```

### Concerns for the controller

1. **Finding 3's screenshot demo required sampling multiple real practice-mode days** (up to 20
   navigations) to find one with a large enough real effect to make the mean-separation visually
   obvious at a glance — DEFAULT_SPEC's own outcome (0, heavy-tailed) rarely shows much separation
   regardless of the geometry fix, because its auto-fit domain (deliberately, per design decision
   (d) in §3 above) stretches to include excluded outliers. This is a property of that outcome
   family's shape and the domain-fitting decision, not a defect in this round's fix — flagging it
   only because a reviewer reproducing the shot by hand may need several reloads before landing on
   an equally clear day.
2. **`lab.forkTrailHint` reuses `.ph-lab__footnote`'s CSS class** rather than getting its own. This
   is correct today (identical visual requirement to the two peek footnotes), but if a future task
   ever wants a *different* look for the peek footnotes specifically, this hint would move with
   them unless split out first.
3. Everything else from §10 above (the mobile-sticky flag, the `storage.ts`/`copy.ts` merge notes,
   the `--text-dial` two-line wrap at 1088px, `SpecCurve.tsx`'s un-generalised container effect)
   is unchanged by this round and still stands as written.
