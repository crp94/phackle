// Spanish content (T20). A TRANSCREATION of ../en, not a translation: the
// jokes are rebuilt so they land in Spanish, in the same registers, on the
// same beats. What is copied rather than rewritten is the structure.
//
// Binding rules, inherited from ../en/index.ts and enforced by
// tests/content/es.shape.test.ts:
//
//  1. STRUCTURE IS FROZEN. Identical scenario ids, in identical order, with
//     identical journalTags; identical press tiers and scenarioIds bindings;
//     identical achievement ids; identical bank counts. Only the words move.
//  2. REGISTER. Act I (preguntas, briefings, titulares, prensa) is sincerely
//     enthusiastic: this lab believes in itself right up to the reveal. Act II
//     (retractaciones, menciones de los logros) is clinical, one sentence, and
//     never smug. The Spanish institutional furniture does the work English
//     did with deans and provosts: el decanato, el vicerrectorado, la comisión
//     de acreditación, la convocatoria. Reviewer 2 stays Reviewer 2, because
//     that is what Spanish researchers call him.
//  3. WHAT DOES NOT TRANSLATE. Journal mastheads and DOIs live in
//     ../journals.ts and stay English on purpose: that is where Spanish
//     academics actually publish, and the realism is the joke. Prof. Grantwell
//     keeps his name. Statistical notation keeps the decimal POINT (see
//     copy.ts rule 2).
//  4. HARM CHECK. Absurd but benign, exactly as in English: no medical,
//     nutritional or public-health claim anywhere, because a screenshot
//     travels further than its caption. Gatos y cripto sí; fármacos y
//     enfermedades no.
//  5. OUTCOME FAMILIES AND DIRECTION. outcomeLabels/outcomeUnits keep the
//     engine's fixed order [cola pesada, asimétrica, de recuento, escala
//     acotada 1-10], and every label is phrased so that MORE of the metric
//     means MORE of the claimed effect. "Errores cometidos" would break the
//     one-tailed contract; "libros que pasan la auditoría" keeps it.
//  6. COHORT SIZE. No cover story states a final headcount: the lab opens at
//     n = 200 with a "recoger 50 más" button, and a briefing that already
//     announced the total would deflate the optional-stopping fiction before
//     the player reaches it.
import type { LocaleContent } from '../types';
import { copy } from './copy';

export const content: LocaleContent = {
  scenarios: [
    {
      id: 'cat-crypto',
      question: '¿Tener gato mejora la rentabilidad en criptomonedas?',
      coverStory:
        'Se ha reclutado una cohorte piloto de inversores minoristas para poner a prueba una hipótesis popular que lleva años susurrándose en los foros de finanzas personales: que convivir con un gato ejerce una influencia calmante que estabiliza el apetito de riesgo de la cartera. Los inversores por cuenta propia registran su situación mascotil junto a treinta días de actividad, y el reclutamiento a través de esos mismos foros sigue abierto. El trabajo lo financia una fundación cuyo fundador tiene cuatro gatos y, según nos cuentan, una distribución a priori muy informativa.',
      treatmentLabel: 'Tiene gato',
      headline: 'Quienes tienen gato ganan un {effect}% más, según un estudio',
      // Same deliberate divergence as the English original: the cover story
      // sells cats as risk-steadying, so MORE volatility and MORE trading
      // would argue against the claimed effect and break the one-tailed
      // direction contract. Captura alcista and operaciones ganadoras keep
      // both the distribution shapes and the joke.
      outcomeLabels: [
        'Rentabilidad de la cartera a 30 días',
        'Ratio de captura alcista',
        'Operaciones con ganancia por semana',
        'Calma autopercibida durante un desplome',
      ],
      outcomeUnits: ['%', '% del índice de referencia', 'operaciones ganadoras/semana', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a aguantar una vela roja' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'standing-desk-poetry',
      question: '¿Los escritorios de pie mejoran la poesía de los mandos intermedios?',
      coverStory:
        'La ergonomía de oficina lleva décadas ocupándose de espaldas y muñecas, y prácticamente nada del endecasílabo. Equipamos a una cohorte de mandos intermedios con escritorios regulables en altura y recogimos, a lo largo de un trimestre fiscal entero, todo lo que escribieron en el canal interno de poesía de la empresa. Al jurado de licenciados en Filología que lo puntúa a ciegas se le paga en pizza.',
      treatmentLabel: 'Usa escritorio de pie',
      headline: 'El escritorio de pie, detrás del renacer del verso en los mandos intermedios',
      outcomeLabels: [
        'Puntuación de calidad del jurado',
        'Densidad de metáforas',
        'Envíos al canal interno de poesía',
        'Profundidad autoevaluada',
      ],
      outcomeUnits: ['puntos', 'metáforas/estrofa', 'envíos/mes', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Apetito por el riesgo creativo' },
      journalTags: ['workplace', 'creative'],
    },
    {
      id: 'sourdough-marathon',
      question: '¿Hacer pan de masa madre mejora las marcas en maratón?',
      coverStory:
        'El entrenamiento de resistencia se ha estudiado hasta la extenuación. La panadería no. Nuestra hipótesis es conductual y no nutricional: doce semanas negándose a acelerar una fermentación deberían transferirse directamente a la paciencia que exige un negative split. Reclutamos maratonianos aficionados en clubes de atletismo y en una cooperativa harinera excepcionalmente colaboradora, cruzamos sus cuadernos de masa madre con sus tiempos de chip y esperamos. La cooperativa sigue mandándonos gente.',
      treatmentLabel: 'Mantiene una masa madre',
      headline: 'Los panaderos de masa madre corren el maratón un {effect}% más rápido, según los autores',
      outcomeLabels: [
        'Mejora sobre la marca personal el día de la carrera',
        'Aceleración en los últimos 10 km sobre el ritmo medio',
        'Corredores adelantados en los últimos 10 km',
        'Paciencia autopercibida el día de la carrera',
      ],
      outcomeUnits: ['s/km ganados', '% sobre el ritmo medio', 'corredores adelantados/carrera', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a salir demasiado fuerte' },
      journalTags: ['fitness', 'lifestyle'],
    },
    {
      id: 'jazz-spreadsheets',
      question: '¿Escuchar jazz reduce los descuadres en las hojas de cálculo?',
      coverStory:
        'Las oficinas diáfanas llevan una década discutiendo sobre la música ambiente sin auditar ni una sola vez un libro de cálculo. Dimos a un departamento de analistas financieros una lista de 340 horas de hard bop y dejamos al otro con su silencio de siempre; después pasamos cada celda de sus modelos trimestrales por una herramienta de auditoría independiente. A los analistas se les dijo que el estudio iba sobre la iluminación.',
      treatmentLabel: 'Escucha jazz mientras trabaja',
      headline: 'El jazz en la oficina, asociado a hojas de cálculo un {effect}% más limpias',
      outcomeLabels: [
        'Exactitud de auditoría sobre la media del departamento',
        'Racha más larga de celdas limpias en auditoría',
        'Libros que pasan la auditoría al primer envío',
        'Atención al detalle autoevaluada',
      ],
      outcomeUnits: ['puntos porcentuales', 'celdas', 'libros/trimestre', 'escala 1–10'],
      covariateLabels: { income: 'Banda salarial', risk: 'Comodidad con una fórmula sin auditar' },
      journalTags: ['productivity', 'music'],
    },
    {
      id: 'fern-negotiation',
      question: '¿Un helecho en la mesa te vuelve mejor negociador?',
      coverStory:
        'El diseño biofílico se le vende a los responsables de instalaciones apelando solo al bienestar. Nadie ha preguntado qué hace al otro lado de una mesa. Colocamos un único helecho de Boston en el despacho de cada responsable de compras que aceptó participar, lo dejamos allí un ciclo de contratación completo y obtuvimos después las condiciones finales de todos los contratos que cerraron. Se nos dio permiso en todos los casos, en varios tras considerable insistencia.',
      treatmentLabel: 'Tiene un helecho en la mesa',
      headline: 'Tener un helecho en la mesa mejora cada contrato en {effect} mil €, según un estudio',
      outcomeLabels: [
        'Valor arrancado por encima de la oferta inicial',
        'Silencio más largo sostenido tras una contraoferta',
        'Concesiones arrancadas por negociación',
        'Dureza según la contraparte',
      ],
      outcomeUnits: ['miles de €', 'segundos', 'concesiones/negociación', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a levantarse de la mesa' },
      journalTags: ['nature', 'workplace'],
    },
    {
      id: 'cold-shower-emails',
      question: '¿Las duchas frías vuelven tus correos más pasivo-agresivos?',
      coverStory:
        'A la ducha fría matutina se le atribuyen concentración, resiliencia y carácter. Su efecto sobre la bandeja de entrada está por completo sin estudiar. Los participantes anotan cada mañana la temperatura de su ducha y consienten el análisis de sentimiento de seis semanas de correo saliente; las altas continúan por oleadas, según lo permita la fontanería. Quienes codifican desconocen la condición asignada, y la fórmula "como ya indiqué en mi anterior correo" se marca de forma automática, lo que les ahorra muchísimo.',
      treatmentLabel: 'Se ducha con agua fría',
      headline: 'La ducha fría, asociada a un tono un {effect}% más cortante en la bandeja de entrada',
      outcomeLabels: [
        'Índice de pasivo-agresividad del correo saliente',
        'Latencia de respuesta ante peticiones inoportunas',
        'Apariciones de "como ya indiqué en mi anterior correo"',
        'Frialdad percibida por el destinatario',
      ],
      outcomeUnits: ['puntos de índice', 'horas', 'apariciones/semana', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a responder a todos' },
      journalTags: ['wellness', 'communication'],
    },
    {
      id: 'horoscope-parking',
      question: '¿Quien lee el horóscopo aparca antes?',
      coverStory:
        'La investigación en movilidad urbana modela la búsqueda de aparcamiento como un proceso racional. Nosotros nos preguntamos si no será más bien devocional. Los conductores instalan un registrador que anota cada búsqueda desde que entran en la calle hasta que apagan el motor, y declaran sus hábitos matutinos con el móvil; quienes consultan su signo antes de conducir se comparan con quienes no. A ninguno de los dos grupos se le dice qué estamos buscando. Dos lo han adivinado igualmente, y ninguno se acercó.',
      treatmentLabel: 'Lee el horóscopo a diario',
      headline: 'Quien lee el horóscopo se ahorra {effect} minutos a la semana buscando aparcamiento',
      outcomeLabels: [
        'Tiempo de búsqueda ahorrado frente a la media de la manzana',
        'Ventaja en distancia sobre la alternativa legal más próxima',
        'Aparcamientos logrados al primer intento',
        'Alineación cósmica autopercibida',
      ],
      outcomeUnits: ['minutos ahorrados', 'metros', 'aciertos/semana', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Comodidad ante una señal de aparcamiento ambigua' },
      journalTags: ['superstition', 'lifestyle'],
    },
    {
      id: 'mechanical-keyboard-bugs',
      question: '¿Los teclados mecánicos reducen los bugs que llegan a producción?',
      coverStory:
        'La literatura sobre retroalimentación táctil termina en la velocidad de tecleo y no llega ni de lejos a producción. Con la colaboración de once equipos de ingeniería, cruzamos dieciocho meses de registros de compra de hardware con el mismo periodo de sus gestores de incidencias, tratando cada cambio de switch como un experimento natural. Dos participantes cambiaron de tipo de switch a mitad del estudio y hubo que descartarlos, muy a nuestro pesar. Los dos se habían pasado a algo más silencioso.',
      treatmentLabel: 'Teclea en un teclado mecánico',
      headline: 'El teclado mecánico, asociado a versiones un {effect}% más limpias',
      outcomeLabels: [
        'Código sin defectos entregado por versión',
        'Racha más larga de compilaciones en verde',
        'Revisiones aprobadas sin cambios solicitados',
        'Confianza autopercibida al hacer commit',
      ],
      outcomeUnits: ['miles de líneas', 'horas', 'aprobaciones/sprint', 'escala 1–10'],
      covariateLabels: { income: 'Banda salarial', risk: 'Apetito por desplegar en viernes' },
      journalTags: ['technology', 'productivity'],
    },
    {
      id: 'dog-economist-stocks',
      question: '¿Quien llama a su perro como un economista le gana al mercado?',
      coverStory:
        'El folclore de la inversión minorista sostiene que la convicción tiene que venir de algún sitio. Preguntamos a los clientes de una agencia de valores por el nombre de sus mascotas y clasificamos cada uno a mano contra una lista de referencia de economistas (Keynes, Hayek, Ostrom y un Milton sobre el que discutimos una semana entera); después cruzamos la clasificación con dos años de extractos auditados. La cola de clasificación todavía no está vacía.',
      treatmentLabel: 'Perro con nombre de economista',
      headline: 'Los inversores con perros llamados como economistas baten al mercado en {effect} puntos',
      outcomeLabels: [
        'Rentabilidad anualizada por encima del índice',
        'Mayor ganancia en una sola posición',
        'Posiciones que terminan por delante del índice',
        'Convicción autopercibida en la tesis',
      ],
      outcomeUnits: ['puntos porcentuales', '%', 'posiciones/trimestre', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Convencimiento de que el perro sabe algo' },
      journalTags: ['pets', 'finance'],
    },
    {
      id: 'full-moon-meetings',
      question: '¿Las reuniones se alargan más con luna llena?',
      coverStory:
        'Los datos de calendario son el conjunto de datos conductuales más desaprovechado de la empresa moderna. Extrajimos dieciocho meses de registros de reuniones de una consultora mediana (hora prevista de fin, hora real de fin, número de asistentes, reuniones de seguimiento) y los cruzamos con una efeméride lunar. La hipótesis la propuso, con toda seriedad, la persona que administra el calendario, que ya ha acertado otras veces.',
      treatmentLabel: 'Celebrada con luna llena',
      headline: 'Con luna llena las reuniones duran {effect} minutos más, según un análisis',
      outcomeLabels: [
        'Exceso sobre la hora prevista de fin',
        'Digresión más larga',
        'Reuniones de seguimiento "rápidas" convocadas después',
        'Sensación de los asistentes de que esto podría haber sido un correo',
      ],
      outcomeUnits: ['minutos', 'minutos', 'seguimientos/reunión', 'escala 1–10'],
      covariateLabels: {
        income: 'Banda salarial de quien convoca',
        risk: 'Disposición a añadir un punto más al orden del día',
      },
      journalTags: ['astronomy', 'workplace'],
    },
    {
      id: 'label-maker-inbox',
      question: '¿Tener una etiquetadora ayuda a dejar la bandeja de entrada a cero?',
      coverStory:
        'La gestión de la información personal es un campo rico en taxonomías y pobre en trabajo de campo. Hacemos a trabajadores del conocimiento una única pregunta de cribado (¿tiene usted una etiquetadora?) y, con su consentimiento, instrumentamos su cliente de correo durante un trimestre. El instrumento cuenta metadatos y nada más. Tres participantes nos han pedido que se lo confirmemos dos veces; se lo confirmamos dos veces, encantados.',
      treatmentLabel: 'Tiene una etiquetadora',
      headline: 'Quien tiene etiquetadora despacha un {effect}% más de su bandeja cada semana',
      outcomeLabels: [
        'Tasa semanal de despacho del correo entrante',
        'Racha más larga de días con la bandeja a cero',
        'Subcarpetas anidadas creadas',
        'Sensación autopercibida de control',
      ],
      outcomeUnits: ['% de lo recibido', 'días', 'carpetas/mes', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Tolerancia a convivir con un aviso de no leídos' },
      journalTags: ['productivity', 'workplace'],
    },
    {
      id: 'vinyl-dinner-party',
      question: '¿Quien colecciona vinilos da mejores cenas?',
      coverStory:
        'La investigación en hostelería ha caracterizado el menú de forma exhaustiva y el tocadiscos en absoluto. Los anfitriones aceptan que un ayudante de investigación observe una de sus cenas, presentado a los demás invitados como "un compañero del trabajo"; siendo las cenas lo que son, el calendario de observación va meses por delante del análisis. Los ayudantes anotan las horas de llegada y de marcha, qué llevan los invitados y qué piden al salir. El vino no se analiza; el vino tampoco está ya, en honor a la verdad, disponible para su análisis.',
      treatmentLabel: 'Tiene una colección de vinilos',
      headline: 'Los anfitriones con vinilos retienen a sus invitados {effect} minutos más, según un estudio',
      outcomeLabels: [
        'Valor del vino que los invitados trajeron por iniciativa propia',
        'Tiempo que los invitados se quedaron pasada la hora anunciada',
        'Peticiones espontáneas de la receta',
        'Calidez de la velada según los invitados',
      ],
      outcomeUnits: ['€', 'minutos', 'peticiones/cena', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a estrenar una receta con invitados' },
      journalTags: ['music', 'lifestyle'],
    },
    {
      id: 'telescope-directions',
      question: '¿Quien tiene telescopio en casa da mejores indicaciones?',
      coverStory:
        'La investigación sobre orientación descansa casi por entero en tareas de rotación mental hechas en laboratorio. Nosotros sacamos la pregunta a la calle. Nuestros ayudantes abordan a desconocidos en tres ciudades, preguntan cómo llegar a un sitio que está a ocho minutos andando, transcriben la respuesta literalmente y solo entonces, tras explicarles todo, preguntan si tienen telescopio. Las tasas de respuesta son, para nuestra sincera sorpresa, excelentes, y vamos a añadir una cuarta ciudad. Quienes tienen telescopio, en particular, están encantados de que se lo pregunten.',
      treatmentLabel: 'Tiene un telescopio en casa',
      headline: 'Quien tiene telescopio da indicaciones un {effect}% más eficientes que la app',
      outcomeLabels: [
        'Ganancia de eficiencia de la ruta frente a la app de navegación',
        'Detalle de referencias aportado por respuesta',
        'Puntos cardinales usados por conversación',
        'Confianza del desconocido en las indicaciones',
      ],
      outcomeUnits: ['%', 'palabras', 'puntos cardinales/conversación', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a recomendar un atajo' },
      journalTags: ['astronomy', 'communication'],
    },
    {
      id: 'cafe-peer-review',
      question: '¿Los revisores que trabajan en cafeterías firman informes más duros?',
      coverStory:
        'La revisión por pares es el paso menos observado de todo el proceso científico, y pretendemos que siga siéndolo para todo el mundo salvo para nosotros. Con el permiso de los comités editoriales de dos revistas, los informes ya entregados se cruzan con el lugar donde el revisor declaró haberlos escrito, según los comités nos los van pasando. La severidad la puntúa un panel de exeditores, todos y cada uno de los cuales han sido revisados desde una cafetería y no lo han olvidado.',
      treatmentLabel: 'Revisa desde una cafetería',
      headline: 'Los revisores de cafetería piden {effect} experimentos más por manuscrito',
      outcomeLabels: [
        'Índice de severidad del informe',
        'Extensión del apartado de "objeciones mayores"',
        'Experimentos adicionales solicitados',
        'Dureza según los autores',
      ],
      outcomeUnits: ['puntos de índice', 'palabras', 'experimentos/informe', 'escala 1–10'],
      covariateLabels: { income: 'Banda salarial', risk: 'Disposición a recomendar el rechazo' },
      journalTags: ['general', 'workplace'],
    },
    {
      id: 'terms-and-conditions-service',
      question: '¿Quien se lee los términos y condiciones recibe mejor atención al cliente?',
      coverStory:
        'La investigación en protección del consumidor da por supuesto que nadie se lee el contrato y, por eso mismo, nunca ha estudiado a quienes sí se lo leen. Estamos reclutando clientes que declaran leerse las condiciones enteras, un colectivo que nos está costando muchísimo localizar, y transcribiendo, con su permiso, doce meses de sus conversaciones con soporte. Son las transcripciones más largas con las que ha trabajado nunca este laboratorio. Los consentimientos informados, por una vez, se leyeron enteros.',
      treatmentLabel: 'Se lee los términos y condiciones',
      headline: 'Quien se lee las condiciones recibe {effect} € más en compensaciones',
      outcomeLabels: [
        'Compensación concedida por reclamación',
        'Extensión de la disculpa recibida',
        'Incidencias resueltas en el primer contacto',
        'Sensación autopercibida de que te toman en serio',
      ],
      outcomeUnits: ['€', 'palabras', 'resoluciones/trimestre', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a pedir un supervisor' },
      journalTags: ['communication', 'general'],
    },
    {
      id: 'jigsaw-suitcase-packing',
      question: '¿Quien hace puzles prepara mejor la maleta?',
      coverStory:
        'La investigación sobre razonamiento espacial ha producido cuatro décadas de tareas de rotación de cubos y prácticamente nada de equipaje. Nosotros llevamos la pregunta a un aeropuerto regional. A los viajeros se les pregunta si han completado un puzle en el último año y después, con su permiso y una mesa plegable, se mide el contenido de su equipaje contra el volumen de la maleta. Una puerta de embarque resulta ser un entorno de reclutamiento insólitamente colaborador: allí nadie tiene otro sitio donde estar.',
      treatmentLabel: 'Hace puzles',
      headline: 'Quien hace puzles mete un {effect}% más de cosas en la misma maleta',
      outcomeLabels: [
        'Capacidad libre que queda tras hacer la maleta',
        'Duración máxima de viaje que cabe en equipaje de mano',
        'Objetos recuperados sin deshacer la maleta',
        'Previsión según el acompañante',
      ],
      outcomeUnits: ['litros', 'días', 'objetos/viaje', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a viajar sin facturar' },
      journalTags: ['lifestyle', 'general'],
    },
    {
      id: 'stairs-small-talk',
      question: '¿Quien sube por las escaleras da mejor conversación?',
      coverStory:
        'El diseño de un edificio determina quién se encuentra con quién, pero las conversaciones que salen de ahí casi nunca se registran. En una oficina de doce plantas anotamos la elección entre escalera y ascensor a partir de datos anonimizados de tarjeta y, por separado, pasamos una encuesta de compenetración a cada par de compañeros que llegó junto a una planta. Los participantes sabían lo de la encuesta. Los participantes se enteraron de lo de las tarjetas en la sesión informativa final, un orden que nuestro comité de ética nos pidió describir exactamente con estas palabras.',
      treatmentLabel: 'Sube por las escaleras',
      headline: 'Quien sube por las escaleras puntúa un {effect}% más alto en compenetración laboral',
      outcomeLabels: [
        'Puntuación de compenetración sobre la media del edificio',
        'Charla informal más larga sostenida',
        'Conversaciones de seguimiento iniciadas',
        'Calidez según la contraparte',
      ],
      outcomeUnits: ['puntos', 'segundos', 'conversaciones/semana', 'escala 1–10'],
      covariateLabels: { income: 'Banda salarial', risk: 'Disposición a romper el hielo con un desconocido' },
      journalTags: ['fitness', 'communication'],
    },
    {
      id: 'sock-folding-punctuality',
      question: '¿Quien dobla los calcetines llega antes?',
      coverStory:
        'La investigación sobre uso del tiempo ha documentado el trayecto al trabajo con un detalle extraordinario y el cajón de los calcetines en absoluto. Los participantes fotografían cómo guardan los suyos (doblados, enrollados o sueltos) y nosotros cruzamos la clasificación con seis semanas de marcas de calendario y de fichaje. Dos personas codifican las fotografías por separado. Coinciden mucho más a menudo de lo que habíamos presupuestado, lo cual es una pequeña crisis en sí misma.',
      treatmentLabel: 'Dobla los calcetines',
      headline: 'Quien dobla los calcetines llega {effect} minutos antes, según un estudio de seis semanas',
      outcomeLabels: [
        'Minutos de antelación en las llegadas previstas',
        'Racha más larga de días seguidos en hora',
        'Citas a las que se llega con antelación',
        'Fiabilidad según los compañeros',
      ],
      outcomeUnits: ['minutos de antelación', 'días', 'citas/semana', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Tolerancia a apurar un transbordo' },
      journalTags: ['lifestyle', 'workplace'],
    },
    {
      id: 'thirteen-mortgage',
      question: '¿Quien evita el número 13 consigue mejores hipotecas?',
      coverStory:
        'Las finanzas del hogar dan por supuesto que quien pide prestado optimiza, y tratan la superstición como ruido alrededor de ese supuesto. Llevamos tiempo encuestando a personas con hipoteca reciente sobre una batería de preferencias numéricas cotidianas (plantas que se saltan, fechas que evitan, números de portal que rechazan) y cruzando la puntuación de triscaidecafobia resultante con las condiciones que firmaron de verdad. El intermediario que nos consigue esas condiciones ha pedido no ser nombrado. Manda recuerdos.',
      treatmentLabel: 'Evita el número 13',
      headline: 'Quien evita el 13 le arranca {effect} puntos básicos a su hipoteca',
      outcomeLabels: [
        'Ventaja de tipo frente a la media del mercado',
        'Comisiones condonadas durante la negociación',
        'Contraofertas obtenidas por solicitud',
        'Confianza autopercibida en la operación',
      ],
      outcomeUnits: ['puntos básicos', '€', 'contraofertas/solicitud', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a dejar caducar una oferta' },
      journalTags: ['superstition', 'finance'],
    },
    {
      id: 'browser-tabs-side-projects',
      question: '¿Quien no cierra nunca las pestañas del navegador publica más proyectos personales?',
      coverStory:
        'La investigación sobre atención trata la pestaña abierta como un coste. Nosotros nos preguntamos si no será más bien un inventario. Los desarrolladores instalan una extensión que registra un recuento diario de pestañas y nada más (una limitación que aceptamos por motivos de reclutamiento) y declaran cada proyecto personal que publiquen durante el año siguiente, con un enlace público que funcione como prueba obligatoria. El requisito del enlace nos ha costado más participantes que la extensión.',
      treatmentLabel: 'Mantiene más de 40 pestañas abiertas',
      headline: 'Los desarrolladores con más pestañas abiertas publican {effect}× más proyectos personales',
      outcomeLabels: [
        'Ingresos por proyectos personales en el año',
        'Sesión de desarrollo ininterrumpida más larga',
        'Proyectos publicados con enlace público',
        'Sensación autopercibida de tenerlo todo bajo control',
      ],
      outcomeUnits: ['€', 'minutos', 'proyectos/año', 'escala 1–10'],
      covariateLabels: { income: 'Renta del hogar', risk: 'Disposición a empezar algo antes de terminar lo anterior' },
      journalTags: ['technology', 'creative'],
    },
  ],

  // Prof. Grantwell's flavour bank, ordered by escalating desperation:
  // aphorisms and departmental nudges first, existential dread last. Scenario-
  // agnostic by design (one bank rotates across all 20 scenarios), so nothing
  // here may name a cat, a fern or a marathon. The English deans and provosts
  // become the Spanish academy's own machinery: el decanato, el
  // vicerrectorado, la comisión de acreditación, la convocatoria.
  grantwell: [
    'Recuerda: un p-valor de .06 es un p-valor de .05 con mala gestión del tiempo.',
    'Nota para el resumen: "preliminar" es una palabra que podemos poner después de la buena noticia, no antes.',
    'El decano ha preguntado si lo nuestro tiene "impacto". He dicho que sí. Haz que sea retroactivamente cierto.',
    'El boletín del departamento necesita una alegría este mes. Desde las nueve de la mañana, la alegría eres tú.',
    'La memoria de impacto se entrega antes que los resultados. Escríbela con optimismo; ya alinearemos los hallazgos después.',
    'Reviewer 2 quiere significación para el viernes. La renovación depende de ello. Confío en ti (y no tengo alternativa).',
    'A la agencia financiadora le dije que esto era "alto riesgo, alta recompensa". Cumple la segunda parte.',
    'He despejado la tarde para oír que la hipótesis se ha sostenido. No me hagas despejar también la de mañana.',
    'Un apunte antes de tu defensa: "el efecto apuntaba en la dirección esperada" es una frase completa. Úsala.',
    'Esta hipótesis la eligió tu yo de la carrera. Tu comisión de acreditación no necesita saberlo.',
    'Un laboratorio rival publicó algo parecido la semana pasada. Estamos, técnicamente, compitiendo. Ellos no saben que competimos.',
    'La fecha límite del congreso se ha adelantado once días. Estadísticamente, eso no cambia nada. Ya he enviado el título.',
    'El comité de ética ha aprobado el protocolo. Los datos no han aprobado la hipótesis. Sigue adelante igualmente.',
    'He redactado la nota de prensa y en comunicación les ha encantado. Dos medios preguntan ya por la fecha del embargo. Solo falta el estudio.',
    'Los socios industriales vienen el jueves. Financiaron un descubrimiento. Ten algo descubierto, por favor.',
    'La plaza de posdoc depende de la producción de este año. Lo menciono como contexto, no como presión. También es presión.',
    'La comisión de sabáticos se reúne en junio. Un hallazgo en mayo sería decisivo. Quiero ser preciso con esa palabra.',
    'En el vicerrectorado han empezado a decir "revisión de la cartera investigadora". Nadie me explica qué significa. Yo sé que significa nosotros.',
    'Año tres de tres de la convocatoria. No quiero alarmarte, pero quiero alarmarte un poco.',
    'Deja de mandarme el intervalo de confianza. Mándame la estimación puntual. La estimación puntual no ha defraudado a nadie jamás.',
    'Reviewer 2 ha vuelto. Reviewer 2 es la misma persona que la otra vez. Reviewer 2 se acuerda de nosotros.',
    'Anoche soñé que esto replicaba. He decidido tratarlo como un preregistro.',
  ],

  // Simulated press, watermarked PRENSA SIMULADA in the UI. Tier = egregious-
  // ness of the published spec: tier 1 is credulous but sober, tier 2 is
  // aggregator-grade, tier 3 is the TV chyron. Outlets are transcreated rather
  // than kept (unlike the journal mastheads, which stay English by design):
  // "Buzz & Broadsheet" says nothing to a Spanish reader, whereas a rótulo on
  // a 24h channel says everything. The three subject-naming blurbs keep their
  // scenarioIds so no fern chyron runs over a sourdough study.
  press: [
    {
      text: 'Lo dice la ciencia: tu gato podría ser tu mejor asesor financiero.',
      outlet: 'El Trino Matinal',
      tier: 1,
      scenarioIds: ['cat-crypto'],
    },
    {
      text: 'Los autores describen el efecto como modesto. La palabra no vuelve a aparecer en todo el artículo.',
      outlet: 'El Balance Semanal',
      tier: 1,
    },
    {
      text: 'Un hábito pequeño, una diferencia medible: lo que apunta un nuevo estudio.',
      outlet: 'El Suplemento Dominical',
      tier: 1,
    },
    {
      text: 'El hallazgo es preliminar. Los autores dicen que precisamente por eso importa.',
      outlet: 'Boletín Semanal',
      tier: 1,
    },
    {
      text: 'Revisado por pares y publicado esta semana: una relación que nadie se había parado a buscar.',
      outlet: 'El Balance Semanal',
      tier: 1,
    },
    {
      text: 'Los investigadores piden más estudios, y más financiación para poder hacerlos.',
      outlet: 'Boletín Semanal',
      tier: 1,
    },
    { text: 'El truco raro con el que los estadísticos PUBLICAN.', outlet: 'El Scroll Diario', tier: 2 },
    {
      text: '¿Te está costando un Premio Nacional tu silla de oficina? Los expertos opinan.',
      outlet: 'Ruido & Rotativa',
      tier: 2,
    },
    { text: 'Ya lo estás haciendo. La ciencia dice que sigas.', outlet: 'El Scroll Diario', tier: 2 },
    {
      text: 'Correlación no es causalidad, pero esta vez se nota distinto de verdad.',
      outlet: 'El Scroll Diario',
      tier: 2,
    },
    {
      text: 'Nueve hábitos de quienes superan la media. El número cuatro está en una revista de verdad.',
      outlet: 'Clicbienestar',
      tier: 2,
    },
    {
      text: 'La ciencia confirma por fin lo que tu grupo de WhatsApp ya sospechaba.',
      outlet: 'Ruido & Rotativa',
      tier: 2,
    },
    {
      text: 'Los expertos avisan de que el estudio es observacional y a continuación lo comentan once minutos.',
      outlet: 'Clicbienestar',
      tier: 2,
    },
    {
      text: 'ESTUDIO: ¿HELECHOS = PODER DE NEGOCIACIÓN?',
      outlet: 'Cadena Rótulo 24H',
      tier: 3,
      scenarioIds: ['fern-negotiation'],
    },
    {
      text: 'ÚLTIMA HORA: TUS PLANTAS DE INTERIOR ESTÁN JUZGANDO TU PLAN DE PENSIONES',
      outlet: 'Cadena Rótulo 24H',
      tier: 3,
      scenarioIds: ['fern-negotiation'],
    },
    {
      text: 'LA CIENCIA CONFIRMA: ESO QUE HACES ES LA RAZÓN DE QUE PASE TODO',
      outlet: 'Cadena Rótulo 24H',
      tier: 3,
    },
    { text: 'UN SOLO NÚMERO LO CAMBIA TODO. EL NÚMERO ES 0.049.', outlet: 'Cadena Rótulo 24H', tier: 3 },
    { text: 'ESTADÍSTICAMENTE SIGNIFICATIVO: QUÉ SIGNIFICA PARA TU FAMILIA', outlet: 'Canal 9 Noticias Noche', tier: 3 },
    { text: 'NUEVO ESTUDIO: ¿LO ESTÁS HACIENDO MAL? (SÍ)', outlet: 'Canal 9 Noticias Noche', tier: 3 },
    // Spoken aloud by a presenter, which is why it says "coma": the decimal
    // POINT rule governs notation, and this line is a person reading a number
    // out on live television. The clash is the joke.
    { text: 'P MENOR QUE CERO COMA CERO CINCO: SE LO EXPLICAMOS TRAS LA PAUSA', outlet: 'Directo Madrugada', tier: 3 },
    { text: 'EXCLUSIVA: EL HÁBITO QUE EL MERCADO NO QUIERE QUE MANTENGAS', outlet: 'Directo Madrugada', tier: 3 },
  ],

  // Act II. Quiet, one sentence, devastating; never a punchline, never smug.
  retractionSublines: [
    'El efecto era 0.000. Siempre fue 0.000.',
    'Tu titular ha desaparecido sin ruido de la portada de la universidad.',
    'El preprint ya no está. La copia en caché sí.',
    'El Prof. Grantwell no ha respondido a las peticiones de declaraciones.',
    'El intervalo de confianza siempre contuvo el cero. Fue muy paciente al respecto.',
    'La revista ha publicado una corrección. Esta página es la corrección.',
    'Los datos estaban bien. Los datos siempre estuvieron bien.',
    'Se intentó una replicación. No se acercó.',
    'Tres grupos intentaron reproducirlo. Uno de ellos era el tuyo.',
    'La nota de prensa sigue en línea. Es lo único que sigue.',
    'Tus coautores han pedido figurar como "consultados".',
    'El hallazgo sobrevivió a la revisión por pares y a nada más.',
    'Nadie lo ha citado. Nadie iba a hacerlo.',
    'Esta es, a partir de ahora, la versión de registro.',
  ],

  // Award-citation register: the formula is "Por" plus the deed, delivered
  // completely straight, the way an academy reads a prize out loud.
  achievements: {
    first_blood: {
      name: 'Primera sangre',
      citation: 'Por el primer artículo que este laboratorio logró colarle a un revisor.',
    },
    first_retraction: {
      name: 'Primera retractación',
      citation: 'Por la celeridad con la que la portada de la universidad te olvidó.',
    },
    harking: {
      name: 'HARKing',
      citation: 'Por formular la hipótesis una vez conocidos los resultados, y saberlo.',
    },
    one_tailed_bandit: {
      name: 'El bandido de una cola',
      citation: 'Por decidir, en el último momento posible, que solo una dirección importó desde el principio.',
    },
    outlier_surgeon: {
      name: 'Cirujano de atípicos',
      citation: 'Por los servicios prestados a la extirpación de humanos inconvenientes.',
    },
    subgroup_safari: {
      name: 'Safari de subgrupos',
      citation: 'Por recorrer cinco subgrupos buscando el único que te daba la razón.',
    },
    one_more_batch: {
      name: 'Solo un lote más',
      citation: 'Por recoger datos hasta que los datos colaboraron.',
    },
    garden: {
      // Gelman & Loken took the name from Borges, so in Spanish the reference
      // lands in its original title rather than as a translation of a
      // translation.
      name: 'El jardín de senderos que se bifurcan',
      citation: 'Por consultar veinticinco especificaciones y publicar la más bonita.',
    },
    monk: { name: 'El monje', citation: 'Por veinte días sin hacer nada de esto.' },
    well_actually: {
      name: 'Bueno, en realidad',
      citation: 'Por publicar el ruido sabiendo perfectamente lo que hacías.',
    },
    true_detective: {
      name: 'True Detective',
      citation: 'Por diez aciertos seguidos distinguiendo la señal del autoengaño.',
    },
  },

  // Standard Spanish methodological terminology throughout: these are the
  // words a Spanish-language methods seminar actually uses.
  glossary: [
    {
      term: 'p-hacking',
      def: 'Analizar los datos de maneras que inflan la tasa de falsos positivos y publicar después solo el análisis que cruzó el umbral de significación.',
    },
    {
      term: 'Grados de libertad del investigador',
      def: 'Las muchas decisiones pequeñas y aparentemente defendibles de un análisis (qué variable de resultado, qué subgrupo, qué regla de exclusión), cada una de las cuales mueve el resultado.',
    },
    {
      term: 'Jardín de senderos que se bifurcan',
      def: 'La idea de que un mismo conjunto de datos admite muchos análisis defendibles, de modo que «el» resultado depende de qué sendero de ese jardín se tomó.',
    },
    {
      term: 'Curva de especificación',
      def: 'Un gráfico con la estimación (o el p-valor) que produce cada especificación analítica razonable, ordenadas, de forma que se vea de golpe todo el espacio de decisiones y no solo la decisión publicada.',
    },
    {
      term: 'HARKing',
      def: 'Hypothesizing After the Results are Known: presentar un hallazgo post hoc como si se hubiera predicho de antemano.',
    },
    {
      term: 'Parada opcional',
      def: 'Ir mirando los resultados según llegan los datos y detener la recogida en cuanto se alcanza la significación, lo que infla la tasa de falsos positivos incluso con un contraste honesto.',
    },
    {
      term: 'Preregistro',
      def: 'Comprometerse con una hipótesis y un plan de análisis antes de ver los datos, para que el análisis no pueda adaptarse al resultado.',
    },
    {
      term: 'α / tasa de falsos positivos',
      def: 'La frecuencia con la que un contraste señala un efecto que en realidad no está ahí, limitada por convención al 5%. Este juego está diseñado para rebasar ese límite de largo.',
    },
  ],

  copy,
};
