// Minimal placeholder screens (T14's screen-router glue) for T15-T18 to
// replace, one at a time, in screens/registry.ts — each sibling task swaps
// exactly one line there for its own real screen component. Every stub here
// renders nothing but an identifiable marker section, with ONE exception:
// the briefing stub must expose a working "Open Data" CTA (store.openData())
// per the controller pin, because until T15 lands, this button is the only
// door from 'briefing' into the Lab.
import { useGameStore } from '../../game/store';
import { useLocale } from '../../i18n/LocaleProvider';

export function BriefingStub() {
  const { t } = useLocale();
  const openData = useGameStore((s) => s.openData);
  return (
    <section data-testid="stub-briefing">
      <button type="button" onClick={() => openData()}>
        {t('briefing.openData')}
      </button>
    </section>
  );
}

export function PublishedStub() {
  return <section data-testid="stub-published" />;
}

export function CallStub() {
  return <section data-testid="stub-call" />;
}

export function RevealStub() {
  return <section data-testid="stub-reveal" />;
}

export function SummaryStub() {
  return <section data-testid="stub-summary" />;
}
