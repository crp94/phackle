# T37 — applying the T36 UI-language audit across all three locales

Branch `task-t37`, worktree `.claude/worktrees/task-t37`, parent `67028cd` (post-T33).
The audit examined `8420d3d`; every row below was checked against the CURRENT value before being applied.

Two commits: `3cc6d03` (the audit pass) and the fix-round-1 commit on top of it (§10).

## 0. Counts

| Outcome | ES (§3a) | IT (§3b) | IT achievements (§3c) | EN (§5) |
|---|---:|---:|---:|---:|
| applied | 21 | 34 | 9 | **7 values** + 10 comment blocks |
| superseded by T33 | 1 | 1 | 0 | 0 |
| reverted by ruling (fix round 1) | 1 | 0 | 0 | 0 |
| deviated | 0 | 0 | 0 | 2 (wording judgment, §5.3 propagation) |
| blocked by a law | 0 | 0 | 0 | 0 |

**Rows are not strings.** The audit's 67 rows (23 ES + 35 IT + 9 IT achievements) are the unit the
table counts; the number of STRINGS this task rewrote is larger, because three things travel with
the rows and have no row of their own:

| source | strings |
|---|---:|
| §3a/§3b/§3c rows applied | 64 |
| EN §5 value changes (§5.1, §5.3 ×4, §5.4) | 7 |
| §5.3 propagation into IT/ES (`accounting2`/`2Abandoned`/`3` ×2 locales) | 6 |
| `legend.emojiSpec` (IT) — superseded row, one word forced by `findMissingSpecKnobs` | 1 |
| `share.forksWord`/`share.streakWord` ×3 locales (I2 ruling, fix round 1) | 6 |
| **total strings changed** | **84** |

(78 of those 84 landed in `3cc6d03`, before the ES `lab.submit` revert; the fix round nets +6.)

Nothing was blocked. Two strings are author-worded rather than audit-worded, both because the
audit gave no target form for them (the §5.3 accounting restructure was a controller ruling, not a
table row); both are flagged in §3 below.

## 1. Gate

Exit codes captured before any pipe. Both runs shown; the fix round is the one that ships.

| Command | `3cc6d03` | fix round 1 |
|---|---|---|
| `npx tsc --noEmit` | **0** | **0** |
| `npx eslint .` | **0** | **0** |
| `npx vitest run` | **0** — 49 files, **1274/1274** | **0** — 49 files, **1274/1274** |
| `npx vite build` | **0** | **0** |

The known `dgp.test.ts` flake did not fire in either run; no isolation run was needed.
The four laws named in the brief all still hold under the changed strings, enforced by the suite
that passed: token-set parity and no-repeated-token (`it.shape`/`es.shape`), decimal-point /
no-comma-decimal (`it.shape`), `<=1` em dash per string plus the `>=2500` chars-per-dash density
floor, and "IT dashes `<=` EN dashes". `stats.noData`'s `—` remains the only U+2014 in either
locale's VALUES (the new header comments contain em dashes; comments are not scanned — the
validator walks the content object at runtime).

## 2. §7 controller ruling — IT mode name

`Preregistrazione` everywhere. Applied in all five places:

| key | new value |
|---|---|
| `stats.preregModeLabel` | `Modalità Preregistrazione` |
| `briefing.playPrereg` | `Gioca in modalità Preregistrazione` |
| `summary.playPrereg` | `Prova la modalità Preregistrazione` |
| `briefing.playHacking` | `Gioca in modalità Hacking` (sentence case only) |
| `stats.hackModeLabel` | `Modalità Hacking` (unchanged — sentence-initial, audit says leave) |

**No fallback to `Prereg` was needed.** Measured, not estimated: headless Chrome
(`google-chrome --headless=new`) rendering the real `tokens.css` + `App.css` + `Briefing.css` +
`Summary.css` + `Stats.css` against the exact DOM of the three affected controls, inside a 360px
iframe (Chrome's own window floor is 500px, so the viewport was made real with an iframe rather
than `--window-size`):

```
iframe innerWidth=360   documentElement.scrollWidth=345   HORIZONTAL_DOC_OVERFLOW=false
btn-prereg          "Gioca in modalità Preregistrazione"  w=297.0 h=67.0 right=321.0 parentRight=321.0  OVERFLOWS_PARENT=false OVERFLOWS_VIEWPORT=false
btn-summary-prereg  "Prova la modalità Preregistrazione"  w=273.6 h=47.0 right=297.6 parentRight=321.0  OVERFLOWS_PARENT=false OVERFLOWS_VIEWPORT=false
lbl-prereg          "Modalità Preregistrazione"           w=297.0 h=18.2 right=321.0 parentRight=321.0  OVERFLOWS_PARENT=false OVERFLOWS_VIEWPORT=false
```

The briefing CTA WRAPS to two lines (46px -> 67px tall) and the stats label stays on one. A wrap is
not an overflow: no rule in `src/ui/**/*.css` sets `white-space: nowrap`, `text-overflow` or a fixed
width on any of these containers (verified by grep), and the longest unbreakable word,
`PREREGISTRAZIONE`, fits its line with room to spare. Screenshot confirms it visually.

## 3. EN — the new strings (§5.1, §5.3, §5.4 adopted as value changes)

These are the FINAL values, after fix round 1's I1 correction (see §10.1 for what they were in
`3cc6d03` and why that was not good enough).

```ts
'briefing.openData': 'Open the data',

'reveal.accounting2':          'You explored {k} of them before publishing.',
'reveal.accounting2Abandoned': 'You explored {k} of them before reporting a null result.',
'reveal.accounting3':
  'A researcher randomly exploring {k} of them finds at least one "significant" result about {pHitPct}% of the time.',
'reveal.peekSurcharge':
  'Your data-peeking ({peeks}×) makes the true number of analyses roughly {mult}× larger than this curve shows.',

'stats.forkHistogramBar': 'Forks: {forks}. Played: {count}',

'a11y.localeToggle': 'Language',
```

`summary.streak` EN is **unchanged** (`{n} day streak` survives at 1 as an attributive), per the
brief; the IT fix was applied instead (`Giorni consecutivi: {n}`), and ES was already fixed.

Token sets, token order and token counts are byte-identical to the old values in every one of these,
so `Reveal.tsx`'s `interpolate()` still emits the same `.ph-num` spans in the same order
(`reveal.test.tsx`'s `['1792','87','4.9','14','14','52','3','4']` pin passes untouched).

**The three shapes used**, each of which is correct at its token's FLOOR, not merely at a
convenient test value (all nine strings printed at the floor in §10.1's evidence block):

* **partitive / anaphoric** — `{k} of them`. The count quantifies a set named in the previous
  sentence, so nothing downstream has to agree. Used by EN `accounting2`/`2Abandoned`/`3`.
* **singular head noun** — `Your data-peeking ({peeks}×) makes …`. A mass-noun subject never makes
  the verb switch. Used by EN `peekSurcharge`, and by IT/ES `peekSurcharge`
  (`Le tue sbirciate ai dati ({peeks})` — the count is parenthesised behind a noun that is already
  plural for reasons unrelated to `{peeks}`, which is why the IT/ES form was correct as authored).
* **label-colon-count** — `Forks: {forks}`. No grammar after the colon at all. Used by
  `stats.forkHistogramBar` in all three, by IT/ES `accounting2`/`2Abandoned`, by IT/ES
  `summary.streak`, and by the share grid's line 3 (§10.2).

Act II register preserved throughout: still a results paragraph, still no verdict on the player.
The EN header's plural-safety note now states these three forms, names which key uses which, and
records the two shapes that were TRIED AND REJECTED (a bare parenthesised count after a plural head
noun; `({peeks} times)`), so the next person does not re-derive them.

**Deviation 1 (IT/ES `reveal.accounting3`).** Native phrasing of the same shape:
`quello stesso numero di sentieri ({k})` / `esa misma cantidad de senderos ({k})`. The audit gave no
row for these keys; they follow the shape its `peekSurcharge` and `forkHistogramBar` rows set. The
reviewer verified both are genuinely correct at 1 and they are left exactly as authored — parity
across locales is a TOKEN-SET law, not a structural one, so EN's partitive and IT/ES's restated
noun coexist legally.

**Deviation 2 (EN `reveal.accounting2`/`3`'s antecedent).** Applied as the reviewer worded them.
One residual note, not a request to change anything: `them` in `You explored {k} of them` takes its
antecedent from `accounting1`, which reads "Of {total} possible analyses, {sig} ({sigPct}%) reach
p < .05 by chance alone." The intended referent is `{total} possible analyses` (the topical set);
`{sig}` is closer in linear order. The reading is unambiguous in practice because `{k}` is the
player's own exploration count and the paragraph is about the whole space, and the code comment now
pins the antecedent so a future reorder cannot silently break it.

### EN comment-only hardening (§5.2, §5.5–§5.11)

| § | key(s) | what was added |
|---|---|---|
| 5.1 | `briefing.openData` | the ACTION / primary-CTA note, plus why the old value misled both translators |
| 5.2 | `legend.emojiPeek`/`emojiSubmit`/`emojiAbandon`/`emojiPrereg` | LEGEND GLOSSES: impersonal, nominal, never a finite verb, never 2nd person |
| 5.3 | above `reveal.accounting1` | standing plural-safety note naming the REAL FLOOR of every counting token: `{k}>=1`, `{peeks}>=1` (`{mult}>=2`), `{forks}>=0`, `summary.streak {n}>=1`, `altmetricScore {n}>=40`, `omittedFootnote {n}>=1`, `accounting1 {sig}` may be 0, `share.forksWord` pluralized by nothing |
| 5.4 | `a11y.localeToggle` | names a `role="group"`; not an action |
| 5.5 | `lab.exclusion` | English noun-noun compound; Romance languages need the preposition |
| 5.6 | `lab.forkTrailHint` | "key" = "the explanation of the symbols"; do not translate the noun literally |
| 5.7 | `lab.howThisWorks` block | **reworded** the old "reuse the wording verbatim" instruction to "same beat, same NOUN; each locale sets the mood its own UI conventions require" |
| 5.8 | `summary.share`, `stats.close` | ACTION — noun/verb and adjective/verb homographs |
| 5.9 | `call.real`, `call.noise` | option titles, not commands; never verbify |
| 5.10 | `nav.themePaper`, `nav.themeDark` | STATE, not action |
| 5.11 | `nav.legend` | must read as a page NAME in both render sites |

## 4. §3a — Spanish (23 rows)

| key | status | new value |
|---|---|---|
| `briefing.openData` | applied | `Abrir los datos` |
| `published.faceTruth` | applied | `Afrontar la verdad` |
| `summary.playPrereg` | applied | `Probar el modo Preregistro` |
| `legend.emojiPeek` | applied | `Recogida de más datos ("solo un lote más")` |
| `legend.emojiAbandon` | applied | `Informe de un resultado nulo` |
| `legend.emojiSpec` | **superseded by T33** | T33's six-knob value kept verbatim (`…variable de resultado, subgrupo, covariables, exclusión de atípicos, transformación o cambio a una cola`). Same intent as the audit's proposal; T33 says `cambio a una cola` where the audit wrote `paso a una cola`. Kept T33's. |
| `lab.forkTrailHint` | applied | `Cada símbolo es un movimiento que hiciste. La clave está en la página Leyenda.` |
| `prereg.commit` | applied | `…a ejecutar exactamente esta especificación y a informar de su resultado, muestre lo que muestre.` |
| `stats.forkHistogramBar` | applied | `Bifurcaciones: {forks}. Partidas: {count}` |
| `reveal.peekSurcharge` | applied + §5.3 | `Tus vistazos a los datos ({peeks}) hacen que … sea aproximadamente {mult}× mayor …` |
| `a11y.shareButton` | applied | `Copiar el resultado al portapapeles` |
| `nav.about` | applied | `Información` |
| `lab.submit` | **reverted by ruling (fix round 1)** | back to `Enviar a publicación`. The audit's `Enviar a publicar` is idiomatic alone but split the act three ways: `publicar` here, `publicación` in `legend.emojiSubmit`, `a publicación` in `lab.howThisWorks.step3`. One phrase for one act. |
| `lab.subgroupUrban` | applied | `Zona urbana` |
| `lab.subgroupRural` | applied | `Zona rural` |
| `briefing.modeChooserIntro` | applied | `…Elige cómo quieres jugar hoy…` |
| `reveal.omittedFootnote` | applied | `…tenían demasiado pocos datos…` |
| `summary.breakdownUnderpoweredLuck` | applied | `Suerte con poca potencia` |
| `legend.emojiSubmit` | applied | `Envío a publicación` |
| `legend.emojiPrereg` | applied | `Preregistro (prefijo)` |
| `legend.emojiCallCorrect` | applied | `Veredicto correcto` |
| `legend.emojiCallIncorrect` | applied | `Veredicto erróneo` |
| `a11y.localeToggle` | applied | `Idioma` |

Plus the §5.3 propagation: `reveal.accounting2` / `accounting2Abandoned` / `accounting3`.
`lab.howThisWorks.step4` keeps `Enfréntate a la verdad…` — its comment was rewritten to say the
term is shared with `published.faceTruth` and the mood deliberately is not.

## 5. §3b — Italian (35 rows)

All 35 applied except one, which T33 superseded:

`briefing.openData` `Apri i dati` · `reveal.nullReported` `RISULTATO NULLO` · `summary.streak`
`Giorni consecutivi: {n}` · `stats.forkHistogramBar` `Biforcazioni: {forks}. Giocate: {count}` ·
`lab.forkTrailHint` `…Il significato di ciascuno è nella pagina Legenda.` · `call.title` `Prima di
vedere la rivelazione…` · `prereg.intro` `…nessuna rivelazione da sbirciare…` · `prereg.locked`
`…fino alla rivelazione.` · `about.priorArtSpecCurve` `…il grafico della rivelazione…` ·
`about.priorArtOptionalStopping` `…addebitato alla rivelazione.` · `briefing.playHacking` /
`briefing.playPrereg` / `summary.playPrereg` / `stats.preregModeLabel` (§2 above) · `lab.exclusion`
`Esclusione degli outlier` · `lab.explain.outcome` `…prova a spiegare questa analisi.` ·
`a11y.specCurveChart` `Grafico dei p-value di tutte le specificazioni possibili, ordinate, con
evidenziata quella che hai pubblicato.` · `errors.workerCrash` `…durante la generazione…` ·
`lab.howThisWorks.step1` `Leggi la scheda…` · `stats.callAccuracy` `Precisione dei verdetti` ·
`stats.successRateTitle` `…hacking vs. preregistrazione` · `summary.nextIn` `…{hours} h {minutes}
min` · `about.mechanism` `…un trattamento con confondimento da età e reddito…` · `legend.emojiPeek`
`Raccolta di altri dati ("solo un altro lotto")` · `legend.emojiSubmit` `Invio per la pubblicazione`
· `legend.emojiAbandon` `Segnalazione di un risultato nullo` · `legend.emojiPrereg`
`Preregistrazione (prefisso)` · `a11y.shareButton` `Copia il risultato negli appunti` ·
`a11y.localeToggle` `Lingua` · `a11y.closeDialog` `Chiudi la finestra di dialogo` ·
`lab.subgroupUrban` `Area urbana` · `lab.subgroupRural` `Area rurale` · `reveal.peekSurcharge` `Le
tue sbirciate ai dati ({peeks}) rendono…` · `summary.breakdownUnderpoweredLuck` `Colpo di fortuna
sottopotenziato`.

**`legend.emojiSpec` — superseded by T33, with one word changed under a LAW.** T33 already shipped
the six-knob enumeration, so its wording is kept. One token inside it had to move anyway:
`findMissingSpecKnobs` (`tests/content/shape.test.ts:139`) requires `legend.emojiSpec` to CONTAIN
`copy['lab.exclusion']` verbatim, and this task changes `lab.exclusion` to `Esclusione degli
outlier` (§3b row, §4b rule 5). The enumeration therefore reads `…esclusione degli outlier…` — which
is exactly the audit's own proposed wording for that fragment, so this is the audit landing, not a
deviation.

Plus the §5.3 propagation on `reveal.accounting2` / `accounting2Abandoned` / `accounting3`.

## 6. §3c — Italian achievement names (9 rows, all applied)

`Prima firma` · `Primo ritiro` · `Il bandito a una coda` · `Chirurgo degli outlier` · `Safari tra i
sottogruppi` · `Solo un altro lotto` · `Il giardino dei sentieri che si biforcano` · `Il monaco` ·
`Beh, in realtà`. `HARKing` (acronym) and `True Detective` (proper title) untouched, and a comment
above the block now says why they are the exceptions.

## 7. §6 applier notes

* `'briefing.openData'` **removed** from `SHARED_WITH_EN` in `tests/content/it.shape.test.ts`, with a
  comment recording that the entry was the bug institutionalised as a fixture.
* §4a convention contract (10 rules) added as a header comment in `src/content/es/copy.ts`;
  §4b (12 rules) in `src/content/it/copy.ts`. Every rule kept; wording condensed.
  The IT header's English allowlist now also records that `Open Data` was only ever sanctioned as a
  prose BADGE, never as a button, and adds `df` (which the locale already uses).

## 8. Collateral — tests updated (pinned VALUES only, no law weakened)

| file | change |
|---|---|
| `tests/ui/briefing.test.tsx` | `getByText('Open Data')` -> `getByText('Open the data')` (x2, plus the click target and three test names) |
| `tests/ui/shell.test.tsx` | `getByRole('group', { name: 'Change language' })` -> `{ name: 'Language' }` (x2) |
| `tests/content/it.shape.test.ts` | `SHARED_WITH_EN` entry removed (§6) |
| `tests/game/share.test.ts` | line-3 format pins repointed for the I2 ruling (fix round 1, §10.2) |

Nothing else needed touching: `reveal.test.tsx`, `stats.test.tsx` and `legend.test.tsx` all build
their expectations through `t()`/`copy[...]` rather than pinning literals, and `copyFreeze.test.ts`
checks key EXISTENCE, not values — no key was added or removed.

## 9. Concerns

1. **`briefing.playPrereg` now wraps to two lines at 360w.** Measured and within budget (no
   overflow, no clipping), but it is the only two-line CTA in the Italian build. If the owner
   dislikes the wrap, the single-word fallback is `Prereg` in all five places — the ruling's own
   escape hatch, not needed on layout grounds.
2. **`legend.emojiCallCorrect` (ES) is now string-identical to `summary.breakdownCallCorrect`.**
   Deliberate per the audit (same concept, same words), and no test forbids it, but it means a
   future rename of one has to consider the other.
3. **`a11y.localeToggle` is now string-identical to `nav.localeToggle` in all three locales.** That
   is the point (§5.4: the group is NAMED, not commanded), and `nav.localeToggle` still has no
   render site, so nothing announces the word twice today. Worth remembering if `nav.localeToggle`
   is ever wired up next to the group it names.
4. **The share string's line 3 changed shape** (§10.2). Anyone who has posted a P-hackle result
   before will see a different layout from today; the emoji trail, the puzzle number and the URL —
   the parts people actually recognise — are untouched.

---

# 10. Fix round 1

Applied on top of `3cc6d03` after the review verdict (APPROVED with one Important pre-merge fix).

## 10.1 [I1] EN floor-value agreement — Important

**The finding was correct.** `3cc6d03`'s header note claimed the new forms "agree at every value".
They did not agree at the FLOOR:

| shipped in `3cc6d03` | at the floor | why it failed |
|---|---|---|
| `Your data-peeks ({peeks}) make …` | "Your data-peeks (1) make …" | plural head noun AND plural verb survive the parenthesis; one-peek days are the COMMON case for this line |
| `A researcher randomly exploring that many paths ({k}) …` | "…that many paths (1)…" | `that many` is marked at 1 |
| `Paths you explored before publishing: {k}.` | fine at 1 | but the label-colon form flattened three consecutive statements into a ledger row, which the reviewer flagged separately |

**Fixed to the reviewer's anaphoric forms plus a singular head noun**, final values quoted in §3.
`{peeks} times` was rejected on the stated constraint ("1 times"); the sanctioned `×` idiom was
taken, and it earns its place — the sentence already ends on `{mult}×`, so the two figures now sit
in the same notation: *peeked 3×, so 4× the analyses*.

**The header note's claim is now TRUE of what ships**, not softened: it enumerates the three forms
(partitive/anaphoric, singular head noun, label-colon-count), says which key uses which, and records
the two rejected shapes so the reasoning is not lost.

**Evidence — every counting string rendered at its floor and at a high value**, printed from the
real catalogs through the real `t()`:

```
--- en at the FLOOR (k=1, peeks=1, forks=0 and 1) ---
Of 1792 possible analyses, 87 (4.9%) reach p < .05 by chance alone.
You explored 1 of them before publishing.
You explored 1 of them before reporting a null result.
A researcher randomly exploring 1 of them finds at least one "significant" result about 5% of the time.
Your data-peeking (1×) makes the true number of analyses roughly 2× larger than this curve shows.
Forks: 0. Played: 1        Forks: 1. Played: 1
1 day streak
share line3 @1: Forks: 1 · Streak: 1
--- en at a HIGH value (k=14, peeks=3) ---
You explored 14 of them before publishing.
A researcher randomly exploring 14 of them finds at least one "significant" result about 52% of the time.
Your data-peeking (3×) makes the true number of analyses roughly 4× larger than this curve shows.

--- it at the FLOOR ---
Sentieri che hai esplorato prima di pubblicare: 1.
Un ricercatore che esplora a caso quello stesso numero di sentieri (1) trova almeno un risultato "significativo" circa il 5% delle volte.
Le tue sbirciate ai dati (1) rendono il numero vero di analisi circa 2× più grande di quanto mostri questa curva.
Biforcazioni: 0. Giocate: 1        Giorni consecutivi: 1
share line3 @1: Biforcazioni: 1 · Serie: 1

--- es at the FLOOR ---
Senderos que exploraste antes de publicar: 1.
Quien explora al azar esa misma cantidad de senderos (1) encuentra al menos un resultado "significativo" alrededor del 5% de las veces.
Tus vistazos a los datos (1) hacen que el número real de análisis sea aproximadamente 2× mayor de lo que muestra esta curva.
Bifurcaciones: 0. Partidas: 1        Días seguidos: 1
share line3 @1: Bifurcaciones: 1 · Racha: 1
```

IT/ES left exactly as authored, per the instruction and the reviewer's own verification.
**Token order is unchanged** in every edited key, so `reveal.test.tsx`'s `.ph-num` span pin
(`['1792','87','4.9','14','14','52','3','4']`) needed no edit and passes untouched.

## 10.2 [I2] `share.forksWord` — controller ruling, scope granted

`§2.9`'s line-3 composition printed `1 forks` / `1 biforcazioni` / `1 bifurcaciones` on any one-fork
day, in the one string that leaves the app and lands in other people's timelines.

**New composition** (`src/game/share.ts`, one line):

```ts
const line3 = `${i.copy['share.forksWord']}: ${forks} · ${i.copy['share.streakWord']}: ${i.streak}`;
```

| locale | line 3 at forks = 6, streak = 12 | at forks = 1 |
|---|---|---|
| en | `Forks: 6 · Streak: 12` | `Forks: 1 · Streak: 1` |
| it | `Biforcazioni: 6 · Serie: 12` | `Biforcazioni: 1 · Serie: 1` |
| es | `Bifurcaciones: 6 · Racha: 12` | `Bifurcaciones: 1 · Racha: 1` |

The four/six word values are capitalized for label position (`Forks`/`Biforcazioni`/`Bifurcaciones`,
`Streak`/`Serie`/`Racha`). The ES header's sentence-case rule yields here, and the comment says so
explicitly: it yields to a LABEL, not to English Title Case.

**Documented** in `share.ts` as a second "DOCUMENTED DEVIATION FROM MASTER SPEC §2.9", in the same
form as T29's: what the spec says, why it is wrong in English too, what it now says, and — stated
outright — that the spoiler property is untouched, because line 3 still takes only `forks` (from the
log) and `streak` (from the store), with no day-type channel of any kind.

**The spoiler property test passes UNMODIFIED.** The only edits to `tests/game/share.test.ts` are
the three string-format pins (the line-3 equality, the §2.9-sample full-string equality, and that
test's own name) plus a comment recording the ruling. The 300-trial × 3-locale property test and the
300-trial prereg-shape test were not touched.

## 10.3 Minor fixes

| # | fix |
|---|---|
| 1 | Report count cell corrected to **7** EN values, and §0 now carries the rows-vs-strings reconciliation (67 rows -> 84 strings). |
| 2 | ES `lab.submit` **reverted** to `Enviar a publicación` (ruling); the ES header's rule-1 exemplar list no longer cites the reverted form, and `prereg.commit`'s comment, which named it as the colliding string, was repointed. |
| 3 | IT header rules 8 and 10 said "point 3/1 above", which collided with the contract's own numbering. Both now name the target list explicitly ("item 3 of the 'deliberately NOT Italian' list at the top of this file"). **The identical defect in the ES header's rule 8** ("see rule 2 above") was fixed the same way — same bug, same file class, not worth a second round. |
| 4 | IT contract rule 7 gains the ES-style carve-out: *la verità* is not a fourth name for the reveal screen, it is the shared noun of `published.faceTruth` and `lab.howThisWorks.step4`; "Guarda in faccia la verità" is correct and is not to be "fixed". |
| 5 | §5.10's half-correction replaced. The comment no longer says "the button shows a theme, it does not command a change" (which describes the pre-T33 single flip-flop button that no longer exists); it now carries the `call.real`/`call.noise` instruction — **option labels, never verbified** — and records that the audit was describing a control T33 replaced. |

## 10.4 Minor fix 6 — the two lengthened IT labels at 360w

Measured the same way as §2, headless Chrome against the real CSS inside a true 360px iframe:

```
iframe innerWidth=360   documentElement.scrollWidth=360   HORIZONTAL_DOC_OVERFLOW=false
stats.callAccuracy   "Precisione dei verdetti"          w=185.4 h=18.2  OVERFLOW_PX_vs_container=0.0  OVERFLOW_PX_vs_viewport=0.0  SELF_CLIPPED_PX=0
breakdownUnderpower  "Colpo di fortuna sottopotenziato"  w=277.2 h=38.0  OVERFLOW_PX_vs_container=0.0  OVERFLOW_PX_vs_viewport=0.0  SELF_CLIPPED_PX=0
invoice value cell   right=336.0  row right=336.0  row height=38.0      VALUE_OVERFLOW_PX=0.0
```

**Both zero. No fix applied.** `stats.callAccuracy` sits on one line inside the wrapping flex stat
strip; `summary.breakdownUnderpoweredLuck` wraps to two lines inside its invoice cell (18.2px ->
38.0px row) without pushing the numeral cell off the row or widening the document past 360.
