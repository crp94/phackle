// T9 golden-master generator (master spec §8.2). Regenerates
// tests/determinism/fixtures/<isoDate>.json for the 5 pinned golden dates by
// calling the real, pure engine directly -- no browser, no worker, no mocks.
//
// This is a DRIFT DETECTOR, not a correctness oracle: correctness of the
// underlying numbers (the DGP, the OLS/p-value math, the spec enumeration)
// was already established by T2/T3/T7's own fixtures (checked against
// python/scipy). Re-running this script and diffing its output against the
// committed JSON only tells you that SOMETHING in the deterministic pipeline
// changed since the fixtures were captured -- not whether the new numbers are
// "more right" than the old ones. A real, intentional change to the DGP,
// analysis engine, spec grid, or acceptance loop is expected to require
// regenerating these fixtures; tests/determinism/goldens.test.ts is what
// catches an UNINTENTIONAL change (the whole point of a golden-master test).
//
// Deliberately excludes puzzleNumber (day.ts computes one to satisfy
// DailyPuzzle's required field, but it's EPOCH-derived and EPOCH is
// provisional -- "frozen to real launch date in T25" per src/game/tuning.ts
// -- so it must never gate a golden-master diff) and scenarioId is recorded
// as the numeric scenario index (`scenarioIndexFor20`), never as a raw array
// position anywhere else: see day.ts's hashCurve, which sorts by specKey
// before hashing specifically so the curve array's fixed-but-arbitrary
// iteration order can never become load-bearing for a fixture (T8 review
// ruling).
//
// Run with: PATH="/usr/bin:$PATH" npx tsx scripts/gen_goldens.ts
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDay, hashCurve, hashRows } from '../src/engine/day';
import { enumerateCurve, sigCount } from '../src/engine/specGrid';

const GOLDEN_DATES = ['2026-09-01', '2026-10-31', '2026-12-25', '2027-01-01', '2027-07-04'];
const SCENARIO_COUNT = 20; // production scenario count (T6: 20 English scenarios)
const ROWS_HASHED = 40;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, '..', 'tests', 'determinism', 'fixtures');

for (const isoDate of GOLDEN_DATES) {
  const { puzzle, data } = generateDay(isoDate, SCENARIO_COUNT);
  const curve200 = enumerateCurve(data, 200);

  const fixture = {
    isoDate,
    dayType: puzzle.dayType,
    scenarioIndexFor20: Number(puzzle.scenarioId),
    attemptUsed: puzzle.attemptUsed,
    rows40Hash: hashRows(data, ROWS_HASHED),
    curve200Hash: hashCurve(curve200),
    sigCount200: sigCount(curve200),
  };

  const outPath = join(outDir, `${isoDate}.json`);
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
  console.log(`  ${JSON.stringify(fixture)}`);
}
