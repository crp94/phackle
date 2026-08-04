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
 *   R5.2  DESIGN.md's (file, motion-identity) pairs equal the stylesheets'
 *         own, and every @keyframes defined is fired and every @keyframes
 *         fired is defined (the Stamp.css/Reveal.css split makes that live).
 *         Site 1 additionally has its TRIGGER pinned: <main>'s key is what
 *         replays the entrance, and no CSS check can see a deleted key.
 *   R5.3  only transform/opacity animate — plus `color`, in PValueDial.css and
 *         nowhere else — and keyframe travel is 6px or 2px, nothing else.
 *   R5.6  every duration token an animation actually uses collapses under
 *         prefers-reduced-motion, which is what makes parity a property of the
 *         scale rather than a per-file promise; and nothing is visible only
 *         because an animation ran.
 *   R5.7  an entrance is gated on the VIEWPORT (never on mount — fix round 1),
 *         and its delay is calc(index * --dur-stagger) with the index capped.
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
 * Every motion declaration in a file. The `-` in `animation-delay` is why the
 * shorthand pattern cannot accidentally swallow a longhand, so the two are
 * matched separately and then used for different checks.
 *
 * FIX ROUND 1 (M2): the longhand set used to be `-duration`/`-delay` only,
 * which left `transition-timing-function: cubic-bezier(…)` and the
 * `transition-property`/`animation-name` spelling of a whole site entirely
 * unscanned — a site written in longhand would have been invisible to every
 * check below. All five longhands are now covered, and the property-bearing
 * ones feed the register and the compositor-property checks too.
 */
const SHORTHAND_RE = /\b(?:transition|animation)\s*:\s*([^;{}]+)/g;
/** Longhands that carry a TIME (and so must be tokenised). */
const LONGHAND_TIME_RE = /\b(?:transition|animation)-(?:duration|delay|timing-function)\s*:\s*([^;{}]+)/g;
/** Longhands that declare WHAT moves (and so must be registered). */
const LONGHAND_PROP_RE = /\b(transition-property|animation-name)\s*:\s*([^;{}]+)/g;
/** The JSX-style-object spellings of all of the above. */
const JSX_TIMING_RE =
  /\b(?:transition|animation)(?:Duration|Delay|TimingFunction|Property|Name)?\s*:\s*(['"][^'"]*['"])/g;

const shorthandDecls = (code: string): string[] => [...code.matchAll(SHORTHAND_RE)].map((m) => m[1].trim());
const longhandProps = (code: string): { kind: string; value: string }[] =>
  [...code.matchAll(LONGHAND_PROP_RE)].map((m) => ({ kind: m[1], value: m[2].trim() }));
const timingValues = (code: string): string[] => [
  ...shorthandDecls(code),
  ...[...code.matchAll(LONGHAND_TIME_RE)].map((m) => m[1].trim()),
  ...[...code.matchAll(LONGHAND_PROP_RE)].map((m) => m[2].trim()),
  ...[...code.matchAll(JSX_TIMING_RE)].map((m) => m[1].trim()),
];

/** CSS-wide keywords a property list may legally contain but which name nothing. */
const NOT_A_PROPERTY = /^(?:none|initial|inherit|unset|revert|revert-layer)$/;

/**
 * A site's IDENTITY: what it is, not how many of it there are. An
 * `animation` (shorthand or `animation-name`) is identified by its keyframe
 * name; a `transition` (shorthand or `transition-property`) by
 * `transition:` plus its sorted property list.
 */
function identities(code: string): string[] {
  const out: string[] = [];
  for (const [, keyword, value] of code.matchAll(/\b(transition|animation)\s*:\s*([^;{}]+)/g)) {
    out.push(keyword === 'animation' ? animationIdentity(value) : transitionIdentity(value));
  }
  for (const { kind, value } of longhandProps(code)) {
    out.push(kind === 'animation-name' ? value.trim() : transitionIdentity(value));
  }
  return out.filter((id) => id !== '');
}

/** The keyframe name out of an `animation:` shorthand (any token order). */
function animationIdentity(value: string): string {
  const name = value
    .split(/\s+/)
    .map((token) => token.trim())
    .find(
      (token) =>
        /^[a-zA-Z_-][\w-]*$/.test(token) &&
        !/^(?:both|backwards|forwards|none|infinite|alternate|reverse|normal|paused|running|linear|ease|ease-in|ease-out|ease-in-out)$/.test(
          token
        )
    );
  return name ?? '';
}

/** `transition:` plus the property list, sorted so order can never matter. */
function transitionIdentity(value: string): string {
  const properties = value
    .split(',')
    .map((leg) => leg.trim().split(/\s+/)[0])
    .filter((property) => property && !NOT_A_PROPERTY.test(property) && !/^var\(/.test(property));
  return properties.length === 0 ? '' : `transition:${[...properties].sort().join('+')}`;
}

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
 * DESIGN.md R5.2's table, read back out of the document as `(file, identity)`
 * pairs — the `Motion` column names each site by its keyframe or its
 * transition property list.
 *
 * FIX ROUND 1 (M1): this used to compare per-file DECLARATION COUNTS, and
 * review's probe walked through it twice — once by adding an unregistered
 * `color` transition to a file whose count had room, once by bumping a count
 * to match an unregistered animation. A count answers "how many", which is
 * not the question; a pair answers "which".
 */
function declaredSites(): string[] {
  const section = design.slice(design.indexOf('**R5.2 —'), design.indexOf('**R5.3 —'));
  const rows = [...section.matchAll(/^\|\s*(\d+)\s*\|(.+)$/gm)];
  expect(rows.length, 'DESIGN.md R5.2 must list at least one site').toBeGreaterThan(0);
  const out: string[] = [];
  for (const [, , rest] of rows) {
    const cells = rest.split('|').map((c) => c.trim());
    const file = /`([^`]+)`/.exec(cells[1])?.[1];
    expect(file, `R5.2 row has no backticked file path: ${rest.slice(0, 60)}`).toBeDefined();
    if (!(file as string).endsWith('.css')) continue; // site 8 is canvas
    const motion = [...cells[2].matchAll(/`([^`]+)`/g)].map(([, id]) => id);
    expect(motion.length, `R5.2 row names no motion identity: ${rest.slice(0, 60)}`).toBeGreaterThan(0);
    for (const id of motion) out.push(`${file}::${id}`);
  }
  return out.sort();
}

/** The stylesheets' own answer to the same question. */
function actualSites(): string[] {
  return uiCss.flatMap(({ file, code }) => identities(code).map((id) => `${file}::${id}`)).sort();
}

describe('R5.2 — DESIGN.md\'s motion register and the stylesheets agree', () => {
  it('matches (file, motion identity) pairs in both directions', () => {
    // An unregistered animation and a registered-but-deleted one fail
    // identically, and — unlike the count this replaced — an animation
    // SWAPPED for a different one inside the same file fails too.
    expect(actualSites()).toEqual(declaredSites());
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
  const ALLOWED = new Set(['transform', 'opacity']);
  /**
   * `color` is §5's ONE registered exception (DESIGN.md R5.3) and it belongs
   * to ONE file: on the dial the colour IS the state (R1.8), which is an
   * argument about that element and nothing else.
   *
   * FIX ROUND 1 (M1): the exception used to be global, so review's probe
   * added a `color` transition to an unrelated screen and the suite stayed
   * green. An exception that applies everywhere is not an exception.
   */
  const COLOUR_EXCEPTION_FILE = 'src/ui/components/PValueDial.css';

  it('animates no property outside transform/opacity, and colour only on the dial', () => {
    const offenders: string[] = [];
    for (const { file, code } of uiCss) {
      const properties = [
        ...[...code.matchAll(/\btransition\s*:\s*([^;{}]+)/g)].map((m) => m[1]),
        ...[...code.matchAll(/\btransition-property\s*:\s*([^;{}]+)/g)].map((m) => m[1]),
      ].flatMap((value) => value.split(',').map((leg) => leg.trim().split(/\s+/)[0]));
      for (const property of properties) {
        if (!property || NOT_A_PROPERTY.test(property) || ALLOWED.has(property)) continue;
        if (property === 'color' && file === COLOUR_EXCEPTION_FILE) continue;
        offenders.push(`${file}: ${property}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('still rejects the dial\'s own exception when it appears in another file', () => {
    // Guards the guard: this is exactly the probe that beat the first cut.
    const elsewhere = { file: 'src/ui/screens/Published.css', code: '.x { transition: color var(--dur-quick) var(--ease-out); }' };
    const property = /\btransition\s*:\s*([a-z-]+)/.exec(elsewhere.code)?.[1];
    expect(property).toBe('color');
    expect(elsewhere.file === COLOUR_EXCEPTION_FILE).toBe(false);
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
    // accompanied by a MODIFIER class that restores it — a class the
    // component adds, never the animation itself. The modifier need not
    // share the base's prefix: Published's clippings are hidden by
    // `.ph-press-card, .ph-chyron` and restored by the shared
    // `.ph-clipping--in`, which is one restoring class for one group.
    const offenders: string[] = [];
    for (const { file, code } of uiCss) {
      const restorers = [...code.matchAll(/([^{}]*--[\w-]+[^{}]*)\{[^{}]*opacity\s*:\s*1\s*[;}]/g)].length;
      for (const [, selector] of code.matchAll(/([^{}]+)\{[^{}]*opacity\s*:\s*0\s*[;}]/g)) {
        const base = selector.trim();
        if (base.startsWith('@') || /\d+%|\bfrom\b|\bto\b/.test(base)) continue; // a keyframe stop, not a rule
        if (restorers === 0) offenders.push(`${file}: ${base} has no restoring modifier`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ===================================================== R5.7 staggered delays */

describe('R5.2 site 1 — the screen transition is actually triggered', () => {
  // Comments stripped first: the note above the element mentions "<main>" in
  // prose, and a scan that matches prose proves nothing about the markup.
  const appTsx = stripComments(readFileSync(join(ROOT, 'src/ui/App.tsx'), 'utf8'));

  /**
   * FIX ROUND 1 (M3). `.ph-screen`'s animation restarts only because React
   * tears <main> down and rebuilds it when the `key` changes — delete the
   * key and the CSS is still perfectly valid, the register still balances,
   * and the beat silently never happens again. Nothing else in this suite
   * can see that, because nothing else in this suite reads a key.
   */
  it('carries .ph-screen on <main> with a key over BOTH state machines', () => {
    const main = /<main\b[^>]*>/.exec(appTsx)?.[0] ?? '';
    expect(main, 'App.tsx must render a <main>').not.toBe('');
    expect(main).toContain('className="ph-screen"');
    expect(main, '<main> must be keyed, or the entrance never replays').toMatch(/\bkey=\{/);
    const key = /\bkey=\{([^}]*\}?[^}]*)\}/.exec(main)?.[1] ?? '';
    expect(key, 'the key must vary with the header nav page').toMatch(/\bpage\b/);
    expect(key, 'the key must vary with the game screen').toMatch(/[Ss]creen\b/);
  });

  it('reads the game screen for that key and nothing else', () => {
    expect(appTsx).toMatch(/const gameScreen = useGameStore\(\(s\) => s\.screen\)/);
  });
});

describe('R5.7 — an entrance is viewport-triggered, staggered and capped', () => {
  const hook = readFileSync(join(ROOT, 'src/ui/hooks/useEnterOnce.ts'), 'utf8');

  it('gates both entrance sites on the viewport, never on mount', () => {
    // FIX ROUND 1 (I1). A mount-triggered entrance plays to an empty room
    // for anything below the fold — measured on Published at 360, which is
    // what forced this. Both sites now consume the same one-way observer.
    expect(hook).toMatch(/new IntersectionObserver/);
    expect(hook).toMatch(/observer\.disconnect\(\)/);
    for (const rel of ['src/ui/screens/Reveal.tsx', 'src/ui/screens/Published.tsx']) {
      expect(readFileSync(join(ROOT, rel), 'utf8'), `${rel} must use the shared gate`).toMatch(/useEnterOnce/);
    }
  });

  it('fails OPEN, so no content is ever stranded behind the observer', () => {
    expect(hook).toMatch(/reducedMotion \|\| typeof IntersectionObserver === 'undefined'/);
  });
});

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

  it('caps the index in shared code rather than trusting DOM order', () => {
    const hook = readFileSync(join(ROOT, 'src/ui/hooks/useEnterOnce.ts'), 'utf8');
    expect(hook).toMatch(/MAX_STAGGER_STEPS\s*=\s*2/);
    expect(hook).toMatch(/Math\.min\(index,\s*MAX_STAGGER_STEPS\)/);
  });
});
