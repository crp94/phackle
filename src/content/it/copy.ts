// Italian UI copy catalog (T19). Typed against the CopyKey union that
// src/content/en/copy.ts owns, so a key missing here is a `tsc` error rather
// than a runtime fallback to English.
//
// TRANSCREATION, not translation. The register rules are the English file's,
// carried over intact:
//
//  - Act I (briefing/lab/published/call) is sincerely enthusiastic. The game is
//    never in on the joke before the reveal. `lab.peekFootnoteArmitage` is the
//    single permitted wink in the whole of Act I and stays one ("Curiosità:").
//  - Act II (reveal/summary/stats) is clinical and short. Never smug.
//  - about/legend/errors/a11y are plain and precise.
//
// Three things are deliberately NOT Italian:
//
//  1. Statistical notation keeps the decimal POINT *and the leading zero*
//     (p = 0.049, never 0,049 and never .049). about.decimalNote says so in
//     Italian and then demonstrates it. Since gr6-027 there are no exceptions
//     left in this file: `α = 0.05` in lab.peekFootnoteArmitage was the last
//     one, and it closed when owner ruling (b) amended that string.
//  2. `{token}`s. NOT for the reason this file used to give. `t()`
//     (src/i18n/t.ts:33) substitutes with a GLOBAL regex and therefore
//     replaces EVERY occurrence, so a repeated token would not render raw
//     through t(). No value below repeats one all the same, for two reasons
//     that are true: several call sites interpolate with a LITERAL
//     String.replace and do only the first (SpecCurve.tsx:212,
//     published.ts:97, and the UI suites' line-builders), and the EN/IT parity
//     guard compares token SETS, so a duplicate here and not in English would
//     be invisible to it. `it.shape.test.ts` asserts the no-repeat rule
//     directly, which is what makes the set comparison sufficient.
//  3. Terms Italian academics genuinely use in English: "Reviewer 2",
//     "outlier", "p-value", "df", "log". Translating those would cost the
//     realism the joke is built on. ("Open Data" used to head this list as an
//     allowed journal BADGE in prose. T37 removed it from the one place it
//     was actually used — briefing.openData, where it was never a badge but
//     the app's primary CTA — and no value has used it since, so the
//     permission is retired rather than left standing over nothing.)
//
// IT-IT CONVENTION CONTRACT (T37, from the T36 UI-language audit §4b). The
// rules an it-IT interface follows, on top of the register rules above:
//
//   1. ACTIONS TAKE THE SECOND-PERSON IMPERATIVE: "Apri i dati", "Invia per la
//      pubblicazione", "Condividi", "Chiudi", "Guarda in faccia la verità".
//      The infinitive is acceptable only for a menu-category label; a noun
//      phrase never is.
//   2. REGISTER IS TU throughout the chrome, never Lei. And never the
//      editorial "noi": the app is impersonal about itself, so no "mentre
//      generavamo", no "prima che ti mostriamo".
//   3. SENTENCE CASE EVERYWHERE: "modalità Hacking", not "Modalità Hacking".
//      Achievement names, glossary terms and headings capitalise the first
//      word and proper nouns only, titles included (*Il giardino dei sentieri
//      che si biforcano*). English Title Case is this locale's loudest calque.
//   4. STATE LABELS ARE NOMINAL OR PARTICIPIAL, never English fragments:
//      "RISULTATO NULLO", "Copiato negli appunti", "Già giocato oggi". Legend
//      glosses are NOMINAL: "Invio per la pubblicazione", "Raccolta di altri
//      dati".
//   5. NO NOUN-NOUN JUXTAPOSITION. Italian needs the preposition:
//      "Esclusione degli outlier". ("punti carriera" is the sanctioned
//      exception: it is what Italian academia actually says.)
//   6. NO VERB-FINAL ENGLISH WORD ORDER. Put the subject after the verb rather
//      than stranding the verb at the end of a relative clause.
//   7. TERMINOLOGY IS FIXED AND MUST NOT DRIFT. Paths are *sentieri*; forks
//      are *biforcazioni*; the call is *il verdetto*; the mode is
//      *Preregistrazione*, in all five places that name it; the streak is
//      *Serie*, in all four (summary.streak, stats.currentStreak,
//      stats.maxStreak, share.streakWord — gr6-031: it was named twice, one
//      tap apart, and *Giorni consecutivi* is gone).
//      AMENDED BY gr6-028: this rule used to pin *la rivelazione* as the name
//      of the screen the day ends on. English retired "the reveal" from player
//      copy — it is developer vocabulary the game never shows anybody — so the
//      pin is retired with it. The Italian name for that beat is *la verità*,
//      which published.faceTruth and lab.howThisWorks.step4 have always used
//      ("Guarda in faccia la verità"); it is now the only name, not a
//      carve-out from one. *rivelazione* must not come back into a value.
//      The `reveal.` KEY prefix is untouched: developers read keys.
//   8. ENGLISH ONLY FROM THE ALLOWLIST in item 3 of the "deliberately NOT
//      Italian" list at the top of this file. "brief" is not on it.
//   9. COUNT-BEARING LABELS MUST AGREE AT n = 1: "Serie: {n}", not "Serie di
//      {n} giorni". Check every {n}/{k}/{forks}/{peeks} against its real floor
//      before assuming a plural is safe.
//  10. NOTATION IS NOT PROSE (item 1 of the "deliberately NOT Italian" list
//      at the top of this file): decimal point always, "{hours} h {minutes}
//      min" with spaces, no comma-decimal anywhere.
//  11. EM-DASH BUDGET: 0. stats.noData's — is the only permitted U+2014.
//      Italian reaches for the lineetta more readily than English; the point
//      of writing natively is that it does not have to.
//  12. ARIA STRINGS SOUND LIKE SPEECH. Read each one aloud: a screen-reader
//      user should hear something an Italian app says daily, not a spec line.
import type { CopyKey } from '../en/copy';

export const copy: Record<CopyKey, string> = {
  'nav.title': 'P-hackle',
  'nav.tagline': 'Un gioco quotidiano sul giardino dei sentieri che si biforcano.',
  'nav.about': 'Informazioni',
  'nav.stats': 'Statistiche',
  'nav.legend': 'Legenda',
  'nav.play': 'Gioca',
  // gr6-017 — collegamento di salto, visibile solo quando riceve il fuoco.
  // Nomina la DESTINAZIONE, come fa ogni skip link.
  'nav.skipToContent': 'Vai al contenuto principale',
  // Endonyms: every language names itself, in itself. Identical in all three
  // catalogs on purpose (see the EN union's own note) — an Italian reader
  // looking for Spanish looks for "Español", not for "Spagnolo".
  'nav.localeNameEn': 'English',
  'nav.localeNameIt': 'Italiano',
  'nav.localeNameEs': 'Español',
  'nav.themePaper': 'Carta',
  'nav.themeDark': 'Scuro',

  // T37: was 'Open Data', on the reasoning that it is the badge Italian
  // journals print in English on Italian papers. That reasoning was the bug in
  // writing: this key is not the badge, it is the app's primary CTA (the one
  // button a first-time player can press). Imperative, per rule 1 of the
  // convention contract. (gr6-086: the header's "Open Data as a prose badge"
  // permission has since been retired — no value uses it.)
  'briefing.openData': 'Apri i dati',
  // The PLAYER is the paper's author; Grantwell only sends the email.
  'briefing.correspondingAuthor': 'Autore corrispondente: tu',
  'briefing.vol': 'Vol. {volume}, n. {issue}',
  'briefing.emailFrom': 'Prof. R. Grantwell',
  'briefing.goal': 'Il tuo compito: trovare un effetto statisticamente significativo (p < 0.05) e pubblicarlo.',

  // §1(j): "un tentativo per modalità" prometteva due partite al giorno; la
  // regola è una sola partita e una sola modalità (v. Briefing.tsx). Stessa
  // struttura in tre frasi brevi; "una sola" ripetuto perché in italiano è
  // l'unico modo naturale di dire "one X, one Y" senza suonare telegrafico.
  'briefing.modeChooserIntro':
    'La preregistrazione è sbloccata. Scegli come giocare oggi. Una sola partita, una sola modalità.',
  // T37: sentence case (rule 3) — Italian does not capitalise a common noun
  // mid-sentence — and one name for the mode, "Preregistrazione", which is
  // what prereg.title, summary.preregUpsell, briefing.modeChooserIntro and
  // stats.successRateTitle already say (rule 7).
  'briefing.playHacking': 'Gioca in modalità Hacking',
  'briefing.playPrereg': 'Gioca in modalità Preregistrazione',
  'briefing.alreadyPlayedToday': 'Già giocato oggi',
  // gr6-008 — lo stato "giornata finita" della scheda iniziale, nel registro
  // della scheda e non in quello della fattura. Vale su entrambi i percorsi:
  // anche chi riporta un risultato nullo ha finito la giornata, quindi la
  // frase nomina la giornata e mai una pubblicazione. Nominale (regola 4).
  'briefing.finishedToday': "Il rompicapo di oggi è finito. Ecco com'è andata.",
  // Il conto alla rovescia con il vocabolario della testata: briefing.vol
  // stampa "Vol. 1, n. 11" due righe più su, quindi il prossimo rompicapo è
  // il prossimo NUMERO. Stessi due token di summary.nextIn, stessi floor.
  // Regola 10: spazio prima del simbolo di unità.
  'briefing.finishedNextIn': 'Il prossimo numero esce tra {hours} h {minutes} min.',

  'email.from': 'Da:',
  'email.subject': 'Oggetto:',

  'lab.outcome': 'Esito',
  'lab.subgroup': 'Sottogruppo',
  'lab.covariates': 'Covariate',
  // "outlier" is the word Italian methods sections actually print; the
  // preposition is not optional (rule 5: no noun-noun juxtaposition).
  'lab.exclusion': 'Esclusione degli outlier',
  'lab.transform': 'Trasformazione',
  'lab.tails': 'Code',
  'lab.submit': 'Invia per la pubblicazione',
  'lab.reportNull': 'Riporta un risultato nullo',
  'lab.nLabel': 'n = {n}',
  'lab.collectMore': 'Raccogli altri {n}',
  // gr6-025 — a che cosa serve il pulsante, accanto al pulsante. Sincero e
  // fattuale: la sovrattassa alla verità è dove questo si paga, e l'Atto I non
  // deve battere ciglio per primo. "IC 95%" è il vocabolario che
  // lab.coefPlotCaption già stampa, quindi la frase indica una cosa che il
  // giocatore ha davanti agli occhi.
  'lab.collectMoreHint': "Un campione più grande restringe l'IC 95% della tua stima.",
  // Sincere first, wink second. The Armitage line is the only moment in Act I
  // allowed to know what it is looking at; it is meant to be easy to miss.
  'lab.peekFootnote':
    'Raccogliere altri dati è quello che fa un laboratorio diligente. Ogni lotto viene registrato per la sezione metodi.',
  // RI-DECISIONE DEL CONTROLLER (w2-r-001) — deviazione dichiarata dal testo
  // verbatim della master spec. La regola (b) chiedeva "equidistanti", ma la
  // premessa era falsa: lo schema di questo gioco (200→250→300→350→400) È
  // equidistante, Δn = 50, e dà comunque 11,2% invece di 14,2%. La condizione
  // vera è che i controlli cadano a FRAZIONI UGUALI DELL'INFORMAZIONE TOTALE
  // (Armitage: 80/160/240/320/400, il primo controllo vede un quinto dei dati;
  // qui il primo ne vede la metà). Misura su 1.000.000 di simulazioni per
  // schema: 14,172% Armitage · 11,174% questo gioco · 8,681% alla prima
  // comparsa della nota. La frase enuncia quindi il fatto DELLA CITAZIONE, con
  // la condizione da cui dipende, ed è IMPERSONALE di proposito: non dice
  // "le tue sbirciate", perché cinque sbirciate qui non sono raggiungibili (il
  // massimo è quattro). Non riportarla alla seconda persona.
  // w2-r-012 — ORDINE DELLE PAROLE PORTANTE: "lotti UGUALI di dati", non
  // "lotti di dati uguali". Posposto, l'aggettivo si attacca al nome più
  // vicino, e "lotti" e "dati" sono entrambi maschili plurali: la morfologia
  // non disambigua, quindi la lettura di default diventa "dati uguali" e la
  // condizione (i lotti sono di uguale dimensione) sparisce. Il pin verbatim
  // in shape.test.ts tiene questo ordine.
  // gr6-027: `α = .05` → `α = 0.05`. Lo zero iniziale non ha più eccezioni.
  'lab.peekFootnoteArmitage':
    'Curiosità: fare un test dopo ciascuno di cinque lotti uguali di dati trasforma α = 0.05 in un tasso di falsi positivi di circa il 14% (Armitage, 1969).',
  // gr6-096: la vecchia stringa apriva con `n < 30` e affermava così una causa
  // che non poteva conoscere. MIN_CELL è una delle due ragioni per cui una
  // cella non è analizzabile, ed è quella che non vincola mai (0 punti su
  // 215.040 enumerati). Ora riporta lo stato e si ferma.
  'lab.insufficient': 'Dati insufficienti per analizzare questo sottocampione.',
  // gr6-061 — l'annuncio del momento in cui INVIA diventa possibile, letto una
  // volta da una live region: prima il fatto, poi quello che il fatto permette.
  'lab.canPublish': 'Sotto 0.05. Puoi inviare questa analisi per la pubblicazione.',

  'lab.subgroupAll': 'Tutti i partecipanti',
  'lab.subgroupAgeLt40': 'Età < 40',
  'lab.subgroupAgeGe40': 'Età ≥ 40',
  'lab.subgroupExpHigh': 'Esperienza alta',
  'lab.subgroupExpLow': 'Esperienza bassa',
  // T37: nominal, like their siblings. A bare adjective has nothing to agree
  // with here. reveal.subgroupUrban/Rurale stay compact and unchanged.
  'lab.subgroupUrban': 'Area urbana',
  'lab.subgroupRural': 'Area rurale',

  'lab.covariatesNone': 'Nessuna',
  'lab.covariatesBoth': '{income} + {risk}',

  'lab.exclusionNone': 'Nessuna',
  'lab.exclusionZ3': '|z| > 3',
  'lab.exclusionZ2_5': '|z| > 2.5',
  'lab.exclusionZ2': '|z| > 2',

  'lab.transformRaw': 'Grezzo',
  'lab.transformLog1p': 'log(1+x)',

  'lab.tailsTwo': 'Due code',
  'lab.tailsOne': 'Una coda',

  'lab.pEquals': 'p = {p}',
  'lab.pBelow': 'p < 0.001',
  'lab.dfLabel': 'df = {df}',
  'lab.coefPlotCaption': 'Stima {beta} {unit} (IC 95% da {lo} a {hi})',
  'lab.forkTrailLabel': 'Biforcazioni finora',

  // Six methods notes, one per control group. A colleague describing a knob in
  // the register a methods section uses. Not one of them may suggest that the
  // choice is convenient: the reveal earns that, and earns it harder if Act I
  // never nudged.
  // Rule 6: the subject goes after the verb, not stranded at the end.
  // gr6-034: "prima della stima" / "Stima l'esito" erano la resa di "before
  // fitting" / "Fit the outcome", cioè lo stesso gergo non spiegato che
  // l'inglese ha tolto: parole che un quindicenne sveglio non ha. Riscritte in
  // parole che non richiedono di cercare niente.
  'lab.explain.outcome': 'La misura che questa analisi prova a spiegare. Ce ne sono quattro fra cui scegliere.',
  'lab.explain.subgroup': "Esegue l'analisi su un solo gruppo di partecipanti invece che su tutti.",
  'lab.explain.covariates':
    'Tiene conto anche delle differenze di partenza tra le persone nel confronto fra i due gruppi.',
  'lab.explain.exclusion': "Toglie dal campione i valori più estremi prima che parta l'analisi.",
  'lab.explain.transform': "Misura l'esito sulla sua scala originale, oppure ne comprime i valori grandi su scala logaritmica.",
  'lab.explain.tails': 'Verifica un effetto in entrambe le direzioni, oppure solo in quella prevista.',

  'lab.howThisWorks.title': 'Come si gioca',
  // gr6-033: il passo 1 diceva di leggere una schermata che il giocatore ha
  // già lasciato — è l'unico dei quattro che non si può eseguire da dove è
  // stampato. Ora indica la domanda che è ancora lì sopra. Il passo 4 acquista
  // il verdetto: §2.6 è il cuore del gioco e i quattro passi lo saltavano.
  'lab.howThisWorks.step1': 'Parti dalla domanda in alto: è a quella che i dati di oggi dovrebbero rispondere.',
  'lab.howThisWorks.step2': "Regola l'analisi finché il numero grande non scende sotto 0.05.",
  'lab.howThisWorks.step3': 'Invia la tua scoperta per la pubblicazione.',
  'lab.howThisWorks.step4': 'Guarda in faccia la verità su quello che hai trovato, e dichiara se ci credi.',
  'lab.howThisWorks.dismiss': 'Ho capito',

  // The single most important sentence in the app: a first-timer has to
  // understand the big number without reading anything else. Plain words, no
  // "ipotesi nulla", no "significatività", no Greek.
  'lab.dialCaption':
    'Questo numero dice quanto spesso il caso da solo produrrebbe un risultato come il tuo. Più è piccolo, più è difficile liquidare il tuo risultato come fortuna. Sotto 0.05, puoi pubblicare.',

  'lab.coefPlotAxis': 'Effetto stimato ({unit})',
  'lab.coefPlotZero': 'nessun effetto',
  'lab.cutControl': 'Gruppo di confronto',
  'lab.cutLegendIncluded': 'Analizzati: {n}',
  'lab.cutLegendExcluded': 'Esclusi: {n}',
  'lab.cutLegendMean': 'Media del gruppo',

  // T37: "ha la chiave" was a literal calque. In Italian a `chiave` is a
  // wrench or a cipher, never a map key — that word IS `legenda`.
  // gr6-029: l'inglese ha riscritto la frase invece di continuare ad annotarla;
  // l'italiano segue la nuova, che dice che cosa fa la pagina Legenda.
  'lab.forkTrailHint': 'Ogni simbolo è una mossa che hai fatto. La pagina Legenda li elenca tutti.',
  // gr6-029 — l'attivatore del popover della traccia, che prima stampava
  // `nav.legend`: tre occorrenze di "Legenda" in venti parole, per due cose
  // diverse. Non è il nome di una pagina ed entrambi restano (rendono le stesse
  // 7 righe e rispondono a domande diverse): questa è la domanda che si fa chi
  // guarda una fila di simboli sconosciuti.
  'lab.forkTrailKey': 'Che cosa vogliono dire',

  'published.faceTruth': 'Guarda in faccia la verità',
  'published.simulatedPress': 'STAMPA SIMULATA',
  'published.editorsPick': 'Scelta della redazione',
  'published.doiPrefix': 'DOI:',
  'published.authors': 'Tu et al.',
  'published.careerPoints': '+{n} punti carriera',
  // {n} is altmetricScore(), whose lowest possible value is the tier-1 floor of
  // 40, so the Italian plural ("volte") is unconditionally safe. One {n} only:
  // t() sostituisce ogni occorrenza (regex globale), ma alcuni siti
  // interpolano con un String.replace letterale e fanno solo la prima: vale la
  // regola "un token, una volta" del preambolo.
  'published.altmetricScore': 'Già menzionato {n} volte online',
  // "prodotti della ricerca" is the exact phrase the Italian research-assessment
  // machinery uses for a paper. The bureaucratic noun IS the joke.
  'published.altmetricPercentile': 'Top {pct}% di tutti i prodotti della ricerca, di sempre',

  // Act I's last beat and the hinge into Act II: conspiratorial, not accusing.
  // "Rumore che ho vestito bene" is the player's own admission to make.
  // T37: no editorial "noi" (rule 2). This string is also the Published
  // overlay's aria-label, so it is read aloud as the dialog's own name.
  // gr6-028: *la rivelazione* nominava una schermata che il gioco non chiama
  // mai così davanti al giocatore. Regola 7 emendata; qui la frase non nomina
  // più nessuna schermata, esattamente come l'inglese.
  'call.title': 'Prima di scoprirlo…',
  'call.real': 'Un effetto reale',
  'call.realSub': 'Questo replicherebbe.',
  'call.noise': 'Rumore che ho vestito bene',
  'call.noiseSub': 'Questo non replicherebbe.',
  'call.prompt': 'Detto tra noi: che cosa pensi di aver trovato?',

  'reveal.truthNull': 'Effetto vero su ogni esito misurato: {beta}.',
  'reveal.truthEffect': 'Effetto vero su {outcome} ({unit}): β = {beta}. Su ogni altro esito, niente.',
  'reveal.fig1': 'Fig. 1',
  'reveal.fig2': 'Fig. 2',
  'reveal.curveCaption':
    'Tutte le specificazioni che avresti potuto stimare, ordinate per p-value. La tua è evidenziata.',
  'reveal.curveCaptionAbandoned':
    'Tutte le specificazioni che avresti potuto stimare, ordinate per p-value. Non è stato pubblicato niente.',
  'reveal.publishedRecipe': 'Hai pubblicato: {recipe}',
  // gr6-003: il verbo della modalità Preregistrazione, non quello di Hacking.
  'reveal.preregisteredRecipe': 'Hai preregistrato: {recipe}',
  // Holds on null days too: niente si addensa, and that is the same lesson read
  // from the other side.
  'reveal.groupedCaption': 'Gli effetti veri si addensano. Il rumore si sparpaglia.',
  'reveal.omittedFootnote': '{n} specificazioni avevano troppo pochi dati per essere stimate e non sono nel grafico.',
  'reveal.toSummary': 'Vedi la fattura',
  'reveal.pValue': 'p = {p}',
  'reveal.pValueTiny': 'p < 0.001',
  // gr6-001 / w1-r-001 — "per puro caso" non era vero su nessuno dei due tipi
  // di giorno, ma nemmeno "le altre sono confondimento" lo era: sui giorni
  // nulli ACCETTATI il confondimento vale circa il 5% dei risultati
  // significativi, indistinguibile da zero, perché il campionamento per rifiuto
  // (§3.3) scarta proprio la coda confusa. La misura completa è nella nota di
  // en/copy.ts. La riga dice ora tre cose tutte vere: il conteggio è quello che
  // la soglia produce da sola, un effetto non c'è, e il disegno non è comunque
  // un test pulito.
  // Due correzioni di lingua nella stessa passata: "sono caso" non è una
  // predicazione che l'italiano ammette (il file scrive "il caso da solo" in
  // lab.dialCaption), e "si muove con" era un calco di "moves with".
  // "confondimento con l'età e il reddito" riprende about.mechanism (regola 7).
  // Zero em dash (regola 11); punto decimale con lo zero iniziale.
  // w1b-002 + w1b-009, una riscrittura che chiude tre difetti insieme.
  //  - TERMINOLOGIA (w1b-002): "confondimento con l'età" era un calco. Il
  //    termine stabilito è quello di about.mechanism, "confondimento da età e
  //    reddito", ed è il lock che il commento qui sopra certificava senza che
  //    la stringa lo rispettasse. Ora lo rispetta alla lettera.
  //  - DOPPIO "ne" (w1b-009): "perché non ce n'è" e "ne lascia passare" nella
  //    stessa frase. Il primo diventa "perché non c'è nulla da trovare", che
  //    è anche più diretto; resta un solo clitico, con un antecedente solo.
  //  - "DA SOLA" (w1b-009): in coda si appoggiava a "una su venti". Anteposto,
  //    si appoggia senza ambiguità a "una soglia di 0.05", che è il soggetto
  //    di cui si sta dicendo che basta da solo.
  'reveal.accounting1':
    "Su {total} analisi possibili, {sig} ({sigPct}%) arrivano a p < 0.05. Nessuna ha trovato un effetto, perché non c'è nulla da trovare: da sola, una soglia di 0.05 ne lascia passare circa una su venti. E nessuna è un test pulito: il trattamento non è mai stato assegnato in modo casuale, quindi c'è confondimento da età e reddito.",
  // w1-r-003: la chiusa era un assoluto e si scontrava con la didascalia della
  // Fig. 2 due blocchi più in basso ("Gli effetti veri si addensano").
  'reveal.accounting1Effect':
    "Su {total} analisi possibili, {sig} ({sigPct}%) arrivano a p < 0.05: {trueSig} sull'esito dove l'effetto è reale, {otherSig} sugli esiti dove non c'è niente. Un p-value da solo non dice di quale dei due si tratta.",
  // T37 — plural safety (rule 9). {k} floors at 1: publishing the default
  // specification explores exactly one sentiero, so "Hai esplorato 1 sentieri"
  // was the ordinary first case, not an edge one. Label-colon-count in the two
  // ledger lines; a number-neutral noun phrase with the count in parentheses
  // in the third, which has to keep its sentence shape.
  'reveal.accounting2': 'Sentieri che hai esplorato prima di pubblicare: {k}.',
  'reveal.accounting2Abandoned': 'Sentieri che hai esplorato prima di riportare un risultato nullo: {k}.',
  // gr6-003 — impegno, non esplorazione. Participio NOMINALE, non un passato
  // prossimo del giocatore: "ti sei impegnato" era l'unico participio del
  // giocatore con ausiliare essere in tutto il file, e come tale l'unica
  // stringa che assegna un genere a chi gioca (revisione W1, transcreazione).
  // Il verbo è quello di prereg.intro ("Dichiara l'analisi completa"),
  // regola 7. La seconda frase tiene l'ausiliare avere, che è invariabile.
  'reveal.accounting2Prereg':
    'Sentieri dichiarati prima di vedere un solo numero: {k}. Non ne hai eseguito nessun altro.',
  'reveal.accounting3':
    'Un ricercatore che esplora a caso quello stesso numero di sentieri ({k}) trova almeno un risultato "significativo" circa il {pHitPct}% delle volte.',
  // gr6-002 — la frase sopra descrive una ricerca uniforme a caso, che nessuno
  // fa: chi segue il p-value arriva alla significatività in 3-4 mosse.
  // w1-r-004: CONDIZIONALE. Il gioco non misura come hai cercato, quindi non
  // può affermarlo. Anche l'ordine "arriva prima alla significatività" (non
  // "arriva alla significatività prima"), che era ordine inglese.
  // w1b-009: "un minimo" si legge come "il minimo", cioè una soglia. Quello che
  // la frase dice è che la cifra sopra SOTTOSTIMA: "una stima per difetto" è il
  // termine italiano esatto, e corrisponde a "a floor" dell'inglese.
  'reveal.accounting3Directed':
    'Se hai seguito il p-value, non hai cercato a caso. La ricerca guidata arriva prima alla significatività, quindi il numero qui sopra è una stima per difetto.',
  // {peeks} floors at 1 (Reveal renders this line only when peeks !== 0), so
  // "Le tue 1 sbirciate" was on screen for every single-peek day.
  'reveal.peekSurcharge':
    'Le tue sbirciate ai dati ({peeks}) rendono il numero vero di analisi circa {mult}× più grande di quanto mostri questa curva.',

  // Compact figure vocabulary: a callout has one line, a button has a whole row.
  'reveal.subgroupAll': 'Tutti',
  'reveal.subgroupAgeLt40': 'Età<40',
  'reveal.subgroupAgeGe40': 'Età≥40',
  'reveal.subgroupExpHigh': 'Esperienza alta',
  'reveal.subgroupExpLow': 'Esperienza bassa',
  'reveal.subgroupUrban': 'Urbano',
  'reveal.subgroupRural': 'Rurale',
  'reveal.covNone': 'senza covariate',
  'reveal.covIncome': '+Reddito',
  'reveal.covRisk': '+Rischio',
  'reveal.exclusionNone': 'senza esclusioni',
  'reveal.exclusionZ3': '|z|>3',
  'reveal.exclusionZ25': '|z|>2.5',
  'reveal.exclusionZ2': '|z|>2',
  'reveal.transformRaw': 'grezzo',
  'reveal.transformLog': 'log',
  'reveal.tailsTwo': 'due code',
  'reveal.tailsOne': 'una coda',

  'reveal.retracted': 'RITIRATO',
  'reveal.replicated': 'REPLICATO',
  // §1(j)(2) — le due sentenze che sostituiscono "RISULTATO NULLO".
  //
  // T37 aveva già corretto "NULLO RIPORTATO", che calcava l'ordine inglese e
  // restava senza testa nominale; la stessa cura vale qui. Participio in
  // seconda posizione come RITIRATO/REPLICATO: sono esiti, non azioni.
  //
  // "NULLO CONFERMATO" — il nullo (il risultato) è confermato: la giornata in
  // cui il giocatore aveva ragione. Concorda al maschile singolare con
  // "risultato", sottinteso qui come lo era in T37.
  //
  // "MANCATA SCOPERTA" e non "SCOPERTA MANCATA": in italiano "mancato" in
  // questo senso precede il nome ("mancato pagamento", "mancata consegna");
  // posposto scivolerebbe verso "una scoperta che è mancata", che è un'altra
  // cosa. L'ordine è portante, non stilistico.
  'reveal.confirmedNull': 'NULLO CONFERMATO',
  'reveal.missedDiscovery': 'MANCATA SCOPERTA',
  'reveal.callCorrect': 'Il tuo verdetto era giusto.',
  'reveal.callIncorrect': 'Il tuo verdetto era sbagliato.',
  // Clinical, not apologetic: a preregistered analysis run exactly once is still
  // expected to land here about one day in twenty.
  'reveal.preregFalsePositive':
    "Non è un errore: un'analisi preregistrata, eseguita una volta sola, trova comunque un falso positivo circa il 5% delle volte. Oggi era uno di quei giorni.",

  // The share grid's only localized words. T37 fix round 1 (controller
  // ruling, see share.ts's §2.9 deviation note): line 3 is now
  // "Biforcazioni: 12 · Serie: 7" rather than "12 biforcazioni · serie 7",
  // because the old layout printed "1 biforcazioni" on any one-fork day and
  // this string gets pasted into other people's feeds. Label position, so
  // capitalized. "Biforcazioni" is still the same word the glossary and the
  // fork trail use, so the share string still teaches the term it counts.
  'share.forksWord': 'Biforcazioni',
  'share.streakWord': 'Serie',

  'summary.score': 'Punteggio: {score}',
  'summary.share': 'Condividi',
  'summary.copied': 'Copiato negli appunti',
  // Rule 10: Italian sets a space before a unit symbol, and "min" is the SI
  // symbol for a minute.
  'summary.nextIn': 'Prossimo rompicapo tra {hours} h {minutes} min',
  // Rule 9: Summary renders this unconditionally and the streak counts today,
  // so {n} = 1 is every new player's first day. "Serie di 1 giorni" greeted
  // them. Label-colon-count agrees at every value there is.
  // gr6-031: la parola, però, era sbagliata. Questa riga diceva "Giorni
  // consecutivi" e la pagina Statistiche che si apre un tocco dopo diceva
  // "Serie attuale"/"Serie record", come la stringa condivisa
  // (share.streakWord = "Serie"): due nomi per la stessa cosa, a un tocco di
  // distanza, regressione post-T37 (entrambe le chiavi riscritte in quel giro,
  // mai confrontate). *Serie* è anche quello che dicono i giochi quotidiani
  // italiani. Regola 7 ora lo elenca.
  'summary.streak': 'Serie: {n}',

  'summary.breakdownCallCorrect': 'Verdetto giusto',
  'summary.breakdownCallIncorrect': 'Verdetto sbagliato',
  'summary.breakdownParsimony': 'Bonus parsimonia',
  'summary.breakdownIntegrity': 'Bonus integrità',
  'summary.breakdownMissedDiscovery': 'Scoperta mancata',
  'summary.breakdownTrueDiscovery': 'Scoperta vera',
  'summary.breakdownConfirmedNull': 'Nullo confermato',
  // Luck is not underpowered; the study is.
  'summary.breakdownUnderpoweredLuck': 'Colpo di fortuna sottopotenziato',
  'summary.breakdownFalsePositive': 'Falso positivo',

  'summary.invoiceTitle': 'Fattura',
  // gr6-020 — il blocco che annuncia la Preregistrazione finiva in un pulsante
  // morto e non diceva da nessuna parte dove fosse la porta vera. Ora la
  // porta è nella frase: domani, prima dei dati. "prima di vedere un solo
  // numero" è la formula di prereg.intro e di reveal.accounting2Prereg.
  'summary.preregUpsell':
    'La preregistrazione è sbloccata. Domani potrai sceglierla prima di vedere un solo numero.',
  // gr6-062 — la strada verso la bacheca a cui la giornata ha appena aggiunto
  // qualcosa. Stessa forma di reveal.toSummary ("Vedi la fattura"):
  // imperativo, regola 1, e l'Atto II non commenta chi ci va.
  'summary.viewStats': 'Vedi le tue statistiche',
  'summary.shareFailed': 'Non è stato possibile condividere questo risultato.',
  // T38 — the heading over what today unlocked. NOMINAL (rule 4), not
  // participial: "Sbloccati oggi" is a bare masculine plural participle with
  // nothing on screen to agree with, the same defect T37 fixed in
  // lab.subgroupUrban/Rurale. "Riconoscimenti" is the term
  // stats.achievementsTitle already fixed (rule 7) — an honours board, not a
  // task list — so both places name the same thing. Sentence case (rule 3),
  // no lineetta (rule 11), no token.
  'summary.unlockedToday': 'Riconoscimenti di oggi',

  'prereg.title': 'Preregistrazione',
  // Manuscript register, sincere-bureaucratic, no wink: the form itself is the
  // joke and nothing in its own copy may admit it.
  'prereg.intro':
    "Dichiara l'analisi completa prima di vedere un solo numero. Ogni scelta qui sotto diventa definitiva nel momento in cui invii. Non c'è niente da guardare prima, e oggi non c'è un secondo tentativo.",
  'prereg.commit':
    'Mi impegno solennemente a eseguire e riportare esattamente questa specificazione, qualunque cosa mostri.',
  'prereg.submit': 'Invia la preregistrazione',
  'prereg.locked': 'Bloccata. Nessuna modifica prima di guardare in faccia la verità.',

  'stats.title': 'Le tue statistiche',
  'stats.played': 'Giocate',
  'stats.currentStreak': 'Serie attuale',
  'stats.maxStreak': 'Serie record',
  // The value rendered under it is a rate ("67%"), not a count.
  'stats.callAccuracy': 'Precisione dei verdetti',
  'stats.close': 'Chiudi',
  // gr6-035 — lo stato vuoto del primo giorno: undici blocchi censurati e sei
  // lineette, senza una frase. Registro Atto II: dice che cos'è la schermata e
  // che cosa la riempie, senza incoraggiare né scusarsi.
  // w2-r-011: "ogni cifra inizia a riempirsi" mette il riflessivo su una
  // singola cifra, che quindi si riempie da sé; in italiano è la PAGINA che si
  // riempie. (L'inglese tiene "every figure ... starts filling in", che è
  // idiomatico lì e non ha il riflessivo che qui suona storto.)
  'stats.emptyState': "Qui non c'è ancora niente. Questa pagina inizia a riempirsi dopo la tua prima giornata.",

  'stats.callAccuracyLast20': 'Ultimi 20 verdetti',
  // "contro" is combative; the comparison is neutral.
  'stats.successRateTitle': 'Tasso di successo: hacking vs. preregistrazione',
  // Sentence-initial in its own element, so the capital is correct here.
  'stats.hackModeLabel': 'Modalità Hacking',
  // T37 (rule 7): one name for the mode across all five places it is named.
  'stats.preregModeLabel': 'Modalità Preregistrazione',
  'stats.noData': '—',
  'stats.forkHistogramTitle': 'Biforcazioni al giorno',
  // T37: the histogram is indexed from 0, so "{forks} biforcazioni" had a
  // screen reader saying "1 biforcazioni". Label-colon-count agrees at every
  // value, and "Giocate" reuses stats.played's own word.
  'stats.forkHistogramBar': 'Biforcazioni: {forks}. Giocate: {count}',
  // "Riconoscimenti", not "Obiettivi": the citations below read like award
  // citations, so the wall they hang on is an honours board, not a task list.
  'stats.achievementsTitle': 'Riconoscimenti',
  'stats.locked': 'Riconoscimento bloccato',

  'about.title': "Che cos'è P-hackle",
  // gr6-036 — i quattro titoletti. Sette paragrafi senza segnaletica avevano un
  // argomento vero nell'ordine giusto e nessuna delle sue svolte era visibile.
  // Sentence case (regola 3), niente lineette (regola 11).
  'about.sectionHowItWorks': 'Come funziona',
  'about.sectionNotReal': 'Niente di tutto questo è reale',
  'about.sectionYourData': 'I tuoi dati',
  'about.sectionPriorArt': 'Da dove viene',
  'about.intro':
    "Ogni giorno P-hackle ti serve un dataset sintetico e un'ipotesi ridicola. La cassetta degli attrezzi invece è vera: cambio dell'esito, caccia al sottogruppo, arresto opzionale. Sono gli stessi gradi di libertà del ricercatore che si usano, per distrazione o meno, nella ricerca davvero pubblicata.",
  'about.mechanism':
    "Sotto il cofano è tutto vero. Il dataset di ogni giorno è simulato da un processo generatore dei dati dichiarato (otto variabili latenti correlate, un trattamento con confondimento da età e reddito, quattro famiglie di esiti) e inizializzato dalla data, così ogni giocatore al mondo analizza gli stessi numeri. Le regressioni sono minimi quadrati ordinari. La curva di specificazione è calcolata stimando davvero ogni combinazione di esito, sottogruppo, insieme di covariate, regola di esclusione, trasformazione e scelta delle code. È enumerata, non campionata, e non finta. Nella maggior parte dei giorni l'effetto vero è esattamente zero. Negli altri è piccolo e reale, ed è tutta lì la difficoltà. Anche le giornate sono filtrate prima che tu le giochi: una giornata nulla viene riestratta finché, sul campione iniziale di 200, non arrivano a p < 0.05 fra 30 e 180 delle 1792 analisi possibili, e una giornata con effetto finché l'effetto vero non è rilevabile sia su quel campione iniziale sia sul campione completo di 400. Quel filtro fa pendere la bilancia, ed è dichiarato per lo stesso motivo di tutto il resto qui: quello che una soglia di 0.05 fa passare da sola sta dentro quella banda, quindi nel campione da cui parti c'è sempre qualcosa da trovare. La banda è controllata a 200 e da nessun'altra parte: appena raccogli altri dati il conteggio si muove, a volte parecchio.",
  'about.frozenFork':
    "Una scelta analitica è congelata invece che offerta: gli z-score degli outlier sono calcolati sull'esito trasformato, dentro il sottocampione già filtrato. Anche quella è una biforcazione, e congelarla è a sua volta una decisione. La dichiariamo qui perché le biforcazioni che non vedi sono quelle che fanno il danno.",
  'about.syntheticDisclaimer':
    "Niente in questo gioco è un risultato scientifico. I partecipanti non esistono, i dati nascono nel tuo browser, e le riviste, i DOI, le testate, i titoli e le dichiarazioni sono tutti inventati. Per questo le schede stampa portano la filigrana STAMPA SIMULATA. Gli scenari sono volutamente assurdi e volutamente innocui: da nessuna parte compare un'affermazione medica, nutrizionale o di sanità pubblica, perché uno screenshot viaggia più lontano della sua didascalia.",
  // gr6-027 + gr6-036: la nota adesso enuncia anche la SECONDA convenzione,
  // lo zero iniziale, che è la regola che gr6-027 rende vera in tutto il
  // catalogo e che questa è l'unica frase a dire ad alta voce.
  // w2-r-011: "composte come le compongono" ripeteva il verbo a due parole di
  // distanza.
  'about.decimalNote':
    'Le statistiche qui sono composte come sulle riviste, in ogni lingua: punto decimale, mai virgola (p = 0.049), e sempre lo zero iniziale.',
  'about.dataDisclosure':
    "Le statistiche di traffico sono conteggi di pagina anonimi e senza cookie (Vercel Web Analytics). Nessun cookie, nessun account, nessun dato personale, nessun tracciamento tra siti, nessun banner da chiudere. I tuoi punteggi, le serie, lo storico e la scelta della lingua vivono nella memoria locale del tuo browser e non vengono mai spediti da nessuna parte. Cancellare i dati del browser li elimina per sempre, anche da noi, che non li abbiamo mai avuti.",
  'about.priorArt':
    'P-hackle è un piccolo gioco appoggiato a una grande letteratura. Prende in prestito la sua dimostrazione centrale, e gran parte dei suoi metodi, da lavori che vale la pena leggere direttamente:',
  'about.priorArtFiveThirtyEight':
    'Aschwanden & King (2015), "Hack Your Way to Scientific Glory", FiveThirtyEight. È l\'interattivo a cui questa idea appartiene. Usa dati reali e non offre nessuna verità di riferimento; P-hackle aggiunge un processo generatore dei dati noto, un seme quotidiano e il verdetto tra effetto e rumore.',
  'about.priorArtSpecCurve':
    'Simonsohn, Simmons & Nelson. Analisi della curva di specificazione: il grafico su cui finisce la giornata è, in sostanza, la loro figura.',
  'about.priorArtForkingPaths':
    "Gelman & Loken. Il giardino dei sentieri che si biforcano: non serve nessuna battuta di pesca perché succeda, basta un'analisi che si adatta ai dati che ti è capitato di vedere.",
  'about.priorArtFalsePositive':
    'Simmons, Nelson & Simonsohn (2011), "False-Positive Psychology". È l\'inventario dei gradi di libertà del ricercatore che questa cassetta degli attrezzi implementa, un pulsante alla volta.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson & Rowe (1969). Testare di continuo mentre i dati si accumulano gonfia da solo il tasso di falsi positivi, ed è per questo che ogni lotto in più che raccogli ti viene addebitato quando guardi in faccia la verità.',
  'about.glossaryTitle': 'Glossario',
  'about.contact': 'Domande e segnalazioni di problemi sono benvenute.',

  'about.version': 'Versione {version}',
  'about.sourceLink': 'Codice sorgente su GitHub',

  'legend.title': 'Legenda',
  'legend.explored': 'Specificazione che hai guardato',
  'legend.unexplored': 'Specificazione che non hai guardato',
  // w1-r-008: forma con lo zero iniziale, come reveal.accounting1. Notazione:
  // identica in tutte le lingue (SHARED_WITH_EN).
  'legend.significant': 'p < 0.05',
  'legend.published': 'Quella che hai pubblicato',

  // gr6-030: la Legenda spiegava ogni simbolo e non la PAROLA. "Biforcazioni" è
  // l'unica parola piena che la stringa condivisa stampa, e il concetto girava
  // con quattro nomi. Ora la riga 🍴 definisce il termine di cui è il disegno,
  // e questa introduzione dice come stanno insieme la traccia e i conteggi.
  // §1(i): "a gruppi di cinque" — un lettore che vede uno spazio deve sapere
  // se lo spazio significa qualcosa. Non significa nulla: è una tacca.
  'legend.intro':
    'Come si legge un risultato condiviso. La traccia è un simbolo per mossa, a gruppi di cinque; i conteggi sotto sono le stesse mosse, sommate.',
  // L'elenco fra parentesi è COMPILATO, non decorativo: findMissingSpecKnobs
  // pretende che contenga alla lettera lab.outcome / lab.subgroup /
  // lab.covariates / lab.exclusion / lab.transform / reveal.tailsOne di QUESTA
  // lingua. Riscrivi la frase intorno quanto vuoi; non togliere una manopola.
  'legend.emojiSpec':
    'Una biforcazione: qualunque cambio di specificazione (esito, sottogruppo, covariate, esclusione degli outlier, trasformazione o passaggio a una coda)',
  'legend.emojiSubgroup': 'Cambio del filtro sul sottogruppo',
  'legend.emojiExclusion': "Cambio dell'esclusione degli outlier",
  'legend.emojiTails': 'Passaggio a una coda',
  // T37 — glosse NOMINALI (rule 4), like legend.emojiSpec above. They say what
  // a glyph MEANS inside a shared result that may be someone else's, so a bare
  // participle with a dangling object is not enough.
  'legend.emojiPeek': 'Raccolta di altri dati ("solo un altro lotto")',
  'legend.emojiSubmit': 'Invio per la pubblicazione',
  'legend.emojiAbandon': 'Segnalazione di un risultato nullo',
  'legend.emojiPrereg': 'Preregistrazione (prefisso)',
  'legend.emojiCallCorrect': 'Verdetto giusto',
  'legend.emojiCallIncorrect': 'Verdetto sbagliato',

  // Rule 2: the app is impersonal about itself; no editorial "noi".
  'errors.workerCrash':
    'Qualcosa è andato storto durante la generazione del rompicapo di oggi. Di solito basta ricaricare la pagina.',
  'errors.storageOff':
    'Il tuo browser sta bloccando la memoria locale, quindi i progressi non verranno salvati da una visita alla successiva.',
  // gr6-007 — il controllo che errors.workerCrash promette da sempre.
  // Imperativo (regola 1); una parola, perché la frase sopra dice già a che
  // cosa serve.
  'errors.reload': 'Ricarica',

  // T37: this labels a role="group", and a group label NAMES its group rather
  // than commanding.
  // gr6-026: prima rimandava a nav.localeToggle per la stessa parola. Quella
  // chiave non c'è più (morta), quindi la parola è di questa chiave.
  'a11y.localeToggle': 'Lingua',
  // gr6-067: anche questo etichetta un role="group", e "Cambia tema" faceva
  // annunciare "Cambia tema, gruppo". Stessa classe che T37 aveva corretto per
  // il gruppo della lingua, un controllo più a destra.
  'a11y.themeToggle': 'Tema',
  'a11y.backToGame': 'P-hackle: torna al rompicapo di oggi',
  // T37: "ordinato" agreed with "Grafico", so the sentence said the CHART was
  // sorted; English says the specifications are. Also said "specificazione"
  // twice in one breath. T37's agreement fix is kept: "ordinate" still agrees
  // with "specificazioni".
  // T22 (value change): dropped the published-highlight clause — false on the
  // abandon path. See en/copy.ts for the full reasoning.
  'a11y.specCurveChart': 'Grafico dei p-value di tutte le specificazioni possibili, ordinate dal più piccolo al più grande.',
  // T22: fig. 2's own plate (§2.7.6), which is grouped, not sorted.
  'a11y.specCurveGrouped': 'Grafico dei p-value di tutte le specificazioni possibili, in una colonna per ogni esito misurato.',
  'a11y.dataCut':
    'Grafico a punti del campione attuale: il gruppo di confronto e il gruppo trattato, con ogni punto escluso disegnato come segno barrato.',
  'a11y.shareButton': 'Copia il risultato negli appunti',
  // The target is a dialog, not a window. Still opens with the visible label
  // "Chiudi", so WCAG 2.5.3 stays satisfied.
  'a11y.closeDialog': 'Chiudi la finestra di dialogo',
  'a11y.loading': 'Caricamento del rompicapo di oggi',
};
