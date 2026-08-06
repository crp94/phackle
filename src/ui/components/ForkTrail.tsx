// The Lab's live fork trail (master spec §2.9/§7.3): the same emoji legend
// share.ts's end-of-day shareString() uses, imported (not duplicated) per
// the controller pin. Unlike shareString's trail, this one carries no
// terminal 📄/🏳️ marker — the Lab is by definition mid-play, before any
// SUBMIT or ABANDON has happened.
//
// T29 (owner ruling, third play-test round — "the fork emojis are...
// questionable. they are hard to read, and the legend is a bit hidden"):
//   1. share.ts's FORK_EMOJI collapsed the four spec-change kinds onto a
//      single 🍴, so the in-trail vocabulary is exactly two glyphs (🍴, ➕).
//      Nothing here had to change for that — the trail reads the map.
//   2. The trail's glyph run is set at --text-22 with real spacing, so the
//      two remaining glyphs are legible at a glance rather than a compressed
//      pictograph string. The SHARE string is untouched (share.ts owns it and
//      is a clipboard format, not a rendering).
//   3. The key is now reachable from where the symbols are: a small
//      hover/tap/focus popover next to the trail, listing the SAME
//      LEGEND_ENTRIES the Legend nav page is built from (T17's
//      single-source design), so the two can never disagree. The full
//      Legend page is unchanged.
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { PREREG_PREFIX, walkForkGlyphs } from '../../game/share';
import { LEGEND_ENTRIES } from '../screens/Legend';
import { GlyphMark } from './GlyphMark';
import type { PlayerAction } from '../../engine/types';
import './ForkTrail.css';

export interface ForkTrailProps {
  log: PlayerAction[];
  mode: 'hack' | 'prereg';
}

/** gr6-092: §2.10's walk is share.ts's `walkForkGlyphs`, imported rather than
 * restated. This file used to carry its own copy, with a comment explaining
 * that it had to because the walk was not exported (only `FORK_EMOJI` and
 * `classifyChange` were) — so the one rule that decides what counts as a fork
 * lived in two places, and a change to either could quietly disagree with the
 * share string a player pastes into somebody else's timeline.
 *
 * The Lab's trail carries no terminal 📄/🏳️ marker: it is by definition
 * mid-play, before any SUBMIT or ABANDON has happened. That difference is
 * exactly what stays here, at the call site, which is why the exported walker
 * covers only the fork/peek run. */
function buildLiveTrail(log: PlayerAction[], prereg: boolean): string {
  return (prereg ? PREREG_PREFIX : '') + walkForkGlyphs(log);
}

/**
 * The key, where the symbols are (T29 pin 11-NEW-b). Opens on hover (mouse),
 * on focus (keyboard) and on click/tap (touch); closes on pointer-leave, on
 * blur out of the whole control, and on Escape.
 *
 * T22 (T29 review M3) — IT IS A DISCLOSURE, and now says so. This shipped as
 * `role="tooltip"` on the popover PLUS `aria-expanded`/`aria-controls` on the
 * trigger: two patterns at once, and the two disagree. A tooltip is a
 * description of the control it hangs off — flattened to a single string,
 * exposed through aria-describedby, and never a thing that "expands". A
 * disclosure is a control that shows and hides a piece of CONTENT, which is
 * exactly what this is: a seven-row key, toggled by click on touch, with its
 * own Escape. (Seven, not ten: LEGEND_ENTRIES dedupes DECLARED_ENTRIES by
 * glyph, and T29 collapsed the four spec-change fork kinds onto a single 🍴 —
 * see Legend.tsx. Counted in the rendered popover, not inferred.)
 *
 * Resolved to the disclosure, because the content decides. The key is a LIST
 * of glyph/meaning pairs; a tooltip's accessible description would collapse it
 * into one unpunctuated run ("Fork 🍴 Peek ➕ …") with no way to step through
 * the rows, whereas a disclosure keeps it as a list a screen reader can
 * navigate item by item — hence the explicit role="list"/"listitem" below, on
 * spans that CSS needs to stay spans (the popover is an inline element inside
 * a <p>, so real <ul>/<li> would be invalid markup here).
 *
 * `aria-controls` stays conditional on `open`: the popover is not rendered
 * while closed, and an aria-controls pointing at an id that does not exist is
 * itself an error. Every behaviour T29 pinned — hover, tap, focus, blur,
 * Escape — is untouched.
 *
 * The original note here said touch "fires no hover". It does — see the
 * fix-round comment inside the component for the compatibility-event
 * sequence a first tap really produces, and the two guards that handle it.
 *
 * Surface follows the SpecCurve tooltip's precedent exactly (DESIGN.md R4.1/
 * R4.2/R4.4): --paper background, a hairline top and bottom, no fill of its
 * own, no shadow, no radius, R4.7's --z-overlay rather than a raw z-index.
 * Rows are built from LEGEND_ENTRIES, so it lists precisely the current
 * vocabulary and shrinks automatically whenever the mapping does.
 */
function TrailKey() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const popoverId = useId();

  // T29 FIX ROUND — touch robustness. Hover (open) and click (toggle) are
  // bound to the SAME control, and a mobile browser fires a compatibility
  // `mouseenter` immediately BEFORE the `click` of a first tap: hover opened
  // the popover and the click that arrived a moment later closed it again, so
  // on a phone the key flashed and vanished. Reproduced in real headless
  // Chrome against the built app before this patch (the capture harness had
  // to fall back to a bare .click() to get an open popover at all).
  //
  // Two independent guards, because either one alone has a gap:
  //   1. `lastPointerType` — `pointerenter` always precedes the compatibility
  //      `mouseenter`, on both mouse and touch, and carries the real device.
  //      A non-mouse pointer therefore suppresses the hover-open entirely and
  //      leaves the tap to the click handler, which toggles as normal. It
  //      re-arms on every enter, so a hybrid laptop is right either way.
  //   2. `hoverOpened` — for engines with no pointer events at all, the click
  //      that immediately follows a hover-open is swallowed instead (the
  //      popover is already open; that click was never a "close" gesture).
  //      It stays armed until the next leave/dismiss, so a much later click
  //      is swallowed too — harmless, since a second click still closes.
  const lastPointerType = useRef<string>('mouse');
  const hoverOpened = useRef(false);

  function dismiss() {
    hoverOpened.current = false;
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      dismiss();
    }
  }

  // Focus moving to another element INSIDE the control (there is only the
  // button today, but the popover is markup that could gain one) must not
  // dismiss it; focus leaving the control entirely must.
  function handleBlur(event: React.FocusEvent<HTMLSpanElement>) {
    if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) dismiss();
  }

  function handleMouseEnter() {
    if (lastPointerType.current !== 'mouse') return; // a tap's compat event
    hoverOpened.current = true;
    setOpen(true);
  }

  function handleClick() {
    if (hoverOpened.current) {
      hoverOpened.current = false; // the hover already opened it: not a close
      return;
    }
    setOpen((wasOpen) => !wasOpen);
  }

  return (
    <span
      className="ph-fork-trail__key"
      ref={wrapRef}
      onPointerEnter={(event) => {
        lastPointerType.current = event.pointerType || 'mouse';
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={dismiss}
      onFocus={() => setOpen(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="ph-fork-trail__key-button"
        data-testid="fork-trail-key"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={handleClick}
      >
        {t('nav.legend')}
      </button>
      {open ? (
        <span className="ph-fork-trail__popover" id={popoverId} role="list" data-testid="fork-trail-popover">
          {LEGEND_ENTRIES.map((entry) => (
            <span className="ph-fork-trail__popover-row" role="listitem" key={entry.labelKey}>
              <GlyphMark glyph={entry.glyph} className="ph-fork-trail__popover-glyph" />
              <span className="ph-fork-trail__popover-label">{t(entry.labelKey)}</span>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function ForkTrail({ log, mode }: ForkTrailProps) {
  const { t } = useLocale();
  const trail = buildLiveTrail(log, mode === 'prereg');

  return (
    <p className="ph-fork-trail">
      <span className="ph-fork-trail__label">{t('lab.forkTrailLabel')}</span>
      <span className="ph-fork-trail__glyphs">{trail || '—'}</span>
      <TrailKey />
    </p>
  );
}
