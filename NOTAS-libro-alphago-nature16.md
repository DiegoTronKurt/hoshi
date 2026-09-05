# Notas del paper: Silver et al., "Mastering the game of Go with deep neural networks and tree search"

Tercer texto subido por el usuario a `Go_app/` (fuera de este repo,
`Google-go-nature16.pdf`), junto con otros dos papers y un libro (ver
`NOTAS-libro-survey-mcts.md` y `NOTAS-libro-katago-accelerating-selfplay.md`).
A diferencia de Kageyama/Kajiwara, este no es respaldo teórico de Go para
lecciones -- es literatura de motor/IA, relevante para `src/engine/mcts.ts`
(el bot que Hoshi juega) y `src/eval/` (la red de KataGo preentrenada usada
solo como comentario de IA en Revisar, ver `src/ui/review/ReviewMistakeBoard.tsx`).

**Ficha**: Silver, D., Huang, A., Maddison, C.J. et al. "Mastering the game
of Go with deep neural networks and tree search." *Nature* 529, 484-489
(2016). PDF nativo (no escaneado), 20 páginas, texto extraído con
`pdftotext` sin necesidad de OCR. Leído completo, incluyendo Methods y las
11 Extended Data Tables/Figures.

## Qué es esto realmente (paper de AlphaGo original, el de Fan Hui)

Este es el paper de 2016 -- la versión de AlphaGo que venció a Fan Hui (2
dan profesional), NO la versión posterior que venció a Lee Sedol (esa fue
cubierta solo en la prensa, este PDF es el artículo de Nature original) ni
AlphaGo Zero/AlphaZero (papers de 2017/2018, no incluidos en esta tanda).
Combina dos redes entrenadas por separado -- red de política pσ (supervisada
sobre 30 millones de posiciones humanas de KGS, 57.0% de acierto) y red de
valor vθ (entrenada por refuerzo sobre partidas de autojuego) -- dentro de
MCTS asíncrono (APV-MCTS).

## Relevancia directa para `src/engine/mcts.ts`

Leí el motor real de Hoshi (`engine/mcts.ts`) antes de escribir esto, no de
memoria. Comparación concreta, no vaga:

- **Hoshi NO usa ninguna red neuronal para jugar.** `chooseMove` es UCT
  clásico (`selectUctChild`) sobre un árbol reconstruido desde cero en cada
  llamada, con una política de playout pesada a mano (`choosePlayoutMove`:
  capturar con prob. 0.9, salvar atari propio con prob. 0.9, si no, jugada
  ponderada por estilo evitando auto-atari y ojos simples). Esto es
  arquitectónicamente el tipo de programa que este mismo paper describe como
  predecesor de AlphaGo (Pachi, Fuego, GnuGo -- Fig. 4/Extended Data Table 6),
  no una versión reducida de AlphaGo. Confirma exactamente lo que ya dice
  `go-trainer-roadmap-maestro.md` sección 13: "el propio bot de Hoshi usa una
  versión mucho más simple de la misma familia de técnicas (MCTS)."
- **La formula UCT de Hoshi**: `exploitation + 1.4 * sqrt(log(N)/n)`. Esto
  es exactamente la constante `sqrt(2)` de UCB1 para bandits planos (Auer et
  al. 2002, citada indirectamente vía la survey de MCTS -- ver
  `NOTAS-libro-survey-mcts.md`), un convenio estándar y correcto, no un error.
  Detalle completo de esta comparación en el otro archivo.
- **El paper SÍ confirma, con cita textual, tres cosas que el código de
  `src/eval/` ya asume sin poder verificarlas independientemente**:
  1. Cabeza de valor con 3 salidas (nuestro `model.ts` asume
     `[gana, pierde, sin resultado]`): el paper describe la red de valor
     "vθ(s) that predicts the outcome" con softmax, y aunque *este* paper en
     particular usa solo win/lose (Go sin reglas de ciclo largo), el paper de
     KataGo (`accelerating_self_play_go.pdf`, Apéndice A.5) SÍ confirma
     explícitamente las 3 salidas "win, loss, and no result" -- ver el otro
     archivo de notas para el detalle, ahí es donde se resuelve realmente la
     incertidumbre que documenta el comentario de `model.ts`.
  2. El uso de 8 simetrías diedrales (rotación/reflexión) para evaluar una
     posición y promediar -- Sección "Symmetries" del paper. Hoshi no hace
     esto en `eval/` (evalúa una sola orientación), lo cual es una
     simplificación razonable y consciente (no un error), pero es una mejora
     concreta y barata que sí podría aplicarse: promediar sobre las 8
     transformaciones ya existentes en `core/board.ts`
     (`applicableTransforms`/`transformBoard`) reduciría el ruido de la
     evaluación de IA en Revisar sin entrenar nada nuevo. Es una idea, no una
     implementación -- no se tocó código.
  3. Softmax final aplicado fuera de la red exportada (`model.ts` comenta
     "el grafo exportado no incluye la activación final... confirmado
     corriendo el modelo real"): el paper describe explícitamente que sus
     redes "outputs a probability distribution" vía softmax como capa final
     de la arquitectura, consistente con que un grafo exportado a veces deja
     esa capa fuera del grafo congelado (implementación estándar de
     TensorFlow), no una rareza de este modelo en particular.

## Lo que este paper NO puede confirmar (para no sobreclamar)

Este paper describe la arquitectura AlphaGo de 2016 (image stack 19×19×48,
13 capas convolucionales, ver "Neural network architecture" en Methods) --
**no** el formato de entrada V7 que `eval/features.ts` dice implementar
("reconstruido a partir de `cpp/neuralnet/nninputs.cpp`/`.h` de KataGo").
KataGo es un proyecto completamente distinto (independiente, del mismo
linaje conceptual pero con su propio códebase C++, ver
`accelerating_self_play_go.pdf`). Este paper es útil para entender los
CONCEPTOS generales (policy/value heads, MCTS combinado con red, softmax,
simetrías) pero no sirve como especificación canal-por-canal para verificar
`eval/features.ts` -- eso solo lo puede hacer el propio código fuente de
KataGo o una instalación real de KataGo (ver la investigación de
verificación en `NOTAS.md`, sesión 2026-09-05).

## Dato curioso, verificado, para contexto honesto con el usuario

Extended Data Table 5: AlphaGo 2016 (versión Fan Hui) usaba `cpuct = 5`
como constante de exploración de su UCT con red -- mucho más alto que el
`EXPLORATION_CONSTANT = 1.4` de Hoshi, pero no son formulas comparables
directamente (AlphaGo's `u(s,a)` depende de la probabilidad previa P(s,a) de
la red, que Hoshi no tiene). No es una comparación válida "Hoshi debería usar
5 en vez de 1.4" -- son fórmulas estructuralmente distintas.
