### Task T18: Prereg Mode

**Files:** Create `src/ui/screens/Prereg.tsx`; Modify `src/game/store.ts` (mode guards), `src/ui/screens/{Briefing,Summary}.tsx`; Test `tests/game/prereg.test.ts`
**Depends:** T14, T16, T13. **Master spec:** §2.6 unlock, §2.8 prereg rows, §7.3 Prereg screen.

**Behavior pins:** unlocked iff `achievements.first_retraction` exists; same day's scenario/DGP; SpecControls rendered as a **preregistration form** + commit checkbox (copy prereg.commit "I solemnly commit…"); after commit: data reveal → exactly one runSpec on the committed spec at N=400 (no extend, no changes — controls disabled) → straight to reveal (curve shown, 🧾-prefixed share, no CALL — the prereg score rows §2.8 replace it; stamp: sig+effect→REPLICATED, sig+null→RETRACTED + special one-liner copy reveal.preregFalsePositive, nonsig→NULL_REPORTED). Separate score track: DayRecord.mode='prereg'; one play per mode per day enforced in storage (`history[iso]` keyed `hack`/`prereg` sub-records — extend DayRecord storage to `Record<IsoDate, Partial<Record<'hack'|'prereg', DayRecord>>>`; migrate() adjusts; update T13 tests).
**Steps:**
- [ ] **RED**: locked before first retraction; commit → single result path (fake client: exactly 1 runSpec, extend throws); all four prereg scoring rows; summary shows prereg-vs-hack comparison; share prefix 🧾.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: prereg mode — the α lesson, felt in the body`.

---

