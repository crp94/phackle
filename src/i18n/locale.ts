// Locale detection and availability (delta spec i18n §2). The engine never
// imports this (enforced by eslint.config.js's no-restricted-imports rule on
// src/engine/**) — locale is a presentation-layer concern only.
import type { Locale } from '../engine/types';

// Locales genuinely safe to offer in the running header's language toggle: a
// locale only appears here once src/content/<locale>/ holds a real, non-aliased
// corpus (see src/content/index.ts's loader).
export const AVAILABLE_LOCALES: Locale[] = ['en', 'it'];
// T19 appended 'it' (full transcreation, src/content/it/). T20 appends 'es'.

/**
 * A stored (persisted) locale choice always wins. Otherwise, prefix-match
 * `navLang` (e.g. `navigator.language`) against the two-letter locale codes;
 * anything else (including no navLang at all) falls back to English.
 */
export function detectLocale(navLang: string | undefined, stored: Locale | null): Locale {
  if (stored) return stored;

  const prefix = navLang?.slice(0, 2).toLowerCase();
  if (prefix === 'it') return 'it';
  if (prefix === 'es') return 'es';
  return 'en';
}
