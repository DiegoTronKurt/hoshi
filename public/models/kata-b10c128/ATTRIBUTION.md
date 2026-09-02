# Procedencia de este modelo

Pesos de la red `g170 b10c128-s1141046784-d204142634` de [KataGo](https://github.com/lightvector/KataGo)
(David J. Wu / "lightvector"), publicados como CC0 / dominio publico en
[katagoarchive.org](https://katagoarchive.org/g170/neuralnets/index.html)
segun la [licencia de redes de KataGo](https://katagotraining.org/network_license/).

Convertidos a formato TensorFlow.js por Yuji Ichikawa
([y-ich/KataGo](https://github.com/y-ich/KataGo)) y vendorizados en
formato listo para usar por Maksim Korzh
([maksimKorzh/kata-model-js](https://github.com/maksimKorzh/kata-model-js)),
de donde se descargaron estos archivos tal cual (`model.json`,
`metadata.json`, `group1-shard*.bin`) sin ninguna conversion local.

Nota importante: el codigo JS de esos dos repos (la logica de inferencia,
construccion de entradas, etc.) **no** se copio ni se adapto -- ninguno
de los dos declara licencia para su codigo. Solo se usaron los archivos
de pesos en si (numeros, no expresion creativa), permitidos por la
licencia de KataGo citada arriba. Toda la logica de inferencia en este
proyecto (`src/eval/`) es implementacion propia, escrita a partir de la
especificacion publica de KataGo (`cpp/neuralnet/nninputs.cpp`/`.h` en
el repo de KataGo, MIT).
