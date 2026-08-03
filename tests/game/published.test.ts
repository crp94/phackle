import { describe, expect, it } from 'vitest';
import {
  confettiParticlesForTier,
  egregiousnessTier,
  fakeDoi,
  pickJournal,
  pickPress,
  substituteEffect,
} from '../../src/game/published';
import { content as enContent } from '../../src/content/en';
import { JOURNALS } from '../../src/content/journals';
import { TIER_FORKS } from '../../src/game/tuning';

const ISO = '2026-08-10';

describe('egregiousnessTier (tuning.TIER_FORKS: polite=3, editorsPick=10)', () => {
  it.each([
    [0, 1],
    [1, 1],
    [3, 1], // boundary: polite (<=3) -> tier 1
    [4, 2], // just past polite -> tier 2
    [9, 2], // boundary: just under editorsPick -> tier 2
    [10, 3], // boundary: editorsPick (>=10) -> tier 3
    [11, 3],
    [200, 3],
  ])('forks=%i -> tier %i', (forks, tier) => {
    expect(egregiousnessTier(forks)).toBe(tier);
  });

  it('is consistent with the live tuning constants, not a copy of their values', () => {
    expect(egregiousnessTier(TIER_FORKS.polite)).toBe(1);
    expect(egregiousnessTier(TIER_FORKS.polite + 1)).toBe(2);
    expect(egregiousnessTier(TIER_FORKS.editorsPick - 1)).toBe(2);
    expect(egregiousnessTier(TIER_FORKS.editorsPick)).toBe(3);
  });
});

describe('fakeDoi', () => {
  it('formats as 10.1337/phk.{puzzleNumber}', () => {
    expect(fakeDoi(1)).toBe('10.1337/phk.1');
    expect(fakeDoi(42)).toBe('10.1337/phk.42');
    expect(fakeDoi(1337)).toBe('10.1337/phk.1337');
  });
});

describe('confettiParticlesForTier (R5.4: 150/250/400 by tier)', () => {
  it.each([
    [1, 150],
    [2, 250],
    [3, 400],
  ])('tier %i -> %i particles', (tier, particles) => {
    expect(confettiParticlesForTier(tier as 1 | 2 | 3)).toBe(particles);
  });

  it('never exceeds R5.4s hard cap of 400', () => {
    expect(confettiParticlesForTier(3)).toBeLessThanOrEqual(400);
  });
});

describe('substituteEffect ({effect} token rule, T6 ruling)', () => {
  it('substitutes {effect} with the rounded absolute magnitude, floored at 1', () => {
    expect(substituteEffect('Cat Owners See {effect}% Higher Returns', 24.6)).toBe('Cat Owners See 25% Higher Returns');
  });

  it('floors at 1 rather than ever printing 0 (small beta)', () => {
    expect(substituteEffect('{effect} Minutes Longer', 0.2)).toBe('1 Minutes Longer');
  });

  it('floors at 1 for an exact-zero beta (defensive: should not occur on a published, significant result)', () => {
    expect(substituteEffect('{effect} Minutes Longer', 0)).toBe('1 Minutes Longer');
  });

  it('takes the absolute value of a negative beta (direction is not the headline\'s concern)', () => {
    expect(substituteEffect('{effect}% Faster', -12.4)).toBe('12% Faster');
  });

  it('rounds to the nearest whole number', () => {
    expect(substituteEffect('{effect} Points', 2.5)).toBe('3 Points'); // round-half-up (Math.round)
    expect(substituteEffect('{effect} Points', 2.49)).toBe('2 Points');
  });

  it('renders a tokenless headline unchanged', () => {
    const headline = 'Standing Desks Linked to a Renaissance in Middle-Management Verse';
    expect(substituteEffect(headline, 5)).toBe(headline);
  });

  it('replaces at most the one legal occurrence (content guarantees at most one token)', () => {
    expect(substituteEffect('{effect}% Higher Returns, Study Finds', 3)).toBe('3% Higher Returns, Study Finds');
  });
});

describe('pickJournal (tag-filtered pool, fnv1a32(iso) pick)', () => {
  it('always returns a journal whose tags intersect the requested tags', () => {
    for (const scenario of enContent.scenarios) {
      const { name } = pickJournal(scenario.journalTags, ISO);
      const journal = JOURNALS.find((j) => j.name === name);
      expect(journal, `pickJournal returned an unknown journal name "${name}"`).toBeDefined();
      expect(journal?.tags.some((t) => scenario.journalTags.includes(t))).toBe(true);
    }
  });

  it('is deterministic for the same (tags, iso)', () => {
    const a = pickJournal(['pets', 'finance'], ISO);
    const b = pickJournal(['pets', 'finance'], ISO);
    expect(a).toEqual(b);
  });

  it('can differ across dates for the same tags (over a spread of isos)', () => {
    const isos = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const names = new Set(isos.map((iso) => pickJournal(['pets', 'finance'], iso).name));
    expect(names.size).toBeGreaterThan(1);
  });

  it('falls back to the full pool rather than crashing when no journal carries the tag', () => {
    const { name } = pickJournal(['not-a-real-tag'], ISO);
    expect(JOURNALS.some((j) => j.name === name)).toBe(true);
  });
});

describe('pickPress (T6 review adoption: prefer scenario-bound, tier-matched; else scenario-agnostic pool; fnv1a32(iso + tier))', () => {
  it('prefers a blurb bound to today\'s scenario id when one exists at this tier', () => {
    // content/en/index.ts: the ONE tier-1 blurb bound to 'cat-crypto' is
    // Morning Chirp's — it is the pool's only match, so every iso must land
    // on it (this also incidentally proves determinism for a singleton pool).
    for (const iso of ['2026-01-01', '2026-08-10', '2027-12-25']) {
      const picked = pickPress(enContent.press, 1, 'cat-crypto', iso);
      expect(picked.outlet).toBe('Morning Chirp');
      expect(picked.scenarioIds).toContain('cat-crypto');
    }
  });

  it('falls back to the scenario-agnostic tier-matched pool when no scenario-bound blurb exists at this tier', () => {
    // 'sourdough-marathon' has no scenario-bound press blurb at any tier.
    const picked = pickPress(enContent.press, 1, 'sourdough-marathon', ISO);
    expect(picked.tier).toBe(1);
    expect(picked.scenarioIds ?? []).toHaveLength(0);
  });

  it('never lets an blurb bound to a DIFFERENT scenario leak through the fallback (the exact bug scenarioIds guards against)', () => {
    // fern-negotiation's tier-3 blurbs must never appear for a different tier-3 scenario.
    const picked = pickPress(enContent.press, 3, 'sourdough-marathon', ISO);
    expect(picked.scenarioIds ?? []).not.toContain('fern-negotiation');
  });

  it('only ever returns a blurb of the requested tier', () => {
    for (const tier of [1, 2, 3] as const) {
      for (const iso of ['2026-01-01', '2026-06-15', '2027-03-03']) {
        expect(pickPress(enContent.press, tier, 'sourdough-marathon', iso).tier).toBe(tier);
      }
    }
  });

  it('is deterministic for the same (press, tier, scenarioId, iso)', () => {
    const a = pickPress(enContent.press, 2, 'jazz-spreadsheets', ISO);
    const b = pickPress(enContent.press, 2, 'jazz-spreadsheets', ISO);
    expect(a).toEqual(b);
  });

  it('can differ across a salted iso (used for a 2nd card / chyron pick without a new parameter)', () => {
    const picks = new Set(
      Array.from({ length: 20 }, (_, i) => pickPress(enContent.press, 2, 'sourdough-marathon', `${ISO}#${i}`).text)
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
