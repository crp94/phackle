// Typed interpolation helper (delta spec i18n §4: "no i18n library... a small
// typed t(key, params) interpolation helper (~20 lines) is sufficient").
import type { CopyKey } from '../content/en/copy';

/**
 * Looks up `key` in `copy` and substitutes any `{param}` tokens from `params`.
 * A token with no matching param is left visible verbatim (e.g. `{minutes}`),
 * rather than silently disappearing or throwing, so a missed param is obvious
 * on screen instead of hidden in a log. A key absent from `copy` is
 * unreachable under the `Record<CopyKey, string>` contract at the type level;
 * at runtime (e.g. a caller that bypassed the type with a cast) it falls back
 * to returning the key itself rather than throwing or rendering "undefined".
 */
/**
 * The BOUND signature — `t(key, params)` with the copy record already closed
 * over. This is what `useLocale()` hands every component (LocaleProvider.tsx
 * builds it from the raw `t` below), and what a prop-driven presentational
 * component asks for when it wants to render copy without reaching for the
 * context itself.
 *
 * gr6-082: this type was re-declared, character-identical, in six separate
 * screen files. Hoisted here — beside the function whose partial application
 * it describes — so the app has ONE name for it and a future change to the
 * params shape is a single edit instead of a six-file sweep.
 */
export type TFunction = (key: CopyKey, params?: Record<string, string | number>) => string;

export function t(copy: Record<CopyKey, string>, key: CopyKey, params?: Record<string, string | number>): string {
  const template = copy[key];
  if (template === undefined) return key;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token
  );
}
