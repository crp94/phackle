// @vitest-environment jsdom
//
// T17: the Legend nav page — §2.9's emoji table, built from share.ts's own
// FORK_EMOJI map (+ its terminal/prefix glyphs), never retyped. This project
// has no @testing-library/jest-dom (see tests/ui/shell.test.tsx's note) —
// assertions read plain DOM properties.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import {
  Legend,
  LEGEND_ENTRIES,
} from '../../src/ui/screens/Legend';
import {
  ABANDON_EMOJI,
  CALL_CORRECT,
  CALL_INCORRECT,
  FORK_EMOJI,
  PREREG_PREFIX,
  SUBMIT_EMOJI,
} from '../../src/game/share';
import { copy as enCopy } from '../../src/content/en/copy';
import { t as translate } from '../../src/i18n/t';

afterEach(() => cleanup());

const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate(enCopy, key, params);

describe('LEGEND_ENTRIES — built from share.ts mapping, not retyped', () => {
  // T29 (owner ruling — see src/game/share.ts's FORK_EMOJI): the four
  // spec-change fork kinds all print 🍴 now, so a row-per-ForkKind legend
  // would print one glyph against four different meanings — a key that
  // contradicts itself. Legend.tsx dedupes by glyph, first declaration wins.
  // This assertion is repointed, not relaxed: it still demands that EVERY
  // glyph the mapping can emit is in the key, still demands each appears
  // exactly once, and now additionally demands the key carries NOTHING the
  // mapping cannot emit — a strictly stronger statement than the row count
  // it replaces.
  it('lists every glyph FORK_EMOJI + the prefix/terminal/call constants can emit, exactly once each, and nothing else', () => {
    const glyphs = LEGEND_ENTRIES.map((e) => e.glyph);
    const emittable = new Set([
      PREREG_PREFIX,
      ...Object.values(FORK_EMOJI),
      SUBMIT_EMOJI,
      ABANDON_EMOJI,
      CALL_CORRECT,
      CALL_INCORRECT,
    ]);
    for (const glyph of emittable) {
      expect(glyphs.filter((g) => g === glyph), `${glyph} is not in the key exactly once`).toHaveLength(1);
    }
    expect(new Set(glyphs)).toEqual(emittable);
    expect(glyphs).toHaveLength(emittable.size);
  });

  it('every entry has a distinct legend.emoji* (or prereg) CopyKey label', () => {
    const keys = LEGEND_ENTRIES.map((e) => e.labelKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key === 'legend.emojiPrereg' || key.startsWith('legend.emoji')).toBe(true);
    }
  });
});

describe('Legend component — renders the mapping + copy keys only', () => {
  it('renders the title, intro, and one row per legend entry with its glyph and label text', () => {
    render(<Legend t={t} />);
    expect(screen.getByText('Legend')).toBeTruthy();
    // W2/gr6-030: looked up, not retyped. This assertion used to carry the
    // English sentence as a literal, so a catalog edit reddened a UI test that
    // was not about the wording at all.
    expect(screen.getByText(enCopy['legend.intro'])).toBeTruthy();
    for (const entry of LEGEND_ENTRIES) {
      expect(screen.getByText(t(entry.labelKey))).toBeTruthy();
    }
    // The glyphs themselves are real, visible content (not decoration on this
    // page — this IS the page that defines what they mean).
    expect(screen.getAllByText(FORK_EMOJI.spec).length).toBeGreaterThan(0);
  });

  // CRITICAL (T13 review ruling, carried into T17's brief): the master
  // spec's own illustrative "7 forks" sample caption is internally
  // inconsistent with its own 6-glyph example trail. countForks is the
  // source of truth (forkLog.ts); the legend must never reproduce that
  // sample caption verbatim.
  it('never reproduces the master spec\'s inconsistent "7 forks" sample caption', () => {
    const { container } = render(<Legend t={t} />);
    expect(container.textContent).not.toContain('7 forks');
    expect(container.textContent).not.toContain('streak 12');
  });

  // T34 (owner play-test finding, "when using two emojis... make sure the
  // text does not overlap" — the concrete instance being CALL_CORRECT/
  // CALL_INCORRECT, ⚖️✅/⚖️❌, a scale + a check/cross): every glyph routes
  // through GlyphMark, which adds letter-spacing independent of the row's
  // own flex `gap`. This is a regression guard against a future edit
  // reverting to a bare `{entry.glyph}` text node.
  it('renders every glyph through GlyphMark (ph-glyph-mark), not a bare text node', () => {
    const { container } = render(<Legend t={t} />);
    const glyphSpans = container.querySelectorAll('.ph-legend__glyph');
    expect(glyphSpans).toHaveLength(LEGEND_ENTRIES.length);
    glyphSpans.forEach((span) => {
      expect(span.classList.contains('ph-glyph-mark')).toBe(true);
    });
  });

  // T22: the close button used to be named a11y.closeDialog ("Close dialog"),
  // which promised a dialog — modality, a focus trap, an Escape key. This is a
  // nav page that replaces <main>'s content and has none of those. Its visible
  // label is now its accessible name, and the context that label used to fake
  // comes from the region the section actually declares.
  it('calls onClose when the close button is activated, named by its own visible label', () => {
    const onClose = vi.fn();
    render(<Legend t={t} onClose={onClose} />);
    const button = screen.getByRole('button', { name: t('stats.close') });
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('names its region from its own heading, so "Close" is never heard bare', () => {
    const { container } = render(<Legend t={t} onClose={() => {}} />);
    const region = container.querySelector('.ph-legend') as HTMLElement;
    const heading = screen.getByRole('heading', { level: 1, name: t('legend.title') });
    expect(region.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.id).not.toBe('');
  });

  it('renders no close button when onClose is not supplied', () => {
    render(<Legend t={t} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
