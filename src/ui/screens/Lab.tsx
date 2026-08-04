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
    <section className="ph-lab" data-testid="lab-screen">
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
      <header className="ph-lab__question" data-testid="lab-question">
        <h2 className="ph-lab__question-text">{scenario.question}</h2>
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
            (R5.5's budget is exhaustive and accordion slides are named in it
            as forbidden). Open by default — a first-timer must not have to
            discover the instructions — and gone for good once dismissed. */}
        {introSeen ? null : (
          <details className="ph-lab__intro" data-testid="lab-intro" open>
            <summary className="ph-lab__intro-title">{t('lab.howThisWorks.title')}</summary>
            <ol className="ph-lab__intro-steps">
              {HOW_TO_PLAY_STEPS.map((key) => (
                <li key={key} className="ph-lab__intro-step" data-testid="lab-intro-step">
                  {t(key)}
                </li>
              ))}
            </ol>
            <button type="button" className="ph-lab__intro-dismiss" onClick={dismissIntro}>
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
          className="ph-lab__collect"
          disabled={!canCollectMore}
          onClick={() => void peekAndExtend()}
        >
          {t('lab.collectMore', { n: STEP })}
        </button>
        {peeks >= 1 ? <p className="ph-lab__footnote">{t('lab.peekFootnote')}</p> : null}
        {peeks >= 2 ? (
          <p className="ph-lab__footnote ph-lab__footnote--armitage">{t('lab.peekFootnoteArmitage')}</p>
        ) : null}
        <ForkTrail log={log} mode={mode} />
        {/* T31 fix round (review finding 4, "RESTORED REQUIREMENT"): the
            trail's own emoji are otherwise unexplained anywhere in the Lab —
            this quiet --muted line points at the Legend page, which owns the
            actual key. Reuses .ph-lab__footnote's existing styling rather
            than adding a new rule (R8.3: it must not compete with the dial). */}
        <p className="ph-lab__footnote" data-testid="lab-fork-trail-hint">
          {t('lab.forkTrailHint')}
        </p>
        <div className="ph-lab__actions">
          <button type="button" className="ph-lab__submit" disabled={!canSubmit} onClick={() => void submit()}>
            {t('lab.submit')}
          </button>
          <button type="button" className="ph-lab__abandon" onClick={() => void abandon()}>
            {t('lab.reportNull')}
          </button>
        </div>
      </div>
      <div className="ph-lab__controls">
        <SpecControls spec={spec} onChange={changeSpec} scenario={scenario} disabled={false} />
      </div>
    </section>
  );
}
