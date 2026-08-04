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
 * A stored (persisted) locale choice always wins. With nothing stored, the
 * interface is ENGLISH — always, whatever the browser reports.
 *
 * T33 (owner directive, feedback round 5) supersedes the delta spec's §2
 * auto-detection: the prefix-match against `navigator.language` is DELETED,
 * not merely deprioritised, so there is no path by which a browser setting
 * can pick the game's language. `navLang` is kept in the signature (and
 * still passed by LocaleProvider) purely so the removal is a one-line
 * decision recorded here rather than a change rippling through every call
 * site; it is deliberately unread. The header's own locale toggle writes a
 * stored choice, which is now the only thing that moves the app off English.
 */
export function detectLocale(_navLang: string | undefined, stored: Locale | null): Locale {
  return stored ?? 'en';
}
