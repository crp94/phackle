### Task T3: dgp.ts — data generation (no acceptance loop yet)

**Files:** Create `src/engine/dgp.ts`, `src/engine/dgpConstants.ts`; Test `tests/engine/dgp.test.ts`
**Depends:** T1. **Master spec:** §3.2, Appendix A.

**Interfaces (produces):**
```ts
export interface Dataset {           // full N=400, engine-internal
  n: 400; x: Uint8Array;             // treatment 0/1
  age: Float64Array; urban: Uint8Array; experience: Uint8Array; // 0 low,1 med,2 high
  income: Float64Array; risk: Float64Array;
  y: [Float64Array, Float64Array, Float64Array, Float64Array];
}
export function generateDataset(seed: number, effect: { outcome: Outcome; d: number;
  hetero: { subgroup: Spec['subgroup']; multiplier: number } | null } | null): Dataset;
```
**Pins:** `R[i][j] = 0.35^|i-j|` (8×8 AR(1), PSD by construction); Cholesky **computed in TS at module load** by textbook `chol()` (allowed ops only) and unit-tested against a checked-in python-generated fixture. Covariate constructions exactly §3.2 table. Treatment: `X = 1[0.3·L1 + 0.2·L4 + 0.94·ε > 0]`. Outcome loadings (in `dgpConstants.ts`, TUNABLE, calibration may adjust):
Y1 = 0.20·L1 + 0.20·L4 + 0.15·L6 + 1.0·ε1; Y2 = exp(0.4·(0.15·L1 + 0.25·L5 + 0.15·L6) + 0.5·ε2) (positive skew); Y3 = round(exp(0.8 + 0.15·L3 + 0.15·L4 + 0.15·L6 + 0.4·ε3)) (count); Y4 = clamp(round(5.5 + 1.4·(0.20·L5 + 0.15·L6) + 1.4·ε4), 1, 10). **Correlated errors via a shared factor (master §3.2)**: εⱼ = sqrt(1−RHO_SHARED)·ηⱼ + sqrt(RHO_SHARED)·η_shared per row, where η1 = t5(rng), η2..η4 = z draws, η_shared ~ N(0,1); `RHO_SHARED ≈ 0.3` [TUNABLE in dgpConstants] tuned so the mean-pairwise-corr band below holds. Idiosyncratic noise scales stay at the printed values (±25% tuning allowed) — the latent loadings alone were measured too weak for the corr band (0.072), and shrinking noise scales instead is FORBIDDEN: it collapses the outcomes' marginal character. `t5(rng) = z0 / sqrt((z1²+…+z5²)/5)`.
**Marginal-character guard tests (mandatory, alongside the corr band):** median skewness(Y2) > 0.8 across seeds; Y3 keeps ≥6 distinct values per seed with no single value exceeding 50% frequency (median across seeds). Effect-injection test: same-seed diff-in-diff against the null baseline (exact algebraic identity, tol 1e-12) — NOT a raw group-mean difference, which is biased by the designed confounding.
Effect injection: generate all Y first with β=0; compute `sd = meanSd(y[j*]).sd`; add `d·sd·x[i]`, ×`HETERO_MULTIPLIER` for rows in the hetero subgroup when active. **Extending N never re-rolls** — one pass generates 400 rows in row order; windows are prefixes (§3.8).

**Steps:**
- [ ] **RED**: `dgp.test.ts` — Cholesky matches python fixture (add gen to `scripts/gen_stat_fixtures.py`, tol 1e-12); PSD (all diag > 0); over 200 seeds: corr(age, income-log) within ±0.05 of R-implied, treatment share 0.5±0.05, median excess kurtosis(Y1) > 1 (heavy tail), mean pairwise corr(Yi,Yj) ∈ [0.15, 0.45], age ∈ [22,70], Y4 ∈ [1,10], Y3 integer ≥ 0; determinism: `generateDataset(42, null)` twice → identical Float64Array bytes; effect: with `{outcome:0, d:0.25}` mean(Y1|X=1)−mean(Y1|X=0) ≈ 0.25·sd within noise over 50 seeds; prefix property: rows 0–199 identical whether or not you look at 200–399.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: deterministic DGP with heavy tails, confounded treatment, effect injection`.

---

