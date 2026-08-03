// The app shell (master spec §7.1/§7.3, DESIGN.md throughout): the running
// header ("P-hackle · Vol. 1, No. {puzzleNumber}"), the theme and locale
// toggles, and the <main> slot later screen tasks render into. Store-agnostic
// by design (T12's store isn't merged yet) — puzzleNumber arrives as a prop.
//
// T17 adds the header's stats/legend/about nav: a tiny LOCAL page-state
// (useState below), deliberately NOT the game machine's own `screen` — see
// src/ui/screens/registry.t17.patch.md for the full integration note (this
// is App.tsx's half of it).
import { useState, type ReactNode } from 'react';
import { useLocale, type Theme } from '../i18n/LocaleProvider';
import { AVAILABLE_LOCALES } from '../i18n/locale';
import type { Locale } from '../engine/types';
import type { CopyKey } from '../content/en/copy';
import StatsScreen from './screens/Stats';
import LegendScreen from './screens/Legend';
import AboutScreen from './screens/About';
import './App.css';

type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

/** The header nav's own page-state — orthogonal to game/store.ts's `Screen`
 * union entirely. 'game' renders whatever `children` is (the running game
 * machine, whatever screen IT is on); the other three replace <main>'s
 * content with a standalone nav page until its own close button returns here. */
type NavPage = 'game' | 'stats' | 'legend' | 'about';

export interface AppProps {
  /** Placeholder value until the store (T12) is merged: `puzzleNumber(localIsoDate())`. */
  puzzleNumber: number;
  children?: ReactNode;
}

export default function App({ puzzleNumber, children }: AppProps) {
  const { content, copy, t, theme, setTheme, locale, setLocale } = useLocale();
  const [page, setPage] = useState<NavPage>('game');

  // Loading-gate convention (ratified by the controller alongside T4): content
  // is null for one async tick while the locale bundle loads. Nothing below
  // this line may render until it resolves — not the header, not `children` —
  // because `t()` falls back to raw copy *keys* pre-load, and rendering those
  // would be exactly the "text flash" this gate exists to prevent.
  if (!content || !copy) {
    return <div className="ph-app" aria-busy="true" data-testid="app-loading" />;
  }

  const backToGame = () => setPage('game');

  return (
    <div className="ph-app">
      <header className="ph-header">
        <p className="ph-header__masthead">
          {/* The wordmark is the one permitted raw string besides emoji. */}
          <span className="ph-header__wordmark">P-hackle</span>
          <span className="ph-header__vol">{t('briefing.vol', { volume: 1, issue: puzzleNumber })}</span>
        </p>
        <div className="ph-header__controls">
          <div className="ph-header__nav">
            <button type="button" className="ph-seg" aria-pressed={page === 'stats'} onClick={() => setPage('stats')}>
              {t('nav.stats')}
            </button>
            <button type="button" className="ph-seg" aria-pressed={page === 'legend'} onClick={() => setPage('legend')}>
              {t('nav.legend')}
            </button>
            <button type="button" className="ph-seg" aria-pressed={page === 'about'} onClick={() => setPage('about')}>
              {t('nav.about')}
            </button>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} t={t} />
          <LocaleToggle locales={AVAILABLE_LOCALES} locale={locale} setLocale={setLocale} t={t} />
        </div>
      </header>
      <main>
        {page === 'game' && children}
        {page === 'stats' && <StatsScreen onClose={backToGame} />}
        {page === 'legend' && <LegendScreen onClose={backToGame} />}
        {page === 'about' && <AboutScreen onClose={backToGame} />}
      </main>
    </div>
  );
}

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: TFunction;
}

/** A single toggle button, not a segmented control: R6.3 is satisfied by the
 * visible text label (which names the current state) plus `aria-pressed`,
 * with no colour involved at all. */
export function ThemeToggle({ theme, setTheme, t }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="ph-toggle"
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? 'paper' : 'dark')}
    >
      {isDark ? t('nav.themeDark') : t('nav.themePaper')}
    </button>
  );
}

interface LocaleToggleProps {
  locales: Locale[];
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

/** Hidden while only one locale exists (T4's design); `locales` is a prop
 * specifically so this is testable with a fabricated multi-locale array
 * without reaching for module mocking. */
export function LocaleToggle({ locales, locale, setLocale, t }: LocaleToggleProps) {
  if (locales.length <= 1) return null;

  return (
    <div className="ph-locale-toggle" role="group" aria-label={t('a11y.localeToggle')}>
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className="ph-seg"
          aria-pressed={loc === locale}
          onClick={() => setLocale(loc)}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
