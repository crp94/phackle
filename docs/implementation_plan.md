# P-hackle — Implementation Plan

**A daily game about the garden of forking paths.** You are handed a fresh synthetic dataset and an absurd hypothesis. You will reach p < 0.05 — the game guarantees it — and then it will show you exactly what you did.

*Version 1.0 · July 2026 · Spec for implementation with Claude Code*

---

## How to use this document

This is a complete, self-contained specification. It is written to be handed to Claude Code and implemented milestone-by-milestone (§9). Sections 2–4 define the product exactly; §5–7 define the technical architecture and UI; §8–9 define validation and sequencing. Anywhere a number is a judgment call rather than a requirement it is marked **[TUNABLE]** and collected in the tuning table (§3.9). Nothing in v1 requires a backend.

**Suggested `CLAUDE.md` seed for the repo:**

```
This repo implements P-hackle per docs/implementation_plan.md.
Non-negotiables: (1) full determinism — same date ⇒ identical puzzle on all
clients; (2) the statistical engine is validated by the test suite in §8
before any UI work builds on it; (3) all game-balance constants live in
src/game/tuning.ts; (4) no backend, no accounts, no personal data in v1.
When in doubt, the plan wins over improvisation; flag conflicts instead of
silently deviating.
```

---

## 1. Product overview

### 1.1 Elevator pitch

Every day, P-hackle deals you a synthetic dataset and a ridiculous headline to prove ("Does owning a cat improve cryptocurrency returns?"). Your toolbox is the real one — outcome switching, subgrouping, covariate shopping, outlier surgery, one-tailed tests, optional stopping. When you cross p < 0.05, the game celebrates sincerely: confetti, a fake journal, fake press. Then the reveal: the full specification curve of every analysis you *could* have run, your path highlighted, the true effect (usually zero) stamped across it, and your headline **RETRACTED**. The skill ceiling: some days the effect is *real*, and before the reveal you must call it — signal or self-deception. The long-run leaderboard measures that call.

### 1.2 Design pillars

1. **The game is sincerely on the side of the hack.** Act I never winks. The satire lives entirely in the contrast between Act I's enthusiasm and Act II's deadpan accounting. Microcopy discipline: enthusiastic before the reveal, clinical after, never smug.
2. **Unloseable by design, and that's the lesson.** On null days, significance is always reachable (§3.3 guarantees it). The sinking feeling of realizing the game cannot be lost *is* the pedagogical payload.
3. **The real skill is epistemics, not hacking.** Scoring rewards the real/noise call, parsimony, and (in Prereg Mode) restraint — never the hack itself.
4. **Everything is honest under the hood.** Data is genuinely simulated from the declared DGP; regressions are real OLS; the specification curve is exhaustively enumerated, not faked. The about page discloses the entire mechanism. A methods nerd auditing the code should find nothing to object to — that's part of the joke's integrity.
5. **Daily ritual mechanics.** One puzzle per day, deterministic worldwide, streaks, spoiler-safe emoji share grid.

### 1.3 Audience & register

Primary: scientists, students, data-literate public (the Wordle-adjacent crowd that shared FiveThirtyEight interactives). Secondary: methods/stats educators (classroom use is a deliberate v2 target). Register: mock-academic. English v1; copy centralized for later i18n (Spanish is the obvious v2 locale).

### 1.4 Prior art (cite on the About page)

- FiveThirtyEight, *Hack Your Way to Scientific Glory* (Aschwanden & King, 2015) — owns the core demonstration; one-shot, real data, no ground truth, no daily loop. P-hackle's deltas: daily seed, known DGP with reveal, the real/noise call, prereg contrast, share grid, (v2) reviewer mode.
- Simonsohn, Simmons & Nelson — specification curve analysis (the Act II centerpiece is literally their figure).
- Gelman & Loken — the garden of forking paths (the fork emoji's intellectual ancestor).
- Simmons, Nelson & Simonsohn (2011), *False-Positive Psychology* — source of the researcher-degrees-of-freedom inventory the toolbox implements.
- Armitage et al. — optional stopping α-inflation (quoted in-game when the player peeks).

### 1.5 Explicit non-goals (v1)

No backend, no accounts, no server-side leaderboard, no Reviewer Mode (v2, §11), no real datasets, no multiplayer, no mobile app (responsive web only), no monetization ever.

---

## 2. Game design specification

### 2.1 Daily structure

- **Puzzle number:** `#N = daysBetween(EPOCH, todayLocal) + 1`, `EPOCH = 2026-09-01` **[TUNABLE]**. Local-midnight rollover (Wordle convention; accept the timezone fuzz).
- **Day type:** `effect` with probability 0.25, else `null` — decided deterministically from the seeded hash (§3.1), never disclosed before the reveal. **[TUNABLE]**
- **Modes:** *Hacking Mode* (default daily) and *Prereg Mode* (§2.6, same day's scenario/DGP, separate score track, unlocked after the player's first retraction).
- **One play per mode per day.** Practice mode (`?practice=1`, random non-daily seed, unscored) for testing and streamers.

### 2.2 Game flow (state machine)

```
BRIEFING ──> LAB ──(p<.05 & submit)──> PUBLISHED ──> CALL ──> REVEAL ──> SUMMARY
   │           │
   │           └──(abandon: "report null")──────────> CALL ──> REVEAL ──> SUMMARY
   └──(prereg unlocked: choose mode first)
```

### 2.3 BRIEFING — the setup

A scenario card (§4.1): the absurd research question, a one-paragraph cover story, the cast of variables. Then the daily email from **Prof. Grantwell** (§4.2) setting stakes: *"Reviewer 2 wants significance by Friday. The renewal depends on it."* CTA: **"Open the data"**.

### 2.4 LAB — Act I, the workbench

The player configures a **specification** and sees live results for it. Layout: controls left, results right (stacked on mobile).

**The specification (researcher degrees of freedom):**

| Knob | Options | Count |
|---|---|---|
| Outcome variable | 4 scenario-themed outcomes (e.g., 30-day returns, portfolio volatility, trades/week, self-reported financial wellbeing) | 4 |
| Subgroup filter | All participants; Age < 40; Age ≥ 40; High experience; Low experience; Urban; Rural | 7 |
| Covariate adjustment | Any subset of 2 designated controls (e.g., Income, Risk tolerance): none / A / B / A+B | 4 |
| Outlier exclusion | None; \|z\| > 3; \|z\| > 2.5; \|z\| > 2 (on the chosen outcome, within the filtered sample) | 4 |
| Transform | Raw; log1p (shifted if needed, §3.5) | 2 |
| Test tails | Two-tailed; one-tailed (in the hypothesized direction) | 2 |

**Path space: 4 × 7 × 4 × 4 × 2 × 2 = 1,792 specifications.** This is the number the reveal is built on. Keep it in the 1,000–3,000 band **[TUNABLE]** — rich enough that significance is ~always reachable, small enough that the specification curve stays legible.

**Optional stopping (the crown jewel):** sample starts at N = 200. Button: **"Collect 50 more participants"**, up to N = 400 (4 presses). The full N = 400 is pre-generated; the lab merely widens the window (§3.8). Each press while a p-value is visible logs a `PEEK_AND_EXTEND` fork. After the 2nd press, a small footnote fades in: *"Fun fact: peeking five times at α = .05 inflates your false-positive rate to ~14% (Armitage, 1969)."* — the only Act-I moment allowed to wink, and it's easy to miss.

**Live results panel** for the current spec: point estimate + 95% CI (coefficient plot), **the p-value in large type** (this is the game's HP bar; color ramps toward green as it approaches .05, crossing triggers a glow + "SUBMIT TO JOURNAL" enabling), N after exclusions, a tiny scatter/box visual of the current cut, and the **fork trail** so far (emoji strip, §2.9). Every spec change from a viewed result logs a fork (§2.10).

**Actions:** `SUBMIT TO JOURNAL` (enabled iff current spec p < .05) or `Report a null result` (always available; "abandon" path — scored as integrity, §2.8).

### 2.5 PUBLISHED — the payoff

Full-screen celebration, played 100% straight: confetti; a generated journal "cover" (journal name from §4.3 matched to scenario, e.g., *Nature Feline Finance*); the player's headline typeset as a citation; a fake altmetric counter spinning up; 1–2 fake press blurbs (§4.4). **Egregiousness scaling:** intensity of the celebration scales with fork count (t.b. tiered: ≤3 forks = polite acceptance letter; ≥10 forks = "EDITOR'S PICK", TV-news blurb, extra confetti). The more you hacked, the more the world loves you.

### 2.6 THE CALL — the skill moment

Modal, before any truth is revealed:

> **Between us: what do you think you found?**
> ○ A real effect — this would replicate.
> ○ Noise I dressed up — this would not replicate.
> Confidence: 50–100% slider. **[v1.1 if time-pressed; binary call is the v1 core]**

The call (not the hack) is the primary scored act (§2.8). Players who abandoned also make the call (it resolves as: was there an effect you walked away from?).

### 2.7 REVEAL — Act II, the specification curve

The deadpan accounting, staged as an animated sequence (respecting reduced-motion):

1. **Truth line:** "True effect of [cat ownership] on [everything measured]: **0.000**." (Effect day: "True effect on [30-day returns]: **β = 0.24** — and only that outcome.")
2. **Specification curve** (the centerpiece, "Figure 1", §7.4): all 1,792 paths, p-values sorted ascending, significance threshold as a horizontal rule, **significant region tinted**, the player's explored paths as marked points, their published path in red with a callout showing its full recipe.
3. **The accounting**, typeset like a results paragraph:
   - "Of 1,792 possible analyses, **87 (4.9%)** reach p < .05 by chance alone." *(computed exactly from the enumerated curve)*
   - "You explored **14** paths before publishing."
   - "A researcher exploring 14 paths at random finds at least one 'significant' result **~52%** of the time." *(from the offline-simulated lookup table, §3.7)*
   - Optional-stopping surcharge if used: "Your 3 data-peeks multiply the true path count ~5×."
4. **Verdict stamp:** null day + published → a red, rotated, rubber-stamp **RETRACTED** slams onto the journal cover (the game's signature moment — see §7.1). Effect day + published + the player's spec family actually captured it → **REPLICATED** stamp in green. Effect day but the player hacked an unrelated outcome into significance → **RETRACTED** *(yes: you can fabricate a false positive on a true-effect day by publishing the wrong outcome — the reveal says so explicitly)*.
5. **Call resolution:** correct/incorrect, updating the calibration record.
6. **Where the effect lived** (effect days): the curve re-sorts grouped by outcome, showing significance clustering on the true outcome — teaching, visually, that *robustness across specifications* is the real/noise detection skill. Null days show the same view: hits scattered thinly everywhere. This grouped view is the single most important educational graphic in the game.

### 2.8 SUMMARY & scoring

Daily score (all constants **[TUNABLE]**, live in `tuning.ts`):

| Event | Points |
|---|---|
| Correct call (real/noise) | +100 |
| Incorrect call | 0 |
| Parsimony bonus (only if call correct) | max(0, 40 − 4 × forks) |
| Published (flavor "career points", separate cosmetic counter) | +25 career |
| Honest abandon on a null day ("integrity bonus") | +80 |
| Honest abandon on an effect day (missed discovery) | +20 |
| Prereg: significant on effect day (true discovery) | +150 |
| Prereg: non-significant on null day | +100 |
| Prereg: non-significant on effect day (underpowered luck) | +40 |
| Prereg: significant on null day (a real 5% false positive — teachable) | 0, plus a special one-line reveal |

Tracked stats (localStorage, §5.6): call accuracy (all-time + rolling-20), calibration (if slider ships), current/max daily streak, career points, fork histogram, prereg-vs-hacking win rates side by side — the Prereg Mode reveal always shows this comparison: **watching your own "success" rate collapse from ~100% (hacking) to ~5% (prereg, null days) is the concept of α, felt in the body.**

### 2.9 Share grid (the viral mechanism)

Spoiler-safe, compact, legible enough that methodologists screenshot each other's crimes:

```
P-hackle #37
🍴🎯🍴🔪➕🍴📄 → ⚖️✅
7 forks · streak 12
phackle.example
```

**Emoji legend** (in-game legend screen; order = actual action order):

| Emoji | Meaning |
|---|---|
| 🍴 | Any spec change (outcome/covariates/transform) |
| 🎯 | Subgroup filter change |
| 🔪 | Outlier exclusion change |
| 🌗 | Switched to one-tailed |
| ➕ | "Just one more batch" (peek + extend N) |
| 📄 | Submitted & published |
| 🏳️ | Reported a null result |
| 🧾 | Preregistered (prereg mode prefix) |
| ⚖️✅ / ⚖️❌ | Call correct / incorrect |

**Spoiler rule:** the grid reveals whether the *call* was correct but never the call's direction — so it never leaks whether today is a null or effect day. Enforced in the share-string generator's tests.

### 2.10 Fork logging (exact rule)

A "fork" is counted when the player **changes the specification after having seen a result** for the previous one. The initial default spec is free. Rapid multi-knob changes before results render (300 ms debounce) count once. `PEEK_AND_EXTEND` always counts. The full action log (ordered, timestamped) is the source of truth for share grid, achievements, parsimony bonus, and the reveal's "you explored k paths" figure (k = distinct specs viewed, ≤ forks + 1).

### 2.11 Achievements

| Name | Trigger |
|---|---|
| First Blood | First publication |
| First Retraction | First RETRACTED stamp (unlocks Prereg Mode) |
| HARKing | Change outcome variable ≥3 times in one day, then publish |
| The One-Tailed Bandit | Publish where flipping to one-tailed was the decisive fork (p crossed .05 on that action) |
| Outlier Surgeon | Publish with the most aggressive exclusion (\|z\| > 2) active |
| Subgroup Safari | View results in ≥5 different subgroup filters in one day |
| Just One More Batch | 3+ peek-and-extends in one day |
| Garden of Forking Paths | ≥25 distinct specs viewed in one day |
| The Monk | 20 Prereg Mode days played |
| Well, Actually | Correct "noise" call on a day you published (you knew, and did it anyway) |
| True Detective | 10 consecutive correct calls |
| Reviewer 2 | *(reserved for v2 Reviewer Mode)* |

Achievement copy tone: deadpan, one line each, written like award citations (§4.5).

---

## 3. Statistical engine specification

The engine is a pure, UI-free TypeScript module (`src/engine/`), deterministic, fully unit-tested before any UI exists (milestone M1). It runs in a Web Worker (§5.4).

### 3.1 Determinism & seeding

- **PRNG:** `splitmix32`-seeded `mulberry32` (32-bit, fast, adequate; implementation in Appendix A). No `Math.random()` anywhere in the engine — lint rule enforced.
- **Seed derivation:** `seed = fnv1a32("phackle:" + isoDate + ":" + attempt)` where `attempt` is the rejection-sampling counter (§3.3). All clients on the same date produce byte-identical puzzles. Scenario selection: `scenarioIndex = fnv1a32("scenario:" + isoDate) % scenarios.length`, with a no-repeat-within-14-days rotation check.
- **Day type:** `effect iff (fnv1a32("daytype:" + isoDate) % 100) < 25`.
- **Float determinism:** use only +,−,×,÷, sqrt, exp, log on f64 (IEEE-754-deterministic across mainstream JS engines); avoid `Math.pow` with non-integer exponents in the DGP path. The determinism test (§8.2) guards this with golden-master fixtures.

### 3.2 Data-generating process

For each day, generate the **full** N = 400 sample up front (optional stopping just widens the visible window — critical: extending N never re-rolls anyone).

**Latent covariates:** `L ~ MVN(0, R₈)` via Cholesky of a fixed 8×8 correlation matrix `R` (moderate structure, entries 0.1–0.4; the exact matrix is a checked-in constant with its Cholesky factor precomputed and unit-tested for PSD).

**Observed covariates** (scenario supplies display names/units; structure is fixed):

| Var | Construction |
|---|---|
| age | 46 + 12·L₁, clamped [22, 70] |
| region (Urban/Rural) | 1[L₂ + 0.3·L₁ > 0] |
| experience (Low/Med/High) | tertiles of L₃ |
| income | exp(10.5 + 0.6·L₄) (log-normal) |
| risk_tolerance | 5 + 2·L₅ clamped [0, 10] |
| Z₆–Z₈ | held latent (drive correlation texture only) |

**Treatment:** `X = 1[0.3·L₁ + 0.2·L₄ + 0.94·ε > 0]`, ε ~ N(0,1) — mild confounding with age and income so covariate adjustment *matters* and adjustment-shopping is a live fork.

**Outcomes** (4, with correlated errors, corr ≈ 0.3 via a shared factor):

`Yⱼ = γⱼ·L + βⱼ·X + eⱼ`

- **Y₁** (e.g., 30-day returns): heavy-tailed — `e₁ = t₅-like` via scaled ratio construction (Appendix A) → genuine outliers exist, so outlier surgery is a live fork.
- **Y₂** (volatility-like): log-normal-ish positive skew → log1p transform is a live fork.
- **Y₃** (count-like, trades/week): Poisson-ish via rounded exp-normal.
- **Y₄** (satisfaction 1–10): discretized + clamped.

**Null day:** βⱼ = 0 ∀j.
**Effect day:** pick `j* = fnv1a32("effoutcome:"+isoDate) % 4`; standardized effect `d` drawn uniformly from [0.18, 0.30] **[TUNABLE]**; with probability 0.5, add heterogeneity: β 1.6× larger in one deterministic subgroup — so subgroup analysis is *occasionally the truth*, which keeps the moral honest (forking is a validity problem, not a sin per se).

### 3.3 Hackability guarantee (rejection sampling)

Generate with `attempt = 0, 1, 2, …` until the day's dataset passes acceptance; all clients replay the same loop, so determinism holds.

- **Null-day acceptance:** the count of significant paths in the full enumerated curve at N = 200 lies in **[30, 180]** **[TUNABLE]** — enough that essentially every exploration strategy can find a hit, few enough that the reveal's "4.9% by chance" line stays truthful-feeling.
- **Effect-day acceptance:** the *canonical spec* (true outcome j*, All participants, both covariates, no exclusion, canonical transform, two-tailed) has **p < .05 at N = 400 AND p < .15 at N = 200** — findable, not screaming.
- **Perf guard:** cheap pre-check on a fixed 256-path subsample before full enumeration; cap attempts at 20, then accept the best-scoring attempt (log a console warning; the calibration suite §8.3 verifies this is <1% of days).

### 3.4 Analysis engine

For a specification S on the current window N:

1. Filter rows by subgroup; 2. apply transform to outcome; 3. apply outlier exclusion (z-scores computed on the transformed outcome *within the filtered sample* — document this choice in the About page, it's itself a fork you've frozen); 4. OLS of outcome on [1, X, chosen covariates] via QR or normal equations with typed arrays (p ≤ 4 predictors — normal equations are fine); 5. t-statistic on the X coefficient, df = n − p; 6. p-value via regularized incomplete beta (Appendix A); one-tailed = half the two-tailed p when the sign matches the hypothesized direction, else 1 − p/2.

Guards: minimum n after filtering/exclusion = 30 (below that the spec renders "insufficient data" and is excluded from the curve — count and mention in the reveal if any).

### 3.5 Transforms

log1p applied as `log(1 + y − min(0, min(y)))` (shift only when negatives exist) so it's defined for returns; label honestly in the UI as "log-ish transform (don't ask)".

### 3.6 Specification-curve enumeration

All 1,792 specs evaluated at the player's final N (plus, for the reveal's chance-line, at N = 200 during generation acceptance). Budget: ≤ 400 ms in the worker (typed arrays, reuse of filtered/sorted intermediates by memoizing on (subgroup, transform, exclusion) → ~112 distinct data preps × 16 cheap regressions each). Cache the day's curve in memory; recompute only on N change.

### 3.7 Reveal metrics

- **Chance line:** exact count/fraction of significant paths in today's enumerated curve.
- **P(≥1 hit | k explored):** from a **build-time simulation** (script in `scripts/simulate_calibration.ts`): 500 simulated null days × random k-subsets for k = 1…40 → `src/data/p_hit_by_k.json`. This bakes in the true inter-path correlation (an analytic 1−(1−q)^k would overstate). Regenerate whenever the DGP or path space changes (checksum of DGP constants embedded in the JSON; engine asserts match at startup).
- **Optional-stopping surcharge:** displayed multiplier = 5^(peeks used)/… no — keep honest and simple: "your m peeks make the true number of analyses ≈ (m+1)× larger than the curve shows."

### 3.8 Optional stopping mechanics

Window sizes {200, 250, 300, 350, 400}. The `PEEK_AND_EXTEND` action re-runs the current spec (and invalidates the curve cache). The pre-generated-N rule means a spec's trajectory across peeks is realistic (estimates wander, p bounces) — this is the mechanic teaching sampling variability for free.

### 3.9 Tuning knobs (all in `src/game/tuning.ts`)

| Knob | Default | Notes |
|---|---|---|
| P(effect day) | 0.25 | Leaderboard base-rate; do not change post-launch (breaks comparability) |
| Effect size d range | [0.18, 0.30] | Calibrate so canonical-spec power at N=400 ≈ 0.6–0.8 |
| Null-day sig-path acceptance band | [30, 180] | Calibrate via §8.3 |
| Path-space size | 1,792 | Change only with p_hit table regen |
| N schedule | 200→400 by 50 | |
| Min cell size | 30 | |
| Scoring constants | §2.8 table | |
| Debounce for fork counting | 300 ms | |

**Calibration targets (verified by §8.3, not hand-waved):** (a) ≥99% of null days have ≥30 significant paths; (b) median "paths to first hit" for a greedy random explorer ∈ [4, 12]; (c) effect-day canonical power at N=400 ∈ [0.6, 0.85]; (d) an "informed caller" heuristic (calls *real* iff the published spec's outcome family holds ≥60% of the day's significant paths) achieves 75–90% call accuracy — i.e., the call is learnable but not trivial. **[TUNABLE]**

---

## 4. Content specification

All content in `src/content/` as typed constants; no content in components. Tone rules: Act I sincere, Act II clinical; scenario harm-check: hypotheses are absurd-but-benign (no real medical/vaccine/nutrition claims a screenshot could launder as real findings — cats and crypto, yes; drugs and diseases, no).

### 4.1 Scenarios (ship ≥ 20; 10 fully written below, plus template)

Each scenario: `id, question, coverStory, treatmentLabel, outcomeLabels[4], covariateLabels, journalPool, pressPool`.

1. **Cat/Crypto** — "Does owning a cat improve cryptocurrency returns?" Outcomes: 30-day returns, portfolio volatility, trades/week, financial wellbeing (1–10).
2. **Standing desks / poetry** — "Do standing desks make middle managers write better poetry?" (expert-rated verse quality, metaphors/stanza, submissions/month, self-assessed profundity).
3. **Sourdough / marathon** — "Does baking sourdough improve marathon times?" 
4. **Jazz / spreadsheets** — "Does listening to jazz reduce spreadsheet errors?"
5. **Houseplants / negotiation** — "Do office ferns make you a tougher negotiator?"
6. **Cold showers / email tone** — "Do cold showers make your emails more passive-aggressive?" (sentiment score, exclamation marks/email, 'per my last email' frequency, reply latency).
7. **Astrology app / parking** — "Do horoscope readers find parking faster?"
8. **Mechanical keyboards / code quality** — "Do mechanical keyboards reduce bugs shipped?"
9. **Dog names / stock picks** — "Do people with dogs named after economists beat the market?"
10. **Lunar phase / meeting length** — "Do meetings run longer under a full moon?"

Template for authoring more: *[mundane lifestyle trait] × [outcome domain with 4 measurable-sounding metrics, one heavy-tailed, one skewed, one count, one bounded scale]*.

### 4.2 Prof. Grantwell emails (≥ 12, rotating)

Email-client styling, escalating desperation flavor bank. Samples:
- "Reviewer 2 wants significance by Friday. The renewal depends on it. I believe in you (and have no alternative)."
- "The dean asked if our work is 'impactful'. I said yes. Make that retroactively true."
- "Remember: a p-value of .06 is just a p-value of .05 with poor time management."
- "I told the funding agency this was 'high-risk, high-reward'. Deliver the second part."

### 4.3 Journal names (matched by scenario domain)

*Nature Feline Finance* · *The Lancet of Lifestyle Optimization* · *Journal of Irreproducible Portfolio Science* · *PNAS: Proceedings of the National Academy of Suspicious findings* · *Annals of Statistical Ambition* · *Cell (Spreadsheet)* — pool of ~15, weighted by scenario tags.

### 4.4 Press blurbs (fake, obviously watermarked "SIMULATED PRESS")

- "Scientists say: your cat may be your best financial advisor." — *Morning Chirp*
- "One weird trick statisticians PUBLISH with." — *The Daily Scroll*
- Egregiousness tier 3 adds a TV chyron mock: "STUDY: FERNS = LEVERAGE?"

### 4.5 Reveal & achievement copy

Retraction stamp sublines (rotating): "The effect was 0.000. It was always 0.000." · "Your headline has been quietly removed from the university homepage." Achievement citations: e.g., *Outlier Surgeon — "For services to the removal of inconvenient humans."*

---

## 5. Architecture & tech stack

### 5.1 Stack (and why)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | Claude Code fluency; fast static builds |
| State | **Zustand** (single store, persist middleware) | Tiny, testable outside React |
| Styling | **Tailwind + CSS variables** for the token system (§7.2) | Speed + themable |
| Charts | **Custom SVG components** (no chart lib) | The spec curve is bespoke; libs fight you (§7.4) |
| Math | Hand-rolled OLS/t on Float64Array; no jStat dependency | Determinism, bundle size, auditability |
| Concurrency | 1 Web Worker (engine) + Comlink-style thin RPC (hand-rolled, no dep) | Keep 60 fps during enumeration |
| Persistence | localStorage (versioned JSON schema, §5.6) | No backend |
| Testing | **Vitest** + Playwright (3 E2E smoke flows) | §8 |
| Deploy | Static: Cloudflare Pages / GitHub Pages, custom domain (e.g., `phackle.carlosrodriguezpardo.es`) | Same ops as Climatle |

PWA manifest + offline cache: cheap and on-brand for a daily game — include in M5.

### 5.2 Repository structure

```
phackle/
├── CLAUDE.md                      # §"How to use this document" seed
├── docs/implementation_plan.md    # this file
├── index.html · vite.config.ts · tailwind.config.js
├── scripts/
│   └── simulate_calibration.ts    # builds p_hit_by_k.json + calibration report (§3.7, §8.3)
├── src/
│   ├── engine/                    # PURE, no React imports (lint-enforced)
│   │   ├── prng.ts                # mulberry32, splitmix32, fnv1a32
│   │   ├── dgp.ts                 # §3.2 generation + §3.3 rejection loop
│   │   ├── stats.ts               # OLS, t CDF (incomplete beta), z-scores
│   │   ├── analyze.ts             # §3.4 single-spec pipeline
│   │   ├── specGrid.ts            # §3.6 enumeration + memoized preps
│   │   ├── reveal.ts              # §3.7 metrics assembly
│   │   ├── types.ts               # §6
│   │   └── worker.ts              # RPC surface: generateDay, runSpec, enumerate, revealMetrics
│   ├── game/
│   │   ├── store.ts               # Zustand: machine state (§2.2), action log
│   │   ├── tuning.ts              # §3.9 — every constant
│   │   ├── scoring.ts · achievements.ts · share.ts · storage.ts · daily.ts
│   ├── content/
│   │   ├── scenarios.ts · grantwell.ts · journals.ts · press.ts · copy.ts
│   ├── data/p_hit_by_k.json
│   └── ui/
│       ├── screens/  (Briefing, Lab, Published, Call, Reveal, Summary, Prereg, Stats, About, Legend)
│       ├── components/ (PValueDial, ForkTrail, SpecControls, CoefPlot, JournalCover, Stamp, ConfettiLayer, EmailCard)
│       ├── charts/SpecCurve.tsx
│       └── theme/tokens.css
└── tests/  (engine/ · determinism/ · game/ · e2e/)
```

### 5.3 Data flow

```
daily.ts (date → seeds) ─→ worker.generateDay ─→ DailyPuzzle (cached in worker)
UI spec change ─→ debounce 300ms ─→ worker.runSpec ─→ PathResult ─→ store ─→ Lab
SUBMIT/ABANDON ─→ store advances machine ─→ CALL ─→ worker.enumerate + revealMetrics ─→ REVEAL
REVEAL complete ─→ scoring.ts + achievements.ts + storage.ts ─→ SUMMARY (+share.ts)
```

### 5.4 Worker protocol

Request/response with ids; engine owns the day's dataset (the main thread never holds raw data — prevents casual devtools spoilers of the day type, which lives worker-side until reveal; determined cheaters are out of scope and welcome to their hollow victory, which is itself on-theme).

### 5.5 Error states

Worker crash → full-screen "The replication crisis has reached our servers. Refresh." Generation attempt-cap fallback logs to console only.

### 5.6 Persistence schema (versioned, `phackle.v1`)

```ts
{ version: 1,
  history: Record<IsoDate, DayRecord>,   // score, mode(s) played, forkTrail, call, verdict
  stats: { streak, maxStreak, callsCorrect, callsTotal, careerPoints,
           preregDays, hackDays, forkHistogram: number[] },
  achievements: Record<AchievementId, IsoDate>,
  settings: { reducedMotion?: boolean, theme?: 'paper'|'dark' } }
```

Migration function stub from day one (`migrate(v, data)`), because there will be a v2.

---

## 6. Core TypeScript interfaces

```ts
export type DayType = 'null' | 'effect';
export type Outcome = 0 | 1 | 2 | 3;

export interface Spec {
  outcome: Outcome;
  subgroup: 'all'|'age_lt40'|'age_ge40'|'exp_high'|'exp_low'|'urban'|'rural';
  covariates: { income: boolean; risk: boolean };
  exclusion: 'none'|'z3'|'z2_5'|'z2';
  transform: 'raw'|'log1p';
  tails: 'two'|'one';
}

export interface PathResult {
  spec: Spec; n: number; beta: number; se: number; t: number; p: number;
  ci: [number, number]; excludedCount: number; valid: boolean; // n>=30
}

export interface DailyPuzzle {           // worker-side only until reveal
  isoDate: string; puzzleNumber: number; scenarioId: string;
  dayType: DayType; trueOutcome?: Outcome; trueBeta?: number;
  heterogeneous?: { subgroup: Spec['subgroup']; multiplier: number };
  attemptUsed: number; nFull: 400;
}

export type PlayerAction =
  | { t: 'VIEW_SPEC'; spec: Spec; at: number }
  | { t: 'PEEK_AND_EXTEND'; newN: number; at: number }
  | { t: 'SUBMIT'; spec: Spec; p: number; at: number }
  | { t: 'ABANDON'; at: number }
  | { t: 'CALL'; verdict: 'real'|'noise'; at: number };

export interface RevealMetrics {
  totalPaths: number; sigPaths: number; sigFraction: number;
  playerExplored: number; pHitAtK: number;           // from lookup table
  curve: { p: number; explored: boolean; published: boolean; outcome: Outcome }[];
  stamp: 'RETRACTED'|'REPLICATED'|'NULL_REPORTED';
  peeks: number;
}

export interface DayRecord {
  mode: 'hack'|'prereg'; score: number; forks: number;
  callCorrect?: boolean; stamp: RevealMetrics['stamp'];
  shareString: string;
}
```

(Claude Code may extend, not contradict, these.)

---

## 7. UI / UX specification

### 7.1 Design language: "Preprint Gothic"

The game about academic publishing should look like academic publishing. The interface is a mock **journal manuscript** — paper-white cards, LaTeX-flavored serif typography, figure captions, a running header ("*P-hackle · Vol. 1, No. {puzzleNumber}*") — inhabited by game-y intrusions (confetti, glowing p-value, rubber stamp). The tension between the two registers *is* the visual identity, exactly mirroring the Act I/Act II tonal split.

**Signature element:** the **RETRACTED stamp** — oversized, rotated ~ −12°, distressed rubber-stamp texture (SVG filter, no image assets), slamming onto the journal cover with a single heavy motion + subtle paper-shake (skipped under reduced-motion, replaced by instant appearance). One memorable thing; everything else stays quiet and disciplined.

### 7.2 Design tokens (`ui/theme/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FBF8F1` | Background (light default) |
| `--ink` | `#1C1B18` | Text |
| `--rule` | `#D8D2C4` | Hairlines, borders |
| `--sig-red` | `#B3261E` | Stamp, published path, p<.05 threshold rule |
| `--assist-green` | `#2E6E4E` | REPLICATED, integrity bonus, "better" states |
| `--hack-gold` | `#B98A2C` | Confetti/celebration accents, career points |
| `--muted` | `#6E6A5E` | Captions, footnotes |

Dark theme (optional toggle, matches Climatle's slate world): `--paper→#141821`, `--ink→#E8E4D9`, keep the red/green/gold, raise their luminance ~10%.

**Type:** Display/serif: **STIX Two Text** (LaTeX-adjacent without being a Computer Modern cosplay) for headlines, scenario prose, reveal paragraphs. Numbers & p-values: **JetBrains Mono** (tabular figures — the big p-value must not jitter as digits change). UI labels: system sans stack. The big p-value is the second signature: 64–96 px mono, centered, color interpolating from `--muted` toward `--sig-red` as p → .05, with a 1-frame tick animation on update.

### 7.3 Screen-by-screen

- **Briefing:** scenario card as a manuscript title page (title = research question, "Corresponding author: You"); Grantwell email as a skeuomorphic email card below; single CTA.
- **Lab:** two-pane (≥768 px) / stacked (mobile: results pinned top, controls scroll). Controls are segmented button groups (no dropdowns — every fork should be one visible tap; dropdowns hide the garden). Results panel: PValueDial (the big number + N + df), CoefPlot (estimate + CI as a horizontal interval against a zero line), ForkTrail (live emoji strip), and the always-visible pair of actions (Submit disabled until p<.05, "Report a null result" in quiet text style).
- **Published:** full-bleed takeover; JournalCover component (generated masthead, headline set in display serif, fake DOI `10.1337/phk.{n}`); confetti layer (canvas, ≤400 particles, 3 s, gold/paper colors); SIMULATED PRESS blurb cards sliding in; single CTA "Face the truth" → Call.
- **Call:** modal over dimmed cover; two large option cards; (v1.1: confidence slider).
- **Reveal:** vertical scroll sequence, each block fading in on scroll (or all-at-once under reduced motion): truth line → SpecCurve fig.1 → accounting paragraph → stamp moment → call resolution → (effect days) grouped-by-outcome curve as fig.2 with one-line caption: "Real effects cluster. Noise scatters."
- **Summary:** score breakdown table (styled as a fee invoice from the journal — flavor), share button (native share API + clipboard fallback), streak/stats strip, "Play Prereg Mode" upsell if unlocked, countdown to next puzzle.
- **Prereg screen:** the same SpecControls but rendered as a **preregistration form** (checkbox: "I solemnly commit"), then data reveal → single result → reveal.
- **Stats:** call accuracy (all-time + last 20), prereg-vs-hacking "success" rates side by side (the α lesson, always visible), fork histogram, achievement wall (locked = embossed blind stamps).
- **About/Methods:** full mechanism disclosure, DGP summary, prior-art citations (§1.4), "the data is synthetic; no cats were financialized" disclaimer, link to source.
- **Legend:** emoji key (§2.9).

### 7.4 SpecCurve component (the centerpiece — build with care)

Custom SVG. X = path rank (sorted by p ascending), Y = p (linear 0–1 with an inset zoom band 0–0.10, or a broken axis — decide in implementation; the zoom band is recommended so the interesting region isn't 5% of the pixels). Elements: threshold rule at .05 (`--sig-red`, dashed, labeled); significant region tint; all paths as 1.5 px points (`--rule` color); explored paths as 4 px `--ink` points; published path as 6 px `--sig-red` with a leader line to a recipe callout ("Y₂ · Age<40 · +Income · |z|>2.5 · log · one-tailed"). Interactions: hover/tap any point → tooltip with its full recipe + p (this browsing is quietly the best teaching in the game). Fig. 2 variant: same data, x-grouped into 4 outcome bands. Performance: 1,792 static circles is fine; render once, no re-layout.

### 7.5 Motion & a11y

Motion budget: confetti (Published), stamp slam (Reveal), p-value tick, scroll fades — nothing else. `prefers-reduced-motion` collapses all to opacity/instant. Full keyboard operability (segmented controls are radiogroups); focus visible; stamp verdict also rendered as text; colorblind-safety: published-path red is paired with shape (ring) not color alone; contrast ≥ 4.5:1 on all text tokens.

### 7.6 Meta / share surface

OG image (static, pre-made): the RETRACTED stamp over a blurred journal cover + tagline "You will find p < 0.05. That's the problem." Title: "P-hackle — the daily p-hacking game". Favicon: 🍴 on paper.

---

## 8. Testing & validation plan

### 8.1 Engine unit tests (Vitest, `tests/engine/`)

- OLS/t correctness against ≥10 golden fixtures (precomputed externally — e.g., statsmodels — and checked in as JSON with 1e-9 tolerances). Include edge cases: perfect collinearity guard, n = 31, all-excluded subgroup.
- Incomplete-beta t-CDF vs. fixture table across df ∈ {10, 50, 200, 398}, t ∈ [−5, 5].
- DGP moment checks: covariate correlations within ±0.05 of R over 200 seeds; treatment balance 0.5 ± 0.05; heavy-tail check on Y₁ (kurtosis > 4 median across seeds).
- Exclusion/transform/filter pipeline: hand-computed 12-row micro-dataset fixture.

### 8.2 Determinism tests (`tests/determinism/`)

- Golden-master: 5 fixed dates → full `DailyPuzzle` + first-40-rows hash + enumerated-curve hash, committed as fixtures; CI fails on any drift. (This is the test that catches an accidental `Math.random`, an engine upgrade, or a DGP edit without a version bump.)
- Cross-realm: run the same seeds in worker and main thread, assert identical output.

### 8.3 Statistical calibration suite (`scripts/simulate_calibration.ts`, run in CI weekly + on any engine diff)

Simulates 500 null + 500 effect days and asserts the §3.9 calibration targets: null-day hackability ≥99%, greedy-explorer median paths-to-hit ∈ [4,12], effect-day canonical power ∈ [0.6, 0.85], informed-caller accuracy ∈ [0.75, 0.90], rejection-loop attempts p99 ≤ 20. Also regenerates `p_hit_by_k.json` and fails if the embedded DGP checksum went stale. **This suite is the game's balance sheet — M1 is not done until it passes.**

### 8.4 Game-logic tests (`tests/game/`)

- Scoring table (§2.8) exhaustively.
- Fork counting: debounce, free initial spec, PEEK always counts.
- Share string: legend mapping, spoiler rule (property test: share strings from (null, correct-call) and (effect, correct-call) days are distribution-indistinguishable given the same action pattern).
- Achievements: each trigger + non-trigger.
- Storage migration stub round-trip.

### 8.5 E2E (Playwright, 3 flows)

1. Hack → publish → call → reveal → share (assert clipboard content).
2. Abandon (integrity) path.
3. Prereg full flow. Plus a visual snapshot of Lab and Reveal at 375 px and 1280 px.

### 8.6 Manual QA checklist

Reduced-motion pass; keyboard-only full game; iOS Safari (100vh, clipboard); date rollover at local midnight (fake clock); localStorage-disabled graceful degrade (session-only play).

---

## 9. Implementation milestones (Claude Code work order)

Each milestone ends with its acceptance criteria green before the next begins.

**M0 — Scaffold (½ day):** Vite+React+TS+Tailwind+Vitest+worker wiring; PRNG + seeding; determinism harness with 2 placeholder fixtures. ✅ CI runs, determinism test passes.

**M1 — Engine (1–2 days), no UI:** DGP, stats, analyze, specGrid, rejection loop, reveal metrics, calibration script + `p_hit_by_k.json`. ✅ §8.1–8.3 all green. *This is the riskiest milestone; do it first and do not shortcut the calibration suite.*

**M2 — Lab (1–2 days):** store + machine, SpecControls, PValueDial, CoefPlot, ForkTrail, live worker round-trip, optional stopping, fork logging. ✅ Playable spec-exploration with live p; fork log matches §2.10 in tests.

**M3 — Full loop (1–2 days):** Briefing, Published (confetti, cover, egregiousness tiers), Call, Reveal (SpecCurve fig.1+2, stamp, accounting), Summary. ✅ E2E flow 1 passes; SpecCurve interactive tooltips work.

**M4 — Meta-game (1 day):** scoring, achievements, share string, localStorage stats/streaks, daily rollover, Stats screen, Legend. ✅ §8.4 green; share spoiler property-test green.

**M5 — Prereg + polish (1–2 days):** Prereg mode, About page, dark theme, PWA, OG assets, a11y pass, deploy to static host + domain. ✅ E2E 2–3 green; Lighthouse a11y ≥ 95; deployed URL live.

Total: ~6–9 focused days. Content authoring (§4, to 20 scenarios) can proceed in parallel any time after M0.

---

## 10. Deployment & operations

Static build → Cloudflare Pages (or GitHub Pages) → CNAME `phackle.carlosrodriguezpardo.es`. No server, no cron: the "daily puzzle" is pure client-side date math. Analytics: none in v1, or Plausible if desired (no cookies, note it on About). Cache policy: hashed assets immutable; `index.html` no-cache so daily code pushes propagate. Version string surfaced in About + share footer for bug reports.

---

## 11. v2 roadmap (design-sketched, deliberately out of scope)

- **Reviewer Mode** (the arms race): needs a minimal backend (Cloudflare Workers + KV/D1). Clients POST anonymized `DayRecord` action logs (opt-in banner); the API serves batches of yesterday's logs for real-or-hacked judging; detector-accuracy leaderboard. The hacker/detector co-evolution is the long-term content engine.
- **Research instrument:** with consent language done properly, the corpus of forking strategies + detection accuracy + calibration curves is publishable (methods/education venues; the game *about* QRPs should itself be preregistered — OSF, for the bit and for real).
- **Confidence slider + calibration plot** (if not in v1.1).
- **Classroom mode:** instructor seed links (`?seed=…&reveal=off`), shared-screen reveal, CSV export of a class's spec choices.
- **Spanish localization.** All copy is already centralized (§4).
- **Scenario packs / community scenarios** via PR (schema in §4.1).

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Null days not hackable enough → frustration | Rejection sampling (§3.3) + calibration CI (§8.3) make this a tested property, not a hope |
| The call is guessable (base rate 75% "noise" → always-say-noise = 75%) | Leaderboard metric is accuracy *above base rate* (display both); informed-caller target band (§3.9d) ensures real skill headroom; consider balanced scoring (+100 correct-real vs +67 correct-noise) as a tuning option **[TUNABLE]** |
| Spec curve illegible on mobile | Zoom band design (§7.4), fig.2 grouped view carries the lesson even if fig.1 is skimmed |
| Players screenshot Act I "findings" without the reveal | SIMULATED watermark on cover/press assets; absurd-benign scenario policy (§4) |
| Float nondeterminism across engines | Restricted op set (§3.1) + golden-master CI (§8.2); worst case, ship precomputed daily seeds table |
| Satire reads as endorsement | About page discloses everything; Act II copy stays clinical; the prereg contrast is always one tap away |
| Someone reads worker memory to cheat | Out of scope by design (§5.4) — cheating at a game about cheating is auto-satire |

---

## Appendix A — Numerical recipes (implement exactly)

**PRNG:**
```ts
export function splitmix32(a: number) { return function() {
  a |= 0; a = (a + 0x9e3779b9) | 0;
  let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
  t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
  return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296; }; }
export function fnv1a32(s: string) { let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); } return h >>> 0; }
```
Gaussian: Box–Muller from two uniforms (cache the spare). Heavy tail for Y₁: `t ≈ z0 / sqrt((z1²+z2²+z3²+z4²+z5²)/5)` (exact t₅ via chi-square-of-normals — stays within the allowed op set).

**t-distribution p-value:** two-tailed `p = I_{df/(df+t²)}(df/2, 1/2)` where `I` is the regularized incomplete beta via Lentz continued fractions (standard NR implementation, ~40 lines); validate per §8.1.

**OLS:** normal equations on Float64Array with p ≤ 4: build XᵀX (4×4), solve by Gaussian elimination with partial pivoting; `se = sqrt(σ̂² [XᵀX]⁻¹_XX)`, `σ̂² = RSS/(n−p)`.

## Appendix B — Glossary (for the About page)

p-hacking · researcher degrees of freedom · garden of forking paths · specification curve · HARKing · optional stopping · preregistration · α / false-positive rate — one-sentence definitions each, linked from reveal copy.

---

*End of plan. The game cannot be lost. That is the point.*
