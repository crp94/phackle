// The Lab's coefficient plot (master spec §2.4/§7.3): the current spec's
// point estimate + 95% CI as a horizontal interval against a zero line.
// DESIGN.md R8.3: a quiet figure, not a second signature — plain strokes and
// one small point, a --muted caption underneath (same register as R8.3's own
// "Fig. 1" example for the reveal's SpecCurve).
import { useLocale } from '../../i18n/LocaleProvider';
import type { PathResult } from '../../engine/types';
import './CoefPlot.css';

export interface CoefPlotProps {
  result: PathResult | null;
  unit: string;
}

const WIDTH = 300;
const HEIGHT = 56;
const INSET = 24; // keeps the CI/point markers off the SVG's own edge

export function CoefPlot({ result, unit }: CoefPlotProps) {
  const { t } = useLocale();
  const showMarks = result !== null && result.valid;

  if (!showMarks || result === null) {
    const zeroX = WIDTH / 2;
    return (
      <figure className="ph-coef-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
          <line className="ph-coef-plot__zero" x1={zeroX} y1={8} x2={zeroX} y2={HEIGHT - 8} />
        </svg>
      </figure>
    );
  }

  const [lo, hi] = result.ci;
  const beta = result.beta;
  // Domain half-width: comfortably covers the CI and the point, always
  // includes zero (it's centred on it), with 25% padding so nothing touches
  // the SVG's own edge.
  const domainHalf = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(beta), 0.01) * 1.25;
  const usableHalf = WIDTH / 2 - INSET;
  const x = (v: number) => WIDTH / 2 + (v / domainHalf) * usableHalf;
  const zeroX = x(0);
  const midY = HEIGHT / 2;

  const caption = t('lab.coefPlotCaption', {
    beta: beta.toFixed(2),
    unit,
    lo: lo.toFixed(2),
    hi: hi.toFixed(2),
  });

  return (
    <figure className="ph-coef-plot">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={caption}>
        <line className="ph-coef-plot__zero" x1={zeroX} y1={8} x2={zeroX} y2={HEIGHT - 8} />
        <line className="ph-coef-plot__ci" x1={x(lo)} y1={midY} x2={x(hi)} y2={midY} />
        <circle className="ph-coef-plot__point" cx={x(beta)} cy={midY} r={4} />
      </svg>
      <figcaption className="ph-coef-plot__caption">{caption}</figcaption>
    </figure>
  );
}
