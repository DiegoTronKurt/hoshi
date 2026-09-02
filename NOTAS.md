# Notas de desarrollo

## Estilos de bot, bug critico de persistencia, y pulido de Hoy (2026-09-01, sesión aun más posterior)

### Estilos de juego del bot (`30961b3`)

`src/engine/botStyles.ts`: territorial/influencia/combativo sesgan la
elección de jugada en los playouts de MCTS con un peso simple sobre
distancia a borde/piedras propias o rivales (BFS multi-fuente, una vez por
jugada, no por candidato). "Estándar" es el mismo camino de código de
siempre sin ningún peso, así que sigue siendo el bot de referencia si no se
elige otro estilo — incluido a pedido explícito del usuario junto con los
otros tres.

### Bug crítico: el puerto efímero del servidor local borraba todo al reabrir la app

Al investigar por qué el usuario sentía que "no se guardaban" tema/tablero,
la causa no estaba en `localStorage` (`src/ui/settings/index.tsx` ya
persistía todo correctamente) sino en `hoshi-flutter/lib/local_web_server.dart`:
el servidor HTTP que sirve la PWA dentro del WebView hacía
`HttpServer.bind(loopback, 0)`, puerto efímero, distinto en cada arranque.
El WebView particiona `localStorage`/IndexedDB por origen
(esquema+host+**puerto**), así que cada apertura de la app era, para
efectos de almacenamiento, un sitio nuevo: se perdían configuración,
partidas guardadas y calendario SRS cada vez que se cerraba la app. Arreglado
fijando el puerto (`51823`, con fallback a uno efímero solo si estuviera
ocupado). Subida versión a 1.4.0+7 y regenerado `app-release.aab` con este
fix más todo lo de esta sesión.

### Tema Bambú (verde) removido, tarjetas de "Hoy" rediseñadas

A pedido explícito, se sacó el tema de color "Bambú" de Ajustes (quedan 5 +
"seguir sistema"). La lista de desafíos del día en Hoy pasó de filas planas
de una sola línea a tarjetas con insignia numerada coloreada según el
motivo (repaso/área débil/nuevo), mismo lenguaje visual que ya usan las
tarjetas de nivel en Aprender — hecho sin poder ver de nuevo el mockup
original que inspiró el pedido, así que vale la pena que el usuario lo
revise y redirija si no es lo que tenía en mente.

## Rediseño visual, respaldo de datos y dificultad adaptativa (2026-09-01, sesión posterior)

Cuatro piezas de trabajo separadas, cada una en su propio commit.

### Rediseño visual completo (`670e523`)

A partir de mockups de referencia que trajo el usuario (inspiración, no
especificación literal): nav inferior fijo con iconos dibujados a mano
(`src/ui/icons/NavIcons.tsx`, sin librería nueva) reemplazando la barra de
pestañas superior; `App.css` convertido de hex literales a variables CSS
(`--hoshi-*`) para soportar 6 temas de color de app seleccionables (Clásico,
Piedra, Bambú, Amanecer, Noche, Pizarra) más "seguir sistema", separados del
sistema de temas de *tablero* que ya existía (`minimo`/`sumie`/`kaya`/
`nocturno`, sin tocar); racha de práctica opcional (toggle en Ajustes,
`src/learning/streak.ts`, derivada de `attempts`/`games` sin store nueva,
con período de gracia de un día completo antes de romperse); rediseño en
tarjetas de Aprender/Ejercicios/Revisar/Jugar, con una función nueva real en
Revisar ("practicar este concepto" salta a Ejercicios ya filtrado). Sin
mascota ni imágenes generadas por IA en ningún lado, a pedido explícito.

### Respaldo de datos: exportar/importar JSON (`3dc7b89`)

Subió de prioridad en el roadmap por la publicación inminente en Play
Store. `src/storage/backup.ts` exporta partidas + intentos + tarjetas SRS +
preferencias de localStorage a un archivo descargable; importar valida la
estructura completa antes de tocar cualquier dato (rechaza sin escribir
nada si la validación falla) y **reemplaza**, no fusiona, con confirmación
explícita en pantalla (no un `confirm()` nativo del navegador, para no
depender de que el WebView de Flutter soporte diálogos JS).

### OJO_FALSO: segundo intento, mismo resultado, pero con la razón exacta esta vez

Se retomó el intento con el módulo de validación reutilizable que el
roadmap pedía como primer paso (`src/content/positionValidation.ts`:
`isSingleGroup`, `hasNoZeroLibertyGroups`, con tests — commit `5d5d0b3`).
Con eso puesto, se probaron varias construcciones directamente contra
`solve()` (no a mano) y se llegó a una prueba rigurosa de por qué la técnica
actual del banco (`buildEnclosedShape`, llenar todo el tablero de blanco y
poner la pared negra encima) **no puede representar un ojo falso en
absoluto**, sin importar cómo se acomoden las piedras: como todo punto que
no es pared ni espacio de ojo ya está ocupado desde el inicio, el color de
un punto diagonal nunca cambia la cantidad de libertades del grupo — pared
negra u blanco de fondo, ese punto nunca es una libertad de cualquier
forma. Verificado empíricamente: se reconstruyó `dosOjosSeparados` quitándole
un punto diagonal (sustituido por blanco) y el veredicto de vida/muerte del
solucionador fue idéntico al de la forma sin el defecto.

La conclusión real (coincide con teoría de Go, no es una limitación del
proyecto): un ojo falso solo importa cuando la piedra diagonal enemiga
habilita **capturar una piedra específica de la pared** en una secuencia
real — eso exige una posición con una piedra de pared genuinamente débil y
una carrera de captura verificable, un tsumego más avanzado del que
cualquier plantilla tipo `buildEnclosedShape` puede expresar. Queda en
stand-by por decisión del usuario. Quien lo retome: no repetir la técnica
de "llenar todo el tablero"; partir de una posición dispersa (como
`buildGetaSeed`/`buildSnapbackSeed`) donde la pared tenga una libertad real
fuera del ojo marcado, capturable en una secuencia de 2+ jugadas.

### Dificultad adaptativa del bot + presupuesto de tiempo (`54cb8b3`)

Cierra la sección 2.4 del roadmap. Modo "Adaptativo" nuevo en Jugar (junto
al "Manual" existente): ajusta el nivel del bot según la tasa de victoria de
las últimas 10 partidas contra él (sube un nivel si ≥65%, baja si ≤35%,
apuntando a ~50%), derivado de `listGames()` sin estado propio nuevo
(`src/learning/adaptiveDifficulty.ts`). Partidas guardadas antes de este
cambio no tienen `humanColor`/`botStrengthId` y se ignoran en el cálculo en
vez de asumírseles un valor. El presupuesto de tiempo (`maxTimeMs`) ya
existía en el motor MCTS (`src/engine/mcts.ts`) pero nunca se usaba desde la
UI ni el worker; ahora cada `StrengthLevel` define su propio techo (3s a
15s) para que un dispositivo lento nunca se cuelgue esperando al bot en vez
de simplemente correr con menos playouts de los pedidos.

## Banco de problemas: de 6 a 71 entradas, 8 de 9 conceptos

### Qué se construyó

Fase C había encontrado que el banco (`src/content/problems/bank.json`)
tenía solo 6 entradas cubriendo 2 de los 9 conceptos con
`generatesExercises: true`. Investigando `tools/generate-problems.ts`
resultó ser una brecha más profunda que volumen: el generador solo sabía
etiquetar `kill`→`PUNTO_VITAL` y `live`→`DOS_OJOS`, sin ninguna lógica para
los otros 7. Se dividió el trabajo en dos pistas según si el concepto encaja
en el formato `Problem`/`solve()` existente (región acotada, árbol de
vida-muerte) o no.

- **Utilidad nueva, `core/board.ts`**: `BOARD_TRANSFORMS` (las 8
  transformaciones diedrales de un tablero cuadrado), `transformBoard`,
  `transformPoint`. Multiplica una plantilla verificada una vez en hasta 8
  posiciones reales del banco sin derivar geometría nueva a mano cada vez;
  cada variante igual se re-verifica con el solucionador antes de
  aceptarse, la transformación nunca se asume que preserva el resultado.
- **`content/seeds.ts` reescrito**: `piramideDeCuatro` (pendiente desde
  Fase 3) entra al generador. Las formas semilla ahora llevan un
  `conceptId` explícito por espectro en vez de un `DOS_OJOS` genérico:
  objetivo `live` → `DOS_OJOS` (el defensor logra dos ojos separados),
  objetivo `kill` sobre un espacio de ojo → `NAKADE` (el atacante juega
  adentro para reducirlo a un ojo, calza con la definición del concepto
  sin importar si la forma es condicional o muerta sin más). Se agregan
  plantillas nuevas de geta y snapback, reutilizando exactamente las
  posiciones ya verificadas en las lecciones n3-l4/n3-l5 de Fase 6 (mismo
  tablero, mismas piedras), en vez de derivar geometría nueva.
- **`tools/generate-problems.ts` reescrito**: autojuego con presupuestos de
  playouts distintos por color (documento, sección 5.6: "100 vs 2000
  produce posiciones con errores explotables"; en la práctica 100 vs 800,
  ver nota de rendimiento abajo), alternando cuál color juega fuerte por
  partida. `CAPTURA_SIMPLE` se distingue de `PUNTO_VITAL` por profundidad
  de la solución (una captura resuelta en 1 jugada no necesitó lectura
  real).
- **Pista 2, capa de datos (sin UI todavía)**: `ESCALERA` y `DOBLE_ATARI`
  no encajan en `Problem`/`solve()` — una escalera corre por todo el
  tablero (por eso existe `solver/ladder.ts` aparte, con la región acotada
  rota ese supuesto), y un doble atari es reconocimiento de una sola
  jugada, no una lectura. Cada uno tiene su propio tipo de dato nuevo
  (`content/ladderProblem.ts`, `content/doubleAtariProblem.ts`, con su
  propia serialización SGF vía propiedades `ZKIND`/`ZRUNNER`/`ZCHASER` o
  `ZCOLOR`/`ZEXPECTED`) y su propio generador
  (`tools/generate-ladder-problems.ts`,
  `tools/generate-double-atari-problems.ts`), verificados con
  `solver/ladder.ts` y el nuevo `solver/doubleAtari.ts` respectivamente, no
  con `solve()`. `solver/doubleAtari.ts` reutiliza `getGroup` directo,
  mismo patrón que ya usan varios detectores de `analysis/mistakes.ts`.
  **Falta la pantalla**: `ExercisesScreen`/`TodayScreen` todavía solo saben
  renderizar `Problem` vía `useSolvableProblem`; conectar estos dos bancos
  nuevos (`ladders.json`, `double-atari.json`) a la interfaz queda
  pendiente a propósito, para no mezclar el trabajo de generación de
  contenido con un rediseño de pantalla en la misma pasada.

### Resultado

| Concepto | Antes | Ahora | Fuente |
|---|---|---|---|
| DOS_OJOS | 4 | 12 | semillas + autojuego |
| PUNTO_VITAL | 2 | 4 | autojuego |
| NAKADE | 0 | 10 | semillas |
| RED_GETA | 0 | 4 | semilla (n3-l4) × simetría |
| SNAPBACK | 0 | 8 | semilla (n3-l5) × simetría |
| CAPTURA_SIMPLE | 0 | 5 | autojuego |
| ESCALERA | 0 | 12 | plantillas × simetría (banco aparte, sin UI) |
| DOBLE_ATARI | 0 | 16 | plantillas × simetría (banco aparte, sin UI) |
| OJO_FALSO | 0 | 0 | pendiente, ver abajo |

71 problemas verificados en total (antes 6), 8 de 9 conceptos con contenido
real (antes 2). Todos re-verificados por `tests/content/problem-bank.test.ts`
en CI, ninguno aceptado sin que el solucionador lo confirme.

### Un bug real encontrado y corregido: SGF de 232KB por entrada

`problemSgf.ts` limitaba a 2 las variaciones guardadas del atacante, pero no
las del defensor: en una forma muerta sin importar quién juega primero
(cuadrado de cuatro, y cualquier `NAKADE`/`PUNTO_VITAL` con la misma
propiedad), *todos* los intentos de defensa "cumplen el objetivo" (todos
refutan igual), así que se guardaban todos, recursivamente. Dos entradas de
`NAKADE` llegaron a 232KB cada una; el `bank.json` completo pesaba 1.1MB
para 43 problemas, e inflaba el bundle principal de ~360KB a ~1.46MB.
Corregido acotando también las respuestas del defensor a un par
representativo (`MAX_DEFENDER_REPLIES_STORED`), con el mismo razonamiento
que ya justificaba el límite del atacante: la app valida cualquier jugada
del usuario en vivo con el solucionador, nunca contra el árbol guardado, así
que el recorte no le quita cobertura al ejercicio. Test de regresión en
`tests/content/problemSgf.test.ts`.

### OJO_FALSO: por qué quedó pendiente, y qué se aprendió

Construir a mano una posición de ojo falso que el solucionador confirme
matable resultó mucho más frágil de lo esperado — varios intentos
sucesivos rotos por el mismo tipo de error de conectividad, no por teoría
de Go incorrecta:

- Con la técnica de `buildEnclosedShape` (rellenar todo el tablero de
  blanco), remover las piedras del muro que forman las diagonales "falsas"
  de un ojo repetidamente aislaba una piedra vecina o dejaba un bolsillo
  de blanco encerrado sin conexión al exterior — posiciones ilegales, no
  detectadas hasta correr el solucionador (o, en un caso, hasta escribir un
  chequeo explícito de conectividad).
- La causa raíz: las diagonales de un punto son siempre vecinas
  ortogonales de sus propias piedras de anillo, así que "quitar una
  diagonal" casi siempre le quita a esa piedra de anillo su único camino de
  vuelta al resto del grupo. Un bloque **sólido** de negro con dos
  agujeros (en vez de un anillo hueco) evita el bolsillo interior por
  construcción, pero el mismo problema de conectividad reaparece en el
  borde entre el agujero y el resto.
- Quedan escritas (y luego descartadas del repo, no vale la pena
  conservar el script) funciones de verificación reutilizables para el
  próximo intento: chequeo de "un solo grupo conectado" y de "fondo blanco
  sin bolsillos aislados", ambas con `getGroup` directo — el próximo
  intento debería usarlas desde el principio en vez de razonar la
  geometría a mano primero.

### Nota de rendimiento: por qué geta y snapback no pueden usar profundidad 8

Las formas de ojo (semillas con `buildEnclosedShape`) acotan la región a
pocos puntos vacíos porque el resto del tablero ya está relleno de blanco.
Geta y snapback parten de un tablero casi vacío (3 a 10 piedras nada más):
sin relleno que acote la búsqueda, una región abierta con profundidad 8
explota combinatoriamente (probado y revertido: más de 15 minutos sin
terminar, contra menos de 4 segundos a profundidad 4-5). Se usa profundidad
4 para geta y 5 para snapback en la generación, y el mismo criterio se
replicó en `tests/content/seeds.test.ts` y `tests/content/problem-bank.test.ts`
para que la re-verificación en CI no vuelva a colgarse.

---

## Estado general del proyecto (2026-09-01)

Análisis completo pedido por el usuario, comparando lo construido contra
`go-trainer-v1-diseno.md` y `go-trainer-post-v1-roadmap.md` completos (no
solo la última fase) y, nuevo en esta pasada, también contra
`go-trainer-especificacion-pantallas.md` (vive en `Go_app/`, fuera de este
repo — documento de maquetas de UI, con su propia numeración de secciones,
independiente de la del documento de diseño principal). A diferencia de las
entradas de fase de más abajo, esta sección se actualiza cada vez que valga
la pena repetir este ejercicio, no queda congelada en una fecha; esta
versión reemplaza a la de 2026-08-31.

### Qué cambió desde el 31 de agosto

- **Banco de problemas: de 6 a 71 entradas, 8 de 9 conceptos con
  ejercicios.** Ver la entrada de arriba en este mismo archivo para el
  detalle completo (simetría diedral, el bug de SGF de 232KB, y por qué
  `OJO_FALSO` sigue en cero). Cambia el punto 3 más abajo: la brecha de
  contenido más grande del proyecto ya no es "6 problemas", es "falta un
  concepto entero".
- **TWA verificada de punta a punta.** El bloqueo de `assetlinks.json` que
  esta sección anterior dejaba abierto ("falta que el usuario complete la
  publicación... y me pase el fingerprint de Play App Signing") está
  cerrado: existe el repo `diegotronkurt/diegotronkurt.github.io` sirviendo
  `assetlinks.json` en la raíz del dominio (GitHub Pages solo sirve un repo
  de proyecto bajo `/hoshi/`, nunca en la raíz — de ahí el repo aparte), con
  ambos fingerprints (upload key local y Play App Signing). Verificado no
  solo con `curl` sino instalando el APK firmado en un emulador Android
  recién armado en esta máquina (SDK solo traía platform-tools/build-tools,
  sin emulator ni system-image) y confirmando en el logcat real
  `SingleHostAsyncVerifier: ... --> true`, con la app abriendo a pantalla
  completa sin barra de navegador.
- **Pista 2 (ESCALERA y DOBLE_ATARI) conectada a Ejercicios y Hoy.** La
  capa de datos que esta sección anterior marcaba "sin UI todavía" ya es
  jugable en ambas pantallas. De paso, verificar la escalera jugando a mano
  en el navegador (no solo con tests) encontró un bug real en
  `solveLadder`: cuando la única libertad que le queda al que huye sería
  suicidio para él (acorralado en una esquina), la recursión de una sola
  llamada lo daba por capturado sin que el perseguidor jugara esa última
  piedra — el ejercicio quedaba en "resuelto" con las piedras todavía
  dibujadas. Corregido con `simulateLadder()`, cubierto con tests sobre las
  12 escaleras del banco. Detalle completo en el commit `5ecae9b`.

### Qué cambió más tarde el mismo día: empaquetado Android, de TWA a WebView en Flutter

Después de cerrar lo de arriba, el usuario instaló la app desde Play Store
en su teléfono real (no el emulador) y la abrió tocando el ícono: se veía
con barra de navegador de Brave (URL, ícono compartir, menú de tres
puntos, X para cerrar) en vez de a pantalla completa — el mismo síntoma
que la verificación de TWA ya daba por resuelto.

- **Diagnóstico.** Brave, no Chrome, es el navegador predeterminado del
  teléfono. La verificación de Digital Asset Links para una TWA la hace en
  tiempo de ejecución el navegador que Android elige para renderizarla —
  en las pruebas anteriores de esta sesión ese navegador fue Chrome (de
  ahí el `SingleHostAsyncVerifier` en el logcat), nunca se probó con
  Brave. Se confirmó paso a paso que `assetlinks.json` en sí no era el
  problema: el fingerprint de la upload key coincide con
  `keytool -list -v` sobre `android.keystore`, y el usuario confirmó desde
  Play Console que el fingerprint de Play App Signing en el archivo
  también es el correcto. Limpiar caché y datos tanto de Hoshi como de
  Brave no cambió nada. Conclusión: es una limitación de soporte de Brave
  para TWA, no algo corregible desde `assetlinks.json` ni desde el APK.
- **Decisión (pedida explícitamente por el usuario, comparando con una app
  Flutter suya anterior sin este problema): reemplazar el empaquetado TWA
  de Bubblewrap por un shell nativo en Flutter con un WebView embebido.**
  Se evaluaron dos alcances — reescribir toda la app en Dart (semanas,
  descartado, no se justifica por un bug de empaquetado) versus un shell
  delgado que solo envuelve la PWA existente en un WebView propio (sin
  navegador de por medio, sin verificación de Digital Asset Links posible
  porque no aplica). Se eligió el shell delgado explícitamente para no
  duplicar el trabajo de interfaz/contenido que sigue pendiente (ver más
  abajo): toda mejora futura de UI, banco de problemas o rendimiento sigue
  viviendo una sola vez, en el código React/TS de siempre.
- **Qué se construyó, en `hoshi-flutter/` (proyecto nuevo, hermano de
  `hoshi-android/`, todavía sin `git init`):**
  - Flutter SDK 3.47.2 (canal stable) instalado desde cero en
    `C:\flutter` (clonado del repo oficial); reutiliza el Android SDK y el
    JDK 17 ya configurados para Bubblewrap. `flutter doctor` en verde para
    Android (Chrome/Visual Studio quedan en rojo a propósito, son para web
    de escritorio, no aplican).
  - Proyecto creado con `--org com.hoshi --project-name app` para que el
    `applicationId` generado sea exactamente `com.hoshi.app`, igual que la
    ficha de Play Store ya publicada.
  - `lib/main.dart`: un único `WebViewController` (paquete
    `webview_flutter`) apuntando a `https://diegotronkurt.github.io/hoshi/`
    (el `startUrl` que ya tenía `twa-manifest.json`), JavaScript sin
    restricciones, color de fondo `#F2EEE4` y de status bar `#1A1A1A`
    (los mismos de `twa-manifest.json`), orientación fija a portrait,
    manejo del botón atrás de Android delegado al historial del WebView
    (`PopScope` + `controller.canGoBack()`), pantalla de carga y de error
    de red con botón reintentar.
  - `AndroidManifest.xml`: se agregó `INTERNET` a mano — la plantilla por
    defecto de Flutter no lo declara y sin eso el WebView no tiene acceso
    a red.
  - Íconos del launcher (`mipmap-*`, ícono adaptativo) copiados tal cual
    desde `hoshi-android/app/src/main/res/`, no regenerados, para que la
    ficha de Play Store no cambie de ícono.
  - Firma configurada para reusar la **misma** `android.keystore`/alias
    `upload` que ya usaba Bubblewrap, vía `android/key.properties` (ya
    ignorado por `.gitignore` por defecto de Flutter, junto con
    `**/*.keystore`) — necesario para poder actualizar la ficha existente
    en vez de crear una nueva.
  - Versión subida a `1.1.0+3` (`versionCode 3`) en `pubspec.yaml`, por
    encima del `versionCode 2` que ya estaba en Play Store.
- **Verificado en el emulador `hoshi_test`** (no solo compilado):
  `flutter run --release` instaló la build de verdad (la primera corrida
  bajó el NDK r28c completo, unos cientos de MB) y, por captura de
  pantalla, la app abre sin ninguna barra de navegador, ícono ni menú —
  solo la barra de estado de Android y el contenido de la PWA. Un tap
  dentro de la app navegó correctamente dentro del WebView (cayó en la
  pestaña Revisar), y `adb shell dumpsys window` confirmó que la ventana
  en foco es `com.hoshi.app/.MainActivity`, la actividad nativa real, no
  una pestaña de navegador.
- **AAB de release generado**:
  `hoshi-flutter/build/app/outputs/bundle/release/app-release.aab`
  (42.4MB, `versionCode 3`, firmado con la upload key de siempre). Todavía
  no subido a Play Console — eso queda del lado del usuario.
- **`versionCode 3` rechazado por Play Console** al intentar subirlo (sin
  detalle adicional del error de parte del usuario). Sin ningún cambio de
  código de por medio, se subió `pubspec.yaml` a `1.1.1+4` (`versionCode
  4`) y se regeneró el AAB de release con `flutter build appbundle
  --release` — mismo `app-release.aab`, ahora de 44.5MB, mismo firmado.
- **`versionCode 4` subido a Play Console y publicado.** El usuario
  actualizó la app en su teléfono real (el mismo con Brave como navegador
  predeterminado que mostraba la barra de navegador con la TWA) y confirmó
  que ahora abre a pantalla completa como corresponde. Con esto el shell
  Flutter con WebView queda validado en el escenario real que motivó el
  cambio, no solo en el emulador — episodio cerrado.

### Empaquetado offline (2026-09-01, más tarde): la app ya no depende de red

El roadmap maestro (`go-trainer-roadmap-maestro.md`, sección 4.2) marcaba
como riesgo real y bloqueante-antes-de-publicar que el shell de Flutter
cargaba la PWA desde `https://diegotronkurt.github.io/hoshi/` en cada
apertura: sin conexión, pantalla de error. Contradice el principio de "la
app corre en el dispositivo" y es una causa de rechazo activa en la
política 4.3 de Play Store para apps que envuelven una URL sin manejo de
estado sin conexión. Resuelto:

- **`hoshi/dist/` (el build de producción de la PWA, 504KB) se copia a
  `hoshi-flutter/assets/webapp/`** y se declara como asset de Flutter en
  `pubspec.yaml`. Script `hoshi-flutter/sync-webapp.ps1` para repetir la
  copia cada vez que `hoshi/` cambie, antes de un nuevo build — necesario
  porque `hoshi-flutter/` sigue sin `git init`, así que nada de esto queda
  versionado ahí, solo reproducible por script.
- **Servidor HTTP embebido en Dart** (`hoshi-flutter/lib/local_web_server.dart`),
  sin dependencias nuevas: `dart:io HttpServer` en loopback
  (`127.0.0.1`, puerto efímero) que resuelve cada request contra
  `rootBundle` (el asset bundle de Flutter), despojando el prefijo
  `/hoshi` antes de mapear a `assets/webapp/`. Se eligió esto en vez de
  `WebViewController.loadFlutterAsset` porque el build de la PWA usa rutas
  absolutas (`base: '/hoshi/'` en `vite.config.ts`, mismo build que sirve
  GitHub Pages) y el mapeo interno de `loadFlutterAsset` no da control
  sobre esa estructura de rutas; el servidor propio sí.
- **`network_security_config.xml` nuevo**, permitiendo tráfico cleartext
  (`http://`) solo para `localhost`/`127.0.0.1` — Android bloquea
  cleartext por defecto desde API 28, incluso hacia loopback. Sin esto el
  WebView tira `ERR_CLEARTEXT_NOT_PERMITTED` en silencio.
- **Verificado en el emulador con la red realmente cortada**
  (`svc wifi disable` + `svc data disable`, confirmado con
  `adb shell ping` fallando con "Network is unreachable" y
  `dumpsys` mostrando "not connected"), no solo con el argumento de que
  "debería funcionar": la app se forzó a cerrar y reabrir desde cero en
  ese estado, la pantalla Hoy cargó con sus problemas, y se jugó una
  partida contra el bot completa (el Web Worker del MCTS, un chunk JS
  aparte del bundle principal, también se sirve local y respondió sin
  error). Cero errores en el log de Flutter durante toda la prueba.
- **AAB de release regenerado**: `versionCode 5` (`1.2.0+5`, subido de
  minor por ser un cambio funcional real, no un parche), 43.0MB, mismo
  firmado de siempre. Todavía no subido a Play Console — queda del lado
  del usuario, igual que antes.
- **`git init` hecho en `hoshi-flutter/`** (roadmap maestro, sección 4.3),
  commit inicial `aaa16f0` con los 49 archivos del proyecto (incluye
  `assets/webapp/`, ya que sin eso el proyecto no reproduce el build
  offline). Sin remoto todavía, solo historial local. Confirmado antes del
  commit que `key.properties`, `**/*.keystore`, `.idea/` y `build/` quedan
  fuera vía los `.gitignore` (raíz y `android/`) que trae la plantilla de
  Flutter por defecto.
- **A propósito, sigue sin hacerse**: no se generó un APK de debug para
  probar por sideload en el teléfono real antes de gastar una publicación
  de Play Console (el flujo real terminó siendo publicar directo y
  confirmar después, ver más abajo). El proyecto `hoshi-android/`
  (Bubblewrap) sigue existiendo tal cual, sin borrar, pero queda superado
  como método de empaquetado para Play Store.

### v1.1: radar de 6 ejes, insight conocimiento vs aplicación, rediseño de Hoy

Primera pasada sobre la sección 2 del roadmap maestro (`v1.1 = alinear la
interfaz con la especificación de pantallas`), después de terminar el
empaquetado offline de Android y el `git init` de `hoshi-flutter/` de más
arriba. Commit `64379ae`.

- **Radar de 6 ejes** (`src/analysis/axes.ts`, `src/ui/profile/RadarChart.tsx`,
  SVG a mano, sin librería nueva). Los 26 `ConceptId` se agrupan en Reglas y
  conteo, Captura, Vida y muerte, Lectura, Forma y Juicio — una agrupación
  temática propia (el documento nunca especificó cuáles 6 ejes), documentada
  en el propio archivo. Es la vista principal de Perfil ahora; la lista de
  barras por concepto que ya existía sigue ahí, detrás de un botón "ver
  detalle" (roadmap sección 2.3: coexisten, no se reemplaza una por otra).
  Un eje sin datos se grafica en el centro con un punto hueco en vez de
  ocultarse, para no cambiar la forma del polígono cada vez que un eje
  arranca a tener datos.
- **Insight de conocimiento vs. aplicación** (`src/learning/insights.ts`)
  sobre `ConceptProfile.byContext`, que ya traía correcto/incorrecto por
  contexto desde la Fase B — esto fue agregación y presentación, no datos
  nuevos. Exige mínimo 3 observaciones en cada contexto antes de mostrar una
  comparación. Cobertura real: como la mayoría de los detectores de partida
  solo emiten el caso "incorrecto" (documentado ya en Fase B), hoy esto sale
  significativo sobre todo para `ATARI_IGNORADO` y `ESCALERA`, los únicos
  con caso "correcto" implementado — no es un bug nuevo, es la misma
  cobertura parcial ya conocida.
- **Hoy, rediseñada**: encabezado con el nivel actual (`currentLevel()` en
  `learning/profile.ts` — heurística nueva, el nivel más bajo con algún
  concepto todavía no dominado; no existe ningún registro de "nivel
  completado" en la app, así que se deriva del perfil en vez de inventar un
  estado nuevo que persistir), tarjeta de foco con el motivo real (
  `training-policy/session.ts` ahora expone `SessionReasonDetail`: días de
  atraso si es repaso vencido, puntaje del concepto si es área débil), meta
  diaria como texto simple, botón "Jugar contra el bot" con el kyu visible.
- **Escala kyu para la fuerza del bot**, reemplazando "Weak (100)" /
  "Normal (500)" etc. en `strengthLevels.ts` y en el selector de Jugar.
  Los valores (~25/20/15/10 kyu para 100/500/2000/8000 playouts) son un
  **estimado sin calibrar jugando partidas reales** — el roadmap lo pide
  explícitamente calibrado a mano, no de memoria, y no había tiempo para
  jugar suficientes partidas contra cada nivel en esta pasada. Por eso la
  UI dice literalmente "estimated"/"estimado" en vez de mostrar una
  precisión que no existe. **Pendiente: el usuario debería jugar contra
  cada uno de los 4 niveles y ajustar `approxKyu` en `strengthLevels.ts`
  si el kyu mostrado no coincide con la fuerza real percibida.**
- **Meta diaria editable en Ajustes** (`ui/settings/index.tsx`,
  `hoshi-daily-goal` en localStorage, default 3, rango 1-20).
- Verificado con Playwright contra el dev server (no solo `tsc`/tests):
  capturas de Hoy, Perfil (vacío y con datos sembrados a mano en
  IndexedDB para ver el radar y la lista de más débiles con contenido
  real), detalle por concepto, Ajustes y Jugar, en inglés y español, sin
  errores de consola. Los 179 tests existentes siguieron en verde
  (`session.test.ts` no se rompió con el nuevo campo opcional
  `reasonDetail`).
- **No se tocó en esta pasada** (roadmap sección 2.4, quedan para la
  siguiente): dificultad adaptativa + presupuesto de tiempo para el bot
  (requiere tocar el motor MCTS en `engine/`, no solo la UI), y estilos de
  bot manuales (opcional, el roadmap ya lo marca como lo primero a
  recortar si falta tiempo).

### Qué está completo y coincide con el documento de diseño

- Las 6 fases de v1 (F1-F6) están cerradas, commiteadas y con tests en verde:
  núcleo de reglas + SGF + tablero en canvas (F1), bot MCTS en Web Worker +
  pantalla Jugar (F2), solucionador exhaustivo + pantalla Ejercicios (F3),
  detectores de errores + pantalla Revisar (F4), FSRS + perfil + pantalla Hoy
  (F5), 29 lecciones + 3 temas nuevos + sonido + Ajustes (F6).
- Zobrist incremental (`core/zobrist.ts`), algoritmo de Benson
  (`core/benson.ts`), lector/escritor SGF, todo tal como especifica la
  sección 5.1.
- El invariante del generador de problemas (documento, sección 8, punto 3) sí
  está implementado y corre en CI: `tests/content/problem-bank.test.ts`
  reverifica con el solucionador cada entrada del banco en cada push.
- Bot con los 4 niveles de fuerza exactos del documento (100/500/2000/8000
  playouts), corriendo en Web Worker, UI nunca bloqueada.
- Tipografía: serif para prosa de lección, cifras tabulares en el panel de
  capturas — cumple la sección 6.2.
- "Hoy" es la pantalla de inicio (`screen` por defecto en `App.tsx`), como
  pide la sección 6.1.
- Los 4 temas de tablero (Mínimo, Sumi-e, Kaya, Nocturno OLED) coinciden en
  nombre y descripción con `go-trainer-especificacion-pantallas.md` sección
  3, palabra por palabra.
- ESCALERA y DOBLE_ATARI ya son ejercicios jugables (no solo datos), en
  Ejercicios y Hoy, con FSRS registrando el intento igual que cualquier
  tsumego.

### Desviaciones deliberadas frente al documento (ya decididas y documentadas)

- **Navegación de 6 pestañas, no 5**: se mantiene "Ejercicios" separado de
  "Aprender" (el documento solo listaba 5 rutas). Decisión de Fase 6, con su
  motivo ya registrado en esa entrada.
- **Lecciones como datos TypeScript, no MDX** (sección 5, `content/`).
  Decisión de Fase 6.
- **Nombres de campo en inglés** en `MistakeEvent`/`ConceptOccurrence` y en
  `Concept`, en vez del español del boceto del documento (`conceptoId`,
  `numeroJugada`, etc.). Consistente con el resto del código desde la Fase 4;
  el español queda para prosa y texto de UI, nunca para identificadores.
- **Perfil no es un store propio de IndexedDB.** El documento (sección 7)
  lista `perfil` como cuarto almacén; en la práctica `computeProfiles()`
  recalcula todo on-demand desde `intentos` y `partidas` en cada carga, sin
  persistir un estado derivado. Es más simple y evita que el perfil quede
  desincronizado del origen de verdad; se reafirmó esta misma decisión al
  diseñar `ConceptOccurrence` en la sección 1 del roadmap post-v1.
- **Accesibilidad avanzada en stand-by** (sección 6.4 completa: modo
  daltónico, confirmación en dos toques, navegación por teclado). Decisión
  explícita del usuario en Fase 6, a cambio de piedras con volumen/sombra y
  sonido al jugar. El objetivo táctil de 44px se cumple en los controles de
  la interfaz, pero no se diseñó a propósito para cada intersección del
  tablero (el tablero es canvas, no elementos DOM individuales).

### Brechas reales, no decididas a propósito

- **Banco de problemas: 71 entradas, no 300, y `OJO_FALSO` en cero.** Mejoró
  mucho frente a las 6 entradas de la sección anterior (ver arriba), pero
  sigue lejos del objetivo del documento, y ahora la brecha más visible no es
  el número sino que un concepto entero de nivel 2 no tiene ni un solo
  ejercicio — cualquier lección u "Hoy" que necesite `OJO_FALSO` no tiene
  nada que ofrecer. Intentos previos de construirlo a mano fallaron
  repetidamente por un bug de conectividad, no de teoría de Go; diagnóstico
  completo y estrategia sugerida para el próximo intento en la entrada
  "OJO_FALSO: por qué quedó pendiente" más arriba en este archivo.
- **Sin exportación/importación JSON** (documento, sección 7). No existe
  ninguna función de exportar ni importar en `storage/db.ts`. Hoy toda la
  persistencia vive solo en el IndexedDB de un único navegador/dispositivo —
  perder ese perfil de navegador pierde todo el progreso, sin respaldo
  posible.
- **Sin animaciones** (documento, sección 6.2: asentamiento de piedra 120ms,
  revelación de territorio al terminar la partida). No hay ninguna regla
  `transition`/`animation`/`@keyframes` en `App.css`; las piedras aparecen
  de golpe.
- **Circuito de personalización de la sección 5.5 sin construir**: cuando un
  detector dispara en una partida real, el documento pide inyectar 3
  problemas de ese concepto con prioridad alta al día siguiente, y reabrir
  la lección de un concepto que acumula 3 errores en 5 partidas.
  `training-policy/session.ts` hoy solo hace la mezcla 60/25/15 basada en
  vencidos/débiles/nuevo; ninguno de esos dos mecanismos específicos existe.
- **Retícula tipográfica alineada al tablero** (sección 6.2): detalle sutil
  de diseño que nunca se implementó a propósito (los espaciados de la app no
  derivan del paso de la retícula del goban). Bajo impacto, pero es una
  desviación real, no decidida explícitamente con el usuario.

### Comparación contra go-trainer-especificacion-pantallas.md (nuevo, 2026-09-01)

Documento de maquetas de UI (vive en `Go_app/`, fuera de este repo) con
tablas y nombres exactos que las pantallas deberían usar — más específico en
algunos puntos que `go-trainer-v1-diseno.md`. Auditoría pedida por el
usuario como posible base para un próximo trabajo de interfaz; cubre Hoy,
Aprender, Jugar y Perfil con algo de detalle, Revisar y Ajustes solo
parcialmente (no se llegó a revisar cada bullet de la sección 6.4/6.5 contra
`ReviewScreen.tsx` a fondo).

- **Sin patrones prohibidos (sección 0), buena noticia.** Se buscó
  explícitamente racha/streak/insignia/badge/XP/confeti/mascota en `src/` y
  no aparece nada — el único "badge" real es un indicador de "lección leída"
  en Aprender, no gamificación.
- **Aprender solo muestra niveles 0-3.** `LearnScreen.tsx` tiene
  `const LEVELS = [0, 1, 2, 3]`. La sección 5/6.2 del documento pide listar
  los 11 niveles completos, con el 4 al 10 bloqueados pero con su nombre y
  tamaño de tablero reales (Forma/9x13, Apertura/13x13, Joseki/13x13, Medio
  juego/Vida y muerte intermedia/Yose/Tablero completo, los seis en 19x19).
  Tampoco existe la barra "N de M lecciones completadas" de la sección 6.2.
- **Perfil no tiene el radar de 6 ejes.** La sección 4/6.5 pide un radar
  fijo (Lectura, Vida y muerte, Forma, Dirección, Ataque/defensa, Yose).
  `ProfileScreen.tsx` muestra en cambio una lista de barras por cada uno de
  los ~28 `ConceptId` individuales, agrupados por nivel — una arquitectura
  de información distinta, no solo un componente visual distinto. Es la
  brecha más grande de esta comparación: hace falta decidir el mapeo de
  concepto a eje (no existe hoy) y construir un componente de radar desde
  cero (no hay librería de gráficos en el proyecto).
- **Jugar no usa escala kyu.** `strengthLevels.ts` etiqueta la fuerza del
  bot por nivel interno + cantidad de *playouts* ("Normal", 500), no como
  "Bot 15 kyu" (secciones 6.3 y 7 del documento, texto solamente, sin
  avatar). Hace falta una tabla de playouts → etiqueta kyu.
- **Hoy tiene una estructura distinta a la sección 6.1.** Sin encabezado
  "Nivel X · nombre del nivel", sin "tarjeta de foco del día" (el copy tipo
  "hoy entrenas atari porque ayer..." necesita lógica real de razonamiento,
  no solo maquetado), sin meta diaria como texto, sin botón "Jugar contra el
  bot" con el kyu visible. `TodayScreen.tsx` hoy es: lista de sesión con
  motivo (vencido/débil/nuevo) + progreso N de M + tablero del ejercicio
  actual — funcionalmente sólido, pero no sigue el layout del documento.
- **Ajustes no tiene meta diaria editable.** La sección 6.5 la pide como
  campo numérico con valor por defecto modesto (ej. 3); `SettingsScreen.tsx`
  solo tiene tema visual y sonido. (La accesibilidad avanzada de la misma
  sección ya estaba documentada como decisión explícita más arriba, en
  "Desviaciones deliberadas" — esto es distinto, nadie decidió no tener meta
  diaria editable, simplemente no se construyó.)
- **Estimación de esfuerzo dada al usuario en la conversación**: 4-7 horas,
  dominado por el radar de Perfil (~1.5-2.5h, incluye la decisión de diseño
  del mapeo a ejes) y el rediseño de Hoy con copy de razonamiento real
  (~1.5-2h); Aprender y Jugar son menos de una hora cada uno. Sin plan
  todavía, el usuario no pidió empezar a implementar esta pasada.

### Estado de los 4 criterios de salida de v1 (roadmap post-v1, sección 0)

Ninguno de los cuatro está cumplido. El usuario decidió explícitamente
saltarse este gate por ahora para avanzar a la sección 1 del roadmap; queda
registrado acá para que la decisión sea explícita, no implícita:

1. 20-30 partidas jugadas por el usuario, terminadas y revisadas: no hecho.
2. Tiempo hasta la primera partida ganada, medido: no instrumentado.
3. Revisión de un jugador dan sobre lecciones de niveles 0-2 y 20 problemas
   del banco: no hecho. Con el banco en 71 entradas esto ya es viable para
   la mayoría de los conceptos cubiertos (DOBLE_ATARI tiene 16, DOS_OJOS 12,
   ESCALERA 12), pero `OJO_FALSO` sigue en cero y no habría nada que
   mostrarle de ese concepto en particular.
4. Cero problemas fallando el invariante del generador en CI: se sigue
   verificando en cada push (`tests/content/problem-bank.test.ts`); con 71
   problemas en el banco la superficie de riesgo ya es real, no solo
   teórica, y sigue en verde.

### Trabajo post-v1 de esta sesión (Fase A y Fase B del roadmap)

- **Fase A (cerrada, pero el método de empaquetado cambió después).** La
  PWA está desplegada en GitHub Pages (`https://diegotronkurt.github.io/hoshi/`)
  vía GitHub Actions. La ficha de Play Store (ícono, gráfico de
  característica, 4 capturas) sigue lista y no cambió. El empaquetado
  Android sí cambió: se armó y verificó por completo la TWA con Bubblewrap
  (`assetlinks.json` de punta a punta, ver "Qué cambió desde el 31 de
  agosto"), pero una prueba posterior en el teléfono real del usuario
  encontró que Brave (su navegador predeterminado) no verifica Digital
  Asset Links de forma confiable, así que esa vía quedó reemplazada por un
  shell en Flutter con WebView — ver "Qué cambió más tarde el mismo día"
  más arriba para el detalle completo y por qué. El AAB vigente para subir
  a Play Console ya no es el de Bubblewrap (`hoshi-android/`,
  `versionCode 2`) sino el de Flutter (`hoshi-flutter/`, `versionCode 3`).
- **Fase B (cerrada)**: `MistakeEvent` reemplazado por `ConceptOccurrence`
  en toda la base, con el detalle completo más abajo en su propia entrada de
  fase.

### Qué sigue

Con el gate de v1 saltado a propósito, lo siguiente según el roadmap es la
sección 2 (v1.1 — bots avanzados e insights), que depende de que la sección
1 (ya cerrada) esté lista. La brecha del banco de problemas que antes hacía
esto poco viable mejoró mucho (6 → 71); lo que queda pendiente ahí es
puntual (`OJO_FALSO`), no estructural.

Del lado del usuario: subir `hoshi-flutter/build/app/outputs/bundle/release/app-release.aab`
a Play Console (mismo `applicationId` y misma upload key que la ficha ya
publicada, así que actualiza en el lugar). Quedan además dos decisiones
puntuales sin tomar sobre el propio `hoshi-flutter/`, ofrecidas y
explícitamente pospuestas por el usuario en esta sesión: si darle control
de versiones (`git init`, repo remoto) y si vale la pena un APK de debug
para probar por sideload en el teléfono real antes de publicar.

Del lado de contenido/interfaz, dos frentes quedaron abiertos en esta
sesión sin que el usuario haya elegido todavía por cuál seguir: cerrar
`OJO_FALSO` (30-90 min, geometría incierta, ver su propia entrada más
arriba) o alinear la interfaz contra
`go-trainer-especificacion-pantallas.md` (4-7h, ver la comparación de
arriba, dominado por el radar de Perfil).

---

## Post-v1, Fase A y Fase B: Play Store y ConceptOccurrence

### Qué se construyó

- **Despliegue continuo**: `vite.config.ts` con `base: '/hoshi/'` y el
  manifest de la PWA (`start_url`/`scope`) ajustados al subpath de GitHub
  Pages; `.github/workflows/deploy.yml` compila, corre la suite completa y
  despliega `dist/` en cada push a `master` vía `actions/deploy-pages`. Sitio
  vivo en `https://diegotronkurt.github.io/hoshi/`.
- **Empaquetado Android (TWA)**: proyecto generado con Bubblewrap fuera del
  repo de la app (`hoshi-android/`, sin mezclar el build de Android con el
  código fuente web), `applicationId: com.hoshi.app`, ícono reutilizado de
  `public/icons/`. AAB firmado con un upload keystore generado localmente
  (contraseñas guardadas fuera del repo). `public/.well-known/assetlinks.json`
  publicado con el fingerprint del upload key; falta agregar el fingerprint
  del App Signing key de Play Console una vez el usuario suba el AAB.
- **Página de política de privacidad** (`public/privacy.html`): la app no
  tiene backend ni recolecta datos, así que el contenido es una declaración
  directa de eso, sin necesidad de plantillas legales genéricas.
- **`ConceptOccurrence` reemplaza a `MistakeEvent`** (`src/analysis/
  mistakes.ts`): cada ocurrencia de un concepto trae `context`
  (`'exercise' | 'game'`) y `result` (`'correct' | 'incorrect' | 'partial'`),
  no solo el caso de error. `ATARI_IGNORADO` y `ESCALERA` ganaron detección
  del caso correcto (grupo rescatado, escalera que sí funciona) porque era
  simétrico y barato con la lógica que ya existía; el resto de los
  detectores se queda emitiendo solo `'incorrect'` por ahora, documentado
  como pendiente, no como olvido.
- **`AttemptRecord` mide tiempo de respuesta** (`responseTimeMs`, opcional):
  un timestamp al cargar el problema, otro en la primera resolución o
  abandono, en `useSolvableProblem.ts`. Sin migración de esquema: es un
  campo nuevo sobre un object store que ya existía.
- **`ConceptProfile` extendido** (`src/learning/profile.ts`):
  `observationCount`/`correctCount`/`incorrectCount`/`lastPracticedAt`/
  `byContext` (desglosado por `exercise`/`game`), construido agregando
  `ConceptOccurrence`s de ambas fuentes. La fórmula de `score` no cambió.
- **`training-policy/` nuevo módulo**: `planSession` se mudó ahí desde
  `learning/`, que ahora solo contiene estado (`fsrs.ts`, `profile.ts`), tal
  como pide la sección 1.3 del roadmap.

### Decisiones técnicas con alternativas

- **Sin store nuevo de IndexedDB ni cambio de `DB_VERSION`** para
  `ConceptOccurrence`: las ocurrencias de partida se recalculan on-demand
  desde el SGF guardado (como ya hacía `analyzeGame`), y `responseTimeMs` es
  un campo opcional agregado a un store existente. Evita el riesgo de una
  migración real sin perder nada de lo que pide el roadmap.
- **Nombres de campo en inglés** (`context`/`result`/`'correct'`/
  `'incorrect'`) en vez del boceto en español del roadmap, para no romper la
  convención ya establecida en el resto del código.
- **Cobertura parcial de "correcto" a propósito**: `RELLENO_OJO_PROPIO` y
  `CORTE_NO_DEFENDIDO` (los otros dos detectores que el roadmap prioriza)
  quedaron sin su branch de "correcto" porque una señal honesta ahí necesita
  mirar hacia adelante desde la jugada rival, no solo hacia atrás desde la
  jugada propia — más riesgo de una señal engañosa que lo que valía la pena
  resolver en esta fase.
- **`gradlew.bat` necesitó el directorio del proyecto agregado a `PATH`**:
  esta máquina tiene `NoDefaultCurrentDirectoryInExePath=1` (endurecimiento
  de seguridad de Windows), así que `cmd.exe` invocado sin interfaz por
  Node no busca el ejecutable en el directorio actual. Bubblewrap tampoco
  citaba entre comillas la ruta al JDK al firmar (falla si `JAVA_HOME` tiene
  espacios, como `Program Files`); se resolvió con una junction sin espacios
  (`C:\jdk17`) en vez de tocar la variable de entorno de seguridad del
  sistema.

### Qué quedó pendiente

- Fingerprint SHA-256 del App Signing key de Play Console, para completar
  `assetlinks.json` (ver sección "Estado general" arriba).
- Publicación real en Play Console (ficha completa, revisión, track de
  pruebas internas) — al usuario.
- Los 4 criterios de salida de v1 del roadmap (sección 0), saltados a
  propósito por decisión del usuario.
- `RELLENO_OJO_PROPIO`/`CORTE_NO_DEFENDIDO` sin branch de "correcto".

---

## Fase 6: lecciones, temas y ajustes visuales — v1 cerrada

### Qué se construyó

- **`src/content/lessons/`**: modelo de datos (`types.ts`: `Lesson`, `LessonBlock`
  con `paragraph`/`diagram`, `DemoScript`/`DemoStep`) y las 29 lecciones de los
  niveles 0 a 3 (`n0.ts`…`n3.ts`, 6+7+8+8, exactamente la lista de la sección 3
  del documento de diseño), como objetos de datos TypeScript con prosa vía el
  sistema i18n ya existente, no MDX (decisión tomada con el usuario: cero
  dependencias nuevas, uniforme con el resto del proyecto). `concepts.ts` ya
  traía el `lessonId` de cada concepto desde la Fase 3, así que la lista de
  lecciones no fue una decisión nueva, solo había que llenarla de contenido.
  Se agregó `conceptsForLesson(lessonId)` a `concepts.ts` en vez de duplicar a
  mano qué conceptos toca cada lección.
- **`src/ui/lessons/`**: `LearnScreen` (mapa de niveles → lista de lecciones,
  progreso de lectura en `localStorage`, no en IndexedDB porque no es dato de
  aprendizaje evaluable), `LessonScreen` (renderiza bloques de prosa/diagrama,
  la demo si existe, la práctica embebida y el CTA a Jugar), `GuidedDemo` (el
  "ejemplo interactivo" de cada lección) y `LessonPractice` (el "problema
  guiado", reutilizando `useSolvableProblem` igual que Ejercicios).
- **`GuidedDemo`**: secuencia guionada de jugadas validadas contra el motor de
  reglas real (`core/rules.applyMove`), no un ejercicio evaluado por el
  solucionador ni registrado en FSRS — esto es enseñanza, no evaluación. Cada
  paso lo juega quien le toca el turno en la posición real; un paso puede
  marcarse `auto` (pasa en silencio, o juega una jugada concreta) para narrar
  la respuesta forzada del otro bando sin pedirle un click a la persona — así
  se armó, por ejemplo, la escalera completa de n3-l2 (5 jugadas, 3 de la
  persona y 2 automáticas) y el snapback de n3-l5.
- **Temas nuevos**: `sumieTheme`, `kayaTheme`, `nocturnoTheme` en
  `src/ui/board/themes.ts`, junto al `minimoTheme` ya existente. `StoneStyle`
  gana dos campos opcionales, `highlight` (gradiente radial para dar volumen)
  y `dropShadow` (sombra proyectada), que `BoardCanvas` usa si están
  presentes. Mínimo y Kaya los usan (piedras "físicas", pedido explícito del
  usuario); Sumi-e no usa ninguno (tinta plana, como pide el documento);
  Nocturno OLED usa solo `dropShadow` (silueta con contorno, sin brillo).
- **Sonido**: `src/ui/sound.ts` sintetiza un "clac" corto (ráfaga de ruido
  filtrada paso-bajo con envolvente rápida) vía Web Audio API, sin archivos de
  audio. Se llama tras cualquier colocación real de piedra (Jugar, Ejercicios,
  Hoy, demos de lecciones), nunca en pase ni jugada ilegal.
- **`src/ui/settings/`**: `SettingsProvider`/`useSettings()` (mismo patrón que
  `i18n/index.tsx`: contexto en React con persistencia en `localStorage`) para
  tema y sonido, más `SettingsScreen`, la pantalla de Ajustes nueva. No es una
  pestaña de la barra inferior: se abre con un botón "Ajustes" desde Perfil,
  que cambia una vista local del mismo contenedor (mismo truco que ya usa
  Revisar para el detalle de una partida).
- **Pestaña "Aprender"** nueva en `App.tsx`, entre Hoy y Jugar.
- **`src/content/lessons/helpers.ts`**: `cropShape`/`cropPoint`, para recortar
  a una vista local cuadrada los tableros grandes de `seeds.ts` (pensados para
  el solucionador, con todo el resto del tablero relleno de un color). Ver
  more abajo, en decisiones.
- `src/content/seeds.ts` gana `piramideDeCuatro` (derivada y verificada con el
  solucionador, pendiente desde la Fase 3) y `dosOjosSeparados` (misma
  posición que ya verificaba `tests/solver/tsumego.test.ts` a mano, ahora
  exportada para reuso). `tests/content/lessons.test.ts` es la verificación
  nueva que exige el principio 1 del documento para el contenido de Nivel 2.
- 4 tests nuevos en `tests/solver/tsumego.test.ts` (pirámide de cuatro) y 4 en
  `tests/content/lessons.test.ts` (reverificación de las formas reutilizadas
  por las lecciones), 96/96 en total.

### Decisiones técnicas con alternativas (qué elegí y qué sacrifiqué)

- **Formato de lecciones: TS + componentes React, no MDX.** Decidido con el
  usuario explícitamente para mantener uniformidad con el resto del proyecto
  (mismo criterio que evitó react-i18next en la Fase 1) y evitar duplicar
  archivos `.mdx` por idioma.
- **El "ejemplo interactivo" es una demo jugable nueva (`GuidedDemo`), no el
  solucionador ni un diagrama estático.** También decidido con el usuario.
  Sacrifica reutilizar directamente la infraestructura de Ejercicios para esta
  parte, a cambio de secuencias con guión (útiles para enseñar, donde a veces
  hace falta narrar una jugada del rival que el estudiante no debería tener
  que "adivinar").
- **Bug real encontrado con una captura de pantalla, no con los tests**: las
  formas de `seeds.ts` (`rectaDeTres`, `cuadradoDeCuatro`, `piramideDeCuatro`,
  `dosOjosSeparados`) están pensadas para el solucionador, con todo el resto
  del tablero de 9x9 relleno de un color para acotar la región de análisis.
  Usadas tal cual como diagrama de lección, eso se traduce en un tablero casi
  entero cubierto de piedras blancas alrededor de una pequeña forma negra:
  ilegible para alguien aprendiendo. La captura de pantalla de verificación en
  navegador lo mostró de inmediato. Se agregó `cropShape`/`cropPoint` en vez
  de tocar `seeds.ts`: recorta a una vista cuadrada local con margen,
  centrada en el muro de piedras. Es seguro para las demos jugables (no solo
  para diagramas estáticos) porque las piedras "de relleno" fuera del
  recorte son funcionalmente idénticas a que esas celdas queden fuera del
  tablero — ninguna de las dos cuenta como libertad — así que recortar no
  cambia libertades ni capturas, solo la vista. La pantalla de Ejercicios
  sigue mostrando estos mismos problemas sin recortar (ya lo hacía desde la
  Fase 3); no se tocó, es un patrón ya aceptado ahí y fuera del alcance de
  esta fase.
- **`piramideDeCuatro` resultó condicional, no muerta sin más**, confirmando
  lo que la Fase 3 ya sospechaba al descartarla de las semillas. Se derivó y
  verificó con el solucionador (igual que la recta de tres: vive si el dueño
  juega primero el punto vital, muere si lo juega el rival primero) antes de
  usarla en la lección N2-L7. No se agregó a `SEED_SPECS` (el banco de
  problemas generado): eso tocaría el pipeline de generación, que quedó
  fuera de alcance explícito de esta fase por pedido del usuario. Queda
  exportada y verificada con test propio para que las lecciones la usen
  directo, sin pasar por el generador.
- **Red (geta) y snapback se encontraron por fuerza bruta / derivación y
  verificación con código, no de memoria.** Para la geta, un script probó
  combinaciones de piedras negras cerca de una esquina hasta encontrar una
  que cumpliera la propiedad exacta ("para cualquier extensión de blanco,
  negro tiene una jugada que la vuelve a dejar en atari"). Para el snapback,
  la posición se derivó a mano con cuidado y se verificó reproduciendo la
  secuencia completa (sacrificio, captura, recaptura) con `applyMove` real
  antes de aceptarla. Mismo criterio que ya dejó registrado la Fase 4 sobre
  las escaleras: no asumir la geometría de una posición táctica, verificarla
  con el motor.
- **La escalera de N3-L2 y el rompedor de N3-L3 reutilizan exactamente las
  posiciones ya verificadas en `tests/solver/ladder.test.ts`**, reproducidas
  en un tablero de 5x5 en vez de 9x9 (se confirmó con un script que
  `solveLadder` da el mismo resultado exacto en ambos tamaños, ya que toda la
  secuencia ocurre lejos de los otros bordes) para que el diagrama sea más
  legible sin sacrificar nada de la verificación.
- **Ojo falso (N2-L4) se queda en la regla general, sin resolver una posición
  táctica específica.** A diferencia de las formas de vida y muerte
  (recta de tres, cuadrado de cuatro, pirámide de cuatro), verificar que un
  ojo falso concreto realmente muere requeriría leer una captura de la
  piedra diagonal que puede necesitar más tablero del que cabe en una región
  acotada simple. El principio 1 exige verificación para afirmaciones sobre
  una posición concreta, no para la definición general de la regla (mismo
  criterio que ya se aplicó a komi o al fin de la partida): la lección
  enseña cómo reconocer el patrón por las diagonales, con un diagrama que
  solo muestra la geometría, sin afirmar el destino de esa piedra rival en
  particular.
- **Navegación: se agregó "Aprender" y se mantuvo "Ejercicios"**, quedando 6
  pestañas en vez de las 5 que lista la sección 6.1 del documento
  ("Hoy, Aprender, Jugar, Revisar, Perfil"). Perder Ejercicios como entrada
  independiente habría sido peor para quien ya lo usa como práctica libre
  fuera de una lección puntual; además "practicar más" desde una lección
  necesita a dónde ir. Decisión explícita, no un olvido del documento.
- **Accesibilidad avanzada (modo daltónico, doble toque, navegación por
  teclado, objetivo táctil de 44px) quedó en stand-by por pedido explícito
  del usuario**, a cambio de dos pedidos concretos que sí se hicieron: piedras
  con volumen/sombra y sonido al colocar. Ver "Qué quedó pendiente".
- **Progreso de lectura de lecciones en `localStorage`, no en IndexedDB.** No
  es un dato de aprendizaje evaluable (no alimenta perfil ni FSRS), así que no
  necesitaba un almacén nuevo.
- **Ajustes vive dentro de Perfil, sin pestaña propia.** Documento de diseño,
  sección 6.1: Perfil incluye "ajustes y temas". Decidido con el usuario.

### Qué quedó pendiente

- **Accesibilidad avanzada de la sección 6.4 del documento** (modo daltónico,
  confirmación de doble toque, navegación por teclado, objetivo táctil de
  44px en pantallas angostas): explícitamente diferida por el usuario en esta
  entrega, no construida.
- El circuito "si un concepto acumula 3 errores en 5 partidas, se reabre su
  lección" (documento, sección 5.5) seguía bloqueado por falta de lecciones
  hasta ahora; ahora que existen, queda disponible para una fase futura, pero
  no se pidió como parte de esta.
- El banco de problemas sigue chico (6 entradas, sin contar las semillas
  nuevas que no se agregaron a él a propósito): la mayoría de las secciones
  "Problema guiado" de las lecciones de Nivel 0, 1 y 3 muestran el estado
  vacío en vez de un ejercicio real. Nivel 2 (`DOS_OJOS`, `PUNTO_VITAL`) sí
  tiene contenido real porque esos son los conceptos que ya cubrían las
  semillas de la Fase 3.
- `PASE_PREMATURO` (Fase 4) sigue siendo una comparación de un solo paso, sin
  cambios en esta fase.
- Recién llegaron documentos nuevos post-v1 (`go-trainer-post-v1-roadmap.md` y
  relacionados) con un gate explícito de 4 criterios de salida de v1 a
  verificar con el usuario antes de tocar código de esa etapa. No se tocó
  nada de eso en esta fase; queda para cuando el usuario confirme que
  arrancamos esa etapa.

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
