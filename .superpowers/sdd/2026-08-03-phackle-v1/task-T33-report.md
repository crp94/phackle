# Task T33 — Navigation & controls clarity

**Branch:** `task-t33` (worktree `.claude/worktrees/task-t33`), base `8ab428a`. Not pushed.

**Commits**

| SHA | Message |
|---|---|
| `0b44fbf` | feat: default the interface to English (owner directive, round 5) |
| `96650cf` | feat: header clarity, Home/Play navigation, and the missing reveal exit |
| `c7fb6dc` | fix: wrap the header's nav row too, and make the Play item's distinction real (**review round 1**) |

**Gate at HEAD `c7fb6dc`** (exit codes captured before any pipe):

```
npx tsc --noEmit   -> 0
npx eslint .       -> 0
npx vitest run     -> 0     48 files, 1267 tests, 1267 passed
npx vite build     -> 0
```

> **Review round 1 outcome is recorded in "§7 revisited" at the bottom of this
> report.** Section 7 as originally written was wrong and is left in place,
> struck through, so the error and its correction both stay on the record.

Known flake, disclosed: on one earlier full run `tests/engine/dgp.test.ts >
"experience is always 0, 1, or 2..."` hit the 5000ms timeout under load
(exit 1, 1263/1264). Rerun in isolation: **exit 0, 24/24**. Full suite
rerun immediately after: **exit 0, 1264/1264**. The gate above is a
subsequent clean run at HEAD. Unrelated to this task's diff (engine only,
no engine file touched).

**TDD evidence.** All new/amended assertions were written before the source
changes and verified red against the 8ab428a source (`git stash push --
src/`): **20 failures** across `locale.test.ts`, `shell.test.tsx`,
`appNav.test.tsx`, `reveal.test.tsx`, `it.shape.test.ts`,
`es.shape.test.ts`. Green after implementation.

---

## 1. Default locale = English

`src/i18n/locale.ts` — `detectLocale` is now `stored ?? 'en'`. The
`navigator.language` prefix match is **deleted**, not deprioritised or left
dead. `navLang` stays in the signature (unread, `_navLang`) and
`LocaleProvider` keeps passing `navigator.language` on purpose: that keeps
"any navigator language still resolves to English" a live, testable
regression assertion rather than a fact about a call site that no longer
exists.

Call sites audited: `src/i18n/LocaleProvider.tsx:90` is the only one in
`src/**`. No other detection path exists (`grep -rn 'navigator.language\|
detectLocale' src` returns those two files only).

Tests pinned to the new contract: stored wins (`it`→`it`, `es`→`es`,
`en`→`en`; and over a disagreeing navLang); nothing stored + any of
`it-IT`, `it`, `es-MX`, `es`, `fr-FR`, `en-GB`, `''`, `undefined` → `'en'`.

**Collateral (in scope, tests):** `tests/ui/published.test.tsx` drove its
Italian case via `navigator.language = 'it'`, which now selects nothing. It
stores the locale choice instead (`saveSettings({ locale: 'it' })`) — what a
real Italian player has — and its actual assertion (journal masthead stays
English while the app runs in Italian) is untouched. Added a
`localStorage.clear()` to that file's `beforeEach` so the stored choice
cannot leak, and dropped the now-vestigial `navigator.language` reset.

## 2. Flags in the language menu

Each locale button is `<flag aria-hidden> + CODE`, never a flag alone —
Windows Chrome ships no flag glyphs and renders a regional-indicator pair
as the bare letters "GB"/"IT"/"ES", so the code text is what keeps the
control legible there. `aria-label` is the language's own endonym.
`.ph-seg--locale` uses an explicit flex `gap` rather than a space
character, because emoji advance widths vary across whichever fallback
font a flag lands in.

Verified in headless Chrome at 360w and 1088w, both themes: flags render,
active locale is full `--ink` + 2px underline, inactive are `--muted`.

## 3. Theme toggle clarity

Was a single flip-flop `.ph-toggle` button showing **one** word — a control
you had to press to learn what it did, and whose one word was ambiguous
besides ("Paper": am I on paper, or being offered paper?).

Now the same two-option `role="group"` segmented control as the locale
toggle: both options on screen at all times, active one carries
`aria-pressed="true"` + R4.6's 2px `--ink` underline + full `--ink`, the
inactive one drops to `--muted`. Group labelled `a11y.themeToggle`.

DESIGN.md compliance: no new colour (both are registered text tokens), no
new border/shadow/radius, **no transition or animation added** (motion
budget untouched — that is T35's). R6.3 is satisfied three times over
(aria-pressed, underline, weight of ink), so the colour is a redundant
third channel and never the only one. The `--muted` rule is scoped to
`.ph-theme-toggle` and `.ph-locale-toggle` only: the stats/legend/about nav
answers "where am I", where all-three-inactive is the normal resting state
and muting them would read as disabled. The retired `.ph-toggle` selector
is removed from `App.css`.

## 4. Home/Play navigation

Both affordances live in the shell (`App.tsx` + `App.css`). **No screen
file was touched** (Legend/About/Stats untouched — see scope below).

(a) The masthead wordmark is a real `<button>` back to the game. Its
accessible name opens with the wordmark ("P-hackle: back to today's
puzzle") so the visible label survives inside the accessible name (WCAG
2.5.3 Label in Name). R6.4's target bought back in `var(--space-12)`
vertical padding, which costs the header nothing — the `.ph-seg` controls
opposite already set the row height with the same token (measured: 45px).

(b) An explicit `Play` item renders in the nav for exactly as long as a
non-game page does. It is an **action**, not a page, so it carries no
`aria-pressed` (there is no state it could report); `.ph-seg--action`
distinguishes it from the page tabs beside it (see review round 1, Minor 3,
for what that rule ended up being — the first version was imperceptible).

**Never restarts the day.** Both only mutate App's local `NavPage` state;
the game machine is untouched. Pinned by a new test that boots the *real*
store over a scripted client, walks to the Lab, asserts `store.screen ===
'lab'` while About is showing, clicks Play, and asserts the Lab is back
with `store.screen === 'lab'`, the same `log.length`, and `result` intact.

## 5. finishReveal wired (escalated blocker)

`store.finishReveal()` had **no caller anywhere in `src/ui`** — the Summary
screen (the invoice, the share string, and the app's one persistence
moment) was unreachable in the real app; the reveal ended at Fig. 2.

`Reveal.tsx` now renders a full-width action *after* the last `Block`, and
deliberately **outside** it: a `Block` is a scroll-fade section (R5.3), and
an action an IntersectionObserver can hide is an action that can strand the
player. Styling follows the existing Published/Briefing CTA treatment
exactly (scale padding, uppercase + `--tracking-label`, single
`--hairline` underline, `--space-40` above to match the block rhythm). No
transition added.

Tests: unit (renders, DOM-follows fig2, dispatches `finishReveal` →
`screen === 'summary'`, present on abandoned days too) **and** end-to-end
through the real `ScreenRouter` (reveal → one tap → the invoice renders).
Summary's persistence contract was read first and is verified undisturbed:
after the transition, `history` has exactly one key (`store.iso`) and
`stats.hackDays === 1`; a second `finishReveal()` leaves both unchanged.
`Summary.tsx` itself was not modified.

## 6. legend.emojiSpec IT/ES mirrors

New guard `findMissingSpecKnobs` in `tests/content/shape.test.ts`, applied
to all three locales: each locale's enumeration must name all six knobs **in
that locale's own vocabulary**, checked against the locale's own Lab labels
(`lab.outcome/subgroup/covariates/exclusion/transform` + `reveal.tailsOne`)
rather than against a hand-written word list that would drift. Includes a
guards-the-guard negative case.

## 7. Masthead overflow (GR4a) — ~~fixed~~ INCOMPLETE, see "§7 revisited"

Adjacent (the header reflowed), so it was fixed. `.ph-header__controls`
gained `flex-wrap: wrap` + `justify-content: flex-end`: a row that cannot
wrap can only overflow.

Measured in headless Chrome via CDP, hard `360x640` viewport, both themes,
against production builds of both trees:

| | `.ph-header` scrollWidth / clientWidth | document overflow |
|---|---|---|
| **before** (src @ 8ab428a) | 584 / 360 | **224px** |
| **after** (this branch) | no overflowing element | **0px** |

After also measured clean at 768w and 1088w, both themes (0px), despite the
row now carrying *more* controls (4 nav items with Play showing, 2 theme
options, 3 flagged locale buttons). Smallest interactive target: 45px.

Note, honestly: the GR4a note recorded 2px on `.ph-header__controls` /
`.ph-toggle` (347 vs 345). My measurement at the document/header level is
far larger (224px). Both are reproducible; they are measuring different
elements. Either way the after-state is zero.

---

## New strings, all three locales

| Key | EN | IT | ES |
|---|---|---|---|
| `nav.play` | `Play` | `Gioca` | `Jugar` |
| `nav.localeNameEn` | `English` | `English` | `English` |
| `nav.localeNameIt` | `Italiano` | `Italiano` | `Italiano` |
| `nav.localeNameEs` | `Español` | `Español` | `Español` |
| `a11y.themeToggle` | `Change theme` | `Cambia tema` | `Cambiar tema` |
| `a11y.backToGame` | `P-hackle: back to today's puzzle` | `P-hackle: torna al rompicapo di oggi` | `P-hackle: volver al puzle de hoy` |
| `reveal.toSummary` | `See the invoice` | `Vedi la fattura` | `Ver la factura` |

Changed values:

| Key | Locale | New value |
|---|---|---|
| `legend.emojiSpec` | IT | `Qualunque cambio di specificazione (esito, sottogruppo, covariate, esclusione outlier, trasformazione o passaggio a una coda)` |
| `legend.emojiSpec` | ES | `Cualquier cambio de especificación (variable de resultado, subgrupo, covariables, exclusión de atípicos, transformación o cambio a una cola)` |

Register/content laws: 0 em dashes in every new string (density improves —
7 keys x 3 locales added, 0 dashes). No `{tokens}`. `reveal.toSummary` is
Act II clinical: it names the ledger it opens and makes no comment on the
player. `nav.play` is a nav label, register-neutral. The three endonyms are
proper nouns, invariant across locales by design — added to
`it.shape.test.ts`'s `SHARED_WITH_EN` allowlist with a note (the same bucket
as `nav.title`). `a11y.backToGame` keeps `P-hackle` invariant. All copy-scan
suites (`copyFreeze`, EN/IT/ES shape) pass.

## DESIGN.md compliance

Tier-C greps re-run, all clean or unchanged:

- `border:\s` — 0 hits
- `z-index:\s*[0-9]` — 0 hits
- `<select` — comment only
- `@media (min-width:` other than 768px — 0 hits
- `\b(transition|animation):` — the same 4 pre-existing entries. **No motion added.**
- `var(--sig-red)` — none added
- raw px in touched CSS — only `text-underline-offset: 2px` (R6.2) and the
  pre-existing `2px` selection underline (R4.6), both named strokes

## Scope confirmation

Touched: `src/i18n/**`, `src/ui/App.tsx`, `src/ui/App.css`,
`src/ui/screens/Reveal.tsx`, `src/ui/screens/Reveal.css`,
`src/content/{en/copy.ts,it/copy.ts,es/copy.ts}`, and tests
(`tests/i18n/locale.test.ts`, `tests/ui/{shell,appNav,reveal,published}.test.tsx`,
`tests/content/{shape,it.shape,es.shape}.test.ts`).

**Not touched:** `src/game/store.ts` (no screen-machine gap — `finishReveal`
already existed and did the right thing; only a caller was missing),
`Legend.tsx` / `About.tsx` / `Stats.tsx`, `ForkTrail`, `Summary.tsx`,
`share.ts`, `src/engine/**`, DESIGN.md.

## Collisions / concerns for the controller

1. **No hard collision with T34.** One soft overlap to flag: `Legend.css:61`
   carries a *comment* referring to `App.css`'s `.ph-toggle`, which this
   task retired. The comment is now stale. I left it alone because
   `Legend.css` is T34's file; one-line comment fix at merge.
2. **`tests/ui/published.test.tsx` was amended** — outside the literal file
   list, but forced by item 1 (its Italian setup used the deleted detection
   path). Minimal and behaviour-preserving; flagged rather than silently
   done.
3. **Header height on mobile.** At 360w the control row now wraps to three
   lines (nav / theme / locale) — the honest cost of 8+ controls at 44px
   targets, and strictly better than the 224px horizontal overflow it
   replaces. If the owner wants it shorter, the lever is collapsing the
   locale toggle behind a menu, which is a design decision, not a bug.
4. **T35 (motion) is unblocked and untouched by this branch**: no
   transition, animation or duration token was added or changed.

---

# Review round 1 — fixes (commit `c7fb6dc`)

Verdict was NEEDS FIXES: one Important, two Minor. All three addressed in one
pass. Gate at HEAD: `tsc=0`, `eslint=0`, `vitest=0` (48 files, **1267/1267**),
`vite build=0`.

## §7 revisited — the masthead overflow fix was incomplete, and my measurement hid it

**What I got wrong, plainly.** I put `flex-wrap: wrap` on the parent row
(`.ph-header__controls`) and stopped. `.ph-header__nav` still could not wrap,
which makes its buttons **one unbreakable flex item** to the parent — so the
parent's wrap bought nothing the moment this task added a fourth item (Play)
to that group. Worse, my measurement never visited the failure: the harness
loaded the game screen in English and never clicked a nav item, never switched
locale. That is the one configuration where Play does not exist *and* the
labels are shortest. My report's parenthetical "(4 nav items with Play
showing…)" was therefore a claim no script of mine supported. Evidence
discipline failure, not a typo.

**Reproduced independently** against this branch's own production build at
`96650cf`, full matrix, hard viewport, `data-theme` default:

| locale | width | where | doc overflow | off-screen controls |
|---|---|---|---|---|
| en | 360 | game | 0 | – |
| en | 360 | About | 0 | – |
| en | 390 | game | 0 | – |
| en | 390 | About | 0 | – |
| it | 360 | game | **7px** | – |
| it | 360 | About | **83px** | `Informazioni`, `🇪🇸 ES` |
| it | 390 | game | 0 | – |
| it | 390 | About | **53px** | `Informazioni`, `🇪🇸 ES` |
| es | 360 | game | 0 | – |
| es | 360 | About | **44px** | `Acerca de`, `Oscuro`, `🇪🇸 ES` |
| es | 390 | game | 0 | – |
| es | 390 | About | **14px** | – |

5 failing cells. My absolute numbers run a little higher than the reviewer's
(83 vs 68, 53 vs 39, 44 vs 29) — different method (built artifact vs live CSS
injection) — but the failing cells, the direction, and the off-screen ES
button are identical. Note `it/360/game` fails at 7px with **no Play at all**:
the bug was never only about the new item, it was about Italian labels.

**Fix applied** (the reviewer-verified one):

```css
.ph-header__nav { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-4); }
```

**Re-measured, same harness, all 12 cells — every one 0px:**

| locale | width | where | doc overflow | header-subtree overflow | off-screen |
|---|---|---|---|---|---|
| en | 360 | game | **0** | 0 | – |
| en | 360 | About | **0** | 0 | – |
| en | 390 | game | **0** | 0 | – |
| en | 390 | About | **0** | 0 | – |
| it | 360 | game | **0** | 0 | – |
| it | 360 | About | **0** | 0 | – |
| it | 390 | game | **0** | 0 | – |
| it | 390 | About | **0** | 0 | – |
| es | 360 | game | **0** | 0 | – |
| es | 360 | About | **0** | 0 | – |
| es | 390 | game | **0** | 0 | – |
| es | 390 | About | **0** | 0 | – |

Locale driven by the **stored** setting (the only thing that moves the app off
English now), About reached by clicking the last nav button whatever its
label, so the harness is locale-agnostic. Also swept 768/1088 x {en,it,es} x
{game,About}: 12 more cells, all 0px, nothing off-screen.

**Regression pin (jsdom).** `tests/ui/appNav.test.tsx` now asserts that **both**
nested header rows declare `flex-wrap: wrap`, by reading `App.css` as source
text (same idiom as `tokens.test.ts`), with the incident written down beside
it. The comment is explicit about the limit: jsdom implements no layout, every
width in it is 0, so this can only ever see the missing property — never the
overflow it causes. Verified to fail when the declaration is removed (1 failed
/ 14 passed) and pass when restored. Resolved from `process.cwd()` rather than
`import.meta.url`, because this file runs under the jsdom environment where
`import.meta.url` is an `http://` URL and `fileURLToPath` rejects it.

**Booked elsewhere:** the real pin is a locale-aware header-overflow check at
360 with Play showing, in **T23's E2E scope**. The controller has booked it
there.

## Minor 2 — ES `a11y.themeToggle`

`Cambiar de tema` is the fixed idiom for changing the *subject* of a
conversation. Now **`Cambiar tema`**, with the reason recorded in the catalog.

## Minor 3 — `.ph-seg--action`

**Chose: make the distinction real** (not drop it). `--weight-medium` alone
was 400 vs 500 at `--text-15`, invisible next to three siblings. The rule now
also carries `text-transform: uppercase` + `letter-spacing:
var(--tracking-label)` — the product's own registered idiom for "this is the
action, not a label", exactly what `.ph-briefing__cta`, `.ph-published__cta`
and `.ph-reveal__cta` already wear. Confirmed visually at 1088w: the nav reads
`PLAY  Stats  Legend  About`, and the action is unmistakable. No new token, no
new colour, **no motion** (Tier-C `transition|animation` grep still returns the
same 4 pre-existing entries).

## Parked, per the coordinator — no action taken

Header total height at 360 (267→318px with wrap) and the three-unlabelled-
groups boundary question (grand review / owner taste); the 320w 8px
pre-existing overflow outside `.ph-header` (narrow-viewport pass);
`nav.localeToggle` orphan (pre-existing).
