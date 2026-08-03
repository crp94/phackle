import { describe, expect, it } from 'vitest';
import { content as enContent } from '../../src/content/en';
import { JOURNALS } from '../../src/content/journals';
import type { LocaleContent } from '../../src/content/types';

const MIN_SCENARIOS = 20;
const MIN_GRANTWELL = 12;
const MIN_JOURNALS = 15;

// Outcome-family contract (master spec §3.2): the engine always emits the four
// outcomes in the order [heavy-tailed, positively skewed, count-like, bounded
// 1-10 scale]. Scenario prose only *renames* those columns, so index 2 must be
// labelled as a rate/count ("trades/week") and index 3 must name the 1-10 scale
// the DGP actually clamps to (Y4_LOADINGS.min/max). Both patterns are numerals
// and punctuation, so they hold for IT/ES too and live in the shared validator.
const COUNT_UNIT = /\//;
const BOUNDED_UNIT = /\b1\s*[–—-]\s*10\b/;

/**
 * The one-tailed direction contract with T7: the hypothesized direction is
 * always POSITIVE, so every outcome must be phrased such that *more* of the
 * metric means *more* of the claimed effect. This lexicon is a phrasing guard,
 * not a semantics oracle — it catches the easy mistake ("Bugs shipped",
 * "Reduction in errors"), while the semantic reading stays a human review step.
 * English-only, hence not part of the locale-agnostic validator; T19/T20 pass
 * their own lexicon.
 */
export const NEGATIVE_DIRECTION_LEXICON = [
  'fewer',
  'less',
  'lower',
  'reduced',
  'reduction',
  'decrease',
  'decline',
  'shorter',
  'slower',
  'worse',
  'loss',
  'error',
  'failure',
  'drop',
];

/**
 * Harm check (master spec §4 preamble): hypotheses are absurd-but-benign. No
 * screenshot of this game may be launderable into a real health claim — cats
 * and crypto yes, drugs and diseases no. Matched at word-start so plurals and
 * derivatives ("diets", "dietary", "therapies") are caught too.
 */
export const HARM_LEXICON = ['vaccine', 'drug', 'cancer', 'diet', 'cure', 'therapy', 'supplement'];

function scenarioProse(content: LocaleContent): { where: string; text: string }[] {
  return content.scenarios.flatMap((s) => [
    { where: `${s.id}.question`, text: s.question },
    { where: `${s.id}.coverStory`, text: s.coverStory },
    { where: `${s.id}.treatmentLabel`, text: s.treatmentLabel },
    { where: `${s.id}.headline`, text: s.headline },
    ...s.outcomeLabels.map((l, i) => ({ where: `${s.id}.outcomeLabels[${i}]`, text: l })),
    ...s.outcomeUnits.map((u, i) => ({ where: `${s.id}.outcomeUnits[${i}]`, text: u })),
    { where: `${s.id}.covariateLabels.income`, text: s.covariateLabels.income },
    { where: `${s.id}.covariateLabels.risk`, text: s.covariateLabels.risk },
  ]);
}

/** Word-start matches (catches plurals/derivatives): `\bdiet` hits "dietary". */
export function findHarmTerms(content: LocaleContent, lexicon: string[] = HARM_LEXICON): string[] {
  const problems: string[] = [];
  for (const { where, text } of scenarioProse(content)) {
    for (const term of lexicon) {
      if (new RegExp(`\\b${term}`, 'i').test(text)) {
        problems.push(`${where} contains banned term "${term}": "${text}"`);
      }
    }
  }
  return problems;
}

/** Whole-word matches, so "wellness" does not trip "less" nor "slower" trip "lower". */
export function findNegativeDirectionTerms(
  content: LocaleContent,
  lexicon: string[] = NEGATIVE_DIRECTION_LEXICON
): string[] {
  const problems: string[] = [];
  for (const scenario of content.scenarios) {
    scenario.outcomeLabels.forEach((label, i) => {
      for (const term of lexicon) {
        if (new RegExp(`\\b${term}\\b`, 'i').test(label)) {
          problems.push(`scenario "${scenario.id}" outcomeLabels[${i}] reads as a decrease ("${term}"): "${label}"`);
        }
      }
    });
  }
  return problems;
}

/**
 * Structural + cross-reference validation for a LocaleContent object.
 * Reused as-is by the IT/ES shape tests in T19/T20, which additionally pass
 * `referenceIds` (the English scenario id order) to confirm every locale
 * ships the same scenarios, in the same order, under the same ids.
 */
export function validateLocaleContent(content: LocaleContent, referenceIds?: string[]): string[] {
  const problems: string[] = [];

  if (content.scenarios.length < MIN_SCENARIOS) {
    problems.push(`expected >= ${MIN_SCENARIOS} scenarios, got ${content.scenarios.length}`);
  }
  if (content.grantwell.length < MIN_GRANTWELL) {
    problems.push(`expected >= ${MIN_GRANTWELL} grantwell emails, got ${content.grantwell.length}`);
  }
  if (JOURNALS.length < MIN_JOURNALS) {
    problems.push(`expected >= ${MIN_JOURNALS} journals in the shared pool, got ${JOURNALS.length}`);
  }

  const ids = content.scenarios.map((s) => s.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    problems.push(`scenario ids are not unique: ${[...new Set(duplicates)].join(', ')}`);
  }

  if (referenceIds) {
    const sameOrder = ids.length === referenceIds.length && ids.every((id, i) => id === referenceIds[i]);
    if (!sameOrder) {
      problems.push(
        `scenario ids/order do not match the reference locale: expected [${referenceIds.join(', ')}], got [${ids.join(', ')}]`
      );
    }
  }

  const allJournalTags = new Set(JOURNALS.flatMap((j) => j.tags));
  for (const scenario of content.scenarios) {
    for (const tag of scenario.journalTags) {
      if (!allJournalTags.has(tag)) {
        problems.push(`scenario "${scenario.id}" uses journalTag "${tag}" that no journal in JOURNALS carries`);
      }
    }

    if (scenario.outcomeLabels.length !== 4 || scenario.outcomeLabels.some((label) => label.trim().length === 0)) {
      problems.push(`scenario "${scenario.id}" must have exactly 4 non-empty outcomeLabels`);
    }
    if (scenario.outcomeUnits.length !== 4 || scenario.outcomeUnits.some((unit) => unit.trim().length === 0)) {
      problems.push(`scenario "${scenario.id}" must have exactly 4 non-empty outcomeUnits`);
    }

    if (!COUNT_UNIT.test(scenario.outcomeUnits[2])) {
      problems.push(
        `scenario "${scenario.id}" outcomeUnits[2] must read as a count rate (contain "/"): "${scenario.outcomeUnits[2]}"`
      );
    }
    if (!BOUNDED_UNIT.test(scenario.outcomeUnits[3])) {
      problems.push(
        `scenario "${scenario.id}" outcomeUnits[3] must name the 1-10 bounded scale: "${scenario.outcomeUnits[3]}"`
      );
    }

    if (!scenario.question.trim().endsWith('?')) {
      problems.push(`scenario "${scenario.id}" question must end in "?": "${scenario.question}"`);
    }
  }

  return problems;
}

describe('validateLocaleContent', () => {
  it('reports no problems for the English content', () => {
    expect(validateLocaleContent(enContent)).toEqual([]);
  });

  it('passes when referenceIds matches the content ids and order', () => {
    const ids = enContent.scenarios.map((s) => s.id);
    expect(validateLocaleContent(enContent, ids)).toEqual([]);
  });

  it('flags a referenceIds mismatch', () => {
    const problems = validateLocaleContent(enContent, ['not-a-real-id']);
    expect(problems.some((p) => p.includes('reference locale'))).toBe(true);
  });

  it('flags too few scenarios', () => {
    const broken: LocaleContent = { ...enContent, scenarios: enContent.scenarios.slice(0, 1) };
    expect(validateLocaleContent(broken).some((p) => p.includes('scenarios'))).toBe(true);
  });

  it('flags too few grantwell emails', () => {
    const broken: LocaleContent = { ...enContent, grantwell: enContent.grantwell.slice(0, 1) };
    expect(validateLocaleContent(broken).some((p) => p.includes('grantwell'))).toBe(true);
  });

  it('flags a duplicate scenario id', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = { ...enContent, scenarios: [first, first] };
    expect(validateLocaleContent(broken).some((p) => p.includes('unique'))).toBe(true);
  });

  it('flags a journalTag that no journal carries', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], journalTags: ['not-a-real-tag'] }, ...enContent.scenarios.slice(1)],
    };
    expect(validateLocaleContent(broken).some((p) => p.includes('journalTag'))).toBe(true);
  });

  it('flags a scenario missing an outcome label', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...enContent.scenarios[0], outcomeLabels: ['a', 'b', 'c', ''] as [string, string, string, string] },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken).some((p) => p.includes('outcomeLabels'))).toBe(true);
  });

  it('flags a question that does not end in "?"', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], question: 'This is not a question.' }, ...enContent.scenarios.slice(1)],
    };
    expect(validateLocaleContent(broken).some((p) => p.includes('question'))).toBe(true);
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
    expect(validateLocaleContent(broken).some((p) => p.includes('outcomeUnits[2]'))).toBe(true);
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
    expect(validateLocaleContent(broken).some((p) => p.includes('outcomeUnits[3]'))).toBe(true);
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
