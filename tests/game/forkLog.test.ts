import { describe, expect, it } from 'vitest';
import type { PlayerAction, Spec } from '../../src/engine/types';
import { classifyChange, countForks, distinctExplored } from '../../src/game/forkLog';

// --- fixtures -------------------------------------------------------------

const baseSpec: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function spec(overrides: Partial<Omit<Spec, 'covariates'>> & { covariates?: Partial<Spec['covariates']> } = {}): Spec {
  return {
    ...baseSpec,
    ...overrides,
    covariates: { ...baseSpec.covariates, ...overrides.covariates },
  };
}

function view(s: Spec, seenFlag: boolean, at = 0): PlayerAction {
  return { t: 'VIEW_SPEC', spec: s, seen: seenFlag, at };
}

function peek(at = 0): PlayerAction {
  return { t: 'PEEK_AND_EXTEND', newN: 250, at };
}

// --- countForks -------------------------------------------------------------

describe('countForks (§2.10 exact fork rule)', () => {
  it('the initial spec is free regardless of its own seen flag', () => {
    expect(countForks([view(spec(), true)])).toBe(0);
    expect(countForks([view(spec(), false)])).toBe(0);
  });

  it('counts a change made after a result was seen for the previous spec', () => {
    const log = [view(spec(), false), view(spec({ outcome: 1 }), true)];
    expect(countForks(log)).toBe(1);
  });

  it('does not count a change made before the previous spec rendered a result', () => {
    const log = [view(spec(), false), view(spec({ outcome: 1 }), false)];
    expect(countForks(log)).toBe(0);
  });

  it('PEEK_AND_EXTEND always counts, independent of the seen flag around it', () => {
    expect(countForks([view(spec(), false), peek()])).toBe(1);
    expect(countForks([view(spec(), true), peek(), peek()])).toBe(2);
  });

  it('accumulates correctly over a mixed sequence', () => {
    const log = [
      view(spec(), false), // initial, free
      view(spec({ outcome: 1 }), true), // fork (seen=true)
      peek(), // fork (peek always counts)
      view(spec({ outcome: 1, subgroup: 'urban' }), false), // not counted (seen=false)
      view(spec({ outcome: 1, subgroup: 'urban', tails: 'one' }), true), // fork (seen=true)
    ];
    expect(countForks(log)).toBe(3);
  });

  it('ignores SUBMIT/ABANDON/CALL entries entirely', () => {
    const log: PlayerAction[] = [
      view(spec(), false),
      { t: 'SUBMIT', spec: spec(), p: 0.03, at: 1 },
      { t: 'ABANDON', at: 2 },
      { t: 'CALL', verdict: 'real', at: 3 },
    ];
    expect(countForks(log)).toBe(0);
  });

  it('returns 0 for an empty log', () => {
    expect(countForks([])).toBe(0);
  });
});

// --- classifyChange -----------------------------------------------------

describe('classifyChange (priority: subgroup > exclusion > tails > spec)', () => {
  it('classifies a subgroup-only change', () => {
    expect(classifyChange(spec(), spec({ subgroup: 'urban' }))).toBe('subgroup');
  });

  it('classifies an exclusion-only change', () => {
    expect(classifyChange(spec(), spec({ exclusion: 'z2' }))).toBe('exclusion');
  });

  it('classifies a tails-only change', () => {
    expect(classifyChange(spec(), spec({ tails: 'one' }))).toBe('tails');
  });

  it('classifies outcome/covariates/transform-only changes as "spec"', () => {
    expect(classifyChange(spec(), spec({ outcome: 2 }))).toBe('spec');
    expect(classifyChange(spec(), spec({ covariates: { income: true, risk: false } }))).toBe('spec');
    expect(classifyChange(spec(), spec({ transform: 'log1p' }))).toBe('spec');
  });

  it('prioritizes subgroup over exclusion, tails, and spec when several knobs change at once', () => {
    const next = spec({ subgroup: 'urban', exclusion: 'z2', tails: 'one', outcome: 3 });
    expect(classifyChange(spec(), next)).toBe('subgroup');
  });

  it('prioritizes exclusion over tails and spec (subgroup unchanged)', () => {
    const next = spec({ exclusion: 'z2', tails: 'one', outcome: 3 });
    expect(classifyChange(spec(), next)).toBe('exclusion');
  });

  it('prioritizes tails over spec (subgroup, exclusion unchanged)', () => {
    const next = spec({ tails: 'one', outcome: 3 });
    expect(classifyChange(spec(), next)).toBe('tails');
  });
});

// --- distinctExplored -----------------------------------------------------

describe('distinctExplored', () => {
  it('returns distinct specs in order of first view', () => {
    const s0 = spec();
    const s1 = spec({ outcome: 1 });
    const log = [view(s0, false), view(s1, true), view(s0, true), view(s1, false)];
    expect(distinctExplored(log)).toEqual([s0, s1]);
  });

  it('dedupes structurally-equal specs even if not the same object reference', () => {
    const log = [view(spec(), false), view(spec(), true), view({ ...spec() }, true)];
    expect(distinctExplored(log)).toEqual([spec()]);
  });

  it('ignores non-VIEW_SPEC entries', () => {
    const s0 = spec();
    const log: PlayerAction[] = [view(s0, false), peek(), { t: 'ABANDON', at: 9 }];
    expect(distinctExplored(log)).toEqual([s0]);
  });

  it('returns an empty array for a log with no VIEW_SPEC entries', () => {
    expect(distinctExplored([{ t: 'ABANDON', at: 0 }])).toEqual([]);
  });
});

// --- property: distinctExplored.length <= countForks(log) + 1 -----------

describe('property: k (distinct explored) <= forks + 1 (§2.10)', () => {
  // Tiny seeded LCG (Numerical Recipes / glibc constants) — deterministic
  // across runs, deliberately NOT Math.random (banned in src/**, and here we
  // additionally want a reproducible property-test seed).
  function makeLcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  const pool: Spec[] = [
    spec(),
    spec({ outcome: 1 }),
    spec({ subgroup: 'urban' }),
    spec({ exclusion: 'z2' }),
    spec({ tails: 'one' }),
  ];

  // Generates a log consistent with real store causality: a *revisit* of an
  // already-explored spec may freely have seen:true or seen:false (§2.10's
  // "change-before-render" case), but introducing a *genuinely new* spec is
  // modeled as only reachable once the previous one's result has rendered
  // (seen:true) — matching ordinary play where you don't dial in never-tried
  // settings while the current computation is still in flight. This is the
  // realistic constraint under which master-spec §2.10 asserts k <= forks+1.
  function genLog(rng: () => number): PlayerAction[] {
    const log: PlayerAction[] = [];
    const exploredIdx: number[] = [0];
    let at = 0;
    log.push(view(pool[0], rng() < 0.5, at++));
    const steps = 1 + Math.floor(rng() * 20);
    for (let i = 0; i < steps; i++) {
      if (rng() < 0.2) {
        log.push(peek(at++));
        continue;
      }
      const introduceNew = exploredIdx.length < pool.length && rng() < 0.5;
      if (introduceNew) {
        const idx = exploredIdx.length;
        exploredIdx.push(idx);
        log.push(view(pool[idx], true, at++));
      } else {
        const idx = exploredIdx[Math.floor(rng() * exploredIdx.length)];
        log.push(view(pool[idx], rng() < 0.5, at++));
      }
    }
    return log;
  }

  it('holds over 200 seeded-random logs', () => {
    const rng = makeLcg(0xc0ffee);
    for (let trial = 0; trial < 200; trial++) {
      const log = genLog(rng);
      const k = distinctExplored(log).length;
      const forks = countForks(log);
      expect(k).toBeLessThanOrEqual(forks + 1);
    }
  });
});
