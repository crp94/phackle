// The flat UI copy catalog (delta spec i18n §3; master spec §4 register rules).
// CopyKey is the completeness contract: every locale's `copy` field is typed
// `Record<CopyKey, string>`, so an untranslated key fails `tsc` rather than
// silently falling back at runtime. This file is the source of truth for the
// *set* of keys: a new key is added HERE first, and `it/copy.ts` and
// `es/copy.ts` do not compile until both carry it.
//
// Register: Act I (briefing/lab/published/call) is enthusiast-sincere — the
// game is never in on the joke until Act II. Act II (reveal/summary/stats)
// is clinical, deadpan. about/legend/errors/a11y are plain and precise. Never
// smug anywhere.
//
// {token}s are interpolated by t() (src/i18n/t.ts). Journal names, press
// outlets, DOIs, and the scenario corpus are handled by content modules
// (src/content/*/index.ts), not by this catalog.
//
// ---------------------------------------------------------------------------
// EN-US CONVENTION CONTRACT (GR6 gr6-086). Both target locales have carried
// one of these since T37; the SOURCE locale never did, so its own conventions
// lived as thirty scattered per-key notes and a translator had no single place
// to read what they were transcreating FROM. These are the rules this file
// follows. They are as binding as the IT/ES ones, and several are compiled.
//
//   1. ACTIONS ARE VERB PHRASES: "Open the data", "Face the truth", "Submit
//      for publication", "Reload". Option cards and stamps are NOUN phrases
//      ("A real effect", "NULL REPORTED"): a claim the player selects is not
//      a command they issue.
//   2. SENTENCE CASE EVERYWHERE except proper nouns, mode names ("Prereg
//      Mode"), stamps and the two masthead formulas. "Editor's Pick" is a
//      journal's own title-cased furniture, not this catalog's style.
//   3. REGISTER IS SECOND-PERSON AND IMPERSONAL ABOUT ITSELF. The app says
//      "you"; it never says "we" outside `about.dataDisclosure`, where the
//      subject is genuinely the people who would have held the data.
//   4. STATISTICAL NOTATION IS NOT PROSE, AND IS IDENTICAL IN ALL THREE
//      LOCALES: decimal POINT always, and a LEADING ZERO always — `p < 0.05`,
//      `p = 0.049`, `α = 0.05`. `about.decimalNote` states this rule on the
//      About page; the notation keys are asserted byte-identical across
//      locales in the shape suites. There are no carve-outs left: the last
//      one (`α = .05`, held open only while the Armitage footnote was
//      master-spec-verbatim) closed when owner ruling (b) amended that string.
//   5. US SPELLING IN PROSE ("analyze", "behavior", "story"). SI units keep
//      their international forms in the scenario corpus (`metres`, `litres`):
//      those are units, not prose.
//   6. ONE TOKEN, ONCE. No value repeats a `{token}`. NOTE WHAT IS AND IS NOT
//      THE REASON: `t()` itself replaces EVERY occurrence (`t.ts:33` is a
//      global regex), so a repeated token would NOT render raw through `t()`.
//      The rule stands on two other grounds, both real. (a) Several sites
//      substitute with a LITERAL `String.replace`, which rewrites the first
//      occurrence only — `SpecCurve.tsx:212`, `published.ts:97`, and the UI
//      suites' own line-builders — so at those sites a repeat WOULD leave a
//      raw `{token}` on screen. (b) The cross-locale parity guards compare
//      token SETS, so a duplicate present in one locale and absent in another
//      is invisible to them; the no-repeat rule is what makes set comparison
//      sufficient, and each locale suite asserts it directly.
//   7. COUNT-BEARING STRINGS MUST READ AT THEIR TOKEN'S FLOOR, not at the
//      value you happened to test with. The floors are tabulated in the
//      standing plural-safety note further down this file.
//   8. ONE NAME PER CONCEPT, and the name is the one the player can see. The
//      screen the game ends on is "the truth", never "the reveal" (gr6-028);
//      a move is a "fork" (gr6-030); the streak is the "streak". Developer
//      vocabulary is allowed in KEY names, which only developers read.
//   9. NUMBERING: `Vol. {volume}, No. {issue}` for chrome, `#n` for the share
//      string, and nothing else (gr6-026).
//  10. EM DASHES ARE BUDGETED, not banned, and the budget is not zero
//      anywhere. The COMPILED law is two rules, applied identically to all
//      three locales (tests/content/validators.ts:143-145): at most one U+2014
//      per string, and at least 2,500 characters of corpus per dash. Italian
//      carries one extra rule Spanish does not — a RATCHET, dashes(it) <=
//      dashes(en) (it.shape.test.ts) — so Italian can never out-dash its own
//      source. Measured: 3 dashes in en, 3 in it, 1 in es, every locale
//      several times inside the density floor. Among copy VALUES the only
//      dash in any locale is stats.noData's "no data" mark; the rest are
//      press blurbs. (Dash COUNTS are quoted and character counts are not, on
//      purpose: the counts move only when someone adds a dash, whereas the
//      corpus length moves on every copy edit — twice in this round alone —
//      and always in the direction that buys headroom.) The
//      round convention of "IT/ES budget 0" is a good habit and is NOT a
//      compiled rule; do not cite it as one.
// ---------------------------------------------------------------------------
export type CopyKey =
  | 'nav.title'
  | 'nav.tagline'
  | 'nav.about'
  | 'nav.stats'
  | 'nav.legend'
  | 'nav.play'
  // GR6 gr6-017: the skip link. Visible-on-focus chrome, not an aria-only
  // string, which is why it lives in `nav.` beside the other header controls
  // rather than in `a11y.`.
  | 'nav.skipToContent'
  // GR6 gr6-022: the practice-session marker. Chrome, beside the masthead's
  // volume line, which is why it lives in `nav.` — and it is the SAME string
  // the share text uses (see the value), so the word the player read at the
  // top of the screen is the word their friends read in the paste.
  | 'nav.practiceMode'
  // The three language names are ENDONYMS: each locale is named in its own
  // language, so the value is identical in all three catalogs by design (the
  // same "proper noun, not prose" bucket as 'nav.title'). They are the
  // locale buttons' accessible names — the flag is decoration a screen
  // reader never hears, and "EN" alone is not a name anyone can search for.
  | 'nav.localeNameEn'
  | 'nav.localeNameIt'
  | 'nav.localeNameEs'
  | 'nav.themePaper'
  | 'nav.themeDark'
  | 'briefing.openData'
  | 'briefing.correspondingAuthor'
  | 'briefing.vol'
  // T15 addition: the Grantwell EmailCard's `from` prop VALUE (email.from and
  // email.subject, just above and below, are the generic "From:"/"Subject:"
  // LABELS EmailCard renders itself — see EmailCard.tsx).
  // gr6-070 retired this key's `subject` twin: one subject line sat over all
  // twenty-two Grantwell bodies, so the subject is now DATA — a bank paired
  // index-for-index with the bodies in content/<locale>/index.ts, picked by
  // the same seed. A line written for its body cannot be a single constant.
  | 'briefing.emailFrom'
  // T31 (second play-test round): the goal strip. The one line that tells a
  // first-timer, before anything else, what they are being asked to do.
  | 'briefing.goal'
  // T18 additions: the briefing's mode chooser (§2.2 "prereg unlocked: choose
  // mode first"), visible only once achievements.first_retraction exists —
  // see Briefing.tsx.
  | 'briefing.modeChooserIntro'
  | 'briefing.playHacking'
  | 'briefing.playPrereg'
  | 'briefing.alreadyPlayedToday'
  // GR6 gr6-008 (copy half): the Briefing's own finished-day state. W6 landed
  // the state by reusing `briefing.alreadyPlayedToday` (a chooser-button status
  // line) and `summary.nextIn` (an Act II countdown), and flagged both as
  // stand-ins. These two are the briefing-register pair: the screen is a
  // journal cover, so the next puzzle is the next ISSUE, which is the word
  // `briefing.vol` already prints two lines above.
  | 'briefing.finishedToday'
  | 'briefing.finishedNextIn'
  | 'email.from'
  | 'email.subject'
  | 'lab.outcome'
  | 'lab.subgroup'
  | 'lab.covariates'
  | 'lab.exclusion'
  | 'lab.transform'
  | 'lab.tails'
  | 'lab.submit'
  | 'lab.reportNull'
  | 'lab.nLabel'
  | 'lab.collectMore'
  // GR6 gr6-025: optional stopping is §2.4's "crown jewel" and measured dead
  // content — `one_more_batch` unlocked twice in 96 player-days, because the
  // button reads as "more data" and a hill-climber is almost never stuck. This
  // is the missing half of what it does: more data is the ONE move that
  // visibly improves the estimate's precision. Act-I sincere, like every other
  // methods note; the indictment stays in Act II.
  | 'lab.collectMoreHint'
  | 'lab.peekFootnote'
  | 'lab.peekFootnoteArmitage'
  | 'lab.insufficient'
  // GR6 gr6-061: SUBMIT's `disabled` flip is reported to assistive tech only
  // when focus arrives at the button, so a player turning knobs by keyboard
  // hears the new p-value and nothing about the state change that matters.
  // Rendered as a visually-hidden status beside SUBMIT while `canSubmit`. The
  // DIAL is deliberately not made chattier — its live-region calibration is
  // measured correct (GR4).
  | 'lab.canPublish'
  // T14 additions: SpecControls' six radiogroups need one visible label per
  // option, on top of the per-group headings (lab.outcome/subgroup/etc.
  // above, all pre-existing). Outcome and the two covariate NAMES come from
  // the scenario itself (Scenario.outcomeLabels/covariateLabels); every other
  // option (subgroup/exclusion/transform/tails, plus the covariate
  // none/both compound) is scenario-INDEPENDENT and lives here instead.
  | 'lab.subgroupAll'
  | 'lab.subgroupAgeLt40'
  | 'lab.subgroupAgeGe40'
  | 'lab.subgroupExpHigh'
  | 'lab.subgroupExpLow'
  | 'lab.subgroupUrban'
  | 'lab.subgroupRural'
  | 'lab.covariatesNone'
  | 'lab.covariatesBoth'
  | 'lab.exclusionNone'
  | 'lab.exclusionZ3'
  | 'lab.exclusionZ2_5'
  | 'lab.exclusionZ2'
  | 'lab.transformRaw'
  | 'lab.transformLog1p'
  | 'lab.tailsTwo'
  | 'lab.tailsOne'
  // PValueDial's mono notation (R2.4) and CoefPlot/ForkTrail's captions —
  // routed through copy per the "no user-facing string literal" rule even
  // though about.decimalNote documents the p-notation itself as
  // locale-invariant.
  | 'lab.pEquals'
  | 'lab.pBelow'
  | 'lab.dfLabel'
  | 'lab.coefPlotCaption'
  | 'lab.forkTrailLabel'
  // T31 additions (play-test round: "the UX/UI needs graphs at least; and
  // explanations; it feels too barebone"). Three groups, all Act-I SINCERE —
  // a helpful colleague describing what a control does, never a hint that it
  // is questionable. The reveal owns the indictment, and lab.peekFootnote-
  // Armitage above stays the only wink in Act I.
  //
  // 1. One methods note per SpecControls group. Written the way a methods
  //    section states a choice: what the knob does to the sample or the
  //    model, one line, no judgement.
  | 'lab.explain.outcome'
  | 'lab.explain.subgroup'
  | 'lab.explain.covariates'
  | 'lab.explain.exclusion'
  | 'lab.explain.transform'
  | 'lab.explain.tails'
  // 2. The first-run intro (collapsible, dismissed once, persisted as
  //    settings.introSeen). Upgraded by the SECOND play-test ("the UX/UI is
  //    hard to understand, it requires more explanation... beautiful but hard
  //    to fully grasp") from a three-sentence paragraph to an explicit
  //    four-step how-to-play: read · adjust · publish · face the truth. One
  //    short sentence each.
  | 'lab.howThisWorks.title'
  | 'lab.howThisWorks.step1'
  | 'lab.howThisWorks.step2'
  | 'lab.howThisWorks.step3'
  | 'lab.howThisWorks.step4'
  | 'lab.howThisWorks.dismiss'
  // 2b. The dial's own explainer — the single most important sentence in the
  //     app: a first-timer has to understand the big number without reading
  //     anything else. Plain words, no statistics vocabulary.
  | 'lab.dialCaption'
  // 3. Figure furniture. CoefPlot gains an axis label and a zero-line label;
  //    DataCut (the strip plot of the current cut, §2.4) names its comparison
  //    column here — no scenario carries a "not-treated" label, and the
  //    treated column takes Scenario.treatmentLabel — and keys its three
  //    marks. {n} in the two counting keys is a sample size, consistent with
  //    lab.nLabel/lab.collectMore.
  | 'lab.coefPlotAxis'
  | 'lab.coefPlotZero'
  | 'lab.cutControl'
  | 'lab.cutLegendIncluded'
  | 'lab.cutLegendExcluded'
  | 'lab.cutLegendMean'
  // T31 FIX ROUND (review finding 4, "RESTORED REQUIREMENT — Legend
  // pointer"): the live fork trail carries no explanation of its own emoji —
  // this one quiet line, next to it, says where to find one. Sincere
  // register, --muted, never louder than the trail itself.
  | 'lab.forkTrailHint'
  // GR6 gr6-029: the ForkTrail popover's trigger used to render `nav.legend`,
  // so the word "Legend" named two different affordances three times in twenty
  // words on one screen — the header page name, this trigger, and a sentence
  // between them pointing at the one the player is NOT standing next to. Both
  // affordances stay (measured: same 7 rows, different questions); the trigger
  // gets its own name, which asks the question the player actually has.
  | 'lab.forkTrailKey'
  | 'published.faceTruth'
  | 'published.simulatedPress'
  | 'published.editorsPick'
  | 'published.doiPrefix'
  // T15 addition: JournalCover's citation-style "authors" line.
  | 'published.authors'
  // T15 addition: the celebration's inline career-points figure (R1.6: the
  // one place --hack-gold-ink paints characters, alongside the confetti
  // marks that use plain --hack-gold).
  | 'published.careerPoints'
  // T15 review fix: master spec §2.5's fifth celebration element, the fake
  // altmetric counter — static and tier-scaled (see src/game/published.ts's
  // altmetricScore/altmetricPercentile), never the spec's "spinning up"
  // motion (a fifth, un-budgeted animation).
  | 'published.altmetricScore'
  | 'published.altmetricPercentile'
  | 'call.title'
  | 'call.real'
  | 'call.noise'
  // T16 additions: §2.6 words the two option cards as a claim plus its
  // testable consequence ("A real effect — this would replicate"), so each
  // card needs a second line.
  | 'call.realSub'
  | 'call.noiseSub'
  | 'call.prompt'
  | 'reveal.truthNull'
  | 'reveal.truthEffect'
  | 'reveal.curveCaption'
  // T16 review I4: the published caption's "Yours is highlighted" is false on
  // the abandon path -- nothing was published, and nothing is highlighted.
  // Same precedent as reveal.accounting2Abandoned.
  | 'reveal.curveCaptionAbandoned'
  | 'reveal.groupedCaption'
  // T16 review I5: the sole assistive-technology and keyboard route to
  // §2.7.2's pinned content. The figure is role="img", so its recipe callout
  // is invisible to a screen reader and unreachable by tab; this line sets the
  // published recipe as real text, in full labels, once.
  | 'reveal.publishedRecipe'
  // GR6 gr6-003: Prereg Mode's own framing for the same line. "You published"
  // is Hacking Mode's verb; a preregistered player declared the analysis
  // before seeing a number, and the reveal is the one screen that has to say
  // which of the two happened.
  | 'reveal.preregisteredRecipe'
  // GR6 gr6-001: `accounting1` is DAY-TYPED. The un-suffixed key is the NULL
  // day; the effect day gets its own line, because ~70% of an effect day's
  // hits sit on the outcome the truth line declared real one paragraph above
  // (measured: median 192 of 283 hits at N=200 over 200 effect days) and
  // calling those "chance" contradicts the game's own previous sentence.
  | 'reveal.accounting1'
  | 'reveal.accounting1Effect'
  | 'reveal.accounting2'
  // T16 addition: §2.7.3's accounting2 assumes a publication. A player who
  // reported a null result explored their paths before doing something else,
  // and the sentence has to say so rather than lie by a verb.
  | 'reveal.accounting2Abandoned'
  // GR6 gr6-003: the third variant, selected on mode === 'prereg'. A
  // preregistering player explored nothing; handing them the hacker's verb is
  // false in the only mode where the distinction is the whole lesson.
  | 'reveal.accounting2Prereg'
  | 'reveal.accounting3'
  // GR6 gr6-002: the sentence above describes a UNIFORM RANDOM explorer, and
  // nobody plays that way. A hill-climber reaches significance in a median of
  // 3-4 evaluations, so the random figure understates exactly the player it is
  // aimed at. Rendered beside accounting3 in Hacking Mode only, and only once
  // there was a search to describe (k > 1).
  | 'reveal.accounting3Directed'
  | 'reveal.peekSurcharge'
  // T16 additions: figure furniture (§7.4, DESIGN.md R8.3 — "a plain figure
  // with a --muted caption"). Kept out of the caption strings themselves so
  // the figure number can carry R2.4's mono/tabular numeral style.
  | 'reveal.fig1'
  | 'reveal.fig2'
  | 'reveal.omittedFootnote'
  // T33: the reveal's own continue action, and the only caller of
  // store.finishReveal() anywhere. Act II register: it names the ledger it
  // opens, and makes no comment on the player who is about to read it.
  | 'reveal.toSummary'
  // T16 additions: statistical NOTATION, not prose. §5 (about.decimalNote)
  // fixes the decimal point in every language, so a translator's job here is
  // to leave the digits alone and translate nothing.
  | 'reveal.pValue'
  | 'reveal.pValueTiny'
  // T16 additions: the localized spec-recipe vocabulary the SpecCurve's
  // published callout and hover tooltips are built from (§7.4's example
  // reads "Y₂ · Age<40 · +Income · |z|>2.5 · log · one-tailed").
  //
  // gr6-086 — WHAT THE MIRROR ACTUALLY IS, since the old note here overstated
  // it. These are not uniformly "terser than the Lab's labels": in English
  // four of the seven subgroup forms are BYTE-IDENTICAL to their Lab siblings
  // (ExpHigh, ExpLow, Urban, Rural), because those labels are already one
  // short line and shortening them further would only invent a second name for
  // one thing. The rule is: a recipe callout gets one line, so a form that is
  // ALREADY one line is reused verbatim, and only the ones that are not get a
  // compact variant ('All participants' → 'Everyone', 'Age < 40' → 'Age<40').
  // Italian and Spanish apply the same rule to their OWN labels and therefore
  // diverge from English about WHICH keys need a variant (IT: 'Area urbana' →
  // 'Urbano'), which is correct and is not a parity break.
  | 'reveal.subgroupAll'
  | 'reveal.subgroupAgeLt40'
  | 'reveal.subgroupAgeGe40'
  | 'reveal.subgroupExpHigh'
  | 'reveal.subgroupExpLow'
  | 'reveal.subgroupUrban'
  | 'reveal.subgroupRural'
  | 'reveal.covNone'
  | 'reveal.covIncome'
  | 'reveal.covRisk'
  | 'reveal.exclusionNone'
  | 'reveal.exclusionZ3'
  | 'reveal.exclusionZ25'
  | 'reveal.exclusionZ2'
  | 'reveal.transformRaw'
  | 'reveal.transformLog'
  | 'reveal.tailsTwo'
  | 'reveal.tailsOne'
  | 'reveal.retracted'
  | 'reveal.replicated'
  | 'reveal.nullReported'
  | 'reveal.callCorrect'
  | 'reveal.callIncorrect'
  // T18 addition: §2.8's own parenthetical for the prereg sig+null row ("a
  // real 5% false positive — teachable") — the one-line explanation the
  // reveal owes a player who preregistered honestly and still landed on
  // RETRACTED (§2.7.4's stamp logic has no other way to say "this was not a
  // mistake"). Rendered only for mode:'prereg', dayType:'null', stamp:
  // 'RETRACTED' — the exact, newly-possible combination T18 introduces (a
  // RETRACTED day with no CALL step at all).
  | 'reveal.preregFalsePositive'
  | 'share.forksWord'
  | 'share.streakWord'
  | 'summary.score'
  | 'summary.share'
  | 'summary.copied'
  | 'summary.nextIn'
  | 'summary.streak'
  // T13 addition: one label per §2.8 scoring-table row, for the Summary
  // screen's "fee invoice" breakdown (§7.3) that scoring.ts's scoreDay()
  // returns as `[CopyKey, number][]` pairs. Not in the brief's explicit
  // "(share.*)" ownership note — flagged in the T13 report: the breakdown's
  // return TYPE requires real CopyKey members and none pre-existed for these
  // rows (unlike the call/stamp rows, which reuse existing reveal.* keys).
  | 'summary.breakdownCallCorrect'
  | 'summary.breakdownCallIncorrect'
  | 'summary.breakdownParsimony'
  | 'summary.breakdownIntegrity'
  | 'summary.breakdownMissedDiscovery'
  | 'summary.breakdownTrueDiscovery'
  | 'summary.breakdownConfirmedNull'
  | 'summary.breakdownUnderpoweredLuck'
  | 'summary.breakdownFalsePositive'
  // T17 additions: the invoice heading, and the (currently disabled-for-now,
  // achievement-gated) Prereg Mode upsell body line — see Summary.tsx.
  | 'summary.invoiceTitle'
  | 'summary.preregUpsell'
  // GR6 gr6-062: the day used to end on an upsell with no route to the honours
  // board it had just added to. Shaped like `reveal.toSummary` ("See the
  // invoice") on purpose — same act, same beat, one grammar for "go and look
  // at the thing this screen just changed".
  | 'summary.viewStats'
  // T17 review fix (Important #1): shown when shareViaNavigator's whole
  // fallback chain rejects (no share API AND a failing clipboard write) —
  // share.ts's own doc comment says a rejection is "not swallowed... so the
  // caller can surface an error"; this is that surface.
  | 'summary.shareFailed'
  // T38 addition: the heading over the achievements this day just earned
  // (Summary.tsx's unlock block). The NAMES and CITATIONS under it are
  // content, not chrome — they live in each locale's `achievements` bank
  // (src/content/*/index.ts) and are rendered from there, never restated
  // here. This one key is the only chrome the block needs, and on a day that
  // unlocked nothing the whole block (heading included) is absent.
  | 'summary.unlockedToday'
  | 'prereg.title'
  // T18 addition: the preregistration form's own manuscript-register preamble
  // (§7.3) — one sentence, sincere-bureaucratic, played straight (the form
  // itself is the joke; nothing about its own copy may wink).
  | 'prereg.intro'
  | 'prereg.commit'
  // T18 addition: the form's single submit CTA, enabled only once the commit
  // checkbox is ticked (Prereg.tsx).
  | 'prereg.submit'
  | 'prereg.locked'
  | 'stats.title'
  | 'stats.played'
  | 'stats.currentStreak'
  | 'stats.maxStreak'
  | 'stats.callAccuracy'
  | 'stats.close'
  // GR6 gr6-035: the Stats screen's empty state was eleven censored blocks and
  // six em dashes with not one sentence in it, and a nav page is one tap from
  // every screen — so a curious first-timer reaches it on day one, before
  // playing anything. One key, one sentence, rendered under the title only
  // when `played === 0`.
  | 'stats.emptyState'
  // T17 additions: rolling call accuracy, the always-both-panels prereg-vs-
  // hacking success-rate comparison (§2.8's α lesson), the fork histogram,
  // and the achievement wall's locked-entry aria text. See Stats.tsx.
  | 'stats.callAccuracyLast20'
  | 'stats.successRateTitle'
  | 'stats.hackModeLabel'
  | 'stats.preregModeLabel'
  | 'stats.noData'
  | 'stats.forkHistogramTitle'
  | 'stats.forkHistogramBar'
  | 'stats.achievementsTitle'
  | 'stats.locked'
  | 'about.title'
  | 'about.intro'
  // GR6 gr6-036: About was seven unsignposted paragraphs. Read as an essay it
  // has a real argument in the right order — what this is → how it really
  // works → none of this is real → your data is yours → read these instead →
  // vocabulary — and six of those turns were invisible because nothing marked
  // them. Four short headings, in the page's own plain register. The mapping
  // these four are FOR (About.tsx renders it; see the hand-off note in the
  // record below):
  //   sectionHowItWorks → about.mechanism, about.frozenFork
  //   sectionNotReal    → about.syntheticDisclaimer, about.decimalNote
  //   sectionYourData   → about.dataDisclosure
  //   sectionPriorArt   → about.priorArt + the five citations
  // `about.intro` stands alone above them as the standfirst.
  | 'about.sectionHowItWorks'
  | 'about.sectionNotReal'
  | 'about.sectionYourData'
  | 'about.sectionPriorArt'
  | 'about.mechanism'
  | 'about.frozenFork'
  | 'about.syntheticDisclaimer'
  | 'about.decimalNote'
  | 'about.dataDisclosure'
  | 'about.priorArt'
  | 'about.priorArtFiveThirtyEight'
  | 'about.priorArtSpecCurve'
  | 'about.priorArtForkingPaths'
  | 'about.priorArtFalsePositive'
  | 'about.priorArtOptionalStopping'
  | 'about.glossaryTitle'
  | 'about.contact'
  // T17 additions: the deploy-injected version string and the source-code link.
  | 'about.version'
  | 'about.sourceLink'
  | 'legend.title'
  | 'legend.explored'
  | 'legend.unexplored'
  | 'legend.significant'
  | 'legend.published'
  // T17 additions: the §2.9 share-grid emoji table (Legend screen). Distinct
  // from the 4 SpecCurve chart-legend keys just above (explored/unexplored/
  // significant/published, T16's figure legend) — this is the OTHER legend,
  // for the emoji share string (share.ts's FORK_EMOJI + the 5 terminal/prefix
  // glyphs), hence the 'emoji' infix to keep the two apart.
  // (gr6-026: there were five. `legend.trueEffect` is gone — the SpecCurve
  // never had a true-effect row to label, so the key was never rendered.)
  | 'legend.intro'
  | 'legend.emojiSpec'
  | 'legend.emojiSubgroup'
  | 'legend.emojiExclusion'
  | 'legend.emojiTails'
  | 'legend.emojiPeek'
  | 'legend.emojiSubmit'
  | 'legend.emojiAbandon'
  | 'legend.emojiPrereg'
  | 'legend.emojiCallCorrect'
  | 'legend.emojiCallIncorrect'
  | 'errors.workerCrash'
  | 'errors.storageOff'
  // GR6 gr6-007: `errors.workerCrash` has promised "Reloading usually fixes
  // it" since T6 and the app has never offered a control that does it. This is
  // that control's label.
  | 'errors.reload'
  // GR6 gr6-021/w6-r-006/w7-r-003: the mid-play midnight notice. Booked twice
  // and written by neither wave — W6 could not print an honest countdown
  // without it and suppressed the number instead; W7 wired the rollover and
  // declined to author copy. See the value below for what it does and does
  // not say.
  | 'errors.newDay'
  // w8-r-001: `errors.newDay`'s SIBLING, for the one screen its sentence is
  // false on. Same event, a player who has already finished — see the value.
  | 'errors.newDayReady'
  | 'a11y.localeToggle'
  // T33: the theme control's group label, and the masthead's own accessible
  // name. The masthead one OPENS with the wordmark on purpose — the visible
  // label has to survive inside the accessible name (WCAG 2.5.3), so it
  // reads as the wordmark plus what tapping it does, never as a replacement.
  | 'a11y.themeToggle'
  | 'a11y.backToGame'
  | 'a11y.specCurveChart'
  // T22: the SpecCurve renders two different plates from one component — the
  // sorted curve (fig. 1) and §2.7.6's grouped-by-outcome view (fig. 2) — and
  // both carried a11y.specCurveChart, so a screen reader was told fig. 2 was
  // "sorted". One string per plate, each describing the PICTURE and nothing
  // else: what the picture shows is the figcaption's job, and both captions
  // are already read (reveal.curveCaption / curveCaptionAbandoned /
  // groupedCaption). Figures speak one sentence (T36 audit convention).
  | 'a11y.specCurveGrouped'
  | 'a11y.dataCut'
  | 'a11y.shareButton'
  | 'a11y.closeDialog'
  | 'a11y.loading';

export const copy: Record<CopyKey, string> = {
  // KEPT DELIBERATELY THOUGH NOTHING RENDERS IT (final review's dead-key
  // roster): the wordmark is the product's name, `copyFreeze.test.ts` uses it
  // as its own guards-the-guard fixture, and a catalog that cannot name the
  // app is worse than one carrying a four-character string. Rostered as KEPT
  // in that suite, so the defined→used sweep does not have to guess.
  'nav.title': 'P-hackle',
  // gr6-026 / gr6-037: the single best one-line description of the product,
  // transcreated into three languages and rendered NOWHERE. It is About's
  // standfirst (gr6-036 gives it the slot, directly under the h1 and above
  // `about.intro`), and §1(i)'s share-string hook is the second place it will
  // earn. RENDERING IS BOOKED FOR W7 (About.tsx belongs to that wave this
  // round); until it lands the key is rostered as PENDING in
  // tests/content/copyFreeze.test.ts, which fails the day it is used and the
  // roster entry is not removed.
  'nav.tagline': 'A daily game about the garden of forking paths.',
  // gr6-026: `nav.puzzleNumber` ('Puzzle #{n}') is DELETED. Nothing rendered
  // it, and it was a third numbering form in a product that had already ruled
  // on two — `Vol. {volume}, No. {issue}` for chrome (briefing.vol) and `#n`
  // for the share string (share.ts, deliberately locale-invariant). Nothing
  // else.
  'nav.about': 'About',
  'nav.stats': 'Stats',
  // T37 (audit §5.11): renders BOTH as a header nav page name and as the
  // ForkTrail popover's trigger button (ForkTrail.tsx). It must read as a page
  // NAME in both places, so do not translate it as a verb in either.
  // gr6-029 RETIRES THE SECOND JOB: the trigger takes `lab.forkTrailKey`
  // ("What these mean"), so this key goes back to being the page name and
  // nothing else. The double duty put three tokens of "Legend" within one
  // glance on the Lab, naming two affordances, with a sentence between them
  // pointing at the one the player was not standing next to. Until W7 lands
  // that one-line swap in ForkTrail.tsx:170 the old wording is still on
  // screen; the instruction above stands either way.
  'nav.legend': 'Legend',
  'nav.play': 'Play',
  // gr6-026: `nav.localeToggle` is DELETED. The visible control is a pair of
  // endonym buttons and its group label is `a11y.localeToggle`, which holds
  // the same word; nothing ever looked this key up.
  // gr6-017: nine chrome tab stops stand between the top of every screen and
  // the one control the screen is for. `<main>` is already focusable
  // (`tabindex="-1"`, T22), so the link is the whole fix. Names the
  // DESTINATION, because that is what a skip link is read as.
  'nav.skipToContent': 'Skip to the main content',
  // gr6-022 — THE ONE WORD PRACTICE MODE HAS NEVER HAD.
  //
  // Practice mode reaches the player two ways (daily.ts's `isPractice`): every
  // date before EPOCH, and `?practice=1`, which does not expire at launch. It
  // records nothing (dayComplete.ts skips `saveDay` entirely on a practice
  // day), it re-seeds from `Math.random()` rather than from the date, and it
  // can be replayed any number of times — and until this key, none of that was
  // visible ANYWHERE. A practice session rendered a masthead, a journal cover,
  // a DOI and a share string that a stranger could not tell from the real day
  // whose date it borrowed.
  //
  // A NOUN PHRASE, not a verb phrase (rule 1): it labels a state the player is
  // in, it is not something they do. It renders in exactly two places, and on
  // purpose: beside the masthead's volume line — which now prints an em dash
  // where the issue number would be (src/ui/masthead.ts) so the two read as
  // one statement — and inside the share string's first line, which is the
  // only line of that text a reader can use to place the run. Rule 8 (one name
  // per concept) is what makes that reuse right rather than lazy: a second
  // string for the share would be free to drift from the one on screen, and
  // the drift would land in the text that leaves the app.
  'nav.practiceMode': 'Practice run',
  'nav.localeNameEn': 'English',
  'nav.localeNameIt': 'Italiano',
  'nav.localeNameEs': 'Español',
  // T37 (audit §5.10, corrected for T33's control): these are the two OPTIONS
  // of a segmented theme control (App.tsx's ThemeToggle), one button each,
  // both on screen at once with `aria-pressed` marking the live one. They name
  // a theme, exactly as call.real/call.noise name a claim: option labels,
  // never verbified. (The audit described the pre-T33 single flip-flop button
  // and said "the button shows the theme you are in"; that button is gone, and
  // the instruction that survives it is this one.)
  'nav.themePaper': 'Paper',
  'nav.themeDark': 'Dark',

  // T37 (T36 audit §5.1, adopted as a VALUE change). ACTION, and the Briefing
  // screen's primary CTA (Briefing.tsx): the only control a first-time player
  // can press, and the transition out of Act I. The old value, 'Open Data',
  // was the one Title-Cased action in an otherwise sentence-case catalog and
  // a homograph of the open-data policy badge -- both translators read it as
  // the badge noun and shipped a noun phrase. Translate as a VERB in each
  // locale's own button mood (es infinitive, it imperative), never as the
  // "open data" badge noun, and never leave it in English.
  'briefing.openData': 'Open the data',
  // Fix (T15 review, subsumed one-liner): the PLAYER is the paper's author
  // ("You"); Grantwell is only the PI *emailing* them (briefing.emailFrom).
  // "Corresponding author: You" is master spec §2.3/§7.3's own wording — the
  // T4-authored value below had this backwards (crediting the PI, not the
  // player). IT/ES (T19/T20): carry this same correction into your own
  // transcreations, not the pre-fix wording.
  'briefing.correspondingAuthor': 'Corresponding author: You',
  'briefing.vol': 'Vol. {volume}, No. {issue}',
  'briefing.emailFrom': 'Prof. R. Grantwell',
  // T31: the goal strip, directly under the title card. Sincere and literal —
  // this is genuinely the task Act I is setting.
  'briefing.goal': 'Your task: find a statistically significant effect (p < 0.05) and publish it.',

  // T18 additions — the mode chooser (§2.2), shown only once Prereg Mode is
  // unlocked and today's preregistration has not been filed yet.
  'briefing.modeChooserIntro': 'Preregistration is unlocked. Choose how you play today. One attempt per mode.',
  'briefing.playHacking': 'Play Hacking Mode',
  'briefing.playPrereg': 'Play Prereg Mode',
  'briefing.alreadyPlayedToday': 'Already played today',
  // gr6-008 (copy half) — the Briefing's finished-day state, in the Briefing's
  // own register. `briefing.alreadyPlayedToday` is a status line under a
  // disabled chooser button and reads as a refusal; this is the whole screen
  // saying the day is done, above the share string it then shows. TRUE ON BOTH
  // PATHS: a player who reported a null result finished the day too, so the
  // sentence names the day, never a publication.
  'briefing.finishedToday': "Today's puzzle is finished. Here is how it went.",
  // The countdown, in the masthead's vocabulary rather than the invoice's:
  // `briefing.vol` prints "Vol. 1, No. 11" two lines above, so the next puzzle
  // is the next ISSUE. Same two tokens as `summary.nextIn`, same floors.
  'briefing.finishedNextIn': 'The next issue arrives in {hours}h {minutes}m.',

  'email.from': 'From:',
  'email.subject': 'Subject:',

  'lab.outcome': 'Outcome',
  'lab.subgroup': 'Subgroup',
  'lab.covariates': 'Covariates',
  // T37 (audit §5.5): an English noun-noun compound, and both locales calqued
  // it. Name the control in the target language's own grammar; the Romance
  // languages need a preposition here ("esclusione DEGLI outlier").
  'lab.exclusion': 'Outlier exclusion',
  'lab.transform': 'Transform',
  'lab.tails': 'Tails',
  'lab.submit': 'Submit for publication',
  'lab.reportNull': 'Report null result',
  'lab.nLabel': 'n = {n}',
  'lab.collectMore': 'Collect {n} more',
  // gr6-025 — what the button is FOR, beside the button. Measured, peeking is
  // a fallback nobody reaches: a hill-climber on six knobs finds significance
  // in a median of 3 evaluations and is therefore never stuck, so §2.4's crown
  // jewel and its Armitage footnote are seen by a small minority of players.
  // The honest attraction is precision: n moves and the CoefPlot's interval
  // narrows with it, and nothing on the screen said so. Sincere, factual, no
  // wink — the surcharge at the reveal is where this gets paid for, and Act I
  // must not flinch first. Vocabulary matches `lab.coefPlotCaption`'s own
  // "95% CI" so the sentence points at a thing the player can already see.
  'lab.collectMoreHint': 'A bigger sample narrows the 95% CI on your estimate.',
  // Two footnotes, in order. The first press gets the sincere one: collecting
  // more data is what a diligent lab does, and the logging detail is planted
  // here to be collected at the reveal. From the 2nd press (§2.4; the UI task
  // owns the gating) the Armitage line fades in — the master spec's verbatim
  // text, its §1.4 citation obligation, and the ONLY Act-I moment allowed to
  // wink. It is meant to be easy to miss. Do not make it louder, and do not
  // add a second wink anywhere else in Act I.
  'lab.peekFootnote': 'Collecting more data is what a careful lab does. Every batch is logged for the methods section.',
  // ------------------------------------------------------------------
  // CONTROLLER RE-RULING, 2026-08-06 (w2-r-001) — a DOCUMENTED DEVIATION from
  // the master spec's verbatim text (docs/implementation_plan.md §2.4).
  //
  // Owner ruling (b) said to insert "equally spaced", on the premise that this
  // game's peeks are not. THAT PREMISE IS FALSE: `N_SCHEDULE` is
  // 200→250→300→350→400, i.e. equally spaced with Δn = 50, so the inserted
  // words distinguished nothing and the sentence stayed as wrong as before.
  //
  // The condition the 14% actually depends on is EQUAL FRACTIONS OF TOTAL
  // INFORMATION — Armitage's five looks sit at 80/160/240/320/400, so the
  // first look sees a fifth of the data. This game's first look sees a HALF.
  // Two-sided repeated significance testing at α = 0.05, simulated as a
  // Brownian walk (1,000,000 trials per schedule; the reviewer's independent
  // 2,000,000-trial run agrees to the second decimal):
  //     Armitage's design (80/160/240/320/400)   14.172%
  //     five equal unit groups (1..5)            14.199%
  //     THIS GAME (200/250/300/350/400)          11.174%
  //     at the footnote's first appearance       8.681%   (200/250/300)
  //     a single look                             5.023%
  //
  // So the string now states THE CITATION'S FACT ABOUT A DESIGN, and states
  // the condition that fact depends on: five tests, one after each of five
  // equal batches. It is deliberately IMPERSONAL — no "your", no "peeks" — and
  // that is a correctness requirement, not a style choice. The old wording
  // read as a description of the player's own action, and as such it was
  // unreachable: `N_SCHEDULE` allows a maximum of FOUR peeks, the footnote
  // renders from the second, and this readership's real inflation is 8.7-11.2%.
  // A future pass must not "simplify" it back toward the second person.
  //
  // The alternative the re-ruling weighed and did not take was printing the
  // game's own 11.2%: stronger pedagogy, but it replaces a published figure
  // with a simulated one that then needs its own provenance on screen.
  //
  // gr6-027: `α = .05` became `α = 0.05` in the same edit. The leading-zero
  // carve-out for this string was conditional in its own terms — the backlog
  // grants it "only while the Armitage line stays spec-verbatim" — and this
  // line is no longer spec-verbatim. about.decimalNote now states the rule out
  // loud ("a leading zero on every one"), which this was the last string to
  // break. The ES header's rule 2 quoted `α = .05` as a worked example and
  // moves with it.
  // ------------------------------------------------------------------
  'lab.peekFootnoteArmitage':
    'Fun fact: testing after each of five equal batches of data turns α = 0.05 into a false-positive rate of ~14% (Armitage, 1969).',
  // gr6-096: the old value opened `n < 30.` and thereby asserted a cause it
  // could not know. `MIN_CELL` is one of two reasons a cell is unanalysable
  // (the other is a singular XᵀX), and it is the one that never binds: 0 of
  // 215,040 enumerated points hit it. So the string named the wrong cause on
  // every occasion it could actually render. It now reports the state and
  // stops. Same defect class as w1-r-004's "you followed the p-value".
  // w2-r-007: "cut" is engine vocabulary (`DataCut`), not a word this screen
  // ever teaches. Both locales had already reached for "subsample"/"submuestra";
  // English follows them, and about.frozenFork already uses the word.
  'lab.insufficient': 'Not enough data to analyze this subsample.',
  // gr6-061 — the SUBMIT-became-possible announcement. Read once, by a live
  // region, at the moment it becomes true, so it opens with the fact and then
  // says what the fact permits. `0.05` carries its leading zero (gr6-027).
  'lab.canPublish': 'Below 0.05. You can submit this for publication.',

  // Subgroup radiogroup options (master spec §2.4's own table wording).
  'lab.subgroupAll': 'All participants',
  'lab.subgroupAgeLt40': 'Age < 40',
  'lab.subgroupAgeGe40': 'Age ≥ 40',
  'lab.subgroupExpHigh': 'High experience',
  'lab.subgroupExpLow': 'Low experience',
  'lab.subgroupUrban': 'Urban',
  'lab.subgroupRural': 'Rural',

  // Covariates radiogroup: the two named options come from the scenario
  // (covariateLabels.income/risk); these two cover the "neither" and "both" ends.
  'lab.covariatesNone': 'None',
  'lab.covariatesBoth': '{income} + {risk}',

  'lab.exclusionNone': 'None',
  'lab.exclusionZ3': '|z| > 3',
  'lab.exclusionZ2_5': '|z| > 2.5',
  'lab.exclusionZ2': '|z| > 2',

  'lab.transformRaw': 'Raw',
  'lab.transformLog1p': 'log(1+x)',

  'lab.tailsTwo': 'Two-tailed',
  'lab.tailsOne': 'One-tailed',

  // PValueDial notation (R2.4 mono/tabular; 3-decimal format below .001).
  'lab.pEquals': 'p = {p}',
  'lab.pBelow': 'p < 0.001',
  'lab.dfLabel': 'df = {df}',
  'lab.coefPlotCaption': 'Estimate {beta} {unit} (95% CI {lo} to {hi})',
  'lab.forkTrailLabel': 'Forks so far',

  // T31 — the six methods notes, one under each SpecControls group. Act-I
  // SINCERE: this is a colleague explaining a control, in the register a
  // methods section uses. Not one of them may hint that the choice is
  // convenient, or that making it after seeing the result is the problem —
  // the reveal earns that, and earns it harder if Act I never nudged.
  // T31 FIX ROUND (subsumed-welcome rewrites, done opportunistically while
  // already in this block for findings 2/4): plainer wording for two of the
  // six notes, still Act-I sincere, still no judgement of the choice.
  // GR6 gr6-034: "fit"/"fitting" was unglossed jargon in three of these six,
  // and in no glossary — an intransitive statistical verb a smart 15-year-old
  // does not have, on the screen they spend the whole session on. The three
  // notes are rewritten in words that need nothing looked up, and the outcome
  // note goes with them: "which of the four things you measured" was doing the
  // work of a definition without being one.
  'lab.explain.outcome': 'The measurement this analysis tries to explain. There are four to choose from.',
  'lab.explain.subgroup': 'Run the analysis on one group of participants instead of on everybody.',
  'lab.explain.covariates': 'Also account for background differences between people when comparing the two groups.',
  'lab.explain.exclusion': 'Drop the most extreme values from the sample before the analysis runs.',
  'lab.explain.transform': 'Measure the outcome on its own scale, or compress its large values onto a log scale.',
  'lab.explain.tails': 'Test for an effect in either direction, or only in the predicted one.',

  // T31 — the first-run intro: four steps, one short sentence each,
  // welcoming, no jargon beyond the game's own 0.05. Shown until dismissed,
  // then never again (settings.introSeen). Step 4 and published.faceTruth are
  // the same beat, named the same way.
  // T37 (audit §5.7): that instruction used to say "reuse the wording
  // verbatim". Right about the TERM, wrong about the MOOD -- published.faceTruth
  // is a BUTTON and step 4 is a numbered INSTRUCTION, and Spanish buttons take
  // the infinitive where its instructions take the tú-imperative. So: same
  // beat, same NOUN ("the truth"); each locale sets the mood its own UI
  // conventions require.
  // GR6 gr6-033: step 1 used to say "Read the brief", which is the one step of
  // four that CANNOT be performed from where it is printed — the panel renders
  // inside the Lab, after the Briefing is gone — and it mis-described what the
  // player had just done. It now points at the question that is still on
  // screen, above the controls. Step 4 gains the call: §2.6's binary verdict is
  // the game's whole point and the four steps used to fold it into "face the
  // truth", so a first-timer was never told it was coming.
  'lab.howThisWorks.title': 'How to play',
  'lab.howThisWorks.step1': "Start from the question at the top: that is what today's data is supposed to answer.",
  'lab.howThisWorks.step2': 'Adjust the analysis until the big number drops below 0.05.',
  'lab.howThisWorks.step3': 'Submit your finding for publication.',
  'lab.howThisWorks.step4': 'Face the truth about what you found, and say whether you believe it.',
  'lab.howThisWorks.dismiss': 'Got it',

  // T31 — the dial's explainer. Plain words: what the number means, and what
  // makes it publishable. No "null hypothesis", no "significance", no Greek.
  // FIX ROUND (finding 2): the original wording had the number's direction
  // backwards ("how surprising your result would be if nothing were really
  // going on" reads as if a LARGE number is the alarming one; it is the
  // opposite — a small p is what makes a result hard to shrug off as luck).
  'lab.dialCaption':
    'This number is how often plain luck alone would produce a result like yours. The smaller it is, the harder your result is to dismiss as luck. Below 0.05, you can publish.',

  // T31 — figure furniture. CoefPlot's axis and zero-line labels; DataCut's
  // comparison-column name and its three mark keys.
  'lab.coefPlotAxis': 'Estimated effect ({unit})',
  'lab.coefPlotZero': 'no effect',
  'lab.cutControl': 'Comparison group',
  // gr6-068: 'Analysed' was the corpus's only British spelling in prose that
  // renders in the SAME COLUMN as lab.insufficient's "analyze" — one screen,
  // one verb, two orthographies, both out of this catalog. The corpus default
  // is US prose. `metres`/`litres` in the scenario bank stay: they are SI
  // units, not prose, and they read as international beside the euro figures.
  'lab.cutLegendIncluded': 'Analyzed: {n}',
  'lab.cutLegendExcluded': 'Excluded: {n}',
  'lab.cutLegendMean': 'Group mean',

  // T31 FIX ROUND — finding 4, "RESTORED REQUIREMENT — Legend pointer".
  // One quiet line next to the live ForkTrail: the trail's own emoji are
  // otherwise unexplained anywhere in the Lab.
  // T37 (audit §5.6): "has the key" is an English idiom, and "key" for a chart
  // legend has no cognate in either target language. It means "the explanation
  // of the symbols" -- do not translate the noun literally.
  // GR6 gr6-029/gr6-032: the idiom is now gone from English too. It survived
  // the T37 audit as an instruction rather than as a fix, and Spanish shipped
  // the exact calque the instruction warned against ("la clave está en…", i.e.
  // "the ANSWER is on the Legend page"). A sentence that needs a translator
  // note in three languages is a sentence to rewrite, not to annotate. The
  // replacement says what the Legend page does — it lists the symbols — and
  // needs no idiom in any locale.
  'lab.forkTrailHint': 'Each symbol is one move you made. The Legend page lists them all.',
  // gr6-029 — the ForkTrail popover's trigger, which used to render
  // `nav.legend`. It is not a page name and must not read as one: it is the
  // question a player looking at a row of unfamiliar glyphs actually has.
  // Keeping BOTH affordances is deliberate (GR4 measured them rendering the
  // same 7 rows and answering different questions: "what do these mean, here,
  // now" versus "take me to the reference page").
  'lab.forkTrailKey': 'What these mean',

  'published.faceTruth': 'Face the truth',
  'published.simulatedPress': 'SIMULATED PRESS',
  'published.editorsPick': "Editor's Pick",
  'published.doiPrefix': 'DOI:',
  'published.authors': 'You, et al.',
  // W6 asked (TODO-W2 at Summary.tsx:189) whether the Summary should get its
  // own invoice-register wording instead of reusing this string, e.g.
  // "Career points +25 - separate account". DECLINED, and recorded here
  // rather than left open. W6's own reason for the stand-in is the better
  // argument: the Summary line exists to AGREE with the number the Published
  // screen printed two screens earlier, and reusing the identical string is
  // the strongest form of that agreement — a second key would let the two
  // drift silently, and the drift would land on the one figure §2.8 says is
  // never a summand of the score. The register objection also does not hold:
  // gr6-018 deliberately renders career as its own LINE beside the total, not
  // as an invoice row, so it is not sitting among labelled rows asking to be
  // labelled like one. (The proposed wording also carried an em dash into a
  // locale pair that would then have to work around it.)
  'published.careerPoints': '+{n} career points',
  // T32 (third play-test: "What's the attention score? I don't understand"):
  // the badge parodies an altmetric counter, and the parody only lands if the
  // number is legible WITHOUT knowing what an altmetric is. "Attention score"
  // named the real-world referent instead of the thing being counted; a plain
  // count of online mentions says the same and needs no footnote. The
  // percentile line below already landed and is unchanged.
  //
  // TWO NOTES FOR T19/T20. (1) PLURAL SAFETY: {n} is altmetricScore(), whose
  // lowest possible value is the tier-1 floor of 40 (src/game/published.ts's
  // ALTMETRIC_SCORE_RANGE_BY_TIER), so the English plural is unconditionally
  // safe here. A locale whose number agreement differs must still check that
  // floor rather than assume it. (2) ONE TOKEN ONLY: t() and the tests
  // substitute {n} with String.replace. `t()` itself replaces EVERY occurrence
  // (t.ts:33 is a /g regex); the SITES that use a literal String.replace do
  // only the first — see the ONE TOKEN, ONCE note in the header.
  // gr6-065: the adverb used to trail the prepositional phrase ("Mentioned 659
  // times online already"), which reads as translated-into-English on the one
  // screen whose whole job is to sound like a real press office. English
  // fronts it. Same token, one occurrence, plural still safe at the tier-1
  // floor of 40. (Italian already fronted it: "Già menzionato…".)
  'published.altmetricScore': 'Already mentioned {n} times online',
  // gr6-086 / final-011, DONE — this was the one `{n}` in the whole catalog
  // that is a PERCENTAGE rather than a count (altmetricPercentile() returns a
  // top-N% figure), and it is now `{pct}`. The rename had to be atomic across
  // four files: a value renamed in the catalogs alone leaves
  // `t(key, { n: … })` at the binding site with no `{n}` to substitute, and
  // t() leaves an unmatched token VISIBLE by design — so the press card would
  // have printed "Top {pct}% of all research outputs" to a real player. All
  // three catalogs and `src/ui/screens/Published.tsx` changed in one commit.
  // What the rename buys: a translator reading this value now knows the
  // number is a percentage without having to find the function that produces
  // it, which is the whole reason the two shapes should never share a name.
  'published.altmetricPercentile': 'Top {pct}% of all research outputs, all time',

  // §2.6 verbatim: the call is conspiratorial, not accusatory — Act I's last
  // beat, and the hinge into Act II. "Noise I dressed up" is the player's own
  // admission to make; the game does not make it for them.
  // ------------------------------------------------------------------
  // GR6 gr6-028 — "THE REVEAL" IS DEVELOPER VOCABULARY AND IS NOW GONE FROM
  // PLAYER COPY, IN ALL THREE LOCALES.
  //
  // The screen is never called that anywhere the player can see. It is entered
  // by a button that says "Face the truth" (published.faceTruth), it leaves by
  // one that says "See the invoice" (reveal.toSummary), and the how-to-play
  // panel calls it "the truth" (lab.howThisWorks.step4). Five strings used the
  // word anyway, one of them the first line of the modal that hinges Act I into
  // Act II. GR3 named two; the other three are the same defect and moved with
  // them, because the IT/ES convention contracts PIN the term ("la
  // rivelazione" / "la revelación") and an amendment that left three strings
  // behind would be a contract that lies:
  //   call.title, prereg.intro, prereg.locked,
  //   about.priorArtSpecCurve, about.priorArtOptionalStopping.
  // The replacement vocabulary is the one the product already owns: "the
  // truth", and for About, "the day" (the chart the day ends on). The `reveal.`
  // KEY PREFIX is unchanged — it is developer vocabulary in a place developers
  // read, which is exactly where it belongs.
  // ------------------------------------------------------------------
  'call.title': 'Before you find out…',
  // T37 (audit §5.9): call.real and call.noise sit on <button>s, but they are
  // CLAIMS the player selects, not actions they perform. Option titles, not
  // commands -- never verbify them in translation.
  'call.real': 'A real effect',
  'call.realSub': 'This would replicate.',
  'call.noise': 'Noise I dressed up',
  'call.noiseSub': 'This would not replicate.',
  'call.prompt': 'Between us: what do you think you found?',

  // §2.7.1. {beta} is always "0.000" here — it is a parameter rather than a
  // literal only so the numeral can be typeset in mono (R2.4); translate the
  // sentence around it and leave the token alone.
  'reveal.truthNull': 'True effect on every outcome measured: {beta}.',
  // {beta} is the injected coefficient in the outcome's OWN raw units (not a
  // standardized d), which is why {unit} qualifies the outcome rather than
  // trailing the number: "on Self-assessed profundity (1–10 scale): β = 0.37"
  // reads; "β = 0.37 1–10 scale" does not.
  'reveal.truthEffect': 'True effect on {outcome} ({unit}): β = {beta}. On every other outcome, nothing.',
  'reveal.fig1': 'Fig. 1',
  'reveal.fig2': 'Fig. 2',
  'reveal.curveCaption': 'Every specification you could have run, sorted by p-value. Yours is highlighted.',
  'reveal.curveCaptionAbandoned':
    'Every specification you could have run, sorted by p-value. Nothing was published.',
  'reveal.publishedRecipe': 'You published: {recipe}',
  'reveal.preregisteredRecipe': 'You preregistered: {recipe}',
  // §7.3 pins this sentence. It holds on null days too: nothing clusters, and
  // that is the same lesson read from the other side.
  'reveal.groupedCaption': 'Real effects cluster. Noise scatters.',
  'reveal.omittedFootnote': '{n} specifications had too little data to analyze and are not plotted.',
  'reveal.toSummary': 'See the invoice',
  'reveal.pValue': 'p = {p}',
  'reveal.pValueTiny': 'p < 0.001',
  // ------------------------------------------------------------------
  // T37 (audit §5.3) — STANDING PLURAL-SAFETY NOTE for every counting token
  // in this catalog. `published.altmetricScore` already carried one; these
  // four keys did not, and English itself was WRONG AT 1 in all of them
  // ("You explored 1 paths", "Your 1 data-peeks", "1 forks").
  //
  // A string is only safe if it reads correctly at its token's FLOOR, not
  // merely at the value you happened to test with. Three forms get there, and
  // the fix below uses each where it fits:
  //
  //   a. PARTITIVE / ANAPHORIC: "{k} of them". The count quantifies a set
  //      named elsewhere, so nothing after it has to agree. Used by
  //      reveal.accounting2/2Abandoned/3 (see the antecedent note below).
  //   b. SINGULAR HEAD NOUN: "Your data-peeking ({peeks}×) makes …". The
  //      subject is a mass noun, so the verb never has to switch. Used by
  //      reveal.peekSurcharge.
  //   c. LABEL-COLON-COUNT: "Forks: {forks}". No grammar downstream of the
  //      colon at all. Used by stats.forkHistogramBar, summary.streak (in all
  //      three locales since gr6-066 — English was the last holdout), and the
  //      accounting lines in IT/ES.
  //
  // What does NOT work, and was tried: a bare parenthesised count after a
  // plural head noun ("Your data-peeks (1) make …") keeps the plural verb and
  // the plural noun, and "({peeks} times)" just relocates the defect to
  // "1 times".
  //
  // The real floor of every counting token, so no locale has to guess:
  //   {k}      (accounting2/2Abandoned/3)  >= 1  -- playerExplored is
  //            explored.length, and submitting the default spec gives 1.
  //   {peeks}  (peekSurcharge)             >= 1  -- Reveal.tsx renders the
  //            line only when peeks !== 0; {mult} is peeks + 1, so >= 2.
  //   {forks}  (stats.forkHistogramBar)    >= 0  -- the histogram is indexed
  //            from zero, so the FIRST bar always reads 0 and the second 1.
  //   {n}      (summary.streak)            >= 1  -- Summary renders it
  //            unconditionally and the streak counts today, so day one is 1.
  //   {n}      (published.altmetricScore)  >= 40 -- the tier-1 floor.
  //   {n}      (reveal.omittedFootnote)    >= 1  -- rendered only when > 0.
  //   {pct}    (published.altmetricPercentile) 1..99 -- NOT A COUNT: it is a
  //            percentage, and it used to be spelled {n} like everything
  //            above it. Renamed with its binding site (gr6-086); the name is
  //            now the disclosure, so a locale can no longer read it as a
  //            count by accident. Plural agreement is not at issue.
  //   {hours}/{minutes} (summary.nextIn, briefing.finishedNextIn) >= 0 -- both
  //            render at midnight-minus-a-minute, so "0h 1m" is reachable.
  //   {total}/{sig} (accounting1)          {sig} may legitimately be 0.
  //   share.forksWord/share.streakWord: the share grid used to read
  //   "{n} forks", with n as low as 0 or 1 and no way to inflect the noun.
  //   Fixed at the SITE (share.ts's line 3, form c) rather than in the word,
  //   because the string leaves the app; see share.ts's §2.9 deviation note.
  //
  // A locale whose agreement rules differ from English must check the floor
  // above rather than assume the English form is safe.
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // GR6 gr6-001 (blocker, `scientific`) — WHY "BY CHANCE ALONE" IS GONE FROM
  // BOTH VARIANTS OF THIS LINE.
  //
  // NULL DAYS, AND THE CORRECTION W1's REVIEW FORCED (w1-r-001).
  //
  // The first attempt at this line said "Some are chance; the rest are
  // confounding". The confounding is real in the DGP — treatment is assigned
  // from the same latents the outcomes load on (dgp.ts: X = 1[0.3·L1 + 0.2·L4
  // + 0.94·ε > 0] while Y1 loads on L1 and L4), L1 has no covariate proxy on
  // offer, and the plainest Y1 specification rejects at 18.2% against a nominal
  // 5% over 600 unconditioned draws. But that is ONE specification of 1,792,
  // and the most confounded one, while this sentence's subject is the {sig}
  // count over the whole grid.
  //
  // Measured properly, by permuting the treatment column within the accepted
  // dataset (the exact null; same outcomes, same covariates, same correlation
  // structure among the 1,792 tests), 4 permutations/day over 188 ACCEPTED null
  // days at N=200:
  //     observed     mean 94.46 hits (5.27% of 1,792)
  //     permuted-X   mean 89.66 hits (5.00% of 1,792)
  // The excess attributable to confounding is 4.8 paths — 5% of the hits, at a
  // paired t of 1.11, i.e. indistinguishable from zero. On 90 of 188 accepted
  // days chance alone produces AT LEAST as many hits as observed, so "the rest
  // are confounding" described a negative quantity on half the days.
  //
  // The mechanism is §3.3's rejection sampler: NULL_SIG_BAND = [30, 180]
  // straddles the nominal 89.6, so the confounded tail is exactly what gets
  // discarded. On RAW draws the excess IS 25% of hits; on the days a player is
  // actually served it is not. (About's own rejection-sampler disclosure is
  // gr6-004, W2 — whatever it says must agree with this.)
  //
  // So the line now states three things that are all measured-true: the count
  // is what the threshold alone produces, there is no effect, and the design is
  // still not a clean test. Controller ruling (a) is satisfied — the confound
  // is named, in About's own words, and chance is never offered as the sole
  // cause — without claiming confounding explains the count, which ruling (a)
  // never licensed.
  //
  // EFFECT DAYS. The line rendered unconditionally, one paragraph below
  // reveal.truthEffect's "True effect on X: β = ...". Measured over 200 effect
  // days at N=200: median 283 significant paths, of which a median of 192 sit
  // ON THE TRUE OUTCOME — 69.7% of the hits the sentence called chance. Hence
  // the split, which the engine now computes (reveal.ts's sigTrueOutcome /
  // sigOtherOutcome).
  //
  // Both variants set the threshold as `p < 0.05`, with the leading zero, per
  // about.decimalNote's own worked example and briefing.goal's `p < 0.05`.
  // {trueSig} and {otherSig} both floor at 0 and neither is followed by a noun
  // that has to agree, so the sentence reads at every value (form (a) of the
  // standing plural-safety note above: a bare count against a set named
  // elsewhere).
  // ------------------------------------------------------------------
  'reveal.accounting1':
    'Of {total} possible analyses, {sig} ({sigPct}%) reach p < 0.05. None of them found an effect, because there is none: a 0.05 threshold lets about one in twenty through on its own. None of them is a clean test either: the treatment was never randomly assigned, so it is confounded with age and income.',
  // w1-r-003: the closing line was "Nothing in a p-value distinguishes the
  // two", which is an absolute — and two blocks below, on this same screen,
  // Fig. 2's caption says "Real effects cluster. Noise scatters." over the
  // figure the code calls the most important educational graphic in the game.
  // The p-values DO distinguish them in aggregate; that is the whole point of
  // the grouped view. It is one p-value, read alone, that cannot.
  'reveal.accounting1Effect':
    'Of {total} possible analyses, {sig} ({sigPct}%) reach p < 0.05: {trueSig} on the outcome where the effect is real, {otherSig} on the outcomes where nothing is. A single p-value does not tell you which is which.',
  // ANAPHORA, load-bearing: "them" refers back to accounting1's "{total}
  // possible analyses", which Reveal.tsx always renders immediately above
  // (block "accounting", first <p>). That is what makes "{k} of them"
  // grammatical at 1 AND at 14 -- a partitive takes no agreement with the
  // count. Do not reorder these three statements, and do not translate this
  // pronoun into a locale where it would have no antecedent: IT/ES restate
  // the noun instead, which is equally correct and their own idiom.
  'reveal.accounting2': 'You explored {k} of them before publishing.',
  'reveal.accounting2Abandoned': 'You explored {k} of them before reporting a null result.',
  // GR6 gr6-003: COMMITTED, NOT EXPLORED. Rendered on prereg days in place of
  // accounting2, whose verb is Hacking Mode's. "and ran nothing else" rather
  // than "and ran that one" so the sentence survives a k the mode does not
  // currently produce (preregCommit passes exactly one spec today).
  // "before seeing a single number" rather than "before seeing any data": a
  // preregistering player HAS read a briefing, so "any data" overstated it.
  // prereg.intro's own wording, which IT and ES had already followed.
  'reveal.accounting2Prereg': 'You committed to {k} of them before seeing a single number, and ran nothing else.',
  'reveal.accounting3':
    'A researcher randomly exploring {k} of them finds at least one "significant" result about {pHitPct}% of the time.',
  // GR6 gr6-002: the honest second half of the sentence above. Measured, a
  // greedy hill-climber on the visible p-value publishes in a median of 3-4
  // evaluations against pHit[4] = 0.181, so the random-explorer figure reads as
  // "you were unlucky-lucky" to precisely the player who gamed the search best.
  // Directed search is what Gelman and Loken's garden is about, and the number
  // above is a floor for it, not an estimate of it.
  // w1-r-004: CONDITIONAL, because the game does not know. The first draft
  // asserted "you followed the p-value" as a fact about the player while gating
  // only on `mode === 'hack' && playerExplored > 1`. The engine holds the
  // explored list and the full curve and could verify a descent; it does not,
  // so the sentence may not claim one. Same defect class the backlog books as
  // gr6-096 (`lab.insufficient` asserts a cause it could not know).
  // "a floor" rather than "a lower bound": the relation is an empirical
  // expectation, not a proven bound.
  'reveal.accounting3Directed':
    'If you followed the p-value, you did not search at random. Directed search reaches significance sooner, so the figure above is a floor.',
  // §3.7's honest form: m peeks make the true number of analyses ≈ (m+1)×
  // larger. Not 5^m, and not a scolding.
  // Plural safety by SINGULAR HEAD NOUN: "data-peeking … makes". The old
  // "Your {peeks} data-peeks make" said "Your 1 data-peeks make" on every
  // single-peek day, which is the commonest day this line renders at all.
  // "({peeks} times)" would only move the defect ("1 times"); the multiplier
  // idiom this sentence already ends on carries the count instead, and sets
  // the two figures side by side: peeked 3×, so 4× the analyses.
  'reveal.peekSurcharge':
    'Your data-peeking ({peeks}×) makes the true number of analyses roughly {mult}× larger than this curve shows.',

  // §7.4 recipe vocabulary — compact by design; see the CopyKey union above.
  'reveal.subgroupAll': 'Everyone',
  'reveal.subgroupAgeLt40': 'Age<40',
  'reveal.subgroupAgeGe40': 'Age≥40',
  'reveal.subgroupExpHigh': 'High experience',
  'reveal.subgroupExpLow': 'Low experience',
  'reveal.subgroupUrban': 'Urban',
  'reveal.subgroupRural': 'Rural',
  'reveal.covNone': 'no covariates',
  'reveal.covIncome': '+Income',
  'reveal.covRisk': '+Risk',
  'reveal.exclusionNone': 'no exclusions',
  'reveal.exclusionZ3': '|z|>3',
  'reveal.exclusionZ25': '|z|>2.5',
  'reveal.exclusionZ2': '|z|>2',
  'reveal.transformRaw': 'raw',
  'reveal.transformLog': 'log',
  'reveal.tailsTwo': 'two-tailed',
  'reveal.tailsOne': 'one-tailed',

  'reveal.retracted': 'RETRACTED',
  'reveal.replicated': 'REPLICATED',
  'reveal.nullReported': 'NULL REPORTED',
  'reveal.callCorrect': 'Your call was correct.',
  'reveal.callIncorrect': 'Your call was wrong.',
  // T18 addition: §2.8's own parenthetical, spelled out — a preregistered
  // analysis, run exactly once, is still expected to land here about one time
  // in twenty. Clinical register (Act II), not an apology.
  'reveal.preregFalsePositive':
    'This is not a mistake: a preregistered analysis, run exactly once, still finds a false positive about 5% of the time. Today was one of those days.',

  // §2.9 share-string human words (the emoji grid, puzzle number and URL stay
  // identical across locales — only these two words are ever localized).
  // T37 fix round 1: LABELS now, not nouns in a counted phrase. Line 3 reads
  // "Forks: 3 · Streak: 7" (see share.ts's §2.9 deviation note for the ruling
  // and why it was necessary). Capitalized for label position, and no longer
  // required to survive being preceded by a bare "1" — which is what
  // "1 forks" was, in a string that gets pasted into other people's feeds.
  'share.forksWord': 'Forks',
  'share.streakWord': 'Streak',

  'summary.score': 'Score: {score}',
  // T37 (audit §5.8): ACTION. 'Share' is a noun/verb homograph in English and
  // 'Close' (stats.close) an adjective/verb one; both locales guessed right,
  // but a future one should not have to guess. Translate both as verbs.
  'summary.share': 'Share',
  'summary.copied': 'Copied to clipboard',
  'summary.nextIn': 'Next puzzle in {hours}h {minutes}m',
  // gr6-066: the last English string still using the counted-noun shape the
  // T37 ruling replaced everywhere else. It rendered "1 day streak" on day
  // one, which is the commonest day it renders at all, and it disagreed with
  // the pasted share string ("Streak: 1") one tap away. Label-colon-count, the
  // form both locales and share.ts already use — and now the Summary, the
  // Stats page and the share string all say one word.
  'summary.streak': 'Streak: {n}',

  // §2.8 scoring-table row labels for the Summary "fee invoice" breakdown —
  // see the CopyKey union above for why these were added under T13.
  'summary.breakdownCallCorrect': 'Correct call',
  'summary.breakdownCallIncorrect': 'Incorrect call',
  'summary.breakdownParsimony': 'Parsimony bonus',
  'summary.breakdownIntegrity': 'Integrity bonus',
  'summary.breakdownMissedDiscovery': 'Missed discovery',
  'summary.breakdownTrueDiscovery': 'True discovery',
  'summary.breakdownConfirmedNull': 'Confirmed null',
  'summary.breakdownUnderpoweredLuck': 'Underpowered luck',
  'summary.breakdownFalsePositive': 'False positive',

  // T17 additions — see the CopyKey union above.
  'summary.invoiceTitle': 'Invoice',
  // GR6 gr6-020, the copy half. The block that announces Prereg Mode used to
  // end in a dead button, and the sentence above it described the mode without
  // ever saying where the door was — so the one screen that explains Prereg
  // Mode offered no route into it. W6 removed the button; this string now
  // carries the destination, because "tomorrow" is a sentence, not a control.
  // "before you see a single number" is prereg.intro's own wording (the same
  // phrase reveal.accounting2Prereg uses), so the mode is described in one
  // vocabulary across all three places that describe it.
  // DEVIATION from gr6-020's suggested sentence ("Tomorrow's briefing will let
  // you choose it…"): the door is named by its MOMENT, not by the screen. Two
  // of the three locales have no non-colliding noun for the Briefing — ES's
  // nearest, "el informe", is already `lab.reportNull`'s noun ("Informar de un
  // resultado nulo") — and inventing one in two languages to carry a
  // signpost is a worse trade than naming the moment, which every locale says
  // identically and which is the thing the player has to act on.
  'summary.preregUpsell': 'Preregistration is unlocked. Tomorrow you can choose it before you see a single number.',
  // gr6-062 — the route to the honours board the day just added to. Mirrors
  // `reveal.toSummary` ("See the invoice") in shape and register: Act II names
  // the destination and makes no comment on the player going there.
  'summary.viewStats': 'See your stats',
  'summary.shareFailed': "Couldn't share this result.",
  // T38 — Act II's one warm beat, and it stays award-ceremony-clinical: it
  // names the day and stops. The citations it introduces are already dry
  // enough to carry the joke without a heading that nudges.
  'summary.unlockedToday': 'Unlocked today',

  'prereg.title': 'Preregistration',
  // §7.3: "the same SpecControls but rendered as a preregistration form" —
  // manuscript register, sincere-bureaucratic, no wink. The player sets every
  // knob below with no data in front of them at all.
  // gr6-028: "There is no reveal to peek at first" named a screen the player
  // has never heard of, in the one mode whose entire lesson is that you commit
  // before you look.
  'prereg.intro':
    'Declare your full analysis before you see a single number. Every choice below is final the moment you submit. There is nothing to look at first, and no second attempt today.',
  // §7.3's own pinned wording ("I solemnly commit") — the checkbox label,
  // played completely straight.
  'prereg.commit': 'I solemnly commit to running and reporting this exact specification, whatever it shows.',
  'prereg.submit': 'Submit preregistration',
  // gr6-028: "until the reveal" → the beat the player was actually promised.
  'prereg.locked': 'Locked in. No more changes before you face the truth.',

  'stats.title': 'Your stats',
  'stats.played': 'Played',
  'stats.currentStreak': 'Current streak',
  'stats.maxStreak': 'Max streak',
  'stats.callAccuracy': 'Call accuracy',
  // gr6-026: `stats.avgScore` ('Average score') is DELETED. The Stats screen
  // has never had an average-score row — `statsAgg.ts` computes no such
  // figure — so the key was a label for a statistic that does not exist.
  // ACTION, not a state adjective -- see summary.share's note (audit §5.8).
  'stats.close': 'Close',
  // gr6-035 — the day-one empty state. Act II register: it says what the
  // screen is and what fills it, and does not congratulate, encourage or
  // apologize. Rendered under the title only when `played === 0`.
  'stats.emptyState': 'Nothing here yet. Every figure on this page starts filling in after your first day.',

  // T17 additions — see the CopyKey union above.
  'stats.callAccuracyLast20': 'Last 20 calls',
  'stats.successRateTitle': 'Success rate: hacking vs. preregistration',
  'stats.hackModeLabel': 'Hacking Mode',
  'stats.preregModeLabel': 'Prereg Mode',
  'stats.noData': '—',
  'stats.forkHistogramTitle': 'Forks per day',
  // T37 (audit §5.3): ARIA. The histogram is indexed from zero, so the old
  // '{forks} forks: {count}' had a screen reader announcing "1 forks" on the
  // second bar of every chart. Label-colon-count agrees at every value.
  'stats.forkHistogramBar': 'Forks: {forks}. Played: {count}',
  'stats.achievementsTitle': 'Achievements',
  'stats.locked': 'Locked achievement',

  'about.title': 'About P-hackle',
  // gr6-036 — the four section headings. Short, plain, and honest about what
  // each section is; "None of this is real" is the page's own best sentence
  // promoted to a signpost. Sentence case, like every other heading in the
  // catalog.
  //
  // HAND-OFF, BOOKED FOR W7 (About.tsx is that wave's file this round): render
  // these as four <h2>s in the order above the CopyKey union documents, move
  // `about.decimalNote` under `about.sectionNotReal`, and put `nav.tagline`
  // between the <h1> and `about.intro` as the standfirst. Until that lands the
  // four keys and the tagline are rostered PENDING in
  // tests/content/copyFreeze.test.ts.
  'about.sectionHowItWorks': 'How it works',
  'about.sectionNotReal': 'None of this is real',
  'about.sectionYourData': 'Your data',
  'about.sectionPriorArt': 'Where this comes from',
  'about.intro':
    'Every day, P-hackle deals you a synthetic dataset and a ridiculous hypothesis. The toolbox is real: outcome switching, subgroup shopping, optional stopping. These are the same researcher degrees of freedom used, accidentally or otherwise, in real published research.',
  // ------------------------------------------------------------------
  // GR6 gr6-004 (blocker, `scientific`) — THE REJECTION SAMPLER IS NOW
  // DISCLOSED, BECAUSE THIS PARAGRAPH OPENS BY CLAIMING COMPLETENESS.
  //
  // "Everything under the hood is real" is true of the machinery and was
  // silent on the one mechanism that most changes how the numbers should be
  // read: days are REJECTION SAMPLED. `acceptNullDay` (engine/day.ts) redraws
  // until sigCount(enumerateCurve(data, 200)) lands in NULL_SIG_BAND;
  // `acceptEffectDay` redraws until the canonical spec clears p < 0.15 at
  // N=200 and p < 0.05 at N=400. Measured over 300 unconditioned raw draws of
  // each type, 42% of null draws and 26% of effect draws are discarded
  // (gr1a-004) — and the discarded tails are precisely the ones that would
  // make the reveal's headline count look unusual, or make the day's true
  // effect undetectable.
  //
  // WRITTEN TO AGREE WITH reveal.accounting1, per the W1 review's controller
  // note. That line says "a 0.05 threshold lets about one in twenty through on
  // its own"; one in twenty of 1,792 is ~89.6, and the band [30, 180] is drawn
  // around it. So the two screens now tell one story: the count you see is
  // what the threshold produces, and the band is what keeps the day from being
  // an outlier in either direction. Nothing here contradicts accounting1 and
  // nothing here softens it.
  //
  // TWO NUMBERS ARE QUOTED AND BOTH ARE PINNED. "between 30 and 180" is
  // NULL_SIG_BAND (src/game/tuning.ts) and "1792" is allSpecs().length; the
  // English value is asserted against both in tests/content/shape.test.ts, so
  // a tuning change that leaves this sentence behind is a red test rather than
  // a quiet lie. The DISCARD RATES (42%/26%) are deliberately NOT in the
  // string: they are a consequence of the band rather than a declared
  // constant, and W11's §1(d) predicate will move them. "1792" carries no
  // thousands separator, in any locale, because that is exactly how the reveal
  // prints the same figure one screen earlier (`formatCount` is
  // `String(Math.round(v))`), and the two must be recognisable as one number.
  //
  // w2-r-002 — THE BAND HAS AN n, AND THE SENTENCE NOW SAYS IT. The first
  // draft closed on "the count you are shown at the end of the day is never
  // wildly small", which is an absolute the engine does not honour: the band
  // is enforced against `sigCount(enumerateCurve(data, 200))` and the REVEAL
  // enumerates at `state.n`, which a peeking player has moved. Measured over
  // 21 consecutive accepted null days, 21/21 sit in the band at n=200 and
  // 8/21 (38%) sit OUTSIDE it at n=400 — including a day that goes 37 → 5,
  // which is 0.3% of the grid, and one that goes 83 → 384. The claim is
  // therefore scoped to the opening sample, where it is exactly true, and the
  // drift gets its own clause. This wave also ships `lab.collectMoreHint`
  // specifically to make collecting more data attractive (gr6-025), so the
  // player this sentence would have misled is the one the Lab now recruits.
  //
  // w2-r-008 — THE EFFECT-DAY GATE HAS TWO HALVES and the string named one.
  // `acceptEffectDay` requires p < 0.15 at N=200 AND p < 0.05 at N=400 on the
  // canonical spec (behind a p < 0.3 precheck at 200). "both in that opening
  // sample and in the full sample of 400" discloses the shape of the gate
  // without printing three thresholds nobody can act on.
  // ------------------------------------------------------------------
  'about.mechanism':
    "Everything under the hood is real. Each day's dataset is simulated from a declared data-generating process (eight correlated latent variables, a treatment confounded with age and income, four outcome families) and seeded from the date, so every player in the world analyzes the same numbers. The regressions are ordinary least squares. The specification curve is computed by actually running every combination of outcome, subgroup, covariate set, exclusion rule, transform and tail choice. It is enumerated, not sampled, and not faked. On most days the true effect is exactly zero. On the rest it is small and real, which is the whole difficulty. The days themselves are filtered before you play them: a null day is redrawn until between 30 and 180 of the 1792 possible analyses reach p < 0.05 in the opening sample of 200, and an effect day is redrawn until the real effect is detectable both in that opening sample and in the full sample of 400. That filter is a thumb on the scale, and it is disclosed for the same reason as everything else here: what a 0.05 threshold turns up on its own sits inside that band, so the sample you start with always has something in it to find. The band is checked at 200 and nowhere else, so once you collect more data the count moves, sometimes a long way.",
  'about.frozenFork':
    'One analytical choice is frozen rather than offered: outlier z-scores are computed on the transformed outcome, within the filtered subsample. That is itself a fork, and freezing it is itself a decision. It is disclosed here because the forks you cannot see are the ones that do the damage.',
  'about.syntheticDisclaimer':
    'Nothing in this game is a finding. The participants do not exist, the data is generated in your browser, and the journals, DOIs, press outlets, headlines and quotes are all invented. That is why the press cards carry a SIMULATED PRESS watermark. The scenarios are deliberately absurd and deliberately harmless: no medical, nutritional or public-health claim appears anywhere in them, because a screenshot travels further than its caption.',
  // GR6 gr6-027 + gr6-036: this key had two problems at once. It was a
  // one-line typesetting note wedged between "a screenshot travels further
  // than its caption" and the analytics paragraph, stopping the essay dead;
  // and in ENGLISH it was very nearly vacuous, because an English reader was
  // never going to expect a comma. It now (a) belongs under a heading (§
  // about.sectionNotReal, where the other "what you are looking at is a
  // construction" facts live) and (b) earns its place by stating the SECOND
  // convention as well — the leading zero, which is the rule gr6-027 makes
  // true across the whole catalog and which this sentence is the only place
  // that says out loud.
  'about.decimalNote':
    'Statistics here are set the way journals set them, in every language: a decimal point, never a comma (p = 0.049), and a leading zero on every one.',
  'about.dataDisclosure':
    "Analytics are anonymous, cookieless page counts (Vercel Web Analytics). No cookies, no accounts, no personal data, no cross-site tracking, no banner to dismiss. Your scores, streaks, history and language choice live in your browser's local storage and are never sent anywhere. Clearing your browser data deletes them permanently, including from us, who never had them.",
  'about.priorArt':
    'P-hackle is a small game standing on a large literature. It borrows its central demonstration, and most of its methods, from work worth reading directly:',
  'about.priorArtFiveThirtyEight':
    'Aschwanden & King (2015), "Hack Your Way to Scientific Glory," FiveThirtyEight. The interactive that owns this idea. It uses real data and offers no ground truth; P-hackle adds a known data-generating process, a daily seed, and the real-or-noise call.',
  // gr6-028: "the chart in the reveal" → the chart the day ends on.
  'about.priorArtSpecCurve':
    'Simonsohn, Simmons & Nelson. Specification curve analysis: the chart the day ends on is, essentially, their figure.',
  'about.priorArtForkingPaths':
    'Gelman & Loken. The garden of forking paths: no fishing expedition is required for this to happen, only an analysis that adapts to the data you happened to see.',
  'about.priorArtFalsePositive':
    'Simmons, Nelson & Simonsohn (2011), "False-Positive Psychology." The inventory of researcher degrees of freedom that this toolbox implements, one button at a time.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson & Rowe (1969). Testing repeatedly as data accumulates inflates the false-positive rate on its own, which is why every extra batch you collect is counted against you when you face the truth.',
  'about.glossaryTitle': 'Glossary',
  'about.contact': 'Questions or bug reports welcome.',

  // T17 additions — see the CopyKey union above.
  'about.version': 'Version {version}',
  'about.sourceLink': 'Source on GitHub',

  'legend.title': 'Legend',
  'legend.explored': 'Specification you viewed',
  'legend.unexplored': "Specification you didn't view",
  // w1-r-008: the leading-zero form, and it had to land here in the same wave
  // as reveal.accounting1's. SpecCurve renders this string as Fig. 1's
  // threshold label, i.e. inside the reveal's SECOND block, one block above the
  // accounting — so `p < .05` here against `p < 0.05` there is gr3-015's
  // "present in five strings and absent in three, on the same screens" in its
  // sharpest possible form. gr6-027 (W2) names both keys; W1 owns both files
  // this round, so both move together. Notation, so it is identical in all
  // three locales (the shape suites' SHARED_WITH_EN roster).
  'legend.significant': 'p < 0.05',
  'legend.published': 'The one you published',
  // gr6-026: `legend.trueEffect` ('True effect') is DELETED. SpecCurve builds
  // its chart legend from four rows and has no true-effect mark to label; the
  // key had no call site, literal or dynamic.

  // T17 additions — the §2.9 share-grid emoji table; see the CopyKey union
  // above for why these are 'emoji'-infixed and distinct from the 5 keys
  // just above (T16's SpecCurve chart legend).
  // GR6 gr6-030: the Legend explained every glyph and not the WORD. "Forks" is
  // the one content word the share string prints (share.forksWord), and the
  // concept carried four names across the product — Forks (Lab trail, Stats,
  // share), "specification change" (here), "possible analyses" / "explored {k}
  // of them" (reveal), "paths" (nav.tagline, glossary). The 🍴 row now DEFINES
  // the term it is the picture of, and this intro says how the trail and the
  // counts relate, which is the other half a stranger holding a share string
  // has to work out.
  'legend.intro':
    'How to read a shared result. The trail is one symbol per move; the counts under it are the same moves, added up.',
  // T29 fix round: 🍴 is now the ONLY in-trail glyph for a spec change —
  // share.ts's FORK_EMOJI collapsed subgroup/exclusion/tails onto it, and the
  // Legend deduplicates by glyph, so this one row is the only place the key
  // explains any of them. Its parenthetical therefore names all six knobs, in
  // the order Spec declares them (src/engine/types.ts). The three keys below
  // it are no longer rendered anywhere; they stay in the union because every
  // locale's Record<CopyKey, string> must still be total.
  // The parenthetical is COMPILED, not decorative: findMissingSpecKnobs
  // (tests/content/validators.ts) requires every locale's enumeration to
  // contain that locale's own lab.outcome / lab.subgroup / lab.covariates /
  // lab.exclusion / lab.transform / reveal.tailsOne verbatim. Reword the
  // sentence around it freely; do not drop a knob out of it.
  'legend.emojiSpec':
    'A fork: any change to the specification (outcome, subgroup, covariates, outlier exclusion, transform or one-tailed switch)',
  'legend.emojiSubgroup': 'Subgroup filter change',
  'legend.emojiExclusion': 'Outlier exclusion change',
  'legend.emojiTails': 'Switched to one-tailed',
  // T37 (audit §5.2) — LEGEND GLOSSES. These four are bare English past
  // participles with no subject. They are IMPERSONAL: they describe what a
  // glyph MEANS, in a share string that may well be someone else's. Spanish
  // read two of them as third-person preterite and shipped "he/she collected".
  // Translate them NOMINALLY; never with a finite verb, and never in the
  // second person.
  'legend.emojiPeek': 'Collected more data ("just one more batch")',
  'legend.emojiSubmit': 'Submitted for publication',
  'legend.emojiAbandon': 'Reported a null result',
  'legend.emojiPrereg': 'Preregistered (prefix)',
  'legend.emojiCallCorrect': 'Call was correct',
  'legend.emojiCallIncorrect': 'Call was incorrect',

  'errors.workerCrash': "Something went wrong generating today's puzzle. Reloading usually fixes it.",
  'errors.storageOff': "Your browser is blocking local storage, so progress won't be saved between visits.",
  // gr6-007 — the control `errors.workerCrash` has always promised. One word,
  // because the sentence above it already said what pressing it does.
  'errors.reload': 'Reload',
  // THE MID-PLAY MIDNIGHT NOTICE (w6-r-006, w7-r-003 — booked to two waves,
  // authored by neither, landed by W8).
  //
  // WHAT IT IS FOR. `App.tsx` reads the date once, at boot, and honours a
  // rollover only on the briefing with nothing done, because a re-boot is a
  // `set({ ...initialState() })` and would take a half-hacked spec away from
  // the player at the exact moment they came back to it. That ruling is
  // right and stands. What it left behind is a player who crosses midnight
  // mid-hack and is told nothing at all, while the masthead, the study, the
  // Grantwell email and the countdown all quietly go on describing
  // yesterday.
  //
  // WHAT IT DELIBERATELY DOES NOT SAY: "reload". Both bookings sketched the
  // affordance as "a new puzzle is ready — reload", and that instruction is
  // WRONG HERE, which is the one thing this key had to get right. Nothing
  // about a day in progress is persisted until the Summary, so mid-play a
  // reload is the DESTRUCTIVE action: it is the very thing the rollover
  // ruling refuses to do to the player, offered to them as a button with no
  // warning on it. `errors.reload` therefore stays where gr6-007 put it — on
  // the boot-failure screen, where there is no day to lose — and this is a
  // notice, not a control.
  //
  // So the sentence answers the two questions a player actually has, in
  // order: does the day I am in the middle of still count (yes, as the day it
  // started — that is exactly what `puzzleIso` guarantees in
  // dayComplete.ts), and where did today's puzzle go (nowhere; it is waiting).
  // Second person, plain and precise per the register rule for `errors.`;
  // no token, so there is nothing for a call site to fail to supply; no em
  // dash, in a string that would otherwise be the natural place to reach for
  // one.
  'errors.newDay':
    "It is a new day. The one you are playing still counts as the day it started; today's puzzle is waiting when you finish.",
  // w8-r-001 — THE SAME MIDNIGHT, TOLD TO A PLAYER WHO HAS FINISHED.
  //
  // `errors.newDay` above ends "waiting when you finish", which is addressed
  // to somebody mid-play and is FALSE on the Summary — where the player has
  // finished, and where W8's own countdown suppression had just removed the
  // last line on that screen pointing at tomorrow. So the finished-day screen
  // was left saying nothing true and offering no route at all.
  //
  // AND THE ARGUMENT FOR WITHHOLDING "RELOAD" DOES NOT REACH HERE. That
  // argument is that mid-play nothing is persisted, so a reload throws the
  // day away. By the time this screen renders, `SummaryScreen`'s first-mount
  // effect has ALREADY run `persistAndComputeSummary` — the day is written,
  // the achievements are written, the streak is written. A reload here costs
  // nothing, and it is the only way to reach the new day (nothing navigates
  // back to the briefing). So this line carries the control, and says why it
  // is safe before it asks for the press: "This one is saved" is the sentence
  // that earns the button, exactly as `errors.workerCrash` earns the other
  // one.
  'errors.newDayReady': "A new day started while you were playing. This one is saved; reload for today's puzzle.",

  // T37 (audit §5.4, adopted as a value change): this labels a role="group"
  // (App.tsx's LocaleToggle), not a button. A group label NAMES the group; it
  // is not an action. 'Change language' had a screen reader announcing
  // "Change language, group".
  // gr6-026: this used to point at nav.localeToggle for the same word. That
  // key is gone (dead: the visible control is a pair of endonym buttons, and
  // nothing ever rendered it), so this key now owns the word outright.
  'a11y.localeToggle': 'Language',
  // GR6 gr6-067 / final-004: this labels a role="group" too (App.tsx's
  // ThemeToggle), and it was an action phrase — a screen reader announced
  // "Change theme, group". Exactly the WRONG-FUNCTION class T36/T37 fixed for
  // the locale group one control to its right, missed because only one of the
  // two was in that audit's scope. A group label NAMES its group.
  'a11y.themeToggle': 'Theme',
  'a11y.backToGame': "P-hackle: back to today's puzzle",
  // T22 (value change): dropped "with your published specification
  // highlighted". It was false on the abandon path — nothing is published
  // there, and the chart's own legend already omits its published row to say
  // so — and it duplicated reveal.publishedRecipe, which states the recipe as
  // real text. The label now describes the plate and stops.
  'a11y.specCurveChart': "Chart of every possible specification's p-value, sorted from smallest to largest.",
  'a11y.specCurveGrouped': "Chart of every possible specification's p-value, in one column per outcome measured.",
  'a11y.dataCut':
    'Strip plot of the current sample: the comparison group and the treated group, with each excluded point drawn as a crossed mark.',
  'a11y.shareButton': 'Copy share result to clipboard',
  'a11y.closeDialog': 'Close dialog',
  'a11y.loading': "Loading today's puzzle",
};
