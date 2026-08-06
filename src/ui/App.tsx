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
import type { TFunction } from '../i18n/t';
import { gameStore, useGameStore } from '../game/store';
import { createEngineClient, type EngineClient } from '../game/engineClient';
import { isPractice, localIsoDate } from '../game/daily';
import { isStorageOff } from '../game/storage';
import { AppNavContext, type AppNav } from './nav';
import { JOURNAL_VOLUME } from './masthead';
import StatsScreen from './screens/Stats';
import LegendScreen from './screens/Legend';
import AboutScreen from './screens/About';
import './App.css';

/** The header nav's own page-state — orthogonal to game/store.ts's `Screen`
 * union entirely. 'game' renders whatever `children` is (the running game
 * machine, whatever screen IT is on); the other three replace <main>'s
 * content with a standalone nav page until its own close button returns here. */
type NavPage = 'game' | 'stats' | 'legend' | 'about';

/** The skip link's target (gr6-017) and R6.6's focus container: one element,
 * one id, so the anchor can never point at a node that is not the one focus
 * management already owns. */
const MAIN_ID = 'ph-main';

/** How often the midnight-rollover check below runs while the tab is
 * foregrounded. A minute is far finer than the thing it watches (a date
 * boundary) and coarse enough to cost nothing; the `visibilitychange`
 * listener beside it is what covers a backgrounded tab, whose timers the
 * browser throttles to minutes anyway. */
const ROLLOVER_CHECK_MS = 60_000;

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
  // T40 (FINDING F2 — see store.ts's own doc comment on `booted`): the
  // loading gate below reads this, not `content`/`copy` alone, so the shell
  // never mounts the Briefing (or anything else) on scenario #0's
  // placeholder data before the worker has actually assembled today's day.
  // `storeError` covers the OTHER way the wait can end: a boot that fails
  // outright (client.init() rejects, or the synchronous createEngineClient()
  // throw below routes here too) never sets `booted`, and a spinner that
  // waits forever for a day that will never arrive is worse than the ONE
  // screen this app already knows how to show for that — ScreenRouter's own
  // error banner, layered on whatever's underneath, exactly as it already is
  // for every OTHER crash in this game.
  const booted = useGameStore((s) => s.booted);
  const storeError = useGameStore((s) => s.error);
  // T35: read ONLY to key the <main> transition below (DESIGN.md R5.2 site
  // 1). App does not route on this and never has — ScreenRouter still owns
  // which screen renders; this is the animation hook, nothing more.
  const gameScreen = useGameStore((s) => s.screen);
  const didBootRef = useRef(false);
  const clientRef = useRef<EngineClient | null>(null);
  const [page, setPage] = useState<NavPage>('game');
  /**
   * gr6-080 — `isStorageOff()` is a module-level mutable `let` in
   * storage.ts, and this component used to CALL IT DURING RENDER. That is the
   * textbook React-19 tearing shape: an external mutable value read straight
   * out of the render body has no subscription, so React is free to render
   * with one value and commit with another, and today it works only by the
   * accident that the flag flips inside the very first `loadState()` — before
   * this component's first paint. Nothing in the file said so, and any future
   * lazy first read would flip it mid-session with no re-render to show it.
   *
   * `useState`'s lazy initialiser reads it ONCE, at mount, into state that
   * React owns; the boot effect below re-reads it after the store's own first
   * storage access, which is the only other moment it can change. That is
   * R18-safe without reaching into storage.ts to add the `subscribe` half a
   * `useSyncExternalStore` would need (the flag is one-way — false -> true,
   * never back — so a second read is a complete answer, not a poll).
   */
  const [storageOff, setStorageOff] = useState(() => isStorageOff());

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

  // Guarded by a ref, and the ref is LOAD-BEARING rather than the "cheap
  // insurance" an earlier version of this comment called it. `content`'s
  // reference does change mid-session, by design: the header's own
  // LocaleToggle calls setLocale, LocaleProvider fetches that locale's bundle
  // and hands down a new `content` object, and this effect's dependency array
  // fires again the moment it lands. Without the ref that second run would
  // call boot() — which begins `set({ ...initialState(), … })` — and a player
  // who switched to Italian three knobs into the day would silently lose the
  // day. The ref is the only thing standing between the language menu and
  // that reset. (A locale switch does not need a re-boot: the puzzle is the
  // same puzzle in every language; only the strings around it change.)
  useEffect(() => {
    if (!content || didBootRef.current) return;
    didBootRef.current = true;
    try {
      const client = createEngineClient();
      // Held so the midnight-rollover effect below can re-boot on the SAME
      // worker. createEngineClient() has no dispose, so calling it a second
      // time would leak the first one for the rest of the session.
      clientRef.current = client;
      void boot(client, localIsoDate(), {
        practice: isPractice(window.location.search),
        mode: 'hack',
        scenarioCount: content.scenarios.length,
      });
    } catch (err) {
      gameStore.setState({ error: err instanceof Error ? err.message : String(err) });
    }
    // gr6-080's second read: boot() is what first touches localStorage, so
    // this is the one moment the one-way flag can have flipped since mount.
    setStorageOff(isStorageOff());
  }, [content, boot]);

  /**
   * MIDNIGHT (W6's booked staleness note, W7's ruling).
   *
   * `localIsoDate()` is read exactly once, at boot. A tab left open across
   * midnight therefore keeps yesterday's day: yesterday's scenario, yesterday's
   * Grantwell email, yesterday's issue number in the masthead, and a countdown
   * to a rollover that has already happened (W6 suppressed the countdown,
   * correctly, but that treats the symptom this effect owns).
   *
   * THE RULING, and what it deliberately does not do. A re-boot is a
   * `set({ ...initialState(), … })`: it is the right answer for a tab that
   * has been sitting on the briefing overnight and the WRONG answer for
   * anything else, because it would take a half-hacked spec, a finished
   * summary or an open reveal away from the player at the exact moment they
   * came back to it. So the rollover is honoured at ONE resting state — the
   * briefing, with nothing yet done (`log.length === 0`) — and ignored
   * everywhere else. A player mid-day at midnight finishes the day they
   * started, which is the courteous answer and also the one that loses no
   * work; the store's own `alreadyPlayedToday`/finished-day logic picks the
   * new day up on their next visit.
   *
   * BOOKED FOR W2 + a follow-up: the mid-play case has no affordance at all
   * (no "a new puzzle is ready — reload" line), because that sentence is copy
   * this catalog does not have. The keys are `errors.newDay` and
   * `errors.reload`; when they land, this effect is where the notice hangs.
   *
   * The check runs on an interval AND on `visibilitychange`, because a
   * backgrounded tab's timers are throttled to the point of uselessness and
   * "came back to it" is exactly the moment that matters.
   */
  useEffect(() => {
    if (!content) return undefined;
    function checkRollover() {
      const client = clientRef.current;
      if (!client || !content) return;
      const state = gameStore.getState();
      if (!state.booted || state.iso === localIsoDate()) return;
      if (state.screen !== 'briefing' || state.log.length > 0) return;
      void boot(client, localIsoDate(), {
        practice: isPractice(window.location.search),
        mode: state.mode,
        scenarioCount: content.scenarios.length,
      });
    }
    const handle = setInterval(checkRollover, ROLLOVER_CHECK_MS);
    document.addEventListener('visibilitychange', checkRollover);
    return () => {
      clearInterval(handle);
      document.removeEventListener('visibilitychange', checkRollover);
    };
  }, [content, boot]);

  // Loading-gate convention (ratified by the controller alongside T4): content
  // is null for one async tick while the locale bundle loads. Nothing below
  // this line may render until it resolves — not the header, not `children` —
  // because `t()` falls back to raw copy *keys* pre-load, and rendering those
  // would be exactly the "text flash" this gate exists to prevent.
  if (!content || !copy) {
    return <div className="ph-app" aria-busy="true" data-testid="app-loading" />;
  }

  // T40 (FINDING F2): content loading is necessary but not sufficient. Until
  // store.booted flips true (or boot has failed outright — see `storeError`
  // above), `scenarioIndex`/`iso`/`puzzleNumber` are still initialState()'s
  // placeholders, and mounting the Briefing here is exactly the bug the T23
  // report measured: the WRONG study's question, cover story and Grantwell
  // email, for up to ~120ms on a fast desktop and longer on a phone. Same
  // placeholder element as the gate above (same data-testid, same
  // aria-busy), extended rather than duplicated — but THIS phase can safely
  // carry `t('a11y.loading')` as its accessible name, because content/copy
  // are already loaded and t() no longer falls back to a raw key. `a11y.loading`
  // has existed, translated in all three locales, since before this task;
  // nothing rendered it until now. role="status" (not "alert" — this is
  // ordinary progress, not urgent) mirrors PValueDial's own
  // role="status"/aria-busy pairing (DESIGN.md/T22), so it is announced the
  // same way the rest of the app announces "something is in flight."
  if (!booted && !storeError) {
    return (
      <div
        className="ph-app"
        aria-busy="true"
        data-testid="app-loading"
        role="status"
        aria-label={t('a11y.loading')}
      />
    );
  }

  /**
   * gr6-007 (BLOCKER) — A BOOT FAILURE MUST NOT RENDER A STUDY.
   *
   * Until this gate, `storeError && !booted` fell straight through to the
   * full shell, and the shell mounted ScreenRouter, and ScreenRouter mounted
   * the Briefing — on `initialState()`'s placeholders. So the one screen a
   * player saw when the engine failed to start was a REAL-LOOKING briefing
   * for scenario #0: the wrong question, the wrong cover story, the wrong
   * Grantwell email, the wrong issue number, and a live "Open the data" CTA
   * into a Lab that can never compute a single p-value (nothing ever answers
   * runSpec, so the dial sits on "—" forever and SUBMIT never enables). The
   * error banner rendered above all of that as a one-line aside, which is
   * exactly the wrong weight: this is not an error that happened DURING a day,
   * it is the absence of a day.
   *
   * The error is now the whole screen. `!booted` is the load-bearing half of
   * the condition — an engine crash MID-DAY (booted already true) keeps the
   * additive banner over the screen the player is on, because there the state
   * behind it is real and their day is recoverable; only a boot that never
   * produced a day takes the page.
   *
   * The reload control is the one the copy has promised all along
   * ("Reloading usually fixes it"). Its label is a STAND-IN: `nav.play`,
   * shipped and translated in all three locales, until W2 lands the
   * `errors.reload` key its own batch already lists for this row. It renders
   * here and nowhere else — this screen has no header and no nav — so it
   * cannot collide with the header's own PLAY.
   */
  if (!booted && storeError) {
    return (
      <div className="ph-app">
        {/* Same keyed, focusable, animated <main> as the shell's own below
            (R5.2 site 1, R6.6): this is a screen like any other, and it must
            arrive the same way rather than teleporting in. */}
        <main className="ph-screen" id={MAIN_ID} key={screenKey} ref={mainRef} tabIndex={-1}>
          <section className="ph-boot-error" data-testid="app-boot-error">
            {/* R6.6: every screen carries exactly one <h1>, its own title.
                This screen's title is what went wrong. */}
            <h1 className="ph-boot-error__title">{t('errors.workerCrash')}</h1>
            <button
              type="button"
              className="ph-boot-error__reload"
              data-testid="app-boot-error-reload"
              onClick={() => window.location.reload()}
            >
              {t('nav.play')}
            </button>
          </section>
        </main>
      </div>
    );
  }

  // storePuzzleNumber is 0 (initialState()'s default) until boot() resolves,
  // so this prefers the prop until then and switches over exactly once the
  // store has a real number of its own.
  const displayedPuzzleNumber = storePuzzleNumber || puzzleNumber;

  const backToGame = () => setPage('game');
  const nav: AppNav = { viewStats: () => setPage('stats') };

  return (
    <div className="ph-app">
      {/* gr6-017 — NINE TAB STOPS OF CHROME, ON EVERY SCREEN.
          Measured: the masthead, four nav buttons, two theme options and
          three locale options all sit ahead of the first control a player
          actually came for, on every screen, with no way past them. A
          keyboard or switch player pays that toll on every screen change,
          because R6.6 rebuilds <main> on each one and focus starts over.
          The standard fix and the first thing a screen-reader user reaches
          for: a skip link as the very first child, hidden until it takes
          focus. It reuses R6.6's own `.ph-visually-hidden` idiom (so the
          1px clipped box stays the one place that value is typed) and
          .ph-skip-link:focus un-hides it; the target is the <main> element
          that is already `tabindex="-1"` for R6.6's focus management, so
          there is no new focus target and no new tab stop.
          TODO-W2: the label is a stand-in — `nav.play`, shipped in all three
          locales. W2's own batch lists a skip-link key for this row;
          `a11y.skipToContent` ("Skip to today's puzzle") is what this
          element wants, and it is a one-word edit here when it lands. */}
      <a className="ph-visually-hidden ph-skip-link" href={`#${MAIN_ID}`} data-testid="app-skip-link">
        {t('nav.play')}
      </a>
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
            <button type="button" className="ph-seg" aria-pressed={page === 'stats'} onClick={() => setPage('stats')}>
              {t('nav.stats')}
            </button>
            <button type="button" className="ph-seg" aria-pressed={page === 'legend'} onClick={() => setPage('legend')}>
              {t('nav.legend')}
            </button>
            <button type="button" className="ph-seg" aria-pressed={page === 'about'} onClick={() => setPage('about')}>
              {t('nav.about')}
            </button>
            {/* The second affordance, and the explicit one: on screen for
                exactly as long as a nav page is, so "get me back" is never a
                thing the player has to deduce. An ACTION, not a page — hence
                no aria-pressed (there is no state it could report).

                gr6-060 — LAST IN THE ROW, not first. PLAY used to be inserted
                at the HEAD of this nav, so the instant a player pressed
                "Stats" every remaining item shifted right by the width of the
                word "Play" — and the next tap, aimed at Legend, landed on
                Stats. Measured at 320 the header also grew 267 -> 318px, which
                the owner has ruled acceptable as-is (rulings 2026-08-06, #2);
                the buttons moving under the finger is the part that is not,
                and appending rather than prepending fixes it with no
                always-rendered inert control and no reserved gap. Stats,
                Legend and About now keep their coordinates for the whole
                session. */}
            {page === 'game' ? null : (
              <button type="button" className="ph-seg ph-seg--action" onClick={backToGame}>
                {t('nav.play')}
              </button>
            )}
          </nav>
          <ThemeToggle theme={theme} setTheme={setTheme} t={t} />
          <LocaleToggle locales={AVAILABLE_LOCALES} locale={locale} setLocale={setLocale} t={t} />
        </div>
      </header>
      {/* T40 (FINDING F1): errors.storageOff was written, translated in all
          three locales, and unit-tested via storage.ts's own isStorageOff()
          — but nothing under src/ui/** ever rendered it, so a player whose
          browser blocks localStorage (site data blocked, an iOS private
          tab) played, scored and streaked an entire day into the in-memory
          fallback and was told nothing before it all evaporated on reload.
          Rendered in the shell, above <main>, so it is visible on every
          screen — the Briefing included — never only some of them; reads
          isStorageOff() directly on every render rather than caching it in
          state, which is correct because storageOff is a ONE-WAY flag
          (storage.ts: false -> true, never back) and this component already
          re-renders constantly during boot/play. A quiet manuscript line,
          not a modal: nothing about it blocks play, so there is nothing to
          dismiss it FROM — role="status" (not "alert": this is not urgent,
          the game is fully playable) and --muted register (R1.2: captions,
          footnotes and this notice, never --ink) are the whole treatment. */}
      {storageOff ? (
        <p className="ph-storage-notice" role="status">
          {t('errors.storageOff')}
        </p>
      ) : null}
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
      <main className="ph-screen" id={MAIN_ID} key={screenKey} ref={mainRef} tabIndex={-1}>
        {/* gr6-062's other half: the shell owns the nav page-state, so the
            shell is what can hand a machine screen a route to it. Provided
            around <main> only — the header's own controls call setPage
            directly and need nothing from a context. */}
        <AppNavContext.Provider value={nav}>
          {page === 'game' && children}
          {page === 'stats' && <StatsScreen onClose={backToGame} />}
          {page === 'legend' && <LegendScreen onClose={backToGame} />}
          {page === 'about' && <AboutScreen onClose={backToGame} />}
        </AppNavContext.Provider>
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
          {/* gr6-024: neither span carries a rule — .ph-seg--locale's
              inline-flex row and its --space-4 gap are the whole layout (see
              App.css's own note on why the gap is not a space character) —
              so neither carries a class. */}
          <span aria-hidden="true">{LOCALE_FLAG[loc]}</span>
          <span>{loc.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
