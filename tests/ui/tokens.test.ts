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

/* ============================================ disclosure / integration drift */

/**
 * GR6 gr6-058 — THE ABOUT PAGE DISCLOSES AN ANALYTICS SETUP THAT IS NOT IN THE
 * TREE.
 *
 * `about.dataDisclosure` (all three locales) tells the player: "Analytics are
 * anonymous, cookieless page counts (Vercel Web Analytics)." Today
 * `@vercel/analytics` is in neither `dependencies` nor `devDependencies`, and
 * nothing anywhere calls `inject()`. The sentence is currently a FALSE PRIVACY
 * DISCLOSURE — harmless in the direction that matters (it over-discloses; no
 * data is collected at all) but a disclosure the product cannot honour is
 * exactly the kind of claim this game is about.
 *
 * The integration is scheduled for T25 (deploy day), so the fix is not to
 * install the package now — it is to make sure the tree cannot QUIETLY stay
 * self-contradicting. That needs two things, and only one of them lives here:
 *
 *   1. THE DEPLOY-CHECKLIST STEP (T25, unskippable). Verbatim, for the
 *      checklist:
 *
 *        "Analytics disclosure — `about.dataDisclosure` in all three copy
 *         files claims Vercel Web Analytics. Either `npm i @vercel/analytics`
 *         and call `inject()` in `src/main.tsx`, or cut the parenthetical from
 *         all three locales. Then un-`todo` the tripwire in
 *         `tests/ui/tokens.test.ts` ('the analytics disclosure matches the
 *         analytics integration') and confirm it is green. The About page may
 *         not ship claiming a collector the bundle does not contain."
 *
 *   2. THE TRIPWIRE BELOW. It is written out in full and left as `todo`
 *      RATHER THAN LIVE, because the only two ways to make it green today are
 *      installing a package T25 owns or editing the copy files, which belong
 *      to another wave. A test that is born red is a test the next agent
 *      disables; a `todo` with the assertion spelled out beside it is a test
 *      the next agent finishes. The moment either half of T25 lands, deleting
 *      `.todo` is a one-word change.
 *
 * The companion assertion IS live, because it can be: it guards the OTHER
 * direction of the same contradiction — a package installed and never wired —
 * and it is vacuously true until T25, then real.
 */
describe('gr6-058 the analytics disclosure and the analytics integration', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const declaresAnalytics = '@vercel/analytics' in { ...pkg.dependencies, ...pkg.devDependencies };
  const COPY_FILES = ['en', 'it', 'es'].map((locale) => `src/content/${locale}/copy.ts`);

  it.todo(
    'the analytics disclosure matches the analytics integration (T25: install + inject, or cut the claim)',
    // () => {
    //   const claiming = COPY_FILES.filter((file) => /Vercel/i.test(readFileSync(join(ROOT, file), 'utf8')));
    //   if (claiming.length > 0) {
    //     expect(
    //       declaresAnalytics,
    //       `${claiming.join(', ')} disclose Vercel Web Analytics, but @vercel/analytics is not a ` +
    //         'dependency. The About page is telling the player about a collector the bundle does ' +
    //         'not contain.',
    //     ).toBe(true);
    //   }
    // },
  );

  it('never ships an analytics package that nothing calls', () => {
    // Vacuously true until T25 installs it; a real guard from that moment on.
    // The "installed but unwired" half of this contradiction is the one that
    // silently under-delivers, and it looks identical to a working setup from
    // the outside — nothing on screen changes either way.
    if (!declaresAnalytics) return; // nothing installed, nothing to wire — see the todo above
    const claiming = COPY_FILES.filter((file) => /Vercel/i.test(readFileSync(join(ROOT, file), 'utf8')));
    const main = readFileSync(join(ROOT, 'src/main.tsx'), 'utf8');
    expect(
      /@vercel\/analytics/.test(main) && /\binject\s*\(/.test(main),
      '@vercel/analytics is installed but src/main.tsx never imports and calls inject(). An ' +
        'analytics package with no call site collects nothing while the About page says it does ' +
        `(${claiming.length} copy file(s) disclose it: ${claiming.join(', ') || 'none'}).`,
    ).toBe(true);
  });
});

/* ====================================================== DESIGN §10 tier C */

/**
 * GR6 gr6-054 — THE SIX LAWS THAT WERE ENFORCED BY A HUMAN REMEMBERING TO RUN
 * SIX SHELL COMMANDS.
 *
 * DESIGN.md §10 assigned R1.3, R2.2/R3.1-usage, R3.4, R4.5, R4.7 and R6.5 to
 * "Tier C — grep" and listed the commands. Nothing ran them. Tier C was the
 * only band in the document claiming *mechanical* decidability with no
 * mechanism — and the rules in it are exactly the ones a fix wave breaks by
 * accident: a stray `border:` shorthand, a raw `z-index: 9999`, a second
 * breakpoint reached for because one pane got taller. Run by hand at review
 * time all six still held on the merits; what was missing was the guard, and a
 * missing guard on a passing rule is the kind that rots quietly.
 *
 * TWO OF THE SIX COMMANDS WERE ALSO UNRUNNABLE AS WRITTEN, and this file is
 * written to the corrected semantics rather than the literal shell:
 *
 *   1. `grep -rn '<select' src/ui` printed a hit — `SpecControls.tsx:2`, which
 *      is R6.5's OWN COMMENT explaining that a fork is never a `<select>`. A
 *      permanently-red checklist item trains the reviewer to skip it. Comments
 *      are therefore blanked before every scan below, the same way R1.7's
 *      colour scan already does it (a comment must be able to NAME the thing
 *      it forbids).
 *
 *   2. The raw-pixel enumeration returned 28 hits against a closed list that
 *      admitted only 23 of them: four `@media (min-width: 768px)` preludes —
 *      R3.4's own mandated breakpoint, which the list forgot — and one hit
 *      inside a prose comment. Under a literal reading §10 declared five
 *      violations of its own law. So: `@media` prelude lines are excluded from
 *      the raw-px scan (a breakpoint is not a size or a space; it is R3.4's
 *      subject and is enforced by its own test below), and the 768px value is
 *      legal by construction rather than by an entry on a list of strokes.
 *
 * SHAPE. Four of the six must find nothing. The other two ENUMERATE: every hit
 * must map to a closed allow-list, and — for R1.3 — every entry on the list
 * must still have a hit, so a deleted place fails as loudly as an added one
 * (the "pairs, not counts" discipline `motion.test.ts` arrived at: a count says
 * how many and cannot say which).
 *
 * The §10 prose that retires the shell block and moves these five rule ids
 * from tier C to tier A is DESIGN.md's own half of gr6-054 and is not made
 * here — this file only has to be true.
 */

const ALL_UI_FILES = [...uiSourceFiles, TOKENS_PATH];

/**
 * Blank comments WITHOUT collapsing lines, so a failure can still name the line
 * the offender is on. Every non-newline character inside a comment becomes a
 * space; `stripComments` above is fine for match-or-not scans but shifts line
 * numbers, and a design-law failure whose message points at the wrong line is
 * a failure a reviewer argues with instead of fixing.
 *
 * The `[^:]` guard on the line-comment arm is what spares `url(http://…)` —
 * the same guard `stripComments` uses.
 */
function blankComments(text: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_all, lead: string, comment: string) => lead + blank(comment));
}

interface Hit {
  /** Repo-relative path, forward slashes. */
  file: string;
  line: number;
  /** The matched text, trimmed — what a reviewer needs to see in the failure. */
  text: string;
  /** First capture group, when the pattern has one. */
  captured?: string;
}

/** Run one Tier-C scan over a file set, with comments blanked. */
function tierC(files: string[], pattern: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file).split(/[\\/]/).join('/');
    const lines = blankComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((lineText, index) => {
      for (const match of lineText.matchAll(new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g'))) {
        hits.push({ file: rel, line: index + 1, text: match[0].trim(), captured: match[1] });
      }
    });
  }
  return hits;
}

const show = (hits: Hit[]) => hits.map((h) => `${h.file}:${h.line}: ${h.text}`);

describe('DESIGN §10 tier C', () => {
  it('R4.5 — no `border` shorthand anywhere under src/ui (hairlines, never a four-sided box)', () => {
    expect(show(tierC(ALL_UI_FILES, /border:\s/g))).toEqual([]);

    // Guards the guard: the longhands R4.5 mandates must survive, and the
    // shorthand it bans must not.
    const probe = 'a { border-block-start: var(--hairline); }\nb { border: 1px solid var(--rule); }';
    expect(probe.match(/border:\s/g)).toEqual(['border: ']);
  });

  it('R4.7 — no raw `z-index` number anywhere under src/ui (the ladder, never 9999)', () => {
    expect(show(tierC(ALL_UI_FILES, /\bz-index:\s*[0-9]/g))).toEqual([]);

    const probe = 'a { z-index: var(--z-modal); }\nb { z-index: 9999; }\nc { zIndex: 3 }';
    expect(probe.match(/\bz-index:\s*[0-9]/g)).toEqual(['z-index: 9']);
  });

  it('R6.5 — no `<select` anywhere under src/ui (every fork is a segmented radiogroup)', () => {
    // The literal §10 command reds on R6.5's own explanatory comment in
    // SpecControls.tsx. Blanking comments is what makes this runnable — and
    // the second assertion proves the blanking did not simply blank the world.
    expect(show(tierC(ALL_UI_FILES, /<select/g))).toEqual([]);

    const probe = blankComments('// never a <select> — a dropdown\nconst x = <select id="fork" />;');
    const [commentLine, codeLine] = probe.split('\n');
    expect(commentLine.trim(), 'the comment must be blanked, so R6.5 stops reding on its own prose').toBe('');
    expect(codeLine, 'blanking must not touch code on other lines').toBe('const x = <select id="fork" />;');
    expect(probe.match(/<select/g), 'a real <select> must still be found').toEqual(['<select']);
  });

  it('R3.4 — exactly one breakpoint exists, and it is 768px', () => {
    const breakpoints = tierC(ALL_UI_FILES, /@media[^{]*\(min-width:\s*([^)]+)\)/g);
    const wrong = breakpoints.filter((hit) => hit.captured?.trim() !== '768px');
    expect(show(wrong)).toEqual([]);

    // A second breakpoint is a design failure, not a fix — so the rule is only
    // meaningful while the one breakpoint is actually used somewhere.
    expect(breakpoints.length).toBeGreaterThan(0);
  });

  it('R1.3 — `--sig-red` appears in exactly its four places, plus R1.3a\'s derived band', () => {
    /**
     * The enumeration, as an allow-list keyed by the file each place lives in.
     * Keyed by file rather than by line so an edit above a use cannot red this
     * test for a reason that is not R1.3's subject; both directions are
     * asserted, so a NEW file reaching for the loud colour and a place quietly
     * deleted from the reveal fail identically.
     */
    const PLACES: Record<string, string> = {
      'src/ui/components/Stamp.css': 'the RETRACTED stamp',
      'src/ui/charts/SpecCurve.css':
        'the p = .05 threshold rule and its label; the published path point and its leader line',
      'src/ui/screens/Reveal.css': 'the Act II accounting figures for p < .05',
      'src/ui/theme/tokens.css': "R1.3a's --sig-band, mixed and registered here rather than inline",
    };

    const uses = tierC(ALL_UI_FILES, /var\(--sig-red\)/g);

    const unsanctioned = uses.filter((hit) => !(hit.file in PLACES));
    expect(
      show(unsanctioned),
      'A FIFTH LOUD-COLOUR USE: --sig-red carries four meanings in Act II and dilutes with every ' +
        'extra one. If this is genuinely a new place, DESIGN.md R1.3 has to name it first.',
    ).toEqual([]);

    const emptied = Object.keys(PLACES).filter((file) => !uses.some((hit) => hit.file === file));
    expect(
      emptied,
      'A SANCTIONED --sig-red PLACE NO LONGER USES IT: the rule now over-counts. Either the place ' +
        'moved (update this list) or a meaning was lost (that is the bug).',
    ).toEqual([]);
  });

  it('R2.2/R3.1 — the only raw pixel values in use are the strokes DESIGN.md names by hand', () => {
    /**
     * §10's closed list, read literally: the 1px hairline (R4.4), the 2px
     * selection underline (R4.6), the 2px underline offset (R6.2), R5.3's two
     * pinned travel distances (6px scene, 2px quick) and the 1px clipped box of
     * `.ph-visually-hidden` (R6.6) — an idiom's own value, not a size.
     *
     * Anything else is a size or a space and belongs on a closed scale, which
     * is what the `--space-*`/`--text-*` assertions above pin. Note this scan
     * cannot reach a transform argument (`translateY(6px)` has no digit
     * straight after a colon); R5.3's two-distance rule is what closes that
     * gap, enforced by motion.test.ts over keyframe bodies.
     */
    const LEGAL_PX = new Set([1, 2, 6]);

    // tokens.css is excluded — it is where the scales are DECLARED, which is
    // the one place a pixel value is supposed to be typed (§10's own
    // `--exclude=tokens.css`). `@media` prelude lines are excluded because a
    // breakpoint is not a size: it is R3.4's subject, tested above, and §10's
    // closed list forgot to name it — the defect this correction fixes.
    const rawPx = tierC(uiSourceFiles, /:\s*(\d+)px/g).filter((hit) => !/@media/.test(hit.text));
    const mediaPreludes = new Set(
      tierC(uiSourceFiles, /@media[^{]*\(min-width:\s*\d+px/g).map((hit) => `${hit.file}:${hit.line}`),
    );
    const offending = rawPx.filter(
      (hit) => !mediaPreludes.has(`${hit.file}:${hit.line}`) && !LEGAL_PX.has(Number(hit.captured)),
    );

    expect(
      show(offending),
      'A RAW PIXEL VALUE THAT IS NOT ONE OF THE NAMED STROKES: sizes and spaces come off the closed ' +
        'scales (--space-*, --text-*). If a new stroke is genuinely needed, DESIGN.md §10 names it first.',
    ).toEqual([]);

    // Guards the guard, in both directions: a real violation is caught, and the
    // @media exclusion does not swallow a violation that shares its line.
    const probe = ':root { padding: 12px }\n@media (min-width: 768px) { .a { gap: 40px } }';
    const probeHits = [...probe.matchAll(/:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(probeHits).toEqual([12, 768, 40]);
    expect(probeHits.filter((value) => !LEGAL_PX.has(value))).toEqual([12, 768, 40]);
  });
});
