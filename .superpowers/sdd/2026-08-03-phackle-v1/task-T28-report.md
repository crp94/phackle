# Task T28 — Design-system foundation (DESIGN.md + disciplined tokens)

**Agent:** aesthetics · **Date:** 2026-08-03 · **Branch:** `worktree-agent-a00d16b62dd7cc529`
**Base:** `44d0370` (STEP 0 reset applied — branch had zero commits)
**Final commit:** `679a0fa`

## Implemented

### `docs/DESIGN.md` (new, binding on T5, T14–T18, T29)

Direction "Preprint Gothic, Nothing-disciplined" written as law: 8 rule sections,
**52 numbered rules** (R1.1 … R8.3), each stating an exact value or an exact token
and each carrying one `Do:` and one `Don't:` line. Structure:

| § | Covers | Rules |
|---|---|---|
| §0 | Reconciliation with master spec §7 (5 recorded narrowings) | — |
| §1 | Palette discipline | R1.1–R1.8 |
| §2 | Type | R2.1–R2.8 |
| §3 | Spacing & layout | R3.1–R3.6 |
| §4 | Surfaces (no boxes) | R4.1–R4.7 |
| §5 | Motion budget (exhaustive) | R5.1–R5.6 |
| §6 | Focus & affordances | R6.1–R6.5 |
| §7 | Dark theme (+ measured contrast table) | R7.1–R7.4 |
| §8 | Signature moments | R8.1–R8.3 |
| §9 | Complete token reference | — |
| §10 | Review checklist: 11 runnable greps + 3 eyes-only questions | — |

All seven mandated rule groups from the brief are authored: palette discipline,
type, spacing scale, exhaustive motion budget, focus & affordances, dark theme,
signature moments.

### `src/ui/theme/tokens.css` (was empty-but-imported)

51 custom properties. The seven §7.2 palette values verbatim under `:root`; a
full dark theme under `[data-theme='dark']`; a `prefers-reduced-motion` block
collapsing the CSS durations. Everything §7.2 leaves open is now pinned: type
scale 13/15/22/28/40 + `clamp(64px, 11vw, 96px)` dial, four leadings, two
weights, spacing 4/8/12/16/24/40/64, `--measure` 62ch, `--page-max` 68rem, four
motion durations, two easings, focus ring, SpecCurve dot radii (§7.4's
1.5/4/6px), and a four-step z-ladder.

Theme selection is an explicit `<html data-theme>` attribute written at boot, so
the palette is declared **once** — no duplicated dark block under
`prefers-color-scheme`, which is the usual source of light/dark drift. Documented
as R7.1; T5 owns the boot script.

### `.gitignore`

Added `.claude/` (agent scratch), alongside the existing `.superpowers/`.

## Two §7.5 contrast findings

Both are documented in DESIGN.md §0 and §7.3 and are the only substantive
deviations from a literal reading of the brief. Both are one-line reverts.

**1. `--hack-gold` cannot legally carry text.** `#B98A2C` on `#FBF8F1` is
**2.94:1** — below §7.5's 4.5:1 floor, and below even the 3:1 large-text bar. The
brief has gold appearing "inline at text scale", and §7.2 assigns it "career
points", i.e. characters. The §7.2 hex is fixed, so I did not touch it; instead
`--hack-gold-ink` (`#8C6401`, OKLCH L×0.80, **5.03:1**) is now the only gold
permitted on characters, with `--hack-gold` restricted to confetti and non-text
marks. R1.6 pins which is which. In dark, gold is already 7.33:1 so the two
tokens share a value.

**2. The dark theme's "+10% luminance" fails a11y for red and green.** Measured
on `#141821`: red at +10% is **3.38:1**, green **3.58:1** — both below 4.5:1. The
brief left the exact hexes to me and asked that text-scale uses stay readable, so
each accent keeps its exact OKLCH hue and chroma and takes the lift it actually
needs. Final dark values:

| Token | Dark | Ratio | Derivation |
|---|---|---|---|
| `--paper` | `#141821` | — | §7.2 fixed |
| `--ink` | `#E8E4D9` | 13.98 | §7.2 fixed |
| `--rule` | `#2E3542` | 1.44 | matches the light hairline's 1.42 weight |
| `--sig-red` | `#E85B4C` | 5.10 | OKLCH L × 1.30 |
| `--assist-green` | `#5A9A78` | 5.35 | OKLCH L × 1.30 |
| `--hack-gold` | `#CE9F44` | 7.33 | OKLCH L × 1.10 (the nominal +10% suffices here) |
| `--hack-gold-ink` | `#CE9F44` | 7.33 | already text-safe |
| `--muted` | `#8D897C` | 5.08 | reproduces the light theme's 5.09 muted ratio |

Also verified numerically: the R1.8 dial interpolation (`--muted` → `--sig-red`
in oklab) never drops below **5.05:1** at any point along the path in either
theme — the endpoints are the worst case, so the rule is safe as written. The
`--sig-band` fill keeps `--muted` captions on it at 4.62:1 (light) / 4.78:1
(dark).

## Tested

`tests/ui/tokens.test.ts` — **44 tests**, all passing. Beyond the brief's
required assertions it computes WCAG ratios so §7.5 is enforced, not asserted:

- R1: the seven §7.2 props exist under `:root` with the **exact** spec hexes;
  all seven are overridden under `[data-theme='dark']`; `--paper`/`--ink` match
  the spec's fixed dark values; `--hack-gold-ink` exists in both themes.
- Contrast: every text token clears 4.5:1 against its own theme's `--paper`, in
  **both** themes. Dark values are checked by *property*, not by exact hex, so a
  future retune is free but a regression below the floor is not.
- R1.7: no hex **and** no `rgb()`/`hsl()` literal anywhere under `src/ui`
  outside `tokens.css`.
- R4: no `box-shadow` anywhere; every px `border-radius` ≤ 2px.
- R3.1 / R2.2: the spacing and type scales are **closed** — exactly
  4/8/12/16/24/40/64 and 13/15/22/28/40, in order, and each space step is named
  after its own pixel value.
- R5: exactly four durations exist and they are exactly 120/300/450/3000ms;
  `prefers-reduced-motion` collapses tick/fade/stamp to 1ms.
- R6.1: the ring is `2px solid var(--ink)` at 2px offset and is deliberately
  *not* overridden in dark.
- Doc/code drift: every hex and every custom-property name in `tokens.css` must
  appear in `DESIGN.md`. The document cannot silently fall behind the stylesheet.

### TDD evidence

**RED** (`tokens.css` empty, `DESIGN.md` absent) — the suite could not even
collect:

```
 FAIL  tests/ui/tokens.test.ts [ tests/ui/tokens.test.ts ]
Error: tokens.css has no top-level block matching /^:root\s*\{/m
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** after authoring both files: `Test Files 1 passed (1) · Tests 44 passed (44)`.

**Mutation checks** (the guards were verified to actually bite, then reverted):

- A probe file `src/ui/__probe.css` containing a hex, a `box-shadow` and an
  `8px` radius → **3 tests failed**, naming the file and the `8px`.
- Setting dark `--sig-red` to the naive +10% value `#C5392E` → contrast test
  failed with `expected 3.3820228525182814 to be greater than or equal to 4.5`,
  which is the direct evidence for finding #2 above (and the doc-drift test
  caught the undocumented hex at the same time).

### Full gate — run before each commit, and again after the self-review fix

```
npx vitest run     Test Files 4 passed (4) · Tests 78 passed (78)
npx tsc --noEmit   clean
npm run lint       clean
npm run build      built in 68ms (dist/assets/index-DBCvynFr.css 1.63 kB)
```

The CSS appears in the build output, confirming `tokens.css` is genuinely wired
through `main.tsx`.

## Files changed

- `docs/DESIGN.md` — new
- `src/ui/theme/tokens.css` — authored (was a 3-line placeholder comment)
- `tests/ui/tokens.test.ts` — new
- `.gitignore` — `.claude/` added

Touched nothing owned by sibling agents (`src/engine/stats.ts`, `dgp.ts`,
`src/i18n/**`, `src/content/**`, `src/ui/App.tsx` all untouched).

## Commits

- `8ec2c56` `chore: ignore .claude/ agent scratch`
- `679a0fa` `feat: design-system foundation — DESIGN.md + disciplined tokens (direction A)`

## Self-review

**Is every rule mechanically checkable?** I audited all 52 and found I had
**overclaimed** enforcement in §10 — it credited the test suite with R1.2, R2.4,
R2.6 and R5.5, none of which it actually enforces. Fixed: §10 now lists exactly
what is compiled, exactly what is grep-checked, and exactly what needs a human.
A document that lies about its own enforcement is worse than one that admits the
gap.

I also **ran every grep in my own checklist** and found one was broken: the R3.4
breakpoint check used a PCRE lookahead, which `grep -E` rejects with
`invalid syntax`. Rewritten as a pipe through `grep -v`. All eleven now execute
and are currently clean.

Two greps produce hits that must be justified rather than be empty (all
`transition:`/`animation:` declarations, and raw px values); §10 states the
closed list of legal answers for each, so they stay decidable.

Three rules are honestly marked as judgement calls, not mechanised: is there a
fifth animation, is `--sig-red` outside its four sanctioned places, and does
anything out-compete the dial and the stamp for attention (R8.3). I chose to
label these rather than fake a check for them.

**Does any rule contradict §7.2 or §7.5?** No.

- §7.2's seven hexes are present verbatim and asserted exactly by the test.
- §7.5's 4.5:1 floor holds for every text token in both themes, and is now
  computed in CI rather than trusted. The two tokens that fall below it
  (`--rule` 1.42, light `--hack-gold` 2.94) are explicitly barred from carrying
  characters by R1.4 and R1.6, and the test's text-token list is annotated with
  that reasoning.
- §7.5's reduced-motion, focus-visible, colour-plus-shape and
  stamp-verdict-as-text requirements map to R5.6, R6.1, R6.3 and R8.2.

**§0 records five places where the approved direction narrows literal §7
wording** rather than resolving them silently, each with a reason and a pointer
to the rule that implements it: §7.3's "cards" become hairline-ruled blocks;
§7.4's significance tint survives as the single sanctioned fill; §7.1's
paper-shake folds into the 450ms stamp timeline instead of becoming a fifth
animation; §7.2's gold-on-text becomes `--hack-gold-ink`; and the "glowing dial"
glows by size and colour, since R4.2 bans shadows.

## Concerns for the controller

1. **The gold split (`--hack-gold` / `--hack-gold-ink`) is the one place I added
   a token the brief did not name.** It is forced: §7.2's fixed hex and §7.5's
   4.5:1 floor cannot both hold with a single gold. If you prefer the
   alternative — gold never touches text at all, and career points are set in
   `--ink` — that is R1.6 plus one token deleted. Flagging rather than assuming.
2. **The dark accents are +30%, not the spec's "~+10%".** Driven purely by the
   4.5:1 floor; the brief gave me the hexes and asked for readability, so I
   optimised for the a11y constraint. If the reviewer wants the literal +10%,
   §7.5 compliance has to be relaxed for red and green as text — one or the
   other.
3. **R4.5 (no 4-side borders) is the strictest rule in the document** and the
   most likely to be contested by T14–T18, especially for the Grantwell email
   and the Call modal. It is deliberately strict — it is what makes "hairlines
   instead of boxes" real rather than aspirational — but it is the rule to
   revisit first if the manuscript look starts to feel unstructured.
4. **No fonts are loaded yet.** `--font-display` and `--font-mono` name STIX Two
   Text and JetBrains Mono with full fallback stacks, but nothing self-hosts or
   fetches them. Whoever owns the app shell (T5) needs to add the `@font-face`
   declarations, or the manuscript look silently degrades to Times and Menlo.
   This is outside T28's file ownership, so I did not do it.
5. **`--dot-all` is 1.5px**, which is a sub-pixel radius and the single value in
   the system that is not on an integer grid. It comes straight from §7.4; kept
   as specified.

---

# Fix report — review round 1

**Verdict addressed:** Needs fixes (3 Important). **Fix commit:** `82429ae`
**Branch HEAD:** `82429ae` · Scope held to the three findings; no Minor findings chased.

## Finding 1 — §10's enforcement claims did not match the checks

**1(a) R1.7 named colours — fixed by extending the check, not by weakening the claim.**
The reviewer was right that this was a live hole, not a documentation nit:
`eslint` lints only `*.{ts,tsx}`, so `color: tomato;` in a `.css` file passed
every shipped gate, and `style={{ color: 'white' }}` in a `.tsx` file passed too
because nothing scanned for keywords at all.

`tests/ui/tokens.test.ts` now scans `src/ui/**/*.{ts,tsx,css}` (excluding
`tokens.css`) for:

- all **148** CSS named colours, minus `transparent` and `currentColor`, which
  are not colours in R1.1's sense;
- framework palette utility classes (`text-red-500`, `bg-slate-900`, …), which
  smuggle a literal in as a class name — a real risk here since Tailwind is
  installed;
- comments are stripped first, so a comment may still discuss "the red stamp".

Lookarounds keep it precise: `(?<![\w.$#-])keyword(?![\w(-])` spares
`var(--sig-red)`, `Math.tan` and the CSS `tan()` function. Because that also
spares hyphenated forms, the utility-class scan covers them separately — between
the two, R1.7 is now genuinely complete, so §10 claims it as complete.

A `still recognises a violation when one is introduced` test pins the
lookarounds so a future "simplification" cannot quietly neuter the scan.

**1(b) R2.2 / R3.1 double-listing — fixed by restructuring §10 around tiers.**
Both were listed as vitest-enforced *and* as needing a manual grep. Both claims
were half-true: the tests close the scales **inside `tokens.css`** and never look
at consuming files. §10 is now a five-tier table stating each rule exactly once:

| Tier | Meaning | Count |
|---|---|---|
| A — compiled | vitest fails the build | 7 |
| B — compiled where defined, read where used | 9 |
| B+C — compiled where defined, grepped where used | 2 (R2.2, R3.1) |
| C — grep | 6 |
| D — read the diff | 23 |
| E — judgement | 1 (R8.3) |

I audited this mechanically rather than by eye. First pass still had R2.2 and
R3.1 in two tiers — the exact defect I was fixing — which the audit caught and
which is why the B+C row exists.

## Finding 2 — R7.3 had no Do/Don't pair

Added, in the reviewer's suggested shape, carrying the finding that forced the
table: *Don't apply a flat +10% lightness bump to a red or green that carries
text; that lands at 3.38:1 and 3.58:1, below §7.5's floor.*

**Correction to my first report:** it said "52 numbered rules". The real count
was **47** (now 48 with R1.3a). The reviewer's "the ONLY rule of 52" phrasing
inherited my error. The audit script now counts rules from the document itself,
and §10 and the preamble both state 48.

## Finding 3 — R1.3 vs `--sig-band`

New **R1.3a** states the general rule, modelled on how R1.6 handles gold:

> A derived colour must be declared in `tokens.css` and registered in §0's table
> — otherwise it does not exist, and it gets no exemption from R1.3 or R1.6.

`--sig-band` is therefore a derived token, not a fifth red place. §0 gains a
registry row naming both derivations (`--hack-gold-ink`, `--sig-band`), and its
intro count moves **five → six** — the subsumed Minor finding, updated as
instructed.

This makes R1.3 mechanically countable, so the "eyes, not grep" list shrinks from
three items to one:

- R1.3 → tier C: `grep -rn 'var(--sig-red)' src/ui` enumerates every use; each hit
  must be one of the four places or the band. It currently returns exactly one
  hit — the `--sig-band` derivation in `tokens.css` — which is the sanctioned one.
- R5.5 → already covered by the transition/animation census grep; §10 now says
  that grep **is** the fifth-animation check rather than a prompt to go looking.
- R8.3 (attention hierarchy) remains, honestly, a matter of taste.

A new test forbids `color-mix()` / `color-contrast()` outside `tokens.css`, so
R1.3a cannot be dodged with an inline mix. The document's opening promise now
carries the carve-out by name: every rule is decided by a test, a grep, or a look
at the diff, **except R8.3**.

## Covering tests and commands

```
$ npx vitest run tests/ui/tokens.test.ts
  Test Files  1 passed (1) · Tests  48 passed (48)      # was 44; +4 R1.7/R1.3a scans

$ npx vitest run && npx tsc --noEmit && npm run lint && npm run build
  Test Files  4 passed (4) · Tests  82 passed (82)
  tsc OK · eslint clean · vite built in 71ms
```

**Mutation evidence for the new scans** (probes created, run, deleted):

```
src/ui/__probe.css  -> .probe { color: tomato; }
src/ui/__probe.tsx  -> <b style={{ color: "white" }} className="text-red-500" />

AssertionError: expected [ 'src/ui/__probe.css: tomato', …(1) ] to deeply equal []
AssertionError: expected [ 'src/ui/__probe.tsx: text-red-500' ] to deeply equal []
      Tests  2 failed | 45 passed (47)
```

Both of the reviewer's named holes — a named colour in `.css` and an inline style
in `.tsx` — now fail the build.

**Document audit** (`scratchpad/audit.mjs`, parses DESIGN.md itself):

```
rules defined: 48
duplicate definitions: none
rules missing a Do/Don't pair: none
rules listed in more than one tier: none
defined but absent from the tier table: none
listed in tier table but never defined: none
```

**All nine §10 greps re-executed**: the five "must print nothing" print nothing;
the three enumerating greps run without syntax error and return only sanctioned
hits.

## Files changed in this round

- `docs/DESIGN.md` — §0 registry row + count, R1.3a (new rule), R7.3 Do/Don't,
  §10 rewritten as a tier table, preamble carve-out
- `tests/ui/tokens.test.ts` — named-colour scan, palette-utility scan, comment
  stripping, inline-derivation ban, scan self-check (44 → 47 tests)

`src/ui/theme/tokens.css` is unchanged — no token values moved in this round.

## Residual concerns

1. The named-colour scan reads code with comments stripped; a colour keyword
   sitting in **JSX prose text** would be a false positive. Per the delta spec all
   user-facing copy lives in `src/content/**` behind the i18n catalog, so `src/ui`
   should carry no prose — but if T14–T18 inline a literal string containing e.g.
   "red", the fix is to move the copy to the catalog, which is the architecture
   anyway. Flagging so the next agent recognises the failure rather than deleting
   the guard.
2. Tier D (23 rules) is the largest bucket and depends on a reviewer actually
   reading the diff. That is inherent to rules about *usage* rather than
   definition; T29's screenshot pass is the backstop.
3. My earlier "52 rules" figure appeared in the first report and may have been
   copied into the controller ledger; the correct count is 48.

---

# Fix report — review round 2

**Verdict addressed:** findings 1–3 accepted; one new Important breakage
introduced by the round-1 diff. **Fix commit:** `HEAD` below. Scope held to that
breakage plus the one subsumed correction.

## The breakage: R6.1 lost its only enforcement in my own tier rewrite

The re-reviewer is right, and this is worth stating plainly: round 1's §10
rewrite deleted the line

```sh
grep -rn 'outline: *none' src/ui                                              # R6.1
```

and simultaneously promoted R6.1 into **Tier A — compiled**, unqualified. The
`R6 focus` describe block only ever asserted the *declared token value* in
`tokens.css`; it never scanned consuming files. So between round 0 and round 1,
R6.1 went from "grep-checked" to "claimed compiled, actually unchecked" — a
component writing `outline: none;` passed every gate. That is precisely the
defect class Finding 1 was about, reintroduced by the fix for Finding 1. The
lesson generalises: deleting a checklist line is a change to enforcement, not to
prose, and needs the same scrutiny as deleting a test.

**Fixed with the strong option** (no false-positive reason found to avoid it).
`tests/ui/tokens.test.ts` now scans `src/ui/**/*.{ts,tsx,css}`, comment-stripped
via the same helper as the named-colour scan:

```ts
const FOCUS_SUPPRESSION_RE = /\boutline(?:-?(?:width|style))?\s*:\s*['"]?\s*(?:none|0)/gi;
```

It catches every spelling — `outline: none`, `outline:0`, `outline-style: none`,
and the JSX style-object forms `outline: 'none'`, `outlineWidth: 0`,
`outlineStyle: "none"` — while sparing `outline-offset: …` and
`outline: var(--focus-ring)`. A companion `still recognises focus suppression
when it is introduced` test pins those six positives and two negatives, so the
guard cannot be silently neutered later (same pattern as the named-colour
self-check).

The deleted grep line is **not** restored: the rule is compiled now, and adding
the grep back would re-create a double-listing.

**Tier A scope note extended to R6.1**, as the re-reviewer suggested it might
naturally be. §10 now states exactly what is and is not covered: the suppression
half is complete, the ring's value and its deliberate absence from the dark block
are pinned, and the one thing the test cannot see — an element that never
declares `:focus-visible` at all — is named as a *missing* rather than
*suppressed* focus style, caught by tabbing the screen.

R6.1 remains in exactly one tier; the audit below re-confirms that.

## Subsumed correction

Round 1's evidence line read `Tests 47 passed (47)`. The true figure was **48**:
I ran the file after adding the three R1.7 scans, then added the `color-mix`
test for R1.3a and only re-ran the full suite, so the per-file number in the
report was stale by one. Corrected in place; the arithmetic now reads 44 + 4 = 48.

## Covering tests and commands

```
$ npx vitest run tests/ui/tokens.test.ts
  Test Files  1 passed (1) · Tests  50 passed (50)      # 48 + 2 R6.1 scans

$ npx vitest run && npx tsc --noEmit && npm run lint && npm run build
  Test Files  4 passed (4) · Tests  84 passed (84)
  tsc OK · eslint clean · vite built in 69ms
```

**Mutation evidence** — probes created, run, deleted:

```
src/ui/__probe.css  -> .probe:focus-visible { outline: none; }
src/ui/__probe.tsx  -> export const P = () => <b style={{ outline: "none" }} />;

AssertionError: expected [ …(2) ] to deeply equal []
      Tests  1 failed | 49 passed (50)
```

Both spellings, in both file types, now fail the build.

**Document audit** (unchanged pass, re-run after the edit):

```
rules defined: 48
duplicate definitions: none
rules missing a Do/Don't pair: none
rules listed in more than one tier: none
defined but absent from the tier table: none
listed in tier table but never defined: none
```

## Files changed in this round

- `tests/ui/tokens.test.ts` — focus-suppression scan + its self-check (48 → 50)
- `docs/DESIGN.md` — Tier A scope paragraph extended to R6.1
- report file — round-1 test count corrected 47 → 48

`src/ui/theme/tokens.css` unchanged; no rule text, tier assignment, or token
value moved.

## Deferred notes (reported only, not fixed — per instruction)

1. **R5.6 has no mechanical check.** `tokens.css` collapses the CSS durations
   under `prefers-reduced-motion` and that *is* tested, but the JS half — "any
   JS-driven motion must check `matchMedia` itself" — is unenforced. It is
   pre-existing (round 0), not introduced by either fix round, and it is
   currently vacuous since no JS motion exists yet. It becomes real the moment
   T17/T18 write the confetti canvas and the stamp timeline. The natural check is
   a scan asserting that any file containing `requestAnimationFrame` or a
   `setTimeout` tied to `--dur-*` also references `prefers-reduced-motion`;
   ledgered for final review rather than guessed at now.
2. **The Tier A scope paragraph now covers R1.7, R1.3a, R7.3 and R6.1** — the
   four Tier A rules whose coverage needed qualifying. R4.2 (no `box-shadow`) and
   R4.3 (px radii ≤ 2px) are the remaining Tier A rules and are unqualified on
   purpose: the box-shadow scan is exhaustive, and R4.3's `50%` allowance is
   stated in the rule itself rather than being a gap in the check. Flagging so
   the next reviewer does not have to re-derive that.
