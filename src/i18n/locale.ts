// Locale detection and availability (delta spec i18n §2). The engine never
// imports this (enforced by eslint.config.js's no-restricted-imports rule on
// src/engine/**) — locale is a presentation-layer concern only.
import type { Locale } from '../engine/types';

// Locales genuinely safe to offer in the running header's language toggle: a
// locale earns its place here only once getContent() resolves it to a real,
// fully translated content module rather than an alias of the English one
// (see src/content/index.ts's loader). 'it' qualified in T19 (src/content/it/),
// 'es' in T20 (src/content/es/) — all three corpora are full transcreations.
export const AVAILABLE_LOCALES: Locale[] = ['en', 'it', 'es'];

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
