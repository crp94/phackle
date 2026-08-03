// English content (master spec §4). This is the source-of-truth locale: it
// defines the scenario ids/order every other locale must mirror, and its
// copy.ts defines the CopyKey union every locale's catalog is checked against.
//
// Authoring rules, enforced by tests/content/shape.test.ts and binding on the
// IT/ES transcreations (T19/T20):
//
//  1. REGISTER. Act I (questions, cover stories, headlines, press) is sincere
//     and enthusiastic — the game is never in on the joke before the reveal.
//     Act II (retraction sublines, achievement citations) is clinical and
//     deadpan. The contrast is the comedy; nothing here is smug.
//  2. HARM CHECK. Hypotheses are absurd-but-benign. No medical, nutritional or
//     public-health claim appears in any scenario, because a screenshot travels
//     further than its caption. Cats and crypto, yes; drugs and diseases, no.
//  3. OUTCOME FAMILIES. outcomeLabels/outcomeUnits are always in the engine's
//     fixed order: [heavy-tailed, positively skewed, count-like, 1-10 bounded
//     scale] (master spec §3.2). The count is small — the DGP's Y3 is a rounded
//     exp-normal, typically 0-8 — so pick a metric that is plausible at those
//     magnitudes and never one with a hard ceiling below 8.
//  4. DIRECTION. The one-tailed test always hypothesizes a POSITIVE direction,
//     so every outcome is phrased such that MORE of the metric means MORE of
//     the claimed effect. "Bugs shipped" is wrong; "releases shipped clean" is
//     right. This is a contract with the engine, not a style preference.
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
      outcomeLabels: [
        '30-day portfolio return',
        'Upside capture ratio',
        'Profitable trades per week',
        'Self-rated financial wellbeing',
      ],
      outcomeUnits: ['%', '% of benchmark', 'winning trades/week', '1–10 scale'],
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
    {
      id: 'sourdough-marathon',
      question: 'Does baking sourdough improve marathon times?',
      coverStory:
        'Endurance training has been studied to exhaustion; the baking has not. Our hypothesis is behavioral rather than nutritional — the twelve-week discipline of feeding a starter, the schedule, the flat refusal to rush a rise, should transfer directly to the patience a negative split demands. We recruited four hundred amateur marathoners through running clubs and one exceptionally cooperative flour co-op, matched their starter logs to their chip times, and waited.',
      treatmentLabel: 'Keeps a sourdough starter',
      headline: 'Sourdough Bakers Finish Marathons {n}% Faster, Researchers Report',
      outcomeLabels: [
        'Race-day improvement on personal best',
        'Final-10K surge over race-average pace',
        'Runners overtaken in the final 10 km',
        'Self-rated race-day patience',
      ],
      outcomeUnits: ['s/km gained', '% above race average', 'runners overtaken/race', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to go out too fast' },
      journalTags: ['fitness', 'lifestyle'],
    },
    {
      id: 'jazz-spreadsheets',
      question: 'Does listening to jazz reduce spreadsheet errors?',
      coverStory:
        'Open-plan offices have argued about background music for a decade without once auditing a workbook. We gave one department of financial analysts a curated hard-bop playlist and left the other with their usual silence, then ran every cell of their quarterly models through an independent audit tool. The analysts were told the study was about lighting.',
      treatmentLabel: 'Listens to jazz while working',
      headline: 'Jazz in the Office Linked to Measurably Cleaner Spreadsheets',
      outcomeLabels: [
        'Audit accuracy above the department baseline',
        'Longest clean stretch of audited cells',
        'Workbooks passing audit on first submission',
        'Self-rated attention to detail',
      ],
      outcomeUnits: ['percentage points', 'cells', 'workbooks/quarter', '1–10 scale'],
      covariateLabels: { income: 'Salary band', risk: 'Comfort with an unaudited formula' },
      journalTags: ['productivity', 'music'],
    },
    {
      id: 'fern-negotiation',
      question: 'Do office ferns make you a tougher negotiator?',
      coverStory:
        'Biophilic design is sold to facilities managers on wellbeing alone; nobody has asked what it does across a table. We placed a single Boston fern in the offices of four hundred procurement staff, left it there for one full contracting cycle, and then obtained — with permission, and after considerable pleading — the final terms of every deal they closed.',
      treatmentLabel: 'Keeps a fern on the desk',
      headline: 'Office Ferns Associated with €{n}k Better Contract Terms',
      outcomeLabels: [
        'Value claimed above the opening offer',
        'Longest silence held after a counteroffer',
        'Concessions extracted per negotiation',
        'Counterpart-rated toughness',
      ],
      outcomeUnits: ['€ thousands', 'seconds', 'concessions/negotiation', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to walk away' },
      journalTags: ['nature', 'workplace'],
    },
    {
      id: 'cold-shower-emails',
      question: 'Do cold showers make your emails more passive-aggressive?',
      coverStory:
        "The morning cold shower has been credited with focus, resilience and character; its effect on the inbox is entirely unstudied. Four hundred office workers logged their shower temperature each morning and consented to sentiment scoring of their outgoing mail for six weeks. Our coders were blind to condition, and the phrase 'per my last email' was flagged automatically, which spared them a great deal.",
      treatmentLabel: 'Takes cold showers',
      headline: 'Cold Showers Linked to a {n}% Sharper Inbox Tone',
      outcomeLabels: [
        'Passive-aggression index of outgoing mail',
        'Reply latency on unwelcome requests',
        "'Per my last email' instances",
        'Recipient-rated frostiness',
      ],
      outcomeUnits: ['index points', 'hours', 'instances/week', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to reply-all' },
      journalTags: ['wellness', 'communication'],
    },
    {
      id: 'horoscope-parking',
      question: 'Do horoscope readers find parking faster?',
      coverStory:
        'Urban mobility research models the parking search as a rational process. We wondered whether it is in fact a devotional one. Four hundred drivers installed a logger that recorded every search from street entry to engine-off, and reported their morning app habits; those who read their star sign before driving were compared with those who did not. Neither group was told what we were looking for, which seemed only fair.',
      treatmentLabel: 'Reads a daily horoscope',
      headline: 'Horoscope Readers Save {n} Minutes a Week Looking for Parking',
      outcomeLabels: [
        'Search time saved against the block average',
        'Distance advantage over the nearest legal alternative',
        'First-attempt parking successes',
        'Self-rated cosmic alignment',
      ],
      outcomeUnits: ['minutes saved', 'metres', 'successes/week', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Comfort with an ambiguous parking sign' },
      journalTags: ['superstition', 'lifestyle'],
    },
    {
      id: 'mechanical-keyboard-bugs',
      question: 'Do mechanical keyboards reduce bugs shipped?',
      coverStory:
        'The tactile-feedback literature ends at typing speed and stops well short of production. With the cooperation of eleven engineering teams, we matched eighteen months of hardware procurement records to the same period of issue trackers, treating each switch changeover as a natural experiment. Two participants changed switch type mid-study and were, regrettably, dropped.',
      treatmentLabel: 'Types on a mechanical keyboard',
      headline: 'Mechanical Keyboards Associated with {n}% Cleaner Releases',
      outcomeLabels: [
        'Defect-free code shipped per release',
        'Longest green-build streak',
        'Reviews approved with no changes requested',
        'Self-rated confidence at commit time',
      ],
      outcomeUnits: ['thousand lines', 'hours', 'approvals/sprint', '1–10 scale'],
      covariateLabels: { income: 'Salary band', risk: 'Appetite for shipping on a Friday' },
      journalTags: ['technology', 'productivity'],
    },
    {
      id: 'dog-economist-stocks',
      question: 'Do people with dogs named after economists beat the market?',
      coverStory:
        'Retail investing folklore holds that conviction has to come from somewhere. We asked four hundred brokerage customers for their pets\' names, hand-classified each against a reference list of economists — Keynes, Hayek, Ostrom, and one Milton we argued about for a week — and matched the classification to two years of audited account statements.',
      treatmentLabel: 'Dog named after an economist',
      headline: 'Investors With Dogs Named for Economists Beat the Market by {n} Points',
      outcomeLabels: [
        'Annualized excess return over the benchmark',
        'Best single-position gain',
        'Holdings finishing ahead of the index',
        'Self-rated conviction in the thesis',
      ],
      outcomeUnits: ['percentage points', '%', 'holdings/quarter', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Self-reported risk tolerance' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'full-moon-meetings',
      question: 'Do meetings run longer under a full moon?',
      coverStory:
        "Calendar data is the most underused behavioral dataset in the modern firm. We extracted eighteen months of meeting records from a mid-sized consultancy — scheduled end times, actual end times, attendee counts, follow-up bookings — and joined them to a lunar ephemeris. The hypothesis was proposed, in complete earnest, by the department's calendar administrator.",
      treatmentLabel: 'Held under a full moon',
      headline: 'Meetings Run {n} Minutes Longer Under a Full Moon, Analysis Finds',
      outcomeLabels: [
        'Overrun past the scheduled end',
        'Longest single tangent',
        "'Quick follow-ups' booked afterwards",
        'Attendee-rated sense that this could have been an email',
      ],
      outcomeUnits: ['minutes', 'minutes', 'follow-ups/meeting', '1–10 scale'],
      covariateLabels: { income: "Organizer's salary band", risk: 'Willingness to add one more agenda item' },
      journalTags: ['astronomy', 'workplace'],
    },
    {
      id: 'label-maker-inbox',
      question: 'Does owning a label maker help you reach inbox zero?',
      coverStory:
        'Personal information management is a field rich in taxonomies and poor in fieldwork. We asked four hundred knowledge workers a single screening question — do you own a label maker? — and then, with consent, instrumented their mail clients for a quarter. The instrument counted metadata only; three participants asked us to confirm that twice, which we did, happily.',
      treatmentLabel: 'Owns a label maker',
      headline: 'Label-Maker Owners Clear {n}% More of Their Inbox Each Week',
      outcomeLabels: [
        'Weekly clearance rate of arriving mail',
        'Longest run of days at inbox zero',
        'Folders created',
        'Self-rated sense of control',
      ],
      outcomeUnits: ['% of arrivals', 'days', 'folders/month', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Comfort living with an unread badge' },
      journalTags: ['productivity', 'workplace'],
    },
    {
      id: 'vinyl-dinner-party',
      question: 'Do vinyl collectors throw better dinner parties?',
      coverStory:
        "Hospitality research has characterized the menu exhaustively and the turntable not at all. Four hundred hosts agreed to have one dinner party observed by a research assistant, introduced to the other guests as 'a colleague from work'. The assistants recorded arrival and departure times, what guests brought, and what they asked for on the way out. The wine was not analyzed; the wine was not, in fairness, still available for analysis.",
      treatmentLabel: 'Owns a vinyl collection',
      headline: 'Vinyl-Owning Hosts Keep Guests {n} Minutes Longer, Study Finds',
      outcomeLabels: [
        'Value of wine guests brought unprompted',
        'Time guests stayed past the stated end',
        'Unprompted requests for the recipe',
        'Guest-rated warmth of the evening',
      ],
      outcomeUnits: ['€', 'minutes', 'requests/party', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to test a new recipe on guests' },
      journalTags: ['music', 'lifestyle'],
    },
    {
      id: 'telescope-directions',
      question: 'Do backyard telescope owners give better directions?',
      coverStory:
        'Wayfinding research rests almost entirely on laboratory rotation tasks. We took the question outdoors: assistants approached four hundred strangers in three cities, asked for directions to a landmark eight minutes away, recorded the answer verbatim, and only then — after a full debrief — asked whether the participant owned a telescope. Response rates were, to our genuine surprise, excellent.',
      treatmentLabel: 'Owns a backyard telescope',
      headline: 'Telescope Owners Give Directions {n}% More Efficient Than the App',
      outcomeLabels: [
        'Route efficiency gain over the navigation app',
        'Landmark detail supplied per answer',
        'Cardinal directions used per conversation',
        'Stranger-rated confidence in the directions',
      ],
      outcomeUnits: ['%', 'words', 'compass points/conversation', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to recommend a shortcut' },
      journalTags: ['astronomy', 'communication'],
    },
    {
      id: 'cafe-peer-review',
      question: 'Do reviewers who work in cafés write harsher reviews?',
      coverStory:
        'Peer review is the least observed step in the entire scientific process, and we intend to keep it that way for everybody except ourselves. With the consent of two journals\' review boards, four hundred completed reports were matched to the location the reviewer reported writing in. Severity was scored by a panel that had itself, at various points, been reviewed in cafés.',
      treatmentLabel: 'Reviews from a café',
      headline: 'Café Reviewers Request {n} More Experiments Per Manuscript',
      outcomeLabels: [
        'Severity index of the report',
        "Length of the 'major concerns' section",
        'Additional experiments requested',
        'Author-rated harshness',
      ],
      outcomeUnits: ['index points', 'words', 'experiments/review', '1–10 scale'],
      covariateLabels: { income: 'Salary band', risk: 'Willingness to recommend rejection' },
      journalTags: ['general', 'workplace'],
    },
    {
      id: 'terms-and-conditions-service',
      question: 'Do people who read the terms and conditions get better customer service?',
      coverStory:
        'Consumer-protection research assumes that nobody reads the agreement, and has therefore never studied the people who do. We recruited four hundred customers who reported reading terms in full — a group we had considerable trouble locating — and, with their consent, transcribed and scored twelve months of their support interactions. The transcripts are the longest our lab has ever worked with.',
      treatmentLabel: 'Reads the terms and conditions',
      headline: 'Customers Who Read the Terms Receive €{n} More in Goodwill Credit',
      outcomeLabels: [
        'Goodwill credit granted per complaint',
        'Length of the apology received',
        'Issues resolved on first contact',
        'Self-rated sense of being taken seriously',
      ],
      outcomeUnits: ['€', 'words', 'resolutions/quarter', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to ask for a supervisor' },
      journalTags: ['communication', 'general'],
    },
    {
      id: 'jigsaw-suitcase-packing',
      question: 'Do people who do jigsaw puzzles pack a better suitcase?',
      coverStory:
        'Spatial-reasoning research has produced four decades of block-rotation tasks and almost no luggage. We took the question to a regional airport: four hundred travelers were asked whether they had completed a jigsaw puzzle in the past year and then, with permission and a folding table, had the contents of their bags measured against the volume of the bag. Departure gates proved an unusually cooperative recruitment environment.',
      treatmentLabel: 'Does jigsaw puzzles',
      headline: 'Puzzle Solvers Fit {n}% More Into the Same Suitcase',
      outcomeLabels: [
        'Spare capacity remaining after packing',
        'Longest trip packed into a carry-on',
        'Items retrieved without unpacking',
        'Companion-rated preparedness',
      ],
      outcomeUnits: ['litres', 'days', 'items/trip', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to travel without checking a bag' },
      journalTags: ['lifestyle', 'general'],
    },
    {
      id: 'stairs-small-talk',
      question: 'Do people who take the stairs make better small talk?',
      coverStory:
        'Building design determines who meets whom, but the resulting conversations are almost never recorded. In one twelve-storey office we logged stair-versus-lift choice from anonymized badge data and, separately, ran a rapport survey on every pair of colleagues who arrived on a floor together. Participants knew about the survey. Participants learned about the badges at debrief, a sequencing our ethics board asked us to describe in precisely these words.',
      treatmentLabel: 'Takes the stairs',
      headline: 'Stair-Takers Score {n}% Higher on Workplace Rapport',
      outcomeLabels: [
        'Rapport score above the building average',
        'Longest small-talk exchange sustained',
        'Follow-up conversations started',
        'Counterpart-rated warmth',
      ],
      outcomeUnits: ['points', 'seconds', 'conversations/week', '1–10 scale'],
      covariateLabels: { income: 'Salary band', risk: 'Willingness to open with a stranger' },
      journalTags: ['fitness', 'communication'],
    },
    {
      id: 'sock-folding-punctuality',
      question: 'Do people who fold their socks arrive earlier?',
      coverStory:
        'Time-use research has documented the commute in extraordinary detail and the sock drawer not at all. We asked four hundred participants to photograph their sock storage — folded, rolled or loose — and matched the classification to six weeks of calendar and door-badge timestamps. The photographs were scored by two independent coders who agreed far more often than we had budgeted for.',
      treatmentLabel: 'Folds their socks',
      headline: 'Sock-Folders Arrive {n} Minutes Earlier, Six-Week Study Finds',
      outcomeLabels: [
        'Minutes early to scheduled arrivals',
        'Longest unbroken streak of on-time days',
        'Appointments reached ahead of schedule',
        'Colleague-rated dependability',
      ],
      outcomeUnits: ['minutes early', 'days', 'appointments/week', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Comfort cutting a connection fine' },
      journalTags: ['lifestyle', 'workplace'],
    },
    {
      id: 'thirteen-mortgage',
      question: 'Do people who avoid the number 13 get better mortgage rates?',
      coverStory:
        'Household finance assumes the borrower optimizes, and treats superstition as noise around that assumption. We surveyed four hundred recent mortgage holders on a battery of everyday number preferences — floors skipped, dates avoided, house numbers declined — and matched the resulting triskaidekaphobia score to the terms they actually signed. The broker who helped us obtain those terms has asked not to be named, but sends regards.',
      treatmentLabel: 'Avoids the number 13',
      headline: 'Number-13 Avoiders Negotiate {n} Basis Points Off Their Mortgage',
      outcomeLabels: [
        'Rate advantage against the market average',
        'Fee concessions won during negotiation',
        'Counteroffers obtained per application',
        'Self-rated confidence in the deal',
      ],
      outcomeUnits: ['basis points', '€', 'counteroffers/application', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to let an offer expire' },
      journalTags: ['superstition', 'finance'],
    },
    {
      id: 'browser-tabs-side-projects',
      question: 'Do people who never close browser tabs ship more side projects?',
      coverStory:
        'Attention research treats the open tab as a cost. We wondered whether it might be an inventory. Four hundred developers installed an extension that recorded a daily tab count and nothing else — a limitation we accepted for recruitment reasons — and self-reported every side project shipped over the following year, with a working public link required as evidence.',
      treatmentLabel: 'Keeps 40+ tabs open',
      headline: 'Developers With the Most Open Tabs Ship {n}× More Side Projects',
      outcomeLabels: [
        'Side-project revenue over the year',
        'Longest uninterrupted build session',
        'Side projects shipped with a public link',
        'Self-rated creative momentum',
      ],
      outcomeUnits: ['€', 'minutes', 'projects/year', '1–10 scale'],
      covariateLabels: { income: 'Household income', risk: 'Willingness to start before finishing' },
      journalTags: ['technology', 'creative'],
    },
  ],

  // Prof. Grantwell's flavor bank (master spec §4.2), ordered by escalating
  // desperation: aphorisms and departmental nudges first, existential dread
  // last. Deliberately scenario-agnostic — one bank rotates across all 20
  // scenarios, so nothing here may name a cat, a fern or a marathon.
  grantwell: [
    'Remember: a p-value of .06 is just a p-value of .05 with poor time management.',
    "Note for the abstract: 'preliminary' is a word we can add after the good news, not before it.",
    "The dean asked if our work is 'impactful'. I said yes. Make that retroactively true.",
    'The department newsletter needs a win this month. You are, as of 9am, the win.',
    'The impact statement is due before the results are. Write it optimistically; we can align the findings later.',
    'Reviewer 2 wants significance by Friday. The renewal depends on it. I believe in you (and have no alternative).',
    "I told the funding agency this was 'high-risk, high-reward'. Deliver the second part.",
    "I've cleared my afternoon to hear that the hypothesis held up. Please don't make me clear tomorrow afternoon too.",
    "Quick note before your defense: 'the effect trended in the expected direction' is a complete sentence. Use it.",
    'Your undergrad self chose this hypothesis. Your tenure committee does not need to know that.',
    'A colleague at a rival lab published something adjacent to this last week. We are now, technically, racing.',
    'The conference deadline moved up. Statistically speaking, this changes nothing. Emotionally, it changes everything.',
    'The ethics board approved the protocol. The data has not approved the hypothesis. Proceed anyway.',
    "I've drafted the press release and communications loved it. All that's missing now is the study.",
    'The industrial partners visit Thursday. They funded a discovery. Please have discovered something.',
    'The postdoc line is contingent on this year’s output. I mention this not as pressure but as context. It is, of course, also pressure.',
    'The sabbatical committee meets in June. A finding by May would be — and I want to be precise here — decisive.',
    "The provost has started saying 'research portfolio review'. I don't know what it means either. I know when it means it.",
    'Grant year three of three. I don\'t want to alarm you, but I want to alarm you a little.',
    'Please stop sending me the confidence interval. Send me the point estimate. The point estimate has never let anybody down.',
    'Reviewer 2 has returned. Reviewer 2 is the same person as last time. Reviewer 2 remembers us.',
    "I had a dream last night that this replicated. I'm choosing to treat that as pre-registration.",
  ],

  // Simulated press (master spec §4.4), watermarked SIMULATED PRESS in the UI.
  // Tier = egregiousness of the published spec: tier 1 is credulous but sober,
  // tier 2 is aggregator-grade, tier 3 is the TV chyron. Blurbs are written
  // scenario-agnostically so any tier-appropriate line fits any day; the two
  // exceptions (cat, fern) are the master spec's own verbatim examples.
  press: [
    { text: 'Scientists say: your cat may be your best financial advisor.', outlet: 'Morning Chirp', tier: 1 },
    { text: 'New study finds surprising link between everyday habit and performance.', outlet: 'The Weekly Ledger', tier: 1 },
    { text: 'A small habit, a measurable difference: what one new paper suggests.', outlet: 'The Sunday Supplement', tier: 1 },
    { text: 'The finding is preliminary. The researchers say that is exactly why it matters.', outlet: 'Public Record Weekly', tier: 1 },
    { text: 'Peer-reviewed and published this week: a link nobody thought to look for.', outlet: 'The Weekly Ledger', tier: 1 },
    { text: 'Researchers call for further study, and for further funding to conduct it.', outlet: 'Public Record Weekly', tier: 1 },
    { text: 'One weird trick statisticians PUBLISH with.', outlet: 'The Daily Scroll', tier: 2 },
    { text: 'Is your desk chair costing you a Pulitzer? Experts weigh in.', outlet: 'Buzz & Broadsheet', tier: 2 },
    { text: 'You are already doing this. Science says keep going.', outlet: 'The Daily Scroll', tier: 2 },
    { text: 'Correlation is not causation, but this one really feels different.', outlet: 'The Daily Scroll', tier: 2 },
    { text: 'Nine habits of people who beat the average. Number four is in a real journal.', outlet: 'Clickwell', tier: 2 },
    { text: 'Scientists have finally confirmed what your group chat suspected all along.', outlet: 'Buzz & Broadsheet', tier: 2 },
    { text: 'Experts caution that the study is observational, then discuss it for eleven minutes.', outlet: 'Clickwell', tier: 2 },
    { text: 'STUDY: FERNS = LEVERAGE?', outlet: 'Nightly Chyron Network', tier: 3 },
    { text: 'BREAKING: YOUR HOUSEPLANTS ARE JUDGING YOUR 401(k)', outlet: 'Nightly Chyron Network', tier: 3 },
    { text: 'SCIENCE CONFIRMS: THE THING YOU DO IS WHY EVERYTHING IS HAPPENING', outlet: 'Nightly Chyron Network', tier: 3 },
    { text: 'ONE NUMBER CHANGES EVERYTHING. THE NUMBER IS 0.049.', outlet: 'Nightly Chyron Network', tier: 3 },
    { text: 'STATISTICALLY SIGNIFICANT — WHAT IT MEANS FOR YOUR FAMILY', outlet: 'Channel 9 Nightly', tier: 3 },
    { text: 'NEW RESEARCH: ARE YOU DOING IT WRONG? (YES)', outlet: 'Channel 9 Nightly', tier: 3 },
    { text: 'P LESS THAN POINT OH FIVE — WE EXPLAIN AFTER THE BREAK', outlet: 'Nightside Live', tier: 3 },
    { text: "EXCLUSIVE: THE ONE HABIT THE MARKET DOESN'T WANT YOU TO KEEP", outlet: 'Nightside Live', tier: 3 },
  ],

  // Act II. Quiet, one sentence, devastating; never a punchline, never smug.
  retractionSublines: [
    'The effect was 0.000. It was always 0.000.',
    'Your headline has been quietly removed from the university homepage.',
    'The preprint has been un-printed.',
    'Prof. Grantwell has not responded to requests for comment.',
    'The confidence interval always contained zero. It was very patient about it.',
    'The journal has issued a correction. This page is the correction.',
    'The dataset was fine. The dataset was always fine.',
    'A replication was attempted. It was not close.',
    'There was nothing there to replicate.',
    'The press release is still online. It is the only part that is.',
    'Your co-authors have asked to be listed as "consulted".',
    'The finding survived peer review and nothing else.',
    'Nobody has cited it. Nobody was ever going to.',
    'This is the version of record now.',
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
