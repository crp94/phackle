# Task T6 report — English content corpus

**Branch:** `main` (worktree `agent-abf0b982992943ee8`, forked from `1137c75`)
**Commits:** `fb522c3` (journal spelling), `a83f7b6` (corpus + thresholds)
**Gate on final state:** 145 tests / 8 files pass · `tsc --noEmit` clean · `eslint .` clean · `vite build` clean

## Implemented

### Scenarios — 20 (was 2)

Order is the locale-mirroring contract; ids are frozen for T19/T20.

| # | id | hook |
|---|---|---|
| 1 | `cat-crypto` | spec §4.1 (kept from T4, two outcome labels fixed — see below) |
| 2 | `standing-desk-poetry` | spec §4.1 (kept from T4 verbatim) |
| 3 | `sourdough-marathon` | spec §4.1 |
| 4 | `jazz-spreadsheets` | spec §4.1 |
| 5 | `fern-negotiation` | spec §4.1 |
| 6 | `cold-shower-emails` | spec §4.1 (incl. the spec's "per my last email" metric) |
| 7 | `horoscope-parking` | spec §4.1 |
| 8 | `mechanical-keyboard-bugs` | spec §4.1 |
| 9 | `dog-economist-stocks` | spec §4.1 |
| 10 | `full-moon-meetings` | spec §4.1 |
| 11 | `label-maker-inbox` | template |
| 12 | `vinyl-dinner-party` | template |
| 13 | `telescope-directions` | template |
| 14 | `cafe-peer-review` | template |
| 15 | `terms-and-conditions-service` | template (replaced a cut scenario, see self-review) |
| 16 | `jigsaw-suitcase-packing` | template (replaced a cut scenario, see self-review) |
| 17 | `stairs-small-talk` | template |
| 18 | `sock-folding-punctuality` | template |
| 19 | `thirteen-mortgage` | template |
| 20 | `browser-tabs-side-projects` | template |

Every scenario carries the four outcomes in engine order (heavy-tailed /
skewed / count / bounded 1-10), plausible units, a one-paragraph sincere cover
story, a press-release-shaped headline (13 of 20 carry the `{n}` token),
flavored covariate labels, and journal tags drawn from the existing pool. No
new journals or tags were needed — all 15 tags used already exist.

### Flavor banks

- **Grantwell: 22 emails** (≥12 required), ordered by escalating desperation —
  aphorisms and departmental nudges first, then Reviewer 2 / funding agencies /
  the defense, then press releases written before the study, industrial
  partners, the contingent postdoc line, the sabbatical committee, the
  provost's "research portfolio review", grant year three of three, and finally
  "Reviewer 2 is the same person as last time. Reviewer 2 remembers us."
- **Press: 21 blurbs** — 6 tier-1 (credulous but sober), 7 tier-2 (aggregator),
  8 tier-3 (TV chyrons in caps, incl. the spec's `STUDY: FERNS = LEVERAGE?`,
  `P LESS THAN POINT OH FIVE — WE EXPLAIN AFTER THE BREAK`, and
  `ONE NUMBER CHANGES EVERYTHING. THE NUMBER IS 0.049.`). Outlets are consumer
  parodies: Morning Chirp, The Weekly Ledger, The Sunday Supplement, Public
  Record Weekly, The Daily Scroll, Buzz & Broadsheet, Clickwell, Nightly Chyron
  Network, Channel 9 Nightly, Nightside Live.
- **Retraction sublines: 14**, all quiet and one sentence. New ones include
  "The press release is still online. It is the only part that is.",
  "Your co-authors have asked to be listed as \"consulted\".", "The finding
  survived peer review and nothing else.", "This is the version of record now."
- **Achievements + glossary:** T4's are strong; left as authored (no rewrites
  for taste, per brief).

### About-page prose (`copy.ts`)

Six keys added — each because a brief/spec requirement had no home in the
existing catalog:

- `about.frozenFork` — master spec §3.4 explicitly asks the About page to
  document that outlier z-scores are computed on the *transformed* outcome
  *within the filtered subsample*. No key existed for it.
- `about.syntheticDisclaimer` — synthetic participants, in-browser data,
  invented journals/DOIs/outlets, and the explicit no-health-claims policy.
  (`about.mechanism` is about computational honesty; `about.dataDisclosure` is
  privacy — neither covers this.)
- `about.priorArtFiveThirtyEight`, `…SpecCurve`, `…ForkingPaths`,
  `…FalsePositive`, `…OptionalStopping` — §1.4 requires five citations on the
  About page; one flat string would have forced the UI to render a paragraph
  where a bibliography belongs. `about.priorArt` is now the lead-in sentence.

Rewritten in place: `about.mechanism` (names the actual DGP, says the curve is
enumerated not sampled, states that most days are exactly zero),
`about.dataDisclosure` (names Vercel Web Analytics per the delta spec, adds
"including from us, who never had them").

## TDD evidence

**RED** — after flipping `MIN_SCENARIOS` to 20 and adding the new contracts,
before authoring:

```
FAIL  tests/content/shape.test.ts > validateLocaleContent > reports no problems for the English content
AssertionError: expected [ 'expected >= 20 scenarios, got 2' ] to deeply equal []
FAIL  tests/content/shape.test.ts > validateLocaleContent > passes when referenceIds matches …
 Test Files  1 failed (1)
      Tests  2 failed | 14 passed (16)
```

**GREEN** — after authoring: `tests/content/shape.test.ts` 16/16; full suite
145/145.

`MIN_GRANTWELL` was already at its final value of 12 (T4 landed it there), so
no threshold change was needed; the bank ships 22.

### New contracts added to the test (beyond the count flip)

1. **One-tailed direction** (`findNegativeDirectionTerms`) — the contract with
   T7: hypothesized direction is always positive, so every `outcomeLabel` must
   read so that *more* of the metric means *more* of the claimed effect. A
   14-word lexicon (fewer/less/lower/reduced/reduction/decrease/decline/
   shorter/slower/worse/loss/error/failure/drop) matched whole-word, so
   "wellness" doesn't trip "less" and "slower" doesn't trip "lower". Documented
   in-file as a *phrasing* guard, not a semantics oracle — semantic direction
   stays a human review step (I did that pass by hand; see below).
2. **Harm check** (`findHarmTerms`) — the §4 preamble lexicon
   (vaccine/drug/cancer/diet/cure/therapy/supplement) over all scenario prose,
   matched at word start so derivatives ("dietary", "drugs", "therapies") are
   caught. Exported with a lexicon parameter so T19/T20 can pass Italian and
   Spanish lists.
3. **Outcome families** (in the shared validator, so IT/ES inherit it):
   `outcomeUnits[2]` must read as a count rate (contain `/`) and
   `outcomeUnits[3]` must name the 1-10 scale the DGP actually clamps Y4 to
   (`Y4_LOADINGS.min/max`). Both patterns are punctuation and numerals, so they
   survive translation.

Five new test cases cover the new contracts, including the two false-positive
guards (a derivative like "dietary" is caught; "wellness"/"Flawless"/"Flower"
are not flagged).

## Files changed

- `src/content/en/index.ts` — the corpus (20 scenarios, 22 emails, 21 blurbs,
  14 sublines) plus a header comment stating the four authoring rules as
  binding on IT/ES.
- `src/content/en/copy.ts` — 6 new `about.*` keys, 3 rewritten, 1 register fix.
- `src/content/journals.ts` — PNAS spelling restored to the master's lowercase
  "findings", with a comment so it isn't "corrected" again.
- `tests/content/shape.test.ts` — thresholds + three new contracts + 5 cases.

No component, engine, type, or tuning file was touched.

## Self-review

Read all 20 aloud. Cut and replaced the weakest two:

- **Cut `bean-grinder-decisiveness`** ("Does grinding your own coffee beans make
  you more decisive in meetings?"). Not a harm-lexicon problem — a *comedy*
  problem: caffeine-makes-you-sharper is a real folk belief, so the absurdity
  was dulled, and it read as the one hypothesis a reader might half-believe.
  Replaced with **`terms-and-conditions-service`** — "Do people who read the
  terms and conditions get better customer service?", whose metrics ("Goodwill
  credit granted per complaint", "Length of the apology received") are the kind
  of fake-but-plausible instrument a methods nerd screenshots.
- **Cut `rain-handwriting`** ("Does rain make handwriting more legible?").
  Gentle, low-stakes, and it made a third entry in an ambient-forces cluster
  alongside `full-moon-meetings` and `horoscope-parking`. Replaced with
  **`jigsaw-suitcase-packing`** — jigsaw puzzles vs. suitcase packing, measured
  at a departure gate with a folding table, which is a fresh domain and a
  funnier field-work image.

Also fixed two things already in the tree that the direction contract exposed:

- `cat-crypto`'s outcomes 2 and 3 were "Portfolio volatility" and "Trades per
  week". Its own cover story sells cats as *risk-steadying*, so more volatility
  and more trading both argued *against* the claimed effect — a live
  contradiction with the one-tailed contract. Now "Upside capture ratio" (a
  real, skew-shaped finance metric) and "Profitable trades per week".
- `lab.peekFootnote` read "Peeking costs nothing but honesty — every extra
  batch is logged." That winks, inside Act I, where §1.2 says the game is never
  in on the joke. Now: "Collecting more data is what a careful lab does. Every
  batch is logged for the methods section." — sincere in Act I, and the logging
  detail is collected at the reveal.

Register check: no Act I string names p-hacking, forking, or the reveal; every
cover story is a straight-faced methods paragraph whose comedy comes from a
real research detail (paid-in-pizza raters, participants told the study was
about lighting, two participants dropped for changing switch type mid-study,
the broker who "sends regards"). Act II strings state facts and stop.

Harm check by hand as well as by test: no scenario touches health, nutrition,
medicine, or public health. `sourdough-marathon` is the closest approach, and
its cover story explicitly frames the mechanism as *behavioral rather than
nutritional* — the disclaimer is in the fiction, not just in the policy.

## Concerns / notes for downstream tasks

1. **Press blurbs have no scenario link.** `PressBlurb` carries only
   `{text, outlet, tier}`, so the UI will pair any blurb with any day. I
   therefore wrote all new blurbs scenario-agnostically; the only two that name
   a specific scenario (the cat one, the fern chyron) are the master spec's own
   verbatim examples, kept for that reason. If a UI task wants scenario-matched
   press, it needs a `tags` field on `PressBlurb` (a types change, not mine).
   Same reasoning applied to the Grantwell bank, which is fully agnostic.
2. **Direction contract is only half machine-checked.** The lexicon catches phrasing;
   semantic direction (e.g. "Portfolio volatility" under a calming hypothesis)
   is invisible to it. The comment in the test says so. Any new scenario needs
   the same human read.
3. **Headline token.** ~~13~~ **18** of 20 headlines carried a token (count
   corrected in fix round 1, which also renamed it `{n}` → `{effect}` and took
   the total to 19 of 20). Nothing consumes it yet; whichever UI task renders
   headlines must substitute the treatment effect and handle the one headline
   without a token.
4. **Count magnitudes.** Y3 is a rounded exp-normal (typically 0-8), so every
   count metric was chosen to be plausible at those magnitudes and with no hard
   ceiling below 8 — this is why `dog-economist-stocks` counts *holdings* per
   quarter, not quarters per year (which would cap at 4). Worth preserving in
   translation.
5. **`about.*` key count grew from 8 to 14.** T17 (About page) will render
   `about.priorArt` as a lead-in plus five citation items, and should give
   `about.frozenFork` and `about.syntheticDisclaimer` their own paragraphs.

---

# Fix round 1 — review findings

**Commit:** `b4c8fa9` · **HEAD:** `b4c8fa9` · all five findings fixed, no minors chased.

## 1. Restored the sanctioned wink

My diagnosis was half right and the send-back is fair: the old `lab.peekFootnote`
moralized ("costs nothing but honesty"), but §2.4 designates that footnote as
*"the only Act-I moment allowed to wink"*, supplies its text verbatim, and §1.4
makes quoting Armitage in-game an obligation. I had deleted a requirement, not
just a wink.

Both now exist, in order: the sincere string I wrote stays as the first-press
footnote (`lab.peekFootnote`), and `lab.peekFootnoteArmitage` was added to the
`CopyKey` union and the en catalog carrying §2.4's exact sentence —
`Fun fact: peeking five times at α = .05 inflates your false-positive rate to ~14% (Armitage, 1969).`
The catalog comment states that the UI gates it from the 2nd press, that it is
meant to be easy to miss, and that no second wink may be added elsewhere in Act I.

## 2. `{n}` → `{effect}` in headlines

Renamed in all 18 headlines that carried the token (my original report said 13
— **that number was wrong**; the correct pre-fix count was 18 of 20, and the
line above in this report is hereby corrected). `jazz-spreadsheets` gained one
as endorsed — *"Jazz in the Office Linked to {effect}% Cleaner Spreadsheets"* —
taking it to **19 of 20**. `standing-desk-poetry` stays numberless.

Substitution rule documented as rule 5 of the `index.ts` header and on
`Scenario.headline` in `types.ts`: the value is the published spec's treatment
effect, rendered in whatever frame the surrounding words imply (`{effect}%`,
`€{effect}`, `{effect} Minutes`), rounded to a whole number ≥ 1.

Enforced in `validateLocaleContent` — stricter than requested, because the real
bug is `{n}` specifically: any token that is not `{effect}` is rejected, *and*
more than one token is rejected. Two new cases cover both.

## 3. Killed the fifteen "four hundred"s

All fifteen rewritten; `grep -ci "four hundred"` over the corpus now returns
only the header comment that forbids it. Framings deliberately vary rather than
forming a new template: silent drops (fern, label-maker, sock-folding), the
co-op "still sending people" (sourdough), enrollments "arriving one wave at a
time" (cold-shower), a classification queue "not yet empty" (dog-economist), an
observation schedule "months ahead of the analysis" (vinyl), "a fourth city is
being added" (telescope), reports matched "as the boards release them" (café),
a group "we are still having considerable trouble locating" (terms), gates that
"are proving" cooperative (jigsaw), "we are still handing the extension out"
(browser-tabs). Several also shifted to present tense, which makes recruitment
read as live. Recorded as rule 6 of the header, with the reason (the lab opens
at N = 200; the briefing must not pre-announce 400).

## 4. Guards now propagate

`validateLocaleContent(content, lexicons, referenceIds?)` — `lexicons` is a
**required** `ContentLexicons { harmTerms, directionTerms }`, and the validator
runs `findHarmTerms` and `findNegativeDirectionTerms` itself. T19/T20 cannot
call the validator and silently skip either guard; omitting the argument is a
compile error. `EN_LEXICONS` is exported for the English suite. The standalone
describes were kept (they cover the helpers' false-positive behavior) and two
new cases assert the checks surface *through the validator*, which is the
property that was actually missing.

## 5. Press scenario binding

`PressBlurb.scenarioIds?: string[]` added to `src/content/types.ts` with a
comment explaining the Published screen's prefer-then-fall-back rule. Tagged:
the Morning Chirp cat blurb → `cat-crypto`; both fern/houseplant chyrons →
`fern-negotiation`. The other 18 stay untagged. The validator rejects a binding
to an unknown scenario id (new case), so a future scenario rename cannot leave
a dangling reference.

## Subsumed one-liners

- `DELIBERATE SPEC DIVERGENCE — do not "fix" back` comment above cat-crypto's
  outcome labels, naming the three spec sections (§2.4, §3.2, §4.1) that still
  say "portfolio volatility" and the direction-contract reason they cannot be
  followed here.
- Stale `(>= 2 until T6 lands the full corpus)` parenthetical cleared from
  `types.ts`; `Scenario.headline`'s comment updated to the `{effect}` contract.

Not chased, per instruction: label variety, cover-story architecture,
orthography, jigsaw headline.

## Commands + output

```
$ PATH="/usr/bin:$PATH" npx vitest run tests/content/shape.test.ts
 Test Files  1 passed (1)
      Tests  21 passed (21)

$ PATH="/usr/bin:$PATH" npx vitest run
 Test Files  8 passed (8)
      Tests  150 passed (150)

$ PATH="/usr/bin:$PATH" npx tsc --noEmit
tsc: clean

$ PATH="/usr/bin:$PATH" npm run lint
(no output)

$ PATH="/usr/bin:$PATH" npm run build
✓ built in 75ms
```

21 content-shape cases (was 16): +5 for the two headline-token contracts, the
press-binding cross-reference, and the two guard-propagation assertions.

## Files changed in this round

- `src/content/types.ts` — `PressBlurb.scenarioIds`, headline token contract,
  stale comment cleared.
- `src/content/en/copy.ts` — `lab.peekFootnoteArmitage` key + catalog entry.
- `src/content/en/index.ts` — 19 headlines on `{effect}`, 15 cover stories
  de-templated, 3 press blurbs bound, cat-crypto divergence guard, header rules
  5 and 6.
- `tests/content/shape.test.ts` — required lexicons, guards run inside the
  validator, 5 new cases.
