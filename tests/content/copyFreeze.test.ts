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
//  3. GR6 gr6-026 — the OTHER direction: every key the catalog DEFINES is
//     either reachable from src/ui or src/game, or rostered below with a
//     reason. Check 1 catches a call site with no key; nothing caught a key
//     with no call site, and the grand review found nine of them — including
//     `nav.tagline`, the single best one-line description of the product,
//     transcreated into three languages and rendered nowhere.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { copy } from '../../src/content/en/copy';
import { copy as itCopy } from '../../src/content/it/copy';
import { copy as esCopy } from '../../src/content/es/copy';

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

/**
 * A CopyKey as it is written at a call site. TWO OR MORE segments, and the
 * `+` is the whole point (w7-r-009).
 *
 * This was `[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+` — exactly ONE dot — and the
 * closing-quote backreference then made the mismatch total rather than
 * partial: against `'lab.explain.outcome'` the body matches `lab.explain`,
 * the `\1` finds `.` instead of the quote, and the whole match FAILS. So the
 * twelve multi-segment keys this catalog has were not merely truncated at
 * these call sites, they were invisible at them. Measured: 8 literal call
 * sites unscanned (`lab.explain.*` in SpecControls.tsx,
 * `lab.howThisWorks.title`/`.dismiss` in Lab.tsx).
 */
const KEY = String.raw`[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+`;

// `t('some.key', ...)` — the useLocale()-bound convenience signature every
// UI component uses, AND (optionally) the raw `t(copyRecordArg, 'some.key',
// ...)` signature (src/i18n/t.ts's own export) — both end in the same
// quoted-key argument shape, so one pattern covers both call sites.
const T_CALL_RE = new RegExp(String.raw`\bt\(\s*(?:[A-Za-z0-9_.]+\s*,\s*)?(['"\`])(${KEY})\1`, 'g');
// `copy['some.key']` / `i.copy["some.key"]` — share.ts's own convention: it
// has no bound t() (shareString is a pure function of a `copy` record
// parameter, deliberately never a hook), so it looks keys up by bracket
// access directly.
const BRACKET_RE = new RegExp(String.raw`\bcopy\[\s*(['"\`])(${KEY})\1\s*\]`, 'g');

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
 *
 * A SECOND, DIFFERENT blind spot (disclosed honestly, not just the one
 * above): both regexes require a LITERAL quote character immediately after
 * `t(` / `copy[` — so a DYNAMIC call site, `t(someVariable)` or
 * `copy[someVariable]`, is invisible to this scan entirely; it contributes
 * nothing to `referencedKeys`' output, neither a hit nor a miss. This
 * codebase has exactly two such sites today: `Legend.tsx`'s
 * `t(entry.labelKey)` (`entry: LegendEntry`, `labelKey: CopyKey`) and
 * `Summary.tsx`'s invoice row `t(key)` (`key` destructured from
 * `breakdown: [CopyKey, number][]`). Both are CURRENTLY SAFE for the same
 * reason the previous paragraph's literal-in-a-typed-slot case is: the
 * value flowing into each call is already typed `CopyKey` at its own
 * declaration, so `tsc` rejects an invalid one there regardless of whether
 * this regex scan can see the call site — the same "complementary to tsc,
 * not a replacement for it" relationship, just from the opposite direction
 * (a false NEGATIVE here instead of this file's other false-positive risk).
 * This is a property to PRESERVE, not just a fact to note: any new dynamic
 * `t(...)`/`copy[...]` call site must keep feeding it a value some other
 * declaration already types as `CopyKey` (never a plain `string`, and never
 * a value reaching it via an `as CopyKey` cast, which suppresses exactly
 * the check this paragraph is relying on) — otherwise a typo'd dynamic key
 * would be invisible to BOTH this test and `tsc`.
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
   3. Dead-key sweep — defined ⇒ used, or rostered with a reason (gr6-026)
   ================================================================ */

/**
 * The detector for THIS direction is deliberately the LIBERAL one: any quoted
 * string literal, anywhere under src/ui or src/game, that is exactly equal to
 * a CopyKey. That is much wider than check 1's `t(…)`/`copy[…]` call-site
 * patterns, and the width is the point — the bias has to run the safe way.
 *
 * A liberal detector can only ever UNDER-report death (it may call a key
 * "used" on the strength of a literal that is really dead code), which costs
 * nothing but a missed cleanup. A narrow one would OVER-report it, and this
 * suite's failure message is an instruction to delete a string from three
 * locales — a false positive there is a translated sentence thrown away.
 *
 * The width is also load-bearing for two real call shapes that check 1's own
 * doc comment already names as invisible to it: `Legend.tsx`'s
 * `LEGEND_ENTRIES` table (`{ glyph: …, labelKey: 'legend.emojiSpec' }`, read
 * back as `t(entry.labelKey)`) and `scoring.ts`'s
 * `breakdown.push(['summary.breakdownCallCorrect', …])`, read back as
 * `t(key)`. Both are literals in a `CopyKey`-typed slot with no lookup call
 * beside them, so only a bare-literal scan sees them.
 *
 * The reverse false-positive risk that shaped check 1 (storage.ts's
 * `'phackle.v1'`) cannot arise here: this scan starts from the catalog's own
 * key set and asks whether each key appears, so a same-shaped string that is
 * not a CopyKey is never looked for.
 */
function definesLiteral(text: string, key: string): boolean {
  return new RegExp(`(['"\`])${key.replace(/\./g, '\\.')}\\1`).test(text);
}

/**
 * Keys with no call site that are KEPT anyway, each for a reason that has to
 * survive being read by someone who did not write it. From the final
 * whole-branch review's dead-key roster.
 */
const ROSTER_KEPT: Record<string, string> = {
  'nav.title':
    'The product name. `copyFreeze` uses it as its own guards-the-guard fixture two describes up, and a catalog that cannot name the app is worse than one carrying four characters nothing renders.',
  'a11y.closeDialog':
    'T22 removed the last mislabelled close button (every close control is now named by its own visible label). Kept because the next real dialog needs exactly this string, and it is asserted ABSENT at tests/ui/a11y.test.tsx:540 — the key is the subject of a live regression pin.',
  'a11y.shareButton':
    'The share control is named by its visible label; this is the label the clipboard-only fallback path would take. Documented at Summary.tsx:259, which explains why the button does not use it today.',
};

/**
 * Keys AUTHORED by one wave for a wiring commit another wave owns. Every
 * entry names the consumer, so the roster is a work list rather than an
 * amnesty — and assertion (b) below turns it into a self-retiring one: the
 * day a key here acquires a call site, this suite fails until the entry is
 * removed. It self-retires from the other direction too, via (a): a key
 * removed from here without being wired goes red as an unaccounted dead key.
 *
 * IT IS EMPTY, AND EMPTY IS THE STATE IT SHOULD BE FOUND IN. Fifteen entries
 * passed through it — W2 wrote the strings, W7 wired them at the call sites
 * W2 named, and each entry left as its key acquired one. The record stays
 * declared rather than deleted with the last entry, because it is the only
 * place that distinguishes "kept deliberately, forever" (ROSTER_KEPT above,
 * a different contract) from "owed, by a named wave, at a named call site".
 * A future wave that writes a key ahead of its consumer belongs here, with
 * the consumer written down; a key parked in ROSTER_KEPT instead would be
 * granted permanent amnesty by the wrong list and never wired at all.
 */
const ROSTER_PENDING: Record<string, string> = {};

describe('Dead-key sweep — every defined CopyKey is reachable, or rostered with a reason (gr6-026)', () => {
  const definedKeys = Object.keys(copy);
  const sources = scannedFiles.map((f) => stripComments(readFileSync(f, 'utf8')));
  const usedKeys = new Set(definedKeys.filter((k) => sources.some((text) => definesLiteral(text, k))));

  it('finds most of the catalog reachable (sanity: the scan is not vacuously empty)', () => {
    expect(usedKeys.size).toBeGreaterThan(definedKeys.length * 0.8);
  });

  it('(a) defines no key that is neither used nor rostered', () => {
    const unaccounted = definedKeys.filter(
      (k) => !usedKeys.has(k) && !(k in ROSTER_KEPT) && !(k in ROSTER_PENDING)
    );
    expect(unaccounted).toEqual([]);
  });

  it('(b) rosters no key that is actually used — a wired key must leave the roster', () => {
    const wiredButStillRostered = [...Object.keys(ROSTER_KEPT), ...Object.keys(ROSTER_PENDING)].filter((k) =>
      usedKeys.has(k)
    );
    expect(wiredButStillRostered).toEqual([]);
  });

  it('(c) rosters no key the catalog no longer defines', () => {
    const defined = new Set(definedKeys);
    const stale = [...Object.keys(ROSTER_KEPT), ...Object.keys(ROSTER_PENDING)].filter((k) => !defined.has(k));
    expect(stale).toEqual([]);
  });

  it('(d) gives every rostered key a non-trivial reason', () => {
    const thin = Object.entries({ ...ROSTER_KEPT, ...ROSTER_PENDING })
      .filter(([, reason]) => reason.trim().length < 40)
      .map(([k]) => k);
    expect(thin).toEqual([]);
  });

  it('still recognises a dead key when one is introduced (guards the guard)', () => {
    const withGhost = [...definedKeys, 'nav.ghostKeyThatNothingRenders'];
    const unaccounted = withGhost.filter((k) => !usedKeys.has(k) && !(k in ROSTER_KEPT) && !(k in ROSTER_PENDING));
    expect(unaccounted).toEqual(['nav.ghostKeyThatNothingRenders']);
  });

  it('sees the two dynamic call shapes check 1 is blind to (Legend table, scoring breakdown)', () => {
    // Both are bare literals in a CopyKey-typed slot, with no t()/copy[] call
    // beside them. If this ever goes red, the liberal detector has narrowed
    // and assertion (a) is about to demand the deletion of live strings.
    expect(usedKeys.has('legend.emojiSpec')).toBe(true);
    expect(usedKeys.has('summary.breakdownCallCorrect')).toBe(true);
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
 * tree — "P-hackle" — and nothing else.
 *
 * Merge-integration precision fix (controller, screen-wave merge): the
 * calibration tree predated T15/T16, whose code exposed two parse gaps —
 * (a) `=> Promise<...>` reads as a `>Promise<` span (fixed: the opening `>`
 * may not be preceded by `=`), and (b) a `>` comparison followed lines later
 * by a `<` comparison forms a fake span whose body is code (fixed: straight
 * quotes, `?`, and `*` are code-only characters in this codebase's JSX prose
 * style — copy arrives via {t(...)} expressions, never as raw text with
 * those characters). Both shapes are pinned as negative cases below. */
const JSX_TEXT_RE = /(?<!=)>([^<>{}();='?*]*[A-Za-z]{2,}[^<>{}();='?*]*)</g;

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

  it('does not false-positive on arrow-return generics or split comparison pairs (merge-integration pins)', () => {
    const arrowSample = 'loadCallScreen?: () => Promise<LazyScreenComponent | null>;';
    const ternarySample =
      "const cls = tip.x > geom.width * 0.7 ? 'ph-speccurve__tooltip--end' : '';\nconst y = tip.x < geom.width;";
    for (const sample of [arrowSample, ternarySample]) {
      const offenders: string[] = [];
      for (const m of sample.matchAll(JSX_TEXT_RE)) {
        const text = m[1].trim();
        if (text && !isAllowed(text)) offenders.push(text);
      }
      expect(offenders).toEqual([]);
    }
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

/* ================================================================
   4. Token reconciliation — every {token} a value carries is a param
      some call site actually supplies, in every locale (w7-r-002)
   ================================================================ */

/**
 * THE DEFECT THIS EXISTS FOR, stated first because it is subtle and it
 * shipped. `t()` leaves an unmatched `{token}` VISIBLE on screen by design
 * (src/i18n/t.ts's own doc comment: a missed param should be obvious rather
 * than hidden in a log). So a token renamed in the catalogs but not at the
 * binding site does not throw, does not blank the line, and does not fail a
 * type check — it prints `Top {n}% of all research outputs` to a real player.
 *
 * gr6-086 renamed exactly that token and shipped a test for it, and the test
 * could not see the defect: it built its expected string by substituting into
 * THE SAME CATALOG VALUE the component reads, so renaming the catalog moved
 * both sides of the assertion together. Measured: renaming `{pct}` back to
 * `{n}` in all three catalogs left the whole suite green and rendered the raw
 * token in all three locales.
 *
 * The fix is a check that never reads the value twice. It reconciles two
 * INDEPENDENT sources — the tokens a catalog value declares, and the param
 * names a call site passes — and requires them to be the same set. Written
 * corpus-wide rather than per key, deliberately: the next rename will not
 * come with a test of its own either.
 */

/** Top-level property names of an object literal, or `null` if the literal
 * spreads (in which case the names are not statically knowable and the site
 * is skipped rather than guessed at). */
function objectKeys(text: string): string[] | null {
  const names: string[] = [];
  let depth = 0;
  let i = 0;
  let quote = '';
  let pending = '';
  // Where the literal's own closing brace sits. `text` is the rest of the
  // FILE from the `{` onwards, so every question about this literal has to be
  // asked of `text.slice(0, end)` and never of the whole tail — asking the
  // tail is how the spread check below came to disqualify almost every call
  // site in the product on the strength of an unrelated `...` further down
  // the file.
  let end = -1;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0) {
        if (pending.trim()) names.push(pending.trim());
        end = i;
        break;
      }
      continue;
    }
    if (depth !== 1) continue;
    if (ch === ':') {
      if (pending.trim()) names.push(pending.trim());
      pending = '';
      // skip the value entirely — only names matter here
      let valueDepth = 0;
      for (i++; i < text.length; i++) {
        const c = text[i];
        if (quote) {
          if (c === quote && text[i - 1] !== '\\') quote = '';
          continue;
        }
        if (c === '"' || c === "'" || c === '`') {
          quote = c;
          continue;
        }
        if (c === '{' || c === '[' || c === '(') valueDepth++;
        else if (c === '}' || c === ']' || c === ')') {
          if (valueDepth === 0) {
            i--;
            break;
          }
          valueDepth--;
        } else if (c === ',' && valueDepth === 0) break;
      }
      continue;
    }
    if (ch === ',') {
      if (pending.trim()) names.push(pending.trim());
      pending = '';
      continue;
    }
    pending += ch;
  }
  if (end === -1) return null; // unbalanced: not statically knowable
  if (text.slice(0, end).includes('...')) return null; // spreads: likewise
  return names.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

interface CallSite {
  file: string;
  key: string;
  params: string[] | null;
}

/**
 * Every BINDING SITE — somewhere a catalog value meets the params that fill
 * its tokens — with the param names it supplies. A site with no params
 * reports an empty list, which is exactly as meaningful: it asserts the value
 * carries no tokens.
 *
 * TWO SHAPES, because the product has two and they share the one property
 * that makes this check necessary — an unbound token stays VISIBLE:
 *   - `t('some.key', { … })` / `t(record, 'some.key', { … })` — src/i18n/t.ts.
 *   - `interpolate(copy['some.key'], { … })` — Reveal.tsx's own binder, which
 *     splices ReactNodes rather than strings (numerals get their own mono
 *     span) and so cannot use `t()`. Its doc comment states the same contract
 *     in the same words: "an unbound token stays visible rather than
 *     vanishing, so a missed param is obvious on screen."
 *
 *   - `copy['some.key'].replace('{tok}', …)` — SpecCurve.tsx's threshold
 *     label, which is a plain string going into an SVG <text> and needs
 *     neither binder. The replaced token is a literal, so it reads as a
 *     param exactly like the other two shapes.
 *
 * Scanning only the first shape would have left the twelve `reveal.*` values
 * unreconciled — among them `reveal.accounting1Effect`, which carries five
 * tokens and is the most token-dense string in the product. The catalog-end
 * assertion below is what forced this: with one shape scanned it would have
 * needed a twelve-key amnesty list, which is not a guard.
 */
function callSites(file: string, text: string): CallSite[] {
  const sites: CallSite[] = [];
  // Either binder's opening: `t(` (optionally with the raw signature's copy
  // record first) or a `copy[` bracket lookup — which is both `interpolate`'s
  // argument and SpecCurve's bare read, since what follows the `]` is what
  // tells the two apart.
  const re = new RegExp(
    String.raw`\b(?:t\(\s*(?:[A-Za-z0-9_.]+\s*,\s*)?|copy\[\s*)(['"\`])(${KEY})\1\s*\]?`,
    'g'
  );
  for (const match of text.matchAll(re)) {
    const after = text.slice((match.index ?? 0) + match[0].length);
    const next = after.match(/^\s*(.)/);
    if (!next) continue;
    if (next[1] === ')') {
      sites.push({ file, key: match[2], params: [] });
      continue;
    }
    // `copy['key'].replace('{tok}', …)` — the params are the literal tokens
    // handed to `.replace`, read straight off the chain.
    if (/^\s*\.replace\(/.test(after)) {
      const replaced = [...after.matchAll(/^(?:\s*\.replace\(\s*(['"`])\{(\w+)\}\1[^)]*\))+/g)]
        .flatMap((m) => [...m[0].matchAll(/\{(\w+)\}/g)].map(([, name]) => name));
      sites.push({ file, key: match[2], params: replaced });
      continue;
    }
    if (next[1] !== ',') {
      // A BARE `copy['key']` read: the string goes to the screen exactly as
      // written, so nothing can bind anything and the value must carry no
      // token. An empty param list says precisely that, and section 4's first
      // assertion enforces it.
      if (match[0].includes('copy[')) sites.push({ file, key: match[2], params: [] });
      continue;
    }
    const rest = after.slice(after.indexOf(',') + 1).replace(/^\s+/, '');
    if (!rest.startsWith('{')) {
      // a params object that is not a literal (a variable, a call): the names
      // are not statically knowable, so this site is skipped rather than
      // guessed at.
      sites.push({ file, key: match[2], params: null });
      continue;
    }
    sites.push({ file, key: match[2], params: objectKeys(rest) });
  }
  return sites;
}

const tokensOf = (value: string): string[] => [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name);

const ALL_LOCALES: [string, Record<string, string>][] = [
  ['en', copy as unknown as Record<string, string>],
  ['it', itCopy as unknown as Record<string, string>],
  ['es', esCopy as unknown as Record<string, string>],
];

/** Every literal call site in the product, paired with what it supplies. */
const allCallSites: CallSite[] = scannedFiles.flatMap((f) =>
  callSites(relative(ROOT, f), stripComments(readFileSync(f, 'utf8')))
);

describe('Token reconciliation — a value\'s {tokens} and its call site\'s params are the same set (w7-r-002)', () => {
  it('finds a non-trivial number of literal call sites, params included (sanity: the parse is not vacuous)', () => {
    expect(allCallSites.length).toBeGreaterThan(50);
    expect(allCallSites.filter(({ params }) => params && params.length > 0).length).toBeGreaterThan(10);
  });

  it('SKIPS NOTHING SILENTLY — every literal call site in the product is actually reconciled', () => {
    // The failure mode this check has, and the one it shipped with for an
    // hour: `params === null` means "not statically knowable", and the two
    // reconciliations above quietly `continue` past it. A parse bug that
    // returned null for everything would leave both of them iterating an
    // empty set and passing loudly. (That is not hypothetical — the spread
    // test originally scanned the rest of the FILE rather than the literal's
    // own extent, so a single `...` anywhere below a call site disqualified
    // it, and almost every site in the product was being skipped.)
    //
    // The product has no spread- or variable-params call site today, so the
    // honest pin is zero. If one is ever written, this assertion is the
    // conversation about whether it should be.
    const unknowable = allCallSites.filter(({ params }) => params === null);
    expect(unknowable.map(({ file, key }) => `${file}: t('${key}')`)).toEqual([]);
  });

  it('parses a params object literal the way the compiler would', () => {
    expect(objectKeys('{ n: 3 })')).toEqual(['n']);
    expect(objectKeys('{ n })')).toEqual(['n']); // shorthand
    expect(objectKeys('{ hours, minutes })')).toEqual(['hours', 'minutes']);
    expect(objectKeys('{ volume: JOURNAL_VOLUME, issue: n })')).toEqual(['volume', 'issue']);
    // A value containing braces, a comma and a quoted brace must not be read
    // as more param names.
    expect(objectKeys('{ n: fn({ a: 1, b: 2 }), s: "x, {y}" })')).toEqual(['n', 's']);
    // A spread is not statically knowable and must disable the site.
    expect(objectKeys('{ ...rest })')).toBeNull();
  });

  it.each(ALL_LOCALES)('%s: every token a rendered value carries is supplied by its call site', (_name, catalog) => {
    const problems: string[] = [];
    for (const { file, key, params } of allCallSites) {
      if (params === null) continue; // spread / non-literal: not knowable
      const value = catalog[key];
      if (value === undefined) continue; // check 1 owns missing keys
      const tokens = tokensOf(value);
      const missing = tokens.filter((token) => !params.includes(token));
      if (missing.length > 0) {
        problems.push(
          `${file}: t('${key}') renders ${missing.map((m) => `{${m}}`).join(', ')} RAW — ` +
            `the value declares [${tokens.join(', ')}] and the call site supplies [${params.join(', ')}]`
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it.each(ALL_LOCALES)('%s: every param a call site supplies is a token the value actually has', (_name, catalog) => {
    // The other direction, and it is not cosmetic: a param with no token is
    // either a token that was renamed out from under it (the same defect seen
    // from the other end) or dead weight the next translator will trust.
    const problems: string[] = [];
    for (const { file, key, params } of allCallSites) {
      if (params === null || params.length === 0) continue;
      const value = catalog[key];
      if (value === undefined) continue;
      const tokens = tokensOf(value);
      const unused = params.filter((param) => !tokens.includes(param));
      if (unused.length > 0) {
        problems.push(`${file}: t('${key}') passes ${unused.join(', ')}, which the value never interpolates`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('still recognises a half-rename when one is introduced (guards the guard)', () => {
    // The exact gr6-086 defect, both directions, against a fabricated pair.
    const catalog = { 'published.altmetricPercentile': 'Top {n}% of all research outputs, all time' };
    const site: CallSite = { file: 'probe.tsx', key: 'published.altmetricPercentile', params: ['pct'] };
    const tokens = tokensOf(catalog[site.key as keyof typeof catalog]);
    expect(tokens.filter((token) => !site.params!.includes(token))).toEqual(['n']);
    expect(site.params!.filter((param) => !tokens.includes(param))).toEqual(['pct']);
  });
});

/* ================================================================
   5. The catalog-end reconciliation (w7-r-009)
   ================================================================ */

/**
 * WHY THIS EXISTS, and why section 4 alone was not enough.
 *
 * Section 4 reconciles from the CALL SITE's end: for every site it finds, the
 * value's tokens must match the params. That is only as complete as the scan
 * that finds the sites — and the scan had a hole of exactly the shape it was
 * written to prevent. Its key pattern accepted ONE dot, so the twelve
 * multi-segment keys in this catalog matched nothing at all (the closing-quote
 * backreference turned a partial match into no match), and eight real call
 * sites were never examined. A `{ghostparam}` added to
 * `lab.howThisWorks.step1` in all three catalogs left the whole suite green
 * and rendered the raw token to the player.
 *
 * The regex is widened, but widening a regex is not a proof: the next hole
 * will be a shape nobody thought of either. THIS check reconciles from the
 * CATALOG's end, where a regex gap cannot hide — it starts from the values
 * that actually carry tokens and demands that each one be reachable by a site
 * the scanner can see. A key the scanner cannot see is not silently exempt
 * from section 4; it is a failure here.
 *
 * `lab.howThisWorks.step1` is the case that makes the point. It is read back
 * as `t(key)` from a `CopyKey[]` table, so NO call-site regex, however wide,
 * can ever attribute params to it. It carries no token today, and this check
 * is what makes that a requirement rather than a coincidence.
 */

/**
 * The sites where ONE params object is bound to a SET of interchangeable
 * keys, chosen at runtime. A scanner cannot attribute params to these — the
 * key is a ternary or a variable — so they are enumerated, and the enumeration
 * carries the invariant that makes them safe instead of an excuse:
 *
 *   every key in a group carries EXACTLY the token set its one binding site
 *   supplies.
 *
 * That is the same reconciliation section 4 performs, done against a hand-read
 * call site rather than a parsed one. A token added to any member diverges
 * from its siblings and from the pinned set, and fails here.
 */
const DYNAMIC_KEY_GROUPS: { site: string; params: string[]; keys: string[] }[] = [
  {
    // Reveal.tsx: `t(isPrereg ? 'reveal.preregisteredRecipe' : 'reveal.publishedRecipe', { recipe })`
    site: 'Reveal.tsx — the published/preregistered recipe line',
    params: ['recipe'],
    keys: ['reveal.publishedRecipe', 'reveal.preregisteredRecipe'],
  },
  {
    // Reveal.tsx: `interpolate(copy[exploredKey], { k })`, where `exploredKey`
    // is one of three, chosen by mode then by path (gr6-003).
    site: 'Reveal.tsx — the explored-count line (accounting2)',
    params: ['k'],
    keys: ['reveal.accounting2', 'reveal.accounting2Abandoned', 'reveal.accounting2Prereg'],
  },
];

describe('Catalog-end reconciliation — a value that carries a token is reachable (w7-r-009)', () => {
  const scannedKeys = new Set(allCallSites.map(({ key }) => key));
  const tokenBearing = (catalog: Record<string, string>) =>
    Object.keys(catalog).filter((key) => tokensOf(catalog[key]).length > 0);

  it.each(ALL_LOCALES)('%s: every token-bearing value is reached by a scanned site or a named dynamic one', (_n, catalog) => {
    const enumerated = new Set(DYNAMIC_KEY_GROUPS.flatMap(({ keys }) => keys));
    const unreachable = tokenBearing(catalog).filter((key) => !scannedKeys.has(key) && !enumerated.has(key));
    // A key here means: this value interpolates something, and nothing in the
    // product that this suite can see binds it. Either the call site is a
    // shape the scanner does not know (widen it, as w7-r-009 did), or the
    // token is genuinely unbound and renders raw.
    expect(unreachable).toEqual([]);
  });

  it.each(ALL_LOCALES)('%s: every dynamically-keyed group carries exactly the tokens its one site supplies', (_n, catalog) => {
    const problems: string[] = [];
    for (const { site, params, keys } of DYNAMIC_KEY_GROUPS) {
      for (const key of keys) {
        const value = catalog[key];
        if (value === undefined) {
          problems.push(`${site}: ${key} is no longer in the catalog`);
          continue;
        }
        const tokens = [...tokensOf(value)].sort();
        if (JSON.stringify(tokens) !== JSON.stringify([...params].sort())) {
          problems.push(`${site}: ${key} carries [${tokens.join(', ')}], but the site supplies [${params.join(', ')}]`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps the dynamic enumeration MINIMAL — a key the scanner can now see must leave it', () => {
    // Self-retiring, like the dead-key roster. If a call site is ever
    // rewritten to a literal the scanner reads, its key belongs in the
    // ordinary reconciliation and not in a hand-maintained list.
    const nowScannable = DYNAMIC_KEY_GROUPS.flatMap(({ keys }) => keys).filter((key) => scannedKeys.has(key));
    expect(nowScannable).toEqual([]);
  });

  it('is not vacuous: it is looking at a real and substantial set of values', () => {
    expect(tokenBearing(copy as unknown as Record<string, string>).length).toBeGreaterThan(25);
    expect(scannedKeys.size).toBeGreaterThan(50);
  });

  it('still catches a token added to a value nothing can bind (guards the guard)', () => {
    // The reviewer's exact probe, in miniature: a multi-segment key read back
    // from a CopyKey[] table, which no call-site regex can ever reach.
    const fabricated: Record<string, string> = { 'lab.howThisWorks.step1': 'Turn a knob and watch {ghostparam}.' };
    const enumerated = new Set(DYNAMIC_KEY_GROUPS.flatMap(({ keys }) => keys));
    const unreachable = Object.keys(fabricated).filter(
      (key) => tokensOf(fabricated[key]).length > 0 && !scannedKeys.has(key) && !enumerated.has(key)
    );
    expect(unreachable).toEqual(['lab.howThisWorks.step1']);
  });
});
