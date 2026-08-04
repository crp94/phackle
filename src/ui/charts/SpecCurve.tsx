// The centerpiece (master spec §7.4; DESIGN.md R1.3, R1.4, R4.1, R4.3, R6.3,
// R8.3). A specification curve: every analysis the day admitted, sorted by
// p-value, with the one the player published marked.
//
// This file exports its pure geometry (curveY, the pinned y-mapping;
// nearestIndex; recipeLabel; the viewBox constants) alongside the component
// that draws with it, because those are exactly what §7.4 pins by value and
// what tests/ui/speccurve.test.tsx asserts directly. Same trade, and same
// inline waiver, as src/i18n/LocaleProvider.tsx's hook export.
/* eslint-disable react-refresh/only-export-components */
//
// Custom SVG, no chart library, RENDER ONCE: the layout is a single useMemo
// over the points, and hovering swaps a tooltip in an HTML overlay rather
// than touching a single circle's geometry. 1,792 static circles is fine
// (§7.4 says so in as many words); 1,792 React event handlers would not be,
// so one transparent overlay rect owns the pointer and resolves the nearest
// point arithmetically.
//
// Colour discipline: the base points are --rule. That is a fill of a token
// R1.4 reserves for hairlines -- but §7.4 pins "all paths as 1.5 px points
// (--rule color)" by name, and DESIGN.md's own precedence clause puts
// implementation_plan §7 above it. The sanctioned --sig-red uses here are
// R1.3's places 2 and 3: the .05 threshold rule and its label, and the
// published point with its ring and leader line.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CopyKey } from '../../content/en/copy';
import type { Outcome, Spec } from '../../engine/types';
import './SpecCurve.css';

export interface SpecCurvePoint {
  p: number;
  outcome: Outcome;
  explored: boolean;
  published: boolean;
  spec: Spec;
}

export interface SpecCurveProps {
  points: SpecCurvePoint[];
  grouped: boolean;
  outcomeLabels: string[];
  copy: Record<CopyKey, string>;
}

/**
 * SCALE INVARIANCE (review I3). An SVG with a fixed viewBox scales its own
 * interior: a 13-unit label in a 720-unit box renders at 5.8 CSS px on a
 * 320 px phone and at 19.6 CSS px on a 1088 px desktop -- illegible on the
 * surface most players will use, and ballooned past the design system's 13 px
 * captions on the one they won't. The first draft of this figure was reviewed
 * at ~660 px, the single width where that artifact is invisible.
 *
 * The fix is to make the viewBox TRACK the container instead of scaling
 * inside it: one user unit is then one CSS pixel at every width, so
 * `font-size: var(--text-13)` really is 13 px and `hitRadius` really is 12 px,
 * everywhere. The plot simply gets narrower on a phone -- which is what should
 * happen -- and nothing in this file has to divide by a scale factor.
 *
 * `cssPixelsPerUnit` is therefore exactly 1 across the whole supported range,
 * and that is the property the unit tests pin at 320 / 660 / 1088. Below
 * FIGURE_MIN_WIDTH it degrades predictably rather than going degenerate.
 */
export const FIGURE_TEXT_PX = 13;
export const HIT_RADIUS_PX = 12;
/** DESIGN.md's own floor (R2.5 sizes the dial for the small viewport). Under
 * this the plot is too cramped to wrap a recipe, so the figure shrinks
 * proportionally instead of laying out into nothing. */
export const FIGURE_MIN_WIDTH = 320;
/** A sanity guard on a bad measurement only: `--page-max` (68rem = 1088 px)
 * caps the reveal's column well inside it, so this never binds in the app. */
export const FIGURE_MAX_WIDTH = 2048;
/** Used until a ResizeObserver reports, and in environments without one. */
export const FIGURE_DEFAULT_WIDTH = 720;

export interface FigureGeometry {
  width: number;
  height: number;
  plotWidth: number;
  plotHeight: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  bandGap: number;
  bandWidth: number;
  /** Keeps the first and last ranked points (and the published point's ring,
   * the widest mark in the figure) clear of the axis and the right edge --
   * the published path is almost always rank ~0, so without this it lands
   * exactly on the y-axis every time. */
  plotInset: number;
  /** Pointer proximity, in user units == CSS px, that counts as a hover. */
  hitRadius: number;
  calloutX: number;
  /** Where the recipe callout's LEADER starts, as a fraction of the plot
   * width (T16's deferred minor, closed by T29 pin 5). See `leaderAnchorX`. */
  leaderAnchorFraction: number;
  /** The fallback anchor, used when the published point sits under the
   * primary one — see `leaderAnchorX`. */
  leaderFallbackFraction: number;
  /** How many characters of recipe fit on one callout line at this width. */
  calloutMaxChars: number;
  /** How many characters of outcome label fit on one band-label line. */
  bandLabelMaxChars: number;
}

/** Average glyph advance as a fraction of the font size, for the UI sans at
 * sentence case. Deliberately generous: over-estimating the advance wraps a
 * line early, under-estimating it overflows the plate. */
const GLYPH_ADVANCE = 0.55;

/**
 * T16 deferred minor, closed by T29 pin 5. The leader used to start at
 * `calloutX` (= padLeft + 4) — four pixels right of the y-axis. The published
 * path is almost always rank ~0, i.e. `padLeft + plotInset` = padLeft + 12,
 * so the leader ran from x=44 to x=52 over ~200px of height: a red line
 * parallel to the y-axis, reading as axis furniture rather than as a pointer.
 * Anchoring it ~40% across the plot restores a real diagonal, which is the
 * whole visual job of a leader line.
 */
const LEADER_ANCHOR_FRACTION = 0.4;
/** ...and when the published point happens to sit under that anchor (a
 * player who published a mid-ranked p, not the day's minimum), 40% would be
 * vertical all over again. 12% is far enough away to be a clear diagonal and
 * still close to the callout text it leaves from. */
const LEADER_FALLBACK_FRACTION = 0.12;
/** How close counts as "under the anchor", as a fraction of plot width. */
const LEADER_MIN_RUN_FRACTION = 0.12;

/**
 * Where the recipe callout's leader line starts. Pure, and exported, because
 * it is the whole of pin 5 and tests/ui/speccurve.test.tsx asserts it
 * directly at both branches.
 */
export function leaderAnchorX(publishedX: number, geom: FigureGeometry): number {
  const primary = geom.padLeft + geom.plotWidth * geom.leaderAnchorFraction;
  if (Math.abs(publishedX - primary) >= geom.plotWidth * LEADER_MIN_RUN_FRACTION) return primary;
  return geom.padLeft + geom.plotWidth * geom.leaderFallbackFraction;
}

export function geometryFor(containerWidth: number, grouped: boolean): FigureGeometry {
  const measured = Math.round(containerWidth) || FIGURE_DEFAULT_WIDTH;
  const width = Math.min(Math.max(measured, FIGURE_MIN_WIDTH), FIGURE_MAX_WIDTH);
  const padLeft = 40;
  const padRight = 16;
  const padTop = 16;
  // Grouped mode reserves three label lines: four of the eighty shipped
  // outcome labels need them, and a truncated axis label is a figure that lies.
  const padBottom = grouped ? 56 : 16;
  const plotHeight = 320;
  const plotWidth = width - padLeft - padRight;
  const bandGap = 12;
  const bandWidth = (plotWidth - bandGap * 3) / 4;
  const calloutX = padLeft + 4;
  const perChar = FIGURE_TEXT_PX * GLYPH_ADVANCE;
  return {
    width,
    height: padTop + plotHeight + padBottom,
    plotWidth,
    plotHeight,
    padLeft,
    padRight,
    padTop,
    padBottom,
    bandGap,
    bandWidth,
    plotInset: 12,
    hitRadius: HIT_RADIUS_PX,
    calloutX,
    leaderAnchorFraction: LEADER_ANCHOR_FRACTION,
    leaderFallbackFraction: LEADER_FALLBACK_FRACTION,
    calloutMaxChars: Math.max(12, Math.floor((width - calloutX - padRight) / perChar)),
    bandLabelMaxChars: Math.max(6, Math.floor(bandWidth / perChar)),
  };
}

/** CSS pixels per viewBox user unit at a given container width: 1 across the
 * whole supported range, by construction. */
export function cssPixelsPerUnit(containerWidth: number): number {
  const measured = Math.round(containerWidth) || FIGURE_DEFAULT_WIDTH;
  return measured / geometryFor(measured, false).width;
}

/** The default geometry, kept as a named export because the y-mapping tests
 * and the reveal's fixtures address it directly. */
export const SPEC_CURVE_GEOM = geometryFor(FIGURE_DEFAULT_WIDTH, false);

const BANDS: Outcome[] = [0, 1, 2, 3];

/** Baseline-to-baseline for wrapped callout and band-label lines. */
const CALLOUT_LINE = 14;

/**
 * The pinned zoom-band mapping (§7.4, controller pin):
 *
 *   f(p) = p <= 0.10 ? (p/0.10)*0.60 : 0.60 + ((p-0.10)/0.90)*0.40
 *   y    = H · (1 - f)
 *
 * so p = 0 sits on the floor, p = 1 on the ceiling, and the interesting
 * region 0-0.10 gets 60% of the pixels instead of 10% of them. The .05
 * threshold consequently lands at exactly 70% of the height.
 */
export function curveY(p: number, height: number): number {
  const f = p <= 0.1 ? (p / 0.1) * 0.6 : 0.6 + ((p - 0.1) / 0.9) * 0.4;
  return height * (1 - f);
}

/** §7.4's tooltip format: three decimals, always a decimal point
 * (about.decimalNote), and a floor rather than a misleading "0.000". */
export function formatP(p: number, copy: Record<CopyKey, string>): string {
  if (p < 0.001) return copy['reveal.pValueTiny'];
  return copy['reveal.pValue'].replace('{p}', p.toFixed(3));
}

/** Notation, not prose: the separator §7.4's own example uses between the six
 * forks of a recipe. Localized labels sit on either side of it. */
const RECIPE_SEP = ' · ';

const SUBGROUP_KEY: Record<Spec['subgroup'], CopyKey> = {
  all: 'reveal.subgroupAll',
  age_lt40: 'reveal.subgroupAgeLt40',
  age_ge40: 'reveal.subgroupAgeGe40',
  exp_high: 'reveal.subgroupExpHigh',
  exp_low: 'reveal.subgroupExpLow',
  urban: 'reveal.subgroupUrban',
  rural: 'reveal.subgroupRural',
};

const EXCLUSION_KEY: Record<Spec['exclusion'], CopyKey> = {
  none: 'reveal.exclusionNone',
  z3: 'reveal.exclusionZ3',
  z2_5: 'reveal.exclusionZ25',
  z2: 'reveal.exclusionZ2',
};

const TRANSFORM_KEY: Record<Spec['transform'], CopyKey> = {
  raw: 'reveal.transformRaw',
  log1p: 'reveal.transformLog',
};

const TAILS_KEY: Record<Spec['tails'], CopyKey> = {
  two: 'reveal.tailsTwo',
  one: 'reveal.tailsOne',
};

/**
 * The outcome column's notation, 1-based to match the DGP's own Y1..Y4
 * naming (§3.2's fixed order: heavy-tailed, skewed, count, bounded scale).
 * Notation, like RECIPE_SEP and the decimal point -- identical in every
 * language, so it is a constant here rather than four copy keys a translator
 * would be invited to translate.
 */
const OUTCOME_NOTATION = ['Y₁', 'Y₂', 'Y₃', 'Y₄'];

/** The five forks after the outcome, which both recipe forms share. */
function recipeTail(spec: Spec, copy: Record<CopyKey, string>): string[] {
  const covariates = [
    spec.covariates.income ? copy['reveal.covIncome'] : null,
    spec.covariates.risk ? copy['reveal.covRisk'] : null,
  ].filter((label): label is string => label !== null);

  return [
    copy[SUBGROUP_KEY[spec.subgroup]],
    covariates.length === 0 ? copy['reveal.covNone'] : covariates.join(' '),
    copy[EXCLUSION_KEY[spec.exclusion]],
    copy[TRANSFORM_KEY[spec.transform]],
    copy[TAILS_KEY[spec.tails]],
  ];
}

/** "30-day portfolio return · Age<40 · +Income · |z|>2.5 · log · one-tailed"
 * -- §7.4's recipe line in full, every segment localized: the outcome from
 * the day's scenario, the other five from the copy catalog. This is the form
 * the tooltip and the reveal's published-recipe text line use. */
export function recipeLabel(spec: Spec, outcomeLabels: string[], copy: Record<CopyKey, string>): string {
  return [outcomeLabels[spec.outcome] ?? '', ...recipeTail(spec, copy)].join(RECIPE_SEP);
}

/**
 * "Y₂ · Age<40 · +Income · |z|>2.5 · log · one-tailed" -- §7.4's worked
 * example verbatim, and the reason it abbreviates: a shipped outcome label
 * runs to 55 characters ("Attendee-rated sense that this could have been an
 * email"), which pushes the full recipe to 107-126 characters and straight
 * off the plate into the gutter. The callout takes the notation; the full
 * label is a hover away in the tooltip, and set as real text under the
 * accounting for anyone not using a pointer.
 */
export function recipeLabelCompact(spec: Spec, copy: Record<CopyKey, string>): string {
  return [OUTCOME_NOTATION[spec.outcome] ?? '', ...recipeTail(spec, copy)].join(RECIPE_SEP);
}

/** Under this many characters per band, even a single word of a shipped
 * outcome label ("Attendee-rated") runs past its band and collides with the
 * neighbour's -- observed at a 320px container, where a band is 57px wide. */
const BAND_LABEL_MIN_CHARS = 12;

/**
 * Fig. 2's band label: the outcome's name where it fits, and §7.4's notation
 * where it cannot. On a phone four labels share ~260px, which is not enough
 * for four names and never will be; the notation degrades honestly instead of
 * overlapping, it is the same abbreviation the callout uses, and the full
 * label stays one tap away in the tooltip (and in the truth line above, which
 * names the true outcome in words).
 */
export function bandLabel(band: Outcome, outcomeLabels: string[], geom: FigureGeometry): string {
  if (geom.bandLabelMaxChars >= BAND_LABEL_MIN_CHARS) return outcomeLabels[band] ?? '';
  return OUTCOME_NOTATION[band] ?? '';
}

interface Placed {
  x: number;
  y: number;
  point: SpecCurvePoint;
}

/** Closest placed point to (x, y) within `maxDist` user units, or null.
 * Exported because it is the whole of the hover behaviour: the overlay just
 * converts client coordinates and asks this. */
export function nearestIndex(
  placed: { x: number; y: number }[],
  x: number,
  y: number,
  maxDist: number
): number | null {
  let best = -1;
  let bestDist = maxDist * maxDist;
  for (let i = 0; i < placed.length; i++) {
    const dx = placed[i].x - x;
    const dy = placed[i].y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best === -1 ? null : best;
}

/** Rank order by p ascending; ties broken by original index so the layout is
 * a pure function of the payload (§3.1's determinism, extended to pixels). */
function rankOrder(points: SpecCurvePoint[], indices: number[]): number[] {
  return [...indices].sort((a, b) => points[a].p - points[b].p || a - b);
}

function place(points: SpecCurvePoint[], grouped: boolean, geom: FigureGeometry): Placed[] {
  const out: Placed[] = [];
  const spread = (order: number[], left: number, width: number) => {
    const inner = Math.max(0, width - geom.plotInset * 2);
    order.forEach((i, rank) => {
      const x =
        order.length <= 1
          ? left + width / 2
          : left + geom.plotInset + (rank / (order.length - 1)) * inner;
      out.push({ x, y: geom.padTop + curveY(points[i].p, geom.plotHeight), point: points[i] });
    });
  };

  const all = points.map((_, i) => i);
  if (!grouped) {
    spread(rankOrder(points, all), geom.padLeft, geom.plotWidth);
    return out;
  }
  for (const band of BANDS) {
    const members = all.filter((i) => points[i].outcome === band);
    spread(rankOrder(points, members), geom.padLeft + band * (geom.bandWidth + geom.bandGap), geom.bandWidth);
  }
  return out;
}

/** Greedy wrap for an outcome band label -- SVG text does not wrap, and
 * "Attendee-rated sense that this could have been an email" does not fit one
 * band on one line. Three lines at 22 characters covers all eighty shipped
 * labels; anything longer still ends in an ellipsis rather than in the
 * caption below it. */
export function wrapLabel(label: string, maxChars: number, maxLines = 3): string[] {
  const lines: string[] = [''];
  for (const word of label.split(' ')) {
    const last = lines.length - 1;
    const candidate = lines[last] === '' ? word : `${lines[last]} ${word}`;
    if (candidate.length <= maxChars || lines[last] === '') lines[last] = candidate;
    else if (lines.length < maxLines) lines.push(word);
    else if (!lines[last].endsWith('…')) lines[last] = `${lines[last]}…`;
  }
  return lines.filter((line) => line !== '');
}

/**
 * The point cloud — up to 1,792 circles, painted back to front so the
 * published path is never buried.
 *
 * `memo`'d (T29 pin 7). This file's own header already promises "RENDER
 * ONCE... hovering swaps a tooltip in an HTML overlay rather than touching a
 * single circle's geometry" — true of the DOM, but not of the reconciler:
 * `hovered` lived on SpecCurve itself, so every pointermove re-ran the whole
 * element tree, diffing ~1,792 circles to discover that none of them changed.
 * `placed` is already a `useMemo` over (points, grouped, geom), none of which
 * a hover touches, so a memo boundary here makes the promise literally true:
 * a hover now reconciles the tooltip and nothing else.
 */
const Dots = memo(function Dots({ placed, published }: { placed: Placed[]; published: Placed | null }) {
  return (
    <g className="ph-speccurve__dots">
      {placed.map((entry, i) =>
        entry.point.published || entry.point.explored ? null : (
          <circle
            key={i}
            className="ph-speccurve__dot ph-speccurve__dot--base"
            cx={entry.x}
            cy={entry.y}
            data-p={entry.point.p}
            data-outcome={entry.point.outcome}
          />
        )
      )}
      {placed.map((entry, i) =>
        entry.point.explored && !entry.point.published ? (
          <circle
            key={i}
            className="ph-speccurve__dot ph-speccurve__dot--explored"
            cx={entry.x}
            cy={entry.y}
            data-p={entry.point.p}
            data-outcome={entry.point.outcome}
          />
        ) : null
      )}
      {published === null ? null : (
        <>
          {/* R6.3: shape as well as colour -- the ring is the shape. */}
          <circle className="ph-speccurve__ring" cx={published.x} cy={published.y} />
          <circle
            className="ph-speccurve__dot ph-speccurve__dot--published"
            cx={published.x}
            cy={published.y}
            data-p={published.point.p}
            data-outcome={published.point.outcome}
          />
        </>
      )}
    </g>
  );
});

export function SpecCurve({ points, grouped, outcomeLabels, copy }: SpecCurveProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  // null until measured; the viewBox tracks the container so one user unit is
  // one CSS pixel at every width (see the FIGURE_* block above).
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = plotRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      if (measured > 0) setContainerWidth(measured);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geom = useMemo(
    () => geometryFor(containerWidth ?? FIGURE_DEFAULT_WIDTH, grouped),
    [containerWidth, grouped]
  );
  const placed = useMemo(() => place(points, grouped, geom), [points, grouped, geom]);

  const height = geom.height;
  const thresholdY = geom.padTop + curveY(0.05, geom.plotHeight);
  const seamY = geom.padTop + curveY(0.1, geom.plotHeight);
  const plotBottom = geom.padTop + geom.plotHeight;
  const publishedIndex = placed.findIndex((entry) => entry.point.published);
  const published = publishedIndex === -1 ? null : placed[publishedIndex];
  const tip = hovered === null ? null : placed[hovered];
  // §7.4's compact notation, wrapped to whatever this width actually fits.
  const calloutLines =
    published === null ? [] : wrapLabel(recipeLabelCompact(published.point.spec, copy), geom.calloutMaxChars, 2);

  function handlePointer(event: ReactPointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * geom.width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    setHovered(nearestIndex(placed, x, y, geom.hitRadius));
  }

  return (
    <div className="ph-speccurve">
      <div className="ph-speccurve__plot" ref={plotRef}>
        <svg
          ref={svgRef}
          className="ph-speccurve__svg"
          viewBox={`0 0 ${geom.width} ${height}`}
          role="img"
          // T22 — the two figures are DIFFERENT PICTURES and now say so. Both
          // plates shipped with the same aria-label, so a screen reader met
          // fig. 1 and fig. 2 as one repeated sentence about a "sorted" curve
          // — which is a description of the first plate and a plain
          // misstatement of the second, whose whole subject is the four
          // outcome bands (§2.7.6). The old string also claimed "with your
          // published specification highlighted" unconditionally, which is
          // false on the abandon path, where nothing is published and the
          // legend below correctly drops its own published row. Both strings
          // now describe the PLATE and stop; what is in it is the
          // figcaption's job (reveal.curveCaption / curveCaptionAbandoned /
          // groupedCaption, all already read), and the published path's
          // recipe is spelled out as real text by reveal.publishedRecipe.
          aria-label={copy[grouped ? 'a11y.specCurveGrouped' : 'a11y.specCurveChart']}
        >
          {/* The one filled area in the whole product (R4.1): p < .05. */}
          <rect
            data-role="sig-band"
            className="ph-speccurve__band"
            x={geom.padLeft}
            y={thresholdY}
            width={geom.plotWidth}
            height={plotBottom - thresholdY}
          />

          {/* Axis furniture: the floor, and the zoom-band seam at p = .10. */}
          <line
            className="ph-speccurve__axis"
            x1={geom.padLeft}
            y1={plotBottom}
            x2={geom.padLeft + geom.plotWidth}
            y2={plotBottom}
          />
          <line className="ph-speccurve__axis" x1={geom.padLeft} y1={seamY} x2={geom.padLeft + geom.plotWidth} y2={seamY} />
          {[0, 0.1, 1].map((value) => (
            <text
              key={value}
              className="ph-speccurve__tick"
              x={geom.padLeft - 8}
              y={geom.padTop + curveY(value, geom.plotHeight)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {value.toFixed(2)}
            </text>
          ))}

          {/* R1.3 place 2: the threshold and its label. */}
          <line
            data-role="threshold"
            className="ph-speccurve__threshold"
            x1={geom.padLeft}
            y1={thresholdY}
            x2={geom.padLeft + geom.plotWidth}
            y2={thresholdY}
          />
          <text
            data-role="threshold-label"
            className="ph-speccurve__threshold-label"
            x={geom.padLeft + geom.plotWidth}
            y={thresholdY - 6}
            textAnchor="end"
          >
            {copy['legend.significant']}
          </text>

          {/* Points, painted back to front so the published path is never
              buried — and behind a memo boundary, so a hover never diffs
              them (T29 pin 7). */}
          <Dots placed={placed} published={published} />

          {/* The recipe callout, in fig. 1's guaranteed-empty upper left: the
              cloud rises monotonically left to right, so nothing lives there.
              Fig. 2's four rising bands have no such empty corner, and its
              subject is clustering rather than one path -- the published point
              keeps its ring there, and the callout stands down. */}
          {published === null || grouped ? null : (
            <>
              {/* T29 pin 5: the leader leaves the callout ~40% across the
                  plot, not four pixels off the y-axis — see leaderAnchorX. */}
              <line
                data-role="leader"
                className="ph-speccurve__leader"
                x1={leaderAnchorX(published.x, geom)}
                y1={geom.padTop + 6 + calloutLines.length * CALLOUT_LINE}
                x2={published.x}
                y2={published.y}
              />
              <text
                data-role="callout"
                className="ph-speccurve__callout"
                x={geom.calloutX}
                y={geom.padTop + 12}
              >
                {calloutLines.map((line, i) => (
                  <tspan key={i} x={geom.calloutX} dy={i === 0 ? 0 : CALLOUT_LINE}>
                    {line}
                  </tspan>
                ))}
              </text>
            </>
          )}

          {/* Fig. 2's four outcome bands (§2.7.6). */}
          {!grouped
            ? null
            : BANDS.map((band) => {
                const centre = geom.padLeft + band * (geom.bandWidth + geom.bandGap) + geom.bandWidth / 2;
                return (
                  <text
                    key={band}
                    data-role="band-label"
                    data-outcome={band}
                    className="ph-speccurve__band-label"
                    x={centre}
                    y={plotBottom + 16}
                    textAnchor="middle"
                  >
                    {wrapLabel(bandLabel(band, outcomeLabels, geom), geom.bandLabelMaxChars).map((line, i) => (
                      <tspan key={i} x={centre} dy={i === 0 ? 0 : CALLOUT_LINE}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                );
              })}

          {/* One overlay owns the pointer for every point: a generous hit
              target everywhere, and no per-point handler or re-layout. */}
          <rect
            data-role="hit"
            className="ph-speccurve__hit"
            x={geom.padLeft}
            y={geom.padTop}
            width={geom.plotWidth}
            height={geom.plotHeight}
            onPointerDown={handlePointer}
            onPointerMove={handlePointer}
            onPointerLeave={() => setHovered(null)}
          />
        </svg>

        {tip === null ? null : (
          <div
            data-role="tooltip"
            className={[
              'ph-speccurve__tooltip',
              tip.y < height * 0.25 ? 'ph-speccurve__tooltip--below' : '',
              tip.x > geom.width * 0.7 ? 'ph-speccurve__tooltip--end' : '',
              tip.x < geom.width * 0.3 ? 'ph-speccurve__tooltip--start' : '',
            ]
              .filter((name) => name !== '')
              .join(' ')}
            style={{ left: `${(tip.x / geom.width) * 100}%`, top: `${(tip.y / height) * 100}%` }}
          >
            <span className="ph-speccurve__tooltip-recipe">{recipeLabel(tip.point.spec, outcomeLabels, copy)}</span>
            <span className="ph-speccurve__tooltip-p">{formatP(tip.point.p, copy)}</span>
          </div>
        )}
      </div>

      <ul data-role="legend" className="ph-speccurve__legend">
        <li className="ph-speccurve__legend-item">
          <svg className="ph-speccurve__swatch" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="ph-speccurve__key-dot ph-speccurve__key-dot--base" cx="12" cy="12" />
          </svg>
          {copy['legend.unexplored']}
        </li>
        <li className="ph-speccurve__legend-item">
          <svg className="ph-speccurve__swatch" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="ph-speccurve__key-dot ph-speccurve__key-dot--explored" cx="12" cy="12" />
          </svg>
          {copy['legend.explored']}
        </li>
        {/* A player who reported a null result published nothing; a legend
            row for a mark that is not in the figure is a small lie. */}
        {published === null ? null : (
          <li className="ph-speccurve__legend-item">
            <svg className="ph-speccurve__swatch" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="ph-speccurve__key-ring" cx="12" cy="12" />
              <circle className="ph-speccurve__key-dot ph-speccurve__key-dot--published" cx="12" cy="12" />
            </svg>
            {copy['legend.published']}
          </li>
        )}
      </ul>
    </div>
  );
}
