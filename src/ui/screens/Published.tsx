// The PUBLISHED screen (master spec §2.5/§7.3; DESIGN.md throughout) --
// Act I's sincere payoff: full-bleed fake-journal celebration, played 100%
// straight. Reads ONLY the store + useLocale content, behind the app-level
// loading gate (see src/ui/App.tsx) -- no props are required in real use.
//
// Standalone screen (no router of its own): the store hook is injected via
// `useStore` (defaulting to the app's real singleton, src/game/store.ts's
// useGameStore) purely so tests can seed an isolated fake store instead of
// touching that real singleton -- see tests/ui/published.test.tsx's
// makeFakeStoreHook.
//
// gr6-083 retired this file's second seam, a dynamic `import('./registry')`
// written when registry.ts did not yet exist in this task's worktree. It
// exists now, it is in the initial graph anyway (ScreenRouter imports it to
// pick the current screen), and the indirection bought nothing while costing
// an empty first commit and a double focus move per open. The Call screen is
// a plain static import; `callScreen` keeps the injectable seam.
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore, type UseGameStore } from '../../game/store';
import { isoFromPuzzleNumber } from '../../game/puzzleDate';
import { SCORING } from '../../game/tuning';
import {
  altmetricPercentile,
  altmetricScore,
  confettiParticlesForTier,
  egregiousnessTier,
  fakeDoi,
  pickJournal,
  pressForDay,
  substituteEffect,
} from '../../game/published';
import type { PressBlurb } from '../../content/types';
import type { CopyKey } from '../../content/en/copy';
import { issueLabel } from '../masthead';
import { JournalCover } from '../components/JournalCover';
import { ConfettiLayer } from '../components/ConfettiLayer';
import { staggerStyle, useEnterOnce } from '../hooks/useEnterOnce';
import { Call, CALL_PROMPT_ID } from './Call';
import './Published.css';

/** gr6-082 (finished): this type used to be re-declared here, character-
 * identical to `store.ts`'s own. One name, one file. */
export type CallScreenComponent = ComponentType<Record<string, never>>;
/** Retained spelling for the existing consumers of the seam's type name. */
export type LazyScreenComponent = CallScreenComponent;

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// R5.4 fixes this at 3000ms; ConfettiLayer's own reduced-motion gate already
// fully covers R5.6's actual risk (skips the canvas + calls onDone
// immediately, regardless of durationMs) -- reading the token here is
// single-source-of-truth hygiene on top of that, not the only safeguard.
const FALLBACK_DUR_CONFETTI_MS = 3000;

/** Reads --dur-confetti from the cascade rather than retyping R5.4's fixed
 * value (R5.6's own worked example: "read the token ... or [it] will still
 * block ... for reduced-motion users" -- generalized from its stamp example
 * to this sibling duration). Vitest doesn't process CSS under jsdom by
 * default (no `css: true` in vite.config.ts's test block), so
 * getComputedStyle returns '' in tests -- parseFloat('') is NaN, and the
 * guard below falls through to the same fixed 3000 the token declares, with
 * no special mocking needed. */
function readDurConfettiMs(): number {
  if (typeof window === 'undefined') return FALLBACK_DUR_CONFETTI_MS;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-confetti').trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : FALLBACK_DUR_CONFETTI_MS;
}

interface BlurbCardProps {
  blurb: PressBlurb;
  t: (key: CopyKey, params?: Record<string, string | number>) => string;
  /** T35 — DESIGN.md R5.2 site 5's animation hook, and nothing else: its
   * position in the staggered entrance. Published.css multiplies it by
   * --dur-stagger to get this clipping's animation-delay (a custom property,
   * never an inline duration — R5.1 keeps every timing value in tokens.css
   * so reduced motion can collapse it), capped by R5.7. */
  index: number;
}

/* R3.6: a hairline-separated list item, not a bordered card-in-a-grid.
 *
 * T29 pin 8 (owner: "the press blurbs read as generic blocks; make them read
 * as press"). Same three strings, same no-fill/no-shadow law — reordered and
 * re-typeset into a press CLIPPING's anatomy, which is a typographic
 * problem, not a decorative one:
 *   1. the outlet as a masthead line — caps, tracked, --ink, on top, where a
 *      clipping's paper always names itself;
 *   2. a dateline rule under it (the hairline that used to close the block
 *      now opens the quote, exactly as a newspaper rules under its masthead);
 *   3. the blurb as a display-serif pull-quote — unchanged type, but now the
 *      thing the rule points at instead of a paragraph floating under a
 *      label;
 *   4. the SIMULATED PRESS watermark last, hairline-topped and set as a
 *      compliance stamp at the foot of the clipping (§4.4 requires it on
 *      every fake-press asset; it should look like the legal line it is,
 *      not like the item's title, which is where it used to sit). */
function PressCard({ blurb, t, index }: BlurbCardProps) {
  // FIX ROUND 1 — the trigger is the VIEWPORT, not the mount. See
  // src/ui/hooks/useEnterOnce.ts for the measurement that forced this: at
  // 360 every clipping sits below the fold, so a mount-gated entrance ran
  // and finished before the player could possibly see it — the same defect
  // class T35 fixed for the stamp, in the same task.
  const { ref, entered } = useEnterOnce<HTMLLIElement>();
  return (
    <li
      ref={ref}
      className={entered ? 'ph-press-card ph-entered' : 'ph-press-card'}
      style={staggerStyle(index)}
    >
      <p className="ph-press-card__outlet ph-label">{blurb.outlet}</p>
      <p className="ph-press-card__text">{blurb.text}</p>
      <p className="ph-press-card__watermark ph-label">{t('published.simulatedPress')}</p>
    </li>
  );
}

/* Tier 3 only: master spec §4.4's TV-chyron mock, plus the editors-pick copy.
 *
 * T29 pin 8: read as a broadcast LOWER THIRD. R4 sanctions no new treatment
 * for this and none is invented — no fill (R4.1 spends the product's one
 * filled area on the SpecCurve band), no shadow (R4.2), no radius beyond
 * R4.3's 2px. What makes a lower third a lower third without a fill is its
 * ANATOMY: a full-column band, ruled top and bottom, with the badge in its
 * own left-hand channel separated by a vertical hairline, the headline in
 * display serif beside it, and the outlet + SIMULATED stamp as the strap
 * underneath. Every rule here is `--hairline`; `border-inline-start` is a
 * single edge, which is what R4.4/R4.5 permit (R4.5 bars four sides and the
 * `border` shorthand). No §0 registration is required because nothing new is
 * derived: no colour, no fill, no token. */
function ChyronBar({ blurb, t, index }: BlurbCardProps) {
  // Same viewport gate as the press clippings above; the chyron is the last
  // item of the same group, so it keeps the group's next stagger index.
  const { ref, entered } = useEnterOnce<HTMLDivElement>();
  return (
    <div ref={ref} className={entered ? 'ph-chyron ph-entered' : 'ph-chyron'} style={staggerStyle(index)}>
      <p className="ph-chyron__badge ph-label">{t('published.editorsPick')}</p>
      <p className="ph-chyron__text">{blurb.text}</p>
      <p className="ph-chyron__strap">
        <span className="ph-chyron__outlet ph-label">{blurb.outlet}</span>
        <span className="ph-chyron__watermark ph-label">{t('published.simulatedPress')}</span>
      </p>
    </div>
  );
}

export interface PublishedProps {
  /** Defaults to the app's real singleton store hook. Tests inject an
   * isolated `createGameStore()` instance instead (never the real
   * singleton) -- see this file's own header comment. */
  useStore?: UseGameStore;
  /** gr6-083 — the seam stays, and it is SYNCHRONOUS now.
   *
   * This used to be `loadCallScreen?: () => Promise<…>`, a dynamic
   * `import('./registry')` that could not split anything: `registry.ts` is
   * reachable from the app's very first render (ScreenRouter imports it to
   * pick the current screen), so the "lazy" chunk was already in the initial
   * graph and the import saved zero bytes. What it did cost was two renders
   * per open — the overlay committed EMPTY, took focus on its own container,
   * then re-rendered with the call screen and took focus a second time — and
   * a real 404 in production the first time the specifier was not analyzable
   * (T29 found it; see this file's history). A static import has none of
   * that and no cycle: registry -> Published -> Call, and registry -> Call.
   *
   * Tests inject a stand-in component through this prop exactly as they used
   * to inject a loader for one. */
  callScreen?: CallScreenComponent;
}

export function Published({ useStore = useGameStore, callScreen: CallScreen = Call }: PublishedProps = {}) {
  const { content, t } = useLocale();
  const forks = useStore((s) => s.forks);
  const result = useStore((s) => s.result);
  const scenarioIndex = useStore((s) => s.scenarioIndex);
  const puzzleNumberValue = useStore((s) => s.puzzleNumber);
  // gr6-021/gr6-022: read for the DOI's issue label below — a practice day
  // has no issue number to register.
  const practice = useStore((s) => s.practice);

  const [confettiDone, setConfettiDone] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // T22: where focus goes back to when the overlay is dismissed — the button
  // that opened it, which is the only place a returning player is not lost.
  const ctaRef = useRef<HTMLButtonElement | null>(null);

  // Moves focus into the overlay the moment it opens. gr6-083: ONE move, not
  // two — the call screen is rendered synchronously with the overlay now, so
  // its first option button already exists on this commit. (The container
  // fallback stays for the degenerate case of an overlay with nothing
  // focusable in it; `tabIndex={-1}` below is what makes it focusable.)
  useEffect(() => {
    if (!callOpen) return;
    const container = overlayRef.current;
    if (!container) return;
    const focusable = getFocusableElements(container);
    (focusable[0] ?? container).focus();
  }, [callOpen]);

  /**
   * gr6-014 — THE PAGE BEHIND A MODAL DOES NOT SCROLL.
   *
   * Measured before this: with the overlay up, `window.scrollTo(0, 250)`
   * moved the document from 0 to 250 and the dimmed cover slid underneath the
   * dialog. `inert` on the cover (below) removes it from focus and hit
   * testing, but it says nothing about the SCROLLING element — a wheel, a
   * two-finger swipe or a spacebar over the scrim all still drove the page,
   * and on a phone the overlay's own `overflow-y: auto` competes with it for
   * the same gesture.
   *
   * `overflow: hidden` on the documentElement is the whole fix: it is the
   * scrolling element in this app (App.css's `.ph-app` is a plain block, and
   * nothing between it and the viewport establishes a scroll container). The
   * previous value is captured and put back rather than assumed empty, and
   * the cleanup runs on close AND on unmount — which is the case
   * `closeCall`'s own edge-guarded restore effect cannot cover, because the
   * component can leave the tree with the overlay still open (store.makeCall
   * resolving swaps the screen to 'reveal' underneath it).
   */
  useEffect(() => {
    if (!callOpen) return undefined;
    const scroller = document.documentElement;
    const previous = scroller.style.overflow;
    scroller.style.overflow = 'hidden';
    return () => {
      scroller.style.overflow = previous;
    };
  }, [callOpen]);

  // T22 FIX ROUND 1 (review I1) -- RESTORING focus has to wait for the commit,
  // and the first version of this did not.
  //
  // THE BUG. `closeCall` used to call `ctaRef.current.focus()` on the line
  // after `setCallOpen(false)`. React had not committed yet at that point, so
  // the cover still carried `inert` -- and an element inside an inert subtree
  // cannot take focus at all. The call was a silent no-op. Measured in real
  // Chrome: after Escape, document.activeElement was <body> at +0ms AND at
  // +1200ms; the next Tab went to the browser's own chrome and the one after
  // that to the header's first stop, so a keyboard player who looked at the
  // call and backed out had to walk all nine header stops to get back to the
  // button they had just left. Control experiment, same page: focus() on the
  // CTA while the cover was inert -> did not become activeElement; the same
  // call with the attribute removed first -> did. My own jsdom test could not
  // see any of it, because jsdom does not implement inert's focus blocking, so
  // an outcome assertion there passes whether the ordering is right or wrong.
  //
  // THE FIX. Restore from an effect keyed on `callOpen`, which React runs
  // AFTER the commit that removes `inert` from the cover -- so the element is
  // focusable by the time anything tries to focus it. `wasOpenRef` is what
  // keeps this from being an on-mount focus steal: it only fires on a genuine
  // open -> closed edge, never on the first render (where callOpen is already
  // false) and never on a re-render that did not close anything.
  const wasCallOpenRef = useRef(false);
  useEffect(() => {
    if (callOpen) {
      wasCallOpenRef.current = true;
      return;
    }
    if (!wasCallOpenRef.current) return;
    wasCallOpenRef.current = false;
    ctaRef.current?.focus();
  }, [callOpen]);

  // Behind the app-level loading gate (src/ui/App.tsx never mounts a screen
  // until content resolves) -- this narrows the type and is a safety net,
  // not a second, competing loading UI.
  if (!content) return null;

  const scenario = content.scenarios[scenarioIndex];
  const iso = isoFromPuzzleNumber(puzzleNumberValue);
  const tier = egregiousnessTier(forks);
  // result is guaranteed non-null and significant at this screen (store.ts's
  // submit() guard), but the type is nullable -- defend anyway rather than
  // trust a guard this file doesn't own.
  const beta = result?.beta ?? 0;
  const headline = substituteEffect(scenario.headline, beta);
  const journal = pickJournal(scenario.journalTags, iso).name;
  // gr6-021: the issue LABEL, not the raw number — a practice day prints an
  // em dash here exactly as it does in the masthead (src/ui/masthead.ts), so
  // the cover can never carry `10.1337/phk.-3`, and a `?practice=1` run can
  // never be mistaken for the real issue it borrows its date from.
  const doi = fakeDoi(issueLabel(puzzleNumberValue, practice));
  const authors = t('published.authors');
  // Master spec §2.8: "Published (flavor 'career points', separate cosmetic
  // counter) -> +25 career", unconditional on the call's own correctness --
  // reaching this screen at all means `published` was true, so the fixed
  // tuning constant IS this act's career-points award; no scoreDay() call
  // (that function's own cumulative, day-level breakdown belongs to the
  // Summary screen, T17) is needed just to show it here.
  const careerPoints = t('published.careerPoints', { n: SCORING.publishedCareer });
  // Review fix (Important): master spec §2.5's fifth celebration element,
  // "a fake altmetric counter spinning up" -- rendered STATIC (the "spinning
  // up" motion would be an unregistered motion site; DESIGN.md R5.2's list
  // is exhaustive and T35 deliberately left this off it — see Published.css's
  // own note) precisely the way the press-card "sliding in" language was
  // resolved above: a documented precedence note, no animation added. See src/game/published.ts's altmetricScore/
  // altmetricPercentile for the tier-scaling contract.
  const altmetricScoreText = t('published.altmetricScore', { n: altmetricScore(iso, tier) });
  // gr6-086 / final-011 — the token is `{pct}`, not `{n}`. It is the only
  // percentage in a catalog whose every other `{n}` is a count, and the
  // rename could not happen in the catalog alone: a value renamed without
  // this line renders the token raw on the press card. Catalogs x3 and this
  // binding site changed in one commit, which is the only way it is safe.
  const altmetricPercentileText = t('published.altmetricPercentile', { pct: altmetricPercentile(iso, tier) });

  // gr6-091/gr6-064, W7's half: the day's press comes from the ONE audited
  // assembler. This screen used to spell the three seeds itself
  // (`iso`, `${iso}#2`, `${iso}#chyron`), which meant the outlet-dedup
  // pedigree pickPress hands out per slot depended on three string literals
  // in a component — a one-character edit here dropped a slot onto the
  // best-effort `slot === -1` branch and silently restored the same-outlet
  // collision (measured by W6: 0.00% -> 55.05% over 180k cells) with the
  // whole suite green. `pressForDay` owns the seeds, the slot order and the
  // tier-3 chyron rule; this screen just renders what it returns. The two
  // [INTERIM] source-scanning tests in tests/game/published.test.ts that
  // bridged the gap are deleted in this same commit, per their own stated
  // retirement condition.
  const [card1, card2, chyron = null] = pressForDay(content.press, tier, scenario.id, iso);

  function handleFaceTruth() {
    setCallOpen(true);
  }

  /** T22 — WCAG 2.1.2. The overlay traps Tab between the two call cards (see
   * below), and until this task it had no keyboard exit at all: a keyboard
   * player who opened "Face the truth" to look could not get back out to the
   * cover, the header, the theme toggle or anything else without committing
   * to a verdict. Reproduced in real Chrome — Escape did nothing and the
   * overlay stayed up. A trap with no exit is a trap.
   *
   * Closing is a pure UI retreat: `callOpen` is this component's own state,
   * the store is untouched (store.makeCall is still the only thing that ever
   * asks the worker for the truth — see Call.tsx's spoiler-safety note), and
   * the cover behind is a legitimate place to stand.
   *
   * Focus goes back to the button that opened it, as a dismissed modal must —
   * but NOT from here. Restoring focus synchronously on this line is exactly
   * the review-I1 bug: the cover is still `inert` until React commits, and
   * nothing inside an inert subtree can be focused. The restore lives in the
   * `callOpen` effect above, which runs after that commit. */
  function closeCall() {
    setCallOpen(false);
  }

  function handleOverlayKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeCall();
      return;
    }
    if (e.key !== 'Tab') return;
    const container = overlayRef.current;
    if (!container) return;
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="ph-published">
      {!confettiDone && (
        <ConfettiLayer
          particles={confettiParticlesForTier(tier)}
          durationMs={readDurConfettiMs()}
          onDone={() => setConfettiDone(true)}
        />
      )}
      {/* R4.2's sanctioned overlay treatment: `inert` removes the cover from
          focus/hit-testing and `aria-hidden` removes it from the
          accessibility tree while the call overlay is up (R6.3: also
          non-interactive, not just visually dim) -- the VISUAL dimming
          itself is the .ph-call-overlay's own var(--scrim) backdrop
          (registered derived colour, DESIGN.md §0/R1.3a/R4.2), rendered on
          top and covering this cover, not a class/opacity change here. */}
      <div className="ph-published__cover" aria-hidden={callOpen || undefined} inert={callOpen}>
        <JournalCover journal={journal} headline={headline} authors={authors} doi={doi} tier={tier} />
        {/* R1.6: the one place --hack-gold-ink paints characters (confetti's
            marks use plain --hack-gold instead -- see ConfettiLayer). */}
        <p className="ph-published__career">{careerPoints}</p>
        {/* Master spec §2.5's altmetric counter -- static, tier-scaled (R1.6's
            gold list does not include it: ink/muted only, see Published.css). */}
        <div className="ph-altmetric">
          <p className="ph-altmetric__score">{altmetricScoreText}</p>
          <p className="ph-altmetric__percentile">{altmetricPercentileText}</p>
        </div>
        <ul className="ph-press-list">
          <PressCard blurb={card1} t={t} index={0} />
          <PressCard blurb={card2} t={t} index={1} />
        </ul>
        {chyron && <ChyronBar blurb={chyron} t={t} index={2} />}
        <button type="button" className="ph-published__cta ph-focusable ph-label" ref={ctaRef} onClick={handleFaceTruth}>
          {t('published.faceTruth')}
        </button>
      </div>
      {/* gr6-015 — the dialog is named by its QUESTION, not by its eyebrow.
          `aria-label={t('call.title')}` announced this modal as "Before you
          see the reveal…", an ellipsis fragment that names nothing; the
          question one line below it ("Is this finding real?") is the actual
          name, and `aria-labelledby` pointing at Call's own <h1> is how a
          dialog is supposed to get it. The id resolves synchronously because
          gr6-083 made the call screen a static import — the h1 is in the same
          commit as this attribute, never one render later. */}
      {callOpen && (
        <div
          className="ph-call-overlay ph-focusable"
          role="dialog"
          aria-modal="true"
          aria-labelledby={CALL_PROMPT_ID}
          ref={overlayRef}
          tabIndex={-1}
          onKeyDown={handleOverlayKeyDown}
        >
          <CallScreen />
        </div>
      )}
    </div>
  );
}
