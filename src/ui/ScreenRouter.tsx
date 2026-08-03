// T14's screen-router glue: reads the store's current screen and renders
// the matching component from screens/registry.ts, with the worker-crash
// error state (store.error -> copy errors.workerCrash) rendered above
// whatever screen is currently showing — the screen itself stays exactly
// where the store left it (store.boot()'s onCrash handler never changes
// `screen`), so the error banner is additive, never a replacement.
import { useGameStore } from '../game/store';
import { useLocale } from '../i18n/LocaleProvider';
import { SCREENS } from './screens/registry';
import './ScreenRouter.css';

export function ScreenRouter() {
  const screen = useGameStore((s) => s.screen);
  const error = useGameStore((s) => s.error);
  const { t } = useLocale();
  const CurrentScreen = SCREENS[screen];

  return (
    <>
      {error ? (
        <p className="ph-error" role="alert">
          {t('errors.workerCrash')}
        </p>
      ) : null}
      <CurrentScreen />
    </>
  );
}
