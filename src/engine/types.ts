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

// NOTE: fields may carry real computed values even when valid === false —
// always gate on valid before displaying or aggregating.
export interface PathResult {
  spec: Spec; n: number; beta: number; se: number; t: number; p: number;
  ci: [number, number]; excludedCount: number; valid: boolean; // n>=30
}

export interface DailyPuzzle {           // worker-side only until reveal
  isoDate: string; puzzleNumber: number; scenarioId: string;
  dayType: DayType; trueOutcome?: Outcome; trueBeta?: number;
  heterogeneous?: { subgroup: Spec['subgroup']; multiplier: number };
  attemptUsed: number; nFull: 400;
}

export type PlayerAction =
  | { t: 'VIEW_SPEC'; spec: Spec; at: number }
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
