// gr6-062's other half — the route the Summary's "your stats" action needs.
//
// The app has exactly one navigation state and App.tsx owns it (`page`:
// game | stats | legend | about). Everything under <main> is rendered by
// ScreenRouter out of `SCREENS`, which is typed `Record<Screen,
// ComponentType>` — a bare component, no props — so a machine screen has no
// prop path back up to that state. A context is the smallest thing that
// gives it one without re-typing the registry, threading a callback through
// ScreenRouter, or moving the nav state into the game store (where it does
// not belong: `page` is chrome, `screen` is the game).
//
// Deliberately NOT a general "navigate anywhere" API: one field, one
// destination, named for what it does. A screen that wants a second route
// adds a second field here and the shell decides whether to supply it —
// which is also why the whole context is nullable. Nothing outside App
// provides it, so a screen rendered standalone (every test that renders one
// directly, and Storybook-style isolation) simply sees `null` and renders no
// route rather than a dead control.
import { createContext, useContext } from 'react';

export interface AppNav {
  /** Switches the shell's nav page to Stats. */
  viewStats: () => void;
}

export const AppNavContext = createContext<AppNav | null>(null);

export function useAppNav(): AppNav | null {
  return useContext(AppNavContext);
}
