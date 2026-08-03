import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Task T21 description sentence, shared verbatim with index.html's <meta
// name="description">/og:description (controller pin: "description (same
// sentence)").
const DESCRIPTION =
  "A daily game about how easily data analysis finds what it wants: fork your way to p < 0.05, then face what it cost.";

// https://vite.dev/config/  |  https://vitest.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Task T21: installability + offline app-shell precache. Icons are
    // pre-rendered PNGs (scripts/generate-pwa-images.mjs from
    // public/favicon.svg), not the plugin's own asset generator, so
    // `strategies`/`workbox.globPatterns` are left at their defaults --
    // generateSW with workbox's own default globs precaches the built
    // JS/CSS/HTML app shell, which is what "default workbox globs are
    // acceptable" asks for. index.html also hand-adds its own
    // <link rel="manifest">: the plugin's dev-server injection is opt-in
    // only (devOptions.enabled, unset here), so without a source-level
    // link there'd be no manifest link at all under `vite dev`. The
    // plugin's *build*-time transform injects one unconditionally too, so
    // `dist/index.html` ends up with two identical copies -- harmless (a
    // repeated identical <link rel="manifest"> is a no-op), and documented
    // where the hand-added one lives in index.html.
    VitePWA({
      registerType: 'autoUpdate',
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
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', '.superpowers/**'],
  },
});
