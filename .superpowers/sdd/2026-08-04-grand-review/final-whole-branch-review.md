# FINAL WHOLE-BRANCH REVIEW — build/v1 7e417f4 vs main (fable tier)

Recovered verbatim by the controller on 2026-08-06 from the session transcript (the review's
output originally lived only in task output a14d2f5902335d3be — see gr1c-001). This file is the
authoritative source for [final-001..016], the deferred-minors adjudication table, the dead-key
roster, and the 10-step deploy-day checklist. Verdict: READY FOR GRAND REVIEW.

---

All verification done — one more significant discovery: the plan claims goldens are EPOCH-immune (line 308), but `scenarioIndexFor` gates its 13-day exclusion walk on `iso > EPOCH` (seeds.ts:104-113), so moving EPOCH at T25 shifts the recursion base case and can change `scenarioIndexFor20` in the committed goldens. The gate would catch it, but the checklist must say so. Composing the final report.

---

### The whole, judged

This branch is the strongest multi-agent tree I have reviewed. 139 commits, 195 files, 58.7k insertions — and the gate I ran myself is clean: **vitest 1494/1494 (exit 0), tsc 0, eslint 0, e2e 15/15**. The things that usually rot across six hands did not rot here: the CSS is verifiably one system (zero raw colors, zero raw durations, one breakpoint, one dark-theme mechanism, one visually-hidden utility), the copy union is byte-order-identical across three locales, the engine is sealed behind a worker with a unit-tested dispatch function, and the two invariants the whole product stands on — spoiler safety and boot determinism — are *structural*, not policed: `share.ts` has no input channel that could carry day type, and the e2e suite re-derives the dial's p-value in Node against the browser's.

The debt that remains is real but shallow and almost entirely known: duplication dialects (22 copies of the focus-ring block, 20 of the uppercase-label pair, six local `TFunction` types, two `readDur*Ms` copies, three mean helpers, two `daysFromCivil`s), a copy catalog whose *values* are excellent but whose key-naming grew three sub-idioms, four genuinely dead copy keys shipped in three languages, and one latent hardening hole (`isValidV1` shallow-validates, so a `version:1` blob with `stats:{}` NaN-poisons the stats). Nothing I found is a player-visible defect on the happy path; T40 closed both e2e product findings for real (I verified `errors.storageOff` and `a11y.loading` are wired and tested).

Two things only this review could catch, both about deploy day: (1) the About page **already discloses Vercel Analytics that do not exist in the tree** — `@vercel/analytics` is not a dependency and `inject()` has no call site; that is a planned T25 item (plan line 651), but if T25 slips a beat, the app ships a false privacy disclosure; (2) the plan's claim that "EPOCH changes at T25 must not break goldens" (line 308) is **wrong for `scenarioIndexFor20`**: `seeds.ts:104` gates the 14-day-window exclusion walk on `iso > EPOCH`, so moving EPOCH moves the recursion base case and can reshuffle scenario indices for every later date, including the five golden dates. The gate will catch it loudly; the checklist below makes it a step instead of a surprise.

### Cross-task seams

**CSS — one system, with local dialects** (delegated audit, verified spot-wise). Naming: uniform `.ph-` prefix, zero IDs, zero `!important`; deviations are `.ph-speccurve`/`.ph-datacut` (unhyphenated blocks vs `.ph-coef-plot` et al.), `.ph-call-overlay` defined in `Published.css:326` (a Call element in Published's file), and an orphan modifier `.ph-clipping--in` (`Published.css:117`, no `.ph-clipping` block). Spacing: only 34 raw lengths in 24 files, nearly all the documented 2px underline/travel idioms; the true magic numbers are `Stamp.css:8` (`min(100%,320px)`), `Reveal.css:231` (`width:60%`), and `min-width:2ch` duplicated in `ForkTrail.css:134`/`Legend.css:49`. Colors/durations: **zero** violations outside `tokens.css`. Dark theme: single `[data-theme='dark']` mechanism. Dialects: focus-ring block ×22 across 13 files; uppercase-tracked-label pair ×20; page-shell padding spelled 4 ways across 9 screens (`Call.css:21` also uses `--measure` where siblings use `--page-max`); the stagger-entrance flag has three names (`.ph-fade--in`/`.ph-clipping--in`/`.ph-summary__unlock-item--in`) with identical bodies; byte-identical close-button blocks in `About.css:96`/`Stats.css:202`/`Legend.css:63`. Stale: `Legend.css:61` still cites retired `.ph-toggle`.

**copy.ts — dialects in the skeleton, one voice in the values** (delegated audit). `{n}` carries eight different semantics including a percentage (`published.altmetricPercentile`, en:570) where siblings use `{sigPct}`/`{pHitPct}`; the lab/reveal knob-label mirror disagrees with itself (`lab.exclusionZ2_5` vs `reveal.exclusionZ25`, `covariates*` vs `cov*`, `transformLog1p` vs `transformLog`) while duplicating four subgroup values verbatim; EN is the only locale without a convention-contract header; stale comments at en:5-6 ("T19/T20 will fill in" — file is at T39b) and it:21-24 (the "Open Data journal badge" myth T36 root-caused, still allowlisted in `it.shape.test.ts:393` incl. stale member `lab.exclusionNone`); en:632 claims a complete floor-token list and omits eight. One genuine defect found: `a11y.themeToggle` = "Change theme" (action phrase) names a `role="group"` (`App.tsx:294`) — exactly the WRONG-FUNCTION class T36/T37 fixed for the locale group ("Language/Lingua/Idioma") one control to its right.

**Store/screens**: no unused state fields — all 19 `GameStore` fields have live readers (verified `call`, `practice`, `preregResult`, `resultLog` individually). Two latent gaps: `makeCall` has no reentrancy/staleness guard (UI `busy` flag covers double-click; a re-boot mid-`reveal()` await could still land a stale `screen:'reveal'` write — every other async action checks `requestSeq`, this one doesn't); `abandon()` during an in-flight debounce commit strands `pending:true` (inert today, T12's finding, still true).

**Engine**: `daysFromCivil` duplicated (`seeds.ts:49`, `day.ts:265`) — architecturally forced by engine purity (engine may import only `tuning.ts`), documented, cross-checked by test; mean/sd helpers exist three times (`stats.ts:12` exported, `dgp.ts:99` private, `day.ts:296` inline) — `dgp.ts` *could* import `stats.ts`; `generateRows` still has no runtime guard for the documented `effect`-with-partial-`n` foot-gun (doc comment only, `dgp.ts:184-189`). `readDur*Ms` idiom: exactly two copies (`PValueDial.tsx:82`, `Published.tsx:97`), the first citing the second as "the idiom". `TFunction` re-typed locally six times. The salt-sniff press picker and its `readFileSync` source-scan test (`published.test.ts:467`) both stand, as ruled, until `pressForDay()`.

### Dead-key roster (definitive; union frozen)

| Key | Current state (verified by grep) | Verdict |
|---|---|---|
| `nav.localeToggle` | Zero references in src/tests/e2e; string-identical twin of live `a11y.localeToggle` in all 3 locales | **Remove** (S; 3 files + roster count) |
| `nav.puzzleNumber` | Zero references anywhere (header renders `briefing.vol`) | **Remove** |
| `legend.trueEffect` | Zero references anywhere | **Remove** |
| `stats.avgScore` | Zero references; T17 flagged, T19/20 translated anyway (union forced) | **Remove** |
| `nav.tagline` | Src-dead; used only as transcreation probe in shape tests | **Remove + repoint probes** (S) |
| `nav.title` | Src-dead (wordmark is a sanctioned literal, `App.tsx:194`); specimen key in LocaleProvider/freeze tests | **Keep** — specimen role; repoint cost > value; add comment |
| `a11y.closeDialog` | Render-dead by T22 design; negative test pins absence (`a11y.test.tsx:539`); tombstone comments ×4 | **Keep** — documented decision, test-enforced |
| `a11y.shareButton` | Render-dead by T34/T22 design; tombstones at `Summary.tsx:192`, `a11y.test.tsx:815` | **Keep** — same class |
| `legend.emojiSubgroup/Exclusion/Tails` | Referenced in `Legend.tsx:42-44` `DECLARED_ENTRIES`, filtered out by glyph dedup at runtime | **Keep** — load-bearing: if the fork-glyph set ever splits back, the Legend auto-expands with correct labels |
| `errors.storageOff` | **Wired** (`App.tsx:248`, T40) + tested | Alive |
| `a11y.loading` | **Wired** (`App.tsx:168`, T40) + tested | Alive |
| `legend.emojiSpec` | Rendered; value corrected for the reduced set, IT/ES mirrored | Alive |

### Deferred-minors adjudication table

Named majors first, then the ledger sweep. Verdicts: **fix** = GR6 fix waves; **GR-lane** = decision belongs to a grand-review lane/owner; **wontfix** with reasoning. Effort S/M/L.

| Item | Recorded | Verdict | Effort |
|---|---|---|---|
| `pressForDay()` refactor; retire `readFileSync` source-scan | L210/213 | **Fix** — the scan is the one test that breaks on an innocent rename; refactor collapses 3 call-site seeds into one audited function | M |
| Validator extraction from `shape.test.ts` | L175/176/178 | **Fix** — measured today: `it.shape` runs 124 tests (~44 re-registered EN), same for es; runtime cost trivial (~0.3s) but failure attribution and counts lie; extract `validateLocaleContent` to a non-test module | M |
| Dial-settle 2px translate | L202/204 (parked for owner) | **GR4/owner** — question, crisply: R5.2 site 2 gives every new result a 2px settle; the reviewer called it the weakest site ("the Lab is where plain lived", R8.1); the defense is that the dial is "the game's heartbeat" (R5.2 rationale column). Keep or cut is one CSS line either way | S |
| Header wraps 3 rows at 360 (267→318px) | L193 | **GR4** — design call; interacts with the 153px sticky dial budget | M |
| Dual "Legend" buttons (nav page + trail popover, identical label) | L207/209 | **Fix** — two same-named buttons, different behaviors, same screen (`App.tsx:219` vs `ForkTrail.tsx:181`); rename the trail trigger (new key ×3) | S |
| Nested dialog on published path | L207 | **Fix** — `Published.tsx:391` role=dialog wraps `Call.tsx:70` role=dialog; demote the outer (it is a takeover, not a dialog); axe-clean today but semantically wrong | S |
| Watermark head-vs-foot (PressCard foot, ChyronBar strap) | L124, T29 M4 | **Wontfix** — two different physical objects (print colophon vs broadcast strap); both watermark visibly (`Published.tsx:147,175`); uniformity would cost verisimilitude. GR4 may overrule | S |
| Practice-mode "Vol. 1, No. -5" | L207 | **Fix** — unreachable in production post-freeze (isPractice ⇒ pre-EPOCH only) but reachable on a wrong-clock device; render an em-dash issue number when `practice` | S |
| 320w residual ~8px overflow (outside header) | L193 | **Fix** — GR4 lane hunts the owner element; T33 matrix method reapplies | M |
| Accented-caps tier-3 blindness (shared validator) | L219 | **Fix** — extend the caps class with À-Þ; measured nil today (worst case 2 non-ASCII letters) but the guard should not be locale-blind in a trilingual product | S |
| retirad/ritirat marathon-retirement residual | L219 | **Wontfix** — documented cura-style boundary; two-sided lexicon tests guard the shipped jokes; rewording would cost the pun | — |
| IT/ES Hayek chyron 7 lines vs EN 4 (`--text-28`) | L222 | **GR4a** — aesthetic call, number already handed over; if flagged, shorten the IT/ES strings (content-only) | S |
| 60-cell press matrix (26/60 bespoke cells) | L213/218 | **GR2/GR3** — owner routed it there (A4 amendment); becomes T39c only if flagged; default wontfix: ≥1 bespoke per scenario is guaranteed, repeat rate measured 12% | L if taken |
| R5.6 association-check precision | L204 | **Resolved** — T38 tightened to selector-association with both-direction mutation proof (`motion.test.ts:438,499`); verified present | — |
| Reachability-test placement | L215 | **Resolved/wontfix** — lives beside the picker it guards (`published.test.ts:407`), mutation-verified; placement is right | — |
| jsdom EBADENGINE warning | L225 | **Wontfix** — pre-existing npm noise; CI pins Node 22; no behavioral surface | — |
| `--with-deps` unverified on real runner | L225 | **Deploy-day item** — watch the first real push (checklist below) | — |
| `scenarioIndexFor` recursion depth ≈ days-since-EPOCH | L10 (T1) | **Fix** — iterative forward walk kills the class; today's depth is fine, but EPOCH is about to be frozen forever and this function must live for years | S |
| T1: DST-test discrimination, leap-day direct tests, CI npx cosmetics | L10 | **Wontfix** — coverage-taste; goldens + epochGuard cover the load-bearing part | — |
| T2: `number[]` vs "Float64Array" phrasing; n=31 "exact" interpretation | L36 | **Wontfix** — documented, no consequence | — |
| T3: `generateRows` runtime guard | L38 | **Fix** — one `if (effect && n !== 400) throw` (tests use null-effect partials) turns a documented foot-gun into an impossible one | S |
| T3: diff-in-diff tests outcome 0 only | L38 | **Fix** — cheap parametrize ×4 | S |
| T3: Y4 clamp classification, t5Scale naming | L38 | **Wontfix** — naming taste; calibration bands pin behavior | — |
| T6/T32 writing micro-items (jigsaw contradiction, KLOC label, noun repetition, slot-1 device 9/20, gap-opener template, orthography mix, 3× "still", tense wobble) | L52/59 | **GR3 lane** — precisely its remit; carry the list to it verbatim | — |
| T7: CI-property test branches on df>0 not `valid` | L55 | **Fix** (GR1c) — passes-by-coincidence risk is real | S |
| T8: `AXES.covariates` mutable export | L70 | **Fix** — `Object.freeze`, one line | S |
| T9: engine-side calendar dup, SCENARIO_COUNT triplication, gen_goldens exit, scripts outside tsconfig | L81 | **Wontfix** — duplication is purity-forced and cross-tested; the rest is scaffolding hygiene | — |
| T9: cap-exhaustion tie-break untested | L87 | **Wontfix** — compound rare event, behavior arguably more correct, documented | — |
| T10: family-density denominator literal 448 | L101 | **Fix** — `assert validCount===448` in the script, one line | S |
| T10: N_SCHEDULE rationale wording; curve-test name | L101 | **Wontfix** | — |
| T11: spoiler-scan spec variety; `idx===-1` string reuse; trueBeta comment addendum | L108 | **Wontfix** except the comment addendum (**fix**, S) — master's §2.7 example is standardized-scale and the code is raw-units; one comment prevents a future "fix" | S |
| T12: `pending` stuck after abandon-during-flight | L61 | **Fix** — `pending:false` in abandon(); inert today, one line | S |
| T12: brittle exact-string asserts; forks invariant test; singleton wrapper untested | L61 | **GR1c** — test-quality lane | S |
| T13: ModeHistory type dup (storage/achievements) | L83 | **Wontfix** — deliberate no-import documented both sides; shapes must-and-do match | — |
| T13: loadStats untested, symbolic-constant asserts, double loadState, true_detective tie-break | L83 | **Wontfix** — tie-break is documented in code (`achievements.ts:70-74`); rest is taste | — |
| T14: ForkTrail duplicates buildTrail walk | L122 | **Fix** — export a shared walker from share.ts; the §2.10 rule now lives in two places | M |
| T14: StrictMode-guard test shape | L122 | **GR1c** | S |
| T15: monotonicity sampling, altmetric sizing rationale, framing prose | L137 | **Wontfix** | — |
| T16: hover re-renders 1792 circles | L117 | **Fix** — memoize the static plate; the one perf item on the centerpiece | M |
| T16: pointerleave-on-touch brief tooltip | L126 | **Fix** — one `pointerType` check | S |
| T16: leader at rank~0, call.title case vs R2.7, "Fig." mono span, data-* attrs shipped, sub-.10 width note | L117 | **Wontfix** — recorded design notes; the geometry note is a v2 thought | — |
| T17: exact-20 rolling-window boundary test | L129 | **GR1c** | S |
| T18: hack-only achievements unreachable from prereg (incl. z2-committed prereg not firing outlier_surgeon) | L160 | **GR2/owner** — recommend wontfix: those achievements satirize hacking behavior; prereg is the cure, not the crime; `publishedSpecFromLog` (dayComplete.ts:78) makes it structural | — |
| T18: RadioGroup keydown lacks disabled check | L160 | **Fix** — latent, one line | S |
| T18/T39: "guards-the-guard" spoiler test vacuous as written | L165 | **GR1c** — guarantee holds structurally; improve or annotate the test | S |
| T21: favicon rect-vs-path, unescaped `<`, fc-list substring, report-prose nits | L95/99/105 | **Wontfix** — cosmetic/report-level | — |
| T28: FOCUS_SUPPRESSION_RE bare-prefix, Tier A hyphen wording, doc-drift word boundaries | L27/45 | **Wontfix** — all fail-safe direction | — |
| T29: 153-vs-154 arithmetic nit (DESIGN.md/Lab.css) | L188 | **Fix** — DESIGN.md:579 now says 153; align the Lab.css comment; one number | S |
| T29: touch-test-3 non-discriminating | L188 | **GR1c** | S |
| T30: decisiveTails comment plainness | L148 | **Resolved** — current comment (dayComplete.ts:36-40) names the N-independence mechanism plainly | — |
| T30: saveAchievements changed-tracking unreachable | L148 | **Wontfix** — defensive | — |
| T31: tap targets, Got-it affordance, jargon rewrites, baseline half-outside viewBox, dial numeral wrap at 1088 | L153 | **GR4** — UX lane's exact remit; dial-wrap is the one with a law hook (R2.5) | S–M |
| T31: practice-seed evidence hygiene | L164 | **Wontfix** — process note, recorded | — |
| T37: IT playPrereg 2-line CTA escape hatch | L197 | **Wontfix** unless owner — documented owner-taste option | S |
| Controller-side test repoints at T15 merge + copy-freeze precision fix | L138/143 | **Accept** — flagged for me; gate has run green ~40 times since, and the freeze harness carries negative-case pins; no action | — |
| T23 reviewer "injected system-reminder" env note | L217 | **Recorded** — no code impact, evidence culture held; nothing to do in-tree | — |

### Spec conformance spot-audit (10 claims, current tree)

1. **Spoiler rule structure** — `share.ts` takes `{puzzleNumber, log, mode, callCorrect, streak, copy}` only; day type/stamp/direction have no input channel; prereg terminal is mode-decided fixed submit-glyph (share.ts:68-83,114). **Holds structurally.**
2. **Idempotent persistence** — Summary guards on `loadState().history[puzzleIso]?.[mode]` with `puzzleIso` = store-retained boot `iso` (store.ts:56-64; Summary.tsx:254-330 doc + straddle test). **Holds.**
3. **Day assembly** — precheck-first ordering per the §3.3 letter (day.ts:12-37 header documents both orderings + the T9 measurement), cap fallback via `bandDistance` best-attempt. **Holds.**
4. **RHO_SHARED** — 0.3, with the tuning rationale and marginal-guard documentation (`dgpConstants.ts:24-75`). **Holds.**
5. **§2.9 line-3 amendment** — controller-ruled label-colon form documented as an explicit DOCUMENTED DEVIATION with the "1 forks" argument (share.ts:147-166); emoji-set collapse likewise (share.ts:27-43). **Documented as required.**
6. **Prereg no-abandon** — `abandon()` guarded to `screen==='lab'`; prereg path never reaches lab; `preregCommit` runs and reports unconditionally with reentrancy guard. **Structural.**
7. **Achievements** — all 11 §2.11 triggers map 1:1 (achievements.ts:103-148); first-occurrence semantics correct; `published` derived from the log's SUBMIT entry so prereg days cannot fire hack-only achievements (design question ledgered, see table). **Holds.**
8. **§3.9/§2.8 constants** — tuning.ts matches the master tables byte-for-byte (P=25%, d∈[0.18,0.30], band [30,180], N 200→400, MIN_CELL 30, 300ms, full SCORING row-set). **Holds.**
9. **§7.3 pins** — invoice + countdown + upsell (Summary), "I solemnly commit" (copy en:755), Lab layout as documented grid deviation (DESIGN.md §0 row), Legend derived from the live mapping. **Hold**, with the two §7.3 dialogs nested (finding 006).
10. **EPOCH placeholder** — provisional 2026-08-10 with the T25 comment; `epochGuard.test.ts` mechanically ties PUZZLE_ISO and PUZZLE_NUMBER to it with named-file failure messages. **Holds** — but see the checklist's goldens caveat.

### Deploy-day checklist (T25, EPOCH freeze — every touchpoint)

1. `src/game/tuning.ts` — set `EPOCH` to the real launch date; delete the "provisional" comment.
2. `e2e/harness.ts` — bump `PUZZLE_ISO` (strictly after new EPOCH) and `PUZZLE_NUMBER` + its comment; `epochGuard.test.ts` fails loudly if either is missed.
3. **Goldens** — the plan (line 308) claims EPOCH changes cannot break them; **false for `scenarioIndexFor20`**: `seeds.ts:104` (`if (iso > EPOCH)`) makes the 14-day exclusion walk's base case EPOCH-relative, so the five golden dates' scenario indices may shift. Run the full gate; if `goldens.test.ts` reds, regenerate via `scripts/gen_goldens.ts` and commit — that is the sanctioned drift-guard reset, not a bug.
4. Re-run e2e (15/15) — the harness's bounded search adapts to the new fixed day, but refresh its measured-on comments (harness.ts:287, 422).
5. `npm i @vercel/analytics` + `inject()` in `main.tsx` — **the About page already discloses this analytics setup (copy en:793); shipping without it makes the disclosure false.**
6. Create `vercel.json` — `index.html` no-cache, hashed assets immutable (delta spec/master §10; absent from the tree today).
7. Set `VITE_APP_VERSION` in the build env — About renders "dev" otherwise (About.tsx:36,99).
8. DNS CNAME `phackle` → Vercel, alongside climatle's record; SITE_URL (share.ts:11) and og:image (index.html:67) already pin the domain.
9. First real CI push: confirm `npx playwright install --with-deps chromium` succeeds on the hosted runner (T24's unexercisable-in-sandbox concern).
10. Run `npm run cal` once on the frozen tree (bands are date-independent, but it is free and the weekly cron's first run should not be the first evidence).

### Security notes

- **localStorage**: single versioned key, corrupt JSON → fresh state without flagging storage off (correct separation), legacy fold-in validated field-by-field, quota/disabled → in-memory fallback + visible notice (T40). One hole: `isValidV1` (storage.ts:158) checks only `typeof === 'object'` on the four sections — a `version:1` blob with `stats:{}` or `history:[]` passes, then `saveDay` arithmetic NaN-poisons stats (finding 002).
- **Worker RPC**: worker.ts is a 6-line pump around unit-tested `handleRequest`; typed Req/Res, no dynamic dispatch, no eval-shaped anything.
- **Injection**: zero `innerHTML`/`dangerouslySetInnerHTML` in src and e2e. All copy renders through React text nodes.
- **Clipboard/share**: two-tier `navigator.share` → `clipboard.writeText`, rejections surfaced (share.ts:200-222), failure alert tested.
- **Dependencies**: 5 runtime deps (react, react-dom, zustand, 2 fontsource) — exemplary. One oddity: `tailwindcss` + `@tailwindcss/vite` are installed and wired in vite.config, but `@import "tailwindcss"` appears nowhere (App.css:4 documents this) — the plugin is inert (finding 010).

### [final-###] findings

- **[final-001] About discloses analytics that don't exist yet** — high · S · `src/content/en/copy.ts:793` vs `package.json` — planned in T25 (plan:651) but the disclosure ships with the corpus; fix shape: keep as an unskippable T25 checklist line (above), or gate the sentence on the integration landing.
- **[final-002] `isValidV1` shallow validation NaN-poisons stats** — high · S · `src/game/storage.ts:158-172` — `version:1` + `stats:{}` passes; `saveDay` then writes NaN into every counter. Fix: validate `stats` numerically or merge over `freshState().stats`.
- **[final-003] Goldens are EPOCH-sensitive; plan claims otherwise** — high (process) · S · `src/engine/seeds.ts:104` vs plan:308 — fix shape: checklist step 3; optionally correct the plan line.
- **[final-004] `a11y.themeToggle` action-phrase names a role=group** — polish · S · `src/ui/App.tsx:294`, copy en:858/it/es — the exact WRONG-FUNCTION class T37 fixed for the locale group; fix: noun labels ×3 ("Theme"/"Tema"/"Tema").
- **[final-005] Dual identically-labeled "Legend" buttons on the Lab** — polish · S · `App.tsx:219` + `ForkTrail.tsx:181` — rename the trail trigger (new key ×3 locales).
- **[final-006] Nested dialogs on the published path** — polish · S · `Published.tsx:391` + `Call.tsx:70` — demote the outer role.
- **[final-007] `makeCall` lacks the `requestSeq` staleness check every sibling has** — polish · S · `store.ts:324-338` — a re-boot mid-reveal can land a stale `screen:'reveal'`; add `myReq` capture + check (and `pending:false` in `abandon()`, T12's one-liner, same commit).
- **[final-008] Dead-key removal** — polish · S · `nav.localeToggle`, `nav.puzzleNumber`, `legend.trueEffect`, `stats.avgScore` (+ `nav.tagline` with probe repoints) ×3 locales + freeze-roster count.
- **[final-009] CSS consolidation pass** — polish · M · focus-ring ×22, uppercase-label ×20, close-button ×3, page-shell padding ×4 spellings, stagger-flag ×3 names, `.ph-speccurve`/`.ph-datacut`/`.ph-call-overlay` naming, `Legend.css:61` stale comment — one utility-class sweep; token discipline is already perfect, so this is low-risk.
- **[final-010] Inert tailwind dependency pair** — polish · S · `vite.config.ts` + package.json — remove plugin + both deps, or wire deliberately.
- **[final-011] Copy-skeleton coherence** — polish · M · `{n}`-as-percentage at en:570 (rename `{pct}`), lab/reveal mirror key divergence, EN convention-contract header, stale comments en:5-6/it:21-24, `SHARED_WITH_EN` stale member (`it.shape.test.ts:393`), `{param}`/`{token}` meta-name split — values untouched, so spoiler/freeze tests survive.
- **[final-012] Engine hygiene trio** — polish · S · `generateRows` guard (`dgp.ts:194`), mean-helper unification (`dgp.ts:99` → import `stats.ts:12`), `scenarioIndexFor` iterative walk (`seeds.ts:99`) — goldens pin all of it, so each refactor is self-verifying.
- **[final-013] `pressForDay()` + source-scan retirement** — polish · M · `published.ts:199`, `published.test.ts:467` — the parked ruling's sunset.
- **[final-014] Validator extraction** — polish · M · `tests/content/shape.test.ts` → shared module; kills ~88 duplicate test registrations.
- **[final-015] SpecCurve interaction cost + touch tooltip** — polish · M · `SpecCurve.tsx` hover re-render of 1792 elements (memoize static plate) + `pointerType` check for the tap-flash tooltip.
- **[final-016] Small-fix basket** — polish · S · practice issue-number em-dash (`App.tsx:176`), RadioGroup disabled-keydown, `Object.freeze(AXES)`, 448-denominator assert, trueBeta comment addendum, 153/154 comment alignment, diff-in-diff ×4 parametrize, df>0→`valid` test branch.

### Verdict

**Ready for grand review: yes.** The tree is green under my own runs (1494 vitest / tsc 0 / eslint 0 / e2e 15/15), every spec spot-audit holds or is a documented deviation, and nothing found here is a blocker. Two things should precede or open GR6's fix waves: (1) fold this report's findings list and adjudication table into GR1c's ledger so the four lanes triage one merged queue — the table above is formatted for mechanical merge; (2) pin the corrected deploy-day checklist (analytics disclosure, goldens EPOCH-sensitivity, vercel.json, VITE_APP_VERSION) as the T25 script, since two of its steps contradict what the plan currently promises. The GR4/owner questions to put in front of Carlos, crisply: dial-settle keep/cut, header 3-row height at 360, Hayek chyron length in IT/ES, watermark anatomy, and whether prereg days should ever fire the hacking-satire achievements.
