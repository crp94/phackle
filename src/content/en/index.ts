// English content (master spec §4). This is the source-of-truth locale: it
// defines the scenario ids/order every other locale must mirror, and its
// copy.ts defines the CopyKey union every locale's catalog is checked against.
//
// Only 2 scenarios are fully written here — task T6 raises this file's
// scenario list to the full >= 20 required by v1 (see tests/content/shape.test.ts
// for the count gate, currently >= 2 until T6 flips it). Grantwell/press/
// retractionSublines/achievements/glossary are already at their v1 shape.
import type { LocaleContent } from '../types';
import { copy } from './copy';

export const content: LocaleContent = {
  scenarios: [
    {
      id: 'cat-crypto',
      question: 'Does owning a cat improve cryptocurrency returns?',
      coverStory:
        'A pilot cohort of retail investors was recruited to test a folk hypothesis long whispered in personal-finance forums: that cat ownership confers a calming, risk-steadying influence on portfolio behavior. Four hundred self-directed traders logged their pet status alongside thirty days of trading activity; we set out, in good faith, to find out whether the cats were secretly running the numbers.',
      treatmentLabel: 'Owns a cat',
      headline: 'Cat Owners See {n}% Higher Returns, Study Finds',
      outcomeLabels: ['30-day portfolio return', 'Portfolio volatility', 'Trades per week', 'Self-rated financial wellbeing'],
      outcomeUnits: ['%', 'σ (annualized)', 'trades/week', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Self-reported risk tolerance' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'standing-desk-poetry',
      question: 'Do standing desks make middle managers write better poetry?',
      coverStory:
        "Office ergonomics research has spent decades on backs and wrists; almost none of it has asked about iambic pentameter. We equipped a cohort of middle managers with adjustable standing desks and, across one fiscal quarter, collected everything they wrote in the company's internal poetry Slack channel — scored blind by a panel of English-department alumni who had, notably, agreed to do this for pizza.",
      treatmentLabel: 'Uses a standing desk',
      headline: 'Standing Desks Linked to a Renaissance in Middle-Management Verse',
      outcomeLabels: [
        'Expert panel quality score',
        'Metaphor density',
        'Submissions to the internal poetry channel',
        'Self-assessed profundity',
      ],
      outcomeUnits: ['points', 'metaphors/stanza', 'submissions/month', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Appetite for creative risk-taking' },
      journalTags: ['workplace', 'creative'],
    },
  ],

  grantwell: [
    'Reviewer 2 wants significance by Friday. The renewal depends on it. I believe in you (and have no alternative).',
    "The dean asked if our work is 'impactful'. I said yes. Make that retroactively true.",
    'Remember: a p-value of .06 is just a p-value of .05 with poor time management.',
    "I told the funding agency this was 'high-risk, high-reward'. Deliver the second part.",
    "Quick note before your defense: 'the effect trended in the expected direction' is a complete sentence. Use it.",
    'The department newsletter needs a win this month. You are, as of 9am, the win.',
    "I've cleared my afternoon to hear that the hypothesis held up. Please don't make me clear tomorrow afternoon too.",
    "Grant year three of three. I don't want to alarm you, but I want to alarm you a little.",
    'Your undergrad self chose this hypothesis. Your tenure committee does not need to know that.',
    'A colleague at a rival lab published something adjacent to this last week. We are now, technically, racing.',
    'The IRB approved the cats. The cats did not approve the correlation. Find it anyway.',
    "Note for the abstract: 'preliminary' is a word we can add after the good news, not before it.",
    "I had a dream last night that this replicated. I'm choosing to treat that as pre-registration.",
    'The conference deadline moved up. Statistically speaking, this changes nothing. Emotionally, it changes everything.',
  ],

  press: [
    { text: 'Scientists say: your cat may be your best financial advisor.', outlet: 'Morning Chirp', tier: 1 },
    { text: 'New study finds surprising link between everyday habit and performance.', outlet: 'The Weekly Ledger', tier: 1 },
    { text: 'One weird trick statisticians PUBLISH with.', outlet: 'The Daily Scroll', tier: 2 },
    { text: 'Is your desk chair costing you a Pulitzer? Experts weigh in.', outlet: 'Buzz & Broadsheet', tier: 2 },
    { text: 'STUDY: FERNS = LEVERAGE?', outlet: 'Nightly Chyron Network', tier: 3 },
    { text: 'BREAKING: YOUR HOUSEPLANTS ARE JUDGING YOUR 401(k)', outlet: 'Nightly Chyron Network', tier: 3 },
  ],

  retractionSublines: [
    'The effect was 0.000. It was always 0.000.',
    'Your headline has been quietly removed from the university homepage.',
    'The preprint has been un-printed.',
    'Prof. Grantwell has not responded to requests for comment.',
    'The confidence interval always contained zero. It was very patient about it.',
    'This finding has been retracted, reticulated, and gently returned to the null.',
  ],

  achievements: {
    first_blood: { name: 'First Blood', citation: 'For the first paper this lab ever got past a reviewer.' },
    first_retraction: {
      name: 'First Retraction',
      citation: 'For the swiftness with which the university homepage forgot you.',
    },
    harking: { name: 'HARKing', citation: 'For hypothesizing after the results were known, and knowing it.' },
    one_tailed_bandit: {
      name: 'The One-Tailed Bandit',
      citation: 'For deciding, at the last possible moment, that only one direction ever mattered.',
    },
    outlier_surgeon: {
      name: 'Outlier Surgeon',
      citation: 'For services to the removal of inconvenient humans.',
    },
    subgroup_safari: {
      name: 'Subgroup Safari',
      citation: 'For touring five subgroups in search of the one that agreed with you.',
    },
    one_more_batch: {
      name: 'Just One More Batch',
      citation: 'For collecting data until the data cooperated.',
    },
    garden: {
      name: 'Garden of Forking Paths',
      citation: 'For viewing twenty-five specifications and publishing the prettiest one.',
    },
    monk: { name: 'The Monk', citation: 'For twenty days of not doing any of this.' },
    well_actually: {
      name: 'Well, Actually',
      citation: 'For publishing the noise, and knowing exactly what you were doing.',
    },
    true_detective: {
      name: 'True Detective',
      citation: 'For ten consecutive correct calls between signal and self-deception.',
    },
  },

  glossary: [
    {
      term: 'p-hacking',
      def: 'Analyzing data in ways that inflate the false-positive rate, then reporting only the analysis that crossed the significance threshold.',
    },
    {
      term: 'Researcher degrees of freedom',
      def: 'The many small, defensible-looking choices in an analysis — which outcome, which subgroup, which exclusion rule — each of which shifts the result.',
    },
    {
      term: 'Garden of forking paths',
      def: "The idea that a single dataset admits many defensible analyses, so 'the' result depends on which path through that garden was taken.",
    },
    {
      term: 'Specification curve',
      def: 'A plot of the estimate (or p-value) produced by every reasonable analytical specification, sorted, so the full space of decisions — not just the published one — is visible at once.',
    },
    {
      term: 'HARKing',
      def: 'Hypothesizing After the Results are Known: presenting a post-hoc finding as though it had been predicted in advance.',
    },
    {
      term: 'Optional stopping',
      def: 'Checking results as data arrives and stopping data collection once significance is reached, which inflates the false-positive rate even with an honest test.',
    },
    {
      term: 'Preregistration',
      def: 'Committing to a hypothesis and analysis plan before seeing the data, so the analysis cannot adapt itself to the result.',
    },
    {
      term: 'α / false-positive rate',
      def: 'The rate at which a test flags an effect that is not really there, conventionally capped at 5% — a cap this game is specifically engineered to blow past.',
    },
  ],

  copy,
};
