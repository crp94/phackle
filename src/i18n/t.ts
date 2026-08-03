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
export function t(copy: Record<CopyKey, string>, key: CopyKey, params?: Record<string, string | number>): string {
  const template = copy[key];
  if (template === undefined) return key;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token
  );
}
