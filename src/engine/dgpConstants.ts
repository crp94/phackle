// Master spec §3.2 (data-generating process) + task T3 brief (regenerated,
// controller-ruled version). Two kinds of constants live here:
//
//   PINNED   — exact numbers dictated by the master spec / task brief. Do not
//              change these without updating the spec itself.
//   TUNABLE  — outcome loadings and the shared-error-factor strength; the
//              calibration task (§8.3) may adjust these later. Per-file
//              convention (CLAUDE.md #3): every game-balance constant lives
//              here, never inline in dgp.ts.
//
// CALIBRATION NOTE (T3, 2026-08-03): the brief's originally-printed outcome
// loadings, generated with each outcome's noise fully idiosyncratic (no
// cross-outcome sharing beyond the latents L), measured a mean pairwise
// corr(Yi,Yj) of ~0.072 over 200 seeds — well under the required [0.15, 0.45]
// band (see dgp.test.ts). A first fix attempt shrunk Y2/Y3/Y4's idiosyncratic
// noise scales to raise their signal-to-noise ratio; this hit the corr band
// but collapsed each outcome's own marginal character (Y2's log-scale sigma
// dropped enough to gut its skew below the game's log1p-transform-fork
// requirement; Y3's distinct-value count also thinned). The controller
// overrode that fix: noise-scale shrinking is FORBIDDEN as a lever here.
// Required mechanism instead (master §3.2's "correlated errors via a shared
// factor", made explicit in the regenerated brief): mix a per-row shared
// standard normal into every outcome's idiosyncratic error term,
//   epsilon_j = sqrt(1 - RHO_SHARED)*eta_j + sqrt(RHO_SHARED)*eta_shared,
// where eta_1 is the t5 draw (Y1), eta_2..eta_4 are the plain z draws
// (Y2..Y4), and eta_shared ~ N(0,1) is drawn once per row and reused across
// all four epsilon_j. Because eta_2..eta_4 and eta_shared are ALL exactly
// N(0,1) and mutually independent, epsilon_2..epsilon_4 are each exactly
// N(0,1) too (variance (1-RHO_SHARED)+RHO_SHARED=1) — Y2/Y3/Y4's marginal
// shapes are therefore completely unchanged; only their cross-outcome
// correlation rises. Y1's eta_1 (t5, variance 5/3) is not variance-matched to
// eta_shared, so mixing does cost Y1 some of its heavy-tailedness (a smaller
// t5 weight, sqrt(1-RHO_SHARED)) — RHO_SHARED was tuned (via
// scripts/gen_dgp_fixtures.py-adjacent scratch harness, not checked in) to
// hold up Y1's excess kurtosis while landing the corr band. RHO_SHARED=0.3
// (the suggested starting value) already clears every criterion: median
// kurtosis(Y1)=1.295, mean pairwise corr=0.286 (per-seed range [0.174,0.356]
// over 200 seeds), median skewness(Y2)=1.608, median distinct Y3 values=9,
// median max single-value frequency=0.372 — no further tuning was needed.
//
// RE-MEASURED (gr6-101, 200 fresh seeds independent of the ones above): median
// excess kurtosis(Y1) 1.303, median skewness(Y2) 1.694, median distinct Y3
// values 9, median max single-value frequency 0.378, mean pairwise corr 0.285
// with a per-seed range of [0.223, 0.362] and 0 of 200 seeds outside the
// required [0.15, 0.45]. Every number above reproduces.
//
// One phrase in the original note did not, and is corrected here: it said this
// tuning keeps median excess kurtosis(Y1) "comfortably above 1". The MEDIAN is
// 1.30 — but 74 of those 200 seeds (37%) have excess kurtosis <= 1. Y1's heavy
// tail is a property of the FAMILY, not a guarantee on any given day: better
// than a third of days do not deliver it. That is the honest statement of what
// RHO_SHARED=0.3 buys. A per-day guarantee would be a RHO_SHARED retune with
// knock-on effects on the whole calibration suite (the corr band and Y1's t5
// weight move together), which is a controller decision, not a comment fix.

// ---- PINNED: latent structure (§3.2) ----
export const AR1_RHO = 0.35; // R[i][j] = AR1_RHO^|i-j|, 8x8, PSD by construction
export const LATENT_DIM = 8;

// ---- PINNED: covariate constructions (§3.2 table) ----
export const AGE_BASE = 46;
export const AGE_L1_COEF = 12;
export const AGE_MIN = 22;
export const AGE_MAX = 70;
export const URBAN_L1_COEF = 0.3; // urban = 1[L2 + URBAN_L1_COEF*L1 > 0]
export const INCOME_BASE = 10.5;
export const INCOME_L4_COEF = 0.6; // income = exp(INCOME_BASE + INCOME_L4_COEF*L4)
export const RISK_BASE = 5;
export const RISK_L5_COEF = 2;
export const RISK_MIN = 0;
export const RISK_MAX = 10;

// TERTILE_Z: qnorm(2/3), the standard-normal 2/3 quantile — NOT a game-balance
// tunable, a mathematical constant fixed by L3's standard-normal marginal (R's
// diagonal is 1 by construction). Computed via scripts/gen_dgp_fixtures.py
// (scipy.stats.norm.ppf(2/3)) and cross-checked against the checked-in fixture
// (tests/engine/fixtures/chol_fixture.json) by dgp.test.ts.
export const TERTILE_Z = 0.43072729929545744;

// ---- PINNED: treatment assignment (§3.2) ----
// X = 1[TREATMENT_L1_COEF*L1 + TREATMENT_L4_COEF*L4 + TREATMENT_EPS_COEF*eps > 0]
export const TREATMENT_L1_COEF = 0.3;
export const TREATMENT_L4_COEF = 0.2;
export const TREATMENT_EPS_COEF = 0.94;

// ---- TUNABLE: shared error factor (master §3.2 "corr ~= 0.3 via a shared
// factor"; regenerated brief + controller ruling pin the mechanism, RHO_SHARED
// itself is tunable) ----
export const RHO_SHARED = 0.3;

// ---- TUNABLE: outcome loadings (calibration task may adjust; §3.9). Every
// value below is exactly as printed in the brief — untouched by the
// correlation-band fix (see CALIBRATION NOTE above). ----

// Y1 = l1*L1 + l4*L4 + l6*L6 + t5Scale*eps1   (heavy-tailed; eps1 mixes in the
// shared factor per the note above)
export const Y1_LOADINGS = { l1: 0.2, l4: 0.2, l6: 0.15, t5Scale: 1.0 };

// Y2 = exp(lScale*(l1*L1 + l5*L5 + l6*L6) + zScale*eps2)   (positive skew)
export const Y2_LOADINGS = { lScale: 0.4, l1: 0.15, l5: 0.25, l6: 0.15, zScale: 0.5 };

// Y3 = round(exp(base + l3*L3 + l4*L4 + l6*L6 + zScale*eps3))   (count)
export const Y3_LOADINGS = { base: 0.8, l3: 0.15, l4: 0.15, l6: 0.15, zScale: 0.4 };

// Y4 = clamp(round(base + lScale*(l5*L5 + l6*L6) + zScale*eps4), min, max)
export const Y4_LOADINGS = { base: 5.5, lScale: 1.4, l5: 0.2, l6: 0.15, zScale: 1.4, min: 1, max: 10 };
