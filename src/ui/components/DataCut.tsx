// The Lab's data figure (master spec §2.4: "a tiny scatter/box visual of the
// current cut"). Two columns — comparison group left, treated right — of the
// CURRENT specification's transformed outcome values, with the outlier-
// excluded points still drawn, as hollow crossed marks.
//
// That last clause is the entire design. Every other knob changes a number;
// the exclusion knob changes WHO IS IN THE STUDY, and until this figure
// existed that happened silently, behind a shrinking `n`. Here the player
// turns the knob and watches specific people stop being dots and become
// crossed-out marks, without moving an inch. The honesty pillar and §2.4's
// mechanic are the same picture.
//
// DESIGN.md: this is a data region, governed by the SpecCurve precedent
// (R1.2/R1.4/R4.3/R6.3/R8.3 — tokens only, no fills, hairline strokes, shape
// as well as hue, and a quiet figure that never competes with the dial). It
// animates nothing: §5's motion budget is exhaustive and has no room for a
// fifth animation, so marks appear and disappear instantly.
//
// Pure geometry is exported alongside the component, the same trade (and the
// same waiver) as SpecCurve.tsx: these are exactly the things the tests pin.
/* eslint-disable react-refresh/only-export-components */
import { useMemo, useRef } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { fnv1a32 } from '../../engine/prng';
import type { DataCut as DataCutValues } from '../../engine/types';
import { useContainerWidth } from '../charts/useContainerWidth';
import './DataCut.css';

export interface DataCutProps {
  /** `PathResult.cut` for the specification currently on screen, or null
   * before the first result lands. */
  cut: DataCutValues | null;
  /** The scenario's own name for the treated column ("Owns a cat"). The
   * comparison column is named by the copy catalog — no scenario carries a
   * "not-treated" label, and inventing one per scenario would be 20 more
   * strings for translators to keep parallel. */
  treatmentLabel: string;
}

/* ------------------------------------------------------------------ geometry */

/**
 * SCALE INVARIANCE: the viewBox tracks the container, so one user unit is one
 * CSS pixel at every width (see charts/useContainerWidth.ts for the full
 * argument, and T16's review finding I3 for how the bug was found).
 * `cutCssPixelsPerUnit` is therefore exactly 1 across the supported range,
 * which is what the unit tests assert at 320 / 660 / 1088 and at the narrower
 * widths the Lab's results pane actually hands this figure at those viewports.
 */
export const CUT_TEXT_PX = 13;
/** Below this the two columns are too narrow to separate; the figure shrinks
 * proportionally rather than laying out into nothing. Lower than SpecCurve's
 * 320 because this figure lives in one pane of a two-pane screen, not across
 * the full reveal column. */
export const CUT_MIN_WIDTH = 200;
/** Sanity guard on a bad measurement only — `--page-max` caps the Lab well
 * inside it. */
export const CUT_MAX_WIDTH = 2048;
/** Used until a ResizeObserver reports, and in environments without one. */
export const CUT_DEFAULT_WIDTH = 480;

export interface CutGeometry {
  width: number;
  height: number;
  plotWidth: number;
  plotHeight: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  columnWidth: number;
  columnGap: number;
  /** Horizontal band each column's jitter is allowed to use, centred on the
   * column. Narrower than `columnWidth` by `markInset` on each side so no
   * mark can overhang into the gap. */
  jitterSpread: number;
  /** Keeps a mark's own radius off the plot's edges, vertically and
   * horizontally. Sized for the largest mark in the figure (the excluded
   * ring, `--dot-explored` = 4px, plus its cross). */
  markInset: number;
  /** Half-extent of an excluded mark's cross arms, in user units == CSS px.
   * Matches the ring radius CSS gives it (`--dot-explored`), so the X spans
   * the ring corner to corner. */
  excludedArm: number;
  /** Length of a group's mean bar. Deliberately SHORTER than the column: at
   * full column width the two bars very nearly meet across the 12px gap and
   * read as one rule spanning the whole figure (observed in the self-review
   * screenshots), which is exactly the wrong reading — the entire point is
   * that these are two separate averages you are comparing. */
  meanBarWidth: number;
}

/**
 * `padLeft`/`padRight` are --space-8 and `columnGap` is --space-12, retyped
 * here as plain numbers because SVG geometry cannot read a custom property.
 * They are not free choices: DataCut.css lays the column LABELS out as an
 * HTML flex row using those same two tokens, so the labels sit exactly under
 * the columns they name. Change one, change the other.
 */
const CUT_PAD_X = 8;
const CUT_PAD_TOP = 4;
const CUT_COLUMN_GAP = 12;
/**
 * The plot's own height. §2.4 asks for a *tiny* visual and R8.3 forbids
 * anything competing with the dial, whose numeral tops out at --text-dial's
 * 96px — so the drawn area is held strictly below that, and the whole figure
 * (plot + labels + legend) stays comfortably under the dial block's height.
 */
const CUT_PLOT_HEIGHT = 72;
const CUT_MARK_INSET = 6;
const CUT_EXCLUDED_ARM = 4;
/** See CutGeometry.meanBarWidth. 0.8 leaves visible air on both sides of each
 * bar without shortening it so far that the two columns' averages stop being
 * comparable at a glance. */
const CUT_MEAN_BAR_FRACTION = 0.8;

export function cutGeometryFor(containerWidth: number): CutGeometry {
  const measured = Math.round(containerWidth) || CUT_DEFAULT_WIDTH;
  const width = Math.min(Math.max(measured, CUT_MIN_WIDTH), CUT_MAX_WIDTH);
  const plotWidth = width - CUT_PAD_X * 2;
  const columnWidth = (plotWidth - CUT_COLUMN_GAP) / 2;
  return {
    width,
    height: CUT_PAD_TOP + CUT_PLOT_HEIGHT,
    plotWidth,
    plotHeight: CUT_PLOT_HEIGHT,
    padLeft: CUT_PAD_X,
    padRight: CUT_PAD_X,
    padTop: CUT_PAD_TOP,
    columnWidth,
    columnGap: CUT_COLUMN_GAP,
    jitterSpread: Math.max(1, columnWidth - CUT_MARK_INSET * 2),
    markInset: CUT_MARK_INSET,
    excludedArm: CUT_EXCLUDED_ARM,
    meanBarWidth: columnWidth * CUT_MEAN_BAR_FRACTION,
  };
}

/** CSS pixels per viewBox user unit: 1 across the whole supported range, by
 * construction. */
export function cutCssPixelsPerUnit(containerWidth: number): number {
  const measured = Math.round(containerWidth) || CUT_DEFAULT_WIDTH;
  return measured / cutGeometryFor(measured).width;
}

/** x of a column's centre line: 0 = comparison group, 1 = treated. */
export function columnCentre(column: 0 | 1, geom: CutGeometry): number {
  return geom.padLeft + column * (geom.columnWidth + geom.columnGap) + geom.columnWidth / 2;
}

/* -------------------------------------------------------------------- jitter */

/**
 * Deterministic horizontal jitter, as a unit fraction in [0, 1).
 *
 * Seeded from the DATUM, via fnv1a32 of its fixed-precision decimal string —
 * NOT from its index in the array it currently sits in, and never from
 * Math.random (§3.1's determinism, extended to pixels: two players looking at
 * the same cut see the same picture).
 *
 * Keying on the value rather than the index is what makes the figure's
 * mechanic work. A point's array membership CHANGES when the exclusion knob
 * moves — `treated[7]` becomes `excludedTreated[0]` — so index-keyed jitter
 * would reshuffle the whole column on every knob turn, and "watch these
 * specific people leave your analysis" would read as a reshuffle instead. Key
 * on the value and the mark stays exactly where it was and simply changes
 * shape, which is the thing the player is supposed to see. (Two points that
 * share a value share an x, and overplot: honest, and unavoidable in a strip
 * plot anyway.)
 */
export function jitterUnit(value: number): number {
  return fnv1a32(value.toFixed(6)) / 0x100000000;
}

/* ------------------------------------------------------------------- scaling */

/** Mean of a column's INCLUDED values — what OLS actually fits — or null for
 * an empty column (a subgroup that emptied one side, or an exclusion that
 * took everybody). */
export function columnMean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * The vertical domain, over ALL four arrays — excluded points included.
 * Deliberate: a domain fitted to the surviving points would push the excluded
 * outliers off the top and bottom of the plot, which is precisely the figure
 * refusing to show the thing it exists to show. A degenerate (single-value)
 * cut is widened by 1 so the marks land mid-plot instead of dividing by zero.
 */
export function cutDomain(cut: DataCutValues): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const arr of [cut.control, cut.treated, cut.excludedControl, cut.excludedTreated]) {
    for (const v of arr) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (lo === Infinity) return [0, 1];
  if (hi === lo) return [lo - 0.5, hi + 0.5];
  return [lo, hi];
}

/** Value -> y, inset by `markInset` at both ends so a mark's own radius never
 * overhangs the plot. Larger values sit higher (SVG y grows downward). */
export function cutValueY(value: number, domain: [number, number], geom: CutGeometry): number {
  const [lo, hi] = domain;
  const top = geom.padTop + geom.markInset;
  const usable = geom.plotHeight - geom.markInset * 2;
  return top + (1 - (value - lo) / (hi - lo)) * usable;
}

/* ------------------------------------------------------------------- marking */

interface Mark {
  x: number;
  y: number;
  column: 0 | 1;
  excluded: boolean;
}

const GROUP_NAME = ['control', 'treated'] as const;

function markFor(value: number, column: 0 | 1, excluded: boolean, domain: [number, number], geom: CutGeometry): Mark {
  const centre = columnCentre(column, geom);
  return {
    x: centre - geom.jitterSpread / 2 + jitterUnit(value) * geom.jitterSpread,
    y: cutValueY(value, domain, geom),
    column,
    excluded,
  };
}

/** Every mark in the figure, in paint order: included first, so the (larger,
 * rarer) excluded marks are never buried under the cloud. */
export function placeCut(cut: DataCutValues, geom: CutGeometry): Mark[] {
  const domain = cutDomain(cut);
  return [
    ...cut.control.map((v) => markFor(v, 0, false, domain, geom)),
    ...cut.treated.map((v) => markFor(v, 1, false, domain, geom)),
    ...cut.excludedControl.map((v) => markFor(v, 0, true, domain, geom)),
    ...cut.excludedTreated.map((v) => markFor(v, 1, true, domain, geom)),
  ];
}

/* ----------------------------------------------------------------- component */

const EMPTY_CUT: DataCutValues = { control: [], treated: [], excludedControl: [], excludedTreated: [] };

export function DataCut({ cut, treatmentLabel }: DataCutProps) {
  const { t } = useLocale();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const containerWidth = useContainerWidth(plotRef);
  const geom = useMemo(() => cutGeometryFor(containerWidth ?? CUT_DEFAULT_WIDTH), [containerWidth]);

  const values = cut ?? EMPTY_CUT;
  const { marks, domain } = useMemo(
    () => ({ marks: placeCut(values, geom), domain: cutDomain(values) }),
    [values, geom]
  );

  const includedCount = values.control.length + values.treated.length;
  const excludedCount = values.excludedControl.length + values.excludedTreated.length;
  const baselineY = geom.padTop + geom.plotHeight;

  const meanBars = ([0, 1] as const)
    .map((column) => ({ column, mean: columnMean(column === 0 ? values.control : values.treated) }))
    .filter((bar): bar is { column: 0 | 1; mean: number } => bar.mean !== null);

  return (
    <figure className="ph-datacut">
      <div className="ph-datacut__plot" ref={plotRef}>
        <svg
          className="ph-datacut__svg"
          viewBox={`0 0 ${geom.width} ${geom.height}`}
          role="img"
          aria-label={t('a11y.dataCut')}
        >
          {/* The floor the columns stand on, and the only rule in the figure. */}
          <line
            className="ph-datacut__axis"
            x1={geom.padLeft}
            y1={baselineY}
            x2={geom.padLeft + geom.plotWidth}
            y2={baselineY}
          />

          {marks.map((mark, i) =>
            mark.excluded ? null : (
              <circle
                key={i}
                data-role="cut-dot"
                data-group={GROUP_NAME[mark.column]}
                className="ph-datacut__dot"
                cx={mark.x}
                cy={mark.y}
              />
            )
          )}

          {/* R6.3: the excluded mark is muted AND hollow AND crossed — three
              signals, none of them hue alone. */}
          {marks.map((mark, i) =>
            !mark.excluded ? null : (
              <g
                key={i}
                data-role="cut-excluded"
                data-group={GROUP_NAME[mark.column]}
                data-x={mark.x}
                data-y={mark.y}
                className="ph-datacut__excluded"
              >
                <circle className="ph-datacut__excluded-ring" cx={mark.x} cy={mark.y} />
                <line
                  className="ph-datacut__excluded-arm"
                  x1={mark.x - geom.excludedArm}
                  y1={mark.y - geom.excludedArm}
                  x2={mark.x + geom.excludedArm}
                  y2={mark.y + geom.excludedArm}
                />
                <line
                  className="ph-datacut__excluded-arm"
                  x1={mark.x - geom.excludedArm}
                  y1={mark.y + geom.excludedArm}
                  x2={mark.x + geom.excludedArm}
                  y2={mark.y - geom.excludedArm}
                />
              </g>
            )
          )}

          {meanBars.map(({ column, mean }) => {
            const centre = columnCentre(column, geom);
            const y = cutValueY(mean, domain, geom);
            return (
              <line
                key={column}
                data-role="cut-mean"
                data-group={GROUP_NAME[column]}
                className="ph-datacut__mean"
                x1={centre - geom.meanBarWidth / 2}
                y1={y}
                x2={centre + geom.meanBarWidth / 2}
                y2={y}
              />
            );
          })}
        </svg>
      </div>

      {/* The column labels are HTML, not SVG text: real text wraps, SVG text
          does not, and a shipped treatmentLabel that needed two lines would
          otherwise have to be ellipsized — a figure that lies about its own
          axis. The flex row below uses the same --space-8 padding and
          --space-12 gap the geometry above is built from, so each label sits
          exactly under its column. */}
      <div className="ph-datacut__labels">
        <span className="ph-datacut__label">{t('lab.cutControl')}</span>
        <span className="ph-datacut__label">{treatmentLabel}</span>
      </div>

      <figcaption className="ph-datacut__legend">
        <span className="ph-datacut__legend-item">
          <svg className="ph-datacut__swatch" viewBox="0 0 12 12" aria-hidden="true">
            <circle className="ph-datacut__dot" cx="6" cy="6" />
          </svg>
          {t('lab.cutLegendIncluded', { n: includedCount })}
        </span>
        <span className="ph-datacut__legend-item">
          <svg className="ph-datacut__swatch" viewBox="0 0 12 12" aria-hidden="true">
            <circle className="ph-datacut__excluded-ring" cx="6" cy="6" />
            <line className="ph-datacut__excluded-arm" x1="2" y1="2" x2="10" y2="10" />
            <line className="ph-datacut__excluded-arm" x1="2" y1="10" x2="10" y2="2" />
          </svg>
          {t('lab.cutLegendExcluded', { n: excludedCount })}
        </span>
        <span className="ph-datacut__legend-item">
          <svg className="ph-datacut__swatch" viewBox="0 0 12 12" aria-hidden="true">
            <line className="ph-datacut__mean" x1="1" y1="6" x2="11" y2="6" />
          </svg>
          {t('lab.cutLegendMean')}
        </span>
      </figcaption>
    </figure>
  );
}
