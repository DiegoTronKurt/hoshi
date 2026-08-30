# Notas de desarrollo

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
