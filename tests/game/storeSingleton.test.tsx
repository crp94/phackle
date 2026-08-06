// @vitest-environment jsdom
//
// gr6-109 — the one line of src/game/store.ts that had no direct test.
//
// `useGameStore` is a three-line React binding onto the module singleton
// (`gameStore`). Five UI suites exercise it indirectly and would all break if
// it stopped holding, but nothing asserted the binding ITSELF: that the hook
// reads the SAME store instance `gameStore` exports, and that a mutation made
// from outside React (which is how App.tsx's boot path, ScreenRouter's crash
// wiring and every e2e harness poke the state) is actually delivered to a
// subscribed component.
//
// A separate file rather than a block inside tests/game/store.test.ts: that
// suite runs in the `node` environment by design (it is 750 lines of pure,
// React-free store logic and should stay fast), and vitest's environment is
// per-FILE. Three lines of jsdom do not justify moving 56 node tests into a
// browser shim.
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { gameStore, useGameStore } from '../../src/game/store';

afterEach(() => {
  cleanup();
  gameStore.setState({ puzzleNumber: 0, screen: 'briefing' });
});

function PuzzleNumberProbe() {
  const puzzleNumber = useGameStore((s) => s.puzzleNumber);
  return <span data-testid="probe">{puzzleNumber}</span>;
}

describe('useGameStore (gr6-109) — the React binding onto the module singleton', () => {
  it('reads the exported `gameStore` instance, and delivers a mutation made from outside React', () => {
    gameStore.setState({ puzzleNumber: 41 });
    render(<PuzzleNumberProbe />);
    expect(screen.getByTestId('probe').textContent).toBe('41');

    act(() => {
      gameStore.setState({ puzzleNumber: 42 });
    });
    expect(screen.getByTestId('probe').textContent).toBe('42');
  });

  it('is selector-scoped: a change to a field the component does not select does not change what it renders', () => {
    gameStore.setState({ puzzleNumber: 7 });
    render(<PuzzleNumberProbe />);

    act(() => {
      gameStore.setState({ screen: 'lab' });
    });

    expect(screen.getByTestId('probe').textContent).toBe('7');
    expect(gameStore.getState().screen).toBe('lab');
  });
});
