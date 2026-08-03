import { describe, expect, it } from 'vitest';
import { pickGrantwellEmail } from '../../src/game/briefing';
import { content as enContent } from '../../src/content/en';

describe('pickGrantwellEmail (controller pin: fnv1a32("grantwell:"+iso) % bank.length)', () => {
  const bank = enContent.grantwell;

  it('always returns a member of the bank', () => {
    for (const iso of ['2026-01-01', '2026-08-10', '2027-12-25']) {
      expect(bank).toContain(pickGrantwellEmail(bank, iso));
    }
  });

  it('is deterministic for the same iso', () => {
    expect(pickGrantwellEmail(bank, '2026-08-10')).toBe(pickGrantwellEmail(bank, '2026-08-10'));
  });

  it('rotates across dates (spread over 30 days lands on more than one bank entry)', () => {
    const isos = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const picks = new Set(isos.map((iso) => pickGrantwellEmail(bank, iso)));
    expect(picks.size).toBeGreaterThan(1);
  });
});
