### Task T29: Visual polish pass (aesthetics agent, screenshot-driven)

**Depends:** T14–T18 complete; runs BEFORE T22. **Files:** Modify `src/ui/**` styling only — zero behavior/logic changes.
**Steps:**
- [ ] Capture screenshots of Briefing/Lab/Published/Call/Reveal/Summary/Stats at 375px and 1280px, light + dark (Playwright is installed by then; a throwaway script under the SDD workspace is fine — do not commit it).
- [ ] Judge every screen against `docs/DESIGN.md` rule-by-rule; fix violations: off-scale spacing, raw hex, filled boxes/shadows, type-scale drift, motion outside budget, hierarchy failures (the dial and the stamp must dominate their screens).
- [ ] Grep gates: no hex outside tokens.css; no `box-shadow`; `border-radius` ≤2px (confetti canvas exempt).
- [ ] `npx vitest run` stays green — a test may be amended ONLY where a style assertion legitimately changed, each justified in the report.
- [ ] **Commit** per screen group (`fix: polish <screens> per DESIGN.md`); report includes before/after screenshot paths.

---

