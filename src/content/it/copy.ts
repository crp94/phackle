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
//  1. Statistical notation keeps the decimal POINT (p = 0.049, never 0,049).
//     about.decimalNote says so in Italian and then demonstrates it.
//  2. `{param}` tokens. t() (src/i18n/t.ts) substitutes with String.replace,
//     which rewrites the FIRST occurrence only, so no value below repeats a
//     token — a second {n} would render raw on screen.
//  3. Terms Italian academics genuinely use in English: "Open Data", "Reviewer
//     2", "outlier", "p-value", "log". Translating those would cost the
//     realism the joke is built on.
import type { CopyKey } from '../en/copy';

export const copy: Record<CopyKey, string> = {
  'nav.title': 'P-hackle',
  'nav.tagline': 'Un gioco quotidiano sul giardino dei sentieri che si biforcano.',
  'nav.puzzleNumber': 'Rompicapo #{n}',
  'nav.about': 'Informazioni',
  'nav.stats': 'Statistiche',
  'nav.legend': 'Legenda',
  'nav.play': 'Gioca',
  'nav.localeToggle': 'Lingua',
  // Endonyms: every language names itself, in itself. Identical in all three
  // catalogs on purpose (see the EN union's own note) — an Italian reader
  // looking for Spanish looks for "Español", not for "Spagnolo".
  'nav.localeNameEn': 'English',
  'nav.localeNameIt': 'Italiano',
  'nav.localeNameEs': 'Español',
  'nav.themePaper': 'Carta',
  'nav.themeDark': 'Scuro',

  // "Open Data" is not translated: it is the badge Italian journals themselves
  // print, in English, on Italian papers.
  'briefing.openData': 'Open Data',
  // The PLAYER is the paper's author; Grantwell only sends the email.
  'briefing.correspondingAuthor': 'Autore corrispondente: tu',
  'briefing.vol': 'Vol. {volume}, n. {issue}',
  'briefing.emailFrom': 'Prof. R. Grantwell',
  'briefing.emailSubject': 'Re: la scadenza',
  'briefing.goal': 'Il tuo compito: trovare un effetto statisticamente significativo (p < 0.05) e pubblicarlo.',

  'briefing.modeChooserIntro':
    'La preregistrazione è sbloccata. Scegli come giocare oggi. Un tentativo per modalità.',
  'briefing.playHacking': 'Gioca in Modalità Hacking',
  'briefing.playPrereg': 'Gioca in Modalità Prereg',
  'briefing.alreadyPlayedToday': 'Già giocato oggi',

  'email.from': 'Da:',
  'email.subject': 'Oggetto:',

  'lab.outcome': 'Esito',
  'lab.subgroup': 'Sottogruppo',
  'lab.covariates': 'Covariate',
  // "outlier" is the word Italian methods sections actually print.
  'lab.exclusion': 'Esclusione outlier',
  'lab.transform': 'Trasformazione',
  'lab.tails': 'Code',
  'lab.submit': 'Invia per la pubblicazione',
  'lab.reportNull': 'Riporta un risultato nullo',
  'lab.nLabel': 'n = {n}',
  'lab.collectMore': 'Raccogli altri {n}',
  // Sincere first, wink second. The Armitage line is the only moment in Act I
  // allowed to know what it is looking at; it is meant to be easy to miss.
  'lab.peekFootnote':
    'Raccogliere altri dati è quello che fa un laboratorio diligente. Ogni lotto viene registrato per la sezione metodi.',
  'lab.peekFootnoteArmitage':
    'Curiosità: sbirciare cinque volte con α = .05 gonfia il tasso di falsi positivi fino a circa il 14% (Armitage, 1969).',
  'lab.insufficient': "n < 30. Dati insufficienti per l'analisi.",

  'lab.subgroupAll': 'Tutti i partecipanti',
  'lab.subgroupAgeLt40': 'Età < 40',
  'lab.subgroupAgeGe40': 'Età ≥ 40',
  'lab.subgroupExpHigh': 'Esperienza alta',
  'lab.subgroupExpLow': 'Esperienza bassa',
  'lab.subgroupUrban': 'Urbano',
  'lab.subgroupRural': 'Rurale',

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
  'lab.explain.outcome': 'Quale delle quattro cose che hai misurato questa analisi prova a spiegare.',
  'lab.explain.subgroup': 'Restringe il campione a un solo gruppo di partecipanti prima della stima.',
  'lab.explain.covariates':
    'Tiene conto anche delle differenze di partenza tra le persone nel confronto fra i due gruppi.',
  'lab.explain.exclusion': 'Toglie i valori anomali dal campione attuale prima della stima.',
  'lab.explain.transform': "Stima l'esito sulla sua scala originale, oppure su scala logaritmica.",
  'lab.explain.tails': 'Verifica un effetto in entrambe le direzioni, oppure solo in quella prevista.',

  'lab.howThisWorks.title': 'Come si gioca',
  'lab.howThisWorks.step1': 'Leggi il brief: la domanda di oggi e i dati che ti hanno consegnato.',
  'lab.howThisWorks.step2': "Regola l'analisi finché il numero grande non scende sotto 0.05.",
  'lab.howThisWorks.step3': 'Invia la tua scoperta per la pubblicazione.',
  'lab.howThisWorks.step4': 'Guarda in faccia la verità su quello che hai trovato.',
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

  'lab.forkTrailHint': 'Ogni simbolo è una mossa che hai fatto. La pagina Legenda ha la chiave.',

  'published.faceTruth': 'Guarda in faccia la verità',
  'published.simulatedPress': 'STAMPA SIMULATA',
  'published.editorsPick': 'Scelta della redazione',
  'published.doiPrefix': 'DOI:',
  'published.authors': 'Tu et al.',
  'published.careerPoints': '+{n} punti carriera',
  // {n} is altmetricScore(), whose lowest possible value is the tier-1 floor of
  // 40, so the Italian plural ("volte") is unconditionally safe. One {n} only:
  // t() rewrites the first occurrence and would leave a second one raw.
  'published.altmetricScore': 'Già menzionato {n} volte online',
  // "prodotti della ricerca" is the exact phrase the Italian research-assessment
  // machinery uses for a paper. The bureaucratic noun IS the joke.
  'published.altmetricPercentile': 'Top {n}% di tutti i prodotti della ricerca, di sempre',

  // Act I's last beat and the hinge into Act II: conspiratorial, not accusing.
  // "Rumore che ho vestito bene" is the player's own admission to make.
  'call.title': 'Prima che ti mostriamo la verità…',
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
  // Holds on null days too: niente si addensa, and that is the same lesson read
  // from the other side.
  'reveal.groupedCaption': 'Gli effetti veri si addensano. Il rumore si sparpaglia.',
  'reveal.omittedFootnote': '{n} specificazioni avevano troppo pochi dati per essere stimate e non sono nel grafico.',
  'reveal.toSummary': 'Vedi la fattura',
  'reveal.pValue': 'p = {p}',
  'reveal.pValueTiny': 'p < 0.001',
  'reveal.accounting1': 'Su {total} analisi possibili, {sig} ({sigPct}%) arrivano a p < .05 per puro caso.',
  'reveal.accounting2': 'Hai esplorato {k} sentieri prima di pubblicare.',
  'reveal.accounting2Abandoned': 'Hai esplorato {k} sentieri prima di riportare un risultato nullo.',
  'reveal.accounting3':
    'Un ricercatore che esplora {k} sentieri a caso trova almeno un risultato "significativo" circa il {pHitPct}% delle volte.',
  'reveal.peekSurcharge':
    'Le tue {peeks} sbirciate ai dati rendono il numero vero di analisi circa {mult}× più grande di quanto mostri questa curva.',

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
  'reveal.nullReported': 'NULLO RIPORTATO',
  'reveal.callCorrect': 'Il tuo verdetto era giusto.',
  'reveal.callIncorrect': 'Il tuo verdetto era sbagliato.',
  // Clinical, not apologetic: a preregistered analysis run exactly once is still
  // expected to land here about one day in twenty.
  'reveal.preregFalsePositive':
    "Non è un errore: un'analisi preregistrata, eseguita una volta sola, trova comunque un falso positivo circa il 5% delle volte. Oggi era uno di quei giorni.",

  // The share grid's only localized words. Line 3 renders as
  // "12 biforcazioni · serie 7", which is how an Italian methods nerd would
  // actually post it: "biforcazioni" is the same word the glossary and the
  // fork trail already use, so the share string teaches the term it counts.
  'share.forksWord': 'biforcazioni',
  'share.streakWord': 'serie',

  'summary.score': 'Punteggio: {score}',
  'summary.share': 'Condividi',
  'summary.copied': 'Copiato negli appunti',
  'summary.nextIn': 'Prossimo rompicapo tra {hours}h {minutes}m',
  'summary.streak': 'Serie di {n} giorni',
  'summary.playPrereg': 'Prova la Modalità Prereg',

  'summary.breakdownCallCorrect': 'Verdetto giusto',
  'summary.breakdownCallIncorrect': 'Verdetto sbagliato',
  'summary.breakdownParsimony': 'Bonus parsimonia',
  'summary.breakdownIntegrity': 'Bonus integrità',
  'summary.breakdownMissedDiscovery': 'Scoperta mancata',
  'summary.breakdownTrueDiscovery': 'Scoperta vera',
  'summary.breakdownConfirmedNull': 'Nullo confermato',
  'summary.breakdownUnderpoweredLuck': 'Fortuna sottopotenziata',
  'summary.breakdownFalsePositive': 'Falso positivo',

  'summary.invoiceTitle': 'Fattura',
  'summary.preregUpsell': 'La preregistrazione è sbloccata: impegnati su una sola analisi prima di vedere i dati.',
  'summary.shareFailed': 'Non è stato possibile condividere questo risultato.',

  'prereg.title': 'Preregistrazione',
  // Manuscript register, sincere-bureaucratic, no wink: the form itself is the
  // joke and nothing in its own copy may admit it.
  'prereg.intro':
    "Dichiara l'analisi completa prima di vedere un solo numero. Ogni scelta qui sotto diventa definitiva nel momento in cui invii. Non c'è nessun risultato da sbirciare prima, e oggi non c'è un secondo tentativo.",
  'prereg.commit':
    'Mi impegno solennemente a eseguire e riportare esattamente questa specificazione, qualunque cosa mostri.',
  'prereg.submit': 'Invia la preregistrazione',
  'prereg.locked': 'Bloccata. Nessuna modifica fino ai risultati.',

  'stats.title': 'Le tue statistiche',
  'stats.played': 'Giocate',
  'stats.currentStreak': 'Serie attuale',
  'stats.maxStreak': 'Serie record',
  'stats.callAccuracy': 'Verdetti giusti',
  'stats.avgScore': 'Punteggio medio',
  'stats.close': 'Chiudi',

  'stats.callAccuracyLast20': 'Ultimi 20 verdetti',
  'stats.successRateTitle': 'Tasso di successo: hacking contro preregistrazione',
  'stats.hackModeLabel': 'Modalità Hacking',
  'stats.preregModeLabel': 'Modalità Prereg',
  'stats.noData': '—',
  'stats.forkHistogramTitle': 'Biforcazioni al giorno',
  'stats.forkHistogramBar': '{forks} biforcazioni: {count}',
  // "Riconoscimenti", not "Obiettivi": the citations below read like award
  // citations, so the wall they hang on is an honours board, not a task list.
  'stats.achievementsTitle': 'Riconoscimenti',
  'stats.locked': 'Riconoscimento bloccato',

  'about.title': "Che cos'è P-hackle",
  'about.intro':
    "Ogni giorno P-hackle ti serve un dataset sintetico e un'ipotesi ridicola. La cassetta degli attrezzi invece è vera: cambio dell'esito, caccia al sottogruppo, arresto opzionale. Sono gli stessi gradi di libertà del ricercatore che si usano, per distrazione o meno, nella ricerca davvero pubblicata.",
  'about.mechanism':
    "Sotto il cofano è tutto vero. Il dataset di ogni giorno è simulato da un processo generatore dei dati dichiarato (otto variabili latenti correlate, un trattamento confuso con età e reddito, quattro famiglie di esiti) e inizializzato dalla data, così ogni giocatore al mondo analizza gli stessi numeri. Le regressioni sono minimi quadrati ordinari. La curva di specificazione è calcolata stimando davvero ogni combinazione di esito, sottogruppo, insieme di covariate, regola di esclusione, trasformazione e scelta delle code. È enumerata, non campionata, e non finta. Nella maggior parte dei giorni l'effetto vero è esattamente zero. Negli altri è piccolo e reale, ed è tutta lì la difficoltà.",
  'about.frozenFork':
    "Una scelta analitica è congelata invece che offerta: gli z-score degli outlier sono calcolati sull'esito trasformato, dentro il sottocampione già filtrato. Anche quella è una biforcazione, e congelarla è a sua volta una decisione. La dichiariamo qui perché le biforcazioni che non vedi sono quelle che fanno il danno.",
  'about.syntheticDisclaimer':
    "Niente in questo gioco è un risultato scientifico. I partecipanti non esistono, i dati nascono nel tuo browser, e le riviste, i DOI, le testate, i titoli e le dichiarazioni sono tutti inventati. Per questo le schede stampa portano la filigrana STAMPA SIMULATA. Gli scenari sono volutamente assurdi e volutamente innocui: da nessuna parte compare un'affermazione medica, nutrizionale o di sanità pubblica, perché uno screenshot viaggia più lontano della sua didascalia.",
  'about.decimalNote': 'La notazione statistica usa sempre il punto decimale (p = 0.049), in ogni lingua.',
  'about.dataDisclosure':
    "Le statistiche di traffico sono conteggi di pagina anonimi e senza cookie (Vercel Web Analytics). Nessun cookie, nessun account, nessun dato personale, nessun tracciamento tra siti, nessun banner da chiudere. I tuoi punteggi, le serie, lo storico e la scelta della lingua vivono nella memoria locale del tuo browser e non vengono mai spediti da nessuna parte. Cancellare i dati del browser li elimina per sempre, anche da noi, che non li abbiamo mai avuti.",
  'about.priorArt':
    'P-hackle è un piccolo gioco appoggiato a una grande letteratura. Prende in prestito la sua dimostrazione centrale, e gran parte dei suoi metodi, da lavori che vale la pena leggere direttamente:',
  'about.priorArtFiveThirtyEight':
    'Aschwanden & King (2015), "Hack Your Way to Scientific Glory", FiveThirtyEight. È l\'interattivo a cui questa idea appartiene. Usa dati reali e non offre nessuna verità di riferimento; P-hackle aggiunge un processo generatore dei dati noto, un seme quotidiano e il verdetto tra effetto e rumore.',
  'about.priorArtSpecCurve':
    "Simonsohn, Simmons & Nelson. Analisi della curva di specificazione: il grafico della schermata finale è, in sostanza, la loro figura.",
  'about.priorArtForkingPaths':
    "Gelman & Loken. Il giardino dei sentieri che si biforcano: non serve nessuna battuta di pesca perché succeda, basta un'analisi che si adatta ai dati che ti è capitato di vedere.",
  'about.priorArtFalsePositive':
    'Simmons, Nelson & Simonsohn (2011), "False-Positive Psychology". È l\'inventario dei gradi di libertà del ricercatore che questa cassetta degli attrezzi implementa, un pulsante alla volta.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson & Rowe (1969). Testare di continuo mentre i dati si accumulano gonfia da solo il tasso di falsi positivi, ed è per questo che ogni lotto in più che raccogli ti viene addebitato alla fine.',
  'about.glossaryTitle': 'Glossario',
  'about.contact': 'Domande e segnalazioni di problemi sono benvenute.',

  'about.version': 'Versione {version}',
  'about.sourceLink': 'Codice sorgente su GitHub',

  'legend.title': 'Legenda',
  'legend.explored': 'Specificazione che hai guardato',
  'legend.unexplored': 'Specificazione che non hai guardato',
  'legend.significant': 'p < .05',
  'legend.published': 'Quella che hai pubblicato',
  'legend.trueEffect': 'Effetto vero',

  'legend.intro': 'Come si legge un risultato condiviso.',
  'legend.emojiSpec':
    'Qualunque cambio di specificazione (esito, sottogruppo, covariate, esclusione outlier, trasformazione o passaggio a una coda)',
  'legend.emojiSubgroup': 'Cambio del filtro sul sottogruppo',
  'legend.emojiExclusion': "Cambio dell'esclusione degli outlier",
  'legend.emojiTails': 'Passaggio a una coda',
  'legend.emojiPeek': 'Raccolti altri dati ("solo un altro lotto")',
  'legend.emojiSubmit': 'Inviato per la pubblicazione',
  'legend.emojiAbandon': 'Riportato un risultato nullo',
  'legend.emojiPrereg': 'Preregistrato (prefisso)',
  'legend.emojiCallCorrect': 'Verdetto giusto',
  'legend.emojiCallIncorrect': 'Verdetto sbagliato',

  'errors.workerCrash':
    'Qualcosa è andato storto mentre generavamo il rompicapo di oggi. Di solito basta ricaricare la pagina.',
  'errors.storageOff':
    'Il tuo browser sta bloccando la memoria locale, quindi i progressi non verranno salvati da una visita alla successiva.',

  'a11y.localeToggle': 'Cambia lingua',
  'a11y.themeToggle': 'Cambia tema',
  'a11y.backToGame': 'P-hackle: torna al rompicapo di oggi',
  'a11y.specCurveChart':
    'Grafico del p-value di ogni specificazione possibile, ordinato, con evidenziata la specificazione che hai pubblicato.',
  'a11y.dataCut':
    'Grafico a punti del campione attuale: il gruppo di confronto e il gruppo trattato, con ogni punto escluso disegnato come segno barrato.',
  'a11y.shareButton': 'Copia negli appunti il risultato da condividere',
  'a11y.closeDialog': 'Chiudi la finestra',
  'a11y.loading': 'Caricamento del rompicapo di oggi',
};
