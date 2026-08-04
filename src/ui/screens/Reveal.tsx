// THE REVEAL — Act II (master spec §2.7, §7.3 "Reveal"; DESIGN.md R1.3, R2.4,
// R3.2, R5.3, R5.6, R8.2, R8.3).
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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore } from '../../game/store';
import { callIsCorrect } from '../../game/scoring';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { JOURNAL_VOLUME } from '../masthead';
import { Stamp } from '../components/Stamp';
import { SpecCurve, recipeLabel, type SpecCurvePoint } from '../charts/SpecCurve';
import type { CopyKey } from '../../content/en/copy';
import type { RevealCurveEntry } from '../../engine/reveal';
import type { RevealPayload } from '../../engine/protocol';
import './Reveal.css';

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
  return rounded.toFixed(Math.max(0, digits - 1 - magnitude));
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
 * One scroll-fade block (R5.3: opacity only, 300ms, one block per
 * intersection). Fails OPEN in every direction that could hide content: no
 * IntersectionObserver, reduced motion, or a node that never mounts all mean
 * "visible now" rather than "visible never".
 */
function Block({ name, children }: { name: string; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(
    () => reducedMotion || typeof IntersectionObserver === 'undefined'
  );

  useEffect(() => {
    if (visible || typeof IntersectionObserver === 'undefined') return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <section ref={ref} data-block={name} className={visible ? 'ph-fade ph-fade--in' : 'ph-fade'}>
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
  const payload = useGameStore((s) => s.reveal);
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

  // 3 — the accounting (§2.7.3), every figure computed from the payload.
  const accounting1 = interpolate(copy['reveal.accounting1'], {
    total: { text: formatCount(payload.totalPaths), numeral: true },
    sig: { text: formatCount(payload.sigPaths), numeral: true, sig: true },
    sigPct: { text: formatPercent(payload.sigFraction, 1), numeral: true, sig: true },
  });
  const exploredKey: CopyKey = published === null ? 'reveal.accounting2Abandoned' : 'reveal.accounting2';
  const accounting2 = interpolate(copy[exploredKey], {
    k: { text: formatCount(payload.playerExplored), numeral: true },
  });
  const accounting3 = interpolate(copy['reveal.accounting3'], {
    k: { text: formatCount(payload.playerExplored), numeral: true },
    pHitPct: { text: formatPercent(payload.pHitAtK, 0), numeral: true },
  });
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
  const subline =
    payload.stamp === 'RETRACTED' && content.retractionSublines.length > 0
      ? content.retractionSublines[puzzleNumber % content.retractionSublines.length]
      : undefined;

  return (
    <div className="ph-reveal">
      <Block name="truth">
        <p className="ph-reveal__truth">{truth}</p>
      </Block>

      <Block name="fig1">
        <Figure
          number={t('reveal.fig1')}
          caption={t(published === null ? 'reveal.curveCaptionAbandoned' : 'reveal.curveCaption')}
          footnote={omitted === 0 ? null : t('reveal.omittedFootnote', { n: formatCount(omitted) })}
        >
          <SpecCurve points={points} grouped={false} outcomeLabels={scenario.outcomeLabels} copy={copy} />
        </Figure>
      </Block>

      <Block name="accounting">
        <div className="ph-reveal__accounting">
          <p className="ph-reveal__statement">{accounting1}</p>
          <p className="ph-reveal__statement">{accounting2}</p>
          <p className="ph-reveal__statement">{accounting3}</p>
          {surcharge === null ? null : <p className="ph-reveal__statement">{surcharge}</p>}
          {/* The figure is role="img", so its recipe callout reaches neither a
              screen reader nor the tab key -- and §7.4's callout abbreviates
              the outcome to Y-notation anyway. This is the one place the
              published recipe exists as real text, in full labels. */}
          {published === null ? null : (
            <p className="ph-reveal__published-recipe" data-role="published-recipe">
              {t('reveal.publishedRecipe', { recipe: recipeLabel(published, scenario.outcomeLabels, copy) })}
            </p>
          )}
        </div>
      </Block>

      <Block name="stamp">
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
            <Stamp
              kind={payload.stamp}
              label={t(STAMP_LABEL[payload.stamp])}
              subline={subline}
              animate={!reducedMotion}
            />
          </div>
        </div>
        {/* T18 (§2.8's own parenthetical: "a real 5% false positive —
            teachable"): a preregistered commit that lands on RETRACTED on a
            NULL day did nothing wrong — this is exactly what a 5% false-
            positive rate looks like from the inside, not a mistake to
            explain away. Gated on the exact, newly-possible combination T18
            introduces (RETRACTED with no CALL step at all): every OTHER
            RETRACTED case (Hacking Mode, or a prereg commit on an effect day
            that hit the wrong outcome, §2.7.4) keeps the plain stamp with no
            added line, unchanged from before this task. */}
        {mode === 'prereg' && payload.dayType === 'null' && payload.stamp === 'RETRACTED' ? (
          <p className="ph-reveal__statement">{t('reveal.preregFalsePositive')}</p>
        ) : null}
      </Block>

      <Block name="call">
        {/* Prereg Mode never visits the CALL screen (§2.8: the prereg score
            rows replace it entirely) — `call` stays null for the whole day,
            so this block already renders nothing on a prereg reveal, with no
            mode check needed: it was already gated on the right thing. */}
        {call === null ? null : (
          <p className="ph-reveal__statement">
            {t(callIsCorrect(call, payload.dayType) ? 'reveal.callCorrect' : 'reveal.callIncorrect')}
          </p>
        )}
      </Block>

      {/* 6 — §2.7.6's grouped view, on BOTH day types: an effect day shows
          significance clustering on the true outcome, a null day shows the
          same thinly-scattered hits everywhere. "The single most important
          educational graphic in the game" teaches by the contrast, which
          means it has to be there on the days with nothing to cluster. */}
      <Block name="fig2">
        <Figure number={t('reveal.fig2')} caption={t('reveal.groupedCaption')} footnote={null}>
          <SpecCurve points={points} grouped outcomeLabels={scenario.outcomeLabels} copy={copy} />
        </Figure>
      </Block>

      {/* T33 — the day's primary continue action, and (until this task) the
          missing one: store.finishReveal() had NO caller anywhere in src/ui,
          so the Summary screen — the invoice, the share string and the app's
          one persistence moment — was simply unreachable in the real app and
          the reveal ended at Fig. 2. Deliberately OUTSIDE the last Block: a
          Block is a scroll-fade section of the argument (R5.3), and an action
          that can be hidden by an IntersectionObserver that never fires is an
          action that can strand the player. Full width, after everything, so
          it cannot be mistaken for one more caption. */}
      <button type="button" className="ph-reveal__cta" data-role="to-summary" onClick={finishReveal}>
        {t('reveal.toSummary')}
      </button>
    </div>
  );
}
