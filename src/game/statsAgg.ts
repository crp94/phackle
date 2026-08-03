// T17 — pure aggregation helpers behind the Stats screen (§2.8: "call
// accuracy all-time + rolling-20 ... prereg-vs-hacking 'success' rates side
// by side"). All-time accuracy itself needs no helper (it's already
// `stats.callsCorrect / stats.callsTotal` on the persisted PersistedStats) —
// what's missing is the ROLLING window and the per-mode success rate, both of
// which need the full per-day history, not just the running totals.
//
// Named statsAgg.ts (not stats.ts) so as never to collide, in an import line
// or in a reader's head, with src/engine/stats.ts — a completely different
// "stats" (the OLS/t-distribution engine).
import type { DayRecord } from '../engine/types';

/**
 * Same shape as storage.ts's PersistedState['history'] and achievements.ts's
 * own ModeHistory (both defined independently — no import between any of the
 * three files — but all three are structurally identical), per the
 * established T13 convention: one play per mode per day, so a date may hold
 * a 'hack' record, a 'prereg' record, or both.
 */
export type ModeHistory = Record<string, Partial<Record<'hack' | 'prereg', DayRecord>>>;

/** Every historical call, chronological (ISO-date-lexical order = calendar
 * order), any mode. Mirrors achievements.ts's private chronologicalCalls
 * exactly (same tie-break: a same-day hack record precedes that day's
 * prereg record) — duplicated rather than imported because achievements.ts
 * does not export it, and re-deriving 6 lines here is cheaper than widening
 * that module's surface for one caller. */
function chronologicalCalls(history: ModeHistory): boolean[] {
  const calls: boolean[] = [];
  for (const iso of Object.keys(history).sort()) {
    const day = history[iso];
    if (day.hack?.callCorrect !== undefined) calls.push(day.hack.callCorrect);
    if (day.prereg?.callCorrect !== undefined) calls.push(day.prereg.callCorrect);
  }
  return calls;
}

/**
 * Call accuracy over the chronologically LAST `window` calls (default 20),
 * across both modes. `null` when no call has ever been recorded (the Stats
 * screen renders that as an em-dash, never a hidden panel — see Stats.tsx).
 */
export function rollingCallAccuracy(history: ModeHistory, window = 20): number | null {
  const calls = chronologicalCalls(history);
  if (calls.length === 0) return null;
  const windowed = calls.slice(-window);
  const correct = windowed.filter((c) => c).length;
  return correct / windowed.length;
}

/** Every DayRecord for one mode, in chronological (ISO date) order. */
export function recordsForMode(history: ModeHistory, mode: 'hack' | 'prereg'): DayRecord[] {
  const out: DayRecord[] = [];
  for (const iso of Object.keys(history).sort()) {
    const rec = history[iso]?.[mode];
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * The "α made visible" figure (§2.8): the fraction of a mode's days that
 * ended in a published claim standing (REPLICATED or RETRACTED — the game
 * guarantees you can always REACH publication, so "success" here means
 * "found/kept something to submit," not "was correct") rather than an honest
 * NULL_REPORTED. `null` when `records` is empty, so the Stats screen can
 * render the always-visible empty-state em-dash instead of a fabricated 0%
 * (a mode nobody has played yet is "no data," not "0% successful").
 *
 * Hacking Mode's guaranteed-reachable significance (§3.3) should push this
 * toward ~100%; Prereg Mode's single, uninflated test should sit far lower —
 * that juxtaposition, always rendered side by side even when one panel is
 * empty, IS the lesson (§2.8's own framing: "watching your own 'success'
 * rate collapse ... is the concept of α, felt in the body").
 */
export function modeSuccessRate(records: DayRecord[]): number | null {
  if (records.length === 0) return null;
  const successes = records.filter((r) => r.stamp !== 'NULL_REPORTED').length;
  return successes / records.length;
}
