// The Lab's coefficient plot (master spec §2.4/§7.3): the current spec's
// point estimate + 95% CI as a horizontal interval against a zero line.
// DESIGN.md R8.3: a quiet figure, not a second signature — plain strokes and
// one small point, a --muted caption underneath (same register as R8.3's own
// "Fig. 1" example for the reveal's SpecCurve).
//
// T31 (play-test: "needs graphs... and explanations"): the figure gained the
// two labels that make it readable as a figure rather than as decoration — a
// zero-line label ("no effect") and an axis label naming what is being
// measured and in what unit. Adding TEXT forced the second change: the old
// fixed 300-unit viewBox scaled its own interior, so a 13px label would have
// rendered at ~29 CSS px in the desktop two-pane layout and ~12 px on a
// phone. The viewBox now TRACKS the container (charts/useContainerWidth.ts),
// exactly as SpecCurve does, so one user unit is one CSS pixel everywhere and
// `var(--text-13)` really is 13 px.
/* eslint-disable react-refresh/only-export-components */
import { useMemo, useRef } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { PathResult } from '../../engine/types';
import { useContainerWidth } from '../charts/useContainerWidth';
import { typographicMinus } from '../format';
import './CoefPlot.css';

export interface CoefPlotProps {
  result: PathResult | null;
  unit: string;
}

/** Same floor/ceiling/default rationale as DataCut's — this figure shares a
 * pane with it. */
export const COEF_MIN_WIDTH = 200;
export const COEF_MAX_WIDTH = 2048;
export const COEF_DEFAULT_WIDTH = 480;

export interface CoefGeometry {
  width: number;
  height: number;
  /** Baseline of the interval itself. */
  midY: number;
  /** Baseline the two labels sit on, below the interval. */
  labelY: number;
  /** Keeps the CI/point markers, and the zero label's own half-width, off the
   * SVG's edges. */
  inset: number;
}

const COEF_HEIGHT = 52;
const COEF_MID_Y = 18;
const COEF_LABEL_Y = 44;
const COEF_INSET = 24;

export function coefGeometryFor(containerWidth: number): CoefGeometry {
  const measured = Math.round(containerWidth) || COEF_DEFAULT_WIDTH;
  return {
    width: Math.min(Math.max(measured, COEF_MIN_WIDTH), COEF_MAX_WIDTH),
    height: COEF_HEIGHT,
    midY: COEF_MID_Y,
    labelY: COEF_LABEL_Y,
    inset: COEF_INSET,
  };
}

/** CSS pixels per viewBox user unit: 1 across the whole supported range. */
export function coefCssPixelsPerUnit(containerWidth: number): number {
  const measured = Math.round(containerWidth) || COEF_DEFAULT_WIDTH;
  return measured / coefGeometryFor(measured).width;
}

export function CoefPlot({ result, unit }: CoefPlotProps) {
  const { t } = useLocale();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const containerWidth = useContainerWidth(plotRef);
  const geom = useMemo(() => coefGeometryFor(containerWidth ?? COEF_DEFAULT_WIDTH), [containerWidth]);

  const showMarks = result !== null && result.valid;
  const zeroX = geom.width / 2;
  const axisLabel = t('lab.coefPlotAxis', { unit });

  // The zero line and its label are drawn in EVERY state, including before
  // the first result: an unlabelled bare line is exactly the "barebone"
  // the play-test complained about, and the reference point is meaningful
  // whether or not there is an estimate to compare against it yet.
  const frame = (
    <>
      <line className="ph-coef-plot__zero" x1={zeroX} y1={4} x2={zeroX} y2={geom.midY + 8} />
      <text className="ph-coef-plot__zero-label" x={zeroX} y={geom.labelY} textAnchor="middle">
        {t('lab.coefPlotZero')}
      </text>
    </>
  );

  if (!showMarks || result === null) {
    return (
      <figure className="ph-coef-plot">
        <div className="ph-coef-plot__plot" ref={plotRef}>
          <svg viewBox={`0 0 ${geom.width} ${geom.height}`} role="img" aria-label={axisLabel}>
            {frame}
          </svg>
        </div>
        <figcaption className="ph-coef-plot__axis">{axisLabel}</figcaption>
      </figure>
    );
  }

  const [lo, hi] = result.ci;
  const beta = result.beta;
  // Domain half-width: comfortably covers the CI and the point, always
  // includes zero (it's centred on it), with 25% padding so nothing touches
  // the SVG's own edge.
  const domainHalf = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(beta), 0.01) * 1.25;
  const usableHalf = geom.width / 2 - geom.inset;
  const x = (v: number) => geom.width / 2 + (v / domainHalf) * usableHalf;

  // gr6-074: two decimals as before, U+2212 for the sign — this caption is
  // the one line in the Lab that routinely prints a negative estimate, and a
  // 95% CI that straddles zero prints two of them side by side.
  const caption = t('lab.coefPlotCaption', {
    beta: typographicMinus(beta.toFixed(2)),
    unit,
    lo: typographicMinus(lo.toFixed(2)),
    hi: typographicMinus(hi.toFixed(2)),
  });

  return (
    <figure className="ph-coef-plot">
      <div className="ph-coef-plot__plot" ref={plotRef}>
        <svg viewBox={`0 0 ${geom.width} ${geom.height}`} role="img" aria-label={caption}>
          {frame}
          <line className="ph-coef-plot__ci" x1={x(lo)} y1={geom.midY} x2={x(hi)} y2={geom.midY} />
          <circle className="ph-coef-plot__point" cx={x(beta)} cy={geom.midY} r={4} />
        </svg>
      </div>
      <figcaption className="ph-coef-plot__axis">{axisLabel}</figcaption>
      <p className="ph-coef-plot__caption">{caption}</p>
    </figure>
  );
}
