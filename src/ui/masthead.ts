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
