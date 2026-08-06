# Task T29 — visual polish pass over the assembled game

**Agent:** aesthetics · **Base:** `4b95b82` · **Branch:** `worktree-agent-a33328772cea026ef`
**Files:** `src/ui/**`, `src/game/share.ts` (expanded ownership, pin 11 only), `docs/DESIGN.md`, `tests/**`.
No file under `src/content/**` was touched — zero collision with the copy task this wave.

---

## 0a. STEP 0, and one deviation to flag

The dispatched worktree did not exist: this agent's session was pinned to a worktree of a **different
repository** (`~/PycharmProjects/website`), and `phackle/.claude/worktrees/agent-a33328772cea026ef`
was absent. It was created with
`git worktree add … -b worktree-agent-a33328772cea026ef 4b95b82`, which is exactly what
`git reset --hard 4b95b82` on a zero-commit branch would have produced. Verified before any work:
`git log -1` → `4b95b82`, and both `src/ui/screens/Prereg.tsx` and `src/ui/components/DataCut.tsx`
present (everything merged). `npm ci` clean, `PATH="/usr/bin:$PATH"` on every npm/npx/node command.
Every write in this task used the absolute worktree prefix.

## 0. Method, stated honestly

Every screenshot in `task-T29-shots/` is a capture of the **real production build** — `npm run build`
+ `vite preview` — driven in real headless Chrome over raw CDP (Node 25's native `WebSocket`; no
Playwright/Puppeteer dependency added, nothing committed). This is T31's documented method, reused:

- `Emulation.setDeviceMetricsOverride` sets the **layout** viewport, which is what sidesteps headless
  Chrome's ~500px window-width clamp — so every `ResizeObserver` reports the true container width and
  the figures' viewBoxes track it for real.
- `Storage.clearDataForOrigin` before each navigation, or the PWA service worker serves the previous
  build's content-hashed CSS (this bit T31 once and it bit this task once).
- The app is pre-EPOCH, so it runs in **practice mode with a fresh seed per load**: each shot shows a
  different scenario. That is pre-existing, expected behaviour, not non-determinism in this work.
- Every shot is labelled `<screen>-<width>-<theme>-<before|after>.png`. Widths 360 / 768 / 1280,
  themes paper / dark, plus a 360×640 phone-viewport measurement and a 660px pass where a pin asked
  for one.
- **One temporary source patch** existed only for capture and is NOT committed: three lines in
  `src/main.tsx` exposing `gameStore` on `window`, needed because the Reveal has no UI transition to
  the Summary (see §4, finding X1) and the Summary could not otherwise be reached at all. Reverted
  before the first commit; `git status` at commit time is in §6.

**The playthroughs are real.** `store.changeSpec` debounces `DEBOUNCE_MS = 300` before it dispatches
to the worker *and* before it writes its `VIEW_SPEC` log entry, so the first capture run — which
turned knobs every 220ms — cancelled every commit, logged zero forks and never found significance.
That run was discarded and rerun with a settle step that waits out the debounce and then waits for
`!pending && result !== null`. Every `published`/`call`/`reveal`/`summary` shot below is a genuine
hack to `p < .05` through the real six knobs (the knob-turn count is printed with each shot).

---

## 1. The eleven pins

### Pin 1 — dial-alone-sticky (mobile mechanic restored) ✅

Implemented in the adjudicated shape. `PValueDial` now renders **the numeral and the n/df line only**;
its caption is a separate exported `PValueDialCaption`. `Lab.tsx` hoists the dial into
`.ph-lab__dial`, a direct child of `.ph-lab`, and renders the caption as the first thing in
`.ph-lab__results`.

```css
.ph-lab__dial { position: sticky; top: 0; background: var(--paper); z-index: var(--z-sticky); }
@media (min-width: 768px) {           /* the same, only, breakpoint */
  .ph-lab { display: grid; grid-template-columns: 1fr 1fr; }   /* replaces row-reverse */
  .ph-lab__question { grid-column: 1 / -1; grid-row: 1; }
  .ph-lab__dial     { position: static; grid-column: 2; grid-row: 2; }
  .ph-lab__results  { grid-column: 2; grid-row: 3; }
  .ph-lab__controls { grid-column: 1; grid-row: 2 / span 2; }
}
```

**One documented deviation from the adjudicated CSS, and only one:** every row index is one lower
than the ruling's, because pin 10 (which arrived later) puts a full-width question header in row 1.
The *relationships* the controller adjudicated are exactly preserved — dial above results in column
2, controls in column 1 spanning every pane row — and there is still exactly one breakpoint.

**Evidence — measured, at the bottom of the document, 360px wide:**

| | dial box top | height | on screen? |
|---|---|---|---|
| before | −1396 | 234 | **no** |
| after | **0** | 153 | **yes** |

and on a real 360×**640** phone viewport, scrolled to the knobs
(`lab-phone640-scrolled-360-paper-after.png`):

```
{"vh":640,"dial":{"top":0,"bottom":153,"h":153},"dialShareOfViewport":0.239,
 "radiosVisibleBelowDial":8,"lastRadioTop":517,"lastRadioVisible":true}
```

The dial is pinned **and** eight radio options are visible beneath it, with the last knob on screen —
i.e. the T31 bug (knobs unreachable) has not been reintroduced.

**Honest correction to the ruling's estimate:** the block measures **153px at 360w, not ~85px.**
`--text-dial` clamps to 64px there and the string `p = 0.459` wraps to two lines in a 312px column
(2 × 64 + 26 for n/df). `white-space: nowrap` would overflow (≈345px of glyphs in 312px), so two
lines is the honest floor. 153px is 24% of a 640px phone; the pre-T31 whole-pane sticky was 998px.

**Tests:** `tests/ui/lab.test.tsx` → `T29 pin 1 — dial-alone-sticky DOM structure`, two cases: the
dial block is a direct child of `.ph-lab` ahead of both panes, and the block contains the numeral +
n/df while the caption, both figures and every button are outside it (that second one is the
regression guard against re-fattening the sticky).

**DESIGN.md registered edits:** a new §0 row (the §7.3 two-pane wording → the grid formulation, with
T31's measured numbers as the reason); R3.4 restated to the grid; R8.1 gains the sticky clause and
two `Don't`s. §0's header count went 8 → 10.

**Amended test, justified:** `PValueDial caption (T31)` had a case asserting the caption sits *inside*
`[data-testid="pvalue-dial"]`. That is exactly what the ruling forbids. It is repointed to the **Lab**
— the only place either element renders — and now asserts the stronger, real contract: caption
outside the sticky block, immediately following it, first child of the results pane.

### Pin 2 — DESIGN R5.1 one-word staleness ✅

`animates \`color\`, \`opacity\`, and at most 2px of \`translateY\`` → `animates \`color\` and at most
2px of \`translateY\``. R1.8's rewrite forbids exactly that word; the `Do:` example was already
correct and is untouched.

### Pin 3 — cover-echo consistency ✅

**They could disagree.** `JournalCover` has no volume line at all, so the real pair is the running
header (`App.tsx`) and the reveal's stamp cover-echo (`Reveal.tsx`) — both typed the literal `1` into
`t('briefing.vol', { volume: 1, … })`. They agreed by coincidence, not construction: the first volume
bump ships a header and a cover disagreeing on screen, in the one act whose job is to be believed.

Fixed minimally: `src/ui/masthead.ts` exports `JOURNAL_VOLUME = 1`; both sites read it. `issue` needed
nothing — both already read the store's own `puzzleNumber`.

### Pin 4 — tap targets, Lab intro ✅

- `.ph-lab__intro-title` (the `<summary>`) was a bare 13px line, ~18px tall. Now
  `padding-block: var(--space-12)` + `.ph-lab__collect`'s `border-block-end: 2px solid transparent`
  reserve → 12 + 18.2 + 12 + 2, clears 44.
- `.ph-lab__intro-dismiss` ("Got it") was 42px (24 padding + an unset line-height's ~18) and read as a
  caption: `--muted`, no affordance until hover. Now `--ink`, a **permanent** underline at
  `text-underline-offset: 2px` (R6.2's idiom, the one `.ph-about__link` uses), an explicit
  `--leading-ui`, and the same 2px reserve → 12 + 21 + 12 + 2.

Visible before/after: `lab-intro-360-paper-before.png` vs `…-after.png` — "Got it" goes from a grey
caption to an underlined action.

### Pin 5 — SpecCurve leader line ✅

The leader started at `calloutX = padLeft + 4`; the published path is almost always rank 0, i.e.
`padLeft + plotInset = padLeft + 12`. Eight pixels of run over ~200 of rise: a red line parallel to
the y-axis that reads as axis furniture.

New exported pure function `leaderAnchorX(publishedX, geom)`: anchor at **40%** of plot width, falling
back to **12%** when the published point sits within 12% of that anchor (a player who published a
mid-ranked p, where 40% would be vertical all over again).

**Tests:** four cases in `tests/ui/speccurve.test.tsx` → `T29 pin 5`, including a sweep of the
published point across 0–100% of the plot asserting the run is **never** shorter than 12% of plot
width, and one that reads `x1` off the real rendered figure.

### Pin 6 — call.title uppercase sentence ✅

Presentation-only, as instructed: `.ph-call__eyebrow` drops `text-transform: uppercase` and
`letter-spacing: var(--tracking-label)`. The copy value is untouched. R2.7 satisfied — "Before you see
the reveal…" is a sentence with an ellipsis, and R2.7 permits uppercase on labels only.
Before/after: `call-360-dark-before.png` vs `call-page-360-dark-after.png`.

### Pin 7 — hover re-render breadth ✅

`hovered` lived on `SpecCurve` itself, so every `pointermove` re-ran the whole element tree and diffed
up to 1,792 circles to discover none had changed. The point cloud is now a `memo`'d `<Dots>` child
taking `{ placed, published }` — both already `useMemo`'d over `(points, grouped, geom)`, none of
which a hover touches. The file's own header promise ("RENDER ONCE… hovering swaps a tooltip") is now
literally true of the reconciler and not only of the DOM.

### Pin 8 — press should look like press ✅

Within DESIGN law: **no fill anywhere** (R4.1 still spends the product's one filled area on the
SpecCurve band), no shadow (R4.2), no radius beyond R4.3's 2px, every rule a `--hairline`. What
changed is *anatomy*, done with type and single-edge rules.

**Press clipping** (`PressCard`, reordered): outlet as a **caps-tracked masthead** in `--ink`
(`--weight-medium`) on top → a **dateline hairline** under it → the blurb as a **display-serif
pull-quote** the rule points at → `SIMULATED PRESS` last, as the compliance stamp at the foot rather
than as the item's title, which is where it used to sit.

**Chyron → lower third** (`ChyronBar`): full-column band (not capped at `--measure` — a lower third
that stops two thirds across is a caption), hairline top and bottom, badge, headline, and a **strap**
carrying attribution left and the SIMULATED stamp right. Above R3.4's breakpoint the badge moves into
its own left-hand channel closed by a `border-inline-end: var(--hairline)`.

**No §0 registration was needed and none was invented.** R4.4/R4.5 already sanction a hairline on any
single edge (R4.5 bars four sides and the `border` shorthand); nothing new is derived — no colour, no
fill, no token. That check is what the pin asked for before inventing a treatment.

**One fix found by looking at the shot.** The first cut used the badge channel at *every* width;
~~`published-tier3-360-paper-after.png` (kept as evidence) shows it~~ costing ~94px of a 312px column and
pushing a shipped all-caps chyron to **seven** `--text-28` lines in a ~180px gutter. Below 768px the
badge now stacks above the headline instead. One breakpoint still — the grep gate confirms it.

> **AMENDED IN THE FIX ROUND (review finding, evidence integrity).** The struck clause was wrong.
> `published-tier3-360-paper-after.png` shows the **fixed** stacked layout, not the seven-line defect:
> the final capture run overwrote the earlier before-shots, so no surviving image in
> `task-T29-shots/` shows the badge channel at 360. The ~94px / seven-line numbers were measured live
> in the pre-fix build during the capture pass and are **not** backed by any shot in the set. What the
> published-tier3 shots do prove is the shipped state: badge stacked above the headline at 360, channel
> only at ≥768. `src/ui/screens/Published.css`'s own comment has been corrected to match.

### Pin 9 — DataCut as an analyst's instrument ✅

- **Crisper marks.** The analysed cloud moves from `--dot-all` (1.5px, sized for SpecCurve's
  1,792-point texture) to a new registered `--dot-cut` (2px). At the largest window a column holds 200
  points in ~122 × 88px, where 2px reads as ~26% ink — crisp, with the distribution's shape intact.
  `--dot-explored` (4px) would cover the box outright, which is why it is still not used here.
  **Registered properly:** declared in `tokens.css`, a new §0 row, and added to DESIGN.md §9's Figures
  row. (`tests/ui/tokens.test.ts` requires every token in `tokens.css` to appear in DESIGN.md — it
  passes.)
- **Y-axis furniture**, on SpecCurve's own precedent: three ticks (domain floor / midpoint / ceiling),
  a short `--rule` tick mark and a `--muted` mono `--text-13` label each. `padLeft` grew 8 → **40**
  (both on the closed spacing scale, and 40 is SpecCurve's own padLeft) to make the gutter. This is
  the single change that turns the figure from a cloud into a plot: until now nothing said what the
  vertical axis *meant*, so two means at different heights were a shape rather than a measurement.
- **Group summaries.** Under each column, beneath its name, one mono line: the column's **mean value**
  in `--ink` and its **n** via `t('lab.nLabel', { n })` — an existing key with an existing token,
  separated by the same ` · ` notation `PValueDial`'s own n/df line uses. **No copy value was added.**

**Documented deviation, with the evidence kept.** The pin says the mean bars get their values as
labels; the first cut drew them inside the SVG, right-aligned to each bar's end. The arithmetic is
right (the bar's end clears the 64px jitter cap) but the *label* is ~39px wide and extends back into
the band, so at 360 it printed straight across the cloud — ~~visible in
`lab-intro-360-paper-after.png`, which is deliberately retained as the before-shot for this
correction~~. The caption band has room, nothing to collide with, and reads like a stats-software group
summary. A test pins it: `keeps the mean label out of the plot entirely`.

> **AMENDED IN THE FIX ROUND (review finding, evidence integrity).** The struck clause was wrong, in
> the same way pin 8's was. `lab-intro-360-paper-after.png` shows the **corrected** state — the mean
> and n printed in the caption band, below the plot — not the label-across-the-cloud defect it was
> claimed to retain. Nothing was "deliberately retained": the final capture run overwrote the
> before-shots, so **no shot in `task-T29-shots/` shows the in-SVG label**. The defect was observed
> live in the pre-fix build during the capture pass; the only surviving mechanical evidence for the
> deviation is the test `keeps the mean label out of the plot entirely` in
> `tests/ui/dataCut.test.tsx`, which fails if anyone puts the label back inside the plot.

**Tests:** eight new cases in `tests/ui/dataCut.test.tsx` → `DataCut as an instrument (T29 pin 9)`.

Shots at 360 and 1280, plus 660 (`lab-datacut-660-*`).

### Pin 10 — problem setup coexists with the instructions ✅

`.ph-lab__question` — a `<header>` that is the **first** child of `.ph-lab`, carrying
`scenario.question` read straight from content (data, not a copy key — the same read `Briefing.tsx`
makes). Compact by construction: display serif at `--text-22` with a hairline beneath, never
Briefing's `--text-40` title treatment — this is a reminder, not a second title page, and R8.3 keeps
the dial the only thing that shouts. **Not** part of `.ph-lab__dial`: pin 1's height constraint
stands, and a test asserts it.

**Tests:** two cases — the question renders from content and is `.ph-lab`'s first element child while
being outside the sticky block; and the question + all four how-to-play steps are on screen together.

### Pin 11 (as superseded) ✅

**11-NEW-a — reduced emoji set.** `FORK_EMOJI` now maps `subgroup`/`exclusion`/`tails`/`spec` → `🍴`
and `peek` → `➕`. In-trail vocabulary: exactly two glyphs. Whole vocabulary: seven.
`classifyChange` and every fork-classification path are **untouched** — the four kinds are still four
kinds, which the achievements depend on; only the glyph mapping changed. A **documented deviation
note** sits where `share.ts`'s legend comment cites §2.9.

The Legend page derives from the mapping, but did **not** shrink automatically: `LEGEND_ENTRIES`
listed one row per ForkKind, which would now print `🍴` four times against four different meanings —
a key that contradicts itself. It is now derived by deduplicating on glyph (first declaration wins),
which is what "derives from the mapping" was always supposed to buy. 10 rows → **7**.

*Now-unused `legend.*` copy keys, for the translation roster (NOT deleted or edited — not my lane):*
`legend.emojiSubgroup`, `legend.emojiExclusion`, `legend.emojiTails`.
*Also flagged for the copy owner:* the surviving `legend.emojiSpec` reads "Any specification change
(outcome, covariates or transform)" — still true, but its parenthetical is now incomplete, since 🍴
also covers subgroup, exclusion and tails.

**Test updates, each repointed and none weakened:**
- `share.test.ts`'s §2.9 sample: same log, same transitions, same `countForks(log) === 6`, same peek
  and terminal markers; only the expected glyph run changes (`🍴🎯🍴🔪➕🍴📄` → `🍴🍴🍴🍴➕🍴📄`). A
  **new** test pins the ruling's own acceptance criterion so the set cannot quietly re-expand.
- `legend.test.tsx`: the row-count assertion becomes *strictly stronger* — every glyph the mapping can
  emit is in the key exactly once **and the key carries nothing the mapping cannot emit**.
- `lab.test.tsx` ForkTrail: `🍴🎯` → `🍴🍴`, log unchanged.
- The spoiler property test passes untouched. `EMOJI_TOKENS`'s retired glyphs are kept deliberately
  (the tokenizer must stay total over a pre-T29 saved share string) with a comment saying so.

**11-NEW-b — hover legend at the trail.** A local popover, not a nav lift: `App.tsx`'s `NavPage`
state is untouched and the Legend page is unchanged. `.ph-fork-trail__key` sits immediately after the
glyph run and carries the existing `nav.legend` label; the popover lists `LEGEND_ENTRIES` — the same
mapping the Legend page is built from, so the two cannot disagree and it shrinks with the vocabulary.
Surface follows the SpecCurve tooltip precedent exactly: `--paper`, hairline top and bottom, no fill,
no shadow, no radius, `--z-overlay`. Opens on hover, on focus and on click/tap; closes on
pointer-leave, on focus leaving the whole control, and on Escape. It appears and disappears instantly
— §5's four animations are exhaustive.

**Also (presentation, cheap, serves the same complaint):** the trail's glyph run is set at
`--text-22` with `--tracking-label`, so the two remaining glyphs are legible instead of a compressed
string. The **share string is untouched** — `share.ts` owns it and it is a clipboard format.

**Tests:** six cases → `T29 pin 11-NEW-b`, covering hover, focus, tap, Escape, focus-out, and
"lists exactly the current vocabulary, no glyph twice".

Shots: `lab-trailkey-<w>-<theme>-after.png`, all reporting `7 vocabulary rows`.

---

## 2. Matrix pass — findings and fixes

Full matrix: briefing (fresh + mode chooser), prereg form, lab (first run / many exclusions / discrete
outcome / scrolled / trail key), published (tier < 3 and tier 3), call (overlay and full page),
reveal, summary, stats (empty and populated), legend, about — at 360 / 768 / 1280 × paper / dark,
plus 360×640 and 660.

### M1 (BLOCKER, found by capture) — "Face the truth" opened an empty overlay in the shipped build

`Published.tsx` held `'./registry'` in a `const` behind a vite-ignore annotation — a deliberately
non-analyzable specifier, correct when `registry.ts` did not yet exist in the worktree and a literal
would have failed `tsc` and the build outright. That workaround became wrong the moment the merge made
the module real: an unanalyzable specifier is not rewritten to the built chunk's hashed URL, so in a
**production build** the request resolved to `/assets/registry`, 404'd, hit the `catch`, and returned
`null`.

Reproduced in the real built app over CDP, before the fix:

```
cta click: true
overlay? true
call?    false
overlayHTML  (empty)
LOGS ['Failed to load resource: the server responded with a status of 404 (Not Found)']
```

The whole Act I → Act II hand-off was dead in the shipped artifact and invisible to a jsdom suite that
injects its own loader. This is why the first capture run produced **no** `call/reveal/summary`
before-shots off the Published path — they are captured via the abandon path instead, and that
asymmetry is itself the evidence.

**Fix:** a literal `import('./registry')`. The Published → registry → Published cycle is harmless
because this import is dynamic. The `catch` stays. Verified in the real built app after the fix:

```
attempt 1 turns 19
overlay? true
CALL RENDERS? true
prompt: Between us: what do you think you found?
```

### M2 (R1.1) — `--paper` did not reach the viewport edge, on every screen, at every width

Nothing in this project loads a CSS reset: Tailwind is configured as a Vite plugin but
`@import "tailwindcss"` appears nowhere, so preflight never runs — which left the UA's own
`body { margin: 8px }` in force. Measured at 360×640, dark:

```
{"bodyMargin":"8px","bodyBg":"rgba(0, 0, 0, 0)","htmlBg":"rgba(0, 0, 0, 0)",
 "appRect":{"left":8,"top":8,"width":344},"vw":360,"vh":640}
```

An 8px frame of the browser's **canvas** — not `--paper` — around every screen. In dark that canvas is
the UA near-black against `#141821`; in light it is `#FFF` against `#FBF8F1`. It also forced a
permanent scrollbar, since `.ph-app`'s `100vh` plus 16px of margin always exceeds the viewport.
**Fix:** `body { margin: 0; background: var(--paper); }` in `App.css`, with the measurement in the
comment.

### M3 — the Call had no inline gutter as a full page

`max-width: var(--measure)` does not bind below ~600px, so on the abandon path the prompt and both
option rules sat flush against the viewport edge at 360 — the only screen in the product that did,
against every other screen's `--space-24`. **Fix:** `.ph-call { padding: var(--space-40) var(--space-24) }`,
and `.ph-call-overlay` drops its own inline padding so the two never stack into an unmeasurable 48
(net inset inside the overlay is unchanged at 24, so the overlay shots stay valid). Measured after:
`option box {"left":32,"right":328,"vw":360}` — a real, symmetric gutter.

### M4 — the Call overlay could clip a tall dialog with no way to reach either end

A centred flex child taller than the viewport is cut off at *both* ends. **Fix:** `overflow-y: auto`
on `.ph-call-overlay`. Not visible in English today; it is the failure mode a longer locale hits
first.

### M5 — the Legend's glyph column clipped the two-glyph call markers

`.ph-legend__glyph { width: 2ch }` with `flex: none` let `⚖️✅` / `⚖️❌` spill over the gap into their
own label. **Fix:** `min-width: 2ch` — the column still aligns at 2ch for every single-glyph row.

### Considered and deliberately NOT changed

- **The reveal's stamp overlaps the cover echo's Vol./No. line** at every width. This is R8.2 working
  as specified — the stamp slams *onto a cover*, and a stamp that avoids the paper is not a stamp. The
  question (the thing that matters) stays legible, the Vol./No. line is redundant metadata also
  present in the running header, and the stamp renders "RETRACTED"/"NULL REPORTED" as real text for
  assistive technology (R6.3). Changing it would be taste overriding a rule.
- `.ph-stamp__mark { width: min(100%, 320px) }` is a raw px cap outside the scale. Pre-existing; R3.1
  governs margin/padding/gap and R2.2 font-size, so it is neither, and the tier-C grep does not (and
  should not) catch it. Flagged, not churned.

### Open finding, NOT fixed — out of lane

**X1 — the Summary screen is unreachable in the app.** `store.finishReveal()` (`reveal → summary`)
has **no caller anywhere in `src/ui/**`**. `grep -rn finishReveal src` returns the store's own
definition and nothing else; the Reveal renders six blocks and stops. Every `summary-*` screenshot in
this report was reached by calling `finishReveal()` through the temporary capture harness. Fixing it
needs a button, which needs a copy value — and copy belongs to the sibling task this wave. Flagged
here as a shipping blocker for whoever owns it.

---

## 3. Grep gates — all clean

```
$ grep -rnE 'border:\s' src/ui                                   # R4.5   -> (nothing)
$ grep -rnE '\bz-index:\s*[0-9]' src/ui                          # R4.7   -> (nothing)
$ grep -rn '<select' src/ui                                      # R6.5   -> 1 hit, a comment
$ grep -rnE '@media \(min-width:' src/ui | grep -v '768px'       # R3.4   -> (nothing)
$ grep -rn 'transition: all' src/ui                              # R5.5   -> (nothing)
$ grep -rn 'box-shadow' src/ui                                   # R4.2   -> (nothing)
$ grep -rn 'border-radius' src/ui                                # R4.3   -> 1 hit, `0`
```

Enumerating gates:

- `grep -rnE '\b(transition|animation):' src/ui` → **exactly four**: the dial tick (R5.1), the stamp
  slam and its folded-in shake (R5.2), the reveal's scroll fade (R5.3). The popover added in pin 11-b
  appears and disappears instantly, by design.
- `grep -rn 'var(--sig-red)' src/ui` → 9 hits: the threshold rule + label, the published dot + ring +
  leader (SpecCurve), the stamp's stroke + fill, the Act II accounting figure (`Reveal.css`), and
  `--sig-band`'s derivation in `tokens.css`. R1.3's four places plus R1.3a's band. **The Lab still
  contains none.**
- `grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css` → every hit is a sanctioned 2px (R4.6's
  selection underline, R6.2's underline offset) or the 768px breakpoint. Nothing new was introduced
  outside those.

---

## 4. Tests

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  46 passed (46)
      Tests  1113 passed (1113)
$ PATH="/usr/bin:$PATH" npx tsc --noEmit ; echo $?
0
$ PATH="/usr/bin:$PATH" npx eslint . ; echo $?
0
```

**+24 tests** (1089 → 1113). Every amended assertion is listed above with its justification; there are
four, all of them presentation changes the pins mandate: the dial caption's DOM position (pin 1), the
§2.9 sample's glyph run and the ForkTrail's glyph run (pin 11-NEW-a), and the Legend's row count
(pin 11-NEW-a, replaced by a strictly stronger statement).

---

## 5. Shot index

All under `.superpowers/sdd/2026-08-03-phackle-v1/task-T29-shots/`, named
`<screen>-<width>-<theme>-<before|after>.png`.

| Screen / state | Widths × themes | Shows |
|---|---|---|
| `briefing`, `briefing-chooser` | 360/768/1280 × paper/dark | unchanged except M2's edge-to-edge paper |
| `prereg` | 360/768/1280 × paper/dark | the prereg form, both themes |
| `lab-intro` | 360/768/1280 × paper/dark | **pins 1, 4, 9, 10** in one frame |
| `lab-excluded` | 360/768/1280 × paper/dark | DataCut with many crossed exclusions (`|z| > 2`) |
| `lab-discrete` | 360/768/1280 × paper/dark | tie-heavy discrete outcome (Y₄, 1–10 scale) |
| `lab-scrolled` | 360/768/1280 × paper/dark | **pin 1**, with the dial box measured in the log |
| `lab-phone640-scrolled` | 360×640 paper | **pin 1** on a real phone viewport, knobs reachable |
| `lab-trailkey` | 360/768/1280 × paper/dark | **pin 11-NEW-b**, popover open, 7 vocabulary rows |
| `published` | 360/768/1280 × paper/dark | **pin 8** press clippings |
| `published-tier3` | 360/1280 × paper/dark | **pin 8** the lower-third chyron |
| `call` | 360/768/1280 × paper/dark | the overlay; **pin 6** |
| `call-page` | 360/1280 × paper/dark | the abandon path; **M3**'s gutter |
| `reveal` | 360/768/1280 × paper/dark | **pins 3, 5, 7** |
| `summary` | 360/768/1280 × paper/dark | reached via the harness (finding X1) |
| `stats`, `stats-populated` | 360/768/1280, 360/1280 | empty and with six days of history |
| `legend` | 360/768/1280 × paper/dark | **pin 11-NEW-a**, 10 rows → 7 |
| `lab-datacut-660` | 660 × paper/dark | **pin 9** at the width the pin asked for |
| `about` | 360/768/1280 × paper/dark | unchanged |

Measurements printed alongside the shots (all from the live DOM of the real build):

```
lab-scrolled-360-paper-before   dial box {"top":-1396,"bottom":-1162,"h":234,"onScreen":false}
lab-scrolled-360-paper-after    dial box {"top":0,"bottom":153,"h":153,"onScreen":true}
lab-phone640-scrolled-360-paper {"vh":640,"dial":{"top":0,"h":153},"dialShareOfViewport":0.239,
                                 "radiosVisibleBelowDial":8,"lastRadioTop":517,"lastRadioVisible":true}
lab-trailkey-*-after            "fork-trail key open, 7 vocabulary rows"   (every cell)
lab-datacut-660-paper-after     {"viewBox":"0 0 612 92","cssWidth":612,"ticks":3,
                                 "means":["5.46","5.44"],"ns":["n = 97","n = 103"]}
call-page-360-paper-after       option box {"left":32,"right":328,"vw":360}
published-tier3-360-paper-after chyron {"headlineWidth":312,"headlineHeight":129,"vw":360}
published-tier3-1280-paper-after chyron {"headlineWidth":953,"headlineHeight":64,"vw":1280}
```

`lab-datacut-660`'s `viewBox` width equalling its measured CSS width is T16/T31's scale-invariance
property re-confirmed in the real browser after pin 9 changed `padLeft`: 1 user unit is still 1 CSS
pixel, so `var(--text-13)` on the new tick labels really is 13px.

---

## 6. Commits

Branch `worktree-agent-a33328772cea026ef`, five commits on top of `4b95b82`. **189 screenshots** in
`task-T29-shots/`.

| SHA | Subject | Pins |
|---|---|---|
| `6a9d525` | `fix: restore the Lab's live dial on mobile, and put the day's question on it` | 1, 2, 4, 10 |
| `dbda823` | `fix: one masthead volume, a sentence-case call eyebrow, and a leader that reads as a pointer` | 3, 5, 6, 7 |
| `9fbd1ba` | `feat: press that reads as press, and a DataCut that reads as an instrument` | 8, 9 |
| `478fd00` | `feat: reduce the fork emoji vocabulary to two glyphs, and put the key at the trail` | 11-NEW-a, 11-NEW-b |
| `c9ea4ce` | `fix: matrix pass — Face-the-truth loads its screen, and paper reaches the edge` | matrix M1–M5 |

**Disclosed:** these five are thematic slices of **one** verified working tree. The full gate below
was run (and its exit code checked) against that complete tree immediately before the series; the
intermediate commits are not individually green, because the pins interleave in the same files
(`Lab.tsx`/`Lab.css` alone carry pins 1, 4 and 10, and `tests/ui/lab.test.tsx` carries pins 1, 10 and
11-b). `HEAD` is green — that is the state verified. Also disclosed: DESIGN.md's `--dot-cut`
registration (§0 row + §9's Figures row) landed in `6a9d525` with the other registered edits rather
than in `9fbd1ba` where the token is consumed; both shipped in the same tree, and it is called out in
`c9ea4ce`'s message rather than rewritten.

Gate at `HEAD`, exit codes checked:

```
$ PATH="/usr/bin:$PATH" npx vitest run   ; echo $?   ->  0   (46 files, 1113 tests)
$ PATH="/usr/bin:$PATH" npx tsc --noEmit ; echo $?   ->  0
$ PATH="/usr/bin:$PATH" npx eslint .     ; echo $?   ->  0
$ PATH="/usr/bin:$PATH" npm run build    ; echo $?   ->  0
$ git status --short                                 ->  (clean)
```

The temporary `src/main.tsx` capture harness is reverted; `grep -c __phackleStore src/main.tsx` → 0,
and it appears in no commit.

---

## 7. Fix round 1 (review findings) — appended by the fix-round agent

Base `c9ea4ce`, one commit on top. Scope was the review's 5 Important + 2 Minor findings only; the
design work is unchanged. The two amendment blocks above (pins 8 and 9) belong to this round.

### 7.1 The functional defect — the popover widened the document

`.ph-fork-trail__popover` was `width: max-content; max-width: var(--measure)` anchored
`inset-inline-start: 0` on `.ph-fork-trail__key`, a control that sits mid-row. Reproduced in the real
built app over CDP before touching anything (same method as §0; `vite preview` + headless Chrome,
`Emulation.setDeviceMetricsOverride`, storage cleared per navigation):

```
BEFORE   360 paper/dark   innerWidth 360  clientWidth 345  documentScrollWidth 585  png 585 wide
BEFORE   768 paper/dark   innerWidth 768  clientWidth 753  documentScrollWidth 949  png 949 wide
                          popover rect {"left":163,"right":585,"width":421}   (360)
```

Opening the legend gave the whole page a horizontal scrollbar. (The review quoted 619 / 991 from the
committed shots; this run measures 585 / 949 — same defect, ~15px of it is this Chrome's scrollbar
and the rest is the key's x-position, which moves with the per-load practice scenario.)

**Fix:** `position: relative` moves from the key to `.ph-fork-trail` (the full-width row), and the
popover is capped at `max-width: min(var(--measure), 100%)`. `100%` now means *the column*, which is
the only bound that cannot overflow; `--measure` still holds the line length down on wide screens.
No new token, no new breakpoint, no new colour — the grep gates are re-run and clean.

**After, measured in the same page load with the popover CLOSED and then OPEN:**

| cell | closed scrollWidth | open scrollWidth | clientWidth | popover rect | png width |
|---|---|---|---|---|---|
| 360 paper | 347 | **347** | 345 | `{left:24,right:345,width:321}` | 347 |
| 360 dark  | 345 | **345** | 345 | `{left:24,right:345,width:321}` | 345 |
| 768 paper | 753 | **753** | 753 | `{left:389,right:753,width:365}` | 753 |
| 768 dark  | 753 | **753** | 753 | `{left:389,right:753,width:365}` | 753 |

The popover now contributes **exactly zero** to document width: closed == open in every cell, and the
popover's right edge lands on the client edge, never past it.

**One residual, pre-existing, NOT introduced and NOT fixed here (out of lane):** at 360 the paper cell
reports 347 against a 345 client width. It is present with the popover **closed** as well, and the
offenders are `DIV.ph-header__controls` / `BUTTON.ph-toggle` in the app header — a 2px overflow in the
masthead's own controls, unrelated to the fork trail. Flagged for whoever owns the shell.

**Shots re-captured** (the four defective ones overwritten in `task-T29-shots/`):
`lab-trailkey-{360,768}-{paper,dark}-after.png`. The 1280 pair was never defective and is untouched.

### 7.2 The other six findings

| # | Finding | Fix |
|---|---|---|
| 2 | stale `~85px` in two places, disproved by T29's own 153px measurement | corrected in `docs/DESIGN.md` R8.1 and `src/ui/screens/Lab.css`, both now stating the measured 153px at 360w with the arithmetic |
| 3a | `Published.css` cited a shot showing the FIXED state as evidence of the defect | comment rewritten: it now describes the defect and the fix and states plainly that no surviving shot shows the seven-line state |
| 3b | pins 8 and 9 made the same class of claim | both amended in place above, struck-through and annotated, not silently rewritten |
| 4 | no guard against the `@vite-ignore` bug class | `tests/ui/tokens.test.ts` now fails on the pragma anywhere in `src/**` (3 cases, incl. a self-check); `registry.t15.patch.md`'s approving bullet corrected |
| 5 | `legend.emojiSpec` under-described what 🍴 now marks | rewritten to name all six knobs in `Spec` declaration order; `it`/`es` are booked separately and untouched |
| 6 | hover-open + click-toggle on one control: a first tap opened then closed it | `pointerenter`-typed suppression plus a swallowed post-hover click; 3 new tests, all three verified failing against the old handler |
| 7 | caption is now state-independent, so nothing caught re-gating it on `result` | Lab-level test asserting the caption before any first result exists (boot parked on a never-resolving `runSpec`), verified failing when wrapped in `{result && …}` |

The touch fix is also confirmed in the real browser: the capture harness drives the genuine mobile
sequence (compatibility `mouseenter`, then `click`) and needed a `click`-only fallback to get an open
popover **before** the patch; after it, all four cells report `open=true via mouseenter+click`.

### 7.3 Gate at the fix-round HEAD, exit codes checked

```
$ PATH="/usr/bin:$PATH" npx tsc --noEmit ; echo $?   ->  0
$ PATH="/usr/bin:$PATH" npx eslint .     ; echo $?   ->  0
$ PATH="/usr/bin:$PATH" npx vitest run   ; echo $?   ->  0   (46 files, 1120 tests, +7)
$ PATH="/usr/bin:$PATH" npm run build    ; echo $?   ->  0
```

The capture harness lives in the session scratchpad and is **not** committed; no source patch was
needed this round (the popover is reachable without one).
