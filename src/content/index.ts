// Content loader (delta spec i18n §3: "Locales are loaded via dynamic import()
// so each session ships one language"). Dynamic import per locale keeps the
// IT/ES bundles out of an English session's network payload once T19/T20 give
// them real content.
import type { Locale } from '../engine/types';
import type { LocaleContent } from './types';

export async function getContent(locale: Locale): Promise<LocaleContent> {
  switch (locale) {
    case 'en':
      return (await import('./en')).content;
    case 'it':
      return (await import('./en')).content; // Replaced by T19
    case 'es':
      return (await import('./en')).content; // Replaced by T20
    default: {
      // Exhaustiveness guard: a new Locale member without a case here is a compile error.
      const exhaustive: never = locale;
      throw new Error(`getContent: unhandled locale "${String(exhaustive)}"`);
    }
  }
}
