// Master spec §3.3 (hackability guarantee / rejection sampling) + §3.1
// (determinism) + §6 (DailyPuzzle). Day assembly: pick a day's type and (on
// effect days) its true effect parameters from the seeded hashes (T1's
// src/engine/seeds.ts), then rejection-sample datasets via
// src/engine/dgp.ts's generateDataset until one passes the day's acceptance
// gate -- the "unloseable by design" guarantee. Every client on Earth that
// calls generateDay(iso, scenarioCount) for the same (iso, scenarioCount)
// gets a byte-identical result: no Math.random, no wall clock, no shared
// mutable state (see the no-restricted-* eslint rules on src/engine/**).
//
// Acceptance (§3.3, controller-amended):
//   attempt = 0, 1, 2, ... MAX_ATTEMPTS-1, dataset from a per-mode seed:
//   - null day: a fixed stride-7 subsample of the 1792 specs (256 of them, in
//     allSpecs()'s own fixed order) must contain at least one significant
//     point ("precheck") -- checked FIRST, via direct runSpec calls, and
//     gating the expensive step: only when it passes do we run the full
//     1792-spec enumeration (enumerateCurve) to get sigCount(...,200), which
//     must then land in NULL_SIG_BAND. Both are required for acceptance;
//     either failing rejects the attempt -- but the precheck failing means
//     the (expensive) full enumeration is never even computed for that
//     attempt. See acceptNullDay's own comment and the T9 fix report for the
//     measured cost of getting this ordering wrong (T9 review round 1 caught
//     an earlier version that computed the full curve unconditionally and
//     merely *read* the precheck off a slice of it -- letter-correct
//     decision, but never actually gated anything).
//   - effect day: the canonical spec (true outcome j*, everyone, both
//     covariates, no exclusion, canonicalTransform(j*), two-tailed) must have
//     p < .05 at N=400 AND p < .15 at N=200. p@200 < .15 always implies the
//     precheck's p@200 < .3, so both p@200 and p@400 are always computed for
//     every attempt (cheap -- single-spec regressions, unlike the null-day
//     path's full enumeration) and the "precheck" exists here purely as its
//     own named, spec-traceable condition, not as a computation-skipping
//     optimization (see the T9 report's self-review -- the reviewer
//     confirmed this one is fine, since neither p@200 nor p@400 is
//     expensive).
//   - cap: if no attempt passes within MAX_ATTEMPTS, accept the best-scoring
//     attempt among the ones already generated (bandDistance for null days,
//     pickBestEffectAttempt for effect days) and console.warn exactly once.
import { runSpec } from './analyze';
import type { Dataset, EffectSpec } from './dgp';
import { generateDataset } from './dgp';
import { fnv1a32 } from './prng';
import { daySeed, dayTypeFor, effectParamsFor, scenarioIndexFor } from './seeds';
import type { CurvePoint } from './specGrid';
import { allSpecs, enumerateCurve, sigCount, specKey } from './specGrid';
import type { DailyPuzzle, Outcome, Spec } from './types';
import { EPOCH, HETERO_MULTIPLIER, MAX_ATTEMPTS, NULL_SIG_BAND } from '../game/tuning';

export interface GeneratedDay {
  puzzle: DailyPuzzle;
  data: Dataset;
}

// ---- canonical spec (controller-pinned transform rule) ----

/** `Y2` (outcome 1) is the positive-skew family -- its canonical spec reads
 * it through log1p; every other outcome's canonical spec reads it raw. */
export function canonicalTransform(outcome: Outcome): Spec['transform'] {
  return outcome === 1 ? 'log1p' : 'raw';
}

/** The one spec the effect-day acceptance gate (and the reveal) judges the
 * day's true effect by: the true outcome, everyone, both covariates, no
 * exclusion, canonicalTransform(outcome), two-tailed. Exported (beyond
 * day.ts's own use) so tests can reconstruct exactly the same spec the
 * acceptance loop checks, without re-typing the pinned shape. */
export function canonicalSpecFor(outcome: Outcome): Spec {
  return {
    outcome,
    subgroup: 'all',
    covariates: { income: true, risk: true },
    exclusion: 'none',
    transform: canonicalTransform(outcome),
    tails: 'two',
  };
}

// ---- best-attempt fallback scoring (§3.3 controller amendment) ----

/** Distance from `sig` to the closed band `[lo, hi]`; 0 when `sig` is inside
 * (including exactly on either boundary). Exported for direct unit testing
 * of the null-day cap-exhaustion tie-break (see day.test.ts) -- forcing a
 * REAL 20-attempt null-day cap exhaustion end-to-end is exercised too (via a
 * mocked, unreachable NULL_SIG_BAND), but this pure scoring function is worth
 * testing in isolation since it's the exact tie-break rule the brief pins. */
export function bandDistance(sig: number, band: [number, number]): number {
  const [lo, hi] = band;
  if (sig < lo) return lo - sig;
  if (sig > hi) return sig - hi;
  return 0;
}

function pickMinBy<T>(items: T[], score: (item: T) => number): T {
  let best = items[0];
  let bestScore = score(best);
  for (let i = 1; i < items.length; i++) {
    const s = score(items[i]);
    if (s < bestScore) {
      bestScore = s;
      best = items[i];
    }
  }
  return best;
}

/** Cap-exhaustion tie-break for effect days (§3.3 controller amendment):
 * smallest canonical p@400 among candidates with p@200 < .15, else smallest
 * p@400 overall. Ties keep the earliest attempt (candidates are expected in
 * ascending attempt order). Exported for direct unit testing: unlike the
 * null-day band, forcing a REAL effect-day cap exhaustion end-to-end would
 * require fabricating a dataset that fails a hardcoded p-value threshold (not
 * mockable via tuning.ts), so this pure tie-break rule is tested in isolation
 * instead -- see day.test.ts. */
export function pickBestEffectAttempt<T extends { p200: number; p400: number }>(candidates: T[]): T {
  const tierA = candidates.filter((c) => c.p200 < 0.15);
  const pool = tierA.length > 0 ? tierA : candidates;
  return pickMinBy(pool, (c) => c.p400);
}

// ---- acceptance loops ----

interface AcceptanceResult {
  attemptUsed: number;
  data: Dataset;
}

const EFFECT_PRECHECK_P200_MAX = 0.3;
const EFFECT_P200_MAX = 0.15;
const EFFECT_P400_MAX = 0.05;

// The fixed 256-spec precheck subsample (§3.3, controller-pinned): every 7th
// spec in allSpecs()'s own fixed order (stride 7, start 0) -- 1792/7 = 256
// exactly. allSpecs() is a pure, dataset-independent function, so this list
// is the same for every attempt/date/call; computed once here rather than
// re-filtering allSpecs() on every attempt (mirrors dgp.ts's CORRELATION_R/
// CHOLESKY module-load-time precomputation).
const PRECHECK_SPECS: Spec[] = allSpecs().filter((_, i) => i % 7 === 0);

/**
 * The null-day precheck (§3.3): true iff at least one of the fixed 256-spec
 * subsample is significant at N=200. Deliberately calls `runSpec` directly,
 * spec by spec, with an early exit on the first hit -- NOT `enumerateCurve`
 * -- so this cheap-ish check can run BEFORE, and actually gate, the
 * expensive full 1792-spec enumeration (see acceptNullDay below). An earlier
 * version of this file called `enumerateCurve` first and read the precheck
 * off a slice of the resulting array -- correct in its DECISION (same 256
 * specs, same "any significant" logic, since enumerateCurve's per-spec
 * {p,valid} is bit-for-bit identical to runSpec's, per specGrid.ts's own
 * parity guarantee), but that ordering meant the "cheap" check never
 * actually happened before the expensive one -- caught in T9 review round 1
 * (see the T9 fix report for the measured wall-clock cost of each
 * ordering).
 */
function nullDayPrecheckHit(data: Dataset): boolean {
  for (const spec of PRECHECK_SPECS) {
    const result = runSpec(data, spec, 200);
    if (result.valid && result.p < 0.05) return true;
  }
  return false;
}

interface NullCandidate {
  attempt: number;
  data: Dataset;
  // null iff the precheck failed and the full curve was therefore never
  // computed for this attempt (see acceptNullDay) -- there is no sigCount to
  // record in that case, by construction of the fix this type exists for.
  sig: number | null;
}

function hasSig(c: NullCandidate): c is NullCandidate & { sig: number } {
  return c.sig !== null;
}

function acceptNullDay(seedForAttempt: (attempt: number) => number, warnContext: string): AcceptanceResult {
  const candidates: NullCandidate[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const data = generateDataset(seedForAttempt(attempt), null);

    // Precheck FIRST -- gates the expensive step. Only when it passes do we
    // pay for the full 1792-spec enumeration; when it fails, this attempt is
    // rejected without ever computing enumerateCurve at all (§3.3: "only if
    // the precheck passes do you run the full enumeration gates").
    if (!nullDayPrecheckHit(data)) {
      candidates.push({ attempt, data, sig: null });
      continue;
    }

    const sig = sigCount(enumerateCurve(data, 200));
    if (sig >= NULL_SIG_BAND[0] && sig <= NULL_SIG_BAND[1]) {
      return { attemptUsed: attempt, data };
    }
    candidates.push({ attempt, data, sig });
  }

  // Best-attempt fallback (§3.3 controller amendment): nearest-to-band among
  // attempts that actually got a sigCount computed (precheck passed but the
  // band check didn't). If literally every attempt failed the precheck --
  // meaning no sigCount was ever computed for any of them, an astronomically
  // unlikely event (it would take MAX_ATTEMPTS independent draws each
  // missing every one of a subsample that's typically ~2-10% significant;
  // see the T9 fix report's 30-day measurement) -- there is no sigCount left
  // to compare, so this deterministically falls back to the first attempt
  // rather than paying for an enumeration just to break a tie that's
  // otherwise undecidable from the data we have.
  const scored = candidates.filter(hasSig);
  const chosen = scored.length > 0 ? pickMinBy(scored, (c) => bandDistance(c.sig, NULL_SIG_BAND)) : candidates[0];

  const sigDisplay = chosen.sig === null ? 'n/a (precheck never passed)' : String(chosen.sig);
  console.warn(
    `P-hackle acceptance loop: ${warnContext} exhausted MAX_ATTEMPTS=${MAX_ATTEMPTS} without a passing ` +
      `attempt (null day); using best-attempt fallback (attempt ${chosen.attempt}, sigCount=${sigDisplay}).`,
  );
  return { attemptUsed: chosen.attempt, data: chosen.data };
}

function acceptEffectDay(
  effect: EffectSpec,
  canonical: Spec,
  seedForAttempt: (attempt: number) => number,
  warnContext: string,
): AcceptanceResult {
  const candidates: { attempt: number; data: Dataset; p200: number; p400: number }[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const data = generateDataset(seedForAttempt(attempt), effect);
    const p200 = runSpec(data, canonical, 200).p;
    const p400 = runSpec(data, canonical, 400).p;

    const precheckHit = p200 < EFFECT_PRECHECK_P200_MAX;
    const accepted = precheckHit && p200 < EFFECT_P200_MAX && p400 < EFFECT_P400_MAX;
    if (accepted) return { attemptUsed: attempt, data };

    candidates.push({ attempt, data, p200, p400 });
  }

  const chosen = pickBestEffectAttempt(candidates);
  console.warn(
    `P-hackle acceptance loop: ${warnContext} exhausted MAX_ATTEMPTS=${MAX_ATTEMPTS} without a passing ` +
      `attempt (effect day); using best-attempt fallback (attempt ${chosen.attempt}, ` +
      `p200=${chosen.p200.toFixed(4)}, p400=${chosen.p400.toFixed(4)}).`,
  );
  return { attemptUsed: chosen.attempt, data: chosen.data };
}

// ---- puzzleNumber (engine-side, non-authoritative computation) ----
//
// DailyPuzzle (§6) declares puzzleNumber as required, but the STORE (T12,
// src/game/daily.ts) is the actual authority the UI reads it from -- see
// docs/superpowers/plans/2026-08-03-phackle-v1.md's T12 brief ("Store
// computes puzzleNumber via src/game/daily.ts"). src/engine/** may not use
// `new Date` (eslint no-restricted-syntax) or import src/game/daily.ts (the
// engine-purity rule allows only src/game/tuning.ts from game/*), so this is
// a from-scratch, pure-integer-math reimplementation of the exact same
// formula (`daysBetween(EPOCH, iso) + 1`, cross-checked byte-for-byte against
// src/game/daily.ts's own puzzleNumber() in day.test.ts) -- deliberately
// duplicated rather than shared, mirroring dgp.ts's own precedent of
// duplicating meanAndSd rather than cross-importing between independently
// built sibling modules (see dgp.ts's file header). Deliberately excluded
// from the golden fixtures (scripts/gen_goldens.ts) since EPOCH is
// provisional ("frozen to real launch date in T25" per tuning.ts) and the
// golden-master suite must not depend on a value that's expected to change
// for unrelated deploy reasons.
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400; // [0, 399]
  const mp = (m + 9) % 12; // Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468; // days since 1970-01-01
}

function puzzleNumberFor(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const [ey, em, ed] = EPOCH.split('-').map(Number);
  return daysFromCivil(y, m, d) - daysFromCivil(ey, em, ed) + 1;
}

// ---- trueBeta (T11 controller amendment) ----

/** Sample standard deviation (n-1 denominator) — a private, local duplicate
 * of dgp.ts's own (unexported) meanAndSd, needed ONLY to reconstruct the
 * exact baseline sd effect injection multiplied by (see effectMagnitude
 * below): same loop order as dgp.ts's copy, so the float result is
 * bit-identical to whatever dgp.ts's injection pass actually used.
 * Deliberately duplicated rather than exported from dgp.ts and imported here
 * — mirroring this file's own puzzleNumberFor precedent above (and dgp.ts's
 * own precedent of duplicating meanAndSd rather than cross-importing from
 * stats.ts): small pure numeric helpers get duplicated, not shared, across
 * this codebase's independently-evolving engine modules. */
function sampleSd(v: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i];
  const mean = sum / v.length;

  let sq = 0;
  for (let i = 0; i < v.length; i++) {
    const dev = v[i] - mean;
    sq += dev * dev;
  }
  return Math.sqrt(sq / (v.length - 1));
}

/**
 * The actual injected magnitude, in the true outcome's own raw units (T11
 * controller amendment: DailyPuzzle.trueBeta / RevealPayload.trueBeta must
 * carry this, not the bare standardized `d` draw — §2.7.1's reveal line
 * reads "β = 0.24", a raw-units number, not a re-labeled effect size).
 *
 * dgp.ts's generateRows defines the injection as (§3.2) "generate all Y
 * first with beta=0; compute sd = meanSd(y[j*]).sd; add d*sd*x[i]" — a
 * single pass over the *complete* array, run AFTER the per-row loop that
 * produces every Y column. By the time `acceptedData` is in hand, that
 * injection has already happened, so the pre-injection sd can't be read back
 * off `acceptedData.y[outcome]` directly — the injection itself shifts the
 * treated group's mean (and therefore the column's sd).
 *
 * generateRows' per-row loop never actually consults `effect` at all — only
 * the post-loop injection pass does (see generateRows' own header comment on
 * the "one deliberate exception" to its prefix property) — so
 * generateDataset(seed, null) with the SAME seed reproduces the exact
 * pre-injection column byte-for-byte. This is exactly what
 * tests/engine/dgp.test.ts's own "diff-in-diff: ... == d*sd" test already
 * relies on to verify the injection itself, so re-deriving `sd` the same way
 * here is a proven-sound pattern, not a new assumption. The cost (one extra
 * full 400-row generateDataset call) is negligible next to the
 * up-to-MAX_ATTEMPTS calls the acceptance loop above it already pays.
 */
function effectMagnitude(seed: number, outcome: Outcome, d: number): number {
  const baseline = generateDataset(seed, null);
  return d * sampleSd(baseline.y[outcome]);
}

// ---- shared puzzle assembly ----

interface AssembleArgs {
  isoDate: string;
  puzzleNumber: number;
  scenarioIdx: number;
  /** The string every seeds.ts hash derivation (dayTypeFor/effectParamsFor)
   * is keyed on: the real iso for generateDay, or String(seed) for
   * generatePractice (both functions take any string, per seeds.ts). */
  hashSourceIso: string;
  seedForAttempt: (attempt: number) => number;
  warnContext: string;
}

function assemblePuzzle(args: AssembleArgs): GeneratedDay {
  const { isoDate, puzzleNumber, scenarioIdx, hashSourceIso, seedForAttempt, warnContext } = args;
  const dayType = dayTypeFor(hashSourceIso);

  if (dayType === 'null') {
    const { attemptUsed, data } = acceptNullDay(seedForAttempt, warnContext);
    const puzzle: DailyPuzzle = {
      isoDate,
      puzzleNumber,
      scenarioId: String(scenarioIdx),
      dayType,
      attemptUsed,
      nFull: 400,
    };
    return { puzzle, data };
  }

  const params = effectParamsFor(hashSourceIso);
  const effect: EffectSpec = {
    outcome: params.outcome,
    d: params.d,
    hetero: params.hetero ? { subgroup: params.heteroSubgroup, multiplier: HETERO_MULTIPLIER } : null,
  };
  const canonical = canonicalSpecFor(params.outcome);
  const { attemptUsed, data } = acceptEffectDay(effect, canonical, seedForAttempt, warnContext);

  const puzzle: DailyPuzzle = {
    isoDate,
    puzzleNumber,
    scenarioId: String(scenarioIdx),
    dayType,
    trueOutcome: params.outcome,
    trueBeta: effectMagnitude(seedForAttempt(attemptUsed), params.outcome, params.d),
    ...(params.hetero ? { heterogeneous: { subgroup: params.heteroSubgroup, multiplier: HETERO_MULTIPLIER } } : {}),
    attemptUsed,
    nFull: 400,
  };
  return { puzzle, data };
}

// ---- public entry points ----

/** The real daily flow (§3.1/§3.3): `iso` is a calendar date (`YYYY-MM-DD`),
 * `scenarioCount` is the caller's content-scenario count (the engine never
 * imports content -- see docs/implementation_plan.md §5). Attempt seeds come
 * from src/engine/seeds.ts's daySeed. */
export function generateDay(iso: string, scenarioCount: number): GeneratedDay {
  return assemblePuzzle({
    isoDate: iso,
    puzzleNumber: puzzleNumberFor(iso),
    scenarioIdx: scenarioIndexFor(iso, scenarioCount),
    hashSourceIso: iso,
    seedForAttempt: (attempt) => daySeed(iso, attempt),
    warnContext: iso,
  });
}

/** Practice mode (§3.3 controller amendment): same acceptance loop, seed-
 * derived instead of date-derived. `seed` is normally src/game/daily.ts's
 * practiceSeed() (fresh, non-deterministic entropy per practice run -- that
 * non-determinism lives entirely in how the caller picks `seed`, never
 * inside this function, which is a pure function of (seed, scenarioCount)).
 * scenario index = seed % scenarioCount, deliberately with no 14-day
 * rotation check (practice isn't part of the daily sequence). Attempt seeds
 * use a distinct 'practice:' hash prefix (never src/engine/seeds.ts's
 * daySeed) so practice datasets can never collide with a real calendar
 * date's. `dayType`/effect params reuse seeds.ts's own dayTypeFor/
 * effectParamsFor unchanged, keyed on String(seed) (both accept any string,
 * not just real ISO dates). */
export function generatePractice(seed: number, scenarioCount: number): GeneratedDay {
  return assemblePuzzle({
    isoDate: 'practice',
    puzzleNumber: 0,
    scenarioIdx: seed % scenarioCount,
    hashSourceIso: String(seed),
    seedForAttempt: (attempt) => fnv1a32(`practice:${seed}:${attempt}`),
    warnContext: `practice:${seed}`,
  });
}

// ---- golden-fixture hashing helpers ----

/** fnv1a32 over the first `k` rows of `data`, each row serialized as its
 * fields (in Dataset's own declared order: x, age, urban, experience,
 * income, risk, y[0..3]) at fixed 10-decimal precision, rows joined by '\n'.
 * Exported per the T9 brief: an E2E task reuses this exact helper later, so
 * its name/signature are pinned (`hashRows(data, k)`). */
export function hashRows(data: Dataset, k: number): number {
  const rows: string[] = [];
  for (let i = 0; i < k; i++) {
    const fields = [
      data.x[i],
      data.age[i],
      data.urban[i],
      data.experience[i],
      data.income[i],
      data.risk[i],
      data.y[0][i],
      data.y[1][i],
      data.y[2][i],
      data.y[3][i],
    ];
    rows.push(fields.map((v) => v.toFixed(10)).join(','));
  }
  return fnv1a32(rows.join('\n'));
}

/** fnv1a32 over `specKey(spec) + ':' + p.toFixed(12)` for every VALID curve
 * point, sorted by specKey before concatenation -- order-independent by
 * construction, per the T8 review ruling that the curve array's iteration
 * order is fixed-but-arbitrary and must never become load-bearing for a
 * golden fixture. Exported so scripts/gen_goldens.ts and
 * tests/determinism/goldens.test.ts share one implementation (no risk of the
 * two independently-written copies drifting apart). */
export function hashCurve(curve: CurvePoint[]): number {
  const parts = curve
    .filter((point) => point.valid)
    .map((point) => `${specKey(point.spec)}:${point.p.toFixed(12)}`)
    .sort();
  return fnv1a32(parts.join(''));
}
