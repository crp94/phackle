### Task T1: Scaffold, toolchain, PRNG, seeds, types, tuning

**Files:**
- Create: `package.json`, `vite.config.ts` (Tailwind 4 via `@tailwindcss/vite` plugin — no postcss config file), `tsconfig.json`, `eslint.config.js`, `.nvmrc` (`22`), `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/theme/tokens.css`
- Create: `src/engine/prng.ts`, `src/engine/types.ts`, `src/engine/seeds.ts`, `src/engine/protocol.ts` (types only), `src/game/tuning.ts`, `src/game/daily.ts`
- Create: `.github/workflows/test.yml`
- Test: `tests/engine/prng.test.ts`, `tests/game/daily.test.ts`

**Interfaces (produces — later tasks rely on these exact names):**
```ts
// src/engine/prng.ts  — implement EXACTLY per master spec Appendix A
export function splitmix32(a: number): () => number;
export function fnv1a32(s: string): number;
export function mulberry32(seed: number): () => number;   // standard mulberry32, seeded via splitmix32 stream
export function gaussPair(rng: () => number): [number, number]; // Box–Muller, allowed op set only
// src/engine/types.ts — master spec §6 verbatim (Spec, PathResult, DailyPuzzle, PlayerAction,
// RevealMetrics, DayRecord, DayType, Outcome) plus:
export type Locale = 'en' | 'it' | 'es';
export type WindowN = 200 | 250 | 300 | 350 | 400;
// src/engine/seeds.ts (ENGINE-side: pure hash derivations; imports only prng + tuning)
export function daySeed(iso: string, attempt: number): number;     // fnv1a32(`phackle:${iso}:${attempt}`)
export function dayTypeFor(iso: string): DayType;                  // fnv1a32(`daytype:${iso}`) % 100 < P_EFFECT_PCT
export function scenarioIndexFor(iso: string, count: number): number; // no-repeat-within-14-days (below)
export function effectParamsFor(iso: string): { outcome: Outcome; d: number; hetero: boolean; heteroSubgroup: Spec['subgroup'] };
// outcome: fnv1a32('effoutcome:'+iso)%4; d: EFFECT_D_RANGE[0] + span·(fnv1a32('effsize:'+iso)%1000)/1000;
// hetero: fnv1a32('hetero:'+iso)%100 < HETERO_PROB_PCT; heteroSubgroup: non-'all' subgroups[fnv1a32('heterosub:'+iso)%6]
// src/engine/protocol.ts — TYPES ONLY in T1 (implementation lands in T11); exact shapes in T11's block below.
// src/game/daily.ts (GAME-side: date/URL concerns)
export function localIsoDate(d?: Date): string;                    // local components, YYYY-MM-DD
export function daysBetween(aIso: string, bIso: string): number;   // UTC-midnight diff, Math.round
export function puzzleNumber(iso: string): number;                 // daysBetween(EPOCH, iso) + 1
export function isPractice(search: string): boolean;               // ?practice=1 or today < EPOCH
export function practiceSeed(): number;                            // non-daily entropy; eslint-disable justified
// src/game/tuning.ts — every §3.9 constant:
export const EPOCH = '2026-08-10'; // provisional; frozen to real launch date in T25
export const P_EFFECT_PCT = 25; export const EFFECT_D_RANGE: [number, number] = [0.18, 0.30];
export const NULL_SIG_BAND: [number, number] = [30, 180]; export const N_SCHEDULE: WindowN[] = [200, 250, 300, 350, 400];
export const MIN_CELL = 30; export const DEBOUNCE_MS = 300; export const MAX_ATTEMPTS = 20;
export const SCORING = { correctCall: 100, incorrectCall: 0, parsimonyMax: 40, parsimonyPerFork: 4,
  publishedCareer: 25, abandonNull: 80, abandonEffect: 20, preregSigEffect: 150,
  preregNonsigNull: 100, preregNonsigEffect: 40, preregSigNull: 0 } as const;
export const TIER_FORKS = { polite: 3, editorsPick: 10 } as const;   // ≤3 → tier1, ≥10 → tier3
export const HETERO_MULTIPLIER = 1.6; export const HETERO_PROB_PCT = 50;
```
Scenario rotation rule (pin, disambiguated after T1): the exclusion window uses each prior date's **fully-resolved** index (i.e., the value `scenarioIndexFor` itself returns for that date, collision-walk included), base-cased at EPOCH, computed with pure integer calendar math (no `Date` in engine). Start `idx = fnv1a32('scenario:'+iso) % count`; while `idx` collides with any of the previous 13 dates' resolved indices, `idx = (idx+1) % count`. Invariant under test: no scenario repeats within any 14 consecutive dates. Implementations must be linear in days-since-EPOCH (iterate forward or memoize), not naively recursive.

**Steps:**
- [ ] **Scaffold**: `npm create vite@latest . -- --template react-ts`, add Tailwind 4 (`@tailwindcss/postcss` like climatle), Vitest (+jsdom, @testing-library/react), ESLint 9 flat config. TypeScript `strict: true`.
- [ ] **ESLint purity rules** in `eslint.config.js`: for `src/engine/**` forbid imports of `react`, `src/ui/*`, `src/game/*`, `src/i18n/*`, `src/content/*` (`no-restricted-imports`) and forbid `Math.random`/`Date.now`/`new Date` (`no-restricted-properties` / `no-restricted-syntax`). For all `src/**` forbid `Math.random` except `src/game/daily.ts` practiceSeed (inline disable with comment).
- [ ] **RED**: `tests/engine/prng.test.ts` — fixture values: `fnv1a32('') === 0x811c9dc5`, `fnv1a32('phackle:2026-09-01:0')` equals itself run twice (determinism) and differs from `attempt 1`; `splitmix32(1)` first three outputs strictly in [0,1) and match hard-coded golden values you compute once and inline; mulberry32 sequence reproducible; gaussPair mean/var over 10k draws ≈ (0,1) within 0.05. `tests/engine/seeds.test.ts` — `scenarioIndexFor` produces no repeat within any 14-day sliding window over 60 consecutive dates with count=20; `dayTypeFor` hits 25%±3pp over 2000 dates; `effectParamsFor` d ∈ EFFECT_D_RANGE and deterministic. `tests/game/daily.test.ts` — `daysBetween('2026-08-10','2026-08-11')===1` across a DST boundary date pair; `puzzleNumber(EPOCH)===1`. Protocol types compile (`tsc`) — no runtime yet.
- [ ] **Verify fail**: `npx vitest run` → modules not found.
- [ ] **GREEN**: implement per Appendix A + signatures above. `App.tsx` renders `<main>P-hackle</main>` placeholder; `tokens.css` created empty-but-imported.
- [ ] **Verify pass**: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green.
- [ ] **CI**: `.github/workflows/test.yml` — on push/PR: setup-node 22, `npm ci`, lint, tsc, vitest, build.
- [ ] **Commit** `feat: scaffold Vite+React+TS, PRNG/seeding engine core, tuning constants, CI`.

---

