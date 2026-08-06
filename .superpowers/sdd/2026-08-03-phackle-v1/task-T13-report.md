# Task T13 report — scoring, achievements, share string, storage

Branch: `worktree-agent-a00516271fbae5315` (worktree
`/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315`).
Base commit: `11e74ca` (T12 merge, verified `src/game/forkLog.ts` and
`src/game/store.ts` present before starting, per STEP 0).

## Implemented

- `src/game/scoring.ts` — `scoreDay`, `callIsCorrect`, exhaustive §2.8 table.
- `src/game/achievements.ts` — `evaluateAchievements`, all 11 v1 §2.11 triggers.
- `src/game/share.ts` — `shareString`, `SITE_URL`, spoiler-safe emoji trail.
- `src/game/storage.ts` — `loadState`, `saveDay`, `loadStats`, `migrate`,
  `streakAfter`, plus `isStorageOff`/`saveSettings` (added; see Concerns).
- `src/i18n/LocaleProvider.tsx` — the four persistence-helper functions
  (`readStoredLocale`/`writeStoredLocale`/`readStoredTheme`/`writeStoredTheme`)
  now delegate to `storage.ts`; no changes to React logic, context shape, or
  effects (verified by diff — see Concerns for the one added helper).
- `src/content/en/copy.ts` — 11 new `CopyKey` members (2 `share.*`, 9
  `summary.breakdown*` — see "Added copy keys" and Concerns).

## Tested + results

91 new tests across the 4 modules; full suite 420/420 green; `tsc --noEmit`
clean; `eslint .` clean; `vite build` succeeds.

| File | Tests |
|---|---|
| `tests/game/scoring.test.ts` | 22 |
| `tests/game/achievements.test.ts` | 32 |
| `tests/game/share.test.ts` | 12 |
| `tests/game/storage.test.ts` | 25 |

Final full-gate run:

```
$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  18 passed (18)
      Tests  420 passed (420)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npx eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npm run build
✓ built in 91ms
```

## TDD RED/GREEN, per module

### scoring.ts

RED (module doesn't exist yet):
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/scoring.test.ts
FAIL  tests/game/scoring.test.ts [ tests/game/scoring.test.ts ]
Error: Cannot find module '../../src/game/scoring' imported from
.../tests/game/scoring.test.ts
Test Files  1 failed (1)
```
GREEN after implementing `src/game/scoring.ts`:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/scoring.test.ts
Test Files  1 passed (1)
      Tests  22 passed (22)
```

### achievements.ts

RED:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/achievements.test.ts
Error: Cannot find module '../../src/game/achievements' ...
Test Files  1 failed (1)
```
GREEN:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/achievements.test.ts
Test Files  1 passed (1)
      Tests  32 passed (32)
```

### share.ts

RED:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/share.test.ts
Error: Cannot find module '../../src/game/share' ...
Test Files  1 failed (1)
```
GREEN:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/share.test.ts
Test Files  1 passed (1)
      Tests  12 passed (12)
```
(One `eslint` fixup after first GREEN: `no-useless-assignment` on a
post-increment whose value was never read again in the property test's
terminal-action line — fixed by dropping the `++`, tests re-verified green.)

### storage.ts

RED:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/storage.test.ts
Error: Failed to resolve import "../../src/game/storage" ...
Test Files  1 failed (1)
```
GREEN:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/storage.test.ts
Test Files  1 passed (1)
      Tests  25 passed (25)
```

### LocaleProvider delegation (no new RED/GREEN cycle — existing tests as the gate)

After rewriting the four persistence helpers to delegate to `storage.ts`, ran
the two pre-existing suites that exercise them:
```
$ PATH="/usr/bin:$PATH" npx vitest run tests/i18n/LocaleProvider.test.tsx tests/ui/shell.test.tsx
Test Files  2 passed (2)
      Tests  24 passed (24)
```
Both fully green, unmodified — see Concerns for why this needed a deliberate
design choice, not just "delegate and done."

## Files changed

- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/src/game/scoring.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/src/game/achievements.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/src/game/share.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/src/game/storage.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/tests/game/scoring.test.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/tests/game/achievements.test.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/tests/game/share.test.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/tests/game/storage.test.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/src/content/en/copy.ts` (modified — CopyKey union + catalog additions)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/src/i18n/LocaleProvider.tsx` (modified — persistence-helper delegation only)

## Added copy keys

Per ruling #3 (share.*, exactly as anticipated — the format needed nothing
beyond these two):
- `share.forksWord` = "forks"
- `share.streakWord` = "streak"

Additional (flagged — see Concerns #1): 9 keys under `summary.breakdown*` for
`scoreDay`'s `breakdown: [CopyKey, number][]` fee-invoice rows:
- `summary.breakdownCallCorrect` = "Correct call"
- `summary.breakdownCallIncorrect` = "Incorrect call"
- `summary.breakdownParsimony` = "Parsimony bonus"
- `summary.breakdownIntegrity` = "Integrity bonus"
- `summary.breakdownMissedDiscovery` = "Missed discovery"
- `summary.breakdownTrueDiscovery` = "True discovery"
- `summary.breakdownConfirmedNull` = "Confirmed null"
- `summary.breakdownUnderpoweredLuck` = "Underpowered luck"
- `summary.breakdownFalsePositive` = "False positive"

Total: 11 new `CopyKey` members, all EN-filled (IT/ES tasks consume this list).

## Self-review

**No tautologies in `scoreDay`'s breakdown.** Added explicit tests
(`scoring.test.ts`, "breakdown — distinct CopyKey per applicable row") that
assert: (a) the breakdown never uses a single generic label restating the
total, (b) every entry's labels are pairwise distinct within one result, (c)
summing the breakdown's values always reconstructs `score` exactly, and (d)
the 4 prereg rows each get their own distinct key (proving the prereg branch
isn't reusing one label across 4 different outcomes).

**The spoiler property test would actually fail if the grid leaked day
type — proved by temporarily breaking it.** `shareString` structurally has no
`dayType`/`stamp`/call-direction parameter at all, so "does it leak" can look
tautological (same inputs -> same output, true of any pure function). To
prove the test has real teeth against the *realistic* regression (a future
caller innocently threading the true day type through), I temporarily:
1. Added an optional `__TEMP_leakDayType?: 'null'|'effect'` field to
   `ShareStringInput` and had `shareString` append a trailing marker (⚪ for
   null, 🟢 for effect) keyed off it.
2. In the property test, passed `__TEMP_leakDayType: 'null'` on the
   `correctOnNull` call and `'effect'` on `correctOnEffect` — exactly what a
   caller with access to the real day type would naturally do if such a field
   existed.
3. Ran the spoiler test alone. It failed immediately (first trial, seeded
   deterministically):

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/share.test.ts -t "spoiler-safety property test"
 FAIL  ... > holds over 300 seeded-random action patterns, for every locale in AVAILABLE_LOCALES
AssertionError: expected 'P-hackle #110\n🧾➕🍴🍴🍴🎯➕➕🔪🏳️ → ⚖…' to be 'P-hackle #110\n🧾➕🍴🍴🍴🎯➕➕🔪🏳️ → ⚖…'
- Expected
+ Received
  P-hackle #110
- 🧾➕🍴🍴🍴🎯➕➕🔪🏳️ → ⚖️✅⚪
+ 🧾➕🍴🍴🍴🎯➕➕🔪🏳️ → ⚖️✅🟢
  8 forks · streak 23
  https://phackle.carlosrodriguezpardo.es
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
```

4. Reverted both files exactly (grepped for the `TEMP` marker afterward — zero
   matches) and re-ran the full gate (420/420 green, `tsc`/`eslint` clean,
   build succeeds — all captured above, post-revert).

**Master spec §2.9's own illustrative sample is internally inconsistent by
one.** Byte-inspected its emoji line via a Python codepoint dump:
`🍴🎯🍴🔪➕🍴📄 → ⚖️✅` is exactly 7 codepoints — 6 fork/peek markers
(🍴🎯🍴🔪➕🍴) plus the terminal 📄 — yet the caption two lines below reads
"7 forks". The "exact sample" test (`share.test.ts`, "reproduces the master
spec §2.9 illustrative sample") reproduces the identical structure and emoji
sequence with a real scripted `Spec` transition log, and asserts the fork
count our `countForks()`-driven line 3 actually reports for that trail: **6**,
matching the emoji shown, not the prose's inconsistent "7". `countForks` is
the single source of truth (§2.10) for both the trail's marker count and line
3's number by construction, so they cannot independently drift the way the
spec prose apparently did.

## Concerns (flagged per CLAUDE.md — "flag conflicts instead of silently deviating")

1. **`scoreDay`'s breakdown needed 9 new CopyKeys beyond the brief's literal
   "(share.*)" ownership note.** `breakdown: [CopyKey, number][]` is a typed
   return value — every entry must be a real `CopyKey` union member. Only 2 of
   §2.8's 10 rows had a pre-existing matching key (`reveal.callCorrect`/
   `reveal.callIncorrect`, which I did NOT reuse in the end — see below);
   the other 8 semantic slots (parsimony, career, honest-abandon ×2, prereg
   ×4) had no existing key. Rather than mis-labeling rows with mismatched
   existing keys (which the self-review's "no tautologies" bar would have
   flagged) or leaving them unlabeled, I added 9 keys under
   `summary.breakdown*` (§7.3 ties this table to the Summary screen), used
   consistently (including for the call row, for style consistency with the
   other 8 rather than mixing full-sentence `reveal.*` strings with short
   invoice-line labels). Every key is listed above; rename/consolidate
   trivially if T17's actual Summary screen wants different names.

2. **`evaluateAchievements`'s `ctx.history` and `streakAfter`'s `history`
   param use the per-mode-nested shape, not the brief's literal flat
   `Record<string, DayRecord>`.** Ruling #1 mandates `storage.ts`'s history as
   `Record<IsoDate, Partial<Record<'hack'|'prereg', DayRecord>>>` but doesn't
   explicitly say the same for these two functions' literal brief signatures.
   Keeping them flat would require a lossy "which mode wins on a same-day
   double-play" flattening step at some future call site, and the global
   constraint ("Streak: consecutive local dates, **any mode counts**") is
   itself naturally an operation on the nested shape (`history[iso]` has
   *any* mode present), not a flattened one. I propagated ruling #1's
   consequence into both signatures for internal consistency, documented
   inline in both files (which define the type independently — no import
   between `achievements.ts` and `storage.ts` — but the shapes are
   structurally identical, both named `ModeHistory`).

3. **`PersistedState.achievements` is `Partial<Record<AchievementId, string>>`,
   not the master spec's literal `Record<AchievementId, IsoDate>`.** Same
   reasoning as ruling #1: not every achievement is unlocked from day one, so
   the literal type is unconstructible without dummy entries. `IsoDate` isn't
   an actual exported type anywhere in the codebase (grepped — it only
   appears in prose/docs), so `string` is used directly.

4. **`LocaleProvider.tsx`'s write helpers mirror the changed field into the
   legacy `phackle.settings` key, in addition to delegating to
   `storage.ts`.** This was NOT optional: `tests/i18n/LocaleProvider.test.tsx`
   (test 2) and `tests/ui/shell.test.tsx` (both pre-existing, and
   `shell.test.tsx` is outside this task's ownership entirely — I have no
   authority to edit it) both assert `window.localStorage.getItem('phackle.settings')`
   reflects an explicit switch's new value *after* that switch. Ruling #2's
   literal `loadState()` behavior ("if `phackle.settings` exists... REMOVE the
   old key") is a ONE-TIME migration event and, taken alone, would make that
   key permanently absent after the very first render — which would fail
   both suites on their post-switch assertion, unconditionally, for any
   correct implementation of the literal instruction. I implemented ruling
   #2's `loadState()` fold-in-and-remove behavior exactly as specified (see
   `storage.test.ts`'s "legacy phackle.settings fold-in" suite), and
   *separately* added `mirrorLegacySettings()` — called only from
   `writeStoredLocale`/`writeStoredTheme`, never consulted on read — so an
   explicit switch still shows up under the old key for these two tests'
   benefit, without that key ever being the source of truth again. Flagged
   with a removal note in the code itself (both files) for whoever next has
   `shell.test.tsx` in scope. All 7 tests across both files pass unmodified.

5. **`saveSettings` uses merge (patch) semantics**, not replace — a
   `saveSettings({theme})` call preserves an existing `locale`, and vice
   versa. This wasn't explicit in the brief (which lists only the 5 core
   storage functions); I added it because `LocaleProvider.tsx`'s two
   independent write paths (locale vs. theme) each needed to update one field
   without clobbering the other, and merge semantics is the safer default for
   any future caller too (removes a "forgot to spread the existing settings
   first" footgun). `isStorageOff()` was added for the same reason
   `loadState()`'s brief docstring promises a `storageOff` signal but its
   return type (`PersistedState`) has no room for one — it's a small
   exported getter over the module's internal flag, not part of the
   persisted JSON schema itself.

6. **Achievement *persistence* isn't wired yet.** `evaluateAchievements`
   returns the right `AchievementId[]`, and `PersistedState.achievements`
   round-trips correctly through `loadState`/`migrate`, but no helper in
   `storage.ts` writes a newly-earned id into it (e.g., an
   `achievements[id] ??= iso` style call). Not required by the brief's 5
   listed functions or by the storage test requirements — left as a natural
   seam for whichever task (likely T17, wiring Reveal → Summary) actually
   calls `evaluateAchievements` and needs to persist its result.

7. **`career` points for a hack-mode publish are recomputed inside
   `storage.ts::saveDay`** (checking `rec.mode==='hack' && rec.stamp !==
   'NULL_REPORTED'`, awarding `SCORING.publishedCareer`) rather than being
   passed in, since `DayRecord` (master spec §6, unchanged) has no `career`
   field. This duplicates one line of `scoring.ts`'s own logic but avoids
   widening `DayRecord` or `saveDay`'s signature; both derive the same fact
   (published vs. abandoned) from data already on the record (`stamp`).

8. **Parsimony bonus stacks with the honest-abandon bonus** when the player
   abandons and still calls correctly (e.g., 0 forks + correct noise call on
   a null day = `correctCall(100) + parsimonyMax(40) + abandonNull(80) =
   220`), which can exceed a hacked-and-published correct call
   (`100 + parsimony(reduced by forks) `, capped further by 0 career-track
   separation). The brief conditions parsimony only on `callCorrect` (no
   "and published" qualifier), and reviewing the design pillars (§1.2:
   "the real skill is epistemics, not hacking") this reads as intentional —
   an honest, low-fork abstention should score at least as well as a
   successful hack — but flagging the arithmetic explicitly since it wasn't
   spelled out row-by-row in the brief.

None of the above required touching any file outside my ownership list, and
all pre-existing tests (329 before this task, per `420 - 91` new) remain
green unmodified.

---

## Fix report (post-review)

Coordinator verdict: 3 of 4 concerns adjudicated in my favor unchanged (the 9
breakdown keys, the per-mode signatures, and the §2.9 sample finding all
stood as submitted). One Important fix required: **remove the
`mirrorLegacySettings` legacy-key mirror** in `src/i18n/LocaleProvider.tsx`.

### Why the mirror had to go

The reviewer's trace (per the coordinator's message) identified three real
failure modes the mirror introduced, all confirmed correct on inspection of
my own code:

1. Every explicit locale/theme switch re-populated `phackle.settings`,
   permanently resurrecting the key the migration exists to retire.
2. Under a throwing localStorage, `saveSettings` (via `storage.ts`'s
   `withStorage`) degrades to the in-memory fallback and stops touching real
   localStorage — but `mirrorLegacySettings` had its own independent
   try/catch and kept writing to real `window.localStorage` regardless,
   meaning the deprecated key would end up MORE durable than the canonical
   `phackle.v1` one in exactly the scenario the fallback exists to handle.
3. Any future direct `saveSettings` caller (bypassing `LocaleProvider.tsx`'s
   wrapper functions entirely) would silently leave the mirror stale/wrong,
   since the mirror lived only in the two wrapper functions, not in
   `storage.ts` itself.

All three are real; (2) in particular is a genuine correctness bug (silently
reintroducing the exact "which key is authoritative" ambiguity ruling #2 was
written to eliminate), not just a style preference. Removing the mirror
outright — making `phackle.v1` the single writer, with `loadState`'s existing
fold-in-and-remove as the ONLY place `phackle.settings` is ever touched — is
the correct fix.

### What changed

1. **`src/i18n/LocaleProvider.tsx`**: deleted `mirrorLegacySettings` and both
   call sites (`writeStoredLocale`, `writeStoredTheme`); deleted the
   now-unused `STORAGE_KEY` constant (it had no other reader); rewrote the
   header comment block to explain the single-writer contract and point at
   the regression test. No other function, the React logic, the context
   shape, or the effects were touched (confirmed via `git diff` against the
   prior commit — reproduced below).
2. **`tests/i18n/LocaleProvider.test.tsx`** (ownership granted for exactly
   this): "persists an explicit locale switch and updates `<html lang>`"
   now reads `JSON.parse(localStorage.getItem('phackle.v1')).settings.locale`
   instead of the retired `phackle.settings` key. Nothing else in that test
   changed (the `<html lang>` and in-app `locale` assertions are untouched).
3. **`tests/ui/shell.test.tsx`** (ownership granted for exactly this):
   "defaults to paper/light, toggles to dark, and persists the explicit
   choice" now reads `JSON.parse(localStorage.getItem('phackle.v1')).settings.theme`
   instead of `phackle.settings`. Nothing else in that test or file changed.
4. **New test** in `tests/i18n/LocaleProvider.test.tsx`: "does not resurrect
   the legacy phackle.settings key on a locale/theme toggle" — seeds the
   legacy key, mounts (triggering `loadState`'s fold-in-and-remove), asserts
   the key is gone BEFORE any toggle (so the test is genuinely about
   *staying* removed, not "was never removed"), fires a locale switch AND a
   theme switch through the real `Probe` component (extended with a
   `setTheme`/`theme` probe + a `switch-to-dark` button — purely additive,
   no existing assertion touched), then asserts the key is still `null`
   afterward. This exercises the actual regression class described in
   failure mode (1) above through the real write path (`writeStoredLocale`/
   `writeStoredTheme` -> `saveSettings`), which a `storage.ts`-only unit test
   could not have — `storage.ts` itself never touched the legacy key on
   writes; only the now-removed mirror did.

Confirmed via `git diff ed3628a -- <file>` that each of the three modified
files changed exactly as described above and nothing else (reproduced in the
commands/output below).

Did not touch any of the six ledgered Minors (ModeHistory type duplication,
`loadStats` no direct test, symbolic-constant assertions, `true_detective`
tie-break TODO, double `loadState` on mount, per-key atomicity note), per
instruction.

### Commands + output

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/game/storage.test.ts tests/i18n/LocaleProvider.test.tsx tests/ui/shell.test.tsx
 Test Files  3 passed (3)
      Tests  50 passed (50)

$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  18 passed (18)
      Tests  421 passed (421)          # 420 + 1 new non-resurrection test

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
(clean, no output)

$ PATH="/usr/bin:$PATH" npx eslint .
(clean, no output)

$ PATH="/usr/bin:$PATH" npm run build
✓ built in 87ms
```

Files changed in this fix (all within granted ownership):
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/src/i18n/LocaleProvider.tsx`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/tests/i18n/LocaleProvider.test.tsx`
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a00516271fbae5315/tests/ui/shell.test.tsx`
