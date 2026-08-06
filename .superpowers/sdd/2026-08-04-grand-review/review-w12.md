# GR6 W12 (SHARE & PROGRESSION) — REVIEW
(Persisted by the controller. Arrived AFTER the merge; findings triaged below.)

VERDICT: NEEDS FIXES — 1 MED, 5 LOW, 3 INFO. BOTH RULINGS APPROVED AS RULED. Nothing blocked the tree.
Gate reproduced at both tips (W12 tip 1849+1todo/60 files; merge 1937+1todo/61 files; e2e 28 three engines).

## SAME-DAY REFUSAL UPHELD, AND UNDERSTATED
scorePrereg is (preregSig, dayType) and nothing else — verbatim at both tips. Act II prints the day's truth, the enumerated curve and sigPaths before the Briefing is reachable again — AND the curve is enumerated at state.n, not a fixed window, so a player who peeks to full power reads the curve at EXACTLY the N=400 window the prereg commit is judged at. The oracle is identical, not merely predictive. PRE-EXISTING REACHABILITY CONFIRMED LIVE on base (seeded first_retraction + a finished RETRACTED day → base Briefing renders Prereg enabled; W12's tip renders no chooser). Measured over 60 days: the day's MAXIMUM prereg score is reachable from the revealed curve on 60/60 days (150 on the 15 effect days, 100 on the 45 null days). From an unpeeked n=200 curve a seen-significant path is still significant at 400 in 64.8% of 9,172 cases.

## FINDINGS
[w12-r-001] MED — EN 'NULL CONFIRMED' contradicts its own site comment (which claims it reuses summary.breakdownConfirmedNull's noun phrase, 'Confirmed null' — word order inverted), is the only locale whose two new stamps are not internally parallel, and reproduces the exact shape of the retired NULL REPORTED the same comment criticises. IT/ES DO satisfy the claim. → **CONTROLLER APPLIED: 'CONFIRMED NULL'** (same 14 chars, fit guaranteed by textLength).
[w12-r-002] LOW — preregUnlockedBy used Object.keys(history).length > 0, weaker than storage.ts's own playedOn. MEASURED: history {'2026-01-01': {}} survives loadState() and opens the chooser on ZERO completed days — the same threat model W12's Briefing comment cites to justify keeping the per-option guards. → **CONTROLLER APPLIED**: Object.values(history).some(d => d?.hack !== undefined || d?.prereg !== undefined).
[w12-r-003] LOW — SHARE_LINE2's claim is one-third false: leading/doubled space and an ungrouped run of 13 are rejected, but `🍴🍴 🍴🍴🍴 🍴🍴🍴🍴🍴 🍴🍴🍴 📄` MATCHES ({1,5} just re-partitions). Fix: state what it pins, or make it exact. NOT APPLIED.
[w12-r-004] LOW — three live comments name the retired verdict (Stamp.tsx's TEXT_W table, dayComplete.ts ×2, e2e/stamp.spec.ts's "nine strings"). The TEXT_W CONSTANT is still valid. NOT APPLIED.
[w12-r-005] LOW — nav.tagline's catalog comment stale by two waves ("RENDERING IS BOOKED FOR W7"; W7 landed it, ROSTER_PENDING is {}). NOT APPLIED.
[w12-r-006] LOW — the refusal also closes HACK-AFTER-PREREG, reachable on base (measured) and strictly worse (the player enters the Lab knowing which spec is significant; submit() is gated at p<.05, so a guaranteed publish at minimum forks). Narrated nowhere. Also "collects 150 with certainty" is exact only on effect days; the true statement is the day's MAXIMUM (150/100) on 60/60 days. NOT APPLIED.
[w12-r-007/008/009] INFO — unreachable leading-space case recorded for a future refactor; the dead-key sweep is a source scan so briefing.alreadyPlayedToday reads as "used" though unreachable-by-construction; and --assist-green for CONFIRMED_NULL DESERVES ELEVATION: §1(j)(2) exists because the honest path has no positive moment, and the honest player's WIN currently renders in the same ink as their LOSS, with only the word distinguishing them.

## THE FOUR FAIL-OPEN PREDICATES — ALL FOUR CONFIRMED, AND COMPLETE
Each was `stamp !== 'NULL_REPORTED'` on base (storage.readRecord, storage.saveDay career, statsAgg.modeSuccessRate, achievements.priorPublished). `git grep NULL_REPORTED build/v1 -- src/` finds no fifth site. isPublishedStamp is a verified-total Record<Verdict, boolean>; its legacy reading is deliberate and tested. M-C3 RED on both tips.

## W3'S RULE HELD AND IS STRONGER
No stamp-keyed branch (only === 'RETRACTED', legitimate and documented). M-C4 RED both tips. W7's both-day-types test now drives the two REAL verdicts and asserts effectSub === nullSub — a stronger proposition than the old one.

## §1(i) SHARE — INDEPENDENTLY RE-DERIVED
Fresh seed 0xc0ffee7, 12,000 draws (4,000 × 3 locales) vs the shipped 300, wider spec pool, walks to 64 forks, 4,036 draws with NO terminal: day type never reaches the string; no leading/trailing/doubled space; no ASCII '+'; no group over 5; no lone surrogate. Surrogate handling right (🍴 is 2 UTF-16 units, ➕ is 1; grouping the ARRAY cannot split the pair). Novel N2 (chunk the joined string by UTF-16 units) reds 11 tests. THE DECLINED CAP IS UPHELD (reasons 1-2 load-bearing; reason 3 is taste and the owner's to overrule). THE LOCALIZED LINE-1 HOOK IS ACCEPTED — the brief's "invariant across locales" reinterpreted as the brand NAME; flagged so the controller can confirm the reading.

## SIX DEVIATIONS — ALL ACCEPTED
Notably (1) engine collision risk MEASURED AT ZERO (git diff 9090946..build/v1 -- src/engine/ = day.ts only; W11 touched neither file W12 did) and (2) the twice-written rule COMMENDED, both halves verified not assumed (the import fails eslint with the exact layering message; reveal.ts imports the DGP constants and p_hit table at module scope, so the reverse import would pull them into the main chunk).

## MUTATIONS — 20 RUN, 20 RED (8 replays, 3 novel, 4 locale-law probes on the NEW strings, 5 on the merged tree)

## THE W8 SEAM — ALREADY RECONCILED, AND CORRECTLY
git merge-tree predicted exactly the 4 conflicts the controller hit. THE REAL HAZARD WAS NOT LINE 1 — IT WAS Reveal.tsx: W8's gr6-021 fix (bankIndex instead of the bare %, which made every subline bank invisible on every pre-EPOCH/practice day) sits inside the exact hunk W12 rewrote, so taking W12's side wholesale would have regressed it. The merge kept BOTH. The reviewer mutated it back on the merged tree to check the naive resolution would be caught — RED, so the trap is compiled against. Line 1 combines both deviations with reasoning at the site and is guarded. STILL OWED: e2e/harness.ts's SHARE_LINE1_PREFIX(n) has no practice arm, so no e2e checks the practice line-1 shape.
