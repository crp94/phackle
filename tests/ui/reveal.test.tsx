// @vitest-environment jsdom
//
// T16: THE REVEAL — Act II (master spec §2.7, §7.3 "Reveal", DESIGN.md §5/§8).
// The deadpan accounting: six blocks, in the order §2.7 pins, with every
// number read off the RevealPayload and nothing invented on the way.
import { describe, expect, it, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { copy } from '../../src/content/en/copy';
import { copy as itCopy } from '../../src/content/it/copy';
import { copy as esCopy } from '../../src/content/es/copy';
import { content as en } from '../../src/content/en';
import { t } from '../../src/i18n/t';
import { useGameStore, type GameStore } from '../../src/game/store';
import type { EngineClient, RevealPayload } from '../../src/engine/protocol';
import type { RevealCurveEntry } from '../../src/engine/reveal';
import type { Outcome, PathResult, Spec } from '../../src/engine/types';
import { Reveal, formatSigFigs, type RevealPayloadFull } from '../../src/ui/screens/Reveal';
import { ScreenRouter } from '../../src/ui/ScreenRouter';
import { recipeLabel } from '../../src/ui/charts/SpecCurve';

afterEach(cleanup);

const ISO = '2026-09-01';
const SCENARIO = en.scenarios[0];

const SPEC: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function curveEntry(p: number, over: Partial<RevealCurveEntry> = {}): RevealCurveEntry {
  return { p, explored: false, published: false, outcome: 0 as Outcome, spec: SPEC, ...over };
}

/** §2.7.3's own worked example: 1,792 paths, 87 significant (4.9%), k = 14, ~52%.
 *
 * Typed `RevealPayloadFull` (gr6-001): the two day-typed hit counts ride the
 * same widening as `curve` — protocol.ts spreads `buildRevealMetrics`'s return
 * verbatim, so they are on the wire object even though §6's narrower
 * `RevealMetrics` does not declare them. See Reveal.tsx's own note. */
function payload(over: Partial<RevealPayloadFull> = {}): RevealPayloadFull {
  return {
    totalPaths: 1792,
    sigPaths: 87,
    sigFraction: 87 / 1792,
    sigTrueOutcome: 0,
    sigOtherOutcome: 87,
    playerExplored: 14,
    pHitAtK: 0.52,
    curve: [
      curveEntry(0.01, { explored: true, published: true }),
      curveEntry(0.2, { explored: true, outcome: 1, spec: { ...SPEC, outcome: 1 } }),
      curveEntry(0.6, { outcome: 2, spec: { ...SPEC, outcome: 2 } }),
      curveEntry(0.9, { outcome: 3, spec: { ...SPEC, outcome: 3 } }),
    ],
    stamp: 'RETRACTED',
    peeks: 0,
    dayType: 'null',
    trueOutcome: null,
    trueBeta: 0,
    hetero: null,
    capExhausted: false, // gr6-102 (W5): required field on RevealPayload
    ...over,
  };
}

function result(p: number): PathResult {
  return { spec: SPEC, n: 200, beta: 0.4, se: 0.1, t: 4, p, ci: [0.2, 0.6], excludedCount: 0, valid: true };
}

function fakeClient(revealPayload: RevealPayload) {
  const client: EngineClient = {
    init: async () => ({ scenarioIndex: 0, n: 200 }),
    runSpec: async () => result(0.01),
    extend: async () => ({ n: 250 }),
    reveal: async () => revealPayload,
    onCrash: () => {},
  };
  return client;
}

/**
 * Captures the live store so a test can drive the app's REAL flow (boot ->
 * lab -> publish/abandon -> call) rather than hand-assembling state. Written
 * from an effect, not from render: reassigning an outer binding during render
 * is a side effect, and every driver below awaits `act`, which flushes
 * effects before it returns.
 */
const harness: { store: GameStore | null } = { store: null };
function Capture() {
  const store = useGameStore((s) => s);
  useEffect(() => {
    harness.store = store;
  }, [store]);
  return null;
}
const live = () => harness.store as GameStore;

async function mountReveal(
  over: Partial<RevealPayloadFull> = {},
  // gr6-021 adds `iso`/`practice`: the day the store BOOTS with is what
  // decides `puzzleNumber` (and therefore which subline the §4.5 banks
  // rotate to), and a pre-EPOCH date makes that number negative. Both
  // default to what every existing caller already got.
  opts: { path?: 'abandon' | 'submit'; call?: 'real' | 'noise'; iso?: string; practice?: boolean } = {}
) {
  const p = payload(over);
  const view = render(
    <LocaleProvider>
      <Capture />
      <Reveal />
    </LocaleProvider>
  );
  await act(async () => {
    await live().boot(fakeClient(p), opts.iso ?? ISO, {
      practice: opts.practice ?? false,
      mode: 'hack',
      scenarioCount: 20,
    });
  });
  act(() => live().openData());
  await act(async () => {
    if ((opts.path ?? 'submit') === 'abandon') await live().abandon();
    else await live().submit();
  });
  await act(async () => {
    await live().makeCall(opts.call ?? 'noise');
  });
  await waitFor(() => expect(view.container.querySelector('[data-block="truth"]')).not.toBeNull());
  return view;
}

function blocks(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block') as string);
}

function blockText(container: HTMLElement, name: string): string {
  return container.querySelector(`[data-block="${name}"]`)?.textContent ?? '';
}

/** The longest token-free run of a copy template — the part that is present
 * verbatim whatever the params are, so presence/absence can be asserted on it. */
function literalRun(key: 'reveal.omittedFootnote' | 'reveal.peekSurcharge'): string {
  return copy[key].split(/\{\w+\}/).reduce((longest, run) => (run.length > longest.length ? run : longest), '');
}

/** Every token-free run of a template that is long enough to be distinctive.
 * Absence has to be asserted on ALL of them: the day-typed accounting variants
 * share their opening ("Of {total} possible analyses, ..."), so checking only
 * the longest run would let the wrong variant through on a shared prefix. */
function literalRuns(key: keyof typeof copy): string[] {
  return copy[key]
    .split(/\{\w+\}/)
    .map((run) => run.trim())
    .filter((run) => run.length >= 20);
}

describe('§2.7 sequence — the six blocks, in order', () => {
  it('renders truth → fig.1 → accounting → stamp → call → fig.2 in DOM order', async () => {
    const { container } = await mountReveal();
    expect(blocks(container)).toEqual(['truth', 'fig1', 'accounting', 'stamp', 'call', 'fig2']);
  });

  it('shows the grouped view on null days too — the lesson is the same one', async () => {
    const { container } = await mountReveal({ dayType: 'null' });
    expect(blocks(container)).toContain('fig2');
    expect(blockText(container, 'fig2')).toContain(copy['reveal.groupedCaption']);
  });

  it('renders nothing at all before the call has been made', async () => {
    const view = render(
      <LocaleProvider>
        <Capture />
        <Reveal />
      </LocaleProvider>
    );
    await act(async () => {
      await live().boot(fakeClient(payload()), ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    await waitFor(() => expect(live().screen).toBe('briefing'));
    expect(view.container.querySelectorAll('[data-block]').length).toBe(0);
  });
});

describe('§2.7.1 truth line', () => {
  it('reads exactly 0.000 on a null day, and names no outcome', async () => {
    const { container } = await mountReveal({ dayType: 'null', trueOutcome: null, trueBeta: 0 });
    const text = blockText(container, 'truth');
    expect(text).toBe(t(copy, 'reveal.truthNull', { beta: '0.000' }));
    expect(text).toContain('0.000');
    for (const label of SCENARIO.outcomeLabels) expect(text).not.toContain(label);
  });

  it.each([
    [0 as Outcome, 0.35302505470791234, '0.35'],
    [1 as Outcome, 0.18449156934268998, '0.18'],
    [2 as Outcome, 0.36806488973500184, '0.37'],
    [3 as Outcome, 0.1342642302798355, '0.13'],
  ])('names only outcome %i and prints its raw-unit beta to 2 significant figures', async (outcome, beta, shown) => {
    const { container } = await mountReveal({ dayType: 'effect', trueOutcome: outcome, trueBeta: beta });
    const text = blockText(container, 'truth');
    expect(text).toBe(
      t(copy, 'reveal.truthEffect', {
        outcome: SCENARIO.outcomeLabels[outcome],
        unit: SCENARIO.outcomeUnits[outcome],
        beta: shown,
      })
    );
    expect(text).toContain(shown);
    expect(text).toContain(SCENARIO.outcomeUnits[outcome]);
    for (const [i, label] of SCENARIO.outcomeLabels.entries()) {
      if (i !== outcome) expect(text).not.toContain(label);
    }
  });

  it('formats to 2 significant figures without exponents, at every magnitude', () => {
    expect(formatSigFigs(0.35302505, 2)).toBe('0.35');
    expect(formatSigFigs(1.42, 2)).toBe('1.4');
    expect(formatSigFigs(14.27, 2)).toBe('14');
    expect(formatSigFigs(1423, 2)).toBe('1400');
    expect(formatSigFigs(0.00432, 2)).toBe('0.0043');
    // gr6-074: U+2212 MINUS SIGN, not U+002D HYPHEN-MINUS — same two
    // significant figures, a typeset sign. Escaped so no look-alike passes.
    expect(formatSigFigs(-0.351, 2)).toBe('\u22120.35');
    expect(formatSigFigs(-0.351, 2)).not.toContain('-');
    expect(formatSigFigs(0, 2)).toBe('0.0');
  });
});

describe('§2.7.3 the accounting', () => {
  it('interpolates the payload exactly, with locale-invariant decimals', async () => {
    const { container } = await mountReveal();
    const text = blockText(container, 'accounting');
    expect(text).toContain(t(copy, 'reveal.accounting1', { total: '1792', sig: '87', sigPct: '4.9' }));
    expect(text).toContain(t(copy, 'reveal.accounting2', { k: '14' }));
    expect(text).toContain(t(copy, 'reveal.accounting3', { k: '14', pHitPct: '52' }));
  });

  it('never prints a thousands separator that reads as a decimal comma abroad', async () => {
    const { container } = await mountReveal();
    expect(blockText(container, 'accounting')).toContain('1792');
    expect(blockText(container, 'accounting')).not.toContain('1,792');
  });

  it('says "before reporting a null result" when the player abandoned', async () => {
    const { container } = await mountReveal({ stamp: 'NULL_REPORTED' }, { path: 'abandon' });
    const text = blockText(container, 'accounting');
    expect(text).toContain(t(copy, 'reveal.accounting2Abandoned', { k: '14' }));
    expect(text).not.toContain(t(copy, 'reveal.accounting2', { k: '14' }));
  });

  it('adds the optional-stopping surcharge only when peeks were taken', async () => {
    const none = await mountReveal({ peeks: 0 });
    expect(blockText(none.container, 'accounting')).not.toContain(literalRun('reveal.peekSurcharge'));
    cleanup();

    const some = await mountReveal({ peeks: 3 });
    expect(blockText(some.container, 'accounting')).toContain(
      t(copy, 'reveal.peekSurcharge', { peeks: '3', mult: '4' })
    );
  });

  it('sets the p < .05 figures in the one loud colour, and nothing else (R1.3)', async () => {
    const { container } = await mountReveal();
    const sig = [...container.querySelectorAll('[data-block="accounting"] .ph-num--sig')].map((n) => n.textContent);
    expect(sig).toEqual(['87', '4.9']);
  });

  it('sets every interpolated number in the mono/tabular numeral style (R2.4)', async () => {
    const { container } = await mountReveal({ peeks: 3 });
    const nums = [...container.querySelectorAll('[data-block="accounting"] .ph-num')].map((n) => n.textContent);
    expect(nums).toEqual(['1792', '87', '4.9', '14', '14', '52', '3', '4']);
  });
});

// --- gr6-001: the accounting is DAY-TYPED -----------------------------------
//
// The old single `accounting1` said "by chance alone" on both day types. On
// effect days ~70% of the counted hits are true positives on the outcome the
// truth line declared real one paragraph above (measured: median 192 of 283);
// on null days a large share are the DGP's own designed confounding (z = 24.9
// on the mean beta of the plainest Y1 spec, rejecting at 3.6x nominal), which
// About discloses and the reveal then mislabelled.

describe('gr6-001 — the accounting names the right cause on each day type', () => {
  const EFFECT = {
    dayType: 'effect' as const,
    trueOutcome: 0 as Outcome,
    trueBeta: 0.29,
    sigPaths: 455,
    sigFraction: 455 / 1792,
    sigTrueOutcome: 317,
    sigOtherOutcome: 138,
  };

  it('splits the hits by outcome on an effect day, using the payload\'s own counts', async () => {
    const { container } = await mountReveal(EFFECT);
    expect(blockText(container, 'accounting')).toContain(
      t(copy, 'reveal.accounting1Effect', {
        total: '1792',
        sig: '455',
        sigPct: '25.4',
        trueSig: '317',
        otherSig: '138',
      })
    );
  });

  it('never runs the null-day sentence on an effect day', async () => {
    const { container } = await mountReveal(EFFECT);
    const text = blockText(container, 'accounting');
    for (const run of literalRuns('reveal.accounting1')) expect(text).not.toContain(run);
  });

  it('runs the null sentence, and names the disclosed confound, on a null day', async () => {
    const { container } = await mountReveal({ dayType: 'null', trueOutcome: null, trueBeta: 0 });
    const text = blockText(container, 'accounting');
    expect(text).toContain(t(copy, 'reveal.accounting1', { total: '1792', sig: '87', sigPct: '4.9' }));
    // Controller ruling (a) + w1-r-001: the confound is named as a property of
    // the DESIGN, in About's own words, and the COUNT is attributed to the
    // threshold — measured, confounding accounts for ~5% of the hits on
    // accepted null days, which is indistinguishable from zero.
    expect(text).toMatch(/confounded with age and income/);
    expect(text).toMatch(/never randomly assigned/);
    expect(text).not.toMatch(/the rest are confounding/i);
  });

  it('never runs the effect-day sentence on a null day', async () => {
    const { container } = await mountReveal({ dayType: 'null', trueOutcome: null, trueBeta: 0 });
    const text = blockText(container, 'accounting');
    for (const run of literalRuns('reveal.accounting1Effect')) expect(text).not.toContain(run);
  });

  it('says "by chance alone" on neither day type, in any locale (the defect, pinned)', () => {
    for (const catalog of [copy, itCopy, esCopy]) {
      for (const key of ['reveal.accounting1', 'reveal.accounting1Effect'] as const) {
        expect(`${key}: ${catalog[key]}`).not.toMatch(/by chance alone|per puro caso|por puro azar/i);
      }
    }
  });

  it('keeps R1.3\'s loud colour on the headline pair only, not on the split counts', async () => {
    const { container } = await mountReveal(EFFECT);
    const sig = [...container.querySelectorAll('[data-block="accounting"] .ph-num--sig')].map((n) => n.textContent);
    expect(sig).toEqual(['455', '25.4']);
    const nums = [...container.querySelectorAll('[data-block="accounting"] .ph-num')].map((n) => n.textContent);
    expect(nums).toContain('317');
    expect(nums).toContain('138');
  });
});

// --- gr6-002: the directed-search sentence ----------------------------------

describe('gr6-002 — the pHit sentence stops exonerating an efficient hacker', () => {
  it('adds the directed-search line when there was a search to describe', async () => {
    const { container } = await mountReveal({ playerExplored: 14 });
    expect(blockText(container, 'accounting')).toContain(copy['reveal.accounting3Directed']);
  });

  it('omits it at k = 1: publishing the default is not a search', async () => {
    const { container } = await mountReveal({ playerExplored: 1 });
    expect(blockText(container, 'accounting')).not.toContain(copy['reveal.accounting3Directed']);
  });

  it('quotes the pHit the payload carries, whichever vector the engine chose', async () => {
    const { container } = await mountReveal({ dayType: 'effect', trueOutcome: 0, trueBeta: 0.29, pHitAtK: 0.614 });
    expect(blockText(container, 'accounting')).toContain(
      t(copy, 'reveal.accounting3', { k: '14', pHitPct: '61' })
    );
  });
});

describe('§2.7.2 / §2.7.6 the two figures', () => {
  it('captions fig. 1 and fig. 2 and plots the curve in both', async () => {
    const { container } = await mountReveal();
    expect(blockText(container, 'fig1')).toContain(copy['reveal.fig1']);
    expect(blockText(container, 'fig1')).toContain(copy['reveal.curveCaption']);
    expect(blockText(container, 'fig2')).toContain(copy['reveal.fig2']);
    expect(blockText(container, 'fig2')).toContain(copy['reveal.groupedCaption']);
    expect(container.querySelectorAll('[data-block="fig1"] circle[data-p]').length).toBe(4);
    expect(container.querySelectorAll('[data-block="fig2"] [data-role="band-label"]').length).toBe(4);
  });

  it('footnotes the specifications that had too little data to plot', async () => {
    const { container } = await mountReveal();
    // 1792 enumerated, 4 plotted → 1788 omitted.
    expect(blockText(container, 'fig1')).toContain(t(copy, 'reveal.omittedFootnote', { n: '1788' }));
  });

  it('omits the footnote when every enumerated path is plotted', async () => {
    const { container } = await mountReveal({ totalPaths: 4 });
    expect(blockText(container, 'fig1')).not.toContain(literalRun('reveal.omittedFootnote'));
  });
});

describe('§2.7.4 the verdict stamp', () => {
  it.each([
    ['RETRACTED' as const, 'reveal.retracted' as const],
    ['REPLICATED' as const, 'reveal.replicated' as const],
    ['NULL_REPORTED' as const, 'reveal.nullReported' as const],
  ])('renders %s as real text (R6.3/R8.2)', async (stamp, key) => {
    const { container } = await mountReveal({ stamp });
    expect(blockText(container, 'stamp')).toContain(copy[key]);
  });

  it('slams over a journal-cover echo, not over nothing', async () => {
    const { container } = await mountReveal();
    const cover = container.querySelector('[data-block="stamp"] [data-role="cover-echo"]');
    expect(cover).not.toBeNull();
    expect(cover?.textContent).toContain(SCENARIO.question);
  });

  /* gr6-021 — THE PRE-EPOCH DAY, WHERE BOTH BANKS USED TO VANISH.
     `puzzleNumber = daysBetween(EPOCH, iso) + 1` is negative before launch,
     JavaScript's `%` keeps the dividend's sign, and `bank[-3]` is
     `undefined` — which this component renders as "no subline". So every
     line of both banks was invisible on every day the game had ever been
     played, silently. This is the screen-level pin; daily.ts's own suite
     walks the banks arithmetically over a full year. */
  const PRE_EPOCH_ISO = '2026-08-06'; // puzzleNumber -3 against EPOCH 2026-08-10

  it('still finds a retraction subline on a PRE-EPOCH (negative puzzle number) day', async () => {
    const { container } = await mountReveal({ stamp: 'RETRACTED' }, { iso: PRE_EPOCH_ISO, practice: true });
    expect(live().puzzleNumber, 'the fixture is not actually pre-EPOCH any more').toBeLessThan(0);
    const sub = container.querySelector('[data-role="stamp-subline"]')?.textContent ?? '';
    expect(sub, 'the whole 14-line retraction bank vanished on a pre-EPOCH day').not.toBe('');
    expect(en.retractionSublines).toContain(sub);
  });

  it('still finds a null-reported subline on a PRE-EPOCH day', async () => {
    const { container } = await mountReveal(
      { stamp: 'NULL_REPORTED' },
      { path: 'abandon', iso: PRE_EPOCH_ISO, practice: true }
    );
    expect(live().puzzleNumber).toBeLessThan(0);
    const sub = container.querySelector('[data-role="stamp-subline"]')?.textContent ?? '';
    expect(sub, 'the whole 10-line null-reported bank vanished on a pre-EPOCH day').not.toBe('');
    expect(en.nullReportedSublines).toContain(sub);
  });

  /* gr6-021/gr6-022 — the cover echo is a masthead too, and must agree with
     the running header about a practice day's missing issue number. */
  it('the cover echo prints an em dash for the issue number on a practice day, never a negative one', async () => {
    const { container } = await mountReveal({ stamp: 'RETRACTED' }, { iso: PRE_EPOCH_ISO, practice: true });
    const vol = container.querySelector('[data-role="cover-echo"] .ph-reveal__cover-vol')?.textContent ?? '';
    expect(vol).toBe('Vol. 1, No. —');
    expect(vol, 'the cover echo still registers a negative issue').not.toContain('-3');
  });

  it('the cover echo prints the real number on a real day', async () => {
    const { container } = await mountReveal({ stamp: 'RETRACTED' });
    const vol = container.querySelector('[data-role="cover-echo"] .ph-reveal__cover-vol')?.textContent ?? '';
    expect(vol).toBe(`Vol. 1, No. ${live().puzzleNumber}`);
  });

  it('adds a rotating retraction subline only to RETRACTED', async () => {
    const retracted = await mountReveal({ stamp: 'RETRACTED' });
    const sub = retracted.container.querySelector('[data-role="stamp-subline"]')?.textContent ?? '';
    expect(en.retractionSublines).toContain(sub);
    cleanup();

    const replicated = await mountReveal({ stamp: 'REPLICATED' });
    expect(replicated.container.querySelector('[data-role="stamp-subline"]')).toBeNull();
  });

  /* gr6-037 — NULL REPORTED was the one stamp that rendered with no subline
     at all: Act II's quietest moment and, until W3 wrote the bank, its
     emptiest. */
  it('gives NULL_REPORTED its own rotating subline, from its own bank', async () => {
    const { container } = await mountReveal({ stamp: 'NULL_REPORTED' }, { path: 'abandon' });
    const sub = container.querySelector('[data-role="stamp-subline"]')?.textContent ?? '';
    expect(sub, 'the honest ending still ends on nothing').not.toBe('');
    expect(en.nullReportedSublines).toContain(sub);
    // The two banks are distinct: a retraction line under a NULL REPORTED
    // stamp would be telling a player who published nothing that the journal
    // has issued a correction.
    expect(en.retractionSublines).not.toContain(sub);
  });

  /* w3-r-001, the constraint W3 attached to this wiring and the reason it is
     wired WITHOUT a day-type branch. `verdictStamp` returns NULL_REPORTED on
     `published === null` alone, so an abandoned EFFECT day lands on the same
     stamp — one block under a `reveal.truthEffect` line that has just
     declared the effect real. Both day types must therefore get a line, and
     it must be drawn from the same bank; a future variant has to key on
     `payload.dayType`, never on the stamp, which cannot tell them apart. */
  it('renders the same bank on an abandoned EFFECT day, where the stamp cannot tell the day types apart', async () => {
    const nullDay = await mountReveal({ stamp: 'NULL_REPORTED', dayType: 'null' }, { path: 'abandon' });
    const nullSub = nullDay.container.querySelector('[data-role="stamp-subline"]')?.textContent ?? '';
    expect(en.nullReportedSublines).toContain(nullSub);
    cleanup();

    const effectDay = await mountReveal({ stamp: 'NULL_REPORTED', dayType: 'effect' }, { path: 'abandon' });
    const effectSub = effectDay.container.querySelector('[data-role="stamp-subline"]')?.textContent ?? '';
    expect(effectSub, 'an abandoned effect day lost its subline').not.toBe('');
    expect(en.nullReportedSublines).toContain(effectSub);
    // Same puzzle number, same bank, same index: the line does not depend on
    // the day type, which is exactly the property the bank was authored for.
    expect(effectSub).toBe(nullSub);
  });

  // gr6-059 / gr2-016: the subline used to be a rotated <text> node inside the
  // stamp's own SVG, drawn at -12deg across the day's question. It is prose
  // now: horizontal, beneath the card, after the mark in reading order.
  it('sets the subline outside the stamp graphic, after the cover card', async () => {
    const { container } = await mountReveal({ stamp: 'RETRACTED' });
    const svg = container.querySelector('.ph-stamp__mark')!;
    expect(svg.querySelectorAll('text')).toHaveLength(1); // the label, and nothing else
    expect(svg.textContent).toBe(copy['reveal.retracted']);

    const subline = container.querySelector('[data-role="stamp-subline"]')!;
    expect(subline.closest('.ph-stamp')).toBeNull();
    expect(subline.closest('svg')).toBeNull();
    // After the cover (which holds the card and the mark), inside the beat.
    const beat = container.querySelector('.ph-reveal__stamp-beat')!;
    const order = [...beat.children].map((el) => el.className);
    expect(order[0]).toContain('ph-reveal__cover');
    expect(order[1]).toContain('ph-reveal__stamp-subline');
  });

  // gr6-011: the mark carried the sentence as its aria-label AND exposed its
  // <text> children, so Act II's signature beat was read out twice in a row.
  it('is announced exactly once (role="img" + aria-label; the glyphs are hidden)', async () => {
    const { container } = await mountReveal({ stamp: 'RETRACTED' });
    const svg = container.querySelector('.ph-stamp__mark')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe(copy['reveal.retracted']);
    for (const text of svg.querySelectorAll('text')) {
      expect(text.getAttribute('aria-hidden')).toBe('true');
    }
  });
});

describe('§2.7.5 call resolution', () => {
  it('confirms a correct "noise" call on a null day', async () => {
    const { container } = await mountReveal({ dayType: 'null' }, { call: 'noise' });
    expect(blockText(container, 'call')).toContain(copy['reveal.callCorrect']);
  });

  it('marks a "real" call on a null day wrong', async () => {
    const { container } = await mountReveal({ dayType: 'null' }, { call: 'real' });
    expect(blockText(container, 'call')).toContain(copy['reveal.callIncorrect']);
  });

  it('confirms a correct "real" call on an effect day', async () => {
    const { container } = await mountReveal({ dayType: 'effect', trueOutcome: 1, trueBeta: 0.2 }, { call: 'real' });
    expect(blockText(container, 'call')).toContain(copy['reveal.callCorrect']);
  });
});

describe('§7.5 motion — scroll fades, and none of them under reduced motion', () => {
  it('never leaves a block hidden when there is no IntersectionObserver to reveal it', async () => {
    // jsdom has none; the fade must fail OPEN so content is never trapped.
    expect(typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver).toBe('undefined');
    const { container } = await mountReveal();
    const faded = [...container.querySelectorAll('[data-block]')];
    expect(faded.length).toBe(6);
    for (const el of faded) expect(el.className).toContain('ph-entered');
  });
});

describe('a11y', () => {
  it('gives the reveal a heading-free, screen-reader-complete text account', async () => {
    const { container } = await mountReveal();
    const text = container.textContent ?? '';
    // Every number the figure encodes is also present as text (§7.5).
    for (const fragment of ['1792', '87', '4.9', '14', '52']) expect(text).toContain(fragment);
  });
});

/* ------------------------------------------------------------------ review */

describe('review I4 — the abandon path claims nothing it did not do', () => {
  /** A payload consistent with having published nothing: no curve entry is
   * flagged, exactly as buildRevealMetrics produces for `published: null`. */
  function abandonedPayload(): Partial<RevealPayloadFull> {
    return {
      stamp: 'NULL_REPORTED',
      curve: payload().curve.map((entry) => ({ ...entry, published: false })),
    };
  }

  it('drops "Yours is highlighted" from fig. 1 when nothing was published', async () => {
    const { container } = await mountReveal(abandonedPayload(), { path: 'abandon' });
    expect(blockText(container, 'fig1')).toContain(copy['reveal.curveCaptionAbandoned']);
    expect(blockText(container, 'fig1')).not.toContain(copy['reveal.curveCaption']);
  });

  it('keeps the published caption when there is a published path', async () => {
    const { container } = await mountReveal({}, { path: 'submit' });
    expect(blockText(container, 'fig1')).toContain(copy['reveal.curveCaption']);
    expect(blockText(container, 'fig1')).not.toContain(copy['reveal.curveCaptionAbandoned']);
  });

  it('omits the published legend row on the abandon path', async () => {
    const { container } = await mountReveal(abandonedPayload(), { path: 'abandon' });
    const legend = container.querySelector('[data-block="fig1"] [data-role="legend"]') as HTMLElement;
    expect(legend.querySelectorAll('li').length).toBe(2);
    expect(legend.textContent).not.toContain(copy['legend.published']);
  });

  it('keeps the published legend row when there is one', async () => {
    const { container } = await mountReveal({}, { path: 'submit' });
    const legend = container.querySelector('[data-block="fig1"] [data-role="legend"]') as HTMLElement;
    expect(legend.querySelectorAll('li').length).toBe(3);
    expect(legend.textContent).toContain(copy['legend.published']);
  });
});

describe('review I5 — the published recipe exists as real text', () => {
  it('sets it in FULL labels under the accounting, where AT and the tab key can reach it', async () => {
    const { container } = await mountReveal({}, { path: 'submit' });
    const line = container.querySelector('[data-role="published-recipe"]');
    expect(line).not.toBeNull();
    expect(line?.textContent).toBe(
      t(copy, 'reveal.publishedRecipe', { recipe: recipeLabel(SPEC, SCENARIO.outcomeLabels, copy) })
    );
    // The full outcome label, not the figure's Y-notation abbreviation.
    expect(line?.textContent).toContain(SCENARIO.outcomeLabels[0]);
    expect(line?.textContent).not.toContain('Y₁');
  });

  it('lives inside the accounting block, so §2.7 still has exactly six blocks', async () => {
    const { container } = await mountReveal({}, { path: 'submit' });
    expect(blocks(container)).toEqual(['truth', 'fig1', 'accounting', 'stamp', 'call', 'fig2']);
    expect(container.querySelector('[data-block="accounting"] [data-role="published-recipe"]')).not.toBeNull();
  });

  it('adds no numerals to the accounting — the R1.3/R2.4 spans are unchanged', async () => {
    const { container } = await mountReveal({}, { path: 'submit' });
    const nums = [...container.querySelectorAll('[data-block="accounting"] .ph-num')].map((n) => n.textContent);
    expect(nums).toEqual(['1792', '87', '4.9', '14', '14', '52']);
  });

  it('is absent when the player published nothing', async () => {
    const { container } = await mountReveal({ stamp: 'NULL_REPORTED' }, { path: 'abandon' });
    expect(container.querySelector('[data-role="published-recipe"]')).toBeNull();
  });
});

// --- T18: prereg days — no CALL step, plus the sig+null one-liner -----------

/** Drives the real store through the prereg path (boot -> chooseMode ->
 * preregCommit), reusing the same fakeClient the hack-mode harness above
 * uses — its default runSpec (p=0.01, valid) is significant, so
 * preregCommit's own stamp correction keeps whatever `over.stamp` says. */
async function mountRevealPrereg(over: Partial<RevealPayloadFull> = {}, spec: Spec = SPEC) {
  const p = payload(over);
  const view = render(
    <LocaleProvider>
      <Capture />
      <Reveal />
    </LocaleProvider>
  );
  await act(async () => {
    await live().boot(fakeClient(p), ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
  });
  act(() => live().chooseMode('prereg'));
  await act(async () => {
    await live().preregCommit(spec);
  });
  await waitFor(() => expect(view.container.querySelector('[data-block="truth"]')).not.toBeNull());
  return view;
}

describe('T18 — prereg days: no CALL block, and the sig+null false-positive one-liner', () => {
  it('renders five blocks: the call section is not rendered at all, rather than rendered empty (gr6-003)', async () => {
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null' });
    expect(blocks(container)).toEqual(['truth', 'fig1', 'accounting', 'stamp', 'fig2']);
    expect(container.querySelector('[data-block="call"]')).toBeNull();
  });

  it('shows reveal.preregFalsePositive on a prereg sig+null RETRACTED day (§2.8\'s "real 5% false positive")', async () => {
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null' });
    expect(blockText(container, 'stamp')).toContain(copy['reveal.preregFalsePositive']);
  });

  // --- gr6-003: block 3 is MODE-typed, not just day-typed -------------------

  it('says the player COMMITTED, never that they explored (gr6-003)', async () => {
    // k = 1 is what a real prereg day carries: store.preregCommit hands the
    // engine `explored: [spec]`, exactly the one path that was declared.
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null', playerExplored: 1 });
    const text = blockText(container, 'accounting');
    expect(text).toContain(t(copy, 'reveal.accounting2Prereg', { k: '1' }));
    for (const run of literalRuns('reveal.accounting2')) expect(text).not.toContain(run);
    for (const run of literalRuns('reveal.accounting2Abandoned')) expect(text).not.toContain(run);
  });

  it('frames the recipe as preregistered, not as published', async () => {
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null' });
    const line = container.querySelector('[data-role="published-recipe"]');
    expect(line?.textContent).toBe(
      t(copy, 'reveal.preregisteredRecipe', { recipe: recipeLabel(SPEC, SCENARIO.outcomeLabels, copy) })
    );
    for (const run of literalRuns('reveal.publishedRecipe')) expect(line?.textContent).not.toContain(run);
  });

  it('never adds the directed-search line: a preregistering player followed nothing', async () => {
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null', playerExplored: 14 });
    expect(blockText(container, 'accounting')).not.toContain(copy['reveal.accounting3Directed']);
  });

  it('keeps the pHit sentence, which is the mode\'s whole lesson', async () => {
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null', playerExplored: 1 });
    expect(blockText(container, 'accounting')).toContain(t(copy, 'reveal.accounting3', { k: '1', pHitPct: '52' }));
  });

  it('suppresses the retraction subline: §4.5\'s bank is written for cheats', async () => {
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null' });
    const stampText = blockText(container, 'stamp');
    for (const subline of en.retractionSublines) expect(stampText).not.toContain(subline);
    // The stamp itself is untouched: only its subline is.
    expect(stampText).toContain(copy['reveal.retracted']);
  });

  it('keeps the retraction subline in hacking mode (the suppression is mode-scoped)', async () => {
    const { container } = await mountReveal({ stamp: 'RETRACTED', dayType: 'null' });
    const stampText = blockText(container, 'stamp');
    expect(en.retractionSublines.some((s) => stampText.includes(s))).toBe(true);
  });

  it('hoists the false-positive frame ABOVE the stamp, so the frame arrives before the verdict', async () => {
    const { container } = await mountRevealPrereg({ stamp: 'RETRACTED', dayType: 'null' });
    const block = container.querySelector('[data-block="stamp"]')!;
    const nodes = [...block.querySelectorAll('.ph-reveal__statement, .ph-stamp')];
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    expect(nodes[0].textContent).toBe(copy['reveal.preregFalsePositive']);
    expect(nodes[0].classList.contains('ph-reveal__statement')).toBe(true);
    expect(nodes[1].classList.contains('ph-stamp')).toBe(true);
  });

  it('does NOT show the one-liner on a hack-mode RETRACTED day (existing behavior unchanged)', async () => {
    const { container } = await mountReveal({ stamp: 'RETRACTED', dayType: 'null' });
    expect(blockText(container, 'stamp')).not.toContain(copy['reveal.preregFalsePositive']);
  });

  it('does NOT show the one-liner on a prereg REPLICATED day', async () => {
    const { container } = await mountRevealPrereg(
      { stamp: 'REPLICATED', dayType: 'effect', trueOutcome: SPEC.outcome as Outcome },
      SPEC
    );
    expect(blockText(container, 'stamp')).not.toContain(copy['reveal.preregFalsePositive']);
  });

  it('does NOT show the one-liner on a prereg RETRACTED day caused by the wrong outcome on an effect day (§2.7.4)', async () => {
    const { container } = await mountRevealPrereg(
      { stamp: 'RETRACTED', dayType: 'effect', trueOutcome: 2 as Outcome },
      SPEC // SPEC.outcome === 0, so this is the "wrong outcome" case, not the null-day case
    );
    expect(blockText(container, 'stamp')).not.toContain(copy['reveal.preregFalsePositive']);
  });
});

// --- T33: the end-of-reveal continue action -------------------------------
//
// Escalated shipping blocker, found in play-testing: `store.finishReveal()`
// had NO caller anywhere in src/ui, so the Summary screen — the day's whole
// accounting, its share string and its persistence moment — was unreachable
// in the real app. The reveal simply ended at Fig. 2.

describe('T33 — the reveal ends in an action, not in a figure', () => {
  it('renders the continue button after the LAST block (fig. 2), not before it', async () => {
    const { container } = await mountReveal();
    const cta = container.querySelector('[data-role="to-summary"]') as HTMLButtonElement | null;
    expect(cta).not.toBeNull();
    expect(cta?.textContent).toBe(copy['reveal.toSummary']);

    const fig2 = container.querySelector('[data-block="fig2"]') as HTMLElement;
    // DOCUMENT_POSITION_FOLLOWING: the button comes after fig. 2 in DOM order.
    expect(fig2.compareDocumentPosition(cta as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('dispatches finishReveal, moving the machine from reveal to summary', async () => {
    const { container } = await mountReveal();
    expect(live().screen).toBe('reveal');

    act(() => {
      (container.querySelector('[data-role="to-summary"]') as HTMLButtonElement).click();
    });

    expect(live().screen).toBe('summary');
  });

  it('is present on an abandoned day too — every day ends at the invoice', async () => {
    const { container } = await mountReveal({}, { path: 'abandon' });
    expect(container.querySelector('[data-role="to-summary"]')).not.toBeNull();
  });
});

describe('T33 — reveal to summary, end to end through the real router', () => {
  async function mountRouterToReveal() {
    const p = payload();
    const view = render(
      <LocaleProvider>
        <Capture />
        <ScreenRouter />
      </LocaleProvider>
    );
    await act(async () => {
      await live().boot(fakeClient(p), ISO, { practice: false, mode: 'hack', scenarioCount: 20 });
    });
    act(() => live().openData());
    await act(async () => {
      await live().submit();
    });
    await act(async () => {
      await live().makeCall('noise');
    });
    await waitFor(() => expect(view.container.querySelector('[data-block="fig2"]')).not.toBeNull());
    return view;
  }

  it('reaches the invoice from the reveal with one tap', async () => {
    window.localStorage.clear();
    const { container } = await mountRouterToReveal();

    await act(async () => {
      (container.querySelector('[data-role="to-summary"]') as HTMLButtonElement).click();
    });

    await waitFor(() => expect(container.querySelector('.ph-summary__invoice')).not.toBeNull());
    expect(container.textContent).toContain(copy['summary.invoiceTitle']);
    expect(container.querySelector('[data-block="fig2"]')).toBeNull();
  });

  it('persists the finished day exactly once, keyed on the STORE\'s iso (Summary\'s durable guard is undisturbed)', async () => {
    window.localStorage.clear();
    const { container } = await mountRouterToReveal();

    await act(async () => {
      (container.querySelector('[data-role="to-summary"]') as HTMLButtonElement).click();
    });
    await waitFor(() => expect(container.querySelector('.ph-summary__invoice')).not.toBeNull());

    const after = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(Object.keys(after.history)).toEqual([ISO]);
    expect(after.stats.hackDays).toBe(1);

    // A second finishReveal() is idempotent at BOTH layers: the machine is
    // already on 'summary' (so nothing re-transitions), and the durable
    // history[iso][mode] guard means a remount cannot double-count the day.
    act(() => live().finishReveal());
    await act(async () => {});
    expect(live().screen).toBe('summary');
    const again = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(again.stats.hackDays).toBe(1);
    expect(Object.keys(again.history)).toEqual([ISO]);
  });
});
