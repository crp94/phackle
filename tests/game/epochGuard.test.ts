// T24 CI finalize — the EPOCH guard, booked from T23's review.
//
// e2e/harness.ts pins ONE fixed instant (PUZZLE_ISO = '2026-08-14') as
// "today" for the whole Playwright flow suite. daily.ts's `isPractice()`
// treats any real date STRICTLY BEFORE `tuning.ts`'s EPOCH as practice mode:
// a fresh `Math.random()` seed every load (so no two runs share a puzzle),
// negative puzzle numbers, and the entire persistence path
// (`Summary`'s saveDay/saveAchievements) skipped. The whole e2e suite's
// claim — that it exercises the REAL daily-puzzle product, not practice mode
// — depends entirely on PUZZLE_ISO landing after EPOCH.
//
// T25 will freeze EPOCH to the real launch date. If that freeze ever lands
// ON OR AFTER this stale PUZZLE_ISO, every e2e flow would silently degrade
// into practice mode — and, because practice mode still renders a full game,
// the suite would keep reporting green while testing nothing real. This
// test is the tripwire: a cheap, fast assertion that fails LOUDLY, with the
// exact dates in the message and a pointer to both files to fix, instead of
// letting that happen quietly.
//
// gr6-051 adds a SECOND EPOCH tripwire below, for the determinism goldens.
// Same failure shape, different file: `src/engine/seeds.ts`'s
// `scenarioIndexFor` gates the 14-day no-repeat exclusion walk on
// `iso > EPOCH`, so a golden fixture date that EPOCH has caught up with takes
// a different scenario, and every hash in that fixture moves with it. That
// makes `tests/determinism/goldens.test.ts` a lagging indicator (a wall of
// hash mismatches at some later point); this is the leading one, and it names
// the fix.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PUZZLE_ISO, PUZZLE_NUMBER } from '../../e2e/harness';
import { scenarioIndexFor } from '../../src/engine/seeds';
import { daysBetween, puzzleNumber } from '../../src/game/daily';
import { EPOCH } from '../../src/game/tuning';

describe('EPOCH guard — e2e/harness.ts PUZZLE_ISO vs. src/game/tuning.ts EPOCH', () => {
  it('PUZZLE_ISO is strictly after EPOCH (bare-string compare, independent of daysBetween)', () => {
    // Lexicographic comparison on bare `YYYY-MM-DD` strings sorts identically
    // to calendar order, so this does not lean on daily.ts's own date math to
    // check daily.ts's own precondition.
    expect(
      PUZZLE_ISO > EPOCH,
      `EPOCH GUARD FAILED: e2e/harness.ts's PUZZLE_ISO ('${PUZZLE_ISO}') is not strictly after ` +
        `src/game/tuning.ts's EPOCH ('${EPOCH}'). daily.ts's isPractice() treats any real date ` +
        `before EPOCH as practice mode, which would silently degrade every e2e flow (hack/abandon/` +
        `prereg/i18n) into practice mode: fresh Math.random() seeds, negative puzzle numbers, no ` +
        `persistence — and the suite would keep reporting green while testing nothing real. ` +
        `Fix: bump PUZZLE_ISO in e2e/harness.ts (and its PUZZLE_NUMBER/scenario comments) to a date ` +
        `strictly after the new EPOCH.`,
    ).toBe(true);
  });

  it('daysBetween(EPOCH, PUZZLE_ISO) is positive, and matches harness.ts\'s own PUZZLE_NUMBER comment', () => {
    const gap = daysBetween(EPOCH, PUZZLE_ISO);
    expect(
      gap,
      `EPOCH GUARD FAILED: daysBetween(EPOCH='${EPOCH}', PUZZLE_ISO='${PUZZLE_ISO}') = ${gap}, not > 0. ` +
        `This is the same arithmetic daily.ts's puzzleNumber()/isPractice() use in production, so a ` +
        `non-positive gap here means the e2e suite's fixed day IS the practice-mode boundary.`,
    ).toBeGreaterThan(0);

    // Belt-and-braces: harness.ts hand-comments `PUZZLE_NUMBER = 5; //
    // daysBetween(EPOCH, PUZZLE_ISO) + 1`. If EPOCH moves and that comment is
    // not updated alongside it, this catches the drift too.
    expect(
      PUZZLE_NUMBER,
      `e2e/harness.ts's exported PUZZLE_NUMBER (${PUZZLE_NUMBER}) no longer matches ` +
        `puzzleNumber(PUZZLE_ISO) computed from the current EPOCH ('${EPOCH}') = ${puzzleNumber(PUZZLE_ISO)}. ` +
        `Update the PUZZLE_NUMBER constant (and its comment) in e2e/harness.ts.`,
    ).toBe(puzzleNumber(PUZZLE_ISO));
  });
});

// gr6-051 / gr1c-005. Read off the fixtures DIRECTORY rather than off a list
// hardcoded here, deliberately: a sixth golden added to
// `scripts/gen_goldens.ts` must fall under this guard the moment its fixture
// lands, without anyone remembering to also edit a test.
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'determinism', 'fixtures');
const GOLDEN_DATES = readdirSync(FIXTURE_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

/** Must match `scripts/gen_goldens.ts` (and `tests/determinism/goldens.test.ts`). */
const SCENARIO_COUNT = 20;

function committedScenarioIndex(iso: string): number {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${iso}.json`), 'utf8')).scenarioIndexFor20 as number;
}

const FIX = `Fix: re-run \`scripts/gen_goldens.ts\` and COMMIT the regenerated tests/determinism/fixtures/*.json — a deliberate act, and an explicit deploy-day step whenever EPOCH moves. Otherwise tests/determinism/goldens.test.ts fails later as a wall of hash mismatches with no explanation of why.`;

describe('EPOCH guard — tests/determinism/fixtures vs. src/game/tuning.ts EPOCH', () => {
  it('finds the committed golden fixtures at all (a guard over an empty set guards nothing)', () => {
    expect(
      GOLDEN_DATES.length,
      `no YYYY-MM-DD.json fixtures found under ${FIXTURE_DIR} — either the goldens moved, or this ` +
        `guard is now scanning the wrong directory and silently passing over nothing.`,
    ).toBeGreaterThanOrEqual(5);
  });

  it('every golden fixture date is strictly after EPOCH (necessary condition, bare-string compare)', () => {
    // Lexicographic comparison on bare `YYYY-MM-DD` strings sorts identically
    // to calendar order — same reasoning as the PUZZLE_ISO guard above, and
    // the same comparison `scenarioIndexFor` itself performs.
    const stale = GOLDEN_DATES.filter((iso) => !(iso > EPOCH));
    expect(
      stale,
      `EPOCH GUARD FAILED: ${stale.length} golden fixture date(s) — ${stale.join(', ')} — are no longer ` +
        `strictly after src/game/tuning.ts's EPOCH ('${EPOCH}'). scenarioIndexFor gates its 14-day ` +
        `no-repeat exclusion walk on \`iso > EPOCH\`, so a date at or before EPOCH is the base case and ` +
        `takes its UNWALKED scenario index: these fixtures now pin a different scenario than the engine ` +
        `produces, and therefore a different dayType, attemptUsed, rows40Hash, curve200Hash and ` +
        `sigCount200. ${FIX}`,
    ).toEqual([]);
  });

  // The check above is NECESSARY BUT NOT SUFFICIENT, and this is measured, not
  // assumed. scenarioIndexFor's exclusion walk recurses back through every
  // date after EPOCH, so an EPOCH move perturbs the whole chain, not just the
  // dates it has overtaken. Holding today's fixtures fixed and sweeping EPOCH
  // day by day: the goldens are unchanged for EPOCH up to 2026-08-23, and
  // FOUR of the five (all but 2027-07-04, which is unchanged by coincidence)
  // move from EPOCH = 2026-08-24 onward — eight days before the earliest
  // golden date, i.e. while the strictly-after check above is still green.
  //
  // So the sufficient tripwire is this one: recompute each fixture's scenario
  // index against the CURRENT EPOCH and compare it with the committed value.
  // It costs a few hundred memoized hashes (no dataset generation, no spec
  // enumeration), and unlike goldens.test.ts's whole-object diff it says what
  // broke and what to do about it.
  it('every fixture\'s committed scenarioIndexFor20 still matches scenarioIndexFor() under the current EPOCH', () => {
    const drifted = GOLDEN_DATES.map((iso) => ({
      iso,
      committed: committedScenarioIndex(iso),
      fresh: scenarioIndexFor(iso, SCENARIO_COUNT),
    }))
      .filter((r) => r.committed !== r.fresh)
      .map((r) => `${r.iso}: fixture pins scenario ${r.committed}, current EPOCH ('${EPOCH}') yields ${r.fresh}`);

    expect(
      drifted,
      `EPOCH GUARD FAILED: ${drifted.length} golden fixture(s) no longer name the scenario the engine ` +
        `picks for their date. src/engine/seeds.ts's scenarioIndexFor gates its 14-day no-repeat ` +
        `exclusion walk on \`iso > EPOCH\`, so moving EPOCH re-indexes the chain of days after it — the ` +
        `scenario selects the whole day, so every hash in these fixtures moved with it. ${FIX}`,
    ).toEqual([]);
  });
});
