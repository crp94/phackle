// The ENGLISH content shape suite. The validators themselves live in
// `./validators.ts` (a plain module, no `describe`/`it`) so that
// `it.shape.test.ts` and `es.shape.test.ts` can import them without importing
// — and therefore re-registering — this file's own tests. See gr6-106.
import { describe, expect, it } from 'vitest';
import { content as enContent } from '../../src/content/en';
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
  findScenariosWithoutPress,
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
    // '401(k)' is a proper noun whose lowercase k survives even on a chyron,
    // which is why the law is a ratio and not `text === text.toUpperCase()`.
    const chyron = enContent.press.find((p) => p.text.includes('401(k)'));
    expect(chyron?.text).not.toBe(chyron?.text.toUpperCase());
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
});
