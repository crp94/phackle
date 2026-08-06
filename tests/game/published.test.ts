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
  pressForDay,
  egregiousnessTierFromSpec,
  hackingMoves,
  substituteEffect,
} from '../../src/game/published';
import { content as enContent } from '../../src/content/en';
import type { PressBlurb } from '../../src/content/types';
import { JOURNALS } from '../../src/content/journals';
import { TIER_FORKS, TIER_MOVES } from '../../src/game/tuning';
import { LAB_DEFAULT_SPEC } from '../../src/engine/day';
import type { Spec } from '../../src/engine/types';

const ISO = '2026-08-10';
const TIERS = [1, 2, 3] as const;

// gr6-091: `pressForDay` is now the shipped, audited function (see
// src/game/published.ts) rather than a hand-kept mirror of three call-site
// seeds guarded by a readFileSync scan over Published.tsx's source text. Every
// property below is asserted against the real assembler's real output.
//
// W7: the two [INTERIM] tests w6-r-003 added here — the source scan pinning
// Published.tsx's three seed spellings, and the byte-identity check behind it
// — are GONE, on the exact retirement condition their own doc comment set:
// `screens/Published.tsx` now calls `pressForDay(content.press, tier,
// scenario.id, iso)` and makes no `pickPress` call of its own, so the seeds
// live in one place and the behavioural guards below are the whole net.

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

describe('hackingMoves + egregiousnessTierFromSpec (GR6 ruling §1(h), TIER_MOVES)', () => {
  const DEFAULT: Spec = { ...LAB_DEFAULT_SPEC };

  it('counts zero moves for the lab default itself', () => {
    expect(hackingMoves(DEFAULT)).toBe(0);
  });

  /** The four confessable moves, each as a one-knob patch on the lab default.
   * `slice(0, k)` folded over the default is a spec exactly k moves away. */
  const MOVES: Partial<Spec>[] = [
    { tails: 'one' },
    { subgroup: 'urban' },
    { exclusion: 'z2' },
    { transform: 'log1p' },
  ];
  const atMoves = (moves: number): Spec => MOVES.slice(0, moves).reduce<Spec>((acc, patch) => ({ ...acc, ...patch }), DEFAULT);

  it.each([
    ['one-tailed', 0],
    ['a subgroup restriction', 1],
    ['an outlier exclusion', 2],
    ['a transform', 3],
  ])('counts %s as exactly one move', (_label, index) => {
    expect(hackingMoves({ ...DEFAULT, ...MOVES[index] })).toBe(1);
  });

  it('does NOT count the outcome or the covariates — the two moves the paper does not show', () => {
    // Outcome shopping is priced by §2.8's parsimony row instead (§1(f)), and
    // covariate adjustment is ordinary good practice: counting either here
    // would double-charge the first and award egregiousness for the second.
    expect(hackingMoves({ ...DEFAULT, outcome: 3 })).toBe(0);
    expect(hackingMoves({ ...DEFAULT, covariates: { income: true, risk: true } })).toBe(0);
  });

  it('counts all four when every confessable move is on', () => {
    expect(hackingMoves({ ...DEFAULT, tails: 'one', subgroup: 'rural', exclusion: 'z3', transform: 'log1p' })).toBe(4);
  });

  it.each([
    [0, 1],
    [1, 2],
    [2, 2],
    [3, 3],
    [4, 3],
  ])('%i moves -> tier %i', (moves, tier) => {
    const spec = atMoves(moves);
    expect(hackingMoves(spec)).toBe(moves);
    expect(egregiousnessTierFromSpec(spec)).toBe(tier);
  });

  it('is consistent with the live TIER_MOVES constants, not a copy of their values', () => {
    expect(egregiousnessTierFromSpec(atMoves(TIER_MOVES.polite))).toBe(1);
    expect(egregiousnessTierFromSpec(atMoves(TIER_MOVES.polite + 1))).toBe(2);
    expect(egregiousnessTierFromSpec(atMoves(TIER_MOVES.editorsPick - 1))).toBe(2);
    expect(egregiousnessTierFromSpec(atMoves(TIER_MOVES.editorsPick))).toBe(3);
  });

  it('reads the lab default from the engine, so moving the default moves the distance', () => {
    // Not a tautology: it fails if hackingMoves ever compares against retyped
    // literals instead of LAB_DEFAULT_SPEC's own fields.
    const asDefault: Spec = { ...LAB_DEFAULT_SPEC };
    expect(hackingMoves(asDefault)).toBe(0);
    expect(egregiousnessTierFromSpec(asDefault)).toBe(1);
  });

  it('is tier 1 for a day with no published spec (nothing was escalated)', () => {
    expect(egregiousnessTierFromSpec(null)).toBe(1);
  });

  it('THE §1(h) DEFECT, as a direct comparison: the efficient hacker no longer gets the quietest screen', () => {
    // gr2-018: a greedy hill-climber publishes in 3-4 forks, so TIER_FORKS put
    // it in tier 1 on 55 of the 58 days it published over 60 real dates. The
    // same published spec — one-tailed on a subgroup, three moves deep — is
    // tier 3 under the ruled rule.
    const greedyPublish: Spec = { ...DEFAULT, tails: 'one', subgroup: 'urban', exclusion: 'z2' };
    expect(egregiousnessTier(3)).toBe(1);
    expect(egregiousnessTierFromSpec(greedyPublish)).toBe(3);
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

describe('substituteEffect ({effect} token rule, T6 ruling + the GR6 floor decision)', () => {
  it('substitutes {effect} with the rounded absolute magnitude at or above 1', () => {
    expect(substituteEffect('Cat Owners See {effect}% Higher Returns', 24.6)).toBe('Cat Owners See 25% Higher Returns');
  });

  // --- the booked floor decision (w3-r-011 -> W11) ---------------------------
  //
  // `Math.max(1, Math.round(|beta|))` printed "1" on 71,680 of 71,680 valid
  // paths, 96.7% of them lifted there from a rounding of 0 (median |beta| 0.04
  // to 0.08). Deleting the floor would have printed "0" on those same paths;
  // the defect was the integer rounding underneath both. These four tests pin
  // the replacement rule at each scale it has to be true at.
  it('prints a sub-1 magnitude at its own scale rather than flooring it to 1', () => {
    expect(substituteEffect('{effect} Minutes Longer', 0.2)).toBe('0.2 Minutes Longer');
  });

  it('prints the MEASURED magnitude at the scale this DGP actually produces (median |beta| 0.04-0.08)', () => {
    expect(substituteEffect('{effect} Minutes Longer', 0.043)).toBe('0.043 Minutes Longer');
    expect(substituteEffect('{effect} Minutes Longer', 0.0752)).toBe('0.075 Minutes Longer');
  });

  it('prints 0 ONLY for a genuinely zero beta (the one case where "0" is the true number)', () => {
    expect(substituteEffect('{effect} Minutes Longer', 0)).toBe('0 Minutes Longer');
  });

  it('degrades a pathologically tiny beta to 0 rather than to exponential notation', () => {
    // toPrecision would give "4.0e-8", which no headline frame can carry.
    expect(substituteEffect('{effect} Minutes Longer', 4e-8)).toBe('0 Minutes Longer');
  });

  it('never emits a trailing zero or a bare decimal point', () => {
    for (const beta of [0.5, 0.05, 0.005, 0.25, 0.999, 1, 2]) {
      const out = substituteEffect('{effect}', beta);
      expect(out, `beta=${beta}`).not.toMatch(/\.$/);
      expect(out, `beta=${beta}`).not.toMatch(/\.\d*0$/);
    }
  });

  it('takes the absolute value of a negative beta (direction is not the headline\'s concern)', () => {
    expect(substituteEffect('{effect}% Faster', -12.4)).toBe('12% Faster');
    // ...at the sub-1 scale too, where the sign used to be erased by the floor
    // along with the magnitude.
    expect(substituteEffect('{effect}% Faster', -0.062)).toBe('0.062% Faster');
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

  /**
   * CROSS-WAVE NOTE (gr3-024, W4). This test used to reach for
   * 'sourdough-marathon' at tier 1 as a live example of a cell with no bound
   * blurb, on T39a's reasoning that "a tier is a VOICE, not a volume knob, and
   * not every scenario's material is funny read straight by a broadsheet".
   * §1(g) overturned that: the empty cells were measured to leave the press
   * page wholly generic on 55-58% of days, and the 60-cell matrix fills all of
   * them, so no scenario in the shipped bank is a fallback case any more.
   *
   * The BRANCH is still there and still has to work — `resolveSlot`'s
   * preference is a preference and not a filter, precisely so that a future
   * bank with a hole in it still yields a first card rather than crashing the
   * celebration screen. So the fixture is now synthetic, which is the stronger
   * form anyway: it exercises the branch on purpose instead of depending on a
   * gap in the corpus that nobody had promised to keep.
   */
  it('falls back to the scenario-agnostic tier-matched pool when no scenario-bound blurb exists at this tier', () => {
    const withHole = enContent.press.filter((p) => !(p.tier === 1 && isBoundTo(p, 'sourdough-marathon')));
    expect(withHole.length).toBeLessThan(enContent.press.length);
    const picked = pickPress(withHole, 1, 'sourdough-marathon', ISO);
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
    // loop above vacuously true, and would yield 0 here. 26 is today's count of
    // (scenario, tier) cells that HAVE a bound blurb -- 20 scenarios x 3 tiers
    // = 60 cells, of which T39a fills 26. See the task report for why not 60.
    //
    // [M2] A FLOOR, not an equality: adding coverage is the direction this
    // number is supposed to move, and a test that fails when someone writes a
    // 27th bespoke blurb would punish exactly the work it exists to encourage.
    // Vacuity is still fully guarded -- an emptied scenarioIds gives 0.
    expect(checkedCells).toBeGreaterThanOrEqual(26);
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

  /**
   * [M1] The day's three items are pairwise distinct, for EVERY scenario and
   * tier, not only the covered cells the test above walks.
   *
   * "Where pools allow" is asserted rather than assumed: the first expectation
   * proves each tier's generic pool has room for three simultaneous picks, so a
   * duplicate below is a seeding defect and never a content shortage.
   *
   * This is the test that fails against the old index math. `fnv1a32`'s low bit
   * is the input's byte parity, so which slot collided with which was decided
   * by how many characters "#2" and "#chyron" happen to have -- card 1 and the
   * chyron collided on 17.9% of tier-3 days. Mixing the hash alone does not fix
   * it either: it just redistributes the collisions (card 2 vs chyron 0.0% ->
   * 16.5%, overall 12.9% -> 17.0%). Only rotating each slot by its own index
   * makes a same-pool collision arithmetically impossible.
   */
  it('renders three pairwise-distinct items on every day, at every tier', () => {
    for (const tier of TIERS) {
      const generic = enContent.press.filter((p) => p.tier === tier && !p.scenarioIds?.length);
      expect(generic.length, `tier ${tier} generic pool must have room for 3 simultaneous picks`).toBeGreaterThanOrEqual(3);
    }
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        for (const iso of ISOS) {
          const day = pressForDay(enContent.press, tier, scenario.id, iso);
          const texts = day.map((b) => b.text);
          expect(new Set(texts).size, `${scenario.id} @ tier ${tier} on ${iso} repeated a blurb: ${texts.join(' | ')}`).toBe(
            texts.length
          );
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

  /**
   * [T39b] The re-review's reachability nit, promoted from a number quoted in
   * the T39a report ("all 45 of 45 blurbs remain reachable") to an assertion.
   *
   * The slot rotation buys distinctness at a stated cost: on a day where all
   * three slots draw from one pool they are three CONSECUTIVE entries, not
   * three independent ones. That trade is only sound if the rotation still
   * WALKS the pool over time — an index scheme that reached, say, only the even
   * entries would satisfy every distinctness test in this file while quietly
   * stranding half the bank, and the failure would be invisible on any single
   * day. The variety test above cannot see it either: `size > 1` passes on a
   * rotation that only ever reaches two of seven.
   *
   * So: every blurb in the bank, generic AND bound, must be reachable, and each
   * tier's generic pool must be reached IN FULL. 112 dates is roughly a season
   * of daily play (four months of 28, generated arithmetically so this test
   * needs no calendar), which is well inside the horizon a returning player
   * would notice a hole in.
   */
  it('walks the whole bank across a season of dates: the rotation strands no blurb', () => {
    const isos = ['01', '02', '03', '04'].flatMap((month) =>
      Array.from({ length: 28 }, (_, d) => `2026-${month}-${String(d + 1).padStart(2, '0')}`)
    );
    const seen = new Set<string>();
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        for (const iso of isos) {
          for (const blurb of pressForDay(enContent.press, tier, scenario.id, iso)) seen.add(blurb.text);
        }
      }
    }
    // Per tier first, so a failure names the pool that has a hole in it.
    for (const tier of TIERS) {
      const generic = enContent.press.filter((p) => p.tier === tier && !p.scenarioIds?.length);
      const unreached = generic.filter((p) => !seen.has(p.text)).map((p) => p.text);
      expect(unreached, `tier ${tier} generic blurbs never picked in ${isos.length} days`).toEqual([]);
    }
    const stranded = enContent.press.filter((p) => !seen.has(p.text)).map((p) => p.text);
    expect(stranded, 'blurbs no (scenario, tier, date) combination can reach').toEqual([]);
    expect(seen.size).toBe(enContent.press.length);
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
   * gr6-091 — what the retired source-scan was really protecting.
   *
   * That test read `src/ui/screens/Published.tsx` with a regex and asserted
   * the three `pickPress(...)` call sites still spelled their seeds a
   * particular way. It was the one test in this suite that broke on an
   * innocent rename, and it pinned a SPELLING rather than a behaviour. The
   * seeds now live in exactly one audited place, so the behaviour can be
   * asserted directly: this is the day's press, and these are its rules.
   */
  it('assembles the day the screen renders: an unsalted first pick, then salted follow-ups, chyron at tier 3 only', () => {
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        for (const iso of ISOS) {
          const day = pressForDay(enContent.press, tier, scenario.id, iso);
          expect(day).toHaveLength(tier === 3 ? 3 : 2);
          // Slot 0 IS the unsalted pick — the one T39a's guarantee hangs off.
          expect(day[0]).toEqual(pickPress(enContent.press, tier, scenario.id, iso));
          // Slots 1..2 ARE the registered follow-up salts.
          expect(day[1]).toEqual(pickPress(enContent.press, tier, scenario.id, `${iso}${PRESS_SALT_MARKER}2`));
          if (tier === 3) {
            expect(day[2]).toEqual(pickPress(enContent.press, 3, scenario.id, `${iso}${PRESS_SALT_MARKER}chyron`));
          }
        }
      }
    }
  });

  /**
   * gr6-064 — two clippings from the same masthead, back to back, on the
   * day's payoff screen. The previous distinctness guarantee was by TEXT, so
   * two different headlines under one outlet satisfied it; on puzzle #11
   * "NIGHTLY CHYRON NETWORK" headed both cards, against R5.2's own stated
   * reason for staggering their entrance ("coverage arrives outlet by outlet,
   * which is what coverage does").
   *
   * Asserted over every (scenario, tier, date) cell, with the pool's own
   * capacity asserted first so a failure can only ever be a picker defect.
   */
  it('never runs two items from the same outlet on the same screen', () => {
    for (const tier of TIERS) {
      const outlets = new Set(
        enContent.press.filter((p) => p.tier === tier && !p.scenarioIds?.length).map((p) => p.outlet)
      );
      expect(outlets.size, `tier ${tier} generic pool must carry 3 distinct outlets`).toBeGreaterThanOrEqual(3);
    }
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        for (const iso of ISOS) {
          const day = pressForDay(enContent.press, tier, scenario.id, iso);
          const outlets = day.map((b) => b.outlet);
          expect(
            new Set(outlets).size,
            `${scenario.id} @ tier ${tier} on ${iso} doubled an outlet: ${outlets.join(' | ')}`
          ).toBe(outlets.length);
        }
      }
    }
  });

  it('holds the outlet rule across a season of dates, not only the sampled five', () => {
    const isos = ['01', '02', '03', '04'].flatMap((month) =>
      Array.from({ length: 28 }, (_, d) => `2026-${month}-${String(d + 1).padStart(2, '0')}`)
    );
    let collisions = 0;
    for (const scenario of enContent.scenarios) {
      for (const tier of TIERS) {
        for (const iso of isos) {
          const outlets = pressForDay(enContent.press, tier, scenario.id, iso).map((b) => b.outlet);
          if (new Set(outlets).size !== outlets.length) collisions += 1;
        }
      }
    }
    expect(collisions).toBe(0);
  });

  /**
   * gr6-064's second half — the weekly pair recurrence. The day's hash was
   * `fnv1a32(day + tier)`, so the generic slots depended on the DATE alone and
   * every scenario at a given tier ran the identical generic pair whenever two
   * dates collided on the residue (GR2 caught 2026-08-12 and 2026-08-15).
   * Salting the agnostic draw with the scenario id decorrelates the twenty
   * scenarios from each other.
   */
  /**
   * CROSS-WAVE NOTE (gr3-024, W4) and w4-r-001, which is the reason this test
   * is written against a SYNTHETIC bank rather than the shipped one.
   *
   * The test used to select "scenarios with no bound blurb at tier 2", because
   * a cell with no bespoke entry renders a wholly generic day and is where the
   * repetition was most visible. The 60-cell matrix filled every such cell, so
   * that selector matches nothing and the fixture's own `> 1` premise guard
   * fired. W4's first repair pointed the same `> 1` assertion at the live
   * bank's follow-up tail — and that repair was WRONG in a way that took a
   * mutation to see: deleting the salt from `resolveSlot` left the whole suite
   * green.
   *
   * WHY THE LIVE BANK CANNOT TEST THIS ANY MORE. Post-matrix, card 1 is bespoke
   * and therefore already differs per scenario. `resolveSlot`'s reject-and-
   * advance then walks the follow-ups past card 1's outlet, so the tail shifts
   * from scenario to scenario even with NO salt at all. The matrix masks the
   * salt's absence, and `signatures.size > 1` is far too loose to notice: the
   * bespoke card alone supplies the variation the assertion was reading as
   * proof of the salt.
   *
   * WHAT ISOLATES THE SALT. Strip every bound row out of the bank. Then, for
   * each tier, all three slots draw from one shared agnostic pool, `safePool`
   * and `offset` are identical for all twenty scenarios, and the ONLY route by
   * which the scenario id can reach the index is `resolveSlot`'s agnostic hash
   * — the salt itself. Without it every scenario collapses to exactly ONE
   * signature; with it they spread. That makes `> 1` structurally exact here
   * rather than merely true, and it is a property of the picker rather than a
   * threshold tied to today's pool sizes.
   */
  it('does not run the same generic pair for two different scenarios on the same date and tier', () => {
    // The synthetic bank: agnostic rows only, so a bespoke first card cannot
    // supply the variation the salt is supposed to supply.
    const agnosticOnly = enContent.press.filter((p) => !p.scenarioIds?.length);
    expect(agnosticOnly.length).toBeLessThan(enContent.press.length);
    expect(enContent.scenarios.length).toBeGreaterThan(1);

    for (const tier of TIERS) {
      const signatures = new Set(
        enContent.scenarios.map((sc) =>
          pressForDay(agnosticOnly, tier, sc.id, ISO)
            .map((b) => b.text)
            .join('|')
        )
      );
      // Unsalted, this is exactly 1 for every tier — the whole bank draws off
      // the date alone, which is the defect gr6-064 was raised for.
      expect(signatures.size, `tier ${tier} generic draws on ${ISO} are not decorrelated by scenario`).toBeGreaterThan(1);
    }
  });

  // The live-bank, player-facing half of the same concern (w4-r-010) lives in
  // tests/content/shape.test.ts beside the 3,000-date simulation, because what
  // it measures is the BANK's richness rather than the picker's arithmetic.
  // Card 1 is deliberately deterministic per (scenario, tier) — that is T39a's
  // covered-by-name guarantee — so "the whole page differs across dates" is not
  // a property this design has, and asserting it here would be a false law.
});
