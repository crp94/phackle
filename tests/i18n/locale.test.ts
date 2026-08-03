import { describe, expect, it } from 'vitest';
import { detectLocale } from '../../src/i18n/locale';
import { t } from '../../src/i18n/t';
import { copy, type CopyKey } from '../../src/content/en/copy';

describe('detectLocale', () => {
  it('detects Italian from a navigator.language prefix', () => {
    expect(detectLocale('it-IT', null)).toBe('it');
  });

  it('detects Spanish from a navigator.language prefix', () => {
    expect(detectLocale('es-MX', null)).toBe('es');
  });

  it('falls back to English for an unsupported language', () => {
    expect(detectLocale('fr-FR', null)).toBe('en');
  });

  it('falls back to English when navLang is undefined', () => {
    expect(detectLocale(undefined, null)).toBe('en');
  });

  it('prefers a stored locale over the navigator language', () => {
    expect(detectLocale('it-IT', 'es')).toBe('es');
  });

  it('prefers a stored locale even when it agrees with an unrelated navLang', () => {
    expect(detectLocale('fr-FR', 'it')).toBe('it');
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
