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
    'do calendar arithmetic with plain integer math instead (src/engine/civil.ts).',
};

// gr6-095: the §3.1 determinism op-set used to be enforced by prose alone —
// four engine file headers named these as forbidden and nothing checked. The
// engine may use +,-,*,/, Math.sqrt, Math.exp, Math.log, Math.imul and the
// spec-exact integer ops (|0, >>>, round/floor/abs/min/max) and nothing else.
// Everything below is either implementation-approximated with a WIDER spread
// than exp/log (the trig family, hypot, cbrt, expm1, log1p, log2, log10),
// deliberately lossy (fround), or locale/environment-dependent (Intl,
// toLocale*) — any of which would break same-engine reproduction or make the
// output depend on the user's machine rather than the day's seed.
const ENGINE_BANNED_MATH = [
  'pow',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'hypot',
  'cbrt',
  'expm1',
  'log1p',
  'log2',
  'log10',
  'fround',
];

const noBannedEngineMath = ENGINE_BANNED_MATH.map((property) => ({
  object: 'Math',
  property,
  message:
    `Math.${property} is banned in src/engine/** — §3.1 pins the determinism op-set to ` +
    '+,-,*,/,sqrt,exp,log,imul plus the spec-exact integer ops. ' +
    (property === 'pow'
      ? 'Integer powers are written as repeated multiplication (see dgp.ts buildAr1Matrix); ' +
        'non-integer powers go through exp/log.'
      : 'If you genuinely need this, it is a spec change, not a local decision.'),
}));

const noExponentOperator = {
  selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
  message:
    'The ** operator is banned in src/engine/** — it is Math.pow by another spelling. ' +
    'Write integer powers as repeated multiplication; route anything else through exp/log.',
};

const noIntl = {
  selector: "MemberExpression[object.name='Intl'], NewExpression[callee.object.name='Intl']",
  message:
    'Intl.* is banned in src/engine/** — the engine must be a pure function of (isoDate, attempt), ' +
    'never of the host locale or ICU version. Formatting belongs in src/ui/** and src/content/**.',
};

const noToLocale = {
  selector: "CallExpression[callee.property.name=/^toLocale[A-Za-z]*$/]",
  message:
    'toLocale* is banned in src/engine/** — its output depends on the host locale and ICU version, ' +
    'not on the day seed. Use toFixed/String (spec-exact) here and format in src/ui/**.',
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
    // T23/gr6-117: scripts/generate-pwa-images.mjs is a Node build script and
    // was linted by nothing — the `**/*.{ts,tsx}` glob above never matched it.
    // Linted here with node globals; it is a build-time tool, not part of the
    // shipped seeded game, so the src/** engine rules deliberately do not apply.
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    // Engine purity: src/engine/** may depend on its own modules, on
    // src/game/tuning.ts (pure constants) and on the checksum-guarded lookup
    // tables in src/data/ — never react, ui, game (besides tuning), i18n or
    // content — and never touch the wall clock.
    //
    // src/data/* is allowed EXPLICITLY (gr6-095): reveal.ts imports
    // src/data/p_hit_by_k.json, a language-blind build artefact whose contents
    // are asserted against the live DGP constants at every init (see
    // protocol.ts's pHitAtK(1) call). The rule used to say "the sole allowed
    // exception is src/game/tuning.ts" while that second import sat there
    // uncovered by any pattern — the stated rule and the enforced rule
    // disagreed. The design-spec sentence (docs/implementation_plan.md §5,
    // i18n §1) is worded to match: tuning.ts plus the checksum-guarded tables
    // in src/data.
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
                '**/data/*',
                '!**/data/*.json',
              ],
              message:
                'src/engine/** must stay UI- and game-free — the only allowed outside dependencies are ' +
                'src/game/tuning.ts (pure constants) and the checksum-guarded lookup tables in src/data/*.json.',
            },
          ],
        },
      ],
      'no-restricted-properties': ['error', noMathRandom, noDateNow, ...noBannedEngineMath],
      'no-restricted-syntax': ['error', noNewDate, noExponentOperator, noIntl, noToLocale],
    },
  },
);
