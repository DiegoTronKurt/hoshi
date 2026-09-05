# Notas del paper: Browne et al., "A Survey of Monte Carlo Tree Search Methods"

Segundo texto de la tanda de cuatro subida por el usuario a `Go_app/` (fuera
de este repo, `SurveyMCTS.pdf`). El más directamente aplicable de los tres
papers de IA a `src/engine/mcts.ts`, porque a diferencia de los otros dos
(AlphaGo, KataGo) no requiere ninguna red neuronal -- son todas mejoras al
MCTS "clásico" que ya es, en esencia, lo que Hoshi implementa.

**Ficha**: Browne, C., Powley, E., Whitehouse, D. et al. "A Survey of Monte
Carlo Tree Search Methods." *IEEE Transactions on Computational
Intelligence and AI in Games*, Vol. 4, No. 1, March 2012. PDF nativo, 49
páginas, texto extraído con `pdftotext` sin OCR.

**Cobertura de esta lectura**: no se leyó completo. Se leyó a fondo la
Sección 3 (algoritmo UCT central, con fórmulas), la Sección 5.3 (familia
AMAF/RAVE), la Sección 6.1 (mejoras de simulación: MAST/PAST/FAST/patrones/
Last Good Reply) y la Sección 6.3 (paralelización). Se muestreó la Sección
5.4-5.6 (mejoras game-theoretic, poda). NO se leyeron las Secciones 4
(variantes: multijugador, POMDP, un jugador -- no aplican a Go de 2
jugadores con información perfecta), 7 (aplicaciones a decenas de juegos
sin relación con Go) ni 8 (conclusión/preguntas abiertas). Quedan
pendientes si hace falta más adelante.

## La fórmula UCT exacta, comparada con `mcts.ts` -- ni error ni coincidencia, dos convenciones distintas

Leí `engine/mcts.ts` antes de escribir esto. La función `selectUctChild`
usa:

    exploitation + EXPLORATION_CONSTANT * sqrt(log(N) / n)     // EXPLORATION_CONSTANT = 1.4

La Sección 3.3.1 de este paper da la fórmula UCT "de libro" para árboles:

    UCT = X_j + 2*Cp * sqrt(2*ln(n) / n_j)

con `Cp = 1/√2` como el valor "demostrado que satisface la desigualdad de
Hoeffding" (la garantía teórica de convergencia de Kocsis y Szepesvári).
Si se sustituye ese Cp en la fórmula del paper, el coeficiente efectivo de
`sqrt(ln(n)/n_j)` da **2**, no 1.4.

Esto NO es un bug de Hoshi. La constante `1.4 ≈ √2` que usa `mcts.ts` es,
en cambio, exactamente la fórmula UCB1 original para bandits (sin árbol) de
Auer et al. 2002 (mencionada en la Tabla 1 del paper, "2002 Auer et al.
propose UCB1 for multi-armed bandit"): `X̄_j + sqrt(2*ln(n)/n_j)`, que
tiene coeficiente √2 directo. Es una convención extremadamente común en
implementaciones reales de MCTS (aplicar la fórmula UCB1 de bandit
directamente a cada nodo del árbol, en vez de la variante re-derivada
específicamente para árboles con el factor 2 adicional) -- ambas
convenciones aparecen en la literatura y ninguna es "la correcta" en
términos de fuerza de juego real, solo difieren en qué garantía teórica
de regret satisfacen exactamente. El propio paper además aclara (secc.
3.2, nota 9) que "ciertas mejoras funcionan mejor con un valor distinto de
Cp" -- es decir, incluso los autores tratan la constante como algo a
calibrar empíricamente por dominio, no como un valor fijo correcto.

**Conclusión honesta**: no hay evidencia de que 1.4 sea peor (ni mejor) que
2.0 para el juego real de Hoshi. Decidir eso requeriría un torneo de
autojuego real comparando ambas constantes a presupuestos de tiempo fijos
(mismo criterio de "medir, no opinar" que ya usa este proyecto) -- no se
hizo, no se recomienda cambiar la constante solo por esta lectura.

## RAVE/AMAF (Sección 5.3) -- la mejora más prometedora encontrada, no implementada

Hoshi no tiene ninguna forma de sesgo por historial: cada nodo nuevo del
árbol empieza sin información hasta que se visita directamente. RAVE
(Rapid Action Value Estimation, secc. 5.3.5) resuelve exactamente ese
problema: actualiza estadísticas de TODAS las jugadas que aparecieron
durante una simulación (no solo el camino en el árbol), dando una
estimación inicial mucho más rápida a nodos recién creados. Es la mejora
histórica que hizo fuerte a MoGo (el primer bot MCTS competitivo en Go,
Tabla 1: "2006... M O G O con éxito notable").

Por qué importa específicamente para Hoshi: la investigación de fuerza del
bot ya documentada (sesión anterior, ver `NOTAS.md`) encontró que **todos
los niveles de fuerza están limitados por tiempo, no por cantidad de
playouts** -- es decir, `chooseMove` nunca llega a acumular muchas visitas
por nodo antes de que se acabe `maxTimeMs`. RAVE da su mayor beneficio
exactamente en ese régimen (pocas visitas por nodo), porque no depende de
haber visitado un nodo muchas veces para tener una estimación útil. Esto
es una hipótesis razonable, no una medición -- implementarlo y medirlo en
autojuego real sería el siguiente paso, no se hizo acá.

Aviso encontrado en el mismo paper que vale la pena que el usuario conozca:
secc. 5.3.8 (PoolRAVE) cita que esta familia de técnicas, probada en
programas de Go reales, funcionó bien en general pero **no para resolver un
problema particular de Go llamado semeai** ("but not to solve a problem
particular to Go known as semeai" -- Hoock et al.). Esto confirma, desde
una fuente externa, que semeai es un punto débil conocido de MCTS genérico
en general -- consistente con por qué Hoshi construyó un solucionador
dedicado y verificado (`solver/semeai.ts`) para los ejercicios de ese
concepto en vez de confiar en que el bot MCTS lo resuelva bien por búsqueda.

## Last Good Reply (Sección 6.1.8) -- mejora barata a la política de playout existente

`choosePlayoutMove` en `mcts.ts` ya es una "heavy playout" (secc. 6.1,
"Drake and Uurtamo describe such biased playouts as heavy playouts") con
heurísticas hechas a mano (capturar, salvar atari, evitar auto-atari). Last
Good Reply (LGR-1/LGR-2/LGRF) es un complemento barato y bien documentado
para 19×19 Go específicamente (secc. 6.1.8: "LGR enhancements were shown to
be an improvement over the default policy for 19×19 Go"): guardar, por
cada jugada del rival, cuál fue la última respuesta propia que llevó a
ganar, y reusarla la próxima vez que aparezca esa misma jugada rival
durante un playout (si es legal). Estructura de datos mínima (una tabla
jugada→jugada), sin necesitar patrones ni entrenamiento. No implementado.

## Paralelización (Sección 6.3) -- aplicable, pero cambio de arquitectura mayor

`mcts.ts` corre en un solo Web Worker (`engine/client.ts`), un solo hilo,
una sola búsqueda. "Root Parallelisation" (secc. 6.3.2: correr árboles UCT
independientes en paralelo y combinar solo las estadísticas de la raíz al
final) es la variante más simple de aplicar sin tocar la estructura interna
del árbol -- pero requeriría múltiples Web Workers por jugada del bot en
vez de uno, bastante más infraestructura (spawn/terminate/merge) que las
dos ideas anteriores. Se anota como posibilidad, no se investigó más a fondo por
alcance.

## No se investigó (fuera de alcance de esta lectura)

Progressive bias/widening (secc. 5.5.1), transposition tables (secc.
6.2.4) y MCTS-Solver/proof-number search (secc. 5.4.1) también aparecen
como mejoras clásicas bien documentadas, pero no se profundizó en cada una
-- quedan como candidatos para una revisión futura si el usuario quiere
priorizar mejoras concretas al motor de juego (no a la IA de Revisar, que
es un sistema completamente separado, ver
`NOTAS-libro-katago-accelerating-selfplay.md`).
