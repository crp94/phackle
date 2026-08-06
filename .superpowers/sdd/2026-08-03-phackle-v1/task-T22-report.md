# Task T22 — Accessibility pass

Branch `task-t22`, from `3c1e745`. Gate: `tsc` 0, `eslint` 0, `vitest` 0
(**51 files / 1357 tests**, up from 50/1322), `vite build` 0. Four consecutive
full runs, identical — no flake, no dgp isolation needed.

> **FIX ROUND 1 (review verdict NEEDS FIXES, one Important).** Review found
> **I1**: the Call overlay's focus restore did not work in a real browser, and
> the round-1 report claimed it did on the strength of a check that never
> looked at where focus went. Two lines below are struck through and corrected
> in place rather than rewritten — §1's KB-6 row and §3's KB-6 row. The
> corrected claim is now backed by a CDP measurement of `activeElement`
> itself; see **§10**. Two minor corrections in the same round: the ForkTrail
> comment's row count, and two items carried into the grand-review handoff.

---

Every finding below was **reproduced in real Chrome** (`google-chrome` driven
by `playwright-core`, against `npx vite` on :5199) before it was fixed, and
re-measured after. axe-core 4.12.1 was installed into a scratch project, not
into `package.json` — the repo's dependency list is unchanged.

---

## 1. The keyboard-only play-through (the work order)

Played a full day with the keyboard only, at 1280×900, recording the tab ring,
the computed focus outline at every stop, and `document.activeElement` after
every screen change. **Nine findings**, in the order they were hit:

| # | Where | What happened, keyboard-only | Verdict |
|---|---|---|---|
| KB-1 | every screen change | `document.activeElement` was `<body>` after **all five** of briefing→lab, lab→published, call→reveal, reveal→summary, nav-page→game. `<main>` is keyed, so React removes the focused element with it. | **fixed** (booked b) |
| KB-2 | Lab, after arriving from the Briefing | the first Tab landed on "How to play" — *inside* `<main>* — because the browser's sequential-navigation starting point was left in the removed CTA's position. The whole running header was skipped. | **fixed** by KB-1's fix |
| KB-3 | Lab, turning a knob | dial went `p = 0.087` → `p = 0.570` and **nothing was announced**. `[aria-live], [role=status]` was empty on *every* screen. The core §2.4 loop was inaudible. | **fixed** |
| KB-4 | Reveal | **zero headings of any level**. A screen-reader player arriving at Act II had no title, no landmark and nothing to navigate by. | **fixed** |
| KB-5 | Lab / Summary / Stats / Legend / About / Prereg / Call | first heading on the screen was an `<h2>`; no `<h1>` anywhere. axe `page-has-heading-one` on 6 of them. | **fixed** |
| KB-6 | Published → "Face the truth" | overlay traps Tab between the two cards and **Escape did nothing**. No keyboard exit at all short of committing to a verdict — WCAG 2.1.2. | **fixed in round 1 (exit), completed in fix round 1 (focus restore — see §10)** |
| KB-7 | header | the nav row was a bare `<div>`; no `navigation` landmark on the page. | **fixed** |
| KB-8 | Stats / Legend / About | close button's accessible name was "Close dialog". None of the three is a dialog: no modality, no trap, nothing for Escape to do. | **fixed** |
| KB-9 | Reveal, both figures | fig. 1 and fig. 2 carried the **same** `aria-label`, describing a "sorted" curve — a plain misstatement of fig. 2, which is grouped by outcome. It also claimed "with your published specification highlighted" on the abandon path, where nothing is published. | **fixed** |

Not a defect, confirmed by measurement: focus was visible at **every** stop on
every screen (`solid 2px rgb(28,27,24)`, offset `2px`) — all 13 Lab stops, all
11 Briefing stops, the dial radios, the two call cards, the theme/locale
toggles, the `<summary>` disclosure, the header. No stop anywhere in the game
lacked the design's ring, and no keyboard trap existed other than KB-6.

After the fixes, the same play-through reads: focus lands on `MAIN.ph-screen`
after all five transitions; landmarks are `HEADER, NAV, MAIN`; every screen
reports exactly one `H1`; the Lab reports `DIV live=null role=status` (the
dial); the Legend's button is named "Close"; Escape closes the overlay.

> ~~"...and returns focus to 'Face the truth'."~~ **CORRECTED, fix round 1.**
> This was not measured in round 1 and was not true. The round-1 browser check
> only asserted `overlay after Escape: false` — it never read
> `document.activeElement`, and the restore was in fact a silent no-op (the
> cover was still `inert` when `focus()` was called). Focus went to `<body>`.
> Fixed and *measured* in fix round 1: after Escape, `activeElement` is the
> "Face the truth" CTA at +0ms and +1200ms. Evidence in **§10**.

---

## 2. Booked items — verdicts

### (a) TrailKey popover ARIA pattern — **FIXED as a disclosure**

It shipped as `role="tooltip"` on the panel *plus* `aria-expanded` /
`aria-controls` on the trigger: two patterns at once, and they contradict.
Resolved to a **true disclosure** (`role="tooltip"` removed; the trigger keeps
`aria-expanded` and keeps `aria-controls` only while the panel is rendered),
because the content decides: the key is a seven-row glyph/meaning list
(**corrected, fix round 1** — round 1's comment and this line both said "ten",
which is `DECLARED_ENTRIES` before T29's dedupe collapses the four
spec-change kinds onto one 🍴; counted in the rendered popover: 7, matching
the Legend page's 7), and a
tooltip's accessible description would flatten it into one unpunctuated run
with no way to step through the rows. The panel is now `role="list"` with
`role="listitem"` rows (it must stay `<span>`s — it is inline content inside a
`<p>`, so `<ul>`/`<li>` would be invalid there). Every behaviour T29 pinned —
hover-open, tap-toggle with both touch guards, focus-open, blur-out, Escape —
is unchanged and its existing tests still pass untouched.
Registered as **DESIGN.md R6.7**.

### (b) Focus management on screen change — **FIXED**

Focus went to `<body>` on every transition (KB-1/KB-2 above). `App.tsx` now
focuses the new `<main>` (`tabIndex={-1}`) whenever the screen key changes,
and **not** on the first mount (a fresh load correctly starts at the top of
the document). The transition animation is untouched: the focus call paints
nothing and the entrance keyframe runs on the same element either way; 200%
reflow re-measured clean with the ring live.

One consequence had to be handled rather than ignored. Chrome **does** match
`:focus-visible` on a programmatically focused `tabindex="-1"` container when
the swap was keyboard-driven (verified in isolation: keyboard → `focusVisible:
true`; mouse → `false`). Undeclared, that paints the *user agent's* `outline:
auto`. `.ph-screen:focus-visible` therefore declares R6.1's own ring, at a
**negated** offset — `<main>` is full-bleed, so a ring 2px outside it lands in
the gutter, or at 200% zoom in nothing. Measured after: keyboard swap →
`solid 2px rgb(28,27,24)`, offset `-2px`, no horizontal overflow; real mouse
click → `outline: none`. `outline: none` was never used, so the
outline-suppression scan stays green.

### (c) Reveal's scroll-gated Blocks — **VERIFIED, no bug; documented**

- **Keyboard scrolling triggers them.** Measured: at 1280×700 the reveal
  mounts with `truth/fig1/accounting` entered and `stamp/call/fig2` gated.
  Focus is on `<main>`; pressing **End** (no mouse, no scripted scroll) took
  `scrollY` to 1151 and flipped all three remaining blocks to `--in`.
  IntersectionObserver is input-agnostic, and this confirms it end to end.
- **A screen reader reaches everything before entry.** The gate is `opacity`
  **only**. Measured on un-entered blocks: `display: block`,
  `visibility: visible`, `opacity: 0`, no `aria-hidden`, no `hidden`
  attribute — and the full text of `stamp`, `call` and `fig2` was harvested
  from the DOM before a single pixel had faded in. Nothing is `display:none`'d
  until entry, so there is no bug to fix here.
- Pinned by test (`booked (c)`), which asserts both halves: no block carries
  `aria-hidden`/`hidden` and all six have text, **and** `.ph-fade`'s base rule
  contains `opacity: 0` and none of `display: none` / `visibility: hidden` /
  `content-visibility`. That second half is what stops a future "optimisation"
  from swapping the gate for one that empties the accessibility tree.
- Reduced motion re-verified: all five duration tokens collapse
  (`1ms/1ms/0ms/1ms/0ms`) and all six blocks render at `opacity: 1` with no
  scrolling at all.

### (d) T38's unlock block — **VERIFIED: no live region needed; assumption pinned**

Correct as plain content, for one reason that must stay true: it is in the
screen's **first rendered output**, not inserted into a screen already being
read. `unlocked` is computed once in `SummaryScreen`'s mount effect, before
the presentational half renders anything but its `aria-busy` placeholder, and
nothing afterwards can add to it. With (b) in place, a screen reader is
reading the summary from the top anyway and meets the ceremony in document
order between the invoice and the share button — a live region would announce
it a second time, out of order, on top of that read. The comment in
`Summary.tsx` states exactly the condition that would flip the answer ("if a
future task ever unlocks an achievement while this screen is already on
screen"), and three tests pin the current shape (no live attributes, correct
document position, nothing rendered on an empty day).

### (e) Reveal reading order — **ORDER CORRECT; two labelling gaps fixed**

The accessible text sequence was harvested from the live DOM (aria-hidden
subtrees skipped, `role="img"` collapsed to its label). It tells §2.7's story
in §2.7's order: truth → fig. 1 (+ legend + caption + footnote) → accounting
(three statements, peek surcharge, published recipe) → cover echo → `[img:
RETRACTED]` → call resolution → fig. 2 (+ legend + caption) → "See the
invoice". `data-block` order is exactly
`truth, fig1, accounting, stamp, call, fig2`.

Two gaps, both fixed: the screen had **no heading at all** (KB-4) and the two
figures were **indistinguishable** in the accessible tree (KB-9). Act II's
heading-free *visual* design is untouched — the `<h1>` is the manuscript
question, set in `.ph-visually-hidden` (clip/1px, never `display:none`, which
would defeat the point). Both figures' `<figcaption>` were already correct and
already read; only the `role="img"` names were wrong.

---

## 3. The sweep — findings and fixes

| # | Item | Finding | Fix |
|---|---|---|---|
| 1 | keyboard | focus visible at **every** interactive stop already — radios, DataCut area, theme/locale toggles, nav, `<summary>`, call cards. Press cards are not interactive. | none needed |
| 1 | keyboard | KB-6: Call overlay was a trap with no Escape (WCAG 2.1.2) | Escape closes it; the cover leaves `aria-hidden`/`inert` on the way out; reopening is clean. Store untouched — `callOpen` is local UI state, so no spoiler risk. ~~and returns focus to "Face the truth"~~ — **CORRECTED, fix round 1**: the round-1 restore never worked (review I1); it does now, and is measured. See §10. |
| 2 | semantics | KB-7: no `navigation` landmark | header nav row is now `<nav>`. Exactly one navigation landmark, so no `aria-label` is needed to disambiguate. |
| 2 | semantics | KB-4/KB-5: no `<h1>` on 7 screens; Reveal had no heading at all | one `<h1>` per screen, always its own title, promoted from the existing title element (Lab question, Summary "Invoice", Stats/Legend/About/Prereg titles, Call prompt). Reveal gets a visually-hidden `<h1>`. Sub-headings demoted to `h2` so no level is skipped. **Purely semantic** — every one of those classes declares its own `font-size`/`margin`/`weight`, so nothing renders differently. |
| 2 | semantics | radio groups already correct: `role="radiogroup"` + `aria-labelledby` legend + `aria-describedby` note + roving tabindex | none needed |
| 2 | semantics | KB-3: no live announcement of a new result | `DialShell` is now `role="status"` (implicit `aria-live="polite"` + `aria-atomic="true"`), so the numeral **and** its n/df line are re-read together. Fires on text change only — a re-render with the same result mutates nothing. The pre-existing `aria-busy` becomes the settle gate: a live region marked busy holds its announcement, so an in-flight debounced change is never read as a result. **No new copy key**: the region carries the dial's own already-translated strings. |
| 2 | semantics | the colour **band** is not announced | deliberate, documented in-code. The band is a redundant encoding of the number being read (`p = 0.043` *is* the significant state), `lab.dialCaption` renders under the dial in every state and states the rule, and SUBMIT's `disabled` → enabled is a native state change every screen reader reports. Announcing a band name would be the same fact twice and would need vocabulary the catalog does not have. |
| 3 | figures | `DataCut`: `role="img"` + `a11y.dataCut` wired, and the label **matches what renders** — two columns (`lab.cutControl` + `treatmentLabel`), excluded points drawn as crossed marks. It also has a real `<figcaption>` legend with live counts and per-column mean/n as text. | none needed |
| 3 | figures | KB-9: `SpecCurve` used one label for two different plates, and claimed a publication that may not exist | `a11y.specCurveGrouped` added for fig. 2; `a11y.specCurveChart`'s published clause dropped (see §4). |
| 3 | figures | Share button's accessible name is the visible "Share" (no `aria-label`), per Summary.tsx's WCAG 2.5.3 note | verified and re-pinned by test |
| 4 | contrast | see §5 — **no pair below its threshold**, in either theme | none needed |
| 5 | motion | nothing added. `motion.test.ts` (site register, compositor-property and reduced-motion parity) passes unchanged; the one new CSS rule is a `:focus-visible` outline with no transition. Reduced motion re-verified in-browser. | n/a |
| 6 | zoom | 200% at 1280 (= 640 effective) on all 8 screens: `scrollWidth === innerWidth` everywhere, before and after the ring | none needed |
| 7 | axe | see §6 — **1 serious + 1 moderate before, 0 after** | fixed |

Additional fix outside the numbered sweep: KB-8, the three nav pages' close
buttons. `a11y.closeDialog` ("Close dialog") promised modality, a focus trap
and an Escape key, none of which a nav page has. The label is removed, so the
visible "Close" is the accessible name, and each `<section>` is now
`aria-labelledby` its own `<h1>` — which exposes it as a named region, giving
"Close" the context the false label was faking. `a11y.closeDialog` is now
unused in `src/`; it is left in all three catalogs rather than removing a key
from the frozen `CopyKey` union (noted in §8).

---

## 4. Copy changes (×3 locales)

One new key, one value correction. Both are figure text alternatives, so both
follow the T36 "figures speak one sentence" convention.

**NEW — `a11y.specCurveGrouped`**
- `en`: "Chart of every possible specification's p-value, in one column per outcome measured."
- `it`: "Grafico dei p-value di tutte le specificazioni possibili, in una colonna per ogni esito misurato."
- `es`: "Gráfico del p-valor de todas las especificaciones posibles, en una columna por cada resultado medido."

**VALUE CHANGE — `a11y.specCurveChart`** (dropped "with your published
specification highlighted": false on the abandon path, where nothing is
published and the chart's own legend already omits its published row; it also
duplicated `reveal.publishedRecipe`, which states the recipe as real text)
- `en`: "Chart of every possible specification's p-value, sorted from smallest to largest."
- `it`: "Grafico dei p-value di tutte le specificazioni possibili, ordinate dal più piccolo al più grande." *(keeps T37's agreement fix: "ordinate" agrees with "specificazioni", not with "Grafico")*
- `es`: "Gráfico del p-valor de todas las especificaciones posibles, ordenadas de menor a mayor."

No em dashes added (the corpus budget is untouched). No new copy was needed
for the dial announcement, the `<h1>`s, the nav landmark or the close buttons.

---

## 5. Contrast — measured, not asserted

Computed in the browser from the **actual resolved token values**, alpha-
compositing every non-opaque colour over its real backdrop (WCAG 2.1 relative
luminance). Both themes.

| Pair | light | dark | floor | |
|---|---|---|---|---|
| `--ink` on `--paper` | **16.24** | **13.98** | 4.5 | pass |
| `--muted` on `--paper` | **5.09** | **5.08** | 4.5 | pass |
| `--sig-red` on `--paper` | **6.16** | **5.10** | 4.5 | pass |
| `--assist-green` on `--paper` | **5.73** | **5.35** | 4.5 | pass |
| `--hack-gold-ink` on `--paper` | **5.03** | **7.33** | 4.5 | pass |
| `--dial-step-1` on `--paper` | **5.31** | **5.09** | 4.5 | pass |
| `--dial-step-2` on `--paper` | **5.49** | **5.19** | 4.5 | pass |
| `--dial-step-3` on `--paper` | **5.63** | **5.26** | 4.5 | pass |
| `--muted` on `--sig-band` over `--paper` | **4.63** | **4.78** | 4.5 | pass |
| `--ink` on `--sig-band` over `--paper` | **14.76** | **13.17** | 4.5 | pass |

Rendered text, read off live elements in the Lab (colour + size + weight +
opacity, over the real painted background):

| Element | ratio | note |
|---|---|---|
| `.ph-dial__value` (resting, `--muted`) | 5.09 | 96px |
| `.ph-dial__meta`, `.ph-dial__caption`, `.ph-lab__footnote`, `.ph-spec-group__note`, `.ph-coef-plot__axis` | 5.09 | 13px |
| `.ph-lab__submit` **disabled** | 5.09 | passes even though WCAG exempts disabled controls |
| `.ph-lab__abandon`, `.ph-header__vol`, `.ph-seg[aria-pressed=false]` | 5.09 | |
| `.ph-lab__collect`, `.ph-radio` unselected, `.ph-datacut__legend` | 16.24 | `--ink` |

**No text pair below 4.5:1 in either theme.** No opacity is applied to any
text (the T14 fix-round's alpha-composited dial ramp is genuinely gone).

Two non-text pairs are below 3:1 and are **not** findings, because in neither
case is the information carried by the fill alone:
- `--sig-band` fill vs `--paper`: 1.10 / 1.06. The p < .05 region is *also*
  bounded by the `--sig-red` threshold rule and labelled "p < .05" in text
  inside the plate (R1.3 place 2). The band is redundant.
- `--rule` hairline vs `--paper`: 1.42 / 1.44. Hairlines are separation, not
  component identification; every control they sit near is identified by its
  own label, and selection is a 2px `--ink` underline (16.24:1) plus
  `aria-pressed`/`aria-checked` (R6.3, three channels).

No token was changed and no colour was added.

---

## 6. axe-core scan

axe-core 4.12.1 via `playwright-core` against real Chrome, rulesets
`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. Every screen ×
both themes, with a seeded profile so Stats renders real histogram bars and a
mix of unlocked/locked achievement rows, and with **both** terminal paths
covered (published → Call overlay in one run, abandon → standalone Call screen
in the other).

**Before — 2 rules, 17 scans:**
- `aria-prohibited-attr` (**serious**, 11 nodes, Stats, both themes) —
  `aria-label` on a role-less `<span>`. A bare span maps to `generic`, which
  *prohibits* an accessible name, so the label was being discarded outright.
  Both the fork-histogram bar and the locked-achievement blind stamp were
  affected, and in both cases the discarded label was their **only** content
  (everything else in them is `aria-hidden`) — so every locked achievement row
  and every histogram bar announced nothing at all. Fixed with `role="img"` on
  both, which is what those elements actually are.
- `page-has-heading-one` (moderate, 6 screens × 2 themes) — fixed by the h1 pass.

**After — 0 violations across all 17 screen × theme scans**, including the
best-practice set. Nothing suppressed, no rules disabled.

```
axe light/Briefing 0 · Stats 0 · Legend 0 · About 0 · Lab 0 · Published 0 · Call overlay 0 · Reveal 0 · Summary 0
axe dark/Briefing  0 · Stats 0 · Legend 0 · About 0 · Lab 0 · Call screen 0 · Reveal 0 · Summary 0
```

---

## 7. Tests

New `tests/ui/a11y.test.tsx` — **33 tests**, one block per fix, each headed by
the measurement that forced it:

- R6.6 focus: no steal on first mount; `tabindex="-1"` on `<main>`; focus on a
  **game** screen change (through the real store + real `ScreenRouter`); focus
  on a **nav** page change and on the way back; the ring rule's value, negated
  offset and absence of a transition.
- landmarks/headings: banner + main + exactly one `navigation` (and it is a
  real `<nav>`); exactly one `<h1>` per screen and it is the screen's title;
  no heading level is ever skipped.
- dial: `role="status"`; text changes only when the result does; `aria-busy`
  gate; the region survives the null and `n < 30` states.
- R6.7 disclosure: no `role="tooltip"` in the DOM **or** in the source;
  `aria-expanded` on the trigger; `aria-controls` only while the panel exists;
  panel is a list; focus-open and Escape still work.
- figures: the two plates have different labels, and neither claims a
  publication.
- Stats: `role="img"` on every bar and every locked stamp; region named by its
  own `<h1>`; the close button is no longer named "Close dialog".
- Call overlay: Escape closes it and restores focus to the CTA; the cover
  returns to the accessibility tree; reopening is clean.
- Reveal: exactly one `<h1>`, visually hidden but not `display:none`; booked
  (c)'s two halves; booked (e)'s block order and text sequence; the stamp's
  text alternative ahead of the call resolution; both figures with their own
  caption **and** their own description.
- Summary: booked (d)'s three assertions plus the WCAG 2.5.3 share-button name.

Updated: `tests/ui/{legend,about,stats,appNav}.test.tsx` (close-button name,
plus a new assertion that Legend names its region from its heading) and
`tests/ui/motion.test.ts` (the `<main>` key moved into a `const` because
App.tsx now needs it twice; the test follows the identifier one hop instead of
demanding a literal, so R5.2 site 1's guard is unchanged in strength).

`tests/ui/tokens.test.ts`'s outline-suppression scan is **green and untouched** —
no `outline: none` / `0` / `outline-style: none` was introduced anywhere.

---

## 8. DESIGN.md

Two rules added to **§6 Focus & affordances** (the brief's "not R5"):

- **R6.6** — a screen change moves focus; the container declares R6.1's ring at
  a negated offset; every screen carries exactly one `<h1>`, visually hidden
  where the design has no title element to promote.
- **R6.7** — a pop-up is a disclosure **or** a tooltip, never both.

Also updated: the rule count (49 → 51); the tier-A row now names
`tests/ui/a11y.test.tsx` and lists R6.6/R6.7; a new "Tier A scope, §6's other
half" paragraph states exactly what that file does and does not decide; and
the tier-C raw-px exception list gains R6.6's `1px` clipped box (the only new
raw-px hit in `src/ui` — re-verified: all four tier-C greps are otherwise
clean).

---

## 9. Concerns / booked forward

1. **`a11y.closeDialog` is now unused in `src/`.** Left in all three catalogs
   rather than removing a key from the frozen `CopyKey` union mid-flight. It
   is the right string for a real dialog with a close button; the app has none
   today (the Call overlay's exit is Escape, because §2.6 requires the call).
   A later task can either use it or retire it deliberately.
2. **`role="dialog"` is nested on the published path** — Published's overlay
   (`role="dialog" aria-modal`) contains Call's own `role="dialog"` section.
   **Verdict: left as-is, deliberately.** It is a prior explicit design
   decision with its own tests on both sides (`call.test.tsx`'s
   "container-agnostic" suite, `published.test.tsx`'s overlay suite), axe
   reports nothing, and the inner one is properly named by its prompt. The
   real cost was the missing keyboard exit, which is fixed. Worth a look in
   the grand review, since on the *abandon* path Call is the whole page and
   calling it a dialog is still a small overstatement.
3. **The Reveal's cover echo prints "Vol. 1, No. -5" in practice mode**
   (negative puzzle number before EPOCH). Not accessibility, not in scope
   (engine/game), but it is read out verbatim by a screen reader and looks
   like a bug.
4. **No skip link.** Considered and declined: with R6.6 in place, focus lands
   in `<main>` on every screen change, so the 9-stop header is traversed once,
   on first load only, and this is a single-page app with one page load.
   Cheap to add later if the grand review disagrees.
5. **Announcement verification is structural, not audible.** The tests prove
   `role="status"` is present and that its text changes exactly on a new
   result; they cannot prove NVDA/VoiceOver actually speak it. That needs a
   human with a screen reader and is the one claim here not backed by a
   measurement.
6. **The Lab's nested `<header>`** (the scenario question, inside
   `<section class="ph-lab">`) is correctly *not* a banner in Chrome — axe's
   `landmark-no-duplicate-banner` is clean — but testing-library's role
   mapping does not implement that scoping rule and reports two banners. The
   jsdom landmark tests therefore render the shell around a stand-in child;
   noted in the test file so nobody "fixes" the markup to satisfy the harness.

### Grand-review handoff (no code change; carried per fix round 1)

- **Two buttons named "Legend" on the Lab** — the header nav item and the
  fork-trail key's trigger. Pre-existing (T29 chose `nav.legend` for the
  trigger deliberately, and T37 pinned it as a page NAME in both places), and
  not an axe or WCAG failure, but a screen-reader user pulling up a list of
  buttons sees the same name twice with different destinations. Worth a
  deliberate ruling: distinct names, or an accepted duplication.
- **Practice mode reads "Vol. 1, No. -5"** on the Reveal's cover echo and in
  the running header (negative puzzle number before EPOCH). Engine/game scope,
  not accessibility, but it is spoken verbatim.

---

## 10. Fix round 1 — review I1

**The bug, and why round 1 missed it.** `closeCall()` called
`ctaRef.current?.focus()` on the line after `setCallOpen(false)`. React had not
committed yet, so the cover still carried `inert` — and nothing inside an inert
subtree can take focus. The call was a silent no-op. My round-1 browser check
asserted only `overlay after Escape: false`; it never read
`document.activeElement`, so it could not have caught this, and my jsdom test
asserted the *outcome* (`activeElement === cta`), which jsdom passes either way
because it does not implement inert's focus blocking. Both instruments were
blind to the same thing, and I reported the fix as working on that basis. That
was the error.

**The fix.** The restore moved out of `closeCall` and into a `useEffect` keyed
on `callOpen`, guarded by a `wasCallOpenRef` so it fires only on a genuine
open → closed edge (never an on-mount focus steal). Effects run after the
commit that removes `inert`, so the element is focusable by the time anything
focuses it.

**Measured in real Chrome (CDP), keyboard-only through a real publication:**

```
before opening        : {"tag":"BUTTON","cls":"ph-published__cta","text":"Face the truth","isCta":true,"coverInert":false,"overlay":false}
overlay open          : {"tag":"BUTTON","cls":"ph-call__option","text":"A real effect…","isCta":false,"coverInert":true,"overlay":true}
after Escape (+0ms)   : {"tag":"BUTTON","cls":"ph-published__cta","text":"Face the truth","isCta":true,"coverInert":false,"overlay":false}
after Escape (+1200ms): {"tag":"BUTTON","cls":"ph-published__cta","text":"Face the truth","isCta":true,"coverInert":false,"overlay":false}
second round trip     : {"tag":"BUTTON","cls":"ph-published__cta","text":"Face the truth","isCta":true,"coverInert":false,"overlay":false}
```

`activeElement` **is** the CTA at both sample points (round 1: `<body>` at
both), and the ref re-arms, so a second open/Escape restores correctly too.
The reviewer's control experiment reproduces on this build and confirms the
mechanism:

```
control — focus() while inert        : {"coverInert":true,  "became":false}
control — focus() once inert is gone : {"coverInert":false, "became":true}
```

**The test now asserts ordering, not outcome.** An outcome assertion is
permanently vacuous in jsdom; the ordering is observable there. The test spies
on the CTA's `focus`, records whether the cover still had `inert` at the
instant it fired, and asserts:

```ts
expect(
  inertWhenFocused,
  'focus() ran while the cover was still inert — in a real browser that is a no-op and focus is lost to <body>'
).toBe(false);
```

Verified to be a real guard by reverting the fix (synchronous focus inside
`closeCall`) and re-running: it fails on exactly that assertion —
`expected true to be false`. A second new test pins that the restore effect
does not steal focus on mount. Test count 1356 → 1357.
