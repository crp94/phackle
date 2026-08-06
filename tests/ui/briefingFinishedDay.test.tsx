// @vitest-environment jsdom
//
// gr6-008 (BLOCKER) — the finished-day replay hole.
//
// Measured on the production build, puzzle #5: honest day (abandon -> call ->
// reveal -> summary, "Integrity bonus 80", share string emitted), then reload:
//
//     chooser present      : no
//     cta                  : "OPEN THE DATA" enabled=true
//     REPLAYED the same day: Lab reopened at p = 0.147
//
// The one-play-per-day guard lived ONLY inside the mode chooser, and the
// chooser only exists once `first_retraction` is unlocked. So the guard was
// absent for (a) every player on day one and (b) permanently for the honest
// player, who by definition never publishes and therefore never earns a
// retraction. The replay reached Published, the CALL and a whole second
// verdict experience, then hit a Summary whose saveDay/saveAchievements are
// skipped by `alreadySaved` — with no message. A score, a streak line and a
// share string that were never recorded. A "one play per day" rule that only
// exists for players who cheat is the wrong way round.
//
// A separate file from tests/ui/briefing.test.tsx deliberately: that file
// belongs to another wave in this review, and a new file cannot collide with
// whatever it becomes.
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { useStore as zustandUseStore } from 'zustand/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import { createGameStore, type GameStore } from '../../src/game/store';
import { copy as enCopy } from '../../src/content/en/copy';
import { isoFromPuzzleNumber } from '../../src/game/puzzleDate';
import type { DayRecord } from '../../src/engine/types';
import type { PersistedState } from '../../src/game/storage';
import { Briefing } from '../../src/ui/screens/Briefing';

const PUZZLE_NUMBER = 5;
const ISO = isoFromPuzzleNumber(PUZZLE_NUMBER);

/**
 * The finished-day countdown's shape, DERIVED FROM ITS OWN COPY KEY rather
 * than retyped as an English literal: the key's text with every regex
 * metacharacter escaped and its two tokens replaced by `\d+`. What these two
 * assertions are actually about is that BOTH tokens were substituted — a raw
 * "{hours}" on screen means t() never received them — and deriving the
 * pattern says exactly that and nothing more. Retyping the sentence instead
 * pins the wording as well, which is how these two tests came to name
 * `summary.nextIn`'s English text in a file about the Briefing.
 */
const COUNTDOWN_SHAPE = new RegExp(
  `^${enCopy['briefing.finishedNextIn']
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace('\\{hours\\}', '\\d+')
    .replace('\\{minutes\\}', '\\d+')}$`
);

function freshV1(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    version: 1,
    history: {},
    stats: {
      streak: 0,
      maxStreak: 0,
      callsCorrect: 0,
      callsTotal: 0,
      careerPoints: 0,
      preregDays: 0,
      hackDays: 0,
      forkHistogram: [],
    },
    achievements: {},
    settings: {},
    ...overrides,
  };
}

function record(overrides: Partial<DayRecord> = {}): DayRecord {
  return {
    mode: 'hack',
    score: 80,
    forks: 2,
    stamp: 'CONFIRMED_NULL',
    shareString: 'P-hackle #5\n🍴🏳️ → ⚖️✅\nForks: 1 · Streak: 1\nhttps://phackle.carlosrodriguezpardo.es',
    ...overrides,
  };
}

function seed(state: PersistedState) {
  window.localStorage.setItem('phackle.v1', JSON.stringify(state));
}

function renderBriefing({ practice = false }: { practice?: boolean } = {}) {
  const store = createGameStore();
  const openData = vi.fn();
  const chooseMode = vi.fn();
  store.setState({
    scenarioIndex: 0,
    puzzleNumber: PUZZLE_NUMBER,
    practice,
    openData: openData as unknown as GameStore['openData'],
    chooseMode: chooseMode as unknown as GameStore['chooseMode'],
  });
  function useFakeStore<T>(selector: (s: GameStore) => T): T {
    return zustandUseStore(store, selector);
  }
  const utils = render(
    <LocaleProvider>
      <Briefing useStore={useFakeStore} />
    </LocaleProvider>
  );
  return { openData, chooseMode, ...utils };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Briefing — the finished-day guard (gr6-008)', () => {
  it('DAY ONE, HONEST PATH: a completed hack day with no unlocks at all shows the finished state, not "Open the data"', async () => {
    // The exact state gr2-004 reproduced: an honest abandon, so `achievements`
    // is empty (no first_blood, no first_retraction, no chooser) and the ONLY
    // record of the day is history[iso].hack.
    seed(freshV1({ history: { [ISO]: { hack: record() } } }));
    renderBriefing();

    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByText(enCopy['briefing.openData'])).toBeNull();
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
  });

  it('offers no way to re-enter the day: no enabled control on the screen dispatches a play action', async () => {
    seed(freshV1({ history: { [ISO]: { hack: record() } } }));
    const { openData, chooseMode } = renderBriefing();
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());

    for (const button of screen.queryAllByRole('button')) fireEvent.click(button);
    expect(openData).not.toHaveBeenCalled();
    expect(chooseMode).not.toHaveBeenCalled();
  });

  it('renders the day\'s own share string and the countdown to the next puzzle', async () => {
    // The clock is pinned to the puzzle's own date: w6-r-006 suppresses the
    // countdown once the wall clock has rolled past it, and this test is
    // about the ordinary in-day case.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(`${ISO}T10:00:00`));
    try {
      const rec = record();
      seed(freshV1({ history: { [ISO]: { hack: rec } } }));
      renderBriefing();

      await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
      // gr6-008's copy half: this block speaks in its OWN pair now. The
      // chooser's terse status (`briefing.alreadyPlayedToday`) belongs to the
      // dead option inside the chooser and must not surface here — a screen
      // whose whole content is "Already played today" says nothing about the
      // day it is showing you.
      expect(screen.getByText(enCopy['briefing.finishedToday'])).toBeTruthy();
      expect(screen.queryByText(enCopy['briefing.alreadyPlayedToday'])).toBeNull();
      expect(screen.getByTestId('briefing-finished-share').textContent).toBe(rec.shareString);
      // The countdown's own copy key, with both tokens substituted (a raw
      // "{hours}" would mean t() never received them).
      const countdown = screen.getByTestId('briefing-finished-countdown').textContent ?? '';
      expect(countdown).toMatch(COUNTDOWN_SHAPE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a FRESH day one — nothing played — still opens normally', async () => {
    seed(freshV1());
    const { openData } = renderBriefing();

    await waitFor(() => expect(screen.getByText(enCopy['briefing.openData'])).toBeTruthy());
    expect(screen.queryByTestId('briefing-finished')).toBeNull();
    fireEvent.click(screen.getByText(enCopy['briefing.openData']));
    expect(openData).toHaveBeenCalledTimes(1);
  });

  // §1(j) — THE SAME-DAY REOPENING DECISION, WHICH IS "NO", PINNED.
  //
  // W6 shipped the opposite of this assertion and named it W12's decision to
  // make: with prereg unlocked, a spent hack day left the chooser standing
  // with prereg live, so the player could play the same puzzle twice. Between
  // the two plays sits Act II — day type, true outcome, the whole enumerated
  // curve with every significant path marked — and `scorePrereg` is a
  // function of `(preregSig, dayType)` alone, so the second play is a
  // guaranteed 150 (`preregSigEffect`) for anyone who paid attention. The
  // day's mode is chosen once. The reasoning lives at Briefing.tsx's
  // `preregAvailable`; this is its guard.
  it('a hack day spent today FINISHES the day even with prereg unlocked — the second mode is not a second attempt', async () => {
    seed(
      freshV1({
        history: {
          '2026-08-01': { hack: record({ stamp: 'CONFIRMED_NULL' }) },
          [ISO]: { hack: record({ stamp: 'RETRACTED' }) },
        },
      })
    );
    renderBriefing();

    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
    expect(screen.queryByRole('button', { name: enCopy['briefing.playPrereg'] })).toBeNull();
    expect(screen.queryByRole('button', { name: enCopy['briefing.openData'] })).toBeNull();
  });

  // The state that still HAS a choice in it: unlocked, and today untouched.
  // Without this the file could pass by never rendering a chooser at all.
  it('a completed day in history and nothing spent today: the chooser, with both modes live', async () => {
    seed(freshV1({ history: { '2026-08-01': { hack: record({ stamp: 'CONFIRMED_NULL' }) } } }));
    renderBriefing();

    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());
    expect(screen.queryByTestId('briefing-finished')).toBeNull();
    expect(
      screen.getByRole('button', { name: enCopy['briefing.playHacking'] }).hasAttribute('disabled')
    ).toBe(false);
    expect(
      screen.getByRole('button', { name: enCopy['briefing.playPrereg'] }).hasAttribute('disabled')
    ).toBe(false);
  });

  // Still reachable, but only from storage a past build wrote (or a hand
  // edit): §1(j) makes a live app spend at most one mode per date.
  it('BOTH modes spent: the finished state takes over from the all-disabled chooser', async () => {
    seed(
      freshV1({
        history: { [ISO]: { hack: record({ stamp: 'RETRACTED' }), prereg: record({ mode: 'prereg' }) } },
      })
    );
    renderBriefing();

    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
  });

  // Was "prereg played but hacking still available: the plain CTA". Same
  // decision, mirrored: a spent prereg day does not hand the player Hacking
  // Mode as a consolation second attempt at the same puzzle.
  it('prereg spent today finishes the day too — hacking is not offered afterwards', async () => {
    seed(freshV1({ history: { [ISO]: { prereg: record({ mode: 'prereg' }) } } }));
    renderBriefing();

    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByRole('button', { name: enCopy['briefing.openData'] })).toBeNull();
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
  });

  it('a record under a DIFFERENT date never blocks today', async () => {
    seed(freshV1({ history: { '2026-01-01': { hack: record() } } }));
    renderBriefing();
    // §1(j)(1): that other date is also what unlocks the chooser now, so the
    // "today is still playable" evidence is the chooser rather than the bare
    // CTA. Both modes live, and no finished block.
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());
    expect(screen.queryByTestId('briefing-finished')).toBeNull();
    expect(
      screen.getByRole('button', { name: enCopy['briefing.playHacking'] }).hasAttribute('disabled')
    ).toBe(false);
  });

  it('on a double-played day the share line is the HACK record, consistently (w6-r-004)', async () => {
    // There is no timestamp in a DayRecord, so "which did they finish last"
    // is not knowable and the choice is arbitrary. It is pinned to hack-first
    // so that it is at least CONSISTENT with achievements.ts's own documented
    // same-date ordering ("hack's call is treated as preceding prereg's").
    // The earlier prereg-first rule was justified as showing "the later of the
    // two", which was simply false: driven prereg-then-hack, the screen printed
    // the prereg line for a day whose last play was the hack one.
    const hackRec = record({ shareString: 'P-hackle #5 hack line' });
    const preregRec = record({ mode: 'prereg', shareString: '🧾📄 prereg line' });
    seed(
      freshV1({
        history: { [ISO]: { hack: hackRec, prereg: preregRec } },
        achievements: { first_retraction: '2026-08-01' },
      })
    );
    renderBriefing();
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.getByTestId('briefing-finished-share').textContent).toBe(hackRec.shareString);
  });

  it('falls back to the prereg record when that is the only one the day holds', async () => {
    // W6 wrote this arm as unreachable-until-W12 and asserted the CTA
    // instead. It is reachable now: a day whose only record is a prereg one
    // is a finished day, and its share line is that record's.
    const preregRec = record({ mode: 'prereg', shareString: '🧾 📄 prereg line' });
    seed(freshV1({ history: { [ISO]: { prereg: preregRec } } }));
    renderBriefing();
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.getByTestId('briefing-finished-share').textContent).toBe(preregRec.shareString);
  });
});

// --- w6-r-001: practice mode is never locked out ---------------------------
//
// The finished-day guard read only `history[iso]`, and `App.tsx` boots with
// `localIsoDate()` even under `?practice=1` — so once the real day was in
// history, opening the practice URL rendered the finished block with zero
// CTAs and no way to play. Practice replays are legitimate and documented
// (they are what testers and streamers use), and the persistence layer
// already knows it: `persistAndComputeSummary` skips `saveDay` entirely on a
// practice day, so a practice run can neither consume nor be consumed by the
// real day's one-play-per-day budget.
describe('Briefing — practice mode is exempt from the finished-day guard (w6-r-001)', () => {
  it('a finished REAL day does not lock out a practice boot', async () => {
    seed(freshV1({ history: { [ISO]: { hack: record() } } }));
    const { openData } = renderBriefing({ practice: true });

    // §1(j)(1): that real record is also a completed day, so the practice boot
    // now lands on the chooser rather than the bare CTA — with BOTH modes
    // live, because a practice session has spent neither. The claim under test
    // is unchanged: the real day's record does not lock practice out.
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());
    expect(screen.queryByTestId('briefing-finished')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: enCopy['briefing.playHacking'] }));
    expect(openData).toHaveBeenCalledTimes(1);
  });

  it('practice is exempt even when BOTH modes are spent on the real day', async () => {
    seed(
      freshV1({
        history: { [ISO]: { hack: record({ stamp: 'RETRACTED' }), prereg: record({ mode: 'prereg' }) } },
      })
    );
    const { openData, chooseMode } = renderBriefing({ practice: true });

    // The chooser, with BOTH options live: in a practice session nothing has
    // been "already played", because a practice session records nothing.
    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());
    expect(screen.queryByTestId('briefing-finished')).toBeNull();
    const hack = screen.getByRole('button', { name: enCopy['briefing.playHacking'] });
    const prereg = screen.getByRole('button', { name: enCopy['briefing.playPrereg'] });
    expect(hack.hasAttribute('disabled')).toBe(false);
    expect(prereg.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(enCopy['briefing.alreadyPlayedToday'])).toBeNull();

    fireEvent.click(hack);
    expect(openData).toHaveBeenCalledTimes(1);
    fireEvent.click(prereg);
    expect(chooseMode).toHaveBeenCalledWith('prereg');
  });

  it('[re-review] the exemption reaches the CHOOSER\'s per-option guards, not just the finished block', async () => {
    // The residual the re-review caught. `dayFinished` was exempt, but the
    // chooser's own `disabled={hackPlayedToday}` was not — so a practice
    // player who had unlocked prereg and already played today's REAL hack day
    // got a chooser whose hacking option was dead:
    //     hacking disabled: true, prereg disabled: false
    // The exemption belongs at the two definitions, where every consumer sees
    // it, not at one of the three places that read them.
    seed(freshV1({ history: { [ISO]: { hack: record({ stamp: 'RETRACTED' }) } } }));
    const { openData } = renderBriefing({ practice: true });

    await waitFor(() => expect(screen.getByTestId('mode-chooser')).toBeTruthy());
    const hack = screen.getByRole('button', { name: enCopy['briefing.playHacking'] });
    expect(hack.hasAttribute('disabled'), 'practice hacking was locked out by the real day').toBe(false);
    expect(screen.queryByText(enCopy['briefing.alreadyPlayedToday'])).toBeNull();
    fireEvent.click(hack);
    expect(openData).toHaveBeenCalledTimes(1);
  });

  it('[re-review] the same storage in a REAL session still spends the day', async () => {
    // The other half: the exemption must be practice-only. §1(j) moved where
    // that shows — the real session gets the finished state now, not a chooser
    // with one dead option — but the proposition is the same one, and it is
    // the mirror of the practice case directly above it.
    seed(freshV1({ history: { [ISO]: { hack: record({ stamp: 'RETRACTED' }) } } }));
    renderBriefing({ practice: false });

    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByTestId('mode-chooser')).toBeNull();
  });

  it('the exemption is practice-ONLY: the same storage locks the real day', async () => {
    seed(freshV1({ history: { [ISO]: { hack: record() } } }));
    renderBriefing({ practice: false });
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
  });
});

// --- w6-r-006: never print a countdown that is wrong -----------------------

describe('Briefing — the finished-day countdown is suppressed once the puzzle date is stale (w6-r-006)', () => {
  const realNow = Date.now;
  afterEach(() => {
    vi.useRealTimers();
    Date.now = realNow;
  });

  it('prints the countdown while the finished day IS today', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(`${ISO}T10:00:00`));
    seed(freshV1({ history: { [ISO]: { hack: record() } } }));
    renderBriefing();
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.getByTestId('briefing-finished-countdown').textContent).toMatch(COUNTDOWN_SHAPE);
  });

  it('prints NO countdown once the wall clock has rolled past the puzzle\'s own date', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Five minutes past midnight: the next puzzle is one reload away, and
    // "Next puzzle in 23h 55m" would be an actively misleading instruction.
    vi.setSystemTime(new Date(`${ISO}T00:05:00`));
    vi.setSystemTime(new Date(new Date(`${ISO}T00:05:00`).getTime() + 24 * 3_600_000));
    seed(freshV1({ history: { [ISO]: { hack: record() } } }));
    renderBriefing();
    await waitFor(() => expect(screen.getByTestId('briefing-finished')).toBeTruthy());
    expect(screen.queryByTestId('briefing-finished-countdown')).toBeNull();
    // The rest of the finished state still stands.
    expect(screen.getByTestId('briefing-finished-share')).toBeTruthy();
  });
});
