// The BRIEFING screen (master spec §2.3; DESIGN.md throughout) -- the
// manuscript title page and Prof. Grantwell's daily email, Act I's setup.
// Reads ONLY the store + useLocale content, behind the app-level loading
// gate (see src/ui/App.tsx) -- no props are required in real use.
//
// Standalone screen component (controller amendment, same pattern as
// src/ui/screens/Published.tsx): the store hook is injected via `useStore`
// (defaulting to the app's real singleton, src/game/store.ts's useGameStore)
// purely so tests can seed an isolated fake store instead of touching that
// real singleton -- see tests/ui/briefing.test.tsx's makeFakeStoreHook.
import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore, type UseGameStore } from '../../game/store';
import { isoFromPuzzleNumber } from '../../game/puzzleDate';
import { pickGrantwellEmail } from '../../game/briefing';
import { loadState } from '../../game/storage';
import { preregUnlockedBy } from '../../game/dayComplete';
import { localIsoDate, msToNextLocalMidnight } from '../../game/daily';
import { EmailCard } from '../components/EmailCard';
import './Briefing.css';

/** Same cadence Summary.tsx refreshes its own countdown at, and for the same
 * reason: a plain text update on an interval, not a CSS animation, so it is
 * not a motion site under DESIGN.md R5.2 at all. */
const COUNTDOWN_REFRESH_MS = 30_000;

export interface BriefingProps {
  /** Defaults to the app's real singleton store hook. Tests inject an
   * isolated `createGameStore()` instance instead (never the real
   * singleton) -- see this file's own header comment. */
  useStore?: UseGameStore;
}

export function Briefing({ useStore = useGameStore }: BriefingProps = {}) {
  const { content, t } = useLocale();
  const scenarioIndex = useStore((s) => s.scenarioIndex);
  const puzzleNumberValue = useStore((s) => s.puzzleNumber);
  const openData = useStore((s) => s.openData);
  const chooseMode = useStore((s) => s.chooseMode);
  // w6-r-001: read for the finished-day guard's practice exemption below.
  const practice = useStore((s) => s.practice);

  // The finished-day countdown below (gr6-008). Mounted unconditionally
  // because hooks must be: it is one 30s text refresh, and on the ordinary
  // "day still to play" path nothing reads it.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Behind the app-level loading gate (src/ui/App.tsx never mounts a screen
  // until content resolves) -- this narrows the type and is a safety net,
  // not a second, competing loading UI.
  if (!content) return null;

  const scenario = content.scenarios[scenarioIndex];
  const iso = isoFromPuzzleNumber(puzzleNumberValue);
  const grantwellBody = pickGrantwellEmail(content.grantwell, iso);

  // T18: the mode chooser (§2.2 "prereg unlocked: choose mode first"). A
  // plain synchronous read (loadState() touches localStorage, not a promise —
  // same convention Summary.tsx's persistAndComputeSummary already uses),
  // computed fresh on every render: nothing else can change achievements/
  // history WHILE the player is looking at this screen, so there is no
  // staleness window worth guarding with an effect. `unlocked` gates the
  // chooser's very existence; `preregPlayedToday`/`hackPlayedToday` are the
  // PER-OPTION "already played" belt-and-suspenders disablement the
  // controller asked for on top of the persist-layer guard
  // (Summary.tsx's own `alreadySaved`) that already blocks a double SCORE —
  // this is the separate UI-layer guard against double ENTRY.
  const state = loadState();
  const today = state.history[iso];

  // w6-r-001 — PRACTICE MODE IS EXEMPT, and the exemption lives HERE.
  //
  // `history` is keyed by the real calendar date, and App.tsx boots with
  // `localIsoDate()` even under `?practice=1`, so a practice session reads the
  // REAL day's record. Practice replays are legitimate and documented (they
  // are what testers and streamers use), and the persistence layer already
  // agrees: `dayComplete.ts`'s persistAndComputeSummary skips `saveDay`
  // entirely on a practice day, so a practice run can neither consume the real
  // day's one-play budget nor be consumed by it. A rule whose whole claim is
  // "your RECORDED day is already recorded" has nothing to say about a session
  // that records nothing.
  //
  // Fix round 2 (re-review): this started life as a `!practice` conjunct on
  // `dayFinished` alone, which left the chooser's OWN per-option guards —
  // `disabled={hackPlayedToday}` / `disabled={preregPlayedToday}` below —
  // still reading the real day. Measured: a practice session with prereg
  // unlocked and the real hack day spent rendered `hacking disabled: true,
  // prereg disabled: false`, so the one mode practice actually boots into was
  // the one it could not enter. Putting the exemption at the two DEFINITIONS
  // is the one-place form: every consumer (the finished-day guard, both
  // chooser options, both "already played" status lines, the chooser's own
  // visibility) inherits it, and no future reader of these two booleans has to
  // remember to re-apply it.
  const hackPlayedToday = !practice && today?.hack !== undefined;
  const preregPlayedToday = !practice && today?.prereg !== undefined;

  // gr6-008 — THE ONE-PLAY-PER-DAY RULE, MOVED TO WHERE IT BELONGS.
  //
  // This guard used to live only inside the chooser below, which only exists
  // once `first_retraction` is unlocked. So it was absent for every player on
  // day one, and absent PERMANENTLY for the honest player — who by definition
  // never publishes and therefore never earns a retraction. Measured on the
  // production build: finish an honest day, reload, and "OPEN THE DATA" was
  // enabled again; the replay walked the whole day a second time and landed
  // on a Summary whose saveDay/saveAchievements are skipped by `alreadySaved`,
  // showing a score, a streak and a share string that were never recorded,
  // with no message. A "one play per day" rule that only exists for players
  // who cheat is the wrong way round.
  //
  // The guard is expressed as "is any mode still PLAYABLE today", not as
  // "which achievements are unlocked". That framing is deliberate: `dayFinished`
  // means precisely "no mode is still playable", so it stays correct however
  // availability is later decided — and W12 has now decided it, twice.
  //
  // §1(j)(1) — WHAT OPENS THE CHOOSER. `first_retraction` is gone from this
  // expression: the mode that cures p-hacking was gated behind an achievement
  // only a p-hacker can earn, so the honest player never saw it (GR2: honest
  // REPLICATED rate 0/30, structurally). The gate is `preregUnlockedBy`, "you
  // have finished a day" — see its doc comment in game/dayComplete.ts for the
  // whole reasoning, including why it inherits the practice exemption from the
  // data instead of restating it.
  //
  // §1(j) SAME-DAY REOPENING — THE DELIBERATE DECISION, WHICH IS *NO*.
  //
  // W6 left this open and named it W12's to make: widening the unlock
  // legitimately un-finishes a day that still has an unspent prereg attempt,
  // so an honest day-one, finished this afternoon, could become a prereg-only
  // chooser this evening. (The same reopening is already reachable today for
  // any player who earns `first_retraction`, so this is a decision about
  // existing behaviour as much as about new behaviour.)
  //
  // IT IS REFUSED, and the reason is not budget, it is meaning. Between the
  // two plays sits Act II, which shows the player the day type, the true
  // outcome, and the entire enumerated specification curve with every
  // significant path marked. Preregistering after that is not preregistration;
  // `prereg.intro` and `summary.preregUpsell` both say so in the product's own
  // words — "before you see a single number". And the scoring makes the
  // consequence exact rather than merely inelegant: `scorePrereg` is a
  // function of `(preregSig, dayType)` and nothing else, so a player returning
  // from the reveal knows both, can commit a path they have already watched
  // come back significant, and collects `preregSigEffect` — 150, the largest
  // single figure in the game — with certainty, every day, forever. A mode
  // whose whole subject is committing in ignorance cannot be replayable by
  // someone who has just been shown the answer.
  //
  // So the day's mode is chosen ONCE. `briefing.modeChooserIntro` says this to
  // the player in the same breath as it offers the choice ("One attempt, one
  // mode."), which is where a rule like this belongs.
  const preregAvailable = preregUnlockedBy(state.history);
  const modeSpentToday = hackPlayedToday || preregPlayedToday;
  const hackPlayable = !modeSpentToday;
  const preregPlayable = preregAvailable && !modeSpentToday;

  // No `!practice` conjunct needed here: it is already carried by
  // `hackPlayedToday`/`preregPlayedToday` above, which make `modeSpentToday`
  // unconditionally false in a practice session — see those definitions for
  // the whole reasoning.
  const dayFinished = !hackPlayable && !preregPlayable;

  // The chooser itself only makes sense while there is still a choice left
  // to make today: once either mode is spent, the day is finished (above) and
  // this branch is not reached at all.
  const showChooser = preregAvailable && !modeSpentToday;

  // What the day actually produced, for the finished state's share line.
  //
  // w6-r-004: ARBITRARY, and said so. A DayRecord carries no timestamp, so
  // "which of the two did they finish last" is not knowable from storage —
  // the previous rule picked prereg and justified it as "the later of the
  // two", which was simply false (driven prereg-then-hack, the screen printed
  // the prereg line for a day whose last play was the hack one). The choice
  // is pinned to hack-first purely so that it is CONSISTENT with the only
  // same-date ordering this codebase already documents: achievements.ts's
  // chronologicalCalls, "hack's call is treated as preceding prereg's — an
  // arbitrary but deterministic tie-break".
  const finishedRecord = today?.hack ?? today?.prereg;

  // w6-r-006 — DO NOT PRINT A COUNTDOWN THAT IS WRONG.
  //
  // `iso` is the puzzle's own date (fixed at boot); `msToNextLocalMidnight`
  // reads the live wall clock. In the straddle window — the player sits on
  // this screen past a real midnight, or leaves the tab open overnight — those
  // two disagree, and "Next puzzle in 23h 55m" tells the player to come back
  // tomorrow for a puzzle that is already one reload away. The number is
  // suppressed rather than printed wrong.
  //
  // NOT a full fix, and deliberately not attempted here. The staleness is
  // app-shell-wide, not this screen's: App.tsx boots once with
  // `localIsoDate()` and never re-reads it, so after that midnight the
  // scenario question, the Grantwell email and the header's issue number are
  // all yesterday's too (Summary's own countdown has the identical bug). The
  // right affordance is "a new puzzle is ready — reload", which needs a copy
  // key; the catalog is frozen for this wave and no existing key means that
  // (`errors.workerCrash` mentions reloading but asserts a failure that did
  // not happen). W2 owns the key, W7 owns App.tsx's re-read. This is the part
  // that can be made honest without either.
  const puzzleDateIsToday = iso === localIsoDate();
  const msLeft = msToNextLocalMidnight(now);
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minutesLeft = Math.floor((msLeft % 3_600_000) / 60_000);

  return (
    <article className="ph-page ph-page--titled ph-briefing">
      {/* Manuscript title page (master spec §2.3/§7.3): the research
          question set as the title, in display serif (R2.1). */}
      <h1 className="ph-briefing__question">{scenario.question}</h1>
      <p className="ph-briefing__corresponding-author">{t('briefing.correspondingAuthor')}</p>
      {/* T31 (second play-test round): the goal, stated outright, before the
          cover story's fiction has a chance to bury it. Sincere and literal —
          this really is the task Act I sets. Hairline-ruled above and below
          (R4.4/R4.5: two edges, never a box), which is how this document
          makes a line prominent without a fill, a shadow or a second colour. */}
      <p className="ph-briefing__goal" data-testid="briefing-goal">
        {t('briefing.goal')}
      </p>
      <p className="ph-briefing__cover-story">{scenario.coverStory}</p>
      {/* gr6-070 — ONE SUBJECT LINE FOR TWENTY-TWO BODIES. This read the
          `briefing.emailSubject` copy key, so "Re: the deadline" sat over a
          body about a rival lab, over a body about a dream, over every body
          in the bank. W3 wrote a subject FOR each one, and the pairing is
          index-for-index: the same picker and the same `iso` as the body one
          line above, over two banks of equal length, so a single seed lands
          on the pair that was written together. The equality is not an
          assumption — tests/content/shape.test.ts asserts it in all three
          locales, and asserts the pairing itself, not merely the count.
          `briefing.emailSubject` is deleted in this same commit: a subject
          line that is now data cannot also be copy. */}
      <EmailCard
        from={t('briefing.emailFrom')}
        subject={pickGrantwellEmail(content.grantwellSubjects, iso)}
        body={grantwellBody}
      />

      {dayFinished ? (
        /* The day's finished state — the same shape the chooser's disabled
           branch already showed, promoted to a state of the screen itself:
           what happened, and when the next one arrives. No CTA of any kind,
           because there is nothing left to press.

           gr6-008's copy half, now landed. This block used to borrow the two
           strings nearest to hand — `briefing.alreadyPlayedToday`, which is a
           STATUS on a dead option inside the chooser ("Already played today"),
           and `summary.nextIn`, which is the Summary's own countdown — and
           borrowing them made this screen read like a form field and an
           invoice footer stapled together. It has its own pair now:
           `briefing.finishedToday` opens the state ("Today's puzzle is
           finished. Here is how it went.") and hands off to the share string
           below it, and `briefing.finishedNextIn` says it in the masthead's
           voice ("The next issue arrives in …"), which is the register this
           screen has spoken since its <h1>. The chooser keeps
           `briefing.alreadyPlayedToday`, where a terse status is right. */
        <div className="ph-briefing__finished" data-testid="briefing-finished">
          <p className="ph-briefing__chooser-status">{t('briefing.finishedToday')}</p>
          {finishedRecord ? (
            <p className="ph-briefing__finished-share" data-testid="briefing-finished-share">
              {finishedRecord.shareString}
            </p>
          ) : null}
          {puzzleDateIsToday ? (
            <p className="ph-briefing__finished-countdown" data-testid="briefing-finished-countdown">
              {t('briefing.finishedNextIn', { hours: hoursLeft, minutes: minutesLeft })}
            </p>
          ) : null}
        </div>
      ) : showChooser ? (
        <div className="ph-briefing__chooser" data-testid="mode-chooser">
          <p className="ph-briefing__chooser-intro">{t('briefing.modeChooserIntro')}</p>
          {/* THE PER-OPTION GUARDS ARE KEPT, AND ARE NOW UNREACHABLE BY
              CONSTRUCTION. `showChooser` already requires `!modeSpentToday`,
              which is the disjunction of the two booleans below, so neither
              `disabled` can be true while this block renders and neither
              status line can appear. They are deliberately not deleted: they
              are the UI-layer guard against double ENTRY (the persist layer's
              `alreadySaved` is the separate guard against a double SCORE), and
              they fail safe against a partially-populated `history[iso]` that
              no code path in this repo writes but a hand-edited or legacy blob
              could. Same class as `saveAchievements`'s unreachable
              changed-tracking, recorded as defensive rather than removed. If a
              later wave re-widens same-day play, these are what make the
              chooser correct again without a second decision. */}
          <div className="ph-briefing__chooser-options">
            <div className="ph-briefing__chooser-option">
              <button type="button" className="ph-briefing__cta ph-focusable ph-label" disabled={hackPlayedToday} onClick={openData}>
                {t('briefing.playHacking')}
              </button>
              {hackPlayedToday ? (
                <p className="ph-briefing__chooser-status">{t('briefing.alreadyPlayedToday')}</p>
              ) : null}
            </div>
            <div className="ph-briefing__chooser-option">
              <button
                type="button"
                className="ph-briefing__cta ph-focusable ph-label"
                disabled={preregPlayedToday}
                onClick={() => chooseMode('prereg')}
              >
                {t('briefing.playPrereg')}
              </button>
              {preregPlayedToday ? (
                <p className="ph-briefing__chooser-status">{t('briefing.alreadyPlayedToday')}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="ph-briefing__cta ph-focusable ph-label" onClick={openData}>
          {t('briefing.openData')}
        </button>
      )}
    </article>
  );
}
