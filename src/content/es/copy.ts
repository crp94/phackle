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
//  2. NOTATION IS NOT PROSE. Statistical decimals keep the decimal POINT in
//     every language (about.decimalNote says so out loud, and is translated
//     faithfully rather than adapted): p = 0.049, |z| > 2.5, α = .05. The
//     Spanish habit of a decimal comma stops at the edge of a statistic.
//  3. ONE TOKEN, ONCE. t() (src/i18n/t.ts) substitutes with String.replace,
//     which rewrites the FIRST occurrence only, so no translation may repeat a
//     {token}. Every token English carries is carried here too, in whatever
//     order Spanish word order wants it.
//  4. NO RAYAS. The em-dash budget is inherited from the English corpus rules
//     (tests/content/shape.test.ts). Spanish typography leans on the raya even
//     harder than English does, so these sentences are built out of colons,
//     semicolons and full stops instead. stats.noData's glyph is the only
//     U+2014 in the locale, and it is a "no data" mark, not punctuation.
import type { CopyKey } from '../en/copy';

export const copy: Record<CopyKey, string> = {
  'nav.title': 'P-hackle',
  'nav.tagline': 'Un juego diario sobre el jardín de senderos que se bifurcan.',
  'nav.puzzleNumber': 'Puzle n.º {n}',
  'nav.about': 'Acerca de',
  'nav.stats': 'Estadísticas',
  'nav.legend': 'Leyenda',
  'nav.localeToggle': 'Idioma',
  'nav.themePaper': 'Papel',
  'nav.themeDark': 'Oscuro',

  'briefing.openData': 'Datos abiertos',
  // "Autor de correspondencia" is the standard masthead formula, and the
  // author is the PLAYER: Grantwell only signs the email (briefing.emailFrom).
  'briefing.correspondingAuthor': 'Autor de correspondencia: Tú',
  'briefing.vol': 'Vol. {volume}, n.º {issue}',
  // Untranslated by design: the joke's realism depends on him being the same
  // Prof. Grantwell in every language.
  'briefing.emailFrom': 'Prof. R. Grantwell',
  'briefing.emailSubject': 'Re: lo del plazo',
  'briefing.goal': 'Tu tarea: encontrar un efecto estadísticamente significativo (p < 0.05) y publicarlo.',

  'briefing.modeChooserIntro': 'El preregistro está desbloqueado. Elige cómo juegas hoy. Un intento por modo.',
  'briefing.playHacking': 'Jugar en modo Hacking',
  'briefing.playPrereg': 'Jugar en modo Preregistro',
  'briefing.alreadyPlayedToday': 'Ya has jugado hoy',

  'email.from': 'De:',
  'email.subject': 'Asunto:',

  'lab.outcome': 'Variable de resultado',
  'lab.subgroup': 'Subgrupo',
  'lab.covariates': 'Covariables',
  'lab.exclusion': 'Exclusión de atípicos',
  'lab.transform': 'Transformación',
  'lab.tails': 'Colas',
  'lab.submit': 'Enviar a publicación',
  'lab.reportNull': 'Informar de un resultado nulo',
  'lab.nLabel': 'n = {n}',
  'lab.collectMore': 'Recoger {n} más',
  'lab.peekFootnote':
    'Recoger más datos es lo que hace un laboratorio cuidadoso. Cada lote queda registrado para el apartado de métodos.',
  // The one wink Act I is allowed, verbatim in spirit: the citation obligation
  // (master spec §1.4) travels with it. Meant to be easy to miss; do not make
  // it louder, and do not add a second wink anywhere else in Act I.
  'lab.peekFootnoteArmitage':
    'Dato curioso: asomarse cinco veces con α = .05 infla tu tasa de falsos positivos hasta cerca del 14% (Armitage, 1969).',
  'lab.insufficient': 'n < 30. No hay datos suficientes para analizar.',

  'lab.subgroupAll': 'Todos los participantes',
  'lab.subgroupAgeLt40': 'Edad < 40',
  'lab.subgroupAgeGe40': 'Edad ≥ 40',
  'lab.subgroupExpHigh': 'Experiencia alta',
  'lab.subgroupExpLow': 'Experiencia baja',
  'lab.subgroupUrban': 'Urbano',
  'lab.subgroupRural': 'Rural',

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
  'lab.explain.outcome': 'Cuál de las cuatro cosas que mediste intenta explicar este análisis.',
  'lab.explain.subgroup': 'Restringe la muestra a un solo grupo de participantes antes de ajustar el modelo.',
  'lab.explain.covariates':
    'Tiene en cuenta además las diferencias de partida entre personas al comparar los dos grupos.',
  'lab.explain.exclusion': 'Retira de la muestra actual los valores atípicos antes de ajustar el modelo.',
  'lab.explain.transform': 'Ajusta la variable de resultado en su propia escala o en escala logarítmica.',
  'lab.explain.tails': 'Contrasta el efecto en cualquiera de las dos direcciones, o solo en la prevista.',

  'lab.howThisWorks.title': 'Cómo se juega',
  'lab.howThisWorks.step1': 'Lee el informe: la pregunta de hoy y los datos que te han dado.',
  'lab.howThisWorks.step2': 'Ajusta el análisis hasta que el número grande baje de 0.05.',
  'lab.howThisWorks.step3': 'Envía tu hallazgo a publicación.',
  // Deliberately the same wording as published.faceTruth: same beat, same name.
  'lab.howThisWorks.step4': 'Enfréntate a la verdad sobre lo que encontraste.',
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

  'lab.forkTrailHint': 'Cada símbolo es un movimiento que hiciste. La página de Leyenda tiene la clave.',

  'published.faceTruth': 'Enfréntate a la verdad',
  'published.simulatedPress': 'PRENSA SIMULADA',
  'published.editorsPick': 'Selección del editor',
  'published.doiPrefix': 'DOI:',
  // "et al." is what a Spanish citation actually prints; "y col." would read
  // as a house style nobody uses.
  'published.authors': 'Tú et al.',
  'published.careerPoints': '+{n} puntos de carrera',
  // {n} is altmetricScore(), whose floor is the tier-1 minimum of 40
  // (src/game/published.ts), so plural-only agreement is unconditionally safe
  // in Spanish too. One {n}, once: t() rewrites the first occurrence only.
  'published.altmetricScore': 'Mencionado ya {n} veces en internet',
  'published.altmetricPercentile': 'En el {n}% superior de toda la producción científica de la historia',

  // The call is conspiratorial, not accusatory: Act I's last beat. "Ruido que
  // disfracé" is the player's own admission to make.
  // "La revelación" is this locale's established name for that screen
  // (prereg.intro, prereg.locked, about.priorArt*). "La verdad" stays owned by
  // published.faceTruth and lab.howThisWorks.step4, which are the same beat.
  'call.title': 'Antes de ver la revelación…',
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
  'reveal.groupedCaption': 'Los efectos reales se agrupan. El ruido se dispersa.',
  'reveal.omittedFootnote': '{n} especificaciones tenían muy pocos datos para analizarse y no se representan.',
  'reveal.pValue': 'p = {p}',
  'reveal.pValueTiny': 'p < 0.001',
  'reveal.accounting1': 'De {total} análisis posibles, {sig} ({sigPct}%) alcanzan p < .05 por puro azar.',
  'reveal.accounting2': 'Exploraste {k} senderos antes de publicar.',
  'reveal.accounting2Abandoned': 'Exploraste {k} senderos antes de informar de un resultado nulo.',
  'reveal.accounting3':
    'Quien explora {k} senderos al azar encuentra al menos un resultado "significativo" alrededor del {pHitPct}% de las veces.',
  'reveal.peekSurcharge':
    'Tus {peeks} vistazos a los datos hacen que el número real de análisis sea unas {mult}× mayor de lo que muestra esta curva.',

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

  // The share grid's third line reads "{forks} bifurcaciones · racha {streak}".
  'share.forksWord': 'bifurcaciones',
  'share.streakWord': 'racha',

  'summary.score': 'Puntuación: {score}',
  'summary.share': 'Compartir',
  'summary.copied': 'Copiado al portapapeles',
  'summary.nextIn': 'Próximo puzle en {hours} h {minutes} min',
  // Plural-safe BY CONSTRUCTION, not by luck: Summary renders this
  // unconditionally and the streak counts today, so {n} = 1 is the common
  // first-day case. "Racha de 1 días" would greet every new player. A
  // label-colon-count row agrees with every value there is.
  'summary.streak': 'Días seguidos: {n}',
  'summary.playPrereg': 'Prueba el modo Preregistro',

  'summary.breakdownCallCorrect': 'Veredicto correcto',
  'summary.breakdownCallIncorrect': 'Veredicto erróneo',
  'summary.breakdownParsimony': 'Bonificación por parsimonia',
  'summary.breakdownIntegrity': 'Bonificación por integridad',
  'summary.breakdownMissedDiscovery': 'Descubrimiento desaprovechado',
  'summary.breakdownTrueDiscovery': 'Descubrimiento verdadero',
  'summary.breakdownConfirmedNull': 'Nulo confirmado',
  'summary.breakdownUnderpoweredLuck': 'Suerte sin potencia',
  'summary.breakdownFalsePositive': 'Falso positivo',

  'summary.invoiceTitle': 'Factura',
  'summary.preregUpsell': 'El preregistro está desbloqueado: comprométete con un análisis antes de ver los datos.',
  'summary.shareFailed': 'No se ha podido compartir este resultado.',

  'prereg.title': 'Preregistro',
  // Manuscript register, sincere and bureaucratic. The form itself is the
  // joke; its own copy never winks.
  'prereg.intro':
    'Declara tu análisis completo antes de ver un solo número. Cada elección de aquí abajo es definitiva en el momento en que la envías. No hay ninguna revelación que espiar antes, ni un segundo intento hoy.',
  'prereg.commit':
    'Me comprometo solemnemente a ejecutar y publicar exactamente esta especificación, muestre lo que muestre.',
  'prereg.submit': 'Enviar preregistro',
  'prereg.locked': 'Registrado. No hay más cambios hasta la revelación.',

  'stats.title': 'Tus estadísticas',
  'stats.played': 'Partidas',
  'stats.currentStreak': 'Racha actual',
  'stats.maxStreak': 'Racha máxima',
  'stats.callAccuracy': 'Acierto en los veredictos',
  'stats.avgScore': 'Puntuación media',
  'stats.close': 'Cerrar',

  'stats.callAccuracyLast20': 'Últimos 20 veredictos',
  'stats.successRateTitle': 'Tasa de éxito: hacking frente a preregistro',
  'stats.hackModeLabel': 'Modo Hacking',
  'stats.preregModeLabel': 'Modo Preregistro',
  'stats.noData': '—',
  'stats.forkHistogramTitle': 'Bifurcaciones por día',
  'stats.forkHistogramBar': '{forks} bifurcaciones: {count}',
  'stats.achievementsTitle': 'Logros',
  'stats.locked': 'Logro bloqueado',

  'about.title': 'Acerca de P-hackle',
  'about.intro':
    'Cada día, P-hackle te reparte un conjunto de datos sintéticos y una hipótesis ridícula. Las herramientas son reales: cambiar de variable de resultado, ir de compras por los subgrupos, parar de recoger datos cuando conviene. Son los mismos grados de libertad del investigador que se usan, por descuido o no, en investigación publicada de verdad.',
  'about.mechanism':
    'Todo lo que hay bajo el capó es real. El conjunto de datos de cada día se simula a partir de un proceso generador declarado (ocho variables latentes correlacionadas, un tratamiento confundido con la edad y la renta, cuatro familias de variables de resultado) y se siembra con la fecha, de modo que todo el mundo analiza exactamente los mismos números. Las regresiones son mínimos cuadrados ordinarios. La curva de especificación se calcula ejecutando de verdad cada combinación de variable de resultado, subgrupo, conjunto de covariables, regla de exclusión, transformación y elección de colas: está enumerada, no muestreada, y no es un truco. La mayoría de los días el efecto real es exactamente cero. El resto de los días es pequeño y real, que es toda la dificultad.',
  'about.frozenFork':
    'Una decisión analítica está congelada en lugar de ofrecerse: las puntuaciones z de los atípicos se calculan sobre la variable de resultado ya transformada y dentro de la submuestra filtrada. Eso es en sí mismo una bifurcación, y congelarla es en sí misma una decisión. Se declara aquí porque las bifurcaciones que no ves son las que hacen daño.',
  'about.syntheticDisclaimer':
    'Nada de este juego es un hallazgo. Los participantes no existen, los datos se generan en tu navegador, y las revistas, los DOI, los medios, los titulares y las declaraciones son todos inventados. Por eso las tarjetas de prensa llevan la marca de agua PRENSA SIMULADA. Los escenarios son deliberadamente absurdos y deliberadamente inofensivos: en ninguno aparece afirmación médica, nutricional ni de salud pública alguna, porque una captura de pantalla viaja más lejos que su pie de foto.',
  'about.decimalNote': 'La notación estadística usa siempre punto decimal (p = 0.049), en todos los idiomas.',
  'about.dataDisclosure':
    'La analítica son recuentos de visitas anónimos y sin cookies (Vercel Web Analytics). Sin cookies, sin cuentas, sin datos personales, sin seguimiento entre sitios, sin banner que cerrar. Tus puntuaciones, rachas, historial e idioma viven en el almacenamiento local de tu navegador y no se envían a ninguna parte. Si borras los datos de tu navegador desaparecen para siempre, también para nosotros, que nunca los tuvimos.',
  'about.priorArt':
    'P-hackle es un juego pequeño apoyado en una literatura grande. Toma prestada su demostración central, y casi todos sus métodos, de trabajos que merece la pena leer directamente:',
  'about.priorArtFiveThirtyEight':
    'Aschwanden y King (2015), "Hack Your Way to Scientific Glory", FiveThirtyEight. El interactivo dueño de esta idea. Usa datos reales y no ofrece ninguna verdad de referencia; P-hackle añade un proceso generador de datos conocido, una semilla diaria y el veredicto entre efecto y ruido.',
  'about.priorArtSpecCurve':
    'Simonsohn, Simmons y Nelson. Análisis de curva de especificación: el gráfico de la revelación es, en esencia, su figura.',
  'about.priorArtForkingPaths':
    'Gelman y Loken. El jardín de senderos que se bifurcan: no hace falta salir de pesca para que esto ocurra, basta con un análisis que se adapte a los datos que te tocó ver.',
  'about.priorArtFalsePositive':
    'Simmons, Nelson y Simonsohn (2011), "False-Positive Psychology". El inventario de grados de libertad del investigador que estas herramientas implementan, un botón cada vez.',
  'about.priorArtOptionalStopping':
    'Armitage, McPherson y Rowe (1969). Contrastar una y otra vez a medida que se acumulan datos infla por sí solo la tasa de falsos positivos, y por eso cada lote extra que recoges se te cuenta en la revelación.',
  'about.glossaryTitle': 'Glosario',
  'about.contact': 'Se agradecen preguntas y avisos de errores.',

  'about.version': 'Versión {version}',
  'about.sourceLink': 'Código fuente en GitHub',

  'legend.title': 'Leyenda',
  'legend.explored': 'Especificación que miraste',
  'legend.unexplored': 'Especificación que no miraste',
  'legend.significant': 'p < .05',
  'legend.published': 'La que publicaste',
  'legend.trueEffect': 'Efecto real',

  'legend.intro': 'Cómo se lee un resultado compartido.',
  'legend.emojiSpec': 'Cualquier cambio de especificación (variable de resultado, covariables o transformación)',
  'legend.emojiSubgroup': 'Cambio de filtro de subgrupo',
  'legend.emojiExclusion': 'Cambio en la exclusión de atípicos',
  'legend.emojiTails': 'Cambio a una cola',
  'legend.emojiPeek': 'Recogió más datos ("solo un lote más")',
  'legend.emojiSubmit': 'Enviado a publicación',
  'legend.emojiAbandon': 'Informó de un resultado nulo',
  'legend.emojiPrereg': 'Preregistrado (prefijo)',
  'legend.emojiCallCorrect': 'El veredicto fue correcto',
  'legend.emojiCallIncorrect': 'El veredicto fue erróneo',

  'errors.workerCrash': 'Algo ha fallado al generar el puzle de hoy. Recargar suele arreglarlo.',
  'errors.storageOff':
    'Tu navegador está bloqueando el almacenamiento local, así que el progreso no se guardará entre visitas.',

  'a11y.localeToggle': 'Cambiar de idioma',
  'a11y.specCurveChart':
    'Gráfico del p-valor de todas las especificaciones posibles, ordenadas, con tu especificación publicada resaltada.',
  'a11y.dataCut':
    'Diagrama de puntos de la muestra actual: el grupo de comparación y el grupo tratado, con cada punto excluido dibujado como una marca tachada.',
  'a11y.shareButton': 'Copiar al portapapeles el resultado para compartir',
  'a11y.closeDialog': 'Cerrar diálogo',
  'a11y.loading': 'Cargando el puzle de hoy',
};
