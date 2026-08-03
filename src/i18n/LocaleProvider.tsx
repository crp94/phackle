// React binding for the locale layer (delta spec i18n §2-3), extended (task
// T5) to also own the theme setting. Owns: which locale/theme is active,
// loading the locale's content, persisting an explicit switch of either, and
// keeping <html lang> and <html data-theme> in sync. UI components never
// touch navigator.language, matchMedia, localStorage, <html lang> or
// <html data-theme> directly — they go through useLocale().
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../engine/types';
import type { LocaleContent } from '../content/types';
import type { CopyKey } from '../content/en/copy';
import { detectLocale } from './locale';
import { t as translate } from './t';
import { getContent } from '../content';

// The locale choice is persisted in the localStorage `settings` object (delta
// spec i18n §2). The storage layer proper (versioned `phackle.v1` schema)
// belongs to a later task (master spec §5.6); this reads/writes are merged
// with whatever is already under this key so they don't clobber other
// settings that land there later.
const STORAGE_KEY = 'phackle.settings';

// Master spec §5.6 names this exact union for the persisted settings field:
// `settings: { reducedMotion?: boolean, theme?: 'paper'|'dark' } }`. 'paper' is
// this app's own name for its light theme (it matches the --paper token and
// the "warm-paper academia" register DESIGN.md describes) — it is a settings-
// schema name, not a CSS value. DESIGN.md R7.1 separately fixes the *DOM*
// contract: `<html data-theme="light|dark">`. domTheme() below is the one
// place these two vocabularies meet.
export type Theme = 'paper' | 'dark';

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'it' || value === 'es';
}

function isTheme(value: unknown): value is Theme {
  return value === 'paper' || value === 'dark';
}

// Reached through `window.localStorage` explicitly (never the bare
// `localStorage` global): newer Node versions define their own file-backed
// `globalThis.localStorage`, which a jsdom test environment cannot shadow as
// a bare identifier — but `window.localStorage` still resolves to jsdom's
// (or, in a real browser, the browser's) implementation either way.
function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { locale?: unknown } | null;
    return isLocale(parsed?.locale) ? parsed.locale : null;
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, locale }));
  } catch {
    // Storage unavailable (private browsing, quota, disabled entirely) — the
    // choice just won't survive a reload this session. errors.storageOff
    // covers the user-facing copy for this failure class.
  }
}

// Same key, same merge-safe read/write pattern as locale above — the settings
// blob carries both fields side by side (do NOT invent a second storage key).
function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { theme?: unknown } | null;
    return isTheme(parsed?.theme) ? parsed.theme : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, theme }));
  } catch {
    // See writeStoredLocale above — the choice just won't survive a reload.
  }
}

/** DESIGN.md R7.1: "falling back to matchMedia('(prefers-color-scheme: dark)')" —
 * the *only* time this is consulted is when there is no explicit stored choice. */
function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'paper';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'paper';
}

/** The one place the settings-schema name ('paper'/'dark', master spec §5.6)
 * is translated into the DOM contract DESIGN.md R7.1 fixes exactly:
 * `<html data-theme="light|dark">`. */
function domTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'dark' ? 'dark' : 'light';
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** null while the locale's content bundle is still loading (dynamic import in flight). */
  content: LocaleContent | null;
  /** Shorthand for content?.copy; null while loading. */
  copy: Record<CopyKey, string> | null;
  t: (key: CopyKey, params?: Record<string, string | number>) => string;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    detectLocale(typeof navigator === 'undefined' ? undefined : navigator.language, readStoredLocale())
  );
  // Keyed by the locale it was fetched for, so a switch is detectable without
  // ever setState-ing synchronously inside the effect body below (only the
  // async .then() callback sets state, which is the pattern react-hooks/
  // set-state-in-effect wants): while `loaded.locale !== locale`, the fetch
  // for the current locale is still in flight, and `content` below derives to null.
  const [loaded, setLoaded] = useState<{ locale: Locale; content: LocaleContent } | null>(null);
  const content = loaded?.locale === locale ? loaded.content : null;

  // Load (or reload, on a locale switch) the active locale's content bundle.
  useEffect(() => {
    let cancelled = false;
    void getContent(locale).then((loadedContent) => {
      if (!cancelled) setLoaded({ locale, content: loadedContent });
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Keep <html lang> in sync (delta spec i18n §2; a11y requirement).
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? systemTheme());

  // DESIGN.md R7.1: "written at boot ... CSS never guesses." A layout effect
  // (not a plain effect) commits the attribute before the browser paints, so
  // an explicit dark preference doesn't flash paper-light first.
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', domTheme(theme));
    }
  }, [theme]);

  const setLocale = (next: Locale) => {
    writeStoredLocale(next);
    setLocaleState(next);
  };

  const setTheme = (next: Theme) => {
    writeStoredTheme(next);
    setThemeState(next);
  };

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      content,
      copy: content?.copy ?? null,
      t: (key, params) => (content ? translate(content.copy, key, params) : key),
      theme,
      setTheme,
    }),
    [locale, content, theme]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// The brief's file contract co-locates the provider and its hook in one
// module; this is the standard context+hook pairing, not an accidental mixed
// export, so the Fast Refresh boundary warning is suppressed for just this line.
// eslint-disable-next-line react-refresh/only-export-components
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
