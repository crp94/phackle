// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { LocaleProvider, useLocale } from '../../src/i18n/LocaleProvider';

function Probe() {
  const { locale, content, copy, t, setLocale, theme, setTheme } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="theme">{theme}</span>
      <span data-testid="title">{content ? t('nav.title') : 'loading'}</span>
      <span data-testid="copy-keys">{copy ? Object.keys(copy).length : 0}</span>
      <button onClick={() => setLocale('it')}>switch-to-it</button>
      <button onClick={() => setTheme('dark')}>switch-to-dark</button>
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
    // T13 fix-up: the persisted contract is now `phackle.v1` (storage.ts) —
    // not the retired interim `phackle.settings` key (see the removed
    // mirrorLegacySettings note in src/i18n/LocaleProvider.tsx).
    const stored = JSON.parse(window.localStorage.getItem('phackle.v1') ?? '{}');
    expect(stored.settings.locale).toBe('it');
  });

  it('does not resurrect the legacy phackle.settings key on a locale/theme toggle', async () => {
    // Seed the legacy key so loadState's fold-in-and-remove (storage.ts,
    // ruling amending the brief) actually has something to remove — this
    // test is about it STAYING removed afterward, not about it never having
    // existed. No theme in the seed, so the "switch-to-dark" click below is
    // a real paper->dark transition, not a same-value no-op.
    window.localStorage.setItem('phackle.settings', JSON.stringify({ locale: 'es' }));

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByTestId('title').textContent).toBe('P-hackle'));

    // The fold-in-and-remove already ran synchronously during mount (both
    // useState lazy initializers call loadState()) — confirm it's gone
    // BEFORE the toggle, so the assertion after the toggle proves
    // non-resurrection rather than "was never removed to begin with".
    expect(window.localStorage.getItem('phackle.settings')).toBeNull();

    fireEvent.click(screen.getByText('switch-to-it'));
    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('it'));
    fireEvent.click(screen.getByText('switch-to-dark'));
    await waitFor(() => expect(screen.getByTestId('theme').textContent).toBe('dark'));

    expect(window.localStorage.getItem('phackle.settings')).toBeNull();
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
