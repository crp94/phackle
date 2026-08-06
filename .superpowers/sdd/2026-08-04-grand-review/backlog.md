# backlog.md — GR5 synthesis: the single ranked GR6-ready backlog

**Inputs merged:** GR1a (19) · GR1b (26) · GR1c (27) · GR2 (20) · GR3 (34) · GR4 (23) = 149 lane
findings, plus `final-whole-branch-review.md` [final-001..016] + its adjudication table + dead-key
roster (authoritative for pre-adjudicated verdicts), `backlog-draft.md` §C/§F, and the **OWNER
RULINGS 2026-08-06** (binding, outrank every lane recommendation).

**Totals after dedupe: 131 items — 9 blocker · 57 high · 65 polish.**
(§1 holds 11 of them as controller/owner decisions — 1 blocker, 8 high, 2 polish; §2 ranks the other
121 as writable fix tasks — 9 blocker, 49 high, 63 polish. §4 records 40 no-action entries: 4
owner-closed, 6 verification records, 30 wontfix-with-reasoning. §5 lists 11 conflicts between lane
evidence and pre-adjudicated verdicts. §3 groups the work into **13 waves (W0–W12)**.)

**Amendment A4 governs triage:** every severity gets fixed pre-deploy; *parked* is reserved for
wontfix-with-written-reasoning. §4 supplies that reasoning for every item not scheduled.

**Ranking rule:** severity → breadth (player-visible > correctness-latent > infra/test/doc) →
effort (S<M<L). One deliberate tie-break: within a band, items that share a wave are kept adjacent
so the table reads as a dispatch order rather than a list.

---

## §1 — Controller / owner decision briefs

These cannot become fix tasks until they are ruled. Each brief states the question, the blast
radius, and GR5's recommendation. (a)–(h) are the briefs the controller named; (i)–(k) are three
more GR5 found that meet the same test — their preferred fix changes a spec-pinned or
inviolable surface, so no implementer can be given a task without a ruling.

### (a) gr2-001 — the prereg false-positive rate is ~28%, and the game says "about 5%" · blocker · L
`src/engine/dgp.ts` + `dgpConstants.ts`; surfaced at `copy.ts:703` (`reveal.preregFalsePositive`),
`scoring.ts:113`, the Stats α panel. On accepted null days the default spec at N=400 rejects
**28%** of the time (GR2, 500-draw table; Y1 two-tailed 0.176@200 / 0.286@400, Y4 the only
calibrated column at 0.052). The cause is structural: `TREATMENT_L1_COEF`/`TREATMENT_L4_COEF` build
X from the same latents `Y1_LOADINGS`/`Y3_LOADINGS` load on, so a "null" day carries a real
association. GR1a measured the same thing from the other side (z=24.9 on mean β, rejection 3.6×
nominal). **Option (a) copy-honest:** every claim becomes conditional and true — the null truth line
says "no *causal* effect; the association is confounding, not chance", `preregFalsePositive` quotes
the measured rate, About discloses the shared-latent construction. Cost: strings ×3 locales, plus
re-framing the Stats "hacking vs prereg" juxtaposition (≈97% vs ≈29%, which is still a punchline —
preregistration is not a shield against confounding). **Option (b) orthogonalise** X against the
latents feeding Y1–Y3: every existing string becomes true, but it changes `dgpConstantVector` and
therefore **regenerates all five determinism goldens and `p_hit_by_k.json`**, re-measures all five
§3.9 bands, very likely re-tunes `NULL_SIG_BAND` (a true null has far fewer hackable paths, so
band (a)'s floor is at risk), invalidates every calibration what-if already run, and makes the About
page's own "confounded with age and income" line false — so it costs the copy work anyway *and* the
regeneration. **Recommendation: (a).** It is cheaper, it composes with gr6-001's null-day fix
(which already says exactly this sentence), and confounding is the better lesson — it is what the
DGP was built to demonstrate. If (b) is ever chosen it must run as GR6's *first* wave, before any
other engine change, so nothing regenerates twice.

### (b) gr1a-005 — the Armitage 14% footnote is exact for Armitage and wrong for this game · high · S
`copy.ts:455-456` (+it/es), schedule at `tuning.ts:10`. The cited 14.2% is for five *equally
spaced* looks; simulated at 400k trials the citation reproduces to 0.05pp (14.15%) while this
game's 200→250→300→350→400 schedule gives **11.11%**. The footnote also arrives after press #2,
when the player has taken three looks (≈9%). The string is **master-spec-verbatim**, so any edit is
a documented deviation and needs a controller ruling. **Option (a):** insert the genericity —
"peeking five times at *equally spaced* interim analyses…". One word-group, citation intact, number
intact, no re-checkability problem. **Option (b):** print the game's own number ("…all the way to
400, turns α = .05 into about 11%"), which is stronger comedy and stronger pedagogy because the
player can verify it against the schedule they just used — but it replaces a published figure with
a simulated one that then needs its own provenance, and it re-transcreates ×3.
**Recommendation: (a)**, as the smallest honest deviation; take (b) only if the owner wants the
footnote to be about *this* game rather than about the literature.

### (c) gr2-015 — the accounting lands before the stamp, and the screen ends on a chart · polish · M
`Reveal.tsx:258-347`. Measured at 1088: truth → Fig.1 (≈420px) → accounting (≈250px) → stamp
(≈150px) → "Your call was wrong." → Fig.2 → CTA. Master §2.7 *specifies* this order, so the finding
is spec-vs-feel, not a bug. The signature beat occupies 8% of page height with no rest either side.
**Option (a):** move the stamp to block 3 and the accounting to block 4 (verdict → why → grouped
view) — a real §2.7 deviation that also reverses the argument the accounting builds toward.
**Option (b):** keep the order; give the stamp a block of its own with air above and below (and a
scroll-snap, reduced-motion-safe). **Recommendation: (b).** It fixes the measured defect ("8% of
the page, arrived at by accident") without deviating from the spec, and gr6-003 already introduces
a *mode-scoped* exception (prereg hoists `preregFalsePositive` above the stamp) which is easier to
defend as an exception than as a new default order.

### (d) gr2-013 — the default spec is already significant on 12.5% of days · high · M
`day.ts` acceptance loop. Over 120 real dates: default spec p<.05 at N=200 on **15/120** days, and
one move (flip to one-tailed) reaches it on **28/120**. On those days Act I is one tap, the fork
trail is empty, and the reveal then *exonerates* the player. The fix is one more conjunct on the
existing §3.3 rejection sampler ("…and the default spec is not itself significant at N=200").
Headroom is ample (measured `attemptUsed` p99 = 5 against `MAX_ATTEMPTS` = 20). **Blast radius:**
`day.ts`, not `tuning.ts`, so `dgpConstantVector()` is unchanged and `p_hit_by_k.json` stays valid —
but the *accepted dataset for a given date changes*, so **all five determinism goldens regenerate**
and `npm run cal` must be re-run (band (a) untouched, band (b) median moves by at most one step, per
GR2's estimate — must be measured, not assumed). **Recommendation: adopt**, and schedule it as the
first item of the balance wave so the goldens regenerate exactly once. A daily whose central
mechanic is skipped on one day in eight has a variance problem worth one predicate.

### (e) gr4-011 / gr2-011 — at 360 both Lab exit actions sit above all six knobs · high · M
Measured twice independently: GR4 at 360×640 (`Submit` docY 1486, last knob docY 2894, doc 3009),
GR2 at 360×740 (scroll-back 1408px ≈ 1.9 screens). The one-tailed switch is both the most effective
hack and the furthest control from the action it enables. **Option (a):** render the actions row a
second time at the foot of `.ph-lab__controls` below 768 — two buttons with one meaning, an a11y
and duplication problem. **Option (b, GR4's preferred):** `position: sticky; bottom: 0` on
`.ph-lab__actions` below 768, `--paper` ground and a `border-block-start: var(--hairline)`. That is
a second sticky element, so **R8.1's "the dial is the one sticky element" clause must be amended in
DESIGN.md first, in a commit of its own** (W0). **Recommendation: (b), with the W0 amendment.**
Explicitly do *not* fix by moving controls above results — that buries the dial and re-opens T31.

### (f) gr2-007 — the parsimony bonus is dead for anyone who plays the skill the game teaches · high · M
`tuning.ts:15` (`parsimonyMax 40`, `parsimonyPerFork 4`) → zero at 10 forks. Measured medians:
greedy 4 forks, naive 27.5, informed caller 13 — and the informed caller (the only model beating the
base rate) earned parsimony on **2 of 32 days**, because probing a family for robustness *costs
forks*. §1.2 pillar 3 is internally contradictory. `SCORING.*` is **not** in `dgpConstantVector`, so
nothing regenerates and no band moves (GR2 re-ran cal: 5/5 PASS). **Option (a):** count distinct
*outcome families* touched instead of forks — family-probing free, outcome-shopping penalised.
**(b):** re-scale the constants so 10–15 forks still pays. **(c):** delete the row and stop claiming
to reward parsimony. **Recommendation: (a)** — the only option that makes the scoring agree with the
pedagogy §2.7.6 teaches. It is a `scoring.ts` change plus its unit tests; the invoice row keeps its
name.

### (g) gr3-024 / gr2-014 — the 60-cell press matrix · high · L
Two lanes measured the same thing independently: the bespoke guarantee is per **(scenario, tier)**
cell and only **26 of 60** cells are covered (t1 8/20, t2 9/20, t3 9/20), so on **55–58% of days the
entire press page is generic**; GR3 drove six days and **3 of 6 rendered zero scenario-bound press**;
GR2 caught the weekly pair recurrence (same two agnostic blurbs on 08-12 and 08-15) and a live day
with three generic items, two from the same outlet. **This overturns the final review's default
wontfix**, whose premise ("≥1 bespoke per scenario is guaranteed") is true per *scenario* and false
per *cell*, which is the granularity the picker actually uses. A4's conditional has fired: it becomes
a fix task. **Schedule shape (recommended): six tasks, staged by tier, EN authoring separate from
transcreation** — T39c-1 EN tier 2 (11 cells), T39c-2 IT/ES tier 2, T39c-3 EN tier 3 (11), T39c-4
IT/ES tier 3, T39c-5 EN tier 1 (12), T39c-6 IT/ES tier 1. Tier 2 first (modal outcome of a normal
hacking day), tier 3 second (where the naive and informed models actually sit, 13–27 forks). Each EN
task passes the press guards, per-locale lexicons and the em-dash budget by construction; each
transcreation task re-reads as *interface-adjacent prose* per A1. **Take the two cheap mitigations
immediately and independently of the matrix** (they are already scheduled as gr6-064 and the picker
salt): exclude card 1's outlet from card 2's pool, and salt the agnostic pick with the scenario id
so the weekly pair repetition breaks. **Recommendation: take the matrix, staged; land the picker
fixes in W6 regardless.**

### (h) gr2-018 — TIER_FORKS: the most efficient hacker gets the dullest celebration · polish · S/M
`tuning.ts:19` (`polite: 3, editorsPick: 10`). A greedy hill-climber publishes in 3–4 forks and
therefore lands tier 1 on **31/60 days**, tier 2 on 15, tier 3 on 14 — spectacle is inversely
correlated with mastery, and a skilled returning player's Act I gets quieter over time. `TIER_FORKS`
is a documented exclusion from `dgpConstantVector` (reveal.ts:126), so nothing regenerates and no
band moves (verified). **Option (a):** lower `editorsPick` 10→6 (one constant, puts a competent
player in tier 2/3 about half the time). **Option (b):** scale egregiousness on something a skilled
player actually escalates — distance from the default spec, e.g. how many of {one-tailed, subgroup,
exclusion, transform} are active — rather than on raw fork count, which measures floundering as much
as cheating. **Recommendation: (b)**, with (a) as the one-line stopgap if (b) does not fit GR6.
(b) needs a small `published.ts` change plus tests; it does not touch the reveal or the share string.

### (i) gr2-010 + gr3-027 — the share string: a run of one repeated glyph, and no hook · high · M
`share.ts:44-50` (T29's collapse of four fork glyphs onto one) and `shareString`'s line 1. Measured
range over 32 days × 3 models: **0–60 forks, all the same character**; the number that carries the
information is restated in words on the next line; the honest player's grid is two glyphs. Read
cold, there is nothing to decode. GR3 adds that the four-line object contains no content word except
"Forks", which the Legend never defines (gr6-030). **This needs a ruling because it touches §2.9's
pinned vocabulary and the spoiler law** (`share.test.ts`'s 300-draw property; the §2.9 line-3
label-colon ruling; the emoji-set collapse, itself a documented deviation).
**Recommendation, in three parts:** (1) **chunk or cap the run** (groups of five, or N glyphs + "+k")
so a 43-fork day is one readable object — pure formatting, spoiler-free, cheap; (2) **add the line-1
hook** (`P-hackle #5 · the garden of forking paths`) — brand chrome, invariant across locales, leaks
nothing, and gives a stranger a reason to click; (3) **decline the glyph-set expansion** unless the
owner wants a design pass: T29 collapsed the four kinds for a measured legibility reason and
re-splitting them re-opens it. Whatever is taken, line 3 keeps taking only `forks` and `streak`, and
the property test plus the §2.9 deviation comment are updated in the same commit.

### (j) gr2-009 + gr4-017 — the honest path has no positive moment, in any mode, ever · high · M
`reveal.ts:81`: `verdictStamp` returns `NULL_REPORTED` whenever `published === null`, so a player who
reports a null **cannot** reach REPLICATED even when they were right and the game pays them for it.
Measured: honest REPLICATED rate 0/30 structurally; GR4's first-day capture shows `unlocks=0` for
the honest path against `unlocks=3` for the publish path on the same day. And because
`first_retraction` gates Prereg Mode, integrity is a **progression dead end** — the same unlock that
gates gr6-008's replay guard. **Two moves, both needing a ruling: (1)** unlock Prereg Mode on *first
completed day* rather than first retraction. Cheap, removes the dead end, and it makes gr6-008's fix
simpler because the chooser then exists for everyone. **(2)** give the honest correct call its own
mark — an effect day abandoned is a *missed discovery*, a null day abandoned is a *confirmed null*,
two nameable outcomes currently collapsed into one grey stamp. That adds a verdict to §2.9's
vocabulary and needs a spoiler-safe glyph, so it must be ruled **together with (i)**.
**Recommendation: take (1) now** (it is the progression fix and it is nearly free), **rule (2) with
(i)**, and land the cheapest partial immediately regardless: the NULL REPORTED subline bank
(gr6-037) so Act II's quietest moment has a voice.

### (k) gr2-012 — band (b) measures a search the interface cannot perform · high · M
§3.9b walks a *uniform random permutation* of all 1,792 specs; the Lab affords exactly one move.
Measured over 60 days × 20 walks: permutation median first hit 10, single-knob walk 13, and the walk
**never finds anything in 60 moves on 19.3% of walks** (7.6% for the permutation) — against §1.2
pillar 2, "unloseable by design". The competent player's greedy hill-climb lands in 3. So the
certified number (11) sits between two experiences that differ 4×. **Option (a) report-only:** print
*both* explorers in the calibration report, pin the walk's own acceptable range, and correct §3.9b's
prose to say which explorer the 11 describes. No constant changes, no band moves (verified).
**Option (b):** if the 19.3% tail is judged unacceptable, the lever is `NULL_SIG_BAND`'s floor —
which costs the reveal's headline percentage (the controller declined this on 2026-08-03 for good
reason) and regenerates everything. **Recommendation: (a).** Note that (d)'s predicate independently
shortens the "never find anything" tail, so re-measure the walk after (d) lands before considering
(b).

---

## §2 — The ranked fix list

One row per merged item. `merged-from` lists **all** source ids. Decision-gated rows carry their §1
letter and enter a wave only after the ruling. Efforts are the lanes' own, reconciled where they
disagreed (the higher wins).

### Blockers (9)

| id | merged-from | title | sev | eff | files | fix shape | wave |
|---|---|---|---|---|---|---|---|
| gr6-001 | gr1a-001, gr1a-002, gr3-002, gr2-002 | "by chance alone" on effect days (≈70% of hits are true positives) and on null days (confounding, z=24.9, 18% vs nominal 5%) | blocker `scientific` | M | `engine/reveal.ts`, `ui/screens/Reveal.tsx`, `content/{en,it,es}/copy.ts` | day-typed `accounting1`: effect variant splits true-outcome vs other hits (one extra comparison in the existing metrics loop); null variant drops "chance" as sole cause and names the disclosed confound | W1 |
| gr6-002 | gr1a-003, gr2-017 | `pHitAtK` is a null-day-only table quoted as today's number (23% shown vs 51% true at k=5), and it models a search no player performs | blocker `scientific` | M | `engine/reveal.ts`, `data/p_hit_by_k.json`, `scripts/simulate_calibration.ts`, copy ×3 | ship `pHitNull`+`pHitEffect` vectors (the suite already simulates 500 of each), select on `dayType`, bump the checksum; add the directed-search sentence so the sentence stops exonerating efficient hackers | W1 |
| gr6-003 | gr2-003, gr3-028 | the prereg reveal runs Hacking Mode's accounting at the honest player ("You explored 1 of them"), plus an empty `call` section | blocker | M | `ui/screens/Reveal.tsx`, `game/store.ts`, copy ×3 | mode-typed block 3 (`accounting2Prereg`), "You preregistered:" framing, suppress the retraction subline in prereg, hoist `preregFalsePositive` above the stamp, render nothing (not an empty `<section>`) when `call === null` | W1 |
| gr6-004 | gr1a-004 | About claims "everything under the hood is real" and omits the rejection sampler that discards 42% of null and 26% of effect draws | blocker `scientific` | S | copy ×3 (`about.mechanism`) | two sentences in the existing clinical register naming the acceptance band and its purpose, and the effect-day gate; no engine change | W2 |
| gr6-005 | gr3-001 | every `{effect}` headline prints the literal 1 — "Meetings Run 1 Minutes Longer" on 5 of 6 live days | blocker | M | `content/{en,it,es}/index.ts`, `game/published.ts` | retire `{effect}` from the frames raw beta cannot honour (content rule 5 licenses token-free headlines; 6 worked replacements supplied); do not ship the floor-at-1 rule either way | W3 |
| gr6-006 | gr4-001 | the Call overlay has no surface: prompt at 3.64:1 paper / 2.45:1 dark, and at 360 painted across the header's own controls | blocker | S | `ui/screens/Call.css` | `background: var(--paper)` + `border-block-start/-end: var(--hairline)` (R4.2's own `Do:`, half-implemented); drop the option card's now-redundant background | W7 |
| gr6-007 | gr4-002, gr3-012 | a boot failure renders the **wrong study** (scenarioIndex 0 placeholder) with a live CTA into a Lab that can never compute | blocker | M | `ui/App.tsx`, `ScreenRouter.tsx`, copy ×3 | gate on `storeError && !booted` → render the error as the whole screen, never the placeholder briefing; add the Reload control the copy already promises (`errors.reload`) | W7 (+W2 key) |
| gr6-008 | gr2-004 | a finished day is replayable forever and the replay is silently discarded (guard lives only in a chooser honest players never unlock) | blocker | M | `ui/screens/Briefing.tsx`, `Summary.tsx` | move the already-played check out of the chooser into the Briefing; render the finished-day state (share string + countdown) as the chooser's disabled branch already does | W6 |
| gr6-009 | gr2-001 | a preregistered analysis is a false positive ~28% of the time and the game says "about 5%" | blocker `scientific` | L | DGP / copy / Stats | **DECISION §1(a)** — recommend the copy-honest option | W11 |

### High (49 in §2; 8 more are held in §1: b, d, e, f, g, i, j, k)

| id | merged-from | title | sev | eff | files | fix shape | wave |
|---|---|---|---|---|---|---|---|
| gr6-010 | gr4-005 | the RETRACTED stamp is painted 22px outside the window at ≥768 (rotated group 438px in a 320-unit viewBox) | high | S | `components/Stamp.tsx` | widen the viewBox to contain the rotated group, or inset the group; pure SVG coordinates, `min(100%,320px)` untouched | W1 |
| gr6-011 | gr4-008 | the stamp is announced twice (svg `aria-label` **and** exposed `<text>`) | high | S | `components/Stamp.tsx` | keep `role="img"`+`aria-label`, mark the inner `<text>` nodes `aria-hidden` | W1 |
| gr6-012 | gr4-007 | Share — the one social action — has no resting affordance (2px underline reserved, never filled) | high | S | `screens/Summary.css` | fill the reserve with `border-block-end: 2px solid var(--ink)` (T29 pin 4's own precedent, R4.6 idiom) | W7 |
| gr6-013 | gr4-006 | locked achievements render as `▦▦▦` and read as broken glyphs, six rows deep | high | S | `screens/Stats.tsx`, `Stats.css` | give the locked row the unlocked row's *anatomy* (outline mark in the ★ column, `--muted` rule in the name column, no citation); name-free contract and the correct a11y label unchanged | W7 |
| gr6-014 | gr4-003 | nothing locks the page behind the Call modal (document scrolls 0→250 with the overlay open) | high | S | `screens/Published.tsx` | `overflow: hidden` on the scrolling element while `callOpen`, restored by the existing `wasOpenRef`/`closeCall` pair | W7 |
| gr6-015 | gr4-009, final-006, a4-04 | nested dialogs on the published path, and the modal is named by an ellipsis eyebrow rather than by its question | high | S | `screens/Call.tsx`, `Published.tsx` | drop `role="dialog"` from `.ph-call` (wrong in both containers); move the name up — `aria-labelledby={promptId}` on the overlay | W7 |
| gr6-016 | gr4-004, a4-07 | the booked 320w overflow, owner element found: `a.ph-about__link` prints the site URL as an unbreakable 304px token (8.2px, all locales, both themes) | high | S | `screens/About.css` | `overflow-wrap: anywhere` — one declaration; re-check `documentElement.scrollWidth === 320` | W7 |
| gr6-017 | gr4-012 | nine chrome tab stops before the first content control, every screen, no skip link | high | S | `ui/App.tsx` + one copy key | visually-hidden-until-focused skip link as first child of `.ph-app`, targeting the already-focusable `<main tabindex="-1">`; reuses `.ph-visually-hidden` and R6.1's ring | W7 (+W2 key) |
| gr6-018 | gr4-010, gr2-019 | the Invoice can be a single all-zero row on the modal first day, two screens after "+25 career points" | high | M | `screens/Summary.tsx` | itemise including the zeros: render the career track as its own row/line and show parsimony at its computed value instead of omitting it; no scoring change | W6 |
| gr6-019 | gr2-006 | the award ceremony hands out the same trophies daily (Subgroup Safari on 30 of 32 days; 21 "unlocks" in week one from an 11-item set) | high | S | `game/dayComplete.ts`, `screens/Summary.tsx` | render `unlockedToday ∩ (ids with no prior unlock date)`; `persistAndComputeSummary` already holds `state.achievements` before the merge-save | W6 |
| gr6-020 | gr3-003, gr2-005 | "Try Prereg Mode" is a permanently disabled button shown at the moment the mode is announced — and on prereg days too | high | S | `screens/Summary.tsx`, copy ×3 | gate the block on `!preregPlayedToday`; drop the dead CTA and point the copy at the real door ("Tomorrow's briefing will let you choose it before you see any data.") | W6 (+W2 string) |
| gr6-021 | gr1b-003, a4-06, final-016 (issue-number) | negative `puzzleNumber` pre-EPOCH ⇒ negative array index kills §4.5's **entire 14-line retraction-subline bank**, silently; plus `10.1337/phk.-3` and "Vol. 1, No. -3" | high | S | `screens/Reveal.tsx`, `ui/App.tsx`, `game/published.ts` | `((n % len) + len) % len` at the subline lookup (grep every `puzzleNumber %` first); em-dash issue number while `practice` | W8 |
| gr6-022 | gr1b-004 | practice mode is invisible in the UI and its share string is indistinguishable from a real day (`?practice=1` lives forever post-launch) | high | M | `game/daily.ts`, `share.ts`, `ui/App.tsx`, `screens/Summary.tsx` | `--muted` practice marker beside `ph-header__vol`; `practice: boolean` on `shareString` swapping line 1 — **not** derived from day content, so the spoiler property is unaffected by construction. Structural alternative: practice days carry no daily number (also closes gr6-021) | W8 |
| gr6-023 | gr1b-023 | `wrapLabel`'s escape hatch never closes: a word longer than `maxChars` is placed unwrapped — IT "passivo-aggressività" (20ch) overruns Fig. 2's band at 440–663px containers | high | S | `components/SpecCurve.tsx` + a content shape test | hard-truncate in the forced-placement branch (`maxChars-1 + '…'`); raise `BAND_LABEL_MIN_CHARS` to cover the longest shipped token; pin longest-token-per-locale as a shape test | W7 |
| gr6-024 | gr1b-013 | ten classNames ship in the DOM with **zero** matching CSS rules — `ph-lab__footnote--armitage` is player-visible (the two peek footnotes its comment says are differentiated render identically) | high | S | `ui/**/*.css`, `screens/Lab.tsx` + 5 components | style `--armitage` or drop the modifier *and* the comment's claim; delete or implement the other nine | W7 |
| gr6-025 | gr2-008 | optional stopping — §2.4's "crown jewel" — is dead content: `one_more_batch` unlocked twice in 96 player-days | high | M | `screens/Lab.tsx`, copy ×3 | make peeking attractive rather than a fallback: surface the one thing it visibly improves (n and the CI both move — the CoefPlot interval narrows) at the button, which today reads only as "more data". Do **not** make search harder; reward-gating is out of scope unless the owner asks | W7 (+W2 string) |
| gr6-026 | gr3-008, gr1b-026, final-008, gr3-023, lm-24 (avgScore) | eight dead copy keys ×3 locales, including `nav.tagline` — the single best one-line description of the product, transcreated and rendered nowhere | high | S | copy ×3, `App.tsx`/`About.tsx`, freeze roster, shape probes | **render** `nav.tagline` (About standfirst or Briefing masthead); delete `nav.puzzleNumber`, `nav.localeToggle`, `legend.trueEffect`, `stats.avgScore` and repoint `nav.tagline`'s probes; keep `nav.title`/`a11y.closeDialog`/`a11y.shareButton` per the roster with their comments; add the defined→used direction to `copyFreeze.test.ts`. Numbering ruling: `Vol./No.` for chrome, `#` for share, nothing else | W2 |
| gr6-027 | gr3-015 | the p-value's leading zero is present in five strings and absent in three, **on the same screens** | high | S | copy ×3 | leading-zero form everywhere (`reveal.accounting1`, `legend.significant`); leave `α = .05` only while the Armitage line stays spec-verbatim (§1b); state the rule in `about.decimalNote` | W2 |
| gr6-028 | gr3-016 | "the reveal" is developer vocabulary, unglossed, in player copy in all three locales — the screen is never called that anywhere the player can see | high | S | copy ×3 + the IT/ES convention contracts | `call.title` → "Before you find out…"; `prereg.intro` reworded; amend the IT/ES contract rules that pin *la rivelazione*/*la revelación* in the same change | W2 |
| gr6-029 | gr3-017, final-005, a4-03, gr4 §2 (keep both, rename) | "Legend" names two different things on the Lab, three times in twenty words | high | S | copy ×3, `components/ForkTrail.tsx` | keep both affordances (measured: both render the same 7 rows, they answer different questions); rename the trail trigger with a new key ("What these mean") and fix `lab.forkTrailHint` | W2 + W7 |
| gr6-030 | gr3-018 | the Legend never defines "Forks" — the one word the share string prints; the concept carries three names across the product | high | S | copy ×3 | `legend.emojiSpec` opens with "A fork:"; `legend.intro` explains the trail-to-counts relationship | W2 |
| gr6-031 | gr3-019 | IT and ES each name the streak twice, one tap apart — a post-T37 regression (both keys re-authored in that round, never cross-checked) | high | S | `it/copy.ts`, `es/copy.ts` + both contracts | adopt *Serie*/*Racha* in all four places in the label-colon form; add "the streak" to the IT contract item 7 and the ES item 6 | W2 |
| gr6-032 | gr3-020 | ES ships the exact "la clave" calque its own EN source comment forbids ("the answer is on the Legend page") | high | S | `es/copy.ts` | "En la página Leyenda están todos explicados."; coordinate with gr6-029 so all three locales change once | W2 |
| gr6-033 | gr3-005 | the Lab's how-to-play step 1 tells the player to read a screen they have already left, and the four steps skip the call | high | S | copy ×3 | step 1 → "Start from the question at the top…"; step 4 → "…and say whether you believe it." | W2 |
| gr6-034 | gr3-006 | "fit"/"fitting" is unglossed jargon in 3 of the 6 methods notes and in no glossary | high | S | copy ×3 | three plain rewrites supplied; a smart 15-year-old must follow every explanation | W2 |
| gr6-035 | gr3-009 | the Stats empty state is eleven censored blocks and six em-dashes with no sentence in it — reachable on day one, one tap from every screen | high | S | copy ×3, `screens/Stats.tsx` | one key, one sentence, rendered under the title only when `played === 0` | W2 |
| gr6-036 | gr3-025 | About is seven unsignposted paragraphs with a typographic footnote wedged into the middle | high | S | `screens/About.tsx`, copy ×3 | four short `<h2>`s (*How it works / None of this is real / Your data / Where this comes from*); move `about.decimalNote` under the third and give it a reason to exist in English; `about.intro` becomes the standfirst — the natural home for `nav.tagline` | W2 |
| gr6-037 | gr3-014 | three of the ten quotable strings are unreachable or under-exposed; **NULL REPORTED renders with no subline at all** | high | S | copy ×3 (tagline), `content/index.ts` ×3 (new bank) | ship the tagline (gr6-026); leave the Armitage gate alone (deliberate, §2.4); add a tonally-matched subline bank for NULL REPORTED days — Act II's quietest moment, currently its emptiest. Cheapest partial for §1(j) | W2 + W3 |
| gr6-038 | gr3-004 | seven slot-1 outcome labels are absolute quantities the engine renders negative ("Comparison group −0.0349" of goodwill credit) | high `scientific` | S | `content/{en,it,es}/index.ts` | relabel the seven to the relative form the other thirteen already use (all seven supplied, direction contract preserved) | W3 |
| gr6-039 | gr3-007 | the jigsaw headline contradicts its own outcome 0 (fitting *more* in leaves *less* spare capacity; litres framed as a percentage) | high `scientific` | S | `content/index.ts` ×3 | relabel outcome 0 and drop the token from the headline (both supplied) | W3 |
| gr6-040 | gr3-013 | the Lab — where the player spends the whole session — has **zero** authored jokes, and the left covariate is the literal string "Household income" on 15 of 20 scenarios | high | M | `content/index.ts` ×3 | scenario-specific income proxies (8 supplied) that stay plausible so the regression stays honest; content-only, the direction contract does not apply to covariates | W3 |
| gr6-041 | gr3-032 | sixteen of twenty cover stories open with the same academic-gap sentence | high | M | `content/index.ts` ×3 | rewrite five openers to enter from elsewhere (method / person / mid-scene / objection / money — all five sketched); **keep all twenty closers**, they are the corpus's best recurring beat | W3 |
| gr6-042 | gr1b-001, final-007, lm-09 (`pending` after abandon) | `makeCall` is the one async action with no `requestSeq` guard, no `catch` and no `pending` conjunct — reachable via Escape-remount (`Call.tsx`'s guard is a ref on an unmounted component) | high | S | `game/store.ts` | the sibling shape verbatim (`myReq` capture + staleness check) plus the in-flight conjunct `preregCommit` already has; `pending: false` in `abandon()` in the same commit | W6 |
| gr6-043 | gr1b-002 | a rejected RPC strands `pending: true` forever — Prereg is a hard dead-end for the day, the Lab's Collect and Submit die, and no error surface lights | high | S | `game/store.ts`, `screens/Prereg.tsx`, `game/engineClient.ts` | wrap both actions as `commitSettledSpec` already does; durable version is one `withEngineErrors(myReq, fn)` used by all four awaiting actions; correct `Prereg.tsx`'s comment | W6 |
| gr6-044 | final-002 | `isValidV1` shallow-validates: a `version:1` blob with `stats:{}` passes and `saveDay` then NaN-poisons every counter | high | S | `game/storage.ts` | validate `stats` numerically, or merge over `freshState().stats`; add the corrupt-blob case to the storage round-trip tests | W6 |
| gr6-045 | gr1a-006, final-012c, lm-01 | `scenarioIndexFor` recurses once per day since EPOCH: measured `RangeError` at 2051, ~118ms at EPOCH+5y, and a linearly growing tax on every init | high | S | `engine/seeds.ts` | iterative forward walk producing bit-identical values (13-entry rolling window, one reused `Set`), memo map kept; regression test at EPOCH+10,000 days | W5 |
| gr6-046 | gr1a-008 | `runSpec` builds a `DataCut` the acceptance loop never reads — 51% of the precheck's cost (13.64ms → 6.64ms per 256-spec pass) | high | S | `engine/analyze.ts`, `engine/day.ts` | extract `runSpecCore`; `runSpec` layers `buildCut` on top (public surface unchanged), `nullDayPrecheckHit` calls the core; `specGrid.test.ts`'s runSpec-parity suite is the net | W5 |
| gr6-047 | gr1a-009, lm-12 | two **byte-identical** copies of the civil-calendar algorithm inside `src/engine/` — the "purity-forced" wontfix covers only the engine↔game copy | high | S | `engine/seeds.ts`, `engine/day.ts`, new `engine/civil.ts` | extract `civil.ts` (`daysFromCivil`/`civilFromDays`/`parseIso`/`formatIso`); `game/daily.ts`'s copy keeps its ruling with a pointer comment. **Verdict flip — see §5** | W5 |
| gr6-048 | gr1a-007 | the cross-platform determinism promise rests on `Math.exp`/`Math.log` (implementation-approximated), and the only cross-realm test ships one engine (V8 on both sides) | high | S+S | `playwright.config.ts`; four engine headers | add `firefox` + `webkit` projects and run `e2e/determinism.spec.ts` on all three; correct the four headers to state the real guarantee instead of "byte-identical" | W10 + W5 |
| gr6-049 | gr1b-020 | the PWA precache undoes the locale split (all three chunks, 37.3KB gz of never-used data) **and** precaches zero fonts — offline breaks R2.4's tabular numerals | high | S | `vite.config.ts` | add `woff2` to `workbox.globPatterns`; move the locale chunks to a `StaleWhileRevalidate` runtime route; verify by re-reading `precacheAndRoute` out of `dist/sw.js` | W10 |
| gr6-050 | gr1b-012, final-009, gr1b-015, gr1b-016 | five copy-pasted CSS dialects (focus ring ×22, uppercase label ×20, close button ×3, page shell ×4 spellings, entered flag ×3 names) + the 9-declaration button reset ×4 and two underline offsets | high | M | `ui/App.css` + 24 stylesheets + call sites | declare ~5 composite utilities once in `App.css` (`.ph-focusable`, `.ph-label`, `.ph-page(--titled)`, `.ph-close`, `.ph-entered`), composed by multi-class `className`; no `@apply`, no preprocessor, no new token, no changed value; pick one disabled-hover idiom. **Gated on W0** (the `.ph-entered` rename touches names R5.2/R5.6 state in prose) | W7 (after W0) |
| gr6-051 | gr1c-005, final-003 | the goldens **are** EPOCH-sensitive (`seeds.ts:104` gates the exclusion walk on `iso > EPOCH`) and two comments plus the plan claim the opposite — 4 of 5 fixtures break for a launch date ≥ 2026-09-01 | high | S | `tests/determinism/goldens.test.ts`, `tests/game/epochGuard.test.ts`, `plans/2026-08-03-phackle-v1.md:308` | correct both comments; extend `epochGuard` to assert every golden fixture date `> EPOCH` with a failure message naming `scripts/gen_goldens.ts`; keep regenerate-and-commit as an explicit deploy step | W9 |
| gr6-052 | gr1c-013, gr1c-014 | 87% of suite wall time is `expect()` overhead in four tests (engine+comparisons 0.3s, assertion machinery 27s); the timeout's stated rationale is off 5.5× | high | S | `tests/engine/dgp.test.ts` | one shared 200-seed sweep + plain-JS scan with a single `expect(bad).toEqual([])` (failure messages get *better* — the offending seed/row is named); then delete the 20s timeout and its comment. 36s → ~11s | W9 |
| gr6-053 | gr1c-024, lm-19 (routed) | the prereg spoiler "guards-the-guard" test compares `f(x)` to `f(x)` — 300 draws of a tautology | high | M | `tests/game/share.test.ts` | drive both logs through the real `store.preregCommit()` on a genuinely significant and a genuinely non-significant day, then compare share strings (keep the 300 draws there); or make the structural claim structural. Rename to what it proves | W9 |
| gr6-054 | gr1c-002, gr1c-003 | six DESIGN Tier-C laws have no automated enforcer, and two of the six commands are unrunnable as written (R6.5 hits its own comment; 768px is off the closed raw-px list) | high | S | `docs/DESIGN.md` (W0) + `tests/ui/tokens.test.ts` | one `it` per grep, comments stripped, `@media` preludes excluded, enumerations as allow-lists; name the breakpoint at DESIGN.md:731; promote the six rules to Tier A and retire the shell block | W0 + W10 |
| gr6-055 | gr1c-004 | the calibration suite never gates a push and its "too expensive" rationale is disproved (33–42s, the cheapest of the three suites, and it gets *faster* under core pressure) | high | M | `.github/workflows/{test,calibration}.yml` | add a `calibration` job to `test.yml` (paths-gated on `src/engine/**`, `src/game/tuning.ts`, `src/data/**`, the sim script); keep the weekly cron for dependency drift; correct the header claim | W10 |
| gr6-056 | gr1c-006 | no `engines` field — the wrong Node fails 270 tests with an unrelated-looking error | high | S | `package.json`, new `.npmrc` | `"engines": {"node": ">=22.22.2 <23"}` + `engine-strict=true`, so the wrong runtime fails at install with a legible message | W10 |
| gr6-057 | gr1c-027 | the README documents no commands, no runtime and no e2e prerequisite; the project reproduces perfectly for someone who already knows how | high | S | `README.md` | ~15 lines under `## Development`: Node version, `npm ci`, `npm test`, `npm run e2e` **with the `npx playwright install chromium` prerequisite**, `npm run cal` (noting it rewrites the table), `npm run dev`, and what each of the three workflows gates | W10 |
| gr6-058 | final-001 | the About page discloses an analytics setup that is not in the tree (`@vercel/analytics` absent, `inject()` has no call site) | high | S | `copy.ts:793` ×3 / `package.json` / `main.tsx` | either install and wire it at T25 or cut the sentence — **unskippable deploy-checklist step**; recommend gating the sentence on the integration landing so the tree is never self-contradicting | W10 + T25 |

### Polish (63 in §2; 2 more are held in §1: c, h)

| id | merged-from | title | sev | eff | files | fix shape | wave |
|---|---|---|---|---|---|---|---|
| gr6-059 | gr2-016 | the stamp obliterates the text it is stamped on (letterforms and a rotated subline crossing the question) | polish | S | `screens/Reveal.css`, `components/Stamp.css`, `Reveal.tsx` | offset the stamp to the cover card's lower-right quadrant; set the subline horizontally beneath the card — it is Act II's only voice on that screen and currently its least readable string | W1 |
| gr6-060 | gr4-013 | the nav's buttons move under the finger when PLAY appears (and the header grows 267→318 at 320) | polish | S | `ui/App.tsx` | reserve the slot rather than inserting one — render PLAY always (inert on the game page) or move it to the end of the nav | W7 |
| gr6-061 | gr4-015 | a screen-reader player is never told that publishing became possible (native `disabled` flip is reported only on arrival) | polish | S | `screens/Lab.tsx` + one key | a visually-hidden status line beside SUBMIT rendered only while `canSubmit`, or `aria-live="polite"` on the actions row. **Do not** make the dial chattier — its live-region calibration is measured correct | W7 (+W2 key) |
| gr6-062 | gr4-016 | the Summary is a dead end whose last word is an upsell, with no route to the honours board it just added to | polish | S | `screens/Summary.tsx` + one key | a "Your stats" action after the countdown (`App.tsx` already owns `setPage`); the prereg block keeps its place | W6 (+W2 key) |
| gr6-063 | gr4-023, a4-01, **own-01** | dial settle: the owner ruled AMPLIFY within R8.1 | polish | S | `components/PValueDial.tsx`/`.css` (+R5.2 row in W0) | promote **band changes only** to R5.3's existing loud pair (`translateY(6px)` at `--dur-scene`); same-band re-settle stays 2px/`--dur-quick`. **The ruling's illustrative "numeral weight-snap" is OUT OF LAW (R2.3/R2.4) and must not be implemented.** Free second amplifier: the p<.05 step is currently two near-identical greens (5.63→5.73) | W7 (after W0) |
| gr6-064 | gr4-014 | two press cards from the same outlet, back to back, on the day's payoff screen | polish | S | `game/published.ts` | exclude card 1's outlet from card 2's pool deterministically (reject and take the next index, never randomise); salt the agnostic pick with the scenario id in the same change to break the weekly pair repetition §1(g) measured | W6 |
| gr6-065 | gr3-010 | `published.altmetricScore` ends on a dangling "already" — reads as translated-into-English on the press-office screen | polish | S | copy ×3 | "Already mentioned {n} times online" (same token, one occurrence) | W2 |
| gr6-066 | gr3-034 | "1 day streak" — the last EN string still using the counted-noun shape the T37 ruling replaced everywhere else | polish | S | `en/copy.ts` | `'Streak: {n}'`, matching both locales and the share string | W2 |
| gr6-067 | final-004 | `a11y.themeToggle` is an action phrase naming a `role="group"` — the exact WRONG-FUNCTION class T36/T37 fixed for the locale group one control to its right | polish | S | copy ×3 | noun labels: Theme / Tema / Tema | W2 |
| gr6-068 | gr3-021a | "Analysed: 200" and "Not enough data to analyze." render in the same column from the same catalog | polish | S | `en/copy.ts` | `lab.cutLegendIncluded` → "Analyzed: {n}" (corpus default is US prose; `metres`/`litres` stay — they are SI units, not prose) | W2 |
| gr6-069 | gr3-021b | `storey` in prose, and a euro-denominated scenario whose own chyron shouts about a US retirement account | polish | S | `content/index.ts` ×3 | `twelve-storey` → `twelve-story`; the fern chyron's account reference → "PENSION" | W3 |
| gr6-070 | gr3-011 | one Grantwell subject line for all twenty-two bodies ("Re: the deadline" over a body about a rival lab) | polish | S | `content/index.ts` ×3 (+the one copy key it replaces) | a subject bank indexed by the same `pickGrantwellEmail` seed; six supplied if 22 is too many | W3 |
| gr6-071 | gr3-026 | the glossary defines its load-bearing term last and uses it in entries 1 and 6 | polish | S | `content/index.ts` ×3 | move the α/false-positive entry to position 1 (it is also the funniest); ordering only, identical in IT/ES | W3 |
| gr6-072 | gr3-030, lm-06 | the bounded-scale slot is one construction 20/20 with repeated head nouns (`sense` ×4, `confidence` ×3) | polish | M | `content/index.ts` ×3 | keep the construction (it is what a real 1–10 self-report item is called); fix the lexical repetition — five replacements supplied | W3 |
| gr6-073 | gr3-031, lm-06 | slot 1 opens with "Longest…" nine times and "Length of…" twice | polish | M | `content/index.ts` ×3 | reword four so the device drops 11/20 → 7/20 (all four supplied, skew and direction preserved) | W3 |
| gr6-074 | gr3-022 | negative numbers use ASCII hyphens in a product that typesets ≥, ×, ·, β and α correctly | polish | S | number formatter used by `CoefPlot`/`DataCut`/tick labels | format negatives with U+2212 in one helper; must not touch the share string or any `data-testid` assertion | W7 |
| gr6-075 | final-015b, lm-23 | pointerleave-on-touch flashes the trail tooltip briefly | polish | S | `components/ForkTrail.tsx` | one `pointerType` check | W7 |
| gr6-076 | lm-28 | CoefPlot baseline half outside its viewBox (booked at T31, not re-measured by any lane) | polish | S | `components/CoefPlot.tsx` | verify with GR4's probe idiom, then inset or widen; if the measurement comes back clean, close it in the ledger as resolved | W7 |
| gr6-077 | gr1b-017 | `Stamp.css` has three self-cancelling `fill` pairs — six rules doing three rules' work | polish | S | `components/Stamp.css` | ungroup the selectors | W1 |
| gr6-078 | gr1b-005 | a practice day's Summary shows a streak counting a day it never saves (invoice says N+1, storage holds N, and the number is embedded in the share text) | polish | S | `screens/Summary.tsx` | `alreadySaved \|\| practice ? state.history : {…}` | W8 |
| gr6-079 | gr1b-006 | a failed reveal re-enables the Call buttons with no message, and each retry appends another `CALL` entry | polish | S | `screens/Call.tsx`, `game/store.ts` | move the log append into the same `set` as `reveal`/`screen` so the action is atomic; the error surface lands with gr6-043 | W6 |
| gr6-080 | gr1b-007 | `isStorageOff()` — a module-level mutable `let` — is read during render (the textbook React-19 tearing shape; it works today only by call-graph accident) | polish | S | `ui/App.tsx`, `game/storage.ts` | `useSyncExternalStore`, or `useState(() => isStorageOff())` plus a re-read in the boot effect | W7 |
| gr6-081 | gr1b-008 | the app's one persistence moment (`persistAndComputeSummary`, 100 lines + a 64-line load-bearing comment + an eslint waiver) lives inside a screen component file | polish | M | `screens/Summary.tsx` → `game/dayComplete.ts` | pure relocation — it is already framework-free and `dayComplete.ts` already owns `unlockAchievements`, which it calls | W6 |
| gr6-082 | gr1b-009, lm-10 | three store-access idioms across seven screens; `UseGameStore` declared twice identically and imported screen-to-screen; `TFunction` re-typed locally six times | polish | S | `game/store.ts`, 7 screens, i18n module | hoist `UseGameStore` to `store.ts` and `TFunction` to the i18n module; delete the duplicates and the screen-to-screen import; **keep** the injectable seam — three suites depend on it | W6 |
| gr6-083 | gr1b-021 | `INEFFECTIVE_DYNAMIC_IMPORT`: the Call chunk cannot split (reachable via `abandon()`), so the dynamic import saves zero bytes and costs an empty first commit plus a **double focus move** per dialog open | polish | S | `screens/Published.tsx`, `ScreenRouter.tsx` | import `Call` statically (no cycle); keep the prop as an optional seam with a synchronous default | W7 |
| gr6-084 | gr1b-022 | 161 KB of legacy `.woff` is emitted and never fetched by any browser that can run this app | polish | S | fontsource entry points / post-build | `woff2`-only entries, or drop `*.woff` from `dist/assets`; pair with gr6-049 | W10 |
| gr6-085 | gr1b-025 | no `{`-guard on the content fields that actually feed interpolation params (`outcomeLabels`, `outcomeUnits`, `covariateLabels`, achievement names/citations, outlets, sublines, question, coverStory) | polish | S | `tests/content/shape.test.ts` | extend `findPressTokens` to sweep the param-feeding fields — ~5 lines in a file that already does this for two others | W3 |
| gr6-086 | gr1b-024, final-011 | the copy skeleton teaches a false mechanism in five places (`t()` "rewrites the first occurrence only" — the regex is global), `{n}` carries eight semantics including a percentage, the lab/reveal knob-label mirror disagrees with itself, EN has no convention-contract header, and two comment blocks are stale | polish | M | copy ×3, `it.shape.test.ts`, `es.shape.test.ts` | correct all five claims; rename the percentage token; reconcile the mirror keys; add the EN contract header; strike the stale comments and the stale `SHARED_WITH_EN` member. **Values untouched**, so freeze and spoiler tests survive | W2 |
| gr6-087 | gr1b-014 | six `@keyframes` names, two actual animations (R5.3's two pinned distances retyped as literals in six places) | polish | M | 5 stylesheets (+R5.2 rows in W0) | collapse to `ph-enter-scene`/`ph-enter-quick`; `motion.test.ts`'s `(file, identity)` pairs still catch a new unlisted identity. **Gated on W0** | W7 (after W0) |
| gr6-088 | gr1b-018 | `Published.css` holds seven blocks for four components, the corpus's only equal-specificity redefinition (`__watermark` at :162 and :276) and its only media-before-base hazard | polish | M | `screens/Published.css` (+split) | split the file by component; dedupe the watermark; move the 768px block after its base rules | W7 |
| gr6-089 | gr1b-019 | naming deviations — low-risk subset only | polish | S | `Stats.css`, `SpecControls.css`, `RadioGroup.css` | fix the two abbreviation mismatches (`__histogram`/`__hist-*`, `__achievements`/`__ach-*`) and the `ph-spec-group` ownership split across two files; leave the compound-word question alone (pure churn) | W7 |
| gr6-090 | final-010 | `tailwindcss` + `@tailwindcss/vite` are installed and wired in `vite.config`, and `@import "tailwindcss"` appears nowhere — the plugin is inert | polish | S | `vite.config.ts`, `package.json` | remove the plugin and both deps (App.css:4 already documents the situation) | W10 |
| gr6-091 | final-013, a4-08 | `pressForDay()` refactor + retirement of the `readFileSync` source-scan test | polish | M | `game/published.ts`, `tests/game/published.test.ts` | collapse the three call-site seeds into one audited function; the scan is the one test that breaks on an innocent rename. Sequence **before** §1(g)'s matrix tasks | W6 |
| gr6-092 | lm-21 | `ForkTrail` duplicates `buildTrail`'s walk — §2.10's rule now lives in two places | polish | M | `game/share.ts` (export the walker), `components/ForkTrail.tsx` | export a shared walker; the trail-vs-`countForks` test becomes the net | W6 |
| gr6-093 | gr1a-010 | `SINGULAR_EPS` is an absolute 1e-10 threshold on an unnormalised `XᵀX` whose leading entries are ~2e4 — the margin is accidental (smallest pivot observed: 1.159) | polish | S | `engine/stats.ts` | make it scale-relative (`maxAbs < EPS * scale`, EPS 1e-12); add a deliberately-collinear unit test asserting `valid === false` | W5 |
| gr6-094 | gr1a-011, final-012a, lm-04 | `generateRows` is exported with a prefix property its own effect path breaks (divergence measured at row 4) | polish | S | `engine/dgp.ts` | `if (effect !== null && n !== 400) throw` (tests use null-effect partials) and reword the JSDoc headline | W5 |
| gr6-095 | gr1a-012 | the engine-purity rule and its enforcer disagree (`reveal.ts` imports `src/data`), and the determinism op-set is enforced by nothing (`Math.pow`, `**`, trig, `Intl`, `toLocale*` are banned in prose only) | polish | S | `eslint.config.js` (+the design-spec sentence) | allow `src/data/*` explicitly and say so; extend `no-restricted-properties`/`no-restricted-syntax` to cover the named ops. Config-only | W5 |
| gr6-096 | gr1a-013 | `MIN_CELL` never binds (0 invalid points in 215,040 enumerated), so three player-visible states are unreachable — and `lab.insufficient` asserts a cause it could not know | polish | S | `engine/analyze.ts`, `specGrid.ts` comments; `copy.ts` ×3 | accept the guard as defensive and say so in one comment each; reword `lab.insufficient` so it does not assert `n < 30` ("Not enough data to analyse this cut.") | W5 + W2 |
| gr6-097 | gr1a-014 | the 1e-10 t-CDF fixture tolerance sits on the engine's accuracy floor, and the comment names the wrong term (the binding constraint is `gammln`'s Lanczos, not `BETACF_EPS`) | polish | S | `engine/stats.ts`, `tests/engine/stats.test.ts` | correct the comment; then either relax the bound to 1e-8 with a note or swap in the g=7/n=15 coefficients (free at runtime, buys ~1e-15) | W5 |
| gr6-098 | gr1a-015 | `PHitTable` is the engine's only zero-reference export with no consumer and no comment (and `assertPHitTable` is unusable from outside without it) | polish | S | `engine/reveal.ts` | drop the `export`, or export it deliberately beside `assertPHitTable` and say why | W1 |
| gr6-099 | gr1a-016 | `scenarioIndexFor` has no guard against an unsatisfiable exclusion set — an infinite loop in a worker with no message pump (unreachable today at `MIN_SCENARIOS = 20`) | polish | S | `engine/seeds.ts` | `if (count <= 13) throw` before the loop — a thrown error routes to the existing crash path; a silent hang does not | W5 |
| gr6-100 | gr1a-017, final-012b | the three mean/sd helpers are provably bit-identical (200/200 `Object.is` comparisons) — the "unify" verdict is safe to execute | polish | S | `engine/stats.ts`, `dgp.ts`, `day.ts` | delete `meanAndSd` and `sampleSd`, import `meanSd`; keep `day.ts`'s contract comment rewritten to say the shared helper is bit-identical and why that is required. Goldens are the net | W5 |
| gr6-101 | gr1a-018 | the DGP calibration note's "comfortably above 1" holds for the median only — 37% of seeds have excess kurtosis ≤ 1 | polish | S | `engine/dgpConstants.ts` | replace the phrase with the measured distribution; a per-day guarantee would be a `RHO_SHARED` retune and routes to the controller | W5 |
| gr6-102 | gr1a-019 | `console.warn` inside a worker is the only reporting channel for a cap-exhausted acceptance loop — the one condition where the reveal's promises are unbacked | polish | S | `engine/day.ts`, `protocol.ts` | put `capExhausted: boolean` on `DailyPuzzle`/`RevealPayload` (not spoiler-bearing — both day types can set it); keep the warn | W5 |
| gr6-103 | final-016a, lm-11, lm-17, lm-19 | engine/doc small-fix basket: `Object.freeze(AXES)`, `assert validCount === 448` in the family-density script, the `trueBeta` standardized-vs-raw comment addendum | polish | S | `engine/axes.ts`, `scripts/`, `engine/day.ts` | three one-liners, each pinned by an existing test or fixture | W5 |
| gr6-104 | final-016b, lm-29, ledger:188 | UI/doc small-fix basket: `RadioGroup` keydown lacks a disabled check; the Lab.css comment still says 154 where DESIGN.md:579 says 153 | polish | S | `components/RadioGroup.tsx`, `screens/Lab.css` | one guard, one number | W7 |
| gr6-105 | GR3 cross-lane note | `reveal.accounting1`'s `sigCount` rendered 122 / 149 / 194 across three runs differing only in the analysed window N — non-monotonic in N | polish | S | `engine/reveal.ts` / `day.ts` comment | re-derive over ≥50 days × {200,250,300,350,400}; expected behaviour if confirmed (the curve is computed over the visible window) — then document it in one comment so it is never re-found as a bug | W5 |
| gr6-106 | gr1c-016, final-014, a4-09 | validator re-registration: importing validators *from a test file* re-registers 44 EN tests inside each locale file — 88 duplicates, 1,300ms, and a headline count 5.9% inflated | polish | S | new `tests/content/validators.ts` | move the nine validators + lexicons + the type out of `shape.test.ts`; all three shape files import from there. Mechanical, no assertion changes | W9 |
| gr6-107 | gr1c-019, lm-09 | three brittle exact-string throw assertions (one substring does not even identify its throw uniquely) | polish | S | `game/store.ts`, `tests/game/store.test.ts` | `export const STORE_ERR = {…} as const`; throw and assert against the constants | W9 |
| gr6-108 | gr1c-020, lm-09 | `forks: countForks(log)` is recomputed at seven independent `set()` returns and the invariant is asserted mechanically nowhere | polish | S | `tests/game/store.test.ts` | one scripted-session test asserting `s.forks === countForks(s.log)` after every mutating action, including abandon and prereg | W9 |
| gr6-109 | gr1c-021, lm-09 | the `useGameStore` singleton wrapper has no direct test | polish | S | `tests/game/store.test.ts` | three lines, batched free with gr6-107/108. (GR1c offered wontfix; **A4 says fix** — it costs nothing in the same file) | W9 |
| gr6-110 | gr1c-022, lm-21 | the StrictMode guard test never enters StrictMode — it passes against an implementation with no guard at all | polish | S | `tests/ui/router.test.tsx` | wrap the render in `<StrictMode>`, keep the rerender case, mutation-verify by deleting `didBootRef` (the StrictMode variant must go red while the rerender variant stays green) | W9 |
| gr6-111 | gr1c-023, lm-24 | no `length === window` boundary case for `rollingCallAccuracy` (0, 3, 25, 30 covered; exactly 20 is not) | polish | S | `tests/game/statsAgg.test.ts` | 20-day and 21-day cases; six lines | W9 |
| gr6-112 | gr1c-025, ledger:188 | touch-test-3 does not discriminate the property it is named for (`lastPointerType` is last-write-wins, so it passes with no re-arming concept) | polish | S | `tests/ui/lab.test.tsx` | add the discriminating case (touch-enter → mouse-enter with **no** mouseLeave), or mutation-verify and rename to what survives | W9 |
| gr6-113 | gr1c-026, final-016c, lm-04, lm-07 | the CI property test branches on a re-derived `df > 0` instead of `result.valid`, so a sub-`MIN_CELL` spec silently asserts a CI relation against a placeholder; and diff-in-diff tests cover outcome 0 only | polish | S | `tests/engine/analyze.test.ts`, `tests/engine/dgp.test.ts` | branch on `.valid`; pin the two definitions' relationship once; count branch hits and assert both non-zero; parametrize diff-in-diff ×4 | W9 |
| gr6-114 | gr1c-011, lm-28 | the 360px overflow law is enforced for 2 of the 12 cells its evidence covered — and the cell that actually overflowed (it/360/game) is not one of them | polish | S | `e2e/booked.spec.ts` | parametrize `locale × {360,390} × {game, about}`; 6–12 cells at ~1s each in a 15.8s suite | W10 |
| gr6-115 | gr1c-007 | the axe scan that found and fixed two *serious* rules at T22 is not in the repo | polish | S | new `e2e/a11y.spec.ts`, `package.json` | `@axe-core/playwright` + one spec over five screens × both themes, asserting zero serious/critical. Also the enforcer for lm-24's histogram `aria-label` question | W10 |
| gr6-116 | gr1c-008 | `npm run build` succeeds and nothing reads its output — no bundle budget (112 KB gz initial today, comfortably inside 200 KB) | polish | S | `scripts/check-bundle.ts`, `test.yml` | gzip each asset, sum the initial-load set, fail over a constant, print the table either way | W10 |
| gr6-117 | gr1c-009, lm-12 | `scripts/` is outside `tsconfig.include` (so the two generators of **committed artifacts** are never typechecked) and one `.mjs` is linted by nothing | polish | S | `tsconfig.json`, `eslint.config.js` | add `"scripts"` to include; add `**/*.mjs` with node globals | W10 |
| gr6-118 | gr1c-010 | no `concurrency` group (a push train runs N obsolete e2e jobs), floating action tags, no dependabot, no audit step | polish | S | `.github/**` | concurrency block with `cancel-in-progress`; `dependabot.yml` (npm, weekly); record the SHA-pinning decision rather than leaving it unstated | W10 |
| gr6-119 | gr1c-012 | `npm run cal` reads as a verification and behaves as a generator — it rewrites a tracked source file with no `--check` mode | polish | S | `scripts/simulate_calibration.ts`, CI | put the write behind `--write`, or assert `git diff --exit-code src/data/p_hit_by_k.json` after the CI cal step (which also turns "table is stale" into a red run instead of a boot-time throw) | W10 |
| gr6-120 | gr1c-001 (residual) | the process defect behind the blocker: an artifact declared an input to a later stage lived only in a task output, and `.gitignore:31` made `git show` recovery impossible | polish | S | `.gitignore`, process note in the plan | un-ignore `.superpowers/sdd/**/*.md` (keep `worktrees/` ignored); adopt "any artifact named as a later stage's input is written to a file in the same turn it is produced" as a standing rule | W10 |
| gr6-121 | lm-24 | the Stats histogram's `aria-label` sits on a role-less span (T17 booked; no lane re-measured it) | polish | S | `screens/Stats.tsx` | verify under gr6-115's axe scan; fix only if it reds — T22's fix for this row class may already cover it | W10 (verify) → W7 (fix if red) |

---

## §3 — The GR6 wave plan

Waves are **ordered**; within a wave, items are file-disjoint enough to run as parallel implementer
tasks unless noted. Parallel groups are named. Every wave's gate is the full standard gate
(`typecheck` 0 · `lint` 0 · `vitest` exit 0 · `build` 0, exit codes captured before pipes) **plus**
the wave-specific evidence listed.

### W0 — LAWBOOK (blocking, one commit, one file)
**Items:** the R8.1 sticky-actions clause §1(e) · R5.2 row 2 second identity for the dial band change
(gr6-063) · R5.2 rows for the collapsed keyframe identities (gr6-087) · the utility-class names for
the consolidation (gr6-050) · §10 Tier-C corrections and the Tier-A promotion prose (gr6-054) ·
R5.1's stale opacity word (lm-25).
**Files:** `docs/DESIGN.md` only.
**Gate:** diff touches nothing but DESIGN.md; full suite green (no behaviour); the §10 grep block
re-run by hand and each command shown printing nothing. **Nothing in W7 may start before this lands.**

### W1 — ACT II TRUTH (the scientific blocker cluster + the stamp)
**Items:** gr6-001, gr6-002, gr6-003, gr6-098 · then the stamp sub-batch gr6-010, gr6-011, gr6-059,
gr6-077.
**Files:** `src/engine/reveal.ts`, `src/data/p_hit_by_k.json`, `scripts/simulate_calibration.ts`,
`src/ui/screens/Reveal.tsx`, `Reveal.css`, `src/ui/components/Stamp.tsx`, `Stamp.css`,
`src/content/{en,it,es}/copy.ts` (accounting keys only), `tests/engine/reveal.test.ts`,
`tests/ui/reveal.test.tsx`.
**Sub-batching:** run the engine+copy batch first, the stamp batch second (both touch `Reveal.tsx`).
**Gate:** `reveal.test.ts` (incl. the `p_hit_by_k.json` checksum pins at :303/:357) · `ui/reveal.test.tsx`
· content shape + freeze suites ×3 · `npm run cal` (5/5 bands, table regenerated with the new
two-vector shape and a bumped checksum) · goldens byte-exact · e2e 15/15 · a fresh reveal shot at
360/768 in both themes vs GR4's baseline.

### W2 — COPY CATALOG (sequenced after W1 — same three files)
**Items:** gr6-004, gr6-026, gr6-027, gr6-028, gr6-029 (copy half), gr6-030, gr6-031, gr6-032,
gr6-033, gr6-034, gr6-035, gr6-036, gr6-037 (tagline half), gr6-065, gr6-066, gr6-067, gr6-068,
gr6-086, gr6-096 (copy half), plus the new keys W6/W7 consume: `errors.reload` (gr6-007),
skip-link (gr6-017), prereg-upsell replacement (gr6-020), submit-status (gr6-061), stats action
(gr6-062), fork-trail trigger (gr6-029), peek affordance (gr6-025).
**Files:** `src/content/{en,it,es}/copy.ts`, `screens/About.tsx`, `screens/Stats.tsx`,
`tests/content/{shape,it.shape,es.shape}.test.ts`, `tests/game/copyFreeze.test.ts`.
**Batching rule:** the three locale files move together in every commit. Split into at most three
sequential sub-batches (EN authoring → IT/ES transcreation → contract/comment corrections);
**never two parallel tasks in the same copy file.**
**Gate:** all three shape suites (em-dash budget, direction contract, harm lexicon, press guards,
token-set parity) · `copyFreeze.test.ts` **with its new defined→used direction** · `a11y.test.tsx` ·
`e2e/i18n.spec.ts` (decimal-point law) · every replacement re-read *as rendered*, not in the catalog.

### W3 — CONTENT CORPUS (sequenced after W2 — shares the content shape tests)
**Items:** gr6-005, gr6-037 (subline bank), gr6-038, gr6-039, gr6-040, gr6-041, gr6-069, gr6-070,
gr6-071, gr6-072, gr6-073, gr6-085.
**Files:** `src/content/{en,it,es}/index.ts`, `src/content/journals.ts`, `tests/content/*`.
**Gate:** shape suites ×3 · `published.test.ts` (headline substitution with and without the token) ·
six live days re-driven through the real UI with the headline and Lab covariate rows quoted · scenario
parity across locales.

### W4 — PRESS MATRIX (gated on §1(g); after W3 — same files)
**Items:** the six staged tasks in §1(g). **Prerequisite:** gr6-091 (`pressForDay()`) lands first so
the new bank has one audited picker; gr6-064's outlet dedup + scenario salt land in W6 regardless.
**Gate:** press guards ×5 and per-locale lexicons · a 60-cell coverage assertion (every
(scenario, tier) cell resolves to a bespoke item) · a 3,000-date picker simulation showing the
repeat rate and zero same-outlet pairs · em-dash budget re-measured ×3.

### W5 — ENGINE HARDENING (parallel with W1–W4; goldens are the regression net)
**Items:** gr6-045, gr6-046, gr6-047, gr6-048 (header half), gr6-093, gr6-094, gr6-095, gr6-096
(comment half), gr6-097, gr6-099, gr6-100, gr6-101, gr6-102, gr6-103, gr6-105.
**Files:** `src/engine/**` (except `reveal.ts`, which W1 owns), new `src/engine/civil.ts`,
`eslint.config.js`, `scripts/*`, `tests/engine/**` (except `dgp.test.ts`, which W9 owns).
**Gate:** **goldens byte-exact** (every refactor here is self-verifying — if a byte moves they fail) ·
`specGrid.test.ts` runSpec-parity · `day.test.ts` acceptance guarantee · `npm run cal` 5/5 ·
`eslint .` 0 with the extended op-set rules · the re-measured perf table (init p50/p99, precheck pass,
`scenarioIndexFor` at EPOCH+10,000 days) posted with the report.

### W6 — GAME LOGIC & THE DAY'S FLOW (parallel with W5, W7, W9, W10)
**Items:** gr6-008, gr6-018, gr6-019, gr6-020 (logic half), gr6-042, gr6-043, gr6-044, gr6-062
(logic half), gr6-064, gr6-079, gr6-081, gr6-082, gr6-091, gr6-092.
**Files:** `src/game/**` (`store`, `storage`, `achievements`, `dayComplete`, `share`, `published`,
`engineClient`), `src/ui/screens/{Briefing,Summary,Prereg}.tsx`, `tests/game/**`,
`tests/ui/{summary,call,published}.test.tsx`.
**Gate:** store/storage/achievements/share suites · the **300-draw spoiler property** unchanged and
still green · `e2e/booked.spec.ts` · a scripted 32-day replay of GR2's three player models showing
the ceremony now fires once per achievement and the finished-day guard holds for the honest path.

### W7 — SCREENS, CSS & A11Y (after W0; parallel with W5, W6, W9, W10)
**Items:** gr6-006, gr6-007, gr6-012, gr6-013, gr6-014, gr6-015, gr6-016, gr6-017, gr6-023, gr6-024,
gr6-025, gr6-029 (component half), gr6-050, gr6-060, gr6-061, gr6-063, gr6-074, gr6-075, gr6-076,
gr6-080, gr6-083, gr6-087, gr6-088, gr6-089, gr6-104, gr6-121 (if red).
**Files:** `src/ui/App.tsx`, `ScreenRouter.tsx`, `screens/{Published,Call,Lab,Stats,About,Legend}.tsx`
and their CSS, `components/**` (except `Stamp.*`, W1's), `App.css`, `tests/ui/*`.
**Sub-batching (file overlap watch):** (7a) CSS consolidation gr6-050 + gr6-087 + gr6-088 + gr6-089 —
these touch nearly every stylesheet and must run **alone**; (7b) the blocker/high one-liners
gr6-006/012/013/014/015/016/017 — disjoint files, fully parallel; (7c) components
gr6-023/074/075/076/104; (7d) App-shell gr6-007/060/080/083 + skip link.
**Cross-wave watch:** W6 owns `Summary.tsx`; W7 owns `Summary.css`. W6 owns `game/published.ts`;
W7 owns `screens/Published.tsx`. Do not cross.
**Gate:** `tokens.test.ts` (+ the new Tier-C assertions once W10 lands them) · `motion.test.ts` both
directions and reduced-motion parity · `a11y.test.tsx` · `lab/router/shell` suites · e2e 15/15 ·
**a fresh GR4a state-matrix diff**: the 268-shot matrix re-taken and compared, with the four
"reads unfinished" cells (call overlay, stats wall, summary, error screen) explicitly re-judged ·
contrast re-probed on the Call overlay (target ≥4.5:1 for prompt and eyebrow) · `scrollWidth ===
clientWidth` at 320/360/768/1088 × 3 locales × 2 themes.

### W8 — PRACTICE MODE & PRE-EPOCH NUMBERING (after W1, W6, W7 — shares their files)
**Items:** gr6-021, gr6-022, gr6-078.
**Files:** `src/game/daily.ts`, `share.ts`, `published.ts`, `src/ui/App.tsx`,
`screens/{Reveal,Summary}.tsx`.
**Gate:** a negative-index unit test over the full subline bank · the spoiler property test with the
new `practice` input (day-type independence unchanged **by construction** — the flag is not derived
from day content) · `epochGuard.test.ts` · a pre-EPOCH clock run showing the marker, the em-dash
issue number and a share string a stranger can tell apart.

### W9 — TEST HEALTH (parallel throughout)
**Items:** gr6-051, gr6-052, gr6-053, gr6-106, gr6-107, gr6-108, gr6-109, gr6-110, gr6-111,
gr6-112, gr6-113.
**Files:** `tests/**` (`dgp.test.ts`, `analyze.test.ts`, `share.test.ts`, `store.test.ts`,
`statsAgg.test.ts`, `router.test.tsx`, `lab.test.tsx`, `goldens.test.ts`, `epochGuard.test.ts`, new
`tests/content/validators.ts`) + the `STORE_ERR` export in `src/game/store.ts` (coordinate with W6).
**Gate:** suite wall time **before and after** (target 36s → ~11s) · unique-test count (1494 reported
→ 1406 unique → the new honest number) · **mutation evidence for every rewritten test**: each must be
shown red against the defect it claims to catch and green against the fixed tree · exit codes captured
before pipes.

### W10 — INFRA, CI & DOCS (parallel throughout)
**Items:** gr6-048 (browser matrix), gr6-049, gr6-054 (enforcer tests), gr6-055, gr6-056, gr6-057,
gr6-058, gr6-084, gr6-090, gr6-114, gr6-115, gr6-116, gr6-117, gr6-118, gr6-119, gr6-120, gr6-121
(verify).
**Files:** `.github/**`, `package.json`, `.npmrc`, `README.md`, `tsconfig.json`, `eslint.config.js`
(coordinate with W5's rule additions), `vite.config.ts`, `playwright.config.ts`, `e2e/**`,
`scripts/check-bundle.ts`, `tests/ui/tokens.test.ts`, `.gitignore`.
**Gate:** all three workflows parse and run green on a real push · clean-clone repro following the new
README verbatim (`npm ci` → `npm test` → `npm run e2e` → `npm run cal`) · the bundle table printed and
under budget · determinism spec green on all three browser engines · axe: zero serious/critical ·
`git status --short` empty after the cal step.

### W11 — DGP & BALANCE (gated on §1 a, d, f, h, k — regenerates artifacts)
**Items:** gr6-009 §1(a) · §1(d) acceptance predicate · §1(f) parsimony · §1(h) TIER_FORKS · §1(k)
band-(b) reporting.
**Ordering rule:** if §1(a) option (b) is ever chosen it runs **first, before every other wave**, and
everything downstream rebases onto regenerated goldens. Under the recommended rulings only §1(d)
regenerates goldens, so W11 runs **once**, late, and the regeneration is a single commit.
**Gate:** `npm run cal` with the full band table before/after · goldens regenerated via
`scripts/gen_goldens.ts` and committed as the sanctioned drift-guard reset · `p_hit_by_k.json`
checksum consistent · a 60-day re-measurement of the default-spec-significant rate, the walk miss
rate and the tier distribution · the §3.9 prose corrected to name which explorer band (b) describes.

### W12 — SHARE & PROGRESSION (gated on §1 i, j)
**Items:** §1(i) share-string chunking + line-1 hook · §1(j) prereg unlock on first completed day
(+ the honest-call mark if ruled).
**Files:** `src/game/share.ts`, `achievements.ts`, `engine/reveal.ts` (`verdictStamp`, if (j)(2) is
taken — coordinate with W1), `screens/Legend.tsx`, copy ×3.
**Gate:** the 300-draw spoiler property (day type must remain absent from every input channel) ·
`share.test.ts` line-3 pins · the §2.9 documented-deviation comment updated in the same commit ·
Legend rows re-derived from the live mapping · a first-week replay showing the honest path now has a
positive beat.

### Execution order at a glance

```
W0 ───────────────────────────────────────────────► (blocks W7)
      W1 ──► W2 ──► W3 ──► W4(§1g)
      W5 ─────────────────────────────┐
      W6 ─────────────────────────────┤
      W7 (after W0) ──────────────────┤──► W8 ──► W11(§1a,d,f,h,k) ──► W12(§1i,j) ──► FINAL VERIFY
      W9 ─────────────────────────────┤
      W10 ────────────────────────────┘
```

**Final verification wave (per plan GR6):** full gate + calibration + goldens + E2E + a fresh GR4a
state-matrix diff + one whole-branch review over the grand-review diff only. Then the ten-step
deploy-day checklist in `final-whole-branch-review.md` (with gr6-058, gr6-051 and gr6-049 folded in)
runs as T25.

---

## §4 — No action (with reasoning preserved)

### Owner-closed (binding, 2026-08-06)
| id | merged-from | ruling |
|---|---|---|
| na-01 | own-02, a4-02, gr4-020 | **Header 3-row (really 4-row) wrap at 360 — ACCEPTED as-is.** GR4 hunted for the functional defect the ruling asks for and found none: the header is not sticky (gone at any scroll), it never interacts with the 153px sticky dial, every control clears 44px, and it causes no overflow at 320. Redesign is off the table. The one header change scheduled is gr6-060, a one-line ordering fix. |
| na-02 | own-03, gr4-021 | **IT/ES tier-3 chyron at 7 lines vs EN 4 — FINE AS-IS, closed.** Measured on the real build: 225px headline / 312px block worst case at 360, 2 lines everywhere at 1088. At 7 lines it still reads as an over-excited chyron, not a layout failure; every alternative costs R2.2's closed scale or the line's timing. |
| na-03 | own-04, a4-05, gr4-022 | **Masthead watermark head-vs-foot — LEAVE AS-IS.** Two different physical objects (a stamp across a masthead; a compliance line under a quote). GR4: "I would not have raised it." |
| na-04 | own-05, gr2-020, lm-29 | **Prereg days never fire the hacking-satire achievements — KEEP THE WALL.** Structurally impossible via `publishedSpecFromLog`, and it should stay so: the satire targets the behaviour and the behaviour is absent. GR2 agrees on the merits. **GR2's companion recommendation — add 2–3 prereg-specific citations — is OVERRULED BY OWNER and is NOT scheduled.** Recorded here only so it is not re-proposed; if Carlos revisits, it re-enters as a new item. |

### Verification records (informational, no work)
| id | merged-from | record |
|---|---|---|
| na-05 | gr1b-010 | **`Dots` IS memoized** (`SpecCurve.tsx:400`, T29 pin 7's rationale in place). This **closes the first half of [final-015]** and the adjudication table's "T16 hover re-renders 1792 circles → Fix: memoize the static plate" — the verdict is already satisfied in the tree. See §5, conflict 2. |
| na-06 | gr1c-015 | Nothing else is near its timeout: only one test outside `dgp.test.ts` exceeds 1s, at under a third of budget; no second flake candidate. |
| na-07 | gr1c-017 | Flake surface green in six configurations (32-core, 2-core pinned, dgp solo, clean clone, e2e, cal); `retries: 0` with a correct rationale. |
| na-08 | gr1c-018 | Three fabrication-precedent spot-checks re-verified genuine, including the 180k-day press simulation reproducing exactly and the em-dash density recomputed within 0.6% in the direction the ledger records. |
| na-09 | gr4 §6 | Clean sweep recorded so it is not re-hunted: zero horizontal overflow anywhere except gr6-016; 44px minimum tap targets; storage-disabled notice correct and the game fully playable; screen-change focus correct; Escape + focus restore correct; reduced-motion parity complete; the fork-trail popover no longer widens the document; the T22 tooltip-pattern deferral is **resolved** (it is a disclosure, not a tooltip). |
| na-10 | gr1a §perf, §A2 | The engine's machinery is verified correct: t-CDF ≤3.5e-14 at p=.05 across every df; incomplete beta vs four closed forms; OLS 5.6e-15; PRNG discipline sound; the determinism op-set clean across all 12 files by grep; all 24 glossary entries correct in all three locales; every other `about.mechanism` claim checks. Perf: warm init p50 24ms / p99 150ms, reveal p50 21ms — phone budget plausible. |

### Wontfix, with reasoning
| id | merged-from | reasoning |
|---|---|---|
| na-11 | gr4-018 | **Chyron reads as "a larger press card" below 768.** T29 measured the badge channel at ~94px of a 312px column; restoring it re-opens the exact defect T29 fixed, and the tier-3 moment still reads as the loudest thing on the screen. |
| na-12 | gr4-019, lm-28 | **The dial numeral breaks between "p =" and the value at 360.** This is R8.1's own documented floor and the reason the sticky block is 153px; `white-space: nowrap` would overflow the 312px column. Registered in DESIGN.md; the block still occupies 24% of a 640px phone with eight radios visible beneath it. |
| na-13 | gr1b-011 | **`SpecCurve.tsx` / `DataCut.tsx` geometry split.** GR5 rules wontfix: it is pure relocation of ~65% of two files with zero behaviour change, and it would run head-on into W7's stylesheet-wide consolidation on the two largest components in the tree. The finding's value was diagnostic — a reviewer hunting "component too big" should not mis-diagnose them — and that value is captured by recording it here. Controller may overrule cheaply post-deploy. |
| na-14 | gr3-033, lm-05 | **The acronym journal-name joke (`journals.ts:17`).** Master-spec-verbatim, and `JournalCover.css:16` uppercases it, so the lowercase letter is invisible on screen and inaudible to a screen reader reading the same DOM text. Nil player impact in every channel. |
| na-15 | gr3-029, lm-08 | **"still" ×3 as a recruitment marker** — re-counted across the whole EN corpus: five occurrences, exactly one a recruitment marker, ordinary density across ~20,000 characters; later rewrites already dissolved the echo. **Label-maker tense wobble** — correct English (standing protocol / unbounded-period fact / specific past responses), the same sequence eight other cover stories use deliberately. |
| na-16 | lm-01, table (T1) | DST-test discrimination, leap-day direct tests, CI npx cosmetics — coverage taste; the goldens plus `epochGuard` cover the load-bearing part. (The recursion-depth half of this ledger line **is** scheduled, as gr6-045.) |
| na-17 | lm-02, table (T28) | `FOCUS_SUPPRESSION_RE` bare-prefix, Tier A hyphen wording, doc-drift word boundaries — all fail-safe direction. |
| na-18 | lm-03, table (T2) | `number[]` vs "Float64Array" phrasing; the n=31 "exact" interpretation — documented, no consequence. |
| na-19 | lm-04 residue, table (T3) | Y4 clamp classification and `t5Scale` naming — naming taste; the calibration bands pin the behaviour. |
| na-20 | lm-05 residue | T4's `correspondingAuthor` and scope-read notes. **Gap flagged (see §5, conflict 10):** these have no verdict in the authoritative table. GR5 rules wontfix — GR3 read every user-facing string as rendered across 21 screen-states and neither surfaced as a defect. |
| na-21 | lm-12 residue, table (T9) | `SCENARIO_COUNT` triplication, `gen_goldens` exit path, leap-day cross-check — scaffolding hygiene, cross-tested. (The `daysFromCivil` half **flips to fix** — gr6-047; the `scripts/` half is gr6-117.) |
| na-22 | lm-13, table (T13) | `ModeHistory` type duplication (deliberate no-import, documented both sides, shapes must-and-do match); `loadStats` untested; symbolic-constant asserts; double `loadState`; `true_detective` tie-break (documented in code at `achievements.ts:70-74`). |
| na-23 | lm-14, table (T9) | Cap-exhaustion tie-break untested — a compound rare event whose behaviour is arguably more correct, documented. (The *reporting* half is scheduled as gr6-102.) |
| na-24 | lm-15, lm-16, lm-18, table (T21) | Favicon `<rect>`-vs-`<path>`, unescaped `<` in a meta string, `fc-list` substring match, stale citation, truthy/nullish prose, self-audit enumeration — cosmetic or report-level. |
| na-25 | lm-17 residue, table (T10) | `N_SCHEDULE` rationale wording and the "all-invalid curve" test name. (The 448-denominator assert **is** scheduled, in gr6-103.) |
| na-26 | lm-19 residue, table (T11) | Spoiler-scan spec variety and the `idx === -1` string reuse. (The `trueBeta` comment addendum is in gr6-103; the *other* spoiler test's vacuity is gr6-053, a different test.) |
| na-27 | lm-20 residue, table (T16) | Leader at rank≈0, `call.title` case vs R2.7, "Fig." in mono, `volume: 1`, the truth line, shipped `data-*` attributes, sub-.10 width note — recorded design notes; the geometry note is a v2 thought. |
| na-28 | lm-22, table (T15) | Empty-overlay claim, header-not-inert, test title, watermark DOM order, `pickJournal` check. **Resolved by GR4's live measurement**: the cover carries both `inert` and `aria-hidden`, `aria-modal="true"` suppresses the header for AT, and the Tab trap holds — the modal contract is correct except the two defects filed as gr6-014/gr6-015. |
| na-29 | lm-23 residue, lm-26, table (T15/T16) | Initial-width frame, I2 fixture naming, monotonicity sampling, "already used" framing, altmetric sizing rationale. (The pointerleave half **is** scheduled as gr6-075.) |
| na-30 | lm-27, table (T30) | `decisiveTails` comment — **resolved**, the current comment names the N-independence mechanism plainly. `saveAchievements` changed-tracking unreachable — defensive. |
| na-31 | lm-28 residue, table (T31) | **Tap targets — resolved**: GR4 measured a 44px minimum on every screen at 360, including the two-per-row radiogroups. **"Got it" affordance — resolved** by T29 pin 4 (and its precedent is what gr6-012 applies to Share). Stale shots — superseded by GR4's 268-shot matrix. |
| na-32 | lm-30, table (T31) | Practice-seed evidence hygiene (`Math.random` ⇒ no exact repro) — process note, recorded. |
| na-33 | table (T37) | IT `playPrereg` two-line CTA escape hatch — documented owner-taste option; not taken. |
| na-34 | table (T19/T20) | `retirad`/`ritirat` marathon-retirement residual — a documented cura-style boundary; two-sided lexicon tests guard the shipped jokes, and rewording would cost the pun. |
| na-35 | table (T24) | `jsdom` EBADENGINE warning — pre-existing npm noise; CI pins Node 22. Partly superseded by gr6-056, which makes the local requirement explicit. |
| na-36 | table (controller) | Controller-side test repoints at the T15 merge and the copy-freeze precision fix — accepted; the gate has run green ~40 times since and the freeze harness carries negative-case pins. |
| na-37 | table (T23) | The reviewer's "injected system-reminder" environment note — no code impact; evidence culture held. |
| na-38 | table, gr1c-001 | **[gr1c-001] is RESOLVED**: the full final-review text (16 findings + adjudication table + dead-key roster + 10-step checklist) was recovered by the controller and persisted at `final-whole-branch-review.md`. Only the process fix remains open, as gr6-120. |
| na-39 | table (T24) | `--with-deps` unverified on a real runner — a deploy-day watch item, now step 9 of the T25 checklist. |
| na-40 | table (T35/T38) | R5.6 association-check precision — **resolved** (selector-association with both-direction mutation proof at `motion.test.ts:438,499`). Reachability-test placement — **resolved**, it lives beside the picker it guards and is mutation-verified. |

### Dead-key roster carried unchanged (final review, definitive)
Removed by gr6-026: `nav.localeToggle`, `nav.puzzleNumber`, `legend.trueEffect`, `stats.avgScore`,
`nav.tagline`'s probe repoints (the key itself is **rendered**, not removed — GR3's evidence upgrades
the roster's "remove + repoint" to "render + repoint"; see §5, conflict 5).
Kept with reasons: `nav.title` (specimen role in LocaleProvider/freeze tests), `a11y.closeDialog`
(render-dead by T22 design, negative test pins absence), `a11y.shareButton` (same class),
`legend.emojiSubgroup/Exclusion/Tails` (load-bearing — the Legend auto-expands correctly if the
fork-glyph set ever splits back).

---

## §5 — Conflicts between lane evidence and pre-adjudicated verdicts

Every pre-adjudicated verdict in `final-whole-branch-review.md` carries over unrelitigated **except**
these. Each is a place where a lane produced new evidence the adjudication did not have.

1. **Calendar duplication — "wontfix, purity-forced" FLIPS TO FIX.** (gr1a-009 vs the T9 row.) The
   purity argument holds for the engine↔`game/daily.ts` copy and is factually inapplicable to the two
   *engine-internal* copies, which `diff` proves byte-identical and which import each other freely
   everywhere else. → gr6-047.

2. **"T16 hover re-renders 1792 circles → Fix: memoize the static plate" is ALREADY SATISFIED.**
   (gr1b-010 vs the T16 row and final-015's first half.) `Dots` is memoized at `SpecCurve.tsx:400`
   with T29 pin 7's rationale. No work. The *second* half of final-015 (the touch tooltip) is real and
   scheduled as gr6-075.

3. **The 60-cell press matrix's "default wontfix" rests on a false premise.** The table's reasoning —
   "≥1 bespoke per scenario is guaranteed, repeat rate measured 12%" — is true per *scenario* and false
   per *(scenario, tier) cell*, which is the granularity `pickPress` actually uses. Two lanes measured
   26/60 coverage, 55–58% fully generic days, 3 of 6 live days with zero bound press, and a weekly
   pair recurrence. A4's conditional has fired. → §1(g).

4. **The owner's dial-settle ruling names an out-of-law example.** The *direction* (AMPLIFY within
   R8.1) is binding and carried. The illustrative "numeral weight-snap" violates R2.3 ("mono is never
   anything but 400") and R2.4 (every numeral is mono) and **must not be implemented** — a fix task
   that does will fail tier-B review. GR4's in-law substitute (band change → 6px / `--dur-scene`) is
   what is scheduled. → gr6-063.

5. **The dead-key roster's verdict on `nav.tagline` upgrades from "remove + repoint" to "render +
   repoint".** GR3's rendered read identifies it as the single best one-line description of the
   product — already transcreated into both locales — and the product has no other line that tells a
   first-time visitor what it is. Removing it would delete the fix. → gr6-026 / gr6-036.

6. **The practice-mode verdict holds but its scope was understated.** The table booked "renders
   Vol. 1, No. -5". GR1b probed the live modules: the number is −3 today and the same negative index
   silently kills **§4.5's entire 14-line retraction-subline bank** on every RETRACTED day before
   EPOCH, plus the DOI. Same verdict (fix), materially larger fix. → gr6-021/gr6-022.

7. **Two lane header counts are wrong in their own summaries** (bookkeeping, no impact on triage):
   `findings-writing.md` says 19 high / 13 polish and contains **20 / 12**; `findings-ux.md` says
   9 high / 12 polish and contains **10 / 11**. This synthesis uses the recounted figures.

8. **`plans/2026-08-03-phackle-v1.md:308` is still wrong in the tree.** The final review recorded it;
   nobody has corrected the line. Scheduled inside gr6-051 so the plan and the test comments stop
   teaching a false EPOCH-immunity claim.

9. **`gr1c-021` (singleton wrapper untested) — GR1c recommended wontfix; GR5 schedules it.** A4
   supersedes the effort-based deferral and the test batches free into the same file as gr6-107/108.

10. **Two §F ledger rows have no verdict anywhere in the authoritative table** — lm-05's T4 residue
    (`correspondingAuthor`, scope read) and lm-22's T15 :124 set. GR5 adjudicated both in §4
    (na-20, na-28); flagged so the controller knows these two verdicts are GR5's, not the final
    review's.

11. **GR3 filed a cross-lane observation no lane owned**: `sigCount` rendered 122 / 149 / 194 on one
    pinned date across runs differing only in the analysed window N — non-monotonic in N. Expected if
    the curve is computed over the visible window, but nobody has re-derived it. Scheduled as a
    verification item, gr6-105.

---

## §6 — Provenance

Sources: `findings-code-engine.md` (GR1a, 19) · `findings-code-gameui.md` (GR1b, 26) ·
`findings-code-infra.md` (GR1c, 27) · `findings-game.md` (GR2, 20) · `findings-writing.md` (GR3, 34) ·
`findings-ux.md` (GR4, 23) · `final-whole-branch-review.md` ([final-001..016], adjudication table,
dead-key roster, 10-step deploy checklist) · `backlog-draft.md` §A–§F ·
`.superpowers/sdd/2026-08-03-phackle-v1/progress.md:227-236` (OWNER RULINGS 2026-08-06, binding) ·
`docs/superpowers/plans/2026-08-04-grand-review.md` (amendments A1–A4) · `docs/superpowers/GOAL.md`.

Closure rule (A3): an item closes when its lane reads clean against the goal's properties, not when a
patch lands. Every wave's gate above is written to produce that evidence.
