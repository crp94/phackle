// Master spec §6 — Core TypeScript interfaces (copied verbatim), plus the two
// additional aliases T1 introduces for the engine/game boundary.

export type DayType = 'null' | 'effect';
export type Outcome = 0 | 1 | 2 | 3;

export interface Spec {
  outcome: Outcome;
  subgroup: 'all'|'age_lt40'|'age_ge40'|'exp_high'|'exp_low'|'urban'|'rural';
  covariates: { income: boolean; risk: boolean };
  exclusion: 'none'|'z3'|'z2_5'|'z2';
  transform: 'raw'|'log1p';
  tails: 'two'|'one';
}

/**
 * T31 EXTENSION to master spec §6 (extends, does not contradict: §6's
 * PathResult is unchanged, `cut` is a new OPTIONAL field on top of it, so any
 * PathResult literal written against §6 still type-checks).
 *
 * The raw material of the Lab's DataCut figure — §2.4's "tiny scatter/box
 * visual of the current cut". Four flat arrays of the TRANSFORMED outcome
 * values of the current filtered window, split by treatment (`x === 1` is
 * treated, `x === 0` is control), with the outlier-excluded points kept in
 * their OWN arrays rather than dropped: the figure draws them as hollow
 * crossed marks, so turning the exclusion knob visibly removes specific
 * people from the analysis instead of silently shrinking n.
 *
 * Spoiler-safe by construction (§5.4): plain finite numbers only, no field
 * that could name a day type, an outcome or a true effect — the values are
 * exactly what the player's own current specification is looking at. Pinned
 * as such by tests/engine/protocol.test.ts's spoiler-guard suite.
 *
 * Size: bounded by the window, so `control + treated + excludedControl +
 * excludedTreated` is at most the largest WindowN (400) values in total.
 *
 * Order: within each array, source-row order of the filtered window — never
 * sorted, so the arrays stay a pure function of (dataset, spec, n).
 */
export interface DataCut {
  treated: number[];
  control: number[];
  excludedTreated: number[];
  excludedControl: number[];
}

// NOTE: fields may carry real computed values even when valid === false —
// always gate on valid before displaying or aggregating. (`cut` is the one
// field that stays MEANINGFUL when valid === false: the figure still shows
// the data the dial has declined to analyse.)
export interface PathResult {
  spec: Spec; n: number; beta: number; se: number; t: number; p: number;
  ci: [number, number]; excludedCount: number; valid: boolean; // n>=30
  cut?: DataCut;                                               // T31, see above
}

// trueBeta (T11 clarification): on effect days, the INJECTED magnitude in the
// true outcome's own raw units (effect.d * the pre-injection sample sd of
// that outcome column) — not the bare standardized `d` draw. See day.ts's
// assemblePuzzle for how it's computed and why the distinction matters.
// capExhausted (gr6-102): true iff the acceptance loop ran out of attempts
// (MAX_ATTEMPTS) and served the best-scoring attempt instead of one that
// actually passed the day's gate — the single condition under which the
// reveal's promises are not backed by the day's data (a null day with fewer
// than 30 hackable paths, or an effect day whose canonical spec cannot find
// the effect). Rare: over 120 consecutive dates the attempt histogram was
// 0:76 1:28 2:10 3:4 4:1 7:1, max 7 of 20. It used to be reported ONLY by a
// console.warn from inside a Web Worker, i.e. invisible in production and
// unreadable by anything downstream; the warn is kept and this field puts the
// fact on the wire as well. NOT spoiler-bearing: both day types can set it,
// so its value says nothing about dayType, trueOutcome or trueBeta — which is
// why protocol.ts's spoiler-guard suite passes it through to RevealPayload
// while still refusing every field that would.
export interface DailyPuzzle {           // worker-side only until reveal
  isoDate: string; puzzleNumber: number; scenarioId: string;
  dayType: DayType; trueOutcome?: Outcome; trueBeta?: number;
  heterogeneous?: { subgroup: Spec['subgroup']; multiplier: number };
  attemptUsed: number; capExhausted: boolean; nFull: 400;
}

export type PlayerAction =
  | { t: 'VIEW_SPEC'; spec: Spec; seen: boolean; at: number } // seen: result was displayed for the previous spec (fork rule §2.10)
  | { t: 'PEEK_AND_EXTEND'; newN: number; at: number }
  | { t: 'SUBMIT'; spec: Spec; p: number; at: number }
  | { t: 'ABANDON'; at: number }
  | { t: 'CALL'; verdict: 'real'|'noise'; at: number };

export interface RevealMetrics {
  totalPaths: number; sigPaths: number; sigFraction: number;
  playerExplored: number; pHitAtK: number;           // from lookup table
  curve: { p: number; explored: boolean; published: boolean; outcome: Outcome }[];
  stamp: 'RETRACTED'|'REPLICATED'|'NULL_REPORTED';
  peeks: number;
}

export interface DayRecord {
  mode: 'hack'|'prereg'; score: number; forks: number;
  callCorrect?: boolean; stamp: RevealMetrics['stamp'];
  shareString: string;
}

// --- T1 additions (brief, not master-spec §6) ---
export type Locale = 'en' | 'it' | 'es';
export type WindowN = 200 | 250 | 300 | 350 | 400;
