import { describe, expect, it } from 'vitest';
import { content as enContent } from '../../src/content/en';
import { JOURNALS } from '../../src/content/journals';
import type { LocaleContent } from '../../src/content/types';

// T6 raises MIN_SCENARIOS to 20 (the full corpus lands there); grantwell and
// journals thresholds are already at their final v1 values.
const MIN_SCENARIOS = 2;
// T6 raises to 20: const MIN_SCENARIOS = 20;
const MIN_GRANTWELL = 12;
const MIN_JOURNALS = 15;

/**
 * Structural + cross-reference validation for a LocaleContent object.
 * Reused as-is by the IT/ES shape tests in T19/T20, which additionally pass
 * `referenceIds` (the English scenario id order) to confirm every locale
 * ships the same scenarios, in the same order, under the same ids.
 */
export function validateLocaleContent(content: LocaleContent, referenceIds?: string[]): string[] {
  const problems: string[] = [];

  if (content.scenarios.length < MIN_SCENARIOS) {
    problems.push(`expected >= ${MIN_SCENARIOS} scenarios, got ${content.scenarios.length}`);
  }
  if (content.grantwell.length < MIN_GRANTWELL) {
    problems.push(`expected >= ${MIN_GRANTWELL} grantwell emails, got ${content.grantwell.length}`);
  }
  if (JOURNALS.length < MIN_JOURNALS) {
    problems.push(`expected >= ${MIN_JOURNALS} journals in the shared pool, got ${JOURNALS.length}`);
  }

  const ids = content.scenarios.map((s) => s.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    problems.push(`scenario ids are not unique: ${[...new Set(duplicates)].join(', ')}`);
  }

  if (referenceIds) {
    const sameOrder = ids.length === referenceIds.length && ids.every((id, i) => id === referenceIds[i]);
    if (!sameOrder) {
      problems.push(
        `scenario ids/order do not match the reference locale: expected [${referenceIds.join(', ')}], got [${ids.join(', ')}]`
      );
    }
  }

  const allJournalTags = new Set(JOURNALS.flatMap((j) => j.tags));
  for (const scenario of content.scenarios) {
    for (const tag of scenario.journalTags) {
      if (!allJournalTags.has(tag)) {
        problems.push(`scenario "${scenario.id}" uses journalTag "${tag}" that no journal in JOURNALS carries`);
      }
    }

    if (scenario.outcomeLabels.length !== 4 || scenario.outcomeLabels.some((label) => label.trim().length === 0)) {
      problems.push(`scenario "${scenario.id}" must have exactly 4 non-empty outcomeLabels`);
    }
    if (scenario.outcomeUnits.length !== 4 || scenario.outcomeUnits.some((unit) => unit.trim().length === 0)) {
      problems.push(`scenario "${scenario.id}" must have exactly 4 non-empty outcomeUnits`);
    }

    if (!scenario.question.trim().endsWith('?')) {
      problems.push(`scenario "${scenario.id}" question must end in "?": "${scenario.question}"`);
    }
  }

  return problems;
}

describe('validateLocaleContent', () => {
  it('reports no problems for the English content', () => {
    expect(validateLocaleContent(enContent)).toEqual([]);
  });

  it('passes when referenceIds matches the content ids and order', () => {
    const ids = enContent.scenarios.map((s) => s.id);
    expect(validateLocaleContent(enContent, ids)).toEqual([]);
  });

  it('flags a referenceIds mismatch', () => {
    const problems = validateLocaleContent(enContent, ['not-a-real-id']);
    expect(problems.some((p) => p.includes('reference locale'))).toBe(true);
  });

  it('flags too few scenarios', () => {
    const broken: LocaleContent = { ...enContent, scenarios: enContent.scenarios.slice(0, 1) };
    expect(validateLocaleContent(broken).some((p) => p.includes('scenarios'))).toBe(true);
  });

  it('flags too few grantwell emails', () => {
    const broken: LocaleContent = { ...enContent, grantwell: enContent.grantwell.slice(0, 1) };
    expect(validateLocaleContent(broken).some((p) => p.includes('grantwell'))).toBe(true);
  });

  it('flags a duplicate scenario id', () => {
    const [first] = enContent.scenarios;
    const broken: LocaleContent = { ...enContent, scenarios: [first, first] };
    expect(validateLocaleContent(broken).some((p) => p.includes('unique'))).toBe(true);
  });

  it('flags a journalTag that no journal carries', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], journalTags: ['not-a-real-tag'] }, ...enContent.scenarios.slice(1)],
    };
    expect(validateLocaleContent(broken).some((p) => p.includes('journalTag'))).toBe(true);
  });

  it('flags a scenario missing an outcome label', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [
        { ...enContent.scenarios[0], outcomeLabels: ['a', 'b', 'c', ''] as [string, string, string, string] },
        ...enContent.scenarios.slice(1),
      ],
    };
    expect(validateLocaleContent(broken).some((p) => p.includes('outcomeLabels'))).toBe(true);
  });

  it('flags a question that does not end in "?"', () => {
    const broken: LocaleContent = {
      ...enContent,
      scenarios: [{ ...enContent.scenarios[0], question: 'This is not a question.' }, ...enContent.scenarios.slice(1)],
    };
    expect(validateLocaleContent(broken).some((p) => p.includes('question'))).toBe(true);
  });
});
