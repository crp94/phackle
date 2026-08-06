### Task T4: i18n layer + content contracts + EN copy catalog skeleton

**Files:** Create `src/i18n/locale.ts`, `src/i18n/t.ts`, `src/i18n/LocaleProvider.tsx`, `src/content/types.ts`, `src/content/journals.ts`, `src/content/index.ts`, `src/content/en/copy.ts`, `src/content/en/index.ts`; Test `tests/i18n/locale.test.ts`, `tests/content/shape.test.ts`
**Depends:** T1. **Specs:** delta spec (i18n §), master §4.

**Interfaces (produces):**
```ts
// src/content/types.ts
export interface Scenario {
  id: string;                                  // slug, identical across locales
  question: string; coverStory: string;        // coverStory: one paragraph
  treatmentLabel: string;                      // e.g. "Owns a cat"
  headline: string;                            // published-paper headline, supports {n} none
  outcomeLabels: [string, string, string, string];  // index = Outcome; order: heavy-tailed, skewed, count, bounded scale
  outcomeUnits: [string, string, string, string];
  covariateLabels: { income: string; risk: string };
  journalTags: string[];                       // ⊆ tags used in journals.ts
}
export interface PressBlurb { text: string; outlet: string; tier: 1 | 2 | 3 }
export type AchievementId = 'first_blood' | 'first_retraction' | 'harking' | 'one_tailed_bandit'
  | 'outlier_surgeon' | 'subgroup_safari' | 'one_more_batch' | 'garden' | 'monk' | 'well_actually' | 'true_detective';
export interface LocaleContent {
  scenarios: Scenario[];                       // ≥20, same ids+order in every locale
  grantwell: string[];                         // ≥12
  press: PressBlurb[]; retractionSublines: string[];
  achievements: Record<AchievementId, { name: string; citation: string }>;
  glossary: { term: string; def: string }[];
  copy: Record<CopyKey, string>;
}
// src/content/en/copy.ts defines: export type CopyKey = /* union of key literals */
// Initial groups (~70 keys; UI tasks T14–T18 may ADD keys — update the union + en/copy.ts; IT/ES filled in T19/T20):
// nav.*, briefing.{openData,correspondingAuthor,vol}, lab.{outcome,subgroup,covariates,exclusion,transform,tails,
// submit,reportNull,nLabel,collectMore,peekFootnote,insufficient}, published.{faceTruth,simulatedPress,editorsPick,doiPrefix},
// call.{title,real,noise,prompt}, reveal.{truthNull,truthEffect,curveCaption,groupedCaption,accounting1,accounting2,
// accounting3,peekSurcharge,retracted,replicated,nullReported,callCorrect,callIncorrect}, summary.{score,share,copied,
// nextIn,streak,playPrereg}, prereg.{title,commit,locked}, stats.*, about.*, legend.*, errors.{workerCrash,storageOff},
// a11y.* — with {param} interpolation via t().
export function detectLocale(navLang: string | undefined, stored: Locale | null): Locale; // prefix match it/es → else 'en'
export function t(copy: Record<CopyKey, string>, key: CopyKey, params?: Record<string, string | number>): string;
export const AVAILABLE_LOCALES: Locale[];      // starts ['en']; T19/T20 append 'it'/'es'
export function getContent(locale: Locale): Promise<LocaleContent>;  // dynamic import; it/es alias en until T19/T20 land
// LocaleProvider.tsx: <LocaleProvider> + useLocale(): { locale, setLocale, content, copy, t: (key, params?) => string }
// journals.ts (shared, English in ALL locales): export const JOURNALS: { name: string; tags: string[] }[]  // ≥15, from §4.3
```

**Steps:**
- [ ] **RED**: `locale.test.ts` — detect('it-IT', null)='it', ('es-MX')='es', ('fr-FR')='en', stored wins over nav; `t()` interpolates `{n}` and leaves unknown params visible; missing-key returns key (type-level this can't happen — test via cast). `shape.test.ts` — exports a reusable `validateLocaleContent(c, referenceIds?)` used again in T19/T20: counts (≥20 scenarios / ≥12 grantwell / ≥15 journals), unique scenario ids, every journalTag exists in JOURNALS tags, every scenario has 4 labels+units, question ends in `?`.
- [ ] **Verify fail** → **GREEN** (en/copy.ts English strings for the initial ~70 keys; en scenarios placeholder-free but only 2 real scenarios here — full 20 arrive in T6, so `validateLocaleContent` count assertions are `>= 2` until T6 flips them to `>= 20`; leave the flip line commented with `T6 raises to 20` marker) → **Verify pass** → **Commit** `feat: i18n layer, locale detection, typed trilingual content contracts`.

---

