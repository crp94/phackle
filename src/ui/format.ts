// gr6-074 — ONE PLACE THAT KNOWS WHAT A MINUS SIGN IS.
//
// This product typesets ≥, ×, ·, β and α correctly and then printed its
// negative numbers with U+002D HYPHEN-MINUS, the character a keyboard has
// rather than the one a typesetter uses. It is visible: at --text-13 in
// JetBrains Mono the hyphen is a short, high stroke that reads as a dash
// between two figures, while U+2212 is drawn to the same width and at the
// same optical height as the `+` and the digits it sits beside — which is
// exactly why a table of signed coefficients wants it.
//
// Deliberately a POST-FORMATTER over a finished string rather than a new
// number formatter: every caller already has its own rounding contract
// (three significant figures here, two decimals there), and those contracts
// are tested where they live. This function only ever changes the sign
// character, so it cannot move a value.
//
// WHAT MUST NOT REACH THIS FUNCTION, stated because the boundary is the
// point. The share string (src/game/share.ts) is a spoiler-safe byte
// sequence people paste into other apps and a property test pins it; the
// engine's own numbers are data, not display. This module is `src/ui` only.

/** U+2212 MINUS SIGN. Named rather than inlined so a grep for the character
 * finds one definition and a reviewer never has to identify it by eye. */
export const MINUS = '−';

/**
 * Replaces a LEADING ASCII hyphen with U+2212. Only leading, and only one:
 * a hyphen anywhere else in a formatted number is not a sign (a date, a
 * range, an exponent's own marker), and this function has no way to tell
 * those apart — so it does not try.
 */
export function typographicMinus(formatted: string): string {
  return formatted.startsWith('-') ? MINUS + formatted.slice(1) : formatted;
}
