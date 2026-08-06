# GR6 W2 (COPY CATALOG) — REVIEW

(Persisted verbatim by the controller from the reviewer's reply; the reviewer's file writes were harness-blocked.)

**Target** task-w2 @ d1bb246, 4 commits on 5acfea0, 10 files. Worktree left clean; all probes/mutations on git-archive copies.

## VERDICT: NEEDS FIXES
One blocker, one high, four mediums. Strong wave otherwise: gr6-026's dead-key sweep is the best new test in the round, the roster mechanism is self-retiring in both directions (proven), gr6-028 complete, transcreation close to shippable.

## GATE (reviewer re-run): tsc 0 · eslint 0 · vitest 1632+1todo (58 files) · build 0 · e2e chromium 22/22. Catalog 226→235 ×3 reproduced by loading modules.

## SCIENTIFIC AUDIT
Measured-true: NULL_SIG_BAND [30,180] (tuning.ts:9); 1792 = allSpecs().length; acceptNullDay does exactly what About says (precheck + sigCount(enumerateCurve(data,200)) in band); consistency with merged accounting1 PASS (89.6 inside band; no reopened overclaim); lab.canPublish true; omitting 42%/26% discard rates correct (W11 §1(d)).

### [w2-r-001] BLOCKER scientific — Armitage fix restores a condition the game's own schedule satisfies
lab.peekFootnoteArmitage ×3: "five equally spaced peeks at α = 0.05 inflate your false-positive rate to ~14% (Armitage, 1969)". Ruling (b) chose "insert the genericity" on the premise the game's peeks are NOT equally spaced. They are: N_SCHEDULE = [200,250,300,350,400], Δn = 50. Brownian-motion simulation, 2,000,000 trials/schedule, |Z_k| > 1.95996:
- Armitage's design (equal information fractions 80,160,240,320,400): 14.171%
- unit groups (1..5): 14.122%
- THIS GAME (200,250,300,350,400): 11.181%
- game at footnote's first appearance (200,250,300): 8.665%
- single look: 5.006%
The distinguishing condition is equal FRACTIONS OF TOTAL INFORMATION (first look = 1/5 of data), not equal spacing (game's first look = 1/2 of data → inflation 11.2%). W2's comment turns the sentence toward the player ("the footnote now names the thing the player pressed") — under that gloss "five peeks" is unreachable (max peeks = 4; footnote renders at peeks >= 2, readership's real inflation 8.7–11.2%). IT/ES comments self-refute their strings (print 200→…→400 and 11,1% three lines above "equidistanti/equidistantes → ~14%").
Fix options inside ruling (b)'s intent: (a′) name the true condition — "five looks at equal fractions of the data" / "equal batches" (figure + citation intact); or (b) print the game's own number (11.18% at 2M, 11.11% in ledger's 400k run). Either way "five" must not read as the player's action.

### [w2-r-002] HIGH scientific — About's closing inference false for a player who peeked
about.mechanism ends "…the count you are shown at the end of the day is never wildly small, and there is always something for you to find." The band binds at n=200; the reveal enumerates at state.n. Measured over 21 consecutive accepted null days: at n=200 21/21 in band; at n=400 8/21 (38%) OUTSIDE — incl. sig200=37→sig400=5 (0.3% of 1792) and sig200=83→sig400=384. And this wave ships lab.collectMoreHint to make peeking MORE attractive. Fix ×3: give the sentence its own n ("in the opening sample of 200") and drop the absolute; optionally one clause that the count moves as you collect more.

### [w2-r-004] MEDIUM — gr6-004's compiled guard containment-only. N1 (p<0.05→p<0.01 in About) SURVIVED 1632 green; N2 (invert band sense, keep numbers) SURVIVED. Fix: assert relation — toContain(enCopy['legend.significant']) + per-locale between-span regex.
### [w2-r-008] LOW — effect-day gate half-disclosed (acceptEffectDay = p200<0.15 AND p400<0.05 canonical + p200<0.3 precheck; string names only the 400 half; key comment states both). One clause ×3.
### [w2-r-007] LOW — EN lab.insufficient "cut" is engine vocabulary (locales chose subsample). Fix: "this subsample".

## TRANSCREATION
Locks verbatim + compiled (M4 red). Notation: α=0.05 ×3; legend.significant byte-identical (M5 red, 2 tests); zero decimal commas; zero typographic apostrophes (probed on loaded modules — the 6 IT escapes genuinely gone).
### [w2-r-005] MEDIUM — leading-zero regex catches only two-digit decimals. N7 (p = .049 inside about.decimalNote ITSELF) SURVIVED. Fix: /(?<![\d\w.])\.\d/ — verified zero false positives on all three catalogs.
### [w2-r-003] MEDIUM — three self-authored contract locks compiled nowhere: gr6-028's rivelazione/revelación ban (N4: restoring pre-W2 call.title ×2 SURVIVED); gr6-031's Serie/Racha in all four places (N3: reverting ×2 SURVIVED); gr6-032's la clave ban (no test mentions clave). Fix: three one-liners in per-locale suites.
### [w2-r-006] MEDIUM — EN header rule 10 claims "IT and ES run the same validator at a budget of zero" — FALSE, no zero budget exists. Fix: delete or state the truth (IT ratchets vs EN dash count; ES has no ratchet).
### EM-DASH ADJUDICATION: W2's catalog PASSES. Compiled law = ≤1/string + ≥2500 chars/dash corpus-wide (validators.ts:143-145) + IT-only ratchet dashes(it)<=dashes(en) (it.shape.test.ts:700). Measured: en 3 dashes/35,874 chars; it 3/41,232; es 1/41,264; only stats.noData among VALUES; other dashes are pre-existing press blurbs. Zero new dashes added; density improved every locale. W1's "IT/ES budget = 0" was a round convention, never compiled (N6: dash in new ES value SURVIVED; N5: dash in new IT value red via EN ratchet only). Only the DESCRIPTION needs fixing (w2-r-006).
### [w2-r-011] LOW craft — IT "un pollice sulla bilancia" calque (→ far pendere la bilancia); stats.emptyState figure-fills-itself subject ×2 (→ page fills); about.decimalNote doubled verb ×2.
Clean: registers per headers; no bare predicates; CI-95% match; finishedNextIn formats; gr6-028 complete (zero values with the word, probed); ES forkTrailHint exact.

## CODE/CONTRACT
ROSTER_PENDING self-retiring BOTH directions (M1 red 2 tests; M2 wire-without-deregister red, tsc 0). Liberal detector correctly reasoned+documented; assertion (c) stale entries, (d) real reasons; ROSTER_KEPT a11y.closeDialog accurate to the line; spot-checked call sites correct. Strongest artifact in the wave. 4 deleted keys: zero references anywhere. summary.playPrereg correctly RETIRED-rostered. 3 UI-test conversions: no weakening (verified line by line). ES sweep bites (M3 red). Header claims spot-verified true (t.ts global regex; published.ts:97 literal replace; SpecCurve.tsx:212 — file is charts/ not components/, basename unique).

## MUTATIONS: M1-M5 KILLED; N1/N2/N3/N4/N6/N7 SURVIVED (→ findings); N5 killed via ratchet only.

## DEVIATIONS: all 5 ACCEPTED (decimalNote placement better than source; preregUpsell moment-naming verified vs ES informe collision; gr6-028 ×5 strongly right; UI-test conversions forced+clean; ES sweep commended).

## HAND-OFFS: correctly scoped (14 keys need src/ui; {n}→{pct} genuinely atomic with Published.tsx:285; W11 booking right). Controller notes: [w2-r-009] LOW — W6's 4th TODO-W2 (Summary.tsx:189 careerPoints stand-in) neither authored nor recorded-declined; backlog W2 row lists About.tsx/Stats.tsx but dispatch barred src/ui — amend row so next reader doesn't think W2 left its files undone; W2 did edit three tests/ui files (forced), so the "tests/ui is W7's" rationale for deferring playPrereg deletion is weaker than stated though still defensible.

## [w2-r-010] LOW report accuracy — "new i18n.spec decimal-point law" is inherited (e1c80a8), not new; diff touches no e2e file. 22/22 real. Everything else reconciles exactly (226+13−4=235; roster 14+1).

## SUMMARY FOR DISPATCH
Blocking: w2-r-001 (needs controller re-ruling — premise of ruling (b) falsified).
Should-fix: w2-r-002, w2-r-003, w2-r-004, w2-r-005, w2-r-006.
Low: w2-r-007, w2-r-008, w2-r-009, w2-r-010, w2-r-011.
