# Notas del libro: Kageyama, "Lessons in the Fundamentals of Go"

Libro subido por el usuario a `Go_app/` (fuera de este repo) para dar
respaldo teorico a los conceptos de Hoshi que no se pueden verificar solo
con el motor (`solve()`/`solveLadder()`/`computeAreaScore`): son juicios de
teoria de Go establecida, no hechos calculables. Mismo principio que ya usa
`content/seeds.ts` para posiciones escritas a mano: la posicion en si se
verifica con el solucionador cuando se puede, pero la ETIQUETA "esto es
buena forma" / "esto es territorio, no zona de influencia" es un juicio de
la fuente (aca, Kageyama), no del motor.

**Cobertura de esta lectura**: el libro tiene 137 paginas / 11 capitulos.
No se leyo completo. Se leyeron a fondo el capitulo 8 (Buena forma y mala,
la fuente principal, ya que el pedido concreto era TRIANGULO_VACIO) y se
muestrearon paginas de apertura + 2-3 diagramas clave de los capitulos 2,
4, 5, 9 y 11 (los mas relevantes para los conceptos de detectores sin
ejercicio de Hoshi). Los capitulos 1, 3, 6, 7, 10 y el Apendice NO se
leyeron; quedan pendientes si en el futuro hace falta respaldo para otro
concepto (candidatos: cap. 1 Escaleras y redes -> ESCALERA/RED_GETA/GETA,
cap. 6 Vida y muerte -> refuerzo teorico de DOS_OJOS/NAKADE/OJO_FALSO,
cap. 10 incluye Snap-Back -> refuerzo de SNAPBACK).

Ficha: *Lessons in the Fundamentals of Go*, Toshiro Kageyama (professional
7-dan), trad. James Davies, The Ishi Press 1978. Original japones: *Ama to
Pro* (Go Super Books, Vol. 11), Nihon Kiin.

---

## Capitulo 8 — "Good Shape and Bad" (pp. 159-178)

### El triangulo vacio (Dia. 37-38, p. 175)

Cita central, la definicion formal que usa el libro:

> Black 1, the key point, is the way to put pressure on White. White 2
> only links up; it does no work; it has no effect on Black; it is bad
> shape. This is the infamous 'empty triangle'.

Geometria: 3 piedras propias que ocupan 3 de los 4 puntos de un cuadrado
de 2x2 (tipicamente una pareja conectada + una jugada diagonal que las
"liga" en vez de extender), con el 4to punto vacio pero redundante — no
suma una libertad genuinamente nueva ni presiona al rival, simplemente
liga sin trabajar. El contraste (Dia. 38) muestra la alternativa correcta:
una jugada que SI obliga al rival a responder (aqui, una conexion forzada
en 3 para evitar el corte), dejando a negro en buena forma y a blanco en
mala — "His good shape and White's bad shape make quite a contrast."

**Advertencia explicita del propio libro, dos veces** (esto es lo que
impide construir un detector/heuristica ingenuo de "cualquier forma en L
es mala"):

1. Apertura del capitulo (p. 160): *"It would be hasty to conclude that
   good shape is always correct. Bad shape has its own strength and
   character too, and at times it is better."*
2. Dia. 43 / Dia. 51 (p. 176-178): una jugada con forma de triangulo
   vacio puede ser la jugada CORRECTA cuando es forzada — *"Black
   realizes 2 makes bad shape, but he cannot help it. If he omits it, he
   will be cut."* Dia. 51 va mas lejos: *"Black 1 is correct. How can
   such bad shape be correct?"* — jugada "mala forma, buena jugada",
   jugada solo para negarle al rival la buena forma.
3. Dia. 45 (p. 177): contraejemplo directo — una extension solida de 3
   piedras que NO es triangulo vacio ("makes good, thick shape"), para
   remarcar que no toda agrupacion de 3 piedras en un area chica cuenta.

**Relevancia para Hoshi — TRIANGULO_VACIO**: el detector de partida real
(`detectTrianguloVacio` en `mistakes.ts`, si existe con esa forma) y
cualquier ejercicio nuevo NO pueden limitarse a "patron geometrico L
detectado = incorrecto". Segun esta fuente, la condicion real es: la
jugada liga piedras propias sin ganar nada (ni presiona al rival, ni
evita un corte real, ni es forzada). Para un ejercicio nuevo, esto sugiere
plantillas construidas a mano (no autojuego: un MCTS de fuerza limitada no
etiqueta "esto es estéticamente triangulo vacio", solo juega) donde:
(a) la jugada del triangulo vacio es CLARAMENTE innecesaria (no hay corte
real que evitar, verificable con el motor: la conexion alternativa deja
el mismo grupo sin corte posible), y (b) existe una alternativa real,
mejor, en la misma posicion (una jugada que si presiona/gana algo,
idealmente verificable con `solve()` si el contexto es una pelea de
vida-muerte, o con `computeAreaScore` si es una comparacion de puntos).
Dado que "buena forma" en general no es una propiedad que el motor pruebe
(no es vida-muerte ni conteo de area, es una convencion de eficiencia), el
ejercicio que se construya con esto queda marcado como HEURISTICO /
basado en la fuente, no probado por el solucionador de la misma manera
que DOS_OJOS o PUNTO_VITAL.

### Otros puntos del capitulo 8 (contexto general de forma)

- Dia. 6-9, 39-40: "el punto clave del rival es tu propio punto clave"
  (*"the enemy's key point is your own"*) — proverbio de lectura de forma,
  relevante como principio general pero no especifico de un concepto de
  Hoshi.
- Dia. 46-48: la cruz (crosscut) y el proverbio "extender desde un
  crosscut" — relacionado con CORTE_NO_DEFENDIDO tangencialmente (que
  hacer cuando ya hay un corte), no con dejar un corte sin defender.

---

## Capitulo 2 — "Cutting and Connecting" (pp. 35-54, muestreado)

- Dia. 5-6 (p. 42): **"Don't peep where you can cut" / "Cut where you can
  cut"** — principio central del capitulo. Un "peep crudo" (amenazar un
  corte sin cortarlo) regala al rival la oportunidad de conectar gratis;
  si se puede cortar, cortar directamente suele ser mas fuerte.
- Dia. 8-9 (p. 43): *"Even a moron connects against a peep"* — una
  amenaza directa a un punto de corte practicamente fuerza la conexion
  del rival.
- Dia. 11 (p. 45): *"when White pushes through at 1, how should he
  reply? Middle and upper level players miss this surprisingly often"* —
  confirma que fallar en responder correctamente a una explotacion de un
  punto de corte es un error real y comun, no solo teorico.

**Relevancia para Hoshi — CORTE_NO_DEFENDIDO**: refuerza que el concepto
(dejar un punto de corte sin defender y que el rival lo explote) es un
tema central y bien documentado, y que el error tipico del jugador es NO
darse cuenta de que hace falta defender (mas que, por ejemplo, defender
mal). No cambia el diseño ya decidido para el detector de partida real
(que depende de la respuesta del rival, por eso quedo sin caso "correcto"
en el trabajo del item 3), pero da plantillas de referencia utilizables
para un ejercicio estatico "hay un punto de corte aqui, defiendelo" si se
construye mas adelante.

---

## Capitulo 4 — "The Struggle to Get Ahead" (pp. 65-86, muestreado)

Dia. 1-3 (p. 66-67): el proverbio **"la segunda linea es la linea de la
derrota"** (*"the second line — the line of defeat"*). Comparacion directa:
si blanco repta por la segunda linea respondiendo mansamente a cada
jugada de negro, blanco pierde influencia y velocidad en cada intercambio,
aunque cada jugada individual sea "segura".

**Relevancia para Hoshi — PRIMERA_LINEA_TEMPRANA**: esta es la fuente mas
cercana que se encontro, pero es una EXTRAPOLACION, no una cita literal:
el libro habla de la segunda linea durante una secuencia de contacto en
desarrollo, no explicitamente de la primera linea temprana en la apertura
(que es el marco exacto del concepto de Hoshi). La logica se extiende de
forma natural (jugar mas bajo/pegado al borde temprano, cuando jugar mas
alto/al centro vale mas, es ineficiente por el mismo motivo: el rival
gana relativamente mas por jugada) pero no hay una posicion o regla
verificable por motor equivalente a "vida/muerte" o "conteo de area" para
este concepto — sigue siendo, en el mejor de los casos, una heuristica de
apertura, no una propiedad que un solucionador pueda demostrar sobre una
posicion aislada.

---

## Capitulo 5 — "Territory and Spheres of Influence" (pp. 87-109, muestreado)

Apertura del capitulo + Dia. 1-2 (p. 88-89): distincion formal entre
**territorio** (puntos ya asegurados) y **zona de influencia / moyo**
(area con potencial, todavia invadible). Cita:

> The correct view is that the upper side is White's sphere of influence
> and nothing more. It cannot be called territory (...) Territory and
> spheres of influence: inability to distinguish between them is one of
> the weaknesses of amateur go.

**Relevancia para Hoshi — RELLENO_TERRITORIO_PROPIO**: esta distincion es
exactamente la que ya usa el detector de partida real (`bensonPassAlive`
en `core/benson.ts`, que solo cuenta cadenas genuinamente pass-alive, no
"moyo" — ver `detectRellenoTerritorioPropio` en `mistakes.ts`). El libro
confirma que la distincion territorio-vs-influencia es la base teorica
correcta y no arbitraria; no aporta una tecnica de generacion nueva
porque, a diferencia de TRIANGULO_VACIO, este concepto ya es verificable
por motor (`computeAreaScore`/`computeAreaOwnership`), asi que la fuente
sirve como respaldo/documentacion, no como insumo tecnico necesario.

---

## Capitulo 11 — "Endgame Pointers" (pp. 243-254, muestreado)

- Dia. 8-10 (p. 249): metodo de conteo de diferencia de puntos entre dos
  secuencias de final de partida (p.ej. "esta jugada vale doce puntos,"
  "la diferencia entre estos dos diagramas es de catorce puntos") —
  exactamente el metodo de "contar la diferencia de area con y sin la
  jugada" que ya usa el detector de PASE_PREMATURO
  (`computeAreaOwnership`, ver `detectPasePrematuro` en `mistakes.ts`).
- p. 248: *"Defending where necessary is as important as not defending
  where unnecessary"* — principio que conecta directamente CORTE_NO_DEFENDIDO
  (defender donde hace falta) con PASE_PREMATURO/RELLENO_TERRITORIO_PROPIO
  (no jugar donde no hace falta): son las dos caras de la misma idea de
  eficiencia.

**Relevancia para Hoshi — PASE_PREMATURO**: confirma que el metodo de
"contar la diferencia de puntos que deja una jugada" (ya implementado con
`computeAreaOwnership` en el detector) es el metodo estandar de la teoria
de Go para esta evaluacion, no una simplificacion propia del proyecto.
