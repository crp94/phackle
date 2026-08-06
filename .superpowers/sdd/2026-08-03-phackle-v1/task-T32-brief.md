### Task T32: Comedy punch-up + AI-prose scrub (owner directive, opus)

**Files:** Modify `src/content/en/index.ts` (scenarios, grantwell, press, retraction sublines, achievements citations), `src/content/en/copy.ts` (About prose values + any user-facing sentence values — KEYS unchanged), extend `tests/content/shape.test.ts` (em-dash budget); **Depends:** T30+T31 merged (copy.ts contention). **Owner directive (verbatim):** "The comedy is just meh, needs to be more brave. The text has too many em dashes, reads too AI."

**Pins:**
- BRAVER: more committed absurdity in premises and specifics, sharper institutional satire (deans, funding agencies, metrics-worship, Reviewer 2), funnier concrete details. Braver ≠ winkier: the register law stands untouched (Act I sincere, Act II clinical, the Armitage footnote stays the only sanctioned wink); the harm policy stands (lexicon + spirit; no real-entity targets).
- AI-PROSE SCRUB, mechanized: new shape test — per-string em-dash (—) count ≤ 1 AND corpus-wide density ≤ 1 per 400 characters across all EN content values (scenarios+banks+copy values); the scrub itself: replace em-dash constructions with periods/commas/parentheses where they were doing hedge-work, vary sentence lengths, cut "not just X but Y" and stacked-appositive cadences. The test goes into validateLocaleContent's file so T19/T20 inherit the budget automatically.
- Every VALUE may change; no KEY changes, no structural changes (ids/order/counts/tags fixed — the existing shape tests must pass untouched except the new budget test). Direction contract (more = claimed effect) and {effect} token rules unchanged.
- Self-review bar: read every changed line aloud; if a line is merely different rather than funnier, revert it. Quote the ten best new lines in the report.

**Steps:** RED (em-dash budget test fails against current corpus — verify it actually fails first; if it passes already, tighten to the owner's intent and document the measured density) → punch-up pass → GREEN + full gate → commit `feat: braver corpus + em-dash budget (owner directive)`.
