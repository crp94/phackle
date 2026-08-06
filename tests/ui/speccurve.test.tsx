// @vitest-environment jsdom
//
// T16: SpecCurve — the centerpiece figure (master spec §7.4, DESIGN.md R1.3,
// R4.1, R4.3, R6.3). Pure props in, one SVG out; no store, no provider.
//
// No @testing-library/jest-dom in this project (see tests/ui/shell.test.tsx) —
// assertions read plain DOM properties.
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { copy } from '../../src/content/en/copy';
import { content as enFullContent } from '../../src/content/en';
import { content as itFullContent } from '../../src/content/it';
import { content as esFullContent } from '../../src/content/es';
import type { CopyKey } from '../../src/content/en/copy';
import type { Outcome, Spec } from '../../src/engine/types';
import {
  FIGURE_DEFAULT_WIDTH,
  FIGURE_TEXT_PX,
  HIT_RADIUS_PX,
  SpecCurve,
  SPEC_CURVE_GEOM,
  cssPixelsPerUnit,
  curveY,
  formatP,
  bandLabel,
  BAND_LABEL_MIN_CHARS,
  geometryFor,
  leaderAnchorX,
  nearestIndex,
  recipeLabel,
  recipeLabelCompact,
  wrapLabel,
  type SpecCurvePoint,
} from '../../src/ui/charts/SpecCurve';

/** The longest outcome label in the shipped English content, and the one that
 * pushed the first draft's full-label callout off the plate. */
const LONGEST_SHIPPED_LABEL = 'Attendee-rated sense that this could have been an email';

/** Matches GLYPH_ADVANCE in SpecCurve.tsx: the average glyph advance the
 * component budgets a line by. Duplicated here on purpose -- if the component
 * changes its estimate, this test should have to agree with it explicitly. */
const GLYPH_ADVANCE = 0.55;

/** A 1:1 client-to-viewBox mapping, so fired coordinates ARE user units. */
const VIEWBOX_RECT = {
  left: 0,
  top: 0,
  width: SPEC_CURVE_GEOM.width,
  height: SPEC_CURVE_GEOM.height,
  right: SPEC_CURVE_GEOM.width,
  bottom: SPEC_CURVE_GEOM.height,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

afterEach(cleanup);

const OUTCOME_LABELS = ['Portfolio return', 'Upside capture', 'Profitable trades', 'Financial wellbeing'];

function spec(over: Partial<Spec> = {}): Spec {
  return {
    outcome: 0,
    subgroup: 'all',
    covariates: { income: false, risk: false },
    exclusion: 'none',
    transform: 'raw',
    tails: 'two',
    ...over,
  };
}

function point(p: number, over: Partial<SpecCurvePoint> = {}): SpecCurvePoint {
  const s = over.spec ?? spec({ outcome: (over.outcome ?? 0) as Outcome });
  return { p, outcome: s.outcome, explored: false, published: false, ...over, spec: s };
}

/** Four points, one per outcome, so grouped mode has a member in every band. */
function fourBands(): SpecCurvePoint[] {
  return ([0, 1, 2, 3] as Outcome[]).flatMap((o) => [
    point(0.01 + o / 100, { spec: spec({ outcome: o }) }),
    point(0.5 + o / 100, { spec: spec({ outcome: o }) }),
  ]);
}

function renderCurve(props: Partial<Parameters<typeof SpecCurve>[0]> = {}) {
  return render(
    <SpecCurve
      points={props.points ?? fourBands()}
      grouped={props.grouped ?? false}
      outcomeLabels={props.outcomeLabels ?? OUTCOME_LABELS}
      copy={props.copy ?? copy}
    />
  );
}

describe('§7.4 y mapping — the pinned zoom band', () => {
  const H = 320;

  it('puts p = 0 at the bottom of the plot', () => {
    expect(curveY(0, H)).toBe(H);
  });

  it('puts the zoom-band boundary p = 0.10 at 60% of the height (y = 0.40H)', () => {
    expect(curveY(0.1, H)).toBeCloseTo(0.4 * H, 10);
  });

  it('puts p = 1 at the top', () => {
    expect(curveY(1, H)).toBeCloseTo(0, 10);
  });

  it('puts the .05 threshold at 70% height — half the zoom band', () => {
    expect(curveY(0.05, H)).toBeCloseTo(0.7 * H, 10);
  });

  it('is monotone decreasing in p across the band seam', () => {
    const samples = [0, 0.001, 0.01, 0.049, 0.05, 0.0999, 0.1, 0.1001, 0.5, 1];
    const ys = samples.map((p) => curveY(p, H));
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });
});

describe('§7.4 threshold rule and significance band', () => {
  it('draws the dashed .05 rule at its mapped height and labels it', () => {
    const { container } = renderCurve();
    const rule = container.querySelector('[data-role="threshold"]') as SVGLineElement;
    expect(rule).not.toBeNull();
    const expected = SPEC_CURVE_GEOM.padTop + curveY(0.05, SPEC_CURVE_GEOM.plotHeight);
    expect(Number(rule.getAttribute('y1'))).toBeCloseTo(expected, 6);
    expect(container.querySelector('[data-role="threshold-label"]')?.textContent).toBe(copy['legend.significant']);
  });

  it('tints the region below the rule and nothing above it', () => {
    const { container } = renderCurve();
    const band = container.querySelector('[data-role="sig-band"]') as SVGRectElement;
    expect(band).not.toBeNull();
    const ruleY = SPEC_CURVE_GEOM.padTop + curveY(0.05, SPEC_CURVE_GEOM.plotHeight);
    expect(Number(band.getAttribute('y'))).toBeCloseTo(ruleY, 6);
    expect(Number(band.getAttribute('y')) + Number(band.getAttribute('height'))).toBeCloseTo(
      SPEC_CURVE_GEOM.padTop + SPEC_CURVE_GEOM.plotHeight,
      6
    );
  });

  it('places significant points below the rule and non-significant points above it', () => {
    const { container } = renderCurve({ points: [point(0.01), point(0.4)] });
    const ruleY = SPEC_CURVE_GEOM.padTop + curveY(0.05, SPEC_CURVE_GEOM.plotHeight);
    const ys = [...container.querySelectorAll('circle[data-p]')].map((c) => ({
      p: Number(c.getAttribute('data-p')),
      y: Number(c.getAttribute('cy')),
    }));
    expect(ys.find((e) => e.p === 0.01)!.y).toBeGreaterThan(ruleY);
    expect(ys.find((e) => e.p === 0.4)!.y).toBeLessThan(ruleY);
  });
});

describe('§7.4 / R6.3 point classing', () => {
  const points = [
    point(0.02, { spec: spec({ subgroup: 'age_lt40' }), explored: true, published: true }),
    point(0.03, { explored: true }),
    point(0.6),
  ];

  it('renders one circle per point, classed base / explored / published', () => {
    const { container } = renderCurve({ points });
    expect(container.querySelectorAll('circle[data-p]').length).toBe(3);
    expect(container.querySelectorAll('.ph-speccurve__dot--published').length).toBe(1);
    expect(container.querySelectorAll('.ph-speccurve__dot--explored').length).toBe(1);
    expect(container.querySelectorAll('.ph-speccurve__dot--base').length).toBe(1);
  });

  it('pairs the published point with a ring — shape, not colour alone (R6.3)', () => {
    const { container } = renderCurve({ points });
    const ring = container.querySelector('.ph-speccurve__ring') as SVGCircleElement;
    const dot = container.querySelector('.ph-speccurve__dot--published') as SVGCircleElement;
    expect(ring).not.toBeNull();
    expect(ring.getAttribute('cx')).toBe(dot.getAttribute('cx'));
    expect(ring.getAttribute('cy')).toBe(dot.getAttribute('cy'));
  });

  it('draws a leader line from the published point to a recipe callout', () => {
    const { container } = renderCurve({ points });
    const leader = container.querySelector('[data-role="leader"]') as SVGLineElement;
    const dot = container.querySelector('.ph-speccurve__dot--published') as SVGCircleElement;
    expect(leader).not.toBeNull();
    expect(leader.getAttribute('x2')).toBe(dot.getAttribute('cx'));
    expect(leader.getAttribute('y2')).toBe(dot.getAttribute('cy'));

    const callout = container.querySelector('[data-role="callout"]');
    expect(callout?.textContent).toBe(recipeLabelCompact(points[0].spec, copy));
  });

  it('omits the callout and leader when there is no published path', () => {
    const { container } = renderCurve({ points: [point(0.02), point(0.6)] });
    expect(container.querySelector('[data-role="callout"]')).toBeNull();
    expect(container.querySelector('[data-role="leader"]')).toBeNull();
  });

  // T16 deferred minor, closed by T29 pin 5. The leader used to start at
  // `calloutX` = padLeft + 4, while the published path — almost always the
  // day's lowest p, i.e. rank 0 — lands at padLeft + plotInset = padLeft + 12.
  // Eight pixels of run over ~200 of rise is a red line parallel to the
  // y-axis: it reads as axis furniture, not as a pointer.
  describe('T29 pin 5 — the leader is a diagonal, not axis furniture', () => {
    const geom = SPEC_CURVE_GEOM;

    it('anchors ~40% across the plot at the common rank-0 published point', () => {
      const publishedX = geom.padLeft + geom.plotInset; // rank 0
      const anchor = leaderAnchorX(publishedX, geom);
      expect(anchor).toBeCloseTo(geom.padLeft + geom.plotWidth * 0.4, 6);
      // A real diagonal: the run is a substantial fraction of the plot, not
      // the 8px the old anchor produced.
      expect(Math.abs(anchor - publishedX)).toBeGreaterThan(geom.plotWidth * 0.25);
    });

    it('steps aside when the published point sits under that anchor', () => {
      const publishedX = geom.padLeft + geom.plotWidth * 0.4; // right on it
      const anchor = leaderAnchorX(publishedX, geom);
      expect(anchor).toBeCloseTo(geom.padLeft + geom.plotWidth * 0.12, 6);
      expect(Math.abs(anchor - publishedX)).toBeGreaterThan(geom.plotWidth * 0.25);
    });

    it('never leaves a run shorter than 12% of the plot width, wherever the path published', () => {
      for (let f = 0; f <= 1.0001; f += 0.02) {
        const publishedX = geom.padLeft + geom.plotWidth * f;
        const run = Math.abs(leaderAnchorX(publishedX, geom) - publishedX);
        expect(run, `published at ${(f * 100).toFixed(0)}% of the plot`).toBeGreaterThanOrEqual(
          geom.plotWidth * 0.12 - 1e-9
        );
      }
    });

    it('renders the line from that anchor, in the real figure', () => {
      const { container } = renderCurve({ points });
      const leader = container.querySelector('[data-role="leader"]') as SVGLineElement;
      const dot = container.querySelector('.ph-speccurve__dot--published') as SVGCircleElement;
      const publishedX = Number(dot.getAttribute('cx'));
      expect(Number(leader.getAttribute('x1'))).toBeCloseTo(leaderAnchorX(publishedX, geom), 6);
      // ...and it is no longer parallel to the y-axis.
      expect(Math.abs(Number(leader.getAttribute('x1')) - publishedX)).toBeGreaterThan(geom.plotWidth * 0.1);
    });
  });
});

describe('§7.4 recipe labels', () => {
  it('reads outcome · subgroup · covariates · exclusion · transform · tails, in order', () => {
    const s = spec({
      outcome: 1,
      subgroup: 'age_lt40',
      covariates: { income: true, risk: false },
      exclusion: 'z2_5',
      transform: 'log1p',
      tails: 'one',
    });
    expect(recipeLabel(s, OUTCOME_LABELS, copy)).toBe(
      [
        'Upside capture',
        copy['reveal.subgroupAgeLt40'],
        copy['reveal.covIncome'],
        copy['reveal.exclusionZ25'],
        copy['reveal.transformLog'],
        copy['reveal.tailsOne'],
      ].join(' · ')
    );
  });

  it('names both covariates when both are on, and "none" when neither is', () => {
    expect(recipeLabel(spec({ covariates: { income: true, risk: true } }), OUTCOME_LABELS, copy)).toContain(
      `${copy['reveal.covIncome']} ${copy['reveal.covRisk']}`
    );
    expect(recipeLabel(spec(), OUTCOME_LABELS, copy)).toContain(copy['reveal.covNone']);
  });

  it('is fully localized — a translated catalog changes every segment', () => {
    const it: Record<CopyKey, string> = {
      ...copy,
      'reveal.subgroupAgeLt40': 'Età<40',
      'reveal.covNone': 'nessuna covariata',
      'reveal.exclusionNone': 'nessuna esclusione',
      'reveal.transformRaw': 'grezzo',
      'reveal.tailsTwo': 'a due code',
    };
    const labelsIt = ['Rendimento del portafoglio', 'b', 'c', 'd'];
    expect(recipeLabel(spec({ subgroup: 'age_lt40' }), labelsIt, it)).toBe(
      'Rendimento del portafoglio · Età<40 · nessuna covariata · nessuna esclusione · grezzo · a due code'
    );
  });
});

describe('§7.4 p formatting (locale-invariant decimals)', () => {
  it('prints three decimals with a decimal point', () => {
    expect(formatP(0.041, copy)).toBe('p = 0.041');
    expect(formatP(0.5, copy)).toBe('p = 0.500');
  });

  it('collapses anything under .001 rather than printing 0.000', () => {
    expect(formatP(0.0004, copy)).toBe(copy['reveal.pValueTiny']);
  });
});

describe('§7.4 grouped mode (fig. 2)', () => {
  it('labels all four outcome bands', () => {
    const { container } = renderCurve({ grouped: true });
    const labels = [...container.querySelectorAll('[data-role="band-label"]')];
    expect(labels.length).toBe(4);
    expect(labels.map((l) => l.getAttribute('data-outcome'))).toEqual(['0', '1', '2', '3']);
    expect(labels.map((l) => l.textContent)).toEqual(OUTCOME_LABELS);
  });

  it('renders no band labels ungrouped', () => {
    const { container } = renderCurve({ grouped: false });
    expect(container.querySelectorAll('[data-role="band-label"]').length).toBe(0);
  });

  it('keeps each outcome inside its own x band, sorted by p within it', () => {
    const { container } = renderCurve({ grouped: true });
    const byOutcome = new Map<string, number[]>();
    for (const c of container.querySelectorAll('circle[data-p]')) {
      const o = c.getAttribute('data-outcome') as string;
      byOutcome.set(o, [...(byOutcome.get(o) ?? []), Number(c.getAttribute('cx'))]);
    }
    const ranges = ['0', '1', '2', '3'].map((o) => {
      const xs = byOutcome.get(o) as number[];
      return [Math.min(...xs), Math.max(...xs)];
    });
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][1]);
  });
});

describe('§7.4 hover tooltip — the quiet teaching', () => {
  const published = spec({ subgroup: 'urban', tails: 'one' });
  const points = [point(0.041, { spec: published, explored: true }), point(0.7)];

  function hoverFirstPoint(copyOverride?: Record<CopyKey, string>) {
    const view = renderCurve({ points, copy: copyOverride });
    const svg = view.container.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => VIEWBOX_RECT;
    const dot = view.container.querySelector('circle[data-p="0.041"]') as SVGCircleElement;
    const hit = view.container.querySelector('[data-role="hit"]') as SVGRectElement;
    fireEvent.pointerMove(hit, {
      clientX: Number(dot.getAttribute('cx')),
      clientY: Number(dot.getAttribute('cy')),
    });
    return view;
  }

  it('shows the hovered point\'s recipe and p-value', () => {
    const { container } = hoverFirstPoint();
    const tip = container.querySelector('[data-role="tooltip"]');
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toContain(recipeLabel(published, OUTCOME_LABELS, copy));
    expect(tip?.textContent).toContain('p = 0.041');
  });

  it('reads the recipe out of the active copy catalog', () => {
    const localized: Record<CopyKey, string> = { ...copy, 'reveal.subgroupUrban': 'Urbano', 'reveal.tailsOne': 'a una coda' };
    const { container } = hoverFirstPoint(localized);
    const text = container.querySelector('[data-role="tooltip"]')?.textContent ?? '';
    expect(text).toContain('Urbano');
    expect(text).toContain('a una coda');
  });

  it('hides the tooltip when the pointer leaves the plot', () => {
    const { container } = hoverFirstPoint();
    fireEvent.pointerLeave(container.querySelector('[data-role="hit"]') as SVGRectElement);
    expect(container.querySelector('[data-role="tooltip"]')).toBeNull();
  });
});

describe('§7.4 nearest-point lookup (generous hit target)', () => {
  const laid = [
    { x: 10, y: 100 },
    { x: 14, y: 90 },
    { x: 300, y: 20 },
  ];

  it('picks the closest point within the hit radius', () => {
    expect(nearestIndex(laid, 11, 99, 12)).toBe(0);
    expect(nearestIndex(laid, 14, 88, 12)).toBe(1);
  });

  it('returns null beyond the hit radius', () => {
    expect(nearestIndex(laid, 200, 200, 12)).toBeNull();
  });

  it('keeps a hit target of at least 8 user units in every direction', () => {
    expect(nearestIndex([{ x: 100, y: 100 }], 108, 100, 12)).toBe(0);
    expect(nearestIndex([{ x: 100, y: 100 }], 100, 108, 12)).toBe(0);
  });
});

describe('a11y / performance contract', () => {
  it('gives the figure an accessible name from copy', () => {
    const { container } = renderCurve();
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe(copy['a11y.specCurveChart']);
  });

  it('renders a legend keyed to the three point classes', () => {
    const { container } = renderCurve({
      points: [point(0.02, { explored: true, published: true }), point(0.03, { explored: true }), point(0.6)],
    });
    const text = container.querySelector('[data-role="legend"]')?.textContent ?? '';
    expect(text).toContain(copy['legend.unexplored']);
    expect(text).toContain(copy['legend.explored']);
    expect(text).toContain(copy['legend.published']);
  });

  it('renders every point once, with no per-point event handler re-layout', () => {
    const many = Array.from({ length: 400 }, (_, i) => point((i + 1) / 401));
    const { container } = renderCurve({ points: many });
    expect(container.querySelectorAll('circle[data-p]').length).toBe(400);
    // One overlay carries the pointer interaction for all of them.
    expect(container.querySelectorAll('[data-role="hit"]').length).toBe(1);
  });
});

/* ------------------------------------------------------------------ review */

describe('review I1 — touch', () => {
  const published = spec({ subgroup: 'urban', tails: 'one' });
  const points = [point(0.041, { spec: published, explored: true }), point(0.7)];

  it('summons the tooltip on a stationary tap, not only on a move', () => {
    const { container } = renderCurve({ points });
    const svg = container.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => VIEWBOX_RECT;
    const dot = container.querySelector('circle[data-p="0.041"]') as SVGCircleElement;

    // A finger that lands and does not move fires pointerdown and nothing else.
    fireEvent.pointerDown(container.querySelector('[data-role="hit"]') as SVGRectElement, {
      clientX: Number(dot.getAttribute('cx')),
      clientY: Number(dot.getAttribute('cy')),
    });

    expect(container.querySelector('[data-role="tooltip"]')?.textContent).toContain(
      recipeLabel(published, OUTCOME_LABELS, copy)
    );
  });
});

describe('review I2 — the callout stays on the plate', () => {
  const busiest = spec({
    subgroup: 'exp_high',
    covariates: { income: true, risk: true },
    exclusion: 'z2_5',
    transform: 'log1p',
    tails: 'two',
  });
  const points = [point(0.012, { spec: busiest, explored: true, published: true }), point(0.6)];
  const labels = [LONGEST_SHIPPED_LABEL, 'b', 'c', 'd'];

  it('abbreviates the outcome to §7.4 notation instead of spelling a 55-character label', () => {
    const { container } = renderCurve({ points, outcomeLabels: labels });
    const callout = container.querySelector('[data-role="callout"]') as SVGTextElement;
    expect(callout.textContent).toBe(recipeLabelCompact(busiest, copy));
    expect(callout.textContent).not.toContain(LONGEST_SHIPPED_LABEL);
    expect(recipeLabelCompact(busiest, copy).startsWith('Y₁')).toBe(true);
  });

  it('fits every callout line inside the plate, at the worst-case recipe', () => {
    const { container } = renderCurve({ points, outcomeLabels: labels });
    const callout = container.querySelector('[data-role="callout"]') as SVGTextElement;
    const room = SPEC_CURVE_GEOM.width - SPEC_CURVE_GEOM.calloutX - SPEC_CURVE_GEOM.padRight;
    const lines = [...callout.querySelectorAll('tspan')];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect((line.textContent ?? '').length * FIGURE_TEXT_PX * GLYPH_ADVANCE).toBeLessThanOrEqual(room);
    }
  });

  it('keeps the full label reachable in the tooltip — the notation costs nothing', () => {
    const { container } = renderCurve({ points, outcomeLabels: labels });
    const svg = container.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => VIEWBOX_RECT;
    const dot = container.querySelector('circle[data-p="0.012"]') as SVGCircleElement;
    fireEvent.pointerMove(container.querySelector('[data-role="hit"]') as SVGRectElement, {
      clientX: Number(dot.getAttribute('cx')),
      clientY: Number(dot.getAttribute('cy')),
    });
    expect(container.querySelector('[data-role="tooltip"]')?.textContent).toContain(LONGEST_SHIPPED_LABEL);
  });
});

/**
 * Review I3. jsdom lays nothing out — it has no ResizeObserver and every
 * getBoundingClientRect is 0×0 — so the RENDER cannot be pixel-tested here.
 * What can be tested, and what actually decides the outcome, is the geometry
 * arithmetic: the viewBox tracks the container, so one user unit is one CSS
 * pixel and the figure's type and hit targets are width-invariant by
 * construction. That division is deliberate — these assertions pin the math,
 * and the screenshots in the task report cover the pixels.
 */
describe('review I3 — scale invariance across container widths', () => {
  const WIDTHS = [320, 660, 1088];

  it.each(WIDTHS)('renders one viewBox unit as exactly one CSS pixel at %ipx', (width) => {
    expect(cssPixelsPerUnit(width)).toBe(1);
  });

  it('holds figure type at the design system caption size at every supported width', () => {
    for (const width of WIDTHS) {
      const cssPx = FIGURE_TEXT_PX * cssPixelsPerUnit(width);
      expect(cssPx).toBeGreaterThanOrEqual(11); // legible on a phone
      expect(cssPx).toBeLessThanOrEqual(13); // never ballooned past --text-13
    }
  });

  it('holds the hit target past the 8px floor at every supported width', () => {
    for (const width of WIDTHS) {
      expect(HIT_RADIUS_PX * cssPixelsPerUnit(width)).toBeGreaterThanOrEqual(8);
    }
  });

  it('lays the plot out exactly inside the container at every width', () => {
    for (const width of WIDTHS) {
      const geom = geometryFor(width, false);
      expect(geom.width).toBe(width);
      expect(geom.padLeft + geom.plotWidth + geom.padRight).toBe(width);
      expect(geom.padTop + geom.plotHeight + geom.padBottom).toBe(geom.height);
    }
  });

  it('keeps the four bands inside the plot at every width', () => {
    for (const width of WIDTHS) {
      const geom = geometryFor(width, true);
      expect(geom.bandWidth * 4 + geom.bandGap * 3).toBeCloseTo(geom.plotWidth, 6);
      expect(geom.bandWidth).toBeGreaterThan(0);
    }
  });

  it('widens the callout and band-label budgets as the figure grows', () => {
    expect(geometryFor(320, false).calloutMaxChars).toBeLessThan(geometryFor(1088, false).calloutMaxChars);
    expect(geometryFor(320, true).bandLabelMaxChars).toBeLessThan(geometryFor(1088, true).bandLabelMaxChars);
  });

  it('degrades proportionally below the supported floor, and never degenerately', () => {
    expect(cssPixelsPerUnit(200)).toBeCloseTo(200 / 320, 10);
    expect(geometryFor(200, false).plotWidth).toBeGreaterThan(0);
    expect(geometryFor(0, false).width).toBe(FIGURE_DEFAULT_WIDTH); // unmeasured
    expect(cssPixelsPerUnit(0)).toBe(1);
  });
});

describe('review I4 — the legend does not claim a mark the figure has not got', () => {
  it('omits the published row when the player published nothing', () => {
    const { container } = renderCurve({ points: [point(0.02, { explored: true }), point(0.6)] });
    const legend = container.querySelector('[data-role="legend"]') as HTMLElement;
    expect(legend.querySelectorAll('li').length).toBe(2);
    expect(legend.textContent).not.toContain(copy['legend.published']);
    expect(legend.textContent).toContain(copy['legend.explored']);
  });
});

// M1, subsumed by I2's callout work: both the callout and the band labels now
// go through wrapLabel, so its behaviour is pinned rather than inferred.
describe('label wrapping', () => {
  it('wraps greedily and keeps every word', () => {
    expect(wrapLabel('Annualized excess return over the benchmark', 22)).toEqual([
      'Annualized excess',
      'return over the',
      'benchmark',
    ]);
  });

  it('fits the longest shipped outcome label in three lines with nothing lost', () => {
    const lines = wrapLabel(LONGEST_SHIPPED_LABEL, 22);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join(' ')).toBe(LONGEST_SHIPPED_LABEL);
  });

  it('marks a truncation rather than silently dropping words', () => {
    const lines = wrapLabel('one two three four five six', 8, 2);
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });
});

describe('review I3 — band labels degrade instead of colliding', () => {
  // Caught by looking at a real 320px render: a band is 57px wide there, so a
  // single word of a shipped label overran its band and overlapped the
  // neighbour's. §7.4's own notation is the honest fallback.
  // gr6-023 raised the threshold from 12 to 20 — the longest single token in
  // any shipped outcome label, in any locale (IT's "passivo-aggressività").
  // 660 moved below it in the process, which is the POINT: at 660 a band was
  // 12-to-19 characters wide and `wrapLabel` was being handed a 20-character
  // word, which it placed unwrapped straight across the neighbour's band.
  it('names the outcome where the band is wide enough for the longest word it could hold', () => {
    for (const width of [720, 1088]) {
      const geom = geometryFor(width, true);
      expect(geom.bandLabelMaxChars).toBeGreaterThanOrEqual(BAND_LABEL_MIN_CHARS);
      expect(bandLabel(1, OUTCOME_LABELS, geom)).toBe(OUTCOME_LABELS[1]);
    }
  });

  it('falls back to §7.4 notation on a phone-width band', () => {
    const geom = geometryFor(320, true);
    expect(geom.bandLabelMaxChars).toBeLessThan(BAND_LABEL_MIN_CHARS);
    expect(bandLabel(0, OUTCOME_LABELS, geom)).toBe('Y₁');
    expect(bandLabel(3, OUTCOME_LABELS, geom)).toBe('Y₄');
    // Never the label that would have collided.
    expect(bandLabel(0, [LONGEST_SHIPPED_LABEL, 'b', 'c', 'd'], geom)).not.toContain('Attendee');
  });

  it('uses the same abbreviation the callout does, so the figure is self-consistent', () => {
    const geom = geometryFor(320, true);
    expect(recipeLabelCompact(spec({ outcome: 1 }), copy).startsWith(bandLabel(1, OUTCOME_LABELS, geom))).toBe(true);
  });
});

/* ==========================================================================
   gr6-023 — THE THRESHOLD IS A CLAIM ABOUT THE CONTENT, SO THE CONTENT
   CHECKS IT.
   `BAND_LABEL_MIN_CHARS` says "below this many characters per band, a shipped
   outcome label cannot be drawn without colliding". That is only true while
   no shipped label contains a token longer than it. Nothing enforced that,
   and Italian shipped a 20-character one ("passivo-aggressività") against a
   threshold of 12 — which `wrapLabel`'s forced-placement branch then drew
   unwrapped, straight across the neighbouring band, at every container from
   440 to 663px.
   This reads the REAL content of all three locales, so a new label in any of
   them reds here rather than in a screenshot nobody takes.
   ========================================================================== */
describe('gr6-023 — the band-label threshold covers the longest token actually shipped', () => {
  const LOCALES = [
    ['en', enFullContent],
    ['it', itFullContent],
    ['es', esFullContent],
  ] as const;

  function longestToken(content: (typeof LOCALES)[number][1]): string {
    let longest = '';
    for (const scenario of content.scenarios) {
      for (const label of scenario.outcomeLabels) {
        for (const token of label.split(' ')) if (token.length > longest.length) longest = token;
      }
    }
    return longest;
  }

  it.each(LOCALES.map(([name]) => name))('%s: no outcome-label token is wider than the threshold', (name) => {
    const content = LOCALES.find(([n]) => n === name)![1];
    const longest = longestToken(content);
    expect(longest.length, `${name}'s longest token is "${longest}"`).toBeLessThanOrEqual(BAND_LABEL_MIN_CHARS);
  });

  it('is not vacuous — the measured worst case really is 20 characters (IT)', () => {
    expect(longestToken(itFullContent)).toBe('passivo-aggressività');
    expect(BAND_LABEL_MIN_CHARS).toBe(20);
  });

  it('and wrapLabel now truncates the forced placement instead of overflowing it', () => {
    // The exact case measured: a 20-character single word into a band that
    // has room for 12. Before gr6-023 this returned the word untouched.
    const [line] = wrapLabel('passivo-aggressività', 12);
    expect(line.length).toBe(12);
    expect(line.endsWith('…')).toBe(true);
  });
});
