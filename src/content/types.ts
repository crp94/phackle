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
  headline: string; // published-paper headline; may contain a literal "{n}" token, or none
  outcomeLabels: [string, string, string, string]; // index = Outcome; order: heavy-tailed, skewed, count, bounded scale
  outcomeUnits: [string, string, string, string];
  covariateLabels: { income: string; risk: string };
  journalTags: string[]; // subset of the tags used across JOURNALS (src/content/journals.ts)
}

export interface PressBlurb {
  text: string;
  outlet: string;
  tier: 1 | 2 | 3;
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
  scenarios: Scenario[]; // >= 20 in v1 (>= 2 until T6 lands the full corpus); same ids+order in every locale
  grantwell: string[]; // >= 12, Prof. Grantwell's escalating-desperation email bank
  press: PressBlurb[];
  retractionSublines: string[];
  achievements: Record<AchievementId, { name: string; citation: string }>;
  glossary: { term: string; def: string }[];
  copy: Record<CopyKey, string>;
}
