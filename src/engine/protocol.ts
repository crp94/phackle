// Worker protocol — TYPES ONLY in T1; T11 implements handleRequest (+
// WorkerState) below the types, per the brief's own framing ("protocol.ts —
// these TYPES were created in T1; T11 implements them"). worker.ts (T11) is
// deliberately a thin shim: it owns the one module-level WorkerState
// instance and the onmessage/postMessage plumbing, and delegates all actual
// dispatch logic to handleRequest here, so handleRequest stays a plain
// function of its two arguments -- unit-testable directly, no real Worker
// needed (see tests/engine/protocol.test.ts).
//
// Exact shapes as pinned by the plan; WindowN is added to the import list
// below because InitInfo/ExtendInfo reference it (both types live in
// src/engine/types.ts) — omitting it would not compile.
import { runSpec } from './analyze';
import { generateDay, generatePractice } from './day';
import type { GeneratedDay } from './day';
import { buildRevealMetrics, pHitAtK } from './reveal';
import { enumerateCurve } from './specGrid';
import type { DayType, Outcome, PathResult, RevealMetrics, Spec, WindowN } from './types';
import { N_SCHEDULE } from '../game/tuning';

export type Req =
  | { id: number; op: 'init'; iso: string; scenarioCount: number; practiceSeed?: number }
  | { id: number; op: 'runSpec'; spec: Spec }
  | { id: number; op: 'extend' }
  | { id: number; op: 'reveal'; published: Spec | null; explored: Spec[] };

export interface InitInfo { scenarioIndex: number; n: WindowN }   // NEVER dayType — puzzleNumber is computed game-side
export interface ExtendInfo { n: WindowN }
export interface RevealPayload extends RevealMetrics {
  dayType: DayType; trueOutcome: Outcome | null;
  // The injected magnitude in the true outcome's own RAW units (effect.d *
  // the pre-injection sample sd), NOT the bare standardized `d` draw --
  // §2.7.1's reveal line ("True effect on [outcome]: β = 0.24") is this
  // number. 0 on null days (§2.7.1's "0.000" line). See day.ts's
  // assemblePuzzle (DailyPuzzle.trueBeta) for how it's actually computed --
  // this field is a passthrough of that value, not recomputed here.
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

// ---- handleRequest (T11) ----

/** The one module-held mutable slice of state a worker's whole lifetime
 * revolves around: the current day (null until the first `init`), the
 * player's current window N, and how many times they've extended it
 * ("peeks", §2.7.3's accounting paragraph). A plain, exported interface (not
 * a class) so tests can construct one directly with `createInitialWorkerState`
 * and inspect it after each `handleRequest` call, with no Worker involved. */
export interface WorkerState {
  day: GeneratedDay | null;
  n: WindowN;
  peeks: number;
}

/** Fresh, uninitialized state: no day held yet, window at the opening
 * N_SCHEDULE entry, zero peeks. Every op except `init` errors against this
 * until the first `init` call populates `day`. */
export function createInitialWorkerState(): WorkerState {
  return { day: null, n: N_SCHEDULE[0], peeks: 0 };
}

/**
 * Pure dispatcher: given the worker's held state and one wire request,
 * returns the wire response, mutating `state` in place exactly as much as
 * the op implies (§5.3). No Worker, no postMessage, no globals -- worker.ts
 * is the only caller that wires this to an actual `self.onmessage`.
 *
 * Spoiler safety (§5.4): every Res this function can return for an op OTHER
 * than 'reveal' is built exclusively from InitInfo/PathResult/ExtendInfo
 * shapes (or a plain string `error`) -- none of which have any field that
 * could carry `dayType`/`trueOutcome`/`trueBeta`, by construction (see
 * tests/engine/protocol.test.ts's spoiler-guard suite, which proves this by
 * JSON-scanning real Res values rather than trusting the type shapes alone).
 * Only 'reveal' attaches the held day's sealed truth.
 */
export function handleRequest(state: WorkerState, req: Req): Res {
  const { id } = req;

  if (req.op === 'init') {
    // FOLD-IN (T10 review ⚠️): assert the shipped p_hit table matches the
    // current DGP constants BEFORE paying for a day's acceptance loop, so a
    // stale table fails fast at day-boot instead of silently reaching the
    // reveal with numbers computed under the wrong DGP. reveal.ts's
    // assertPHitTable isn't callable from here directly (its one argument,
    // the parsed JSON table, isn't itself exported), but pHitAtK calls it
    // unconditionally as its own first statement -- so invoking pHitAtK (and
    // discarding the harmless lookup it returns) triggers that exact
    // assertion using only reveal.ts's public surface. A stale table throws
    // here, deliberately NOT caught into an {ok:false} Res: this is a deploy
    // defect, not a normal protocol error, and letting it escape
    // handleRequest crashes the worker -- exactly what should happen, since
    // the client's onCrash / errors.workerCrash path (not a swallowed error
    // string) is the right place for a stale build artifact to surface.
    pHitAtK(1);

    const day: GeneratedDay =
      req.practiceSeed !== undefined
        ? generatePractice(req.practiceSeed, req.scenarioCount)
        : generateDay(req.iso, req.scenarioCount);

    // Re-init is allowed and intentionally resets everything -- a fresh day
    // after midnight rollover, or a fresh practice run -- so there is no
    // guard against `state.day` already being non-null here.
    state.day = day;
    state.n = N_SCHEDULE[0];
    state.peeks = 0;

    const info: InitInfo = { scenarioIndex: Number(day.puzzle.scenarioId), n: state.n };
    return { id, ok: true, data: info };
  }

  if (state.day === null) {
    return { id, ok: false, error: 'engine not initialized — call init first' };
  }

  if (req.op === 'runSpec') {
    const result = runSpec(state.day.data, req.spec, state.n);
    return { id, ok: true, data: result };
  }

  if (req.op === 'extend') {
    const idx = N_SCHEDULE.indexOf(state.n);
    if (idx === -1 || idx === N_SCHEDULE.length - 1) {
      return { id, ok: false, error: 'max N' };
    }
    state.n = N_SCHEDULE[idx + 1];
    state.peeks += 1;
    const info: ExtendInfo = { n: state.n };
    return { id, ok: true, data: info };
  }

  if (req.op === 'reveal') {
    // Assembled at the CURRENT window, never a hardcoded N=400: the reveal
    // must show exactly the curve the player was looking at (§5.3/§5.4) --
    // if they never extended past the opening window, that's
    // enumerateCurve(data, 200), not the full N.
    const curve = enumerateCurve(state.day.data, state.n);
    const metrics = buildRevealMetrics(state.day, curve, req.published, req.explored, state.peeks);
    const payload: RevealPayload = {
      ...metrics,
      dayType: state.day.puzzle.dayType,
      trueOutcome: state.day.puzzle.trueOutcome ?? null,
      trueBeta: state.day.puzzle.trueBeta ?? 0,
      hetero: state.day.puzzle.heterogeneous ?? null,
    };
    return { id, ok: true, data: payload };
  }

  // Unreachable for a well-formed Req (a closed union of exactly the four ops
  // above), but the wire is not statically checked at runtime -- a
  // version-skewed client or a corrupted message could send anything.
  // Handled gracefully (an ok:false Res) rather than thrown, unlike the
  // init-time checksum assertion above: this is an ordinary malformed-input
  // condition, not a build-time defect worth crashing the worker over.
  const opValue = (req as { op?: unknown }).op;
  return { id, ok: false, error: `unknown op: ${String(opValue)}` };
}
