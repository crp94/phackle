# Task T24 — CI finalize

**Agent:** implementer · **Worktree:** `.claude/worktrees/task-t24` · **Branch:** `task-t24`
**Base:** `fb90c9e` (verified at STEP 0) · **Round-0 commit:** `65c91ddf953ffbcd6f5662f1cec39bb47c5cb8b6`
**Fix round 1 commit:** `cf3d3fda338b920c6a0a423a99c10ee691606682` (on top of round 0 — **§7 is the
required reading for this round**: round 0's pipefail claim was false, corrected in place, fixed,
and re-proven non-circularly). **Not pushed.**
**Files:** `.github/workflows/test.yml` (modified), `.github/workflows/{e2e,calibration}.yml` (new,
`calibration.yml` further fixed in round 1),
`tests/engine/dgp.test.ts` (modified — timeout only, zero assertions touched),
`tests/game/epochGuard.test.ts` (new). **README:** checked — no CI-status references to touch, none invented.

---

## 0. Setup, stated honestly

`node_modules` was absent. `PATH="/usr/bin:$PATH"` resolves to node v22.22.1 / npm 9.2.0 (matches
`.nvmrc`'s `22`). `npm install` then, later, three separate `rm -rf node_modules && npm ci` cycles
(one before the commit, one after) all completed at `added 530 packages ... found 0
vulnerabilities`, exit 0 every time. The main checkout was never touched.

One recurring, non-fatal warning on every install: `npm WARN EBADENGINE jsdom@30.0.1 required:
node ^22.22.2 ... current: v22.22.1` — the local `/usr/bin/node` is one patch behind what jsdom's
`engines` field asks for. It is a warning, not an error (`npm ci` still exits 0 and every jsdom-based
test passes), and out of T24's scope — flagged under Concerns below rather than silently patched,
since it touches `.nvmrc`/`package.json` semantics no T24 file owns.

`npx playwright install --with-deps chromium` **cannot run in this sandbox**: it needs root
(`sudo: A terminal is required to authenticate`). Fell back to `npx playwright install chromium`
(browser binary only, no sudo) plus a manual `npx playwright install-deps chromium --dry-run` to see
what `--with-deps` would have installed (15 packages — `at-spi2-core`, `libatk*`, `xvfb`, font
packages, mostly accessibility-bridge/font/X11 libs). Despite the "missing" report, the browser
launched and ran the full suite correctly in this sandbox (see §3) — Ubuntu GitHub-hosted runners
ship these packages already via `--with-deps`, so `e2e.yml` still calls it exactly as specified;
this workaround is a sandbox-only substitution, not a workflow change.

---

## 1. Workflow inventory

| File | Trigger | Job | Steps (in order) |
|---|---|---|---|
| `.github/workflows/test.yml` | `push` (any branch), `pull_request` (any branch) | `test` (ubuntu-latest) | checkout@v4 → setup-node@v4 (`node-version-file: .nvmrc`, `cache: npm`) → `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` (vitest full run) → `npm run build` |
| `.github/workflows/e2e.yml` (new) | `push` (any branch), `pull_request` (any branch) | `e2e` (ubuntu-latest) | checkout@v4 → setup-node@v4 (`node-version-file: .nvmrc`, `cache: npm`) → `npm ci` → `npx playwright install --with-deps chromium` → `npm run e2e` → upload-artifact@v4 `playwright-report/` (**`if: failure()`** only) |
| `.github/workflows/calibration.yml` (new) | `schedule` cron `0 6 * * 1` (Monday 06:00 UTC), `workflow_dispatch` | `calibration` (ubuntu-latest) | checkout@v4 → setup-node@v4 (`node-version-file: .nvmrc`, `cache: npm`) → `npm ci` → `npm run cal \| tee calibration-report.txt` → upload-artifact@v4 `calibration-report.txt` + `src/data/p_hit_by_k.json` (`if: always()`) |

Design choices, briefly:

- **e2e is its own workflow**, not a job on `test.yml` — a browser-infra failure (chromium download,
  webServer boot timeout) now gets its own status check and can never mask, or be masked by, a unit
  failure. Both `test.yml` and `e2e.yml` trigger on the same push/PR events per STEP-0's instruction
  (the plan doc's own T24 section said "PRs" only for e2e; STEP 0's explicit "on push + PR" wording
  is what was followed, since it is the more specific, later instruction).
- **`node-version-file: '.nvmrc'`** replaces the old hard-coded `node-version: 22` in `test.yml`
  (and is used identically in the two new workflows) — one source of truth, no drift risk if the
  pin ever changes.
- **`permissions: contents: read`** added to all three workflows (least-privilege; none of these
  jobs write to the repo or need the default read/write token scope).
- **calibration has no `paths:` filter.** The plan doc's T24 sketch listed `paths: src/engine/**`,
  but `paths:` only applies to `push`/`pull_request` events — it is not evaluable on a `schedule`
  trigger, so it was dropped rather than carried over as dead, misleading config. STEP 0's own
  restatement of T24 (the authoritative one for this dispatch) does not mention it either.
- ~~**`npm run cal | tee calibration-report.txt` preserves the real exit code.** GitHub Actions'
  default `run:` shell on Linux is `bash --noprofile --norc -eo pipefail {0}` — `pipefail` is
  already the default, confirmed locally: `bash -c 'set -o pipefail; (exit 1) | tee f; echo $?'` →
  `1`. No workaround needed.~~
  **[FIX ROUND 1 — CORRECTION, this claim was FALSE.]** GitHub Actions' documented default for an
  **unspecified** shell on Linux is plain `bash -e {0}` — **no `pipefail`**. The
  `bash --noprofile --norc -eo pipefail {0}` form only applies when the workflow **explicitly**
  declares `shell: bash`, which the step below did not. The "confirmed locally" probe above was
  circular: it called `set -o pipefail` itself before testing whether pipefail was already on,
  so it could only ever report `1` — it proved nothing about the actual default. Net effect as
  originally written: `calibration.yml`'s piped step would have reported **GREEN on a real §3.9
  band failure**, on an unwatched weekly cron. **Fix:** `shell: bash` added explicitly to that one
  step in `.github/workflows/calibration.yml`. Non-circular proof (GH's real default vs. the fixed
  form, using a stub that exits 1, no calibration-band mutation involved) is in §7 below. Commit
  `<fix-round-1 SHA>`.

---

## 2. The dgp.test.ts timeout fix — root cause and evidence

**Root cause.** `tests/engine/dgp.test.ts`'s `describe('generateDataset — structural ranges (200
seeds)', ...)` block has four `it`s, each running `generateDataset` (Cholesky factorisation + a
400-row draw) 200 times in a loop — real, correct work, not a hang. Solo timing: **1.7-2.0s each**.
Reproduced the flake directly, twice, before touching anything:

```
✓ ... age is always within [22, 70] 2024ms
✓ ... Y4 (satisfaction) is always within [1, 10] 1966ms
✓ ... Y3 (count) is always a non-negative integer 1879ms
× ... experience is always 0, 1, or 2; urban and x are always 0 or 1 5150ms
  → Test timed out in 5000ms.
```

Under a full parallel `vitest run` (52-53 files racing for CPU on this dev box), the same tests
were observed at **4014-4795ms** — right at the 5000ms default `testTimeout` edge, one run tipping
over into a false-negative failure with zero relation to a real assertion. All four tests in the
describe share the identical 200-seed sweep shape, so all four share the same risk profile — fixing
only the one that happened to fail in a given run would just move the flake to a sibling on a
slower CI runner.

**Fix (test-level option, per STEP 0's stated preference).** Raised the whole describe block's
default timeout to 20s via vitest's `describe(name, { timeout: 20_000 }, fn)` overload (`SuiteOptions`
extends `TestOptions`, confirmed against `@vitest/runner`'s own `.d.ts`), with an explanatory comment
in the diff:

```diff
+// T24 CI finalize: each `it` below drives `generateDataset` (Cholesky
+// factorisation + 400-row draw) 200 times, once per seed — real work, not a
+// hang, and it is exactly this suite's own point (§3.1's structural
+// guarantees, swept over enough seeds to trust). Measured 1.7-2.0s per test
+// solo, but under a FULL parallel `vitest run` (52 files racing for CPU) it
+// was observed crossing vitest's 5000ms default `testTimeout` and failing as
+// a false-negative flake — never a real assertion failure. Every test in
+// this describe does the identical 200-seed sweep, so all four share the
+// same risk profile; a generous 20s ceiling (~4x the worst solo time, ~4x
+// the worst observed contended time) keeps this a real timeout guard rather
+// than a coin flip, without weakening or skipping any assertion.
 describe('generateDataset — structural ranges (200 seeds)', { timeout: 20_000 }, () => {
```

**Zero assertions changed, removed, or skipped** — `git diff` confirms the only change is the
`describe(...)` signature and the comment above it. No sharding was used (not needed at this margin).

**5-consecutive-run evidence, twice over** (once pre-commit, once post-commit from a clean `npm ci`
on the committed lockfile):

| Run | Pre-commit | Post-commit (clean `npm ci`) |
|---|---|---|
| 1 | 53 files / 1494 tests passed — exit **0** | 1494 passed — exit **0** |
| 2 | 53 files / 1494 tests passed — exit **0** | 1494 passed — exit **0** |
| 3 | 53 files / 1494 tests passed — exit **0** | 1494 passed — exit **0** |
| 4 | 53 files / 1494 tests passed — exit **0** | 1494 passed — exit **0** |
| 5 | 53 files / 1494 tests passed — exit **0** | 1494 passed — exit **0** |

(1494 = the pre-existing 1492 + 2 new `epochGuard.test.ts` tests.) `grep -i "fail\|timeout\|error"`
across all 5 pre-commit run logs returned nothing. No test-isolation flags, `poolOptions`, or sharding
were added — the fix is exactly the timeout bump described above.

---

## 3. The EPOCH guard (`tests/game/epochGuard.test.ts`, new)

Imports `PUZZLE_ISO`/`PUZZLE_NUMBER` from `e2e/harness.ts` and `EPOCH` (plus `daysBetween`,
`puzzleNumber`) from `src/game/tuning.ts` / `src/game/daily.ts`. Two assertions:

1. `PUZZLE_ISO > EPOCH` as a bare lexicographic string compare (independent of `daysBetween`'s own
   implementation, so the guard doesn't test production code with itself).
2. `daysBetween(EPOCH, PUZZLE_ISO) > 0`, plus a consistency check that harness.ts's hand-written
   `PUZZLE_NUMBER` comment still matches `puzzleNumber(PUZZLE_ISO)` computed from the live `EPOCH`.

**Verified the failure fires loudly**, not just that it type-checks: temporarily edited
`src/game/tuning.ts`'s `EPOCH` from `'2026-08-10'` to `'2026-09-01'` (past `PUZZLE_ISO`'s
`'2026-08-14'`), ran the test, captured the real failure output below, then restored the file
byte-for-byte (`git diff --stat src/game/tuning.ts` showed nothing afterward):

```
× PUZZLE_ISO is strictly after EPOCH (bare-string compare, independent of daysBetween)
  → EPOCH GUARD FAILED: e2e/harness.ts's PUZZLE_ISO ('2026-08-14') is not strictly after
    src/game/tuning.ts's EPOCH ('2026-09-01'). daily.ts's isPractice() treats any real date
    before EPOCH as practice mode, which would silently degrade every e2e flow (hack/abandon/
    prereg/i18n) into practice mode: fresh Math.random() seeds, negative puzzle numbers, no
    persistence — and the suite would keep reporting green while testing nothing real.
    Fix: bump PUZZLE_ISO in e2e/harness.ts (and its PUZZLE_NUMBER/scenario comments) to a date
    strictly after the new EPOCH.
    expected false to be true

× daysBetween(EPOCH, PUZZLE_ISO) is positive, and matches harness.ts's own PUZZLE_NUMBER comment
  → EPOCH GUARD FAILED: daysBetween(EPOCH='2026-09-01', PUZZLE_ISO='2026-08-14') = -18, not > 0.
    This is the same arithmetic daily.ts's puzzleNumber()/isPractice() use in production, so a
    non-positive gap here means the e2e suite's fixed day IS the practice-mode boundary.
    expected -18 to be greater than 0

Test Files  1 failed (1)
Tests  2 failed (2)
```

Real, distinct dates named on both sides, the exact production mechanism explained, and a concrete
fix pointed at — this is the "readable message" STEP 0 asked for, not a bare assertion diff. At the
current, real `EPOCH = '2026-08-10'` / `PUZZLE_ISO = '2026-08-14'` both assertions pass (part of
every green run reported in §2 and §5).

---

## 4. Calibration — band summary

`npm run cal` (`scripts/simulate_calibration.ts`) already calls `process.exit(1)` the instant any
*asserted* §3.9 band misses (confirmed by reading the script — no fix was needed there, verified,
not assumed). Ran it three times across the session (once exploratory, once pre-commit, once
post-commit clean); all three identical (fully deterministic — no `Math.random`, no `Date.now`,
confirmed `src/data/p_hit_by_k.json` never changed in `git status` across any run):

```
id      target        measured    margin     verdict  what
-----------------------------------------------------------------------------------------------------
a       >= 0.99       1.0000      +0.0100    PASS     null-day hackability: P(sig paths >= 30) on the ACCEPTED day
b       [4, 12]       11.0000     +1.0000    PASS     greedy explorer: median paths to first hit (daily mix, P(effect)=25%)
c       [0.6, 0.85]   0.8260      +0.0240    PASS     effect-day canonical power @ N=400 (raw draw)
d       [0.75, 0.9]   0.8220      +0.0720    PASS     informed caller: family density >= 60% (weighted, P(effect)=25%)
e       <= 20         5.0000      +15.0000   PASS     rejection-loop attempts, p99
-----------------------------------------------------------------------------------------------------
CALIBRATION PASSED — all 5 §3.9 bands within target. (§8.3: the balance sheet balances.)
```

Exit code confirmed **0** every time, including through `npm run cal | tee calibration-report.txt`
(the exact pipeline `calibration.yml` runs) ~~via a `set -o pipefail` sanity probe~~ **[FIX ROUND
1: that probe was circular and proved nothing — see §1's correction and §7's non-circular proof.
Re-verified in fix round 1 under GitHub's real default shell AND under the now-fixed
`shell: bash` step, both against the real (unmutated) `npm run cal`.]**

---

## 5. Full gate, run in order, exit codes shown (post-commit, from clean `npm ci`)

```
rm -rf node_modules dist playwright-report test-results
npm ci                                  → exit 0  (EBADENGINE warning only, see §0)
npm run typecheck                       → exit 0
npm run lint                            → exit 0
npx vitest run   (x5 consecutive)       → exit 0, 0, 0, 0, 0   (1494/1494 every time)
npm run build                           → exit 0
CI=true npm run e2e                     → exit 0  (15/15, "15 passed (16.0s)")
npm run cal                             → exit 0  (5/5 bands PASS)
git status --porcelain                  → empty (working tree matches the committed SHA exactly
                                                   after every verification run, including the
                                                   deterministic p_hit_by_k.json regeneration)
```

YAML: all three workflow files parsed clean under both `python3 -c "import yaml; yaml.safe_load(...)"`
(PyYAML 6.0.3) and `npx js-yaml`. Both parsers report the top-level `on:` key as boolean `True` —
this is the well-known YAML-1.1 bareword quirk (`on`/`off`/`yes`/`no` parse as booleans under strict
YAML 1.1) that affects every unquoted `on:` in every GitHub Actions workflow ever written, including
the pre-existing `test.yml` this task extended; GitHub's own workflow parser special-cases it and it
was left as-is rather than "fixed" into a form that would look foreign next to every other workflow
in the wild.

---

## 6. Concerns

1. **`npx playwright install --with-deps chromium` could not be run as specified** — this sandbox has
   no passwordless sudo. I ran `npx playwright install chromium` (browser only) plus a `--dry-run`
   dependency check instead, and the full 15-test suite passed anyway. GitHub-hosted `ubuntu-latest`
   runners are not sandboxed this way and `--with-deps` will run as written in `e2e.yml` — but this
   means the exact `--with-deps` code path itself was not exercised end-to-end locally, only its
   effect (a working browser). Worth a first real PR/push to confirm on an actual runner, per the
   plan doc's own "push a no-op PR to verify all three workflows trigger green" step (T25's job, or
   whoever pushes first).
2. **jsdom EBADENGINE warning** (`node ^22.22.2 required, v22.22.1 current`) on every `npm install`/
   `npm ci` — non-fatal today (jsdom-based tests all pass), but worth a glance next time `.nvmrc` or
   `package.json` engines get touched; left alone here since T24 doesn't own either file's contents
   and the warning does not affect any exit code.
3. **Calibration's weekly cadence means a real regression could sit undetected for up to ~7 days**
   between the offending merge and the next Monday 06:00 UTC run — inherent to "weekly cron" as
   specified, not a defect, but `workflow_dispatch` is there precisely so a suspicious tuning change
   can be checked on demand before waiting for the schedule.
4. **This report and the commit are both local to the worktree/branch** — nothing was pushed, per
   instruction. `git log -1`: `65c91dd chore: CI — unit, e2e, weekly statistical calibration (T24)`,
   clean working tree, branch `task-t24` unchanged otherwise from `fb90c9e`'s tree plus this one commit.
   **(Superseded by fix round 1 below — see §7.)**

---

## 7. FIX ROUND 1 — the pipefail bug, correction, and non-circular proof

**What was wrong.** §1 and §4 of this report, as originally written, claimed "GitHub Actions'
default `run:` shell on Linux is `bash --noprofile --norc -eo pipefail {0}`" and used that to argue
`calibration.yml`'s `npm run cal | tee calibration-report.txt` step needed no `shell:` declaration.
**That claim was false.** The "confirmed locally" probe backing it —
`bash -c 'set -o pipefail; (exit 1) | tee f; echo $?'` → `1` — was circular: it turned `pipefail` on
itself, inside the same command, before "testing" whether it was already on. It could only ever
print `1`; it never tested GitHub's actual default. Both false claims are struck through in place in
§1 and §4 above, not deleted, per the evidence-integrity standard.

**The real default, verified two independent ways this round:**

1. **Documentation** (GitHub's own workflow-syntax reference, fetched fresh this round):
   > When `shell:` is **not** specified (unspecified default): `"bash -e {0}"`
   > When `shell: bash` **is** explicitly specified: `"bash --noprofile --norc -eo pipefail {0}"`

   i.e. the explicit form adds `--noprofile`, `--norc`, **and `pipefail`** — none of which are
   present in the unspecified default. `calibration.yml`'s piped step had no `shell:` key, so it was
   running under plain `bash -e`, with no `pipefail`.

2. **Non-circular local reproduction**, using a stub that exits 1 (never by touching the real §3.9
   calibration bands), run both ways:

   ```
   ==========================================================
   REPRO 1: GitHub Actions' ACTUAL default (no shell: declared)
            = bash -e {0}   (NO pipefail)
   ==========================================================
   $ bash -e -c '
   npm_cal_stub_that_exits_1() {
     echo "simulating scripts/simulate_calibration.ts: CALIBRATION FAILED — 1 band(s) out of target: e"
     return 1
   }
   npm_cal_stub_that_exits_1 | tee calibration-report-default.txt
   echo "line AFTER the piped step still ran (proves -e did not fire): yes"
   '
   simulating scripts/simulate_calibration.ts: CALIBRATION FAILED — 1 band(s) out of target: e
   line AFTER the piped step still ran (proves -e did not fire): yes
   >>> bash -e process exit code (what GH Actions would see as the STEP's result): 0

   ==========================================================
   REPRO 2: with shell: bash EXPLICITLY declared
            = bash --noprofile --norc -eo pipefail {0}
   ==========================================================
   $ bash --noprofile --norc -eo pipefail -c '
   npm_cal_stub_that_exits_1() {
     echo "simulating scripts/simulate_calibration.ts: CALIBRATION FAILED — 1 band(s) out of target: e"
     return 1
   }
   npm_cal_stub_that_exits_1 | tee calibration-report-fixed.txt
   echo "line AFTER the piped step: should NOT print, because -e aborts the script here"
   '
   simulating scripts/simulate_calibration.ts: CALIBRATION FAILED — 1 band(s) out of target: e
   >>> bash --noprofile --norc -eo pipefail process exit code (what GH Actions sees with shell: bash): 1
   ```

   Repro 1 reproduces the bug exactly as it would have manifested in production: a failing
   `npm run cal` piped into `tee`, under GitHub's real unspecified-shell default, reports **exit 0**
   — green — on a genuine band failure. Repro 2, under the exact string GitHub uses when
   `shell: bash` is declared, reports **exit 1** on the identical failing stub.

**The fix** — minimal, targeted, on the one piped step only (not a workflow-level `defaults:`, which
would subtly change `-e` semantics on every other step too):

```diff
       # scripts/simulate_calibration.ts exits non-zero (process.exit(1)) the
-      # moment any ASSERTED §3.9 band misses; GitHub Actions' default bash
-      # `run:` shell already sets `-o pipefail`, so that exit code survives
-      # the `tee` below instead of being swallowed by it.
+      # moment any ASSERTED §3.9 band misses. That exit code must survive the
+      # `tee` below, or a real band failure reports GREEN on this unwatched
+      # weekly cron. GitHub Actions' UNSPECIFIED default shell is plain
+      # `bash -e {0}` — NO `pipefail` — so without an explicit `shell:` here
+      # `npm run cal | tee ...` would silently swallow a non-zero `npm run
+      # cal` behind `tee`'s own (near-always-zero) exit code. `pipefail` is
+      # only added when `shell: bash` is declared explicitly (GitHub's own
+      # workflow-syntax docs: unspecified = `bash -e {0}`, explicit `bash` =
+      # `bash --noprofile --norc -eo pipefail {0}`), so it is declared here.
       - name: calibration (5 bands, 500 null + 500 effect synthetic days)
+        shell: bash
         run: npm run cal | tee calibration-report.txt
```

`test.yml` and `e2e.yml` were checked too: `grep -n "run:"` on both shows no other step pipes one
command into another (`npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
`npx playwright install --with-deps chromium`, `npm run e2e` — all single commands, no `|`), so
neither has this exposure and neither was touched.

**Re-verification after the fix:**

- **YAML** — all three workflow files re-parsed clean under both PyYAML and js-yaml (calibration.yml
  now additionally carries a valid `shell: bash` key on one step).
- **`npm run cal`, the real script, unmutated** — re-run twice: once plain (exit `0`, all 5 bands
  PASS, identical to the earlier run: a=1.0000, b=11.0000, c=0.8260, d=0.8220, e=5.0000), and once
  through the *exact* fixed invocation `bash --noprofile --norc -eo pipefail -c 'npm run cal | tee
  calibration-report.txt'` — also exit `0`, same 5/5 PASS, proving the fix does not disturb a
  passing run.
- **Full local gate, re-run once more** (this round only touched `calibration.yml`, so the 5x
  vitest proof from round 0 for the dgp fix was not re-run — that fix is untouched this round):
  `npm run typecheck` → 0, `npm run lint` → 0, `npx vitest run` → 0 (53 files / 1494 tests), `npm run
  build` → 0. `git status --porcelain` clean before commit except the one intended diff
  (`.github/workflows/calibration.yml`).

**New commit:** `cf3d3fda338b920c6a0a423a99c10ee691606682` on `task-t24`, on top of `65c91dd`. Not pushed.
