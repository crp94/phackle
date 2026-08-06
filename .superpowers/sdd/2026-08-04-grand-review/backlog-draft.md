# backlog-draft.md — GR6-ready, 79 rows (GR1c)

Authored by lane GR1c (write blocked; persisted by controller). Ordering: severity → breadth → effort. **Pre-adjudicated verdicts carry over unrelitigated**; rows sourced from the final review were marked `VERDICT-UNRECOVERED` by the lane because the final-review text was off-disk — **controller resolution: the full final-review text has since been recovered and persisted at `final-whole-branch-review.md` in this directory; GR5 should use it as the authoritative source and treat §F as a cross-check.** Merge slots left for lanes whose findings GR1c could not see.

## §A — GR1c findings

| id | title | sev | eff | files | fix shape | source |
|---|---|---|---|---|---|---|
| gr1c-001 | Final-review findings + adjudication table exist nowhere on disk | blocker | M | ledger:228, .gitignore:31 | RESOLVED by controller recovery → `final-whole-branch-review.md`; process fix (persist review outputs to files) still open | GR1c |
| gr1c-013 | 87% of suite wall time is `expect()` overhead (dgp 31.4s of 36s) | high | S | tests/engine/dgp.test.ts:185-226 | shared 200-seed sweep + plain-JS scan, one assert; 36s→~11s | GR1c |
| gr1c-024 | Prereg spoiler guards-the-guard compares f(x) to f(x) | high | M | tests/game/share.test.ts:424-457 | drive real `preregCommit()` on sig/non-sig days, or make the structural claim structural | GR1c + T18 ledger:165 |
| gr1c-005 | Goldens ARE EPOCH-sensitive; test + plan comments claim otherwise | high | S | seeds.ts:104, goldens.test.ts:22-26, plan:308 | correct comments; extend epochGuard to assert every golden date > EPOCH | GR1c ≡ final-003 |
| gr1c-004 | Calibration never gates a push; "expensive" rationale disproved (33-42s) | high | M | .github/workflows/calibration.yml:3-9 | add cal job to test.yml (paths-gated if needed); correct the header claim | GR1c |
| gr1c-002 | Six DESIGN Tier-C laws have no automated enforcer | high | S | DESIGN.md:710-724 | one `it` per grep in tokens.test.ts; move rules to Tier A | GR1c |
| gr1c-003 | Two Tier-C commands unrunnable (R6.5 false positive; 768px off closed list) | high | S | DESIGN.md:713-716,723,726-731 | strip comments; exclude @media preludes; name the breakpoint | GR1c |
| gr1c-006 | No `engines` field; wrong Node fails 270 tests | high | S | package.json, .npmrc, README | `engines: >=22.22.2 <23` + `engine-strict=true` | GR1c |
| gr1c-014 | dgp timeout rationale off by 5.5x ("1.7-2.0s solo" vs 10,948ms) | high | S | tests/engine/dgp.test.ts:174-185 | delete timeout after gr1c-013, else correct the numbers | GR1c |
| gr1c-027 | README documents no commands, runtime, or e2e prerequisite | high | S | README.md | `## Development` section, ~15 lines | GR1c |
| gr1c-016 | Validator re-registration: 88 dup tests / 1,300ms measured | polish | S | it.shape:24-33, es.shape:25-33, shape.test.ts | extract to `tests/content/validators.ts` | GR1c ≡ final-014 ≡ A4-parked |
| gr1c-026 | T7 CI property test branches on `df>0` not `result.valid` | polish | S | tests/engine/analyze.test.ts:427-439 | branch on `.valid`; reconcile definitions once; assert both branches hit | T7 ledger:55 |
| gr1c-022 | StrictMode guard test never enters StrictMode | polish | S | router.test.tsx:215-237 | wrap render in `<StrictMode>`; keep rerender case; mutation-verify | T14 ledger:122 |
| gr1c-020 | No `forks === countForks(log)` invariant test (7 recompute sites) | polish | S | store.ts:248…440, store.test.ts | scripted-session invariant test | T12 ledger:61 |
| gr1c-019 | 3 brittle exact-string throw assertions | polish | S | store.test.ts:491,518,558 | export `STORE_ERR` constants | T12 ledger:61 |
| gr1c-023 | No `length===window` rolling-window boundary test | polish | S | statsAgg.test.ts:16-76 | 20-day and 21-day cases | T17 ledger:129 |
| gr1c-025 | touch-test-3 non-discriminating | polish | S | lab.test.tsx:1153-1165 | rename, or add the no-mouseLeave discriminating case | T29 ledger:188 |
| gr1c-007 | No axe scan in the repo | polish | S | package.json, e2e/ | `@axe-core/playwright` + one e2e spec | GR1c |
| gr1c-009 | `scripts/` untypechecked; `.mjs` unlinted | polish | S | tsconfig.json:24, eslint.config.js:34 | add `scripts` to include; `**/*.mjs` glob | T9+T24 ledger:81,225 |
| gr1c-011 | 360px overflow law covers 2 of 12 cells | polish | S | e2e/booked.spec.ts:29-33 | parametrize locale × width × screen | T33 ledger:193 |
| gr1c-008 | No bundle-size budget check (112 KB gz today) | polish | S | test.yml, scripts/ | `check-bundle.ts` step | GR1c |
| gr1c-010 | No concurrency group, floating tags, no dependabot/audit | polish | S | .github/ | concurrency block + dependabot.yml | GR1c |
| gr1c-012 | `npm run cal` mutates a tracked file, no `--check` | polish | S | simulate_calibration.ts:589-590 | `--write` flag, or CI `git diff --exit-code` | GR1c |
| gr1c-021 | `useGameStore` wrapper untested directly | polish | S | store.ts:484 | 3-line test **or wontfix** (indirect coverage real) | T12 ledger:61 |
| gr1c-015 | Nothing else near its timeout — informational | — | — | — | no action | GR1c |
| gr1c-017 | Flake surface green in 6 configurations — informational | — | — | — | no action | GR1c |
| gr1c-018 | 3 fabrication spot-checks re-verified genuine — informational | — | — | — | no action | GR1c |

## §B — Final whole-branch review carryover

**Controller note: full text now recovered at `final-whole-branch-review.md` — final-004..016 are no longer lost; GR5 merges from that file.**

| id | title | sev | eff | files | fix shape | source |
|---|---|---|---|---|---|---|
| final-001 | About page discloses analytics that do not exist | high | S | src/content/*/copy.ts, About.tsx | either install `@vercel/analytics` at T25 or cut the claim; **unskippable T25 checklist step** | ledger:228 |
| final-002 | `isValidV1` shallow → NaN-poisoned stats | high | S | src/game/storage.ts | deep-validate persisted numerics; reject/repair NaN | ledger:228 |
| final-003 | Goldens EPOCH-sensitive; plan:308 claim FALSE | high | S | see gr1c-005 | **merged into gr1c-005 (independently reproduced, table of 5 dates)** | ledger:228 |
| final-004..016 | 13 polish findings — text recovered (see controller note) | ? | ? | ? | GR5 merges from `final-whole-branch-review.md` | ledger:228 / gr1c-001 |

## §C — A4-parked taste/deferred items (plan:87), all requiring a verdict

| id | title | sev | eff | lane | source |
|---|---|---|---|---|---|
| a4-01 | dial-settle 2px restraint — keep or cut | polish | S | GR4 | T35 review, ledger:202,204 — **OWNER RULED: amplify within R8.1 (see §D)** |
| a4-02 | header 3-row height at 360 (267→318 w/ wrap) | polish | M | GR4 | T33, ledger:193 — **OWNER RULED: accepted as-is (see §D)** |
| a4-03 | dual Legend-named buttons | polish | S | GR4 | T22, ledger:209 |
| a4-04 | nested dialog on published path | polish | M | GR4/GR1b | T22, ledger:207 |
| a4-05 | masthead watermark head-vs-foot anatomy | polish | S | GR4 | T16-M4, ledger:180 — **OWNER RULED: leave as-is (see §D)** |
| a4-06 | practice mode prints "Vol. 1, No. -5" (negative puzzle number, read aloud) | polish | S | GR1b/GR2 | T22, ledger:207 — see gr1b-003/gr1b-004 |
| a4-07 | 320w residual overflow (8px, outside header) | polish | S | GR4 | T33, ledger:193 |
| a4-08 | `pressForDay()` refactor + press reachability test | polish | M | GR1b | T39a, ledger:210 |
| *(a4-09 validator extraction ≡ gr1c-016)* | | | | GR1c | done above |

## §D — Owner-taste questions — ALL FIVE ANSWERED BY CARLOS 2026-08-06 (ledger entry "OWNER RULINGS 2026-08-06"; these outrank lane recommendations)

| id | question | RULING |
|---|---|---|
| own-01 | dial-settle: keep or cut | **AMPLIFY within R8.1** (no glow/halo/pulse; e.g. numeral weight-snap on band change) → GR6 fix item; GR4 advises shape only |
| own-02 | header 3 rows at 360 — acceptable? | **ACCEPTED as-is** — redesign off the table unless a functional defect is found |
| own-03 | IT/ES Hayek chyron 7 lines vs EN 4 | **FINE AS-IS** — closed |
| own-04 | watermark anatomy | **LEAVE AS-IS** — wontfix confirmed |
| own-05 | should prereg days fire hack-only achievements? | **KEEP THE WALL** — wontfix confirmed; owner did NOT choose the add-prereg-medals expansion |

## §E — Merge slots (lanes not visible to GR1c)

| id | reserved for | status |
|---|---|---|
| slot-GR1a | engine lane — architecture, numerical hygiene, perf, determinism audit, A2 scientific-accuracy checks | pending |
| slot-GR1b | game+UI code lane — store/screen seams, component size, CSS coherence, bundle composition, interpolation safety | **IN — `findings-code-gameui.md` (0 blocker / 8 high / 17 polish / 1 verification record)** |
| slot-GR2 | game lane — playthroughs, ritual loop, reveal arc, press-mix seam (→ possible T39c) | pending |
| slot-GR3 | writing lane — line edit, quotable test, consistency + A1 IT/ES chrome | pending |
| slot-GR4 | UX/UI lane — state matrix, flow friction, one-hand, a11y-as-experience | pending |

## §F — Ledger deferred-minors (30 lines, ~95 items) — reconstructed from ledger; cross-check against the recovered adjudication table in `final-whole-branch-review.md`

One row per ledger line; each line's items preserved verbatim in the ledger at the cited number.

| id | task | ledger line | items (count) | lane |
|---|---|---|---|---|
| lm-01 | T1 | :10 | recursion depth, DST test, leap-day helpers, npx-vs-scripts (4) | GR1a |
| lm-02 | T28 | :27 | word-boundary doc-drift check, §0 count, manual-grep weakness (3) | GR1c/GR1b |
| lm-03 | T2 | :36 | Float64Array phrasing, n=31 "exact" (2) | GR1a |
| lm-04 | T3 | :38 | `generateRows` foot-gun, diff-in-diff 1 of 4 outcomes, Y4 clamp, `t5Scale` name, TDD evidence (5) | GR1a |
| lm-05 | T4 | :40 | journals capitalization, `correspondingAuthor`, scope read, validator-in-test-file (4) | GR3/GR1c |
| lm-06 | T6 | :52 | jigsaw headline, KLOC label, noun repetition, slot-1 device, cover-story template, 13-mortgage, US/UK orthography, grantwell claim, harm scope, direction fixture (10) | GR3 |
| lm-07 | T7 | :55 | df>0 branch **(≡gr1c-026)**, commit-body line (2) | GR1c |
| lm-08 | T6 | :59 | 3× "still", label-maker tense (2) | GR3 |
| lm-09 | T12 | :61 | brittle strings **(≡gr1c-019)**, pending-after-abandon, forks invariant **(≡gr1c-020)**, singleton **(≡gr1c-021)** (4) | GR1c/GR1b |
| lm-10 | T5 | :66 | header vol-line mono, local TFunction dup (2) | GR4/GR1b |
| lm-11 | T8 | :70 | unfrozen `AXES.covariates`, digit-encoding dup (2) | GR1a |
| lm-12 | T9 | :81 | `daysFromCivil` dup, gen_goldens exit path, SCENARIO_COUNT triplicated, leap-day cross-check, scripts/ tsconfig **(≡gr1c-009)** (5) | GR1a/GR1c |
| lm-13 | T13 | :83 | ModeHistory dup, loadStats untested, symbolic-constant asserts, tie-break assumption, double loadState, per-key save (6) | GR1b |
| lm-14 | T9 | :87 | cap-exhaustion tie-break untested, scratchpad script (2) | GR1a |
| lm-15 | T21 | :95 | favicon `<rect>`, unescaped `<` in meta (2) | GR1b |
| lm-16 | T21 | :99 | fc-list substring match, stale citation (2) | GR1c |
| lm-17 | T10 | :101 | family-density denominator 448, N_SCHEDULE rationale, "all-invalid curve" name (3) | GR1a |
| lm-18 | T21 | :105 | truthy/nullish prose, self-audit enumeration (2) | — (doc) |
| lm-19 | T11 | :108 | spoiler 1-spec scan, `idx===-1` string reuse, trueBeta doc note (3) | GR1a |
| lm-20 | T16 | :117 | plotInset/wrapLabel unpinned + dead export, leader anchor, uppercased title, hover 1792 re-renders, `volume:1`, truth line, "Fig." in mono, test attrs shipped (8) | GR1b/GR4 |
| lm-21 | T14 | :122 | ForkTrail trail-walk dup, footnote co-presence, StrictMode guard **(≡gr1c-022)** (3) | GR1b/GR1c |
| lm-22 | T15 | :124 | empty-overlay claim, header not inert, test title, watermark DOM order, pickJournal check (5) | GR1b/GR4 |
| lm-23 | T16 | :126 | initial-width frame, pointerleave on touch, I2 fixture naming (3) | GR1b/GR4 |
| lm-24 | T17 | :129 | histogram aria-label on role-less span, rolling-window boundary **(≡gr1c-023)**, `stats.avgScore` dangling (3) | GR1c/GR3 |
| lm-25 | T14 | :133 | DESIGN R5.1 stale opacity word (1) | GR1b (doc) |
| lm-26 | T15 | :137 | monotonicity sampling, "already used" framing, altmetric sizing (3) | GR1b/GR4 |
| lm-27 | T30 | :148 | decisiveTails comment, unreachable changed-tracking (2) | GR1a |
| lm-28 | T31 | :153 | tap targets, Got-it affordance, jargon, stale shots, baseline viewBox, dial numeral wrap (6) | GR4/GR3 |
| lm-29 | T18 | :160 | hack-only achievements from prereg **(≡own-05, RULED wontfix)**, RadioGroup disabled keydown (2) | GR2/GR1b |
| lm-30 | T31 | :164 | practice-seed label (Math.random ⇒ no exact repro) (1) | GR1c |

Plus two re-review "Low accepted" items parked at ledger:188 — touch-test-3 **(≡gr1c-025)** and the 154-vs-153 arithmetic nit in `DESIGN.md`/`Lab.css` (doc, S, GR1b).

**Row count: 79** (27 §A + 4 §B + 8 §C + 5 §D + 5 §E + 30 §F).
