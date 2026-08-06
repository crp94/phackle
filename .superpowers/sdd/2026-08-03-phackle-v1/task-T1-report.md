# Task T1 Report — Scaffold, toolchain, PRNG, seeds, types, tuning

Status: **DONE**

## Summary

Implemented the full T1 brief: a hand-scaffolded Vite + React 19 + TypeScript-strict
project (Tailwind 4 via `@tailwindcss/vite`, ESLint 9-flat-config, Vitest+jsdom),
the deterministic PRNG substrate (`splitmix32`/`fnv1a32` verbatim from Appendix A,
plus `mulberry32`/`gaussPair`), the engine's core types and worker-protocol types,
the seeded day/scenario/effect derivations, the tuning constants, the game-side
date/practice-mode utilities, engine-purity ESLint rules (verified against both
legitimate and adversarial code), and a CI workflow. 34 tests across 3 files, all
green; `tsc --noEmit`, `eslint .`, and `vite build` all clean.

## Commits

1. `38ec6b2` chore: scaffold Vite+React 19+TS toolchain with Tailwind 4 and Vitest
2. `a385f35` feat: add deterministic PRNG primitives (splitmix32, fnv1a32, mulberry32, gaussPair)
3. `d344362` feat: add engine core types and worker protocol types
4. `b79872a` feat: add tuning constants and seeded day/scenario/effect derivations
5. `c935adb` feat: add game-side date and practice-mode utilities
6. `609ff89` chore: add CI workflow (lint, typecheck, test, build on push/PR)

All on `build/v1`. Not pushed (controller pushes).

## Files changed (21 files, 5253 insertions)

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.nvmrc`, `.gitignore`, `index.html`
- `src/main.tsx`, `src/ui/App.tsx`, `src/ui/theme/tokens.css`
- `src/engine/prng.ts`, `src/engine/types.ts`, `src/engine/protocol.ts`, `src/engine/seeds.ts`
- `src/game/tuning.ts`, `src/game/daily.ts`
- `.github/workflows/test.yml`
- `tests/engine/prng.test.ts`, `tests/engine/seeds.test.ts`, `tests/game/daily.test.ts`

## Requirements read (as instructed, nothing beyond)

- `docs/implementation_plan.md` §3.1 (determinism & seeding), §6 (core TS interfaces), Appendix A (PRNG code).
- Did not read §3.2–§3.9, §5 (repo structure), §7, §8 etc. — the brief's own "Files"/"Interfaces"/"Steps" sections were sufficient for everything else T1 needed (including all §3.9 tuning constants, which the brief already quoted verbatim).

## Decisions made where the brief was ambiguous or (I believe) superseded

1. **Tailwind integration: `@tailwindcss/vite`, not `@tailwindcss/postcss`, and no `postcss.config.mjs`.**
   The brief's own Scaffold step says `@tailwindcss/postcss (like climatle)` and lists
   `postcss.config.mjs` as a file to create. My dispatch instructions' "Decisions
   already made (do not re-litigate)" section explicitly overrides this: "Tailwind 4
   via the `@tailwindcss/vite` plugin." Since Tailwind v4's Vite plugin and its PostCSS
   plugin are two *alternative*, non-composable installation methods (per Tailwind's
   own docs), I followed the explicit override and did not create `postcss.config.mjs`
   — adding an empty/unused one alongside the Vite plugin would be dead, confusing
   config. Flagging this as the one place I deviated from the brief's literal file list.

2. **`src/engine/protocol.ts`'s import line needed `WindowN` added.**
   The exact block quoted in my dispatch had `import type { Spec, PathResult,
   RevealMetrics, DayType, Outcome } from './types';` but then used `WindowN` in
   `InitInfo`/`ExtendInfo` without importing it — the file would not compile as
   literally transcribed. Added `WindowN` to the import list; everything else in
   that block is verbatim.

3. **`mulberry32`/`gaussPair` aren't in Appendix A's code block** (only `splitmix32`/
   `fnv1a32` have printed code there; Appendix A's prose separately says "Gaussian:
   Box–Muller from two uniforms (cache the spare)"). The brief asks for "standard
   mulberry32, seeded via a splitmix32 stream" and "Box–Muller, allowed op set only":
   - `mulberry32(seed)`: one `splitmix32(seed)` step produces mulberry32's actual
     internal state (recovering the exact underlying uint32 via `× 4294967296`,
     which is lossless since both are powers of two), then the standard mulberry32
     update runs from there. This is the common "scramble a raw seed through a
     stronger mixer before a fast/simple generator" pattern, and protects against
     mulberry32's known weak-seed correlation for adjacent integers — not load-bearing
     for correctness here (our seeds are already-well-mixed fnv1a32 hashes) but cheap
     and standard.
   - `gaussPair`: implemented as the **Marsaglia polar** variant of Box–Muller
     (rejection-sample a point in the unit disc, `factor = sqrt(-2·ln(s)/s)`) rather
     than the textbook `sqrt(-2 ln U)·cos/sin(2πU)` form. §3.1's allowed op set is
     "+,−,×,÷,sqrt,exp,log" — no trig — precisely because sin/cos can differ at the
     ULP level across JS engines, breaking the byte-identical-puzzle guarantee. The
     polar method needs only sqrt/log/arithmetic, so it stays inside that set while
     still being "Box–Muller" in the sense the brief names (a pair of correlated
     uniforms turned into a pair of independent standard normals).

4. **Scenario rotation: exclusion set is each prior date's *fully-resolved* index,
   not its raw `idx0`.** The brief's pinned rule reads: "compute the indices chosen
   for the previous 13 dates (same function, recursively without the check — i.e.,
   their idx0 walk results)". Read as "use each prior date's raw idx0 only" would not
   actually guarantee zero repeats within every 14-day window once collisions cascade
   (with count=20 and a 14-wide window, raw-hash collisions before adjustment are
   common by the birthday bound) — a prior date's *actual* chosen scenario can differ
   from its raw idx0, and excluding only the raw value can let today collide with what
   that date actually showed. So `scenarioIndexFor` recurses into the *same* function
   for each of the previous 13 dates (their real, already-walked index), which does
   guarantee the property the test checks. Two consequences of that choice, both
   necessary and both handled:
   - Naive unbounded recursion over calendar time never terminates, so dates at/before
     `EPOCH` are the base case (no game history before day 1, hence no exclusion set —
     this is semantically correct, not just a computational stop-gap).
   - `new Date` is banned in `src/engine/**`, so "the previous 13 calendar dates" are
     computed with pure-integer civil-calendar arithmetic (Howard Hinnant's
     `days_from_civil`/`civil_from_days`), hand-verified via the 1970-01-01 round trip
     (see Verification below) before trusting it inside `seeds.ts`.
   - A module-level memo (`Map`) avoids re-walking the same date's dependency chain
     exponentially. This is not "state" in the determinism sense — every cached entry
     is exactly what a fresh computation would produce; it's a pure-function memo, not
     externally-observable game state.
   I chose the test's date range to start at `EPOCH` specifically so the 60-date,
   count=20 "no repeat in any 14-day window" test exercises the recursive/adjusted
   path (not just the base case).

5. **`typescript` pinned to `~6.0.3`, not `latest` (7.0.2).** `typescript-eslint@8.65.0`
   (latest) has `peerDependencies.typescript: '>=4.8.4 <6.1.0'` — TS 7.0.2 would be an
   unresolvable peer conflict. 6.0.3 is the highest stable release inside that range
   (verified via the npm registry: stable versions are `...,5.9.3, 6.0.2, 6.0.3`, then
   the line jumps straight to `7.0.1-rc`/`7.0.2`). Used `~6.0.3` (not `^`) so a future
   `npm install` can't silently cross into 6.1.x and break that peer range again.

6. **Added `.gitignore`** (not in the brief's own file list, but explicitly required by
   my dispatch instructions) covering `node_modules/`, `dist/`, `coverage/`,
   `playwright-report/`/`test-results/`, and `.superpowers/`. Per those instructions,
   `.superpowers/` is ignored in full — including this report file — since the
   instruction was "never commit it," not "commit only the report."

7. **Extra test coverage beyond the brief's explicit RED bullet list.** The brief's RED
   step spells out specific assertions for `prng.test.ts` and `seeds.test.ts` in full,
   but for `daily.test.ts` only names `daysBetween`/`puzzleNumber`. Since `daily.ts` has
   five exports total, I added light, non-flaky coverage for `localIsoDate`, `isPractice`,
   and `practiceSeed` too (see the test file for exact cases) — leaving three of five
   exports of a file this task delivers completely untested felt like a real gap, not
   scope creep. Also added a couple of cheap extra edge cases beyond the letter of the
   brief where they were nearly free and directly strengthened the determinism story:
   a second DST boundary (US fall-back, Nov 1→2, in addition to the required spring-
   forward one), a multi-day-span and reversed-order check for `daysBetween`, and
   direct value/range/type checks on `effectParamsFor`'s other fields (outcome index,
   hetero booleanness, heteroSubgroup membership) alongside the required `d`-range check.

## TDD evidence

**RED** — wrote all three test files against not-yet-existing modules, then:

```
$ npx vitest run
...
FAIL  tests/engine/prng.test.ts [ tests/engine/prng.test.ts ]
Error: Cannot find module '../../src/engine/prng' imported from .../tests/engine/prng.test.ts
FAIL  tests/engine/seeds.test.ts [ tests/engine/seeds.test.ts ]
Error: Cannot find module '../../src/engine/seeds' imported from .../tests/engine/seeds.test.ts
FAIL  tests/game/daily.test.ts [ tests/game/daily.test.ts ]
Error: Cannot find module '../../src/game/daily' imported from .../tests/game/daily.test.ts
Test Files  3 failed (3)
     Tests  no tests
```
Matches the brief's expected "modules not found" exactly.

Golden `splitmix32(1)` values were computed once via a throwaway script
(`scratchpad/compute-golden.mjs`, transcribing Appendix A's algorithm exactly, run
with plain `node`) before writing the test's hard-coded fixture — not guessed:
`[0.36787554295733571, 0.08161311969161034, 0.82053577830083668]`. Same script also
confirmed `fnv1a32('') === 2166136261 (0x811c9dc5)` and the attempt-0/attempt-1
divergence used in the test.

**GREEN** — implemented `types.ts` → `prng.ts` → `tuning.ts` → `seeds.ts` → `daily.ts` → `protocol.ts`:

```
$ npx vitest run
 Test Files  3 passed (3)
      Tests  34 passed (34)
   Duration  163ms

$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
> eslint .
(exit 0, no output)

$ npm run build
> vite build
✓ 16 modules transformed.
✓ built in 74ms
```

Ran the full gate (`npx vitest run && npx tsc --noEmit && npm run lint && npm run build`)
together, green, before every commit.

### Lint false-starts fixed during GREEN (worth recording)

- `no-useless-assignment` fired on splitmix32's verbatim Appendix-A line
  (`return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;`) — the rule doesn't recognize
  that the reassignment's value is consumed by the enclosing `>>> 0` in the same
  expression. Since the brief requires this line verbatim, fixed with a narrowly
  scoped, justified `eslint-disable-next-line` rather than restructuring Appendix A's
  algorithm.
- The same rule also fired on my own original `gaussPair` (a `do…while` with `let`
  reassignment); rewrote it as a `for (;;)` loop with fresh `const`s per iteration —
  cleaner code that sidesteps the issue rather than suppressing it.
- First attempt at the `practiceSeed` inline disable comment wrapped its
  justification across multiple `//` lines, which meant `eslint-disable-next-line`
  ended up pointing at a comment line instead of the `Math.random()` call (ESLint
  correctly reported both "unused disable directive" *and* the real violation). Fixed
  by keeping the disable directive itself on a single line immediately above the
  code, with the fuller rationale as ordinary comments above that.

### Adversarial verification of the purity rules (not just that legitimate code passes)

Since "write the ESLint purity rules" is a core deliverable, I planted a throwaway
file (`src/engine/_lint_check.ts`, deleted immediately after) importing `react` and
`../game/daily`, calling `Date.now()`, `new Date()`, and `Math.random()`. All six
were caught:

```
1:1   error  'react' import is restricted ... no-restricted-imports
2:1   error  '../game/daily' import is restricted ... no-restricted-imports
6:3   error  React Hook "useState" is called ... react-hooks/rules-of-hooks
8:15  error  'Date.now' is restricted ... no-restricted-properties
9:13  error  new Date is banned in src/engine/** ... no-restricted-syntax
10:13 error  'Math.random' is restricted ... no-restricted-properties
```
The same file's `import { EPOCH } from '../game/tuning';` produced **no** error,
confirming the `no-restricted-imports` negated-group exception (`'!**/game/tuning'`)
correctly allows the one sanctioned cross-boundary import while blocking everything
else under `src/game/*`.

### Hand-verification of the civil-calendar arithmetic

Before trusting `daysFromCivil`/`civilFromDays` inside `seeds.ts`, hand-computed the
1970-01-01 round trip: `daysFromCivil(1970,1,1) = 0` and `civilFromDays(0) =
[1970,1,1]`, both worked through by hand against the formulas actually committed
(shown in full in the session transcript). This game only ever evaluates dates in the
2020s (`EPOCH = '2026-08-10'`), so the negative-year branches are never exercised in
practice, but they're the standard, published Hinnant algorithm, not a novel
simplification.

## Self-review

**Completeness.** Every file in the brief's list exists except `postcss.config.mjs`
(deliberately, see decision 1). Every exported symbol in the brief's "Interfaces"
block exists with the exact name/signature. Every §3.9 constant is present, verbatim
values. Scenario rotation, day type, effect params, and the daily/practice utilities
all implemented and tested. Protocol types compile. CI workflow covers setup-node 22,
`npm ci`, lint, typecheck, test, build.

**Quality.** Every non-obvious decision has an inline comment explaining *why*
(civil-calendar math, the polar Box–Muller choice, the EPOCH base case, the
mulberry32 seeding). No dead code, no leftover debug output. Function/variable names
match the brief's exact contract names throughout.

**Discipline (YAGNI).** No extra source files, no extra exports, no speculative
abstractions. Added npm scripts (`dev`, `preview`, `test:watch`, `typecheck`) beyond
the two the brief's verify commands strictly invoke via `npm run` (`lint`, `build`) —
these are standard, near-zero-cost Vite-project scripts, not speculative features, and
`typecheck` is used directly by the CI workflow. The only content-level additions
beyond the brief's letter are the extra test cases explained in decision 7 above, all
justified as completing (not expanding) this task's own deliverables.

**Testing.** All 34 tests assert real behavior (fixture values, statistical
tolerances, round-trips, determinism, sliding-window invariants) — no mocking.
Verified the ESLint rules adversarially, not just that legitimate code passes them
(see above). `npx vitest run` output is pristine — 3 files, 34 tests, no warnings.
`npm run lint` produces zero output on the real tree.

## Environment note (not a concern, just accurate accounting)

Local sandbox has Node v25.4.0 (no nvm available to install 22 locally); `.nvmrc`
correctly pins `22` and CI uses `actions/setup-node@v4` with `node-version: 22`. `npm
install` emitted one `EBADENGINE` warning for `jsdom@30.0.1` (wants `^22.22.2 ||
^24.15.0 || >=26.0.0`; v25.4.0 falls in the gap between the 24.x and 26.x lines it
supports) — a local-sandbox artifact only; real Node 22.x (used by `.nvmrc` and CI)
satisfies jsdom's engine range. No other install-time warnings; `npm view
<pkg>peerDependenciesMeta` was checked for every package with a peer dependency
before deciding to skip it (`canvas` for jsdom, `@rolldown/plugin-babel` /
`babel-plugin-react-compiler` for `@vitejs/plugin-react` — all three are
peerDependenciesMeta-optional and unused here).

## Concerns

- Decision 1 (skipping `postcss.config.mjs`) is a literal deviation from the brief's
  file list, though I believe strictly correct given the explicit "decisions already
  made" override in my dispatch instructions. Flagging for visibility in case the
  controller intended something else by listing that file.
- Decision 4 (scenario-rotation exclusion semantics) is my best-effort reading of a
  genuinely ambiguous pinned rule; the property it must satisfy (no repeat in any
  14-day window) is tested and passes, but a different implementer could plausibly
  have read "idx0 walk results" the other way. Worth a second pair of eyes.

No other concerns — all four verification gates are green on the final tree, working
tree is clean, nothing left in `.superpowers/` was touched besides this report.
