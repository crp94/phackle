// T17 — Legend nav page (master spec §2.9's emoji table, §7.3 "Legend: emoji
// key"). Built ENTIRELY from share.ts's own FORK_EMOJI map (+ its 5 terminal/
// prefix/call glyphs) and copy keys — never a hand-retyped glyph list, so
// this page cannot silently drift from what shareString() actually emits.
//
// CRITICAL (T13 review ruling, carried forward into the T17 brief): the
// master spec's own illustrative sample ("🍴🎯🍴🔪➕🍴📄 → ⚖️✅ / 7 forks ·
// streak 12") is internally inconsistent with its own 6-glyph trail —
// countForks (forkLog.ts) is the source of truth, proven in
// tests/game/share.test.ts's own reproduction of that exact sample (which
// asserts 6, not 7). This page does not reproduce that sample caption at
// all, verbatim or otherwise — see tests/ui/legend.test.tsx's regression
// guard.
import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { CopyKey } from '../../content/en/copy';
import {
  ABANDON_EMOJI,
  CALL_CORRECT,
  CALL_INCORRECT,
  FORK_EMOJI,
  PREREG_PREFIX,
  SUBMIT_EMOJI,
} from '../../game/share';
import { GlyphMark } from '../components/GlyphMark';
import './Legend.css';

type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

export interface LegendEntry {
  glyph: string;
  labelKey: CopyKey;
}

/** Declaration order mirrors the order a real trail can produce these
 * glyphs in (§2.9): an optional 🧾 prefix, then any of the 5 ForkKind
 * glyphs (share.ts's own FORK_EMOJI key order), then the terminal 📄/🏳️,
 * then the trailing ⚖️✅/⚖️❌ call marker. */
const DECLARED_ENTRIES: LegendEntry[] = [
  { glyph: PREREG_PREFIX, labelKey: 'legend.emojiPrereg' },
  { glyph: FORK_EMOJI.spec, labelKey: 'legend.emojiSpec' },
  { glyph: FORK_EMOJI.subgroup, labelKey: 'legend.emojiSubgroup' },
  { glyph: FORK_EMOJI.exclusion, labelKey: 'legend.emojiExclusion' },
  { glyph: FORK_EMOJI.tails, labelKey: 'legend.emojiTails' },
  { glyph: FORK_EMOJI.peek, labelKey: 'legend.emojiPeek' },
  { glyph: SUBMIT_EMOJI, labelKey: 'legend.emojiSubmit' },
  { glyph: ABANDON_EMOJI, labelKey: 'legend.emojiAbandon' },
  { glyph: CALL_CORRECT, labelKey: 'legend.emojiCallCorrect' },
  { glyph: CALL_INCORRECT, labelKey: 'legend.emojiCallIncorrect' },
];

/**
 * The legend, DERIVED from the mapping — one row per DISTINCT glyph, first
 * declaration wins.
 *
 * T29 (owner ruling, see src/game/share.ts's FORK_EMOJI comment): the four
 * spec-change fork kinds now all render as 🍴, so a row-per-ForkKind legend
 * would print the same glyph four times against four different meanings —
 * a key that contradicts itself. Deduplicating here is what "the Legend
 * derives from the mapping" was always supposed to buy: reduce the glyph
 * set and the key shrinks with it, with no glyph retyped anywhere.
 *
 * Exported (alongside the component) so tests/ui/legend.test.tsx can assert
 * the legend is built from this exact mapping — same co-location tradeoff
 * LocaleProvider.tsx makes for useLocale.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const LEGEND_ENTRIES: LegendEntry[] = DECLARED_ENTRIES.filter(
  (entry, i) => DECLARED_ENTRIES.findIndex((other) => other.glyph === entry.glyph) === i
);

export interface LegendProps {
  t: TFunction;
  /** Present only when reached as a header nav page (App.tsx's page-state) —
   * absent renders the bare content with no close affordance, for reuse
   * elsewhere without assuming a "back to game" concept exists. */
  onClose?: () => void;
}

export function Legend({ t, onClose }: LegendProps) {
  const titleId = useId();
  return (
    // T22: a named region with its own <h1> — see Stats.tsx's identical note.
    <section className="ph-page ph-legend" aria-labelledby={titleId}>
      <h1 className="ph-legend__title" id={titleId}>
        {t('legend.title')}
      </h1>
      <p className="ph-legend__intro">{t('legend.intro')}</p>
      <ul className="ph-legend__list">
        {LEGEND_ENTRIES.map((entry) => (
          <li className="ph-legend__row" key={entry.labelKey}>
            <GlyphMark glyph={entry.glyph} className="ph-legend__glyph" />
            <span className="ph-legend__label">{t(entry.labelKey)}</span>
          </li>
        ))}
      </ul>
      {/* T22: no aria-label — not a dialog. See Stats.tsx's note. */}
      {onClose && (
        <button type="button" className="ph-close ph-focusable" onClick={onClose}>
          {t('stats.close')}
        </button>
      )}
    </section>
  );
}

/** Standalone nav-page wrapper: reads the locale bundle itself (a NAV page,
 * not a machine screen — see the T17 patch notes) and renders nothing until
 * content has loaded, matching App.tsx's own loading-gate convention. */
export default function LegendScreen({ onClose }: { onClose?: () => void }) {
  const { copy, t } = useLocale();
  if (!copy) return <div aria-busy="true" data-testid="legend-loading" />;
  return <Legend t={t} onClose={onClose} />;
}
