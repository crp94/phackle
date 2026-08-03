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
import type { CopyKey } from '../../src/content/en/copy';
import type { Outcome, Spec } from '../../src/engine/types';
import {
  SpecCurve,
  SPEC_CURVE_GEOM,
  curveY,
  formatP,
  nearestIndex,
  recipeLabel,
  type SpecCurvePoint,
} from '../../src/ui/charts/SpecCurve';

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
    expect(callout?.textContent).toBe(recipeLabel(points[0].spec, OUTCOME_LABELS, copy));
  });

  it('omits the callout and leader when there is no published path', () => {
    const { container } = renderCurve({ points: [point(0.02), point(0.6)] });
    expect(container.querySelector('[data-role="callout"]')).toBeNull();
    expect(container.querySelector('[data-role="leader"]')).toBeNull();
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
    const geom = SPEC_CURVE_GEOM;
    // 1:1 client-to-viewBox mapping, so the fired coordinates ARE user units.
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: geom.width, height: geom.height, right: geom.width, bottom: geom.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
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
    const { container } = renderCurve();
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
