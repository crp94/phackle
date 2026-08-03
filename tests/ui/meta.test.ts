// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Guards task T21's meta / share / PWA surface (master spec §5.1 PWA, §7.6
 * meta/share surface). Most of this file is plain readFileSync text
 * assertions over the source files themselves -- mirrors
 * tests/ui/tokens.test.ts's parse-as-text style, no build step, no
 * per-test build. The one exception is the last describe block, which
 * actually *executes* the extracted boot script under jsdom (see that
 * file's own note on why UI tests opt into jsdom per-file) to verify its
 * behaviour, not just its source text -- self-review evidence that it
 * truly cannot throw when storage is disabled or corrupt.
 */

// `fileURLToPath(import.meta.url)` (a plain string in, string out) rather
// than tokens.test.ts's `new URL('../..', import.meta.url)`: this file
// (uniquely among the tests following that pattern) runs under
// `// @vitest-environment jsdom`, which replaces the global `URL`
// constructor with jsdom's own -- and node:url's fileURLToPath rejects a
// jsdom-constructed URL object ("must be of scheme file"). Passing the
// string straight through sidesteps the global entirely.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const viteConfig = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');

const OG_IMAGE_URL = 'https://phackle.carlosrodriguezpardo.es/og.png';

describe('index.html <head> — meta/share surface (master spec §7.6)', () => {
  it('keeps <html lang="en"> static — LocaleProvider syncs it at runtime', () => {
    expect(html).toMatch(/<html lang="en">/);
  });

  it('declares the game title', () => {
    expect(html).toContain('<title>P-hackle — the daily p-hacking game</title>');
  });

  it('declares a sincere-register meta description that names the p < 0.05 threshold', () => {
    const match = /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/.exec(html);
    expect(match?.[1]).toBeTruthy();
    expect(match?.[1].length ?? 0).toBeGreaterThan(20);
    expect(match?.[1]).toContain('p < 0.05');
  });

  it('declares og:title, og:description and og:type=website', () => {
    expect(html).toContain('<meta property="og:title" content="P-hackle — the daily p-hacking game" />');
    expect(html).toMatch(/<meta\s+property="og:description"\s+content="[^"]+"\s*\/>/);
    expect(html).toContain('<meta property="og:type" content="website" />');
  });

  it('declares the absolute og:image URL', () => {
    expect(html).toContain(`<meta property="og:image" content="${OG_IMAGE_URL}" />`);
  });

  it('declares twitter:card=summary_large_image', () => {
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('links the SVG favicon', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  });

  it('links the PWA manifest', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });
});

describe('index.html inline theme-flash boot script (ledgered from T5)', () => {
  // The bare `<script>` (no attributes) is the boot script; the module entry
  // point always carries a `type="module"` attribute, so this can't
  // accidentally match that one instead.
  const bootMatch = /<script>([\s\S]*?)<\/script>/.exec(html);
  const bootScript = bootMatch?.[1] ?? '';
  const bootScriptFull = bootMatch?.[0] ?? '';

  it('exists, and runs before the module entry script', () => {
    expect(bootScript).toBeTruthy();
    const scriptIndex = html.indexOf('<script>');
    const mainIndex = html.indexOf('<script type="module" src="/src/main.tsx">');
    expect(scriptIndex).toBeGreaterThan(html.indexOf('<head>'));
    expect(mainIndex).toBeGreaterThan(scriptIndex);
  });

  it("reads the canonical versioned-storage key literal 'phackle.v1'", () => {
    expect(bootScript).toContain("'phackle.v1'");
  });

  it('maps paper -> light and dark -> dark, the same vocabulary as LocaleProvider.domTheme', () => {
    expect(bootScript).toContain("theme === 'dark'");
    expect(bootScript).toMatch(/data-theme',\s*dark\s*\?\s*'dark'\s*:\s*'light'/);
  });

  it('consults matchMedia ONLY when theme is nullish (never merely falsy) -- any stored value, including an empty string, maps straight through, matching readStoredTheme() ?? systemTheme() exactly (fix round 2, Important #1)', () => {
    // Must be a nullish check (`!= null`), not a truthiness check
    // (`theme ? ... : ...`): a stored empty string is falsy but NOT
    // nullish, so a plain truthiness check would wrongly consult
    // matchMedia for it. `readStoredTheme() ?? systemTheme()` only
    // substitutes on null/undefined (`??`'s exact semantics) -- an empty
    // string (or any other non-'dark' value) must map straight through to
    // light via domTheme's fallthrough, with no second matchMedia
    // consultation, exactly like the round-1 fix's stored-but-invalid case.
    expect(bootScript).toMatch(/dark\s*=\s*theme\s*!=\s*null\s*\?\s*theme === 'dark'\s*:\s*matchMedia/);
  });

  it('falls back to matchMedia prefers-color-scheme when no theme is stored, same as systemTheme()', () => {
    expect(bootScript).toContain("matchMedia('(prefers-color-scheme: dark)')");
  });

  it('wraps the storage read in try/catch so a throw (storage disabled) can never break the page', () => {
    const catches = bootScript.match(/\bcatch\b/g) ?? [];
    // Inner: isolates the localStorage/JSON.parse read itself. Outer: a
    // backstop around the whole script (e.g. a missing matchMedia).
    expect(catches.length).toBeGreaterThanOrEqual(2);
  });

  it('stays a tiny boot script, not app logic (~15 lines)', () => {
    expect(bootScriptFull.split('\n').length).toBeLessThanOrEqual(15);
  });
});

describe('vite.config.ts PWA plugin (master spec §5.1 PWA)', () => {
  it('registers vite-plugin-pwa with registerType autoUpdate', () => {
    expect(viteConfig).toContain("from 'vite-plugin-pwa'");
    expect(viteConfig).toContain("registerType: 'autoUpdate'");
  });

  it('names the manifest P-hackle with the paper theme/background colour and standalone display', () => {
    expect(viteConfig).toContain("name: 'P-hackle'");
    expect(viteConfig).toContain("short_name: 'P-hackle'");
    expect(viteConfig).toContain("theme_color: '#FBF8F1'");
    expect(viteConfig).toContain("background_color: '#FBF8F1'");
    expect(viteConfig).toContain("display: 'standalone'");
  });

  it('declares 192x192 and 512x512 icons', () => {
    expect(viteConfig).toContain("sizes: '192x192'");
    expect(viteConfig).toContain("sizes: '512x512'");
  });

  it('shares the exact same description sentence as index.html\'s meta/og tags (controller pin: "same sentence")', () => {
    const match = /const DESCRIPTION =\s*\n?\s*"([^"]+)"/.exec(viteConfig);
    expect(match?.[1]).toBeTruthy();
    expect(html).toContain(match?.[1] as string);
  });
});

describe('inline theme-flash boot script behaviour (self-review: cannot throw on storage-disabled)', () => {
  const bootScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

  /** Replaces window.localStorage with a fake whose getItem is under test control. */
  function stubStorage(getItem: () => string | null) {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem } });
  }

  function throwingStorage() {
    stubStorage(() => {
      throw new Error('storage disabled (e.g. Safari private browsing)');
    });
  }

  /** jsdom has no matchMedia; fakes a single-query MediaQueryList (same pattern as tests/ui/shell.test.tsx). */
  function stubMatchMedia(matches: boolean) {
    window.matchMedia = (query: string) =>
      ({
        media: query,
        matches,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => true,
        onchange: null,
      }) as unknown as MediaQueryList;
  }

  function runBootScript() {
    // Executes the exact extracted <script> body (not arbitrary code) so
    // the test proves something about the real boot script, not a re-typed copy of it.
    new Function(bootScript)();
  }

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('does not throw when localStorage.getItem throws outright, and falls back to matchMedia (dark)', () => {
    throwingStorage();
    stubMatchMedia(true);
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does not throw when localStorage.getItem throws outright, and falls back to matchMedia (light)', () => {
    throwingStorage();
    stubMatchMedia(false);
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it("stamps 'dark' when the stored settings.theme is 'dark', overriding a light-preferring matchMedia", () => {
    stubStorage(() => JSON.stringify({ settings: { theme: 'dark' } }));
    stubMatchMedia(false);
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it("stamps 'light' when the stored settings.theme is 'paper', overriding a dark-preferring matchMedia", () => {
    stubStorage(() => JSON.stringify({ settings: { theme: 'paper' } }));
    stubMatchMedia(true);
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('does not throw when the stored value is corrupt JSON, and falls back to matchMedia', () => {
    stubStorage(() => '{not-json');
    stubMatchMedia(false);
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('does not throw when there is no stored value at all (getItem returns null), and falls back to matchMedia', () => {
    stubStorage(() => null);
    stubMatchMedia(true);
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it("stamps 'light' for a stored-but-invalid theme value, matching domTheme's fallthrough -- NOT matchMedia, even though matchMedia prefers dark (fix round 1, Important #1 regression test)", () => {
    // Regression test for the exact bug the coordinator's review caught:
    // a parseable-but-invalid stored theme (neither 'dark' nor 'paper', e.g.
    // a future schema bug or hand-edited storage) must map straight to
    // light via domTheme's own `=== 'dark' ? 'dark' : 'light'` fallthrough,
    // the same as the real app would (readStoredTheme() returns the raw
    // stored string as a *truthy* value here, so LocaleProvider's `??
    // systemTheme()` never fires) -- it must NOT fall through to
    // matchMedia and pick dark just because the stored value isn't 'paper'.
    stubStorage(() => JSON.stringify({ settings: { theme: 'sepia' } }));
    stubMatchMedia(true); // system prefers dark; the stored (if invalid) value must still win, mapping to light
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it("stamps 'light' for a stored empty-string theme, NOT matchMedia -- falsy is not nullish (fix round 2, Important #1 regression test)", () => {
    // The exact edge the round-1 fix (a truthiness check) still missed:
    // '' is falsy, so `theme ? ... : matchMedia(...)` would wrongly treat
    // it as "nothing stored" and consult matchMedia -- but the real app's
    // `readStoredTheme() ?? systemTheme()` uses `??`, which does NOT
    // substitute on '' (only on null/undefined), so readStoredTheme()
    // returns '' itself and domTheme('') falls through to light without
    // ever calling matchMedia. The fix (`theme != null ? ... : ...`) must
    // do the same: only null/undefined reach matchMedia.
    stubStorage(() => JSON.stringify({ settings: { theme: '' } }));
    stubMatchMedia(true); // system prefers dark; the stored '' must still win, mapping to light
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
