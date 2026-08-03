// @vitest-environment jsdom
//
// T17: the Summary share button's side-effecting counterpart to
// shareString (share.test.ts, plain node) — this one actually touches
// navigator.share/navigator.clipboard, so it needs a DOM environment. jsdom's
// navigator has neither property by default (verified directly against the
// installed jsdom package), so each test assigns exactly what it needs and
// afterEach deletes it, keeping tests isolated from one another.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareViaNavigator } from '../../src/game/share';

afterEach(() => {
  delete (navigator as unknown as { share?: unknown }).share;
  delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  vi.restoreAllMocks();
});

describe('shareViaNavigator — navigator.share, then clipboard, as a fallback chain', () => {
  it('uses navigator.share when available, resolves "shared", and never touches the clipboard', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { share: typeof share }).share = share;
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };

    const result = await shareViaNavigator('P-hackle #1\nline2\nline3\nurl');

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'P-hackle #1\nline2\nline3\nurl' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard and resolves "copied" when navigator.share does not exist', async () => {
    expect('share' in navigator).toBe(false); // sanity: nothing set it this test
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };

    const result = await shareViaNavigator('some share text');

    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('some share text');
  });

  it('falls back to the clipboard and resolves "copied" when navigator.share exists but rejects (e.g. the user cancelled the OS share sheet)', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { share: typeof share }).share = share;
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };

    const result = await shareViaNavigator('cancel-me');

    expect(result).toBe('copied');
    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('cancel-me');
  });

  it('propagates a clipboard failure when there is no share API and the clipboard also fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };

    await expect(shareViaNavigator('x')).rejects.toThrow('clipboard blocked');
  });

  it('throws a clear error rather than silently no-op-ing when neither API exists', async () => {
    expect('share' in navigator).toBe(false);
    expect('clipboard' in navigator).toBe(false);
    await expect(shareViaNavigator('x')).rejects.toThrow();
  });
});
