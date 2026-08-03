// The generated fake-journal cover, Published screen (master spec §2.5/§7.3;
// DESIGN.md R8.3: no animated masthead, no gradient, no second stamp -- this
// is deliberately a quiet, static figure so it never competes with Act I's
// one signature, the dial (R8.1), or Act II's, the stamp (R8.2)).
//
// Pure/presentational, matching the T15 brief's pinned interface exactly:
// `journal`/`headline`/`authors`/`doi`/`tier` are the CALLER's computed
// values (pickJournal, substituteEffect, "You, et al." copy, fakeDoi, the
// egregiousness tier); the fixed labels this component owns intrinsically
// (the DOI prefix, the SIMULATED PRESS watermark -- S4.4 policy: every
// fake-press asset carries it) come from its own useLocale() call, the same
// split EmailCard already established (props for caller-supplied values,
// t() for the component's own fixed chrome).
import { useLocale } from '../../i18n/LocaleProvider';
import './JournalCover.css';

export interface JournalCoverProps {
  journal: string;
  headline: string;
  authors: string;
  doi: string;
  tier: 1 | 2 | 3;
}

export function JournalCover({ journal, headline, authors, doi, tier }: JournalCoverProps) {
  const { t } = useLocale();

  return (
    <div className="ph-journal-cover" data-tier={tier}>
      <p className="ph-journal-cover__watermark">{t('published.simulatedPress')}</p>
      <p className={tier === 3 ? 'ph-journal-cover__masthead ph-journal-cover__masthead--pick' : 'ph-journal-cover__masthead'}>
        {journal}
      </p>
      <h1 className={tier === 3 ? 'ph-journal-cover__headline ph-journal-cover__headline--pick' : 'ph-journal-cover__headline'}>
        {headline}
      </h1>
      <p className="ph-journal-cover__authors">{authors}</p>
      <p className="ph-journal-cover__doi">
        {t('published.doiPrefix')} {doi}
      </p>
    </div>
  );
}
