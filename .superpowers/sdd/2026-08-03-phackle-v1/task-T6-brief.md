### Task T6: English content — 20 scenarios + full flavor banks

**Files:** Modify `src/content/en/index.ts`, `src/content/en/copy.ts` (About/glossary prose keys); Test extend `tests/content/shape.test.ts` (raise counts to ≥20, uncomment marker line from T4)
**Depends:** T4. **Master spec:** §4 entire, §1.2 register, §1.4 (About citations).

**Steps:**
- [ ] **RED**: flip `validateLocaleContent` thresholds to ≥20 scenarios / ≥12 grantwell; add: every scenario's outcomeLabels phrased so "more = the claimed effect direction" (hypothesized direction is always positive — this is the one-tailed direction contract with T7); harm-check test: scenario text contains none of a small lexicon `['vaccine','drug','cancer','diet','cure','therapy','supplement']` (case-insensitive).
- [ ] **Verify fail** → **GREEN**: author the 10 spec scenarios (§4.1) + 10 new via the template (each: one heavy-tailed, one skewed, one count, one bounded outcome; absurd-but-benign); ≥12 Grantwell emails (§4.2 samples + escalating desperation); press blurbs across tiers incl. tier-3 TV chyron; retraction sublines (§4.5); achievement names+citations (§2.11, deadpan award-citation register); glossary (§Appendix B, one sentence each); About page prose (mechanism disclosure §1.4 citations, synthetic-data disclaimer, analytics disclosure per delta spec, decimal-point note).
- [ ] **Verify pass** → **Commit** `feat: full English content — 20 scenarios, Grantwell bank, press, achievements, glossary`.

---

