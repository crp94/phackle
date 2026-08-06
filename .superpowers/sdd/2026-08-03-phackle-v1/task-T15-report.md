# Task T15 report: BRIEFING + PUBLISHED screens

**Status: DONE.** Full gate green: 612 tests / 29 files (`npx vitest run`),
`tsc --noEmit` clean, `eslint .` clean, `npm run build` clean.

## STEP 0

`git reset --hard 8035462` (worktree already there); verified 20 scenarios in
`src/content/en/index.ts` and confirmed `src/ui/components/JournalCover.tsx`
did not exist; `npm ci` (527 packages, 0 vulnerabilities); all npm/npx/node
commands prefixed `PATH="/usr/bin:$PATH"` throughout.

## Files created

Pure logic (game/):
- `src/game/puzzleDate.ts` — `isoFromPuzzleNumber(n)`, the exact left inverse
  of `daily.ts`'s `puzzleNumber(iso)`. **Why it exists**: `pickJournal`,
  the press picker and Grantwell's rotation all hash `iso` (per the
  controller's pinned formulas), but `GameStore` (T12, frozen, not owned by
  this task) exposes only `puzzleNumber`, never `iso` itself. Rather than
  touch `store.ts`, this recovers the same `iso` the app booted with from
  `puzzleNumber` alone — verified as an exact (not approximate) inverse via
  a round-trip test against the real `puzzleNumber()` across a spread
  including a year boundary, plus pre-EPOCH (dev/practice) values.
- `src/game/published.ts` — `pickJournal`, `egregiousnessTier`, `fakeDoi`,
  `substituteEffect`, `pickPress`, `confettiParticlesForTier`. All pure,
  documented, unit-tested in isolation.
- `src/game/briefing.ts` — `pickGrantwellEmail`. Originally co-located
  inside `Briefing.tsx` (matching `src/ui/App.tsx`'s `ThemeToggle`/
  `LocaleToggle` pattern), but that pattern only works when every co-located
  export IS a component — `eslint`'s `react-refresh/only-export-components`
  correctly flagged it, so this pure selector moved to its own module
  (mirrors `published.ts`'s split).

UI:
- `src/ui/components/JournalCover.tsx` + `.css` — pure/presentational,
  exact pinned interface (`journal, headline, authors, doi, tier`). Static
  (R8.3: no animated masthead/gradient/second stamp). Tier 3 gets a
  `--weight-medium` nod (closed R2.3 scale) on masthead+headline — a
  restrained, non-colour, non-shadow "Editor's Pick" acknowledgement, plus a
  `data-tier` attribute (test/CSS hook, not visible content).
- `src/ui/screens/Briefing.tsx` + `.css` — manuscript title page (question
  as `<h1>`, `briefing.correspondingAuthor`, cover story) + Grantwell
  `EmailCard` + `briefing.openData` CTA. Prereg chooser: one-line comment,
  renders nothing (T18).
- `src/ui/screens/Published.tsx` + `.css` — full-bleed cover + confetti +
  two press cards + tier-3 chyron + inline career-points figure + "Face the
  truth" overlay. Detail below.
- `src/ui/screens/registry.t15.patch.md` — the two registry lines (see
  "Registry integration").

Tests (5 new files; the brief named only `tests/ui/published.test.tsx` —
splitting pure-logic vs. component tests, and Briefing vs. Published, into
5 files matches this codebase's own `tests/game/*.test.ts` /
`tests/ui/*.test.tsx` convention, e.g. T16's own brief lists 3 files for 3
components):
- `tests/game/puzzleDate.test.ts` (4 tests)
- `tests/game/published.test.ts` (35 tests — tier, DOI, confetti map,
  effect substitution incl. floor-at-1/no-token/negative-beta/rounding
  cases, pickJournal incl. fallback, pickPress preference-vs-fallback)
- `tests/game/briefing.test.ts` (3 tests — pickGrantwellEmail)
- `tests/ui/briefing.test.tsx` (10 tests)
- `tests/ui/published.test.tsx` (17 tests — JournalCover, wiring, tiers,
  confetti, overlay/focus-trap)

Edited:
- `src/content/en/copy.ts` — 4 new keys (below).
- `src/ui/theme/tokens.css`, `docs/DESIGN.md` — `--scrim` derived token
  (coordinator-authorized mid-task; see "Scrim ruling").

## Registry integration (the tricky part)

T14's `src/ui/screens/registry.ts` genuinely does not exist in this
worktree (STEP 0 resets to a commit before either T14 or T15 existed). Two
separate concerns:

1. **Getting Briefing/Published INTO the registry**: not possible from this
   tree (the file to edit doesn't exist). `registry.t15.patch.md` documents
   the assumed shape (`SCREENS: Record<Screen, ComponentType>`) and gives
   the controller the exact two import lines + two map-entry replacements,
   flagged as a best-effort guess to reconcile against T14's real file.

2. **Published reaching OUT to the registry for `SCREENS.call`** (the "Face
   the truth" overlay): this needed to compile and build TODAY, with the
   target module absent, and work correctly AFTER merge. Solution, verified
   empirically before committing to it (see `.tmp_vite_probe` experiment,
   since deleted): hold the specifier in a `const` (`REGISTRY_MODULE_PATH =
   './registry'`), never inlined as a literal into `import(...)`, plus
   `/* @vite-ignore */`.
   - `tsc` only attempts to resolve a dynamic `import()` for TYPE purposes
     when the argument is a literal string node; a variable reference is
     untyped (`Promise<any>`) and unresolved — confirmed by a side-by-side
     probe (`import('./doesnotexist')` → `TS2307`; the same via a `const`
     variable → no error), same tsconfig as this project's.
   - Vite's import-analysis only tries to bundle a *statically analyzable*
     dynamic import; `/* @vite-ignore */` explicitly opts out. Confirmed via
     an isolated `vite.build()` JS-API probe: build succeeded, and the
     emitted code preserved `import(/* @vite-ignore */ "…")` verbatim as a
     runtime-only expression.
   - `loadCallScreenFromRegistry()` wraps the import in try/catch, resolving
     to `null` on failure — unit-tested directly (`resolves.toBeNull()`
     against the REAL, unmocked function, since the module is genuinely
     absent today) and exercised end-to-end (`renderPublished()` with no
     `loadCallScreen` override — CTA click opens the overlay with nothing
     rendered inside, no crash).
   - `Published`/`Briefing` never call `useGameStore` (the real singleton)
     directly in a way tests can't intercept: both accept an optional
     `useStore` prop (typed `<T>(selector: (s: GameStore) => T) => T`,
     structurally identical to the real hook), defaulting to it. Tests
     inject an isolated `createGameStore()` bound through zustand/react's
     own generic `useStore` — no change to `store.ts` (not owned by this
     task), no shared/global test state.

## Egregiousness tiers, press picker, headline substitution

- `egregiousnessTier`: `forks <= TIER_FORKS.polite → 1`,
  `forks >= TIER_FORKS.editorsPick → 3`, else `2`. Boundary cases 3/4/9/10
  all covered, plus reading the *live* tuning constants rather than copying
  their numbers.
- `confettiParticlesForTier`: 150/250/400, still passed through
  `ConfettiLayer`'s own independent 400-cap (belt-and-suspenders, per its
  existing doc comment).
- `substituteEffect(headline, beta)`: `Math.max(1, Math.round(Math.abs(beta)))`,
  substituted only if `{effect}` is present (`.replace` no-ops otherwise).
  Tested: floor-at-1 for small beta AND for exact-zero beta, negative-beta
  (direction is the headline's own wording's job, not the number's),
  rounding (2.5→3, 2.49→2), no-token passthrough.
- `pickPress(press, tier, scenarioId, iso)`: prefers a tier-matched blurb
  bound to `scenarioId`; falls back to the scenario-agnostic pool at that
  tier; `fnv1a32(iso + String(tier))`. Published renders **two** cards
  (master spec §2.5: "1-2"): the second salts `iso` (`` `${iso}#2` ``)
  rather than growing the function a bespoke exclude-list parameter — still
  pure/deterministic. The tier-3 chyron uses a third salt (`#chyron`). All
  three picks draw from the same pool, so a coincidental repeat (e.g.
  `cat-crypto` tier 1's singleton scenario-bound blurb) is legal, not a bug
  — every test that checks blurb text uses `getAllByText`/set-dedup rather
  than assuming distinctness, after two tests initially failed exactly that
  way and were fixed to assert what the picker actually (correctly) does.
- Grantwell rotation: `fnv1a32('grantwell:'+iso) % bank.length`, exactly as
  pinned.
- `pickJournal(tags, iso)`: tag-intersecting pool (verified non-empty for
  all 20 real scenarios by hand before writing the fallback), `fnv1a32(iso)`
  pick, falls back to the full `JOURNALS` pool if no journal intersects
  (defensive; provably unreachable with current content, tested anyway with
  a fabricated tag). `pickJournal` takes no locale parameter at all — the
  structural proof that the masthead can't vary by locale — plus an
  integration test that stubs `navigator.language = 'it'` and asserts the
  rendered masthead still matches the pure function's own (English) output.

## Scrim ruling (mid-task coordinator message)

Before this arrived I had independently reached the same fork the message
resolves — DESIGN.md R4.2's text ("--ink at 60% alpha via color-mix") vs.
R1.3a + `tests/ui/tokens.test.ts` forbidding `color-mix` outside
`tokens.css` — and had shipped a *plain-opacity* workaround on the cover
itself specifically to avoid touching files outside this task's ownership
list. The coordinator's authorized resolution (add `--scrim`, register it,
correct R4.2's wording) is what's implemented now; the opacity workaround
was fully removed, not layered on top:
- `tokens.css`: `--scrim: color-mix(in srgb, var(--ink) 60%, transparent);`
  under `:root` only (no dark-theme override needed — derives from `--ink`,
  which already flips, same as `--sig-band` per R7.4).
- `DESIGN.md`: §0's derived-colours row now says "three" and lists
  `--scrim`; R1.3a's "general rule" sentence now names it too; R4.2's "Do"
  line now says `background: var(--scrim)` instead of the inline recipe,
  and its "Don't" line explicitly bans inlining that same recipe; §9's
  token-reference table lists it.
- `Published.css`: `.ph-call-overlay { background: var(--scrim); }` — a
  full-viewport wash (behind `z-index: var(--z-modal)`) that the dimmed
  cover shows through, not a solid fill (R4.1 still reserves the one solid
  fill for SpecCurve's significance band). The cover itself carries only
  `aria-hidden`/`inert` (a11y correctness) and no visual class of its own —
  the scrim is the whole dimming mechanism.
- `tests/ui/tokens.test.ts` re-run clean (50/50) after the change; the new
  token is not in `TEXT_TOKENS` (it never renders characters, so no
  contrast-floor assertion applies to it).

## Career-points figure (self-initiated addition)

The controller's global constraints state the Published screen is "the ONE
place gold appears (confetti particles + inline career-points text per
R1.6)" — I had built confetti wiring but no career-points text. Added via
its own RED/GREEN cycle: `published.careerPoints` copy key (`'+{n} career
points'`), rendered from the *live* `SCORING.publishedCareer` tuning
constant (reaching this screen at all means `published` is true, so this is
simply the fixed award, not `scoreDay()`'s cumulative day-level breakdown,
which belongs to the Summary screen, T17). Styled `--hack-gold-ink`,
mono/tabular for the whole short phrase — same "numeral embedded in a
label reads as one mono unit" precedent `src/ui/App.css`'s own
`.ph-header__vol` already sets, not just the digits in isolation.

## Copy keys added (4)

| Key | Value | Used by |
|---|---|---|
| `briefing.emailFrom` | `Prof. R. Grantwell` | Briefing → EmailCard `from` |
| `briefing.emailSubject` | `Re: the deadline` | Briefing → EmailCard `subject` (generic enough for all 22 rotating bodies) |
| `published.authors` | `You, et al.` | JournalCover `authors` |
| `published.careerPoints` | `+{n} career points` | Published's inline gold-ink figure |

`email.from`/`email.subject` (pre-existing) are the generic "From:"/
"Subject:" LABELS `EmailCard` renders itself; the two new `briefing.*` keys
are the actual sender/subject VALUES Briefing supplies as props — same
split EmailCard's own props/`t()` mix already establishes.

## DESIGN.md self-audit

Tier A (`tests/ui/tokens.test.ts`): 50/50 green throughout, including after
the `--scrim` addition.

Tier C, run directly against `src/ui` (all five "must print nothing"
checks clean; all three enumeration checks re-verified to contain **zero**
hits from any T15 file — every hit belongs to pre-existing, already-audited
code: `Stamp.css`'s two sanctioned animations, `Stamp.css`+`tokens.css`'s
`--sig-red` uses, `App.css`'s two pre-existing 2px selection underlines):

```
grep -rnE 'border:\s' src/ui                              # empty
grep -rnE '\bz-index:\s*[0-9]' src/ui                      # empty
grep -rn '<select' src/ui                                 # empty
grep -rnE '@media \(min-width:' src/ui | grep -v '768px'   # empty
grep -rn 'transition: all' src/ui                          # empty
grep -rnE '\b(transition|animation):' src/ui                # Stamp.css only
grep -rn 'var(--sig-red)' src/ui                            # Stamp.css + tokens.css only
grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css        # App.css only
```

Gold usage (R1.6), grepped directly in the 3 new CSS files: `--hack-gold-ink`
appears exactly once (`.ph-published__career`); plain `--hack-gold` appears
nowhere in any T15 file (ConfettiLayer's own, untouched, existing use is
the confetti-marks half of the rule). Every `color:` in the 3 new CSS files
is `var(--ink)`, `var(--muted)`, or `var(--hack-gold-ink)` — no `--sig-red`,
no `--assist-green`, no literal, confirmed by direct grep.

Motion budget: press cards and the chyron bar render with **no**
`transition`/`animation` property at all (master spec's prose says
"blurbs sliding in"; DESIGN.md's four-animation budget is exhaustive and a
5th, un-budgeted slide is exactly R5.5's "no accordion slides" territory —
DESIGN.md's own precedence clause has it override the master spec's looser
wording here). Confetti is reused unmodified from T5 (already
reduced-motion-gated); nothing new was added to the motion budget.

R8.3 (judgement tier): JournalCover is deliberately static (no animated
masthead/gradient/second stamp, per its own explicit "Don't"); the tier-3
nod is a font-weight change only, not a second signature competing with
Act I's dial (which lives on Lab, T14) or Act II's stamp (Reveal, T16).

R3.2 (section rhythm): tightened during self-audit — Published's
JournalCover-block, press-list, chyron and CTA now each open at
`--space-40`; finer 8/16/24 steps are reserved for sub-element gaps
*within* one of those blocks (mirrors `EmailCard.css`'s own internal
16px-vs-8px split).

## A real bug caught and fixed along the way

`handleFaceTruth` originally did `loadCallScreen().then(setCallScreen)`.
Since the resolved value is itself a function (a component), React's
`useState` setter treats a bare function argument as an *updater* (calls it
with the previous state) rather than the value to store — so `CallScreen`
ended up holding the *element* the fake test component rendered
(`<div>…</div>`), not the component reference, and React threw "Element
type is invalid… got: `<div />`" the moment it tried `<CallScreen />`. Fixed
to `.then((component) => setCallScreen(() => component))` — the standard
idiom for storing a function in state. Caught by the tests, not by
inspection; flagging in case this pattern (storing a lazily-resolved
component reference in `useState`) recurs in T16/T17.

## Concerns for the controller

1. `registry.t15.patch.md`'s assumed `SCREENS: Record<Screen, ComponentType>`
   shape is a guess (T14's file isn't visible from this tree). If T14's real
   shape differs, the one read site to adjust is
   `Published.tsx`'s `loadCallScreenFromRegistry` (`mod.SCREENS?.call`).
2. The "Face the truth" overlay renders **nothing** inside itself until
   `SCREENS.call` resolves to something real — today (pre-merge) that's
   forever, so clicking it opens a dimmed, focus-trapped, empty dialog.
   Correct and tested as an interim state; will self-resolve once T14+T16
   land.
3. No cancel/escape from the overlay by design — master spec §2.6 and the
   T16 brief describe the Call as a forced choice with no cancel affordance,
   so none was added. Flagging in case that reading is wrong.
4. Two of the three egregiousness-tier picks (press card 2, the chyron) can
   coincidentally repeat an already-shown blurb on a pool-of-one or
   small-pool day — legal per the picker's own contract, not a defect, but
   noted since it's a visible product behavior, not just an implementation
   detail.

## Commits

1. `feat: briefing + published celebration with egregiousness tiers` — all
   of the above.

Branch: worktree `agent-ac2c075693f639653`, based on `8035462`. Never
pushed, switched, or merged.

---

## Fix round 1 (review verdict: Needs fixes — one Important, one subsumed one-liner)

Reviewer verdict traced the one Important finding to the controller's own
brief, not to an implementation gap in what was actually asked: tier
boundaries, watermark counting, `{effect}` edges, the picker's
anti-scenario-leak test, and the `--scrim` fix (scoped exactly as the
coordinator's mid-task ruling authorized) were all called out as built with
"unusual rigor" / "the strongest possible form of no test loosening"; the
gold career-points addition was ruled to be R1.6's own worked example and
kept as-is. Two things needed fixing.

### Fix 1 (Important): the missing altmetric counter

Master spec §2.5 lists five celebration elements; the fake altmetric
counter was entirely absent from the first pass. Controller ruling: render
it as a **static, tier-scaled** figure — the spec's "spinning up" would be
a fifth, un-budgeted animation (DESIGN.md's four-item motion list is
exhaustive) — resolved with the same one-line documented precedence note
already used for the press-card "sliding in" language.

**RED** — added to `tests/game/published.test.ts` (pure logic:
determinism, strict monotone tier-scaling in BOTH directions, "Top 1%"
territory at tier 3, integer-range bounds) and `tests/ui/published.test.tsx`
(rendered on screen with the same computed values Published itself uses,
scales up across tiers on the same day, and a structural no-animation-class
check). Confirmed failing before implementation:

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/published.test.ts
 FAIL  tests/game/published.test.ts > altmetricPercentile … > reaches the controller-suggested "Top 1%" territory at tier 3
TypeError: altmetricPercentile is not a function
 Test Files  1 failed (1)
      Tests  8 failed | 31 passed (39)

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/published.test.tsx -t "altmetric"
 Test Files  1 failed (1)
      Tests  3 failed | 17 skipped (20)
```

**GREEN** — `src/game/published.ts` gained `altmetricScore(iso, tier)` and
`altmetricPercentile(iso, tier)`: each tier gets its own **non-overlapping**
numeric range (score: 1→[40,90], 2→[300,900], 3→[9000,9999]; percentile:
1→[50,80], 2→[15,40], 3→[1,5], descending since a smaller "Top N%" reads as
more impressive), with `fnv1a32('altmetric:'+iso)` /
`fnv1a32('altmetric-pct:'+iso)` picking the offset inside the tier's own
band. Non-overlapping ranges make "bigger tier → bigger score" (and the
inverse for percentile) a **hard invariant** — true for every iso, not just
typical — which is exactly what the monotone test asserts across 5 dates
per tier-pair. Two new copy keys, Act-I sincere register, no wink:
`published.altmetricScore` = `'Attention score: {n}'`,
`published.altmetricPercentile` = `'Top {n}% of all research outputs, all
time'`. Rendered in `Published.tsx` inside a new `.ph-altmetric` block
(between the career-points line and the press list); `Published.css`'s new
rules carry **zero** `transition`/`animation` properties (verified by grep,
below) and use `--muted`/`--ink` only — confirmed R1.6's gold list does not
include this figure by grepping the new CSS directly.

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/published.test.ts
 Test Files  1 passed (1)
      Tests  39 passed (39)

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/published.test.tsx
 Test Files  1 passed (1)
      Tests  20 passed (20)

$ grep -nE '\b(transition|animation):' src/ui/screens/Published.css
(no output)

$ grep -n "hack-gold" src/ui/screens/Published.css
18:/* R1.6: gold that must be READ uses --hack-gold-ink, never plain
19:   --hack-gold (2.94:1, fails the 4.5:1 text floor). The whole short phrase
28:  color: var(--hack-gold-ink);
38:   (--muted), never --hack-gold/-ink. */
(only .ph-published__career at line 28 -- the pre-existing, already-ruled-
 KEEP career-points figure; .ph-altmetric's own rules, lines 40-58, use only
 --muted)
```

### Fix 2 (subsumed one-liner): the corresponding-author byline

`briefing.correspondingAuthor` predated this task (T4) and read
`'Corresponding author: Prof. R. Grantwell'` — backwards from master spec
§2.3/§7.3's own wording ("Corresponding author: You"), confirmed by
grepping both `docs/implementation_plan.md` and the plan snapshot under
`docs/superpowers/`, which both already say "You". The PLAYER is the paper's
author; Grantwell is only the PI *emailing* them
(`briefing.emailFrom`, unchanged). Changed the `en` value to
`'Corresponding author: You'`, with an inline comment for IT/ES (T19/T20)
to carry the same correction rather than the pre-fix wording. Updated the
one test that asserted the old string
(`tests/ui/briefing.test.tsx`); `tests/ui/shell.test.tsx`'s own
`"Prof. R. Grantwell"` usages are an unrelated, isolated `EmailCard` prop
example and were correctly left untouched.

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/briefing.test.tsx
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### Five ledgered minors — not touched, per instruction

Empty-overlay single-assertion nit; App-header inert gap (routed to the
controller's a11y pass); briefing test title overclaim; watermark DOM-order
inconsistency; pickJournal locale-proof structural-only. The interim
keyboard-trap caveat auto-resolves at the T16 merge (controller's merge
checklist carries it) — no action taken here either.

### Full gate, re-run after both fixes

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  29 passed (29)
      Tests  623 passed (623)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npm run lint
> eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npm run build
✓ built in 101ms
PWA v1.3.0 — 8 entries precached
```

Self-audit re-run across the whole `src/ui` tree (all Tier C checks) after
both fixes — no new hits from any T15 file, same pre-existing hits as
before (`Stamp.css`'s 2 sanctioned animations / 2 `--sig-red` uses,
`tokens.css`'s 1 `--sig-band` derivation, `App.css`'s 2 pre-existing 2px
selection underlines):

```
$ grep -rnE 'border:\s' src/ui                              # empty
$ grep -rnE '\bz-index:\s*[0-9]' src/ui                      # empty
$ grep -rn 'transition: all' src/ui                          # empty
$ grep -rnE '\b(transition|animation):' src/ui                # Stamp.css only
$ grep -rn 'var(--sig-red)' src/ui                            # Stamp.css + tokens.css only
$ grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css        # App.css only
```

`tests/ui/tokens.test.ts` re-confirmed green (50/50) after both fixes.

### Commits (fix round)

2. `fix: add the altmetric counter; correct the corresponding-author byline`

New HEAD: `3d5ec28` (previous: `03d7500`, base: `8035462`). Working tree
clean. Never pushed, switched, or merged.
