#!/usr/bin/env python3
"""Generate golden fixtures for src/engine/stats.ts (Task T2).

Validates the engine's OLS + t-distribution math against numpy/scipy, which
use different algorithms (LAPACK solve/inv vs. our Gauss-Jordan with partial
pivoting) so any independent bug in either implementation is likely to show
up as a mismatch.

Run with:
    uv run --with numpy,scipy python scripts/gen_stat_fixtures.py
Fallback (no uv):
    python3 -m venv /tmp/phackle-fixtures-venv
    /tmp/phackle-fixtures-venv/bin/pip install numpy scipy
    /tmp/phackle-fixtures-venv/bin/python scripts/gen_stat_fixtures.py

Writes:
    tests/engine/fixtures/ols_fixtures.json
    tests/engine/fixtures/tcdf_fixtures.json
"""

import json
import os

import numpy as np
from scipy import stats

ROUND = 12  # decimal places, per brief


def r(v: float) -> float:
    return round(float(v), ROUND)


def rlist(arr: np.ndarray) -> list[float]:
    return [r(v) for v in np.asarray(arr).tolist()]


# Floor on |p| for non-collinear OLS fixtures. The fixture rounds to 12
# *decimal places*, not 12 significant figures, so a tiny p loses precision
# fast: p~1e-6 keeps ~6 significant figures, p~1e-12 keeps essentially none.
# At p >= MIN_P, rounding to 12 decimals introduces relative error of at most
# ~0.5e-12/MIN_P, which must stay well under the 1e-9 relative tolerance the
# fixtures are checked against -- MIN_P=1e-2 gives a ~20x safety margin.
MIN_P = 1e-2
MAX_RESAMPLE_ATTEMPTS = 50


def _build_case(name: str, n: int, n_covs: int, seed: int, collinear: bool) -> dict:
    """One draw of an OLS fixture: y regressed on [1, x, covs...].

    Inputs are rounded to 12 decimals *before* fitting, so the fitted values
    stored alongside them are computed from exactly the numbers a reader of
    the JSON (the TS engine) will see -- not from higher-precision numbers
    that were later rounded away. That keeps the only source of TS-vs-numpy
    discrepancy the genuine algorithmic difference between Gauss-Jordan and
    LAPACK, not a data-rounding artifact.
    """
    rng = np.random.default_rng(seed)

    # Round x to 12 decimals *immediately*, before anything derives from it.
    # This matters most for the collinear case just below: doubling an
    # already-rounded float64 is bit-for-bit exact (multiplying by 2.0 is
    # just an exponent shift, no rounding), so cov ends up *exactly* 2*x once
    # both are read back from JSON -- an unambiguously singular XtX under any
    # correct implementation. Rounding raw_x and (2*raw_x) *independently*
    # (the previous approach) can disagree in the last decimal place, since
    # round(2*raw, 12) and 2*round(raw, 12) aren't always identical -- which
    # would leave the case merely near-singular, not exactly so.
    x = np.array(rlist(rng.normal(0, 1, n)))

    if collinear:
        covs_raw = [2.0 * x]
        n_covs = 1
    else:
        covs_raw = [np.array(rlist(rng.normal(0, 1, n))) for _ in range(n_covs)]

    noise = rng.normal(0, 1.0, n)
    # Small true beta on x (relative to noise) keeps |t| moderate even at
    # n=400 (t grows ~sqrt(n)); combined with the MIN_P resample loop below,
    # this keeps every case's p comfortably measurable at 12-decimal storage.
    true_coefs = [0.5, 0.1, -0.05, 0.03]
    y = true_coefs[0] + true_coefs[1] * x + noise
    for i, c in enumerate(covs_raw):
        y = y + true_coefs[2 + i] * c
    y = np.array(rlist(y))

    entry = {
        "name": name,
        # x, covs_raw already rounded above; not re-rounding here preserves
        # the collinear case's exact 2*x relationship bit-for-bit (see
        # comment above -- a second independent round() pass is the one
        # thing that could reintroduce the last-decimal-place drift).
        "y": y.tolist(),
        "x": x.tolist(),
        "covs": [c.tolist() for c in covs_raw],
        "expect_invalid": bool(collinear),
    }

    if collinear:
        entry["beta"] = None
        entry["se"] = None
        entry["t"] = None
        entry["p"] = None
        return entry

    cols = [np.ones(n), x, *covs_raw]
    X = np.column_stack(cols)
    p = X.shape[1]
    df = n - p

    XtX = X.T @ X
    Xty = X.T @ y
    beta_full = np.linalg.solve(XtX, Xty)
    resid = y - X @ beta_full
    rss = float(resid @ resid)
    sigma2 = rss / df
    XtX_inv = np.linalg.inv(XtX)
    se_full = np.sqrt(sigma2 * np.diag(XtX_inv))

    beta = beta_full[1]
    se = se_full[1]
    t = beta / se
    p_val = 2.0 * stats.t.sf(abs(t), df)

    entry["beta"] = r(beta)
    entry["se"] = r(se)
    entry["t"] = r(t)
    entry["p"] = r(p_val)
    entry["_p_raw"] = p_val  # inspected by the caller only, stripped before writing
    return entry


def make_case(name: str, n: int, n_covs: int, seed: int, collinear: bool = False) -> dict:
    """`_build_case`, resampling the seed until |p| clears MIN_P (skipped for
    the collinear case, which has no p at all). Deterministic: always tries
    seed, seed+1, seed+2, ... in the same order.
    """
    if collinear:
        return _build_case(name, n, n_covs, seed, collinear=True)

    for attempt in range(MAX_RESAMPLE_ATTEMPTS):
        entry = _build_case(name, n, n_covs, seed + attempt, collinear=False)
        if abs(entry["_p_raw"]) >= MIN_P:
            del entry["_p_raw"]
            return entry
    raise RuntimeError(
        f"{name}: could not find a seed within {MAX_RESAMPLE_ATTEMPTS} attempts "
        f"giving |p| >= {MIN_P} (last p={entry['_p_raw']!r}) -- widen the search "
        "or adjust true_coefs."
    )


def main() -> None:
    base_seed = 20260803
    specs = [
        ("n31_0cov", 31, 0),
        ("n31_1cov", 31, 1),
        ("n31_2cov", 31, 2),
        ("n200_0cov", 200, 0),
        ("n200_1cov", 200, 1),
        ("n200_2cov", 200, 2),
        ("n400_0cov", 400, 0),
        ("n400_1cov", 400, 1),
        ("n400_2cov", 400, 2),
    ]
    # Spaced far apart (not +i) so a case's MAX_RESAMPLE_ATTEMPTS retries can
    # never wander into the seed range another case starts from.
    cases = [
        make_case(name, n, ncov, base_seed + i * 10_000) for i, (name, n, ncov) in enumerate(specs)
    ]
    cases.append(make_case("n200_collinear", 200, 1, base_seed + 999_000, collinear=True))

    out_dir = os.path.join(os.path.dirname(__file__), "..", "tests", "engine", "fixtures")
    os.makedirs(out_dir, exist_ok=True)

    ols_path = os.path.join(out_dir, "ols_fixtures.json")
    with open(ols_path, "w") as f:
        json.dump(cases, f, indent=2)
        f.write("\n")

    # t-CDF table: df x t -> two-tailed p, from scipy.stats.t.sf (survival
    # function == 1-CDF), independent of our own regularized-incomplete-beta
    # implementation. Deliberately NOT rounded to a fixed decimal count (unlike
    # the OLS fixtures): several entries (e.g. df=398, t=5) are ~1e-6..1e-7 in
    # magnitude, and 12 *decimal places* only keeps a handful of significant
    # figures at that scale -- nowhere near enough to check a 1e-10 *relative*
    # tolerance. json.dump's default float formatting round-trips the full
    # float64 precision, which is what a 1e-10 relative check actually needs.
    dfs = [10, 50, 200, 398]
    ts = [-5, -2.5, -1, 0, 1, 1.96, 2.5, 5]
    table = [{"df": df, "t": t, "p": 2.0 * stats.t.sf(abs(t), df)} for df in dfs for t in ts]

    tcdf_path = os.path.join(out_dir, "tcdf_fixtures.json")
    with open(tcdf_path, "w") as f:
        json.dump(table, f, indent=2)
        f.write("\n")

    print(f"Wrote {len(cases)} OLS fixtures to {ols_path}")
    print(f"Wrote {len(table)} t-CDF fixtures to {tcdf_path}")


if __name__ == "__main__":
    main()
