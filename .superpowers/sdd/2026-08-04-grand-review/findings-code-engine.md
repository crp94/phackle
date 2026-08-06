# GR1a findings — engine lane (src/engine/** as a scientific instrument)

Lane: GR1a. Reviewed at build/v1 7e417f4 (read-only). Agent's file write was blocked; findings persisted verbatim by the controller from the lane reply.

**Gate:** `npx vitest run` → **exit 0**, 53 files / 1494 tests, 37.2 s. `tsc --noEmit` → 0. `eslint .` → 2 errors, both in `.gr2-scratch/sim2.ts` (a parallel lane's live scratch file), zero in `src/`/`tests/`/`e2e/`/`scripts/`.

**Counts: 4 blocker · 5 high · 10 polish = 19 findings.** Seven tagged `scientific`.

**Scientific verdict: YES, the game teaches something false — three times, all in Act II's accounting.** (1) "by chance alone" is rendered on effect days where ~70% of counted hits are true positives; (2) it's also wrong on null days, where the game's own designed confounding (E[β]=0.18, z=24.9, 18% rejection vs nominal 5%) is mislabelled as chance, contradicting the About page's own disclosure; (3) the pHit sentence uses a null-day-only table on effect days (23% shown, 51% true at k=5). Plus a disclosure gap (About omits the rejection sampler that discards 42% of null and 26% of effect draws) and one citation applied to the wrong schedule (Armitage's 14.2% is exact for equally-spaced looks; this game's 200→400 schedule gives 11.1%).

**Performance:** cold init 239 ms, warm p50 24 / p99 150 / max 174 ms over 120 real dates; reveal cold 71 ms, warm p50 21 / max 40 ms; runSpec 0.1 ms. Phone budget plausible (~0.12–0.75 s day boot, ~0.1–0.35 s reveal, all in-worker behind screens the player is reading), with two caveats: a ~4 s phone worst case if the acceptance loop ever exhausts, and a *linearly growing* ~34 ms/year term that eventually becomes a hard crash (gr1a-006).

**Method.** Every number below was measured against the real engine with `PATH="/usr/bin:$PATH" npx tsx`, node v22.22.1, on the review machine. Each finding states the command shape needed to re-derive it.

---

## Tolerance ledger (the "justified or folklore?" question, answered in one table)

| Tolerance | Where | Verdict |
|---|---|---|
| `BETACF_EPS = 1e-15` | `stats.ts:72` | **Justified, but the stated reason is wrong** — see `[gr1a-014]`. Measured: betacf converges in ≤ **45** iterations over the whole (df, t) grid the game produces; 0 non-convergences. |
| `BETACF_MAXIT = 200` | `stats.ts:67` | **Justified** with 4.4× headroom (max 45 observed). |
| `BETACF_FPMIN = 1e-300` | `stats.ts:73` | **Justified** — textbook underflow guard, never hit at these (a,b,x). |
| `SINGULAR_EPS = 1e-10` | `stats.ts:143` | **Folklore (dimensionally wrong)** — see `[gr1a-010]`. Smallest pivot actually observed across 40 days × every spec: **1.159**. |
| `CRITICAL_T_ITERATIONS = 20` on `[0,100]` | `analyze.ts:131-133` | **Justified and disclosed.** Resolution 100/2²¹ ≈ 4.8e-5 in *t* → ~2.4e-5 relative on CI bounds, invisible at the 2 s.f. the CoefPlot renders. `scripts/gen_analyze_fixtures.py:73-80` states outright that the fixture replicates the same bisection so the 1e-9 CI bound measures parity, not quantile accuracy. Correct call, correctly documented. |
| `1e-9` relative, OLS/analyze fixtures | `tests/engine/{stats,analyze}.test.ts` | **Justified** — measured OLS relative error on an exactly-fitting ill-conditioned design: 5.6e-15. |
| `1e-10` relative, t-CDF fixtures | `tests/engine/stats.test.ts:120-123` | **At the floor, no margin** — see `[gr1a-014]`. |
| `1e-12` absolute, Cholesky/AR(1)/diff-in-diff | `tests/engine/dgp.test.ts` | **Justified** — deterministic algebra on O(1) magnitudes. |
| `MIN_CELL = 30` | `tuning.ts:11` | **Never binds** at any reachable window — see `[gr1a-013]`. |

**Independent numerical verification (no fixture involved).** `tTwoTailedP` was checked against the exact finite-sum t survival function (Fisher's closed forms for odd/even ν) at every df the game can produce (28…398):

- worst relative error over t ∈ {0.5 … 5}: **1.76e-9** (df=396, t=5, p≈8e-7);
- **at the decision boundary p = .05 the absolute error is ≤ 3.5e-14** at df = 28/100/198/398.

`regIncBeta` vs closed forms `I_x(1,1)=x`, `I_x(3,1)=x³`, `I_x(1,3)`, `I_x(½,½)=(2/π)asin√x`: worst relative error **1.35e-11**. Branch-switch discontinuity at `x=(a+1)/(a+b+2)`: **4.2e-11** (a=199, i.e. df=398). **Verdict: the Lentz incomplete-beta implementation is correct**, and its accuracy at the only threshold the game cares about is ~1e-14.

**OLS conditioning at n=200/400 with the real covariate structure.** Worst κ₂(XᵀX) over 40 days × 7 subgroups × 4 outcomes × 2 transforms × 4 exclusions × {200,400}: **1.41e5** (at a 60-row `exp_high` cell). Normal equations lose ~5 of 16 digits there — comfortably inside f64. No spec in 215,040 enumerated points produced an invalid fit.

**PRNG discipline.** `mulberry32(seed)` runs the raw seed through one `splitmix32` step before use, which decorrelates the adjacent-integer seeds `daySeed`/`practice:` can produce; `Math.floor(u*2³²)|0` recovers the uint32 exactly, no modulo bias. Per day the engine consumes ≤ 20 independent streams (one per acceptance attempt), each drawing ~10k values from a 2³² period. **The 1,792 spec runs consume no randomness at all** — they are pure functions of the already-generated dataset — so there is no seed-collision surface there. Within-day cross-attempt seed collision (which would silently waste an attempt): 190 pairs/day over a 2³² space ≈ 4.4e-8/day. Cross-day attempt-0 collision over a 10-year deploy ≈ 1.6e-3. Both acceptable and neither has a player-visible failure mode.

**Determinism op-set, grep-level, all 12 engine files at once.** Zero occurrences of `Date.now`, `new Date`, `Math.random`, `Math.pow`, `**`, trig, `Math.hypot/cbrt/expm1/log1p/log2/log10/fround/trunc`, `Intl.*`, `toLocale*`, `localeCompare`, `performance.now`, `process.*`, `globalThis`, `BigInt` — the only hits are the comments that ban them. The single `.sort()` (`day.ts:468`) uses the default comparator, which is UTF-16 code-unit ordering (spec-exact, locale-independent) over provably unique keys. `JSON.stringify` key order, `toFixed`, `Math.round`, `Math.imul`, `|0`, `>>>`, `Number()` parsing and `charCodeAt` are all spec-exact. **One genuine hole remains: `Math.exp` / `Math.log` — see `[gr1a-007]`.**

---

### [gr1a-001] The reveal tells effect-day players that true positives happened "by chance alone" `scientific`

**Severity:** blocker · **Effort:** S (one string per locale + a day-type branch)
**File:** `src/content/en/copy.ts:652`, rendered unconditionally at `src/ui/screens/Reveal.tsx:211-215, 274` (and `src/content/it/copy.ts:248`, `src/content/es/copy.ts:239`)

**Evidence.** `reveal.accounting1` reads
`'Of {total} possible analyses, {sig} ({sigPct}%) reach p < .05 by chance alone.'`
`Reveal.tsx` renders it in the `accounting` block with no day-type branch, so it also renders on effect days — immediately below `reveal.truthEffect` ("True effect on {outcome}: β = …"), which has just told the player the effect is real.

Measured over 200 effect days at the reveal's own window (N=200), effect params drawn by the real `effectParamsFor`:

```
median significant paths per effect day : 283 of 1792
  ... of which ON THE TRUE OUTCOME      : median 192 (mean 186.5)
  ... on the three other outcomes       : median  67 (mean  94.0)
median share of hits that are TRUE-outcome hits: 69.7%
```

So on the median effect day the game prints *"Of 1,792 possible analyses, 283 (15.8%) reach p < .05 by chance alone"* when ~70% of those 283 are true positives on an outcome the game declared real one paragraph earlier. This is the game's single most quoted sentence and it is false on 25% of days. Re-derive: `enumerateCurve(generateDataset(seed, effect), 200)`, partition hits by `spec.outcome === params.outcome`.

**Fix shape.** Split the key by day type. Null day keeps a corrected phrasing (see `[gr1a-002]`); effect day needs its own line that separates the true-outcome family from the rest, e.g. "Of {total} possible analyses, {sig} ({sigPct}%) reach p < .05 — {trueSig} of them on the outcome where something was real, {otherSig} on outcomes where nothing was." `buildRevealMetrics` already has `point.spec.outcome` and `day.puzzle.trueOutcome` in hand, so the two counts cost one extra comparison in the existing loop (`src/engine/reveal.ts:308-319`) and no new enumeration.

---

### [gr1a-002] "By chance alone" is also wrong on NULL days: the hits are confounding, not chance `scientific`

**Severity:** blocker · **Effort:** S (string) / M (if the fix is to teach the mechanism)
**File:** `src/content/en/copy.ts:652` (+ it/es); mechanism at `src/engine/dgp.ts:253-268`, `src/engine/dgpConstants.ts:66-83`

**Evidence.** The DGP assigns treatment from the same latents the outcomes load on: `X = 1[0.3·L1 + 0.2·L4 + 0.94·ε > 0]` (`dgp.ts:259`) while `Y1 = 0.2·L1 + 0.2·L4 + 0.15·L6 + ε₁` (`dgp.ts:268`). L1 has no covariate proxy on offer (age is a *subgroup* knob, not a covariate), so the L1 path is not removable by any control the player has.

Measured over 600 unconditioned null draws at N=200 (`runSpec(d, spec, 200)`, no effect injected):

```
spec                                meanBeta   se(mean)   z(bias)   P(p<.05)   [nominal .05]
Y1 all raw, NO covariates            0.18231    0.00733      24.9     0.1817
Y1 all raw, income+risk              0.10609    0.00736      14.4     0.0983
Y2 all log1p, NO covariates          0.02009    0.00149      13.5     0.0850
Y2 all log1p, income+risk (canon)    0.01216    0.00147       8.3     0.0517
Y3 all raw, NO covariates            0.20560    0.00800      25.7     0.1917
Y3 all raw, income+risk              0.01516    0.00741       2.0     0.0500
Y4 all raw, NO covariates            0.02450    0.00854       2.9     0.0467
Y1 urban raw, NO covariates          0.16732    0.01023      16.3     0.0933
```

A z of 24.9 on the mean β is not chance: the population coefficient of the no-covariate Y1 spec is unambiguously non-zero, and its rejection rate is **3.6× nominal**. The game's own About page already says so — *"a treatment confounded with age and income"* (`copy.ts:786`) — so the reveal contradicts the About page on the same day's screen. A methods-literate player who spots the systematically positive spec curve on a "true effect: 0.000" day and is told it is "chance" is being taught the wrong name for omitted-variable bias, which is the one thing the whole confounding structure was built to demonstrate.

**Fix shape.** Say what is true: the *causal* effect is zero, the *association* is not. e.g. "Of {total} possible analyses, {sig} ({sigPct}%) reach p < .05 — with no real effect anywhere in the data." Better still, and nearly free given the About page already discloses the confound: one extra reveal line naming it ("Some of those are chance. Some are the confound you were told about: the treatment was never randomly assigned."). Any replacement must not use "chance" as the sole explanation.

---

### [gr1a-003] `pHitAtK` is a null-day-only table, rendered as this day's number on effect days `scientific`

**Severity:** blocker · **Effort:** S
**File:** `src/engine/reveal.ts:230-244` + `src/engine/reveal.ts:326`; table built at `scripts/simulate_calibration.ts:575-584` (`for (const day of nullDays)`); copy at `src/content/en/copy.ts:662-663`; rendered at `src/ui/screens/Reveal.tsx:220-223, 276`

**Evidence.** `reveal.accounting3` reads *"A researcher randomly exploring {k} of them finds at least one 'significant' result about {pHitPct}% of the time."* — "them" is anaphoric to accounting1's "{total} possible analyses", i.e. **this day's** path space. The number comes from `p_hit_by_k.json`, which `simulate_calibration.ts:579` builds by iterating `nullDays` only. `buildRevealMetrics` calls `pHitAtK(explored.length)` with no day-type argument, so effect days get the null-day number.

Re-measured with the same k-subset procedure (200 days × 5 random permutations of all 1,792 specs, first-hit position), null vs effect on the *same* seeds:

```
 k   shipped table (null)   re-measured NULL   re-measured EFFECT
 1                  0.047              0.062                0.136
 3                  0.143              0.195                0.363
 5                  0.226              0.286                0.514
10                  0.396              0.461                0.734
20                  0.621              0.638                0.881
```

At the common k=5 the reveal says **23%** where the day's real figure is **51%** — a factor of 2.3. (The shipped-vs-re-measured null gap is *correct behaviour*: the table is built on **accepted** null days, whose sigCount is clamped into `NULL_SIG_BAND`, and accepted days are the only ones players ever see. That part checks out.)

**Fix shape.** Either (a) ship two vectors in `p_hit_by_k.json` (`pHitNull`, `pHitEffect` — the calibration suite already simulates 500 of each, so this is ~6 added lines and a checksum bump), and have `buildRevealMetrics` select on `day.puzzle.dayType`; or (b) reword the line so it is explicitly counterfactual and not about today ("On a day where nothing is real, a researcher randomly exploring {k} paths finds a 'significant' one about {pHitPct}% of the time"). (a) is the honest one; (b) is one string.

---

### [gr1a-004] The About page's mechanism disclosure omits the rejection sampler that shapes every number on it `scientific`

**Severity:** blocker · **Effort:** S
**File:** `src/content/en/copy.ts:785-786` (+ `it/copy.ts:380`, `es/copy.ts:362`); mechanism at `src/engine/day.ts:175-245`, `src/game/tuning.ts:9,13`

**Evidence.** `about.mechanism` opens *"Everything under the hood is real"* and then lists the DGP, the seeding, the OLS and the exhaustive enumeration. It never mentions that days are **rejection sampled**: `acceptNullDay` redraws until `sigCount(enumerateCurve(data,200))` lands in `NULL_SIG_BAND = [30,180]`, and `acceptEffectDay` redraws until the canonical spec has p < .15 at N=200 **and** p < .05 at N=400.

Measured over 300 unconditioned raw draws each:

```
raw NULL draws vs band [30,180]: 44 below (15%), 174 inside (58%), 82 above (27%)
raw EFFECT draws passing the p@200<.15 AND p@400<.05 gate: 221/300 (74%)
```

So **42% of null days and 26% of effect days are discarded**, and the two discarded tails are exactly the ones that would have made the reveal's headline percentage look unusual, or the day's true effect undetectable. The player reads "5.4% of 1,792 analyses reached p<.05" as a property of the null; it is partly a property of the sampler that chose which null to serve. Likewise "On the rest it is small and real, which is the whole difficulty" is true, but the game only ever ships effect days the canonical spec can already find at N=400.

This is the A2 check's core question — the game does not lie here, but its own disclosure page claims completeness it does not deliver, on the one mechanism that most changes how the numbers should be read.

**Fix shape.** Two sentences on the About page, in the existing clinical register: name the acceptance band and its purpose ("A day is redrawn until at least 30 of the 1,792 paths reach p<.05 — the game guarantees you can always hack it; that guarantee is itself a thumb on the scale, and it is why the percentage you see is never wildly small"), and name the effect-day gate. No engine change.

---

### [gr1a-005] The Armitage 14% footnote is right about Armitage and wrong about this game's peeking `scientific`

**Severity:** high (argued down from the `scientific`-default blocker: the number is a correctly attributed citation of a real published result, not an invented figure — but it is presented at the exact moment the player has done the *other* thing) · **Effort:** S
**File:** `src/content/en/copy.ts:455-456` (+ `it/copy.ts:135`, `es/copy.ts:126`); schedule at `src/game/tuning.ts:10` (`N_SCHEDULE = [200,250,300,350,400]`)

**Evidence.** The footnote fades in from the 2nd press of "Collect 50 more": *"Fun fact: peeking five times at α = .05 inflates your false-positive rate to ~14% (Armitage, 1969)."*

Armitage/McPherson/Rowe's table is computed for **equally spaced** interim analyses (looks at n, 2n, 3n, 4n, 5n). This game's looks are at **200, 250, 300, 350, 400** — a 2:1 total-to-initial ratio instead of 5:1, so successive test statistics are far more correlated and the inflation is smaller. Simulated in the same Brownian-motion model both schedules are defined in (400,000 trials, two-sided α=.05):

```
Armitage schedule (5 looks at n,2n,..5n)     : 14.15%   [published: 14.2%  -- the citation is exact]
P-hackle schedule (200,250,300,350,400)      : 11.11%
single look (sanity)                         :  5.02%
2 looks (200,400)                            :  8.30%
```

Empirically against the real DGP, the ANY-of-5-looks rate for specs whose null is nearly true: Y4 all raw + covariates **9.7%**, Y2 canonical **14.7%**, Y1 raw no-covariates **38.5%** (that last one is `[gr1a-002]`'s confounding, not stopping).

So: the citation is accurate; the implied "this is what you just did" is off by ~3 points. The footnote also arrives after press #2, when the player has taken 3 looks (rate ≈ 9%), not 5.

**Fix shape.** The master spec pins this text verbatim, so this routes to the controller. Two clean options that keep the wink: (a) make the genericity explicit — "peeking five times at *equally spaced* interim analyses…"; or (b) print the game's own number — "peeking at every batch, all the way to 400, turns α = .05 into about 11% (Armitage, 1969)". (b) is stronger comedy *and* stronger pedagogy, because the player can check it.

---

### [gr1a-006] `scenarioIndexFor` recurses once per day since EPOCH — a hard stack crash ~25 years out, and a linear tax from day one

**Severity:** high · **Effort:** S
**File:** `src/engine/seeds.ts:98-118` (recursion at line 109)

**Evidence.** `scenarioIndexFor(iso)` recurses into the previous 13 dates, each of which recurses into *its* previous 13, memoised — so the total work is O(days since EPOCH) and the **stack depth is also O(days since EPOCH)**. Measured cold (a fresh process, one call, `EPOCH = 2026-08-10`):

```
2027-08-10: idx=17 in  34.2 ms
2031-08-10: idx= 8 in 117.9 ms
2041-08-10: idx=10 in 222.2 ms
2051-08-10: THREW RangeError: Maximum call stack size exceeded
2061-08-10: THREW RangeError: Maximum call stack size exceeded
```

Two consequences:

1. **Reachable crash.** The throw escapes `handleRequest` (`protocol.ts:108-111` → `worker.ts:30`, which has no try/catch by design), killing the worker. A device with a badly-set clock — a real and common thing — lands on `errors.workerCrash`, whose copy ("Reloading usually fixes it") is false in that state, and which will keep happening on every reload.
2. **Growing tax.** Every `init` pays this before the acceptance loop. At 5 years post-EPOCH that is ~118 ms on this desktop, i.e. ~0.5–0.7 s on a phone, added to a p50 init of 24 ms — the scenario lookup would dominate day-boot within a couple of years of a successful launch.

**Fix shape.** Replace the recursion with an iterative forward walk that produces bit-identical values: start at the first uncached date at/after EPOCH, step forward one day at a time keeping a 13-entry rolling window of previously assigned indices, and apply the same `while (excluded.has(idx))` advance. O(1) stack, one `Set` reused instead of one per day. The memo map stays. Add a regression test at EPOCH + 10,000 days.

---

### [gr1a-007] The cross-platform determinism promise rests on `Math.exp`/`Math.log`, which ECMA-262 does not specify — and the only cross-realm test ships one engine

**Severity:** high · **Effort:** S (test matrix) + S (comment correction)
**File:** `src/engine/dgp.ts:9-14`, `src/engine/stats.ts:5-9`, `src/engine/day.ts:8-9`, `src/engine/prng.ts:58-60`; test coverage at `e2e/determinism.spec.ts`, `playwright.config.ts:56-59`

**Evidence.** Four engine headers assert the allowed op-set is "+,-,*,/,sqrt,exp,log on f64" and that this makes the result "byte-identical" for "every client on Earth". ECMA-262 defines `Math.exp` and `Math.log` as returning an *implementation-approximated* value — they are the only members of that set without a spec-exact result (sqrt is IEEE-correctly-rounded on every shipping engine; `Math.imul`, `|0`, `>>>`, `Math.round`, `toFixed`, `JSON.stringify` number formatting and `Number()` parsing are all spec-exact, verified by grep across all 12 files). V8, SpiderMonkey and JavaScriptCore use different implementations and can differ by 1 ULP.

`playwright.config.ts:56-59` declares exactly one project, `Desktop Chrome`. The cross-realm test's "browser vs Node" comparison therefore has **V8 on both sides**, and its "browser vs browser" arm is two Chromium contexts. The suite that exists to prove cross-realm agreement cannot observe the only divergence that is actually possible.

The exposure is small but non-zero and worth stating honestly rather than asserting away: `Math.log` is inside `gaussPair` (`prng.ts:68`), so a 1-ULP difference perturbs *every* value in the dataset by ~1e-16 relative. That is invisible in continuous outputs but can flip a discrete decision when a value sits within ~1e-15 of a boundary — `x[i] > 0`, `urban[i] > 0`, the two `experience` tertile cuts, `Math.round` on Y3/Y4, and (worst case) a spec's p crossing .05, which at a `NULL_SIG_BAND` edge would change the *accepted dataset* entirely. Order of magnitude: ~1e-10 per day for a discrete flip, ~2e-12 per day for an acceptance flip.

**Fix shape.** (a) Add `firefox` and `webkit` projects to `playwright.config.ts` and run `e2e/determinism.spec.ts` on all three (Playwright already bundles them) — that converts an assumption into evidence for the cost of three CI minutes. (b) Correct the four headers to state the real guarantee: sqrt and the integer ops are exact; exp/log are implementation-approximated to ≤1 ULP; the design accepts that and the empirical cross-engine check is the E2E matrix. Do not claim "byte-identical" without (a).

---

### [gr1a-008] `runSpec` builds a `DataCut` the acceptance loop never reads — 51% of the precheck's cost

**Severity:** high · **Effort:** S
**File:** `src/engine/analyze.ts:241-247` (the always-on `cut`), consumed by `src/engine/day.ts:154-160` (`nullDayPrecheckHit`, 256 `runSpec` calls per attempt, up to `MAX_ATTEMPTS = 20` attempts per day)

**Evidence.** `analyze.ts:241-246` justifies the unconditional `cut` with *"NOT on the reveal's hot path: specGrid.enumerateCurve … never calls runSpec"*. That is true and it is the wrong hot path. The hottest engine path is day boot, and `nullDayPrecheckHit` calls `runSpec` 256 times per attempt purely to read `.valid` and `.p` — discarding a freshly built four-array `DataCut` every time.

Measured (same dataset, same 256 specs, 40 repetitions, JIT warmed; `runSpecNoCut` is a verbatim copy of `runSpec` with only the `buildCut` call removed):

```
one 256-spec precheck pass   WITH cut: 13.64 ms   WITHOUT cut: 6.64 ms   (cut = 51% of the pass)
worst-case acceptance loop (20 attempts x precheck): 273 ms  vs  133 ms
```

**Fix shape.** Extract the shared pipeline into a `runSpecCore` returning `{p, valid, beta, se, t, ci, n, excludedCount, filteredIdx, transformedY, keptLocal}`; `runSpec` calls `buildCut` on top of it (public surface and `PathResult` unchanged), `nullDayPrecheckHit` calls `runSpecCore` directly. No numeric change by construction — same helpers, same order — and the existing `specGrid.test.ts` runSpec-parity suite is the regression net.

---

### [gr1a-009] Two byte-identical copies of the civil-calendar algorithm live inside `src/engine/` — the "purity-forced" wontfix does not cover them

**Severity:** high · **Effort:** S
**File:** `src/engine/seeds.ts:49-57` and `src/engine/day.ts:265-273` (verified identical by `diff`); third copy in `src/game/daily.ts`

**Evidence.** `diff <(sed -n '49,57p' src/engine/seeds.ts) <(sed -n '265,273p' src/engine/day.ts)` → **no output**: the two `daysFromCivil` bodies are byte-identical. The ledger's adjudication was *wontfix — purity-forced*. That reasoning holds for exactly one of the three copies: `src/engine/**` may not import `src/game/daily.ts`, so the engine↔game duplication is genuinely forced. It does **not** hold between `seeds.ts` and `day.ts` — both are engine modules, and engine modules import each other freely everywhere else in this codebase (`day.ts` already imports from `seeds.ts`, `analyze.ts`, `dgp.ts`, `prng.ts` and `specGrid.ts`). `day.ts:253-259` states the real reason: *"deliberately duplicated rather than shared, mirroring dgp.ts's own precedent"* — a precedent of convenience from the parallel-worktree build phase, not a constraint.

This is new evidence relative to the adjudication, which is why it is raised rather than relitigated on taste: the stated justification is factually inapplicable to 1 of the 2 engine-internal copies.

**Fix shape.** `src/engine/civil.ts` exporting `daysFromCivil` / `civilFromDays` / `parseIso` / `formatIso`; `seeds.ts` and `day.ts` import it. The `src/game/daily.ts` copy stays and keeps its "purity-forced" ruling, ideally with a comment pointing at the engine module it mirrors and the existing byte-for-byte cross-check in `day.test.ts`.

---

### [gr1a-010] `SINGULAR_EPS` is an absolute threshold on an unnormalised `XᵀX`

**Severity:** polish · **Effort:** S
**File:** `src/engine/stats.ts:143`, used at `stats.ts:215`

**Evidence.** The singularity test is `if (maxAbs < SINGULAR_EPS) return invalid` with `SINGULAR_EPS = 1e-10`, compared against a raw pivot of `XᵀX`. That matrix is not scaled: with `log(income) ≈ 10.5`, its leading entries are O(n·110) ≈ 2e4, so the threshold is ~14 orders of magnitude below the matrix scale. A design matrix that is *exactly* collinear up to rounding (e.g. a subgroup in which every row is treated, so the x column equals the intercept column) leaves a residual pivot around ε·‖XᵀX‖ ≈ 1e-16 · 2e4 = 2e-12 — the right order to sometimes pass a 1e-10 gate and return a garbage β/se that the game would then render as a real p-value.

Measured over 40 days × every spec × {200, 400}: **smallest pivot actually seen = 1.159**, and zero invalid fits in 215,040 enumerated points. So this is latent, not live — but the guard is not doing the job its name claims, and the margin is accidental (it comes from the covariates' scale, not from the threshold).

**Fix shape.** Make it scale-relative: capture `scale = max_a |XtX[a][a]|` before elimination and test `maxAbs < SINGULAR_EPS * scale` with `SINGULAR_EPS = 1e-12`. Add a unit test with a deliberately collinear design (x ≡ 1) asserting `valid === false`; today that test would be the only way to notice.

---

### [gr1a-011] `generateRows` is exported with a prefix property that its own effect path breaks

**Severity:** polish · **Effort:** S
**File:** `src/engine/dgp.ts:177-194` (JSDoc) and `:194` (export)

**Evidence.** The doc's headline claim is *"generateRows(seed, 200, effect) is always exactly the first 200 rows of generateRows(seed, 400, effect)"*. It is not, when `effect !== null` — the paragraph below discloses the exception, but the export is still a live trap. Measured:

```
effect=null        : max |y1[i]_200 - y1[i]_400| over the first 200 rows = 0 (identical)
effect=d=0.25 on Y1: max |y1[i]_200 - y1[i]_400| = 0.01850533545319144 (first divergence at row 4)
```

because the injection scales by `meanAndSd(target).sd` over *the array it was handed*, and the sd of 200 rows differs from the sd of 400. The dead-export scan confirms no production caller (`prod-refs = 0`, callers are `dgp.test.ts` and `generateDataset`).

**Fix shape.** Cheapest correct move: keep the export for the prefix test, but make the trap unreachable — `if (effect !== null && n !== 400) throw new Error(...)`, and reword the JSDoc so the headline says "for the per-row generative core; effect injection is whole-array and therefore n-dependent". Alternatively split into `generateRowsCore(seed, n)` (prefix-exact, exported) and a private `injectEffect(rows, effect)`.

---

### [gr1a-012] The engine-purity rule and its enforcer disagree, and the op-set has no enforcer at all

**Severity:** polish · **Effort:** S
**File:** `eslint.config.js:63-93`; violating-by-the-stated-rule import at `src/engine/reveal.ts:49`

**Evidence.** The stated rule (design spec i18n §1, `eslint.config.js:64-66`, and the message at line 86) is *"the sole allowed exception is src/game/tuning.ts"*. `reveal.ts:49` imports `'../data/p_hit_by_k.json'` — a second out-of-engine dependency the `no-restricted-imports` patterns (`**/ui/*`, `**/i18n/*`, `**/content/*`, `**/game/*`) do not cover. The dependency itself is fine (language-blind build artefact, checksum-guarded), but "engine imports only tuning" is now false and unenforced.

Separately, the determinism op-set is enforced only by `no-restricted-properties` for `Math.random` and `Date.now` and `no-restricted-syntax` for `new Date`. `Math.pow`, the `**` operator, all trig, `Math.hypot/cbrt/expm1/log1p/log2/log10/fround`, `Intl.*` and `toLocale*` are named as forbidden in four separate file headers and banned by **nothing**. The tree is clean today (verified by grep across all 12 files); nothing stops the next contributor.

**Fix shape.** (a) Add `src/data/*` to the allowed set explicitly and update the rule's message and the design-spec sentence to "tuning.ts plus the checksum-guarded tables in src/data". (b) Extend `no-restricted-properties` with `Math.pow`, the trig family, `Math.hypot/cbrt/expm1/log1p/log2/log10/fround` and `toLocaleString`; add `no-restricted-syntax` entries for `BinaryExpression[operator='**']` and `MemberExpression[object.name='Intl']`. Both are config-only, no source change.

---

### [gr1a-013] `MIN_CELL` never binds — three player-visible states are unreachable

**Severity:** polish · **Effort:** S (per state; the decision is what to do, not how)
**File:** `src/game/tuning.ts:11`; consumers `src/engine/analyze.ts:229`, `src/engine/specGrid.ts:296`; dead surfaces at `src/ui/components/PValueDial.tsx:201-206`, `src/content/en/copy.ts:457`, `src/content/en/copy.ts:603`, `src/ui/screens/Reveal.tsx:196,266`

**Evidence.** Over 60 days × {200, 400} × all 1,792 specs = **215,040 enumerated points: 0 invalid**, neither for `n < 30` nor for a singular fit. The smallest post-exclusion cell seen across 40 days × every (subgroup, outcome, transform, exclusion) combination was **46 rows** — the binding case is `exp_high`/`exp_low` (≈⅓ of 200) minus a |z|>2 exclusion, and it still clears 30 by 16.

Consequently: `lab.insufficient` ("n < 30. Not enough data to analyze.") never renders; `reveal.omittedFootnote` ("{n} specifications had too little data…") never renders because `omitted = totalPaths - curve.length` is always 0; and `runSpec`'s `p = 1; ci = [0,0]` branch (`analyze.ts:224-227`) is dead. This is not a bug — it means `sigFraction`'s denominator question is moot and the curve is always complete — but it is three states the design pays for and no player reaches, and `lab.insufficient` is additionally *wrong copy* for the only way it could ever fire (a singular fit at n ≥ 30 would still say "n < 30").

**Fix shape.** Either raise the visibility of the states (a genuinely small subgroup is not reachable with the current N schedule, so this would need a design change) or accept them as defensive and say so in one comment each, and reword `lab.insufficient` so it does not assert a cause it cannot know ("Not enough data to analyse this cut."). Route to the controller: the honest answer may be that `MIN_CELL` is a guard that has already done its job by never firing.

---

### [gr1a-014] The 1e-10 t-CDF test tolerance sits exactly on the engine's accuracy floor, and the floor is not where the comment says it is

**Severity:** polish · **Effort:** S
**File:** `src/engine/stats.ts:68-72` (the comment), `src/engine/stats.ts:45-65` (`gammln`), `tests/engine/stats.test.ts:120-123` (the tolerance), `tests/engine/fixtures/tcdf_fixtures.json`

**Evidence.** `stats.ts:68-72` says `BETACF_EPS` was tightened from the textbook 3e-7 "to hit this engine's 1e-10 relative fixture tolerance". Measurement says betacf is not the binding constraint: it converges in ≤ **45** iterations to 1e-15 across the entire (df, t) grid the game produces. The binding constraint is `gammln`'s 6-coefficient Lanczos approximation, whose published accuracy is ~2e-10 relative — which is exactly what shows up as the **4.2e-11** discontinuity at `regIncBeta`'s branch switch (a=199, i.e. df=398) and the **1.35e-11** worst error against closed forms.

Against the exact finite-sum reference the measured relative error reaches **1.76e-9** at (df=396, t=5). The fixture's t grid is `{-5, -2.5, -1, 0, 1, 1.96, 2.5, 5}` × df `{10, 50, …}` — the 1e-10 assertion passes only because the sampled combinations happen to land better than the worst case, not because 1e-10 is the guaranteed floor.

None of this is player-visible: at p = .05, where every decision in the game is made, the absolute error is ≤ 3.5e-14 (measured at df 28/100/198/398).

**Fix shape.** Correct the comment to name `gammln`'s Lanczos as the accuracy floor and betacf's EPS as "tight enough not to be the binding term" (a true and more useful statement). Then either relax the t-CDF fixture bound to 1e-8 with a note, or — if 1e-10 is wanted as a guarantee — swap `GAMMLN_COF` for the g=7/n=15 Lanczos coefficients, which buy ~1e-15 and cost nothing at runtime. Do not leave the tolerance and the comment as they are: the next person who widens the fixture's t grid will get an unexplained failure.

---

### [gr1a-015] `PHitTable` is a dead export

**Severity:** polish · **Effort:** S
**File:** `src/engine/reveal.ts:94-97`

**Evidence.** Repo-wide symbol scan of every engine export against `src/`, `tests/`, `e2e/`, `scripts/`: `PHitTable` has **0 references outside its own file**. It is used internally (`reveal.ts:99`, `:213`) but never imported. Every other zero-production-reference export in the engine (`splitmix32`, `betacf`, `regIncBeta`, `buildAr1Matrix`, `cholesky`, `hashRows`, `hashCurve`, `bandDistance`, `pickBestEffectAttempt`, `canonicalTransform`, `canonicalSpecFor`, `dgpConstantVector`, `pHitTableChecksum`, `P_HIT_MAX_K`, `generateRows`) has a live test- or script-side consumer and a comment saying so — this one has neither.

**Fix shape.** Drop the `export` keyword, or export it deliberately alongside `assertPHitTable` (whose signature names it) and say why in a comment. Note that `assertPHitTable` is currently unusable from outside precisely because its argument type is the only thing exported for it — one of the two should change.

---

### [gr1a-016] `scenarioIndexFor` has no guard against an unsatisfiable exclusion set

**Severity:** polish · **Effort:** S
**File:** `src/engine/seeds.ts:106-114`

**Evidence.** `while (excluded.has(idx)) { idx = (idx + 1) % count; }` never terminates if the 13-entry exclusion set covers every index, i.e. whenever `count <= 13`. `count` arrives from `content.scenarios.length` (`src/ui/App.tsx:130`), and `tests/content/shape.test.ts:6` enforces `MIN_SCENARIOS = 20` for all three locales, so it is not reachable today. It is an infinite loop in a worker with no message pump — the tab would spin forever with no error and no crash handler.

**Fix shape.** One line before the loop: `if (count <= 13) throw new Error(...)` — or bound the walk to `count` iterations and fall back to `idx0`. A thrown error routes to the existing worker-crash path; the silent hang does not.

---

### [gr1a-017] The three mean/sd helpers are provably bit-identical — the "unify" verdict is safe to execute

**Severity:** polish · **Effort:** S
**File:** `src/engine/stats.ts:12-25` (`meanSd`), `src/engine/dgp.ts:99-110` (`meanAndSd`), `src/engine/day.ts:293-304` (`sampleSd`)

**Evidence.** This confirms rather than relitigates the ledger's `fix` verdict, with the evidence the verdict needs to be executed safely. The three bodies use the same accumulation order (sum → mean → Σ(v−mean)² → sqrt(·/(n−1))). Measured across 50 days × 4 outcome columns, comparing all three with `Object.is` (bit equality, not tolerance): **identical in every one of 200 comparisons.**

That matters specifically for `day.ts:sampleSd`, whose contract (`day.ts:283-292`) is to reproduce *byte-for-byte* the sd that `dgp.ts`'s injection pass multiplied by — so `trueBeta` is exact. Unification through `stats.meanSd` preserves that; nothing here is order-sensitive.

**Fix shape.** Delete `dgp.ts:meanAndSd` and `day.ts:sampleSd`; import `meanSd` from `stats.ts` in both (`.sd` at the two call sites, `dgp.ts:295` and `day.ts:333`). Keep `day.ts:283-292`'s comment, rewritten to say the shared helper is bit-identical *and why that is required*. The golden fixtures are the regression net — if a byte moves they fail.

---

### [gr1a-018] The DGP calibration note's "comfortably above 1" holds for the median only

**Severity:** polish · **Effort:** S
**File:** `src/engine/dgpConstants.ts:30-40`

**Evidence.** Every quantitative claim in the CALIBRATION NOTE re-measured over 200 fresh seeds (independent of the seeds it was written from):

```
median excess kurtosis(Y1) : 1.303   [note claims 1.295]           OK
median skewness(Y2)        : 1.694   [note claims 1.608]           OK (estimator/seed difference)
median distinct Y3 values  : 9       [note claims 9]               OK
median max single-value frq: 0.378   [note claims 0.372]           OK
mean pairwise corr(Yi,Yj)  : 0.285   [note claims 0.286]           OK
per-seed mean corr range   : [0.223, 0.362]  -- 0 of 200 seeds outside the required [0.15, 0.45]
```

The note is honest and reproducible. One phrase overstates: *"keep median excess kurtosis(Y1) comfortably above 1"*. The median is 1.303 — a 30% margin — and **74 of 200 seeds (37%) have excess kurtosis ≤ 1**, i.e. more than a third of days do not deliver the heavy tail Y1 exists to provide. The claim as literally written (about the median) is true; "comfortably" is not.

**Fix shape.** Replace "comfortably above 1" with the measured distribution: "median 1.30, with ~37% of days below 1 — Y1's heavy tail is a property of the family, not a guarantee per day." If the per-day guarantee is wanted, that is a `RHO_SHARED` retune and routes to the controller with the calibration-suite implications stated.

---

### [gr1a-019] `console.warn` is the only reporting channel for a cap-exhausted acceptance loop

**Severity:** polish · **Effort:** S
**File:** `src/engine/day.ts:211-214`, `src/engine/day.ts:239-243`

**Evidence.** When `MAX_ATTEMPTS` is exhausted the engine serves a best-effort day and reports it with `console.warn` from inside a Web Worker — invisible in production, and the only signal that a player got a day outside the design's own guarantees (a null day with fewer than 30 hackable paths, or an effect day the canonical spec cannot find). Measured over 120 consecutive real dates the loop is nowhere near the cap (`attemptUsed` histogram `0:76 1:28 2:10 3:4 4:1 7:1`, max **7** of 20), so this is genuinely rare — but it is also the one condition under which the reveal's promises are not backed by the data, and nothing downstream can tell.

It is also the engine's only side effect: two `console.warn` calls in a module whose header claims "pure functions of the arguments … no mutable module state".

**Fix shape.** Keep the warn, and put the fact on the wire: add `capExhausted: boolean` to `DailyPuzzle` and pass it through `RevealPayload`. It is not spoiler-bearing (it says nothing about day type — both branches can set it) and it lets the reveal, or at minimum a dev-mode badge, know that this day fell back. Cheap insurance for a condition that by construction cannot be reproduced from the date alone.

---

## Performance headroom — measured, not estimated

All figures: node v22.22.1 on the review desktop, real engine through `handleRequest` (the exact path the worker takes). Phone estimates use a 4–6× scalar-float slowdown for a mid-range 2024 phone.

| Operation | Cold (first call, module load + JIT) | Warm, over 120 consecutive real dates |
|---|---|---|
| `init` (full acceptance loop) | **239 ms** | p50 **24 ms** · p90 84 ms · p99 150 ms · max **174 ms** |
| `runSpec` (one knob turn) | 0.20 ms | ~0.1 ms |
| `reveal` (1,792 enumeration + metrics) | **71 ms** | p50 **21 ms** · p90 36 ms · max **40 ms** |

Component costs: `generateDataset` (400 rows) 1.81 ms · `enumerateCurve(n=200)` 26.4 ms · `enumerateCurve(n=400)` 28.0 ms · `buildRevealMetrics` 1.17 ms · one 256-spec precheck pass 13.6 ms.

`attemptUsed` over 120 dates: `0:76 1:28 2:10 3:4 4:1 7:1` — max 7 of `MAX_ATTEMPTS = 20`.

**Verdict: the phone budget is plausible, with two named caveats.** Day boot lands at roughly **0.1–0.9 s on a phone** (p50 ~0.12 s, p99 ~0.75 s), entirely inside the worker and entirely behind the Briefing screen, which the player is reading. The reveal costs **~0.1–0.2 s warm, ~0.35 s cold** — under the stamp animation, so invisible. `runSpec` at ~0.5 ms on a phone is far below `DEBOUNCE_MS = 300`, so the dial is never the bottleneck.

Caveats: (1) the pathological 20-attempt fallback is bounded at ~0.8 s desktop → **~4 s on a phone**, never observed in 120 days but not impossible; (2) `[gr1a-006]` adds a *linearly growing* ~34 ms per year-since-EPOCH to every `init`, which within two or three years of a successful launch would exceed the acceptance loop itself and eventually crash it. Fixing `[gr1a-006]` and `[gr1a-008]` together removes both the growth term and ~50% of the precheck.

---

## Scientific-accuracy verdict (A2)

**Does the game ever teach something false? YES — in three places, all in Act II's accounting, all fixable with copy plus one small engine change.**

1. **`reveal.accounting1`, "by chance alone", on effect days** — 70% of the counted hits are true positives on the outcome the game declared real one line above (`[gr1a-001]`).
2. **`reveal.accounting1`, "by chance alone", on null days** — a large share of the hits are the game's own designed confounding (E[β] = 0.18, z = 24.9, rejection rate 18% vs nominal 5% for the plainest Y1 spec), which the About page discloses and the reveal then mislabels (`[gr1a-002]`).
3. **`reveal.accounting3`, the pHit sentence, on effect days** — a null-day-only lookup presented as this day's number: 23% shown where 51% is true at k=5 (`[gr1a-003]`).

**Plus one disclosure gap that a methods-literate reviewer will treat as equivalent:** the About page claims "everything under the hood is real" and omits the rejection sampler that discards 42% of null days and 26% of effect days (`[gr1a-004]`).

**And one citation that is exact but applied to the wrong schedule:** Armitage's 14.2% is reproduced to 0.05pp for the schedule Armitage computed; this game's own peek schedule gives 11.1% (`[gr1a-005]`).

**Everything else checks out.** Verified true and mechanically correct:

- **The engine's own machinery.** t-distribution accurate to ≤3.5e-14 at p=.05 across every df the game produces; incomplete beta correct against four independent closed forms; OLS exact to 5.6e-15 on an ill-conditioned exact-fit design and never near-singular in practice; z-scores, transforms, exclusion order and the one-tailed conversion all match the master spec's §3.4/§3.5 recipe exactly.
- **`about.mechanism`'s factual claims:** 8 correlated latents ✓ (`LATENT_DIM = 8`, AR(1) ρ=0.35); "treatment confounded with age and income" ✓ (L1→age, L4→log income, both in the assignment index); four outcome families ✓; OLS ✓; "enumerated, not sampled" ✓ (4·7·4·4·2·2 = 1,792, exhaustive); "on most days the true effect is exactly zero" ✓ (`P_EFFECT_PCT = 25`); "on the rest it is small" ✓ (`EFFECT_D_RANGE = [0.18, 0.30]`).
- **`about.frozenFork`** — "outlier z-scores computed on the transformed outcome, within the filtered subsample" matches `analyze.ts:179-192` exactly, in that order.
- **All 24 glossary entries (EN + IT + ES)** are mechanically correct: p-hacking, researcher degrees of freedom, garden of forking paths, specification curve, HARKing, optional stopping, preregistration, α/false-positive rate. No definition misstates its concept in any locale.
- **`reveal.peekSurcharge`** — "m peeks make the true number of analyses roughly (m+1)× larger" is exactly right: each window is a full 1,792-path space, and the curve shows one of them.
- **`reveal.preregFalsePositive`** — "a preregistered analysis, run exactly once, still finds a false positive about 5% of the time" ✓.
- **The one-tailed direction contract holds.** The engine hardcodes the positive direction (`analyze.ts:221`), the injected effect is always positive (`dgp.ts:302`), and `tests/content/shape.test.ts:20-43` enforces positive-direction outcome phrasing in all three locales with a negative-lexicon guard. No scenario can make the one-tailed test point the wrong way.
- **The dial's band thresholds** (`PValueDial.tsx:48-54`: `<.05` significant, `≤.1`, `≤.2`, `≤.5`, else muted) are a pure colour ramp with no claim attached; the caption states the rule ("Below 0.05, you can publish") and the strict `p < 0.05` matches `store.submit()` and `sigCount`'s own `p < 0.05` exactly. `df = n − 2 − covCount` matches `ols`'s own `df = n − p`. Nothing here claims anything the engine does not do.
- **`p_hit_by_k.json` is measured on the right population** for null days: the shipped table (accepted null days) differs from unconditioned null draws exactly as rejection sampling predicts (0.226 vs 0.286 at k=5), and accepted days are the only days players see.
- **`sigFraction`'s denominator** includes invalid points by design — moot in practice, since 0 of 215,040 enumerated points were invalid (`[gr1a-013]`).
