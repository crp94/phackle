// PREREG — Prereg Mode's own screen (master spec §2.6/§7.3, §2.8): the same
// six SpecControls knobs the Lab uses, rendered as a preregistration FORM
// instead of a live workbench. Deliberately NO PValueDial, NO CoefPlot, no
// live result of any kind — the whole point of §2.8's α lesson only works if
// the player genuinely cannot see a number before committing. The register
// is sincere-bureaucratic, played straight (§7.3's own "I solemnly commit"
// checkbox): the game treats a game mechanic with the gravity of an actual
// preregistration filing, and never winks about it on this screen.
//
// Spec state lives entirely in local component state, never store.spec —
// store.changeSpec is guarded to screen==='lab' only (§2.10's fork-logging
// rule does not apply here at all: nothing is ever shown before commit, so
// there is nothing to "fork" from — see store.ts's own preregCommit doc
// comment). Same `useStore` injection pattern as Briefing.tsx (T15), purely
// for testability: real use defaults to the app's singleton.
import { useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore, DEFAULT_SPEC } from '../../game/store';
import type { UseGameStore } from './Briefing';
import { SpecControls } from '../components/SpecControls';
import type { Spec } from '../../engine/types';
import './Prereg.css';

export interface PreregProps {
  /** Defaults to the app's real singleton store hook — see Briefing.tsx's
   * identical convention and its own header comment for why. */
  useStore?: UseGameStore;
}

export function Prereg({ useStore = useGameStore }: PreregProps = {}) {
  const { content, t } = useLocale();
  const scenarioIndex = useStore((s) => s.scenarioIndex);
  const preregCommit = useStore((s) => s.preregCommit);

  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);
  const [checked, setChecked] = useState(false);
  // Local, not store.pending: this screen's only job while a commit is in
  // flight is to freeze itself (disable the controls/checkbox/button) and
  // say so — it does not need to read the store's own pending flag (which
  // preregCommit() also sets and clears, for OTHER reasons — see that
  // action's doc comment) to know its own submission is underway.
  const [submitting, setSubmitting] = useState(false);

  // Same loading-gate narrowing every other screen behind App's content gate
  // uses (e.g. Briefing.tsx, Lab.tsx) — a safety net, not a second loading UI.
  if (!content) return null;
  const scenario = content.scenarios[scenarioIndex];
  if (!scenario) return null;

  const canSubmit = checked && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    // No .then/.catch: a successful commit moves the store's `screen` to
    // 'reveal', which unmounts this component entirely (registry.ts) — there
    // is nothing left for local state to do. A rejected commit (e.g. a
    // worker crash mid-sequence) surfaces through the SAME store.error ->
    // errors.workerCrash banner every other screen already relies on
    // (ScreenRouter.tsx renders it above whatever screen is current); this
    // screen does not need a second, competing error path. If it rejects
    // without ever changing `screen`, this component stays mounted with
    // `submitting` still true — matching Lab's own disabled-while-pending
    // treatment on a stalled request, not a false "success" state.
    void preregCommit(spec);
  }

  return (
    <section className="ph-prereg" data-testid="prereg-screen">
      {/* T22: <h1> — the screen's own title, and the only heading on it. */}
      <h1 className="ph-prereg__title">{t('prereg.title')}</h1>
      <p className="ph-prereg__intro">{t('prereg.intro')}</p>

      <div className="ph-prereg__controls">
        <SpecControls spec={spec} onChange={setSpec} scenario={scenario} disabled={submitting} />
      </div>

      <label className="ph-prereg__commit">
        <input
          type="checkbox"
          checked={checked}
          disabled={submitting}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>{t('prereg.commit')}</span>
      </label>

      <button type="button" className="ph-prereg__submit" disabled={!canSubmit} onClick={handleSubmit}>
        {t('prereg.submit')}
      </button>

      {submitting ? (
        <p className="ph-prereg__locked" role="status">
          {t('prereg.locked')}
        </p>
      ) : null}
    </section>
  );
}
