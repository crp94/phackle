# Task T35 — motion design pass

**Base:** `67028cd` · **Commit:** `a1a31d4` on branch `task-t35` (not pushed)
**Gates:** `tsc --noEmit` 0 · `eslint .` 0 · `vitest run` 0 (**50 files, 1296 tests**, +22 from base's 1274) · `vite build` 0
**Files touched:** `docs/DESIGN.md`, `src/ui/theme/tokens.css`, `src/ui/App.{css,tsx}`,
`src/ui/components/{PValueDial.css,PValueDial.tsx,Stamp.css,ForkTrail.css,DataCut.tsx}`,
`src/ui/screens/{Reveal.css,Reveal.tsx,Published.css,Published.tsx,Summary.css,Summary.tsx,Lab.css}`,
`tests/ui/tokens.test.ts`, `tests/ui/motion.test.ts` (new).
**Not touched:** `src/content/**` (parallel task's surface), `src/game/**`, `src/engine/**`,
`ScreenRouter.tsx`, any copy or logic.

---

## 0. What the owner was actually looking at

Walked the built app end to end over CDP before deciding anything — briefing → lab →
published → call → reveal → summary, at 1088 and 360, paper theme, plus the nav pages.
Before-shots in `task-T35-shots/before/`. Three findings shaped the whole pass:

1. **Every screen change teleported.** `briefing → lab → published → call → reveal →
   summary` and the stats/legend/about nav swap: no beat of any kind. This is the
   product's biggest state change, and the old R5.5 named "page transitions" among the
   things that were forbidden.
2. **The dial's sanctioned motion was doing almost nothing.** R5.1's tick was a
   two-legged transition (JS adds a class → transition to −2px; a `setTimeout` removes
   it → transition back) while the digits themselves changed instantly. 2px on a 64–96px
   numeral, out and back, reads as nothing at all.
3. **Act II's signature moment was playing to an empty room** — see §4. This one is a
   defect, not a taste call, and it is the single most valuable thing this task found.

The diagnosis is that the old §5 was a **budget**, not a system: four animations, each
with a duration token of its very own, so the count could only be held down by refusing.
That refusal is what "reads a bit plain" was pointing at.

---

## 1. The motion inventory

Eight sites. Seven CSS, one canvas. Every one is a single move, on the shared scale,
compositor-only.

| # | Site | Trigger | Property animated | Duration | Easing | Reduced-motion fallback | Why it earns motion |
|---|---|---|---|---|---|---|---|
| 1 | **Screen / nav-page transition** — `.ph-screen` on `<main>` (`App.css`) | the game's `screen` or the header's `page` changes; `App.tsx` keys `<main>` on both | `opacity` 0→1, `transform` `translateY(6px)`→0 | `--dur-scene` (260ms) | `--ease-out` | 1ms — the new screen is simply there | The biggest state change in the product, and it teleported. A screen that lands tells you a move completed |
| 2a | **Dial band colour** (`PValueDial.css`) | R1.8's band changes | `color` (§5's one registered non-compositor exception) | `--dur-quick` (140ms) | `--ease-out` | 1ms — new colour, no fade | On the dial the colour *is* the state (R1.8); a step should read as a step, not a repaint |
| 2b | **Dial settle** (`PValueDial.css`) | a genuinely new result, keyed `p\|n\|outcome` | `transform` `translateY(-2px)`→0 | `--dur-quick` | `--ease-out` | class withheld in JS + 1ms | Act I's signature and the game's heartbeat. Says the one thing the old treatment could not: *a new number just landed here* |
| 3 | **Reveal block entrance, staggered** (`Reveal.css`) | the block intersects the viewport | `opacity` 0→1, `transform` `translateY(6px)`→0, delayed `index × --dur-stagger` | `--dur-scene` + `--dur-stagger` (60ms) | `--ease-out` | 1ms / 0ms delay; `Block()` also starts visible | Act II is a report; its six blocks are pages arriving in order, not one wash of ink |
| 4 | **Stamp slam + ≤2px paper shake** (keyframes in `Stamp.css`, fired by `Reveal.css`) | the block holding the stamp becomes visible | `transform` (scale + rotate), `opacity` | `--dur-stamp` (450ms, pinned by §7.1) | `--ease-stamp` | `Stamp.tsx` withholds the class entirely; 1ms besides | Act II's signature (R8.2) — the one moment allowed to be loud. **Behaviour fixed, see §4** |
| 5 | **Press clippings + chyron, staggered** (`Published.css`) | Published mounts | `opacity` 0→1, `transform` `translateY(6px)`→0, delayed `index × --dur-stagger` | `--dur-scene` + `--dur-stagger` | `--ease-out` | 1ms / 0ms delay | The day's payoff. Coverage arrives outlet by outlet, which is what coverage does |
| 6 | **Fork-trail key popover** (`ForkTrail.css`) | the key opens (hover / focus / tap) | `opacity` 0→1, `transform` `translateY(2px)`→0 | `--dur-quick` | `--ease-out` | 1ms | The only feedback that the control did anything. Closing stays instant — an exit carries no information |
| 7 | **Share "copied" / "failed" line** (`Summary.css`) | a clipboard write resolves or rejects | `opacity` 0→1, `transform` `translateY(2px)`→0 | `--dur-quick` | `--ease-out` | 1ms | A clipboard write is invisible; this line is the entire confirmation that it happened |
| 8 | **Confetti** (`ConfettiLayer.tsx`) | Published mounts, once per puzzle | canvas particles | `--dur-confetti` (3000ms) | — | canvas never created (JS gate) | §2.5's sincere celebration. **Unchanged by this task** |

Travel distances are pinned to exactly two values, enumerated the way §4 enumerates the
1px hairline: **6px for a scene arriving, 2px for a quick beat.** No third distance
exists, and `motion.test.ts` proves it by scanning keyframe bodies.

---

## 2. DESIGN.md amendment summary

§5 went from **"Motion budget — four animations, this list is exhaustive"** to
**"Motion system"**, seven rules (R5.1–R5.7, one more than before → 49 rules total).
The severity went *up*, not down: raw durations, raw easings, and layout-property
animation are all newly banned, and none of them was mentioned by the old §5 or by
master spec §7.5.

| Rule | What it now says |
|---|---|
| **R5.1** | Closed timing scale — `--dur-quick` 140ms (the 120–200ms band), `--dur-scene` 260ms (200–350ms), `--dur-stagger` 60ms (a delay *step*, never a duration). One easing, `--ease-out`. No raw `ms`/`s`, no `cubic-bezier()`, no bare `ease`/`linear`/`steps()` anywhere in `src/ui` outside `tokens.css` |
| **R5.2** | The eight-site register, as a table with per-file declaration counts. Compiled, both directions |
| **R5.3** | `transform` and `opacity` only — one registered exception, the dial's `color` — plus the two pinned travel distances |
| **R5.4** | The two durations that sit off the scale, each with a named reason: `--dur-stamp` (§7.1's slam), `--dur-confetti` (§7.5's canvas budget). Nothing else may exceed `--dur-scene` |
| **R5.5** | Nothing outside R5.2's table animates. Hover/press/skeleton/spinner/accordion stay instant |
| **R5.6** | Reduced motion is **parity**: every token collapses in `tokens.css`, **and no content may appear only as the result of an animation**, **and** JS motion consults `matchMedia` itself. Includes the `fill-mode`/`position: fixed` trap as a worked example |
| **R5.7** | A stagger is `calc(index × --dur-stagger)` with the index **capped** by the component (`MAX_STAGGER_STEPS = 2`), and at most one staggered group per screen |

Also amended for consistency: **§0** gains an eleventh narrowing row recording that
master spec §7.5's *"nothing else"* is now a scale rather than an enumeration (with the
reasoning and the fact that §7.5's reduced-motion sentence is *strengthened*); **§9**'s
token table splits Motion into scale / pinned / easing and lists the three new tokens;
**§10** updates the rule count to 49, moves R5.1/R5.2/R5.3/R5.5/R5.7 **up from tier B/C
into tier A** (compiled), documents the new test's scope precisely, and **retires two
tier-C greps** (`grep -rnE '\b(transition|animation):'` and `grep -rn 'transition: all'`)
because `motion.test.ts` strictly subsumes both. Cross-references in R1.8, R7.2, R8.2 and
§0's stamp row were repointed at the renumbered rules.

**Tokens added:** `--dur-quick` (140ms), `--dur-scene` (260ms), `--dur-stagger` (60ms).
**Tokens retired:** `--dur-tick` (120ms), `--dur-fade` (300ms) — one token per effect is
what a shared scale replaces; a component reaching for a timing nothing documents is
exactly the drift the scale prevents. `tokens.test.ts` now asserts their *absence*.
**Unchanged:** `--dur-stamp`, `--dur-confetti`, `--ease-out`, `--ease-stamp`.

No new colour, no new spacing value, no new size. R1–R4, R6–R8 untouched except for
those cross-references.

---

## 3. Mechanical enforcement — `tests/ui/motion.test.ts` (21 assertions)

| Check | Rule | What it does |
|---|---|---|
| Scale is closed | R5.1 | `--dur-*` is exactly `{quick, scene, stagger, stamp, confetti}`; easings exactly `{out, stamp}`; quick/scene are inside §7.5's bands |
| Tokens only | R5.1 | Scans every `transition:`/`animation:`/`-duration`/`-delay` (CSS **and** JSX camelCase, comments stripped) under `src/ui` for a raw time, a `cubic-bezier()`/`steps()`, a bare keyword, or `all` |
| Register matches, **both directions** | R5.2 | Parses DESIGN.md R5.2's table back out of the document, sums `Decls` per file, counts the stylesheets independently, asserts map equality. An unlisted animation and a listed-but-deleted one fail identically |
| Keyframes all consumed | R5.2 | Every `@keyframes` defined is fired, every one fired is defined — the guard for the deliberate `Stamp.css`/`Reveal.css` split |
| Compositor properties | R5.3 | Transition property lists ⊆ `{transform, opacity, color}`; keyframe bodies declare only `transform`/`opacity`; keyframe translate distances are exactly `{2px, 6px}` |
| Reduced-motion parity | R5.6 | Collects the duration tokens the stylesheets *actually use* and requires each to collapse to ≤1ms in the reduced block; `--dur-stagger`→0ms; `--dur-confetti`→0ms; `--ease-stamp`→linear |
| No content behind motion | R5.6 | Any base rule with `opacity: 0` must have a sibling modifier restoring `opacity: 1` without an animation |
| Stagger form | R5.7 | Every `animation-delay` is exactly `calc(var(--ph-stagger-index, 0) * var(--dur-stagger))`; the component caps the index |
| Guard-the-guards | — | The project's existing idiom: each scan is shown to fire on a synthetic violation and stay silent on the legal form |

**Mutation-tested, six ways** (each applied, run, reverted; all six caught, baseline
restored to 21/21 green):

| Mutation | Caught by |
|---|---|
| `animation: ph-toast-enter 140ms var(--ease-out)` (raw duration) | *finds no raw duration* |
| A new `transition:` on `.ph-summary__total` not in DESIGN.md | *matches per-file declaration counts* |
| `transition: height var(--dur-quick) var(--ease-out)` | *animates no property outside transform/opacity* **and** *fires every @keyframes it defines* |
| `translateY(12px)` — a third travel distance | *travels exactly 6px or 2px* |
| Deleting `--dur-quick: 1ms` from the reduced-motion block | *collapses every duration token that any animation actually uses* |
| Deleting site 7's row from DESIGN.md while keeping the CSS | *matches per-file counts* **and** *registers eight sites* |

`tokens.test.ts`'s R5 block was slimmed to "the scale exists here, and `motion.test.ts`
owns its values" — duplicating the value assertions would give two files a claim on the
same fact and let them disagree.

---

## 4. The defect this pass found: the stamp slam played to nobody

`Stamp.css` fired the 450ms slam from `.ph-stamp--animate` alone, which `Stamp.tsx` sets
at **mount**. But the stamp lives inside the fourth of six scroll-gated `Block`s, which
mounts at `opacity: 0`. So Act II's one signature moment ran to completion inside a fully
transparent parent, and what the player eventually scrolled down to was a stamp that had
always been sitting there.

Probed identically against both builds (`vite preview` + real headless Chrome, raw CDP,
reading the live `Element.getAnimations()`), full play-through each time:

**BEFORE — build of `67028cd`:**

```
at reveal mount + 100ms (top of page):
  {"blockVisible":false,"blockOpacity":"0","markAnims":["ph-stamp-slam:running@167ms"]}
at reveal mount + 1500ms (still at top):
  {"blockVisible":false,"blockOpacity":"0","markAnims":["ph-stamp-slam:finished@450ms"]}
120ms after the stamp block scrolls into view:
  {"blockVisible":true, "blockOpacity":"0.79","markAnims":["ph-stamp-slam:finished@450ms"]}
```

**AFTER — build of `a1a31d4`:**

```
at reveal mount + 100ms (top of page):
  {"blockVisible":false,"blockOpacity":"0","markAnims":[]}
at reveal mount + 1500ms (still at top):
  {"blockVisible":false,"blockOpacity":"0","markAnims":[]}
120ms after the stamp block scrolls into view:
  {"blockVisible":true, "blockOpacity":"0",   "markAnims":["ph-stamp-slam:running@100ms"]}
520ms after:
  {"blockVisible":true, "blockOpacity":"1",   "markAnims":["ph-stamp-slam:finished@450ms"]}
```

The fix is a layering split, not a rewrite: `Stamp.css` keeps the keyframes (the component
knows *what* the slam is) and `Reveal.css` gains `.ph-fade--in .ph-stamp--animate` (the
screen knows *when* it should happen). A CSS animation starts when its rule first matches,
and `.ph-fade--in` is added exactly at the intersection. `Stamp.tsx`'s contract, its
reduced-motion gate, and `shell.test.tsx`'s assertions on the class are all unchanged.

**One honest imperfection:** the stamp block's own entrance carries a 120ms stagger delay
(index 3, capped to 2), so the slam's first 120ms overlaps the block still fading in —
visible in the `blockOpacity: "0"` at the 120ms sample above. Net effect on screen is a
stamp that arrives oversized and settles as its page lands, which reads well
(`shots-after/w1088-motion-reveal-stamp-inflight.png`); chaining the slam behind the
block's entrance would push it to ~380–830ms after intersection, which felt late. Left as
is, deliberately.

---

## 5. Evidence — real built app, real headless Chrome, raw CDP

Method: `npx vite build` → `vite preview` → `google-chrome-stable --headless=new` driven
over raw CDP with Node's native `WebSocket` (no Playwright/Puppeteer added), the method
T29/T31/T34 established, including T34's `mobile: false` fix for the viewport clamp. Every
step is a **real click on a real button** — no store patch, no `__phackleStore` hook.
Assertions read the browser's own `getAnimations()` / `getComputedStyle()` /
`getBoundingClientRect()`. Harness lives in the session scratchpad, **not committed**.

Ran at 1088 and 360, plus a third pass with `prefers-reduced-motion: reduce` emulated.

**Sites confirmed firing, with their live timings:**

```
[w1088] main mid-transition (briefing->lab)
        [{"name":"ph-screen-enter","dur":260,"delay":0,"state":"running","t":50}]
[w1088] main transform mid-transition   matrix(1, 0, 0, 1, 0, 3.12103)   <- 3.12px of the 6px
[w1088] main transform AFTER            none                             <- no lingering transform
[w1088] dial value anims on new result
        [{"dur":140,"ease":"cubic-bezier(0.2, 0, 0, 1)","state":"running"},   <- the colour transition
         {"name":"ph-dial-settle","dur":140,"state":"running","t":67}]
[w1088] popover anims   [{"name":"ph-popover-enter","dur":140,"state":"running","t":33}]
[w1088] clipping stagger  ph-press-card idx=0 delay=0 dur=260 | ph-press-card idx=1 delay=60 dur=260
[w1088] reveal blocks @t=80ms
        truth in=true idx=0 delay=0 | fig1 in=true idx=1 delay=60 | accounting in=true idx=2 delay=120
        | stamp in=false | call in=false | fig2 in=false
[w1088] toast anims     [{"name":"ph-toast-enter","dur":140,"state":"running","t":50}]
```

360 is identical in every respect (`matrix(…, 3.1169)`, same durations, same
`delay=0|60|120`).

**Reduced motion — parity confirmed, not breakage:**

```
[reduced] main mid-transition            []          <- already finished; transform "none"
[reduced] dial colour transition         color / 0.001s
[reduced] dial value anims               []
[reduced] popover anims                  []
[reduced] clipping stagger               idx=0 delay=NONE | idx=1 delay=NONE
[reduced] reveal blocks @t=80ms          all six in=true, no delays
[reduced] STAMP animations               []          <- class withheld by Stamp.tsx
[reduced] toast anims                    []
[reduced] toast text present             "Couldn't share this result."   <- content is THERE
```

Every screen reached, every element present, zero movement. Note the reveal's six blocks
are all `in=true` immediately under reduced motion — `Block()`'s existing fail-open
behaviour, preserved.

**The two regressions I claimed were safe, actually measured:**

```
call overlay rect vs viewport   {"x":0,"y":0,"w":1088,"h":900,"vw":1088,"vh":900}
call overlay rect vs viewport   {"x":0,"y":0,"w":360, "h":900,"vw":360, "vh":900}
R8.1 dial sticky @360, before scroll:        {"pos":"sticky","top":392,"h":153}
R8.1 dial sticky @360, after scrolling 900:  {"top":0,"mainTransform":"none"}
```

`.ph-screen` deliberately declares **no** `animation-fill-mode`. Any non-`none` transform —
including the `translateY(0)` the keyframe ends on — makes the element the containing block
for its `position: fixed` descendants, and Published's Call overlay is exactly such a
descendant; a `forwards`/`both` fill would silently re-anchor the modal to `<main>` for the
rest of that screen's life. The two rects above are that trap, checked. The sticky dial
pins at `top: 0` at exactly the **153px** §0's Lab-layout row records.

**Screenshots** (`.superpowers/sdd/2026-08-03-phackle-v1/task-T35-shots/`): before-set for
all six screens at 1088 + the Lab/popover at 360; after-set with two frames caught
mid-motion — `w1088-motion-published-t50ms.png` shows the first clipping opaque and the
second visibly fainter (the stagger in the act), and
`w1088-motion-reveal-stamp-inflight.png` shows the stamp mid-slam over a block still
fading, with the two blocks below it at partial opacity.

---

## 6. What I deliberately did NOT animate, and why

| Candidate | Decision | Reason |
|---|---|---|
| **Altmetric counter "spinning up"** (§2.5 names it) | No | A counter ticking up is decoration: the number is deterministic and was already legible. Precedent note kept in `Published.css`/`Published.tsx`, no motion added |
| **Achievement-unlock moment on Summary** (named in the brief) | No — **not possible in scope** | There is no achievement-unlock UI on Summary. `persistAndComputeSummary` unlocks and persists them; only Stats renders them. Adding the moment means new content strings and a store/props read — a parallel task's file surface and out of this task's scope. Flagged in §7 |
| **Hover / press / focus states** | No | R5.5's instant state change is the Nothing-OS restraint, and the single most valuable line in the old §5. Kept verbatim |
| **`<details>` "How this works" accordion** (Lab) | No | Native `<details>`; an accordion slide is named in R5.5 as forbidden, and it needs no beat — the disclosure *is* the feedback |
| **SpecCurve / CoefPlot / DataCut redraws** | No | A figure redrawing itself is a state change, not a beat that says something happened. Animating 1,792 points is also the one thing here that would not be free |
| **Journal cover / masthead** | No | R8.3: one signature per act. A third thing asking to be looked at competes with the dial and the stamp and loses |
| **Popover / toast exits** | No | Closing carries no information. This is also why the system has **one** easing rather than an enter/exit pair — an unused `--ease-exit` token would be a claim the product does not make |
| **A dial "sweep" bigger than 2px** (the brief floated it) | No | R8.1 forbids the dial asking for attention beyond size and colour — no glow, no halo, no pulse. The band colour is already the state signal; the settle only marks arrival. Kept at exactly 2px |
| **Confetti** | Unchanged | Already right, already gated, already pinned by §7.5 |
| **A second stagger on any screen** | No | R5.7 codifies "at most one staggered group per screen". Published's cover has a career line, an altmetric block and the clippings; only the clippings cascade |

---

## 7. Concerns / hand-offs

1. **Reduced-motion E2E note for T23** (the task spec asks for this): the parity guarantee
   is now a property of the token scale, so a single E2E assertion covers all seven CSS
   sites — emulate `prefers-reduced-motion: reduce`, walk to any screen, and assert
   `getComputedStyle(document.documentElement).getPropertyValue('--dur-scene').trim() === '1ms'`
   plus `document.querySelectorAll('*')` yielding no `getAnimations()` entry in `running`
   state 100ms after a screen change. The two JS-gated sites (confetti canvas, stamp class)
   need their own assertions: `document.querySelector('canvas')` absent on Published, and
   `.ph-stamp--animate` absent on the reveal.
2. **The achievement-unlock moment is genuinely missing, not just un-animated.** Summary
   computes `unlockedToday` inside `persistAndComputeSummary` and then discards it (only
   `preregUnlocked` survives into the return). Whoever owns Summary's content should decide
   whether the day's newly-earned achievements deserve a line there; if they do, R5.2's
   table is where its motion row goes, and the site would reuse site 5's staggered idiom
   verbatim.
3. **The stamp/block overlap** documented at the end of §4 — 120ms of the slam happens
   while its block is still fading in. It reads well and I left it, but it is the one place
   two sites in the register overlap in time, and a future taste call could chain them.
4. **`--dur-stagger` is named as a duration but is a delay.** It sits in the `--dur-*`
   family so the test's scan and the reduced-motion collapse both reach it automatically,
   and R5.1/§9 both say so in words — but it is the one token whose name is slightly wider
   than its job.
5. **The toast evidence came from the failure path.** Headless Chrome grants no clipboard
   permission, so the observed line was `summary.shareFailed` ("Couldn't share this
   result.") rather than `summary.copied`. Both render the same `.ph-summary__toast`
   element and therefore the same animation, so the evidence holds for site 7 — but the
   success string itself was not visually captured, and that is stated here rather than
   glossed.
6. **Practice mode's scenario rotates between boots**, so the number of knob turns to reach
   significance varied (1–10, and once >40) across capture runs. Irrelevant to motion, but
   it is why the stamp probe needed a retry loop and why before/after shots are of
   different scenarios.
7. **No `dgp` flake fired** in any of the five full suite runs.

---

# Fix round 1 — review verdict NEEDS FIXES

**Commit:** `9214c15` on `task-t35` (on top of `a1a31d4`, not pushed)
**Gates:** `tsc` 0 · `eslint` 0 · `vitest` 0 (**50 files, 1302 tests**, +6) · `vite build` 0
**Files added:** `src/ui/hooks/useEnterOnce.ts`.

## I1 (Important) — site 5 played to an empty room on mobile

The reviewer found that the press clippings reproduced **the exact defect this task
diagnosed for the stamp**, one screen over: trigger was *mount*, and at 360 every card
sits below the fold. Confirmed and fixed.

The trigger now belongs to the viewport, and — because that is now true of two sites —
it lives in **one** module rather than two copies. `src/ui/hooks/useEnterOnce.ts` owns the
one-way IntersectionObserver (fires once, disconnects), `staggerStyle()`, and
`MAX_STAGGER_STEPS`; `Reveal.tsx`'s `Block` was refactored onto it with no behaviour
change, and `Published.tsx`'s `PressCard`/`ChyronBar` now consume it. R5.7 was rewritten
to state the law outright: **an entrance may not be triggered by mount.**

**Evidence — 360×640, real build, raw CDP** (`docTop` is the card's document offset):

```
AT MOUNT +80ms (page not scrolled):
  card0 docTop=899  inView=false entered=false opacity=0 anim=NONE
  card1 docTop=1057 inView=false entered=false opacity=0 anim=NONE
AT MOUNT +1580ms (still not scrolled):
  card0 docTop=899  inView=false entered=false opacity=0 anim=NONE
  card1 docTop=1057 inView=false entered=false opacity=0 anim=NONE
+60ms AFTER SCROLLING THE LIST INTO VIEW:
  card0 inView=true entered=true opacity=0.268 anim=ph-clipping-enter:running@33ms delay=0
  card1 inView=true entered=true opacity=0     anim=ph-clipping-enter:running@33ms delay=60
+560ms AFTER SCROLLING:
  card0 inView=true entered=true opacity=1 anim=NONE
  card1 inView=true entered=true opacity=1 anim=NONE
```

Nothing runs while off-screen; both fire on entry; the 0/60ms stagger survives (card1 is
at opacity 0 at +33ms because it is inside its own delay window — which is exactly what
`backwards` fill is for).

**1088×900 unchanged in feel** — cards 0 and 1 are in view at mount and animate
immediately at delay 0/60, as before. The tier-3 chyron (docTop 937 vs vh 900) now
correctly waits for its own entry at delay 120 instead of playing invisibly:

```
AT MOUNT +80ms:  card0 inView=true  entered=true  running@50ms delay=0
                 card1 inView=true  entered=true  running@50ms delay=60
                 card2 inView=false entered=false anim=NONE
+60ms AFTER SCROLL: card2 inView=true entered=true running@50ms delay=120
```

**Reduced motion, 360×640** — all three cards `entered=true, opacity=1, anim=NONE` from
mount while still below the fold: nothing gated on scrolling, nothing waiting.

## Polish

- **M1 — colour exception file-scoped, register keyed on identity.** `color` is now legal
  only in `components/PValueDial.css`. The register compares `(file, identity)` pairs —
  identity being a `@keyframes` name or `transition:` plus its sorted property list —
  instead of per-file counts. A count answers "how many"; the question is "which".
  DESIGN.md R5.2's `Decls` column became `Motion` and names each site. Both probes that
  beat the first cut now fail (see mutation table).
- **M2 — longhands scanned.** `transition-property`/`animation-name` feed the register and
  the compositor-property check; `-duration`/`-delay`/`-timing-function` feed the
  tokens-only check; JSX camelCase spellings included. A site written entirely in longhand
  was previously invisible to every check.
- **M3 — site 1's trigger pinned.** A new test reads `App.tsx`'s `<main>` element (comments
  stripped, since the note above it says "`<main>`" in prose) and asserts `.ph-screen` plus
  a `key` that varies with **both** `page` and the game screen. Deleting the key now fails.
- **M4 —** §10 now says "Five checks", matching the test's own header, and describes all
  five accurately.
- **M5 —** `Lab.css:71`'s sentence, truncated by an earlier surgical edit, repaired.
- **M6 —** stale cross-refs repointed: `Lab.tsx` (R5.5's "budget is exhaustive" → R5.2's
  register), `Reveal.tsx`'s header and its CTA comment (R5.3 → R5.2 site 3).
- **M7 —** `TICK_MS = 140` replaced with `readDurQuickMs()`, the exact idiom
  `Published.tsx`'s `readDurConfettiMs()` sets — so the timer that re-arms the settle
  shortens to 1ms with the animation under reduced motion instead of holding for 140ms.
- **M8 —** the cropped slam. Measured worse than reported: mark `left: -76` at 1088 (and
  `-49` at 360) at +30ms. **Root cause found:** `.ph-reveal` was the only screen with no
  inline gutter — `padding-block` only, while `.ph-briefing`, `.ph-summary` and
  `.ph-published__cover` all carry `var(--space-24)` — so at 1088, where `--page-max`
  makes the column exactly viewport-wide, the truth line began at x=0 and fig. 1's "1.00"
  axis label was clipped by the window. That is a layout defect in its own right and it is
  why the stamp had ~12px of room. Fixed both: the gutter (one registered token, matching
  its siblings; it can only remove overflow, never add it) and the overshoot down from
  `scale(1.6)` to `scale(1.20)`. The 1.6 had never been looked at by anyone — it only ever
  ran inside a transparent block, which is why its widest frame had never been checked
  against the layout it lands in. Nothing else in the timeline moved: the 0.94 undershoot,
  the 20° rotation swing, the opacity ramp, the ≤2px shake, `--dur-stamp` and
  `--ease-stamp` are untouched.

  | | 360 @+30ms | 1088 @+30ms | doc scrollWidth |
  |---|---|---|---|
  | before | `left: -49` | `left: -76` | = viewport |
  | after | `left: 24` | `left: 10` | = viewport at every sample, both widths |

  (`scale(1.24)` also cleared, at `left: 4` on 1088; 1.20 was taken for the headroom.)
  No horizontal overflow introduced anywhere — Lab re-checked too: `360/360`, `1088/1088`.
- **M9 —** accepted, no action.

## Mutation evidence for every check tightened

| Probe | Result |
|---|---|
| M1a — unregistered `color` transition added to `Published.css` (**the probe that beat round 1**) | **RED** ×2: register pairs + colour-file scope |
| M1b — swap `ph-toast-enter` for another keyframe inside the same file (count unchanged) | **RED** ×2: register pairs + keyframes-all-consumed |
| M1c — add a phantom identity to DESIGN.md instead of the code (**the count trick**) | **RED**: register pairs |
| M2a — a site in longhand with a raw `cubic-bezier()` | **RED** ×2: raw easing + register |
| M2b — longhand `transition-duration: 220ms` | **RED** ×2: raw duration + register |
| M3 — delete `key={…}` from `<main>` | **RED**: site-1 trigger |
| baseline restored | 26/26 green |

## Still parked, per the verdict

The dial-settle's 2px restraint (a law question about R8.1, not an implementation defect)
and Summary's unspent stagger budget (T38's surface — it will reuse site 5's idiom, which
is now a shared hook rather than something to copy).
