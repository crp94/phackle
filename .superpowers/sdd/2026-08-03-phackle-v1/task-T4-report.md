# Task T4 report — i18n layer + content contracts + EN copy catalog skeleton

Branch: `worktree-agent-a63c5a5a4ce4b8570` · Final commit: `0dbecf67a3fa50f44257366dc5fe782644c4a313`

## Implemented

Files created (all new; nothing pre-existing was modified):

- `src/i18n/locale.ts` — `detectLocale(navLang, stored)` (stored choice wins; else two-letter prefix match against `it`/`es`; else `en`) and `AVAILABLE_LOCALES: Locale[]` (starts `['en']`; comment marks where T19/T20 append `'it'`/`'es'`).
- `src/i18n/t.ts` — `t(copy, key, params?)`: `{param}` interpolation via regex replace; an unsupplied param is left visible as the literal `{token}`; a key absent from the catalog (type-level unreachable under `Record<CopyKey,string>`) returns the key itself.
- `src/i18n/LocaleProvider.tsx` — `<LocaleProvider>` + `useLocale()`. Detects locale on mount (`detectLocale` + a stored-locale reader), loads content via `getContent()` in a `useEffect`, persists an explicit `setLocale()` call to `localStorage` (key `phackle.settings`, merged with whatever else may live there — flagged with a comment for whichever task owns the real `phackle.v1` schema, master spec §5.6, which I did not read), and keeps `<html lang>` synced in a second effect.
- `src/content/types.ts` — `Scenario`, `PressBlurb`, `AchievementId` (the 11-member union from master spec §2.11, minus the v2-reserved "Reviewer 2"), `LocaleContent`. Imports `CopyKey` (type-only) from `./en/copy.ts` for the `copy` field, per the brief's explicit file assignment.
- `src/content/journals.ts` — `JOURNALS`: 18 entries (≥15 required), English in all locales by design. The master spec's 6 example names are included verbatim; 12 more authored in the same register to reach the count and give T6's future scenarios enough tag variety (`pets, finance, lifestyle, wellness, general, productivity, workplace, technology, fitness, superstition, nature, creative, music, astronomy, communication`).
- `src/content/en/copy.ts` — `CopyKey` (79-member union) + `copy: Record<CopyKey, string>`. Every key group the brief names explicitly (`briefing.*`, `lab.*` [12], `published.*`, `call.*`, `reveal.*` [13], `summary.*`, `prereg.*`, `errors.*`) is present with exactly the members listed; the wildcard groups (`nav.*`, `stats.*`, `about.*`, `legend.*`, `a11y.*`) I populated with a reasonable starter set (6/7/8/6/5 keys) inferred from `src/engine/types.ts`'s `Spec`/`RevealMetrics`/`DayRecord` shapes and the key names themselves (e.g. `lab.outcome`/`lab.subgroup`/... map directly onto `Spec`'s fields; `reveal.retracted`/`replicated`/`nullReported` map onto `RevealMetrics.stamp`'s three literal values).
- `src/content/en/index.ts` — assembles the full `LocaleContent`: 2 scenarios (`cat-crypto`, `standing-desk-poetry` — the brief requires only these two; the other 18 land in T6), 14 Grantwell emails (≥12), 6 press blurbs across all 3 tiers, 6 retraction sublines, all 11 achievements (name + citation, register: deadpan award-citation per master §4.5), 8 glossary entries (Appendix B's full list).
- `src/content/index.ts` — `getContent(locale)`: dynamic `import('./en')` for all three cases; `it`/`es` cases each carry an inline `// Replaced by T19` / `// Replaced by T20` comment; a `default` branch does an exhaustiveness check (`const exhaustive: never = locale`) so a future 4th `Locale` member is a compile error here.

Tests:

- `tests/i18n/locale.test.ts` — 11 tests: `detectLocale` (it/es/fr→en/undefined→en/stored-wins/stored-wins-even-when-nav-agrees-with-a-different-locale) + `t()` (plain passthrough, full interpolation, partial interpolation leaves the other token visible, no-params-at-all leaves both tokens visible, missing key returns the key via a forced cast).
- `tests/content/shape.test.ts` — defines and exports `validateLocaleContent(content, referenceIds?): string[]` (empty array = valid), then 9 tests: a clean run against the real English content, a `referenceIds`-matches pass, a `referenceIds`-mismatch flag, too-few-scenarios, too-few-grantwell, duplicate-id, bad-journalTag, missing-outcome-label, bad-question-format. `MIN_SCENARIOS = 2` with the required `// T6 raises to 20: const MIN_SCENARIOS = 20;` marker line left commented directly below it.
- `tests/i18n/LocaleProvider.test.tsx` — not explicitly required by the brief's file list (only `locale.test.ts` and `shape.test.ts` are named), but added because `LocaleProvider.tsx` contains real, non-trivial logic (async load, persistence, `<html lang>` sync) that TDD's "before you write it, test it" applies to just as much as a pure function, and the dispatch prompt's jsdom-pragma hint was clearly anticipating this file. 4 tests: default-to-English + async content load + `<html lang>` sync, explicit switch + persistence + re-sync, stored-locale-wins-on-mount, throws outside a provider.

## TDD RED → GREEN evidence

RED (all 3 new test files written before any `src/i18n`/`src/content` file existed):

```
❯ tests/i18n/locale.test.ts (0 test)
❯ tests/content/shape.test.ts (0 test)
❯ tests/i18n/LocaleProvider.test.tsx (0 test)
Error: Cannot find module '../../src/content/en' imported from .../tests/content/shape.test.ts
Error: Failed to resolve import "../../src/i18n/LocaleProvider" from "tests/i18n/LocaleProvider.test.tsx"
Error: Cannot find module '../../src/i18n/locale' imported from .../tests/i18n/locale.test.ts
Test Files  3 failed | 3 passed (6)   [the 3 passing files are T1's pre-existing engine/game tests]
     Tests  34 passed (34)
```

GREEN (after all 8 implementation files written, plus two follow-up fixes — see Concerns):

```
Test Files  6 passed (6)
     Tests  58 passed (58)
```

Full gate, final run, all green:

```
npx vitest run     → Test Files 6 passed (6) / Tests 58 passed (58)
npx tsc --noEmit   → (no output — clean)
npm run lint       → (no output — clean)
npm run build      → ✓ built in 76ms
```

## Files changed

```
A  src/content/en/copy.ts
A  src/content/en/index.ts
A  src/content/index.ts
A  src/content/journals.ts
A  src/content/types.ts
A  src/i18n/LocaleProvider.tsx
A  src/i18n/locale.ts
A  src/i18n/t.ts
A  tests/content/shape.test.ts
A  tests/i18n/LocaleProvider.test.tsx
A  tests/i18n/locale.test.ts
```

One commit: `0dbecf6 feat: i18n layer, locale detection, typed trilingual content contracts`.

## Self-review

- **Types exported where consumers need them**: `Scenario`, `PressBlurb`, `AchievementId`, `LocaleContent` (content/types.ts); `CopyKey` + `copy` (content/en/copy.ts); `JOURNALS` (content/journals.ts); `content` (content/en/index.ts); `getContent` (content/index.ts); `detectLocale` + `AVAILABLE_LOCALES` (i18n/locale.ts); `t` (i18n/t.ts); `LocaleProvider` + `useLocale` (i18n/LocaleProvider.tsx); `validateLocaleContent` (tests/content/shape.test.ts, per the brief's explicit "shape.test.ts — exports a reusable validateLocaleContent" wording — T19/T20 import it from the test file, not from `src/`).
- **Catalog keys named per the brief's groups**: every explicitly-enumerated key across `briefing`/`lab`/`published`/`call`/`reveal`/`summary`/`prereg`/`errors` is present with exactly the members listed (double-checked by direct enumeration against the brief text). Wildcard groups (`nav`/`stats`/`about`/`legend`/`a11y`) are my own reasonable addition, ~70-75 keys total (79 exactly) vs. the brief's "~70" — I judged the extra ~9 worth keeping (About-page disclosure copy, a11y labels) rather than trimming useful content to hit a number the brief itself calls approximate.
- **No tautological tests**: every `shape.test.ts` "flags X" test constructs a deliberately-broken fixture and asserts the specific rule fires (not just "no error thrown"); every `locale.test.ts`/`LocaleProvider.test.tsx` test asserts a specific, distinguishing value, not framework wiring.
- **Import boundary**: verified by construction — nothing under `src/content/**`/`src/i18n/**` is imported anywhere in `src/engine/**` (I never touched `src/engine/`), and `eslint.config.js`'s existing `no-restricted-imports` rule on `src/engine/**` already covers this direction; I did not touch that file. The reverse direction (my code importing `type Locale` from `src/engine/types.ts`) is allowed and used (content/index.ts, i18n/locale.ts, i18n/LocaleProvider.tsx) — confirmed clean under `npm run lint`.
- **Dependency graph acyclic**: `content/en/copy.ts` is a leaf (no imports); `content/types.ts` imports its `CopyKey` type-only; `content/en/index.ts` and `i18n/t.ts`/`LocaleProvider.tsx` converge on both without any file importing back toward them.
- **Scope discipline**: only 2 scenarios written (as instructed); did not read master spec beyond §4/§4.3, plus a narrowly-targeted extension into §2.11 (achievement trigger table — needed to name the 11 `AchievementId` values correctly) and Appendix B (glossary terms — a direct `LocaleContent` field). I also incidentally read §1.1-1.4 in an early exploratory `sed` before I knew where §4 was in the document — flagging this for transparency; it's high-level pitch/pillars text, nothing mechanical, and didn't influence any content decision beyond what the dispatch prompt itself already established.

## Concerns

1. **Environment: default `node`/`npm`/`npx` on PATH is the wrong version.** This is almost certainly a **cross-cutting concern for every other agent on this plan**, not just T4. `which node` resolves to a Homebrew-installed **v25.4.0**, but the repo's own `.nvmrc` pins **22**, and `jsdom@30.0.1`'s `engines` field explicitly excludes the 25.x line (`^22.22.2 || ^24.15.0 || >=26.0.0` — 25.x is conspicuously *not* covered). Concretely, v25.4.0 ships a stable-by-default `globalThis.localStorage` that is a non-functional stub without a `--localstorage-file` flag (missing `.clear()`, etc.), and jsdom's own environment does not shadow it — so any jsdom-environment test that touches `localStorage` fails with `TypeError: ... is not a function`, for reasons that have nothing to do with the code under test. `/usr/bin/node` (v22.22.1, matching `.nvmrc`) does not define this global at all, so jsdom's own polyfill works cleanly. **I ran every command in this session prefixed with `PATH="/usr/bin:$PATH"`** once I diagnosed this. Recommend the same for any sibling/future task whose tests touch `localStorage`/`sessionStorage` under `@vitest-environment jsdom` — and possibly worth a `.github/workflows/test.yml`/CI check that it's actually pinning Node 22, since a hosted CI runner defaulting to a too-new Node could hit the same wall silently. I also generalized `LocaleProvider.tsx` to go through `window.localStorage` explicitly rather than the bare global — correct regardless of this Node quirk (real browsers only ever exposed it on `window` anyway), but I want to be transparent that the *trigger* for finding this was the version mismatch, not a bug in the original bare-global code.
2. **Infra: worktree fast-forward.** My worktree branch was forked at pre-T1 commit `60c4787` (8 commits behind `build/v1`). I self-resolved via `git merge --ff-only build/v1` before making any commits of my own (verified zero divergence via `git merge-base`); the coordinator separately authorized `git reset --hard 4aa1df2` for the same class of issue — both reach the identical end state, already reconciled via SendMessage during the session.
3. **My own path mistake, self-caught and fixed.** Early in the session I wrote all 3 test files using the absolute path prefix `/home/carlos/PycharmProjects/phackle/...` (the "additional working directory") instead of my actual worktree path — Bash commands (cwd-relative) were unaffected, so `find`/`ls` "confirmed" the files existed while `npx vitest run` (correctly scoped to my real worktree) saw nothing, which briefly looked like a filesystem-visibility/sandboxing bug before I traced it to the path mistake. I removed the stray files from the main checkout (verified `tests/engine/dgp.test.ts` and `tests/engine/fixtures/` — apparently a sibling agent's in-progress work — were left untouched), re-created everything at the correct worktree path, and reconfirmed genuine RED before proceeding. Reported to the coordinator during the session.
4. **`content` / `copy` are nullable in `useLocale()`'s return**, unlike the brief's return-shape comment which doesn't show them as nullable. This is unavoidable given `getContent()` is a genuine async dynamic import — I judged `LocaleContent | null` / `Record<CopyKey,string> | null` the honest typing, with `t()` falling back to returning the bare key while `content` is still loading. Consumers (T14-T18) will need to handle a brief loading state; flagging in case the intended design was actually to block rendering until content resolves via a different mechanism (e.g., a suspense boundary) rather than exposing nullability directly.
5. **`briefing.correspondingAuthor`** is authored as one static string ("Corresponding author: Prof. R. Grantwell") rather than a `{name}`-interpolated template, since Grantwell is an invariant recurring character (like a journal name) rather than per-scenario data — flagging in case a later task expected the name to be a separate content field.
6. **Localization persistence key** (`phackle.settings`) is my own naming choice, not read from the master spec's §5.6 (out of my authorized reading scope) — flagged inline in the code for whichever task owns the real persistence schema to reconcile/rename if needed.
