# Indiegala Bulk Tools

Tampermonkey userscript that adds a unified ticket-purchase queue and utilities to Indiegala giveaways, plus two lookup buttons on store product pages. / Userscript de Tampermonkey que añade una cola unificada de compra de boletos y utilidades a los giveaways de Indiegala, y dos botones de consulta en las fichas de la tienda.

> [!WARNING]
> **USE AT YOUR OWN RISK / USO BAJO TU PROPIO RIESGO:** automating purchases violates Indiegala's anti-spam policy and may cause a permanent ban. / Automatizar compras viola la política anti-spam de Indiegala y puede causar un baneo permanente.

![The queue panel, the GalaSilver widget and the buttons the script injects on indiegala.com/giveaways](docs/screenshot-giveaways.png)

*Queue panel (bottom left) with an Extra Odds giveaway queued ×5, GalaSilver widget (top right) with its four listing options, and the buttons injected on each card: ＋ to queue a Single Ticket, ✕ in the opposite corner to hide that giveaway until it ends, and ⚠×N on Extra Odds cards, where N is how many tickets your balance covers. / Panel de la cola (abajo a la izquierda) con un giveaway de Extra Odds encolado ×5, widget de GalaSilver (arriba a la derecha) con sus cuatro opciones del listado, y los botones que se inyectan en cada card: ＋ para encolar un Single Ticket, ✕ en la esquina opuesta para ocultar ese giveaway hasta que termine, y ⚠×N en las tarjetas de Extra Odds, donde N es cuántos boletos cubre tu saldo.*

<img src="docs/screenshot-giveaways-mobile.png" width="375" alt="The same queue and balance widget on a phone-sized viewport">

*Same queue on a phone: the panel goes full width along the bottom, the widget clears the site header with its four options readable at that width, and every row keeps its ▲▼ reorder controls and its ×N count. / La misma cola en un móvil: el panel pasa a ancho completo abajo, el widget se aparta del header del sitio con sus cuatro opciones legibles a ese ancho, y cada fila conserva sus controles ▲▼ para reordenar y su cuenta ×N.*

![The whole Level 0 listing pulled into one page, with the status line under the checkbox and the pagination folded](docs/screenshot-load-every-page.png)

*"Load every page" ticked: the three pages of the Level 0 listing are in this one, the widget says so right under the checkbox ("3 pages in one · 59 giveaways") and the pagination numbers have folded away, leaving the site's own total. The two cards left are Extra Odds — at this level the rest is already entered and hidden — with their ⚠×N badge and the ✕ that hides one until it ends. / "Cargar todas las páginas" marcada: las tres páginas del listado de nivel 0 están en esta, el widget lo dice justo debajo de la casilla ("3 pages in one · 59 giveaways") y los números de la paginación se han plegado, dejando el total del propio sitio. Las dos tarjetas que quedan son de Extra Odds —en este nivel el resto ya está participado y oculto— con su badge ⚠×N y la ✕ que oculta una hasta que termine.*

<img src="docs/screenshot-load-every-page-mobile.png" width="375" alt="The same complete listing and status line on a phone-sized viewport">

*The same on a phone: the status line fits under its own checkbox, and at the foot of the listing the folded pagination leaves the site's total on its own. / Lo mismo en un móvil: la línea de estado cabe bajo su propia casilla, y al pie del listado la paginación plegada deja solo el total del sitio.*

![The GG.deals and PCGamingWiki buttons closing the price box on an IndieGala store product page](docs/screenshot-store.png)

*Store product page: GG.deals and PCGamingWiki close the price box, right under Add to Cart, in each brand's colour so they do not pass for another button of the store. Games, DLC and packs all get the same pair. / Ficha de la tienda: GG.deals y PCGamingWiki cierran la caja de precio, justo debajo de Add to Cart, con el color de cada marca para que no se confundan con otro botón de la tienda. Juegos, DLC y packs llevan el mismo par.*

## English

### What it does

**Ticket queue**
- **Unified queue** mixing "Single Ticket" (1 ticket) and "Extra Odds" (N tickets of the same giveaway), bought one after another.
- **Add, remove and reorder** while the queue runs. The order of the list *is* the execution order, so ▲▼ change what gets bought next even mid-run.
- **Queue beyond your balance.** Tickets you cannot afford are flagged with ⏳, skipped during the run and bought once you have GalaSilver — a run no longer dies on the first item you cannot pay for.
- **Two ways in for Extra Odds:** the ⚠×N badge on the listing card — where N is how many tickets your balance covers — and a **Bulk JOIN** button on the giveaway's own page. Either one asks how many tickets and gives you two exits: **Queue** (park them) or **Queue & run**. Capped at 50 tickets per giveaway.
- **Humanized pacing:** 2.5–5 s between tickets and a 10–20 s pause every 10, on a **Web Worker timer** so those pauses are not stretched when the tab sits in the background.
- Stops on its own when the server pushes back (rate limit, ban, no answer) and offers **Continue** when the cause is recoverable. The queue survives reloads.
- Clicking a card **title** queues it instead of opening the giveaway, so a stray click does not navigate away.
- The panel lives on the `/giveaways` listing: it hides on other pages but the queue is kept. Panel and widget can both be minimized, and they remember.

**GalaSilver widget**
- Live balance, read from Indiegala's own responses, plus what is left after the queue — or how much you are **missing** for all of it.
- Shows your GalaCredit as well. Minimizable, and it remembers.
- **Warns you at the 240 iS cap.** That is the most you can hold at once, so sitting there is accrual thrown away; the tooltip spells out the rate Indiegala documents (10 iS per hour, 240 a day).

**Prizes (your library)**
- **Check prizes** opens your library in a new tab and walks it for you: Giveaways → Completed to check → Check all → Completed won. If there is nothing to check it says so and goes on to the won list anyway.
- Announces prizes that ended **today** in its own in-page widget with links, plus a beep and a tab-title badge — once per prize, remembered so it never nags twice.

**Wheel of Fortune**
- Watches the wheel entry in the user menu and **reloads `/giveaways` every 15 minutes** while the queue is idle, so a change of state does not slip by; when it changes, it alerts you.
- After a spin it reads the prize, tells you which one, and reloads **when you close the popup** — not on a timer — so your balance and the menu are up to date without cutting your reading short. It never reloads while the queue is running or a dialog is open.

**Listing options**
- **Remember search filters:** sort, level filter, search text and page, re-applied on load.
- **Load every page:** pulls the rest of the listing's pages into the one you are on, keeping the sort order and level filter you have set. The cards arrive whole, so the queue, the **⚠×N** badge and the **✕** work the same on them. While the box is ticked it happens on its own on every page load — one request per page, spaced out, to Indiegala with your existing session, exactly the request its pagination makes when you click it — and it fetches nothing while there is a wheel to spin, while the queue is running, or over search results (Indiegala already returns all of those in a single response). Once everything is in, the pagination numbers fold away and the total ("132 items") stays — if the load stopped halfway they stay put, which is exactly when they are useful. While it is ticked, "Remember search filters" stops re-applying the saved page: with everything loaded it means nothing.
- **Hide giveaways you already entered** (remembered across reloads).
- **Hide a giveaway by hand:** the **✕** on each card (opposite corner to that card's own control) hides it, in your browser only. **"Show the ones I hid"** brings them back dimmed so you can restore one with **↺**, and **"Clear hidden (N)"** empties the whole list.
- **The hidden list cleans itself up.** Each entry drops off when its giveaway ends — worked out from the card's own "N days left" — so you never have to empty it by hand to keep it from growing.
- **Script language:** Spanish, English or Auto.
- **"Learn more"** button with a summary inside the page.
- Layout adapted to phones.

**Store pages** (`/store/game/*`, `/store/product/*` — games, DLC and packs alike)
- **[GG.deals](https://gg.deals/)** — where else that game is on sale, and for how much. It searches the **catalogue** by title (`/games/`), the same target the Humble Bundle script uses, so you land on the game's own page with its history and every offer.
- **[PCGamingWiki](https://www.pcgamingwiki.com/)** — compatibility, fixes, ultrawide and frame-rate notes. It searches without the edition suffix and, on a DLC, by the base game the page itself declares — the wiki documents DLC inside the game and has no page of its own for them.
- **Both are name searches, so they can miss**, and each says exactly that in its tooltip.
- **Every tooltip the script draws is its own**, not the browser's little grey box: same palette as the widgets, wide enough for the long ones and readable over the page. It covers the GalaSilver widget, the queue panel and these two buttons — Indiegala has no tooltip of its own to borrow, and these are the script's own controls. The browser tooltip stays underneath as the fallback, so nothing is lost if it cannot be drawn.
- **No DRM filter, on purpose.** Steam, GOG, Epic and Microsoft Store are single-DRM shops, so their scripts can pin GG.deals' DRM filter and always be right. IndieGala resells keys for several stores *and* sells DRM-free games, so there is no filter that is correct for the whole store — and the catalogue search ignores that parameter anyway.
- **The title comes from the page's own purchase button**, the cleanest source: the `<h1>` drags the delivery suffix along (`DOOM VFR *Steam Key*`) and sometimes the destination store in brackets (`Sid Meier's Civilization VI (Epic)`), and neither belongs in a search. Accents are dropped for GG.deals, which transliterates in its index, and kept for PCGamingWiki.
- Nothing else from this script runs on the store: no queue, no automation, no warnings. Just two links under *Add to Cart*.

**Language:** automatic Spanish / English detection (with manual override).

**Install:**
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the installer: [indiegala-bulk-join.user.js](https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sites:** `indiegala.com/giveaways`, `indiegala.com/library`, `indiegala.com/store/game/*` and `indiegala.com/store/product/*`

## Español

### Qué hace

**Cola de boletos**
- **Cola unificada** que mezcla "Single Ticket" (1 boleto) y "Extra Odds" (N boletos del mismo giveaway), comprados uno tras otro.
- **Añadir, quitar y reordenar** mientras la cola corre. El orden de la lista *es* el orden de ejecución, así que los ▲▼ cambian qué se compra a continuación incluso a mitad de corrida.
- **Encolar aunque no te alcance el saldo.** Los boletos que no puedes pagar se marcan con ⏳, se saltan durante la corrida y se compran cuando tengas GalaSilver — una corrida ya no muere en el primer ítem que no alcanza.
- **Dos vías de entrada para Extra Odds:** el badge ⚠×N en la tarjeta del listado —donde N es cuántos boletos cubre tu saldo— y un botón **Bulk JOIN** en la página propia del giveaway. Cualquiera de los dos pregunta cuántos boletos y da dos salidas: **Encolar** (dejarlos esperando) o **Encolar y ejecutar**. Topado a 50 boletos por giveaway.
- **Ritmo humanizado:** 2.5–5 s entre boletos y una pausa de 10–20 s cada 10, sobre un **temporizador en Web Worker** para que esas pausas no se estiren con la pestaña en segundo plano.
- Se detiene solo cuando el servidor protesta (límite de ritmo, baneo, sin respuesta) y ofrece **Continuar** si la causa es recuperable. La cola sobrevive a las recargas.
- Al hacer clic en el **título** de una tarjeta se encola en vez de abrir el giveaway, para que un clic despistado no te saque de la página.
- El panel vive en el listado de `/giveaways`: se oculta en otras páginas pero la cola se conserva. Panel y widget se pueden minimizar, y lo recuerdan.

**Widget de GalaSilver**
- Saldo en vivo, leído de las propias respuestas de Indiegala, más lo que queda descontando la cola — o cuánto te **falta** para toda ella.
- Muestra también tu GalaCredit. Minimizable, y lo recuerda.
- **Avisa al llegar al tope de 240 iS.** Es lo máximo que puedes tener a la vez, así que quedarse ahí es acumulación tirada; el tooltip detalla el ritmo que documenta Indiegala (10 iS por hora, 240 al día).

**Premios (tu biblioteca)**
- **Revisar premios** abre tu biblioteca en otra pestaña y la recorre por ti: Giveaways → Completed to check → Check all → Completed won. Si no hay nada por revisar lo dice y pasa igualmente a la lista de ganados.
- Anuncia los premios terminados **hoy** en su propio widget dentro de la página, con enlaces, un beep y un contador en el título de la pestaña — una sola vez por premio, recordado para no repetirse.

**Wheel of Fortune**
- Vigila la entrada de la ruleta en el menú de usuario y **recarga `/giveaways` cada 15 minutos** mientras la cola está parada, para que un cambio de estado no se te pase; cuando cambia, te avisa.
- Tras un giro lee el premio, te dice cuál es, y recarga **al cerrar tú el popup** —no por temporizador— para que el saldo y el menú queden al día sin cortarte la lectura. Nunca recarga con la cola corriendo ni con un diálogo abierto.

**Opciones del listado**
- **Recordar filtros de búsqueda:** orden, filtro de nivel, texto y página, reaplicados al cargar.
- **Cargar todas las páginas:** trae a la que estás viendo el resto de las páginas del listado, con el orden y el filtro de nivel que tengas puestos. Las tarjetas llegan enteras, así que la cola, el badge **⚠×N** y la **✕** funcionan igual en ellas. Con la casilla puesta se hace solo en cada carga de la página —una petición por página, con pausa, a Indiegala y con tu sesión de siempre, exactamente la petición que hace su paginación al pulsarla— y no pide nada mientras haya ruleta por girar, mientras corra la cola, ni sobre resultados de búsqueda (esos Indiegala ya los devuelve todos en una sola respuesta). Cuando ya está todo dentro, los números de la paginación se pliegan y el total ("132 items") se queda —si la carga se paró a medias siguen ahí, que es justo cuando sirven—. Mientras está marcada, "Recordar filtros de búsqueda" deja de reaplicar la página guardada: con todas cargadas no significa nada.
- **Ocultar los giveaways en los que ya tienes boleto** (se recuerda al recargar).
- **Ocultar un giveaway a mano:** la **✕** de cada tarjeta (en la esquina opuesta al control propio de esa tarjeta) lo oculta, solo en tu navegador. **"Mostrar ocultos por mí"** los devuelve atenuados para restaurar uno con **↺**, y **"Limpiar ocultos (N)"** vacía la lista entera.
- **La lista de ocultos se limpia sola.** Cada oculto se va cuando termina su giveaway —calculado con el "N days left" de la propia tarjeta—, así que no hace falta vaciarla a mano para que no engorde.
- **Idioma del script:** español, inglés o Auto.
- Botón **"Saber más"** con un resumen dentro de la página.
- Layout adaptado a móviles.

**Fichas de la tienda** (`/store/game/*`, `/store/product/*` — juegos, DLC y packs por igual)
- **[GG.deals](https://gg.deals/)** —en qué otras tiendas está de oferta ese juego, y a cuánto—. Busca por título en el **catálogo** (`/games/`), el mismo destino que usa el script de Humble Bundle, así que caes en la ficha del juego con su histórico y todas sus ofertas.
- **[PCGamingWiki](https://www.pcgamingwiki.com/)** —compatibilidad, arreglos, ultrapanorámico y notas de frame rate—. Busca sin el sufijo de edición y, en un DLC, por el juego base que la propia ficha declara: la wiki documenta los DLC dentro del juego y no tiene página propia para ellos.
- **Los dos buscan por nombre, así que pueden no acertar**, y cada uno lo dice tal cual en su tooltip.
- **Todos los tooltips que dibuja el script son suyos**, no la cajita gris del navegador: la paleta de los widgets, ancho suficiente para los largos y legibles sobre la página. Cubre el widget de GalaSilver, el panel de la cola y estos dos botones —Indiegala no tiene tooltip propio que tomar prestado, y estos controles son del script—. El del navegador se queda debajo como respaldo, así que no se pierde nada si no se pudiera dibujar.
- **Sin filtro de DRM, a propósito.** Steam, GOG, Epic y Microsoft Store son tiendas de un solo DRM, así que sus scripts pueden fijar el filtro de GG.deals y acertar siempre. IndieGala revende llaves de varias tiendas *y* vende juegos sin DRM, así que no hay un filtro correcto para toda la tienda —y la búsqueda del catálogo ignora ese parámetro de todas formas—.
- **El título sale del propio botón de compra de la página**, que es la fuente más limpia: el `<h1>` arrastra el sufijo de entrega (`DOOM VFR *Steam Key*`) y a veces la tienda de destino entre paréntesis (`Sid Meier's Civilization VI (Epic)`), y ninguna de las dos cosas pinta nada en una búsqueda. Los acentos se quitan para GG.deals, que translitera en su índice, y se conservan para PCGamingWiki.
- En la tienda no corre nada más del script: ni cola, ni automatización, ni advertencias. Solo dos enlaces bajo *Add to Cart*.

**Idioma:** detección automática español / inglés (con override manual).

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [indiegala-bulk-join.user.js](https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitios:** `indiegala.com/giveaways`, `indiegala.com/library`, `indiegala.com/store/game/*` e `indiegala.com/store/product/*`

## Privacy / Privacidad

**EN:** the script makes almost no requests of its own — it automates clicks on the site's own buttons, so the requests that go out are Indiegala's with your existing session, and the library button just opens `indiegala.com/library` in a new tab. Two exceptions, both listed here rather than buried: **"Load every page"**, if you tick it, asks `indiegala.com` for the listing's remaining pages — one GET per page, spaced out, with your existing session, exactly the request its pagination makes when you click it; and the GG.deals favicon on store product pages, so that site sees a plain image request when the buttons are drawn — nothing about which game you are looking at (the PCGamingWiki logo is inline SVG and requests nothing). The GalaSilver balance and giveaway states are read from the page. It stores in your browser (`localStorage` on `indiegala.com` and the userscript manager's storage) only the pending queue, your settings and budget, the prizes it has already notified you about, and your language preference. Nothing is sent to third parties or to the author. Beyond privacy, keep the warning above in mind: automating violates Indiegala's anti-spam policy and synthetic clicks are detectable by the site.

**ES:** el script casi no hace peticiones propias: automatiza clics sobre los botones del propio sitio, así que las peticiones que salen son las de Indiegala con tu sesión de siempre, y el botón de biblioteca solo abre `indiegala.com/library` en otra pestaña. Hay dos excepciones, y van aquí en vez de escondidas: **"Cargar todas las páginas"**, si la marcas, pide a `indiegala.com` las páginas que faltan del listado —un GET por página, con pausa, con tu sesión de siempre, exactamente la petición que hace su paginación al pulsarla—; y el favicon de GG.deals en las fichas de la tienda, con lo que ese sitio ve una petición de imagen corriente al dibujarse los botones —nada sobre qué juego estás viendo— (el logo de PCGamingWiki es SVG en línea y no pide nada). El saldo GalaSilver y el estado de los giveaways se leen de la página. Guarda en tu navegador (`localStorage` de `indiegala.com` y el almacenamiento del gestor de userscripts) solo la cola pendiente, tus ajustes y presupuesto, los premios de los que ya te avisó y tu preferencia de idioma. No se envía nada a terceros ni al autor. Aparte de la privacidad, recuerda el aviso de arriba: automatizar viola la política anti-spam de Indiegala y los clics sintéticos son detectables por el sitio.

## Support / Apoyar

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

---
Author / Autor: **g31w0fw0rld** · License / Licencia: **MIT**
