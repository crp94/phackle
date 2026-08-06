// THE REVEAL — Act II (master spec §2.7, §7.3 "Reveal"; DESIGN.md R1.3, R2.4,
// R3.2, R5.2 (sites 3 and 4 — the block sequence and the stamp's trigger),
// R5.6, R5.7, R8.2, R8.3).
//
// Six blocks, in §2.7's order, and not one number that isn't read off the
// RevealPayload:
//
//   1 truth line   2 fig. 1 (the specification curve)   3 the accounting
//   4 the verdict stamp   5 the call resolution   6 fig. 2 (grouped)
//
// Register: clinical. The accounting is a results paragraph, not a verdict on
// the player; the sentences state what the enumerated curve says and stop.
// The single loud colour appears exactly where R1.3 allows it in prose --
// the two figures for p < .05 -- and nowhere else on this screen.
//
// formatSigFigs is exported alongside the screen so the truth line's
// raw-units formatting can be pinned by a unit test at every magnitude; same
// inline waiver as src/i18n/LocaleProvider.tsx's hook export.
/* eslint-disable react-refresh/only-export-components */
import { useMemo, type ReactNode } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore } from '../../game/store';
import { callIsCorrect } from '../../game/scoring';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { staggerStyle, useEnterOnce } from '../hooks/useEnterOnce';
import { JOURNAL_VOLUME } from '../masthead';
import { Stamp } from '../components/Stamp';
import { SpecCurve, recipeLabel, type SpecCurvePoint } from '../charts/SpecCurve';
import type { CopyKey } from '../../content/en/copy';
import type { RevealCurveEntry, RevealMetricsFull } from '../../engine/reveal';
import type { RevealPayload } from '../../engine/protocol';
import { typographicMinus } from '../format';
import './Reveal.css';

/**
 * The reveal payload as it ACTUALLY arrives, rather than as §6's narrower
 * `RevealMetrics` declares it.
 *
 * `protocol.ts` builds the wire object as `{ ...buildRevealMetrics(...), ... }`,
 * so every field `RevealMetricsFull` adds is on the object at runtime and
 * survives the worker's structuredClone (own enumerable properties, all of
 * them). The screen already relies on exactly this for `curve`, which it
 * widens to `RevealCurveEntry[]` a few lines into the component and for the
 * same reason; gr6-001's two hit counts are the second instance, named once
 * here instead of casting twice.
 *
 * Not a papering-over of a missing field: `tests/engine/reveal.test.ts` pins
 * that `buildRevealMetrics` returns both counts on every day type, and the
 * suite below pins that the sentence renders them. The narrow declaration is
 * in `src/engine/types.ts`, which this wave does not own; hoisting the two
 * fields onto `RevealMetrics` would let this alias collapse to `RevealPayload`
 * and change nothing else.
 */
export type RevealPayloadFull = RevealPayload & Pick<RevealMetricsFull, 'sigTrueOutcome' | 'sigOtherOutcome'>;

/** Figure-number separator. Punctuation, like the decimal point, and for the
 * same reason: it is notation the About page pins as language-independent. */
const FIG_SEP = ' — ';

const STAMP_LABEL: Record<RevealPayload['stamp'], CopyKey> = {
  RETRACTED: 'reveal.retracted',
  REPLICATED: 'reveal.replicated',
  NULL_REPORTED: 'reveal.nullReported',
};

/**
 * `value` to `digits` significant figures, in positional notation at every
 * magnitude -- `toPrecision` alone switches to exponent form above 1e21 and
 * below 1e-7 and, worse, at `(1423).toPrecision(2)` = "1.4e+3", which is not
 * a number anyone wants to read in a sentence. Always a decimal point, never
 * a locale separator (about.decimalNote).
 */
export function formatSigFigs(value: number, digits: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return (0).toFixed(digits - 1);
  const rounded = Number(value.toPrecision(digits));
  const magnitude = Math.floor(Math.log10(Math.abs(rounded)));
  // gr6-074: same digits, U+2212 for the sign (src/ui/format.ts). Act II's
  // truth line prints a signed true effect, and a screen that typesets β, α
  // and ≥ correctly should not spell its minus with a keyboard hyphen.
  return typographicMinus(rounded.toFixed(Math.max(0, digits - 1 - magnitude)));
}

/** Whole counts, with NO thousands separator: "1,792" reads as 1.792 in
 * Italian and Spanish, and the reveal's whole job is to be believed. */
function formatCount(value: number): string {
  return String(Math.round(value));
}

function formatPercent(fraction: number, decimals: number): string {
  return (fraction * 100).toFixed(decimals);
}

interface Part {
  text: string;
  /** Mono + tabular (R2.4). Words interpolated into a sentence are not. */
  numeral?: boolean;
  /** R1.3's fourth sanctioned place: an Act II accounting figure for p < .05. */
  sig?: boolean;
}

/**
 * `t()` returns a flat string, but R2.4 requires every numeral to be set in
 * mono and tabular figures -- which a flat string cannot express. So the
 * accounting interpolates to NODES: literal text passes through, and each
 * {param} becomes its own span, styled by what it is.
 */
function interpolate(template: string, parts: Record<string, Part>): ReactNode[] {
  const out: ReactNode[] = [];
  const token = /\{(\w+)\}/g;
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(template)) !== null) {
    if (match.index > cursor) out.push(template.slice(cursor, match.index));
    const part = parts[match[1]];
    if (part === undefined) {
      // Same contract as t(): an unbound token stays visible rather than
      // vanishing, so a missed param is obvious on screen.
      out.push(match[0]);
    } else if (part.numeral) {
      out.push(
        <span key={key++} className={part.sig ? 'ph-num ph-num--sig' : 'ph-num'}>
          {part.text}
        </span>
      );
    } else {
      out.push(part.text);
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < template.length) out.push(template.slice(cursor));
  return out;
}

/**
 * One scroll-gated block (R5.2 site 3: opacity + a 6px rise, --dur-scene,
 * staggered by `index` within a batch).
 *
 * T35 fix round 1 moved the observer and the stagger cap into
 * `useEnterOnce`, which Published's clippings (site 5) now share — see that
 * module for why a mount-triggered entrance was the wrong trigger in the
 * first place. The behaviour here is unchanged: `entered` fails OPEN in
 * every direction that could hide content, and `.ph-fade ph-entered`'s own
 * `opacity: 1` (not the animation) is what holds the block visible.
 */
function Block({ name, index, children }: { name: string; index: number; children: ReactNode }) {
  const { ref, entered } = useEnterOnce<HTMLElement>();

  return (
    <section
      ref={ref}
      data-block={name}
      className={entered ? 'ph-fade ph-entered' : 'ph-fade'}
      // The animation hook, and the only reason this component takes an
      // index at all: Reveal.css multiplies it by --dur-stagger to get this
      // block's animation-delay. A custom property, not an inline duration —
      // R5.1 keeps every actual timing value inside tokens.css so the
      // reduced-motion block can collapse it (here, to 0ms).
      style={staggerStyle(index)}
    >
      {children}
    </section>
  );
}

function Figure({ number, caption, footnote, children }: { number: string; caption: string; footnote: string | null; children: ReactNode }) {
  return (
    <figure className="ph-figure">
      {children}
      <figcaption className="ph-figure__caption">
        <span className="ph-num">{number}</span>
        {FIG_SEP}
        {caption}
        {footnote === null ? null : <span className="ph-figure__footnote">{footnote}</span>}
      </figcaption>
    </figure>
  );
}

export function Reveal() {
  const { content, copy, t } = useLocale();
  const payload = useGameStore((s) => s.reveal) as RevealPayloadFull | null;
  const call = useGameStore((s) => s.call);
  const published = useGameStore((s) => s.published);
  const scenarioIndex = useGameStore((s) => s.scenarioIndex);
  const puzzleNumber = useGameStore((s) => s.puzzleNumber);
  // T18: only consulted below for the prereg false-positive one-liner (see
  // block "stamp") — every other block on this screen is already
  // mode-agnostic by construction (it reads only `payload`/`published`/
  // `call`, never `mode` itself).
  const mode = useGameStore((s) => s.mode);
  // T33: the reveal -> summary transition. A plain action dispatch, no local
  // state of its own — pressing it twice is a no-op the second time, because
  // the store is already on 'summary' and this screen has been unmounted.
  const finishReveal = useGameStore((s) => s.finishReveal);
  const reducedMotion = useReducedMotion();

  // The curve arrives from the worker as RevealMetricsFull entries -- §6's
  // narrower `RevealMetrics['curve']` type is what RevealPayload declares, but
  // buildRevealMetrics attaches the full `spec` to every entry precisely so
  // this figure can render recipes (see src/engine/reveal.ts's
  // RevealCurveEntry). Widening here, once, keeps the cast out of the chart.
  const entries = payload === null ? null : (payload.curve as RevealCurveEntry[]);
  const points = useMemo<SpecCurvePoint[]>(
    () =>
      (entries ?? []).map((entry) => ({
        p: entry.p,
        outcome: entry.outcome,
        explored: entry.explored,
        published: entry.published,
        spec: entry.spec,
      })),
    [entries]
  );

  if (!content || !copy || payload === null) return null;

  const scenario = content.scenarios[scenarioIndex] ?? content.scenarios[0];
  const omitted = Math.max(0, payload.totalPaths - payload.curve.length);

  // 1 — the truth (§2.7.1). trueBeta is in the outcome's OWN raw units, so
  // the unit is named rather than implied; a bare number here would be a
  // standardized effect size wearing a coefficient's clothes.
  const truth =
    payload.dayType === 'effect' && payload.trueOutcome !== null
      ? interpolate(copy['reveal.truthEffect'], {
          outcome: { text: scenario.outcomeLabels[payload.trueOutcome] },
          unit: { text: scenario.outcomeUnits[payload.trueOutcome] },
          beta: { text: formatSigFigs(payload.trueBeta, 2), numeral: true },
        })
      : interpolate(copy['reveal.truthNull'], { beta: { text: (0).toFixed(3), numeral: true } });

  // T18/gr6-003: Prereg Mode is the one mode whose block-3 verbs are different
  // in kind. The player committed sight-unseen and ran exactly what they
  // declared, so "explored" and "published" are both false about them.
  const isPrereg = mode === 'prereg';

  // 3 — the accounting (§2.7.3), every figure computed from the payload.
  //
  // gr6-001: DAY-TYPED. The effect variant separates hits on the outcome the
  // truth line just declared real from hits on the other three; the null
  // variant names the confound About discloses instead of blaming chance for
  // all of it. Branching is safe here for the same reason the truth line above
  // branches: the day type has already been disclosed, one paragraph up.
  //
  // R1.3's loud colour stays on the HEADLINE PAIR ({sig}, {sigPct}) only. The
  // split counts are numerals (R2.4) but not red: R1.3 sanctions "the Act II
  // accounting figures for p < .05" as one place, not as a licence to make
  // four of the sentence's five numbers shout.
  const accounting1 =
    payload.dayType === 'effect'
      ? interpolate(copy['reveal.accounting1Effect'], {
          total: { text: formatCount(payload.totalPaths), numeral: true },
          sig: { text: formatCount(payload.sigPaths), numeral: true, sig: true },
          sigPct: { text: formatPercent(payload.sigFraction, 1), numeral: true, sig: true },
          trueSig: { text: formatCount(payload.sigTrueOutcome), numeral: true },
          otherSig: { text: formatCount(payload.sigOtherOutcome), numeral: true },
        })
      : interpolate(copy['reveal.accounting1'], {
          total: { text: formatCount(payload.totalPaths), numeral: true },
          sig: { text: formatCount(payload.sigPaths), numeral: true, sig: true },
          sigPct: { text: formatPercent(payload.sigFraction, 1), numeral: true, sig: true },
        });
  // gr6-003: MODE-TYPED, then path-typed. Prereg wins over the published/
  // abandoned split because it is a statement about a different act.
  const exploredKey: CopyKey = isPrereg
    ? 'reveal.accounting2Prereg'
    : published === null
      ? 'reveal.accounting2Abandoned'
      : 'reveal.accounting2';
  const accounting2 = interpolate(copy[exploredKey], {
    k: { text: formatCount(payload.playerExplored), numeral: true },
  });
  const accounting3 = interpolate(copy['reveal.accounting3'], {
    k: { text: formatCount(payload.playerExplored), numeral: true },
    pHitPct: { text: formatPercent(payload.pHitAtK, 0), numeral: true },
  });
  // gr6-002: the sentence above prices a UNIFORM RANDOM explorer, and the
  // player was not one — they read a p-value after every turn. Withheld in
  // Prereg Mode (nothing was followed) and at k = 1 (publishing the default is
  // not a search, so there is no search to characterise).
  const directed = !isPrereg && payload.playerExplored > 1 ? t('reveal.accounting3Directed') : null;
  // §3.7's honest form: m peeks make the true path count ~(m+1)x larger.
  const surcharge =
    payload.peeks === 0
      ? null
      : interpolate(copy['reveal.peekSurcharge'], {
          peeks: { text: formatCount(payload.peeks), numeral: true },
          mult: { text: formatCount(payload.peeks + 1), numeral: true },
        });

  // 4 — the verdict (§2.7.4). Only a retraction carries a subline; §4.5's
  // bank rotates by puzzle number, so the day decides which one, not chance.
  //
  // gr6-003: NEVER IN PREREG MODE. Every line in that bank is written for a
  // player who hacked ("The journal has issued a correction", "Your co-authors
  // have asked to be listed as 'consulted'"); a preregistered analysis that
  // landed on RETRACTED did nothing to be corrected for, and §2.8 already
  // supplies the right sentence for it (reveal.preregFalsePositive, hoisted
  // above the stamp below).
  const subline =
    !isPrereg && payload.stamp === 'RETRACTED' && content.retractionSublines.length > 0
      ? content.retractionSublines[puzzleNumber % content.retractionSublines.length]
      : undefined;

  return (
    <div className="ph-reveal">
      {/* T22 — the reveal's TITLE, and the one place in this pass that puts
          text on the page that is not on the page.
          Act II is deliberately heading-free by design: it is a manuscript's
          results section, read straight through, and R8.3 spends its whole
          attention budget on the stamp. That design is untouched — but it
          left this screen with no heading of any level, so a screen-reader
          player arriving here (App.tsx now moves focus to <main> on the
          call -> reveal swap) was told nothing about what page they were on,
          and had no landmark or heading to orient by. The manuscript's own
          question is the reveal's subject, is already the Briefing's h1, and
          is already echoed further down this screen on the cover card — so it
          is the title, and it costs no new copy. Visually hidden rather than
          styled away: DESIGN.md R6.6's utility keeps it in the accessibility
          tree, which `display: none` would not. */}
      <h1 className="ph-visually-hidden">{scenario.question}</h1>

      <Block name="truth" index={0}>
        <p className="ph-reveal__truth">{truth}</p>
      </Block>

      <Block name="fig1" index={1}>
        <Figure
          number={t('reveal.fig1')}
          caption={t(published === null ? 'reveal.curveCaptionAbandoned' : 'reveal.curveCaption')}
          footnote={omitted === 0 ? null : t('reveal.omittedFootnote', { n: formatCount(omitted) })}
        >
          <SpecCurve points={points} grouped={false} outcomeLabels={scenario.outcomeLabels} copy={copy} />
        </Figure>
      </Block>

      <Block name="accounting" index={2}>
        <div className="ph-reveal__accounting">
          <p className="ph-reveal__statement">{accounting1}</p>
          <p className="ph-reveal__statement">{accounting2}</p>
          <p className="ph-reveal__statement">{accounting3}</p>
          {directed === null ? null : <p className="ph-reveal__statement">{directed}</p>}
          {surcharge === null ? null : <p className="ph-reveal__statement">{surcharge}</p>}
          {/* The figure is role="img", so its recipe callout reaches neither a
              screen reader nor the tab key -- and §7.4's callout abbreviates
              the outcome to Y-notation anyway. This is the one place the
              published recipe exists as real text, in full labels.
              gr6-003: the VERB is mode-typed. The data-role stays
              `published-recipe` in both modes — it addresses the line's slot in
              the accounting, not its wording, and renaming it would break every
              probe and e2e selector that reads the reveal's recipe. */}
          {published === null ? null : (
            <p className="ph-reveal__published-recipe" data-role="published-recipe">
              {t(isPrereg ? 'reveal.preregisteredRecipe' : 'reveal.publishedRecipe', {
                recipe: recipeLabel(published, scenario.outcomeLabels, copy),
              })}
            </p>
          )}
        </div>
      </Block>

      <Block name="stamp" index={3}>
        {/* T18 (§2.8's own parenthetical: "a real 5% false positive —
            teachable"): a preregistered commit that lands on RETRACTED on a
            NULL day did nothing wrong — this is exactly what a 5% false-
            positive rate looks like from the inside, not a mistake to
            explain away. Gated on the exact, newly-possible combination T18
            introduces (RETRACTED with no CALL step at all): every OTHER
            RETRACTED case (Hacking Mode, or a prereg commit on an effect day
            that hit the wrong outcome, §2.7.4) keeps the plain stamp with no
            added line, unchanged from before this task.

            gr6-003 MOVED IT ABOVE THE STAMP, and this is the ONE deviation
            from §2.7's block ORDER in the whole screen — mode-scoped, and
            ruled as an exception rather than a new default (controller,
            2026-08-06, ruling (c)). The reason is sequence, not layout: a
            player who did the honest thing was shown a red RETRACTED and only
            afterwards told it was not their fault. A frame that arrives after
            the verdict is not a frame. */}
        {isPrereg && payload.dayType === 'null' && payload.stamp === 'RETRACTED' ? (
          <p className="ph-reveal__statement">{t('reveal.preregFalsePositive')}</p>
        ) : null}
        {/* gr2-015 / controller ruling (c): THE BEAT GETS AIR. Measured at
            1088, the signature moment was 8% of the page height with no rest
            either side, reached by accident on the way to Fig. 2. §2.7's block
            ORDER is untouched (that was the alternative, and it reverses the
            argument the accounting builds toward); the stamp simply gets a
            block of its own to land in. Reveal.css carries the padding and the
            scroll snap. */}
        <div className="ph-reveal__stamp-beat">
          {/* The stamp slams onto a cover, not onto the page (§2.7.4). This is
              a plain echo of the day's manuscript, built from store state --
              the Published screen owns the real JournalCover. */}
          <div className="ph-reveal__cover">
            <div className="ph-reveal__cover-card" data-role="cover-echo">
              {/* T29 pin 3: the same JOURNAL_VOLUME the running header reads,
                  never a second literal — see src/ui/masthead.ts. */}
              <p className="ph-reveal__cover-vol">
                {t('briefing.vol', { volume: JOURNAL_VOLUME, issue: puzzleNumber })}
              </p>
              <p className="ph-reveal__cover-title">{scenario.question}</p>
            </div>
            <div className="ph-reveal__stamp">
              <Stamp kind={payload.stamp} label={t(STAMP_LABEL[payload.stamp])} animate={!reducedMotion} />
            </div>
          </div>
          {/* gr6-059: THE SUBLINE, HORIZONTAL, BENEATH THE CARD.
              It used to be a rotated <text> node inside the stamp's own SVG,
              drawn at -12deg across the second line of the day's question — so
              Act II's only voice on this screen was also its least readable
              string, and both it and the question were crossed through. It is
              also what made the stamp paint outside the window (see Stamp.tsx's
              geometry note: a 49-character mono line is 556 user units wide in
              a 320-unit viewBox). Out here it is ordinary prose, read once, in
              reading order, after the verdict it comments on. */}
          {subline === undefined ? null : (
            <p className="ph-reveal__stamp-subline" data-role="stamp-subline">
              {subline}
            </p>
          )}
        </div>
      </Block>

      {/* 5 — the call resolution (§2.7.5).
          Prereg Mode never visits the CALL screen (§2.8: the prereg score rows
          replace it entirely), so `call` stays null for the whole day.
          gr6-003: the WHOLE SECTION is now conditional, not just its contents.
          It used to render as an empty <section data-block="call"> on every
          prereg reveal — an element in the block sequence, in the accessibility
          tree, and carrying `.ph-fade + .ph-fade`'s --space-40, announcing a
          beat that does not exist. Five blocks on a prereg day is the honest
          count; §2.7's ORDER is unchanged, and so is every hacking day. */}
      {call === null ? null : (
        <Block name="call" index={4}>
          <p className="ph-reveal__statement">
            {t(callIsCorrect(call, payload.dayType) ? 'reveal.callCorrect' : 'reveal.callIncorrect')}
          </p>
        </Block>
      )}

      {/* 6 — §2.7.6's grouped view, on BOTH day types: an effect day shows
          significance clustering on the true outcome, a null day shows the
          same thinly-scattered hits everywhere. "The single most important
          educational graphic in the game" teaches by the contrast, which
          means it has to be there on the days with nothing to cluster. */}
      {/* w1-r-009: the index is DOM ORDER, which Reveal.css's own note says it
          is — so with the call block conditional it has to close the gap on a
          prereg day rather than leave a one-step hole in the ramp at 4.
          (staggerStyle caps at 2, so this is invisible in the common case and
          exactly the kind of thing that rots into a false comment.) */}
      <Block name="fig2" index={call === null ? 4 : 5}>
        <Figure number={t('reveal.fig2')} caption={t('reveal.groupedCaption')} footnote={null}>
          <SpecCurve points={points} grouped outcomeLabels={scenario.outcomeLabels} copy={copy} />
        </Figure>
      </Block>

      {/* T33 — the day's primary continue action, and (until this task) the
          missing one: store.finishReveal() had NO caller anywhere in src/ui,
          so the Summary screen — the invoice, the share string and the app's
          one persistence moment — was simply unreachable in the real app and
          the reveal ended at Fig. 2. Deliberately OUTSIDE the last Block: a
          Block is a scroll-gated section of the argument (R5.2 site 3), and an action
          that can be hidden by an IntersectionObserver that never fires is an
          action that can strand the player. Full width, after everything, so
          it cannot be mistaken for one more caption. */}
      <button type="button" className="ph-reveal__cta ph-focusable" data-role="to-summary" onClick={finishReveal}>
        {t('reveal.toSummary')}
      </button>
    </div>
  );
}
