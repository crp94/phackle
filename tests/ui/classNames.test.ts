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

export function unmatchedClasses(
  sources: { file: string; code: string }[],
  css: string[]
): string[] {
  const declared = declaredClasses(css);
  return [...writtenClasses(sources)]
    .filter(([name]) => !declared.has(name))
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

  it('strips comments, so a class NAMED in a comment does not vouch for one in the DOM', () => {
    const probe = [{ file: join(UI_DIR, 'probe.tsx'), code: '<p className="ph-orphan" />' }];
    expect(unmatchedClasses(probe, ['/* .ph-orphan used to live here */\n.ph-other { margin: 0; }'])).toEqual([
      'src/ui/probe.tsx: ph-orphan has no CSS rule',
    ]);
  });
});
