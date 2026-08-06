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
 * Keys this wave AUTHORED for a wiring commit another wave owns. Every entry
 * names the consumer, so the roster is a work list rather than an amnesty —
 * and assertion (b) below turns it into a self-retiring one: the day a key
 * here acquires a call site, this suite fails until the entry is removed.
 */
const ROSTER_PENDING: Record<string, string> = {
  'nav.tagline':
    'gr6-026/gr6-037 — About.tsx renders it as the standfirst under the <h1>, above about.intro. W7 owns About.tsx this round.',
  'stats.emptyState': 'gr6-035 — Stats.tsx, under the title, rendered only when played === 0. W7.',
  'about.sectionHowItWorks': 'gr6-036 — About.tsx, <h2> over about.mechanism + about.frozenFork. W7.',
  'about.sectionNotReal': 'gr6-036 — About.tsx, <h2> over about.syntheticDisclaimer + about.decimalNote (which moves here). W7.',
  'about.sectionYourData': 'gr6-036 — About.tsx, <h2> over about.dataDisclosure. W7.',
  'about.sectionPriorArt': 'gr6-036 — About.tsx, <h2> over about.priorArt and the five citations. W7.',
  'summary.playPrereg':
    'RETIRED, not pending: W6 (gr6-020) deleted the button this labelled. Blocked on tests/ui/summary.test.tsx:285,837, which still name the key to pin the CTA\'s absence and belong to W7 this round. W7 re-pins those structurally, then deletes the key from all three catalogs and this roster.',
};

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
