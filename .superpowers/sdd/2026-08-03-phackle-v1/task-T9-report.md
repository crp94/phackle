# Task T9 Report — day assembly (rejection sampling + determinism goldens)

Status: **DONE**

Branch `worktree-agent-ad17fb64d5dcf791b` (worktree name). Working tree
clean at the time of writing except for the files this task owns; full gate
green on the committed state (re-verified after the commit, output pasted
below).

## Step 0 — worktree setup

```
$ pwd
/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-ad17fb64d5dcf791b
$ git log --oneline -5   # before reset
60c4787 Plan pre-flight fixes: engine-side seeds, protocol types in T1, tuning import exception, wave 1a/1b split
f54da1b Add v1 implementation plan: 27 tasks in 5 dependency waves for parallel agents
a0a5de0 Spec: analytics = Vercel Web Analytics (free Hobby tier) instead of none
3a61361 Add v1 design delta spec: trilingual launch, Vercel, epoch=deploy, no analytics
418c133 Seed repo: implementation plan, CLAUDE.md, README, MIT license

$ git reset --hard bc12871
HEAD está ahora en bc12871 Merge T8: exhaustive 1792-spec curve enumeration (review approved)

$ ls src/engine/specGrid.ts
src/engine/specGrid.ts   # dependency present and merged
```

```
$ npm ci
npm WARN EBADENGINE ... jsdom wants node>=22.22.2 (pre-existing, harmless)
added 250 packages, and audited 251 packages in 1s
found 0 vulnerabilities
```

One process note: I made a path typo on my very first `Write` call
(`agent-ad17fb664d5dcf791b`, one extra "6" — exactly the trap STEP 0 warns
about) before writing any real content. Caught it immediately via `pwd` +
`ls -d` on both paths, confirmed the stray directory was empty of anything
except that one throwaway file, `rm -rf`'d it, and re-verified the correct
worktree path before any further writes. No work was lost; flagging only
because the brief calls this out as a known infrastructure quirk.

## Requirements read

Task brief (`task-T9-brief.md`), the controller amendments/pins in the
prompt (acceptance precheck, best-attempt scoring formulas, golden fixture
shape and hashing rules, `generatePractice` seed formula), master spec §3.3
(hackability guarantee / rejection sampling) and §3.1 (determinism) via
`docs/implementation_plan.md`. Consumed (read, not modified):
`src/engine/seeds.ts` (`daySeed`, `dayTypeFor`, `effectParamsFor`,
`scenarioIndexFor`), `src/engine/dgp.ts` (`Dataset`, `EffectSpec`,
`generateDataset`), `src/engine/specGrid.ts` (`enumerateCurve`, `sigCount`,
`allSpecs`, `specKey`, `CurvePoint`), `src/engine/analyze.ts` (`runSpec`),
`src/engine/types.ts` (`DailyPuzzle`, `Spec`, `Outcome`, `WindowN`),
`src/engine/protocol.ts` (`Req`, `InitInfo`, `EngineClient` — needed this to
resolve an ambiguity, see Concerns), `src/game/tuning.ts` (`NULL_SIG_BAND`,
`MAX_ATTEMPTS`, `EFFECT_D_RANGE`, `HETERO_MULTIPLIER`, `HETERO_PROB_PCT`,
`EPOCH`, `P_EFFECT_PCT`), `src/game/daily.ts` (`puzzleNumber`, `daysBetween`
— for the cross-check test, not for production import). Also read
`docs/superpowers/plans/2026-08-03-phackle-v1.md` directly (the T9 and T12
brief sections specifically) and the T8 report for house style.

## Design decisions worth flagging

1. **`puzzleNumber` — engine-side, non-authoritative, pure-calendar-math
   duplicate.** `DailyPuzzle.puzzleNumber` is a *required* field, but
   `src/engine/day.ts` cannot import `src/game/daily.ts` (engine purity:
   `tuning.ts` is the only allowed `game/*` import) or use `new Date`
   (banned in `src/engine/**`). The plan doc's T12 brief states outright:
   "Store computes puzzleNumber via `src/game/daily.ts`" — so the engine's
   copy is never the authority the UI reads from. I implemented a from-
   scratch, pure-integer-math reimplementation of the exact same formula
   (`daysBetween(EPOCH, iso) + 1`, via a duplicated `daysFromCivil` — the
   same Howard Hinnant algorithm `seeds.ts` already uses internally for its
   own calendar arithmetic, just the one function I needed, not the reverse
   direction), and added a test that cross-checks it byte-for-byte against
   `src/game/daily.ts`'s real `puzzleNumber()` for 5 sample dates
   (`day.test.ts`, "puzzleNumber matches the game-side ... formula"). This
   mirrors `dgp.ts`'s own precedent of deliberately duplicating `meanAndSd`
   rather than cross-importing between independently-built sibling modules.
   For `generatePractice`, `puzzleNumber` is simply `0` (there's no
   calendar date to compute one from). **Flagging for the controller**:
   if T12's store always overwrites this field anyway, my engine-side value
   never surfaces to a player — but I judged "real, correct, cross-checked"
   safer than an arbitrary sentinel for a field a future reader might
   reasonably trust. Either way, it's excluded from the golden fixtures as
   pinned.
2. **`generatePractice`'s signature: added a `scenarioCount` parameter.**
   Both the brief and the master plan doc pin
   `generatePractice(seed: number): GeneratedDay`, but the controller's own
   amendment text for it reads "scenario index = seed % **scenarioCount**"
   — a variable that doesn't exist under that literal signature. I resolved
   this by adding `scenarioCount: number` as a second parameter (mirroring
   `generateDay`'s shape), based on corroborating evidence already merged
   in T1: `src/engine/protocol.ts`'s `Req` union has
   `{ id; op: 'init'; iso: string; scenarioCount: number; practiceSeed?: number }`
   and `EngineClient.init(iso, scenarioCount, practiceSeed?)` — i.e. the
   future worker (T11) always has a `scenarioCount` in hand alongside an
   optional `practiceSeed`, so it can call
   `generatePractice(practiceSeed, scenarioCount)` directly. **Flagging for
   the controller** in case another already-planned task's brief assumes
   the single-argument form literally.
3. **Effect-day acceptance: `p@400` is always computed, even when the
   precheck (`p@200 < .3`) fails.** The brief frames the precheck as a
   "cheap pre-check ... before full enumeration" (i.e., skip the expensive
   step on failure). But `p@200 < .3` failing makes `p@200 < .15` (the real
   gate's first condition) impossible by simple transitivity — so skipping
   `p@400`'s computation on precheck failure would never change any
   *acceptance* decision, only whether a p@400 value exists for the
   best-attempt fallback's "smallest p@400 overall" branch. Since a single
   canonical-spec regression is cheap regardless (unlike the null-day path,
   where the 1792-spec full enumeration is the actual expensive step the
   brief's perf framing is about), I always compute both p@200 and p@400
   for every effect-day attempt. This keeps `pickBestEffectAttempt`'s
   "smallest p@400 overall" fallback well-defined in every case, at
   effectively zero cost. `precheckHit` is still tracked as its own named
   boolean (not simplified away) purely for spec-traceability — a future
   reader mapping code back to §3.3's language can find "the precheck" as
   an actual, distinctly-named condition, not an inlined implication.
4. **Golden fixtures: one JSON file per date**, named by ISO date
   (`tests/determinism/fixtures/2026-09-01.json`, etc.), matching the
   brief's `fixtures/*.json` glob and giving each date's fixture an
   independent, small git diff if it ever needs regenerating.
5. **`hashCurve` exported from `day.ts`** (beyond the brief's explicitly-
   named `hashRows`) so `scripts/gen_goldens.ts` and
   `tests/determinism/goldens.test.ts` share one implementation of the
   curve-hashing rule — no risk of the two independently-written copies
   drifting apart. Same for `canonicalSpecFor`/`canonicalTransform`
   (small, pure, and directly useful to tests that need to reconstruct
   exactly the spec the acceptance loop judges effect days by) and
   `bandDistance`/`pickBestEffectAttempt` (see TDD evidence — exported
   specifically so the best-attempt tie-break logic is unit-testable in
   isolation).

## TDD evidence

**RED** (`tests/engine/day.test.ts` written against the not-yet-existing
module):
```
$ npx vitest run tests/engine/day.test.ts
 RUN  v4.1.10 ...
 ❯ tests/engine/day.test.ts (0 test)
 FAIL  tests/engine/day.test.ts [ tests/engine/day.test.ts ]
Error: Cannot find module '/src/engine/day' imported from .../tests/engine/day.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** after implementing `src/engine/day.ts` (one small test-side fix
needed along the way, see below):
```
$ npx vitest run tests/engine/day.test.ts
 Test Files  1 passed (1)
      Tests  27 passed (27)
   Duration  785ms
```

One RED-phase-adjacent bug, in my own test, not in `day.ts`: an early draft
of the "practice uses a distinct hash namespace" test called
`generateDay(String(seed), scenarioCount)` with `seed=20260901`, i.e. a
non-`YYYY-MM-DD` string. `scenarioIndexFor`'s calendar arithmetic
(`isoMinusDays`/`daysFromCivil`) isn't guarded against malformed input (a
reasonable precondition — every other caller in the codebase always passes
a real ISO date), so it recursed until stack overflow
(`RangeError: Maximum call stack size exceeded` in `seeds.ts:72`). Fixed by
testing the actual property directly at the hash level instead
(`fnv1a32('practice:'+seed+':0') !== daySeed(String(seed), 0)`), which is
both safer and a more precise test of "distinct hash namespace" than
routing through the full `generateDay` pipeline was.

After adding the golden-master suite and one extra fallback test (see
below), final count:
```
$ npx vitest run tests/engine/day.test.ts
 Test Files  1 passed (1)
      Tests  28 passed (28)
```

**Full gate**, re-run fresh immediately before committing:
```
$ npx vitest run
 Test Files  13 passed (13)
      Tests  292 passed (292)          # 258 pre-existing + 28 (day.test.ts) + 6 (goldens.test.ts)
$ npx tsc --noEmit                      # exit 0, no output
$ npm run lint                          # exit 0, no output
$ npm run build
✓ 16 modules transformed, built in 69ms
```

`scripts/` is not in `tsconfig.json`'s `include` array (pre-existing;
outside my file ownership to change), so `gen_goldens.ts` isn't covered by
the official `npm run typecheck` gate. I verified it separately with a
throwaway `tsconfig.scripts-check.json` (`extends` the real config,
`include: ["scripts"]`), ran `tsc --noEmit --project` against it (clean, no
output), then deleted the throwaway file — it was never committed.

## Golden fixture generation

```
$ npx tsx scripts/gen_goldens.ts
wrote .../tests/determinism/fixtures/2026-09-01.json
  {"isoDate":"2026-09-01","dayType":"effect","scenarioIndexFor20":7,"attemptUsed":1,"rows40Hash":1776411464,"curve200Hash":2780851326,"sigCount200":324}
wrote .../tests/determinism/fixtures/2026-10-31.json
  {"isoDate":"2026-10-31","dayType":"null","scenarioIndexFor20":10,"attemptUsed":2,"rows40Hash":443603234,"curve200Hash":3570171442,"sigCount200":81}
wrote .../tests/determinism/fixtures/2026-12-25.json
  {"isoDate":"2026-12-25","dayType":"null","scenarioIndexFor20":5,"attemptUsed":1,"rows40Hash":4148700480,"curve200Hash":2731679053,"sigCount200":176}
wrote .../tests/determinism/fixtures/2027-01-01.json
  {"isoDate":"2027-01-01","dayType":"null","scenarioIndexFor20":12,"attemptUsed":1,"rows40Hash":3374168527,"curve200Hash":3573374522,"sigCount200":132}
wrote .../tests/determinism/fixtures/2027-07-04.json
  {"isoDate":"2027-07-04","dayType":"null","scenarioIndexFor20":7,"attemptUsed":0,"rows40Hash":3959929508,"curve200Hash":1565135596,"sigCount200":106}
```

All 5 attemptUsed values (1, 2, 1, 1, 0) are far below `MAX_ATTEMPTS=20` —
none of the golden dates hit the cap. `sigCount200` for the 4 null golden
dates (81, 176, 132, 106) all land inside `NULL_SIG_BAND=[30,180]`.

**Idempotency check** (re-ran the script a second time after the fixtures
were already generated and committed to the working tree, byte-diffed a
backup of the original against the regenerated file):
```
$ diff /tmp/.../before_2026-09-01.json tests/determinism/fixtures/2026-09-01.json && echo "IDENTICAL"
IDENTICAL
```

**`tests/determinism/goldens.test.ts`** (regenerates each date in-process
and compares against the committed JSON, plus a field-set completeness
check):
```
$ npx vitest run tests/determinism/goldens.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

## Observed 30-day acceptance distribution (2026-09-01 .. 2026-09-30, scenarioCount=20)

The controller asked for these numbers explicitly. Full per-day detail:

| isoDate | dayType | attemptUsed | sigCount200 (null) / outcome,d,hetero,p200,p400 (effect) |
|---|---|---|---|
| 2026-09-01 | effect | 1 | outcome=0 d=0.2831 hetero=false p200=0.0007 p400=0.0002 |
| 2026-09-02 | null | 0 | 81 |
| 2026-09-03 | null | 0 | 111 |
| 2026-09-04 | null | 2 | 172 |
| 2026-09-05 | null | 0 | 103 |
| 2026-09-06 | effect | 0 | outcome=1 d=0.2945 hetero=false p200=0.0007 p400=0.0000 |
| 2026-09-07 | effect | 0 | outcome=2 d=0.2488 hetero=false p200=0.0002 p400=0.0000 |
| 2026-09-08 | null | 0 | 64 |
| 2026-09-09 | null | 0 | 97 |
| 2026-09-10 | null | 2 | 43 |
| 2026-09-11 | effect | 0 | outcome=1 d=0.2239 hetero=true p200=0.0373 p400=0.0268 |
| 2026-09-12 | null | 0 | 164 |
| 2026-09-13 | null | 0 | 127 |
| 2026-09-14 | effect | 0 | outcome=2 d=0.2353 hetero=true p200=0.0060 p400=0.0023 |
| 2026-09-15 | null | 0 | 106 |
| 2026-09-16 | null | 0 | 176 |
| 2026-09-17 | null | 1 | 51 |
| 2026-09-18 | null | 0 | 54 |
| 2026-09-19 | null | 0 | 145 |
| 2026-09-20 | null | 0 | 83 |
| 2026-09-21 | null | 0 | **30** (exact lower boundary) |
| 2026-09-22 | effect | 0 | outcome=3 d=0.2467 hetero=false p200=0.0160 p400=0.0437 |
| 2026-09-23 | effect | 1 | outcome=0 d=0.2010 hetero=false p200=0.0532 p400=0.0002 |
| 2026-09-24 | null | 0 | 59 |
| 2026-09-25 | null | 1 | 72 |
| 2026-09-26 | null | 1 | 156 |
| 2026-09-27 | null | 0 | 37 |
| 2026-09-28 | null | 1 | 69 |
| 2026-09-29 | effect | 1 | outcome=2 d=0.2238 hetero=false p200=0.0189 p400=0.0218 |
| 2026-09-30 | null | 1 | 48 |

**Summary:**
- **22 null days, 8 effect days (26.7%)** — close to the 25% target, within
  normal sampling variance for n=30.
- **sigCount200 over null days:** min=30 (exactly the closed lower boundary
  of `NULL_SIG_BAND`, on 2026-09-21 — a real, useful edge-case confirmation
  that the `>=` comparison is correctly inclusive), max=176, mean=93.1.
  Every one of the 22 null days landed inside `[30, 180]`.
- **attemptUsed distribution: {0: 20, 1: 8, 2: 2}** (min=0, max=2). No day
  in this window came anywhere close to `MAX_ATTEMPTS=20`; the cap-exhaustion
  fallback never fired for real data in this window (only in the two
  purpose-built mocked tests below). Consistent with the calibration target
  quoted in the docs ("<1% of days" should hit the cap).
- Every effect day's canonical spec cleared both gates with comfortable
  margin (largest p200 was 0.0532 on 2026-09-23, still well under .15;
  largest p400 was 0.0437 on 2026-09-22, still under .05).

No calibration red flag here — the loop is accepting quickly and the band
is being exercised across its full width (including its exact boundary),
not just its comfortable middle.

## Implemented

**`src/engine/day.ts`** (new). Exports:
- `GeneratedDay` — `{ puzzle: DailyPuzzle; data: Dataset }`, exactly as
  briefed.
- `generateDay(iso, scenarioCount)` — the real daily flow.
- `generatePractice(seed, scenarioCount)` — practice flow (see Design
  decision #2 on the added parameter).
- `canonicalTransform(outcome)` / `canonicalSpecFor(outcome)` — the pinned
  transform rule (`Y2`→`log1p`, else `raw`) and the full canonical spec
  object.
- `bandDistance(sig, band)` / `pickBestEffectAttempt(candidates)` — the two
  best-attempt tie-break scoring rules, exported for direct unit testing.
- `hashRows(data, k)` — pinned name/signature per the brief, for E2E reuse
  later.
- `hashCurve(curve)` — fnv1a32 over specKey-sorted, valid-only points;
  shared between the goldens script and its regeneration test.

Internals: `acceptNullDay`/`acceptEffectDay` each run the attempt loop
(0..`MAX_ATTEMPTS`-1), collecting `{attempt, data, ...scores}` candidates as
they go so the best-attempt fallback always has real data to pick from;
`assemblePuzzle` is the one shared puzzle-construction path both entry
points call, parameterized by isoDate/puzzleNumber/scenario-index/hash-
source-string/attempt-seed-function/warn-context so the only actual
differences between `generateDay` and `generatePractice` are expressed once,
at the call site, not duplicated across two parallel implementations.

**`scripts/gen_goldens.ts`** (new) — runs the 5 pinned dates through
`generateDay(iso, 20)` + `enumerateCurve(data, 200)`, writes one JSON file
per date.

**`tests/engine/day.test.ts`** (new, 28 tests) and
**`tests/determinism/goldens.test.ts`** (new, 6 tests) — see Tested +
results below.

**`package.json`/`package-lock.json`** — added `tsx: ^4.23.5` as a
devDependency (the one authorized change); `package-lock.json` diff is
purely additive (476 insertions, 0 deletions — verified with
`git diff package-lock.json | grep "^-" | grep -v "^---"` producing no
output).

## Tested + results

**28 tests in `tests/engine/day.test.ts`:**
- **Determinism** (4): two `generateDay` calls on the same `(iso,
  scenarioCount)` produce `toEqual`-identical puzzles; byte-identical data
  (hash + raw `Float64Array`/`Uint8Array` comparison, not just same hash
  bucket); differs across different isoDates (sanity); `puzzleNumber`
  cross-checked against `src/game/daily.ts`'s real formula for 5 sample
  dates.
- **Acceptance guarantee over 30 consecutive days** (1 test, iterates all
  30 dates): every null day's `sigCount(enumerateCurve(data,200))` inside
  `NULL_SIG_BAND`; every effect day's canonical spec has p200<.15 AND
  p400<.05; `attemptUsed` always in `[0, MAX_ATTEMPTS)`. See distribution
  table above.
- **Best-attempt fallback — direct unit tests of the scoring helpers** (7):
  `bandDistance` (inside band, both closed boundaries, below, above);
  `pickBestEffectAttempt` (picks smallest p400 among the p200<.15 subset
  even when a worse-p200 candidate has an even smaller p400; falls back to
  smallest-p400-overall when no candidate qualifies; ties keep the earlier
  attempt).
- **Best-attempt fallback — end-to-end via mocked tuning constants** (2):
  null-day path mocks `NULL_SIG_BAND` to an unreachable range
  (`[99999,100000]`) and `MAX_ATTEMPTS` down to 3 (via `vi.doMock` +
  `vi.resetModules()` + dynamic `import()`, since the module was already
  statically imported at file-load time) on a verified null-day iso —
  confirms `attemptUsed` in range, `console.warn` called exactly once (spy),
  message contains both the iso and the attempt count. Effect-day path uses
  a real, already-observed fact instead of a mock of the (non-tunable,
  hardcoded) p-value thresholds: for iso `2026-09-01`, attempt 0 genuinely
  fails the real gate (confirmed by the 30-day distribution table above,
  where this date's real `attemptUsed=1`), so mocking only `MAX_ATTEMPTS: 1`
  deterministically forces a real cap-exhaustion on real data — same
  assertions (attemptUsed=0, warn called once with iso + count).
- **`canonicalTransform`/`canonicalSpecFor`** (3): outcome 1 → `log1p`,
  others → `raw`; full spec shape matches the pinned literal exactly.
- **`generatePractice`** (5): isoDate `'practice'`, scenario index =
  `seed % scenarioCount`; deterministic for the same `(seed, scenarioCount)`;
  distinct attempt-seed hash namespace from `daySeed` (checked directly at
  the hash level — see TDD evidence for why not via `generateDay`); same
  acceptance gates hold across a spread of 10 seeds including `0` and
  `2**31`.
- **`hashRows`/`hashCurve`** (7): determinism; sensitivity to `k` and to a
  one-row difference; **order-independence** (same points, shuffled array
  order → identical hash — the direct test of the T8 review ruling);
  invalid points excluded entirely from the hash; sensitivity to a changed
  valid p-value; determinism on a real enumerated curve.

**6 tests in `tests/determinism/goldens.test.ts`:** one regeneration-match
test per golden date (`toEqual` against the committed, statically-imported
JSON) plus one test asserting every fixture's key set is exactly the 7
pinned fields (no `puzzleNumber`, nothing extra).

**Full suite: 292/292 passing** (258 pre-existing + 28 new in
`day.test.ts` + 6 new in `goldens.test.ts`). `tsc --noEmit`, `npm run lint`,
`npm run build` all clean.

**Performance**: the full 30-consecutive-day acceptance test (30 real
`generateDay` calls, most doing a full 1792-spec enumeration at N=200, some
doing single-spec `runSpec` calls at N=200+N=400) runs in well under a
second as part of the 785ms/817ms full-file durations measured above —
consistent with the brief's "expected to run in seconds" and T8's ~20ms/
attempt measurement (30 days × ~1.27 average attempts × ~20ms ≈ 760ms
order-of-magnitude, matching observed reality).

## Files changed

- `src/engine/day.ts` (new)
- `scripts/gen_goldens.ts` (new)
- `tests/engine/day.test.ts` (new)
- `tests/determinism/goldens.test.ts` (new)
- `tests/determinism/fixtures/2026-09-01.json` (new)
- `tests/determinism/fixtures/2026-10-31.json` (new)
- `tests/determinism/fixtures/2026-12-25.json` (new)
- `tests/determinism/fixtures/2027-01-01.json` (new)
- `tests/determinism/fixtures/2027-07-04.json` (new)
- `package.json` (added `tsx` devDependency, one line)
- `package-lock.json` (tsx + transitive deps, purely additive)

## Commit

`feat: daily assembly with hackability rejection sampling + golden-master determinism suite`

Final commit SHA: **`99876f3`**. Post-commit verification (re-ran the full
gate a second time against the committed tree):
```
$ git status --porcelain          # (empty — clean)
$ git log --oneline -3
99876f3 feat: daily assembly with hackability rejection sampling + golden-master determinism suite
bc12871 Merge T8: exhaustive 1792-spec curve enumeration (review approved)
7b8aa40 feat: exhaustive 1792-spec curve enumeration with memoized preps

$ npx vitest run
 Test Files  13 passed (13)
      Tests  292 passed (292)
$ npx tsc --noEmit                 # exit 0, no output
$ npm run lint                     # exit 0, no output
$ npm run build
✓ 16 modules transformed, built in 73ms
```

## Self-review

**No index-keyed assertions anywhere (explicit STEP 6 requirement).**
Grepped every new file for `curve[`:
```
$ grep -rn "curve\[" src/engine/day.ts tests/engine/day.test.ts tests/determinism/goldens.test.ts scripts/gen_goldens.ts
src/engine/day.ts:132:      if (curve[i].valid && curve[i].p < 0.05) {
```
The one hit is the null-day precheck's stride-7 subsample walk
(`for (let i = 0; i < curve.length; i += 7)`), which is *live algorithm
behavior* pinned by the controller ("fixed stride-7 subsample of 256
specs"), backed by `specGrid.ts`'s own documented invariant that
`allSpecs()`/`enumerateCurve()` share one traversal and can never drift
apart in order — not a golden-fixture assertion. It is categorically
different from what the T8 review ruling warns against (a *fixture*
treating array position as a stable identifier across code versions).
Every actual golden-fixture-adjacent piece of code (`hashRows`,
`hashCurve`, the fixture JSON fields, `goldens.test.ts`) keys strictly by
row index (stable/meaningful — a dataset row's position *is* its identity,
unlike a spec's position in an enumerable cross-product), specKey (sorted,
order-independent), or named fields — never raw curve-array position.
Directly demonstrated by `hashCurve`'s dedicated
"is order-independent (same points, shuffled array order, same hash)" test.

**`hashRows` exported, exact pinned signature:**
```
$ grep -n "^export function hashRows" src/engine/day.ts
317:export function hashRows(data: Dataset, k: number): number {
```

**`console.warn` path tested with a spy, both day types.** Two dedicated
end-to-end tests (see Tested + results) each use
`vi.spyOn(console, 'warn').mockImplementation(() => {})`, assert
`toHaveBeenCalledTimes(1)`, and inspect the actual call arguments for both
the iso/seed and the attempt count. Restored (`mockRestore`) in a `finally`
block in both cases, alongside `vi.doUnmock` + `vi.resetModules()`, so
neither test's module-mocking leaks into any other test in the file
(confirmed empirically: the full 28-test file passes together, not just
each test in isolation).

**Determinism op-set.** `day.ts` uses only `Math.floor` (calendar
arithmetic, all integer-valued) and plain `+`/`-`/`*`/`/`/comparisons —
no `Math.pow`, `Math.random`, `Date.now`, or `new Date`. Confirmed both by
eslint's `no-restricted-properties`/`no-restricted-syntax` rules (clean)
and by inspection (this file doesn't touch floating-point transcendental
functions at all — that's entirely inside `dgp.ts`/`stats.ts`, which this
task only calls, never reimplements).

**Engine purity.** `day.ts`'s only imports are its own sibling engine
modules (`./analyze`, `./dgp`, `./prng`, `./seeds`, `./specGrid`, `./types`)
plus `../game/tuning` — confirmed both by eslint's `no-restricted-imports`
rule (clean) and by direct inspection of the import block.

**Discipline (YAGNI).** No exports beyond what the brief pins plus what
direct testability of the tie-break logic requires
(`bandDistance`/`pickBestEffectAttempt`, `canonicalTransform`/
`canonicalSpecFor`, `hashCurve`) — each justified above, none speculative.
Internal `pickMinBy` helper and the `AcceptanceResult`/candidate-shape
interfaces stay unexported (no external caller needs them).

## Concerns

1. **`puzzleNumber` and `generatePractice`'s signature** (Design decisions
   #1 and #2 above) are both places where I resolved a real ambiguity/
   inconsistency in the brief against corroborating evidence elsewhere in
   the merged codebase, rather than stopping and waiting (there was no
   synchronous channel to ask through mid-task). Both are backed by direct
   citations (T12's brief text; `protocol.ts`'s already-merged `Req`/
   `EngineClient` shapes) and both are cheap to reverse if I judged wrong —
   flagging explicitly per "mid-task ambiguity → ask, don't guess," since I
   had to make a call rather than truly asking.
2. **No calibration red flag.** The 30-day window never hit the acceptance
   cap even once (max `attemptUsed` observed was 2, against a cap of 20),
   and the null-day band was exercised across its full width including its
   exact lower boundary (30) — so I have no "STOP and report" signal to
   raise here. Including the full distribution table above per the report
   format's explicit request, in case the controller's own broader
   calibration suite (§8.3, a different task) wants a second data point.
3. **`scripts/` is outside `tsconfig.json`'s `include`.** Pre-existing,
   not something I'm authorized to change (not in my file-ownership list).
   I verified `gen_goldens.ts` typechecks cleanly via a throwaway, never-
   committed tsconfig rather than leaving it unverified — noting this so
   the controller knows the official `npm run typecheck` gate doesn't cover
   this one new file, in case a future task wants to fix that properly.

No other deviations from the brief's pinned semantics that I'm aware of.

---

## Fix report (review round 1)

Verdict received: **Needs fixes — one Important.** Both flagged design
decisions (§ Concerns #1/#2 above — `puzzleNumber` duplication,
`generatePractice`'s 2-arg signature) were adjudicated **ACCEPT**. Five
Minors were ledgered and explicitly NOT touched per instruction
(`daysFromCivil` duplication, `gen_goldens.ts` error handling,
`SCENARIO_COUNT` triplication, no-leap-day cross-check dates, `scripts/`
tsconfig).

### The defect

`acceptNullDay` called `enumerateCurve(data, 200)` (the full, expensive
1792-spec enumeration) **unconditionally on every attempt**, then derived
the stride-7/256-spec precheck by reading a slice of that
already-computed array (`for (let i = 0; i < curve.length; i += 7)`).
Master spec §3.3 and the dispatch pin both require the cheap check to run
**before**, and gate, the expensive one ("only if the precheck passes do
you run the full enumeration gates"). My original implementation was
decision-correct (same 256 specs, same "any significant" logic, so it
never produced a wrong *answer*) but structurally never gated anything —
the "cheap-first" perf property the spec asks for simply didn't exist.
This wasn't surfaced in my own report, which the reviewer correctly called
out as the process half of the defect: I should have noticed my own
"compute curve first, then read precheck off it" wasn't actually an
ordering at all.

### The fix

`src/engine/day.ts`:
- Added `PRECHECK_SPECS` (module-level, computed once): `allSpecs()`
  filtered to every 7th entry (`i % 7 === 0`) — the identical 256-spec set
  as before, now a standalone list rather than an implicit slice of
  `enumerateCurve`'s output.
- Added `nullDayPrecheckHit(data)`: iterates `PRECHECK_SPECS`, calling
  `runSpec(data, spec, 200)` directly (not `enumerateCurve`), early-exiting
  on the first `valid && p < .05` hit.
- Rewrote `acceptNullDay`: calls `nullDayPrecheckHit(data)` **first**; if it
  returns `false`, the attempt is rejected immediately (`continue`) without
  ever calling `enumerateCurve`. Only when it returns `true` does the
  function call `enumerateCurve(data, 200)` + `sigCount(...)` for the band
  check.
- Best-attempt fallback candidates changed shape: `NullCandidate.sig` is now
  `number | null` (`null` when the precheck failed and the curve was never
  computed for that attempt — there is nothing to record). A `hasSig` type
  guard filters to candidates with a real `sig` for the `bandDistance`
  tie-break; if literally none exist (every attempt failed precheck), the
  fallback deterministically picks the first attempt rather than paying for
  an enumeration just to break an otherwise-undecidable tie. The warning
  message prints `sigCount=n/a (precheck never passed)` in that case instead
  of a number.
- Documented the ordering both in the file's top header comment and at
  `nullDayPrecheckHit`'s own definition (point-of-use), per requirement 3,
  explicitly naming this as the review-round-1 fix so a future reader who
  finds the "compute curve, slice for precheck" idiom elsewhere (e.g. if
  someone reintroduces it) has a pointer to why it's wrong here specifically.

`tests/engine/day.test.ts` — two new tests (requirement 2), both mocking
`analyze.ts`'s `runSpec` (which `nullDayPrecheckHit` calls directly) to
force each branch deterministically, and wrapping `specGrid.ts`'s
`enumerateCurve` with a call counter:
- *"a precheck-failing attempt completes without enumerateCurve ever being
  invoked"* — `runSpec` mocked to always return `{valid:true, p:0.9}`
  (never significant), `MAX_ATTEMPTS` mocked to 2 for speed. Asserts
  `enumerateCurveCalls === 0`, `attemptUsed === 0` (the no-sig fallback
  default), and the warning message contains `"n/a (precheck never
  passed)"`.
- *"a precheck-passing attempt invokes enumerateCurve exactly once"* —
  `runSpec` mocked to always return `{valid:true, p:0.0001}` (significant;
  early-exit means only the first call actually matters), `MAX_ATTEMPTS`
  mocked to 1 so exactly one attempt runs. Asserts `enumerateCurveCalls ===
  1`.

### Commands + output

**`day.test.ts`** (28 pre-fix tests + 2 new gating tests = 30):
```
$ npx vitest run tests/engine/day.test.ts
 Test Files  1 passed (1)
      Tests  30 passed (30)
   Duration  879ms
```

**`goldens.test.ts`** (unchanged — this is the determinism check):
```
$ npx vitest run tests/determinism/goldens.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  325ms
```

**Full gate:**
```
$ npx vitest run
 Test Files  13 passed (13)
      Tests  294 passed (294)          # 258 pre-existing + 30 (day.test.ts) + 6 (goldens.test.ts)
$ npx tsc --noEmit                      # exit 0, no output
$ npm run lint                          # exit 0, no output
$ npm run build
✓ 16 modules transformed, built in 83ms
```

### Determinism: goldens explicitly confirmed unmoved

Three independent checks, all agreeing:

1. **`goldens.test.ts` itself** (regenerates each of the 5 dates in-process
   and compares against the committed JSON) — passed, 6/6, immediately
   after the fix (pasted above).
2. **Re-ran `scripts/gen_goldens.ts` after the fix** and compared its fresh
   output to the values recorded in the original T9 report — byte-identical:
   ```
   2026-09-01: {"scenarioIndexFor20":7,"attemptUsed":1,"rows40Hash":1776411464,"curve200Hash":2780851326,"sigCount200":324}
   2026-10-31: {"scenarioIndexFor20":10,"attemptUsed":2,"rows40Hash":443603234,"curve200Hash":3570171442,"sigCount200":81}
   2026-12-25: {"scenarioIndexFor20":5,"attemptUsed":1,"rows40Hash":4148700480,"curve200Hash":2731679053,"sigCount200":176}
   2027-01-01: {"scenarioIndexFor20":12,"attemptUsed":1,"rows40Hash":3374168527,"curve200Hash":3573374522,"sigCount200":132}
   2027-07-04: {"scenarioIndexFor20":7,"attemptUsed":0,"rows40Hash":3959929508,"curve200Hash":1565135596,"sigCount200":106}
   ```
   Identical to the values in the original report's "Golden fixture
   generation" section, digit for digit.
3. **`git diff --stat` against the committed fixture files** after
   regenerating — empty output, i.e. zero bytes changed:
   ```
   $ git diff --stat tests/determinism/fixtures/
   (no output)
   ```

No golden hash moved. This matches the a priori expectation: reordering
*when* a value is computed cannot change *what* that value is, since
`runSpec(data, spec, 200)` and `enumerateCurve(data, 200)[k]` are
bit-for-bit identical for the same spec (specGrid.ts's own parity
guarantee, exhaustively tested in T8). The reordering only changes which
attempts get a `sigCount` computed *for the fallback candidate list*, and
none of the 30-day window's or the 5 golden dates' attempts ever reach the
fallback path at all (every one accepts within a handful of attempts — see
the original report's distribution table), so this had zero opportunity to
matter for any currently-observable output.

### Performance: measured, both orderings, over the 30-day window

Per requirement 4, I benchmarked the OLD (pre-fix, committed at `99876f3`)
and NEW (this fix) `acceptNullDay` logic side by side, reimplemented
faithfully as standalone functions in a throwaway scratchpad script (not
part of the committed tree), calling the exact same
`generateDataset`/`enumerateCurve`/`sigCount`/`runSpec`/`daySeed`/
`allSpecs` the real code uses. Verified the OLD reimplementation against
`git show 99876f3:src/engine/day.ts` line-for-line before trusting the
comparison. Scope: the 22 null days in the 2026-09-01..2026-09-30 window
(the same window from the original report).

**Decision-equality** (checked first, before timing): both orderings
produced the identical `attemptUsed` for all 22 null days — zero
mismatches. This is the same fact goldens.test.ts confirms for the 5
golden dates, now confirmed across the full 30-day window too.

**Wall-clock, 10 repetitions, alternating which ordering ran first per
repetition** (to rule out GC/JIT-tiering bias):
```
null days in window: 22 of 30
decision-equality check complete (no MISMATCH lines above => identical decisions)

10 repetitions, 22 null days per repetition:
OLD ordering (full enumeration always first): min=173.17ms median=173.56ms mean=174.08ms max=176.71ms
NEW ordering (precheck-gated):                 min=192.21ms median=194.78ms mean=195.34ms max=204.95ms
per-null-day: OLD median=7.89ms, NEW median=8.85ms
ratio (NEW/OLD, median): 1.12x
```

The two distributions don't overlap at all (OLD's max, 176.71ms, is below
NEW's min, 192.21ms) — this is a real, consistent effect, not noise. **The
letter-compliant (NEW) ordering is ~11-12% slower than the ordering the
review flagged as broken**, confirming the reviewer's own hypothesis
("256 un-memoized runSpec calls may not be cheaper").

**Mechanism** (supplementary measurement, same dataset, no acceptance-loop
overhead, isolating per-spec cost):
```
256 unmemoized runSpec calls (no early exit), median of 20: 3.325ms
full 1792-spec enumerateCurve, median of 20:                5.287ms
=> per-spec cost: 256-runSpec 0.0130ms/spec vs enumerateCurve 0.0030ms/spec
```
Two compounding reasons the NEW ordering is net slower despite checking
*fewer* specs upfront:
1. **Per-spec cost is ~4.3x higher without memoization** — `runSpec` also
   computes a confidence interval (`criticalT`'s 20-iteration bisection of
   `tTwoTailedP`) that the precheck never uses, and each of the 256 calls
   redoes the subgroup-filter → transform → z-score → exclusion → OLS
   pipeline from scratch, none of it shared with its neighbors. T8's own
   report flagged this exact CI computation as the thing `CurvePoint`
   deliberately skips "for all 1,792 points" specifically for performance.
2. **The common case now pays for both steps, not one.** Precheck passes on
   effectively every attempt that matters (it's implied whenever the day
   eventually gets accepted, and it's rare for it to fail at all — the
   30-day window never once exercised the "precheck fails" branch on real
   data). Under the OLD ordering, an accepted attempt's precheck was free
   (read off the curve you were computing anyway). Under the NEW ordering,
   an accepted attempt now pays for the 256-spec precheck *first*, then
   *still* pays for the full 1792-spec enumeration — strictly more total
   work on the path that actually matters, in exchange for skipping the
   enumeration only on the rare attempt that fails precheck (which this
   window never observed at all).

**In absolute terms**, both orderings are trivially fast for this
application (~7.9ms vs ~8.9ms per null day, against an 800ms CI budget /
400ms browser budget from T8's own perf test, and day generation runs once
per calendar day per player, never in a hot loop) — but per the review
instruction, I'm reporting the relative regression plainly rather than
judging it immaterial myself: **the letter-compliant ordering is
measurably, consistently slower, by design, given the current memoization
architecture.** I did not attempt to build a faster precheck (e.g. a
custom mini-memoized subset enumerator) — the review explicitly asked me
not to ("the controller will take that to a plan adjudication rather than
have you optimize further").

### Files changed (this fix)

- `src/engine/day.ts` (reordered `acceptNullDay`; added
  `PRECHECK_SPECS`/`nullDayPrecheckHit`/`NullCandidate`/`hasSig`; updated
  header comment)
- `tests/engine/day.test.ts` (two new tests: precheck-fail-skips-
  enumeration, precheck-pass-invokes-once)

No other files touched — the five ledgered Minors were left exactly as
they were, per instruction.

### Commit

`fix: null-day precheck now actually gates the full enumeration`

New HEAD: **`ef8f198`**. Post-commit verification:
```
$ git status --porcelain                # (empty — clean)
$ git log --oneline -3
ef8f198 fix: null-day precheck now actually gates the full enumeration
99876f3 feat: daily assembly with hackability rejection sampling + golden-master determinism suite
bc12871 Merge T8: exhaustive 1792-spec curve enumeration (review approved)
$ npx vitest run
 Test Files  13 passed (13)
      Tests  294 passed (294)
$ git diff --stat HEAD~1 HEAD -- tests/determinism/fixtures/    # (empty — fixtures untouched by this commit)
```

### Self-review (fix)

**Requirement 1 (reorder + gate).** Done: `nullDayPrecheckHit` runs before
any call to `enumerateCurve`, and `enumerateCurve` is now inside the
`if (!nullDayPrecheckHit(data)) { ...; continue; }` branch's else-path
(structurally: after an early `continue`, not behind a redundant boolean).
Decision gates unchanged (confirmed via decision-equality check + goldens).

**Requirement 2 (prove the gating with a test).** Done: two new tests,
using a mocked `runSpec` (the actual function the precheck calls) plus a
counting wrapper around `enumerateCurve`, proving both directions
(precheck-fail → 0 calls; precheck-pass → exactly 1 call) rather than
inferring it indirectly from timing or golden values.

**Requirement 3 (document at point of use).** Done: `nullDayPrecheckHit`'s
own docblock explains the ordering and cross-references this fix report;
the file's top header comment was also updated (same standard as the
effect-day precheck note it deliberately mirrors).

**Requirement 4 (measure, report honestly, don't over-optimize).** Done:
both a direct 30-day-window wall-clock comparison (10 alternating
repetitions, non-overlapping distributions) and a supplementary per-spec
mechanism measurement, both pasted above with raw numbers, plus an
explicit statement that the fix is measurably slower and that I did not
attempt to close that gap myself.

**No index-keyed golden-fixture assertions introduced by this fix.**
`PRECHECK_SPECS` is a plain array of `Spec` objects (not indices), built
once from `allSpecs()`; `nullDayPrecheckHit` iterates it with a `for...of`
(no index arithmetic at all, unlike the old `curve[i]` slice it replaces).
Nothing about this fix touches `hashCurve`/`hashRows`/the fixture JSON
shape.

### Concerns (fix)

1. **The letter-compliant ordering is materially slower in relative terms
   (~11-12%), though trivial in absolute terms (~1ms/day).** Reported per
   instruction rather than adjudicated by me. If the controller decides
   this regression isn't acceptable, the likely remedy (not attempted
   here) would be a genuinely cheap precheck — e.g. a stripped-down
   per-spec check that skips the CI bisection and shares the same
   memoized subgroup/transform/z-score/exclusion prefixes `enumerateCurve`
   already builds, restricted to the 256-spec subsample — which would
   need its own review/testing pass as a follow-up, not a quiet edit to
   this fix.
2. All five ledgered Minors were left untouched, as instructed; not
   re-litigating them here.

No other new concerns from this fix.
