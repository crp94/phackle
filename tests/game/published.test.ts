import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PRESS_SALT_MARKER,
  altmetricPercentile,
  altmetricScore,
  confettiParticlesForTier,
  egregiousnessTier,
  fakeDoi,
  pickJournal,
  pickPress,
  substituteEffect,
} from '../../src/game/published';
import { content as enContent } from '../../src/content/en';
import type { PressBlurb } from '../../src/content/types';
import { JOURNALS } from '../../src/content/journals';
import { TIER_FORKS } from '../../src/game/tuning';

const ISO = '2026-08-10';
const TIERS = [1, 2, 3] as const;

/**
 * The day's press exactly as src/ui/screens/Published.tsx assembles it: two
 * cards at the day's tier, plus a tier-3-only chyron, with the second and third
 * picks salting `iso` rather than passing an "exclude" list. That file is owned
 * by another task and is NOT edited here, so this helper is a MIRROR of it —
 * and the source-scan test at the bottom of this describe block is what keeps
 * the mirror honest: it reads Published.tsx and fails if the three call sites
 * ever stop using these exact seeds.
 */
function pressForDay(press: PressBlurb[], tier: 1 | 2 | 3, scenarioId: string, iso: string): PressBlurb[] {
  const card1 = pickPress(press, tier, scenarioId, iso);
  const card2 = pickPress(press, tier, scenarioId, `${iso}#2`);
  const chyron = tier === 3 ? pickPress(press, 3, scenarioId, `${iso}#chyron`) : null;
  return chyron ? [card1, card2, chyron] : [card1, card2];
}

const isBoundTo = (blurb: PressBlurb, scenarioId: string) => blurb.scenarioIds?.includes(scenarioId) ?? false;
const boundAt = (scenarioId: string, tier: 1 | 2 | 3) =>
  enContent.press.filter((p) => p.tier === tier && isBoundTo(p, scenarioId));

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

describe('altmetricScore (review fix: the §2.5 attention-score figure, static/tier-scaled, fnv1a32(iso)-seeded)', () => {
  it('is deterministic for the same (iso, tier)', () => {
    expect(altmetricScore(ISO, 1)).toBe(altmetricScore(ISO, 1));
    expect(altmetricScore(ISO, 3)).toBe(altmetricScore(ISO, 3));
  });

  it('scales strictly monotonically with tier, for every iso (bigger tier -> more absurd score)', () => {
    const isos = ['2026-01-01', '2026-08-10', '2026-08-11', '2027-03-03', '2027-12-25'];
    for (const iso of isos) {
      const s1 = altmetricScore(iso, 1);
      const s2 = altmetricScore(iso, 2);
      const s3 = altmetricScore(iso, 3);
      expect(s1).toBeLessThan(s2);
      expect(s2).toBeLessThan(s3);
    }
  });

  it('varies across dates for the same tier (not a constant)', () => {
    const isos = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const scores = new Set(isos.map((iso) => altmetricScore(iso, 2)));
    expect(scores.size).toBeGreaterThan(1);
  });

  it('is always a positive whole number', () => {
    for (const tier of [1, 2, 3] as const) {
      const score = altmetricScore(ISO, tier);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThan(0);
    }
  });
});

describe('altmetricPercentile (the joke escalates: a SMALLER top-N% reads as MORE impressive)', () => {
  it('is deterministic for the same (iso, tier)', () => {
    expect(altmetricPercentile(ISO, 1)).toBe(altmetricPercentile(ISO, 1));
  });

  it('scales strictly monotonically DOWN with tier, for every iso (tier 3 always reads more exclusive than tier 1)', () => {
    const isos = ['2026-01-01', '2026-08-10', '2026-08-11', '2027-03-03', '2027-12-25'];
    for (const iso of isos) {
      const p1 = altmetricPercentile(iso, 1);
      const p2 = altmetricPercentile(iso, 2);
      const p3 = altmetricPercentile(iso, 3);
      expect(p1).toBeGreaterThan(p2);
      expect(p2).toBeGreaterThan(p3);
    }
  });

  it('reaches the controller-suggested "Top 1%" territory at tier 3', () => {
    for (const iso of ['2026-01-01', '2026-08-10', '2027-12-25']) {
      expect(altmetricPercentile(iso, 3)).toBeLessThanOrEqual(5);
      expect(altmetricPercentile(iso, 3)).toBeGreaterThanOrEqual(1);
    }
  });

  it('is always a whole number between 1 and 100', () => {
    for (const tier of [1, 2, 3] as const) {
      const pct = altmetricPercentile(ISO, tier);
      expect(Number.isInteger(pct)).toBe(true);
      expect(pct).toBeGreaterThanOrEqual(1);
      expect(pct).toBeLessThanOrEqual(100);
    }
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
    // T39a gave 'sourdough-marathon' a bound blurb at tier 2 (the flour co-op
    // line) and deliberately none at tier 1: a tier is a VOICE, not a volume
    // knob, and not every scenario's material is funny read straight by a
    // broadsheet. Tier 1 is therefore still a genuine fallback case here.
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

describe('T39a — the day-is-covered-by-name guarantee (owner directive from play-testing)', () => {
  const ISOS = ['2026-01-01', '2026-08-10', '2026-11-30', '2027-03-03', '2027-12-25'];

  it('gives every scenario at least one blurb that names it, at some tier', () => {
    for (const scenario of enContent.scenarios) {
      const bound = enContent.press.filter((p) => isBoundTo(p, scenario.id));
      expect(bound.length, `scenario "${scenario.id}" has no bound blurb`).toBeGreaterThan(0);
    }
  });

  it("includes a scenario-bound blurb in the day's press whenever the bank holds one at the day's tier", () => {
    let checkedCells = 0;
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        if (boundAt(scenario.id, tier).length === 0) continue;
        checkedCells += 1;
        for (const iso of ISOS) {
          const day = pressForDay(enContent.press, tier, scenario.id, iso);
          expect(
            day.some((b) => isBoundTo(b, scenario.id)),
            `${scenario.id} @ tier ${tier} on ${iso} ran generic coverage despite a bound blurb existing`
          ).toBe(true);
        }
      }
    }
    // Guards the guard: a bug that emptied every `scenarioIds` would make the
    // loop above vacuously true. 26 is today's count of (scenario, tier) cells
    // that HAVE a bound blurb -- 20 scenarios x 3 tiers = 60 cells, of which
    // T39a fills 26. See the task report for why that is not 60.
    expect(checkedCells).toBe(26);
  });

  it("does not repeat that blurb across the day's other cards: follow-ups take the generic pool", () => {
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        if (boundAt(scenario.id, tier).length === 0) continue;
        for (const iso of ISOS) {
          const [card1, ...followUps] = pressForDay(enContent.press, tier, scenario.id, iso);
          expect(isBoundTo(card1, scenario.id)).toBe(true);
          for (const blurb of followUps) {
            expect(
              blurb.scenarioIds ?? [],
              `${scenario.id} @ tier ${tier} on ${iso} repeated a bound blurb in a follow-up slot`
            ).toHaveLength(0);
            expect(blurb.text).not.toBe(card1.text);
          }
        }
      }
    }
  });

  it('is the SALT, not the call order, that distinguishes a follow-up (no fourth parameter was added)', () => {
    // The mechanism in one assertion: identical arguments except for the salt
    // marker, opposite pools. cat-crypto at tier 1 is the clearest case -- one
    // bound blurb, five generic ones.
    const first = pickPress(enContent.press, 1, 'cat-crypto', ISO);
    const followUp = pickPress(enContent.press, 1, 'cat-crypto', `${ISO}${PRESS_SALT_MARKER}2`);
    expect(first.scenarioIds).toContain('cat-crypto');
    expect(followUp.scenarioIds ?? []).toHaveLength(0);
  });

  it('never hands a follow-up a blurb bound to a DIFFERENT scenario, even when its own pool is empty', () => {
    // The inverted preference must not become a hole in the scenarioIds law.
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        for (const iso of ISOS) {
          for (const blurb of pressForDay(enContent.press, tier, scenario.id, iso)) {
            for (const id of blurb.scenarioIds ?? []) {
              expect(id, `${scenario.id} @ tier ${tier} on ${iso} leaked "${id}"`).toBe(scenario.id);
            }
          }
        }
      }
    }
  });

  it('keeps every pick at the requested tier, bound or generic', () => {
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        for (const iso of ISOS) {
          const [card1, card2, chyron] = pressForDay(enContent.press, tier, scenario.id, iso);
          expect(card1.tier).toBe(tier);
          expect(card2.tier).toBe(tier);
          if (chyron) expect(chyron.tier).toBe(3);
        }
      }
    }
  });

  it("is deterministic: the same day yields the same three items, in the same order", () => {
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        const a = pressForDay(enContent.press, tier, scenario.id, ISO).map((b) => b.text);
        const b = pressForDay(enContent.press, tier, scenario.id, ISO).map((x) => x.text);
        expect(a).toEqual(b);
      }
    }
  });

  it('still varies the generic slots across dates, so repeat plays are not identical', () => {
    const isos = Array.from({ length: 40 }, (_, i) => `2026-09-${String((i % 30) + 1).padStart(2, '0')}`);
    const secondCards = new Set(isos.map((iso) => pickPress(enContent.press, 2, 'jazz-spreadsheets', `${iso}#2`).text));
    expect(secondCards.size).toBeGreaterThan(1);
  });

  it('falls back to the bound pool for a follow-up if a tier ever loses its generic blurbs', () => {
    // The preference is a preference on BOTH sides. A synthetic bank with no
    // generic tier-1 entry must still answer a salted call rather than crash.
    const boundOnly: PressBlurb[] = [
      { text: 'A', outlet: 'Morning Chirp', tier: 1, scenarioIds: ['cat-crypto'] },
      { text: 'B', outlet: 'Morning Chirp', tier: 1, scenarioIds: ['cat-crypto'] },
    ];
    const picked = pickPress(boundOnly, 1, 'cat-crypto', `${ISO}#2`);
    expect(['A', 'B']).toContain(picked.text);
  });

  /**
   * The guarantee lives in pickPress, but it is only a guarantee about the
   * SCREEN if the screen still seeds its three calls the way pressForDay above
   * assumes. Published.tsx belongs to another task and is not edited here, so
   * this reads its source instead -- the same regex-over-source-text idiom
   * tests/content/copyFreeze.test.ts and tests/ui/tokens.test.ts already use.
   */
  it('matches the three call sites src/ui/screens/Published.tsx actually uses', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../src/ui/screens/Published.tsx', import.meta.url)),
      'utf8'
    );
    const calls = source.match(/pickPress\([^)]*\)/g) ?? [];
    expect(calls).toHaveLength(3);
    // The first pick is UNSALTED -- that is what makes it the day's guaranteed
    // scenario-bound card. The other two carry PRESS_SALT_MARKER.
    expect(calls[0]).toContain(', iso)');
    expect(calls[0]).not.toContain(PRESS_SALT_MARKER);
    expect(calls[1]).toContain(`\${iso}${PRESS_SALT_MARKER}2`);
    expect(calls[2]).toContain(`\${iso}${PRESS_SALT_MARKER}chyron`);
  });
});
