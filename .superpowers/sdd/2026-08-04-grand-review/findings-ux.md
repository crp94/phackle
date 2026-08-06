# GR4 — UX/UI lane findings

**Base:** `build/v1` @ `7e417f4`, read-only on `src/**`.
(Agent's markdown write was blocked; persisted verbatim by the controller from the lane reply.
The 268 screenshots DID land in `shots-ux/`, with raw measurements in the sibling `*-ux.txt` files.)

**Method:** the REAL production build (`PATH="/usr/bin:$PATH" npm run build` → `vite preview`
on :4173) driven in headless Chrome over raw CDP — the T29/T38 idiom, reused unchanged
(`Emulation.setDeviceMetricsOverride` for the layout viewport, `Storage.clearDataForOrigin`
before every navigation, `Page.addScriptToEvaluateOnNewDocument` for state seeding).
**Every tap in this report is a real `Input.dispatchMouseEvent`** at the element's on-screen
centre, after a `scrollIntoView` and an `elementFromPoint` check that the target is actually
under the pointer — so a control that could not be reached fails the run instead of being
silently `.click()`ed. **No source file was patched**; the whole matrix is reachable through
the shipped UI plus `localStorage` seeding.

Two environment notes, both stated so the numbers can be re-checked:

- `EPOCH = '2026-08-10'` and today is 2026-08-06, so an unmodified load runs in **practice
  mode with a fresh random seed**. Every capture except the two `practice-*` cells therefore
  installs a boot-time `Date` shim pinned to **2026-08-20** (puzzle #11, real daily mode,
  deterministic scenario `standing-desk-poetry`) so the shots show the state that ships. The
  shim advances in real time inside that day; it is a clock override, not a store patch.
- 30-day histories, achievements, `introSeen` and theme are seeded by writing the real
  `phackle.v1` key from an init script, i.e. through `storage.ts`'s own schema.

**268 shots** in `shots-ux/`, named `<state>-<width>-<theme>.png`. Raw measurements in
`measurements-ux.txt`, `a11y-ux.txt`, `probe2-ux.txt`, `probe3-ux.txt`, `probe4-ux.txt`,
`probe5-ux.txt`, `tier3-ux.txt`, `chyron-ux.txt`, `error-ux.txt`.

**Counts: 2 blockers · 9 high · 12 polish (23 findings).** Sections 2–5 below carry the
friction counts, the one-hand verdicts, the a11y narrative and the five owner-taste verdicts.

---

## 1. State-matrix findings

### [gr4-001] The Call overlay has no surface of its own: its prompt sits on the live cover at 2.45:1, and at 360 it is painted across the header's own controls

**Severity:** blocker · **Effort:** S
**Screen/state:** Published → "Face the truth" → Call overlay. Both themes, every width; worst at 360.
**Shots:** `call-overlay-containingblock-360x640-paper.png` (the definitive one),
`fold-call-360x640-paper.png`, `call-overlay-1088-dark.png`, `call-overlay-360-paper.png`,
`call-overlay-scrolltop-768-paper.png`, `call-overlay-scrolltop-768-dark.png`.

**Evidence.** `.ph-call` declares no background — measured `getComputedStyle('.ph-call').backgroundColor
=== "rgba(0, 0, 0, 0)"`. Only `.ph-call__option` is on `--paper`. So the modal's eyebrow and its
`<h1>` prompt render directly onto `--scrim` over the still-painted Published cover. Contrast,
computed from the live rendered values in the real build (`probe3-ux.txt`):

| theme | effective backdrop | prompt (`--ink`, 28px) | eyebrow (`--muted`, 13px) |
|---|---|---|---|
| paper | `rgb(117,115,111)` | **3.64:1** | **1.14:1** |
| dark  | `rgb(147,146,143)` | **2.45:1** | **1.12:1** |

§7.5's floor is 4.5:1. Both prompts fail it; the dark prompt fails even the 3:1 large-text
allowance; both eyebrows are at ~1.1:1, i.e. effectively invisible. (The option cards are fine —
their titles measure 16.24:1 / 13.98:1 on their own `--paper`.)

Geometry makes it worse than the numbers. At every width the cover's own text lands inside the
prompt's box (`probe2-ux.txt`): `ph-published__career :: +25 career points`,
`ph-altmetric__score :: Mentioned 374 times online already`,
`ph-altmetric__percentile :: Top 35% of all research outputs, all time`. And at 360 the overlay
centres its content *over the four-row header*: measured `promptRect.y=160..224` against
`headerRect 0..267`, with `document.elementFromPoint` at the theme toggle returning
`ph-call__prompt` and at the header's centre returning `ph-call__eyebrow`
(`probe4-ux.txt`, 360×640 and 360×780). The shot shows "what do" printed over **Paper / Dark**
and "you found?" over the **EN / IT / ES** row.

**This is the law only half-implemented, not a law conflict.** R4.2's own `Do:` reads
"separate the Call modal from the cover with a `--hairline` **and** a dimmed backdrop". The
backdrop shipped; the hairline-ruled block did not.

**Fix shape.** On `.ph-call`: `background: var(--paper)` (R1.1's only surface) plus
`border-block-start`/`border-block-end: var(--hairline)` (R4.4/R4.5 — single edges, never the
shorthand). `.ph-call__option` can then drop its now-redundant `background: var(--paper)`.
No new token, no new colour, no new breakpoint, no change to the copy. Re-check with the same
probe: both prompt and eyebrow should read against `--paper` (16.24:1 / 5.09:1 light).

---

### [gr4-002] A boot failure shows the WRONG study, with a live CTA into a Lab that can never compute

**Severity:** blocker · **Effort:** M
**Screen/state:** any boot failure — `createEngineClient()` throwing (no `Worker` support), or
`client.init()` rejecting. Reproduced by making `window.Worker` throw from an init script, which
is the exact path `App.tsx`'s own `try/catch` was written for.
**Shots:** `error-worker-360-paper.png`, `error-worker-360-dark.png`, `error-worker-768-paper.png`,
`error-worker-1088-dark.png`, `error-worker-lab-360-paper.png`, `error-worker-lab-stuck-360-paper.png`.

**Evidence** (`error-ux.txt`). With the worker unavailable:

    loadingGate=false
    errorBanner="Something went wrong generating today's puzzle. Reloading usually fixes it."
    header vol      = "Vol. 1, No. 11"                       (correct)
    briefing question = "Does owning a cat improve cryptocurrency returns?"

Today's puzzle (#11) is **"Do standing desks make middle managers write better poetry?"**. What
renders is `scenarioIndex = 0`'s placeholder — the precise bug `store.booted` exists to prevent
(T40 finding F2), reappearing on the error branch, because `App.tsx`'s gate is
`if (!booted && !storeError)`: a boot that *failed* renders the shell on `initialState()`'s
placeholders.

It is not a static wrong page — it is playable-looking:

    after OPEN THE DATA: main's first child = "ph-error"  → the Lab renders
    lab dial          = "—"  busy=false          (and stays "—" after a knob turn)
    submit enabled    = false
    "Report null result" enabled = TRUE

Pressing the one enabled action calls `store.abandon()` → `makeCall()` → `client.reveal()` →
`throw new Error('not booted')`, an unhandled rejection and a dead end. The banner's advice
("Reloading usually fixes it") is also the only recovery, and there is no reload control.

**Fix shape.** Two lines of policy, no redesign:
1. On `storeError && !booted`, render the error as the **whole screen** rather than as a banner
   over a placeholder Briefing — the shell already knows how to render one screen; the
   placeholder study must never be shown.
2. Give that screen the one action the copy already promises: a reload button
   (`location.reload()`). If a copy key is needed, that is a GR3/GR5 hand-off, not a UX one.
   Keep the additive banner behaviour for crashes that happen *after* `booted` (mid-session
   worker death), where the screen underneath is genuinely the player's own state.

---

### [gr4-003] Nothing locks the page behind the Call modal

**Severity:** high · **Effort:** S
**Screen/state:** Call overlay, every width and theme.
**Shot:** `call-overlay-360-paper.png` (cover text mid-slide behind the prompt).
**Evidence** (`probe2-ux.txt`, all six cells): with the overlay open,
`window.scrollTo(0,0)` then `window.scrollBy(0,250)` moves the document from 0 → 250;
`getComputedStyle(document.body).overflow === "visible"`; `docScrollable: true`.
Combined with [gr4-001] this means the cover's headline and press cards slide *underneath* the
un-surfaced prompt while the player reads it.
**Fix shape.** While `callOpen`, set `overflow: hidden` on the scrolling element and restore it
on close (the existing `wasOpenRef`/`closeCall` pair in `Published.tsx` already owns that
lifecycle). `.ph-call-overlay` already has `overflow-y: auto`, so a tall dialog still scrolls
inside itself (T29's M4). Fixing [gr4-001] alone does not fix this: a surfaced modal over a
scrolling page still reads as broken.

---

### [gr4-004] The booked 320w overflow: it is `a.ph-about__link`, printing the site URL as an unbreakable token

**Severity:** high · **Effort:** S
**Screen/state:** About page, 320px, every theme, all three locales. **This is the residual T29
booked at 360 in `task-T29-report.md` §7.1** — the element it named then
(`DIV.ph-header__controls` / `BUTTON.ph-toggle`) no longer exists (T33 replaced the toggle),
and no overflow of any kind now reproduces at 360.
**Shots:** `about-overflow-320-paper.png`, `about-overflow-320-dark.png`.
**Evidence** (`probe5-ux.txt`):

    [about 320/paper] scrollWidth=328  clientWidth=320
      offenders=[{"tag":"A","cls":"ph-about__link","left":24,"right":328.2,"w":304.2}]
      link: {"txt":"https://phackle.carlosrodriguezpardo.es","w":304,"right":328,
             "wrap":"normal/normal"}

**8.2px**, exactly the booked figure, identical in `it` and `es`, identical in dark. The whole
document — every other screen included — is clean at 320: briefing, lab, published, reveal,
summary, stats, legend, prereg all report `scrollWidth === clientWidth === 320` in both themes
(`probe2-ux.txt`, `probe5-ux.txt`). The About page is the only offender, and the second
`.ph-about__link` (the bare URL) is the only element in it.

**Fix shape.** `.ph-about__link { overflow-wrap: anywhere; }` in `About.css`. One declaration,
no token, no breakpoint, no colour; R6.2's permanent underline and its 2px offset are untouched.
Re-check: `document.documentElement.scrollWidth === 320` at 320w on the About page.

---

### [gr4-005] The RETRACTED stamp is painted 22px outside the left edge of the window at 768 and 1088

**Severity:** high · **Effort:** S
**Screen/state:** Reveal, the stamp block, ≥768 only (360 clears it by 3px).
**Shots:** `reveal-stamp-768-paper.png`, `reveal-stamp-768-dark.png`, `reveal-q2-768-paper.png`.
**Evidence** (`probe3-ux.txt`, both themes, identical):

    svg   {left: 36, right: 358, w: 322}    viewBox "0 0 320 160"   overflow: visible
    group {left: -22, right: 416, w: 438}   clippedLeftPx: 58

The −12° rotation makes the stamp's own group 438px wide inside a 320-unit viewBox; with
`overflow: visible` it paints 58px past each side of its box. The box starts at x=36, so **22px
of the stamp is drawn outside the viewport** and cut by the window. It creates no horizontal
scrollbar (left overflow never does), so nothing catches it: `documentElement.scrollWidth`
stays 768/1088. It is visible in the shots as a severed red corner at the left margin.

This is **not** the T29 "stamp overlaps the cover echo" wontfix — that ruling is about the stamp
landing *on the paper*, which is R8.2 working. This is Act II's signature being clipped by the
browser window.

**Fix shape.** The stamp's own geometry, not the layout: either give the `<svg>` a viewBox wide
enough to contain the rotated group (the 58px of bleed is deterministic — it is
`(438 − 320) / 2` at the current scale), or inset the group so its rotated bounds sit inside
`0 0 320 160`. Both are pure SVG-coordinate changes: no CSS, no token, no rule touched, and
`.ph-stamp__mark { width: min(100%, 320px) }` stays exactly as it is.

---

### [gr4-006] Locked achievements render as `▦▦▦` and read as missing glyphs, not as a blind stamp

**Severity:** high · **Effort:** S
**Screen/state:** Stats → achievement wall, any state with locked awards (i.e. every state until
the wall is complete). Six of eleven rows in the seeded 30-day capture.
**Shots:** `stats-populated-360-paper.png`, `stats-populated-360-dark.png`,
`stats-populated-768-paper.png`, `stats-empty-360-paper.png`.
**Evidence.** `Stats.tsx` renders `<span aria-hidden>▦▦▦</span>` for a locked row and calls it an
"embossed blind stamp" in its comment. On screen (see the shot) it is three small grey filled
squares at body size, on a row that is otherwise blank — indistinguishable from a font-fallback
box, and repeated identically six times down the wall. The unlocked rows carry a gold ★, a name
and a citation; the locked rows carry no shape language that connects them to the unlocked ones,
so the wall reads as "three rows rendered, then some broken characters".
The a11y half is correct and should be left alone (`role="img"` + `aria-label` from
`stats.locked`, verified in the AX tree).
**Fix shape.** Keep the name-free contract exactly (nothing may leak the id). Give the locked row
the same *anatomy* as an unlocked one so the wall reads as a list of slots: the ★ position filled
with a `--rule`-weight outline mark (the glyph vocabulary already used by `GlyphMark`), the name
column set to a `--muted` rule of fixed width, and the citation line omitted. One CSS block plus
the same one span; no copy value, no new token. If the `▦` is kept, it must at minimum sit in the
mark column with the row's own hairline, not float alone.

---

### [gr4-007] "Share" — the one social action in the product — has no resting affordance at all

**Severity:** high · **Effort:** S
**Screen/state:** Summary, every width and theme.
**Shots:** `summary-360-paper.png`, `summary-768-dark.png`, `fold-summary-360x640-paper.png`.
**Evidence** (`probe3-ux.txt` reads it off the live element):

    share: {borderBottom: "2px solid rgba(0, 0, 0, 0)", deco: "none",
            padding: "12px 16px", font: "system-ui 15px", tt: "none"}

`Summary.css` reserves a 2px underline and never fills it; the only affordance is
`.ph-summary__share-button:hover { text-decoration: underline }`, which does not exist on a
phone. So on the target device the game's most important action is 15px of plain `--font-ui`
text with nothing under it — sitting, in the shots, alone in a band of whitespace between two
hairlines that belong to its neighbours.

This is exactly the defect T29 pin 4 identified and fixed one screen over: "'Got it' … read as a
caption: `--muted`, no affordance until hover. Now `--ink`, a **permanent** underline at
`text-underline-offset: 2px` (R6.2's idiom)". The same reasoning applies verbatim, and the fix
already has a precedent in the codebase.

**Fix shape.** Fill the reserve: `border-block-end: 2px solid var(--ink)` (R4.6's own idiom, and
the 2px is one of §10's four sanctioned raw pixel values), or the `.ph-lab__intro-dismiss`
treatment (permanent underline at 2px offset). Keep `:hover` as it is. No token, no colour, no
size change.

---

### [gr4-008] The RETRACTED stamp is announced twice

**Severity:** high · **Effort:** S
**Screen/state:** Reveal, screen readers, every width.
**Shot:** `reveal-full-768-paper.png` (the visual it describes); evidence is the AX tree in `a11y-ux.txt`.
**Evidence.** `probe2-ux.txt`, identical in all six cells:

    stampHTMLroles: ["svg/img/RETRACTED: The finding survived peer review and no…/hidden=null"]
    visibleText:    "RETRACTED | The finding survived peer review and nothing else."

and the AX tree confirms the doubling in reading order:

    image:      RETRACTED: The finding survived peer review and nothing else.
    StaticText: RETRACTED
    StaticText: The finding survived peer review and nothing else.

The `<svg role="img">` carries the full sentence as its `aria-label` **and** its `<text>` children
are exposed, so Act II's signature beat is read out twice in a row. R8.2's "always also present
as text for assistive technology" is satisfied by either channel alone; shipping both makes the
game stutter at its loudest moment.
**Fix shape.** Keep `role="img"` + `aria-label` (it is the one that carries the composed
sentence) and mark the inner `<text>` nodes `aria-hidden="true"`. R6.3 is unaffected — the text
alternative still exists, once.

---

### [gr4-009] Nested dialogs, and the modal is named by its eyebrow rather than by its question — [final-006] confirmed from the AT side

**Severity:** high · **Effort:** S
**Screen/state:** Call overlay (published path). The abandon path is the second half of it.
**Shot:** `call-overlay-1088-dark.png`; evidence is the AX tree in `a11y-ux.txt`.
**Evidence.** Measured (`a11y-ux.txt`):

    overlayRole:   dialog / true / "Before you see the reveal…"
    innerCallRole: dialog          (aria-labelledby = the prompt)
    coverInert: true   coverAriaHidden: "true"    focus: ph-call__option
    AX:  dialog: Before you see the reveal…
           dialog: Between us: what do you think you found?

Two dialog boundaries for one modal: a screen reader announces "dialog, Before you see the
reveal…" and then immediately "dialog, Between us: what do you think you found?". Worse, the
*outer* one — the one `aria-modal="true"` makes authoritative — is named by `call.title`, an
ellipsis fragment, while the real question is buried one level down.

The rest of the modal contract is correct and should not be touched: the cover is `inert` +
`aria-hidden`, focus moves into the overlay on open, Escape closes it, and focus is restored to
`ph-published__cta` (all four verified live, `a11y-ux.txt`).

**Fix shape, from the AT side.** Drop `role="dialog"` from `.ph-call` entirely. It is
container-agnostic by design, and *neither* container wants a nested dialog: as the overlay's
child the wrapper already supplies `role`/`aria-modal`/name; as the standalone `call` screen
(abandon path) it is the whole page, nothing is behind it, and a dialog with no dismissal is
wrong there too. Then move the name up: `aria-labelledby={promptId}` on `.ph-call-overlay`
instead of `aria-label={t('call.title')}`, so the modal is announced by its question. `.ph-call`
keeps its `<h1>` and its `<section>`; nothing visual changes.

---

### [gr4-010] The Invoice can be a single all-zero row, on a screen that just paid you 25 career points

**Severity:** high · **Effort:** M (routes to GR2/GR3 for the row set; the screen defect is UX's)
**Screen/state:** Summary after a published day with an incorrect call — the modal outcome.
**Shots:** `summary-360-paper.png`, `summary-768-dark.png`, `summary-1088-paper.png`.
**Evidence** (`probe5-ux.txt`, a genuine playthrough: 6 forks, published, RETRACTED, wrong call):

    INVOICE rows: ["Incorrect call\t0"]
    children: … {cls:"ph-summary__total", txt:"Score: 0"} …

`scoreHack()` pushes the parsimony row only `if (i.callCorrect === true)` and the
integrity/missed-discovery rows only `if (!i.published)`, so a published + wrong-call day yields
exactly one row worth 0 points. The screen renders a heading that says **Invoice**, one line item
of 0, and a total of 0 — under a `--text-40` display serif, above 40px of air. Two screens
earlier the same day printed **+25 career points** in gold on the cover; `scoreDay` returns that
`career` value and the Summary never shows it.

A player reads this as "the game forgot to fill the table in". It is the emptiest state in the
product and it is also one of the most common.

**Fix shape.** Presentational, and it needs no scoring change: render the career track as its own
row (or its own line beside the total) so the invoice always reconciles with what the Published
screen just told the player, and show the parsimony row at its computed value (which may be 0)
rather than omitting it — an invoice's job is to itemise, including the zeros. If a row set change
touches §2.8, it is a controller decision; the *defect* is that Act II's accounting screen can
render as a one-line table of zeros.
*(Controller cross-reference: overlaps gr2-019; merge at GR5.)*

---

### [gr4-011] At 360 both Lab exit actions sit above all six knobs — the last knob is 1.4 screens below Submit

**Severity:** high · **Effort:** M
**Screen/state:** Lab, below R3.4's breakpoint.
**Shots:** `lab-first-360-paper.png` (full page), `lab-scrolled-knobs-360-paper.png`,
`fold-lab-360x640-paper.png`.
**Evidence** (`measurements-ux.txt`, 360×640, real DOM):

    docH = 3009
    Submit for publication   docY 1486   Report null result   docY 1487
    first radiogroup         docY 1619
    last knob (One-tailed)   docY 2894

The DOM order below 768 is question → dial → results → controls (R3.4), so the two exit actions
live at the bottom of the *results* pane, i.e. above every knob. A player who reaches p < .05 by
turning the tails knob (the classic move, and the one "The One-Tailed Bandit" is named for) is
at docY 2894 and must scroll **~1,400px back up** — past both figures, the fork trail and the
caption — to press Submit. The sticky dial tells them they have won; nothing takes them to the
action.

**Fix shape.** Two candidates, both inside one breakpoint and the existing spacing scale:
(a) render the `.ph-lab__actions` row a second time at the foot of `.ph-lab__controls` below
768 — but that is two buttons with one meaning and needs a controller ruling; or, preferred,
(b) make the actions row part of the sticky block's *sibling* stack, i.e. give `.ph-lab__actions`
`position: sticky; bottom: 0` below 768 with a `--paper` background and a `border-block-start:
var(--hairline)`. That is a second sticky element on the screen, so R8.1's "the dial is the one
sticky element" clause has to be amended in DESIGN.md first, in a commit of its own — which is
exactly the process this document requires. Do not fix by moving the controls above the results:
that buries the dial and re-opens T31.
*(Controller cross-reference: same defect measured by GR2 as [gr2-011]; merge at GR5.)*

---

### [gr4-012] Nine chrome tab stops before the first content control, on every screen, with no skip link

**Severity:** high · **Effort:** S
**Screen/state:** every screen; measured on the Briefing.
**Shot:** `briefing-first-fold-360-paper.png` (the four header rows the tab order walks).
**Evidence** (`a11y-ux.txt`):

    TAB ORDER briefing: ["BUTTON:P-hackle","BUTTON:Stats","BUTTON:Legend","BUTTON:About",
                         "BUTTON:Paper","BUTTON:Dark","BUTTON:🇬🇧 EN","BUTTON:🇮🇹 IT",
                         "BUTTON:🇪🇸 ES","BUTTON:OPEN THE DATA"]
    SKIP LINK present: first three focusables are ph-header__home / ph-seg / ph-seg
    landmark roles: HEADER, NAV, DIV[group "Change theme"], DIV[group "Language"], MAIN

Ten stops, nine of them chrome, before the one thing the screen is for. It repeats on the Lab
(where the eleventh stop is "HOW TO PLAY"), and it repeats every day. Focus management itself is
correct — `<main>` takes focus on every swap (`MAIN.ph-screen`, verified) — which is what makes a
skip link cheap: the landmark is already focusable.
**Fix shape.** A standard visually-hidden-until-focused skip link as the first child of
`.ph-app`, targeting the existing `<main tabindex="-1">`. It reuses `.ph-visually-hidden`
(R6.6's own idiom) and R6.1's focus ring; it needs one copy key. Nothing else changes.

---

### [gr4-013] The nav's buttons move under the player's finger when a nav page opens

**Severity:** polish · **Effort:** S
**Screen/state:** header, any nav page (Stats/Legend/About).
**Shots:** `briefing-first-fold-360-paper.png` (game page) vs `stats-populated-360-paper.png`
(nav page — note **PLAY** inserted before Stats).
**Evidence.** `App.tsx` renders the PLAY button only while `page !== 'game'`, as the nav's first
child. Measured live: on the game page the nav is `[Stats, Legend, About]`; the moment Stats
opens it becomes `[PLAY, Stats, Legend, About]`. Every subsequent label is one slot to the right,
so a player who taps Stats and then reaches for Legend finds Stats where Legend was. At 320 it
also re-wraps the row and grows the header from 267px to **318px** (`measurements-ux.txt`).
My own harness hit this before I did — it tapped "Stats" twice.
**Fix shape.** Reserve the slot rather than inserting one: render PLAY at all times and make it
inert/`hidden`-but-space-occupying on the game page, or move it to the end of the nav where an
insertion shifts nothing. Either is a one-line JSX change; no copy, no CSS token.

---

### [gr4-014] Two press cards from the same outlet, back to back, on the day's payoff screen

**Severity:** polish · **Effort:** S (routes to GR2 — it is a picker property, not a style one)
**Screen/state:** Published, tier 2 and tier 3.
**Shot:** `published-tier3-en-360-paper.png` — "NIGHTLY CHYRON NETWORK" heads both clippings.
**Evidence.** `pickPress(content.press, tier, scenario.id, iso)` and
`` pickPress(…, `${iso}#2`) `` are drawn independently, so the two clippings may share an outlet.
On puzzle #11 they do. R5.2 site 5's stated reason for staggering the entrance is "coverage
arrives outlet by outlet, which is what coverage does" — two identical mastheads arriving in
sequence undercuts exactly that.
**Fix shape.** Exclude card 1's outlet from card 2's candidate pool (deterministically — reject
and re-draw with the next index, never randomise). Engine-adjacent; hand to GR2/GR5.

---

### [gr4-015] A screen-reader player is never told that publishing became possible

**Severity:** polish · **Effort:** S
**Screen/state:** Lab, at the moment p crosses .05.
**Shot:** `lab-significant-fold-360-paper.png` (the sighted channel: the numeral turns
`--assist-green`, measured `rgb(46,110,78)` light / `rgb(90,154,120)` dark).
**Evidence** (`a11y-ux.txt`): the dial's live region is correctly calibrated — three fast arrow
presses produce **one** announcement, three deliberate ones produce **three**:

    3 fast presses:       [{busy:true, "p = 0.596 …"}, {busy:false, "p = 0.288 …"}]
    3 deliberate presses: 3 × (busy:true → busy:false) with three distinct results

That is the right amount of chatter and should not be changed. The gap is the *other* half of the
moment: `submit button state: {disabled: true → false, ariaDisabled: null}`. A native
`disabled` flip is only reported when focus arrives at the button, so a player turning knobs by
keyboard hears "p = 0.015" and nothing about the state change that matters. `PValueDial.tsx`'s own
comment relies on the button being "reported on arrival" — which is true, and is not the same
thing as being told.
**Fix shape.** Do not make the dial chattier (the band is deliberately not announced, correctly).
Instead let the button carry its own transition once: an `aria-live="polite"` on the actions row
whose content changes from empty to the enabled label's state, or the smaller version — a
visually-hidden status line beside SUBMIT that renders `lab.canPublish`-style text only while
`canSubmit`. One key, one node, no change to the dial.

---

### [gr4-016] The Summary is a dead end whose last word is an upsell

**Severity:** polish · **Effort:** S
**Screen/state:** Summary, both paths.
**Shots:** `summary-360-paper.png`, `summary-null-360-paper.png`, `summary-768-dark.png`.
**Evidence** (`probe5-ux.txt`, the screen's own child list in order): title, invoice, total,
streak, countdown, unlock, share, **prereg upsell** — and nothing after it. The last thing the
day says to a player who just finished it is "Try Prereg Mode", a `--muted` button below a
`--text-40` heading, and there is no route to the honours board they just added to. Getting to
Stats means going back up to the header.
**Fix shape.** End the day where the day's reward is: a "Your stats" action after the countdown
(the nav page already exists and takes a callback — `App.tsx` owns `setPage`). One key; the
prereg block keeps its place.

---

### [gr4-017] Day one, honestly reported, unlocks nothing and says so with an empty screen

**Severity:** polish · **Effort:** S (verdict routes to GR2)
**Screen/state:** Summary after "Report null result" on a fresh install.
**Shots:** `summary-null-360-paper.png`, `summary-null-768-paper.png`.
**Evidence** (`deep2.log`, all six cells): `summary-null unlocks=0` — against `unlocks=3` for the
publish path on the same first day. The unlock block correctly renders nothing rather than an
empty state (T38's design), so the honest player's first-ever day ends on an invoice, a streak
line and a countdown. The player who hacked gets a ceremony with three citations.
**Fix shape.** Not a layout fix — the screen behaves as specified. Flagged for GR2/GR5 as a
felt-experience gap the calibration bands do not capture: the game's one virtuous action is also
its least rewarded moment, on the day a new player is deciding whether to come back.
*(Controller cross-reference: overlaps gr2-009; merge at GR5.)*

---

### [gr4-018] The chyron reads as "a larger press card" below 768

**Severity:** polish · **Effort:** S — **recommend WONTFIX**
**Screen/state:** Published tier 3, <768.
**Shots:** `published-tier3-en-360-paper.png`, `chyron-it-360-paper.png` vs the 1088 cells.
**Evidence.** T29 pin 8's lower-third anatomy — badge in its own channel closed by a
`border-inline-end` — only applies at ≥768; below it the badge stacks (deliberately, and for a
good measured reason: the channel cost ~94px of a 312px column). What remains at 360 is a
hairline-ruled block with a bigger headline, i.e. the press card's own anatomy at a larger size.
**Verdict.** Accept. The alternative re-opens the exact defect T29 measured, and the tier-3
moment still reads as the loudest thing on the screen. Recorded so it is not re-found.

---

### [gr4-019] The dial's numeral breaks between "p =" and the value at 360

**Severity:** polish · **Effort:** S — **recommend WONTFIX**
**Screen/state:** Lab, 360 and below.
**Shots:** `lab-first-fold-360-paper.png`, `lab-significant-fold-360-paper.png`.
**Evidence.** Measured `dialH = 153px`, `--text-dial` clamped to 84.5px at 360 (probe3 read
`84.48px` off the live element), the string wrapping to `p =` / `0.015`. This is R8.1's own
documented floor and the reason the sticky block is 153px rather than the ~85px it first
estimated. `white-space: nowrap` would overflow the 312px column.
**Verdict.** Accept as-is. It is the honest floor, it is registered in DESIGN.md, and the block
still occupies only 24% of a 640px phone with eight radios visible beneath it.

---

### [gr4-020] Header height at 360: 267px (EN) / 318px (IT, ES) — **owner ruling confirmed, no functional defect found**

**Severity:** polish · **Effort:** — (no change recommended)
**Screen/state:** every screen, ≤360.
**Shots:** `briefing-first-fold-360-paper.png`, `briefing-locale-it-360-paper.png`,
`briefing-locale-es-360-paper.png`.
**Evidence** (`measurements-ux.txt`), four stacked rows at 360 and 320:

    [360w] headerH 267  rows: masthead {16,45} · nav {77,47} · theme {140,47} · locale {203,47}
    [768w] headerH 141  (nav/theme/locale share one row)
    [1088w] headerH  80  (single row)
    [360 it] headerH 318      [360 es] headerH 318      [320 en, nav page] headerH 318

The ruling asks for a functional defect or nothing. I looked for four and found none: the header
is **not sticky** (verified live — it is gone at any scroll: `lab-scrolled-knobs-360-*.png`), so
it costs one screenful once per navigation, never during play; it does not interact with the
153px sticky dial, which pins at `top: 0` of the viewport regardless; every control in it clears
44px (measured: min height 44, min width 55); and it introduces no overflow at 320.
**Verdict.** **Confirm the ruling — accepted as-is.** The one thing worth changing in the header
is [gr4-013], which is a one-line ordering fix, not a redesign.

---

### [gr4-021] IT/ES tier-3 chyron at 7 lines vs EN 4 — **owner ruling confirmed, measured**

**Severity:** polish · **Effort:** — (no change recommended)
**Screen/state:** Published tier 3, 360.
**Shots:** `chyron-en-360-paper.png`, `chyron-it-360-paper.png`, `chyron-es-360-paper.png`,
`chyron-enLongest-360-paper.png`, `chyron-esLongest-360-paper.png`.
**Evidence.** The booked case is a scenario-bound blurb (`dog-economist-stocks`) that puzzle #11
does not draw, so I measured it directly: the real production build's tier-3 chyron, with each
locale's own shipped string substituted into the live `.ph-chyron__text` and the rendered line
box read back (`chyron-ux.txt`):

| string | chars | 360: lines / headline h / block h | 1088 |
|---|---|---|---|
| EN "…A DOG CALLED HAYEK" | 68 | **4** / 129px / 215px | 2 lines |
| IT "…UN CANE DI NOME HAYEK" | 95 | **7** / 225px / 312px | 2 lines |
| ES "…UN PERRO LLAMADO HAYEK" | 100 | **7** / 225px / 312px | 2 lines |
| EN longest tier-3 in the bank | 72 | 5 / 161px | 2 |
| ES longest tier-3 in the bank | 92 | 6 / 193px | 2 |

So the booked 7-vs-4 is exact, and the worst case is 312px — 40% of a 780px viewport — for one
press item.
**Verdict.** **Confirm the ruling — fine as-is.** The shot settles it: at 7 lines the block still
reads as an over-excited chyron (badge above, headline, strap with outlet + SIMULATED PRESS
below), which is the joke; it does not read as a layout failure. It sits below the fold in a
scrolling column, it introduces no overflow (verified at 360 in all three locales), and every
alternative — a smaller size, a truncation, a shorter transcreation — costs either R2.2's closed
scale or the line's comic timing.

---

### [gr4-022] Masthead watermark, head vs foot — **owner wontfix confirmed, with the shot**

**Severity:** polish · **Effort:** — (no change recommended)
**Screen/state:** Published, all tiers.
**Shot:** `published-tier3-en-360-paper.png` — the whole anatomy in one frame.
**Evidence.** The split is real and visible in that shot: the journal cover prints `SIMULATED
PRESS` **above** `ACTA ERGONOMICA ET ABSURDA` (head), while each press clipping and the chyron
strap print it **below** the blurb (foot).
**Verdict.** **Confirm the wontfix, and I would not have raised it.** The two positions are two
different objects doing two different jobs: on the cover the watermark reads as a stamp across a
masthead (which is where a real overprint goes), and on a clipping it reads as the compliance
line under a quote (which is where a real disclaimer goes). Making them agree would make one of
them wrong. Nothing on screen suggests an oversight.

---

### [gr4-023] Dial settle at 2px — shape recommendation for the owner's AMPLIFY directive, and one collision to avoid

**Severity:** polish · **Effort:** S
**Screen/state:** Lab, on every settled result.
**Shots:** `lab-first-fold-360-paper.png` (band `--muted`) vs `lab-significant-fold-360-paper.png`
(band `--assist-green`, measured `rgb(46,110,78)` light / `rgb(90,154,120)` dark).
**Evidence** (`probe3-ux.txt`, read off the live stylesheet):

    .ph-dial__value  transition: color 0.14s cubic-bezier(0.2, 0, 0, 1)
                     font: "JetBrains Mono" 400 84.48px
    --dur-quick .14s   --dur-scene .26s

Direction is settled by the owner (amplify, within R8.1: no glow, no halo, no pulse). Two things
this lane can contribute:

**A collision to avoid.** "Numeral weight snap", as literally proposed, is **out of law**: R2.4
makes every numeral mono, and R2.3 says "Mono is never anything but 400". The dial's computed
weight is 400 and must stay 400. A fix task that implements a weight snap will fail tier B review.

**The strongest in-law move.** R5.3 pins motion travel to exactly two distances — 6px for a scene
arriving, 2px for a quick beat — and R5.1 pins two ordinary durations. The dial currently spends
the *quiet* pair on every result alike, including the one crossing that carries the whole game:
p passing .05. Promote **only the band change** (R1.8's five steps, which the component already
computes via `dialBand(p)`) to the loud pair — `translateY(6px)` at `--dur-scene` — and leave an
ordinary re-settle within the same band at 2px / `--dur-quick`. That is:

- no new distance, no new duration, no new easing, no new token, no colour;
- no glow, halo, ring, disc or pulse (R8.1 intact);
- still `transform` + the one registered `color` exception (R5.3 intact);
- reduced motion still collapses it to one imperceptible frame (R5.6 intact).

It costs one amendment to R5.2's row 2 — a second identity on the same site, which is precisely
how §5 says a site is changed — and one `useEffect` key change (band, not just `p|n|outcome`).

**A second, free amplifier worth pairing with it:** the p<.05 crossing is currently a step from
`--dial-step-3` to `--assist-green`, two greens of near-identical contrast (5.63 → 5.73 on
paper). The colour says almost nothing at the exact moment it means the most; the 6px travel is
what would make the crossing legible without touching the palette.

---

## 2. GR4b — flow friction, counted with real taps

All counts are **real dispatched pointer events** against the shipped build. Full traces in
`probe2-ux.txt` and `measurements-ux.txt`.

| flow | target | measured | verdict |
|---|---|---|---|
| **Complete a day, from cold** (360×640, fresh storage, real daily mode) | ≤ 12 | **11** | PASS |
| **Share from the Summary** | ≤ 2 | **1** | PASS |
| **Find the Legend, from anywhere** | ≤ 2 | **1** | PASS |
| **Switch language** | ≤ 2 | **1** | PASS |

**Complete a day — the trace:**

    1.  OPEN THE DATA               briefing → lab
    2–7. six knob taps              greedy hill-climb, no knowledge, p 0.596 → 0.015
    8.  Submit for publication      lab → published
    9.  FACE THE TRUTH              → Call overlay
    10. A real effect               the call → reveal
    11. SEE THE INVOICE             reveal → summary

Six knob taps is close to the honest floor for this day, not a lucky run: a full single-knob
sweep (every option of every fork moved alone from the default, 23 measurements,
`probe2-ux.txt`) finds **no one-tap path to significance at all** — the best single move is
subgroup → Age < 40 at p = 0.091. So an informed player needs at least two, and the naive
hill-climb spends six. Scrolling is not counted as a tap; if it were, the day costs roughly
five long scrolls at 360 (briefing 1,486px, lab 3,009px, published 1,348px, reveal 2,484px,
summary 1,214px).

**Time to first meaningful paint** (`Emulation.setCPUThrottlingRate` +
`Network.emulateNetworkConditions`, `PerformanceObserver` marks read in-page; "playable" =
the loading gate clears and the Briefing is on screen):

| profile | FP | FCP | LCP | playable |
|---|---|---|---|---|
| desktop, no throttle | 36ms | 188ms | 236ms | **177ms** |
| mid-tier mobile (CPU ×4, 1.6Mbps, 150ms RTT) | 536ms | 928ms | 1,032ms | **926ms** |
| slow (CPU ×6, 780kbps, 300ms RTT) | 940ms | 1,660ms | 1,888ms | **1,660ms** |

Under two seconds to a playable briefing on a deliberately punishing profile, cold, with the
service worker cleared. No finding.

**Two Legend affordances exist** (the booked "dual Legend-named buttons"): the header nav page
and the in-Lab `.ph-fork-trail__key-button` popover. Measured: **both render exactly 7 rows from
the same `LEGEND_ENTRIES` mapping**, so they cannot disagree. Verdict: keep both. They answer
different questions at different moments — the popover answers "what is this glyph I just
earned" without leaving the Lab; the page answers "how do I read a share string someone posted".
The only thing I would change is the in-Lab control's label, which currently reads `LEGEND` and
so promises the page it does not open. That is a GR3 call, not a UX one.
*(Controller cross-reference: GR3 reached the same conclusion as [gr3-017] — rename the popover trigger.)*

**Language switch is genuinely non-destructive**, which is worth recording: 1 tap, 334ms,
`document.documentElement.lang` flips to `it`, the player stays on the Lab, and the spec and its
result survive (`p = 0.596 · n = 200 · df = 198` before and after).

---

## 3. GR4c — the one-hand test at 360

**Hit targets: clean.** Every interactive element on the Briefing and the Lab at 360×640,
measured from the live DOM: minimum height **44px** (`.ph-lab__intro-title`,
`.ph-fork-trail__key-button`), minimum width 55px (`Got it`), radios 47–68px tall. R6.4 holds
everywhere I looked, including the six-fork radiogroups where the two-per-row packing could
easily have broken it.

**The sticky dial holds up after a long scroll** — the mechanic works, live, at the worst case.
Scrolled to the very bottom of the 3,009px Lab document on a 640px viewport
(`measurements-ux.txt`):

    {scrollY: 2369, dial: {top: 0, h: 153}, share: 0.24, radiosVisibleBelowDial: 8}

Pinned at `top: 0`, 24% of the viewport, **eight** radio options visible beneath it with the last
knob on screen. T31's regression (knobs unreachable) has not come back, and the 153px figure
R8.1 records is the figure that ships.

**Thumb reach.** Primary actions all land in the lower-left half of the column
(`OPEN THE DATA` x=24 w=160; `Submit` x=24 w=163; `Report null result` x=203 w=133;
`Share` x=24), which is the reachable arc for either hand. The two problems are vertical, not
horizontal, and both are filed above: the briefing's only CTA at docY **1,416** of a 1,486px
document, and the Lab's exit actions above the knobs ([gr4-011]).

**The Briefing's CTA is 2.2 screens down.** At 360×640, `OPEN THE DATA` sits at docY 1,416 —
the player must read (or scroll past) the entire title, goal line, cover story and Grantwell
email before the only action on the screen is visible. That is defensible on day one — the
cover story is the joke — and hostile on day 60, when the same player has already decided to
play. It is not a separate finding because the fix is a product decision, not a layout one, but
it is the single biggest scroll cost in the daily loop and GR2 should see it.

**Keyboard avoidance on the share path: not applicable, and that is the right answer.**
The Summary's share is a one-tap clipboard write with a `role="status"` toast
("Copied to clipboard", verified in all six deep cells) — there is no text input anywhere in the
share path, so no soft keyboard is ever raised and nothing can be occluded by it. The whole app
contains no `<input type=text>`; the only form control outside the radiogroups is the prereg
confirmation checkbox. Nothing to fix.

---

## 4. GR4d — the accessible tree as narrative

**The REVEAL tells Act II's story in order.** Full tree in `a11y-ux.txt`; the reading order
inside `main` is:

    heading (visually hidden): the day's question
    paragraph:  True effect on every outcome measured: 0.000.
    figure:     Fig. 1 — image alt + axis labels + the three-item legend + figcaption
    paragraph:  Of 1792 possible analyses, 76 (4.2%) reach p < .05 by chance alone.
    paragraph:  You explored 5 of them before publishing.
    paragraph:  A researcher randomly exploring 5 … about 23% of the time.
    paragraph:  You published: Metaphor density · Age<40 · …
    paragraph:  VOL. 1, NO. 11
    paragraph:  <the question> + image "RETRACTED: The finding survived peer review and nothing else."
    paragraph:  Your call was wrong.
    figure:     Fig. 2 — image alt + column labels + figcaption
    button:     SEE THE INVOICE

That is §2.7's own sequence — truth line, fig. 1, the accounting, the stamp, the call
resolution, fig. 2 — with no reordering and nothing orphaned. The two figures carry real
`role="img"` alternatives and real figcaptions; the SpecCurve legend is a proper
`list`/`listitem` with its label text inside each item (checked explicitly:
`LI :: "Specification you didn't view" :: children=1`, three rows). Focus lands on
`MAIN.ph-screen` on arrival, so a screen reader announces the landmark and reads from the top.

The narrative has exactly two defects, both filed: the stamp is read twice ([gr4-008]) and the
Call that precedes it announces two dialog boundaries ([gr4-009]).

**Dial live-region calibration: correct, and I would change nothing.** Measured with a
MutationObserver on the live region during a real arrow-key session: three presses faster than
`DEBOUNCE_MS` collapse to **one** announcement; three deliberate presses give **three**. The
`aria-busy` gate does exactly what its comment claims. The one gap is [gr4-015] — nothing
announces that SUBMIT became possible — and the fix for that belongs on the button, not on the
dial.

**The T22-deferred tooltip-pattern note is resolved and should be closed.** R6.7 requires a
pop-up to be a disclosure *or* a tooltip, never both. Live: the trail key is a disclosure —
`aria-expanded` + `aria-controls` on the trigger, `role="list"`/`listitem` on the panel, no
`role="tooltip"` anywhere, opens on hover/focus/tap and closes on Escape and focus-out, with the
7 vocabulary rows present. It also no longer widens the document: with the popover **open**,
`documentElement.scrollWidth === clientWidth` at 320, 360, 768 and 1088 in both themes. The T29
fix-round regression is gone.

**Reduced motion is at parity.** With `prefers-reduced-motion: reduce` emulated through a full
run (`a11y-ux.txt`): the confetti canvas is **never created** (`!!document.querySelector("canvas")
=== false`), every press clipping reports `opacity: 1`, all eight reveal blocks report
`opacity: 1`, and the stamp reports `opacity: 1 / transform: none`. No content is behind an
animation. Shots: `published-reduced-360-paper.png`, `reveal-reduced-360-paper.png`.

**Modal contract, everything except the two filed defects, is right.** Verified live:
`.ph-published__cover` carries both `inert` and `aria-hidden="true"` while the overlay is up;
focus moves to the first option on open; Escape closes the overlay and restores focus to
`ph-published__cta`. The header staying in the AX tree is fine — `aria-modal="true"` on the
overlay is what suppresses it for AT, and the Tab trap keeps a keyboard user inside.

---

## 5. Owner-taste verdicts

1. **Dial-settle 2px — amplify, but not the way it was sketched.** "Numeral weight snap" is
   out-of-law (R2.3: mono is 400 only; R2.4: every numeral is mono). The strongest in-law move
   is to spend R5.3's *existing* 6px "scene arriving" distance at `--dur-scene` on **band
   changes only**, leaving same-band re-settles at 2px / `--dur-quick`. No new token, no glow,
   no pulse, one amendment to R5.2's row 2. See [gr4-023] for the full reasoning and the free
   second amplifier (the p<.05 colour step is currently two near-identical greens).
2. **The three-row (really four-row) header at 360 — confirm ACCEPT.** 267px EN / 318px IT and
   ES, measured. I hunted for the functional defect the ruling asks for and did not find one:
   the header is not sticky, it does not interact with the 153px sticky dial, every control
   clears 44px, and it causes no overflow at 320. The only header change I would make is
   [gr4-013] — stop the nav's buttons shifting when PLAY appears — which is a one-line
   ordering fix, not a redesign. See [gr4-020].
3. **The IT/ES Hayek chyron — confirm FINE AS-IS.** Measured on the real build: 7 lines / 225px
   of headline (312px block) in IT and ES against 4 lines / 129px in EN at 360; 2 lines
   everywhere at 1088. The shot settles it — at 7 lines it still reads as an over-excited
   chyron, not as a layout failure. See [gr4-021].
4. **The masthead watermark, head vs foot — confirm WONTFIX.** The cover stamps it above the
   masthead, the clippings print it below the blurb; those are two objects doing two different
   jobs, and forcing agreement would make one of them wrong. See [gr4-022] for the shot.
5. **What a working designer would screenshot, and what still reads unfinished.**
   - **Would screenshot:** `published-tier3-en-360-paper.png` — the cover, the gold career line,
     two clippings and the chyron in one 360px column, entirely hairlines and type, and it
     holds. `lab-significant-fold-360-paper.png` — an 84px green `0.015` under the day's
     question, with nothing else on the screen asking to be looked at (R8.3's tier-E question,
     answered: no). `reveal-full-768-paper.png` — the specification curve, the accounting and
     the stamp as one continuous document. `chyron-it-360-paper.png`, even at seven lines.
   - **Still reads unfinished:** `call-overlay-containingblock-360x640-paper.png` — the modal's
     question printed through the header's own buttons ([gr4-001]); this is the one shot in the
     set that would stop a reviewer. `stats-populated-360-paper.png` — six rows of `▦▦▦` that
     read as broken glyphs ([gr4-006]). `summary-360-paper.png` — an "Invoice" of one zero row,
     a "Score: 0" two screens after "+25 career points", and a Share button with nothing under
     it, marooned in white space ([gr4-007], [gr4-010]). `error-worker-360-paper.png` — the
     wrong study, offered for play ([gr4-002]).

---

## 6. Checked and clean (so it is not re-hunted)

- **No horizontal overflow anywhere except [gr4-004].** `documentElement.scrollWidth ===
  clientWidth` at **320, 360, 768 and 1088**, both themes, on briefing, lab (including the
  trail-key popover open), published, call, reveal, summary, stats (empty and 30-day), legend and
  prereg — and in `en`, `it` and `es`. The T29 §7.1 residual at 360 is gone; the About page at
  320 is the only survivor.
- **Tap targets**: minimum 44px on every screen measured at 360.
- **Storage-disabled**: the notice renders on every screen, above `<main>`, in `--muted`, and the
  game stays fully playable. Verified with a `localStorage` that throws on every access.
  Shots: `storage-off-{320,360,768,1088}-{paper,dark}.png`.
- **Practice mode** (pre-EPOCH clock, no shim): boots, plays, and prints
  `Vol. 1, No. -3` in the masthead. Shots: `practice-briefing-*.png`. The negative issue number
  is the booked GR1b/GR2 item and is theirs, not this lane's.
- **Screen-change focus** moves to `<main>` on every swap and not on first mount (R6.6).
- **Escape + focus restore** on the Call overlay: correct.
- **Reduced-motion parity**: complete (§4).
- **Fork-trail popover**: no longer widens the document at any width (T29 fix-round regression
  confirmed fixed).
