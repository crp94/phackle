// P-hackle's workbench (master spec §2.4, §7.3; DESIGN.md throughout): the
// player turns six knobs (SpecControls) and watches the p-value (PValueDial)
// and the estimate (CoefPlot) update, with a live ForkTrail and the two exit
// actions — SUBMIT TO JOURNAL (gated on a settled, valid, significant
// result) and "Report a null result" (always available).
import { useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore } from '../../game/store';
import { loadState, saveSettings } from '../../game/storage';
import { N_SCHEDULE } from '../../game/tuning';
import { SpecControls } from '../components/SpecControls';
import { PValueDial, PValueDialCaption } from '../components/PValueDial';
import { CoefPlot } from '../components/CoefPlot';
import { DataCut } from '../components/DataCut';
import { ForkTrail } from '../components/ForkTrail';
import type { PlayerAction } from '../../engine/types';
import './Lab.css';

function countPeeks(log: PlayerAction[]): number {
  return log.filter((a) => a.t === 'PEEK_AND_EXTEND').length;
}

const HOW_TO_PLAY_STEPS = [
  'lab.howThisWorks.step1',
  'lab.howThisWorks.step2',
  'lab.howThisWorks.step3',
  'lab.howThisWorks.step4',
] as const;

// N_SCHEDULE's step is constant (200/250/300/350/400 -> always +50) but
// derived here rather than hardcoded, so a future re-tuning of the schedule
// (src/game/tuning.ts, the one file allowed to own this knob) can't silently
// desync the button's own label from what peekAndExtend() actually adds.
const STEP = N_SCHEDULE[1] - N_SCHEDULE[0];

export function Lab() {
  const { t, content } = useLocale();
  const spec = useGameStore((s) => s.spec);
  const result = useGameStore((s) => s.result);
  const pending = useGameStore((s) => s.pending);
  const n = useGameStore((s) => s.n);
  const log = useGameStore((s) => s.log);
  const mode = useGameStore((s) => s.mode);
  const scenarioIndex = useGameStore((s) => s.scenarioIndex);
  const changeSpec = useGameStore((s) => s.changeSpec);
  const peekAndExtend = useGameStore((s) => s.peekAndExtend);
  const submit = useGameStore((s) => s.submit);
  const abandon = useGameStore((s) => s.abandon);

  // T31: the first-run "How to play" panel. Read ONCE, in a lazy initializer,
  // so dismissing it does not race a re-read, and so the panel's presence is
  // decided before the first paint rather than flickering in. `introSeen` is
  // a settings-schema extension (see storage.ts) — absent means never
  // dismissed, which is the right default for both a fresh install and a
  // state written before the field existed. Declared above the `scenario`
  // early return: hooks may not sit behind a conditional.
  const [introSeen, setIntroSeen] = useState(() => loadState().settings.introSeen === true);

  function dismissIntro() {
    saveSettings({ introSeen: true }); // merges: never clobbers theme/locale
    setIntroSeen(true);
  }

  // Guarded for the type checker only: App's own loading gate guarantees
  // `content` (and therefore a real scenario) is already loaded by the time
  // ScreenRouter can ever mount the Lab.
  const scenario = content?.scenarios[scenarioIndex];
  if (!scenario) return null;

  const peeks = countPeeks(log);
  const canSubmit = !!result && result.valid && result.p < 0.05 && !pending;
  const atMaxN = N_SCHEDULE.indexOf(n) === N_SCHEDULE.length - 1;
  const canCollectMore = !atMaxN && !pending && !!result;

  return (
    <section className="ph-page ph-lab" data-testid="lab-screen">
      {/* T29 pin 10 (owner, third play-test round): "the question lives on
          screen 1 but the instructions on screen 2 — by the time you read the
          how-to, the question is gone." The scenario's own question, rendered
          straight from content (it is data, not a copy key — same read
          Briefing.tsx makes of it), above everything else on the screen, so
          WHAT you are investigating and HOW you investigate it are on the
          page together. Compact by construction: display serif at --text-22
          with a hairline beneath (R2.1/R4.4), never the --text-40 title
          treatment Briefing gives it — this is a reminder, not a second
          title page, and R8.3 keeps the dial the only thing that shouts.
          Deliberately NOT part of .ph-lab__dial: that block is the mobile
          sticky element and every pixel added to it is a pixel of the
          controls it can cover (see Lab.css). */}
      {/* T22: <h1>, not <h2>. The Lab is a screen of a single-page app whose
          <main> is torn down and rebuilt on every swap, so each screen is its
          own document as far as assistive technology is concerned — and the
          screen's own title is its level-one heading. The question is the
          Lab's title (it is the same h1 the Briefing gave it), and it was the
          only heading on the screen, which left the Lab starting at level 2
          with no level 1 anywhere. Purely semantic: .ph-lab__question-text
          carries every type declaration, so nothing about the rendering
          changes. */}
      <header className="ph-lab__question" data-testid="lab-question">
        <h1 className="ph-lab__question-text">{scenario.question}</h1>
      </header>

      {/* T29 pin 1 (controller ruling, dial-alone-sticky): the DIAL BLOCK —
          the numeral and its n/df line, nothing else — is a direct child of
          .ph-lab so its containing block spans the controls too, which is
          what lets it stay on screen while a knob at the bottom of the page
          is turned (§2.4's HP-bar mechanic). Its caption renders below, in
          the results pane: a sticky element taller than its share of the
          viewport does not pin, it slides and paints over its siblings. */}
      <div className="ph-lab__dial">
        <PValueDial result={result} pending={pending} />
      </div>

      <div className="ph-lab__results">
        <PValueDialCaption />
        {/* Native <details>: collapsible with no JavaScript and no animation
            (R5.2's register does not list it, and R5.5 names accordion slides
            outright). Open by default — a first-timer must not have to
            discover the instructions — and gone for good once dismissed. */}
        {introSeen ? null : (
          <details className="ph-lab__intro" data-testid="lab-intro" open>
            <summary className="ph-lab__intro-title ph-focusable ph-label">{t('lab.howThisWorks.title')}</summary>
            <ol className="ph-lab__intro-steps">
              {HOW_TO_PLAY_STEPS.map((key) => (
                <li key={key} className="ph-lab__intro-step" data-testid="lab-intro-step">
                  {t(key)}
                </li>
              ))}
            </ol>
            <button type="button" className="ph-lab__intro-dismiss ph-focusable" onClick={dismissIntro}>
              {t('lab.howThisWorks.dismiss')}
            </button>
          </details>
        )}
        <CoefPlot result={result} unit={scenario.outcomeUnits[spec.outcome]} />
        {/* Master spec §2.4's "tiny scatter/box visual of the current cut" —
            the sample the two figures above are built from, with the excluded
            points still drawn. */}
        <DataCut cut={result?.cut ?? null} treatmentLabel={scenario.treatmentLabel} />
        <button
          type="button"
          className="ph-lab__collect ph-focusable"
          disabled={!canCollectMore}
          onClick={() => void peekAndExtend()}
        >
          {t('lab.collectMore', { n: STEP })}
        </button>
        {/* gr6-025 — OPTIONAL STOPPING IS §2.4's CROWN JEWEL AND NOBODY
            PRESSED IT: `one_more_batch` unlocked twice in 96 player-days.
            The button read only as "more data", which is a cost (another
            press, another mark on the trail) with no visible return, so the
            rational read was to skip it. What peeking actually buys is
            visible and specific — the sample grows and the CoefPlot's
            interval narrows with it — and none of that was said anywhere
            near the control. The n it would produce, printed at the button.
            Deliberately NOT reward-gating and NOT making search harder
            (explicitly out of scope): the same press, the same cost, the
            same trail mark; only the offer is legible now.
            Symbols, not words: `→` carries no Latin letters, so this adds no
            uncatalogued copy (tests/content/copyFreeze.test.ts's own rule).
            TODO-W2: the batch's other half — "the interval narrows" — is a
            sentence this catalog does not have; W2's own batch lists a peek
            affordance key for this row, and it belongs beside this line. */}
        {canCollectMore ? (
          <p className="ph-lab__collect-gain" data-testid="lab-collect-gain">
            {t('lab.nLabel', { n })} → {n + STEP}
          </p>
        ) : null}
        {peeks >= 1 ? <p className="ph-lab__footnote">{t('lab.peekFootnote')}</p> : null}
        {/* gr6-024 — `--armitage` was a BEM modifier with no rule anywhere
            in the corpus, and it was the player-visible one: the two peek
            footnotes are documented as differentiated and rendered
            identically, because the only thing that differed was a class
            name nothing styled. The modifier is gone rather than
            implemented — what distinguishes these two lines is what they
            SAY (the sincere note after the first peek, §2.4's sanctioned
            Armitage wink after the second), and R8.3 does not want a second
            typographic voice down here competing with the dial. */}
        {peeks >= 2 ? <p className="ph-lab__footnote">{t('lab.peekFootnoteArmitage')}</p> : null}
        <ForkTrail log={log} mode={mode} />
        {/* T31 fix round (review finding 4, "RESTORED REQUIREMENT"): the
            trail's own emoji are otherwise unexplained anywhere in the Lab —
            this quiet --muted line points at the Legend page, which owns the
            actual key. Reuses .ph-lab__footnote's existing styling rather
            than adding a new rule (R8.3: it must not compete with the dial). */}
        <p className="ph-lab__footnote" data-testid="lab-fork-trail-hint">
          {t('lab.forkTrailHint')}
        </p>
      </div>
      {/* §1(e) ruling + DESIGN.md R8.1's amendment — THE EXIT ACTIONS ARE A
          DIRECT CHILD OF .ph-lab, and sticky below the breakpoint.
          Below 768 the Lab stacks in DOM order (R3.4), so both exit actions
          sat at the foot of the RESULTS block, above every knob: measured at
          360x640, "Submit for publication" at document y 1486 and the last
          knob (One-tailed) at 2894 — a ~1,400px scroll back, about 1.9
          screens, and the one-tailed switch is at once the most effective
          hack in the game and the furthest control from the action it
          enables. Hoisted here rather than left inside .ph-lab__results for
          exactly the reason R8.1's Do gives: a sticky element's containing
          block ends where its parent does, so inside the results pane it
          would stop sticking at the precise scroll position where the knobs
          begin — the distance it exists to close. NOT rendered a second time
          at the foot of the controls (R8.1's Don't: two buttons with one
          meaning). */}
      <div className="ph-lab__actions">
        <button type="button" className="ph-lab__submit ph-focusable" disabled={!canSubmit} onClick={() => void submit()}>
          {t('lab.submit')}
        </button>
        {/* gr6-061 — A SCREEN-READER PLAYER WAS NEVER TOLD PUBLISHING BECAME
            POSSIBLE. The only signal was the native `disabled` flip, which
            is reported on ARRIVAL at the button and nowhere else: a player
            turning knobs with the arrow keys heard the dial's new number
            (the dial's live region is measured correct and is deliberately
            left alone here) and nothing about the door that had just opened.
            A polite status line, rendered only while the result is
            publishable, so it announces on the edge and never repeats.
            Visually hidden — R6.6's idiom, in the a11y tree, off the page —
            because the sighted channel already exists (the button enables,
            the dial turns green).
            TODO-W2: the string is a stand-in — `legend.significant`, which
            is "p < 0.05" in all three locales, and which is precisely the
            fact that just became true and the one thing the dial's own live
            region cannot say (it reads the number, not the threshold it just
            crossed). It is chosen over the dial's caption deliberately: that
            sentence is already on the page, and a hidden second copy of a
            visible paragraph makes a screen reader read the same explanation
            twice. W2's batch lists a submit-status key; the sentence this
            wants is "You can publish this result now." */}
        {canSubmit ? (
          <p className="ph-visually-hidden" role="status" data-testid="lab-submit-status">
            {t('legend.significant')}
          </p>
        ) : null}
        <button type="button" className="ph-lab__abandon ph-focusable" onClick={() => void abandon()}>
          {t('lab.reportNull')}
        </button>
      </div>
      <div className="ph-lab__controls">
        <SpecControls spec={spec} onChange={changeSpec} scenario={scenario} disabled={false} />
      </div>
    </section>
  );
}
