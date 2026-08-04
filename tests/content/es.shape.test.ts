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
  emDashDensity,
  findEmDashProblems,
  findMissingSpecKnobs,
  findPressSpoilerTerms,
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
 * THE SPOILER LAW's vocabulary, in Spanish (T39b). Replaces the English alias
 * this file carried while the 24 T39a blurbs were still English placeholders:
 * with real Spanish in the bank, "replicó", "retractado" and "desmentido"
 * would have sailed past every English entry, and the guard would have been
 * green by not understanding the question.
 *
 * Matched at word-START by findPressSpoilerTerms, over blurb TEXT and OUTLET,
 * case-insensitively — which is what lets a single lowercase stem also catch a
 * shouting tier-3 rótulo.
 *
 * STEMS, chosen for how Spanish inflects — and for where the ACCENT breaks the
 * stem, which is the trap this language sets:
 *
 *  - 'replic' catches replicado / replicación / replicó (the final "ó" is past
 *    the stem, so it is caught), but CANNOT catch "réplica": the accent sits
 *    inside the stem itself and `\breplic` never matches r-é-p-l-i-c. Hence the
 *    separate 'réplic' entry. The same logic would apply to any future stem
 *    whose first syllable can take a tilde.
 *  - 'desmenti' + 'desmient': Spanish is stem-changing here (desmentido vs
 *    desmiente), so one entry cannot reach both forms. Both are listed.
 *  - 'retract' / 'desacredit' / 'refut' / 'desmontad' / 'amañad': the five
 *    ways a Spanish newsroom says a claim has been taken apart.
 *
 * PHRASES, where Spanish carries the verdict analytically: 'falso positivo'
 * (+ plural), 'resultado nulo' (+ plural), 'efecto nulo', 'ningún efecto'
 * (with its accent-stripped twin, since matching is literal), 'efecto real',
 * 'siempre cero', 'se sostiene' / 'se sostuvo'.
 *
 * FOUR DELIBERATE EXCLUSIONS. Two are MEASURED against the bank as it ships:
 * 'confirm' fires on two blurbs and 'verdad' on one, so a lexicon carrying
 * either would fail on approved content. The other two are prospective —
 * nothing trips them yet, and each is the collision the LANGUAGE invites rather
 * than one already present, which is why each has an explicit negative case at
 * the bottom of this file rather than a promise in a comment:
 *
 *  1. 'confirm' (2 hits today). The carve-out the English lexicon documents,
 *     for the same reason: "La ciencia confirma por fin lo que tu grupo de
 *     WhatsApp ya sospechaba" is Act I credulity about the paper the PLAYER
 *     just published, not a claim about the game's ground truth.
 *  2. 'verdad' (1 hit today). "El número cuatro está en una revista de verdad"
 *     is a tier-2 joke about the JOURNAL, not a claim about the finding.
 *  3. 'azar' / 'aleator'. RANDOMISATION vocabulary ("asignados al azar",
 *     "muestra aleatoria"), i.e. method, which the spoiler law explicitly
 *     permits. 'chiripa' covers the fluke sense with no such collision.
 *  4. 'sostien'. The bare stem is Spanish's ordinary verb for MAINTAINING a
 *     claim: the dog-economist cover story opens "El folclore de la inversión
 *     minorista sostiene que...", so a blurb reporting what the authors
 *     maintain would trip a verdict guard on a sentence that asserts nothing.
 *     The reflexive 'se sostiene' / 'se sostuvo' carry the verdict and nothing
 *     else.
 *
 * Residual risk accepted and stated, the same way HARM_LEXICON_ES accepts
 * 'cura': 'retirad' would fire on "los corredores retirados en el kilómetro
 * 30", and this bank covers a marathon. Nothing in the corpus says it, and the
 * policy would rather stop an author writing that than let "el estudio ha sido
 * retirado" through.
 */
export const ES_PRESS_SPOILER_LEXICON = [
  'replic',
  'réplic',
  'retract',
  'retirad',
  'desmenti',
  'desmient',
  'desmontad',
  'refut',
  'desacredit',
  'amañad',
  'bulo',
  'fraud',
  'fake',
  'chiripa',
  'p-hack',
  'falso positivo',
  'falsos positivos',
  'resultado nulo',
  'resultados nulos',
  'efecto nulo',
  'ningún efecto',
  'ningun efecto',
  'efecto real',
  'siempre cero',
  'se sostiene',
  'se sostuvo',
];

export const ES_LEXICONS: ContentLexicons = {
  harmTerms: HARM_LEXICON_ES,
  directionTerms: NEGATIVE_DIRECTION_LEXICON_ES,
  pressSpoilerTerms: ES_PRESS_SPOILER_LEXICON,
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
   * T39a's DECLARED TRANSCREATION DEBT, now PAID (T39b), and the same test
   * standing guard over the fact.
   *
   * T39a added 24 scenario-bound blurbs to the English bank and, because
   * structural press parity is a law of this suite (identical counts, tiers and
   * scenarioIds index by index), shipped the Spanish entries immediately with
   * their cabeceras mapped and their `text` still English. This test pinned
   * that set of 24 indices so the debt was DATA rather than a comment anyone
   * could forget, and it failed in BOTH directions: translate one without
   * shortening the list -> fail; add a 25th English-aliased blurb -> fail.
   *
   * T39b transcreated all 24, so the list is EMPTY, and the assertion has
   * turned into the permanent one it was always designed to become: no Spanish
   * press blurb may ever again be byte-identical to its English counterpart.
   * The list only ever shrank, and there is nothing left in it to shrink.
   */
  it('leaves no press blurb in English: every Spanish text differs from its English counterpart', () => {
    const aliased = esContent.press.flatMap((blurb, i) => (blurb.text === enContent.press[i].text ? [i] : []));
    expect(aliased).toEqual([]);
  });

  it('keeps the outlet cabeceras Spanish too, not only the blurb text', () => {
    for (const [i, es] of esContent.press.entries()) {
      expect(es.outlet, `press[${i}] outlet`).not.toBe(enContent.press[i].outlet);
    }
  });

  /**
   * T39b's own coverage check on the transcreation: a blurb that named the
   * ENGLISH scenario's furniture would pass every mechanical guard in this file
   * and still read as a translation. These are the places where the Spanish
   * scenarios put something of their own on the table, so they are the ones the
   * press has to pick up.
   */
  it('reuses the SPANISH scenarios\' furniture, not the English source\'s', () => {
    const texts = esContent.press.map((p) => p.text).join(' ');
    // thirteen-mortgage keeps 13 here (martes 13), under the Spanish coinage.
    expect(texts).toContain('triscaidecafobia');
    // standing-desk-poetry's cover story promises the endecasílabo.
    expect(texts).toContain('ENDECASÍLABO');
    // cafe-peer-review happens in a cafetería, so the pastry is a napolitana.
    expect(texts).toContain('NAPOLITANA');
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

describe('Spanish press spoiler law (T39a\'s law, scanned in Spanish since T39b)', () => {
  it('asserts no verdict anywhere in the Spanish bank, bespoke or generic', () => {
    expect(findPressSpoilerTerms(esContent, ES_PRESS_SPOILER_LEXICON)).toEqual([]);
  });

  // Every line below is one a Spanish writer could plausibly reach for on a day
  // the effect happens to be real, and every one of them would hand the player
  // the verdict one screen early. Each must be caught.
  it.each([
    'El resultado se ha replicado en tres laboratorios.',
    'La réplica independiente ya está en marcha.',
    'El artículo fue retractado anoche.',
    'La revista ha retirado el estudio.',
    'La tesis quedó desmentida en unas horas.',
    'Los datos desmienten a los autores.',
    'El argumento queda desmontado punto por punto.',
    'La hipótesis ha sido refutada por un grupo rival.',
    'El hallazgo ha quedado desacreditado.',
    'Hay quien habla de un estudio amañado.',
    'Los expertos lo califican de bulo.',
    'Se habla abiertamente de fraude.',
    'Los expertos lo llaman fake news.',
    'Pura chiripa, dicen ahora los críticos.',
    'Un ejemplo de manual de p-hacking.',
    'Era un falso positivo.',
    'Son falsos positivos, sostienen los críticos.',
    'Un resultado nulo, al final.',
    'Eran resultados nulos.',
    'Efecto nulo, dicen los autores.',
    'No se observó ningún efecto.',
    'El efecto real era otro.',
    'Siempre cero, y lo sabían.',
    'La hipótesis no se sostiene.',
    'La conclusión no se sostuvo ni una semana.',
  ])('catches the Spanish verdict in "%s"', (text) => {
    const broken = { ...esContent, press: [{ ...esContent.press[1], text }, ...esContent.press.slice(1)] };
    expect(findPressSpoilerTerms(broken, ES_PRESS_SPOILER_LEXICON).length).toBeGreaterThan(0);
  });

  // The four documented exclusions, asserted rather than only described. Each
  // of these sentences is Act I credulity or plain method vocabulary, and a
  // lexicon that fired on any of them would be banning the bank's own material.
  it.each([
    'La ciencia confirma por fin lo que ya sospechabas.',
    'Los participantes fueron asignados al azar a los dos grupos.',
    'La muestra aleatoria cubre tres ciudades.',
    'Los autores sostienen que el efecto es modesto.',
    'El número cuatro está en una revista de verdad.',
  ])('does not fire on the permitted register in "%s"', (text) => {
    const ok = { ...esContent, press: [{ ...esContent.press[1], text }, ...esContent.press.slice(1)] };
    expect(findPressSpoilerTerms(ok, ES_PRESS_SPOILER_LEXICON)).toEqual([]);
  });

  it('is wired into the validator through ES_LEXICONS, not only into this block', () => {
    const broken = {
      ...esContent,
      press: [{ ...esContent.press[1], text: 'El estudio ha sido retractado.' }, ...esContent.press.slice(1)],
    };
    expect(validateLocaleContent(broken, ES_LEXICONS, enIds).some((p) => p.includes('asserts a verdict'))).toBe(true);
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
