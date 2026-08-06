# GR3 — Writing lane findings

**Review SHA:** `7e417f4` (build/v1) · **Read-only.** No file in `src/` was modified.
(Agent's file write was blocked; persisted verbatim by the controller from the lane reply.)

**Method.** Dev server (`npx vite`, port 5199) driven with Playwright under the E2E
harness's fixed-clock/seeded-storage technique, so every screen below was read AS
RENDERED, not out of the catalog: Briefing (first-run + mode chooser), Lab
(intro open, intro dismissed, after 1 and 2 peeks), Published (tiers 1/2/3),
Call, Reveal (published / abandoned / prereg-false-positive), Summary (all three),
Stats (empty + played), Legend, About, the storage-off notice, and 15 further
simulated days for the press mix.

**Laws applied to every proposed replacement:** register (Act I sincere / Act II
clinical / the Armitage footnote is Act I's only wink), the direction contract
(more of the metric = more of the claimed effect), the em-dash budget (the EN
corpus contains exactly 3 U+2014, two inside chyrons and one `stats.noData`; no
replacement below adds one), the `{n}`/`{effect}` token rules, and the
one-token-once interpolation rule.

**Counts:** 2 blocker · 19 high · 13 polish = **34 findings**.

---

## GR3a — Line edit

### [gr3-001] Every `{effect}` headline prints the number 1, and two of them print "1 Minutes"

- **Severity:** blocker · **Effort:** M
- **Where:** `src/content/en/index.ts` — 19 of 20 `headline` fields; substitution in
  `src/game/published.ts:substituteEffect` (~line 92). Renders as the largest string
  on the Published screen (`JournalCover`).
- **Evidence.** Six published days driven through the real engine and the real UI.
  Five of six hero headlines printed the literal number **1**; two are ungrammatical:

      2026-08-11  Meetings Run 1 Minutes Longer Under a Full Moon, Analysis Finds
      2026-08-12  Telescope Owners Give Directions 1% More Efficient Than the App
      2026-08-14  Customers Who Read the Terms Receive €1 More in Goodwill Credit
      2026-08-16  Stair-Takers Score 1% Higher on Workplace Rapport
      2026-08-19  Sock-Folders Arrive 1 Minutes Earlier, Six-Week Study Finds
      2026-08-20  Standing Desks Linked to a Renaissance in Middle-Management Verse
                  <- the ONE token-free headline

  Cause: `Math.max(1, Math.round(Math.abs(beta)))`, where `beta` is the treatment
  coefficient **in the published outcome's own raw units**. Effects at this scale are
  fractions of a minute, of a euro, of a percentage point, so the floor fires
  essentially always. A second, independent defect rides along: the headline's
  *frame* is fixed per scenario but the number comes from whichever of four outcomes
  the player published, so a 1–10 self-rating can print as "€1 More in Goodwill
  Credit" or "1% Higher Returns".
- **Why blocker.** This is Act I's payoff line, set in display serif at the top of
  the celebration, and on most days it reads as a rounding bug. Self-evidencing: the
  only headline in the sample without a token is the only one a player would
  screenshot.
- **Fix shape (writing-only, S–M).** Retire `{effect}` from headlines whose frame the
  raw beta cannot honour, which is nearly all of them. Content rule 5 already
  licenses this ("A headline with no token is legal and occasionally funnier").
  Worked, direction-safe, token-free replacements:
  - full-moon: `'Meetings Now Run Measurably Longer Under a Full Moon, Analysis Finds'`
  - sock: `'Sock-Folders Arrive Earlier, and the Badge Data Agrees'`
  - terms: `'Customers Who Read the Terms Are Quietly Better Compensated'`
  - stairs: `'Stair-Takers Score Higher on Workplace Rapport'`
  - telescope: `'Telescope Owners Give Directions the Navigation App Cannot Match'`
  - cat-crypto: `'Cat Owners See Higher Returns, Study Finds'`
- **Alternative (controller, engine work).** Keep the token and make it honest by
  expressing the effect as a percentage of the control-group mean, so the number is
  unit-free and non-trivial; then every surviving frame must be `{effect}%` and the
  plural-after-1 trap must still be closed independently. Do not ship the current
  floor-at-1 rule either way.

### [gr3-002] `reveal.accounting1` tells the player that every significant specification is chance, on days when that is false

- **Severity:** blocker (`scientific`, per amendment A2) · **Effort:** S
- **Where:** `src/content/en/copy.ts:652`, rendered unconditionally by
  `src/ui/screens/Reveal.tsx:211,274` — no day-type branch.
- **Evidence.** Rendered on a null day:
  > "Of 1792 possible analyses, 122 (6.8%) reach p < .05 by chance alone."

  The same sentence renders on effect days (25% of days, `P_EFFECT_PCT`), where a
  share of those specifications are true positives detecting the injected effect. The
  line directly above has already told the player the day's truth
  (`reveal.truthEffect`), so the player reads a self-contradiction: an effect exists,
  and every detection of it is luck.
- **Fix shape.** Day-typed pair (branching is safe — the truth line above has already
  disclosed the day type). Keep `reveal.accounting1` for null days unchanged; add
  `reveal.accounting1Effect`:
  `'Of {total} possible analyses, {sig} ({sigPct}%) reach p < 0.05. Some of them found the real effect. The rest are luck, and the curve cannot tell you which is which.'`
  IT/ES need the same split; the second sentence is the pedagogy and must survive
  transcreation intact.
  *(Controller cross-reference: same defect independently found by GR1a as [gr1a-001]/[gr1a-002] with measured true-positive shares; merge at GR5.)*

### [gr3-003] The Summary's Prereg block invites a player who has already unlocked prereg to try it, behind a permanently disabled button

- **Severity:** high · **Effort:** S
- **Where:** `src/content/en/copy.ts:740` + `src/ui/screens/Summary.tsx:218-228`.
  Gate is `preregUnlocked` only.
- **Evidence.** Rendered Summary, measured live (`disabled: true`):

      Preregistration
      Preregistration is unlocked: commit to one analysis before you see the data.
      [Try Prereg Mode]        <- disabled, always

  It renders on the Summary of a day the player *just played in Prereg Mode*
  (captured), and on every hacking-day Summary from unlock onwards. The real entrance
  to Prereg Mode is the Briefing's mode chooser, which the copy never mentions.
- **Fix shape.** (1) Gate the block on `!preregPlayedToday` (Briefing already computes
  exactly this from `state.history[iso]`). (2) Point the copy at the real door and
  drop the dead CTA:
  `summary.preregUpsell` → `'Preregistration is unlocked. Tomorrow's briefing will let you choose it before you see any data.'`
  If the disabled button stays, it is an unfinished state and violates the bar's "no
  state that looks unfinished"; prefer removing it.

### [gr3-004] Seven outcome-slot-1 labels are absolute quantities the engine renders negative on screen

- **Severity:** high (`scientific`) · **Effort:** S · Ledger item (L52)
- **Where:** `src/content/en/index.ts`, `outcomeLabels[0]` for
  `mechanical-keyboard-bugs`, `terms-and-conditions-service`,
  `jigsaw-suitcase-packing`, `vinyl-dinner-party`, `label-maker-inbox`,
  `standing-desk-poetry`, `browser-tabs-side-projects`.
- **Evidence.** Rendered on the Lab screen, DataCut legend, `terms-and-conditions`:
  > Comparison group **-0.0349** · n = 99
  > Reads the terms and conditions 0.244 · n = 101

  The comparison group received **minus three cents** of "Goodwill credit granted per
  complaint". Y1 is the heavy-tailed, mean-centred family, so negative draws are
  guaranteed. Thirteen of twenty slot-1 labels are already phrased RELATIVE ("above
  the department baseline", "gain over the navigation app", "excess return over the
  benchmark", "past the scheduled end"), which makes a negative meaningful; these
  seven are not, and "minus 3 thousand lines of defect-free code" is a number this
  game's own audience will not let pass.
- **Fix shape.** Relabel the seven to the relative form the other thirteen use
  (direction contract preserved in every case):
  - `mechanical-keyboard-bugs`: `'Defect-free code shipped above the team baseline'`
  - `terms-and-conditions-service`: `'Goodwill credit above the standard settlement'`
  - `jigsaw-suitcase-packing`: `"Volume packed above the bag's rated capacity"` (see gr3-007)
  - `vinyl-dinner-party`: `'Value of wine brought above the usual contribution'`
  - `label-maker-inbox`: `'Clearance rate above the cohort average'`
  - `standing-desk-poetry`: `'Panel quality score above the department average'`
  - `browser-tabs-side-projects`: `'Side-project revenue above the developer median'`

### [gr3-005] The Lab's how-to-play step 1 tells the player to read a screen they have already left

- **Severity:** high · **Effort:** S
- **Where:** `src/content/en/copy.ts:517`; panel renders inside the Lab, after the
  Briefing is gone.
- **Evidence.** Rendered Lab, first run, top of screen:
  > HOW TO PLAY
  > **Read the brief: today's question, and the data you have been given.**
  > Adjust the analysis until the big number drops below 0.05.
  > Submit your finding for publication.
  > Face the truth about what you found.

  Step 1 is the only step of four that cannot be performed from where it is printed,
  and it mis-describes what the player just did. Separately, the four steps skip the
  call entirely — §2.6's binary call is the game's whole point and step 4 folds it
  into "Face the truth".
- **Fix shape.**
  - step1 → `"Start from the question at the top: that is what today's data is supposed to answer."`
  - step4 → `'Face the truth about what you found, and say whether you believe it.'`

### [gr3-006] "fit" / "fitting" is unglossed jargon, in 3 of the 6 methods notes, and appears in no glossary

- **Severity:** high · **Effort:** S
- **Where:** `src/content/en/copy.ts:500,502,503`; glossary at
  `src/content/en/index.ts:677`.
- **Evidence.** Rendered under three of six Lab control groups:
  > "Restrict the sample to one group of participants before **fitting**."
  > "Remove statistical outliers from the current sample before **fitting**."
  > "**Fit** the outcome on its own scale, or on a log scale."

  The bar is "a smart 15-year-old follows every explanation". "Fitting" as an
  intransitive statistical verb is not a word a 15-year-old has; nothing on any
  screen defines it, and the eight glossary entries do not include it. The other
  three notes clear the bar comfortably, which makes these three stand out.
- **Fix shape.**
  - subgroup → `'Run the analysis on one group of participants instead of on everybody.'`
  - exclusion → `'Drop the most extreme values from the sample before the analysis runs.'`
  - transform → `'Measure the outcome on its own scale, or compress its large values onto a log scale.'`
  - (related, same block) outcome → `'The measurement this analysis tries to explain. There are four to choose from.'`

### [gr3-007] The jigsaw headline contradicts its own outcome 0

- **Severity:** high · **Effort:** S · Ledger item (L52), verdict **REAL, FIX**
- **Where:** `src/content/en/index.ts:313` vs `:315` (unit `litres` at `:320`).
- **Evidence.**
  > headline: `'Puzzle Solvers Fit {effect}% More Into the Same Suitcase'`
  > outcome 0: `'Spare capacity remaining after packing'` — unit `'litres'`

  Fitting *more* in leaves *less* spare capacity, so the headline's claim and the
  metric producing its number point in opposite directions. On top of that the number
  is litres and the frame is a percentage. The `litres`-in-Y1 half of the ledger note
  is subsumed by gr3-004.
- **Fix shape.**
  - `outcomeLabels[0]` → `"Volume packed above the bag's rated capacity"`, unit `'litres'`
  - headline → `'Puzzle Solvers Fit More Into the Same Suitcase, Researchers Find'`

### [gr3-008] Eight copy keys ship in all three locales and never render, including the product's only tagline

- **Severity:** high · **Effort:** S
- **Where:** verified by scanning every `CopyKey` against all of `src/**` outside
  `src/content/`. Dead: `nav.title`, `nav.tagline`, `nav.puzzleNumber`,
  `nav.localeToggle`, `stats.avgScore`, `legend.trueEffect`, `a11y.shareButton`,
  `a11y.closeDialog`.
- **Evidence.** Three are documented retirements (`a11y.shareButton`,
  `a11y.closeDialog` by T22; `nav.title` superseded by App.tsx's raw wordmark). Five
  are not:
  - `nav.tagline` = `'A daily game about the garden of forking paths.'` — the single
    best one-line description of the product, transcreated into Italian and Spanish,
    and **it appears on no screen**. Nothing else tells a first-time visitor what
    P-hackle is before they are already inside a briefing.
  - `stats.avgScore` = `'Average score'` — master spec §2.8 asks for it; the rendered
    Stats screen shows Played / Current streak / Max streak / Call accuracy / Last 20
    calls and no average.
  - `nav.puzzleNumber` = `'Puzzle #{n}'` — a second, competing numbering convention
    (gr3-023).
  - `nav.localeToggle` = `'Language'` — duplicate of `a11y.localeToggle`.
  - `legend.trueEffect` = `'True effect'` — the SpecCurve legend renders three rows,
    never this one.
- **Fix shape.** Render `nav.tagline` (the Briefing masthead or the About standfirst
  are both natural homes). Render `stats.avgScore` or delete the key and note the
  §2.8 deviation. Delete `nav.puzzleNumber` and `nav.localeToggle`, or make
  `nav.puzzleNumber` the one numbering convention. Keep the three documented
  retirements with their comments.
  *(Controller cross-reference: overlaps gr1b-026's six dead keys; GR3 adds `a11y.shareButton`/`a11y.closeDialog` as documented retirements. Merge at GR5.)*

### [gr3-009] The Stats screen's empty state is a wall of zeros and dashes with no sentence in it

- **Severity:** high · **Effort:** S
- **Where:** `src/ui/screens/Stats.tsx`; the only empty-state string in the entire
  catalog is `stats.noData` = `'—'` (`copy.ts:773`).
- **Evidence.** Rendered on a browser that has never played:

      Your stats
      PLAYED 0 · CURRENT STREAK 0 · MAX STREAK 0 · CALL ACCURACY — · LAST 20 CALLS —
      Success rate: hacking vs. preregistration   HACKING MODE —   PREREG MODE —
      Forks per day        —
      Achievements   ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦ ▦▦▦

  Eleven censored blocks and six em-dashes, not one word explaining what the player is
  looking at or how to change it. A nav page is one tap from every screen, so a
  curious first-timer reaches this on day one before playing anything.
- **Fix shape.** One key, one sentence, Act II register:
  `stats.emptyState` → `'Nothing here yet. Every figure on this page starts filling in after your first day.'`
  Render once, under the title, only when `played === 0`.

### [gr3-010] `published.altmetricScore` ends on a dangling "already"

- **Severity:** polish · **Effort:** S
- **Where:** `src/content/en/copy.ts:569`.
- **Evidence.** Rendered: "Mentioned 659 times online already". The adverb is stranded
  after the prepositional phrase; English puts it in front. It reads as
  translated-into-English on a screen whose whole job is to sound like a real press
  office.
- **Fix shape.** `'Already mentioned {n} times online'` — same token, one occurrence,
  plural still safe at the tier-1 floor of 40.

### [gr3-011] Prof. Grantwell sends the same subject line for all twenty-two bodies

- **Severity:** polish · **Effort:** S
- **Where:** `src/content/en/copy.ts:419` (`'Re: the deadline'`), rendered by
  `Briefing.tsx:80` against a body rotated from a 22-item bank.
- **Evidence.** Rendered Briefing:
  > From: Prof. R. Grantwell
  > Subject: **Re: the deadline**
  > "A rival lab published something adjacent to this last week. We are now,
  > technically, racing. They are not aware that we are racing."

  Nothing in that body is about a deadline. Neither is "I had a dream last night that
  this replicated", nor "Reviewer 2 has returned", nor half the bank.
- **Fix shape.** Make the subject a bank the same length as `grantwell`, indexed by
  the same `pickGrantwellEmail` seed. If 22 is too many, a 6-item bank rotated
  independently already breaks the constant: `'Re: the deadline'`, `'quick one'`,
  `'no subject'`, `'FW: FW: the renewal'`, `'(no need to reply)'`, `'thinking out loud'`.

### [gr3-012] The crash banner promises that reloading fixes it and offers no way to reload

- **Severity:** polish · **Effort:** S
- **Where:** `src/content/en/copy.ts:849`, rendered by `ScreenRouter.tsx:20-24` as a
  bare `<p role="alert">`.
- **Evidence.** `"Something went wrong generating today's puzzle. Reloading usually
  fixes it."` The honesty of "usually" is good writing, but the banner is additive
  over a now-inert screen and names an action the interface does not offer.
- **Fix shape.** Add the control the sentence names (new `errors.reload` = `'Reload'`),
  or make the sentence self-sufficient: `"Something went wrong generating today's
  puzzle. Reload the page and it usually comes back."` The first is better.

### [gr3-013] The Lab is where the player spends the whole session, and the copy catalog authors no comedy for it at all

- **Severity:** high · **Effort:** M
- **Where:** all `lab.*` keys, `copy.ts:434-547`; covariate labels across 20 scenarios.
- **Evidence.** Joke density per rendered screen (Act I target ≈ one genuine laugh per
  screen):
  - Briefing: 2 (cover-story closer + Grantwell). Pass.
  - Published: 3–4 (headline, altmetric percentile, press ×2). Pass.
  - Call: 1 ("Noise I dressed up"). Pass.
  - **Lab: 0 authored.** All ~40 catalog strings on the Lab are sincere-instructional
    by design, correctly so. The screen's entire laugh supply is scenario furniture:
    four outcome labels and two covariate labels.

  Half of that supply is spent on nothing: the LEFT covariate option is the literal
  string `'Household income'` on **15 of 20 scenarios**, `'Salary band'` on 4, bespoke
  on 1. The right-hand covariate is bespoke and excellent on all 20 ("Belief that the
  dog knows something", "Willingness to hold through a red candle", "Comfort with an
  unaudited formula"). The radiogroup reads: one funny option, one filing-cabinet
  label, every day, forever.
- **Fix shape.** Give the income covariate a scenario-specific name wherever the
  scenario supports one, keeping it a plausible income proxy so the regression stays
  honest: cat-crypto `'Portfolio size'`; sourdough `'Spend on running shoes'`; fern
  `'Departmental budget'`; vinyl `'Spend on the wine budget'`; horoscope
  `'Parking-permit tier'`; thirteen-mortgage `'Deposit size'`; browser-tabs `'Contract
  day rate'`; jigsaw `'Baggage-allowance tier'`. Content-only; the direction contract
  does not apply to covariates.

---

## GR3b — The quotable test

### [gr3-014] The quotable test PASSES, but three of the ten strongest strings are unreachable or under-exposed

- **Severity:** high · **Effort:** S
- **Evidence — the ten strings players would screenshot** (more than ten exist; the
  corpus is genuinely deep, and this is the lane's headline good news):
  1. `about.glossary[α]` — *"This game is engineered to blow straight past that cap."*
  2. `retractionSublines[5]` — *"The journal has issued a correction. This page is the correction."*
  3. `grantwell[0]` — *"Remember: a p-value of .06 is just a p-value of .05 with poor time management."*
  4. `retractionSublines[4]` — *"The confidence interval always contained zero. It was very patient about it."*
  5. `reveal.groupedCaption` — *"Real effects cluster. Noise scatters."*
  6. `about.frozenFork` — *"It is disclosed here because the forks you cannot see are the ones that do the damage."*
  7. `achievements.outlier_surgeon` — *"For services to the removal of inconvenient humans."*
  8. `grantwell[19]` — *"Please stop sending me the confidence interval. Send me the point estimate. The point estimate has never let anybody down."*
  9. `about.dataDisclosure` — *"Clearing your browser data deletes them permanently, including from us, who never had them."*
  10. `press[t1]` — *"The researchers describe the effect as modest. The word does not appear anywhere else in this article."*

  Runners-up that would make most products' top ten: `retractionSublines[12]`
  ("Nobody has cited it. Nobody was ever going to."), `achievements.monk` ("For twenty
  days of not doing any of this."), `about.syntheticDisclaimer` ("because a screenshot
  travels further than its caption"), `grantwell[20]` ("Reviewer 2 has returned.
  Reviewer 2 is the same person as last time. Reviewer 2 remembers us."), `call.noise`
  ("Noise I dressed up").
- **The finding.** The distribution is wrong. Three of the ten are hard to reach:
  - `nav.tagline` — not in the ten only because it never renders (gr3-008). It is the
    line most likely to be quoted *about* the game rather than *from* it.
  - `lab.peekFootnoteArmitage` — the best-argued line in the product, gated behind a
    second peek. Deliberate (§2.4) and correct; noted so the cost is on the record.
  - `retractionSublines` — 14 of the best lines in the game, rendering only on a
    RETRACTED verdict. An honest player who reports nulls may never see one.
- **Fix shape.** Ship `nav.tagline` (gr3-008). Leave Armitage alone. Consider a second,
  tonally-matched subline bank for `NULL REPORTED` days: that stamp currently renders
  with **no** subline at all (verified in the rendered abandon path), the quietest
  moment in Act II and currently the emptiest.

---

## GR3c — Consistency sweep

### [gr3-015] The p-value's leading zero is present in five strings and absent in three, on the same screens

- **Severity:** high · **Effort:** S
- **Where:** with leading zero — `briefing.goal`, `lab.howThisWorks.step2`,
  `lab.dialCaption`, `lab.pBelow`, `about.decimalNote`, and the dial's runtime format.
  Without — `reveal.accounting1`, `legend.significant`, `lab.peekFootnoteArmitage`
  (`α = .05`), and the SpecCurve threshold label (which is `legend.significant`).
- **Evidence.** Both forms render **on one screen**. The reveal shows, inside the same
  figure block:
  > `p < .05`  (Fig. 1 threshold rule)
  > "Of 1792 possible analyses, 122 (6.8%) reach **p < .05** by chance alone."

  and the Lab shows `p = 0.147` in the dial directly above a caption saying "Below
  **0.05**, you can publish." Each convention is individually defensible (APA drops the
  leading zero for bounded quantities; plain style keeps it), but a product with an
  About-page sentence pledging its notation cannot use two.
- **Fix shape.** Pick the leading-zero form everywhere — it is what the runtime
  formatter already produces and what the Lab's beginner copy uses. Edits:
  `reveal.accounting1` → `p < 0.05`; `legend.significant` → `'p < 0.05'`. Leave
  `lab.peekFootnoteArmitage` at `α = .05` **only** if it stays master-spec-verbatim
  (it is a citation). Extend `about.decimalNote` to state the rule (see gr3-025).

### [gr3-016] "the reveal" is developer vocabulary and it is used, unglossed, in player copy in all three locales

- **Severity:** high · **Effort:** S
- **Where:** `call.title` = `'Before you see the reveal…'`; `prereg.intro` = "…There is
  no **reveal** to peek at first…". Same in IT (`'Prima di vedere la rivelazione…'`)
  and ES (`'Antes de ver la revelación…'`), where the convention contracts have even
  *pinned* it as fixed terminology.
- **Evidence.** The screen is never called "the reveal" anywhere the player can see it.
  It is entered by a button that says **"Face the truth"**, its own continue button
  says **"See the invoice"**, and `lab.howThisWorks.step4` calls it "the truth". So the
  only two strings that use the word assume a name the game never gave, and
  `call.title` is the first thing the player reads in the modal that hinges Act I into
  Act II.
- **Fix shape.**
  - `call.title` → `'Before you find out…'`
  - `prereg.intro` → `"…There is nothing to look at first, and no second attempt today."`

  IT/ES contract rule 6/7 pins *la rivelazione* / *la revelación*; if EN drops the
  term, amend those rules in the same change rather than leave them pointing at a term
  EN no longer uses.

### [gr3-017] "Legend" names two different things on the Lab screen, three times in twenty words

- **Severity:** high · **Effort:** S
- **Where:** `nav.legend` = `'Legend'`, rendered both as the header nav page name **and**
  as the ForkTrail popover's trigger button (its own catalog comment says so); plus
  `lab.forkTrailHint`.
- **Evidence.** Rendered Lab, verbatim, in reading order:

      ... [header] Stats  Legend  About ...
      FORKS SO FAR
      —
      LEGEND                                    <- popover trigger, not the page
      Each symbol is a move you made. The Legend page has the key.

  Three tokens of "Legend" within one glance, naming two affordances, with a sentence
  between them sending the player to the one they are *not* standing next to. The
  parked taste item "dual Legend-named buttons" (routed to GR4) is the same defect from
  the layout side; from the writing side it is a one-name-per-concept violation.
- **Fix shape.**
  - ForkTrail trigger → new key `lab.forkTrailKey` = `'What these mean'`
  - `lab.forkTrailHint` → `'Each symbol is one move you made. The Legend page lists them all.'`
  (Also fixes the "has the key" idiom, the source of gr3-020 in Spanish.)

### [gr3-018] The Legend page never defines "Forks" — the one word the share string actually prints

- **Severity:** high · **Effort:** S
- **Where:** `legend.*` bank vs `share.forksWord`.
- **Evidence.** The share string a stranger receives is:

      P-hackle #5
      🍴🍴➕➕📄 → ⚖️✅
      Forks: 5 · Streak: 1
      https://phackle.carlosrodriguezpardo.es

  The Legend page (`legend.intro` = "How to read a shared result.") explains every
  glyph and **not the word**. Its 🍴 row reads "Any specification change (outcome,
  subgroup, covariates, outlier exclusion, transform or one-tailed switch)" and does
  not contain the string "fork" at all. The concept carries three names across the
  product: "Forks" (Lab trail, Stats, share), "specification change" (Legend),
  "possible analyses"/"explored {k} of them" (reveal), and "paths" (`nav.tagline`,
  glossary).
- **Fix shape.**
  `legend.emojiSpec` → `'A fork: any change to the specification (outcome, subgroup, covariates, outlier exclusion, transform or one-tailed switch)'`
  `legend.intro` → `'How to read a shared result. The trail is one symbol per move; the counts under it are the same moves, added up.'`

### [gr3-019] Italian and Spanish each name the streak twice, and the second name arrived after the T37 audit

- **Severity:** high · **Effort:** S · *(this is the "did the audit hold?" answer)*
- **Where:** IT — `summary.streak` = `'Giorni consecutivi: {n}'` vs `stats.currentStreak`
  = `'Serie attuale'`, `stats.maxStreak` = `'Serie record'`, `share.streakWord` =
  `'Serie'`. ES — `summary.streak` = `'Días seguidos: {n}'` vs `'Racha actual'`,
  `'Racha máxima'`, `'Racha'`.
- **Evidence.** EN is consistent ("streak" in all four places). Both target locales are
  not, and the two names appear one tap apart: the Summary says *Giorni consecutivi /
  Días seguidos*, and the Stats page the player opens next says *Serie / Racha* — as
  does the string they paste into a timeline. This is a post-audit regression:
  `share.streakWord` was **re-authored** in the T37 fix round (the label-colon ruling)
  and never checked against `summary.streak`, which was re-authored in the same round
  for the same plural-safety reason. Both convention contracts pin terminology "and it
  must not drift"; neither lists the streak, which is exactly how it drifted.
- **Fix shape.** Adopt the idiomatic term (*Serie* / *Racha*, what those languages'
  daily games actually say) in all four places, in the grammar-neutral label-colon form
  the ruling requires:
  - IT `summary.streak` → `'Serie: {n}'`
  - ES `summary.streak` → `'Racha: {n}'`
  Then add "the streak" to item 7 of the IT contract and item 6 of the ES contract.

### [gr3-020] Spanish ships the exact "key" calque the English source comment warns against

- **Severity:** high · **Effort:** S
- **Where:** ES `lab.forkTrailHint` = `'Cada símbolo es un movimiento que hiciste. **La clave está en la página Leyenda.**'`
- **Evidence.** `src/content/en/copy.ts:544-546` carries an explicit translator
  instruction on this very key:
  > T37 (audit §5.6): "has the key" is an English idiom, and "key" for a chart legend
  > has no cognate in either target language. It means "the explanation of the symbols"
  > — do not translate the noun literally.

  Italian obeyed it (`'Il significato di ciascuno è nella pagina Legenda.'`). Spanish
  did not: *la clave* means the key/code/answer, so the sentence reads "the answer is
  on the Legend page", promising a solution rather than a glossary. A WRONG-FUNCTION
  calque of exactly the class the T36 audit existed to eliminate, on a key whose own
  comment names it.
- **Fix shape.** ES → `'Cada símbolo es un movimiento que hiciste. En la página Leyenda están todos explicados.'`
  (Coordinate with gr3-017 so all three locales change once.)

### [gr3-021] Mixed orthography, and a euro-denominated scenario whose own chyron shouts about a 401(k)

- **Severity:** polish · **Effort:** S · Ledger item (L52), verdict **REAL, partial FIX**
- **Counts** (EN strings, comments excluded): US — `behavior` ×3, `analyz*` ×2,
  `characterized`, `enrollment`, `organizer`. UK — `metres`, `litres`, `storey` ×2.
  Currency — `€` ×7, one `401(k)`.
- **Evidence, two parts.**
  1. **On one screen.** The Lab renders `lab.cutLegendIncluded` = **"Analysed: 200"**
     and, on an under-powered cut, `lab.insufficient` = "Not enough data to
     **analyze**." One British and one American spelling of the same verb, in the same
     column, from the same catalog.
  2. **On one screen, again.** `fern-negotiation`'s journal headline is "Office Ferns
     Associated with €{effect}k Better Contract Terms" and its own tier-3 bespoke
     chyron is "BREAKING: YOUR HOUSEPLANTS ARE JUDGING YOUR **401(k)**".
- **Ruling.** The metric UK spellings (`metres`, `litres`) are *fine* next to `€`: they
  read as international-SI, and they are units, not prose. `storey` and `Analysed` are
  prose and should follow the corpus's US default. The 401(k) is the only genuine
  collision.
- **Fix shape.** `lab.cutLegendIncluded` → `'Analyzed: {n}'`. `stairs-small-talk`:
  `twelve-storey` → `twelve-story`. Fern chyron → `'BREAKING: YOUR HOUSEPLANTS ARE
  JUDGING YOUR PENSION'`. Leave `metres`/`litres`.

### [gr3-022] Negative numbers use ASCII hyphens in a product that otherwise typesets ≥, ×, ·, β and α correctly

- **Severity:** polish · **Effort:** S
- **Where:** runtime number formatting behind `lab.coefPlotCaption`, the DataCut
  group-mean labels, and the CoefPlot axis ticks.
- **Evidence.** Rendered Lab, in the same visual block as `Age ≥ 40`, `|z| > 2.5` and
  `p = 0.147`:
  > Estimate 0.28 € (95% CI **-0.10** to 0.66)
  > Comparison group **-0.0349** · n = 99
  > **-4.88**    1.68    8.24
- **Fix shape.** Format negatives with U+2212 in the number formatter (one helper, used
  by CoefPlot / DataCut / tick labels). Not a catalog change. Must not touch the share
  string or any `data-testid` assertion.

### [gr3-023] Two competing puzzle-number conventions, one of them dead

- **Severity:** polish · **Effort:** S
- **Where:** `briefing.vol` = `'Vol. {volume}, No. {issue}'` (live, rendered "Vol. 1,
  No. 5" and "VOL. 1, NO. 5") vs `nav.puzzleNumber` = `'Puzzle #{n}'` (dead) vs the
  share string's hard-coded `P-hackle #{n}`.
- **Evidence.** A player sees "No. 5" in the app and pastes "#5" into a timeline. The
  Spanish catalog has already localised the dead key properly (`'Puzle n.º {n}'`, the
  correct Spanish ordinal indicator), so three locales maintain a translation of a
  string nothing renders. No `№` (U+2116) appears anywhere, which is correct.
- **Fix shape.** Keep `Vol./No.` for the manuscript chrome and `#` for the share string
  (different registers on purpose), but delete `nav.puzzleNumber` in all three locales
  or render it somewhere. Do not leave a third convention maintained and invisible.

### [gr3-024] The press mix reads as a seam, and the reason is coverage, not craft *(the A4 question, answered from the writing side)*

- **Severity:** high · **Effort:** M (this is the 60-cell matrix decision)
- **Where:** `src/content/en/index.ts` `press` bank (45 items: 18 generic / 27 bespoke
  across 26 distinct `(scenario, tier)` cells); `src/game/published.ts:pickPress`.
- **Evidence — measured, not asserted.**
  1. **Coverage.** The bespoke guarantee is per `(scenario, tier)` cell, and only
     **26 of 60** cells are covered: tier 1 covers 8/20 scenarios, tier 2 covers 9/20,
     tier 3 covers 9/20. On the other **34 cells the first card falls back to the
     generic pool**, so the whole screen is generic. A majority of combinations, not an
     edge case.
  2. **Observed.** Six published days driven through the real UI: **3 of 6 rendered
     zero scenario-bound press.**
     - 08-11 full-moon @ tier 2 → generic, generic (bound at tiers 1 and 3 only)
     - 08-12 telescope @ tier 3 → generic, generic, generic chyron (bound at tier 1 only)
     - 08-20 standing-desk @ tier 2 → generic, generic (bound at tier 3 only)
  3. **Repetition inside the window.** "One weird trick statisticians PUBLISH with." ran
     on 08-11 and again on 08-20. "The researchers describe the effect as modest…" ran
     on 08-14 and again on 08-16 — two days apart. Generic pools of 5/7/6 cannot carry
     two of three slots on a majority of days.
- **The verdict, in writing terms.** The seam is **not** a quality gap. Side by side on
  the 08-14 screen:
  > card 1 (bespoke): *"The hardest part was recruitment: first find the people who read
  > the agreement, then ask them to read the consent form."*
  > card 2 (generic): *"The researchers describe the effect as modest. The word does not
  > appear anywhere else in this article."*

  Both are good; card 2 is one of the ten best strings in the game. The seam is
  **specificity**: card 1 has read the paper and card 2 has not, and when card 1 is
  absent the screen is two outlets covering an unnamed study — precisely what the
  owner's play-test directive asked to stop. It stops on 26 cells and does not stop on 34.
- **Fix shape.** Promote the 60-cell matrix from parked follow-up to fix task, per A4's
  own conditional. Staging order: tier 2 first (11 missing, and tier 2 is the modal
  outcome for a normal hacking day), then tier 3 (11 missing), then tier 1 (12 missing).
  Second, smaller edit regardless: the tier-1 generic pool is 5 items carrying a
  follow-up slot every day and one of its five (gr3-034 / the flattest line) is inert;
  grow it to 8 or accept visible repeats inside a working week.

---

## Structural

### [gr3-025] The About page is seven unsignposted paragraphs with a typographic footnote wedged into the middle of them

- **Severity:** high · **Effort:** S
- **Where:** `src/ui/screens/About.tsx:45-50` — six `<p>` in a row, no headings between
  them; the only structural signposts on the page are `<h1>` "About P-hackle" and
  `<h2>` "Glossary".
- **Evidence.** Read as an essay, the page has a real argument in the right order —
  *what this is → how it really works → the fork we froze → none of this is real → your
  data is yours → read these instead → vocabulary*. Six of those seven turns are
  invisible, because nothing marks them. And the fifth paragraph is:
  > "Statistical notation always uses a decimal point (p = 0.049), in every language."

  A one-line typesetting note, sitting between "because a screenshot travels further
  than its caption" and "Analytics are anonymous, cookieless page counts". It stops the
  essay dead, and in the English locale it is very nearly vacuous.
- **Fix shape.**
  1. Add four short `<h2>` subheadings: *How it works* (mechanism + frozenFork), *None
     of this is real* (syntheticDisclaimer + decimalNote), *Your data* (dataDisclosure),
     *Where this comes from* (priorArt). `about.intro` stands alone as the standfirst —
     the natural home for the never-rendered `nav.tagline` (gr3-008).
  2. Move `about.decimalNote` under *None of this is real* and give it a reason to exist
     in English too:
     `'Statistics here are set the way journals set them, in every language: a decimal point, never a comma (p = 0.049), and a leading zero on every one.'`
     (The second clause also documents the convention gr3-015 asks for.)

### [gr3-026] The glossary defines its own load-bearing term last and uses it first

- **Severity:** polish · **Effort:** S
- **Where:** `src/content/en/index.ts:677-710`, eight entries in importance order.
- **Evidence.** Entry 1 (*p-hacking*): "Analyzing data in ways that inflate the
  **false-positive rate**…". Entry 6 (*Optional stopping*): "…inflates the
  **false-positive rate** even with an honest test." Entry 8, last on the page:
  *α / false-positive rate* — the definition. A reader who arrived not knowing the term
  meets it twice before it is defined and has no reason to keep scrolling.
- **Fix shape.** Move the *α / false-positive rate* entry to position 1. It is also the
  funniest entry, which makes it a better first thing to read than a definition of the
  title. Ordering only; no string changes; applies identically in IT/ES.

### [gr3-027] As a text object posted to a stranger, the share string says nothing about what the game is

- **Severity:** high · **Effort:** S
- **Where:** `src/game/share.ts:shareString`; `share.forksWord` / `share.streakWord`.
- **Evidence.** Both live captures:

      P-hackle #5                     P-hackle #5
      🍴🍴➕➕📄 → ⚖️✅               🏳️ → ⚖️❌
      Forks: 5 · Streak: 1            Forks: 0 · Streak: 1
      https://phackle.carlos…         https://phackle.carlos…

  Four lines; the only content word is "Forks", which is undefined outside the app
  (gr3-018). The T37 label-colon ruling was right — "1 forks" pasted into other people's
  feeds was worse — but the line it produced has no voice left: it reads as a debug
  print, not as a boast. And the abandon grid is a single white flag and a cross above
  "Forks: 0": the honest player's badge currently posts as an empty scoreline.
- **Fix shape.** The line-3 grammar-neutrality ruling stays untouched. What is missing
  is a hook, and §2.9's four-line layout has room because line 2 is short. Two options,
  in order of preference:
  1. Suffix the puzzle line with the tagline's job, invariant across locales because it
     is brand chrome: `P-hackle #5 · the garden of forking paths`. Costs nothing, leaks
     nothing, gives a stranger a reason to click.
  2. Leave the string and ship `nav.tagline` on the landing screen (gr3-008), so the
     click lands on an explanation.

  Do **not** add a verdict word to line 3; the spoiler property depends on line 3 taking
  only `forks` and `streak`.

### [gr3-028] The reveal tells a preregistering player that they "explored" the path they committed to sight-unseen

- **Severity:** high (`scientific`) · **Effort:** S
- **Where:** `reveal.accounting2` = `'You explored {k} of them before publishing.'`,
  selected at `src/ui/screens/Reveal.tsx:216` by `published === null` only — mode is
  never consulted.
- **Evidence.** Rendered on a real Prereg Mode day (captured), immediately after a form
  whose own copy says "Declare your full analysis before you see a single number":
  > "You explored **1** of them before publishing."
  > "A researcher randomly exploring 1 of them finds at least one "significant" result
  > about 5% of the time."

  The first sentence is false in the only mode where it matters. Preregistration's
  entire pedagogy is that the player did *not* explore; the reveal hands them the
  hacker's verb anyway, and the next sentence — which is correct, and is the lesson —
  then reads as a coincidence rather than as the payoff.
- **Fix shape.** A third variant beside `accounting2` / `accounting2Abandoned`, Act II
  clinical, partitive so it agrees at any count:
  `reveal.accounting2Prereg` → `'You committed to {k} of them before seeing any of it, and ran that one.'`
  selected on `mode === 'prereg'`.

---

## Ledger micro-item adjudication (T6 / T32, ledger lines L52 and L59)

### [gr3-029] Verdicts on the eight GR3-routed micro-items

- **Severity:** polish (this entry) · **Effort:** — (bookkeeping)

| Ledger item | Verdict | Where it lives now |
|---|---|---|
| jigsaw headline contradicts outcome-0 + litres-in-Y1 | **REAL — FIX** | gr3-007, gr3-004 |
| KLOC negative-draw label | **REAL — FIX; class is 7 labels not 1** | gr3-004 |
| bounded-scale noun repetition (3× confidence, 2× warmth, 12× Self-rated) | **REAL — FIX; worse than logged** | gr3-030 |
| slot-1 "Longest…" device 9/20 | **REAL — PARTIAL FIX** | gr3-031 |
| cover-story gap-opener template ~14/18 | **REAL — FIX; measured 16/20** | gr3-032 |
| mixed US/UK orthography + €-vs-401(k) | **PARTLY REAL — FIX 3 of 5** | gr3-021 |
| 3× "still" as a recruitment marker | **RESOLVED — WONTFIX** | below |
| label-maker tense wobble (index.ts:226) | **NOT A DEFECT — WONTFIX** | below |

- **"still" (WONTFIX, resolved by later passes).** Re-counted across the whole EN
  corpus: five occurrences, of which exactly **one** is a recruitment marker ("The co-op
  is still sending people."). The other four are unrelated ("the wine is not, in
  fairness, still available for analysis"; two press blurbs; "The press release is still
  online"). Five tokens across ~20,000 characters is ordinary English density. The
  T32/T39 rewrites already dissolved the echo the ledger logged.
- **label-maker tense wobble (NOT A DEFECT).** `src/content/en/index.ts:226`:
  > "We ask knowledge workers one screening question … and then, with consent, instrument
  > their mail clients for a quarter. The instrument counts metadata only. Three
  > participants **have asked** us to confirm that twice; we **confirmed** it twice,
  > happily."

  Present for the standing protocol, present perfect for an unbounded-period fact,
  simple past for the specific responses. Correct English, and the same sequence eight
  other cover stories use deliberately (content rule 6 licenses the present tense for
  "recruitment is still running"). Nothing to fix.

### [gr3-030] The bounded-scale outcome slot is one template, twenty times, and repeats its head nouns

- **Severity:** polish · **Effort:** M
- **Where:** `outcomeLabels[3]` across all 20 scenarios.
- **Evidence.** Recounted from source. **20 of 20** use the compound `X-rated/-assessed
  Y`: `Self-rated` ×10, `Self-assessed` ×1, plus `Counterpart-` ×2, `Recipient-`,
  `Attendee-`, `Guest-`, `Stranger-`, `Author-`, `Companion-`, `Colleague-`. Repeated
  head nouns: **`sense` ×4** ("sense of control", "sense that this could have been an
  email", "sense of being taken seriously", "sense that everything is under control"),
  `confidence` ×3, `warmth` ×2. The ledger logged "12× Self-rated" and missed the harder
  number: the *construction* is 20/20 and `sense` beats `confidence`.
- **Ruling.** The construction is right — it is what a real 1–10 self-report item is
  called, and the slot's statistical shape is fixed. The repetition to fix is lexical.
- **Fix shape.**
  - label-maker: `'Self-rated sense of control'` → `'Self-rated tidiness of mind'`
  - full-moon: keep (the best label in the set)
  - browser-tabs: `'…sense that everything is under control'` → `'Self-rated grip on the situation'`
  - terms: `'…sense of being taken seriously'` → `'Self-rated feeling of being taken seriously'`
  - thirteen: `'Self-rated confidence in the deal'` → `'Self-rated satisfaction with the terms'`

### [gr3-031] Slot 1 opens with "Longest…" nine times and "Length of…" twice

- **Severity:** polish · **Effort:** M
- **Where:** `outcomeLabels[1]` — jazz, fern, mechanical-keyboard, full-moon,
  label-maker, jigsaw, stairs, sock, browser-tabs (`Longest…`); cafe, terms (`Length of…`).
- **Evidence.** 11 of 20 slot-1 labels are duration/length superlatives. The pull is
  structural — slot 1 is the positively-skewed family and "longest X" is the natural
  skewed quantity — so this is not laziness. But P-hackle is a *daily*, and a returning
  player sees all twenty inside a month.
- **Ruling.** **PARTIAL FIX.** Reword four so the device drops from 11/20 to 7/20 and
  stops being the first word the eye lands on.
- **Fix shape** (skew preserved, direction-safe):
  - mechanical-keyboard: `'Longest green-build streak'` → `'Days between red builds'`
  - label-maker: `'Longest run of days at inbox zero'` → `'Consecutive days at inbox zero'`
  - stairs: `'Longest small-talk exchange sustained'` → `'Time a stairwell conversation ran on'`
  - browser-tabs: `'Longest uninterrupted build session'` → `'Hours in an uninterrupted build session'`

### [gr3-032] Sixteen of twenty cover stories open with the same sentence

- **Severity:** high · **Effort:** M
- **Where:** `coverStory` across all 20 scenarios.
- **Evidence.** Recounted: **16 of 20** open with the academic gap statement — *the
  literature has studied A exhaustively and B not at all*:
  > "Office ergonomics research has spent decades on backs and wrists and almost none of
  > it on iambic pentameter."
  > "Hospitality research has characterized the menu exhaustively and the turntable not
  > at all."
  > "Time-use research has documented the commute in extraordinary detail and the sock
  > drawer not at all."
  > "Spatial-reasoning research has produced four decades of block-rotation tasks and
  > almost no luggage."
  > "The tactile-feedback literature ends at typing speed and stops well short of
  > production."
  > …and eleven more.

  The joke is real and the register is right; it is what every genuine paper's
  introduction does. But the *payload* is identical each time, so on a daily the
  briefing's first sentence becomes furniture inside two weeks. (The corresponding
  closing device — a wry logistics aside, 20/20 — is **not** a finding: every payload
  there is different, and it is the corpus's best recurring beat. "He sends regards." /
  "Both had moved to something quieter." / "The consent forms, for once, were read in
  full." Keep it, all twenty.)
- **Fix shape.** Rewrite five openers so they enter from somewhere other than the gap.
  Shapes that stay mock-academic and Act-I sincere:
  - open on the method: *"Eighteen months of procurement records, matched line by line to eighteen months of issue trackers."* (mechanical-keyboard)
  - open on a person: *"The calendar administrator had a theory, and had been right about things before."* (full-moon)
  - open mid-scene: *"There is a folding table at gate 14, and on it, someone's holiday."* (jigsaw)
  - open on the objection: *"The obvious criticism is that nobody would notice. We measured whether anybody did."* (sock)
  - open on the money: *"A philanthropic trust with four cats and a very strong prior asked us a question."* (cat-crypto — this also frees the current closer, which moves up)

### [gr3-033] `'PNAS: Proceedings of the National Academy of Suspicious findings'` — WONTFIX

- **Severity:** polish · **Effort:** — (adjudication only)
- **Where:** `src/content/journals.ts:17`. Ledger item from T4.
- **Ruling.** **WONTFIX.** The string is master-spec-verbatim
  (`docs/implementation_plan.md:329`), and `JournalCover.css:16` sets `text-transform:
  uppercase`, so the lowercase `f` renders as `SUSPICIOUS FINDINGS` and is inaudible to
  a screen reader reading the same DOM text. Nil player impact in every channel.
  Recorded so the ledger entry can close.

### [gr3-034] `summary.streak` reads "1 day streak" on the commonest day it renders

- **Severity:** polish · **Effort:** S
- **Where:** `src/content/en/copy.ts:723` = `'{n} day streak'`; `{n} >= 1` and day one is
  1 (the catalog's own floor table says so).
- **Evidence.** Rendered Summary, day one: **"1 day streak"**. Not wrong, but
  unhyphenated attributive, and it is the form every player meets first. It is also the
  last EN string still using the counted-noun shape the T37 ruling replaced everywhere
  else (`stats.forkHistogramBar`, `share.*`, and both locales' `summary.streak`).
- **Fix shape.** `'Streak: {n} days'` still fails at 1. Use the form the share string and
  both locales already use: `'Streak: {n}'`. Grammar-neutral at every value, and it makes
  the Summary, the Stats page and the pasted share string say the same word — the EN half
  of gr3-019.

---

## The comedy verdict

**Is Act I brave?** *Half.* Brave where it is authored as prose, timid where it is
authored as chrome. The Grantwell bank is the bravest writing in the product ("Grant year
three of three. I don't want to alarm you, but I want to alarm you a little."), the
cover-story closers land 20 times out of 20, and `briefing.goal` says the quiet part out
loud — "find a statistically significant effect (p < 0.05) and publish it" — with no
hedge at all, which is exactly the nerve the owner asked for. But the Lab, the screen the
player lives on, has **zero** authored jokes (gr3-013) and spends 15 of 20 days putting
the string "Household income" next to "Belief that the dog knows something". And the hero
line of Act I's payoff currently reads "1 Minutes Longer" (gr3-001).

**Is Act II clinical without being dead?** *Yes, and it is the better-written act.* The
retraction sublines are one sentence each, none is a punchline, several are devastating.
The achievement citations are the only warm beat and stay in award-ceremony register. One
line sits closest to the boundary — *"The confidence interval always contained zero. It
was very patient about it."* — where the personification is technically a joke inside a
bank not supposed to have any. **Keep it.** It is the single best sentence in Act II and
the register survives it; flagged only so the ruling is on the record rather than
accidental.

**Is the Armitage footnote still the only wink?** *Yes.* Audited every Act I string on
every rendered screen. `lab.peekFootnote` plants without winking. The press believes
itself in all 45 items. The journal names are absurd but they are in-world objects, not
authorial commentary. `briefing.goal`, `lab.dialCaption` and all six methods notes are
straight. The one wink is where the spec put it and it is still easy to miss.

**Does the press bank hold one voice per tier?** *Yes — tier voice is the bank's strongest
property.* Tier 1 has read the abstract and reports the method; tier 2 has read the
abstract and made it about the reader; tier 3 has reduced it to a lower third. Not one
item is in the wrong tier's voice, bespoke or generic. The bank's problem is coverage and
repetition (gr3-024), not voice.

**Funniest single line in the product:**
> *"Please stop sending me the confidence interval. Send me the point estimate. The point estimate has never let anybody down."* — `grantwell[19]`

Three sentences, entirely in character, funny only to the people this game is for, and it
indicts the whole discipline without once raising its voice. Runner-up: *"a p-value of .06
is just a p-value of .05 with poor time management."*

**Flattest single line in the product:**
> *"A small habit, a measurable difference: what one new paper suggests."* — `press`, The Sunday Supplement, tier 1

The **only one of the 45 press blurbs with no joke in it at all** — no observation, no
turn, no voice — and it renders in display serif as a full-width pull-quote on the
celebration screen, where every neighbour is working. It reads like a placeholder that
survived. Replacement, in tier 1's voice:
`'A small habit, a measurable difference, and a sample size the authors describe as adequate.'`

---

## Cross-lane observation for the controller (outside GR3's scope)

On the same pinned date (`2026-08-14`), `reveal.accounting1`'s `sigCount` rendered 122,
149 and 194 across three runs that differed only in the analysed window N (300 / 200 /
prereg). That is expected if the curve is computed over the visible window, but the
numbers are non-monotonic in N and worth a look from GR1a. Not filed as a writing finding.
