# Task T16 report — THE CALL, THE REVEAL, and the SPECIFICATION CURVE

**Branch:** `worktree-agent-a2c388df04bcaf679` · **Base:** `8035462` · **Final SHA:** `58f2633`
**Commits:** 1 — `feat: the call, the reveal, and the specification curve (figs 1+2)`
**Gate:** `typecheck` ✓ · `lint` ✓ (zero warnings) · `build` ✓ · `vitest run` ✓ **617 passed / 27 files**
(67 of them new: speccurve 29, reveal 28, call 10)

---

## 1. What shipped

| File | Lines | What |
|---|---|---|
| `src/ui/charts/SpecCurve.tsx` | 424 | The centerpiece: custom SVG, render-once, both figures |
| `src/ui/charts/SpecCurve.css` | 179 | Figure styling, radii straight off the `--dot-*` tokens |
| `src/ui/screens/Reveal.tsx` | 300 | §2.7's six blocks, in order |
| `src/ui/screens/Reveal.css` | 152 | Act II typography, scroll fades, the stamp beat |
| `src/ui/screens/Call.tsx` | 108 | §2.6, container-agnostic |
| `src/ui/screens/Call.css` | 96 | Two large hairline-ruled option blocks |
| `src/ui/screens/registry.t16.patch.md` | — | The two replacement lines for T14's registry |
| `tests/ui/{speccurve,reveal,call}.test.tsx` | 690 | RED-first; all three verified failing before GREEN |
| `src/content/en/copy.ts` | +9 changed / +26 added keys | see §5 |

TDD was followed: all three test files were written first and confirmed failing
(`Failed to resolve import "../../src/ui/charts/SpecCurve"` ×3) before any
component existed.

---

## 2. The specification curve (§7.4)

**Y mapping**, exactly as pinned, exported as `curveY(p, height)` so it is
testable by value: `f(p) = p<=0.10 ? (p/0.10)*0.60 : 0.60+((p-0.10)/0.90)*0.40`,
`y = H·(1−f)`. p = 0 on the floor, the zoom seam at 40% from the top, the .05
threshold at exactly 70% height. A monotonicity test walks the seam
(0.0999 → 0.1 → 0.1001) so a future "simplification" of the piecewise form
cannot pass silently.

**X.** Rank by p ascending, ties broken by original index so the layout is a
pure function of the payload. Grouped mode: four outcome bands with a 12-unit
gap, sorted within each.

**Points.** Base `r 1.5 --rule`, explored `r 4 --ink`, published `r 6 --sig-red`
**plus a ring** at `calc(var(--dot-published) + var(--space-4))` — R6.3's shape
pairing, asserted by a test that the ring shares the dot's exact centre. Radii
are set through the CSS `r` geometry property so the `--dot-*` tokens are read
rather than retyped; **verified rendering correctly in real Chrome** (see §4).

**Interaction.** One transparent overlay `<rect>` owns the pointer for all 1,792
points and resolves the nearest one arithmetically (`nearestIndex`, unit-tested
independently). That is a ~11 CSS px hit target in every direction, past the 8px
floor, with **no per-point handler and no re-layout on hover** — the tooltip is
an absolutely-positioned HTML overlay. Tooltip carries the localized recipe plus
`p = 0.041` (`p < 0.001` below .001, never a misleading `0.000`).

**Leader + callout** render in fig. 1 only. Rationale: the point cloud rises
monotonically, so fig. 1's upper-left is *guaranteed* empty and the callout can
live there without measurement. Fig. 2's four rising bands have no such corner,
and its subject is clustering rather than one path, so there the published point
keeps its ring and the callout stands down. Tooltips still work on every point in
both figures. **Flagging as the one judgement call inside §7.4 that the brief did
not pin.**

**Omitted-path footnote** is rendered by `Reveal` (which holds `totalPaths`), not
by `SpecCurve` — that keeps the pinned four-prop interface exactly as specified
rather than growing an `omitted` prop.

---

## 3. Truth-line readability, per outcome family (requested)

`RevealPayload.trueBeta` is the injected effect in **raw outcome units**. The
template puts the unit on the *outcome*, not trailing the number:

> `True effect on {outcome} ({unit}): β = {beta} — and only that outcome.`

That ordering is the whole finding of this assessment. Trailing the number —
`β = 0.37 1–10 scale` — garbles on the entire Y3 family; parenthesised after the
label it reads as an ordinary results-table row on all four. Real lines, from
real generated days across four months:

| Family | Real rendered line | Reads |
|---|---|---|
| **Y0** heavy-tailed | `True effect on Overrun past the scheduled end (minutes): β = 0.37 — and only that outcome.` | **Best.** Natural units, natural sentence. |
| **Y1** skewed | `True effect on Longest silence held after a counteroffer (seconds): β = 0.18 — and only that outcome.` | **Best.** |
| **Y2** count | `True effect on Concessions extracted per negotiation (concessions/negotiation): β = 0.34 …` | **Mildly redundant** — see concern C1. |
| **Y3** bounded 1–10 | `True effect on Self-rated sense of being taken seriously (1–10 scale): β = 0.37 — and only that outcome.` | **Good**, and only because the unit is parenthesised. |
| **null** | `True effect on every outcome measured: 0.000.` | Exact, and `0.000` is code-generated so a translator cannot typo it. |

**Magnitudes are not absurd anywhere.** Sampled across 112 days, every family's
`trueBeta` lands in **0.13 – 0.41** — the DGP's four outcome columns all have
sd ≈ 1–1.5 and `d ∈ [0.18, 0.30]`, so the raw-unit coefficient stays the same
order as the master spec's illustrative `β = 0.24`. Two significant figures is
the right precision for that whole range; `formatSigFigs` is unit-tested at
0.0043 / 0.35 / 1.4 / 14 / 1400 / −0.35 / 0 to prove it never emits an exponent.

---

## 4. Self-review: sitting with fig. 1 and fig. 2

I rendered both figures with **real enumerated curves** (`generateDay` →
`enumerateCurve` → `buildRevealMetrics`, a 14-path player walk, one published
significant path) and screenshotted them in headless Chrome, light and dark.
This also proved the CSS-`r`-geometry-property gamble works in a real browser,
which jsdom cannot tell you.

**Is the player's path visible at a glance?** Yes, immediately — the red dot with
its ring is the only saturated thing in the frame, and the leader line names its
recipe in full without a hover. Two real defects were found this way and fixed
before commit:

1. **The published point sat *on* the y-axis.** Publication requires p < .05, so
   the published path is almost always rank ~0 and landed exactly on the axis,
   its ring overlapping the `0.00` tick. Fixed with a 12-unit `plotInset` on both
   ends of every x-range (`SPEC_CURVE_GEOM.plotInset`).
2. **Band labels truncated with an ellipsis.** "Annualized excess return over the
   benchmark" became "Annualized excess return over the…". Fixed by allowing
   three wrapped lines (`padBottomGrouped` 44 → 56); measured against all 80
   shipped outcome labels, 3 lines × 22 chars covers every one of them.

**Does the grouped view teach clustering without reading a word?** Yes, and it is
the strongest thing in the task. Side by side:

* **Effect day** (2026-09-06, true outcome Y1): one band dives in a dense mass to
  the floor; the others graze the threshold thinly.
* **Null day** (2026-09-02): four bands, four thin dribbles of hits, no mass
  anywhere. Nothing clusters — which is the same lesson read from the other side,
  and is why fig. 2 renders on null days too (see §6, decision D1).
* **The teaching case** (2026-09-22, true outcome Y3, published on Y0): the red
  ring sits in a *thin* band while the dense cluster is three bands away. That is
  §2.7.4's "you can fabricate a false positive on a true-effect day", visible
  without a sentence.

Dark theme checked: tokens flip, the band tint stays legible, the ring still
carries the shape. R7.2 holds with no dark-only rule.

---

## 5. Copy keys — every addition and change (T19/T20 depend on this)

**9 CHANGED** (all had placeholder values that did not match §2.6/§2.7's pinned copy):

| Key | Was | Now |
|---|---|---|
| `call.real` | `Real` | `A real effect` |
| `call.noise` | `Noise` | `Noise I dressed up` |
| `call.prompt` | `Is this a genuine effect…?` | `Between us: what do you think you found?` (§2.6 verbatim) |
| `reveal.truthNull` | `The true effect was zero.` | `True effect on every outcome measured: {beta}.` |
| `reveal.truthEffect` | `The true effect was real.` | `True effect on {outcome} ({unit}): β = {beta} — and only that outcome.` |
| `reveal.groupedCaption` | `Paths grouped by analytical choice.` | `Real effects cluster. Noise scatters.` (§7.3 verbatim) |
| `reveal.accounting1` | `{viewed}/{total}` | `Of {total} possible analyses, {sig} ({sigPct}%) reach p < .05 by chance alone.` |
| `reveal.accounting2` | `{sigFraction}%…` | `You explored {k} paths before publishing.` |
| `reveal.accounting3` | `ranked #{rank}` | `A researcher exploring {k} paths at random finds at least one "significant" result about {pHitPct}% of the time.` |
| `reveal.peekSurcharge` | `{peeks} extra batches…` | `Your {peeks} data-peeks make the true number of analyses roughly {mult}× larger than this curve shows.` |

*(That table is 10 rows because `peekSurcharge`'s params changed too; 9 of the
10 also changed their param **names**, so no existing translation could survive
regardless.)*

**Param changes against the controller's pinned list:** `reveal.truthEffect`
gained `{unit}` (as directed) **and** `reveal.accounting3` gained `{k}` — the
sentence names the path count as well as the probability ("A researcher
exploring **14** paths… **52%** of the time"), which the pinned `{pHitPct}`-only
list does not admit. Flagging explicitly.

**26 ADDED:**

* Call: `call.realSub`, `call.noiseSub`
* Accounting: `reveal.accounting2Abandoned` (the abandon path did not publish, so
  accounting2's verb would have been a lie)
* Figures: `reveal.fig1`, `reveal.fig2`, `reveal.omittedFootnote`
* Notation (translate nothing, keep the digits): `reveal.pValue`, `reveal.pValueTiny`
* Recipe vocabulary, 18 keys: `reveal.subgroup{All,AgeLt40,AgeGe40,ExpHigh,ExpLow,Urban,Rural}`,
  `reveal.cov{None,Income,Risk}`, `reveal.exclusion{None,Z3,Z25,Z2}`,
  `reveal.transform{Raw,Log}`, `reveal.tails{Two,One}`

**Reused, not duplicated:** `legend.significant` is the threshold rule's label,
`legend.{unexplored,explored,published}` are the figure legend, `briefing.vol` is
the cover echo's masthead line, `a11y.specCurveChart` is the SVG's accessible
name, `reveal.{retracted,replicated,nullReported,callCorrect,callIncorrect}`
unchanged.

---

## 6. Decisions the brief left open

* **D1 — fig. 2 renders on null days too.** §7.3 says "(effect days)", but §2.7.6
  is explicit and more specific: *"Null days show the same view: hits scattered
  thinly everywhere."* The contrast is the teaching, so it must be present on the
  days with nothing to cluster. The screenshots in §4 are the argument.
* **D2 — the callout is fig. 1 only** (rationale in §2).
* **D3 — the recipe vocabulary lives under `reveal.*`, not `spec.*`/`lab.*`.**
  §7.4's callout wants *compact* forms (`Age<40`, `|z|>2.5`, `log`) that differ
  from the readable forms T14's segmented buttons will want (`Age < 40`), and the
  namespace split removes any chance of a duplicate-key merge conflict with T14.
  If the controller would rather consolidate at merge, these 18 keys are the ones
  to look at — but they are genuinely different strings, not the same string twice.
* **D4 — no thousands separator.** `1792`, not `1,792`. A comma is a *decimal*
  separator in Italian and Spanish, and `Intl` grouping would need the locale
  threaded into the figure. Locale-invariant digits, per `about.decimalNote`'s
  spirit. Tested (`not.toContain('1,792')`).
* **D5 — `--sig-red` in the accounting is spent on `{sig}` and `{sigPct}` only.**
  R1.3's fourth place is "the Act II accounting figures for p < .05", read
  literally as the count and fraction *of paths reaching p < .05*. `{pHitPct}`
  ("~52%") is arguably the punchline but is a probability, not a p < .05 count,
  so it stays `--ink`. A test pins the exact set to `['87', '4.9']`.
* **D6 — the cover echo is built from store state only** (scenario question +
  `briefing.vol`), with zero dependency on T15's `JournalCover`.

---

## 7. Concerns

* **C1 (content, low)** — Y2's outcome *labels* often restate their unit:
  "Concessions extracted per negotiation (concessions/negotiation)". Harmless but
  clumsy; a content pass could shorten the Y2 units to bare nouns
  (`concessions`) since the label already carries the rate.
* **C2 (content, low)** — `Defect-free code shipped per release (thousand lines):
  β = 0.35` invites a "a third of a line?" double-take. Y0 units that are
  *multiples* (`thousand lines`, `€ thousands`) read worse at these magnitudes
  than plain ones would.
* **C3 (a11y, medium)** — the hover tooltip is pointer-only. 1,792 focusable
  points is not an option, so keyboard/SR users get the figure's `aria-label`,
  the always-visible published callout, and the full accounting in text — every
  *number* the figure encodes is present as prose (asserted by a test). If a
  keyboard path into the curve is wanted, it is a v1.1 feature (arrow-key
  traversal along the rank axis), not a patch.
* **C4 (cross-task)** — DESIGN.md R4.2's worked example spells the Call's
  backdrop as an inline `color-mix()`, which R1.3a **forbids** outside
  `tokens.css` and `tests/ui/tokens.test.ts` enforces mechanically. T16 renders
  no backdrop (the container owns it), so this did not block — but whoever builds
  the overlay needs a registered `--scrim`-style token in `tokens.css` **and** a
  DESIGN.md §0 row first. Written into `registry.t16.patch.md` so it cannot be
  missed at merge.
* **C5 (lint, low)** — `SpecCurve.tsx` and `Reveal.tsx` each carry a file-level
  `eslint-disable react-refresh/only-export-components`, because both export pure
  helpers (`curveY` — the pinned mapping — `nearestIndex`, `recipeLabel`,
  `formatSigFigs`) that the pinned interfaces and the tests require. Same trade
  and same inline waiver as `src/i18n/LocaleProvider.tsx`'s hook export. Moving
  them to sibling modules would be cleaner but adds files outside the brief's
  pinned list.
* **C6 (browser support, low)** — radii are set via the CSS `r` geometry
  property. Supported in Chrome/Edge/Safari and Firefox ≥72; verified in real
  Chrome (§4). If a target browser ever fails it, the fallback is `r` attributes
  on the circles, at the cost of retyping the `--dot-*` token values in TSX.

---

## 8. DESIGN.md compliance

All five must-be-empty tier-C greps print nothing. The three enumerating greps
map cleanly:

* **R5.5 animations** — 3 hits: my one `transition: opacity var(--dur-fade)`
  (R5.3 scroll fades) plus Stamp's pre-existing two (R5.2's single timeline).
  No fifth animation.
* **R1.3 `--sig-red`** — 9 hits, every one on the closed list: threshold stroke +
  label (place 2), published dot + ring + leader (place 3), `.ph-num--sig`
  (place 4), Stamp ×2 (place 1), `--sig-band` derivation in `tokens.css` (R1.3a).
* **R2.2/R3.1 raw px** — my 2 hits are the single legal breakpoint (`768px`,
  R3.4) and the 2px underline offset (R6.2), both named by the document.

Also honoured: R4.1 (the sig band is the only fill), R4.5 (no four-side border —
the "cards" are hairline-ruled blocks per §0), R4.7 (`--z-stamp`/`--z-overlay`,
no raw z-index), R2.4 (every interpolated numeral is its own mono/tabular span —
which is *why* the accounting interpolates to React nodes instead of a flat
string), R2.8 (`--measure` on all prose), R3.2 (`--space-40` between blocks),
R5.3/R5.6 (opacity-only fades that fail **open**: no `IntersectionObserver`,
reduced motion, or unmounted node all mean *visible now*), R6.1 (`:focus-visible`
rings, no `outline: none`), R8.3 (the figures are plain, muted-captioned, and
nothing on the screen competes with the stamp).

**One deliberate, documented deviation:** the base points fill with `--rule`,
which R1.4 reserves for hairlines. §7.4 pins "all paths as 1.5 px points
(`--rule` color)" by name and DESIGN.md's own precedence clause puts
`implementation_plan §7` above it. Noted in the file header.

---
---

# APPENDIX — Review round 1 fixes

**Commit:** `8f99ff9` — `fix: the figure holds up at 320px, and the abandon path stops claiming a path`
**HEAD:** `8f99ff9` (on top of `58f2633`) · **Branch:** `worktree-agent-a2c388df04bcaf679`

The reviewer's theme was right and worth restating plainly: **the figure landed
on desktop and degraded on the surface most players will use, and my evidence
was gathered at ~660 px — the one width where the scaling artifact is
invisible.** Everything below follows from having looked at it again at 320.

## Gate (full transcripts)

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/speccurve.test.tsx tests/ui/reveal.test.tsx tests/ui/call.test.tsx
 RUN  v4.1.10 /home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a2c388df04bcaf679
 Test Files  3 passed (3)
      Tests  95 passed (95)
   Duration  1.01s

$ PATH="/usr/bin:$PATH" npm test
 Test Files  27 passed (27)
      Tests  645 passed (645)
   Duration  7.16s

$ PATH="/usr/bin:$PATH" npm run typecheck     → tsc --noEmit          (no output, exit 0)
$ PATH="/usr/bin:$PATH" npm run lint          → eslint .              (no output, exit 0)
$ PATH="/usr/bin:$PATH" npm run build         → ✓ built in 102ms
```

Test count 617 → 645 (+28; the three owned suites 67 → 95).

DESIGN.md tier-C greps re-run after the change — all five must-be-empty greps
print nothing; `var(--sig-red)` still enumerates to 9 hits (unchanged set); the
animation grep still returns exactly the three sanctioned entries:

```
$ grep -rnE '\b(transition|animation):' src/ui
src/ui/components/Stamp.css:99:  animation: ph-stamp-shake var(--dur-stamp) var(--ease-stamp) both;
src/ui/components/Stamp.css:103:  animation: ph-stamp-slam var(--dur-stamp) var(--ease-stamp) both;
src/ui/screens/Reveal.css:23:  transition: opacity var(--dur-fade) var(--ease-out);
```

---

## I1 — touch

`onPointerDown` now shares the handler with `onPointerMove`, so a finger that
lands and does not move summons the tooltip. `touch-action` went from `none` to
`pan-y`: the reveal is a scroll sequence, and claiming the whole gesture on a
1,792-point figure meant a finger that landed on it could not scroll the page.
Only horizontal panning is claimed now.

**Test:** `review I1 — summons the tooltip on a stationary tap, not only on a move`.

## I2 — the callout overflowed the plate

Arithmetic, measured rather than asserted:

```
$ node -e "…"
OLD full-label callout: 118 chars -> 844 units vs room 660 OVERFLOWS
NEW compact callout:     65 chars -> 465 units vs room 660 FITS
```

Fixed with §7.4's own device — the worked example abbreviates the outcome for
exactly this reason. `recipeLabel` (full) and `recipeLabelCompact` (`Y₁..Y₄`)
now share a `recipeTail`; the callout takes the compact form and wraps to the
width's real character budget, the tooltip and I5's text line keep full labels.

`Y₁..Y₄` is a module constant, not four copy keys, on the same footing as the
`·` separator and the decimal point: it is notation, identical in every
language, and a copy key would be an invitation to translate it. **1-based to
match the DGP's own Y1..Y4 naming** (§3.2's fixed order), so outcome index 0
prints `Y₁`.

**Tests (3):** the callout equals the compact form and does not contain the
55-character `'Attendee-rated sense that this could have been an email'`; every
rendered `tspan` fits the plate at the worst-case recipe; the full label is
still reachable in the tooltip, so the notation costs nothing.

## I3 — scale invariance

Chosen approach: **the viewBox tracks the container** (ResizeObserver on the
plot wrapper), rather than dividing type by a scale factor. One user unit is
then one CSS pixel at every width, so `font-size: var(--text-13)` really is 13 px
and `hitRadius` really is 12 px — nothing in the file has to compensate, and
`cssPixelsPerUnit` is exactly 1 across the supported range. Below
`FIGURE_MIN_WIDTH` (320) it degrades proportionally rather than going
degenerate; the `FIGURE_MAX_WIDTH` guard (2048) never binds because
`--page-max` caps the reveal's column at 1088.

**The stated division** (as asked): jsdom has no ResizeObserver and every
`getBoundingClientRect` is 0×0, so the *render* cannot be pixel-tested there.
The 9 new unit tests pin the *math* at 320 / 660 / 1088 — one unit is one CSS
pixel; type stays within [11, 13] CSS px; the hit radius stays ≥ 8 CSS px; the
plot lays out exactly inside the container; the four bands sum to the plot
width; the character budgets grow with the figure; sub-floor widths degrade
proportionally. The *pixels* are covered by the browser screenshots below.

**Verified in real Chrome** (headless, React actually running — I bundled the
component with esbuild rather than server-rendering it, because static markup
would never have exercised the ResizeObserver at all):

```
$ google-chrome --headless --window-size=520,1100 --dump-dom live320.html | grep -o 'viewBox="0 0 [0-9]* 352"'
viewBox="0 0 320 352"
$ google-chrome --headless --window-size=1140,1000 --dump-dom live1088.html | grep -o 'viewBox="0 0 [0-9]* 352"'
viewBox="0 0 1073 352"
```

*(Note for anyone repeating this: headless Chrome clamps its window to a 500 px
minimum, so `--window-size=360` silently renders at 453 px. My first attempt at
"360" was that. The screenshots that matter force the container width in CSS
instead.)*

At 320 px, with the longest shipped label substituted into the published
outcome: type legible at 13 px, callout wrapped to two lines and inside the
plate, the ringed published point unmistakable, fig. 2's cluster still readable.
At 1088 px: type still 13 px — not the 19.6 px the old fixed viewBox produced —
and full band labels wrapping to two lines with no collision.

**A second defect the arithmetic had not caught, found by looking at the real
320 px render:** four band labels sharing ~260 px *overlapped each other*
("Attendee-rated" ran into "Concessions"). `wrapLabel` places a word longer than
the budget anyway rather than dropping it, so a narrow band overflowed. Fixed
with the same notation device: `bandLabel()` prints the outcome's name where the
band can hold ~12 characters and `Y₁..Y₄` where it cannot (the crossover is a
~436 px container, i.e. phones get notation, tablets up get names). Honest
degradation rather than overlap, self-consistent with the callout, and the full
label stays one tap away in the tooltip — plus the truth line above names the
true outcome in words. **3 further tests** pin the threshold in both directions.

## I4 — abandon-path honesty

`reveal.curveCaptionAbandoned` added ("…sorted by p-value. **Nothing was
published.**" — passive and factual; the abandon path is the honest play and the
copy should not needle it). The legend's published row is now conditional on the
figure actually containing a published point — a key to a mark that is not there
is a small lie. **4 tests**, both directions for both the caption and the legend.

## I5 — the published recipe as real text

`reveal.publishedRecipe` = `'You published: {recipe}'`, rendered once under the
accounting in **full labels**, only when something was published. This is the
sole AT/keyboard route to §2.7.2's pinned content, since `role="img"` hides the
SVG's internals and the callout now abbreviates. Placed *inside* the accounting
block so §2.7's six-block DOM order is unchanged — asserted, along with the
`.ph-num` sequence being unaffected (it adds no numerals, so R1.3/R2.4's spans
are exactly as before). **4 tests.**

## M6 — registry patch

`registry.t16.patch.md` now states the mount condition in its own headed
section: mount `<Call />` **behind the Published screen's "Face the truth"
action**, not unconditionally — an unconditional mount would put the dialog on
screen the instant the paper is published, stepping on §2.5's celebration. It
also spells out the dialog-role caveat (T16 owns the `role="dialog"`; the
container should set `aria-modal` on it or wrap without a role, not nest a
second dialog) alongside the pre-existing backdrop/`color-mix` note.

## M1 — subsumed, as invited

`wrapLabel` was a dead export; it now carries the callout, the band labels and
the band-label fallback, so it is load-bearing and pinned by 3 tests (greedy
wrap keeps every word; the longest shipped label fits three lines losslessly; an
over-long line is marked with an ellipsis rather than silently truncated).

## Copy keys — delta for T19/T20

**2 added** on top of §5's list, both `reveal.*`:

| Key | Value |
|---|---|
| `reveal.curveCaptionAbandoned` | `Every specification you could have run, sorted by p-value. Nothing was published.` |
| `reveal.publishedRecipe` | `You published: {recipe}` |

Running total for T16: **28 added, 10 changed.** Nothing was removed. `Y₁..Y₄`
is deliberately *not* a copy key (see I2).

## Not touched

The eight ledgered minors, per instruction — except M1, which item 2's callout
work subsumed as invited. The unpinned self-caught items (leader parallel to the
axis, `Fig.` set in a mono span, the hardcoded volume, hover re-render breadth,
truth-line exposure naming, the uppercased sentence) are untouched and still
open.
