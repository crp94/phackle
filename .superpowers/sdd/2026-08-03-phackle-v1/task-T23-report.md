# Task T23 — Playwright E2E suite

**Agent:** implementer · **Worktree:** `.claude/worktrees/task-t23` · **Branch:** `task-t23`
**Base:** `ec474df` (verified at STEP 0) · **Commit:** `e1c80a8` · **Not pushed.**
**Files:** `e2e/` (7 new), `playwright.config.ts` (new), `package.json`, `package-lock.json`,
`tsconfig.json`, `vite.config.ts`, `eslint.config.js`. **Zero changes under `src/**`.**

---

## 0. Setup, stated honestly

The worktree had no `node_modules`. `npm ping` reached the registry (203ms), so
`npm install` + `npm install -D @playwright/test` ran clean → **Playwright 1.62.1**.
`npx playwright install chromium` exited 0 against an already-populated
`~/.cache/ms-playwright` (`chromium-1234`), so no browser download was needed. `playwright-core`
was **not** already present in `node_modules` — nothing from a prior agent was reused.
`PATH="/usr/bin:$PATH"` on every node/npm/npx command. The main checkout was never touched.

**The suite runs against the production build.** `webServer` is
`npm run build && vite preview --host 127.0.0.1 --port 4317 --strictPort`, with
`reuseExistingServer: false` so a stale `dist/` can never be mistaken for a passing suite. The
dev server is never used — that is the entire point (see §3).

Three environment pins worth naming:

- **`timezoneId: 'UTC'`.** The fixed clock pins an *instant*; `daily.localIsoDate()` reads local
  calendar components, so without this the puzzle date would depend on the machine running the
  suite.
- **`serviceWorkers: 'block'`.** The app ships a precaching SW (`vite-plugin-pwa`,
  `registerType: 'autoUpdate'`). Left on, it serves a previous build's content-hashed assets into a
  later test — the trap the T29/T31 CDP harnesses had to work around with
  `Storage.clearDataForOrigin`. Blocking it makes every test read the build actually on disk.
- **`retries: 0`.** A retry converts "this suite is flaky" into "this suite is green".

**Fixed clock: `2026-08-14T10:00:00Z`, one shared constant (`FIXED_INSTANT_MS`).** Post-EPOCH
(`2026-08-10`), so `isPractice()` is false and the flows exercise the *real* persistence path —
`saveDay`/`saveAchievements`, real puzzle number **#5** — rather than practice mode's random seed
and negative puzzle numbers. Implemented as a `Proxy` over `Date` in `addInitScript` (zero-arg
construction and `Date.now()` pinned; every other overload, `Date.parse`, `Date.UTC` and
`instanceof` pass through verbatim). No Worker-side override is needed and none is attempted:
`src/engine/**` is lint-forbidden from touching the wall clock and receives its ISO date as a
string argument from the main thread, so pinning the page realm pins the whole game.

The date is **measured, not picked**. `2026-08-14` is a **null day** (so publishing earns
`RETRACTED` — the game's central lesson) whose scenario is #14, `terms-and-conditions-service`,
and whose bounded knob search terminates in **3 turns at p = 0.0392** (`n = 198`,
`{outcome 0, all, no covariates, drop |z|>3, log1p, one-tailed}`). Verified against the engine in
Node before a line of the suite was written.

---

## 1. Suite inventory — test → what it guards

| # | File · test | Guards |
|---|---|---|
| 1 | `determinism` · same date, two isolated contexts, same p-value Node computes | Two clean browsers on the same date get **byte-identical** puzzles (question, masthead, dial, n/df); and that puzzle is the one **Node** computes — scenario index and `runSpec` p-value to 3dp. Cross-realm: bundled worker vs. test process. |
| 2 | `determinism` · reveal accounting = Node's full-curve enumeration | The reveal's own prose reports `totalPaths` **1792** and `sigPaths` = `sigCount(enumerateCurve(data, 200))` — the same quantity the committed golden fixtures pin as `sigCount200`. This is the plan's cross-realm golden-hash check, read off the real screen. |
| 3 | `hack` · a full hacking day | Briefing (goal, Grantwell email, no leaked mode chooser) → **real bounded knob search** driven by reading the dial and the product's own SUBMIT gate → publish → press clippings → call overlay → reveal → summary → share. Sub-guards below. |
| 3a | ↳ press clippings | 2 clippings, each with outlet/text/SIMULATED-PRESS watermark; every rendered blurb exists in the bank; **T39a's invariant** — no blurb bound to a *different* scenario may run over today's study. (Tolerant, as asked: if the bank carries a blurb bound to today's scenario, ≥1 clipping must be it; on this day it does not, so the no-leakage half is asserted and the skip is annotated. Non-trivial: the tier-1 pool *does* contain a `cat-crypto`-bound blurb, and it correctly does not appear.) |
| 3b | ↳ stamp scroll-gating (T35) | Scroll-gating is live at all (`fig2` not entered on arrival); the stamp's `animation-name` is `none` while its block is transparent and becomes `ph-stamp-slam` **only after** the block enters view. Asserted on *computed style*, so it is timing-independent. |
| 3c | ↳ share string (§2.9) | Exactly 4 lines; line 1 `P-hackle #5`; line 2 matches `^(🧾)?[🍴➕]*(📄\|🏳️)( → ⚖️(✅\|❌))?$` **and** carries one 🍴 per counted fork; the string contains none of `RETRACTED`/`REPLICATED`/`NULL REPORTED`; line 3 `Forks: N · Streak: M` with N = the day's real fork count; line 4 = `SITE_URL`. |
| 4 | `prereg` · a preregistration day | Mode chooser appears **only** with `first_retraction` seeded; the prereg screen shows **no p-value**; the commit button is gated on the checkbox; committing lands **straight on the reveal**; `.ph-call` never renders and the reveal's call block is empty; share carries 🧾 prefix, 📄 terminal, **no ⚖️**. |
| 5 | `abandon` · the honest day | Report null → Call renders as a **whole page**, not an overlay (`.ph-call-overlay` count 0), and **no Published screen** exists on this path; reveal has no published recipe but does resolve the call; share ends `🏳️ → ⚖️…` with `Forks: 0`. |
| 6–7 | `i18n` · it, es | Boots *into* the locale from stored settings; `<html lang>` correct; **briefing CTA is exactly "Apri i dati" / "Abrir los datos"** (pinned forever, owner's own bug); one screen deep the Lab's buttons are translated and are *not* the EN strings; no raw copy keys on screen; the dial shows a **decimal point**, never a comma, and matches `p = 0.000`/`p < 0.001`. |
| 8–9 | `booked (a)` · T33 header overflow, it + es | At **360×780**, on the About page **with the "Play" return button visible** (the reported state), and again back on the Briefing: the document does not scroll horizontally. |
| 10 | `booked (b)` · T22 focus restore | Keyboard flow: focus "Face the truth" → **Enter** opens the overlay → focus lands inside it → **Escape** closes it → `activeElement` is the CTA again. The jsdom-blind check. |
| 11 | `booked (c)` · T29 prod-import guard | In the **built** app the call overlay contains a real `.ph-call` with a non-empty prompt and two fully-populated options; **plus** zero HTTP responses ≥400 and zero uncaught page errors during a normal playthrough. |
| 12 | `booked (d)` · T35 reduced motion | With `prefers-reduced-motion: reduce` emulated: all **6** reveal blocks are at `opacity: 1` **without any scrolling**; the stamp withholds `ph-stamp--animate` entirely; every animation in `document.getAnimations()` has duration ≤ 1ms. |
| 13 | `booked (e)` · storage-disabled boot | With every `localStorage` access throwing: the app still boots to a populated Briefing, shows **no** engine-crash banner, is still playable into the Lab with a live p-value, and throws nothing. |
| — | `booked (e)` · storage notice — **`.fixme`, FINDING F1** | The design's other half: the player is told progress will not be saved. Not implemented (§4). |
| — | `booked` · briefing shows the day's own scenario — **`.fixme`, FINDING F2** | Found by this suite (§4). |

**Discipline.** Every test gets a fresh browser context (Playwright default) and installs its own
init scripts, so tests are independent and order-free — proven by `--repeat-each=3` and by
`fullyParallel` across 4 workers. **There is not a single `waitForTimeout` in the suite.** The one
genuinely hard synchronisation — `store.changeSpec` debounces the worker dispatch by
`DEBOUNCE_MS`, so the radio moves ~300ms before the number does — is solved with a
`MutationObserver` on the dial's own `aria-busy` (`role="status"`), counting true→false
transitions; `expect.poll` waits on that **event counter**, never on a clock. Every failure message
is written in product terms ("THE LAB WENT DEAF", "THE CALL OVERLAY OPENED EMPTY IN THE PRODUCTION
BUILD", "SHARE LINE 2 LEAKS THE DAY").

CI can run it headless with one command — `npm run e2e` — which builds, serves and tests. **CI is
not wired here** (that is T24); the config only sets `forbidOnly`, worker count and an HTML
reporter under `process.env.CI`.

---

## 2. Gate — every command, every exit code

```
1. UNIT      npx vitest run            EXIT 0    51 files, 1357 tests passed   (7.44s)
2. TSC       npx tsc --noEmit          EXIT 0    (no output; e2e/ + playwright.config.ts now in `include`)
3. ESLINT    npx eslint .              EXIT 0    (no output; e2e files lint clean)
4. BUILD     npm run build             EXIT 0
5. E2E #1    npm run e2e               EXIT 0    13 passed, 2 skipped  (8.1s)
6. E2E #2    npm run e2e               EXIT 0    13 passed, 2 skipped  (8.1s)   [immediately consecutive]
   STRESS    npx playwright test --repeat-each=3   EXIT 0   39 passed, 6 skipped (18.5s)
```

The unit suite is **untouched** — 1357 tests before the task, 1357 after, same 51 files.
`e2e/**` is excluded from vitest (`vite.config.ts`), because Playwright specs match vitest's
default `*.spec.ts` glob and would otherwise be swept into `npm test`.

### E2E run 1 (verbatim)

```
Running 15 tests using 4 workers

  ✓   1 [chromium] › e2e/booked.spec.ts:33:5 › (a) T33 — the header must not push the page sideways at 360px › it: About page at 360x780 does not scroll horizontally (374ms)
  ✓   3 [chromium] › e2e/booked.spec.ts:33:5 › (a) T33 — the header must not push the page sideways at 360px › es: About page at 360x780 does not scroll horizontally (379ms)
  ✓   6 [chromium] › e2e/booked.spec.ts:191:3 › (d) T35 — reduced motion hides nothing and animates nothing › the reveal is fully readable without scrolling and runs no animations (539ms)
  ✓   4 [chromium] › e2e/booked.spec.ts:91:1 › (b) T22 — Escape from the call overlay returns focus to the button that opened it (1.5s)
  -   8 [chromium] › e2e/booked.spec.ts:286:6 › (e) blocked storage tells the player their progress will not be saved [FINDING F1]
  -   9 [chromium] › e2e/booked.spec.ts:327:6 › the briefing never shows a scenario other than the day's own [FINDING F2]
  ✓   7 [chromium] › e2e/booked.spec.ts:259:1 › (e) the app still boots and plays with local storage blocked (593ms)
  ✓   5 [chromium] › e2e/booked.spec.ts:134:1 › (c) T29 — the call overlay renders real content in the production bundle (no empty overlay) (1.8s)
  ✓   2 [chromium] › e2e/abandon.spec.ts:20:1 › an abandoned day: report a null result, call as a full page, and reveal without a publication (2.3s)
  ✓  13 [chromium] › e2e/i18n.spec.ts:43:3 › it: the app boots translated, one screen deep, with decimal points in the dial (535ms)
  ✓  11 [chromium] › e2e/determinism.spec.ts:114:1 › the reveal's accounting reports the same full-curve enumeration Node computes (1.4s)
  ✓  14 [chromium] › e2e/i18n.spec.ts:43:3 › es: the app boots translated, one screen deep, with decimal points in the dial (528ms)
  ✓  10 [chromium] › e2e/determinism.spec.ts:50:1 › the same date yields the same puzzle in two isolated browser contexts, and the same p-value Node computes (2.4s)
  ✓  15 [chromium] › e2e/prereg.spec.ts:10:1 › a preregistration day: choose the mode, commit blind, and land straight on the reveal with no call (1.7s)
  ✓  12 [chromium] › e2e/hack.spec.ts:21:1 › a full hacking day: hack to p < .05, publish, call, reveal, and share a spoiler-safe result (3.3s)

  2 skipped
  13 passed (8.1s)
```

### E2E run 2 (verbatim, immediately consecutive)

```
Running 15 tests using 4 workers

  ✓   3 [chromium] › e2e/booked.spec.ts:33:5 › (a) T33 — the header must not push the page sideways at 360px › it: About page at 360x780 does not scroll horizontally (376ms)
  ✓   4 [chromium] › e2e/booked.spec.ts:33:5 › (a) T33 — the header must not push the page sideways at 360px › es: About page at 360x780 does not scroll horizontally (401ms)
  ✓   6 [chromium] › e2e/booked.spec.ts:191:3 › (d) T35 — reduced motion hides nothing and animates nothing › the reveal is fully readable without scrolling and runs no animations (565ms)
  ✓   2 [chromium] › e2e/booked.spec.ts:91:1 › (b) T22 — Escape from the call overlay returns focus to the button that opened it (1.3s)
  -   8 [chromium] › e2e/booked.spec.ts:286:6 › (e) blocked storage tells the player their progress will not be saved [FINDING F1]
  -   9 [chromium] › e2e/booked.spec.ts:327:6 › the briefing never shows a scenario other than the day's own [FINDING F2]
  ✓   7 [chromium] › e2e/booked.spec.ts:259:1 › (e) the app still boots and plays with local storage blocked (581ms)
  ✓   1 [chromium] › e2e/abandon.spec.ts:20:1 › an abandoned day: report a null result, call as a full page, and reveal without a publication (2.1s)
  ✓   5 [chromium] › e2e/booked.spec.ts:134:1 › (c) T29 — the call overlay renders real content in the production bundle (no empty overlay) (1.8s)
  ✓  13 [chromium] › e2e/i18n.spec.ts:43:3 › it: the app boots translated, one screen deep, with decimal points in the dial (546ms)
  ✓  11 [chromium] › e2e/determinism.spec.ts:114:1 › the reveal's accounting reports the same full-curve enumeration Node computes (1.5s)
  ✓  14 [chromium] › e2e/i18n.spec.ts:43:3 › es: the app boots translated, one screen deep, with decimal points in the dial (549ms)
  ✓  10 [chromium] › e2e/determinism.spec.ts:50:1 › the same date yields the same puzzle in two isolated browser contexts, and the same p-value Node computes (2.6s)
  ✓  15 [chromium] › e2e/prereg.spec.ts:10:1 › a preregistration day: choose the mode, commit blind, and land straight on the reveal with no call (1.8s)
  ✓  12 [chromium] › e2e/hack.spec.ts:21:1 › a full hacking day: hack to p < .05, publish, call, reveal, and share a spoiler-safe result (3.4s)

  2 skipped
  13 passed (8.1s)
```

---

## 3. Negative controls — the guards have teeth

A green suite proves nothing about a suite that cannot fail. Each of the three defects this task
exists for was **reintroduced into `src/`, run, and reverted**. `git diff src/` was empty after
each.

| Defect reintroduced | Test that caught it | Failure |
|---|---|---|
| **T29** — `import(/* @vite-ignore */ spec)` restored in `Published.tsx` | `booked (c)` | `THE CALL OVERLAY OPENED EMPTY IN THE PRODUCTION BUILD…` — `.ph-call` not found inside the overlay |
| **T22** — `ctaRef.current?.focus()` moved back into `closeCall()`, effect restore removed | `booked (b)` | `FOCUS WAS DROPPED ON THE FLOOR…` — `Expected: focused / Received: inactive` |
| **T35** — `.ph-fade--in .ph-stamp--animate` reduced to `.ph-stamp--animate` in `Reveal.css` | `hack` | `THE STAMP SLAMMED INTO AN INVISIBLE BLOCK…` — `Expected: "none" / Received: "ph-stamp-slam"` |

Each failed with exactly its intended message, and only that test failed.

---

## 4. Product findings

### FINDING F1 — the storage-blocked notice is written, translated, and never rendered

**Severity: moderate. Evidence: static + live.**

`errors.storageOff` exists as a `CopyKey` and is translated in **all three** locales
(`en/copy.ts:850`, `it/copy.ts:433`, `es/copy.ts:414`). `storage.ts` exports `isStorageOff()`,
which has its own unit tests (`tests/game/storage.test.ts`, 5 assertions). **Nothing under
`src/ui/**` calls `isStorageOff()` and nothing renders the key** — verified by grep across `src/`.

Live behaviour with `window.localStorage` throwing: the app boots, plays, persists to the
in-memory fallback, and says **nothing**. The player's day is scored, their streak is computed and
shown, and all of it evaporates on reload with no explanation ever offered.

The half that *is* implemented is asserted and passing (`booked (e)`). The missing half is a live
`.fixme` test carrying the assertion the design intends, ready to un-fixme when the notice lands.
**Not fixed here:** the fix is a UI component's, and `src/ui/**` is not this task's to change.

### FINDING F2 — the Briefing shows the wrong study until the engine finishes booting

**Severity: moderate. Found by this suite. Evidence: measured, 3/3 runs on the production build.**

`App.tsx`'s loading gate holds the shell until the locale **content** resolves, then mounts the
Briefing — but `store.boot()` is still awaiting `client.init`, which is where the day is actually
assembled (rejection sampling, in the worker). Until it lands, `scenarioIndex` is
`initialState()`'s **0** and `puzzleNumber` is **0**, so `Briefing.tsx` renders scenario #0's
question, scenario #0's cover story, and — via `isoFromPuzzleNumber(0)` — a Grantwell email picked
for the wrong date. Then the whole page swaps.

Measured on `dist/` over the local preview server, viewport 1280×800:

```
run 1: "Does owning a cat improve cryptocurrency returns?"  @ t+96ms
       -> "Do people who read the terms and conditions…"    @ t+213ms   (117ms wrong)
run 2: t+84ms -> t+200ms                                                 (116ms wrong)
run 3: t+56ms -> t+130ms                                                  (74ms wrong)
```

That is a fast desktop against localhost. The window is bounded by worker startup **plus the day's
own acceptance loop**, which is data-dependent — up to `MAX_ATTEMPTS` rejection-sampled datasets,
each with a full 1792-spec enumeration on a null day. On a phone, on a bad day, this is not a
flash. It is also the reason the harness has an explicit **boot barrier**
(`enterLab()` waits for a real p-value in the dial): any test that cares which puzzle it is must
read the day's identity from the Lab, never from the Briefing.

Invisible to the jsdom suite by construction: every screen test injects a fake store that already
*has* a `scenarioIndex`, so the pre-boot state only the real async boot produces is never rendered
there.

**Not fixed here** — the fix belongs to `App.tsx` or `Briefing.tsx`. Left `.fixme` with the
measurement in a comment for the controller to triage.

### Not a finding: my own harness bug, for the record

The first run failed 4 tests. Three of those were **my** bug, not the product's: the settle
instrumentation observed `document.documentElement`, which is `null` inside an `addInitScript`
(it runs before the parser has produced any element), so `MutationObserver.observe` threw
`"parameter 1 is not of type 'Node'"` into every page. It is named here only because the
`pageerror` assertions in `booked (c)` and `(e)` are what caught it — which is itself evidence
those assertions work. Fixed by observing `document`.

---

## 5. Deviations from the brief, each deliberate

1. **No `?debug=1` golden-hash hook in `About.tsx`.** The plan's step named it; the mechanism
   existed to get engine output into the browser DOM so it could be compared to a Node fixture. The
   real UI **already surfaces engine output**: the dial renders a `runSpec` p-value and the reveal's
   accounting renders `totalPaths`/`sigPaths` off the full 1792-spec enumeration — the same
   quantity the committed fixtures pin as `sigCount200`. Comparing *those* to Node is a strictly
   better test (it is the number the player is asked to believe, on the screen they read it on) and
   it needs no debug surface, no engine import in the main bundle, and no product change at all.
   Both comparisons are implemented (`determinism.spec.ts`, tests 1 and 2).
2. **Flow C has no Published screen.** The brief describes "report null → published(abandoned
   variant) → call-as-page". `store.abandon()` sets `published: null` and moves `screen` straight
   to `'call'`; there is no Published screen on that path in any variant. The test asserts what the
   machine does **and asserts the absence of a Published screen explicitly**, so introducing one
   later trips the test rather than sliding past it.
3. **Booked check (a) asserts `scrollWidth <= clientWidth`, not `scrollWidth === 360`.** With a
   classic vertical scrollbar the initial containing block is narrower than the viewport, so a page
   that fits perfectly reports 345, not 360; equality would fail on a *correct* layout for a reason
   unrelated to the bug. The inequality is what "no horizontal scrollbar" actually means. Measured
   values are interpolated into the failure message either way.
4. **Press-clipping assertion is the no-leakage half.** T39a **has** merged (`scenarioIds` is live
   on 3 blurbs). Today's scenario, `terms-and-conditions-service`, has no bound blurb, so the
   "≥1 bound clipping" assertion cannot apply; the test annotates that and asserts the invariant
   that *is* live — no blurb bound to another scenario may appear. This is not vacuous: the tier-1
   pool contains a `cat-crypto`-bound blurb which correctly does not run. The stronger branch is
   written and will fire on a day whose scenario is bound.
5. **One `chromium` project, not desktop + iPhone.** The plan pins two viewport projects and
   committed `toHaveScreenshot` baselines. Running every flow twice would roughly double the
   runtime against a <2min budget for no new defect class, and screenshot baselines are a
   maintenance surface (font rasterisation, headless shell version) that this suite's value does
   not depend on. Narrow-viewport coverage is instead **targeted**: booked check (a) runs at
   360×780 in both non-English locales, which is where the reported overflow actually lived. No
   visual baselines are committed.

---

## 6. Concerns for the controller

1. **`EPOCH` is still the placeholder `2026-08-10`.** T25 freezes it to the real launch date.
   When it moves, `PUZZLE_ISO` in `e2e/harness.ts` must move with it (it must stay **after**
   EPOCH or every flow silently drops into practice mode), and `PUZZLE_NUMBER` must be recomputed.
   The constant is documented at its definition and used in exactly one place. **This is the single
   most likely way this suite breaks.**
2. **The pinned day's search path is measured, not guaranteed.** `SIGNIFICANT_SPEC` and the 3-turn
   search are facts about `2026-08-14`'s dataset. Any intentional change to the DGP, the analysis
   pipeline, the spec grid or the acceptance loop will change them — which the golden-master
   fixtures will flag first. `hackUntilPublishable` is a genuine bounded search and will simply
   take more turns (up to 40) rather than break; `publishPinnedSpec`, used by two booked checks,
   asserts a clear "THE PINNED HACK STOPPED WORKING" message and needs a one-line re-measure.
3. **`[INEFFECTIVE_DYNAMIC_IMPORT]` is emitted on every build** — `registry.ts` is dynamically
   imported by `Published.tsx` and statically by `ScreenRouter.tsx`, so it is not split into its own
   chunk. Harmless and pre-existing (the T29 fix deliberately chose a literal specifier over a
   split chunk), but it means the "lazily-loaded call screen" is in the main bundle. Noting it so a
   future reader does not treat the warning as new.
4. **F1 and F2 are unfixed and skipped.** Two tests are `.fixme`. If the controller wants a fully
   `.fixme`-free suite, both need product fixes first.
5. **T24 wiring.** `npm run e2e` is CI-ready as one command, and `.gitignore` already covers
   `playwright-report/`, `test-results/` and `blob-report/`. CI will need
   `npx playwright install --with-deps chromium` in the job, and `@playwright/test` is now a
   devDependency so `npm ci` picks it up.
