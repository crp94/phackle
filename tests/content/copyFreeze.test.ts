// T17 — the COPY FREEZE that unblocks T19/T20 (the Italian/Spanish
// transcreations): from here on, `CopyKey` is a closed set that every
// locale's `copy: Record<CopyKey, string>` must translate in full, and no
// new key may be added without editing en/copy.ts (the source-of-truth
// locale) first.
//
// Two independent, repeatable checks, mirroring tests/ui/tokens.test.ts's own
// pragmatic, regex-over-source-text style (walk a directory, strip comments,
// match, assert an empty offenders list, then prove the check still catches
// a violation when one is introduced):
//
//  1. Every `t('some.key', ...)` / `copy['some.key']` usage anywhere under
//     src/ui or src/game references a key that actually exists in
//     en/copy.ts's `copy` record.
//  2. Every JSX text node and every aria-label/title/alt/placeholder literal
//     under src/ui is one of the sanctioned exceptions (the "P-hackle"
//     wordmark, an emoji/symbol-only string with no Latin letters, or a
//     bare URL) — anything else is a raw user-facing string that should
//     have gone through the copy catalog instead.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { copy } from '../../src/content/en/copy';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const UI_DIR = join(ROOT, 'src/ui');
const GAME_DIR = join(ROOT, 'src/game');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ================================================================
   1. CopyKey audit — every t()/copy[] usage site references a real key
   ================================================================ */

// `t('some.key', ...)` — the useLocale()-bound convenience signature every
// UI component uses, AND (optionally) the raw `t(copyRecordArg, 'some.key',
// ...)` signature (src/i18n/t.ts's own export) — both end in the same
// quoted-key argument shape, so one pattern covers both call sites.
const T_CALL_RE = /\bt\(\s*(?:[A-Za-z0-9_.]+\s*,\s*)?(['"`])([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+)\1/g;
// `copy['some.key']` / `i.copy["some.key"]` — share.ts's own convention: it
// has no bound t() (shareString is a pure function of a `copy` record
// parameter, deliberately never a hook), so it looks keys up by bracket
// access directly.
const BRACKET_RE = /\bcopy\[\s*(['"`])([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+)\1\s*\]/g;

/**
 * Deliberately NOT a blanket "any key-shaped string literal anywhere in the
 * file" scan: src/game/storage.ts's `'phackle.v1'`/`'phackle.settings'`
 * localStorage keys match the exact `word.word` shape a CopyKey has, and
 * would be a false positive under a scan with no call-site context at all.
 * Scoping to actual t()/copy[] usage sites is both more precise (matches
 * real runtime lookups, not incidental same-shaped strings) and closes the
 * gap that matters: a typo'd key at one of these two call shapes falls back
 * to rendering the raw key string on screen (see src/i18n/t.ts's own
 * doc comment) — a silent, easy-to-miss bug this test catches instead.
 *
 * NOT scanned here: a bare CopyKey literal assigned to a `CopyKey`-typed
 * slot with no lookup call at all (e.g. src/game/scoring.ts's
 * `breakdown.push(['summary.breakdownCallCorrect', ...])`). Those are
 * already exhaustively checked by `tsc` itself — an invalid literal there is
 * a compile error against `[CopyKey, number][]` — so this file's own
 * "repeatable check" is deliberately narrower and complementary, not a
 * tsc replacement; run both (this suite's "full gate" always includes
 * `npx tsc --noEmit`).
 */
function referencedKeys(text: string): string[] {
  const keys: string[] = [];
  for (const re of [T_CALL_RE, BRACKET_RE]) {
    for (const m of text.matchAll(re)) keys.push(m[2]);
  }
  return keys;
}

const scannedFiles = [...walk(UI_DIR), ...walk(GAME_DIR)].filter((f) => /\.tsx?$/.test(f));

describe('Copy catalog freeze — every t()/copy[] key referenced in src/ui + src/game exists in en/copy.ts', () => {
  const validKeys = new Set(Object.keys(copy));

  it('scans a non-trivial number of files (sanity: the walk is not vacuous)', () => {
    expect(scannedFiles.length).toBeGreaterThan(15);
  });

  it('finds at least one real reference of each shape it knows how to match (sanity: the regexes are not simply matching nothing)', () => {
    const all = scannedFiles.flatMap((f) => referencedKeys(stripComments(readFileSync(f, 'utf8'))));
    expect(all.length).toBeGreaterThan(50); // every t()-call across every UI file, plus share.ts's 2 bracket lookups
  });

  it.each(scannedFiles.map((f) => relative(ROOT, f)))('%s: every referenced key exists in the copy catalog', (rel) => {
    const text = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
    const missing = referencedKeys(text).filter((k) => !validKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('still recognises a violation when one is introduced (guards the guard)', () => {
    const sample = "t('nav.title', {}); t('totally.madeUp'); copy['also.fake']; copy[\"nav.stats\"];";
    const missing = referencedKeys(sample).filter((k) => !validKeys.has(k));
    expect(missing.sort()).toEqual(['also.fake', 'totally.madeUp']);
  });

  it('does not false-positive on storage.ts\'s key-shaped-but-unrelated localStorage keys', () => {
    const sample = "const KEY = 'phackle.v1'; const LEGACY = 'phackle.settings';";
    expect(referencedKeys(sample)).toEqual([]);
  });
});

/* ================================================================
   2. Raw user-facing string literal scan (src/ui only, per the T17 brief)
   ================================================================ */

const uiTsxFiles = walk(UI_DIR).filter((f) => f.endsWith('.tsx'));

/** JSX text content strictly between a `>` and the next `<`, excluding any
 * chunk that contains an expression-container brace or a character that
 * only shows up in surrounding CODE (not prose) in this codebase's style —
 * `(`, `)`, `;`, `=` — which is what keeps this from matching TS generics
 * (`Record<...>`), comparisons, or statements that happen to sit between
 * stray angle brackets elsewhere in the file. Calibrated directly against
 * every file under src/ui (see the T17 task report) before being finalized:
 * with the exclusions below it flags exactly one string across the whole
 * tree — "P-hackle" — and nothing else. */
const JSX_TEXT_RE = />([^<>{}();=]*[A-Za-z]{2,}[^<>{}();=]*)</g;

/** Only the 4 attribute names actually capable of carrying user-facing
 * prose as a plain (non-expression) string; `data-testid`, `className`,
 * `id`, `key`, `role`, `type`, `href`, etc. are structural/non-prose and are
 * deliberately not scanned (an `href` is an address, not something a reader
 * parses as language — same "data, not copy" bucket as SITE_URL). */
const ATTR_RE = /\b(?:aria-label|title|alt|placeholder)="([^"]*)"/g;

const ALLOWED_EXACT = new Set(['P-hackle']);
const isUrl = (s: string) => /^https?:\/\//.test(s);
const hasNoLatinLetters = (s: string) => !/[A-Za-z]/.test(s); // emoji/symbol-only decorations

function isAllowed(text: string): boolean {
  return ALLOWED_EXACT.has(text) || isUrl(text) || hasNoLatinLetters(text);
}

function findRawStrings(file: string): string[] {
  const code = stripComments(readFileSync(file, 'utf8'));
  const offenders: string[] = [];
  for (const m of code.matchAll(JSX_TEXT_RE)) {
    const text = m[1].trim();
    if (text && !isAllowed(text)) offenders.push(text);
  }
  for (const m of code.matchAll(ATTR_RE)) {
    const text = m[1].trim();
    if (text && !isAllowed(text)) offenders.push(text);
  }
  return offenders;
}

describe('Raw user-facing string literal scan — src/ui (allowed: "P-hackle", emoji/symbol decorations, URLs)', () => {
  it.each(uiTsxFiles.map((f) => relative(ROOT, f)))('%s has no stray raw user-facing string', (rel) => {
    expect(findRawStrings(join(ROOT, rel))).toEqual([]);
  });

  it('still recognises a violation when one is introduced (guards the guard)', () => {
    const sample = `export function X() { return (<div><p>Loading, please wait</p><button aria-label="Submit the form">Go</button></div>); }`;
    const offenders: string[] = [];
    for (const m of sample.matchAll(JSX_TEXT_RE)) {
      const text = m[1].trim();
      if (text && !isAllowed(text)) offenders.push(text);
    }
    for (const m of sample.matchAll(ATTR_RE)) {
      const text = m[1].trim();
      if (text && !isAllowed(text)) offenders.push(text);
    }
    expect(offenders).toEqual(['Loading, please wait', 'Go', 'Submit the form']);
  });

  it('allows the "P-hackle" wordmark, emoji-only text, and bare URLs', () => {
    expect(isAllowed('P-hackle')).toBe(true);
    expect(isAllowed('🍴🎯')).toBe(true);
    expect(isAllowed('https://phackle.carlosrodriguezpardo.es')).toBe(true);
    expect(isAllowed('Loading, please wait')).toBe(false);
  });
});
