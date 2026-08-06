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
//     2", "outlier", "p-value", "df", "log". Translating those would cost the
//     realism the joke is built on. "Open Data" is allowed as a journal BADGE
//     in prose only; it was never allowed as a button (see briefing.openData).
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
//   7. TERMINOLOGY IS FIXED AND MUST NOT DRIFT. The reveal SCREEN is *la
//      rivelazione*, never *i risultati*, *la schermata finale* or *alla
//      fine*. Paths are *sentieri*; forks are *biforcazioni*; the call is *il
//      verdetto*; the mode is *Preregistrazione*, in all five places that
//      name it.
//      CARVE-OUT: *la verità* is not a fourth name for the screen, it is the
//      shared noun of published.faceTruth and lab.howThisWorks.step4, which
//      are one beat. "Guarda in faccia la verità" is CORRECT and is not to be
//      "fixed" to *rivelazione* by a future pass reading this rule alone.
//   8. ENGLISH ONLY FROM THE ALLOWLIST in item 3 of the "deliberately NOT
//      Italian" list at the top of this file. "brief" is not on it.
//   9. COUNT-BEARING LABELS MUST AGREE AT n = 1: "Giorni consecutivi: {n}",
//      not "Serie di {n} giorni". Check every {n}/{k}/{forks}/{peeks} against
//      its real floor before assuming a plural is safe.
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

  // T37: was 'Open Data', on the reasoning that it is the badge Italian
  // journals print in English on Italian papers. That reasoning was the bug in
  // writing: this key is not the badge, it is the app's primary CTA (the one
  // button a first-time player can press). "Open Data" as a prose badge stays
  // on the allowlist above; "Open Data" as a BUTTON never was. Imperative,
  // per rule 1 of the convention contract.
  'briefing.openData': 'Apri i dati',
  // The PLAYER is the paper's author; Grantwell only sends the email.
  'briefing.correspondingAuthor': 'Autore corrispondente: tu',
  'briefing.vol': 'Vol. {volume}, n. {issue}',
  'briefing.emailFrom': 'Prof. R. Grantwell',
  'briefing.emailSubject': 'Re: la scadenza',
  'briefing.goal': 'Il tuo compito: trovare un effetto statisticamente significativo (p < 0.05) e pubblicarlo.',

  'briefing.modeChooserIntro':
    'La preregistrazione è sbloccata. Scegli come giocare oggi. Un tentativo per modalità.',
  // T37: sentence case (rule 3) — Italian does not capitalise a common noun
  // mid-sentence — and one name for the mode, "Preregistrazione", which is
  // what prereg.title, summary.preregUpsell, briefing.modeChooserIntro and
  // stats.successRateTitle already say (rule 7).
  'briefing.playHacking': 'Gioca in modalità Hacking',
  'briefing.playPrereg': 'Gioca in modalità Preregistrazione',
  'briefing.alreadyPlayedToday': 'Già giocato oggi',

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
  'lab.explain.outcome': 'Quale delle quattro cose che hai misurato prova a spiegare questa analisi.',
  'lab.explain.subgroup': 'Restringe il campione a un solo gruppo di partecipanti prima della stima.',
  'lab.explain.covariates':
    'Tiene conto anche delle differenze di partenza tra le persone nel confronto fra i due gruppi.',
  'lab.explain.exclusion': 'Toglie i valori anomali dal campione attuale prima della stima.',
  'lab.explain.transform': "Stima l'esito sulla sua scala originale, oppure su scala logaritmica.",
  'lab.explain.tails': 'Verifica un effetto in entrambe le direzioni, oppure solo in quella prevista.',

  'lab.howThisWorks.title': 'Come si gioca',
  // "brief" is an anglicism outside this locale's own declared allowlist.
  'lab.howThisWorks.step1': 'Leggi la scheda: la domanda di oggi e i dati che ti hanno consegnato.',
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

  // T37: "ha la chiave" was a literal calque. In Italian a `chiave` is a
  // wrench or a cipher, never a map key — that word IS `legenda`.
  'lab.forkTrailHint': 'Ogni simbolo è una mossa che hai fatto. Il significato di ciascuno è nella pagina Legenda.',

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
  // T37: no editorial "noi" (rule 2), and the reveal screen has one Italian
  // name, *la rivelazione* (rule 7). This string is also the Published
  // overlay's aria-label, so it is read aloud as the dialog's own name.
  'call.title': 'Prima di vedere la rivelazione…',
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
  'reveal.accounting1':
    "Su {total} analisi possibili, {sig} ({sigPct}%) arrivano a p < 0.05. Nessuna ha trovato un effetto, perché non ce n'è: una soglia di 0.05 ne lascia passare circa una su venti da sola. E nessuna è un test pulito: il trattamento non è mai stato assegnato in modo casuale, e c'è confondimento con l'età e il reddito.",
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
  'reveal.accounting3Directed':
    'Se hai seguito il p-value, non hai cercato a caso. La ricerca guidata arriva prima alla significatività, quindi il numero qui sopra è un minimo.',
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
  // T37: "NULLO RIPORTATO" stamped the English word order onto Italian and
  // read as a fragment with no head noun.
  'reveal.nullReported': 'RISULTATO NULLO',
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
  'summary.streak': 'Giorni consecutivi: {n}',
  'summary.playPrereg': 'Prova la modalità Preregistrazione',

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
  'summary.preregUpsell': 'La preregistrazione è sbloccata: impegnati su una sola analisi prima di vedere i dati.',
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
    "Dichiara l'analisi completa prima di vedere un solo numero. Ogni scelta qui sotto diventa definitiva nel momento in cui invii. Non c'è nessuna rivelazione da sbirciare prima, e oggi non c'è un secondo tentativo.",
  'prereg.commit':
    'Mi impegno solennemente a eseguire e riportare esattamente questa specificazione, qualunque cosa mostri.',
  'prereg.submit': 'Invia la preregistrazione',
  'prereg.locked': 'Bloccata. Nessuna modifica fino alla rivelazione.',

  'stats.title': 'Le tue statistiche',
  'stats.played': 'Giocate',
  'stats.currentStreak': 'Serie attuale',
  'stats.maxStreak': 'Serie record',
  // The value rendered under it is a rate ("67%"), not a count.
  'stats.callAccuracy': 'Precisione dei verdetti',
  'stats.avgScore': 'Punteggio medio',
  'stats.close': 'Chiudi',

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
  'about.intro':
    "Ogni giorno P-hackle ti serve un dataset sintetico e un'ipotesi ridicola. La cassetta degli attrezzi invece è vera: cambio dell'esito, caccia al sottogruppo, arresto opzionale. Sono gli stessi gradi di libertà del ricercatore che si usano, per distrazione o meno, nella ricerca davvero pubblicata.",
  'about.mechanism':
    "Sotto il cofano è tutto vero. Il dataset di ogni giorno è simulato da un processo generatore dei dati dichiarato (otto variabili latenti correlate, un trattamento con confondimento da età e reddito, quattro famiglie di esiti) e inizializzato dalla data, così ogni giocatore al mondo analizza gli stessi numeri. Le regressioni sono minimi quadrati ordinari. La curva di specificazione è calcolata stimando davvero ogni combinazione di esito, sottogruppo, insieme di covariate, regola di esclusione, trasformazione e scelta delle code. È enumerata, non campionata, e non finta. Nella maggior parte dei giorni l'effetto vero è esattamente zero. Negli altri è piccolo e reale, ed è tutta lì la difficoltà.",
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
    'Simonsohn, Simmons & Nelson. Analisi della curva di specificazione: il grafico della rivelazione è, in sostanza, la loro figura.',
  'about.priorArtForkingPaths':
    "Gelman & Loken. Il giardino dei sentieri che si biforcano: non serve nessuna battuta di pesca perché succeda, basta un'analisi che si adatta ai dati che ti è capitato di vedere.",
  'about.priorArtFalsePositive':
    'Simmons, Nelson & Simonsohn (2011), "False-Positive Psychology". È l\'inventario dei gradi di libertà del ricercatore che questa cassetta degli attrezzi implementa, un pulsante alla volta.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson & Rowe (1969). Testare di continuo mentre i dati si accumulano gonfia da solo il tasso di falsi positivi, ed è per questo che ogni lotto in più che raccogli ti viene addebitato alla rivelazione.',
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
  'legend.trueEffect': 'Effetto vero',

  'legend.intro': 'Come si legge un risultato condiviso.',
  'legend.emojiSpec':
    'Qualunque cambio di specificazione (esito, sottogruppo, covariate, esclusione degli outlier, trasformazione o passaggio a una coda)',
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

  // T37: this labels a role="group", and a group label NAMES its group rather
  // than commanding. nav.localeToggle already holds exactly this word.
  'a11y.localeToggle': 'Lingua',
  'a11y.themeToggle': 'Cambia tema',
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
