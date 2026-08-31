# Notas de desarrollo

## Fase 5: FSRS, perfil de habilidad, planificador y pantalla Hoy

### Qué se construyó

- `src/learning/fsrs.ts`: envoltorio delgado sobre `ts-fsrs` (la librería de
  referencia del algoritmo, sin dependencias propias). Se eligió la
  implementación real de FSRS en vez de SM-2 a pedido explícito (la
  alternativa más simple, sin dependencias nuevas, tampoco era mala, pero
  FSRS da intervalos más precisos y la librería es la misma que usa Anki).
  `gradeFromAttempt()` traduce el resultado binario de un intento (resuelto
  o no, con cuántos errores antes de acertar) a una nota FSRS de 4 niveles.
- `src/learning/profile.ts`: perfil de habilidad por concepto (documento de
  diseño, 5.5), con el mínimo de evidencia (5 ejercicios o 3 partidas) antes
  de mostrar un número.
- `src/learning/session.ts`: planificador de sesión diaria, 60% vencidos de
  la cola SRS / 25% conceptos más débiles / 15% contenido nuevo.
- `src/storage/db.ts`: dos almacenes nuevos, `intentos` (un registro por
  intento de ejercicio) y `srs` (una tarjeta FSRS por problema).
- `src/ui/exercises/useSolvableProblem.ts`: toda la mecánica de resolver un
  problema contra el solucionador, extraída de `ExercisesScreen` (que ahora
  la usa sin cambiar de comportamiento) para que la reutilice también
  `TodayScreen`. Centraliza el registro de aprendizaje: cualquier problema
  resuelto actualiza `intentos` y la tarjeta SRS de ese problema, sin
  importar si se llegó a él desde práctica libre en Ejercicios o desde una
  sesión dirigida en Hoy.
- `src/ui/today/TodayScreen.tsx`: pantalla Hoy, ahora la pantalla de inicio
  de la app. Arma la sesión del día con `planSession`, la persona la resuelve
  problema por problema (con un botón "No lo sé" para saltar sin adivinar,
  necesario porque FSRS necesita una nota aunque no se resuelva) y al
  terminar muestra un resumen.
- `src/ui/profile/ProfileScreen.tsx`: pantalla Perfil. Lista de los 5
  conceptos más débiles arriba, y todos los conceptos evaluables agrupados
  por nivel con una barra de progreso (o "Sin datos") debajo.
- Navegación completa a cinco pestañas (Hoy, Jugar, Ejercicios, Revisar,
  Perfil), tal como especifica la sección 6.1 del documento de diseño.

### Decisiones técnicas con alternativas (qué elegí y qué sacrifiqué)

- **La nota FSRS se deriva del resultado, no se le pregunta a la persona.**
  El documento de diseño no especifica esto, y el patrón habitual de FSRS
  (Anki) es pedir una autoevaluación de 4 botones (Otra vez/Difícil/Bien/
  Fácil) después de cada revisión. Nuestra interfaz ya valida cada jugada
  en vivo contra el solucionador, así que pedir además una autoevaluación
  sería redundante y una fricción nueva. Se usa: no resuelto -> Otra vez,
  resuelto con errores en el camino -> Difícil, resuelto a la primera ->
  Bien. "Fácil" no se usa nunca por esta vía: no hay ninguna señal de "esto
  me costó menos de lo esperado" de donde sacarlo sin inventar un umbral de
  tiempo arbitrario.
- **`ERROR_RATE_FACTOR = 10`** (cuántos puntos resta cada error de un
  concepto por cada 100 jugadas totales) no sale de ningún lado: el
  documento de diseño deja "factor" sin especificar. Se eligió para que la
  escala sea legible (un error cada 10 jugadas dificultad ya deja ese
  componente en 0, uno cada 100 lo deja en 90), documentado en el código
  para poder ajustarlo con criterio más adelante si el número se siente mal
  calibrado en la práctica.
- **`SECONDS_PER_PROBLEM = 45`** (para convertir los minutos de sesión en
  una cantidad de problemas) es una estimación a ojo, no un dato medido.
  No hay todavía información real de cuánto tarda una persona en resolver
  estos tsumegos; es un solo número aislado en `session.ts`, fácil de
  ajustar cuando haya datos reales sin tocar el resto del planificador.
- **Perfil se muestra como lista con barras agrupada por nivel, no como un
  radar geométrico** (que es lo que pide el documento de diseño). Un radar
  con dos docenas de ejes es difícil de leer incluso en pantalla grande, y
  mucho más en un teléfono angosto; una lista agrupada por nivel transmite
  la misma idea (progreso organizado por nivel) sin la complejidad de
  dibujar un polígono SVG a mano. Si en algún momento se justifica el
  esfuerzo visual, se puede agregar un radar sin tocar `computeProfiles`.
- **La pantalla Perfil oculta los conceptos sin ninguna fuente de
  evidencia posible** (`conceptsWithEvidence` en `concepts.ts`): los que
  no tienen detector ni generan ejercicios (`LIBERTADES`, `KO`,
  `CONTEO_AREA`, etc.) van a mostrar "Sin datos" para siempre, así que
  incluirlos sería solo ruido.
- **Bug real encontrado al conectar `TodayScreen`**: el patrón ya usado en
  `ExercisesScreen` guardaba el `SolverClient` en un `ref`, poblado recién
  dentro de un `useEffect`. Como mutar un ref no dispara un re-render, el
  hook `useSolvableProblem` (que sí necesita reaccionar cuando el cliente
  pasa de `null` a listo) se quedaba con `null` para siempre en la primera
  carga. Se cambió a `useState` en ambas pantallas: mismo patrón de "crear
  el worker una sola vez", pero con una actualización que sí re-renderiza.
- **Practicar en Ejercicios (sin pasar por Hoy) también cuenta para el
  aprendizaje.** Fue una decisión deliberada, no algo que pidiera el
  documento de diseño explícitamente: separar "practicar" de "que cuente"
  hubiera sido confuso (¿por qué resolver el mismo problema en Ejercicios
  no hace nada, pero en Hoy sí?). Como el registro vive en el hook
  compartido, ambas pantallas se comportan igual sin código extra.

### Qué quedó pendiente

- Todo lo de la fase siguiente: lecciones de los niveles 0 a 3, temas
  adicionales (Sumi-e, Kaya, Nocturno OLED) y accesibilidad avanzada
  (Fase 6).
- El circuito "si un concepto acumula 3 errores en 5 partidas, se reabre su
  lección" no se implementó: no hay lecciones todavía (Fase 6), así que no
  hay nada que reabrir.
- El banco de problemas sigue en 6 (la meta de la Fase 3 era 300). En la
  práctica esto significa que casi toda sesión de Hoy se compone de
  contenido "Nuevo" simplemente porque no hay mucho más para elegir; el
  planificador ya está listo para cuando el banco crezca, no hace falta
  tocarlo.
- La pantalla Perfil no tiene todavía el "historial, ajustes y temas" que
  menciona la sección 6.1 del documento para la pestaña Perfil; eso es
  contenido de la Fase 6 (temas) y de una futura pantalla de ajustes que
  no estaba en el alcance de esta fase.
- `PASE_PREMATURO` (Fase 4) sigue siendo una comparación de un solo paso;
  el perfil hereda esa misma limitación al contar sus errores.

## Fase 4: detectores de errores y pantalla Revisar

### Qué se construyó

- `src/analysis/mistakes.ts`: los 11 detectores marcados con `hasDetector: true`
  en `concepts.ts` (sección 5.4 del documento de diseño): `ATARI_IGNORADO`,
  `AUTOATARI`, `CAPTURA_PERDIDA`, `RELLENO_OJO_PROPIO`,
  `RELLENO_TERRITORIO_PROPIO`, `ESCALERA_FALLIDA`, `CORTE_NO_DEFENDIDO`,
  `TRIANGULO_VACIO`, `PRIMERA_LINEA_TEMPRANA`, `PASE_PREMATURO` y
  `GRUPO_MURIO_SIN_OJOS`. Todos menos el último comparan la posición antes y
  después de cada jugada; `GRUPO_MURIO_SIN_OJOS` es el único detector de
  todo-el-juego (mira cada captura de 4 o más piedras y recorre el historial
  hacia atrás buscando si el grupo llegó a tener dos ojos alguna vez).
  `analyzeGame(size, komi, moves)` reproduce la partida completa y devuelve
  `MistakeEvent[]` ordenados por número de jugada. No reimplementa análisis
  de tablero: reutiliza `getGroup`, `bensonPassAlive`, `isSimpleEye`,
  `solveLadder` y `computeAreaScore` tal como ya existían.
- `src/ui/review/ReviewScreen.tsx`: pantalla Revisar. Lista las partidas
  guardadas (mismo `listGames()` de la pantalla Jugar), corre `analyzeGame`
  sobre la seleccionada y muestra el reporte de errores. Al hacer clic en un
  error se reproduce la partida hasta esa jugada y se muestra el tablero en
  ese punto, con la jugada equivocada marcada como última jugada y, cuando
  el detector puede sugerir una alternativa, un anillo azul sobre el punto
  sugerido.
- `BoardCanvas` gana una prop opcional `hintMove` (un anillo, no una
  piedra) para poder señalar la jugada sugerida sin afectar a las pantallas
  Jugar y Ejercicios, que simplemente no la pasan.
- Navegación: se agrega "Revisar" a la barra de pantallas en `App.tsx`.
- 22 tests nuevos en `tests/analysis/mistakes.test.ts`: un caso positivo y
  uno negativo por detector, con tableros construidos a mano.

### Decisiones técnicas con alternativas (qué elegí y qué sacrifiqué)

- **Las explicaciones del reporte reutilizan `concept.<ID>.summary`** (ya
  existente para la pantalla de Ejercicios) en vez de escribir una plantilla
  de texto nueva por cada `MistakeEvent`, como sugería literalmente el
  documento de diseño (`explicacion: plantilla en español, parametrizada`).
  El resumen del concepto ya explica el error en una frase y ya está
  traducido a los dos idiomas; una plantilla aparte habría sido texto
  duplicado sin agregar información.
- **`MistakeEvent` no guarda un fragmento de SGF reproducible**
  (`posicionSgf` en el documento de diseño). La pantalla Revisar ya tiene en
  memoria la lista completa de jugadas de la partida seleccionada, así que
  reproducir el tablero hasta la jugada del error es una función local
  (`stateAtMove`), no algo que necesite serializarse. Ese campo solo haría
  falta si el reporte tuviera que persistirse fuera de la sesión, que no es
  el caso todavía.
- **`CORTE_NO_DEFENDIDO` solo mira puntos de corte pegados a la jugada
  misma**, no cualquier debilidad que ya existiera en el tablero antes. Sin
  este recorte, una posición con un corte latente desde hace muchas jugadas
  le habría atribuido el error a la jugada equivocada (o a varias jugadas
  seguidas, una por cada turno que el corte siguiera sin defenderse).
- **`TRIANGULO_VACIO` descarta cualquier jugada con una piedra rival
  ortogonalmente pegada antes de jugar, o que deje a un grupo rival en
  atari.** Es más conservador que "no capturó nada": una conexión de
  triángulo vacío jugada bajo amenaza directa (para no dejarse cortar) es
  una jugada correcta, no un error de forma.
- **`PASE_PREMATURO` compara un solo paso** (jugar en cada punto vacío vs.
  pasar) contra el conteo de área crudo, no una lectura completa del resto
  de la partida. Es una señal concreta y barata de calcular (como mucho
  tamaño del tablero llamadas a `computeAreaScore`), no una prueba de que
  esa jugada específica gana la partida, pero alcanza para no pasar por
  alto una captura o una invasión obvia todavía disponible.
- **Bug real encontrado al escribir los tests, no al escribir el
  detector**: `bensonPassAlive` devuelve el tablero vacío entero como
  "territorio" cuando el color todavía no tiene ninguna cadena propia. Es
  una verdad vacua del algoritmo (ninguna región queda descalificada porque
  no hay ninguna cadena a la que pueda dejar de bordear), pero sin la
  guarda `chains.length === 0` en `detectRellenoTerritorioPropio`, la
  primerísima jugada de cualquier partida quedaba marcada como "rellenar
  territorio propio". Se corrigió ahí mismo, no en `bensonPassAlive`,
  porque el uso original de esa función (dentro del propio solucionador de
  vida y muerte) siempre se llama con al menos una piedra ya puesta.
- **Verificar la geometría de las escaleras a mano fue más difícil de lo
  esperado**: no cualquier posición con "un rompedor cerca" hace que
  `solveLadder` devuelva `escaped`. Terminé escribiendo un script de fuerza
  bruta que probaba todas las posiciones de rompedor en el tablero para
  encontrar una que realmente funcionara, en vez de derivarlo a mano. Queda
  como recordatorio para la próxima vez que haga falta un tablero de
  prueba con una escalera real: no asumir la geometría, verificarla con
  `solveLadder` directamente antes de escribir el test.

### Qué quedó pendiente

- Todo lo de fases posteriores: FSRS y pantalla Hoy (Fase 5), lecciones de
  los niveles 0 a 3, temas adicionales y accesibilidad avanzada (Fase 6).
- El circuito de personalización del documento de diseño ("cuando un
  detector dispara en una partida real, se inyectan 3 problemas de ese
  concepto con prioridad alta") no existe todavía: depende de la cola de
  repetición espaciada de la Fase 5, que tampoco existe.
- La pantalla Revisar no tiene forma de reproducir la partida jugada a
  jugada de forma continua (solo salta directamente a la posición de cada
  error). Tampoco permite borrar partidas guardadas.
- `PASE_PREMATURO`, al ser una comparación de un solo paso, no distingue
  entre una jugada que gana territorio real y una que solo agita las aguas
  sin asegurar nada; puede marcar como error un pase que en realidad era
  razonable si la única jugada "grande" disponible en verdad no se puede
  sostener. Está documentado como limitación conocida, no corregido, porque
  arreglarlo de verdad necesitaría una lectura más profunda que una sola
  jugada.

## Fase 3: solucionador, generador de problemas, pantalla de ejercicios

Esta fue la fase más difícil del proyecto, tal como anticipaba el documento
de diseño. Quedó registrada con más detalle porque varias decisiones no son
obvias y alguien (yo, en una sesión futura) va a necesitar el contexto.

### Qué se construyó

- `src/analysis/concepts.ts`: el enumerado `ConceptId` completo de los 4
  niveles, escrito antes que cualquier otro archivo de dominio de esta fase,
  como exige la regla del proyecto. Cada concepto declara si tiene detector
  (Fase 4, todavía no implementado) y si genera ejercicios.
- `src/solver/region.ts`: recorte de una región (rectángulo del grupo
  objetivo más margen) alrededor de una posición.
- `src/solver/tsumego.ts`: solucionador exhaustivo de vida y muerte con
  búsqueda adversarial completa (no solo la línea principal) y caché por
  posición. Exporta `isGroupPassAlive`, reutilizado también en la pantalla
  de ejercicios.
- `src/solver/ladder.ts`: solucionador de escaleras, ambos bandos exploran
  las libertades actuales del grupo perseguido.
- `src/content/`: `seeds.ts` (formas clásicas escritas a mano, la única
  excepción permitida, cada una verificada por el solucionador en
  `tests/solver/tsumego.test.ts`), `problemSgf.ts` (serialización a SGF de
  una posición más su árbol de refutaciones, usando `AB`/`AW` para las
  piedras, `TR` para marcar el grupo objetivo, y `GB`/`GW` para marcar si
  una jugada mantiene vivo al color objetivo), `problemBank.ts` (carga el
  banco generado).
- `tools/generate-problems.ts`: el pipeline completo de la sección 5.6 del
  documento. Se corre con `npm run problems:generate`.
- `src/ui/exercises/ExercisesScreen.tsx`: pantalla de ejercicios, con
  selector de concepto, tablero interactivo y validación en vivo.
- Se agregó navegación (Jugar / Ejercicios) en `App.tsx`, que ahora sí
  corresponde porque hay dos pantallas reales.
- 17 tests nuevos: formas clásicas verificadas a mano (con la derivación
  completa razonada en comentarios, no solo el resultado), solucionador de
  escaleras con y sin rompedor, invariante del generador sobre el banco
  completo (cada problema se vuelve a resolver igual).

### Decisiones técnicas con alternativas (qué elegí y qué sacrifiqué)

- **El "muro" de una región solo está protegido de captura si toca el borde
  de la región.** Si un grupo objetivo cabe entero dentro de la región (su
  única libertad real es el espacio que se está peleando), el solucionador
  sí lo deja capturar de verdad, porque ese es exactamente el resultado que
  hay que poder representar cuando el objetivo es "matar". La simplificación
  (piedras fuera de la región son una pared fija e incapturable) solo aplica
  a lo que está genuinamente fuera del área de análisis. Riesgo: en un caso
  raro esa pared en realidad no estaría viva en el tablero completo. Red de
  seguridad: la regla 1 del proyecto, ningún problema entra al banco sin
  volver a verificarse.
- **El solucionador de vida y muerte no explora "pasar" como jugada
  intermedia optativa**, solo cuando no queda ninguna jugada legal en la
  región. Lo intenté con pasar libre primero y el árbol se volvía inmanejable
  (un problema de 3 puntos tardaba minutos): cada nodo duplicaba sus ramas
  sin aportar información nueva, porque nadie tenukea a mitad de un tsumego
  acotado. Con esta restricción, las mismas formas se resuelven en
  milisegundos. Está documentado en el comentario de `solve()`.
- **El solucionador de escaleras no asume "el perseguidor siempre puede
  forzar con una sola jugada"**, sino que en cada turno ambos bandos
  exploran las libertades actuales del grupo perseguido como candidatas
  (una búsqueda adversarial pequeña, no una heurística de dirección fija).
  Lo intenté primero con la heurística clásica de "reducir a una libertad" y
  daba resultados incorrectos apenas el grupo tocaba espacio abierto,
  porque una escalera real necesita que el perseguidor seguido vuelva a
  acorralar el espacio, no solo la primera vez. El umbral de "4 libertades
  es escape" bajó a 3 tras verificar a mano que con 4 el algoritmo tardaba
  demasiado en descartar posiciones que en la práctica ya estaban perdidas
  para el perseguidor.
- **El árbol de refutaciones que se guarda en SGF está recortado**: en los
  nodos del defensor solo se guardan las jugadas que cumplen el objetivo (no
  las erróneas), y en los nodos del rival como mucho dos respuestas
  representativas. Sin este recorte, una posición de solo 3 puntos generaba
  un SGF de casi 100 KB. La pantalla de ejercicios de todas formas valida
  cualquier jugada del usuario llamando al solucionador en vivo en cada
  paso, así que el recorte del archivo guardado no le quita cobertura al
  ejercicio interactivo, y el árbol que sí se sigue verificando
  exhaustivamente es el que se usó para decidir si el problema se acepta o
  no en el generador.
- **Se desecharon "pirámide de cuatro" y "seis en L"** de las posiciones
  semilla por ahora. Al derivar pirámide de cuatro a mano encontré que en
  realidad es condicional (vive si el dueño juega primero, muere si el rival
  juega primero), igual que la recta de tres, y no "muerta sin importar
  quién juegue" como asumí al leer la lista del documento. Prefiero no
  adivinar la clasificación exacta de estas dos formas bajo presión de
  tiempo. Quedan pendientes para cuando se pueda derivar con calma o,
  todavía mejor, para la revisión de un jugador dan que sugiere el propio
  documento.
- **El generador de autojuego corrió con un alcance reducido** (3 partidas,
  100 simulaciones por jugada) para esta primera tanda, no los parámetros
  más generosos con los que arrancó originalmente el script. Un intento
  inicial con más partidas y más simulaciones no terminó en varios minutos.
  El banco actual tiene 6 problemas (3 semilla más 3 de autojuego). El
  comando `npm run problems:generate` se puede volver a correr para agregar
  más, ajustando `SELF_PLAY_GAMES`, `PLAYOUT_LEVELS` y `MAX_REGION_EMPTY` en
  `tools/generate-problems.ts` según cuánto tiempo se quiera dedicar.

### Qué quedó pendiente

- Todo lo de fases posteriores: detectores de errores y pantalla Revisar
  (Fase 4), FSRS y pantalla Hoy (Fase 5), lecciones de los niveles 0 a 3,
  temas adicionales y accesibilidad avanzada (Fase 6).
- El banco de problemas está lejos de la meta v1 de 300 (mínimo 30 por
  concepto que genera ejercicios). Crece cada vez que se corre el generador.
- Las formas semilla "pirámide de cuatro" y "seis en L" quedaron pendientes,
  ver más arriba.
- El generador solo etiqueta lo nuevo como `DOS_OJOS` o `PUNTO_VITAL` según
  el objetivo (vivir/matar). Etiquetar con más precisión por concepto
  (nakade, ojo falso, red, snapback, etc.) necesitaría una detección de
  patrón más fina, no solo "vivir o morir", y quedó fuera de esta fase.
- No hay manera de saltarse directamente a un problema por id ni de ver
  cuántos problemas hay disponibles por concepto en la interfaz, solo se
  eligen al azar dentro del filtro actual.

## Fase 1: núcleo de reglas y tablero en canvas

### Qué se construyó

- Proyecto Vite + React + TypeScript estricto, nombrado Hoshi, con Vitest para tests.
- `src/core/`: tablero (`board.ts`), grupos y libertades (`groups.ts`), hash Zobrist
  (`zobrist.ts`), motor de reglas con captura, suicidio y superko posicional
  (`rules.ts`), algoritmo de Benson (`benson.ts`), conteo de área (`scoring.ts`)
  y lector/escritor SGF (`sgf.ts`).
- `src/ui/board/BoardCanvas.tsx`: renderizador en canvas, responsive, con puntos
  hoshi según el tamaño del tablero y objetivo táctil pensado para dedo.
- `src/i18n/`: sistema de idiomas propio (contexto de React más diccionarios
  JSON), con selector inglés/español persistido en localStorage.
- `src/App.tsx`: demo funcional para elegir tablero 5x5, 7x7 o 9x9, poner
  piedras, pasar y ver capturas en tiempo real.
- PWA instalable en Android vía `vite-plugin-pwa`: manifest, service worker
  e íconos (192, 512, maskable) generados desde un SVG con `npm run icons:generate`.
- 17 tests en verde cubriendo captura simple y múltiple, suicidio (incluido el
  caso donde una captura libera la única libertad propia), ko y superko
  posicional, conteo de área con puntos neutrales y piedras muertas, Benson en
  cadenas con uno y con dos ojos, y round trip SGF.
- Verificación visual con Playwright: tablero, capturas, marcador de última
  jugada y cambio de idioma funcionan sin errores de consola.

### Decisiones tomadas

- **PWA instalable en vez de app nativa o Capacitor**: se mantiene el stack
  TypeScript/React/Canvas del documento de diseño. Se sacrifica un APK nativo
  en Play Store a cambio de un desarrollo mucho más simple y multiplataforma.
  Si más adelante se necesita distribución en Play Store, Capacitor puede
  envolver este mismo código sin reescribir nada.
- **i18n propio en vez de una librería como react-i18next**: el catálogo de
  textos es chico por ahora. Se sacrifica algo de funcionalidad (pluralización,
  interpolación avanzada) a cambio de cero dependencias nuevas. Si el catálogo
  crece mucho en fases posteriores, conviene reevaluar.
- **Tabla Zobrist con semilla determinista (mulberry32) en vez de Math.random**:
  hace que los tests sean reproducibles y dejará el camino listo para que el
  solucionador de la Fase 3 pueda cachear posiciones de forma estable.
- **El lector/escritor SGF soporta variaciones (árbol de nodos) desde ya**,
  aunque la Fase 1 solo genera partidas lineales. Es la misma estructura que
  va a necesitar el árbol de refutaciones del solucionador en la Fase 3, así
  que no hay que tocar el formato de nuevo más adelante.
- **Interpretación de "sin punto y coma"**: se aplica a toda la prosa (esta
  nota, comentarios, textos de interfaz), no a la sintaxis de TypeScript, que
  los usa por requerimiento del lenguaje.
- **Ícono de la app**: un SVG simple (piedra negra sobre fondo crudo) generado
  a PNG con `sharp`. Es un placeholder funcional para que la PWA sea instalable,
  no un diseño final de marca.

### Qué quedó pendiente

- Todo lo que corresponde a fases posteriores: bot MCTS y pantalla Jugar
  (Fase 2), solucionador y banco de problemas (Fase 3), detectores de errores
  y pantalla Revisar (Fase 4), FSRS y pantalla Hoy (Fase 5), lecciones de los
  niveles 0 a 3, temas adicionales (Sumi-e, Kaya, Nocturno OLED) y ajustes de
  accesibilidad avanzados como modo daltónico y confirmación en dos toques
  (Fase 6).
- El objetivo táctil mínimo de 44 px por intersección en 9x9 se cumple en
  pantallas de 396 px de ancho o más. En teléfonos muy angostos el tablero se
  reduce proporcionalmente por debajo de ese mínimo. Es un compromiso
  consciente para esta fase, a revisar en la fase de accesibilidad.
- Persistencia en IndexedDB (partidas, intentos, srs, perfil) no existe
  todavía. La demo de esta fase no guarda nada entre sesiones.

## Fase 2: bot MCTS, pantalla Jugar y guardado de partidas

### Qué se construyó

- `src/engine/`: generador aleatorio con semilla (`random.ts`), política de
  playout (`playoutPolicy.ts`: ojo simple y respuesta a atari), el algoritmo
  MCTS completo con UCT (`mcts.ts`), el Web Worker que lo corre (`worker.ts`)
  y el cliente que le habla desde el hilo principal con promesas (`client.ts`).
- `src/storage/db.ts`: wrapper mínimo sobre IndexedDB nativo para guardar y
  listar partidas como SGF.
- `src/ui/play/`: `PlayScreen.tsx` (pantalla completa de juego), `GameControls.tsx`
  (tamaño, rival, fuerza del bot, color), `SavedGamesList.tsx` y `strengthLevels.ts`.
  `App.tsx` quedó como envoltorio delgado.
- Se puede jugar local (dos personas) o contra el bot, eligiendo fuerza
  (100/500/2000/8000 simulaciones) y color. El bot piensa en un Web Worker sin
  congelar la interfaz. Al terminar la partida (dos pases seguidos) se calcula
  el resultado, se guarda solo en IndexedDB y aparece en una lista simple.
- 15 tests nuevos: reproducibilidad del generador aleatorio, detección de ojo
  simple y de atari, comportamiento estructural del MCTS (jugada siempre
  legal, reproducible con semilla, respeta el límite de tiempo, no juega
  después del final), y guardado/lectura de partidas con `fake-indexeddb`.
- Verificación visual con Playwright: modo contra el bot responde y no
  bloquea la interfaz, una partida completa termina, muestra resultado y
  aparece en "Partidas guardadas", sin errores de consola.

### Decisiones tomadas

- **Selección final por hijo más visitado, constante de exploración fija en
  1.4**: es la práctica estándar de MCTS/UCT, no había necesidad de exponer
  esto como configuración.
- **Límite de tiempo de seguridad (15 segundos por defecto) además del conteo
  de simulaciones**: hice un benchmark en esta máquina (no un teléfono) y
  8000 simulaciones en 9x9 tardaron unos 20 segundos. Un teléfono gama media
  puede ser bastante más lento. Con el límite de tiempo, el nivel "muy
  fuerte" en la práctica se recorta a lo que alcance a calcular en 15
  segundos, jugando algo más débil de lo teórico pero sin dejar a la persona
  esperando minutos. Esto es exactamente el riesgo que el documento de diseño
  anticipaba ("MCTS demasiado lento en móvil"), con la mitigación que ya
  proponía (límite de tiempo, Web Worker) aplicada desde ahora en vez de
  esperar a que fuera un problema real. La ruta de escape a WebAssembly sigue
  quedando pendiente y no hace falta todavía.
- **La heurística de "ojo simple" del bot no es una afirmación de vida o
  muerte**: es una regla interna para que las partidas aleatorias de la
  simulación no sean absurdas. No aparece en ninguna lección ni se le enseña
  a la persona usuaria, así que no está sujeta a la regla de "nunca escribir
  a mano contenido de Go", que sigue aplicando sin excepciones a lecciones y
  problemas.
- **Guardado automático sin botón**, para que jugar y aprender no tenga
  fricción extra, tal como pedía el objetivo de esta fase.
- **IndexedDB nativo sin librería externa**: sigue siendo un solo almacén con
  dos operaciones. Para testearlo en Vitest (jsdom no trae IndexedDB) se
  agregó `fake-indexeddb` como dependencia de desarrollo únicamente.
- **Cambiar tamaño, rival o color reinicia la partida**; cambiar la fuerza
  del bot no, se aplica recién en la próxima jugada del bot. Reiniciar evita
  posiciones a medio armar que no tendrían sentido con el cambio.

### Qué quedó pendiente

- Todo lo de fases posteriores: solucionador y banco de problemas (Fase 3),
  detectores de errores y pantalla Revisar (Fase 4), FSRS y pantalla Hoy
  (Fase 5), lecciones, temas adicionales y accesibilidad avanzada (Fase 6).
- El resultado final que se muestra es el conteo de área crudo, sin marcado
  asistido de piedras muertas con Benson. Si alguien deja una piedra
  claramente muerta sin capturarla, hoy se cuenta como viva. El marcado
  asistido es una funcionalidad futura, ligada a cuándo se le dé una pantalla
  propia dentro de Revisar o Jugar.
- No hay todavía forma de ver el detalle o revivir una partida guardada,
  solo aparece en la lista con fecha, tamaño, rival y resultado. Eso es
  trabajo de la pantalla Revisar en la Fase 4.
- No se probó todavía el rendimiento del bot en un teléfono real, solo en
  esta máquina de desarrollo. Si 8000 simulaciones se siente demasiado lento
  o débil por el recorte de tiempo, los primeros números a ajustar son
  `DEFAULT_MAX_TIME_MS` en `src/engine/mcts.ts` y los niveles de fuerza en
  `src/ui/play/strengthLevels.ts`.
