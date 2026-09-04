# Notas del libro: Kajiwara, "The Direction of Play"

Segundo libro subido por el usuario a `Go_app/` (fuera de este repo,
`the_direction_of_play.pdf`) para dar respaldo teorico a Nivel 5 (Apertura)
de Hoshi. Mismo principio que `NOTAS-libro-kageyama.md`: la posicion en si
se verifica con el motor/solucionador cuando se puede, pero la afirmacion
de *direccion* ("esta esquina desarrolla hacia aca, no hacia alla") es un
juicio de la fuente, no del motor -- el propio roadmap maestro (seccion 9.1)
ya establecio que el motor de evaluacion de Hoshi no sirve para esto.

**Como se leyo**: el PDF es un escaneo sin capa de texto (`pdftotext`
extraia 0 caracteres). Se instalaron Poppler (`pdftoppm`, ya estaba
parcialmente presente via winget pero no en el PATH de esta sesion) y
Tesseract OCR (`UB-Mannheim.TesseractOCR`), ambos via `winget`, para
renderizar las 130 paginas del PDF a imagenes y correr OCR sobre cada una.
Calidad de OCR buena en el texto corrido (parrafos legibles), pero los
diagramas de tablero (dibujados con caracteres ASCII/box-drawing en el
original) salen ilegibles como ruido de texto -- no se intento leerlos por
OCR, solo la prosa. Cobertura de esta lectura: capitulo 1 completo
("The Direction Of Play In The Opening: The Corner Stones", el mas
relevante para Nivel 5) y capitulo 5 completo ("The Direction Of Play And
Josekis", relevante para Nivel 6, ya construido antes de leer este libro).
Los capitulos 2 ("The Early Stages Are Decisive"), 3 ("Move Two Lost The
Game") y 7 ("Test Yourself") siguen sin leerse mas alla de la tabla de
contenidos -- quedan como candidatos si hace falta mas respaldo mas
adelante. El capitulo 4 ("The Professional Approach") se reviso
puntualmente para una cita de respaldo (ver Nivel 8 mas abajo). El
capitulo 6 ("Once Upon A Game") se leyo completo 2026-09-04 para Nivel 7
(Fuseki). El capitulo 8 ("The Direction Of Play For Fighting") se leyo en
profundidad el mismo dia para Nivel 8 (Medio juego: ataque y defensa) --
no pagina por pagina, pero cubriendo todo el tramo con material citable
de ataque/defensa.

Ficha: *The Direction of Play*, Takeo Kajiwara 9-dan, trad. John Fairbairn
(paginas 1-190) y el staff de The Ishi Press (resto), The Ishi Press 1979.
Original japones: *Ishi no Hoko* (Go Super Books, Vol. 12), Nihon Kiin,
verano de 1970.

---

## Tesis central del libro (Prefacio + Introduccion)

Cita central, la que le da nombre al libro:

> In go each stone, whether it stands alone or with others, is invested
> with a power all its own. [...] Accurately pinpointing this direction
> and finding the right move to match it is vital for real strength in
> the middle game.

Y sobre por que esto no es lo mismo que jugar joseki de memoria:

> You mustn't play mechanically, choosing a move just because it is
> joseki or because it is a basic principle of fuseki. Instead you must
> play each stone only after considering in which directions the stones
> are exerting their power at that particular juncture [...] joseki [and]
> fuseki [...] are in the end no more than special applications of the
> direction of play.

**Relevancia para Hoshi**: esto es, literalmente, la tesis que
`NOTAS-libro-kageyama.md` ya habia extrapolado de forma indirecta del
capitulo 5 de Kageyama para resolver `DIRECCION_LADO_GRANDE`, y es tambien,
de forma independiente, la misma idea con la que se disenaron `n6-l1`
(que es un joseki) y `n6-l3` (tenuki) de Nivel 6 antes de tener este libro.
Los dos capitulos leidos de esta fuente confirman ambos disenos en vez de
contradecirlos -- ver mas abajo.

---

## Capitulo 1 — "The Direction Of Play In The Opening: The Corner Stones" (pp. 5-16)

Diagrama por diagrama, la direccion de juego de cada punto de apertura
estandar en la esquina. Fuente principal para Nivel 5.

### El punto estrella (4-4, hoshi)

> A stone on the star point in the corner wants to develop in two
> directions [...] Thus with one move you are declaring an interest in
> two sides. [...] a stone on the star point does have a weakness, namely
> the three-three point, and [...] there is no possibility of closing off
> the territory [...] we must stress this stone's flexibility for
> extending its sphere of influence on a large scale.

**Relevancia para Hoshi**: confirma exactamente, palabra por palabra, lo
que ya se escribio en `n6-l4` (`HOSHI_INVASION_3_3`) sin haber leido
todavia este libro: el 4-4 prioriza velocidad/influencia en dos
direcciones a la vez, a cambio de no bloquear el 3-3. No hizo falta
corregir nada de Nivel 6 con esta fuente, solo queda mejor respaldado.

### El punto 3-4 (komoku)

> A stone played on the 3-4 point is a quiet, restrained move that can
> easily be turned into profit. The direction of the next play will be
> around 'a' to enclose the corner [...] when playing the 3-4 point it is
> important to consider the relationship with the other corners.

Diagrama "Not advisable": si el rival ya tiene una esquina cercana
cerrada, jugar 3-4 ahi mismo es malo porque la piedra "ha sido privada de
su direccion de desarrollo" -- el desarrollo natural queda estorbado por
el cerco rival en vez de servir para algo.

**Relevancia para Hoshi**: material nuevo, no cubierto todavia por ningun
nivel. Buena base para un concepto de Nivel 5: la direccion de un 3-4 no
se decide sola, depende de las otras esquinas del tablero.

### El punto 3-3

> A stone at the 3-3 point [...] has directly opposite connotations [to
> the star point] [...] there is no direction of play from the 3-3 point.
> [...] it forms a world of its own and has no stake in outside influence.

**Relevancia para Hoshi**: el contraste mas nitido y citable de todo el
capitulo -- el 4-4 tiene DOS direcciones, el 3-3 no tiene NINGUNA. Material
nuevo, buena base para un concepto de Nivel 5 en pareja directa con el
punto estrella.

### Cercos de esquina (shimari): puerta principal y puerta trasera

> The primary direction of play from a corner enclosure, the "front
> door", is towards 'a'. The "back door" [...] is the secondary
> direction. [...] a box-like shape results [...] The superiority of a
> box to a tray in mapping out territory is what determines the
> direction of play from a corner enclosure.

**Relevancia para Hoshi**: material nuevo, concreto y facil de convertir
en un diagrama de comparacion (mismo patron ya usado en `n4-l4` y
`n6-l2`: dos variantes lado a lado). Buena base para un concepto de
Nivel 5.

### Puntos 4-5 (takamoku) y 3-5

Tambien cubiertos con el mismo detalle (direccion principal hacia un lado,
flexibilidad segun la respuesta rival, referencia de pasada a josekis con
nombre propio como el "taisha"), pero son puntos de apertura menos
frecuentes en un curriculo introductorio que 3-4 y 4-4 -- quedan como
candidatos si Nivel 5 se amplia mas adelante, no usados en la primera
tanda de lecciones.

---

## Capitulo 5 — "The Direction Of Play And Josekis" (pp. 109-114, muestreado)

Analiza una partida real donde Negro elige una secuencia que, tomada
aisladamente, es un joseki correcto (una variante del taisha, un joseki
real con nombre propio), pero que ignora la direccion general del
tablero:

> the fact that Black chose to enter the lower left corner seems to
> indicate that he was being slipshod about the direction of play. [...]
> The efficiency of a move is often given only cursory attention.

Y antes, sobre el mismo error en terminos generales:

> It is one of the basic principles of go that taking a profit means
> giving outside influence, yet players who know this often try
> obstinately to resist it.

**Relevancia para Hoshi — validacion retroactiva de Nivel 6**: esto es,
con un ejemplo real y con nombre propio (taisha), exactamente la idea con
la que ya se disenaron `n6-l1` (un joseki correcto en abstracto no es lo
mismo que la jugada correcta en tu partida) y `n6-l3` (tenuki: seguir una
secuencia local ya sin vigencia mientras el resto del tablero decide el
resultado) -- construidos ANTES de poder leer este libro, sin corregir
nada despues de leerlo. Buena confirmacion de que el diseño, basado en
principios generales bien establecidos, no necesito la fuente especifica
para acertar en este caso (a diferencia de `DIRECCION_LADO_GRANDE` en
Nivel 4, que si la necesito).

---

## Aplicacion: Nivel 5 (Apertura)

Con este libro, Nivel 5 deja de estar bloqueado. Concepto lista
propuesta originalmente sin la fuente (antes de leer este libro) quedo
reemplazada por una version mas precisa y directamente citable, ver
`NOTAS.md` para el detalle de las 5 lecciones reales construidas con este
material.

---

## Capitulo 6 — "Once Upon A Game" (pp. 135-165, completo)

Capitulo hibrido: una partida real jugada por el autor (Blanco, fuseki
mokuhazushi, "teoria de los komoku opuestos", pelea de medio juego, una
derrota final en la jugada 79) entrelazada con reflexion en primera
persona sobre sobrellevar las "malas rachas". Fuente principal para
Nivel 7 (Fuseki). Todas las citas de esta seccion son de este capitulo
(lineas ~2637-3174 del OCR en el scratchpad de la sesion, no en este
repo).

### Un moyo no es territorio

> That is not to say that the whole of the right side would turn into
> white territory; but if Black should invade he will be quite unable to
> make a two-space extension and thus a base on the third line between 1
> and A (assuming alternate moves of course).

Y sobre el mecanismo por el que un moyo si se convierte en territorio,
mas adelante en la misma partida:

> If Black surrounds the centre the white territory at the top will,
> through a cause-and-effect relationship, swell of its own accord.

**Relevancia para Hoshi**: base directa de `n7-l1`
(`MOYO_NO_ES_TERRITORIO`) y `n7-l4` (`PACIENCIA_Y_MARGEN`). La primera
cita es literal: la leccion `n7-l1` reconstruye exactamente esta
geometria (dos piedras del mismo lado, invasion a mitad de camino,
extension de dos espacios imposible) y se verifico por conteo de
intersecciones, no por lectura de secuencia -- ver el test de geometria
usado y borrado durante la construccion, y `NOTAS.md`.

### Pensar solo en lo local es no ver la direccion de juego

> In relation to the corner enclosure White's checking extension at 1 is
> ideal. But this betrays thinking about only the local instead of the
> overall situation. [...] Thinking locally and forgetting the overall
> position is tantamount to being blind to the direction of play.

**Relevancia para Hoshi**: base de `n7-l2` (`JUICIO_LOCAL_VS_GLOBAL`).
Generaliza el tenuki de `n6-l3` (dejar una secuencia ya cumplida) a
cualquier jugada que se evalua solo por su vecindario inmediato.

### El fuseki es jugar en relacion a lo que ya esta puesto

> This is what fuseki is all about: making moves on the strength of the
> stones already played. It is wrong to assume blithely that it makes no
> difference where you play the first few moves.

Y, cerca del final del capitulo, reforzando la misma idea:

> A stone on mokuhazushi has power and directionality. Fitting these into
> the overall framework is the art of go: for this you need a sense of
> direction.

**Relevancia para Hoshi**: base de `n7-l3` (`RELACION_CON_PIEDRAS_PROPIAS`).

### La paciencia no es resignacion

> The point is that while White may be thinking he was losing it is by
> no means certain. Patience is called for here. Being patient is not the
> same as giving up. It is rather a question of playing on to aim at
> turning the tables or at least going down with colours flying.

**Relevancia para Hoshi**: segunda mitad del respaldo de `n7-l4`
(`PACIENCIA_Y_MARGEN`), junto con la cita de "cause-and-effect" de mas
arriba.

### La direccion no reemplaza la lectura

Cierre del capitulo, tras la derrota del autor en la partida analizada:

> This was not so important in this game once the fight in the lower
> right corner began, for it became more a matter of reading ability
> than of the direction of play. At least it is certain that a sense of
> direction alone was not sufficient. Fighting games are governed by
> reading ability. One can go even further perhaps: all games depend on
> it.

**Relevancia para Hoshi**: base de `n7-l5` (`DIRECCION_NO_ES_TODO`),
la leccion de cierre de Nivel 7 -- mismo rol que `TENUKI_JOSEKI` como
matiz de cierre en Nivel 6.

---

## Capitulo 4 — "The Professional Approach" (pp. 79-108, revisado puntualmente)

No leido completo; revisado para una sola cita de respaldo usada en
Nivel 8 (ver mas abajo). Analiza una partida donde un jugador acumula
puntos concretos mientras el otro acumula solo grosor/influencia:

> As you will see if you survey the game as a whole, Black is all profit
> and White is all thickness. In games like this it is risky for Black
> to start a fight, and there is no need for it anyway. Since Black is
> already ahead in pure profit he has no call to be greedy and challenge
> White to an equal fight inside White's sphere of influence.

**Relevancia para Hoshi**: base de `n8-l5` (`NO_PELEAR_SIN_NECESIDAD`).
Mismo vocabulario de "profit vs. thickness" que ya aparece de forma
dispersa en otras partes del libro, aca con el ejemplo mas nitido y
autocontenido encontrado hasta ahora.

---

## Capitulo 8 — "The Direction Of Play For Fighting" (pp. 211-243, tramo con material citable)

Ultimo capitulo del libro, centrado exclusivamente en como se aplica la
direccion de juego una vez que empieza una pelea. Fuente principal para
Nivel 8 (Medio juego: ataque y defensa).

### Atacar debe construir algo, no solo perseguir

> An attack must be more than a simple attack. One must try to take some
> profit while attacking instead of just being content with the simple
> joy of attacking.

**Relevancia para Hoshi**: base de `n8-l1` (`ATACAR_CONSTRUYENDO`).

### Usar las piedras propias que ya estan puestas

> Utilizing stones already played like this in an attack is the most
> effective way of playing.

**Relevancia para Hoshi**: base de `n8-l2`
(`USAR_PIEDRAS_PROPIAS_PARA_ATACAR`).

### No se puede pelear fuerte en un lado si sos debil en otro

> Common sense dictates that if one has a weak position in one place, one
> cannot fight strongly somewhere else.

**Relevancia para Hoshi**: base de `n8-l3` (`NO_PELEAR_CON_DEBILIDAD`).

### Sacrificar lo necesario

> When one gets involved in heavy fighting, it is dangerous just to think
> of safety and to try to make all one's groups live. One must adapt
> one's approach to the whole board, that is, sacrifice what should be
> sacrificed and take what should be taken.

**Relevancia para Hoshi**: base de `n8-l4` (`SACRIFICAR_LO_NECESARIO`).

### Una cita descartada a proposito

El mismo capitulo tiene esta otra afirmacion, mas dificil de interpretar
sin ver el diagrama original (el OCR no reconstruye diagramas de
tablero, solo prosa -- ver la nota al principio de este documento):

> Attacking from the direction in which one is strong goes against the
> logic of go.

Leida en contexto (Fig. 9/Dia. 35-36, pp. 240-241) esto NO contradice el
proverbio estandar "atacar desde la fuerza": la jugada correcta en la
misma figura tambien se juega "from the direction in which Black is
thick". La diferencia real entre la jugada mala y la buena depende de un
diagrama que el OCR no reconstruye de forma legible. Por precaucion (ver
principio del proyecto: ninguna afirmacion de Go sin verificarla contra
una fuente real que se entienda con confianza) esta cita se descarto sin
construir ningun concepto sobre ella, en vez de arriesgarse a ensenar
una version simplificada que capture mal el punto real.

---

## Aplicacion: Nivel 7 (Fuseki) y Nivel 8 (Medio juego: ataque y defensa)

Con los capitulos 4, 6 y 8, Nivel 7 y Nivel 8 dejaron de estar
bloqueados -- ningun libro nuevo hizo falta. Las 10 lecciones (5 por
nivel) construidas con este material estan en `src/content/lessons/n7.ts`
y `src/content/lessons/n8.ts`; el detalle de las decisiones de diseno
(por que estos 5 conceptos y no otros, que citas se descartaron y por
que) esta en `NOTAS.md`.
