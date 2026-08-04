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
