// The app shell (master spec §7.1/§7.3, DESIGN.md throughout): the running
// header ("P-hackle · Vol. 1, No. {puzzleNumber}"), the theme and locale
// toggles, and the <main> slot ScreenRouter renders into.
//
// T14 wiring: once T5's loading gate has resolved (content loaded), boot the
// engine exactly once — `createEngineClient()` + `store.boot(...)` — using
// today's local ISO date, practice-mode detection (`?practice=1` OR "today is
// before EPOCH", both handled by daily.isPractice), hack mode, and the
// loaded locale's own scenario count. `client.onCrash` -> store.error is
// already wired INSIDE store.boot() itself (see store.ts); the try/catch
// below extends that same store.error -> errors.workerCrash path to cover
// createEngineClient() itself throwing synchronously (e.g., an environment
// with no Worker support at all) — a real, if rare, failure mode, and
// notably the ONLY way T5's pre-existing shell.test.tsx (which renders
// <App> directly, unmocked) keeps passing: jsdom has no global Worker, so an
// uncaught throw here would otherwise crash every one of those renders.
//
// T17 adds the header's stats/legend/about nav: a tiny LOCAL page-state
// (useState below), deliberately NOT the game machine's own `screen` — see
// src/ui/screens/registry.t17.patch.md for the full integration note (this
// is App.tsx's half of it; merged with T14's boot wiring at integration).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, type Theme } from '../i18n/LocaleProvider';
import { AVAILABLE_LOCALES } from '../i18n/locale';
import type { Locale } from '../engine/types';
import type { CopyKey } from '../content/en/copy';
import { gameStore, useGameStore } from '../game/store';
import { createEngineClient } from '../game/engineClient';
import { isPractice, localIsoDate } from '../game/daily';
import { JOURNAL_VOLUME } from './masthead';
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
  /** Pre-boot fallback: main.tsx's own `puzzleNumber(localIsoDate())`, which
   * is synchronously correct even before the engine has booted. Once the
   * store's own boot() resolves, the header prefers ITS puzzleNumber (the
   * same formula, but the single source of truth from then on) — see
   * `displayedPuzzleNumber` below. Kept as a required prop (rather than
   * folded away entirely) so this component still renders its header
   * correctly in isolation, before any boot has ever happened — exactly
   * tests/ui/shell.test.tsx's own use of it. */
  puzzleNumber: number;
  children?: ReactNode;
}

export default function App({ puzzleNumber, children }: AppProps) {
  const { content, copy, t, theme, setTheme, locale, setLocale } = useLocale();
  const boot = useGameStore((s) => s.boot);
  const storePuzzleNumber = useGameStore((s) => s.puzzleNumber);
  // T35: read ONLY to key the <main> transition below (DESIGN.md R5.2 site
  // 1). App does not route on this and never has — ScreenRouter still owns
  // which screen renders; this is the animation hook, nothing more.
  const gameScreen = useGameStore((s) => s.screen);
  const didBootRef = useRef(false);
  const [page, setPage] = useState<NavPage>('game');

  // T22 — FOCUS MANAGEMENT ACROSS THE ONE ROUTE CHANGE THIS APP HAS.
  //
  // `<main>` below is keyed, so React tears the old element down and builds a
  // new one on every screen/page swap (T35's transition, R5.2 site 1). The
  // element the player had focused — an "Open the data", a "Face the truth",
  // a "See the invoice" — goes with it, and the browser is left with a
  // sequential-navigation starting point in a node that no longer exists.
  // Measured in real Chrome against this build before this task:
  // document.activeElement was <body> after EVERY transition (briefing->lab,
  // lab->published, call->reveal, reveal->summary, nav page->game), and the
  // first Tab afterwards resumed roughly where the removed button had been —
  // so the running header was silently skipped, and a screen reader was left
  // with no announcement that the page had changed at all.
  //
  // The standard fix, and the smallest one: move focus to the new <main>
  // itself (tabIndex={-1} makes it programmatically focusable without adding
  // a tab stop). A screen reader announces the new screen's landmark and
  // reads from its top; Tab from there enters the new content in document
  // order; Shift+Tab reaches the header. Nothing about the transition
  // animation changes — the focus call is instant and paints no motion of its
  // own (App.css declares the ring with no transition, R5.5), and the
  // entrance keyframe runs on the same element either way.
  //
  // NOT on the first mount: focus starts at the top of the document on load,
  // which is exactly where it should be. `screenKey` is compared against the
  // previous render's, so the effect fires only on a genuine change.
  const screenKey = page === 'game' ? `game:${gameScreen}` : page;
  const mainRef = useRef<HTMLElement | null>(null);
  const prevScreenKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = prevScreenKeyRef.current;
    prevScreenKeyRef.current = screenKey;
    if (previous === null || previous === screenKey) return;
    mainRef.current?.focus();
  }, [screenKey]);

  // Guarded by a ref (not only the dependency array): `content`'s reference
  // never actually changes mid-session in any of today's flows (locale
  // never switches after first load), but the ref is cheap insurance against
  // ever booting — and silently resetting the player's progress — twice.
  useEffect(() => {
    if (!content || didBootRef.current) return;
    didBootRef.current = true;
    try {
      const client = createEngineClient();
      void boot(client, localIsoDate(), {
        practice: isPractice(window.location.search),
        mode: 'hack',
        scenarioCount: content.scenarios.length,
      });
    } catch (err) {
      gameStore.setState({ error: err instanceof Error ? err.message : String(err) });
    }
  }, [content, boot]);

  // Loading-gate convention (ratified by the controller alongside T4): content
  // is null for one async tick while the locale bundle loads. Nothing below
  // this line may render until it resolves — not the header, not `children` —
  // because `t()` falls back to raw copy *keys* pre-load, and rendering those
  // would be exactly the "text flash" this gate exists to prevent.
  if (!content || !copy) {
    return <div className="ph-app" aria-busy="true" data-testid="app-loading" />;
  }

  // storePuzzleNumber is 0 (initialState()'s default) until boot() resolves,
  // so this prefers the prop until then and switches over exactly once the
  // store has a real number of its own.
  const displayedPuzzleNumber = storePuzzleNumber || puzzleNumber;

  const backToGame = () => setPage('game');

  return (
    <div className="ph-app">
      <header className="ph-header">
        <p className="ph-header__masthead">
          {/* T33 (owner: "hard to go back to the main page when you click one
              of the menus"): the masthead is a real control, not a label —
              the oldest convention on the web, and the one a player reaches
              for first. It only ever changes THIS component's page-state, so
              pressing it mid-day resumes the running machine exactly where
              the store left it; it can no more restart the day than closing
              a dialog can. The accessible name opens with the wordmark so
              the visible label survives inside it (WCAG 2.5.3).
              The wordmark is the one permitted raw string besides emoji. */}
          <button type="button" className="ph-header__home" aria-label={t('a11y.backToGame')} onClick={backToGame}>
            <span className="ph-header__wordmark">P-hackle</span>
          </button>
          <span className="ph-header__vol">
            {t('briefing.vol', { volume: JOURNAL_VOLUME, issue: displayedPuzzleNumber })}
          </span>
        </p>
        <div className="ph-header__controls">
          {/* T22: a real <nav> landmark, not a bare div. This is the app's
              only navigation region, so it needs no aria-label to be
              unambiguous — a single navigation landmark is named by its role.
              The theme/locale controls beside it stay role="group": they
              choose a setting, they do not navigate anywhere. */}
          <nav className="ph-header__nav">
            {/* The second affordance, and the explicit one: on screen for
                exactly as long as a nav page is, so "get me back" is never a
                thing the player has to deduce. An ACTION, not a page — hence
                no aria-pressed (there is no state it could report). */}
            {page === 'game' ? null : (
              <button type="button" className="ph-seg ph-seg--action" onClick={backToGame}>
                {t('nav.play')}
              </button>
            )}
            <button type="button" className="ph-seg" aria-pressed={page === 'stats'} onClick={() => setPage('stats')}>
              {t('nav.stats')}
            </button>
            <button type="button" className="ph-seg" aria-pressed={page === 'legend'} onClick={() => setPage('legend')}>
              {t('nav.legend')}
            </button>
            <button type="button" className="ph-seg" aria-pressed={page === 'about'} onClick={() => setPage('about')}>
              {t('nav.about')}
            </button>
          </nav>
          <ThemeToggle theme={theme} setTheme={setTheme} t={t} />
          <LocaleToggle locales={AVAILABLE_LOCALES} locale={locale} setLocale={setLocale} t={t} />
        </div>
      </header>
      {/* T35 — DESIGN.md R5.2 site 1, the product's ONE screen-transition
          site. `key` is the whole reason this exists: React tears the <main>
          element down and builds a new one whenever the key changes, which
          restarts .ph-screen's entrance animation. One wrapper covers BOTH
          state machines that can change what fills the page — the game's own
          `screen` (briefing -> lab -> published -> call -> reveal -> summary)
          and this component's nav `page` (game/stats/legend/about) — so the
          two never animate on top of each other, and no extra DOM node is
          introduced for it: the landmark <main> already had to be here.
          Nothing else about the element changes; a screen swap that used to
          teleport now lands. */}
      <main className="ph-screen" key={screenKey} ref={mainRef} tabIndex={-1}>
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

/**
 * T33 (owner: "the dark/paper color selection should be more clear"). This
 * was a single flip-flop button showing ONE word — which is a control you
 * have to press to find out what it does, and whose one word is ambiguous
 * besides ("Paper": am I on paper, or am I being offered paper?). It is now
 * the same two-option segmented group as the locale toggle: both choices are
 * on screen at all times, so the control names what it does (theme) and
 * which side is live, with no hover and no guessing.
 *
 * R6.3 (no state by colour alone) holds three times over: the active option
 * carries `aria-pressed`, R4.6's 2px --ink underline, AND full --ink against
 * the inactive option's --muted. No new colour is introduced — both are
 * registered text tokens — and nothing here transitions (R5.5).
 */
export function ThemeToggle({ theme, setTheme, t }: ThemeToggleProps) {
  return (
    <div className="ph-theme-toggle" role="group" aria-label={t('a11y.themeToggle')}>
      <button
        type="button"
        className="ph-seg"
        aria-pressed={theme === 'paper'}
        onClick={() => setTheme('paper')}
      >
        {t('nav.themePaper')}
      </button>
      <button type="button" className="ph-seg" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
        {t('nav.themeDark')}
      </button>
    </div>
  );
}

/** Flag glyphs are DECORATION, never the label (see LocaleToggle below). */
const LOCALE_FLAG: Record<Locale, string> = {
  en: '🇬🇧',
  it: '🇮🇹',
  es: '🇪🇸',
};

/** Each locale's own endonym, the buttons' accessible name. */
const LOCALE_NAME_KEY: Record<Locale, CopyKey> = {
  en: 'nav.localeNameEn',
  it: 'nav.localeNameIt',
  es: 'nav.localeNameEs',
};

interface LocaleToggleProps {
  locales: Locale[];
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

/**
 * Hidden while only one locale exists (T4's design); `locales` is a prop
 * specifically so this is testable with a fabricated multi-locale array
 * without reaching for module mocking.
 *
 * T33 (owner: "the language menu should have a little flag"): flag AND code,
 * never a flag alone. Windows Chrome ships no flag glyphs at all and renders
 * a regional-indicator pair as the bare letters "GB"/"IT"/"ES", so a
 * flag-only menu degrades to three unlabelled letter pairs on a large share
 * of desktops; the code text is what keeps it legible there and the flag is
 * what makes it findable everywhere else. The flag is `aria-hidden` — a
 * screen reader gets the language's own endonym instead, which is the one
 * name a speaker of that language can recognise.
 */
export function LocaleToggle({ locales, locale, setLocale, t }: LocaleToggleProps) {
  if (locales.length <= 1) return null;

  return (
    <div className="ph-locale-toggle" role="group" aria-label={t('a11y.localeToggle')}>
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className="ph-seg ph-seg--locale"
          aria-pressed={loc === locale}
          aria-label={t(LOCALE_NAME_KEY[loc])}
          onClick={() => setLocale(loc)}
        >
          <span className="ph-seg__flag" aria-hidden="true">
            {LOCALE_FLAG[loc]}
          </span>
          <span className="ph-seg__code">{loc.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
