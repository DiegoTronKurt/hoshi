# Notas del paper: Wu, "Accelerating Self-Play Learning in Go"

Cuarto texto subido por el usuario a `Go_app/` (fuera de este repo,
`accelerating_self_play_go.pdf`). Este es, literalmente, el paper que
describe KataGo -- escrito por David J. Wu ("lightvector", el autor del
proyecto cuya red preentrenada Hoshi ya usa en `public/models/kata-b10c128/`,
ver `ATTRIBUTION.md`). Es la fuente más directamente relevante de las cuatro
para `src/eval/`.

**Ficha**: Wu, David J. "Accelerating Self-Play Learning in Go."
arXiv:1902.10565v5 (revisado 9 nov 2020). PDF nativo, 28 páginas, texto
extraído con `pdftotext` sin OCR. Leído completo, incluyendo los 6 apéndices
(A: arquitectura e inputs, B: función de pérdida, C-F: detalles de
entrenamiento). Referencia [16] del propio paper es el Nature de AlphaGo
(`NOTAS-libro-alphago-nature16.md`); referencia [1] es Benson (`core/benson.ts`
ya lo implementa).

## Hallazgo directo: resuelve una incertidumbre real documentada en el código

`src/eval/model.ts` línea ~22 dice: *"Orden asumido de la cabeza de valor de
KataGo (win/loss/noResult); no hay forma de verificarlo de forma
independiente sin una instalación real de KataGo para comparar."*

El Apéndice A.5 de este paper (Value Head) lo confirma **textualmente**:

> The first 3 values are a distribution in logits whose softmax ẑ predicts
> among the three possible game outcomes win, loss, and no result (the
> latter being possible under non-superko rulesets in case of long-cycles).

Mismo orden (win, loss, no-result), mismo mecanismo (logits + softmax). Esto
no reemplaza la verificación empírica contra una instalación real de KataGo
que pide el propio comentario del código (ver `NOTAS.md`, sesión
2026-09-05, para esa investigación), pero sí es una segunda fuente
independiente, textual y directa, que coincide -- vale la pena citarla en el
comentario de `model.ts` en vez de dejarlo como "no verificable en absoluto".

## Confirma también, con cita, otras suposiciones de `src/eval/`

- **Ownership en [-1,1] vía tanh, positivo = jugador actual**: Apéndice A.5,
  "An ownership subhead": *"A tanh activation function... 1 indicates
  ownership by the current player and −1 indicates ownership by the
  opponent"* -- coincide exacto con `model.ts` (`Math.tanh`, comentario
  "Positivo = zona de quien pidió la evaluación").
- **Cabeza de política con 2 canales, el segundo es la predicción del rival**:
  Apéndice A.4, "the second channel is the predicted policy π̂opp for the
  opposing player on the subsequent turn" -- coincide con `model.ts`
  ("la cabeza principal es el índice 0... la cabeza [1] es auxiliar, no se
  usa acá").
- **`model.executeAsync` en vez de `execute`**: la arquitectura descrita
  (Apéndice A.3) usa capas de "global pooling" con reducciones dependientes
  del tamaño del tablero -- consistente con que el grafo exportado tenga
  operaciones dinámicas (`Merge`) que exigen ejecución asíncrona, tal como
  documenta el comentario de `evaluatePosition`.
- **`kata-b10c128` es un checkpoint real e identificable, no un nombre
  arbitrario**: Tabla 5 confirma que "b10×c128" (10 bloques residuales, 128
  canales) fue un tamaño real usado durante la corrida principal de 19 días
  de KataGo, con `cpool=32, chead=32, cval=64`. Tabla 6/7 dan contexto
  honesto sobre qué tan fuerte es específicamente ESTE checkpoint (no la
  red final de KataGo): entrenado solo 1.75 días de los 19 totales, con
  Elo -850 respecto a Leela Zero/ELF y "Rough strength: Strong Professional"
  -- fuerte, pero explícitamente NO el nivel superhumano de los checkpoints
  b15×c192 (Elo -329) o b20×c256 (Elo +76, el tamaño final real de KataGo).
  Vale la pena que el usuario sepa esto: la "opinión de la IA" en Revisar
  viene de una red fuerte pero deliberadamente chica (8MB vs. cientos de MB
  de una red KataGo moderna de torneo), elegida por tamaño de descarga para
  una PWA, no por ser la más fuerte disponible.

## Por qué el formato de entrada (V7) sigue sin poder verificarse con este paper

El Apéndice A.1 de este paper documenta un formato de entrada **más viejo**
que el V7 que `eval/features.ts` implementa: 18 canales espaciales + 10
globales aquí, contra 22 espaciales + 19 globales en V7 (los propios
comentarios de `features.ts` ya lo llaman "V7", una versión posterior). Las
categorías generales coinciden conceptualmente -- liberties, ko/superko,
historial de jugadas, escaleras ("ladderable stones"), pass-alive, paridad
de komi -- lo cual es una confirmación *general* razonable de que
`eval/features.ts` no inventó categorías inexistentes, pero **no sirve como
especificación canal-por-canal** para el formato real que usa. Solo el
código fuente actual de KataGo (`cpp/neuralnet/nninputs.cpp`) o una
instalación real de KataGo pueden verificar V7 con precisión -- ver la
investigación de verificación empírica en `NOTAS.md`.

## Relevancia para `src/engine/mcts.ts` (el bot que Hoshi juega, no la IA de Revisar)

Este es el hallazgo más importante del paper para el motor de juego real,
y confirma algo que el propio roadmap ya había medido:

`go-trainer-roadmap-maestro.md` sección 13 ya documenta que conectar la red
de KataGo al bot (no solo a Revisar) se midió y se descartó por ahora: una
sola evaluación de red cuesta ~1043ms en Node/CPU, ~400x más lento que un
playout completo de `mcts.ts`. La idea que quedó anotada como pendiente
("un solo llamado a la red por jugada real, para ordenar las jugadas raíz
antes de probarlas, no un llamado por playout") es, palabra por palabra, la
técnica que describe la Sección 3.1 de este mismo paper (KataGo hereda de
AlphaZero): la red da una probabilidad previa P(c) para cada jugada raíz,
usada en la fórmula PUCT

    PUCT(c) = V(c) + cPUCT * P(c) * sqrt(ΣN(c')) / (1 + N(c))

para priorizar qué ramas explorar primero, sin evaluar la red en cada
simulación. Esto confirma que la idea pendiente en el roadmap no es
descabellada -- es literalmente cómo KataGo/AlphaZero usan la red -- pero
el roadmap ya identificó correctamente el bloqueo real: la única medición de
latencia que existe es de escritorio sin GPU, "explícitamente no
representativa del dispositivo real", y ese es el paso que falta antes
de escribir cualquier código (medir latencia real en navegador/WebView con
aceleración WebGL). No se intentó esa medición en esta sesión -- no hay
herramienta de automatización de navegador disponible en este entorno (ver
`NOTAS.md`).

## Ideas de la Sección 3 (mejoras generales, no específicas de red) potencialmente aplicables a `mcts.ts` sin ninguna red neuronal

Estas sí son compatibles con el árbol UCT plano de Hoshi, sin necesitar el
modelo de KataGo en absoluto -- ver `NOTAS-libro-survey-mcts.md` para las
mismas ideas descritas de forma más general (RAVE, Last Good Reply) con
más profundidad histórica. Ninguna se implementó, quedan como ideas.
