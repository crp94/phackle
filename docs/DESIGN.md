# P-hackle — Design law

**Direction:** "Preprint Gothic, Nothing-disciplined" · **Approved:** 2026-08-03 ·
**Status:** binding on T5, T14–T18, T29 and every UI change after them.

The game about academic publishing looks like academic publishing — paper, ink,
hairlines, figure captions, tabular numerals — executed with hard restraint. One
loud colour. Four animations. No boxes. The tension between warm-paper academia
and cold accounting is the Act I / Act II split made visual.

**How to use this document.** Every rule below names an exact value or an exact
token, and is decided by a test, a grep, or a look at the diff — not by taste.
The single exception is R8.3, which is a judgement call and is labelled as one;
§10 states the tier of each of the 48 rules exactly once. Cite rule ids in review
("violates R2.4"). Where a rule and your layout disagree, the rule wins; if the
rule is wrong, change it here first, in a commit of its own.

**Precedence.** `docs/implementation_plan.md` §7 → this document → your judgement.
This document only narrows §7; it never invents a different product.

---

## §0 Reconciliation with master spec §7

The approved direction narrows seven pieces of §7 wording. These are recorded, not
silently applied — revert any of them by editing this section and the rule it points at.
The last row is also the **registry of derived colours** that R1.3a and R1.6
depend on: a colour derived from the §7.2 palette exists only if it appears both
in `tokens.css` and in this table.

| Master spec says | This document says | Why |
|---|---|---|
| §7.3 "paper-white **cards**", "skeuomorphic email card", "press blurb cards", "two large option cards" | Every "card" is a **hairline-ruled block** on `--paper`: no fill, no shadow, no 4-side border (R4.1, R4.2, R4.5) | The delta spec's direction A ("hairlines instead of boxes") wins over §7 by its own precedence clause |
| §7.4 "significant region **tint**" | Kept, and it is the **one** filled area in the product, at exactly `--sig-band` (R4.1) | A data region in a figure is not chrome; §7.4 pins it explicitly, so it survives as a named exception |
| §7.1 stamp "+ subtle paper-shake" | Folded **into** the single 450ms stamp timeline, ≤2px, not a fifth animation (R5.2) | Keeps §7.5's motion budget exhaustive without dropping the effect |
| §7.2 `--hack-gold` for "career points" (i.e. text) | Gold on characters uses `--hack-gold-ink` (R1.6) | `--hack-gold` is 2.94:1 on paper — it fails §7.5's 4.5:1 floor as text. §7.2's hex is unchanged |
| Direction: the "**glowing** dial" | The dial is prominent by **size and colour only** — no shadow, no halo (R8.1) | R4.2 bans shadows; scale is the louder instrument anyway |
| §7.2 lists `--assist-green` for "REPLICATED" among its uses, without restricting it to inline text | R1.5's inline-only (≤1em) rule gets one named exception: the REPLICATED verdict stamp renders in `--assist-green` at display scale, exactly parallel to R1.3's RETRACTED-stamp entry for `--sig-red` | A verdict stamp is a signature moment (R8.2), not the ambient chrome R1.5's "never a fill" discipline targets; direction A's single-loud-colour discipline governs chrome, not the verdict itself |
| §7.2 fixes **seven** colours | Exactly **two** are derived from them, both declared in `tokens.css`: `--hack-gold-ink` (from the gold hue, R1.6) and `--sig-band` (`color-mix` of `--sig-red` at 6%, R4.1). Neither counts as a new colour against R1.3 or R1.6; any third derivation must be added to this row first (R1.3a) | §7.5's contrast floor forces the first and §7.4's tint forces the second — registering them keeps "one loud colour" and "seven fixed values" literally true |

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
also obeys: **a derived colour must be declared in `tokens.css` and registered in
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
REPLICATED verdict word, the integrity-bonus line, "better" deltas. Exception
(registered in §0): the REPLICATED verdict stamp renders in `--assist-green`
— the one sanctioned display-scale green, exactly parallel to R1.3's stamp
entry for `--sig-red`.
- Do: `<em style="color: var(--assist-green)">REPLICATED</em>` at `--text-15`.
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

**R1.8 — The dial's colour interpolates between exactly two tokens.** As p → .05
it runs `--muted` → `--sig-red` in `oklab`, and touches no third colour. The whole
path stays ≥5.05:1 in both themes; do not introduce a midpoint.
- Do: `color: color-mix(in oklab, var(--muted), var(--sig-red) calc(var(--p-proximity) * 100%));`
- Don't: `color: color-mix(in oklab, var(--hack-gold), var(--sig-red) 50%);`

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
stacked below). A second breakpoint is a design failure, not a fix.
- Do: `@media (min-width: 768px) { … }`
- Don't: `@media (min-width: 1024px) { … }`

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
  backdrop (`--ink` at 60% alpha via `color-mix`).
- Don't: `box-shadow: 0 1px 2px rgba(0,0,0,.06);`

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

## §5 Motion budget

**Four animations exist in P-hackle.** This list is exhaustive. Adding a fifth
requires editing this section first.

**R5.1 — Dial tick: `--dur-tick` (120ms), `--ease-out`.** Fires on p-value change;
animates `color`, `opacity`, and at most 2px of `translateY` on the numeral itself.
- Do: `transition: color var(--dur-tick) var(--ease-out), transform var(--dur-tick) var(--ease-out);`
- Don't: animate the dial's `font-size` or run a spring on it.

**R5.2 — Stamp slam: `--dur-stamp` (450ms), `--ease-stamp`, a single overshoot.**
One timeline: the stamp scales down and rotates to −12° while the page translates
≤2px (the §7.1 paper-shake, folded in). Transform and opacity only.
- Do: one keyframe set on the stamp plus a ≤2px page translate ending at the same 450ms.
- Don't: a second, separate shake animation after the stamp lands.

**R5.3 — Scroll fades: `--dur-fade` (300ms), opacity only.** The reveal sequence's
blocks fade in as they enter the viewport. No slide, no scale, no stagger beyond
one block per intersection.
- Do: `transition: opacity var(--dur-fade) var(--ease-out);`
- Don't: `transform: translateY(20px)` on entry — that is a slide, and slides are
  not in the budget.

**R5.4 — Confetti: `--dur-confetti` (3000ms), canvas, ≤400 particles,
`--hack-gold` and `--paper` only.** Published screen, once per puzzle.
- Do: stop the RAF loop at 3000ms and drop the canvas from the DOM.
- Don't: loop it, or add `--sig-red` particles — Act I is sincere.

**R5.5 — Nothing else animates.** No hover transitions, no button press states, no
skeletons, no shimmer, no spinners, no page transitions, no accordion slides, no
count-up numbers other than R5.1.
- Do: change state instantly on hover (`text-decoration`, `border` colour swap with
  no `transition` property).
- Don't: `transition: all 200ms ease;` — the single most common violation of this
  document.

**R5.6 — Every animation is gated on reduced motion.** `tokens.css` collapses
`--dur-tick`, `--dur-fade` and `--dur-stamp` to 1ms and `--dur-confetti` to 0ms
under `prefers-reduced-motion: reduce`, so CSS is handled automatically — but any
JS-driven motion must check `matchMedia('(prefers-reduced-motion: reduce)')` itself.
- Do: skip creating the confetti canvas entirely when the query matches.
- Don't: hard-code `450` in a `setTimeout` for the stamp — read the token or the
  query, or the stamp will still block the reveal for reduced-motion users.

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
colour, same four animations, same hairlines, same 2px radius.
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
pulse.
- Do: give it the whole top of the results pane with `--space-40` of air.
- Don't: add a glow, a ring, or a background disc to make it feel special.

**R8.2 — Act II's signature is the RETRACTED stamp.** Oversized, rotated −12°,
distressed via an inline SVG filter (no image assets), one 450ms slam (R5.2),
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
| Derived colour | `--hack-gold-ink` `--sig-band` |
| Surfaces | `--hairline` `--radius` |
| Families | `--font-display` `--font-ui` `--font-mono` |
| Sizes | `--text-13` `--text-15` `--text-22` `--text-28` `--text-40` `--text-dial` |
| Leading | `--leading-dial` `--leading-display` `--leading-ui` `--leading-prose` |
| Weights & tracking | `--weight-regular` `--weight-medium` `--tracking-label` |
| Spacing | `--space-4` `--space-8` `--space-12` `--space-16` `--space-24` `--space-40` `--space-64` |
| Layout | `--measure` `--page-max` |
| Motion | `--dur-tick` `--dur-fade` `--dur-stamp` `--dur-confetti` `--ease-out` `--ease-stamp` |
| Focus | `--focus-ring` `--focus-offset` |
| Figures (§7.4) | `--dot-all` (1.5px) `--dot-explored` (4px) `--dot-published` (6px) |
| Stacking | `--z-sticky` `--z-overlay` `--z-modal` `--z-stamp` |

---

## §10 Review checklist

Each of the 48 rules is decided exactly one way. The table below is the single
statement of that — no rule appears in two tiers.

| Tier | How it is decided | Rules |
|---|---|---|
| **A — compiled** | `npx vitest run tests/ui/tokens.test.ts` fails the build | R1.3a, R1.7, R4.2, R4.3, R5.6, R6.1, R7.3 |
| **B — compiled where it is *defined*, read where it is *used*** | the test pins the token in `tokens.css`; a reviewer confirms the consuming file uses it | R1.6, R2.1, R2.3, R2.5, R5.1, R5.2, R5.3, R5.4, R7.4 |
| **B+C — compiled where it is *defined*, grepped where it is *used*** | the test closes the scale inside `tokens.css`; the raw-px grep below catches a value typed anywhere else | R2.2, R3.1 |
| **C — grep** | one of the commands below | R1.3, R3.4, R4.5, R4.7, R5.5, R6.5 |
| **D — read the diff** | deterministic by inspection: the rule names the value, you check the line | R1.1, R1.2, R1.4, R1.5, R1.8, R2.4, R2.6, R2.7, R2.8, R3.2, R3.3, R3.5, R3.6, R4.1, R4.4, R4.6, R6.2, R6.3, R6.4, R7.1, R7.2, R8.1, R8.2 |
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

**Tier C — these five must print nothing:**

```sh
grep -rnE 'border:\s' src/ui                                                  # R4.5
grep -rnE '\bz-index:\s*[0-9]' src/ui                                         # R4.7
grep -rn '<select' src/ui                                                     # R6.5
grep -rnE '@media \(min-width:' src/ui | grep -v '768px'                      # R3.4
grep -rn 'transition: all' src/ui                                             # R5.5
```

**Tier C — these three enumerate; every hit must map to a closed list:**

```sh
grep -rnE '\b(transition|animation):' src/ui                                  # R5.5
grep -rn 'var(--sig-red)' src/ui                                              # R1.3
grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css                          # R2.2 / R3.1 usage
```

1. Every hit of the first is one of the four animations in §5. A fifth is a
   violation of R5.5 — this grep *is* that check, not a prompt to go looking.
2. Every hit of the second is one of R1.3's four places, or `--sig-band` (R1.3a).
3. The only legal raw pixel values are the strokes this document names by hand:
   the 1px hairline (R4.4), the 2px selection underline (R4.6), the 2px underline
   offset (R6.2), and the ≤2px transforms in R5.1/R5.2. Anything else is a size or
   a space that belongs on a scale.

**Tier E — the one question a command cannot answer:** does anything other than
the dial and the stamp ask to be looked at first? (R8.3)
