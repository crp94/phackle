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
import { useMemo, useRef, useState } from 'react';
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
 * Figure geometry in viewBox user units. The SVG scales to its container
 * (width 100%, height auto), so these are aspect-ratio coordinates, not CSS
 * pixels -- DESIGN.md's closed spacing/type scales govern the page around the
 * figure, not the inside of a plot, but the values are drawn from that scale
 * anyway so nothing here looks foreign next to it.
 *
 * `height` is the ungrouped total; grouped mode reserves two extra lines
 * under the plot for the outcome band labels (see `heightFor`).
 */
export const SPEC_CURVE_GEOM = {
  width: 720,
  height: 352,
  plotWidth: 664,
  plotHeight: 320,
  padLeft: 40,
  padRight: 16,
  padTop: 16,
  padBottom: 16,
  /** Extra room under the plot for wrapped band labels in grouped mode --
   * three lines, because four of the eighty shipped outcome labels need
   * them and a truncated axis label is a figure that lies. */
  padBottomGrouped: 56,
  /** Horizontal gap between the four outcome bands of fig. 2. */
  bandGap: 12,
  /** Keeps the first and last ranked points (and the published point's ring,
   * which is the widest mark in the figure) clear of the axis and the right
   * edge -- the published path is almost always rank ~0, so without this it
   * lands exactly on the y-axis every time. */
  plotInset: 12,
  /** Pointer proximity, in user units, that counts as hovering a point. The
   * figure renders ~660 CSS px wide, so 12 units is ~11 px in every
   * direction -- comfortably past the 8 px floor, on a touch screen too. */
  hitRadius: 12,
} as const;

const G = SPEC_CURVE_GEOM;
const BAND_WIDTH = (G.plotWidth - G.bandGap * 3) / 4;
const BANDS: Outcome[] = [0, 1, 2, 3];

function heightFor(grouped: boolean): number {
  return G.padTop + G.plotHeight + (grouped ? G.padBottomGrouped : G.padBottom);
}

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

/** "30-day portfolio return · Age<40 · +Income · |z|>2.5 · log · one-tailed"
 * -- §7.4's recipe line, every segment localized: the outcome from the day's
 * scenario, the other five from the copy catalog. */
export function recipeLabel(spec: Spec, outcomeLabels: string[], copy: Record<CopyKey, string>): string {
  const covariates = [
    spec.covariates.income ? copy['reveal.covIncome'] : null,
    spec.covariates.risk ? copy['reveal.covRisk'] : null,
  ].filter((label): label is string => label !== null);

  return [
    outcomeLabels[spec.outcome] ?? '',
    copy[SUBGROUP_KEY[spec.subgroup]],
    covariates.length === 0 ? copy['reveal.covNone'] : covariates.join(' '),
    copy[EXCLUSION_KEY[spec.exclusion]],
    copy[TRANSFORM_KEY[spec.transform]],
    copy[TAILS_KEY[spec.tails]],
  ].join(RECIPE_SEP);
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

function place(points: SpecCurvePoint[], grouped: boolean): Placed[] {
  const out: Placed[] = [];
  const spread = (order: number[], left: number, width: number) => {
    const inner = Math.max(0, width - G.plotInset * 2);
    order.forEach((i, rank) => {
      const x =
        order.length <= 1
          ? left + width / 2
          : left + G.plotInset + (rank / (order.length - 1)) * inner;
      out.push({ x, y: G.padTop + curveY(points[i].p, G.plotHeight), point: points[i] });
    });
  };

  const all = points.map((_, i) => i);
  if (!grouped) {
    spread(rankOrder(points, all), G.padLeft, G.plotWidth);
    return out;
  }
  for (const band of BANDS) {
    const members = all.filter((i) => points[i].outcome === band);
    spread(rankOrder(points, members), G.padLeft + band * (BAND_WIDTH + G.bandGap), BAND_WIDTH);
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

export function SpecCurve({ points, grouped, outcomeLabels, copy }: SpecCurveProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const height = heightFor(grouped);
  const placed = useMemo(() => place(points, grouped), [points, grouped]);

  const thresholdY = G.padTop + curveY(0.05, G.plotHeight);
  const seamY = G.padTop + curveY(0.1, G.plotHeight);
  const plotBottom = G.padTop + G.plotHeight;
  const publishedIndex = placed.findIndex((entry) => entry.point.published);
  const published = publishedIndex === -1 ? null : placed[publishedIndex];
  const tip = hovered === null ? null : placed[hovered];

  function handleMove(event: ReactPointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * G.width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    setHovered(nearestIndex(placed, x, y, G.hitRadius));
  }

  return (
    <div className="ph-speccurve">
      <div className="ph-speccurve__plot">
        <svg
          ref={svgRef}
          className="ph-speccurve__svg"
          viewBox={`0 0 ${G.width} ${height}`}
          role="img"
          aria-label={copy['a11y.specCurveChart']}
        >
          {/* The one filled area in the whole product (R4.1): p < .05. */}
          <rect
            data-role="sig-band"
            className="ph-speccurve__band"
            x={G.padLeft}
            y={thresholdY}
            width={G.plotWidth}
            height={plotBottom - thresholdY}
          />

          {/* Axis furniture: the floor, and the zoom-band seam at p = .10. */}
          <line
            className="ph-speccurve__axis"
            x1={G.padLeft}
            y1={plotBottom}
            x2={G.padLeft + G.plotWidth}
            y2={plotBottom}
          />
          <line className="ph-speccurve__axis" x1={G.padLeft} y1={seamY} x2={G.padLeft + G.plotWidth} y2={seamY} />
          {[0, 0.1, 1].map((value) => (
            <text
              key={value}
              className="ph-speccurve__tick"
              x={G.padLeft - 8}
              y={G.padTop + curveY(value, G.plotHeight)}
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
            x1={G.padLeft}
            y1={thresholdY}
            x2={G.padLeft + G.plotWidth}
            y2={thresholdY}
          />
          <text
            data-role="threshold-label"
            className="ph-speccurve__threshold-label"
            x={G.padLeft + G.plotWidth}
            y={thresholdY - 6}
            textAnchor="end"
          >
            {copy['legend.significant']}
          </text>

          {/* Points, painted back to front so the published path is never buried. */}
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

          {/* The recipe callout, in fig. 1's guaranteed-empty upper left: the
              cloud rises monotonically left to right, so nothing lives there.
              Fig. 2's four rising bands have no such empty corner, and its
              subject is clustering rather than one path -- the published point
              keeps its ring there, and the callout stands down. */}
          {published === null || grouped ? null : (
            <>
              <line
                data-role="leader"
                className="ph-speccurve__leader"
                x1={G.padLeft + 4}
                y1={G.padTop + 18}
                x2={published.x}
                y2={published.y}
              />
              <text data-role="callout" className="ph-speccurve__callout" x={G.padLeft + 4} y={G.padTop + 12}>
                {recipeLabel(published.point.spec, outcomeLabels, copy)}
              </text>
            </>
          )}

          {/* Fig. 2's four outcome bands (§2.7.6). */}
          {!grouped
            ? null
            : BANDS.map((band) => {
                const centre = G.padLeft + band * (BAND_WIDTH + G.bandGap) + BAND_WIDTH / 2;
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
                    {wrapLabel(outcomeLabels[band] ?? '', 22).map((line, i) => (
                      <tspan key={i} x={centre} dy={i === 0 ? 0 : 14}>
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
            x={G.padLeft}
            y={G.padTop}
            width={G.plotWidth}
            height={G.plotHeight}
            onPointerMove={handleMove}
            onPointerLeave={() => setHovered(null)}
          />
        </svg>

        {tip === null ? null : (
          <div
            data-role="tooltip"
            className={[
              'ph-speccurve__tooltip',
              tip.y < height * 0.25 ? 'ph-speccurve__tooltip--below' : '',
              tip.x > G.width * 0.7 ? 'ph-speccurve__tooltip--end' : '',
              tip.x < G.width * 0.3 ? 'ph-speccurve__tooltip--start' : '',
            ]
              .filter((name) => name !== '')
              .join(' ')}
            style={{ left: `${(tip.x / G.width) * 100}%`, top: `${(tip.y / height) * 100}%` }}
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
        <li className="ph-speccurve__legend-item">
          <svg className="ph-speccurve__swatch" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="ph-speccurve__key-ring" cx="12" cy="12" />
            <circle className="ph-speccurve__key-dot ph-speccurve__key-dot--published" cx="12" cy="12" />
          </svg>
          {copy['legend.published']}
        </li>
      </ul>
    </div>
  );
}
