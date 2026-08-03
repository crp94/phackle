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
  | 'briefing.openData'
  | 'briefing.correspondingAuthor'
  | 'briefing.vol'
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
  | 'summary.score'
  | 'summary.share'
  | 'summary.copied'
  | 'summary.nextIn'
  | 'summary.streak'
  | 'summary.playPrereg'
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
  | 'about.decimalNote'
  | 'about.dataDisclosure'
  | 'about.priorArt'
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

  'briefing.openData': 'Open Data',
  'briefing.correspondingAuthor': 'Corresponding author: Prof. R. Grantwell',
  'briefing.vol': 'Vol. {volume}, No. {issue}',

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
  'lab.peekFootnote': 'Peeking costs nothing but honesty — every extra batch is logged.',
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

  'summary.score': 'Score: {score}',
  'summary.share': 'Share',
  'summary.copied': 'Copied to clipboard',
  'summary.nextIn': 'Next puzzle in {hours}h {minutes}m',
  'summary.streak': '{n} day streak',
  'summary.playPrereg': 'Try Prereg Mode',

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
    'The data is genuinely simulated from a declared model; the regressions are real; the specification curve is exhaustively computed, not faked. Nothing here is rigged beyond what the data-generating process discloses.',
  'about.decimalNote': 'Statistical notation always uses a decimal point (p = 0.049), in every language.',
  'about.dataDisclosure':
    'Analytics are anonymous, cookieless page counts only. No cookies, no accounts, no personal data. Your scores, streaks, and history stay in your browser.',
  'about.priorArt':
    'Inspired by FiveThirtyEight’s "Hack Your Way to Scientific Glory," and by the specification-curve and garden-of-forking-paths literature it draws on.',
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
