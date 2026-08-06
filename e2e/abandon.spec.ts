// T23 — FLOW C: the honest day (master spec §2.6, §2.7).
//
// Report a null result and take the call anyway. §2.6 is explicit that
// "players who abandoned also make the call", and this is the one place the
// Call renders as a WHOLE PAGE rather than as a modal over the Published
// cover — the same component, a different container, and a path with no
// celebration screen in it at all.
//
// DEVIATION FROM THE TASK BRIEF, stated plainly. The brief describes this
// flow as "lab -> report null -> published(abandoned variant) -> call-as-page".
// The store has no such step: `abandon()` sets `published: null` and moves
// `screen` straight to `'call'` (src/game/store.ts), so there is no Published
// screen on this path in any variant. The test asserts what the machine
// actually does — and asserts the ABSENCE of a Published screen explicitly,
// so if a published-on-abandon variant is ever introduced this test says so
// rather than silently passing.
import { expect, test } from '@playwright/test';
import { PUZZLE_NUMBER, SHARE_LINE2, enterLab, openApp, readClipboard } from './harness';

test('an abandoned day: report a null result, call as a full page, and reveal without a publication', async ({
  page,
}) => {
  await openApp(page);

  await enterLab(page);
  await page.locator('.ph-lab__abandon').click();

  // --- THE CALL, as the whole page ----------------------------------------
  const call = page.locator('.ph-call');
  await expect(
    call,
    'REPORTING A NULL RESULT WENT NOWHERE: §2.6 still owes the player the call.',
  ).toBeVisible();
  await expect(
    page.locator('.ph-call-overlay'),
    'THE ABANDON PATH RENDERED THE CALL AS A MODAL: there is no cover to dim on this path — the ' +
      'call is the page.',
  ).toHaveCount(0);
  await expect(
    page.locator('.ph-published'),
    'AN ABANDONED DAY GOT A CELEBRATION: nothing was published, so there is nothing to celebrate.',
  ).toHaveCount(0);
  await expect(call.locator('.ph-call__option')).toHaveCount(2);

  await call.locator('.ph-call__option').nth(1).click();

  // --- REVEAL, in its abandoned form ---------------------------------------
  await expect(page.locator('.ph-reveal')).toBeVisible();
  await expect(
    page.locator('[data-role="published-recipe"]'),
    'THE REVEAL NAMED A PUBLISHED RECIPE ON A DAY NOTHING WAS PUBLISHED.',
  ).toHaveCount(0);
  await expect(page.locator('[data-block="truth"] .ph-reveal__truth')).not.toBeEmpty();
  await expect(
    page.locator('[data-block="call"] .ph-reveal__statement'),
    'THE CALL WAS NEVER RESOLVED: an abandoner still made a call and is still owed the answer.',
  ).toHaveCount(1);

  const stampBlock = page.locator('[data-block="stamp"]');
  await stampBlock.scrollIntoViewIfNeeded();
  await expect(stampBlock).toHaveClass(/ph-entered/);
  await expect(page.locator('.ph-stamp__label')).not.toBeEmpty();

  await page.locator('[data-role="to-summary"]').click();

  // --- SUMMARY -------------------------------------------------------------
  await expect(page.locator('.ph-summary')).toBeVisible();
  await expect(page.locator('[data-testid="invoice-row-value"]')).not.toHaveCount(0);
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
    'THE ABANDON TERMINAL IS MISSING: a day that reported a null result must end its trail in 🏳️, ' +
      'never the 📄 a publication earns.',
  ).toMatch(/^🏳️ → ⚖️(✅|❌)$/u);
  expect(lines[2], 'SHARE LINE 3 IS NOT THE LABELLED FORK/STREAK LINE.').toMatch(/^Forks: 0 · Streak: \d+$/);
});
