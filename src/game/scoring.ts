// Master spec §2.8 — daily scoring. Pure functions of the day's outcome; no
// wall clock, no storage access (that lives in storage.ts, which persists the
// numbers this module computes).
import type { CopyKey } from '../content/en/copy';
import type { DayType } from '../engine/types';
import type { RevealPayload } from '../engine/protocol';
import { SCORING } from './tuning';

/**
 * §2.6: "real" calls are correct on effect days, "noise" calls are correct on
 * null days.
 */
export function callIsCorrect(call: 'real' | 'noise', dayType: DayType): boolean {
  return call === 'real' ? dayType === 'effect' : dayType === 'null';
}

export interface ScoreDayInput {
  mode: 'hack' | 'prereg';
  dayType: DayType;
  published: boolean;
  /** null in Prereg Mode: there is no CALL step there (§2.11 T18 pin — the
   * prereg score rows below replace it entirely). Hacking Mode always
   * supplies a real boolean: "Players who abandoned also make the call"
   * (§2.6), so callCorrect is defined whether the day was published or
   * abandoned. */
  callCorrect: boolean | null;
  forks: number;
  stamp: RevealPayload['stamp'];
  /** Prereg Mode only: was the single committed analysis significant? */
  preregSig?: boolean;
}

export interface ScoreDayResult {
  score: number;
  /** Flavor-only, separate cosmetic counter (§2.8: "Published... career
   * points, separate cosmetic counter") — never folded into `score`. */
  career: number;
  /** Every applicable §2.8 row, as a (label, point-value) pair. Additive:
   * summing the values always reconstructs `score` exactly — this is what
   * keeps it an honest "fee invoice" breakdown rather than a single restated
   * total under a generic label. */
  breakdown: [CopyKey, number][];
}

/**
 * Exact §2.8 scoring table, read from the SCORING tuning const. The table's
 * first six rows (call correctness, parsimony, published-career, honest
 * abandon) are Hacking Mode's; the last four ("Prereg: ...") are Prereg
 * Mode's own, self-contained track — mode is a hard branch below, matching
 * the plan's Prereg pin ("no CALL — the prereg score rows §2.8 replace it").
 */
export function scoreDay(i: ScoreDayInput): ScoreDayResult {
  if (i.mode === 'prereg') {
    return scorePrereg(i);
  }
  return scoreHack(i);
}

function scoreHack(i: ScoreDayInput): ScoreDayResult {
  const breakdown: [CopyKey, number][] = [];

  // Rows 1-2: the call is scored whether the day was published or abandoned
  // (§2.6: abandoners still make the call).
  const callPoints = i.callCorrect ? SCORING.correctCall : SCORING.incorrectCall;
  breakdown.push([i.callCorrect ? 'summary.breakdownCallCorrect' : 'summary.breakdownCallIncorrect', callPoints]);
  let score = callPoints;

  // Row 3: parsimony bonus — "only if call correct" (§2.8), independent of
  // published vs. abandoned.
  //
  // gr6-018: the ROW is now unconditional; the VALUE still is not. A wrong
  // call earns 0 parsimony, exactly as before — but it used to earn no row
  // either, and on the modal Hacking Mode day (75% of days are null, the
  // credulous first-timer publishes and calls "real", `incorrectCall` is 0)
  // that left the whole invoice as one line reading zero: a screen titled
  // "Invoice", a single item of 0, and a total of 0, two screens after the
  // same day printed "+25 career points" in gold. Itemising the zero is what
  // an invoice does, and it costs nothing: adding 0 leaves `score` and the
  // breakdown-sums-to-score contract untouched.
  const parsimony = i.callCorrect === true ? Math.max(0, SCORING.parsimonyMax - SCORING.parsimonyPerFork * i.forks) : 0;
  breakdown.push(['summary.breakdownParsimony', parsimony]);
  score += parsimony;

  // Row 4: career points, a separate track, unconditional on call
  // correctness — only earned on an actual publish.
  const career = i.published ? SCORING.publishedCareer : 0;

  // Rows 5-6: honest abandon bonus — added on top of the call score above,
  // unconditional on the call's own correctness (§2.8's parenthetical
  // "integrity bonus" / "missed discovery" reward the act of not hacking,
  // not the accuracy of the after-the-fact guess about it).
  if (!i.published) {
    if (i.dayType === 'null') {
      breakdown.push(['summary.breakdownIntegrity', SCORING.abandonNull]);
      score += SCORING.abandonNull;
    } else {
      breakdown.push(['summary.breakdownMissedDiscovery', SCORING.abandonEffect]);
      score += SCORING.abandonEffect;
    }
  }

  return { score, career, breakdown };
}

function scorePrereg(i: ScoreDayInput): ScoreDayResult {
  const sig = i.preregSig === true;
  let key: CopyKey;
  let score: number;

  if (sig && i.dayType === 'effect') {
    key = 'summary.breakdownTrueDiscovery';
    score = SCORING.preregSigEffect;
  } else if (!sig && i.dayType === 'null') {
    key = 'summary.breakdownConfirmedNull';
    score = SCORING.preregNonsigNull;
  } else if (!sig && i.dayType === 'effect') {
    key = 'summary.breakdownUnderpoweredLuck';
    score = SCORING.preregNonsigEffect;
  } else {
    // sig && dayType === 'null': the real 5% false positive.
    key = 'summary.breakdownFalsePositive';
    score = SCORING.preregSigNull;
  }

  // Prereg Mode has no career-points row (§2.8 lists it only among the
  // Hacking Mode rows) and never consults forks/callCorrect — its four rows
  // are fully determined by preregSig + dayType alone.
  return { score, career: 0, breakdown: [[key, score]] };
}
