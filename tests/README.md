# Arnés de regresión

Arranca **el userscript de verdad** dentro de jsdom, sobre un DOM de `/giveaways`, y comprueba
lo que dejó hecho: **qué peticiones salieron**, en qué orden quedaron los giveaways del
listado, qué botones aparecieron y qué dice la línea de estado del widget. Se miran efectos
observables, los que ve el usuario, no funciones internas: así un refactor no rompe los tests
y un cambio de comportamiento sí.

No hay framework. Cada fichero se ejecuta solo y acaba en `TODO OK` o `FALLOS: …`.

## Correr

```sh
cd tests
npm install          # solo jsdom
node test-cargar-paginas.js
node test-cargar-paginas-guardas.js
node test-cargar-paginas-fallos.js
node test-aviso-ruleta.js
node test-tooltip-doble.js
```

## Control negativo

Una prueba que pasa igual con el código viejo no mide lo que dice. `IG_SCRIPT` apunta el arnés
a otra copia del script:

```sh
git show HEAD:indiegala-bulk-join.user.js > /tmp/anterior.user.js
IG_SCRIPT=/tmp/anterior.user.js node test-cargar-paginas.js
```

Contra el 1.9.0 (antes de «cargar todas las páginas») cae todo lo que describe la función
nueva y **pasan** los casos que describen lo que no cambia —la casilla apagada, el listado de
una sola página, la búsqueda delante—, que es exactamente lo que tienen que hacer.

## Qué cubre cada uno

| Test | Qué vigila |
|---|---|
| `test-cargar-paginas.js` | El caso central: una sola petición por página, sin duplicados, y el listado en el orden correcto. Incluye **entrar por la página 3**, donde la 1 y la 2 tienen que quedar por encima y no al final. Comprueba también que la petición lleva la sesión y la cabecera de XHR, que las imágenes traídas se revelan (con el `asyncImgLoader` del sitio y sin él) y que los ＋ / ⚠×N / ✕ salen en las filas traídas igual que en las nativas. |
| `test-cargar-paginas-guardas.js` | Los casos en los que **no** se pide nada: ruleta por girar, cola en curso, resultados de búsqueda delante, casilla apagada. Y la pareja positivo/negativo de la página guardada: con la casilla puesta no se reaplica, con la casilla quitada sí. |
| `test-cargar-paginas-fallos.js` | Que un fallo **pare y se diga**: HTTP 500 en la primera y en la segunda petición, el servidor sirviendo una página distinta de la pedida, y un `status` que no es `ok`. En los cuatro, sin filas repetidas y con el aviso a la vista. |
| `test-aviso-ruleta.js` | Que el aviso de «hay ruleta por girar» llegue por los canales que **no interrumpen** y por ninguno que sí: la marca 🎡 al principio del `<title>`, el toast que no se va solo, y **cero llamadas a `alert()`** (el arnés las captura en vez de dejarlas estallar, para poder afirmarlo). Ese último no es cosmético: el `alert()` entró y salió dos veces por motivos que ya no aplican, y esto es lo que impide que vuelva sin querer. Incluye el control negativo —sin ruleta, título intacto, ningún toast y ningún diálogo— y el caso en el que **el sitio reescribe el título** por su cuenta, donde la marca tiene que volver encima del título nuevo. Y la **cuenta atrás de la ruleta** en el widget: que cuente cuando no la hay —con su forma, `3h 12m (18:00)`, no una plantilla con los `{v}` sin sustituir— y que pase a «disponible ahora» cuando sí. El sonido no se prueba: está desactivado, y además jsdom no reproduce nada. |
| `test-tooltip-doble.js` | Que el tooltip propio y el del navegador **no salgan a la vez**. Apunta a un control del widget, comprueba que la caja propia sale y que el `title` se guardó, y entonces **fuerza un repintado** para ver si alguien se lo devuelve — que es el fallo: cualquier `el.title = …` a pelo sobre un nodo que sobrevive al repintado deja los dos avisos encima. Cubre los dos controles que se repintan sin recrearse: la cuenta atrás de la ruleta y el botón de minimizar. Ya pasó dos veces (la cifra de saldo primero, la línea de la ruleta después), y por eso existe este test. |
| `test-cargar-paginas-paginacion.js` | Que la barra de paginación se pliegue **solo cuando no falta ninguna página**, y que la celda del total («132 items») se quede siempre. Los cuatro casos que NO deben plegarla —casilla apagada, parada por un fallo, parada por la ruleta, listado de una sola página— pesan más que el que sí: plegarla al pararse a medias quitaría la única salida justo cuando hace falta. Tarda el doble que los demás porque cada caso corre dos veces, una para saber cuántas celdas pinta el fixture. |

## Lo que el arnés reproduce a propósito

- **El carrusel viene cuatro veces** (`#page-slider-1..4`, las variantes responsive) y repite
  giveaways del listado. Es la trampa en la que cae un `querySelectorAll` sin ámbito: el mismo
  giveaway se cuenta hasta cinco veces. Los conteos del arnés son siempre dentro de
  `#ajax-contents-container .page-contents-list`.
- **El CSS del sitio, en lo que el script da por hecho.** `.display-none { display: none }` no
  es decoración: sin esa regla, jsdom da `display:block` a los contenedores que el sitio tiene
  ocultos y `isSearchActive()` cree que hay una búsqueda delante **siempre**, con lo que no se
  carga nada y los tests salen en verde por el motivo equivocado. Pasó al escribirlos.
- **Las tarjetas de nivel 0 llegan sin control de compra**, que es lo que sirve Indiegala para
  los giveaways de tu nivel en los que ya tienes boleto. Por eso el número de ＋ esperado es
  menor que el de tarjetas: es el estado real, no un fixture incompleto.
- **`asyncImgLoader` no se define salvo en un caso.** Las imágenes llegan con
  `class="display-none"` y sin `src`; en el sitio las revela ese `<script>` que cierra cada
  fragmento, y aquí se prueban los dos caminos: el del sitio cuando existe, y el respaldo del
  script cuando no.
