// Spanish copy catalog (T20). The CopyKey union lives in ../en/copy and is the
// completeness contract: this record is typed against it, so a key left
// untranslated is a `tsc` error rather than a silent English fallback.
//
// Transcreation rules this file obeys (see ./index.ts's header for the corpus
// ones):
//
//  1. REGISTER. Act I (briefing/lab/published/call) is sincerely enthusiastic;
//     Act II (reveal/summary/stats) is clinical and short. lab.peekFootnote-
//     Armitage stays the only wink anywhere in Act I.
//  2. NOTATION IS NOT PROSE. Statistical decimals keep the decimal POINT *and
//     the leading zero* in every language (about.decimalNote says so out loud,
//     and is translated faithfully rather than adapted): p = 0.049, |z| > 2.5,
//     α = 0.05. The Spanish habit of a decimal comma stops at the edge of a
//     statistic. Since gr6-027 there are no exceptions: `α = .05` in
//     lab.peekFootnoteArmitage was the last one, and owner ruling (b) closed
//     it by amending that string.
//  3. ONE TOKEN, ONCE — and NOT for the reason this file used to give. `t()`
//     (src/i18n/t.ts:33) substitutes with a GLOBAL regex and replaces EVERY
//     occurrence, so a repeated token would not render raw through t(). No
//     translation repeats one all the same, for two reasons that are true:
//     several call sites interpolate with a LITERAL String.replace and do only
//     the first (SpecCurve.tsx:212, published.ts:97, and the UI suites'
//     line-builders), and the EN/ES parity guard compares token SETS, so a
//     duplicate here and not in English would be invisible to it.
//     `es.shape.test.ts` asserts the no-repeat rule directly, which is what
//     makes the set comparison sufficient. Every token English carries is
//     carried here too, in whatever order Spanish word order wants it.
//  4. NO RAYAS. The em-dash budget is inherited from the English corpus rules
//     (tests/content/shape.test.ts). Spanish typography leans on the raya even
//     harder than English does, so these sentences are built out of colons,
//     semicolons and full stops instead. stats.noData's glyph is the only
//     U+2014 in the locale, and it is a "no data" mark, not punctuation.
//
// ES-ES CONVENTION CONTRACT (T37, from the T36 UI-language audit §4a). These
// are the rules an es-ES interface follows, in addition to the register rules
// above. Break one and the string is wrong even if the sentence is not:
//
//   1. ACTIONS TAKE THE INFINITIVE. Every button, link and menu command:
//      "Abrir los datos", "Enviar a publicación", "Compartir", "Cerrar",
//      "Afrontar la verdad". Never a noun phrase, never a tú-imperative, even
//      when the English reads as one.
//   2. THE TÚ-IMPERATIVE IS FOR INSTRUCTIONS, NOT CONTROLS: numbered how-to
//      steps, the goal strip, prose telling the player what to do ("Lee…",
//      "Ajusta…", "Enfréntate…"). A button and a step may share a TERM
//      ("la verdad") without sharing a MOOD.
//   3. REGISTER IS TÚ throughout the chrome, matching the corpus. Never
//      usted, never an impersonal "se" where the player is the subject.
//   4. SENTENCE CASE EVERYWHERE. Only proper nouns, product mode names
//      ("modo Preregistro"), stamps (RETRACTADO, PRENSA SIMULADA) and
//      acronyms take capitals. No English Title Case, ever.
//   5. STATE LABELS ARE NOMINAL OR PARTICIPIAL, not clauses: "Copiado al
//      portapapeles", "Veredicto correcto", "Ya has jugado hoy". Legend
//      glosses are NOMINAL ("Envío a publicación", "Informe de un resultado
//      nulo"), never a third-person preterite, which invents a subject.
//   6. TERMINOLOGY IS FIXED AND MUST NOT DRIFT. Paths are *senderos*; forks
//      are *bifurcaciones*; a spec is *una especificación*; the call is *el
//      veredicto*; the streak is *Racha*, in all four places that name it
//      (summary.streak, stats.currentStreak, stats.maxStreak,
//      share.streakWord — gr6-031: it was named twice, one tap apart, and
//      *Días seguidos* is gone).
//      AMENDED BY gr6-028: this rule used to pin *la revelación* as the name
//      of the screen the day ends on. English retired "the reveal" from player
//      copy — the game never shows anybody that word — so the pin goes with
//      it. The Spanish name for that beat is *la verdad*, which
//      published.faceTruth and lab.howThisWorks.step4 have always used; it is
//      now the only name rather than a carve-out from one. *revelación* must
//      not come back into a value. The `reveal.` KEY prefix is untouched:
//      developers read keys.
//   7. COUNT-BEARING LABELS MUST AGREE AT n = 1. Prefer "Etiqueta: {n}" over
//      "{n} sustantivos"; summary.streak is the worked example, and
//      reveal.accounting2/3 and stats.forkHistogramBar follow it.
//   8. NOTATION IS NOT PROSE (rule 2 of the TRANSCREATION list at the top of
//      this file, not rule 2 of this one): decimal point always, "gl" for
//      degrees of freedom, no thousands separators.
//   9. EM-DASH BUDGET: 0. stats.noData's — is the locale's only U+2014 and is
//      a "no data" mark, not punctuation.
//  10. ARIA STRINGS SOUND LIKE SPEECH, not documentation: a group label names
//      its group ("Idioma"), a button label commands ("Cerrar diálogo"), a
//      figure description is one spoken sentence.
import type { CopyKey } from '../en/copy';

export const copy: Record<CopyKey, string> = {
  'nav.title': 'P-hackle',
  'nav.tagline': 'Un juego diario sobre el jardín de senderos que se bifurcan.',
  // T37: "Acerca de" left a preposition dangling beside "Estadísticas" and
  // "Leyenda"; about.title already completes the phrase where it belongs.
  'nav.about': 'Información',
  'nav.stats': 'Estadísticas',
  'nav.legend': 'Leyenda',
  'nav.play': 'Jugar',
  // gr6-017 — enlace de salto, visible solo cuando recibe el foco. Nombra el
  // DESTINO, como hace cualquier skip link.
  'nav.skipToContent': 'Saltar al contenido principal',
  // gr6-022 — la etiqueta de la sesión de práctica, junto al número del
  // fascículo (que en práctica imprime una raya: src/ui/masthead.ts). Sintagma
  // nominal, no un verbo: nombra un ESTADO en el que está el jugador, no una
  // acción (regla 5). *Partida* es lo que el español llama a una sesión de
  // juego, y evita el falso amigo de "día de prueba", que en español suena a
  // periodo gratuito de una suscripción. La misma cadena aparece en el texto
  // que se comparte: un solo nombre por concepto (regla 6), de modo que lo que
  // el jugador ha leído arriba es lo que leerán los demás.
  'nav.practiceMode': 'Partida de prueba',
  // Endónimos: cada lengua se nombra a sí misma. Idénticos en los tres
  // catálogos a propósito (véase la nota de la unión en inglés): quien busca
  // el italiano busca "Italiano", no "Italiano" traducido a otra cosa.
  'nav.localeNameEn': 'English',
  'nav.localeNameIt': 'Italiano',
  'nav.localeNameEs': 'Español',
  'nav.themePaper': 'Papel',
  'nav.themeDark': 'Oscuro',

  // T37: ACTION, not a topic. The app's primary CTA opens the day's data;
  // "Datos abiertos" named the open-data policy instead of the gesture.
  // Infinitive, per rule 1 of the header.
  'briefing.openData': 'Abrir los datos',
  // "Autor de correspondencia" is the standard masthead formula, and the
  // author is the PLAYER: Grantwell only signs the email (briefing.emailFrom).
  'briefing.correspondingAuthor': 'Autor de correspondencia: Tú',
  'briefing.vol': 'Vol. {volume}, n.º {issue}',
  // Untranslated by design: the joke's realism depends on him being the same
  // Prof. Grantwell in every language.
  'briefing.emailFrom': 'Prof. R. Grantwell',
  'briefing.goal': 'Tu tarea: encontrar un efecto estadísticamente significativo (p < 0.05) y publicarlo.',

  'briefing.modeChooserIntro':
    'El preregistro está desbloqueado. Elige cómo quieres jugar hoy. Un intento por modo.',
  'briefing.playHacking': 'Jugar en modo Hacking',
  'briefing.playPrereg': 'Jugar en modo Preregistro',
  'briefing.alreadyPlayedToday': 'Ya has jugado hoy',
  // gr6-008 — el estado "día terminado" de la portada, en su propio registro
  // y no en el de la factura. Cierto en los dos caminos: quien informa de un
  // resultado nulo también ha terminado el día, así que la frase nombra el día
  // y nunca una publicación. Nominal/participial (regla 5).
  'briefing.finishedToday': 'El puzle de hoy está terminado. Esto es lo que pasó.',
  // La cuenta atrás con el vocabulario de la cabecera: briefing.vol imprime
  // "Vol. 1, n.º 11" dos líneas más arriba, así que el próximo puzle es el
  // próximo NÚMERO. Los mismos dos tokens que summary.nextIn.
  'briefing.finishedNextIn': 'El próximo número llega en {hours} h {minutes} min.',

  'email.from': 'De:',
  'email.subject': 'Asunto:',

  'lab.outcome': 'Variable de resultado',
  'lab.subgroup': 'Subgrupo',
  'lab.covariates': 'Covariables',
  'lab.exclusion': 'Exclusión de atípicos',
  'lab.transform': 'Transformación',
  'lab.tails': 'Colas',
  // T37 fix round 1 (ruling): the audit proposed "Enviar a publicar", and it
  // is idiomatic on its own. In context it was not: it left the locale saying
  // "publicar" here, "publicación" in legend.emojiSubmit and "a publicación"
  // in lab.howThisWorks.step3, for one act. One phrase for one act wins.
  'lab.submit': 'Enviar a publicación',
  'lab.reportNull': 'Informar de un resultado nulo',
  'lab.nLabel': 'n = {n}',
  'lab.collectMore': 'Recoger {n} más',
  // gr6-025 — para qué sirve el botón, junto al botón. Sincero y factual: el
  // recargo llega al afrontar la verdad, y el Acto I no puede pestañear
  // primero. "IC 95%" es el vocabulario que lab.coefPlotCaption ya imprime,
  // así que la frase señala algo que quien juega tiene delante.
  'lab.collectMoreHint': 'Una muestra más grande estrecha el IC 95% de tu estimación.',
  'lab.peekFootnote':
    'Recoger más datos es lo que hace un laboratorio cuidadoso. Cada lote queda registrado para el apartado de métodos.',
  // The one wink Act I is allowed, verbatim in spirit: the citation obligation
  // (master spec §1.4) travels with it. Meant to be easy to miss; do not make
  // it louder, and do not add a second wink anywhere else in Act I.
  // NUEVA DECISIÓN DEL CONTROLLER (w2-r-001) — desviación declarada del texto
  // verbatim de la master spec. La regla (b) pedía "equidistantes", pero su
  // premisa era falsa: el calendario de este juego (200→250→300→350→400) SÍ es
  // equidistante, Δn = 50, y aun así da 11,2% en lugar de 14,2%. La condición
  // real es que los controles caigan en FRACCIONES IGUALES DE LA INFORMACIÓN
  // TOTAL (Armitage: 80/160/240/320/400, el primero ve un quinto de los datos;
  // aquí el primero ve la mitad). Medido con 1.000.000 de simulaciones por
  // calendario: 14,172% Armitage · 11,174% este juego · 8,681% cuando la nota
  // aparece por primera vez. La frase enuncia por tanto el hecho DE LA CITA,
  // con la condición de la que depende, y es IMPERSONAL a propósito: no dice
  // "tus vistazos", porque cinco vistazos aquí son inalcanzables (el máximo es
  // cuatro). No devolverla a la segunda persona.
  // w2-r-012 — EL ORDEN DE PALABRAS ES PORTANTE: "lotes IGUALES de datos", no
  // "lotes de datos iguales". Pospuesto, el adjetivo se engancha al sustantivo
  // más cercano, y "lotes" y "datos" son ambos masculinos plurales: la
  // morfología no desambigua, así que la lectura por defecto pasa a ser "datos
  // iguales" y se pierde la condición (que los lotes son del mismo tamaño). El
  // pin verbatim de shape.test.ts fija este orden.
  // gr6-027: `α = .05` → `α = 0.05`. El cero delante ya no tiene excepciones.
  'lab.peekFootnoteArmitage':
    'Dato curioso: contrastar después de cada uno de cinco lotes iguales de datos convierte α = 0.05 en una tasa de falsos positivos de cerca del 14% (Armitage, 1969).',
  // gr6-096: la cadena antigua abría con `n < 30` y afirmaba así una causa que
  // no podía conocer. MIN_CELL es una de las dos razones por las que una celda
  // no es analizable, y es la que nunca ata (0 puntos de 215.040 enumerados).
  // Ahora informa del estado y se detiene.
  'lab.insufficient': 'No hay datos suficientes para analizar esta submuestra.',
  // gr6-061 — el aviso de que ENVIAR ya es posible, leído una vez por una live
  // region: primero el hecho, después lo que el hecho permite.
  'lab.canPublish': 'Por debajo de 0.05. Puedes enviar este análisis a publicación.',

  'lab.subgroupAll': 'Todos los participantes',
  'lab.subgroupAgeLt40': 'Edad < 40',
  'lab.subgroupAgeGe40': 'Edad ≥ 40',
  'lab.subgroupExpHigh': 'Experiencia alta',
  'lab.subgroupExpLow': 'Experiencia baja',
  // T37: nominal, like their siblings. A bare masculine adjective has nothing
  // to agree with here. reveal.subgroupUrban/Rural stay compact and unchanged.
  'lab.subgroupUrban': 'Zona urbana',
  'lab.subgroupRural': 'Zona rural',

  'lab.covariatesNone': 'Ninguna',
  'lab.covariatesBoth': '{income} + {risk}',

  'lab.exclusionNone': 'Ninguna',
  'lab.exclusionZ3': '|z| > 3',
  'lab.exclusionZ2_5': '|z| > 2.5',
  'lab.exclusionZ2': '|z| > 2',

  'lab.transformRaw': 'Sin transformar',
  'lab.transformLog1p': 'log(1+x)',

  'lab.tailsTwo': 'Dos colas',
  'lab.tailsOne': 'Una cola',

  'lab.pEquals': 'p = {p}',
  'lab.pBelow': 'p < 0.001',
  // "gl" is the standard Spanish abbreviation for grados de libertad.
  'lab.dfLabel': 'gl = {df}',
  'lab.coefPlotCaption': 'Estimación {beta} {unit} (IC 95% de {lo} a {hi})',
  'lab.forkTrailLabel': 'Bifurcaciones hasta ahora',

  // The six methods notes. A colleague describing a control in the register a
  // methods section uses: what it does to the sample or the model, one line,
  // no judgement. None of them may hint that the choice is convenient.
  // gr6-034: "antes de ajustar el modelo" / "Ajusta la variable" traducían
  // "before fitting" / "Fit the outcome", el mismo tecnicismo sin glosar que el
  // inglés ha retirado. Reescritas con palabras que no obligan a buscar nada.
  'lab.explain.outcome': 'La medida que este análisis intenta explicar. Hay cuatro entre las que elegir.',
  'lab.explain.subgroup': 'Ejecuta el análisis sobre un solo grupo de participantes en vez de sobre todos.',
  'lab.explain.covariates':
    'Tiene en cuenta además las diferencias de partida entre personas al comparar los dos grupos.',
  'lab.explain.exclusion': 'Retira de la muestra los valores más extremos antes de que el análisis se ejecute.',
  'lab.explain.transform':
    'Mide la variable de resultado en su propia escala, o comprime sus valores grandes en escala logarítmica.',
  'lab.explain.tails': 'Contrasta el efecto en cualquiera de las dos direcciones, o solo en la prevista.',

  'lab.howThisWorks.title': 'Cómo se juega',
  // gr6-033: el paso 1 mandaba leer una pantalla que quien juega ya ha dejado
  // atrás, el único de los cuatro que no se puede ejecutar desde donde está
  // impreso. Ahora apunta a la pregunta que sigue ahí arriba.
  'lab.howThisWorks.step1': 'Parte de la pregunta de arriba: es a eso a lo que deberían responder los datos de hoy.',
  'lab.howThisWorks.step2': 'Ajusta el análisis hasta que el número grande baje de 0.05.',
  'lab.howThisWorks.step3': 'Envía tu hallazgo a publicación.',
  // Same beat as published.faceTruth and the same TERM ("la verdad"); the mood
  // differs on purpose (T37): that one is a button, this one an instruction.
  // gr6-033: el paso 4 gana el veredicto. §2.6 es el corazón del juego y los
  // cuatro pasos se lo saltaban. "Declara" es el verbo de prereg.intro.
  'lab.howThisWorks.step4': 'Enfréntate a la verdad sobre lo que encontraste, y declara si lo crees.',
  'lab.howThisWorks.dismiss': 'Entendido',

  // The single most important sentence in the app. Plain words: no "hipótesis
  // nula", no "significación", no Greek. Small number = hard to shrug off.
  'lab.dialCaption':
    'Este número dice con qué frecuencia la pura casualidad produciría por sí sola un resultado como el tuyo. Cuanto más pequeño es, más difícil resulta despachar tu resultado como suerte. Por debajo de 0.05, puedes publicar.',

  'lab.coefPlotAxis': 'Efecto estimado ({unit})',
  'lab.coefPlotZero': 'sin efecto',
  'lab.cutControl': 'Grupo de comparación',
  'lab.cutLegendIncluded': 'Analizados: {n}',
  'lab.cutLegendExcluded': 'Excluidos: {n}',
  'lab.cutLegendMean': 'Media del grupo',

  // gr6-032 — "la clave está en…" es exactamente el calco que el comentario de
  // la clave inglesa prohibía: en español *la clave* es la solución o el
  // código, nunca la leyenda de un gráfico, así que la frase prometía una
  // respuesta en lugar de un glosario. gr6-029 reescribió la inglesa entera;
  // esta dice lo que la página Leyenda realmente hace.
  'lab.forkTrailHint': 'Cada símbolo es un movimiento que hiciste. En la página Leyenda están todos explicados.',
  // gr6-029 — el activador del popover del rastro, que antes imprimía
  // `nav.legend`: tres "Leyenda" en veinte palabras para dos cosas distintas.
  // No es el nombre de una página, y ambos se quedan (muestran las mismas 7
  // filas y responden a preguntas distintas): esta es la pregunta que se hace
  // quien mira una fila de símbolos desconocidos.
  'lab.forkTrailKey': 'Qué significan',

  // T37: a BUTTON, so the infinitive (header rule 1). lab.howThisWorks.step4
  // is the same beat and keeps the same TERM ("la verdad"), but it is an
  // instruction, so it keeps the tú-imperative: same noun, different mood.
  'published.faceTruth': 'Afrontar la verdad',
  'published.simulatedPress': 'PRENSA SIMULADA',
  'published.editorsPick': 'Selección del editor',
  'published.doiPrefix': 'DOI:',
  // "et al." is what a Spanish citation actually prints; "y col." would read
  // as a house style nobody uses.
  'published.authors': 'Tú et al.',
  'published.careerPoints': '+{n} puntos de carrera',
  // {n} is altmetricScore(), whose floor is the tier-1 minimum of 40
  // (src/game/published.ts), so plural-only agreement is unconditionally safe
  // in Spanish too. One {n}, once: t() sustituye todas las apariciones (regex
  // global), pero varios sitios interpolan con un String.replace literal y solo
  // hacen la primera. Regla 3 del preámbulo.
  // gr6-065: el adverbio va delante, como en inglés desde este mismo cambio.
  'published.altmetricScore': 'Ya mencionado {n} veces en internet',
  'published.altmetricPercentile': 'En el {pct}% superior de toda la producción científica de la historia',

  // The call is conspiratorial, not accusatory: Act I's last beat. "Ruido que
  // disfracé" is the player's own admission to make.
  // gr6-028: *la revelación* nombraba una pantalla que el juego nunca llama
  // así delante de quien juega. Regla 6 enmendada; aquí la frase ya no nombra
  // ninguna pantalla, igual que la inglesa. Esta cadena es además el
  // aria-label del overlay, así que se lee en voz alta como nombre del diálogo.
  'call.title': 'Antes de descubrirlo…',
  'call.real': 'Un efecto real',
  'call.realSub': 'Esto replicaría.',
  'call.noise': 'Ruido que disfracé',
  'call.noiseSub': 'Esto no replicaría.',
  'call.prompt': 'Entre nosotros: ¿qué crees que has encontrado?',

  // {beta} is always "0.000" here; it is a token only so the numeral can be
  // typeset in mono. Translate around it and leave the digits alone.
  'reveal.truthNull': 'Efecto real sobre todas las variables medidas: {beta}.',
  'reveal.truthEffect': 'Efecto real sobre {outcome} ({unit}): β = {beta}. Sobre las demás, nada.',
  'reveal.fig1': 'Fig. 1',
  'reveal.fig2': 'Fig. 2',
  'reveal.curveCaption':
    'Todas las especificaciones que podrías haber ejecutado, ordenadas por p-valor. La tuya está resaltada.',
  'reveal.curveCaptionAbandoned':
    'Todas las especificaciones que podrías haber ejecutado, ordenadas por p-valor. No se publicó nada.',
  'reveal.publishedRecipe': 'Publicaste: {recipe}',
  // gr6-003: el verbo del modo Preregistro, no el del modo Hacking.
  'reveal.preregisteredRecipe': 'Preregistraste: {recipe}',
  'reveal.groupedCaption': 'Los efectos reales se agrupan. El ruido se dispersa.',
  'reveal.omittedFootnote': '{n} especificaciones tenían demasiado pocos datos para analizarse y no se representan.',
  'reveal.toSummary': 'Ver la factura',
  'reveal.pValue': 'p = {p}',
  'reveal.pValueTiny': 'p < 0.001',
  // gr6-001 / w1-r-001 — "por puro azar" era falso, pero "el resto viene de la
  // confusión" tampoco era cierto: en los días nulos ACEPTADOS el sesgo de
  // confusión explica alrededor del 5% de los resultados significativos,
  // indistinguible de cero, porque el muestreo por rechazo (§3.3) descarta
  // justamente la cola confundida. La medición completa está en la nota de
  // en/copy.ts. La línea afirma ahora tres cosas ciertas: el recuento es lo que
  // produce el umbral por sí solo, no hay efecto, y aun así el diseño no es una
  // prueba limpia.
  // Tres arreglos de lengua de la pasada anterior, conservados: el predicado
  // desnudo "son azar"; la colisión "azar" / "al azar" en doce palabras (ahora
  // "de forma aleatoria"); y "la confusión" a secas, que se lee como confusión
  // cotidiana sin antecedente en pantalla.
  // w1b-001 — EL COMENTARIO CERTIFICABA UN LOCK QUE LA CADENA NO CUMPLÍA. El
  // término establecido es el de about.mechanism, "un tratamiento CONFUNDIDO
  // CON la edad y la renta", y la cadena decía "hay sesgo de confusión CON la
  // edad y la renta", que además fuerza la preposición: un sesgo no es "con"
  // una variable, se está confundido con ella. "así que está confundido con la
  // edad y la renta" arregla las dos cosas a la vez y cita About a la letra
  // (regla 6).
  // w1b-009 — "por sí solo" iba al final y se apoyaba en "veinte". Antepuesto,
  // se apoya sin ambigüedad en "un umbral de 0.05", que es el sujeto del que se
  // dice que basta por sí mismo.
  // Cero rayas (regla 9); punto decimal con cero delante.
  'reveal.accounting1':
    'De {total} análisis posibles, {sig} ({sigPct}%) alcanzan p < 0.05. Ninguno encontró un efecto, porque no lo hay: por sí solo, un umbral de 0.05 deja pasar alrededor de uno de cada veinte. Y ninguno es una prueba limpia: el tratamiento nunca se asignó de forma aleatoria, así que está confundido con la edad y la renta.',
  // w1-r-003: el cierre era un absoluto y chocaba con el pie de la Fig. 2 dos
  // bloques más abajo ("Los efectos reales se agrupan").
  'reveal.accounting1Effect':
    'De {total} análisis posibles, {sig} ({sigPct}%) alcanzan p < 0.05: {trueSig} sobre la variable donde el efecto es real, {otherSig} sobre las variables donde no hay nada. Un p-valor por sí solo no dice cuál es cuál.',
  // T37 — plural safety, rule 7 of the header. {k} floors at 1 (publishing the
  // default specification explores exactly one sendero), so "Exploraste 1
  // senderos" was the common case, not a corner one. Label-colon-count in the
  // two ledger lines; a number-neutral noun phrase with the count in
  // parentheses in the third, which has to keep its sentence shape.
  'reveal.accounting2': 'Senderos que exploraste antes de publicar: {k}.',
  'reveal.accounting2Abandoned': 'Senderos que exploraste antes de informar de un resultado nulo: {k}.',
  // gr6-003 — compromiso, no exploración. El verbo es el que ya usa
  // summary.preregUpsell ("comprométete con un análisis"), regla 6.
  'reveal.accounting2Prereg':
    'Senderos con los que te comprometiste antes de ver un solo número: {k}. No ejecutaste ningún otro.',
  'reveal.accounting3':
    'Quien explora al azar esa misma cantidad de senderos ({k}) encuentra al menos un resultado "significativo" alrededor del {pHitPct}% de las veces.',
  // gr6-002 — la frase anterior describe una búsqueda uniforme al azar, y nadie
  // juega así: quien sigue el p-valor llega a la significación en 3 o 4 pasos.
  // w1-r-004: CONDICIONAL. El juego no mide cómo buscaste, así que no puede
  // afirmarlo. "un mínimo" en vez de "una cota inferior": es una expectativa
  // empírica, no una cota demostrada.
  'reveal.accounting3Directed':
    'Si seguiste el p-valor, no buscaste al azar. La búsqueda dirigida llega antes a la significación, así que la cifra de arriba es un mínimo.',
  // {peeks} floors at 1 (Reveal only renders this line when peeks !== 0), so
  // the count goes in parentheses; "unas … mayor" also stranded a feminine
  // plural determiner on a singular comparative.
  'reveal.peekSurcharge':
    'Tus vistazos a los datos ({peeks}) hacen que el número real de análisis sea aproximadamente {mult}× mayor de lo que muestra esta curva.',

  // Compact recipe vocabulary: a callout has one line, a button has a whole row.
  'reveal.subgroupAll': 'Todos',
  'reveal.subgroupAgeLt40': 'Edad<40',
  'reveal.subgroupAgeGe40': 'Edad≥40',
  'reveal.subgroupExpHigh': 'Experiencia alta',
  'reveal.subgroupExpLow': 'Experiencia baja',
  'reveal.subgroupUrban': 'Urbano',
  'reveal.subgroupRural': 'Rural',
  'reveal.covNone': 'sin covariables',
  'reveal.covIncome': '+Renta',
  'reveal.covRisk': '+Riesgo',
  'reveal.exclusionNone': 'sin exclusiones',
  'reveal.exclusionZ3': '|z|>3',
  'reveal.exclusionZ25': '|z|>2.5',
  'reveal.exclusionZ2': '|z|>2',
  'reveal.transformRaw': 'sin transformar',
  'reveal.transformLog': 'log',
  'reveal.tailsTwo': 'dos colas',
  'reveal.tailsOne': 'una cola',

  'reveal.retracted': 'RETRACTADO',
  'reveal.replicated': 'REPLICADO',
  'reveal.nullReported': 'RESULTADO NULO',
  'reveal.callCorrect': 'Tu veredicto fue correcto.',
  'reveal.callIncorrect': 'Tu veredicto fue erróneo.',
  'reveal.preregFalsePositive':
    'Esto no es un fallo tuyo: un análisis preregistrado, ejecutado exactamente una vez, sigue dando un falso positivo alrededor del 5% de las veces. Hoy tocó.',

  // The share grid's third line. T37 fix round 1 (controller ruling, see
  // share.ts's §2.9 deviation note): it now reads
  // "Bifurcaciones: 12 · Racha: 7" rather than "12 bifurcaciones · racha 7",
  // because the old layout printed "1 bifurcaciones" on any one-fork day and
  // this string gets pasted into other people's feeds. Label position, so
  // capitalized — the one place this locale's sentence-case rule yields, and
  // it yields to a label, not to English Title Case.
  'share.forksWord': 'Bifurcaciones',
  'share.streakWord': 'Racha',

  'summary.score': 'Puntuación: {score}',
  'summary.share': 'Compartir',
  'summary.copied': 'Copiado al portapapeles',
  'summary.nextIn': 'Próximo puzle en {hours} h {minutes} min',
  // Plural-safe BY CONSTRUCTION, not by luck: Summary renders this
  // unconditionally and the streak counts today, so {n} = 1 is the common
  // first-day case. "Racha de 1 días" would greet every new player. A
  // label-colon-count row agrees with every value there is.
  // gr6-031: la palabra, en cambio, estaba mal. Esta línea decía "Días
  // seguidos" y la página Estadísticas que se abre un toque después decía
  // "Racha actual"/"Racha máxima", igual que la cadena que se comparte
  // (share.streakWord = "Racha"): dos nombres para lo mismo, a un toque de
  // distancia, regresión posterior a T37 (ambas claves reescritas en esa ronda,
  // nunca contrastadas). *Racha* es además lo que dicen los juegos diarios en
  // español. La regla 6 ya lo recoge.
  'summary.streak': 'Racha: {n}',

  'summary.breakdownCallCorrect': 'Veredicto correcto',
  'summary.breakdownCallIncorrect': 'Veredicto erróneo',
  'summary.breakdownParsimony': 'Bonificación por parsimonia',
  'summary.breakdownIntegrity': 'Bonificación por integridad',
  'summary.breakdownMissedDiscovery': 'Descubrimiento desaprovechado',
  'summary.breakdownTrueDiscovery': 'Descubrimiento verdadero',
  'summary.breakdownConfirmedNull': 'Nulo confirmado',
  'summary.breakdownUnderpoweredLuck': 'Suerte con poca potencia',
  'summary.breakdownFalsePositive': 'Falso positivo',

  'summary.invoiceTitle': 'Factura',
  // gr6-020 — el bloque que anuncia el Preregistro terminaba en un botón
  // muerto y no decía en ningún sitio dónde estaba la puerta de verdad. Ahora
  // la puerta está en la frase: mañana, antes de los datos. "antes de ver un
  // solo número" es la fórmula de prereg.intro y de reveal.accounting2Prereg.
  'summary.preregUpsell':
    'El preregistro está desbloqueado. Mañana podrás elegirlo antes de ver un solo número.',
  // gr6-062 — la ruta al muro de logros al que el día acaba de añadir algo.
  // Misma forma que reveal.toSummary ("Ver la factura"): infinitivo, regla 1,
  // y el Acto II no comenta a quien va.
  'summary.viewStats': 'Ver tus estadísticas',
  'summary.shareFailed': 'No se ha podido compartir este resultado.',
  // T38 — the heading over what today unlocked. NOMINAL (rule 5), not
  // participial: "Desbloqueados hoy" is a bare masculine plural participle
  // with nothing on screen to agree with, the same defect T37 fixed in
  // lab.subgroupUrban/Rural. "Logros" is also the term stats.achievementsTitle
  // already fixed (rule 6), so the honours wall and this block name the same
  // thing. Sentence case (rule 4), no raya (rule 9), no token.
  'summary.unlockedToday': 'Logros de hoy',

  'prereg.title': 'Preregistro',
  // Manuscript register, sincere and bureaucratic. The form itself is the
  // joke; its own copy never winks.
  'prereg.intro':
    'Declara tu análisis completo antes de ver un solo número. Cada elección de aquí abajo es definitiva en el momento en que la envías. No hay nada que mirar antes, ni un segundo intento hoy.',
  // T37: a preregistration commits you to REPORT the result, not to publish
  // it (EN says "running and reporting"), and "publicar" also collided with
  // lab.submit's "Enviar a publicación", which is a different promise.
  'prereg.commit':
    'Me comprometo solemnemente a ejecutar exactamente esta especificación y a informar de su resultado, muestre lo que muestre.',
  'prereg.submit': 'Enviar preregistro',
  'prereg.locked': 'Registrado. No hay más cambios antes de afrontar la verdad.',

  'stats.title': 'Tus estadísticas',
  'stats.played': 'Partidas',
  'stats.currentStreak': 'Racha actual',
  'stats.maxStreak': 'Racha máxima',
  'stats.callAccuracy': 'Acierto en los veredictos',
  'stats.close': 'Cerrar',
  // gr6-035 — el estado vacío del primer día: once bloques censurados y seis
  // rayas, sin una sola frase. Registro Acto II: dice qué es la pantalla y qué
  // la llena, sin animar ni disculparse.
  // w2-r-011: "las cifras empiezan a llenarse" pone el reflexivo en cada cifra,
  // que pasa a llenarse sola; en español lo que se llena es la PÁGINA. (El
  // inglés conserva "every figure ... starts filling in", idiomático allí.)
  'stats.emptyState': 'Aquí todavía no hay nada. Esta página empieza a llenarse después de tu primer día.',

  'stats.callAccuracyLast20': 'Últimos 20 veredictos',
  'stats.successRateTitle': 'Tasa de éxito: hacking frente a preregistro',
  'stats.hackModeLabel': 'Modo Hacking',
  'stats.preregModeLabel': 'Modo Preregistro',
  'stats.noData': '—',
  'stats.forkHistogramTitle': 'Bifurcaciones por día',
  // T37: the histogram is indexed from 0, so "{forks} bifurcaciones" had a
  // screen reader saying "1 bifurcaciones". Label-colon-count agrees at every
  // value, and "Partidas" reuses stats.played's own word.
  'stats.forkHistogramBar': 'Bifurcaciones: {forks}. Partidas: {count}',
  'stats.achievementsTitle': 'Logros',
  'stats.locked': 'Logro bloqueado',

  'about.title': 'Acerca de P-hackle',
  // gr6-036 — los cuatro titulares de sección. Siete párrafos sin señalizar
  // tenían un argumento real en el orden correcto y ninguno de sus giros se
  // veía. Sentence case (regla 4), sin rayas (regla 9).
  'about.sectionHowItWorks': 'Cómo funciona',
  'about.sectionNotReal': 'Nada de esto es real',
  'about.sectionYourData': 'Tus datos',
  'about.sectionPriorArt': 'De dónde viene esto',
  'about.intro':
    'Cada día, P-hackle te reparte un conjunto de datos sintéticos y una hipótesis ridícula. Las herramientas son reales: cambiar de variable de resultado, ir de compras por los subgrupos, parar de recoger datos cuando conviene. Son los mismos grados de libertad del investigador que se usan, por descuido o no, en investigación publicada de verdad.',
  'about.mechanism':
    'Todo lo que hay bajo el capó es real. El conjunto de datos de cada día se simula a partir de un proceso generador declarado (ocho variables latentes correlacionadas, un tratamiento confundido con la edad y la renta, cuatro familias de variables de resultado) y se siembra con la fecha, de modo que todo el mundo analiza exactamente los mismos números. Las regresiones son mínimos cuadrados ordinarios. La curva de especificación se calcula ejecutando de verdad cada combinación de variable de resultado, subgrupo, conjunto de covariables, regla de exclusión, transformación y elección de colas: está enumerada, no muestreada, y no es un truco. La mayoría de los días el efecto real es exactamente cero. El resto de los días es pequeño y real, que es toda la dificultad. Los días mismos se filtran antes de que los juegues: un día nulo se vuelve a sortear hasta que, en la muestra inicial de 200, entre 30 y 180 de los 1792 análisis posibles alcanzan p < 0.05, y un día con efecto hasta que el efecto real es detectable tanto en esa muestra inicial como en la muestra completa de 400. Ese filtro es poner el dedo en la balanza, y se declara por la misma razón que todo lo demás de aquí: lo que un umbral de 0.05 deja pasar por sí solo cae dentro de esa banda, así que en la muestra con la que empiezas siempre hay algo que encontrar. La banda se comprueba en 200 y en ningún otro sitio: en cuanto recoges más datos el recuento se mueve, a veces bastante.',
  'about.frozenFork':
    'Una decisión analítica está congelada en lugar de ofrecerse: las puntuaciones z de los atípicos se calculan sobre la variable de resultado ya transformada y dentro de la submuestra filtrada. Eso es en sí mismo una bifurcación, y congelarla es en sí misma una decisión. Se declara aquí porque las bifurcaciones que no ves son las que hacen daño.',
  'about.syntheticDisclaimer':
    'Nada de este juego es un hallazgo. Los participantes no existen, los datos se generan en tu navegador, y las revistas, los DOI, los medios, los titulares y las declaraciones son todos inventados. Por eso las tarjetas de prensa llevan la marca de agua PRENSA SIMULADA. Los escenarios son deliberadamente absurdos y deliberadamente inofensivos: en ninguno aparece afirmación médica, nutricional ni de salud pública alguna, porque una captura de pantalla viaja más lejos que su pie de foto.',
  // gr6-027 + gr6-036: la nota enuncia ahora también la SEGUNDA convención, el
  // cero delante, que es la regla que gr6-027 vuelve cierta en todo el catálogo
  // y que esta es la única frase que dice en voz alta.
  // w2-r-011: "se componen como las componen" repetía el verbo a dos palabras
  // de distancia.
  'about.decimalNote':
    'Las estadísticas de aquí se componen como en las revistas, en todos los idiomas: punto decimal, nunca coma (p = 0.049), y siempre con cero delante.',
  'about.dataDisclosure':
    'La analítica son recuentos de visitas anónimos y sin cookies (Vercel Web Analytics). Sin cookies, sin cuentas, sin datos personales, sin seguimiento entre sitios, sin banner que cerrar. Tus puntuaciones, rachas, historial e idioma viven en el almacenamiento local de tu navegador y no se envían a ninguna parte. Si borras los datos de tu navegador desaparecen para siempre, también para nosotros, que nunca los tuvimos.',
  'about.priorArt':
    'P-hackle es un juego pequeño apoyado en una literatura grande. Toma prestada su demostración central, y casi todos sus métodos, de trabajos que merece la pena leer directamente:',
  'about.priorArtFiveThirtyEight':
    'Aschwanden y King (2015), "Hack Your Way to Scientific Glory", FiveThirtyEight. El interactivo dueño de esta idea. Usa datos reales y no ofrece ninguna verdad de referencia; P-hackle añade un proceso generador de datos conocido, una semilla diaria y el veredicto entre efecto y ruido.',
  'about.priorArtSpecCurve':
    'Simonsohn, Simmons y Nelson. Análisis de curva de especificación: el gráfico con el que termina el día es, en esencia, su figura.',
  'about.priorArtForkingPaths':
    'Gelman y Loken. El jardín de senderos que se bifurcan: no hace falta salir de pesca para que esto ocurra, basta con un análisis que se adapte a los datos que te tocó ver.',
  'about.priorArtFalsePositive':
    'Simmons, Nelson y Simonsohn (2011), "False-Positive Psychology". El inventario de grados de libertad del investigador que estas herramientas implementan, un botón cada vez.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson y Rowe (1969). Contrastar una y otra vez a medida que se acumulan datos infla por sí solo la tasa de falsos positivos, y por eso cada lote extra que recoges se te cuenta cuando afrontas la verdad.',
  'about.glossaryTitle': 'Glosario',
  'about.contact': 'Se agradecen preguntas y avisos de errores.',

  'about.version': 'Versión {version}',
  'about.sourceLink': 'Código fuente en GitHub',

  'legend.title': 'Leyenda',
  'legend.explored': 'Especificación que miraste',
  'legend.unexplored': 'Especificación que no miraste',
  // w1-r-008: forma con cero delante, como reveal.accounting1. Notación:
  // idéntica en los tres idiomas (SHARED_WITH_EN).
  'legend.significant': 'p < 0.05',
  'legend.published': 'La que publicaste',

  // gr6-030: la Leyenda explicaba cada símbolo y no la PALABRA.
  // "Bifurcaciones" es la única palabra plena que imprime la cadena que se
  // comparte, y el concepto circulaba con cuatro nombres. Ahora la fila 🍴
  // define el término del que es el dibujo, y esta introducción dice cómo se
  // relacionan el rastro y los recuentos.
  'legend.intro':
    'Cómo se lee un resultado compartido. El rastro es un símbolo por movimiento; los recuentos de debajo son esos mismos movimientos, sumados.',
  // La enumeración entre paréntesis está COMPILADA, no es decorativa:
  // findMissingSpecKnobs exige que contenga literalmente lab.outcome /
  // lab.subgroup / lab.covariates / lab.exclusion / lab.transform /
  // reveal.tailsOne DE ESTE idioma. Reescribe la frase alrededor cuanto
  // quieras; no quites una perilla.
  'legend.emojiSpec':
    'Una bifurcación: cualquier cambio de especificación (variable de resultado, subgrupo, covariables, exclusión de atípicos, transformación o cambio a una cola)',
  'legend.emojiSubgroup': 'Cambio de filtro de subgrupo',
  'legend.emojiExclusion': 'Cambio en la exclusión de atípicos',
  'legend.emojiTails': 'Cambio a una cola',
  // T37 — NOMINAL glosses, all of them. They describe what a glyph MEANS
  // inside a shared result that may be someone else's: a third-person
  // preterite ("Recogió…") invents a subject, and the second person pins the
  // move on whoever is reading. legend.emojiSpec already used this form.
  'legend.emojiPeek': 'Recogida de más datos ("solo un lote más")',
  'legend.emojiSubmit': 'Envío a publicación',
  'legend.emojiAbandon': 'Informe de un resultado nulo',
  'legend.emojiPrereg': 'Preregistro (prefijo)',
  'legend.emojiCallCorrect': 'Veredicto correcto',
  'legend.emojiCallIncorrect': 'Veredicto erróneo',

  'errors.workerCrash': 'Algo ha fallado al generar el puzle de hoy. Recargar suele arreglarlo.',
  'errors.storageOff':
    'Tu navegador está bloqueando el almacenamiento local, así que el progreso no se guardará entre visitas.',
  // gr6-007 — el control que errors.workerCrash lleva prometiendo desde T6.
  // Infinitivo (regla 1); una palabra, porque la frase de arriba ya dice para
  // qué sirve.
  'errors.reload': 'Recargar',
  // EL AVISO DE MEDIANOCHE (w6-r-006, w7-r-003). No dice "recargar", y eso es
  // lo importante: a mitad de partida no hay nada guardado todavía, así que
  // recargar es la acción DESTRUCTIVA, justo la que la regla del cambio de día
  // se niega a hacerle al jugador. Aquí solo se informa. Responde a las dos
  // preguntas que el jugador se hace de verdad, en este orden: el día que
  // estoy jugando sigue contando (sí, como el día en que empezó) y dónde está
  // el puzle de hoy (en ningún sitio: esperando). Tú, sentencia llana, sin
  // raya.
  'errors.newDay':
    'Es un día nuevo. El que estás jugando sigue contando como el día en que empezó; el puzle de hoy te espera cuando termines.',

  // T37: this labels a role="group", and a group label NAMES its group rather
  // than commanding.
  // gr6-026: antes remitía a nav.localeToggle por la misma palabra. Esa clave
  // ya no existe (estaba muerta), así que la palabra es de esta clave.
  'a11y.localeToggle': 'Idioma',
  // gr6-067: esto etiqueta otro role="group", y "Cambiar tema" hacía anunciar
  // "Cambiar tema, grupo". Misma clase que T37 corrigió para el grupo del
  // idioma, un control más a la derecha. Una etiqueta de grupo NOMBRA su grupo.
  // (De paso desaparece la trampa del idioma: "cambiar DE tema" es cambiar de
  // asunto en una conversación, no de ajuste.)
  'a11y.themeToggle': 'Tema',
  'a11y.backToGame': 'P-hackle: volver al puzle de hoy',
  // T22 (value change): dropped the published-highlight clause — false on the
  // abandon path. See en/copy.ts for the full reasoning.
  'a11y.specCurveChart': 'Gráfico del p-valor de todas las especificaciones posibles, ordenadas de menor a mayor.',
  // T22: fig. 2's own plate (§2.7.6), which is agrupado, not ordenado.
  'a11y.specCurveGrouped': 'Gráfico del p-valor de todas las especificaciones posibles, en una columna por cada resultado medido.',
  'a11y.dataCut':
    'Diagrama de puntos de la muestra actual: el grupo de comparación y el grupo tratado, con cada punto excluido dibujado como una marca tachada.',
  'a11y.shareButton': 'Copiar el resultado al portapapeles',
  'a11y.closeDialog': 'Cerrar diálogo',
  'a11y.loading': 'Cargando el puzle de hoy',
};
