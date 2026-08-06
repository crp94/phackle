// Master spec §8.3 — the statistical calibration suite. "This suite is the
// game's balance sheet — M1 is not done until it passes."
//
// Run with: PATH="/usr/bin:$PATH" npx tsx scripts/simulate_calibration.ts
//        or: npm run cal
//
// Simulates 500 null + 500 effect SYNTHETIC days (not calendar dates — these
// are Monte Carlo draws, not the daily rotation), asserts the five §3.9
// calibration bands, regenerates src/data/p_hit_by_k.json, and exits non-zero
// on any band miss.
//
// ============================================================================
// DAY SAMPLING
// ============================================================================
// Day i's identity seed is `fnv1a32('cal:' + i)`. Its day type is whatever
// seeds.ts's own dayTypeFor() says for that seed (P(effect) = 25%), so we walk
// i = 0, 1, 2, ... and keep the first DAYS_PER_TYPE of each type — the type is
// a pure hash, so days we do not need are skipped before any data is
// generated. Each kept day is then built by the REAL assembly path,
// generatePractice(seed, SCENARIO_COUNT) (day.ts), which runs the real §3.3
// rejection-sampling acceptance loop and reports the real `attemptUsed`. No
// re-implementation of the acceptance loop lives in this file: a calibration
// suite that measured its own copy of the engine would certify nothing.
//
// ============================================================================
// (a) IS MEASURED **AFTER** ACCEPTANCE, (c) **BEFORE** — and why they differ
// ============================================================================
// The §3.3 acceptance loop is a rejection sampler that conditions on exactly
// the quantities (a) and (c) are about:
//   - null day: accepted iff sigCount@200 lands in NULL_SIG_BAND = [30, 180];
//   - effect day: accepted iff the canonical spec has p@400 < .05 (and
//     p@200 < .15).
// So the population each band is measured over is a real decision, not a
// detail. The rule used here: measure over the population whose band the
// acceptance gate does NOT already dictate the answer for.
//
//   (a) is ASSERTED on ACCEPTED days. Its target — "≥30 significant paths" —
//       is literally NULL_SIG_BAND's lower edge, and §3.3 is the "hackability
//       guarantee" whose whole job is to deliver that floor. Reading (a) as a
//       claim about RAW draws would make the sampler's floor redundant, and
//       would not explain why the target is 99% rather than 100%: 99% is
//       exactly what a MAX_ATTEMPTS fallback can cost. Measured this way the
//       band is not a tautology — it fails if MAX_ATTEMPTS is too small for
//       the band's acceptance rate, which is a live design risk.
//       The raw-draw rate is measured and printed too (row `a-raw`): it is
//       the honest statement of how much work the sampler does.
//
//   (c) is ASSERTED on an UNCONDITIONED raw draw. Post-acceptance it is
//       1.000 by construction and could never land in [0.6, 0.85] under ANY
//       setting of ANY tunable — a band no legal tuning can satisfy is a
//       mis-measurement, not a mis-tuning. The raw figure is also exactly
//       what §3.9's tuning table asks for: "Effect size d range — calibrate
//       so canonical-spec power at N=400 ≈ 0.6–0.8", a property of the d
//       range, not of the accepted sample. The accepted rate is printed as a
//       diagnostic (expected: 1.000).
//
// Raw draws use their own stream, `fnv1a32('calraw:' + i)`, with the day's
// own effect parameters — deliberately NOT the acceptance loop's attempt-0
// seed, so this file never hard-codes day.ts's internal seed derivation.
//
// ============================================================================
// THE THREE EXPLORERS  (band b, and the p_hit table)  — GR6 RULING §1(k)
// ============================================================================
// §3.9(b) pins a band on "median paths to first hit for a greedy random
// explorer", and the number it certifies (11) describes ONE explorer of at
// least three, which is the finding gr2-012 raised and ruling §1(k) resolves
// REPORT-ONLY: no constant changes and no band moves, but the report must name
// which explorer the certified number describes and measure the others beside
// it. All three are now printed, from the SAME enumerated curve:
//
//   1. PERMUTATION (the band-(b) explorer, and the p_hit table's). One walk =
//      a uniformly random permutation of all 1,792 specs (seeded Fisher–Yates
//      on mulberry32), walked in order without replacement, stopping at the
//      FIRST significant path (valid && p < .05) at N = 200 — the window every
//      player starts in (§3.8). "Paths to first hit" is that path's 1-based
//      position. Invalid specs ("insufficient data") COUNT as paths walked:
//      the player spent a fork on them and saw a result. Band (b) uses exactly
//      ONE walk per day (walk #0), per the pinned definition. THIS EXPLORER
//      CANNOT BE PLAYED: it teleports to an arbitrary spec on every step,
//      while the Lab affords exactly one knob-change at a time.
//   2. SINGLE-KNOB WALK (what the interface actually affords). Starts on the
//      lab default — the spec the player is looking at when the screen opens,
//      counted as path 1 — and each step moves to a uniformly random
//      ONE-KNOB neighbour of the current spec. Same stopping rule, capped at
//      WALK_MAX_STEPS moves. This is the honest model of a player who is
//      turning dials without a plan.
//   3. GREEDY HILL-CLIMB (what a competent player does). Same start, but each
//      step moves to the neighbour with the SMALLEST p, deterministically.
//      Capped the same way. This is the fast end of the range.
//
// The walk and the climb are informational rows with their own pinned ranges
// (see `informational` below); neither gates the exit code, because §3.9(b) is
// a band on the permutation explorer and re-basing a certified target is a
// ruling, not a measurement. What they gate is honesty: printed together, the
// report states the spread instead of implying that one number describes every
// player. Both are read off the curve this suite has already enumerated, so
// they cost array lookups rather than regressions.
//
// MEASURED WHEN THE ROWS WERE ADDED (1,000 days, medians over the served
// 75/25 mix): permutation 11 · single-knob walk 18 · greedy climb 2. The 4x
// spread gr2-012 reported is real and is now on the report rather than in a
// finding document.
//
// AND ONE CORRECTION TO THE RULING'S OWN EXPECTATION, because it was checked
// rather than assumed. §1(k) says "(d)'s predicate independently shortens the
// 'never find anything' tail, so re-measure the walk after (d) lands". It does
// not: it lengthens it slightly. Measured on this tree against a control copy
// identical except that day.ts is HEAD's (no §1(d) gate), same explorer code,
// same seeds — walk median 15 -> 18, walk 60-move miss rate 0.150 -> 0.166,
// permutation miss 0.066 -> 0.070, climb median 2 -> 2. The direction is
// obvious in hindsight: §1(d) removes the days on which the lab default is
// ALREADY significant, and those are exactly the days an interface-shaped
// explorer solves on its first path. Nothing here changes the ruling — band
// (b) is still report-only and no constant moved — but the "re-measure before
// considering option (b)" instruction now has its measurement, and the answer
// is that the tail did not shrink.
//
// WHERE THE §3.9b PROSE CORRECTION LIVES. In this file, on band (b)'s own row
// and in this header — NOT in docs/implementation_plan.md, which is the frozen
// master spec (untouched since the seed commit; every GR6 deviation is recorded
// at the code that deviates, per the house rule the other waves followed).
//
// POPULATION (controller adjudication, 2026-08-03). Band (b) is ASSERTED on
// the median over the DAILY MIX — 75% null / 25% effect, i.e. the mix the
// game actually serves — not over null days alone. §3.9 never pinned the day
// population, and the pacing a player feels is the pacing of the mix: they do
// not know the day type when they start hacking; that IS the game. Measured:
// mix 11 (in [4, 12]); null-only 15; effect-only 4.
// The null-only median is ALSO reported, informationally, against a [4, 16]
// band — it is the slower half of the mix and worth watching, but it is not
// the player-experience statistic and does not gate the suite.
//
// ============================================================================
// THE INFORMED CALLER  (band d)
// ============================================================================
// For this simulation the "published spec" is the spec the greedy explorer's
// walk #0 stopped on (the first thing a random hacker would have written up);
// a day where the walk finds nothing significant resolves as a "noise" call.
// Significant paths are counted on the same N = 200 curve.
//
// THE STATISTIC (controller adjudication, 2026-08-03) — READ THIS BEFORE
// COMPARING THE CODE TO §3.9d, BECAUSE THEY DELIBERATELY DIFFER.
//
// §3.9d sketches the rule as "calls real iff the published spec's outcome
// family holds >= 60% of the day's significant paths" — a family's SHARE OF
// THE DAY'S HITS. That literal rule was implemented and measured first, and
// it is information-theoretically broken under this DGP:
//
//   * null-day landed-share  p10=0.197 p25=0.380 p50=0.600 p75=0.844
//     effect-day landed-share p10=0.151 p25=0.345 p50=0.675 p75=0.880
//     — essentially the same distribution; the statistic barely separates.
//   * At §3.9d's own 60% threshold: 0.515 weighted / 0.534 balanced.
//   * Swept over EVERY threshold from 0.30 to 0.90, its best weighted
//     accuracy is 0.655 and its best balanced accuracy is 0.534. The
//     always-say-"noise" base rate is 0.750. The rule therefore never beats
//     guessing, at any threshold — so no re-thresholding and no tuning of any
//     constant could ever bring it into [0.75, 0.90].
//   * Mechanism: the 448 specs inside one outcome family all read the SAME Y
//     column, so a single lucky sample-level corr(X, Y_j) lights up hundreds
//     of paths at once. Null days therefore cluster into families just as
//     hard as effect days do (null max-family share p50 = 0.697, with the
//     dominant family varying across Y1..Y4 at 160/109/134/97 of 500 days —
//     genuine per-draw lumpiness, not a fixed confound). The explorer lands
//     in a family with probability equal to its share, so the rule fires
//     "real" on about half of null days by construction.
//
// The ADOPTED statistic is family DENSITY: the significant fraction WITHIN
// the published spec's own 448-path family (sigInFamily / 448), same >= 60%
// threshold. That is what §2.7.6 actually teaches — "significance clustering
// on the true outcome ... robustness across specifications is the real/noise
// detection skill", and null days show "hits scattered THINLY everywhere",
// which is a statement about density, not about share. Measured: 0.822
// weighted (specificity 1.000, sensitivity 0.288) — inside [0.75, 0.90], with
// +7.2pp of real skill headroom over the 0.750 base rate, which is exactly
// what §3.9's risk table asks the band to guarantee.
// The literal share rule is still computed and printed as an informational
// row, so this decision stays auditable from the suite's own output.
//
// ACCURACY WEIGHTING. This simulation's day mix is 50/50, but the game's is
// P_EFFECT_PCT (25% effect). The band is asserted on the mix the game
// actually serves: accuracy = (1 - pEffect)*specificity + pEffect*sensitivity.
// That is not a free choice — §3.9's own risk table pins the meaning of the
// 0.75 floor: "The call is guessable (base rate 75% 'noise' → always-say-
// noise = 75%) ... informed-caller target band (§3.9d) ensures real skill
// headroom." The band floor IS the always-say-noise baseline, which is only
// true under the served mix. The balanced 50/50 figure is printed too.
//
// ============================================================================
// DETERMINISM
// ============================================================================
// Same op set as src/engine/** (§3.1): no Math.random, no Date.now, no
// new Date anywhere in the measurement path. Every draw comes from a named,
// seeded stream, so two runs of this script on the same tree produce
// byte-identical output and a byte-identical p_hit_by_k.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSpec } from '../src/engine/analyze';
import { canonicalSpecFor, generatePractice, LAB_DEFAULT_SPEC } from '../src/engine/day';
import type { EffectSpec } from '../src/engine/dgp';
import { generateDataset } from '../src/engine/dgp';
import { fnv1a32, mulberry32 } from '../src/engine/prng';
import { P_HIT_MAX_K, pHitTableChecksum } from '../src/engine/reveal';
import { dayTypeFor, effectParamsFor } from '../src/engine/seeds';
import type { CurvePoint } from '../src/engine/specGrid';
import { allSpecs, AXES, enumerateCurve, sigCount, specKey } from '../src/engine/specGrid';
import type { DayType, Outcome, Spec } from '../src/engine/types';
import { EFFECT_D_RANGE, HETERO_MULTIPLIER, MAX_ATTEMPTS, NULL_SIG_BAND, P_EFFECT_PCT } from '../src/game/tuning';

// ---- run parameters ----

const DAYS_PER_TYPE = 500; // §8.3: "500 null + 500 effect days"
const SCENARIO_COUNT = 20; // production scenario count (T6), only feeds scenarioId
const CURVE_N = 200; // the window a player starts in (§3.8)
const SIG_ALPHA = 0.05;
// §3.9d's "≥60%". The threshold is unchanged by the 2026-08-03 adjudication —
// only the statistic it is applied to (family DENSITY, not family share).
const FAMILY_THRESHOLD = 0.6;
// §3.9a's "at least 30 significant paths". Deliberately a literal 30 and NOT
// `NULL_SIG_BAND[0]`, even though the two coincide today: the band's floor is
// a TUNABLE the calibration suite may move, and if it moves, §3.9a's promise
// to the player ("you can always find 30 forking paths") must not silently
// move with it — that would turn this assertion into a mirror.
const HACKABILITY_MIN_SIG = 30;

// p_hit table: one uniformly random permutation per (day, draw); the k-subset
// for every k is that permutation's first k entries, which is exactly a
// uniform random k-subset AND makes pHit non-decreasing in k by construction
// (once a walk has hit, it has hit for every larger k). The master's design is
// one draw per day per k; the brief allows up to 5 "if variance demands", and
// it does: at 500 days x 1 draw the standard error near pHit = 0.5 is
// sqrt(.25/500) = 2.2pp, and this number is READ OUT LOUD as a headline
// percentage in the reveal ("~52% of the time", §2.7.3). Five draws cut it to
// 1.0pp for a cost of 2,500 extra 1,792-step walks over precomputed boolean
// arrays (milliseconds). Walk #0 is shared with band (b) — the two are the
// same object seen twice: P(hit within k) = P(paths-to-first-hit ≤ k).
const SUBSET_DRAWS_PER_DAY = 5;

const SPECS = allSpecs();
const PATH_COUNT = SPECS.length;
const FAMILY_SIZE = PATH_COUNT / 4; // 448 specs per outcome family

// ---- small deterministic helpers ----

/** Seeded Fisher–Yates over [0, n). mulberry32 only — no Math.random (§3.1). */
function shuffledIndices(n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const idx = new Array<number>(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  return idx;
}

// §1(k) — THE ONE-KNOB NEIGHBOUR TABLE.
//
// Built once, from `allSpecs()` and `specKey`, because both interface-shaped
// explorers below need "which specs are one dial away from this one" on every
// step and neither may re-derive it per day. Two specs are neighbours iff they
// differ on exactly ONE of the six axes — which is exactly what the Lab's six
// controls can do in a single move (the covariates count as two axes, one per
// checkbox, matching the two independent controls the screen shows).
const NEIGHBOURS: number[][] = (() => {
  const indexByKey = new Map<string, number>();
  SPECS.forEach((spec, i) => indexByKey.set(specKey(spec), i));
  const variants: ((spec: Spec) => Spec[])[] = [
    (spec) => AXES.outcome.filter((v) => v !== spec.outcome).map((v) => ({ ...spec, outcome: v })),
    (spec) => AXES.subgroup.filter((v) => v !== spec.subgroup).map((v) => ({ ...spec, subgroup: v })),
    (spec) => [{ ...spec, covariates: { ...spec.covariates, income: !spec.covariates.income } }],
    (spec) => [{ ...spec, covariates: { ...spec.covariates, risk: !spec.covariates.risk } }],
    (spec) => AXES.exclusion.filter((v) => v !== spec.exclusion).map((v) => ({ ...spec, exclusion: v })),
    (spec) => AXES.transform.filter((v) => v !== spec.transform).map((v) => ({ ...spec, transform: v })),
    (spec) => AXES.tails.filter((v) => v !== spec.tails).map((v) => ({ ...spec, tails: v })),
  ];
  return SPECS.map((spec) => {
    const out: number[] = [];
    for (const variantsOf of variants) {
      for (const neighbour of variantsOf(spec)) {
        const idx = indexByKey.get(specKey(neighbour));
        if (idx !== undefined) out.push(idx);
      }
    }
    return out;
  });
})();

/** Where both interface-shaped explorers start: the spec the Lab opens on. */
const DEFAULT_SPEC_INDEX = SPECS.findIndex((spec) => specKey(spec) === specKey(LAB_DEFAULT_SPEC));

/** The cap on both interface-shaped explorers, in moves. 60 is gr2-012's own
 * measurement horizon ("never finds anything in 60 moves on 19.3% of walks"),
 * kept so the numbers below are comparable to the finding that produced the
 * ruling. */
const WALK_MAX_STEPS = 60;

/**
 * §1(k) explorer 2 — the SINGLE-KNOB RANDOM WALK: start on the lab default
 * (counted as path 1, because the player is looking at its result before they
 * touch anything), then step to a uniformly random one-knob neighbour of the
 * CURRENT spec. Returns the 1-based path count at the first hit, or Infinity if
 * `WALK_MAX_STEPS` moves produce none. Revisits are allowed and counted — a
 * player turning dials without a plan does re-tread specs, and pretending
 * otherwise would flatter the model.
 */
function singleKnobWalkFirstHit(sig: Uint8Array, seed: number): number {
  const rng = mulberry32(seed);
  let current = DEFAULT_SPEC_INDEX;
  if (sig[current] === 1) return 1;
  for (let step = 1; step <= WALK_MAX_STEPS; step++) {
    const options = NEIGHBOURS[current];
    current = options[Math.floor(rng() * options.length)];
    if (sig[current] === 1) return step + 1;
  }
  return Infinity;
}

/**
 * §1(k) explorer 3 — the GREEDY HILL-CLIMB: same start, but each step moves to
 * the VALID neighbour with the smallest p. Deterministic (no seed): this is
 * the competent player, and the point of measuring it is the fast edge of the
 * spread, not its variance. Stops on the first significant spec, on a local
 * minimum with nowhere better to go, or at the cap.
 */
function greedyClimbFirstHit(curve: CurvePoint[], sig: Uint8Array): number {
  let current = DEFAULT_SPEC_INDEX;
  if (sig[current] === 1) return 1;
  for (let step = 1; step <= WALK_MAX_STEPS; step++) {
    let best = -1;
    let bestP = curve[current].valid ? curve[current].p : Infinity;
    for (const candidate of NEIGHBOURS[current]) {
      if (!curve[candidate].valid) continue;
      if (curve[candidate].p < bestP) {
        bestP = curve[candidate].p;
        best = candidate;
      }
    }
    if (best === -1) return Infinity; // local minimum, nothing significant
    current = best;
    if (sig[current] === 1) return step + 1;
  }
  return Infinity;
}

/** 1-based position of the first significant path along `order`, or
 * `Infinity` when the walk exhausts the whole grid without a hit. */
function firstHitPosition(sig: Uint8Array, order: number[]): number {
  for (let step = 0; step < order.length; step++) {
    if (sig[order[step]] === 1) return step + 1;
  }
  return Infinity;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Nearest-rank percentile (`q` in [0,1]). */
function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[rank - 1];
}

function mean(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return values.length === 0 ? 0 : total / values.length;
}

function fraction(flags: boolean[]): number {
  let hits = 0;
  for (const f of flags) if (f) hits++;
  return flags.length === 0 ? 0 : hits / flags.length;
}

function fixed(value: number, digits = 4): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '∞';
}

// --- DGP moment helpers (same estimators as tests/engine/dgp.test.ts) ---

function columnMean(v: Float64Array): number {
  let total = 0;
  for (let i = 0; i < v.length; i++) total += v[i];
  return total / v.length;
}

/** Excess kurtosis (population form, m4/m2^2 - 3) — dgp.test.ts's estimator
 * for the "Y1 is heavy-tailed" check (median over seeds must exceed 1). */
function excessKurtosis(v: Float64Array): number {
  const mu = columnMean(v);
  let m2 = 0;
  let m4 = 0;
  for (let i = 0; i < v.length; i++) {
    const dv = v[i] - mu;
    m2 += dv * dv;
    m4 += dv * dv * dv * dv;
  }
  m2 /= v.length;
  m4 /= v.length;
  return m4 / (m2 * m2) - 3;
}

function pearson(a: Float64Array, b: Float64Array): number {
  const ma = columnMean(a);
  const mb = columnMean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  return sab / Math.sqrt(saa * sbb);
}

/** Mean of the six pairwise corr(Yi,Yj) — dgp.test.ts requires the aggregate
 * to sit in [0.15, 0.45]. */
function meanPairwiseOutcomeCorr(y: [Float64Array, Float64Array, Float64Array, Float64Array]): number {
  const pairs: number[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) pairs.push(pearson(y[i], y[j]));
  }
  return mean(pairs);
}

/** valid && p < .05, as a flat 0/1 array parallel to `allSpecs()` order —
 * the shape the explorer walks over. */
function significanceFlags(curve: CurvePoint[]): Uint8Array {
  const flags = new Uint8Array(curve.length);
  for (let i = 0; i < curve.length; i++) {
    if (curve[i].valid && curve[i].p < SIG_ALPHA) flags[i] = 1;
  }
  return flags;
}

// ---- one simulated day ----

interface SimDay {
  index: number; // the `cal:i` index
  dayType: DayType;
  trueOutcome: Outcome | null;
  attempts: number; // 1-based: attemptUsed + 1
  // pre-acceptance (unconditioned) draw
  rawNullSig: number | null; // null days only: sigCount@200 of the raw draw
  rawCanonicalHit: boolean | null; // effect days only: canonical p@400 < .05 on the raw draw
  // post-acceptance (the day a player would actually be served)
  acceptedCanonicalHit: boolean | null; // effect days only; ~1.000 by construction (§3.3)
  acceptedSig: number;
  pathsToFirstHit: number;
  subsetHitPositions: number[]; // one per SUBSET_DRAWS_PER_DAY (walk #0 first)
  // §1(k): the two explorers the INTERFACE affords, measured beside the
  // permutation one that band (b) is certified on. Infinity = found nothing
  // within WALK_MAX_STEPS moves.
  walkFirstHit: number;
  climbFirstHit: number;
  // ADOPTED statistic (see header): family density >= 60%.
  callReal: boolean;
  callCorrect: boolean;
  // Informational: §3.9d's literal family-share rule, adjudicated out.
  callRealShare: boolean;
  callCorrectShare: boolean;
  publishedOutcomeShare: number | null; // null when the explorer found nothing
  familyShares: number[]; // per-outcome share of the day's significant paths
  familyDensities: number[]; // per-outcome: significant paths / 448 paths in that family
  landedOutcome: Outcome | null;
  // T3 watch item: excess kurtosis of Y1 on the ACCEPTED dataset (the one a
  // player actually sees), plus the mean pairwise corr(Yi,Yj) — the two DGP
  // moments dgp.test.ts holds on the tightest margins.
  kurtosisY1: number;
  meanPairwiseCorr: number;
}

function simulateDay(index: number): SimDay {
  const seed = fnv1a32(`cal:${index}`);
  const hashSource = String(seed);
  const dayType = dayTypeFor(hashSource);

  // --- pre-acceptance (unconditioned) draw, bands (a) and (c) ---
  const rawSeed = fnv1a32(`calraw:${index}`);
  let rawNullSig: number | null = null;
  let rawCanonicalHit: boolean | null = null;
  if (dayType === 'null') {
    rawNullSig = sigCount(enumerateCurve(generateDataset(rawSeed, null), CURVE_N));
  } else {
    const params = effectParamsFor(hashSource);
    const effect: EffectSpec = {
      outcome: params.outcome,
      d: params.d,
      hetero: params.hetero ? { subgroup: params.heteroSubgroup, multiplier: HETERO_MULTIPLIER } : null,
    };
    const rawData = generateDataset(rawSeed, effect);
    rawCanonicalHit = runSpec(rawData, canonicalSpecFor(params.outcome), 400).p < SIG_ALPHA;
  }

  // --- the real, accepted day (§3.3 rejection sampling runs inside here) ---
  const { puzzle, data } = generatePractice(seed, SCENARIO_COUNT);
  const curve = enumerateCurve(data, CURVE_N);
  const sig = significanceFlags(curve);
  const acceptedSig = sigCount(curve);

  // --- explorer walks: #0 drives band (b) + the call, all of them the table ---
  const subsetHitPositions: number[] = [];
  let walk0Published: number | null = null; // index into SPECS of walk #0's first hit
  for (let draw = 0; draw < SUBSET_DRAWS_PER_DAY; draw++) {
    const order = shuffledIndices(PATH_COUNT, fnv1a32(`walk:${index}:${draw}`));
    const position = firstHitPosition(sig, order);
    subsetHitPositions.push(position);
    if (draw === 0 && Number.isFinite(position)) walk0Published = order[position - 1];
  }
  const pathsToFirstHit = subsetHitPositions[0];

  // §1(k) — the same day, walked the two ways a player can actually walk it.
  const walkFirstHit = singleKnobWalkFirstHit(sig, fnv1a32(`knobwalk:${index}`));
  const climbFirstHit = greedyClimbFirstHit(curve, sig);

  // --- informed caller (§3.9d) ---
  const familyCounts = [0, 0, 0, 0];
  const familyValidCounts = [0, 0, 0, 0];
  for (let i = 0; i < PATH_COUNT; i++) {
    if (curve[i].valid) familyValidCounts[SPECS[i].outcome]++;
    if (sig[i] === 1) familyCounts[SPECS[i].outcome]++;
  }

  // gr6-103: familyDensities divides by the CONSTANT 448, which silently
  // assumes every spec in the family produced a usable fit. That has held on
  // every day ever enumerated (215,040 points, 0 invalid -- MIN_CELL has never
  // bound and no OLS has come back singular), and the adopted call rule is
  // calibrated against that denominator. If it ever stops holding, the
  // densities below become incomparable to the thresholds tuned from them, and
  // the failure would be a quiet drift in the reported accuracy rather than an
  // error. Assert it instead.
  for (let outcome = 0; outcome < 4; outcome++) {
    if (familyValidCounts[outcome] !== FAMILY_SIZE) {
      throw new Error(
        `simulate_calibration: day ${index}, outcome family ${outcome} has ` +
          `${familyValidCounts[outcome]} valid specs, not ${FAMILY_SIZE}. familyDensities divides by ` +
          `${FAMILY_SIZE} unconditionally, so the density statistic (and every threshold calibrated ` +
          `from it) is no longer meaningful. Fix the denominator before trusting this run.`,
      );
    }
  }

  const familyShares = familyCounts.map((c) => (acceptedSig === 0 ? 0 : c / acceptedSig));
  const familyDensities = familyCounts.map((c) => c / FAMILY_SIZE);

  // The call. A walk that never found a significant path publishes nothing,
  // so it resolves as "noise" under either statistic.
  let callReal = false; // ADOPTED: family density
  let callRealShare = false; // informational: §3.9d's literal family share
  let publishedOutcomeShare: number | null = null;
  const landedOutcome = walk0Published === null ? null : SPECS[walk0Published].outcome;
  if (landedOutcome !== null) {
    publishedOutcomeShare = familyShares[landedOutcome];
    callRealShare = publishedOutcomeShare >= FAMILY_THRESHOLD;
    callReal = familyDensities[landedOutcome] >= FAMILY_THRESHOLD;
  }

  const acceptedCanonicalHit =
    puzzle.trueOutcome === undefined ? null : runSpec(data, canonicalSpecFor(puzzle.trueOutcome), 400).p < SIG_ALPHA;

  return {
    index,
    dayType,
    trueOutcome: puzzle.trueOutcome ?? null,
    attempts: puzzle.attemptUsed + 1,
    rawNullSig,
    rawCanonicalHit,
    acceptedCanonicalHit,
    acceptedSig,
    pathsToFirstHit,
    subsetHitPositions,
    walkFirstHit,
    climbFirstHit,
    callReal,
    callCorrect: callReal === (dayType === 'effect'),
    callRealShare,
    callCorrectShare: callRealShare === (dayType === 'effect'),
    publishedOutcomeShare,
    familyShares,
    familyDensities,
    landedOutcome,
    kurtosisY1: excessKurtosis(data.y[0]),
    meanPairwiseCorr: meanPairwiseOutcomeCorr(data.y),
  };
}

// ---- band bookkeeping ----

interface Band {
  id: string;
  what: string;
  target: string;
  measured: number;
  /** Distance to the nearest band edge; negative means outside. */
  margin: number;
  pass: boolean;
  /** false => printed for context only; never gates the exit code. Every
   * §3.9 target has exactly ONE asserted row; the companion rows exist
   * because each of (a), (b) and (d) admits a second defensible population
   * or statistic, and hiding the one that was not chosen would make this
   * report exactly the kind of selective-reporting artefact the game is
   * about. The choice for each is argued in the header of its pair. */
  asserted: boolean;
}

function twoSided(id: string, what: string, lo: number, hi: number, measured: number, asserted = true): Band {
  return {
    id,
    what,
    target: `[${lo}, ${hi}]`,
    measured,
    margin: Math.min(measured - lo, hi - measured),
    pass: measured >= lo && measured <= hi,
    asserted,
  };
}

function atLeast(id: string, what: string, lo: number, measured: number, asserted = true): Band {
  return { id, what, target: `>= ${lo}`, measured, margin: measured - lo, pass: measured >= lo, asserted };
}

function atMost(id: string, what: string, hi: number, measured: number, asserted = true): Band {
  return { id, what, target: `<= ${hi}`, measured, margin: hi - measured, pass: measured <= hi, asserted };
}

// ---- run ----

// day.ts warns exactly once per MAX_ATTEMPTS exhaustion; count them instead of
// letting 1,000 days' worth scroll past. (Script-local, restored below.)
const realWarn = console.warn;
let capExhaustions = 0;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('exhausted MAX_ATTEMPTS')) {
    capExhaustions++;
    return;
  }
  realWarn(...args);
};

const startedAt = process.hrtime.bigint();
const days: SimDay[] = [];
const counts: Record<DayType, number> = { null: 0, effect: 0 };
for (let i = 0; counts.null < DAYS_PER_TYPE || counts.effect < DAYS_PER_TYPE; i++) {
  const dayType = dayTypeFor(String(fnv1a32(`cal:${i}`)));
  if (counts[dayType] >= DAYS_PER_TYPE) continue; // pure hash — skipped for free
  counts[dayType]++;
  days.push(simulateDay(i));
  const done = counts.null + counts.effect;
  if (done % 100 === 0) {
    const secs = Number(process.hrtime.bigint() - startedAt) / 1e9;
    realWarn(`  ... ${done}/${2 * DAYS_PER_TYPE} days (${secs.toFixed(1)}s)`);
  }
}
console.warn = realWarn;
const elapsedS = Number(process.hrtime.bigint() - startedAt) / 1e9;

const nullDays = days.filter((d) => d.dayType === 'null');
const effectDays = days.filter((d) => d.dayType === 'effect');

// (a) null-day hackability — raw (asserted) + accepted (asserted, one-sided)
const rawHackable = fraction(nullDays.map((d) => (d.rawNullSig ?? 0) >= HACKABILITY_MIN_SIG));
const acceptedHackable = fraction(nullDays.map((d) => d.acceptedSig >= HACKABILITY_MIN_SIG));

// (b) greedy explorer, median paths to first hit
const nullHits = nullDays.map((d) => d.pathsToFirstHit);
const effectHits = effectDays.map((d) => d.pathsToFirstHit);
const allHits = days.map((d) => d.pathsToFirstHit);
const medianNullHit = median(nullHits);

const pEffect = P_EFFECT_PCT / 100;

/** Median of the day-type mixture the game actually serves (P(effect) =
 * P_EFFECT_PCT), rather than this simulation's own balanced 50/50 mix. */
function weightedMedian(nullValues: number[], effectValues: number[]): number {
  const cdf = (values: number[], m: number) => fraction(values.map((v) => v <= m));
  const candidates = [...new Set([...nullValues, ...effectValues])].filter(Number.isFinite).sort((a, b) => a - b);
  for (const m of candidates) {
    if ((1 - pEffect) * cdf(nullValues, m) + pEffect * cdf(effectValues, m) >= 0.5) return m;
  }
  return Infinity;
}
const weightedMedianHit = weightedMedian(nullHits, effectHits);

// §1(k) — the same statistic for the two interface-shaped explorers, on the
// same daily mix, plus the tail gr2-012 measured: how often 60 moves produce
// nothing at all. The permutation explorer's tail is computed on the same
// horizon (position > WALK_MAX_STEPS), so the three numbers are comparable.
const walkHitsNull = nullDays.map((d) => d.walkFirstHit);
const walkHitsEffect = effectDays.map((d) => d.walkFirstHit);
const climbHitsNull = nullDays.map((d) => d.climbFirstHit);
const climbHitsEffect = effectDays.map((d) => d.climbFirstHit);
const weightedMedianWalk = weightedMedian(walkHitsNull, walkHitsEffect);
const weightedMedianClimb = weightedMedian(climbHitsNull, climbHitsEffect);

/** Mixture rate over the served 75/25 day mix, the same weighting band (d)
 * uses for accuracy. */
function weightedRate(nullFlags: boolean[], effectFlags: boolean[]): number {
  return (1 - pEffect) * fraction(nullFlags) + pEffect * fraction(effectFlags);
}
const missedWithin = (values: number[]) => values.map((v) => !(v <= WALK_MAX_STEPS));
const walkMissRate = weightedRate(missedWithin(walkHitsNull), missedWithin(walkHitsEffect));
const climbMissRate = weightedRate(missedWithin(climbHitsNull), missedWithin(climbHitsEffect));
const permutationMissRate = weightedRate(
  missedWithin(nullDays.map((d) => d.pathsToFirstHit)),
  missedWithin(effectDays.map((d) => d.pathsToFirstHit)),
);

// (c) effect-day canonical power at N=400
const rawPower = fraction(effectDays.map((d) => d.rawCanonicalHit === true));

// (d) informed-caller accuracy, on the ADOPTED family-density statistic
const sensitivity = fraction(effectDays.map((d) => d.callCorrect)); // P(call real | effect day)
const specificity = fraction(nullDays.map((d) => d.callCorrect)); // P(call noise | null day)
const balancedAccuracy = fraction(days.map((d) => d.callCorrect)); // this 50/50 simulation's own mix
const weightedAccuracy = (1 - pEffect) * specificity + pEffect * sensitivity;

// ...and on §3.9d's literal family-share rule, kept for the audit trail.
const shareSensitivity = fraction(effectDays.map((d) => d.callCorrectShare));
const shareSpecificity = fraction(nullDays.map((d) => d.callCorrectShare));
const shareBalanced = fraction(days.map((d) => d.callCorrectShare));
const shareWeighted = (1 - pEffect) * shareSpecificity + pEffect * shareSensitivity;

// (e) rejection-loop attempts
const attempts = days.map((d) => d.attempts);
const attemptsP99 = percentile(attempts, 0.99);

// The five §3.9 targets, exactly as adjudicated. These set the exit code.
const bands: Band[] = [
  // (a) on the ACCEPTED day — the day a player is actually served. §3.3's
  // rejection sampler exists precisely to deliver this floor, so a raw-draw
  // reading would make the sampler dead code; and "99%, not 100%" is exactly
  // what the MAX_ATTEMPTS fallback can cost.
  atLeast('a', 'null-day hackability: P(sig paths >= 30) on the ACCEPTED day', 0.99, acceptedHackable),
  // (b) over the DAILY MIX (75/25) — the player-experience statistic
  // (adjudicated 2026-08-03; see the header).
  twoSided(
    'b',
    `PERMUTATION explorer: median paths to first hit (daily mix, P(effect)=${P_EFFECT_PCT}%) — §1(k): this is the explorer §3.9b's number describes`,
    4,
    12,
    weightedMedianHit,
  ),
  // (c) on the raw draw — post-acceptance this is 1.000 by construction and
  // could never land in [0.6, 0.85] under any tuning.
  twoSided('c', 'effect-day canonical power @ N=400 (raw draw)', 0.6, 0.85, rawPower),
  // (d) on the FAMILY-DENSITY statistic at §3.9d's unchanged 60% threshold
  // (adjudicated 2026-08-03; the header documents why the literal
  // family-share rule cannot work at any threshold).
  twoSided('d', `informed caller: family density >= 60% (weighted, P(effect)=${P_EFFECT_PCT}%)`, 0.75, 0.9, weightedAccuracy),
  atMost('e', 'rejection-loop attempts, p99', MAX_ATTEMPTS, attemptsP99),
];

// Alternative statistics: measured, printed, and NEVER gating. Each is a
// population or rule that was considered and set aside; keeping them in the
// suite's own output is what makes the two adjudications auditable from a
// single run instead of from a report nobody will re-read.
const informational: Band[] = [
  atLeast('a-raw', 'hackability on an unconditioned raw draw (the sampler\'s workload)', 0.99, rawHackable, false),
  // §1(k)'s two rows. Ranges are WATCHES, not gates (see the explorer header):
  // wide enough that the ordinary spread between explorers does not read as a
  // failure, tight enough that a real regression in either direction shows.
  twoSided('b-walk', `SINGLE-KNOB walk: median paths to first hit (daily mix) — the explorer the Lab affords`, 4, 24, weightedMedianWalk, false),
  twoSided('b-climb', 'GREEDY HILL-CLIMB: median paths to first hit (daily mix) — the competent player', 1, 8, weightedMedianClimb, false),
  atMost('b-walk-miss', `single-knob walk finds nothing in ${WALK_MAX_STEPS} moves (daily mix)`, 0.2, walkMissRate, false),
  twoSided('b-null', 'explorer median paths to first hit, null-only (band [4,16])', 4, 16, medianNullHit, false),
  twoSided('b-eff', 'explorer median paths to first hit, effect-only', 4, 16, median(effectHits), false),
  twoSided('d-share', '§3.9d literal family-SHARE rule (adjudicated out, never beats 0.750)', 0.75, 0.9, shareWeighted, false),
];

// ---- p_hit table (§3.7) ----

// gr6-002: TWO vectors, one per day type. The suite already simulates 500 days
// of each and already walks SUBSET_DRAWS_PER_DAY random permutations of all
// 1,792 specs on EVERY day — the effect-day vector was simply never written
// out, so `pHitAtK` had nothing to select on and the reveal quoted the null
// number on effect days too (23% shown where 51% was true at k = 5).
function pHitVector(days: SimDay[]): number[] {
  const vector: number[] = new Array(P_HIT_MAX_K + 1).fill(0);
  const draws = days.length * SUBSET_DRAWS_PER_DAY;
  for (let k = 1; k <= P_HIT_MAX_K; k++) {
    let hits = 0;
    for (const day of days) {
      for (const position of day.subsetHitPositions) {
        if (position <= k) hits++;
      }
    }
    vector[k] = Math.round((hits / draws) * 1e6) / 1e6;
  }
  return vector;
}

const pHitNull = pHitVector(nullDays);
const pHitEffect = pHitVector(effectDays);
const totalDraws = nullDays.length * SUBSET_DRAWS_PER_DAY;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const tablePath = join(scriptDir, '..', 'src', 'data', 'p_hit_by_k.json');
// UNCHANGED BY THIS EDIT, and that is correct rather than an oversight: the
// checksum is fnv1a32 over the DGP constant vector, and no DGP constant moved.
// The table's SHAPE is guarded separately, per vector, by assertPHitTable.
const checksum = pHitTableChecksum();

/**
 * GR6 gr6-119 — `npm run cal` READS AS A VERIFICATION AND USED TO BEHAVE AS A
 * GENERATOR.
 *
 * It unconditionally rewrote `src/data/p_hit_by_k.json`, a TRACKED source
 * file. Harmless in practice — the whole script is seeded, so a clean tree
 * regenerates byte-identically (`git status --short` empty afterwards, itself
 * a genuine determinism confirmation) — but an owner who runs it to check a
 * band and then `git add -A`s ships a silently regenerated table.
 *
 * So the default is now VERIFY: recompute the table, compare it against the
 * committed bytes, and fail the run if they differ. `npm run cal -- --write`
 * is the regeneration mode, which is what a deliberate DGP/tuning change uses
 * (and what the §3.9 workflow uploads). CI runs the default and additionally
 * asserts `git diff --exit-code src/data/p_hit_by_k.json`, so "the table is
 * stale" becomes a red run here instead of a checksum throw at app boot in
 * front of a player (`assertPHitTable` in src/engine/reveal.ts).
 */
const WRITE_TABLE = process.argv.includes('--write');
// W1 (gr6-002): the table is two vectors, one per day type.
const tableJson = `${JSON.stringify({ checksum, pHitNull, pHitEffect }, null, 2)}\n`;
let tableStatus: string;
let tableStale = false;
if (WRITE_TABLE) {
  writeFileSync(tablePath, tableJson);
  tableStatus = `WROTE ${tablePath} (--write)`;
} else {
  let committed: string | null;
  try {
    committed = readFileSync(tablePath, 'utf8');
  } catch {
    // Never generated (a fresh clone of a tree that lost the artifact) counts
    // as stale, not as "nothing to compare".
    committed = null;
  }
  tableStale = committed !== tableJson;
  tableStatus = tableStale
    ? `STALE — ${tablePath} does NOT match this run; regenerate with \`npm run cal -- --write\``
    : `verified ${tablePath} (unchanged; re-run with \`-- --write\` to regenerate)`;
}

// ---- report ----

const line = '='.repeat(100);
console.log(line);
console.log(`P-hackle calibration suite (master spec §8.3) — ${DAYS_PER_TYPE} null + ${DAYS_PER_TYPE} effect days`);
console.log(`simulated in ${elapsedS.toFixed(1)}s · path space ${PATH_COUNT} · curve window N=${CURVE_N}`);
console.log(line);
console.log('');
function printBandRow(band: Band): void {
  console.log(
    band.id.padEnd(8) +
      band.target.padEnd(14) +
      fixed(band.measured).padEnd(12) +
      ((band.margin >= 0 ? '+' : '') + fixed(band.margin)).padEnd(11) +
      (band.asserted ? (band.pass ? 'PASS' : 'FAIL') : band.pass ? '(in)' : '(out)').padEnd(9) +
      band.what,
  );
}

const header = `${'id'.padEnd(8)}${'target'.padEnd(14)}${'measured'.padEnd(12)}${'margin'.padEnd(11)}${'verdict'.padEnd(9)}what`;

console.log('BAND TABLE — the five §3.9 calibration targets (these set the exit code)');
console.log('');
console.log(header);
console.log('-'.repeat(100));
for (const band of bands) printBandRow(band);
console.log('-'.repeat(100));
console.log('');
console.log('INFORMATIONAL — alternative populations/rules, measured but never gating');
console.log('');
console.log(header);
console.log('-'.repeat(100));
for (const band of informational) printBandRow(band);
console.log('-'.repeat(100));
console.log('');

console.log('DIAGNOSTICS');
console.log(`  day mix               : ${nullDays.length} null / ${effectDays.length} effect`);
console.log(`  MAX_ATTEMPTS blowouts : ${capExhaustions} (loop hit the ${MAX_ATTEMPTS}-attempt cap and fell back)`);
console.log(
  `  attempts              : mean ${fixed(mean(attempts), 2)} · median ${fixed(median(attempts), 1)} ` +
    `· p99 ${attemptsP99} · max ${Math.max(...attempts)}`,
);
console.log(
  `  null sigCount@200 raw : median ${fixed(median(nullDays.map((d) => d.rawNullSig ?? 0)), 1)} ` +
    `· p01 ${percentile(
      nullDays.map((d) => d.rawNullSig ?? 0),
      0.01,
    )} · p99 ${percentile(
      nullDays.map((d) => d.rawNullSig ?? 0),
      0.99,
    )} · in NULL_SIG_BAND ${fixed(
      fraction(nullDays.map((d) => (d.rawNullSig ?? 0) >= NULL_SIG_BAND[0] && (d.rawNullSig ?? 0) <= NULL_SIG_BAND[1])),
      3,
    )}`,
);
console.log(
  `  null sigCount@200 acc.: median ${fixed(median(nullDays.map((d) => d.acceptedSig)), 1)} ` +
    `· min ${Math.min(...nullDays.map((d) => d.acceptedSig))} · max ${Math.max(...nullDays.map((d) => d.acceptedSig))}`,
);
console.log(
  `  effect sigCount@200   : median ${fixed(median(effectDays.map((d) => d.acceptedSig)), 1)} ` +
    `· min ${Math.min(...effectDays.map((d) => d.acceptedSig))} · max ${Math.max(
      ...effectDays.map((d) => d.acceptedSig),
    )}`,
);
console.log(
  `  §1(k) explorers (mix) : PERMUTATION ${fixed(weightedMedianHit, 1)} [band b, the certified one] · ` +
    `SINGLE-KNOB WALK ${fixed(weightedMedianWalk, 1)} · GREEDY CLIMB ${fixed(weightedMedianClimb, 1)} ` +
    `· found nothing in ${WALK_MAX_STEPS}: perm ${fixed(permutationMissRate, 3)} / walk ${fixed(
      walkMissRate,
      3,
    )} / climb ${fixed(climbMissRate, 3)}`,
);
console.log(
  `  paths to first hit    : DAILY MIX(${P_EFFECT_PCT}%) ${fixed(weightedMedianHit, 1)} [band b] · null-only ${fixed(
    medianNullHit,
    1,
  )} · effect-only ${fixed(median(effectHits), 1)} · sim's own 50/50 ${fixed(median(allHits), 1)} · null p90 ${percentile(
    nullHits,
    0.9,
  )}`,
);
console.log(
  `  caller [density, ADOPTED]: sens ${fixed(sensitivity, 3)} · spec ${fixed(specificity, 3)} · ` +
    `balanced ${fixed(balancedAccuracy, 3)} · weighted ${fixed(weightedAccuracy, 3)}`,
);
console.log(
  `  caller [share, §3.9d lit.]: sens ${fixed(shareSensitivity, 3)} · spec ${fixed(shareSpecificity, 3)} · ` +
    `balanced ${fixed(shareBalanced, 3)} · weighted ${fixed(shareWeighted, 3)}`,
);
console.log(
  `  always-"noise" baseline : ${fixed(1 - pEffect, 3)} weighted — the share rule never beats it ` +
    `at ANY threshold (see sweeps); the density rule clears it by ${fixed(weightedAccuracy - (1 - pEffect), 3)}`,
);
console.log(
  `  effect power @400     : raw ${fixed(rawPower, 3)} · accepted ${fixed(
    fraction(effectDays.map((d) => d.acceptedCanonicalHit === true)),
    3,
  )} (accepted is ~1.000 BY CONSTRUCTION — §3.3 conditions on exactly this)`,
);
console.log(`  effect d range        : [${EFFECT_D_RANGE[0]}, ${EFFECT_D_RANGE[1]}] · NULL_SIG_BAND ${NULL_SIG_BAND}`);
console.log('');

// ---- extra diagnostics: WHERE the bands come from ----
//
// These exist because a failing band is useless without a mechanism. The
// caller band in particular is decided entirely by how the day's significant
// paths split across the four outcome FAMILIES: the explorer lands in family
// f with probability equal to f's share (size-biased), so the rule fires
// "real" exactly when the landed family holds >= 60%.

function pctiles(values: number[], qs: number[]): string {
  return qs.map((q) => `p${String(Math.round(q * 100)).padStart(2, '0')}=${percentile(values, q)}`).join(' ');
}

function shareDeciles(values: number[]): string {
  return [0.1, 0.25, 0.5, 0.75, 0.9]
    .map((q) => `p${Math.round(q * 100)}=${fixed(percentile(values, q), 3)}`)
    .join(' ');
}

// T3 left an explicit watch item: median excess kurtosis(Y1) is 1.295 against
// a >1 bar (a budgeted cost of the shared-error-factor mechanism, §3.2).
// 1,000 accepted days is 5x dgp.test.ts's 200 seeds AND is measured on the
// post-acceptance datasets players actually see, so the whole distribution is
// printed, not just the median.
const kurtoses = days.map((d) => d.kurtosisY1);
const corrs = days.map((d) => d.meanPairwiseCorr);
console.log('DGP MOMENT WATCH (1,000 accepted days; dgp.test.ts bars in brackets)');
console.log(
  `  excess kurtosis(Y1) [median > 1]  : ${[0.05, 0.1, 0.25, 0.5, 0.75, 0.95]
    .map((q) => `p${Math.round(q * 100)}=${fixed(percentile(kurtoses, q), 2)}`)
    .join(' ')} · below the 1.0 bar on ${fixed(fraction(kurtoses.map((k) => k <= 1)), 3)} of days`,
);
console.log(
  `  mean pairwise corr(Yi,Yj) [.15-.45]: ${[0.05, 0.5, 0.95]
    .map((q) => `p${Math.round(q * 100)}=${fixed(percentile(corrs, q), 3)}`)
    .join(' ')} · overall mean ${fixed(mean(corrs), 3)} · outside the band on ${fixed(
    fraction(corrs.map((c) => c < 0.15 || c > 0.45)),
    3,
  )} of days`,
);
console.log('');

console.log('MECHANISM DIAGNOSTICS');
console.log(`  raw null sigCount@200 : ${pctiles(nullDays.map((d) => d.rawNullSig ?? 0), [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99])}`);
console.log(
  `  null family shares    : landed ${shareDeciles(
    nullDays.filter((d) => d.publishedOutcomeShare !== null).map((d) => d.publishedOutcomeShare!),
  )}`,
);
console.log(`                          max    ${shareDeciles(nullDays.map((d) => Math.max(...d.familyShares)))}`);
console.log(
  `  effect family shares  : landed ${shareDeciles(
    effectDays.filter((d) => d.publishedOutcomeShare !== null).map((d) => d.publishedOutcomeShare!),
  )}`,
);
console.log(
  `                          true   ${shareDeciles(
    effectDays.map((d) => (d.trueOutcome === null ? 0 : d.familyShares[d.trueOutcome])),
  )}`,
);
console.log('');
/** Threshold sweep for one candidate caller statistic. Printed for BOTH the
 * adopted rule and the adjudicated-out literal one: the sweep is the evidence
 * that the choice between them is not a matter of picking a threshold. */
function printCallerSweep(label: string, thresholds: number[], statistic: (d: SimDay) => number | null): void {
  console.log(`  ${label} (weighted / balanced / sens / spec):`);
  let bestWeighted = 0;
  let bestBalanced = 0;
  for (const threshold of thresholds) {
    const call = (d: SimDay) => {
      const value = statistic(d);
      return value !== null && value >= threshold;
    };
    const sens = fraction(effectDays.map((d) => call(d)));
    const spec = fraction(nullDays.map((d) => !call(d)));
    const weighted = (1 - pEffect) * spec + pEffect * sens;
    const balanced = (spec + sens) / 2;
    bestWeighted = Math.max(bestWeighted, weighted);
    bestBalanced = Math.max(bestBalanced, balanced);
    const marker = threshold === FAMILY_THRESHOLD ? " <-- §3.9d's 60%" : '';
    console.log(
      `    t=${threshold.toFixed(2)}  ${fixed(weighted, 3)}  ${fixed(balanced, 3)}  ${fixed(sens, 3)}  ${fixed(
        spec,
        3,
      )}${marker}`,
    );
  }
  console.log(
    `    best over all thresholds: weighted ${fixed(bestWeighted, 3)} · balanced ${fixed(bestBalanced, 3)} ` +
      `(base rate ${fixed(1 - pEffect, 3)})`,
  );
}

// This pair of sweeps is the audit trail for the 2026-08-03 adjudication of
// §3.9d. The literal family-SHARE rule does not merely miss its band at the
// pinned 60% threshold — its BEST weighted accuracy over every threshold is
// below the always-say-"noise" base rate, so it is not a tuning problem and
// no constant could ever fix it. The adopted family-DENSITY rule clears the
// base rate at the same 60% threshold.
printCallerSweep(
  '§3.9d LITERAL rule — family SHARE of the day\'s hits (ADJUDICATED OUT)',
  [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  (d) => d.publishedOutcomeShare,
);
console.log('');
printCallerSweep(
  'ADOPTED rule — family DENSITY, sigInFamily / 448',
  [0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
  (d) => (d.landedOutcome === null ? null : d.familyDensities[d.landedOutcome]),
);
console.log('');

// Which family dominates a null day? If it is always the same one, the
// "concentration" statistic is measuring the DGP's fixed confound structure,
// not evidence of a real effect.
const nullArgmax = [0, 0, 0, 0];
for (const d of nullDays) {
  let best = 0;
  for (let o = 1; o < 4; o++) if (d.familyShares[o] > d.familyShares[best]) best = o;
  nullArgmax[best]++;
}
const nullFamilyMeanSig = [0, 1, 2, 3].map((o) => mean(nullDays.map((d) => d.familyDensities[o] * FAMILY_SIZE)));
console.log(`  null day dominant family: Y1..Y4 = ${nullArgmax.join(' / ')} days (of ${nullDays.length})`);
console.log(`  null mean sig paths/family: ${nullFamilyMeanSig.map((v) => fixed(v, 1)).join(' / ')} (of ${FAMILY_SIZE})`);
console.log('');

// NULL_SIG_BAND sweep. Kept as a standing what-if: it is what raising the
// acceptance band would buy on the null-only explorer median, and it is the
// evidence behind a DECLINED 2026-08-03 proposal to raise the ceiling from
// 180 to 400. The controller declined it because the reveal's headline
// accounting — "Of 1,792 possible analyses, N (x%) reach p < .05 by chance
// alone" (§2.7.3) — loses its force once x can reach 22% (400/1792); band (b)
// was re-based on the daily mix instead, where it already passes. Read this
// table as "what a band change costs the chance line", not as a to-do.
//
// The accepted null-day sigCount distribution is exactly the RAW distribution
// conditioned on the band, so every candidate can be evaluated from the 500
// raw draws already in hand. For a fixed S, the explorer's first-hit position
// depends ONLY on S (a uniformly random permutation with S marked out of M):
//   P(no hit within k) = prod_{i=0..k-1} (M - S - i) / (M - i)
// so the pooled median across accepted days is exact, not simulated.
function noHitProbability(sig: number, k: number): number {
  let p = 1;
  for (let i = 0; i < k; i++) {
    const remaining = PATH_COUNT - sig - i;
    if (remaining <= 0) return 0;
    p *= remaining / (PATH_COUNT - i);
  }
  return p;
}
function predictedMedianFirstHit(sigCounts: number[]): number {
  for (let k = 1; k <= PATH_COUNT; k++) {
    const hitRate = mean(sigCounts.map((s) => 1 - noHitProbability(s, k)));
    if (hitRate >= 0.5) return k;
  }
  return Infinity;
}
const rawNullSigs = nullDays.map((d) => d.rawNullSig ?? 0);
console.log('  NULL_SIG_BAND what-if (DECLINED 2026-08-03 — costs the chance line; band b is the mix, not this):');
console.log('    band              accept%  median sig  predicted median paths-to-hit');
for (const candidate of [
  [30, 180],
  [38, 225], // the most the +-25% tuning guard allows on both edges
  [30, 225],
  [30, 300],
  [30, 400],
  [30, 600],
  [40, 300],
  [50, 300],
  [60, 180],
  [60, 250],
  [80, 300],
  [100, 400],
  [120, 400],
  [150, 500],
] as [number, number][]) {
  const inBand = rawNullSigs.filter((s) => s >= candidate[0] && s <= candidate[1]);
  const rate = inBand.length / rawNullSigs.length;
  const predicted = inBand.length === 0 ? Infinity : predictedMedianFirstHit(inBand);
  const marker =
    candidate[0] === NULL_SIG_BAND[0] && candidate[1] === NULL_SIG_BAND[1] ? '  <-- current' : '';
  console.log(
    `    [${String(candidate[0]).padStart(3)}, ${String(candidate[1]).padStart(3)}]      ${fixed(rate, 3)}    ${String(
      inBand.length === 0 ? 0 : median(inBand),
    ).padStart(6)}      ${String(predicted).padStart(4)}${marker}`,
  );
}
console.log('');

console.log('P_HIT TABLE (P(>=1 significant path | k explored at random), BY DAY TYPE)');
console.log(`  ${tableStatus}`);
console.log(`  checksum ${checksum} · ${nullDays.length} days x ${SUBSET_DRAWS_PER_DAY} draws = ${totalDraws} samples per vector`);
const shown = [1, 2, 3, 4, 5, 7, 10, 14, 20, 30, 40];
console.log(`  k       ${shown.map((k) => String(k).padStart(6)).join('')}`);
console.log(`  null    ${shown.map((k) => pHitNull[k].toFixed(3).padStart(6)).join('')}`);
console.log(`  effect  ${shown.map((k) => pHitEffect[k].toFixed(3).padStart(6)).join('')}`);
console.log('');

const failed = bands.filter((b) => b.asserted && !b.pass);
if (failed.length > 0 || tableStale) {
  console.log(line);
  if (failed.length > 0) {
    console.log(`CALIBRATION FAILED — ${failed.length} band(s) out of target: ${failed.map((b) => b.id).join(', ')}`);
    for (const band of failed) {
      console.log(`  (${band.id}) ${band.what}: measured ${fixed(band.measured)}, target ${band.target}`);
    }
  }
  // gr6-119: a stale table is a failure of the same kind as a missed band —
  // the tree no longer describes what the engine does — and it is the one the
  // player would otherwise meet as a thrown checksum on the reveal screen.
  if (tableStale) {
    console.log(`CALIBRATION FAILED — ${tablePath} is stale: this run's p_hit table is not the committed one.`);
    console.log('  Regenerate deliberately with `npm run cal -- --write`, then commit the diff.');
  }
  console.log(line);
  process.exit(1);
}
console.log(line);
console.log(`CALIBRATION PASSED — all ${bands.length} §3.9 bands within target, p_hit table verified.`);
console.log('(§8.3: the balance sheet balances.)');
console.log(line);
