// Locale detection and availability (delta spec i18n §2). The engine never
// imports this (enforced by eslint.config.js's no-restricted-imports rule on
// src/engine/**) — locale is a presentation-layer concern only.
import type { Locale } from '../engine/types';

// Locales genuinely safe to offer in the running header's language toggle.
// getContent() technically "works" for 'it'/'es' today (it aliases the English
// module — see src/content/index.ts), but nothing has actually been translated
// yet, so they stay off this list until T19/T20 land real content.
export const AVAILABLE_LOCALES: Locale[] = ['en', 'es'];
// T19 appends 'it'; T20 appended 'es' — only once real (non-aliased) content ships.

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
