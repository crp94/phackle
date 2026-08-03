import { describe, expect, it } from 'vitest';
import { daySeed, dayTypeFor, effectParamsFor, scenarioIndexFor } from '../../src/engine/seeds';
import { EPOCH, EFFECT_D_RANGE, P_EFFECT_PCT } from '../../src/game/tuning';

/** Consecutive local ISO dates, starting at `startIso`. Test-only helper — `new
 * Date` is fine here, this file is not under src/engine/**. */
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

describe('daySeed', () => {
  it('is deterministic for the same (iso, attempt)', () => {
    expect(daySeed('2026-09-01', 0)).toBe(daySeed('2026-09-01', 0));
  });

  it('differs across attempts (rejection-sampling counter)', () => {
    expect(daySeed('2026-09-01', 0)).not.toBe(daySeed('2026-09-01', 1));
  });

  it('differs across dates', () => {
    expect(daySeed('2026-09-01', 0)).not.toBe(daySeed('2026-09-02', 0));
  });
});

describe('scenarioIndexFor', () => {
  it('never repeats a scenario index within any 14-day sliding window (60 dates, count=20)', () => {
    const count = 20;
    const dates = consecutiveIsoDates(EPOCH, 60);
    const indices = dates.map((iso) => scenarioIndexFor(iso, count));

    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(count);
    }

    for (let start = 0; start + 14 <= indices.length; start++) {
      const window = indices.slice(start, start + 14);
      expect(new Set(window).size).toBe(window.length);
    }
  });

  it('is deterministic and stateless (repeated calls agree)', () => {
    const iso = consecutiveIsoDates(EPOCH, 30)[29];
    expect(scenarioIndexFor(iso, 20)).toBe(scenarioIndexFor(iso, 20));
  });
});

describe('dayTypeFor', () => {
  it('lands "effect" on ~P_EFFECT_PCT% of days, within 3 points, over 2000 dates', () => {
    const dates = consecutiveIsoDates('2020-01-01', 2000);
    const effectCount = dates.filter((iso) => dayTypeFor(iso) === 'effect').length;
    const pct = (effectCount / dates.length) * 100;

    expect(pct).toBeGreaterThanOrEqual(P_EFFECT_PCT - 3);
    expect(pct).toBeLessThanOrEqual(P_EFFECT_PCT + 3);
  });

  it('is deterministic', () => {
    expect(dayTypeFor('2026-09-01')).toBe(dayTypeFor('2026-09-01'));
  });
});

describe('effectParamsFor', () => {
  const NON_ALL_SUBGROUPS = ['age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'];

  it('draws d from within EFFECT_D_RANGE', () => {
    for (const iso of consecutiveIsoDates('2026-01-01', 200)) {
      const { d } = effectParamsFor(iso);
      expect(d).toBeGreaterThanOrEqual(EFFECT_D_RANGE[0]);
      expect(d).toBeLessThan(EFFECT_D_RANGE[1]);
    }
  });

  it('returns a valid outcome index and a non-"all" heteroSubgroup', () => {
    for (const iso of consecutiveIsoDates('2026-01-01', 50)) {
      const params = effectParamsFor(iso);
      expect([0, 1, 2, 3]).toContain(params.outcome);
      expect(typeof params.hetero).toBe('boolean');
      expect(NON_ALL_SUBGROUPS).toContain(params.heteroSubgroup);
    }
  });

  it('is deterministic for the same iso', () => {
    expect(effectParamsFor('2026-09-01')).toEqual(effectParamsFor('2026-09-01'));
  });
});
