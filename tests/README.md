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
node test-cargar-paginas-paginacion.js
node test-aviso-ruleta.js
node test-tooltip-doble.js
node test-cola-desde-ficha.js
node test-portada-sin-imagen.js
node test-boletos-comprados.js
node test-ocultar-participados.js
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
| `test-aviso-ruleta.js` | Que el aviso de «hay ruleta por girar» llegue por sus **tres** canales: la marca 🎡 al principio del `<title>`, el toast que no se va solo y el **`alert()`** — y que la marca **ya esté puesta cuando el diálogo aparece**, porque `alert()` congela el hilo y lo que no esté pintado antes no se ve hasta cerrarlo. El arnés fotografía el título en ese instante: es la única forma de distinguir «se puso antes» de «se puso después», que dejan el mismo título final. Incluye el control negativo —sin ruleta, título intacto, ningún toast y ningún diálogo— y el caso en el que **el sitio reescribe el título** por su cuenta, donde la marca tiene que volver encima del título nuevo. Y la **cuenta atrás de la ruleta** en el widget: que cuente cuando no la hay —con su forma, `3h 12m (18:00)`, no una plantilla con los `{v}` sin sustituir— y que pase a «disponible ahora» cuando sí. Y que **no se lance una notificación del sistema**: se probó en 1.10.5 —es lo único que se salta el autoplay, porque lo lanza el gestor y no la página— y se descartó, así que esto es lo que impide que vuelva, igual que el caso de `alert()`. El beep no se prueba: jsdom no reproduce nada, así que afirmar algo de él mediría el arnés. |
| `test-tooltip-doble.js` | Que el tooltip propio y el del navegador **no salgan a la vez**. Apunta a un control del widget, comprueba que la caja propia sale y que el `title` se guardó, y entonces **fuerza un repintado** para ver si alguien se lo devuelve — que es el fallo: cualquier `el.title = …` a pelo sobre un nodo que sobrevive al repintado deja los dos avisos encima. Cubre los dos controles que se repintan sin recrearse: la cuenta atrás de la ruleta y el botón de minimizar. Ya pasó dos veces (la cifra de saldo primero, la línea de la ruleta después), y por eso existe este test. |
| `test-cola-desde-ficha.js` | Que un item con `fnName: 'joinGiveawayCard'` —los que dejaba la ficha, y que siguen vivos en las **colas ya guardadas** aunque desde 1.10.7 la ficha ya no encole— funcione al ejecutar la cola en el listado. Mira los argumentos con los que sale el join: que el **token se refresque** del trigger vivo del listado en vez de viajar el de la ficha (que caduca: lleva dentro la marca de tiempo del render), que se invoque la función que existe en esa página, y que el ancla sea la de verdad y no una falsa. El segundo caso es el fallo silencioso: con un `.card-join` de **otro** giveaway en pantalla, el join no puede irse a ése. Control positivo incluido: un item encolado en el propio listado no cambia. |
| `test-portada-sin-imagen.js` | Que el hueco de una tarjeta **sin portada se pueda pulsar**. Indiegala pide la cabecera con su sufijo `_ig`, que en el CDN de Steam no existe (404 en los siete appids probados), y su CSS deja el ancla de la `<figure>` en `height:auto` — con la imagen rota mide 0 px y el clic no llega a ningún lado. Se comprueba que la figura se marca, que el enlace recupera el alto y sigue apuntando al detalle, y que el `<img>` roto se esconde **con `!important`** (o Chrome pinta su texto alternativo encima del placeholder; pasó, y una regla normal no le gana al `style.display` en línea del sitio). Y se comprueba lo que el script **no** hace: la URL de la imagen no se toca. Eso no es un detalle — llegó a reescribirse para rescatar portadas y se quitó a propósito el 2026-08-31, así que ese caso es lo que impide que vuelva sin querer. Con la red de seguridad (un `load` desmarca la figura), diez vueltas por la idempotencia reponiendo el `src` a la manera del sitio, y el control de que una portada que carga bien no se marca. El alto de verdad no se mide: jsdom no hace layout, así que lo que se afirma es que las reglas están en la hoja. |
| `test-boletos-comprados.js` | Que el modal de encolar diga **cuántos boletos ya tienes** de ese giveaway. El listado no publica el dato —su «sold» es el total de todo el mundo—, así que se lee de la ficha, y el test fija el coste: **una** petición, a la URL del href del título (con su slug, que no se adivina), con la sesión, y **cero** al cargar el listado. Los dos casos que valen igual: con boletos sale el número, sin ellos sale el **0** —que es una respuesta, no silencio—. Y los dos en los que hay que callar: la ficha sin `.card-join-info` y la petición que falla; ahí la línea **no** aparece, porque inventarse un cero sería decirle «no tienes ninguno» a quien tiene cuatro, que es justo lo que este dato viene a evitar. Ese es también el caso que fija por qué se descartó contar los joins del propio script, que no habría costado ninguna petición. |
| `test-cargar-paginas-paginacion.js` | Que la barra de paginación se pliegue **solo cuando no falta ninguna página**, y que la celda del total («132 items») se quede siempre. Los cuatro casos que NO deben plegarla —casilla apagada, parada por un fallo, parada por la ruleta, listado de una sola página— pesan más que el que sí: plegarla al pararse a medias quitaría la única salida justo cuando hace falta. Tarda el doble que los demás porque cada caso corre dos veces, una para saber cuántas celdas pinta el fixture. |
| `test-icono-incrustado.js` | Que el `@icon` vaya **incrustado** como `data:image/png;base64,…` y que el base64 decodifique a un PNG cuadrado de verdad. No comprueba una URL: existe porque un `@icon` remoto hizo que **OpenUserJS rechazara con un 500** la release 1.1.1 de `alienware-arena-arp-tracker` («unsupported file type: undefined») mientras GitHub y GreasyFork la aceptaban sin queja — o sea que el fallo solo se ve en el tercer destino y después de haber pusheado. Que la URL responda 200 con tipo de imagen **no basta**: el favicon de AWA pasaba esas comprobaciones. |

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
- **jsdom no carga imágenes, nunca.** Un `<img>` **con** `src` se queda en `complete: false`
  para siempre (comprobado), así que el barrido por `complete`/`naturalWidth` —que es lo que en
  el navegador detecta una portada caída— aquí no se puede ejercer: lo salta, que es justo lo
  que debe hacer. Lo que sí es fiel es el **evento**: un 404 dispara `error` en el `<img>`, y
  `dispatchEvent` recorre la fase de captura hasta el listener de `document` igual que en el
  navegador. Por eso `test-portada-sin-imagen.js` dispara el evento a mano en vez de fingir
  medidas.
- **`asyncImgLoader` no se define salvo en un caso.** Las imágenes llegan con
  `class="display-none"` y sin `src`; en el sitio las revela ese `<script>` que cierra cada
  fragmento, y aquí se prueban los dos caminos: el del sitio cuando existe, y el respaldo del
  script cuando no.
