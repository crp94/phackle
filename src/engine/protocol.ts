// Worker protocol — TYPES ONLY in T1 (implementation lands in T11).
// Exact shapes as pinned by the plan; WindowN is added to the import list
// below because InitInfo/ExtendInfo reference it (both types live in
// src/engine/types.ts) — omitting it would not compile.
import type { DayType, Outcome, PathResult, RevealMetrics, Spec, WindowN } from './types';

export type Req =
  | { id: number; op: 'init'; iso: string; scenarioCount: number; practiceSeed?: number }
  | { id: number; op: 'runSpec'; spec: Spec }
  | { id: number; op: 'extend' }
  | { id: number; op: 'reveal'; published: Spec | null; explored: Spec[] };

export interface InitInfo { scenarioIndex: number; n: WindowN }   // NEVER dayType — puzzleNumber is computed game-side
export interface ExtendInfo { n: WindowN }
export interface RevealPayload extends RevealMetrics {
  dayType: DayType; trueOutcome: Outcome | null;
  trueBeta: number; hetero: { subgroup: Spec['subgroup']; multiplier: number } | null;
}

export type Res = { id: number; ok: true; data: InitInfo | PathResult | ExtendInfo | RevealPayload }
                | { id: number; ok: false; error: string };

export interface EngineClient {
  init(iso: string, scenarioCount: number, practiceSeed?: number): Promise<InitInfo>;
  // NOTE: fields may carry real computed values even when valid === false —
  // always gate on valid before displaying or aggregating.
  runSpec(spec: Spec): Promise<PathResult>;
  extend(): Promise<ExtendInfo>;
  reveal(published: Spec | null, explored: Spec[]): Promise<RevealPayload>;
  onCrash(cb: () => void): void;
}
