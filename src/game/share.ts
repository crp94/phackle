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
export const FORK_EMOJI: Record<ForkKind, string> = {
  subgroup: '🎯',
  exclusion: '🔪',
  tails: '🌗',
  spec: '🍴',
  peek: '➕',
};

const PREREG_PREFIX = '🧾';
const SUBMIT_EMOJI = '📄';
const ABANDON_EMOJI = '🏳️';
const CALL_CORRECT = '⚖️✅';
const CALL_INCORRECT = '⚖️❌';

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
