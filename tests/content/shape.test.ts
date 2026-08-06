// The ENGLISH content shape suite. The validators themselves live in
// `./validators.ts` (a plain module, no `describe`/`it`) so that
// `it.shape.test.ts` and `es.shape.test.ts` can import them without importing
// — and therefore re-registering — this file's own tests. See gr6-106.
import { describe, expect, it } from 'vitest';
import { content as enContent } from '../../src/content/en';
// w1b-003: the terminology-lock block at the bottom of this file was
// EN-ONLY, which is the root cause of the whole w1b class — IT's and ES's
// locks existed as source comments certifying constraints their own strings
// did not satisfy, and nothing compiled the difference. Both locales are now
// under the same assertions, so this class of drift is caught rather than
// re-found. The per-locale suites keep everything that needs a lexicon; what
// belongs here is what is CROSS-LOCALE by nature: a term that must be
// identical to its own About page, and a notation that must be identical to
// English.
import { content as itContent } from '../../src/content/it';
import { content as esContent } from '../../src/content/es';
import { copy as enCopy } from '../../src/content/en/copy';
import { NULL_SIG_BAND } from '../../src/game/tuning';
import { allSpecs } from '../../src/engine/specGrid';
// `pressForDay` joins `substituteEffect` here for the 60-cell matrix block
// below (gr3-024). Importing the picker into a CONTENT suite is deliberate: the
// question that block asks is not "does the picker work" (tests/game owns that)
// but "is the BANK rich enough for the picker to keep its promises" — whether
// the day's first card can name the study, and whether two cards can always be
// found under two different mastheads. Neither is answerable from the data
// alone, and both are properties of the content rather than of the function.
import { pressForDay, substituteEffect } from '../../src/game/published';
import { JOURNALS } from '../../src/content/journals';
import type { LocaleContent } from '../../src/content/types';
import {
  EN_LEXICONS,
  MIN_CHARS_PER_EM_DASH,
  emDashDensity,
  findEmDashProblems,
  findHarmTerms,
  findMissingSpecKnobs,
  findNegativeDirectionTerms,
  findPressHarmTerms,
  findPressJournalNames,
  findPressSpoilerTerms,
  findPressTokens,
  findPressVoiceProblems,
  findParamFieldTokens,
  findScenariosWithoutPress,
  findUncoveredPressCells,
  findWeaklyAnchoredPress,
  findTierOneSecondPerson,
  findTierOneShapeOutliers,
  findTierTwoWithoutSecondPerson,
  boundRowsAtTier,
  pressAnchorStems,
  pressCellCoverage,
  PRESS_ANCHOR_MIN_SHARED,
  corpusProse,
  localeProse,
  upperCaseRatio,
  validateLocaleContent,
  type ContentLexicons,
} from './validators';

describe('validateLocaleContent', () => {
  it('reports no problems for the English content', () => {
    expect(validateLocaleContent(enContent, EN_LEXICONS)).toEqual([]);
  });

  it('passes when referenceIds matches the content ids and order', () => {
    const ids = enContent.scenarios.map((s) => s.id);
    expect(validateLocaleContent(enContent, EN_LEXICONS, ids)).toEqual([]);
  });

  it('flags a referenceIds mismatch', () => {
    const problems = validateLocaleContent(enContent, EN_LEXICONS, ['not-a-real-id']);
    expect(problems.some((p) => p.includes('reference locale'))).toBe(true);
  });

  it('flags too few scenarios', () => {
    const broken: LocaleContent = { ...enContent, scenarios: enContent.scenarios.slice(0, 1) };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('scenarios'))).toBe(true);
  });

  it('flags too few grantwell emails', () => {
    const broken: LocaleContent = { ...enContent, grantwell: enContent.grantwell.slice(0, 1) };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('grantwell'))).toBe(true);
  });

  it('flags a duplicate scenario id', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = { ...enContent, scenarios: [first, first] };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('unique'))).toBe(true);
  });

  it('flags a journalTag that no journal carries', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], journalTags: ['not-a-real-tag'] }, ...enContent.scenarios.slice(1)],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('journalTag'))).toBe(true);
  });

  it('flags a scenario missing an outcome label', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...enContent.scenarios[0], outcomeLabels: ['a', 'b', 'c', ''] as [string, string, string, string] },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('outcomeLabels'))).toBe(true);
  });

  it('flags a question that does not end in "?"', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], question: 'This is not a question.' }, ...enContent.scenarios.slice(1)],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('question'))).toBe(true);
  });

  it('flags a count outcome whose unit is not a rate', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...first, outcomeUnits: [first.outcomeUnits[0], first.outcomeUnits[1], 'widgets', first.outcomeUnits[3]] },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('outcomeUnits[2]'))).toBe(true);
  });

  it('flags a bounded outcome that is not the 1-10 scale', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...first, outcomeUnits: [first.outcomeUnits[0], first.outcomeUnits[1], first.outcomeUnits[2], '0-100 index'] },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('outcomeUnits[3]'))).toBe(true);
  });

  it('flags a headline that uses the sample-size token {n}', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...enContent.scenarios[0], headline: 'Cat Owners See {n}% Higher Returns' },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('only use {effect}'))).toBe(true);
  });

  it('flags a headline with more than one token', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...enContent.scenarios[0], headline: '{effect}% Higher Returns Over {effect} Weeks' },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('at most one'))).toBe(true);
  });

  it('flags a press blurb bound to a scenario that does not exist', () => {
    const broken: LocaleContent = {
      ...enContent,
      press: [{ ...enContent.press[0], scenarioIds: ['scenario-that-was-cut'] }, ...enContent.press.slice(1)],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('unknown scenario id'))).toBe(true);
  });

  // The two guards below are the reason lexicons are a required argument: a
  // locale suite that only calls the validator must still get them.
  it('surfaces harm-lexicon hits through the validator, not only the helper', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...enContent.scenarios[0], coverStory: 'Participants reported their supplement use.' },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('banned term'))).toBe(true);
  });

  it('surfaces direction-lexicon hits through the validator, not only the helper', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        {
          ...first,
          outcomeLabels: ['Reduction in weekly spend', ...first.outcomeLabels.slice(1)] as [
            string,
            string,
            string,
            string,
          ],
        },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('reads as a decrease'))).toBe(true);
  });
});

describe('em-dash budget (owner directive: "too many em dashes, reads too AI")', () => {
  it('keeps every English value at one em dash or fewer', () => {
    expect(findEmDashProblems(enContent).filter((p) => p.includes('em dashes'))).toEqual([]);
  });

  it('keeps the whole English corpus above the corpus-wide characters-per-dash floor', () => {
    const { charsPerDash } = emDashDensity(enContent);
    expect(charsPerDash).toBeGreaterThanOrEqual(MIN_CHARS_PER_EM_DASH);
  });

  // The floor's own regression guard: the pre-T32 corpus (the one the owner
  // called "too AI") measured 1 per 635.6 characters, so any floor at or below
  // that would have passed it. See MIN_CHARS_PER_EM_DASH's comment.
  it('sets the floor high enough to have failed the corpus that prompted the directive', () => {
    expect(MIN_CHARS_PER_EM_DASH).toBeGreaterThan(636);
  });

  it('catches a string that pairs em dashes around an aside', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...first, coverStory: 'We ran the study — carefully, and at length — and then wrote it up.' },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(findEmDashProblems(broken).some((p) => p.includes('uses 2 em dashes'))).toBe(true);
  });

  it('catches a corpus that respects the per-string cap but dashes once on every line', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: enContent.scenarios.map((s) => ({ ...s, coverStory: `${s.coverStory} And so on.` })),
      grantwell: enContent.grantwell.map((g) => `${g.replace('.', ' —')} as discussed.`),
      retractionSublines: enContent.retractionSublines.map((r) => `${r.replace('.', ' —')} as expected.`),
      press: enContent.press.map((p) => ({ ...p, text: `${p.text.replace('.', ' —')} reportedly.` })),
      copy: Object.fromEntries(
        Object.entries(enContent.copy).map(([k, v]) => [k, `${v.replace('.', ' —')} noted.`])
      ) as typeof enContent.copy,
    };
    const perString = findEmDashProblems(broken).filter((p) => p.includes('em dashes'));
    expect(perString).toEqual([]);
    expect(findEmDashProblems(broken).some((p) => p.includes('density'))).toBe(true);
  });

  it('counts the em dash only, never the en dash in "1–10 scale" nor a hyphen', () => {
    expect(enContent.scenarios.flatMap((s) => s.outcomeUnits).filter((u) => u.includes('–')).length).toBeGreaterThan(0);
    const before = emDashDensity(enContent).dashes;
    const salted: LocaleContent = {
      ...enContent,
      grantwell: enContent.grantwell.map((g) => `${g} On a 1–10 scale, over 2013–2026, non-trivially.`),
    };
    expect(emDashDensity(salted).dashes).toBe(before);
  });

  it('surfaces the budget through the validator, so IT/ES inherit it', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...first, coverStory: 'One aside — and then — another aside.' },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('em dashes'))).toBe(true);
  });
});

describe('harm check', () => {
  it('finds no banned medical terms anywhere in the English scenarios', () => {
    expect(findHarmTerms(enContent)).toEqual([]);
  });

  it('catches a banned term, including as a derivative', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...first, coverStory: 'Participants reported their dietary habits.' }, ...enContent.scenarios.slice(1)],
    };
    expect(findHarmTerms(broken).some((p) => p.includes('diet'))).toBe(true);
  });
});

describe('T39a — game-dependent press (owner directive: "at least some of the news are related to the research question")', () => {
  it('names every scenario in at least one blurb, so no day is covered generically only', () => {
    expect(findScenariosWithoutPress(enContent)).toEqual([]);
  });

  it('surfaces an uncovered scenario through the validator, so IT/ES inherit the law', () => {
    const broken: LocaleContent = { ...enContent, press: enContent.press.map((p) => ({ ...p, scenarioIds: undefined })) };
    expect(findScenariosWithoutPress(broken)).toHaveLength(enContent.scenarios.length);
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('no scenario-bound press blurb'))).toBe(true);
  });

  it('never asserts a verdict: the spoiler law holds across the whole bank, bespoke or not', () => {
    expect(findPressSpoilerTerms(enContent)).toEqual([]);
  });

  it('catches a blurb that hands the player the answer (guards the guard)', () => {
    const broken: LocaleContent = {
      ...enContent,
      press: [{ ...enContent.press[0], text: 'The result replicated in three independent labs.' }, ...enContent.press.slice(1)],
    };
    expect(findPressSpoilerTerms(broken).some((p) => p.includes('replicat'))).toBe(true);
  });

  it('keeps the harm lexicon out of the press bank, not only out of the scenarios', () => {
    expect(findPressHarmTerms(enContent)).toEqual([]);
  });

  it('catches a health claim smuggled into a blurb (guards the guard)', () => {
    const broken: LocaleContent = {
      ...enContent,
      press: [{ ...enContent.press[0], text: 'Doctors call it the cure nobody expected.' }, ...enContent.press.slice(1)],
    };
    expect(findPressHarmTerms(broken).some((p) => p.includes('cure'))).toBe(true);
  });

  it('does not fire the harm lexicon on an outlet masthead (why the scan is text-only)', () => {
    // 'The Sunday Supplement' ships in the bank today and would trip
    // `\bsupplement` on every run if outlets were scanned.
    expect(enContent.press.some((p) => /\bsupplement/i.test(p.outlet))).toBe(true);
    expect(findPressHarmTerms(enContent)).toEqual([]);
  });

  it('keeps tier 3 in the chyron voice (all caps) and tiers 1-2 out of it', () => {
    expect(findPressVoiceProblems(enContent)).toEqual([]);
    // WHY THE LAW IS A RATIO and not `text === text.toUpperCase()`: a chyron can
    // legitimately carry a lowercase glyph inside a proper noun. The bank used
    // to demonstrate this itself ('...JUDGING YOUR 401(k)'), but gr6-069 retired
    // that line — a US retirement account was shouting over a euro-denominated
    // scenario — so the demonstration moves to a fixture. It is the same string
    // the bank shipped, which is what keeps this an argument about real content
    // rather than an invented edge case.
    // gr3-024 de-indexed this: the fixture wants A TIER-3 BLURB as its base,
    // and pinning `press[29]` spelled that as an integer which the matrix wave
    // then moved twice. The lookup says what the fixture actually needs.
    const aChyron = enContent.press.find((p) => p.tier === 3)!;
    const properNounChyron = { ...aChyron, text: 'BREAKING: YOUR HOUSEPLANTS ARE JUDGING YOUR 401(k)' };
    expect(properNounChyron.text).not.toBe(properNounChyron.text.toUpperCase());
    expect(upperCaseRatio(properNounChyron.text)).toBeGreaterThan(0.9);
    expect(findPressVoiceProblems({ ...enContent, press: [properNounChyron] })).toEqual([]);
    // The other half of the reason is live in IT/ES and needs no fixture:
    // accented capitals (È, PIÙ, SÍ, Ó) sit outside the ASCII class the ratio
    // counts, and both locales ship them on tier-3 lines.
    expect(itContent.press.some((p) => p.tier === 3 && /[ÈÙÌÀÒ]/.test(p.text))).toBe(true);
    expect(esContent.press.some((p) => p.tier === 3 && /[ÁÉÍÓÚÑ]/.test(p.text))).toBe(true);
  });

  it('catches a tier-3 blurb that forgot to shout, and a tier-1 blurb that did (guards the guard)', () => {
    // Both fixtures pick their victim by TIER rather than by index, for the
    // reason above: a quiet blurb at tier 3 and a shouting one at tier 1 are
    // what these two assertions are about, and neither cares which row it is.
    const firstTier3 = enContent.press.findIndex((p) => p.tier === 3);
    const firstTier1 = enContent.press.findIndex((p) => p.tier === 1);
    const quietChyron: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p, i) => (i === firstTier3 ? { ...p, text: 'Study: ferns may be leverage.' } : p)),
    };
    expect(findPressVoiceProblems(quietChyron).some((p) => p.includes('not in the chyron'))).toBe(true);
    const shoutingBroadsheet: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p, i) => (i === firstTier1 ? { ...p, text: 'THE EFFECT IS MODEST, SAY THE AUTHORS' } : p)),
    };
    expect(findPressVoiceProblems(shoutingBroadsheet).some((p) => p.includes('shouts like a chyron'))).toBe(true);
  });

  it('leaves every tier enough scenario-agnostic blurbs for repeat-play variety', () => {
    for (const tier of [1, 2, 3] as const) {
      const agnostic = enContent.press.filter((p) => p.tier === tier && !p.scenarioIds?.length);
      expect(agnostic.length, `tier ${tier} generic pool`).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps journals out of the press: a blurb names an outlet, never a masthead', () => {
    expect(findPressJournalNames(enContent)).toEqual([]);
    const broken: LocaleContent = {
      ...enContent,
      press: [{ ...enContent.press[0], text: `As reported in ${JOURNALS[0].name}.` }, ...enContent.press.slice(1)],
    };
    expect(findPressJournalNames(broken)).toHaveLength(1);
  });

  it('carries no interpolation token: press text is rendered raw, unlike a headline', () => {
    expect(findPressTokens(enContent)).toEqual([]);
    const broken: LocaleContent = {
      ...enContent,
      press: [{ ...enContent.press[0], text: 'Cat owners see {effect}% more.' }, ...enContent.press.slice(1)],
    };
    expect(findPressTokens(broken).some((p) => p.includes('{effect}'))).toBe(true);
  });

  /**
   * FIX ROUND 1 [I1], and the whole point of that finding. All five press
   * guards must reach `validateLocaleContent`, because that is the ONLY entry
   * point the Italian and Spanish suites call. Asserting each helper
   * separately (as this block did before) left the locales checked for none of
   * it, and the gap was invisible because their T39a entries are still English
   * placeholders that pass the English lexicons by accident.
   *
   * One broken fixture per guard, each asserted through the validator rather
   * than through its own helper: if a future edit unhooks any of the five, this
   * fails even though the helper's own test would still be green.
   */
  it('routes all five press guards through validateLocaleContent, not just through their helpers', () => {
    const cases: { guard: string; text: string; tier?: 1 | 2 | 3; needle: string }[] = [
      { guard: 'harm', text: 'The cure was described as promising.', needle: 'banned term' },
      { guard: 'spoiler', text: 'It replicated, and the authors are pleased.', needle: 'asserts a verdict' },
      { guard: 'voice', text: 'A QUIET LITTLE FINDING FOR THE WEEKEND READER', needle: 'shouts like a chyron' },
      { guard: 'journal', text: `Published in ${JOURNALS[0].name} this week.`, needle: 'names the journal' },
      { guard: 'token', text: 'A gain of {effect} points was reported.', needle: 'interpolation token' },
    ];
    for (const { guard, text, needle } of cases) {
      const broken: LocaleContent = {
        ...enContent,
        press: [{ ...enContent.press[1], text }, ...enContent.press.slice(1)],
      };
      const problems = validateLocaleContent(broken, EN_LEXICONS);
      expect(problems.some((p) => p.includes(needle)), `${guard} guard is not wired into the validator`).toBe(true);
    }
  });

  it('requires every locale to declare its own press-spoiler lexicon', () => {
    // ContentLexicons.pressSpoilerTerms is a required field, so a locale that
    // omits it is a compile error rather than a silently skipped guard. This
    // asserts the runtime half: an EMPTY lexicon catches nothing, which is the
    // shape a lazy T39b hand-off would take.
    const empty: ContentLexicons = { ...EN_LEXICONS, pressSpoilerTerms: [] };
    const broken: LocaleContent = {
      ...enContent,
      press: [{ ...enContent.press[1], text: 'It replicated everywhere.' }, ...enContent.press.slice(1)],
    };
    expect(validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes('asserts a verdict'))).toBe(true);
    expect(validateLocaleContent(broken, empty).some((p) => p.includes('asserts a verdict'))).toBe(false);
  });
});

/**
 * gr3-024 / gr2-014 — THE 60-CELL PRESS MATRIX.
 *
 * WHAT THE OLD LAW MISSED. T39a's `findScenariosWithoutPress` asks whether a
 * scenario is named by SOME blurb at SOME tier, and the bank has satisfied it
 * since T39a shipped. `resolveSlot` does not select at that granularity: it
 * filters by TIER first and only then looks for a scenario binding, so the unit
 * that decides whether the day's first card can name the study is the
 * (scenario, tier) CELL. 26 of 60 were filled, which is why two review lanes
 * independently measured a press page that was entirely generic on 55-58% of
 * days, and why three of six live days driven through the real UI rendered no
 * scenario-bound press at all.
 *
 * A RATCHET WHILE THE WAVE WAS IN FLIGHT, A LAW NOW THAT IT HAS LANDED. The
 * matrix was authored tier by tier (tier 2, then tier 3, then tier 1), and a
 * hard 60 would have been red for two of the three commits while telling nobody
 * anything they did not already know, so MIN_COVERED_CELLS rose once per tier:
 * 37, then 48, now 60. At 60 it stops being a ratchet — the final commit wires
 * `findUncoveredPressCells` into `validateLocaleContent`, where all three
 * locales inherit it as a hard law and an emptied cell is a validator problem
 * rather than a number that drifted.
 *
 * The ratchet stays alongside the law on purpose. It is the assertion that
 * prints WHICH cells are missing when the corpus is mid-edit, and it is the one
 * a future scenario addition (a 21st scenario is three new cells) will fail
 * first, with the list in the message.
 */
describe('GR6 W4 gr3-024 — the (scenario, tier) press matrix', () => {
  const MIN_COVERED_CELLS = 60;

  const LOCALES = [
    { name: 'en', content: enContent },
    { name: 'it', content: itContent },
    { name: 'es', content: esContent },
  ] as const;

  it.each(LOCALES)('$name: covers at least the cells this wave has reached', ({ content }) => {
    const { covered, total } = pressCellCoverage(content);
    expect(total).toBe(60);
    expect(covered, `uncovered cells:\n  ${findUncoveredPressCells(content).join('\n  ')}`).toBeGreaterThanOrEqual(
      MIN_COVERED_CELLS
    );
  });

  /**
   * The structural reason the three locales cannot drift apart on this law, and
   * therefore the reason it is measured once rather than argued three times:
   * press tiers and scenarioIds are pinned index-by-index across locales by the
   * IT/ES suites. Filling a cell in English fills it everywhere by construction.
   * Asserted here rather than assumed, because "by construction" is a claim.
   */
  it('fills the same cells in every locale, because tiers and bindings are index-pinned', () => {
    const cells = (c: LocaleContent) => findUncoveredPressCells(c).join('|');
    expect(cells(itContent)).toBe(cells(enContent));
    expect(cells(esContent)).toBe(cells(enContent));
  });

  it('catches an emptied cell, and does not fire on a filled one (guards the guard)', () => {
    // Strip the tier-2 binding off cat-crypto, which is bound at all three
    // tiers: every OTHER law stays green (the scenario is still named at tiers
    // 1 and 3, so T39a's check passes and reports nothing), which is precisely
    // the blind spot this law exists to cover. Choosing a multi-tier scenario
    // is what makes the two assertions disagree — on a single-tier scenario
    // both would fire and the fixture would prove nothing about granularity.
    const emptied: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p) =>
        p.tier === 2 && p.scenarioIds?.includes('cat-crypto') ? { ...p, scenarioIds: ['sourdough-marathon'] } : p
      ),
    };
    expect(findUncoveredPressCells(emptied)).toContain('cat-crypto/tier2');
    expect(findScenariosWithoutPress(emptied)).toEqual([]);
    expect(findUncoveredPressCells(enContent)).not.toContain('cat-crypto/tier2');
    // ...and the law reaches the validator, which is the only entry point the
    // Italian and Spanish suites call. Without this the matrix would be an
    // English-only guarantee, which is the fix-round-1 [I1] defect exactly.
    expect(validateLocaleContent(emptied, EN_LEXICONS).some((p) => p.includes('cat-crypto/tier2'))).toBe(true);
    expect(validateLocaleContent(enContent, EN_LEXICONS)).toEqual([]);
  });

  /**
   * THE SIMULATION, and what it is for. The matrix is authored so that the
   * day's FIRST card names the study; that promise is only real if the picker
   * actually reaches a bespoke item, which depends on the bank rather than on
   * the function. 3,000 consecutive dates x 20 scenarios x 3 tiers, driven
   * through the shipped `pressForDay`, is the cheapest honest way to say so.
   *
   * Two properties, both about the CONTENT:
   *   1. Whenever the cell is filled, card 1 is bespoke. (The picker prefers
   *      the bound pool for the unsalted slot; this asserts the bank leaves it
   *      something to prefer.)
   *   2. No two cards on one screen share an outlet. gr6-064 made the picker
   *      reject-and-advance past a used masthead, but it can only do that if
   *      the pool HOLDS another masthead — a content property, and the one a
   *      careless outlet assignment on 34 new blurbs would break.
   */
  const SIM_DAYS = 3000;
  const simDates = Array.from({ length: SIM_DAYS }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
  );

  it.each(LOCALES)('$name: 3,000 dates x every cell, card 1 is bespoke and no two cards share an outlet', ({ content }) => {
    // w4-r-013: this used to SKIP any cell that had no bespoke entry, which
    // made the bespoke assertion excuse itself — on a tree where the matrix
    // regressed, the rows that regressed would be exactly the rows the loop
    // stopped checking, and the test would stay green while the guarantee
    // rotted. The matrix is complete, so state that as a precondition and then
    // check all sixty cells unconditionally.
    expect(findUncoveredPressCells(content)).toEqual([]);
    const misses: string[] = [];
    const clashes: string[] = [];
    let checked = 0;
    for (const iso of simDates) {
      for (const scenario of content.scenarios) {
        for (const tier of [1, 2, 3] as const) {
          const cards = pressForDay(content.press, tier, scenario.id, iso);
          const where = `${iso} ${scenario.id}/tier${tier}`;
          checked++;
          if (!cards[0].scenarioIds?.includes(scenario.id)) misses.push(where);
          const outlets = cards.map((c) => c.outlet);
          if (new Set(outlets).size !== outlets.length) clashes.push(`${where}: ${outlets.join(' + ')}`);
          const texts = cards.map((c) => c.text);
          if (new Set(texts).size !== texts.length) clashes.push(`${where}: repeated line`);
        }
      }
    }
    // The loop actually ran over everything it claims to: 3,000 x 20 x 3.
    expect(checked).toBe(simDates.length * content.scenarios.length * 3);
    // Sliced so a regression prints five readable rows rather than 180,000.
    expect(misses.slice(0, 5)).toEqual([]);
    expect(clashes.slice(0, 5)).toEqual([]);
  });

  /**
   * w4-r-010 — THE DISTINCTNESS CLAIM, IN THE NUMBERS A PLAYER WOULD FEEL.
   *
   * The wave's first report quoted "distinct presentations 313 -> 251" and read
   * it as a cost, which was the wrong frame twice over: that count is keyed by
   * (tier, scenario, texts) and so mixes a global figure with a per-cell one,
   * and it fell only because card 1 stopped rotating — which is the guarantee,
   * not a regression.
   *
   * What a player actually meets is a 20-day scenario cycle. The honest
   * question is how many of those twenty days show a page they have not seen
   * before, and the honest global one is how many distinct PAGES the bank can
   * produce at all. Both are asserted here so the claim in the report is the
   * claim the suite checks.
   */
  it.each(LOCALES)('$name: a lived 20-day cycle shows twenty distinct press pages', ({ content }) => {
    const pages = content.scenarios.map((scenario, day) => {
      const iso = simDates[day];
      const tier = ((day % 3) + 1) as 1 | 2 | 3;
      return pressForDay(content.press, tier, scenario.id, iso)
        .map((b) => `${b.outlet}::${b.text}`)
        .join(' | ');
    });
    expect(new Set(pages).size).toBe(content.scenarios.length);
  });

  it.each(LOCALES)('$name: the bank can produce a distinct page for every cell it owns', ({ content }) => {
    // One page per (scenario, tier) on a fixed date: 60 cells, 60 different
    // pages. Before the matrix the bespoke card was absent from 34 of them and
    // they collapsed onto the shared generic pool.
    const pages = content.scenarios.flatMap((scenario) =>
      ([1, 2, 3] as const).map((tier) =>
        pressForDay(content.press, tier, scenario.id, simDates[0])
          .map((b) => `${b.outlet}::${b.text}`)
          .join(' | ')
      )
    );
    expect(pages).toHaveLength(60);
    expect(new Set(pages).size).toBe(60);
  });

  /**
   * The generic pool is what the FOLLOW-UP cards draw from, so the matrix must
   * not be paid for by starving it. Restated at the cell level: every tier
   * keeps enough agnostic blurbs to fill the day's remaining slots under
   * distinct mastheads, which for tier 3 (three slots) means three outlets.
   */
  it.each(LOCALES)('$name: every tier keeps enough agnostic mastheads for the follow-up slots', ({ content }) => {
    for (const tier of [1, 2, 3] as const) {
      const agnostic = content.press.filter((p) => p.tier === tier && !p.scenarioIds?.length);
      const outlets = new Set(agnostic.map((p) => p.outlet));
      expect(agnostic.length, `tier ${tier} generic pool`).toBeGreaterThanOrEqual(5);
      expect(outlets.size, `tier ${tier} generic mastheads`).toBeGreaterThanOrEqual(tier === 3 ? 3 : 2);
    }
  });
});

/**
 * w4-r-002 / w4-r-003 — THE TWO PROPERTIES THE MATRIX MADE LOAD-BEARING.
 *
 * Before this wave thirteen press rows carried a `scenarioIds` binding and
 * three block comments described the tier registers. The matrix took the
 * bindings to forty-seven and left the comments compiled nowhere, which the
 * review demonstrated twice: swapping two bespoke texts left the suite green,
 * and so did rewriting a tier-1 cell as a one-sentence tabloid line.
 *
 * Both laws below are RATCHETS with per-locale ceilings rather than absolutes,
 * for one reason worth stating plainly: every violation that exists today is a
 * row that PREDATES the law. `press[0]` ("Scientists say: your cat may be your
 * best financial advisor") is T39a's opener and is a one-sentence second-person
 * tier-1 line; T39a's terms-and-conditions tier-1 row is also one sentence; its
 * browser-tabs tier-2 row never says "you". None of the 34 cells this wave
 * wrote is on any of these lists, which is what the ceilings pin. Raising one
 * requires editing a number next to a reason, exactly like the dosage ratchets.
 */
describe('GR6 W4 w4-r-002/003 — a bespoke blurb is anchored to its binding, and to its tier', () => {
  /**
   * The second person, per locale. Italian and Spanish carry it on the VERB as
   * often as on a pronoun, so the lists include the finite forms the bank
   * actually uses. Unicode-aware boundaries throughout: JS's `\b` is ASCII, so
   * `/\btú\b/` fails to match "y tú probablemente" — the boundary after "ú"
   * never exists. That bug was live in the first draft of this block and
   * reported a Spanish tier-2 row as third person.
   *
   * NOT on the Italian list, deliberately: 'sei'. It is the second person of
   * essere AND the number six, and the corpus ships "sei settimane di posta in
   * uscita" in a tier-1 blurb — which the first draft duly reported as a
   * register violation. Every Italian row that needs it is reached by 'tu'.
   */
  const REGISTER = [
    {
      name: 'en',
      content: enContent,
      secondPerson: /(^|[^\p{L}])(you|your|yours|yourself)([^\p{L}]|$)/iu,
      maxTierOneSecondPerson: 1,
      maxTierOneShapeOutliers: 2,
      maxTierTwoWithoutSecondPerson: 1,
      // press[0] is T39a's opener; its distinctive vocabulary is 'cat' and
      // 'financial advisor'. 'cat'/'gato' is three letters, below the stem
      // length, and the scenario says "personal-finance forums" rather than
      // "financial", so a semantically perfect line scores 0-1 lexically.
      anchorExempt: ['cat-crypto/tier1'],
    },
    {
      name: 'it',
      content: itContent,
      secondPerson:
        /(^|[^\p{L}])(tu|ti|te|tuo|tua|tuoi|tue|prendi|apri|scrivi|puoi|hai|possiedi|vai|entri|leggi)([^\p{L}]|$)/iu,
      maxTierOneSecondPerson: 1,
      maxTierOneShapeOutliers: 2,
      maxTierTwoWithoutSecondPerson: 0,
      anchorExempt: ['cat-crypto/tier1'],
    },
    {
      name: 'es',
      content: esContent,
      secondPerson:
        /(^|[^\p{L}])(tú|tu|tus|te|ti|tuyo|tuya|tuyos|subes|abres|tienes|eres|puedes|escribes|lees|entras|vas)([^\p{L}]|$)/iu,
      maxTierOneSecondPerson: 1,
      maxTierOneShapeOutliers: 2,
      maxTierTwoWithoutSecondPerson: 0,
      anchorExempt: ['cat-crypto/tier1'],
    },
  ] as const;

  it.each(REGISTER)('$name: every tier-1/2 bespoke blurb reuses its own scenario\'s vocabulary', ({ content, anchorExempt }) => {
    expect(findWeaklyAnchoredPress(content, anchorExempt)).toEqual([]);
  });

  it.each(REGISTER)('$name: tier 1 reports the method in the third person, in two sentences', ({ content, secondPerson, maxTierOneSecondPerson, maxTierOneShapeOutliers }) => {
    const addressed = findTierOneSecondPerson(content, secondPerson);
    const shaped = findTierOneShapeOutliers(content);
    expect(addressed.length, addressed.join('\n')).toBeLessThanOrEqual(maxTierOneSecondPerson);
    expect(shaped.length, shaped.join('\n')).toBeLessThanOrEqual(maxTierOneShapeOutliers);
  });

  it.each(REGISTER)('$name: tier 2 makes the paper about the reader', ({ content, secondPerson, maxTierTwoWithoutSecondPerson }) => {
    const silent = findTierTwoWithoutSecondPerson(content, secondPerson);
    expect(silent.length, silent.join('\n')).toBeLessThanOrEqual(maxTierTwoWithoutSecondPerson);
  });

  /**
   * The review's own probe, replayed: swap two bespoke texts and keep both
   * bindings. Every other law in this file stays green — the tiers are right,
   * the voices are right, the cells are all still covered — which is exactly
   * why this one had to exist.
   */
  it.each(REGISTER)('$name: catches a bespoke text moved onto the wrong binding (guards the guard)', ({ content, anchorExempt }) => {
    // Measured over EVERY ordered pair of tier-1 bespoke rows rather than one
    // hand-picked pair, because a single example proves only that one example.
    // A survivor is a pair whose texts happen to share three distinctive stems
    // with each other's scenarios; four of 380 do, and pinning the count keeps
    // the metric honest if a future rewrite makes the bank blurrier.
    const exempt: readonly string[] = anchorExempt;
    const rows = boundRowsAtTier(content, 1).filter((p) => !exempt.includes(`${p.scenarioIds![0]}/tier1`));
    let tried = 0;
    let survived = 0;
    for (const a of rows) {
      for (const b of rows) {
        if (a === b) continue;
        tried++;
        if (pressAnchorStems(content, { ...a, text: b.text }, a.scenarioIds![0]).length >= PRESS_ANCHOR_MIN_SHARED) {
          survived++;
        }
      }
    }
    expect(tried).toBeGreaterThan(300);
    expect(survived / tried, `${survived}/${tried} swaps went undetected`).toBeLessThanOrEqual(0.03);
  });

  it('a swap leaves every other press law green, which is why this one exists', () => {
    const a = enContent.press.findIndex((p) => p.tier === 1 && p.scenarioIds?.includes('jazz-spreadsheets'));
    const b = enContent.press.findIndex((p) => p.tier === 1 && p.scenarioIds?.includes('vinyl-dinner-party'));
    const swapped: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p, i) =>
        i === a ? { ...p, text: enContent.press[b].text } : i === b ? { ...p, text: enContent.press[a].text } : p
      ),
    };
    expect(findWeaklyAnchoredPress(swapped, ['cat-crypto/tier1']).length).toBeGreaterThan(0);
    // The matrix, the tiers, the voices and the spoiler law all still pass.
    expect(findUncoveredPressCells(swapped)).toEqual([]);
    expect(findPressVoiceProblems(swapped)).toEqual([]);
    expect(findPressSpoilerTerms(swapped)).toEqual([]);
  });

  it('catches a tier-1 cell rewritten as a tabloid line, and a mute tier-2 cell (guards the guard)', () => {
    const t1 = enContent.press.findIndex((p) => p.tier === 1 && p.scenarioIds?.includes('jazz-spreadsheets'));
    const tabloid: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p, i) => (i === t1 ? { ...p, text: 'Your spreadsheet is listening to jazz right now.' } : p)),
    };
    const re = REGISTER[0].secondPerson;
    expect(findTierOneSecondPerson(tabloid, re).length).toBe(2);
    expect(findTierOneShapeOutliers(tabloid).length).toBe(3);

    const t2 = enContent.press.findIndex((p) => p.tier === 2 && p.scenarioIds?.includes('cat-crypto'));
    const mute: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p, i) =>
        i === t2 ? { ...p, text: 'The trust that commissioned the work keeps four cats and one very strong prior.' } : p
      ),
    };
    expect(findTierTwoWithoutSecondPerson(mute, re).length).toBe(2);
  });

  /**
   * TIER 3 IS DECLINED, with the measurement that decides it (w4-r-002). A
   * chyron avoids the abstract's vocabulary on purpose, so lexical anchoring
   * reports it as unbound however it is written. These are the shipped numbers;
   * if a future rewrite lifts them, the exclusion can be revisited on evidence
   * rather than on this paragraph.
   */
  it('records why tier 3 is outside the anchor law, in numbers rather than in prose', () => {
    for (const { name, content } of REGISTER) {
      const scores = boundRowsAtTier(content, 3).flatMap((p) =>
        (p.scenarioIds ?? []).map((id) => pressAnchorStems(content, p, id).length)
      );
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const belowFloor = scores.filter((n) => n < PRESS_ANCHOR_MIN_SHARED).length;
      // The exclusion is only honest while tier 3 genuinely cannot clear the
      // floor. If a rewrite ever brings every row up, this fails and the tier
      // should join the law.
      expect(min, `${name} tier-3 anchor min`).toBeLessThan(PRESS_ANCHOR_MIN_SHARED);
      expect(belowFloor, `${name}: ${belowFloor} of ${scores.length} tier-3 rows below the floor (max ${max})`).toBeGreaterThan(
        scores.length / 2
      );
    }
  });
});

describe('one-tailed direction contract', () => {
  it('phrases every English outcome so that more of the metric = the claimed effect', () => {
    expect(findNegativeDirectionTerms(enContent)).toEqual([]);
  });

  it('catches an outcome phrased as a decrease', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        {
          ...first,
          outcomeLabels: ['Reduction in weekly spend', ...first.outcomeLabels.slice(1)] as [
            string,
            string,
            string,
            string,
          ],
        },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(findNegativeDirectionTerms(broken).some((p) => p.includes('reduction'))).toBe(true);
  });

  it('does not trip on words that merely contain a lexicon term', () => {
    const [first] = enContent.scenarios;
    const ok: LocaleContent = {
      ...enContent,
      scenarios: [
        {
          ...first,
          outcomeLabels: ['Wellness composite', 'Flawless-run streak', 'Flower-arranging sessions', 'Composure'] as [
            string,
            string,
            string,
            string,
          ],
        },
      ],
    };
    expect(findNegativeDirectionTerms(ok)).toEqual([]);
  });
});

describe('T33 — the one-row spec legend enumerates all six knobs', () => {
  it('names every knob in English, in the locale\'s own vocabulary', () => {
    expect(findMissingSpecKnobs(enContent)).toEqual([]);
  });

  it('still recognises a shortened enumeration when one is introduced (guards the guard)', () => {
    const shortened: LocaleContent = {
      ...enContent,
      copy: { ...enContent.copy, 'legend.emojiSpec': 'Any specification change (outcome or transform)' },
    };
    expect(findMissingSpecKnobs(shortened).sort()).toEqual([
      'lab.covariates',
      'lab.exclusion',
      'lab.subgroup',
      'reveal.tailsOne',
    ]);
  });
});

// --- GR6 W1: the day-typed / mode-typed accounting keys ---------------------
//
// The per-locale suites already assert that IT and ES carry exactly English's
// token set in every value (`uses exactly the same interpolation tokens as
// English in every copy value`), so parity x3 follows from pinning ENGLISH's
// own set here. That is the half nothing covered: a token dropped from the
// SOURCE would propagate to all three locales in agreement and render a
// silently wrong sentence rather than a visibly raw {token}.

describe('GR6 W1 — the reveal accounting keys carry exactly the tokens the screen binds', () => {
  // Sorted lexicographically, which is why `{sigPct}` precedes `{sig}`: 'P'
  // sorts before '}'. Written out rather than re-sorted at the assertion so
  // the expectation is a literal to read, not a computation to trust.
  const EXPECTED: Record<string, string[]> = {
    // gr6-001: the null variant keeps §2.7.3's three headline figures.
    'reveal.accounting1': ['{sigPct}', '{sig}', '{total}'],
    // gr6-001: the effect variant adds the split the engine now computes.
    'reveal.accounting1Effect': ['{otherSig}', '{sigPct}', '{sig}', '{total}', '{trueSig}'],
    'reveal.accounting2': ['{k}'],
    'reveal.accounting2Abandoned': ['{k}'],
    // gr6-003: prereg's own framing, same count token.
    'reveal.accounting2Prereg': ['{k}'],
    'reveal.accounting3': ['{k}', '{pHitPct}'],
    // gr6-002: prose only — it characterises the search, it quotes no figure.
    'reveal.accounting3Directed': [],
    'reveal.publishedRecipe': ['{recipe}'],
    'reveal.preregisteredRecipe': ['{recipe}'],
  };

  it.each(Object.entries(EXPECTED))('%s', (key, tokens) => {
    const value = enContent.copy[key as keyof typeof enContent.copy];
    expect(value, `${key} is not in the English catalog`).toBeDefined();
    expect([...new Set(value.match(/\{\w+\}/g) ?? [])].sort()).toEqual(tokens);
  });

  // Controller ruling (a), 2026-08-06: the null-day accounting names the
  // confound About discloses, and never offers chance as the sole cause.
  // w1-r-001 added the other half of the constraint: it may not claim the
  // confound explains the COUNT either. Measured by permuting treatment within
  // 188 accepted null days, the confounded excess is 4.8 of ~94 hits (paired
  // t = 1.11), because §3.3's rejection sampler discards the confounded tail.
  // So the string must name the confound as a property of the DESIGN — in
  // About's own words, which is the terminology lock — while attributing the
  // count to the threshold.
  it('names the confound as About does, and blames neither cause for the count', () => {
    const value = enContent.copy['reveal.accounting1'];
    expect(value).not.toMatch(/by chance alone/i);
    // About: "a treatment confounded with age and income".
    expect(value).toMatch(/confounded with age and income/);
    expect(enContent.copy['about.mechanism']).toMatch(/confounded with age and income/);
    expect(value).toMatch(/never randomly assigned/);
    // The retracted overclaim, in any of the shapes it could come back as.
    expect(value).not.toMatch(/the rest are confounding|mostly confounding|the rest is confounding/i);
  });

  // gr6-001: the effect variant must keep the pedagogy, not just the counts.
  it('says on an effect day that a p-value cannot tell the two families apart', () => {
    const value = enContent.copy['reveal.accounting1Effect'];
    expect(value).not.toMatch(/by chance alone/i);
    expect(value).toMatch(/p-value/);
  });

  // w1b-008: W1's review forced two WORDING fixes that nothing pins, so they
  // could be undone by a future pass with a green suite. Both are about the
  // same discipline — the game may not assert more than it knows.
  it('keeps r-003\'s single-p-value hedge, which Fig. 2\'s caption contradicts as an absolute', () => {
    // "Nothing in a p-value distinguishes the two" collided with
    // reveal.groupedCaption ("Real effects cluster. Noise scatters.") two
    // blocks below on the SAME screen, over the figure the code calls the most
    // important educational graphic in the game. It is ONE p-value, read
    // alone, that cannot tell them apart.
    expect(enContent.copy['reveal.accounting1Effect']).toMatch(/A single p-value/);
    expect(enContent.copy['reveal.accounting1Effect']).not.toMatch(/Nothing in a p-value/i);
    // The caption it must not contradict is still the one it was reconciled
    // against; if that moves, this pin should be re-read rather than deleted.
    expect(enContent.copy['reveal.groupedCaption']).toMatch(/cluster/i);
  });

  it('keeps r-004\'s conditional, because the engine never measures how the player searched', () => {
    // The first draft asserted "you did not search at random: you followed the
    // p-value" as a fact about the player, while gating only on
    // `mode === 'hack' && playerExplored > 1`. Same defect class as gr6-096.
    const value = enContent.copy['reveal.accounting3Directed'];
    expect(value).toMatch(/^If you followed the p-value,/);
    expect(value).not.toMatch(/You did not search at random/);
  });
});

// --- w1b-003 / w1b-004: the cross-locale locks, compiled for all three ------

describe('GR6 W2 — terminology and notation locks hold in every locale, not just English', () => {
  const LOCALES = [
    // The lock is per locale: each catalog's accounting line must name the
    // confound in ITS OWN About page's words, because that is the only sense
    // in which "the same term" means anything to a reader of that language.
    // `retiredTerm` and `streakTerm` are the same idea for gr6-028 and
    // gr6-031 — a rule about vocabulary, whose vocabulary is per language.
    {
      name: 'en',
      content: enContent,
      confound: 'confounded with age and income',
      retiredTerm: /\breveal(s|ed|ing)?\b/i,
      streakTerm: 'streak',
      armitageCondition: /five equal batches of data/,
      secondPerson: /\byour\b/i,
    },
    {
      name: 'it',
      content: itContent,
      confound: 'confondimento da età e reddito',
      retiredTerm: /rivelazion/i,
      streakTerm: 'Serie',
      armitageCondition: /cinque lotti uguali di dati/,
      secondPerson: /\b(tuo|tua|tuoi|tue)\b/i,
    },
    {
      name: 'es',
      content: esContent,
      confound: 'confundido con la edad y la renta',
      retiredTerm: /revelaci/i,
      streakTerm: 'Racha',
      armitageCondition: /cinco lotes iguales de datos/,
      secondPerson: /\btus?\b/i,
    },
  ] as const;

  it.each(LOCALES)('$name: reveal.accounting1 names the confound in about.mechanism\'s exact words', ({ content, confound }) => {
    expect(content.copy['about.mechanism']).toContain(confound);
    expect(content.copy['reveal.accounting1']).toContain(confound);
  });

  it.each(LOCALES)('$name: reveal.accounting1 never blames chance alone, and never blames the confound for the count', ({ content }) => {
    const value = content.copy['reveal.accounting1'];
    // The retracted overclaim in each locale's own words — the shapes it could
    // plausibly come back as, not a translation of one English phrase.
    expect(value).not.toMatch(/by chance alone|per puro caso|por puro azar/i);
    expect(value).not.toMatch(
      /the rest are confounding|le altre sono confondimento|el resto viene de la confusión/i
    );
    // It must still say the threshold does this on its own: the one claim
    // measurement supports, and the sentence About was written to agree with.
    expect(value).toMatch(/on its own|da sola|por sí solo/i);
  });

  // w1b-004 — NOTATION IS IDENTICAL, not merely similar. `legend.significant`
  // renders inside Fig. 1 one block above reveal.accounting1's own threshold,
  // so a locale drifting to `p < .05` would put both forms on one screen —
  // gr3-015's defect in its sharpest possible form, which is exactly how it
  // was found. `toBe` rather than a regex: this is a notation string, and the
  // IT/ES suites' SHARED_WITH_EN rosters already claim it is shared.
  it.each(['legend.significant', 'lab.pBelow', 'reveal.pValueTiny', 'reveal.pValue', 'lab.pEquals'] as const)(
    '%s is byte-identical in it and es (notation is not prose)',
    (key) => {
      expect(itContent.copy[key]).toBe(enCopy[key]);
      expect(esContent.copy[key]).toBe(enCopy[key]);
    }
  );

  // w2-r-005: the first version of this regex required TWO digits after the
  // point and a word boundary after them, so it caught `p < .05` and missed
  // `p = .049` — including inside about.decimalNote, the string whose whole
  // job is to promise the leading zero. Broadened to "a point that starts a
  // number and is not itself preceded by a word character or another point",
  // which is the actual rule. Measured against all three catalogs: zero false
  // positives (`0.05`, `|z| > 2.5`, `Fig. 1`, `Vol. 1, No. 11`, `et al.`, a
  // full stop followed by a space and a digit — none match).
  //
  // SCOPE IS THE COPY CATALOG here, and the CORPUS is swept by its own block at
  // the bottom of this file (W3 took the booking): the same law, over
  // src/content/*/index.ts, with one allow-listed location per locale —
  // Grantwell's "a p-value of .06 is just a p-value of .05 with poor time
  // management" — and the reasoning for keeping it written at that entry. The
  // split is not an exemption: it is two scopes because the copy catalog admits
  // no exceptions at all and the corpus admits exactly one, argued.
  it('every locale writes a decimal with its leading zero', () => {
    const LEADING_ZERO = /(?<![\d\w.])\.\d/;
    for (const { name, content } of LOCALES) {
      const offenders = Object.entries(content.copy).filter(([, v]) => LEADING_ZERO.test(v));
      expect(offenders, `${name} has a decimal without its leading zero`).toEqual([]);
    }
  });

  // --- w2-r-003: the three contract locks this wave WROTE but did not compile.
  // Each one is a rule a source comment states as binding; a rule that is only
  // stated is the exact shape of defect w1b-003 was the root cause of, and the
  // reviewer confirmed all three by reverting them against a green suite.

  it.each(LOCALES)('$name: no value calls the last screen "the reveal" (gr6-028)', ({ content, retiredTerm }) => {
    // The term is retired from PLAYER COPY only. The `reveal.` key prefix is
    // developer vocabulary in a place only developers read, so this scans
    // values and never keys.
    const offenders = Object.entries(content.copy).filter(([, v]) => retiredTerm.test(v));
    expect(offenders).toEqual([]);
  });

  // w2-r-001 — THE ARMITAGE FOOTNOTE IS ABOUT A DESIGN, NOT ABOUT THE PLAYER.
  // Owner ruling (b) inserted "equally spaced" on a premise measurement
  // falsified: N_SCHEDULE IS equally spaced (Δn = 50) and still inflates to
  // 11.2%, not 14.2%, because the condition the citation's number depends on
  // is equal FRACTIONS OF TOTAL INFORMATION. The controller re-ruling
  // therefore states the citation's own condition, impersonally.
  //
  // The second-person ban is a CORRECTNESS pin, not a style one: addressed to
  // the player, "five" is unreachable (N_SCHEDULE allows four peeks, and the
  // footnote only appears from the second), and the readership's real
  // inflation is 8.7-11.2%. Simplifying this back toward "your five peeks"
  // reintroduces exactly the false claim the re-ruling removed.
  it.each(LOCALES)('$name: the Armitage footnote names the citation\'s condition and never addresses the player (w2-r-001)', ({ content, armitageCondition, secondPerson }) => {
    const value = content.copy['lab.peekFootnoteArmitage'];
    expect(value).toMatch(armitageCondition);
    expect(value).not.toMatch(secondPerson);
    expect(value).not.toMatch(/equally spaced|equidistant|equidistanti|equidistantes/i);
    // The figure and the citation are the two things ruling (b) required to
    // survive every rewrite of this string.
    expect(value).toContain('14%');
    expect(value).toContain('(Armitage, 1969)');
    // Notation follows the same law as everything else since gr6-027.
    expect(value).toContain('α = 0.05');
  });

  it.each(LOCALES)('$name: the streak has ONE name, in all four places that name it (gr6-031)', ({ content, streakTerm }) => {
    // summary.streak / stats.currentStreak / stats.maxStreak / share.streakWord.
    // IT and ES each carried two names, one tap apart, after T37 re-authored
    // two of the four and never cross-checked them.
    const keys = ['summary.streak', 'stats.currentStreak', 'stats.maxStreak', 'share.streakWord'] as const;
    const offenders = keys.filter((k) => !content.copy[k].toLowerCase().includes(streakTerm.toLowerCase()));
    expect(offenders).toEqual([]);
  });
});

// --- gr6-004: About's rejection-sampler disclosure quotes real constants ----

describe('GR6 gr6-004 — About discloses the acceptance band, in numbers the engine actually uses', () => {
  const [LO, HI] = NULL_SIG_BAND;
  // w2-r-004 — the first version of this guard was CONTAINMENT-ONLY: it asked
  // whether the digits 30, 180 and 1792 appeared somewhere in the paragraph.
  // The reviewer broke it twice against a green suite — swapping the
  // threshold to `p < 0.01` (the numbers all still appeared) and inverting the
  // band's sense to "between 180 and 30" (ditto). A guard on a disclosure has
  // to pin the RELATION, so each locale now supplies the exact span its own
  // grammar builds, assembled from the constants rather than typed out.
  const LOCALES = [
    {
      name: 'en',
      content: enContent,
      band: new RegExp(`between ${LO} and ${HI} of the ${allSpecs().length} `),
      openingSample: /in the opening sample of 200\b/,
      effectGate: /both in that opening sample and in the full sample of 400\b/,
      drift: /checked at 200 and nowhere else/,
      redraw: /redrawn/,
    },
    {
      name: 'it',
      content: itContent,
      band: new RegExp(`fra ${LO} e ${HI} delle ${allSpecs().length} `),
      openingSample: /sul campione iniziale di 200\b/,
      effectGate: /sia su quel campione iniziale sia sul campione completo di 400\b/,
      drift: /controllata a 200 e da nessun'altra parte/,
      redraw: /riestratta/,
    },
    {
      name: 'es',
      content: esContent,
      band: new RegExp(`entre ${LO} y ${HI} de los ${allSpecs().length} `),
      openingSample: /en la muestra inicial de 200\b/,
      effectGate: /tanto en esa muestra inicial como en la muestra completa de 400\b/,
      drift: /se comprueba en 200 y en ningún otro sitio/,
      redraw: /se vuelve a sortear/,
    },
  ] as const;

  it.each(LOCALES)('$name: states the band as a span, in the right order, over the real grid size', ({ content, band }) => {
    const value = content.copy['about.mechanism'];
    // Ordered span assembled from NULL_SIG_BAND and allSpecs().length: a
    // constant that moves, or a sentence that reverses, fails here.
    expect(value).toMatch(band);
    // No thousands separator on the grid size, in any locale.
    expect(value).not.toMatch(/1[.,]792/);
  });

  it.each(LOCALES)('$name: the band is stated against the SAME threshold the Legend prints', ({ content }) => {
    // Notation is locale-invariant (SHARED_WITH_EN), so English's own
    // legend.significant is the right source for all three. This is what makes
    // "p < 0.01 in About, p < 0.05 on the figure" impossible.
    expect(content.copy['about.mechanism']).toContain(enCopy['legend.significant']);
  });

  // w2-r-002 / w2-r-008 — the band binds at n=200 and the reveal enumerates at
  // state.n, so a peeking player can be shown a count outside it (measured:
  // 8 of 21 accepted null days at n=400, one of them 37 -> 5). The sentence
  // must carry its own n, must disclose that the count moves, and must name
  // both halves of the effect-day gate rather than only the 400 one.
  it.each(LOCALES)('$name: scopes the band to the opening sample, and says the count moves', ({ content, openingSample, drift }) => {
    const value = content.copy['about.mechanism'];
    expect(value).toMatch(openingSample);
    expect(value).toMatch(drift);
  });

  it.each(LOCALES)('$name: discloses BOTH halves of the effect-day gate', ({ content, effectGate }) => {
    expect(content.copy['about.mechanism']).toMatch(effectGate);
  });

  it.each(LOCALES)('$name: names the redraw, so "everything under the hood is real" is not left doing the work alone', ({ content, redraw }) => {
    expect(content.copy['about.mechanism']).toMatch(redraw);
  });

  it('agrees with reveal.accounting1 rather than restating it: the band is around what the threshold does alone', () => {
    // The controller note on the W1 review: gr6-004 must be written
    // consistently with the merged accounting1. Both sentences now attribute
    // the count to the threshold, in each locale's own words, and About adds
    // the band around it.
    for (const { name, content } of LOCALES) {
      expect(content.copy['about.mechanism'], `${name} About`).toMatch(/on its own|da sola|por sí solo/i);
      expect(content.copy['reveal.accounting1'], `${name} accounting1`).toMatch(/on its own|da sola|por sí solo/i);
    }
  });
});

// --- GR6 W3: the content corpus ----------------------------------------------

/**
 * gr6-005 / gr3-001 — THE HEADLINE TOKEN IS RETIRED, and this is the fact that
 * keeps it retired.
 *
 * `{effect}` was substituted with the published spec's treatment effect in that
 * outcome's OWN RAW UNITS, floored at 1 (src/game/published.ts's
 * substituteEffect). Measured before the fix over 20 consecutive days from
 * EPOCH, every one of the 1,792 specs, at both the opening and the full window:
 * 71,680 of 71,680 valid paths printed 1 — 69,336 of them (96.7%) lifted there
 * by the floor from a rounding of 0, and 2,344 rounding to 1 unaided
 * (w3-r-011). Deleting the floor therefore prints "0", not a real number: the
 * floor is not the defect, the raw-unit coefficient is. The largest string on the
 * celebration screen therefore read "Meetings Run 1 Minutes Longer" on every
 * publishable path the game had, and the frame could not have been honoured in
 * any case — it is fixed per scenario while the number comes from whichever of
 * the four outcomes the player published, so a 1-10 self-rating could print as
 * "€1 More in Goodwill Credit".
 *
 * WHY A TEST AND NOT ONLY A REWRITE. Content rule 5 still LICENSES the token
 * (the type still permits it, substituteEffect still exists and is still unit-
 * tested), so nothing but this assertion stops the next author from putting one
 * back into a frame the engine cannot fill. It is a pin on a state, not a ban on
 * a feature.
 *
 * THE RETIREMENT CONDITION, stated so this test can be deleted honestly rather
 * than worked around: if the engine is ever changed to express the effect
 * unit-free — as a percentage of the control-group mean, gr3-001's recorded
 * alternative — and the plural-after-1 trap ("1 Minutes") is closed
 * independently, then this test is the thing to delete, in the same commit that
 * lands the change. Until then a headline carrying a number is a headline
 * printing the number 1.
 *
 * FOR WHOEVER TAKES THAT ON (the Math.max floor is booked to W11): do not
 * open by deleting the floor. It is load-bearing for the shape the effect
 * currently has — 96.7% of paths round to 0 — so removing it alone swaps "1"
 * for "0" and makes the headline worse. The unit-free expression has to land
 * first; the floor is then either unnecessary or a different rule entirely.
 */
describe('GR6 W3 gr6-005 — no headline carries an effect token the engine cannot honour', () => {
  const LOCALE_CONTENT = [
    { name: 'en', content: enContent },
    { name: 'it', content: itContent },
    { name: 'es', content: esContent },
  ] as const;

  it.each(LOCALE_CONTENT)('$name: every headline is token-free', ({ content }) => {
    const withTokens = content.scenarios
      .filter((s) => /\{[^}]*\}/.test(s.headline))
      .map((s) => `${s.id}: "${s.headline}"`);
    expect(withTokens).toEqual([]);
  });

  it('leaves substituteEffect a no-op on every shipped headline, in every locale', () => {
    // The end-to-end statement of the same fact, through the real production
    // function rather than through a regex: whatever beta the day produces, the
    // headline the player reads is the headline the corpus wrote.
    for (const { name, content } of LOCALE_CONTENT) {
      for (const scenario of content.scenarios) {
        for (const beta of [0, 0.049, -0.6, 24.6]) {
          expect(substituteEffect(scenario.headline, beta), `${name} ${scenario.id}`).toBe(scenario.headline);
        }
      }
    }
  });

  it('still substitutes when a token IS present, so this pins the corpus and not the engine', () => {
    // Guards the guard in the other direction: if substituteEffect were gutted,
    // the assertion above would pass vacuously.
    expect(substituteEffect('Cat Owners See {effect}% Higher Returns', 24.6)).toBe(
      'Cat Owners See 25% Higher Returns'
    );
  });
});

/**
 * gr6-070 + gr6-037 — the two banks this wave ADDED, and the invariants that
 * make them safe to wire.
 *
 * BOTH ARE NOW RENDERED (wired by W7, as handed off). The hand-off is kept
 * below in the past tense rather than deleted, because the second half of it
 * is a standing constraint on anyone who touches the wiring again — not a
 * to-do that expired when the code landed.
 *   - `Briefing.tsx` renders `pickGrantwellEmail(content.grantwellSubjects,
 *     iso)` — the SAME picker and the SAME iso as the body one line above, over
 *     banks of equal length, so one seed lands on the pair that was written
 *     together. `briefing.emailSubject` was deleted from all three catalogs in
 *     that commit. `tests/ui/briefing.test.tsx` pins the pairing across five
 *     puzzle numbers, index for index — not merely that a subject renders.
 *   - `Reveal.tsx` gives NULL_REPORTED its own bank, indexed by
 *     `puzzleNumber % length` exactly as the retraction bank is.
 *     WITH THIS CONSTRAINT STILL ATTACHED (w3-r-001), because it is the one
 *     thing about this bank that is not obvious from its name: the stamp is
 *     DAY-TYPE-BLIND. `verdictStamp` returns NULL_REPORTED on `published ===
 *     null` alone, so an abandoned EFFECT day lands there too, one block under
 *     a `reveal.truthEffect` line that has just declared the effect real. The
 *     bank is authored to be true on both day types, so it is wired with NO
 *     branch — and `tests/ui/reveal.test.tsx` asserts both day types get a
 *     line and get the SAME line. If a future change ever gives it a branch (a
 *     second, effect-day variant), that branch has to key on
 *     `payload.dayType`, NOT on the stamp, and the retraction bank's
 *     `!isPrereg` gate is not the relevant precedent: RETRACTED requires a
 *     published spec, so its claims are scoped to that spec and true of it;
 *     nothing scopes these.
 */
describe('GR6 W3 — the Grantwell subject bank and the NULL REPORTED sublines', () => {
  const LOCALE_CONTENT = [
    { name: 'en', content: enContent },
    { name: 'it', content: itContent },
    { name: 'es', content: esContent },
  ] as const;

  it.each(LOCALE_CONTENT)('$name: pairs a subject with every Grantwell body, index for index', ({ content }) => {
    // The pairing IS the fix. gr3-011's alternative was a shorter bank rotated
    // on its own seed, which breaks the constant but pairs at random — "Re: the
    // deadline" would still land over the body about a dream, just less often.
    // Equal length + one seed makes every subject the one written for its body,
    // and this assertion is the only thing keeping that true.
    expect(content.grantwellSubjects.length).toBe(content.grantwell.length);
  });

  /**
   * w3-r-009 — THE PAIRING, not just the count. The length assertion above is
   * what makes one seed land on one pair; it does not check that the pair was
   * ever WRITTEN together, and the review proved the gap by swapping the last
   * two bodies against a green suite.
   *
   * Anchored on three indices where subject and body share a concrete noun, so
   * the anchor is a fact about the writing rather than a restatement of the
   * order. Three and not twenty-two on purpose: an exhaustive keyword map would
   * be a second copy of the bank, would fail every time a line was reworded,
   * and would be deleted the first time it did. THE RESIDUAL RISK IS STATED:
   * a reorder that leaves 4, 11 and 20 alone still passes here, and the reason
   * that is acceptable is that the pairing has no other reader — nothing
   * downstream can detect it, so a silent mis-pairing costs one joke on one
   * day rather than a wrong claim on any.
   */
  it.each([
    {
      name: 'en',
      content: enContent,
      anchors: [
        { i: 4, needle: /impact statement/i },
        { i: 11, needle: /conference/i },
        { i: 20, needle: /Reviewer 2/ },
      ],
    },
    {
      name: 'it',
      content: itContent,
      anchors: [
        { i: 4, needle: /dichiarazione di impatto/i },
        { i: 11, needle: /convegno/i },
        { i: 20, needle: /Reviewer 2/ },
      ],
    },
    {
      name: 'es',
      content: esContent,
      anchors: [
        { i: 4, needle: /memoria de impacto/i },
        { i: 11, needle: /congreso/i },
        { i: 20, needle: /Reviewer 2/ },
      ],
    },
  ])('$name: three subjects still sit on the body they were written for', ({ content, anchors }) => {
    for (const { i, needle } of anchors) {
      expect(content.grantwellSubjects[i], `subject[${i}] lost its anchor`).toMatch(needle);
      expect(content.grantwell[i], `body[${i}] lost its anchor`).toMatch(needle);
    }
  });

  it('catches the reorder the review drove (guards the guard)', () => {
    // The review's own probe: swap the last two bodies. Index 20's anchor is
    // the one that has to notice.
    const swapped = [...enContent.grantwell];
    [swapped[20], swapped[21]] = [swapped[21], swapped[20]];
    expect(/Reviewer 2/.test(swapped[20])).toBe(false);
    expect(/Reviewer 2/.test(enContent.grantwell[20])).toBe(true);
  });

  it.each(LOCALE_CONTENT)('$name: leaves no subject and no null subline empty', ({ content }) => {
    for (const [i, s] of content.grantwellSubjects.entries()) {
      expect(s.trim().length, `grantwellSubjects[${i}]`).toBeGreaterThan(0);
    }
    for (const [i, s] of content.nullReportedSublines.entries()) {
      expect(s.trim().length, `nullReportedSublines[${i}]`).toBeGreaterThan(0);
    }
  });

  it.each(LOCALE_CONTENT)('$name: gives NULL REPORTED enough sublines to stop repeating within a fortnight', ({ content }) => {
    // The stamp will index by puzzleNumber, so the bank size IS the repeat
    // period. Ten is not fourteen (retractionSublines' size) on purpose: a
    // player who reports nulls honestly does not see one every day, so the
    // effective period is much longer than the count.
    expect(content.nullReportedSublines.length).toBeGreaterThanOrEqual(10);
    expect(new Set(content.nullReportedSublines).size).toBe(content.nullReportedSublines.length);
  });

  /**
   * w3-r-001 — A FLOOR UNDER THE DAY-TYPE CONSTRAINT, and it is a floor and not
   * an oracle, exactly like the praise scan below it.
   *
   * THE REAL RULE, which no regex can check: a NULL REPORTED subline may say
   * what happened to the REPORT and may not say what the DAY CONTAINED. The
   * stamp is day-type-blind (`verdictStamp`: `published === null` and nothing
   * else), ~25% of days carry a real effect, and on an abandoned effect day
   * this text renders one block under "True effect on X: β = 0.29".
   *
   * WHAT THIS CAN MECHANIZE is the two vocabularies the five bad lines reached
   * for, in each locale's own words:
   *   (a) THE TRUTH VOCABULARY. `reveal.truthEffect` and `reveal.truthNull`
   *       already own "effect", "true" and "zero" on this screen, one block up.
   *       A subline that reaches for them is competing with a sentence the
   *       player can see, and it loses.
   *   (b) THE EXISTENTIAL CLAIM. "there was nothing to find", "that is the
   *       whole story" — an unscoped assertion about what the day held. These
   *       are pinned as the shapes the review actually caught, so a revert is
   *       caught even though a NEW phrasing of the same mistake would not be.
   * A line can still get this wrong in words nobody listed. That is what the
   * paragraph above the bank in each locale is for.
   */
  const DAY_TYPE_BLIND = [
    {
      name: 'en',
      content: enContent,
      // (a) truth vocabulary, (b) the caught shapes.
      banned: [/\btrue\b/i, /\bzero\b/i, /\beffect\b/i, /\binterval\b/i, /there was nothing/i, /nothing to find/i, /the whole story/i],
    },
    {
      name: 'it',
      content: itContent,
      banned: [/\bvero\b/i, /\bzero\b/i, /\beffetto\b/i, /\bintervallo\b/i, /non c'era niente/i, /non ci sarebbe stato niente/i, /tutta qui/i],
    },
    {
      name: 'es',
      content: esContent,
      banned: [/\b(cierto|verdad)\b/i, /\bcero\b/i, /\befecto\b/i, /\bintervalo\b/i, /no había nada/i, /no habría habido nada/i, /la historia es esa/i],
    },
  ] as const;

  it.each(DAY_TYPE_BLIND)('$name: says what happened to the report, never what the day contained', ({ content, banned }) => {
    const offenders = content.nullReportedSublines.flatMap((s, i) =>
      banned.filter((re) => re.test(s)).map((re) => `nullReportedSublines[${i}] matches ${re}: "${s}"`)
    );
    expect(offenders).toEqual([]);
  });

  it('catches every line the review caught, in the locale that shipped it (guards the guard)', () => {
    // All FIVE sentences this bank shipped before w3-r-001, verbatim, in all
    // three locales. Each has to be rejected by its OWN locale's list — a list
    // that only worked in English would be the w1b-003 defect all over again,
    // and the first draft of this test caught 5/5 in English and 4/5 in the
    // other two, which is precisely the asymmetry that check exists to expose.
    const CAUGHT: Record<string, string[]> = {
      en: [
        'The finding is that there was nothing to find. It has been filed.',
        'No press release was issued. There was nothing to put in one.',
        'Nobody will cite it, and it will still be true next year.',
        'The dataset was fine. So was the analysis. That is the whole story.',
        'The confidence interval contained zero, and you said so.',
      ],
      it: [
        "Il risultato è che non c'era niente da trovare. È stato archiviato.",
        'Non è stato diramato nessun comunicato. Non ci sarebbe stato niente da metterci.',
        "Non lo citerà nessuno, e l'anno prossimo sarà ancora vero.",
        "Il dataset andava bene. Anche l'analisi. La storia è tutta qui.",
        "L'intervallo di confidenza conteneva lo zero, e tu lo hai detto.",
      ],
      es: [
        'El hallazgo es que no había nada que hallar. Ya está archivado.',
        'No se envió ninguna nota de prensa. No habría habido nada que poner en ella.',
        'No lo citará nadie, y el año que viene seguirá siendo cierto.',
        'Los datos estaban bien. El análisis también. La historia es esa.',
        'El intervalo de confianza contenía el cero, y tú lo dijiste.',
      ],
    };
    for (const { name, banned } of DAY_TYPE_BLIND) {
      for (const line of CAUGHT[name]) {
        expect(banned.some((re) => re.test(line)), `${name} list misses: "${line}"`).toBe(true);
      }
    }
  });

  it.each(LOCALE_CONTENT)('$name: keeps the NULL REPORTED bank in Act II\'s register, not in congratulation', ({ content, name }) => {
    // A mechanical floor under a judgement call, not a substitute for it: the
    // register rule says clinical and never smug, and the failure mode a
    // "positive moment for the honest player" invites is a compliment. The
    // second person is not banned (retractionSublines use it: "One of them was
    // yours"), but praise vocabulary is.
    const PRAISE = /\b(well done|congratulations|good work|proud|bravo|complimenti|bravi|enhorabuena|felicidades|buen trabajo)\b/i;
    for (const [i, s] of content.nullReportedSublines.entries()) {
      expect(PRAISE.test(s), `${name} nullReportedSublines[${i}] congratulates the player: "${s}"`).toBe(false);
    }
  });

  it('sweeps both new banks with the corpus-wide em-dash budget, rather than exempting them', () => {
    // The banks were added to validators.ts's localeProse in the same commit
    // that created them. This proves the wiring rather than trusting it: a dash
    // planted in each new bank has to be caught by the same validator that
    // guards every other value.
    for (const { name, content } of LOCALE_CONTENT) {
      expect(findEmDashProblems(content), `${name} today`).toEqual([]);
      const dashedSubjects: LocaleContent = {
        ...content,
        grantwellSubjects: content.grantwellSubjects.map((s, i) => (i === 0 ? 'a thought — or two — about it' : s)),
      };
      expect(findEmDashProblems(dashedSubjects).some((p) => p.includes('grantwellSubjects[0]'))).toBe(true);
      const dashedSublines: LocaleContent = {
        ...content,
        nullReportedSublines: content.nullReportedSublines.map((s, i) => (i === 0 ? 'Nothing — nothing at all — was found.' : s)),
      };
      expect(findEmDashProblems(dashedSublines).some((p) => p.includes('nullReportedSublines[0]'))).toBe(true);
    }
  });
});

/**
 * gr6-085 / gr1b-025 — the `{`-guard now covers the fields that feed
 * interpolation, not only the two it started with.
 */
describe('GR6 W3 gr6-085 — no interpolation token in a field rendered raw', () => {
  const LOCALE_CONTENT = [
    { name: 'en', content: enContent },
    { name: 'it', content: itContent },
    { name: 'es', content: esContent },
  ] as const;

  it.each(LOCALE_CONTENT)('$name: carries none today', ({ content }) => {
    expect(findParamFieldTokens(content)).toEqual([]);
  });

  it('catches one in every family the sweep claims to cover (guards the guard)', () => {
    // One fixture per structural family, because the sweep is a list of field
    // paths and a list is exactly the kind of thing that quietly loses a line.
    const cases: { family: string; broken: LocaleContent; needle: string }[] = [
      {
        family: 'outcomeLabels',
        broken: {
          ...enContent,
          scenarios: [
            { ...enContent.scenarios[0], outcomeLabels: ['{unit} per week', 'a', 'b', 'c'] as [string, string, string, string] },
            ...enContent.scenarios.slice(1),
          ],
        },
        needle: 'cat-crypto.outcomeLabels[0]',
      },
      {
        family: 'outcomeUnits',
        broken: {
          ...enContent,
          scenarios: [
            { ...enContent.scenarios[0], outcomeUnits: ['{unit}', 'b/c', 'x/week', '1–10 scale'] as [string, string, string, string] },
            ...enContent.scenarios.slice(1),
          ],
        },
        needle: 'cat-crypto.outcomeUnits[0]',
      },
      {
        family: 'covariateLabels',
        broken: {
          ...enContent,
          scenarios: [
            { ...enContent.scenarios[0], covariateLabels: { income: 'Income of {n}', risk: 'Risk' } },
            ...enContent.scenarios.slice(1),
          ],
        },
        needle: 'cat-crypto.covariateLabels.income',
      },
      {
        family: 'question',
        broken: {
          ...enContent,
          scenarios: [{ ...enContent.scenarios[0], question: 'Does {effect} matter?' }, ...enContent.scenarios.slice(1)],
        },
        needle: 'cat-crypto.question',
      },
      {
        family: 'coverStory',
        broken: {
          ...enContent,
          scenarios: [{ ...enContent.scenarios[0], coverStory: 'We recruited {n} people.' }, ...enContent.scenarios.slice(1)],
        },
        needle: 'cat-crypto.coverStory',
      },
      {
        family: 'achievements',
        broken: {
          ...enContent,
          achievements: { ...enContent.achievements, monk: { name: 'The {n} Monk', citation: 'For it.' } },
        },
        needle: 'achievements.monk.name',
      },
      {
        family: 'press outlet',
        broken: {
          ...enContent,
          press: [{ ...enContent.press[0], outlet: 'The {n} Chirp' }, ...enContent.press.slice(1)],
        },
        needle: 'press[0].outlet',
      },
      {
        family: 'retractionSublines',
        broken: { ...enContent, retractionSublines: ['The effect was {effect}.', ...enContent.retractionSublines.slice(1)] },
        needle: 'retractionSublines[0]',
      },
      {
        family: 'nullReportedSublines',
        broken: { ...enContent, nullReportedSublines: ['Nothing in {n} paths.', ...enContent.nullReportedSublines.slice(1)] },
        needle: 'nullReportedSublines[0]',
      },
      {
        family: 'grantwell',
        broken: { ...enContent, grantwell: ['Get me {effect} by Friday.', ...enContent.grantwell.slice(1)] },
        needle: 'grantwell[0]',
      },
      {
        family: 'grantwellSubjects',
        broken: { ...enContent, grantwellSubjects: ['re: {n}', ...enContent.grantwellSubjects.slice(1)] },
        needle: 'grantwellSubjects[0]',
      },
      {
        family: 'glossary',
        broken: {
          ...enContent,
          glossary: [{ term: 'α / false-positive rate', def: 'Capped at {n}%.' }, ...enContent.glossary.slice(1)],
        },
        needle: 'glossary[0].def',
      },
    ];
    for (const { family, broken, needle } of cases) {
      expect(findParamFieldTokens(broken).some((p) => p.includes(needle)), `${family} is not swept`).toBe(true);
      // ...and through the validator, which is the only entry point IT/ES call.
      expect(
        validateLocaleContent(broken, EN_LEXICONS).some((p) => p.includes(needle)),
        `${family} is not wired into the validator`
      ).toBe(true);
    }
  });

  it('leaves the headline alone, because the headline is the field that MAY carry a token', () => {
    // The two guards must not disagree. gr6-005 retired the token from every
    // shipped headline; the CONTRACT still permits it, and this sweep must not
    // be the thing that silently forbids it.
    const withToken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], headline: 'Cat Owners See {effect}% More' }, ...enContent.scenarios.slice(1)],
    };
    expect(findParamFieldTokens(withToken)).toEqual([]);
    // The headline's own rule still bites on the same fixture's foreign token.
    const withForeignToken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], headline: 'Cat Owners See {n}% More' }, ...enContent.scenarios.slice(1)],
    };
    expect(validateLocaleContent(withForeignToken, EN_LEXICONS).some((p) => p.includes('only use {effect}'))).toBe(true);
  });
});

/**
 * w2-r-005, ADJUDICATED (booked to W3 by the W2 fix round and confirmed by the
 * W2 re-review).
 *
 * THE FINDING. W2's leading-zero law started as a two-digit regex, so it caught
 * `p < .05` and missed `p = .049` — including inside `about.decimalNote`, the
 * string whose entire job is to promise the leading zero. Broadened to
 * `/(?<![\d\w.])\.\d/` it fires on nothing in any of the three copy catalogs,
 * and W2 scoped it to `copy` because sweeping the corpus fires on exactly one
 * string per locale, the same joke each time. That scoping was correct and
 * temporary: an unswept corpus is not a corpus that obeys the law, it is a
 * corpus nobody checked. So the law now sweeps it — 476 rows per locale — and
 * the one deviation is an entry with its reasoning, not a silence.
 *
 * THE ADJUDICATION: KEEP THE STRING. Three reasons, in the order they decided
 * it.
 *
 *  1. THE LAW IS ABOUT THE GAME'S OWN NOTATION, and this is not the game
 *     writing a number. `about.decimalNote` makes a promise to the reader about
 *     how THIS APP typesets statistics; `legend.significant`, `lab.pBelow` and
 *     `reveal.pValue` are the app keeping it. grantwell[0] is an email from a
 *     character, quoted verbatim, inside a mail client the game draws. The
 *     apostrophes, the capitals and the decimals in a quoted email are that
 *     character's, the same way the tier-3 chyrons say "ZERO VIRGOLA ZERO
 *     CINQUE" and "CERO COMA CERO CINCO" because an anchor is speaking and not
 *     typesetting.
 *  2. THE SLOPPINESS IS THE JOKE, AND THE CHARACTER. "A p-value of .06 is just
 *     a p-value of .05 with poor time management" is a principal investigator
 *     treating .06 and .05 as the same number with different luck — which is
 *     the exact error this entire game exists to dramatize, from the man whose
 *     function in it is to pressure the player into committing it. Typesetting
 *     his email to the house standard would make him a more careful
 *     statistician than the joke can afford him to be.
 *  3. THE COST OF "FIXING" IT IS MEASURED, NOT HYPOTHETICAL. GR3's quotable
 *     audit ranked this the third most screenshot-worthy string in the product
 *     (gr3-014). Rewriting the best line in the Grantwell bank to satisfy a
 *     typographic rule it is not addressed by is a bad trade at any exchange
 *     rate.
 *
 * WHY AN ALLOW-LIST AND NOT A NARROWED REGEX. A regex that spared "a p-value of
 * .06" would spare it everywhere, including in the copy catalog, where the same
 * phrasing WOULD be the app writing a number badly. The exemption belongs to a
 * location and a reason, so it is written as a location and a reason. It is
 * self-retiring in both directions: if the line is ever rewritten, assertion
 * (b) fails and the stale entry has to go; if a second string ever wants the
 * same licence, it has to be argued for here rather than absorbed.
 */
describe('GR6 W3 w2-r-005 — the leading-zero law reaches the corpus, with one entry that says why', () => {
  const LEADING_ZERO = /(?<![\d\w.])\.\d/;

  // ONE entry per locale, and it is the same string in three languages.
  const CHARACTER_VOICE_ALLOWANCE = [
    {
      name: 'en',
      content: enContent,
      where: 'grantwell[0]',
      // Quoted so a rewrite of the joke is a decision and not an accident.
      text: 'Remember: a p-value of .06 is just a p-value of .05 with poor time management.',
    },
    {
      name: 'it',
      content: itContent,
      where: 'grantwell[0]',
      text: 'Ricorda: un p-value di .06 è solo un p-value di .05 con una pessima gestione del tempo.',
    },
    {
      name: 'es',
      content: esContent,
      where: 'grantwell[0]',
      text: 'Recuerda: un p-valor de .06 es un p-valor de .05 con mala gestión del tiempo.',
    },
  ] as const;

  it.each(CHARACTER_VOICE_ALLOWANCE)(
    '$name: every corpus value writes its decimals with a leading zero, except the one allowed above',
    ({ content, where }) => {
      const offenders = corpusProse(content)
        .filter((row) => LEADING_ZERO.test(row.text))
        .map((row) => `${row.where}: "${row.text}"`);
      expect(offenders).toHaveLength(1);
      expect(offenders[0].startsWith(`${where}:`)).toBe(true);
    }
  );

  it.each(CHARACTER_VOICE_ALLOWANCE)(
    '$name: the allow-listed string is still the string the reasoning is about (a stale entry fails)',
    ({ content, text }) => {
      // (b). If Grantwell's opener is ever rewritten — with or without the
      // leading zero — this fails, and whoever rewrote it has to re-read the
      // three reasons above and either delete this entry or restate them.
      expect(content.grantwell[0]).toBe(text);
      expect(LEADING_ZERO.test(content.grantwell[0])).toBe(true);
    }
  );

  it('catches a leading-zero omission anywhere else in the corpus (guards the guard)', () => {
    // The exemption is one location, not one phrasing: the SAME sentence in a
    // different bank is still a defect.
    const inASubline: LocaleContent = {
      ...enContent,
      retractionSublines: ['The p-value was .049 the whole time.', ...enContent.retractionSublines.slice(1)],
    };
    const offenders = corpusProse(inASubline).filter((row) => LEADING_ZERO.test(row.text));
    expect(offenders.map((o) => o.where)).toEqual(['grantwell[0]', 'retractionSublines[0]']);
  });

  it('does not fire on the notation the corpus writes correctly (no false positives)', () => {
    // The forms the broadened regex was checked against when W2 widened it, now
    // asserted rather than remembered — every one of these appears in shipped
    // content or in its immediate neighbourhood.
    for (const ok of ['0.05', 'p = 0.049', '|z| > 2.5', 'Fig. 1', 'Vol. 1, No. 11', 'et al.', 'It was 0.000. 3 groups tried.', 'α = 0.05']) {
      expect(LEADING_ZERO.test(ok), `false positive on "${ok}"`).toBe(false);
    }
    for (const bad of ['p < .05', 'p = .049', 'about .5 of them']) {
      expect(LEADING_ZERO.test(bad), `missed "${bad}"`).toBe(true);
    }
  });
});

/**
 * NOTATION, CORPUS-WIDE: the apostrophe is straight, and now something checks.
 *
 * Found by measuring rather than by a finding: W3's rendered re-read of the
 * corpus turned up one U+2019 in `grantwell[15]` ("this year’s output"), sitting
 * among twenty-one sibling emails that all use the straight one ("I've cleared
 * my afternoon", "I don't want to alarm you"). It predates this wave — it is in
 * the tree at W3's base commit — and nothing compiled the rule, because W2's
 * apostrophe work was a one-time sweep of six ITALIAN escapes in the copy
 * catalog, verified by rendering and never turned into a law.
 *
 * A single curly apostrophe is not a character voice, which is why this one is
 * straightened rather than allow-listed the way grantwell[0]'s decimals are: the
 * player cannot perceive it as characterization, and a reader who noticed it at
 * all would read it as an encoding accident, because that is what it was. The
 * distinction the two blocks draw between them is the whole rule — a deviation
 * has to be legible AS a deviation to earn an entry.
 *
 * SCOPE (w3-r-003): every user-facing value in the locale, corpus AND copy
 * catalog. The first version of this block ran over `corpusProse` alone, on the
 * reasoning that the corpus was the file W3 owned — but a rule about how the
 * product TYPES cannot depend on which file a string lives in, and the review
 * proved the gap by planting a U+2019 in `en/copy.ts`'s lab.coefPlotAxis and
 * watching a green suite. All three catalogs are clean today, so widening the
 * scope lands green and costs nothing but the hole.
 *
 * Limited to the marks that have a straight equivalent. The en dash in "1–10
 * scale" is a range, the em dash has its own budget, and the ACCENTS are the
 * languages' own (È, PIÙ, Ó) and are not punctuation at all.
 */
describe('GR6 W3 — the corpus types its apostrophes and quotes straight', () => {
  const CURLY: [string, string][] = [
    ['U+2019 (right single quote)', '’'],
    ['U+2018 (left single quote)', '‘'],
    ['U+201C (left double quote)', '“'],
    ['U+201D (right double quote)', '”'],
  ];

  it.each([
    { name: 'en', content: enContent },
    { name: 'it', content: itContent },
    { name: 'es', content: esContent },
  ])('$name: uses no typographic quote mark in the corpus OR the copy catalog', ({ content }) => {
    const offenders = localeProse(content).flatMap((row) =>
      CURLY.filter(([, ch]) => row.text.includes(ch)).map(([label]) => `${row.where} contains ${label}: "${row.text}"`)
    );
    expect(offenders).toEqual([]);
  });

  it('catches each mark it claims to catch (guards the guard)', () => {
    for (const [label, ch] of CURLY) {
      const broken: LocaleContent = { ...enContent, grantwell: [`It is this year${ch}s problem.`, ...enContent.grantwell.slice(1)] };
      expect(
        localeProse(broken).some((row) => row.where === 'grantwell[0]' && row.text.includes(ch)),
        `${label} is not detectable in the corpus`
      ).toBe(true);
      // ...and on the OTHER side of the scope, which is the half w3-r-003 found
      // missing: the review's own probe, replayed.
      const brokenCopy: LocaleContent = {
        ...enContent,
        copy: { ...enContent.copy, 'lab.coefPlotAxis': `Estimated effect (${ch}unit${ch})` },
      };
      expect(
        localeProse(brokenCopy).some((row) => row.where === 'copy["lab.coefPlotAxis"]' && row.text.includes(ch)),
        `${label} is not detectable in the copy catalog`
      ).toBe(true);
    }
  });

  it('leaves the marks that are not typographic quotes alone', () => {
    // The en dash is a RANGE (every locale's "1–10 scale" / "scala 1–10"), and
    // the accented capitals are Italian and Spanish, not punctuation. A guard
    // that swept "non-ASCII" would fail the corpus on both.
    expect(enContent.scenarios[0].outcomeUnits[3]).toContain('–');
    for (const { content } of [{ content: itContent }, { content: esContent }]) {
      const offenders = localeProse(content).flatMap((row) =>
        CURLY.filter(([, ch]) => row.text.includes(ch)).map(([label]) => `${row.where}: ${label}`)
      );
      expect(offenders).toEqual([]);
    }
    expect(itContent.press.some((p) => /È|PIÙ/.test(p.text))).toBe(true);
  });
});

/**
 * w3-r-004 — THE DOSAGE RATCHETS. gr6-040, gr6-072 and gr6-073 are the three
 * rows whose whole content is a NUMBER: not "this label is wrong" but "this
 * device is used too often". The review reverted all nineteen income covariates
 * against a green suite and nothing objected, which is fair — a row whose
 * deliverable is a count and which compiles no count has shipped an opinion.
 *
 * WHY THESE THREE AND NOT gr6-038/039. Those two are semantic: whether a label
 * reads as an absolute quantity the mean-centred family renders meaninglessly
 * negative is a judgement, and the obvious mechanical proxy (require a relative
 * marker) false-positives on four labels that are legitimately signed —
 * cat-crypto's '30-day portfolio return' among them. A guard that has to
 * exempt a fifth of the set to pass is not measuring the rule. Those two rows
 * keep their reasoning in prose, deliberately, and the review accepted that.
 * These three measure something a regex can actually count.
 *
 * RATCHETS, NOT EQUALITIES. Each ceiling is the number this wave landed on, and
 * it may only ever go DOWN. Going below it is a better corpus and passes
 * silently; going above it is the seam coming back and fails. That asymmetry is
 * the point — an equality pin would fail an author who improved the corpus, and
 * would be deleted by the third person who hit it.
 *
 * PER-LOCALE PATTERNS, PER-LOCALE CEILINGS. English's slot-1 device is
 * "Longest…/Length of…"; Italian's is "più lungo"; Spanish's is "más largo".
 * They are different devices with different natural pulls, so they carry the
 * numbers each locale actually reached (7 / 5 / 4) rather than English's
 * imposed on all three.
 */
describe('GR6 W3 w3-r-004 — the dosage rows compile the numbers they are about', () => {
  const DOSAGE = [
    {
      name: 'en',
      content: enContent,
      // gr6-073: the duration-superlative device in outcomeLabels[1]. 11/20
      // before this wave.
      device: /^(Longest|Length of)\b/i,
      maxDevice: 7,
      // gr6-072: the `sense`-headed metric in outcomeLabels[3]. 4/20 before.
      senseHead: /\bsense\b/i,
    },
    { name: 'it', content: itContent, device: /\bpiù lung[ao]?\b/i, maxDevice: 5, senseHead: /\b(sensazione|senso)\b/i },
    { name: 'es', content: esContent, device: /\bmás larg[ao]s?\b/i, maxDevice: 4, senseHead: /\bsensación\b/i },
  ] as const;

  // gr6-040: 'Household income' stood on 15 of 20. The survivor is each
  // locale's 'Salary band' on its four workplace scenarios, which is left
  // alone deliberately (it is scenario-appropriate where it stands) — so the
  // ceiling is 4 and is the same in every locale.
  const MAX_INCOME_REPEAT = 4;

  it.each(DOSAGE)('$name: no income covariate label stands on more than four scenarios', ({ content }) => {
    const counts = new Map<string, number>();
    for (const s of content.scenarios) {
      const label = s.covariateLabels.income;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const overused = [...counts.entries()]
      .filter(([, n]) => n > MAX_INCOME_REPEAT)
      .map(([label, n]) => `"${label}" on ${n} scenarios`);
    expect(overused).toEqual([]);
  });

  it.each(DOSAGE)('$name: the slot-1 duration device stays at or below the count this wave reached', ({ content, device, maxDevice }) => {
    const used = content.scenarios.filter((s) => device.test(s.outcomeLabels[1])).map((s) => s.outcomeLabels[1]);
    expect(used.length, `${used.length} of 20 use the device:\n  ${used.join('\n  ')}`).toBeLessThanOrEqual(maxDevice);
  });

  /**
   * w3-r-013 — THE FIFTH REPLACEMENT, DECLINED, with the reasoning here rather
   * than in a report nobody will read again.
   *
   * gr3-030 supplied five rows for the bounded scale; one of them was
   * "full-moon: keep (the best label in the set)", so four labels moved and
   * `confidence` survives twice — mechanical-keyboard's "Self-rated confidence
   * at commit time" and telescope's "Stranger-rated confidence in the
   * directions". Not taken, for two reasons that go together:
   *
   *  1. TWO OF TWENTY IS THE FLOOR, NOT A SEAM. `warmth` also survives twice in
   *     the same slot (vinyl's "Guest-rated warmth of the evening", stairs'
   *     "Counterpart-rated warmth") and was never a finding. Fixing one pair
   *     and not the other would make the corpus less coherent, not more, and
   *     would put this test in the position of enforcing a rule the corpus
   *     visibly does not follow.
   *  2. THE SLOT'S OWN VARYING ELEMENT ALREADY SEPARATES THEM. The construction
   *     is "<rater>-rated <noun>", and these two differ in the rater —
   *     self-reported confidence and a stranger's confidence in someone else
   *     are different measurements, which is exactly what the prefix is for.
   *     `sense` ×4 was a seam because three of the four were SELF-ratings
   *     sharing a head noun (the survivor is the attendee-rated one).
   *
   * Which is why the ceiling below is 1 for `sense` and there is no ceiling for
   * `confidence`: the numbers differ because the defects do.
   */
  it.each(DOSAGE)('$name: at most one bounded-scale metric is headed by "sense"', ({ content, senseHead }) => {
    // full-moon's "sense that this could have been an email" is the one that
    // stays, and it is the best label in the set — which is the reason the
    // ceiling is one rather than zero.
    const used = content.scenarios.filter((s) => senseHead.test(s.outcomeLabels[3])).map((s) => s.outcomeLabels[3]);
    expect(used.length, `headed by "sense":\n  ${used.join('\n  ')}`).toBeLessThanOrEqual(1);
  });

  it('is a ratchet in both directions: a revert fails, an improvement passes', () => {
    // Guards the guard, and pins the ASYMMETRY that makes these ratchets rather
    // than equality pins. Uses the exact revert the review drove (all income
    // covariates back to one label) plus a single-label revert, to show the
    // ceiling bites long before the full regression.
    const countIncome = (c: LocaleContent) => {
      const m = new Map<string, number>();
      for (const s of c.scenarios) m.set(s.covariateLabels.income, (m.get(s.covariateLabels.income) ?? 0) + 1);
      return Math.max(...m.values());
    };
    const fullRevert: LocaleContent = {
      ...enContent,
      scenarios: enContent.scenarios.map((s) => ({ ...s, covariateLabels: { ...s.covariateLabels, income: 'Household income' } })),
    };
    expect(countIncome(fullRevert)).toBeGreaterThan(MAX_INCOME_REPEAT);
    // One more onto the surviving four is already too many.
    const oneMore: LocaleContent = {
      ...enContent,
      scenarios: enContent.scenarios.map((s) =>
        s.id === 'cat-crypto' ? { ...s, covariateLabels: { ...s.covariateLabels, income: 'Salary band' } } : s
      ),
    };
    expect(countIncome(oneMore)).toBe(MAX_INCOME_REPEAT + 1);
    // ...and taking one AWAY passes, which an equality pin would not.
    const improved: LocaleContent = {
      ...enContent,
      scenarios: enContent.scenarios.map((s) =>
        s.id === 'jazz-spreadsheets' ? { ...s, covariateLabels: { ...s.covariateLabels, income: 'Desk budget' } } : s
      ),
    };
    expect(countIncome(improved)).toBeLessThanOrEqual(MAX_INCOME_REPEAT);

    // Same shape for the other two ceilings.
    const deviceBack: LocaleContent = {
      ...enContent,
      scenarios: enContent.scenarios.map((s) =>
        s.id === 'label-maker-inbox'
          ? { ...s, outcomeLabels: ['a', 'Longest run of days at inbox zero', 'c', 'd'] as [string, string, string, string] }
          : s
      ),
    };
    expect(deviceBack.scenarios.filter((s) => /^(Longest|Length of)\b/i.test(s.outcomeLabels[1])).length).toBe(8);
    const senseBack: LocaleContent = {
      ...enContent,
      scenarios: enContent.scenarios.map((s) =>
        s.id === 'label-maker-inbox'
          ? { ...s, outcomeLabels: ['a', 'b', 'c', 'Self-rated sense of control'] as [string, string, string, string] }
          : s
      ),
    };
    expect(senseBack.scenarios.filter((s) => /\bsense\b/i.test(s.outcomeLabels[3])).length).toBe(2);
  });
});
