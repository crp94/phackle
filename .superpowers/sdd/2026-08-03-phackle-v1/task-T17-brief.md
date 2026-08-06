### Task T17: SUMMARY + STATS + LEGEND + ABOUT + header finalization

**Files:** Create `src/ui/screens/{Summary,Stats,Legend,About}.tsx`; Modify `src/ui/App.tsx` (nav: stats/legend/about links, locale+theme toggles live); Test `tests/ui/summary.test.tsx`
**Depends:** T13, T16, T6. **Master spec:** §2.8, §7.3.

**Interfaces:**
```ts
export function msToNextLocalMidnight(now: Date): number;     // countdown; test across DST fall-back date
export function shareViaNavigator(text: string): Promise<'shared' | 'copied'>;  // navigator.share → clipboard fallback
// Summary: score breakdown table styled as journal fee invoice (breakdown rows from scoring.ts CopyKeys), share button
// (→ toast summary.copied), streak strip, countdown summary.nextIn {h}{m}, prereg upsell when achievements.first_retraction unlocked.
// Stats: call accuracy all-time + rolling-20, prereg-vs-hacking "success" rate side-by-side (ALWAYS both — the α lesson §2.8),
// fork histogram (CSS bars, no lib), achievement wall (locked = embossed blind stamps: name hidden, citation hidden).
// About: full mechanism disclosure prose from copy keys (§1.4 citations, synthetic-data + analytics + decimal-point notes),
// version string (import.meta.env-injected git sha) + SITE_URL; Legend: §2.9 emoji table from copy keys.
```

**Steps:**
- [ ] **RED**: countdown math incl. DST; share fallback path writes clipboard (mock both APIs); invoice rows sum to score for 3 scoring fixtures; rolling-20 accuracy from a 25-day history fixture; locked achievement reveals no name (accessibility text = copy `stats.locked`); prereg-vs-hack panel renders both percentages from history fixture.
- [ ] **Verify fail** → **GREEN** → **Verify pass**.
- [ ] **COPY FREEZE**: audit `CopyKey` union — every key referenced anywhere exists in `en/copy.ts`; grep `src/ui` for raw user-facing string literals (allowed: aria-hidden decorations, "P-hackle" wordmark, emoji). Fix strays. This unblocks T19/T20.
- [ ] **Commit** `feat: summary invoice, stats & achievement wall, about/legend; copy catalog frozen`.

---

