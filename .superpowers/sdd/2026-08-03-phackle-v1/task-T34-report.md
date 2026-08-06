# Task T34 — compound-emoji rendering audit

**Base:** `8ab428a` (Merge T29: visual polish pass) · **Commit:** `e43383d` on branch `task-t34`
**Files touched:** `src/ui/components/ForkTrail.tsx`, `src/ui/components/GlyphMark.{tsx,css}` (new),
`src/ui/screens/Legend.tsx`, `tests/ui/{glyphMark,legend,lab}.test.tsx`.
**Not touched:** `src/game/share.ts`, `App.tsx`/shell/header/nav, `Reveal.tsx`, locale/i18n files, content files.

---

## 0. Orientation

Worked in `.claude/worktrees/task-t34`, verified `git log -1` → `8ab428a` before any edit.
`PATH="/usr/bin:$PATH"` (node v22.22.1) on every node/npm/npx command throughout.

## 1. The owner's finding, and what T29 already did about it

The owner directive cites a concrete instance: a pre-T29 shot with ✅ overprinting the "C" of
"Call was correct". That shot is real — it's `⚖️✅`/`⚖️❌` (`CALL_CORRECT`/`CALL_INCORRECT`,
`src/game/share.ts`), a scales glyph immediately followed by a check/cross, rendered next to its
Legend-row label. **T29 already found and fixed this exact bug** (its own finding M5): the glyph
column was `width: 2ch` with `flex: none`, a hard box that let the two-glyph compound overflow its
own box (visible content painting past a fixed-width box, since `overflow` defaults to `visible`)
into the label column. T29's fix — `min-width: 2ch` — lets the box grow to fit its content instead,
which removes the overflow.

**Reproduced-then-verified-fixed, with the actual pre/post screenshots:**
`/home/carlos/PycharmProjects/phackle/.superpowers/sdd/2026-08-03-phackle-v1/task-T29-shots/legend-360-paper-before.png`
shows the bug exactly as described (✅ over the "C", ❌ over the "C" of "Call was incorrect");
`legend-360-paper-after.png` shows it fixed. Both were inspected directly as part of this audit.

## 2. Full audit — every emoji-adjacent-to-text/emoji render site

Enumerated via `grep -rnP '[\x{1F000}-\x{1FFFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}...]'` over
`src/ui` and `src/content`, plus a full read of `share.ts`, `ForkTrail.tsx`, `Legend.tsx`,
`Summary.tsx`, `Stats.tsx`, and a grep of `Reveal.tsx`/`Call.tsx`/`Published.tsx`/`Prereg.tsx` for
emoji ranges (all four: **clean, no hits**).

| Site | Compound glyph present? | Reproduced overlap on Linux/Chromium? | Action |
|---|---|---|---|
| **Legend page rows** (`Legend.tsx`, all 7 deduped entries incl. `⚖️✅`/`⚖️❌`) | Yes (2 of 7 rows) | **No** — measured 16px clean gap at every width×theme (see §3) | Fixed: routed through `GlyphMark` (letter-spacing) |
| **ForkTrail popover key** (`ForkTrail.tsx`'s `TrailKey`, same 7 `LEGEND_ENTRIES`) | Yes (2 of 7 rows) | **No** — measured 12px clean gap at every width×theme | Fixed: routed through `GlyphMark` |
| **ForkTrail live trail run** (`.ph-fork-trail__glyphs`) | No — only single-cluster glyphs (`🧾`,`🍴`,`➕`,`📄`,`🏳️`); `CALL` entries contribute nothing to this trail (see `share.ts`'s own doc comment) | N/A | No change — already has its own `letter-spacing: var(--tracking-label)` since T29 pin 11-b |
| **Summary share-string preview** | N/A | N/A | **No such render site exists.** `shareText` (the 4-line grid incl. `" → ⚖️✅"`) is computed in `Summary.tsx` but used ONLY as the argument to `shareViaNavigator()` (clipboard/`navigator.share`) — confirmed by a full read of `Summary.tsx` plus `grep -n "shareText" src/ui` (every hit is prop plumbing or the `handleShare` call, none is JSX text). There is nothing visible to fix or screenshot. |
| **Reveal / Call / Published / Prereg** | No emoji anywhere (grep clean) | N/A | No change. The RETRACTED/REPLICATED stamp is SVG-drawn text, not a unicode glyph. |
| **Achievements** (`Stats.tsx`) | No — `★` (single, aria-hidden) and `▦▦▦` (single glyph repeated 3×, aria-hidden, no adjacent visible text) | N/A | Checked, not a compound-emoji site. `.ph-stats__ach-mark` already carries an explicit `margin-inline-end: var(--space-8)` (pre-existing, T18/T30-era) — already exactly the "explicit trailing gap" pattern this task asks for elsewhere. No change needed. |

**Screenshot matrix captured:** Legend page and Lab's fork-trail popover, at 360/768/1088 × paper/dark
(12 states each, 24 total), against a real production build (`npm run build` + `vite preview`) driven
over raw CDP in real headless Chrome (`google-chrome-stable --headless=new`, Node's native
`WebSocket`, no Playwright/Puppeteer dependency added — same method T29/T31 used). Locale forced to
EN (the headless browser's default `Accept-Language` negotiated Spanish). Harness lives in the
session scratchpad only, not committed.

**One harness bug found and fixed along the way, unrelated to the app:** `Emulation.setDeviceMetricsOverride`
with `mobile: true` clamps `window.innerWidth` to ~509–517px regardless of the requested `width`
(measured directly: requesting 360 with `mobile:true` yields `innerWidth: 509`; `mobile:false` yields
exactly `360`). Switched the harness to `mobile: false` throughout — verified `innerWidth` then matches
the requested width exactly at 360/768/1088. This is a headless-Chrome/CDP quirk, not a P-hackle bug.

## 3. Measurements — before (this build, pre-GlyphMark) and after

**Column-vs-label gap** (the T29 M5 axis — is the glyph box overlapping the label?), all 24
screenshot states, both before this task's change and after:

| Site | Row gap (Legend) | Row gap (popover) | Overlap found? |
|---|---|---|---|
| All 7 rows × 3 widths × 2 themes, before | 16px, every row, every state | 12px, every row, every state | **No** — `min gap: 16` / `min gap: 12` computed across all 84 (Legend) + 84 (popover) row measurements, zero rows below 2px |
| Same, after this task's change | 16px, unchanged | 12px, unchanged | No regression |

Raw measurements: `task-T34-shots/legend-*-measure-{before,after}.json`,
`task-T34-shots/lab-trailkey-*-measure-{before,after}.json` (bounding-rect deltas between
`.ph-legend__glyph`/`.ph-fork-trail__popover-glyph` and their label sibling, read from the live DOM).

**Internal gap** (the NEW axis this task adds — is there space *between* `⚖️` and `✅`/`❌` inside
the compound sequence itself?): a `Range`-based per-grapheme-cluster measurement via
`Intl.Segmenter` proved unreliable for colour-emoji glyphs (returned ~0 regardless of CSS state —
likely because Chrome reports colour-emoji glyphs' ink bounds as their full advance box, so two
adjacent ranges' rects abut with no measurable inter-range gap even when spacing is present). The
reliable, disclosed method instead: compare the compound glyph SPAN's own total box width before vs.
after adding `letter-spacing`, against the SAME delta for a single-glyph row in the same list (same
font, same size, same list, isolates the effect of the added property):

| Site | Single-glyph row box width Δ | Compound row (`⚖️✅`) box width Δ | Interpretation |
|---|---|---|---|
| Legend (`--text-22`, `--tracking-label` = 0.08em) | **+1.766px** (one glyph → one trailing tracking unit) | **+3.516px** (≈ 2 × 1.766px) | A full tracking unit landed *between* the two component glyphs, not only trailing |
| ForkTrail popover (`--text-15`) | **+1.203px** | **+2.406px** (≈ 2 × 1.203px) | Same proof, smaller font |

Identical at all 3 widths × 2 themes × both sites (12/12 cells consistent) — see the analysis run
embedded in this report's commit message and reproducible from the measure-`{before,after}`.json pairs.

## 4. Fix

`src/ui/components/GlyphMark.tsx` (new): a small shared wrapper, `<GlyphMark glyph={...}
className={...} />`, rendering one `<span className="ph-glyph-mark {className}">{glyph}</span>` —
merged onto the SAME element as the caller's existing layout class (not nested), so
`.ph-legend__glyph`'s `min-width`/`flex` sizing and `.ph-fork-trail__popover-glyph`'s equivalent are
untouched. `GlyphMark.css` adds exactly one declaration:

```css
.ph-glyph-mark {
  letter-spacing: var(--tracking-label);
}
```

Reuses the existing, already-registered `--tracking-label` token (0.08em) — the same one
`ForkTrail.css`'s own live glyph run already applies (T29 pin 11-b) — so no new token, no magic
number, DESIGN.md §9 unchanged. `Legend.tsx` and `ForkTrail.tsx`'s `TrailKey` popover both now route
`entry.glyph` through `GlyphMark` instead of a bare `{entry.glyph}` text node.

This is deliberately a SECOND, independent layer on top of T29's already-working column fix: it
doesn't depend on the row staying a flex container with its own `gap` (a future refactor to grid or
block layout would still carry the fix), and it addresses a distinct failure surface — space
*inside* the compound sequence, not just *around* the glyph column. No VS16 normalization was
needed: `CALL_CORRECT`/`CALL_INCORRECT` already carry `U+FE0F` after `⚖` in `share.ts`
(`⚖️✅` = `U+2696 U+FE0F U+2705`), and every other project glyph (`✅ ❌ 🍴 ➕ 🧾 📄 🏳️`) already has
Unicode-default emoji presentation — confirmed by direct codepoint inspection, not assumed.

**`src/game/share.ts` is byte-identical** — `git diff --stat` against it is empty;
`tests/game/share.test.ts` (15 tests, incl. the spoiler property test) passes unmodified.

## 5. Tests

`tests/ui/glyphMark.test.tsx` (new, 3 cases): renders single and compound glyphs unchanged; always
carries `ph-glyph-mark` and merges the caller's className onto the SAME element (not nested); renders
exactly one `<span>`. `tests/ui/legend.test.tsx` (+1): every rendered glyph carries `ph-glyph-mark`.
`tests/ui/lab.test.tsx` (+1): same, for the fork-trail popover's glyph column. All are regression
guards against a future edit reverting to a bare `{entry.glyph}` text node.

Baseline (stashed, pre-change, same commit): 48 files / 1245 tests. After: **49 files / 1252 tests**
(+7 = 5 new `it()` cases; the file/test-count delta was verified via `git stash` / `stash pop`, not
assumed).

## 6. Gate — exit codes captured before any pipe, at commit `e43383d`

```
$ PATH="/usr/bin:$PATH" npx tsc --noEmit ; echo $?     -> 0
$ PATH="/usr/bin:$PATH" npx eslint .     ; echo $?     -> 0
$ PATH="/usr/bin:$PATH" npx vitest run   ; echo $?     -> 0   (49 files, 1252 tests, 0 failed)
$ PATH="/usr/bin:$PATH" npm run build    ; echo $?     -> 0
```

`tests/engine/dgp.test.ts`'s known flake did not fire in any of the three full runs performed during
this task. DESIGN.md's grep gates re-run clean over the new/changed files specifically (no `border:`,
no `transition`, no raw px, no raw colour in `GlyphMark.css`; the four project-wide gates — R4.5,
R4.7, R5.5 `transition: all`, R4.2 `box-shadow` — also clean over all of `src/ui`).

## 7. Scope confirmation

- `src/game/share.ts`: untouched (`git diff --stat` empty).
- `App.tsx` / shell / header / nav: untouched (T33's lane).
- `Reveal.tsx`: untouched (T33's lane — confirmed via `git diff --stat`, empty).
- Locale/i18n files, content files: untouched — no copy key was added, changed, or needed (the fix
  is presentation-only, no new translatable string).
- No new CSS token, colour, border, shadow, or transition (motion budget frozen, honored).
- Files touched, all within the granted FILE SCOPE:
  `src/ui/components/ForkTrail.tsx`, `src/ui/components/GlyphMark.{tsx,css}` (new, under
  `src/ui/components/` as explicitly permitted), `src/ui/screens/Legend.tsx`,
  `tests/ui/{glyphMark,legend,lab}.test.tsx`.

## 8. Concerns / honest caveats

1. **No overlap was reproduced on this Linux/Chromium build** for either compound-glyph site — T29's
   fix already works here (16px/12px clean gaps, measured across all 24 states). The
   `letter-spacing` addition is therefore a defensive, evidence-motivated layer for font/platform
   environments this sandbox cannot test (the owner's own machine), not a fix for a reproduced local
   bug. This is disclosed plainly rather than implied to be a reproduction.
2. **The `Intl.Segmenter`/`Range`-based internal-gap measurement did not work** for colour emoji (see
   §3) — I disclose the failed method rather than hide it, and used a second, reliable method (box-
   width delta, isolating single- vs. two-tracking-unit growth) that does prove the internal gap is
   real and consistent across all 12 measured cells.
3. **The Summary "share-string preview" named in the task brief does not currently exist** as a
   render site — `shareText` is used only for the clipboard/`navigator.share` call, never rendered as
   JSX. I verified this by full source read plus `grep -n shareText src/ui`, not by assumption. If a
   future task (plausibly T33, since Reveal→Summary wiring is X1 from the T29 report) adds a visible
   preview of the 4-line grid, it should route its glyph run through `GlyphMark` too — the component
   is already exported and ready for that.
4. Could not attempt a temporary capture-harness patch to `main.tsx` (the T29-precedented
   `window.__phackleStore` trick) to force-reach the Summary screen for a screenshot, because
   `main.tsx` is outside this task's FILE SCOPE — the auto-mode permission classifier correctly
   blocked the edit attempt. Per the brief ("If a fix seems to need a forbidden file, STOP and
   report it"), this is reported rather than worked around; it did not block the audit conclusion
   in finding #3 above, which was reached by source inspection instead.
