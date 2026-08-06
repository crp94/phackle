# T39b — the 24 scenario-bound press blurbs, in Italian and Spanish

**Branch:** `task-t39b` (from `0d0e0ee`, the T39a merge). Not pushed.

**What shipped**

1. All 24 T39a scenario-bound blurbs transcreated into Italian and into Spanish
   (48 strings), each built on **that locale's own** scenario furniture rather
   than translated off the English one.
2. Two real per-locale press-spoiler lexicons (`IT_PRESS_SPOILER_LEXICON`,
   `ES_PRESS_SPOILER_LEXICON`) replacing the English aliases
   `*_PENDING_T39B`, with their exclusions documented and asserted.
3. The declared transcreation debt cleared in both locales: `PENDING_T39B_PRESS`
   is gone, and the tracker has become the permanent assertion it was designed
   to become (`aliased` must equal `[]`, forever).
4. Optional small: the re-review's **reachability nit** is now a test —
   `walks the whole bank across a season of dates: the rotation strands no
   blurb` in `tests/game/published.test.ts`.

**Fix round 1 (review: APPROVED with 8 Minors, all taken under the
perfect-over-fast rule)**

| # | fix | where |
|---|---|---|
| 1 | press[20] rebuilt on a working pun and each scenario's own noun (ES takes the proposal, **IT beats it** on a direction argument) | `src/content/{it,es}/index.ts` |
| 2 | press[8] both locales: cut the cover story's recycled grudge clause, punchline told once | `src/content/{it,es}/index.ts` |
| 3 | press[10] ES: "de explicarlo todo" → "de una sesión informativa completa" | `src/content/es/index.ts` |
| 4 | press[39] IT: "È ENTRATO" → "ENTRA" (the block's own present-tense rule) | `src/content/it/index.ts` |
| 5 | ES lexicon + `se ha sostenido`, `se sostenía`, with a positive case each | `tests/content/es.shape.test.ts` |
| 6 | IT 13-detector widened to `il/del/al/numero 13` and `tredici`, with a guards-the-guard test | `tests/content/it.shape.test.ts` |
| 7 | three report corrections, marked in place as amendments 7a/7b/7c | this file |
| — | new: the "baja" boundary pinned as a test rather than an argument | `tests/content/es.shape.test.ts` |

**Gate (exit codes taken before any pipe; after fix round 1)**

| gate | command | exit |
|---|---|---|
| typecheck | `npx tsc --noEmit` | **0** |
| lint | `npx eslint .` | **0** |
| tests (content) | `npx vitest run tests/content` | **0** — **349** passed (276 at HEAD → 344 round 1 → 349 now) |
| tests (all but the known flake) | `npx vitest run --exclude tests/engine/dgp.test.ts` | **0** — **1464** passed, 50 files |
| tests (the flake, isolated) | `npx vitest run tests/engine/dgp.test.ts` | **0** — 24 passed |
| build | `npm run build` | **0** |

The whole-suite run is the known `tests/engine/dgp.test.ts` flake: *"experience
is always 0, 1, or 2 … Test timed out in 5000ms"*, a 5s timeout on a 200-seed
loop under full parallel load, in a file this task does not touch. Isolated, it
passes 24/24 in 11.6s. Reported honestly rather than folded into a green
headline: **1482/1483 in one shot, 1483/1483 across the two isolated runs.**

---

## 1. The 48 items, with their English source

Format: index, tier, bound scenario; then EN / IT / ES with each locale's own
outlet.

### Tier 1 — the prestige outlet has read the abstract and reported the method

#### press[6] — sock-folding-punctuality

- **EN** (Public Record Weekly): Two coders scored the sock photographs separately and agreed almost every time. The authors call the agreement reassuring.
- **IT** (Il Bollettino Civico): Due codificatori hanno classificato le fotografie dei calzini separatamente e si sono trovati d'accordo quasi sempre. Gli autori definiscono l'intesa rassicurante.
- **ES** (El Boletín Oficioso): Dos personas codificaron las fotografías de los calcetines por separado y coincidieron casi siempre. Los autores califican la coincidencia de tranquilizadora.

*ES follows its own cover story, which says "Dos personas codifican" where
English says "two coders" — the Spanish scenario never invented a job title.*

#### press[7] — stairs-small-talk

- **EN** (The Weekly Ledger): Twelve storeys of badge data and a rapport survey. Participants were told about the survey, and about the badges at the debrief.
- **IT** (La Gazzetta di Provincia): Dodici piani di dati dei badge e un questionario di sintonia. Ai partecipanti è stato detto del questionario; dei badge, al debriefing.
- **ES** (El Balance Semanal): Doce plantas de datos de fichaje y una encuesta de compenetración. A los participantes se les habló de la encuesta; de las tarjetas, en la sesión informativa final.

*Both locales replace the English em dash rhythm with a semicolon and an
elliptical second clause — the joke's timing survives, the dash budget is
untouched. ES uses `fichaje`/`sesión informativa final`, the words its own
method section uses.*

#### press[8] — cafe-peer-review

- **EN** (Public Record Weekly): Severity was scored by former editors, every one of whom has been reviewed in a café. The authors present this as domain expertise.
- **IT** (Il Bollettino Civico): La severità è stata valutata da un collegio di ex direttori, ognuno dei quali è stato recensito al bar. Gli autori lo presentano come competenza specifica.
- **ES** (El Boletín Oficioso): La severidad la puntuó un panel de exeditores, todos ellos revisados alguna vez desde una cafetería. Los autores lo presentan como conocimiento del terreno.

*IT's café is `il bar`, because that is where an Italian referee sits.*

> **Fix round 1 [Minor 2].** Both locales originally carried the cover story's
> grudge clause ("e non se l'è dimenticato" / "y ninguno lo ha olvidado") **and**
> the domain-expertise line on top of it, which tells the same joke twice; the
> English blurb trades one for the other and is funnier for it. The recycled
> clause is cut in both locales. It still exists where it was written, in the
> cover story the player reads first.

#### press[9] — terms-and-conditions-service

- **EN** (The Sunday Supplement): The hardest part was recruitment: first find the people who read the agreement, then ask them to read the consent form.
- **IT** (L'Inserto della Domenica): La parte più difficile è stata il reclutamento: prima trovare chi legge il contratto per intero, poi chiedergli di leggere anche il modulo di consenso.
- **ES** (El Suplemento Dominical): Lo más difícil fue el reclutamiento: primero localizar a quien se lee el contrato entero y después pedirle que se lea también el consentimiento informado.

#### press[10] — telescope-directions

- **EN** (The Weekly Ledger): The question about the telescope came last, after the directions and a full debrief. Telescope owners, the authors record, were delighted to be asked.
- **IT** (La Gazzetta di Provincia): La domanda sul telescopio arrivava per ultima, dopo le indicazioni e un debriefing completo. Chi ha un telescopio, annotano gli autori, era felicissimo che glielo si chiedesse.
- **ES** (El Balance Semanal): La pregunta por el telescopio se dejaba para el final, después de las indicaciones y de una sesión informativa completa. Quienes tienen telescopio, anotan los autores, estaban encantados de que se lo preguntaran.

*Both echo the delight verbatim from their own cover stories ("è felicissimo
che glielo si chieda" / "están encantados de que se lo pregunten").*

> **Fix round 1 [Minor 3].** ES said "y de explicarlo todo", which is vague
> exactly where the joke wants the ethics-board register: the whole point is
> that the debrief is a formal procedure and the telescope question is smuggled
> in after it. "Una sesión informativa completa" is this locale's own term for
> the debrief, and press[7] already uses it, so the two tier-1 blurbs now speak
> the same methods vocabulary.

#### press[11] — full-moon-meetings

- **EN** (Public Record Weekly): Eighteen months of calendar records joined to a lunar ephemeris. The hypothesis came from the calendar administrator, proudly credited.
- **IT** (Il Bollettino Civico): Diciotto mesi di registri di calendario uniti a un'effemeride lunare. L'ipotesi è dell'addetta al calendario, che gli autori citano con orgoglio.
- **ES** (El Boletín Oficioso): Dieciocho meses de registros de calendario cruzados con una efeméride lunar. La hipótesis la propuso quien administra el calendario, a quien los autores citan con orgullo.

*The Italian scenario made the calendar administrator a woman (`l'addetta`); the
press follows her. Spanish had chosen the gender-neutral `quien administra el
calendario`, and the press follows that instead.*

#### press[12] — jigsaw-suitcase-packing

- **EN** (The Sunday Supplement): Jigsaw solvers had their suitcases measured at a departure gate, on a folding table. Nobody there, the authors note, had anywhere else to be.
- **IT** (L'Inserto della Domenica): Le valigie di chi fa i puzzle sono state misurate a un gate di partenza, su un tavolino pieghevole. Lì, osservano gli autori, nessuno aveva altro da fare.
- **ES** (El Suplemento Dominical): Las maletas de quienes hacen puzles se midieron en una puerta de embarque, sobre una mesa plegable. Allí, observan los autores, nadie tenía otro sitio donde estar.

### Tier 2 — the midmarket outlet has made it about the reader (tu / tú)

#### press[20] — sourdough-marathon

- **EN** (Clickwell): What your starter says about your finish line. The flour co-op is still sending people, and we asked them why.
- **IT** (Clickeria): A lievitare non è solo il pane: c'è anche il tuo primato personale. Il molino cooperativo continua a mandare gente allo studio, e noi siamo andati a chiedere perché.
- **ES** (Clicbienestar): Tu masa madre sube; tu marca, baja. La cooperativa harinera sigue mandando gente al estudio, y hemos ido a preguntarles por qué.

> **Fix round 1 [Minor 1], the biggest of the eight.** The first round rendered
> EN's starter/finish-line pun as "il tuo tempo finale" / "tu tiempo final":
> punless, and off each scenario's OWN vocabulary (their outcomes are the
> *guadagno sul primato personale* and the *mejora sobre la marca personal*).
> Both are rebuilt on a verb that means two things at once.
>
> **ES** takes the reviewer's line as proposed: `Tu masa madre sube; tu marca,
> baja.` Two verbs, opposite directions, both correct — the starter rises, the
> mark drops, and a dropping *marca* is precisely the good news this paper
> sells. Uses the scenario's own noun.
>
> **IT beats the proposal rather than taking it, for a direction reason.** The
> proposed line was "Quanto lievita il tuo tempo in maratona." `lievitare` is
> the right pun (dough rises; a quantity balloons) but applied to a TIME it
> means the time BALLOONED, i.e. the runner got *slower* — the opposite of what
> this paper claims, in a tier where the outlet is credulous about the paper.
> Pointing the same verb at the *primato* keeps the pun and the scenario's own
> noun while making the rise the good news: **"A lievitare non è solo il pane:
> c'è anche il tuo primato personale."** Reasoning recorded next to the string.

#### press[21] — cold-shower-emails

- **EN** (The Daily Scroll): Your shower temperature is in your outbox. Six weeks of sent mail were scored, and 'per my last email' flagged itself.
- **IT** (Lo Scroll Quotidiano): La temperatura della tua doccia è nella tua posta in uscita. Sei settimane di email inviate sono state analizzate, e "come da mia precedente email" si è segnalata da sola.
- **ES** (El Scroll Diario): La temperatura de tu ducha está en tu bandeja de salida. Se analizaron seis semanas de correo enviado, y "como ya indiqué en mi anterior correo" se marcó sola.

*Each locale quotes the exact passive-aggressive formula its own scenario
already flags automatically, so the reflexive joke ("si è segnalata da sola" /
"se marcó sola") lands on a phrase the player met in the briefing.*

#### press[22] — horoscope-parking

- **EN** (Buzz & Broadsheet): Is your star sign finding the space? The logger runs from street entry to engine off, so your worst circuit of the block is in the dataset.
- **IT** (Clamore & Lenzuolo): È il tuo segno a trovarti il posto? Il registratore parte dall'ingresso in strada e si ferma allo spegnimento del motore, quindi anche il tuo giro peggiore dell'isolato finisce nei dati.
- **ES** (Ruido & Rotativa): ¿Te está buscando sitio tu signo? El registrador empieza cuando entras en la calle y para cuando apagas el motor, así que tu peor vuelta a la manzana también está en los datos.

#### press[23] — label-maker-inbox

- **EN** (Clickwell): They asked one screening question: do you own a label maker? What happened to those inboxes is now peer-reviewed.
- **IT** (Clickeria): Una sola domanda di selezione: possiedi un'etichettatrice? Quello che è successo dopo a quelle caselle di posta è ora su una rivista con revisione tra pari.
- **ES** (Clicbienestar): Una sola pregunta de cribado: ¿tienes etiquetadora? Lo que pasó después en esas bandejas de entrada ya está en una revista con revisión por pares.

*The screening question is asked in the second person, so the tier-2 reader-hook
and the method quotation are the same clause.*

#### press[24] — browser-tabs-side-projects

- **EN** (The Daily Scroll): Forty tabs open is not a problem, say researchers who now call it inventory. Every project had to come with a public link.
- **IT** (Lo Scroll Quotidiano): Quaranta schede aperte non sono un problema: i ricercatori adesso le chiamano magazzino. Ogni progetto doveva arrivare con un link pubblico funzionante, il tuo compreso.
- **ES** (El Scroll Diario): Cuarenta pestañas abiertas no son un problema: los investigadores ahora lo llaman inventario. Cada proyecto tenía que llegar con un enlace público que funcionara, el tuyo incluido.

*"il tuo compreso" / "el tuyo incluido" is the tier-2 hook the English sentence
never had; the English one had already spent its hook on "not a problem".*

#### press[25] — vinyl-dinner-party

- **EN** (Buzz & Broadsheet): There was a researcher at that dinner party, introduced as a colleague from work. Your departure time is now data.
- **IT** (Clamore & Lenzuolo): A quella cena c'era un ricercatore, presentato agli altri come un collega di lavoro. L'ora in cui te ne sei andato adesso è un dato.
- **ES** (Ruido & Rotativa): En aquella cena había un investigador, presentado a los demás como un compañero del trabajo. La hora a la que te fuiste ya es un dato.

#### press[26] — jazz-spreadsheets

- **EN** (Clickwell): The analysts were told the study was about lighting. It was about the 340 hours of hard bop in their headphones, and about what is in yours.
- **IT** (Clickeria): Agli analisti avevano detto che lo studio riguardava l'illuminazione. Riguardava le 340 ore di hard bop nelle loro cuffie, e quello che c'è nelle tue.
- **ES** (Clicbienestar): A los analistas les dijeron que el estudio iba sobre la iluminación. Iba sobre las 340 horas de hard bop de sus auriculares, y sobre lo que suena en los tuyos.

#### press[27] — thirteen-mortgage — **the locale divergence**

- **EN** (Buzz & Broadsheet): What your feelings about the number 13 say about your mortgage. The broker who supplied the terms sends regards.
- **IT** (Clamore & Lenzuolo): Che cosa dice del tuo mutuo il tuo punteggio di eptacaidecafobia. Il broker che ha passato le condizioni allo studio manda i suoi saluti.
- **ES** (Ruido & Rotativa): Lo que tu puntuación de triscaidecafobia dice de tu hipoteca. El intermediario que le pasó las condiciones al estudio manda recuerdos.

*The Italian scenario relocated the superstition to **17** and coined
`eptacaidecafobia`; the Italian blurb therefore names the score, not the number,
and never says 13. Spanish kept 13 (`martes 13` is real to its readers) under
its own coinage `triscaidecafobia`. Both greet the reader with the broker's
regards, in each locale's own idiom (`manda i suoi saluti` / `manda recuerdos`).
`it.shape.test.ts` asserts mechanically that the Italian bank contains
`eptacaidecafobia` and no `numero 13`.*

#### press[28] — mechanical-keyboard-bugs

- **EN** (The Daily Scroll): Two participants switched to something quieter and had to be dropped. Everyone else is still typing loudly for science, and so, probably, are you.
- **IT** (Lo Scroll Quotidiano): Due partecipanti sono passati a qualcosa di più silenzioso e sono stati esclusi. Tutti gli altri battono ancora forte per la scienza, e probabilmente anche tu.
- **ES** (El Scroll Diario): Dos participantes se pasaron a algo más silencioso y hubo que descartarlos. Los demás siguen tecleando fuerte por la ciencia, y tú probablemente también.

### Tier 3 — the chyron (sottopancia / rótulo)

#### press[37] — standing-desk-poetry

- **EN** (Nightly Chyron Network): STUDY: DESK GOES UP, SONNET COMES OUT
- **IT** (Rete Sottopancia): STUDIO: SALE LA SCRIVANIA, ESCE L'ENDECASILLABO
- **ES** (Cadena Rótulo 24H): ESTUDIO: SUBE EL ESCRITORIO, SALE EL ENDECASÍLABO

*Neither locale's cover story mentions a sonnet: both promise the
hendecasyllable (IT `endecasillabo`, ES `endecasílabo`), which is the line
Italian and Spanish verse is actually built on. The chyron says what its own
abstract said.*

#### press[38] — dog-economist-stocks

- **EN** (Channel 9 Nightly): IS YOUR DOG'S NAME A PORTFOLIO STRATEGY? WE ASKED A DOG CALLED HAYEK
- **IT** (TG Canale 9): IL NOME DEL TUO CANE È UNA STRATEGIA DI PORTAFOGLIO? LO ABBIAMO CHIESTO A UN CANE DI NOME HAYEK
- **ES** (Canal 9 Noticias Noche): ¿EL NOMBRE DE TU PERRO ES UNA ESTRATEGIA DE CARTERA? SE LO HEMOS PREGUNTADO A UN PERRO LLAMADO HAYEK

#### press[39] — cat-crypto

- **EN** (Nightly Chyron Network): ALERT: THE CAT HAS JOINED THE INVESTMENT COMMITTEE
- **IT** (Rete Sottopancia): ALLARME: IL GATTO ENTRA NEL COMITATO INVESTIMENTI
- **ES** (Cadena Rótulo 24H): ALERTA: EL GATO ENTRA EN EL COMITÉ DE INVERSIONES

> **Fix round 1 [Minor 4].** IT read "È ENTRATO", against the present-tense rule
> this very block's comment states, and against its own Spanish twin, which
> already read ENTRA. A chyron reports the thing as it happens.

#### press[40] — full-moon-meetings

- **EN** (Nightside Live): THE MOON IS FULL AND YOUR FOUR O'CLOCK IS NOT OVER
- **IT** (Diretta Notte): LA LUNA È PIENA E LA TUA RIUNIONE DELLE QUATTRO NON È ANCORA FINITA
- **ES** (Directo Madrugada): HAY LUNA LLENA Y TU REUNIÓN DE LAS CUATRO NO HA TERMINADO

#### press[41] — cafe-peer-review

- **EN** (Channel 9 Nightly): EXCLUSIVE: THE HARSHEST REVIEW OF YOUR LIFE WAS WRITTEN NEXT TO A PASTRY
- **IT** (TG Canale 9): ESCLUSIVO: IL REFERAGGIO PIÙ DURO DELLA TUA VITA È STATO SCRITTO ACCANTO A UN CORNETTO
- **ES** (Canal 9 Noticias Noche): EXCLUSIVA: EL INFORME MÁS DURO DE TU VIDA SE ESCRIBIÓ AL LADO DE UNA NAPOLITANA DE CHOCOLATE

*"A pastry" is the one word in the English bank that is deliberately
unspecified. Named, it gets funnier and more local: the Italian referee is at
the bar with a **cornetto**, the Spanish one in the cafetería with a
**napolitana de chocolate**.*

#### press[42] — sock-folding-punctuality

- **EN** (Channel 9 Nightly): THE SOCK DRAWER KNOWS WHAT TIME YOU GET UP
- **IT** (TG Canale 9): IL CASSETTO DEI CALZINI SA A CHE ORA TI ALZI
- **ES** (Canal 9 Noticias Noche): EL CAJÓN DE LOS CALCETINES SABE A QUÉ HORA TE LEVANTAS

#### press[43] — stairs-small-talk

- **EN** (Nightside Live): BREAKING: THE PEOPLE ON THE STAIRS ARE TALKING ABOUT YOU
- **IT** (Diretta Notte): ULTIM'ORA: QUELLI CHE PRENDONO LE SCALE STANNO PARLANDO DI TE
- **ES** (Directo Madrugada): ÚLTIMA HORA: LOS DE LAS ESCALERAS ESTÁN HABLANDO DE TI

#### press[44] — browser-tabs-side-projects

- **EN** (Nightly Chyron Network): FORTY TABS IS NOT CHAOS. FORTY TABS IS A PIPELINE.
- **IT** (Rete Sottopancia): QUARANTA SCHEDE NON SONO CAOS. QUARANTA SCHEDE SONO UN MAGAZZINO.
- **ES** (Cadena Rótulo 24H): CUARENTA PESTAÑAS NO SON UN CAOS. CUARENTA PESTAÑAS SON UN INVENTARIO.

*"Pipeline" is English tech-speak that neither locale's scenario uses; each
chyron instead promotes its own tier-2 word (`magazzino` / `inventario`), which
is the word the cover story already used for the same idea.*

> **Fix-round amendment [Minor 7a] — the mechanism claim here was wrong.** This
> paragraph originally said the tier-2 card and this chyron make "the two cards
> on one screen rhyme". They cannot: `pickPress` filters by tier, and the chyron
> slot renders only on tier-3 days, where all three slots are tier 3. The two
> lines never co-render. The echo is real but runs **across days**: the cover
> story's own word → the tier-2 day's card → the tier-3 day's chyron, so a
> returning player meets `magazzino`/`inventario` three times in three
> registers. Corrected rather than deleted, because the echo is the reason the
> word was chosen; only the staging was mis-stated.

---

## 2. The spoiler lexicons

Both replace an alias of the English `PRESS_SPOILER_LEXICON`. That alias was
harmless only while the 24 blurbs were English placeholders; with real prose in
the bank it would have been a guard that passes by not understanding the
question — "ritrattato", "smentito", "desmentido", "replicó" all sail past every
English entry.

`findPressSpoilerTerms` matches **at word start**, case-insensitively, over
blurb **text AND outlet**. Case-insensitivity is what makes one lowercase stem
also cover a shouting tier-3 chyron.

### Italian — `IT_PRESS_SPOILER_LEXICON` (25 entries)

```
replic  ritratt  ritirat  smenti  confut  scredit  sbugiardat  smontat
ribaltat  bufal  frod  fake  fortuit  p-hack
falso positivo / falsi positivi   risultato nullo / risultati nulli
effetto nullo   nessun effetto    effetto reale / effetto vero
sempre zero     ha retto          non regge
```

Design notes:

- **`replic`, not `replicat`.** Italian nominalises the verdict far more readily
  than English ("una replicazione indipendente"), and `replicat` misses
  `replicazione` outright (replica-**z**-ione).
- **`smenti`, not `smentit`.** Reaches the present tense (`smentisce`) as well
  as the participle; `\bsmentit` would not.
- **Both numbers of every phrase.** Italian agreement changes the ending of
  every word in the noun phrase, not only the head, so `falso positivo` and
  `falsi positivi` are separate literals — the matcher anchors at `\b` and is
  otherwise literal.
- **Exclusions.** One measured, three prospective:
  1. `conferm` — **2 hits on the shipped bank** (the tier-2 "hanno finalmente
     confermato quello che il tuo gruppo WhatsApp sospettava" and the tier-3
     "LA SCIENZA CONFERMA"). Same carve-out EN documents: an outlet confirming
     the paper the player just wrote is Act I credulity, not ground truth.
  2. `casual` / `a caso` — **randomisation vocabulary** ("assegnati a caso"),
     i.e. method, which the spoiler law explicitly permits. `fortuit` carries
     the fluke sense with no collision.
  3. `ha tenuto` — the obvious rendering of EN's `held up`, and unusable:
     `tenere` is Italian's ordinary verb for KEEPING, and the fern scenario's
     treatment is literally "Tiene una felce sulla scrivania". `ha retto` and
     `non regge` carry the verdict instead.
  4. `ritir` (broad) — narrowed to the participle `ritirat`, because
     `il ritiro` / `ritirare` is what a **marathon runner** does and this bank
     covers a marathon. Residual risk stated in the file: "si sono ritirati"
     would still fire; nothing in the corpus says it, and §4's posture prefers
     blocking that phrasing to letting "lo studio è stato ritirato" through.

### Spanish — `ES_PRESS_SPOILER_LEXICON` (26 entries)

```
replic  réplic  retract  retirad  desmenti  desmient  desmontad  refut
desacredit  amañad  bulo  fraud  fake  chiripa  p-hack
falso positivo / falsos positivos   resultado nulo / resultados nulos
efecto nulo   ningún efecto / ningun efecto   efecto real
siempre cero  se sostiene / se sostuvo / se ha sostenido / se sostenía
```

> **Fix round 1 [Minor 5].** The compound past and the imperfect are not
> reachable from `se sostuvo` / `se sostiene` (`\bse sostuvo` cannot match "se
> ha sostenido"), and the project demonstrates the first form itself: the
> Spanish Grantwell bank ships *"He despejado la tarde para oír que la hipótesis
> **se ha sostenido**"*. That line is safe where it lives — the spoiler scan
> reads press, not Grantwell — and is exactly the phrasing a blurb would borrow,
> which makes it evidence rather than speculation. Both forms added, each with
> its own positive test case. Lexicon is now **28 entries**.

Design notes:

- **The accent breaks the stem.** `replic` catches replicado / replicación /
  replicó (the final "ó" is past the stem) but **cannot** catch `réplica`: the
  tilde sits *inside* the stem and `\breplic` never matches r-é-p-l-i-c. Hence
  the separate `réplic`. Same reasoning gives `ningún efecto` its
  accent-stripped twin.
- **Stem-changing verbs need two entries.** `desmentido` vs `desmiente` share no
  usable prefix, so `desmenti` + `desmient`.
- **Exclusions.** Two measured, two prospective:
  1. `confirm` — **2 hits** (tier-2 "La ciencia confirma por fin…", tier-3 "LA
     CIENCIA CONFIRMA"). EN's carve-out, same reasoning.
  2. `verdad` — **1 hit**: "El número cuatro está en una revista **de verdad**"
     is a joke about the JOURNAL, not about the finding.
  3. `azar` / `aleator` — randomisation vocabulary ("asignados al azar"), i.e.
     method. `chiripa` carries the fluke sense.
  4. `sostien` (bare) — Spanish's ordinary verb for MAINTAINING a claim; the
     dog-economist cover story opens "El folclore … **sostiene** que", so a
     blurb reporting what the authors maintain would trip a verdict guard on a
     sentence that asserts nothing. The reflexive `se sostiene` / `se sostuvo`
     carry the verdict and nothing else.
  - Residual risk stated in the file, in the shape `HARM_LEXICON_ES` already
    uses for `cura`: `retirad` would fire on "los corredores retirados en el
    kilómetro 30".

### Probe results (why no approved content had to be rewritten)

Measured over the whole 45-entry bank in each locale, text **and** outlet:

| lexicon | hits on the shipped bank |
|---|---|
| `IT_PRESS_SPOILER_LEXICON` (25 terms) | **0** |
| `ES_PRESS_SPOILER_LEXICON` (26 terms) | **0** |

So none of the pre-existing 21 transcreated generics had to be reworded, and
none of the 24 new blurbs trips its own guard. The **rejected broad candidates**
were probed the same way, which is where the "measured" exclusions above come
from: `conferm` → 2 IT hits, `confirm` → 2 ES hits, `verdad` → 1 ES hit. The
other rejected candidates (`casual`, `a caso`, `ha tenuto`, `ritir`, `azar`,
`aleator`, `sostien`, `retirad`) score 0 on today's corpus — their exclusion is
prospective, so each one got an explicit **negative test case** rather than a
comment:

- IT: "Ogni responsabile acquisti **ha tenuto** la felce per un intero ciclo di
  gare." / "I partecipanti sono stati assegnati **a caso** ai due gruppi." /
  "Il maratoneta **si ritira** sempre al trentesimo chilometro."
- ES: "Los autores **sostienen** que el efecto es modesto." / "Los participantes
  fueron asignados **al azar**." / "El número cuatro está en una revista **de
  verdad**."

Each must produce zero problems; each is asserted.

### Positive cases (guards the guard)

27 Italian and 25 Spanish verdict sentences — one per lexicon family, in the
phrasing a native writer would actually reach for on a day the effect is real —
are asserted to be **caught**. Both blocks also assert the lexicon is reached
**through `validateLocaleContent`**, not only through the helper, which is the
[I1] wiring the fix round installed.

---

## 3. The debt, cleared

`PENDING_T39B_PRESS` (the 24 indices `6-12, 20-28, 37-44`) is gone from both
locale suites. The tracker itself stays, in the form it was designed to become:

```ts
it('leaves no press blurb in English: every Italian text differs from its English counterpart', () => {
  const aliased = itContent.press.flatMap((blurb, i) => (blurb.text === enContent.press[i].text ? [i] : []));
  expect(aliased).toEqual([]);
});
```

Both locales, both directions: an English-aliased blurb can never reappear. The
sunset comments in `src/content/{it,es}/index.ts` ("TRANSCREATION PENDING",
`// T39b: transcreation pending` ×24 each) are removed and replaced with a note
about what the transcreation actually did — which locale furniture each block
reuses, and the spoiler law restated where the writing happens.

**One new guard per locale, beyond the mechanical ones.** A blurb that named the
*English* scenario's furniture would pass every mechanical check in the file and
still read as a translation, so each suite now asserts the divergences:

- IT: bank contains `eptacaidecafobia`, `ENDECASILLABO`, `CORNETTO`; contains no
  form of the English thirteen.
- ES: bank contains `triscaidecafobia`, `ENDECASÍLABO`, `NAPOLITANA`.

> **Fix round 1 [Minor 6].** The Italian negative check was `/\bnumero 13\b/` —
> one phrasing, and not the likeliest one. It is now
> `/\b(?:numero|il|del|al) 13\b|\btredici\b/i`, which catches the numeral behind
> the article ("chi evita **il 13**", "la paura **del 13**") and the spelled-out
> form, i.e. the shapes the SUPERSTITION actually takes. Deliberately **not** a
> bare `/13/`: this locale's press may one day legitimately count to thirteen
> about something that is not a mortgage, and a guard that forbids a numeral
> outright would be banning arithmetic to catch a superstition. Scope is the
> press bank only, as before. The widening comes with a guards-the-guard test
> that asserts three catches ("Chi evita il 13…", "…del numero 13…", "Tredici
> piani saltati.") and two non-catches ("…e 13 città coinvolte.", "Le 13
> riunioni sono durate 340 minuti.").

---

## 4. The reachability nit (optional small, taken)

The T39a report *claimed* "all 45 of 45 blurbs remain reachable across the
simulation" and left it a number in prose. It is now
`tests/game/published.test.ts` →
**"walks the whole bank across a season of dates: the rotation strands no blurb"**:
112 dates (four months of 28, generated arithmetically so the test needs no
calendar) × 20 scenarios × 3 tiers, asserting that every tier's **generic pool
is reached in full** and that no blurb anywhere in the bank is unreachable.

Why it is not redundant with the existing variety test: `secondCards.size > 1`
passes on a rotation that only ever reaches two of seven. The slot rotation buys
distinctness at the stated cost of consecutive draws, and that trade is only
sound if the rotation still *walks* the pool.

**Verified by mutation, not by assertion.** Replacing the shipped index math
`(((h ^ (h >>> 15)) >>> 0) + offset) % safePool.length` with `offset %
safePool.length` (i.e. dropping the day's hash) turns the test **RED**, naming
the three tier-1 generics that become unreachable:

```
tier 1 generic blurbs never picked in 112 days
+ [
+   "The finding is preliminary. The researchers say that is exactly why it matters.",
+   "Peer-reviewed and published this week: a link nobody thought to look for.",
+   "Researchers call for further study, and for further funding to conduct it.",
+ ]
```

`src/game/published.ts` was restored byte-for-byte afterwards (`git diff` on it
is empty); the mutation was never committed.

> **Fix-round amendment [Minor 7c] — a stronger mutation, supplied by the
> reviewer and reproduced here.** Dropping the day's hash is a blunt mutation:
> it strands three blurbs at once and would plausibly disturb other tests too,
> so it proves the new test *fires* without proving it is *needed*. The
> discriminating mutation is `% safePool.length` →
> `% Math.max(1, safePool.length - 1)`, which makes exactly the LAST entry of
> each pool unreachable and changes nothing else. Reproduced on this branch:
>
> | test | under the last-entry mutation |
> |---|---|
> | `still varies the generic slots across dates` (pre-existing) | **PASSES** |
> | `renders three pairwise-distinct items on every day` (pre-existing) | **PASSES** |
> | `walks the whole bank across a season of dates` (new) | **FAILS** — names the one stranded blurb: *"Researchers call for further study, and for further funding to conduct it."* |
>
> That is the non-redundancy argument in evidence rather than in prose: a real
> hole in the rotation is invisible to every test that existed before this one.
> `published.ts` restored byte-for-byte again afterwards; `git diff` empty.

---

## 5. Laws re-checked, with numbers

| law | IT | ES |
|---|---|---|
| Structural parity (counts, tiers, `scenarioIds` index by index) | unchanged, green | unchanged, green |
| Press harm scan, locale lexicon | 0 problems | 0 problems |
| Press spoiler scan, **new** locale lexicon | 0 problems | 0 problems |
| Tier voice (tier 3 ≥ 90% caps; tiers 1-2 < 50%) | green | green |
| No journal masthead in press | green | green |
| No `{token}` in press | green | green |
| Em dashes added by this task | **0** | **0** |
| Em-dash density before → after (3 s.f.) | 1 per 12,900 → **1 per 13,100** | 1 per 38,700 → **1 per 39,300** |
| `it` dashes ≤ `en` dashes (IT-only law) | 3 ≤ 3, still true | n/a |

> **Fix-round amendment [Minor 7b] — the original figures were stale and
> over-precise.** This table first quoted "1 per 13,100.3" and "1 per 39,320",
> measured *before* the last three copy tweaks of the first round and then not
> re-measured; the reviewer's own measurement of the committed tree (IT 1 per
> 13,099.0, ES 1 per 39,334) is the correct figure for `81c50de`. After fix
> round 1 the measured values are **IT 1 per 13,093.0** and **ES 1 per
> 39,314.0**. Quoting to 3 s.f. from here on, since a tenth of a character is
> false precision on a ratio that moves whenever a comma does. Dash counts are
> unchanged throughout (IT 3, ES 1, EN 3), so every one of these numbers is a
> character count moving, never a dash appearing.

Density *improved* in both locales against the pre-T39b baseline at zero new
dashes, which is the direction the budget is supposed to move. Decimal points: no new numeral in any of the 48 strings carries a decimal
separator at all, so the point/comma rule is untouched; the two chyrons that
spell a p-value out loud ("ZERO VIRGOLA ZERO CINQUE" / "CERO COMA CERO CINCO")
are pre-existing and unmodified.

**The "baja" question [fix round 1], asked and answered against the code rather
than by argument.** ES press[20] now contains `baja`, which IS an entry on
`NEGATIVE_DIRECTION_LEXICON_ES`. It is not a violation, and the reason is
structural: `findNegativeDirectionTerms` iterates
`content.scenarios[].outcomeLabels` and touches nothing else, so the one-tailed
direction contract has never read press text. The six scans that DO read a
blurb are harm, spoiler, voice, journal, token and em-dash. The contract itself
is about columns in the dataset — "more of the metric means more of the claimed
effect" — and a marca that drops is the good news this paper is selling, which
is why the sentence is right as well as legal.

Pinned as a test rather than left as a paragraph
(`Spanish direction contract stops at the outcome labels`): it asserts that the
blurb contains "baja", that the direction scan reports zero problems, that the
full validator reports zero problems, **and** that moving the same word into an
`outcomeLabel` does fire the guard — because "the scan does not reach press" is
only reassuring if the term would genuinely have fired had it been in scope.

**Day-type invariance**, the thing that actually matters: not one of the 48
strings says whether the finding is true. They report the QUESTION, the METHOD
and the cover story's own furniture — a folding table, a pizza-paid jury, a
broker's regards, 340 hours of hard bop — which is exactly the register the
spoiler law permits on both real-effect and null days.

---

## 6. My ten best

1. **IT press[41]** — `ESCLUSIVO: IL REFERAGGIO PIÙ DURO DELLA TUA VITA È STATO
   SCRITTO ACCANTO A UN CORNETTO`. The English "a pastry" is a shrug; a cornetto
   is a specific 8am Italian bar, and the referee is having one while destroying
   your paper.
2. **ES press[41]** — `EXCLUSIVA: EL INFORME MÁS DURO DE TU VIDA SE ESCRIBIÓ AL
   LADO DE UNA NAPOLITANA DE CHOCOLATE`. Same move, and the "de chocolate" is
   the extra beat: the chyron has time to specify the filling.
3. **IT press[27]** — `Che cosa dice del tuo mutuo il tuo punteggio di
   eptacaidecafobia.` A tabloid that has swallowed the paper's coinage whole and
   is now billing your fear of 17 as a credit score.
4. **IT press[37]** — `STUDIO: SALE LA SCRIVANIA, ESCE L'ENDECASILLABO`. Two
   verbs, two nouns, one machine; it reads like a vending machine for verse.
5. **ES press[24]** — `…los investigadores ahora lo llaman inventario. Cada
   proyecto tenía que llegar con un enlace público que funcionara, el tuyo
   incluido.` The "el tuyo incluido" turns a method footnote into an accusation.
6. **IT press[7]** — `Ai partecipanti è stato detto del questionario; dei badge,
   al debriefing.` The semicolon does what the English em dash did, and the
   elliptical second clause makes the ethics-board euphemism land harder in
   Italian than in English.
7. **ES press[6]** — `Los autores califican la coincidencia de tranquilizadora.`
   Perfectly straight prestige-press register on a sentence about socks.
8. **IT press[44]** — `QUARANTA SCHEDE NON SONO CAOS. QUARANTA SCHEDE SONO UN
   MAGAZZINO.` The chyron promoting the study's own euphemism to a slogan, in a
   word the Italian scenario actually uses — met again, in a third register, by
   a player who has already seen the cover story and the tier-2 card on other
   days. (Corrected in fix round 1: the two press lines never share a screen.)
9. **ES press[22]** — `¿Te está buscando sitio tu signo?` Five words, entirely
   idiomatic, and it makes the horoscope the subject of the sentence.
10. **IT press[10]** — `Chi ha un telescopio, annotano gli autori, era
    felicissimo che glielo si chiedesse.` The parenthetical "annotano gli
    autori" is the exact prestige-press tic, wrapped around the most
    unnecessary finding in the paper.

---

## 7. Concerns

1. **`retirad` / `ritirat` vs the marathon.** Documented in both lexicons and
   accepted knowingly: a future blurb about runners dropping out of a race would
   trip a verdict guard. The alternative (dropping the stem) lets "el estudio ha
   sido retirado" through, which is the actual harm. If it ever bites, narrow to
   the phrase `estudio retirado` / `studio ritirato` rather than deleting.
2. **Prospective exclusions are argued, not measured.** `casual`, `a caso`,
   `ha tenuto`, `azar`, `aleator`, `sostien` score zero hits on today's corpus,
   so their exclusion rests on reasoning about what the languages invite plus a
   negative test case each. That is the honest status; a future author who wants
   them in should re-probe first.
3. **The tier-3 voice law is a capitals ratio, and accented capitals are
   invisible to it.** `PIÙ`, `È`, `ENDECASÍLABO`, `RÓTULO` contribute nothing to
   the numerator or the denominator. That is fine today (every tier-3 string is
   overwhelmingly ASCII), but a future Spanish chyron that was mostly accented
   words would satisfy the law without shouting. Not fixed here: it is the
   shared validator's design and out of this task's scope.
4. **The dgp flake.** `tests/engine/dgp.test.ts` times out at 5s under full
   parallel load and passes in isolation. Untouched by this task, reported
   rather than hidden, but it does mean "one green whole-suite run" is not
   currently available on this branch.
5. **Not play-tested on screen.** The 48 strings are verified against every
   mechanical law and read aloud, but nobody has seen them rendered in the
   Published card at their real widths. The tier-3 Italian and Spanish lines are
   longer than their English sources (`LO ABBIAMO CHIESTO A UN CANE DI NOME
   HAYEK`, `SE LO HEMOS PREGUNTADO A UN PERRO LLAMADO HAYEK`), which is
   idiomatic but worth one visual check at a narrow viewport.
