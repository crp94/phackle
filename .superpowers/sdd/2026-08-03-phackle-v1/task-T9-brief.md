### Task T9: Day assembly — rejection sampling + determinism goldens

**Files:** Create `src/engine/day.ts`, `scripts/gen_goldens.ts`; Test `tests/determinism/goldens.test.ts` + `tests/determinism/fixtures/*.json`
**Depends:** T8, T1(daily). **Master spec:** §3.3, §3.1.

**Interfaces (produces):**
```ts
export interface GeneratedDay { puzzle: DailyPuzzle; data: Dataset }   // DailyPuzzle per types.ts §6
export function generateDay(iso: string, scenarioCount: number): GeneratedDay; // uses src/engine/seeds.ts hashes (T1)
export function generatePractice(seed: number): GeneratedDay;         // same acceptance, seed-derived, isoDate='practice'
// Acceptance (§3.3): loop attempt=0..MAX_ATTEMPTS-1, dataset from daySeed(iso,attempt):
//  null day: sigCount(enumerateCurve(data, 200)) ∈ NULL_SIG_BAND
//  effect day: canonical spec {outcome: j*, subgroup:'all', covariates:{income:true,risk:true}, exclusion:'none',
//              transform: canonicalTransform(j*), tails:'two'} has p<.05 @400 AND p<.15 @200
//              where canonicalTransform: Y2 → 'log1p', else 'raw'
//  precheck: fixed stride-7 subsample of 256 specs must show ≥1 (null) / canonical p<.3 (effect) before full enumeration
//  cap: after MAX_ATTEMPTS accept best-scoring attempt (distance to band / canonical p), console.warn
```

**Steps:**
- [ ] **RED**: determinism — `generateDay('2026-09-01')` twice → deep-equal puzzles + identical first-40-row hash (hash = fnv1a32 of fixed-precision `toFixed(10)` row serialization; helper `hashRows(data, k)` exported for E2E reuse); acceptance — over dates spanning 30 consecutive days: every null day's sigCount@200 within band, every effect day's canonical spec passes both gates; attempt counter recorded in puzzle.attemptUsed.
- [ ] **Verify fail** → **GREEN** → **Verify pass**.
- [ ] **Goldens**: `scripts/gen_goldens.ts` (tsx) runs 5 fixed dates `2026-09-01, 2026-10-31, 2026-12-25, 2027-01-01, 2027-07-04` → writes `{isoDate, dayType, scenarioIndexFor20, attemptUsed, rows40Hash, curve200Hash, sigCount200}` (NO puzzleNumber — EPOCH changes at T25 must not break goldens). Commit fixtures + test that regenerating in-process matches committed bytes. This guards drift; correctness came from T2/T3/T7 fixtures.
- [ ] **Commit** `feat: daily assembly with hackability rejection sampling + golden-master determinism suite`.

---

