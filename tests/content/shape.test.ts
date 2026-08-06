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
 * THE SPOILER LAW (T39a), and the reason it needs a mechanical guard at all.
 *
 * The Published screen renders on BOTH day types. Some days the true effect is
 * exactly zero and the player has hacked their way to p < 0.05; some days the
 * effect is real. The player has not called signal-vs-self-deception yet when
 * the press cards appear, so a blurb that asserts the finding is TRUE, FALSE,
 * REPLICATED or RETRACTED hands them the answer one screen early — for free,
 * and only on the days the writer happened to phrase it that way.
 *
 * T39a made this a live risk rather than a theoretical one: before it, only two
 * blurbs named a scenario at all, and a scenario-agnostic line has very little
 * opportunity to spoil anything. Twenty-four bespoke lines that have read the
 * abstract have plenty. The permitted register is the QUESTION, the METHOD and
 * the cover story's own furniture; the forbidden register is the verdict.
 *
 * Word-START matching, like findHarmTerms, so 'replicat' covers replicated /
 * replication / failed to replicate. Multi-word entries are literal phrases.
 *
 * NOT on this list, deliberately: "confirm". The existing bank has both
 * "Scientists have finally confirmed what your group chat suspected all along"
 * and "SCIENCE CONFIRMS: ...", and neither spoils anything — an outlet
 * announcing that science has confirmed the thing it is reporting is Act I
 * credulity about the PUBLISHED paper, which the player just wrote themselves.
 * The verdict this law protects is the game's ground truth, not the newsroom's
 * confidence, and a lexicon that could not tell those apart would have to ban
 * the bank's best jokes to catch nothing.
 */
export const PRESS_SPOILER_LEXICON = [
  'replicat',
  'retract',
  'debunk',
  'discredit',
  'refut',
  'overturn',
  'withdrawn',
  'fraud',
  'hoax',
  'bogus',
  'fluke',
  'false positive',
  'null result',
  'no effect',
  'real effect',
  'p-hack',
  'held up',
  'did not hold',
  'failed to',
  'always zero',
];

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

/**
 * The harm policy, applied to the PRESS bank (T39a). findHarmTerms above walks
 * scenario prose only, which was enough while every blurb was scenario-
 * agnostic; twenty-four bespoke blurbs that name a study's subject are exactly
 * the surface where a health claim could next appear, so they get their own
 * pass over the same lexicon.
 *
 * TEXT ONLY, never the outlet. 'The Sunday Supplement' is a masthead — a real
 * shape a real weekend paper has — and `\bsupplement` would fire on it every
 * run. Excluding outlets keeps the guard on the sentence a screenshot would
 * actually carry, rather than trading a true guard for a permanent exception
 * list.
 */
export function findPressHarmTerms(content: LocaleContent, lexicon: string[] = HARM_LEXICON): string[] {
  const problems: string[] = [];
  content.press.forEach((blurb, i) => {
    for (const term of lexicon) {
      if (new RegExp(`\\b${term}`, 'i').test(blurb.text)) {
        problems.push(`press[${i}] ("${blurb.outlet}") contains banned term "${term}": "${blurb.text}"`);
      }
    }
  });
  return problems;
}

/** The spoiler law, scanned over every blurb's text AND outlet. See PRESS_SPOILER_LEXICON. */
export function findPressSpoilerTerms(
  content: LocaleContent,
  lexicon: string[] = PRESS_SPOILER_LEXICON
): string[] {
  const problems: string[] = [];
  content.press.forEach((blurb, i) => {
    for (const term of lexicon) {
      for (const [field, text] of [
        ['text', blurb.text],
        ['outlet', blurb.outlet],
      ] as const) {
        if (new RegExp(`\\b${term}`, 'i').test(text)) {
          problems.push(`press[${i}].${field} asserts a verdict ("${term}"), which Published must not do: "${text}"`);
        }
      }
    }
  });
  return problems;
}

/**
 * Share of ASCII letters that are capitals. Non-ASCII letters are simply not
 * counted, which costs nothing (an Italian "SÌ" or a Spanish "NEGOCIACIÓN" is
 * still overwhelmingly ASCII capitals) and avoids a Unicode-case rabbit hole in
 * what is only a phrasing guard.
 */
export function upperCaseRatio(text: string): number {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length === 0) return 1;
  return letters.replace(/[^A-Z]/g, '').length / letters.length;
}

/**
 * The tier VOICE law. Tier 3 is a broadcast lower third and shouts; tiers 1-2
 * are print and do not. Language-independent (it counts capitals, not words),
 * so every locale inherits it.
 *
 * A ratio and not `text === text.toUpperCase()`: '401(k)' is a proper noun
 * whose lowercase k survives even on a chyron, and Italian/Spanish accented
 * capitals are outside the ASCII class this counts.
 */
export function findPressVoiceProblems(content: LocaleContent): string[] {
  const problems: string[] = [];
  content.press.forEach((blurb, i) => {
    const ratio = upperCaseRatio(blurb.text);
    if (blurb.tier === 3 && ratio <= 0.9) {
      problems.push(`press[${i}] is tier 3 but is not in the chyron's shouting voice: "${blurb.text}"`);
    }
    if (blurb.tier !== 3 && ratio >= 0.5) {
      problems.push(`press[${i}] is tier ${blurb.tier} but shouts like a chyron: "${blurb.text}"`);
    }
  });
  return problems;
}

/**
 * Journals belong on the cover, outlets on the clippings (master spec §4.3 vs
 * §4.4). The journal pool is shared and English in every locale, so this is a
 * language-independent check and belongs in the shared validator.
 */
export function findPressJournalNames(content: LocaleContent): string[] {
  const problems: string[] = [];
  content.press.forEach((blurb, i) => {
    for (const journal of JOURNALS) {
      if (`${blurb.text} ${blurb.outlet}`.includes(journal.name)) {
        problems.push(`press[${i}] names the journal "${journal.name}" — press names outlets, never mastheads`);
      }
    }
  });
  return problems;
}

/**
 * Press text is rendered RAW. src/ui/screens/Published.tsx runs
 * substituteEffect over the scenario headline only, so a `{effect}` in a blurb
 * would reach the screen verbatim, braces and all.
 */
export function findPressTokens(content: LocaleContent): string[] {
  const problems: string[] = [];
  content.press.forEach((blurb, i) => {
    const tokens = blurb.text.match(/\{[^}]*\}/g) ?? [];
    if (tokens.length > 0) {
      problems.push(`press[${i}] carries interpolation token(s) ${tokens.join(', ')}, but press text is never substituted`);
    }
  });
  return problems;
}

/**
 * T39a's coverage law, and the whole point of the task: "Every day must feel
 * covered BY NAME." A scenario with no scenario-bound blurb at any tier gets
 * generic coverage of an unnamed study on every single one of its days, which
 * is precisely the flatness play-testing reported. Language-independent (it
 * reads ids, not prose), so it lives in the shared validator and IT/ES inherit
 * it through their own `validateLocaleContent` call.
 */
export function findScenariosWithoutPress(content: LocaleContent): string[] {
  const bound = new Set(content.press.flatMap((p) => p.scenarioIds ?? []));
  return content.scenarios.map((s) => s.id).filter((id) => !bound.has(id));
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
 * The language-specific word lists every locale must supply. All three are
 * REQUIRED, not optional: a locale suite that forgot one would silently skip a
 * guard that actually protects the product, and would report green for it.
 *
 * `pressSpoilerTerms` was added in fix round 1 [I1]. Review finding: five press
 * guards were being invoked on `enContent` only, so today's green was an
 * artifact of the IT/ES placeholders still being English text. T39b is about to
 * replace all 48 of those with real Italian and Spanish, and none of it would
 * have been checked for the spoiler law. Making the field required means a
 * locale cannot acquire real prose without also declaring the vocabulary that
 * prose must not use.
 */
export interface ContentLexicons {
  harmTerms: string[];
  directionTerms: string[];
  pressSpoilerTerms: string[];
}

export const EN_LEXICONS: ContentLexicons = {
  harmTerms: HARM_LEXICON,
  directionTerms: NEGATIVE_DIRECTION_LEXICON,
  pressSpoilerTerms: PRESS_SPOILER_LEXICON,
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

  // ...and the converse, which is T39a's actual deliverable: every scenario
  // must be named by at least one blurb, or its days read as coverage of an
  // unnamed study.
  for (const id of findScenariosWithoutPress(content)) {
    problems.push(`scenario "${id}" has no scenario-bound press blurb (T39a: every day must be covered by name)`);
  }

  // The language-specific guards. Run here, not only in their own describe
  // blocks, so every locale that calls this validator gets them for free.
  problems.push(...findHarmTerms(content, lexicons.harmTerms));
  problems.push(...findNegativeDirectionTerms(content, lexicons.directionTerms));

  // The five PRESS guards (fix round 1 [I1]). These used to be invoked on the
  // English content only, inside this file's own describe block, which meant
  // the Italian and Spanish banks were checked for none of it — a gap that was
  // invisible precisely because their T39a entries are still English
  // placeholders and therefore passed the English lexicons by accident. Moving
  // them here is what makes T39b's 48 new blurbs land under the same laws the
  // English ones were written to.
  problems.push(...findPressHarmTerms(content, lexicons.harmTerms));
  problems.push(...findPressSpoilerTerms(content, lexicons.pressSpoilerTerms));
  problems.push(...findPressVoiceProblems(content));
  problems.push(...findPressJournalNames(content));
  problems.push(...findPressTokens(content));

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
