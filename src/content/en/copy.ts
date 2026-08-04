// The flat UI copy catalog (delta spec i18n §3; master spec §4 register rules).
// CopyKey is the completeness contract: every locale's `copy` field is typed
// `Record<CopyKey, string>`, so an untranslated key fails `tsc` rather than
// silently falling back at runtime. This file is the source of truth for the
// *set* of keys — UI tasks (T14-T18) may add keys here as screens are built;
// IT/ES fill in their own translations of the full set in T19/T20.
//
// Register: Act I (briefing/lab/published/call) is enthusiast-sincere — the
// game is never in on the joke until the reveal. Act II (reveal/summary/stats)
// is clinical, deadpan. about/legend/errors/a11y are plain and precise. Never
// smug anywhere.
//
// {param} tokens are interpolated by t() (src/i18n/t.ts). Journal names, press
// outlet-independent DOIs, and statistical decimals are handled by content
// modules, not by this catalog.
export type CopyKey =
  | 'nav.title'
  | 'nav.tagline'
  | 'nav.puzzleNumber'
  | 'nav.about'
  | 'nav.stats'
  | 'nav.legend'
  | 'nav.play'
  | 'nav.localeToggle'
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
  // T15 additions: the Grantwell EmailCard's `from`/`subject` prop VALUES
  // (email.from/email.subject, just above and below, are the generic
  // "From:"/"Subject:" LABELS EmailCard renders itself — see EmailCard.tsx).
  | 'briefing.emailFrom'
  | 'briefing.emailSubject'
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
  | 'lab.peekFootnote'
  | 'lab.peekFootnoteArmitage'
  | 'lab.insufficient'
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
  | 'reveal.accounting1'
  | 'reveal.accounting2'
  // T16 addition: §2.7.3's accounting2 assumes a publication. A player who
  // reported a null result explored their paths before doing something else,
  // and the sentence has to say so rather than lie by a verb.
  | 'reveal.accounting2Abandoned'
  | 'reveal.accounting3'
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
  // reads "Y₂ · Age<40 · +Income · |z|>2.5 · log · one-tailed"). These are
  // the COMPACT figure forms, deliberately terser than the Lab's segmented
  // control labels: a callout has one line, a button has a whole row.
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
  | 'summary.playPrereg'
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
  | 'stats.avgScore'
  | 'stats.close'
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
  | 'legend.trueEffect'
  // T17 additions: the §2.9 share-grid emoji table (Legend screen). Distinct
  // from the 5 SpecCurve chart-legend keys just above (explored/unexplored/
  // significant/published/trueEffect, T16's figure legend) — this is the
  // OTHER legend, for the emoji share string (share.ts's FORK_EMOJI + the 5
  // terminal/prefix glyphs), hence the 'emoji' infix to keep the two apart.
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
  'nav.title': 'P-hackle',
  'nav.tagline': 'A daily game about the garden of forking paths.',
  'nav.puzzleNumber': 'Puzzle #{n}',
  'nav.about': 'About',
  'nav.stats': 'Stats',
  // T37 (audit §5.11): renders BOTH as a header nav page name and as the
  // ForkTrail popover's trigger button (ForkTrail.tsx). It must read as a page
  // NAME in both places, so do not translate it as a verb in either.
  'nav.legend': 'Legend',
  'nav.play': 'Play',
  'nav.localeToggle': 'Language',
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
  'briefing.emailSubject': 'Re: the deadline',
  // T31: the goal strip, directly under the title card. Sincere and literal —
  // this is genuinely the task Act I is setting.
  'briefing.goal': 'Your task: find a statistically significant effect (p < 0.05) and publish it.',

  // T18 additions — the mode chooser (§2.2), shown only once Prereg Mode is
  // unlocked and today's preregistration has not been filed yet.
  'briefing.modeChooserIntro': 'Preregistration is unlocked. Choose how you play today. One attempt per mode.',
  'briefing.playHacking': 'Play Hacking Mode',
  'briefing.playPrereg': 'Play Prereg Mode',
  'briefing.alreadyPlayedToday': 'Already played today',

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
  // Two footnotes, in order. The first press gets the sincere one: collecting
  // more data is what a diligent lab does, and the logging detail is planted
  // here to be collected at the reveal. From the 2nd press (§2.4; the UI task
  // owns the gating) the Armitage line fades in — the master spec's verbatim
  // text, its §1.4 citation obligation, and the ONLY Act-I moment allowed to
  // wink. It is meant to be easy to miss. Do not make it louder, and do not
  // add a second wink anywhere else in Act I.
  'lab.peekFootnote': 'Collecting more data is what a careful lab does. Every batch is logged for the methods section.',
  'lab.peekFootnoteArmitage':
    'Fun fact: peeking five times at α = .05 inflates your false-positive rate to ~14% (Armitage, 1969).',
  'lab.insufficient': 'n < 30. Not enough data to analyze.',

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
  'lab.explain.outcome': 'Which of the four things you measured this analysis tries to explain.',
  'lab.explain.subgroup': 'Restrict the sample to one group of participants before fitting.',
  'lab.explain.covariates': 'Also account for background differences between people when comparing the two groups.',
  'lab.explain.exclusion': 'Remove statistical outliers from the current sample before fitting.',
  'lab.explain.transform': 'Fit the outcome on its own scale, or on a log scale.',
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
  'lab.howThisWorks.title': 'How to play',
  'lab.howThisWorks.step1': "Read the brief: today's question, and the data you have been given.",
  'lab.howThisWorks.step2': 'Adjust the analysis until the big number drops below 0.05.',
  'lab.howThisWorks.step3': 'Submit your finding for publication.',
  'lab.howThisWorks.step4': 'Face the truth about what you found.',
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
  'lab.cutLegendIncluded': 'Analysed: {n}',
  'lab.cutLegendExcluded': 'Excluded: {n}',
  'lab.cutLegendMean': 'Group mean',

  // T31 FIX ROUND — finding 4, "RESTORED REQUIREMENT — Legend pointer".
  // One quiet line next to the live ForkTrail: the trail's own emoji are
  // otherwise unexplained anywhere in the Lab.
  // T37 (audit §5.6): "has the key" is an English idiom, and "key" for a chart
  // legend has no cognate in either target language. It means "the explanation
  // of the symbols" -- do not translate the noun literally.
  'lab.forkTrailHint': 'Each symbol is a move you made. The Legend page has the key.',

  'published.faceTruth': 'Face the truth',
  'published.simulatedPress': 'SIMULATED PRESS',
  'published.editorsPick': "Editor's Pick",
  'published.doiPrefix': 'DOI:',
  'published.authors': 'You, et al.',
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
  // substitute {n} with String.replace, which rewrites the FIRST occurrence
  // only — a translation that repeats {n} would render the second one raw.
  'published.altmetricScore': 'Mentioned {n} times online already',
  'published.altmetricPercentile': 'Top {n}% of all research outputs, all time',

  // §2.6 verbatim: the call is conspiratorial, not accusatory — Act I's last
  // beat, and the hinge into Act II. "Noise I dressed up" is the player's own
  // admission to make; the game does not make it for them.
  'call.title': 'Before you see the reveal…',
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
  //      colon at all. Used by stats.forkHistogramBar and, in the locales,
  //      summary.streak and the accounting lines.
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
  //   {total}/{sig} (accounting1)          {sig} may legitimately be 0.
  //   share.forksWord/share.streakWord: the share grid used to read
  //   "{n} forks", with n as low as 0 or 1 and no way to inflect the noun.
  //   Fixed at the SITE (share.ts's line 3, form c) rather than in the word,
  //   because the string leaves the app; see share.ts's §2.9 deviation note.
  //
  // A locale whose agreement rules differ from English must check the floor
  // above rather than assume the English form is safe.
  // ------------------------------------------------------------------
  'reveal.accounting1': 'Of {total} possible analyses, {sig} ({sigPct}%) reach p < .05 by chance alone.',
  // ANAPHORA, load-bearing: "them" refers back to accounting1's "{total}
  // possible analyses", which Reveal.tsx always renders immediately above
  // (block "accounting", first <p>). That is what makes "{k} of them"
  // grammatical at 1 AND at 14 -- a partitive takes no agreement with the
  // count. Do not reorder these three statements, and do not translate this
  // pronoun into a locale where it would have no antecedent: IT/ES restate
  // the noun instead, which is equally correct and their own idiom.
  'reveal.accounting2': 'You explored {k} of them before publishing.',
  'reveal.accounting2Abandoned': 'You explored {k} of them before reporting a null result.',
  'reveal.accounting3':
    'A researcher randomly exploring {k} of them finds at least one "significant" result about {pHitPct}% of the time.',
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
  'summary.streak': '{n} day streak',
  'summary.playPrereg': 'Try Prereg Mode',

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
  'summary.preregUpsell': 'Preregistration is unlocked: commit to one analysis before you see the data.',
  'summary.shareFailed': "Couldn't share this result.",
  // T38 — Act II's one warm beat, and it stays award-ceremony-clinical: it
  // names the day and stops. The citations it introduces are already dry
  // enough to carry the joke without a heading that nudges.
  'summary.unlockedToday': 'Unlocked today',

  'prereg.title': 'Preregistration',
  // §7.3: "the same SpecControls but rendered as a preregistration form" —
  // manuscript register, sincere-bureaucratic, no wink. The player sets every
  // knob below with no data in front of them at all.
  'prereg.intro':
    'Declare your full analysis before you see a single number. Every choice below is final the moment you submit. There is no reveal to peek at first, and no second attempt today.',
  // §7.3's own pinned wording ("I solemnly commit") — the checkbox label,
  // played completely straight.
  'prereg.commit': 'I solemnly commit to running and reporting this exact specification, whatever it shows.',
  'prereg.submit': 'Submit preregistration',
  'prereg.locked': 'Locked in. No more changes until the reveal.',

  'stats.title': 'Your stats',
  'stats.played': 'Played',
  'stats.currentStreak': 'Current streak',
  'stats.maxStreak': 'Max streak',
  'stats.callAccuracy': 'Call accuracy',
  'stats.avgScore': 'Average score',
  // ACTION, not a state adjective -- see summary.share's note (audit §5.8).
  'stats.close': 'Close',

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
  'about.intro':
    'Every day, P-hackle deals you a synthetic dataset and a ridiculous hypothesis. The toolbox is real: outcome switching, subgroup shopping, optional stopping. These are the same researcher degrees of freedom used, accidentally or otherwise, in real published research.',
  'about.mechanism':
    "Everything under the hood is real. Each day's dataset is simulated from a declared data-generating process (eight correlated latent variables, a treatment confounded with age and income, four outcome families) and seeded from the date, so every player in the world analyzes the same numbers. The regressions are ordinary least squares. The specification curve is computed by actually running every combination of outcome, subgroup, covariate set, exclusion rule, transform and tail choice. It is enumerated, not sampled, and not faked. On most days the true effect is exactly zero. On the rest it is small and real, which is the whole difficulty.",
  'about.frozenFork':
    'One analytical choice is frozen rather than offered: outlier z-scores are computed on the transformed outcome, within the filtered subsample. That is itself a fork, and freezing it is itself a decision. It is disclosed here because the forks you cannot see are the ones that do the damage.',
  'about.syntheticDisclaimer':
    'Nothing in this game is a finding. The participants do not exist, the data is generated in your browser, and the journals, DOIs, press outlets, headlines and quotes are all invented. That is why the press cards carry a SIMULATED PRESS watermark. The scenarios are deliberately absurd and deliberately harmless: no medical, nutritional or public-health claim appears anywhere in them, because a screenshot travels further than its caption.',
  'about.decimalNote': 'Statistical notation always uses a decimal point (p = 0.049), in every language.',
  'about.dataDisclosure':
    "Analytics are anonymous, cookieless page counts (Vercel Web Analytics). No cookies, no accounts, no personal data, no cross-site tracking, no banner to dismiss. Your scores, streaks, history and language choice live in your browser's local storage and are never sent anywhere. Clearing your browser data deletes them permanently, including from us, who never had them.",
  'about.priorArt':
    'P-hackle is a small game standing on a large literature. It borrows its central demonstration, and most of its methods, from work worth reading directly:',
  'about.priorArtFiveThirtyEight':
    'Aschwanden & King (2015), "Hack Your Way to Scientific Glory," FiveThirtyEight. The interactive that owns this idea. It uses real data and offers no ground truth; P-hackle adds a known data-generating process, a daily seed, and the real-or-noise call.',
  'about.priorArtSpecCurve':
    'Simonsohn, Simmons & Nelson. Specification curve analysis: the chart in the reveal is, essentially, their figure.',
  'about.priorArtForkingPaths':
    'Gelman & Loken. The garden of forking paths: no fishing expedition is required for this to happen, only an analysis that adapts to the data you happened to see.',
  'about.priorArtFalsePositive':
    'Simmons, Nelson & Simonsohn (2011), "False-Positive Psychology." The inventory of researcher degrees of freedom that this toolbox implements, one button at a time.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson & Rowe (1969). Testing repeatedly as data accumulates inflates the false-positive rate on its own, which is why every extra batch you collect is counted against you at the reveal.',
  'about.glossaryTitle': 'Glossary',
  'about.contact': 'Questions or bug reports welcome.',

  // T17 additions — see the CopyKey union above.
  'about.version': 'Version {version}',
  'about.sourceLink': 'Source on GitHub',

  'legend.title': 'Legend',
  'legend.explored': 'Specification you viewed',
  'legend.unexplored': "Specification you didn't view",
  'legend.significant': 'p < .05',
  'legend.published': 'The one you published',
  'legend.trueEffect': 'True effect',

  // T17 additions — the §2.9 share-grid emoji table; see the CopyKey union
  // above for why these are 'emoji'-infixed and distinct from the 5 keys
  // just above (T16's SpecCurve chart legend).
  'legend.intro': 'How to read a shared result.',
  // T29 fix round: 🍴 is now the ONLY in-trail glyph for a spec change —
  // share.ts's FORK_EMOJI collapsed subgroup/exclusion/tails onto it, and the
  // Legend deduplicates by glyph, so this one row is the only place the key
  // explains any of them. Its parenthetical therefore names all six knobs, in
  // the order Spec declares them (src/engine/types.ts). The three keys below
  // it are no longer rendered anywhere; they stay in the union because every
  // locale's Record<CopyKey, string> must still be total.
  'legend.emojiSpec':
    'Any specification change (outcome, subgroup, covariates, outlier exclusion, transform or one-tailed switch)',
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

  // T37 (audit §5.4, adopted as a value change): this labels a role="group"
  // (App.tsx's LocaleToggle), not a button. A group label NAMES the group; it
  // is not an action. 'Change language' had a screen reader announcing
  // "Change language, group". nav.localeToggle already holds exactly this
  // word, in every locale.
  'a11y.localeToggle': 'Language',
  'a11y.themeToggle': 'Change theme',
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
