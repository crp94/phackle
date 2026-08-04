// @vitest-environment jsdom
//
// T34 — GlyphMark: the compound-emoji-safe glyph wrapper shared by the
// Legend page's rows and the fork trail's hover/tap popover. See
// src/ui/components/GlyphMark.tsx's doc comment for the owner finding this
// answers ("when using two emojis... make sure the text does not overlap").
import { describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { GlyphMark } from '../../src/ui/components/GlyphMark';
import { CALL_CORRECT, CALL_INCORRECT, FORK_EMOJI } from '../../src/game/share';

afterEach(() => cleanup());

describe('GlyphMark', () => {
  it('renders the glyph text unchanged, single glyph or compound', () => {
    render(<GlyphMark glyph={FORK_EMOJI.spec} />);
    expect(screen.getByText(FORK_EMOJI.spec)).toBeTruthy();

    cleanup();
    render(<GlyphMark glyph={CALL_CORRECT} />);
    expect(screen.getByText(CALL_CORRECT)).toBeTruthy();

    cleanup();
    render(<GlyphMark glyph={CALL_INCORRECT} />);
    expect(screen.getByText(CALL_INCORRECT)).toBeTruthy();
  });

  it('always carries ph-glyph-mark (the letter-spacing class), regardless of className', () => {
    const { container: withoutClass } = render(<GlyphMark glyph={CALL_CORRECT} />);
    const bareSpan = withoutClass.querySelector('span');
    expect(bareSpan?.className).toBe('ph-glyph-mark');

    cleanup();
    const { container: withClass } = render(<GlyphMark glyph={CALL_CORRECT} className="ph-legend__glyph" />);
    const classedSpan = withClass.querySelector('span');
    // Merged onto the SAME element — not nested — so a caller's own layout
    // class (min-width/flex sizing) still applies directly.
    expect(classedSpan?.classList.contains('ph-glyph-mark')).toBe(true);
    expect(classedSpan?.classList.contains('ph-legend__glyph')).toBe(true);
  });

  it('renders exactly one span, not a nested wrapper', () => {
    const { container } = render(<GlyphMark glyph={CALL_CORRECT} className="ph-legend__glyph" />);
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });
});
