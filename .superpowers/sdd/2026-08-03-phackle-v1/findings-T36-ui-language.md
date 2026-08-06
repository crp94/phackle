# T36 — UI-LANGUAGE audit of the Italian and Spanish locales

Read-only audit. State: commit `8420d3d`, main checkout. Nothing changed.
(Persisted verbatim by the controller from the auditor's report; the auditor's file write was blocked by harness policy.)

**What this is.** Prior locale reviews judged the comedy PROSE. This one judges the locales **as interfaces**: every string classified by what it does on screen, read off its rendering site, then checked against the target language's real software conventions.

## 1. Summary — counts by severity

| Locale | WRONG-FUNCTION | AWKWARD | FINE-BUT-BETTER | Total |
|---|---|---|---|---|
| **es-ES** | 6 | 5 | 12 | **23** |
| **it-IT** (copy catalog) | 2 | 16 | 17 | **35** |
| **it-IT** (corpus labels: achievement names) | 0 | 9 | 0 | **9** |
| **EN** | — | — | — | **11 hardening recommendations** |

Two headline facts:

* **Both locales fail the same key**, `briefing.openData`, both in the noun-as-action way. It is the first button a player ever presses.
* **Italian's action grammar is otherwise clean** (imperative throughout, 12/13 action keys correct). Its problems are Title Case calques, a four-way terminology split for the reveal screen, and a plural bug that fires on every Italian player's first day. **Spanish's action grammar is the inconsistent one** (infinitive-dominant with three defectors), but its terminology discipline is excellent.

### 1a. Classification coverage (reconciliation)

**213 copy keys** in `src/content/en/copy.ts` — union members and record values verified equal (213 = 213, no drift). Every one classified by rendering site, in both locales (426 classifications). Nothing unclassified:

| UI function | Keys | Examples |
|---|---:|---|
| ACTION (button/link the player activates) | 18 | `briefing.openData`, `lab.submit`, `summary.share`, `nav.stats` |
| STATE / STATUS / LABEL (option labels, stamps, toasts, counters, notation) | 117 | `lab.subgroupAll`, `reveal.retracted`, `summary.copied`, `lab.pEquals` |
| HEADING / TITLE | 18 | `lab.outcome`, `call.prompt`, `stats.title` |
| INSTRUCTION / BODY | 52 | `lab.dialCaption`, `reveal.accounting1`, `about.mechanism` |
| ARIA / A11Y-ONLY | 8 | `a11y.*` (6), `stats.forkHistogramBar`, `stats.locked` |
| **Total** | **213** | |

Per-prefix counts used for reconciliation: nav 9, briefing 10, email 2, lab 55, published 8, call 6, reveal 40, share 2, summary 18, prereg 5, stats 16, about 17, legend 17, errors 2, a11y 6 = **213**.

**Keys with no rendering site in `src/ui` today** (still classified and audited; flagged so the applier knows the fix is invisible until wired): `nav.title`, `nav.tagline`, `nav.puzzleNumber`, `nav.localeToggle`, `legend.trueEffect`, `legend.emojiSubgroup`, `legend.emojiExclusion`, `legend.emojiTails` (deduplicated out by `Legend.tsx`'s glyph filter), `errors.storageOff`, `a11y.shareButton` (deliberately unattached — see `Summary.tsx`'s WCAG 2.5.3 note), `a11y.loading`. **11 keys.**

**Prose banks** out of scope per the brief. **In scope and audited:** glossary `term`/`def` (both locales clean), achievement `name`s (render as labels on the Stats wall — IT defective, §3c), `treatmentLabel` / `outcomeLabels` / `covariateLabels` (render as DataCut column labels and RadioGroup option labels — both clean; consistent third-person descriptors, e.g. `Possiede un gatto` / `Tiene gato`).

## 2. THE OWNER'S CASE — explicit confirmation

**Key:** `briefing.openData`
**Rendering site:** `src/ui/screens/Briefing.tsx:110-112` (and `:87-89` for the hacking-mode variant reusing the same `openData` handler) — a `<button type="button" className="ph-briefing__cta" onClick={openData}>`. The **primary CTA of the whole app**: the only thing a first-time player can press on the Briefing screen, and the transition from Act I's title page into the Lab.
**UI function:** ACTION.

| Locale | Current | Verdict |
|---|---|---|
| en | `Open Data` | Ambiguous at the source. Title Case, and the only Title-Cased action in a catalog that is otherwise sentence case (`Submit for publication`, `Report null result`, `Face the truth`, `Collect {n} more`). Reads as the open-data **badge** as easily as the **action**. |
| es | `Datos abiertos` | **WRONG-FUNCTION.** Pure noun phrase — the open-data policy concept. The player sees a button labelled with a topic, not an action. |
| it | `Open Data` | **WRONG-FUNCTION.** Untranslated, and the source comment says why: *"'Open Data' is not translated: it is the badge Italian journals themselves print, in English, on Italian papers."* The translator read the EN as the badge noun. That comment is the misdiagnosis, in writing. |

**Fixes:** es `Datos abiertos` → **`Abrir los datos`**; it `Open Data` → **`Apri i dati`**

**Applier note:** `tests/content/it.shape.test.ts` allow-lists `'briefing.openData'` in `SHARED_WITH_EN` ("values that are legitimately identical across locales: notation, tokens, proper nouns, and symbols"). That entry is the bug institutionalised as a test fixture — remove it. `tests/ui/briefing.test.tsx` queries `getByText('Open Data')` against the **English** catalog only; unaffected.

## 3. THE TABLE

Severity: **WRONG-FUNCTION** = noun-as-action or wrong grammatical mood/person. **AWKWARD** = calque, word order, casing, agreement, broken terminology consistency. **FINE-BUT-BETTER** = optional polish. All proposals: 0 em dashes, no token changes, decimal points preserved, tú/tu register preserved, terminology consistent with each corpus.

### 3a. Spanish (es-ES) — 23 rows

| key | locale | UI function | current | proposed replacement | severity | rationale |
|---|---|---|---|---|---|---|
| `briefing.openData` | es | ACTION (primary CTA button) | `Datos abiertos` | `Abrir los datos` | WRONG-FUNCTION | Noun phrase on the app's main button; the action is opening the day's data, not the open-data policy. |
| `published.faceTruth` | es | ACTION (button, Published → Call) | `Enfréntate a la verdad` | `Afrontar la verdad` | WRONG-FUNCTION | tú-imperative where every sibling ES action is an infinitive (`Enviar a publicación`, `Informar de…`, `Compartir`, `Cerrar`); es-ES buttons take the infinitive. Term `la verdad` preserved. |
| `summary.playPrereg` | es | ACTION (button) | `Prueba el modo Preregistro` | `Probar el modo Preregistro` | WRONG-FUNCTION | Same mood defect; a button, not an exhortation. |
| `legend.emojiPeek` | es | LABEL (Legend row) | `Recogió más datos ("solo un lote más")` | `Recogida de más datos ("solo un lote más")` | WRONG-FUNCTION | 3rd-person singular preterite reads "he/she collected". The gloss describes a glyph, not a third party. |
| `legend.emojiAbandon` | es | LABEL (Legend row) | `Informó de un resultado nulo` | `Informe de un resultado nulo` | WRONG-FUNCTION | Same 3rd-person error; nominal gloss matches `legend.emojiSpec`'s own form. |
| `legend.emojiSpec` | es | LABEL (Legend row for 🍴) | `Cualquier cambio de especificación (variable de resultado, covariables o transformación)` | `Cualquier cambio de especificación (variable de resultado, subgrupo, covariables, exclusión de atípicos, transformación o paso a una cola)` | WRONG-FUNCTION | The label under-describes the glyph it defines. `Legend.tsx` deduplicates by glyph, so this is the **only** row explaining subgroup/exclusion/tails changes, and ES names 3 of 6 knobs. Predates T29's EN fix; never carried over. |
| `lab.forkTrailHint` | es | BODY (under the live ForkTrail) | `Cada símbolo es un movimiento que hiciste. La página de Leyenda tiene la clave.` | `Cada símbolo es un movimiento que hiciste. La clave está en la página Leyenda.` | AWKWARD | `La página de Leyenda` calques "the Legend page" (apposition, no `de`); `tiene la clave` calques "has the key". |
| `prereg.commit` | es | LABEL (checkbox, the solemn commitment) | `Me comprometo solemnemente a ejecutar y publicar exactamente esta especificación, muestre lo que muestre.` | `Me comprometo solemnemente a ejecutar exactamente esta especificación y a informar de su resultado, muestre lo que muestre.` | AWKWARD | EN says "running and reporting". A preregistration commits you to **report**, not publish — and `publicar` collides with `lab.submit`'s "Enviar a publicación". IT got this right (`riportare`). |
| `stats.forkHistogramBar` | es | ARIA (histogram bar label) | `{forks} bifurcaciones: {count}` | `Bifurcaciones: {forks}. Partidas: {count}` | AWKWARD | `{forks}` indexes the histogram from 0, so a screen reader reads "1 bifurcaciones". Label-colon-count agrees at every value; `Partidas` reuses `stats.played`'s own word. |
| `reveal.peekSurcharge` | es | BODY (Act II accounting) | `Tus {peeks} vistazos a los datos hacen que el número real de análisis sea unas {mult}× mayor de lo que muestra esta curva.` | `Tus {peeks} vistazos a los datos hacen que el número real de análisis sea aproximadamente {mult}× mayor de lo que muestra esta curva.` | AWKWARD | `unas … mayor` strands a feminine plural determiner on a singular comparative. (`{peeks} = 1` plural break is EN-inherited — §5.) |
| `a11y.shareButton` | es | ARIA (unattached today) | `Copiar al portapapeles el resultado para compartir` | `Copiar el resultado al portapapeles` | AWKWARD | EN word order fronted onto Spanish; read aloud it inverts verb-object-complement. |
| `nav.about` | es | ACTION (header nav button) | `Acerca de` | `Información` | FINE-BUT-BETTER | Bare dangling preposition next to `Estadísticas` / `Leyenda`. `about.title` already completes the phrase where it belongs. IT uses `Informazioni`. |
| `lab.submit` | es | ACTION (button) | `Enviar a publicación` | `Enviar a publicar` | FINE-BUT-BETTER | `enviar a publicar` is the phrasing a Spanish editorial workflow uses. |
| `lab.subgroupUrban` | es | STATE (radio option) | `Urbano` | `Zona urbana` | FINE-BUT-BETTER | Bare masculine adjective with nothing to agree with, beside nominal siblings. Keep `reveal.subgroupUrban` compact and unchanged. |
| `lab.subgroupRural` | es | STATE (radio option) | `Rural` | `Zona rural` | FINE-BUT-BETTER | Same. Keep `reveal.subgroupRural` compact. |
| `briefing.modeChooserIntro` | es | BODY | `El preregistro está desbloqueado. Elige cómo juegas hoy. Un intento por modo.` | `El preregistro está desbloqueado. Elige cómo quieres jugar hoy. Un intento por modo.` | FINE-BUT-BETTER | `elige cómo juegas` (indicative complement) is grammatical but unidiomatic after `elegir`. |
| `reveal.omittedFootnote` | es | BODY (figure footnote) | `{n} especificaciones tenían muy pocos datos para analizarse y no se representan.` | `{n} especificaciones tenían demasiado pocos datos para analizarse y no se representan.` | FINE-BUT-BETTER | EN "too little" is a threshold claim; `muy pocos` is merely a quantity. |
| `summary.breakdownUnderpoweredLuck` | es | LABEL (invoice row) | `Suerte sin potencia` | `Suerte con poca potencia` | FINE-BUT-BETTER | `sin potencia` reads as zero power; the claim is low power. |
| `legend.emojiSubmit` | es | LABEL (Legend row) | `Enviado a publicación` | `Envío a publicación` | FINE-BUT-BETTER | Set consistency: unify the ES Legend on the nominal gloss `legend.emojiSpec` already uses. |
| `legend.emojiPrereg` | es | LABEL (Legend row) | `Preregistrado (prefijo)` | `Preregistro (prefijo)` | FINE-BUT-BETTER | Same unification. |
| `legend.emojiCallCorrect` | es | LABEL (Legend row) | `El veredicto fue correcto` | `Veredicto correcto` | FINE-BUT-BETTER | Same unification; also makes it identical to `summary.breakdownCallCorrect`, the same concept. |
| `legend.emojiCallIncorrect` | es | LABEL (Legend row) | `El veredicto fue erróneo` | `Veredicto erróneo` | FINE-BUT-BETTER | Same. |
| `a11y.localeToggle` | es | ARIA (labels a `role="group"`, App.tsx:172) | `Cambiar de idioma` | `Idioma` | FINE-BUT-BETTER | An ARIA group label must NAME the group; a screen reader announces "Cambiar de idioma, grupo". `nav.localeToggle` already holds exactly `Idioma`. |

### 3b. Italian (it-IT) — 35 rows

| key | locale | UI function | current | proposed replacement | severity | rationale |
|---|---|---|---|---|---|---|
| `briefing.openData` | it | ACTION (primary CTA button) | `Open Data` | `Apri i dati` | WRONG-FUNCTION | English noun phrase on the app's main button; the source comment shows it was read as the journal badge, not the action. |
| `legend.emojiSpec` | it | LABEL (Legend row for 🍴) | `Qualunque cambio di specificazione (esito, covariate o trasformazione)` | `Qualunque cambio di specificazione (esito, sottogruppo, covariate, esclusione degli outlier, trasformazione o passaggio a una coda)` | WRONG-FUNCTION | Same defect as ES: the only row explaining subgroup/exclusion/tails names 3 of 6 knobs. |
| `reveal.nullReported` | it | STATE (verdict stamp) | `NULLO RIPORTATO` | `RISULTATO NULLO` | AWKWARD | EN word order stamped verbatim; as Italian it reads as a fragment with no head noun. ES already uses `RESULTADO NULO`. |
| `summary.streak` | it | STATE (streak strip) | `Serie di {n} giorni` | `Giorni consecutivi: {n}` | AWKWARD | Renders **"Serie di 1 giorni"** on day one for every new Italian player: Summary shows the streak unconditionally and the streak counts today. ES fixed exactly this and documented it; IT inherited the bug. |
| `stats.forkHistogramBar` | it | ARIA (histogram bar label) | `{forks} biforcazioni: {count}` | `Biforcazioni: {forks}. Giocate: {count}` | AWKWARD | `{forks}` starts at 0, so a screen reader reads "1 biforcazioni". `Giocate` reuses `stats.played`. |
| `lab.forkTrailHint` | it | BODY (under the live ForkTrail) | `Ogni simbolo è una mossa che hai fatto. La pagina Legenda ha la chiave.` | `Ogni simbolo è una mossa che hai fatto. Il significato di ciascuno è nella pagina Legenda.` | AWKWARD | `ha la chiave` is a literal calque; in Italian `chiave` is a wrench or a cipher, never a map key (that IS `legenda`). The sentence reads as nonsense. |
| `call.title` | it | HEADING (eyebrow) **and** `aria-label` of the Published overlay (`Published.tsx:310`) | `Prima che ti mostriamo la verità…` | `Prima di vedere la rivelazione…` | AWKWARD | Introduces a first-person-plural "we" the rest of the locale never uses, and names the reveal screen with the fourth of four different Italian names. Also read aloud as a dialog's name. |
| `prereg.intro` | it | BODY | `…Non c'è nessun risultato da sbirciare prima, e oggi non c'è un secondo tentativo.` | `…Non c'è nessuna rivelazione da sbirciare prima, e oggi non c'è un secondo tentativo.` | AWKWARD | Terminology: fixes the reveal screen's Italian name to `la rivelazione`, matching ES's disciplined `la revelación`. |
| `prereg.locked` | it | STATE (`role="status"`) | `Bloccata. Nessuna modifica fino ai risultati.` | `Bloccata. Nessuna modifica fino alla rivelazione.` | AWKWARD | Same terminology fix; `i risultati` is a third name for the same screen. |
| `about.priorArtSpecCurve` | it | BODY (citation) | `…il grafico della schermata finale è, in sostanza, la loro figura.` | `…il grafico della rivelazione è, in sostanza, la loro figura.` | AWKWARD | Same terminology fix; a fourth name. |
| `about.priorArtOptionalStopping` | it | BODY (citation) | `…ogni lotto in più che raccogli ti viene addebitato alla fine.` | `…ogni lotto in più che raccogli ti viene addebitato alla rivelazione.` | AWKWARD | Same terminology fix. |
| `briefing.playHacking` | it | ACTION (button) | `Gioca in Modalità Hacking` | `Gioca in modalità Hacking` | AWKWARD | Stray Title Case: Italian does not capitalise a common noun mid-sentence. Mood (`Gioca`) is correct. |
| `briefing.playPrereg` | it | ACTION (button) | `Gioca in Modalità Prereg` | `Gioca in modalità Prereg` | AWKWARD | Same. |
| `summary.playPrereg` | it | ACTION (button) | `Prova la Modalità Prereg` | `Prova la modalità Prereg` | AWKWARD | Same. |
| `lab.exclusion` | it | HEADING (radiogroup legend) | `Esclusione outlier` | `Esclusione degli outlier` | AWKWARD | Noun-noun juxtaposition is an English construction; Italian needs the preposition. (`outlier` itself correctly kept English.) |
| `lab.explain.outcome` | it | BODY (methods note, `aria-describedby`) | `Quale delle quattro cose che hai misurato questa analisi prova a spiegare.` | `Quale delle quattro cose che hai misurato prova a spiegare questa analisi.` | AWKWARD | English SOV order strands the verb at the end. Italian puts the subject after the verb; ES already does (`intenta explicar este análisis`). |
| `a11y.specCurveChart` | it | ARIA (`role="img"` on Fig. 1) | `Grafico del p-value di ogni specificazione possibile, ordinato, con evidenziata la specificazione che hai pubblicato.` | `Grafico dei p-value di tutte le specificazioni possibili, ordinate, con evidenziata quella che hai pubblicato.` | AWKWARD | `ordinato` agrees with `Grafico`, so it says the *chart* is sorted; EN says the *specifications* are. Also repeats `specificazione` twice in one breath. |
| `errors.workerCrash` | it | BODY (error banner) | `Qualcosa è andato storto mentre generavamo il rompicapo di oggi. Di solito basta ricaricare la pagina.` | `Qualcosa è andato storto durante la generazione del rompicapo di oggi. Di solito basta ricaricare la pagina.` | AWKWARD | Same unwanted first-person-plural "we" as `call.title`; EN and ES are impersonal. |
| `lab.howThisWorks.step1` | it | INSTRUCTION (numbered step) | `Leggi il brief: la domanda di oggi e i dati che ti hanno consegnato.` | `Leggi la scheda: la domanda di oggi e i dati che ti hanno consegnato.` | FINE-BUT-BETTER | `il brief` is an anglicism outside this locale's own declared allowlist ("Open Data", "Reviewer 2", "outlier", "p-value", "log"). |
| `stats.callAccuracy` | it | STATE (stat label; value renders as `67%`) | `Verdetti giusti` | `Precisione dei verdetti` | FINE-BUT-BETTER | Labels a count but carries a rate. ES's `Acierto en los veredictos` reads as a rate. |
| `stats.successRateTitle` | it | HEADING | `Tasso di successo: hacking contro preregistrazione` | `Tasso di successo: hacking vs. preregistrazione` | FINE-BUT-BETTER | `contro` is combative; the comparison is neutral. ES uses `frente a`. |
| `stats.preregModeLabel` | it | STATE (panel label) | `Modalità Prereg` | `Modalità Preregistrazione` | FINE-BUT-BETTER | Terminology: the locale says `preregistrazione` in `prereg.title`, `summary.preregUpsell`, `briefing.modeChooserIntro`, `stats.successRateTitle`, but `Prereg` in three mode-name keys. Pick one (ES uses `Preregistro` throughout). If `Prereg` is kept as the product name, apply it in all five places instead. |
| `summary.nextIn` | it | STATE (countdown) | `Prossimo rompicapo tra {hours}h {minutes}m` | `Prossimo rompicapo tra {hours} h {minutes} min` | FINE-BUT-BETTER | Italian sets a space before a unit symbol, and `min` is the SI symbol. ES already does this. |
| `about.mechanism` | it | BODY | `…un trattamento confuso con età e reddito…` | `…un trattamento con confondimento da età e reddito…` | FINE-BUT-BETTER | False friend: `confuso` reads as "muddled/embarrassed". The Italian methodological term is `confondimento`. |
| `legend.emojiPeek` | it | LABEL (Legend row) | `Raccolti altri dati ("solo un altro lotto")` | `Raccolta di altri dati ("solo un altro lotto")` | FINE-BUT-BETTER | Set consistency: unify the IT Legend on the nominal gloss `legend.emojiSpec` uses. |
| `legend.emojiSubmit` | it | LABEL (Legend row) | `Inviato per la pubblicazione` | `Invio per la pubblicazione` | FINE-BUT-BETTER | Same unification. |
| `legend.emojiAbandon` | it | LABEL (Legend row) | `Riportato un risultato nullo` | `Segnalazione di un risultato nullo` | FINE-BUT-BETTER | Same unification; the current form is a bare participle with a dangling object. |
| `legend.emojiPrereg` | it | LABEL (Legend row) | `Preregistrato (prefisso)` | `Preregistrazione (prefisso)` | FINE-BUT-BETTER | Same unification. |
| `a11y.shareButton` | it | ARIA (unattached today) | `Copia negli appunti il risultato da condividere` | `Copia il risultato negli appunti` | FINE-BUT-BETTER | English word order; trailing `da condividere` is redundant once the verb is `copia`. |
| `a11y.localeToggle` | it | ARIA (labels a `role="group"`) | `Cambia lingua` | `Lingua` | FINE-BUT-BETTER | Group labels name, they do not command. `nav.localeToggle` already holds `Lingua`. |
| `a11y.closeDialog` | it | ARIA (close button) | `Chiudi la finestra` | `Chiudi la finestra di dialogo` | FINE-BUT-BETTER | The target is a dialog, not a window. Still contains the visible label `Chiudi`, so WCAG 2.5.3 stays satisfied. |
| `lab.subgroupUrban` | it | STATE (radio option) | `Urbano` | `Area urbana` | FINE-BUT-BETTER | Bare adjective with nothing to agree with. Keep `reveal.subgroupUrban` compact and unchanged. |
| `lab.subgroupRural` | it | STATE (radio option) | `Rurale` | `Area rurale` | FINE-BUT-BETTER | Same. Keep `reveal.subgroupRural` compact. |
| `reveal.peekSurcharge` | it | BODY (Act II accounting) | `Le tue {peeks} sbirciate ai dati rendono…` | `Le tue sbirciate ai dati ({peeks}) rendono…` | FINE-BUT-BETTER | Renders "Le tue 1 sbirciate" when `peeks === 1`. Parenthesising the count makes it agree at every value. EN-inherited (§5). |
| `summary.breakdownUnderpoweredLuck` | it | LABEL (invoice row) | `Fortuna sottopotenziata` | `Colpo di fortuna sottopotenziato` | FINE-BUT-BETTER | Luck is not underpowered; the study is. EN compresses the same way, so this is optional. |

Note: `stats.hackModeLabel` (`Modalità Hacking`) is **correct as-is** — sentence-initial in its own element. Listed here only so the applier does not "fix" it.

### 3c. Italian corpus labels — achievement names (9 rows)

Bank strings that render as **labels** (`Stats.tsx:133`, inside `<strong className="ph-stats__ach-name">`), so in scope. Every one is English Title Case. Italian capitalises only the first word and proper nouns — including in titles, which is why the canonical Italian Borges title is *Il giardino dei sentieri che si biforcano*. Spanish got this right across all twelve.

| id | locale | UI function | current | proposed replacement | severity | rationale |
|---|---|---|---|---|---|---|
| `first_blood` | it | LABEL (achievement wall) | `Prima Firma` | `Prima firma` | AWKWARD | Title Case calque. |
| `first_retraction` | it | LABEL | `Primo Ritiro` | `Primo ritiro` | AWKWARD | Title Case calque. |
| `one_tailed_bandit` | it | LABEL | `Il Bandito a Una Coda` | `Il bandito a una coda` | AWKWARD | Title Case calque. |
| `outlier_surgeon` | it | LABEL | `Chirurgo degli Outlier` | `Chirurgo degli outlier` | AWKWARD | Title Case calque (`outlier` correctly kept English, but lowercase). |
| `subgroup_safari` | it | LABEL | `Safari tra i Sottogruppi` | `Safari tra i sottogruppi` | AWKWARD | Title Case calque. |
| `one_more_batch` | it | LABEL | `Solo un Altro Lotto` | `Solo un altro lotto` | AWKWARD | Title Case calque. |
| `garden` | it | LABEL | `Il Giardino dei Sentieri che si Biforcano` | `Il giardino dei sentieri che si biforcano` | AWKWARD | Title Case calque; the proposal is the canonical Italian Borges title and matches the locale's own `glossary` entry and `nav.tagline`. |
| `monk` | it | LABEL | `Il Monaco` | `Il monaco` | AWKWARD | Title Case calque. |
| `well_actually` | it | LABEL | `Beh, In Realtà` | `Beh, in realtà` | AWKWARD | Title Case calque. |

`harking` (`HARKing`) and `true_detective` (`True Detective`) are correct as-is: an acronym and a proper title.

## 4. Convention contracts

Paste into the head of each locale's `copy.ts`.

### 4a. es-ES

1. **ACTIONS take the infinitive.** Every button, link and menu command: `Abrir los datos`, `Enviar a publicar`, `Compartir`, `Cerrar`, `Afrontar la verdad`. Never a noun phrase, never a tú-imperative — even when the English reads as one.
2. **The tú-imperative is for INSTRUCTIONS, not controls.** Numbered how-to steps, the goal strip and prose telling the player what to do keep `Lee…`, `Ajusta…`, `Envía…`, `Enfréntate…`. A button and a step may share the same *term* (`la verdad`) without sharing the same *mood*.
3. **Register is tú throughout the chrome**, matching the corpus. Never `usted`, never impersonal `se` where the player is the subject.
4. **Sentence case everywhere.** Only proper nouns, product mode names (`modo Preregistro`), stamps (`RETRACTADO`, `PRENSA SIMULADA`) and acronyms take capitals. No English Title Case, ever.
5. **STATE labels are nominal or participial**, not clauses: `Copiado al portapapeles`, `Veredicto correcto`, `Ya has jugado hoy`. Legend glosses are **nominal**: `Envío a publicación`, `Informe de un resultado nulo` — never third-person preterite, which invents a subject.
6. **Terminology is fixed and must not drift.** The reveal screen is *la revelación*. Paths are *senderos*; forks are *bifurcaciones*; a spec is *una especificación*; the call is *el veredicto*. `la verdad` is reserved for `published.faceTruth` and `lab.howThisWorks.step4`, which are the same beat.
7. **Count-bearing labels must agree at n = 1.** Prefer `Etiqueta: {n}` over `{n} sustantivos`. `summary.streak` is the worked example.
8. **Notation is not prose.** Decimal point always (`p = 0.049`, `|z| > 2.5`, `α = .05`); `gl` for degrees of freedom; no thousands separators.
9. **Em-dash budget: 0.** `stats.noData`'s `—` is the locale's only U+2014 and is a "no data" mark, not punctuation.
10. **ARIA strings must sound like speech, not documentation.** A group label names the group (`Idioma`); a button label commands (`Cerrar diálogo`); a figure description is one spoken sentence.

### 4b. it-IT

1. **ACTIONS take the second-person imperative.** `Apri i dati`, `Invia per la pubblicazione`, `Condividi`, `Chiudi`, `Guarda in faccia la verità`. This is the Apple/Google Italian convention and the locale already follows it everywhere except `briefing.openData`. The infinitive is acceptable **only** for a menu-category label; a noun phrase never is.
2. **Register is tu throughout the chrome**, matching the corpus. Never `Lei`. And never the editorial "noi": the app does not say *"mentre generavamo"* or *"prima che ti mostriamo"* — it is impersonal about itself.
3. **Sentence case everywhere.** `modalità Hacking`, not `Modalità Hacking`. Achievement names, glossary terms and headings capitalise the first word and proper nouns only — including titles (*Il giardino dei sentieri che si biforcano*). English Title Case is the single most visible calque in this locale.
4. **STATE labels are nominal or participial**, never English fragments: `RISULTATO NULLO`, `Copiato negli appunti`, `Già giocato oggi`. Legend glosses are **nominal**: `Invio per la pubblicazione`, `Raccolta di altri dati`.
5. **No noun-noun juxtaposition.** Italian needs the preposition: `Esclusione degli outlier`. (`punti carriera` is the sanctioned exception — it is what Italian academia actually says.)
6. **No verb-final English word order.** Put the subject after the verb rather than stranding the verb at the end of a relative clause.
7. **Terminology is fixed and must not drift.** The reveal screen is *la rivelazione* — never *la verità*, *i risultati*, *la schermata finale* or *alla fine*. Paths are *sentieri*; forks are *biforcazioni*; the call is *il verdetto*; the mode is one of `Prereg` or `Preregistrazione`, consistently.
8. **English is borrowed only from the declared allowlist**: `Open Data` (as a journal badge in prose — **not** as a button), `Reviewer 2`, `outlier`, `p-value`, `df`, `log`. `brief` is not on it.
9. **Count-bearing labels must agree at n = 1.** `Giorni consecutivi: {n}`, not `Serie di {n} giorni`. Check every `{n}`/`{k}`/`{forks}`/`{peeks}` against its real floor before assuming a plural is safe.
10. **Notation is not prose.** Decimal point always; `{hours} h {minutes} min` with spaces; no Italian comma-decimal anywhere.
11. **Em-dash budget: 0.** `stats.noData`'s `—` is the only permitted U+2014. Italian reaches for the *lineetta* more readily than English; the point of writing natively is that it does not have to.
12. **ARIA strings must sound like speech.** Read each one aloud: a screen-reader user should hear something an Italian app says daily, not a spec sentence.

## 5. EN-comment hardening recommendations

Recommendation only; no EN change is in scope for the applier unless the owner asks.

1. **`briefing.openData: 'Open Data'` — change the value, not just the comment.** Recommend **`'Open the data'`**. It is the only Title-Cased action in an otherwise sentence-case catalog, and homographic with the open-data policy noun. Both translators read it as the noun. Whether or not the value changes, add: *"ACTION. This is the Briefing screen's primary CTA (`Briefing.tsx`). Translate as a verb in each locale's button mood — es infinitive, it imperative — never as the 'open data' badge noun, and never leave it in English."*
2. **`legend.emojiPeek` / `emojiSubmit` / `emojiAbandon` / `emojiPrereg`** — bare English past participles with no subject. Spanish read two as third-person preterite ("he/she collected"). Add: *"LEGEND GLOSSES. Impersonal — they describe what a glyph MEANS, in a share string that may be someone else's. Translate nominally; never with a finite verb, and never in the second person."*
3. **Plural safety across count-bearing keys.** `published.altmetricScore` already carries the right warning; four sibling keys do not, and **English itself is wrong at 1** in all of them: `reveal.peekSurcharge` ("Your 1 data-peeks" — `Reveal.tsx` renders it whenever `peeks !== 0`), `reveal.accounting2` / `accounting2Abandoned` / `accounting3` ("You explored 1 paths" — `playerExplored` is `explored.length`, and submitting the default spec gives 1), `stats.forkHistogramBar` ("1 forks", histogram indexed from 0), `summary.streak` ("1 day streak" — EN survives as an attributive; Italian does not). `share.forksWord` has the same exposure in the share string. Add a standing note naming the real floor of every counting token.
4. **`a11y.localeToggle: 'Change language'`** — it labels a `role="group"` (`App.tsx:172`), not a button. Recommend the value become **`'Language'`** and the comment say *"names a group; not an action."*
5. **`lab.exclusion: 'Outlier exclusion'`** — an English noun-noun compound; both locales calqued it. Add: *"Name the control in the target language's own grammar; Romance languages need a preposition here."*
6. **`lab.forkTrailHint: '…The Legend page has the key.'`** — "has the key" is an English idiom, and "key" for a chart legend has no cognate in either target. Both locales calqued it literally; the Italian result is close to meaningless. Add: *"'key' here means 'the explanation of the symbols' — do not translate the noun literally."*
7. **`published.faceTruth` vs `lab.howThisWorks.step4`** — the EN comment instructs translators to reuse the wording verbatim. Right about the TERM, wrong about the MOOD: the first is a button, the second a numbered instruction, and Spanish buttons take the infinitive. Reword to *"same beat, same NOUN; each locale sets the mood its own UI conventions require."*
8. **`summary.share: 'Share'` and `stats.close: 'Close'`** — noun/verb and adjective/verb homographs. Both locales got them right, but the comment should say ACTION so a future locale cannot guess wrong.
9. **`call.real: 'A real effect'` / `call.noise: 'Noise I dressed up'`** — these sit on `<button>`s but are CLAIMS the player selects, not actions. Add: *"option titles, not commands — never verbify."*
10. **`nav.themePaper` / `nav.themeDark`** — they label a single toggle with the CURRENT theme (`App.tsx:153`). Add: *"STATE, not action: the button shows the theme you are in."*
11. **`nav.legend: 'Legend'`** — renders both as a header nav page name and as the ForkTrail popover's trigger button (`ForkTrail.tsx:156`). Add: *"must read as a page NAME in both places."*

## 6. Notes for whoever applies this

* **Nothing here needs a code change.** Every fix is a string value in `src/content/es/copy.ts`, `src/content/it/copy.ts`, or (for §3c) `src/content/it/index.ts`'s `achievements` block.
* **One test fixture must move with the code:** remove `'briefing.openData'` from `SHARED_WITH_EN` in `tests/content/it.shape.test.ts` (§2).
* **Tests constraining these values, all still satisfied by the proposals:** token-set parity and no-repeated-token (`it.shape`/`es.shape`), decimal-point and no-comma-decimal (`it.shape`), the ≤1-em-dash rule and the ≥2500 chars-per-dash density floor (proposals add zero em dashes), "IT dashes ≤ EN dashes", and `copyFreeze.test.ts` (no key added or removed).
* **Two proposals deliberately keep an English word**: `Prereg` (if the owner prefers it as a product name) and `outlier`. Both are already sanctioned by the IT locale header.
* **Inherited EN defects left alone on purpose** (flagged in §5 instead, so the locales do not diverge from the source): the `+Income` / `+Renta` / `+Reddito` recipe token vs. the scenario's own `Salary band` / `Banda salarial` / `Fascia stipendiale` covariate label, and the `{k}`-at-1 plural in `reveal.accounting2`/`accounting3`.

## 7. Controller rulings (appended at persistence)

- **IT mode name:** `Preregistrazione` consistently (the locale already majority-uses it); apply the §3b `stats.preregModeLabel` proposal and align the three `modalità Prereg` keys to `modalità Preregistrazione` — unless length breaks a layout, in which case keep `Prereg` in ALL five and say so.
- **EN §5.1 ADOPTED as a value change:** `briefing.openData` EN → `Open the data`, plus the comment. §5.3 EN plural-safety: the four EN-wrong-at-1 keys are REAL EN DEFECTS — fix EN values too (label-colon-count or parenthesised-count forms), propagating to IT/ES consistently. §5.4 adopted (`Language`/`Lingua`/`Idioma` ×3). All other §5 items: comments only.
- **Note:** `legend.emojiSpec` six-knob fixes (§3a/§3b rows) were ALREADY applied by T33 (pending merge) — applier must verify against the post-T33 tree and skip if identical intent (keep T33's wording if it matches the six-knob requirement).
