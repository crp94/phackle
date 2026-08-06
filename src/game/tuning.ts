// Master spec §3.9 — every game-balance tuning knob lives here, and only here
// (see CLAUDE.md non-negotiable #3). This is the one file src/engine/** is
// allowed to import from (docs/implementation_plan.md §5 engine purity).
import type { WindowN } from '../engine/types';

export const EPOCH = '2026-08-07'; // FROZEN 2026-08-06 (T25): day 1 is 2026-08-07.
export const P_EFFECT_PCT = 25;
export const EFFECT_D_RANGE: [number, number] = [0.18, 0.30];
export const NULL_SIG_BAND: [number, number] = [30, 180];
export const N_SCHEDULE: WindowN[] = [200, 250, 300, 350, 400];
export const MIN_CELL = 30;
export const DEBOUNCE_MS = 300;
export const MAX_ATTEMPTS = 20;
// GR6 RULING §1(f) (gr2-007) — `parsimonyPerFork: 4` was here, and the bonus
// it defined was dead for anyone who played the skill the game teaches: it hit
// zero at 10 forks, against measured medians of 4 (greedy), 13 (informed
// caller) and 27.5 (naive) forks per day, and the informed caller — the only
// model that beats the base rate — earned it on 2 days in 32, because probing
// a family for robustness COSTS forks. §1.2 pillar 3 asked the scoring to
// reward parsimony while §2.7.6 asked the player to check robustness, and the
// two rows contradicted each other.
//
// `parsimonyPerExtraFamily` is the adopted fix: the charge is per distinct
// OUTCOME FAMILY the player looked at today, beyond the first (see
// scoring.ts's scoreHack and forkLog.ts's distinctOutcomeFamilies). Probing
// one family as hard as you like is free; shopping across outcomes — the
// multiple-comparisons move the whole game is about — is what costs.
// There are exactly four outcome families, so at 14 the row pays
// 40 / 26 / 12 / 0 for 1 / 2 / 3 / 4 families touched: the top of the scale is
// unchanged (parsimonyMax still means what it meant), the bottom still bottoms
// out at zero for a player who tried every outcome, and the two intermediate
// steps are worth playing for. `SCORING.*` is deliberately NOT in
// `dgpConstantVector()` (see reveal.ts), so nothing about the DGP, the bands
// or the p_hit table moves with this.
export const SCORING = {
  correctCall: 100, incorrectCall: 0, parsimonyMax: 40, parsimonyPerExtraFamily: 14,
  publishedCareer: 25, abandonNull: 80, abandonEffect: 20, preregSigEffect: 150,
  preregNonsigNull: 100, preregNonsigEffect: 40, preregSigNull: 0,
} as const;
export const TIER_FORKS = { polite: 3, editorsPick: 10 } as const; // ≤3 → tier1, ≥10 → tier3
// GR6 RULING §1(h) (gr2-018), option (b) — egregiousness scales on DISTANCE
// FROM THE DEFAULT SPEC, not on the raw fork count. `TIER_FORKS` measured
// floundering as much as cheating: a greedy hill-climber publishes almost
// immediately, so the most efficient hacker got the quietest celebration, and
// a returning player's Act I got duller as they got better. Measured over 60
// consecutive real dates on this tree (see the W11 report): under TIER_FORKS
// the greedy model lands tier 1 on 55 of the 58 days it publishes (95%) and
// tier 3 on none; under TIER_MOVES below it lands 21 / 34 / 3 across the three
// tiers while the naive random walker lands 0 / 28 / 28 — spectacle now tracks
// what the player PUBLISHED rather than how long they took to find it.
//
// The count is over the four moves a methods section would have to confess:
// one-tailed, a subgroup restriction, an outlier exclusion, a transform.
// Outcome and covariates are deliberately NOT counted — see published.ts's
// `hackingMoves` for why, and note that §1(f)'s parsimony row now prices the
// outcome shopping this one does not. Like TIER_FORKS, TIER_MOVES is NOT in
// `dgpConstantVector()`: it cannot change a null day's curve (reveal.ts).
export const TIER_MOVES = { polite: 0, editorsPick: 3 } as const; // ≤0 moves → tier1, ≥3 → tier3
export const HETERO_MULTIPLIER = 1.6;
export const HETERO_PROB_PCT = 50;
