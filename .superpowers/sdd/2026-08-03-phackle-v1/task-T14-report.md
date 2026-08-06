# Task T14 report — the Lab screen + screen-router glue

**Branch:** `worktree-agent-afedfa6a0f5611412` · **Final SHA:** `5501c13bfb804897dce853839e67eb8b7dfd1b06`
(original submission SHA `5881a2fdfb8413ff09bdca0d722388d5f2a620b9`; two fix-round commits added — see "Fix round" section at the end of this report)
**Base:** `8035462` (Merge T11: worker RPC — ENGINE COMPLETE)

## Commits

1. `ff8897c` — `docs: reconcile PValueDial's Act-I colour with DESIGN.md law` (DESIGN.md only)
2. `417f02a` — `feat: Lab — the workbench (controls, dial, coef plot, fork trail, optional stopping)`
3. `5881a2f` — `feat: screen-router glue — registry, stubs, ScreenRouter, App boot wiring`

Commits are ordered so each is independently buildable: Lab.tsx and its four
components have no dependency on the registry/router/App wiring (verified by
import graph), so commit 2 stands alone; commit 3 wires the already-committed
Lab in.

## STEP 0

- `git reset --hard 8035462` done; verified `src/game/engineClient.ts` and
  `src/game/store.ts` existed.
- `pwd` confirmed as the worktree (`.../.claude/worktrees/agent-afedfa6a0f5611412`)
  before any file write.
- `npm ci` run; default `node` is v25 (jsdom `EBADENGINE` warning) — every
  npm/npx/vitest/tsc/eslint/vite invocation in this task was prefixed with
  `PATH="/usr/bin:$PATH"` (node v22.22.1), confirmed working throughout.

## Implemented

### The glue (owned, per the pin)

- **`src/ui/screens/registry.ts`** — `SCREENS: Record<Screen, ComponentType>`,
  one line per screen (`briefing: BriefingStub, lab: Lab, published:
  PublishedStub, call: CallStub, reveal: RevealStub, summary: SummaryStub`).
- **`src/ui/screens/stubs.tsx`** — `BriefingStub` (with the real `openData()`
  CTA, copy key `briefing.openData`), `PublishedStub`, `CallStub`,
  `RevealStub`, `SummaryStub`, each a bare `<section data-testid="stub-<screen>">`.
- **`src/ui/ScreenRouter.tsx`** (+`.css`) — reads `useGameStore(s => s.screen)`,
  renders `SCREENS[screen]`; renders `store.error → t('errors.workerCrash')`
  in a `role="alert"` banner **above** the current screen (additive, not a
  replacement — the screen itself never changes on a crash, matching
  `store.boot()`'s own onCrash handler, which only ever sets `error`).
- **`src/ui/App.tsx`** — inside T5's loading gate, a `useEffect` (guarded by a
  ref so it only ever fires once) does: `const client = createEngineClient();
  void boot(client, localIsoDate(), { practice: isPractice(window.location.search),
  mode: 'hack', scenarioCount: content.scenarios.length })`. The header now
  prefers `useGameStore(s => s.puzzleNumber)` once boot resolves (0 → falls
  back to the pre-boot `puzzleNumber` prop, which `main.tsx` still supplies
  synchronously via `puzzleNumber(localIsoDate())` so the header never shows
  a placeholder). Header/theme/locale toggles are untouched.
- **`src/main.tsx`** — now renders `<App puzzleNumber={...}><ScreenRouter />
  </App>`.
- **`src/game/store.ts`** — one additive change: the module-level singleton
  is now `export const gameStore = createGameStore();` (was an unexported
  `const`). Needed so this task's own tests (and the next sibling tasks'
  eventual tests) can drive `boot()`/`openData()`/etc. directly against the
  same instance `useGameStore` is bound to, exactly the way
  `tests/game/store.test.ts` already does via its own fresh `createGameStore()`
  instances. `useGameStore`'s own behavior is unchanged.

**A real bug this surfaced, and how it's handled:** `createEngineClient()`
constructs a real `Worker` synchronously the moment it's called. jsdom has no
`Worker` global (verified directly: a probe test asserting `typeof Worker ===
'function'` fails under this repo's own jsdom environment). Since App.tsx's
new mount effect now fires on **every** render of `<App>` — including T5's
pre-existing `tests/ui/shell.test.tsx`, which renders `<App>` directly and
does not mock `game/engineClient` — an unguarded call would throw inside that
effect and break 5+ previously-passing tests that have nothing to do with
this task. The effect wraps `createEngineClient()` in a try/catch and routes
a synchronous failure through the same `gameStore.setState({ error })` path a
post-boot crash uses. This is real, load-bearing resilience (some real
environment could plausibly lack Worker support too) and is exactly what
keeps `shell.test.tsx` green **without modifying that file at all** — verified
by running the full suite (593/593 pass, `shell.test.tsx` untouched).

### The Lab (owned)

- **`src/ui/components/SpecControls.tsx`** (+`.css`) — six WAI-ARIA
  radiogroups (outcome, subgroup, covariates, exclusion, transform, tails),
  roving tabindex, Left/Right/Up/Down move + select (wrapping), `disabled`
  prop (native `disabled` on every `<button role="radio">`, exercised by
  Lab passing `false` today; reserved for the future Prereg screen). No
  `<select>` anywhere (R6.5). Covariates modeled as one 4-option choice
  (`none|income|risk|both`) mapped to `Spec['covariates']`, keeping the axis
  count at exactly six per the brief.
- **`src/ui/components/PValueDial.tsx`** (+`.css`) — `"p = 0.049"` (3
  decimals) / `"p < 0.001"` below that threshold; N + df (`df = n - 2 -
  income - risk`, matching `stats.ts`'s own `df = n - p` formula exactly,
  since `PathResult` doesn't carry `df` directly) shown small beneath, both
  mono/tabular (R2.4). Act-I colour rule: `--muted` ramping toward full
  opacity as p → .05, solid `--assist-green` once p < .05 (see the DESIGN.md
  amendment below for why this isn't a literal `color-mix()`). `valid ===
  false` renders `lab.insufficient` instead of the numeral (never trusting a
  "plausible" p/beta on an invalid result, per `PathResult`'s own comment).
  `result === null` renders a neutral "—" placeholder. A JS-driven ≤2px
  `translateY` "tick" (gated on `useReducedMotion()`, matching
  Stamp/ConfettiLayer's own pattern) fires on genuine value changes.
- **`src/ui/components/CoefPlot.tsx`** (+`.css`) — plain SVG: a `--rule`
  zero-line always shown; a `--ink` CI interval + point only when the result
  is valid (never plots a misleading interval for an invalid result). Plain
  numeric SVG coordinates inside a `viewBox` (mirrors `Stamp.tsx`'s own
  precedent — these aren't CSS px and aren't subject to R2.2/R3.1's scale).
  Accessible caption via `lab.coefPlotCaption`.
- **`src/ui/components/ForkTrail.tsx`** (+`.css`) — imports `FORK_EMOJI` from
  `game/share.ts` (newly exported — see below) and `classifyChange` from
  `game/forkLog.ts` (already exported); its own small loop restates the
  "first VIEW_SPEC free, later ones count iff seen, PEEK_AND_EXTEND always
  counts" rule (the same rule `countForks`/`buildTrail` encode, neither of
  which is exported) to build a **live**, terminal-marker-free trail — the
  Lab is always mid-play.
- **`src/ui/screens/Lab.tsx`** (+`.css`) — wires all four above to the store.
  Submit enabled iff `result && result.valid && result.p < .05 && !pending`.
  "Report a null result" always enabled. "Collect N more" (N derived from
  `N_SCHEDULE[1] - N_SCHEDULE[0]`, not hardcoded) disabled at N=400/pending/no
  result. Footnotes: `lab.peekFootnote` after the 1st `PEEK_AND_EXTEND` in the
  log, `lab.peekFootnoteArmitage` additionally after the 2nd. Layout: DOM
  order `[results, controls]` throughout; mobile (`column`) puts results on
  top with `position: sticky; top: 0`; `≥768px` (`row-reverse`) puts controls
  on the left, results on the right, using the project's one sanctioned
  breakpoint.
- **`src/game/share.ts`** — one additive change: `FORK_EMOJI` is now
  exported (was an unexported `const`), specifically so ForkTrail imports the
  legend rather than duplicating it, per the pin.

## Copy keys added (22)

All under `lab.*`, added to the `CopyKey` union and the `en/copy.ts` catalog
together (kept the `Record<CopyKey, string>` contract intact — `tsc` would
fail on a mismatch):

```
lab.subgroupAll, lab.subgroupAgeLt40, lab.subgroupAgeGe40, lab.subgroupExpHigh,
lab.subgroupExpLow, lab.subgroupUrban, lab.subgroupRural,
lab.covariatesNone, lab.covariatesBoth,
lab.exclusionNone, lab.exclusionZ3, lab.exclusionZ2_5, lab.exclusionZ2,
lab.transformRaw, lab.transformLog1p,
lab.tailsTwo, lab.tailsOne,
lab.pEquals, lab.pBelow, lab.dfLabel, lab.coefPlotCaption, lab.forkTrailLabel
```

(Outcome labels and the two covariate names themselves are scenario-provided,
not copy keys — no new key needed there. `lab.submit`, `lab.reportNull`,
`lab.nLabel`, `lab.collectMore`, `lab.peekFootnote`,
`lab.peekFootnoteArmitage`, `lab.insufficient` already existed and are reused
as-is.)

## TDD — RED / GREEN

**RED** (`tests/ui/lab.test.tsx`, `tests/ui/router.test.tsx` written first,
against no implementation):

```
FAIL  tests/ui/lab.test.tsx [ tests/ui/lab.test.tsx ]
Error: Failed to resolve import "../../src/ui/components/PValueDial" from "tests/ui/lab.test.tsx". Does the file exist?
FAIL  tests/ui/router.test.tsx [ tests/ui/router.test.tsx ]
Error: Failed to resolve import "../../src/ui/ScreenRouter" from "tests/ui/router.test.tsx". Does the file exist?
Test Files  2 failed (2)
```

**GREEN** (after implementing components/screens/glue):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/lab.test.tsx tests/ui/router.test.tsx
Test Files  2 passed (2)
     Tests  43 passed (43)
```

**Full suite** (no regressions in any sibling task's tests — store, share,
tokens, shell, engine, content, i18n, storage, achievements, etc.):

```
$ PATH="/usr/bin:$PATH" npx vitest run
Test Files  26 passed (26)
     Tests  593 passed (593)
```

## Full gate (final, re-run against the committed HEAD)

```
$ PATH="/usr/bin:$PATH" npx vitest run           # 26 files, 593 tests passed
$ PATH="/usr/bin:$PATH" npx tsc --noEmit         # clean, no output
$ PATH="/usr/bin:$PATH" npx eslint .             # clean, no output
$ PATH="/usr/bin:$PATH" npx vite build           # succeeded, PWA precache generated
```

## DESIGN self-audit, rule by rule

Mechanical/grepped rules re-run directly against `src/ui` after implementation:

| Check | Command | Result |
|---|---|---|
| R4.5 no border shorthand | `grep -rnE 'border:\s' src/ui` | 0 hits |
| R4.7 no raw z-index | `grep -rnE '\bz-index:\s*[0-9]' src/ui` | 0 hits |
| R6.5 no `<select>` | `grep -rn '<select' src/ui` | 1 hit, inside a `//` comment ("never a `<select>`") describing the rule, not code |
| R3.4 only 768px breakpoint | `grep -rnE '@media \(min-width:' src/ui \| grep -v 768px` | 0 hits |
| R5.5 no `transition: all` | `grep -rn 'transition: all' src/ui` | 0 hits |
| R5.5 four animations only | `grep -rnE '\b(transition\|animation):' src/ui` | 3 hits: Stamp.css's 2 pre-existing `animation:` (R5.2) + PValueDial.css's 1 new `transition:` (R5.1, the dial tick) — no fifth |
| R1.3 `--sig-red` exactly 4 places | `grep -rn 'var(--sig-red)' src/ui` | 3 hits, all pre-existing (Stamp.css ×2, tokens.css's `--sig-band` derivation) — **zero from any Lab file**, confirming the Act-I ban mechanically |
| R2.2/R3.1 raw px outside tokens.css | `grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css` | 7 hits, all `border-block-end: 2px solid ...` — the sanctioned R4.6 selection underline, mirroring App.css's pre-existing identical pattern |
| R1.7 hex/rgb/hsl/color-mix in new files | manual grep across every new file | 0 code hits; 2 `color-mix(` hits are inside comments *explaining why color-mix isn't used* (stripped by the automated scanner, confirmed passing) |
| R6.1 no focus suppression | `tokens.test.ts` (automated) | passes; every new interactive class (`.ph-radio`, `.ph-lab__collect/submit/abandon`) has its own `:focus-visible` rule (manually confirmed present) |
| R4.2 no box-shadow | manual grep, new CSS files | 0 hits |

Tier D (read-the-diff) rules relevant to this task, reviewed by hand:

- **R1.1/R1.2** — no new surface colour; text is `--ink` or `--muted` throughout.
- **R1.4** — `--rule` used only for CoefPlot's zero-line stroke and the
  disabled-submit underline colour; never as text colour.
- **R2.1/R2.4/R2.5/R2.6** — mono+tabular on every numeral (dial, N/df line,
  coef-plot caption); STIX/display nowhere in the Lab except the
  insufficient-data sentence (prose, correctly `--font-display`); dial at
  `--text-dial`/`--leading-dial`.
- **R2.7** — SpecControls' group legends and ForkTrail's label are the only
  uppercased text, both carrying `--tracking-label`.
- **R3.1/R3.2/R3.3** — every spacing value in the new CSS is a `--space-*`
  token or bare `0`; no raw arithmetic.
- **R3.5/R3.6** — Lab is capped at `--page-max` and centred; SpecControls'
  groups are a hairline-separated stack, not a card grid.
- **R4.1** — no new filled area; `.ph-lab__results`' `background: var(--paper)`
  matches the page's own existing surface (needed for the sticky-mobile
  overlay to not show scrolled content through it), not a second colour.
- **R6.2/R6.3/R6.4** — every interactive target uses the `--space-12/16`
  padding pattern already established by App.css; states are never colour-only
  (the significant dial state also flips a class + the value itself; the
  insufficient state replaces the numeral with real text).
- **R8.1/R8.3** — the dial is the only element whose colour changes; no
  shadow/halo/pulse anywhere in the Lab; CoefPlot and ForkTrail stay
  deliberately quiet (`--muted` captions, small marks).

**Concern flagged and resolved, not swept under the rug:** DESIGN.md's own
R1.8 (before this task's `docs:` commit) prescribed a literal
`color-mix(in oklab, var(--muted), var(--sig-red) ...)` for the dial — this
would have (a) put `--sig-red` in the Lab, contradicting R1.3's grep-countable
"exactly four places" (all Act II), and (b) failed `tokens.test.ts`'s own
R1.3a scan ("finds no inline colour derivation outside tokens.css"), which
bans `color-mix(`/`color-contrast(` in every `src/ui` file except
`tokens.css`. The controller's ACT-I COLOUR RULE pin already resolves (a) by
name (assist-green, not sig-red); this task additionally resolves (b) by
implementing the ramp as opacity between the two tokens rather than a literal
mix, and amends DESIGN.md (R1.5's second exception, R1.8's rewrite, one new
§0 row) to match what's actually shipped and actually passes the mechanical
tests — see commit `ff8897c` for the full text.

## Files changed

- `docs/DESIGN.md` (amended — R1.5, R1.8, §0)
- `src/ui/screens/Lab.tsx`, `src/ui/screens/Lab.css` (new)
- `src/ui/screens/registry.ts`, `src/ui/screens/stubs.tsx` (new)
- `src/ui/ScreenRouter.tsx`, `src/ui/ScreenRouter.css` (new)
- `src/ui/App.tsx` (boot wiring, puzzleNumber-from-store fallback)
- `src/main.tsx` (renders `<ScreenRouter />` as App's children)
- `src/ui/components/SpecControls.tsx`, `.css` (new)
- `src/ui/components/PValueDial.tsx`, `.css` (new)
- `src/ui/components/CoefPlot.tsx`, `.css` (new)
- `src/ui/components/ForkTrail.tsx`, `.css` (new)
- `src/game/store.ts` (`export` the `gameStore` singleton)
- `src/game/share.ts` (`export` `FORK_EMOJI`)
- `src/content/en/copy.ts` (22 new `lab.*` keys)
- `tests/ui/lab.test.tsx`, `tests/ui/router.test.tsx` (new)

## Concerns for the controller

1. **DESIGN.md amendment** (commit `ff8897c`) — please review; it's a law
   change, not just an implementation detail, even though it's a small,
   targeted one that makes the document match what the controller's own
   pin already decided.
2. **`gameStore` export** — a one-word additive change to `store.ts`
   (T12's file). Doesn't touch `useGameStore`'s behavior or any existing
   test; needed so component-level tests (this task's, and presumably
   T15-T18's) can drive the same singleton the UI subscribes to. Flagging
   since store.ts wasn't explicitly mine to touch.
3. **`FORK_EMOJI` export** — same shape of change to `share.ts`, directly
   required by the pin's "import the mapping — do not duplicate the legend."
4. **App.tsx's try/catch around `createEngineClient()`** — goes slightly
   beyond the pin's literal text, added specifically because jsdom has no
   `Worker` global and T5's `shell.test.tsx` renders `<App>` unmocked; without
   it, this task would have broken 5+ pre-existing, passing tests. Verified
   `shell.test.tsx` itself needed zero changes.
5. **Covariates modeled as one 4-option radiogroup** (`none/income/risk/both`)
   rather than two separate toggles, to keep the axis count at exactly six
   per the brief/pin ("six segmented radiogroups"). If a sibling task expected
   two independent covariate toggles instead, this is the point to reconcile.
6. **PValueDial's tick timing** (`TICK_MS = 120`, mirroring `--dur-tick`) is a
   plain JS constant, not read from the CSS token at runtime — consistent
   with how the rest of the codebase treats duration tokens (Stamp.tsx uses
   no JS timer at all; ConfettiLayer's duration is caller-supplied), but
   worth a second look if a future token retune should also move this
   constant.

---

## Fix round (post-review)

Review verdict: **Needs fixes — one CRITICAL, one Important** (three minors
ledgered, not touched, per instruction). Both addressed; one minor (footnote
co-presence) subsumed into the CRITICAL fix's own test edits, as invited.

**New HEAD:** `5501c13bfb804897dce853839e67eb8b7dfd1b06`
**Fix commits:** `f412dec` (CRITICAL: dial contrast) → `5501c13` (IMPORTANT: SpecControls line cap)

### CRITICAL — the dial's opacity ramp broke its own contrast claim

**Root cause, confirmed.** The original `PValueDial` read a continuous
opacity ramp (`0.35 + 0.65 * proximity`) on a `--muted`-coloured element.
Reducing an element's `opacity` alpha-composites its rendered colour toward
whatever sits behind it — here, `--paper` — which is exactly what silently
broke R1.8's own "stays ≥4.5:1" claim: at `p=1.0` (`opacity≈0.35`), the
*effective* rendered colour is nowhere near `--muted` on its own. Computed
directly (same WCAG 2.1 formula `tests/ui/tokens.test.ts` uses, alpha-blended
against `--paper` first):

```
light: --muted (#6E6A5E) at opacity 0.35 over --paper (#FBF8F1)
  -> effective colour ≈ #C8C4B7 -> contrast on --paper ≈ 1.60:1  (floor: 4.5:1)
dark:  --muted (#8D897C) at opacity 0.35 over --paper (#141821)
  -> effective colour ≈ #4C4E4C -> contrast on --paper ≈ 1.70:1  (floor: 4.5:1)
```

This was real and unverified by the static token suite, exactly because that
suite only ever parses `tokens.css`'s own literal declarations — it has no
way to see a runtime `style={{opacity}}` value. Confirmed by the coordinator's
ruling: implement a **stepped** colour ramp via registered, contrast-checked
derived tokens instead of a continuous opacity blend.

**Fix, in order:**

1. **Three new derived tokens in `tokens.css`** — `--dial-step-1/2/3`,
   `color-mix(in srgb, var(--muted), var(--assist-green) 25/50/75%)`,
   **computed offline and hardcoded as literal hex** (not a live
   `color-mix()`) in both the `:root` and `[data-theme='dark']` blocks. Picked
   by scanning every 5%-95% srgb-mix step with a script mirroring
   `tests/ui/tokens.test.ts`'s own `relativeLuminance`/`contrastRatio`
   functions exactly (full script + full 5%-95% scan output below); 25/50/75%
   was chosen for an even, perceptible 5-state progression — not because
   narrower percentages were needed, since *every* step from 5% to 95%
   cleared 4.5:1 in both themes (both endpoints, `--muted` and
   `--assist-green`, already individually clear ~5:1 and sit close in
   luminance).

   **Computed contrast for the three chosen values, both themes:**

   | Step | Light hex | Light contrast | Dark hex | Dark contrast |
   |---|---|---|---|---|
   | `--dial-step-1` (25%) | `#5E6B5A` | **5.31:1** | `#808D7B` | **5.09:1** |
   | `--dial-step-2` (50%) | `#4E6C56` | **5.49:1** | `#74927A` | **5.19:1** |
   | `--dial-step-3` (75%) | `#3E6D52` | **5.63:1** | `#679679` | **5.26:1** |

   All six comfortably clear the 4.5:1 floor (lowest is dark step-1 at
   5.09:1).

2. **`PValueDial.tsx`**: `pProximity(p)` (continuous, opacity-driving)
   replaced by `dialBand(p)` (discrete, 5-valued): `p > .5` → `null` (the
   `--muted` default, no modifier class); `.2 < p ≤ .5` → `'step-1'`;
   `.1 < p ≤ .2` → `'step-2'`; `.05 ≤ p ≤ .1` → `'step-3'`; `p < .05` →
   `'significant'` (unchanged solid `--assist-green` — `p===.05` is never
   itself significant, matching `store.submit()`'s own strict `p<0.05`
   guard, so it reads as the top of `step-3`, not a gap). **No opacity
   styling anywhere** — the `style={{opacity}}` prop is gone entirely, and
   `PValueDial.css`'s transition list drops `opacity`, leaving only `color`
   and `transform` (the tick's translateY bump).

3. **`tests/ui/tokens.test.ts`**: `TEXT_TOKENS` now includes `dial-step-1/2/3`,
   so the existing "clears 4.5:1 against --paper" test loop picks them up
   automatically — R1.8's contrast claim is now genuinely mechanically
   enforced, the exact gap the review named. Also added one small "declares
   the three stepped colours in both themes" existence check, mirroring the
   pre-existing `hack-gold-ink` one.

4. **DESIGN.md**: R1.8 rewritten to describe the 5-state stepped design (band
   boundaries, the literal-hex-not-live-color-mix reasoning, the "no opacity"
   rule); R1.5's second exception re-worded to match; §0's dial-prose
   reconciliation row updated to mention the rejected opacity approach and
   why; §7.3's contrast table gained three rows (light/dark hex + measured
   ratio, same convention as every other accent there); §9's "Derived colour"
   token list gained the three names; §10 moved R1.8 from Tier D to **Tier
   B** ("compiled where it is defined [the new TEXT_TOKENS entries], read
   where it is used [PValueDial.tsx actually renders the four modifier
   classes]") — the same tier `--hack-gold-ink` (R1.6) sits in, for the same
   reason.

5. **`tests/ui/lab.test.tsx`**: replaced the two ad-hoc significant/
   not-significant checks' surrounding context with a `describe` block
   covering all five band boundaries (`0.6→null, 0.5→step-1, 0.2→step-2,
   0.1→step-3, 0.05→step-3, 0.049→significant`) via `it.each`, plus a
   dedicated test asserting `.ph-dial__value`'s inline `style.opacity` is
   `''` (never set) across five representative p-values. **Footnote
   co-presence** (ledgered minor, subsumed as invited): since I was already
   editing this file's dial tests, added a two-line assertion to the
   existing peek-footnote test confirming `lab.peekFootnote` is **still**
   present after the 2nd peek, not replaced by `lab.peekFootnoteArmitage`.

**Script used to pick the step values** (saved at
`/tmp/claude-1000/.../scratchpad/dial_steps.mjs` during the session; not
committed — scratch only):

```js
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function mixSrgb(hexA, hexB, t) {
  const a = [1, 3, 5].map((i) => parseInt(hexA.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(hexB.slice(i, i + 2), 16));
  const mixed = a.map((av, i) => Math.round(av + (b[i] - av) * t));
  return '#' + mixed.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}
```

Full scan output (light theme; dark theme's own scan is in-session, same
shape), every 5% step from 5% to 95%, all `OK` (≥4.5:1):

```
muted contrast on paper: 5.09     green contrast on paper: 5.73
  t=25%  #5E6B5A  contrast=5.313  OK   (picked: --dial-step-1)
  t=50%  #4E6C56  contrast=5.495  OK   (picked: --dial-step-2)
  t=75%  #3E6D52  contrast=5.634  OK   (picked: --dial-step-3)
  (t=5% through t=95%, every 5% step, ranged 5.15-5.70 — all OK)
```

**Verification commands + output (this fix round):**

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/tokens.test.ts
Test Files  1 passed (1)
     Tests  57 passed (57)          # includes 6 new dial-step contrast checks + 1 existence check

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/lab.test.tsx tests/ui/tokens.test.ts tests/ui/router.test.tsx
Test Files  3 passed (3)
     Tests  107 passed (107)
```

### IMPORTANT — SpecControls.tsx over the 150-line cap

`SpecControls.tsx` was 181 lines against the brief's plan-mandated ≤150 cap.
Fixed via the reviewer's own suggestion: extracted the generic radiogroup
mechanics (roving tabindex, arrow-key move+select, the `role="radio"` render
— identical across all six knobs) into a new `src/ui/components/RadioGroup.tsx`
(+`RadioGroup.css` for the `.ph-spec-group`/`.ph-radio` styling it now owns).
`SpecControls.tsx` keeps only the six Spec-axis-to-options mappings.

No behavior change, no rendered-DOM change (same classes, same structure) —
`tests/ui/lab.test.tsx`'s SpecControls suite needed **zero** edits, since it
only ever interacts with `SpecControls`'s public export and the rendered DOM,
never `Group`/`RadioGroup` directly.

```
$ wc -l src/ui/components/SpecControls.tsx src/ui/components/RadioGroup.tsx \
        src/ui/components/PValueDial.tsx src/ui/components/CoefPlot.tsx \
        src/ui/components/ForkTrail.tsx src/ui/screens/Lab.tsx
  121 SpecControls.tsx
   73 RadioGroup.tsx
  119 PValueDial.tsx
   62 CoefPlot.tsx
   52 ForkTrail.tsx
   83 Lab.tsx
```

All six comfortably under the 150-line cap.

### Minors — not touched, per instruction

- ForkTrail re-derives the trail-building loop locally (extraction follow-up
  — left for a future pass, as instructed).
- StrictMode guard test overclaims — left as-is, as instructed.

### Full gate, re-run against the final committed state

```
$ PATH="/usr/bin:$PATH" npx vitest run
Test Files  26 passed (26)
     Tests  607 passed (607)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npx eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npx vite build
✓ built in 123ms
PWA v1.3.0 — precache 9 entries (271.75 KiB)
```

### Files changed in this fix round

- `docs/DESIGN.md` (R1.8 rewritten, R1.5, §0, §7.3, §9, §10)
- `src/ui/theme/tokens.css` (`--dial-step-1/2/3`, both themes)
- `tests/ui/tokens.test.ts` (`TEXT_TOKENS` + existence check)
- `src/ui/components/PValueDial.tsx`, `.css` (stepped bands, no opacity)
- `tests/ui/lab.test.tsx` (band-boundary tests, no-opacity test, footnote co-presence)
- `src/ui/components/RadioGroup.tsx`, `.css` (new — extracted from SpecControls)
- `src/ui/components/SpecControls.tsx`, `.css` (trimmed to the six mappings + outer layout)
