# GR1b findings — game + UI code lane

Lane: GR1b (src/game/** + src/ui/** as one system). Reviewed at build/v1 7e417f4 (read-only).
Agent's file write was blocked; findings persisted verbatim by the controller from the lane reply.

**Gate (run once, first): GREEN** — `typecheck` 0 · `lint` 0 · `npm test` **53 files / 1494 tests passed** · `build` 0.

**Findings: 0 blocker · 8 high · 17 polish · 1 verification record (26 total).**

**Bundle numbers** (measured `gzip -c | wc -c`, not Vite's rounded column):

| | raw | gz |
|---|---|---|
| **main chunk** `index-DPwlAP54.js` | 268,873 | **82,248** (80.3 KB) |
| CSS | 46,026 | 6,381 |
| worker | 17,416 | 7,021 |
| **en** | 46,521 | **17,025** |
| **it** | 52,000 | **18,530** |
| **es** | 52,532 | **18,732** |

**EN critical path = 107,543 B gz (105.0 KB)**; +worker = 111.9 KB; +the 3 latin font subsets EN actually uses (55,110 B, incompressible) = **≈167 KB**. **Under the 200 KB budget.** Locale isolation is correct *on the network path* — but see gr1b-020.

**Consolidation shape (3 sentences).** Declare ~5 composite utility classes **once in `src/ui/App.css`** — `.ph-focusable` (R6.1's ring, replacing 22 blocks), `.ph-label` (20), `.ph-page` + `--titled` (4 spellings), `.ph-close` (3), `.ph-entered` (3 names) — composed by multi-class `className` at the call site, with **no `@apply`, no preprocessor, no new tokens and no changed values**. This is the right shape here because `App.css` is already the de-facto global sheet (it hosts `.ph-visually-hidden` and `.ph-seg`), and because it makes DESIGN.md §10's tier-C greps *sharper* rather than weaker: R6.1 becomes a single-rule assertion instead of a 22-way read, and `motion.test.ts`'s R5.6 restorer-association check collapses to one class name. The churn is bounded and mechanical — stylesheets only lose rules, `.tsx` files only gain a class token — but the `.ph-entered` rename touches names R5.2/R5.6 state in prose, so **DESIGN.md is edited first in a commit of its own** (its own rule), or that one item is dropped and the other four ship.

---

## Full findings

### 1. Store / screen seams

### [gr1b-001] `makeCall` is the one async action with no `requestSeq` guard and no `catch` · **high** · **S** · confirms **final-007**
`src/game/store.ts:324-338`. The store's contract at `:203-207` says the last-dispatched call "owns" the next state update; `boot`(`:222,236,239`), `peekAndExtend`(`:280,283,292`), `submit`(`:303`), `abandon`(`:316`), `preregCommit`(`:356,371,376,379`) all honour it. `makeCall` has no `myReq`, no staleness check before its unconditional `set({ reveal: payload, screen: 'reveal' })`, no `try/catch`, no `pending` conjunct. **Reachable:** `Call.tsx:31` guards double-tap with an `inFlight` **ref** — but the ref lives on a component `Published.tsx` mounts and unmounts. Press "It's real" → `Escape` (`Published.tsx:328` → `closeCall()` → `Call` unmounts, ref destroyed) → "Face the truth" again → remount with fresh `inFlight === false`; `screen` is still `'published'`, so a **second `CALL` entry and a second `client.reveal` RPC** (the most expensive engine op) dispatch. Damage bounded today — same payload, and `share.ts:110-111` ignores `CALL`. **Fix:** the sibling shape verbatim (`const myReq = ++requestSeq` before, `if (myReq !== requestSeq) return` after) plus an in-flight conjunct as `preregCommit:352` already has. Keep `Call.tsx`'s ref — it stops the *button* flashing; the store guard keeps the *state* honest.

### [gr1b-002] A rejected RPC strands `pending: true` forever in `peekAndExtend`/`preregCommit`, with no error surface · **high** · **S**
`store.ts:272-294`, `:349-427`, `Prereg.tsx:52-66`, `engineClient.ts:53,69-79`. Only `boot`'s catch (`:250`) and `commitSettledSpec`'s (`:463`) set `error`. **Prereg:** `void preregCommit(spec)` (`Prereg.tsx:65`) discards the rejection (no `unhandledrejection` handler exists anywhere in `src/` or `index.html`), `submitting`+`pending` stay `true`, and `store.ts:352`'s `|| s.pending` then rejects every retry — a hard dead-end on a whole game mode. **Lab:** `pending` stuck true ⇒ `canCollectMore` and `canSubmit` both false (`Lab.tsx:71-73`); Collect and Submit dead for the day, dial `aria-busy` forever, only "Report a null result" works. **Fix:** wrap both as `commitSettledSpec:459-466` does; correct `Prereg.tsx:55-64`'s comment. Durable version: one `withEngineErrors(myReq, fn)` helper used by all four awaiting actions.

### [gr1b-003] Negative `puzzleNumber` pre-EPOCH ⇒ negative array index kills the retraction subline · **high** · **S**
`Reveal.tsx:235-238`, `daily.ts:27-29`, `tuning.ts:6`. Probed against the real modules: `today=2026-08-06 · EPOCH=2026-08-10 · isPractice=true · puzzleNumber=-3 · fakeDoi=10.1337/phk.-3 · sublines len=14 · -3%14=-3 · picked=undefined`. JS `%` keeps the dividend's sign, so `-3 % 14 === -3` and the lookup is `undefined`: **§4.5's entire 14-line retraction-subline bank is dead on every RETRACTED day before EPOCH** — silently, because `Stamp.tsx:11` types `subline?: string`. Same cause: `"10.1337/phk.-3"` on the journal cover (`published.ts:81-83`) and "Vol. 1, No. **-3**" in the header (`App.tsx:196-198`) and the Reveal cover echo (`Reveal.tsx:298-300`) — the parked A4 item, confirmed live at a different value than the ledger recorded. **Fix:** `((n % len) + len) % len` at `Reveal.tsx:237` (grep `puzzleNumber %` before closing), plus the `gr1b-004` decision, which makes it unreachable.

### [gr1b-004] Practice mode is invisible in the UI, and its share string is indistinguishable from a real one · **high** · **M** · closes A4's parked item
`daily.ts:31-35`, `App.tsx:126-131`, `Summary.tsx:399,408`, `share.ts:168-179`. Full sweep of `grep -rn practice src/`: `practice` reaches only the seed and `Summary.tsx:408`'s persistence guard. **No component anywhere reads `s.practice` to render anything.** `shareString` takes no practice input, so a practice day emits `P-hackle #-3` today and — post-launch via `?practice=1`, which stays live forever — an ordinary-looking `P-hackle #12` no viewer can distinguish from a real day. The share grid is the product's whole distribution surface. **Fix (controller — touches presentation GR3 owns):** a `--muted` practice marker beside `ph-header__vol` reading `s.practice`, plus a `practice: boolean` on `shareString` swapping line 1 — **not** derived from day content, so the spoiler property test is unaffected by construction. Structural alternative: practice days carry no daily number at all, which also closes gr1b-003.

### [gr1b-005] A practice day's Summary shows a streak counting a day it never saves · **polish** · **S**
`Summary.tsx:385-391`. `historyForStreak` branches on `alreadySaved` only, so the synthetic today-placeholder is inserted on a practice day and `streakAfter` counts it — but `:408`'s `!practice` guard then skips `saveDay`. Invoice shows `N+1` where storage holds `N`, and that number is embedded in `shareText` at `:399`. **Fix:** `alreadySaved || practice ? state.history : {...}`.

### [gr1b-006] A failed reveal re-enables the Call buttons with no message; each retry appends another `CALL` · **polish** · **S**
`Call.tsx:42-53`, `store.ts:331-334`. `Call.tsx:46-52` deliberately resets `busy` on rejection and delegates the error surface to the shell — which per gr1b-002 does not light. And `makeCall` appends `CALL` *before* the `await`, so every retry appends another. Harmless downstream today (`share.ts:110-111`; the log isn't persisted — `storage.ts:315-334` stores only mode/score/forks/callCorrect/stamp/shareString). **Fix:** move the append into the same `set` as `reveal`/`screen`, making the action atomic.

### [gr1b-007] `isStorageOff()` is read during render — a non-reactive external store · **polish** · **S**
`App.tsx:246`, `storage.ts:91-96,135-138`. Module-level mutable `let` read in a render body. The ordering does work today — `LocaleProvider`'s lazy initialisers (`:94-96,123`) call `loadState()` during the *outermost* component's first render, so the flag is settled before `App`'s body runs (checked specifically; the notice would otherwise miss the Briefing). Still the textbook React-19 tearing shape, and "renders constantly" is a property of today's call graph, not an invariant. **Fix:** `useSyncExternalStore`, or `useState(() => isStorageOff())` + a re-read in the boot effect.

### 2. Component hygiene

### [gr1b-010] `Dots` IS memoized — final-015's first half is SATISFIED, do not re-flag · verification record
`SpecCurve.tsx:400`: `const Dots = memo(function Dots({ placed, published }: ...)`, with T29 pin 7's rationale at `:387-399` explaining the ~1,792-circle reconciler cost removed and why `placed` being a `useMemo` over `(points, grouped, geom)` makes the boundary sound. Full `src/ui` memoization inventory: `SpecCurve.tsx:400,463,467` · `DataCut.tsx:353,356` · `CoefPlot.tsx:72` · `Reveal.tsx:181`. Whatever final-015's *second* half is, it is not this.

### [gr1b-008] The app's one persistence moment lives inside a screen component file · **polish** · **M**
`Summary.tsx` (545 lines) holds three things: presentational `Summary` (`:93-232`), `SummaryScreen` (`:465-545`), and `persistAndComputeSummary` (`:361-459`) — "the one place in the app that actually persists it (§5.6)" by its own comment at `:296`. It calls `saveDay`/`saveAchievements`/`unlockAchievements`/`scoreDay`/`shareString`/`streakAfter`, owns the durable idempotency guard, and needs an eslint waiver at `:360` to exist there. Its 64-line comment is load-bearing persistence-layer documentation filed under `src/ui/screens/`. `src/game/dayComplete.ts` already exists and already owns `unlockAchievements`, which it calls. **Fix:** move the function + its two interfaces there; pure relocation, it is already framework-free.

### [gr1b-009] Three store-access idioms across seven screens · **polish** · **S**
`Briefing.tsx:19-28`, `Prereg.tsx:19-30`, `Published.tsx:37,185-192` take an injectable `useStore?`; `Lab`, `Call`, `Reveal`, `Summary` read the singleton. `UseGameStore` is declared **twice identically** (`Briefing.tsx:19`, `Published.tsx:37`) and `Prereg.tsx:19` imports it *from a sibling screen*. `Published` carries a third seam, `loadCallScreen?`. The split tracks nothing — `Summary` reads the singleton and has the most state to fake. **Fix:** hoist `UseGameStore` to `store.ts` (where `GameStore` lives), delete both duplicates and the screen-to-screen import. Do not remove the seam — three suites depend on it.

### [gr1b-011] `SpecCurve.tsx`/`DataCut.tsx` are geometry modules with a component stapled on · **polish** · **M**
686 and 555 lines — outliers for a structural reason, not component growth. `SpecCurve` exports 15 pure functions/constants (`geometryFor:141` … `wrapLabel:375`) before its component at `:444`; ~65% is a pure layer, exported *because* separately unit-tested. `DataCut` is identical in shape (`cutGeometryFor:144` … `placeCut:324`, component `:349`). **Fix (optional):** split each into `<name>Geometry.ts` + `<Name>.tsx`. Flagged so a reviewer looking for "component too big" doesn't mis-diagnose them.

### 3. CSS coherence

### [gr1b-012] Five copy-pasted dialects; one utility layer fixes them · **high** · **M** · confirms **final-009**
All counts re-derived (note: **25** CSS files under `src/ui`, 355 selectors / 1,456 declarations — not 13; 13 is the count of files containing `:focus-visible`):

| Dialect | Count | Verification |
|---|---|---|
| focus ring | **22** | `grep -rn "outline: var(--focus-ring)" src/ui --include=*.css \| wc -l` |
| uppercase label | **20** | all 20 paired with `letter-spacing: var(--tracking-label)` — consistent, just repeated |
| close button | **3** | `.ph-about__close`(About.css:94,107,111) · `.ph-legend__close`(Legend.css:62,74,78) · `.ph-stats__close`(Stats.css:200,213,217) |
| page shell | **4 spellings** | ↓ |
| entered flag | **3 names** | `ph-fade--in` · `ph-clipping--in` · `ph-summary__unlock-item--in` |

Page-shell: (1) `padding: var(--space-24)` — `.ph-about:4`, `.ph-legend:4`, `.ph-stats:7`, `.ph-summary:5`, `.ph-lab:10`; (2) `padding: var(--space-40) var(--space-24) var(--space-24)` — `.ph-briefing:3`, `.ph-prereg:5`; (3) `padding-block/-inline` split — `.ph-reveal:22`; (4) `padding: var(--space-40) var(--space-24)` — `.ph-call:18`. Spellings 2/3/4 all mean "40 above, 24 around" and disagree on the bottom — a difference nothing in DESIGN.md distinguishes. **Why it matters under this project's regime:** §10 decides rules by "a test, a grep, or a look at the diff", and an idiom retyped 22 times defeats all three — the tier-C grep returns 22 hits checkable only by reading 22 rules, and one drifting rule is invisible. **Fix:** the consolidation shape in the summary above.

### [gr1b-013] 10 classNames are shipped in the DOM with no CSS rule at all · **high** · **S**
Verified: each has **0** matching rules across all 25 stylesheets. `ph-lab__footnote--armitage`(`Lab.tsx:150`) · `ph-speccurve__dot`(`SpecCurve.tsx:407,419,432`) · `ph-speccurve__dots`(`:402`) · `ph-speccurve__key-dot`(`:662,668,678`) · `ph-seg__flag`(`App.tsx:359`) · `ph-seg__code`(`App.tsx:362`) · `ph-email__value`(`EmailCard.tsx:21,25`) · `ph-about__version`(`About.tsx:74`) · `ph-datacut__excluded`(`DataCut.tsx:440`) · `ph-datacut__label-name`(`DataCut.tsx:512`). **`ph-lab__footnote--armitage` is the sharp one:** a BEM modifier with no rule, so the two peek footnotes Lab.css's comment says are differentiated ("sincere after the 1st peek, the sanctioned Act-I wink after the 2nd") render **identically**. *(Converse checked and clean: all 263 defined class names have a real consumer — including the four built by concatenation at `PValueDial.tsx:210`, `` `ph-dial ph-dial--${band}` ``. Zero orphan rules.)* **Fix:** style `--armitage` or drop the modifier and its comment's claim; delete or implement the other nine.

### [gr1b-014] Six `@keyframes` names, two actual animations · **polish** · **M** · DESIGN.md-gated
Verified byte-identical bodies. `opacity 0→1 + translateY(6px)→0`: `ph-screen-enter`(App.css:42) · `ph-block-enter`(Reveal.css:55) · `ph-clipping-enter`(Published.css:100) · `ph-unlock-enter`(Summary.css:199). `…translateY(2px)→0`: `ph-popover-enter`(ForkTrail.css:97) · `ph-toast-enter`(Summary.css:119). R5.3's two pinned distances retyped as literals in six places. **Honest counter-argument:** R5.2 names each site by its own `@keyframes` identity, and distinct names are self-documenting per site. Collapsing to `ph-enter-scene`/`ph-enter-quick` **is** still safe for `motion.test.ts` (its pairs are `(file, identity)`, so a new unlisted `ph-enter-scene` in `Lab.css` still fails) — but it requires editing four rows of R5.2's Motion column first. Controller's call; batch it with gr1b-012's DESIGN.md commit or skip it.

### [gr1b-015] The 9-declaration button-reset body is byte-identical in 4 files, with 5 drifting variants and 2 incompatible disabled idioms · **polish** · **M**
Identical (`font-family/--font-ui`, `--text-15`, `--leading-ui`, `--ink`, `background:none`, `border-style:none`, `border-block-end: 2px solid transparent`, `padding: var(--space-12) var(--space-16)`, `cursor:pointer`): `App.css:226 .ph-seg` · `RadioGroup.css:21 .ph-radio` · `Legend.css:62 .ph-legend__close` · `Summary.css:85 .ph-summary__share-button`. Same +`margin-block-start`: `About.css:94` ≡ `Stats.css:200`. Drifting: `Summary.css:269`(`--muted`/`not-allowed`) · `Lab.css:145`(drops `line-height`) · `ForkTrail.css:52`(`--text-13`/`--muted`/uppercase) · `Lab.css:124` (writes `padding: … var(--space-16)` then `padding-inline-start: 0` on the very next line). The reset triple appears in **16 rules / 12 files**; `Call.css:68-69` is the lone spelling outlier (`border-inline: 0` and `background: var(--paper)` on a button). Two disabled-hover idioms coexist **35 lines apart in Lab.css**: `:disabled:hover{text-decoration:none}` (`RadioGroup.css:48`, `Lab.css:171`, `Briefing.css:102`) vs `:hover:not(:disabled)` (`Lab.css:206`, `Prereg.css:92`). **Fix:** folds into gr1b-012's `.ph-close`/`.ph-focusable` batch; pick one disabled idiom.

### [gr1b-016] One affordance, two underline offsets · **polish** · **S**
Bare `:hover{text-decoration:underline}` in **11 rules / 10 files** (App.css:239, RadioGroup.css:34, About.css:107, Briefing.css:87, Lab.css:157,232, Legend.css:74, Published.css:303, Reveal.css:267, Stats.css:213, Summary.css:97; `ForkTrail.css:68` drifts to `color:var(--ink)`), versus `underline + text-underline-offset: 2px` in 5 rules / 5 files (App.css:133, ForkTrail.css:52, About.css:88, Call.css:92, Lab.css:124). R6.2 names 2px; the same hover lands at two vertical offsets depending on screen. **Fix:** one rule in the utility layer.

### [gr1b-017] `Stamp.css` has three self-cancelling `fill` pairs · **polish** · **S**
`Stamp.css:34-39` sets `fill: var(--sig-red)` on a grouped selector, then `:41-43` immediately overrides the same selector with `fill: none`. Repeated verbatim for `--ink`(`:45-50`→`:52-54`) and `--green`(`:58-63`→`:65-67`). Six rules doing three rules' work; the grouped selector sets a property it must undo for one of its three members. **Fix:** ungroup.

### [gr1b-018] `Published.css`: 7 blocks, the only same-specificity redefinition, and the only media-before-base hazard · **polish** · **M**
340 lines / 30 selectors defining `ph-published`, `ph-altmetric`, `ph-press-list`, `ph-press-card`, `ph-chyron`, `ph-clipping`, `ph-call-overlay` — four unrelated components that are files elsewhere in this tree. `.ph-chyron__watermark` is defined **twice at equal specificity** (`:162` grouped `margin: var(--space-12) 0 0`; `:276` `margin: 0`) with no media query between — source order alone decides. And `@media (min-width: 768px)` at `:219-242` defines `.ph-chyron__text`(`:233`)/`__strap`(`:238`) **before** their base rules at `:248`/`:258`; media queries add no specificity, so any future `font-size` in the media block would be silently dead. **Fix:** split the file; dedupe the watermark; move the media block after its bases. *(`!important`: zero occurrences corpus-wide. Exactly one 3-level descendant: `Reveal.css:221`.)*

### [gr1b-019] Naming deviations · **polish** · **M**
Abbreviation mismatches inside one file: `Stats.css` has `.ph-stats__histogram`(:112) with children `__hist-row/-label/-bar/-count`(:119,127,142,148), and `.ph-stats__achievements`(:157) with children `__ach-name/-mark/-citation/-locked`(:172,180,185,193). Compound-word convention undecided: squashed `ph-speccurve`/`ph-datacut` vs hyphenated `ph-coef-plot`/`ph-fork-trail`/`ph-journal-cover`/`ph-glyph-mark`/`ph-press-card`/`ph-spec-controls`/`ph-call-overlay`/`ph-storage-notice`. Modifier with no block: `.ph-clipping--in`(`Published.css:117`) has **no `.ph-clipping` rule** and is applied to two different blocks (`Published.tsx:142,170`). Cross-file reach-in: `Briefing.css:62` styles EmailCard's block; `Reveal.css:217,221` reach into Stamp's; `SpecControls.css:14` styles `ph-spec-group`, which `RadioGroup.css` owns — **that block is split across two files**. 10 of 24 files define a block that isn't their name. **Fix:** low-risk subset only — the two abbreviation mismatches and the `ph-spec-group` ownership split; leave the rest, renames here are pure churn.

### 4. Bundle

### [gr1b-020] The PWA precache undoes the locale split and precaches no fonts · **high** · **S**
`dist/sw.js`'s manifest: `registerSW.js · index.html · assets/worker-*.js · assets/it-D0RyspsC.js · assets/index-*.css · assets/index-*.js · assets/es-C2jvNUEs.js · assets/en-DabwAVHX.js · pwa-192/512.png · manifest.webmanifest` (11 entries, 476.13 KiB). Wrong in two opposite directions: **all three locale chunks precached** (37.3 KB gz / 104.5 KB raw of never-used data for every player — 35% of the gz payload, off the critical path but not off the meter, silently negating the split `src/content/index.ts` exists to provide), and **zero fonts** (Workbox's default globs are `**/*.{js,css,html,ico,png,svg}` — `woff2` omitted; `vite.config.ts:24-31` leaves `workbox.globPatterns` default). An offline player gets system fallbacks — no STIX Two Text, no JetBrains Mono, so R2.4's tabular numerals on the dial and the accounting lose their alignment; the app claims offline support and goes offline without the three families R2.1 fixes by role. **Fix:** add `woff2` to `globPatterns`; move the locale chunks to a `runtimeCaching` `StaleWhileRevalidate` route so a language switch still works offline for the language actually chosen. Verify by re-reading `precacheAndRoute` out of `dist/sw.js`.

### [gr1b-021] `INEFFECTIVE_DYNAMIC_IMPORT`: zero bytes to save, and it costs a double focus move · **polish** · **S**
`Published.tsx:66-75,212-218`, `ScreenRouter.tsx:9`. `ScreenRouter` must statically import `registry.ts` because `screen: 'call'` is reachable via `abandon()` (`store.ts:320`), so `Call` is in the main chunk by necessity and `await import('./registry')` splits **nothing, ever**. The doc comment at `:42-64` documents a real shipping bug this shape caused — but concluded "make the dynamic import correct" when the premise ("this splits a chunk") was already false. Residual cost: a microtask during which `CallScreen` is `null`, so the overlay commits **empty** once, and the focus effect keyed `[callOpen, CallScreen]` runs **twice** — container first, then the first verdict button. Two focus moves per dialog open. **Fix:** import `Call` statically in `Published.tsx` (no cycle — `Call.tsx` imports nothing from `Published`) and delete the loader; keep the prop as an optional seam but make the default synchronous.

### [gr1b-022] 161 KB of legacy `.woff` is emitted and never fetched · **polish** · **S**
`dist/assets/` holds 126,664 B of `.woff2` and **161,408 B of `.woff`** — Fontsource's legacy fallbacks. No browser that can run this app (React 19, ES modules, `IntersectionObserver`, `color-mix()`) will request one, and they aren't precached either: pure deploy weight served to nobody. **Fix:** `woff2`-only entry points, or drop `*.woff` from `dist/assets` post-build. Pair with gr1b-020.

### 5. Interpolation safety

**Headline: no render can be broken through the interpolators, and nothing double-substitutes.** Verified by executing the real modules:

```
t('x {n} y {n} z', {n:7})            -> "x 7 y 7 z"
t('hi {who}', {who:'$& $1 $`'})      -> "hi $& $1 $`"    (no $-substitution)
t('{a} and {b}', {a:'{b}',b:'BEE'})  -> "{b} and BEE"    (no re-scan)
```

`$`-patterns are inert because `t.ts:19` passes a replacer **function**; braces in a value are inert because `replace`/`exec` scan the original template only. Three engines: `t()`(`t.ts:14-22`), `interpolate()`→`.ph-num`(`Reveal.tsx:83-110`), and two literal `.replace`s (`published.ts:97`, `SpecCurve.tsx:212`). **`dangerouslySetInnerHTML`: zero occurrences** in `src/`, `tests/`, `e2e/`, `index.html`. Both `style={{}}` sites and the one JS-written custom property are numeric-only.

**Checked and CLEAR — recording so it is not re-opened.** Placeholder *order* is unpinned across locales (`it.shape.test.ts:446-451` and `es.shape.test.ts:332-341` compare token **sets**), and IT/ES do move `{k}` to the end of `reveal.accounting2/3`. **Harmless and correct:** `interpolate` is keyed on token *name*, and the `sig: true` flag that spends R1.3's loud colour is set at the call site (`Reveal.tsx:211-215`), not by position — so `{sig}` gets `--sig-red` in every locale regardless of order, and a *missing* token is caught by the same set-parity tests. Catalogs otherwise clean: 222 keys each, no missing/extra, no repeats, no decimal comma (`e2e/i18n.spec.ts:79-93` asserts it live).

### [gr1b-023] `wrapLabel` emits an over-long single word unwrapped — the IT/ES band label overruns its band · **high** · **S** · cross-lane with GR4
`SpecCurve.tsx:375-385`. The escape hatch never closes: `if (candidate.length <= maxChars || lines[last] === '') lines[last] = candidate;` — a word exceeding `maxChars` is placed **unwrapped and un-ellipsised** because a line must not be left empty. The doc comment at `:369-373` ("anything longer still ends in an ellipsis") is true only once a *second* word arrives. Live in shipped content — longest single word across all 60 scenarios' `outcomeLabels`: `en 18 "Passive-aggression"` · **`it 20 "passivo-aggressività"`** · `es 18 "pasivo-agresividad"`. `bandLabel:305-308` degrades to `Y₁`-notation only while `bandLabelMaxChars < 12`; with `bandLabelMaxChars = max(6, floor(bandWidth / 7.15))` and `bandWidth = (width−92)/4` (`geometryFor:141-175`), the full label engages from container width ≈440px and `maxChars` doesn't reach 20 until ≈664px. **So at figure container widths ≈440–663px, Fig. 2's Italian band label emits a 20-char token into a 12–19 char band** — up to 8 chars ≈ 57px against an 87px band, two-thirds of a band, painted over the neighbour (SVG `<text>` neither wraps nor clips). **Fix:** in the forced-placement branch, hard-truncate to `maxChars-1 + '…'`; and raise `BAND_LABEL_MIN_CHARS` from 12 to cover the longest shipped token so the notation fallback engages across the risky range — the second half matches `:296-302`'s stated "degrades honestly instead of overlapping" intent. Add the longest-token-per-locale measurement as a content shape test.

### [gr1b-024] Three catalogs and two test names state a factually wrong reason for the no-repeated-token rule · **polish** · **S**
`en/copy.ts:566-568`, `it/copy.ts:18-20`, `es/copy.ts:15-16`, `it.shape.test.ts:439`, `es.shape.test.ts:332-334`. All five say `t()` "rewrites the FIRST occurrence **only**". `t.ts:19` uses `/\{(\w+)\}/g` — **global**; executed above, both `{n}` are replaced. The IT test's own *name* asserts the falsehood. The claim is true of the two literal `.replace`s, presumably its origin. The rule it justifies is harmless and correctly enforced — but in a codebase whose ethos is that every claim is checkable, five comments teaching a false mechanism is exactly what this review exists to catch. **Fix:** correct all five; decide whether the no-repeat rule survives on its own merits (a fine translator-clarity convention).

### [gr1b-025] No `{`-guard on the content fields that actually feed interpolation params · **polish** · **S**
`tests/content/shape.test.ts:353-362` guards `press[].text`, `:489-502` guards `headline`. Unguarded are the fields actually substituted *into* other strings: `scenario.outcomeLabels[]`(→`Reveal.tsx:204`, `SpecCurve.tsx:275`), `outcomeUnits[]`(→`Reveal.tsx:205`, `CoefPlot.tsx:76,113`), `covariateLabels.*`(→`SpecControls.tsx:80-83`). Also unguarded and rendered raw: `achievements[*].name/.citation`, `press[].outlet`, `retractionSublines`, `question`, `coverStory`. A brace renders as literal braces — legibility, not security. None present today across all three locales. **Fix:** extend `findPressTokens` to sweep the param-feeding fields; ~5 lines in a file that already does this for two others.

### [gr1b-026] Six copy keys defined in all three locales, referenced nowhere · **polish** · **S**
`nav.puzzleNumber` (`en:379`, `it:76`, `es:66` — and it carries an `{n}`, so it looks live), `nav.title`, `nav.tagline`, `nav.localeToggle`, `stats.avgScore`, `legend.trueEffect`. `copyFreeze.test.ts` only checks used→defined. **Fix:** delete, and add the defined→used direction. Cross-check GR3 first — a key may be reserved for copy about to land.

---

### Appendix — checked and found correct

- **boot/locale/theme init order is sound.** `index.html`'s inline script stamps `data-theme` pre-paint from the same key and the same `!= null` (not truthy) mapping as `LocaleProvider.domTheme`, satisfying R7.1; `useLayoutEffect:128-132` re-commits pre-paint; `App`'s boot effect is ref-guarded (`:119-135`) so a mid-day locale switch re-renders without re-booting or resetting progress. The two `localIsoDate()` reads (`main.tsx` module scope, `App.tsx:127`) can disagree across a midnight load; `displayedPuzzleNumber`(`:176`) resolves it in the store's favour.
- **The double-persist guard chain is correct**: `Summary.tsx:375`'s durable `loadState().history[puzzleIso]?.[mode]` anchored on the store's `iso` rather than the wall clock survives both the nav-remount and midnight-straddle cases its comment describes.
- **Locale scenario parity is genuinely tested** (`it.shape.test.ts:258`, `es.shape.test.ts:237-249`), so the unguarded `content.scenarios[scenarioIndex]` reads in `Published.tsx:259`, `Briefing.tsx:40`, `Prereg.tsx:47` (only `Reveal.tsx:195` has a `?? scenarios[0]`) are not a live crash path.
- **`useEnterOnce` fails open in all three directions** that could hide content, as R5.6 requires; its `useState` initialiser doesn't react to a mid-session reduced-motion flip, which is the safe direction.
- **CSS: zero `!important`, zero orphan rules, one 3-level descendant, `.ph-visually-hidden` single-defined with no sr-only drift.**

### Process note (controller attention)
The final-review findings text does not exist as a file in the repo (`grep -rn 'final-0' .` returns nothing; the grand-review dir held only `shots-ux/`). The lane adjudicated the three findings whose content its brief quoted (**007** confirmed → gr1b-001; **009** confirmed with counts → gr1b-012; **015** first half already satisfied → gr1b-010) and swept the same territory independently for 005/006/010/012/013/016 — the controller, who holds the final-review text, should cross-check those six against this list during GR5.
