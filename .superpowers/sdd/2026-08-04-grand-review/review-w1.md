# GR6 W1 (ACT II TRUTH) — REVIEW

**Worktree** `/home/carlos/PycharmProjects/phackle/.claude/worktrees/task-w1`, branch `task-w1`, 4 commits ahead of `7e417f4`, 15 files. Worktree left **clean** (`git status --porcelain` empty); every mutation ran on a `git archive` copy at `/tmp/w1-review/repo`.

## VERDICT: **NEEDS FIXES**

Two blockers, both new to this branch. The wave's engineering is strong — gr6-002's two-vector table, gr6-003's prereg restructure, gr6-098, and the stamp *root-cause diagnosis* are correct, well-evidenced and well-tested. But one new string teaches something false, and one fix overshot and broke the honest player's stamp in all three locales.

---

## SCIENTIFIC AUDIT VERDICT, PLAINLY

**Yes — one new string teaches something false: `reveal.accounting1`, the null-day variant, in all three locales.** The effect-day variant, the two-vector p_hit table, and the `pHitAtK(k, dayType)` call sites are all correct.

### [w1-r-001] BLOCKER `scientific` — the null-day accounting inverts the measured decomposition

> "Some are chance; the rest are confounding: the treatment was never randomly assigned, and it moves with age and income."

The implementer's own measurement **reproduces exactly**. Plain Y1 spec (`outcome:0, all, no covariates, none, raw, two`) over 600 unconditioned null draws at n=200: **18.3% rejection, mean β 0.1820, z-on-mean 24.6** (their claim: 18.2%, 0.182, 24.9). I am not disputing the number. I am disputing what it licenses: that is **one spec of 1,792**, and the most-confounded one, while the sentence's subject is the `{sig}` count over the whole grid.

Permutation probe — permute `x` within the accepted dataset (the exact null; same Y, same covariates, same correlation structure among the 1,792 tests), 4 permutations/day, **188 accepted null days**, n=200:

| | mean sig | median | as % of 1,792 |
|---|---|---|---|
| observed | 94.46 | 90 | **5.27%** |
| permuted-X (chance alone) | 89.66 | 80.75 | **5.00%** |

- **Mean excess attributable to confounding: 4.80 paths = 5.1% of the hits the sentence is about.** Paired t = 1.11 — indistinguishable from zero.
- On **90/188 (48%)** of accepted null days, chance alone produces *at least as many* hits as observed. "The rest are confounding" describes a negative quantity on half the days.
- On only 38/188 (20%) does confounding account for more than half the hits.
- Probe calibration is validated by the permutation null reproducing nominal **5.00%** exactly.

**The project's own calibration output corroborates it.** From `npm run cal`:
```
null sigCount@200 raw : median 96.0 · p01 0 · p99 510 · in NULL_SIG_BAND 0.584
null sigCount@200 acc.: median 85.0 · min 30 · max 180
```
`NULL_SIG_BAND = [30, 180]` = 1.7%–10.0%, straddling nominal 89.6 (5%). **The rejection sampler removes the confounded tail.** On raw draws the confounding excess is real — 25.3% of hits (observed mean 120.3 vs permuted 89.9, R=150) — but the accepted days a player actually sees do not carry it.

So the screen prints "89 (5.0%) reach p < 0.05" — literally the nominal rate — and then tells the player most of it is confounding.

This is **not** a violation of controller ruling (a). The copy does name the confound and does not offer chance as the sole cause. Ruling (a) permitted naming the confound; it did not license claiming confounding is the majority explanation.

**Fix shape (EN; IT/ES follow — and see the transcreation findings, which independently want this sentence rewritten):**
> "Of {total} possible analyses, {sig} ({sigPct}%) reach p < 0.05. None of them found an effect, because there is none: {total} tests at that threshold turn up about this many on their own. And none of them is clean, either — the treatment was never randomly assigned, and it moves with age and income."

Measured-true, names the confound, never chance alone. **Controller note:** the real mechanism is the acceptance band, which is gr6-004's subject in W2. Whatever lands here must be written consistently with About's rejection-sampler disclosure.

### The effect-day variant is SOUND — no overclaim
- **`{trueSig}` share: mean 75.1%, median 77.6%** over 62 accepted effect days. The ≈70% claim holds and is conservative.
- **Question (b) resolves cleanly.** The effect is injected on *every* treated row of the true outcome (`dgp.ts:293-303`: `multiplier = 1` by default; `hetero` only *scales* it inside the subgroup). So a hit on the true outcome in **any** subgroup genuinely is "on the outcome where the effect is real" — 77.4% of trueSig hits sit on a non-`all` subgroup and that is fine, not a bug. And **0 of 6,210** trueSig hits across 25 effect days carry a β of the wrong sign. The partition-by-outcome reading is correct; the sentence is true under it.
- **`{otherSig}`** median 49 vs a chance expectation of ~61 on the 3/4 of the grid that is non-true outcomes — at or below chance. "on the outcomes where nothing is" is true.

### [w1-r-003] MEDIUM — (c) "Nothing in a p-value distinguishes the two"
Defensible about a *single* p-value. But it is an absolute, and two blocks below on the **same screen** Fig. 2's caption (`reveal.groupedCaption`) says *"Real effects cluster. Noise scatters."* — a figure `Reveal.tsx:440` calls "the single most important educational graphic in the game", which exists precisely to show the p-values *do* distinguish them. Measured: trueSig is 75% of hits and visibly clusters.
**Fix:** "A single p-value does not tell you which is which." Keeps the beat, loses the collision.

### (d) "lower bound" — direction CORRECT; the premise is UNVERIFIED
Direction is right: `pHit[k]` is P(≥1 hit within the first `k` of a **uniform random permutation** of all 1,792 specs) (`simulate_calibration.ts` `shuffledIndices` + `firstHitPosition`). A greedy p-value-following searcher hits sooner, so the random figure understates. ✓

**[w1-r-004] MEDIUM:** *"You did not search at random: you followed the p-value"* asserts a behavioural fact about the player, gated only on `mode === 'hack' && playerExplored > 1`. The engine holds the explored list and the full curve and could verify a descent; it does not. This is the exact defect class the backlog already books as **gr6-096** ("`lab.insufficient` asserts a cause it could not know"). Fix: make it conditional ("If you followed the p-value…") or gate on a measured descent.
"Lower bound" as a mathematical term overclaims slightly (empirical expectation, not a proven bound) — LOW, acceptable in the register.

### (e) p_hit vectors — CORRECT
- **Effect vector built on ACCEPTED days.** `simulateDay` computes `subsetHitPositions` from `enumerateCurve(data, CURVE_N)` where `data` comes from `generatePractice(seed, SCENARIO_COUNT)` — the §3.3 rejection-sampling loop runs inside. Same population players see. ✓
- **Null vector unchanged.** Element-by-element `Object.is` against `7e417f4:src/data/p_hit_by_k.json`'s `pHit` → **0 diffs**; checksum unchanged at 3889152766. ✓
- Both length 41, both monotone non-decreasing. ✓
- **[w1-r-005] LOW/informational:** `CURVE_N = 200`, but the reveal enumerates at `state.n` (250–400 after peeks). Pre-existing — the null vector had the same property — but W1 now owns the line.

### [w1-r-006] MEDIUM — `reveal.ts`'s doc comment quotes a number that is not in the file it documents
`src/engine/reveal.ts` (PHitTable doc): *"the gap at the commonest k is a factor of 2.3 (k = 5: 0.226 null against 0.514 effect)"*. Shipped table: `pHitNull[5] = 0.2256`, **`pHitEffect[5] = 0.6136`**, ratio **2.72**. The implementer's own ledger entry says 0.614 / 2.7×. The 0.514 looks like the backlog row's GR1a figure ("51% true at k=5") pasted in. **Controller:** the backlog gr6-002 row's "51%" is superseded by the shipped 61.4%.

---

## STAMP

### [w1-r-011] BLOCKER — the new filter region hard-clips the label's own glyphs, in all three locales
Pinning the filter region to the viewBox (`region === viewBox`, 344 units wide, centred on x=160 since (−12+332)/2 = 160) makes the region a **hard clip on filter output**. The label is `--text-40` (40px) STIX Two Text, uppercase, `--tracking-label` 0.08em. Measured budget ≈ **12 characters**. The `NULL_REPORTED` labels are longer in every locale:

| locale | string | chars | measured clip @360 / @768 | renders as |
|---|---|---|---|---|
| it | `RISULTATO NULLO` | 15 | 16.4px / 27.3px | "ULTATO NUL" |
| es | `RESULTADO NULO` | 14 | 13.7px / 22.7px | clipped both sides |
| en | `NULL REPORTED` | 13 | — | "ULL REPORTE" |

Independent arithmetic reproduces this: at ~29.5 units/char advance, `RISULTATO NULLO` ≈ 426 units against a 344-unit region → ~41 units overflow per side → ~18.6px @360, ~31.6px @768. Same order as measured.

**This is new to the branch** — rolling `filterUnits` back restores the word. And it is a strict regression on the **honest player's stamp**: `NULL_REPORTED` is the verdict for a player who reported a null result. That intersects backlog §1(j) ("the honest path has no positive moment, in any mode, ever") — the one stamp they get now reads "ULTATO NUL".

**Root cause, for the controller:** gr6-010 and this clipping are *one* unfixed problem. The label has **never** fitted the 320-unit box; the old `objectBoundingBox` region hid that by growing with the text bbox and painting out of bounds. W1 fixed containment and thereby exposed the fit. A complete fix must make the label *fit*:
- Cheapest and locale-proof: `textLength={BOX_W - 2*PAD}` + `lengthAdjust="spacingAndGlyphs"` on the `<text>`. Region stays pinned; any label in any locale compresses to the frame.
- Or a font-size step-down past ~12 chars, or widen viewBox + region + frame rects together (changes rendered scale).

**Missing guard:** `shell.test.tsx:312` pins `region === viewBox` but pins nothing about the label fitting. Full suite is green at 1555/1555 with the clipping shipped. The new test must assert rendered label advance ≤ region width for all **9** (verdict × locale) strings. Note for every future guard: `getBoundingClientRect` and `scrollWidth` are **blind to filter ink** — they cannot be used here.

### [w1-r-012] MEDIUM — the 50%-trim comment's justification is not achieved at 768
`Reveal.css:262-268` states 50% was chosen because 60% "put the word RETRACTED back across the question's second line at 768". Measured: RETRACTED **still crosses the question at 768** (card only 144.56px tall). gr6-059's stated goal ("the stamp obliterates the text it is stamped on") is met at 360 but not at 768.

### Verified clean on the stamp
- **gr6-011 (double announcement):** `role="img"` + `aria-label` retained, single `<text aria-hidden="true">`; pinned by `shell.test.tsx`. ✓
- **gr6-077 (fill pairs):** behaviour-preserving. `.ph-stamp__border` already declares `fill: none; stroke-width: 4`, so each per-verdict rule needs only `stroke`; the label keeps both. Three pairs → six rules → six rules, no computed value moves. ✓
- **gr6-059 subline:** now horizontal HTML beneath the card (`[data-role="stamp-subline"]`), outside the SVG, pinned both ways. ✓
- **Size at 360:** cover = 360 − 2×`--space-24` = 312px; stamp = 50% = 156px = **43.3% of viewport** — matches the claim exactly; R8.2's "oversized" survives.

---

## CODE

### [w1-r-002] HIGH — the `RevealMetricsFull` widening is pinned by nothing at the wire boundary
`Reveal.tsx:178` does `useGameStore((s) => s.reveal) as RevealPayloadFull` — an unchecked assertion. The claimed runtime pinning does not exist: `tests/engine/reveal.test.ts` calls `buildRevealMetrics` **directly**, and `tests/ui/reveal.test.tsx` renders from a **hand-built payload literal** (`sigTrueOutcome: 317` at :286). Neither proves `protocol.ts` puts the fields on the wire.

**Mutation proof:** strip `sigTrueOutcome`/`sigOtherOutcome` from protocol.ts's payload spread → `tsc --noEmit` **exit 0** and full suite **1555/1555 GREEN**. `formatCount` is `String(Math.round(v))`, so every effect-day reveal would ship *"NaN on the outcome where the effect is real, NaN on the outcomes where nothing is"* with nothing failing.

**Adjudication of deviation 2 (hoist now or at merge):** do **not** touch `types.ts` in this wave. Add **one** protocol-level assertion instead — `protocol.test.ts` already has the spoiler-guard suite that enumerates payload keys, which is the natural home, and it costs ~4 lines. The 2-line hoist onto `RevealMetrics` is then a clean follow-up for whoever owns `types.ts`; gr6-102 (W5) will add `capExhausted` to the same interface, and two waves appending fields is a textual merge, not a semantic conflict. Runtime pinning is **not** adequate today; with the protocol test it is.

### [w1-r-007] HIGH — a tenth motion site was added without an R5.2 row, and the compiled register does not catch it
`Reveal.css:184-188` adds `@media (prefers-reduced-motion: no-preference) { :root:has(.ph-reveal) { scroll-snap-type: y proximity; } }` plus `scroll-snap-align: center`.

DESIGN.md is explicit and **Tier-A compiled**:
- `:330` "**R5.2 — These are the motion sites, and this list is exhaustive.**"
- `:387` "**R5.5 — Nothing outside R5.2's table animates.**"
- `:304` "Sites are added by adding a row to R5.2's table — which is compiled, not decorative."
- §0 registry row 45: "**nine** sanctioned sites … The list is still exhaustive, still compiled (`tests/ui/motion.test.ts`)"

There is no row 10; `scroll-snap` appears nowhere in DESIGN.md.

**Mutation proof:** delete the `@media (prefers-reduced-motion: no-preference)` wrapper → `motion.test.ts` **32/32 green**, full suite **1555/1555 green**. R5.6's "reduced motion is parity, and it reaches every site" does not reach this site; the guard is protected by nothing. The implementer's own gating is an admission it is motion — you do not wrap non-motion in a reduced-motion query.

Controller ruling (c) said "stamp gets air". Padding is air; a scroll-snap is a new motion mechanism beyond the ruling's words.

**Fix (recommend):** drop `scroll-snap-type`/`scroll-snap-align`, keep `padding-block: var(--space-64)`. The implementer's own comment concedes the air is "the substantive half", and this needs no lawbook change (W0 is closed). If the snap is wanted, route it through W0/W10 as an R5.2 row plus a compiled check that parses `scroll-snap` the way it parses animation identities.

**Deviation 5 adjudication:** both claims TRUE as stated. Without `:has()` the whole rule is dropped and `scroll-snap-align` on a non-snap container is inert, so the padding survives. The reduced-motion guard is present and correct — but unenforced, per above.

### [w1-r-008] MEDIUM — deviation 6's justification answers the wrong question
The stated reason for landing gr6-027's leading zero early is "the two `accounting1` variants never co-render" — true but irrelevant (`payload.dayType` picks exactly one). The relevant co-render: **`SpecCurve.tsx:561` renders `copy['legend.significant']` = `'p < .05'` inside Fig. 1** (`Block name="fig1" index={1}`), and the very next block prints `'p < 0.05'`. Before this branch `accounting1` said `p < .05` and *matched* the legend directly above it.

gr6-027's fix shape names **both** `reveal.accounting1` **and** `legend.significant`. W1 landed half and put the split on one screen, one block apart — exactly gr3-015's "present in five strings and absent in three, **on the same screens**". Also: neither locale header contains a leading-zero rule, and the ES header's rule 2 explicitly sanctions `α = .05` — the rule cited as a register law is gr6-027's *proposed* rule, still unlanded.

**Fix:** either land `legend.significant` → `p < 0.05` ×3 now (three one-line edits in files W1 already edits), or revert `accounting1` to `p < .05` and let W2 do gr6-027 atomically. Leaving it as-is is the one clearly-wrong option.

### [w1-r-009] LOW — the stagger index is no longer DOM order on a prereg day
`Reveal.css:38` states the index is "set by Reveal.tsx from DOM order". With the call Block conditional, a prereg reveal renders blocks at 0,1,2,3,**5** — a one-step hole in the ramp and a now-false comment. Fix: `index={call === null ? 4 : 5}` on fig2, or correct the comment.

### [w1-r-010] LOW — `.ph-stamp__mark { overflow: visible }`
Containment now rests entirely on the filter region's hard clip. Given [w1-r-011] this needs revisiting as one piece: whatever makes the label fit should also decide whether the SVG viewport clips.

### Verified clean (checked, no finding)
- **Partition loop:** one extra comparison inside the existing `if (point.p < 0.05)` branch; `sigOtherOutcome: sigPaths - sigTrueOutcome` **by subtraction** — no second counter, **no drift path**. `trueOutcome = day.puzzle.trueOutcome ?? null` prevents `undefined === undefined` matching; `verdictStamp` reuses the same local. ✓
- **`dayType` required end-to-end:** no default; the one other call site (`protocol.ts:106` startup probe) updated, and its `'null'` argument is genuinely arbitrary because `assertPHitTable` validates **both** vectors first. ✓
- **Prereg 5-block structure:** order truth(0) → fig1(1) → accounting(2) → stamp(3) → [call omitted] → fig2(5); `<Block name="call">` is not rendered at all rather than rendered empty; subline suppression is mode-scoped (hacking-mode retention separately pinned); `preregFalsePositive` hoisted above `.ph-reveal__stamp-beat`, gated `isPrereg && dayType==='null' && stamp==='RETRACTED'` — the one §2.7 order deviation, mode-scoped, exactly as ruling (c) permits. §2.7 block **order is KEPT**. ✓
- **Deviation 1 (protocol.ts touch): JUSTIFIED and MINIMAL.** Making `dayType` required rather than defaulted is the right call, and it forces the one call site. One line + comment. Correctly flagged as a W5 seam.
- **Deviation 3 (no checksum bump): CORRECT.** `pHitTableChecksum()` = `fnv1a32(JSON.stringify(dgpConstantVector()))` — DGP constants only, nothing about file shape. No DGP constant moved, so the checksum **must not** move. `assertPHitTable` does guard both vectors per-name (`Array.isArray` + length, naming the offender). Residual: shape only — a file of 41 nulls would pass. Adequate for the failure mode it names.
- **Deviation 4 (subline prop removal): CORRECT.** `Stamp` has exactly one consumer (`Reveal.tsx:403`); no other reference to the `subline` prop in `src/`, `tests/`, or `e2e/`. Removed, not orphaned.

---

## TRANSCREATION ×2

**it-IT does not ship as written.**
- **HIGH** — `reveal.accounting1`: *"Alcune sono caso; le altre sono confondimento"* is not grammatical Italian. Bare `caso` as a predicate noun needs the article (the file's own `lab.dialCaption` writes "il caso da solo"), and `sono confondimento` is not a predication Italian licenses. Proposed: *"Alcune sono dovute al caso; le altre al confondimento: … e varia con l'età e il reddito"* (also fixes `si muove con` → `varia con`, a calque).
- **MEDIUM** — `accounting2Prereg` "ti sei impegnato" is the only essere-auxiliary player participle in the file and misgenders half the players. Proposed: *"Sentieri dichiarati prima di vedere un solo numero: {k}."*
- **LOW** — `arriva alla significatività prima` → `arriva prima alla significatività`.

**es-ES ships only after `accounting1` is rewritten.**
- **MEDIUM**, three defects in one clause: bare predicate `son azar`; broken parallelism vs EN; and an `azar`/`al azar` collision ("some are chance … was never chance") within 12 words. Bare `la confusión` also reads as everyday confusion with no on-screen antecedent. Proposed: *"Algunos se deben al azar; el resto, al sesgo de confusión: el tratamiento nunca se asignó de forma aleatoria, y varía con la edad y la renta."*

**Passes (checked, clean):** token parity ×3 exact — and mutation-verified that the shape suites bite (dropping `{otherSig}` from IT fails `it.shape.test.ts:449`; duplicating `{trueSig}` in ES fails `es.shape.test.ts:339`). Terminology locks confirmed **verbatim** against About's own words (`it:404` "confondimento da età e reddito", `es:386` "confundido con la edad y la renta") and against the Lab (`+Renta`/`+Reddito`, `Edad<40`/`Età<40`) — **the suspected income/age terminology break does not exist**. Register/verb forms correct for their neighbours (the ES infinitive rule is scoped to controls, not prose). Em-dash count **0** in all new values; zero decimal commas; quoting conventions consistent; the contrastive `Tu`/`Tú` is correct, not a calque.

Note: EN's `accounting2Prereg` says "before seeing any data" while EN `prereg.intro` says "before you see a single number". The locales followed `prereg.intro`, which is the tighter and truer claim (a prereg player does read a briefing). Consider aligning EN to the locales, not the reverse.

---

## GATES (exit codes captured before pipes)

| gate | result |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npx eslint .` | **0** |
| `npm run build` | **0** (106 modules, 561ms) |
| `npx vitest run` | **0** — **1555 passed / 1555**, 53 files |
| `npm run cal` (private copy) | **0** — **5/5 bands PASS**, **byte-idempotent** (md5 `dd85d19c…` identical before/after and to the committed file) |
| goldens | **0** — **6/6** |
| e2e | **0** — **15/15** (first attempt failed on a port-4317 collision with a concurrent probe server; re-run clean) |

**Mutation spot-checks (3 requested + 2 extra):**
1. Variants swapped (invert `dayType === 'effect'`) → **KILLED**, 8 tests.
2. Null vector on effect days (`pHitAtK` always reads `pHitNull`) → **KILLED**, 3 tests.
3. Filter region back to bbox (`x="-20%" width="140%"`) → **KILLED**, 1 test (`shell.test.tsx:316`).
4. *Extra* — strip split counts from protocol.ts's wire payload → **SURVIVED** → [w1-r-002].
5. *Extra* — remove the reduced-motion guard from the scroll-snap → **SURVIVED** → [w1-r-007].

---

## CROSS-WAVE SEAMS

| file | W1 does | also owned by | note for the merge |
|---|---|---|---|
| `src/engine/protocol.ts` | 1 line + comment | **W5** (`src/engine/**` less reveal.ts) | gr6-102 adds `capExhausted` to `RevealPayload` here **and** in types.ts. W5 has landed and reports it did **not** touch reveal.ts. Merge W1 first or rebase W5's protocol hunk. |
| `src/engine/types.ts` | **not touched** | **W5** | [w1-r-002]'s optional hoist would touch it; gr6-102 will. Recommend W1 stays out — take the protocol test instead. |
| `scripts/simulate_calibration.ts` | pHitVector ×2 + report | **W5** (`scripts/*`) | W5's report does not mention touching it; verify at merge. |
| `src/data/p_hit_by_k.json` | new 2-vector shape | **W11** (regenerates artifacts) | **Loud flag:** W11 must run `npm run cal` **after** W1 lands, or it regenerates the single-vector shape and `assertPHitTable` throws at first reveal. |
| `src/content/{en,it,es}/copy.ts` | 5 key families | **W2** (whole catalog), W3 | sequencing already specified. W2's gr6-027 must still do `legend.significant` — [w1-r-008]. gr6-004 (About's rejection-sampler disclosure) must be written consistently with whatever `accounting1` lands as — [w1-r-001]. |
| `tests/content/shape.test.ts` | +54 | **W2/W3** | additive block at EOF; low collision risk. |
| `src/ui/screens/Reveal.tsx` | heavy | **W8** ("after W1, W6, W7 — shares their files") | W1 did **not** touch `game/store.ts`, avoiding the W6 seam the backlog's gr6-003 fix shape predicted. Good call. |
| `src/ui/screens/Reveal.css` | +69 | **W7** via gr6-050/087/088/089 (7a runs alone, "nearly every stylesheet") | `:root:has(.ph-reveal)` at :185 is the **only** `:root` rule outside `theme/tokens.css` in the whole `src/ui` CSS tree — a global declared from a screen sheet, easy to miss in a consolidation, and W7 owns `App.css` where such a rule belongs. Resolving [w1-r-007] by deletion removes this seam. |
| `src/ui/components/Stamp.{tsx,css}` | heavy | W7 owns `components/**` **except Stamp.\*** (W1's) — but **gr6-087**'s keyframe collapse names 5 stylesheets and `Stamp.css` holds `ph-stamp-slam` (DESIGN.md R5.2 row 4 notes Stamp.css defines the slam, Reveal.css fires it) | flag to 7a. |
| `tests/ui/reveal.test.tsx`, `tests/ui/shell.test.tsx` | +222 / +33 | **W7** (`tests/ui/*`) | direct overlap; W7 has a large UI-test surface. |
| `docs/DESIGN.md` | **not touched** | **W0** (closed, +1 fix round) | [w1-r-007] needs an R5.2 row if the snap is kept — a W0 re-open or a W10 item. Another reason to prefer deletion. |

Also: W0's own review flagged `Reveal.css`'s `.ph-fade--in .ph-stamp--animate` descendant gate (w0-r-002). W1 inserted `.ph-reveal__stamp-beat` between the Block and the cover; verified the descendant combinator still matches (rules now at `Reveal.css:247/251`) and the reduced-motion e2e spec passes. No action, but W0's fix-round text about that selector should be re-read against W1's new DOM depth.

---

## SUMMARY FOR DISPATCH

**Blocking:** [w1-r-001] null-day accounting ×3 locales (+ the IT HIGH grammar defect in the same string, which should be fixed in the same pass), [w1-r-011] stamp label clipping ×3 locales + the missing label-fit test.
**Should fix before merge:** [w1-r-002], [w1-r-007], [w1-r-003], [w1-r-004], [w1-r-006], [w1-r-008], [w1-r-012], IT MEDIUM gender, ES MEDIUM.
**Low:** [w1-r-005], [w1-r-009], [w1-r-010].

Deviations 1, 3 and 4 are accepted as correct and minimal. Deviation 2 is accepted with a required 4-line protocol test in place of the types.ts hoist. Deviation 5's technical claims are true but the guard is unenforced. Deviation 6's justification is wrong and creates a same-screen split. Deviation 7 is half-accepted: 360 lands, 768 does not meet its own stated criterion, and the trim is unrelated to the clipping blocker.
