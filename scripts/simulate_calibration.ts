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
// THE GREEDY RANDOM EXPLORER  (band b, and the p_hit table)
// ============================================================================
// One explorer walk = a uniformly random permutation of all 1,792 specs
// (seeded Fisher–Yates on mulberry32), walked in order without replacement,
// stopping at the FIRST significant path (valid && p < .05) at N = 200 — the
// window every player starts in (§3.8). "Paths to first hit" is that path's
// 1-based position. Invalid specs ("insufficient data") COUNT as paths
// walked: the player spent a fork on them and saw a result.
// Band (b) uses exactly ONE walk per day (walk #0), per the pinned
// definition, and is ASSERTED on the median across NULL days: effect days
// hand the explorer an already-lit true family, so a mixed median can sit
// inside the band while the typical day (75% of them are null) sits well
// outside it. The P(effect)-weighted mixture median is measured and printed
// alongside it (row `b-mix`) rather than left out.
//
// ============================================================================
// THE INFORMED CALLER  (band d)
// ============================================================================
// §3.9d: calls "real" iff the published spec's outcome family holds ≥60% of
// the day's significant paths. For this simulation the "published spec" is
// the spec the greedy explorer's walk #0 stopped on (the first thing a random
// hacker would have written up); a day where the walk finds nothing
// significant resolves as a "noise" call. Significant paths are counted on
// the same N = 200 curve.
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

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSpec } from '../src/engine/analyze';
import { canonicalSpecFor, generatePractice } from '../src/engine/day';
import type { EffectSpec } from '../src/engine/dgp';
import { generateDataset } from '../src/engine/dgp';
import { fnv1a32, mulberry32 } from '../src/engine/prng';
import { P_HIT_MAX_K, pHitTableChecksum } from '../src/engine/reveal';
import { dayTypeFor, effectParamsFor } from '../src/engine/seeds';
import type { CurvePoint } from '../src/engine/specGrid';
import { allSpecs, enumerateCurve, sigCount } from '../src/engine/specGrid';
import type { DayType, Outcome } from '../src/engine/types';
import { EFFECT_D_RANGE, HETERO_MULTIPLIER, MAX_ATTEMPTS, NULL_SIG_BAND, P_EFFECT_PCT } from '../src/game/tuning';

// ---- run parameters ----

const DAYS_PER_TYPE = 500; // §8.3: "500 null + 500 effect days"
const SCENARIO_COUNT = 20; // production scenario count (T6), only feeds scenarioId
const CURVE_N = 200; // the window a player starts in (§3.8)
const SIG_ALPHA = 0.05;
const OUTCOME_SHARE_THRESHOLD = 0.6; // §3.9d's "≥60% of the day's significant paths"
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
  callReal: boolean;
  callCorrect: boolean;
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

  // --- informed caller (§3.9d) ---
  const familyCounts = [0, 0, 0, 0];
  for (let i = 0; i < PATH_COUNT; i++) {
    if (sig[i] === 1) familyCounts[SPECS[i].outcome]++;
  }
  const familyShares = familyCounts.map((c) => (acceptedSig === 0 ? 0 : c / acceptedSig));
  const familyDensities = familyCounts.map((c) => c / FAMILY_SIZE);

  let callReal = false;
  let publishedOutcomeShare: number | null = null;
  const landedOutcome = walk0Published === null ? null : SPECS[walk0Published].outcome;
  if (landedOutcome !== null) {
    publishedOutcomeShare = familyShares[landedOutcome];
    callReal = publishedOutcomeShare >= OUTCOME_SHARE_THRESHOLD;
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
    callReal,
    callCorrect: callReal === (dayType === 'effect'),
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

// (c) effect-day canonical power at N=400
const rawPower = fraction(effectDays.map((d) => d.rawCanonicalHit === true));

// (d) informed-caller accuracy
const sensitivity = fraction(effectDays.map((d) => d.callCorrect)); // P(call real | effect day)
const specificity = fraction(nullDays.map((d) => d.callCorrect)); // P(call noise | null day)
const balancedAccuracy = fraction(days.map((d) => d.callCorrect)); // this 50/50 simulation's own mix
const weightedAccuracy = (1 - pEffect) * specificity + pEffect * sensitivity;

// (e) rejection-loop attempts
const attempts = days.map((d) => d.attempts);
const attemptsP99 = percentile(attempts, 0.99);

// §3.9d under the "family density" reading (see the sweep printed below):
// >= 60% of the landed family's OWN 448 paths significant.
const densityCall = (d: SimDay) =>
  d.landedOutcome !== null && d.familyDensities[d.landedOutcome] >= OUTCOME_SHARE_THRESHOLD;
const densitySensitivity = fraction(effectDays.map((d) => densityCall(d)));
const densitySpecificity = fraction(nullDays.map((d) => !densityCall(d)));
const densityAccuracy = (1 - pEffect) * densitySpecificity + pEffect * densitySensitivity;

const bands: Band[] = [
  // (a) ASSERTED on the ACCEPTED day — the day a player is actually served.
  // §3.3's rejection sampler exists precisely to deliver this floor (its
  // lower edge IS the 30 in §3.9a), so a raw-draw reading would make the
  // sampler dead code; and "99%, not 100%" is exactly what the
  // MAX_ATTEMPTS fallback can cost. The raw rate is printed because it is
  // the honest measure of how much work the sampler is doing.
  atLeast('a', 'null-day hackability: P(sig paths >= 30) on the ACCEPTED day', 0.99, acceptedHackable),
  atLeast('a-raw', '  [diag] same on an unconditioned raw draw (the sampler\'s workload)', 0.99, rawHackable, false),
  // (b) ASSERTED on NULL days: the binding population. Effect days hand the
  // explorer a lit-up true family, so a mixed median can pass while the
  // typical (75%) day sits far outside the band. The mixture median is
  // printed alongside so the alternative is visible, not buried.
  twoSided('b', 'greedy explorer: median paths to first hit (NULL days)', 4, 12, medianNullHit),
  twoSided(
    'b-mix',
    `  [diag] same over the served mixture (P(effect)=${P_EFFECT_PCT}%)`,
    4,
    12,
    weightedMedianHit,
    false,
  ),
  // (c) ASSERTED on the raw draw — see the header. Post-acceptance this is
  // 1.000 by construction and could never land in [0.6, 0.85].
  twoSided('c', 'effect-day canonical power @ N=400 (raw draw)', 0.6, 0.85, rawPower),
  // (d) ASSERTED on §3.9d's literal rule (share of the day's hits). The
  // "family density" variant is printed because the literal rule turns out
  // to be uninformative at EVERY threshold (see the sweeps below).
  twoSided('d', `informed caller, §3.9d literal rule (weighted, P(effect)=${P_EFFECT_PCT}%)`, 0.75, 0.9, weightedAccuracy),
  twoSided('d-den', '  [diag] same rule read as "family density >= 60%"', 0.75, 0.9, densityAccuracy, false),
  atMost('e', 'rejection-loop attempts, p99', MAX_ATTEMPTS, attemptsP99),
];

// ---- p_hit table (§3.7) ----

const pHit: number[] = new Array(P_HIT_MAX_K + 1).fill(0);
const totalDraws = nullDays.length * SUBSET_DRAWS_PER_DAY;
for (let k = 1; k <= P_HIT_MAX_K; k++) {
  let hits = 0;
  for (const day of nullDays) {
    for (const position of day.subsetHitPositions) {
      if (position <= k) hits++;
    }
  }
  pHit[k] = Math.round((hits / totalDraws) * 1e6) / 1e6;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const tablePath = join(scriptDir, '..', 'src', 'data', 'p_hit_by_k.json');
const checksum = pHitTableChecksum();
writeFileSync(tablePath, `${JSON.stringify({ checksum, pHit }, null, 2)}\n`);

// ---- report ----

const line = '='.repeat(100);
console.log(line);
console.log(`P-hackle calibration suite (master spec §8.3) — ${DAYS_PER_TYPE} null + ${DAYS_PER_TYPE} effect days`);
console.log(`simulated in ${elapsedS.toFixed(1)}s · path space ${PATH_COUNT} · curve window N=${CURVE_N}`);
console.log(line);
console.log('');
console.log('BAND TABLE (§3.9 calibration targets)');
console.log('');
console.log('  PASS/FAIL rows are asserted (they set the exit code); (pass)/(fail) rows are diagnostics.');
console.log('');
console.log(
  `${'id'.padEnd(7)}${'target'.padEnd(14)}${'measured'.padEnd(12)}${'margin'.padEnd(11)}${'verdict'.padEnd(9)}what`,
);
console.log('-'.repeat(100));
for (const band of bands) {
  console.log(
    band.id.padEnd(7) +
      band.target.padEnd(14) +
      fixed(band.measured).padEnd(12) +
      ((band.margin >= 0 ? '+' : '') + fixed(band.margin)).padEnd(11) +
      (band.asserted ? (band.pass ? 'PASS' : 'FAIL') : band.pass ? '(pass)' : '(fail)').padEnd(9) +
      band.what,
  );
}
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
  `  paths to first hit    : median null ${fixed(medianNullHit, 1)} · median effect ${fixed(median(effectHits), 1)} ` +
    `· median pooled(50/50) ${fixed(median(allHits), 1)} · median weighted(${P_EFFECT_PCT}%) ${fixed(
      weightedMedianHit,
      1,
    )} · null p90 ${percentile(nullHits, 0.9)}`,
);
console.log(
  `  caller                : sensitivity ${fixed(sensitivity, 3)} (effect days) · specificity ${fixed(
    specificity,
    3,
  )} (null days)`,
);
console.log(
  `                          balanced acc ${fixed(balancedAccuracy, 3)} (this 50/50 sim) · ` +
    `weighted acc ${fixed(weightedAccuracy, 3)} (P(effect)=${P_EFFECT_PCT}%) · always-"noise" baseline ${fixed(
      1 - pEffect,
      3,
    )}`,
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
console.log('  caller accuracy vs the §3.9d >=60% threshold (weighted / balanced / sens / spec):');
for (const threshold of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
  const call = (d: SimDay) => d.publishedOutcomeShare !== null && d.publishedOutcomeShare >= threshold;
  const sens = fraction(effectDays.map((d) => call(d)));
  const spec = fraction(nullDays.map((d) => !call(d)));
  const weighted = (1 - pEffect) * spec + pEffect * sens;
  const balanced = (spec + sens) / 2;
  const marker = threshold === OUTCOME_SHARE_THRESHOLD ? ' <-- §3.9d' : '';
  console.log(
    `    t=${threshold.toFixed(2)}  ${fixed(weighted, 3)}  ${fixed(balanced, 3)}  ${fixed(sens, 3)}  ${fixed(
      spec,
      3,
    )}${marker}`,
  );
}
console.log('');

// Alternative reading of §3.9d, measured because the literal one fails at
// EVERY threshold (see the sweep above). Rule A (literal, pinned): the landed
// family holds >= 60% of the day's significant paths. Rule B ("robustness"):
// >= 60% of the landed family's OWN 448 paths are significant — the statistic
// §2.7.6 describes in words ("Real effects cluster. Noise scatters.").
console.log('  same sweep under the "family density" reading (sigInFamily / 448 >= t):');
for (const threshold of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
  const call = (d: SimDay) => d.landedOutcome !== null && d.familyDensities[d.landedOutcome] >= threshold;
  const sens = fraction(effectDays.map((d) => call(d)));
  const spec = fraction(nullDays.map((d) => !call(d)));
  const weighted = (1 - pEffect) * spec + pEffect * sens;
  const balanced = (spec + sens) / 2;
  const marker = threshold === OUTCOME_SHARE_THRESHOLD ? ' <-- at §3.9d\'s 60%' : '';
  console.log(
    `    t=${threshold.toFixed(2)}  ${fixed(weighted, 3)}  ${fixed(balanced, 3)}  ${fixed(sens, 3)}  ${fixed(
      spec,
      3,
    )}${marker}`,
  );
}
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

// NULL_SIG_BAND sweep for band (b). The accepted null-day sigCount
// distribution is exactly the RAW distribution conditioned on the band, so
// every candidate band can be evaluated from the 500 raw draws already in
// hand. For a fixed S, the explorer's first-hit position depends ONLY on S
// (a uniformly random permutation with S marked out of M):
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
console.log('  NULL_SIG_BAND sweep (band b): what the accepted null day would look like');
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

console.log('P_HIT TABLE (P(>=1 significant path | k explored at random), null days)');
console.log(`  wrote ${tablePath}`);
console.log(`  checksum ${checksum} · ${nullDays.length} days x ${SUBSET_DRAWS_PER_DAY} draws = ${totalDraws} samples`);
const shown = [1, 2, 3, 4, 5, 7, 10, 14, 20, 30, 40];
console.log(`  k      ${shown.map((k) => String(k).padStart(6)).join('')}`);
console.log(`  pHit   ${shown.map((k) => pHit[k].toFixed(3).padStart(6)).join('')}`);
console.log('');

const failed = bands.filter((b) => b.asserted && !b.pass);
if (failed.length > 0) {
  console.log(line);
  console.log(`CALIBRATION FAILED — ${failed.length} band(s) out of target: ${failed.map((b) => b.id).join(', ')}`);
  for (const band of failed) {
    console.log(`  (${band.id}) ${band.what}: measured ${fixed(band.measured)}, target ${band.target}`);
  }
  console.log(line);
  process.exit(1);
}
console.log(line);
console.log('CALIBRATION PASSED — all §3.9 bands within target. (§8.3: the balance sheet balances.)');
console.log(line);
