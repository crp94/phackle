// @vitest-environment jsdom
//
// T40 (FINDING F1, T23 report): `errors.storageOff` was written, translated
// in all three locales, and unit-tested through storage.ts's own
// isStorageOff() — but nothing under src/ui/** ever rendered it, so a
// player whose browser blocks localStorage (site data blocked, an iOS
// private tab) played, scored and streaked an entire day into the in-memory
// fallback and was told nothing before it all evaporated on reload. App.tsx
// now renders the notice in the shell whenever isStorageOff() is true.
//
// OWN FILE, deliberately not folded into shell.test.tsx or router.test.tsx:
// storage.ts keeps `storageOff` as MODULE-LEVEL state that only ever flips
// false -> true and never resets within a session (mirroring a real browser
// tab — see storage.ts's own doc comment and tests/game/storage.test.ts's
// identical isolation concern, `installThrowingLocalStorage`, reused here
// verbatim). Sharing a file with other tests that render <App> without
// blocking storage would let one test's throw silently contaminate every
// later assertion in the same run; a dedicated file gets its own fresh
// module graph (vitest's default per-file isolation) and orders its two
// tests so the "available" case runs before the "blocked" one flips the
// flag for good.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App from '../../src/ui/App';
import { gameStore } from '../../src/game/store';
import { copy as enCopy } from '../../src/content/en/copy';

let originalLocalStorage: PropertyDescriptor | undefined;

/** Verbatim copy of tests/game/storage.test.ts's own helper: every
 * localStorage access throws, the way a browser with site data blocked (or
 * an iOS private tab) behaves. */
function installThrowingLocalStorage() {
  const boom = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  const throwing: Storage = {
    getItem: boom,
    setItem: boom,
    removeItem: boom,
    clear: boom,
    key: () => null,
    length: 0,
  };
  Object.defineProperty(window, 'localStorage', { value: throwing, configurable: true });
}


// gr6-007 — THE SHELL UNDER TEST IS THE BOOTED SHELL.
//
// App now renders the boot-failure screen INSTEAD of the shell when a boot
// never produced a day (`storeError && !booted`), because the alternative was
// a real-looking briefing for scenario #0 with a live CTA into a Lab that can
// never compute. Every test in this file exercises the shell, and jsdom has
// no `Worker`, so App's own boot attempt throws harmlessly into `store.error`
// and would now take the page. Seeding `booted` says out loud what these
// tests always assumed: the header, the nav and the screen slot are what a
// player sees AFTER a day exists. The boot-failure screen has its own tests
// (tests/ui/shell.test.tsx's "boot failure" block).
beforeEach(() => {
  originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
  document.documentElement.removeAttribute('data-theme');
  gameStore.setState({ booted: true });
});

afterEach(() => {
  cleanup();
  if (originalLocalStorage) Object.defineProperty(window, 'localStorage', originalLocalStorage);
});

// App.tsx never mocks src/game/engineClient here (unlike router.test.tsx):
// jsdom has no global Worker, so App's own try/catch around
// createEngineClient() throws synchronously and routes into store.error —
// which is exactly what opens the App's boot gate (booted || error) in
// EITHER of these tests. That path is already covered by router.test.tsx's
// "App boot wiring" describe block; it is incidental here, not the subject.

describe('the storage-blocked notice (FINDING F1)', () => {
  it('stays absent while storage is available (negative control — must run before the next test flips storageOff for the file)', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    expect(screen.queryByText(enCopy['errors.storageOff'])).toBeNull();
  });

  it('renders errors.storageOff, as a quiet non-urgent status, once storage throws', async () => {
    installThrowingLocalStorage();

    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    const notice = await screen.findByText(enCopy['errors.storageOff']);
    // Not role="alert": nothing about a blocked-storage session is urgent —
    // the game is fully playable, this is an honest aside, not a crash (see
    // errors.workerCrash's role="alert" in ScreenRouter.tsx for the contrast).
    expect(notice.getAttribute('role')).toBe('status');
  });
});
