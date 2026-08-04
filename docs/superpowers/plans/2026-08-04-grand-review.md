# P-hackle Grand Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate P-hackle from "correct and complete" to the standard of the world's best daily puzzle games — then ship exactly that.

**The bar (named once, here, in terms of properties — never in terms of any publication):** learnable inside 30 seconds without reading anything; a complete day playable in under 3 minutes; typography and layout a working designer would screenshot; microcopy people quote to each other; a share grid people *want* to post; flawless on a phone held in one hand; accessible as a first-class experience, not a checklist; zero rough edges — no state, however rare, that looks unfinished.

**Architecture:** four independent REVIEW LANES fan out (code, game, writing, UX/UI), each producing a findings file in a fixed format; one SYNTHESIS agent merges them into a single ranked backlog; the controller triages the backlog into fix tasks executed with the standard fix-loop machinery; a final VERIFICATION wave re-runs every gate. Reviews never fix; fixers never self-assess; every fix is re-reviewed.

**Preconditions:** the v1 pipeline complete through T24 (all merges green, E2E passing, CI live), the SDD final whole-branch review of the v1 plan done, and its ledger of deferred minors available as input. This plan runs BEFORE T25 (deploy).

## Global Constraints

- Findings format (every lane, machine-mergeable): one markdown file per lane at `.superpowers/sdd/2026-08-04-grand-review/findings-<lane>.md`, each finding as `### [lane-###] <title>` + severity (`blocker` / `high` / `polish`) + effort (`S`/`M`/`L`) + file:line or screen/state + evidence + concrete fix shape. No finding without evidence; no evidence without a way to re-check it.
- Severity meanings: `blocker` = would embarrass the game in front of its exact target audience (methods-literate daily players); `high` = a first-week player would notice; `polish` = a returning player might.
- The four lanes run read-only. All fixes flow through controller triage → fix tasks → scoped re-review. The ledger's existing deferred-minors list is lane input, not automatically fixes: each minor gets adjudicated (fix / park-with-ruling / wontfix-with-reasoning).
- Register laws, DESIGN.md, the calibration suite, determinism goldens, and the spoiler rule are inviolable during fixes; a finding whose fix would break one goes back to the controller as a design decision, never gets patched around.
- Every fix task: TDD where testable, full gate (exit-code discipline) before commit, genuine transcripts only.
- Models: all four lanes + synthesis on the top available tier; fix tasks per the established policy (mechanical → sonnet, judgment/writing → opus); scoped re-reviews sonnet.

---

### Task GR1: Code lane — whole-repo quality review

**Inputs:** full repo at the frozen review SHA; the v1 ledger's deferred-minors list; the calibration + golden reports.
**Method:** three sub-passes, one agent each, findings merged into `findings-code.md`:
- [ ] **GR1a Engine:** architecture coherence of `src/engine` (module boundaries, the duplicated calendar/mean helpers the ledger records, dead exports like `generateRows`'s foot-gun), numerical hygiene (every tolerance justified), performance headroom (enumerate + reveal timings on a cold worker), determinism audit (grep-level re-verification of the op-set across ALL engine files at once).
- [ ] **GR1b Game+UI code:** store/screen seams (the resultLog/persist/nav interactions as one system), component size and prop hygiene, CSS coherence (one system, not five agents' dialects — naming, spacing usage, dead rules), bundle composition (`vite build` analysis: what ships, what's lazy, total gz weight vs a 200KB budget), interpolation safety (every `{param}` render path against content-supplied strings).
- [ ] **GR1c Infra:** CI completeness (does every law have an enforcer that runs on PR?), test-suite health (runtime, flakiness surface, the fabrication-precedent evidence spot-checks), the deferred-minors adjudication table (every ledger minor gets a verdict).

### Task GR2: Game lane — does it play like the best?

**Inputs:** the running app (dev server), the engine's deterministic APIs, the calibration report, master spec §1.2's pillars.
**Method:**
- [ ] **GR2a Scripted playthroughs:** drive the REAL engine+store across ≥30 consecutive simulated days (deterministic dates) with three player models (naive knob-turner, greedy hacker, informed caller) — measure: taps to first significance, session length, call accuracy achievable by the informed heuristic, streak-feel (how often does an honest player get REPLICATED?), achievement unlock cadence (does week one produce at least two unlocks?). Compare against the calibration bands and flag any felt-experience gap the bands don't capture.
- [ ] **GR2b Design heuristics:** the daily ritual loop (is there a reason to return tomorrow beyond the streak?), the reveal's emotional arc (does the accounting land AFTER the confetti high?), prereg mode's discoverability and payoff, dead-end states (what does a player who abandons on day one see on day two?), the share grid's legibility to someone who has never played.
- [ ] Findings to `findings-game.md`; anything touching balance constants routes to the controller with the calibration-suite implications stated.

### Task GR3: Writing lane — every string, read aloud

**Inputs:** the full EN catalog + corpus (post-T32), the register laws, the em-dash budget, the About page.
**Method:**
- [ ] **GR3a Line edit:** every user-facing string in the product read in rendered context (not in the catalog): voice consistency across the five agents who wrote them; joke density per screen (Act I should average one genuine laugh per screen; the reveal exactly zero); microcopy (button labels, empty states, error states — the strings nobody reviewed as a set); explanation reading level (a smart 15-year-old must follow every explanation).
- [ ] **GR3b The quotable test:** identify the ten strings players would screenshot; if fewer than ten exist, that's a finding. Identify the ten weakest strings; each gets a proposed replacement in the finding itself.
- [ ] **GR3c Consistency sweep:** terminology (one name per concept across all screens), typographic conventions (decimal points, ± signs, the {effect} frames), IT/ES parity spot-check (10 random strings per locale re-read against the transcreation brief).
- [ ] Findings to `findings-writing.md`. Replacements must pass the shape tests (register, direction contract, em-dash budget) by construction.

### Task GR4: UX/UI lane — every state, every width, both themes

**Inputs:** the running app; DESIGN.md; the T29 polish-pass report; real-device constraints (360px, 768px, 1088px; light+dark; reduced-motion on/off).
**Method:**
- [ ] **GR4a State matrix:** screenshot and judge EVERY reachable state — first-run vs returning, empty history vs 30-day history, practice mode, both stamps + null-reported, locked vs unlocked achievements, the error screen, storage-disabled — at three widths × two themes. Any state that looks unfinished is a finding with the shot attached.
- [ ] **GR4b Flow friction:** count real interactions for: complete a day (target ≤ 12 taps), share a result (≤ 2 from summary), find the Legend (≤ 2 from anywhere), switch language (≤ 2). Time-to-first-meaningful-paint on a throttled profile.
- [ ] **GR4c The one-hand test:** everything reachable and legible with a thumb at 360px — hit targets, sticky behavior, scroll lengths, keyboard avoidance (share sheet). The dial-sticky mechanic verified live.
- [ ] **GR4d A11y as experience:** a full day played with keyboard only and (via static analysis of the accessible tree per screen) the screen-reader narrative — does the REVEAL tell its story in reading order? Findings beyond WCAG minima are in scope.
- [ ] Findings to `findings-ux.md` with shots in `shots-ux/`.

### Task GR5: Synthesis + triage

- [ ] One agent merges the four findings files: dedupe cross-lane findings, rank by (severity, then breadth, then effort), produce `backlog.md` — a single ordered table with a one-line controller-decision column for anything that touches inviolables.
- [ ] Controller triage: every `blocker` and `high` becomes a fix task (batched by file locality, ≤ 5 findings per task); `polish` items get fixed if S-effort and batched, else parked with rulings. The adjudicated deferred-minors verdicts merge into the same batches.

### Task GR6: Fix waves + verification

- [ ] Fix tasks dispatched in file-disjoint parallel batches, standard loop (implement → scoped re-review), worktrees, merge discipline as established.
- [ ] **Final verification wave:** full gate + calibration + goldens + E2E + a fresh GR4a state-matrix diff (before/after shots) + one final whole-branch review on the top tier covering ONLY the grand-review diff.
- [ ] Ledger closed out; then T25 (deploy) proceeds.

## Self-review notes

- The four lanes are read-only and file-disjoint by construction — safe to run fully parallel.
- Findings-format discipline is what makes GR5 mechanical; a lane that free-texts its findings gets sent back before synthesis.
- The bar's properties are stated in the header once; no task may cite any publication or competitor by name in any artifact, prompt, or commit.
- Fix-wave scope control: the backlog is closed at triage; new discoveries during fixes go to the ledger for a possible second triage, never straight into a fix task ("while I'm here" is how polished builds rot).
