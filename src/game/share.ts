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
 */
export function walkForkGlyphs(log: PlayerAction[]): string {
  let glyphs = '';
  let prevSpec: Spec | undefined;

  for (const action of log) {
    if (action.t === 'VIEW_SPEC') {
      if (prevSpec === undefined) {
        prevSpec = action.spec; // the initial default spec is free (§2.10)
        continue;
      }
      if (action.seen) glyphs += FORK_EMOJI[classifyChange(prevSpec, action.spec)];
      prevSpec = action.spec;
    } else if (action.t === 'PEEK_AND_EXTEND') {
      glyphs += FORK_EMOJI.peek;
    }
    // SUBMIT/ABANDON/CALL contribute no in-trail glyph — see the callers.
  }
  return glyphs;
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
  const glyphs = walkForkGlyphs(log);
  // Prereg: a FIXED, outcome-independent terminal, and any literal
  // SUBMIT/ABANDON in the log deliberately ignored (see the doc comment).
  if (prereg) return `${PREREG_PREFIX}${glyphs}${SUBMIT_EMOJI}`;

  // Hack: the log's own terminal(s). store.submit()/abandon() both leave the
  // lab for good, so at most one ever appears and it is always last — this
  // loop is written to be total anyway, so a hand-built log in a
  // generic-contract test cannot silently drop its marker.
  let terminal = '';
  for (const action of log) {
    if (action.t === 'SUBMIT') terminal += SUBMIT_EMOJI;
    else if (action.t === 'ABANDON') terminal += ABANDON_EMOJI;
  }
  return glyphs + terminal;
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
  /**
   * gr6-022 — whether this was a PRACTICE session (store.practice, itself set
   * from daily.ts's isPractice at boot). Line 1 says so when it is true.
   *
   * AN EXPLICIT INPUT, NOT A DERIVED ONE, and that is load-bearing rather than
   * stylistic. The module doc comment above states the property this file is
   * built to make structurally true: the share string is a pure function of
   * (puzzle number, log, mode, call correctness, streak, copy) and "notably
   * NOT of day type, verdict stamp, or call direction... this module has no
   * channel to leak them through even by accident." A practice flag that were
   * inferred from ANY day content — the seed, the scenario, the stamp, the
   * date — would be exactly such a channel. Passed in as a boolean the caller
   * already holds, it is one more input of the same kind as `mode`, and the
   * spoiler property is unaffected BY CONSTRUCTION: see the property test in
   * tests/game/share.test.ts, which now varies this input across day types
   * and asserts the same independence it always did.
   *
   * Optional, defaulting to false, so every existing caller and test keeps its
   * exact behaviour: a real day is the case that was always being described.
   */
  practice?: boolean;
  copy: Record<CopyKey, string>;
}

/**
 * §2.9 layout, 4 lines:
 *   1. "P-hackle #{n}" — the brand name is a deliberate non-translation
 *      (delta spec i18n §6: journal-style proper nouns stay invariant), so
 *      it is a literal here, not pulled from the copy catalog.
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
 * gr6-022 — LINE 1 ON A PRACTICE DAY. `?practice=1` does not expire at
 * launch, and every pre-EPOCH date is a practice date, so "P-hackle #{n}" was
 * being pasted into other people's timelines for sessions that were never
 * played on the day they named, never recorded, and re-seeded from
 * `Math.random()` — indistinguishable, to the reader, from the real issue.
 * A practice run has no issue number to print (the masthead prints an em dash
 * in the same slot, src/ui/masthead.ts), so line 1 drops the number and names
 * the session instead, in the reader's own language: "P-hackle (Practice
 * run)" / "P-hackle (Giornata di prova)" / "P-hackle (Partida de prueba)".
 * The wordmark stays the deliberate non-translation it has always been (delta
 * spec i18n §6); the marker beside it is the SAME `nav.practiceMode` value
 * the running header shows, so the two can never drift.
 *
 * This is consistent with the EN catalog's numbering rule (header rule 9,
 * "`#n` for the share string, and nothing else") rather than an exception to
 * it: the rule fixes the FORM a share-string issue number takes, and a
 * practice run does not have one to take a form.
 */
export function shareString(i: ShareStringInput): string {
  const forks = countForks(i.log);
  const trail = buildTrail(i.log, i.mode === 'prereg');
  const suffix = i.callCorrect === null ? '' : ` → ${i.callCorrect ? CALL_CORRECT : CALL_INCORRECT}`;

  const line1 = i.practice ? `P-hackle (${i.copy['nav.practiceMode']})` : `P-hackle #${i.puzzleNumber}`;
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
