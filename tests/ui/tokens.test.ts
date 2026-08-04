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

  it('declares the PValueDial\'s three stepped colours in both themes (DESIGN.md R1.8)', () => {
    for (const name of ['dial-step-1', 'dial-step-2', 'dial-step-3']) {
      expect(prop(rootBlock, name)).toBeDefined();
      expect(prop(darkBlock, name)).toBeDefined();
    }
  });
});

/* ============================================================ §7.5 contrast */

// --rule draws hairlines and --hack-gold paints confetti/marks; neither ever
// renders characters (DESIGN.md R1.4, R1.6), so neither is a text token.
// --dial-step-1/2/3 (R1.8) ARE text tokens — they paint the PValueDial's
// numeral directly — which is exactly why they must live here: this is what
// makes R1.8's "stays >= 4.5:1 at every step" claim mechanically enforced
// rather than merely asserted in prose.
const TEXT_TOKENS = ['ink', 'muted', 'sig-red', 'assist-green', 'hack-gold-ink', 'dial-step-1', 'dial-step-2', 'dial-step-3'];

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

/* ======================================================= R1.7 no raw colour */

/**
 * Every CSS named colour (CSS Color Level 4), minus the two keywords that are
 * not colours in R1.1's sense: `transparent` clears, `currentColor` inherits.
 * R1.7 bans the rest outright — a `color: tomato` in a .css file or a
 * `style={{ color: 'white' }}` in a .tsx file is exactly as illegal as a hex.
 */
const NAMED_COLORS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen',
  'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
  'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
  'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia',
  'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey',
  'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
  'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
  'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime',
  'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid',
  'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise',
  'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy',
  'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
  'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue',
  'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown',
  'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey',
  'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet',
  'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
];

/**
 * A keyword only counts when it stands alone as a value. The lookbehind spares
 * `var(--sig-red)` and `Math.tan`; the lookahead spares the CSS `tan()` function
 * and hyphenated identifiers. Hyphenated framework palette utilities
 * (`text-red-500`) are therefore caught by the separate scan below instead.
 */
const NAMED_COLOR_RE = new RegExp(String.raw`(?<![\w.$#-])(${NAMED_COLORS.join('|')})(?![\w(-])`, 'gi');

/** Tailwind-style palette utilities smuggle a colour literal in as a class name. */
const PALETTE_UTILITY_RE =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|shadow|accent|caret|divide|placeholder)-(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/g;

/** Comments discuss colours by name legitimately; code may not. */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Files whose *code* (comments removed) must contain no colour literal at all. */
const uiCode = uiSourceFiles.map((file) => ({ file: relative(ROOT, file), code: stripComments(readFileSync(file, 'utf8')) }));

function offenders(pattern: RegExp): string[] {
  return uiCode.flatMap(({ file, code }) => (code.match(pattern) ?? []).map((hit) => `${file}: ${hit}`));
}

describe('R1.7 tokens.css is the only source of colour', () => {
  it('finds no hex colour literal anywhere under src/ui outside tokens.css', () => {
    expect(offenders(/#[0-9a-fA-F]{3,8}\b/g)).toEqual([]);
  });

  it('finds no rgb()/hsl() colour literal anywhere under src/ui outside tokens.css', () => {
    expect(offenders(/\b(rgba?|hsla?)\s*\(/g)).toEqual([]);
  });

  it('finds no CSS named colour anywhere under src/ui outside tokens.css', () => {
    expect(offenders(NAMED_COLOR_RE)).toEqual([]);
  });

  it('finds no framework palette utility class anywhere under src/ui', () => {
    expect(offenders(PALETTE_UTILITY_RE)).toEqual([]);
  });

  // R1.3a: colours may only be derived inside tokens.css, where §0 can register
  // them. An inline mix is a new colour that never had to justify itself.
  it('finds no inline colour derivation outside tokens.css', () => {
    expect(offenders(/\b(color-mix|color-contrast)\s*\(/g)).toEqual([]);
  });

  it('still recognises a violation when one is introduced', () => {
    // Guards the guards: the lookarounds above must not neuter the scan.
    const sample = stripComments(`.a { color: tomato; }\n/* white is fine in prose */\n<b style={{ color: 'white' }} class="text-red-500" />`);
    expect(sample.match(NAMED_COLOR_RE)).toEqual(['tomato', 'white']);
    expect(sample.match(PALETTE_UTILITY_RE)).toEqual(['text-red-500']);
    expect('color: var(--sig-red); width: tan(45deg);'.match(NAMED_COLOR_RE)).toBeNull();
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

/**
 * T35 turned §5 from a four-item budget into a motion SYSTEM, and moved its
 * enforcement into `tests/ui/motion.test.ts` — which owns the scale's exact
 * values, the site register's agreement with DESIGN.md R5.2's table, the
 * compositor-property rule and reduced-motion parity. What stays here is only
 * what this file is FOR: that the tokens the rest of the design system leans
 * on exist in `tokens.css` at all, and that the reduced-motion override
 * exists. Duplicating the value assertions would give two files a claim on
 * the same fact and let them disagree.
 */
describe('R5 motion — the scale exists here, and motion.test.ts owns its values', () => {
  const durations = [...rootBlock.matchAll(/--dur-([a-z]+)\s*:\s*(\d+m?s);/g)].map(([, name]) => name);

  it('declares the three scale durations plus the two pinned signature ones', () => {
    expect(durations.sort()).toEqual(['confetti', 'quick', 'scene', 'stagger', 'stamp']);
  });

  it('retires the old per-animation duration tokens', () => {
    // --dur-tick/--dur-fade were one token per effect, which is exactly what
    // a shared scale replaces; leaving them declared would let a component
    // keep reaching for a timing nothing documents any more.
    expect(prop(rootBlock, 'dur-tick')).toBeUndefined();
    expect(prop(rootBlock, 'dur-fade')).toBeUndefined();
  });

  it('ships a prefers-reduced-motion override at all', () => {
    expect(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.exec(css)).not.toBeNull();
  });
});

/* ============================================================ R6 focus */

/**
 * R6.1 forbids suppressing the focus ring, in every spelling: `outline: none`,
 * `outline: 0`, `outline-style: none`, and the JSX camelCase equivalents inside
 * a style object. `outline-offset` and `outline: var(--focus-ring)` must survive.
 */
const FOCUS_SUPPRESSION_RE = /\boutline(?:-?(?:width|style))?\s*:\s*['"]?\s*(?:none|0)/gi;

describe('R6 focus is a token, not a per-component decision', () => {
  it('declares a 2px --ink ring with a 2px offset', () => {
    expect(prop(rootBlock, 'focus-ring')).toBe('2px solid var(--ink)');
    expect(prop(rootBlock, 'focus-offset')).toBe('2px');
  });

  it('never overrides the ring in the dark theme — --ink already flips', () => {
    expect(prop(darkBlock, 'focus-ring')).toBeUndefined();
  });

  it('finds no focus suppression anywhere under src/ui', () => {
    expect(offenders(FOCUS_SUPPRESSION_RE)).toEqual([]);
  });

  it('still recognises focus suppression when it is introduced', () => {
    // Guards the guard: this scan is R6.1's only usage-side enforcement.
    const bad = `a { outline: none } b { outline:0 } c { outline-style: none }
      <i style={{ outline: 'none', outlineWidth: 0, outlineStyle: "none" }} />`;
    expect(bad.match(FOCUS_SUPPRESSION_RE)).toHaveLength(6);
    const good = `outline: var(--focus-ring); outline-offset: var(--focus-offset); outline: 2px solid;`;
    expect(good.match(FOCUS_SUPPRESSION_RE)).toBeNull();
  });
});

/* ================================================== build integrity: @vite-ignore */

/**
 * T29 FIX ROUND — a mechanical ban on the pragma that shipped the one blocker
 * this whole visual pass found, placed here because this file already owns the
 * project's grep-over-source scans.
 *
 * THE INCIDENT. `src/ui/screens/Published.tsx` reached the screen registry
 * through a dynamic import whose specifier was held in a `const` and waved
 * past Vite's analyzer with the ignore pragma — written when
 * `src/ui/screens/registry.ts` genuinely did not exist yet in that worktree,
 * and correct at the time. It became wrong the moment the merge made the
 * module real: an unanalyzable specifier is never rewritten to the built
 * chunk's content-hashed URL, so in a PRODUCTION build the request resolved
 * to `/assets/registry`, 404'd, hit the loader's `catch`, and returned null.
 * "Face the truth" opened an empty overlay and the entire Act I -> Act II
 * hand-off was dead in the shipped artifact.
 *
 * WHY A TEST AND NOT A REVIEW NOTE. The failure is invisible to this suite by
 * construction: jsdom tests inject their own loader, `tsc` is happy (the
 * specifier is a string), `eslint` is happy, and `npm run build` only prints a
 * warning. Nothing except loading the real built app in a real browser caught
 * it. So the pragma itself is what gets banned.
 *
 * SCOPE. Code under `src/**` only. `src/ui/screens/registry.t15.patch.md` is a
 * hand-off document that must be able to NAME the pragma in order to warn
 * about it, so documentation extensions are deliberately out of scope.
 */
const SRC_DIR = join(ROOT, 'src');
const VITE_IGNORE = '@vite-ignore';

describe('build integrity — no @vite-ignore anywhere in src/**', () => {
  const srcCodeFiles = walk(SRC_DIR).filter((f) => /\.(tsx?|jsx?|css)$/.test(f));

  it('scans a non-trivial number of source files (the walk itself must not silently break)', () => {
    expect(srcCodeFiles.length).toBeGreaterThan(20);
  });

  it('finds the pragma in no source file — an unanalyzable dynamic import 404s in a production build', () => {
    const offending = srcCodeFiles
      .filter((file) => readFileSync(file, 'utf8').includes(VITE_IGNORE))
      .map((file) => relative(ROOT, file));
    expect(offending).toEqual([]);
  });

  it('still catches the pattern when one is introduced', () => {
    const bad = `const spec = './registry';\nconst mod = await import(/* ${VITE_IGNORE} */ spec);`;
    expect(bad.includes(VITE_IGNORE)).toBe(true);
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
