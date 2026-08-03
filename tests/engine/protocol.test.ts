// Master spec §5.3 (worker RPC) + §5.4 (spoiler safety). protocol.ts's
// contract, per the T11 brief and controller amendments:
//   (a) handleRequest(state, req) is a plain function driven entirely by its
//       arguments -- no Worker, no globals -- so it's unit-testable directly;
//   (b) init: practiceSeed present => generatePractice, else generateDay;
//       returns InitInfo {scenarioIndex, n} -- NEVER dayType/puzzleNumber;
//       re-init on an already-initialized state resets everything (midnight
//       rollover); the shipped p_hit table's checksum is asserted once here
//       (T10 review fold-in), so a stale table fails fast at day-boot;
//   (c) runSpec: analyze.runSpec(heldData, spec, currentN), byte-for-byte;
//   (d) extend: advances the window along N_SCHEDULE, counts peeks
//       worker-side, errors 'max N' once N=400 is already reached (without
//       incrementing peeks on that rejected call);
//   (e) reveal: buildRevealMetrics + enumerateCurve at the CURRENT window
//       (not always N=400), then the sealed truth attached on top
//       (dayType/trueOutcome/trueBeta/hetero) -- the ONLY op allowed to leak
//       any of that;
//   (f) every op's Res for every OTHER op must be spoiler-clean: no
//       dayType/trueOutcome/trueBeta key, no "effect"/"null" string literal
//       attributable to day type, on JSON.stringify -- proved directly
//       rather than assumed, on both a null day and an effect day;
//   (g) an op outside the closed Req union returns {ok:false}, never throws.
import { describe, expect, it, vi } from 'vitest';
import { runSpec } from '../../src/engine/analyze';
import { generateDataset } from '../../src/engine/dgp';
import { generateDay, generatePractice } from '../../src/engine/day';
import {
  createInitialWorkerState,
  handleRequest,
  type ExtendInfo,
  type InitInfo,
  type Req,
  type Res,
  type RevealPayload,
  type WorkerState,
} from '../../src/engine/protocol';
import * as reveal from '../../src/engine/reveal';
import { daySeed, effectParamsFor } from '../../src/engine/seeds';
import { enumerateCurve, sigCount } from '../../src/engine/specGrid';
import type { PathResult, Spec } from '../../src/engine/types';
import { N_SCHEDULE } from '../../src/game/tuning';

const SCENARIO_COUNT = 20; // production scenario count (T6: 20 English scenarios)

// --- date scanning helpers (mirrors tests/engine/day.test.ts's own
// convention: never hardcode a "magic" date -- derive the null-day /
// effect-day / effect-with-heterogeneity isos this test needs by scanning
// real generateDay output, so the suite stays correct even if the DGP or a
// §3.9 tuning knob ever moves which calendar dates land on which side). ---
function consecutiveIsoDates(startIso: string, count: number): string[] {
  const [y, m, d] = startIso.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(start + i * 86_400_000);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

const CANDIDATE_DATES = consecutiveIsoDates('2026-09-01', 40);
const CANDIDATE_DAYS = CANDIDATE_DATES.map((iso) => ({ iso, day: generateDay(iso, SCENARIO_COUNT) }));

const NULL_ISO = CANDIDATE_DAYS.find((c) => c.day.puzzle.dayType === 'null')?.iso;
const EFFECT_ISO = CANDIDATE_DAYS.find((c) => c.day.puzzle.dayType === 'effect')?.iso;
const EFFECT_HETERO_ISO = CANDIDATE_DAYS.find(
  (c) => c.day.puzzle.dayType === 'effect' && c.day.puzzle.heterogeneous !== undefined,
)?.iso;

if (!NULL_ISO || !EFFECT_ISO || !EFFECT_HETERO_ISO) {
  throw new Error(
    'test setup: 40 consecutive dates from 2026-09-01 did not contain a null day, an effect day, and an ' +
      'effect+heterogeneous day -- widen CANDIDATE_DATES\' count.',
  );
}

/** Sample standard deviation (n-1 denominator) -- an independent,
 * from-scratch reimplementation (NOT imported from src/engine/dgp.ts or
 * src/engine/day.ts) used only to reconstruct the expected trueBeta value in
 * the "effect day: trueBeta" test below. Deliberately kept separate from
 * production code's own (also-independent) copies, so this test can't pass
 * merely because it shares a bug with the implementation it's checking. */
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

function freshState(): WorkerState {
  return createInitialWorkerState();
}

function expectOk(res: Res): asserts res is Res & { ok: true } {
  if (!res.ok) throw new Error(`expected ok:true, got ok:false, error: ${res.error}`);
}

function expectErr(res: Res): asserts res is Res & { ok: false } {
  if (res.ok) throw new Error('expected ok:false, got ok:true');
}

function initData(res: Res): InitInfo {
  expectOk(res);
  return res.data as InitInfo;
}
function pathData(res: Res): PathResult {
  expectOk(res);
  return res.data as PathResult;
}
function extendData(res: Res): ExtendInfo {
  expectOk(res);
  return res.data as ExtendInfo;
}
function revealData(res: Res): RevealPayload {
  expectOk(res);
  return res.data as RevealPayload;
}

const SAMPLE_SPEC: Spec = {
  outcome: 1,
  subgroup: 'urban',
  covariates: { income: false, risk: true },
  exclusion: 'z2_5',
  transform: 'log1p',
  tails: 'one',
};

// --- (b) init ---

describe('handleRequest — init', () => {
  it('on a real iso, returns InitInfo {scenarioIndex, n=N_SCHEDULE[0]} and NEVER dayType/puzzleNumber', () => {
    const state = freshState();
    const res = handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    expectOk(res);
    expect(res.id).toBe(1);
    expect(res.data).toEqual({ scenarioIndex: expect.any(Number), n: N_SCHEDULE[0] });
    expect(Object.keys(res.data)).toEqual(['scenarioIndex', 'n']);
  });

  it('practiceSeed present => generatePractice (scenarioIndex matches the direct call)', () => {
    const seed = 4242;
    const direct = generatePractice(seed, SCENARIO_COUNT);
    const state = freshState();
    const res = handleRequest(state, {
      id: 1,
      op: 'init',
      iso: '2026-01-01',
      scenarioCount: SCENARIO_COUNT,
      practiceSeed: seed,
    });
    expect(initData(res).scenarioIndex).toBe(Number(direct.puzzle.scenarioId));
  });

  it('practiceSeed absent => generateDay (scenarioIndex matches the direct call)', () => {
    const direct = generateDay(NULL_ISO, SCENARIO_COUNT);
    const state = freshState();
    const res = handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    expect(initData(res).scenarioIndex).toBe(Number(direct.puzzle.scenarioId));
  });

  it('practice mode ignores iso entirely -- only practiceSeed decides the day', () => {
    const seed = 777;
    const stateA = freshState();
    const resA = handleRequest(stateA, {
      id: 1,
      op: 'init',
      iso: '2000-01-01',
      scenarioCount: SCENARIO_COUNT,
      practiceSeed: seed,
    });
    const stateB = freshState();
    const resB = handleRequest(stateB, {
      id: 1,
      op: 'init',
      iso: '2099-12-31',
      scenarioCount: SCENARIO_COUNT,
      practiceSeed: seed,
    });
    expect(initData(resA)).toEqual(initData(resB));
  });

  it('re-init on an already-initialized state resets day/n/peeks (midnight rollover)', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    handleRequest(state, { id: 2, op: 'extend' });
    handleRequest(state, { id: 3, op: 'extend' });
    expect(state.n).toBe(300);
    expect(state.peeks).toBe(2);

    const res2 = handleRequest(state, { id: 4, op: 'init', iso: EFFECT_ISO, scenarioCount: SCENARIO_COUNT });
    expect(initData(res2).n).toBe(N_SCHEDULE[0]);
    expect(state.n).toBe(N_SCHEDULE[0]);
    expect(state.peeks).toBe(0);
    expect(state.day?.puzzle.isoDate).toBe(EFFECT_ISO);
  });

  it('asserts the p_hit table checksum during init (T10 review fold-in) -- fails fast at day-boot', () => {
    const spy = vi.spyOn(reveal, 'pHitAtK');
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('throws (does not return ok:false) if the shipped p_hit table is stale relative to current DGP constants', async () => {
    vi.resetModules();
    vi.doMock('../../src/data/p_hit_by_k.json', () => ({
      default: { checksum: -1, pHit: new Array(41).fill(0.5) },
    }));
    try {
      const fresh = await import('../../src/engine/protocol');
      const staleState = fresh.createInitialWorkerState();
      expect(() =>
        fresh.handleRequest(staleState, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT }),
      ).toThrow(/stale/i);
    } finally {
      vi.doUnmock('../../src/data/p_hit_by_k.json');
      vi.resetModules();
    }
  });
});

// --- ops before init ---

describe('handleRequest — before init', () => {
  it('runSpec/extend/reveal all return ok:false when called before any init', () => {
    const specReq: Req = { id: 1, op: 'runSpec', spec: SAMPLE_SPEC };
    const extendReq: Req = { id: 2, op: 'extend' };
    const revealReq: Req = { id: 3, op: 'reveal', published: null, explored: [] };
    for (const req of [specReq, extendReq, revealReq]) {
      const res = handleRequest(freshState(), req);
      expectErr(res);
    }
  });
});

// --- (c) runSpec ---

describe('handleRequest — runSpec', () => {
  it('matches analyze.runSpec(data, spec, currentN) byte-for-byte for the held day', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    const res = handleRequest(state, { id: 2, op: 'runSpec', spec: SAMPLE_SPEC });

    const { data } = generateDay(NULL_ISO, SCENARIO_COUNT); // same iso => byte-identical data (determinism)
    const want = runSpec(data, SAMPLE_SPEC, N_SCHEDULE[0]);
    expect(pathData(res)).toEqual(want);
  });

  it('runs at the CURRENT window N after an extend, not the opening window', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    handleRequest(state, { id: 2, op: 'extend' }); // -> 250
    const res = handleRequest(state, { id: 3, op: 'runSpec', spec: SAMPLE_SPEC });

    const { data } = generateDay(NULL_ISO, SCENARIO_COUNT);
    const want = runSpec(data, SAMPLE_SPEC, 250);
    expect(pathData(res)).toEqual(want);
  });
});

// --- (d) extend ---

describe('handleRequest — extend', () => {
  it('advances N along N_SCHEDULE, counting one peek per successful extend', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });

    const expectedNs = N_SCHEDULE.slice(1); // [250, 300, 350, 400]
    let id = 2;
    for (const expectedN of expectedNs) {
      const res = handleRequest(state, { id: id++, op: 'extend' });
      expect(extendData(res).n).toBe(expectedN);
    }
    expect(state.peeks).toBe(expectedNs.length);
    expect(state.n).toBe(400);
  });

  it('errors "max N" once N=400 is already reached, and does not increment peeks on that rejection', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    let id = 2;
    for (let i = 1; i < N_SCHEDULE.length; i++) {
      handleRequest(state, { id: id++, op: 'extend' });
    }
    expect(state.peeks).toBe(N_SCHEDULE.length - 1);

    const overRes = handleRequest(state, { id, op: 'extend' });
    expectErr(overRes);
    expect(overRes.error).toBe('max N');
    expect(state.peeks).toBe(N_SCHEDULE.length - 1); // unchanged
    expect(state.n).toBe(400); // unchanged
  });
});

// --- (e) reveal ---

describe('handleRequest — reveal', () => {
  it('peeks in the payload equals the number of successful extends', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    handleRequest(state, { id: 2, op: 'extend' });
    handleRequest(state, { id: 3, op: 'extend' });
    const res = handleRequest(state, { id: 4, op: 'reveal', published: null, explored: [] });
    expect(revealData(res).peeks).toBe(2);
  });

  it('assembles the curve at the CURRENT window N (200, un-extended), matching direct enumerateCurve', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    const res = handleRequest(state, { id: 2, op: 'reveal', published: null, explored: [] });

    const { data } = generateDay(NULL_ISO, SCENARIO_COUNT);
    const want200 = sigCount(enumerateCurve(data, 200));
    const want400 = sigCount(enumerateCurve(data, 400));
    // Precondition: the two windows must actually differ for this iso, or
    // the assertion below can't distinguish "used 200" from "used 400".
    expect(want200).not.toBe(want400);
    expect(revealData(res).sigPaths).toBe(want200);
  });

  it('assembles the curve at the CURRENT window N (400, after 4 extends), matching direct enumerateCurve', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    for (let i = 1; i < N_SCHEDULE.length; i++) handleRequest(state, { id: i + 1, op: 'extend' });
    const res = handleRequest(state, { id: 99, op: 'reveal', published: null, explored: [] });

    const { data } = generateDay(NULL_ISO, SCENARIO_COUNT);
    const want400 = sigCount(enumerateCurve(data, 400));
    expect(revealData(res).sigPaths).toBe(want400);
  });

  it('null day: dayType="null", trueOutcome=null, trueBeta=0, hetero=null', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    const payload = revealData(handleRequest(state, { id: 2, op: 'reveal', published: null, explored: [] }));
    expect(payload.dayType).toBe('null');
    expect(payload.trueOutcome).toBeNull();
    expect(payload.trueBeta).toBe(0);
    expect(payload.hetero).toBeNull();
  });

  it('effect day: trueOutcome matches, trueBeta equals the independently-reconstructed injected d*sd magnitude', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: EFFECT_ISO, scenarioCount: SCENARIO_COUNT });
    const payload = revealData(handleRequest(state, { id: 2, op: 'reveal', published: null, explored: [] }));

    const { puzzle } = generateDay(EFFECT_ISO, SCENARIO_COUNT);
    expect(payload.dayType).toBe('effect');
    expect(payload.trueOutcome).toBe(puzzle.trueOutcome);

    // Independent reconstruction from first principles -- daySeed +
    // generateDataset(seed, null) + a from-scratch sd calc -- deliberately
    // NOT calling anything inside day.ts's own trueBeta computation, so this
    // is a real proof the wire number is the actual injected magnitude.
    const seed = daySeed(EFFECT_ISO, puzzle.attemptUsed);
    const baseline = generateDataset(seed, null);
    const params = effectParamsFor(EFFECT_ISO);
    const expectedTrueBeta = params.d * sampleSd(baseline.y[params.outcome]);
    expect(payload.trueBeta).toBe(expectedTrueBeta);
  });

  it('effect day with heterogeneity: hetero passthrough matches the held day', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: EFFECT_HETERO_ISO, scenarioCount: SCENARIO_COUNT });
    const payload = revealData(handleRequest(state, { id: 2, op: 'reveal', published: null, explored: [] }));

    const { puzzle } = generateDay(EFFECT_HETERO_ISO, SCENARIO_COUNT);
    expect(puzzle.heterogeneous).toBeDefined();
    expect(payload.hetero).toEqual(puzzle.heterogeneous);
  });

  it('effect day without heterogeneity: hetero is null', () => {
    const { puzzle: effectPuzzle } = generateDay(EFFECT_ISO, SCENARIO_COUNT);
    // Sanity: EFFECT_ISO (distinct from EFFECT_HETERO_ISO by construction of
    // the scan above) must actually be a no-hetero day for this test to mean
    // anything.
    expect(effectPuzzle.heterogeneous).toBeUndefined();

    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: EFFECT_ISO, scenarioCount: SCENARIO_COUNT });
    const payload = revealData(handleRequest(state, { id: 2, op: 'reveal', published: null, explored: [] }));
    expect(payload.hetero).toBeNull();
  });
});

// --- (g) unknown op ---

describe('handleRequest — unknown op', () => {
  it('returns ok:false (never throws) for an op outside the closed Req union', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: NULL_ISO, scenarioCount: SCENARIO_COUNT });
    const bogus = { id: 2, op: 'bogus' } as unknown as Req;
    const res = handleRequest(state, bogus);
    expectErr(res);
    expect(res.error).toContain('bogus');
  });
});

// --- (f) spoiler guard (§5.4) -- the test that matters most ---

describe('spoiler guard (§5.4): no pre-reveal Res leaks the day type', () => {
  const FORBIDDEN_KEYS = ['dayType', 'trueOutcome', 'trueBeta'];
  const FORBIDDEN_LITERALS = ['"effect"', '"null"'];

  function assertSpoilerClean(res: Res, label: string): void {
    const json = JSON.stringify(res);
    for (const key of FORBIDDEN_KEYS) {
      expect(json, `${label}: leaked key "${key}" in ${json}`).not.toContain(`"${key}"`);
    }
    for (const literal of FORBIDDEN_LITERALS) {
      expect(json, `${label}: leaked literal ${literal} in ${json}`).not.toContain(literal);
    }
  }

  it('holds for init, runSpec, and every extend (including the max-N error), on both a null day and an effect day', () => {
    for (const iso of [NULL_ISO, EFFECT_ISO]) {
      const state = freshState();

      const initRes = handleRequest(state, { id: 1, op: 'init', iso, scenarioCount: SCENARIO_COUNT });
      assertSpoilerClean(initRes, `init(${iso})`);

      const specRes = handleRequest(state, { id: 2, op: 'runSpec', spec: SAMPLE_SPEC });
      assertSpoilerClean(specRes, `runSpec(${iso})`);

      let id = 3;
      for (let i = 1; i < N_SCHEDULE.length; i++) {
        const extendRes = handleRequest(state, { id: id++, op: 'extend' });
        assertSpoilerClean(extendRes, `extend(${iso}, n->${N_SCHEDULE[i]})`);
      }
      // One more extend past N=400: the max-N error response itself.
      const overRes = handleRequest(state, { id: id++, op: 'extend' });
      assertSpoilerClean(overRes, `extend-over-max(${iso})`);

      const bogusRes = handleRequest(state, { id, op: 'bogus' } as unknown as Req);
      assertSpoilerClean(bogusRes, `unknown-op(${iso})`);
    }
  });

  it('holds for the "not initialized" error response (both day types are moot pre-init, but scan anyway)', () => {
    const uninitRes = handleRequest(freshState(), { id: 1, op: 'runSpec', spec: SAMPLE_SPEC });
    assertSpoilerClean(uninitRes, 'uninitialized runSpec');
  });

  it('reveal is the ONLY op whose Res is allowed to carry the truth (sanity check on the guard itself)', () => {
    const state = freshState();
    handleRequest(state, { id: 1, op: 'init', iso: EFFECT_ISO, scenarioCount: SCENARIO_COUNT });
    const revealRes = handleRequest(state, { id: 2, op: 'reveal', published: null, explored: [] });
    const json = JSON.stringify(revealRes);
    expect(json).toContain('"dayType"');
    expect(json).toContain('"effect"');
  });
});
