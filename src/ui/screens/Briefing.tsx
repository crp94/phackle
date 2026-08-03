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
import { useLocale } from '../../i18n/LocaleProvider';
import { useGameStore, type GameStore } from '../../game/store';
import { isoFromPuzzleNumber } from '../../game/puzzleDate';
import { pickGrantwellEmail } from '../../game/briefing';
import { EmailCard } from '../components/EmailCard';
import './Briefing.css';

export type UseGameStore = <T>(selector: (state: GameStore) => T) => T;

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

  // Behind the app-level loading gate (src/ui/App.tsx never mounts a screen
  // until content resolves) -- this narrows the type and is a safety net,
  // not a second, competing loading UI.
  if (!content) return null;

  const scenario = content.scenarios[scenarioIndex];
  const iso = isoFromPuzzleNumber(puzzleNumberValue);
  const grantwellBody = pickGrantwellEmail(content.grantwell, iso);

  return (
    <article className="ph-briefing">
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
      <EmailCard from={t('briefing.emailFrom')} subject={t('briefing.emailSubject')} body={grantwellBody} />
      {/* T18: the Prereg Mode chooser (checkbox: "I solemnly commit") renders
          here once unlocked -- nothing renders for it yet. */}
      <button type="button" className="ph-briefing__cta" onClick={openData}>
        {t('briefing.openData')}
      </button>
    </article>
  );
}
