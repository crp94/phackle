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
import { FORK_EMOJI } from '../../game/share';
import { classifyChange } from '../../game/forkLog';
import { LEGEND_ENTRIES } from '../screens/Legend';
import type { PlayerAction, Spec } from '../../engine/types';
import './ForkTrail.css';

export interface ForkTrailProps {
  log: PlayerAction[];
  mode: 'hack' | 'prereg';
}

/** Same "first VIEW_SPEC is free, later ones count iff seen" rule as
 * forkLog.ts's countForks/share.ts's buildTrail, restated here (rather than
 * imported) because neither of those is exported — only the glyph legend
 * (FORK_EMOJI) and the per-change classifier (classifyChange) are, and both
 * are reused as-is below. */
function buildLiveTrail(log: PlayerAction[], prereg: boolean): string {
  let trail = prereg ? '🧾' : '';
  let prevSpec: Spec | undefined;

  for (const action of log) {
    if (action.t === 'VIEW_SPEC') {
      if (prevSpec === undefined) {
        prevSpec = action.spec; // the initial default spec is free (§2.10)
        continue;
      }
      if (action.seen) trail += FORK_EMOJI[classifyChange(prevSpec, action.spec)];
      prevSpec = action.spec;
    } else if (action.t === 'PEEK_AND_EXTEND') {
      trail += FORK_EMOJI.peek;
    }
    // SUBMIT/ABANDON/CALL never reach the Lab's own log while it's showing.
  }
  return trail;
}

/**
 * The key, where the symbols are (T29 pin 11-NEW-b). Opens on hover (pointer),
 * on focus (keyboard) and on click/tap (touch, which fires no hover); closes
 * on pointer-leave, on blur out of the whole control, and on Escape.
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

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  // Focus moving to another element INSIDE the control (there is only the
  // button today, but the popover is markup that could gain one) must not
  // dismiss it; focus leaving the control entirely must.
  function handleBlur(event: React.FocusEvent<HTMLSpanElement>) {
    if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  return (
    <span
      className="ph-fork-trail__key"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
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
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {t('nav.legend')}
      </button>
      {open ? (
        <span className="ph-fork-trail__popover" id={popoverId} role="tooltip" data-testid="fork-trail-popover">
          {LEGEND_ENTRIES.map((entry) => (
            <span className="ph-fork-trail__popover-row" key={entry.labelKey}>
              <span className="ph-fork-trail__popover-glyph">{entry.glyph}</span>
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
