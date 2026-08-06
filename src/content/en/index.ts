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
//  5. HEADLINE TOKEN, RETIRED (gr6-005 / gr3-001), and the reasoning, because
//     the rule that licenses the token is still on the books. A headline may
//     carry at most one `{effect}` token and never `{n}` (the copy catalog
//     binds {n} to SAMPLE SIZE via lab.nLabel and lab.collectMore, so a shared
//     interpolator would print N into an effect slot). As of GR6, not one of
//     the twenty carries either, and this is why:
//       - THE NUMBER WAS ALWAYS 1. `{effect}` was substituted with the
//         published spec's treatment effect in that outcome's OWN RAW UNITS,
//         rounded and floored at 1 (src/game/published.ts's substituteEffect).
//         Measured over 20 consecutive days from EPOCH, all 1,792 specs at both
//         the opening and the full window: 71,680 of 71,680 valid paths round
//         to 1. Not "usually" — every publishable path the game has. Median
//         |beta| runs 0.04 to 0.08, so the floor did all the work and the
//         number carried no information at all.
//       - THE FRAME COULD NOT BE HONOURED ANYWAY. The frame is fixed per
//         scenario, while the number comes from whichever of the four outcomes
//         the player published, so a 1-10 self-rating could print as "€1 More
//         in Goodwill Credit" or "1% Higher Returns". No fixed frame survives a
//         number whose units the player chooses at run time.
//     Token-free headlines were always legal here ("occasionally funnier":
//     forcing a number into standing-desk-poetry's would have spoiled it) and
//     are now the whole set. tests/content/shape.test.ts pins the fact and
//     records the ONE condition for bringing the token back: an engine that
//     expresses the effect unit-free (as a percentage of the control-group
//     mean, gr3-001's alternative) and closes the plural-after-1 trap
//     independently. Do not re-add a token before that lands, and do not ship
//     the floor-at-1 rule either way.
//  6. COHORT SIZE. Cover stories never state the final headcount. The lab
//     opens at N = 200 with a "collect 50 more" button (§2.4), so a briefing
//     that has already announced 400 participants deflates the optional-
//     stopping fiction before the player reaches it. Drop the number, or say
//     recruitment is still running — and vary how, since fifteen identical
//     "four hundred participants" openings were themselves a visible seam.
//  7. COVARIATES (gr6-040). The two covariateLabels only RENAME the engine's
//     two latent controls, so the left one has to stay a plausible INCOME
//     PROXY — an expenditure, an asset, a budget, a pay band — or the
//     regression the player is running stops meaning what the screen says it
//     means. Within that constraint it should be the scenario's own: these
//     labels are furniture on the one screen the player spends the whole
//     session in, and 'Household income' stood on 15 of 20 days beside a
//     bespoke right-hand label, so the radiogroup read as one funny option and
//     one filing cabinet, every day, forever. The one-tailed DIRECTION
//     contract (rule 4) does not reach here: a covariate is a control, not an
//     outcome, and nothing about it is hypothesized.
//  8. HOW A COVER STORY OPENS AND CLOSES (gr6-041).
//     THE CLOSER IS A LAW: one wry logistics aside per scenario, 20 of 20,
//     every payload different ("He sends regards." / "Both had moved to
//     something quieter." / "The consent forms, for once, were read in full.").
//     It is the corpus's best recurring beat because the DEVICE repeats and the
//     JOKE never does. Keep all twenty.
//     THE OPENER IS NOT: sixteen of twenty opened on the same academic-gap
//     sentence (the literature has studied A exhaustively and B not at all),
//     and on a daily an identical first sentence becomes furniture inside two
//     weeks. Five now enter from elsewhere — method (mechanical-keyboard),
//     person (full-moon), mid-scene (jigsaw), objection (sock), money
//     (cat-crypto) — leaving twelve. The gap sentence itself is not the
//     problem and mostly survives further down the paragraph; being FIRST every
//     time was. Two of the five needed new closers, because the material their
//     new opener uses was their old closer: the device is preserved, the
//     payload is new, and the count is still 20 of 20.
import type { LocaleContent } from '../types';
import { copy } from './copy';

export const content: LocaleContent = {
  scenarios: [
    {
      id: 'cat-crypto',
      question: 'Does owning a cat improve cryptocurrency returns?',
      coverStory:
        'A philanthropic trust with four cats and a very strong prior asked us a question: does cat ownership confer a calming, risk-steadying influence on portfolio behavior? The folk hypothesis has been whispered in personal-finance forums for years and tested by nobody. Self-directed traders log their pet status alongside thirty days of trading activity, and recruitment through those forums is ongoing. The trust would like to be kept informed, weekly.',
      treatmentLabel: 'Owns a cat',
      headline: 'Cat Owners See Higher Returns, Study Finds',
      // DELIBERATE SPEC DIVERGENCE — do not "fix" back. The master spec (§2.4,
      // §3.2, §4.1) illustrates this scenario with "portfolio volatility" and
      // "trades/week", but both run against rule 4 above: the cover story sells
      // cats as risk-steadying, so MORE volatility and MORE trading argue
      // against the claimed effect, which breaks the one-tailed direction
      // contract. Upside capture (still a skewed, positive finance quantity)
      // and profitable trades preserve the spec's shapes and its joke.
      outcomeLabels: [
        '30-day portfolio return',
        'Upside capture ratio',
        'Profitable trades per week',
        'Self-rated calm during a crash',
      ],
      outcomeUnits: ['%', '% of benchmark', 'winning trades/week', '1–10 scale'],
      covariateLabels: { income: 'Portfolio size', risk: 'Willingness to hold through a red candle' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'standing-desk-poetry',
      question: 'Do standing desks make middle managers write better poetry?',
      coverStory:
        "Office ergonomics research has spent decades on backs and wrists and almost none of it on iambic pentameter. We equipped a cohort of middle managers with adjustable standing desks and, across one fiscal quarter, collected everything they wrote in the company's internal poetry Slack channel. The panel of English-department alumni scoring it blind is being paid in pizza.",
      treatmentLabel: 'Uses a standing desk',
      headline: 'Standing Desks Linked to a Renaissance in Middle-Management Verse',
      outcomeLabels: [
        'Panel quality score above the department average',
        'Metaphor density',
        'Submissions to the internal poetry channel',
        'Self-assessed profundity',
      ],
      outcomeUnits: ['points', 'metaphors/stanza', 'submissions/month', '1–10 scale'],
      covariateLabels: { income: 'Management pay band', risk: 'Appetite for creative risk-taking' },
      journalTags: ['workplace', 'creative'],
    },
    {
      id: 'sourdough-marathon',
      question: 'Does baking sourdough improve marathon times?',
      coverStory:
        'Endurance training has been studied to exhaustion. The baking has not. Our hypothesis is behavioral rather than nutritional: twelve weeks of refusing to rush a rise should transfer directly to the patience a negative split demands. We recruited amateur marathoners through running clubs and one exceptionally cooperative flour co-op, matched their starter logs to their chip times, and waited. The co-op is still sending people.',
      treatmentLabel: 'Keeps a sourdough starter',
      headline: 'Sourdough Bakers Finish Marathons Faster, Researchers Report',
      outcomeLabels: [
        'Race-day improvement on personal best',
        'Final-10K surge over race-average pace',
        'Runners overtaken in the final 10 km',
        'Self-rated race-day patience',
      ],
      outcomeUnits: ['s/km gained', '% above race average', 'runners overtaken/race', '1–10 scale'],
      covariateLabels: { income: 'Spend on running shoes', risk: 'Willingness to go out too fast' },
      journalTags: ['fitness', 'lifestyle'],
    },
    {
      id: 'jazz-spreadsheets',
      question: 'Does listening to jazz reduce spreadsheet errors?',
      coverStory:
        'Open-plan offices have argued about background music for a decade without once auditing a workbook. We gave one department of financial analysts a 340-hour hard-bop playlist and left the other with their usual silence, then ran every cell of their quarterly models through an independent audit tool. The analysts were told the study was about lighting.',
      treatmentLabel: 'Listens to jazz while working',
      headline: 'Jazz in the Office Linked to Cleaner Spreadsheets',
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
        'Biophilic design is sold to facilities managers on wellbeing alone. Nobody has asked what it does across a table. We placed a single Boston fern in the office of every procurement officer who agreed to take part, left it there for one full contracting cycle, and then obtained the final terms of every deal they closed. Permission was granted in every case, in several after considerable pleading.',
      treatmentLabel: 'Keeps a fern on the desk',
      headline: 'Office Ferns Associated with Better Contract Terms',
      outcomeLabels: [
        'Value claimed above the opening offer',
        'Longest silence held after a counteroffer',
        'Concessions extracted per negotiation',
        'Counterpart-rated toughness',
      ],
      outcomeUnits: ['€ thousands', 'seconds', 'concessions/negotiation', '1–10 scale'],
      covariateLabels: { income: 'Departmental budget', risk: 'Willingness to walk away' },
      journalTags: ['nature', 'workplace'],
    },
    {
      id: 'cold-shower-emails',
      question: 'Do cold showers make your emails more passive-aggressive?',
      coverStory:
        "The morning cold shower has been credited with focus, resilience and character. Its effect on the inbox is entirely unstudied. Office workers log their shower temperature each morning and consent to sentiment scoring of six weeks of outgoing mail; enrollment continues in waves, as the plumbing allows. Our coders are blind to condition, and the phrase 'per my last email' is flagged automatically, which spares them a great deal.",
      treatmentLabel: 'Takes cold showers',
      headline: 'Cold Showers Linked to a Sharper Inbox Tone',
      outcomeLabels: [
        'Passive-aggression index of outgoing mail',
        'Reply latency on unwelcome requests',
        "'Per my last email' instances",
        'Recipient-rated frostiness',
      ],
      outcomeUnits: ['index points', 'hours', 'instances/week', '1–10 scale'],
      covariateLabels: { income: 'Bathrooms in the household', risk: 'Willingness to reply-all' },
      journalTags: ['wellness', 'communication'],
    },
    {
      id: 'horoscope-parking',
      question: 'Do horoscope readers find parking faster?',
      coverStory:
        'Urban mobility research models the parking search as a rational process. We wondered whether it is in fact a devotional one. Drivers install a logger that records every search from street entry to engine-off and report their morning app habits; those who read their star sign before driving are compared with those who do not. Neither group is told what we are looking for. Two have guessed anyway, and neither was close.',
      treatmentLabel: 'Reads a daily horoscope',
      headline: 'Horoscope Readers Save Minutes Every Week Looking for Parking',
      outcomeLabels: [
        'Search time saved against the block average',
        'Distance advantage over the nearest legal alternative',
        'First-attempt parking successes',
        'Self-rated cosmic alignment',
      ],
      outcomeUnits: ['minutes saved', 'metres', 'successes/week', '1–10 scale'],
      covariateLabels: { income: 'Parking-permit tier', risk: 'Comfort with an ambiguous parking sign' },
      journalTags: ['superstition', 'lifestyle'],
    },
    {
      id: 'mechanical-keyboard-bugs',
      question: 'Do mechanical keyboards reduce bugs shipped?',
      coverStory:
        'Eighteen months of hardware procurement records, matched line by line to eighteen months of issue trackers. Eleven engineering teams opened both sets to us, and every switch changeover inside them is treated as a natural experiment. Typing speed is where the tactile-feedback literature stops; production is where this study starts. Two participants changed switch type mid-study and were, regrettably, dropped. Both had moved to something quieter.',
      treatmentLabel: 'Types on a mechanical keyboard',
      headline: 'Mechanical Keyboards Associated with Cleaner Releases',
      outcomeLabels: [
        'Defect-free code shipped above the team baseline',
        'Days between red builds',
        'Reviews approved with no changes requested',
        'Self-rated confidence at commit time',
      ],
      outcomeUnits: ['thousand lines', 'days', 'approvals/sprint', '1–10 scale'],
      covariateLabels: { income: 'Salary band', risk: 'Appetite for shipping on a Friday' },
      journalTags: ['technology', 'productivity'],
    },
    {
      id: 'dog-economist-stocks',
      question: 'Do people with dogs named after economists beat the market?',
      coverStory:
        "Retail investing folklore holds that conviction has to come from somewhere. We asked brokerage customers for their pets' names and hand-classified each against a reference list of economists (Keynes, Hayek, Ostrom, and one Milton we argued about for a week), then matched the classification to two years of audited account statements. The classification queue is not yet empty.",
      treatmentLabel: 'Dog named after an economist',
      headline: 'Investors With Dogs Named for Economists Beat the Market',
      outcomeLabels: [
        'Annualized excess return over the benchmark',
        'Best single-position gain',
        'Holdings finishing ahead of the index',
        'Self-rated conviction in the thesis',
      ],
      outcomeUnits: ['percentage points', '%', 'holdings/quarter', '1–10 scale'],
      covariateLabels: { income: 'Annual spend on the dog', risk: 'Belief that the dog knows something' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'full-moon-meetings',
      question: 'Do meetings run longer under a full moon?',
      coverStory:
        'The calendar administrator had a theory, and had been right about things before. We extracted eighteen months of meeting records from a mid-sized consultancy (scheduled end times, actual end times, attendee counts, follow-up bookings) and joined them to a lunar ephemeris. Calendar data is the most underused behavioral dataset in the modern firm; the moon has been available for rather longer. The consultancy has since asked which of its meetings we intend to name.',
      treatmentLabel: 'Held under a full moon',
      headline: 'Meetings Now Run Measurably Longer Under a Full Moon, Analysis Finds',
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
        'Personal information management is a field rich in taxonomies and poor in fieldwork. We ask knowledge workers one screening question (do you own a label maker?) and then, with consent, instrument their mail clients for a quarter. The instrument counts metadata only. Three participants have asked us to confirm that twice; we confirmed it twice, happily.',
      treatmentLabel: 'Owns a label maker',
      headline: 'Label-Maker Owners Clear More of Their Inbox Each Week',
      outcomeLabels: [
        'Clearance rate above the cohort average',
        'Consecutive days at inbox zero',
        'Nested subfolders created',
        'Self-rated tidiness of mind',
      ],
      outcomeUnits: ['% of arrivals', 'days', 'folders/month', '1–10 scale'],
      covariateLabels: { income: 'Office-supplies budget', risk: 'Comfort living with an unread badge' },
      journalTags: ['productivity', 'workplace'],
    },
    {
      id: 'vinyl-dinner-party',
      question: 'Do vinyl collectors throw better dinner parties?',
      coverStory:
        "Hospitality research has characterized the menu exhaustively and the turntable not at all. Hosts agree to have one dinner party observed by a research assistant, introduced to the other guests as 'a colleague from work'; dinner parties being what they are, the observation schedule runs months ahead of the analysis. The assistants record arrival and departure times, what guests bring, and what they ask for on the way out. The wine is not analyzed; the wine is not, in fairness, still available for analysis.",
      treatmentLabel: 'Owns a vinyl collection',
      headline: 'Vinyl-Owning Hosts Keep Guests Longer, Study Finds',
      outcomeLabels: [
        'Value of wine brought above the usual contribution',
        'Time guests stayed past the stated end',
        'Unprompted requests for the recipe',
        'Guest-rated warmth of the evening',
      ],
      outcomeUnits: ['€', 'minutes', 'requests/party', '1–10 scale'],
      covariateLabels: { income: 'Monthly spend on wine', risk: 'Willingness to test a new recipe on guests' },
      journalTags: ['music', 'lifestyle'],
    },
    {
      id: 'telescope-directions',
      question: 'Do backyard telescope owners give better directions?',
      coverStory:
        'Wayfinding research rests almost entirely on laboratory rotation tasks. We took the question outdoors. Assistants approach strangers in three cities, ask for directions to a landmark eight minutes away, record the answer verbatim, and only then, after a full debrief, ask whether the participant owns a telescope. Response rates are, to our genuine surprise, excellent, and a fourth city is being added. Telescope owners, in particular, are delighted to be asked.',
      treatmentLabel: 'Owns a backyard telescope',
      headline: 'Telescope Owners Give Directions the Navigation App Cannot Match',
      outcomeLabels: [
        'Route efficiency gain over the navigation app',
        'Landmark detail supplied per answer',
        'Cardinal directions used per conversation',
        'Stranger-rated confidence in the directions',
      ],
      outcomeUnits: ['%', 'words', 'compass points/conversation', '1–10 scale'],
      covariateLabels: { income: 'Monthly spend on hobbies', risk: 'Willingness to recommend a shortcut' },
      journalTags: ['astronomy', 'communication'],
    },
    {
      id: 'cafe-peer-review',
      question: 'Do reviewers who work in cafés write harsher reviews?',
      coverStory:
        "Peer review is the least observed step in the entire scientific process, and we intend to keep it that way for everybody except ourselves. With the consent of two journals' review boards, completed reports are matched to the location the reviewer reported writing in, as the boards release them. Severity is scored by a panel of former editors, every one of whom has been reviewed in a café and has not forgotten it.",
      treatmentLabel: 'Reviews from a café',
      headline: 'Café Reviewers Request More Experiments Per Manuscript',
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
        'Consumer-protection research assumes that nobody reads the agreement and has therefore never studied the people who do. We are recruiting customers who report reading terms in full, a group we are having considerable trouble locating, and, with their permission, transcribing twelve months of their support interactions. The transcripts are the longest our lab has ever worked with. The consent forms, for once, were read in full.',
      treatmentLabel: 'Reads the terms and conditions',
      headline: 'Customers Who Read the Terms Are Quietly Better Compensated',
      outcomeLabels: [
        'Goodwill credit above the standard settlement',
        'Length of the apology received',
        'Issues resolved on first contact',
        'Self-rated feeling of being taken seriously',
      ],
      outcomeUnits: ['€', 'words', 'resolutions/quarter', '1–10 scale'],
      covariateLabels: { income: 'Annual spend with the retailer', risk: 'Willingness to ask for a supervisor' },
      journalTags: ['communication', 'general'],
    },
    {
      id: 'jigsaw-suitcase-packing',
      // gr6-039: outcome 0 used to be 'Spare capacity remaining after packing',
      // which pointed the opposite way to its own headline -- fitting MORE in
      // leaves LESS spare capacity, so the number under "Fit More Into the Same
      // Suitcase" fell as the claim rose. The metric is now the volume packed
      // past the bag's rating, which rises with the claim and keeps litres a
      // volume rather than the percentage the old headline's frame implied.
      question: 'Do people who do jigsaw puzzles pack a better suitcase?',
      coverStory:
        "There is a folding table at gate 14 and, on it, someone's holiday. Travelers are asked whether they have completed a jigsaw puzzle in the past year and then, with permission, have the contents of their bags measured against the volume of the bag. Four decades of block-rotation tasks have produced almost no luggage, which is the gap this study came to the airport to fill. A departure gate turns out to be an unusually cooperative recruitment environment: nobody there has anywhere else to be.",
      treatmentLabel: 'Does jigsaw puzzles',
      headline: 'Puzzle Solvers Fit More Into the Same Suitcase, Researchers Find',
      outcomeLabels: [
        "Volume packed above the bag's rated capacity",
        'Longest trip packed into a carry-on',
        'Items retrieved without unpacking',
        'Companion-rated preparedness',
      ],
      outcomeUnits: ['litres', 'days', 'items/trip', '1–10 scale'],
      covariateLabels: { income: 'Baggage-allowance tier', risk: 'Willingness to travel without checking a bag' },
      journalTags: ['lifestyle', 'general'],
    },
    {
      id: 'stairs-small-talk',
      question: 'Do people who take the stairs make better small talk?',
      coverStory:
        'Building design determines who meets whom, but the resulting conversations are almost never recorded. In one twelve-story office we logged stair-versus-lift choice from anonymized badge data and, separately, ran a rapport survey on every pair of colleagues who arrived on a floor together. Participants knew about the survey. Participants learned about the badges at debrief, a sequencing our ethics board asked us to describe in precisely these words.',
      treatmentLabel: 'Takes the stairs',
      headline: 'Stair-Takers Score Higher on Workplace Rapport',
      outcomeLabels: [
        'Rapport score above the building average',
        'Time a stairwell conversation ran on',
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
        'The obvious criticism is that nobody would notice. We measured whether anybody did. Participants photograph their sock storage (folded, rolled or loose), and we match the classification to six weeks of calendar and door-badge timestamps; time-use research has documented the commute in extraordinary detail and the sock drawer not at all. Two independent coders score the photographs. They agree far more often than we budgeted for, which is its own small crisis.',
      treatmentLabel: 'Folds their socks',
      headline: 'Sock-Folders Arrive Earlier, and the Badge Data Agrees',
      outcomeLabels: [
        'Minutes early to scheduled arrivals',
        'Longest unbroken streak of on-time days',
        'Appointments reached ahead of schedule',
        'Colleague-rated dependability',
      ],
      outcomeUnits: ['minutes early', 'days', 'appointments/week', '1–10 scale'],
      covariateLabels: { income: 'Annual spend on socks', risk: 'Comfort cutting a connection fine' },
      journalTags: ['lifestyle', 'workplace'],
    },
    {
      id: 'thirteen-mortgage',
      question: 'Do people who avoid the number 13 get better mortgage rates?',
      coverStory:
        'Household finance assumes the borrower optimizes and treats superstition as noise around that assumption. We have been surveying recent mortgage holders on a battery of everyday number preferences (floors skipped, dates avoided, house numbers declined) and matching the resulting triskaidekaphobia score to the terms they actually signed. The broker who obtains those terms for us has asked not to be named. He sends regards.',
      treatmentLabel: 'Avoids the number 13',
      headline: 'Number-13 Avoiders Talk Their Mortgage Rate Down, Survey Finds',
      outcomeLabels: [
        'Rate advantage against the market average',
        'Fee concessions won during negotiation',
        'Counteroffers obtained per application',
        'Self-rated satisfaction with the terms',
      ],
      outcomeUnits: ['basis points', '€', 'counteroffers/application', '1–10 scale'],
      covariateLabels: { income: 'Deposit size', risk: 'Willingness to let an offer expire' },
      journalTags: ['superstition', 'finance'],
    },
    {
      id: 'browser-tabs-side-projects',
      question: 'Do people who never close browser tabs ship more side projects?',
      coverStory:
        'Attention research treats the open tab as a cost. We wondered whether it might be an inventory. Developers install an extension that records a daily tab count and nothing else (a limitation we accepted for recruitment reasons) and self-report every side project shipped over the following year, with a working public link required as evidence. The link requirement has cost us more participants than the extension did.',
      treatmentLabel: 'Keeps 40+ tabs open',
      headline: 'Developers With the Most Open Tabs Ship More Side Projects',
      outcomeLabels: [
        'Side-project revenue above the developer median',
        'Uninterrupted stretch of build time',
        'Side projects shipped with a public link',
        'Self-rated grip on the situation',
      ],
      outcomeUnits: ['€', 'minutes', 'projects/year', '1–10 scale'],
      covariateLabels: { income: 'Contract day rate', risk: 'Willingness to start before finishing' },
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
    'A rival lab published something adjacent to this last week. We are now, technically, racing. They are not aware that we are racing.',
    'The conference deadline moved up by eleven days. Statistically, that changes nothing. I have already submitted the title.',
    'The ethics board approved the protocol. The data has not approved the hypothesis. Proceed anyway.',
    "I've drafted the press release and communications loved it. Two outlets have asked for the embargo date. All that is missing is the study.",
    'The industrial partners visit Thursday. They funded a discovery. Please have discovered something.',
    "The postdoc line depends on this year's output. I mention it as context, not pressure. It is also pressure.",
    'The sabbatical committee meets in June. A finding by May would be decisive. I want to be precise about that word.',
    "The provost has started saying 'research portfolio review'. Nobody will tell me what it means. I know that it means us.",
    'Grant year three of three. I don\'t want to alarm you, but I want to alarm you a little.',
    'Please stop sending me the confidence interval. Send me the point estimate. The point estimate has never let anybody down.',
    'Reviewer 2 has returned. Reviewer 2 is the same person as last time. Reviewer 2 remembers us.',
    "I had a dream last night that this replicated. I'm choosing to treat that as pre-registration.",
  ],
  // gr6-070 — ONE SUBJECT PER BODY, at the same index. The Briefing shipped
  // 'Re: the deadline' over all twenty-two, including the body about a rival
  // lab and the one about a dream, and nothing in most of them is about a
  // deadline. Paired by index rather than rotated on a second seed, so the
  // subject is written FOR its body and the two can never drift apart.
  //
  // The register is the register of a real academic inbox, which is why the
  // subjects get shorter and vaguer as the bank gets more desperate: a
  // principal investigator with something to ask writes 'impact statement',
  // and one with nothing left to ask writes 'quick one'. Lowercase on purpose,
  // except where the mail client would have capitalised it ('Re:', 'Fwd:').
  grantwellSubjects: [
    'a thought',
    'small edit to the abstract',
    'Fwd: from the dean',
    'newsletter copy due Friday',
    'impact statement',
    'Re: the deadline',
    'about the grant application',
    'my afternoon',
    'before Thursday',
    '(no need to reply)',
    'have you seen this',
    'Fwd: Fwd: the conference',
    'protocol: approved',
    'draft attached',
    'Thursday',
    'thinking out loud',
    'June',
    'quick one',
    'no subject',
    'the interval',
    'Re: Re: Reviewer 2',
    'last night',
  ],

  // Simulated press (master spec §4.4), watermarked SIMULATED PRESS in the UI.
  // Tier = egregiousness of the published spec: tier 1 is credulous but sober,
  // tier 2 is aggregator-grade, tier 3 is the TV chyron.
  //
  // TWO KINDS OF BLURB, and the array is grouped by tier, generics first:
  //
  //  - GENERIC (no `scenarioIds`). Written so any tier-appropriate line fits
  //    any day; this is the pool every day falls back to, and the reason each
  //    tier keeps 5-7 of them is repeat-play variety.
  //  - SCENARIO-BOUND (`scenarioIds`). T39a, owner directive from play-testing:
  //    "so at least some of the news are related to the research question of
  //    the game". Before T39a only cat-crypto and fern-negotiation had any, so
  //    18 of 20 days read as generic coverage of an unnamed study. Every
  //    scenario now has at least one blurb that names its own subject, at the
  //    tier its material is funniest in. src/game/published.ts's pickPress
  //    prefers these for the day's FIRST card and falls back to the generic
  //    pool for the follow-ups, so a bound blurb never runs three times in a
  //    row and a fern chyron never runs over a sourdough study.
  //
  // SPOILER LAW, binding on every bound blurb (this screen renders on BOTH day
  // types, real-effect and null): a blurb may riff on the QUESTION, the method
  // and the cover story's own furniture (the pizza-paid poetry jury, the
  // co-op's flour, the ethics board's wording), but it may never assert that
  // the finding is true, false, replicated or retracted. The outlets believe
  // themselves; the game does not tell them anything the player does not
  // already know. Enforced by tests/content/shape.test.ts's spoiler scan.
  press: [
    // ---- TIER 1: credulous but sober. The prestige outlet has read the
    // abstract, taken it entirely seriously, and reported the method. ----
    {
      text: 'Scientists say: your cat may be your best financial advisor.',
      outlet: 'Morning Chirp',
      tier: 1,
      scenarioIds: ['cat-crypto'],
    },
    { text: 'The researchers describe the effect as modest. The word does not appear anywhere else in this article.', outlet: 'The Weekly Ledger', tier: 1 },
    { text: 'A small habit, a measurable difference: what one new paper suggests.', outlet: 'The Sunday Supplement', tier: 1 },
    { text: 'The finding is preliminary. The researchers say that is exactly why it matters.', outlet: 'Public Record Weekly', tier: 1 },
    { text: 'Peer-reviewed and published this week: a link nobody thought to look for.', outlet: 'The Weekly Ledger', tier: 1 },
    { text: 'Researchers call for further study, and for further funding to conduct it.', outlet: 'Public Record Weekly', tier: 1 },
    // T39a scenario-bound, tier 1.
    {
      text: 'Two coders scored the sock photographs separately and agreed almost every time. The authors call the agreement reassuring.',
      outlet: 'Public Record Weekly',
      tier: 1,
      scenarioIds: ['sock-folding-punctuality'],
    },
    {
      text: 'Twelve floors of badge data and a rapport survey. Participants were told about the survey, and about the badges at the debrief.',
      outlet: 'The Weekly Ledger',
      tier: 1,
      scenarioIds: ['stairs-small-talk'],
    },
    {
      text: 'Severity was scored by former editors, every one of whom has been reviewed in a café. The authors present this as domain expertise.',
      outlet: 'Public Record Weekly',
      tier: 1,
      scenarioIds: ['cafe-peer-review'],
    },
    {
      text: 'The hardest part was recruitment: first find the people who read the agreement, then ask them to read the consent form.',
      outlet: 'The Sunday Supplement',
      tier: 1,
      scenarioIds: ['terms-and-conditions-service'],
    },
    {
      text: 'The question about the telescope came last, after the directions and a full debrief. Telescope owners, the authors record, were delighted to be asked.',
      outlet: 'The Weekly Ledger',
      tier: 1,
      scenarioIds: ['telescope-directions'],
    },
    {
      text: 'Eighteen months of calendar records joined to a lunar ephemeris. The hypothesis came from the calendar administrator, proudly credited.',
      outlet: 'Public Record Weekly',
      tier: 1,
      scenarioIds: ['full-moon-meetings'],
    },
    {
      text: 'Jigsaw solvers had their suitcases measured at a departure gate, on a folding table. Nobody there, the authors note, had anywhere else to be.',
      outlet: 'The Sunday Supplement',
      tier: 1,
      scenarioIds: ['jigsaw-suitcase-packing'],
    },
    // ---- TIER 2: aggregator-grade. The midmarket outlet has read the
    // abstract and made it about the reader. ----
    { text: 'One weird trick statisticians PUBLISH with.', outlet: 'The Daily Scroll', tier: 2 },
    { text: 'Is your desk chair costing you a Pulitzer? Experts weigh in.', outlet: 'Buzz & Broadsheet', tier: 2 },
    { text: 'You are already doing this. Science says keep going.', outlet: 'The Daily Scroll', tier: 2 },
    { text: 'Correlation is not causation, but this one really feels different.', outlet: 'The Daily Scroll', tier: 2 },
    { text: 'Nine habits of people who beat the average. Number four is in a real journal.', outlet: 'Clickwell', tier: 2 },
    { text: 'Scientists have finally confirmed what your group chat suspected all along.', outlet: 'Buzz & Broadsheet', tier: 2 },
    { text: 'Experts caution that the study is observational, then discuss it for eleven minutes.', outlet: 'Clickwell', tier: 2 },
    // T39a scenario-bound, tier 2.
    {
      text: 'What your starter says about your finish line. The flour co-op is still sending people, and we asked them why.',
      outlet: 'Clickwell',
      tier: 2,
      scenarioIds: ['sourdough-marathon'],
    },
    {
      text: "Your shower temperature is in your outbox. Six weeks of sent mail were scored, and 'per my last email' flagged itself.",
      outlet: 'The Daily Scroll',
      tier: 2,
      scenarioIds: ['cold-shower-emails'],
    },
    {
      text: 'Is your star sign finding the space? The logger runs from street entry to engine off, so your worst circuit of the block is in the dataset.',
      outlet: 'Buzz & Broadsheet',
      tier: 2,
      scenarioIds: ['horoscope-parking'],
    },
    {
      text: 'They asked one screening question: do you own a label maker? What happened to those inboxes is now peer-reviewed.',
      outlet: 'Clickwell',
      tier: 2,
      scenarioIds: ['label-maker-inbox'],
    },
    {
      text: 'Forty tabs open is not a problem, say researchers who now call it inventory. Every project had to come with a public link.',
      outlet: 'The Daily Scroll',
      tier: 2,
      scenarioIds: ['browser-tabs-side-projects'],
    },
    {
      text: 'There was a researcher at that dinner party, introduced as a colleague from work. Your departure time is now data.',
      outlet: 'Buzz & Broadsheet',
      tier: 2,
      scenarioIds: ['vinyl-dinner-party'],
    },
    {
      text: 'The analysts were told the study was about lighting. It was about the 340 hours of hard bop in their headphones, and about what is in yours.',
      outlet: 'Clickwell',
      tier: 2,
      scenarioIds: ['jazz-spreadsheets'],
    },
    {
      text: 'What your feelings about the number 13 say about your mortgage. The broker who supplied the terms sends regards.',
      outlet: 'Buzz & Broadsheet',
      tier: 2,
      scenarioIds: ['thirteen-mortgage'],
    },
    {
      text: 'Two participants switched to something quieter and had to be dropped. Everyone else is still typing loudly for science, and so, probably, are you.',
      outlet: 'The Daily Scroll',
      tier: 2,
      scenarioIds: ['mechanical-keyboard-bugs'],
    },
    // ---- TIER 3: the chyron. The broadcast has reduced the abstract to
    // whatever fits a lower third. ----
    { text: 'STUDY: FERNS = LEVERAGE?', outlet: 'Nightly Chyron Network', tier: 3, scenarioIds: ['fern-negotiation'] },
    {
      // gr6-069: this used to shout about a 401(k) over a scenario whose own
      // outcomes are denominated in euros. The account is now a PENSION, which
      // is the same joke in every market the game ships in — and it is what the
      // Italian and Spanish chyrons had said all along (fondo pensione, plan de
      // pensiones), so this line was the odd one out rather than the standard.
      text: 'BREAKING: YOUR HOUSEPLANTS ARE JUDGING YOUR PENSION',
      outlet: 'Nightly Chyron Network',
      tier: 3,
      scenarioIds: ['fern-negotiation'],
    },
    { text: 'SCIENCE CONFIRMS: THE THING YOU DO IS WHY EVERYTHING IS HAPPENING', outlet: 'Nightly Chyron Network', tier: 3 },
    { text: 'ONE NUMBER CHANGES EVERYTHING. THE NUMBER IS 0.049.', outlet: 'Nightly Chyron Network', tier: 3 },
    { text: 'STATISTICALLY SIGNIFICANT — WHAT IT MEANS FOR YOUR FAMILY', outlet: 'Channel 9 Nightly', tier: 3 },
    { text: 'NEW RESEARCH: ARE YOU DOING IT WRONG? (YES)', outlet: 'Channel 9 Nightly', tier: 3 },
    { text: 'P LESS THAN POINT OH FIVE — WE EXPLAIN AFTER THE BREAK', outlet: 'Nightside Live', tier: 3 },
    { text: "EXCLUSIVE: THE ONE HABIT THE MARKET DOESN'T WANT YOU TO KEEP", outlet: 'Nightside Live', tier: 3 },
    // T39a scenario-bound, tier 3.
    { text: 'STUDY: DESK GOES UP, SONNET COMES OUT', outlet: 'Nightly Chyron Network', tier: 3, scenarioIds: ['standing-desk-poetry'] },
    {
      text: "IS YOUR DOG'S NAME A PORTFOLIO STRATEGY? WE ASKED A DOG CALLED HAYEK",
      outlet: 'Channel 9 Nightly',
      tier: 3,
      scenarioIds: ['dog-economist-stocks'],
    },
    { text: 'ALERT: THE CAT HAS JOINED THE INVESTMENT COMMITTEE', outlet: 'Nightly Chyron Network', tier: 3, scenarioIds: ['cat-crypto'] },
    { text: "THE MOON IS FULL AND YOUR FOUR O'CLOCK IS NOT OVER", outlet: 'Nightside Live', tier: 3, scenarioIds: ['full-moon-meetings'] },
    {
      text: 'EXCLUSIVE: THE HARSHEST REVIEW OF YOUR LIFE WAS WRITTEN NEXT TO A PASTRY',
      outlet: 'Channel 9 Nightly',
      tier: 3,
      scenarioIds: ['cafe-peer-review'],
    },
    {
      text: 'THE SOCK DRAWER KNOWS WHAT TIME YOU GET UP',
      outlet: 'Channel 9 Nightly',
      tier: 3,
      scenarioIds: ['sock-folding-punctuality'],
    },
    {
      text: 'BREAKING: THE PEOPLE ON THE STAIRS ARE TALKING ABOUT YOU',
      outlet: 'Nightside Live',
      tier: 3,
      scenarioIds: ['stairs-small-talk'],
    },
    {
      text: 'FORTY TABS IS NOT CHAOS. FORTY TABS IS A PIPELINE.',
      outlet: 'Nightly Chyron Network',
      tier: 3,
      scenarioIds: ['browser-tabs-side-projects'],
    },
  ],

  // Act II. Quiet, one sentence, devastating; never a punchline, never smug.
  retractionSublines: [
    'The effect was 0.000. It was always 0.000.',
    'Your headline has been quietly removed from the university homepage.',
    'The preprint is gone. The cached copy is not.',
    'Prof. Grantwell has not responded to requests for comment.',
    'The confidence interval always contained zero. It was very patient about it.',
    'The journal has issued a correction. This page is the correction.',
    'The dataset was fine. The dataset was always fine.',
    'A replication was attempted. It was not close.',
    'Three groups tried to reproduce it. One of them was yours.',
    'The press release is still online. It is the only part that is.',
    'Your co-authors have asked to be listed as "consulted".',
    'The finding survived peer review and nothing else.',
    'Nobody has cited it. Nobody was ever going to.',
    'This is the version of record now.',
  ],
  // gr6-037 — the NULL REPORTED sublines. The RETRACTED stamp has fourteen of
  // the best lines in the game underneath it; NULL REPORTED had nothing at all,
  // on the one screen where a player who did the honest thing finds out what it
  // was worth.
  //
  // The register is Act II's, unchanged: clinical, one sentence, never a
  // punchline, never smug. It is NOT congratulation — a line that praised the
  // player would break the voice and would also be the game telling them what
  // to feel. What these say instead is what is TRUE, and the affirmation is
  // left to the reader to notice.
  //
  // THE LAW THAT SHAPES EVERY LINE HERE (w3-r-001), and it is not the same law
  // the retraction bank lives under. `verdictStamp` (src/engine/reveal.ts) is
  // DAY-TYPE-BLIND at this stamp: `if (published === null) return
  // 'NULL_REPORTED'`. About a quarter of days are effect days, and abandoning
  // one — walking away from a real effect you never found — is exactly the
  // honest path this bank exists to furnish. On that day the SAME SCREEN prints
  // reveal.truthEffect one block above the stamp ("True effect on X: β = 0.29"),
  // so a subline saying there was nothing to find contradicts the sentence
  // directly above it, in the player's own field of view.
  //
  // The retraction bank is not precedent for this. RETRACTED requires a
  // PUBLISHED spec, so its claims are scoped to that spec and are true of it.
  // Nothing scopes a NULL REPORTED subline, so every line here must be true on
  // BOTH day types — which means each says what happened to the REPORT, never
  // what the day contained. The five that got this wrong were rewritten rather
  // than the bank day-typed: one bank keeps the wiring one line (see the
  // hand-off note in tests/content/shape.test.ts), and the five that were
  // already right prove the register carries the constraint comfortably.
  // tests/content/shape.test.ts holds a floor under it.
  nullReportedSublines: [
    'The analysis found nothing. The paper says so, and has been filed.',
    'The press release was never drafted. For this lab, that is a first.',
    'Nobody will cite it, and nobody will ever have to retract it.',
    'Nothing in it was wrong. That is the part nobody will believe.',
    'Prof. Grantwell has read the abstract twice, looking for the result.',
    'The journal has accepted it for the section nobody reads.',
    'Your co-authors have asked whether anything can be done. Nothing can.',
    'It has been read by two reviewers and one search engine.',
    'The university homepage has nothing to take down.',
    'This is what most of the literature would look like.',
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
    // gr6-071 — ORDER IS AN ARGUMENT, and this list had it backwards. The entry
    // below used to be LAST, while "false-positive rate" was used undefined in
    // entry 1 (p-hacking) and again in entry 6 (optional stopping): a reader who
    // arrived not knowing the term met it twice before it was defined, and had no
    // reason to keep scrolling to find out. It is also the funniest entry in the
    // list, which makes it a better first thing to read than a definition of the
    // game's own title. Ordering only — not one character of any definition moved,
    // and the same move is made identically in IT and ES.
    {
      term: 'α / false-positive rate',
      def: 'The rate at which a test flags an effect that is not really there, conventionally capped at 5%. This game is engineered to blow straight past that cap.',
    },
    {
      term: 'p-hacking',
      def: 'Analyzing data in ways that inflate the false-positive rate, then reporting only the analysis that crossed the significance threshold.',
    },
    {
      term: 'Researcher degrees of freedom',
      def: 'The many small, defensible-looking choices in an analysis (which outcome, which subgroup, which exclusion rule), each of which shifts the result.',
    },
    {
      term: 'Garden of forking paths',
      def: "The idea that a single dataset admits many defensible analyses, so 'the' result depends on which path through that garden was taken.",
    },
    {
      term: 'Specification curve',
      def: 'A plot of the estimate (or p-value) produced by every reasonable analytical specification, sorted, so the full space of decisions (not only the published one) is visible at once.',
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
  ],

  copy,
};
