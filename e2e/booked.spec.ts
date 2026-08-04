// T23 — THE BOOKED CHECKS.
//
// Five defects found by earlier reviews, each of which was invisible to the
// jsdom suite for a structural reason (no layout, no `inert`, no bundler, no
// animations, no storage policy). Each gets a standing test here so it can
// only ever be found once.
import { expect, test, type Page } from '@playwright/test';
import { enterLab, openApp, publishPinnedSpec } from './harness';

// =========================================================================
// (a) T33 — HEADER OVERFLOW ON A NARROW PHONE
// =========================================================================
//
// The running header carries a masthead, a four-item nav, a two-option theme
// group and a three-option locale group. In Italian and Spanish every one of
// those words is longer than its English original, and at 360px the row used
// to push the document wider than the viewport — which on a phone means the
// whole page scrolls sideways under your thumb.
//
// ASSERTION SHAPE, and a documented deviation from the booked literal. The
// review booked this as `document.scrollWidth === 360`. The honest invariant
// is `scrollWidth <= clientWidth` on the document element: when the page is
// tall enough to show a classic vertical scrollbar, the initial containing
// block is narrower than the 360px viewport, and a page that fits perfectly
// reports 345, not 360. Equality would then fail on a correct layout for a
// reason that has nothing to do with the bug. The inequality is what "no
// horizontal scrollbar" actually means, and it is what fails when the bug
// comes back.
test.describe('(a) T33 — the header must not push the page sideways at 360px', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const locale of ['it', 'es'] as const) {
    test(`${locale}: About page at 360x780 does not scroll horizontally`, async ({ page }) => {
      await openApp(page, { locale });

      await page.locator('.ph-header__nav .ph-seg').last().click();
      await expect(page.locator('.ph-about')).toBeVisible();
      // The nav grows by one item on a nav page — the "Play" return button,
      // which is exactly the state the overflow was reported in.
      await expect(
        page.locator('.ph-seg--action'),
        'THE WAY BACK TO THE GAME IS MISSING from a nav page.',
      ).toBeVisible();

      const measured = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
        headerWidth: Math.ceil(document.querySelector('.ph-header')!.getBoundingClientRect().width),
      }));

      expect(
        measured.scrollWidth,
        `THE PAGE SCROLLS SIDEWAYS IN ${locale.toUpperCase()} AT 360px: the document is ` +
          `${measured.scrollWidth}px wide inside a ${measured.clientWidth}px viewport ` +
          `(header ${measured.headerWidth}px). On a phone this drags the whole page under the ` +
          'player\'s thumb. Measured: ' + JSON.stringify(measured),
      ).toBeLessThanOrEqual(measured.clientWidth);

      // The same check on the game screen itself, where the header is
      // narrowest but the content is widest.
      await page.locator('.ph-seg--action').click();
      await expect(page.locator('.ph-briefing')).toBeVisible();
      const onGame = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        onGame.scrollWidth,
        `THE BRIEFING SCROLLS SIDEWAYS IN ${locale.toUpperCase()} AT 360px: ` + JSON.stringify(onGame),
      ).toBeLessThanOrEqual(onGame.clientWidth);
    });
  }
});

// =========================================================================
// (b) T22 — FOCUS RESTORE AFTER DISMISSING THE CALL OVERLAY
// =========================================================================
//
// THE BUG THIS GUARDS: `closeCall()` used to call `ctaRef.current.focus()` on
// the line after `setCallOpen(false)`. React had not committed yet, so the
// cover still carried `inert` — and nothing inside an inert subtree can take
// focus. The call was a silent no-op and a keyboard player who backed out of
// the call landed on <body>, then had to walk the entire header to get back
// to the button they had just left.
//
// WHY THIS TEST HAD TO BE HERE AND NOT IN JSDOM: jsdom does not implement
// inert's focus blocking at all, so `expect(cta).toHaveFocus()` passes there
// whether the ordering is right or wrong. This assertion is only meaningful
// in a real browser.
test('(b) T22 — Escape from the call overlay returns focus to the button that opened it', async ({ page }) => {
  await openApp(page);
  await enterLab(page);
  await publishPinnedSpec(page);

  const cta = page.locator('.ph-published__cta');
  await cta.focus();
  await expect(cta).toBeFocused();

  // Opened by the keyboard, the way the player who needs this opens it.
  await page.keyboard.press('Enter');
  const overlay = page.locator('.ph-call-overlay');
  await expect(overlay).toBeVisible();
  await expect(
    overlay.locator('.ph-call__option').first(),
    'THE CALL OVERLAY DID NOT TAKE FOCUS: a modal that opens behind the keyboard leaves the player ' +
      'tabbing through a cover they cannot see.',
  ).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(
    overlay,
    'ESCAPE DID NOT CLOSE THE CALL OVERLAY: a focus trap with no keyboard exit is a trap (WCAG 2.1.2).',
  ).toHaveCount(0);

  await expect(
    cta,
    'FOCUS WAS DROPPED ON THE FLOOR: after dismissing the call, focus must return to "Face the ' +
      'truth". If it went to <body>, the restore ran before React committed the removal of `inert` ' +
      'and was silently ignored — the exact T22 defect, and one jsdom cannot see.',
  ).toBeFocused();
});

// =========================================================================
// (c) T29 — THE PUBLISHED OVERLAY MUST ACTUALLY CONTAIN THE CALL, IN dist/
// =========================================================================
//
// THE BUG THIS GUARDS: Published loaded its Call screen through a
// deliberately non-analyzable dynamic specifier. Vite cannot rewrite what it
// cannot analyze, so in the production build the request went to
// `/assets/registry`, 404'd, hit the `catch`, and returned null — the overlay
// opened dimmed, focus-trapped and COMPLETELY EMPTY. Dev and jsdom were both
// green throughout.
test('(c) T29 — the call overlay renders real content in the production bundle (no empty overlay)', async ({
  page,
}) => {
  const badResponses: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await openApp(page);
  await enterLab(page);
  await publishPinnedSpec(page);

  await page.locator('.ph-published__cta').click();
  const overlay = page.locator('.ph-call-overlay');
  await expect(overlay).toBeVisible();

  await expect(
    overlay.locator('.ph-call'),
    'THE CALL OVERLAY OPENED EMPTY IN THE PRODUCTION BUILD: the lazily-loaded call screen never ' +
      'arrived, so the Act I -> Act II hand-off is dead in the shipped artifact. This is the T29 ' +
      'non-analyzable-import defect, and it exists ONLY after bundling.',
  ).toBeVisible();
  await expect(overlay.locator('.ph-call__prompt')).not.toBeEmpty();
  await expect(overlay.locator('.ph-call__option')).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await expect(overlay.locator('.ph-call__option-title').nth(i)).not.toBeEmpty();
    await expect(overlay.locator('.ph-call__option-sub').nth(i)).not.toBeEmpty();
  }

  expect(
    badResponses,
    'THE BUILT APP REQUESTED SOMETHING THAT DOES NOT EXIST. A 404 on a chunk is how the T29 empty ' +
      'overlay presented itself; a failing request here means some module specifier survived the ' +
      'bundler unrewritten.',
  ).toEqual([]);
  expect(pageErrors, 'THE PRODUCTION BUNDLE THREW AN UNCAUGHT ERROR DURING A NORMAL PLAYTHROUGH.').toEqual([]);
});

// =========================================================================
// (d) T35 — REDUCED MOTION
// =========================================================================
//
// R5.6's real requirement is not "run the animations faster", it is "no
// content is ever behind motion". Under reduced motion every scroll-gated
// block must be visible from the moment the reveal mounts — the player must
// not have to trigger an entrance to read the argument — and nothing may be
// animating.
test.describe('(d) T35 — reduced motion hides nothing and animates nothing', () => {
  // `reducedMotion` is a browser-context option rather than a top-level test
  // option in this Playwright version, so it is set through `contextOptions`.
  // This emulates the OS-level preference for real — the media query, the
  // token collapse in tokens.css and `useReducedMotion`'s matchMedia read all
  // see it, which is the only way to test R5.6 honestly.
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('the reveal is fully readable without scrolling and runs no animations', async ({ page }) => {
    await openApp(page);
    await enterLab(page);
    await page.locator('.ph-lab__abandon').click();
    await page.locator('.ph-call__option').first().click();
    await expect(page.locator('.ph-reveal')).toBeVisible();

    const blocks = page.locator('[data-block]');
    const count = await blocks.count();
    expect(count, 'THE REVEAL LOST ITS BLOCKS: §2.7 stages six of them.').toBe(6);

    // NO SCROLLING between landing on the screen and this measurement — that
    // is the whole assertion.
    const opacities = await blocks.evaluateAll((nodes) =>
      nodes.map((node) => ({
        block: node.getAttribute('data-block'),
        opacity: getComputedStyle(node).opacity,
      })),
    );
    for (const { block, opacity } of opacities) {
      expect(
        Number(opacity),
        `THE REVEAL IS HIDING CONTENT UNDER REDUCED MOTION: block "${block}" is at opacity ${opacity} ` +
          'before any scrolling. A player who asked for less motion must not have to trigger an ' +
          'entrance to read the results.',
      ).toBe(1);
    }

    await expect(
      page.locator('.ph-stamp'),
      'THE STAMP STILL SLAMS UNDER REDUCED MOTION: R5.6 requires the JS-driven motions to withhold ' +
        'themselves, not merely to run fast.',
    ).not.toHaveClass(/ph-stamp--animate/);

    const running = await page.evaluate(() =>
      document.getAnimations().map((animation) => ({
        name: (animation as unknown as { animationName?: string }).animationName ?? 'unknown',
        duration: Number(animation.effect?.getComputedTiming().duration ?? 0),
      })),
    );
    for (const animation of running) {
      expect(
        animation.duration,
        `AN ANIMATION IS RUNNING UNDER REDUCED MOTION: "${animation.name}" for ${animation.duration}ms. ` +
          'tokens.css collapses every duration to <= 1ms under the media query; anything longer is a ' +
          'hardcoded duration that escaped the token.',
      ).toBeLessThanOrEqual(1);
    }
  });
});

// =========================================================================
// (e) errors.storageOff — BOOTING WITH LOCAL STORAGE BLOCKED
// =========================================================================
//
// A browser with site data blocked (or an iOS private tab) makes every
// localStorage access THROW. src/game/storage.ts is built for exactly this:
// one StorageUnavailable channel, an in-memory fallback for the session, and
// an `isStorageOff()` flag. The design's other half is a copy key —
// `errors.storageOff`, translated in all three locales — that tells the
// player their progress will not be saved.
async function bootWithStorageBlocked(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openApp(page, { blockStorage: true });
  return pageErrors;
}

test('(e) the app still boots and plays with local storage blocked', async ({ page }) => {
  const pageErrors = await bootWithStorageBlocked(page);

  await expect(
    page.locator('.ph-briefing__question'),
    'A BROWSER WITH SITE DATA BLOCKED CANNOT PLAY AT ALL: the Briefing never rendered. storage.ts ' +
      'is supposed to fall back to an in-memory session, not take the app down with it.',
  ).not.toBeEmpty();
  await expect(
    page.locator('.ph-error'),
    'BLOCKED STORAGE WAS REPORTED AS AN ENGINE CRASH: it is neither an engine problem nor fatal.',
  ).toHaveCount(0);

  // ...and the day is still playable, in memory.
  await enterLab(page);
  await expect(page.locator('.ph-dial__value')).toHaveText(/^p\s*[=<]/);

  expect(pageErrors, 'THE APP THREW WITH LOCAL STORAGE BLOCKED.').toEqual([]);
});

// FINDING F1 (see the T23 report): fixed in T40 — App.tsx now renders
// errors.storageOff, in the shell, whenever storage.ts's isStorageOff() is
// true (role="status", --muted register, no new colour, no motion; see
// App.tsx's own comment on the block for the full rationale).
test('(e) blocked storage tells the player their progress will not be saved [FINDING F1]', async ({ page }) => {
  await bootWithStorageBlocked(page);

  await expect(
    page.getByText(/local storage|progress won't be saved/i),
    'THE PLAYER WAS NOT WARNED: with storage blocked, nothing on screen says progress will not be ' +
      'kept, so a streak silently resets to 1 tomorrow with no explanation. `errors.storageOff` is ' +
      'written and translated in all three locales; no component renders it.',
  ).toBeVisible();
});

// =========================================================================
// FINDING F2 — THE BRIEFING SHOWS THE WRONG STUDY UNTIL THE ENGINE BOOTS
// =========================================================================
//
// FOUND BY THIS SUITE, not booked by an earlier review. `App.tsx`'s loading
// gate holds the whole shell until the locale CONTENT resolves, and then
// mounts the Briefing — but `store.boot()` is still awaiting `client.init`,
// which is where the day is actually assembled (rejection sampling, in the
// worker). Until it lands, `scenarioIndex` is `initialState()`'s 0 and
// `puzzleNumber` is 0, so `Briefing.tsx` renders scenario #0's question,
// scenario #0's cover story, and — via `isoFromPuzzleNumber(0)` — a Grantwell
// email picked for the wrong date. Then it all swaps.
//
// MEASURED on the production build over a local preview server, 3/3 runs:
//   run 1: "Does owning a cat improve cryptocurrency returns?" at t+96ms,
//          replaced by the real question at t+213ms  (117ms wrong)
//   run 2: t+84ms -> t+200ms                                    (116ms wrong)
//   run 3: t+56ms -> t+130ms                                     (74ms wrong)
// That is a fast desktop against localhost. The window is bounded by worker
// startup plus the day's own acceptance loop, which is data-dependent (up to
// MAX_ATTEMPTS rejection-sampled datasets, each with a full 1792-spec
// enumeration on a null day) — so on a phone, on a bad day, this is not a
// flash.
//
// Invisible to the jsdom suite by construction: every screen test injects a
// fake store that already HAS a scenarioIndex, so the pre-boot state that
// only the real async boot produces is never rendered there.
//
// Fixed in T40 — App.tsx's loading gate now waits on store.booted (set
// inside boot()'s own client.init() resolution, the same set() call that
// fixes scenarioIndex/iso/puzzleNumber) in addition to content/copy, so the
// Briefing never mounts on initialState()'s placeholder scenario at all.
test('the briefing never shows a scenario other than the day\'s own [FINDING F2]', async ({ page }) => {
  await openApp(page);
  const firstPaint = (await page.locator('.ph-briefing__question').innerText()).trim();

  await enterLab(page);
  const real = (await page.locator('.ph-lab__question-text').innerText()).trim();

  expect(
    firstPaint,
    'THE BRIEFING OPENED ON THE WRONG STUDY: the question, cover story and supervisor email all ' +
      "belong to scenario #0 until the worker finishes assembling the day, then swap to today's. " +
      'The player reads the wrong briefing first, and on a slow device reads it for a while.',
  ).toBe(real);
});
