# Task T5 report — App shell, Preprint Gothic theme, shared visual components

Branch/worktree: `worktree-agent-aa8fb42455e6c1a33` (isolated worktree at
`.claude/worktrees/agent-aa8fb42455e6c1a33`), based on `ffc92cb`.
Final commit: `49eb0ac` — `feat: Preprint Gothic app shell, stamp, confetti, email card`.

## 1. Implemented

- **`src/ui/App.tsx`** (real shell, replacing the T1 stub): loading gate,
  running header (wordmark + `briefing.vol` line), `ThemeToggle`, `LocaleToggle`,
  `<main>` slot (accepts optional `children`).
- **`src/ui/components/Stamp.tsx` + `Stamp.css`**: oversized SVG rubber stamp,
  `rotate(-12deg)`, distressed via `feTurbulence`+`feDisplacementMap`, single
  450ms slam+shake timeline (R5.2), verdict rendered as real text.
- **`src/ui/components/ConfettiLayer.tsx` + `ConfettiLayer.css`**: canvas
  confetti, hard-capped at 400 particles, gold/paper only, reduced-motion
  short-circuit, clean RAF teardown.
- **`src/ui/components/EmailCard.tsx` + `EmailCard.css`**: Grantwell's email as
  a hairline-topped block (R4.5), not a box.
- **`src/ui/hooks/useReducedMotion.ts`**: reactive `matchMedia` hook.
- **`src/i18n/LocaleProvider.tsx`**: extended (theme only) with `Theme = 'paper'
  | 'dark'`, persisted in the existing `phackle.settings` blob alongside
  locale, applied as `data-theme` on `<html>` via `useLayoutEffect`.
- **`src/main.tsx`**: vendored font imports (`@fontsource/stix-two-text`,
  `@fontsource/jetbrains-mono`, latin + latin-ext, 400/500 serif + 400 mono
  only); wraps `<App>` in `<LocaleProvider>` (previously absent — needed
  because `App` now calls `useLocale()`); computes the placeholder
  `puzzleNumber(localIsoDate())` and passes it as a prop.
- **`src/content/en/copy.ts`**: 4 new copy keys (below).
- **`package.json`/`package-lock.json`**: added `@fontsource/stix-two-text`,
  `@fontsource/jetbrains-mono` only.
- **`tests/ui/shell.test.tsx`**: 19 tests (new file).

`src/ui/theme/tokens.css` was **not** touched — it already carried every
token DESIGN.md §9 lists; no gap to extend.

## 2. Tested + results (TDD RED → GREEN)

RED was produced for real, not just asserted: after writing the full test
file and implementation, I used `git stash push -u` to put the original T1/T4
stub files back (App.tsx stub, no components, no hook) while leaving the new
test file in place, ran the suite, then popped the stash to restore my work.

**RED** (`tests/ui/shell.test.tsx` against the pre-T5 stub App.tsx and no
components/hook at all):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/shell.test.tsx
 FAIL  tests/ui/shell.test.tsx [ tests/ui/shell.test.tsx ]
Error: Failed to resolve import "../../src/ui/components/Stamp" from "tests/ui/shell.test.tsx". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** (implementation restored):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/shell.test.tsx
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

**Full suite** (all 10 test files, including the pre-existing T1–T4/T28 suites
and `tests/ui/tokens.test.ts`'s 50 DESIGN.md mechanical assertions):

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  10 passed (10)
      Tests  207 passed (207)
```

One real failure surfaced and was fixed along the way: my first
`ConfettiLayer.tsx` draft used local variables/a particle field literally
named `gold`, which the R1.7 mechanical scanner flags as a bare CSS
named-colour word regardless of it being a JS identifier
(`tests/ui/tokens.test.ts`'s "finds no CSS named colour..." case, 4 hits).
Fixed by renaming to `fleckColor`/`isGoldFleck` — never fix the test, per the
brief; the markup (here, an identifier) was wrong.

**Full gate:**

```
$ PATH="/usr/bin:$PATH" npx vitest run          # 207/207 passed
$ PATH="/usr/bin:$PATH" npx tsc --noEmit        # clean, no output
$ PATH="/usr/bin:$PATH" npx eslint .            # clean, no output
$ PATH="/usr/bin:$PATH" npx vite build          # succeeds; fonts bundled as
                                                 # local dist/assets/*.woff2,
                                                 # confirmed no external URL
                                                 # in dist/assets/index-*.css
```

(eslint did catch one real issue mid-development: `react-hooks/refs` flagged
`onDoneRef.current = onDone` being written during render in `ConfettiLayer`;
moved to its own deps-less `useEffect`, and the now-unneeded
`exhaustive-deps` disable-comment on the main effect was removed as an
"unused eslint-disable directive" warning.)

### Test inventory (`tests/ui/shell.test.tsx`, 19 tests)

- App loading gate: placeholder-only pre-load, header+children mount after
  (RED/GREEN gate behaviour explicitly asserted, not just implied).
- Running header: `t('briefing.vol', {volume:1, issue:12})` → "Vol. 1, No. 12".
- Theme toggle: default light + explicit switch persists to
  `phackle.settings`; reads a stored theme on mount ahead of content load;
  falls back to system dark preference when nothing is stored.
- Locale toggle: hidden at the real `AVAILABLE_LOCALES` (length 1); a
  fabricated 3-locale array (passed as a prop to the exported `LocaleToggle`,
  not via module mocking) renders one button per locale and calls `setLocale`.
- `ThemeToggle` unit test.
- Stamp: label (and optional subline) as real accessible text; animates
  under `animate=true` + full motion; skips the animate class under
  `animate=true` + reduced motion; never animates at `animate=false`.
- ConfettiLayer: renders nothing + calls `onDone` immediately under reduced
  motion; caps at 400 given `particles=4000`; draws exactly 30 when
  requesting 30 (under-cap pass-through); cancels its rAF on unmount (mocked
  rAF/cancelAnimationFrame, asserted by id).
- EmailCard: from/subject/body with labelled header lines.
- `useReducedMotion`: reflects initial `matchMedia` state and reacts to a
  fired `change` event.

Note on test style: this project has no `@testing-library/jest-dom` in
`package.json` (confirmed by reading `tests/i18n/LocaleProvider.test.tsx`'s
existing convention first) — all assertions use plain DOM properties
(`.textContent`, `.getAttribute`, `.className`) rather than jest-dom matchers
like `toBeInTheDocument`/`toHaveClass`.

## 3. DESIGN.md self-audit

**Tier A (mechanical, `tests/ui/tokens.test.ts`)**: all 50 assertions pass,
including R1.7 (no colour literal outside tokens.css — after the
`gold`-identifier fix), R4.2/R4.3 (no shadow, ≤2px radius), R5.6 (CSS
durations collapse under reduced motion), R6.1 (no focus suppression), R7.3
(contrast).

**Tier C (grep), re-run by hand after every edit, final state:**

```
grep -rnE 'border:\s' src/ui                             → (none)
grep -rnE '\bz-index:\s*[0-9]' src/ui                     → (none)
grep -rn '<select' src/ui                                 → (none)
grep -rnE '@media \(min-width:' src/ui | grep -v '768px'   → (none)
grep -rn 'transition: all' src/ui                          → (none)

grep -rnE '\b(transition|animation):' src/ui
  → Stamp.css: animation: ph-stamp-shake ...   \ both map to R5.2's single
  → Stamp.css: animation: ph-stamp-slam  ...   / "stamp slam" budget item
    (shake is the §7.1 paper-shake folded into the same 450ms timeline, not
    a 5th animation — DESIGN.md §0's own reconciliation note)

grep -rn 'var(--sig-red)' src/ui
  → Stamp.css ×2 (stroke/fill, only under `.ph-stamp__mark--red`, i.e. only
    the RETRACTED kind) = "the RETRACTED stamp", one of R1.3's four places
  → tokens.css ×1 = the pre-existing --sig-band derivation (R1.3a), not mine

grep -rnE ':\s*[0-9]+px' src/ui --exclude=tokens.css
  → App.css ×2, both `border-block-end: 2px solid ...` = R4.6's sanctioned
    2px selection-underline value (idle/transparent and selected/--ink)
```

Also spot-checked by hand: no `var(--rule)` outside tokens.css (only used via
the `--hairline` token); no `var(--assist-green)` in actual code anywhere
(only in a comment, which the R1.7 scanner already strips before scanning);
`text-transform: uppercase` appears exactly once and is paired with
`letter-spacing: var(--tracking-label)` (R2.7); every `background` in my
files is `var(--paper)` or `none` (R1.1/R4.1); `--space-64` isn't used
anywhere in my files (correctly reserved, per R3.3, for page margins/act
transitions I'm not building).

**R6.4 (≥44×44 tap targets)**: initially used `--text-13` + `padding:
var(--space-12) var(--space-16)`, which only reaches ~42px tall
(13×1.4 leading + 24 padding). DESIGN.md's own R6.4 example uses this exact
padding pair, so I matched its implied font size instead — switched the
toggle buttons to `--text-15` (15×1.4 + 24 ≈ 45px), which also now matches
the header masthead's own size.

**R7.1 (`<html data-theme="light|dark">`) vs. master spec §5.6 (`theme?:
'paper'|'dark'`)**: these are two different vocabularies for two different
layers, not a conflict — see Concerns §1 below for the reasoning; flagging
explicitly since the brief didn't spell out this exact translation.

## 4. Copy keys added (for T19/T20 to translate)

Extended the `CopyKey` union and the `en` catalog together:

- `nav.themePaper`: `'Paper'`
- `nav.themeDark`: `'Dark'`
- `email.from`: `'From:'`
- `email.subject`: `'Subject:'`

No key was needed for the header's "·" separator (rendered as CSS
`::before { content: '·' }` on `.ph-header__vol`, not JSX text — kept out of
the DOM entirely rather than adding a decorative-only copy key).

## 5. Concerns (please review)

1. **Settings-schema name vs. DOM attribute value for theme** — master spec
   §5.6 fixes the persisted field as `theme?: 'paper'|'dark'`; DESIGN.md R7.1
   fixes the DOM contract as `<html data-theme="light|dark">`. I read these as
   two different vocabularies at two different layers (not a conflict to
   escalate) and added one explicit mapping function, `domTheme()` in
   `LocaleProvider.tsx`: settings `'paper'` → attribute `"light"`, settings
   `'dark'` → attribute `"dark"`. Mechanically this is low-risk either way —
   `tokens.css` only special-cases `[data-theme='dark']`, so anything else
   already renders as the light palette — but R7.1 is Tier D ("read the
   diff"), so I wanted this translation named and visible rather than
   implicit. Flagging in case a different mapping (or literally reusing
   `'paper'`/`'dark'` as the attribute strings) was actually intended.

2. **Stamp's REPLICATED colour — deviated from the brief's literal contract.**
   The brief/controller-restated contract says "`--sig-red` (`--assist-green`
   for REPLICATED)". DESIGN.md R1.5 confines `--assist-green` to "inline at
   text scale (≤1em)" with a worked example (`<em>` at `--text-15`) and an
   explicit "green is never a fill" Don't; R1.3 separately reserves
   `--sig-red` for exactly four named places, none of which is
   REPLICATED/NULL_REPORTED; and R8.2 warns that reusing "the stamp texture"
   elsewhere turns a signature into a pattern. An oversized SVG stamp mark in
   `--assist-green` reads to me as exactly what R1.5's Don't clause rules
   out. Since this is a genuine brief-vs-DESIGN.md tension and I'm not
   authorized to edit DESIGN.md, I implemented the DESIGN.md-compliant
   version (both REPLICATED and NULL_REPORTED render in `--ink`, never
   `--sig-red`/`--assist-green`) rather than guess at a fix to the rule
   itself. This is a real, deliberate deviation from the literal brief text —
   documented in a code comment in `Stamp.tsx` and here. If a green stamp
   variant was actually wanted, R1.5 needs an explicit carve-out added to
   DESIGN.md §0/§1 first (my file-ownership doesn't include DESIGN.md).

3. **Pre-hydration theme-flash is not fully closed.** R7.1 says the theme
   attribute is "written at boot" — I apply it via `useLayoutEffect` (commits
   before paint, the best a pure-CSR React tree can do), and the initial
   value is computed synchronously (stored setting, else `matchMedia`) in
   the same pattern as the existing locale detection. But `index.html` isn't
   in my file ownership and has no inline boot script, so a user with an
   explicit dark preference could see one blank/light frame before React's
   first commit in a real browser (not observable in the jsdom test
   environment, where `render()` flushes layout effects synchronously). If
   this matters, an inline `<script>` in `index.html`'s `<head>` reading the
   same `phackle.settings` key would close it — that's outside my owned
   files.

4. **Loading-gate accessibility.** The gate's placeholder
   (`<div className="ph-app" aria-busy="true" data-testid="app-loading" />`)
   deliberately renders no text at all, because `t()` falls back to raw copy
   *keys* before content loads and any accessible label sourced from `t()`
   would have the same flash problem the gate exists to prevent. It's
   `aria-busy` only, no `aria-label`/live region. Given `getContent()`
   resolves in one microtask for the already-bundled `en` locale, I judged
   this an acceptable, deliberately silent transient state rather than
   reaching for a non-translated hard-coded label (which the copy-keys-only
   constraint would otherwise forbid).

5. **`App`'s `children` prop** isn't in the brief's interface comment
   (`<main>` slot is described but not typed) — I added an optional
   `children?: ReactNode` rendered inside `<main>` because the controller's
   own gate-test instruction ("assert children don't mount pre-load, mount
   after") only makes sense if something is renderable there. Later
   screen-routing tasks may still choose to restructure `App.tsx` themselves
   (no router is installed in this repo; `puzzleNumber` explicitly arrives as
   a placeholder prop pending T12's store).

6. **`briefing.vol`'s whole interpolated string is rendered in
   `--font-mono`**, not just the digits. R2.4 lists "puzzle numbers"
   explicitly as numerals needing mono+tabular treatment, but the copy
   template mixes words ("Vol.", "No.") with the two numbers in one string;
   splitting a single translated template into mixed-font spans felt like
   more fragility than the header line warrants. R2.4 is Tier D only (no
   mechanical check), so flagging the trade-off rather than treating it as
   settled.

7. **Confetti particle randomness** uses `src/engine/prng.ts`'s
   `mulberry32`, seeded from `Date.now()`, instead of `Math.random()` —
   `Math.random` is banned repo-wide by `eslint.config.js` (not just in
   `src/engine/**`), with the codebase's only sanctioned exception already
   used up by `src/game/daily.ts`'s practice-mode entropy. This keeps
   confetti cosmetic-only randomness off `Math.random` entirely rather than
   adding a second inline-disabled exception.

## 6. Files changed

- `package.json`, `package-lock.json` — `@fontsource/stix-two-text`,
  `@fontsource/jetbrains-mono` only.
- `src/content/en/copy.ts` — 4 new copy keys (§4 above).
- `src/i18n/LocaleProvider.tsx` — theme extension only (`Theme` type,
  `readStoredTheme`/`writeStoredTheme`/`systemTheme`/`domTheme`, `theme`/
  `setTheme` on the context value, one `useLayoutEffect`).
- `src/main.tsx` — font imports, `LocaleProvider` wrapper (previously
  missing — required once `App` calls `useLocale()`), placeholder
  `puzzleNumber` wiring.
- `src/ui/App.tsx`, `src/ui/App.css` — real shell.
- `src/ui/components/Stamp.tsx`, `Stamp.css`.
- `src/ui/components/ConfettiLayer.tsx`, `ConfettiLayer.css`.
- `src/ui/components/EmailCard.tsx`, `EmailCard.css`.
- `src/ui/hooks/useReducedMotion.ts`.
- `tests/ui/shell.test.tsx` — new, 19 tests.

`src/ui/theme/tokens.css` unchanged (already complete against DESIGN.md §9).

Commit: `49eb0ac` — `feat: Preprint Gothic app shell, stamp, confetti, email card`.

---

## 7. Fix report — controller ruling on the REPLICATED-colour conflict (Concern #2)

**Ruling received:** master spec §7.2 governs — REPLICATED is a sanctioned
`--assist-green` place, the exact parallel of R1.3's red-stamp entry;
direction A's single-loud-colour discipline governs ambient chrome, not the
verdict moment. Authorized to edit `docs/DESIGN.md` for this carve-out. This
reverses my prior default (both non-RETRACTED kinds in `--ink`), which my
original report flagged as Concern #2 rather than silently deviating.

### (a) `src/ui/components/Stamp.tsx` / `Stamp.css`

`MARK_CLASS` now maps `REPLICATED` to a new `ph-stamp__mark--green` class
(was `ph-stamp__mark--ink`); `RETRACTED` (`--red`) and `NULL_REPORTED`
(`--ink`) are unchanged. `Stamp.css` gained the parallel colour block:

```css
.ph-stamp__mark--green .ph-stamp__border,
.ph-stamp__mark--green .ph-stamp__label,
.ph-stamp__mark--green .ph-stamp__subline {
  stroke: var(--assist-green);
  fill: var(--assist-green);
}

.ph-stamp__mark--green .ph-stamp__border {
  fill: none;
}
```

The stale reasoning comment above `MARK_CLASS` (which argued for `--ink` on
both non-RETRACTED kinds) is replaced with one recording the ratified
exception and why `NULL_REPORTED` still has none.

**Test added** (`tests/ui/shell.test.tsx`, Stamp describe block): asserts the
kind→class mapping for all three kinds in one pass. This required fixing
`hasClass()`, which previously read `el.className` — on an `<svg>` element
(the thing being asserted on here) `.className` is an `SVGAnimatedString`
with no `.split`, not a plain string as it is on the wrapper `<div>` the
existing animate-class tests check; switched to `el.getAttribute('class')`,
which returns the same string for both HTML and SVG elements (verified this
doesn't change behaviour for the pre-existing animate-class assertions,
which still pass).

```tsx
it('maps each kind to its sanctioned colour class', () => {
  const cases: Array<[StampProps['kind'], string]> = [
    ['RETRACTED', 'ph-stamp__mark--red'],
    ['REPLICATED', 'ph-stamp__mark--green'],
    ['NULL_REPORTED', 'ph-stamp__mark--ink'],
  ];
  for (const [kind, expectedClass] of cases) {
    const { container, unmount } = render(<Stamp kind={kind} label={kind} animate={false} />);
    const mark = container.querySelector('.ph-stamp__mark');
    expect(hasClass(mark, expectedClass)).toBe(true);
    unmount();
  }
});
```

### (b) `docs/DESIGN.md`

R1.5 gained the exact sentence specified, inserted after the rule's opening
statement and before its Do/Don't examples:

> Exception (registered in §0): the REPLICATED verdict stamp renders in
> `--assist-green` — the one sanctioned display-scale green, exactly
> parallel to R1.3's stamp entry for `--sig-red`.

§0's registry table gained one row, and the intro count went from "six" to
"seven":

| Master spec says | This document says | Why |
|---|---|---|
| §7.2 lists `--assist-green` for "REPLICATED" among its uses, without restricting it to inline text | R1.5's inline-only (≤1em) rule gets one named exception: the REPLICATED verdict stamp renders in `--assist-green` at display scale, exactly parallel to R1.3's RETRACTED-stamp entry for `--sig-red` | A verdict stamp is a signature moment (R8.2), not the ambient chrome R1.5's "never a fill" discipline targets; direction A's single-loud-colour discipline governs chrome, not the verdict itself |

Placed as the second-to-last row, immediately *before* the existing "§7.2
fixes seven colours…" row rather than appended after it — that row is the one
the intro text points to by name ("The last row is also the registry of
derived colours…"), and this carve-out isn't a derived-colour registration
(`--assist-green` is one of the seven master-spec-fixed colours, not
something `color-mix()`-derived), so appending after it would have silently
made that sentence point at the wrong row.

### (c) `tests/ui/tokens.test.ts`

Nothing tripped — ran it both before and after the DESIGN.md edit to check:

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/tokens.test.ts
 Test Files  1 passed (1)
      Tests  50 passed (50)
```

Reason nothing could trip: `tests/ui/tokens.test.ts` has no assertion over
`--assist-green` usage sites at all (unlike `--sig-red`, which
`docs/DESIGN.md` §10 lists under Tier C with a manual
`grep -rn 'var(--sig-red)' src/ui` — not a vitest test). R1.5 is filed under
Tier D ("read the diff") in §10's table, with no mechanical check of any
kind, before or after this change. The R1.7 no-raw-colour scan doesn't apply
either, since `var(--assist-green)` is a token reference, not a literal. So
per part (c)'s instruction, this section **is** the explicit statement that
nothing needed updating, with the command output above.

### Full gate, re-run after all three parts

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/shell.test.tsx
 Test Files  1 passed (1)
      Tests  20 passed (20)          # 19 + the new kind->colour-class test

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/tokens.test.ts
 Test Files  1 passed (1)
      Tests  50 passed (50)

$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  10 passed (10)
      Tests  208 passed (208)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit         # clean, no output
$ PATH="/usr/bin:$PATH" npx eslint .             # clean, no output
$ PATH="/usr/bin:$PATH" npx vite build           # succeeds
```

Tier-C greps re-run by hand once more (all five zero-hit checks print
nothing; both enumerate checks still map every hit to a sanctioned place —
`var(--sig-red)` unchanged at 2 uses (RETRACTED only) + the pre-existing
`--sig-band` derivation; `var(--assist-green)` now has exactly 2 uses, both
inside the new `.ph-stamp__mark--green` block and nowhere else).

**Concern #2 from §5 above is now resolved** — no longer an open question,
since DESIGN.md itself now carries the exception. Concerns #1, #3–7 stand as
originally reported (not in scope for this ruling).

Commit: `c132f9a` — `fix: REPLICATED stamp renders in --assist-green (DESIGN.md R1.5 carve-out)`.
