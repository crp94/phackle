// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { LocaleProvider, useLocale } from '../../src/i18n/LocaleProvider';

function Probe() {
  const { locale, content, copy, t, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="title">{content ? t('nav.title') : 'loading'}</span>
      <span data-testid="copy-keys">{copy ? Object.keys(copy).length : 0}</span>
      <button onClick={() => setLocale('it')}>switch-to-it</button>
    </div>
  );
}

describe('LocaleProvider / useLocale', () => {
  beforeEach(() => {
    // window.localStorage, not the bare global: Node's own built-in
    // localStorage (file-backed) can shadow the bare identifier and isn't
    // what jsdom (or a real browser) actually uses.
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  // This project doesn't enable vitest's `test.globals`, so
  // @testing-library/react's automatic afterEach(cleanup) never registers
  // (it detects a *global* afterEach). Without this, every render() in this
  // file would pile up in the same jsdom document instead of unmounting.
  afterEach(cleanup);

  it('defaults to English, loads content asynchronously, and syncs <html lang>', async () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');

    await waitFor(() => expect(screen.getByTestId('title').textContent).toBe('P-hackle'));
    expect(document.documentElement.lang).toBe('en');
    expect(Number(screen.getByTestId('copy-keys').textContent)).toBeGreaterThan(0);
  });

  it('persists an explicit locale switch and updates <html lang>', async () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByTestId('title').textContent).toBe('P-hackle'));

    fireEvent.click(screen.getByText('switch-to-it'));

    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('it'));
    expect(document.documentElement.lang).toBe('it');
    const stored = JSON.parse(window.localStorage.getItem('phackle.settings') ?? '{}');
    expect(stored.locale).toBe('it');
  });

  it('reads a previously-stored locale on mount, ahead of the navigator default', () => {
    window.localStorage.setItem('phackle.settings', JSON.stringify({ locale: 'es' }));
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  it('throws when useLocale is called outside a LocaleProvider', () => {
    function Bare() {
      useLocale();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/useLocale/);
  });
});
