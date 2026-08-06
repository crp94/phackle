// @vitest-environment jsdom
//
// T17: the About nav page — full mechanism disclosure from T6's about.*
// copy keys (already written; this screen only has to render them), plus the
// version string (import.meta.env.VITE_APP_VERSION ?? 'dev', T25 injects the
// real value at deploy) and the GitHub/SITE_URL links.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { About, REPO_URL } from '../../src/ui/screens/About';
import { SITE_URL } from '../../src/game/share';
import { copy as enCopy } from '../../src/content/en/copy';
import { t as translate } from '../../src/i18n/t';

afterEach(() => cleanup());

const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate(enCopy, key, params);

const glossary = [
  { term: 'p-hacking', def: 'Exploiting analytical flexibility to reach significance.' },
  { term: 'forking paths', def: 'The garden of specifications you could have run.' },
];

describe('About — full mechanism disclosure, prior art, glossary', () => {
  it('renders the title and every disclosure prose paragraph', () => {
    render(<About t={t} glossary={glossary} />);
    expect(screen.getByText(t('about.title'))).toBeTruthy();
    expect(screen.getByText(t('about.intro'))).toBeTruthy();
    expect(screen.getByText(t('about.mechanism'))).toBeTruthy();
    expect(screen.getByText(t('about.frozenFork'))).toBeTruthy();
    expect(screen.getByText(t('about.syntheticDisclaimer'))).toBeTruthy();
    expect(screen.getByText(t('about.decimalNote'))).toBeTruthy();
    expect(screen.getByText(t('about.dataDisclosure'))).toBeTruthy();
  });

  /* gr6-026 / gr6-037 — the tagline was written, transcreated into three
     languages, and rendered nowhere until this screen took it. */
  it('renders nav.tagline as the standfirst, between the <h1> and the intro', () => {
    const { container } = render(<About t={t} glossary={glossary} />);
    const standfirst = container.querySelector('.ph-about__standfirst') as HTMLElement;
    expect(standfirst.textContent).toBe(t('nav.tagline'));

    // Position is the whole point of a standfirst: a summary line that is not
    // directly under the title it summarises is just another paragraph.
    const section = container.querySelector('.ph-about') as HTMLElement;
    const order = Array.from(section.children);
    const at = (sel: string) => order.findIndex((el) => el.matches(sel));
    expect(at('.ph-about__standfirst')).toBe(at('.ph-about__title') + 1);
    expect(order[at('.ph-about__standfirst') + 1]?.textContent).toBe(t('about.intro'));
  });

  /* gr6-036 — seven unsignposted paragraphs, and a typographic footnote
     wedged into the middle of them. */
  it('signposts the essay with the four section headings, in the catalog\'s own order', () => {
    render(<About t={t} glossary={glossary} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      t('about.sectionHowItWorks'),
      t('about.sectionNotReal'),
      t('about.sectionYourData'),
      t('about.sectionPriorArt'),
      // The glossary already had its heading; it is the essay's sixth and
      // last turn and sits at the same level as the four new ones.
      t('about.glossaryTitle'),
    ]);
  });

  it('files every disclosure paragraph under the heading W2 mapped it to', () => {
    // The mapping is documented in the CopyKey union beside the four keys.
    // Asserted as document ORDER rather than as DOM nesting, because these
    // are flat siblings by design — an <h2> followed by its paragraphs is the
    // manuscript idiom, and wrapping each run in a <section> would add five
    // landmarks to a page that is already one named region.
    const { container } = render(<About t={t} glossary={glossary} />);
    const text = Array.from((container.querySelector('.ph-about') as HTMLElement).children).map(
      (el) => el.textContent
    );
    const at = (s: string) => text.indexOf(s);
    const under = (heading: string, body: string, nextHeading: string) => {
      expect(at(body)).toBeGreaterThan(at(heading));
      expect(at(body)).toBeLessThan(at(nextHeading));
    };
    under(t('about.sectionHowItWorks'), t('about.mechanism'), t('about.sectionNotReal'));
    under(t('about.sectionHowItWorks'), t('about.frozenFork'), t('about.sectionNotReal'));
    under(t('about.sectionNotReal'), t('about.syntheticDisclaimer'), t('about.sectionYourData'));
    // THE MOVE. `about.decimalNote` used to sit between the synthetic-data
    // disclosure and the analytics paragraph, stopping the essay dead. It
    // belongs with the other "what you are looking at is a construction"
    // facts, which is this section.
    under(t('about.sectionNotReal'), t('about.decimalNote'), t('about.sectionYourData'));
    under(t('about.sectionYourData'), t('about.dataDisclosure'), t('about.sectionPriorArt'));
    under(t('about.sectionPriorArt'), t('about.priorArt'), t('about.glossaryTitle'));
  });

  it('renders the §1.4 prior-art citation intro and all 5 citations', () => {
    render(<About t={t} glossary={glossary} />);
    expect(screen.getByText(t('about.priorArt'))).toBeTruthy();
    expect(screen.getByText(t('about.priorArtFiveThirtyEight'))).toBeTruthy();
    expect(screen.getByText(t('about.priorArtSpecCurve'))).toBeTruthy();
    expect(screen.getByText(t('about.priorArtForkingPaths'))).toBeTruthy();
    expect(screen.getByText(t('about.priorArtFalsePositive'))).toBeTruthy();
    expect(screen.getByText(t('about.priorArtOptionalStopping'))).toBeTruthy();
  });

  it('renders the glossary title and every {term, def} pair passed in', () => {
    render(<About t={t} glossary={glossary} />);
    expect(screen.getByText(t('about.glossaryTitle'))).toBeTruthy();
    for (const entry of glossary) {
      expect(screen.getByText(entry.term)).toBeTruthy();
      expect(screen.getByText(entry.def)).toBeTruthy();
    }
  });

  it('renders the contact line', () => {
    render(<About t={t} glossary={glossary} />);
    expect(screen.getByText(t('about.contact'))).toBeTruthy();
  });

  it('falls back to "dev" when no version is supplied', () => {
    render(<About t={t} glossary={glossary} />);
    expect(screen.getByText(t('about.version', { version: 'dev' }))).toBeTruthy();
  });

  it('renders a real version string when one is supplied (T25 deploy injection)', () => {
    render(<About t={t} glossary={glossary} version="a1b2c3d" />);
    expect(screen.getByText(t('about.version', { version: 'a1b2c3d' }))).toBeTruthy();
    expect(screen.queryByText(t('about.version', { version: 'dev' }))).toBeNull();
  });

  it('links to the GitHub repo with the sourceLink copy as its text', () => {
    render(<About t={t} glossary={glossary} />);
    const link = screen.getByRole('link', { name: t('about.sourceLink') });
    expect(link.getAttribute('href')).toBe(REPO_URL);
  });

  it('renders SITE_URL (from share.ts) as a link whose visible text is the URL itself', () => {
    render(<About t={t} glossary={glossary} />);
    const link = screen.getByRole('link', { name: SITE_URL });
    expect(link.getAttribute('href')).toBe(SITE_URL);
  });

  // T22: named by its own visible label, not by a11y.closeDialog — a nav page
  // is not a dialog. See tests/ui/legend.test.tsx for the full note.
  it('calls onClose when the close button is activated', () => {
    const onClose = vi.fn();
    render(<About t={t} glossary={glossary} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: t('stats.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
