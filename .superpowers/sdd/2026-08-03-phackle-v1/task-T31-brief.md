### Task T31: Lab data visual + inline explanations (player-feedback round, opus)

**Files:** Modify `src/engine/analyze.ts` + `src/engine/protocol.ts` (PathResult gains optional `cut`), `src/engine/worker.ts` if needed, `src/ui/screens/Lab.tsx`, `src/ui/components/CoefPlot.tsx`, `src/content/en/copy.ts` (+union); Create `src/ui/components/DataCut.tsx`; Test `tests/ui/dataCut.test.tsx` + extensions
**Depends:** screen wave merged. **Master spec:** §2.4's "a tiny scatter/box visual of the current cut" (dropped from the original T14 plan — restored per Carlos's play-test feedback: "needs graphs; and explanations; feels too barebone").

**Pins:**
- Engine: `PathResult.cut?: { treated: number[]; control: number[]; excludedTreated: number[]; excludedControl: number[] }` — the TRANSFORMED outcome values of the current filtered window, split by treatment, excluded points separated (§6 extend-not-contradict; document). Spoiler-safe by construction (no truth fields; the existing protocol spoiler scan must keep passing — extend it to assert `cut` carries only number arrays). Deterministic; ≤400 values total.
- `DataCut.tsx`: two-column strip plot (control | treated), seeded deterministic horizontal jitter (fnv1a32 of value index — NO Math.random), included points as filled `--ink` dots (r ≈ var(--dot-explored)), EXCLUDED points as hollow crossed marks in `--muted` — outlier surgery must be VISIBLE, not silent; group mean bars; height ≤ the dial's; DESIGN law throughout (data region rules per the SpecCurve precedent); scale-invariance per T16's viewBox-tracks-container mechanism (reuse the pattern); labels from scenario content.
- Explanations: six one-line methods notes under each SpecControls group — new copy keys `lab.explain.{outcome,subgroup,covariates,exclusion,transform,tails}` — Act-I sincere register (what the knob does, never why it's naughty; the reveal owns that); quiet caption styling. Plus a first-run collapsible intro (`lab.howThisWorks.title` + `.body`, ~3 sentences: one dataset, find p < .05, submit — pointer to Legend), dismissed state persisted as `settings.introSeen?: boolean` (schema extension, documented; via storage.ts saveSettings).
- CoefPlot: gains an axis label + zero-line label (copy keys), sized to read as a figure.
- All new copy keys listed in the report for the T19/T20 roster.

**Steps:** RED engine (cut contents for a hand-computed micro case incl. exclusion split; spoiler scan extension) → GREEN → RED DataCut (column split, excluded rendering, determinism of jitter, mean bars) + explanations (six notes render from keys; intro shows once, dismiss persists, never re-renders once seen) → GREEN → full gate → commits.

