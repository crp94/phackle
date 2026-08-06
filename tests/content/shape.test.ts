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
import { substituteEffect } from '../../src/game/published';
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
    const properNounChyron = { ...enContent.press[29], text: 'BREAKING: YOUR HOUSEPLANTS ARE JUDGING YOUR 401(k)' };
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
    const quietChyron: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p, i) => (i === 29 ? { ...p, text: 'Study: ferns may be leverage.' } : p)),
    };
    expect(findPressVoiceProblems(quietChyron).some((p) => p.includes('not in the chyron'))).toBe(true);
    const shoutingBroadsheet: LocaleContent = {
      ...enContent,
      press: enContent.press.map((p, i) => (i === 1 ? { ...p, text: 'THE EFFECT IS MODEST, SAY THE AUTHORS' } : p)),
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
  // SCOPE IS THE COPY CATALOG, deliberately. Sweeping the scenario corpus too
  // would fire on one string per locale, and it is the same joke each time:
  // Grantwell's "a p-value of .06 is just a p-value of .05 with poor time
  // management". That is a character writing sloppily in an email, not the
  // app's own notation, and `src/content/*/index.ts` is W3's file. BOOKED FOR
  // W3 with that reading attached, not silently swept here.
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
 * 71,680 of 71,680 valid paths rounded to 1. The largest string on the
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
 * NEITHER IS RENDERED YET. `src/ui/screens/Briefing.tsx` still reads the
 * `briefing.emailSubject` copy key, and `src/ui/screens/Reveal.tsx` still emits
 * no subline on a NULL_REPORTED stamp; both files belong to W7 in this round
 * and this wave is barred from them. The banks are authored, shaped and pinned
 * here so that wiring them is a two-line change with the content already under
 * law, exactly as W2 handed its rostered keys forward. THE HAND-OFF, in the
 * words the wiring needs:
 *   - Briefing.tsx:193 — `subject={pickGrantwellEmail(content.grantwellSubjects, iso)}`.
 *     The SAME picker and the SAME iso as the body one line above: the banks are
 *     equal length, so one seed lands on the pair that was written together.
 *     `briefing.emailSubject` becomes dead and should be deleted in that commit.
 *   - Reveal.tsx:300 — the NULL_REPORTED branch of the same expression that
 *     already indexes `retractionSublines` by `puzzleNumber % length`.
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
