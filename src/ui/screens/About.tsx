// T17 — About/Methods nav page (master spec §7.3 "About/Methods: full
// mechanism disclosure, DGP summary, prior-art citations (§1.4), synthetic-
// data disclaimer, link to source"). Every disclosure paragraph already
// exists as a T6 copy key (about.*) — this screen's own job is layout, the
// deploy-injected version string, and the two outbound links.
import { useId } from 'react';
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
  const titleId = useId();
  const displayVersion = version ?? 'dev';

  return (
    // T22: a named region with its own <h1> — see Stats.tsx's identical note.
    <section className="ph-page ph-about" aria-labelledby={titleId}>
      <h1 className="ph-about__title" id={titleId}>
        {t('about.title')}
      </h1>

      {/* gr6-026 / gr6-037 — THE STANDFIRST, and the end of the best line in
          the catalog rendering nowhere. `nav.tagline` ("A daily game about
          the garden of forking paths.") was written, transcreated into three
          languages, and never put on screen; the grand review found it in the
          dead-key sweep. This is its natural home: it is the one sentence
          that tells a first-time visitor what the thing IS, and About is the
          page they open to ask. It sits between the <h1> and `about.intro`,
          which is exactly where a standfirst goes in the manuscript idiom
          this product is set in — the title, the line that summarises it, and
          then the body. */}
      <p className="ph-about__standfirst">{t('nav.tagline')}</p>

      {/* `about.intro` stands alone above the four sections, not under a
          heading of its own: it answers "what is this" and the four headings
          below are the essay's turns after that question is settled. */}
      <p className="ph-about__prose">{t('about.intro')}</p>

      {/* gr6-036 — ABOUT WAS SEVEN UNSIGNPOSTED PARAGRAPHS WITH A TYPOGRAPHIC
          FOOTNOTE WEDGED INTO THE MIDDLE OF IT.
          Read as an essay it has a real argument in the right order — what
          this is, then how it really works, then none of this is real, then
          your data is yours, then read these instead, then vocabulary — and
          six of those turns were invisible because nothing marked them. Four
          short <h2>s in the page's own plain register, and the mapping is
          W2's, documented in the CopyKey union beside the four keys. */}
      <h2 className="ph-about__subtitle">{t('about.sectionHowItWorks')}</h2>
      <p className="ph-about__prose">{t('about.mechanism')}</p>
      <p className="ph-about__prose">{t('about.frozenFork')}</p>

      <h2 className="ph-about__subtitle">{t('about.sectionNotReal')}</h2>
      <p className="ph-about__prose">{t('about.syntheticDisclaimer')}</p>
      {/* MOVED, and this is the half of gr6-036 that is not just signposting.
          `about.decimalNote` used to sit between "a screenshot travels further
          than its caption" and the analytics paragraph, where a one-line note
          about decimal points stopped the essay dead between two of its
          heaviest disclosures. Under this heading it is in company: the other
          facts here are all "what you are looking at is a construction", and
          how the numerals are set is one of them. W2 rewrote it to earn the
          place — it now states the leading-zero convention too, which is the
          rule gr6-027 made true across the whole catalog and which this is
          the only sentence that says out loud. */}
      <p className="ph-about__prose">{t('about.decimalNote')}</p>

      <h2 className="ph-about__subtitle">{t('about.sectionYourData')}</h2>
      <p className="ph-about__prose">{t('about.dataDisclosure')}</p>

      <h2 className="ph-about__subtitle">{t('about.sectionPriorArt')}</h2>
      <p className="ph-about__prose">{t('about.priorArt')}</p>
      <ul className="ph-about__citations">
        <li>{t('about.priorArtFiveThirtyEight')}</li>
        <li>{t('about.priorArtSpecCurve')}</li>
        <li>{t('about.priorArtForkingPaths')}</li>
        <li>{t('about.priorArtFalsePositive')}</li>
        <li>{t('about.priorArtOptionalStopping')}</li>
      </ul>

      {/* The glossary already had the heading the other four sections were
          missing, and it keeps it: `about.glossaryTitle` is the essay's sixth
          and last turn (vocabulary), at the same level as the four above. */}
      <h2 className="ph-about__subtitle">{t('about.glossaryTitle')}</h2>
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
        {/* gr6-024: no className. This span carries no rule of its own —
            .ph-about__meta's flex row, mono face and --muted are the whole
            treatment — and a class with no CSS is a promise the stylesheet
            never made. */}
        <span>{t('about.version', { version: displayVersion })}</span>
        <a className="ph-about__link" href={REPO_URL}>
          {t('about.sourceLink')}
        </a>
        <a className="ph-about__link" href={SITE_URL}>
          {SITE_URL}
        </a>
      </p>

      {/* T22: no aria-label — not a dialog. See Stats.tsx's note. */}
      {onClose && (
        <button type="button" className="ph-about__close ph-close ph-focusable" onClick={onClose}>
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
