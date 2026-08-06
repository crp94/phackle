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
import { JOURNAL_VOLUME, issueLabel } from './masthead';
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
  // gr6-022: the header's practice marker, and the issue number it stands
  // next to (which a practice day does not have — src/ui/masthead.ts).
  const practice = useGameStore((s) => s.practice);
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
  /** gr6-021's sibling, W8: the local date has moved past the day the store
   * booted with AND the player is somewhere the rollover effect below
   * deliberately will not re-boot (i.e. mid-play). Set only from that same
   * effect, so the notice and the re-boot are decided by ONE reading of the
   * clock and can never contradict each other. */
  const [newDayPending, setNewDayPending] = useState(false);

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
   * briefing, with nothing yet done — and ignored everywhere else. A player
   * mid-day at midnight finishes the day they started, which is the courteous
   * answer and also the one that loses no work; the store's own
   * `alreadyPlayedToday`/finished-day logic picks the new day up on their next
   * visit.
   *
   * HOW "NOTHING YET DONE" IS TESTED, and why it is not `log.length === 0`
   * (w7-r-003, found while writing this effect's first test). It WAS
   * `log.length === 0`, and that condition can never hold: `store.boot()`
   * seeds one free `VIEW_SPEC` entry for the default spec (§2.10 — logged so
   * the fork trail has a first entry, never itself a fork), so a booted store
   * has `log.length === 1` before the player has touched anything. The whole
   * effect was therefore dead code — it never re-booted in ANY state, which
   * no test noticed because no test existed.
   *
   * `screen === 'briefing'` alone is the correct and complete test, and it is
   * stronger than the arithmetic it replaces: `'briefing'` is set in exactly
   * one place in the entire store — `initialState()` — and no transition ever
   * returns to it. Being on the briefing therefore MEANS the player has taken
   * no action today; `openData()` leaves for the Lab and `chooseMode()` for
   * Prereg, and neither has a way back. That includes the finished-day
   * briefing, where a re-boot is not merely safe but wanted: the block is
   * showing yesterday's result and the new day is exactly what should replace
   * it.
   *
   * THE MID-PLAY CASE, CLOSED (W8). It used to end here with nothing at all:
   * a player who crossed midnight three knobs into the Lab kept their day —
   * correctly — and was told nothing, while the masthead, the study, the
   * Grantwell email and the Summary's countdown all went on describing
   * yesterday. Both earlier bookings sketched the affordance as "a new puzzle
   * is ready — reload", and this notice does NOT carry the reload half,
   * deliberately: MID-PLAY nothing is persisted until the Summary, so a reload
   * is the DESTRUCTIVE action — the very thing the ruling above refuses to do
   * to the player — and offering it as a button would be handing them the
   * loaded gun this effect was written to keep pointed away. `errors.newDay`
   * (all three catalogs) is therefore a NOTICE and not a control: it says the
   * day in progress still counts as the day it started, and that today's
   * puzzle is waiting.
   *
   * AND THAT ARGUMENT STOPS AT EXACTLY ONE SCREEN (w8-r-001). `'summary'` is
   * excluded below, because everything the argument rests on is false there:
   * `SummaryScreen`'s first-mount effect has already run
   * `persistAndComputeSummary`, so the day is written before that screen ever
   * paints and a reload costs nothing; `errors.newDay`'s own sentence ends
   * "when you finish", which is addressed to somebody who has not; and W8's
   * countdown suppression had just removed the last line on that screen
   * pointing anywhere but backwards, leaving the finished day with NO ROUTE
   * AT ALL to the new one. The Summary therefore renders its own line, with
   * its own sentence and with `errors.reload` — see
   * `screens/Summary.tsx`'s `puzzleIsToday` block. This shell notice is for
   * the screens where the day can still be lost: lab, prereg, published, call
   * and reveal.
   *
   * `newDayPending` is set from the SAME check, which is what keeps the notice
   * and the re-boot from ever disagreeing: at most one of them can be true of
   * a given tick, and both are cleared the moment the store's `iso` is today
   * again (whether this effect re-booted or the player reloaded).
   *
   * ON THE GUARD ORDER, corrected (w8-r-002). The `clientRef`/`content` guard
   * used to be the first line of `checkRollover`; it now sits immediately
   * above the re-boot, the only branch that uses it. That is an ORDERING
   * improvement and nothing more — the conjuncts are side-effect-free, so the
   * permutation is behaviour-neutral, and the reviewer confirmed it by
   * restoring the original order and finding the whole suite, appMidnight
   * included, still green. An earlier version of this comment claimed the
   * move is what makes the effect reachable under jsdom. IT IS NOT: what
   * makes it reachable is mocking `createEngineClient`
   * (tests/ui/appMidnight.test.tsx, the tests/ui/router.test.tsx idiom), which
   * populates `clientRef` whatever the guard order. w7-r-003's
   * "unreachable in jsdom by construction" was true of a suite that did not
   * mock it, and is closed by the mock, not by this line.
   *
   * The check runs on an interval AND on `visibilitychange`, because a
   * backgrounded tab's timers are throttled to the point of uselessness and
   * "came back to it" is exactly the moment that matters.
   */
  useEffect(() => {
    if (!content) return undefined;
    function checkRollover() {
      const state = gameStore.getState();
      if (!state.booted || state.iso === localIsoDate()) {
        // Either there is no day yet, or the day on screen IS today. Nothing
        // is stale, so the notice retires itself — including after a re-boot
        // below, which is what stops it flashing on the briefing.
        setNewDayPending(false);
        return;
      }
      // The Summary owns its own version of this (w8-r-001, see above): it is
      // the one stale screen where the day is already saved, so it gets a
      // sentence that is true of a finished player AND the control this
      // notice must not offer.
      if (state.screen === 'summary') {
        setNewDayPending(false);
        return;
      }
      // See the ruling above: the briefing is the one state the player can be
      // in having done nothing, because nothing ever navigates back to it.
      // Everywhere else the day is kept and the player is TOLD.
      if (state.screen !== 'briefing') {
        setNewDayPending(true);
        return;
      }
      const client = clientRef.current;
      if (!client || !content) return;
      setNewDayPending(false);
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
   * ("Reloading usually fixes it"), and it now says so: `errors.reload`
   * ("Reload") landed with W2 and replaces the `nav.play` stand-in this
   * comment used to describe. One word, because the <h1> above it is the
   * sentence that already explained what pressing it does. It renders here
   * and nowhere else — this screen has no header and no nav — so the word
   * cannot be read as a second, competing PLAY.
   */
  if (!booted && storeError) {
    return (
      <div className="ph-app">
        {/* Same keyed, focusable, animated <main> as the shell's own below
            (R5.2 site 1, R6.6): this is a screen like any other, and it must
            arrive the same way rather than teleporting in. */}
        <main className="ph-screen" id={MAIN_ID} key={screenKey} ref={mainRef} tabIndex={-1}>
          {/* §9.1's page shell, composed rather than retyped (see App.css's
              own note for why this rule was adopted after the section that
              enumerated its adopters was written). */}
          <section className="ph-page ph-page--titled ph-boot-error" data-testid="app-boot-error">
            {/* R6.6: every screen carries exactly one <h1>, its own title.
                This screen's title is what went wrong. */}
            <h1 className="ph-boot-error__title">{t('errors.workerCrash')}</h1>
            <button
              type="button"
              className="ph-boot-error__reload ph-focusable ph-label"
              data-testid="app-boot-error-reload"
              onClick={() => window.location.reload()}
            >
              {t('errors.reload')}
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
          The label is its own key now: `nav.skipToContent` ("Skip to the main
          content") replaces the `nav.play` stand-in this comment used to
          describe. The generic wording is deliberate over a puzzle-flavoured
          one — the destination is <main>, which is the About page or the
          Stats page as often as it is today's study, and a link that promises
          "today's puzzle" would be lying on three of the four routes. */}
      <a className="ph-visually-hidden ph-skip-link ph-focusable" href={`#${MAIN_ID}`} data-testid="app-skip-link">
        {t('nav.skipToContent')}
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
          <button type="button" className="ph-header__home ph-focusable" aria-label={t('a11y.backToGame')} onClick={backToGame}>
            <span className="ph-header__wordmark">P-hackle</span>
          </button>
          <span className="ph-header__vol">
            {t('briefing.vol', { volume: JOURNAL_VOLUME, issue: issueLabel(displayedPuzzleNumber, practice) })}
          </span>
          {/* gr6-022 — PRACTICE MODE, MADE VISIBLE.
              Practice mode reaches a player two ways (daily.ts's isPractice):
              every date before EPOCH, and `?practice=1`, which does not expire
              at launch. It records nothing, re-seeds from Math.random() rather
              than from the date, and can be replayed all day — and none of
              that was visible anywhere in the product. The marker and the em
              dash the volume line now prints in place of an issue number
              (src/ui/masthead.ts) are one statement, which is why they sit in
              the same paragraph: "Vol. 1, No. — · Practice run" reads as a
              masthead for a thing that is not an issue, rather than as a
              badge stuck onto one that is.
              --muted per R1.2 (this is a caption about the page, not a
              headline on it) and .ph-label for the same tracked small-caps
              treatment the rest of the chrome uses. No role="status": it is
              true from the first paint of the session to the last and nothing
              ever arrives here, so it is read in document order right after
              the number it qualifies. */}
          {practice ? (
            <span className="ph-header__practice ph-label" data-testid="app-practice-marker">
              {t('nav.practiceMode')}
            </span>
          ) : null}
        </p>
        <div className="ph-header__controls">
          {/* T22: a real <nav> landmark, not a bare div. This is the app's
              only navigation region, so it needs no aria-label to be
              unambiguous — a single navigation landmark is named by its role.
              The theme/locale controls beside it stay role="group": they
              choose a setting, they do not navigate anywhere. */}
          <nav className="ph-header__nav">
            <button type="button" className="ph-seg ph-focusable" aria-pressed={page === 'stats'} onClick={() => setPage('stats')}>
              {t('nav.stats')}
            </button>
            <button type="button" className="ph-seg ph-focusable" aria-pressed={page === 'legend'} onClick={() => setPage('legend')}>
              {t('nav.legend')}
            </button>
            <button type="button" className="ph-seg ph-focusable" aria-pressed={page === 'about'} onClick={() => setPage('about')}>
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
              <button type="button" className="ph-seg ph-seg--action ph-focusable ph-label" onClick={backToGame}>
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
      {/* W8 (w6-r-006 / w7-r-003) — THE MID-PLAY MIDNIGHT NOTICE.
          Same treatment as the storage notice directly above, and for the same
          reasons: rendered in the shell so it is visible on whichever screen
          the player is actually standing on, a quiet manuscript line rather
          than a modal, and role="status" rather than "alert" because nothing
          is wrong and nothing is blocked. It differs from that one in the
          single way that matters here — it can ARRIVE while the player is
          reading the screen (the rollover check fires on an interval and on
          visibilitychange), which is exactly the case a live region exists
          for, and is why it keeps role="status" rather than relying on
          document order the way the practice marker above does.
          It retires itself: the moment the store's `iso` is today again the
          same check clears the flag. */}
      {newDayPending ? (
        <p className="ph-new-day-notice" role="status" data-testid="app-new-day-notice">
          {t('errors.newDay')}
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
        className="ph-seg ph-focusable"
        aria-pressed={theme === 'paper'}
        onClick={() => setTheme('paper')}
      >
        {t('nav.themePaper')}
      </button>
      <button type="button" className="ph-seg ph-focusable" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
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
          className="ph-seg ph-seg--locale ph-focusable"
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
