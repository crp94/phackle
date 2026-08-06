### Task T19 / T20: Italian / Spanish transcreation (two parallel agents)

**Files (each):** Create `src/content/{it|es}/index.ts`, `src/content/{it|es}/copy.ts`; Modify `src/i18n/locale.ts` (AVAILABLE_LOCALES append), `src/content/index.ts` (real loader); Test extend `tests/content/shape.test.ts` locale-parity cases
**Depends:** T6 + T17 copy freeze. **Specs:** delta spec content plan + non-translation rules; master §1.2 register, §4 harm-check.

**Brief (give the agent verbatim):** You are transcreating, not translating: rewrite jokes so they are funny in {Italian|Spanish}; keep the mock-academic register (Act I sincere grant-hustle enthusiasm, Act II clinical deadpan; never smug). Keep ALL scenario `id`s, order, structure, tags identical to `src/content/en/`. Journal names + DOIs stay English (that is the joke: it's where you actually publish). Statistical notation keeps `.` decimals. Outcome labels must preserve the positive hypothesized direction. Prof. Grantwell stays "Prof. Grantwell". Emoji identical. `CopyKey` union must be satisfied exactly — `tsc` is the completeness gate. Achievement citations read like award citations. Glossary terms: use the standard {Italian|Spanish} statistical terminology (e.g., IT "grado di libertà del ricercatore", ES "grados de libertad del investigador").
**Steps:**
- [ ] **RED**: parity test — `validateLocaleContent(localeContent, enIds)` (same ids/order/counts/tags); copy satisfies union (tsc); journals referenced stay from shared EN pool; spoiler share test auto-extends via AVAILABLE_LOCALES.
- [ ] **Verify fail** → **GREEN** (author full content) → **Verify pass** → **Commit** `feat: {Italian|Spanish} transcreation — full locale content`.

---

