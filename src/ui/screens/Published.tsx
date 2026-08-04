// The PUBLISHED screen (master spec §2.5/§7.3; DESIGN.md throughout) --
// Act I's sincere payoff: full-bleed fake-journal celebration, played 100%
// straight. Reads ONLY the store + useLocale content, behind the app-level
// loading gate (see src/ui/App.tsx) -- no props are required in real use.
//
// Registry integration (controller amendment): T14's src/ui/screens/registry.ts
// does not exist in this worktree (parallel sibling work; STEP 0 resets this
// tree to a commit before either T14 or T15 existed) -- registry.t15.patch.md
// carries the two lines the controller splices into it at merge. This file
// is built as a standalone screen (no router of its own): the store hook is
// injected via `useStore` (defaulting to the app's real singleton,
// src/game/store.ts's useGameStore) purely so tests can seed an isolated
// fake store instead of touching that real singleton -- see
// tests/ui/published.test.tsx's makeFakeStoreHook.
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore, type GameStore } from '../../game/store';
import { isoFromPuzzleNumber } from '../../game/puzzleDate';
import { SCORING } from '../../game/tuning';
import {
  altmetricPercentile,
  altmetricScore,
  confettiParticlesForTier,
  egregiousnessTier,
  fakeDoi,
  pickJournal,
  pickPress,
  substituteEffect,
} from '../../game/published';
import type { PressBlurb } from '../../content/types';
import type { CopyKey } from '../../content/en/copy';
import { JournalCover } from '../components/JournalCover';
import { ConfettiLayer } from '../components/ConfettiLayer';
import './Published.css';

export type UseGameStore = <T>(selector: (state: GameStore) => T) => T;
export type LazyScreenComponent = ComponentType<Record<string, never>>;

/** Real default loader: reaches into the shared screen registry (T14) for
 * `SCREENS.call`, so Published never imports T16's Call.tsx directly.
 *
 * SHIPPING BUG, FOUND AND FIXED BY T29's screenshot pass. This used to hold
 * './registry' in a `const` and pass it through a vite-ignore annotation — a
 * deliberately NON-analyzable specifier, written when src/ui/screens/
 * registry.ts did not yet exist in this worktree and a literal would have
 * failed `tsc --noEmit` and the Vite build outright. That workaround became
 * wrong the moment the controller's merge made the module real: an
 * unanalyzable specifier is not rewritten to the built chunk's hashed URL,
 * so in a PRODUCTION build the request resolved to `/assets/registry`, 404'd,
 * hit the `catch`, and returned `null`. Reproduced in the real built app over
 * CDP: clicking "Face the truth" opened the dimmed, focus-trapped overlay
 * with NOTHING in it — the whole Act I -> Act II hand-off, dead in the
 * shipped artifact and invisible to a jsdom suite that injects its own
 * loader. A literal specifier resolves and is rewritten correctly; the
 * Published -> registry -> Published import cycle is harmless because this
 * one is dynamic (registry is only evaluated after Published already is).
 *
 * The `catch` stays: a chunk that genuinely fails to load should leave the
 * player on a dimmed overlay, not crash the screen.
 *
 * Co-located with Published (its only real consumer) rather than split into
 * its own module -- the same justified, non-accidental mixed export
 * src/i18n/LocaleProvider.tsx's own useLocale() sets precedent for. */
// eslint-disable-next-line react-refresh/only-export-components
export async function loadCallScreenFromRegistry(): Promise<LazyScreenComponent | null> {
  try {
    const mod = (await import('./registry')) as {
      SCREENS?: Partial<Record<string, LazyScreenComponent>>;
    };
    return mod.SCREENS?.call ?? null;
  } catch {
    return null;
  }
}

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
   * so reduced motion can collapse it). */
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
  return (
    <li className="ph-press-card" style={{ '--ph-stagger-index': index } as CSSProperties}>
      <p className="ph-press-card__outlet">{blurb.outlet}</p>
      <p className="ph-press-card__text">{blurb.text}</p>
      <p className="ph-press-card__watermark">{t('published.simulatedPress')}</p>
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
  return (
    <div className="ph-chyron" style={{ '--ph-stagger-index': index } as CSSProperties}>
      <p className="ph-chyron__badge">{t('published.editorsPick')}</p>
      <p className="ph-chyron__text">{blurb.text}</p>
      <p className="ph-chyron__strap">
        <span className="ph-chyron__outlet">{blurb.outlet}</span>
        <span className="ph-chyron__watermark">{t('published.simulatedPress')}</span>
      </p>
    </div>
  );
}

export interface PublishedProps {
  /** Defaults to the app's real singleton store hook. Tests inject an
   * isolated `createGameStore()` instance instead (never the real
   * singleton) -- see this file's own header comment. */
  useStore?: UseGameStore;
  /** Defaults to `loadCallScreenFromRegistry`. Tests inject a fake resolving
   * to a stand-in component, so "renders whatever the registry returns" is
   * provable without T14/T16's real files existing in this tree. */
  loadCallScreen?: () => Promise<LazyScreenComponent | null>;
}

export function Published({ useStore = useGameStore, loadCallScreen = loadCallScreenFromRegistry }: PublishedProps = {}) {
  const { content, t } = useLocale();
  const forks = useStore((s) => s.forks);
  const result = useStore((s) => s.result);
  const scenarioIndex = useStore((s) => s.scenarioIndex);
  const puzzleNumberValue = useStore((s) => s.puzzleNumber);

  const [confettiDone, setConfettiDone] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [CallScreen, setCallScreen] = useState<LazyScreenComponent | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Moves focus into the overlay the moment it opens, and again once the
  // lazily-loaded call screen actually populates it with its own focusable
  // content (falls back to the (already tabIndex=-1) container itself while
  // nothing has loaded yet, e.g. today, pre-merge, when the loader resolves
  // to null -- see loadCallScreenFromRegistry above).
  useEffect(() => {
    if (!callOpen) return;
    const container = overlayRef.current;
    if (!container) return;
    const focusable = getFocusableElements(container);
    (focusable[0] ?? container).focus();
  }, [callOpen, CallScreen]);

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
  const doi = fakeDoi(puzzleNumberValue);
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
  const altmetricPercentileText = t('published.altmetricPercentile', { n: altmetricPercentile(iso, tier) });

  // Two press cards (master spec §2.5: "1-2 fake press blurbs"); the second
  // salts `iso` rather than growing pickPress a bespoke "exclude" parameter
  // (see src/game/published.ts's own doc comment) -- still fully
  // deterministic, and harmless on the rare pool-of-one day where both picks
  // coincide (e.g. a scenario's one tier-1 scenario-bound blurb).
  const card1 = pickPress(content.press, tier, scenario.id, iso);
  const card2 = pickPress(content.press, tier, scenario.id, `${iso}#2`);
  const chyron = tier === 3 ? pickPress(content.press, 3, scenario.id, `${iso}#chyron`) : null;

  function handleFaceTruth() {
    setCallOpen(true);
    // NOT `.then(setCallScreen)`: the resolved value is itself a function
    // (a component), and useState's setter treats a bare function argument
    // as an *updater* (calling it with the previous state) rather than the
    // new state value to store -- wrapping it in an arrow that returns the
    // component is the standard idiom for storing a function in state.
    void loadCallScreen().then((component) => setCallScreen(() => component));
  }

  function handleOverlayKeyDown(e: KeyboardEvent<HTMLDivElement>) {
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
        <button type="button" className="ph-published__cta" onClick={handleFaceTruth}>
          {t('published.faceTruth')}
        </button>
      </div>
      {callOpen && (
        <div
          className="ph-call-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('call.title')}
          ref={overlayRef}
          tabIndex={-1}
          onKeyDown={handleOverlayKeyDown}
        >
          {CallScreen ? <CallScreen /> : null}
        </div>
      )}
    </div>
  );
}
