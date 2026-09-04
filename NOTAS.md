# Notas de desarrollo

## Estado general del proyecto (2026-09-04, cont. 12: bot pasa cuando corresponde, 19x19, tablero 9x13 y conteo japones en Jugar)

Cuatro pedidos del usuario en un solo mensaje: texto "Pensando..." en Jugar
(ya arreglado en cont. 10, sin trabajo nuevo), el bot sigue jugando cuando
"deberia pasar y ganar", conteo japones como alternativa al chino, y
confirmar/activar 13x13-19x19 mas tablero rectangular. Los ultimos tres
eran reales.

### El bot no pasaba aunque ya iba ganando

`chooseMove` (engine/mcts.ts) trata "pasar" como una jugada mas entre
decenas de candidatas, sin ningun sesgo hacia ella. Con pocos playouts
(100-8000 segun `strengthLevels.ts`) repartidos entre todos los puntos
vacios de un tablero grande ya asentado, "pasar" puede terminar sin ser
el hijo mas visitado del arbol UCT aunque la partida este objetivamente
resuelta -- en particular justo despues de que el rival pasa (ofreciendo
terminarla), que es el disparador mas probable de lo que el usuario vio:
la persona pasa, el bot no reciproca, la partida sigue.

Arreglado con `shouldAcceptPass`, un chequeo previo a la busqueda (no
dentro del arbol UCT): si `consecutivePasses === 1` (el rival acaba de
pasar), no hay ninguna captura gratis ni grupo propio en atari
(`findOneLibertyPoints`, la misma primitiva que ya usaba la politica de
playout) y el puntaje de area actual (`computeAreaScore` sobre el
tablero tal cual esta, sin marcar piedras muertas -- coincide exactamente
con como se calcularia el puntaje final si la partida terminara ahora)
ya favorece a quien le toca jugar, el bot pasa sin gastar playouts en
redescubrirlo. Deliberadamente NO fuerza un pase proactivo cuando el
rival todavia no paso (bajo reglas chinas, rellenar dame es una jugada
real y positiva, no neutral -- seguir jugando ahi es correcto, no un bug).
Tres tests nuevos en `tests/engine/mcts.test.ts`: acepta un pase en un
tablero vacio (blanco ya gana por komi), NO acepta con una captura gratis
disponible, NO acepta yendo perdiendo en el marcador -- los tres
construidos jugada por jugada contra el motor real, no mockeados.

### 19x19 desbloqueado, verificado con una partida real completa

`PlayConfigScreen.tsx` tenia un comentario propio (2026-09-03) que decia
"19x19 se desbloquea cuando el curriculo llegue a niveles 7-10 (v3)" --
v3 se completo mas tarde ese mismo dia (`e28d865`, antes de que empezara
esta conversacion) y nadie volvio a levantar la bandera de UI. Encontrado
releyendo el propio comentario del codigo contra el estado real del
curriculo, no por sospecha previa.

Antes de confiar en el desbloqueo se corrio una partida bot-vs-bot REAL
de principio a fin en 19x19 (60 playouts/jugada, sin atajos en la logica
de eleccion de jugada) como test descartable
(`tests/engine/_debug-19x19-integration.test.ts`, borrado despues):
terminó en 542 jugadas via doble pase real (no por tope de jugadas),
puntaje negro=180 blanco=185.5 sobre 371.5 puntos totales -- coherente.
El test en si "fallo" por timeout de vitest (935s de duracion real contra
un limite de 180s que yo le puse mal), pero el codigo sincrono corrio
hasta el final sin tirar excepcion antes de que vitest pudiera siquiera
interrumpirlo -- la corrida es valida, el limite estaba mal puesto.

### Tablero rectangular 9x13 jugable en Jugar (antes solo en contenido de leccion)

Un agente de exploracion audito el codigo antes de estimar el alcance:
`analysis/mistakes.ts` (motor de deteccion de errores) y
`ui/board/BoardCanvas.tsx` ya eran completamente genericos en ancho/alto
-- ningun detector individual asumia tablero cuadrado (confirmado
leyendo los 11, no solo grepeando), y `BoardCanvas` ya manejaba
dimensiones distintas correctamente en dibujo y en el mapeo de clics a
interseccion. Lo unico realmente cuadrado era que
`SavedGameRecord`/`PlayConfig`/`PlaySeed`/`LastPlayConfig` guardaban un
solo `size: number` en vez de `width`/`height` por separado. Como el
motor de analisis no necesitaba cambios de logica, dar soporte completo
a la revision de partidas rectangulares no costaba practicamente nada
extra sobre simplemente "dejar jugarlas" -- no tenia sentido enviar una
version recortada sin revision de errores.

`SavedGameRecord.size` pasa a opcional/legado (partidas viejas en
IndexedDB solo lo tienen); `width`/`height` opcionales tambien, con dos
helpers nuevos en `storage/db.ts` (`gameWidth`/`gameHeight`, `?? size`
como respaldo) que son el unico lugar que conoce ese fallback en vez de
repetirlo en cada pantalla. `PlayConfig`/`PlaySeed`/`LastPlayConfig` (sin
historial persistido real, o con guarda de forma que ya degrada con
gracia) pasan a `width`/`height` obligatorios sin necesidad de
compatibilidad hacia atras. `analyzeGame`/`stateAtMove` ganan un segundo
parametro (`width, height` en vez de `size`). Efecto secundario gratis:
`LessonScreen.tsx` ocultaba el boton "practicar en partida real" para
cualquier leccion con demo rectangular (Nivel 4, 9x13) porque `PlaySeed`
no podia representar esa forma todavia -- ya no hace falta ocultarlo.

Verificado con dos tests "canario" nuevos (uno contra `analyzeGame`, uno
contra `stateAtMove` en `tests/ui/review/reviewState.test.ts`, archivo
que no existia -- `stateAtMove` no tenia ningun test antes de esto):
una jugada en un punto que solo es valido si el alto es realmente 13
(y directamente ilegal en una interpretacion cuadrada 9x9), confirmando
que ancho y alto no se mezclan en ningun punto de la cadena.

### Conteo japones como regla alternativa a la china

`core/scoring.ts` gana `computeTerritoryScore(board, komi, captures)`:
solo puntos originalmente vacios que quedan rodeados por un color (mismo
flood-fill que `computeAreaOwnership`, ya existente) mas las capturas
reales de la partida (`GameState.captures`), a diferencia del conteo de
area donde las piedras propias tambien suman. Elegible por partida en
Jugar (`PlayConfig.scoringRule`), guardado en `SavedGameRecord` para que
Revisar pueda mostrar de que regla salio cada resultado.

**Bug real encontrado por una revision de diseno antes de escribir
codigo**: mi primer diseño le daba a `computeTerritoryScore` un parametro
`deadStones` identico al de `computeAreaScore`, por paridad de firma.
Pero marcar una piedra como muerta solo le da territorio al capturador
via el flood-fill -- le falta sumar la piedra en si como prisionera, algo
que en este codigo solo pasa durante la partida real (`core/rules.ts`),
nunca via `deadStones`. Verificado contra el fixture existente de
`tests/core/scoring.test.ts` (anillo negro + una piedra blanca marcada
muerta): el conteo japones real de esa posicion es 10, mi formula daba 9.
Como esta app no tiene ninguna pantalla de marcado de piedras muertas
(nada llama a `computeAreaScore` con `deadStones` no vacio tampoco), el
parametro no se agrego -- mas simple y correcto que enviar un resultado
que se ve plausible pero esta mal. `core/sgf.ts` (siempre escribe
`RU[Chinese]`), `eval/features.ts` (canal de regla de conteo de la red,
fijo en area) y el propio `engine/mcts.ts` (puntaje de los playouts)
quedan deliberadamente sin tocar -- China y Japon coinciden casi siempre
en quien gana, es un recorte de alcance consciente, no un olvido.

### Verificacion

`npx tsc -b` limpio, `npx vitest run` en 1035/1035 (1025 antes de esta
sesion + 10 tests nuevos), `npm run lint` sin warnings nuevos, `npm run
build` sin cambios de tamaño de bundle (888KB hilo principal, tfjs
aislado en su chunk de Worker). Sin browser tool disponible en este
entorno para probar la UI en vivo -- se dejo un servidor de desarrollo
corriendo para que el usuario lo revisara el mismo antes de pedir commit.

### Commit, push y AAB de release, los tres a pedido explicito del usuario

hoshi: `b2d9e07`. hoshi-flutter: `d13edac`, version `1.12.0+17`,
`app-release.aab` de 54.0MB (mismo orden de tamaño que builds anteriores,
sin sorpresas). Subir a Play Console queda, como siempre, del lado del
usuario.

Pedido directo del usuario tras explicarle la idea en criollo tres veces
("no entendi, explicamelo"): un boton "Preguntarle a la IA" en Revisar,
sobre la posicion de un error ya marcado. `eval/` es una red KataGo real
(V7, pesos `kata-b10c128`) que estaba construida y probada desde una
sesion anterior pero sin un solo consumidor en `src/ui` -- esta es su
primera conexion real a una pantalla.

**Por que Revisar y no Jugar/el bot**: una evaluacion cuesta ~1-1.25s,
ya medido y descartado para cualquier uso en vivo (por playout o por
jugada real del bot) en sesiones anteriores. Revisar es la unica pantalla
sin reloj: el usuario ya esta detenido mirando una jugada especifica, un
segundo de espera no cuesta nada ahi.

### Bug real encontrado por el subagente de diseno antes de escribir codigo

La forma obvia de implementar esto (mandarle a la red el mismo `boardState`
que ya se usa para dibujar) le manda la posicion equivocada desde la
perspectiva equivocada. `stateAtMove(size, komi, moves, moveNumber)`
aplica `moves[0..moveNumber-1]` INCLUSIVE de la jugada del error (porque
`mistakes.ts` guarda `moveNumber = indice_del_error + 1`), y `applyMove`
siempre invierte `toMove` -- asi que `boardState.toMove` es el RIVAL de
quien se equivoco, no la misma persona, para 9 de los 10 detectores
(la unica excepcion, `GRUPO_MURIO_SIN_OJOS`, guarda `color` como la
victima de una captura en vez de quien jugo, lo que por casualidad
invierte de vuelta y si calza). Mandarle `boardState` a la red le habria
devuelto "como aprovechar este error" en vez de "que deberia haber jugado
quien se equivoco" -- una pregunta distinta a la que la pantalla dice
estar respondiendo, en silencio.

Arreglado con un segundo estado, un ply antes, calculado solo para la
consulta a la red (`evalMoveNumber = event.moveNumber - 1`), sin tocar
`boardState` para nada (sigue siendo la vista correcta para dibujar: "ya
jugaste esto, mira el anillo de lo que debiste jugar en su lugar").
`GRUPO_MURIO_SIN_OJOS` queda explícitamente excluido del boton -- correr
el ply hacia atras rompería el unico caso donde `boardState` sin tocar
ya es correcto, y "que deberias haber jugado en su lugar" no tiene un
equivalente limpio para un concepto agregado anclado en una captura.

**Verificado empiricamente, no solo razonado**: un test descartable
(`tests/ui/_debug-review-ai.test.ts`, borrado despues de confirmar)
corrio una partida simulada de 4 jugadas contra `stateAtMove` real y
confirmo `boardState.toMove !== moves[2].color` pero
`evalState.toMove === moves[2].color` exactamente como predecia el
analisis. Otro test corrio `bucketOwnership` contra el modelo real
vendorizado (mismo mecanismo de carga que `tests/eval/model.test.ts`)
sobre una posicion muy unilateral y confirmo que el territorio embolsado
favorece claramente al color dominante, sin escribir nunca fuera de
rango en un tablero mas chico que 19x19.

### Segundo bug real: la conversion inflaba el bundle principal de 885KB a 1.75MB

`eval/model.ts` importa `@tensorflow/tfjs` en su primera linea.
Importar `legalPolicyDistribution` desde ahi (una funcion pura, sin
ninguna dependencia real de tfjs) arrastraba el modulo entero -- y con
el, tfjs completo -- al hilo principal por primera vez, exactamente lo
que el diseño de Worker separado (`eval/worker.ts`) existe para evitar.
Separado a `eval/policy.ts` (solo depende de `eval/features.ts`, que
tampoco importa tfjs); `eval/model.ts` reexporta `legalPolicyDistribution`
para quien ya la importaba desde ahi, pero `ReviewMistakeBoard.tsx` la
importa directo de `policy.ts`. Confirmado con `vite build`: bundle
principal de vuelta a 888KB (mismo tamaño que antes de esta sesion, mas
unos pocos KB de codigo nuevo real), tfjs queda aislado en su propio
chunk de Worker (1.83MB) que solo se descarga si Revisar realmente lo pide.

### Archivos nuevos

- `src/ui/review/ReviewMistakeBoard.tsx`: el boton + panel, extraido de
  los dos bloques de tablero casi identicos que ya tenia ReviewScreen
  (agregar el panel de IA a ambos por separado habria triplicado esa
  duplicacion en vez de duplicarla). Se remonta por `key` al cambiar de
  evento (mismo patron de `navToken` de la sesion anterior) en vez de un
  `useEffect` de reset manual.
- `src/ui/review/reviewState.ts`: `stateAtMove` (con un comentario nuevo
  documentando el limite inclusive, que no existia y es exactamente como
  se pudo haber cometido este mismo error) y `bucketOwnership`, separados
  de los archivos que exportan componentes (evita el warning de Fast
  Refresh de oxlint, `react(only-export-components)`).
- `src/eval/policy.ts`: `legalPolicyDistribution`/`POLICY_PASS_INDEX`,
  separados de `model.ts` especificamente para no arrastrar tfjs (ver
  arriba).

Framing deliberado en la copia de la UI: "opinion de la IA, no un hecho
verificado" -- el orden de la cabeza de valor de la red esta asumido, no
confirmado contra un KataGo real (ver `eval/model.ts`), a diferencia de
los detectores basados en reglas de esta misma pantalla, que solo
reportan cuando pueden probar la condicion con certeza.

### Commit, push y AAB de release, los tres a pedido explicito del usuario

`hoshi` (`1b09481`) y `hoshi-flutter` (`88a9d1e`) commiteados y pusheados
por separado, mismo pipeline de siempre (`npm run build` -> `sync-webapp.ps1`
-> bump de `pubspec.yaml` -> `flutter build appbundle --release`).
`1.10.0+15 -> 1.11.0+16` (minor, funcionalidad real nueva, no un parche).
`app-release.aab`, 54.0MB (el chunk de Worker con tfjs se descarga real
por primera vez desde una pantalla, ver arriba). Mismo firmado de siempre.
Todavia no subido a Play Console -- queda del lado del usuario.

## Estado general del proyecto (2026-09-04, cont. 10: auditoria completa + 7 bugs silenciosos corregidos, tras terminar el curriculo)

Con los 11 niveles de contenido ya completos (cont. 9), el pedido cambio
de tono: "que falta en la app? revisa todos los archivos, pensando
bien". Tres subagentes en paralelo (roadmap/deuda tecnica, contenido,
UI/UX) mas un cuarto dedicado solo al flujo de navegacion entre
pantallas encontraron una familia de bugs con el mismo patron: nada
tira error, nada rompe visualmente, cada uno simplemente hace lo
incorrecto en silencio -- por eso ninguno habia salido a la luz todavia.
El usuario aprobo un plan (`EnterPlanMode`/`ExitPlanMode`, guardado en
`C:\Users\diego\.claude\plans\optimized-dazzling-pretzel.md`) validado
ademas por un quinto subagente (Plan, dado los file:line exactos con la
instruccion de validar, no re-descubrir) que corrigio dos de las
soluciones propuestas antes de escribir una sola linea -- ver mas abajo.

### Los 7 bugs corregidos, en orden de implementacion

1. **Las 3 llamadas al Worker (motor, solver, eval) no tenian manejo de
   error.** `engine/client.ts`, `solver/client.ts` y el recien descubierto
   `eval/client.ts` (una red KataGo real -- V7, pesos `kata-b10c128` via
   tfjs -- construida y probada pero sin ningun consumidor en `src/ui`
   todavia) compartian el mismo patron: `new Promise((resolve) => ...)`
   sin reject, sin timeout, sin `worker.onerror`. Si el Worker tiraba una
   excepcion, la promesa quedaba colgada para siempre -- el indicador
   "Pensando..." de Jugar y el candado de un ejercicio (`thinking`)
   se trababan sin salida. Corregido con `src/workerRpc.ts`, una funcion
   compartida (`createWorkerRpc`, composicion en vez de clase base --
   no hay ningun patron de herencia en el resto del proyecto) que agrega
   3 capas: try/catch dentro de cada `onmessage` del Worker (postea
   `{requestId, error}` en vez de tirar -- necesario porque `worker.onerror`
   NO se dispara para un rechazo async sin capturar dentro del Worker,
   solo para un throw sincrono), `worker.onerror` como respaldo mas
   grueso, y un timeout por pedido. Los 3 sitios de llamada
   (`PlayGameScreen.tsx`, `useSolvableExercise.ts` x2) ahora capturan el
   rechazo, liberan el estado de "pensando" y muestran `engine.error`.

2. **`lessonId: 'transversal'` en dos conceptos no era un typo.**
   `PRIMERA_LINEA_TEMPRANA` y `JUGADA_LEJOS_DEL_COMBATE` (ver cont. 8: ya
   se habian revisado las 7 lecciones de Nivel 1 y las 8 de Nivel 2 sin
   encontrar ninguna que cubra "primera linea temprano" o "tenuki de un
   combate urgente"). El primer intento de solucion (apuntar a la leccion
   mas cercana) lo descarto el subagente de validacion releyendo esta
   misma nota: mostrarle al usuario una leccion que no ensena el error
   que cometio es peor que el no-op actual. `Concept.lessonId` ahora es
   `string | null`, ambos casos en `null`, `getLesson()` acepta `null` y
   devuelve `null` directo. Escribir esas dos lecciones sigue pendiente,
   a proponer aparte como todo el resto del contenido esta sesion.

3. **Retocar una pestana ya activa para "volver al inicio" no hacia
   nada -- y no era el bug obvio.** `goToExercises(undefined)` estando ya
   en Ejercicios llama `setExercisesConcept(undefined)` sobre un valor
   que YA es `undefined`: React descarta el render entero por
   `Object.is`, así que el componente hijo ni siquiera se vuelve a
   invocar. Ni un `useEffect` mirando el prop ni un `key={valor}` lo
   arreglan, porque React nunca llega a evaluar ninguno de los dos.
   Solucion real: un contador `navToken` en `App.tsx` que se incrementa
   en CADA `applyNav` (cambie o no el valor) usado como `key` de las 4
   pantallas con estado propio (Aprender/Jugar/Ejercicios/Revisar) --
   fuerza el remount sin depender de que el valor en si haya cambiado.
   Efecto secundario que hubo que cerrar: el guard de partida-en-curso de
   Jugar (`playGameActive`) excluia a proposito el caso "retocar Jugar
   estando ya en Jugar" (period porque antes no hacia nada); con
   `navToken` ese mismo retoque ahora SI reinicia `PlayScreen` de
   verdad, asi que el guard tuvo que dejar de tener esa excepcion.

4. **La meta diaria de Ajustes no afectaba nada.** Solo alimentaba el
   contador visual `{completadoHoy}/{meta}`; `TodayScreen` siempre
   llamaba `planSession(..., DEFAULT_SESSION_MINUTES)`. Causa real:
   `dailyGoal` es una cantidad de problemas, `planSession` pide minutos.
   Agregado `minutesForGoal()` en `training-policy/session.ts`
   (conversion inversa a la que ya existia adentro de `planSession`).
   `DEFAULT_DAILY_GOAL` paso de 3 a 13 (a proposito: es la cantidad que
   ya salia de `DEFAULT_SESSION_MINUTES=10` hoy, para que una instalacion
   nueva no cambie de comportamiento el primer dia).

5. **El `<nav>` de 6 pestanas tenia `aria-label` fijo en "Hoy" sin
   importar cual estuviera activa.** Agregada `nav.label` generica en
   los dos locales.

6. **El perfil de habilidad le regalaba 100 a un concepto nunca
   observado.** `computeProfiles` en `learning/profile.ts` usaba
   `games.length >= 3` (global) como si fuera evidencia de CADA
   concepto -- con `gameMistakeCount` en 0 para un concepto que nunca
   ocurrio, el calculo daba un puntaje perfecto vacuo en vez de "sin
   datos". Le pasa a casi todo Nivel 4-10 (casi nada ahi tiene detector
   ni banco de ejercicios) pero no es un bug de nivel, es de formula --
   en teoria le podia pasar a un concepto raro de Nivel 0-3 tambien
   (KO si nunca hubo un ko en las primeras partidas). Corregido
   exigiendo evidencia real por concepto (`agg.observationCount`, ya
   calculado) en vez de la cuenta global de partidas -- tanto en el
   gate `hasEvidence` como en el calculo de `errorPenaltyScore` mismo
   (el segundo gate era el mismo bug escondido un nivel mas adentro: con
   `hasEvidence` ya arreglado por el lado de ejercicios, el componente de
   partida seguia pudiendo colarse en 100 vacuo dentro del promedio
   ponderado).

7. **Ejercicios no tenia guard de progreso sin guardar (solo Jugar).**
   Agregado `exercisesActive` con el mismo patron que `playGameActive`
   (`onActiveChange` en `ExercisesScreen`, activo mientras la vista
   interna es `'practice'` -- misma granularidad gruesa que Jugar, sin
   intentar medir "progreso real"). El dialogo de confirmacion ahora
   muestra texto distinto segun de donde se sale (`play.exitConfirm.*`
   vs `exercises.exitConfirm.*`, nuevo) en vez de reusar el texto de
   "esta partida" para un ejercicio. Hoy y Aprender quedan sin guard a
   proposito (mucho mas baratos de repetir).

### Hallazgos que quedaron fuera de este pase, documentados para no perderlos

- **Cero integracion con el boton Atras del sistema** (nada de
  `history`/`popstate` en todo `src`) -- relevante en particular porque
  esta PWA tambien se distribuye como app Android via el wrapper
  WebView de `hoshi-flutter` (repo hermano), donde Atras es un gesto
  esperado. Esfuerzo aparte, no se toco esta vez.
- **La idea de motor** (un solo llamado a la red eval de `eval/` por
  jugada real del bot, no por playout, para ordenar la expansion de
  movimientos raiz en `mcts.ts` por prioridad en vez de al azar) quedo
  en propuesta, no en codigo: las unicas mediciones de latencia que
  existen (~1.0-1.25s) son de Node de escritorio sin GPU, explicitamente
  marcadas como no representativas del dispositivo real (un celular
  gama media dentro del WebView de Flutter). Paso siguiente si se
  retoma: medir latencia real en navegador/dispositivo antes de escribir
  ninguna linea -- ese numero decide si la idea sirve.
- `SavedGamesList.tsx` renderiza las partidas guardadas como `<li>`
  inertes, sin `onClick`. Menor, no tocado.

### Commit, push y AAB de release, los tres a pedido explicito del usuario

`hoshi` (`1d456f8`) y `hoshi-flutter` (`c2bffcd`) commiteados y pusheados
por separado. AAB regenerado siguiendo el mismo pipeline de siempre
(`npm run build` en `hoshi/` -> `sync-webapp.ps1` -> bump de
`pubspec.yaml` -> `flutter build appbundle --release` via
`C:\flutter\bin\flutter.bat`, no esta en el PATH de esta maquina):
`1.9.0+14 -> 1.10.0+15` (minor, cambios funcionales reales de esta
sesion, no un parche). `app-release.aab`, 53.7MB (mas grande que el
rango historico de 42-45MB porque ahora incluye los pesos de la red de
evaluacion `eval/`, agregados en una sesion anterior a esta). Mismo
firmado de siempre (`android.keystore`, alias `upload`, via
`android/key.properties`). Todavia no subido a Play Console -- queda
del lado del usuario, igual que en cada sesion anterior.

## Estado general del proyecto (2026-09-04, cont. 9: Nivel 9 (Yose) y Nivel 10 (Semeai) completos -- v3 y el currículo entero, terminados)

Continuacion de la misma sesion tras cerrar Nivel 7/8 (commit `1bdafff`).
El usuario pidio directamente "go level 9 and 10 please" sin pedir
scoping previo por separado esta vez -- se investigo la infraestructura
disponible primero (sin libro nuevo a la vista) y se construyo directo,
verificando cada afirmacion con el motor real en vez de una fuente
externa (a diferencia de Nivel 5-8, que se apoyaban en el libro de
Kajiwara).

### Nivel 9 (Yose): sin libro, con `solver/areaValue.ts`

Confirmado el candidato que ya estaba anotado en el roadmap
(`areaDeltaForPoint`, el mismo que usa `n4-l5`): alcanzo para las 5
lecciones (`EL_FINAL_TAMBIEN_ES_GRANDE`, `SENTE_Y_GOTE`,
`SENTE_ANTES_QUE_GOTE`, `COMPARAR_VALOR_REAL`, `CONTAR_PARA_DECIDIR`),
vocabulario de sente/gote incluido -- no hizo falta citar ningun
principio de memoria, todo se calcula sobre el tablero real.

**Un hallazgo tecnico real durante la exploracion**: `computeAreaScore`
NO usa el algoritmo de Benson (pass-alive) para nada -- es un conteo de
area ingenuo (una region vacia es de un color si todos sus vecinos son
de ese color, si no queda neutral). Eso simplifico bastante el diseño de
posiciones, pero llevo a un error propio: una pared en L (como las que
ya usan `n6`/`n7` para cerrar una esquina) queda sellada SIN necesidad de
llenar el punto diagonal donde se encuentran los dos segmentos (la
diagonal no es adyacencia ortogonal, no filtra). El primer intento de
`n9-l1` dejo ese punto diagonal como "el hueco a sellar" y midio delta=0
(porque nunca fue un hueco real -- el bolsillo ya estaba cerrado sin
el). Corregido acortando uno de los dos segmentos de la pared en vez de
usar el punto diagonal, lo que crea un hueco ortogonal de verdad; delta
real verificado: 26 puntos. Se dejo un comentario explicito en
`n9.ts` marcando la diferencia para no repetir el error si se agrega mas
contenido despues. Segundo hallazgo menor: sin ninguna piedra rival en
absoluto en el tablero, TODO el vacio cuenta como "rodeado solo por un
color" (vacuamente) -- hacen falta piedras del otro color en algun lado,
aunque esten lejos, para que un sellado de verdad cambie algo.

### Nivel 10 (Semeai): hueco real del curriculo, tambien sin libro

Nivel 3 cubre tecnicas de captura puntuales (escalera, geta, snapback)
pero nunca la mecanica de contar y comparar libertades entre dos grupos
enfrentados sin dos ojos -- semeai es un tema clasico que nunca tuvo
lugar en el curriculo hasta ahora. Igual que Nivel 9, se decidio
verificarlo con el motor real (`core/rules.ts::applyMove`,
`core/groups.ts::getGroup`) en vez de buscar un libro, jugando cada
secuencia de verdad antes de aceptar una posicion:

- `QUE_ES_SEMEAI` (n10-l1): escena simetrica (2 piedras cada lado, cara a
  cara, libertades compartidas + de afuera).
- `CONTAR_LIBERTADES_ANTES_DE_JUGAR` (n10-l2): misma pareja negra, pero
  blanco ya jugo 3 piedras mas achicandole las libertades de afuera a
  negro (3 contra 6). Se jugo la carrera completa contra el motor: negro
  ataca de todos modos y termina capturado, aunque mueva primero --
  confirma la regla estandar (mas libertades gana, sin importar el
  turno, salvo empate) en vez de darla por sabida.
- `LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO` (n10-l3): reutiliza la
  escena simetrica de l1, foco en identificar cuales libertades son
  compartidas. Se descarto a proposito un diseño mas ambicioso (probar
  que el ORDEN de relleno cambia el resultado de la carrera): la
  aritmetica real, verificada jugada por jugada, no daba una reversion
  limpia con libertades compartidas iguales -- en vez de forzar una
  afirmacion sutil y quedar sin verificarla del todo con confianza, se
  bajo el alcance de la leccion a algo mas simple y sí completamente
  verificado (categorizar libertades), seccion "que no hacer" aplicada a
  contenido de Go, no solo a codigo.
- `UN_OJO_GANA` (n10-l4): un anillo negro de 8 piedras alrededor de un
  punto real (blanco no tiene jugada legal ahi -- suicidio puro,
  confirmado con `applyMove`), con exactamente 2 libertades de afuera,
  contra una piedra blanca suelta con las mismas 2 libertades de afuera,
  sin ninguna compartida. Carrera completa jugada con BLANCO empezando
  (el peor caso posible para negro en libertades puras): el anillo
  sobrevive con su ojo intacto, la piedra blanca termina capturada.
  Demostracion completa del principio clasico "un ojo vale una libertad
  extra que el rival nunca puede tocar", verificada de punta a punta en
  vez de citada.
- `CONECTAR_EN_VEZ_DE_PELEAR` (n10-l5): dos grupos negros de 2 piedras
  separados por un punto -- jugarlo los funde en un grupo de 5 piedras
  con 12 libertades, verificado con `getGroup` antes y despues.

### Mismo patron de wiring que Nivel 7/8, mismo estandar de verificacion final

`content/lessons/types.ts`, `content/lessons/index.ts`,
`analysis/concepts.ts`, `ui/lessons/LearnScreen.tsx` extendidos de
`... | 7 | 8` a `... | 7 | 8 | 9 | 10`. `LOCKED_LEVELS` en
`LearnScreen.tsx` queda vacio (ya no hay niveles bloqueados por falta de
contenido) en vez de eliminarse -- mismo principio que
`LOCKED_BOARD_SIZES` en `PlayConfigScreen.tsx`, se deja el mecanismo por
si hace falta bloquear contenido futuro otra vez. Corregido tambien un
titulo placeholder desactualizado: `learn.level.10` decia "Tablero
completo"/"Full board" desde antes de que existiera ningun scoping real
-- corregido a "Semeai" en ambos idiomas, junto con la correccion
simetrica ya hecha para Nivel 7/8 la vez pasada.

Los numeros que aparecen en las lecciones de Nivel 9 (cuanto vale un
punto de yose, cuantas libertades le quedan a un grupo) NO se escriben a
mano en ningun lado: `n9.ts` los calcula el mismo, en tiempo de carga
del modulo, con `areaDeltaForPoint`/`countLiberties`/`computeAreaScore`
sobre el tablero real -- mismo patron exacto que `n4-l5` ya establecia
(`captionParams` interpola el numero real en la traduccion). Antes de
aceptar cada posicion se escribio un script descartable
(`tests/content/_debug-n9-yose-explore.test.ts`,
`_debug-n10-semeai-explore.test.ts`, `_debug-n10-l5-connect.test.ts`,
los tres borrados al terminar) que renderiza el tablero como ASCII y
corre las funciones reales -- el primer intento de varias posiciones
salio mal (ver el hallazgo de la pared en L arriba) y se corrigio
iterando contra el motor, no contra la intuicion. Al final, un test
descartable mas (`_debug-n9-n10-verify.test.ts`, tambien borrado)
reverifico las 10 lecciones ya publicadas (no el scratch de diseño) leyendo
directo `LESSONS_N9`/`LESSONS_N10`: los deltas de area, el atari y la
captura del hane, la carrera completa del ojo con blanco jugando
primero, la fusion de grupos al conectar, y que las ~70 keys de i18n
resuelven. `npx tsc -b` limpio, `npx vitest run` 1022/1022 (mismo numero
que antes -- nadie mas referencia estas lecciones todavia), `npm run
lint` sin warnings nuevos.

**Pendiente, no hecho todavia**: verificacion visual real en navegador
(sin herramienta de browser disponible esta sesion); commit y push (no
pedido todavia para este trabajo especifico). Con esto, los 11 niveles
del curriculo maestro (0 a 10) tienen contenido real -- no queda ningun
nivel bloqueado por falta de contenido en `LearnScreen.tsx`.

---

## Estado general del proyecto (2026-09-04, cont. 8: arranca v3 -- Nivel 7 y Nivel 8 construidos completos)

Continuacion de la misma sesion despues de cerrar v2.5 (commits de los
pasos 1+2 y del paso 3+4, ver "cont. 7" mas abajo). El usuario pidio
"scopear v3" y ofrecio conseguir un libro nuevo si hacia falta.

### Scoping: ningun libro nuevo hizo falta

Antes de escribir nada se releyo el capitulo 6 completo de Kajiwara
("Once Upon A Game", via un agente dedicado, despues corregido a mano
releyendo el OCR crudo directamente -- ver mas abajo) y se revisaron
puntualmente los capitulos 4 y 8, que ya estaban parcialmente
muestreados de una sesion anterior. Entre los tres, mas el capitulo 5 ya
usado para Nivel 6, salieron 10 citas verbatim, limpias, no superpuestas
con lo ya citado para Nivel 5/6 -- suficiente para Nivel 7 (Fuseki) y
Nivel 8 (Medio juego: ataque y defensa) completos. Detalle capitulo por
capitulo, con cita y numero de linea del OCR, en
`NOTAS-libro-direction-of-play.md`. Nivel 9 (Yose) y Nivel 10 (tablero
completo) quedan sin investigar todavia -- Nivel 9 tiene ademas un
candidato mecanico fuerte que no depende de ningun libro
(`solver/areaValue.ts`, ya usado para el ejercicio de valor de area de
Nivel 4).

**Correccion de un error propio durante el scoping**: la primera lectura
del capitulo 6 (por agente) uso un rango de lineas estimado a mano
(2610-3164) que resulto estar corrido -- el rango real es ~2637-3174 (el
marcador "CHAPTER 7" en el OCR aparece en 3164 pero el capitulo 6 sigue
hasta 3174; 2610-2636 todavia es el cierre del capitulo 5). Antes de
escribir contenido de leccion se releyo el rango corregido directamente
(no de memoria del resumen del agente, que ya estaba comprimido por una
compactacion de contexto de por medio) para citar con confianza.

**Una cita descartada a proposito**: el capitulo 8 tiene una frase
("Attacking from the direction in which one is strong goes against the
logic of go") que a primera lectura parece contradecir el proverbio
estandar de "atacar desde la fuerza". Leida en contexto contra su propio
diagrama (que el OCR no reconstruye -- ver la nota general del principio
de `NOTAS-libro-direction-of-play.md`) no queda claro que el sentido sea
ese; la jugada correcta en la misma figura tambien sale "from the
direction in which Black is thick". En vez de arriesgarse a ensenar una
version simplificada que capture mal el punto, se descarto la cita sin
construir ningun concepto sobre ella y se uso en su lugar una cita mas
clara del capitulo 4 (profit vs. thickness) para el quinto concepto de
Nivel 8.

### Las 10 lecciones: mismo patron que Nivel 5/6, tablero 19x19

`src/content/lessons/n7.ts` y `n8.ts`, 5 lecciones cada uno, mismo
formato que `n5.ts`/`n6.ts` (parrafo + 1-2 diagramas + parrafo, sin
`demo`). Conceptos nuevos en `analysis/concepts.ts`
(`MOYO_NO_ES_TERRITORIO`, `JUICIO_LOCAL_VS_GLOBAL`,
`RELACION_CON_PIEDRAS_PROPIAS`, `PACIENCIA_Y_MARGEN`,
`DIRECCION_NO_ES_TODO` para Nivel 7; `ATACAR_CONSTRUYENDO`,
`USAR_PIEDRAS_PROPIAS_PARA_ATACAR`, `NO_PELEAR_CON_DEBILIDAD`,
`SACRIFICAR_LO_NECESARIO`, `NO_PELEAR_SIN_NECESIDAD` para Nivel 8), todos
`hasDetector: false, generatesExercises: false` igual que Nivel 4-6 --
la afirmacion vive en la leccion, no en un detector. `n7-l1` y `n7-l4`
comparten exactamente la misma posicion de tablero (una invasion en un
moyo), reutilizada por diseño, no redibujada -- misma tecnica que
`n6-l2`/`n6-l5` compartiendo tablero via `transformBoard`.

**Contenido de Nivel 8 (pelea) deliberadamente mas cauto que Nivel 5-7**:
en vez de contrastar "jugada correcta vs incorrecta" con una afirmacion
tactica especifica (que exigiria verificarla con el solucionador o
arriesgarse a un error de lectura), los 5 diagramas de Nivel 8 son
estructurales/cualitativos -- muestran relaciones espaciales
(piedra de ataque apoyada vs. aislada, grupo propio asentado vs. suelto,
territorio cerrado vs. pared mirando al centro) sin afirmar un resultado
de vida o muerte concreto. Mismo nivel de rigor que ya usaba `n6-l4`
(nunca afirma que la invasion en 3-3 vive, solo que el punto esta
disponible).

**Verificacion de geometria antes de publicar**: se escribio un test
descartable (`tests/content/_debug-n7-n8-geometry.test.ts`, borrado al
terminar) que (1) confirma por conteo de coordenadas -- no a ojo -- que
en `n7-l1`/`n7-l4` los dos puntos naturales de extension de dos espacios
desde la invasion caen en contacto ortogonal directo con una piedra
negra; (2) confirma que `n7-l4` reutiliza literalmente el mismo array de
piedras que `n7-l1`; (3) verifica que ningun diagrama de los dos niveles
tiene piedras fuera de tablero ni duplicadas; (4) imprime los 20
diagramas como ASCII para inspeccion visual directa (todos coinciden con
el diseño pretendido); (5) confirma que los 10 conceptos nuevos apuntan
cada uno a una leccion real y viceversa. Un segundo test descartable
(`tests/content/_debug-n7-n8-i18n-keys.test.ts`) confirmo que las ~70
keys de `titleKey`/`textKey`/`captionKey` referenciadas por las 10
lecciones nuevas resuelven en `en.json` (la paridad exacta con `es.json`
se confirmo aparte, contando keys con Node: 632 en cada archivo, cero
diferencias).

### Cambios de wiring

`content/lessons/types.ts` (`Lesson.level`), `content/lessons/index.ts`
(`lessonsForLevel`), `analysis/concepts.ts` (`Concept.level`) y
`ui/lessons/LearnScreen.tsx` (`View`, el cast de `onBack`) extendidos de
`0 | 1 | 2 | 3 | 4 | 5 | 6` a `... | 7 | 8`. En `LearnScreen.tsx`, Nivel 7
y 8 se movieron de `LOCKED_LEVELS` a `LEVELS` (Nivel 9 y 10 siguen
bloqueados, sin contenido todavia). `learning/profile.ts::currentLevel()`
revisado y dejado intacto a proposito: su rango `[0,1,2,3]` es sobre
niveles con detector de errores, no sobre el curriculo completo -- nunca
incluyo Nivel 4-6 tampoco, no es una limitacion que mis cambios hayan
introducido ni deba tocar aca.

**Correccion de un placeholder desactualizado**: los titulos de Nivel 7
y 8 en `learn.level.7`/`learn.level.8` (ambos idiomas) decian "Midgame" /
"Intermediate life and death" desde que se stubearon `LOCKED_LEVELS` hace
tiempo, sin relacion con el scoping real hecho hoy. Corregidos a "Fuseki"
y "Medio juego: ataque y defensa" / "Midgame: Attack and Defense". Nivel
9 ("Yose"/"Endgame") y Nivel 10 ("Tablero completo"/"Full board") no se
tocaron -- siguen siendo consistentes con el plan actual.

`npx tsc -b` limpio, `npx vitest run` 1022/1022 (35 archivos), sin tests
nuevos rotos (nadie mas referencia todavia estas lecciones). `npm run
lint` (oxlint) sin warnings nuevos en ningun archivo tocado -- los
warnings preexistentes son todos en archivos no relacionados
(`ExercisePracticeScreen.tsx`, `GuidedDemo.tsx`, etc., ya de antes).

**Pendiente, no hecho todavia**: verificacion visual real en navegador
(sin herramienta de browser disponible esta sesion); commit y push
(no pedido todavia para este trabajo especifico); Nivel 9 y 10 sin
scopear.

---

## Estado general del proyecto (2026-09-03, cont. 7: pasos 3+4 del plan v2.5 -- tablero 13x13 desbloqueado en Jugar)

Continuacion de la misma sesion, despues del paso 2 (commit `daf8e44`) y
de commitear/subir aparte un banco de problemas regenerado que llevaba
horas corriendo en segundo plano desde antes en la sesion (commit
`61e7023`, ya pusheado junto con los pasos 1 y 2).

### El paso 3 (deuda de tamaño de tablero) ya estaba resuelto -- iba a repetir trabajo

Antes de tocar codigo se investigo con un agente Explore, explicitamente
pidiendole que NO confiara en el texto de la seccion 8 del roadmap
maestro (despues de encontrar dos veces en esta misma sesion contenido
del roadmap desactualizado -- OJO_FALSO y respaldo de datos). Resultado:
**tambien estaba desactualizado, y esta vez de forma mas llamativa** --
el propio `NOTAS.md` de una sesion anterior ya documenta la conclusion
("no hay nada fijo a 9x9 ahi, contrario a lo que el roadmap maestro
seccion 8 daba a entender"), pero la seccion 8 nunca se corrigio para
reflejarlo. Confirmado con el codigo actual: `createBoard`/`BoardState`
usan `Int8Array(width*height)` dinamico, `getZobristTable(width,height)`
cachea por tamaño sin ningun limite fijo, `solver/region.ts` deriva todo
de `board.width`/`board.height`, y `BOARD_TRANSFORMS`/`applicableTransforms`
ya manejan cualquier tamaño (incluido un tablero rectangular real, 9x13,
del nivel 4). Los cuatro items que la seccion 13 de este mismo roadmap
(escrita HOY mas temprano) planeaba como "paso 3" ya estaban hechos, con
tests propios (`tests/core/board.test.ts`, `tests/solver/region.test.ts`)
cubriendo 9/13/19 explicitamente. **Error propio**: al escribir el plan
v2.5 esta manana no se volvio a verificar la seccion 8 antes de copiarla
como paso 3, a pesar de que el patron de contenido desactualizado ya
llevaba dos casos en la misma sesion -- deberia haber sido mas
sospechoso antes, no despues.

Con esto, el paso 3 real se redujo a lo que en realidad era el paso 4:
`PlayConfigScreen.tsx` bloqueaba 13x13/19x19 solo por una bandera de UI
("se suman cuando el curriculo llegue a esos niveles"), sin ninguna
razon tecnica de por medio -- confirmado leyendo el propio comentario del
codigo y trazando `size` desde `handleStart()` hasta `createGame()` sin
ningun clamp ni caso especial en el medio.

### Verificacion real antes de desbloquear: una partida completa, no solo modulos sueltos

Que cada pieza este probada por separado no prueba que una partida real
completa funcione de punta a punta. Se armo un test descartable
(`tests/engine/_debug-13x13-integration.test.ts`, borrado al terminar)
que juega una partida bot-vs-bot REAL en 13x13 hasta el final (`chooseMove`
+ `applyMove` en un loop, sin atajos) y otra en 19x19 (20 jugadas, sin
terminarla, solo para confirmar que tampoco hay nada roto ahi aunque no
se vaya a desbloquear todavia). Resultado, reproducible con la misma
semilla en dos corridas: 13x13 termina en 112 jugadas, resultado
negro=58 blanco=63.5 (puntaje coherente, area total bajo el limite del
tablero); el SGF hace roundtrip completo (`gameRecordToSgf` ->
`sgfToGameRecord`, mismo mecanismo que usa `PlayGameScreen.tsx` al
guardar). 19x19 con 20 jugadas: sin crashear, puntaje coherente. Dos
intentos previos fallaron por el tope de tiempo del test (60s) mal
calibrado contra lo que de verdad tarda una partida asi (13x13 real:
~165-176s con estos parametros) -- error de calibracion del test, no del
motor, corregido subiendo el tope a 240s.

### Cambio real: `PlayConfigScreen.tsx`

`BOARD_SIZES` ahora incluye 13 (`[5, 7, 9, 13]`), `LOCKED_BOARD_SIZES`
queda solo con 19 (`[19]`). El layout hoshi de 13x13 ya estaba completo en
`ui/board/hoshiPoints.ts` (4 esquinas + tengen, convencion estandar) desde
antes de esta sesion. Sin cambios en ningun otro archivo de motor/reglas
-- no hacia falta, como confirma todo lo de arriba.

Roadmap maestro: seccion 8 corregida (marcada resuelta, con nota de
correccion explicando el desfase), seccion 13 paso 3 marcado
tachado/hecho y fusionado con el paso 4 (ya no quedaba nada aparte que
hacer en el paso 4 una vez resuelto el 3).

Continuacion de la misma sesion, despues de cerrar el paso 1 (commit
`a6f259a`, ver entrada anterior). Antes de escribir nada se investigo con
un agente Explore que tan cierto seguia siendo el texto original del paso
2 en la seccion 13 del roadmap -- resultado: bastante menos nuevo de lo
que decia el plan, buena parte ya estaba construida.

### Lo que ya existia y no se toco

- `planSession()` (`training-policy/session.ts`) ya reserva un 25% del
  cupo de la sesion diaria a los conceptos con peor puntaje del perfil
  (`weakestConcepts`, puntaje TODO EL TIEMPO, no reciente).
- `findConceptsToReopen()` ya reabre una leccion cuando su concepto
  aparece con error real en 3 de las ultimas 5 PARTIDAS -- disparado una
  sola vez, justo despues de guardar una partida nueva en
  `PlayGameScreen.tsx` (a proposito no en Hoy, para no re-marcar sin leer
  de nuevo una leccion ya reabierta).

No se toco `computeProfiles()`/el puntaje de perfil (formula
`0.6*precisionEjercicios + 0.4*penalizacionErrorPartidas`, TODO EL
TIEMPO, sin ventana reciente): ese puntaje tambien alimenta
`ProfileScreen`/`currentLevel()`, cambiar su significado es una decision
mas grande y mas sensible que "practica dirigida a debilidades" por si
sola, no se metio de prepo.

### Lo que se construyo: el mismo mecanismo de reapertura, pero desde ejercicios

Hueco real encontrado: `findConceptsToReopen` solo mira PARTIDAS. Alguien
que falla el mismo concepto una y otra vez en Ejercicios o en Hoy, sin
jugar nunca una partida completa donde el error tambien aparezca, no
recibia ningun aviso de releer la leccion -- la cola SRS lo sigue
reprogramando en silencio, pero nada dice "esto no esta entrando".

`findConceptsToReopenFromExercises(attempts)` (misma seccion de
`training-policy/session.ts`): mismo criterio que la version de partidas
(ventana de 5, umbral de 3), pero la ventana es de los ultimos 5 intentos
DE CADA CONCEPTO (no los ultimos 5 intentos en general) -- un ejercicio ya
viene etiquetado con su concepto (`BankEntry.conceptId`), asi que no hace
falta un detector ni volver a analizar nada, solo agrupar por concepto y
contar `solved === false` (mismo booleano que ya usa `computeProfiles`
para "incorrecto"). Conectado en `useSolvableExercise.ts::recordOutcome`,
mismo lugar y mismo patron que `PlayGameScreen.tsx` (evaluar una vez, justo
despues de guardar el intento nuevo, dentro del mismo try/catch que ya
trata el registro de aprendizaje como best-effort). Como ese hook es
compartido entre Ejercicios y Hoy, funciona en los dos sin duplicar nada.
La tarjeta de "leccion reabierta" en TodayScreen ya lee las reaperturas de
forma generica (no le importa que mecanismo la disparo), asi que no hizo
falta tocar nada de UI.

A proposito NO se intento generar esta misma señal para los conceptos de
nivel 4 a 6 via el motor de evaluacion (la idea original, mas vaga, de la
seccion 13): esos conceptos son juicio de direccion, mas dificiles de leer
para la red que los tacticos que ya midio el roadmap con mal resultado
(0-3% top1 en lectura exhaustiva) -- inventar un "detector" ahi con una
señal poco confiable arriesgaba decirle a un usuario real que se equivoco
cuando no era cierto, exactamente el tipo de afirmacion de contenido sin
verificar que este proyecto evita en todos lados. Sigue sin haber forma de
detectar una debilidad real en niveles 4-6 -- gap conocido, no resuelto.

Tests nuevos en `tests/training-policy/session.test.ts` (14/14, mismo
estilo que los de `findConceptsToReopen`). Un error propio en el primer
intento: el helper `day()` estaba definido dentro del `describe` viejo,
no visible desde el nuevo -- se subio a scope de modulo, sin cambiar su
comportamiento.

### Dos hallazgos aparte, documentados pero no resueltos ahora

- **Bug real encontrado por el agente Explore**: `PRIMERA_LINEA_TEMPRANA`
  (unico concepto "transversal" con `hasDetector:true`, el otro es
  `JUGADA_LEJOS_DEL_COMBATE`) tiene `lessonId: 'transversal'` -- un
  placeholder que nunca se resolvio a una leccion real, `getLesson()`
  devuelve null. Si este concepto llega a cruzar el umbral de reapertura
  en una partida real, `PlayGameScreen.tsx` ya lo maneja sin romperse
  (`if (lesson) reopenLesson(...)`), pero en silencio: no pasa nada, sin
  aviso. Se revisaron las 7 lecciones de nivel 1 y ninguna cubre "jugar en
  la primera linea temprano" -- no es un typo con arreglo facil, es una
  leccion que nunca se escribio. No se escribio ahora (es contenido nuevo,
  una decision aparte); queda documentado como pendiente real.
- **Correccion sobre respaldo de datos**: en la discusion de ideas de esta
  sesion se le dijo al usuario que la exportacion/importacion "todavia no
  existia". Era incorrecto -- ya estaba hecha (`storage/backup.ts` +
  `SettingsScreen.tsx`, commit `3dc7b89`, 2026-09-01), la seccion 5 del
  roadmap maestro simplemente nunca se actualizo para reflejarlo (mismo
  tipo de error que la seccion 1.2 con `OJO_FALSO`). Corregido en el
  roadmap y aca.

`tsc -b` limpio, 956/956 tests (5 nuevos de `findConceptsToReopenFromExercises`
+ los 951 que ya existian, ninguno modificado). Commiteado.


Continuacion de la misma sesion. El usuario probo la app, pidio discutir
que sigue antes de ver el detalle de sus pruebas. Se discutieron
alternativas (tableros mas grandes, mas ejercicios, mas dificultades, mas
contenido, bot mas rapido) y se acordo un plan secuenciado, escrito en
`go-trainer-roadmap-maestro.md` seccion 13 (v2.5): 1) rendimiento del bot
(la queja es latencia, no fuerza -- explicitamente sin meter la red de
KataGo para esto), 2) practica dirigida a debilidades, 3) deuda de tamaño
de tablero (v1.5), 4) tablero 13x13 jugable en Jugar, 5) mas contenido
(profundizar 0-6 o arrancar v3, a decidir despues).

### Paso 1, rendimiento del bot: perfilado real, mejora modesta (~10-15%)

Mismo criterio de "verificar antes de escribir" aplicado esta vez a
rendimiento en vez de contenido: un archivo de test descartable
(`tests/engine/_debug-mcts-perf.test.ts`, borrado al terminar) midio con
`performance.now()` en vez de asumir donde se iba el tiempo.

Hallazgo principal: en 9x9, `chooseMove` gasta practicamente el 100% de su
tiempo dentro de `simulatePlayout` (un playout aislado sin arbol UCT
cuesta lo mismo por jugada que el promedio dentro de `chooseMove` real) --
la maquinaria de seleccion/expansion UCT es insignificante en
comparacion. Un playout en 9x9 dura en promedio ~110 jugadas (mediana 106,
maximo observado 169), bien por debajo del tope artificial de 243 -- se
descarto la hipotesis de que los playouts corrieran hasta ese tope por no
pasar nunca.

Atribucion del costo por jugada simulada, medida a mitad de partida
(55 jugadas ya puestas): `findCapturingMoves` + `findAtariSavingMoves`
(las heuristicas de captura/atari de la politica de playout) ~60%,
armado de candidatas (`shuffledIndices` + `isSimpleEye`) ~28%,
`applyMove` en si (clonar tablero, chequeo de suicidio, chequeo de
superko) ~12% y creciendo con la profundidad del historial dentro de un
mismo playout (confirmado con un test aparte: mismo punto, mismo tablero,
el costo de `applyMove` crece con la cantidad de hashes ya jugados).

Primera hipotesis equivocada, corregida por la medicion: se penso que
`findCapturingMoves`/`findAtariSavingMoves` recorrian el tablero dos veces
de forma redundante (una por color) y que fusionarlas en una sola pasada
cortaria ese 60% a la mitad. Medido despues del cambio, la mejora fue casi
nula -- las dos llamadas originales ya se repartian el trabajo por color,
sin duplicar el flood-fill de ningun grupo. La fusion se dejo igual (mas
prolija, cero riesgo, cero regresion) pero el verdadero cuello de botella
resulto ser otro: `getGroup` (`core/groups.ts`), con BFS sobre `Set`
nuevo en cada llamada, se invoca decenas de veces por jugada simulada
(una vez por grupo distinto en el escaneo de captura/atari, mas varias
veces mas dentro de cada `applyMove`), y para los grupos chicos tipicos
de una partida al azar el costo fijo de crear y hashear un `Set` pesaba
mas que el recorrido en si.

Cambios aplicados, los tres de bajo riesgo (no tocan `core/rules.ts` mas
alla de `groups.ts`, no cambian el contrato publico de ninguna funcion,
956/956 tests pasan sin modificar ninguno):

- `core/groups.ts`: `getGroup` usa un buffer `Uint8Array` reutilizable
  entre llamadas en vez de un `Set` nuevo cada vez, limpiando solo los
  indices tocados (no el tablero entero) al terminar. Seguro porque
  `getGroup` es sincronico y no reentrante, y cada Web Worker tiene su
  propia copia del modulo. `Group.liberties` sigue siendo `Set<number>`
  (forma publica sin cambios; 10 archivos dependen de ella).
- `engine/playoutPolicy.ts`: nueva `findOneLibertyPoints` hace en una
  pasada lo que antes eran dos llamadas separadas a `groupsWithOneLiberty`
  (una por color). `findCapturingMoves`/`findAtariSavingMoves` originales
  se dejaron intactas (siguen probadas y usadas donde ya estaban).
  `mcts.ts` ahora usa la version combinada.
- `engine/random.ts`: `shuffledIndices` barajaba una copia (`shuffle()`
  clona antes de barajar) cuando el array recien creado no tiene otro
  dueño y se puede barajar en el lugar. `engine/mcts.ts` ademas ahora
  baraja solo los puntos vacios del tablero (antes barajaba TODOS los
  puntos y descartaba los ocupados adentro del loop).

Resultado medido: `simulatePlayout` aislado bajo de ~3.0ms a ~2.6-2.7ms
por playout (~10-15%, con ruido real entre corridas -- no es un numero
exacto). No alcanza para que `veryStrong` (8000 playouts pedidos, tope de
15000ms) deje de agotar su presupuesto de tiempo: sigue completando
~4800-4900 de 8000 playouts pedidos, es decir, el usuario sigue esperando
el tope completo de 15 segundos en ese nivel. El costo esta repartido en
muchas operaciones chicas (decenas de llamadas a `getGroup`, varios
escaneos del tablero, el chequeo de superko) que se repiten en cada una de
las ~110 jugadas de cada uno de hasta 8000 playouts, no concentrado en un
solo cuello de botella que alcance con arreglar una vez.

El usuario pidio seguir insistiendo ("keep pushing, I know you can do
it") en vez de pasar al paso 2 con la mejora modesta de arriba. Segunda
ronda de investigacion:

**`listLegalMoves` descartado con medicion directa, no estimacion.** Se
instrumento temporalmente `createNode` (contador + acumulador de tiempo,
retirado despues de medir) para confirmar cuanto pesa de verdad dentro de
una busqueda real completa, en vez de dejarlo como la estimacion "2-5%
sin confirmar" de la entrada anterior. Resultado: `nodosNuevos` es
practicamente igual a `playoutsRun` (se crea un nodo nuevo por playout
casi siempre, el arbol nunca se queda sin posiciones nuevas a estos
volumenes) y el tiempo total en `listLegalMoves` es un consistente
2.8-3.3% del total en los 4 niveles de fuerza. Confirmado chico, no vale
el riesgo de reescribirlo.

**El verdadero resto: el chequeo de superko crecia peor que lineal con la
profundidad.** El test de "mismo punto, historial creciente" ya habia
mostrado que el costo de `applyMove` no crecia parejo (de profundidad 50 a
100, el costo crecio 4-5x, no 2x). Causa: `GameState.history` era un
array (`bigint[]`) que se recorria entero (`.includes(hash)`) Y se copiaba
entero (`[...history, hash]`) en cada jugada -- dos operaciones O(n)
independientes en la misma jugada, sobre un array que crece durante todo
un playout Y arrastra el historial real de la partida ya jugada (en una
partida real de 100+ jugadas, cada playout empieza ya cargando ese
prefijo).

Se penso primero en pasar `history` a `Set<bigint>` para el chequeo O(1),
pero copiar un Set entero en cada jugada (`new Set(history).add(hash)`)
es el mismo costo asintotico que copiar el array -- no resuelve nada,
podria incluso ser mas lento por el hashing. La solucion real: `history`
pasa a ser una lista enlazada inmutable (`HistoryNode { hash, prev }`,
`core/types.ts`) en vez de un array. Agregar un hash nuevo es
`{ hash, prev: state.history }` -- **sin copiar nada**, O(1) real. El
chequeo de superko (`historyContains` en `core/rules.ts`) sigue siendo un
recorrido de principio a fin, pero ya no carga tambien el costo de la
copia -- la mitad del problema resuelta de raiz, sin agregar riesgo:
`GameState` sigue siendo inmutable (cada jugada devuelve un nodo nuevo
que apunta al anterior, nunca se muta nada), y el unico otro lugar del
codebase que leia `.history` (`solver/tsumego.ts`, solo el hash actual)
se actualizo en el mismo cambio. `Group.liberties` y el resto de la forma
publica de `applyMove` no cambiaron.

Antes de implementarlo se confirmo que valia la pena con una medicion
aparte: `chooseMove` a distintas profundidades reales de partida (jugada
1, 40, 80, 120) NO mostro una tendencia clara de "se pone mas lento con
la partida" (2.99 / 2.51 / 1.56 / 3.51 ms por playout) -- resultado
ruidoso porque compite con un efecto contrario (el tablero mas lleno
acorta los playouts). Se implemento igual porque el mecanismo (menos
copias, mismo trabajo) nunca puede ser mas lento, solo igual o mejor, sin
depender de que ese efecto se manifieste limpio en la medicion.

Resultado medido, comparado contra la version original de esta sesion
(antes de cualquiera de los dos cambios): `veryStrong` paso de completar
~4818-4860 de 8000 playouts pedidos a **completar 5134** en el mismo tope
de 15000ms (+6-7%); `strong` (2000 playouts fijos) bajo de 6327ms a
5898ms (-6.8%); `normal` (500 playouts fijos) bajo de 1589ms a 1491ms
(-6.2%). Sumado a la primera ronda, la mejora total ronda 15-20% segun la
metrica, con la salvedad de siempre: estas mediciones tienen ruido real
de corrida a corrida, no son un numero de laboratorio exacto. Sigue sin
alcanzar para que `veryStrong` complete sus 8000 playouts pedidos dentro
del tope de 15 segundos -- ese nivel va a seguir tardando el maximo
configurado pase lo que pase, salvo que se le suba el tope de tiempo o se
le baje el pedido de playouts (decision de producto, no de codigo).

`tsc -b` limpio y 951/951 tests pasan sin modificar ninguno, incluida la
bateria completa (no solo `engine`/`core`) porque `GameState.history` es
un tipo compartido que toca el solucionador (`solver/tsumego.ts`),
validacion de contenido y el resto de la UI de forma indirecta.

**Con esto se cubrieron las 4 piezas del perfilado original** (60%
escaneo de captura/atari, 28% armado de candidatas, 12% `applyMove`
creciendo con el historial, ~3% `listLegalMoves`) -- no queda ningun
cuello de botella identificado y sin tocar dentro de lo que el perfilado
encontro. Seguir mas alla de aca significaria o bien un cambio de fondo
(evitar el playout completo hasta el final de la partida, reemplazandolo
por una evaluacion de posicion -- exactamente la opcion de meter la red
de KataGo que el usuario ya descarto para este paso) o ajustar
`maxTimeMs`/`playouts` por nivel (tradeoff de fuerza vs. latencia, decision
de producto).

Commiteado (`a6f259a`, no subido todavia a origin).

### Se investigo conectar la red de KataGo al MCTS -- descartado por ahora, no por siempre

El usuario pregunto directamente si valia la pena, ya que la red esta
empaquetada pero solo corre para lecciones (seccion 9.1 de
`go-trainer-roadmap-maestro.md`). Antes de opinar, se midio de verdad:
se cargo el mismo modelo vendorizado que usan los tests de
`tests/eval/model.test.ts` (`public/models/kata-b10c128/`, mismo
mecanismo de carga que ese archivo) y se corrio `encodeInput` +
`evaluatePosition` sobre una posicion realista de mitad de partida en
9x9.

Resultado: `encodeInput` es barato (0.64ms/llamada). `evaluatePosition`
(la inferencia real) cuesta **~1043ms por llamada** en el backend CPU de
Node (sin WebGL disponible en el entorno de test) -- unas 400 veces mas
que un playout completo de MCTS entero (~2.6ms, con las mejoras de mas
arriba). Aunque ese numero es pesimista (el navegador real usaria
WebGL/GPU, mas rapido), la brecha es demasiado grande para que importe:
incluso con una aceleracion generosa de 50-100x por GPU -- optimista para
un WebView movil, donde las GPUs son mucho mas debiles que un desktop --
seguiria constando 10-20ms por llamada, todavia 4-8x mas lento que un
playout completo hoy. Usarla adentro de cada playout (la forma simple de
"conectarla") haria el bot mas lento, no mas rapido -- lo opuesto a lo que
se pidio este paso.

Conclusion: descartado para el objetivo de latencia de este paso, pero
NO descartado para siempre -- el usuario pidio dejarlo anotado como
mejora futura. La version que si tendria sentido (motores reales como
AlphaZero/KataGo lo hacen asi) es reemplazar miles de rollouts aleatorios
por un puñado de simulaciones guiadas por la red -- un rediseño del
algoritmo, no un simple "conectar la red adentro del loop actual", y que
necesitaria medir la latencia real en navegador (no Node) antes de
decidir si vale la pena -- no se pudo hacer en esta sesion, sin
herramienta de navegador disponible.

**Con esto, paso 1 del plan v2.5 queda cerrado.** El usuario decidio pasar
al paso 2 (practica dirigida a debilidades) en vez de seguir insistiendo
en rendimiento.


Reemplaza la version "cont. 3: Nivel 4 conectado..." de mas abajo (dejada
como registro historico). Continuacion de la misma sesion. Con esta
entrada, los 6 niveles de v2 (Forma, Apertura, Joseki) tienen 5/5
conceptos con leccion real, verificada, y conectada a Aprender.

### El libro de Kajiwara, legible: Poppler + Tesseract via winget

El usuario pidio "leer el PDF de otra forma" despues de que el intento
anterior (adjunto de chat) no llegara. El PDF (`Go_app/the_direction_of_play.pdf`,
130 paginas) es un escaneo sin capa de texto, confirmado con `pdftotext`
(0 caracteres extraidos). Se instalaron dos herramientas via `winget`:

- **Poppler** (`oschwartz10612.Poppler`) ya estaba instalado pero no en el
  PATH de la sesion de Bash; se ubico el binario directo en
  `AppData\Local\Microsoft\WinGet\Packages\...\poppler-25.07.0\Library\bin\`
  y se invoco por ruta completa. `pdftoppm -png -r 150` renderizo las 130
  paginas a imagenes.
- **Tesseract OCR** (`UB-Mannheim.TesseractOCR`, version 5.4.0) no estaba
  instalado; la primera instalacion silenciosa fallo (`0x800704c7`,
  probable prompt de UAC cancelado), la segunda con `--force` funciono.

Con las 130 imagenes, un loop de `tesseract ... --psm 6` genero un texto
corrido de 226KB. Calidad buena en la prosa (parrafos legibles con
errores menores tipicos de OCR), pero los diagramas de tablero (dibujados
con caracteres ASCII/box-drawing en el original) salen como ruido
ilegible -- no se intento leerlos, solo el texto en prosa. Cobertura:
capitulo 1 completo ("The Direction Of Play In The Opening: The Corner
Stones") y capitulo 5 completo ("The Direction Of Play And Josekis"); el
resto (capitulos 2-4, 6-8) muestreado solo parcialmente. Detalle completo,
citas literales y su aplicacion en `NOTAS-libro-direction-of-play.md`
(documento nuevo, mismo formato que `NOTAS-libro-kageyama.md`).

Hallazgo notable: el capitulo 1 confirma palabra por palabra, sin
necesidad de corregir nada, el diseño ya hecho de `n6-l4`
(`HOSHI_INVASION_3_3`, escrito ANTES de poder leer este libro) -- "a
stone on the star point... there is no possibility of closing off the
territory... a weakness, namely the three-three point." El capitulo 5
tambien confirma, con un ejemplo real con nombre propio (una variante del
taisha), el diseño ya hecho de `n6-l1`/`n6-l3` sobre que un joseki
correcto en abstracto no es lo mismo que la jugada correcta para el
tablero completo. Ninguno de los dos niveles construidos antes de leer el
libro necesito cambios despues de leerlo.

### Nivel 5 (Apertura, 13x13): 5 de 5 conceptos, cerrado y conectado

Lista de conceptos reemplazada por una version mas precisa que la
propuesta original (hecha sin la fuente): cada uno cita o parafrasea
directamente el capitulo 1 del libro.

1. **PUNTO_ESTRELLA_DOS_DIRECCIONES** (`n5-l1`): una piedra en 4-4
   declara interes en dos direcciones a la vez, sin cerrar territorio.
2. **PUNTO_3_4_DEPENDE_ESQUINAS** (`n5-l2`): la direccion principal de un
   3-4 vale lo que valga el resto del tablero en ese lado -- diagrama
   "sola" vs "con blanco ya en el camino de su direccion principal".
3. **PUNTO_3_3_SIN_DIRECCION** (`n5-l3`): contraste directo con el
   concepto 1 -- "there is no direction of play from the 3-3 point."
4. **PUERTA_PRINCIPAL_TRASERA** (`n5-l4`): tras un cerco de esquina, la
   direccion principal ("front door") deja una forma mas compacta
   ("caja") que la secundaria ("back door", "bandeja") -- verificado con
   un test de depuracion que la huella de la variante "caja" es
   aproximadamente cuadrada (4x4) y la de "bandeja" claramente alargada
   (1x7), no solo confiando en la geometria a ojo.
5. **COMBINAR_DIRECCIONES** (`n5-l5`): dos piedras cuya direccion apunta
   al mismo lado se refuerzan (nirensei); si apuntan a lados opuestos, no
   de la misma forma.

Mismo patron que Niveles 4 y 6: `hasDetector: false, generatesExercises:
false, severity: 'low'`, geometria simple a proposito (aritmetica de una
sola fila o columna) en vez de reproducir diagramas de joseki de memoria,
verificado con un test de depuracion descartable (borrado despues) antes
de aceptar los numeros. `content/lessons/n5.ts` (nuevo), `index.ts` suma
`LESSONS_N5`, `analysis/concepts.ts` suma los 5 `ConceptId` (con el
comentario de "pendiente" reemplazado), `i18n/locales/en.json` y `es.json`
suman 25 claves de leccion + 10 de concepto cada uno (paridad confirmada
por conteo, 35 y 35). `LearnScreen.tsx`: `LEVELS` vuelve a ser contiguo,
`[0,1,2,3,4,5,6]` -- ya no hace falta saltar el 5.

### Verificacion

`npx tsc -b` limpio. `npx oxlint`: sin warnings nuevos en
`n5.ts`/`LearnScreen.tsx`/`concepts.ts`. `npx vitest run` completo:
951/951 en verde (35 archivos).

Sigue pendiente, sin cambios: la pasada de Playwright en vivo (sin
herramienta de navegador disponible en esta sesion) y la revision externa
liviana de contenido (roadmap seccion 1.4), que ahora deberia incluir
Niveles 4, 5 y 6 completos en su muestra.

### Commit, push y AAB de release, los dos a pedido explicito del usuario

Todo el trabajo de esta sesion (entradas "cont. 3" y "cont. 4": Nivel 4
conectado, Nivel 6 completo, Nivel 5 completo, mas los datos de fondo ya
listos de antes) esta commiteado y subido a `origin/master` de `hoshi`, en
dos commits (`4d040b8`, `9eb4831`).

AAB de release regenerado siguiendo el pipeline documentado
(`hoshi-flutter/sync-webapp.ps1`): `npm run build` en `hoshi/` (limpio) ->
sync -> bump manual de `pubspec.yaml` -> `flutter build appbundle
--release` (`C:\flutter\bin\flutter.bat`, no esta en el PATH de esta
maquina). Version `1.8.2+13 -> 1.9.0+14` (bump menor, no de parche: los
tres niveles de v2 pasando de invisibles/inexistentes a completos y
navegables es un cambio de feature real, mismo criterio que subidas
anteriores como 1.6.0+9). Build firmado con la key de release real,
56.3MB, en `hoshi-flutter/build/app/outputs/bundle/release/app-release.aab`
(no trackeado por git, confirmado en `.gitignore`). Cambios de
`hoshi-flutter/` (sync de assets + version) commiteados y subidos a su
propio repo (`dbc1b87`, `origin/master` de `hoshi-flutter`).

**No subido a Play Console** -- eso sigue siendo una decision y accion
manual del usuario, no se hace automaticamente en cada build local. La
ultima version confirmada subida por el usuario, segun el roadmap
maestro seccion 4.3, sigue siendo 1.5.0+8 -- esta build (1.9.0+14) y
varias anteriores (hasta 1.8.1+12) siguen sin subir.

---

## Estado general del proyecto (2026-09-03, cont. 3: Nivel 4 conectado a Aprender, Nivel 6 -- Joseki -- cerrado y conectado)

Reemplaza la version "cont. 2: Nivel 4 cerrado..." de mas abajo (dejada
como registro historico). Continuacion de la misma sesion.

### Punto 2 de v2 (roadmap seccion 9.2): Nivel 4 conectado a la interfaz real

`LearnScreen.tsx`: `LEVELS` paso de `[0,1,2,3]` a `[0,1,2,3,4,6]` (ver mas
abajo por que salta el 5) y su entrada salio de `LOCKED_LEVELS`. Las 5
lecciones de Nivel 4 (incluida `n4-l5`) son alcanzables desde Aprender por
primera vez. Cambio acotado a un solo archivo: se reviso
`learning/profile.ts::currentLevel()` y `ui/profile/ProfileScreen.tsx`/
`ui/today/TodayScreen.tsx` (que tambien tienen su propio `LEVELS`/
`0|1|2|3`) y **a proposito no se tocaron** -- los 5 conceptos de Nivel 4
tienen `hasDetector: false, generatesExercises: false` (confirmado en
`analysis/concepts.ts`), asi que `conceptsWithEvidence()` ya los filtra
fuera de esas pantallas por construccion, exactamente el mismo mecanismo
ya establecido para KO/CONTEO_AREA en Nivel 1 (comentario ya existente en
`concepts.ts` sobre ese caso). Ampliar esas pantallas habria sido alcance
no pedido, sin efecto visible, y un riesgo real de regresion en la logica
de "nivel actual" de Hoy.

### Punto 3 de v2: Nivel 6 (Joseki, 13x13) -- 5 de 5 conceptos, cerrado y conectado

El usuario pidio arrancar los puntos 2, 3 y 4 del roadmap (seccion 9.2) en
la misma sesion, junto con reintentar la subida del libro de Kajiwara
(*The Direction of Play*) que habia fallado como adjunto de chat. Encontre
el PDF ya guardado en `Go_app/the_direction_of_play.pdf` (35MB) por pedido
directo del usuario ("esta en la carpeta go_app"), pero es un escaneo sin
capa de texto real: `pdftotext -layout` sobre el archivo completo extrajo
0 caracteres de texto (confirmado dos veces, con y sin `-layout`), y no hay
`pdftoppm` ni ningun OCR (`tesseract` ausente) instalado en esta maquina
para leerlo como imagen. No se instalo nada para forzar una lectura --
mismo criterio que la vez anterior con el libro de Kageyama: es una
decision del usuario, no algo para resolver de forma silenciosa cambiando
el entorno. El adjunto de chat (que si funciono con el PDF de Kageyama,
tambien un escaneo viejo) sigue siendo el camino mas probable; queda
pendiente que el usuario lo reintente.

Como Nivel 5 (Apertura) es exactamente el tema de ese libro (direccion de
juego en la apertura) y Nivel 4 ya mostro el costo real de inventar
contenido de direccion sin una fuente (3 intentos de verificacion
automatica fallidos antes del libro de Kageyama), se pospuso Nivel 5 hasta
que el libro este legible, y se armo Nivel 6 (Joseki) en su lugar -- tema
distinto, no afectado por ese libro. Lista de 5 conceptos propuesta al
usuario y confirmada antes de escribir contenido (mismo criterio que ya
existia informalmente para Nivel 4, ahora explicito):

1. **QUE_ES_JOSEKI** (`n6-l1`): que es un joseki y por que no memorizarlo a
   ciegas -- framing conceptual, proverbio real ("aprender joseki de
   memoria te hace dos piedras mas debil").
2. **BLOQUEO_HACIA_APOYO** (`n6-l2`): frente a una aproximacion, bloquear
   hacia una piedra propia cercana vale mas que bloquear hacia el vacio.
   Geometria deliberadamente simple (una sola columna, distancias parejas)
   en vez de una secuencia de joseki de libro memorizada -- mismo criterio
   de minimizar riesgo de un error geometrico sutil sin fuente para
   verificar contra.
3. **TENUKI_JOSEKI** (`n6-l3`): dejar una secuencia local sin terminar
   porque aparecio algo mas grande en otro lado -- conceptual, proverbio
   real ("jugada urgente antes que jugada grande").
4. **HOSHI_INVASION_3_3** (`n6-l4`): el punto 4-4 no bloquea ni penaliza el
   3-3 por si solo -- se muestra que 3-3 sigue siendo una jugada legal
   normal contra un 4-4 solitario, sin afirmar que la invasion *vive* (esa
   lectura de vida-muerte de esquina es mucho mas profunda que lo que este
   proyecto verifica para contenido nivel 4-6; afirmar solo lo que se
   puede respaldar).
5. **JOSEKI_SIMETRIA** (`n6-l5`): la misma logica vale en cualquier esquina
   del tablero, via las 8 simetrias diedrales. Reutiliza
   `BOARD_TRANSFORMS`/`transformBoard`/`transformPoint` (`core/board.ts`,
   ya construido para multiplicar el banco de problemas) para generar el
   diagrama espejado **por codigo**, no redibujado a mano -- la seccion 8
   del roadmap maestro ya preveia que esta utilidad iba a hacer falta aca.

Todos con `hasDetector: false, generatesExercises: false, severity: 'low'`,
mismo patron que Nivel 4. Verificado con un test de depuracion descartable
(`tests/content/_debug-n6.test.ts`, borrado despues): las 5 lecciones
existen en el orden correcto, los diagramas de `n6-l2` tienen exactamente 4
piedras sin superposicion y el punto resaltado cae sobre una piedra negra
real en ambas variantes, el punto resaltado de `n6-l4` cae sobre la piedra
blanca de la invasion, y el diagrama girado de `n6-l5` es una rotacion de
180 grados exacta del original (recalculada de forma independiente en el
test, no solo confiando en la funcion de transformacion) incluida la
piedra resaltada.

`content/lessons/index.ts` suma `LESSONS_N6`, con un comentario explicito
de que Nivel 5 se salta a proposito. `analysis/concepts.ts` suma los 5
`ConceptId` nuevos mas un comentario explicando por que Nivel 5 no esta
(bloqueado en el libro). `LearnScreen.tsx` conecta Nivel 6 (mismo cambio
que Nivel 4, `LEVELS` ahora `[0,1,2,3,4,6]` -- salta el 5 porque no tiene
contenido, no es un descuido). `i18n/locales/en.json` y `es.json` suman 23
claves de leccion + 10 claves de concepto cada uno, paridad confirmada por
conteo (`grep -c`, 33 y 33).

### Accidente y recuperacion: este mismo archivo

Un `Write` de este archivo (pensado para anteponer esta entrada) borro por
error las ~3100 lineas existentes, incluida una entrada entera todavia sin
commitear. Restaurado desde el ultimo commit y la entrada perdida
reconstruida lo mejor posible -- detalle completo en la nota que sigue
inmediatamente despues de esta entrada. Se documenta aca tambien para que
quede en el resumen de la sesion, no solo en la nota tecnica de abajo.

### Verificacion

`npx tsc -b` limpio despues de cada cambio grande (Nivel 4 conectado,
luego Nivel 6 completo). `npx oxlint`: sin warnings nuevos en
`n6.ts`/`LearnScreen.tsx`/`concepts.ts`. `npx vitest run` completo,
corrido dos veces (despues de conectar Nivel 4, y de nuevo despues de
agregar Nivel 6 completo): 951/951 tests en verde las dos veces (35
archivos).

Sigue pendiente, sin cambios respecto a la entrada anterior: la pasada de
Playwright en vivo (sin herramienta de navegador disponible en esta
sesion) y la revision externa liviana de contenido (roadmap seccion 1.4),
que ahora deberia incluir tambien Nivel 6 en su muestra, no solo Nivel 4.

### Que falta de los puntos pedidos (2, 3, 4 del roadmap)

- **Punto 2** (conectar Nivel 4): hecho, ver arriba.
- **Punto 3** (Nivel 5, Apertura): pospuesto, bloqueado en el libro de
  Kajiwara (PDF escaneado, sin OCR disponible en esta maquina). El usuario
  puede reintentar el adjunto de chat (funciono con Kageyama) o pasar el
  texto de otra forma.
- **Punto 4** (Nivel 6, Joseki): hecho fuera de orden (antes que el punto
  3) porque no depende del libro bloqueado, ver arriba.

---

## Nota sobre esta entrada y la siguiente (reconstruccion parcial, 2026-09-03)

Un `Write` accidental sobre este archivo (deberia haber sido un `Edit` que
antepone contenido nuevo) borro por completo la version en curso -- de
~3100 lineas a 125 -- incluyendo una entrada entera todavia sin commitear
("cont. 2: Nivel 4 cerrado -- DIRECCION_LADO_GRANDE resuelto con el libro
de Kageyama"). Restaurado desde `git show HEAD:NOTAS.md` (el ultimo commit,
`5ee6de4`, con las 3087 lineas de siempre) porque no habia forma de
recuperar el estado exacto de la copia de trabajo: la copia de trabajo no
estaba commiteada, y el historial local de VSCode no tenia nada guardado
para este archivo (las escrituras de esta herramienta van directo a disco,
sin pasar por el buffer de guardado del editor). La entrada "cont. 2" de
abajo esta reconstruida a partir del resumen de la conversacion y de las
primeras ~45 lineas que se habian leido literalmente unos minutos antes del
accidente -- fiel en los hechos (verificados de nuevo contra
`content/lessons/n4.ts` y `analysis/concepts.ts`, que nunca se tocaron y
siguen intactos), pero no necesariamente palabra por palabra igual a la
version perdida. Se documenta aca en vez de silenciarlo. La leccion
`n4-l5` y el concepto `DIRECCION_LADO_GRANDE` en si nunca estuvieron en
riesgo -- viven en archivos de codigo separados que este accidente no tocó.

## Estado general del proyecto (2026-09-03, cont. 2: Nivel 4 cerrado -- DIRECCION_LADO_GRANDE resuelto con el libro de Kageyama) [reconstruida]

Reemplaza la version "2026-09-03, banco +35..." de mas abajo (dejada como
registro historico). Continuacion de la misma sesion.

### El 5to concepto de Nivel 4 (direccion / lado grande), resuelto

El usuario subio el PDF real del libro (`Toshiro Kageyama - Lessons in the
Fundamentals of Go.pdf`, en `Go_app/`, fuera de este repo) directamente al
chat, lo que permitio leerlo completo por primera vez (antes solo se habian
muestreado paginas sueltas, ver `NOTAS-libro-kageyama.md`). Hallazgo clave:
el libro NO tiene un capitulo dedicado a "direccion de juego" -- ese es un
libro distinto (*Direction of Play*, Kajiwara Takeo, listado en el catalogo
de la contratapa de este libro, pag. 137, que el usuario no habia subido
todavia). Pero el capitulo 5 ("Territory and Spheres of Influence") da algo
mejor que un diagrama especifico: su tesis central, citada literal, es que
"inability to distinguish between [territory and spheres of influence] is
one of the weaknesses of amateur go" (p.88), mas la regla de oro de la
p.98, "don't use thickness to surround territory."

Eso reencuadra el concepto entero. El experimento fallido de partidas
simuladas de una entrada anterior ("Direccion (lado grande) -- sigue sin
verificarse") no era ruido: ese diseño tenia el lado "grande" ya asegurado
por una pared completa (bajo valor marginal reforzarlo) y el lado "chico"
genuinamente en disputa (alto valor). Kageyama explica exactamente ese
resultado en vez de contradecirlo.

En vez de forzar la afirmacion original ("jugar del lado grande"), ya
mostrada fragil/invertible con partidas simuladas, la leccion nueva
(`n4-l5`, concepto `DIRECCION_LADO_GRANDE`) enseña la version correcta:
comparar un area ya asegurada contra una todavia abierta, no por tamaño
bruto sino por si el borde ya esta decidido. Verificado con
`computeAreaScore` (conteo de area real, no partidas simuladas ni el motor
de evaluacion) sobre dos bolsillos en el mismo tablero 9x13:

- Bolsillo ya cerrado por negro (12 puntos, esquina arriba-izquierda):
  jugar adentro cambia el puntaje en **0** -- ya contaba como de negro.
- Bolsillo mas chico, con un solo punto sin cerrar (4 puntos interiores +
  la jugada misma): cerrarlo suma **+5** de una sola vez -- todavia estaba
  en disputa (bordeaba negro Y blanco antes del cierre).

A proposito el bolsillo "grande" es mayor en puntos brutos que el "chico"
-- asi el ejemplo refuta directamente la heuristica ingenua de "jugar donde
se ve mas grande".

### Archivos y verificacion

`content/lessons/n4.ts` (constantes de geometria + deltas calculados al
cargar el modulo, no escritos a mano, mas el bloque de la leccion `n4-l5`),
`analysis/concepts.ts` (`ConceptId` + entrada `CONCEPTS.DIRECCION_LADO_GRANDE`,
`hasDetector: false, generatesExercises: false, severity: 'low'`, mismo
patron que sus hermanos de Nivel 4), `i18n/locales/en.json` y `es.json`
(5 claves de leccion + 2 de concepto cada uno, paridad verificada). Un test
de depuracion descartable en `tests/content/` se uso para verificar la
geometria y los numeros antes de aceptarlos, despues se borro. `npx tsc -b`
limpio, `npx vitest run` completo en verde, `npx oxlint` sin warnings
nuevos. `NOTAS-libro-kageyama.md` y `go-trainer-roadmap-maestro.md`
(seccion 9) se actualizaron en paralelo con el mismo hallazgo.

Pendiente, explicitamente: no hubo forma de hacer una pasada de Playwright
en vivo contra la leccion nueva (sin herramienta de navegador disponible en
esta sesion) -- confirmacion visual en la UI real sigue abierta.

---

## Estado general del proyecto (2026-09-03, banco +35 (+area de juego en progreso), mecanismo de reapertura, gate de v1 a medio cerrar)

Reemplaza la version "2026-09-02, despues de v2 puntos 1 y 2" de mas abajo
(dejada como registro historico). Resumen de estado, no narrativa — el
detalle de cada punto vive en la entrada de sesion inmediatamente debajo de
esta.

### Los 4 criterios de salida de v1: uno removido, uno en manos del usuario, uno con material listo, uno verde

Estado anterior (ver entrada "2026-09-01" mas abajo): ninguno de los 4
cumplido. Esta sesion, decisiones explicitas del usuario sobre los 4:

1. **20-30 partidas jugadas, terminadas y revisadas**: sigue sin hacer.
   Pedido explicito del usuario: "el item uno es responsabilidad mia" — no
   hay accion de codigo pendiente de este lado.
2. **Tiempo hasta la primera partida ganada, medido**: se habia construido
   en algun momento no documentado en este archivo (`learning/firstWin.ts`
   + `learning/firstOpen.ts`, con seccion propia en Perfil) sin que NOTAS
   se actualizara — descubierto recien esta sesion al buscar el string
   antes de tocar nada. Pedido explicito del usuario: "remuevanlo de la
   app". **Removido por completo**, no solo ocultado: los dos modulos
   (`git rm`, estaban commiteados), su test
   (`tests/learning/firstWin.test.ts`), el llamado a `recordFirstOpenIfNeeded()` en
   `App.tsx`, la seccion `.profile-first-win` en `ProfileScreen.tsx` +
   `App.css`, y las 3 claves `profile.firstWin.*` en `en.json`/`es.json`.
   Verificado sin referencias sueltas (`grep -rn "firstWin\|firstOpen" src
   tests` vacio) y `npx tsc -b` limpio. Este criterio queda formalmente
   fuera del gate de v1, decision explicita, no lo mismo que "pendiente".
3. **Revision de un jugador dan sobre lecciones 0-2 y 20 problemas del
   banco**: sigue sin hacerse (necesita una persona real, no es algo que
   se resuelva con codigo), pero el material para hacerla ya existe y
   genera limpio por primera vez: `tools/export-review-pdf.ts` (escrito en
   una sesion anterior, tampoco documentada aca, nunca ejecutado con
   exito hasta ahora) tenia un bug real -- `solveEntry()` no tenia rama
   para el tipo de problema `areaValue` nuevo de esta sesion, y caia en el
   fallback de doble atari leyendo campos que `AreaValueProblem` no tiene
   (`problem.color`, `problem.expectedPoints`), reventando con `Cannot
   read properties of undefined` apenas se corrio con contenido real.
   Arreglado con una rama explicita (usa `bestAreaMove` real, igual que la
   validacion en vivo -- nunca a mano) y con `renderProblemSection`
   manejando el caso legitimo de "la jugada correcta es pasar, sin
   coordenada que marcar". Corrida real: 48 problemas (3 por cada uno de
   los 16 conceptos con `generatesExercises`, ver punto siguiente) + 21
   lecciones de niveles 0-2, en
   `tools/output/revision-contenido-muestra.pdf`. El paquete ya cumple lo
   que el criterio pide (>=20 problemas, lecciones 0-2 completas); falta
   la revision en si.
4. **Cero problemas fallando el invariante del generador en CI**: sigue
   verde. `tests/content/problem-bank.test.ts` sigue pasando con el banco
   en 219 (142 + 35 nuevos de mistake-exercises + 42 de la corrida de humo
   de valor de area, confirmado en vivo en la pantalla de Ejercicios --
   "Todos: 219 problemas"), y va a seguir creciendo con la regeneracion
   completa de valor de area todavia en curso al escribir esto.

### Banco de problemas: 5 conceptos sin ejercicios nunca resueltos, +35
problemas reales; 2 conceptos con un tipo de ejercicio nuevo desde cero

De los 11 conceptos con detector de partida real (`hasDetector: true`), 7
tenian `generatesExercises: false` sin ningun problema en el banco --
brecha senalada por el usuario en una sesion anterior ("aside from my part
on this, whats the next step to close v1") y cerrada recien.

**5 conceptos via el pipeline de autojuego + solucionador ya existente**
(`tools/generate-mistake-exercises.ts`, nuevo, reutiliza el mismo patron
de `generate-problems.ts` sin importarlo, mismo criterio que
`generate-ladder-problems.ts`): en vez de buscar candidatos nuevos, extrae
patrones de las jugadas GANADORAS y PERDEDORAS que el solucionador ya
evalua al resolver cualquier tsumego (de este script o de
DOS_OJOS/CAPTURA_SIMPLE/PUNTO_VITAL). 64 partidas de autojuego, resultado:

| Concepto | problemas | como se extrae |
|---|---|---|
| ATARI_IGNORADO | 4 | candidato en atari real (1 libertad) resuelto como objetivo 'live' |
| AUTOATARI | 11 | jugada perdedora que deja al propio grupo con 1 libertad |
| RELLENO_OJO_PROPIO | 6 | jugada perdedora que cae en un ojo simple propio (`isSimpleEye`, la misma funcion del detector) |
| TRIANGULO_VACIO | 7 | jugada perdedora con la geometria exacta de Kageyama (2x2 menos una esquina) -- unico de los 5 que es heuristica de teoria de Go, no una prueba de vida-muerte; ver aviso mas abajo |
| CORTE_NO_DEFENDIDO | 7 | jugada GANADORA que conecta dos cadenas propias antes distintas |

**Aviso explicito sobre TRIANGULO_VACIO** (pedido por el usuario: "even if
you use heuristics... state it please"): la jugada en si esta
comprobada como perdedora por el solucionador (eso es una prueba real),
pero "triangulo vacio = mala forma" es juicio de teoria de Go (Kageyama,
*Lessons in the Fundamentals of Go*, cap. 8), no una propiedad que el
motor verifique de forma independiente como vida-muerte. Los otros 4 son
tan solidos como el resto del banco de tsumego.

**2 conceptos con un tipo de problema nuevo, `AreaValueProblem`**
(`RELLENO_TERRITORIO_PROPIO`, `PASE_PREMATURO`): ninguno de los dos encaja
en el `Problem`/`solve()` de tsumego (la pregunta es "jugar un punto o
pasar", no "vivir o matar"), asi que se construyo un tipo nuevo end-to-end
-- `solver/areaValue.ts` (reutiliza `bensonPassAlive`/area score reales,
nada a mano), `content/areaValueProblem.ts` (serializacion SGF, mismo
patron que `ladderProblem.ts`), `tools/generate-area-value-problems.ts`
(autojuego + clasificacion en las ultimas 12 posiciones de cada partida,
no en cualquier momento -- una jugada temprana casi siempre "mejora el
area" trivialmente), boton de pasar nuevo en `ExerciseView.tsx` +
`useSolvableExercise.ts` (validacion en vivo contra las mismas funciones
del detector real, sin guardar "la respuesta correcta" -- no puede
desincronizarse). Corrida de humo (6 partidas): 42 problemas (38 + 4).
**Corrida completa (64 partidas) todavia en progreso al escribir esto** --
la version final de `content/problems/area-value.json` va a tener mas que
estos 42; se deja una nota de seguimiento mas abajo en vez de esperar para
cerrar esta entrada.

**Bug real encontrado y corregido en el camino, fuera de lo pedido**:
ninguno de los 7 conceptos de arriba aparecia en la pantalla de Ejercicios
pese a tener banco nuevo, porque `analysis/concepts.ts::generatesExercises`
seguia en `false` para los 7 (flag estatica, no derivada del banco real).
`conceptsThatGenerateExercises()` -- la funcion que decide que tarjetas
mostrar en Ejercicios -- filtra por esa flag, asi que el contenido nuevo
era invisible en el flujo principal (solo llegable via Hoy/Lecciones).
Corregido con exactamente 7 cambios `false` -> `true` (confirmado con
`git diff` que los 4 conceptos genuinamente sin banco -- `CAPTURA_PERDIDA`,
`GRUPO_MURIO_SIN_OJOS`, `ESCALERA_FALLIDA`, `PRIMERA_LINEA_TEMPRANA` --
quedaron intactos). Efecto secundario bueno: `export-review-pdf.ts` (punto
3 del gate de v1, arriba) ahora muestrea los 16 conceptos en vez de 9 sin
tocar ese script -- `conceptsThatGenerateExercises()` es la misma funcion
en los dos lugares.

### Mecanismo de reapertura de lecciones (Item 5, mecanismo b)

Segunda mitad del "personalization loop" pedido ("both please" sobre las
dos partes del Item 5; la primera mitad, inyeccion de ejercicio de alta
prioridad al dia siguiente, ya estaba). Logica pura nueva en
`training-policy/session.ts::findConceptsToReopen(games)`: mira las
ultimas 5 partidas guardadas (no ejercicios) y, para cada concepto, cuenta
en cuantas de esas 5 aparecio con `result: 'incorrect'` -- 3 o mas
partidas (no ocurrencias: una partida con el mismo error repetido varias
veces cuenta 1 sola vez, ver mas abajo) dispara la reapertura. Con menos
de 5 partidas guardadas, el umbral de 3 igual aplica sobre las que haya
(la ventana es un techo, no un piso).

**Donde se evalua, y por que ahi y no en Hoy**: dentro del efecto de
guardado de partida ya existente en `PlayGameScreen.tsx` (mismo lugar que
ya guarda la partida una sola vez), no en cada carga de la pantalla Hoy.
Si se evaluara en Hoy, releer una leccion ya reabierta sin jugar ninguna
partida nueva la volveria a marcar como no leida de la nada (Hoy se
remonta cada vez que se vuelve a esa pestana). Evaluando solo al terminar
una partida nueva, "reabrir" es un evento real disparado por esa partida,
no un estado que se reafirma solo contra historia vieja sin cambios.

**Estado nuevo en `ui/lessons/readProgress.ts`**: ademas del set de
lectura ya existente, un mapa separado lessonId -> conceptId (localStorage,
`hoshi-lessons-reopened`) para que Hoy sepa *por que* reabrio cada leccion.
`markLessonRead()` (ya se llama al abrir cualquier leccion) ahora tambien
limpia esa entrada -- releer la leccion apaga el aviso, aunque la condicion
de las ultimas 5 partidas siga tecnicamente cumplida (no vuelve a
dispararse sola; hace falta una partida nueva).

**Aviso en Hoy + enlace directo a la leccion**: `TodayScreen.tsx` lee
`getReopenedLessons()` y muestra una tarjeta por leccion reabierta
(`.today-reopen-card`, mismo patron visual que la tarjeta de insight ya
existente). El boton "Repasar leccion" necesito un deep-link nuevo hasta
`LearnScreen` (`initialLessonId`, mismo patron ya establecido por
`initialConcept` en Ejercicios e `initialGameId` en Revisar) enhebrado por
`App.tsx` (`PendingNavigation.lessonId`).

**Test nuevo**: `tests/training-policy/session.test.ts` gana 5 casos
(umbral, ventana de 5, menos de 5 partidas guardadas, y un caso que
verifica explicitamente que 3 ocurrencias en UNA sola partida no alcanzan
-- con una asercion directa de que el fixture realmente produce 3
ocurrencias, no solo 1, para que el test no sea trivialmente cierto por
la razon equivocada). Reutiliza la secuencia de AUTOATARI ya verificada en
`tests/analysis/mistakes.test.ts` en vez de derivar geometria nueva.

**Verificado en vivo, no solo con tests**: partida real jugada por la UI
(pase-pase inmediato, para confirmar que el efecto de `PlayGameScreen.tsx`
corre sin errores) mas 4 partidas previas inyectadas directo por el motor
real (mismo patron de `import()` dinamico contra el dev server ya usado
para verificar Revisar). Resultado real: la posicion de AUTOATARI elegida
tambien disparaba `CORTE_NO_DEFENDIDO` de forma incidental (mismo tipo de
sorpresa que ya paso verificando Revisar esta sesion) -- las 2 tarjetas de
reapertura aparecieron en Hoy con el texto correcto, y el boton de cada
una llevo a la leccion correcta (`n0-l5` "Atari", `n3-l6` "Cortar y
conectar", esta ultima ademas mostrando ya un problema guiado real gracias
al arreglo de `generatesExercises` de mas arriba). Cero errores de
consola en todo el recorrido.

### Verificacion general de esta sesion

`npx tsc -b` limpio. `npx oxlint`: sin warnings nuevos en ningun archivo
tocado (confirmado comparando contra `git diff`, no solo mirando la lista
final). `npx vitest run`: 527/527 verdes en 35 archivos (partiendo de 533
de la sesion anterior, -11 por borrar `firstWin.test.ts`, +5 de
`findConceptsToReopen`). Playwright en vivo contra `npm run dev` en tres
pasadas separadas: el flujo de valor de area (Ejercicios, boton de pasar,
casos correcto/incorrecto para `PASE_PREMATURO`/`RELLENO_TERRITORIO_PROPIO`),
la pantalla Revisar (partida sintetica de 10 jugadas mostrando
13 eventos en 7 conceptos distintos), y el mecanismo de reapertura de
arriba. Cero errores de consola en las tres.

### Que sigue

1. La regeneracion completa de valor de area (64 partidas) sigue corriendo
   en background al cerrar esta entrada -- cuando termine,
   `content/problems/area-value.json` va a tener bastante mas que los 42
   actuales; confirmar que sigue resolviendo limpio y hacer un commit
   chico aparte (sin cambios de codigo, solo datos).
2. El gate de v1 (punto 3 de arriba) tiene material listo pero sigue sin
   ejecutarse: alguien con experiencia real de Go necesita revisar
   `tools/output/revision-contenido-muestra.pdf`.
3. El punto 1 del gate (20-30 partidas del usuario) sigue explicitamente
   en manos del usuario.
4. `PRIMERA_LINEA_TEMPRANA` sigue siendo el unico de los 11 conceptos con
   detector sin ningun camino de ejercicio viable identificado todavia
   (ni siquiera con apoyo del libro de Kageyama) -- sin accion planeada
   salvo que el usuario lo retome.

---

## Estado general del proyecto (2026-09-02, despues de v2 puntos 1 y 2)

Reemplaza la version "antes de v2" de mas abajo (dejada como registro
historico). Resumen de estado, no narrativa — el detalle de como se llego
a cada punto vive en las entradas de sesion, en orden cronologico, mas
arriba en este archivo.

### v1, v1.1, empaquetado Android, banco de problemas: sin cambios

Todo lo que decia la entrada "antes de v2" sigue igual: v1 y v1.1
cerrados, banco de problemas en 142 (68 autojuego + 32 escaleras + 32
doble atari, con etiqueta de dificultad), gate de v1 saltado sigue siendo
el mayor riesgo abierto del proyecto (nadie que sepa Go de verdad revisó
todavía ni una lección ni un problema del banco — mas urgente, no menos,
con el banco en 142). Ejercicios ya se dividio en dos pantallas
(commit `ba14ba5`), asi que ese pendiente especifico ya cerro.

### v2 — arrancado de verdad esta sesión, puntos 1 y 2 cerrados

El roadmap maestro (secciones 7, 8, 9, 12) marcaba v2 como "el próximo
hito grande, sin empezar todavía". Ya no: los primeros dos de los cinco
puntos pedidos estan hechos, verificados y commiteados.

**Punto 1 (refactor de tablero) — cerrado.** `BoardState.size` (un solo
numero) paso a `width`/`height` explicitos en todo el motor: tipos,
tablero, Zobrist, Benson, scoring, reglas, solucionador, SGF, motor MCTS,
y el canvas de UI (reescrito, no solo re-tipado). El hallazgo real: 4 de
las 8 transformaciones diedrales intercambian ancho y alto, solo validas
en tablero cuadrado — `applicableTransforms()` las filtra cuando no lo
es. Tres bugs reales encontrados (region del solucionador, heuristica de
borde de los estilos del bot, detector de "primera linea temprana"), los
tres agazapados porque hasta ahora todo el contenido real era cuadrado.
Migracion barata via `createBoard(width, height = width)`: decenas de
call sites cuadrados no necesitaron tocarse. Detalle completo, incluida
la verificacion (tests nuevos, regeneracion byte-identica de los
generadores, Playwright en vivo), en la entrada "v2 punto 1" mas arriba.

**Punto 2 (motor de evaluacion posicional) — cerrado, dos tracks.**
Comparacion de opciones investigada primero (el "~8MB KataGo" del roadmap
resulto ser una cita equivocada; los modelos reales de esa familia
pesan 75-293MB). Track 1: estimador de influencia por dilatacion/erosion
(tipo Bouzy, reconstruido de fuentes secundarias ya que el paper original
no quedo accesible — documentado como reconstruccion, verificado con un
script antes de confiar), cero dependencias nuevas. Track 2: red real de
KataGo (`g170 b10c128`, CC0) corriendo en un Web Worker via TensorFlow.js
(excepcion puntual y confirmada a la regla de cero dependencias nuevas),
con un codificador de entrada propio reconstruido de la fuente real de
KataGo (MIT) y restringido a la configuracion de reglas fija de Hoshi —
resulto mucho mas chico de lo que parecia al principio una vez que se
entendio que las ramas de reglas japonesas (que Hoshi nunca usa) eran la
parte complicada. Un bug real de superko encontrado y arreglado antes de
commitear. Ninguno de los dos tracks esta conectado a ninguna pantalla
todavia — eso es trabajo de los puntos 3 y 5. Detalle completo en las dos
entradas "v2 punto 2" mas arriba.

### v2 — punto 4 investigado; punto 1 arrancado (Nivel 4, 4 de 5 conceptos); puntos 3 y 5 sin empezar

- **Punto 1**: contenido real de los niveles 4-6. Nivel 4 (Forma, 9x13)
  arrancado esta sesion: 4 de 5 conceptos aprobados ya tienen leccion real
  y verificada (`content/lessons/n4.ts`) -- forma eficiente (dango vs
  keima repartido), el corte del keima, hane con corte hacia una escalera,
  y extension desde una pared (verificada con partidas simuladas completas
  del bot MCTS, no con el motor de evaluacion -- ver mas abajo por que).
  El quinto (direccion/lado grande) sigue sin verificar: ni el estimador de
  influencia, ni el valor de KataGo, ni partidas simuladas completas dieron
  todavia una diferencia real, reproducible y en el sentido correcto -- el
  primer intento de partidas simuladas incluso dio el resultado *invertido*
  de forma reproducible (ver detalle en la entrada "v2 punto 1 (Nivel 4
  Forma), parte 2" mas arriba). Niveles 5 y 6 (Apertura, Joseki) sin
  empezar. Generalizacion de tipos que esto necesito (`Lesson.level`,
  `LessonBlock.diagram`, `DemoScript`, ambos de `size` unico a
  `width`/`height`, `Concept.level`) ya esta hecha y cubre niveles 4-6
  completos, no solo el 4 -- no hace falta repetirla para Apertura/Joseki.
- **Punto 3**: contenido real de los niveles 4-6 (Forma/9x13, Apertura/
  13x13, Joseki/13x13), mismo patron de datos TypeScript + GuidedDemo que
  niveles 0-3, con la afirmacion de posicion/direccion pasando por
  evaluacion del motor (track 1 y/o 2) en vez de por el solucionador
  exhaustivo de tsumego (no aplica a este tipo de contenido).
- **Punto 4** — cerrado en su alcance pedido (investigar y reportar, sin
  tocar el banco). Resultado: track 2 (politica de KataGo, una sola pasada
  sin busqueda) NO ayuda a verificar ESCALERA/SNAPBACK/RED_GETA/DOBLE_ATARI
  (rank de la jugada correcta indistinguible de azar), algo de senal real
  en DOS_OJOS/NAKADE/PUNTO_VITAL/CAPTURA_SIMPLE (mas reconocimiento de forma
  que lectura), y una senal parcial de calibracion de dificultad solo en
  tsumego (el margen de la politica baja al subir la dificultad declarada,
  pero no de forma limpia). Track 1 no aplica (no tiene ranking de jugadas).
  Detalle completo en la entrada "v2 punto 4" mas arriba. El bug real de
  contenido encontrado como efecto secundario (4 problemas DOS_OJOS
  irresolubles en vivo por un desajuste de region) **ya se corrigio**, ver
  la entrada "v2 punto 4, correccion del bug DOS_OJOS" mas arriba.
- **Punto 5**: conectar todo a la interfaz real — niveles 4-6
  desbloqueados en Aprender, 13x13 en Jugar, mismo criterio de progreso
  que ya usan los niveles 0-3.

Explicitamente fuera de alcance de v2 (decision del roadmap, no olvido):
sparring adaptativo y estimacion de fuerza propia del jugador, ambos
diferidos a una decision aparte incluso ahora que el motor ya existe.

### Empaquetado Android

Ver la entrada de sesion correspondiente para la version exacta y el
detalle del build mas reciente.

---

## v2 punto 4, correccion del bug DOS_OJOS: los 4 problemas reemplazados, con red de seguridad nueva en CI (2026-09-02)

Retoma el bug encontrado como efecto secundario en la investigacion del
punto 4 (entrada de mas abajo), que en su momento se dejo sin tocar por
decision explicita del usuario ("postergarlo, seguir con el resto de v2
primero"). Pedido explicito de esta sesion: "corrijamos el bug DOS_OJOS
ahora".

### Confirmacion de la causa raiz

`tools/generate-problems.ts::tryBuildProblem` siempre acepta un problema
verificandolo con `computeRegion(..., 2)` (margen 2). `useSolvableExercise.ts`,
la pantalla real de Ejercicios/Hoy, resuelve en vivo con
`computeRegion(..., 1)` (margen 1, mas angosto). Para `p57`/`p65`/`p71`/`p73`
esa region mas angosta recortaba un punto real que el defensor necesitaba
para completar su segundo ojo, tratandolo como pared fija — el solucionador
en vivo declaraba el grupo muerto sin importar la jugada, dejando estos 4
problemas irresolubles hoy para cualquiera que los intentara en Ejercicios o
Hoy. Confirmado de nuevo con un script de un solo uso antes de tocar nada:
margin=1 da `solved: false` en los 4 (no solo "liveForDefender: false" —
directamente ninguna jugada del defensor, restringida a esa region chica,
alcanza el objetivo), margin=2 da `solved: true`.

### Por que no se ensancho el margen en vivo (opcion descartada, con prueba)

La primera opcion evaluada — subir el margen que usa `useSolvableExercise.ts`
de 1 a 2, para que coincida con el generador — se probo directamente en vez
de asumirla segura: re-resolver los 78 tsumego del banco con margin=2 hizo
crashear Node por falta de memoria, dos veces (heap por defecto, ~435s; heap
de 6GB, ~647s). Un script sin buffer de logs (`vite-node` con
`process.stdout.write`, no `vitest`, porque el crash de un worker de vitest
pierde todo el `console.log` en buffer) identifico el problema real: no es
ningun DOS_OJOS — es `p25`/`p26` (SNAPBACK), donde `p25` ya tardaba 384s y
54.5 millones de nodos antes de que `p26` reventara la memoria. Confirma un
riesgo que NOTAS ya habia documentado una vez (una region sin esquina ni
borde que la acote explota combinatoriamente) para un candidato de geta —
ahora confirmado tambien para snapback, a margen 2. Ensanchar el margen en
vivo para todos arreglaba los 4 DOS_OJOS pero arriesgaba colgar la app para
quien intentara un SNAPBACK real. Descartada.

### La correccion aplicada, quirurgica

1. **`tools/generate-problems.ts::tryBuildProblem`** gana un segundo chequeo
   permanente: despues de aceptar con margin=2 (como siempre), tambien
   vuelve a resolver con margin=1 (el mismo regimen que usa
   `useSolvableExercise.ts` en vivo) y descarta el candidato si eso no
   resuelve. Esto evita que esta clase de bug pueda volver a colarse en
   cualquier regeneracion futura del banco, sin tocar el margen compartido
   de la pantalla en vivo (que sigue protegiendo a los otros 74 problemas
   del riesgo de explosion de RED_GETA/SNAPBACK confirmado arriba).
2. **Reemplazo quirurgico de las 4 entradas rotas.** Un script temporal
   (mismo patron de autojuego + candidatos que ya usa el generador real,
   con el chequeo nuevo de margin=1 aplicado) busco reemplazos nuevos para
   `p57`/`p65`/`p71`/`p73`, preservando sus `id` y posicion en el array
   (para no alterar ninguna otra entrada ni desordenar el banco). Primer
   intento con una clave de dedupe por tablero completo genero 4
   "reemplazos" que resultaron ser, en la practica, la misma forma local
   capturada en instantaneas consecutivas de una sola partida de autojuego
   (mismo grupo, misma jugada `B[ci]`, solo cambiaban piedras lejanas sin
   relacion) — descubierto revisando el diff antes de darlo por bueno, no
   despues. Corregido usando la misma clave de dedupe que ya usa
   `tools/generate-problems.ts::main()` (posicion + color del grupo
   candidato, no el tablero completo), que si genero 4 formas realmente
   distintas: `p57` (grupo blanco de una piedra, esquina), `p65` (dos
   piedras blancas de borde), `p71` (cuatro piedras blancas), `p73` (tres
   piedras blancas con un arbol de refutacion real de profundidad 2).
   Dificultad recalculada con la misma formula de siempre
   (`difficultyFromDepth`): easy/easy/easy/medium.

### Verificado antes de dar por cerrado

- Los 4 reemplazos resuelven `solved: true` con margin=1 (el regimen real
  de Ejercicios/Hoy) — confirmado con un script de un solo uso antes de
  escribir el test permanente.
- **Barrido completo**: los 78 tsumego del banco (no solo los 4 tocados)
  resuelven con margin=1 sin ninguna falla — el problema estaba acotado a
  esos 4, no era mas amplio de lo que ya se sabia.
- **Test de regresion nuevo en CI**: `tests/content/problem-bank.test.ts`
  gana un segundo `it.each` (78 casos, uno por tsumego) que reproduce
  exactamente el regimen de `useSolvableExercise.ts` (margin=1), ademas
  del que ya existia a margin=2 (el del generador). Cualquier problema
  futuro con este mismo desajuste — generado por el pipeline o pegado a
  mano en `bank.json` — ahora lo detecta CI en cada push, no solo una
  investigacion manual ocasional.
- `npx tsc -b` limpio. `npx vitest run`: 419/419 verdes en 36 archivos
  (341 anteriores + 78 del test nuevo). `npx oxlint` sin warnings nuevos en
  ninguno de los archivos tocados (`tools/generate-problems.ts`,
  `tests/content/problem-bank.test.ts`, `src/content/problems/bank.json`).
  Scripts temporales de diagnostico borrados al terminar, mismo habito de
  siempre.
- **No se hizo** una pasada de Playwright en el navegador para esta
  correccion en particular: a diferencia del contenido de Nivel 4 (donde
  el riesgo real esta en el render/las demos interactivas), este es un bug
  puramente de contenido/solucionador sin ninguna superficie de UI nueva, y
  Ejercicios no tiene forma de saltar a un problema por id (elige al azar
  dentro del filtro de concepto) — verificar con el solucionador real, en
  el mismo regimen exacto que usa la pantalla en vivo, ya es la
  verificacion que importa aca.

### Que sigue

Con esto, el punto 4 de v2 queda completamente cerrado (investigacion +
correccion). Pendiente decidir con el usuario: seguir con Nivel 5
(Apertura, 13x13) o con el punto 3 (conectar Nivel 4 a la interfaz real).

---

## v2 punto 1 (Nivel 4, Forma): 3 de 5 conceptos, verificados; 2 sin verificar (2026-09-02)

Primer nivel de contenido de v2 (Forma, 9x13), un nivel a la vez segun lo
acordado con el usuario. Antes de escribir nada se propuso una lista de 5
conceptos (progresion estandar despues de tactica, aprovechando que
`influence.ts` ya se construyo explicitamente "para ensenar moyo/direccion/
grosor en niveles 4-6"), aprobada tal cual por el usuario: forma eficiente,
corte del keima, hane y riesgo de corte, extension desde una pared,
direccion (lado grande). Resultado real: los primeros 3 se escribieron y
verificaron; los otros 2 se investigaron a fondo y no se pudieron verificar
con el motor disponible -- reportado en vez de forzado, mismo principio que
ya aplico el punto 4.

### Generalizacion de tipos, previa y necesaria

`Lesson.level`, `LessonBlock.diagram` y `DemoScript` seguian con un solo
`size` (cuadrado), deliberadamente no tocado en el refactor de tablero del
punto 1 de v2 ("correcto hoy porque todo ese contenido es cuadrado" --
dejaba de serlo con Forma). Pasaron a `width`/`height` explicitos, igual
patron que `BoardState` ya tiene: `helpers.ts::board()` gano un cuarto
parametro `height = width` (todo call site cuadrado de n0-n3.ts sigue
compilando sin tocarse), y los ~35 usos de `size:` en n0.ts-n3.ts se
migraron mecanicamente a pares `width:`/`height:` (script de una sola
pasada, verificado contra `git diff` antes de aceptarlo). `Concept.level`
(analysis/concepts.ts) tambien paso de `0|1|2|3` a incluir `4|5|6` --
cubre los tres niveles de v2 de una vez, no hace falta repetir esto para
Apertura/Joseki. `ui/board/hoshiPoints.ts` gano el layout de puntos hoshi
de 9x13 (columnas 2/6 del 9x9, filas 3/9 del 13x13, mas tengen real --
convencion propia documentada como tal, un tablero rectangular no es un
goban fisico estandar). `LessonScreen.tsx`: el boton "partida de
comprobacion" usa `PlaySeed` (`ui/play/playConfig.ts`), que sigue siendo
`size: number` (cuadrado) a proposito -- eso es trabajo del punto 5, no de
este. Como una demo rectangular no puede armar un `PlaySeed` valido
todavia, el boton se oculta cuando `demo.width !== demo.height` en vez de
mandar a un tablero en blanco sin relacion con la leccion.

### Los 3 conceptos verificados

Cada afirmacion de posicion se probo primero con un script de depuracion
(`tests/content/_debug-n4.test.ts`, borrado al terminar, mismo habito que
el resto del proyecto) antes de escribirla en la leccion:

- **Forma eficiente**: cuatro piedras amontonadas ("dango", 2x2) contra las
  mismas cuatro piedras repartidas en una cadena de saltos de keima sin
  tocarse. Verificado con `getGroup` real (no a mano): 8 libertades contra
  16 -- exactamente el doble con la misma cantidad de piedras. Herramienta
  correcta aca: conteo de libertades exacto, no el motor de evaluacion (no
  hace falta aproximar algo que se puede contar).
- **Corte del keima**: dos piedras negras en relacion de keima tienen dos
  puntos reales intermedios donde blanco puede jugar. Alcance
  deliberadamente acotado a lo que se puede afirmar sin especular: se
  verifico que jugar ahi separa a las dos piedras negras en grupos
  distintos Y que la piedra de corte queda con 3 libertades (jugada segura,
  no un error de blanco) -- sin afirmar quien gana una pelea posterior, que
  dependeria del resto del tablero y no es una propiedad general del keima.
- **Hane y riesgo de corte**: hane, corte de blanco, y la primera jugada de
  una escalera real que atrapa la piedra de corte en la esquina. La
  geometria exacta (corredor con 2 libertades, perseguidor en las otras dos
  direcciones) se calco literalmente de la ya verificada en
  `tests/solver/ladder.test.ts` en vez de inventar una nueva a mano --
  intentos previos con geometria propia (atari hacia el lado equivocado)
  daban `escaped`, no `captured`, hasta corregir la direccion. Verificado
  con `solveLadder` real: `captured: true`.

### Primer intento (evaluacion estatica de una sola posicion): no alcanzo

Intento con track 1 (`estimateInfluence`/`classifyInfluence`): comparar el
territorio resultante de extender una pared a distintas distancias, y de
jugar del lado grande vs el chico. Resultado: **sin diferencia real** --
misma ganancia (+1 punto) sin importar la distancia de extension (1 a 6), y
la misma ganancia jugando del lado grande o del chico. Diagnostico con la
grilla cruda de valores (no solo el conteo clasificado): con 5 dilataciones
y 21 erosiones, dos paredes de 5 piedras completamente separadas por una
columna vacia de por medio ni siquiera se tocan -- toda la columna intermedia
queda en cero. El metodo (documentado el mismo dia que se construyo:
"pensada para ensenar moyo/direccion/grosor") resulta, en la practica,
mucho mas conservador de lo esperado a la escala de una pared de 4-5
piedras: sirve para clasificar que tan "reforzada" esta una piedra o grupo
ya puesto, no para proyectar territorio hacia espacio vacio lejano desde
una pared chica.

Segundo intento con track 2 (valor de KataGo, una sola pasada): en un
tablero casi vacio con solo la pared y una piedra rival lejana, el valor
queda saturado (P(gana blanco) ~0.99 en todos los casos) porque la red lee
la posicion como "partida recien empezada, blanco gana por comodidad" --
las diferencias entre distancias de extension existen pero son de tercer
decimal (0.9946 a 0.9959) y no monotonicas de forma limpia, demasiado
ruido para afirmar nada con la confianza que pide este proyecto.

**Conclusion de este primer intento, reportada en vez de forzada:**
ninguna evaluacion ESTATICA de una sola posicion (track 1 ni track 2) da
una diferencia demostrable a la escala chica de una leccion de nivel 4.
Reportado al usuario antes de seguir. Decision del usuario: no forzar una
regla practica sin verificar, probar en cambio con partidas simuladas
completas via el bot MCTS que ya existe (`engine/mcts.ts`) antes de
descartar los dos conceptos.

### Segunda pasada: partidas simuladas completas con el bot MCTS

`chooseMove` (usado para elegir una sola jugada) no sirve directo para
esto: su `winRate` es el del mejor hijo del arbol UCT, y con un tablero de
9x13 casi vacio (mas de 100 jugadas legales) cada candidato recibe
demasiado pocas visitas -- probado con 1000 y 3000 playouts, la mejor
jugada variaba de `winRate` 0.57 a 0.75 entre semillas distintas, ruido
puro. La funcion que realmente hacia falta era la que ya usa cada
simulacion interna de MCTS para jugar una partida completa hasta el final
(`simulatePlayout`), no expuesta hasta ahora -- se agrego un `export` (sin
cambiar su comportamiento) especificamente para poder promediar muchas
partidas completas de forma directa (Monte Carlo llano), no ruidoso como
leer un solo nodo del arbol: cada partida tarda ~11ms en un 9x13 (mucho
mas barato que el arbol UCT, que reconstruye y recorre nodos), asi que
promediar 400-2000 partidas por candidato sale en segundos.

**Extension desde una pared -- exito, verificada de verdad.** Pared de 4
piedras, rival blanco lejos, comparando extension a distancia 2, 3 y 4:
distancia 3 gano de forma consistente en dos bloques de semillas
independientes (winRate negro 0.605/0.655 contra 0.583/0.613 en distancia
2 y 0.588/0.595 en distancia 4; margen de puntaje promedio tambien mayor).
Reproducible, no ruido -- se agrego a `analysis/concepts.ts` y
`content/lessons/n4.ts` como `EXTENSION_DESDE_PARED` (n4-l4), con las
distancias 2 (corta) y 3 (balanceada) como los dos diagramas de
comparacion. La leccion no cita los numeros crudos de la simulacion (son
una estimacion de Monte Carlo con ruido propio, especifica de esta
posicion de ejemplo, no una constante universal) -- solo afirma
cualitativamente que la distancia balanceada salio mejor en partidas
simuladas completas, que es lo que de verdad se verifico.

**Direccion (lado grande) -- sigue sin verificarse, y con un hallazgo
que vale la pena registrar.** Primer diseño (moyo de 5 piedras abajo-
izquierda vs una piedra sola arriba-derecha, pared blanca en el medio):
el resultado **no fue reproducible entre bloques de semillas** (un bloque
favorecio el lado grande, el otro el lado chico). Segundo diseño, mas
marcado (pared solida de 7 piedras casi de borde a borde para cada color,
2000 partidas por candidato): esta vez SI fue reproducible entre los dos
bloques de semillas -- pero en el sentido **contrario** al esperado: reforzar
el lado "chico" salio consistentemente mejor que reforzar el lado
"grande" (margen promedio +3.35/+3.56 contra +0.52/+1.08). Interpretacion,
no descartada sin mirar: el lado "grande" en ese diseño ya estaba
practicamente asegurado por la pared completa que lo encierra (reforzarlo
es una jugada de bajo valor marginal, aunque el area en si sea grande),
mientras que la piedra sola del lado "chico" seguia genuinamente en
peligro en un espacio angosto -- exactamente el tipo de matiz (valor
marginal de la jugada, no tamano bruto del area) que hace que "jugar del
lado grande" sea mas dificil de ilustrar bien de lo que parece a primera
vista. `DIRECCION_LADO_GRANDE` sigue sin agregarse a `analysis/concepts.ts`
ni a `content/lessons/n4.ts`. Reportado al usuario en vez de seguir
iterando posiciones sin limite.

### Verificacion final

`npx tsc -b` limpio. `npx vitest run`: 341/341 verdes (36 archivos). Sin
warnings nuevos de `npx oxlint` (confirmado comparando explicitamente
contra los archivos tocados, todos los warnings existentes son de antes).
Playwright en vivo contra `npm run dev` (Nivel 4 desbloqueado solo de forma
temporal para poder navegar a el, revertido antes de terminar -- desbloquear
de verdad es el punto 5): las 4 lecciones se ven y funcionan bien --
`Forma eficiente` muestra los dos diagramas 9x13 con las libertades
correctas interpoladas (bug real encontrado y arreglado en el camino: las
traducciones usaban `{libs}` en vez de `{{libs}}`, el formato real que usa
`i18n/index.tsx`), `El corte del keima` acepta el click en cualquiera de
los dos puntos de corte, `Hane y el riesgo de corte` completa sus 3 pasos
(cabeceo, corte automatico de blanco, jugada de persecucion) mostrando el
feedback correcto en cada uno, `Extension desde una pared` muestra los dos
diagramas de comparacion (corta/balanceada) con la pared y la piedra rival
en las posiciones correctas. Cero errores de consola en todo el recorrido,
en las dos pasadas (antes y despues de agregar la leccion de extension).

---

## v2 punto 4: motor de evaluacion vs banco de 142 problemas -- investigado, sin tocar nada (2026-09-02)

Pedido explicito: investigar si el motor (track 1 y/o 2, ya utilizables desde
el punto 2) aporta algo real a (a) verificacion cruzada del banco -- ¿la
jugada correcta se ve natural o rara segun el motor? -- y (b) calibracion de
la etiqueta de dificultad actual (derivada solo de profundidad de lectura).
Reportar antes de tocar ninguna etiqueta o problema existente -- no se tocó
nada del banco en esta pasada.

### Metodologia

Script temporal (`tests/eval/_investigate-bank.test.ts`, corrido bajo vitest
por el mismo motivo que `tests/eval/model.test.ts`: tf.js necesita el entorno
jsdom de `vite.config.ts` para registrar un backend sin navegador real --
`vite-node` puro no sirve para esto, se probo y tira `WebGL is not
supported`/fallback silencioso poco confiable). Borrado al terminar, como los
demas scripts de depuracion de este proyecto (mismo patron que
`/tmp/depth-check.mjs` citado en `content/difficulty.ts`); el JSON crudo de
resultados (142 filas) quedo fuera del repo.

Para cada una de las 142 entradas (`listBankEntries()`): se determino la
"jugada correcta" con la misma logica que usa la app hoy, no con el arbol
SGF recortado (`problemToSgf` guarda como mucho 2 hijos por nodo, y para
problemas donde el atacante mueve primero esos 2 son arbitrarios, no
necesariamente los ganadores -- ver `content/problemSgf.ts::childrenToSgf`).
En su lugar:

- Tsumego (78): se volvio a correr `solve()` fresco con
  `computeRegion(board, targetPoints, 1)` y `maxDepth=8` -- exactamente los
  parametros que usa `useSolvableExercise.ts` en vivo hoy -- y se tomo
  `result.root.move`.
- Escalera (32): `solveLadder(...).moves[0]`.
- Doble atari (32): `problem.expectedPoints` (ya viene dado, sin ambiguedad).

Con eso se corrio `encodeInput` + `evaluatePosition` (track 2, una sola
pasada, sin busqueda ni rollouts -- la app no corre MCTS encima de estas
cabezas) sobre la posicion inicial de cada problema, y se comparo la
distribucion de politica (solo puntos legales, sin pase) contra la jugada
correcta: rank, probabilidad, y si el maximo de la politica (top1) coincide
con la jugada correcta. Track 1 (`analysis/influence.ts`) no se probo: no
tiene ningun concepto de "ranking de jugada candidata", solo inclinacion de
territorio por punto -- no es la herramienta para esta pregunta, reportado
en vez de forzarlo.

### Hallazgo principal: la politica cruda (sin busqueda) no ayuda en lo tactico

Tasa de acierto del top1 de la politica contra la jugada realmente correcta,
por concepto:

| Concepto | n | top1 correcto |
|---|---|---|
| NAKADE | 10 | 5/10 (50%) |
| CAPTURA_SIMPLE | 12 | 3/12 (25%) |
| PUNTO_VITAL | 14 | 3/14 (21%) |
| DOS_OJOS | 10 (de 14, 4 sin datos -- ver bug abajo) | 2/10 (20%) |
| DOBLE_ATARI | 32 | 1/32 (3%) |
| RED_GETA | 8 | 0/8 (0%) |
| OJO_FALSO | 4 | 0/4 (0%) |
| SNAPBACK | 16 | 0/16 (0%) |
| ESCALERA | 32 | 0/32 (0%) |

Mas revelador todavia: el **rank promedio de la jugada correcta como
porcentaje de las jugadas legales** ronda 0.46-0.62 en todos los conceptos
(0.5 = indistinguible de orden aleatorio). Para ESCALERA (0.548) y
DOBLE_ATARI (0.467) la politica cruda no tiene ninguna capacidad real de
distinguir la jugada correcta del resto. Tiene sentido con lo que se sabe de
redes de politica de KataGo en general: leen forma/patron de una sola pasada
razonablemente bien (por eso NAKADE/CAPTURA_SIMPLE/PUNTO_VITAL/DOS_OJOS
tienen algo de señal real, muy por encima de ESCALERA/SNAPBACK), pero
escaleras, snapbacks, geta y doble atari son exactamente los casos de libro
que necesitan lectura explicita (o busqueda tipo MCTS encima de la red, que
esta app no implementa) -- una sola pasada de la cabeza de politica no
alcanza, y no es un bug de la integracion, es una limitacion conocida y
esperable de usar la red "en crudo".

**Conclusion para el punto 4, parte (a):** track 2 sin busqueda no sirve
como verificacion cruzada generica del banco. Podria tener algun valor
acotado como segunda opinion barata solo para DOS_OJOS/NAKADE/PUNTO_VITAL/
CAPTURA_SIMPLE, pero incluso ahi el 20-50% de acierto es demasiado bajo para
usarlo como filtro automatico -- en el mejor caso, una pista con mucho ruido
para revision humana, no un sustituto de ella. No se recomienda invertir mas
tiempo en esta direccion sin agregar busqueda real (fuera de alcance de v2,
costo no trivial).

### Calibracion de dificultad: señal parcial, no limpia

Comparando el margen de la politica (probabilidad de la jugada top1 menos la
segunda, un proxy de "que tan obvia le parece la posicion a la red",
independiente de si esa jugada es la tacticamente correcta) contra la
etiqueta de dificultad ya existente, restringido a tsumego (los unicos donde
la etiqueta viene de profundidad de lectura real vs los otros dos tipos con
formulas mas simples):

| Dificultad | n | margen mediana |
|---|---|---|
| easy | 18 | 0.862 |
| medium | 18 | 0.817 |
| hard | 38 | 0.602 |

Hay una tendencia real (el margen baja al subir la dificultad declarada,
consistente con "una posicion mas dificil de leer tambien le resulta menos
obvia a la red"), pero no es monotonica de forma limpia contra la tasa de
acierto del top1 (easy 5/18, medium 2/18, hard 6/38 -- medium queda peor que
hard). Con esta muestra (n=18 en dos de los tres grupos) no alcanza para
proponer recalibrar nada. **Conclusion parte (b):** hay una señal real pero
debil y no lo bastante confiable todavia para tocar los umbrales de
`difficultyFromDepth` -- quedaria para revisitar si el banco crece mucho
mas o si se agrega busqueda real al motor.

### Bug real encontrado como efecto secundario, no tocado

Al recalcular la jugada correcta con los mismos parametros que usa
`useSolvableExercise.ts` en vivo (`computeRegion(board, targetPoints, 1)`,
no el `margin=2` que usa `tools/generate-problems.ts` para el autojuego),
**4 problemas DOS_OJOS del banco (`p57`, `p65`, `p71`, `p73`) no resuelven**:
`solve()` con la region de margen 1 da `liveForDefender: false` (el grupo
"muere" con el margen chico) cuando con el margen 2 original (con el que se
generaron y verificaron) da `liveForDefender: true`. Confirmado con un
segundo script de depuracion corriendo `solve()` en ambos regimenes sobre
los 4 (`tests/eval/_debug-margin.test.ts`, tambien borrado): la region de
margen 1 recorta un punto real que la linea de vida original necesitaba,
tratandolo como pared fija.

Esto es distinto de lo que ya se habia verificado antes (NOTAS, entrada de
seeds: "verificado contra `solve()` en los tres regimenes que el proyecto
realmente usa... los tres dan `solved: true`") -- esa verificacion cubrio
las posiciones semilla de `buildSeedProblems()`, no las generadas por
autojuego, que nunca se cruzaron contra el margen=1 real de
`useSolvableExercise.ts`. Consecuencia practica: estos 4 problemas
probablemente aparecen hoy como irresolubles para cualquiera que los
intente en Ejercicios/Hoy (el grupo se juzga muerto sin importar la jugada).
Bajo impacto inmediato (nadie mas que el usuario tiene datos de produccion
guardados, mismo comentario que ya hace la seccion 11.4 del roadmap), pero
es un bug de contenido real, no hipotetico.

**No corregido en esta pasada** (pedido explicito: reportar antes de tocar
el banco). Dos arreglos posibles quedan identificados para cuando se retome:
(1) ampliar el margen que usa `useSolvableExercise.ts` para estos casos
(riesgo: podria cambiar el comportamiento en vivo de otros problemas
tambien), o (2) regenerar estos 4 problemas especificos verificandolos ya
contra margin=1 antes de aceptarlos (mas quirurgico, no toca el mecanismo
compartido). Decision explicita del usuario: postergarlo, seguir con el
resto de v2 primero (bajo impacto inmediato, sin usuarios reales con
progreso guardado todavia).

---

## v2 punto 2, track 2: red de KataGo (b10c128) integrada de verdad (2026-09-02)

Segunda mitad del punto 2 de v2. A diferencia del track 1 (heuristica sin
dependencias), esto es una red neuronal real corriendo en el dispositivo.
Sesion larga, con dos correcciones de rumbo reales a mitad de camino —
documentadas aca tal como pasaron, no prolijas en retrospectiva.

### Primera correccion: los pesos no necesitaban Python

El punto de partida del roadmap (`kaya-go/katago-onnx`) ya se habia
descartado en la comparacion de motores (75-293MB, la red equivocada). La
alternativa (convertir `g170 b6c96` a mano) necesitaba Python + ONNX, que
no existe en este entorno. Antes de aceptar eso como bloqueo, se investigo
si habia pesos ya convertidos y descargables directo: si los hay.
`maksimKorzh/kata-model-js` tiene la red `g170 b10c128-s1141046784-
d204142634` ya convertida a TensorFlow.js por Yuji Ichikawa
(`y-ich/KataGo`), pesos + topologia listos para bajar sin ninguna
conversion local (`model.json` + 3 fragmentos `.bin`, ~11.4MB reales,
confirmado byte a byte contra el tamano declarado). Vendorizados en
`public/models/kata-b10c128/`, con `ATTRIBUTION.md` explicando la
procedencia: los pesos son CC0 (licencia de redes de KataGo), el codigo
JS de esos dos repos **no** se copio (ninguno declara licencia para su
codigo) — toda la logica de inferencia de este proyecto es propia.

Confirmado con un script de humo antes de construir nada mas: el modelo
carga y corre una pasada real (`model.executeAsync`, no `execute` — el
grafo tiene un nodo `Merge` dinamico) en ~1.25s en la maquina de
desarrollo (backend JS puro de Node, sin aceleracion; en un navegador real
tf.js usa WebGL, deberia ser mejor, pero eso sigue sin medirse en un
telefono real).

### Segunda correccion: el alcance real de las features de entrada

Primer intento de estimar la dificultad leyo la rama de reglas japonesas
(`encorePhase`) del codigo fuente real de KataGo (`cpp/neuralnet/
nninputs.cpp`, MIT) sin registrar que esa rama nunca se activa en Hoshi
(que solo tiene conteo de area chino). Eso llevo a sobreestimar el trabajo
como "varias semanas" y a proponerle al usuario abandonar el track. El
usuario, correctamente, pidio releer el alcance real en vez de aceptar la
primera estimacion.

Al releer con cuidado, con la configuracion de reglas fija de Hoshi
(conteo de area chino, superko posicional, sin suicidio, sin handicap con
sesgo, sin encore, sin boton), la mayoria de los 19 canales globales y
varios de los 22 espaciales de la version 7 de entrada de KataGo
colapsan a una constante fija en vez de logica condicional — no es un
feature recortado, es un feature que en esta app nunca varia. Lo que
realmente hacia falta construir:

- **Canales 0-5** (tablero, piedra propia/rival, libertades 1-3): trivial.
- **Canal 6** (puntos vetados por superko): se resuelve simulando cada
  jugada vacia contra el historial real de posiciones — Hoshi ya lo hace
  para validar jugadas (`core/rules.ts`), solo hacia falta exponerlo.
- **Canales 9-13 + globales 0-4** (ultimas 5 jugadas): el usuario tenia
  razon en que esto no era dificil — una partida real ya tiene la lista de
  jugadas a mano.
- **Canales 14-17** (escaleras activas en el tablero actual y en los dos
  anteriores): Hoshi ya tiene un solucionador de escaleras real
  (`solver/ladder.ts`); solo hacia falta recorrer los grupos de 1-2
  libertades del tablero y preguntarle al solucionador si estan
  atrapados.
- **Canales 18-19** (territorio bajo conteo de area): resulto ser,
  leyendo `Board::calculateArea` en el propio codigo de KataGo, *casi
  exactamente* el mismo calculo que ya hacia `core/scoring.ts
  ::computeAreaScore` (regiones vacias rodeadas por un solo color).
  Se extrajo `computeAreaOwnership` (dueño punto por punto, no solo el
  conteo agregado) de ese archivo, reutilizada por ambos.
- **Global 18** (onda de paridad tablero/komi): formula matematica pura,
  sin dependencia de reglas variables.
- Todo lo demas (canales 7,8,20,21 y globales 8,9,10,11,12,13,15,16,17):
  constante fija (0, o el valor correspondiente a la configuracion fija de
  Hoshi), documentado canal por canal en `src/eval/features.ts`.

### Un bug real encontrado por el mismo habito de verificar antes de confiar

Un script de depuracion contra casos ya conocidos de otros tests (la misma
posicion de ko de `tests/core/ko-superko.test.ts`, la misma escalera de
`tests/solver/ladder.test.ts`) encontro que el canal 6 (superko) nunca se
activaba. Causa: la primera version arrancaba un historial sintetico de
un solo hash (`gameStateFromBoard`) para simular las jugadas candidatas,
que nunca puede detectar un ko real (la posicion que se recrearia es
anterior a la actual, no la actual misma). Arreglo: `EvalPosition` pasa a
pedir el `GameState` real completo (con su `history: bigint[]` real) en
vez de reconstruir uno sintetico — el mismo patron que ya establecio el
canal de escaleras historicas (`priorBoards`, tableros de 1-2 jugadas
atras: si el motor de reglas no tiene "deshacer", se piden directo al
llamador en vez de intentar reconstruirlos).

### Verificado antes de confiar, no solo documentado

`tests/eval/features.test.ts` (10 tests) verifica cada grupo de canales
contra posiciones conocidas de otros tests del proyecto (no inventadas
para la ocasion): la piedra en atari, el ko real, la escalera activa
verificada por el solucionador, el territorio de `scoring.test.ts`,
ademas de un caso 9x13 confirmando que la codificacion generaliza al
tablero rectangular del punto 1.

`tests/eval/model.test.ts` (5 tests) es integracion real contra el modelo
vendorizado (no mockeado): carga los mismos archivos de
`public/models/kata-b10c128/` y corre inferencia de verdad. Verifica que
la politica y el valor son distribuciones de probabilidad validas (suman
1, todo en [0,1]) y que el ownership queda en [-1,1] -- y, el test mas
importante, que **el modelo distingue una posicion claramente ganada de
la misma posicion claramente perdida** (mismo tablero, evaluado una vez
desde la perspectiva de quien domina y otra desde la del que no):
`asWinner.value[0] > asLoser.value[0]`. Este test tambien confirma, de
forma empirica y no solo por convencion citada, que el canal 0 de la
cabeza de valor realmente corresponde a "gana" y no a "pierde" — si
estuviera al reves, el test habria fallado.

Lo que **no** se puede verificar sin una instalacion real de KataGo para
comparar: si un juicio posicional puntual de la red ("esta jugada es
mejor") es correcto segun teoria de Go real. Eso es una limitacion
inherente de integrar un modelo de caja negra, no algo que estos tests
puedan cerrar — coherente con por que este motor esta pensado como
filtro adicional barato (punto 4 del pedido de v2), no como reemplazo del
gate de contenido por un jugador real.

### Arquitectura

`src/eval/features.ts` (codificador, puro, sin dependencias de tf.js),
`src/eval/model.ts` (carga del modelo + `executeAsync` + softmax/tanh
manual, ya que el grafo exportado no incluye la activacion final),
`src/eval/worker.ts` + `src/eval/client.ts` (mismo patron que
`engine/worker.ts`/`client.ts`: un Worker, un mapa de promesas por
requestId). Cero conexion a ninguna pantalla todavia.

### Excepcion a la regla de cero dependencias nuevas

`@tensorflow/tfjs` (^4.22.0) se agrega como dependencia real de
`package.json` -- confirmado explicitamente con el usuario como excepcion
puntual, no como cambio de la regla general del proyecto: no hay forma de
correr inferencia de una red convolucional real en el navegador sin
alguna libreria de este tipo.

### Empaquetado

`vite.config.ts`: `workbox.maximumFileSizeToCacheInBytes` subido a 12MB
(el default de Workbox es 2MB, los fragmentos de pesos son de ~4MB cada
uno) y `models/**/*` agregado a `includeAssets` para que el service
worker los precachee aunque todavia ninguna pantalla los importe
(confirmado leyendo el manifest de precache generado: los 6 archivos
aparecen con su hash de revision real). Para el empaquetado Android esto
no cambia nada -- Flutter ya sirve `dist/` completo como asset local
(seccion 4.2 de este archivo), sin depender del precache del service
worker.

### Todavia pendiente, con riesgo abierto explicito

No medido en este entorno (sin Python, sin telefono conectado por adb):
latencia real dentro de la WebView de Flutter en un telefono de gama
media. La unica medicion real es ~1.25s en Node sobre la maquina de
desarrollo, backend JS puro sin aceleracion -- un limite superior
conservador, no una medicion representativa del dispositivo real.

Sin conectar a ninguna pantalla. Eso, mas la investigacion del punto 4
(si el motor aporta a la verificacion cruzada del banco y a la
calibracion de dificultad), queda para la proxima pasada.

## v2 punto 2, track 1: estimador de influencia (Bouzy, reconstruido) (2026-09-02)

Primera mitad del punto 2 de v2 (motor de evaluacion posicional). El plan
de dos tracks (investigado en paralelo al refactor de tablero, ver mensaje
al usuario) proponia: track 1 = estimador heuristico barato y sin
dependencias, track 2 = red neuronal pequena de KataGo. Este es el track
1, construido y verificado.

### El PDF original de Bouzy no quedo accesible: reconstruccion, no cita textual

`go-trainer-roadmap-maestro.md` no menciona Bouzy — la sugerencia de
"Bouzy 5/21" salio de la investigacion del track 2 (comparacion de
motores). El paper original (Bouzy, "Mathematical Morphology Applied to
Computer Go", IJPRAI 17(2), 2003) no esta accesible en ningun mirror
encontrado (citeseerx, slideplayer, sensei's library — todos fallaron o
dieron 403/404). GNU Go usa un algoritmo distinto y mas sofisticado
(propagacion de influencia con permeabilidad, no dilatacion/erosion
simple); `online-go/score-estimator` es MIT pero es un motor mucho mas
grande (deteccion de seki, rollouts Monte Carlo) que no es portable en
poco tiempo.

Decision explicita del usuario ante esto: invertir el tiempo en encontrar
la formula real en vez de inventar una propia y llamarla "Bouzy" sin
poder verificarla. Se encontro, cruzando tres descripciones secundarias
independientes de motores de busqueda que convergen en la misma
definicion:

- Dilatacion Dz(p): si el vecindario de `p` no toca ningun valor de signo
  contrario, `p` crece en la cantidad de vecinos del mismo signo. Si toca
  un vecino de signo contrario, no crece — el crecimiento se frena justo
  en el limite de contacto entre zonas.
- Erosion Ez(p): el valor se encoge hacia cero en la cantidad de vecinos
  que no refuerzan su signo.
- 5 dilataciones / 21 erosiones (formula citada: 1+n(n-1) erosiones para
  n dilataciones).

Documentado en el codigo explicitamente como reconstruccion a partir de
descripciones secundarias, no como transcripcion literal del paper.

### Verificado antes de confiar en el resultado, no solo citado

Antes de escribir los tests formales, se corrio un script de depuracion
imprimiendo la grilla completa de influencia para casos conocidos:

- Una piedra negra aislada en el centro de un 9x9: termina con **cero**
  puntos de territorio real mas alla de si misma (los vecinos que
  brevemente ganaron valor durante la dilatacion se erosionan
  completamente de vuelta a 0) — confirma la propiedad central que el
  metodo promete.
- Una pared solida de 9 piedras conectadas: retiene influencia real (112
  a 117) en las 9, a diferencia de la piedra aislada.
- Tablero dividido a la mitad (negro vs blanco, columna central vacia):
  la columna central termina exactamente en 0 (neutral), cada lado
  inclina hacia su propio color sin cruzar.
- Negar todas las piedras niega el resultado exacto (simetria perfecta
  entre colores).

Las cuatro propiedades se confirmaron primero con el script antes de
escribirlas como aserciones — no se asumio que la reconstruccion se
comportaba como promete solo por la cita. `src/analysis/influence.ts` +
`tests/analysis/influence.test.ts` (6 tests, incluye un caso 9x13 para
confirmar que generaliza al tablero rectangular del punto 1).

### Alcance

`estimateInfluence(board)` devuelve un valor de influencia con signo por
punto; `classifyInfluence(map)` lo reduce a negro/blanco/neutral. No
afirma territorio final bajo reglas reales (eso lo sigue haciendo
`computeAreaScore`) — es una estimacion de hacia donde "inclina" cada
punto, pensada para ensenar moyo/direccion/grosor en los niveles 4-6.
Cero dependencias nuevas, sub-milisegundo por posicion, no necesita Web
Worker. Todavia no esta conectado a ninguna pantalla — eso es contenido/UI
de los puntos 3 y 5, no de esta pasada.

### Verificacion

`npx tsc -b` limpio, `npx vitest run` 325/325 verdes (34 archivos, 6
nuevos), sin warnings de oxlint en los archivos nuevos.

## v2 punto 1: BoardState pasa a width/height (2026-09-02)

Primer punto de v2 (roadmap maestro, secciones 7-9-12: niveles 4-6,
motor de evaluacion). Por pedido explicito del usuario, antes de tocar
codigo se presento el plan completo (firma de tipos, archivos afectados,
estrategia de migracion de tests) y se espero confirmacion — este es el
resultado ya implementado y verificado de ese plan.

### Por que ahora

`go-trainer-roadmap-maestro.md` seccion 8 ya lo marcaba como deuda
tecnica pendiente "antes de v2"; la entrada de v1.5 (2026-09-01) en este
mismo archivo confirmaba que casi todo el nucleo ya generalizaba por
tamano (Zobrist, Benson, scoring, solucionador, verificado con tests a
13 y 19) salvo que `BoardState.size` seguia siendo un solo numero, "sin
ningun consumidor real de esa generalizacion todavia". El Nivel 4
(Forma, 9x13 — el unico tamano no cuadrado de todo el curriculo) es ese
consumidor. Se verifico contra el codigo actual antes de asumir que
seguia igual (no habia ningun cambio no documentado).

### El hallazgo real: BOARD_TRANSFORMS no es 8-para-8 en un rectangulo

Las 8 transformaciones diedrales (identidad, 3 rotaciones, 4 espejos)
son la simetria de un tablero *cuadrado*. En un rectangulo ancho×alto
con ancho≠alto, las dos rotaciones de 90 grados y las dos transposiciones
diagonales (4 de las 8) intercambian ancho y alto: aplicadas a un 9x13
producen un 13x9, una forma distinta, no la misma forma con contenido
transformado. Las otras 4 (identidad, 180 grados, espejo horizontal,
espejo vertical) preservan la forma siempre.

`BoardTransform` paso de ser una funcion suelta a `{ apply, swapsAxes }`,
y `applicableTransforms(width, height)` devuelve las 8 en un tablero
cuadrado, solo las 4 que preservan forma si no lo es. `transformBoard`
calcula el ancho/alto de salida a partir de `swapsAxes` en vez de asumir
que coincide con el de entrada. El unico consumidor real de esto hoy
(`content/seeds.ts::buildSeedProblems`, que multiplica cada plantilla
verificada por las 8 transformaciones) ya usa `applicableTransforms` en
vez de la lista fija — listo para cuando haya una plantilla 9x13 sin
tener que volver a tocarlo.

### Decision para acotar el costo real de la migracion

`createBoard(width, height = width)`: todo call site que ya creaba un
tablero cuadrado (decenas, entre contenido de lecciones, seeds y tests)
sigue compilando sin cambios y sigue produciendo un tablero cuadrado.
Solo contenido genuinamente rectangular necesita pasar los dos
argumentos. Gracias a esto, la migracion de ~39 call sites de test que
llamaban `createBoard(N)` no toco ninguno de ellos.

`toXY`/`toPoint` solo necesitaban `width` (son aritmetica de indice por
fila), asi que se renombraron sin agregar parametro. `neighbors`/
`diagonals`/`inBounds` si necesitaban ambos (bordes reales de cada eje),
asi que ganaron `height` como parametro nuevo — cambio mecanico pero
real en cada call site (`core/groups.ts`, `benson.ts`, `scoring.ts`,
`rules.ts`, `engine/playoutPolicy.ts`, `botStyles.ts`,
`solver/doubleAtari.ts`, `analysis/mistakes.ts`). El cache de vecinos y
la tabla de Zobrist (`core/zobrist.ts`) pasaron de clave `size` (numero
suelto) a clave compuesta `` `${width}x${height}` ``, para que un futuro
13x9 no choque con un 9x13.

Contenido de lecciones (`content/lessons/types.ts`, `n0-n3.ts`,
`seeds.ts`) y las previsualizaciones cuadradas de UI (Ajustes,
Ejercicios, tarjeta de leccion actual) deliberadamente **no** se
tocaron: siguen usando un solo `size`, correcto hoy porque todo ese
contenido es cuadrado. `BoardCanvas` recibe `width`/`height` en vez de
`size` (con `height = width` por defecto), asi que estos sitios pasan
el mismo `size` dos veces en vez de necesitar su propio tipo nuevo.

### Bugs reales encontrados, no solo renombrados

Tres lugares reusaban una sola variable `size` para el limite de ambos
ejes, correcto solo por coincidencia mientras todo el contenido era
cuadrado:

- `solver/region.ts::computeRegion` — recortaba ambos ejes al mismo
  limite (el recorte del solucionador para problemas locales).
- `engine/botStyles.ts::distanceToEdge` — la heuristica de peso de los
  estilos "Territorial"/"Influencia" median mal la distancia al borde
  en el eje Y de un tablero no cuadrado.
- `analysis/mistakes.ts::detectPrimeraLineaTemprana` — el detector de
  "primera linea temprana" perdonaria en silencio una jugada en la
  ultima fila real de un tablero no cuadrado.

Ninguno de los tres se manifestaba hoy (todo el contenido real es
cuadrado), pero los tres quedaban listos para fallar en silencio apenas
existiera contenido rectangular real. Arreglados junto con el resto.

### SGF gana soporte real de tablero rectangular

El spec FF4 permite `SZ[ancho:alto]` para tablero no cuadrado; el codigo
solo escribia/leia `SZ[N]`. Peor: `Number("9:13")` da `NaN` en silencio,
lo que habria corrompido cualquier `sgfToPoint` posterior sin ningun
error visible. `core/sgf.ts` gana `formatSize`/`parseSize` compartidos,
usados tambien por los tres archivos que antes duplicaban esta logica
cada uno por su cuenta (`content/problemSgf.ts`, `doubleAtariProblem.ts`,
`ladderProblem.ts`).

### BoardCanvas: reescritura real, no solo re-tipado

El canvas se forzaba cuadrado a partir de un solo `displaySize`. Ahora
la celda (cuadrada, para que las piedras no salgan ovaladas) se deriva
del ancho disponible, y el alto del canvas sigue a esa celda aplicada al
numero de filas en vez de asumir tablero cuadrado — un 9x13 queda mas
alto que ancho, no estirado. Los ocho llamadores (`GuidedDemo`,
`ExerciseView`, `LearnScreen`, `LessonScreen`, `SettingsScreen`,
`TodayScreen`, `ReviewScreen`, `PlayGameScreen`,
`ExercisesConceptScreen`) se actualizaron en el mismo cambio.

`ui/board/hoshiPoints.ts` gana firma `width`/`height`; devuelve `[]`
para cualquier tablero no cuadrado por ahora (antes tampoco tenia layout
para 9x13). El layout real de puntos hoshi para 9x13 es una decision de
contenido (que convencion real usar), no algo a inventar en este
refactor — queda para cuando se autoren las lecciones del Nivel 4.

### Deliberadamente NO tocado en esta pasada

`storage/db.ts::SavedGameRecord.size` y `ui/play/playConfig.ts`
(`PlayConfig`/`PlaySeed`/`LastPlayConfig`) siguen con un solo `size`.
No es un olvido: Jugar todavia no ofrece ningun tamano no cuadrado (el
selector solo tiene 5x5/7x7/9x9 mas 13x13/19x19 bloqueados), asi que
toda partida real guardada hoy es cuadrada de verdad. Agregarles
width/height es trabajo del punto 5 (conectar Forma/Apertura/Joseki a
la interfaz real), cuando Jugar efectivamente ofrezca 9x13. `Ejercicios`
no se toco, sin relacion con este pedido.

### Verificacion

`npx tsc -b` limpio. `npx vitest run`: fallaron 32 tests en 11 archivos
en la primera pasada — no por logica rota, sino porque `tests/` no esta
cubierto por `tsc -b` (solo `src/`), asi que varios tests construian
`BoardState` a mano como `{ size, stones }` (forma vieja) y fallaban en
silencio en tiempo de ejecucion en vez de en tiempo de compilacion.
Corregidos uno por uno contra el error real (`board.size` → `board.width`
en helpers `place()`, `createGame(size, komi)` → `createGame(size, size,
komi)`, `gameRecordToSgf`/`transformPoint` con el argumento nuevo). Se
aprovecho para agregar cobertura nueva de tablero rectangular en
`tests/core/board.test.ts` (`applicableTransforms`, biyeccion de las 4
transformaciones validas en 9x13, intercambio de ancho/alto en
`transformBoard` para una transformacion que si cruza ejes). Resultado
final: 319/319 verdes en 33 archivos (313 + 6 nuevos), sin warnings
nuevos de oxlint.

Regresion adicional: se regeneraron `tools/generate-ladder-problems.ts`
y `generate-double-atari-problems.ts` (los dos generadores rapidos, sin
esperar el autojuego largo) y se comparo byte a byte contra el JSON ya
commiteado — salida identica, confirmando que el refactor no cambio
ningun comportamiento real en tableros cuadrados.

Verificacion visual en vivo con Playwright contra `npm run dev`:
Aprender (nivel 4 Forma se ve "9x13 · Bloqueado", exactamente como pide
la especificacion de pantallas; demo interactivo de 5x5 en una leccion
real), Jugar (tablero 9x9, hoshi points correctos, clic real en una
interseccion coloca la piedra en el punto correcto), Ejercicios
(problema real de Dos ojos en 9x9). Cero errores de consola en todo el
recorrido.

### Que sigue

Puntos 2 a 5 del pedido de v2 siguen pendientes: comparacion del motor
de evaluacion posicional (investigado en paralelo, ver mensaje al
usuario — recomendacion entregada, integracion todavia no empezada),
contenido de niveles 4-6, investigacion de si el motor aporta a la
verificacion cruzada del banco y a la calibracion de dificultad, y
conectar todo a la interfaz real (desbloqueo de niveles, 13x13 en
Jugar).

## Banco de problemas: de 120 a 142, con etiqueta de dificultad (2026-09-02)

Cierra el pedido "añadir más ejercicios, incrementando dificultad", con las
opciones 1 (más variedad dentro de la generación segura ya existente, más
dificultad derivada de la profundidad de lectura, sin cambio de UI) y 3
(formas tácticas nuevas y genuinamente más difíciles para ESCALERA, con el
riesgo de fallo aceptado explícitamente) de la pregunta que se hizo antes de
empezar.

### Números, antes → después

| Fuente | Antes | Después |
|---|---|---|
| Autojuego (tsumego) | 68 | 78 |
| Escaleras | 28 | 32 |
| Doble atari | 24 | 32 |
| **Total** | **120** | **142** |

Por concepto (autojuego): `DOS_OJOS` 10→14, `PUNTO_VITAL` 13→14,
`CAPTURA_SIMPLE` 7→12, `NAKADE` y `OJO_FALSO` sin cambio (10 y 4). El
crecimiento de autojuego vino de subir `SELF_PLAY_GAMES` de 32 a 48 en
`tools/generate-problems.ts`, no de plantillas nuevas — más partidas, más
posiciones candidatas por concepto.

`RED_GETA` y `SNAPBACK` **sin cambio** (8 y 16) — ver más abajo por qué,
reportado explícito en vez de forzado.

### Etiqueta de dificultad (`src/content/difficulty.ts`)

`Difficulty = 'easy' | 'medium' | 'hard'`, calculada una sola vez al generar
contenido (no en el cliente), agregada como campo obligatorio de `BankEntry`.
Para tsumego, deriva de `solutionDepth()` (recorrido recursivo del árbol de
refutaciones del solucionador, ya existía disperso en `tools/generate-
problems.ts`, ahora centralizado en este módulo nuevo): ≤1 jugada = fácil,
2-4 = media, ≥5 = difícil, umbrales calibrados contra la distribución real
observada en el banco de 120, no elegidos a ojo. Para escaleras, la
profundidad es `simulateLadder(...).chaserMoves.length`. Para doble atari no
hay árbol que recorrer (`isDoubleAtariMove` es reconocimiento de una sola
jugada, sin búsqueda) — dificultad `'easy'` fija por construcción, no un caso
degenerado del mismo cálculo.

Distribución resultante: autojuego `{easy: 18, medium: 19, hard: 41}`,
escaleras `{medium: 28, hard: 4}`, doble atari `{easy: 32}` (los 32, por
construcción). No expuesta como filtro en Ejercicios todavía — decisión
explícita (opción 1, no 2, de la pregunta previa), queda como dato para más
adelante, no como trabajo pendiente por olvido.

### ESCALERA: el hallazgo real de esta sesión

Primer intento (trasladar la plantilla mínima de 2 piedras a distancia 3 y 5
de la esquina, asumiendo que una escalera diagonal real "simplemente
funciona" más lejos de la esquina) **falló las dos veces**: `solveLadder`
devolvía `{captured: false, reason: 'escaped'}` a los 2 plies. Verificado con
un script de depuración antes de descartar el enfoque, no a mano.

Causa raíz: `ESCAPE_LIBERTY_THRESHOLD = 3` en `solver/ladder.ts` declara al
grupo que corre como escapado apenas llega a 3 libertades, revisado *antes*
de considerar la siguiente respuesta del perseguidor. Una piedra recién
extendida en tablero abierto siempre gana exactamente 3 libertades frescas
(un vecino es la piedra previa propia, los otros 3 están vacíos), salvo que
algo le bloquee una de antemano — cerca de la esquina, el borde del tablero
da ese bloqueo gratis (un punto de esquina/borde tiene menos de 4 vecinos
para empezar); en medio del tablero no hay nada que lo bloquee.

Arreglo: `template6()` en `tools/generate-ladder-problems.ts` agrega dos
piedras auxiliares en (2,4) y (4,2) — las libertades "laterales" que la
primera extensión abriría — además del pinzamiento original en (3,3)/(4,3)/
(3,4). Verificado con el mismo script: captura en 6 jugadas del perseguidor
(el máximo anterior era 4). Un segundo template a distancia 5 quedó
descartado tras el éxito de este: la simetría diedral (8 orientaciones) ya
da suficiente variedad de una sola plantilla que funciona, no hacía falta
forzar una segunda.

### DOBLE_ATARI: plantilla de contacto más cargada

`template6()` en `tools/generate-double-atari-problems.ts` — patrón de
contacto en (4,4)/(3,4)/(4,3)/(6,4)/(7,4)/(6,3) más 3 piedras aisladas de
relleno en (1,1)/(7,1)/(1,7), para que la jugada correcta no sea obvia por
ser la única piedra blanca del tablero. Sigue siendo dificultad fácil por
construcción (una sola jugada), el objetivo era variedad visual y de
lectura, no profundidad.

### RED_GETA / SNAPBACK: intento y abandono honesto

Se construyó un candidato de geta en medio del tablero (piedras blancas en
(4,4)/(5,5), pinza y red de negro alrededor) y se corrió `solve()` con
`computeRegion(..., margin=2)` y `maxDepth=6`. **Timeout a los 30s, sin
resultado.** Coincide con el riesgo ya documentado: una región sin esquina
ni borde que la acote explota combinatoriamente (la misma razón por la que
geta/snapback ya generaban con `maxDepth` reducido a 4-5 en vez de 8).

Decisión explícita, no fallo silencioso: no se reintentó con región más chica
ni timeout más largo. Se abandonó la variante más difícil de RED_GETA/
SNAPBACK en esta pasada — el riesgo de producir contenido de Go sutilmente
incorrecto (la lección de `OJO_FALSO`) pesa más que tener una variante extra.
Reportado así al usuario en el momento, no descubierto después.

### Verificación

`npx tsc -b` limpio, `npx vitest run` 313/313 verdes en 33 archivos, `npx
oxlint` sin warnings nuevos (los existentes son de antes, ninguno toca los
archivos de esta sesión), paridad de claves i18n intacta (no se tocó, se
confirmó igual). Playwright contra `npm run dev`: Ejercicios → "Todos" marca
142 problemas, ciclo de "Siguiente ejercicio" renderiza formas nuevas sin
errores de consola.

## Ejercicios: dividido en dos pantallas (2026-09-02)

Cerraba el pendiente que la entrada "Estado general del proyecto
(2026-09-02)" dejaba marcado como "pendiente de decisión explícita del
usuario, no como olvido" — decisión ya tomada, implementado.

Verificación primero (a pedido explícito, para no asumir contra las notas):
`git log --oneline -- src/ui/exercises/` confirmó que ninguna sesión no
documentada había tocado esto — el último commit ahí (`cb68581`, de esta
misma sesión) solo agregó la explicación "por qué funciona" a
`ExerciseView.tsx`, compartido con Hoy. De paso, una corrección de detalle
sobre esa misma entrada: el deep-link "practicar este concepto" **no** llega
desde Hoy (Hoy corre su propia sesión embebida con `useSolvableExercise`
directo en `TodayScreen.tsx`, nunca navega a Ejercicios) — solo desde
Aprender (`LessonPractice`, "Practicar más en Ejercicios") y Revisar
(`ReviewScreen`, "practicar este concepto").

Mismo patrón que ya usan Aprender/Jugar/Revisar: `ExercisesScreen.tsx` pasa
a ser un router chico (`{ kind: 'concept' } | { kind: 'practice';
conceptFilter }`) entre dos componentes nuevos — `ExercisesConceptScreen.tsx`
(la grilla de conceptos, sin ninguna lógica de resolución) y
`ExercisePracticeScreen.tsx` (tablero + validación, con toda la
orquestación de estado que antes vivía en el archivo único: `entry`/
`loaded`, ciclo de vida del `SolverClient`, `pickEntry`/`handleNext`). El
deep-link no cambió de mecanismo, solo de dónde se resuelve: `initialConcept`
sigue siendo la única prop pública de `ExercisesScreen`, y el `useState<View>`
inicializador decide si montar directo en `{ kind: 'practice', conceptFilter:
initialConcept }` (saltando la grilla) o en `{ kind: 'concept' }` — mismo
mecanismo que `PlayScreen.initialSeed`/`ReviewScreen.initialGameId`. Cero
cambios en `App.tsx` ni en los dos llamadores reales (Aprender, Revisar).

Verificado con Playwright contra `npm run dev`: entrar por el nav cae en la
grilla, elegir un concepto cae en la práctica, "volver a conceptos" vuelve a
la grilla, y el deep-link desde Aprender ("Practicar más en Ejercicios" en
la lección de captura simple) salta directo a la práctica sin pasar por la
grilla — el de Revisar se verificó por código (mismo mecanismo exacto, sin
poder generarlo en vivo sin datos de partidas guardadas en una sesión de
navegador nueva). Cero errores de consola.

## Rediseño de Jugar y Hoy, heurísticas reales del bot, y banco a 120 problemas (2026-09-02)

Sesión larga, todavía sin commitear al cerrarla (queda para confirmar con el
usuario). Cubre el bloque 6 de `go-trainer-flujo-pantallas.md` ("Bloque para
pegar en Claude Code") más pedidos explícitos del usuario que lo extienden.

### Jugar: de una pantalla a dos (config → partida)

Mismo patrón de dos pantallas que ya usaba Aprender (niveles → lista →
lección): `PlayConfigScreen` (formulario) y `PlayGameScreen` (tablero, nada
editable) son vistas separadas, con `PlayScreen` como router chico entre
ambas (reemplaza `GameControls.tsx`, borrado). Tres piezas que el documento
daba por existentes pero no estaban en el código:

- **Deshacer real**, incluida la respuesta del bot: `PlayGameScreen` guarda
  `history: GameState[]` en vez de un solo `GameState`: deshacer saca 2
  jugadas si la última fue del bot, 1 si fue de la persona.
- **Contar en vivo**: toggle "Contar" durante la partida (no solo al
  final), reutilizando `computeAreaScore` sobre el tablero actual.
- **Confirmación en pantalla antes de abandonar una partida sin terminar**,
  no un `confirm()` nativo: cubre tanto "Salir" dentro de Jugar como
  cualquier cambio de pestaña del nav inferior mientras hay una partida
  activa. `App.tsx` ahora enruta toda navegación entre pestañas por
  `attemptNav`/`applyNav`, que intercepta con `ConfirmDialog` si
  `screen === 'play' && playGameActive`.

A propósito, **no** se agregó un selector de "tiempo de respuesta del bot"
separado del kyu — se mantiene `strengthLevels.ts` con su `maxTimeMs` fijo
por nivel, tal como pidió el usuario explícitamente.

Un gap que yo mismo introduje y corregí en la misma pasada: `PlayConfigScreen`
no mostraba 13x13/19x19 bloqueados como sí hace Aprender con sus niveles
4-10 (`go-trainer-flujo-pantallas.md`, sección 3.1, lo exige explícitamente).
Agregado `LOCKED_BOARD_SIZES` con el mismo `LockIcon` que ya usa Aprender.

### Heurísticas reales del bot, no jugada casi aleatoria

Pedido explícito: "que el bot use distintas heurísticas de Go, para que sea
una app buena, no jugar random". Encima de los estilos ya existentes
(`botStyles.ts`: territorial/influencia/combativo), `playoutPolicy.ts` y
`mcts.ts` ahora priorizan capturas reales durante el rollout
(`findCapturingMoves`, 90% de probabilidad de tomarlas si existen antes de
cualquier otra lógica) y evitan activamente jugar en autoatari
(`resultsInSelfAtari`) cuando hay alternativa legal. Cambia el autojuego que
alimenta el generador de problemas (ver más abajo, por qué DOS_OJOS bajó de
12 a 10 entradas).

### Revisar: deep-link real desde el fin de una partida

Permiso explícito del usuario para tocar `ReviewScreen.tsx` (revierte la
instrucción original de no tocarlo). `ReviewScreen` acepta `initialGameId`
opcional; el botón "Revisar esta partida" al terminar un juego en Jugar
abre esa partida exacta en Revisar, no la pantalla general.

### Hoy: rediseño completo, misma pasada

A pedido explícito, sumado al plan de Jugar en vez de en sesión aparte
("sumarlo ahora, en la misma pasada"), a partir de un mockup de referencia
que trajo el usuario. Encabezado con anillo de progreso del nivel
(`ProgressRing`, SVG, sin librería nueva); tarjeta de foco con diagrama del
primer ejercicio del plan; fila de estadísticas (ejercicios totales, racha
con ícono de fuego si está activada, meta diaria); tarjeta de previsualización
del primer ejercicio con botón "Practicar"; tarjeta de insight (conocimiento
vs. aplicación) cuando hay una brecha notable; botón final "Jugar" en texto
plano (nunca "jugar contra el bot"), sin copy dirigido. Decisiones explícitas
del usuario que lo acotan: **sin mascota ni avatar** ("sacar el avatar
definitivamente"), y **sin la idea de "partida recomendada"** con copy
dirigido a una debilidad (coincide con `go-trainer-especificacion-pantallas.md`
sección 0 y con la sección 12 del roadmap maestro, que prohíbe sparring
dirigido antes del motor de evaluación de v2).

### Aprender: niveles 4-10 bloqueados, con nombre y tablero reales

A pedido explícito ("bloqueados, con nombre y tablero reales"), no ocultos:
`LOCKED_LEVELS` en `LearnScreen.tsx`, con los nombres y tamaños de tablero
reales de la tabla de `go-trainer-especificacion-pantallas.md` sección 5,
mismo `LockIcon` que ahora también usa Jugar.

### Banco de problemas: de 75 a 120 entradas

Continuación de la expansión de Fase C. Autojuego regenerado (32 partidas en
vez de 8, ~62 min reales, retornos decrecientes documentados en
`generate-problems.ts`) más plantillas nuevas para ESCALERA/DOBLE_ATARI y,
a pedido explícito del usuario ("dale con lo de red geta snapback etc"),
RED_GETA y SNAPBACK portados a 9x9 (`buildGetaSeed2`/`buildSnapbackSeed2`
en `content/seeds.ts`, misma posición ya verificada de las lecciones n3-l4/
n3-l5, solo en un tablero más grande — la región que recorta el
solucionador no cambia porque ninguna de las dos toca un borde distinto a
9x9 que a su tamaño original).

| Concepto | Antes | Ahora |
|---|---|---|
| ESCALERA | 12 | 28 |
| DOBLE_ATARI | 16 | 24 |
| DOS_OJOS | 12 | 10 |
| PUNTO_VITAL | 4 | 13 |
| CAPTURA_SIMPLE | 5 | 7 |
| RED_GETA | 4 | 8 |
| SNAPBACK | 8 | 16 |
| OJO_FALSO | 4 | 4 (sin cambio, ver abajo) |
| NAKADE | 10 | 10 (sin cambio) |

DOS_OJOS bajó de 12 a 10 con el mismo autojuego reescrito: no es una
regresión, es una trayectoria distinta del autojuego por el cambio de
heurísticas del bot (arriba). **OJO_FALSO se dejó deliberadamente en 4**:
a diferencia de geta/snapback, ya está en el tablero máximo desbloqueado
hoy (9x9) y las 8 transformaciones diedrales ya cubren sus 4 esquinas
posibles, así que no hay "mismo truco, tablero más grande" disponible sin
sumar un tablero bloqueado (13x13+) a contenido en vivo. Una forma de ojo
falso genuinamente nueva (de borde en vez de esquina, con 3 piedras de
anillo) requiere geometría de Go nueva a mano, la misma categoría de
trabajo que costó varias sesiones fallidas antes de resolver la versión de
esquina — se deja fuera de esta pasada a propósito.

`tests/content/seeds.test.ts` necesitó subir dos timeouts (`beforeAll`
60000→120000ms, segundo `it()` 60000→180000ms) por el trabajo adicional de
reverificar las semillas nuevas.

### Aprender: la partida de comprobación ahora arranca en la posición del ejemplo

Pedido explícito: "que la partida ejemplo te lleve a una partida donde
estén las fichas dispuestas de forma tal de poder hacer el ejemplo". Antes,
el botón "Jugar una partida de comprobación" al final de una lección llevaba
siempre a un tablero vacío en Jugar, desconectado del ejemplo interactivo de
esa misma lección. Ahora, si la lección tiene `demo` (posición inicial +
piedras), `PlayConfig` viaja con un `initialStones`/`initialToMove` opcional
(mismo shape que `DemoScript`, nuevo tipo `PlaySeed` en `playConfig.ts`) y
`PlayScreen` salta directo a una partida local en esa posición, sin pasar
por la pantalla de configuración. Sin lección con `demo`, sigue igual que
antes (tablero vacío). Verificado en vivo: la posición de tres negras
rodeando una blanca de la lección de captura simple aparece intacta al
entrar a la partida de comprobación.

### Ejercicios: mensaje de jugada incorrecta (ya existía) + explicación al resolver (nuevo)

Pedido explícito: revisar que un click en un punto legal pero incorrecto
muestre un mensaje, y agregar una explicación de por qué la jugada correcta
lo era. Lo primero ya funcionaba (`useSolvableExercise` valida contra el
solucionador antes de aplicar visualmente la piedra; si no resuelve, no
dibuja la jugada y `ExerciseView` muestra "Eso no lo resuelve, intenta de
nuevo." en rojo) — confirmado en vivo con un problema de Nakade, no solo
leyendo el código. Lo nuevo: al resolver, `ExerciseView` ahora muestra
también una línea "Por qué funciona" con el resumen de una frase del
concepto (`CONCEPTS[conceptId].summaryKey`, ya existía y ya tenía paridad
i18n) — explicación a nivel de concepto, no de la jugada puntual, porque el
banco no guarda razonamiento posición-por-posición.

### Verificación

`tsc -b` limpio; 282/282 tests (31/31 archivos); `oxlint` sin warnings
nuevos fuera de las categorías `set-state-in-effect`/`only-export-components`
ya preexistentes; paridad i18n 436/436 claves; pase visual con Playwright
contra `npm run dev` en cada pieza (Jugar, Hoy, niveles bloqueados,
partida de comprobación con posición del ejemplo, mensaje de incorrecto,
explicación al resolver), sin errores de consola.

### Empaquetado Android: AAB regenerado

`hoshi-flutter` subido de `1.5.0+8` a `1.6.0+9` (minor, por ser cambios
funcionales reales de esta sesión, no un parche). `npm run build` en
`hoshi/` → `sync-webapp.ps1` → `flutter build appbundle --release`:
`app-release.aab` de 43.0MB, mismo firmado de siempre (`android.keystore`,
alias `upload`, vía `android/key.properties`). Todavía no subido a Play
Console — queda del lado del usuario, igual que en cada sesión anterior.
Regenerado una segunda vez al final de la sesión (mismo `1.6.0+9`, no hacía
falta subir de versión otra vez) para que incluya también las dos piezas de
abajo (red de seguridad de tamaño de tablero y "Sobre el Go").

### v1.5, versión barata: red de seguridad de tamaño de tablero, sin refactor todavía

Investigación primero, código después: casi todo el núcleo (`rules.ts`,
`groups.ts`, `benson.ts`, `scoring.ts`, el solucionador, y hasta las tablas
Zobrist) ya recibe `size` como parámetro y ya genera/cachea dinámicamente
por tamaño — no hay nada fijo a 9x9 ahí, contrario a lo que el roadmap
maestro sección 8 daba a entender. El gap real es uno solo: `BoardState`
guarda un único `size` (no `width`/`height`), así que `BOARD_TRANSFORMS`
(las 8 transformaciones diedrales), el recorte de región del solucionador y
el `SZ` de SGF son estructuralmente solo para tablero cuadrado. Eso importa
nada más para el Nivel 4 bloqueado ("9x13", el único tamaño no cuadrado de
toda la lista) — y ese nivel ya depende del motor de evaluación de v2 según
la sección 7 del propio roadmap, así que no hay ningún consumidor real de
esa generalización todavía. Decisión (con el usuario): no hacer el refactor
"cualquier tamaño" ahora, solo la parte barata:

- `getHoshiPoints()` (`ui/board/hoshiPoints.ts`) devolvía `[]` para
  cualquier tamaño que no fuera 5, 7 o 9 — un tablero 13x13/19x19 se
  hubiera dibujado sin ningún punto hoshi el día que se desbloqueen.
  Agregados los patrones estándar (13x13: 4 esquinas + tengen, sin puntos
  de borde intermedio; 19x19: 9 puntos, esquinas + bordes + tengen).
- Cobertura de tests que nunca se había ejercitado más allá de 9: las 8
  transformaciones diedrales (`board.test.ts`), el recorte de región del
  solucionador (`solver/region.test.ts`, archivo nuevo) y el ida-y-vuelta
  de coordenadas SGF (`sgf-roundtrip.test.ts`) ahora también corren a
  tamaño 13 y 19, más un test nuevo para `getHoshiPoints`. Todo pasa limpio
  a esos tamaños, confirmando que el resto del núcleo de verdad ya
  generaliza — la inversión fue barata porque casi no había nada que
  arreglar, solo que confirmar.

### Aprender: nueva sección "Sobre el Go" (historia, glosario, reglas)

Roadmap maestro, sección 6, primera pasada. Vive dentro de Aprender (no una
séptima pestaña), como una sub-pantalla más del mismo router que ya usa
`LearnScreen` para niveles/lecciones (`AboutGoScreen.tsx`, entrada nueva
`{ kind: 'about' }` en el `View` de `LearnScreen`, botón "Sobre el Go" antes
de la lista de niveles).

- **Historia**: origen en China (más de 2500 años, sin fecha exacta
  inventada), difusión a Corea y Japón, las cuatro escuelas oficiales del
  período Edo, la Nihon Ki-in en 1924, y el gancho narrativo de AlphaGo
  contra Lee Sedol en 2016 — el propio bot de Hoshi usa una versión mucho
  más simple de la misma familia de técnicas (MCTS). Fechas conservadoras
  a propósito donde la evidencia histórica no da un año preciso (origen,
  llegada a Japón), con la misma cautela que pide el roadmap para contenido
  factual.
- **Glosario** (`content/glossary.ts`): a propósito, más chico que lo que
  sugería el roadmap. Revisé las 29 lecciones reales antes de escribir
  nada: términos como "hane", "sente", "gote", "tenuki" o hasta "tsumego"
  **no están enseñados en ninguna lección todavía** (joseki es solo el
  nombre de un nivel bloqueado). Los 6 términos que sí están verificados y
  enseñados — atari, ko, nakade, escalera (shicho), red/geta, snapback
  (uttegaeshi) — reusan directamente la definición ya existente de su
  lección o de `concept.X.summary`, cero texto nuevo duplicado.
- **Comparación de reglas de conteo**: chino (el que usa esta app,
  descripción verificada contra la implementación real de
  `computeAreaScore` en `core/scoring.ts`, no un texto de manual genérico),
  japonés, AGA y neozelandés, con ko (reusa `concept.KO.summary`) y seki
  explicados aparte. Seki es contenido genuinamente nuevo (no hay concepto
  `SEKI` en la app), escrito con cuidado por ser una regla bien establecida
  y no controvertida.

Verificado con Playwright contra `npm run dev`: las tres secciones
renderizan, el glosario trae los 6 términos, "volver a los niveles"
funciona, cero errores de consola.

## Canal de feedback y tiempo hasta la primera victoria (2026-09-01, sesión todavía más posterior, cont.)

Dos ítems chicos del roadmap (secciones 11.2 y 11.3), en un solo commit
(`c10cf77`):

- **Feedback sin servidor**: enlace `mailto:fractimeapp@gmail.com` en
  Ajustes ("Reportar un problema"), con asunto prellenado. El email de
  destino lo eligió el usuario explícitamente (no la cuenta universitaria
  que usa para otras cosas).
- **Tiempo hasta la primera victoria**: `learning/firstOpen.ts` guarda una
  fecha de "primera apertura" en localStorage (dato nuevo, es lo único que
  de verdad no se podía derivar de partidas ya guardadas) y
  `learning/firstWin.ts` deriva el resto de `SavedGameRecord[]`, contando
  solo victorias contra el bot (no partidas locales entre dos personas
  compartiendo el dispositivo, donde no hay forma de saber cuál de las dos
  es "quien aprende con la app" — contarlas habría dado una métrica sin
  sentido). Se muestra en Perfil, redondeado a minutos/horas/días según
  corresponda (`bucketFirstWin`), solo si ya hay una primera victoria
  registrada.

## OJO_FALSO resuelto, radar sin verde fijo, y 4 temas nuevos (2026-09-01, sesión todavía más posterior)

### OJO_FALSO: por fin resuelto (`57c2a9c`)

Causa raiz de todos los intentos anteriores, confirmada por fin con certeza:
`buildEnclosedShape` (la tecnica de "llenar todo el tablero de blanco, poner
un anillo negro, vaciar el espacio de ojo") hace que **cualquier** piedra
del anillo tenga cero libertades "hacia afuera" desde el primer momento —
todo alrededor ya es blanco (ocupado), no hay ninguna libertad ahi que una
diagonal pudiera quitarle. Como las libertades nunca dependen del color de
una diagonal (eso es cierto en cualquier posicion de Go, no es un bug de
esta tecnica en particular), recolorear una diagonal bajo relleno total
literalmente no puede cambiar nada: la tecnica es estructuralmente incapaz
de representar un ojo falso, sin importar cuanto se ajuste la geometria.

La construccion que si funciona es dispersa (sin relleno de fondo):
`buildOjoFalsoSeed` en `content/seeds.ts` pone un ojo de esquina (el caso
mas simple: una sola diagonal en juego) con dos piedras de anillo A=(1,0) y
B=(0,1), mas una piedra blanca D en la diagonal (1,1). La clave: D es vecina
**ortogonal** directa de A y de B a la vez (no solo diagonal del punto de
ojo) -- eso le quita a cada una una libertad real que de otro modo tendrian,
dejandolas con una sola libertad compartida: la esquina misma. Blanco juega
ahi y captura las dos de un solo movimiento.

Verificado contra `solve()` en los tres regimenes que el proyecto realmente
usa (no alcanza con probar uno): `regionMargin=1, maxDepth=8` (lo que usa
`buildSeedProblems()` para aceptar la semilla), `margin=2, maxDepth=5` (lo
que `seeds.test.ts` re-verifica sobre *todas* las semillas ya generadas,
sin importar el margen con que se generaron), y `margin=1, maxDepth=8` (lo
que usa en vivo `useSolvableExercise.ts` durante el ejercicio real). Los
tres dan `solved: true`, limpio, sin tocar el limite de profundidad. Banco
regenerado: 4 problemas de OJO_FALSO (una por cada esquina/orientacion via
las 8 transformaciones diedrales, deduplicadas).

Nota tecnica para quien construya la proxima forma a mano: durante el
proceso se armo mal una vez un arbol de refutacion "correcto pero feo" (una
variante con libertades extra en el anillo, que sigue siendo un ojo falso
real y el solucionador la confirma como `solved: true`, pero produce una
secuencia de 14+ jugadas con el defensor tirando piedras una y otra vez a
un punto ya condenado antes de rendirse del todo). Aunque es logicamente
valida, como ejercicio interactivo se ve confusa. La version aceptada usa
las piedras del anillo ya en su minimo de libertades desde el inicio, asi
que blanco resuelve en un solo click (perfectamente aceptable y coherente
con como ya funcion Doble atari en este banco) y el arbol se resuelve en
77 nodos sin tocar el limite de profundidad.

### El radar de Perfil se veia siempre verde, sin importar el tema (`544f241`)

El usuario reporto "el tema del sistema es verde musgo" — pero el radar de
habilidad de 6 ejes en Perfil usaba `var(--hoshi-success)` para su relleno,
borde y vertices, y ese token **no se redefine por tema de app** (solo
tiene una variante clara/oscura via `[data-scheme]`, igual para los 9
temas). El radar se veia del mismo verde sin importar que tema estuviera
elegido, dando la impresion de que "el tema" era verde cuando en realidad
el color del radar nunca dependia del tema en absoluto. Cambiado a
`var(--hoshi-accent)`: confirmado visualmente que ahora el radar cambia de
color con cada tema (negro en Clasico, naranja en Amanecer, coral en
Carbon, etc.).

### 4 temas de app nuevos, a pedido explicito

Madera (tonos calidos de madera, primer tema de app inspirado en el mismo
espiritu que el tema de tablero Kaya), Oceano (celeste-turquesa), Lavanda
(purpura suave) y Carbon (tercer tema oscuro, grafito neutro con acento
coral, distinto del ambar de Noche y el azul de Pizarra). Quedan 9 temas
seleccionables mas "seguir sistema" (`src/ui/theme/appThemes.ts`).

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

## Estado general del proyecto — version anterior, historica (2026-09-02, antes de v2)

Reemplazada por la version nueva al principio de este archivo, que cubre
el trabajo real de v2 (refactor de tablero, motor de evaluacion) hecho
despues de esta. Dejada tal cual, como registro historico.

Reemplaza la versión de 2026-09-01 de más abajo (dejada tal cual, como
registro histórico, en vez de borrada — quedó desactualizada casi de
inmediato: buena parte de sus "brechas" listadas se cerraron esa misma
sesión y las siguientes). Esta versión es deliberadamente un resumen de
dónde está el proyecto hoy, no una re-derivación línea por línea contra los
documentos de diseño: ese análisis completo ya se hizo una vez (ver abajo)
y la mayoría de sus hallazgos ya están resueltos; el detalle narrativo de
cómo se llegó a cada punto vive en las entradas de fase, en orden
cronológico, más arriba en este archivo.

### v1 y post-v1: cerrado

F1-F6 (núcleo de reglas, bot MCTS, solucionador, detectores de errores,
FSRS/Hoy, lecciones/temas/ajustes) y Fase A/B post-v1 (empaquetado Android,
`ConceptOccurrence`) siguen cerrados tal como los describe la sección
"Fotografía del proyecto" del roadmap maestro.

### v1.1 (alinear la interfaz con la especificación de pantallas): cerrado

Todas las brechas que la comparación de 2026-09-01 (más abajo) había
encontrado ya se cerraron, en esta sesión o en las anteriores del mismo
día: radar de 6 ejes en Perfil, escala kyu del bot + dificultad adaptativa
+ estilos de juego, meta diaria editable, Hoy rediseñado (encabezado con
anillo de progreso, tarjeta de foco, fila de estadísticas, insight,
plan del día colapsado detrás de un botón en vez de mostrar los 12+
ejercicios de una sola vez), Aprender mostrando los niveles 4-10 bloqueados
con nombre y tablero reales, Jugar mostrando 13x13/19x19 bloqueados con el
mismo criterio. Jugar además se separó en dos pantallas (configurar →
partida, mismo patrón que Aprender) con deshacer real, conteo en vivo y
confirmación en pantalla antes de abandonar una partida sin terminar desde
cualquier pestaña. Revisar abre la partida exacta recién jugada por
deep-link. Nueva sección "Sobre el Go" dentro de Aprender (historia,
glosario, comparación de reglas de conteo) — no estaba en ningún documento
de diseño anterior, es contenido de referencia agregado a pedido explícito.

**Sigue sin alinear**: Ejercicios continúa siendo una sola pantalla
(selección de concepto y práctica mezcladas), a diferencia de Aprender/
Jugar/Revisar que ya usan el patrón de dos pantallas. Marcado como
pendiente de decisión explícita del usuario, no como olvido.

### Empaquetado Android

`hoshi-flutter/` en `1.6.0+9` (`versionCode 9`), AAB regenerado con todo lo
de esta sesión y subido de version respecto al `1.5.0+8` que menciona la
comparación de 2026-09-01 más abajo. Sigue el mismo mecanismo desde el
cambio de TWA a WebView en Flutter (ver esa entrada): `npm run build` en
`hoshi/` → `sync-webapp.ps1` → `flutter build appbundle --release`, mismo
firmado (`android.keystore`, alias `upload`). Subir a Play Console sigue
del lado del usuario en cada sesión.

### Banco de problemas

Creció de 71 (estado al 2026-09-01) a 120 en la sesión siguiente
(heurísticas reales del bot en el autojuego, RED_GETA/SNAPBACK portados a
9x9, más plantillas de ESCALERA/DOBLE_ATARI), y esta sesión suma etiqueta
de dificultad (fácil/medio/difícil, derivada de cuántas jugadas hace falta
leer, dato interno todavía — sin filtro visible en Ejercicios) más
crecimiento adicional en curso (más autojuego, una escalera genuinamente
más larga verificada a 6 jugadas del perseguidor, un doble atari con
relleno visual). Números finales de esta pasada, una vez termine de correr
el generador, quedan en la entrada de sesión correspondiente más arriba.
`OJO_FALSO` se mantiene deliberadamente en 4 (ver su propia entrada): ya
está en el tablero máximo desbloqueado y una forma nueva necesitaría
geometría de Go genuinamente distinta, la misma categoría de riesgo que
costó varias sesiones fallidas la primera vez.

### v1.5 (deuda técnica de tamaño de tablero)

Versión barata hecha, refactor completo deliberadamente pospuesto (ver su
propia entrada de sesión): casi todo el núcleo ya generaliza por tamaño de
tablero sin tocarlo (confirmado, no solo asumido, con tests nuevos a 13x13/
19x19). El único gap real es tablero no cuadrado (`BoardState.size` es un
solo número), que no tiene consumidor real todavía — el único nivel
bloqueado no cuadrado (Nivel 4, "9x13") depende del motor de evaluación de
v2, que tampoco existe.

### El gate de v1 saltado: sigue siendo el mayor riesgo abierto

Ninguno de los 4 criterios de salida de v1 (roadmap maestro, sección 1.4)
se cumplió todavía — en particular, nadie que sepa Go de verdad revisó
todavía ni una lección ni un problema del banco. Esto no cambió desde la
comparación de 2026-09-01, pero la urgencia sí: el banco pasó de 71 a 120+
problemas sin ninguna revisión externa de contenido. El roadmap lo marca
explícito: "se vuelve más urgente, no menos, a medida que el banco crece."
Sigue siendo, con diferencia, el pendiente más importante del proyecto que
no es código.

### Qué sigue

En orden de valor, no de facilidad: (1) la versión liviana del gate de v1
(alguien con experiencia real revisando una muestra de lecciones y
problemas) — no es código, pero es el único chequeo de contenido que
existe; (2) decidir si Ejercicios pasa al mismo patrón de dos pantallas que
el resto de la app; (3) v2 (motor de evaluación posicional, niveles 4-6,
13x13) sigue siendo el próximo hito grande de verdad, sin empezar todavía.

---

## Estado general del proyecto — version anterior, historica (2026-09-01)

Analisis completo pedido por el usuario en su momento, comparando lo
construido contra `go-trainer-v1-diseno.md`, `go-trainer-post-v1-roadmap.md`
y `go-trainer-especificacion-pantallas.md` linea por linea. Se deja tal cual
como registro (no se borra), pero quedo desactualizada casi de inmediato:
la seccion de arriba ("Estado general del proyecto (2026-09-02)") es la
version vigente.

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
