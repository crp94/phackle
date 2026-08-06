### Task T7: analyze.ts — single-spec pipeline

**Files:** Create `src/engine/analyze.ts`; `scripts/gen_micro_fixture.py` (append to stats fixtures script is fine); Test `tests/engine/analyze.test.ts` + `tests/engine/fixtures/micro12.json`
**Depends:** T2, T3. **Master spec:** §3.4, §3.5.

**Interfaces (produces):**
```ts
export function subgroupMask(d: Dataset, s: Spec['subgroup'], n: number): Uint8Array; // over window prefix n
// age_lt40: age<40; age_ge40: age>=40; exp_high: experience===2; exp_low: experience===0; urban/rural: urban===1/0
export function applyTransform(y: Float64Array, t: Spec['transform']): Float64Array;  // log1p: log(1 + y - min(0, min(y)))
export function runSpec(d: Dataset, spec: Spec, n: WindowN): PathResult;
// pipeline: window prefix n → subgroup filter → transform outcome → z-exclusion (on transformed outcome, within filtered
// sample; thresholds none/3/2.5/2) → OLS [1, X, income?, risk?] (income enters as log(income)) → t → p per tails.
// one-tailed: hypothesized direction POSITIVE: p1 = t > 0 ? p2/2 : 1 - p2/2.
// valid=false (PathResult.valid) when post-exclusion count < MIN_CELL or OLS invalid; ci = beta ± 1.9719·se? NO:
// ci = beta ± tCrit·se where tCrit solves two-tailed 0.05 via bisection on tTwoTailedP (20 iterations, deterministic).
```

**Steps:**
- [ ] **Fixture**: python script computes the full pipeline for a hand-checkable 12-row dataset × 6 specs (mix of subgroup/exclusion/transform/tails, one that drops below MIN_CELL) → `micro12.json` with beta/se/t/p/excludedCount/valid.
- [ ] **RED**: analyze.test.ts — all micro fixtures 1e-9; z-exclusion computed within filtered sample (fixture case proves order); log1p shift only when negatives exist; one-tailed sign rule both directions; ci brackets beta and excludes 0 iff p<.05 (property over 50 random specs on seed 7); insufficient-data spec → valid=false.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: single-spec analysis pipeline (filter→transform→exclude→OLS→p)`.

---

