// T23 — FLOW A: a whole hacking day, end to end, in the production build.
//
// Briefing -> Lab -> hack to significance -> Publish -> Face the truth ->
// Call -> Reveal -> Summary -> Share. One test, because it is one day: the
// state it walks through only exists as the consequence of the step before
// it, and re-driving it per assertion would triple the runtime to prove
// nothing extra.
import { expect, test } from '@playwright/test';
import { content } from '../src/content/en/index';
import { copy as enCopy } from '../src/content/en/copy';
import { SITE_URL } from '../src/game/share';
import {
  PUZZLE_NUMBER,
  SHARE_LINE1_PREFIX,
  SHARE_LINE2,
  enterLab,
  hackUntilPublishable,
  openApp,
  readClipboard,
  readQuestion,
} from './harness';

test('a full hacking day: hack to p < .05, publish, call, reveal, and share a spoiler-safe result', async ({
  page,
}) => {
  await openApp(page);

  // --- BRIEFING (§2.3) -----------------------------------------------------
  await expect(page.locator('.ph-briefing__question')).not.toBeEmpty();
  await expect(page.locator('[data-testid="briefing-goal"]')).not.toBeEmpty();
  await expect(page.locator('.ph-email__body'), "PROF. GRANTWELL'S EMAIL IS MISSING FROM THE BRIEFING.").not.toBeEmpty();
  await expect(
    page.locator('[data-testid="mode-chooser"]'),
    'THE MODE CHOOSER LEAKED: Prereg Mode is gated on having completed a day (§1(j)(1)), and this ' +
      'browser has never played one.',
  ).toHaveCount(0);

  // --- LAB (§2.4) — the real bounded search --------------------------------
  await enterLab(page);

  // Identified past the boot barrier (see harness.enterLab / FINDING F2): the
  // Briefing renders scenario #0's material until `client.init` lands, so
  // reading the day's identity there would pick the wrong study.
  const question = await readQuestion(page);
  const scenario = content.scenarios.find((s) => s.question === question);
  expect(
    scenario,
    `THE GAME IS SHOWING A QUESTION THAT IS NOT IN THE CONTENT BANK ("${question}"): the scenario ` +
      'index the engine chose does not address a real scenario.',
  ).toBeDefined();

  await expect(
    page.locator('.ph-lab__submit'),
    'THE GAME OPENED ALREADY WON: SUBMIT is enabled on the untouched default specification, so ' +
      'there is no hacking left to do.',
  ).toBeDisabled();

  const hack = await hackUntilPublishable(page);
  expect(hack.dial, 'THE DIAL IS NOT SHOWING A PUBLISHABLE p-VALUE.').toMatch(/^p\s*[=<]/);
  expect(hack.forks, 'THE SEARCH CLAIMS TO HAVE PUBLISHED WITHOUT TURNING A SINGLE KNOB.').toBeGreaterThan(0);

  await page.locator('.ph-lab__submit').click();

  // --- PUBLISHED (§2.5) ----------------------------------------------------
  const published = page.locator('.ph-published');
  await expect(published).toBeVisible();
  await expect(page.locator('.ph-published__career')).not.toBeEmpty();
  await expect(page.locator('.ph-altmetric__score')).not.toBeEmpty();

  const clippings = page.locator('.ph-press-card');
  await expect(
    clippings,
    'THE CELEBRATION HAS NO PRESS: master spec §2.5 puts fake press blurbs on the Published screen ' +
      'and none rendered.',
  ).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await expect(clippings.nth(i).locator('.ph-press-card__outlet')).not.toBeEmpty();
    await expect(clippings.nth(i).locator('.ph-press-card__text')).not.toBeEmpty();
    await expect(
      clippings.nth(i).locator('.ph-press-card__watermark'),
      'A FAKE PRESS CLIPPING SHIPPED WITHOUT ITS SIMULATED-PRESS WATERMARK (master spec §4.4).',
    ).not.toBeEmpty();
  }

  // T39a's invariant: a blurb written for ANOTHER scenario must never run
  // over today's study ("a fern chyron over a sourdough study"). Written
  // tolerantly, as asked: if the bank happens to carry a blurb bound to
  // TODAY's scenario, at least one clipping must be it; otherwise every
  // clipping must come from the scenario-agnostic pool.
  const renderedTexts = await clippings.locator('.ph-press-card__text').allInnerTexts();
  const boundToToday = content.press.filter((p) => p.scenarioIds?.includes(scenario!.id));
  if (boundToToday.length > 0) {
    expect(
      renderedTexts.some((text) => boundToToday.some((p) => p.text === text.trim())),
      `THE SCENARIO-BOUND PRESS WAS IGNORED: the bank carries a clipping written for "${scenario!.id}" ` +
        'and the Published screen ran generic copy instead.',
    ).toBe(true);
  } else {
    test.info().annotations.push({
      type: 'note',
      description:
        `The press bank carries no clipping bound to today's scenario ("${scenario!.id}"), so the ` +
        'stronger "at least one bound clipping" assertion does not apply on this day; the ' +
        'no-leakage half below is asserted instead.',
    });
  }
  for (const text of renderedTexts) {
    const blurb = content.press.find((p) => p.text === text.trim());
    expect(blurb, `THE PUBLISHED SCREEN INVENTED A PRESS CLIPPING: "${text}" is not in the bank.`).toBeDefined();
    const tags = blurb!.scenarioIds;
    expect(
      tags === undefined || tags.length === 0 || tags.includes(scenario!.id),
      `A PRESS CLIPPING WRITTEN FOR ANOTHER STUDY RAN OVER THIS ONE: "${text}" is bound to ` +
        `${JSON.stringify(tags)} but today's scenario is "${scenario!.id}".`,
    ).toBe(true);
  }

  // --- THE CALL (§2.6), as an overlay over the cover -----------------------
  await page.locator('.ph-published__cta').click();
  const overlay = page.locator('.ph-call-overlay');
  await expect(overlay).toBeVisible();
  await expect(
    overlay.locator('.ph-call__option'),
    'THE CALL OVERLAY OPENED EMPTY: the player was handed a dimmed, focus-trapped dialog with no ' +
      'question in it (the T29 production-import defect).',
  ).toHaveCount(2);
  await expect(page.locator('.ph-published__cover')).toHaveAttribute('inert', '');
  await overlay.locator('.ph-call__option').first().click();

  // --- REVEAL (§2.7) — the stamp waits for its block to be seen ------------
  const reveal = page.locator('.ph-reveal');
  await expect(reveal).toBeVisible();
  await expect(page.locator('[data-block="truth"] .ph-reveal__truth')).not.toBeEmpty();
  await expect(
    page.locator('[data-role="published-recipe"]'),
    'THE REVEAL DID NOT NAME WHAT WAS PUBLISHED: a published day must state its own recipe in words.',
  ).toBeVisible();

  // Scroll-gating is live at all: the last block has not entered yet.
  await expect(
    page.locator('[data-block="fig2"]'),
    'NOTHING ON THE REVEAL IS SCROLL-GATED: every block entered at mount, so the whole staged ' +
      'argument (and the stamp inside it) plays before the player has read a word of it.',
  ).not.toHaveClass(/ph-entered/);

  const stampBlock = page.locator('[data-block="stamp"]');
  const mark = page.locator('.ph-stamp__mark');
  const stampEnteredOnArrival = ((await stampBlock.getAttribute('class')) ?? '').includes('ph-entered');
  if (!stampEnteredOnArrival) {
    expect(
      await mark.evaluate((el) => getComputedStyle(el).animationName),
      'THE STAMP SLAMMED INTO AN INVISIBLE BLOCK: its animation is running while the block holding ' +
        'it is still transparent and off screen, so Act II\'s one signature moment plays to nobody ' +
        '(the T35 defect).',
    ).toBe('none');
  }

  await stampBlock.scrollIntoViewIfNeeded();
  await expect(stampBlock).toHaveClass(/ph-entered/);
  expect(
    await mark.evaluate((el) => getComputedStyle(el).animationName),
    'THE STAMP NEVER SLAMS: its block is on screen and the slam animation still is not attached.',
  ).toBe('ph-stamp-slam');
  await expect(page.locator('.ph-stamp__label')).not.toBeEmpty();

  await page.locator('[data-role="to-summary"]').click();

  // --- SUMMARY (§2.9) ------------------------------------------------------
  const summary = page.locator('.ph-summary');
  await expect(summary).toBeVisible();
  await expect(
    page.locator('[data-testid="invoice-row-value"]'),
    'THE INVOICE IS EMPTY: the day was scored and the breakdown has no rows.',
  ).not.toHaveCount(0);
  await expect(page.locator('.ph-summary__total')).not.toBeEmpty();
  await expect(page.locator('.ph-summary__streak')).not.toBeEmpty();
  await expect(
    page.locator('.ph-summary__countdown'),
    'THE NEXT-DAY COUNTDOWN IS MISSING: nothing tells the player when tomorrow\'s puzzle arrives.',
  ).toHaveText(/\d+h\s+\d+m/);

  // --- SHARE (§2.9) --------------------------------------------------------
  await page.locator('.ph-summary__share-button').click();
  await expect(
    page.locator('.ph-summary__toast'),
    'THE SHARE BUTTON SAID NOTHING: the clipboard path must confirm itself.',
  ).toBeVisible();

  const written = await readClipboard(page);
  expect(written, 'THE SHARE BUTTON WROTE NOTHING TO THE CLIPBOARD.').toHaveLength(1);
  const lines = written[0].split('\n');

  expect(lines, `THE SHARE GRID IS NOT 4 LINES (§2.9). Got:\n${written[0]}`).toHaveLength(4);
  // §1(i): the brand half stays invariant; the hook half is the locale's own
  // `nav.tagline`, read from the catalog rather than restated here.
  expect(lines[0], 'SHARE LINE 1 IS NOT THE PUZZLE STAMP PLUS THE HOOK.').toBe(
    `${SHARE_LINE1_PREFIX(PUZZLE_NUMBER)}${enCopy['nav.tagline']}`,
  );

  expect(
    lines[1],
    `SHARE LINE 2 LEAKS THE DAY: "${lines[1]}" is not a bare trail plus the permitted ⚖️ call mark. ` +
      'Anything else in this line ships the verdict to somebody who has not played yet.',
  ).toMatch(SHARE_LINE2);
  // §1(i): the run is grouped in fives, so the marks are counted with the
  // separators stripped. Same claim as before — one fork mark per counted
  // fork, then the published terminal — and SHARE_LINE2 above is what pins
  // where the separators are allowed to fall.
  expect(
    lines[1].replaceAll(' ', ''),
    'SHARE LINE 2 DISAGREES WITH THE DAY THAT WAS PLAYED: the trail must carry one fork mark per ' +
      'counted fork and end in the published terminal.',
  ).toMatch(new RegExp(`^🍴{${hack.forks}}📄`, 'u'));

  // §1(j)(2): the honest verdict is two verdicts now, and both join the scan.
  for (const stamp of ['RETRACTED', 'REPLICATED', 'NULL CONFIRMED', 'MISSED DISCOVERY']) {
    expect(
      written[0],
      `THE SHARE STRING NAMES THE VERDICT ("${stamp}"): §2.9's whole point is that it cannot.`,
    ).not.toContain(stamp);
  }

  expect(lines[2], 'SHARE LINE 3 IS NOT THE LABELLED FORK/STREAK LINE.').toMatch(/^Forks: \d+ · Streak: \d+$/);
  expect(Number(lines[2].match(/^Forks: (\d+)/)![1]), 'THE SHARED FORK COUNT IS NOT THE DAY\'S.').toBe(hack.forks);
  expect(lines[3], 'SHARE LINE 4 IS NOT THE SITE URL.').toBe(SITE_URL);
});
