#!/usr/bin/env python3
"""Generate T3 (dgp.ts) fixtures: the 8x8 AR(1) correlation matrix's Cholesky
factor, and the standard-normal tertile cutoff used to bucket `experience`.

This is T3's OWN fixture script, separate from T2's scripts/gen_stat_fixtures.py,
by explicit controller-approved deviation from the task brief (parallelism —
two agents writing the same file would collide). Output: tests/engine/fixtures/chol_fixture.json

Run with:  uv run --with numpy,scipy python scripts/gen_dgp_fixtures.py
Fallback:  python3 -m venv /tmp/phackle-dgp-venv && \
           /tmp/phackle-dgp-venv/bin/pip install numpy scipy && \
           /tmp/phackle-dgp-venv/bin/python scripts/gen_dgp_fixtures.py

Master spec docs/implementation_plan.md §3.2: "L ~ MVN(0, R8) via Cholesky of a
fixed 8x8 correlation matrix R ... the exact matrix is a checked-in constant
with its Cholesky factor precomputed and unit-tested for PSD." Task T3 brief
pins R[i][j] = 0.35^|i-j|.
"""

import json
from pathlib import Path

import numpy as np
from scipy.stats import norm

RHO = 0.35
DIM = 8


def build_r(rho: float, dim: int) -> np.ndarray:
    idx = np.arange(dim)
    exponent = np.abs(idx[:, None] - idx[None, :])
    return rho**exponent


def main() -> None:
    r = build_r(RHO, DIM)

    # Sanity: symmetric, unit diagonal, positive definite (all eigenvalues > 0).
    assert np.allclose(r, r.T), "R must be symmetric"
    assert np.allclose(np.diag(r), 1.0), "R must have unit diagonal"
    eigvals = np.linalg.eigvalsh(r)
    assert np.all(eigvals > 0), f"R must be PSD (positive definite); eigvals={eigvals}"

    chol = np.linalg.cholesky(r)  # numpy returns lower-triangular L s.t. L @ L.T == R
    assert np.allclose(chol @ chol.T, r, atol=1e-13), "L @ L.T must reconstruct R"

    tertile_z = norm.ppf(2.0 / 3.0)  # standard-normal 2/3 quantile, for tertiles of L3

    fixture = {
        "rho": RHO,
        "dim": DIM,
        "R": r.tolist(),
        "chol": chol.tolist(),
        "tertileZ": tertile_z,
    }

    out_path = Path(__file__).resolve().parent.parent / "tests" / "engine" / "fixtures" / "chol_fixture.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"wrote {out_path}")
    print(f"tertileZ (qnorm(2/3)) = {tertile_z!r}")


if __name__ == "__main__":
    main()
