// T19 — the ITALIAN locale's parity suite.
//
// `./validators.ts` owns the *validator* (gr6-106 moved it out of
// ./shape.test.ts, whose top level this file used to import — and therefore
// re-execute — for it); this file owns the
// Italian *lexicons* and the parity assertions. The split is deliberate and
// mirrors how EN's own lexicons live next to EN's own assertions: the two word
// lists are language data, not shared machinery, so they sit with the locale
// that needs them rather than in the validator they are passed into.
//
// What "parity" means here, in the exact words of the T19 contract:
//   - identical scenario ids, in identical order, at identical counts;
//   - identical journalTags, press tiers and press scenarioIds bindings;
//   - a `copy` catalog that satisfies the CopyKey union in full (that half is
//     enforced by `tsc`, not by vitest — a missing key is a compile error in
//     src/content/it/index.ts, never a runtime fallback);
//   - the harm policy and the one-tailed direction contract re-checked against
//     ITALIAN words, because an English lexicon applied to Italian prose is a
//     guard that passes by not understanding the question.
import { describe, expect, it } from 'vitest';
import { content as enContent } from '../../src/content/en';
import { content as itContent } from '../../src/content/it';
import { copy as enCopy } from '../../src/content/en/copy';
import { getContent } from '../../src/content';
import { AVAILABLE_LOCALES } from '../../src/i18n/locale';
import {
  emDashDensity,
  findEmDashProblems,
  findHarmTerms,
  findMissingSpecKnobs,
  findNegativeDirectionTerms,
  findPressSpoilerTerms,
  validateLocaleContent,
  type ContentLexicons,
} from './validators';

/**
 * §4's harm policy, in Italian. Matched at word-START by findHarmTerms, so
 * these are STEMS: 'vaccin' catches vaccino/vaccini/vaccinale, 'terapi' catches
 * terapia/terapie/terapeutico.
 *
 * Two deliberate divergences from a naive translation of EN's list:
 *
 *  1. 'diet' is NOT used, because `\bdiet` matches the entirely innocent
 *     Italian preposition "dietro" ("behind") and would fail the corpus on a
 *     false positive. The three precise stems below cover dieta/diete/dietetico
 *     without that collision.
 *  2. 'cura' IS used even though Italian is full of it, because the collisions
 *     turn out to be safe: findHarmTerms anchors at a word boundary, and the
 *     common near-misses ("accuratezza", "sicurezza", "burocratico") all have a
 *     word character immediately before the "cura", so no boundary exists.
 *     Verified by an explicit negative case at the bottom of this file.
 *     Residual risk accepted knowingly: "curatore"/"curare" DO start at a
 *     boundary and would fire. Neither appears in the corpus, and the §4 policy
 *     would rather stop an author writing "curare" than let a treatment claim
 *     through, so the stem stays as it is.
 *
 * Wider than EN's seven, not narrower. 'medic' (not 'medicinal') so the stem
 * catches medicina/medico/medici as well as medicinale, plus salute, clinic,
 * ospedal and guarigione: those are the words an Italian screenshot would most
 * plausibly be laundered into. Every addition was probed against all 20
 * scenarios' prose before being added and fires on nothing the corpus ships.
 */
export const IT_HARM_LEXICON = [
  'vaccin',
  'farmac',
  'cancro',
  'tumor',
  'dieta',
  'diete',
  'dietetic',
  'cura',
  'cure',
  'terapi',
  'integrator',
  'malatti',
  'sintom',
  'medic',
  'salute',
  'clinic',
  'ospedal',
  'guarigione',
];

/**
 * The one-tailed direction contract, in Italian: every outcomeLabel must read
 * so that MORE of the metric means MORE of the claimed effect, so a label
 * containing any of these is phrased as a decrease and fails.
 *
 * ASCII-only on purpose, and that constraint is about the TERMS, not about the
 * labels they are matched against. JS's `\b` (this validator runs the lexicon
 * as `\b${term}\b`, non-unicode) does not treat accented letters as word
 * characters, so a lexicon entry like "più" would anchor unpredictably around
 * the "ù" and match unreliably. Every entry below is therefore unaccented.
 *
 * That costs nothing ONLY because the list carries the unaccented head word of
 * each decrease phrase in its own right. Italian builds most comparatives
 * analytically — "più basso", "più breve", "più corto", "più lento" — so it is
 * the ADJECTIVE that has to be on the list; matching "più" would be useless
 * anyway, since it is equally the head of every INcrease phrase ("più alto",
 * "più lungo"). Hence basso/breve/corto/lento and their inflections below,
 * alongside the nouns Italian prefers where English uses a verb ("Riduzioni di
 * costo", "Cali di rendimento").
 *
 * Inflections are listed explicitly rather than stemmed because the validator
 * matches whole words: `\bridott\b` would never fire, so ridotto/ridotta/
 * ridotti/ridotte all need entries.
 */
export const IT_NEGATIVE_DIRECTION_LEXICON = [
  'meno',
  'minore',
  'minori',
  'inferiore',
  'inferiori',
  'ridotto',
  'ridotta',
  'ridotti',
  'ridotte',
  'riduzione',
  'riduzioni',
  'calo',
  'cali',
  'diminuzione',
  'perdita',
  'perdite',
  'errore',
  'errori',
  'fallimento',
  'fallimenti',
  'peggiore',
  'peggiori',
  'scarso',
  'scarsa',
  'mancato',
  'mancanza',
  'lento',
  'lenta',
  'basso',
  'bassa',
  'bassi',
  'basse',
  'breve',
  'brevi',
  'corto',
  'corta',
  'corti',
  'corte',
];

/**
 * THE SPOILER LAW's vocabulary, in Italian (T39b). Replaces the English alias
 * this file carried while the 24 T39a blurbs were still English placeholders:
 * with real Italian in the bank, "ha replicato", "ritrattato" and "smentito"
 * would have sailed past every English entry, and the guard would have been
 * green by not understanding the question.
 *
 * Matched at word-START by findPressSpoilerTerms, over blurb TEXT and OUTLET,
 * case-insensitively — which is what lets a single lowercase stem also catch a
 * shouting tier-3 chyron.
 *
 * STEMS, chosen for how Italian inflects:
 *
 *  - 'replic' rather than 'replicat', because Italian nominalises the verdict
 *    ("la replica non è riuscita", "una replicazione indipendente") far more
 *    readily than English does, and 'replicat' would miss "replicazione"
 *    entirely (replica-Z-ione).
 *  - 'smenti' rather than 'smentit', so it reaches the present tense
 *    ("smentisce") as well as the participle.
 *  - Single-word stems for confut/scredit/sbugiardat/smontat/ribaltat: the
 *    five ways an Italian newsroom says a claim has been taken apart.
 *
 * PHRASES, where Italian carries the verdict analytically and no single stem
 * would do: 'falso positivo'/'falsi positivi', 'risultato nullo'/'risultati
 * nulli', 'effetto nullo', 'nessun effetto', 'effetto reale'/'effetto vero',
 * 'sempre zero'. Both numbers are listed because `\b`-anchored matching is
 * literal and Italian agreement changes the ending of every word in the noun
 * phrase, not just the head.
 *
 * FOUR DELIBERATE EXCLUSIONS. The first is MEASURED: 'conferm' fires on two
 * blurbs this bank ships today, so a lexicon carrying it would fail on approved
 * content. The other three are prospective — nothing in the corpus trips them
 * yet, and each is the collision the LANGUAGE invites rather than one already
 * present, which is why each has an explicit negative case at the bottom of
 * this file rather than a promise in a comment:
 *
 *  1. 'conferm' (2 hits today). The carve-out the English lexicon documents,
 *     for the same reason: "Gli scienziati hanno finalmente confermato quello che il tuo
 *     gruppo WhatsApp sospettava da sempre" is Act I credulity about the paper
 *     the PLAYER just published, not a claim about the game's ground truth. A
 *     lexicon that could not tell those apart would ban the bank's best joke to
 *     catch nothing.
 *  2. 'casual'/'a caso'. This is RANDOMISATION vocabulary in Italian
 *     ("assegnati a caso", "campione casuale"), i.e. method, which the spoiler
 *     law explicitly permits. 'fortuit' covers the fluke sense ("caso
 *     fortuito") without colliding with it.
 *  3. 'ha tenuto'. The obvious rendering of EN's 'held up' — and unusable,
 *     because `tenere` is Italian's ordinary verb for KEEPING something: the
 *     fern scenario's own treatment is "Tiene una felce sulla scrivania", so a
 *     blurb saying a buyer "ha tenuto la felce per un intero ciclo" would trip
 *     a verdict guard on a sentence about a plant. 'ha retto' and 'non regge'
 *     carry the same verdict with no such collision.
 *  4. 'ritir' (the broad stem). Narrowed to the participle 'ritirat', because
 *     "il ritiro"/"ritirare" are what a marathon runner does — and this bank
 *     covers a marathon. Residual risk accepted and stated: "i due partecipanti
 *     si sono ritirati" WOULD fire. Nothing in the corpus says it, and §4's
 *     posture is that the guard would rather stop an author writing that than
 *     let "lo studio è stato ritirato" through.
 */
export const IT_PRESS_SPOILER_LEXICON = [
  'replic',
  'ritratt',
  'ritirat',
  'smenti',
  'confut',
  'scredit',
  'sbugiardat',
  'smontat',
  'ribaltat',
  'bufal',
  'frod',
  'fake',
  'fortuit',
  'p-hack',
  'falso positivo',
  'falsi positivi',
  'risultato nullo',
  'risultati nulli',
  'effetto nullo',
  'nessun effetto',
  'effetto reale',
  'effetto vero',
  'sempre zero',
  'ha retto',
  'non regge',
];

export const IT_LEXICONS: ContentLexicons = {
  harmTerms: IT_HARM_LEXICON,
  directionTerms: IT_NEGATIVE_DIRECTION_LEXICON,
  pressSpoilerTerms: IT_PRESS_SPOILER_LEXICON,
};

const enIds = enContent.scenarios.map((s) => s.id);

/**
 * The English number, in the forms the SUPERSTITION takes in Italian: as a
 * numeral behind the article or behind "numero", and spelled out. Italian
 * relocated thirteen-mortgage to 17 (eptacaidecafobia), so none of these may
 * appear in the Italian press bank. See the guards-the-guard test below for
 * why this is not a bare /13/.
 */
const UNLUCKY_THIRTEEN = /\b(?:numero|il|del|al) 13\b|\btredici\b/i;

describe('Italian locale content', () => {
  it('passes the shared validator against the English scenario ids and order', () => {
    expect(validateLocaleContent(itContent, IT_LEXICONS, enIds)).toEqual([]);
  });

  it('ships the same number of scenarios as English', () => {
    expect(itContent.scenarios.length).toBe(enContent.scenarios.length);
  });

  it('ships the same scenario ids, in the same order', () => {
    expect(itContent.scenarios.map((s) => s.id)).toEqual(enIds);
  });

  it('carries identical journalTags per scenario (the journal pool is shared and English)', () => {
    for (const [i, itScenario] of itContent.scenarios.entries()) {
      expect(itScenario.journalTags).toEqual(enContent.scenarios[i].journalTags);
    }
  });

  it('keeps every scenario prose field non-empty and actually translated', () => {
    for (const [i, s] of itContent.scenarios.entries()) {
      const en = enContent.scenarios[i];
      expect(s.question.trim().length).toBeGreaterThan(0);
      expect(s.coverStory.trim().length).toBeGreaterThan(0);
      expect(s.treatmentLabel.trim().length).toBeGreaterThan(0);
      expect(s.headline.trim().length).toBeGreaterThan(0);
      // Not a byte-for-byte inequality on every field (a few short labels can
      // legitimately coincide); the cover story is the long-form paragraph
      // where an untranslated copy-paste would actually hide.
      expect(s.coverStory).not.toBe(en.coverStory);
      expect(s.question).not.toBe(en.question);
    }
  });

  it('preserves each headline\'s {effect} token count, so the same headlines carry a number', () => {
    for (const [i, s] of itContent.scenarios.entries()) {
      const itTokens = s.headline.match(/\{effect\}/g)?.length ?? 0;
      const enTokens = enContent.scenarios[i].headline.match(/\{effect\}/g)?.length ?? 0;
      expect(itTokens).toBe(enTokens);
    }
  });

  it('ships at least as many grantwell emails, press blurbs, sublines and glossary entries as English', () => {
    expect(itContent.grantwell.length).toBe(enContent.grantwell.length);
    expect(itContent.grantwellSubjects.length).toBe(enContent.grantwellSubjects.length);
    expect(itContent.press.length).toBe(enContent.press.length);
    expect(itContent.retractionSublines.length).toBe(enContent.retractionSublines.length);
    expect(itContent.nullReportedSublines.length).toBe(enContent.nullReportedSublines.length);
    expect(itContent.glossary.length).toBe(enContent.glossary.length);
  });

  it('writes both new banks in Italian, not in English (gr6-070, gr6-037)', () => {
    // Same shape as the press-alias check above: structural parity is a law of
    // this suite, so an untranslated bank would ship shaped correctly and read
    // as English. 'Re: Re: Reviewer 2' is the ONE line allowed to coincide —
    // Reviewer 2 stays Reviewer 2 in this locale by its own contract, and the
    // mail client's "Re:" is not Italian to begin with.
    const SHARED_WITH_EN = ['Re: Re: Reviewer 2'];
    const aliasedSubjects = itContent.grantwellSubjects.flatMap((s, i) =>
      s === enContent.grantwellSubjects[i] && !SHARED_WITH_EN.includes(s) ? [i] : []
    );
    expect(aliasedSubjects).toEqual([]);
    const aliasedSublines = itContent.nullReportedSublines.flatMap((s, i) =>
      s === enContent.nullReportedSublines[i] ? [i] : []
    );
    expect(aliasedSublines).toEqual([]);
  });

  it('keeps press tiers and scenario bindings identical to English, index by index', () => {
    for (const [i, blurb] of itContent.press.entries()) {
      const en = enContent.press[i];
      expect(blurb.tier).toBe(en.tier);
      expect(blurb.scenarioIds ?? null).toEqual(en.scenarioIds ?? null);
    }
  });

  /**
   * T39a's DECLARED TRANSCREATION DEBT, now PAID (T39b), and the same test
   * standing guard over the fact.
   *
   * T39a added 24 scenario-bound blurbs to the English bank and, because
   * structural press parity is a law of this suite (identical counts, tiers and
   * scenarioIds index by index), shipped the Italian entries immediately with
   * their mastheads mapped and their `text` still English. This test pinned
   * that set of 24 indices so the debt was DATA rather than a comment anyone
   * could forget, and it failed in BOTH directions: translate one without
   * shortening the list -> fail; add a 25th English-aliased blurb -> fail.
   *
   * T39b transcreated all 24, so the list is EMPTY, and the assertion has
   * turned into the permanent one it was always designed to become: no Italian
   * press blurb may ever again be byte-identical to its English counterpart.
   * The list only ever shrank, and there is nothing left in it to shrink.
   */
  it('leaves no press blurb in English: every Italian text differs from its English counterpart', () => {
    const aliased = itContent.press.flatMap((blurb, i) => (blurb.text === enContent.press[i].text ? [i] : []));
    expect(aliased).toEqual([]);
  });

  it('keeps the outlet mastheads Italian too, not only the blurb text', () => {
    for (const [i, blurb] of itContent.press.entries()) {
      expect(blurb.outlet, `press[${i}] outlet`).not.toBe(enContent.press[i].outlet);
    }
  });

  /**
   * T39b's own coverage check on the transcreation: a blurb that named the
   * ENGLISH scenario's furniture would pass every mechanical guard in this file
   * and still read as a translation. These are the three places where the
   * Italian scenarios diverge hardest from their English sources, so they are
   * the three the press has to follow.
   */
  it('reuses the ITALIAN scenarios\' furniture, not the English source\'s', () => {
    const texts = itContent.press.map((p) => p.text).join(' ');
    // thirteen-mortgage relocates the superstition to 17 (eptacaidecafobia).
    expect(texts).toContain('eptacaidecafobia');
    expect(texts).not.toMatch(UNLUCKY_THIRTEEN);
    // standing-desk-poetry's cover story promises the endecasillabo.
    expect(texts).toContain('ENDECASILLABO');
    // cafe-peer-review happens at the bar, so the pastry is a cornetto.
    expect(texts).toContain('CORNETTO');
  });

  /**
   * Fix round 1 [Minor 6]. `/\bnumero 13\b/` was too narrow to be a guard: it
   * matched one phrasing of the relocated superstition and missed the two an
   * author is at least as likely to write, so a blurb saying "chi evita il 13"
   * would have shipped English's number under an Italian sentence.
   *
   * Scoped to the PRESS BANK (the test above joins press texts and nothing
   * else) and deliberately NOT a bare /13/: this locale's press may one day
   * legitimately count to thirteen about something that is not a mortgage
   * (13 minuti, 13 città), and a guard that forbids a numeral outright would
   * be banning arithmetic to catch a superstition. The three forms below are
   * the ones the SUPERSTITION takes.
   */
  it('guards the guard: the 13-detector catches the phrasings, and spares an unrelated numeral', () => {
    for (const bad of ['Chi evita il 13 spunta mutui migliori.', 'La paura del numero 13 vale un mutuo.', 'Tredici piani saltati.']) {
      expect(bad, `should be caught: "${bad}"`).toMatch(UNLUCKY_THIRTEEN);
    }
    for (const ok of ['Diciotto mesi di dati e 13 città coinvolte.', 'Le 13 riunioni sono durate 340 minuti.']) {
      expect(ok, `should NOT be caught: "${ok}"`).not.toMatch(UNLUCKY_THIRTEEN);
    }
  });

  it('translates every achievement, under the same ids', () => {
    expect(Object.keys(itContent.achievements).sort()).toEqual(Object.keys(enContent.achievements).sort());
    for (const [id, achievement] of Object.entries(itContent.achievements)) {
      expect(achievement.name.trim().length).toBeGreaterThan(0);
      expect(achievement.citation.trim().length).toBeGreaterThan(0);
      expect(`${id}: ${achievement.citation}`).not.toBe(
        `${id}: ${enContent.achievements[id as keyof typeof enContent.achievements].citation}`
      );
    }
  });

  it('translates the whole copy catalog: same keys as English, none left in English prose', () => {
    expect(Object.keys(itContent.copy).sort()).toEqual(Object.keys(enCopy).sort());

    // Values that are legitimately identical across locales: notation, tokens,
    // proper nouns, and symbols. Everything else must differ from English.
    const SHARED_WITH_EN = new Set([
      'nav.title',
      // T33: endonyms. A language's name in its OWN language is the same
      // string whatever language the interface is in — "Italiano" is
      // "Italiano" on the English build too — so these three are proper
      // nouns in the 'nav.title' sense, not prose left untranslated.
      'nav.localeNameEn',
      'nav.localeNameIt',
      'nav.localeNameEs',
      // T37: 'briefing.openData' used to sit here. It was not a proper noun in
      // the 'nav.title' sense at all -- it was the app's primary CTA, left in
      // English because the source comment mistook it for the journal badge,
      // and this allow-list entry was that bug institutionalised as a fixture.
      // The Italian value is now 'Apri i dati', so the entry is gone.
      'briefing.emailFrom',
      'lab.nLabel',
      'lab.covariatesBoth',
      // gr6-086 / final-011: 'lab.exclusionNone' used to sit here and was
      // STALE — the Italian value is 'Nessuna', so the entry excused a key
      // that had never needed excusing. A stale allow-list member is invisible
      // (it only ever suppresses a failure that is not happening) and it
      // teaches the next reader that the key is untranslatable, which is how
      // a real English leak would eventually be waved through.
      'lab.exclusionZ3',
      'lab.exclusionZ2_5',
      'lab.exclusionZ2',
      'lab.transformLog1p',
      'lab.pEquals',
      'lab.pBelow',
      'lab.dfLabel',
      'published.doiPrefix',
      'reveal.pValue',
      'reveal.pValueTiny',
      'reveal.exclusionZ3',
      'reveal.exclusionZ25',
      'reveal.exclusionZ2',
      'reveal.transformLog',
      'reveal.fig1',
      'reveal.fig2',
      'legend.significant',
      'stats.noData',
    ]);

    const untranslated = Object.keys(enCopy).filter(
      (k) =>
        !SHARED_WITH_EN.has(k) &&
        itContent.copy[k as keyof typeof itContent.copy] === enCopy[k as keyof typeof enCopy]
    );
    expect(untranslated).toEqual([]);
  });

  // gr6-086 / gr1b-024: the old name of this test ASSERTED A FALSEHOOD.
  // `t()` (src/i18n/t.ts:33) substitutes with `/\{(\w+)\}/g` — global — so it
  // replaces every occurrence, and a repeated token would render the value
  // twice rather than leaving a raw `{token}` on screen. The rule survives on
  // two grounds that are true, and the file header states both: several call
  // sites interpolate with a LITERAL String.replace and do only the first
  // (SpecCurve.tsx:212, published.ts:97, the UI suites' line-builders), and
  // the token-parity test below compares SETS, so a duplicate in one locale
  // and not the other is invisible to it. This test is what makes that set
  // comparison sufficient.
  it('never repeats an interpolation token within one copy string (the parity check below compares sets)', () => {
    for (const [key, value] of Object.entries(itContent.copy)) {
      const tokens = value.match(/\{(\w+)\}/g) ?? [];
      expect(`${key}: ${tokens.join(',')}`).toBe(`${key}: ${[...new Set(tokens)].join(',')}`);
    }
  });

  it('uses exactly the same interpolation tokens as English in every copy value', () => {
    for (const key of Object.keys(enCopy) as (keyof typeof enCopy)[]) {
      const tokensOf = (s: string) => [...new Set(s.match(/\{(\w+)\}/g) ?? [])].sort();
      expect(`${key}: ${tokensOf(itContent.copy[key]).join(',')}`).toBe(`${key}: ${tokensOf(enCopy[key]).join(',')}`);
    }
  });

  it('keeps the decimal POINT in statistical notation, as about.decimalNote itself promises', () => {
    // The note is translated; the notation inside it is not.
    expect(itContent.copy['about.decimalNote']).toContain('p = 0.049');
    expect(itContent.copy['lab.pBelow']).toBe('p < 0.001');
    expect(itContent.copy['reveal.pValueTiny']).toBe('p < 0.001');
    expect(itContent.copy['briefing.goal']).toContain('0.05');
    // No Italian comma-decimal anywhere in the catalog.
    const commaDecimals = Object.entries(itContent.copy).filter(([, v]) => /\d,\d/.test(v));
    expect(commaDecimals).toEqual([]);
  });

  it('keeps Prof. Grantwell named Prof. Grantwell', () => {
    expect(itContent.copy['briefing.emailFrom']).toContain('Grantwell');
    expect(itContent.retractionSublines.some((s) => s.includes('Grantwell'))).toBe(true);
  });

  it('keeps Reviewer 2 as Reviewer 2 in the Grantwell bank', () => {
    expect(itContent.grantwell.some((g) => g.includes('Reviewer 2'))).toBe(true);
  });

  it('never names a scenario subject in the scenario-agnostic Grantwell bank', () => {
    // The bank rotates across all 20 scenarios, so nothing in it may name a
    // cat, a fern or a marathon (the EN authoring rule, carried over).
    for (const g of itContent.grantwell) {
      expect(/\b(gatt|felc|marat|vinil|calzin|telescop)/i.test(g)).toBe(false);
    }
  });
});

describe('Italian harm check (§4)', () => {
  it('finds no banned medical term anywhere in the Italian scenarios', () => {
    expect(findHarmTerms(itContent, IT_HARM_LEXICON)).toEqual([]);
  });

  it('still catches a banned Italian term, including as a derivative', () => {
    const [first] = itContent.scenarios;
    const broken = {
      ...itContent,
      scenarios: [
        { ...first, coverStory: 'I partecipanti hanno dichiarato le loro abitudini dietetiche.' },
        ...itContent.scenarios.slice(1),
      ],
    };
    expect(findHarmTerms(broken, IT_HARM_LEXICON).some((p) => p.includes('dietetic'))).toBe(true);
  });

  // Fix round 1: the hardened stems. 'medic' replaced 'medicinal' precisely so
  // the first three of these are caught, not only the fourth.
  it.each([
    'Uno studente di medicina ha raccolto i dati.',
    'Il medico di base ha firmato il consenso.',
    'I partecipanti hanno riportato benefici per la salute.',
    'Il protocollo è stato approvato in ambito clinico.',
    'I dati vengono dal reparto ospedaliero.',
    'Nessuna guarigione è stata osservata.',
  ])('catches the hardened harm stem in "%s"', (coverStory) => {
    const [first] = itContent.scenarios;
    const broken = { ...itContent, scenarios: [{ ...first, coverStory }, ...itContent.scenarios.slice(1)] };
    expect(findHarmTerms(broken, IT_HARM_LEXICON).length).toBeGreaterThan(0);
  });

  it('does not false-positive on innocent Italian words that merely contain a stem', () => {
    const [first] = itContent.scenarios;
    const ok = {
      ...itContent,
      scenarios: [
        {
          ...first,
          // "accuratezza"/"sicurezza" embed "cura"/"cure" with no word boundary;
          // "dietro" is the reason 'diet' is not on the lexicon at all.
          coverStory: "L'accuratezza e la sicurezza del protocollo sono state verificate dietro le quinte.",
        },
        ...itContent.scenarios.slice(1),
      ],
    };
    expect(findHarmTerms(ok, IT_HARM_LEXICON)).toEqual([]);
  });
});

describe('Italian one-tailed direction contract', () => {
  it('phrases every Italian outcome so that more of the metric = the claimed effect', () => {
    expect(findNegativeDirectionTerms(itContent, IT_NEGATIVE_DIRECTION_LEXICON)).toEqual([]);
  });

  // Regression pin (T19 review, fix round 1): the lexicon originally carried
  // only the verb-ish decrease words, so the ADJECTIVAL comparatives Italian
  // actually builds ("più basso", "più breve", "più corto") and the nominal
  // forms ("Riduzioni di...", "Cali di...") walked straight through the guard.
  // Every phrasing below is a label a well-meaning author could plausibly
  // write; each must be caught.
  it.each([
    'Tempo più basso di ricerca',
    'Spese ridotte del reparto',
    'Riduzioni di costo',
    'Cali di rendimento',
    'Attesa più breve alla cassa',
    'Percorso più corto verso il gate',
    'Coda più bassa del reparto',
    'Tempi di risposta brevi',
  ])('catches the decrease-phrased label "%s"', (label) => {
    const [first] = itContent.scenarios;
    const broken = {
      ...itContent,
      scenarios: [
        { ...first, outcomeLabels: [label, ...first.outcomeLabels.slice(1)] as [string, string, string, string] },
        ...itContent.scenarios.slice(1),
      ],
    };
    expect(findNegativeDirectionTerms(broken, IT_NEGATIVE_DIRECTION_LEXICON).length).toBeGreaterThan(0);
  });

  it('catches an Italian outcome phrased as a decrease', () => {
    const [first] = itContent.scenarios;
    const broken = {
      ...itContent,
      scenarios: [
        {
          ...first,
          outcomeLabels: ['Riduzione della spesa settimanale', ...first.outcomeLabels.slice(1)] as [
            string,
            string,
            string,
            string,
          ],
        },
        ...itContent.scenarios.slice(1),
      ],
    };
    expect(
      findNegativeDirectionTerms(broken, IT_NEGATIVE_DIRECTION_LEXICON).some((p) => p.includes('riduzione'))
    ).toBe(true);
  });

  it('does not trip on Italian words that merely contain a lexicon term', () => {
    const [first] = itContent.scenarios;
    const ok = {
      ...itContent,
      scenarios: [
        {
          ...first,
          outcomeLabels: ['Almeno un rilancio', 'Talento riconosciuto', 'Consensi/mese', 'Serenita'] as [
            string,
            string,
            string,
            string,
          ],
        },
      ],
    };
    expect(findNegativeDirectionTerms(ok, IT_NEGATIVE_DIRECTION_LEXICON)).toEqual([]);
  });
});

describe('Italian press spoiler law (T39a\'s law, scanned in Italian since T39b)', () => {
  it('asserts no verdict anywhere in the Italian bank, bespoke or generic', () => {
    expect(findPressSpoilerTerms(itContent, IT_PRESS_SPOILER_LEXICON)).toEqual([]);
  });

  // Every line below is one an Italian writer could plausibly reach for on a
  // day the effect happens to be real, and every one of them would hand the
  // player the verdict one screen early. Each must be caught.
  it.each([
    'Lo studio ha replicato in tre laboratori indipendenti.',
    'Una replicazione indipendente è già in corso.',
    "L'articolo è stato ritrattato ieri sera.",
    'Lo studio è stato ritirato dalla rivista.',
    'La tesi è stata smentita in poche ore.',
    'I dati smentiscono gli autori.',
    "L'ipotesi è stata confutata da un gruppo rivale.",
    'Il risultato è stato screditato dagli esperti.',
    'Gli autori sono stati sbugiardati dai numeri.',
    'La tesi è stata smontata pezzo per pezzo.',
    'Il verdetto è stato ribaltato in appello statistico.',
    'Per gli esperti si tratta di una bufala.',
    'Si parla apertamente di frode.',
    'Gli esperti lo chiamano fake news.',
    'Un caso fortuito, dicono ora i critici.',
    'Un esempio da manuale di p-hacking.',
    'Era un falso positivo.',
    'Sono falsi positivi, sostengono i critici.',
    'Un risultato nullo, alla fine.',
    'Erano risultati nulli.',
    'Effetto nullo, dicono gli autori.',
    'Nessun effetto è stato osservato.',
    "L'effetto reale era un altro.",
    "L'effetto vero non c'era.",
    'Era sempre zero, e lo sapevano.',
    "L'ipotesi non ha retto alla verifica.",
    'La conclusione non regge.',
  ])('catches the Italian verdict in "%s"', (text) => {
    const broken = { ...itContent, press: [{ ...itContent.press[1], text }, ...itContent.press.slice(1)] };
    expect(findPressSpoilerTerms(broken, IT_PRESS_SPOILER_LEXICON).length).toBeGreaterThan(0);
  });

  // The four documented exclusions, asserted rather than only described. Each
  // of these sentences is Act I credulity or plain method vocabulary, and a
  // lexicon that fired on any of them would be banning the bank's own material.
  it.each([
    'Gli scienziati hanno finalmente confermato quello che sospettavi.',
    'I partecipanti sono stati assegnati a caso ai due gruppi.',
    'Il campione casuale copre tre città.',
    'Ogni responsabile acquisti ha tenuto la felce per un intero ciclo di gare.',
    'Il maratoneta si ritira sempre al trentesimo chilometro.',
  ])('does not fire on the permitted register in "%s"', (text) => {
    const ok = { ...itContent, press: [{ ...itContent.press[1], text }, ...itContent.press.slice(1)] };
    expect(findPressSpoilerTerms(ok, IT_PRESS_SPOILER_LEXICON)).toEqual([]);
  });

  it('is wired into the validator through IT_LEXICONS, not only into this block', () => {
    const broken = {
      ...itContent,
      press: [{ ...itContent.press[1], text: 'Lo studio è stato ritrattato.' }, ...itContent.press.slice(1)],
    };
    expect(validateLocaleContent(broken, IT_LEXICONS, enIds).some((p) => p.includes('asserts a verdict'))).toBe(true);
  });
});

describe('Italian em-dash budget (inherited, not opted into)', () => {
  it('keeps every Italian value at one em dash or fewer', () => {
    expect(findEmDashProblems(itContent).filter((p) => p.includes('em dashes'))).toEqual([]);
  });

  it('keeps the Italian corpus above the corpus-wide characters-per-dash floor', () => {
    const { charsPerDash } = emDashDensity(itContent);
    expect(charsPerDash).toBeGreaterThanOrEqual(2500);
  });

  it('does not lean on the lineetta any harder than the English corpus does', () => {
    // Italian typography reaches for the dash more readily than English; the
    // point of writing the prose natively is that it does not need to.
    expect(emDashDensity(itContent).dashes).toBeLessThanOrEqual(emDashDensity(enContent).dashes);
  });
});

describe("Italian is wired into the app's locale plumbing", () => {
  it('is offered in the language toggle', () => {
    expect(AVAILABLE_LOCALES).toContain('it');
  });

  it('is served by getContent as real Italian, not an alias of the English module', async () => {
    const loaded = await getContent('it');
    expect(loaded).toBe(itContent);
    expect(loaded).not.toBe(enContent);
    expect(loaded.copy['nav.tagline']).not.toBe(enCopy['nav.tagline']);
  });
});

describe('T33 — Italian spec legend mirrors the six-knob enumeration', () => {
  it('names every knob, in Italian, using the Italian Lab labels', () => {
    expect(findMissingSpecKnobs(itContent)).toEqual([]);
  });
});
