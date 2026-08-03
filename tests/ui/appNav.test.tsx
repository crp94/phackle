// @vitest-environment jsdom
//
// T17: App.tsx's header nav (stats/legend/about) — a tiny local page-state,
// deliberately separate from tests/ui/shell.test.tsx (T5's file, unmodified
// here; App.tsx's pre-existing behaviour is still covered by that whole
// suite, re-run green above). Same no-jest-dom convention as the rest of
// tests/ui/*.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App from '../../src/ui/App';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => cleanup());

async function renderApp() {
  render(
    <LocaleProvider>
      <App puzzleNumber={1}>
        <div data-testid="game-child">the running game</div>
      </App>
    </LocaleProvider>
  );
  await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
}

describe('App header nav — stats/legend/about, a local page-state (not the game machine)', () => {
  it('shows the game (children) by default, with no nav page mounted', async () => {
    await renderApp();
    expect(screen.getByTestId('game-child')).toBeTruthy();
    expect(screen.queryByText('Your stats')).toBeNull();
  });

  it('Stats: clicking the nav button swaps <main> to the Stats page and hides the game', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.getByText('Your stats')).toBeTruthy();
    expect(screen.queryByTestId('game-child')).toBeNull();
  });

  it('Legend: clicking the nav button swaps <main> to the Legend page', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    expect(screen.getByText('How to read a shared result.')).toBeTruthy();
    expect(screen.queryByTestId('game-child')).toBeNull();
  });

  it('About: clicking the nav button swaps <main> to the About page', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByText('About P-hackle')).toBeTruthy();
    expect(screen.queryByTestId('game-child')).toBeNull();
  });

  it('marks the current nav page with aria-pressed=true, and the others false', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    expect(screen.getByRole('button', { name: 'Legend' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Stats' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'About' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('each nav page\'s own Close button returns to the game', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.queryByTestId('game-child')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByTestId('game-child')).toBeTruthy();
    expect(screen.queryByText('Your stats')).toBeNull();
  });

  it('navigating directly from one nav page to another works without detouring through the game', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.getByText('Your stats')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByText('About P-hackle')).toBeTruthy();
    expect(screen.queryByText('Your stats')).toBeNull();
  });

  it('the theme and locale toggles keep working once the nav has been used (still "live", per the T17 brief)', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    const themeButton = screen.getByRole('button', { name: 'Paper' });
    fireEvent.click(themeButton);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
