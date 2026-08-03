// The Lab's live fork trail (master spec §2.9/§7.3): the same emoji legend
// share.ts's end-of-day shareString() uses, imported (not duplicated) per
// the controller pin. Unlike shareString's trail, this one carries no
// terminal 📄/🏳️ marker — the Lab is by definition mid-play, before any
// SUBMIT or ABANDON has happened.
import { useLocale } from '../../i18n/LocaleProvider';
import { FORK_EMOJI } from '../../game/share';
import { classifyChange } from '../../game/forkLog';
import type { PlayerAction, Spec } from '../../engine/types';
import './ForkTrail.css';

export interface ForkTrailProps {
  log: PlayerAction[];
  mode: 'hack' | 'prereg';
}

/** Same "first VIEW_SPEC is free, later ones count iff seen" rule as
 * forkLog.ts's countForks/share.ts's buildTrail, restated here (rather than
 * imported) because neither of those is exported — only the glyph legend
 * (FORK_EMOJI) and the per-change classifier (classifyChange) are, and both
 * are reused as-is below. */
function buildLiveTrail(log: PlayerAction[], prereg: boolean): string {
  let trail = prereg ? '🧾' : '';
  let prevSpec: Spec | undefined;

  for (const action of log) {
    if (action.t === 'VIEW_SPEC') {
      if (prevSpec === undefined) {
        prevSpec = action.spec; // the initial default spec is free (§2.10)
        continue;
      }
      if (action.seen) trail += FORK_EMOJI[classifyChange(prevSpec, action.spec)];
      prevSpec = action.spec;
    } else if (action.t === 'PEEK_AND_EXTEND') {
      trail += FORK_EMOJI.peek;
    }
    // SUBMIT/ABANDON/CALL never reach the Lab's own log while it's showing.
  }
  return trail;
}

export function ForkTrail({ log, mode }: ForkTrailProps) {
  const { t } = useLocale();
  const trail = buildLiveTrail(log, mode === 'prereg');

  return (
    <p className="ph-fork-trail">
      <span className="ph-fork-trail__label">{t('lab.forkTrailLabel')}</span>
      <span>{trail || '—'}</span>
    </p>
  );
}
