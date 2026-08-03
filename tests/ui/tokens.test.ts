import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the design-system foundation (docs/DESIGN.md, master spec §7.1/§7.2/§7.5).
 *
 * These assertions are the mechanical half of DESIGN.md: the document states the
 * rules in prose, this file makes the checkable ones fail the build. Rule ids in
 * the test names refer to docs/DESIGN.md.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOKENS_REL = 'src/ui/theme/tokens.css';
const TOKENS_PATH = join(ROOT, TOKENS_REL);
const DESIGN_PATH = join(ROOT, 'docs/DESIGN.md');
const UI_DIR = join(ROOT, 'src/ui');

const css = readFileSync(TOKENS_PATH, 'utf8');

/** Slice a top-level rule block (`selector { ... }`) out of the stylesheet text. */
function block(selectorPattern: RegExp): string {
  const match = selectorPattern.exec(css);
  if (!match) throw new Error(`tokens.css has no top-level block matching ${selectorPattern}`);
  const start = css.indexOf('{', match.index);
  const end = css.indexOf('}', start);
  if (start === -1 || end === -1) throw new Error(`unterminated block for ${selectorPattern}`);
  return css.slice(start + 1, end);
}

/** Read one custom property's declared value out of a block. */
function prop(blockText: string, name: string): string | undefined {
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(blockText);
  return match?.[1].trim();
}

const rootBlock = block(/^:root\s*\{/m);
const darkBlock = block(/^\[data-theme=['"]dark['"]\]\s*\{/m);

/* ---------------------------------------------------------------- colour math */

const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio (master spec §7.5 requires >= 4.5:1 on text). */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ file walk */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const uiSourceFiles = walk(UI_DIR).filter((f) => /\.(tsx?|css)$/.test(f) && relative(ROOT, f) !== TOKENS_REL);

/* ============================================================ §7.2 palette */

// Master spec §7.2 — these seven values are fixed and may never be edited.
const SPEC_LIGHT: Record<string, string> = {
  paper: '#FBF8F1',
  ink: '#1C1B18',
  rule: '#D8D2C4',
  'sig-red': '#B3261E',
  'assist-green': '#2E6E4E',
  'hack-gold': '#B98A2C',
  muted: '#6E6A5E',
};

// Master spec §7.2 pins only paper and ink for the dark theme.
const SPEC_DARK_FIXED: Record<string, string> = { paper: '#141821', ink: '#E8E4D9' };

describe('R1 palette — §7.2 tokens', () => {
  it.each(Object.entries(SPEC_LIGHT))('defines --%s under :root as the spec value %s', (name, value) => {
    expect(prop(rootBlock, name)?.toUpperCase()).toBe(value);
  });

  it.each(Object.keys(SPEC_LIGHT))('overrides --%s under [data-theme="dark"]', (name) => {
    expect(prop(darkBlock, name)).toBeDefined();
  });

  it.each(Object.entries(SPEC_DARK_FIXED))('uses the spec dark value for --%s (%s)', (name, value) => {
    expect(prop(darkBlock, name)?.toUpperCase()).toBe(value);
  });

  it('declares the text-safe gold used wherever gold carries characters', () => {
    expect(prop(rootBlock, 'hack-gold-ink')).toBeDefined();
    expect(prop(darkBlock, 'hack-gold-ink')).toBeDefined();
  });
});

/* ============================================================ §7.5 contrast */

// --rule draws hairlines and --hack-gold paints confetti/marks; neither ever
// renders characters (DESIGN.md R1.4, R1.6), so neither is a text token.
const TEXT_TOKENS = ['ink', 'muted', 'sig-red', 'assist-green', 'hack-gold-ink'];

describe('R1/R7 contrast — §7.5 requires >= 4.5:1 on every text token', () => {
  for (const theme of ['light', 'dark'] as const) {
    const source = theme === 'light' ? rootBlock : darkBlock;
    const paper = prop(source, 'paper');

    it.each(TEXT_TOKENS)(`${theme}: --%s clears 4.5:1 against --paper`, (name) => {
      const value = prop(source, name);
      expect(value, `--${name} is undefined in the ${theme} theme`).toBeDefined();
      expect(contrastRatio(value as string, paper as string)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('keeps the dark theme readable at least as well as the light theme for ink', () => {
    expect(contrastRatio(prop(darkBlock, 'ink') as string, prop(darkBlock, 'paper') as string)).toBeGreaterThanOrEqual(7);
  });
});

/* ============================================================ R1.2 no raw hex */

describe('R1.2 tokens.css is the only source of colour', () => {
  it('finds no hex colour literal anywhere under src/ui outside tokens.css', () => {
    const offenders = uiSourceFiles
      .map((file) => ({ file: relative(ROOT, file), hits: readFileSync(file, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? [] }))
      .filter((entry) => entry.hits.length > 0);
    expect(offenders).toEqual([]);
  });

  it('finds no rgb()/hsl() colour literal anywhere under src/ui outside tokens.css', () => {
    const offenders = uiSourceFiles
      .map((file) => ({ file: relative(ROOT, file), hits: readFileSync(file, 'utf8').match(/\b(rgba?|hsla?)\s*\(/g) ?? [] }))
      .filter((entry) => entry.hits.length > 0);
    expect(offenders).toEqual([]);
  });
});

/* ============================================================ R4 surfaces */

describe('R4 surfaces — hairlines, not boxes', () => {
  it('keeps every px border-radius under src/ui at or below 2px', () => {
    const offenders: string[] = [];
    for (const file of [...uiSourceFiles, TOKENS_PATH]) {
      const text = readFileSync(file, 'utf8');
      for (const [, value] of text.matchAll(/border-?[Rr]adius:?\s*'?([\d.]+)px/g)) {
        if (Number(value) > 2) offenders.push(`${relative(ROOT, file)}: ${value}px`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('declares no box-shadow anywhere under src/ui', () => {
    const offenders = [...uiSourceFiles, TOKENS_PATH]
      .filter((file) => /box-?[Ss]hadow/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});

/* ============================================================ R3 spacing */

describe('R3 spacing scale is closed', () => {
  const declared = [...rootBlock.matchAll(/--space-(\d+)\s*:\s*(\d+)px;/g)].map(([, name, value]) => [Number(name), Number(value)]);

  it('declares exactly 4/8/12/16/24/40/64 and nothing else', () => {
    expect(declared.map(([name]) => name)).toEqual([4, 8, 12, 16, 24, 40, 64]);
  });

  it('names every step after its own pixel value', () => {
    expect(declared.filter(([name, value]) => name !== value)).toEqual([]);
  });
});

/* ============================================================ R2 type scale */

describe('R2 type scale is closed', () => {
  it('declares exactly the 13/15/22/28/40 steps', () => {
    const steps = [...rootBlock.matchAll(/--text-(\d+)\s*:\s*(\d+)px;/g)].map(([, name]) => Number(name));
    expect(steps).toEqual([13, 15, 22, 28, 40]);
  });

  it('sizes the p-value dial responsively between 64px and 96px', () => {
    expect(prop(rootBlock, 'text-dial')).toMatch(/clamp\(\s*64px\s*,[^,]+,\s*96px\s*\)/);
  });

  it('declares only the 400 and 500 weights', () => {
    const weights = [...rootBlock.matchAll(/--weight-[a-z]+\s*:\s*(\d+);/g)].map(([, w]) => Number(w));
    expect(weights.sort()).toEqual([400, 500]);
  });

  it('declares the three families the spec names', () => {
    expect(prop(rootBlock, 'font-display')).toMatch(/STIX Two Text/);
    expect(prop(rootBlock, 'font-mono')).toMatch(/JetBrains Mono/);
    expect(prop(rootBlock, 'font-ui')).toMatch(/system-ui/);
  });
});

/* ============================================================ R5 motion */

describe('R5 motion budget is exhaustive', () => {
  const durations = Object.fromEntries(
    [...rootBlock.matchAll(/--dur-([a-z]+)\s*:\s*(\d+m?s);/g)].map(([, name, value]) => [name, value]),
  );

  it('declares exactly four durations — the four animations the spec allows', () => {
    expect(durations).toEqual({ tick: '120ms', stamp: '450ms', fade: '300ms', confetti: '3000ms' });
  });

  it('collapses the CSS durations under prefers-reduced-motion', () => {
    const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)/.exec(css);
    expect(reduced, 'tokens.css must ship a prefers-reduced-motion override').not.toBeNull();
    const tail = css.slice(reduced?.index ?? 0);
    for (const name of ['tick', 'stamp', 'fade']) {
      expect(new RegExp(`--dur-${name}\\s*:\\s*1ms;`).test(tail), `--dur-${name} must collapse to 1ms`).toBe(true);
    }
  });
});

/* ============================================================ R6 focus */

describe('R6 focus is a token, not a per-component decision', () => {
  it('declares a 2px --ink ring with a 2px offset', () => {
    expect(prop(rootBlock, 'focus-ring')).toBe('2px solid var(--ink)');
    expect(prop(rootBlock, 'focus-offset')).toBe('2px');
  });

  it('never overrides the ring in the dark theme — --ink already flips', () => {
    expect(prop(darkBlock, 'focus-ring')).toBeUndefined();
  });
});

/* ============================================================ doc / code drift */

describe('DESIGN.md documents the tokens it governs', () => {
  const design = readFileSync(DESIGN_PATH, 'utf8');

  it('lists every hex value that tokens.css declares', () => {
    const hexes = [...new Set((css.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toUpperCase()))];
    const undocumented = hexes.filter((hex) => !design.toUpperCase().includes(hex));
    expect(undocumented).toEqual([]);
  });

  it('names every custom property that tokens.css declares', () => {
    const names = [...new Set((css.match(/--[a-z0-9-]+(?=\s*:)/g) ?? []))];
    const undocumented = names.filter((name) => !design.includes(name));
    expect(undocumented).toEqual([]);
  });
});
