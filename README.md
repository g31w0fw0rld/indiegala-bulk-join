# Indiegala Giveaway Bulk Tools

Userscript de Tampermonkey que añade una cola unificada de compra de boletos y utilidades a los giveaways de Indiegala. / Tampermonkey userscript that adds a unified ticket-purchase queue and utilities to Indiegala giveaways.

> ⚠️ **USO BAJO TU PROPIO RIESGO / USE AT YOUR OWN RISK:** automatizar compras viola la política anti-spam de Indiegala y puede causar un baneo permanente. / Automating purchases violates Indiegala's anti-spam policy and may cause a permanent ban.

## Español

**Qué hace:**
- **Cola unificada** que mezcla "Single Ticket" (1 boleto) y "Extra Odds" (N boletos del mismo giveaway) ejecutados en secuencia.
- Permite añadir/quitar/reordenar ítems mientras la cola corre (▲▼ por fila, el orden es el de ejecución) y **encolar aunque no te alcance el saldo**: los boletos sin GalaSilver se marcan con ⏳, se saltan durante la corrida y se compran cuando tengas saldo.
- Usa un **temporizador en Web Worker** para que las pausas no se inflen con la pestaña en segundo plano; delays humanizados y control de aborto (botón Continuar tras parar).
- **Widget de saldo GalaSilver** con botón para abrir tu biblioteca y **revisar automáticamente** los giveaways completados (Check all) y avisarte de premios ganados hoy.
- Opciones: ocultar los ya participados, recordar filtros de búsqueda y **selector de idioma del script** (es/en/Auto), más botón **"Saber más"**.

**Idioma:** detección automática español / inglés (con override manual).

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [indiegala-bulk-join.user.js](https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitios:** `indiegala.com/giveaways`, `indiegala.com/library`

## English

**What it does:**
- **Unified queue** mixing "Single Ticket" (1 ticket) and "Extra Odds" (N tickets of the same giveaway) run in sequence.
- Lets you add/remove/reorder items while the queue runs (▲▼ per row; order is execution order) and **queue beyond your balance**: tickets you cannot afford are flagged with ⏳, skipped during the run and bought once you have GalaSilver.
- Uses a **Web Worker timer** so pauses do not inflate when the tab is backgrounded; humanized delays and abort control (Continue button after stopping).
- **GalaSilver balance widget** with a button to open your library and **automatically check** completed giveaways (Check all) and notify you of prizes won today.
- Options: hide already-entered giveaways, remember search filters and a **script language selector** (es/en/Auto), plus a **"Learn more"** button.

**Language:** automatic Spanish / English detection (with manual override).

**Install:**
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the installer: [indiegala-bulk-join.user.js](https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sites:** `indiegala.com/giveaways`, `indiegala.com/library`

## Privacidad / Privacy

**ES:** el script no hace ninguna petición propia ni a Indiegala ni a terceros: automatiza clics sobre los botones del propio sitio, así que las peticiones que salen son las de Indiegala con tu sesión de siempre, y el botón de biblioteca solo abre `indiegala.com/library` en otra pestaña. El saldo GalaSilver y el estado de los giveaways se leen de la página. Guarda en tu navegador (`localStorage` de `indiegala.com` y el almacenamiento del gestor de userscripts) solo la cola pendiente, tus ajustes y presupuesto, los premios de los que ya te avisó y tu preferencia de idioma. No se envía nada a terceros ni al autor. Aparte de la privacidad, recuerda el aviso de arriba: automatizar viola la política anti-spam de Indiegala y los clics sintéticos son detectables por el sitio.

**EN:** the script makes no requests of its own, neither to Indiegala nor to third parties: it automates clicks on the site's own buttons, so the requests that go out are Indiegala's with your existing session, and the library button just opens `indiegala.com/library` in a new tab. The GalaSilver balance and giveaway states are read from the page. It stores in your browser (`localStorage` on `indiegala.com` and the userscript manager's storage) only the pending queue, your settings and budget, the prizes it has already notified you about, and your language preference. Nothing is sent to third parties or to the author. Beyond privacy, keep the warning above in mind: automating violates Indiegala's anti-spam policy and synthetic clicks are detectable by the site.

## Apoyar / Support

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

---
Autor / Author: **g31w0fw0rld** · Licencia / License: **MIT**
