import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Task T21 description sentence, shared verbatim with index.html's <meta
// name="description">/og:description (controller pin: "description (same
// sentence)").
const DESCRIPTION =
  "A daily game about how easily data analysis finds what it wants: fork your way to p < 0.05, then face what it cost.";

/**
 * GR6 gr6-084 — DROP FONTSOURCE'S LEGACY `.woff` FALLBACK BEFORE VITE SEES IT.
 *
 * Every `@fontsource/*` entry point this app imports declares two sources:
 *
 *     src: url(./files/…-normal.woff2) format('woff2'),
 *          url(./files/…-normal.woff)  format('woff');
 *
 * Vite resolves BOTH `url()`s during its own CSS transform, so both files are
 * emitted into `dist/assets` and both are deployed. Measured on the review
 * build: 126,664 B of `.woff2` and **161,408 B of `.woff`** — and not one byte
 * of the second set is ever requested. `woff2` has been in every shipping
 * browser since 2016; a browser without it cannot run React 19, ES modules,
 * `IntersectionObserver` or `color-mix()`, all of which this app requires
 * unconditionally. The legacy set is pure deploy weight served to nobody.
 *
 * Fontsource publishes no woff2-only entry point, so the fallback is stripped
 * here, at `enforce: 'pre'` — BEFORE `vite:css` rewrites `url()`s into asset
 * references. Stripping it here (rather than deleting the files after the
 * build) means the `.woff` is never emitted AND never referenced: a post-build
 * prune would leave every `@font-face` pointing at a 404 it happens not to
 * fetch. `scripts/check-bundle.ts` fails the build if a `.woff` ever reappears
 * in `dist/`, so a Fontsource upgrade that changes this shape is caught rather
 * than silently un-fixing the saving.
 */
function fontsourceWoff2Only(): Plugin {
  // The second entry only: `.woff2` is spelled `.woff2`, so `\.woff\)` cannot
  // match it. The leading comma is consumed too, leaving a single-source list.
  const LEGACY_SRC = /,\s*url\((?:'|")?[^)'"]*\.woff(?:'|")?\)\s*format\((?:'|")woff(?:'|")\)/g;
  return {
    name: 'phackle:fontsource-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource') || !id.split('?')[0].endsWith('.css')) return null;
      const stripped = code.replace(LEGACY_SRC, '');
      return stripped === code ? null : { code: stripped, map: null };
    },
  };
}

// https://vite.dev/config/  |  https://vitest.dev/config/
export default defineConfig({
  plugins: [
    react(),
    fontsourceWoff2Only(),
    // NOTE (GR6 gr6-090): `tailwindcss()` used to sit here. `@import
    // "tailwindcss"` appears nowhere in the tree, so the plugin generated
    // nothing, no preflight ever ran, and the design system in
    // `src/ui/theme/tokens.css` was — and remains — the only source of style.
    // The plugin and both packages (`tailwindcss`, `@tailwindcss/vite`) are
    // removed rather than wired: DESIGN.md's closed scales are the opposite of
    // a utility framework's open one.
    //
    // Task T21: installability + offline app-shell precache. Icons are
    // pre-rendered PNGs (scripts/generate-pwa-images.mjs from
    // public/favicon.svg), not the plugin's own asset generator. index.html
    // also hand-adds its own <link rel="manifest">: the plugin's dev-server
    // injection is opt-in only (devOptions.enabled, unset here), so without a
    // source-level link there'd be no manifest link at all under `vite dev`.
    // The plugin's *build*-time transform injects one unconditionally too, so
    // `dist/index.html` ends up with two identical copies -- harmless (a
    // repeated identical <link rel="manifest"> is a no-op), and documented
    // where the hand-added one lives in index.html.
    VitePWA({
      registerType: 'autoUpdate',
      // GR6 gr6-049 — THE PRECACHE HAD IT EXACTLY BACKWARDS IN BOTH
      // DIRECTIONS, and workbox's defaults are why.
      //
      // Workbox's default `globPatterns` is exactly `**/*.{js,wasm,css,html}`
      // (verified against `workbox-build/build/schema/GenerateSWOptions.json`
      // in this lockfile — the two `pwa-*.png` entries in the old manifest
      // came from the plugin's own `includeManifestIcons`, not from a glob).
      // That list omits `woff2` and matches every `.js` in `dist/assets` — so
      // the review build precached ALL THREE locale chunks (104.5 KB raw of
      // data no single player ever uses; two thirds of it is another
      // language) and ZERO fonts. An offline player downloaded two unread
      // translations and then rendered the whole game in system fallbacks:
      // no STIX Two Text, no JetBrains Mono, and so no tabular numerals under
      // the p-value dial or the accounting column (DESIGN R2.1/R2.4). The app
      // advertises offline support and went offline without the two things
      // offline actually needs.
      //
      // So: fonts IN (they are the app shell's typography, ~126 KB once, and
      // they never change without a content hash), locale chunks OUT of the
      // precache and onto a StaleWhileRevalidate runtime route. SWR is the
      // right handler for them: the chunk the player's own language pulled on
      // their first visit is cached by the fetch that already had to happen,
      // stays available offline afterwards, and a language switch made while
      // online populates that language too — without every player paying for
      // all three up front, which is precisely what `src/content/index.ts`'s
      // split exists to prevent.
      workbox: {
        // Workbox's own default, plus `woff2`. Deliberately NOT `png`/`svg`:
        // the two installable icons already arrive via `includeManifestIcons`,
        // and adding them by glob as well emits each one TWICE under two
        // different revision keys (measured: 18 entries instead of 14).
        // `og.png` is a crawler asset and is never fetched by the app.
        globPatterns: ['**/*.{js,wasm,css,html,woff2}'],
        // Relative to the build's outDir. The locale chunks are named from
        // their entry (`en-<hash>.js`), which is what makes them addressable
        // as a set both here and in the runtime route below.
        globIgnores: ['assets/{en,it,es}-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(?:en|it|es)-[A-Za-z0-9_-]+\.js$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'phackle-locale-chunks',
              // Three locales, plus headroom for one deploy's worth of
              // superseded hashes so a mid-session update cannot evict the
              // chunk the running page is still using.
              expiration: { maxEntries: 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'P-hackle',
        short_name: 'P-hackle',
        description: DESCRIPTION,
        theme_color: '#FBF8F1',
        background_color: '#FBF8F1',
        display: 'standalone',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    // Engine + game logic run in plain node. UI test files opt into jsdom
    // individually via a `// @vitest-environment jsdom` pragma at their top.
    environment: 'node',
    // Agent worktrees and orchestration scratch carry their own copies of the
    // suite; globbing them re-runs every test N times.
    //
    // T23: `e2e/**` is excluded because those files are Playwright specs, not
    // vitest ones — they match vitest's default `*.spec.ts` glob but import
    // `@playwright/test`, drive a real browser and need a built app on a
    // running preview server. `npm test` (unit) and `npm run e2e` are
    // deliberately two separate commands over two disjoint file sets.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', '.superpowers/**', 'e2e/**'],
  },
});
