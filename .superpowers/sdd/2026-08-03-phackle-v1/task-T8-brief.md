### Task T8: specGrid.ts — full enumeration with memoized preps

**Files:** Create `src/engine/specGrid.ts`; Test `tests/engine/specGrid.test.ts`
**Depends:** T7. **Master spec:** §3.6, §7.4 (CurvePoint needs).

**Interfaces (produces):**
```ts
export const AXES: { outcome: Outcome[]; subgroup: Spec['subgroup'][]; covariates: Spec['covariates'][];
  exclusion: Spec['exclusion'][]; transform: Spec['transform'][]; tails: Spec['tails'][] };  // 4·7·4·4·2·2 = 1792
export function allSpecs(): Spec[];                          // fixed iteration order (outcome-major … tails-minor)
export function specKey(s: Spec): string;                    // canonical short key e.g. "2|urban|10|z2_5|log1p|one"
export interface CurvePoint { spec: Spec; p: number; valid: boolean }
export function enumerateCurve(d: Dataset, n: WindowN): CurvePoint[];  // memoize data prep per (subgroup,transform,exclusion) = 112 preps × 16 OLS
export function sigCount(curve: CurvePoint[]): number;       // valid && p < .05
```

**Steps:**
- [ ] **RED**: length 1792, keys unique; `enumerateCurve` p for 5 sampled specs === `runSpec` p exactly (memoization changes nothing); invalid specs flagged not dropped; perf: enumerate at N=400 ≤ 800 ms in CI (`performance.now`, generous vs the 400 ms browser budget which E2E-land verifies).
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: exhaustive 1792-spec curve enumeration with memoized preps`.

---

