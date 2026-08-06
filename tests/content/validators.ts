// The content validators, and nothing else — no `describe`, no `it`.
//
// GR6 gr6-106: this module used to live at the top of `shape.test.ts`, and
// `it.shape.test.ts` / `es.shape.test.ts` imported it *from that test file*.
// Importing a vitest module executes its top level, so all 44 of
// `shape.test.ts`'s own tests were re-registered inside each locale file: 88
// duplicate registrations, ~1.3s of wall time, and a headline test count 5.9%
// higher than the number of distinct tests. Extracting the machinery into a
// plain module (imported by all three shape files) removes the duplication
// without changing a single assertion — every validator below is byte-identical
// to the version that lived in `shape.test.ts`.
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
export const MIN_CHARS_PER_EM_DASH = 2500;

export interface ProseRow {
  where: string;
  text: string;
}

/**
 * Every user-facing value in the CORPUS — the scenario bank and the flavour
 * banks — flattened, keys never included. Split out from `localeProse` in W3
 * (gr6-085, w2-r-005) because two laws needed the corpus WITHOUT the copy
 * catalog: the copy catalog has its own guards, and both of those laws would
 * otherwise have had to re-list every bank and would have drifted the first
 * time a bank was added. One list, three consumers.
 */
export function corpusProse(content: LocaleContent): ProseRow[] {
  const rows: ProseRow[] = [...scenarioProse(content)];

  content.grantwell.forEach((text, i) => rows.push({ where: `grantwell[${i}]`, text }));
  // gr6-070 / gr6-037: both banks joined this sweep in the same commit that
  // created them. A bank that is not in `localeProse` is a bank the em-dash
  // budget, and every other corpus-wide law that walks these rows, cannot see —
  // which is how a new bank silently acquires an exemption nobody granted it.
  content.grantwellSubjects.forEach((text, i) => rows.push({ where: `grantwellSubjects[${i}]`, text }));
  content.nullReportedSublines.forEach((text, i) => rows.push({ where: `nullReportedSublines[${i}]`, text }));
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
  return rows;
}

/**
 * The corpus plus the copy catalog: every user-facing value in the locale.
 * Exported since w3-r-003 — the apostrophe law was written over `corpusProse`
 * and therefore stopped at the catalog's edge, which let a typographic quote
 * into `copy` unchallenged (proved: a U+2019 planted in en/copy.ts survived a
 * green suite). A notation rule about how the product TYPES has no business
 * knowing which file a string lives in.
 */
export function localeProse(content: LocaleContent): ProseRow[] {
  const rows: ProseRow[] = [...corpusProse(content)];
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

function scenarioProse(content: LocaleContent): ProseRow[] {
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
 * A ratio and not `text === text.toUpperCase()`: a proper noun can carry a
 * lowercase glyph through a chyron ('401(k)' did, until gr6-069 retired that
 * line for a different reason), and Italian/Spanish accented capitals are
 * outside the ASCII class this counts. Both halves are exercised in
 * shape.test.ts — the first on a fixture now that the corpus no longer supplies
 * the case, the second on live IT/ES tier-3 lines.
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
 * gr6-085 / gr1b-025 — the SAME rule, over the fields that actually feed
 * interpolation.
 *
 * `findPressTokens` above guards press text and `validateLocaleContent` guards
 * the headline, but those were the two fields nobody was going to get wrong.
 * The unguarded ones are the fields that are substituted INTO other strings —
 * `outcomeLabels` (Reveal.tsx, SpecCurve.tsx), `outcomeUnits`
 * (lab.coefPlotAxis's own `{unit}` slot, CoefPlot.tsx), `covariateLabels`
 * (SpecControls.tsx) — plus the ones rendered raw beside them: achievement
 * names and citations, outlets, both subline banks, the Grantwell bodies and
 * their subjects, the question, the cover story and the glossary.
 *
 * A brace in any of them renders as a literal brace on screen. This is
 * legibility, not security: nothing interprets it, nothing escapes it, it just
 * looks broken. None is present in any of the three locales today, which is
 * exactly when to compile the fact — the corpus is under active authoring in
 * three languages, and the field that acquires a `{unit}` by copy-paste from
 * the copy catalog is the field this scan exists for.
 *
 * HEADLINE IS DELIBERATELY NOT HERE. It is the one content field the game
 * substitutes into, so its rule is different (at most one token, and it must be
 * `{effect}`) and lives in `validateLocaleContent`; sweeping it here would ban
 * what that rule permits. gr6-005 retired the token from every shipped
 * headline, but the CONTRACT still allows it, and these two guards must not
 * disagree about that.
 */
export function findParamFieldTokens(content: LocaleContent): string[] {
  const problems: string[] = [];
  for (const { where, text } of corpusProse(content)) {
    // Two exclusions, both load-bearing. `.headline` is the one content field
    // the game substitutes into, so its rule lives in validateLocaleContent and
    // is DIFFERENT (at most one token, and it must be {effect}); sweeping it
    // here would ban what that rule permits. `press[].text` has its own guard
    // (findPressTokens) with its own message, and two problems for one string
    // would be noise.
    if (where.endsWith('.headline') || /^press\[\d+\]\.text$/.test(where)) continue;
    const tokens = text.match(/\{[^}]*\}/g) ?? [];
    if (tokens.length > 0) {
      problems.push(
        `${where} carries interpolation token(s) ${tokens.join(', ')}, but this field is rendered raw or substituted INTO another string`
      );
    }
  }
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
  problems.push(...findParamFieldTokens(content));

  // The em-dash budget is language-independent (it counts one character), so
  // unlike the two lexicons it needs no per-locale argument.
  problems.push(...findEmDashProblems(content));

  return problems;
}
