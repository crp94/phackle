// gr6-024 — EVERY `ph-` CLASS A COMPONENT WRITES HAS A RULE THAT ANSWERS IT.
//
// Ten classNames shipped in the DOM with zero matching CSS. Most were
// harmless-looking BEM bases; one was not. `ph-lab__footnote--armitage` rode
// on the second peek footnote, its own source comment said the two footnotes
// were differentiated, and they rendered identically — because the only thing
// that differed was a name nothing styled. That is the failure mode this file
// exists to make impossible: a stylesheet promise a reviewer can only check
// by grepping 24 files.
//
// Same parse-as-text style as tests/ui/tokens.test.ts and motion.test.ts —
// walk src/ui, strip comments, match, assert an empty offenders list, then
// prove the check still fires when a violation is introduced.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const UI_DIR = join(ROOT, 'src/ui');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const files = walk(UI_DIR);
const cssFiles = files.filter((f) => f.endsWith('.css'));
const codeFiles = files.filter((f) => /\.tsx?$/.test(f));

/** Every `ph-` class name any stylesheet mentions in any selector. */
export function declaredClasses(sources: string[]): Set<string> {
  const out = new Set<string>();
  for (const code of sources) {
    for (const [, name] of stripComments(code).matchAll(/\.(ph-[\w-]+)/g)) out.add(name);
  }
  return out;
}

/**
 * Every `ph-` class name a component writes onto an element, with the file
 * that writes it.
 *
 * DISCLOSED BLIND SPOT, and it is the same one copyFreeze.test.ts owns for
 * copy keys: a class assembled at runtime (`ph-dial--${band}`,
 * `MARK_CLASS[kind]`) contributes nothing here — neither a hit nor a miss.
 * Those three families are covered from the other end instead, by the
 * components' own suites asserting the rendered class (lab.test.tsx's dial
 * bands, reveal.test.tsx's stamp kinds), which is why this scan does not try
 * to be clever about template literals it cannot evaluate.
 */
export function writtenClasses(sources: { file: string; code: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const { file, code } of sources) {
    const stripped = stripComments(code);
    // Both spellings a component uses: a bare `className="a b"` and any
    // string literal inside a `className={…}` expression (the ternaries that
    // add an entered flag, and the template literals that compose one).
    const literals = [
      ...[...stripped.matchAll(/className\s*=\s*"([^"]*)"/g)].map((m) => m[1]),
      ...[...stripped.matchAll(/className=\{[^}]*\}/g)].flatMap((m) =>
        [...m[0].matchAll(/['"`]([^'"`]*)['"`]/g)].map((q) => q[1])
      ),
    ];
    for (const literal of literals) {
      for (const name of literal.split(/\s+/)) {
        if (name.startsWith('ph-') && !out.has(name)) out.set(name, relative(ROOT, file));
      }
    }
  }
  return out;
}

/** Every `className` literal, as the SET of `ph-` names written together on
 * one element. `writtenClasses` above flattens this; the exemption below needs
 * the grouping, because what it forgives is a name's relationship to a
 * SIBLING class on the same element. */
export function writtenLiterals(sources: { file: string; code: string }[]): string[][] {
  const out: string[][] = [];
  for (const { code } of sources) {
    const stripped = stripComments(code);
    const literals = [
      ...[...stripped.matchAll(/className\s*=\s*"([^"]*)"/g)].map((m) => m[1]),
      ...[...stripped.matchAll(/className=\{[^}]*\}/g)].flatMap((m) =>
        [...m[0].matchAll(/['"`]([^'"`]*)['"`]/g)].map((q) => q[1])
      ),
    ];
    for (const literal of literals) {
      const names = literal.split(/\s+/).filter((name) => name.startsWith('ph-'));
      if (names.length > 0) out.push(names);
    }
  }
  return out;
}

/**
 * gr6-050 / DESIGN.md §9.1 — THE ONE WAY A WRITTEN CLASS IS ANSWERED BY
 * SOMETHING OTHER THAN ITS OWN RULE, enumerated, name by name.
 *
 * §9.1's `.ph-page` took over the page shell. For these four screens the shell
 * was the WHOLE rule — `max-width`, `margin-inline`, `padding` and nothing
 * else — so consolidating emptied it, and the screen's own class now names the
 * screen (for the suites and the flow specs that address it) while styling
 * nothing. Every other adopter kept declarations of its own: `.ph-lab` its flex
 * column, `.ph-prereg` its stack, `.ph-briefing` its `.ph-email` scoping rule.
 *
 * THE LIST IS CLOSED AND IT IS NOT A LOOSENING. The predicate did not become
 * "a class is fine if a sibling class is declared" — that is exactly what
 * `ph-lab__footnote--armitage` would have satisfied, and the test below still
 * reds on it. A name is forgiven only if it is ON this list AND every element
 * that writes it also writes the specific utility named here AND that utility
 * is itself declared. So a screen that quietly loses `.ph-page` goes red rather
 * than silently rendering unstyled at full viewport width.
 */
const SHELL_CONSOLIDATED = new Map<string, string>([
  ['ph-about', 'ph-page'],
  ['ph-legend', 'ph-page'],
  ['ph-stats', 'ph-page'],
  ['ph-summary', 'ph-page'],
  // Added after gr6-050, and the fifth name rather than a widening: gr6-007's
  // boot-failure screen POSTDATES §9.1's enumeration and had typed the shell
  // out longhand (--page-max, margin-inline: auto, 40/24/24 — exactly
  // `.ph-page` plus `.ph-page--titled`). Adopting it emptied its rule the
  // same way the four above were emptied. The pairing is what keeps this
  // honest: it is forgiven only on elements that also write `ph-page`, so a
  // boot screen that loses the shell still goes red.
  ['ph-boot-error', 'ph-page'],
]);

export function unmatchedClasses(
  sources: { file: string; code: string }[],
  css: string[]
): string[] {
  const declared = declaredClasses(css);
  const literals = writtenLiterals(sources);
  const answered = (name: string): boolean => {
    if (declared.has(name)) return true;
    const utility = SHELL_CONSOLIDATED.get(name);
    if (utility === undefined || !declared.has(utility)) return false;
    return literals.every((names) => !names.includes(name) || names.includes(utility));
  };
  return [...writtenClasses(sources)]
    .filter(([name]) => !answered(name))
    .map(([name, file]) => `${file}: ${name} has no CSS rule`)
    .sort();
}

const uiCode = codeFiles.map((file) => ({ file, code: readFileSync(file, 'utf8') }));
const uiCss = cssFiles.map((file) => readFileSync(file, 'utf8'));

describe('gr6-024 — no className ships without a rule', () => {
  it('finds no ph- class written by a component that no stylesheet mentions', () => {
    expect(unmatchedClasses(uiCode, uiCss)).toEqual([]);
  });

  it('is not vacuous: it sees the classes that ARE matched', () => {
    // A floor, not an exact count — this must not become a number to update.
    expect(writtenClasses(uiCode).size).toBeGreaterThan(50);
    expect(declaredClasses(uiCss).size).toBeGreaterThan(50);
  });

  it('still catches an unstyled class when one is introduced (mutation)', () => {
    const probe = [{ file: join(UI_DIR, 'probe.tsx'), code: '<p className="ph-real ph-orphan" />' }];
    expect(unmatchedClasses(probe, ['.ph-real { margin: 0; }'])).toEqual([
      'src/ui/probe.tsx: ph-orphan has no CSS rule',
    ]);
  });

  it('reads a modifier as its own name, which is how the Armitage footnote hid', () => {
    // `.ph-lab__footnote` existing did NOT vouch for `--armitage`: the
    // modifier is a separate selector and a separate promise.
    const probe = [
      { file: join(UI_DIR, 'probe.tsx'), code: '<p className="ph-lab__footnote ph-lab__footnote--armitage" />' },
    ];
    expect(unmatchedClasses(probe, ['.ph-lab__footnote { margin: 0; }'])).toEqual([
      'src/ui/probe.tsx: ph-lab__footnote--armitage has no CSS rule',
    ]);
  });

  // --- §9.1's shell exemption, from both ends -------------------------------

  it('forgives a consolidated shell root only while the element also carries .ph-page', () => {
    const carried = [{ file: join(UI_DIR, 'probe.tsx'), code: '<section className="ph-page ph-stats" />' }];
    expect(unmatchedClasses(carried, ['.ph-page { padding: 0; }'])).toEqual([]);

    // The same name, written WITHOUT the utility that took its declarations:
    // a screen that loses the shell renders unstyled at full viewport width,
    // and that is a defect, not a consolidation.
    const bare = [{ file: join(UI_DIR, 'probe.tsx'), code: '<section className="ph-stats" />' }];
    expect(unmatchedClasses(bare, ['.ph-page { padding: 0; }'])).toEqual([
      'src/ui/probe.tsx: ph-stats has no CSS rule',
    ]);
  });

  it('does not forgive a sibling class in general — the list is four names, not a pattern', () => {
    // `.ph-lab__footnote--armitage` beside a declared `.ph-lab__footnote` is
    // the ORIGINAL defect. If the exemption had been "a declared sibling
    // vouches", this would pass. It does not.
    const probe = [
      { file: join(UI_DIR, 'probe.tsx'), code: '<p className="ph-page ph-lab__footnote--armitage" />' },
    ];
    expect(unmatchedClasses(probe, ['.ph-page { padding: 0; }'])).toEqual([
      'src/ui/probe.tsx: ph-lab__footnote--armitage has no CSS rule',
    ]);
  });

  it('strips comments, so a class NAMED in a comment does not vouch for one in the DOM', () => {
    const probe = [{ file: join(UI_DIR, 'probe.tsx'), code: '<p className="ph-orphan" />' }];
    expect(unmatchedClasses(probe, ['/* .ph-orphan used to live here */\n.ph-other { margin: 0; }'])).toEqual([
      'src/ui/probe.tsx: ph-orphan has no CSS rule',
    ]);
  });
});

/* ==========================================================================
   w7-r-004 — THE TRIPWIRE THE ONE CATCH DESERVED.

   gr6-050's utility pass found exactly one real defect by eye: the press-card
   and chyron watermarks were composing `.ph-label` and ALSO re-declaring
   `text-transform: uppercase` themselves. It was fixed and verified live —
   and the review then showed that removing `ph-label` from those elements
   entirely, or stripping `ph-focusable ph-label` from all three
   `.ph-briefing__cta` buttons (R6.1's focus ring and R2.7's casing off the
   product's primary CTAs), left the whole suite green.

   THE GAP IS PRE-EXISTING AND NOT gr6-050's DOING — a fair control on
   build/v1 loses the same classes and also passes — because R6.1 and R2.7 are
   compiled as VALUE laws (is the ring's value right, is the pair always
   together) and never as COVERAGE laws (does this element have one at all).
   `tokens.test.ts` does not mention either utility name. So no fix is owed
   here, and this is deliberately not an attempt to close the general gap:
   a corpus-wide "every button carries .ph-focusable" rule would need an
   enumeration of every exception, which is a design decision this wave does
   not own.

   What it does is leave a tripwire under the specific elements the pass
   actually touched and reasoned about, so the catch cannot silently regress.
   ========================================================================== */

/** Every className literal written on an element that also carries `name`. */
function literalsCarrying(sources: { file: string; code: string }[], name: string): string[][] {
  return writtenLiterals(sources).filter((names) => names.includes(name));
}

describe('w7-r-004 — the elements gr6-050 reasoned about keep their utilities', () => {
  it('finds the elements at all (sanity: these selectors still exist)', () => {
    expect(literalsCarrying(uiCode, 'ph-briefing__cta').length).toBe(3);
    expect(literalsCarrying(uiCode, 'ph-press-card__watermark').length).toBe(1);
    expect(literalsCarrying(uiCode, 'ph-chyron__watermark').length).toBe(1);
  });

  it('keeps R6.1\'s ring and R2.7\'s casing on all three Briefing CTAs', () => {
    // The Briefing's CTA is the product's primary action and the first thing
    // a keyboard player reaches for. Losing `.ph-focusable` there is an
    // invisible-focus bug on the one control the whole screen exists for.
    for (const names of literalsCarrying(uiCode, 'ph-briefing__cta')) {
      expect(names, `a .ph-briefing__cta lost a utility: ${names.join(' ')}`).toContain('ph-focusable');
      expect(names, `a .ph-briefing__cta lost a utility: ${names.join(' ')}`).toContain('ph-label');
    }
  });

  it('keeps R2.7\'s casing on both SIMULATED PRESS watermarks, and declares it in ONE place', () => {
    // The catch itself, from both ends: the utility is composed, and neither
    // watermark re-declares what it carries. A rule that re-states its
    // utility's own declaration is how the 22 spellings §9.1 removed got
    // there in the first place.
    for (const names of [
      ...literalsCarrying(uiCode, 'ph-press-card__watermark'),
      ...literalsCarrying(uiCode, 'ph-chyron__watermark'),
    ]) {
      expect(names, `a watermark lost .ph-label: ${names.join(' ')}`).toContain('ph-label');
    }
    const css = uiCss.join('\n');
    for (const selector of ['.ph-press-card__watermark', '.ph-chyron__watermark']) {
      const body = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
      expect(body, `${selector} re-declares what .ph-label already carries`).not.toMatch(/text-transform/);
      expect(body, `${selector} re-declares what .ph-label already carries`).not.toMatch(/letter-spacing/);
    }
  });
});
