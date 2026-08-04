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
 * The words are English, so the list is passed *into* validateLocaleContent
 * rather than baked into it; T19/T20 supply their own.
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

/**
 * The em-dash budget (owner directive, T32: "The text has too many em dashes,
 * reads too AI"). An em dash is the house style of machine-written prose: it
 * lets a sentence hedge, qualify and append without ever committing to a full
 * stop. Two caps, both mechanical:
 *
 *   1. PER STRING: at most one. A sentence with a pair of them is a parenthesis
 *      wearing a costume; write the parenthesis, or write two sentences.
 *   2. CORPUS-WIDE: at least MIN_CHARS_PER_EM_DASH characters per em dash,
 *      across every user-facing value in the locale (scenarios, banks,
 *      achievements, glossary AND the copy catalog). The per-string cap alone
 *      would happily pass a corpus that dashes once in every line.
 *
 * WHY 2500, AND NOT THE 400 THIS TEST WAS FIRST WRITTEN WITH. Measured against
 * the corpus the owner was complaining about, the density was already 1 per
 * 635.6 characters (48 dashes in 30,508) — so a 400-character floor would have
 * passed, unchanged, the exact prose that prompted "reads too AI". A budget
 * that green-lights the thing it was written to catch is decoration. The floor
 * is therefore set at the state the scrub actually achieved rather than at a
 * number the problem could clear: the corpus now runs 3 dashes in 30,929
 * characters (1 per 10,310), of which one is the Stats no-data glyph and two
 * are deliberate TV-chyron punctuation. 2500 locks that in with roughly 4x
 * headroom, which is the room IT/ES need for a language whose typography leans
 * on the dash harder than English does — and it still fails instantly on a
 * corpus that reaches for the dash as a habit.
 *
 * Both caps live in validateLocaleContent so the IT/ES transcreations
 * (T19/T20) inherit the budget without opting in. The counted character is
 * U+2014 only: the en dash in "1–10 scale" is a range, not a rhetorical move.
 */
const EM_DASH = '—';
const MAX_EM_DASHES_PER_STRING = 1;
const MIN_CHARS_PER_EM_DASH = 2500;

/** Every user-facing value in a locale, flattened. Keys are never included. */
function localeProse(content: LocaleContent): { where: string; text: string }[] {
  const rows: { where: string; text: string }[] = [...scenarioProse(content)];

  content.grantwell.forEach((text, i) => rows.push({ where: `grantwell[${i}]`, text }));
  content.press.forEach((blurb, i) => {
    rows.push({ where: `press[${i}].text`, text: blurb.text });
    rows.push({ where: `press[${i}].outlet`, text: blurb.outlet });
  });
  content.retractionSublines.forEach((text, i) => rows.push({ where: `retractionSublines[${i}]`, text }));
  for (const [id, achievement] of Object.entries(content.achievements)) {
    rows.push({ where: `achievements.${id}.name`, text: achievement.name });
    rows.push({ where: `achievements.${id}.citation`, text: achievement.citation });
  }
  content.glossary.forEach((entry, i) => {
    rows.push({ where: `glossary[${i}].term`, text: entry.term });
    rows.push({ where: `glossary[${i}].def`, text: entry.def });
  });
  for (const [key, text] of Object.entries(content.copy)) {
    rows.push({ where: `copy["${key}"]`, text });
  }

  return rows;
}

/** Measured, so a report can quote the number rather than the verdict. */
export function emDashDensity(content: LocaleContent): {
  dashes: number;
  chars: number;
  charsPerDash: number;
} {
  const rows = localeProse(content);
  const dashes = rows.reduce((n, r) => n + (r.text.match(new RegExp(EM_DASH, 'g')) ?? []).length, 0);
  const chars = rows.reduce((n, r) => n + r.text.length, 0);
  return { dashes, chars, charsPerDash: dashes === 0 ? Infinity : chars / dashes };
}

/**
 * T29 collapsed the Legend's per-knob emoji rows into one 🍴 row, which made
 * `legend.emojiSpec`'s parenthetical the ONLY place in the game that says
 * which six knobs a fork can be. T33 mirrors that into Italian and Spanish —
 * and this is the check that the mirror is a real one rather than a shorter
 * list wearing the same key: each locale's own enumeration must name all six
 * knobs, in that locale's OWN vocabulary (the Lab's control labels, plus
 * `reveal.tailsOne` for the switch, which every locale phrases as a
 * one-tailed test rather than as the word "Tails").
 *
 * Deliberately checked against the locale's other copy rather than against a
 * word list written here: a lexicon of Italian statistics terms maintained
 * in a test file would drift from the Lab the first time the Lab is
 * relabelled, and would pass by not understanding the question.
 */
export function findMissingSpecKnobs(content: LocaleContent): string[] {
  const enumeration = content.copy['legend.emojiSpec'].toLowerCase();
  const knobs: (keyof LocaleContent['copy'])[] = [
    'lab.outcome',
    'lab.subgroup',
    'lab.covariates',
    'lab.exclusion',
    'lab.transform',
    'reveal.tailsOne',
  ];
  return knobs.filter((key) => !enumeration.includes(content.copy[key].toLowerCase()));
}

export function findEmDashProblems(content: LocaleContent): string[] {
  const problems: string[] = [];

  for (const { where, text } of localeProse(content)) {
    const n = (text.match(new RegExp(EM_DASH, 'g')) ?? []).length;
    if (n > MAX_EM_DASHES_PER_STRING) {
      problems.push(`${where} uses ${n} em dashes (max ${MAX_EM_DASHES_PER_STRING}): "${text}"`);
    }
  }

  const { dashes, chars, charsPerDash } = emDashDensity(content);
  if (charsPerDash < MIN_CHARS_PER_EM_DASH) {
    problems.push(
      `em-dash density is 1 per ${charsPerDash.toFixed(1)} characters (${dashes} dashes in ${chars} characters); ` +
        `budget is 1 per ${MIN_CHARS_PER_EM_DASH}`
    );
  }

  return problems;
}

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
 * The two language-specific word lists every locale must supply. Required, not
 * optional: a locale suite that forgot them would silently skip the harm and
 * direction guards, which are the two checks that actually protect the product.
 */
export interface ContentLexicons {
  harmTerms: string[];
  directionTerms: string[];
}

export const EN_LEXICONS: ContentLexicons = {
  harmTerms: HARM_LEXICON,
  directionTerms: NEGATIVE_DIRECTION_LEXICON,
};

/**
 * Structural + cross-reference + lexicon validation for a LocaleContent object.
 * Reused as-is by the IT/ES shape tests in T19/T20, which pass their own
 * `lexicons` and additionally pass `referenceIds` (the English scenario id
 * order) to confirm every locale ships the same scenarios, in the same order,
 * under the same ids.
 */
export function validateLocaleContent(
  content: LocaleContent,
  lexicons: ContentLexicons,
  referenceIds?: string[]
): string[] {
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

    // Headline interpolation contract: at most one token, and it must be
    // {effect}. {n} is bound to SAMPLE SIZE elsewhere in the copy catalog
    // (lab.nLabel, lab.collectMore), so a shared interpolator meeting an {n}
    // here would print N into an effect slot.
    const tokens = scenario.headline.match(/\{[^}]*\}/g) ?? [];
    const foreign = tokens.filter((t) => t !== '{effect}');
    if (foreign.length > 0) {
      problems.push(
        `scenario "${scenario.id}" headline may only use {effect}, found ${foreign.join(', ')}: "${scenario.headline}"`
      );
    }
    if (tokens.length > 1) {
      problems.push(`scenario "${scenario.id}" headline has ${tokens.length} tokens, expected at most one`);
    }
  }

  // Scenario-bound press blurbs must name scenarios that exist.
  const idSet = new Set(ids);
  for (const blurb of content.press) {
    for (const id of blurb.scenarioIds ?? []) {
      if (!idSet.has(id)) {
        problems.push(`press blurb from "${blurb.outlet}" is bound to unknown scenario id "${id}"`);
      }
    }
  }

  // The two language-specific guards. Run here, not only in their own describe
  // blocks, so every locale that calls this validator gets them for free.
  problems.push(...findHarmTerms(content, lexicons.harmTerms));
  problems.push(...findNegativeDirectionTerms(content, lexicons.directionTerms));

  // The em-dash budget is language-independent (it counts one character), so
  // unlike the two lexicons it needs no per-locale argument.
  problems.push(...findEmDashProblems(content));

  return problems;
}

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
