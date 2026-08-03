import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/  |  https://vitest.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Engine + game logic run in plain node. UI test files opt into jsdom
    // individually via a `// @vitest-environment jsdom` pragma at their top.
    environment: 'node',
  },
});
