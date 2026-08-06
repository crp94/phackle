// @vitest-environment jsdom
//
// gr6-092 — §2.10's walk had two homes.
//
// `share.ts`'s `buildTrail` (the end-of-day share string, which leaves the app
// and is pasted into other people's timelines) and
// `components/ForkTrail.tsx`'s `buildLiveTrail` (the Lab's live strip) each
// carried their own copy of the same rule: the first VIEW_SPEC is free, later
// ones count iff `seen`, a peek always counts. ForkTrail's own comment
// admitted the duplication and explained it — the walk simply was not
// exported. It is now, and this file is the net: the two consumers are driven
// off the SAME logs and asserted to agree with each other AND with
// `countForks`, which is the number the share string prints in words on the
// very next line.
//
// jsdom because half the proof is a real render of the real component.
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { ForkTrail } from '../../src/ui/components/ForkTrail';
import { PREREG_PREFIX, walkForkGlyphs, shareString, SUBMIT_EMOJI, ABANDON_EMOJI } from '../../src/game/share';
import { countForks } from '../../src/game/forkLog';
import { copy as enCopy } from '../../src/content/en/copy';
import type { PlayerAction, Spec } from '../../src/engine/types';

const baseSpec: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

function spec(overrides: Partial<Omit<Spec, 'covariates'>> = {}): Spec {
  return { ...baseSpec, ...overrides };
}

const view = (s: Spec, seen: boolean, at: number): PlayerAction => ({ t: 'VIEW_SPEC', spec: s, seen, at });
const peek = (at: number): PlayerAction => ({ t: 'PEEK_AND_EXTEND', newN: 250, at });

/** Mid-play logs — what the Lab actually holds while it is showing. */
const MID_PLAY_LOGS: Record<string, PlayerAction[]> = {
  'nothing but the free default': [view(baseSpec, false, 0)],
  'one seen change': [view(baseSpec, false, 0), view(spec({ outcome: 1 }), true, 1)],
  'an unseen change costs nothing': [view(baseSpec, false, 0), view(spec({ outcome: 1 }), false, 1)],
  'peeks always count': [view(baseSpec, false, 0), peek(1), peek(2)],
  'a long mixed run': [
    view(baseSpec, false, 0),
    view(spec({ subgroup: 'urban' }), true, 1),
    peek(2),
    view(spec({ exclusion: 'z2' }), false, 3),
    view(spec({ tails: 'one' }), true, 4),
    peek(5),
    view(spec({ outcome: 2 }), true, 6),
  ],
  'an empty log': [],
};

afterEach(cleanup);

describe('walkForkGlyphs (gr6-092) — one walk, two consumers, one answer', () => {
  it.each(Object.entries(MID_PLAY_LOGS))('%s: one glyph per counted fork, matching countForks exactly', (_label, log) => {
    // §1(i): the walker returns ONE ELEMENT PER FORK, so this is a plain
    // length check — no Array.from, no UTF-16 arithmetic, and no way for a
    // surrogate pair to be miscounted by either consumer.
    expect(walkForkGlyphs(log)).toHaveLength(countForks(log));
  });

  it.each(Object.entries(MID_PLAY_LOGS))('%s: the Lab renders exactly the walker\'s output', async (_label, log) => {
    render(
      <LocaleProvider>
        <ForkTrail log={log} mode="hack" />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(enCopy['lab.forkTrailLabel'])).toBeTruthy());
    const rendered = document.querySelector('.ph-fork-trail__glyphs')?.textContent ?? '';
    // The component substitutes an em-dash placeholder for an empty trail —
    // that is presentation, and the only difference it is allowed to have.
    expect(rendered).toBe(walkForkGlyphs(log).join('') || '—');
  });

  it.each(Object.entries(MID_PLAY_LOGS))(
    '%s: the share string is the SAME walk plus its terminal, never a second opinion',
    (_label, log) => {
      const terminated = [...log, { t: 'SUBMIT', spec: baseSpec, p: 0.01, at: 99 } as PlayerAction];
      const line2 = shareString({
        puzzleNumber: 5,
        log: terminated,
        mode: 'hack',
        callCorrect: null,
        streak: 1,
        copy: enCopy,
      }).split('\n')[1];
      // §1(i): line 2 now GROUPS the run in fives and separates the groups
      // (and the terminal) with U+0020. Asserted with the separators removed
      // rather than by re-deriving the grouping here: that keeps this file's
      // claim the one it was written to make — the share string reads the
      // SAME walk, in the same order, and adds only its terminal — while
      // share.test.ts owns the group SHAPE. A regrouping bug that dropped,
      // duplicated or reordered a glyph still reds here.
      expect(line2.replace(/ /g, '')).toBe(walkForkGlyphs(terminated).join('') + SUBMIT_EMOJI);
      // ...and the walk is blind to the terminal, so the Lab's strip is a
      // strict prefix of what the day will eventually share.
      expect(walkForkGlyphs(terminated)).toEqual(walkForkGlyphs(log));
    }
  );

  it('the abandon terminal is the share string\'s alone — the Lab never shows one', async () => {
    const log: PlayerAction[] = [view(baseSpec, false, 0), view(spec({ outcome: 1 }), true, 1)];
    const abandoned: PlayerAction[] = [...log, { t: 'ABANDON', at: 2 }];
    render(
      <LocaleProvider>
        <ForkTrail log={abandoned} mode="hack" />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(enCopy['lab.forkTrailLabel'])).toBeTruthy());
    const rendered = document.querySelector('.ph-fork-trail__glyphs')?.textContent ?? '';
    expect(rendered).not.toContain(ABANDON_EMOJI);
    expect(rendered).toBe(walkForkGlyphs(log).join(''));
  });

  it('the prereg prefix is the call site\'s, and both call sites spell it the same way', async () => {
    const log: PlayerAction[] = [view(baseSpec, false, 0), view(spec({ outcome: 1 }), false, 1)];
    render(
      <LocaleProvider>
        <ForkTrail log={log} mode="prereg" />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText(enCopy['lab.forkTrailLabel'])).toBeTruthy());
    const rendered = document.querySelector('.ph-fork-trail__glyphs')?.textContent ?? '';
    expect(rendered.startsWith(PREREG_PREFIX)).toBe(true);

    const line2 = shareString({ puzzleNumber: 1, log, mode: 'prereg', callCorrect: null, streak: 0, copy: enCopy })
      .split('\n')[1];
    expect(line2.replace(/ /g, '')).toBe(`${PREREG_PREFIX}${walkForkGlyphs(log).join('')}${SUBMIT_EMOJI}`);
  });
});
