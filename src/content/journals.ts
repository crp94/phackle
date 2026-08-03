// The fake journal pool (master spec §4.3). Journal mastheads stay ENGLISH in
// every locale by design (delta spec, i18n §5) — verisimilitude: that is where
// Italian and Spanish academics publish too. Do not move this into src/content/en/.
//
// `tags` is the vocabulary a Scenario's `journalTags` draws from (see
// src/content/types.ts). A tag only needs to appear on *some* journal in this
// pool, not on every journal a scenario could plausibly land in — matching /
// weighting scenarios to specific journals at render time is a later task's
// concern, not this contract's.
export const JOURNALS: { name: string; tags: string[] }[] = [
  // Verbatim from the master spec's example pool.
  { name: 'Nature Feline Finance', tags: ['pets', 'finance'] },
  { name: 'The Lancet of Lifestyle Optimization', tags: ['lifestyle', 'wellness'] },
  { name: 'Journal of Irreproducible Portfolio Science', tags: ['finance', 'general'] },
  // Lowercase "findings" is the master spec's spelling (§4.3) and the joke: the
  // Academy is suspicious, the findings are merely lowercase. Do not "fix" it.
  { name: 'PNAS: Proceedings of the National Academy of Suspicious findings', tags: ['general'] },
  { name: 'Annals of Statistical Ambition', tags: ['general'] },
  { name: 'Cell (Spreadsheet)', tags: ['productivity', 'workplace', 'technology'] },
  // Authored to reach the >= 15 pool the brief calls for, same register.
  { name: 'The Journal of Marginal Gains', tags: ['fitness', 'productivity'] },
  { name: 'Quarterly Review of Overfit Hypotheses', tags: ['general'] },
  { name: 'Workplace & Wellbeing Quarterly', tags: ['workplace', 'wellness'] },
  { name: 'The International Journal of Coincidental Correlation', tags: ['general'] },
  { name: 'Frontiers in Speculative Physiology', tags: ['wellness', 'fitness'] },
  { name: 'Proceedings of the Society for Applied Vibes', tags: ['lifestyle', 'superstition'] },
  { name: 'Comparative Studies in Household Botany', tags: ['nature', 'lifestyle'] },
  { name: 'The Journal of Applied Numerology', tags: ['superstition', 'finance'] },
  { name: 'Acta Ergonomica et Absurda', tags: ['workplace', 'technology'] },
  { name: 'The Quarterly Gazette of Creative Output', tags: ['creative', 'music'] },
  { name: 'Annals of Domestic Astronomy', tags: ['astronomy', 'nature'] },
  { name: 'Journal of Applied Small Talk & Communication', tags: ['communication', 'workplace'] },
];
