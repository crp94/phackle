# Task T3 report — dgp.ts (data-generating process)

Branch: `worktree-agent-a20c6f3c430d10b69`
Final commit: `ab73fc1eab093e900fc739dc9d24afcf113320d9`
Commits (2, in order):
1. `cac330f` — `chore: add DGP Cholesky/tertile-Z fixture generator (own script, T3)`
2. `ab73fc1` — `feat: deterministic DGP with heavy tails, confounded treatment, effect injection`

## Implemented

- `src/engine/dgpConstants.ts` — all DGP numeric constants, split into PINNED
  (master-spec-exact: AR(1) rho, covariate/treatment coefficients, the
  tertile-Z mathematical constant) and TUNABLE (outcome loadings, the
  shared-error-factor strength `RHO_SHARED`), each section clearly commented.
- `src/engine/dgp.ts`:
  - `buildAr1Matrix(rho, dim)` — builds `R[i][j] = rho^|i-j|` **multiplicatively**
    (never `Math.pow`, per the determinism constraint).
  - `cholesky(matrix)` — textbook Cholesky-Banachiewicz, allowed ops only
    (`+ − × ÷ sqrt`), computed once at module load into `CHOLESKY`.
  - `generateRows(seed, n, effect)` — the actual row-generation engine: one
    `mulberry32(seed)` stream, consumed in strict row order, 10
    `gaussPair()` calls (19 of 20 draws used; documented discard) per row for
    8 correlated latents + treatment noise + 4 outcomes' idiosyncratic noise
    + the shared-factor draw. Exported beyond the brief's pinned surface so
    the prefix property is directly testable.
  - `generateDataset(seed, effect)` — pinned public API, a thin
    `generateRows(seed, 400, effect)` wrapper.
  - Effect injection: all four `Y` generated fully at β=0 first; then, if
    `effect !== null`, `sd = meanAndSd(y[effect.outcome]).sd` (a local,
    private mean/sd helper — see "T2 dependency" below) and
    `d·sd·x[i]·multiplier` is added only to treated rows of the chosen
    outcome, `multiplier` = `HETERO_MULTIPLIER` only for rows both treated
    and inside the (caller-supplied) hetero subgroup.
- `scripts/gen_dgp_fixtures.py` — **T3's own** fixture script (uv run
  `--with numpy,scipy`), per the controller-approved deviation from the
  brief's "add gen to `gen_stat_fixtures.py`" (T2 owns that file; two
  parallel-dispatched agents writing the same file would collide). Builds
  `R`, its Cholesky factor, and `qnorm(2/3)` (scipy `norm.ppf`), writes
  `tests/engine/fixtures/chol_fixture.json`.
- `tests/engine/dgp.test.ts` — 24 tests (full list below).

## Two controller-reviewed deviations from a literal brief reading

Both were flagged proactively (before writing production code) via
`SendMessage` to the coordinator, with numerical evidence; both are now
folded into the regenerated brief.

### 1. Outcome-loading correlation band (mechanism overridden by controller)

Empirically (throwaway Node spike, deleted after use, per the TDD skill's
"explore first, then delete and start clean" guidance), the brief's
literally-printed outcome loadings — each outcome's noise fully
idiosyncratic — measured **mean pairwise corr(Yi,Yj) ≈ 0.072** over 200 fixed
seeds, well under the required `[0.15, 0.45]`. Root cause: each outcome's own
noise term dominates its shared-latent signal.

My first fix attempt shrank Y2/Y3/Y4's idiosyncratic noise scales (raising
signal-to-noise ratio). This hit the corr band but **collapsed marginal
character** — verified computationally: Y2's log-scale σ fell to ~0.14–0.16
(median skewness would have dropped well under 1), and Y3's tail either blew
out to unrealistic values (max 729 "trades/week" when growing L-loadings
instead) or thinned to ~2–3 distinct values (when shrinking noise instead).
I flagged this to the coordinator before implementing it in real files.

**Controller override**: shrinking idiosyncratic noise is forbidden. Required
mechanism instead — master §3.2's "correlated errors via a shared factor,"
made explicit in the regenerated brief:

```
eps_j = sqrt(1 - RHO_SHARED)*eta_j + sqrt(RHO_SHARED)*eta_shared
```

where `eta_1` is the `t5` draw (Y1), `eta_2..eta_4` are the plain `z` draws
(Y2..Y4), and `eta_shared ~ N(0,1)` is drawn once per row and reused across
all four `eps_j`. Because `eta_2..eta_4` and `eta_shared` are *all* exactly
`N(0,1)` and mutually independent, `eps_2..eps_4` are each exactly `N(0,1)`
too — Y2/Y3/Y4's marginal shapes are therefore **provably unchanged**; only
cross-outcome correlation rises. Y1's `eta_1` (t5, variance 5/3) isn't
variance-matched to `eta_shared`, so mixing does cost Y1 some
heavy-tailedness (t5's weight drops to `sqrt(1-RHO_SHARED)`).

Re-verified with the mandated mechanism at `RHO_SHARED = 0.3` (the suggested
starting value — no further tuning was needed):

| Criterion | Result | Band |
|---|---|---|
| median excess kurtosis(Y1), 200 seeds | 1.295 | > 1 |
| mean pairwise corr(Yi,Yj), 200 seeds | 0.286 (per-seed range [0.174, 0.356]) | [0.15, 0.45] |
| median skewness(Y2), 200 seeds (new guard) | 1.608 | > 0.8 |
| median distinct Y3 values/seed (new guard) | 9 | ≥ 6 |
| median max single-Y3-value frequency (new guard) | 0.372 | ≤ 0.5 |

All comfortable margins. The two new guard tests exist in `dgp.test.ts`
specifically so this class of regression (a future "fix" that quietly
collapses marginal character while chasing the corr band) can never land
silently again.

### 2. Effect-injection test (diff-in-diff, controller-approved)

The brief's literal criterion — raw `mean(Y1|X=1) − mean(Y1|X=0) ≈ 0.25·sd`
— is confounded **by design**: treatment `X` shares `L1`/`L4` with Y1's own
baseline (§3.2's intentional "adjustment matters" confounding). Empirically,
even at `d=0` there's a real ~0.14-sd baseline group difference from
confounding alone — comparable in size to the 0.25-sd injected effect itself.
A raw-difference test would need an awkwardly wide, empirically
reverse-engineered tolerance that mostly measures the confound, not the
injection.

Tested instead as a **same-seed diff-in-diff** against the null (`d=0`)
baseline. Since `y_with_effect[i] = y_null[i] + d·sd·x[i]` exactly (a constant
added only to `x[i]=1` rows, both datasets sharing identical baseline
generation for the same seed):

```
(mean(Y1|X=1) − mean(Y1|X=0))_effect − (mean(Y1|X=1) − mean(Y1|X=0))_null == d·sd
```

is an **exact algebraic identity** — verified to floating-point noise
(~1e-16) in the spike. Controller-approved with **tol 1e-12** (not raw
float-noise exactness), so the test stays robust to legitimate future
summation-order refactors while still being far tighter than any "within
noise" band. Applied consistently to the hetero-multiplier test too.

## Mid-task infrastructure incident (path trap) — found, fixed, verified

Partway through implementation, the coordinator flagged (and I independently
confirmed) that my file writes for this task had landed in the **main shared
checkout** (`/home/carlos/PycharmProjects/phackle/...`) instead of my
isolated worktree (`.../.claude/worktrees/agent-a20c6f3c430d10b69/...`) — a
sibling agent (T4) hit the same trap and self-diagnosed it first. All 5 new
files (`scripts/gen_dgp_fixtures.py`, `tests/engine/fixtures/chol_fixture.json`,
`tests/engine/dgp.test.ts`, `src/engine/dgp.ts`, `src/engine/dgpConstants.ts`)
were sitting untracked in main. Resolution:
1. Copied all 5 into the worktree at identical relative paths, verified
   byte-identical via `cmp` before touching the originals.
2. Removed the originals from the main checkout entirely (confirmed via
   plain `ls` — `git status` against the main checkout is correctly
   sandbox-blocked for a worktree-isolated agent, even read-only).
3. **Re-established genuine RED/GREEN inside the worktree** rather than
   trusting the earlier out-of-tree run: temporarily moved `dgp.ts` +
   `dgpConstants.ts` back out, reran `vitest` (confirmed a real
   "Cannot find module" failure, vitest's own banner showing the worktree
   path), restored both files, reran (24/24 green, same worktree-path
   banner).
4. Full gate (vitest/tsc/eslint/build) re-run and confirmed clean from the
   verified-correct location before committing.

Coordinator confirmed the main checkout was left with no trace of my files
before I proceeded to commit.

## Tested + results

Full test suite from the worktree: **58/58 pass** (24 new in `dgp.test.ts`,
34 pre-existing from T1). `tsc --noEmit`, `eslint .`, `vite build` all clean.

`dgp.test.ts` breakdown (all 24 pass):
- **Cholesky/PSD (6 tests)**: `buildAr1Matrix` matches the python fixture's
  `R`; `CHOLESKY` matches the fixture's `chol` to 1e-12; every Cholesky
  diagonal entry > 0 (PSD-by-construction proof); `L @ L^T` reconstructs `R`
  to 1e-12; the standalone `cholesky()` function (not just the module-level
  constant) independently matches the fixture; `TERTILE_Z` matches the
  fixture's `qnorm(2/3)`.
- **Determinism (3 tests)**: `generateDataset(42, null)` called twice →
  `toEqual` on every Float64Array/Uint8Array field; different seeds produce
  different data; `n`/array lengths are always exactly 400.
- **Structural ranges, 200 seeds (4 tests)**: age ∈ [22,70]; Y4 ∈ [1,10]; Y3
  is always a non-negative integer; experience ∈ {0,1,2}, urban/x ∈ {0,1}.
- **Aggregate moments, 200 seeds (6 tests)**: pooled corr(age, log(income))
  within ±0.05 of `0.35^3` (R-implied); pooled treatment share 0.5±0.05;
  median excess kurtosis(Y1) > 1; mean pairwise corr(Yi,Yj) ∈ [0.15,0.45];
  **[new guard]** median skewness(Y2) > 0.8; **[new guard]** Y3 keeps ≥6
  distinct values/seed with no value >50% frequency (medians over 200
  seeds).
- **Effect injection (3 tests)**: diff-in-diff identity at tol 1e-12 over 50
  seeds; the other 3 outcomes are byte-identical to the null baseline (β=0
  off the true outcome); hetero multiplier applies only to treated rows
  inside the designated subgroup (three-way case split: treated+in-subgroup,
  treated-outside-subgroup, untreated), tol 1e-12.
- **Prefix property (2 tests)**: `generateRows(seed, 200, null)` is exactly
  the first 200 rows of `generateRows(seed, 400, null)` for every field, over
  3 seeds; `generateDataset` is exactly `generateRows(seed, 400, ...)` with
  no extra transform.

All seed sets are fixed arrays (`0..199`, `0..49`, `[0,1,42]`) — no
`Math.random`, no wall clock, fully reproducible; deterministic PRNG means
there is no run-to-run flakiness regardless of margin size.

### TDD RED → GREEN evidence

Real RED confirmed twice for this task:
1. **First RED** (before any implementation existed): `npx vitest run
   tests/engine/dgp.test.ts` → `Cannot find module '../../src/engine/dgp'`
   (1 failed suite, 0 tests) — the expected "module missing" failure, not a
   typo.
2. **Re-established RED after the path-trap fix** (see incident above, to
   prove the cycle genuinely happened in the worktree, not just trusted from
   the wrong tree): `dgp.ts` + `dgpConstants.ts` temporarily moved out →
   identical "Cannot find module" failure, this time with vitest's banner
   correctly showing the worktree path. Files restored → 24/24 GREEN, same
   worktree-path banner.

GREEN reached on the first full implementation pass (no failing assertions
needed fixing after the initial write) — the two design tensions above were
resolved *before* writing dgp.ts (via the numerical spike + controller
rulings), not discovered via failing tests afterward.

## Self-review

- No tautological assertions: every moment/structural test compares against
  an externally-derived target (the R-implied correlation, the brief's
  numeric bands, the fixture's independently-computed values) or an
  algebraic identity (diff-in-diff, prefix equality across two independent
  calls) — never a value against itself.
- `meanAndSd` in `dgp.ts` is a small, private, local copy of T2's
  `stats.ts` `meanSd` contract (mean + sample sd, n−1), not an import: T2 and
  T3 are independent parallel-dispatch worktrees with no shared build order,
  so dgp.ts cannot depend on a sibling's in-flight module. Documented inline.
- `dgp.ts` imports only `./prng` and `type`-only from `./types`; it does
  **not** import from `src/game/tuning.ts` at all — `d` and the hetero
  multiplier both arrive as already-resolved parameters via `EffectSpec`
  (the caller, presumably wiring `seeds.ts` + `tuning.ts` together, is
  responsible for translating `effectParamsFor`'s `{hetero: boolean,
  heteroSubgroup}` shape into `EffectSpec`'s `{hetero: {subgroup,
  multiplier} | null}` — outside T3's scope).
- `inHeteroSubgroup` takes the full `Spec['subgroup']` (all 7 values,
  matching `EffectSpec`'s pinned field type exactly) and throws on `'all'`
  rather than silently treating it as "everyone" — defensive against a
  caller bug, since `'all'` is never a valid hetero designation and
  `seeds.ts`'s `effectParamsFor` never produces it.
- Row generation is a single loop, one continuous `mulberry32(seed)` stream,
  strictly row-major — no vectorized/column-major shortcuts that could
  introduce N-dependence into the per-row core.

## Concerns for the controller / calibration task (§8.3)

1. Y1's median kurtosis dropped from ~2.10 (fully idiosyncratic noise) to
   1.295 (shared-factor mechanism, `RHO_SHARED=0.3`) — a real, budgeted cost
   of the mandated fix, clearing the `>1` bar with ~30% margin but with less
   headroom than before. If a future calibration pass wants more kurtosis
   margin, `RHO_SHARED` could be nudged down slightly (correlation band still
   has room: 0.286 vs. the 0.15 floor).
2. `Y3_LOADINGS`/`Y2_LOADINGS`/`Y4_LOADINGS` are exactly the brief-printed
   numbers (untouched, as required); `RHO_SHARED` is the only new tunable.
   Both are marked TUNABLE in `dgpConstants.ts` with the full reasoning
   trail for whoever calibrates next.
3. `generateRows`/`GeneratedRows` are exported beyond the brief's pinned
   surface (`Dataset`/`generateDataset` only) — necessary to make the prefix
   property directly testable given `generateDataset` has no N parameter at
   all. Flagged here in case a reviewer wants a narrower public surface
   (e.g. re-exported only from the test file via a `dgp.ts`-internal-only
   marker); I judged the current approach cleaner than duplicating
   generation logic in the test.

## Files changed

- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a20c6f3c430d10b69/src/engine/dgp.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a20c6f3c430d10b69/src/engine/dgpConstants.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a20c6f3c430d10b69/tests/engine/dgp.test.ts` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a20c6f3c430d10b69/scripts/gen_dgp_fixtures.py` (new)
- `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a20c6f3c430d10b69/tests/engine/fixtures/chol_fixture.json` (new, generated)
