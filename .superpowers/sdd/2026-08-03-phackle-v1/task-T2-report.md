# Task T2 Report — stats.ts (OLS, t-distribution, z-scores)

Status: **DONE**

This report has two parts: (1) the original NEEDS_CONTEXT findings from the
first run (below, unedited — the worktree was stale, matching what
`progress.md` already suspected), and (2) the resumption after the
coordinator fixed the environment, which covers the actual implementation.
Jump to "## Resumption" for the real work; the section below is preserved
for the record.

## Summary

Read the T2 brief (`task-T2-brief.md`) and the required master-spec sections
would have been next (§3.4, §8.1, Appendix A), but stopped at the mandatory
first step (`npm ci`) because this worktree's checked-out branch does not
contain the toolchain or the T1 deliverables the brief says already exist.
No source files were created, no code was written, nothing was implemented.

## The contradiction (tree vs. brief/context)

The task context states: *"Task T1 already provides (consume, don't
recreate): `src/engine/prng.ts` ..., `src/engine/types.ts` ...,
`src/game/tuning.ts` ..."* and *"First step: `npm ci`"*.

The actual state of this worktree (`worktree-agent-a3ca594e6a8f8bae0`,
cwd `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a3ca594e6a8f8bae0`):

```
$ git rev-parse HEAD
60c4787349c25c7a0223d1ba4c03b92ef51e1f91
$ git branch --show-current
worktree-agent-a3ca594e6a8f8bae0
$ git ls-files
CLAUDE.md
LICENSE
README.md
docs/implementation_plan.md
docs/superpowers/plans/2026-08-03-phackle-v1.md
docs/superpowers/specs/2026-08-03-phackle-v1-design.md
```

No `package.json`, no `src/`, no `tests/` — this is the tree from **before**
the scaffold and T1 work landed. `git reflog` confirms it was placed here
deliberately (`60c4787 HEAD@{0}: reset: moving to HEAD`), not left over from
some in-progress operation.

`build/v1` (visible from this worktree; same object store) is 8 commits
ahead of my HEAD:

```
$ git merge-base build/v1 HEAD
60c4787349c25c7a0223d1ba4c03b92ef51e1f91   # == my HEAD — I'm sitting exactly at the fork point
$ git log build/v1 --oneline -8
4aa1df2 Plan: resolve T1 concerns — tailwind vite plugin ...
609ff89 chore: add CI workflow ...
c935adb feat: add game-side date and practice-mode utilities
b79872a feat: add tuning constants and seeded day/scenario/effect derivations
d344362 feat: add engine core types and worker protocol types
a385f35 feat: add deterministic PRNG primitives (splitmix32, fnv1a32, mulberry32, gaussPair)
38ec6b2 chore: scaffold Vite+React 19+TS toolchain with Tailwind 4 and Vitest
60c4787 Plan pre-flight fixes ...                                          # my HEAD
```

`.superpowers/sdd/2026-08-03-phackle-v1/progress.md` (shared coordination
ledger, read-only from here) confirms the *intended* base was already
`4aa1df2`: `"Task T2: dispatched (base 4aa1df2, sonnet, isolation:worktree)"`.
So the controller's own bookkeeping expected this worktree to be branched
from post-T1 `build/v1`; the worktree actually checked out is 8 commits
short of that. `git worktree list` also shows a sibling,
`worktree-agent-a63c5a5a4ce4b8570`, in the identical stale state
(`60c4787`), while a third, `worktree-agent-a20c6f3c430d10b69`, is correctly
at `4aa1df2` — so this looks like a dispatch-time race (worktrees created
before the T1 merge landed on `build/v1`) affecting at least two of the
three sibling tasks, not something specific to T2's brief.

All commits from `build/v1` (including `4aa1df2`) are present in the local
object store (same repo, shared `.git`) — this is a branch-ref problem, not
a missing-fetch problem. A `git reset --hard build/v1` from inside this
worktree would trivially fix it (my branch has zero unique commits — HEAD
*is* the fork point), but I did not do this: the dispatch instructions are
explicit — *"Never git push, never switch branches, never merge — the
controller integrates your worktree branch"* — and CLAUDE.md says *"flag
conflicts instead of silently deviating."* Rewriting my own branch ref
without being asked is exactly the kind of unrequested git surgery that
instruction set seems designed to prevent, especially given the controller's
ledger appears to have a mistaken belief about this worktree's actual state
that it should probably know about rather than have silently papered over.

## Side effect discovered while confirming the blocker (please read)

Running the brief's own first step, `npm ci`, from this worktree did **not**
fail as expected — it reported success (`added 250 packages`). Investigating
why: this worktree has no `package.json`, and npm's project-root resolution
walked *up* past this worktree's own `.git` (a worktree gitdir-pointer file,
not a directory — apparently not enough to stop the upward search) all the
way to the shared checkout `/home/carlos/PycharmProjects/phackle`, found
**its** `package.json`/`package-lock.json` (that checkout is on `build/v1`
at `4aa1df2`, post-scaffold), and installed/reinstalled `node_modules`
*there* instead of erroring out inside my isolated worktree:

```
$ stat --format='%n mtime=%y' /home/carlos/PycharmProjects/phackle/node_modules
.../node_modules mtime=2026-08-03 12:15:34   # matches when I ran npm ci
$ stat --format='%n mtime=%y' /home/carlos/PycharmProjects/phackle/package-lock.json
.../package-lock.json mtime=2026-08-03 10:59:47   # unchanged — lockfile itself untouched
```

Impact assessment: low. `npm ci` is a deterministic, lockfile-exact install;
no tracked file changed (`package-lock.json` mtime predates my command by
~75 min and its content is the committed one); `node_modules/` is gitignored
and not part of any task's deliverable. But it **is** an unintended
cross-boundary write outside my assigned isolation (I own only
`src/engine/stats.ts`, `scripts/gen_stat_fixtures.py`, and my
test/fixture files — not the shared checkout), and it's a trap for whichever
task owns the other stale worktree (`worktree-agent-a63c5a5a4ce4b8570`): the
worktree-isolation guard on this Bash tool blocks `git -C <shared-path>` /
`cd <shared-path> && git ...`, but does **not** block plain `npm`/`npx`
commands from silently escaping to the shared checkout via upward
package.json discovery when the worktree itself has none. I did not run
`npm ci` again, and ran no other build/test/lint commands, to avoid
compounding this. I'm flagging it rather than trying to "undo" it, since a
second `npm ci` against the shared checkout's own correct lockfile would
just reproduce the same deterministic `node_modules` and isn't obviously
better or worse than leaving it.

## What I did *not* do

- No source files created or modified (`src/engine/stats.ts` does not
  exist).
- No fixtures generated, no tests written.
- No git operations beyond read-only inspection (`log`, `status`,
  `worktree list`, `merge-base`, `reflog`, `ls-files`) — no reset, no
  rebase, no checkout, no branch changes.
- No further `npm`/`npx`/build/lint/test commands after discovering the
  cross-boundary `npm ci` side effect above.

## Requested remediation

Before T2 can proceed, this worktree's branch needs to actually contain
`build/v1`'s post-T1 state (matching what `progress.md` already believes is
true) — e.g. re-point/rebase `worktree-agent-a3ca594e6a8f8bae0` onto
`build/v1` @ `4aa1df2` (or later), or recreate the worktree. Worth checking
whether `worktree-agent-a63c5a5a4ce4b8570` (presumably another task) needs
the same fix.

## Concerns

1. **Blocking**: cannot start T2 until this worktree's base is corrected —
   `npm ci` cannot install this task's own toolchain (no `package.json` in
   the worktree), and `src/engine/prng.ts` / `types.ts` /
   `src/game/tuning.ts` do not exist here to consume.
2. A sibling worktree appears to have the same stale-base problem —
   flagging in case it affects another in-flight task, not just T2.
3. The `npm ci` upward-search escape (see above) is a real gap in the
   worktree-isolation guard that's only cosmetic today (idempotent,
   gitignored, no tracked-file drift) but could matter more if a future
   command in this situation weren't as side-effect-free as `npm ci`.

No code was written, so there is nothing to self-review for
completeness/quality/YAGNI/tests yet.

---

## Resumption

The coordinator confirmed the diagnosis (worktree forked at `build/v1`'s
fork point instead of its HEAD) and authorized `git reset --hard 4aa1df2`
in this worktree.

**A second environment wrinkle, found and resolved before implementation
could start:** the first `git reset --hard 4aa1df2` I ran landed on the
*shared checkout* (`/home/carlos/PycharmProjects/phackle`, branch `build/v1`,
already at `4aa1df2` — a harmless no-op there), not this worktree — my
session's default Bash cwd had silently drifted to the repo root.
Investigating with `EnterWorktree(path=...)` surfaced the real cause: this
worktree had been garbage-collected entirely (directory, `.git/worktrees/`
entry, and branch ref all gone — not just stale) because the harness reaps a
completed agent's worktree once it holds zero commits, which was exactly my
state at the end of the first (NEEDS_CONTEXT) run. The coordinator
reprovisioned the worktree at the same path/branch; `EnterWorktree(path=...)`
still couldn't re-attach a pinned agent from a non-worktree cwd, so from
then on every Bash call in this session explicitly `cd`s into
`/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a3ca594e6a8f8bae0`
first rather than relying on default cwd. Verified per the coordinator's
follow-up warning: `git status --short` in the worktree shows only my own
files; `git -C <shared checkout> status --short` shows only T3's
distinctly-named strays (`dgp.ts`, `dgpConstants.ts`, `dgp.test.ts`,
`scripts/gen_dgp_fixtures.py`, `tests/engine/fixtures/chol_fixture.json`) —
directory names (`scripts/`, `tests/engine/fixtures/`) coincide across the
two worktrees, but contents never did. No file of mine ever landed outside
this worktree.

With that resolved: `src/engine/prng.ts`, `src/engine/types.ts`,
`src/game/tuning.ts`, and `package.json` all present; `npm ci` installed
250 packages locally into the worktree (confirmed via `ls node_modules`
inside the worktree, not the shared checkout).

### Requirements read

`docs/implementation_plan.md` §3.4 (analysis engine — OLS pipeline, p-value
via regularized incomplete beta, one-tailed convention), §8.1 (engine unit
test requirements: golden fixtures, incomplete-beta table, DGP/pipeline
checks — only the OLS/t-CDF fixture bullet applies to T2), and Appendix A
(PRNG code already covered by T1; the t-distribution p-value formula
`p = I_{df/(df+t²)}(df/2,1/2)`; OLS via normal equations + Gauss elimination
with partial pivoting, `se = sqrt(σ̂²·[XᵀX]⁻¹_xx)`, `σ̂² = RSS/(n−p)`).
Read T1's `src/engine/types.ts` and `src/engine/prng.ts` for context/style
but `stats.ts` needed zero imports from either (or from anything) — it's a
self-contained pure-math module.

### Implemented

**`scripts/gen_stat_fixtures.py`** — numpy/scipy fixture generator (run via
`uv run --with numpy,scipy python scripts/gen_stat_fixtures.py`):

- 10 OLS cases: `n ∈ {31, 200, 400}` × `covariates ∈ {0, 1, 2}` (9 cases) plus
  one exactly-singular case (`n200_collinear`) where the covariate is
  `2.0 * x` derived from the *already-12-decimal-rounded* `x` — doubling a
  float64 is bit-for-bit exact (an exponent shift, no rounding), so after
  the JSON round-trip `cov[i] === 2*x[i]` exactly for all 200 rows (verified
  directly, 0 mismatches), making this an unambiguously singular `XᵀX` under
  any correct implementation rather than a "just barely collinear" case that
  would depend on pivoting-order specifics.
- Each fitted with `beta_full = (XᵀX)⁻¹Xᵀy`, `se` from `sqrt(σ̂²·diag((XᵀX)⁻¹))`,
  `t = beta/se`, `p = 2·scipy.stats.t.sf(|t|, df)` — independent of our own
  Gauss-Jordan/Lentz code (numpy's LAPACK solve/inv, scipy's own incomplete
  beta).
- Inputs are rounded to 12 decimals *before* fitting (not after), so the
  stored beta/se/t/p are fit to exactly the numbers a JSON reader sees.
- **A precision trap I found and fixed during generation, not after**: with
  the initially-chosen true effect size, several n=200/400 cases produced
  |t| in the teens-to-twenties, giving p-values that either rounded to a
  literal `0.0` at 12 decimal places or retained only ~1–6 significant
  figures — either of which makes a "1e-9 relative" check against the stored
  fixture meaningless (the fixture's *own* storage error would exceed the
  tolerance being tested, regardless of implementation correctness). Fixed
  two ways: (1) reduced the true-effect/noise ratio so |t| stays modest, and
  (2) added a small deterministic reseed loop (`make_case`, seeds
  `base+attempt` for `attempt` in `0..50`) that resamples until `|p| ≥ 1e-2`
  — 12 decimal places at that magnitude keeps ≥10 significant figures, a
  ~20x margin under the 1e-9 bound. Verified post-generation: all 9
  non-invalid cases have `0.018 ≤ p ≤ 0.972`.
- t-CDF table (df ∈ {10,50,200,398} × t ∈ {-5,-2.5,-1,0,1,1.96,2.5,5} = 32
  rows) deliberately stores **full float64 precision** for `p` (no rounding),
  not the OLS fixtures' 12-decimal-place convention: several entries
  (df=398, t=±5) are ~8.6e-7 in magnitude, where 12-decimal-place rounding
  would leave too few significant figures for the 1e-10 relative tolerance
  the brief requires there. `json.dump`'s default float formatting
  round-trips full precision, which is what that check actually needs.

**`src/engine/stats.ts`** (no imports — pure math, all seven brief-specified
exports, signatures verbatim):

- `meanSd`/`zScores`: straightforward mean/sample-sd (n−1)/z-score loops.
- `gammln` (internal, Lanczos approximation) / `betacf` / `regIncBeta` /
  `tTwoTailedP`: classic Numerical Recipes betacf/betai/gammln, transcribed
  for f64. Two of the canonical Lanczos coefficients as commonly printed
  (`-86.50532032941677`, `2.5066282746310005`) tripped ESLint's
  `no-loss-of-precision` — verified in `node` that the textbook-printed
  string and its "camel" round-trip form (`...78`, `...07`) parse to the
  *identical* double (`-86.50532032941677 === -86.50532032941678` →
  `true`), so I used the round-trip spelling: zero behavior change, no
  `eslint-disable` needed, and the source text now honestly matches what it
  evaluates to. `betacf`'s convergence threshold is tightened from the
  textbook's `EPS=3e-7` (tuned for 32-bit float) to `1e-15` (f64) — the
  brief warns not to quietly loosen a *fixture* tolerance if Lentz can't
  reach it, so I checked empirically (see Tested below) rather than
  guessing: worst-case relative error across all 32 t-CDF fixture rows is
  ~1.7e-12, about 60x inside the 1e-10 requirement. No tolerance needed
  loosening.
- `ols`: builds the `p×p` (`p = 2+covs.length ≤ 4`) `XᵀX`/`Xᵀy` normal
  equations, then Gauss-Jordan elimination with partial pivoting on the
  augmented `[XᵀX | I | Xᵀy]` matrix — one pass produces both `beta` (in the
  last column) and `[XᵀX]⁻¹` (in the middle block), because `se` needs the
  inverse's `(x,x)` entry, not just a solved `beta`; a plain solve wouldn't
  be enough. Returns `valid:false` (never throws) when `df=n−p≤0` (checked
  before doing any matrix work) or when a column's largest-magnitude
  candidate pivot is `< 1e-10`.

### TDD evidence

**RED** (`tests/engine/stats.test.ts` written against the not-yet-existing
module):
```
$ npx vitest run tests/engine/stats.test.ts
 ❯ tests/engine/stats.test.ts (0 test)
 FAIL  tests/engine/stats.test.ts [ tests/engine/stats.test.ts ]
Error: Cannot find module '../../src/engine/stats' imported from .../tests/engine/stats.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** after implementing `src/engine/stats.ts`:
```
$ npx vitest run tests/engine/stats.test.ts
 Test Files  1 passed (1)
      Tests  56 passed (56)
```
One genuine iteration inside GREEN, not a re-loosened tolerance: my own
extra "n=31 exact" test initially asserted 1e-11 (an arbitrary guess at
"much tighter than 1e-9"); the actual worst-case relative error came back
at 2.53e-11 (still 40x inside the required 1e-9). I measured all three
n=31 cases directly (via a throwaway diagnostic test, deleted afterward:
2.53e-11 / 2.09e-12 / 1.57e-12 for beta; similarly small for se/t) and
picked 1e-10 — still a real, evidence-based 10x-tighter-than-general bound,
with margin above the observed worst case, rather than a number chosen
before seeing any data.

Full gate, run repeatedly through development and once more on the final
committed tree:
```
$ npx vitest run          # 4 files, 90 tests, all passed (56 new + 34 from T1)
$ npx tsc --noEmit        # exit 0, no output
$ npm run lint            # exit 0, no output
$ npm run build           # ✓ 16 modules transformed, built in ~74ms
$ git status --short      # (empty — clean)
```

### Tested + results

- Every non-invalid OLS fixture (9 cases): `valid===true`, `df` exact, and
  `beta`/`se`/`t` each within 1e-9 relative of the numpy/scipy fit; the
  derived `p = tTwoTailedP(result.t, result.df)` within 1e-9 relative of
  scipy's `t.sf`-derived p.
- The flagged near-collinear fixture: `valid===false`.
- n=31 cases (the 3 with n=31): re-checked within 1e-10 relative (observed
  worst case 2.53e-11).
- `df≤0` (hand-built n=3, p=4 case): `valid===false`, no throw.
- Hand-computed OLS sanity case independent of the Python pipeline
  (x=[1..5], y=[2,4,5,4,5], chosen so every intermediate is a clean
  fraction): `beta=0.6`, `se=sqrt(0.08)`, `t=sqrt(4.5)`, `df=3` — all to 12
  decimal places.
- All 32 t-CDF table rows: within 1e-10 relative (measured worst case
  ~1.67e-12 — see "a precision trap" note above on why this table stores
  full float precision rather than 12 decimals).
- `tTwoTailedP` symmetry in `t` and `=1` at `t=0` for any `df`.
- `regIncBeta` edges (`x=0→0`, `x=1→1` for two representative `(a,b)`
  pairs), the symmetry identity `I_x(a,b) = 1-I_{1-x}(b,a)`, and the
  symmetric-beta midpoint `I_{0.5}(a,a)=0.5`.
- `betacf` direct sanity check (finite, positive) — its correctness is
  otherwise exercised heavily and indirectly through every `regIncBeta`/
  `tTwoTailedP` fixture check above.
- `meanSd`/`zScores` on `[1,2,3,4]` against hand-computed values
  (`mean=2.5`, `sd=sqrt(5/3)`, z-scores to 12 decimals), plus a
  shift/scale-invariance property test for `zScores`.

### Files changed

- `scripts/gen_stat_fixtures.py` (new)
- `tests/engine/fixtures/ols_fixtures.json` (new, generated)
- `tests/engine/fixtures/tcdf_fixtures.json` (new, generated)
- `src/engine/stats.ts` (new)
- `tests/engine/stats.test.ts` (new)

### Commits

1. `585ab4b` `test: add scipy-validated OLS and t-CDF fixtures for stats engine`
2. `3f5c7d1` `feat: deterministic OLS + t-distribution engine validated against scipy fixtures`

Branch `worktree-agent-a3ca594e6a8f8bae0`, final HEAD `3f5c7d1`. Working
tree clean; full gate green on the committed state (re-verified after both
commits, shown above).

### Self-review

**Completeness.** All seven brief-specified exports exist with the exact
signatures given: `OlsResult`, `ols`, `tTwoTailedP`, `betacf`, `regIncBeta`,
`meanSd`, `zScores`. Both fixture files exist with the exact schema asked
for (`{name, y, x, covs, beta, se, t, p, expect_invalid}` — `name` and
`expect_invalid` are the only additions beyond the brief's literal
`{y,x,covs,beta,se,t,p}` list, both directly implied by the brief's own
prose "one near-collinear case *flagged* `expect_invalid`" and needed for
readable test failures). Every RED-step bullet is covered: fixture
tolerances (1e-9 general, 1e-10 for n=31 and for the t-CDF table),
collinear-invalid, `regIncBeta` edges, `zScores` hand values, n=31
exactness.

**Quality.** Determinism constraints verified directly, not just assumed:
`grep` confirms zero occurrences of `Math.pow`, `Math.random`, `Date.now`,
`new Date` in `stats.ts`, and zero import statements (fully self-contained
pure math, so the engine-purity ESLint import rule is trivially satisfied).
Every non-obvious numerical decision has an inline comment explaining *why*
(the Lanczos round-trip-spelling fix, the tightened Lentz epsilon and its
empirical justification, the collinear case's exact-doubling derivation
order, the fixture precision-floor issue and its fix).

**Discipline (YAGNI).** `betacf`'s inverse-row extraction was simplified
mid-implementation to pull only the single matrix entry `se` actually needs
(`M[1][p+1]`) rather than materializing an unused full row. No speculative
exports, no dead code, no extra CLI flags on the fixture script beyond what
generation needs.

**Testing.** 56 new tests, all asserting real computed values (scipy
fixtures, hand-derived closed-form values, mathematical identities) — no
mocking, no tautologies (e.g., the `df≤0` and hand-computed-OLS tests exist
specifically because they exercise code paths / provide a ground truth the
Python-fixture pipeline alone wouldn't). `npx vitest run` output is
pristine; `npm run lint` produces zero output on the real tree.

### Concerns

None blocking. Two small things worth a second pair of eyes, both already
resolved with evidence rather than left open:

1. The Lanczos-coefficient lint fix (respelling `...77`→`...78` and
   `...05`→`...07`) is verified bit-identical in `node` (shown above,
   `===` true) but is nonetheless a textual deviation from the digits as
   commonly printed in Numerical Recipes references — flagging in case a
   reviewer wants to double-check that reasoning independently rather than
   just trusting the comment.
2. `betacf`'s `EPS`/`MAXIT` were tightened from the textbook's float-tuned
   defaults based on empirical measurement against the fixture table (worst
   observed relative error ~1.7e-12 for t-CDF, ~2.5e-11 for the tightest OLS
   check) rather than a formal error-bound derivation — comfortable margins
   under the required 1e-10/1e-9, but "empirically comfortable" rather than
   "provably always sufficient for any df/t this engine will ever see"
   (df up to 398 per the fixture table; the game's `nFull=400` with `p≤4`
   never exceeds that in practice).
