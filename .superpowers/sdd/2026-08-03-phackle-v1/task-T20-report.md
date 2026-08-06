# Task T20 — Spanish transcreation (full locale content)

**Status:** COMPLETE.
**Branch:** `worktree-agent-ab3716d8edd4c8188` (worktree `/home/carlos/PycharmProjects/phackle/.claude/worktrees/agent-ab3716d8edd4c8188`)
**Base:** `3fa8621` — **Final SHA:** `c82d475`
**Commits:** 1 (`feat: Spanish transcreation — full locale content`)

---

## STEP 0 — worktree

The harness assigned me a worktree of the **`website`** repo
(`/home/carlos/PycharmProjects/website/.claude/worktrees/agent-ab3716d8edd4c8188`), not `phackle`.
`git reset --hard 3fa8621` there would have targeted the wrong repository. I therefore created my
own phackle worktree at the matching path, branched directly from `3fa8621`, which reaches the same
end state the instruction describes (a zero-commit branch sitting exactly on the final punched-up
corpus):

```
git worktree add -b worktree-agent-ab3716d8edd4c8188 .claude/worktrees/agent-ab3716d8edd4c8188 3fa8621
```

Corpus proof verified before writing a line: `"Mentioned {n} times online already"` is present under
`published.altmetricScore` — in `src/content/en/copy.ts:501` (the brief said `en/index.ts`; the key
lives in the copy catalog, which is where the union and the two translator notes are).
`npm ci` clean; every `npm`/`npx`/`node` invocation `PATH="/usr/bin:$PATH"`-prefixed; every write
used the worktree prefix.

---

## TDD transcripts

### Baseline (before any change)

```
Test Files  46 passed (46)
      Tests  1095 passed (1095)
EXIT=0
```

### RED — parity/lexicon/budget suite against a deliberate stub

Stub: `src/content/es/index.ts` with empty banks, `src/content/es/copy.ts` with a single key.

```
$ npx vitest run tests/content/es.shape.test.ts
 ❯ tests/content/es.shape.test.ts (49 tests | 12 failed)
     × passes the shared validator with the Spanish lexicons and the English reference ids
     × ships the same scenario ids in the same order
     × matches every bank count
     × defines exactly the English achievement ids
     × defines exactly the CopyKey set English defines, and nothing else
     × preserves every interpolation token, and repeats none of them
     × keeps statistical notation on the decimal POINT, never a comma
     × states the decimal-point rule in the About page, as English does
     × keeps Prof. Grantwell under his own name, in the email and in Act II
     × keeps Reviewer 2 as Reviewer 2 in the Grantwell bank
     × is offered in the language toggle
     × is served by getContent("es") as its own module, not aliased to English
```

The second gate failed independently, as designed — `tsc` is the completeness contract:

```
$ npx tsc --noEmit
src/content/es/copy.ts(5,14): error TS2740: Type '{ 'nav.title': string; }' is missing the
following properties from type 'Record<CopyKey, string>': "nav.tagline", "nav.puzzleNumber",
"nav.about", "nav.stats", and 208 more.
```

### GREEN

```
$ npx tsc --noEmit                                   → (no output)
$ npx vitest run tests/content/es.shape.test.ts      → Test Files 1 passed | Tests 49 passed
```

### Full gate (final tree, exit codes checked)

```
$ npx tsc --noEmit && echo "TSC OK" && npx eslint . && echo "LINT OK"
TSC OK
LINT OK

$ npx vitest run
Test Files  47 passed (47)
      Tests  1145 passed (1145)

$ npx vite build
✓ built in 158ms
dist/assets/en-ChLj-Hhv.js   41.69 kB │ gzip: 15.83 kB
dist/assets/es-CYIm5hD9.js   47.00 kB │ gzip: 17.36 kB
```

The separate `es` chunk confirms the dynamic-import contract holds: an English session never
downloads the Spanish corpus.

---

## What shipped

| Bank | Count | Contract |
|---|---|---|
| scenarios | 20 | identical ids, order, `journalTags` |
| grantwell | 22 | scenario-agnostic, escalating desperation |
| press | 21 | identical tiers and `scenarioIds` bindings |
| retractionSublines | 14 | Act II |
| achievements | 11 | identical ids |
| glossary | 8 | standard Spanish statistical terminology |
| copy keys | 213 | exactly the `CopyKey` union |

Measured em-dash budget: **1 dash in 35,569 characters (1 per 35,569)** against a floor of 1 per
2,500 — roughly 14× headroom. The single U+2014 is `stats.noData`'s glyph, which is a "no data"
mark rather than punctuation. English measures 3 in 30,929 for comparison. No decimal comma appears
anywhere in the locale (`grep -nE "[0-9],[0-9]" src/content/es/*.ts` returns nothing).

### Files owned and touched

- `src/content/es/index.ts` (new) — corpus
- `src/content/es/copy.ts` (new) — 213-key catalog
- `tests/content/es.shape.test.ts` (new) — parity suite **and** the two required Spanish lexicons
- `src/i18n/locale.ts` — `AVAILABLE_LOCALES` gains `'es'` (one of the two expected shared lines)
- `src/content/index.ts` — the `es` loader line (the other)
- `tests/ui/shell.test.tsx` — **unplanned third shared file**; see Concerns

### Required lexicons

Both live in `tests/content/es.shape.test.ts`, mirroring EN's structure (EN's own lists live inside
`tests/content/shape.test.ts`, so this keeps the two symmetric and keeps test-only guards out of
`src/`).

- `HARM_LEXICON_ES` — the §4 harm policy in Spanish: `vacuna, fármaco, farmac, cáncer, cancerí,
  dieta, dietét, cura, terapia, terapéut, suplement, medicament, enfermedad, síntoma, patolog`.
  Both accented and unaccented stems are listed because the matcher anchors at word start only:
  `\bfármaco` would miss "farmacológico".
- `NEGATIVE_DIRECTION_LEXICON_ES` — `menos, menor, menores, inferior, inferiores, reducido,
  reducida, reducción, descenso, caída, caídas, bajada, disminución, merma, pérdida, pérdidas,
  error, errores, fallo, fallos, peor, peores, lento, lenta, corto, corta, breve, retraso,
  retrasos`. Singular **and** plural are both listed deliberately: the matcher is whole-word
  (`\berror\b`), so it does not match "errores" on its own.

---

## Non-translation rules

- **Journals + DOIs stay English.** `src/content/journals.ts` is untouched; the ES suite asserts
  every scenario's `journalTags` still resolve against the shared English pool. That is where
  Spanish academics actually publish, and the realism is the joke.
- **Prof. Grantwell stays Prof. Grantwell.** `briefing.emailFrom` is asserted byte-identical to
  English, and a retraction subline still names him.
- **Reviewer 2 stays Reviewer 2** — asserted in the Grantwell bank. It is what Spanish researchers
  call him.
- **Decimal POINT everywhere in notation.** `p = 0.049`, `|z| > 2.5`, `p < 0.001`, `α = .05`,
  `p < 0.05`. `about.decimalNote` is translated faithfully rather than adapted:
  *"La notación estadística usa siempre punto decimal (p = 0.049), en todos los idiomas."* The suite
  asserts both directions on eight notation-bearing keys (`\d\.\d` present, `\d,\d` absent).
- **Y₁..Y₄** is a module constant, not copy — nothing to translate, confirmed.
- **`{effect}`/`{n}` token discipline.** The suite asserts every English token is carried, and that
  no translation repeats one, because `t()` substitutes with `String.replace` and would render a
  second occurrence raw. `published.altmetricScore` is phrased plural-only
  (*"Mencionado ya {n} veces en internet"*), which is unconditionally safe given the tier-1 floor of
  40 in `ALTMETRIC_SCORE_RANGE_BY_TIER`.
- **Outcome direction preserved.** All 80 labels are phrased so more of the metric = more of the
  claimed effect, and the Spanish direction lexicon enforces it mechanically.
- **`stats.avgScore`** ("Puntuación media") translated despite being unconsumed by any screen.
- **`share.forksWord` / `share.streakWord`** → `bifurcaciones` / `racha`. Line 3 of the share grid
  renders `12 bifurcaciones · racha 5`, which is what a Spanish-speaking methods nerd would actually
  post.

### One deliberate divergence from the non-translation rules

**Press outlets are transcreated; journals are not.** The rules name journals and DOIs, not outlets.
"Buzz & Broadsheet" and "Nightly Chyron Network" carry no comedy for a Spanish reader, and the
tier-3 joke *is* the outlet. So: `Cadena Rótulo 24H`, `Canal 9 Noticias Noche`, `Directo Madrugada`,
`El Scroll Diario`, `Ruido & Rotativa`, `Clicbienestar`, `El Suplemento Dominical`,
`El Trino Matinal`, `El Balance Semanal`, `Boletín Semanal`. Journals stay English precisely because
the opposite is true there: a Spanish researcher publishes in *Nature Feline Finance*, and printing
a Spanish masthead would break the realism.

---

## Ten best transcreations

1. **`achievements.garden.name` — `El jardín de senderos que se bifurcan`.** Gelman & Loken took the
   name from Borges, so in Spanish the reference lands as its *original title* instead of a
   back-translation of a translation. The one place the Spanish corpus is funnier than the English.
2. **`cat-crypto.coverStory`** — *"una fundación cuyo fundador tiene cuatro gatos y, según nos
   cuentan, una distribución a priori muy informativa."* EN's "a very strong prior" becomes the
   actual Bayesian term of art, delivered with complete Act-I sincerity.
3. **`grantwell[17]`** — *"En el vicerrectorado han empezado a decir 'revisión de la cartera
   investigadora'. Nadie me explica qué significa. Yo sé que significa nosotros."* The provost
   becomes the vicerrectorado, and the dread survives intact.
4. **`grantwell[9]`** — *"Esta hipótesis la eligió tu yo de la carrera. Tu comisión de acreditación
   no necesita saberlo."* The tenure committee becomes the acreditación committee: in Spain that is
   a specific, feared body, so the line lands harder than the original.
5. **`grantwell[3]`** — *"El boletín del departamento necesita una alegría este mes. Desde las nueve
   de la mañana, la alegría eres tú."* Spanish lets the noun repeat as a promotion, which the
   English "you are, as of 9am, the win" has to work harder for.
6. **`jazz-spreadsheets.question`** — *"¿Escuchar jazz reduce los descuadres en las hojas de
   cálculo?"* A *descuadre* is specifically a figure that will not balance: more precise than
   "errors", and it keeps the outcome labels clear of the direction lexicon.
7. **`cold-shower-emails`** — *"la fórmula 'como ya indiqué en mi anterior correo' se marca de forma
   automática, lo que les ahorra muchísimo."* The exact Spanish office passive-aggression formula,
   reused verbatim as `outcomeLabels[2]`.
8. **`thirteen-mortgage.coverStory`** — *"El intermediario que nos consigue esas condiciones ha
   pedido no ser nombrado. Manda recuerdos."* Two words, same shrug as the English.
9. **`press[19]`** — *"P MENOR QUE CERO COMA CERO CINCO: SE LO EXPLICAMOS TRAS LA PAUSA."* A
   presenter reading a number aloud says *coma*; the notation everywhere else in the app keeps the
   point. The clash is the joke, and it exists only in Spanish.
10. **`terms-and-conditions-service.coverStory`** — *"Los consentimientos informados, por una vez,
    se leyeron enteros."* Sincere, procedural, and the whole scenario's punchline.

Runner-up, for the record: `cafe-peer-review` — *"un panel de exeditores, todos y cada uno de los
cuales han sido revisados desde una cafetería y no lo han olvidado."*

---

## Self-review

Read every line aloud. Findings, all addressed before commit:

- **Act I never winks.** No cover story, question, headline or press blurb signals that the
  hypothesis is absurd; the lab believes in itself throughout. `lab.peekFootnoteArmitage`
  (*"Dato curioso: asomarse cinco veces con α = .05 infla tu tasa de falsos positivos hasta cerca
  del 14% (Armitage, 1969)"*) is the only wink, and it keeps its citation obligation.
- **Act II is clinical.** Every subline is one sentence with no adjective doing extra work:
  *"Nadie lo ha citado. Nadie iba a hacerlo."*
- **Achievement citations read as award citations** — "Por" + the deed, delivered straight, the way
  an academy reads a prize out loud. Sentence case, which is correct Spanish typography, not
  English title case.
- **Glossary uses seminar Spanish**: *grados de libertad del investigador*, *curva de
  especificación*, *parada opcional*, *preregistro*. `p-hacking` and `HARKing` stay English because
  that is what Spanish methods papers print, and HARKing keeps its English expansion for the same
  reason.
- **Register consistency**: the corpus addresses the player as *tú* throughout, including in the
  achievement citations, so the formal-citation voice never collides with the game's own voice. The
  one *usted* is inside a quoted screening question (*"¿tiene usted una etiquetadora?"*), where a
  survey would genuinely use it.
- **Rayas avoided at the source.** The Spanish sentences are built from colons, semicolons and full
  stops rather than dashes, so the inherited budget was never close to binding.

---

## Concerns / notes for the controller

1. **`tests/ui/shell.test.tsx` is a third shared file.** Its locale-toggle test asserted the toggle
   "stays hidden while AVAILABLE_LOCALES has only one entry" — a premise that any locale landing
   falsifies. **The parallel IT agent will hit the identical failure**, so expect a conflict here as
   well as on the two expected lines. I rewrote it to assert the contract the header actually has
   (hidden at one locale, one button per locale beyond that, driven by `AVAILABLE_LOCALES` itself)
   and pinned the single-locale case directly on `LocaleToggle`, where it cannot go stale. Written
   to be length-agnostic, so it passes unchanged whether the array ends up with 1, 2 or 3 entries —
   whichever side of the conflict is kept, the merged file should be this shape.
2. **The ES suite imports from `tests/content/shape.test.ts`.** That is the documented reuse path
   ("Reused as-is by the IT/ES shape tests in T19/T20"), but importing a vitest file re-registers
   its suites in the importer's context: `es.shape.test.ts` reports 49 tests, of which ~29 are
   English suites running a second time. All pass, and the cost is ~40 ms, but a genuine EN failure
   would now be reported twice. The clean fix is to extract the validator into a plain
   (non-`.test.ts`) helper module — deliberately **not** done here, because that restructures the
   shared file the IT agent is importing concurrently. Worth doing as a follow-up once both locales
   have merged.
3. **Press outlets transcreated** — a judgement call, reasoned above. Flagging it explicitly since
   the non-translation rules named only journals and DOIs.
4. **`press[19]` spells "CERO COMA CERO CINCO"** in a tier-3 chyron. Intentional: it is a person
   speaking, not notation. Every actual statistic in the locale keeps the decimal point, and the
   suite enforces that.
5. **Worktree mismatch at STEP 0** (documented above): my assigned worktree belonged to the
   `website` repo. Nothing was written to the phackle main checkout — `git status` there was clean
   before and after.

---

# Fix round 1 (review: APPROVED with required fixes + directed punch-up)

**SHA:** `0469491` (on top of `c82d475`) · **Branch:** unchanged · **Not pushed.**
**Gate:** `tsc` exit 0 · `eslint` exit 0 · `vitest` exit 0 (**1145 tests, 47 files**) · `vite build` exit 0.
Exit codes captured directly, before any pipe or grep.

**Scope:** `src/content/es/index.ts`, `src/content/es/copy.ts`, `tests/content/es.shape.test.ts`,
and `src/i18n/locale.ts` (comment only — the `export const` line is unchanged context in the diff).
Nothing in `src/content/en`, `src/content/it`, or any other file was touched this round.

## Required

- **[I1] Shipping bug fixed.** `summary.streak` was `'Racha de {n} días'`, rendering
  **"Racha de 1 días"** for every first-day player: `Summary.tsx:107` renders it unconditionally and
  the streak includes today, so `n = 1` is the common case rather than an edge case. Now
  **`'Días seguidos: {n}'`** — plural-safe by construction, exactly one `{n}`, and it happens to
  harmonise with `summary.score` ("Puntuación: {score}") rendered directly above it.
- **[M2]** fern-negotiation clitic agreement: *"se le vende a los responsables"* →
  *"se **les** vende a los responsables"*.
- **[M6]** The `AVAILABLE_LOCALES` doc comment still claimed it/es alias English and that "nothing
  has actually been translated yet". Rewritten to state the rule plus current facts, and it still
  carries the instruction T19 needs: *"'es' qualified in T20 (src/content/es). 'it' is still aliased
  to English in src/content/index.ts and stays off this list until T19 lands its corpus."*
- **[M5]** The single `«el»` in the forking-paths glossary def now uses straight double quotes, like
  the rest of the locale. `grep -c "«\|»"` returns 0.

## Directed edits

- **[M1] Cover-story openings.** Seven opened with the identical *"La investigación"* and two with
  *"El diseño"*. **All twenty openings are now distinct**; "La investigación" is gone entirely and
  "El diseño" survives exactly once, in the fern story that carries M2's literal fix. New openings:
  - horoscope-parking: *"**Los modelos de movilidad urbana tratan** la búsqueda de aparcamiento como un proceso racional."*
  - vinyl-dinner-party: *"**En hostelería se ha caracterizado** el menú de forma exhaustiva y el tocadiscos en absoluto."*
  - telescope-directions: *"**Casi todo lo que sabemos sobre orientación espacial sale de** tareas de rotación mental hechas en laboratorio."*
  - terms-and-conditions: *"**Quien estudia la protección del consumidor** da por supuesto que nadie se lee el contrato…"*
  - jigsaw-suitcase: *"**Cuatro décadas de razonamiento espacial han producido incontables** tareas de rotación de cubos y prácticamente nada de equipaje."*
  - stairs-small-talk: *"**Un edificio decide** quién se encuentra con quién, pero las conversaciones que salen de ahí casi nunca se registran."*
  - sock-folding: *"**Del uso del tiempo se ha documentado** el trayecto al trabajo con un detalle extraordinario y el cajón de los calcetines en absoluto."*
  - browser-tabs: *"**Los estudios de atención tratan** la pestaña abierta como un coste."*
- **[M3] Grantwell.** All three addressed:
  - `[17]` → *"…Nadie me explica qué significa. **Yo sé lo que significa: nosotros.**"*
  - `[18]` de-de-de → *"**Tercer año de la convocatoria, y último.** No quiero alarmarte, pero quiero alarmarte un poco."*
  - `[8]` apunte/apuntaba echo → *"**Un consejo** antes de tu defensa: 'el efecto apuntaba en la dirección esperada' es una frase completa. Úsala."*
- **[M4]** `call.title` → *"**Antes de ver la revelación…**"*. "La revelación" is already this locale's
  name for that screen (`prereg.intro`, `prereg.locked`, `about.priorArtSpecCurve`); "la verdad"
  stays owned by `published.faceTruth` / `lab.howThisWorks.step4`.
- **[M8]** → *"**¿Tu silla de oficina te está costando un Premio Nacional?** Los expertos opinan."*
- **[9a] Comedy recovery, achievement name.** The one-armed-bandit pun has no Spanish host — the
  machine is *la tragaperras*. Rebuilt on the native word rather than translated off the English
  one: **`La tragaperras de una cola`**, which reads simultaneously as the slot machine and as a
  *contraste de una cola*, and stays short enough for a plaque. Citation unchanged (still works).
- **[9b] Comedy recovery, outlet.** *Boletín Semanal* → **`El Boletín Oficioso`** on both blurbs that
  use it. Took the reviewer's proposal: Spanish hands you the BOE, and *oficioso* is the exact
  antonym-adjacent word that makes it a joke. Journals untouched.
- **[9c] Comedy recoveries, two lines.**
  - `press[9]` destacked → *"Correlación no es causalidad, pero **esta vez es distinto, en serio.**"*
  - `retractionSublines[7]` completed → *"Se intentó una replicación. **No se acercó ni de lejos.**"*

## Item 10 — lexicon hardening (tests only)

Applied in full, and **no addition forced a reword**: every proposed term was checked against the
existing corpus first (`grep` transcript in-session), all 49 ES tests still pass, so nothing had to
be dropped under the reviewer's fallback rule.

- `NEGATIVE_DIRECTION_LEXICON_ES` += `escaso, escasa, escasos, escasas, nulo, nula, nulos, nulas,
  atraso, atrasos, baja, bajas, penaliza` (plural/gender forms listed because the matcher is
  whole-word).
- `HARM_LEXICON_ES` += `salud, médic, medic, clínic, clinic, adelgaz` (accented and unaccented
  stems, since the matcher anchors at word start).
- `nutri` and `tratamiento` excluded as directed, with the reasons now recorded in the file's doc
  comment so a future editor does not "helpfully" add them: `nutri` would fire on
  sourdough-marathon's *"conductual y no nutricional"*, which is the scenario **disclaiming** a
  nutritional reading; `tratamiento` is the app's own experimental-design vocabulary
  (`Scenario.treatmentLabel`, `about.mechanism`).

## Invariants re-verified after the round

Decimal commas: none (`grep -nE "[0-9],[0-9]"` empty). Em dashes: still exactly 1 in the locale
(`stats.noData`'s glyph). Guillemets: 0. Token discipline, direction contract, harm check, structural
parity and the em-dash budget all still green through the ES suite.

## Rulings acknowledged

M7 (validator extraction) stays deferred until both locales merge — unchanged from my original
Concern #2. M9: es-ES peninsular confirmed as written; the corpus is denominated in euros, metres
and litres, and uses *coche/aparcamiento/móvil/puzle*, so it is already coherent with that ruling.

**Standing concern, unchanged:** `tests/ui/shell.test.tsx` (touched in `c82d475`, not this round)
remains a third shared file the IT agent will also need to change.
