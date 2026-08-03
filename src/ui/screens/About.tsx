// T17 — About/Methods nav page (master spec §7.3 "About/Methods: full
// mechanism disclosure, DGP summary, prior-art citations (§1.4), synthetic-
// data disclaimer, link to source"). Every disclosure paragraph already
// exists as a T6 copy key (about.*) — this screen's own job is layout, the
// deploy-injected version string, and the two outbound links.
import { useLocale } from '../../i18n/LocaleProvider';
import type { CopyKey } from '../../content/en/copy';
import { SITE_URL } from '../../game/share';
import './About.css';

type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

/** Data, not copy — identical across every locale, exactly like SITE_URL
 * (see copy.ts's own header comment: URLs are "handled by content modules,
 * not by this catalog"). */
export const REPO_URL = 'https://github.com/crp94/phackle';

export interface GlossaryEntry {
  term: string;
  def: string;
}

export interface AboutProps {
  t: TFunction;
  /** import.meta.env.VITE_APP_VERSION, verbatim (possibly undefined outside
   * a real deploy — T25 injects the real value). Falls back to 'dev' here,
   * not in the caller, so the fallback itself is directly unit-tested. */
  version?: string;
  glossary: GlossaryEntry[];
  onClose?: () => void;
}

export function About({ t, version, glossary, onClose }: AboutProps) {
  const displayVersion = version ?? 'dev';

  return (
    <section className="ph-about">
      <h2 className="ph-about__title">{t('about.title')}</h2>

      <p className="ph-about__prose">{t('about.intro')}</p>
      <p className="ph-about__prose">{t('about.mechanism')}</p>
      <p className="ph-about__prose">{t('about.frozenFork')}</p>
      <p className="ph-about__prose">{t('about.syntheticDisclaimer')}</p>
      <p className="ph-about__prose">{t('about.decimalNote')}</p>
      <p className="ph-about__prose">{t('about.dataDisclosure')}</p>

      <p className="ph-about__prose">{t('about.priorArt')}</p>
      <ul className="ph-about__citations">
        <li>{t('about.priorArtFiveThirtyEight')}</li>
        <li>{t('about.priorArtSpecCurve')}</li>
        <li>{t('about.priorArtForkingPaths')}</li>
        <li>{t('about.priorArtFalsePositive')}</li>
        <li>{t('about.priorArtOptionalStopping')}</li>
      </ul>

      <h3 className="ph-about__subtitle">{t('about.glossaryTitle')}</h3>
      <dl className="ph-about__glossary">
        {glossary.map((entry) => (
          <div className="ph-about__glossary-row" key={entry.term}>
            <dt className="ph-about__glossary-term">{entry.term}</dt>
            <dd className="ph-about__glossary-def">{entry.def}</dd>
          </div>
        ))}
      </dl>

      <p className="ph-about__prose">{t('about.contact')}</p>

      <p className="ph-about__meta">
        <span className="ph-about__version">{t('about.version', { version: displayVersion })}</span>
        <a className="ph-about__link" href={REPO_URL}>
          {t('about.sourceLink')}
        </a>
        <a className="ph-about__link" href={SITE_URL}>
          {SITE_URL}
        </a>
      </p>

      {onClose && (
        <button type="button" className="ph-about__close" onClick={onClose} aria-label={t('a11y.closeDialog')}>
          {t('stats.close')}
        </button>
      )}
    </section>
  );
}

/** Standalone nav-page wrapper — a NAV page, not a machine screen (T17 patch
 * notes). Reads locale content for the glossary and the build-time version
 * env var directly; everything else is pure props on `About` above. */
export default function AboutScreen({ onClose }: { onClose?: () => void }) {
  const { copy, t, content } = useLocale();
  if (!copy || !content) return <div aria-busy="true" data-testid="about-loading" />;
  const version = import.meta.env.VITE_APP_VERSION as string | undefined;
  return <About t={t} version={version} glossary={content.glossary} onClose={onClose} />;
}
