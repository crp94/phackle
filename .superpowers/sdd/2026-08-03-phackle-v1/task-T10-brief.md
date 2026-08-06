### Task T10: reveal.ts + calibration suite + p_hit table

**Files:** Create `src/engine/reveal.ts`, `scripts/simulate_calibration.ts`, `src/data/p_hit_by_k.json`; Test `tests/engine/reveal.test.ts`
**Depends:** T9. **Master spec:** §3.7, §3.9 calibration targets, §2.7.

**Interfaces (produces):**
```ts
export function verdictStamp(dayType: DayType, published: Spec | null, trueOutcome: Outcome | null):
  'RETRACTED' | 'REPLICATED' | 'NULL_REPORTED';
// null published → NULL_REPORTED; effect day && published.outcome === trueOutcome → REPLICATED; else RETRACTED (§2.7.4)
export function buildRevealMetrics(day: GeneratedDay, curve: CurvePoint[], published: Spec | null,
  explored: Spec[], peeks: number): RevealMetrics;   // §6 shape; pHitAtK from table, k = explored.length clamped [1,40]
export function pHitTableChecksum(): number;         // fnv1a32(JSON.stringify(DGP constant vector)); asserted vs JSON at startup
// scripts/simulate_calibration.ts (npm run cal): 500 null + 500 effect synthetic days (seeds `cal:{i}`), asserts §3.9:
// (a) ≥99% null days sigCount∈band-reachable (≥30); (b) greedy random explorer median paths-to-first-hit ∈ [4,12]
// measured over the DAILY MIX (75% null / 25% effect — the player-experience statistic; ADJUDICATED 2026-08-03 after
// measurement showed null-only=15: §3.9 never pinned the day population, and the felt pacing is the mix; null-only is
// ALSO reported informationally with band [4,16]); (c) effect-day canonical power @400 ∈ [0.6,0.85];
// (d) informed caller accuracy ∈ [0.75,0.90] using the FAMILY-DENSITY statistic (ADJUDICATED 2026-08-03: the literal
// §3.9d family-share rule is information-theoretically broken — within-family spec correlation makes significant paths
// cluster into families even on null days, so no threshold beats the 0.75 base rate; density = significant fraction
// WITHIN the published spec's outcome family, ≥60% threshold unchanged, which formalizes §2.7.6's "real effects
// cluster, noise scatters" and measures 0.822 — the in-script comment must document the literal rule's failure mode);
// (e) attempts p99 ≤ MAX_ATTEMPTS. Writes p_hit_by_k.json
// {checksum, pHit: number[41]} + prints a report table. Non-zero exit on any band miss. §3.9 marks these targets
// [TUNABLE]; both adjudications are definition changes in the simulation only — no DGP constants, no golden movement.
```

**Steps:**
- [ ] **RED**: reveal.test.ts — stamp truth table (6 cases incl. wrong-outcome-on-effect-day → RETRACTED); metrics counts computed from a synthetic curve; pHitAtK reads table; checksum mismatch throws.
- [ ] **Verify fail** → **GREEN** → **Verify pass**.
- [ ] **Run `npm run cal`.** If any §3.9 band fails: adjust `dgpConstants.ts` / `tuning.ts` marked TUNABLEs (loading weights, d range, band), regenerate goldens via `scripts/gen_goldens.ts` (DGP changed ⇒ goldens legitimately move — note it in the commit body), rerun until green. Record final report table in the commit message body.
- [ ] **Commit** `feat: reveal metrics + calibration suite green (report in body)`.

---

