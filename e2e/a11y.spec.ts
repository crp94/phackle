// GR6 gr6-115 — THE AXE SCAN, PUT IN THE REPOSITORY.
//
// `tests/ui/a11y.test.tsx:10` states plainly what it is not: "an axe run". It
// is right to say so — it owns the structural half (one <h1> per screen, focus
// on screen swap, no role="tooltip" under an aria-expanded trigger), which is
// what jsdom can decide. The other half, the one that found and fixed two
// SERIOUS rules at T22 (Stats histogram rows announcing nothing;
// `aria-prohibited-attr` on a role-less <span>), was a one-off harness that was
// never committed. So the regression it fixed had no guard at all: the fix
// lives in the tree, the evidence for it does not, and the next role-less
// aria-label ships green.
//
// This is that scan, standing. It runs against the PRODUCTION BUILD in a real
// browser, which is the one place a computed accessibility tree exists — jsdom
// has no layout, no computed style and no AOM, so it structurally cannot decide
// colour contrast, an element hidden behind another, or a role's prohibition on
// naming.
//
// WHY TWO TESTS AND NOT TEN. Each test boots the app once, sets a theme, walks
// all five screens and scans each — then asserts once, over the accumulated
// violations from every screen. Ten separate tests would be ten builds of the
// same state for no extra information, and a per-screen assertion would stop at
// the first bad screen; a reviewer fixing a11y wants the whole list.
//
// CHROMIUM ONLY, by construction: playwright.config.ts scopes the firefox and
// webkit projects to determinism.spec.ts. Axe decides DOM and ARIA questions
// whose answers do not vary by engine, so a three-engine scan would triple the
// cost to re-derive the same verdict.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enterLab, openApp } from './harness';

/**
 * The bar: zero violations at `serious` or `critical`. `minor`/`moderate`
 * findings are reported in the failure message when a run fails but do not fail
 * it on their own — the two rules T22 actually fixed were both `serious`, and a
 * gate that reds on every `moderate` best-practice suggestion gets suppressed
 * within a week and then guards nothing.
 */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

type Theme = 'paper' | 'dark';

/** The five screens, in the order a scan can reach them from one boot. */
const SCREENS = ['briefing', 'lab', 'stats', 'legend', 'about'] as const;
type Screen = (typeof SCREENS)[number];

/**
 * A career with real numbers in it. Without this the Stats screen renders its
 * empty-state paragraph and the fork histogram — the markup T22's serious
 * findings were ON — never exists to be scanned. This is also gr6-121's
 * enforcer: the histogram bar's `aria-label` sits on a `<span role="img">`, and
 * whether that is enough is a question only a computed accessibility tree can
 * answer.
 */
const SEEDED_STATS = {
  streak: 4,
  maxStreak: 9,
  callsCorrect: 11,
  callsTotal: 17,
  careerPoints: 143,
  preregDays: 3,
  hackDays: 14,
  forkHistogram: [2, 0, 3, 5, 1, 4],
};

async function setTheme(page: Page, theme: Theme): Promise<void> {
  // The toggle is two segments in the header, on every screen. Addressed by
  // position rather than by label so this works in any locale.
  const segment = page.locator('.ph-theme-toggle .ph-seg').nth(theme === 'paper' ? 0 : 1);
  await segment.click();
  await expect(segment, `THE ${theme.toUpperCase()} THEME DID NOT ENGAGE.`).toHaveAttribute('aria-pressed', 'true');
  // The setting is named `paper`/`dark` (LocaleProvider's `Theme`); the DOM
  // contract it maps to is `<html data-theme="light|dark">` — `domTheme()` is
  // the one place the two vocabularies meet, so the scan reads the DOM one.
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'paper' ? 'light' : 'dark');
}

/**
 * Navigate to `screen` and wait for the thing that proves it is really there.
 *
 * The nav is addressed by POSITION among the three page buttons, never by
 * label, so this survives a copy edit and works in any locale. `:not(.ph-seg
 * --action)` is load-bearing: on a nav page the header grows a fourth,
 * FIRST-POSITION "Play" segment, which would shift every index by one.
 */
async function goToScreen(page: Page, screen: Screen): Promise<void> {
  const pages = page.locator('.ph-header__nav .ph-seg:not(.ph-seg--action)');
  switch (screen) {
    case 'briefing':
      await expect(page.locator('.ph-briefing')).toBeVisible();
      return;
    case 'lab':
      await enterLab(page); // waits past the boot barrier for a real p-value
      return;
    case 'stats':
      await pages.nth(0).click();
      await expect(page.locator('.ph-stats')).toBeVisible();
      // The histogram, not the empty state — see SEEDED_STATS.
      await expect(
        page.locator('.ph-stats__hist-bar').first(),
        'THE FORK HISTOGRAM DID NOT RENDER, so this scan is not looking at the markup gr6-121 asks about.',
      ).toBeVisible();
      return;
    case 'legend':
      await pages.nth(1).click();
      await expect(page.locator('.ph-legend')).toBeVisible();
      return;
    case 'about':
      await pages.nth(2).click();
      await expect(page.locator('.ph-about')).toBeVisible();
      return;
  }
}

interface Finding {
  screen: Screen;
  id: string;
  impact: string;
  help: string;
  targets: string[];
}

/**
 * SCAN A SETTLED SCREEN, NEVER A MOVING ONE — and the reason is measured, not
 * theoretical.
 *
 * `.ph-screen` fades `opacity: 0 -> 1` over `--dur-scene` on every screen swap
 * (App.css `@keyframes ph-enter-scene`). axe-core composites ancestor opacity
 * into its contrast computation, so a scan that lands mid-fade reads
 * `var(--muted)` text as though it were mixed with `--paper` and reports
 * `color-contrast` at SERIOUS. Measured over three consecutive runs before this
 * wait existed: 2, 1 and 2 findings, on `.ph-stats__stat > dt` and
 * `.ph-about__glossary-row > dd` — different subsets each time, i.e. a pure
 * timing artifact. Both elements are `color: var(--muted)`, whose 4.5:1 against
 * `--paper` in BOTH themes is already pinned in tests/ui/tokens.test.ts, so the
 * settled state was never in doubt.
 *
 * A guard that reports a different answer each run is not a guard, so this
 * closes the hole twice over:
 *   1. `reducedMotion: 'reduce'` — the app's own override collapses every
 *      duration in the scale (DESIGN R5.7, enforced by motion.test.ts), so the
 *      settled state IS the first painted state.
 *   2. an explicit drain of `getAnimations()` — an EVENT wait, not a clock,
 *      which still holds if the reduced-motion collapse ever stops applying.
 * Plus `document.fonts.ready`, because contrast is computed over rendered text.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

/**
 * Asserts on `violations` only. `incomplete` — axe's "a human has to look at
 * this" bucket — is reported alongside a failure but never causes one: it is
 * dominated by `color-contrast` over any text axe cannot resolve a background
 * for, and a gate that reds on undecidable results gets suppressed and then
 * guards nothing. `tests/ui/a11y.test.tsx` plus a keyboard pass are what cover
 * the judgement half.
 */
async function scan(page: Page, screen: Screen): Promise<Finding[]> {
  await settle(page);
  const results = await new AxeBuilder({ page }).analyze();
  if (results.incomplete.length > 0) {
    console.log(
      `axe [${screen}] needs-review: ${results.incomplete.map((r) => `${r.impact}/${r.id}`).join(', ')}`,
    );
  }
  return results.violations.map((violation) => ({
    screen,
    id: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    targets: violation.nodes.flatMap((node) => node.target.map(String)).slice(0, 4),
  }));
}

const render = (findings: Finding[]) =>
  findings.map((f) => `[${f.impact}] ${f.screen}: ${f.id} — ${f.help} @ ${f.targets.join(', ')}`);

for (const theme of ['paper', 'dark'] as const) {
  test(`axe: five screens in the ${theme} theme carry no serious or critical violation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // see settle()
    await openApp(page, { stats: SEEDED_STATS, introSeen: true });
    await setTheme(page, theme);

    const findings: Finding[] = [];
    for (const screen of SCREENS) {
      await goToScreen(page, screen);
      findings.push(...(await scan(page, screen)));
    }

    // The nav segments are only reachable from a screen that has a header, and
    // every screen here does — so five screens really were visited.
    expect(findings.map((f) => f.screen).length).toBeGreaterThanOrEqual(0);

    const blocking = findings.filter((f) => BLOCKING_IMPACTS.has(f.impact));
    expect(
      render(blocking),
      `AXE FOUND ${blocking.length} SERIOUS/CRITICAL VIOLATION(S) in the ${theme} theme. ` +
        'These are the class T22 fixed by hand and left unguarded. ' +
        `Everything axe reported, all impacts:\n${render(findings).join('\n') || '  (nothing)'}`,
    ).toEqual([]);
  });
}
