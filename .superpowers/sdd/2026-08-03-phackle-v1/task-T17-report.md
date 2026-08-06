# Task T17 report — Summary invoice, Stats & achievement wall, Legend, About; copy catalog frozen

**Branch:** `worktree-agent-a8719b57a34c37e3f` · **Final SHA:** `25f943e`
**Base:** `8035462` (Merge T11: worker RPC — ENGINE COMPLETE)

## STEP 0

- `git reset --hard 8035462` done; verified `src/game/scoring.ts` and
  `src/game/share.ts` existed (T13, merged — confirmed via `git log --oneline`
  showing `c6b5a9c Merge T13`).
- `pwd` confirmed as the worktree (`.../.claude/worktrees/agent-a8719b57a34c37e3f`)
  before any file write.
- `npm ci` run; default `node` resolves to v25.4.0 (linuxbrew), confirmed the
  trap directly (`which node` → linuxbrew path; `PATH="/usr/bin:$PATH" node
  --version` → v22.22.1). Every npm/npx/vitest/tsc/eslint/vite invocation in
  this task was PATH-prefixed.

## What was built

### `src/ui/screens/Summary.tsx` (+`.css`)

- **`Summary`** (named export): pure, prop-driven, presentational. Renders
  the score breakdown as a `<table>` styled like a fee invoice (hairline
  under each row via `border-block-end`, never a 4-side border), a total
  line via the existing `summary.score` key, the streak strip
  (`summary.streak`), the countdown (`summary.nextIn`, from
  `msToNextLocalMidnight`), the share button (→ `shareViaNavigator` →
  `summary.copied` toast, shown ONLY on the clipboard-fallback path — the
  native share sheet is its own confirmation), and the prereg upsell
  (rendered only when `preregUnlocked`, with a `disabled` "Try Prereg Mode"
  button per the brief's "disabled-for-now affordance" instruction).
- **`persistAndComputeSummary`** (named export): the store-reading wrapper's
  pure-ish core. Computes `scoreDay`'s input from the finished day's fields,
  computes the resulting streak (INCLUDING today) by mirroring
  `storage.ts`'s own history-merge and calling the already-exported
  `streakAfter`, builds the share string via `shareString`, persists via
  `saveDay` (skipped in practice mode), and reads whether
  `achievements.first_retraction` is already set. Directly unit-tested
  against real `localStorage` (jsdom pragma) with no store/React involved.
- **`SummaryScreen`** (default export): the actual "standalone store-reading
  screen" — reads `useGameStore` + `useLocale()`, calls
  `persistAndComputeSummary` exactly once per mount (ref-guarded), and
  renders `Summary`.

### `src/ui/screens/Stats.tsx` (+`.css`)

- Call accuracy: all-time (`stats.callAccuracy`, from `PersistedStats`
  directly) + rolling-20 (`stats.callAccuracyLast20`, from the new
  `rollingCallAccuracy` in `statsAgg.ts`).
- Prereg-vs-hacking success rate: **always both panels**
  (`data-testid="success-panel-hack"` / `"success-panel-prereg"`), each
  showing `modeSuccessRate(recordsForMode(history, mode))` or the em-dash
  (`stats.noData`) when that mode has zero days — never a hidden panel.
- Fork histogram: CSS-only bars — a `<span>` with `border-block-end: 2px
  solid var(--ink)` and an inline `width: N%` (relative to a CSS Grid `1fr`
  track), never a `background` (DESIGN.md R4.1: the SpecCurve significance
  band remains the product's one filled area). Empty state (`stats.noData`)
  when nothing has been played.
- Achievement wall: unlocked = name (gold-ink, `--hack-gold-ink` per R1.6)
  + citation; locked = a decorative `aria-hidden` glyph plus
  `aria-label={t('stats.locked')}` on the row — the locked id's `name`/
  `citation` are never read at all in that branch (verified by a test that
  greps the WHOLE rendered container's `textContent` for the locked
  achievement's real name/citation and asserts they're absent).

### `src/ui/screens/Legend.tsx` (+`.css`)

- `LEGEND_ENTRIES` built directly from `share.ts`'s `FORK_EMOJI` map (now
  exported) plus the 5 terminal/prefix/call glyphs (`PREREG_PREFIX`,
  `SUBMIT_EMOJI`, `ABANDON_EMOJI`, `CALL_CORRECT`, `CALL_INCORRECT`, all now
  exported) — never a hand-retyped glyph list.
- **Never reproduces the master spec's own "7 forks" sample caption**,
  which is internally inconsistent with its 6-glyph illustration (T13 review
  ruling, reconfirmed by `tests/game/share.test.ts`'s own reproduction of
  that exact sample, which asserts 6). Guarded by an explicit regression
  test (`container.textContent` must not contain `'7 forks'` or
  `'streak 12'`).

### `src/ui/screens/About.tsx` (+`.css`)

- Renders T6's existing `about.*` prose keys verbatim (mechanism, §1.4
  citations ×5, synthetic-data disclaimer, analytics disclosure,
  decimal-point note, frozen-fork note, glossary from `content.glossary`) —
  no new prose needed there, only layout.
- Version string: `import.meta.env.VITE_APP_VERSION ?? 'dev'`, with the
  `?? 'dev'` fallback implemented INSIDE the presentational `About`
  component (so the fallback itself is directly unit-tested by passing
  `version={undefined}`, not by stubbing `import.meta.env`).
- Links to the GitHub repo (`https://github.com/crp94/phackle`, a new
  `REPO_URL` constant — data, not copy, same bucket as `SITE_URL`) and to
  `SITE_URL` (imported from `share.ts`) with its own URL as the visible link
  text.

### Supporting pure logic

- **`src/game/daily.ts`**: `msToNextLocalMidnight(now)` — ms to the next
  local (wall-clock) midnight via the `Date` constructor's local-component
  overload, so a DST transition between `now` and midnight is reflected
  automatically. Tested against the REAL Europe/Madrid 2026 fall-back
  (Oct 25→26, confirmed via a direct Node probe: offset -120→-60, a 24.5h
  real span from 00:30) and spring-forward (Mar 29→30, 22.5h) transitions,
  plus a cross-check in America/New_York's own 2026 fall-back date, an
  ordinary evening, 1ms-before-midnight, and a year-boundary rollover.
- **`src/game/share.ts`**: `shareViaNavigator(text)` — `navigator.share` →
  (on absence OR any rejection, e.g. the user cancelling the OS share sheet)
  `navigator.clipboard.writeText` → `'shared' | 'copied'`; throws a clear
  error if neither API exists or the clipboard write itself fails. Also
  exports `FORK_EMOJI`, `PREREG_PREFIX`, `SUBMIT_EMOJI`, `ABANDON_EMOJI`,
  `CALL_CORRECT`, `CALL_INCORRECT` (previously module-private) for Legend.
- **`src/game/statsAgg.ts`** (new module — deliberately NOT named `stats.ts`,
  to never collide with `src/engine/stats.ts`'s unrelated OLS/t-distribution
  "stats"): `rollingCallAccuracy(history, window=20)`, `recordsForMode(history,
  mode)`, `modeSuccessRate(records)` — all pure functions over
  `storage.ts`'s history shape (a locally-redeclared, structurally-identical
  `ModeHistory`, matching the existing `achievements.ts`/`storage.ts`
  no-cross-import precedent).

### `src/ui/App.tsx` nav wiring

Added a local `NavPage` page-state (`'game' | 'stats' | 'legend' | 'about'`),
three new header buttons (`nav.stats`/`nav.legend`/`nav.about`, reusing the
existing `.ph-seg` button styling — no new CSS pattern), and conditional
`<main>` rendering: `'game'` shows `children` unchanged; the other three
mount `StatsScreen`/`LegendScreen`/`AboutScreen` with an `onClose` that
returns to `'game'`. **`tests/ui/shell.test.tsx` (T5's file) was left
completely untouched** and re-verified green (all 20 tests) after this
change; new nav-specific coverage lives in `tests/ui/appNav.test.tsx`
instead. Full diff + registry integration notes (including reconciliation
guidance now that T14's own report is readable — see Concerns below) are in
`src/ui/screens/registry.t17.patch.md`.

## TDD — RED / GREEN evidence

Every piece below was written test-first; RED was verified (module/function
not found, or assertion failure against the not-yet-built behavior) before
each GREEN implementation:

| Area | RED symptom | GREEN result |
|---|---|---|
| `msToNextLocalMidnight` | `TypeError: msToNextLocalMidnight is not a function` (6 tests) | `tests/game/daily.test.ts`: 18/18 |
| `shareViaNavigator` | `TypeError: shareViaNavigator is not a function` (5 tests) | `tests/game/shareViaNavigator.test.ts`: 5/5 |
| `statsAgg.ts` | `Cannot find module '../../src/game/statsAgg'` | `tests/game/statsAgg.test.ts`: 12/12 |
| `Legend` | `Failed to resolve import ".../screens/Legend"` | `tests/ui/legend.test.tsx`: 6/6 |
| `About` | `Failed to resolve import ".../screens/About"` | `tests/ui/about.test.tsx`: 9/9 |
| `Stats` | `Failed to resolve import ".../screens/Stats"` | `tests/ui/stats.test.tsx`: 15/15 |
| `Summary` | `Failed to resolve import ".../screens/Summary"` | `tests/ui/summary.test.tsx`: 18/18 |
| App nav wiring | (additive to a passing file; new file written directly against the not-yet-wired nav) | `tests/ui/appNav.test.tsx`: 8/8; `tests/ui/shell.test.tsx` re-run green, unmodified: 20/20 |
| Copy freeze | (written against the already-frozen catalog as a forward guard; its own two self-tests prove it catches an introduced violation) | `tests/content/copyFreeze.test.ts`: 33/33 |

**Full suite, before vs. after this task:**

```
Before (T6+T13 baseline, confirmed by reverting to the pre-T17 file set):
  24 test files, 550 tests passing

After (this branch, HEAD 25f943e):
  32 test files, 662 tests passing   (+8 files, +112 tests)
```

**Full gate, run immediately before commit (all PATH-prefixed):**

```
$ PATH="/usr/bin:$PATH" npx vitest run        →  32 passed (32) / 662 passed (662)
$ PATH="/usr/bin:$PATH" npx tsc --noEmit      →  clean, no output
$ PATH="/usr/bin:$PATH" npx eslint .          →  clean, no output
$ PATH="/usr/bin:$PATH" npx vite build        →  built in ~110ms, no errors
```

Also manually re-ran DESIGN.md §10's Tier-C grep commands against `src/ui`
(the ones stated as reviewer-run, beyond what `tests/ui/tokens.test.ts`
automates): `border:\s` (R4.5), raw `z-index:` (R4.7), `<select` (R6.5),
non-768px `@media (min-width:` (R3.4), and `transition: all` (R5.5) all
print nothing; the two enumerate greps (`(transition|animation):` and
`var(--sig-red)`) show only the pre-existing Stamp.css/tokens.css hits, none
from this task's new files; the raw-px enumerate shows only the pre-existing
2px hairline/underline idiom (R4.6/R6.2) plus the reused 768px breakpoint
value.

## Design decisions requiring judgment (flagged for review)

1. **Fork histogram bars are a `border-block-end: 2px solid var(--ink)`
   stroke on a CSS Grid `1fr` track, sized via an inline `width: N%`** — not
   a filled rectangle. DESIGN.md R4.1 pins the SpecCurve significance band as
   the product's ONE filled area; a "CSS bar" therefore can't be a
   `background` fill without becoming a second one. The 2px stroke weight
   reuses R4.6's already-sanctioned "2px `--ink`" selection-underline value
   rather than inventing a new raw px value. A zero-count bucket legitimately
   renders a zero-width (invisible) bar; the adjacent count number already
   says "0" in text, so no `min-width` floor was added to fake a visible
   sliver (that would have been an unenumerated 5th raw-px usage).
2. **Achievement wall gold accents.** R1.6 names "the achievement-wall glyph
   strokes" as a sanctioned `--hack-gold` (mark, non-text) use case and
   requires `--hack-gold-ink` for any gold text — I added a small `★`
   aria-hidden mark (gold) before each unlocked name, and the name text
   itself uses `--hack-gold-ink`. This wasn't explicitly demanded by the T17
   brief text, but DESIGN.md itself anticipates it by name, so I took it as
   intentional forward-compatibility rather than optional decoration.
3. **Share button has no `aria-label`.** I initially wired `a11y.shareButton`
   ("Copy share result to clipboard") onto the button, then removed it after
   my own test caught the bug it causes: an `aria-label` overrides visible
   text as the accessible name entirely (WCAG 2.5.3 "Label in Name"), and
   that text specifically names the CLIPBOARD path — misleading on the
   (preferred) `navigator.share` path. The visible "Share" text
   (`summary.share`) is now the sole accessible name; `a11y.shareButton`
   is left unused (pre-existing T6 key, not required to be consumed by the
   freeze check, which only checks the reverse direction).
4. **Prereg-mode scoring is a documented approximation, and is effectively
   dead code today.** `scoreDay`'s prereg branch needs `preregSig` (was the
   committed analysis significant), but the engine's `verdictStamp` doesn't
   model "committed but non-significant" — it assumes Hacking Mode's own
   invariant (`published` implies `p < .05`, enforced by `store.submit()`'s
   own guard), which does not hold for Prereg Mode's real flow
   (commit-before-data, no significance gate). `persistAndComputeSummary`
   approximates `preregSig` as `stamp !== 'NULL_REPORTED'` with an explicit
   comment. **This currently affects nothing reachable**: no UI in this tree
   sets `mode: 'prereg'` before T18 lands a chooser (confirmed by reading
   T14/T15's own briefs, which both explicitly defer "prereg mode chooser"
   to T18). Flagged for whoever builds T18's real prereg flow — it will
   likely need `RevealPayload` (or an equivalent) to carry a real
   `preregSig`/non-significant-commit contract that `verdictStamp` doesn't
   have yet.
5. **Achievement UNLOCKING (evaluate + persist) was deliberately NOT
   wired.** T13's own report flags this exact gap as "a natural seam for
   whichever task (likely T17, wiring Reveal → Summary) actually calls
   `evaluateAchievements` and needs to persist its result." I chose NOT to
   build that pipeline: `evaluateAchievements`'s `decisiveTails` input needs
   the LIVE p-value at the moment of each fork, which the current
   `PlayerAction` log doesn't carry (only `SUBMIT` entries record `p`) and
   which the reveal's final-N curve can only approximate for days where N
   never changed mid-session. The brief's own RED list only asks for
   RENDERING behavior (locked/unlocked from whatever's already in storage,
   the prereg upsell's gating condition) — never achievement evaluation
   itself — so `Stats`/`Summary` both purely READ `state.achievements`,
   correctly staying dormant until a future task starts writing to it. This
   is a real, open product gap (no achievement will ever unlock in the
   shipped game until it's addressed) and should be assigned explicitly.
6. **`share.ts` and `storage.ts` were touched even though neither is in
   T17's literal file-ownership list.** `share.ts`: exported 6
   previously-private emoji constants (additive, zero behavior change,
   `shareString`'s own tests still pass unmodified) so Legend could import
   the single source of truth per the brief's own instruction ("import
   it"). `storage.ts`: NOT modified at all in the end — `persistAndComputeSummary`
   only calls its already-exported `loadState`/`saveDay`/`streakAfter`.
7. **Copy-freeze scan scope, stated precisely.** The CopyKey audit
   (`tests/content/copyFreeze.test.ts`) scans `t('key', ...)` call sites and
   `copy['key']` bracket-access sites specifically — NOT every same-shaped
   string literal anywhere, because `storage.ts`'s own `'phackle.v1'` /
   `'phackle.settings'` localStorage keys match a CopyKey's `word.word`
   shape exactly and would be false positives under a blanket scan (verified
   directly: a blanket scan attempt found exactly these two false
   positives before I narrowed it). A bare `CopyKey`-typed literal with no
   lookup call at all (e.g. `scoring.ts`'s `breakdown.push(['summary.breakdownCallCorrect',
   ...])`) is deliberately NOT scanned here — it's already exhaustively
   checked by `tsc` against `[CopyKey, number][]`, so this suite is
   complementary to (not a replacement for) the typecheck step of the gate.

## Registry / App.tsx integration (T14 not in this tree)

`src/ui/screens/registry.t17.patch.md` documents (1) the exact one-line
registry replacement (`summary: SummaryStub` → `summary: SummaryScreen`)
against T14's actual `SCREENS: Record<Screen, ComponentType>` shape — quoted
directly from T14's own now-readable report — and (2) the full App.tsx diff
this branch applied, plus reconciliation guidance now that T14's report
confirms they ALSO modified `App.tsx` independently (a boot `useEffect` +
switching the header's `puzzleNumber` source) from the same base commit.
The two diffs touch different regions of the same function (T14: hooks/effects;
T17: the JSX return) and should merge by hand without real conflict, but this
was written by inference from T14's report text, not by reading their actual
source, so it is flagged rather than assumed correct.

## Concerns for the controller

- **Prereg scoring/achievement-unlocking gaps** (items 4–5 above) are real,
  open seams — not fully resolved by this task, by design, given the brief's
  own RED list scope and the upstream data genuinely not existing yet.
- **App.tsx collision with T14**, already flagged above and in the patch
  file — needs a real (small) manual merge at integration time, not a
  stacked patch apply.
- **T15's report does not exist yet** at the time of writing (checked
  `.superpowers/sdd/2026-08-03-phackle-v1/task-T15-report.md` — absent). Per
  the brief's own instruction, this is stated rather than guessed at; the
  frozen-catalog roster below has no T15 row. The controller will need to
  add it once available.
- **`stats.avgScore`** (a pre-existing T6 key) is still unused — no
  `PersistedStats` field tracks a running score sum, only `careerPoints`
  (a distinct, cosmetic counter per §2.8). Left as-is rather than inventing
  either a new stats field or a misleading reuse.

---

## Frozen catalog delta — every `CopyKey` added since T6, by task

Assembled from: `git log -p -- src/content/en/copy.ts` in this worktree
(covers T6's baseline + T13, both already merged into the base commit) for
rows 1–2; T14's and T16's own task reports' "copy keys added"/"Copy keys —
every addition and change" sections for rows 3–4 (both reports now exist,
read ONLY those sections, per the brief's instruction); this task's own
`git diff` for row 5. **T15's report does not exist yet — no row for it; the
controller completes the roster at merge.**

### T6 (baseline, for reference — not a delta)

93 keys across `nav.*`, `briefing.*`, `email.*`, `lab.*` (core set),
`published.*`, `call.*`, `reveal.*` (core set), `share.*`, `summary.*` (core
set, pre-breakdown), `prereg.*`, `stats.*`, `about.*`, `legend.*` (chart
legend set), `errors.*`, `a11y.*`. (Full text: `src/content/en/copy.ts` as
of commit `f9f6aa3`.)

### T13 — 9 keys added (`ed3628a`)

```
summary.breakdownCallCorrect, summary.breakdownCallIncorrect,
summary.breakdownParsimony, summary.breakdownIntegrity,
summary.breakdownMissedDiscovery, summary.breakdownTrueDiscovery,
summary.breakdownConfirmedNull, summary.breakdownUnderpoweredLuck,
summary.breakdownFalsePositive
```

### T14 — 22 keys added (per T14's report, "Copy keys added (22)")

```
lab.subgroupAll, lab.subgroupAgeLt40, lab.subgroupAgeGe40, lab.subgroupExpHigh,
lab.subgroupExpLow, lab.subgroupUrban, lab.subgroupRural,
lab.covariatesNone, lab.covariatesBoth,
lab.exclusionNone, lab.exclusionZ3, lab.exclusionZ2_5, lab.exclusionZ2,
lab.transformRaw, lab.transformLog1p,
lab.tailsTwo, lab.tailsOne,
lab.pEquals, lab.pBelow, lab.dfLabel, lab.coefPlotCaption, lab.forkTrailLabel
```

### T15 — report not yet available; state unknown at time of writing

### T16 — 9 keys CHANGED (values) + 26 keys added (per T16's report, "Copy keys — every addition and change")

**Changed values** (key unchanged, English text replaced to match §2.6/§2.7's
pinned copy exactly): `call.real`, `call.noise`, `call.prompt`,
`reveal.truthNull`, `reveal.truthEffect`, `reveal.groupedCaption`,
`reveal.accounting1`, `reveal.accounting2`, `reveal.accounting3`,
`reveal.peekSurcharge` (10 rows in their table because `peekSurcharge`'s
interpolation params changed too, alongside 9 of the 10 rows' param names).

**Added:**

```
call.realSub, call.noiseSub,
reveal.accounting2Abandoned,
reveal.fig1, reveal.fig2, reveal.omittedFootnote,
reveal.pValue, reveal.pValueTiny,
reveal.subgroupAll, reveal.subgroupAgeLt40, reveal.subgroupAgeGe40,
reveal.subgroupExpHigh, reveal.subgroupExpLow, reveal.subgroupUrban, reveal.subgroupRural,
reveal.covNone, reveal.covIncome, reveal.covRisk,
reveal.exclusionNone, reveal.exclusionZ3, reveal.exclusionZ25, reveal.exclusionZ2,
reveal.transformRaw, reveal.transformLog,
reveal.tailsTwo, reveal.tailsOne
```

(T16 reused, did not duplicate: `legend.significant`, `legend.unexplored`,
`legend.explored`, `legend.published`, `briefing.vol`, `a11y.specCurveChart`,
`reveal.retracted`/`replicated`/`nullReported`/`callCorrect`/`callIncorrect`.)

### T17 (this task) — 26 keys added, 0 changed

*(Updated post-review, round 2: `summary.shareFailed` added — see the
appended round-1 and round-2 fix reports below for why. This table is
T19/T20's paper trail, so it is kept accurate here rather than only noted
in an appendix.)*

```
nav.legend
summary.invoiceTitle, summary.preregUpsell, summary.shareFailed
stats.callAccuracyLast20, stats.successRateTitle, stats.hackModeLabel,
  stats.preregModeLabel, stats.noData, stats.forkHistogramTitle,
  stats.forkHistogramBar, stats.achievementsTitle, stats.locked
about.version, about.sourceLink
legend.intro, legend.emojiSpec, legend.emojiSubgroup, legend.emojiExclusion,
  legend.emojiTails, legend.emojiPeek, legend.emojiSubmit, legend.emojiAbandon,
  legend.emojiPrereg, legend.emojiCallCorrect, legend.emojiCallIncorrect
```

Verified zero name collisions between this list and T14's/T16's own added
keys (different prefixes throughout: `nav./summary./stats./about./legend.*`
here vs. `lab.*` for T14 vs. `call./reveal.*` for T16).

### Roster total (known so far)

93 (T6) + 9 (T13) + 22 (T14) + 26 (T16 added, plus 9 changed in place) + 26
(T17) = **176 keys**, plus T15's contribution once its report lands. Every
locale's `copy: Record<CopyKey, string>` (IT/ES, T19/T20) must translate the
full, final union — this report's roster is the paper trail for that count.

---

## APPENDED — fix report (post-review)

**Reviewer verdict:** Needs fixes — 1 Critical, 3 Important, 1 doc-completeness
item; 3 minors ledgered, explicitly not to be touched. Reviewer's own
independent verification is noted here for the record: my DST fixture dates
were re-checked against the real IANA tz database "to the millisecond," and
my self-disclosures (including "`evaluateAchievements` has zero call sites
repo-wide") held up under their check.

**Fix commit:** `7e371d0` (on top of `25f943e`, base `8035462`) — `fix:
durable persistence idempotency across nav remounts; surface share failures;
freeze-harness disclosure`.

### CRITICAL — persistence not idempotent across the header nav's remount

**Root cause, confirmed exactly as the review described it.**
`SummaryScreen`'s only guard against re-running `persistAndComputeSummary`
was a mount-scoped `useRef(false)`. App.tsx's header nav (`page` local state)
unmounts the `page === 'game'` branch — the whole running game machine,
`SummaryScreen` included — when the player opens Stats/Legend/About, and
remounts it (with a BRAND NEW `savedRef`) when they close back to the game.
Since `store.ts`'s singleton is untouched by this (still `screen: 'summary'`,
`reveal` still populated), the remounted `SummaryScreen` saw a "fresh" ref,
called `persistAndComputeSummary` again, and `storage.ts`'s `saveDay` builds
`callsTotal`/`callsCorrect`/`careerPoints`/`hackDays`/`preregDays`/
`forkHistogram` as INCREMENTS — so every such visit silently inflated every
one of those numbers, which is exactly what the Stats page the player had
just been looking at displays.

**Fix (per the reviewer's own prescribed shape):** moved the guard to a
durable source. `persistAndComputeSummary` now computes `const alreadySaved =
state.history[todayIso]?.[mode] !== undefined` from a real `loadState()` call
and gates the `saveDay` call on `!practice && !alreadySaved`. The streak
computation branches on the same flag: if already saved, `streakAfter` reads
`state.history` directly (the record's already there); otherwise it uses the
original placeholder-merge trick. The invoice/streak/share-text still
recompute identically on every call (pure functions of the same store
inputs) — only the actual write is skipped. `SummaryScreen`'s `savedRef` is
kept as a same-mount optimization (StrictMode's dev-only double-effect) but
is no longer the correctness boundary.

**Required test — a real remount cycle, added to `tests/ui/summary.test.tsx`:**
drives the REAL `game/store.ts` singleton (via `useGameStore`, since it is
not itself exported) through `boot -> openData -> submit -> makeCall ->
finishReveal` with a fake `EngineClient` (same shape/sequence as
`tests/game/store.test.ts`), then renders the actual `SummaryScreen` default
export, unmounts it, remounts it, and asserts the PERSISTED NUMBERS
(`stats.hackDays`, `stats.callsTotal`, `stats.careerPoints`,
`stats.forkHistogram[0]`, and the full `history[todayIso].hack` record) are
identical after both mounts — not merely that `saveDay` was called a
particular number of times.

**Self-verification that the test has teeth (commands + real output):**

```
$ sed -i 's/if (!practice \&\& !alreadySaved) {/if (!practice) { \/\/ TEMP-REVERT-FOR-VERIFICATION/' src/ui/screens/Summary.tsx
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/summary.test.tsx -t "unmount/remount"

 FAIL  tests/ui/summary.test.tsx > SummaryScreen — a real unmount/remount cycle does not double-persist (the nav path)
       > does not persist a finished day twice across a real unmount/remount, and the persisted NUMBERS (not just call counts) stay unchanged
AssertionError: expected 2 to be 1 // Object.is equality
- Expected: 1
+ Received: 2
 ❯ tests/ui/summary.test.tsx:617:40
    617|     expect(afterSecond.stats.hackDays).toBe(1);

Test Files  1 failed (1)
     Tests  1 failed | 23 skipped (24)
```

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/summary.test.tsx -t "does not inflate the running stats"

 FAIL  tests/ui/summary.test.tsx > persistAndComputeSummary … > a second call for the SAME (todayIso, mode) does not inflate the running stats
AssertionError: expected 2 to be 1 // Object.is equality
 ❯ tests/ui/summary.test.tsx:454:40
    454|     expect(afterSecond.stats.hackDays).toBe(1);

Test Files  1 failed (1)
     Tests  1 failed | 23 skipped (24)
```

Both fail exactly on `hackDays: 2` (the doubled count the review predicted).
Restored the real fix from a backup (`cp /tmp/Summary.tsx.bak
src/ui/screens/Summary.tsx`), re-ran, both green again (see full-suite output
below). This is real evidence the required test would have caught the
original bug, not merely that it passes now.

### IMPORTANT 1 — silent share failure

`handleShare` had no `catch`, and the button's `onClick={() =>
void handleShare()}` discarded the returned promise — a player with no
`navigator.share` and a failing clipboard write saw nothing at all, despite
`share.ts`'s own doc comment saying a rejection is deliberately "not
swallowed... so the caller can surface an error."

**Fix:** wrapped the body in `try/catch`; on catch, `setShareFailed(true)`
renders a new `role="alert"` line using a new copy key, `summary.shareFailed`
("Couldn't share this result.") — quiet, clinical, no exclamation, matching
Act II's register. A fresh share attempt always clears a stale failure first.
No new color: DESIGN.md R1.3 reserves `--sig-red` for exactly 4 places, so
the failure message reuses the same `--muted` toast styling as the success
case, distinguished only by ARIA role (`alert` vs `status`).

**Tests added:** both-APIs-fail (no `share`, clipboard rejects);
`navigator.share` itself rejects with no clipboard present at all; a retry
that succeeds clears the previous failure message. All three pass; see the
full run below.

### IMPORTANT 2 — freeze-harness honesty (dynamic call sites)

Confirmed exactly as flagged: `T_CALL_RE`/`BRACKET_RE` both require a literal
quote character immediately after `t(`/`copy[`, so `t(entry.labelKey)`
(`Legend.tsx`) and `t(key)` (`Summary.tsx`'s invoice row, `key` destructured
from `breakdown: [CopyKey, number][]`) are invisible to the scan — neither a
hit nor a miss, silently skipped.

**Fix:** added an honest new paragraph to `tests/content/copyFreeze.test.ts`'s
doc comment (distinct from the existing false-positive-under-a-blanket-scan
paragraph) naming this as a SECOND, different blind spot, identifying both
current instances, stating why it's currently safe (each dynamic site's value
is already typed `CopyKey` at its own declaration, so `tsc` — always run as
part of this project's "full gate" — rejects an invalid one there regardless
of what this regex can see), and stating the property any NEW dynamic call
site must preserve (feed it a value some other declaration already types as
`CopyKey`; never a plain `string`, never a value that reached it via an `as
CopyKey` cast). No new test was added for this — it is inherently a
type-level guarantee, and the honest documentation was the requested fix,
not a new runtime assertion.

### IMPORTANT 3 — patch-file completeness

Added a new "2a. The nav-remount interaction (review fix — read this before
merging)" section to `src/ui/screens/registry.t17.patch.md`, between the
existing App.tsx-diff section and the "files added" section. It spells out:
the exact click sequence that exposed the bug (finish a day → Summary
persists → open Stats → close Stats → remount → double-persist), why the
durable guard (not the `savedRef`) is what fixes it, and an explicit
instruction to the merge controller: whatever shape the final reconciled
`App.tsx`/registry takes, if it is even theoretically possible for the same
finished day's `SummaryScreen` to mount more than once, this guard is what
keeps that safe, independent of how the remount is triggered — and points at
the specific new test as the evidence.

### Minors — explicitly NOT touched, per instruction

- Fork-histogram bar `aria-label` on a generic `<span>` (not a `<meter>`/
  `role="progressbar"` or similar) — ledgered, left as-is.
- No test at the EXACT 20-call boundary for `rollingCallAccuracy`'s window
  (existing tests cover <20, >20 via the 25-day fixture, and =20 implicitly
  through the "last 20 of 30" test, but not a dedicated "exactly 20 total"
  case) — ledgered, left as-is.
- `stats.avgScore` (pre-existing T6 key) remains unused — no `PersistedStats`
  field tracks a running score sum. Restating for the record, as instructed:
  this is a dangling key for T19/T20's roster, not a bug to fix here.

### Re-verification — the three required files, then the full gate

```
$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/summary.test.tsx
 Test Files  1 passed (1)
      Tests  24 passed (24)

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/appNav.test.tsx tests/content/copyFreeze.test.ts
 Test Files  2 passed (2)
      Tests  41 passed (41)

$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  32 passed (32)
      Tests  668 passed (668)

$ PATH="/usr/bin:$PATH" npx eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npx vite build
✓ built in 112ms
PWA v1.3.0 — 8 entries precached

# DESIGN.md Tier-C re-check (unchanged from before the fix, re-run because
# JSX/CSS were touched again):
$ grep -rnE 'border:\s' src/ui                 # R4.5 — empty
$ grep -rnE '\bz-index:\s*[0-9]' src/ui        # R4.7 — empty
$ grep -rn 'transition: all' src/ui            # R5.5 — empty
$ grep -rn 'var(--sig-red)' src/ui             # R1.3 — only the pre-existing
                                                #   Stamp.css/tokens.css hits;
                                                #   the new shareFailed line
                                                #   uses --muted, not --sig-red
```

668 tests (662 → 668, +6: 2 pure-function idempotency tests, 1 real
remount integration test, 3 share-failure tests), all green; `tsc`, `eslint`,
and `vite build` all clean.

**Final SHA after fixes: `7e371d0`.**

---

## APPENDED — round-2 fix report (post-re-review)

**Re-review verdict:** all four round-1 findings ADDRESSED on their own
terms — the revert/re-verify evidence was independently confirmed as "real
evidence the test has teeth, not narrative," and the dynamic-call-site
honesty comment was verified accurate by a repo-wide grep. But the
re-review's own day-boundary trace surfaced a NEW Important-severity bug in
the round-1 fix itself — this is fix round 2 for that one finding, plus a
subsumed roster-completeness catch.

**Fix commit:** `c9aa3a1` (on top of `7e371d0` → `25f943e` → `8035462`) —
`fix: anchor persistence idempotency to the puzzle's own day, not the wall
clock`.

### THE GAP — durable guard keyed on the wall clock, not the puzzle's day

**Confirmed exactly as described.** Round 1's fix computed
`todayIso: localIsoDate()` inside `SummaryScreen`, a LIVE read of the real
current date at the moment the effect ran — because `store.ts` never
retained the ISO `boot()` was called with (only the DERIVED `puzzleNumber`
survived boot; the original `iso` string was discarded after computing it).
The straddle: finish puzzle day D before midnight (persists correctly under
D) → sit on the Stats page past midnight (the countdown itself invites
exactly this — it's built to make the player wait) → click back to Summary
→ `localIsoDate()` now reads D+1 → `alreadySaved` checks `history[D+1]`
(nothing there) → D's already-correct snapshot re-persists a SECOND time,
under D+1's key → `stats` fields inflate a second time, `streakAfter` counts
a phantom D+1 play in the streak, and — worst of all — the player's REAL
D+1 game, played later that actual day, finds `history[D+1].hack` already
occupied by the phantom record and its own `saveDay` is silently skipped
entirely (via this exact same `alreadySaved` guard, now working against the
player). Round 1's own patch-file documentation asserted the guard was
safe "independent of how the remount is triggered" — a genuine overclaim,
true only for a bare remount within the same calendar day.

### Fix (controller-authorized: one minimal `store.ts` change)

1. **`store.ts`** — `GameStore` gains `iso: string` (initial `''` in
   `initialState()`); `boot()` sets it alongside `puzzleNumber`:
   `set({ scenarioIndex: info.scenarioIndex, n: info.n, puzzleNumber:
   puzzleNumber(iso), iso })`, using `boot`'s own `iso` parameter via object
   shorthand. Nothing else in `store.ts` touched — verified by `git diff
   --stat` below (12 lines, all in the three spots described).
2. **`Summary.tsx`** — `FinishedGameFields.todayIso` renamed to `puzzleIso`
   (the name itself is now part of the fix: it no longer invites "just call
   `localIsoDate()` for this"). `persistAndComputeSummary`'s `alreadySaved`
   check and its `saveDay` call both key on `puzzleIso`. `SummaryScreen` now
   reads `useGameStore((s) => s.iso)` and passes it straight through;
   `localIsoDate` is no longer imported by this file at all — the countdown
   display keeps its own, legitimately wall-clock-based `now` state
   (`useState(() => new Date())` + a `setInterval`), which is a genuinely
   different question ("how long until the next puzzle") from "which day did
   I just finish."
3. **Doc corrections** — both `Summary.tsx`'s `persistAndComputeSummary` doc
   comment and `registry.t17.patch.md`'s §2a were rewritten to state the
   fix's ACTUAL safety property (anchored to the puzzle's own day, immune to
   wall-clock drift between mounts) and to spell out, explicitly, what the
   round-1 overclaim got wrong and what the round-2 fix now covers that
   round 1 did not (a mount-crossing-midnight, not just a bare mount).
4. **Test** — a new test in `tests/ui/summary.test.tsx`, "a real midnight
   rollover while sitting on a nav page does not create a phantom next-day
   entry," using `vi.useFakeTimers({ shouldAdvanceTime: true })` +
   `vi.setSystemTime()` to genuinely advance the clock past midnight between
   two real `SummaryScreen` mounts (`shouldAdvanceTime` keeps
   `waitFor`'s own internal polling working via real elapsed time
   throughout — a plain `vi.useFakeTimers()` without it risked stalling
   `waitFor`). Asserts both `history['2026-08-11']` is `undefined` (no
   phantom entry) and the original day's `stats` counters are unchanged.
   The PRE-EXISTING round-1 remount test was also corrected: it had been
   asserting against `localIsoDate()` (which happened to "work" only because
   it was checking the OLD code's own — buggy — self-consistency, not the
   intended behavior); it now asserts against the literal boot iso
   (`'2026-08-10'`), which is what the fixed code actually keys on.

### Self-verification (genuine commands + real output)

**Typecheck immediately surfaced the rename**, confirming every call site
needed updating (no silent staleness possible):

```
$ PATH="/usr/bin:$PATH" npx tsc --noEmit
tests/ui/summary.test.tsx(314,7): error TS2353: Object literal may only
  specify known properties, and 'todayIso' does not exist in type
  'FinishedGameFields'.
[... 7 more, one per call site ...]
```

All fixed by renaming every call site to `puzzleIso` (`sed` for the
mechanical renames, then a manual rewrite of the two tests whose date LOGIC
— not just the field name — needed to change). Clean afterward:

```
$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)
```

**Reverted the fix, confirmed BOTH date-sensitive tests fail with the exact
predicted symptoms, restored, confirmed green again:**

```
$ sed -i "s/import { msToNextLocalMidnight } from '..\/..\/game\/daily';/import { localIsoDate, msToNextLocalMidnight } from '..\/..\/game\/daily'; \/\/ TEMP-REVERT-R2/" src/ui/screens/Summary.tsx
$ sed -i "s/puzzleIso: iso,/puzzleIso: localIsoDate(), \/\/ TEMP-REVERT-R2-BUG/" src/ui/screens/Summary.tsx

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/summary.test.tsx -t "midnight rollover"
 FAIL  ... > a real midnight rollover while sitting on a nav page does not create a phantom next-day entry (the exact straddle review round 2 found)
AssertionError: expected { hack: { mode: 'hack', …(5) } } to be undefined
- Expected: undefined
+ Received: { "hack": { "callCorrect": false, "forks": 0, "mode": "hack",
    "score": 0, "shareString": "P-hackle #1\n📄 → ⚖️❌\n0 forks · streak 2\n
    https://phackle.carlosrodriguezpardo.es", "stamp": "RETRACTED" } }
 ❯ tests/ui/summary.test.tsx:682:43
    682|       expect(saved.history['2026-08-11']).toBeUndefined();
Tests  1 failed | 24 skipped (25)

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/summary.test.tsx
 FAIL  ... > does not persist a finished day twice across a real unmount/remount...
AssertionError: expected undefined to be defined   # history['2026-08-10'] — never written; the
                                                     # bug persisted under whatever localIsoDate()
                                                     # really returned when the test ran instead
 FAIL  ... > a real midnight rollover while sitting on a nav page does not create a phantom next-day entry...
AssertionError: expected { hack: {...} } to be undefined   # the phantom 2026-08-11 entry, again
Tests  2 failed | 23 passed (25)
```

Both the new straddle test AND the pre-existing (now date-corrected) round-1
remount test fail under the reintroduced bug — for exactly the two distinct
symptoms the bug produces (a missing entry under the real day, and a phantom
entry under the wrong day). Restored and re-confirmed:

```
$ cp <scratchpad>/Summary.tsx.round2.bak src/ui/screens/Summary.tsx
$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/summary.test.tsx
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

### Re-verification — the two required files, then the full gate

```
$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npx vitest run tests/ui/summary.test.tsx tests/game/store.test.ts
 Test Files  2 passed (2)
      Tests  57 passed (57)          # 25 (summary) + 32 (store, +2 new iso assertions)

$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  32 passed (32)
      Tests  669 passed (669)         # 668 -> 669, +1: the new straddle test

$ PATH="/usr/bin:$PATH" npx eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npx vite build
✓ built in 122ms
PWA v1.3.0 — 8 entries precached

$ git diff --stat
 src/game/store.ts                    | 12 ++++-
 src/ui/screens/Summary.tsx           | 78 ++++++++++++++++++++--------
 src/ui/screens/registry.t17.patch.md | 99 +++++++++++++++++++++++++++---------
 tests/game/store.test.ts             |  4 ++
 tests/ui/summary.test.tsx            | 94 +++++++++++++++++++++++++++++-----
 5 files changed, 230 insertions(+), 57 deletions(-)
```

`store.ts`'s diff is exactly the 3 authorized spots (interface field,
`initialState()`, one `boot()` `set()` call) — no other line in that file
was touched, per the ownership-expansion instruction.

### Item 5 (subsumed) — roster correction

Updated the "T17 (this task)" and "Roster total" sections above IN PLACE
(not just noted in an appendix): 25 → **26** keys added by T17
(`summary.shareFailed`, added in the round-1 fix, was missing from the
original roster), and the grand total 175 → **176** keys known so far
(T15's contribution still pending). This is the table T19/T20 read as their
translation paper trail, so it needed to be correct in its own section, not
just cross-referenced from an appendix.

**Final SHA after round-2 fixes: `c9aa3a1`.**
