# Task T7 Report — analyze.ts (single-spec analysis pipeline)

Status: **DONE**

Branch `worktree-agent-ae4cfc188f114dc2d`, final HEAD `92f72aa`. Working tree
clean; full gate green on the committed state (re-verified after both
commits, output pasted below).

## Step 0 — worktree setup

```
$ pwd
/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-ae4cfc188f114dc2d
$ git log --oneline -5   # before reset
60c4787 Plan pre-flight fixes: engine-side seeds, protocol types in T1, tuning import exception, wave 1a/1b split
f54da1b Add v1 implementation plan: 27 tasks in 5 dependency waves for parallel agents
...
$ git reset --hard 1137c75
HEAD está ahora en 1137c75 chore: exclude agent worktrees and SDD scratch from vitest glob
$ ls src/engine/
dgp.ts  dgpConstants.ts  prng.ts  protocol.ts  seeds.ts  stats.ts  types.ts
```
Both dependencies (`stats.ts`, `dgp.ts`) present and merged (`git log` showed
`Merge T2`/`Merge T3` ancestors of `1137c75`).

```
$ node --version   # (PATH="/usr/bin:$PATH")
v22.22.1
$ npm ci
npm WARN EBADENGINE ... (jsdom wants >=22.22.2 — pre-existing, harmless)
added 250 packages, and audited 251 packages in 1s
found 0 vulnerabilities
```

## Requirements read

Brief (`task-T7-brief.md`), master spec §3.4 (analysis engine), §3.5
(transforms), §6 (core interfaces — `Spec`, `PathResult`) — the only three
sections authorized. Consumed (read, not modified): `src/engine/stats.ts`
(`ols`, `tTwoTailedP`, `zScores`, `meanSd`), `src/engine/dgp.ts` (`Dataset`,
`generateDataset`), `src/engine/types.ts` (`Spec`, `PathResult`, `WindowN`,
`Outcome`), `src/game/tuning.ts` (`MIN_CELL = 30`). Also read T2/T3's reports
and fixture scripts for house style (fixture JSON shape, `relErr` helper,
commit-splitting convention: a `test:` commit with just the fixture
script+JSON, then a `feat:` commit with both the implementation and its test
file together).

## Design decisions worth flagging

1. **`PathResult.valid` vs. the underlying numbers.** The brief states
   `valid=false when post-exclusion count < MIN_CELL or OLS reports invalid`
   but also `excludedCount always populated`. I read this as: `runSpec`
   always runs the *full* pipeline through OLS (whenever OLS itself can
   produce a number, i.e. `df>0` and non-singular), and `valid` is purely a
   *flag* on top of real, computed `beta/se/t/p/ci` — not a signal to zero
   them out. This matters concretely for the micro12 fixture: with only 12
   rows and `MIN_CELL=30`, **every** spec is invalid by construction (12 can
   never reach 30), yet 5 of the 6 specs still produce real, hand-checkable
   OLS statistics (only spec F hits the *other* invalidity fork, `df=0`,
   where `ols()` itself returns the zeroed placeholder). This reading is what
   makes a 12-row fixture usable at all for checking the actual arithmetic
   pipeline; happy to be corrected if a reviewer intended `valid=false`
   specs to be zeroed out instead — the fixture pins the "carries real
   numbers" reading explicitly (5 of 6 specs have nonzero beta/se/t).
2. **CI is bonus-verified, not brief-required, in the fixture.** The brief's
   fixture spec says "pins beta/se/t/p/excludedCount/valid at 12 decimals" —
   `ci` isn't in that list (the CI-specific check is the separate 50-random-
   spec property test). I computed and pinned `ci` in `micro12.json` anyway
   as an extra cross-check, using the *same* 20-iteration/`[0,100]`-bracket
   bisection algorithm in Python that `analyze.ts` uses in TS (rather than
   `scipy.stats.t.ppf`), so the comparison is bound by the already-validated
   `tTwoTailedP`-vs-scipy agreement (~1e-10 relative, per T2) rather than by
   an unrelated "bisection vs. exact ppf" precision gap.
3. **`applyTransform`'s `raw` branch returns a copy, not the same reference.**
   Not specified either way by the brief; I chose defensive copying (cheap at
   n≤400) so callers can never accidentally observe a mutation of their own
   array through the transform's output. Verified with a direct test
   (mutate the output, assert the input is untouched).
4. **The micro12 dataset's `x=1` rows are all lower-`y` by construction** —
   an accident of how I assigned the "outlier" values while designing the
   z-order-proof case (spec A), not a deliberate choice. All 6 fixture specs
   therefore have `t<=0`. The brief's "one-tailed sign rule both directions"
   requirement still needed a genuine `t>0` case, so I added one directly in
   `analyze.test.ts` (not from the JSON): an exact algebraic mirror of spec A
   with `y` negated (negating `y` negates `beta`/`t` but leaves `se`/`p2`
   unchanged, since residuals negate too and RSS is a sum of squares) —
   `beta=+0.25` exactly, `t>0`, `p1=p2/2` checked against the *same* p2 as
   spec A's fixture-pinned value.

## TDD evidence

**RED** (`analyze.test.ts` written against the not-yet-existing module):
```
$ npx vitest run tests/engine/analyze.test.ts
 RUN  v4.1.10 ...
 ❯ tests/engine/analyze.test.ts (0 test)
 FAIL  tests/engine/analyze.test.ts [ tests/engine/analyze.test.ts ]
Error: Cannot find module '../../src/engine/analyze' imported from .../tests/engine/analyze.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** after implementing `src/engine/analyze.ts` (first attempt, no
iteration needed on the test file itself):
```
$ npx vitest run tests/engine/analyze.test.ts
 Test Files  1 passed (1)
      Tests  31 passed (31)
```

**Full gate**, run after both commits on the final tree:
```
$ npx vitest run
 Test Files  9 passed (9)
      Tests  169 passed (169)          # 138 pre-existing + 31 new
$ npx tsc --noEmit                     # exit 0, no output
$ npm run lint                          # exit 0, no output
$ npm run build
✓ 16 modules transformed, built in 71ms
$ git status --short                    # (empty — clean)
```

## Fixture generation (`scripts/gen_analyze_fixtures.py`)

```
$ uv run --with numpy,scipy python scripts/gen_analyze_fixtures.py
Wrote 6 specs to .../tests/engine/fixtures/micro12.json
  A_urban_z2_raw_order_proof: n=5 excluded=1 valid=False beta=-0.25 se=0.083333333333 t=-3.0 p=0.057668885622 ci=[-0.515204906464, 0.015204906464]
  B_all_log1p_shifted_income: n=12 excluded=0 valid=False beta=-1.057712273305 se=0.449788175209 t=-2.351578657693 p=0.043193232401 ci=[-2.075206514071, -0.040218032539]
  C_urban_log1p_unshifted: n=6 excluded=0 valid=False beta=-0.098570673357 se=0.076104681082 t=-1.295198560133 p=0.264947808211 ci=[-0.30987377706, 0.112732430346]
  D_age_ge40_z2_5_risk_onetail: n=5 excluded=0 valid=False beta=-16.311392405063 se=7.739189989193 t=-2.107635608874 p=0.915193801926 ci=[-49.61037742355, 16.987592613423]
  E_exp_high_z3_log1p_outcome1: n=4 excluded=0 valid=False beta=-0.124063357845 se=0.05660905407 t=-2.191581539087 p=0.15975400359 ci=[-0.367632005988, 0.119505290298]
  F_exp_low_both_covs_df0_onetail: n=4 excluded=0 valid=False beta=0.0 se=0.0 t=0.0 p=1.0 ci=[0.0, 0.0]
```

12-row hand-checkable dataset (indices 0-11), 6 specs, each chosen to *prove*
a specific pinned rule rather than just add coverage:

- **A** (`urban`, `z2`, `raw`, no covariates, two-tailed) — **z-exclusion
  order proof**. Urban rows (0-5) are `y0=[10,10.2,9.8,10.1,9.9,13]`. Within
  the urban-only sample (mean≈10.5, sd≈1.233), row 5 (`y=13`) has `z≈2.03` →
  excluded under `z2`. I hand-verified `beta=-0.25` exactly (this reduces to
  a two-group mean difference for a 0/1 regressor: kept-urban mean(x=1)=9.9,
  mean(x=0)=10.15) and `se=1/12=0.08333...`, `t=-3.0` exactly — all matching
  the numpy output bit-for-bit at the displayed precision. Computed the
  *wrong* way — z-scoring the full 12-row window first (mean≈8.17, sd≈9.74,
  because rural rows include wide/negative values that inflate the pooled
  sd) — row 5's z is only ≈0.50, which would **not** trip `z2`. A same-spec
  "wrong order" implementation would report `n=6, excludedCount=0` instead
  of the fixture's pinned `n=5, excludedCount=1`.
- **B** (`all`, `log1p`, income covariate, two-tailed) — **shift-when-
  negative**. Filtered sample = full window (`subgroup=all`), whose min is
  `-10` (row 10) → shift by `10`, i.e. `log(11+y)`.
- **C** (`urban`, `log1p`, no covariates, two-tailed) — **shift's other
  half**. Urban's own min is `9.8` (>0) → unshifted, `log(1+y)`. Contrasts
  directly with B on the same underlying `y0` column.
- **D** (`age_ge40`, `z2_5`, risk covariate, one-tailed) — different
  subgroup/exclusion/covariate mix; `t≈-2.11` (t≤0 branch of the one-tailed
  rule).
- **E** (`exp_high`, `z3`, `log1p`, two-tailed, **outcome index 1** —
  `y1=y0+100`) — exercises `Spec.outcome` selection with a distinct subgroup;
  unshifted log1p again (all `y1` values ≥90).
- **F** (`exp_low`, `z=none`, income+risk covariates, one-tailed) — 4 rows,
  4 predictors (intercept+x+income+risk) → **df=0**: `ols()`'s own
  `df<=0` guard fires, so this exercises the *"OLS reports invalid"* fork of
  `PathResult.valid` directly, distinct from the *"below MIN_CELL"* fork
  that all six specs also hit.

A precision-floor check (mirroring T2's "precision trap" lesson) asserts no
non-degenerate `p` is within `1e-6` of zero before writing the JSON — all six
came out comfortably inside safe range (`0.043` to `0.915`, plus F's exact
placeholder `1.0`), so no reseeding/redesign was needed.

## Implemented

**`src/engine/analyze.ts`** — three exports, signatures exactly as briefed:

- `subgroupMask(d, s, n)`: `Uint8Array` over the window prefix `n`
  (`age_lt40=age<40`, `age_ge40=age>=40`, `exp_high=experience===2`,
  `exp_low=experience===0`, `urban=urban===1`, `rural=urban===0`,
  `all`=everyone). Scoped strictly to `n` — never reads or reports on rows
  past it (tested directly).
- `applyTransform(y, t)`: `raw` returns an independent copy; `log1p` =
  `log(1 + y - min(0, min(y)))`, shifting only when `y`'s own minimum is
  negative (an exactly-zero minimum is *not* negative, so it's left
  unshifted — tested as its own boundary case).
- `runSpec(d, spec, n)`: `subgroupMask` → gather `d.y[spec.outcome]` at the
  filtered indices → `applyTransform` → outlier exclusion (`stats.ts`'s
  `zScores` on the *transformed* outcome, computed *within the filtered
  sample* — thresholds `none`/`|z|>3`/`|z|>2.5`/`|z|>2`, keep iff
  `|z|<=threshold`) → build `[1, x, log(income)?, risk?]` in that column
  order → `ols()` → `p` via `tTwoTailedP` for two-tailed, or the pinned
  `t>0 ? p2/2 : 1-p2/2` for one-tailed → CI via `beta±tCrit·se`, `tCrit`
  solving `tTwoTailedP(t,df)=0.05` by 20-iteration bisection on `[0,100]`.
  `valid = fit.valid && finalN >= MIN_CELL` (`MIN_CELL` from
  `src/game/tuning.ts`, the one sanctioned game import).

Determinism: grepped the file directly — only `Math.min`, `Math.log`,
`Math.abs` appear (no `Math.pow`, `Math.random`, `Date.now`, `new Date`);
`eslint .` (which enforces the engine-purity import restriction and the
`Math.random`/`Date.now`/`new Date` bans for `src/engine/**`) passes clean.

## Tested + results

31 new tests, all against real computed values (numpy/scipy fixtures,
hand-derived closed-form values, or algebraic identities) — no mocking:

- **subgroupMask**: all 7 subgroup values against hand-derived membership
  arrays for the micro12 dataset (independent of the Python fixture — these
  are boolean-array literals I derived by inspection of the `age`/`urban`/
  `experience` columns), plus a window-scoping test (`n=6` on a 12-row
  dataset returns a length-6 mask, not length-12-with-trailing-zeros).
- **applyTransform**: `raw` non-aliasing; `log1p` shifted (`min=-1`),
  unshifted (`min=4`), unshifted-at-exactly-zero (`min=0`, the "0 is not
  negative" boundary), and empty-input (no throw).
- **runSpec — micro12 fixture**: all 6 specs, `n`/`excludedCount`/`valid`
  exact, `beta`/`se`/`t`/`p`/`ci` within `1e-9` relative.
- **z-exclusion order proof**: spec A's `n=5`/`excludedCount=1`/`beta=-0.25`
  plus a standalone computation showing the full-window z-score for row 5
  is `<2` (i.e., would *not* have been excluded under the wrong order).
- **shift-only-when-negative**: spec B (shifted) and spec C (unshifted),
  plus the dedicated `applyTransform` boundary tests above.
- **one-tailed sign rule, both directions**: spec D (`t≤0`, checked against
  an independently-recomputed `p2` via `tTwoTailedP`, formula `1-p2/2`
  verified) and the y-negated urban mirror of spec A (`t>0`, `beta=+0.25`
  exactly, formula `p2/2` verified against the *same* two-tailed run).
- **insufficient data**: all 6 micro12 specs assert `valid===false`; spec F
  specifically asserts the `df=0` placeholder (`beta=se=t=0`, `p=1`,
  `ci=[0,0]`); a dedicated MIN_CELL boundary test builds one 30-row
  synthetic dataset (alternating `x`, small deterministic ±0.1 wiggle on `y`
  so residual variance is nonzero — avoids a degenerate perfect-fit/`se=0`
  edge) and runs it at window `n=30` (`valid=true`) and `n=29` (`valid=false`,
  same data, one row shorter via the window parameter alone).
- **all-excluded subgroup**: a 5-row synthetic dataset with zero `urban=1`
  rows, spec'd with `subgroup='urban'` and `exclusion='z2'` (so `zScores` is
  actually invoked on a zero-length array) — asserts `n=0`, no throw, no
  `NaN`, and the same zeroed placeholder contract as the `df<=0` case.
- **CI property**: 50 deterministically-enumerated specs (mixed-radix
  decomposition over outcome×subgroup×income×risk×exclusion×transform×
  tails×window, stride 137 — no `Math.random`, fully reproducible) over
  `generateDataset(7, null)`. For every spec: `ci` brackets `beta`; and,
  whenever the implied `df=n-p>0`, `ci` excludes 0 iff an independently
  recomputed two-tailed `p2` (via `tTwoTailedP`) is `<0.05` (the `df<=0`
  branch is guarded separately, asserting the `[0,0]`/`valid=false`
  placeholder directly instead — computing `tTwoTailedP(0,0)` there would be
  `NaN`, since `x=df/(df+t²)=0/0` in that exact corner).

## Files changed

- `scripts/gen_analyze_fixtures.py` (new)
- `tests/engine/fixtures/micro12.json` (new, generated)
- `src/engine/analyze.ts` (new)
- `tests/engine/analyze.test.ts` (new)

## Commits

1. `9fb1850` `test: add hand-checkable micro12 fixtures for single-spec analysis pipeline`
2. `92f72aa` `feat: single-spec analysis pipeline (filter→transform→exclude→OLS→p)`

## Self-review

**Completeness.** All three brief-specified exports exist with the exact
signatures given: `subgroupMask`, `applyTransform`, `runSpec`. Every RED-step
bullet is covered: fixture tolerances (1e-9), z-exclusion order proof (spec
A + explicit contrasting computation), shift-only-when-negative (specs B/C
+ direct boundary tests), one-tailed sign rule both directions (spec D +
negated-mirror), CI property (50 specs, `generateDataset(7)`),
insufficient-data specs (all 6, plus the dedicated `df=0` and MIN_CELL=30/29
boundary cases). The three self-review edge cases the brief calls out by
name are each covered by a specifically-labeled test: all-excluded subgroup
(`describe('runSpec — all-excluded subgroup ...')`), n exactly 30/29
(`'MIN_CELL boundary: n=30 is valid, n=29 ... is not'`), transform on an
all-positive outcome unshifted (spec C, plus the direct `applyTransform`
tests).

**Quality.** Determinism verified directly (grep for `Math.pow`/
`Math.random`/`Date.now`/`new Date` in `analyze.ts`: none found; only
`Math.min`/`Math.log`/`Math.abs` appear) and by the ESLint engine-purity
rules passing clean (import restriction to `src/engine/**` + `src/game/
tuning`, `Math.random`/`Date.now`/`new Date` bans). Every non-obvious design
choice has an inline comment explaining *why* (the `valid`-vs-real-numbers
contract, the window-prefix scoping, the "filtered sample's own minimum, not
some larger window's" shift rule, the bisection's search-direction logic).

**Discipline (YAGNI).** No speculative exports beyond the brief's three; no
defensive clamping of `n` against dataset array length beyond what the
documented contract (`n <= array length`, guaranteed by real callers via
`WindowN<=400=Dataset`'s fixed size) requires — my own test-only synthetic
datasets respect that same contract rather than the implementation adding
untested guard code for a case that can't occur with a real `Dataset`. The
`ci` bonus-verification in the Python fixture was a deliberate addition
(cheap, strengthens the cross-check) rather than scope creep — flagged
explicitly above rather than silently bundled in.

**Testing.** 31 new tests, all asserting real computed values — scipy/numpy
fixtures, hand-derived closed-form values (spec A's `beta=-0.25`/`se=1/12`/
`t=-3.0` hand-verified independently of the Python pipeline, in this
report), or algebraic identities (the y-negation mirror). `npx vitest run`
output is pristine (169/169); `npm run lint`/`tsc --noEmit` produce zero
output on the real tree.

## Concerns

None blocking. Two things worth a second pair of eyes:

1. **The `valid`-flag reading (design decision #1 above)**: I read
   `PathResult` as always carrying the real computed statistics, with
   `valid` as a pure display-gating flag, rather than "invalid results are
   zeroed." This is the only reading that makes a 12-row hand-checkable
   fixture possible at all (with `MIN_CELL=30`, *every* spec on a 12-row
   dataset is invalid by construction), and I believe it's also what §3.4's
   "renders 'insufficient data' [in the UI]" phrasing implies (a rendering
   concern, not a data-integrity one) — but it's a judgment call on an
   ambiguity in the brief, not something pinned verbatim, so flagging for
   explicit confirmation.
2. **Minor: a commit-message formatting slip.** The `feat:` commit
   (`92f72aa`) body has one orphaned line (`  covariates.`) left over from
   an editing pass on the "Tested" bullet list — a cosmetic typo in the
   message text only, no code/content impact. Per this repo's explicit
   no-amend policy I did not rewrite the commit to fix it; disclosing it
   here instead of silently leaving it unmentioned.

No other deviations from the brief's pinned semantics that I'm aware of.
