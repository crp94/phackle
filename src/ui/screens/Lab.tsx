// P-hackle's workbench (master spec §2.4, §7.3; DESIGN.md throughout): the
// player turns six knobs (SpecControls) and watches the p-value (PValueDial)
// and the estimate (CoefPlot) update, with a live ForkTrail and the two exit
// actions — SUBMIT TO JOURNAL (gated on a settled, valid, significant
// result) and "Report a null result" (always available).
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore } from '../../game/store';
import { N_SCHEDULE } from '../../game/tuning';
import { SpecControls } from '../components/SpecControls';
import { PValueDial } from '../components/PValueDial';
import { CoefPlot } from '../components/CoefPlot';
import { ForkTrail } from '../components/ForkTrail';
import type { PlayerAction } from '../../engine/types';
import './Lab.css';

function countPeeks(log: PlayerAction[]): number {
  return log.filter((a) => a.t === 'PEEK_AND_EXTEND').length;
}

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
      <div className="ph-lab__results">
        <PValueDial result={result} pending={pending} />
        <CoefPlot result={result} unit={scenario.outcomeUnits[spec.outcome]} />
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
