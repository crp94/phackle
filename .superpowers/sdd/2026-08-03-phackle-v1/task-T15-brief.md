### Task T15: BRIEFING + PUBLISHED screens

**Files:** Create `src/ui/screens/Briefing.tsx`, `src/ui/screens/Published.tsx`, `src/ui/components/JournalCover.tsx`; Test `tests/ui/published.test.tsx`
**Depends:** T5, T12, T6. **Master spec:** §2.3, §2.5, §7.3.

**Interfaces:**
```ts
export function pickJournal(tags: string[], iso: string): { name: string };   // tag-filtered pool, fnv1a32(iso) pick
// Press picker (T6 review adoption): prefer a tier-matching blurb whose optional scenarioIds includes today's
// scenario id; fall back to the scenario-agnostic pool. Headline rendering: substitute the {effect} token (present in
// most headlines, absent in some — both legal, at most one per headline) with the published spec's treatment effect,
// rendered in the frame the surrounding text implies and rounded to a whole number ≥1 (never render 0/€0k — floor at 1
// or drop to the no-number variant if the scenario provides none).
export function egregiousnessTier(forks: number): 1 | 2 | 3;                  // ≤TIER_FORKS.polite→1, ≥TIER_FORKS.editorsPick→3, else 2
export function fakeDoi(puzzleNumber: number): string;                        // `10.1337/phk.${puzzleNumber}`
export function JournalCover(p: { journal: string; headline: string; authors: string; doi: string; tier: 1|2|3 }): JSX.Element;
// Briefing: manuscript title page (question as title, "Corresponding author: You" copy key), Grantwell EmailCard
// (rotation: fnv1a32('grantwell:'+iso) % bank), CTA briefing.openData; prereg mode chooser if unlocked (T18 wires).
// Published: full-bleed takeover; ConfettiLayer (tier-scaled particles 150/250/400, 3s); cover; press blurbs of matching tier
// sliding in, each watermarked copy published.simulatedPress; tier3 adds chyron bar + copy published.editorsPick; CTA "Face the truth".
```

**Steps:**
- [ ] **RED**: tier fn boundary cases (3→1, 4→2, 9→2, 10→3); DOI format; every press card contains SIMULATED watermark text; confetti particle prop by tier; cover shows headline + English journal name regardless of locale (pass locale 'it' content, journal stays EN); Grantwell rotation deterministic by date.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: briefing + published celebration with egregiousness tiers`.

---

