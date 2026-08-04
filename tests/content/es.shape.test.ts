// T20 — the Spanish locale's parity suite.
//
// Structure mirrors tests/content/shape.test.ts, which is the source-of-truth
// suite and exports its validator precisely so a locale suite can reuse it
// ("Reused as-is by the IT/ES shape tests in T19/T20, which pass their own
// `lexicons` and additionally pass `referenceIds`"). Two things live here and
// nowhere else:
//
//  1. ES_LEXICONS — the Spanish harm and negative-direction word lists,
//     mirroring HARM_LEXICON / NEGATIVE_DIRECTION_LEXICON. They are a required
//     argument to validateLocaleContent, so a locale that forgot them would
//     silently skip the only two guards that protect the product.
//  2. The transcreation contract: identical scenario ids/order/tags, identical
//     copy keys, identical interpolation tokens, and the non-translation rules
//     (journal pool stays English, decimals stay points, Prof. Grantwell keeps
//     his name).
import { describe, expect, it } from 'vitest';
import { content as enContent } from '../../src/content/en';
import { copy as enCopy } from '../../src/content/en/copy';
import { content as esContent } from '../../src/content/es';
import { copy as esCopy } from '../../src/content/es/copy';
import { getContent } from '../../src/content';
import { JOURNALS } from '../../src/content/journals';
import { AVAILABLE_LOCALES } from '../../src/i18n/locale';
import type { ContentLexicons } from './shape.test';
import {
  PRESS_SPOILER_LEXICON,
  emDashDensity,
  findEmDashProblems,
  findMissingSpecKnobs,
  validateLocaleContent,
} from './shape.test';

/**
 * Harm check (master spec §4), in Spanish. Same seven concepts as
 * HARM_LEXICON — vaccine / drug / cancer / diet / cure / therapy / supplement —
 * expanded to the stems Spanish morphology actually produces, because the
 * matcher anchors at word start only (`\bdieta` hits "dietético" but
 * `\bfármaco` would miss the unaccented "farmacológico", so both stems are
 * listed).
 *
 * Two stems are deliberately NOT here. 'nutri' would fire on
 * sourdough-marathon's "conductual y no nutricional", which is the scenario
 * DISCLAIMING a nutritional reading and therefore the opposite of the thing
 * this guard exists to catch. 'tratamiento' is the app's own
 * experimental-design vocabulary (Scenario.treatmentLabel, about.mechanism's
 * "un tratamiento confundido con la edad"), not a medical claim.
 */
export const HARM_LEXICON_ES = [
  'vacuna',
  'fármaco',
  'farmac',
  'cáncer',
  'cancerí',
  'dieta',
  'dietét',
  'cura',
  'terapia',
  'terapéut',
  'suplement',
  'medicament',
  'médic',
  'medic',
  'clínic',
  'clinic',
  'salud',
  'adelgaz',
  'enfermedad',
  'síntoma',
  'patolog',
];

/**
 * The one-tailed direction contract, in Spanish. Whole-word matches, so both
 * singular and plural forms have to be listed explicitly: `\berror\b` does not
 * match "errores". Same intent as NEGATIVE_DIRECTION_LEXICON — a phrasing
 * guard against an outcome label that reads as a DECREASE, not a semantics
 * oracle.
 */
export const NEGATIVE_DIRECTION_LEXICON_ES = [
  'menos',
  'menor',
  'menores',
  'inferior',
  'inferiores',
  'reducido',
  'reducida',
  'reducción',
  'descenso',
  'caída',
  'caídas',
  'bajada',
  'disminución',
  'merma',
  'pérdida',
  'pérdidas',
  'error',
  'errores',
  'fallo',
  'fallos',
  'peor',
  'peores',
  'lento',
  'lenta',
  'corto',
  'corta',
  'breve',
  'retraso',
  'retrasos',
  'atraso',
  'atrasos',
  'escaso',
  'escasa',
  'escasos',
  'escasas',
  'nulo',
  'nula',
  'nulos',
  'nulas',
  'baja',
  'bajas',
  'penaliza',
];

/**
 * The press spoiler law's vocabulary, Spanish. **T39b MUST REPLACE THIS.**
 *
 * Fix round 1 [I1] made `pressSpoilerTerms` a required field of
 * ContentLexicons and wired the press guards into the shared validator, so
 * every locale's press is now checked for verdict vocabulary rather than only
 * English's. Spanish has no list of its own yet, and there is a precise reason
 * that is currently harmless: all 24 Spanish T39a blurbs are still ENGLISH
 * placeholder text (see the debt tracker below), so the ENGLISH lexicon is
 * exactly the right one to run against them today.
 *
 * The moment T39b writes real Spanish, that stops being true — "replicó",
 * "retractado", "desmentido" would sail straight past every entry here. So T39b
 * owns two jobs, not one: transcreate the 24 blurbs AND replace this alias with
 * real Spanish stems, the same way HARM_LEXICON_ES is real Spanish and not a
 * translation of the English list. The debt tracker below fails if the first
 * job is done without the second being possible to forget.
 */
export const ES_PRESS_SPOILER_LEXICON_PENDING_T39B = PRESS_SPOILER_LEXICON;

export const ES_LEXICONS: ContentLexicons = {
  harmTerms: HARM_LEXICON_ES,
  directionTerms: NEGATIVE_DIRECTION_LEXICON_ES,
  pressSpoilerTerms: ES_PRESS_SPOILER_LEXICON_PENDING_T39B,
};

const enIds = enContent.scenarios.map((s) => s.id);
const tokensOf = (text: string): string[] => text.match(/\{[^}]*\}/g) ?? [];

describe('Spanish locale — structural parity with English', () => {
  it('passes the shared validator with the Spanish lexicons and the English reference ids', () => {
    expect(validateLocaleContent(esContent, ES_LEXICONS, enIds)).toEqual([]);
  });

  it('ships the same scenario ids in the same order', () => {
    expect(esContent.scenarios.map((s) => s.id)).toEqual(enIds);
  });

  it('carries identical journalTags per scenario (the journal pool is shared and English)', () => {
    for (const [i, es] of esContent.scenarios.entries()) {
      expect(es.journalTags).toEqual(enContent.scenarios[i].journalTags);
    }
  });

  it('matches every bank count', () => {
    expect(esContent.grantwell.length).toBe(enContent.grantwell.length);
    expect(esContent.press.length).toBe(enContent.press.length);
    expect(esContent.retractionSublines.length).toBe(enContent.retractionSublines.length);
    expect(esContent.glossary.length).toBe(enContent.glossary.length);
  });

  it('keeps press tiers and scenario bindings aligned index by index', () => {
    for (const [i, es] of esContent.press.entries()) {
      expect(es.tier).toBe(enContent.press[i].tier);
      expect(es.scenarioIds).toEqual(enContent.press[i].scenarioIds);
    }
  });

  /**
   * T39a's DECLARED TRANSCREATION DEBT, and the mechanism that keeps it from
   * becoming permanent.
   *
   * T39a added 24 scenario-bound blurbs to the English bank. Structural press
   * parity is a law of this suite (identical counts, tiers and scenarioIds
   * index by index), and a law is not something a task gets to suspend for its
   * own convenience — so the Spanish entries exist NOW, with this locale's own
   * cabeceras already mapped in, and only their `text` still English. T39b
   * transcreates them.
   *
   * The debt is therefore DATA, not a comment: an aliased blurb is exactly one
   * whose Spanish text is byte-identical to the English at the same index, and
   * this test pins that set to the list below. It fails in BOTH directions,
   * which is the property that makes it a tracker rather than a licence:
   *
   *   - T39b translates a blurb and forgets to shorten the list -> fail.
   *   - Someone adds a 25th English-aliased blurb -> fail.
   *   - T39b finishes the job -> the list is emptied and the test asserts, from
   *     then on, that NO Spanish blurb is ever left in English again.
   *
   * The list must only ever shrink. Note also what it proves about today: no
   * blurb OUTSIDE it coincides with its English counterpart, so the pre-T39a
   * bank is fully transcreated and this is the whole of the debt.
   */
  it('declares exactly the T39a press blurbs still awaiting transcreation, and no others', () => {
    const PENDING_T39B_PRESS = [
      6, 7, 8, 9, 10, 11, 12, // tier 1
      20, 21, 22, 23, 24, 25, 26, 27, 28, // tier 2
      37, 38, 39, 40, 41, 42, 43, 44, // tier 3
    ];
    const aliased = esContent.press.flatMap((blurb, i) => (blurb.text === enContent.press[i].text ? [i] : []));
    expect(aliased).toEqual(PENDING_T39B_PRESS);
  });

  it('keeps the outlet cabeceras Spanish even where the blurb text is still pending', () => {
    // The placeholders are half-done on purpose: the masthead is the part this
    // locale had already decided, so T39b has one job per entry, not two.
    for (const [i, es] of esContent.press.entries()) {
      expect(es.outlet, `press[${i}] outlet`).not.toBe(enContent.press[i].outlet);
    }
  });

  it('defines exactly the English achievement ids', () => {
    expect(Object.keys(esContent.achievements).sort()).toEqual(Object.keys(enContent.achievements).sort());
    for (const entry of Object.values(esContent.achievements)) {
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.citation.trim().length).toBeGreaterThan(0);
    }
  });

  it('translates every scenario away from the English source text', () => {
    for (const [i, es] of esContent.scenarios.entries()) {
      expect(es.question).not.toBe(enContent.scenarios[i].question);
      expect(es.coverStory).not.toBe(enContent.scenarios[i].coverStory);
    }
  });
});

describe('Spanish copy catalog', () => {
  it('defines exactly the CopyKey set English defines, and nothing else', () => {
    expect(Object.keys(esCopy).sort()).toEqual(Object.keys(enCopy).sort());
  });

  it('leaves no value empty', () => {
    for (const [key, value] of Object.entries(esCopy)) {
      expect(value.trim().length, `copy["${key}"] is empty`).toBeGreaterThan(0);
    }
  });

  it('preserves every interpolation token, and repeats none of them', () => {
    // t() substitutes with String.replace, which rewrites the FIRST occurrence
    // only, so a translation that repeats {n} would render the second one raw.
    for (const key of Object.keys(enCopy) as (keyof typeof enCopy)[]) {
      const expected = tokensOf(enCopy[key]);
      const actual = tokensOf(esCopy[key]);
      expect(new Set(actual), `copy["${key}"] token set`).toEqual(new Set(expected));
      expect(actual.length, `copy["${key}"] repeats a token`).toBe(new Set(actual).size);
    }
  });

  it('keeps each scenario headline on the same token contract as English', () => {
    for (const [i, es] of esContent.scenarios.entries()) {
      expect(tokensOf(es.headline)).toEqual(tokensOf(enContent.scenarios[i].headline));
    }
  });

  it('actually translates the prose keys rather than passing English through', () => {
    const sampled = [
      'nav.tagline',
      'lab.submit',
      'call.prompt',
      'reveal.groupedCaption',
      'about.intro',
      'prereg.commit',
    ] as const;
    for (const key of sampled) {
      expect(esCopy[key], key).not.toBe(enCopy[key]);
    }
  });
});

describe('Spanish non-translation rules', () => {
  it('keeps statistical notation on the decimal POINT, never a comma', () => {
    const notation = [
      esCopy['lab.exclusionZ2_5'],
      esCopy['reveal.exclusionZ25'],
      esCopy['lab.pBelow'],
      esCopy['reveal.pValueTiny'],
      esCopy['briefing.goal'],
      esCopy['lab.howThisWorks.step2'],
      esCopy['lab.dialCaption'],
      esCopy['about.decimalNote'],
    ];
    for (const text of notation) {
      expect(text, text).not.toMatch(/\d,\d/);
      expect(text, text).toMatch(/\d\.\d/);
    }
  });

  it('states the decimal-point rule in the About page, as English does', () => {
    expect(esCopy['about.decimalNote']).toContain('0.049');
  });

  it('keeps Prof. Grantwell under his own name, in the email and in Act II', () => {
    expect(esCopy['briefing.emailFrom']).toBe(enCopy['briefing.emailFrom']);
    expect(esContent.retractionSublines.some((s) => s.includes('Grantwell'))).toBe(true);
  });

  it('never localizes a journal masthead into the scenarios', () => {
    const tags = new Set(JOURNALS.flatMap((j) => j.tags));
    for (const scenario of esContent.scenarios) {
      for (const tag of scenario.journalTags) expect(tags.has(tag)).toBe(true);
    }
  });

  it('keeps Reviewer 2 as Reviewer 2 in the Grantwell bank', () => {
    expect(esContent.grantwell.some((g) => g.includes('Reviewer 2'))).toBe(true);
  });
});

describe('Spanish em-dash budget (inherited from the English corpus rules)', () => {
  it('keeps every Spanish value at one em dash or fewer, and the corpus above the density floor', () => {
    expect(findEmDashProblems(esContent)).toEqual([]);
  });

  it('measures a density the report can quote', () => {
    const { charsPerDash } = emDashDensity(esContent);
    expect(charsPerDash).toBeGreaterThanOrEqual(2500);
  });
});

describe('Spanish locale wiring', () => {
  it('is offered in the language toggle', () => {
    expect(AVAILABLE_LOCALES).toContain('es');
  });

  it('is served by getContent("es") as its own module, not aliased to English', async () => {
    const loaded = await getContent('es');
    expect(loaded).toBe(esContent);
    expect(loaded.copy['nav.tagline']).not.toBe(enCopy['nav.tagline']);
  });
});

describe('T33 — Spanish spec legend mirrors the six-knob enumeration', () => {
  it('names every knob, in Spanish, using the Spanish Lab labels', () => {
    expect(findMissingSpecKnobs(esContent)).toEqual([]);
  });
});
