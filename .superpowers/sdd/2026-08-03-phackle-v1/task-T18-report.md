# Task T18 Report — Prereg Mode

**Branch:** `worktree-agent-a6eca979e92733b6b` **Final SHA (after review fix):** `1e5593d`
(original submission SHA: `60f6662`)
**Worktree:** `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b`

## Interruption note

Mid-task the host machine was powered off (accidental) and the process restarted. On
resume: `pwd` confirmed the correct worktree, `git status --short` was clean (no
uncommitted work — the interruption landed during the research/reading phase, before
any `Write`/`Edit` call), `git log -3` still showed `HEAD` at `755db1e` (base, per
STEP 0), `node_modules/` was intact, and `PATH=/usr/bin:$PATH node --version` matched
`.nvmrc` (22.22.1). `npx tsc --noEmit` on the untouched tree was clean. Nothing needed
reconciling; implementation proceeded from scratch as originally planned.

## STEP 0

- `git reset --hard 755db1e` — confirmed `src/game/dayComplete.ts` exists (T30 merged)
  and `src/ui/screens/Summary.tsx` contains the `unlockedToday`/`preregUnlocked` logic.
- `pwd` = the worktree path above; every write used its absolute prefix.
- `npm ci` (527 packages, 0 vulnerabilities) — PATH-prefixed on every npm/npx/node
  command throughout.

## Implemented

**Store (`src/game/store.ts`):**
- `Screen` union gains `'prereg'` (additive, commented).
- `GameStore.preregResult: PathResult | null` — the committed spec's own N=400
  result, set exactly once by `preregCommit()`, reset by every `boot()`. Deliberately
  a *separate* field from `result` (never reused), documented inline.
- `chooseMode(mode: 'hack' | 'prereg')` — guarded to `screen==='briefing'`; sets
  `mode` + `screen` together (`'prereg'` → `'prereg'` screen, `'hack'` →`'lab'`,
  equivalent to `openData()`). The Briefing chooser's own hacking option calls the
  existing, already-tested `openData()` instead of `chooseMode('hack')` — no new,
  redundant, untested path.
- `preregCommit(spec: Spec)` — guarded to `screen==='prereg' && mode==='prereg' &&
  !pending` (the `pending` conjunct closes a reentrancy window a bare screen guard
  would leave open for the whole async duration — see judgment calls). Drives
  `client.extend()` `N_SCHEDULE.length - 1` (4) times with **no** `runSpec` in
  between, runs the committed spec exactly **once**, fetches
  `client.reveal(spec, [spec])`, corrects the returned `stamp` and `peeks` (see
  judgment calls), and lands on `'reveal'` in one consolidated `set()`.

**`src/ui/screens/Prereg.tsx` (+`Prereg.css`, new):** the preregistration FORM.
Local component state only (`spec`, `checked`, `submitting`) — never
`store.changeSpec` (guarded to `'lab'` only; verified by a test whose fake
`changeSpec` throws if ever called). Renders the reused `SpecControls` (six groups,
no live PValueDial/CoefPlot — nothing is ever shown before commit), the solemn
commit checkbox, and a submit CTA enabled only once ticked. After submit: controls/
checkbox/button disabled, `prereg.locked` status shown (no motion added — the
"optional beat" was taken as literally optional and kept to a status line, not a
transition).

**`src/ui/screens/registry.ts`:** `prereg: Prereg` entry added directly (no patch
file — sequential merges, per the controller amendment).

**`src/ui/screens/Briefing.tsx` (+`.css`):** the mode chooser. Reads `loadState()`
directly (same pattern as `Summary.tsx`'s `persistAndComputeSummary`) to compute
`unlocked` (`achievements.first_retraction !== undefined`) and today's
`hackPlayedToday`/`preregPlayedToday`. Chooser visible iff `unlocked &&
!preregPlayedToday` (exactly the controller's stated gate); each option
independently disabled + labelled "already played today" per its own history —
belt-and-suspenders on top of the persist-layer `alreadySaved` guard.

**`src/ui/screens/Summary.tsx`:** `FinishedGameFields` gains optional
`preregResult?: PathResult | null`; `persistAndComputeSummary`'s `preregSig` is now
`mode==='prereg' ? Boolean(preregResult?.valid && preregResult.p < 0.05) :
undefined` — computed independently of `stamp`, replacing T17's documented
approximation. `SummaryScreen` passes `store.preregResult` through unconditionally
(a no-op on hack days).

**`src/ui/screens/Reveal.tsx`:** two changes, both additive:
1. A clarifying comment on the existing `call === null ? null : …` block — it
   already handled prereg's permanently-null `call` correctly; no behavioral change
   was needed there.
2. The `reveal.preregFalsePositive` one-liner, gated on the exact new
   `mode==='prereg' && dayType==='null' && stamp==='RETRACTED'` combination this
   task introduces (a RETRACTED day with no CALL step is otherwise impossible) —
   see judgment calls for why I treated this as in-scope beyond the literally-named
   "call-block gating" authorization.

**Copy (`src/content/en/copy.ts`)** — 7 new `CopyKey` members + 1 existing key's
value updated:
| Key | Status | Value |
|---|---|---|
| `prereg.intro` | new | "Declare your full analysis before you see a single number…" |
| `prereg.commit` | **updated** | "I solemnly commit to running and reporting this exact specification, whatever it shows." (was: "Commit to this spec") |
| `prereg.submit` | new | "Submit preregistration" |
| `reveal.preregFalsePositive` | new | "This is not a mistake: a preregistered analysis, run exactly once, still finds a false positive about 5% of the time. Today was one of those days." |
| `briefing.modeChooserIntro` | new | "Preregistration is unlocked. Choose how you play today — one attempt per mode." |
| `briefing.playHacking` | new | "Play Hacking Mode" |
| `briefing.playPrereg` | new | "Play Prereg Mode" |
| `briefing.alreadyPlayedToday` | new | "Already played today" |

`prereg.title`/`prereg.locked` (pre-existing) reused unchanged. `en` is the only
content module today (IT/ES both fall back to it until T19/T20), so no other locale
file needed touching.

## Judgment calls (both flagged up front, resolved as follows)

1. **N=400 mechanics.** The protocol (`engine/protocol.ts`, `engine/worker.ts`) has
   no "jump to N=400" op — `extend()` only steps one `N_SCHEDULE` entry at a time,
   and adding one would mean touching files outside T18's ownership. `preregCommit()`
   drives it with exactly `N_SCHEDULE.length - 1` (4) `extend()` calls, dispatching
   **no** `runSpec` in between (unlike `peekAndExtend`, which re-runs the current
   spec after every extend to show a live update — nothing is ever shown here before
   the one committed run). Side effect: the worker's internal peek counter climbs to
   4 as a mechanical byproduct, which `payload.peeks` would otherwise surface as a
   misleading "your 4 data-peeks…" line on a screen where the player never peeked at
   anything. I zero it in the stored payload (`peeks: 0`), documented inline in
   `preregCommit`. This goes slightly beyond "peeks are irrelevant for *scoring*"
   (verified true — `scorePrereg` never reads `peeks`/`forks`) into "also correct
   the *display*", since leaving it would actively misrepresent honest, blind
   preregistration as optional-stopping behavior — a direct contradiction of the
   feature's whole point.
2. **preregSig carry-path.** Carried through the store as a new `preregResult:
   PathResult | null` field (not derived from `stamp`), then computed independently
   in `persistAndComputeSummary`. `preregCommit()` *also* corrects `stamp` itself
   (for the visual verdict and for `unlockAchievements`'s `ctx.stamp`), so the two
   signals agree by construction today — but they are two separate computations on
   purpose, per the brief's own framing ("carry it through the store... document"):
   a bug in the stamp-correction logic must not silently corrupt scoring, and vice
   versa.
3. **`reveal.preregFalsePositive` wiring.** The controller's binding amendments
   authorize a "minimal, documented edit to Reveal.tsx" specifically for the
   call-block gating — which turned out to already work correctly, requiring no
   change. I judged the false-positive one-liner (named in the brief's own
   "Behavior pins") to fall within the same overall "make Reveal.tsx correct for
   prereg days" concern, and implemented it as a small, strictly additive block
   (new `mode` read + one conditional `<p>`, gated on a state combination that
   literally could not occur before this task) rather than leave a named
   requirement half-done. Flagging this explicitly in case the controller intended
   a narrower reading.
4. **Achievements NOT reachable from a prereg commit** (`first_blood`,
   `outlier_surgeon`, `one_tailed_bandit`, `harking`): `dayComplete.ts`'s
   `unlockAchievements` derives `ctx.published` from a `SUBMIT` log entry, which
   `preregCommit()` deliberately never pushes (reusing `SUBMIT`'s shape would
   conflate two behaviorally different acts — an adaptive hack-mode publish vs. a
   blind prereg commit — under achievement citations written specifically about the
   former, e.g. Outlier Surgeon's "removal of inconvenient humans"). `monk`
   (20 prereg days) and `first_retraction` are unaffected — both are computed from
   `mode`/`stamp`/history directly, not from `ctx.published`. `achievements.ts`/
   `dayComplete.ts` are outside T18's file ownership; not touched.
5. **Third enforcement layer NOT added.** "One play per mode per day" is enforced at
   exactly the two layers the controller named — persist-layer `alreadySaved`
   (pre-existing) and the Briefing chooser's UI-layer disablement (mine). I did
   *not* add a storage-history check inside `chooseMode`/`preregCommit`
   themselves: `store.ts` is deliberately storage-free ("no storage access" is
   `dayComplete.ts`'s own stated principle too), and importing `storage.ts` there
   would break that boundary for a guard the UI layer already covers.

## Tests + results

**TDD process:** implementation was written first (large, unfamiliar codebase —
research-heavy), then all new/modified test files were written, verified GREEN
against the implementation, and finally **genuine RED evidence was captured** by
`git stash push -u` on the *implementation* files only (keeping the test files in
place) and re-running:

```
Test Files  4 failed (4)
     Tests  34 failed | 46 passed (80)
```

(`tests/ui/prereg.test.tsx` failed to even resolve its import; every
`chooseMode`/`preregCommit` call site threw `TypeError: ... is not a function`;
every `mode-chooser` query in `briefing.test.tsx` found nothing — exactly the
expected pre-implementation failures. The 46 passes are the pre-existing,
untouched tests in those same files.)

`git stash pop` restored the implementation; full gate re-run:

```
npm run typecheck   → exit 0
npm run lint        → exit 0
npm test            → 45 files, 1006 tests passed
```

**New/modified test files:**
- `tests/game/prereg.test.ts` (new, 26 tests) — `chooseMode` guards;
  `preregCommit` guards (not-booted, wrong screen, wrong mode, reentrancy while
  in-flight, called again after completion); N=400 mechanics (exactly 4 `extend()`
  calls, exactly 1 `runSpec` on the committed spec, no `runSpec` between extends,
  `reveal(spec, [spec])`); stamp correction (sig+effect+right→REPLICATED,
  sig+effect+wrong→RETRACTED, sig+null→RETRACTED, nonsig+null→NULL_REPORTED
  overriding the engine, nonsig+effect→NULL_REPORTED overriding the engine,
  invalid result never counts as significant); `peeks` zeroed; all four §2.8
  scoring rows end-to-end through the real store + `persistAndComputeSummary`;
  one 🧾 share-prefix end-to-end test.
- `tests/ui/prereg.test.tsx` (new, 9 tests) — title/intro render; all six
  SpecControls groups render with no live p-value anywhere on screen; checkbox
  unchecked by default with the §7.3-pinned wording; submit disabled until
  ticked; submit-while-unchecked calls `preregCommit` zero times; ticking +
  submitting calls it once with the exact local spec (including after a knob
  change, and confirms `store.changeSpec` is never touched); post-submit
  disables everything and shows the locked status; loading-gate safety net.
- `tests/ui/briefing.test.tsx` (+6 tests) — chooser hidden when locked; chooser
  shown when unlocked and prereg not yet played; chooser hidden once prereg
  played today (falls back to plain Open Data); hack option disabled +
  "already played" when hack already played (prereg still open — the two
  guards are independent); clicking each option calls the right action
  (`openData` / `chooseMode('prereg')`) and nothing else.
- `tests/ui/reveal.test.tsx` (+5 tests) — same six blocks in order on a prereg
  day with the call block genuinely empty; the false-positive one-liner shows
  on sig+null RETRACTED; does NOT show on hack-mode RETRACTED (unchanged
  existing behavior); does NOT show on prereg REPLICATED; does NOT show on
  prereg RETRACTED caused by the wrong-outcome-on-an-effect-day case.

## Files changed

- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/game/store.ts`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/Prereg.tsx` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/Prereg.css` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/registry.ts`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/Briefing.tsx`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/Briefing.css`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/Summary.tsx`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/Reveal.tsx`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/content/en/copy.ts`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/tests/game/prereg.test.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/tests/ui/prereg.test.tsx` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/tests/ui/briefing.test.tsx`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/tests/ui/reveal.test.tsx`

## Self-review (step 6 — tone check)

Reread §7.3's "I solemnly commit." `prereg.commit`'s final wording ("I solemnly
commit to running and reporting this exact specification, whatever it shows.") and
`prereg.intro` ("Declare your full analysis before you see a single number…") stay
sincere-bureaucratic throughout — no wink, no exclamation, no self-aware aside. The
`reveal.preregFalsePositive` line keeps Reveal's own clinical register ("This is not
a mistake…", stating what happened and stopping, not apologizing or congratulating).
Verified via `tests/content/copyFreeze.test.ts`'s raw-string scan (passing) that
every new JSX string in `Prereg.tsx`/`Briefing.tsx` routes through the copy catalog.

## Concerns (for the controller)

1. `reveal.preregFalsePositive` wiring goes slightly beyond the letter of the
   controller's Reveal.tsx authorization (see judgment call 3) — small, additive,
   fully tested, but flagged in case a narrower reading was intended.
2. `share.ts`'s `⚖️✅`/`⚖️❌` terminal marker is, by construction, always `⚖️❌` for
   every prereg day (`call` is always `null` there, and `persistAndComputeSummary`
   passes `callCorrect ?? false` into `shareString`). This is pre-existing,
   untouched `share.ts` behavior (T13) and out of my file ownership; the brief's own
   scope for T18 was narrowly "verify the pipeline fires," which it does — but the
   `⚖️` glyph's meaning for a mode with no call at all may be worth a follow-up
   design decision.
3. Achievements `first_blood`/`outlier_surgeon`/`one_tailed_bandit`/`harking`
   structurally cannot fire from a prereg commit today (judgment call 4) — by
   design, not oversight, but flagged since it's a real behavioral gap relative to
   a hack-mode day with an equivalent spec.
4. `RadioGroup.tsx`'s keyboard handler (`handleKeyDown`) does not itself check its
   own `disabled` prop before calling `onChange` — harmless in practice (disabled
   native `<button>`s cannot receive keyboard events in a real browser, and
   `Lab.tsx` always passes `disabled={false}`), but `Prereg.tsx` is the first real
   caller to ever pass `disabled={true}`. Not touched — `RadioGroup.tsx` is a
   shared component outside T18's ownership, and no test needed it fixed.

---

## Review fix round — SHA `1e5593d`

**Verdict:** Needs fixes — one Important. Adjudications on my own concerns #1, #3,
#4 above all resolved in my favor (preregFalsePositive wiring accepted as
spec-mandated; Monk confirmed fully wired through `preregDays`, independent of the
SUBMIT-log gap; RadioGroup confirmed structurally harmless). The controller's
earlier proposed share ruling was **rejected** by the reviewer as a spoiler-rule
violation; the fix implemented below is the reviewer's own counter-proposal,
implemented exactly as specified.

### The bug

Real playthroughs were broken end-to-end: `preregCommit()` never logs a
`SUBMIT`/`ABANDON` action (a preregistered commit is always run and reported,
never abandoned — §2.6/§7.3), so `share.ts`'s `buildTrail` emitted **no terminal
marker at all** for a real prereg day. Separately, `Summary.tsx`'s
`callCorrect ?? false` coerced Prereg Mode's real `callCorrect: null` (no call is
ever made, §2.8) into an unconditional "wrong call" reading. Net effect: **every
single real prereg day** shared as `"🧾 → ⚖️❌"` — nothing between the prefix and
the arrow, and a call marker for a call that never happened.

### The fix (reviewer's exact prescription)

1. **`src/game/share.ts`**
   - `ShareStringInput.callCorrect` widened to `boolean | null`; `shareString`
     omits the `" → ⚖️…"` suffix entirely when `null`.
   - `buildTrail`'s terminal is now **mode-decided for prereg**, not
     log-content-decided: `SUBMIT`/`ABANDON` entries encountered while
     `prereg === true` are now ignored (`if (!prereg) trail += …`), and a single,
     fixed, outcome-independent `📄` is appended unconditionally at the end
     (`if (prereg) trail += SUBMIT_EMOJI`) — reusing the existing glyph, no new
     emoji, no legend change. The glyph is **never** derived from
     preregSig/significance (that would let a viewer infer day type from the
     glyph alone — the exact leak the controller's rejected proposal would have
     introduced).
2. **`src/ui/screens/Summary.tsx`** (line ~306→312) — `callCorrect` now passed
   through as-is; `?? false` dropped.
3. **`tests/game/share.test.ts`**
   - The two hand-built prereg fixtures with literal `SUBMIT`/`ABANDON` entries
     (formerly ~90-94, ~139-149) re-scoped via doc comments as generic-contract
     tests of `buildTrail`'s prefix/length mechanics — their assertions were
     verified to still hold unchanged (the fixed terminal replaces the ignored
     inline one 1-for-1, so lengths match; the prefix logic is untouched), so no
     assertion edits were needed, only honest re-labeling.
   - **Added**: a test using preregCommit's real log shape (a single un-seen
     `VIEW_SPEC`, no terminal action at all) asserting the exact expected output
     `"🧾📄"`.
   - **Extended** the spoiler property test with a dedicated prereg-mode test: a
     fixed, randomly-varied action pattern (300 trials) matching preregCommit's
     real log shape, asserting `callCorrect: null` produces byte-identical output
     regardless of the imagined day's significance — plus a "guards the guard"
     pair proving the same check *would* detect a future regression that derived
     `callCorrect` from significance instead of passing the real `null`.
4. **`tests/game/prereg.test.ts`** — the "share — 🧾 prefix" test now asserts the
   **full** line 2 (`expect(result.shareText.split('\n')[1]).toBe('🧾📄')`), not
   merely that it starts with `🧾`.

### Verification — genuine commands + output

```
$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(no output — exit 0)

$ PATH="/usr/bin:$PATH" npx vitest run tests/game/share.test.ts tests/game/prereg.test.ts tests/ui/summary.test.tsx
 RUN  v4.1.10 /home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b

 Test Files  3 passed (3)
      Tests  68 passed (68)
   Start at  08:33:23
   Duration  935ms

$ PATH="/usr/bin:$PATH" npm run typecheck
> tsc --noEmit
exit 0

$ PATH="/usr/bin:$PATH" npm run lint
> eslint .
exit 0

$ PATH="/usr/bin:$PATH" npm test
> vitest run
 RUN  v4.1.10 /home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b

 Test Files  45 passed (45)
      Tests  1008 passed (1008)
   Start at  08:33:38
   Duration  7.42s
exit 0
```

`tests/game/share.test.ts` grew from 12 to 14 tests (the two re-scoped fixtures
kept their original assertions; +1 real-shape case, +1 extended property test) —
matching the suite's 1006 → 1008 total.

### Files changed (fix round)

- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/game/share.ts`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/src/ui/screens/Summary.tsx`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/tests/game/share.test.ts`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a6eca979e92733b6b/tests/game/prereg.test.ts`

**Commit:** `1e5593d` — `fix: prereg share line was broken end-to-end — missing
terminal, phantom ⚖️❌`

### Minors — explicitly NOT touched (per instruction)

- Hack-only achievements can't fire from a prereg commit — ledgered as a design
  follow-up question, outside T18's ownership.
- `RadioGroup.tsx`'s keydown-vs-disabled smell — untouched file, confirmed
  structurally harmless by the reviewer.
