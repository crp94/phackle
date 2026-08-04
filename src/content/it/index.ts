// Italian content (T19). A TRANSCREATION of src/content/en: the scenario ids,
// their order, their journalTags, the press tiers and the press scenarioIds
// bindings are identical by contract (tests/content/it.shape.test.ts), but the
// jokes are rewritten to be funny in Italian rather than translated into it.
//
// The authoring rules inherited verbatim from the English module:
//
//  1. REGISTER. Act I (questions, cover stories, headlines, press) is sincere
//     and enthusiastic. Act II (retraction sublines, achievement citations) is
//     clinical and deadpan. The contrast is the comedy; nothing here is smug.
//  2. HARM CHECK. Absurd but benign. No medical, nutritional or public-health
//     claim anywhere, because a screenshot travels further than its caption.
//     Enforced against an ITALIAN lexicon (IT_HARM_LEXICON in the shape test).
//  3. OUTCOME FAMILIES. Fixed engine order: [heavy-tailed, positively skewed,
//     count-like, 1-10 bounded scale]. The count is small (typically 0-8), so
//     index 2 always names something plausible at those magnitudes.
//  4. DIRECTION. The one-tailed test always hypothesizes a POSITIVE direction,
//     so every outcomeLabel is phrased so that MORE of the metric means MORE of
//     the claimed effect. This is the rule Italian makes easiest to break:
//     "Riduzione degli errori" is the natural phrasing and the wrong one, so
//     the labels below consistently name a GAIN ("Guadagno", "Vantaggio",
//     "Accuratezza sopra la media") rather than a drop in the bad thing.
//  5. HEADLINE TOKEN. At most one {effect}, never {n}. The same 19 of 20
//     headlines carry a number as in English; standing-desk-poetry's stays
//     token-free, because forcing a percentage into it would spoil it there
//     exactly as it would in English.
//  6. COHORT SIZE. Cover stories never state the final headcount: the lab opens
//     at N = 200 with a "collect more" button, and a briefing that already
//     announced the total would deflate the optional-stopping fiction before
//     the player ever reached it.
//
// WHAT IS NOT ITALIAN, ON PURPOSE. Journal mastheads and DOIs (src/content/
// journals.ts) stay English because that is where Italian academics actually
// publish; "Reviewer 2" stays Reviewer 2 for the same reason; and Prof.
// Grantwell keeps his name.
import type { LocaleContent } from '../types';
import { copy } from './copy';

export const content: LocaleContent = {
  scenarios: [
    {
      id: 'cat-crypto',
      question: 'Avere un gatto migliora i rendimenti delle criptovalute?',
      coverStory:
        "Una coorte pilota di piccoli investitori è stata reclutata per mettere alla prova un'ipotesi popolare sussurrata da anni nei forum di finanza personale: che avere un gatto eserciti un'influenza calmante e stabilizzatrice sul comportamento di portafoglio. I trader indipendenti registrano lo stato felino accanto a trenta giorni di operazioni, e il reclutamento nei forum è ancora aperto. Il lavoro è finanziato da una fondazione filantropica il cui fondatore possiede quattro gatti e, ci dicono, una prior molto forte.",
      treatmentLabel: 'Possiede un gatto',
      headline: 'Chi ha un gatto ottiene rendimenti superiori del {effect}%, rivela uno studio',
      // Same deliberate divergence from the master spec as the English module:
      // the cover story sells cats as risk-steadying, so MORE volatility and
      // MORE trading would argue AGAINST the claimed effect and break rule 4.
      outcomeLabels: [
        'Rendimento del portafoglio a 30 giorni',
        'Cattura del rialzo rispetto al benchmark',
        'Operazioni in utile a settimana',
        'Calma autovalutata durante un crollo',
      ],
      outcomeUnits: ['%', '% del benchmark', 'operazioni vincenti/settimana', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Tenuta davanti a una candela rossa' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'standing-desk-poetry',
      question: 'Le scrivanie in piedi fanno scrivere poesie migliori ai quadri intermedi?',
      coverStory:
        "L'ergonomia d'ufficio ha passato decenni sulle schiene e sui polsi e quasi niente sull'endecasillabo. Abbiamo dotato una coorte di quadri intermedi di scrivanie regolabili in altezza e, per un intero trimestre fiscale, raccolto tutto quello che hanno scritto nel canale Slack di poesia aziendale. La giuria di ex studenti di Lettere che valuta i testi alla cieca è pagata in pizza.",
      treatmentLabel: 'Usa una scrivania in piedi',
      // No {effect} token, exactly as in English: a number would spoil it.
      headline: 'Le scrivanie in piedi accendono un Rinascimento poetico tra i quadri intermedi',
      outcomeLabels: [
        'Punteggio di qualità della giuria',
        'Densità di metafore',
        'Testi inviati al canale di poesia interno',
        'Profondità autovalutata',
      ],
      outcomeUnits: ['punti', 'metafore/strofa', 'testi/mese', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Propensione al rischio creativo' },
      journalTags: ['workplace', 'creative'],
    },
    {
      id: 'sourdough-marathon',
      question: 'Fare il pane con il lievito madre migliora i tempi in maratona?',
      coverStory:
        "L'allenamento di resistenza è stato studiato fino allo sfinimento. La panificazione no. La nostra ipotesi è comportamentale e non nutrizionale: dodici settimane passate a non avere fretta di far lievitare dovrebbero trasferirsi direttamente alla pazienza che un negative split richiede. Abbiamo reclutato maratoneti amatoriali nelle società podistiche e in un molino cooperativo eccezionalmente disponibile, incrociato i diari del lievito con i tempi del chip, e aspettato. Il molino continua a mandarci gente.",
      treatmentLabel: 'Coltiva un lievito madre',
      headline: 'Chi panifica con il lievito madre migliora del {effect}% il tempo in maratona, riferiscono i ricercatori',
      outcomeLabels: [
        'Guadagno sul primato personale il giorno della gara',
        'Slancio negli ultimi 10K sopra il passo medio di gara',
        'Concorrenti superati negli ultimi 10 km',
        'Pazienza autovalutata in gara',
      ],
      outcomeUnits: ['s/km guadagnati', '% sopra la media di gara', 'concorrenti superati/gara', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Tendenza a partire troppo forte' },
      journalTags: ['fitness', 'lifestyle'],
    },
    {
      id: 'jazz-spreadsheets',
      question: 'Ascoltare jazz riduce gli errori nei fogli di calcolo?',
      coverStory:
        "Gli uffici open space litigano sulla musica di sottofondo da un decennio senza aver mai controllato una cartella di lavoro. Abbiamo dato a un reparto di analisti finanziari una playlist hard bop di 340 ore e lasciato l'altro nel suo solito silenzio, poi passato ogni cella dei modelli trimestrali in uno strumento di revisione indipendente. Agli analisti è stato detto che lo studio riguardava l'illuminazione.",
      treatmentLabel: 'Ascolta jazz mentre lavora',
      headline: 'Il jazz in ufficio associato a fogli di calcolo più puliti del {effect}%',
      outcomeLabels: [
        'Accuratezza della revisione sopra la media del reparto',
        'Sequenza più lunga di celle pulite',
        'Cartelle di lavoro approvate al primo invio',
        'Attenzione al dettaglio autovalutata',
      ],
      outcomeUnits: ['punti percentuali', 'celle', 'cartelle/trimestre', 'scala 1–10'],
      covariateLabels: { income: 'Fascia stipendiale', risk: 'Tolleranza per una formula non verificata' },
      journalTags: ['productivity', 'music'],
    },
    {
      id: 'fern-negotiation',
      question: 'Le felci in ufficio ti rendono un negoziatore più duro?',
      coverStory:
        "Il design biofilico viene venduto ai facility manager solo in nome del benessere. Nessuno ha chiesto che cosa faccia dall'altra parte di un tavolo. Abbiamo messo una singola felce di Boston nell'ufficio di ogni responsabile acquisti che ha accettato di partecipare, l'abbiamo lasciata lì per un intero ciclo di gare, e poi ottenuto le condizioni finali di ogni contratto chiuso. Il permesso è stato concesso in tutti i casi, in parecchi dopo insistenze considerevoli.",
      treatmentLabel: 'Tiene una felce sulla scrivania',
      headline: 'Le felci in ufficio associate a contratti migliori di €{effect}mila',
      outcomeLabels: [
        "Valore strappato sopra l'offerta di partenza",
        'Silenzio più lungo tenuto dopo una controproposta',
        'Concessioni ottenute per trattativa',
        'Durezza valutata dalla controparte',
      ],
      outcomeUnits: ['migliaia di €', 'secondi', 'concessioni/trattativa', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Disponibilità ad alzarsi dal tavolo' },
      journalTags: ['nature', 'workplace'],
    },
    {
      id: 'cold-shower-emails',
      question: 'Le docce fredde rendono le tue email più passivo-aggressive?',
      coverStory:
        'Alla doccia fredda del mattino vengono attribuiti concentrazione, tempra e carattere. Il suo effetto sulla posta in arrivo è del tutto inesplorato. Gli impiegati registrano ogni mattina la temperatura della doccia e acconsentono a far analizzare il tono di sei settimane di posta in uscita; le iscrizioni proseguono a ondate, per quanto lo consenta l\'impianto idraulico. I nostri codificatori lavorano in cieco rispetto alla condizione, e la frase "come da mia precedente email" viene segnalata in automatico, il che li risparmia parecchio.',
      treatmentLabel: 'Fa docce fredde',
      headline: 'Docce fredde legate a un tono in posta più tagliente del {effect}%',
      outcomeLabels: [
        'Indice di passivo-aggressività della posta in uscita',
        'Attesa prima di rispondere a richieste sgradite',
        'Ricorrenze di "come da mia precedente email"',
        'Gelo percepito da chi riceve',
      ],
      outcomeUnits: ['punti indice', 'ore', 'ricorrenze/settimana', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Disinvoltura nel rispondere a tutti' },
      journalTags: ['wellness', 'communication'],
    },
    {
      id: 'horoscope-parking',
      question: "Chi legge l'oroscopo trova parcheggio più in fretta?",
      coverStory:
        'La ricerca sulla mobilità urbana modella la ricerca del parcheggio come un processo razionale. Ci siamo chiesti se non sia invece un atto devozionale. Gli automobilisti installano un registratore che traccia ogni ricerca dall\'ingresso in strada allo spegnimento del motore e dichiarano le loro abitudini con le app del mattino; chi legge il proprio segno prima di mettersi alla guida viene confrontato con chi non lo fa. A nessuno dei due gruppi diciamo che cosa stiamo cercando. Due hanno tirato a indovinare lo stesso, e nessuno dei due c\'è andato vicino.',
      treatmentLabel: "Legge l'oroscopo ogni giorno",
      headline: "Chi legge l'oroscopo risparmia {effect} minuti a settimana per parcheggiare",
      outcomeLabels: [
        "Tempo di ricerca risparmiato sulla media dell'isolato",
        'Vantaggio in distanza sulla più vicina alternativa regolare',
        'Parcheggi riusciti al primo tentativo',
        'Allineamento cosmico autovalutato',
      ],
      outcomeUnits: ['minuti risparmiati', 'metri', 'successi/settimana', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Disinvoltura davanti a un cartello ambiguo' },
      journalTags: ['superstition', 'lifestyle'],
    },
    {
      id: 'mechanical-keyboard-bugs',
      question: 'Le tastiere meccaniche riducono i bug mandati in produzione?',
      coverStory:
        'La letteratura sul feedback tattile si ferma alla velocità di battitura e alla produzione non arriva mai. Con la collaborazione di undici team di sviluppo abbiamo incrociato diciotto mesi di ordini hardware con lo stesso periodo di ticket, trattando ogni cambio di switch come un esperimento naturale. Due partecipanti hanno cambiato tipo di switch a metà studio e sono stati, purtroppo, esclusi. Erano passati entrambi a qualcosa di più silenzioso.',
      treatmentLabel: 'Scrive su una tastiera meccanica',
      headline: 'Tastiere meccaniche associate a rilasci più puliti del {effect}%',
      outcomeLabels: [
        'Codice senza difetti rilasciato per release',
        'Serie più lunga di build verdi',
        'Revisioni approvate senza richieste di modifica',
        'Sicurezza autovalutata al momento del commit',
      ],
      outcomeUnits: ['migliaia di righe', 'ore', 'approvazioni/sprint', 'scala 1–10'],
      covariateLabels: { income: 'Fascia stipendiale', risk: 'Voglia di rilasciare di venerdì' },
      journalTags: ['technology', 'productivity'],
    },
    {
      id: 'dog-economist-stocks',
      question: 'Chi ha un cane con il nome di un economista batte il mercato?',
      coverStory:
        "Il folklore dell'investitore al dettaglio vuole che la convinzione debba pur venire da qualche parte. Abbiamo chiesto ai clienti di alcuni intermediari i nomi dei loro animali e classificato ciascuno a mano contro un elenco di riferimento di economisti (Keynes, Hayek, Ostrom, e un Milton su cui abbiamo discusso per una settimana), poi incrociato la classificazione con due anni di estratti conto certificati. La coda della classificazione non è ancora smaltita.",
      treatmentLabel: 'Cane con il nome di un economista',
      headline: 'Gli investitori con cani intitolati a economisti battono il mercato di {effect} punti',
      outcomeLabels: [
        'Extrarendimento annualizzato sul benchmark',
        'Miglior guadagno su una singola posizione',
        "Titoli che chiudono sopra l'indice",
        'Convinzione autovalutata nella tesi',
      ],
      outcomeUnits: ['punti percentuali', '%', 'titoli/trimestre', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Convinzione che il cane sappia qualcosa' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'full-moon-meetings',
      question: 'Le riunioni durano di più con la luna piena?',
      coverStory:
        "I dati di calendario sono il patrimonio comportamentale più sottoutilizzato dell'impresa moderna. Abbiamo estratto diciotto mesi di riunioni da una società di consulenza di medie dimensioni (orari di fine previsti, orari di fine effettivi, numero di presenti, incontri fissati a seguire) e li abbiamo uniti a un'effemeride lunare. L'ipotesi è stata proposta, in tutta serietà, dall'addetta al calendario, che in passato ci ha già visto giusto.",
      treatmentLabel: 'Tenuta con la luna piena',
      headline: "Le riunioni durano {effect} minuti in più con la luna piena, rivela l'analisi",
      outcomeLabels: [
        "Sforamento oltre l'orario previsto",
        'Divagazione singola più lunga',
        'Follow-up "veloci" fissati a seguire',
        'Sensazione dei presenti che bastasse una email',
      ],
      outcomeUnits: ['minuti', 'minuti', 'follow-up/riunione', 'scala 1–10'],
      covariateLabels: {
        income: 'Fascia stipendiale di chi convoca',
        risk: "Voglia di aggiungere un altro punto all'ordine del giorno",
      },
      journalTags: ['astronomy', 'workplace'],
    },
    {
      id: 'label-maker-inbox',
      question: "Avere un'etichettatrice aiuta ad arrivare a inbox zero?",
      coverStory:
        "La gestione delle informazioni personali è un campo ricco di tassonomie e povero di lavoro sul campo. Ai lavoratori della conoscenza facciamo una sola domanda di selezione (possiede un'etichettatrice?) e poi, con il loro consenso, installiamo una sonda sul client di posta per un trimestre. La sonda conta soltanto metadati. Tre partecipanti ci hanno chiesto di confermarlo due volte; lo abbiamo confermato due volte, volentieri.",
      treatmentLabel: "Possiede un'etichettatrice",
      headline: "Chi ha un'etichettatrice smaltisce il {effect}% in più della posta ogni settimana",
      outcomeLabels: [
        'Tasso settimanale di smaltimento della posta in arrivo',
        'Serie più lunga di giorni a inbox zero',
        'Sottocartelle annidate create',
        'Senso di controllo autovalutato',
      ],
      outcomeUnits: ['% degli arrivi', 'giorni', 'cartelle/mese', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Tolleranza per un badge di non letti' },
      journalTags: ['productivity', 'workplace'],
    },
    {
      id: 'vinyl-dinner-party',
      question: 'I collezionisti di vinili organizzano cene migliori?',
      coverStory:
        'La ricerca sull\'ospitalità ha descritto il menù in modo esaustivo e il giradischi per niente. Chi ospita accetta di far osservare una cena da un assistente di ricerca, presentato agli altri invitati come "un collega di lavoro"; essendo le cene quel che sono, il calendario delle osservazioni corre mesi avanti rispetto all\'analisi. Gli assistenti registrano gli orari di arrivo e di uscita, che cosa portano gli ospiti e che cosa chiedono prima di andarsene. Il vino non viene analizzato; il vino non è, in tutta onestà, più disponibile per l\'analisi.',
      treatmentLabel: 'Possiede una collezione di vinili',
      headline: 'Chi ospita con i vinili trattiene gli invitati {effect} minuti in più, dice lo studio',
      outcomeLabels: [
        'Valore del vino portato spontaneamente dagli ospiti',
        "Tempo passato dagli ospiti oltre l'orario dichiarato",
        'Richieste spontanee della ricetta',
        'Calore della serata valutato dagli ospiti',
      ],
      outcomeUnits: ['€', 'minuti', 'richieste/cena', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Coraggio di provare una ricetta nuova sugli ospiti' },
      journalTags: ['music', 'lifestyle'],
    },
    {
      id: 'telescope-directions',
      question: 'Chi ha un telescopio in giardino sa dare indicazioni migliori?',
      coverStory:
        "La ricerca sull'orientamento si regge quasi per intero su compiti di rotazione mentale da laboratorio. Noi la domanda l'abbiamo portata fuori. Gli assistenti fermano passanti in tre città, chiedono come arrivare a un punto di riferimento a otto minuti a piedi, trascrivono la risposta parola per parola e solo dopo, a debriefing concluso, chiedono se il partecipante possiede un telescopio. I tassi di risposta sono, con nostro sincero stupore, ottimi, e stiamo aggiungendo una quarta città. Chi ha un telescopio, in particolare, è felicissimo che glielo si chieda.",
      treatmentLabel: 'Possiede un telescopio da giardino',
      headline: "Chi ha un telescopio dà indicazioni più efficienti del {effect}% rispetto all'app",
      outcomeLabels: [
        "Guadagno di efficienza del percorso sull'app di navigazione",
        'Dettaglio sui punti di riferimento fornito per risposta',
        'Punti cardinali usati per conversazione',
        'Fiducia nelle indicazioni valutata dal passante',
      ],
      outcomeUnits: ['%', 'parole', 'punti cardinali/conversazione', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Disponibilità a consigliare una scorciatoia' },
      journalTags: ['astronomy', 'communication'],
    },
    {
      id: 'cafe-peer-review',
      question: 'I revisori che lavorano al bar scrivono referaggi più severi?',
      coverStory:
        "La revisione tra pari è il passaggio meno osservato dell'intero processo scientifico, e intendiamo lasciarlo tale per tutti tranne che per noi. Con il consenso dei comitati di due riviste, i referaggi conclusi vengono abbinati al luogo in cui il revisore dichiara di averli scritti, man mano che i comitati li rilasciano. La severità è valutata da un collegio di ex direttori, ognuno dei quali è stato recensito al bar e non se l'è dimenticato.",
      treatmentLabel: 'Fa il referaggio al bar',
      headline: 'I revisori da bar chiedono {effect} esperimenti in più per manoscritto',
      outcomeLabels: [
        'Indice di severità del referaggio',
        'Lunghezza della sezione "rilievi maggiori"',
        'Esperimenti aggiuntivi richiesti',
        'Durezza percepita dagli autori',
      ],
      outcomeUnits: ['punti indice', 'parole', 'esperimenti/referaggio', 'scala 1–10'],
      covariateLabels: { income: 'Fascia stipendiale', risk: 'Disponibilità a proporre il rifiuto' },
      journalTags: ['general', 'workplace'],
    },
    {
      id: 'terms-and-conditions-service',
      question: "Chi legge i termini e le condizioni riceve un'assistenza migliore?",
      coverStory:
        'La ricerca sulla tutela del consumatore dà per scontato che nessuno legga il contratto e proprio per questo non ha mai studiato chi lo legge. Stiamo reclutando clienti che dichiarano di leggere i termini per intero, un gruppo che facciamo una fatica notevole a trovare, e, con il loro permesso, trascriviamo dodici mesi di contatti con l\'assistenza. Sono le trascrizioni più lunghe su cui il nostro laboratorio abbia mai lavorato. I moduli di consenso, per una volta, sono stati letti per intero.',
      treatmentLabel: 'Legge i termini e le condizioni',
      headline: 'Chi legge i termini riceve €{effect} in più di buoni di cortesia',
      outcomeLabels: [
        'Buono di cortesia concesso per reclamo',
        'Lunghezza delle scuse ricevute',
        'Problemi risolti al primo contatto',
        'Sensazione autovalutata di essere presi sul serio',
      ],
      outcomeUnits: ['€', 'parole', 'risoluzioni/trimestre', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Disponibilità a chiedere un responsabile' },
      journalTags: ['communication', 'general'],
    },
    {
      id: 'jigsaw-suitcase-packing',
      question: 'Chi fa i puzzle prepara meglio la valigia?',
      coverStory:
        "La ricerca sul ragionamento spaziale ha prodotto quarant'anni di rotazioni di cubi e quasi nessun bagaglio. La domanda l'abbiamo portata in un aeroporto regionale. Ai viaggiatori si chiede se abbiano completato un puzzle nell'ultimo anno e poi, con il loro permesso e un tavolino pieghevole, si misura il contenuto delle borse contro il volume della borsa. Un gate di partenza si rivela un ambiente di reclutamento insolitamente disponibile: lì nessuno ha altro da fare.",
      treatmentLabel: 'Fa i puzzle',
      headline: 'Chi risolve i puzzle fa entrare il {effect}% in più nella stessa valigia',
      outcomeLabels: [
        'Capacità libera rimasta a valigia chiusa',
        'Viaggio più lungo entrato in un bagaglio a mano',
        'Oggetti recuperati senza disfare la valigia',
        'Preparazione valutata dal compagno di viaggio',
      ],
      outcomeUnits: ['litri', 'giorni', 'oggetti/viaggio', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Disponibilità a viaggiare senza bagaglio in stiva' },
      journalTags: ['lifestyle', 'general'],
    },
    {
      id: 'stairs-small-talk',
      question: 'Chi prende le scale fa conversazione migliore?',
      coverStory:
        "Il progetto di un edificio decide chi incontra chi, ma le conversazioni che ne nascono non vengono quasi mai registrate. In un ufficio di dodici piani abbiamo tracciato la scelta tra scale e ascensore dai dati anonimizzati dei badge e, separatamente, somministrato un questionario di sintonia a ogni coppia di colleghi arrivata insieme su un piano. I partecipanti sapevano del questionario. I partecipanti hanno scoperto dei badge al debriefing, una sequenza che il nostro comitato etico ci ha chiesto di descrivere esattamente con queste parole.",
      treatmentLabel: 'Prende le scale',
      headline: 'Chi prende le scale ottiene il {effect}% in più di sintonia in ufficio',
      outcomeLabels: [
        "Punteggio di sintonia sopra la media dell'edificio",
        'Scambio di chiacchiere più lungo sostenuto',
        'Conversazioni riprese in seguito',
        'Calore percepito dalla controparte',
      ],
      outcomeUnits: ['punti', 'secondi', 'conversazioni/settimana', 'scala 1–10'],
      covariateLabels: { income: 'Fascia stipendiale', risk: 'Coraggio di attaccare bottone con uno sconosciuto' },
      journalTags: ['fitness', 'communication'],
    },
    {
      id: 'sock-folding-punctuality',
      question: 'Chi piega i calzini arriva prima?',
      coverStory:
        "La ricerca sull'uso del tempo ha documentato il pendolarismo in un dettaglio straordinario e il cassetto dei calzini per niente. I partecipanti fotografano come tengono i calzini (piegati, arrotolati o sfusi), e noi incrociamo la classificazione con sei settimane di orari da calendario e da badge. Due codificatori indipendenti valutano le fotografie. Vanno d'accordo molto più spesso di quanto avessimo messo a bilancio, il che è una piccola crisi a sé.",
      treatmentLabel: 'Piega i calzini',
      headline: 'Chi piega i calzini arriva {effect} minuti prima, dice uno studio di sei settimane',
      outcomeLabels: [
        'Minuti di anticipo sugli appuntamenti fissati',
        'Serie ininterrotta più lunga di giorni in orario',
        'Appuntamenti raggiunti in anticipo',
        'Affidabilità valutata dai colleghi',
      ],
      outcomeUnits: ['minuti di anticipo', 'giorni', 'appuntamenti/settimana', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Disinvoltura nel prendere una coincidenza al pelo' },
      journalTags: ['lifestyle', 'workplace'],
    },
    {
      id: 'thirteen-mortgage',
      // TRANSCREATED, not translated: in Italy the unlucky number is 17, not 13
      // (XVII anagrams to VIXI, "I have lived"), and it is 17 that hotels and
      // aeroplanes actually skip. The scenario id stays 'thirteen-mortgage'
      // because ids are a cross-locale contract and never reach the player;
      // the joke is the superstition a reader recognises, so the prose moves.
      // "eptacaidecafobia" is the real Italian word for fear of 17.
      question: 'Chi evita il numero 17 spunta mutui migliori?',
      coverStory:
        "La finanza delle famiglie presume che chi si indebita ottimizzi e tratta la superstizione come rumore attorno a quell'ipotesi. Da mesi somministriamo a chi ha appena acceso un mutuo una batteria di domande sulle preferenze numeriche di tutti i giorni (piani saltati, date evitate, numeri civici rifiutati) e incrociamo il punteggio di eptacaidecafobia che ne esce con le condizioni che hanno davvero firmato. Il broker che quelle condizioni ce le procura ha chiesto di non essere nominato. Manda i suoi saluti.",
      treatmentLabel: 'Evita il numero 17',
      headline: 'Chi evita il 17 strappa {effect} punti base sul mutuo',
      outcomeLabels: [
        'Vantaggio di tasso sulla media di mercato',
        'Sconti sulle spese ottenuti in trattativa',
        'Controproposte ottenute per pratica',
        "Fiducia autovalutata nell'affare",
      ],
      outcomeUnits: ['punti base', '€', 'controproposte/pratica', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: "Disponibilità a lasciar scadere un'offerta" },
      journalTags: ['superstition', 'finance'],
    },
    {
      id: 'browser-tabs-side-projects',
      question: 'Chi non chiude mai le schede del browser porta a termine più progetti personali?',
      coverStory:
        "La ricerca sull'attenzione tratta la scheda aperta come un costo. Noi ci siamo chiesti se non sia un magazzino. Gli sviluppatori installano un'estensione che registra il numero di schede del giorno e nient'altro (un limite che abbiamo accettato per ragioni di reclutamento) e dichiarano ogni progetto personale portato a termine nell'anno successivo, con un link pubblico funzionante richiesto come prova. Il requisito del link ci è costato più partecipanti dell'estensione.",
      treatmentLabel: 'Tiene 40+ schede aperte',
      headline: 'Gli sviluppatori con più schede aperte pubblicano {effect}× più progetti personali',
      outcomeLabels: [
        "Ricavi dai progetti personali nell'anno",
        'Sessione di sviluppo ininterrotta più lunga',
        'Progetti personali pubblicati con link pubblico',
        'Sensazione autovalutata che sia tutto sotto controllo',
      ],
      outcomeUnits: ['€', 'minuti', 'progetti/anno', 'scala 1–10'],
      covariateLabels: { income: 'Reddito familiare', risk: 'Voglia di iniziare prima di finire' },
      journalTags: ['technology', 'creative'],
    },
  ],

  // Prof. Grantwell's flavour bank, ordered by escalating desperation: aphorisms
  // and departmental nudges first, existential dread last. Scenario-agnostic by
  // contract (one bank rotates across all 20 scenarios), so nothing here may
  // name a cat, a fern or a marathon.
  //
  // The satire is relocated into the Italian academy: il preside, la domanda
  // ERC, la commissione di abilitazione, l'assegno di ricerca, il rettore, and
  // two barons who greet each other at conferences. Reviewer 2 stays Reviewer 2
  // — Italian academics say it in English, and the joke depends on that.
  //
  // The pitch line names a FUNDER (the ERC call), never an assessment agency:
  // ANVUR and its kin evaluate output and hand out no money, so pitching
  // "alto rischio, alto guadagno" at one would be a joke about a body that
  // cannot grant the wish. "Alto rischio, alto guadagno" is the ERC's own
  // high-risk/high-gain formula, which is why Grantwell reaches for it.
  grantwell: [
    'Ricorda: un p-value di .06 è solo un p-value di .05 con una pessima gestione del tempo.',
    'Nota per l\'abstract: "preliminare" è una parola che possiamo aggiungere dopo la buona notizia, non prima.',
    'Il preside ha chiesto se il nostro lavoro ha "impatto". Ho detto di sì. Rendilo vero retroattivamente.',
    'La newsletter di dipartimento ha bisogno di una vittoria questo mese. Da stamattina alle nove, la vittoria sei tu.',
    'La dichiarazione di impatto scade prima dei risultati. Scrivila con ottimismo; i risultati li allineiamo dopo.',
    'Reviewer 2 vuole significatività entro venerdì. Il rinnovo dipende da questo. Credo in te (e non ho alternative).',
    'Nella domanda ERC ho scritto che era "alto rischio, alto guadagno". Della seconda parte occupati tu.',
    'Ho liberato il pomeriggio per sentirmi dire che l\'ipotesi ha tenuto. Ti prego di non farmi liberare anche quello di domani.',
    'Due parole prima della tua discussione: "l\'effetto andava nella direzione attesa" è una frase compiuta. Usala.',
    'Questa ipotesi l\'ha scelta il te della triennale. La commissione di abilitazione non ha bisogno di saperlo.',
    'Un gruppo rivale ha pubblicato qualcosa di adiacente la settimana scorsa. Il loro barone e il mio si salutano ai convegni. Siamo tecnicamente in gara. Loro non lo sanno.',
    'La scadenza del convegno è stata anticipata di undici giorni. Statisticamente non cambia niente. Il titolo l\'ho già mandato.',
    'Il comitato etico ha approvato il protocollo. I dati non hanno approvato l\'ipotesi. Procedi lo stesso.',
    'Ho scritto io il comunicato stampa e all\'ufficio comunicazione è piaciuto molto. Due testate hanno già chiesto la data dell\'embargo. Manca solo lo studio.',
    'I partner industriali vengono giovedì. Hanno finanziato una scoperta. Ti prego, abbi scoperto qualcosa.',
    'L\'assegno di ricerca dipende dalla produzione di quest\'anno. Lo dico come contesto, non come pressione. È anche pressione.',
    'La commissione per il periodo sabbatico si riunisce a giugno. Un risultato entro maggio sarebbe decisivo. Voglio essere preciso su quella parola.',
    'Il rettore ha cominciato a dire "revisione del portafoglio della ricerca". Nessuno mi spiega che cosa voglia dire. Io so che vuol dire noi.',
    'Anno tre di tre del finanziamento. Non voglio allarmarti, ma voglio allarmarti un pochino.',
    'Smetti di mandarmi l\'intervallo di confidenza. Mandami la stima puntuale. La stima puntuale non ha mai deluso nessuno.',
    'Reviewer 2 è tornato. Reviewer 2 è la stessa persona dell\'altra volta. Reviewer 2 si ricorda di noi.',
    'Stanotte ho sognato che questo replicava. Scelgo di considerarlo una preregistrazione.',
  ],

  // Simulated press, watermarked STAMPA SIMULATA in the UI. Tier = egregiousness
  // of the published spec: tier 1 is credulous but sober, tier 2 is
  // aggregator-grade, tier 3 is the chyron. The outlets are transcreated, not
  // translated (the journals are not touched at all): "Rete Sottopancia" is
  // named after the actual Italian TV term for a lower-third caption,
  // "Clickeria" puts a clickbait farm behind the same shop-sign suffix as a
  // pizzeria, and the two sober tier-1 mastheads are a provincial "Gazzetta"
  // and a municipal "Bollettino" — the shapes Italian local print actually
  // uses, where a "Ledger" or a "Public Record" would only have been an English
  // naming tradition rendered word-for-word into a language that has no such
  // papers.
  press: [
    {
      text: 'Gli scienziati lo dicono: il tuo gatto potrebbe essere il tuo miglior consulente finanziario.',
      outlet: 'Il Cinguettio del Mattino',
      tier: 1,
      scenarioIds: ['cat-crypto'],
    },
    {
      text: "I ricercatori definiscono l'effetto modesto. La parola non compare in nessun altro punto di questo articolo.",
      outlet: 'La Gazzetta di Provincia',
      tier: 1,
    },
    {
      text: 'Una piccola abitudine, una differenza misurabile: che cosa suggerisce un nuovo studio.',
      outlet: "L'Inserto della Domenica",
      tier: 1,
    },
    {
      text: 'Il risultato è preliminare. I ricercatori dicono che è esattamente per questo che conta.',
      outlet: 'Il Bollettino Civico',
      tier: 1,
    },
    {
      text: 'Sottoposto a revisione tra pari e pubblicato questa settimana: un legame che nessuno aveva pensato di cercare.',
      outlet: 'La Gazzetta di Provincia',
      tier: 1,
    },
    {
      text: 'I ricercatori chiedono ulteriori studi, e ulteriori fondi per condurli.',
      outlet: 'Il Bollettino Civico',
      tier: 1,
    },
    // ==== T39a's scenario-bound blurbs, transcreated in T39b ====================
    // TRANSCREATED, not translated, and specifically not translated from the
    // ENGLISH scenario: each line is rebuilt on the ITALIAN scenario's own
    // furniture, because these outlets are supposed to have read the Italian
    // abstract. So the mortgage blurb counts to 17 and says eptacaidecafobia
    // (this locale's superstition, the English one's is 13), the peer-review
    // chyron ends at a cornetto rather than at an unnamed pastry, the poetry
    // chyron reaches for the endecasillabo the cover story already promised,
    // and the full-moon line credits l'addetta al calendario, who is a woman
    // here. The outlets were mapped in T39a and are untouched.
    //
    // THE SPOILER LAW, restated because it is what makes these hard: the
    // Published screen renders on BOTH day types, so a blurb may riff on the
    // question, on the method and on the cover story's own furniture, and may
    // never say whether the finding is true, false, replicated or withdrawn.
    // Scanned in ITALIAN by it.shape.test.ts's IT_PRESS_SPOILER_LEXICON.
    {
      text: "Due codificatori hanno classificato le fotografie dei calzini separatamente e si sono trovati d'accordo quasi sempre. Gli autori definiscono l'intesa rassicurante.",
      outlet: 'Il Bollettino Civico',
      tier: 1,
      scenarioIds: ['sock-folding-punctuality'],
    },
    {
      text: 'Dodici piani di dati dei badge e un questionario di sintonia. Ai partecipanti è stato detto del questionario; dei badge, al debriefing.',
      outlet: 'La Gazzetta di Provincia',
      tier: 1,
      scenarioIds: ['stairs-small-talk'],
    },
    {
      // Fix round 1 [Minor 2]: the cover story's own "non se l'è dimenticato"
      // was recycled here AND the domain-expertise line stacked on top of it,
      // so the joke was told twice. English traded them; so does this now.
      text: 'La severità è stata valutata da un collegio di ex direttori, ognuno dei quali è stato recensito al bar. Gli autori lo presentano come competenza specifica.',
      outlet: 'Il Bollettino Civico',
      tier: 1,
      scenarioIds: ['cafe-peer-review'],
    },
    {
      text: 'La parte più difficile è stata il reclutamento: prima trovare chi legge il contratto per intero, poi chiedergli di leggere anche il modulo di consenso.',
      outlet: "L'Inserto della Domenica",
      tier: 1,
      scenarioIds: ['terms-and-conditions-service'],
    },
    {
      text: 'La domanda sul telescopio arrivava per ultima, dopo le indicazioni e un debriefing completo. Chi ha un telescopio, annotano gli autori, era felicissimo che glielo si chiedesse.',
      outlet: 'La Gazzetta di Provincia',
      tier: 1,
      scenarioIds: ['telescope-directions'],
    },
    {
      text: "Diciotto mesi di registri di calendario uniti a un'effemeride lunare. L'ipotesi è dell'addetta al calendario, che gli autori citano con orgoglio.",
      outlet: 'Il Bollettino Civico',
      tier: 1,
      scenarioIds: ['full-moon-meetings'],
    },
    {
      text: 'Le valigie di chi fa i puzzle sono state misurate a un gate di partenza, su un tavolino pieghevole. Lì, osservano gli autori, nessuno aveva altro da fare.',
      outlet: "L'Inserto della Domenica",
      tier: 1,
      scenarioIds: ['jigsaw-suitcase-packing'],
    },
    { text: 'Lo strano trucco con cui gli statistici PUBBLICANO.', outlet: 'Lo Scroll Quotidiano', tier: 2 },
    {
      text: 'La tua sedia da ufficio ti sta costando un Premio Strega? Gli esperti si pronunciano.',
      outlet: 'Clamore & Lenzuolo',
      tier: 2,
    },
    { text: 'Lo stai già facendo. La scienza dice di continuare.', outlet: 'Lo Scroll Quotidiano', tier: 2 },
    {
      text: 'Correlazione non è causalità, ma stavolta si sente proprio diverso.',
      outlet: 'Lo Scroll Quotidiano',
      tier: 2,
    },
    {
      text: 'Nove abitudini di chi batte la media. La numero quattro è su una rivista vera.',
      outlet: 'Clickeria',
      tier: 2,
    },
    {
      text: 'Gli scienziati hanno finalmente confermato quello che il tuo gruppo WhatsApp sospettava da sempre.',
      outlet: 'Clamore & Lenzuolo',
      tier: 2,
    },
    {
      text: 'Gli esperti avvertono che lo studio è osservazionale, poi ne parlano per undici minuti.',
      outlet: 'Clickeria',
      tier: 2,
    },
    // T39a's tier-2 additions, transcreated in T39b. Midmarket voice: the
    // outlet has read the abstract and made it about the reader, so every one
    // of these turns on the second person, and on TU rather than Lei (the
    // locale's register rule, ./copy.ts item 2 of the convention contract).
    {
      // Fix round 1 [Minor 1]: "il tuo tempo finale" was both punless and off
      // this scenario's own vocabulary (its outcome is the "Guadagno sul
      // primato personale"). `lievitare` is the transcreated pun: it is what
      // dough does and what a quantity does when it grows. Note the DIRECTION
      // it is pointed in. Applied to a TIME ("quanto lievita il tuo tempo"),
      // lievitare means the time BALLOONED, i.e. the runner got slower, which
      // is the opposite of what this paper claims and would make the outlet
      // sceptical on a screen where Act I outlets are credulous. Pointed at
      // the primato instead, the rise is the good news the paper is selling.
      text: "A lievitare non è solo il pane: c'è anche il tuo primato personale. Il molino cooperativo continua a mandare gente allo studio, e noi siamo andati a chiedere perché.",
      outlet: 'Clickeria',
      tier: 2,
      scenarioIds: ['sourdough-marathon'],
    },
    {
      text: 'La temperatura della tua doccia è nella tua posta in uscita. Sei settimane di email inviate sono state analizzate, e "come da mia precedente email" si è segnalata da sola.',
      outlet: 'Lo Scroll Quotidiano',
      tier: 2,
      scenarioIds: ['cold-shower-emails'],
    },
    {
      text: "È il tuo segno a trovarti il posto? Il registratore parte dall'ingresso in strada e si ferma allo spegnimento del motore, quindi anche il tuo giro peggiore dell'isolato finisce nei dati.",
      outlet: 'Clamore & Lenzuolo',
      tier: 2,
      scenarioIds: ['horoscope-parking'],
    },
    {
      text: "Una sola domanda di selezione: possiedi un'etichettatrice? Quello che è successo dopo a quelle caselle di posta è ora su una rivista con revisione tra pari.",
      outlet: 'Clickeria',
      tier: 2,
      scenarioIds: ['label-maker-inbox'],
    },
    {
      text: 'Quaranta schede aperte non sono un problema: i ricercatori adesso le chiamano magazzino. Ogni progetto doveva arrivare con un link pubblico funzionante, il tuo compreso.',
      outlet: 'Lo Scroll Quotidiano',
      tier: 2,
      scenarioIds: ['browser-tabs-side-projects'],
    },
    {
      text: "A quella cena c'era un ricercatore, presentato agli altri come un collega di lavoro. L'ora in cui te ne sei andato adesso è un dato.",
      outlet: 'Clamore & Lenzuolo',
      tier: 2,
      scenarioIds: ['vinyl-dinner-party'],
    },
    {
      text: "Agli analisti avevano detto che lo studio riguardava l'illuminazione. Riguardava le 340 ore di hard bop nelle loro cuffie, e quello che c'è nelle tue.",
      outlet: 'Clickeria',
      tier: 2,
      scenarioIds: ['jazz-spreadsheets'],
    },
    {
      // 17, and eptacaidecafobia: this locale's scenario relocated the
      // superstition, so its press counts the way its readers do.
      text: 'Che cosa dice del tuo mutuo il tuo punteggio di eptacaidecafobia. Il broker che ha passato le condizioni allo studio manda i suoi saluti.',
      outlet: 'Clamore & Lenzuolo',
      tier: 2,
      scenarioIds: ['thirteen-mortgage'],
    },
    {
      text: 'Due partecipanti sono passati a qualcosa di più silenzioso e sono stati esclusi. Tutti gli altri battono ancora forte per la scienza, e probabilmente anche tu.',
      outlet: 'Lo Scroll Quotidiano',
      tier: 2,
      scenarioIds: ['mechanical-keyboard-bugs'],
    },
    {
      text: 'STUDIO: FELCI = POTERE CONTRATTUALE?',
      outlet: 'Rete Sottopancia',
      tier: 3,
      scenarioIds: ['fern-negotiation'],
    },
    {
      text: "ULTIM'ORA: LE TUE PIANTE DA APPARTAMENTO STANNO GIUDICANDO IL TUO FONDO PENSIONE",
      outlet: 'Rete Sottopancia',
      tier: 3,
      scenarioIds: ['fern-negotiation'],
    },
    {
      text: 'LA SCIENZA CONFERMA: QUELLA COSA CHE FAI È IL MOTIVO PER CUI SUCCEDE TUTTO',
      outlet: 'Rete Sottopancia',
      tier: 3,
    },
    { text: 'UN SOLO NUMERO CAMBIA TUTTO. IL NUMERO È 0.049.', outlet: 'Rete Sottopancia', tier: 3 },
    { text: 'STATISTICAMENTE SIGNIFICATIVO — COSA VUOL DIRE PER LA TUA FAMIGLIA', outlet: 'TG Canale 9', tier: 3 },
    { text: 'NUOVA RICERCA: LO STAI FACENDO MALE? (SÌ)', outlet: 'TG Canale 9', tier: 3 },
    // Spoken aloud by an anchor, so the separator is the WORD "virgola" and not
    // a digit: about.decimalNote's decimal-point rule governs notation, and
    // there is no notation here at all.
    { text: 'P MINORE DI ZERO VIRGOLA ZERO CINQUE — SPIEGHIAMO DOPO LA PUBBLICITÀ', outlet: 'Diretta Notte', tier: 3 },
    {
      text: "ESCLUSIVO: L'UNICA ABITUDINE CHE IL MERCATO NON VUOLE CHE TU MANTENGA",
      outlet: 'Diretta Notte',
      tier: 3,
    },
    // T39a's tier-3 additions, transcreated in T39b. The chyron shouts (the
    // voice law counts capitals, so this is mechanical), and it shouts in
    // sottopancia Italian: short, present tense, no subordinate clause that a
    // lower third could not hold. Accented capitals (È, PIÙ) are outside the
    // ASCII class upperCaseRatio counts and cost nothing.
    {
      text: "STUDIO: SALE LA SCRIVANIA, ESCE L'ENDECASILLABO",
      outlet: 'Rete Sottopancia',
      tier: 3,
      scenarioIds: ['standing-desk-poetry'],
    },
    {
      text: 'IL NOME DEL TUO CANE È UNA STRATEGIA DI PORTAFOGLIO? LO ABBIAMO CHIESTO A UN CANE DI NOME HAYEK',
      outlet: 'TG Canale 9',
      tier: 3,
      scenarioIds: ['dog-economist-stocks'],
    },
    {
      // Fix round 1 [Minor 4]: present tense, per this block's own rule (and
      // per the Spanish twin, which already read ENTRA).
      text: 'ALLARME: IL GATTO ENTRA NEL COMITATO INVESTIMENTI',
      outlet: 'Rete Sottopancia',
      tier: 3,
      scenarioIds: ['cat-crypto'],
    },
    {
      text: 'LA LUNA È PIENA E LA TUA RIUNIONE DELLE QUATTRO NON È ANCORA FINITA',
      outlet: 'Diretta Notte',
      tier: 3,
      scenarioIds: ['full-moon-meetings'],
    },
    {
      // Not "a pastry": an Italian referee at the bar is sitting next to a
      // cornetto, and the whole scenario is built on that bar.
      text: 'ESCLUSIVO: IL REFERAGGIO PIÙ DURO DELLA TUA VITA È STATO SCRITTO ACCANTO A UN CORNETTO',
      outlet: 'TG Canale 9',
      tier: 3,
      scenarioIds: ['cafe-peer-review'],
    },
    {
      text: 'IL CASSETTO DEI CALZINI SA A CHE ORA TI ALZI',
      outlet: 'TG Canale 9',
      tier: 3,
      scenarioIds: ['sock-folding-punctuality'],
    },
    {
      text: "ULTIM'ORA: QUELLI CHE PRENDONO LE SCALE STANNO PARLANDO DI TE",
      outlet: 'Diretta Notte',
      tier: 3,
      scenarioIds: ['stairs-small-talk'],
    },
    {
      text: 'QUARANTA SCHEDE NON SONO CAOS. QUARANTA SCHEDE SONO UN MAGAZZINO.',
      outlet: 'Rete Sottopancia',
      tier: 3,
      scenarioIds: ['browser-tabs-side-projects'],
    },
  ],

  // Act II. Quiet, one sentence, devastating; never a punchline, never smug.
  retractionSublines: [
    "L'effetto era 0.000. È sempre stato 0.000.",
    "Il tuo titolo è stato tolto in silenzio dalla homepage dell'ateneo.",
    'Il preprint non c\'è più. La copia in cache sì.',
    'Il Prof. Grantwell non ha risposto alle richieste di commento.',
    "L'intervallo di confidenza conteneva sempre lo zero. È stato molto paziente al riguardo.",
    'La rivista ha pubblicato una correzione. Questa pagina è la correzione.',
    'Il dataset andava bene. Il dataset è sempre andato bene.',
    'È stata tentata una replica. Non ci è andata vicino.',
    'Tre gruppi hanno provato a riprodurlo. Uno dei tre era il tuo.',
    "Il comunicato stampa è ancora online. È l'unica parte che lo è.",
    'I tuoi coautori hanno chiesto di comparire come "consultati".',
    "Il risultato è sopravvissuto alla revisione tra pari e a nient'altro.",
    "Nessuno l'ha citato. Nessuno l'avrebbe mai citato.",
    'Questa è la versione di riferimento, adesso.',
  ],

  // Award citations, in the register an Italian honours board uses ("Per
  // meriti...", "Per aver..."). Clinical, never congratulatory.
  //
  // T37: the NAMES render as labels on the Stats wall (Stats.tsx's
  // .ph-stats__ach-name), so they are interface strings and follow the
  // locale's sentence-case rule (see ./copy.ts's convention contract, rule 3):
  // Italian capitalises the first word and proper nouns only, titles included.
  // Which is why the canonical Italian Borges title is "Il giardino dei
  // sentieri che si biforcano". "HARKing" (an acronym) and "True Detective" (a
  // proper title) keep their capitals for that reason and no other.
  achievements: {
    first_blood: {
      name: 'Prima firma',
      citation: 'Per il primo articolo che questo laboratorio sia mai riuscito a far passare a un revisore.',
    },
    first_retraction: {
      name: 'Primo ritiro',
      citation: "Per la rapidità con cui la homepage dell'ateneo si è dimenticata di te.",
    },
    harking: {
      name: 'HARKing',
      citation: "Per aver formulato l'ipotesi dopo aver visto i risultati, sapendolo benissimo.",
    },
    one_tailed_bandit: {
      name: 'Il bandito a una coda',
      citation: "Per aver deciso, all'ultimo momento utile, che una sola direzione avesse sempre contato.",
    },
    outlier_surgeon: {
      name: 'Chirurgo degli outlier',
      citation: 'Per meriti nella rimozione di esseri umani scomodi.',
    },
    subgroup_safari: {
      name: 'Safari tra i sottogruppi',
      citation: "Per aver visitato cinque sottogruppi in cerca dell'unico che ti desse ragione.",
    },
    one_more_batch: {
      name: 'Solo un altro lotto',
      citation: 'Per aver raccolto dati finché i dati non hanno collaborato.',
    },
    garden: {
      name: 'Il giardino dei sentieri che si biforcano',
      citation: 'Per aver guardato venticinque specificazioni e pubblicato la più bella.',
    },
    monk: { name: 'Il monaco', citation: 'Per venti giorni passati a non fare niente di tutto questo.' },
    well_actually: {
      name: 'Beh, in realtà',
      citation: 'Per aver pubblicato il rumore, sapendo esattamente che cosa stavi facendo.',
    },
    true_detective: {
      name: 'True Detective',
      citation: 'Per dieci verdetti consecutivi giusti tra segnale e autoinganno.',
    },
  },

  // Standard Italian statistical terminology, not calques: "gradi di libertà
  // del ricercatore", "curva di specificazione", "arresto opzionale". HARKing
  // keeps its English expansion because that is how it is taught in Italian
  // methods courses.
  glossary: [
    {
      term: 'p-hacking',
      def: "Analizzare i dati in modi che gonfiano il tasso di falsi positivi, e poi riportare solo l'analisi che ha superato la soglia di significatività.",
    },
    {
      term: 'Gradi di libertà del ricercatore',
      def: "Le molte piccole scelte apparentemente difendibili di un'analisi (quale esito, quale sottogruppo, quale regola di esclusione), ognuna delle quali sposta il risultato.",
    },
    {
      term: 'Giardino dei sentieri che si biforcano',
      def: 'L\'idea che un solo insieme di dati ammetta molte analisi difendibili, per cui "il" risultato dipende da quale sentiero di quel giardino è stato percorso.',
    },
    {
      term: 'Curva di specificazione',
      def: "Un grafico che riporta, in ordine, la stima (o il p-value) prodotta da ogni specificazione analitica ragionevole, così che l'intero spazio delle decisioni, e non solo quella pubblicata, sia visibile in una volta sola.",
    },
    {
      term: 'HARKing',
      def: 'Hypothesizing After the Results are Known: presentare un risultato trovato a posteriori come se fosse stato previsto in anticipo.',
    },
    {
      term: 'Arresto opzionale',
      def: 'Controllare i risultati man mano che i dati arrivano e fermare la raccolta appena si raggiunge la significatività, il che gonfia il tasso di falsi positivi anche con un test onesto.',
    },
    {
      term: 'Preregistrazione',
      def: "Impegnarsi su un'ipotesi e su un piano di analisi prima di vedere i dati, così che l'analisi non possa adattarsi al risultato.",
    },
    {
      term: 'α / tasso di falsi positivi',
      def: 'La frequenza con cui un test segnala un effetto che in realtà non c\'è, per convenzione tenuta entro il 5%. Questo gioco è costruito apposta per sfondare quel tetto.',
    },
  ],

  copy,
};
