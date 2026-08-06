# T38 — the achievement-unlock moment (Summary)

Branch `task-t38`, worktree `.claude/worktrees/task-t38`, base `e4632af`.

## What was wrong

`persistAndComputeSummary` computed `unlockedToday`, wrote it through
`saveAchievements`, folded it into `preregUnlocked` — and then dropped it on the
floor. A player who had just earned *The One-Tailed Bandit* saw an invoice, a
streak and a countdown, and nothing about the award the same function had just
decided to give them. The only place an achievement was ever visible was the
Stats wall, on some later visit, with no indication it was new.

## What was built

**1. The unlock block (`src/ui/screens/Summary.tsx` / `.css`).** Between the
invoice and the share button — the ceremony happens before you are invited to
brag about it — a small heading (`summary.unlockedToday`) over one line per
award: its NAME and its CITATION, rendered straight out of the active locale's
`content.achievements` bank. Nothing is restated in `copy.ts`; the one new key
is the heading. A day that unlocked nothing renders *nothing*: no heading, no
empty-state line. `Summary`'s new prop is `unlocked?: UnlockedAchievement[]`
(id + the bank's own `{ name, citation }`), defaulting to `[]`, so the
presentational half stays prop-driven and mode-blind — the prereg Summary
renders an identical block for a prereg-reachable unlock, because it is the
same component receiving the same shape.

Visually it is the honours board's own anatomy (`Stats.css`'s `.ph-stats__ach`:
hairline-ruled row, name over citation, no fill, no box) with one deliberate
difference — the name is `--ink`, not the wall's `--hack-gold-ink`. R8.3 lets
the dial and the stamp ask to be looked at; this block already carries the
screen's only entrance, and gold as well would make Act II's quietest screen
shout twice.

**2. Motion — R5.2 site 9.** `ph-unlock-enter`, `opacity` 0→1 +
`translateY(6px)`→0, `--dur-scene`, `--ease-out`, `backwards`, delayed by
`calc(var(--ph-stagger-index, 0) * var(--dur-stagger))`. Viewport-gated through
the shared `useEnterOnce` (never mount: on a phone this block sits below the
invoice, total, streak and countdown, which is exactly the fold problem T35
measured on Published), indices over the awards, capped by `MAX_STAGGER_STEPS`.
The base rule holds `opacity: 0` and `.ph-summary__unlock-item--in` restores
it, so the citation is held visible by the CLASS, never by the animation;
`useEnterOnce` resolves to entered-now under reduced motion, without an
IntersectionObserver, and if the node never mounts.

DESIGN.md updated: R5.2 row 9; R5.7 now names three entrance sites (3, 5, 9) and
records that **the one-staggered-group-per-screen budget is SPENT on all three
screens that have one** — Summary's other row (site 7, the copy confirmation) is
a single element with no index and is not a group; R5.6's parenthetical was
corrected (it claimed site 5 declared no base `opacity: 0`, which stopped being
true in T35 fix round 1) and now states the association requirement; the "eight
sites" counts in §0, §7.2 and the document header are now nine.

**3. Persistence contract — untouched.** `unlockedToday` is *returned*, not
re-derived: the same array the same guarded block persisted. No second
evaluation, no storage diffing, no extra write. On a practice day, on a
re-visit (`alreadySaved`), and on a day that earned nothing it is `[]` — the
ceremony belongs to the day it happened. Both double-persist tests (unit and
the real unmount/remount, including the midnight straddle) stay green
unmodified.

**4. R5.6 precision fix (`tests/ui/motion.test.ts`).** The
no-content-behind-motion check counted restoring rules PER FILE
(`restorers === 0`), which answers "does this stylesheet restore anything at
all" instead of "is THIS rule restored". Any file with one entrance therefore
vouched for every later `opacity: 0` written into it. It now demands an
ASSOCIATION between a hidden base selector and its restorer: the modifier
either extends one of the hidden classes by name (`.ph-fade` /
`.ph-fade--in`) or is written beside one of them in a component's own
`className` (`'ph-press-card ph-clipping--in'` — the pairs are read out of the
real `.tsx` sources, so this is evidence, not an allowlist). Each
comma-separated selector is judged on its own, `@keyframes` bodies are stripped
with balanced braces rather than pattern-guessed, and the whole check is one
function so the mutation probes exercise the real thing.

### Mutation evidence

| probe | old check | new check |
|---|---|---|
| real `Reveal.css` + `.ph-orphan-block { opacity: 0; }` | **GREEN** (`per-file restorer count: 1`, offenders `[]`) | **RED** — `src/ui/screens/Reveal.css: .ph-orphan-block has no restoring modifier` (real file mutated, suite exit 1) |
| real `Summary.css` with `.ph-summary__unlock-item--in`'s `opacity: 1` deleted | — | **RED** — `.ph-summary__unlock-item has no restoring modifier` (real file mutated, suite exit 1) |
| real `Summary.css` as shipped | — | **GREEN** |
| `.ph-thing{opacity:0}` + unassociated `.ph-other--in{opacity:1}` | GREEN | **RED** |

Both file mutations were applied to the real stylesheets, run, and reverted
(`git diff` clean for both afterwards). The old check was re-run verbatim (as
it stood at `e4632af`) against the same probe to produce the GREEN column.

## Copy — one new key, three locales

| locale | `summary.unlockedToday` | note |
|---|---|---|
| en | `Unlocked today` | Act II clinical; names the day and stops |
| it | `Riconoscimenti di oggi` | NOMINAL (rule 4), sentence case (rule 3), reuses `stats.achievementsTitle`'s fixed term (rule 7), 0 lineette, no token |
| es | `Logros de hoy` | NOMINAL (rule 5), sentence case (rule 4), reuses `stats.achievementsTitle`'s fixed term (rule 6), 0 rayas, no token |

Both non-English headings are nominal rather than participial on purpose:
"Sbloccati oggi" / "Desbloqueados hoy" are bare masculine plurals with nothing
on screen to agree with — the exact defect T37 fixed in
`lab.subgroupUrban/Rural(e)`.

`copyFreeze` does not pin the key SET (it checks that every referenced key
exists, plus the raw-string scan), so no manifest edit was needed; the shape
suites' `Object.keys(esCopy).sort() === Object.keys(enCopy).sort()` parity is
satisfied by adding the key to all three catalogs.

## Gate (exit codes taken before any pipe)

```
npx tsc --noEmit    -> 0
npx eslint .        -> 0
npx vitest run      -> 0   50 files, 1322 tests passed
npx vite build      -> 0
```

New tests: `tests/ui/summary.test.tsx` 26 -> 40 `it()`s, `tests/ui/motion.test.ts`
26 -> 32. No flake observed across four full-suite runs.

Coverage added: block renders iff `unlocked` is non-empty (two fake awards,
names + citations asserted in order and against the bank); absent on empty days
and when the prop is omitted; DOM position between invoice and share; stagger
indices `0,1,2,cap`; the unlock group is the screen's ONLY indexed group (the
toast carries no index); visible from mount under reduced motion *with an
IntersectionObserver that never fires*, and the non-vacuity companion showing
the same observer withholds the class at full motion; fails open with no
observer at all; `unlockedToday` equals what `saveAchievements` wrote and is
`[]` on the second call, on practice, and identical in shape on a prereg day;
end-to-end through the real store — a RETRACTED publish shows *First Blood* and
*First Retraction* with their real citations, and a nav remount shows no block
while the earned upsell stays.

## Concerns

- **`SummaryScreen`'s loading guard changed from `!copy` to `!content`.** They
  are the same object's presence (LocaleProvider derives `copy` as
  `content.copy`), and narrowing on the bundle is what makes the achievements
  read type-safe; behaviour is identical, but it is a line someone will
  re-read.
- **The association check reads `.tsx` string literals.** A component that
  built its className by concatenation (`` `${base} ${mod}` `` across two
  literals) would not register a pair, and its base rule would be reported as
  unguarded. That is a conservative failure (it fails loud, not silent) and no
  current component does it — but a future one would have to write both
  classes in one literal, which is the idiom all three sites already use.
- **The block is not announced to assistive technology.** It renders as part of
  the screen's normal content under an `<h3>`, like the prereg upsell; it is
  not a live region, because the whole screen has just mounted. If a later task
  ever renders it into an already-mounted Summary, that decision needs
  revisiting.
- **No visual capture.** The entrance and the honours-board treatment were
  verified by test and by rule, not at 360/1088 in a real browser; DESIGN.md's
  tier E question ("does anything other than the dial and the stamp ask to be
  looked at?") remains a human's to answer.
