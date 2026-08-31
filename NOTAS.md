# Notas de desarrollo

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
