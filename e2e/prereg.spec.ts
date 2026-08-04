// T23 — FLOW B: a preregistration day (master spec §2.6, §2.8, §7.3).
//
// The shape of this flow is the lesson: you commit to one specification
// before you are allowed to see a single number, the game runs it once at
// full power, and there is NO CALL STEP at all — §2.8 replaces the call with
// the prereg score rows, because there is nothing left to be shrewd about.
import { expect, test } from '@playwright/test';
import { PUZZLE_NUMBER, SHARE_LINE2, openApp, readClipboard } from './harness';

test('a preregistration day: choose the mode, commit blind, and land straight on the reveal with no call', async ({
  page,
}) => {
  // Prereg Mode is unlocked by having been retracted once. Seeded rather than
  // earned so this flow is one day long, not two.
  await openApp(page, { achievements: { first_retraction: '2026-08-13' } });

  // --- BRIEFING: the mode chooser (§2.2) -----------------------------------
  const chooser = page.locator('[data-testid="mode-chooser"]');
  await expect(
    chooser,
    'PREREG MODE NEVER APPEARED: first_retraction is unlocked in storage and the Briefing still ' +
      'offers no choice of mode.',
  ).toBeVisible();
  const options = chooser.locator('.ph-briefing__cta');
  await expect(options).toHaveCount(2);
  await options.nth(1).click();

  // --- PREREG (§7.3): a filing, not a workbench ----------------------------
  const prereg = page.locator('[data-testid="prereg-screen"]');
  await expect(prereg).toBeVisible();
  await expect(
    page.locator('[data-testid="pvalue-dial"]'),
    'THE PREREG SCREEN IS SHOWING A p-VALUE: the entire α lesson depends on the player being unable ' +
      'to see a number before committing.',
  ).toHaveCount(0);
  await expect(page.locator('.ph-spec-controls')).toBeVisible();

  const submit = page.locator('.ph-prereg__submit');
  await expect(
    submit,
    'A PREREGISTRATION COULD BE FILED WITHOUT THE COMMITMENT: the "I solemnly commit" checkbox is ' +
      'not gating the button.',
  ).toBeDisabled();

  await page.locator('.ph-prereg__commit input[type="checkbox"]').check();
  await expect(submit).toBeEnabled();
  await submit.click();

  // --- REVEAL, reached DIRECTLY (§2.8: no call step) -----------------------
  await expect(
    page.locator('.ph-reveal'),
    'THE PREREG COMMIT WENT NOWHERE: committing must run the specification once at full power and ' +
      'land on the reveal.',
  ).toBeVisible();
  await expect(
    page.locator('.ph-call'),
    'A PREREGISTRATION DAY ASKED FOR A CALL: §2.8 has no call step in Prereg Mode — there is nothing ' +
      'to guess once the specification was fixed in advance.',
  ).toHaveCount(0);
  await expect(
    page.locator('[data-block="call"] .ph-reveal__statement'),
    'THE REVEAL RESOLVED A CALL THAT WAS NEVER MADE.',
  ).toHaveCount(0);
  await expect(page.locator('.ph-stamp__label')).not.toBeEmpty();

  await page.locator('[data-role="to-summary"]').click();

  // --- SUMMARY: the prereg share grid (§2.9) -------------------------------
  await expect(page.locator('.ph-summary')).toBeVisible();
  await page.locator('.ph-summary__share-button').click();
  await expect(page.locator('.ph-summary__toast')).toBeVisible();

  const written = await readClipboard(page);
  expect(written, 'THE SHARE BUTTON WROTE NOTHING TO THE CLIPBOARD.').toHaveLength(1);
  const lines = written[0].split('\n');

  expect(lines, `THE SHARE GRID IS NOT 4 LINES (§2.9). Got:\n${written[0]}`).toHaveLength(4);
  expect(lines[0]).toBe(`P-hackle #${PUZZLE_NUMBER}`);
  expect(lines[1], `SHARE LINE 2 IS NOT A LEGAL §2.9 TRAIL: "${lines[1]}"`).toMatch(SHARE_LINE2);
  expect(
    lines[1],
    'THE PREREG PREFIX IS MISSING: a preregistered day must announce itself with 🧾 — that is the ' +
      'whole point of sharing one.',
  ).toMatch(/^🧾/u);
  expect(
    lines[1],
    'THE PREREG TERMINAL IS WRONG: a preregistration is always run and always reported, so the ' +
      'trail always ends in 📄 — never a flag, and never a glyph derived from significance.',
  ).toMatch(/📄$/u);
  expect(
    lines[1],
    'A PREREGISTRATION DAY SHIPPED A CALL MARK: no call was ever made, so ⚖️ cannot appear. ' +
      '(Coercing a null callCorrect to false is exactly how every prereg day used to read as a ' +
      'wrong call.)',
  ).not.toContain('⚖️');
});
