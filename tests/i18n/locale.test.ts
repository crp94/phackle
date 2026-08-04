import { describe, expect, it } from 'vitest';
import { detectLocale } from '../../src/i18n/locale';
import { t } from '../../src/i18n/t';
import { copy, type CopyKey } from '../../src/content/en/copy';

// T33 (owner directive, round 5): the interface DEFAULTS TO ENGLISH. Browser
// auto-detection is gone — not merely deprioritised: the prefix-matching code
// path is deleted, and these tests pin its absence rather than its behaviour.
// The stored choice (the locale toggle in the header) is now the ONLY thing
// that can move the app off English.
describe('detectLocale', () => {
  it('returns the stored choice when there is one', () => {
    expect(detectLocale(undefined, 'it')).toBe('it');
    expect(detectLocale(undefined, 'es')).toBe('es');
    expect(detectLocale(undefined, 'en')).toBe('en');
  });

  it('prefers the stored choice over any navigator language, agreeing or not', () => {
    expect(detectLocale('it-IT', 'es')).toBe('es');
    expect(detectLocale('fr-FR', 'it')).toBe('it');
    expect(detectLocale('es-MX', 'en')).toBe('en');
  });

  it('defaults to English with nothing stored, whatever the navigator says', () => {
    for (const navLang of ['it-IT', 'it', 'es-MX', 'es', 'fr-FR', 'en-GB', '', undefined]) {
      expect(detectLocale(navLang, null), String(navLang)).toBe('en');
    }
  });
});

describe('t', () => {
  it('returns the plain string when there are no params to interpolate', () => {
    expect(t(copy, 'summary.streak')).toBe(copy['summary.streak']);
  });

  it('interpolates every supplied param', () => {
    expect(t(copy, 'summary.nextIn', { hours: 3, minutes: 12 })).toBe('Next puzzle in 3h 12m');
  });

  it('leaves an unsupplied param visible as the literal {token}', () => {
    expect(t(copy, 'summary.nextIn', { hours: 3 })).toBe('Next puzzle in 3h {minutes}m');
  });

  it('leaves all tokens visible when params is omitted entirely', () => {
    expect(t(copy, 'summary.nextIn')).toBe('Next puzzle in {hours}h {minutes}m');
  });

  it('returns the key itself for a key absent from the catalog (type-level unreachable; forced via cast)', () => {
    expect(t(copy, 'nonexistent.key' as CopyKey)).toBe('nonexistent.key');
  });
});
