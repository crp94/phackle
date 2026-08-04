// @vitest-environment jsdom
//
// T31: the Lab's DataCut figure — master spec §2.4's "tiny scatter/box visual
// of the current cut", restored after the play-test ("the UX/UI needs graphs
// at least; and explanations; it feels too barebone").
//
// What the figure has to be true about, and what these tests therefore pin:
//   (a) two columns, control LEFT and treated RIGHT, every value drawn;
//   (b) excluded points are still IN the figure, as their own hollow crossed
//       mark — the exclusion knob performs visible surgery, not a silent n
//       drop. This is the whole reason the figure exists, so it gets the most
//       tests: they render, they are counted, they stay inside the plot's own
//       vertical domain (never clipped), and a point KEEPS ITS X when it
//       crosses from included to excluded, which is what makes "watch these
//       specific people leave" legible rather than a reshuffle;
//   (c) jitter is deterministic — a pure function of the datum, never
//       Math.random, so the figure is stable across re-renders and identical
//       for every player (§3.1's determinism, extended to pixels, exactly as
//       tests/ui/speccurve.test.tsx pins for fig. 1);
//   (d) group mean bars, computed over the INCLUDED values only (that is what
//       OLS actually sees);
//   (e) scale invariance per T16's viewBox-tracks-container mechanism: one
//       user unit is one CSS pixel at every width, so a 13px label is 13px on
//       a phone and on a desktop.
//
// Conventions follow tests/ui/lab.test.tsx and tests/ui/speccurve.test.tsx
// (no jest-dom, plain DOM reads, getAttribute for SVG-safe class checks).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { copy as enCopy } from '../../src/content/en/copy';
import {
  CUT_DEFAULT_WIDTH,
  CUT_MAX_WIDTH,
  CUT_MIN_WIDTH,
  DataCut,
  columnCentre,
  columnMean,
  cutCssPixelsPerUnit,
  cutDomain,
  cutGeometryFor,
  cutValueY,
  jitterUnit,
} from '../../src/ui/components/DataCut';
import { runSpec } from '../../src/engine/analyze';
import { generateDataset } from '../../src/engine/dgp';
import type { DataCut as DataCutValues, Spec } from '../../src/engine/types';

afterEach(cleanup);

// Read from the project root (vitest's cwd): under @vitest-environment jsdom
// `import.meta.url` is not a file: URL, so the tokens-test idiom is not
// available here. Comments are stripped the same way tests/ui/tokens.test.ts
// strips them, for the same reason: prose may discuss `Math.random` (this
// component's doc comment explains at length why it does not use it); CODE
// may not contain it.
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const SOURCE = stripComments(readFileSync(join(process.cwd(), 'src/ui/components/DataCut.tsx'), 'utf8'));

function emptyCut(): DataCutValues {
  return { control: [], treated: [], excludedControl: [], excludedTreated: [] };
}

/** A cut with a clean, hand-checkable shape: control means 2, treated means 4,
 * and one extreme outlier excluded from each column. */
function sampleCut(): DataCutValues {
  return {
    control: [1, 2, 3],
    treated: [3, 4, 5],
    excludedControl: [-20],
    excludedTreated: [30],
  };
}

function renderCut(cut: DataCutValues | null) {
  return render(
    <LocaleProvider>
      <DataCut cut={cut} treatmentLabel="Owns a cat" />
    </LocaleProvider>
  );
}

const dots = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-role="cut-dot"]'));
const excluded = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-role="cut-excluded"]'));
const means = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-role="cut-mean"]'));
const cx = (el: Element) => Number(el.getAttribute('cx') ?? el.getAttribute('data-x'));
const group = (el: Element) => el.getAttribute('data-group');

// ---------------------------------------------------------------------------
// (c) determinism
// ---------------------------------------------------------------------------

describe('DataCut jitter is deterministic (never Math.random)', () => {
  it('contains no Math.random anywhere in the component\'s code', () => {
    expect(SOURCE.includes('Math.random')).toBe(false);
    // Guards the guard: the comment stripper must not be neutering the scan.
    expect(stripComments('const a = Math.random(); // Math.random').includes('Math.random')).toBe(true);
  });

  it('is a pure function of the datum: the same value always yields the same offset', () => {
    for (const v of [0, 1, -1, 2.5, 1234.5678, -0.0001]) {
      expect(jitterUnit(v)).toBe(jitterUnit(v));
    }
  });

  it('returns a unit fraction in [0, 1) for every value it is given', () => {
    for (let i = -50; i < 50; i++) {
      const u = jitterUnit(i * 0.37);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('actually spreads: 40 distinct values do not collapse onto one offset', () => {
    const offsets = new Set(Array.from({ length: 40 }, (_, i) => jitterUnit(i * 1.7)));
    expect(offsets.size).toBeGreaterThan(30);
  });

  it('places identical marks identically across two independent renders', () => {
    const a = renderCut(sampleCut());
    const xsA = dots(a.container as HTMLElement).map(cx);
    cleanup();
    const b = renderCut(sampleCut());
    const xsB = dots(b.container as HTMLElement).map(cx);
    expect(xsA).toEqual(xsB);
  });
});

// ---------------------------------------------------------------------------
// T31 FIX ROUND — finding 1 (CRITICAL): tie-collapsed jitter.
//
// jitterUnit used to be seeded on the value alone. Outcomes 2 (count) and 3
// (1-10 scale) carry only 8-10 distinct values across a 200+-point column, so
// every point sharing a value painted at the exact same (x, y) — ~200
// analysed points rendering as ~9 visually distinct dots while the legend
// still (correctly) said 200. The fix adds a same-value occurrence
// tiebreaker (see jitterUnit's and placeCut's doc comments in DataCut.tsx);
// this is the regression test for it, run against the REAL DGP (not a hand-
// built fixture) so it actually exercises outcomes 2/3's small support.
// ---------------------------------------------------------------------------

const FIX_ROUND_BASE_SPEC: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

describe('DataCut tie-collapsed jitter regression (T31 fix round, finding 1)', () => {
  it.each([
    [2, 20260804], // count outcome
    [3, 20260805], // 1-10 bounded-discrete outcome
  ] as const)('renders one visually distinguishable mark per analysed point for outcome %i (real DGP)', (outcome, seed) => {
    const dataset = generateDataset(seed, null);
    const spec: Spec = { ...FIX_ROUND_BASE_SPEC, outcome };
    const result = runSpec(dataset, spec, 400);
    expect(result.cut).toBeDefined();
    const cut = result.cut!;
    const analysedCount = cut.control.length + cut.treated.length;
    // Sanity: this really is exercising the many-ties case the bug lived in,
    // not a fluke of a particular seed landing on an all-unique sample.
    expect(analysedCount).toBeGreaterThan(50);

    const { container } = renderCut(cut);
    const included = dots(container as HTMLElement);

    // The literal ask: rendered mark count === analysed count.
    expect(included).toHaveLength(analysedCount);

    // THE REGRESSION ITSELF: before the fix, tied values collapsed onto the
    // same (cx, cy) exactly, so distinct rendered POSITIONS undercounted the
    // analysed total. After the fix every mark is distinguishable.
    const positions = new Set(included.map((m) => `${m.getAttribute('cx')},${m.getAttribute('cy')}`));
    expect(positions.size).toBe(analysedCount);
  });

  it('leaves the continuous-outcome stable-x guarantee untouched (occurrence is always 0 there)', () => {
    // Same case tests/ui/dataCut.test.tsx already pinned pre-fix: a point
    // keeps its x when the exclusion knob moves it from included to
    // excluded. Restated here to document that the fix is additive.
    const before = renderCut({ control: [1, 2], treated: [3, 5], excludedControl: [], excludedTreated: [] });
    const includedX = dots(before.container as HTMLElement).filter((m) => group(m) === 'treated').map(cx);
    cleanup();
    const after = renderCut({ control: [1, 2], treated: [3], excludedControl: [], excludedTreated: [5] });
    const excludedX = excluded(after.container as HTMLElement).map(cx);
    expect(excludedX).toHaveLength(1);
    expect(includedX).toContain(excludedX[0]);
  });
});

// ---------------------------------------------------------------------------
// (a) the two columns
// ---------------------------------------------------------------------------

describe('DataCut columns', () => {
  it('draws every included value as its own dot, tagged with its column', () => {
    const { container } = renderCut(sampleCut());
    const marks = dots(container as HTMLElement);
    expect(marks).toHaveLength(6);
    expect(marks.filter((m) => group(m) === 'control')).toHaveLength(3);
    expect(marks.filter((m) => group(m) === 'treated')).toHaveLength(3);
  });

  it('puts the control column strictly LEFT of the treated column', () => {
    const { container } = renderCut(sampleCut());
    const marks = dots(container as HTMLElement);
    const controlMax = Math.max(...marks.filter((m) => group(m) === 'control').map(cx));
    const treatedMin = Math.min(...marks.filter((m) => group(m) === 'treated').map(cx));
    expect(controlMax).toBeLessThan(treatedMin);
  });

  it('keeps every mark inside its own column band (jitter never bleeds across the gap)', () => {
    const { container } = renderCut(sampleCut());
    const geom = cutGeometryFor(CUT_DEFAULT_WIDTH);
    for (const mark of [...dots(container as HTMLElement), ...excluded(container as HTMLElement)]) {
      const column = group(mark) === 'treated' ? 1 : 0;
      const centre = columnCentre(column, geom);
      expect(Math.abs(cx(mark) - centre)).toBeLessThanOrEqual(geom.jitterSpread / 2 + 0.001);
    }
  });

  it('labels the treated column from the scenario and the control column from the copy catalog', async () => {
    renderCut(sampleCut());
    expect(await screen.findByText(enCopy['lab.cutControl'])).toBeTruthy();
    expect(screen.getByText('Owns a cat')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// (b) THE POINT: exclusions are visible surgery
// ---------------------------------------------------------------------------

describe('DataCut excluded points stay visible', () => {
  it('renders one hollow crossed mark per excluded value, in its own column', () => {
    const { container } = renderCut(sampleCut());
    const marks = excluded(container as HTMLElement);
    expect(marks).toHaveLength(2);
    expect(marks.filter((m) => group(m) === 'control')).toHaveLength(1);
    expect(marks.filter((m) => group(m) === 'treated')).toHaveLength(1);
  });

  it('gives each excluded mark a hollow ring AND a cross (R6.3: shape, not hue alone)', () => {
    const { container } = renderCut(sampleCut());
    const mark = excluded(container as HTMLElement)[0];
    expect(mark.querySelector('circle')).toBeTruthy();
    expect(mark.querySelectorAll('line')).toHaveLength(2);
  });

  it('renders no excluded marks at all when the exclusion knob is off', () => {
    const { container } = renderCut({ ...sampleCut(), excludedControl: [], excludedTreated: [] });
    expect(excluded(container as HTMLElement)).toHaveLength(0);
    expect(dots(container as HTMLElement)).toHaveLength(6);
  });

  it('scales the vertical domain to hold the excluded points too — an outlier is never clipped out of frame', () => {
    const cut = sampleCut(); // excluded values -20 and 30 dwarf the included 1..5
    const geom = cutGeometryFor(CUT_DEFAULT_WIDTH);
    const domain = cutDomain(cut);
    expect(domain[0]).toBeLessThanOrEqual(-20);
    expect(domain[1]).toBeGreaterThanOrEqual(30);

    const { container } = renderCut(cut);
    const top = geom.padTop;
    const bottom = geom.padTop + geom.plotHeight;
    for (const mark of excluded(container as HTMLElement)) {
      const y = Number(mark.getAttribute('data-y'));
      expect(y).toBeGreaterThanOrEqual(top);
      expect(y).toBeLessThanOrEqual(bottom);
    }
  });

  it('KEEPS A POINT\'S X when the exclusion knob moves it out of the analysis (it disappears in place, it does not jump)', () => {
    // The same datum (5, in the treated column) first included, then excluded.
    const before = renderCut({ control: [1, 2], treated: [3, 5], excludedControl: [], excludedTreated: [] });
    const includedX = dots(before.container as HTMLElement).filter((m) => group(m) === 'treated').map(cx);
    cleanup();
    const after = renderCut({ control: [1, 2], treated: [3], excludedControl: [], excludedTreated: [5] });
    const excludedX = excluded(after.container as HTMLElement).map(cx);
    expect(excludedX).toHaveLength(1);
    expect(includedX).toContain(excludedX[0]);
  });

  it('counts both populations in the legend', async () => {
    renderCut(sampleCut());
    expect(await screen.findByText(enCopy['lab.cutLegendIncluded'].replace('{n}', '6'))).toBeTruthy();
    expect(screen.getByText(enCopy['lab.cutLegendExcluded'].replace('{n}', '2'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// (d) mean bars
// ---------------------------------------------------------------------------

describe('DataCut group means', () => {
  it('averages the INCLUDED values only — the excluded outlier does not drag the bar', () => {
    expect(columnMean([1, 2, 3])).toBe(2);
    expect(columnMean([3, 4, 5])).toBe(4);
    expect(columnMean([])).toBeNull();
  });

  it('draws one mean bar per non-empty column, at the included mean', () => {
    const cut = sampleCut();
    const { container } = renderCut(cut);
    const bars = means(container as HTMLElement);
    expect(bars).toHaveLength(2);

    const geom = cutGeometryFor(CUT_DEFAULT_WIDTH);
    const domain = cutDomain(cut);
    const byGroup = Object.fromEntries(bars.map((b) => [group(b), Number(b.getAttribute('y1'))]));
    expect(byGroup.control).toBeCloseTo(cutValueY(2, domain, geom), 6);
    expect(byGroup.treated).toBeCloseTo(cutValueY(4, domain, geom), 6);
  });

  it('draws the treated mean ABOVE the control mean when the treated group scores higher', () => {
    const { container } = renderCut(sampleCut());
    const bars = means(container as HTMLElement);
    const y = (g: string) => Number(bars.find((b) => group(b) === g)?.getAttribute('y1'));
    expect(y('treated')).toBeLessThan(y('control')); // SVG y grows downward
  });

  it('keeps clear air between the two bars, so they never read as one rule across the figure', () => {
    // Self-review finding: at full column width the two mean bars very nearly
    // meet across the 12px column gap and read as a single axis spanning the
    // whole plot — the opposite of "here are two averages, compare them".
    const { container } = renderCut(sampleCut());
    const geom = cutGeometryFor(CUT_DEFAULT_WIDTH);
    const bars = means(container as HTMLElement);
    const x1 = (g: string) => Number(bars.find((b) => group(b) === g)?.getAttribute('x1'));
    const x2 = (g: string) => Number(bars.find((b) => group(b) === g)?.getAttribute('x2'));

    for (const g of ['control', 'treated']) {
      expect(x2(g) - x1(g)).toBeLessThan(geom.columnWidth);
    }
    // The gap between the bars must be visibly wider than the column gap alone.
    expect(x1('treated') - x2('control')).toBeGreaterThan(geom.columnGap * 2);
  });

  it('omits the bar for a column with no included values left', () => {
    const { container } = renderCut({ control: [1, 2], treated: [], excludedControl: [], excludedTreated: [9] });
    const bars = means(container as HTMLElement);
    expect(bars).toHaveLength(1);
    expect(group(bars[0])).toBe('control');
  });
});

// ---------------------------------------------------------------------------
// (e) scale invariance (T16's mechanism, reused)
// ---------------------------------------------------------------------------

describe('DataCut scale invariance', () => {
  // Viewport widths from the self-review, and the container widths the Lab's
  // results pane actually hands the figure at each of them.
  it.each([320, 660, 1088, 272, 336, 520, CUT_MIN_WIDTH])(
    'renders exactly 1 CSS pixel per viewBox unit at a %spx container',
    (width) => {
      expect(cutCssPixelsPerUnit(width)).toBe(1);
    }
  );

  it('degrades predictably below the minimum width instead of going degenerate', () => {
    const geom = cutGeometryFor(120);
    expect(geom.width).toBe(CUT_MIN_WIDTH);
    expect(geom.columnWidth).toBeGreaterThan(0);
    expect(geom.jitterSpread).toBeGreaterThan(0);
  });

  it('gives the svg a viewBox that tracks the measured container width', () => {
    const { container } = renderCut(sampleCut());
    const svg = container.querySelector('svg');
    const geom = cutGeometryFor(CUT_DEFAULT_WIDTH);
    expect(svg?.getAttribute('viewBox')).toBe(`0 0 ${geom.width} ${geom.height}`);
  });

  it('stays shorter than the dial it sits beneath (R8.3: it must not out-shout the signature)', () => {
    // --text-dial tops out at 96px and the dial carries n/df beneath it, so
    // the whole figure's drawn area is held below the dial numeral itself.
    expect(cutGeometryFor(CUT_DEFAULT_WIDTH).height).toBeLessThanOrEqual(96);
  });

  // T31 FIX ROUND — finding 3: figure pixels were being spent on the
  // informationless jitter axis instead of the axis that actually separates
  // the two group means.
  it('caps the jitter band at 64px, however wide the container gets', () => {
    for (const width of [660, 1088, 1600, CUT_MAX_WIDTH]) {
      expect(cutGeometryFor(width).jitterSpread).toBeLessThanOrEqual(64);
    }
  });

  it('gives the plot more vertical room than the pre-fix 72px, while staying under the dial', () => {
    const geom = cutGeometryFor(CUT_DEFAULT_WIDTH);
    expect(geom.plotHeight).toBeGreaterThan(72);
    expect(geom.height).toBeLessThanOrEqual(96);
  });
});

// ---------------------------------------------------------------------------
// empty / absent states
// ---------------------------------------------------------------------------

describe('DataCut empty states', () => {
  it('renders the frame but no marks when there is no cut yet', () => {
    const { container } = renderCut(null);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(dots(container as HTMLElement)).toHaveLength(0);
    expect(excluded(container as HTMLElement)).toHaveLength(0);
    expect(means(container as HTMLElement)).toHaveLength(0);
  });

  it('renders the frame but no marks for an empty cut (a subgroup with nobody in it)', () => {
    const { container } = renderCut(emptyCut());
    expect(container.querySelector('svg')).toBeTruthy();
    expect(dots(container as HTMLElement)).toHaveLength(0);
    expect(means(container as HTMLElement)).toHaveLength(0);
  });

  it('does not divide by a zero range when every value is identical', () => {
    const { container } = renderCut({ control: [7, 7], treated: [7, 7], excludedControl: [], excludedTreated: [] });
    for (const mark of dots(container as HTMLElement)) {
      expect(Number.isFinite(Number(mark.getAttribute('cy')))).toBe(true);
    }
  });

  it('carries an accessible label naming what the figure shows', async () => {
    const { container } = renderCut(sampleCut());
    await screen.findByText(enCopy['lab.cutControl']); // the locale content has landed
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(enCopy['a11y.dataCut']);
  });
});
