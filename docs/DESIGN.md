# P-hackle — Design law

**Direction:** "Preprint Gothic, Nothing-disciplined" · **Approved:** 2026-08-03 ·
**Status:** binding on T5, T14–T18, T29 and every UI change after them.

The game about academic publishing looks like academic publishing — paper, ink,
hairlines, figure captions, tabular numerals — executed with hard restraint. One
loud colour. Eight registered motion sites on one duration scale. No boxes.
The tension between warm-paper academia and cold accounting is the Act I /
Act II split made visual.

**How to use this document.** Every rule below names an exact value or an exact
token, and is decided by a test, a grep, or a look at the diff — not by taste.
The single exception is R8.3, which is a judgement call and is labelled as one;
§10 states the tier of each of the 49 rules exactly once. Cite rule ids in review
("violates R2.4"). Where a rule and your layout disagree, the rule wins; if the
rule is wrong, change it here first, in a commit of its own.

**Precedence.** `docs/implementation_plan.md` §7 → this document → your judgement.
This document only narrows §7; it never invents a different product.

---

## §0 Reconciliation with master spec §7

The approved direction narrows eleven pieces of §7 wording (eight at approval;
rows 7 and 8 were added by T29's controller-adjudicated layout ruling and its
DataCut figure pin; the motion row below was added by T35 on an owner
directive). These are recorded, not silently applied — revert any of them by
editing this section and the rule it points at.
The last row is also the **registry of derived colours** that R1.3a and R1.6
depend on: a colour derived from the §7.2 palette exists only if it appears both
in `tokens.css` and in this table.

| Master spec says | This document says | Why |
|---|---|---|
| §7.3 "paper-white **cards**", "skeuomorphic email card", "press blurb cards", "two large option cards" | Every "card" is a **hairline-ruled block** on `--paper`: no fill, no shadow, no 4-side border (R4.1, R4.2, R4.5) | The delta spec's direction A ("hairlines instead of boxes") wins over §7 by its own precedence clause |
| §7.4 "significant region **tint**" | Kept, and it is the **one** filled area in the product, at exactly `--sig-band` (R4.1) | A data region in a figure is not chrome; §7.4 pins it explicitly, so it survives as a named exception |
| §7.1 stamp "+ subtle paper-shake" | Folded **into** the single 450ms stamp timeline, ≤2px, not a second animation beside it (R5.4) | Keeps §5's register exhaustive without dropping the effect |
| §7.2 `--hack-gold` for "career points" (i.e. text) | Gold on characters uses `--hack-gold-ink` (R1.6) | `--hack-gold` is 2.94:1 on paper — it fails §7.5's 4.5:1 floor as text. §7.2's hex is unchanged |
| Direction: the "**glowing** dial" | The dial is prominent by **size and colour only** — no shadow, no halo (R8.1) | R4.2 bans shadows; scale is the louder instrument anyway |
| §7.2 lists `--assist-green` for "REPLICATED" among its uses, without restricting it to inline text | R1.5's inline-only (≤1em) rule gets one named exception: the REPLICATED verdict stamp renders in `--assist-green` at display scale, exactly parallel to R1.3's RETRACTED-stamp entry for `--sig-red` | A verdict stamp is a signature moment (R8.2), not the ambient chrome R1.5's "never a fill" discipline targets; direction A's single-loud-colour discipline governs chrome, not the verdict itself |
| §7.2's dial prose ("colour interpolating from `--muted` toward `--sig-red` as p → .05") vs §2.4 ("color ramps toward green... crossing triggers a glow") | The Lab's `PValueDial` (R8.1's Act I signature, `--text-dial` scale) steps `--muted` → `--dial-step-1` → `-2` → `-3` → `--assist-green` as p crosses .5/.2/.1/.05, never `--sig-red` — R1.5 gets a **second** named exception (alongside the REPLICATED stamp) for the final, solid-green step; R1.8 is amended to match | §2.4 is explicit that reaching significance is *desirable* in Act I ("significance is DESIRABLE in Act I" per the T14 controller pin); `--sig-red` stays exactly R1.3's four Act II places (the RETRACTED stamp, the reveal's .05 threshold rule+label, the published path+leader line, the Act II accounting figures) — none of which is the Lab, so its grep-countable "four places" stays literally true only if the dial never touches red at all. A continuous opacity ramp toward the same two tokens was tried first and rejected: on a light-on-paper token, reducing opacity alpha-composites toward `--paper` and collapses contrast (1.60:1 at p=1.0 light, 1.70:1 dark) — see the T14 fix-round report for the exact numbers. Discrete, contrast-verified steps are what actually keeps R1.8's own "stays ≥4.5:1" claim true |
| §7.3 "two-pane above, stacked below" — which R3.4 restated as `flex-direction: row-reverse` | The Lab's ≥768px layout is a **two-column grid**: question across row 1, dial (row 2) and results (row 3) in column 2, controls in column 1 spanning rows 2–3 (R3.4). Below 768px it is still one stacked column in DOM order, and the **dial block alone** is `position: sticky; top: 0` (R8.1) | T31 removed the mobile stickiness on measured evidence: the whole results pane grew to 998px on a 360×640 phone, and a sticky element taller than the viewport slides to the end of its containing block and paints over its sibling — the six knobs were unreachable. The cost was §2.4's live-dial mechanic. Restoring it needs the *dial alone* to be sticky as a direct child of `.ph-lab`, so its containing block spans the controls; `row-reverse` cannot then keep the dial and the results in one column with the controls spanning both rows, and a grid can. One breakpoint still, no new tokens, no fill |
| §7.5 "Motion budget: confetti, stamp slam, p-value tick, scroll fades — **nothing else**" | A registered motion **system** (§5): one duration scale (`--dur-quick`/`--dur-scene`/`--dur-stagger`), one easing, and **eight** sanctioned sites — §7.5's four, plus the screen transition, the reveal-block stagger, the press-clipping entrance and the copy confirmation. The list is still exhaustive, still compiled (`tests/ui/motion.test.ts`), and §7.5's own reduced-motion sentence is strengthened rather than relaxed: R5.6 makes "collapses all to opacity/instant" a parity guarantee with a no-content-behind-motion clause | Owner directive, third play-test round: "the UX/UI should be more animated, it reads a bit plain right now". §7.5's four-item list was written as a budget, and a budget can only be held by refusing — which is precisely how the product ended up with **no** beat on its single biggest state change, the screen swap, with R5.5 naming "page transitions" as forbidden. Replacing the enumeration with a scale keeps the restraint (a site is added by amending R5.2's table, and must still clear "a beat that tells the player something happened") while letting the moments that carry meaning actually carry it. Nothing was relaxed: raw durations, raw easings and layout-property animation are all newly **banned** by R5.1/R5.3, none of which §7.5 said anything about |
| §7.4's three figure radii, read as the complete set | A **fourth** figure radius exists, `--dot-cut` (2px), declared in `tokens.css` and used only for the DataCut's analysed sample | §7.4's `--dot-all` (1.5px) is sized for the SpecCurve, where 1,792 points share one plate and the cloud is a texture. The DataCut draws ~200 points as the figure's entire subject in a 122×88px column; at 1.5px they read as haze, and at `--dot-explored` (4px) as a solid slab. 2px is the only value between them, and it is registered here rather than typed inline so R2.2/R3.1's "no raw px" grep stays true and the figure and its legend swatch can never drift |
| §7.2 fixes **seven** colours | Exactly **six** are derived from them, all declared in `tokens.css`: `--hack-gold-ink` (from the gold hue, R1.6), `--sig-band` (`color-mix` of `--sig-red` at 6%, R4.1), `--scrim` (`color-mix` of `--ink` at 60%, R4.2's Call-modal backdrop), and `--dial-step-1`/`-2`/`-3` (PValueDial's stepped ramp, `color-mix(in srgb, var(--muted), var(--assist-green) 25/50/75%)`, computed offline and hardcoded as literal hex so `tests/ui/tokens.test.ts` can contrast-check them directly — R1.8). None counts as a new colour against R1.3 or R1.6; any seventh derivation must be added to this row first (R1.3a) | §7.5's contrast floor forces the first, §7.4's tint forces the second, R4.2's "separate the Call modal from the cover" backdrop forces the third, and R1.8's stepped Act-I ramp forces the last three — registering them keeps "one loud colour" and "seven fixed values" literally true |

---

## §1 Palette

`src/ui/theme/tokens.css` is the only file in the repository permitted to contain
a colour literal. The seven master-spec §7.2 values in it are fixed forever.

**R1.1 — Surfaces are `--paper` and nothing else.** No grey stripes, no tinted
panels, no "subtle" secondary background.
- Do: `background: var(--paper);`
- Don't: `background: #F2EFE8;` — a second surface colour does not exist.

**R1.2 — Text is `--ink` or `--muted`.** `--muted` is for captions, footnotes,
axis labels, and the quiet "Report a null result" action. Everything else is `--ink`.
- Do: `color: var(--muted);` on a figure caption.
- Don't: `color: var(--ink); opacity: 0.6;` — faded ink is not a colour, it is an
  untestable contrast bug.

**R1.3 — `--sig-red` is the single loud colour, and appears in exactly four
places:** the RETRACTED stamp; the p = .05 threshold rule and its label; the
published path point and its leader line; the Act II accounting figures for
p < .05. Nowhere else, in either theme.
- Do: `stroke: var(--sig-red);` on the threshold rule.
- Don't: `color: var(--sig-red);` on the Submit button — a fifth red use dilutes
  the four that carry meaning.

**R1.3a — `--sig-band` is a derived token, not a fifth place.** It is mixed from
`var(--sig-red)` inside `tokens.css`, declared there, and registered by name in
§0; R4.1 sanctions its single use. The general rule, which `--hack-gold-ink`
and `--scrim` (R4.2's Call-modal backdrop, mixed from `--ink`) also obey:
**a derived colour must be declared in `tokens.css` and registered in
§0's table — otherwise it does not exist, and it gets no exemption from R1.3 or
R1.6.** This is what makes R1.3 countable: `grep -rn 'var(--sig-red)' src/ui`
enumerates every use, and each hit must be one of the four places or the
band.
- Do: mix a new derived colour in `tokens.css` and add a §0 row for it.
- Don't: write `color-mix(in srgb, var(--sig-red) 20%, var(--paper))` inline in a
  component — an unregistered derivation is a new loud colour wearing a disguise.

**R1.4 — `--rule` draws 1px hairlines only.** Never text, never a fill.
- Do: `border-bottom: var(--hairline);`
- Don't: `color: var(--rule);` — it is 1.42:1 on paper and illegible by design.

**R1.5 — `--assist-green` appears only inline at text scale (≤1em)** — the
REPLICATED verdict word, the integrity-bonus line, "better" deltas. Two
exceptions (both registered in §0): the REPLICATED verdict stamp renders in
`--assist-green` at display scale, exactly parallel to R1.3's stamp entry for
`--sig-red`; and the Lab's `PValueDial` (R8.1's Act I signature, `--text-dial`
scale) turns `--assist-green` once its p < .05 — R1.8's colour rule, Act I's
half.
- Do: `<em style="color: var(--assist-green)">REPLICATED</em>` at `--text-15`;
  or `color: var(--assist-green)` on the PValueDial numeral once p < .05.
- Don't: `background: var(--assist-green);` on a success banner — green is never a
  fill, a button, or a background.

**R1.6 — `--hack-gold` paints marks, `--hack-gold-ink` paints characters.** Gold
marks: confetti particles, the achievement-wall glyph strokes. Any gold that a
reader must *read* uses `--hack-gold-ink` (5.03:1 light, and in dark the two are
the same value because gold is already text-safe there).
- Do: `color: var(--hack-gold-ink);` on the career-points number.
- Don't: `color: var(--hack-gold);` on the career-points number — 2.94:1 fails §7.5.

**R1.7 — No colour literal outside `tokens.css`.** No hex, no `rgb()`, no `hsl()`,
no named CSS colours in `src/ui/**`.
- Do: `color: var(--ink);`
- Don't: `color: black;`

**R1.8 — The dial's colour steps through exactly five states, all at full
opacity: `--muted` → `--dial-step-1` → `--dial-step-2` → `--dial-step-3` →
`--assist-green`** (§0's dial-prose reconciliation row) — never `--sig-red`,
which stays Act II's alone (R1.3's four places are all on the reveal). The
band is p's own value, not a continuous function of it: `p > .5` reads
`--muted`; `.2 < p ≤ .5` reads `--dial-step-1`; `.1 < p ≤ .2` reads
`--dial-step-2`; `.05 ≤ p ≤ .1` reads `--dial-step-3`; `p < .05` is solid
`--assist-green` (R1.5's second exception — significance is desirable in Act
I). `--dial-step-1/-2/-3` are `color-mix(in srgb, var(--muted),
var(--assist-green) 25/50/75%)`, computed offline and hardcoded as literal
hex in `tokens.css` (§0's derived-colour registry) rather than a live
`color-mix()` — both because R1.3a bans `color-mix()`/`color-contrast()`
outside `tokens.css` (`tests/ui/tokens.test.ts` fails the build on a hit
anywhere else in `src/ui`) and because a literal hex is what lets that same
suite parse and contrast-check each step directly: all five states are text
tokens in `TEXT_TOKENS`, so "stays ≥4.5:1 in both themes" is compiled, not
merely asserted (§10 tier B). No opacity is ever used to signal the band —
an opacity ramp toward `--paper` was tried and rejected for exactly this
reason (see §0's reconciliation row for the numbers); the settle (§5's
site 2) may still animate `color` and `transform` on a band change, never
`opacity`.
- Do: switch `color` outright between the five tokens by `dialBand(p)` — see
  `src/ui/components/PValueDial.tsx`.
- Don't: `color: color-mix(in oklab, var(--muted), var(--assist-green) …);` in
  a component file — R1.3a's grep fails the build on any `color-mix(` outside
  `tokens.css`.
- Don't: set `opacity` on the dial's numeral to signal proximity to .05 — it
  alpha-composites toward `--paper` and silently breaks the 4.5:1 floor.
- Don't: reference `var(--sig-red)` anywhere in the Lab.

---

## §2 Type

**R2.1 — Three families, by role, no exceptions.** `--font-display` (STIX Two
Text) for headlines, scenario prose and reveal paragraphs; `--font-ui` for labels,
buttons and navigation; `--font-mono` (JetBrains Mono) for every numeral.
- Do: `font-family: var(--font-display);` on the scenario title.
- Don't: `font-family: var(--font-ui);` on reveal prose — the manuscript register
  is the satire.

**R2.2 — Five sizes exist: `--text-13`, `--text-15`, `--text-22`, `--text-28`,
`--text-40`** (plus `--text-dial`). Display/prose uses 22/28/40; UI labels use
13/15. No other size may be typed anywhere.
- Do: `font-size: var(--text-22);` for body prose.
- Don't: `font-size: 18px;` — 18 is not on the scale, and picking it once means
  picking it forever.

**R2.3 — Two weights exist: `--weight-regular` (400) and `--weight-medium` (500).**
Mono is never anything but 400.
- Do: `font-weight: var(--weight-medium);` on a section heading.
- Don't: `font-weight: 700;` anywhere — and never bold mono, at any weight token.

**R2.4 — Every numeral is mono and tabular.** p-values, N, df, coefficients,
scores, streaks, countdowns, puzzle numbers. `font-variant-numeric: tabular-nums`
is mandatory so digits do not jitter as they change.
- Do: `font-family: var(--font-mono); font-variant-numeric: tabular-nums;`
- Don't: render `p = 0.049` in `--font-display` — proportional digits shift the
  layout on every keystroke of the garden.

**R2.5 — The dial is `--text-dial`** (`clamp(64px, 11vw, 96px)`), line-height
`--leading-dial`, centred. N and df sit under it at `--text-13`.
- Do: `font-size: var(--text-dial);`
- Don't: `font-size: 80px;` — a fixed dial size breaks the 360px viewport.

**R2.6 — Line-height comes from a token:** `--leading-display` (1.15) for 28/40,
`--leading-prose` (1.45) for 22, `--leading-ui` (1.4) for 13/15, `--leading-dial`
(1) for the dial.
- Do: `line-height: var(--leading-prose);`
- Don't: `line-height: 1.6;`

**R2.7 — Uppercase labels carry `--tracking-label` (0.08em); nothing else is
uppercased.** Headlines and prose are sentence case.
- Do: `text-transform: uppercase; letter-spacing: var(--tracking-label);` on
  "CORRESPONDING AUTHOR".
- Don't: `text-transform: uppercase;` on a headline — shouting is not restraint.

**R2.8 — Prose never exceeds `--measure` (62ch).**
- Do: `max-width: var(--measure);` on every paragraph container.
- Don't: let reveal text run the full width of a 1440px window.

---

## §3 Spacing & layout

**R3.1 — The spacing scale is closed: 4, 8, 12, 16, 24, 40, 64.** Every margin,
padding and gap is one of `--space-4`, `--space-8`, `--space-12`, `--space-16`,
`--space-24`, `--space-40`, `--space-64`. No arithmetic, no `em` padding, no `auto`
fudging (except `margin-inline: auto` for centring).
- Do: `padding: var(--space-16) var(--space-24);`
- Don't: `padding: 18px 20px;`

**R3.2 — Sections are separated by `--space-40`.** That is the page rhythm; a
reader should be able to measure it.
- Do: `margin-block-start: var(--space-40);` on each reveal block.
- Don't: `margin-block-start: var(--space-24);` on some sections and 40 on others.

**R3.3 — `--space-64` is reserved for page margins and act transitions.** Two 64s
inside one section means the section is really two sections.
- Do: use it for the gap between the Published takeover and the Call.
- Don't: use it as a paragraph gap.

**R3.4 — One breakpoint exists: 768px** (master spec §7.3: two-pane above,
stacked below). A second breakpoint is a design failure, not a fix. **The Lab's
two panes are a grid, not a reversed row** (T29 registered edit, §0's last-but-one
row): below 768px `.ph-lab` stacks its children in DOM order — question, dial,
results, controls; at and above it, `display: grid; grid-template-columns: 1fr 1fr`
puts the question across row 1, the dial and the results in column 2 (rows 2 and 3),
and the controls in column 1 spanning both. `flex-direction: row-reverse` cannot
express that: it can only order siblings, and the dial and the results must stack
inside the *same* column while a third child spans both of their rows.
- Do: `@media (min-width: 768px) { … }`
- Don't: `@media (min-width: 1024px) { … }`
- Don't: reach for a second breakpoint because one pane got taller — the pane is
  the wrong element to make sticky (R8.1's note).

**R3.5 — The page column is capped at `--page-max` (68rem) and centred.**
- Do: `max-width: var(--page-max); margin-inline: auto;`
- Don't: full-bleed layouts, except the Published takeover, which §7.3 pins as
  full-bleed by name.

**R3.6 — Stacks are hairline-separated lists, not grids of cards.**
- Do: a `<ul>` whose items carry `border-bottom: var(--hairline)`.
- Don't: `display: grid; gap: 16px;` over bordered tiles.

---

## §4 Surfaces

**R4.1 — Exactly one filled area exists in the product:** the SpecCurve
significance band, `background: var(--sig-band)`. Every other element's background
is `--paper` or nothing.
- Do: `fill: var(--sig-band);` on the p < .05 region of fig. 1.
- Don't: `background: var(--sig-band);` on the Act II accounting block.

**R4.2 — `box-shadow` does not exist.** Not for cards, not for modals, not for
the stamp, not as a focus ring, not at 2% opacity.
- Do: separate the Call modal from the cover with a `--hairline` and a dimmed
  backdrop, `background: var(--scrim)` — the registered derivation (§0,
  R1.3a), `--ink` at 60% alpha via `color-mix`, declared once in
  `tokens.css`.
- Don't: `box-shadow: 0 1px 2px rgba(0,0,0,.06);`, and don't inline
  `color-mix(in srgb, var(--ink) 60%, transparent)` in a component — an
  unregistered derivation is exactly R1.3a's "new loud colour wearing a
  disguise," even for a neutral ink tint.

**R4.3 — `border-radius` is `0`, `var(--radius)` (2px), or `50%` for true
circles** (SpecCurve points, confetti particles, the published-path ring).
- Do: `border-radius: var(--radius);`
- Don't: `border-radius: 8px;`

**R4.4 — Separation is a hairline, never a fill.** `--hairline` is `1px solid
var(--rule)`; 1px means 1px, not 1.5 and not 2.
- Do: `border-block-end: var(--hairline);`
- Don't: `background: var(--rule); height: 1px;` on a spacer div, or a 2px "strong"
  divider.

**R4.5 — No element declares a border on all four sides.** Use `border-block-start`
or `border-block-end`; the `border` shorthand is forbidden on layout containers.
- Do: `border-block-start: var(--hairline);` above the accounting table.
- Don't: `border: var(--hairline);` around the Grantwell email — the email is a
  hairline-topped block with a mono `From:` line, not a box.

**R4.6 — Selection is marked by a 2px `--ink` underline, never by a filled pill.**
This is how segmented controls (the forks) show their chosen option.
- Do: `border-block-end: 2px solid var(--ink);` on the selected segment.
- Don't: `background: var(--ink); color: var(--paper);` on the selected segment.

**R4.7 — Stacking uses the ladder, never a raw number:** `--z-sticky` (10),
`--z-overlay` (20), `--z-modal` (30), `--z-stamp` (40).
- Do: `z-index: var(--z-modal);`
- Don't: `z-index: 9999;`

---

## §5 Motion system

**Amended by T35** on the owner's directive ("the UX/UI should be more animated,
it reads a bit plain right now"), and amended in the way this document requires:
by editing the law first. What changed is the *shape* of the law, not its
severity. The old §5 was a **budget** — four animations, each with a duration
token of its very own (`--dur-tick`, `--dur-fade`), which meant the count could
only ever be held down by refusing to add anything. That refusal is what made
the game read as plain: the biggest state change in the product, the screen
swap, had no beat at all, and R5.5 named "page transitions" as forbidden.

This section is now a **system**: a shared duration scale, one easing, an
exhaustive register of sites, and the same reduced-motion parity guarantee.
Sites are added by adding a row to R5.2's table — which is compiled, not
merely asserted — and each new one must still earn it. The bar is unchanged
and is stated here once: **a beat that tells the player something happened.**
Motion that merely decorates a state which was already legible fails the bar,
whatever its duration.

**R5.1 — Every timing value comes from a token, and the scale is closed.**
Three tokens carry ordinary motion: `--dur-quick` (140ms — quick UI feedback,
the 120–200ms band), `--dur-scene` (260ms — a scene changing, the 200–350ms
band), and `--dur-stagger` (60ms — the **delay step** between items of one
staggered entrance, never a duration in its own right). Two more are pinned
signature durations, each off the scale for a named reason given in R5.4.
Easing is `--ease-out` for the entire system; `--ease-stamp`'s overshoot is
R8.2's alone. No raw `ms`/`s` value, no `cubic-bezier()`, and no bare CSS
keyword (`ease`, `linear`, `steps()`) may appear in a `transition` or
`animation` anywhere under `src/ui` outside `tokens.css`.
- Do: `animation: ph-screen-enter var(--dur-scene) var(--ease-out);`
- Do: `animation-delay: calc(var(--ph-stagger-index, 0) * var(--dur-stagger));`
  — the one sanctioned arithmetic in motion, and the only way to express a
  stagger without typing N delays by hand (R5.7).
- Don't: `transition: opacity 200ms ease-in-out;` — three violations in one
  declaration, and the raw duration is the serious one: it is the single
  thing `prefers-reduced-motion` cannot reach (R5.6).
- Don't: invent `--dur-toast`. A duration names a *class of moment*; two sites
  that mean the same thing are timed by the same token or they will drift.

**R5.2 — These are the motion sites, and this list is exhaustive.** `Decls` is
the number of `transition:`/`animation:` shorthand declarations the file
carries; `tests/ui/motion.test.ts` recomputes the per-file totals from the
stylesheets and fails the build on any drift, in either direction. Adding a
site means adding its row here first.

| # | Site | File | Decls | Trigger | Property | Duration | Easing | Reduced motion | Why it earns motion |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Screen / nav-page transition (`.ph-screen` on `<main>`) | `src/ui/App.css` | 1 | the game's `screen` or the header's `page` changes (App.tsx keys `<main>` on both) | `opacity` 0→1, `transform` `translateY(6px)`→0 | `--dur-scene` | `--ease-out` | 1ms — the new screen is simply there | The biggest state change in the product. It teleported before this task; a screen that lands tells you a move completed |
| 2 | p-value dial: band colour, and the settle | `src/ui/components/PValueDial.css` | 2 | a genuinely new result (keyed on `p\|n\|outcome`, not on re-render) | `color` (R5.3's one sanctioned exception); `transform` `translateY(-2px)`→0 | `--dur-quick` | `--ease-out` | 1ms — the new number and its colour are simply there | Act I's signature (R8.1) and the game's heartbeat: the whole mechanic is watching this number move when you turn a knob |
| 3 | Reveal block entrance, staggered | `src/ui/screens/Reveal.css` | 1 | the block intersects the viewport | `opacity` 0→1, `transform` `translateY(6px)`→0, delayed by R5.7's index | `--dur-scene` + `--dur-stagger` | `--ease-out` | 1ms, 0ms delay; `Block()` additionally starts visible | Act II is a report being read; its six blocks are pages arriving in order, not one wash of ink |
| 4 | RETRACTED stamp: slam + ≤2px paper shake | `src/ui/screens/Reveal.css` | 2 | the block holding the stamp becomes visible (`.ph-fade--in`) | `transform` (scale + rotate), `opacity` | `--dur-stamp` | `--ease-stamp` | Stamp.tsx withholds the class entirely; 1ms besides | Act II's signature (R8.2), the one moment in the game allowed to be loud |
| 5 | Press clippings + chyron entrance, staggered | `src/ui/screens/Published.css` | 1 | the Published screen mounts | `opacity` 0→1, `transform` `translateY(6px)`→0, delayed by R5.7's index | `--dur-scene` + `--dur-stagger` | `--ease-out` | 1ms, 0ms delay | The day's payoff. Coverage arrives outlet by outlet, which is what coverage does |
| 6 | Fork-trail key popover | `src/ui/components/ForkTrail.css` | 1 | the key opens (hover / focus / tap) | `opacity` 0→1, `transform` `translateY(2px)`→0 | `--dur-quick` | `--ease-out` | 1ms | The only feedback that the control did anything. Closing stays instant — an exit carries no information |
| 7 | Share "copied" / "failed" line | `src/ui/screens/Summary.css` | 1 | a clipboard write resolves or rejects | `opacity` 0→1, `transform` `translateY(2px)`→0 | `--dur-quick` | `--ease-out` | 1ms | A clipboard write is invisible; this line is the entire confirmation that it happened |
| 8 | Confetti | `src/ui/components/ConfettiLayer.tsx` | 0 (canvas) | Published mounts, once per puzzle | canvas particles | `--dur-confetti` | — | canvas is never created (R5.6's JS half) | §2.5's sincere celebration; unchanged by T35 |

Two files hold `@keyframes` that they do not themselves fire, and both are
deliberate: `src/ui/components/Stamp.css` describes the slam while site 4 in
`Reveal.css` decides when it happens (the component knows what, the screen
knows when), and every keyframe defined anywhere under `src/ui` must be
referenced by some `animation:` declaration — also compiled.

**R5.3 — Only `transform` and `opacity` animate.** They are the two properties
a browser can composite without laying out or painting the page again, which
is what keeps this system free on a phone. There is exactly one exception, and
it is registered here: the dial's `color` (site 2), because on that element the
colour *is* the state (R1.8) and nothing's position depends on it. Travel
distances are pinned to two values, in the same way §4 pins the 1px hairline:
**6px for a scene arriving, 2px for a quick beat.** No third distance exists.
- Do: `transform: translateY(6px)` → `translateY(0)` on a block landing.
- Don't: animate `height`, `width`, `margin`, `top`, `filter` or `box-shadow`
  (R4.2 bans the last one from existing at all).
- Don't: reach for 12px because a screen felt undersold — the answer is
  whether the moment earns a beat, never how far the beat travels.

**R5.4 — Two durations sit off the scale, each for a reason stated by name.**
`--dur-stamp` (450ms) is fixed by master spec §7.1 for R8.2's signature slam:
one timeline, a single overshoot, the stamp scaling down and rotating to −12°
while the page translates ≤2px (§7.1's paper-shake, folded in rather than run
as a second animation). `--dur-confetti` (3000ms) is fixed by §7.5 as a canvas
budget, ≤400 particles, `--hack-gold` and `--paper` only, once per puzzle.
Nothing else in the product may exceed `--dur-scene`.
- Do: stop the RAF loop at `--dur-confetti` and drop the canvas from the DOM.
- Don't: loop the confetti, or add `--sig-red` particles — Act I is sincere.
- Don't: give a new site 600ms because it "needs room to breathe". It needs a
  reason with a name, or it gets `--dur-scene`.

**R5.5 — Nothing outside R5.2's table animates.** No hover transitions, no
button press states, no skeletons, no shimmer, no spinners, no accordion
slides, no count-up numbers, no focus-ring transitions. A hover is a state
change and changes instantly.
- Do: `.ph-seg:hover { text-decoration: underline; }` with no `transition`.
- Don't: `transition: all 200ms ease;` — still the single most common
  violation of this document, and still forbidden three ways over (R5.1's
  raw duration, R5.1's bare keyword, R5.3's unbounded property list).

**R5.6 — Reduced motion is a parity law: same information, zero movement.**
Every timing token collapses inside `tokens.css`'s
`@media (prefers-reduced-motion: reduce)` block — durations to 1ms,
`--dur-stagger` to 0ms, `--dur-confetti` to 0ms — so every CSS site in R5.2
becomes a single imperceptible frame with an identical end state. Two rules
follow from that and are not optional. **No content may appear only as the
result of an animation:** every animated element is either already visible in
its own right (sites 5, 6, 7 declare no base `opacity: 0`) or is held visible
by a class that the animation merely decorates (`.ph-fade--in`'s own
`opacity: 1`, sites 3 and 4). And **any JS-driven motion must consult
`matchMedia('(prefers-reduced-motion: reduce)')` itself** — via
`src/ui/hooks/useReducedMotion.ts`, which is the single place that decision is
made — because a token cannot reach a canvas or a `setTimeout`.
- Do: skip creating the confetti canvas entirely when the query matches.
- Do: use `animation-fill-mode: backwards` on a staggered entrance so the
  from-state applies during the delay; never `forwards`/`both` on an element
  that could contain a `position: fixed` descendant, because a persisted
  `translateY(0)` is still a transform and still re-anchors it (App.css's
  `.ph-screen` carries the worked example, and it is a real trap: Published's
  Call overlay is exactly such a descendant).
- Don't: hard-code `450` in a `setTimeout` for the stamp — read the token or
  the query, or the stamp will still block the reveal for reduced-motion users.
- Don't: put a required piece of content behind an entrance animation's
  opacity and nothing else.

**R5.7 — A staggered entrance is one animation with an indexed delay, and the
index is capped.** The element carries `--ph-stagger-index` as an inline custom
property (the only inline style motion may set), the stylesheet multiplies it
by `--dur-stagger`, and the component caps it — `Reveal.tsx`'s
`MAX_STAGGER_STEPS = 2`. The cap is the whole discipline: a stagger exists to
break up items that arrive *simultaneously*, and an uncapped DOM-order index
punishes an item that arrives alone, purely for sitting further down the
document.
- Do: `style={{ '--ph-stagger-index': Math.min(index, MAX_STAGGER_STEPS) }}`.
- Don't: write `.item:nth-child(3) { animation-delay: 180ms; }` — that is a
  raw duration (R5.1) and a fourth site pretending to be one.
- Don't: stagger more than one group per screen. Two cascades in one arrival
  is the "busy" this document exists to prevent.

---

## §6 Focus & affordances

**R6.1 — Focus is `--focus-ring` (2px solid `--ink`) at `--focus-offset` (2px), in
both themes, on `:focus-visible`.** `--ink` flips with the theme, so the ring never
needs a dark-theme override.
- Do: `&:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }`
- Don't: `outline: none;` — not even "temporarily", not even with a replacement
  shadow (R4.2 bans the replacement anyway).

**R6.2 — Links are underlined, always,** at `text-underline-offset: 2px`. Colour
never signals a link.
- Do: `text-decoration: underline; text-underline-offset: 2px;`
- Don't: `text-decoration: none;` on an in-prose link.

**R6.3 — No state is signalled by colour alone** (§7.5, colourblind safety). Every
coloured state also carries a word or a shape: the published path is `--sig-red`
*and* a ring; REPLICATED is `--assist-green` *and* the word; the stamp is red *and*
renders "RETRACTED" as real text for screen readers.
- Do: `<span class="ring" aria-label="published path">` plus the red fill.
- Don't: distinguish explored from published points by hue alone.

**R6.4 — Interactive targets are ≥44×44px**, achieved with padding from the §3
scale, not with a bigger font.
- Do: `padding: var(--space-12) var(--space-16);` on a segment.
- Don't: a 13px label with 4px padding as a tap target.

**R6.5 — Fork controls are radiogroups** (§7.3: no dropdowns — every fork is one
visible tap), fully arrow-key navigable, with a visible label per option.
- Do: `role="radiogroup"` with `role="radio"` children and roving tabindex.
- Don't: `<select>` — a dropdown hides the garden, which is the entire lesson.

---

## §7 Dark theme

**R7.1 — The theme is an explicit attribute.** `<html data-theme="light|dark">` is
written at boot from the stored setting, falling back to
`matchMedia('(prefers-color-scheme: dark)')`. CSS never guesses; there is exactly
one dark block in `tokens.css`.
- Do: set the attribute in an inline boot script before first paint.
- Don't: duplicate the palette under `@media (prefers-color-scheme: dark)` — two
  copies drift.

**R7.2 — Every rule in this document applies unchanged in dark.** Same single loud
colour, same eight motion sites, same hairlines, same 2px radius.
- Do: rely on the tokens flipping.
- Don't: add a dark-only shadow, glow, or elevated surface to "separate" panels.

**R7.3 — The dark values are these, and they are contrast-derived.** `--paper` and
`--ink` are the master spec §7.2 values. Each accent keeps its exact OKLCH hue and
chroma and raises lightness by the factor needed to clear §7.5's 4.5:1 floor
against the dark paper — the spec's nominal ~+10% suffices only for gold, so red
and green take +30%. Ratios below are WCAG 2.1, measured against that theme's
`--paper`, and asserted in `tests/ui/tokens.test.ts`.

| Token | Light | on paper | Dark | on paper | Derivation |
|---|---|---|---|---|---|
| `--paper` | `#FBF8F1` | — | `#141821` | — | §7.2, fixed |
| `--ink` | `#1C1B18` | 16.24 | `#E8E4D9` | 13.98 | §7.2, fixed |
| `--rule` | `#D8D2C4` | 1.42 | `#2E3542` | 1.44 | chosen to reproduce the light hairline's weight |
| `--sig-red` | `#B3261E` | 6.16 | `#E85B4C` | 5.10 | OKLCH L × 1.30 |
| `--assist-green` | `#2E6E4E` | 5.73 | `#5A9A78` | 5.35 | OKLCH L × 1.30 |
| `--hack-gold` | `#B98A2C` | 2.94 † | `#CE9F44` | 7.33 | OKLCH L × 1.10 |
| `--hack-gold-ink` | `#8C6401` | 5.03 | `#CE9F44` | 7.33 | light: OKLCH L × 0.80 |
| `--muted` | `#6E6A5E` | 5.09 | `#8D897C` | 5.08 | chosen to reproduce the light muted ratio |
| `--dial-step-1` | `#5E6B5A` | 5.31 | `#808D7B` | 5.09 | `color-mix(in srgb, --muted, --assist-green 25%)`, per theme |
| `--dial-step-2` | `#4E6C56` | 5.49 | `#74927A` | 5.19 | `color-mix(in srgb, --muted, --assist-green 50%)`, per theme |
| `--dial-step-3` | `#3E6D52` | 5.63 | `#679679` | 5.26 | `color-mix(in srgb, --muted, --assist-green 75%)`, per theme |

† Below 4.5:1 — which is precisely why R1.6 forbids `--hack-gold` on characters.
`--rule` is likewise below the floor and is barred from text by R1.4.

- Do: ship the dark values exactly as declared above — `--sig-red: #E85B4C`,
  `--assist-green: #5A9A78`, `--hack-gold: #CE9F44` — and let `tokens.css` flip them.
- Don't: apply a flat +10% lightness bump to a red or green that carries text;
  that lands at 3.38:1 and 3.58:1, below §7.5's floor. Measure any new or retuned
  accent against its theme's `--paper` before shipping it — `tests/ui/tokens.test.ts`
  will fail it below 4.5:1, but the number belongs in this table too.

**R7.4 — `--sig-band` is derived, not duplicated.** It is
`color-mix(in srgb, var(--sig-red) 6%, transparent)`, so it follows the theme
automatically and keeps `--muted` captions on it at ≥4.62:1.
- Do: reference `var(--sig-band)`.
- Don't: hard-code a light and a dark band colour.

---

## §8 Signature moments

**R8.1 — Act I's signature is the dial.** It is the largest thing on the Lab
screen (`--text-dial`), it is the only element whose colour changes with state
(R1.8), and it is prominent by size and colour alone — no shadow, no halo, no
pulse. Below R3.4's breakpoint it is also the one **sticky** element on the
screen (§0's Lab-layout row): §2.4's mechanic is watching this number move while
you turn a knob, so the numeral and its n/df line — and nothing else, a
**measured 153px at 360px wide** — stay pinned at `top: 0` while the controls
scroll beneath. (153px, not the ~85px this rule first estimated: `--text-dial`
clamps to 64px there and `p = 0.459` wraps to two lines in a 312px column, so
2 × 64 + 26. That is 24% of a 640px phone, against the 998px whole-pane sticky
it replaced.)
- Do: give it the whole top of the results column with `--space-40` of air.
- Do: keep the sticky block to the numeral and n/df. Its caption, the figures
  and the buttons are static siblings.
- Don't: add a glow, a ring, or a background disc to make it feel special.
- Don't: make the whole results pane sticky, or fold the caption into the dial
  block — a sticky element taller than the viewport slides to the end of its
  containing block and paints over the controls (§0's row states the measured
  numbers).

**R8.2 — Act II's signature is the RETRACTED stamp.** Oversized, rotated −12°,
distressed via an inline SVG filter (no image assets), one 450ms slam (R5.4),
`--sig-red`, and always also present as text for assistive technology.
- Do: render it once, at the accounting beat of the reveal.
- Don't: reuse the stamp texture as decoration elsewhere — a signature used twice
  is a pattern.

**R8.3 — One signature per act. Everything else stays quiet.** If a new element
wants to be memorable, it competes with the dial or the stamp and loses.
- Do: render the SpecCurve as a plain figure with a `--muted` caption ("Fig. 1").
- Don't: give the journal cover an animated masthead, a gradient, or a second
  stamp.

---

## §9 Token reference

Complete list of `src/ui/theme/tokens.css`. UI code uses these names; it never
retypes their values.

| Group | Tokens |
|---|---|
| Palette (§7.2, fixed) | `--paper` `--ink` `--rule` `--sig-red` `--assist-green` `--hack-gold` `--muted` |
| Derived colour | `--hack-gold-ink` `--sig-band` `--scrim` `--dial-step-1` `--dial-step-2` `--dial-step-3` |
| Surfaces | `--hairline` `--radius` |
| Families | `--font-display` `--font-ui` `--font-mono` |
| Sizes | `--text-13` `--text-15` `--text-22` `--text-28` `--text-40` `--text-dial` |
| Leading | `--leading-dial` `--leading-display` `--leading-ui` `--leading-prose` |
| Weights & tracking | `--weight-regular` `--weight-medium` `--tracking-label` |
| Spacing | `--space-4` `--space-8` `--space-12` `--space-16` `--space-24` `--space-40` `--space-64` |
| Layout | `--measure` `--page-max` |
| Motion scale (§5) | `--dur-quick` `--dur-scene` `--dur-stagger` |
| Motion, pinned (R5.4) | `--dur-stamp` `--dur-confetti` |
| Easing | `--ease-out` `--ease-stamp` |
| Focus | `--focus-ring` `--focus-offset` |
| Figures (§7.4 + T29 §0) | `--dot-all` (1.5px) `--dot-explored` (4px) `--dot-published` (6px) `--dot-cut` (2px) |
| Stacking | `--z-sticky` `--z-overlay` `--z-modal` `--z-stamp` |

---

## §10 Review checklist

Each of the 49 rules is decided exactly one way. The table below is the single
statement of that — no rule appears in two tiers.

T35 moved the whole of §5 from tier B/C up to tier A: the motion system is now
decided by `tests/ui/motion.test.ts`, which reads R5.2's own table out of this
document and reconciles it against the stylesheets. Judgement is still what
decides whether a moment *deserves* a row — that is R8.3's question, and it is
the only part of §5 a command cannot answer.

| Tier | How it is decided | Rules |
|---|---|---|
| **A — compiled** | `npx vitest run tests/ui/tokens.test.ts tests/ui/motion.test.ts` fails the build | R1.3a, R1.7, R4.2, R4.3, R5.1, R5.2, R5.3, R5.5, R5.6, R5.7, R6.1, R7.3 |
| **B — compiled where it is *defined*, read where it is *used*** | the test pins the token in `tokens.css`; a reviewer confirms the consuming file uses it | R1.6, R1.8, R2.1, R2.3, R2.5, R5.4, R7.4 |
| **B+C — compiled where it is *defined*, grepped where it is *used*** | the test closes the scale inside `tokens.css`; the raw-px grep below catches a value typed anywhere else | R2.2, R3.1 |
| **C — grep** | one of the commands below | R1.3, R3.4, R4.5, R4.7, R6.5 |
| **D — read the diff** | deterministic by inspection: the rule names the value, you check the line | R1.1, R1.2, R1.4, R1.5, R2.4, R2.6, R2.7, R2.8, R3.2, R3.3, R3.5, R3.6, R4.1, R4.4, R4.6, R6.2, R6.3, R6.4, R7.1, R7.2, R8.1, R8.2 |
| **E — judgement** | the one rule in this document that taste decides | R8.3 |

**Tier A scope, stated precisely.** R1.7 is complete: the test scans every
`src/ui/**/*.{ts,tsx,css}` except `tokens.css` for hex, `rgb()`/`hsl()`, all 148
CSS named colours except `transparent`/`currentColor`, and framework palette
utility classes (`text-red-500`), with comments stripped. R1.3a is complete for
its mechanical half — no `color-mix()` outside `tokens.css`, and every token name
and hex in `tokens.css` must appear in this document. R7.3 is complete: every
text token's contrast is recomputed against its own theme's `--paper` and must
clear 4.5:1. R6.1 is complete for the violation it names: no `outline: none`,
`outline: 0` or `outline-style: none` — in a stylesheet or in a JSX style object,
camelCase included — may appear anywhere under `src/ui`, and the ring's value and
its deliberate absence from the dark block are both pinned. The test cannot see
an element that never declares `:focus-visible` at all; that is a *missing* focus
style rather than a *suppressed* one, and it is caught by tabbing through the
screen — the one thing §6 asks a reviewer to actually do.

**Tier A scope, §5's half (`tests/ui/motion.test.ts`).** Four checks, and
between them they close the system. (1) **Tokens only**: every
`transition:`/`animation:`/`animation-delay:`/`animation-duration:` under
`src/ui` outside `tokens.css` is scanned for a raw `ms`/`s` value, a
`cubic-bezier()`, or a bare timing keyword, and any hit fails the build —
R5.1, and the thing that makes R5.6's collapse total. (2) **The register is
exhaustive, in both directions**: R5.2's table is parsed out of this file, its
per-file `Decls` counts are summed, and the stylesheets are counted
independently; an unlisted animation and a listed-but-deleted one fail
identically. (3) **Keyframes are all consumed**: every `@keyframes` defined
under `src/ui` is referenced by an `animation:` declaration and vice versa, so
a split like Stamp.css/Reveal.css can never rot into a dead definition.
(4) **Reduced-motion parity**: every duration token any animation actually
uses must appear collapsed inside `tokens.css`'s
`@media (prefers-reduced-motion: reduce)` block — which is what turns "guarded"
from a per-file promise into a property of the scale itself. What it cannot
see: whether a moment *deserved* a row (tier E) and whether the movement looks
right (a human, at 360 and 1088).

**Tier C — these four must print nothing:**

```sh
grep -rnE 'border:\s' src/ui                                                  # R4.5
grep -rnE '\bz-index:\s*[0-9]' src/ui                                         # R4.7
grep -rn '<select' src/ui                                                     # R6.5
grep -rnE '@media \(min-width:' src/ui | grep -v '768px'                      # R3.4
```

**Tier C — these two enumerate; every hit must map to a closed list:**

```sh
grep -rn 'var(--sig-red)' src/ui                                              # R1.3
grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css                          # R2.2 / R3.1 usage
```

1. Every hit of the first is one of R1.3's four places, or `--sig-band` (R1.3a).
2. The only legal raw pixel values are the strokes this document names by hand:
   the 1px hairline (R4.4), the 2px selection underline (R4.6), the 2px underline
   offset (R6.2), and R5.3's two pinned travel distances (6px scene, 2px quick).
   Anything else is a size or a space that belongs on a scale. Note this grep
   does not reach a transform argument (`translateY(6px)` has no digit straight
   after the colon); R5.3's two-distance rule is what closes that gap, and
   `motion.test.ts` enforces it by scanning keyframe bodies.

The old `grep -rnE '\b(transition|animation):' src/ui` and
`grep -rn 'transition: all' src/ui` rows are retired: both are now strictly
subsumed by `motion.test.ts`, which counts those same declarations per file
and rejects `all` as an un-tokenised property list.

**Tier E — the one question a command cannot answer:** does anything other than
the dial and the stamp ask to be looked at first? (R8.3)
