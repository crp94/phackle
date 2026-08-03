// Master spec §3.9 — every game-balance tuning knob lives here, and only here
// (see CLAUDE.md non-negotiable #3). This is the one file src/engine/** is
// allowed to import from (docs/implementation_plan.md §5 engine purity).
import type { WindowN } from '../engine/types';

export const EPOCH = '2026-08-10'; // provisional; frozen to real launch date in T25
export const P_EFFECT_PCT = 25;
export const EFFECT_D_RANGE: [number, number] = [0.18, 0.30];
export const NULL_SIG_BAND: [number, number] = [30, 180];
export const N_SCHEDULE: WindowN[] = [200, 250, 300, 350, 400];
export const MIN_CELL = 30;
export const DEBOUNCE_MS = 300;
export const MAX_ATTEMPTS = 20;
export const SCORING = {
  correctCall: 100, incorrectCall: 0, parsimonyMax: 40, parsimonyPerFork: 4,
  publishedCareer: 25, abandonNull: 80, abandonEffect: 20, preregSigEffect: 150,
  preregNonsigNull: 100, preregNonsigEffect: 40, preregSigNull: 0,
} as const;
export const TIER_FORKS = { polite: 3, editorsPick: 10 } as const; // ≤3 → tier1, ≥10 → tier3
export const HETERO_MULTIPLIER = 1.6;
export const HETERO_PROB_PCT = 50;
