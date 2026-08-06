// Content contracts (master spec §4; delta spec i18n §3). The engine never
// imports anything from here (enforced by eslint.config.js's no-restricted-imports
// rule on src/engine/**) — content is data, consumed only by src/i18n and the UI.
//
// CopyKey is defined in ./en/copy.ts (English is the source-of-truth locale for
// the *set* of valid keys); every locale's `copy` field is typed against that
// same union, so an untranslated key is a compile error in that locale's module.
import type { CopyKey } from './en/copy';

export interface Scenario {
  id: string; // slug, identical across locales
  question: string; // must end in "?"
  coverStory: string; // one paragraph, Act I sincere register
  treatmentLabel: string; // e.g. "Owns a cat"
  // Published-paper headline. May carry at most one "{effect}" token — the
  // published spec's treatment effect — or none. Never "{n}": the copy catalog
  // binds that to sample size (lab.nLabel, lab.collectMore).
  //
  // gr6-005: every shipped headline now carries NONE. The raw-unit effect
  // rounded to 1 on 71,680 of 71,680 measured paths, and the fixed frame could
  // not honour a number whose units the player picks at run time. The type
  // still permits the token because the contract has not changed; the corpus
  // no longer uses it, and tests/content/shape.test.ts pins that. See
  // src/content/en/index.ts rule 5 for the measurement and for the one
  // condition under which a headline may carry a number again.
  headline: string;
  outcomeLabels: [string, string, string, string]; // index = Outcome; order: heavy-tailed, skewed, count, bounded scale
  outcomeUnits: [string, string, string, string];
  covariateLabels: { income: string; risk: string };
  journalTags: string[]; // subset of the tags used across JOURNALS (src/content/journals.ts)
}

export interface PressBlurb {
  text: string;
  outlet: string;
  tier: 1 | 2 | 3;
  // Optional scenario binding. Most blurbs are written scenario-agnostically so
  // any tier-appropriate line fits any day; the few that name a specific
  // scenario's subject ("your cat...", "FERNS = LEVERAGE?") list the scenario
  // ids they are true of. The Published screen prefers a blurb bound to today's
  // scenario and falls back to the untagged pool — absent this field, a fern
  // chyron could run over a sourdough study.
  scenarioIds?: string[];
}

export type AchievementId =
  | 'first_blood'
  | 'first_retraction'
  | 'harking'
  | 'one_tailed_bandit'
  | 'outlier_surgeon'
  | 'subgroup_safari'
  | 'one_more_batch'
  | 'garden'
  | 'monk'
  | 'well_actually'
  | 'true_detective';

export interface LocaleContent {
  scenarios: Scenario[]; // >= 20 in v1; same ids+order in every locale
  grantwell: string[]; // >= 12, Prof. Grantwell's escalating-desperation email bank
  // gr6-070: the subject line for the body at the SAME INDEX. One subject was
  // shipped for all twenty-two bodies ("Re: the deadline" over a body about a
  // rival lab), and a bank rotated on its own seed would have paired them at
  // random; index-pairing makes every subject written FOR its body, and the
  // pairing correct by construction rather than by a second hash. Same length
  // as `grantwell`, enforced in tests/content/shape.test.ts.
  grantwellSubjects: string[];
  press: PressBlurb[];
  retractionSublines: string[]; // rendered under the RETRACTED stamp
  // gr6-037: the same job for NULL_REPORTED days, which rendered with NO
  // subline at all — Act II's quietest moment and, until this bank, its
  // emptiest. Same register as retractionSublines (clinical, one sentence,
  // never smug, never congratulatory): the affirmation an honest null deserves
  // has to be carried by a fact about the world, not by a compliment.
  nullReportedSublines: string[];
  achievements: Record<AchievementId, { name: string; citation: string }>;
  glossary: { term: string; def: string }[];
  copy: Record<CopyKey, string>;
}
