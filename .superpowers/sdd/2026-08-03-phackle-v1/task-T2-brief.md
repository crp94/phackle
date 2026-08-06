### Task T2: stats.ts — OLS, t-distribution, z-scores

**Files:** Create `src/engine/stats.ts`, `scripts/gen_stat_fixtures.py`, `tests/engine/fixtures/ols_fixtures.json`, `tests/engine/fixtures/tcdf_fixtures.json`; Test `tests/engine/stats.test.ts`
**Depends:** T1. **Master spec:** §3.4, §8.1, Appendix A.

**Interfaces (produces):**
```ts
export interface OlsResult { beta: number; se: number; t: number; df: number; valid: boolean }
// OLS of y on [1, x, ...covs] via XᵀX normal equations (p ≤ 4), Gaussian elimination w/ partial pivoting.
// valid=false on singular/near-singular (|pivot| < 1e-10) or df <= 0. beta/se/t refer to the x column.
export function ols(y: Float64Array, x: Float64Array, covs: Float64Array[]): OlsResult;
export function tTwoTailedP(t: number, df: number): number;   // regularized incomplete beta, Lentz
export function betacf(a: number, b: number, x: number): number;
export function regIncBeta(a: number, b: number, x: number): number;
export function meanSd(v: Float64Array): { mean: number; sd: number };  // sd with n-1
export function zScores(v: Float64Array): Float64Array;
```

**Steps:**
- [ ] **Fixture generation**: write `scripts/gen_stat_fixtures.py` (run with `uv run --with numpy,scipy python scripts/gen_stat_fixtures.py`, fallback `pip install numpy scipy`): 10 OLS cases (n ∈ {31, 200, 400}, 0–2 covariates, one near-collinear case flagged `expect_invalid`, seeded numpy data) → `{y, x, covs, beta, se, t, p}` at 12 decimals; t-CDF table df ∈ {10, 50, 200, 398} × t ∈ {-5,-2.5,-1,0,1,1.96,2.5,5} from `scipy.stats.t.sf` → two-tailed p. Commit both JSONs.
- [ ] **RED**: `stats.test.ts` — every OLS fixture within 1e-9 relative; collinear case `valid===false`; t-CDF table within 1e-10; `regIncBeta` edges (x=0→0, x=1→1); `zScores` on `[1,2,3,4]` matches hand values; n=31 case exact.
- [ ] **Verify fail** → **GREEN** (implement per Appendix A: `p = I_{df/(df+t²)}(df/2, 1/2)`) → **Verify pass**.
- [ ] **Commit** `feat: deterministic OLS + t-distribution engine validated against scipy fixtures`.

---

