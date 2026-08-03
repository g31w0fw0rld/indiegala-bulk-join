# Indiegala Giveaway Bulk Tools

Tampermonkey userscript that adds a unified ticket-purchase queue and utilities to Indiegala giveaways. / Userscript de Tampermonkey que añade una cola unificada de compra de boletos y utilidades a los giveaways de Indiegala.

> [!WARNING]
> **USE AT YOUR OWN RISK / USO BAJO TU PROPIO RIESGO:** automating purchases violates Indiegala's anti-spam policy and may cause a permanent ban. / Automatizar compras viola la política anti-spam de Indiegala y puede causar un baneo permanente.

![The queue panel, the GalaSilver widget and the buttons the script injects on indiegala.com/giveaways](docs/screenshot-giveaways.png)

*Queue panel (bottom left), GalaSilver widget (top right) and the buttons injected on each card: ＋ to queue a Single Ticket, ✓ when already queued, ✕ in the opposite corner to hide that giveaway for good, and ⚠×N on Extra Odds cards. Queued tickets you cannot afford yet are flagged with ⏳. / Panel de la cola (abajo a la izquierda), widget de GalaSilver (arriba a la derecha) y los botones que se inyectan en cada card: ＋ para encolar un Single Ticket, ✓ si ya está en cola, ✕ en la esquina opuesta para ocultar ese giveaway para siempre, y ⚠×N en las tarjetas de Extra Odds. Los boletos encolados que aún no te alcanzan se marcan con ⏳.*

<img src="docs/screenshot-giveaways-mobile.png" width="375" alt="The same queue and balance widget on a phone-sized viewport">

*Same queue on a phone: the panel goes full width along the bottom, the widget clears the site header, and every row keeps its ▲▼ reorder controls. / La misma cola en un móvil: el panel pasa a ancho completo abajo, el widget se aparta del header del sitio y cada fila conserva sus controles ▲▼ para reordenar.*

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

**Prizes (your library)**
- **Check prizes** opens your library in a new tab and walks it for you: Giveaways → Completed to check → Check all → Completed won. If there is nothing to check it says so and goes on to the won list anyway.
- Announces prizes that ended **today** in its own in-page widget with links, plus a beep and a tab-title badge — once per prize, remembered so it never nags twice.

**Wheel of Fortune**
- Watches the wheel entry in the user menu and **reloads `/giveaways` every 15 minutes** while the queue is idle, so a change of state does not slip by; when it changes, it alerts you.
- After a spin it reads the prize, tells you which one, and reloads **when you close the popup** — not on a timer — so your balance and the menu are up to date without cutting your reading short. It never reloads while the queue is running or a dialog is open.

**Listing options**
- **Remember search filters:** sort, level filter, search text and page, re-applied on load.
- **Hide giveaways you already entered** (remembered across reloads).
- **Hide a giveaway by hand:** the **✕** on each card (opposite corner to that card's own control) hides it for good, in your browser only. **"Show the ones I hid"** brings them back dimmed so you can restore one with **↺**, and **"Clear hidden (N)"** empties the whole list.
- **Script language:** Spanish, English or Auto.
- **"Learn more"** button with a summary inside the page.
- Layout adapted to phones.

**Language:** automatic Spanish / English detection (with manual override).

**Install:**
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the installer: [indiegala-bulk-join.user.js](https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sites:** `indiegala.com/giveaways`, `indiegala.com/library`

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

**Premios (tu biblioteca)**
- **Revisar premios** abre tu biblioteca en otra pestaña y la recorre por ti: Giveaways → Completed to check → Check all → Completed won. Si no hay nada por revisar lo dice y pasa igualmente a la lista de ganados.
- Anuncia los premios terminados **hoy** en su propio widget dentro de la página, con enlaces, un beep y un contador en el título de la pestaña — una sola vez por premio, recordado para no repetirse.

**Wheel of Fortune**
- Vigila la entrada de la ruleta en el menú de usuario y **recarga `/giveaways` cada 15 minutos** mientras la cola está parada, para que un cambio de estado no se te pase; cuando cambia, te avisa.
- Tras un giro lee el premio, te dice cuál es, y recarga **al cerrar tú el popup** —no por temporizador— para que el saldo y el menú queden al día sin cortarte la lectura. Nunca recarga con la cola corriendo ni con un diálogo abierto.

**Opciones del listado**
- **Recordar filtros de búsqueda:** orden, filtro de nivel, texto y página, reaplicados al cargar.
- **Ocultar los giveaways en los que ya tienes boleto** (se recuerda al recargar).
- **Ocultar un giveaway a mano:** la **✕** de cada tarjeta (en la esquina opuesta al control propio de esa tarjeta) lo oculta para siempre, solo en tu navegador. **"Mostrar ocultos por mí"** los devuelve atenuados para restaurar uno con **↺**, y **"Limpiar ocultos (N)"** vacía la lista entera.
- **Idioma del script:** español, inglés o Auto.
- Botón **"Saber más"** con un resumen dentro de la página.
- Layout adaptado a móviles.

**Idioma:** detección automática español / inglés (con override manual).

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [indiegala-bulk-join.user.js](https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitios:** `indiegala.com/giveaways`, `indiegala.com/library`

## Privacy / Privacidad

**EN:** the script makes no requests of its own, neither to Indiegala nor to third parties: it automates clicks on the site's own buttons, so the requests that go out are Indiegala's with your existing session, and the library button just opens `indiegala.com/library` in a new tab. The GalaSilver balance and giveaway states are read from the page. It stores in your browser (`localStorage` on `indiegala.com` and the userscript manager's storage) only the pending queue, your settings and budget, the prizes it has already notified you about, and your language preference. Nothing is sent to third parties or to the author. Beyond privacy, keep the warning above in mind: automating violates Indiegala's anti-spam policy and synthetic clicks are detectable by the site.

**ES:** el script no hace ninguna petición propia ni a Indiegala ni a terceros: automatiza clics sobre los botones del propio sitio, así que las peticiones que salen son las de Indiegala con tu sesión de siempre, y el botón de biblioteca solo abre `indiegala.com/library` en otra pestaña. El saldo GalaSilver y el estado de los giveaways se leen de la página. Guarda en tu navegador (`localStorage` de `indiegala.com` y el almacenamiento del gestor de userscripts) solo la cola pendiente, tus ajustes y presupuesto, los premios de los que ya te avisó y tu preferencia de idioma. No se envía nada a terceros ni al autor. Aparte de la privacidad, recuerda el aviso de arriba: automatizar viola la política anti-spam de Indiegala y los clics sintéticos son detectables por el sitio.

## Support / Apoyar

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

---
Author / Autor: **g31w0fw0rld** · License / Licencia: **MIT**
