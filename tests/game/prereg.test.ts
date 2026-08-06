// T18 — Prereg Mode's own store-level machinery: chooseMode/preregCommit
// (master spec §2.2/§2.6/§7.3), single-shot N=400 enforcement (§3.8's
// "no other way to reach the top of N_SCHEDULE" mechanics), the stamp
// correction preregCommit applies on top of the engine's own verdictStamp
// (§2.7.4), the §2.8 prereg scoring rows end-to-end, and one 🧾 share-string
// integration test. Same conventions as tests/game/store.test.ts (its own
// makeFakeClient/makeResult/makeRevealPayload fixtures, duplicated locally
// per this codebase's one-task-one-test-file convention).
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { EngineClient, ExtendInfo, InitInfo, RevealPayload } from '../../src/engine/protocol';
import type { Outcome, PathResult, Spec } from '../../src/engine/types';
import { createGameStore, DEFAULT_SPEC } from '../../src/game/store';
import { N_SCHEDULE, SCORING } from '../../src/game/tuning';
import { persistAndComputeSummary } from '../../src/game/dayComplete';
import { copy as enCopy } from '../../src/content/en/copy';

// --- fixtures ----------------------------------------------------------------

function makeResult(overrides: Partial<PathResult> = {}): PathResult {
  return {
    spec: DEFAULT_SPEC,
    n: 200,
    beta: 0.12,
    se: 0.05,
    t: 2.4,
    p: 0.02,
    ci: [0.02, 0.22],
    excludedCount: 0,
    valid: true,
    ...overrides,
  };
}

function makeRevealPayload(overrides: Partial<RevealPayload> = {}): RevealPayload {
  return {
    totalPaths: 1792,
    sigPaths: 87,
    sigFraction: 0.0486,
    playerExplored: 1,
    pHitAtK: 0.52,
    curve: [],
    // The engine's OWN verdictStamp only ever knows "published !== null", so
    // it defaults to RETRACTED here (a null day) unless a test overrides
    // dayType/trueOutcome — preregCommit is the thing under test that must
    // correct this for the non-significant case.
    stamp: 'RETRACTED',
    peeks: 4, // as if 4 extend()s were "peeks" — exactly what preregCommit must zero out
    dayType: 'null',
    trueOutcome: null,
    trueBeta: 0,
    hetero: null,
    ...overrides,
  };
}

/**
 * `extend` is scripted to resolve exactly N_SCHEDULE.length - 1 times (the
 * real number of steps from the opening window to N=400), stepping through
 * N_SCHEDULE in order, and to REJECT on any call beyond that — the "fake
 * client: extend throws" safety net the task brief calls for: an off-by-one
 * bug in preregCommit's own extend-driving loop surfaces as an outright
 * rejected promise, not a silently-wrong N.
 */
function makeFakeClient(): EngineClient {
  const extend = vi.fn<EngineClient['extend']>();
  for (const n of N_SCHEDULE.slice(1)) {
    extend.mockResolvedValueOnce({ n } satisfies ExtendInfo);
  }
  extend.mockRejectedValue(new Error('extend called beyond N_SCHEDULE.length - 1 — preregCommit should never do this'));

  return {
    init: vi.fn().mockResolvedValue({ scenarioIndex: 0, n: 200 } satisfies InitInfo),
    runSpec: vi.fn().mockResolvedValue(makeResult()),
    extend,
    reveal: vi.fn().mockResolvedValue(makeRevealPayload()),
    onCrash: vi.fn(),
  };
}

const BOOT_OPTS = { practice: false, mode: 'hack' as const, scenarioCount: 1792 };
const MAX_N = N_SCHEDULE[N_SCHEDULE.length - 1];

/** Drives a fresh store to the 'prereg' screen (boot -> chooseMode) — every
 * preregCommit test starts from here. */
async function bootToPrereg(client: EngineClient) {
  const store = createGameStore();
  await store.getState().boot(client, '2026-09-01', BOOT_OPTS);
  store.getState().chooseMode('prereg');
  return store;
}

const committedSpec: Spec = { ...DEFAULT_SPEC, outcome: 1, subgroup: 'urban' };

// --- chooseMode --------------------------------------------------------------

describe('chooseMode (§2.2 "prereg unlocked: choose mode first")', () => {
  it('throws when called from any screen other than briefing', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, '2026-09-01', BOOT_OPTS);
    store.getState().openData(); // now on 'lab'

    expect(() => store.getState().chooseMode('prereg')).toThrow();
    expect(store.getState().screen).toBe('lab');
  });

  it('sets mode:prereg and screen:prereg from the briefing', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, '2026-09-01', BOOT_OPTS);

    store.getState().chooseMode('prereg');

    expect(store.getState().mode).toBe('prereg');
    expect(store.getState().screen).toBe('prereg');
  });

  it('sets mode:hack and screen:lab from the briefing (symmetric with openData)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, '2026-09-01', BOOT_OPTS);

    store.getState().chooseMode('hack');

    expect(store.getState().mode).toBe('hack');
    expect(store.getState().screen).toBe('lab');
  });
});

// --- preregCommit guards ------------------------------------------------------

describe('preregCommit — guards (§7.3 single-shot enforcement)', () => {
  it('rejects when not booted', async () => {
    const store = createGameStore();
    await expect(store.getState().preregCommit(committedSpec)).rejects.toThrow('not booted');
  });

  it('rejects when screen is not "prereg" (still on briefing, mode hack)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, '2026-09-01', BOOT_OPTS);
    // No chooseMode('prereg') — screen is still 'briefing', mode is 'hack'.

    await expect(store.getState().preregCommit(committedSpec)).rejects.toThrow();
    expect(client.extend).not.toHaveBeenCalled();
    expect(client.runSpec).toHaveBeenCalledTimes(1); // only boot's own prefetch
  });

  it('rejects when screen is "lab" (hacking mode chosen instead)', async () => {
    const client = makeFakeClient();
    const store = createGameStore();
    await store.getState().boot(client, '2026-09-01', BOOT_OPTS);
    store.getState().openData();

    await expect(store.getState().preregCommit(committedSpec)).rejects.toThrow();
    expect(client.extend).not.toHaveBeenCalled();
  });

  it('rejects a SECOND call made while the first is still in flight (reentrancy — belt and suspenders)', async () => {
    const client = makeFakeClient();
    const store = await bootToPrereg(client);

    const first = store.getState().preregCommit(committedSpec); // starts; synchronously sets pending:true
    await expect(store.getState().preregCommit(committedSpec)).rejects.toThrow();

    await first; // let the first (legitimate) commit finish cleanly
    expect(client.runSpec).toHaveBeenCalledTimes(2); // boot's + exactly ONE from preregCommit
  });

  it('rejects a call made AFTER a commit has already completed (screen has moved to reveal)', async () => {
    const client = makeFakeClient();
    const store = await bootToPrereg(client);
    await store.getState().preregCommit(committedSpec);
    expect(store.getState().screen).toBe('reveal');

    await expect(store.getState().preregCommit(committedSpec)).rejects.toThrow();
    expect(client.runSpec).toHaveBeenCalledTimes(2); // not called a third time
  });
});

// --- single-shot N=400 mechanics ---------------------------------------------

describe('preregCommit — N=400 mechanics (judgment call: drive extend() to the top before the one runSpec)', () => {
  it('calls extend() exactly N_SCHEDULE.length - 1 times, reaching N=400, before running the spec even once', async () => {
    const client = makeFakeClient();
    const store = await bootToPrereg(client);
    expect(store.getState().n).toBe(N_SCHEDULE[0]); // 200, unchanged since boot

    await store.getState().preregCommit(committedSpec);

    expect(client.extend).toHaveBeenCalledTimes(N_SCHEDULE.length - 1);
    expect(store.getState().n).toBe(MAX_N);
  });

  it('dispatches runSpec exactly once — on the COMMITTED spec, not the default one boot prefetched', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult()) // boot's own prefetch (DEFAULT_SPEC)
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.01 }));
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(client.runSpec).toHaveBeenCalledTimes(2);
    expect(client.runSpec).toHaveBeenLastCalledWith(committedSpec);
  });

  it('never dispatches runSpec BETWEEN extend calls (unlike peekAndExtend, nothing is shown before commit)', async () => {
    const client = makeFakeClient();
    const store = await bootToPrereg(client);
    const before = (client.runSpec as Mock).mock.calls.length; // 1, from boot

    await store.getState().preregCommit(committedSpec);

    // Exactly one MORE runSpec call than before — never one per extend step.
    expect((client.runSpec as Mock).mock.calls.length).toBe(before + 1);
  });

  it('fetches the reveal with published=spec and explored=[spec] (the controller\'s own pin)', async () => {
    const client = makeFakeClient();
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(client.reveal).toHaveBeenCalledTimes(1);
    expect(client.reveal).toHaveBeenCalledWith(committedSpec, [committedSpec]);
  });

  it('lands on "reveal", with published/spec/preregResult all set to the committed spec/result', async () => {
    const client = makeFakeClient();
    const committedResult = makeResult({ spec: committedSpec, p: 0.01, valid: true });
    (client.runSpec as Mock).mockResolvedValueOnce(makeResult()).mockResolvedValueOnce(committedResult);
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    const s = store.getState();
    expect(s.screen).toBe('reveal');
    expect(s.published).toEqual(committedSpec);
    expect(s.spec).toEqual(committedSpec);
    expect(s.result).toEqual(committedResult);
    expect(s.preregResult).toEqual(committedResult);
    expect(s.pending).toBe(false);
  });

  it('never counts a fork: the committed spec is logged with seen:false, so forks stays 0', async () => {
    const client = makeFakeClient();
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    const s = store.getState();
    expect(s.forks).toBe(0);
    expect(s.log.at(-1)).toEqual({ t: 'VIEW_SPEC', spec: committedSpec, seen: false, at: expect.any(Number) });
  });
});

// --- stamp correction ---------------------------------------------------------

describe('preregCommit — stamp correction (the engine\'s own verdictStamp assumes "published implies significant", which does not hold here)', () => {
  it('sig + effect day + right outcome -> REPLICATED (engine\'s own call, kept verbatim)', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.01, valid: true }));
    (client.reveal as Mock).mockResolvedValue(
      makeRevealPayload({ stamp: 'REPLICATED', dayType: 'effect', trueOutcome: 1 as Outcome, peeks: 4 })
    );
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(store.getState().reveal?.stamp).toBe('REPLICATED');
  });

  it('sig + effect day + WRONG outcome -> RETRACTED (§2.7.4, engine\'s own call, kept verbatim)', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.01, valid: true }));
    // Engine sees published.outcome (1) !== trueOutcome (2) on an effect day -> RETRACTED.
    (client.reveal as Mock).mockResolvedValue(
      makeRevealPayload({ stamp: 'RETRACTED', dayType: 'effect', trueOutcome: 2 as Outcome, peeks: 4 })
    );
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(store.getState().reveal?.stamp).toBe('RETRACTED');
  });

  it('sig + null day -> RETRACTED (§2.8: "a real 5% false positive — teachable")', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.01, valid: true }));
    (client.reveal as Mock).mockResolvedValue(makeRevealPayload({ stamp: 'RETRACTED', dayType: 'null', peeks: 4 }));
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(store.getState().reveal?.stamp).toBe('RETRACTED');
  });

  it('non-significant on a null day -> NULL_REPORTED, OVERRIDING whatever the engine said (it assumed significance)', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.4, valid: true })); // NOT significant
    // The engine's own verdictStamp has no idea the commit was non-significant
    // (it only sees "published !== null" on a null day) -- it reports RETRACTED.
    (client.reveal as Mock).mockResolvedValue(makeRevealPayload({ stamp: 'RETRACTED', dayType: 'null', peeks: 4 }));
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(store.getState().reveal?.stamp).toBe('NULL_REPORTED');
  });

  it('non-significant on an effect day -> NULL_REPORTED, overriding an engine-reported REPLICATED/RETRACTED', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.4, valid: true }));
    (client.reveal as Mock).mockResolvedValue(
      makeRevealPayload({ stamp: 'REPLICATED', dayType: 'effect', trueOutcome: 1 as Outcome, peeks: 4 })
    );
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(store.getState().reveal?.stamp).toBe('NULL_REPORTED');
  });

  it('an INVALID result (n<30) never counts as significant, even at p<0.05 -> NULL_REPORTED', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.01, valid: false }));
    (client.reveal as Mock).mockResolvedValue(makeRevealPayload({ stamp: 'RETRACTED', dayType: 'null', peeks: 4 }));
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(store.getState().reveal?.stamp).toBe('NULL_REPORTED');
  });
});

// --- peeks override -----------------------------------------------------------

describe('preregCommit — peeks override (judgment call: the 4 extends are not player "peeking")', () => {
  it('zeroes the stored reveal.peeks regardless of what the engine reported', async () => {
    const client = makeFakeClient();
    (client.reveal as Mock).mockResolvedValue(makeRevealPayload({ peeks: 4 }));
    const store = await bootToPrereg(client);

    await store.getState().preregCommit(committedSpec);

    expect(store.getState().reveal?.peeks).toBe(0);
  });
});

// --- §2.8 prereg scoring rows, end-to-end ------------------------------------

describe('§2.8 prereg scoring rows — end-to-end through the real store + persistAndComputeSummary', () => {
  async function runPrereg(resultOverrides: Partial<PathResult>, payloadOverrides: Partial<RevealPayload>) {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, ...resultOverrides }));
    (client.reveal as Mock).mockResolvedValue(makeRevealPayload(payloadOverrides));
    const store = await bootToPrereg(client);
    await store.getState().preregCommit(committedSpec);
    return store.getState();
  }

  it('sig + effect day -> SCORING.preregSigEffect ("True discovery")', async () => {
    const s = await runPrereg(
      { p: 0.01, valid: true },
      { stamp: 'REPLICATED', dayType: 'effect', trueOutcome: 1 as Outcome }
    );
    const result = persistAndComputeSummary({
      mode: 'prereg',
      practice: true, // never persist in this scoring-only test
      puzzleNumber: s.puzzleNumber,
      forks: s.forks,
      published: s.published !== null,
      call: s.call,
      dayType: s.reveal!.dayType,
      stamp: s.reveal!.stamp,
      log: s.log,
      copy: enCopy,
      puzzleIso: s.iso,
      resultLog: s.resultLog,
      preregResult: s.preregResult,
    });
    expect(result.score).toBe(SCORING.preregSigEffect);
    expect(result.breakdown).toEqual([['summary.breakdownTrueDiscovery', SCORING.preregSigEffect]]);
  });

  it('non-sig + null day -> SCORING.preregNonsigNull ("Confirmed null")', async () => {
    const s = await runPrereg({ p: 0.6, valid: true }, { stamp: 'RETRACTED', dayType: 'null' });
    const result = persistAndComputeSummary({
      mode: 'prereg',
      practice: true,
      puzzleNumber: s.puzzleNumber,
      forks: s.forks,
      published: s.published !== null,
      call: s.call,
      dayType: s.reveal!.dayType,
      stamp: s.reveal!.stamp,
      log: s.log,
      copy: enCopy,
      puzzleIso: s.iso,
      resultLog: s.resultLog,
      preregResult: s.preregResult,
    });
    expect(result.score).toBe(SCORING.preregNonsigNull);
    expect(result.breakdown).toEqual([['summary.breakdownConfirmedNull', SCORING.preregNonsigNull]]);
  });

  it('non-sig + effect day -> SCORING.preregNonsigEffect ("Underpowered luck")', async () => {
    const s = await runPrereg(
      { p: 0.3, valid: true },
      { stamp: 'REPLICATED', dayType: 'effect', trueOutcome: 1 as Outcome }
    );
    const result = persistAndComputeSummary({
      mode: 'prereg',
      practice: true,
      puzzleNumber: s.puzzleNumber,
      forks: s.forks,
      published: s.published !== null,
      call: s.call,
      dayType: s.reveal!.dayType,
      stamp: s.reveal!.stamp,
      log: s.log,
      copy: enCopy,
      puzzleIso: s.iso,
      resultLog: s.resultLog,
      preregResult: s.preregResult,
    });
    expect(result.score).toBe(SCORING.preregNonsigEffect);
    expect(result.breakdown).toEqual([['summary.breakdownUnderpoweredLuck', SCORING.preregNonsigEffect]]);
  });

  it('sig + null day -> SCORING.preregSigNull (0 points, "False positive")', async () => {
    const s = await runPrereg({ p: 0.01, valid: true }, { stamp: 'RETRACTED', dayType: 'null' });
    const result = persistAndComputeSummary({
      mode: 'prereg',
      practice: true,
      puzzleNumber: s.puzzleNumber,
      forks: s.forks,
      published: s.published !== null,
      call: s.call,
      dayType: s.reveal!.dayType,
      stamp: s.reveal!.stamp,
      log: s.log,
      copy: enCopy,
      puzzleIso: s.iso,
      resultLog: s.resultLog,
      preregResult: s.preregResult,
    });
    expect(result.score).toBe(SCORING.preregSigNull);
    expect(SCORING.preregSigNull).toBe(0);
    expect(result.breakdown).toEqual([['summary.breakdownFalsePositive', SCORING.preregSigNull]]);
  });
});

// --- share — 🧾 prefix, end-to-end --------------------------------------------

describe('share — 🧾 prefix (T13\'s pipeline, fired by a real mode:"prereg" DayRecord)', () => {
  // Post-review fix: asserts the FULL line 2, not just the prefix.
  // preregCommit() never logs a SUBMIT/ABANDON (§2.6 — always run &
  // reported, never abandoned) and never makes a call (§2.8 — no CALL step),
  // so the real, correct output is exactly "🧾📄" — no fork glyphs (both
  // VIEW_SPEC entries are seen:false, so neither counts, §2.10) and NO
  // "→ ⚖️…" suffix at all (callCorrect must reach shareString as null, not
  // be coerced to a boolean).
  it('a full prereg day produces a share string line 2 of exactly 🧾📄 — no fork glyphs, no ⚖️ call marker', async () => {
    const client = makeFakeClient();
    (client.runSpec as Mock)
      .mockResolvedValueOnce(makeResult())
      .mockResolvedValueOnce(makeResult({ spec: committedSpec, p: 0.01, valid: true }));
    (client.reveal as Mock).mockResolvedValue(
      makeRevealPayload({ stamp: 'REPLICATED', dayType: 'effect', trueOutcome: 1 as Outcome })
    );
    const store = await bootToPrereg(client);
    await store.getState().preregCommit(committedSpec);
    const s = store.getState();

    const result = persistAndComputeSummary({
      mode: s.mode,
      practice: true,
      puzzleNumber: s.puzzleNumber,
      forks: s.forks,
      published: s.published !== null,
      call: s.call,
      dayType: s.reveal!.dayType,
      stamp: s.reveal!.stamp,
      log: s.log,
      copy: enCopy,
      puzzleIso: s.iso,
      resultLog: s.resultLog,
      preregResult: s.preregResult,
    });

    expect(s.mode).toBe('prereg');
    expect(s.call).toBeNull();
    expect(result.shareText.split('\n')[1]).toBe('🧾📄');
  });
});
