// T23 — CROSS-REALM DETERMINISM (master spec §3.1, §8.2, §8.5).
//
// The golden-master suite in tests/determinism/ regenerates the pipeline
// IN NODE and compares it to committed fixtures. That proves node agrees with
// node. It cannot prove the thing the player actually depends on: that the
// numbers computed inside the browser's WORKER realm — a realm jsdom has no
// way to reach, running code that went through Vite's production bundler,
// its minifier and its module graph — are the same numbers.
//
// These two tests close that gap from both sides:
//   1. browser vs browser, two fully isolated contexts, same fixed date;
//   2. browser vs NODE, comparing what the shipped UI renders against what
//      the engine computes right here in the test process.
//
// (2) is the plan's "cross-realm golden-hash check", taken off the real
// screen instead of out of a debug hook: the reveal's accounting paragraph
// reports `totalPaths` and `sigPaths` for the FULL 1792-spec enumeration the
// worker just performed, which is exactly the `sigCount200` field the
// committed golden fixtures pin. Nothing was added to the product to make
// this observable — the number is already on the page, in prose, because the
// game's whole argument depends on the player believing it.
import { expect, test } from '@playwright/test';
import { generateDay } from '../src/engine/day';
import { runSpec } from '../src/engine/analyze';
import { enumerateCurve, sigCount } from '../src/engine/specGrid';
import { content } from '../src/content/en/index';
import {
  DEFAULT_SPEC,
  PUZZLE_ISO,
  PUZZLE_NUMBER,
  SCENARIO_COUNT,
  enterLab,
  expectSpecOnScreen,
  installHarness,
  readDial,
  readQuestion,
  turnKnobAndSettle,
} from './harness';
import type { Spec } from '../src/engine/types';

// Computed once per worker process, in NODE, from the same source tree the
// browser bundle was built from.
const nodeDay = generateDay(PUZZLE_ISO, SCENARIO_COUNT);
const nodeScenarioIndex = Number(nodeDay.puzzle.scenarioId);
const nodeQuestion = content.scenarios[nodeScenarioIndex].question;

/** One knob off the default — the cheapest observable the Lab produces. */
const PINNED_SPEC: Spec = { ...DEFAULT_SPEC, tails: 'one' };

test('the same date yields the same puzzle in two isolated browser contexts, and the same p-value Node computes', async ({
  browser,
}) => {
  async function readPuzzleInFreshContext() {
    const context = await browser.newContext();
    await installHarness(context);
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('.ph-briefing')).toBeVisible();
    const masthead = (await page.locator('.ph-header__vol').innerText()).trim();

    // Read the question from the LAB, past the boot barrier — see enterLab.
    await enterLab(page);
    const question = await readQuestion(page);

    // One knob turn, then WAIT FOR THE NUMBER — not for the control. The Lab
    // debounces the worker dispatch by DEBOUNCE_MS, so the radio flips to
    // one-tailed a third of a second before the dial catches up, and reading
    // it any earlier reads the previous spec's p-value.
    await turnKnobAndSettle(page, 'tails', PINNED_SPEC);
    await expectSpecOnScreen(page, PINNED_SPEC);
    await expect(page.locator('[data-testid="pvalue-dial"]')).toHaveAttribute('aria-busy', 'false');
    const dial = await readDial(page);
    const meta = (await page.locator('.ph-dial__meta').innerText()).trim();

    await context.close();
    return { question, masthead, dial, meta };
  }

  const first = await readPuzzleInFreshContext();
  const second = await readPuzzleInFreshContext();

  expect(
    second,
    'THE DAILY PUZZLE IS NOT DETERMINISTIC: two players opening the same date in two clean browsers ' +
      'were shown different puzzles. The whole premise of a daily game is that everyone gets the ' +
      'same one.',
  ).toEqual(first);

  // ...and it is the puzzle NODE says it should be.
  expect(
    first.question,
    "THE BROWSER PICKED A DIFFERENT SCENARIO THAN THE ENGINE: the worker's scenario selection has " +
      'drifted from the seeded index the engine computes for this date.',
  ).toBe(nodeQuestion);

  expect(
    first.masthead,
    `THE MASTHEAD IS ON THE WRONG ISSUE: ${PUZZLE_ISO} is puzzle #${PUZZLE_NUMBER} counting from EPOCH.`,
  ).toContain(String(PUZZLE_NUMBER));

  const nodeResult = runSpec(nodeDay.data, PINNED_SPEC, 200);
  expect(
    first.dial,
    'THE DIAL DISAGREES WITH THE ENGINE: the p-value rendered by the production bundle in the ' +
      "browser's worker realm is not the p-value the same spec produces in Node. One of the two " +
      'realms has drifted — which means the game is showing the player a number the golden-master ' +
      'suite is not guarding.',
  ).toBe(`p = ${nodeResult.p.toFixed(3)}`);

  expect(first.meta, 'THE DIAL IS REPORTING THE WRONG SAMPLE SIZE.').toContain(String(nodeResult.n));
});

test("the reveal's accounting reports the same full-curve enumeration Node computes", async ({ page }) => {
  await installHarness(page.context());
  await page.goto('/');

  // The shortest honest route to a reveal: open the data, report a null
  // result, make the call. No extends, so the worker enumerates at N = 200 —
  // exactly the window the committed golden fixtures pin `sigCount200` at.
  await expect(page.locator('.ph-briefing')).toBeVisible();
  await enterLab(page);
  await page.locator('.ph-lab__abandon').click();
  await expect(page.locator('.ph-call')).toBeVisible();
  await page.locator('.ph-call__option').first().click();
  await expect(page.locator('.ph-reveal')).toBeVisible();

  const figures = page.locator('.ph-reveal__accounting .ph-reveal__statement').first().locator('.ph-num');
  const [total, sig] = [await figures.nth(0).innerText(), await figures.nth(1).innerText()];

  const nodeCurve = enumerateCurve(nodeDay.data, 200);

  expect(
    Number(total),
    'THE REVEAL IS COUNTING A DIFFERENT GARDEN: the number of possible analyses the built app ' +
      'enumerated in the worker does not match the spec grid Node enumerates.',
  ).toBe(nodeCurve.length);

  expect(
    Number(sig),
    'THE REVEAL IS REPORTING A DIFFERENT NUMBER OF SIGNIFICANT PATHS THAN THE ENGINE PRODUCES. ' +
      "This is the game's central factual claim — the sentence the whole lesson rests on — computed " +
      'in a realm the jsdom suite cannot reach.',
  ).toBe(sigCount(nodeCurve));
});
