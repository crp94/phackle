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
export const FORK_EMOJI: Record<ForkKind, string> = {
  subgroup: '🎯',
  exclusion: '🔪',
  tails: '🌗',
  spec: '🍴',
  peek: '➕',
};

export const PREREG_PREFIX = '🧾';
export const SUBMIT_EMOJI = '📄';
export const ABANDON_EMOJI = '🏳️';
export const CALL_CORRECT = '⚖️✅';
export const CALL_INCORRECT = '⚖️❌';

/**
 * The emoji trail: 🧾 prefix iff prereg, then one glyph per counted fork (via
 * classifyChange, using the SAME "first VIEW_SPEC is free, later ones count
 * iff seen" rule as forkLog.ts's countForks — so the trail's marker count and
 * line 3's `{forks}` figure are always in lockstep by construction), then
 * the terminal 📄 (published) or 🏳️ (abandoned). CALL entries contribute
 * nothing: the trail shows whether the call was right, never what it was
 * (that's line 2's trailing " → ⚖️✅|⚖️❌", appended by the caller below).
 */
function buildTrail(log: PlayerAction[], prereg: boolean): string {
  let trail = prereg ? PREREG_PREFIX : '';
  let prevSpec: Spec | undefined;

  for (const action of log) {
    switch (action.t) {
      case 'VIEW_SPEC':
        if (prevSpec === undefined) {
          prevSpec = action.spec; // the initial default spec is free (§2.10)
          break;
        }
        if (action.seen) {
          trail += FORK_EMOJI[classifyChange(prevSpec, action.spec)];
        }
        prevSpec = action.spec;
        break;
      case 'PEEK_AND_EXTEND':
        trail += FORK_EMOJI.peek;
        break;
      case 'SUBMIT':
        trail += SUBMIT_EMOJI;
        break;
      case 'ABANDON':
        trail += ABANDON_EMOJI;
        break;
      case 'CALL':
        break; // represented only by the trailing ⚖️ marker, never inline
    }
  }
  return trail;
}

export interface ShareStringInput {
  puzzleNumber: number;
  log: PlayerAction[];
  mode: 'hack' | 'prereg';
  callCorrect: boolean;
  streak: number;
  copy: Record<CopyKey, string>;
}

/**
 * §2.9 layout, 4 lines:
 *   1. "P-hackle #{n}" — the brand name is a deliberate non-translation
 *      (delta spec i18n §6: journal-style proper nouns stay invariant), so
 *      it is a literal here, not pulled from the copy catalog.
 *   2. the emoji trail (see buildTrail) + " → ⚖️✅" or " → ⚖️❌".
 *   3. "{forks} {forksWord} · {streakWord} {streak}" — the only localized
 *      human words; forks is derived from the SAME log via countForks, never
 *      passed in separately, so it can never drift from the trail above.
 *   4. SITE_URL, identical across locales.
 */
export function shareString(i: ShareStringInput): string {
  const forks = countForks(i.log);
  const trail = buildTrail(i.log, i.mode === 'prereg');
  const verdict = i.callCorrect ? CALL_CORRECT : CALL_INCORRECT;

  const line1 = `P-hackle #${i.puzzleNumber}`;
  const line2 = `${trail} → ${verdict}`;
  const line3 = `${forks} ${i.copy['share.forksWord']} · ${i.copy['share.streakWord']} ${i.streak}`;
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
