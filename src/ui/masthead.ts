/**
 * The running masthead's volume number.
 *
 * T29 pin 3 (cover-echo consistency). Two places render `briefing.vol`
 * ("Vol. {volume}, No. {issue}") against the SAME publication: the app
 * header (src/ui/App.tsx) and the reveal's cover echo, the plain journal
 * cover the RETRACTED stamp lands on (src/ui/screens/Reveal.tsx). Both used
 * to type the literal `1`, so they agreed only by coincidence — the first
 * volume bump would have shipped a header and a cover disagreeing on screen,
 * in the one act whose whole job is to be believed.
 *
 * `issue` needs no such constant: both sites already read the store's own
 * `puzzleNumber`, which is a single source by construction.
 */
export const JOURNAL_VOLUME = 1;

/**
 * gr6-021/gr6-022 — WHAT A PRACTICE DAY PRINTS WHERE AN ISSUE NUMBER GOES.
 *
 * A practice session is not an issue of anything. It is deliberately not
 * derived from the date (`daily.ts`'s `practiceSeed` is a fresh
 * `Math.random()` every load), it is never recorded, and under `?practice=1`
 * it can be run any number of times on the same calendar day — so any number
 * printed beside "No." would be a claim the session cannot support. Before
 * this, two different lies were on screen depending on how practice was
 * entered:
 *
 *   - PRE-EPOCH (every run before launch day, isPractice's second clause):
 *     `puzzleNumber = daysBetween(EPOCH, today) + 1` is NEGATIVE, so the
 *     masthead read "Vol. 1, No. -3" and the cover's DOI read
 *     "10.1337/phk.-3". Measured on 2026-08-06 against EPOCH 2026-08-10.
 *   - POST-LAUNCH `?practice=1`: the number is the REAL day's number, so a
 *     practice run was typographically indistinguishable from the day it was
 *     impersonating — on the masthead, on the journal cover, and in the DOI.
 *
 * The em dash is the house glyph for "there is no value here": it is what
 * `stats.noData` already prints in the histogram, set as a numeral (R2.4).
 * It is a symbol, not prose, so it lives here beside the formula it belongs
 * to rather than in the copy catalog — there is nothing about it to
 * transcreate, and the corpus-wide em-dash budget in
 * tests/content/validators.ts is a budget on PROSE.
 *
 * Both `briefing.vol` sites (the app header, the reveal's cover echo) and the
 * journal cover's DOI take their issue from here — the DOI by having
 * Published.tsx hand this function's result to `fakeDoi`, which now takes an
 * issue LABEL rather than a number, so the rule stays in one place and
 * `src/game/**` acquires no dependency on `src/ui/**`. The three can
 * therefore never disagree, which is the same reason `JOURNAL_VOLUME` above
 * exists.
 */
export const NO_ISSUE = '—';

export function issueLabel(puzzleNumber: number, practice: boolean): string | number {
  return practice ? NO_ISSUE : puzzleNumber;
}
