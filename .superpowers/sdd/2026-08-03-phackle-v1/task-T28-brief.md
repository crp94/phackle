### Task T28: Design-system foundation — DESIGN.md + disciplined tokens (aesthetics agent)

**Files:** Create `docs/DESIGN.md`; Modify `src/ui/theme/tokens.css` (T1 left it empty-but-imported), `.gitignore` (add `.claude/`); Test `tests/ui/tokens.test.ts`
**Depends:** T1 only — dispatchable alongside wave 1a (touches no wave-1a files). **Master spec:** §7.1, §7.2, §7.5. **Direction:** "Preprint Gothic, Nothing-disciplined" — approved 2026-08-03, recorded in the delta spec: the manuscript language executed with hard restraint.

**Interfaces (produces):** `docs/DESIGN.md` is BINDING on T5, T14–T18, and T29 — their dispatches cite it as law. `tokens.css` custom props are the ONLY color/spacing sources UI code may use (no raw hex outside tokens.css; T29 enforces by grep).

**DESIGN.md must fully author these rules (each with one do / one don't example):**
- **Palette discipline:** surfaces only `--paper`; text only `--ink`/`--muted`; `--sig-red` is the SINGLE loud color (stamp, threshold rule, published path, Act-II p<.05); `--assist-green` + `--hack-gold` appear only inline at text scale (≤1em) and as confetti particles — never as fills, buttons, or backgrounds; dividers only `--rule` 1px hairlines; NO filled boxes, NO shadows, border-radius ≤2px everywhere.
- **Type:** STIX Two Text for display/prose at 22/28/40px, weights 400/500 only; system sans UI labels 13/15px; JetBrains Mono `tabular-nums` for ALL numerals (dial 64–96px responsive, N/df 13px); never bold mono.
- **Spacing scale:** 4/8/12/16/24/40/64px only; 40px section rhythm; hairline-separated stacks instead of cards.
- **Motion budget (exhaustive):** dial tick 120ms, stamp slam 450ms single overshoot, scroll fades 300ms opacity-only, confetti 3s — NOTHING else animates; all gated on reduced-motion.
- **Focus & affordances:** 2px `--ink` outline offset 2px both themes; links underlined; never color-only signals.
- **Dark theme:** §7.2 values (`--paper #141821`, `--ink #E8E4D9`, accents +10% luminance), same discipline.
- **Signature moments:** Act I = the glowing dial; Act II = the stamp. One per act; everything else stays quiet.

**Steps:**
- [ ] **RED**: `tokens.test.ts` — parse `src/ui/theme/tokens.css` as text: all 7 §7.2 custom props defined under `:root`, all dark overrides present under `[data-theme='dark']`; scan `src/ui/**/*.{tsx,css}` for hex colors outside tokens.css (must be zero — trivially true today, binding forever).
- [ ] **Verify fail** → **GREEN**: author tokens.css completely (both themes) + the full DESIGN.md → **Verify pass** (`npx vitest run && npx tsc --noEmit && npm run lint && npm run build`).
- [ ] `chore:` add `.claude/` to `.gitignore` (worktree scratch, currently untracked noise).
- [ ] **Commit** `feat: design-system foundation — DESIGN.md + disciplined tokens (direction A)`.

---

