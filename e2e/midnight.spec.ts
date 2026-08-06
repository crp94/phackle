// w7-r-003 — THE MIDNIGHT ROLLOVER, WHICH HAD NO COVERAGE IN ANY TIER.
//
// `App.tsx`'s rollover effect is the one piece of this app that can DESTROY a
// player's day: it calls `boot()`, which is `set({ ...initialState(), … })`.
// It is gated to the single resting state where that is the right answer —
// the Briefing, with nothing yet done — and ignored everywhere else, so a
// player who is mid-hack at midnight finishes the day they started.
//
// Nothing held that gate in place. `grep -r 'visibilitychange\|ROLLOVER'
// tests/ e2e/` returned nothing before this file, and the effect is
// UNREACHABLE IN JSDOM by construction: `createEngineClient()`'s `new Worker`
// throws there, so `clientRef` is null and `checkRollover` returns on its
// first line. Only a real browser can see this code run at all. Measured by
// the reviewer: deleting the guard outright — so midnight wipes a half-hacked
// spec, an open reveal or a finished summary — left tsc 0, vitest 1698 and
// e2e 22/22 all green.
//
// Both halves are pinned here, because a one-sided test is worse than none:
// an effect that never fires would pass a "nothing was destroyed" assertion
// perfectly, and an effect that always fires would pass a "the new day
// arrives" one.
import { expect, test } from '@playwright/test';
import { FIXED_INSTANT_MS, PUZZLE_NUMBER, enterLab, openApp, turnKnobAndSettle, DEFAULT_SPEC } from './harness';

/** Move the page's pinned clock to `ms`. The harness installs its fixed clock
 * as a Proxy over the real `Date` in an init script, closing over the
 * instant; the clock cannot be re-pointed from outside, so this stacks a
 * second proxy with the new instant. `localIsoDate()` reads `new Date()`, so
 * this is exactly the input the rollover effect consults. */
async function setClock(page: import('@playwright/test').Page, ms: number): Promise<void> {
  await page.evaluate((fixedMs) => {
    const current = Date;
    globalThis.Date = new Proxy(current, {
      construct: (target, args) => Reflect.construct(target, args.length === 0 ? [fixedMs] : args),
      get: (target, prop, receiver) => (prop === 'now' ? () => fixedMs : Reflect.get(target, prop, receiver)),
    }) as DateConstructor;
  }, ms);
}

/** The rollover is checked on an interval AND on `visibilitychange`, and the
 * listener is the half that matters — a backgrounded tab's timers are
 * throttled, and "came back to it" is the moment a player actually returns.
 * Firing it directly is what makes this test take milliseconds instead of a
 * minute. */
async function returnToTab(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

/** 10:00 UTC the DAY AFTER the harness's pinned instant. */
const NEXT_DAY_MS = FIXED_INSTANT_MS + 24 * 3_600_000;

test('midnight does NOT take a day that is already being played (the destructive case)', async ({ page }) => {
  await openApp(page);
  await enterLab(page);

  // Real work on the board: a turned knob is a log entry AND a spec the
  // player chose, which is precisely what a re-boot would discard.
  await turnKnobAndSettle(page, 'tails', { ...DEFAULT_SPEC, tails: 'one' });
  const dialBefore = await page.locator('.ph-dial__value').innerText();
  const forksBefore = await page.locator('.ph-fork-trail').innerText();
  expect(forksBefore.trim(), 'the probe never actually turned a knob').not.toBe('');
  // Read BEFORE the rollover, so the comparison afterwards is against a
  // remembered value and not against whatever the page happens to say then.
  const oneTailed = page.getByRole('radio', { name: 'One-tailed' });
  await expect(oneTailed, 'the probe never actually selected the one-tailed option').toHaveAttribute(
    'aria-checked',
    'true',
  );

  await setClock(page, NEXT_DAY_MS);
  await returnToTab(page);

  // Give the effect every chance to run before asserting it did not.
  await page.waitForTimeout(250);

  await expect(
    page.locator('[data-testid="lab-screen"]'),
    'MIDNIGHT THREW AWAY A DAY IN PROGRESS: the player was returned to a fresh Briefing mid-hack.',
  ).toBeVisible();
  expect(await page.locator('.ph-dial__value').innerText(), 'the hacked p-value was reset').toBe(dialBefore);
  expect(await page.locator('.ph-fork-trail').innerText(), 'the fork trail was wiped').toBe(forksBefore);
  await expect(oneTailed, 'THE CHOSEN SPECIFICATION DID NOT SURVIVE THE ROLLOVER').toHaveAttribute(
    'aria-checked',
    'true',
  );
  // ...and the day itself is still the same day, which is the whole ruling:
  // a player mid-hack at midnight finishes the day they started.
  await expect(page.locator('.ph-header__vol')).toContainText(`No. ${PUZZLE_NUMBER}`);
});

test('midnight DOES bring the new day when nothing has been done yet (the case the effect exists for)', async ({
  page,
}) => {
  await openApp(page);

  // The one resting state where a re-boot is right: the Briefing, log empty.
  await expect(page.locator('.ph-header__vol')).toContainText(`No. ${PUZZLE_NUMBER}`);

  await setClock(page, NEXT_DAY_MS);
  await returnToTab(page);

  await expect(
    page.locator('.ph-header__vol'),
    'A TAB LEFT OPEN OVERNIGHT ON THE BRIEFING STILL SHOWS YESTERDAY: the rollover never fired, so ' +
      "the player is looking at yesterday's study, yesterday's email and a countdown that has " +
      'already elapsed.',
  ).toContainText(`No. ${PUZZLE_NUMBER + 1}`);
  await expect(page.locator('.ph-briefing')).toBeVisible();
});
