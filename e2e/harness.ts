// T23 — the Playwright E2E harness: everything the flow specs share.
//
// WHAT THIS SUITE IS FOR, stated once, here, because every choice below
// follows from it. The unit suite (1357 tests, jsdom) is green and stays
// green — and a whole CLASS of defects walked straight past it anyway:
//
//   * T29: `import(/* @vite-ignore */ registrySpecifier)` — a deliberately
//     NON-analyzable specifier. Fine in dev, fine in jsdom (which injects its
//     own loader), 404 in a PRODUCTION build: "Face the truth" opened an
//     EMPTY focus-trapped overlay in the shipped artifact.
//   * T22: `ctaRef.current.focus()` called while the cover still carried
//     `inert`. A silent no-op in Chrome; jsdom does not implement inert's
//     focus blocking at all, so the outcome assertion passed either way.
//   * T35: the stamp's 450ms slam fired at MOUNT, inside a scroll-gated
//     block that was still `opacity: 0`. jsdom has no layout, no
//     IntersectionObserver and no animations, so it saw nothing wrong.
//
// Every one of those is invisible to jsdom BY CONSTRUCTION. So this suite
// runs against `vite build` + `vite preview` — the real production bundle,
// in real Chromium, with real layout, real CSS, a real Worker realm and real
// focus semantics. NEVER the dev server: a dev-server run would not have
// caught a single one of the three above.
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { Outcome, Spec } from '../src/engine/types';

// --- the fixed clock -------------------------------------------------------
//
// ONE shared instant for the whole suite. It MUST sit after
// src/game/tuning.ts's EPOCH ('2026-08-10'): `daily.isPractice()` returns
// true for any real date BEFORE epoch, which would put every flow into
// PRACTICE MODE — a fresh `Math.random()` seed per load (so no two runs share
// a puzzle) and negative puzzle numbers, with the whole persistence path
// (`Summary`'s saveDay/saveAchievements) skipped. Post-EPOCH is what makes
// these flows exercise the REAL product.
//
// 2026-08-14 is puzzle #5, and is pinned deliberately rather than picked:
// it is a NULL day (so publishing earns a RETRACTED stamp — the game's
// central lesson, and the `first_retraction` unlock Prereg Mode is gated on)
// whose scenario is #14, `terms-and-conditions-service`. See
// `SIGNIFICANT_SPEC` below for the measured search cost.
export const PUZZLE_ISO = '2026-08-14';
export const PUZZLE_NUMBER = 5; // daysBetween(EPOCH, PUZZLE_ISO) + 1
export const SCENARIO_COUNT = 20; // T6: 20 English scenarios; matches gen_goldens.ts

/** 10:00 UTC on the pinned day. The config pins `timezoneId: 'UTC'`, so
 * `daily.localIsoDate()` resolves to PUZZLE_ISO unambiguously and the
 * Summary's "next puzzle in" countdown lands on a non-degenerate 14h 0m
 * rather than on a midnight boundary that could straddle a day. */
export const FIXED_INSTANT_MS = Date.UTC(2026, 7, 14, 10, 0, 0);

/** The one localStorage key the app persists under (src/game/storage.ts). */
const STORAGE_KEY = 'phackle.v1';

// --- window instrumentation the harness installs --------------------------
//
// Test-only, and deliberately NOT product code: nothing in src/** knows this
// exists. `__phDialSettles` counts genuine "a new result finished rendering"
// events so the specs can synchronise on an EVENT rather than on a sleep;
// `__phClipboard` records what the Share button actually wrote.
type HarnessWindow = Window & {
  __phDialSettles?: number;
  __phClipboard?: string[];
};

export interface HarnessOptions {
  /** Seeds `settings.locale` in persisted storage before first paint, so the
   * app BOOTS in that locale rather than being toggled into it afterwards —
   * `detectLocale` reads storage and ignores navigator.language entirely. */
  locale?: 'en' | 'it' | 'es';
  /** Seeds unlocked achievements. §1(j)(1) moved the Prereg Mode gate OFF
   * `first_retraction` and onto "a day has been completed", so this no longer
   * opens the mode chooser — see `history`. */
  achievements?: Record<string, string>;
  /** Seeds completed days. §1(j)(1): one entry under ANY earlier date is what
   * makes the Briefing render its mode chooser (Prereg Mode's only entrance),
   * and it must be an EARLIER date — a record under the pinned puzzle's own
   * date finishes today instead of opening it. */
  history?: Record<string, unknown>;
  /** Skips the Lab's first-run "How to play" panel. */
  introSeen?: boolean;
  /** Seeds career statistics. GR6 gr6-115/gr6-121: the Stats screen renders an
   * empty-state paragraph until `forkHistogram` is non-empty, so a scan of a
   * fresh browser never sees the histogram bars at all — and the bars are
   * exactly what the axe run is there to check (T22 fixed an
   * `aria-prohibited-attr` on them). Seeding is the only way to reach that
   * markup without playing twenty days first. */
  stats?: Record<string, unknown>;
  /** Makes every `window.localStorage` access throw, the way a browser with
   * site data blocked (or private-browsing lockout) does. */
  blockStorage?: boolean;
}

function freshPersistedState(opts: HarnessOptions) {
  return {
    version: 1,
    history: opts.history ?? {},
    stats: {
      streak: 0,
      maxStreak: 0,
      callsCorrect: 0,
      callsTotal: 0,
      careerPoints: 0,
      preregDays: 0,
      hackDays: 0,
      forkHistogram: [],
      ...(opts.stats ?? {}),
    },
    achievements: opts.achievements ?? {},
    settings: {
      ...(opts.locale === undefined ? {} : { locale: opts.locale }),
      ...(opts.introSeen === undefined ? {} : { introSeen: opts.introSeen }),
    },
  };
}

/**
 * Installs every init script this suite depends on, in order, BEFORE the
 * first navigation — so the app's own module-evaluation-time reads (the
 * pre-boot `puzzleNumber(localIsoDate())` in main.tsx, `detectLocale`'s
 * storage read in LocaleProvider) already see the fixed world.
 */
export async function installHarness(context: BrowserContext, opts: HarnessOptions = {}): Promise<void> {
  // 1. THE FIXED CLOCK. A Proxy rather than a subclass so every Date overload
  //    (`new Date(iso)`, `new Date(y, m, d)`, `Date.parse`, `Date.UTC`) keeps
  //    working verbatim and only the two wall-clock reads are pinned:
  //    zero-argument construction and `Date.now()`. `instanceof Date` still
  //    holds, because the proxy target IS the real Date.
  //
  //    Scope note, checked against the source: the engine (src/engine/**) is
  //    lint-forbidden from touching the wall clock at all, and the Worker
  //    receives its ISO date as a plain string argument from the main thread —
  //    so pinning the page realm pins the whole game, and no Worker-side
  //    override is needed (Playwright's addInitScript does not reach workers).
  await context.addInitScript((fixedMs: number) => {
    const RealDate = Date;
    const fixed = new Proxy(RealDate, {
      construct: (target, args) => Reflect.construct(target, args.length === 0 ? [fixedMs] : args),
      get: (target, prop, receiver) => (prop === 'now' ? () => fixedMs : Reflect.get(target, prop, receiver)),
    });
    globalThis.Date = fixed;
  }, FIXED_INSTANT_MS);

  // 2. SHARE / CLIPBOARD. `shareViaNavigator` prefers navigator.share and
  //    falls back to the clipboard; desktop Chromium has no share(), but it
  //    is deleted explicitly so the fallback is taken BY CONSTRUCTION rather
  //    than by luck of the platform, and the written text is captured.
  await context.addInitScript(() => {
    const w = window as HarnessWindow;
    w.__phClipboard = [];
    Reflect.deleteProperty(navigator, 'share');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          w.__phClipboard?.push(text);
          return Promise.resolve();
        },
      },
    });
  });

  // 3. SETTLE INSTRUMENTATION. The Lab debounces a knob turn by
  //    DEBOUNCE_MS(300) and only THEN dispatches to the worker, so "the click
  //    landed" and "a new p-value is on screen" are two different moments and
  //    nothing in the DOM counts the second one. The dial is
  //    `role="status" aria-busy={pending}`, so a true -> false transition on
  //    that attribute is exactly one settled result. Counting them turns the
  //    wait into an event wait instead of a sleep.
  await context.addInitScript(() => {
    const w = window as HarnessWindow;
    w.__phDialSettles = 0;
    let busy = false;
    new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target;
        if (!(target instanceof Element)) continue;
        if (target.getAttribute('data-testid') !== 'pvalue-dial') continue;
        const nowBusy = target.getAttribute('aria-busy') === 'true';
        if (busy && !nowBusy) w.__phDialSettles = (w.__phDialSettles ?? 0) + 1;
        busy = nowBusy;
      }
      // The observation target is `document`, not `document.documentElement`:
      // an init script runs before the parser has produced ANY element, so
      // documentElement is still null at this point (measured — observing it
      // threw "parameter 1 is not of type 'Node'" into every page, which is
      // also how this harness learned to assert on `pageerror`). A Document
      // node is a legal target and its subtree covers every element the app
      // ever renders.
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-busy'],
    });
  });

  // 4. STORAGE. Either seeded (locale / achievements / introSeen) or blocked
  //    outright — never both.
  if (opts.blockStorage) {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Access to localStorage is denied for this document.', 'SecurityError');
        },
      });
    });
  } else if (
    opts.locale !== undefined ||
    opts.achievements !== undefined ||
    opts.history !== undefined ||
    opts.introSeen !== undefined ||
    opts.stats !== undefined
  ) {
    await context.addInitScript(
      (payload: { key: string; value: string }) => {
        try {
          window.localStorage.setItem(payload.key, payload.value);
        } catch {
          // A blocked-storage context has nothing to seed; the app's own
          // in-memory fallback takes over.
        }
      },
      { key: STORAGE_KEY, value: JSON.stringify(freshPersistedState(opts)) },
    );
  }
}

/** Installs the harness on this test's own (already isolated) context, then
 * navigates and waits for the Briefing to be on screen and BOOTED — the
 * masthead's issue number switching from main.tsx's pre-boot value to the
 * store's is the app's own signal that the engine has initialised. */
export async function openApp(page: Page, opts: HarnessOptions = {}): Promise<void> {
  await installHarness(page.context(), opts);
  await page.goto('/');
  await expect(
    page.locator('.ph-briefing'),
    'THE APP DID NOT BOOT: the Briefing never rendered in the production build.',
  ).toBeVisible();
}

/**
 * "Open the data", and then WAIT FOR THE ENGINE.
 *
 * This is the suite's boot barrier, and it is not cosmetic. `store.boot()`
 * resolves in three stages — content loads, `client.init` assembles the day
 * (rejection sampling, in the worker), `client.runSpec` prefetches the
 * default spec — and the Briefing renders after the FIRST of those. Until
 * `init` lands, `scenarioIndex` is still `initialState()`'s 0 and every
 * screen that reads it is showing scenario #0's material, whatever today's
 * scenario actually is (see FINDING F2 in e2e/booked.spec.ts, measured at
 * 74-117ms on a fast desktop).
 *
 * A real p-value in the dial is the one signal that cannot be produced
 * before boot has fully resolved: it comes from boot's own prefetch, which
 * runs strictly after the `set({ scenarioIndex, n, puzzleNumber, iso })` that
 * fixes the day. So any test that cares WHICH puzzle it is reads it after
 * this point, never off the Briefing.
 */
export async function enterLab(page: Page): Promise<void> {
  await page.locator('.ph-briefing__cta').click();
  await expect(
    page.locator('[data-testid="lab-screen"]'),
    'THE LAB NEVER OPENED: "Open the data" is the Briefing\'s only exit.',
  ).toBeVisible();
  await expect(
    page.locator('.ph-dial__value'),
    'THE ENGINE NEVER DELIVERED A FIRST RESULT: the Lab opened with no p-value at all, so the ' +
      'worker either never assembled the day or never answered the default spec.',
  ).toHaveText(/^p\s*[=<]/);
}

/** The day's own research question, read from the Lab — i.e. after the boot
 * barrier above, so it is the real scenario and not the pre-boot placeholder. */
export async function readQuestion(page: Page): Promise<string> {
  return (await page.locator('.ph-lab__question-text').innerText()).trim();
}

// --- the six knobs ---------------------------------------------------------
//
// Addressed by RadioGroup's own generated legend id (`ph-spec-<name>-legend`)
// and by option INDEX, never by visible label — so the same driver works
// unchanged in English, Italian and Spanish, and a copy edit cannot silently
// turn a flow test red.

export const SUBGROUPS: Spec['subgroup'][] = ['all', 'age_lt40', 'age_ge40', 'exp_high', 'exp_low', 'urban', 'rural'];
export const COVARIATES: Spec['covariates'][] = [
  { income: false, risk: false },
  { income: true, risk: false },
  { income: false, risk: true },
  { income: true, risk: true },
];
export const EXCLUSIONS: Spec['exclusion'][] = ['none', 'z3', 'z2_5', 'z2'];
export const TRANSFORMS: Spec['transform'][] = ['raw', 'log1p'];
export const TAILS: Spec['tails'][] = ['two', 'one'];

/** src/game/store.ts's DEFAULT_SPEC — the free, un-hacked starting point. */
export const DEFAULT_SPEC: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'none',
  transform: 'raw',
  tails: 'two',
};

/**
 * The spec the bounded search below lands on for PUZZLE_ISO, measured
 * against the real engine: outcome Y1, everybody, no covariates, drop
 * |z| > 3, log1p, ONE-TAILED — p = 0.0392 at N = 200 on a day whose true
 * effect is zero. Used by the tests whose SUBJECT is a later screen (the
 * call overlay, focus restore), which have no business paying for the search
 * again; FLOW A itself always runs the real search.
 */
export const SIGNIFICANT_SPEC: Spec = {
  outcome: 0,
  subgroup: 'all',
  covariates: { income: false, risk: false },
  exclusion: 'z3',
  transform: 'log1p',
  tails: 'one',
};

type KnobName = 'outcome' | 'subgroup' | 'covariates' | 'exclusion' | 'transform' | 'tails';

function knobGroup(page: Page, name: KnobName): Locator {
  return page.locator(`[role="radiogroup"][aria-labelledby="ph-spec-${name}-legend"]`);
}

function optionIndex(name: KnobName, spec: Spec): number {
  switch (name) {
    case 'outcome':
      return spec.outcome;
    case 'subgroup':
      return SUBGROUPS.indexOf(spec.subgroup);
    case 'covariates':
      return COVARIATES.findIndex((c) => c.income === spec.covariates.income && c.risk === spec.covariates.risk);
    case 'exclusion':
      return EXCLUSIONS.indexOf(spec.exclusion);
    case 'transform':
      return TRANSFORMS.indexOf(spec.transform);
    case 'tails':
      return TAILS.indexOf(spec.tails);
  }
}

const KNOB_ORDER: KnobName[] = ['outcome', 'subgroup', 'covariates', 'exclusion', 'transform', 'tails'];

function differingKnobs(from: Spec, to: Spec): KnobName[] {
  return KNOB_ORDER.filter((name) => optionIndex(name, from) !== optionIndex(name, to));
}

function withKnob(spec: Spec, name: KnobName, from: Spec): Spec {
  switch (name) {
    case 'outcome':
      return { ...spec, outcome: from.outcome };
    case 'subgroup':
      return { ...spec, subgroup: from.subgroup };
    case 'covariates':
      return { ...spec, covariates: { ...from.covariates } };
    case 'exclusion':
      return { ...spec, exclusion: from.exclusion };
    case 'transform':
      return { ...spec, transform: from.transform };
    case 'tails':
      return { ...spec, tails: from.tails };
  }
}

/**
 * Turns one knob to the value `target` names for it. Returns as soon as the
 * CONTROL has moved — which is not the same moment the number does:
 * `store.changeSpec` updates the visible spec synchronously and debounces the
 * actual worker dispatch by DEBOUNCE_MS. Use `turnKnobAndSettle` whenever the
 * next thing you do is read a result.
 */
export async function turnKnob(page: Page, name: KnobName, target: Spec): Promise<void> {
  await knobGroup(page, name).getByRole('radio').nth(optionIndex(name, target)).click();
}

/** Turns one knob and waits for the p-value it produces to finish rendering. */
export async function turnKnobAndSettle(page: Page, name: KnobName, target: Spec): Promise<void> {
  const before = await dialSettleCount(page);
  await turnKnob(page, name, target);
  await waitForDialSettle(page, before);
}

/** Asserts every one of the six radiogroups is showing `spec`. */
export async function expectSpecOnScreen(page: Page, spec: Spec): Promise<void> {
  for (const name of KNOB_ORDER) {
    await expect(
      knobGroup(page, name).getByRole('radio').nth(optionIndex(name, spec)),
      `THE ${name.toUpperCase()} KNOB DID NOT TAKE: the option the driver selected is not the one the Lab shows as checked.`,
    ).toHaveAttribute('aria-checked', 'true');
  }
}

async function dialSettleCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as HarnessWindow).__phDialSettles ?? 0);
}

/** Waits for ONE more settled result to finish rendering in the dial. Event
 * driven (a MutationObserver on the dial's own aria-busy), never a sleep. */
async function waitForDialSettle(page: Page, previous: number): Promise<void> {
  await expect
    .poll(() => dialSettleCount(page), {
      message:
        'THE LAB WENT DEAF: a knob was turned and no new p-value ever finished rendering ' +
        '(the debounced spec change never reached the worker, or the worker never answered).',
      timeout: 15_000,
    })
    .toBeGreaterThan(previous);
}

/** The dial's headline numeral, e.g. `p = 0.039`. */
export async function readDial(page: Page): Promise<string> {
  return (await page.locator('.ph-dial__value').innerText()).trim();
}

export interface HackResult {
  /** How many settled spec changes it took — the same number the game counts
   * as forks, and the number the share string's trail must agree with. */
  forks: number;
  spec: Spec;
  dial: string;
}

/**
 * FLOW A's engine: turn knobs, one at a time, reading the dial after each,
 * until the game itself says the result is publishable (SUBMIT enabled — the
 * product's own `result.valid && result.p < 0.05 && !pending` gate, not a
 * number this test re-derives).
 *
 * BOUNDED, and the bound is the point: master spec §3.3 assembles every day
 * by rejection sampling so that significance is REACHABLE (a null day is only
 * accepted once a subsample of its 1792 specs is known to contain hits, and
 * `sigCount` must land inside NULL_SIG_BAND). If this loop runs out, the
 * day-assembly guarantee is broken — which is a product bug, not a flaky
 * test, and the failure message says so.
 *
 * The candidate order is a plain lexicographic walk of the six knobs with
 * `tails` flipped to one-tailed first (the cheapest halving there is, and the
 * move §2.11 names "The One-Tailed Bandit"). Measured on PUZZLE_ISO: it stops
 * after 3 knob turns at p = 0.039.
 */
export async function hackUntilPublishable(page: Page, maxTurns = 40): Promise<HackResult> {
  const submit = page.locator('.ph-lab__submit');
  let current = DEFAULT_SPEC;
  let turns = 0;

  for (const target of candidateSpecs()) {
    for (const name of differingKnobs(current, target)) {
      if (turns >= maxTurns) {
        throw new Error(
          `THE DAY IS NOT HACKABLE: after ${turns} knob turns on ${PUZZLE_ISO} the game never enabled ` +
            'SUBMIT. Master spec §3.3 guarantees every assembled day contains a reachable p < .05; ' +
            'either the acceptance loop or the analysis pipeline has regressed.',
        );
      }
      const before = await dialSettleCount(page);
      await turnKnob(page, name, target);
      current = withKnob(current, name, target);
      await waitForDialSettle(page, before);
      turns++;
      if (await submit.isEnabled()) {
        return { forks: turns, spec: current, dial: await readDial(page) };
      }
    }
  }

  throw new Error(`THE DAY IS NOT HACKABLE: the whole candidate grid was exhausted on ${PUZZLE_ISO}.`);
}

function* candidateSpecs(): Generator<Spec> {
  for (let outcome = 0; outcome < 4; outcome++) {
    for (const subgroup of SUBGROUPS) {
      for (const covariates of COVARIATES) {
        for (const exclusion of EXCLUSIONS) {
          for (const transform of TRANSFORMS) {
            yield { outcome: outcome as Outcome, subgroup, covariates, exclusion, transform, tails: 'one' };
          }
        }
      }
    }
  }
}

/**
 * The fast road to the Published screen for tests whose subject is what
 * happens AFTER publication. Turns the three knobs `SIGNIFICANT_SPEC` needs
 * and submits. Still the real UI, the real debounce and the real worker —
 * just not the search, which FLOW A owns.
 */
export async function publishPinnedSpec(page: Page): Promise<void> {
  for (const name of differingKnobs(DEFAULT_SPEC, SIGNIFICANT_SPEC)) {
    await turnKnob(page, name, SIGNIFICANT_SPEC);
  }
  await expectSpecOnScreen(page, SIGNIFICANT_SPEC);
  const submit = page.locator('.ph-lab__submit');
  await expect(
    submit,
    `THE PINNED HACK STOPPED WORKING: ${JSON.stringify(SIGNIFICANT_SPEC)} is measured at p = 0.039 on ` +
      `${PUZZLE_ISO}, but the Lab never enabled SUBMIT for it.`,
  ).toBeEnabled({ timeout: 15_000 });
  await submit.click();
  await expect(
    page.locator('.ph-published'),
    'SUBMIT WENT NOWHERE: a significant result was submitted and the Published screen never appeared.',
  ).toBeVisible();
}

/** What the Share button actually handed to the platform. */
export async function readClipboard(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as HarnessWindow).__phClipboard ?? []);
}

/**
 * §2.9's spoiler rule, as a shape.
 *
 * Line 2 is the emoji trail plus, iff a call was made, ` → ⚖️✅`/` → ⚖️❌`.
 * The ONLY glyphs allowed in it are the 🧾 prereg prefix, the 🍴 fork and ➕
 * peek marks, and one 📄/🏳️ terminal — none of which encodes the day's TYPE
 * or the verdict STAMP. The ⚖️ suffix says whether the call was right, which
 * §2.9 permits and which still leaks nothing about the day (a correct call
 * happens on both day types). Anything else appearing here would be a
 * spoiler shipped to somebody else's timeline.
 */
// §1(i): the fork run is grouped in fives and the parts are separated by
// U+0020, so a legal trail is a sequence of space-separated parts — an
// optional 🧾, then fork groups, then the terminal. Written as an alternation
// over parts rather than by loosening the character class, so a stray space
// INSIDE a group, a leading space, or a doubled space still fails.
export const SHARE_LINE2 = /^(🧾 )?([🍴➕]{1,5} )*(📄|🏳️)( → ⚖️(✅|❌))?$/u;

/** §1(i): line 1 is the brand + issue number, then the locale's own tagline
 * as the hook. The tagline half is read from the catalog by the specs that
 * check it, so this only pins the invariant half and the separator. */
export const SHARE_LINE1_PREFIX = (n: number) => `P-hackle #${n} · `;
