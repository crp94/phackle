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
  it('includes every ForkKind glyph from FORK_EMOJI, plus the prefix/terminal/call glyphs, exactly once each', () => {
    const glyphs = LEGEND_ENTRIES.map((e) => e.glyph);
    const expected = [
      PREREG_PREFIX,
      FORK_EMOJI.spec,
      FORK_EMOJI.subgroup,
      FORK_EMOJI.exclusion,
      FORK_EMOJI.tails,
      FORK_EMOJI.peek,
      SUBMIT_EMOJI,
      ABANDON_EMOJI,
      CALL_CORRECT,
      CALL_INCORRECT,
    ];
    for (const glyph of expected) {
      expect(glyphs.filter((g) => g === glyph)).toHaveLength(1);
    }
    expect(glyphs).toHaveLength(expected.length);
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
    expect(screen.getByText('How to read a shared result.')).toBeTruthy();
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

  it('calls onClose when the close button is activated, and labels it via a11y.closeDialog', () => {
    const onClose = vi.fn();
    render(<Legend t={t} onClose={onClose} />);
    const button = screen.getByRole('button', { name: t('a11y.closeDialog') });
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders no close button when onClose is not supplied', () => {
    render(<Legend t={t} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
