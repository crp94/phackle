// Master spec Appendix A — Numerical recipes (implement exactly).
//
// The engine must be fully deterministic: no Math.random, no wall clock,
// only +,-,*,/,sqrt,exp,log on f64 plus Math.imul (see docs/implementation_plan.md
// §3.1). splitmix32 and fnv1a32 below are transcribed verbatim from Appendix A;
// mulberry32 and gaussPair are the two derived primitives the brief asks T1 to
// add on top, built only from that same allowed op set.

/** splitmix32 — Appendix A, verbatim. A fast, well-mixed 32-bit generator used
 * both directly and to seed mulberry32. */
export function splitmix32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    // Appendix A, verbatim: the reassignment's value is consumed immediately by
    // the enclosing `>>> 0` — the linter can't see through the assign-as-expression idiom.
    // eslint-disable-next-line no-useless-assignment -- see comment above
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

/** fnv1a32 — Appendix A, verbatim. The hash behind every seed derivation in
 * src/engine/seeds.ts. */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Standard mulberry32, seeded via a splitmix32 stream: the raw `seed` is first
 * run through one splitmix32 step to produce mulberry32's actual internal
 * state. This scrambles weakly-mixed or sequential seeds (mulberry32's own
 * state update is simple and can correlate across adjacent integer seeds)
 * before the fast per-call mixing takes over.
 */
export function mulberry32(seed: number): () => number {
  let a = Math.floor(splitmix32(seed)() * 4294967296) | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A pair of independent standard-normal draws, via the Marsaglia polar
 * variant of Box–Muller (rejection sampling inside the unit disc). We use the
 * polar form specifically because it needs only +,-,*,/,sqrt,log — no sin/cos
 * — keeping gaussPair inside the engine's cross-engine-deterministic op set
 * (§3.1 explicitly allows sqrt/exp/log but not trig).
 */
export function gaussPair(rng: () => number): [number, number] {
  for (;;) {
    const u = rng() * 2 - 1;
    const v = rng() * 2 - 1;
    const s = u * u + v * v;
    if (s > 0 && s < 1) {
      const factor = Math.sqrt((-2 * Math.log(s)) / s);
      return [u * factor, v * factor];
    }
  }
}
