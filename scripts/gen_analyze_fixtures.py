#!/usr/bin/env python3
"""Generate T7 (analyze.ts) fixtures: a hand-checkable 12-row dataset run
through 6 specs covering the full filter -> transform -> exclude -> OLS -> p
pipeline (master spec docs/implementation_plan.md §3.4, §3.5).

This is T7's OWN fixture script (controller amendment: NOT appended to T2's
scripts/gen_stat_fixtures.py -- same rationale as T3's gen_dgp_fixtures.py,
one file per parallel-dispatch task). Output: tests/engine/fixtures/micro12.json

Run with:  uv run --with numpy,scipy python scripts/gen_analyze_fixtures.py
Fallback:  python3 -m venv /tmp/phackle-analyze-venv && \
           /tmp/phackle-analyze-venv/bin/pip install numpy scipy && \
           /tmp/phackle-analyze-venv/bin/python scripts/gen_analyze_fixtures.py

Independently re-implements the pinned pipeline semantics in plain
numpy/scipy (normal-equations OLS via np.linalg.solve/inv, scipy's t
survival function) rather than importing anything from the TS engine, so a
match against src/engine/analyze.ts is a genuine cross-check, the same way
T2/T3's fixtures cross-check stats.ts/dgp.ts.

Dataset design (12 rows, indices 0-11):
  - urban:      rows 0-5 urban(1), rows 6-11 rural(0).
  - age:        [25,30,35,45,50,55,28,32,60,22,48,38] -> age_lt40 = rows
                {0,1,2,6,7,9,11} (7), age_ge40 = rows {3,4,5,8,10} (5).
  - experience: [1,2,0,2,1,0,2,1,0,2,1,0] -> exp_high(==2) = rows {1,3,6,9},
                exp_low(==0) = rows {2,5,8,11}.
  - x:          alternating 1,0,... so every subgroup used below has both
                treatment arms present (no accidental collinearity-by-constant-x).
  - y0:         urban rows [10, 10.2, 9.8, 10.1, 9.9, 13] (all positive, tight
                cluster except row 5's 13 -- a mild outlier *relative to the
                urban-only spread*), rural rows [0, 5, -5, 20, -10, 25] (wide,
                includes negatives) -- deliberately chosen so a z-exclusion
                computed on the full 12-row sample and one computed on the
                urban-filtered 6-row sample disagree about row 5 (see spec A).
  - y1:         y0 + 100 (all positive, used by spec E to exercise a second
                outcome index and an unshifted log1p on a different subgroup).

Six specs (mix of subgroup/exclusion/transform/tails/covariates), each
proving a specific pinned rule:
  A. urban, exclusion=z2, transform=raw, no covariates, two-tailed.
     PROVES z-exclusion order: within the urban-only sample (mean~10.5,
     sd~1.23), row 5 (y=13) has z~2.03 -> excluded. Computed the *wrong*
     way (z across all 12 rows first, mean~8.17, sd~9.74) row 5's z~0.50 ->
     would NOT be excluded. n=5, excludedCount=1 pins the correct order.
  B. all, exclusion=none, transform=log1p, income covariate, two-tailed.
     PROVES shift-when-negative: min(y0)=-10 over the *filtered* (= whole
     window here) sample, so log1p shifts by -(-10)=10 (log(11+y)).
  C. urban, exclusion=none, transform=log1p, no covariates, two-tailed.
     PROVES shift-only-when-negative's other half: urban's own min is 9.8
     (>0), so log1p is applied UNSHIFTED (log(1+y)) -- contrast with B.
  D. age_ge40, exclusion=z2_5, transform=raw, risk covariate, one-tailed.
     Different subgroup/exclusion/covariate combo; whichever sign its t
     comes out as covers one direction of the one-tailed rule.
  E. exp_high, exclusion=z3, transform=log1p, no covariates, two-tailed,
     outcome index 1 (y1 = y0+100, so log1p is unshifted here too --
     exercises outcome-index selection with a distinct subgroup).
  F. exp_low, exclusion=none, transform=raw, income+risk covariates,
     one-tailed. n=4 rows, p=4 predictors (intercept+x+income+risk) ->
     df=0: OLS itself is invalid (not just insufficient-MIN_CELL) --
     the "OLS reports invalid" fork of PathResult.valid, whichever sign
     its (degenerate) t comes out as covers the other one-tailed direction.

Every one of the 6 specs ends up with valid=False regardless of the above:
this is a 12-row dataset and MIN_CELL=30, so post-exclusion n <= 12 < 30
always -- that's expected and still worth pinning exactly (valid=False is a
real assertion, not a vacuous one), while beta/se/t/p are real, hand-checkable
numbers wherever OLS itself can run (every spec except F). The n=30/29 MIN_CELL
*boundary* itself is exercised separately in analyze.test.ts with a synthetic
Dataset built for exactly that purpose (30 rows valid, 29 invalid) -- a
12-row fixture can't reach 30 no matter what it's fed, so it can't stand in
for that boundary check.

`ci` is bonus-verified (not required by the brief's "pins beta/se/t/p/
excludedCount/valid" list) via the *same* bisection algorithm (20 iterations,
bracket [0,100], same >0.05-keeps-searching-right rule) that
src/engine/analyze.ts uses, over scipy's own two-tailed p -- mirroring the
algorithm rather than using scipy.stats.t.ppf keeps the comparison bound by
the tTwoTailedP-vs-scipy agreement already validated to 1e-10 relative in
T2's stats fixtures, not by "how precise is a 20-step bisection vs an exact
ppf" (a much looser, unrelated bound).
"""

import json
import math
import os

import numpy as np
from scipy import stats

ROUND = 12  # decimal places, per brief

MIN_CELL = 30  # src/game/tuning.ts MIN_CELL -- mirrored, not imported (Python has no TS import)

# ---- the 12-row hand-checkable dataset ----

AGE = [25, 30, 35, 45, 50, 55, 28, 32, 60, 22, 48, 38]
URBAN = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
EXPERIENCE = [1, 2, 0, 2, 1, 0, 2, 1, 0, 2, 1, 0]
INCOME = [30000, 45000, 25000, 60000, 35000, 50000, 28000, 40000, 70000, 22000, 48000, 33000]
RISK = [0.30, 0.50, 0.20, 0.60, 0.40, 0.55, 0.25, 0.45, 0.65, 0.15, 0.50, 0.35]
X = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
Y0 = [10, 10.2, 9.8, 10.1, 9.9, 13, 0, 5, -5, 20, -10, 25]
Y1 = [v + 100 for v in Y0]
Y2 = list(Y0)  # unused by any of the 6 specs; present only to fill Dataset's shape
Y3 = list(Y0)  # ditto

N = 12
assert len(AGE) == len(URBAN) == len(EXPERIENCE) == len(INCOME) == len(RISK) == len(X) == len(Y0) == N


def r(v: float) -> float:
    return round(float(v), ROUND)


# ---- pipeline, independently re-implemented (numpy/scipy ground truth) ----


def in_subgroup(subgroup: str, i: int) -> bool:
    if subgroup == "all":
        return True
    if subgroup == "age_lt40":
        return AGE[i] < 40
    if subgroup == "age_ge40":
        return AGE[i] >= 40
    if subgroup == "exp_high":
        return EXPERIENCE[i] == 2
    if subgroup == "exp_low":
        return EXPERIENCE[i] == 0
    if subgroup == "urban":
        return URBAN[i] == 1
    if subgroup == "rural":
        return URBAN[i] == 0
    raise ValueError(f"unknown subgroup {subgroup!r}")


def apply_transform(y: list[float], transform: str) -> list[float]:
    if transform == "raw":
        return list(y)
    assert transform == "log1p"
    min_y = min(y) if y else float("inf")
    shift = min(0.0, min_y)
    return [math.log(1 + v - shift) for v in y]


def z_scores(v: list[float]) -> np.ndarray:
    arr = np.array(v, dtype=float)
    mean = arr.mean()
    sd = arr.std(ddof=1)  # n-1, matches stats.ts meanSd
    return (arr - mean) / sd


def two_tailed_p(t: float, df: float) -> float:
    return float(2.0 * stats.t.sf(abs(t), df))


def critical_t(df: float) -> float:
    """Mirrors src/engine/analyze.ts's criticalT exactly: bisection on
    [0, 100], 20 iterations, searching for tTwoTailedP(t, df) == 0.05."""
    lo, hi = 0.0, 100.0
    for _ in range(20):
        mid = (lo + hi) / 2.0
        if two_tailed_p(mid, df) > 0.05:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


EXCLUSION_THRESHOLD = {"z3": 3.0, "z2_5": 2.5, "z2": 2.0}
Y_SERIES = [Y0, Y1, Y2, Y3]


def run_spec(spec: dict, n: int) -> dict:
    outcome = spec["outcome"]
    subgroup = spec["subgroup"]
    covariates = spec["covariates"]
    exclusion = spec["exclusion"]
    transform = spec["transform"]
    tails = spec["tails"]

    filtered_idx = [i for i in range(n) if in_subgroup(subgroup, i)]
    raw_y = [Y_SERIES[outcome][i] for i in filtered_idx]
    transformed = apply_transform(raw_y, transform)

    if exclusion == "none":
        kept_local = list(range(len(transformed)))
    else:
        threshold = EXCLUSION_THRESHOLD[exclusion]
        z = z_scores(transformed)
        kept_local = [i for i in range(len(z)) if abs(z[i]) <= threshold]

    excluded_count = len(transformed) - len(kept_local)
    final_n = len(kept_local)

    orig_idx = [filtered_idx[i] for i in kept_local]
    x_arr = np.array([X[i] for i in orig_idx], dtype=float)
    y_arr = np.array([transformed[i] for i in kept_local], dtype=float)

    cov_cols = []
    if covariates["income"]:
        cov_cols.append(np.array([math.log(INCOME[i]) for i in orig_idx], dtype=float))
    if covariates["risk"]:
        cov_cols.append(np.array([RISK[i] for i in orig_idx], dtype=float))

    p_predictors = 2 + len(cov_cols)
    df = final_n - p_predictors

    if df <= 0:
        # Mirrors ols()'s own df<=0 guard in stats.ts: OLS itself is invalid,
        # independent of the separate MIN_CELL check.
        return {
            "n": final_n,
            "beta": 0.0,
            "se": 0.0,
            "t": 0.0,
            "p": 1.0,
            "ci": [0.0, 0.0],
            "excludedCount": excluded_count,
            "valid": False,
        }

    design_cols = [np.ones(final_n), x_arr, *cov_cols]
    design = np.column_stack(design_cols)
    xtx = design.T @ design
    xty = design.T @ y_arr
    beta_full = np.linalg.solve(xtx, xty)
    resid = y_arr - design @ beta_full
    rss = float(resid @ resid)
    sigma2 = rss / df
    xtx_inv = np.linalg.inv(xtx)
    se_full = np.sqrt(sigma2 * np.diag(xtx_inv))

    beta = float(beta_full[1])
    se = float(se_full[1])
    t = beta / se
    p2 = two_tailed_p(t, df)
    p_value = p2 if tails == "two" else (p2 / 2.0 if t > 0 else 1.0 - p2 / 2.0)
    tcrit = critical_t(df)
    ci = [beta - tcrit * se, beta + tcrit * se]
    valid = final_n >= MIN_CELL  # OLS itself is valid here (df>0, non-singular by design)

    return {
        "n": final_n,
        "beta": beta,
        "se": se,
        "t": t,
        "p": p_value,
        "ci": ci,
        "excludedCount": excluded_count,
        "valid": valid,
    }


SPECS = [
    {
        "name": "A_urban_z2_raw_order_proof",
        "spec": {
            "outcome": 0,
            "subgroup": "urban",
            "covariates": {"income": False, "risk": False},
            "exclusion": "z2",
            "transform": "raw",
            "tails": "two",
        },
    },
    {
        "name": "B_all_log1p_shifted_income",
        "spec": {
            "outcome": 0,
            "subgroup": "all",
            "covariates": {"income": True, "risk": False},
            "exclusion": "none",
            "transform": "log1p",
            "tails": "two",
        },
    },
    {
        "name": "C_urban_log1p_unshifted",
        "spec": {
            "outcome": 0,
            "subgroup": "urban",
            "covariates": {"income": False, "risk": False},
            "exclusion": "none",
            "transform": "log1p",
            "tails": "two",
        },
    },
    {
        "name": "D_age_ge40_z2_5_risk_onetail",
        "spec": {
            "outcome": 0,
            "subgroup": "age_ge40",
            "covariates": {"income": False, "risk": True},
            "exclusion": "z2_5",
            "transform": "raw",
            "tails": "one",
        },
    },
    {
        "name": "E_exp_high_z3_log1p_outcome1",
        "spec": {
            "outcome": 1,
            "subgroup": "exp_high",
            "covariates": {"income": False, "risk": False},
            "exclusion": "z3",
            "transform": "log1p",
            "tails": "two",
        },
    },
    {
        "name": "F_exp_low_both_covs_df0_onetail",
        "spec": {
            "outcome": 0,
            "subgroup": "exp_low",
            "covariates": {"income": True, "risk": True},
            "exclusion": "none",
            "transform": "raw",
            "tails": "one",
        },
    },
]


def main() -> None:
    cases = []
    for entry in SPECS:
        result = run_spec(entry["spec"], N)
        cases.append(
            {
                "name": entry["name"],
                "spec": entry["spec"],
                "n": result["n"],
                "beta": r(result["beta"]),
                "se": r(result["se"]),
                "t": r(result["t"]),
                "p": r(result["p"]),
                "ci": [r(result["ci"][0]), r(result["ci"][1])],
                "excludedCount": result["excludedCount"],
                "valid": result["valid"],
            }
        )

    # Precision-floor sanity check (T2's "precision trap" lesson): 12 decimal
    # *places* only keeps a meaningful number of significant figures if p (or
    # beta/se/t) isn't already tiny. Every non-degenerate case here should be
    # comfortably clear of that floor.
    for case in cases:
        if case["p"] not in (0.0, 1.0) and abs(case["p"]) < 1e-6:
            raise RuntimeError(f"{case['name']}: p={case['p']!r} too close to the 12-decimal floor")

    out = {
        "dataset": {
            "age": AGE,
            "urban": URBAN,
            "experience": EXPERIENCE,
            "income": INCOME,
            "risk": RISK,
            "x": X,
            "y0": Y0,
            "y1": Y1,
            "y2": Y2,
            "y3": Y3,
        },
        "specs": cases,
    }

    out_dir = os.path.join(os.path.dirname(__file__), "..", "tests", "engine", "fixtures")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "micro12.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")

    print(f"Wrote {len(cases)} specs to {out_path}")
    for case in cases:
        print(
            f"  {case['name']}: n={case['n']} excluded={case['excludedCount']} "
            f"valid={case['valid']} beta={case['beta']} se={case['se']} "
            f"t={case['t']} p={case['p']} ci={case['ci']}"
        )


if __name__ == "__main__":
    main()
