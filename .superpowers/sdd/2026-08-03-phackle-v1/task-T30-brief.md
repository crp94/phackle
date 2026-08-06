### Task T30: Day-completion achievements wiring (post-screen-wave)

**Files:** Modify `src/game/store.ts` (ONE additive extension: `resultLog`), `src/ui/screens/Summary.tsx` (inside the existing idempotent persist block), `src/game/storage.ts` (add `saveAchievements`); Create `src/game/dayComplete.ts`; Test `tests/game/dayComplete.test.ts` + extend `tests/ui/summary.test.tsx`
**Depends:** screen wave merged. **Master spec:** §2.11. **Context:** T13 built `evaluateAchievements` pure; T17's review confirmed it has ZERO call sites — the wall stays all-locked and the prereg unlock (first_retraction) is dead. T17's persist block (keyed on store.iso, idempotent) is the single sanctioned persistence moment; achievements join it.

**Pins:**
- `store.ts`: add `resultLog: { key: string; p: number; valid: boolean }[]` appended whenever a settled result is displayed (same moment the VIEW_SPEC seen-flag logic runs); additive only, reset by boot(); one new store test.
- `dayComplete.ts`: `computeDecisiveTails(resultLog, published): boolean` — true iff published.tails === 'one', published p < .05, and the same spec with tails 'two' appears in resultLog with p ≥ .05 (the master's "flipping to one-tailed was the decisive fork"); plus `unlockAchievements(ctx): AchievementId[]` wrapping T13's evaluateAchievements with the ctx assembled from store + history.
- `storage.ts` `saveAchievements(ids, iso)`: merge-only (existing unlock dates never overwritten; first date wins), same memory-fallback semantics as the rest of the file.
- `Summary.tsx`: inside the EXISTING `!practice && !alreadySaved` block (never a second persistence moment), after saveDay: compute + saveAchievements. The prereg upsell's gate (achievements.first_retraction) starts working by construction — test it end-to-end: drive a RETRACTED day, assert the upsell renders on the same summary.
- Idempotence inherited: re-visits skip the whole block (already proven); add one assertion that achievement dates don't change on remount.

**Steps:** RED (decisiveTails truth table incl. the no-two-tailed-sibling case; unlock merge semantics; end-to-end first_retraction → upsell; remount date-stability) → GREEN → full gate → commit `feat: wire achievement evaluation into the day-completion persist moment`.

---

