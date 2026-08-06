# Task T8 Report — specGrid.ts (exhaustive 1,792-spec enumeration)

Status: **DONE**

Branch `worktree-agent-a2bbba7adb87a4476` (worktree name), final HEAD after
commit below. Working tree clean; full gate green on the committed state
(re-verified after the commit, output pasted below).

## Step 0 — worktree setup

```
$ pwd
/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-a2bbba7adb87a4476
$ git log --oneline -5   # before reset
60c4787 Plan pre-flight fixes: engine-side seeds, protocol types in T1, tuning import exception, wave 1a/1b split
f54da1b Add v1 implementation plan: 27 tasks in 5 dependency waves for parallel agents
...
$ git reset --hard 13b30bb
HEAD está ahora en 13b30bb Merge T7: single-spec analysis pipeline (review approved, valid-carrying adjudicated accept)
$ ls src/engine/
analyze.ts  dgp.ts  dgpConstants.ts  prng.ts  protocol.ts  seeds.ts  stats.ts  types.ts
```
`analyze.ts` (T7's dependency) present and merged.

```
$ node --version   # (PATH="/usr/bin:$PATH")
v22.22.1
$ npm ci
npm WARN EBADENGINE ... (jsdom wants >=22.22.2 — pre-existing, harmless)
added 250 packages, and audited 251 packages in 1s
found 0 vulnerabilities
```

## Requirements read

Task brief (`task-T8-brief.md`), master spec §3.6 (specification-curve
enumeration), §3.7 (reveal metrics — chance line = `sigCount`'s use), §7.4
(SpecCurve component — confirms `CurvePoint` is a T8-introduced interface,
not a master-spec-§6 one; §6 explicitly permits Claude Code to "extend, not
contradict" the pinned core interfaces), §6 (`Spec`, `PathResult`,
`RevealMetrics` — for context on how `CurvePoint` differs from
`PathResult`). Consumed (read, not modified beyond the two authorized
comments): `src/engine/analyze.ts` (`runSpec`, `subgroupMask`,
`applyTransform`, the private `EXCLUSION_THRESHOLD` table), `src/engine/
stats.ts` (`ols`, `tTwoTailedP`, `zScores`, `OlsResult`), `src/engine/dgp.ts`
(`Dataset`, `generateDataset`), `src/engine/types.ts` (`Spec`, `Outcome`,
`WindowN`), `src/game/tuning.ts` (`MIN_CELL=30`). Also read T7's report for
house style (fixture/test conventions, the "valid-carrying" `PathResult`
design decision that the controller amendment's NOTE comment now documents
inline) and `docs/implementation_plan.md` §3.6/§7.4/§6 directly (grepped
section headers to locate exact text, since the "master spec" lives inside
`docs/implementation_plan.md`, not a separate file).

## Design decisions worth flagging

1. **Chose "share `forEachSpec`'s single traversal" over "duplicate the
   6-nested-loop order in two places."** `allSpecs()` and `enumerateCurve()`
   both delegate to one private `forEachSpec(visit)` helper that does the
   six nested loops (outcome > subgroup > covariates > exclusion > transform
   > tails) exactly once, in the codebase. This makes it *structurally
   impossible* for the two functions' iteration orders to drift apart from
   each other on a future edit — the alternative (writing the same 6-level
   nest twice, once bare and once with computation folded in) would trade a
   theoretical micro-optimization (skipping a few `Map.get()` cache hits per
   spec) for a real ongoing risk, given the perf budget (800 ms) has ~40x
   headroom over actual runtime (see Tested section, 18 ms measured).
2. **`covariates` axis order (not pinned anywhere else in the codebase).**
   Unlike the other five axes — whose value order I took directly from each
   field's declared string-literal union in `types.ts` (already the
   convention `analyze.ts` and `analyze.test.ts` use) — `Spec['covariates']`
   is a `{income,risk}` record with no declared enumeration order to defer
   to. I ordered `AXES.covariates` as a 2-bit binary count with `income` as
   the high bit: `(0,0),(0,1),(1,0),(1,1)` — i.e. income changes slower
   (major) than risk within that one axis slot — because it reads
   consistently with `specKey`'s own income-digit-then-risk-digit format.
   This is a judgment call the brief left open; flagging it explicitly in
   case a reviewer wants a different sub-order (nothing outside this file
   depends on which of the 4! orderings is chosen, as long as it's fixed and
   covers all four combinations, which the AXES cardinality test verifies).
3. **`CurvePoint` deliberately omits `beta`/`se`/`ci`/`n`/`excludedCount`.**
   The brief's interface (`{ spec, p, valid }`) is narrower than
   `PathResult`, and I read that as intentional rather than an oversight:
   the curve only ever needs to be *plotted* (by `p`, rank-sorted) and
   *counted* (`sigCount`, `valid && p<.05`) — it never displays a per-point
   CI or beta. This let me skip computing the confidence interval entirely
   (`runSpec`'s `criticalT` bisection, 20 iterations of `tTwoTailedP` per
   spec) for all 1,792 points, which is both correct per the interface and
   a meaningful chunk of the perf headroom.
4. **`EXCLUSION_THRESHOLD` exported from `analyze.ts` (pure re-export, no
   logic change)** — the brief's interfaces-you-consume section only names
   `runSpec`/`subgroupMask`/`applyTransform` as exported, but replicating
   `runSpec`'s exclusion-branch exactly requires the same `{z3:3, z2_5:2.5,
   z2:2}` lookup table it uses internally. Per the brief's own fallback
   instruction ("If a helper you need for memoization isn't exported,
   export it from analyze.ts... rather than duplicating logic"), I added
   the `export` keyword to the existing `const` declaration (one-line diff,
   no value or type change) instead of hand-copying the three numbers into
   `specGrid.ts`, which would have created a second source of truth for a
   pinned numerical constant.
5. **Both tails' `p2` is cached alongside the OLS fit, not just the fit
   itself.** The brief's memoization guidance says tails variants "share the
   same OLS fit... never a second regression" — strictly that only requires
   caching `ols()`'s result. I went one step further and cache
   `tTwoTailedP(fit.t, fit.df)` (`p2`) in the same cache entry (`FitPrep`),
   since it's a pure function of the fit alone (doesn't depend on `tails`)
   and costs nothing extra to store — this means `tTwoTailedP` itself is
   also only ever called once per 896 (outcome,subgroup,transform,
   exclusion,covariates) combination, not once per spec (1,792 times).

## TDD evidence

**RED** (`specGrid.test.ts` written against the not-yet-existing module):
```
$ npx vitest run tests/engine/specGrid.test.ts
 RUN  v4.1.10 ...
 ❯ tests/engine/specGrid.test.ts (0 test)
 FAIL  tests/engine/specGrid.test.ts [ tests/engine/specGrid.test.ts ]
Error: Cannot find module '../../src/engine/specGrid' imported from .../tests/engine/specGrid.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** after implementing `src/engine/specGrid.ts` plus the three small
authorized edits (`analyze.ts`'s re-export, `types.ts`/`protocol.ts`'s NOTE
comments) — first attempt, no iteration needed on the test file itself:
```
$ npx vitest run tests/engine/specGrid.test.ts
 Test Files  1 passed (1)
      Tests  27 passed (27)
```

**Full gate**, re-run fresh immediately before committing:
```
$ npx vitest run
 Test Files  11 passed (11)
      Tests  246 passed (246)          # 219 pre-existing + 27 new
$ npx tsc --noEmit                     # exit 0, no output
$ npm run lint                          # exit 0, no output
$ npm run build
✓ 16 modules transformed, built in 69ms
```

**Perf, measured directly** (isolated run, verbose reporter):
```
$ npx vitest run tests/engine/specGrid.test.ts -t "perf" --reporter=verbose
 ✓ ... enumerates all 1792 specs at N=400 within the 800ms CI budget ... 18ms
```
18 ms measured vs. an 800 ms budget — ~44x headroom.

**Determinism grep** (only match is inside my own explanatory comment text,
not real usage):
```
$ grep -n "Math\.pow\|Math\.random\|Date\.now\|new Date" src/engine/specGrid.ts
27:// none of which use Math.pow, Math.random, Date.now, or new Date.
$ grep -no "Math\.[a-zA-Z]*" src/engine/specGrid.ts | sort -u
246:Math.abs
278:Math.log
27:Math.pow        # <- inside the comment string above, not a call
27:Math.random     # <- inside the comment string above, not a call
```
Only `Math.abs` (exclusion threshold comparison) and `Math.log` (income
covariate) are actually called — both on the allowed op-set list, both
copied verbatim from `analyze.ts`'s own `runSpec` for the same steps.

## Implemented

**`src/engine/specGrid.ts`** (new) — five exports, signatures exactly as
briefed:

- `AXES` — the six enumeration axes (`outcome`, `subgroup`, `covariates`,
  `exclusion`, `transform`, `tails`), sizes 4·7·4·4·2·2=1792, in outcome-
  major…tails-minor order. Five of six axes' internal value order matches
  each `Spec` field's declared union order in `types.ts`; `covariates`' own
  order is a documented judgment call (see Design decision #2).
- `allSpecs()` — all 1,792 specs via the shared `forEachSpec` traversal.
- `specKey(s)` — canonical string key, exactly the brief's pinned format.
- `CurvePoint` — `{ spec, p, valid }`, exactly as briefed.
- `sigCount(curve)` — count of `valid && p<.05` entries.
- `enumerateCurve(d, n)` — the memoized full-curve enumeration. Internally:
  `forEachSpec` drives the traversal; six private memoized helpers
  (`getFilteredIdx` → `getRawY` → `getTransformedY`/`getZ` → `getKept` →
  `getFitPrep`) reproduce `runSpec`'s exact pipeline (filter → transform →
  z-score → exclude → build covariate columns → `ols()` → tails-only `p`
  conversion) using `analyze.ts`/`stats.ts`'s own exported functions at
  every step, with `Map`-based caching keyed by the coarsest tuple that
  determines each intermediate (subgroup only; then +outcome; then
  +transform; then +exclusion; then +covariates — never +tails, so both
  tails variants of one 5-tuple hit the same `FitPrep` cache entry and never
  trigger a second `ols()` call). All caches are `new Map()`s created fresh
  inside the function body — no module-level state at all.

**Authorized small edits** (per the T7 review-adjudication fold-in and the
"optional pure re-exports" allowance):
- `src/engine/types.ts` — one comment line added directly above
  `PathResult`'s declaration (verbatim text from the controller amendment).
  Nothing else touched; the edit sits well above where `PlayerAction` lives
  further down the file.
- `src/engine/protocol.ts` — the same comment added directly above
  `EngineClient.runSpec`'s signature. Nothing else touched.
- `src/engine/analyze.ts` — `EXCLUSION_THRESHOLD`'s declaration gained an
  `export` keyword plus a one-line comment explaining why; the table's keys/
  values (`z3:3, z2_5:2.5, z2:2`) are byte-for-byte unchanged.

## Tested + results

27 new tests in `tests/engine/specGrid.test.ts`, all against real computed
values (either exact-format literals from the brief, or direct comparison
against `runSpec` on real/synthetic datasets — no mocking):

- **AXES** (2 tests): per-axis cardinalities (4/7/4/4/2/2) multiplying to
  1792; `covariates` axis contains exactly the four distinct income/risk
  combinations with no duplicates.
- **allSpecs — fixed order** (8 tests): exactly 1792 entries; every
  `specKey` unique (`Set` size check); then one dedicated test per axis
  (outcome/subgroup/covariates/exclusion/transform/tails) using a generic
  `checkAxis` helper that derives each axis's expected block size from the
  *product of the axis sizes to its right* (e.g. outcome's block = 7·4·4·
  2·2=448) and asserts every one of the 1792 specs' value on that axis
  against the expected cyclic pattern — a precise, self-checking proof of
  "outcome-major…tails-minor" rather than a few hand-picked spot checks.
- **specKey** (2 tests): the brief's own canonical example
  (`outcome=2,urban,income=T/risk=F,z2_5,log1p,one` → exactly
  `"2|urban|10|z2_5|log1p|one"`); both-off (`"00"`) and both-on (`"11"`)
  covariate encodings.
- **enumerateCurve — order and shape** (1 test): 1792 entries, spec-for-spec
  `toEqual` (deep-equal, since `allSpecs()` and `enumerateCurve()` build
  independent spec object instances) match with `allSpecs()`'s own order.
- **enumerateCurve — exact parity with runSpec** (7 tests — controller
  requirement (a), ≥5 sampled specs including both-tails-of-one-base and
  ≥1 invalid spec): five samples spread across outcome-major boundaries
  (indices 0/447/448/895/1791) each checked with `toBe` (strict `===`, not
  approximate) against `runSpec(dataset, spec, 400)` on a real
  `generateDataset(2024, null)`; a dedicated "both tails variants of the
  same base" test (indices 300/301, confirmed to differ *only* in `tails`
  by comparing every other field, plus an explicit assertion that the two
  p-values are actually different — proving the test really exercises both
  p-value formulas rather than the two coincidentally agreeing); a
  dedicated "at least one invalid spec" test using a 20-row synthetic
  dataset (below `MIN_CELL=30` for every possible spec by construction,
  independent of subgroup/exclusion — sanity-asserted via
  `runSpec(...).valid === false` before trusting the comparison).
- **enumerateCurve — invalid specs flagged, not dropped** (2 tests —
  requirement (c)): the same 20-row all-invalid dataset produces a
  full-length 1792 curve, every entry `valid:false` (not a shorter,
  filtered array); a 40-row "mixed" dataset (`urban` subgroup deliberately
  sized at 8 rows, `all` at the full 40) shows `urban`-subgroup entries all
  `valid:false` while at least one entry elsewhere in the *same* curve is
  `valid:true` — proving invalid entries coexist with valid ones rather
  than either being dropped or swallowing the whole curve.
- **enumerateCurve — no state leakage across calls** (2 tests — the STEP 5
  self-review requirement): two `enumerateCurve` calls on the *same*
  dataset produce `toEqual`-identical curves (reproducibility); calling on
  two *different* datasets produces *different* curves, and re-running the
  first dataset afterward reproduces its original curve exactly — directly
  demonstrating no state leaks from one call/dataset into another.
- **enumerateCurve — perf** (1 test — requirement (b)): single
  `performance.now()`-bracketed call at N=400 on a real dataset,
  `curve.length===1792` and elapsed `<=800`ms. Measured 18ms in isolation
  (see TDD evidence above).
- **sigCount** (2 tests): a hand-built 5-entry `CurvePoint[]` exercising
  every branch (valid+sig, valid+nonsig, invalid+tiny-p [must not count],
  valid+just-under-.05, valid+exactly-.05 [boundary, must not count],
  expected count = 2); cross-check that `sigCount` on a real enumerated
  curve matches a direct `filter+length` over the same array.

## Files changed

- `src/engine/specGrid.ts` (new)
- `tests/engine/specGrid.test.ts` (new)
- `src/engine/types.ts` (comment only, above `PathResult`)
- `src/engine/protocol.ts` (comment only, above `EngineClient.runSpec`)
- `src/engine/analyze.ts` (added `export` + one-line comment to
  `EXCLUSION_THRESHOLD`; no logic change)

## Commit

1. `feat: exhaustive 1792-spec curve enumeration with memoized preps`
   (implementation + tests + the three small authorized edits, together —
   there's no external fixture-generation step here to split into its own
   `test:` commit the way T7's numpy/scipy fixture was, since every check
   in this task cross-validates against `runSpec` directly in TypeScript).

Final commit SHA: `7b8aa40`. Post-commit verification: working tree clean
(`git status --short` empty), full suite re-run green (246/246).

## Self-review

**Completeness.** All five brief-specified exports exist with the exact
signatures given: `AXES`, `allSpecs`, `specKey`, `CurvePoint`,
`enumerateCurve`, plus `sigCount`. Every RED-step bullet / controller
requirement is covered: (a) exact parity — 5 sampled + explicit tails-pair +
explicit invalid-spec, all via strict `toBe`, not `toBeCloseTo`; (b) perf —
measured 18ms vs 800ms budget; (c) invalid-not-dropped — two dedicated
tests, one all-invalid, one mixed; (d) 1792/unique/fixed-order — cardinality
test, uniqueness test, and a rigorous per-axis block-size order proof (not
just spot-checked indices).

**Why I'm confident the "EXACTLY equal to runSpec" claim holds, not just
empirically but structurally:** every intermediate `enumerateCurve` computes
is produced by calling the *same* already-tested pure function
(`subgroupMask`, `applyTransform`, `zScores`, `ols`, `tTwoTailedP`) that
`runSpec` calls internally, with the *same* argument values, in the *same*
order, reading from the *same* `Dataset` object. None of these functions
have hidden state or perform any operation whose result depends on
anything besides its explicit numeric/array arguments (no `Math.random`,
no object-identity-dependent branching) — floating-point arithmetic in
JS/V8 is deterministic given the same operand *values*, regardless of
whether a caller happens to reuse an array object across multiple
downstream computations or reconstructs an equal one fresh each time. I
traced every one of `runSpec`'s twelve pipeline steps against
`enumerateCurve`'s corresponding step by hand (documented in my working
notes, not reproduced here) before writing a single test, specifically to
rule out any reordering that could change rounding (e.g. the `covs` array's
push order — income before risk — matters for OLS's column ordering and is
replicated exactly, not just "mathematically equivalent"). The 7
runSpec-comparison tests then verified this empirically with exact (`===`)
equality, not a tolerance — if any step actually diverged, those tests
would have failed outright rather than passing within some epsilon.

**No state leakage (explicit STEP 5 requirement).** All six memoization
caches (`filteredIdxCache`, `rawYCache`, `transformedYCache`, `zCache`,
`keptCache`, `fitCache`) are `new Map()`s declared inside
`enumerateCurve`'s function body — plain local closures over that one
call's `d`/`n` parameters, never assigned to any module-level `let`/`const`
outside the function. There is no code path by which one call to
`enumerateCurve` could observe or mutate another call's cache — this is
true by construction (each call gets fresh `Map` instances), not just
empirically true for the datasets I happened to test. The two dedicated
tests (same-dataset reproducibility; different-dataset non-identity plus
re-run-reproduces-original) are corroborating evidence for a reader, not
the only reason to believe it.

**Discipline (YAGNI).** No speculative exports beyond the brief's five
(`AXES`/`allSpecs`/`specKey`/`CurvePoint`/`enumerateCurve`) plus the
explicitly-requested `sigCount`. Did not compute or carry `beta`/`se`/`ci`
in `CurvePoint` even though `runSpec`/`ols` produce them "for free" as a
byproduct — the brief's interface says `{spec,p,valid}` and nothing in
§7.4's SpecCurve description needs more per-point data than that, so adding
it would be unrequested scope. Did not memoize `tTwoTailedP` results across
*different* fits (only within one fit's two tails) — there's no shared
structure to exploit there (every one of the 896 fits generically has its
own distinct `(t,df)`).

**Testing.** 27 new tests, 246/246 full-suite total, all against real
computed values (brief-pinned literal formats, or direct comparisons
against the already-validated `runSpec`) — no mocking, no snapshot testing.
`npx vitest run`/`tsc --noEmit`/`npm run lint`/`npm run build` all produce
clean/zero-diagnostic output on the final tree.

## Concerns

None blocking. One judgment call worth a second pair of eyes:

1. **`covariates` axis internal order** (Design decision #2 above): I chose
   income-as-high-bit binary counting for `AXES.covariates`'s four entries,
   since nothing in the brief or `types.ts` pins an order for this
   particular axis (unlike the other five, which mirror their `Spec`
   field's declared string-literal union order verbatim). Any reviewer
   preference for a different sub-order (e.g. "income-only, then risk-only,
   then both" or the reverse bit convention) would be a one-line change to
   the `AXES.covariates` array literal with no ripple effects elsewhere
   (nothing outside this file depends on which of the 4! orderings is
   used — `specKey`'s format is independent of `AXES.covariates`'s literal
   ordering, since it derives the two digits directly from
   `s.covariates.income`/`s.covariates.risk`, not from an index into
   `AXES.covariates`).

No other deviations from the brief's pinned semantics that I'm aware of.
