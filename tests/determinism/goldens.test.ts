// Master spec §8.2 (golden-master determinism suite). Guards against
// UNINTENTIONAL drift in the deterministic pipeline (DGP -> analysis ->
// spec-curve enumeration -> acceptance loop): regenerating each of the 5
// pinned golden dates in-process, right now, from the current source tree,
// must reproduce the exact fixture bytes committed at
// tests/determinism/fixtures/<isoDate>.json (produced by
// scripts/gen_goldens.ts). This is a drift detector, not a correctness
// oracle -- correctness of the underlying numbers came from T2/T3/T7's own
// fixtures (checked against python/scipy); a real, intentional change to the
// DGP/analysis/spec-grid/acceptance logic is expected to require
// regenerating these fixtures (re-run scripts/gen_goldens.ts and commit the
// new JSON), which is a deliberate act, not something this test should let
// slip by silently.
//
// Fixture shape is keyed entirely by specKey/explicit field names, never by
// raw curve-array position (T8 review ruling: enumerateCurve's iteration
// order is fixed-but-arbitrary and must never become load-bearing) --
// curve200Hash sorts by specKey before hashing (see day.ts's hashCurve), and
// this fixture object itself only ever names fields, never indices.
//
// Deliberately excludes puzzleNumber: day.ts computes one (to satisfy
// DailyPuzzle's required field), but it's EPOCH-derived and EPOCH is
// provisional ("frozen to real launch date in T25" per src/game/tuning.ts), so
// pinning it here would mean re-hashing a fixture for a field the suite is not
// about.
//
// THIS SUITE IS *NOT* EPOCH-INDEPENDENT, and an earlier version of this comment
// said it was (gr6-051 / gr1c-005). Excluding puzzleNumber removes ONE
// EPOCH-derived input; it does not remove the other. `src/engine/seeds.ts`'s
// scenarioIndexFor gates the 14-day no-repeat exclusion walk on `iso > EPOCH`:
// a date at or before EPOCH is the base case (no game history yet) and takes
// its unwalked index; a date after it walks, and its walk recurses back
// through every date after EPOCH. The scenario selects the WHOLE day, so when
// it moves, dayType/attemptUsed/rows40Hash/curve200Hash/sigCount200 all move
// with it -- the entire fixture.
//
// Measured by sweeping EPOCH day by day against today's committed fixtures
// (current EPOCH = 2026-08-10, src/game/tuning.ts):
//   EPOCH <= 2026-08-23   all five fixtures unchanged
//   EPOCH >= 2026-08-24   FOUR of the five change (2026-09-01, 2026-10-31,
//                         2026-12-25, 2027-01-01; 2027-07-04 is unchanged by
//                         coincidence, not by design)
// The exact replacement index depends on the EPOCH chosen -- e.g. 2026-12-25's
// scenario is 5 today, 4 at EPOCH 2026-09-01, 2 at 2026-09-15 and 19 once
// EPOCH is past the date itself. Note the break begins EIGHT DAYS BEFORE the
// earliest golden date, so "every golden date is after EPOCH" is a necessary
// but NOT sufficient condition.
//
// The guard against all of this is not here -- a broken fixture here is the
// symptom, in the form of a whole-object diff that never mentions EPOCH. It is
// `tests/game/epochGuard.test.ts`, which checks both conditions (dates after
// EPOCH, and each fixture's committed scenarioIndexFor20 still matching a live
// scenarioIndexFor() call) and names `scripts/gen_goldens.ts` in the failure
// message. Regenerating and committing the goldens is therefore an explicit
// deploy-day step whenever EPOCH moves.
import { describe, expect, it } from 'vitest';
import { generateDay, hashCurve, hashRows } from '../../src/engine/day';
import { enumerateCurve, sigCount } from '../../src/engine/specGrid';
import fixture20260901 from './fixtures/2026-09-01.json';
import fixture20261031 from './fixtures/2026-10-31.json';
import fixture20261225 from './fixtures/2026-12-25.json';
import fixture20270101 from './fixtures/2027-01-01.json';
import fixture20270704 from './fixtures/2027-07-04.json';

const SCENARIO_COUNT = 20; // production scenario count (T6: 20 English scenarios) -- must match scripts/gen_goldens.ts
const ROWS_HASHED = 40;

const GOLDEN_FIXTURES: Record<string, typeof fixture20260901> = {
  '2026-09-01': fixture20260901,
  '2026-10-31': fixture20261031,
  '2026-12-25': fixture20261225,
  '2027-01-01': fixture20270101,
  '2027-07-04': fixture20270704,
};

describe('golden-master fixtures — in-process regeneration matches committed bytes (§8.2)', () => {
  for (const [isoDate, committed] of Object.entries(GOLDEN_FIXTURES)) {
    it(`${isoDate}: generateDay + hashRows/hashCurve reproduce the committed fixture exactly`, () => {
      const { puzzle, data } = generateDay(isoDate, SCENARIO_COUNT);
      const curve200 = enumerateCurve(data, 200);

      const fresh = {
        isoDate,
        dayType: puzzle.dayType,
        scenarioIndexFor20: Number(puzzle.scenarioId),
        attemptUsed: puzzle.attemptUsed,
        rows40Hash: hashRows(data, ROWS_HASHED),
        curve200Hash: hashCurve(curve200),
        sigCount200: sigCount(curve200),
      };

      expect(fresh).toEqual(committed);
    });
  }

  it('every fixture has the pinned field set and nothing else (no puzzleNumber, no raw-index fields)', () => {
    for (const committed of Object.values(GOLDEN_FIXTURES)) {
      expect(Object.keys(committed).sort()).toEqual(
        ['attemptUsed', 'curve200Hash', 'dayType', 'isoDate', 'rows40Hash', 'scenarioIndexFor20', 'sigCount200'].sort(),
      );
    }
  });
});
