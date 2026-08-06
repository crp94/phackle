# GR1c findings — infra + test-suite health lane

Lane: GR1c. Reviewed at build/v1 7e417f4 (read-only; all mutating experiments ran in a throwaway clone in the agent scratchpad).
Agent's file writes were blocked; findings persisted verbatim by the controller from the lane reply. Backlog draft persisted separately at `backlog-draft.md`.

**Gate + e2e (exit codes captured before pipes), `/usr/bin/node v22.22.1`:** typecheck 0 (8.6s) · lint 0 (9.4s) · **test 0 — 1494/1494, 53 files, 37.7s** · build 0 (3.2s) · **e2e 0 — 15/15, 15.8s** · cal 0 — 5/5 bands, 42s. Also green: 2-core pinned run (84s), dgp solo, clean clone (40s).

**27 findings.** **5 law→enforcer gaps:** (1) six DESIGN Tier-C laws enforced only by human greps; (2) §3.9 calibration never gates a push — and its "too expensive" rationale is disproved (33–42s, cheaper than the unit suite); (3) no axe scan in the repo at all; (4) no bundle budget; (5) `scripts/` outside `tsconfig.include`. Plus two Tier-C commands unrunnable as written.

**Suite health:** 36.0s total · slowest 3 = `dgp.test.ts` **31.4s**, `day.test.ts` 5.1s, `lab.test.tsx` 4.2s · **real inflation = 88 duplicate registrations (1494 reported → 1406 unique, 5.9%), 1,300 ms**.

**Headline measurement:** 87% of suite wall time is `expect()` overhead — 200× `generateDataset` costs **290 ms**, the same 240k checks in plain JS cost **7 ms**, the test costs **10,948 ms**.

---

## §1 The law → enforcer table

`on: push` = `test.yml` (typecheck, lint, `vitest run`, `vite build`) + `e2e.yml` (playwright vs production build). `calibration.yml` is cron + dispatch only.

| Law | Enforcer | On push? |
|---|---|---|
| Tier A — R1.3a/R1.7/R4.2/R4.3/R7.3 (tokens, colour ban, contrast) | `tests/ui/tokens.test.ts` | ✅ |
| Tier A — R5.1–R5.7 (motion register both directions, reduced-motion parity) | `tests/ui/motion.test.ts` | ✅ |
| Tier A — R6.1/R6.6/R6.7 (`outline:none`, focus-on-swap, one `<h1>`, tooltip) | `tests/ui/a11y.test.tsx` | ✅ |
| Build integrity — no `@vite-ignore` under `src/**` | `tokens.test.ts:379` | ✅ |
| **Tier C — R1.3, R2.2/R3.1-usage, R3.4, R4.5, R4.7, R6.5** | **six greps in `DESIGN.md` §10, run by a human** | ❌ **[gr1c-002]** |
| Tier B / B+C | test pins token; reviewer reads consumer | partial (by design) |
| Em-dash budget (per-string + density floor ×3 locales) | `shape.test.ts:693`, `it.shape:670`, `es.shape:516` | ✅ |
| Decimal-point rule | `speccurve:287`, `reveal:205,213`, `it.shape:453`, `es.shape:365,382` | ✅ |
| One-tailed direction contract ×3 | `shape:909`, `it.shape:532`, `es.shape:483` | ✅ |
| Harm lexicon ×3 | `shape:761`, `it.shape:482` + validator | ✅ |
| Spoiler law (share string) | `share.test.ts` property, 300 draws | ✅ (see [gr1c-024]) |
| Press guards ×5, per-locale lexicons | `shape:776`, `it.shape:606`, `es.shape:403` | ✅ |
| Copy freeze + raw-string scan | `copyFreeze.test.ts` (+2 guards-the-guard) | ✅ |
| IT/ES structural parity | `it.shape:252`, `es.shape:231` | ✅ |
| Determinism goldens (5 dates, byte-exact) | `goldens.test.ts` | ✅ (see [gr1c-005]) |
| `p_hit_by_k.json` checksum | `reveal.test.ts:303,357` | ✅ |
| Engine purity (no `Math.random`/`Date.now`/`new Date`/UI imports) | `eslint.config.js:10-93` | ✅ |
| EPOCH guard (`PUZZLE_ISO > EPOCH`) | `epochGuard.test.ts` | ✅ |
| E2E booked checks (a–e) | `e2e/booked.spec.ts` | ✅; (a) 2 of 12 cells — [gr1c-011] |
| **§3.9 calibration bands** | **`calibration.yml`, weekly cron** | ❌ **[gr1c-004]** |
| **axe scan** | **none — one-off human harness (T22)** | ❌ **[gr1c-007]** |
| **Bundle budget** | **none** | ❌ **[gr1c-008]** |
| **`scripts/**` typecheck** | **none — outside `tsconfig.include`** | ❌ **[gr1c-009]** |

Nothing is enforced by a gitignored *report* — but the GR5 merge queue itself is [gr1c-001].

---

### [gr1c-001] The final whole-branch review's 16 findings and its adjudication table exist nowhere on disk
**blocker · M (reconstruct) / S (process)** · `.superpowers/sdd/2026-08-03-phackle-v1/progress.md:228`; `.gitignore:31`

The ledger's closing entry names the artifact and points away from disk: *"16 findings: 3 HIGH-S … + 13 polish. Complete deferred-minors adjudication table (fix/wontfix/GR-lane per item), definitive dead-key roster …, DEPLOY-DAY CHECKLIST 10 steps … **full text in the review output (task a14d2f5902335d3be)**"*.

```
grep -rn "final-0" . (excl node_modules)      -> 0 hits
grep -rln "adjudication" .superpowers/ docs/  -> only the two plan files
ls ~/.claude/projects/*phackle*               -> no such directory
```
`.gitignore:31` ignores `.superpowers/`, so there is no `git show` recovery either. Of 16 findings only `final-001/002/003` survive, as one-clause summaries. The 13 polish findings, the per-item verdicts over ~95 minors (30 ledger lines), the dead-key roster ("4 remove + tagline, 5 keep-with-reasons") and the 10-step deploy checklist are **gone**.

**Fix shape.** (a) Treat the ledger's own `minor (deferred):` lines as the authoritative minors list (reconstructed in the backlog §F) and have GR5 **re-adjudicate** rather than pretend to inherit verdicts. (b) Optionally re-run a verdicts-only whole-branch review on the top tier. (c) Process: any artifact declared an input to a later stage must be written to a file in the same turn it is produced; consider un-ignoring `.superpowers/sdd/**/*.md` while keeping `worktrees/` ignored.

**[CONTROLLER RESOLUTION 2026-08-06: the full final-review text was recovered from the controller session transcript and persisted at `final-whole-branch-review.md` in this directory — see the ledger entry. GR5 should treat that file as the authoritative [final-001..016] + adjudication-table source and use §F below as a cross-check, not the primary.]**

---

### [gr1c-002] Six DESIGN laws are enforced only by a human running greps
**high · S** · `docs/DESIGN.md:710-724`; `.github/workflows/test.yml`

§10 assigns R1.3, R2.2/R3.1-usage, R3.4, R4.5, R4.7, R6.5 to "Tier C — grep" and lists six shell commands. No workflow runs them; no test reproduces them. Tier C is the only band claiming *mechanical* decidability with no mechanism. Run today all six still hold on the merits (output in [gr1c-003]) — a missing guard, not a live violation, but exactly the kind that rots: a `z-index` or stray `border:` added in a GR6 fix wave ships green.

**Fix shape.** These are pure text scans over `src/ui/**`, the same shape `tokens.test.ts`/`motion.test.ts` already implement. Add `describe('DESIGN §10 tier C', …)` with one `it` per command, strip comments (R1.7's scanner already has the helper), encode the two enumerate rules as allow-lists. Then retire the shell block the way T35 retired the old transition greps, and move those rules to Tier A at `DESIGN.md:646`.

---

### [gr1c-003] Two Tier-C commands are unrunnable as written
**high · S** · `docs/DESIGN.md:713-716`, `:723,726-731`

**R6.5 already prints.** §10 says four commands "must print nothing":
```
$ grep -rn '<select' src/ui
src/ui/components/SpecControls.tsx:2:// R6.5): every fork is a segmented radiogroup, never a <select> — a dropdown
```
The hit is the rule's own comment. A permanently-red checklist item trains the reviewer to skip it. (The other three print nothing: `border:\s` ✓, `z-index:\s*[0-9]` ✓, `@media (min-width:` minus 768px ✓.)

**The closed list is incomplete.** `DESIGN.md:729-731` enumerates the only legal raw pixels: 1px hairline (R4.4), 2px selection underline (R4.6), 2px underline offset (R6.2), R5.3's 6px/2px travel, `.ph-visually-hidden`'s 1px box. Today's grep returns 28 hits:
- 21 × `border-block-end: 2px` → R4.6 ✓ · 5 × `text-underline-offset: 2px` → R6.2 ✓ · 2 × `inline-size/block-size: 1px` (`App.css:84,85`) → R6.6 ✓
- **4 × `@media (min-width: 768px)`** (`Published.css:219`, `Lab.css:249`, `Call.css:54`, `Stats.css:81`) → **maps to nothing on the list**
- **1 × a comment** (`App.css:5`, `body { margin: 8px }` in prose) → **maps to nothing**

The 768px hits are R3.4's own mandated breakpoint; the list forgot it. Under a literal reading, §10 currently declares five violations of its own law.

**Fix shape.** Fold into [gr1c-002]: strip comments before scanning, exclude `@media` prelude lines from the raw-px scan **and** name the breakpoint at `DESIGN.md:731`; update §10 prose.

---

### [gr1c-004] The calibration suite never gates a push, and the stated reason is disproved by measurement
**high · M** · `.github/workflows/calibration.yml:3-9`

The header states: *"It simulates 1,000 synthetic days and asserts five §3.9 bands — **expensive enough** … **that it does not belong on every push.**"*

Measured, clean clone, pinned Node 22:
```
npm run cal                  exit=0   42s   (32-core, unpinned)
taskset -c 0,1 npm run cal   exit=0   33s   (2 CPUs ≈ GH runner shape)
```
Same tree for comparison: `npm test` 37.7s, `npm run e2e` 15.8s *plus* its `webServer` build+preview, `npm ci` ~7s. Calibration is **the cheapest of the three suites** and gets *faster* under core pressure (single-threaded; contention hurts parallel vitest more). The "expensive" premise does not hold.

The consequence is asymmetric: `src/game/tuning.ts` and `src/engine/dgpConstants.ts` are exactly what a GR6 balance fix touches, and a band regression lands green and stays green for up to seven days on a cron nobody watches — the same failure mode T24's review caught in this workflow's own `tee` pipe.

The suite is also **idempotent and safe**: clean clone → `npm run cal` → `git status --short` = **empty**. Byte-identical regeneration, independently confirming the determinism claim.

**Fix shape.** Add a `calibration` job to `test.yml` (keep the weekly cron for dependency drift). If 33s is unwanted on every push, gate on `paths:` (`src/engine/**`, `src/game/tuning.ts`, `src/data/**`, `scripts/simulate_calibration.ts`) — that covers every input that can move a band. Either way correct the header comment: a rationale measurement contradicts is the exact defect class T24's fix round existed to catch.

---

### [gr1c-005] final-003 reproduced: the goldens ARE EPOCH-sensitive, and `goldens.test.ts` says the opposite
**high · S** · `src/engine/seeds.ts:104`; `tests/determinism/goldens.test.ts:22-26`; `plans/2026-08-03-phackle-v1.md:308`

`seeds.ts:104` gates the 14-day scenario-exclusion window on EPOCH:
```ts
if (iso > EPOCH) {
  const excluded = new Set<number>();
  for (let back = 1; back <= 13; back++) excluded.add(scenarioIndexFor(isoMinusDays(iso, back), count));
  while (excluded.has(idx)) idx = (idx + 1) % count;
}
```
`goldens.test.ts:22-26` claims immunity: *"Deliberately excludes puzzleNumber: … **changing EPOCH at deploy must not break this suite.**"* The plan repeats it at `:308`. Both false: `puzzleNumber` is not the only EPOCH-derived input — `scenarioIndexFor` selects the entire day.

Computed independently (EPOCH = `2026-08-10`, `tuning.ts:6`), current index vs the base case each date takes if EPOCH moves to/past it:

| golden date | index today | index if `EPOCH >= iso` | breaks? |
|---|---|---|---|
| 2026-09-01 | 7 | 5 | **yes** |
| 2026-10-31 | 10 | 8 | **yes** |
| 2026-12-25 | 5 | 19 | **yes** |
| 2027-01-01 | 12 | 2 | **yes** |
| 2027-07-04 | 7 | 7 | no (coincidence) |

A launch date at/after 2026-09-01 silently invalidates four of five fixtures. `epochGuard.test.ts` does not catch it — it only asserts `PUZZLE_ISO > EPOCH` for the e2e clock.

**Fix shape.** (1) Correct the false comments at `goldens.test.ts:22-26` and plan `:308`. (2) Extend `epochGuard.test.ts`: every golden fixture date must be `> EPOCH`, failure message naming `scripts/gen_goldens.ts` — turning the deploy-day trap into a red test the moment EPOCH is edited. (3) Make "regenerate and commit the goldens" an explicit step in whatever replaces the lost deploy checklist.

---

### [gr1c-006] The Node requirement is recorded only in `.nvmrc`, and the wrong Node fails 270 tests
**high · S** · `package.json` (no `engines`), `README.md`, `.nvmrc`

This lane's first gate run used the machine's default `PATH` node:
```
$ which node && node --version
/home/linuxbrew/.linuxbrew/bin/node   v25.4.0
$ npm test
 Test Files  12 failed | 41 passed (53)
      Tests  270 failed | 1224 passed (1494)
TypeError: window.localStorage.clear is not a function
 ❯ tests/ui/summary.test.tsx:32:23
```
With `PATH="/usr/bin:$PATH"` (v22.22.1): **1494/1494, exit 0.** The hazard is recorded at ledger line 33 — i.e. in a gitignored file, as an instruction to agents, not as a repo constraint. `package.json` has **no `engines` field**; no `.npmrc`, so no `engine-strict`; README never mentions Node; `.nvmrc` says `22` but only `actions/setup-node` reads it.

Related signal from the clean `npm ci`: `jsdom@30.0.1` requires `^22.22.2 || ^24.15.0 || >=26.0.0` and emits `EBADENGINE` against v22.22.1. CI is fine (`.nvmrc`'s `22` resolves to latest 22.x); local pins below 22.22.2 are not.

**Fix shape.** `"engines": { "node": ">=22.22.2 <23" }` + a committed `.npmrc` with `engine-strict=true`, so the wrong runtime fails at install with a legible message instead of at test time with 270 red assertions. Pair with [gr1c-027].

---

### [gr1c-007] The axe scan that closed two serious a11y rules is not in the repo
**polish · S** · `tests/ui/a11y.test.tsx:10`; `package.json`

`a11y.test.tsx:10`: *"What this file deliberately does NOT try to be: an axe run."* T22's evidence was an axe scan across 17 cells that found and fixed two **serious** rules (Stats rows announcing nothing; `aria-prohibited-attr`). `axe-core`/`@axe-core/playwright` appear nowhere in `package.json` and no e2e spec runs a scan. The regression T22 fixed would not be caught again.

**Fix shape.** `npm i -D @axe-core/playwright` + one `e2e/a11y.spec.ts` scanning the five screens, both themes, asserting zero serious/critical. The e2e suite already drives a real browser against the production build, so marginal cost is seconds — and it is the one place a real-browser scan buys what jsdom structurally cannot.

---

### [gr1c-008] No bundle-size budget check
**polish · S** · `.github/workflows/test.yml`

`npm run build` succeeds and nothing reads its output. Measured gzip from today's `dist/`:
```
82,248  index-DPwlAP54.js      18,732  es-C2jvNUEs.js
18,530  it-D0RyspsC.js         17,025  en-DabwAVHX.js
 7,021  worker-rFfyuGFE.js      6,381  index-DtPsbJUr.css
```
Initial English load ≈ **112 KB gz**; locale chunks correctly split. Comfortably inside GR1b's 200 KB budget — the finding is the missing enforcer, not the number.

**Fix shape.** `scripts/check-bundle.ts` as a `test.yml` step after `build`: gzip each asset, sum the initial-load set, fail over a constant, print the table either way.

---

### [gr1c-009] `scripts/` is typechecked by nothing; one script is linted by nothing
**polish · S** · `tsconfig.json:24`; `eslint.config.js:34`

`include` is `["src","tests","e2e","vite.config.ts","playwright.config.ts"]` — `scripts/` absent, so `npm run typecheck` never sees `gen_goldens.ts` or `simulate_calibration.ts`, both of which produce **committed artifacts** (`tests/determinism/fixtures/*.json`, `src/data/p_hit_by_k.json`). ESLint's `files: ['**/*.{ts,tsx}']` covers the two `.ts` scripts but not `scripts/generate-pwa-images.mjs`, which renders the shipped PWA/OG images. Flagged as a deferred minor in both T9 and T24; still open.

**Fix shape.** Add `"scripts"` to `tsconfig.include`; add `'**/*.mjs'` to the eslint `files` glob with node globals.

---

### [gr1c-010] Workflow hygiene
**polish · S** · `.github/workflows/*.yml`; `.github/`

No `concurrency:` block on any workflow, so a push train runs N full `e2e` jobs (each a build + preview + 15 specs) that immediately obsolete each other. Actions pinned to floating `@v4`. `.github/` contains only `workflows/` — no `dependabot.yml`, no CODEOWNERS, no PR template, no `npm audit` step (clean `npm ci` reported `found 0 vulnerabilities` today; nothing keeps it that way). `permissions: contents: read` correctly set on all three — good.

**Fix shape.** `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }`; add `.github/dependabot.yml` (npm, weekly). SHA-pinning optional for a solo-owner repo with no secrets — record the decision rather than leaving it unstated.

---

### [gr1c-011] The 360px header-overflow law is enforced for 2 of the 12 cells its evidence covered
**polish · S** · `e2e/booked.spec.ts:29-33`

```ts
test.describe('(a) T33 — the header must not push the page sideways at 360px', () => {
  for (const locale of ['it', 'es'] as const) {
    test(`${locale}: About page at 360x780 does not scroll horizontally`, …
```
T33's fix round proved the property over a 12-cell matrix (3 locales × 2 widths × game/nav) plus a 768/1088 sweep, and its own honest correction records that **`it/360/game`** overflowed 7px from pre-existing Italian label lengths — the game screen, not About, is where the bug lived. `appNav.test.tsx:271` pins the CSS rule text in jsdom, catching deletion but not a new long label.

**Fix shape.** Parametrize over `locale × {360,390} × {game, about}` — the harness already boots to each. 6–12 cells at ~1s each is affordable in a 15.8s suite.

---

### [gr1c-012] `npm run cal` mutates a tracked source file and has no `--check` mode
**polish · S** · `scripts/simulate_calibration.ts:589-590`

```ts
const checksum = pHitTableChecksum();
writeFileSync(tablePath, `${JSON.stringify({ checksum, pHit }, null, 2)}\n`);
```
Verified harmless today (clean clone → cal → `git status --short` empty, which is also a genuine determinism confirmation). But the command reads as a verification and behaves as a generator: an owner who runs it to check a band and then `git add -A` silently ships a regenerated table.

**Fix shape.** Split the write behind a flag (`npm run cal` verifies; `-- --write` regenerates), or have CI assert `git diff --exit-code src/data/p_hit_by_k.json` after the cal step — which additionally turns "table is stale" into a red CI run rather than a checksum throw at app boot.

---

## §2 Test-suite health

### [gr1c-013] 87% of the unit suite's wall time is `expect()` call overhead in four tests
**high · S** · `tests/engine/dgp.test.ts:185-226`

Per-file wall time from `vitest run --reporter=json` (1494/1494, 53 files, **36.0s**):
```
31,387ms   24 tests   tests/engine/dgp.test.ts     <-- 87% of the run
 5,129ms   30 tests   tests/engine/day.test.ts
 4,219ms   78 tests   tests/ui/lab.test.tsx
 2,707ms   46 tests   tests/ui/reveal.test.tsx
 2,536ms   34 tests   tests/ui/a11y.test.tsx
```
Four tests are 27.1s of the 31.4s:
```
10,922ms  structural ranges (200 seeds) — experience is always 0, 1, or 2; urban and x …
 8,503ms  structural ranges (200 seeds) — age is always within [22, 70]
 4,006ms  structural ranges (200 seeds) — Y4 (satisfaction) is always within [1, 10]
 3,614ms  structural ranges (200 seeds) — Y3 (count) is always a non-negative integer
```
Each is `for (seed of 200) { generateDataset(); for (i of 400 rows) { expect(); expect(); [expect();] } }` — ~800,000 `expect()` calls. The work they wrap, measured against the real engine:
```
200x generateDataset (no asserts):            290 ms
same 240k checks as plain JS (no expect):       7 ms, violations = 0
```
So the engine + comparisons cost **~0.3s**; the assertion machinery costs **~27s**. The four also each re-run the identical sweep — duplication the neighbouring `aggregate moments` describe already knows to avoid (`dgp.test.ts:228-234`: *"Computed once, shared by the assertions below … to avoid 5x the runtime"*). Coverage is unchanged by a plain-JS scan with one assertion at the end.

**Fix shape.**
```ts
const DATASETS = SEEDS_200.map((s) => generateDataset(s, null));   // one sweep, shared
it('age is always within [22, 70]', () => {
  const bad = DATASETS.flatMap((d, s) =>
    Array.from({ length: d.n }, (_, i) => i)
      .filter((i) => d.age[i] < 22 || d.age[i] > 70)
      .map((i) => `seed ${s} row ${i}: ${d.age[i]}`));
  expect(bad).toEqual([]);      // one expect; failure names the exact row
});
```
Failure messages get *better* (the offending seed/row is named instead of "expected 21 to be >= 22" with no locator). Expected: `dgp.test.ts` 31.4s → ~1s, whole suite **36s → ~11s**, and the 20s timeout in [gr1c-014] can be deleted rather than tuned.

---

### [gr1c-014] The dgp timeout's stated rationale does not reproduce — real margin is 1.8x, not 4x
**high · S (comment); subsumed by [gr1c-013]** · `tests/engine/dgp.test.ts:174-185`

The comment justifying `{ timeout: 20_000 }` claims: *"**Measured 1.7-2.0s per test solo** … a generous 20s ceiling (**~4x the worst solo time, ~4x the worst observed contended time**)"*.

Measured on the pinned Node 22:

| configuration | worst test in the describe | margin vs 20s |
|---|---|---|
| file solo (`vitest run tests/engine/dgp.test.ts`) | **10,948 ms** | 1.83x |
| full parallel run, 32 cores | **10,922 ms** | 1.83x |
| full parallel run, `taskset -c 0,1` | 6,706 ms | 2.98x |

"1.7-2.0s solo" is off by **5.5x**; "~4x margin" is off by ~2.2x in the direction that matters. Two secondary facts: contention is **not** the driver (solo and full-parallel within 0.3%), and 2-core pinning makes tests *faster* per-test — so a slower CPU, not the CI runner's core count, is where this would first bite.

Verdict on "is the flake fixed": with the current timeout, **yes** — 1494/1494 in all four configurations, ledger flake never reproduced. But it was fixed by widening a ceiling on a rationale that does not survive re-measurement, over a cost that is 99.99% assertion overhead.

**Fix shape.** Take [gr1c-013], then delete the timeout option and the comment. If not taken, the comment must at minimum be corrected to the measured numbers — the evidence-integrity standard applied to T21/T22/T24/T32 applies to the project's own test comments.

---

### [gr1c-015] Nothing else is near its limit *(informational)*
Slowest individual tests after `dgp.test.ts` (default `testTimeout` 5000ms):
```
1,526ms  engine/day.test.ts   generateDay — acceptance guarantee over 30 consecutive days  (30.5%)
  910ms  game/storage.test.ts  loadState / saveDay — round trip …
  879ms  game/share.test.ts    spoiler-safety property test … 300 seeded-random …
  833ms  ui/router.test.tsx    renders the real Briefing once booted …
  823ms  ui/shell.test.tsx     theme toggle defaults to paper/light …
```
Only one test outside `dgp.test.ts` exceeds 1s, at under a third of budget; on 2 pinned cores it drops to 803ms. No other file carries a timeout override. No second flake candidate. Note `share.test.ts`'s 879ms is 300 iterations of the property [gr1c-024] shows to be partly tautological — fixing that removes most of this cost.

---

### [gr1c-016] [final-014] Validator re-registration: 88 duplicate tests, 1.3s, measured
**polish · S** · `it.shape.test.ts:24-33`, `es.shape.test.ts:25-33`, `shape.test.ts`

Both locale files import their validators **from a test file** (`} from './shape.test';`). Importing a vitest module executes its top level, re-registering all 44 of `shape.test.ts`'s tests inside each locale file. Measured by intersecting full test names per file in the JSON report:

| file | reported | duplicated from `shape.test.ts` | own |
|---|---|---|---|
| `content/shape.test.ts` | 44 | — | 44 |
| `content/it.shape.test.ts` | 124 | **44** | 80 |
| `content/es.shape.test.ts` | 105 | **44** | 61 |

**Today's real cost: 88 duplicate registrations, 1,300 ms** (678 ms it + 622 ms es). Headline count 1494 reported / **1406 unique — 5.9% inflation**. Nothing is *wrong* (the EN suite runs three times); the cost is a misleading count and 1.3s.

**Fix shape.** Move `validateLocaleContent`, `emDashDensity`, `localeProse`, `scenarioProse`, `findHarmTerms`, `findPressSpoilerTerms`, `findScenariosWithoutPress`, `EN_LEXICONS`, `MIN_CHARS_PER_EM_DASH` and the `ContentLexicons` type into `tests/content/validators.ts` (no `describe`/`it`); all three shape files import from there. Mechanical, one commit, no assertion changes. This is the plan's A4-routed "validator-extraction from shape.test" item.

---

### [gr1c-017] Flakiness surface: green in every configuration tried *(informational)*
```
full suite, 32 cores                   exit 0   1494/1494   36.0s
full suite, taskset -c 0,1             exit 0   1494/1494   84s
dgp.test.ts solo                       exit 0     24/24
clean git clone + npm ci + npm test    exit 0   1494/1494   40s
playwright e2e (prod build)            exit 0     15/15     15.8s
npm run cal (clean clone)              exit 0    5/5 bands  42s
```
`retries: 0` with an explicit and correct rationale; every e2e wait is on an event or locator state. The only remaining risk is [gr1c-013]/[gr1c-014].

---

### [gr1c-018] Fabrication-precedent spot-checks: three ledger claims re-verified, all genuine *(informational)*

**Claim 1 — T39a fix round 1 (ledger:214):** *"0.0% collisions over 180k simulated days, all 45 reachable"*. Re-executed against the real `pickPress` + real EN bank, 3 tiers × 20 scenarios × 3000 consecutive dates:
```
simulated slot-days: 180000 collisions: 0 = 0.000%
distinct press texts reached: 45 of 45 in bank
```
**Reproduces exactly, including the sample size.**

**Claim 2 — T35/T38 (ledger:201,205):** *"9 motion sites"*. `DESIGN.md` R5.2's register table has exactly **9 numbered rows**. **Confirmed.**

**Claim 3 — T39a (ledger:210):** *"density IMPROVED (1/11,273)"*. Recomputed with the suite's own `localeProse` collector: EN **1 per 11,342** (34,027 chars / 3 dashes), IT 1 per 13,093, ES 1 per 39,314. The 0.6% drift is T39b's later additions, in the direction the ledger records. **Consistent; not fabricated.**

No finding. Recorded so the precedent has a re-check on file.

---

## §3 Test-quality items routed here

### [gr1c-019] T12 — brittle exact-string throw assertions (3 sites today, not 2)
**polish · S** · `tests/game/store.test.ts:491,518,558`; `src/game/store.ts:273,276,277`

Line numbers moved since T12; there are now **three** message-coupled assertions:
```
491:  await expect(store.getState().peekAndExtend()).rejects.toThrow('not booted');
518:  await expect(store.getState().peekAndExtend()).rejects.toThrow('no result visible to extend');
558:  await expect(store.getState().peekAndExtend()).rejects.toThrow('max N');
```
each pinning a literal from one of `store.ts`'s 14 `throw new Error('…')` sites. Rewording a message for clarity breaks a test that is not about wording. `'max N'` is additionally the substring T11's ledger flagged as shared with an unreachable `idx === -1` branch, so it does not even identify its throw uniquely.

**Fix shape.** `export const STORE_ERR = { notBooted: '…', noResult: '…', maxN: '…' } as const` in `store.ts`; throw and assert against the constants. The test then pins the *identity* of the failure, not its prose. ~30 min.

---

### [gr1c-020] T12 — no `forks === countForks(log)` invariant test
**polish · S** · `src/game/store.ts:248,288,308,320,333,421,440`

`store.ts` recomputes `forks: countForks(log)` at **seven** independent `set()` returns. The invariant is asserted by inspection at seven sites and mechanically nowhere: tests only check literals (`store.test.ts:112,226,234,335,537,753`). An eighth transition added in a GR6 fix that forgets the recompute passes everything. `share.test.ts:157` proves the *trail* matches `countForks` — but against a hand-built log, not the store.

**Fix shape.** One test driving a scripted session through every mutating action (`boot → openData → changeSpec ×2 → peekAndExtend → submit → makeCall`, plus abandon and prereg branches), asserting `expect(s.forks).toBe(countForks(s.log))` after each. ~40 lines, and it is what makes the seven-site duplication safe.

---

### [gr1c-021] T12 — `useGameStore` singleton wrapper has no direct test
**polish · S** · `src/game/store.ts:484`

Exercised indirectly by five UI files (`appNav`, `a11y`, `summary`, `call`, `published`); `summary.test.tsx:505` comments on the binding but nothing asserts it. Genuinely low risk — the UI tests would all break if it did not hold.

**Fix shape.** Three lines: mutate the module singleton, render a trivial selector component, assert it sees the mutation. **Or wontfix with reasoning** — the indirect coverage is real; this is the weakest item in the routed set. Recommend GR5 rules wontfix unless it batches free with [gr1c-019]/[gr1c-020].

---

### [gr1c-022] T14 — the StrictMode guard test never enters StrictMode
**polish · S** · `tests/ui/router.test.tsx:215-237`; `src/ui/App.tsx:79,122-124`; `src/main.tsx:29`

The guard is `didBootRef` (`App.tsx:79`, checked at `:123`). The test named for it re-renders the same mounted tree with a different prop (`puzzleNumber={1}` → `{2}`). A re-render is not what StrictMode does: React's dev double-invoke **mounts, runs the effect, tears it down, and runs it again** on the same instance — a different path through the same guard, and the one that ships (`main.tsx:29` wraps the real app in `<StrictMode>`). The current test passes against an implementation with no guard in the effect at all, given a stable dependency array.

**Fix shape.**
```ts
render(<StrictMode><LocaleProvider><App puzzleNumber={1}><ScreenRouter/></App></LocaleProvider></StrictMode>);
await waitFor(() => expect(client.init).toHaveBeenCalledTimes(1));
```
Keep the rerender case too — different properties. Mutation-verify by deleting `didBootRef`: the StrictMode variant must go red while the rerender variant stays green. That contrast *is* the finding.

---

### [gr1c-023] T17 — no `length === window` boundary case for the rolling window
**polish · S** · `src/game/statsAgg.ts:43-50`; `tests/game/statsAgg.test.ts:16-76`

`rollingCallAccuracy` is `calls.slice(-window)`. Six tests cover 0, 3 (fewer than window), 25 and 30 (more than window), same-day both modes, and no-call days. **No test has exactly 20.** `slice(-20)` on a length-20 array is correct, but the off-by-one family this boundary belongs to (`slice(len - window)` with a negative index; a `length > window` guard that skips the slice) is exactly what a boundary case pins — and the ledger records master §2.9's own 6-vs-7 off-by-one, so the class is live here.

**Fix shape.** One test: 20 days, first 10 correct / last 10 wrong, assert `0.5`; then 21 days with the first wrong, assert the 21st is excluded. Six lines.

---

### [gr1c-024] T18/T39 — the prereg spoiler "guards-the-guard" test compares `f(x)` to `f(x)`
**high · M** · `tests/game/share.test.ts:424-457`

**Confirmed vacuous.** Lines 444-446:
```ts
const asIfSignificant    = shareString({ puzzleNumber, log, mode: 'prereg', callCorrect: null, streak, copy });
const asIfNonSignificant = shareString({ puzzleNumber, log, mode: 'prereg', callCorrect: null, streak, copy });
expect(asIfSignificant).toBe(asIfNonSignificant);
```
The two calls take **byte-identical arguments**. The assertion is `f(x) === f(x)` — it holds for every deterministic `shareString`, including one leaking day type through some *other* channel. The name promises "byte-identical whether the imagined day was significant or not"; significance never enters the inputs. This runs **300 times per suite run** and is most of `share.test.ts`'s 879ms.

The second half (453-455: `callCorrect: true` vs `false` must differ) *is* non-vacuous — but proves a different proposition, and needs no 300 draws. The comment at 414-423 is honest about why: the guarantee *"holds STRUCTURALLY — `buildTrail`'s signature carries no significance channel."* That reasoning is right, and is exactly why the test as written cannot be anything but a tautology.

**Fix shape**, in order of preference:
1. **Drive the real path.** Build both logs through `store.preregCommit()` on a genuinely significant and a genuinely non-significant day (the store already exposes both via a fake client), then compare the `shareString`s. Significance is then really the only varied input. Keep 300 draws — this is where fuzzing pays.
2. **Make the structural claim structural.** A type-level/reflective assertion that `ShareInput` has no significance-bearing field, plus the existing sensitivity check run once.

Either way, drop the 300-iteration loop from whatever half remains tautological and rename the test to what it proves.

---

### [gr1c-025] T29 — touch-test-3 does not discriminate the property it is named for
**polish · S** · `tests/ui/lab.test.tsx:1153-1165`; `src/ui/components/ForkTrail.tsx:124,164`

Named *"still opens on a mouse hover after a touch interaction (a hybrid laptop **re-arms per enter**)"*. Body: `pointerEnter(touch)` → `mouseEnter` → `mouseLeave` → assert closed → `pointerEnter(mouse)` → `mouseEnter` → assert open. `lastPointerType` (`ForkTrail.tsx:124`) is a ref overwritten on **every** `onPointerEnter` (`:164`), so the second half passes for any implementation reading the most recent pointer type — including one with no re-arming concept. The "re-arms" property (a stale touch flag not persisting) is never isolated. The T29 re-review classified it identically ("touch-test-3 non-discriminating [coverage overclaim, functional fix correct]").

**Fix shape.** Either mutation-verify and rename to what survives (a perfectly good "a mouse hover after a touch still opens" regression test), or add the discriminating case: `pointerEnter(touch)` → `mouseEnter` → *no* `mouseLeave` → `pointerEnter(mouse)` → `mouseEnter`, which separates per-enter re-arming from last-write-wins. Ten minutes; the honest rename is acceptable.

---

### [gr1c-026] T7 — the CI property test branches on `df > 0` instead of `result.valid`
**polish · S** · `tests/engine/analyze.test.ts:427-439`

```ts
const p = 2 + (spec.covariates.income ? 1 : 0) + (spec.covariates.risk ? 1 : 0);
const df = result.n - p;
if (df > 0) {
  const p2 = tTwoTailedP(result.t, df);
  const excludesZero = result.ci[0] > 0 || result.ci[1] < 0;
  expect(excludesZero).toBe(p2 < 0.05);
} else {
  expect(result.ci).toEqual([0, 0]);
  expect(result.valid).toBe(false);
}
```
The branch key is a **re-derivation** of validity, not `runSpec`'s own answer. `runSpec` invalidates on more than `df <= 0` — `MIN_CELL = 30` is the other gate (pinned at `analyze.test.ts:342-346`: `at30.valid === true`, `at29.valid === false`). A sampled spec with `df > 0` but a cell under 30 enters the **true** branch and asserts a CI relation against `runSpec`'s documented `[0,0]` placeholder: `excludesZero` is `false`, so the assertion silently demands `p2 >= 0.05` from a meaningless t. It passes by coincidence — the T7 review said so at the time. Nothing proves the `else` branch is ever reached across the 50 sampled specs, so the test may be a 50-iteration single-branch test.

**Fix shape.** (1) Branch on `result.valid`. (2) Add one assertion reconciling the two definitions — `expect(result.valid).toBe(df > 0 && minCellOk)` — so the relationship is pinned once rather than assumed everywhere. (3) Count branch hits and assert both non-zero, so it can never quietly become single-branch; if 50 samples do not reach the invalid branch, extend `specAt`'s window set until they do.

---

## §4 Reproducibility — clean-clone simulation

Performed for real, not by inspection: `git clone --branch build/v1` into a scratch dir (source repo untouched; `.superpowers/` and `.claude/` absent exactly as a contributor sees), then the documented-by-nobody sequence:
```
git clone --branch build/v1 …            exit 0    HEAD = 7e417f4
npm ci                                   exit 0    7s   530 packages, 0 vulnerabilities
                                                   WARN EBADENGINE jsdom@30.0.1 wants ^22.22.2, have 22.22.1
npm test                                 exit 0   40s   1494/1494
npm run cal                              exit 0   42s   CALIBRATION PASSED — all 5 bands
git status --short (after cal)           (empty)        p_hit_by_k.json regenerated byte-identical
```
Everything works. The problem is that nothing tells you it exists.

### [gr1c-027] README documents no commands, no runtime, and no e2e prerequisite
**high · S** · `README.md` (26 lines); `package.json:7-18`

README contains the pitch, a sibling link, the spec link, prior art and the licence. It never mentions `npm`, Node, `npm test`, `npm run e2e`, `npm run cal`, or `npm run dev`. No `CONTRIBUTING.md`. A fresh contributor must open `package.json` to learn the eight scripts exist, and must read `.github/workflows/e2e.yml` to learn `npm run e2e` needs `npx playwright install --with-deps chromium` first — `playwright.config.ts`'s `webServer` builds and previews but does not install a browser, and browsers live in `~/.cache/ms-playwright`, not `node_modules`. On this machine e2e passed only because that cache was warm from T23/T24.

Combined with [gr1c-006]: the project reproduces perfectly for someone who already knows how, and fails confusingly for anyone else — 270 red tests on the wrong Node, or a browser-download error on first e2e.

**Fix shape.** ~15 lines under `## Development`: Node version (+`nvm use`), `npm ci`, `npm test`, `npm run e2e` **with the `npx playwright install chromium` prerequisite**, `npm run cal` (noting it rewrites `src/data/p_hit_by_k.json`), `npm run dev`, and one line naming the three CI workflows and what each gates. Pair with the `engines` field from [gr1c-006].

---

## Notes

- Read-only was preserved: no file in the repo was modified by the lane. All mutating experiments (`npm ci`, `npm run cal`) ran in a throwaway `git clone` in the agent scratchpad. No `git worktree add` was used.
- Raw artifacts (JSON reporter output for the 32-core and 2-core runs, dgp-solo run, all logs, the clean clone) are under the agent scratchpad `gr1c/` if GR5 wants to re-derive any number.
- **[gr1c-001] controller action before GR5**: resolved — see the bracketed controller resolution under gr1c-001 above.
