import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

// docs/implementation_plan.md §3.1 / §5: the engine must be a pure function of
// (isoDate, attempt) — no wall clock, no Math.random, no reach into UI/game/i18n/content.
const noMathRandom = {
  object: 'Math',
  property: 'random',
  message:
    'Math.random is banned across src/** — the game must be reproducible from its date seed. ' +
    'The one sanctioned exception (practice-mode entropy) lives in src/game/daily.ts behind an inline eslint-disable.',
};

const noDateNow = {
  object: 'Date',
  property: 'now',
  message: 'Date.now is banned in src/engine/** — the engine must be a pure function of (isoDate, attempt).',
};

const noNewDate = {
  selector: "NewExpression[callee.name='Date']",
  message:
    'new Date is banned in src/engine/** — the engine must be a pure function of (isoDate, attempt); ' +
    'do calendar arithmetic with plain integer math instead.',
};

export default tseslint.config(
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results', '.superpowers', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Every source file forbids Math.random (see src/game/daily.ts for the one justified,
    // inline-disabled exception: practice-mode entropy).
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': ['error', noMathRandom],
    },
  },
  {
    // T23: the Playwright suite and its config run in NODE (process.env, the
    // test runner's own globals) while also containing browser-side
    // `page.evaluate` callbacks — so both global sets are legal here. The
    // src/** Math.random ban above deliberately does not extend to this
    // directory: nothing here is part of the shipped, seeded game.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Engine purity: src/engine/** may depend on its own modules and on
    // src/game/tuning.ts (pure constants) only — never react, ui, game (besides
    // tuning), i18n or content — and never touch the wall clock.
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '**/ui/*',
                '**/i18n/*',
                '**/content/*',
                '**/game/*',
                '!**/game/tuning',
              ],
              message:
                'src/engine/** must stay UI- and game-free — the sole allowed exception is src/game/tuning.ts (pure constants).',
            },
          ],
        },
      ],
      'no-restricted-properties': ['error', noMathRandom, noDateNow],
      'no-restricted-syntax': ['error', noNewDate],
    },
  },
);
