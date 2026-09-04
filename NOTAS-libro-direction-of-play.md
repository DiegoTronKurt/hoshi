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
Game"), 4 ("The Professional Approach"), 6 ("Once Upon A Game"), 7
("Test Yourself") y 8 ("The Direction Of Play For Fighting") se
muestrearon solo de forma parcial (quedan como candidatos si hace falta
mas respaldo para Nivel 5/6 en el futuro).

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
