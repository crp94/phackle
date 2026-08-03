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
  | 'nav.localeToggle'
  | 'nav.themePaper'
  | 'nav.themeDark'
  | 'briefing.openData'
  | 'briefing.correspondingAuthor'
  | 'briefing.vol'
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
  | 'published.faceTruth'
  | 'published.simulatedPress'
  | 'published.editorsPick'
  | 'published.doiPrefix'
  | 'call.title'
  | 'call.real'
  | 'call.noise'
  | 'call.prompt'
  | 'reveal.truthNull'
  | 'reveal.truthEffect'
  | 'reveal.curveCaption'
  | 'reveal.groupedCaption'
  | 'reveal.accounting1'
  | 'reveal.accounting2'
  | 'reveal.accounting3'
  | 'reveal.peekSurcharge'
  | 'reveal.retracted'
  | 'reveal.replicated'
  | 'reveal.nullReported'
  | 'reveal.callCorrect'
  | 'reveal.callIncorrect'
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
  | 'prereg.title'
  | 'prereg.commit'
  | 'prereg.locked'
  | 'stats.title'
  | 'stats.played'
  | 'stats.currentStreak'
  | 'stats.maxStreak'
  | 'stats.callAccuracy'
  | 'stats.avgScore'
  | 'stats.close'
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
  | 'legend.title'
  | 'legend.explored'
  | 'legend.unexplored'
  | 'legend.significant'
  | 'legend.published'
  | 'legend.trueEffect'
  | 'errors.workerCrash'
  | 'errors.storageOff'
  | 'a11y.localeToggle'
  | 'a11y.specCurveChart'
  | 'a11y.shareButton'
  | 'a11y.closeDialog'
  | 'a11y.loading';

export const copy: Record<CopyKey, string> = {
  'nav.title': 'P-hackle',
  'nav.tagline': 'A daily game about the garden of forking paths.',
  'nav.puzzleNumber': 'Puzzle #{n}',
  'nav.about': 'About',
  'nav.stats': 'Stats',
  'nav.localeToggle': 'Language',
  'nav.themePaper': 'Paper',
  'nav.themeDark': 'Dark',

  'briefing.openData': 'Open Data',
  'briefing.correspondingAuthor': 'Corresponding author: Prof. R. Grantwell',
  'briefing.vol': 'Vol. {volume}, No. {issue}',

  'email.from': 'From:',
  'email.subject': 'Subject:',

  'lab.outcome': 'Outcome',
  'lab.subgroup': 'Subgroup',
  'lab.covariates': 'Covariates',
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
  'lab.insufficient': 'n < 30 — not enough data to analyze.',

  'published.faceTruth': 'Face the truth',
  'published.simulatedPress': 'SIMULATED PRESS',
  'published.editorsPick': "Editor's Pick",
  'published.doiPrefix': 'DOI:',

  'call.title': 'Before you see the reveal…',
  'call.real': 'Real',
  'call.noise': 'Noise',
  'call.prompt': 'Is this a genuine effect, or did you just find noise?',

  'reveal.truthNull': 'The true effect was zero.',
  'reveal.truthEffect': 'The true effect was real.',
  'reveal.curveCaption': 'Every specification you could have run, sorted by p-value. Yours is highlighted.',
  'reveal.groupedCaption': 'Paths grouped by analytical choice.',
  'reveal.accounting1': 'You viewed {viewed} of {total} possible specifications.',
  'reveal.accounting2': '{sigFraction}% of all specifications would have reached significance.',
  'reveal.accounting3': 'Your published result ranked #{rank} by significance.',
  'reveal.peekSurcharge': '{peeks} extra batches collected along the way.',
  'reveal.retracted': 'RETRACTED',
  'reveal.replicated': 'REPLICATED',
  'reveal.nullReported': 'NULL REPORTED',
  'reveal.callCorrect': 'Your call was correct.',
  'reveal.callIncorrect': 'Your call was wrong.',

  // §2.9 share-string human words (the emoji grid, puzzle number and URL stay
  // identical across locales — only these two words are ever localized).
  'share.forksWord': 'forks',
  'share.streakWord': 'streak',

  'summary.score': 'Score: {score}',
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

  'prereg.title': 'Preregistration',
  'prereg.commit': 'Commit to this spec',
  'prereg.locked': 'Locked in — no more changes until the reveal.',

  'stats.title': 'Your stats',
  'stats.played': 'Played',
  'stats.currentStreak': 'Current streak',
  'stats.maxStreak': 'Max streak',
  'stats.callAccuracy': 'Call accuracy',
  'stats.avgScore': 'Average score',
  'stats.close': 'Close',

  'about.title': 'About P-hackle',
  'about.intro':
    'Every day, P-hackle deals you a synthetic dataset and a ridiculous hypothesis. The toolbox is the real one — outcome switching, subgroup shopping, optional stopping — the same researcher degrees of freedom used, accidentally or otherwise, in real published research.',
  'about.mechanism':
    "Everything under the hood is real. Each day's dataset is simulated from a declared data-generating process — eight correlated latent variables, a treatment confounded with age and income, four outcome families — seeded from the date, so every player in the world analyzes the same numbers. The regressions are ordinary least squares. The specification curve is computed by actually running every combination of outcome, subgroup, covariate set, exclusion rule, transform and tail choice; it is enumerated, not sampled and not faked. On most days the true effect is exactly zero. On the rest it is small and real, which is the whole difficulty.",
  'about.frozenFork':
    'One analytical choice is frozen rather than offered: outlier z-scores are computed on the transformed outcome, within the filtered subsample. That is itself a fork, and freezing it is itself a decision. It is disclosed here because the forks you cannot see are the ones that do the damage.',
  'about.syntheticDisclaimer':
    'Nothing in this game is a finding. The participants do not exist, the data is generated in your browser, and the journals, DOIs, press outlets, headlines and quotes are all invented — which is why the press cards carry a SIMULATED PRESS watermark. The scenarios are deliberately absurd and deliberately harmless: no medical, nutritional or public-health claim appears anywhere in them, because a screenshot travels further than its caption.',
  'about.decimalNote': 'Statistical notation always uses a decimal point (p = 0.049), in every language.',
  'about.dataDisclosure':
    'Analytics are anonymous, cookieless page counts (Vercel Web Analytics) — no cookies, no accounts, no personal data, no cross-site tracking, no banner to dismiss. Your scores, streaks, history and language choice live in your browser\'s local storage and are never sent anywhere. Clearing your browser data deletes them permanently, including from us, who never had them.',
  'about.priorArt':
    'P-hackle is a small game standing on a large literature. It borrows its central demonstration, and most of its methods, from work worth reading directly:',
  'about.priorArtFiveThirtyEight':
    'Aschwanden & King (2015), "Hack Your Way to Scientific Glory," FiveThirtyEight — the interactive that owns this idea. It uses real data and offers no ground truth; P-hackle adds a known data-generating process, a daily seed, and the real-or-noise call.',
  'about.priorArtSpecCurve':
    'Simonsohn, Simmons & Nelson — specification curve analysis. The chart in the reveal is, essentially, their figure.',
  'about.priorArtForkingPaths':
    'Gelman & Loken — the garden of forking paths: no fishing expedition is required for this to happen, only an analysis that adapts to the data you happened to see.',
  'about.priorArtFalsePositive':
    'Simmons, Nelson & Simonsohn (2011), "False-Positive Psychology" — the inventory of researcher degrees of freedom that this toolbox implements, one button at a time.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson & Rowe (1969) — testing repeatedly as data accumulates inflates the false-positive rate on its own, which is why every extra batch you collect is counted against you at the reveal.',
  'about.glossaryTitle': 'Glossary',
  'about.contact': 'Questions or bug reports welcome.',

  'legend.title': 'Legend',
  'legend.explored': 'Specification you viewed',
  'legend.unexplored': "Specification you didn't view",
  'legend.significant': 'p < .05',
  'legend.published': 'The one you published',
  'legend.trueEffect': 'True effect',

  'errors.workerCrash': "Something went wrong generating today's puzzle. Reloading usually fixes it.",
  'errors.storageOff': "Your browser is blocking local storage, so progress won't be saved between visits.",

  'a11y.localeToggle': 'Change language',
  'a11y.specCurveChart':
    "Chart of every possible specification's p-value, sorted, with your published specification highlighted.",
  'a11y.shareButton': 'Copy share result to clipboard',
  'a11y.closeDialog': 'Close dialog',
  'a11y.loading': "Loading today's puzzle",
};
