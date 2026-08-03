// @vitest-environment jsdom
//
// T5: app shell (loading gate, running header, theme/locale toggles) and the
// shared visual components (Stamp, ConfettiLayer, EmailCard, useReducedMotion).
//
// This project has no @testing-library/jest-dom (see tests/i18n/LocaleProvider.test.tsx
// for the same convention) — assertions read plain DOM properties
// (.textContent, .getAttribute, .className) rather than jest-dom matchers.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within, act } from '@testing-library/react';
import { LocaleProvider } from '../../src/i18n/LocaleProvider';
import App, { ThemeToggle, LocaleToggle } from '../../src/ui/App';
import { Stamp } from '../../src/ui/components/Stamp';
import { ConfettiLayer } from '../../src/ui/components/ConfettiLayer';
import { EmailCard } from '../../src/ui/components/EmailCard';
import { useReducedMotion } from '../../src/ui/hooks/useReducedMotion';

/**
 * jsdom has no matchMedia (brief note). This fakes one MediaQueryList per
 * query string, independently, so a test can drive
 * '(prefers-reduced-motion: reduce)' and '(prefers-color-scheme: dark)'
 * separately and fire "change" events for the reactivity tests.
 */
function installMatchMedia(initial: Record<string, boolean> = {}) {
  const registry = new Map<string, { matches: boolean; listeners: Set<(e: { matches: boolean }) => void> }>();
  const entryFor = (query: string) => {
    let entry = registry.get(query);
    if (!entry) {
      entry = { matches: initial[query] ?? false, listeners: new Set() };
      registry.set(query, entry);
    }
    return entry;
  };

  window.matchMedia = vi.fn((query: string) => {
    const entry = entryFor(query);
    return {
      media: query,
      get matches() {
        return entry.matches;
      },
      addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => entry.listeners.add(cb),
      removeEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => entry.listeners.delete(cb),
      addListener: (cb: (e: { matches: boolean }) => void) => entry.listeners.add(cb),
      removeListener: (cb: (e: { matches: boolean }) => void) => entry.listeners.delete(cb),
      dispatchEvent: () => true,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;

  return {
    set(query: string, matches: boolean) {
      const entry = entryFor(query);
      entry.matches = matches;
      entry.listeners.forEach((cb) => cb({ matches }));
    },
  };
}

function hasClass(el: Element | null, className: string): boolean {
  return !!el && el.className.split(/\s+/).includes(className);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.lang = '';
  installMatchMedia();
});

// This project doesn't enable vitest's test.globals, so @testing-library/react's
// automatic afterEach(cleanup) never registers (see LocaleProvider.test.tsx).
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App loading gate', () => {
  it('renders only a paper-background placeholder before content loads, then mounts the header and children', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1}>
          <div data-testid="child">child content</div>
        </App>
      </LocaleProvider>
    );

    // Synchronous assertion: getContent()'s dynamic import never resolves
    // within the same microtask, so this always observes the pre-load state.
    expect(screen.getByTestId('app-loading')).toBeTruthy();
    expect(screen.queryByTestId('child')).toBeNull();
    expect(screen.queryByText('P-hackle')).toBeNull();

    await waitFor(() => expect(screen.queryByTestId('child')).not.toBeNull());
    expect(screen.queryByTestId('app-loading')).toBeNull();
    expect(screen.getByText('P-hackle')).toBeTruthy();
  });
});

describe('running header', () => {
  it('shows the wordmark and "Vol. 1, No. {puzzleNumber}"', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={12} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
    expect(screen.getByText('Vol. 1, No. 12')).toBeTruthy();
  });
});

describe('theme toggle', () => {
  it('defaults to paper/light, toggles to dark, and persists the explicit choice', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    const button = screen.getByRole('button', { name: 'Paper' });
    expect(button.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(button);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const toggled = screen.getByRole('button', { name: 'Dark' });
    expect(toggled.getAttribute('aria-pressed')).toBe('true');

    const stored = JSON.parse(window.localStorage.getItem('phackle.settings') ?? '{}');
    expect(stored.theme).toBe('dark');
  });

  it('reads a previously-stored theme on mount, ahead of any content load', () => {
    window.localStorage.setItem('phackle.settings', JSON.stringify({ theme: 'dark' }));
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    // The theme effect doesn't depend on locale content, so this is synchronous.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to the system dark preference when nothing is stored', () => {
    installMatchMedia({ '(prefers-color-scheme: dark)': true });
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('locale toggle', () => {
  it('stays hidden while AVAILABLE_LOCALES has only one entry', async () => {
    render(
      <LocaleProvider>
        <App puzzleNumber={1} />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByText('P-hackle')).toBeTruthy());
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('renders one button per locale once more than one is available', () => {
    const setLocale = vi.fn();
    render(<LocaleToggle locales={['en', 'it', 'es']} locale="en" setLocale={setLocale} t={(key) => key} />);

    const group = screen.getByRole('group');
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['EN', 'IT', 'ES']);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(buttons[1]);
    expect(setLocale).toHaveBeenCalledWith('it');
  });
});

describe('ThemeToggle (unit)', () => {
  it('shows the current state as text and flips it on click', () => {
    const setTheme = vi.fn();
    render(<ThemeToggle theme="paper" setTheme={setTheme} t={(key) => key} />);
    const button = screen.getByRole('button', { name: 'nav.themePaper' });
    fireEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});

describe('Stamp', () => {
  it('renders the verdict label as real, accessible text', () => {
    render(<Stamp kind="RETRACTED" label="RETRACTED" animate={false} />);
    expect(screen.getByText('RETRACTED')).toBeTruthy();
  });

  it('renders an optional subline as text too', () => {
    render(<Stamp kind="NULL_REPORTED" label="NULL REPORTED" subline="p = 0.61" animate={false} />);
    expect(screen.getByText('NULL REPORTED')).toBeTruthy();
    expect(screen.getByText('p = 0.61')).toBeTruthy();
  });

  it('animates when animate=true and motion is not reduced', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const { container } = render(<Stamp kind="RETRACTED" label="RETRACTED" animate={true} />);
    expect(hasClass(container.querySelector('.ph-stamp'), 'ph-stamp--animate')).toBe(true);
  });

  it('skips the animation class under reduced motion even when animate=true', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const { container } = render(<Stamp kind="RETRACTED" label="RETRACTED" animate={true} />);
    expect(hasClass(container.querySelector('.ph-stamp'), 'ph-stamp--animate')).toBe(false);
  });

  it('never animates when animate=false', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const { container } = render(<Stamp kind="RETRACTED" label="RETRACTED" animate={false} />);
    expect(hasClass(container.querySelector('.ph-stamp'), 'ph-stamp--animate')).toBe(false);
  });
});

describe('ConfettiLayer', () => {
  function mockCanvasContext() {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    return ctx;
  }

  it('renders no canvas and calls onDone immediately under reduced motion', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const onDone = vi.fn();
    const { container } = render(<ConfettiLayer particles={100} durationMs={3000} onDone={onDone} />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('caps particles at 400 regardless of how many are requested', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const ctx = mockCanvasContext();
    // Draw exactly one frame, then stop the recursive rAF chain from firing
    // again so the test doesn't spin: only the *first* call invokes its callback.
    let calls = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      calls += 1;
      if (calls === 1) cb(0);
      return calls;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    render(<ConfettiLayer particles={4000} durationMs={3000} onDone={vi.fn()} />);

    expect(ctx.fillRect).toHaveBeenCalledTimes(400);
  });

  it('draws exactly as many particles as requested when under the cap', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const ctx = mockCanvasContext();
    let calls = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      calls += 1;
      if (calls === 1) cb(0);
      return calls;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    render(<ConfettiLayer particles={30} durationMs={3000} onDone={vi.fn()} />);

    expect(ctx.fillRect).toHaveBeenCalledTimes(30);
  });

  it('cancels its animation frame on unmount, leaking no RAF', () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    mockCanvasContext();
    let idCounter = 0;
    // Never invoke the callback: simulates "a frame is scheduled" so unmount's
    // cleanup is the only thing that can resolve it.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      idCounter += 1;
      return idCounter;
    });
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { unmount } = render(<ConfettiLayer particles={10} durationMs={3000} onDone={vi.fn()} />);
    unmount();

    expect(cancelSpy).toHaveBeenCalledWith(idCounter);
  });
});

describe('EmailCard', () => {
  it('renders from/subject/body with labelled header lines', async () => {
    render(
      <LocaleProvider>
        <EmailCard from="Prof. R. Grantwell" subject="Friday" body="Make it significant." />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByText('From:')).toBeTruthy());
    expect(screen.getByText('Prof. R. Grantwell')).toBeTruthy();
    expect(screen.getByText('Subject:')).toBeTruthy();
    expect(screen.getByText('Friday')).toBeTruthy();
    expect(screen.getByText('Make it significant.')).toBeTruthy();
  });
});

describe('useReducedMotion', () => {
  function Probe() {
    const reduced = useReducedMotion();
    return <span data-testid="reduced">{String(reduced)}</span>;
  }

  it('reflects the current matchMedia state and reacts to a later change', () => {
    const mm = installMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('false');

    act(() => {
      mm.set('(prefers-reduced-motion: reduce)', true);
    });

    expect(screen.getByTestId('reduced').textContent).toBe('true');
  });
});
