import { describe, expect, it } from 'vitest';
import { fnv1a32, gaussPair, mulberry32, splitmix32 } from '../../src/engine/prng';

describe('fnv1a32', () => {
  it('hashes the empty string to the FNV-1a 32-bit offset basis', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
  });

  it('is deterministic: the same string always hashes the same', () => {
    const s = 'phackle:2026-09-01:0';
    expect(fnv1a32(s)).toBe(fnv1a32(s));
  });

  it('produces a different hash for a different attempt counter', () => {
    const attempt0 = fnv1a32('phackle:2026-09-01:0');
    const attempt1 = fnv1a32('phackle:2026-09-01:1');
    expect(attempt0).not.toBe(attempt1);
  });

  it('always returns an unsigned 32-bit integer', () => {
    for (const s of ['', 'a', 'phackle:2026-09-01:0', 'a much longer string of input']) {
      const h = fnv1a32(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe('splitmix32', () => {
  // Golden values computed once from the Appendix A algorithm itself (see
  // scratchpad/compute-golden.mjs during T1 development) and inlined here as a
  // regression fixture — a future accidental change to the recipe will fail this.
  const GOLDEN_SEED_1 = [0.36787554295733571, 0.08161311969161034, 0.82053577830083668];

  it('produces outputs strictly within [0, 1)', () => {
    const gen = splitmix32(1);
    for (let i = 0; i < 100; i++) {
      const x = gen();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('matches the hard-coded golden sequence for seed 1', () => {
    const gen = splitmix32(1);
    const got = [gen(), gen(), gen()];
    for (let i = 0; i < GOLDEN_SEED_1.length; i++) {
      expect(got[i]).toBeCloseTo(GOLDEN_SEED_1[i], 12);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = splitmix32(42);
    const b = splitmix32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('mulberry32', () => {
  it('reproduces the identical sequence for the same seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = mulberry32(7)();
    const b = mulberry32(8)();
    expect(a).not.toBe(b);
  });

  it('produces outputs strictly within [0, 1)', () => {
    const gen = mulberry32(123456789);
    for (let i = 0; i < 500; i++) {
      const x = gen();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('gaussPair', () => {
  it('draws with mean ~0 and variance ~1 over 10k values (within 0.05)', () => {
    const rng = mulberry32(2026);
    const values: number[] = [];
    while (values.length < 10_000) {
      const [z0, z1] = gaussPair(rng);
      values.push(z0, z1);
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

    expect(Math.abs(mean - 0)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });

  it('is deterministic for a given rng stream', () => {
    const a = gaussPair(mulberry32(99));
    const b = gaussPair(mulberry32(99));
    expect(a).toEqual(b);
  });
});
