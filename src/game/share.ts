// Master spec §2.9 — the spoiler-safe share grid. Pure function of (puzzle
// number, action log, mode, call correctness, streak, copy) — notably NOT of
// day type, verdict stamp, or call direction, which is what makes the
// spoiler rule structurally true rather than merely policy: this module has
// no channel to leak them through even by accident. See
// tests/game/share.test.ts's spoiler property test, which locks this in.
import type { CopyKey } from '../content/en/copy';
import type { PlayerAction, Spec } from '../engine/types';
import { classifyChange, countForks, type ForkKind } from './forkLog';

export const SITE_URL = 'https://phackle.carlosrodriguezpardo.es';

// §2.9 emoji legend. 'peek' is never returned by classifyChange (it only
// compares two Specs) — it is looked up directly by literal key when a
// PEEK_AND_EXTEND action is encountered below. Keeping the map total over
// ForkKind (rather than the 4 classifyChange outcomes only) avoids a partial
// switch and doubles as the single source of truth for both call sites.
// Exported so T14's ForkTrail (the Lab's live emoji strip) imports the SAME
// legend rather than duplicating it — the one glyph source of truth for both
// the mid-game trail and the end-of-day share string.
//
// T17 (Legend screen): also consumed, along with the 5 terminal/prefix glyphs
// below, so the in-game Legend page can render the §2.9 emoji table FROM this
// map rather than retyping the glyphs — single source of truth. Nothing about
// shareString's own logic changes.
//
// DOCUMENTED DEVIATION FROM MASTER SPEC §2.9 (T29, owner-directed, third
// play-test round: "the fork emojis are... questionable. they are hard to
// read"). §2.9 tabulates ONE GLYPH PER KNOB — 🎯 subgroup, 🔪 exclusion,
// 🌗 tails, 🍴 any other spec change. At the sizes a shared trail is actually
// read at, four near-identical pictographs are not distinguishable, and the
// distinction they encode is not one a reader of somebody else's score needs.
// The owner therefore collapsed all FOUR spec-change kinds onto 🍴; ➕ (a
// peek, i.e. more data — a categorically different move, not another fork)
// stays distinct. In-trail vocabulary is now exactly two glyphs; the whole
// vocabulary, counting the 🧾 prefix, the 📄/🏳️ terminals and the ⚖️✅/⚖️❌
// call marks, is seven.
//
// classifyChange and every other fork-classification path are UNTOUCHED (the
// achievements in src/game/achievements.ts read those kinds and must keep
// seeing all four): this is a presentation mapping and nothing else. Because
// the map stays total over ForkKind, both call sites below and the Legend
// page keep working unchanged — the Legend simply dedupes by glyph.
export const FORK_EMOJI: Record<ForkKind, string> = {
  subgroup: '🍴',
  exclusion: '🍴',
  tails: '🍴',
  spec: '🍴',
  peek: '➕',
};

export const PREREG_PREFIX = '🧾';
export const SUBMIT_EMOJI = '📄';
export const ABANDON_EMOJI = '🏳️';
export const CALL_CORRECT = '⚖️✅';
export const CALL_INCORRECT = '⚖️❌';

/**
 * §2.10's WALK, and the one place it lives (gr6-092).
 *
 * One glyph per counted fork: `classifyChange` for a spec change, `➕` for a
 * peek, under the SAME "the first VIEW_SPEC is free, later ones count iff
 * `seen`" rule as forkLog.ts's `countForks` — so the glyph count and line 3's
 * `{forks}` figure are in lockstep by construction rather than by care.
 *
 * Exported because there are two consumers and this rule may only have one
 * home. `buildTrail` below wraps it with the share string's prefix and
 * terminal; `components/ForkTrail.tsx` (the Lab's live strip) used to restate
 * the walk verbatim, with a comment explaining that it had to because only
 * `FORK_EMOJI` and `classifyChange` were exported. Now the walk is exported
 * too, and the rule cannot be half-changed in one place.
 *
 * Deliberately covers ONLY the fork/peek run: no prereg prefix, no
 * SUBMIT/ABANDON terminal, no call mark. Those are the two consumers'
 * differences, and they are exactly what stays at the call sites — the Lab is
 * by definition mid-play, before any terminal exists.
 *
 * RETURNS ONE ELEMENT PER FORK (gr2-010 / §1(i)), not a pre-joined string.
 * The walk is the only place that knows where one glyph ends and the next
 * begins: 🍴 is one UTF-16 surrogate pair and ➕ is a single unit, so a
 * downstream consumer that wanted to group the run would have to re-tokenize
 * a string this function had just finished tokenizing — and get the pair
 * arithmetic right a second time. `buildTrail` below groups these in fives;
 * `components/ForkTrail.tsx` joins them straight back together. Both keep
 * reading the same walk, which is the rule gr6-092 exists to protect.
 */
export function walkForkGlyphs(log: PlayerAction[]): string[] {
  const glyphs: string[] = [];
  let prevSpec: Spec | undefined;

  for (const action of log) {
    if (action.t === 'VIEW_SPEC') {
      if (prevSpec === undefined) {
        prevSpec = action.spec; // the initial default spec is free (§2.10)
        continue;
      }
      if (action.seen) glyphs.push(FORK_EMOJI[classifyChange(prevSpec, action.spec)]);
      prevSpec = action.spec;
    } else if (action.t === 'PEEK_AND_EXTEND') {
      glyphs.push(FORK_EMOJI.peek);
    }
    // SUBMIT/ABANDON/CALL contribute no in-trail glyph — see the callers.
  }
  return glyphs;
}

/**
 * §1(i), part 1 — HOW MANY FORKS FIT IN ONE GROUP.
 *
 * Five, for the reason tally marks are five: it is the largest run a reader
 * subitizes without counting, so a grouped trail is read as "three groups and
 * two" rather than counted glyph by glyph. Nothing downstream derives from
 * this number — it is a presentation constant with exactly one consumer
 * (`buildTrail`) and one test group.
 */
export const FORK_GROUP_SIZE = 5;

/**
 * §1(i), part 1 — THE RUN IS GROUPED, AND DELIBERATELY NOT CAPPED.
 *
 * The finding (gr2-010 + gr3-027), measured over 32 days × 3 player models:
 * the trail is a run of 0–60 instances of ONE character, and "read cold,
 * there is nothing to decode". The ruling offered two shapes — group the run,
 * or cap it at N glyphs and print "+k".
 *
 * GROUPING ONLY, and the cap declined, for three measured reasons:
 *   1. The cap's "+k" restates line 3's `Forks: 43` — and "the number that
 *      carries the information is restated in words on the next line" is a
 *      clause of the finding itself, not a thing to add a second instance of.
 *   2. The remainder marker would have to be an ASCII '+', one glyph away
 *      from ➕, which is a real in-trail token meaning "peek". A share string
 *      whose truncation mark is confusable with its own vocabulary is worse
 *      than the run it truncates.
 *   3. The length IS the joke. A sixty-fork day should look like a sixty-fork
 *      day to a stranger; capping it at twenty-five hides the one thing the
 *      grid is for. Grouped, sixty glyphs read as twelve tally blocks and
 *      wrap between them (the separator is a plain space, so every break
 *      opportunity falls between groups and never inside one).
 *
 * The groups are joined with U+0020 and so are the prefix and the terminal:
 * a terminal glued to the last group would make that group look like six.
 * Empty parts are never emitted, so a zero-fork prereg day is `🧾 📄` and a
 * zero-fork abandoned hack day is `🏳️` — no leading or doubled spaces at any
 * fork count.
 *
 * SPOILER-NEUTRAL BY CONSTRUCTION: grouping is a function of the trail's
 * LENGTH, which is `countForks(log)`, which was already printed in full on
 * line 3. No new input reaches this function; see the module header.
 */
function groupForkRun(glyphs: string[]): string[] {
  const groups: string[] = [];
  for (let i = 0; i < glyphs.length; i += FORK_GROUP_SIZE) {
    groups.push(glyphs.slice(i, i + FORK_GROUP_SIZE).join(''));
  }
  return groups;
}

/**
 * The emoji trail: 🧾 prefix iff prereg, then the §2.10 walk above, then a
 * terminal marker. CALL entries contribute nothing: the trail shows whether
 * the call was right, never what it was (that's line 2's trailing
 * " → ⚖️✅|⚖️❌", appended by the caller below, and omitted entirely when
 * there was no call at all — see shareString).
 *
 * The terminal marker itself is MODE-DECIDED, not log-content-decided, for
 * Prereg Mode (post-review fix): store.ts's preregCommit() never logs a
 * SUBMIT or ABANDON action at all (a preregistered commit is always run and
 * reported — there is no abandon path in Prereg Mode, §2.6/§7.3), so a
 * log-driven SUBMIT/ABANDON case would silently emit no terminal for every
 * REAL prereg day. `prereg` therefore forces a single, FIXED, outcome-
 * independent 📄 at the end, unconditionally — reusing the existing glyph
 * (no new emoji, no legend change), and any literal SUBMIT/ABANDON entry
 * that might still appear in a hand-built log (e.g. a generic-contract unit
 * test) is deliberately ignored for prereg, so the terminal can never be
 * doubled and can never vary with what a test happens to put in the log.
 * Critically, this glyph must NEVER be derived from preregSig/significance:
 * doing so would let a viewer infer the day's dayType from the glyph alone
 * (a sig+null RETRACTED "5% false positive" day would look identical to a
 * REPLICATED day either way, by design) — see the spoiler-safety property
 * test in tests/game/share.test.ts, extended to assert exactly this.
 */
function buildTrail(log: PlayerAction[], prereg: boolean): string {
  const groups = groupForkRun(walkForkGlyphs(log));

  // Prereg: a FIXED, outcome-independent terminal, and any literal
  // SUBMIT/ABANDON in the log deliberately ignored (see the doc comment).
  if (prereg) return [PREREG_PREFIX, ...groups, SUBMIT_EMOJI].join(' ');

  // Hack: the log's own terminal(s). store.submit()/abandon() both leave the
  // lab for good, so at most one ever appears and it is always last — this
  // loop is written to be total anyway, so a hand-built log in a
  // generic-contract test cannot silently drop its marker.
  let terminal = '';
  for (const action of log) {
    if (action.t === 'SUBMIT') terminal += SUBMIT_EMOJI;
    else if (action.t === 'ABANDON') terminal += ABANDON_EMOJI;
  }
  // `filter(Boolean)` rather than a conditional push: it covers BOTH empty
  // parts at once (no terminal, and no forks) so no fork count can produce a
  // leading, trailing or doubled space.
  return [...groups, terminal].filter(Boolean).join(' ');
}

export interface ShareStringInput {
  puzzleNumber: number;
  log: PlayerAction[];
  mode: 'hack' | 'prereg';
  /** null iff no call was ever made (Prereg Mode has no CALL step at all,
   * §2.8) — line 2 carries no "→ ⚖️…" suffix in that case (post-review fix:
   * Summary.tsx previously collapsed this to `callCorrect ?? false`, which
   * made every prereg day read as an unconditional wrong call). A boolean
   * here means a real call was made and resolved correct/incorrect
   * (Hacking Mode always supplies one — see scoring.ts's own doc comment on
   * why abandoners still call). */
  callCorrect: boolean | null;
  streak: number;
  copy: Record<CopyKey, string>;
}

/**
 * §2.9 layout, 4 lines:
 *   1. "P-hackle #{n} · {tagline}" — the brand name is a deliberate
 *      non-translation (delta spec i18n §6: journal-style proper nouns stay
 *      invariant), so it is a literal here, not pulled from the copy catalog.
 *      The tagline after it IS from the catalog — see the §1(i) note below.
 *   2. the emoji trail (see buildTrail), plus " → ⚖️✅"/" → ⚖️❌" iff a call
 *      was actually made (callCorrect !== null) — omitted entirely for
 *      Prereg Mode, which never calls.
 *   3. "{forksWord}: {forks} · {streakWord}: {streak}" — the only localized
 *      human words; forks is derived from the SAME log via countForks, never
 *      passed in separately, so it can never drift from the trail above.
 *   4. SITE_URL, identical across locales.
 *
 * DOCUMENTED DEVIATION FROM MASTER SPEC §2.9 (T37 fix round 1, controller
 * ruling). §2.9 composes line 3 as "{forks} {forksWord} · {streakWord}
 * {streak}" — a bare count in front of a bare noun. That is an English
 * assumption about agreement, and it is wrong in English too: at one fork the
 * line reads "1 forks", and in the shipped locales "1 biforcazioni" /
 * "1 bifurcaciones". A one-fork day is not exotic (publishing the default
 * specification is exactly one), and unlike every other count in the product
 * this string LEAVES THE APP: it is pasted into other people's timelines,
 * where nobody can see the version that would have been correct.
 *
 * The ruling amends the layout to the label-colon-count form, which is
 * grammar-neutral at every value in every locale because no word downstream
 * of the colon has to agree with the number: "Forks: 3 · Streak: 7",
 * "Biforcazioni: 1 · Serie: 7", "Bifurcaciones: 1 · Racha: 7". The four
 * localized words are capitalized to sit in label position.
 *
 * WHAT THIS DOES NOT TOUCH: the spoiler property. Line 3 still takes only
 * `forks` (from the log) and `streak` (from the store) — no day type, no
 * stamp, no call direction, exactly as before. The rearrangement is
 * typographic; tests/game/share.test.ts's property test is unchanged.
 *
 * SECOND DOCUMENTED DEVIATION FROM §2.9 (§1(i), owner ruling 2026-08-06:
 * "CHUNK + HOOK"). §2.9's line 1 is the bare "P-hackle #{n}".
 *
 * THE DEFECT (gr3-027): the four-line object contains no content word except
 * "Forks". Pasted into a stranger's timeline it is a number, a run of one
 * repeated character, two labels and a URL — nothing that says what the thing
 * IS, and therefore no reason to follow the link. Line 1 is the only line
 * with room: line 2 is the grid, line 3 is pinned to exactly two figures by
 * the spoiler rule, line 4 is the URL.
 *
 * WHAT GOES THERE, AND WHY IT IS THE CATALOG'S STRING AND NOT A LITERAL. The
 * hook is `nav.tagline` — "A daily game about the garden of forking paths."
 * — read from the copy catalog like line 3's two words, not hard-coded like
 * the brand name. Three reasons:
 *   1. It is the product's own one-line description, already authored and
 *      transcreated in all three locales, and `src/content/en/copy.ts`
 *      reserves this exact site at the key ("§1(i)'s share-string hook is the
 *      second place it will earn"). Writing a fourth string here would mean a
 *      second one-line description to keep in step with the first.
 *   2. Line 3 has been localized since T37 ("Biforcazioni: 1 · Serie: 7"), so
 *      an English-only line 1 would be the anomaly in this string, not the
 *      rule. The §1(i) brief's "invariant across locales" describes the brand
 *      NAME, which is still a literal above and still invariant.
 *   3. It leaks nothing, structurally: it is a constant per locale, with no
 *      input from the day at all. The `copy` bundle was already an argument.
 *
 * The separator is the same " · " line 3 uses, so the two content lines are
 * punctuated alike.
 */
export function shareString(i: ShareStringInput): string {
  const forks = countForks(i.log);
  const trail = buildTrail(i.log, i.mode === 'prereg');
  const suffix = i.callCorrect === null ? '' : ` → ${i.callCorrect ? CALL_CORRECT : CALL_INCORRECT}`;

  const line1 = `P-hackle #${i.puzzleNumber} · ${i.copy['nav.tagline']}`;
  const line2 = `${trail}${suffix}`;
  const line3 = `${i.copy['share.forksWord']}: ${forks} · ${i.copy['share.streakWord']}: ${i.streak}`;
  const line4 = SITE_URL;

  return [line1, line2, line3, line4].join('\n');
}

// --- shareViaNavigator (T17: Summary's Share button) ------------------------
//
// The side-effecting counterpart to shareString above: where shareString is a
// pure function of game data (and is spoiler-tested accordingly), this talks
// to two real browser APIs. Deliberately NOT exported alongside a "which one
// fired" detail beyond the two-value result: the caller (Summary.tsx) only
// ever needs to know whether to show the "Copied to clipboard" toast (never
// shown for 'shared' — the OS's own share sheet is already the confirmation).
//
// Fallback chain, exactly two tiers (§7.3 "native share API + clipboard
// fallback"):
//   1. `navigator.share` if it exists AND resolves -> 'shared'.
//   2. Otherwise (no navigator.share, OR it rejects -- e.g. the player
//      cancelled the OS share sheet, or the call errors for any other
//      reason) -> navigator.clipboard.writeText -> 'copied'.
// A clipboard failure (missing API or a rejected write) is NOT swallowed: it
// rejects the returned promise so the caller can surface an error rather than
// silently doing nothing, matching the "no channel fails silently" pattern
// storage.ts uses for its own localStorage guards.
export async function shareViaNavigator(text: string): Promise<'shared' | 'copied'> {
  const nav = navigator as Navigator & {
    share?: (data: { text: string }) => Promise<void>;
    clipboard?: { writeText: (text: string) => Promise<void> };
  };

  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text });
      return 'shared';
    } catch {
      // Fall through to the clipboard — a rejected share() (including the
      // player dismissing the share sheet) still gets the result onto the
      // clipboard rather than leaving the player with nothing.
    }
  }

  if (!nav.clipboard?.writeText) {
    throw new Error('shareViaNavigator: neither navigator.share nor navigator.clipboard is available');
  }
  await nav.clipboard.writeText(text);
  return 'copied';
}
