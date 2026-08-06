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
import { useGameStore, DEFAULT_SPEC, type UseGameStore } from '../../game/store';
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

  // gr6-043: read alongside the commit's own local flag — see `frozen` below.
  const storeError = useStore((s) => s.error);

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

  /**
   * gr6-043 — "a commit is underway AND has not failed."
   *
   * The comment below used to describe a path that did not exist: it claimed
   * a rejected commit "surfaces through the SAME store.error ->
   * errors.workerCrash banner", when in fact `preregCommit` had no catch at
   * all. `void` discarded the rejection outright (there is no
   * `unhandledrejection` handler anywhere in src/ or index.html either),
   * `pending` stayed true forever, and preregCommit's OWN `|| s.pending`
   * guard then refused every retry — preregistration was a hard, silent dead
   * end for the rest of the day, on a mode that gets one attempt.
   *
   * The store half of the fix is real now (`withEngineErrors` clears
   * `pending` and routes the message to `error`). This is the screen half: a
   * failure that leaves the day playable must leave the FORM usable too, or
   * the dead end simply moves one layer up. Three states, exhaustively:
   *
   *   - in flight: `submitting` true, no error -> frozen, "Locked in" shows.
   *   - succeeded: the store has already flipped `screen` to 'reveal' and
   *     unmounted this component; nothing here is evaluated at all.
   *   - failed: `error` is set, `pending` is clear, and the controls come
   *     back so the player can commit again under the error banner.
   */
  const frozen = submitting && storeError === null;
  const canSubmit = checked && !frozen;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    // No .then/.catch here: the store no longer rejects (see `frozen` above
    // for the full accounting of what each outcome does to this screen), and
    // a second, competing error path on this screen would only disagree with
    // ScreenRouter's banner.
    void preregCommit(spec);
  }

  return (
    <section className="ph-prereg" data-testid="prereg-screen">
      {/* T22: <h1> — the screen's own title, and the only heading on it. */}
      <h1 className="ph-prereg__title">{t('prereg.title')}</h1>
      <p className="ph-prereg__intro">{t('prereg.intro')}</p>

      <div className="ph-prereg__controls">
        <SpecControls spec={spec} onChange={setSpec} scenario={scenario} disabled={frozen} />
      </div>

      <label className="ph-prereg__commit">
        <input
          type="checkbox"
          className="ph-focusable"
          checked={checked}
          disabled={frozen}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>{t('prereg.commit')}</span>
      </label>

      <button type="button" className="ph-prereg__submit ph-focusable ph-label" disabled={!canSubmit} onClick={handleSubmit}>
        {t('prereg.submit')}
      </button>

      {frozen ? (
        <p className="ph-prereg__locked" role="status">
          {t('prereg.locked')}
        </p>
      ) : null}
    </section>
  );
}
