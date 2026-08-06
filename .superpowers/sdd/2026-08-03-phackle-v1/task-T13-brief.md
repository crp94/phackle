### Task T13: Scoring, achievements, share string, storage

**Files:** Create `src/game/scoring.ts`, `src/game/achievements.ts`, `src/game/share.ts`, `src/game/storage.ts`; Test `tests/game/{scoring,achievements,share,storage}.test.ts`
**Depends:** T12, T4. **Master spec:** §2.8, §2.9, §2.11, §5.6.

**Interfaces (produces):**
```ts
export function scoreDay(i: { mode: 'hack' | 'prereg'; dayType: DayType; published: boolean; callCorrect: boolean | null;
  forks: number; stamp: RevealPayload['stamp']; preregSig?: boolean }): { score: number; career: number; breakdown: [CopyKey, number][] };
// exact §2.8 table from SCORING const; parsimony max(0, 40 − 4·forks) only when callCorrect.
export function callIsCorrect(call: 'real' | 'noise', dayType: DayType): boolean;   // real↔effect, noise↔null
export function evaluateAchievements(ctx: { log: PlayerAction[]; published: Spec | null; decisiveTails: boolean;
  history: Record<string, DayRecord>; call: 'real' | 'noise' | null; callCorrect: boolean | null; mode: string;
  stamp: string }): AchievementId[];        // pure; each §2.11 trigger; decisiveTails = p crossed .05 on the tails fork
export function shareString(i: { puzzleNumber: number; log: PlayerAction[]; mode: 'hack' | 'prereg';
  callCorrect: boolean; streak: number; copy: Record<CopyKey, string> }): string;
// §2.9 layout: line1 "P-hackle #N", line2 emoji trail (🧾 prefix if prereg; per-fork emoji via classifyChange map
// 🎯🔪🌗🍴, ➕ peek, then 📄 or 🏳️, " → ⚖️✅|⚖️❌"), line3 "{forks} {forksWord} · {streakWord} {streak}", line4 URL const.
export const SITE_URL = 'https://phackle.carlosrodriguezpardo.es';
// storage.ts — schema §5.6 verbatim + settings.locale?: Locale. localStorage key 'phackle.v1'.
export function loadState(): PersistedState;            // try/catch → in-memory fallback, sets storageOff flag
export function saveDay(iso: string, rec: DayRecord): void; export function loadStats(): PersistedState['stats'];
export function migrate(version: number, data: unknown): PersistedState;   // v1 identity + unknown→fresh
export function streakAfter(history: Record<string, DayRecord>, iso: string): { streak: number; maxStreak: number };
```

**Steps:**
- [ ] **RED** scoring: all 10 §2.8 rows exhaustively + parsimony clamp at 0 (11 forks) + parsimony denied on wrong call. achievements: one test per id trigger + one non-trigger each (harking = ≥3 outcome changes then publish; one_more_batch = 3 peeks; garden = ≥25 distinct; well_actually = published + correct 'noise'; true_detective = 10 consecutive correct from history; monk = 20 prereg days; one_tailed_bandit uses decisiveTails).
- [ ] **RED** share — **spoiler property test**: for 300 random action patterns, build strings for (null-day, correct call) vs (effect-day, correct call): byte-identical; and for wrong-call pairs likewise; parametrize over `AVAILABLE_LOCALES` (extends automatically when T19/T20 land). Emoji count === forks (+ markers); prereg prefix; exact sample from §2.9 reproduced with a scripted log.
- [ ] **RED** storage: round-trip; migrate stub identity; corrupted JSON → fresh state + storageOff flag; streak: consecutive dates increment, gap resets, maxStreak retained; localStorage-throwing mock → memory fallback works.
- [ ] **Verify fail** → **GREEN** → **Verify pass** → **Commit** `feat: scoring, achievements, spoiler-safe share grid, versioned storage`.

---

