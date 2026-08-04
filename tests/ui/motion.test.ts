import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The mechanical half of docs/DESIGN.md §5 — the MOTION SYSTEM (T35).
 *
 * §5 used to be a budget of four animations, held down by refusing to add a
 * fifth, and enforced by a grep a human had to run and then reconcile by eye
 * ("every hit of `grep -rnE '\b(transition|animation):' src/ui` is one of the
 * four"). T35 replaced the budget with a system — a shared duration scale, one
 * easing, and an exhaustive register of SITES — which only stays a system if
 * the register cannot drift from the stylesheets. So the reconciliation the
 * old grep asked a reviewer to do by hand is done here instead, in both
 * directions: an animation that is not in DESIGN.md's table fails, and a table
 * row with no animation behind it fails just as hard.
 *
 * Five checks, mapping 1:1 onto the rules (see DESIGN.md §10's "Tier A scope,
 * §5's half"):
 *
 *   R5.1  every timing value in src/ui comes from a token — no raw ms/s, no
 *         cubic-bezier(), no bare `ease`/`linear`/`steps()`. This is the load-
 *         bearing one: a hard-coded duration is the single thing the
 *         reduced-motion block below CANNOT reach.
 *   R5.2  DESIGN.md's per-file `Decls` counts equal the stylesheets' own, and
 *         every @keyframes defined is fired and every @keyframes fired is
 *         defined (the Stamp.css/Reveal.css split makes that a live concern).
 *   R5.3  only transform/opacity animate — plus `color`, §5's ONE registered
 *         exception, on the dial — and keyframe travel is 6px or 2px, nothing
 *         else.
 *   R5.6  every duration token an animation actually uses collapses under
 *         prefers-reduced-motion, which is what makes parity a property of the
 *         scale rather than a per-file promise.
 *   R5.7  a staggered delay is calc(index * --dur-stagger), never a literal.
 *
 * Rule ids in the test names refer to docs/DESIGN.md.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOKENS_REL = 'src/ui/theme/tokens.css';
const TOKENS_PATH = join(ROOT, TOKENS_REL);
const DESIGN_PATH = join(ROOT, 'docs/DESIGN.md');
const UI_DIR = join(ROOT, 'src/ui');

const tokensCss = readFileSync(TOKENS_PATH, 'utf8');
const design = readFileSync(DESIGN_PATH, 'utf8');

/* ------------------------------------------------------------------ helpers */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Comments discuss durations and easings legitimately; code may not. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const uiFiles = walk(UI_DIR).filter((f) => /\.(tsx?|css)$/.test(f) && relative(ROOT, f) !== TOKENS_REL);

const uiCode = uiFiles.map((file) => ({
  file: relative(ROOT, file),
  code: stripComments(readFileSync(file, 'utf8')),
}));

const uiCss = uiCode.filter(({ file }) => file.endsWith('.css'));

/**
 * Every timing declaration in a file: the `transition`/`animation` shorthands
 * plus the longhands that carry a time. Deliberately NOT `animation-name` or
 * `transition-property` (no time in them), and the `-` in `animation-delay`
 * is why the shorthand pattern below cannot accidentally swallow a longhand.
 */
const SHORTHAND_RE = /\b(?:transition|animation)\s*:\s*([^;{}]+)/g;
const LONGHAND_RE = /\b(?:transition|animation)-(?:duration|delay)\s*:\s*([^;{}]+)/g;
/** The JSX-style-object spellings of the same thing. */
const JSX_TIMING_RE = /\b(?:transition|animation)(?:Duration|Delay)?\s*:\s*(['"][^'"]*['"])/g;

const shorthandDecls = (code: string): string[] => [...code.matchAll(SHORTHAND_RE)].map((m) => m[1].trim());
const timingValues = (code: string): string[] => [
  ...shorthandDecls(code),
  ...[...code.matchAll(LONGHAND_RE)].map((m) => m[1].trim()),
  ...[...code.matchAll(JSX_TIMING_RE)].map((m) => m[1].trim()),
];

/* ================================================= R5.1 the scale is closed */

const rootBlock = (() => {
  const start = tokensCss.indexOf('{', tokensCss.search(/^:root\s*\{/m));
  return tokensCss.slice(start + 1, tokensCss.indexOf('}', start));
})();

const reducedBlock = (() => {
  const at = tokensCss.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  return at === -1 ? '' : tokensCss.slice(at);
})();

describe('R5.1 — the motion scale is closed and lives only in tokens.css', () => {
  const durations = Object.fromEntries(
    [...rootBlock.matchAll(/--dur-([a-z]+)\s*:\s*(\d+m?s);/g)].map(([, name, value]) => [name, value])
  );
  const easings = [...rootBlock.matchAll(/--ease-([a-z]+)\s*:/g)].map(([, name]) => name);

  it('declares exactly the three scale durations and the two pinned ones', () => {
    // The scale (a duration names a CLASS OF MOMENT) plus R5.4's two
    // signature durations, each off the scale for a reason DESIGN.md names.
    expect(durations).toEqual({
      quick: '140ms',
      scene: '260ms',
      stagger: '60ms',
      stamp: '450ms',
      confetti: '3000ms',
    });
  });

  it('keeps quick inside 120-200ms and scene inside 200-350ms (master spec §7.5 bands)', () => {
    expect(Number.parseInt(durations.quick, 10)).toBeGreaterThanOrEqual(120);
    expect(Number.parseInt(durations.quick, 10)).toBeLessThanOrEqual(200);
    expect(Number.parseInt(durations.scene, 10)).toBeGreaterThanOrEqual(200);
    expect(Number.parseInt(durations.scene, 10)).toBeLessThanOrEqual(350);
  });

  it('declares one system easing plus the stamp overshoot, and nothing else', () => {
    expect(easings.sort()).toEqual(['out', 'stamp']);
  });

  it('finds no raw duration in any timing declaration under src/ui', () => {
    const offenders = uiCode.flatMap(({ file, code }) =>
      timingValues(code)
        .filter((value) => /(?<![\w-])\d+(?:\.\d+)?m?s\b/.test(value))
        .map((value) => `${file}: ${value}`)
    );
    expect(offenders).toEqual([]);
  });

  it('finds no raw easing in any timing declaration under src/ui', () => {
    // A bare keyword is as un-collapsible as a raw duration is, and it also
    // silently defeats the single-easing discipline.
    const RAW_EASE = /\b(?:cubic-bezier|steps)\s*\(|(?<![\w-])(?:ease|ease-in|ease-out|ease-in-out|linear)(?![\w-])/;
    const offenders = uiCode.flatMap(({ file, code }) =>
      timingValues(code)
        .filter((value) => RAW_EASE.test(value))
        .map((value) => `${file}: ${value}`)
    );
    expect(offenders).toEqual([]);
  });

  it('finds no `transition: all` — an unbounded property list is never tokenised', () => {
    const offenders = uiCode.flatMap(({ file, code }) =>
      shorthandDecls(code)
        .filter((value) => /(?<![\w-])all(?![\w-])/.test(value))
        .map((value) => `${file}: ${value}`)
    );
    expect(offenders).toEqual([]);
  });

  it('still recognises each violation when one is introduced', () => {
    // Guards the guards: these scans are R5.1's only usage-side enforcement.
    const bad = `.a { transition: opacity 200ms ease-in-out; }
      .b { animation: x var(--dur-scene) cubic-bezier(0.1, 0, 1, 1); }
      .c { animation-delay: 180ms; }
      .d { transition: all var(--dur-quick) var(--ease-out); }`;
    expect(timingValues(bad).filter((v) => /(?<![\w-])\d+(?:\.\d+)?m?s\b/.test(v))).toHaveLength(2);
    expect(timingValues(bad).filter((v) => /\bcubic-bezier\s*\(|(?<![\w-])ease-in-out(?![\w-])/.test(v))).toHaveLength(2);
    expect(shorthandDecls(bad).filter((v) => /(?<![\w-])all(?![\w-])/.test(v))).toHaveLength(1);
    // ...and does not fire on the legal form.
    const good = `.e { animation: ph-screen-enter var(--dur-scene) var(--ease-out); }
      .f { animation-delay: calc(var(--ph-stagger-index, 0) * var(--dur-stagger)); }`;
    expect(timingValues(good).filter((v) => /(?<![\w-])\d+(?:\.\d+)?m?s\b/.test(v))).toEqual([]);
    expect(timingValues(good).filter((v) => /\bcubic-bezier\s*\(/.test(v))).toEqual([]);
  });
});

/* ============================================ R5.2 the register is exhaustive */

/**
 * DESIGN.md R5.2's table, read back out of the document: one row per motion
 * site, carrying the file it lives in and how many `transition:`/`animation:`
 * shorthands that file declares for it. Two sites share `Reveal.css` (the
 * block entrance and the stamp's trigger), so the counts are summed per file
 * rather than compared row by row.
 */
function declaredSites(): Map<string, number> {
  const section = design.slice(design.indexOf('**R5.2 —'), design.indexOf('**R5.3 —'));
  const rows = [...section.matchAll(/^\|\s*(\d+)\s*\|(.+)$/gm)];
  expect(rows.length, 'DESIGN.md R5.2 must list at least one site').toBeGreaterThan(0);
  const out = new Map<string, number>();
  for (const [, , rest] of rows) {
    const cells = rest.split('|').map((c) => c.trim());
    const file = /`([^`]+)`/.exec(cells[1])?.[1];
    const decls = Number.parseInt(cells[2], 10);
    expect(file, `R5.2 row has no backticked file path: ${rest.slice(0, 60)}`).toBeDefined();
    expect(Number.isFinite(decls), `R5.2 row has no Decls count: ${rest.slice(0, 60)}`).toBe(true);
    if (decls > 0) out.set(file as string, (out.get(file as string) ?? 0) + decls);
  }
  return out;
}

/** The stylesheets' own count of the same thing. */
function actualSites(): Map<string, number> {
  const out = new Map<string, number>();
  for (const { file, code } of uiCss) {
    const n = shorthandDecls(code).length;
    if (n > 0) out.set(file, n);
  }
  return out;
}

describe('R5.2 — DESIGN.md\'s motion register and the stylesheets agree', () => {
  it('matches per-file declaration counts in both directions', () => {
    // An unregistered animation and a registered-but-deleted one fail
    // identically — which is the whole point of comparing maps rather than
    // asserting a total.
    expect(Object.fromEntries([...actualSites()].sort())).toEqual(
      Object.fromEntries([...declaredSites()].sort())
    );
  });

  it('registers eight sites, seven in CSS plus the canvas', () => {
    const section = design.slice(design.indexOf('**R5.2 —'), design.indexOf('**R5.3 —'));
    expect([...section.matchAll(/^\|\s*(\d+)\s*\|/gm)].map(([, n]) => Number(n))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('fires every @keyframes it defines, and defines every one it fires', () => {
    const defined = new Set(uiCss.flatMap(({ code }) => [...code.matchAll(/@keyframes\s+([\w-]+)/g)].map(([, n]) => n)));
    const fired = new Set(
      uiCss.flatMap(({ code }) =>
        [...code.matchAll(/\banimation\s*:\s*([\w-]+)/g)]
          .map(([, n]) => n)
          .filter((n) => !/^(?:none|inherit|initial|unset)$/.test(n))
      )
    );
    expect([...defined].filter((n) => !fired.has(n)), 'defined but never fired').toEqual([]);
    expect([...fired].filter((n) => !defined.has(n)), 'fired but never defined').toEqual([]);
  });

  it('keeps the stamp keyframes and the rule that fires them in the files DESIGN.md says', () => {
    // The one deliberate split (component owns WHAT, screen owns WHEN): if
    // either half moves, the reasoning in both files has gone stale.
    const stamp = uiCss.find(({ file }) => file.endsWith('components/Stamp.css'))?.code ?? '';
    const reveal = uiCss.find(({ file }) => file.endsWith('screens/Reveal.css'))?.code ?? '';
    expect(stamp).toMatch(/@keyframes\s+ph-stamp-slam/);
    expect(shorthandDecls(stamp)).toEqual([]);
    expect(reveal).toMatch(/\.ph-fade--in\s+\.ph-stamp--animate/);
  });
});

/* ================================================ R5.3 compositor properties */

describe('R5.3 — only transform and opacity animate', () => {
  // `color` on the dial is §5's ONE registered exception (DESIGN.md R5.3):
  // there, the colour IS the state (R1.8) and no layout depends on it.
  const ALLOWED = new Set(['transform', 'opacity', 'color']);

  it('animates no property outside transform/opacity (plus the dial\'s colour)', () => {
    const offenders: string[] = [];
    for (const { file, code } of uiCss) {
      for (const value of [...code.matchAll(/\btransition\s*:\s*([^;{}]+)/g)].map((m) => m[1])) {
        for (const leg of value.split(',')) {
          const property = leg.trim().split(/\s+/)[0];
          if (property && !ALLOWED.has(property)) offenders.push(`${file}: ${property}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('declares nothing but transform and opacity inside a @keyframes body', () => {
    const offenders: string[] = [];
    for (const { file, code } of uiCss) {
      for (const body of keyframeBodies(code)) {
        for (const [, property] of body.matchAll(/([a-z-]+)\s*:/g)) {
          if (property !== 'transform' && property !== 'opacity') offenders.push(`${file}: ${property}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('travels exactly 6px (a scene) or 2px (a quick beat), and nothing else', () => {
    // The raw-px grep in DESIGN.md §10 cannot see inside a transform function
    // (`translateY(6px)` has no digit straight after the colon), so this is
    // where R5.3's two pinned distances are actually held.
    const distances = new Set<number>();
    for (const { code } of uiCss) {
      for (const body of keyframeBodies(code)) {
        for (const [, value] of body.matchAll(/translate[XY]?\(\s*(-?[\d.]+)px/g)) {
          distances.add(Math.abs(Number(value)));
        }
      }
    }
    expect([...distances].sort((a, b) => a - b)).toEqual([2, 6]);
  });
});

/** Every `@keyframes … { … }` body in a stylesheet, braces balanced. */
function keyframeBodies(code: string): string[] {
  const out: string[] = [];
  const re = /@keyframes\s+[\w-]+\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') depth--;
      i++;
    }
    out.push(code.slice(start, i - 1));
  }
  return out;
}

/* ================================================ R5.6 reduced-motion parity */

describe('R5.6 — reduced motion is parity, and it reaches every site', () => {
  it('ships a prefers-reduced-motion block in tokens.css', () => {
    expect(reducedBlock).not.toBe('');
  });

  it('collapses every duration token that any animation actually uses', () => {
    // The check that makes "guarded" a property of the SCALE instead of a
    // promise each file has to keep: whatever tokens the stylesheets reach
    // for, those are the tokens that must collapse here.
    const used = new Set<string>();
    for (const { code } of uiCode) {
      for (const value of timingValues(code)) {
        for (const [, name] of value.matchAll(/var\(\s*(--dur-[a-z]+)/g)) used.add(name);
      }
    }
    expect(used.size, 'no animation reads a duration token at all — the scan is broken').toBeGreaterThan(0);
    const uncollapsed = [...used].filter((name) => !new RegExp(`${name}\\s*:\\s*[01]ms;`).test(reducedBlock));
    expect(uncollapsed).toEqual([]);
  });

  it('collapses the stagger DELAY to 0ms, not 1ms — it is multiplied by an index', () => {
    expect(reducedBlock).toMatch(/--dur-stagger\s*:\s*0ms;/);
  });

  it('drops the confetti budget to 0ms and flattens the stamp overshoot', () => {
    expect(reducedBlock).toMatch(/--dur-confetti\s*:\s*0ms;/);
    expect(reducedBlock).toMatch(/--ease-stamp\s*:\s*linear;/);
  });

  it('holds every animated element visible by something other than its animation', () => {
    // R5.6's no-content-behind-motion clause. `opacity: 0` in a base rule is
    // the one way an entrance can strand content, so each such rule must be
    // paired with a sibling class that restores it without any animation.
    const offenders: string[] = [];
    for (const { file, code } of uiCss) {
      for (const [, selector] of code.matchAll(/([^{}]+)\{[^{}]*opacity\s*:\s*0\s*[;}]/g)) {
        const base = selector.trim();
        if (base.startsWith('@') || /\d+%|\bfrom\b|\bto\b/.test(base)) continue; // a keyframe stop, not a rule
        const restores = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}--[\\w-]+[^{}]*\\{[^{}]*opacity\\s*:\\s*1`);
        if (!restores.test(code)) offenders.push(`${file}: ${base}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ===================================================== R5.7 staggered delays */

describe('R5.7 — a stagger is an indexed delay, capped by the component', () => {
  it('expresses every animation-delay as index x --dur-stagger', () => {
    const delays = uiCss.flatMap(({ file, code }) =>
      [...code.matchAll(/animation-delay\s*:\s*([^;{}]+)/g)].map(([, value]) => `${file}: ${value.trim()}`)
    );
    expect(delays.length, 'no staggered site found — R5.2 lists two').toBeGreaterThan(0);
    for (const delay of delays) {
      expect(delay).toMatch(/calc\(\s*var\(--ph-stagger-index,\s*0\)\s*\*\s*var\(--dur-stagger\)\s*\)/);
    }
  });

  it('caps the index in the component rather than trusting DOM order', () => {
    const reveal = readFileSync(join(ROOT, 'src/ui/screens/Reveal.tsx'), 'utf8');
    expect(reveal).toMatch(/MAX_STAGGER_STEPS\s*=\s*2/);
    expect(reveal).toMatch(/Math\.min\(index,\s*MAX_STAGGER_STEPS\)/);
  });
});
