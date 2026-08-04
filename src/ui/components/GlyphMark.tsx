// T34 — a compound-emoji-safe glyph wrapper (owner play-test finding: "when
// using two emojis (eg the green check) make sure the text does not
// overlap"). The concrete instance is share.ts's CALL_CORRECT/CALL_INCORRECT
// constants (⚖️✅ / ⚖️❌ — a scales glyph immediately followed by a check or
// cross, i.e. TWO adjacent emoji in one string): a pre-T29 shot showed ✅
// overprinting the "C" of "Call was correct". T29's own fix (M5:
// `.ph-legend__glyph { min-width: 2ch }`) already stops the glyph COLUMN
// from clipping into the label column in this build (see task-T34-report.md
// for the measured, reproduced-clean gaps) — but that column-level fix does
// nothing for the space BETWEEN the two component glyphs of the compound
// sequence itself, and it depends on the row staying a flex container with
// its own `gap`. This component is the second, independent, font-metric-
// -independent layer T34 adds on top of it, shared by every site that pairs
// a share.ts glyph with a label (today: the Legend page's rows and the fork
// trail's hover/tap popover — both built from the SAME LEGEND_ENTRIES list
// in Legend.tsx, so they can never disagree, and both route their glyph
// through this one component so neither can forget the fix).
//
// Deliberately NOT used inside src/game/share.ts (that module is never
// imported for rendering, only for the byte-stable clipboard string) and
// NOT used for the Lab's own live trail run (ForkTrail.css's
// `.ph-fork-trail__glyphs`), which is a sequence of single-cluster glyphs,
// never a compound pair, and already carries its own `letter-spacing`.
import './GlyphMark.css';

export interface GlyphMarkProps {
  /** A share.ts glyph constant — may be a single emoji or a compound
   * sequence like CALL_CORRECT ('⚖️✅'). */
  glyph: string;
  /** Merged onto the same element (not nested) — callers keep their own
   * layout class (`.ph-legend__glyph`, `.ph-fork-trail__popover-glyph`)
   * doing column sizing/alignment; this component only ever adds spacing. */
  className?: string;
}

export function GlyphMark({ glyph, className }: GlyphMarkProps) {
  return <span className={className ? `ph-glyph-mark ${className}` : 'ph-glyph-mark'}>{glyph}</span>;
}
