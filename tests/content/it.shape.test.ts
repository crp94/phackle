// T19 — the ITALIAN locale's parity suite.
//
// The English suite (./shape.test.ts) owns the *validator*; this file owns the
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
  findNegativeDirectionTerms,
  validateLocaleContent,
  type ContentLexicons,
} from './shape.test';

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
 *
 * Wider than EN's seven, not narrower: tumore/malattia/sintomo/medicinale are
 * the terms an Italian screenshot would most plausibly be laundered into.
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
  'medicinal',
];

/**
 * The one-tailed direction contract, in Italian: every outcomeLabel must read
 * so that MORE of the metric means MORE of the claimed effect, so a label
 * containing any of these is phrased as a decrease and fails.
 *
 * ASCII-only on purpose. JS's `\b` (this validator runs the lexicon as
 * `\b${term}\b`, non-unicode) does not treat accented letters as word
 * characters, so a term like "più" would anchor unpredictably around the "ù".
 * Every word below is therefore unaccented, which costs nothing: the accented
 * Italian decrease-words ("più basso", "peggiorò") all contain an unaccented
 * head word that is already on the list.
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
  'riduzione',
  'calo',
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
];

export const IT_LEXICONS: ContentLexicons = {
  harmTerms: IT_HARM_LEXICON,
  directionTerms: IT_NEGATIVE_DIRECTION_LEXICON,
};

const enIds = enContent.scenarios.map((s) => s.id);

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
    expect(itContent.press.length).toBe(enContent.press.length);
    expect(itContent.retractionSublines.length).toBe(enContent.retractionSublines.length);
    expect(itContent.glossary.length).toBe(enContent.glossary.length);
  });

  it('keeps press tiers and scenario bindings identical to English, index by index', () => {
    for (const [i, blurb] of itContent.press.entries()) {
      const en = enContent.press[i];
      expect(blurb.tier).toBe(en.tier);
      expect(blurb.scenarioIds ?? null).toEqual(en.scenarioIds ?? null);
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
      'briefing.openData',
      'briefing.emailFrom',
      'lab.nLabel',
      'lab.covariatesBoth',
      'lab.exclusionNone',
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

  it('never repeats an interpolation token within one copy string (t() replaces the first occurrence only)', () => {
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
