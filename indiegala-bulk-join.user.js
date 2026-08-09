// ==UserScript==
// @name         Indiegala Bulk Tools (giveaway ticket queue + store links)
// @namespace    http://tampermonkey.net/
// @version      1.8.0
// @description  Unified ticket queue for Indiegala giveaways, mixing Single Ticket and Extra Odds, bought one after another; add, remove and reorder mid-run, and tickets you cannot afford wait instead of killing the run. GalaSilver widget, prize checking, wheel alerts, remembered filters. On store product pages it adds GG.deals and PCGamingWiki title-search buttons. USE AT YOUR OWN RISK: automating purchases violates Indiegala's policy and may cause a permanent ban.
// @match        https://www.indiegala.com/giveaways
// @match        https://www.indiegala.com/giveaways/*
// @match        https://www.indiegala.com/library
// @match        https://www.indiegala.com/library/*
// @match        https://www.indiegala.com/store/game/*
// @match        https://www.indiegala.com/store/product/*
// @author       g31w0fw0rld
// @license      MIT
// @downloadURL  https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js
// @updateURL    https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// =====================================================================
// ⚠️  ADVERTENCIA / WARNING  ⚠️
// =====================================================================
// Este script AUTOMATIZA acciones en Indiegala:
//   1) Compra masiva de boletos en un solo giveaway "Extra Odds".
//   2) Encolar varios "Single Ticket" desde el listado y dispararlos
//      uno tras otro de forma secuencial ("scheduling").
//
// La politica oficial de Indiegala prohibe EXPLICITAMENTE cualquier
// forma de automatizacion, incluso desde la misma cuenta, y reserva el
// derecho de BANEAR PERMANENTEMENTE las cuentas que la violen.
//
//   Politica:  https://docs.indiegala.com/giveaways_auctions_trades/spam.html
//   Cita:      "The use of any form of automation (including scheduling)
//              to enter giveaways (...) even from the same account is not
//              permitted. We reserve the right to permanently ban any
//              account that violates those rules."
//
// "Encolar y ejecutar" entra textualmente en "scheduling". Los delays
// humanizados, simular clicks o validar el estado del boton NO te
// protegen: la regla es categorica y los clicks sinteticos llevan
// event.isTrusted=false (detectable por el sitio).
//
// El autor no se hace responsable de baneos, perdida de saldo, o
// cualquier consecuencia derivada del uso de este script.
//
// USA ESTE SCRIPT BAJO TU PROPIO RIESGO.
// =====================================================================

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.8.0';
    console.log('[IG-BulkTools] cargado. Version:', SCRIPT_VERSION);
    // La advertencia de automatizacion solo aplica al modulo de giveaways. En la
    // tienda este script no automatiza nada —pone dos enlaces— y avisar ahi de un
    // riesgo de ban seria mentir. isStoreProduct() esta declarada mas abajo con
    // `function`, asi que el hoisting la deja usable aqui.
    if (!isStoreProduct()) console.warn(
        '[IG-BulkTools] ⚠️ ADVERTENCIA: este script automatiza acciones en Indiegala (bulk join + cola).\n' +
        'La politica de Indiegala prohibe cualquier automatizacion (incluso desde la misma cuenta) y\n' +
        'puede resultar en BAN PERMANENTE. Politica: https://docs.indiegala.com/giveaways_auctions_trades/spam.html\n' +
        'Uso bajo tu propio riesgo.'
    );

    // =============================================
    // INTERNACIONALIZACION (i18n)
    // =============================================

    // Auto-deteccion de idioma por el NAVEGADOR: si el usuario tiene espanol en
    // cualquiera de los idiomas de su navegador -> es; si no -> en. Indiegala fija
    // el lang del documento a su propia UI (no refleja la preferencia del usuario),
    // por eso aqui NO se usa document.documentElement.lang.
    function detectLang() {
        const langs = [navigator.language, ...(navigator.languages || [])]
            .filter(Boolean).map((l) => l.toLowerCase());
        return langs.some((l) => l.startsWith('es')) ? 'es' : 'en';
    }
    // Preferencia MANUAL de idioma del script (por encima de la autodetección).
    // 'es' | 'en' | '' (auto). Indiegala no tiene versiones de sitio por idioma,
    // así que esto solo cambia el idioma de ESTE script.
    const LANG_PREF_KEY = 'ig-bulktools-lang';
    function readLangPref() {
        try { const v = localStorage.getItem(LANG_PREF_KEY); return (v === 'es' || v === 'en') ? v : ''; }
        catch (e) { return ''; }
    }
    function saveLangPref(v) {
        try {
            if (v === 'es' || v === 'en') localStorage.setItem(LANG_PREF_KEY, v);
            else localStorage.removeItem(LANG_PREF_KEY);
        } catch (e) { /* almacenamiento no disponible */ }
    }
    const LANG_PREF = readLangPref();
    const LANG = LANG_PREF || detectLang();
    const i18n = {
        es: {
            // Bulk join (Extra Odds)
            bulkLabel: '⚠ Bulk JOIN',
            bulkLabelTooltip: '⚠ Riesgo de ban — la política de Indiegala prohíbe la automatización. Uso bajo tu propio riesgo.',
            bulkBadge: '⚠×{n}',
            bulkBadgeTooltip: '⚠ Riesgo de ban — comprar varios boletos (Extra Odds) automáticamente VIOLA la política de Indiegala y puede banear tu cuenta. Máx {n} con tu saldo.',
            modalEnqueueTitle: 'Encolar boletos (Extra Odds)',
            modalGiveaway: 'Giveaway',
            modalPrice: 'Precio por boleto',
            modalBalance: 'Saldo GalaSilver',
            modalAvailable: 'Disponible (saldo − cola)',
            modalAlreadyQueued: 'Ya en cola',
            modalAffordableNow: 'Alcanzan con tu saldo',
            modalMax: 'Máximo por giveaway',
            modalCountAdd: 'Cantidad a añadir',
            modalTotalCost: 'Costo total',
            modalDelays: 'Espera entre boletos: 2.5–5 s · pausa larga 10–20 s cada 10',
            modalConfirm: 'Iniciar',
            modalEnqueueConfirm: 'Encolar',
            modalEnqueueAndRunConfirm: 'Encolar y ejecutar',
            modalCancel: 'Cancelar',
            invalidCount: 'Cantidad inválida (1 a {max}).',
            enqueueCapped: 'Cantidad recortada a {n} (máximo por giveaway).',
            enqueuedAddedRunning: '{n} boletos añadidos a la cola en curso.',
            // Cola (Single Ticket)
            queueAddBtn: '＋',
            queueAddBtnTooltip: '⚠ Riesgo de ban — añadir este giveaway a la cola para entrar automáticamente. Uso bajo tu propio riesgo.',
            queueRemoveBtn: '✓',
            queueRemoveBtnTooltip: 'En cola — clic para quitar',
            ignoreBtn: '✕',
            ignoreBtnTooltip: 'No mostrarme más este giveaway. Solo afecta a lo que ves: no entra en la cola ni cambia nada en Indiegala. Reversible desde el widget.',
            ignoreUndoBtn: '↺',
            ignoreUndoBtnTooltip: 'Oculto por ti — clic para volver a mostrarlo',
            queueMoveUp: 'Subir — se intentará antes',
            queueMoveDown: 'Bajar — se intentará después',
            queueWaitsForBalance: 'Sin saldo ahora — queda en cola y se compra cuando tengas GalaSilver',
            queuePanelTitle: '⚠ Cola Single Ticket',
            queueTotalCost: '{n} boletos · {cost} iS',
            queueExecuteBtn: '▶ Ejecutar',
            queueClearBtn: '🗑 Vaciar',
            queueClearConfirm: '¿Vaciar toda la cola?',
            queueExecuteConfirmTitle: '⚠️ Confirmar ejecución de cola',
            queueLowBalance: 'Tu saldo ({balance} iS) es menor al costo total ({cost} iS). Los boletos que no alcancen se saltarán y quedarán en cola. ¿Continuar de todas formas?',
            queueProgressItem: '{title} ({i}/{n})',
            queueDone: 'Listo. {ok} de {n} entradas exitosas.',
            queueDoneSkipped: 'Listo. {ok} de {n} exitosas · {w} sin saldo suficiente.',
            queueItemNoFunds: 'Sin saldo para este boleto — se salta hasta que tengas GalaSilver',
            queueModalCount: 'Boletos en cola',
            // Compartido
            warningTitle: '⚠️ RIESGO DE BAN PERMANENTE',
            warningBody: 'La política de Indiegala prohíbe explícitamente cualquier forma de automatización para participar en giveaways, incluso desde la misma cuenta. Indiegala se reserva el derecho de banear permanentemente las cuentas que la violen. Usar este script bajo tu propio riesgo.',
            warningPolicyLink: 'Ver política oficial →',
            warningProgress: '⚠ Automatización en curso — riesgo de ban',
            // Dos contextos con verdades distintas: la cabecera del panel se ve
            // siempre (aunque no haya nada corriendo) y el overlay solo durante
            // una corrida. Compartir una cadena obligaba a que una de las dos
            // mintiera.
            warningQueuePanel: '⚠ Cola con automatización — riesgo de ban',
            warningProgressQueue: '⚠ Cola con automatización en curso — riesgo de ban',
            balanceUnknown: 'No pude leer tu saldo de GalaSilver. Abre el menú de usuario una vez (clic en tu avatar) y vuelve a intentarlo.',
            alreadyRunning: 'Ya hay una operación masiva en curso.',
            progressTitle: 'Compra masiva en curso',
            progressTitleQueue: 'Ejecutando cola',
            progressStatus: 'Boleto {i} de {n}',
            progressLongPause: 'Pausa larga…',
            progressErrorDetected: 'Error detectado. Deteniendo.',
            progressTriggerLost: 'No encuentro el botón JOIN. Deteniendo.',
            progressBalanceLow: 'Saldo bajó por debajo del precio. Deteniendo.',
            progressTooFast: 'El servidor pidió bajar el ritmo (too_fast). Deteniendo.',
            progressBanned: 'Cuenta baneada según el servidor. Deteniendo.',
            progressJoinTimeout: 'Sin respuesta del servidor para el join. Deteniendo.',
            progressAborted: 'Detenido por el usuario.',
            progressDone: 'Listo. {ok} boletos comprados.',
            stopBtn: 'Detener',
            closeBtn: 'Cerrar',
            continueBtn: 'Continuar',
            continueTooFastWarning: 'El servidor pidió bajar el ritmo (too_fast). Continuar ahora puede aumentar el riesgo de ban. ¿Estás seguro?',
            // Widget de saldo + revisar premios (biblioteca)
            widgetTitle: 'GalaSilver',
            widgetGalaCredit: 'GalaCredit: {v}',
            widgetAvailable: 'Disponible (− cola): {n} iS',
            widgetShortfall: 'Faltan {n} iS para toda la cola',
            widgetCheckBtn: '🎁 Revisar premios',
            widgetCheckBtnTooltip: 'Abre tu biblioteca en una pestaña nueva y revisa automáticamente los giveaways completados por ganar (Check all).',
            widgetBalanceUnknown: '— iS',
            widgetHideEntered: 'Ocultar ya participados',
            widgetHideEnteredTooltip: 'Oculta del listado los giveaways en los que ya tienes boleto. Se recuerda al recargar hasta que lo desmarques.',
            widgetShowIgnored: 'Mostrar ocultos por mí',
            widgetShowIgnoredTooltip: 'Vuelve a mostrar (atenuados y con marco rojo) los giveaways que ocultaste con ✕, para poder sacarlos de la lista con el botón ↺. No los desoculta de forma permanente.',
            widgetClearIgnored: '🧹 Limpiar ocultos ({n})',
            widgetClearIgnoredTooltip: 'Vacía la lista de giveaways que ocultaste con ✕: todos vuelven a aparecer. No se puede deshacer.',
            clearIgnoredConfirm: '¿Volver a mostrar los {n} giveaways que ocultaste? No se puede deshacer.',
            clearIgnoredDone: 'Lista de ocultos vaciada ({n}).',
            widgetRememberFilters: 'Recordar filtros de búsqueda',
            widgetRememberFiltersTooltip: 'Guarda el orden, el filtro de nivel, el texto de búsqueda y la página actual, y los re-aplica al recargar. Se sobrescriben cuando los cambias. Si la página guardada ya no existe, vuelve a la 1.',
            widgetMinimize: 'Minimizar widget',
            widgetRestore: 'Restaurar widget',
            queueMinimize: 'Minimizar cola',
            queueRestore: 'Restaurar cola',
            libAutoStart: 'Abriendo biblioteca y revisando premios…',
            libClickGiveaways: 'Abriendo pestaña Giveaways…',
            libClickCompleted: 'Abriendo "Completed to check"…',
            libClickCheckAll: 'Revisando todos los giveaways (Check all)…',
            libClickWon: 'Abriendo "Completed won"…',
            libNothingToCheck: 'Nada por revisar: "Completed to check" está vacío.',
            libCheckingWon: 'Revisando premios ganados…',
            libNoNewWins: 'Sin premios nuevos hoy.',
            libWonStatus: '🎉 ¡Ganaste {n} premio(s) hoy!',
            winWidgetTitle: '🎉 ¡Premios ganados hoy! ({n})',
            libElementNotFound: 'No encontré un elemento de la biblioteca a tiempo. Revísalo manualmente.',
            wheelAvailableAlert: '🎡 ¡La Wheel of Fortune cambió de estado (puede estar disponible para girar)! Atiéndela ahora para que no se te pase.',
            wheelSpinWon: '🎡 Ruleta: ganaste {prize}',
            wheelPrizeAfterReload: '🎡 Ruleta: ganaste {prize} · saldo actualizado',
            wheelReloadNotice: '🎡 Ganaste {prize} · al cerrar se recarga para actualizar tu saldo',
            // Tienda (fichas de /store/game y /store/product)
            storeGgTip: 'Busca el título en el catálogo de GG.deals, sin filtro de tienda ni de DRM. Al buscar por nombre, puede no dar con el juego exacto.',
            storePcgwTip: 'Busca el título en PCGamingWiki (compatibilidad y arreglos). Al buscar por nombre, puede no dar con el artículo exacto.'
        },
        en: {
            // Bulk join (Extra Odds)
            bulkLabel: '⚠ Bulk JOIN',
            bulkLabelTooltip: '⚠ Ban risk — Indiegala policy forbids automation. Use at your own risk.',
            bulkBadge: '⚠×{n}',
            bulkBadgeTooltip: '⚠ Ban risk — buying multiple tickets (Extra Odds) automatically VIOLATES Indiegala policy and may ban your account. Max {n} with your balance.',
            modalEnqueueTitle: 'Queue tickets (Extra Odds)',
            modalGiveaway: 'Giveaway',
            modalPrice: 'Price per ticket',
            modalBalance: 'GalaSilver balance',
            modalAvailable: 'Available (balance − queue)',
            modalAlreadyQueued: 'Already queued',
            modalAffordableNow: 'Affordable with your balance',
            modalMax: 'Max per giveaway',
            modalCountAdd: 'Tickets to add',
            modalTotalCost: 'Total cost',
            modalDelays: 'Wait between tickets: 2.5–5 s · long pause 10–20 s every 10',
            modalConfirm: 'Start',
            modalEnqueueConfirm: 'Queue',
            modalEnqueueAndRunConfirm: 'Queue & run',
            modalCancel: 'Cancel',
            invalidCount: 'Invalid amount (1 to {max}).',
            enqueueCapped: 'Capped to {n} (max per giveaway).',
            enqueuedAddedRunning: '{n} tickets added to the running queue.',
            // Queue (Single Ticket)
            queueAddBtn: '＋',
            queueAddBtnTooltip: '⚠ Ban risk — add this giveaway to the queue for automatic entry. Use at your own risk.',
            queueRemoveBtn: '✓',
            queueRemoveBtnTooltip: 'In queue — click to remove',
            ignoreBtn: '✕',
            ignoreBtnTooltip: 'Do not show me this giveaway again. It only affects what you see: it is not queued and nothing changes on Indiegala. Reversible from the widget.',
            ignoreUndoBtn: '↺',
            ignoreUndoBtnTooltip: 'Hidden by you — click to show it again',
            queueMoveUp: 'Move up — tried sooner',
            queueMoveDown: 'Move down — tried later',
            queueWaitsForBalance: 'No balance right now — it stays queued and is bought once you have GalaSilver',
            queuePanelTitle: '⚠ Single Ticket Queue',
            queueTotalCost: '{n} tickets · {cost} iS',
            queueExecuteBtn: '▶ Execute',
            queueClearBtn: '🗑 Clear',
            queueClearConfirm: 'Clear the entire queue?',
            queueExecuteConfirmTitle: '⚠️ Confirm queue execution',
            queueLowBalance: 'Your balance ({balance} iS) is lower than total cost ({cost} iS). Tickets you cannot afford are skipped and stay queued. Continue anyway?',
            queueProgressItem: '{title} ({i}/{n})',
            queueDone: 'Done. {ok} of {n} entries successful.',
            queueDoneSkipped: 'Done. {ok} of {n} successful · {w} lack balance.',
            queueItemNoFunds: 'Not enough balance for this ticket — skipped until you have GalaSilver',
            queueModalCount: 'Tickets queued',
            // Shared
            warningTitle: '⚠️ PERMANENT BAN RISK',
            warningBody: 'Indiegala policy explicitly forbids any form of automation to enter giveaways, even from the same account. Indiegala reserves the right to permanently ban accounts that violate it. Use this script at your own risk.',
            warningPolicyLink: 'See official policy →',
            warningProgress: '⚠ Automation running — ban risk',
            warningQueuePanel: '⚠ Automated queue — ban risk',
            warningProgressQueue: '⚠ Automated queue running — ban risk',
            balanceUnknown: 'Could not read your GalaSilver balance. Open the user menu once (click your avatar) and try again.',
            alreadyRunning: 'A bulk operation is already running.',
            progressTitle: 'Bulk purchase in progress',
            progressTitleQueue: 'Executing queue',
            progressStatus: 'Ticket {i} of {n}',
            progressLongPause: 'Long pause…',
            progressErrorDetected: 'Error detected. Stopping.',
            progressTriggerLost: 'JOIN button not found. Stopping.',
            progressBalanceLow: 'Balance dropped below price. Stopping.',
            progressTooFast: 'Server rate-limited (too_fast). Stopping.',
            progressBanned: 'Account banned per server. Stopping.',
            progressJoinTimeout: 'No response from server for join. Stopping.',
            progressAborted: 'Stopped by user.',
            progressDone: 'Done. {ok} tickets bought.',
            stopBtn: 'Stop',
            closeBtn: 'Close',
            continueBtn: 'Continue',
            continueTooFastWarning: 'Server rate-limited (too_fast). Continuing now may increase ban risk. Are you sure?',
            // Balance widget + check prizes (library)
            widgetTitle: 'GalaSilver',
            widgetGalaCredit: 'GalaCredit: {v}',
            widgetAvailable: 'Available (− queue): {n} iS',
            widgetShortfall: 'Missing {n} iS for the whole queue',
            widgetCheckBtn: '🎁 Check prizes',
            widgetCheckBtnTooltip: 'Opens your library in a new tab and automatically checks completed giveaways to see if you won (Check all).',
            widgetBalanceUnknown: '— iS',
            widgetHideEntered: 'Hide already entered',
            widgetHideEnteredTooltip: 'Hides from the listing the giveaways you already hold a ticket in. Remembered across reloads until you uncheck it.',
            widgetShowIgnored: 'Show the ones I hid',
            widgetShowIgnoredTooltip: 'Brings back (dimmed, with a red frame) the giveaways you hid with ✕, so you can take them off the list with the ↺ button. It does not un-hide them permanently.',
            widgetClearIgnored: '🧹 Clear hidden ({n})',
            widgetClearIgnoredTooltip: 'Empties the list of giveaways you hid with ✕: all of them show up again. Cannot be undone.',
            clearIgnoredConfirm: 'Show the {n} giveaways you hid again? This cannot be undone.',
            clearIgnoredDone: 'Hidden list cleared ({n}).',
            widgetRememberFilters: 'Remember search filters',
            widgetRememberFiltersTooltip: 'Saves the sort order, level filter, search text and current page, and re-applies them on reload. Overwritten whenever you change them. Falls back to page 1 if the saved page no longer exists.',
            widgetMinimize: 'Minimize widget',
            widgetRestore: 'Restore widget',
            queueMinimize: 'Minimize queue',
            queueRestore: 'Restore queue',
            libAutoStart: 'Opening library and checking prizes…',
            libClickGiveaways: 'Opening Giveaways tab…',
            libClickCompleted: 'Opening "Completed to check"…',
            libClickCheckAll: 'Checking all giveaways (Check all)…',
            libClickWon: 'Opening "Completed won"…',
            libNothingToCheck: 'Nothing to check: "Completed to check" is empty.',
            libCheckingWon: 'Checking won prizes…',
            libNoNewWins: 'No new prizes today.',
            libWonStatus: '🎉 You won {n} prize(s) today!',
            winWidgetTitle: '🎉 Prizes won today! ({n})',
            libElementNotFound: 'Could not find a library element in time. Please check manually.',
            wheelAvailableAlert: '🎡 The Wheel of Fortune changed state (it may be available to spin)! Go attend it now so you don\'t miss it.',
            wheelSpinWon: '🎡 Wheel: you won {prize}',
            wheelPrizeAfterReload: '🎡 Wheel: you won {prize} · balance updated',
            wheelReloadNotice: '🎡 You won {prize} · closing it reloads the page to refresh your balance',
            // Store (product pages under /store/game and /store/product)
            storeGgTip: 'Searches the title in the GG.deals catalogue, with no store or DRM filter. Being a title search, it may not hit the exact game.',
            storePcgwTip: 'Searches the title on PCGamingWiki (compatibility and fixes). Being a title search, it may not hit the exact article.'
        }
    };
    const T = i18n[LANG] || i18n.en;
    const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));

    // Textos extra (selector de idioma + "Saber más"). Se mantienen aparte del
    // objeto i18n (enorme) para no tocarlo. TX se resuelve con el mismo LANG.
    const EXTRA_I18N = {
        es: {
            about: 'ℹ️ Saber más', close: 'Cerrar',
            langLabel: 'Idioma del script:', langAuto: 'Auto (navegador)',
            langTip: 'Idioma de ESTE script (no cambia el idioma de Indiegala, que no tiene versiones por idioma). "Auto" usa el idioma de tu navegador. Al cambiarlo se recarga la página.',
            aboutTip: 'Ver qué hace este script en su totalidad.',
            aboutTitle: '¿Qué hace este script?',
            aboutBody: [
                '⚠️ USO BAJO TU PROPIO RIESGO: automatizar compras viola la política anti-spam de Indiegala y puede causar ban permanente.',
                'Este script añade a Indiegala Giveaways una cola unificada de compra de boletos y varias utilidades alrededor, y a las fichas de la tienda dos enlaces de consulta.',
                '▸ Cola de boletos',
                '• Mezcla "Single Ticket" (1 boleto) y "Extra Odds" (N boletos del mismo giveaway) y los compra uno tras otro.',
                '• Añadir, quitar y reordenar mientras corre: el orden de la lista es el orden de ejecución, y los ▲▼ surten efecto a mitad de corrida.',
                '• Puedes encolar aunque no te alcance el saldo: esos boletos se marcan con ⏳, se saltan durante la corrida y se compran cuando tengas GalaSilver.',
                '• Extra Odds se encola desde dos sitios: el badge ⚠×N de la tarjeta (N = cuántos cubre tu saldo) y el botón Bulk JOIN en la página propia del giveaway. Ambos preguntan cuántos boletos y dan dos salidas: Encolar, o Encolar y ejecutar. Tope de 50 por giveaway.',
                '• Ritmo humanizado: 2.5–5 s entre boletos y pausa de 10–20 s cada 10, con temporizador en Web Worker para que no se estiren con la pestaña en segundo plano.',
                '• Se detiene solo si el servidor protesta (ritmo, baneo, sin respuesta) y ofrece Continuar cuando la causa es recuperable. La cola sobrevive a las recargas.',
                '• Al hacer clic en el título de una tarjeta se encola, en vez de abrir el giveaway.',
                '▸ Widget de GalaSilver',
                '• Saldo en vivo leído de las respuestas del sitio, lo que queda descontando la cola, o cuánto falta para toda ella. También muestra tu GalaCredit.',
                '▸ Premios (tu biblioteca)',
                '• "Revisar premios" abre tu biblioteca en otra pestaña y la recorre: Giveaways → Completed to check → Check all → Completed won.',
                '• Anuncia los premios terminados hoy en un widget dentro de la página, con enlaces, beep y contador en el título de la pestaña. Una sola vez por premio.',
                '▸ Wheel of Fortune',
                '• Recarga /giveaways cada 15 min mientras la cola está parada, para avisarte si la ruleta cambia de estado.',
                '• Tras girar te dice el premio y recarga al cerrar tú el popup, para que el saldo quede al día. Nunca recarga con la cola corriendo ni con un diálogo abierto.',
                '▸ Opciones del listado',
                '• Recordar filtros de búsqueda (orden, nivel, texto y página), ocultar los giveaways en los que ya tienes boleto y elegir el idioma del script (es/en/Auto).',
                '• El botón ✕ de cada tarjeta oculta ese giveaway para siempre (solo en tu navegador), en la esquina opuesta al ＋ o al badge ⚠×N. "Mostrar ocultos por mí" los devuelve atenuados para sacarlos de la lista con ↺, y "Limpiar ocultos (N)" la vacía de golpe.',
                '▸ Fichas de la tienda',
                '• En las páginas de producto (juegos, DLC y packs) añade dos botones bajo "Add to Cart": GG.deals busca el título en su catálogo, sin filtro de tienda ni de DRM, y PCGamingWiki lo busca para compatibilidad y arreglos. Los dos buscan por nombre, así que pueden no acertar; cada uno lo dice en su tooltip.',
                '• Ahí no corre nada más del script: ni cola, ni automatización, ni advertencias. Solo los dos enlaces.',
                'Todo se procesa en tu navegador; no se envían datos a terceros.'
            ]
        },
        en: {
            about: 'ℹ️ Learn more', close: 'Close',
            langLabel: 'Script language:', langAuto: 'Auto (browser)',
            langTip: 'Language of THIS script (it does not change Indiegala\'s language, which has no per-language versions). "Auto" uses your browser language. Changing it reloads the page.',
            aboutTip: 'See everything this script does.',
            aboutTitle: 'What does this script do?',
            aboutBody: [
                '⚠️ USE AT YOUR OWN RISK: automating purchases violates Indiegala\'s anti-spam policy and may cause a permanent ban.',
                'This script adds a unified ticket-purchase queue to Indiegala Giveaways, plus a few utilities around it, and two lookup links on store product pages.',
                '▸ Ticket queue',
                '• Mixes "Single Ticket" (1 ticket) and "Extra Odds" (N tickets of the same giveaway) and buys them one after another.',
                '• Add, remove and reorder while it runs: the order of the list is the execution order, and ▲▼ take effect mid-run.',
                '• You can queue beyond your balance: those tickets are flagged with ⏳, skipped during the run and bought once you have GalaSilver.',
                '• Extra Odds can be queued from two places: the ⚠×N badge on the card (N = how many your balance covers) and the Bulk JOIN button on the giveaway\'s own page. Both ask how many tickets and give two exits: Queue, or Queue & run. Capped at 50 per giveaway.',
                '• Humanized pacing: 2.5–5 s between tickets and a 10–20 s pause every 10, on a Web Worker timer so they are not stretched when the tab is in the background.',
                '• Stops on its own if the server pushes back (rate limit, ban, no answer) and offers Continue when the cause is recoverable. The queue survives reloads.',
                '• Clicking a card title queues it instead of opening the giveaway.',
                '▸ GalaSilver widget',
                '• Live balance read from the site\'s own responses, what is left after the queue, or how much you are missing for all of it. It shows your GalaCredit too.',
                '▸ Prizes (your library)',
                '• "Check prizes" opens your library in a new tab and walks it: Giveaways → Completed to check → Check all → Completed won.',
                '• Announces prizes that ended today in a widget inside the page, with links, a beep and a tab-title badge. Once per prize.',
                '▸ Wheel of Fortune',
                '• Reloads /giveaways every 15 min while the queue is idle, to alert you if the wheel changes state.',
                '• After a spin it tells you the prize and reloads when you close the popup, so the balance is up to date. It never reloads while the queue runs or a dialog is open.',
                '▸ Listing options',
                '• Remember search filters (sort, level, text and page), hide giveaways you already entered and choose the script language (es/en/Auto).',
                '• The ✕ button on each card hides that giveaway for good (in your browser only), in the corner opposite the ＋ or the ⚠×N badge. "Show the ones I hid" brings them back dimmed so you can take them off the list with ↺, and "Clear hidden (N)" empties it in one go.',
                '▸ Store product pages',
                '• On product pages (games, DLC and packs) it adds two buttons under "Add to Cart": GG.deals searches the title in its catalogue, with no store or DRM filter, and PCGamingWiki searches it for compatibility and fixes. Both are title searches, so they can miss; each says so in its tooltip.',
                '• Nothing else from the script runs there: no queue, no automation, no warnings. Just the two links.',
                'Everything runs in your browser; no data is sent to third parties.'
            ]
        }
    };
    const TX = EXTRA_I18N[LANG] || EXTRA_I18N.en;

    // =============================================
    // CONFIG
    // =============================================
    const CFG = {
        minDelayMs: 2500,
        maxDelayMs: 5000,
        longPauseEvery: 10,
        longPauseMinMs: 10000,
        longPauseMaxMs: 20000,
        joinResponseTimeoutMs: 60000,
        // Techo de boletos por giveaway al encolar Extra Odds. Antes el limite
        // lo ponia el saldo; ahora que se puede encolar sin saldo hace falta
        // un tope explicito, o un dedo torpe encola cientos de boletos que
        // luego se compran solos en cuanto entre GalaSilver. Numero elegido a
        // mano: Extra Odds es lo mas arriesgado del script (comprar N boletos
        // seguidos del mismo giveaway es el patron que Indiegala persigue).
        maxEnqueuePerItem: 50,
        wheelCheckIntervalMs: 15 * 60 * 1000,
        // Cuanto se le concede a un item del listado para salir de `wait` antes
        // de darlo por colgado. Un item que solo va lento se resuelve en ~1 s;
        // pasado este margen, el lazy-load de Indiegala ya no va a terminar.
        staleWaitMs: 5000,
        // Respiro tras cerrar el popup de la ruleta antes de recargar, para que
        // la animacion de cierre no se corte en seco. La recarga NO va por
        // temporizador: la dispara el cierre del popup.
        wheelReloadGraceMs: 500
    };

    const STORAGE_KEY = 'ig-st-queue';
    // Preferencias persistentes del usuario (independientes de la cola):
    //   hideEntered     -> ocultar del listado los giveaways en los que ya tienes boleto
    //   showIgnored     -> mostrar (atenuados) los giveaways ocultados a mano con ✕
    //   balanceMin      -> widget de saldo minimizado
    //   queueMin        -> panel de cola minimizado
    //   rememberFilters -> recordar y reaplicar sort/level/busqueda al recargar
    //   filters         -> { sort, order, level, search, page } aplicados por el usuario
    const SETTINGS_KEY = 'ig-bulk-settings';
    // gids de giveaways ganados ya anunciados (premios "vistos"), para no
    // re-notificar el mismo premio cada vez que se pulsa "Revisar premios".
    const SEEN_WINS_KEY = 'ig-bulk-seen-wins';
    // Registro { gid: timestamp } de giveaways en los que consta que ya tienes
    // boleto. Existe para un caso concreto: cuando Indiegala deja un item
    // colgado en `wait` (lazy-load que nunca termina), el DOM no dice nada y
    // "ocultar ya participados" no puede decidir. Ver isAlreadyEntered().
    const ENTERED_GIDS_KEY = 'ig-bulk-entered-gids';
    // Los giveaways duran dias o semanas; a los 60 dias el gid ya no vuelve a
    // aparecer en el listado y solo engordaria el storage.
    const ENTERED_GIDS_TTL_MS = 60 * 24 * 60 * 60 * 1000;
    // Registro { gid: timestamp } de giveaways que el usuario mando ocultar a
    // mano con el boton ✕ ("no mostrarme mas"). Es una lista aparte de
    // ENTERED_GIDS: esa es un hecho observado del sitio (ya tienes boleto) y se
    // reconstruye sola; esta es una decision del usuario y solo el la revierte.
    const IGNORED_GIDS_KEY = 'ig-bulk-ignored-gids';
    // Mismo razonamiento de poda que ENTERED_GIDS_TTL_MS: pasados 60 dias el
    // giveaway ya no existe y su gid solo engordaria el storage.
    const IGNORED_GIDS_TTL_MS = 60 * 24 * 60 * 60 * 1000;
    const BULK_BTN_CLASS = 'ig-bulk-join-btn';
    const BULK_BADGE_CLASS = 'ig-bulk-join-badge';
    const QBTN_CLASS = 'ig-q-btn';
    const IGN_BTN_CLASS = 'ig-ign-btn';
    const PANEL_ID = 'ig-q-panel';
    const PROGRESS_OVERLAY_ID = 'ig-bulk-progress-overlay';
    const MODAL_ID = 'ig-bulk-modal';
    const BALANCE_WIDGET_ID = 'ig-balance-widget';
    const LIB_STATUS_ID = 'ig-lib-status';
    const WIN_WIDGET_ID = 'ig-win-notif';

    // Widget de saldo → "Revisar premios": abre la biblioteca en una pestaña
    // nueva con un flag en el hash. La misma instancia del script corre en
    // /library (ver @match), detecta el flag y dispara la secuencia de clics.
    const LIBRARY_URL = 'https://www.indiegala.com/library';
    const AUTOCHECK_HASH = 'ig-bulk-autocheck';

    // Vigilante de Wheel of Fortune: en /giveaways, mientras no haya cola
    // corriendo, se auto-refresca cada CFG.wheelCheckIntervalMs y compara el
    // elemento del menu de usuario contra esta firma base ("elemento en
    // cuestion" = estado actual sin novedad). Si difiere, asumimos que la rueda
    // cambio de estado (disponible) y avisamos con alert().
    const WHEEL_SELECTOR = '.menu-fortune-wheel';
    const WHEEL_BASELINE_HTML = '<li class="menu-fortune-wheel"><span><i aria-hidden="true" class="fa fa-gift"></i>Wheel of Fortune</span></li>';

    // Popup de la ruleta y panel de resultado. El panel ya existe en el DOM
    // antes de girar, oculto con `opacity-0 display-none`; al terminar el giro
    // el sitio le quita ambas clases, le pone `fortune-wheel-tier-{s,a,b,c}` y
    // rellena el <span> del premio (que hasta entonces esta vacio). Ese es el
    // disparo que usa watchWheelSpin() — no un timeout a ojo.
    const WHEEL_POPUP_SELECTOR = 'section.popup-time-prize';
    const WHEEL_RESULTS_SELECTOR = '.fortune-wheel-results';
    const WHEEL_RELOAD_NOTICE_ID = 'ig-wheel-reload-notice';
    // Estado persistente del vigilante: { baselineSig, relearn, lastPrize }.
    //   baselineSig -> firma aprendida del <li> del menu en estado "sin novedad"
    //                  (la que se ve justo despues de girar). null = usar la
    //                  firma hardcodeada WHEEL_BASELINE_SIG.
    //   relearn     -> true entre que se detecta el giro y la recarga siguiente;
    //                  le dice a checkWheelOnce() que aprenda en vez de avisar.
    //   lastPrize   -> premio pendiente de reanunciar tras la recarga (el toast
    //                  del giro muere con el reload). Se limpia al anunciarlo.
    const WHEEL_STATE_KEY = 'ig-bulk-wheel-state';

    // =============================================
    // ESTADO
    // =============================================
    let running = false;
    let abortFlag = false;
    let queue = loadQueue();
    let settings = loadSettings();

    // Filtros persistentes (sort / level / busqueda). filtersReady se vuelve true
    // solo despues de intentar reaplicar los filtros guardados al cargar, para que
    // captureFilters() no sobreescriba las preferencias con el estado por defecto
    // que el servidor renderiza. reapplyInProgress silencia la captura mientras se
    // disparan las recargas AJAX de la reaplicacion.
    let filtersReady = false;
    let reapplyInProgress = false;

    // Saldo GalaSilver en memoria. Se inicializa desde el DOM (HTML cargado) la primera
    // vez que se consulta y se decrementa localmente tras cada join exitoso. Al recargar
    // la pagina vuelve a leerse del DOM (las variables del modulo se reinician).
    let currentBalance = null;

    // =============================================
    // STORAGE (persistencia de la cola)
    // =============================================
    // Normaliza items persistidos antes de v1.2 (sin count/done/fnName/type)
    // al nuevo schema unificado:
    //   { gid, title, timeLeft, fnName, price, fnArg2, token,
    //     count, done, type, addedAt }
    // count = total de boletos pedidos para ese gid (1 para singles, N para
    // extra odds). done = cuantos joins exitosos lleva en este item.
    function normalizeQueueItem(it) {
        if (!it || typeof it !== 'object') return null;
        const count = (typeof it.count === 'number' && it.count > 0) ? it.count : 1;
        const done = (typeof it.done === 'number' && it.done >= 0) ? it.done : 0;
        return {
            gid: it.gid,
            title: it.title || ('#' + it.gid),
            timeLeft: it.timeLeft || '',
            fnName: it.fnName || 'joinGiveawayOrAuction',
            price: it.price || 0,
            fnArg2: (it.fnArg2 != null) ? it.fnArg2 : it.price,
            token: it.token,
            count,
            done: Math.min(done, count),
            type: it.type || (count > 1 ? 'bulk' : 'single'),
            addedAt: it.addedAt || Date.now()
        };
    }
    function loadQueue() {
        try {
            let raw = null;
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(STORAGE_KEY, null);
                if (Array.isArray(v)) raw = v;
                else if (typeof v === 'string') { try { raw = JSON.parse(v); } catch (_) { raw = null; } }
            }
            if (!Array.isArray(raw)) {
                const s = localStorage.getItem(STORAGE_KEY);
                raw = s ? JSON.parse(s) : [];
            }
            if (!Array.isArray(raw)) raw = [];
            return raw.map(normalizeQueueItem).filter(Boolean);
        } catch (e) {
            console.error('[IG-BulkTools] loadQueue error:', e);
            return [];
        }
    }
    function saveQueue() {
        try {
            const json = JSON.stringify(queue);
            if (typeof GM_setValue !== 'undefined') GM_setValue(STORAGE_KEY, json);
            localStorage.setItem(STORAGE_KEY, json);
        } catch (e) {
            console.error('[IG-BulkTools] saveQueue error:', e);
        }
    }

    // Preferencias del usuario. Mismo patron de doble persistencia que la cola
    // (GM_* si esta disponible, con fallback a localStorage) para que sobrevivan
    // recargas. Defaults conservadores: nada oculto, widgets expandidos.
    function loadSettings() {
        const def = {
            hideEntered: false, showIgnored: false, balanceMin: false, queueMin: false,
            // Recordar filtros de busqueda del listado (sort/level/texto).
            rememberFilters: false,
            filters: { sort: 'expiry', order: 'asc', level: 'all', search: '', page: 1 }
        };
        try {
            let raw = null;
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(SETTINGS_KEY, null);
                if (v && typeof v === 'object' && !Array.isArray(v)) raw = v;
                else if (typeof v === 'string') { try { raw = JSON.parse(v); } catch (_) { raw = null; } }
            }
            if (!raw) {
                const s = localStorage.getItem(SETTINGS_KEY);
                raw = s ? JSON.parse(s) : null;
            }
            return Object.assign(def, (raw && typeof raw === 'object') ? raw : {});
        } catch (e) {
            console.error('[IG-BulkTools] loadSettings error:', e);
            return def;
        }
    }
    function saveSettings() {
        try {
            const json = JSON.stringify(settings);
            if (typeof GM_setValue !== 'undefined') GM_setValue(SETTINGS_KEY, json);
            localStorage.setItem(SETTINGS_KEY, json);
        } catch (e) {
            console.error('[IG-BulkTools] saveSettings error:', e);
        }
    }

    // =============================================
    // UTILIDADES
    // =============================================
    const rand = (min, max) => Math.floor(min + Math.random() * (max - min));

    // -------- Web Worker timer --------
    // Pestañas en background sufren intensive throttling: setTimeout en el hilo
    // principal se difiere a ~1/min tras unos minutos oculta. Para que las
    // pausas entre joins se respeten aunque la pestaña no este activa, los
    // timers viven en un Worker (los workers no se throttlean igual). Si por
    // CSP u otra razon no se puede crear el worker, hay fallback a setTimeout.
    const TIMER_WORKER_SRC = `
        self.addEventListener('message', function (e) {
            var d = e.data || {};
            if (d.cancel) return;
            setTimeout(function () { self.postMessage({ id: d.id }); }, d.ms);
        });
    `;
    let _timerWorker = null;
    const _timerCallbacks = new Map();
    function _getTimerWorker() {
        if (_timerWorker !== null) return _timerWorker || null;
        try {
            const blob = new Blob([TIMER_WORKER_SRC], { type: 'application/javascript' });
            const w = new Worker(URL.createObjectURL(blob));
            w.addEventListener('message', (e) => {
                const id = e.data && e.data.id;
                const cb = _timerCallbacks.get(id);
                if (cb) { _timerCallbacks.delete(id); cb(); }
            });
            _timerWorker = w;
        } catch (e) {
            console.warn('[IG-BulkTools] Worker timer no disponible, fallback a setTimeout:', e);
            _timerWorker = false;
        }
        return _timerWorker || null;
    }
    let _timerSeq = 0;
    function workerSleep(ms) {
        const w = _getTimerWorker();
        if (!w) return new Promise(res => setTimeout(res, ms));
        return new Promise(res => {
            const id = ++_timerSeq;
            _timerCallbacks.set(id, res);
            w.postMessage({ id, ms });
        });
    }

    const sleep = (ms) => workerSleep(ms);

    // -------- Señal de aborto --------
    // setAbort despierta todas las esperas pendientes, lo que convierte
    // abortableSleep(N) en un solo timer + race contra la señal en lugar de
    // hacer polling cada 100 ms (que en background se inflaba a minutos por
    // pausa).
    const _abortResolvers = new Set();
    function setAbort() {
        abortFlag = true;
        const rs = Array.from(_abortResolvers);
        _abortResolvers.clear();
        rs.forEach(r => { try { r(); } catch (_) {} });
    }
    function clearAbort() { abortFlag = false; _abortResolvers.clear(); }
    async function abortableSleep(ms) {
        if (abortFlag) return;
        let abortRes;
        const aborted = new Promise(res => { abortRes = res; _abortResolvers.add(abortRes); });
        try {
            await Promise.race([workerSleep(ms), aborted]);
        } finally {
            _abortResolvers.delete(abortRes);
        }
    }

    function makeFakeEvent() {
        return {
            preventDefault: () => {},
            stopPropagation: () => {},
            stopImmediatePropagation: () => {},
            target: null
        };
    }

    function makeFakeAnchor() {
        const a = document.createElement('a');
        a.setAttribute('href', '#');
        a.setAttribute('data-price', '');
        return a;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Lee saldo GalaSilver del DOM. Primera fuente: #galasilver-amount, que es
    // el unico elemento que el sitio actualiza en vivo tras cada respuesta de
    // /giveaways/join (success de joinGiveawayOrAuction). Si no existe (layouts
    // antiguos o paginas sin dropdown renderizado), cae al TreeWalker buscando
    // el texto "GALASILVER … N iS".
    function getGalaSilver() {
        const el = document.getElementById('galasilver-amount');
        if (el) {
            const num = parseInt((el.innerText || el.textContent || '').replace(/[,.\s]/g, ''), 10);
            if (!isNaN(num)) return num;
        }
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => /galasilver/i.test(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        let node;
        while ((node = walker.nextNode())) {
            let container = node.parentElement;
            for (let i = 0; i < 4 && container; i++) {
                const txt = container.textContent || '';
                const m = txt.match(/galasilver[\s\S]{0,40}?(\d[\d,.]*)\s*iS/i);
                if (m) {
                    const num = parseInt(m[1].replace(/[,.]/g, ''), 10);
                    if (!isNaN(num)) return num;
                }
                container = container.parentElement;
            }
        }
        // Fallback global por si la estructura es distinta
        const all = document.body.textContent || '';
        const m = all.match(/galasilver[\s\S]{0,40}?(\d[\d,.]*)\s*iS/i);
        if (m) {
            const num = parseInt(m[1].replace(/[,.]/g, ''), 10);
            if (!isNaN(num)) return num;
        }
        return null;
    }

    // Lee el GalaCredit (credito en $ de la tienda) del menu de usuario. El
    // sitio lo expone ya formateado en #galacredits-amount (p.ej. "$ 2.20"); se
    // devuelve tal cual como string. No tiene cache ni decremento local: es
    // informativo (el script no gasta galacredit). Fallback por texto si el id
    // no existe en este layout.
    function getGalaCredit() {
        const el = document.getElementById('galacredits-amount');
        if (el) {
            const txt = (el.innerText || el.textContent || '').trim();
            if (txt) return txt;
        }
        const all = document.body ? (document.body.textContent || '') : '';
        const m = all.match(/galacredit[\s\S]{0,40}?(\$\s*[\d,.]+)/i);
        if (m) return m[1].replace(/\s+/g, ' ').trim();
        return null;
    }

    // Devuelve el saldo cacheado o lo inicializa desde el DOM la primera vez.
    // Si el DOM ya muestra un saldo MENOR que el cache (porque hubo joins
    // manuales fuera del script o el sitio refresco la cifra), prefiere el del
    // DOM como verdad mas conservadora; nunca sube por encima de lo que tenia
    // el cache (al revertir, el modal podria mostrar mas iS de los disponibles).
    function getCurrentBalance() {
        const dom = getGalaSilver();
        if (currentBalance == null) {
            currentBalance = dom;
        } else if (dom != null && dom < currentBalance) {
            currentBalance = dom;
        }
        return currentBalance;
    }

    // Lee el saldo del DOM y SOBREESCRIBE el cache (puede subir o bajar). A
    // diferencia de getCurrentBalance, no usa Math.min: aqui se confia en el
    // div del usuario como verdad. Pensado para puntos donde el usuario hace
    // una accion explicita y queremos darle la cifra mas reciente (p.ej.
    // cuando intenta encolar y el cache dice 0).
    function forceReadBalance() {
        const dom = getGalaSilver();
        if (dom != null) {
            currentBalance = dom;
            refreshBulkBadges();
            refreshQueueButtonsState();
        }
        return currentBalance;
    }

    // El server respondio "sin saldo" (status 'silver') a un join de precio
    // `price`: eso PRUEBA que el saldo real es menor que ese precio, aunque el
    // DOM siga mostrando una cifra vieja mas alta. Bajamos el cache a esa cota
    // para que la cola salte ese item (y los mas caros) sin gastar otra
    // peticion en redescubrirlo. Solo baja, nunca sube: el proximo join exitoso
    // trae el silver_tot autoritativo por el hook de ajax y corrige la cifra.
    function clampBalanceBelow(price) {
        const cap = Math.max(0, (price || 0) - 1);
        currentBalance = (currentBalance == null) ? cap : Math.min(currentBalance, cap);
        refreshBulkBadges();
        refreshQueueButtonsState();
        try { renderBalanceWidget(); } catch (e) {}
        return currentBalance;
    }

    // Re-sincroniza el saldo cacheado con el DOM tras finalizar una ejecucion
    // (cola o bulk). Inmediato + diferido a 3s para captar la respuesta del
    // servidor que pudo actualizar el div del usuario despues del loop.
    // Mantiene comportamiento conservador via Math.min en getCurrentBalance:
    // si el DOM esta stale (mas alto), el cache no sube; si el DOM ya bajo
    // (mas bajo), el cache se ajusta. Asi ningun modal abierto despues mostrara
    // un saldo superior al real.
    function resyncBalanceAfterRun() {
        const apply = () => {
            try {
                getCurrentBalance();
                refreshBulkBadges();
                refreshQueueButtonsState();
                renderBalanceWidget();
            } catch (e) {}
        };
        apply();
        setTimeout(apply, 3000);
    }

    // Cola FIFO de promesas en espera de la siguiente respuesta de /giveaways/join.
    // El loop bulk/cola se suscribe ANTES de disparar fn.call y luego await: cuando
    // ajaxComplete cae, se resuelve el primer waiter con el payload del servidor.
    // Asi el siguiente tick del loop ya tiene saldo y status reales en lugar de
    // continuar a ciegas mientras la respuesta sigue en vuelo.
    const joinResolveQueue = [];
    function awaitNextJoinResponse(timeoutMs) {
        return new Promise((resolve) => {
            let settled = false;
            const resolver = (payload) => {
                if (settled) return;
                settled = true;
                resolve(payload);
            };
            joinResolveQueue.push(resolver);
            setTimeout(() => {
                if (settled) return;
                const idx = joinResolveQueue.indexOf(resolver);
                if (idx >= 0) joinResolveQueue.splice(idx, 1);
                resolver({ timedOut: true, status: null, response: null });
            }, timeoutMs);
        });
    }

    // Engancha jQuery del sitio para capturar el saldo autoritativo que devuelve
    // /giveaways/join en cada respuesta. La pagina ya hace el POST y recibe
    // responseData.silver_tot; aqui solo escuchamos el ajaxComplete para tomar
    // ese numero como verdad y sobreescribir el cache, sin depender del DOM ni
    // del decremento local. Ademas resuelve a cualquier waiter en joinResolveQueue
    // (sea status ok o de error) para que los loops no avancen sin saber el
    // resultado del request anterior.
    function setupAjaxBalanceHook() {
        try {
            const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.jQuery) || window.jQuery;
            if (!jq || setupAjaxBalanceHook._done) return;
            setupAjaxBalanceHook._done = true;
            jq(document).ajaxComplete(function (_e, xhr, settings) {
                if (!settings || !settings.url) return;
                if (settings.url.indexOf('/giveaways/join') === -1) return;
                let r = xhr && xhr.responseJSON;
                if (!r && xhr && typeof xhr.responseText === 'string') {
                    try { r = JSON.parse(xhr.responseText); } catch (_) { r = null; }
                }
                if (r && r.status === 'ok' && typeof r.silver_tot === 'number') {
                    currentBalance = r.silver_tot;
                    try { refreshBulkBadges(); } catch (e) {}
                    try { refreshQueueButtonsState(); } catch (e) {}
                    try { renderBalanceWidget(); } catch (e) {}
                }
                if (joinResolveQueue.length > 0) {
                    const resolver = joinResolveQueue.shift();
                    try {
                        resolver({
                            timedOut: false,
                            status: r && r.status,
                            code: r && r.code,
                            response: r
                        });
                    } catch (_) {}
                }
            });
        } catch (e) {
            console.error('[IG-BulkTools] setupAjaxBalanceHook:', e);
        }
    }

    // Recalcula el "maximo posible" mostrado en cada badge de Extra Odds visible.
    // Toma saldo disponible (saldo - lo ya comprometido en la cola), no el saldo
    // crudo, para que el numero refleje cuanto se puede AÑADIR de verdad.
    function refreshBulkBadges() {
        document.querySelectorAll('.' + BULK_BADGE_CLASS).forEach(badge => {
            const price = parseInt(badge.dataset.price, 10);
            if (isNaN(price) || price < 1) return;
            const max = maxEnqueueCount(price);
            const n = max == null ? 0 : max;
            badge.textContent = fmt(T.bulkBadge, { n });
            badge.title = fmt(T.bulkBadgeTooltip, { n });
        });
    }

    // Parsea el atributo onclick para extraer gid, segundo argumento de la funcion
    // (fnArg2) y token. Importante: en los Single Ticket el segundo argumento del
    // onclick NO es el precio (siempre vale 0), es un flag de tipo. El precio real
    // en iS hay que leerlo aparte de data-price (ver findDataPrice).
    function parseJoinOnclick(anchor, fnName) {
        const onclick = anchor && anchor.getAttribute && anchor.getAttribute('onclick');
        if (!onclick) return null;
        const re = new RegExp(fnName + '\\s*\\(\\s*this\\s*,\\s*event\\s*,\\s*\'([^\']+)\'\\s*,\\s*(\\d+)\\s*,\\s*\'([^\']+)\'\\s*\\)');
        const m = onclick.match(re);
        if (!m) return null;
        const fnArg2 = parseInt(m[2], 10);
        // params.price arranca con fnArg2 como fallback; cada sitio de inyeccion
        // debe sobreescribirlo con el data-price real.
        return { gid: m[1], price: fnArg2, fnArg2: fnArg2, token: m[3], fnName };
    }

    // Busca el data-price real del card (precio en iS).
    function findDataPrice(scope) {
        if (!scope) return null;
        const sels = [
            '.items-list-item-data-button a[data-price]',
            '.card-join a[data-price]',
            'a[data-price]'
        ];
        for (const sel of sels) {
            const el = scope.querySelector(sel);
            if (el) {
                const v = parseInt(el.getAttribute('data-price'), 10);
                if (!isNaN(v)) return v;
            }
        }
        return null;
    }

    // Re-encuentra el trigger por gid (por si el DOM se actualiza tras cada join)
    function findTrigger(params) {
        if (params.fnName === 'joinGiveawayCard') {
            return document.querySelector('.card-join a[data-price]');
        }
        const all = document.querySelectorAll('a.items-list-item-ticket-click');
        for (const a of all) {
            const onclick = a.getAttribute('onclick') || '';
            if (onclick.indexOf("'" + params.gid + "'") !== -1) return a;
        }
        return null;
    }

    // Detecta si el card mostro un error (el sitio expone .card-error / .items-list-item-error)
    function isErrorVisible(triggerEl) {
        const candidates = [];
        if (triggerEl) {
            let p = triggerEl.parentElement;
            for (let i = 0; i < 8 && p; i++) {
                p.querySelectorAll && p.querySelectorAll('.card-error, .items-list-item-error').forEach(e => candidates.push(e));
                p = p.parentElement;
            }
        }
        if (!candidates.length) {
            document.querySelectorAll('.card-error, .items-list-item-error').forEach(e => candidates.push(e));
        }
        for (const e of candidates) {
            const cs = window.getComputedStyle(e);
            if (cs.display !== 'none' && cs.visibility !== 'hidden' && (e.offsetWidth > 0 || e.offsetHeight > 0)) {
                return true;
            }
        }
        return false;
    }

    // =============================================
    // PATH HELPERS
    // =============================================
    // Cola Single Ticket: solo en /giveaways (no en /giveaways/card/*)
    function isListingRoot() {
        return /^\/giveaways\/?$/.test(location.pathname);
    }
    function isCardDetail() {
        return /^\/giveaways\/card\//.test(location.pathname);
    }
    // Biblioteca del usuario (/library). Aqui NO corre la cola ni la inyeccion
    // de giveaways: solo la secuencia de auto-revision de premios.
    function isLibrary() {
        return /^\/library(\/|$)/.test(location.pathname);
    }
    // Ficha de producto de la tienda. Juegos, DLC y packs comparten plantilla y
    // cuelgan de estas dos rutas. Aqui NO corre nada del modulo de giveaways.
    function isStoreProduct() {
        return /^\/store\/(game|product)\//.test(location.pathname);
    }

    // =============================================
    // OPERACIONES DE COLA
    // =============================================
    function isInQueue(gid) { return queue.some(q => q.gid === gid); }
    function findQueueItem(gid) { return queue.find(q => q.gid === gid) || null; }

    // Pendientes (boletos por joinar) en un item, o en toda la cola.
    function itemPending(it) { return Math.max(0, (it.count || 0) - (it.done || 0)); }
    function pendingQueueCost() {
        return queue.reduce((s, q) => s + itemPending(q) * (q.price || 0), 0);
    }
    // Saldo disponible despues de descontar lo ya comprometido en la cola.
    function availableForEnqueue() {
        const bal = getCurrentBalance();
        if (bal == null) return null;
        return bal - pendingQueueCost();
    }
    // Maximo a encolar para un item del precio dado, dado el presupuesto.
    function maxEnqueueCount(price) {
        const avail = availableForEnqueue();
        if (avail == null) return null;
        if (!price || price <= 0) return 0;
        return Math.max(0, Math.floor(avail / price));
    }
    // Un item es ejecutable si su precio cabe en el saldo actual. Saldo
    // desconocido (null) cuenta como ejecutable: quien decide entonces es el
    // server, que responde status 'silver' y ahi releemos el saldo de verdad.
    // Pasar `bal` explicito para no releer el DOM por cada fila del panel.
    function itemAffordable(it, bal) {
        const b = (bal === undefined) ? getCurrentBalance() : bal;
        if (b == null) return true;
        return (it.price || 0) <= b;
    }

    // Agrega o suma a un item existente. Devuelve el item resultante en la cola.
    // Si el gid ya existia, se suma `count` al pendiente respetando type/fnName del nuevo
    // y refrescando token/fnArg2/price (mas frescos del DOM).
    function addToQueue(item) {
        const norm = normalizeQueueItem(item);
        if (!norm) return null;
        const existing = findQueueItem(norm.gid);
        if (existing) {
            existing.count += norm.count;
            existing.token = norm.token || existing.token;
            existing.fnArg2 = (norm.fnArg2 != null) ? norm.fnArg2 : existing.fnArg2;
            if (norm.price) existing.price = norm.price;
            if (norm.fnName) existing.fnName = norm.fnName;
            if (existing.count > 1) existing.type = 'bulk';
            saveQueue();
            renderQueuePanel();
            refreshQueueButtonsState();
            refreshBulkBadges();
            return existing;
        }
        queue.push(norm);
        saveQueue();
        renderQueuePanel();
        refreshQueueButtonsState();
        refreshBulkBadges();
        return norm;
    }
    // Mueve un item una posicion arriba (delta -1) o abajo (+1). El orden de
    // `queue` ES el orden de ejecucion: el loop toma en cada tick el primer
    // item pendiente y ejecutable, asi que reordenar surte efecto incluso a
    // mitad de corrida (el join en vuelo ya viajo y termina igual).
    function moveInQueue(gid, delta) {
        const i = queue.findIndex(q => q.gid === gid);
        if (i < 0) return;
        const j = i + delta;
        if (j < 0 || j >= queue.length) return;
        const tmp = queue[i];
        queue[i] = queue[j];
        queue[j] = tmp;
        saveQueue();
        renderQueuePanel();
    }
    function removeFromQueue(gid) {
        queue = queue.filter(q => q.gid !== gid);
        saveQueue();
        renderQueuePanel();
        refreshQueueButtonsState();
        refreshBulkBadges();
    }
    function clearQueue() {
        queue = [];
        saveQueue();
        renderQueuePanel();
        refreshQueueButtonsState();
        refreshBulkBadges();
    }

    // =============================================
    // ESTILOS
    // =============================================
    function injectStyles() {
        if (document.getElementById('ig-bulk-styles')) return;
        const style = document.createElement('style');
        style.id = 'ig-bulk-styles';
        style.textContent = `
            .${BULK_BTN_CLASS} {
                display: block;
                width: 100%;
                margin-top: 8px;
                padding: 10px 14px;
                font-weight: bold;
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                text-align: center;
                font-size: 14px;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                transition: filter 0.15s;
            }
            .${BULK_BTN_CLASS}:hover { filter: brightness(1.15); }
            .${BULK_BTN_CLASS}:disabled { opacity: 0.5; cursor: not-allowed; }

            .${BULK_BADGE_CLASS} {
                position: absolute;
                top: 6px;
                right: 6px;
                z-index: 50;
                padding: 4px 8px;
                font-size: 11px;
                font-weight: bold;
                color: #fff;
                background: linear-gradient(135deg, #6a1b9a 0%, #ad1457 100%);
                border-radius: 12px;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                user-select: none;
                line-height: 1;
            }
            .${BULK_BADGE_CLASS}:hover { filter: brightness(1.2); }

            .${QBTN_CLASS} {
                position: absolute;
                top: 6px;
                left: 6px;
                z-index: 50;
                width: 26px; height: 26px;
                line-height: 24px;
                text-align: center;
                font-size: 14px; font-weight: bold;
                color: #fff;
                background: rgba(70, 70, 70, 0.85);
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                user-select: none;
                transition: transform 0.1s, background 0.15s;
            }
            .${QBTN_CLASS}:hover { transform: scale(1.1); }
            .${QBTN_CLASS}.ig-q-btn-active {
                background: linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%);
                border-color: #fff;
            }
            /* "Se encolara pero esperara saldo": sigue siendo clicable (de ahi
               que conserve el hover), solo apagado y con borde ambar. */
            .${QBTN_CLASS}.ig-q-btn-wait {
                opacity: 0.65;
                background: rgba(40, 40, 40, 0.85);
                border-color: rgba(255, 207, 102, 0.7);
            }

            /* Boton "no mostrarme mas" / "quitar de ignorados". Va en la esquina
               OPUESTA al control propio de la tarjeta (ver injectIgnoreControls):
               Single Ticket lleva el ＋ a la izquierda, asi que el ✕ va a la
               derecha; Extra Odds lleva el badge a la derecha y el ✕ va a la
               izquierda. Nunca coinciden porque una tarjeta es de un solo tipo. */
            .${IGN_BTN_CLASS} {
                position: absolute;
                top: 6px;
                z-index: 51;
                width: 22px; height: 22px;
                line-height: 20px;
                text-align: center;
                font-size: 12px; font-weight: bold;
                color: #fff;
                background: rgba(50, 50, 50, 0.8);
                border: 2px solid rgba(255, 255, 255, 0.25);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                user-select: none;
                opacity: 0.55;
                transition: transform 0.1s, opacity 0.15s, background 0.15s;
            }
            .${IGN_BTN_CLASS}:hover { transform: scale(1.15); opacity: 1; background: rgba(198, 40, 40, 0.95); }
            .${IGN_BTN_CLASS}.ig-ign-left { left: 6px; }
            .${IGN_BTN_CLASS}.ig-ign-right { right: 6px; }
            /* Estado "ya ignorado": el mismo boton restaura, y se ve siempre. */
            .${IGN_BTN_CLASS}.ig-ign-btn-undo {
                opacity: 1;
                background: linear-gradient(135deg, #1565c0 0%, #42a5f5 100%);
                border-color: #fff;
            }
            .${IGN_BTN_CLASS}.ig-ign-btn-undo:hover { background: linear-gradient(135deg, #1565c0 0%, #42a5f5 100%); }

            #${PANEL_ID} {
                position: fixed;
                bottom: 20px; left: 20px;
                width: 320px;
                background: #1f1f1f; color: #fff;
                border: 2px solid #d32f2f;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                font-family: sans-serif;
                z-index: 99997;
                max-height: 70vh;
                display: flex; flex-direction: column;
            }
            #${PANEL_ID} .ig-q-warning-bar {
                background: #4a1010;
                border-left: 4px solid #ff5252;
                padding: 8px 10px;
                font-size: 11px; color: #ffb3b3;
                line-height: 1.3;
                border-radius: 6px 6px 0 0;
            }
            #${PANEL_ID} h4 {
                margin: 0; padding: 10px 12px 6px;
                font-size: 14px; color: #ff7da6;
            }
            #${PANEL_ID} .ig-q-summary {
                padding: 0 12px 8px;
                font-size: 12px; color: #ccc;
            }
            #${PANEL_ID} .ig-q-list {
                list-style: none; margin: 0;
                padding: 0 4px;
                overflow-y: auto;
                flex: 1;
                min-height: 0;
                max-height: 280px;
            }
            #${PANEL_ID} .ig-q-list li {
                display: flex; align-items: center; gap: 6px;
                padding: 6px 8px;
                font-size: 12px;
                border-bottom: 1px solid #333;
            }
            #${PANEL_ID} .ig-q-it-title {
                flex: 1;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                color: #fff;
            }
            #${PANEL_ID} .ig-q-it-price { color: #ff7da6; font-weight: bold; }
            #${PANEL_ID} .ig-q-it-count {
                color: #fff;
                background: linear-gradient(135deg, #6a1b9a 0%, #ad1457 100%);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: bold;
            }
            #${PANEL_ID} .ig-q-li-active {
                background: rgba(106, 27, 154, 0.18);
                border-left: 3px solid #ff7da6;
            }
            /* Item que la corrida salta por falta de saldo. Atenuado + reloj,
               para que se lea en movil sin depender del tooltip (no hay hover). */
            #${PANEL_ID} .ig-q-li-nofunds .ig-q-it-title { opacity: 0.55; }
            #${PANEL_ID} .ig-q-li-nofunds .ig-q-it-price { color: #9e9e9e; }
            #${PANEL_ID} .ig-q-it-wait { font-size: 11px; opacity: 0.85; cursor: help; }
            #${PANEL_ID} .ig-q-it-rem {
                width: 22px; height: 22px;
                border: none; border-radius: 50%;
                background: #c62828; color: #fff;
                cursor: pointer; font-weight: bold;
                font-size: 12px; line-height: 1;
            }
            /* Reordenar: ▲▼ lado a lado (no apilados) para que el area de toque
               no baje de ~20px, que en movil ya es el minimo practicable. Se
               come ancho al titulo, que de todas formas va con ellipsis. */
            #${PANEL_ID} .ig-q-it-mv {
                flex: 0 0 auto;
                width: 20px; height: 22px;
                border: 1px solid #555; border-radius: 4px;
                background: #333; color: #ddd;
                cursor: pointer; font-size: 9px; line-height: 1;
                padding: 0;
            }
            #${PANEL_ID} .ig-q-it-mv:hover:not(:disabled) { background: #444; color: #fff; }
            #${PANEL_ID} .ig-q-it-mv:disabled { opacity: 0.25; cursor: default; }
            #${PANEL_ID} .ig-q-actions {
                display: flex; gap: 6px;
                padding: 10px 12px;
                border-top: 1px solid #333;
            }
            #${PANEL_ID} .ig-q-actions button {
                flex: 1;
                padding: 8px;
                border: none; border-radius: 4px;
                font-size: 12px; font-weight: bold;
                cursor: pointer;
            }
            #${PANEL_ID} #ig-q-clear { background: #555; color: #fff; }
            #${PANEL_ID} #ig-q-exec {
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }
            #${PANEL_ID} #ig-q-exec:disabled { opacity: 0.5; cursor: not-allowed; }

            #${MODAL_ID}-backdrop {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.6);
                z-index: 99998;
                display: flex; align-items: center; justify-content: center;
            }
            #${MODAL_ID} {
                background: #fff; color: #222;
                border-radius: 8px;
                padding: 20px 24px;
                max-width: 460px; width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                font-family: sans-serif;
            }
            #${MODAL_ID} h3 { margin: 0 0 12px; font-size: 18px; color: #ad1457; }
            #${MODAL_ID} .ig-warning {
                background: #fff3cd;
                border: 2px solid #d32f2f;
                border-radius: 6px;
                padding: 10px 12px;
                margin: 0 0 14px;
                color: #5a1010;
                font-size: 12px;
                line-height: 1.4;
            }
            #${MODAL_ID} .ig-warning b { color: #b71c1c; display: block; margin-bottom: 4px; font-size: 13px; }
            #${MODAL_ID} .ig-warning a { color: #b71c1c; font-weight: bold; }
            #${MODAL_ID} .ig-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            #${MODAL_ID} .ig-row b { color: #444; }
            #${MODAL_ID} input[type="number"] {
                width: 100%;
                padding: 8px 10px;
                margin: 8px 0 4px;
                border: 1px solid #ccc; border-radius: 4px;
                font-size: 16px; text-align: center;
            }
            #${MODAL_ID} .ig-note { font-size: 11px; color: #777; margin: 6px 0 12px; }
            #${MODAL_ID} .ig-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
            #${MODAL_ID} button {
                flex: 1;
                padding: 10px;
                border: none; border-radius: 6px;
                font-weight: bold; cursor: pointer;
                font-size: 14px;
            }
            #${MODAL_ID} .ig-confirm {
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }
            #${MODAL_ID} .ig-cancel { background: #eee; color: #333; }
            /* "Encolar y ejecutar" en su propia fila y con estilo outline, no
               con el gradiente: el gradiente se lo queda "Encolar", que es la
               salida segura. Disparar compras es la accion arriesgada del modal
               y no debe ser la que la vista empuja a pulsar. */
            #${MODAL_ID} .ig-confirm-run {
                flex-basis: 100%;
                background: transparent;
                color: #b71c1c;
                border: 2px solid #d32f2f;
            }
            #${MODAL_ID} .ig-confirm-run:hover { background: #ffebee; }

            #${PROGRESS_OVERLAY_ID} {
                position: fixed; bottom: 20px; right: 20px;
                background: #1f1f1f; color: #fff;
                padding: 14px 18px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                z-index: 99999;
                font-family: sans-serif;
                min-width: 280px;
            }
            #${PROGRESS_OVERLAY_ID} h4 {
                margin: 0 0 8px; font-size: 14px;
                color: #ff7da6;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-bar {
                width: 100%; height: 6px;
                background: #333; border-radius: 3px;
                overflow: hidden; margin: 8px 0;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-fill {
                height: 100%;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
                width: 0%; transition: width 0.3s;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-status { font-size: 12px; color: #ccc; }
            #${PROGRESS_OVERLAY_ID} .ig-prog-warning {
                margin-top: 8px;
                padding: 6px 8px;
                background: #4a1010;
                border-left: 3px solid #ff5252;
                border-radius: 3px;
                font-size: 11px;
                color: #ffb3b3;
                line-height: 1.3;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-actions {
                margin-top: 10px;
                display: flex;
                gap: 6px;
            }
            #${PROGRESS_OVERLAY_ID} button {
                padding: 6px 12px;
                font-size: 12px; font-weight: bold;
                border: none; border-radius: 4px;
                cursor: pointer;
                background: #c62828; color: #fff;
            }
            #${PROGRESS_OVERLAY_ID} button.ig-prog-close { background: #444; }
            #${PROGRESS_OVERLAY_ID} button.ig-prog-continue {
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }

            #ig-toast-container {
                position: fixed;
                top: 20px; right: 20px;
                z-index: 100000;
                display: flex; flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .ig-toast {
                background: #1f1f1f;
                color: #fff;
                border-left: 4px solid #888;
                border-radius: 6px;
                padding: 12px 16px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                font-family: sans-serif;
                font-size: 13px;
                line-height: 1.35;
                max-width: 360px;
                min-width: 220px;
                cursor: pointer;
                pointer-events: auto;
                opacity: 0;
                transform: translateX(20px);
                transition: opacity 0.25s, transform 0.25s;
            }
            .ig-toast-visible { opacity: 1; transform: translateX(0); }
            .ig-toast-info { border-left-color: #2196f3; }
            .ig-toast-warn { border-left-color: #ff9800; background: #2a1f10; }
            .ig-toast-error { border-left-color: #d32f2f; background: #2a1010; }
            .ig-toast-success { border-left-color: #4caf50; background: #122a12; }

            .ig-confirm-backdrop {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.65);
                z-index: 100001;
                display: flex; align-items: center; justify-content: center;
            }
            .ig-confirm-modal {
                background: #fff; color: #222;
                border-radius: 8px;
                padding: 20px 24px;
                max-width: 420px; width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                font-family: sans-serif;
            }
            .ig-confirm-modal h3 {
                margin: 0 0 10px; font-size: 16px; color: #ad1457;
            }
            .ig-confirm-modal p {
                margin: 0 0 14px; font-size: 14px; line-height: 1.45;
                white-space: pre-wrap;
            }
            .ig-confirm-actions { display: flex; gap: 8px; }
            .ig-confirm-actions button {
                flex: 1;
                padding: 10px;
                border: none; border-radius: 6px;
                font-weight: bold; cursor: pointer;
                font-size: 14px;
            }
            .ig-confirm-cancel { background: #eee; color: #333; }
            .ig-confirm-ok {
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }

            #${MODAL_ID} .ig-inline-error {
                color: #b71c1c;
                font-size: 12px;
                margin-top: 6px;
                padding: 6px 10px;
                background: #ffebee;
                border: 1px solid #ef9a9a;
                border-radius: 4px;
                display: none;
            }
            #${MODAL_ID} .ig-inline-error.ig-visible { display: block; }

            /* ===== Widget de saldo GalaSilver + Revisar premios ===== */
            #${BALANCE_WIDGET_ID} {
                position: fixed; top: 72px; right: 16px;
                z-index: 99996;
                background: #1f1f1f; color: #fff;
                border: 1px solid #6a1b9a;
                border-radius: 8px;
                padding: 10px 12px;
                font-family: sans-serif;
                box-shadow: 0 4px 16px rgba(0,0,0,0.45);
                min-width: 170px;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-title {
                font-size: 11px; color: #bbb;
                letter-spacing: 0.5px; text-transform: uppercase;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-amount {
                font-size: 22px; font-weight: bold;
                color: #ffd54f; line-height: 1.1;
                margin: 2px 0 4px;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-avail {
                font-size: 11px; color: #9ccc65; margin-bottom: 8px;
            }
            /* Misma linea, pero cuando informa un faltante: verde mentiria. */
            #${BALANCE_WIDGET_ID} .ig-bw-avail.ig-bw-short { color: #ffcf66; }
            #${BALANCE_WIDGET_ID} .ig-bw-credit {
                font-size: 12px; color: #80d8ff;
                font-weight: bold; margin-bottom: 8px;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-btn {
                display: block; width: 100%;
                padding: 8px 10px;
                font-weight: bold; font-size: 12px;
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
                border: none; border-radius: 6px;
                cursor: pointer; text-align: center;
                transition: filter 0.15s;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-btn:hover { filter: brightness(1.15); }
            /* Botones consecutivos: sin esto quedan pegados y se leen como uno
               solo con dos mitades de color, no como dos acciones distintas. */
            #${BALANCE_WIDGET_ID} .ig-bw-btn + .ig-bw-btn { margin-top: 8px; }
            /* "Saber más": estilo outline (distinto del gradiente) y mas separado
               que el resto — no es una accion del listado, cierra el widget.
               Selector con dos clases para ganarle al margen de arriba. */
            #${BALANCE_WIDGET_ID} .ig-bw-btn.ig-bw-about {
                margin-top: 14px;
                background: transparent;
                color: #c88bff;
                border: 1px solid #b14cff;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-about:hover { background: rgba(177,76,255,0.15); filter: none; }
            /* Header del widget: titulo + boton minimizar en una fila. */
            #${BALANCE_WIDGET_ID} .ig-bw-head {
                display: flex; align-items: center; justify-content: space-between;
                gap: 8px;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-min {
                flex: 0 0 auto;
                width: 20px; height: 20px;
                padding: 0; line-height: 18px;
                border: 1px solid #6a1b9a; border-radius: 4px;
                background: #2a2a2a; color: #ddd;
                cursor: pointer; font-size: 13px; font-weight: bold;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-min:hover { filter: brightness(1.3); }
            /* Toggle "Ocultar ya participados". */
            #${BALANCE_WIDGET_ID} .ig-bw-toggle {
                display: flex; align-items: center; gap: 6px;
                font-size: 11px; color: #ddd;
                margin: 2px 0 8px; cursor: pointer;
                user-select: none; line-height: 1.2;
            }
            #${BALANCE_WIDGET_ID} .ig-bw-toggle input { margin: 0; cursor: pointer; accent-color: #ad1457; }
            /* Estado minimizado: solo se ve el header. */
            #${BALANCE_WIDGET_ID}.ig-bw-collapsed .ig-bw-body { display: none; }
            #${BALANCE_WIDGET_ID}.ig-bw-collapsed { min-width: 0; padding: 6px 10px; }

            /* Ocultar giveaways en los que ya tienes boleto (toggle persistente). */
            .ig-entered-hidden { display: none !important; }

            /* Ocultados a mano con ✕. Clase aparte de .ig-entered-hidden para que
               los dos filtros no se pisen: cada pasada pone y quita solo la suya. */
            .ig-ignored-hidden { display: none !important; }
            /* Con "Mostrar ocultos" activo el giveaway sigue visible pero apagado,
               para que se distinga de los que si cuentan. El hover lo devuelve a
               color: sin eso, el boton de restaurar se lee a medias. */
            .ig-ignored-shown {
                opacity: 0.45;
                filter: grayscale(1);
                outline: 2px dashed rgba(211, 47, 47, 0.6);
                outline-offset: -2px;
                transition: opacity 0.15s, filter 0.15s;
            }
            .ig-ignored-shown:hover { opacity: 1; filter: none; }

            /* Header del panel de cola: titulo + boton minimizar. */
            #${PANEL_ID} .ig-q-head {
                display: flex; align-items: center; justify-content: space-between;
                gap: 8px;
            }
            #${PANEL_ID} .ig-q-min {
                flex: 0 0 auto;
                width: 22px; height: 22px;
                padding: 0; line-height: 20px;
                border: 1px solid #6a1b9a; border-radius: 4px;
                background: #2a2a2a; color: #ddd;
                cursor: pointer; font-size: 14px; font-weight: bold;
            }
            #${PANEL_ID} .ig-q-min:hover { filter: brightness(1.3); }
            /* Cola minimizada: solo header (titulo + restaurar). */
            #${PANEL_ID}.ig-q-collapsed .ig-q-warning-bar,
            #${PANEL_ID}.ig-q-collapsed .ig-q-summary,
            #${PANEL_ID}.ig-q-collapsed .ig-q-list,
            #${PANEL_ID}.ig-q-collapsed .ig-q-actions { display: none; }

            /* ===== Estado de auto-revision en /library ===== */
            #${LIB_STATUS_ID} {
                position: fixed; top: 16px; left: 50%;
                transform: translateX(-50%);
                z-index: 100000;
                background: #1f1f1f; color: #fff;
                border-left: 4px solid #ad1457;
                border-radius: 6px;
                padding: 12px 18px;
                font-family: sans-serif; font-size: 13px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                max-width: 90vw;
            }
            #${LIB_STATUS_ID}.ig-lib-status-error {
                border-left-color: #d32f2f; background: #2a1010;
            }

            /* ===== Aviso de recarga tras girar la ruleta ===== */
            /* z-index por encima del popup de la ruleta, que es un overlay
               propio de Indiegala y taparia el aviso. */
            #${WHEEL_RELOAD_NOTICE_ID} {
                position: fixed; bottom: 20px; left: 50%;
                transform: translateX(-50%);
                z-index: 2147483000;
                display: flex; align-items: center; gap: 12px;
                background: #1f1f1f; color: #fff;
                border-left: 4px solid #f9a825;
                border-radius: 6px;
                padding: 12px 18px;
                font-family: sans-serif; font-size: 13px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                max-width: 90vw;
            }

            /* ===== Widget propio de premios ganados (in-page) ===== */
            #${WIN_WIDGET_ID} {
                position: fixed; top: 70px; left: 50%;
                transform: translateX(-50%);
                z-index: 100001;
                background: #1f1f1f; color: #fff;
                border: 2px solid #ad1457;
                border-radius: 10px;
                padding: 14px 42px 14px 18px;
                font-family: sans-serif;
                box-shadow: 0 8px 30px rgba(0,0,0,0.6);
                width: 360px; max-width: 92vw;
                max-height: 60vh; overflow-y: auto;
            }
            #${WIN_WIDGET_ID} .ig-wn-title {
                font-size: 15px; font-weight: bold;
                color: #ff7da6; margin-bottom: 8px;
            }
            #${WIN_WIDGET_ID} .ig-wn-list { list-style: none; margin: 0; padding: 0; }
            #${WIN_WIDGET_ID} .ig-wn-list li {
                padding: 6px 0;
                border-top: 1px solid #333;
                font-size: 13px;
            }
            #${WIN_WIDGET_ID} .ig-wn-list li:first-child { border-top: none; }
            #${WIN_WIDGET_ID} .ig-wn-list a {
                color: #80d8ff; text-decoration: none; display: block;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            #${WIN_WIDGET_ID} .ig-wn-list a:hover { text-decoration: underline; }
            #${WIN_WIDGET_ID} .ig-wn-close {
                position: absolute; top: 8px; right: 10px;
                width: 24px; height: 24px;
                border: none; border-radius: 50%;
                background: #c62828; color: #fff;
                cursor: pointer; font-weight: bold;
                font-size: 14px; line-height: 1;
            }
            #${WIN_WIDGET_ID} .ig-wn-close:hover { filter: brightness(1.15); }

            /* ===== Mobile / viewports angostos ===== */
            @media (max-width: 600px) {
                /* Overlay de progreso: pasa a ser una barra ancha pegada al
                   tope para no taparse con modales/panel ni con el teclado. */
                #${PROGRESS_OVERLAY_ID} {
                    top: 0; left: 0; right: 0; bottom: auto;
                    width: auto;
                    min-width: 0;
                    padding: 8px 12px 10px;
                    border-radius: 0 0 8px 8px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
                }
                #${PROGRESS_OVERLAY_ID} h4 { font-size: 13px; margin: 0 0 4px; }
                #${PROGRESS_OVERLAY_ID} .ig-prog-status { font-size: 11px; }
                #${PROGRESS_OVERLAY_ID} .ig-prog-bar { margin: 6px 0; }
                #${PROGRESS_OVERLAY_ID} .ig-prog-warning {
                    margin-top: 6px;
                    padding: 4px 6px;
                    font-size: 10px;
                    line-height: 1.25;
                }
                #${PROGRESS_OVERLAY_ID} .ig-prog-actions { margin-top: 8px; }
                #${PROGRESS_OVERLAY_ID} button { padding: 8px 12px; font-size: 12px; }

                /* Cola: ancho completo abajo, altura limitada para no taparse
                   con el overlay del tope ni con la barra del navegador. */
                #${PANEL_ID} {
                    left: 8px; right: 8px; bottom: 8px;
                    width: auto;
                    max-height: 55vh;
                }
                #${PANEL_ID} .ig-q-list { max-height: 35vh; }
                /* Si el overlay de progreso ya muestra su aviso, ocultamos el
                   del header de la cola: dicen lo mismo con otras palabras y en
                   movil el alto es lo que escasea. El del overlay es el que
                   manda, porque ahi si hay una corrida en marcha. */
                body:has(#${PROGRESS_OVERLAY_ID}) #${PANEL_ID} .ig-q-warning-bar {
                    display: none;
                }

                /* Modal Encolar / confirm cola: backdrop scrolleable y modal
                   ajustado para que los botones de accion no queden tapados
                   por el overlay o el teclado virtual. */
                #${MODAL_ID}-backdrop {
                    align-items: flex-start;
                    padding: 60px 0 20px;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                /* Cuando el overlay de progreso esta visible, reservamos mas
                   espacio arriba para que el modal no quede tapado. */
                body:has(#${PROGRESS_OVERLAY_ID}) #${MODAL_ID}-backdrop,
                body:has(#${PROGRESS_OVERLAY_ID}) .ig-confirm-backdrop {
                    padding-top: 180px;
                }
                #${MODAL_ID} {
                    width: 94%;
                    max-width: none;
                    padding: 16px 16px 14px;
                }
                #${MODAL_ID} h3 { font-size: 16px; }
                #${MODAL_ID} .ig-warning { font-size: 11px; padding: 8px 10px; margin-bottom: 10px; }
                #${MODAL_ID} .ig-warning b { font-size: 12px; }
                #${MODAL_ID} .ig-row { font-size: 12px; }
                #${MODAL_ID} input[type="number"] { font-size: 16px; padding: 10px; }
                #${MODAL_ID} .ig-actions {
                    position: sticky;
                    bottom: 0;
                    background: #fff;
                    padding-top: 8px;
                    margin-top: 8px;
                }
                #${MODAL_ID} button { padding: 12px; }

                /* Confirm modal generico (showConfirm): misma logica. */
                .ig-confirm-backdrop {
                    align-items: flex-start;
                    padding: 60px 0 20px;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .ig-confirm-modal { width: 94%; max-width: none; padding: 16px; }

                /* Toasts: full-width arriba, debajo del overlay si lo hay. */
                #ig-toast-container {
                    top: 8px; left: 8px; right: 8px;
                }
                .ig-toast { max-width: none; min-width: 0; }

                /* Widget de saldo: compacto, arriba a la derecha pero MAS ABAJO
                   del header para no tapar los controles de usuario del sitio
                   (avatar / menu) en moviles. Minimizable si aun estorba. */
                #${BALANCE_WIDGET_ID} {
                    top: 64px; right: 8px;
                    padding: 8px 10px;
                    min-width: 0;
                }
                #${BALANCE_WIDGET_ID} .ig-bw-amount { font-size: 18px; }

                /* Widget de premios ganados: ancho completo bajo el estado. */
                #${WIN_WIDGET_ID} {
                    top: 56px; left: 8px; right: 8px;
                    width: auto; transform: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // =============================================
    // TOAST (notificaciones no-bloqueantes)
    // =============================================
    function showToast(message, type) {
        let container = document.getElementById('ig-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ig-toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'ig-toast ig-toast-' + (type || 'info');
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('ig-toast-visible'));
        const dismiss = () => {
            toast.classList.remove('ig-toast-visible');
            setTimeout(() => toast.remove(), 300);
        };
        toast.addEventListener('click', dismiss);
        setTimeout(dismiss, 4500);
    }

    // =============================================
    // CONFIRM MODAL (reemplazo de window.confirm)
    // =============================================
    function showConfirm(message, title) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'ig-confirm-backdrop';
            backdrop.innerHTML = `
                <div class="ig-confirm-modal">
                    ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
                    <p>${escapeHtml(message)}</p>
                    <div class="ig-confirm-actions">
                        <button class="ig-confirm-cancel">${T.modalCancel}</button>
                        <button class="ig-confirm-ok">${T.modalConfirm}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
            const close = (val) => { backdrop.remove(); resolve(val); };
            backdrop.querySelector('.ig-confirm-cancel').addEventListener('click', () => close(false));
            backdrop.querySelector('.ig-confirm-ok').addEventListener('click', () => close(true));
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    close(false);
                }
            });
        });
    }

    // =============================================
    // MODAL: ENCOLAR BOLETOS (Extra Odds → cola unificada)
    // =============================================
    // Devuelve la cantidad solicitada (>=1) o null si se canceló.
    // El tope ya NO es el saldo: se puede encolar de mas y los boletos que no
    // alcancen esperan en la cola (el loop los salta). El tope es
    // CFG.maxEnqueuePerItem, y el saldo se muestra como dato ("alcanzan con tu
    // saldo: N"). Auto-cap: si el usuario tipea > tope, al confirmar se recorta
    // y se avisa con un toast.
    function openEnqueueCountModal(params, contextLabel, opts) {
        opts = opts || {};
        const isRunning = !!opts.isRunning;
        return new Promise((resolve) => {
            const balance = getCurrentBalance();
            const existing = findQueueItem(params.gid);
            const alreadyPending = existing ? itemPending(existing) : 0;
            const affordableNow = maxEnqueueCount(params.price) || 0;
            const maxAdd = CFG.maxEnqueuePerItem;
            if (balance == null) { showToast(T.balanceUnknown, 'error'); resolve(null); return; }

            const available = availableForEnqueue();
            // Por defecto, lo que se puede pagar ya (comportamiento de siempre);
            // si no alcanza para ninguno, 1 — encolar uno y que espere.
            const defaultVal = Math.min(maxAdd, Math.max(1, opts.suggested || affordableNow || 1));

            const backdrop = document.createElement('div');
            backdrop.id = MODAL_ID + '-backdrop';
            backdrop.innerHTML = `
                <div id="${MODAL_ID}">
                    <h3>${T.modalEnqueueTitle}</h3>
                    <div class="ig-warning">
                        <b>${T.warningTitle}</b>
                        ${T.warningBody}
                        <div style="margin-top:6px"><a href="https://docs.indiegala.com/giveaways_auctions_trades/spam.html" target="_blank" rel="noopener">${T.warningPolicyLink}</a></div>
                    </div>
                    <div class="ig-row"><b>${T.modalGiveaway}</b><span>${escapeHtml(contextLabel)}</span></div>
                    <div class="ig-row"><b>${T.modalPrice}</b><span>${params.price} iS</span></div>
                    <div class="ig-row"><b>${T.modalBalance}</b><span>${balance} iS</span></div>
                    <div class="ig-row"><b>${T.modalAvailable}</b><span>${available} iS</span></div>
                    ${alreadyPending > 0 ? `<div class="ig-row"><b>${T.modalAlreadyQueued}</b><span>${alreadyPending}</span></div>` : ''}
                    <div class="ig-row"><b>${T.modalAffordableNow}</b><span>${affordableNow}</span></div>
                    <div class="ig-row"><b>${T.modalMax}</b><span>${maxAdd}</span></div>
                    <label style="display:block;margin-top:10px;font-size:12px;color:#555">${T.modalCountAdd}:</label>
                    <input type="number" id="ig-bulk-count" min="1" max="${maxAdd}" value="${defaultVal}">
                    <div class="ig-inline-error" id="ig-bulk-error"></div>
                    <div class="ig-row"><b>${T.modalTotalCost}</b><span id="ig-bulk-total">${defaultVal * params.price} iS</span></div>
                    <div class="ig-note">${T.modalDelays}</div>
                    <div class="ig-actions">
                        <button class="ig-cancel">${T.modalCancel}</button>
                        <button class="ig-confirm">${T.modalEnqueueConfirm}</button>
                        ${isRunning ? '' : `<button class="ig-confirm-run">${T.modalEnqueueAndRunConfirm}</button>`}
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);

            const input = backdrop.querySelector('#ig-bulk-count');
            const totalSpan = backdrop.querySelector('#ig-bulk-total');
            const errorEl = backdrop.querySelector('#ig-bulk-error');
            const updateTotal = () => {
                const v = parseInt(input.value, 10);
                totalSpan.textContent = (isNaN(v) ? 0 : v * params.price) + ' iS';
                errorEl.classList.remove('ig-visible');
            };
            input.addEventListener('input', updateTotal);
            input.focus();
            input.select();

            const close = (val) => { backdrop.remove(); resolve(val); };
            backdrop.querySelector('.ig-cancel').addEventListener('click', () => close(null));

            // Cantidad validada, o null dejando el error a la vista.
            const readCount = () => {
                let v = parseInt(input.value, 10);
                if (isNaN(v) || v < 1) {
                    errorEl.textContent = fmt(T.invalidCount, { max: maxAdd });
                    errorEl.classList.add('ig-visible');
                    input.focus();
                    input.select();
                    return null;
                }
                if (v > maxAdd) {
                    showToast(fmt(T.enqueueCapped, { n: maxAdd }), 'warn');
                    v = maxAdd;
                }
                return v;
            };
            // Dos salidas distintas: encolar y dejarlo ahi, o encolar y arrancar
            // la cola. Antes eran el mismo boton (la etiqueta cambiaba segun si
            // la cola ya corria), asi que con la cola parada no habia forma de
            // encolar SIN ejecutar — justo lo que hace falta para dejar boletos
            // esperando saldo. Si la cola ya corre, el boton de ejecutar no se
            // pinta: la corrida en curso lo recoge sola.
            const submit = (run) => {
                const v = readCount();
                if (v == null) return;
                close({ count: v, run: !!run });
            };
            backdrop.querySelector('.ig-confirm').addEventListener('click', () => submit(false));
            const runBtn = backdrop.querySelector('.ig-confirm-run');
            if (runBtn) runBtn.addEventListener('click', () => submit(true));
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    close(null);
                }
            });
        });
    }

    // =============================================
    // MODAL: COLA (Single Ticket + Extra Odds unificados)
    // =============================================
    function openQueueConfirmModal() {
        return new Promise((resolve) => {
            const balance = getCurrentBalance();
            if (balance == null) { showToast(T.balanceUnknown, 'error'); resolve(false); return; }
            const totalTickets = queue.reduce((s, q) => s + itemPending(q), 0);
            const totalCost = pendingQueueCost();

            const backdrop = document.createElement('div');
            backdrop.id = MODAL_ID + '-backdrop';
            backdrop.innerHTML = `
                <div id="${MODAL_ID}">
                    <h3>${T.queueExecuteConfirmTitle}</h3>
                    <div class="ig-warning">
                        <b>${T.warningTitle}</b>
                        ${T.warningBody}
                        <div style="margin-top:6px"><a href="https://docs.indiegala.com/giveaways_auctions_trades/spam.html" target="_blank" rel="noopener">${T.warningPolicyLink}</a></div>
                    </div>
                    <div class="ig-row"><b>${T.queueModalCount}</b><span>${totalTickets}</span></div>
                    <div class="ig-row"><b>${T.modalTotalCost}</b><span>${totalCost} iS</span></div>
                    <div class="ig-row"><b>${T.modalBalance}</b><span>${balance} iS</span></div>
                    <div class="ig-note">${T.modalDelays}</div>
                    <div class="ig-actions">
                        <button class="ig-cancel">${T.modalCancel}</button>
                        <button class="ig-confirm">${T.modalConfirm}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);

            const close = (val) => { backdrop.remove(); resolve(val); };
            backdrop.querySelector('.ig-cancel').addEventListener('click', () => close(false));
            backdrop.querySelector('.ig-confirm').addEventListener('click', async () => {
                if (balance < totalCost) {
                    const ok = await showConfirm(
                        fmt(T.queueLowBalance, { balance, cost: totalCost }),
                        T.warningTitle
                    );
                    if (!ok) return;
                }
                close(true);
            });
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    close(false);
                }
            });
        });
    }

    // =============================================
    // OVERLAY DE PROGRESO (compartido)
    // =============================================
    function showProgressOverlay(total, mode) {
        let overlay = document.getElementById(PROGRESS_OVERLAY_ID);
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = PROGRESS_OVERLAY_ID;
        const title = mode === 'queue' ? T.progressTitleQueue : T.progressTitle;
        const warn = mode === 'queue' ? T.warningProgressQueue : T.warningProgress;
        overlay.innerHTML = `
            <h4>${title}</h4>
            <div class="ig-prog-status" id="ig-prog-status">${fmt(T.progressStatus, { i: 0, n: total })}</div>
            <div class="ig-prog-bar"><div class="ig-prog-fill" id="ig-prog-fill"></div></div>
            <div class="ig-prog-warning">${warn}</div>
            <div class="ig-prog-actions"><button id="ig-prog-stop">${T.stopBtn}</button></div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('ig-prog-stop').addEventListener('click', () => { setAbort(); });
    }

    function updateProgress(done, total, statusText) {
        const status = document.getElementById('ig-prog-status');
        const fill = document.getElementById('ig-prog-fill');
        if (status) status.textContent = statusText || fmt(T.progressStatus, { i: done, n: total });
        if (fill) fill.style.width = Math.min(100, Math.round((done / total) * 100)) + '%';
    }

    // Si onContinue es una funcion, se renderiza el boton "Continuar" junto a
    // "Cerrar". Al pulsarlo, se cierra el overlay actual y se invoca el callback
    // (puede mostrar su propia confirmacion antes de re-disparar el loop).
    function finalizeProgress(done, total, finalMsg, onContinue) {
        const overlay = document.getElementById(PROGRESS_OVERLAY_ID);
        if (!overlay) return;
        overlay.querySelector('.ig-prog-status').textContent = finalMsg || fmt(T.progressDone, { ok: done });
        const actions = overlay.querySelector('.ig-prog-actions');
        if (typeof onContinue === 'function') {
            actions.innerHTML = `
                <button class="ig-prog-close">${T.closeBtn}</button>
                <button class="ig-prog-continue">${T.continueBtn}</button>
            `;
            actions.querySelector('.ig-prog-close').addEventListener('click', () => overlay.remove());
            actions.querySelector('.ig-prog-continue').addEventListener('click', async () => {
                overlay.remove();
                try { await onContinue(); } catch (e) { console.error('[IG-BulkTools] onContinue error:', e); }
            });
        } else {
            actions.innerHTML = `<button class="ig-prog-close">${T.closeBtn}</button>`;
            actions.querySelector('.ig-prog-close').addEventListener('click', () => overlay.remove());
        }
    }

    // Reasons que disparan stop con codigo identificable. Mapea status del
    // server (silver/too_fast/banned) y condiciones locales a un codigo
    // interno usado por la logica de "Continuar" (independiente del idioma).
    // 'banned' nunca permite continuar; 'too_fast' pide confirmacion explicita.
    function stopReasonFromCode(code) {
        switch (code) {
            case 'aborted': return T.progressAborted;
            case 'balance_low': return T.progressBalanceLow;
            case 'too_fast': return T.progressTooFast;
            case 'banned': return T.progressBanned;
            case 'timeout': return T.progressJoinTimeout;
            case 'trigger_lost': return T.progressTriggerLost;
            case 'error': return T.progressErrorDetected;
            default: return null;
        }
    }
    function isRecoverableStopCode(code) {
        // 'banned' no es recuperable por politica del servidor; null/undefined
        // significa que el loop termino limpio (no hay nada que continuar).
        return code != null && code !== 'banned';
    }

    // =============================================
    // LOOP: COLA UNIFICADA (singles + extra odds, count por item)
    // opts.skipConfirm: omite el modal (lo usa Continuar tras stop recuperable
    // y tambien el "Encolar y ejecutar" del badge de Extra Odds).
    //
    // El loop lee `queue` directo en cada iteracion (NO snapshot), asi que el
    // usuario puede:
    //   - Encolar items mientras corre (＋ singles, badge bulk): el loop los ve
    //     en la siguiente iteracion.
    //   - Quitar items con × en el panel: si el item en curso es eliminado, el
    //     join en vuelo termina (ya viajo) y el loop salta al siguiente.
    //   - Vaciar la cola: el loop sale limpio porque queue.find no encuentra
    //     pendientes.
    // =============================================
    async function executeQueue(opts) {
        opts = opts || {};
        if (running) { showToast(T.alreadyRunning, 'warn'); return; }
        if (!queue.length) return;

        if (!opts.skipConfirm) {
            const ok = await openQueueConfirmModal();
            if (!ok) return;
        }

        running = true;
        clearAbort();
        renderQueuePanel();

        // Total inicial visible en el progreso. Se recalcula cada tick
        // sumando success ya hechos + pendientes vivos en la cola, asi que
        // crece si el usuario añade y se encoge si quita (UI honesta).
        const initialTotal = queue.reduce((s, q) => s + itemPending(q), 0);
        showProgressOverlay(initialTotal, 'queue');

        let success = 0;        // joins ok totales en esta corrida
        let iteration = 0;       // tick global (para longPause cada N)
        let stopCode = null;
        let silverHits = 0;      // 'silver' del server consecutivos (ver abajo)

        try {
            while (true) {
                if (abortFlag) { stopCode = 'aborted'; break; }
                // Primer item con count>done QUE ADEMAS quepa en el saldo.
                // Un item que no alcanza NO detiene la corrida: se salta y se
                // siguen intentando los demas, asi una cola mixta ya no muere
                // en el primer item caro. Si no queda ninguno ejecutable, el
                // loop termina limpio y el resumen dice cuantos esperan saldo.
                // queue es la fuente viva.
                const balNow = getCurrentBalance();
                const it = queue.find(q => itemPending(q) > 0 && itemAffordable(q, balNow));
                if (!it) break;

                const remainingNow = queue.reduce((s, q) => s + itemPending(q), 0);
                const totalForBar = success + remainingNow;

                if (iteration > 0 && iteration % CFG.longPauseEvery === 0) {
                    updateProgress(success, totalForBar, T.progressLongPause);
                    await abortableSleep(rand(CFG.longPauseMinMs, CFG.longPauseMaxMs));
                    if (abortFlag) { stopCode = 'aborted'; break; }
                }

                const fnName = it.fnName || 'joinGiveawayOrAuction';
                const itemLabel = (it.count || 1) > 1
                    ? `${it.title} [${(it.done || 0) + 1}/${it.count}]`
                    : it.title;
                updateProgress(success, totalForBar, fmt(T.queueProgressItem, {
                    title: itemLabel,
                    i: success + 1,
                    n: totalForBar
                }));

                // Refrescar token, fnArg2 y price desde el DOM si el trigger
                // sigue visible (la pagina puede haber renovado el token).
                let gid = it.gid;
                let price = it.price;
                let token = it.token;
                let fnArg2 = (it.fnArg2 != null) ? it.fnArg2 : it.price;
                let triggerEl = findTrigger({ gid: it.gid, fnName });
                if (triggerEl) {
                    const live = parseJoinOnclick(triggerEl, fnName);
                    if (live) { gid = live.gid; token = live.token; fnArg2 = live.fnArg2; }
                    const liveItem = triggerEl.closest('.items-list-item');
                    const dp = findDataPrice(liveItem || document);
                    // El precio del DOM manda, y lo persistimos en el item: si
                    // subio por encima del saldo hay que dejar constancia, o el
                    // `find` del siguiente tick lo re-elegiria con el precio
                    // viejo y el loop no avanzaria nunca.
                    if (dp != null) {
                        price = dp;
                        if (dp !== it.price) { it.price = dp; saveQueue(); }
                    }
                    if (isErrorVisible(triggerEl)) { stopCode = 'error'; break; }
                }

                // El precio fresco ya no cabe en el saldo: saltar este item sin
                // gastar una peticion. No hubo join, asi que tampoco pausa.
                if (balNow != null && price > balNow) {
                    renderQueuePanel();
                    continue;
                }

                try {
                    // Resolver dinamicamente la fn segun el item. Para extra odds
                    // encolados desde el card detail, fnName='joinGiveawayCard'.
                    // Si el sitio no tiene esa fn definida en este contexto
                    // (estamos en /giveaways y no en /giveaways/card/X), caemos a
                    // joinGiveawayOrAuction como fallback compatible — ambas
                    // hablan con /giveaways/join.
                    let fn = unsafeWindow[fnName];
                    if (typeof fn !== 'function') fn = unsafeWindow.joinGiveawayOrAuction;
                    if (typeof fn !== 'function') { stopCode = 'trigger_lost'; break; }
                    const elForCall = triggerEl || makeFakeAnchor();
                    // Suscribir ANTES del fn.call para no perder el ajaxComplete.
                    // Forzar el flag global del sitio: si el trigger no esta en
                    // el DOM (paginacion / cambio de vista), los callbacks de
                    // animacion no se ejecutan y el flag queda en false,
                    // bloqueando las siguientes iteraciones en silencio.
                    try { unsafeWindow.joinGiveawayOrAuctionAJS = true; } catch (_) {}
                    const joinPromise = awaitNextJoinResponse(CFG.joinResponseTimeoutMs);
                    fn.call(elForCall, elForCall, makeFakeEvent(), gid, fnArg2, token);
                    const result = await joinPromise;
                    if (result.timedOut) { stopCode = 'timeout'; break; }
                    const st = result.status;
                    if (st === 'ok') {
                        success++;
                        silverHits = 0;
                        // Dejar constancia para "ocultar ya participados": si el
                        // sitio deja luego este item colgado en `wait`, el DOM no
                        // dira nada y este registro es lo unico que lo delata.
                        rememberEnteredGid(it.gid);
                        // El item puede haber sido removido por el usuario
                        // mientras esperabamos la respuesta. Re-verificar.
                        const live = findQueueItem(it.gid);
                        if (live) {
                            live.done = (live.done || 0) + 1;
                            if (live.done >= live.count) {
                                removeFromQueue(live.gid);
                            } else {
                                saveQueue();
                                renderQueuePanel();
                                refreshBulkBadges();
                            }
                        }
                        const newRem = queue.reduce((s, q) => s + itemPending(q), 0);
                        updateProgress(success, success + newRem, fmt(T.queueProgressItem, {
                            title: itemLabel,
                            i: success,
                            n: success + newRem
                        }));
                    } else if (st === 'silver') {
                        // El server es la autoridad: nuestro saldo cacheado iba
                        // alto (DOM rancio). Bajamos la cota con lo que acaba de
                        // probar y seguimos: el filtro de la cola saltara este
                        // item y los mas caros, en vez de matar la corrida.
                        // Aun asi cortamos al segundo 'silver' consecutivo —
                        // cada uno es un join fallido, y encadenarlos es justo
                        // lo que dispara el too_fast del sitio. La cota deja el
                        // boton Continuar util: al reintentar ya no repite los
                        // items que no alcanzan.
                        // No hay `continue`: cae al sleep del final del tick,
                        // porque la peticion SI salio y el ritmo importa.
                        silverHits++;
                        clampBalanceBelow(price);
                        if (silverHits >= 2) { stopCode = 'balance_low'; break; }
                        renderQueuePanel();
                    }
                    else if (st === 'too_fast') { stopCode = 'too_fast'; break; }
                    else if (st === 'banned') { stopCode = 'banned'; break; }
                    else if (st === 'duplicate' || st === 'limit_reached' || st === 'not_available' || st === 'level' || st === 'owner') {
                        // 'duplicate' = el servidor confirma que ya tienes boleto.
                        // Es la fuente mas fiable que existe, mejor aun que el DOM.
                        if (st === 'duplicate') rememberEnteredGid(it.gid);
                        // Item invalido para este usuario / no joinable: quitarlo
                        // entero (no tiene sentido reintentar las restantes
                        // copias del mismo gid) y seguir con el siguiente.
                        removeFromQueue(it.gid);
                    }
                    // status === 'server' u otros desconocidos: dejar item con
                    // su pendiente intacto, romper para que el usuario decida
                    // (Continuar / Cerrar) — evita loop infinito si el server
                    // responde algo raro en bucle.
                    else if (st != null && st !== 'ok') {
                        stopCode = 'error';
                        break;
                    }
                } catch (e) {
                    console.error('[IG-BulkTools] error en queue join:', it, e);
                    stopCode = 'error';
                    break;
                }

                iteration++;
                // Sleep entre joins solo si hay mas trabajo pendiente vivo.
                const moreLeft = queue.some(q => itemPending(q) > 0);
                if (moreLeft) {
                    await abortableSleep(rand(CFG.minDelayMs, CFG.maxDelayMs));
                }
            }
        } finally {
            running = false;
            const finalRem = queue.reduce((s, q) => s + itemPending(q), 0);
            const finalTotal = success + finalRem;
            // Boletos que quedaron pendientes solo por saldo: el loop los salto
            // en vez de parar, asi que hay que decirlo o el usuario ve la cola
            // con restos y ningun motivo a la vista.
            const balEnd = getCurrentBalance();
            const waiting = queue.reduce(
                (s, q) => s + (itemAffordable(q, balEnd) ? 0 : itemPending(q)), 0);
            const stopReason = stopReasonFromCode(stopCode);
            const finalMsg = stopReason
                ? `${stopReason} (${success}/${finalTotal})`
                : (waiting > 0
                    ? fmt(T.queueDoneSkipped, { ok: success, n: finalTotal, w: waiting })
                    : fmt(T.queueDone, { ok: success, n: finalTotal }));

            // Boton "Continuar": permitido si la causa es recuperable y aun
            // queda algun pendiente en la cola viva.
            let onContinue = null;
            if (isRecoverableStopCode(stopCode) && finalRem > 0) {
                const codeAtBreak = stopCode;
                onContinue = async () => {
                    if (codeAtBreak === 'too_fast') {
                        const ok = await showConfirm(T.continueTooFastWarning, T.warningTitle);
                        if (!ok) return;
                    }
                    await executeQueue({ skipConfirm: true });
                };
            }
            finalizeProgress(success, Math.max(1, finalTotal), finalMsg, onContinue);
            renderQueuePanel();
            resyncBalanceAfterRun();
        }
    }

    // =============================================
    // PANEL FLOTANTE DE LA COLA (solo en /giveaways)
    // =============================================
    function renderQueuePanel() {
        const existing = document.getElementById(PANEL_ID);

        // Si no estamos en el listado raiz, ocultar el panel pero mantener la cola persistida
        if (!isListingRoot()) {
            if (existing) existing.remove();
            return;
        }

        let panel = existing;
        if (!panel) {
            panel = document.createElement('div');
            panel.id = PANEL_ID;
            document.body.appendChild(panel);
        }
        if (!queue.length) {
            panel.style.display = 'none';
            panel.innerHTML = '';
            return;
        }
        panel.style.display = '';
        const totalTickets = queue.reduce((s, q) => s + itemPending(q), 0);
        const totalCost = pendingQueueCost();
        // El primer item con pendientes es el "en curso" si running=true.
        const balForRows = getCurrentBalance();
        // El "en curso" es el primer item ejecutable, no el primer pendiente:
        // los que no alcanzan se saltan, asi que resaltar uno de esos mentiria.
        const activeGid = running
            ? (queue.find(q => itemPending(q) > 0 && itemAffordable(q, balForRows)) || {}).gid
            : null;

        // El MutationObserver re-dispara injectAll() (y por ende este render)
        // cada vez que el sitio toca el DOM por AJAX/carrusel. Reescribir
        // innerHTML resetea scrollTop de la lista a 0, asi que el scroll del
        // usuario "rebota" al inicio. Para evitarlo, solo reconstruimos cuando
        // el contenido visible cambio de verdad: firma = items pendientes +
        // totales + item activo + estado running. Si la firma no cambio,
        // salimos sin tocar el DOM y el scroll se preserva.
        // `b` (saldo) entra en la firma porque de el depende que filas salgan
        // atenuadas: sin el, subir de saldo no repintaria el panel.
        const sig = JSON.stringify({
            r: running,
            a: activeGid,
            t: totalTickets,
            c: totalCost,
            b: balForRows,
            items: queue.map(q => [q.gid, q.title, itemPending(q), q.price || 0, q.count || 1, q.done || 0])
        });
        if (panel.dataset.sig === sig && panel.querySelector('.ig-q-list')) return;
        panel.dataset.sig = sig;

        const lastIdx = queue.length - 1;
        const items = queue.map((q, idx) => {
            const pending = itemPending(q);
            const totalForRow = pending * (q.price || 0);
            const multi = (q.count || 1) > 1;
            const countLabel = multi ? `<span class="ig-q-it-count" title="${q.done || 0}/${q.count}">×${pending}</span>` : '';
            const isActive = q.gid === activeGid;
            const noFunds = !itemAffordable(q, balForRows);
            const waitLabel = noFunds
                ? `<span class="ig-q-it-wait" title="${escapeHtml(T.queueItemNoFunds)}">⏳</span>`
                : '';
            return `
                <li class="${isActive ? 'ig-q-li-active' : ''}${noFunds ? ' ig-q-li-nofunds' : ''}">
                    <span class="ig-q-it-title" title="${escapeHtml(q.title)} — ${escapeHtml(q.timeLeft || '')}${noFunds ? ' · ' + escapeHtml(T.queueItemNoFunds) : ''}">${escapeHtml(q.title)}</span>
                    ${countLabel}
                    ${waitLabel}
                    <span class="ig-q-it-price">${totalForRow} iS</span>
                    <button class="ig-q-it-mv" data-gid="${escapeHtml(q.gid)}" data-dir="-1" title="${T.queueMoveUp}"${idx === 0 ? ' disabled' : ''}>▲</button>
                    <button class="ig-q-it-mv" data-gid="${escapeHtml(q.gid)}" data-dir="1" title="${T.queueMoveDown}"${idx === lastIdx ? ' disabled' : ''}>▼</button>
                    <button class="ig-q-it-rem" data-gid="${escapeHtml(q.gid)}" title="${T.queueRemoveBtnTooltip}">×</button>
                </li>
            `;
        }).join('');
        // Reordenar SI cambia la firma, asi que aqui se reescribe el innerHTML y
        // el scroll de la lista se iria al inicio en cada ▲▼ — insufrible al
        // mover un item varias posiciones en una cola larga. Se guarda y repone.
        const prevList = panel.querySelector('.ig-q-list');
        const prevScroll = prevList ? prevList.scrollTop : 0;
        panel.innerHTML = `
            <div class="ig-q-warning-bar">${T.warningQueuePanel}</div>
            <div class="ig-q-head">
                <h4>${T.queuePanelTitle}</h4>
                <button type="button" id="ig-q-min" class="ig-q-min"></button>
            </div>
            <div class="ig-q-summary">${fmt(T.queueTotalCost, { n: totalTickets, cost: totalCost })}</div>
            <ul class="ig-q-list">${items}</ul>
            <div class="ig-q-actions">
                <button id="ig-q-clear">${T.queueClearBtn}</button>
                <button id="ig-q-exec"${running ? ' disabled' : ''}>${T.queueExecuteBtn}</button>
            </div>
        `;
        const newList = panel.querySelector('.ig-q-list');
        if (newList && prevScroll) newList.scrollTop = prevScroll;

        panel.querySelector('#ig-q-min').addEventListener('click', (e) => {
            e.preventDefault();
            settings.queueMin = !settings.queueMin;
            saveSettings();
            applyQueueMinState(panel);
        });
        panel.querySelectorAll('.ig-q-it-mv').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                moveInQueue(b.dataset.gid, parseInt(b.dataset.dir, 10));
            });
        });
        panel.querySelectorAll('.ig-q-it-rem').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromQueue(b.dataset.gid);
            });
        });
        panel.querySelector('#ig-q-clear').addEventListener('click', async () => {
            const ok = await showConfirm(T.queueClearConfirm);
            if (ok) clearQueue();
        });
        panel.querySelector('#ig-q-exec').addEventListener('click', executeQueue);
        applyQueueMinState(panel);
    }

    // Refleja en el DOM el estado minimizado del panel de cola: colapsa todo
    // menos el header (titulo + boton restaurar) y ajusta glifo/tooltip. Idempotente.
    function applyQueueMinState(panel) {
        if (!panel) return;
        const min = !!settings.queueMin;
        panel.classList.toggle('ig-q-collapsed', min);
        const btn = panel.querySelector('#ig-q-min');
        if (btn) {
            btn.textContent = min ? '▢' : '–';
            btn.title = min ? T.queueRestore : T.queueMinimize;
        }
    }

    function refreshQueueButtonsState() {
        // "Disponible" para singles = saldo - cola pendiente. Si no alcanza, el
        // ＋ NO se deshabilita: encolar sin saldo esta permitido y el boleto
        // espera en la cola. Solo se marca como "en espera" (atenuado + tooltip)
        // para que quede claro que no se comprara todavia.
        const avail = availableForEnqueue();
        document.querySelectorAll('.' + QBTN_CLASS).forEach(btn => {
            const gid = btn.dataset.gid;
            const price = parseInt(btn.dataset.price, 10);
            const inQ = isInQueue(gid);
            const willWait = !inQ && avail != null && (!isNaN(price) ? avail < price : avail <= 0);
            btn.classList.toggle('ig-q-btn-active', inQ);
            btn.classList.toggle('ig-q-btn-wait', willWait);
            btn.textContent = inQ ? T.queueRemoveBtn : T.queueAddBtn;
            btn.title = inQ
                ? T.queueRemoveBtnTooltip
                : (willWait ? T.queueWaitsForBalance : T.queueAddBtnTooltip);
        });
    }

    // =============================================
    // WIDGET DE SALDO GALASILVER + REVISAR PREMIOS
    // =============================================
    // Refleja en el DOM el estado minimizado del widget de saldo: colapsa el
    // cuerpo (todo menos el header) y ajusta glifo/tooltip del boton. Idempotente.
    function applyBalanceMinState(w) {
        if (!w) return;
        const min = !!settings.balanceMin;
        w.classList.toggle('ig-bw-collapsed', min);
        const btn = w.querySelector('#ig-bw-min');
        if (btn) {
            btn.textContent = min ? '▢' : '–';
            btn.title = min ? T.widgetRestore : T.widgetMinimize;
        }
    }

    // Widget flotante (solo en paginas de giveaways) que muestra el saldo
    // GalaSilver y, debajo, un boton que abre la biblioteca en una pestaña
    // nueva con el flag de auto-revision. Idempotente: crea el nodo la primera
    // vez y solo refresca textos en llamadas posteriores. Se llama desde
    // injectAll (periodico) y desde los puntos donde cambia el saldo.

    // --- Modal "Saber más" (autocontenido) --------------------------------------
    function showAboutModal() {
        if (document.getElementById('ig-about-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'ig-about-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', zIndex: '2147483647',
            transition: 'opacity 180ms ease', opacity: '0'
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            background: '#1b1230', color: '#f3eefb', borderRadius: '14px',
            padding: '26px 30px', minWidth: '320px', maxWidth: '580px',
            maxHeight: '80vh', overflowY: 'auto', boxSizing: 'border-box',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid #b14cff',
            fontFamily: 'system-ui, sans-serif', fontSize: '14px', lineHeight: '1.5',
            transform: 'translateY(8px) scale(0.98)', opacity: '0',
            transition: 'transform 180ms ease, opacity 180ms ease'
        });
        const title = document.createElement('div');
        title.textContent = TX.aboutTitle;
        title.style.cssText = 'font-weight:bold;font-size:17px;margin-bottom:14px;color:#c88bff;';
        box.appendChild(title);
        (TX.aboutBody || []).forEach((p) => {
            const row = document.createElement('div');
            const trimmed = String(p).replace(/^\s+/, '');
            row.textContent = trimmed;
            row.style.marginBottom = '8px';
            if (trimmed.startsWith('•')) row.style.paddingLeft = '10px';
            if (trimmed.startsWith('⚠')) { row.style.color = '#ffcf66'; row.style.fontWeight = '600'; }
            // '▸' marca encabezado de grupo. Son ~19 puntos y sin jerarquia no
            // se leen; aqui no hay markdown (esto va por textContent), asi que
            // el marcador es la unica via. Se consume: es estructura, no texto.
            if (trimmed.startsWith('▸')) {
                row.textContent = trimmed.slice(1).trim();
                row.style.color = '#c88bff';
                row.style.fontWeight = '700';
                row.style.marginTop = '14px';
            }
            box.appendChild(row);
        });
        const gh = document.createElement('a');
        gh.href = 'https://github.com/g31w0fw0rld/indiegala-bulk-join';
        gh.target = '_blank'; gh.rel = 'noopener';
        gh.textContent = 'github.com/g31w0fw0rld/indiegala-bulk-join';
        gh.style.cssText = 'display:inline-block;margin-top:6px;color:#c88bff;text-decoration:underline;font-size:12px;';
        box.appendChild(gh);
        const kofi = document.createElement('a');
        kofi.href = 'https://ko-fi.com/g31w0fw0rld';
        kofi.target = '_blank'; kofi.rel = 'noopener';
        kofi.textContent = '☕ Apóyame en Ko-fi / Support me on Ko-fi';
        kofi.style.cssText = 'display:block;margin-top:8px;color:#c88bff;text-decoration:underline;font-size:12px;';
        box.appendChild(kofi);
        const foot = document.createElement('div');
        foot.textContent = 'v' + SCRIPT_VERSION + ' · g31w0fw0rld';
        foot.style.cssText = 'margin-top:2px;font-size:12px;opacity:0.7;';
        box.appendChild(foot);
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = TX.close;
        closeBtn.style.cssText = 'display:block;margin-top:16px;padding:8px 14px;background:#b14cff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;';
        box.appendChild(closeBtn);
        const closeIt = () => {
            overlay.style.opacity = '0'; box.style.opacity = '0';
            box.style.transform = 'translateY(8px) scale(0.98)';
            document.removeEventListener('keydown', onKey);
            setTimeout(() => overlay.remove(), 180);
        };
        const onKey = (e) => { if (e.key === 'Escape') closeIt(); };
        closeBtn.addEventListener('click', closeIt);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeIt(); });
        document.addEventListener('keydown', onKey);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'translateY(0) scale(1)';
            box.style.opacity = '1';
        }, 10);
    }

    function renderBalanceWidget() {
        if (isLibrary()) {
            const ex = document.getElementById(BALANCE_WIDGET_ID);
            if (ex) ex.remove();
            return;
        }
        if (!document.body) return;
        let w = document.getElementById(BALANCE_WIDGET_ID);
        if (!w) {
            const langOptionsHtml = [
                { v: '', label: TX.langAuto },
                { v: 'es', label: 'Español' },
                { v: 'en', label: 'English' }
            ].map((o) => `<option value="${o.v}"${o.v === LANG_PREF ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
            w = document.createElement('div');
            w.id = BALANCE_WIDGET_ID;
            w.innerHTML = `
                <div class="ig-bw-head">
                    <div class="ig-bw-title">${T.widgetTitle}</div>
                    <button type="button" class="ig-bw-min" id="ig-bw-min"></button>
                </div>
                <div class="ig-bw-body">
                    <div class="ig-bw-amount" id="ig-bw-amount">${T.widgetBalanceUnknown}</div>
                    <div class="ig-bw-avail" id="ig-bw-avail" style="display:none"></div>
                    <div class="ig-bw-credit" id="ig-bw-credit" style="display:none"></div>
                    <label class="ig-bw-toggle" title="${escapeHtml(T.widgetRememberFiltersTooltip)}">
                        <input type="checkbox" id="ig-bw-remember-filters">
                        <span>${T.widgetRememberFilters}</span>
                    </label>
                    <label class="ig-bw-toggle" title="${escapeHtml(T.widgetHideEnteredTooltip)}">
                        <input type="checkbox" id="ig-bw-hide-entered">
                        <span>${T.widgetHideEntered}</span>
                    </label>
                    <label class="ig-bw-toggle" id="ig-bw-show-ignored-row" style="display:none" title="${escapeHtml(T.widgetShowIgnoredTooltip)}">
                        <input type="checkbox" id="ig-bw-show-ignored">
                        <span>${T.widgetShowIgnored}</span>
                    </label>
                    <label class="ig-bw-toggle" title="${escapeHtml(TX.langTip)}">
                        <span>${TX.langLabel}</span>
                        <select id="ig-bw-lang" style="margin-left:4px;">${langOptionsHtml}</select>
                    </label>
                    <button type="button" class="ig-bw-btn" id="ig-bw-check" title="${escapeHtml(T.widgetCheckBtnTooltip)}">${T.widgetCheckBtn}</button>
                    <button type="button" class="ig-bw-btn" id="ig-bw-clear-ignored" style="display:none" title="${escapeHtml(T.widgetClearIgnoredTooltip)}"></button>
                    <button type="button" class="ig-bw-btn ig-bw-about" id="ig-bw-about" title="${escapeHtml(TX.aboutTip)}">${TX.about}</button>
                </div>
            `;
            document.body.appendChild(w);
            w.querySelector('#ig-bw-check').addEventListener('click', (e) => {
                e.preventDefault();
                window.open(LIBRARY_URL + '#' + AUTOCHECK_HASH, '_blank', 'noopener');
            });
            // Selector de idioma del script: guarda la preferencia y recarga para
            // re-renderizar todos los textos con el nuevo idioma.
            const langSel = w.querySelector('#ig-bw-lang');
            if (langSel) langSel.addEventListener('change', () => { saveLangPref(langSel.value); location.reload(); });
            // Botón "Saber más".
            const aboutBtn = w.querySelector('#ig-bw-about');
            if (aboutBtn) aboutBtn.addEventListener('click', (e) => { e.preventDefault(); showAboutModal(); });
            // Toggle "Ocultar ya participados": persiste y re-aplica al instante.
            const hideChk = w.querySelector('#ig-bw-hide-entered');
            hideChk.addEventListener('change', () => {
                settings.hideEntered = hideChk.checked;
                saveSettings();
                applyHideEntered();
            });
            // Toggle "Mostrar ocultos": no borra nada, solo cambia si los
            // ignorados se esconden o se ven atenuados (con su boton de ↺).
            const showIgnChk = w.querySelector('#ig-bw-show-ignored');
            showIgnChk.addEventListener('change', () => {
                settings.showIgnored = showIgnChk.checked;
                saveSettings();
                applyIgnored();
            });
            // "Limpiar ignorados": destructivo y sin deshacer, de ahi el confirm.
            const clearIgnBtn = w.querySelector('#ig-bw-clear-ignored');
            clearIgnBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const n = ignoredCount();
                if (!n) return;
                const ok = await showConfirm(fmt(T.clearIgnoredConfirm, { n }));
                if (!ok) return;
                clearIgnoredGids();
                applyIgnored();
                refreshIgnoredWidget();
                showToast(fmt(T.clearIgnoredDone, { n }), 'success');
            });
            // Toggle "Recordar filtros de busqueda": al activarlo, snapshotea el
            // estado actual para que sobreviva la proxima recarga.
            const remChk = w.querySelector('#ig-bw-remember-filters');
            remChk.addEventListener('change', () => {
                settings.rememberFilters = remChk.checked;
                saveSettings();
                if (remChk.checked) { try { captureFilters(true); } catch (_) {} }
            });
            // Minimizar / restaurar el widget (estado persistente).
            w.querySelector('#ig-bw-min').addEventListener('click', (e) => {
                e.preventDefault();
                settings.balanceMin = !settings.balanceMin;
                saveSettings();
                applyBalanceMinState(w);
            });
        }
        // Sincroniza checkbox y estado minimizado con las preferencias guardadas.
        const hideChk = w.querySelector('#ig-bw-hide-entered');
        if (hideChk) hideChk.checked = !!settings.hideEntered;
        const remChk = w.querySelector('#ig-bw-remember-filters');
        if (remChk) remChk.checked = !!settings.rememberFilters;
        refreshIgnoredWidget();
        applyBalanceMinState(w);
        const bal = getCurrentBalance();
        const amountEl = w.querySelector('#ig-bw-amount');
        if (amountEl) amountEl.textContent = (bal == null) ? T.widgetBalanceUnknown : (bal + ' iS');
        const availEl = w.querySelector('#ig-bw-avail');
        if (availEl) {
            const pendingCost = pendingQueueCost();
            // Con la cola por encima del saldo, "Disponible: 0" esconde el dato
            // que importa (cuanto falta), asi que ahi se informa el faltante.
            if (bal != null && pendingCost > bal) {
                availEl.style.display = '';
                availEl.classList.add('ig-bw-short');
                availEl.textContent = fmt(T.widgetShortfall, { n: pendingCost - bal });
            } else if (bal != null && pendingCost > 0) {
                availEl.style.display = '';
                availEl.classList.remove('ig-bw-short');
                availEl.textContent = fmt(T.widgetAvailable, { n: bal - pendingCost });
            } else {
                availEl.style.display = 'none';
            }
        }
        const creditEl = w.querySelector('#ig-bw-credit');
        if (creditEl) {
            const credit = getGalaCredit();
            if (credit != null) {
                creditEl.style.display = '';
                creditEl.textContent = fmt(T.widgetGalaCredit, { v: credit });
            } else {
                creditEl.style.display = 'none';
            }
        }
    }

    // =============================================
    // ENCOLAR EXTRA ODDS (badge / card detail)
    // =============================================
    // Abre el modal de cantidad, encola N copias del gid, y si la cola no
    // estaba corriendo arranca executeQueue (skipConfirm). Si ya corre, solo
    // encola y la corrida en curso lo recogera en la siguiente iteracion.
    async function enqueueExtraOddsFlow(params, contextLabel) {
        const wasRunning = running;
        const res = await openEnqueueCountModal(params, contextLabel, { isRunning: wasRunning });
        if (!res || !res.count) return;
        const n = res.count;
        // Comprobar el presupuesto ANTES de encolar: despues, lo que acabamos de
        // añadir ya cuenta como comprometido y el numero saldria en negativo
        // aunque hubiera saldo de sobra.
        const availBefore = availableForEnqueue();
        addToQueue({
            gid: params.gid,
            title: contextLabel,
            timeLeft: '',
            fnName: params.fnName || 'joinGiveawayOrAuction',
            price: params.price,
            fnArg2: params.fnArg2,
            token: params.token,
            count: n,
            done: 0,
            type: 'bulk',
            addedAt: Date.now()
        });
        const shortOnBudget = availBefore != null && availBefore < n * params.price;
        if (wasRunning) {
            showToast(fmt(T.enqueuedAddedRunning, { n }), 'info');
        } else if (res.run) {
            // Atajo "encolar y ejecutar": el usuario ya confirmo la cantidad
            // en el modal, no hace falta el modal de cola otra vez.
            executeQueue({ skipConfirm: true });
        } else if (shortOnBudget) {
            // Encolado a proposito por encima del saldo: decirlo, o el panel
            // aparece con boletos en ⏳ sin explicacion.
            showToast(T.queueWaitsForBalance, 'warn');
        }
    }

    // =============================================
    // AUTO-REVISION DE PREMIOS EN /library
    // =============================================
    // Espera (via MutationObserver + timeout) a que aparezca el primer elemento
    // que matchee `selector`. Resuelve con el elemento o null si se agota el
    // tiempo. La biblioteca renderiza pestañas/subsecciones por AJAX, asi que
    // los elementos no estan al cargar la pagina.
    function waitForElement(selector, timeoutMs) {
        return new Promise((resolve) => {
            const found = document.querySelector(selector);
            if (found) { resolve(found); return; }
            let done = false;
            const finish = (el) => {
                if (done) return;
                done = true;
                try { obs.disconnect(); } catch (_) {}
                clearTimeout(timer);
                resolve(el);
            };
            const obs = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) finish(el);
            });
            obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
            const timer = setTimeout(() => finish(null), timeoutMs);
        });
    }

    // Caja de estado fija (arriba-centro) para la secuencia en /library.
    function showLibraryStatus(msg, isError) {
        let box = document.getElementById(LIB_STATUS_ID);
        if (!box) {
            box = document.createElement('div');
            box.id = LIB_STATUS_ID;
            document.body.appendChild(box);
        }
        box.classList.toggle('ig-lib-status-error', !!isError);
        box.textContent = msg;
    }

    // Dispara la accion del ancla. Prefiere invocar la funcion global del sitio
    // directamente (evita el salto de href="#" y no depende de event.isTrusted);
    // si no existe en este contexto, cae a un click DOM real.
    function fireSiteAction(el, fnName, args) {
        try {
            const fn = (typeof unsafeWindow !== 'undefined') ? unsafeWindow[fnName] : window[fnName];
            if (typeof fn === 'function') {
                fn.apply(el, args);
                return true;
            }
        } catch (e) {
            console.warn('[IG-BulkTools] fireSiteAction', fnName, e);
        }
        try { el.click(); return true; } catch (_) { return false; }
    }

    const LIB_WAIT_MS = 20000;
    const libSettle = () => abortableSleep(rand(700, 1300));

    // ---- Premios ganados "vistos" (persistente) -------------------------------
    function loadSeenWins() {
        try {
            let raw = null;
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(SEEN_WINS_KEY, null);
                if (Array.isArray(v)) raw = v;
                else if (typeof v === 'string') { try { raw = JSON.parse(v); } catch (_) { raw = null; } }
            }
            if (!Array.isArray(raw)) {
                const s = localStorage.getItem(SEEN_WINS_KEY);
                raw = s ? JSON.parse(s) : [];
            }
            return Array.isArray(raw) ? raw.map(String) : [];
        } catch (e) {
            console.error('[IG-BulkTools] loadSeenWins error:', e);
            return [];
        }
    }
    function saveSeenWins(arr) {
        try {
            const json = JSON.stringify(arr);
            if (typeof GM_setValue !== 'undefined') GM_setValue(SEEN_WINS_KEY, json);
            localStorage.setItem(SEEN_WINS_KEY, json);
        } catch (e) {
            console.error('[IG-BulkTools] saveSeenWins error:', e);
        }
    }

    // "13 May 2026, 09:15" → {d, mo, y} (mes 0-based) o null si no es una fecha.
    const WON_MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    function parseWonDate(str) {
        const m = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(String(str || ''));
        if (!m) return null;
        const mo = WON_MONTHS[m[2].slice(0, 3).toLowerCase()];
        if (mo == null) return null;
        return { d: parseInt(m[1], 10), mo, y: parseInt(m[3], 10) };
    }

    // Recorre las filas de "Completed won" y devuelve [{gid, title}] cuya columna
    // "Time end" tenga fecha de HOY (ignorando la hora). El listado viene ordenado
    // por fecha descendente, asi que los de hoy estan en la primera pagina.
    function collectTodayWins() {
        const now = new Date();
        const td = now.getDate(), tmo = now.getMonth(), ty = now.getFullYear();
        const out = [];
        document.querySelectorAll('#giveaways-completed-won li.profile-private-sub-section-body').forEach(li => {
            const link = li.querySelector('a[href*="/giveaways/card/"]');
            if (!link) return;
            const href = link.getAttribute('href') || '';
            const gid = (href.match(/\/(\d+)(?:[?#]|$)/) || [])[1] || href.split('/').pop();
            const title = (link.textContent || '').trim() || ('#' + gid);
            // La primera celda que parsee como fecha es "Time end" (img/título/
            // creador no matchean; el serial key tampoco).
            let date = null;
            const cells = li.querySelectorAll('.profile-private-sub-section-col-inner');
            for (let i = 0; i < cells.length && !date; i++) date = parseWonDate(cells[i].textContent);
            if (!date) return;
            if (date.d === td && date.mo === tmo && date.y === ty) out.push({ gid: String(gid), title, href });
        });
        return out;
    }

    // Widget propio en-pagina para anunciar los premios ganados hoy. No usamos
    // notificaciones del navegador: igual que en los scripts de Twitch/Kick, el
    // aviso vive dentro de la pagina con su propio widget. Persistente hasta que
    // el usuario lo cierra; lista cada premio con enlace a su giveaway.
    function showWinWidget(wins) {
        const old = document.getElementById(WIN_WIDGET_ID);
        if (old) old.remove();
        const w = document.createElement('div');
        w.id = WIN_WIDGET_ID;
        const items = wins.map(win => {
            // Solo rutas relativas same-origin del propio sitio ("/..." pero no
            // "//..."): rechaza javascript:, data:, vbscript: y absolutas, que el
            // escape de comillas no neutraliza.
            const safeHref = /^\/(?!\/)/.test(String(win.href || '')) ? win.href : '#';
            return `
            <li><a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener" title="${escapeHtml(win.title)}">${escapeHtml(win.title)}</a></li>
        `;
        }).join('');
        w.innerHTML = `
            <button type="button" class="ig-wn-close" title="${escapeHtml(T.closeBtn)}">×</button>
            <div class="ig-wn-title">${escapeHtml(fmt(T.winWidgetTitle, { n: wins.length }))}</div>
            <ul class="ig-wn-list">${items}</ul>
        `;
        document.body.appendChild(w);
        w.querySelector('.ig-wn-close').addEventListener('click', () => { try { w.remove(); } catch (_) {} });
    }

    // Beep de aviso (Web Audio, best-effort: la pestaña puede bloquear el audio
    // sin un gesto previo del usuario). Pequeno arpegio ascendente.
    function playWinBeep() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.connect(g); g.connect(ctx.destination);
            const t0 = ctx.currentTime;
            o.frequency.setValueAtTime(880, t0);
            o.frequency.setValueAtTime(1175, t0 + 0.12);
            g.gain.setValueAtTime(0.06, t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
            o.start(t0);
            o.stop(t0 + 0.42);
            o.onended = () => { try { ctx.close(); } catch (_) {} };
        } catch (_) {}
    }

    // Detecta premios ganados hoy en "Completed won", anuncia solo los que no
    // habiamos visto antes (widget propio in-page + beep + toast) y los marca
    // como vistos (persistente). Al abrir esta subseccion el propio sitio da por
    // vista la notificacion de ganado.
    function announceTodayWins() {
        let wins = [];
        try { wins = collectTodayWins(); } catch (e) { console.error('[IG-BulkTools] collectTodayWins:', e); }
        const seen = loadSeenWins();
        const fresh = wins.filter(w => seen.indexOf(w.gid) === -1);
        if (!fresh.length) { showLibraryStatus(T.libNoNewWins); return; }
        saveSeenWins(seen.concat(fresh.map(w => w.gid)));

        const status = fmt(T.libWonStatus, { n: fresh.length });
        showLibraryStatus(status);
        try { showToast(status, 'success'); } catch (_) {}
        // Badge en el titulo de la pestaña, como en Twitch/Kick.
        try { document.title = '(' + fresh.length + ') ' + document.title.replace(/^\(\d+\)\s*/, ''); } catch (_) {}

        showWinWidget(fresh);
        playWinBeep();
    }

    // Secuencia: Giveaways → Completed to check → Check all → Completed won. Cada
    // paso espera a que el elemento exista antes de disparar la accion, con un
    // settle entre clics para dar tiempo al render AJAX del sitio.
    async function runLibraryAutoCheck() {
        if (runLibraryAutoCheck._started) return;
        runLibraryAutoCheck._started = true;

        // Limpiar el flag del hash para que un reload manual no re-dispare.
        try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}

        try { injectStyles(); } catch (_) {}
        showLibraryStatus(T.libAutoStart);

        // 1) Pestaña Giveaways
        const gvTab = await waitForElement('a[onclick*="switchLibraryTab(\'giveaways\'"]', LIB_WAIT_MS);
        if (!gvTab) { showLibraryStatus(T.libElementNotFound, true); return; }
        await libSettle();
        showLibraryStatus(T.libClickGiveaways);
        fireSiteAction(gvTab, 'switchLibraryTab', ['giveaways', gvTab, makeFakeEvent()]);

        // 2) Subseccion "Completed to check"
        await libSettle();
        const compTab = await waitForElement('a[onclick*="giveaways-completed-tocheck"]', LIB_WAIT_MS);
        if (!compTab) { showLibraryStatus(T.libElementNotFound, true); return; }
        await libSettle();
        showLibraryStatus(T.libClickCompleted);
        fireSiteAction(compTab, 'switchSubSection', [compTab, makeFakeEvent(), 'giveaways-completed-tocheck']);

        // 3) "Completed to check": o existe el boton "Check all" (hay giveaways
        // por revisar) o la lista esta vacia y el sitio pinta
        // ".profile-private-page-library-no-results" ("This list is actually
        // empty."). Esperamos a CUALQUIERA de los dos. En ambos casos seguimos a
        // "Completed won".
        await libSettle();
        const tocheckState = await waitForElement(
            'a.library-giveaways-check-all-btn, #giveaways-completed-tocheck .profile-private-page-library-no-results',
            LIB_WAIT_MS
        );
        if (!tocheckState) { showLibraryStatus(T.libElementNotFound, true); return; }
        await libSettle();
        const checkAll = document.querySelector('a.library-giveaways-check-all-btn');
        if (checkAll) {
            showLibraryStatus(T.libClickCheckAll);
            fireSiteAction(checkAll, 'giveawayCheckIfWinnerAll', [checkAll, makeFakeEvent()]);
            // El "Check all" revisa cada giveaway por AJAX y puede tardar; damos un
            // margen amplio antes de cambiar de subseccion para no cortarlo.
            await abortableSleep(rand(3000, 5000));
        } else {
            // Lista vacia: nada por revisar. Igual seguimos a "Completed won".
            showLibraryStatus(T.libNothingToCheck);
            await libSettle();
        }

        // 4) Subseccion "Completed won".
        const wonTab = await waitForElement('a[onclick*="giveaways-completed-won"]', LIB_WAIT_MS);
        if (!wonTab) { showLibraryStatus(T.libElementNotFound, true); return; }
        await libSettle();
        showLibraryStatus(T.libClickWon);
        fireSiteAction(wonTab, 'switchSubSection', [wonTab, makeFakeEvent(), 'giveaways-completed-won']);

        // 5) Esperar a que "Completed won" cargue (filas o lista vacia) y detectar
        // premios cuya fecha de "Time end" sea hoy; anunciar solo los nuevos.
        showLibraryStatus(T.libCheckingWon);
        await waitForElement(
            '#giveaways-completed-won li.profile-private-sub-section-body, #giveaways-completed-won .profile-private-page-library-no-results',
            LIB_WAIT_MS
        );
        await abortableSleep(rand(800, 1400));
        announceTodayWins();

        const box = document.getElementById(LIB_STATUS_ID);
        if (box) setTimeout(() => { try { box.remove(); } catch (_) {} }, 8000);
    }

    // =============================================
    // VIGILANTE DE WHEEL OF FORTUNE (auto-refresh /giveaways)
    // =============================================
    // Normaliza HTML a una firma comparable: quita comentarios, colapsa espacios
    // entre tags y en general, y pasa a minusculas. Asi diferencias triviales de
    // formato no cuentan como "cambio".
    function normalizeHtmlSig(s) {
        return String(s || '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/>\s+</g, '><')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
    const WHEEL_BASELINE_SIG = normalizeHtmlSig(WHEEL_BASELINE_HTML);

    // true si el usuario esta en medio de algo que no conviene interrumpir con
    // un reload: un modal (encolar / confirm) o el overlay de progreso/resultado
    // de la cola abiertos.
    function isUserBusy() {
        return !!document.querySelector(
            '#' + MODAL_ID + '-backdrop, .ig-confirm-backdrop, #' + PROGRESS_OVERLAY_ID
        );
    }

    // -------- Estado persistente del vigilante de la ruleta --------
    function loadWheelState() {
        const def = { baselineSig: null, relearn: false, lastPrize: null };
        try {
            let raw = null;
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(WHEEL_STATE_KEY, null);
                if (v && typeof v === 'object' && !Array.isArray(v)) raw = v;
                else if (typeof v === 'string') { try { raw = JSON.parse(v); } catch (_) { raw = null; } }
            }
            if (!raw) {
                const s = localStorage.getItem(WHEEL_STATE_KEY);
                raw = s ? JSON.parse(s) : null;
            }
            return Object.assign(def, (raw && typeof raw === 'object') ? raw : {});
        } catch (e) {
            console.error('[IG-BulkTools] loadWheelState error:', e);
            return def;
        }
    }
    function saveWheelState(st) {
        try {
            const json = JSON.stringify(st);
            if (typeof GM_setValue !== 'undefined') GM_setValue(WHEEL_STATE_KEY, json);
            localStorage.setItem(WHEEL_STATE_KEY, json);
        } catch (e) {
            console.error('[IG-BulkTools] saveWheelState error:', e);
        }
    }

    // Chequeo puntual en el load actual: espera a que el .menu-fortune-wheel
    // exista (el submenu de usuario puede renderizarse por AJAX), compara su
    // firma contra la base y, si difiere, dispara un alert() bloqueante.
    //
    // Si venimos de una recarga post-giro (relearn), NO avisa: el estado que
    // muestra el menu en ese momento es por definicion "ya giraste hoy", asi
    // que lo guarda como nueva firma base. Sin esto, cualquier <li> que no
    // vuelva exactamente al HTML hardcodeado relanzaria la alerta en cada
    // recarga hasta el dia siguiente.
    async function checkWheelOnce() {
        const el = await waitForElement(WHEEL_SELECTOR, 15000);
        if (!el) {
            console.log('[IG-BulkTools] wheel: elemento no encontrado, omito chequeo.');
            return;
        }
        const sig = normalizeHtmlSig(el.outerHTML);
        const st = loadWheelState();

        if (st.relearn) {
            st.relearn = false;
            st.baselineSig = (sig === WHEEL_BASELINE_SIG) ? null : sig;
            saveWheelState(st);
            console.log('[IG-BulkTools] wheel: firma base aprendida tras giro:', st.baselineSig || '(hardcodeada)');
            return;
        }

        const baseline = st.baselineSig || WHEEL_BASELINE_SIG;
        const changed = sig !== baseline;
        console.log('[IG-BulkTools] wheel sig:', sig, '| baseline:', baseline, '| changed:', changed);
        if (changed) {
            try { (typeof unsafeWindow !== 'undefined' && unsafeWindow.alert ? unsafeWindow.alert : window.alert)(T.wheelAvailableAlert); }
            catch (_) { try { window.alert(T.wheelAvailableAlert); } catch (__) {} }
        }
    }

    // Tras la recarga post-giro, vuelve a mostrar el premio en un toast. El
    // aviso y el toast del giro se los llevo el reload, y esta es la pasada en
    // la que el widget de saldo ya trae el GalaSilver/GalaCredit nuevo: se ven
    // los dos datos juntos.
    function announceLastWheelPrize() {
        const st = loadWheelState();
        if (!st.lastPrize) return;
        const prize = st.lastPrize;
        st.lastPrize = null;
        saveWheelState(st);
        try { showToast(fmt(T.wheelPrizeAfterReload, { prize }), 'success'); } catch (_) {}
    }

    // Lee el premio del panel de resultado ya revelado. El <h4> trae dos spans
    // ("You win:" y el premio) separados por un <br>; el segundo es el bueno.
    function readWheelPrize(results) {
        const spans = results.querySelectorAll('h4 span');
        const el = spans.length > 1 ? spans[spans.length - 1] : spans[0];
        return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    // true cuando el popup esta cerrado u oculto.
    //
    // Indiegala NO desmonta el popup al cerrarlo, y sobre todo NO toca el panel
    // de resultado: este se queda con su `fortune-wheel-tier-*` y su premio
    // dentro, indistinguible del estado abierto. Lo que cambia es la <section>,
    // que gana `display-none-important`, y el `.fortune-wheel-cont`, que gana
    // `opacity-0`. Por eso el cierre hay que detectarlo AQUI y no mirando el
    // panel de resultado. (Verificado con el HTML real: abierto/cerrado.)
    function isWheelPopupHidden() {
        const popup = document.querySelector(WHEEL_POPUP_SELECTOR);
        if (!popup || !popup.isConnected) return true;
        if (popup.classList.contains('display-none-important')) return true;
        const cont = popup.querySelector('.fortune-wheel-cont');
        return !!(cont && cont.classList.contains('opacity-0'));
    }

    // true cuando el panel de resultado esta revelado con premio dentro.
    // Exige ambas cosas: el sitio quita `opacity-0`/`display-none` y rellena el
    // premio, y pedir las dos evita disparar en un estado intermedio.
    function isWheelResultReady(results) {
        if (!results) return false;
        const cl = results.classList;
        if (cl.contains('display-none') || cl.contains('opacity-0')) return false;
        return readWheelPrize(results) !== '';
    }

    // Aviso fijo que anuncia que la recarga ocurrira al cerrar el popup. Sin
    // cuenta atras: el usuario decide cuando, leyendo el premio con calma.
    // Devuelve una funcion que lo quita.
    function showWheelReloadNotice(prize) {
        const box = document.createElement('div');
        box.id = WHEEL_RELOAD_NOTICE_ID;
        const txt = document.createElement('span');
        box.appendChild(txt);
        document.body.appendChild(box);

        // El premio se pinta como nodo de texto dentro de un <strong>, no via
        // innerHTML: la cadena viene del DOM de Indiegala y no hay por que
        // reparsearla como HTML.
        const parts = T.wheelReloadNotice.split('{prize}');
        txt.textContent = parts[0] || '';
        const strong = document.createElement('strong');
        strong.textContent = prize;
        txt.appendChild(strong);
        txt.appendChild(document.createTextNode(parts[1] || ''));

        return () => { try { box.remove(); } catch (_) {} };
    }

    // Resuelve cuando el usuario cierra el popup de la ruleta, por la via que
    // sea: el boton Close del panel de premio, la ✕ de la esquina, o cualquier
    // otro camino (ESC, clic en el fondo) que desmonte u oculte el popup. Ese
    // ultimo caso lo cubre el observer, no los listeners: sin el, un cierre por
    // ESC dejaria el saldo desactualizado para siempre.
    function waitForWheelPopupClose(results) {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                try { obs.disconnect(); } catch (_) {}
                resolve();
            };

            [
                document.querySelector(WHEEL_POPUP_SELECTOR + ' .fortune-wheel-dismiss'),
                results.querySelector('button')
            ].forEach(b => b && b.addEventListener('click', finish, { once: true }));

            const closed = () => isWheelPopupHidden() ||
                                 !isWheelResultReady(document.querySelector(WHEEL_RESULTS_SELECTOR));
            const obs = new MutationObserver(() => { if (closed()) finish(); });
            obs.observe(document.documentElement, {
                childList: true, subtree: true,
                attributes: true, attributeFilter: ['class', 'style']
            });
        });
    }

    // Vigila el popup de la ruleta en el load actual. Cuando el giro revela el
    // premio lo anuncia y arma la recarga, que se dispara al CERRAR el popup
    // (no por temporizador), para que el saldo y el <li> del menu queden al dia
    // sin cortarle la lectura a nadie. Se pospone mientras haya cola corriendo
    // o un modal propio abierto.
    function watchWheelSpin() {
        if (!isListingRoot()) return;
        if (watchWheelSpin._started) return;
        watchWheelSpin._started = true;

        let fired = false;

        const fire = async (results) => {
            if (fired) return;
            fired = true;
            try { obs.disconnect(); } catch (_) {}

            const prize = readWheelPrize(results);
            console.log('[IG-BulkTools] wheel: giro completado, premio:', prize);
            try { showToast(fmt(T.wheelSpinWon, { prize }), 'success'); } catch (_) {}

            // Marcar ANTES de recargar. relearn -> la firma base se reaprende en
            // el load siguiente, ya con el menu actualizado por el servidor.
            // lastPrize -> el premio sobrevive a la recarga para reanunciarlo
            // junto al saldo nuevo (el toast de arriba se lo lleva el reload).
            const st = loadWheelState();
            st.relearn = true;
            st.lastPrize = prize;
            saveWheelState(st);

            // La recarga la dispara el usuario al cerrar, no un temporizador:
            // asi lee el premio con el tiempo que quiera y no hay recargas
            // sorpresa. El aviso solo anuncia que va a pasar.
            const teardown = showWheelReloadNotice(prize);
            await waitForWheelPopupClose(results);
            teardown();
            console.log('[IG-BulkTools] wheel: popup cerrado, recargando.');

            // Respiro para que termine la animacion de cierre del popup.
            await sleep(CFG.wheelReloadGraceMs);
            // No interrumpir una cola en curso ni un modal abierto.
            while (running || isUserBusy()) await sleep(30000);
            try { location.reload(); } catch (_) {}
        };

        const scan = () => {
            // El panel de resultado sobrevive al cierre con el premio dentro,
            // asi que "hay premio" por si solo no significa "acabas de girar":
            // hay que exigir ademas que el popup siga visible.
            if (isWheelPopupHidden()) return;
            const results = document.querySelector(WHEEL_RESULTS_SELECTOR);
            if (isWheelResultReady(results)) fire(results);
        };

        // Debounce como en startObserver(): el listado genera mutaciones a
        // destajo y no hace falta escanear en cada una. 100 ms es imperceptible
        // frente al margen de recarga.
        let pending = null;
        const obs = new MutationObserver(() => {
            if (pending) return;
            pending = setTimeout(() => { pending = null; scan(); }, 100);
        });
        obs.observe(document.documentElement, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['class']
        });
        scan();
    }

    // Auto-refresca /giveaways cada CFG.wheelCheckIntervalMs (15 min) para
    // detectar a tiempo cuando la Wheel of Fortune cambia de estado. Solo en el
    // listado raiz. La espera usa el timer en Web Worker (resistente al
    // throttling de pestañas en background). No recarga mientras haya cola en
    // curso (running) ni mientras el usuario tenga un modal/overlay abierto:
    // en ese caso reintenta cada 30 s hasta que se libere.
    async function startWheelWatcher() {
        if (!isListingRoot()) return;
        if (startWheelWatcher._started) return;
        startWheelWatcher._started = true;

        try { await checkWheelOnce(); } catch (e) { console.error('[IG-BulkTools] checkWheelOnce:', e); }

        await sleep(CFG.wheelCheckIntervalMs);
        while (running || isUserBusy()) {
            await sleep(30000);
        }
        try { location.reload(); } catch (_) {}
    }

    // =============================================
    // INYECCION: PAGINA DE CARD (/giveaways/card/*)
    // =============================================
    function injectCardDetail() {
        if (!isCardDetail()) return;

        let isExtraOdds = false;
        document.querySelectorAll('.card-data .card-data-text').forEach(el => {
            if (/^extra\s*odds$/i.test(el.textContent.trim())) isExtraOdds = true;
        });
        if (!isExtraOdds) return;

        const joinAnchor = document.querySelector('.card-join a[data-price]');
        if (!joinAnchor) return;
        const cardJoinDiv = joinAnchor.closest('.card-join');
        if (!cardJoinDiv || cardJoinDiv.parentElement.querySelector('.' + BULK_BTN_CLASS)) return;

        const params = parseJoinOnclick(joinAnchor, 'joinGiveawayCard');
        if (!params) return;
        // En el card detail, joinAnchor es el mismo elemento con data-price
        const dpCard = parseInt(joinAnchor.getAttribute('data-price'), 10);
        if (!isNaN(dpCard)) params.price = dpCard;

        const title = (document.querySelector('.card-title h1') || {}).textContent || `#${params.gid}`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = BULK_BTN_CLASS;
        btn.textContent = `${T.bulkLabel} (${params.price} iS × N)`;
        btn.title = T.bulkLabelTooltip;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            enqueueExtraOddsFlow(params, title.trim());
        });
        cardJoinDiv.parentElement.appendChild(btn);
    }

    // =============================================
    // INYECCION: PAGINA DE LISTADO (/giveaways*)
    //   - Extra Odds: badge bulk-join (top-right) en cualquier listado
    //   - Single Ticket: boton de cola (top-left) SOLO en /giveaways
    // =============================================
    // Regla de "ya tienes boleto" en el listado. El estado JOINEABLE (NO
    // participado) siempre trae un control para unirse: el boton de accion con
    // precio (.items-list-item-data-button > a[data-price], que muestra "N iS"
    // o "JOIN!") y/o el ancla de ticket (a.items-list-item-ticket-click con
    // onclick joinGiveaway...). Al participar, el sitio QUITA ese boton (o lo
    // cambia a verde / check). Por eso: si el item YA renderizo sus datos
    // (items-list-item-data-cont presente) pero NO tiene boton para unirse ->
    // ya participaste (o no es joineable) -> se oculta.
    const ENTERED_SELECTORS = [
        '.items-list-item-data-button.bg-gradient-green',
        '.items-list-item-ticket-click.on',
        '.items-list-item-ticket.on',
        '.items-list-item-data-cont.on'
    ];
    // -------- Registro persistente de gids ya participados --------
    // Se poda al cargar (TTL) para que no crezca sin limite.
    let enteredGids = null;
    function loadEnteredGids() {
        if (enteredGids) return enteredGids;
        let raw = null;
        try {
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(ENTERED_GIDS_KEY, null);
                if (v && typeof v === 'object' && !Array.isArray(v)) raw = v;
                else if (typeof v === 'string') { try { raw = JSON.parse(v); } catch (_) { raw = null; } }
            }
            if (!raw) {
                const s = localStorage.getItem(ENTERED_GIDS_KEY);
                raw = s ? JSON.parse(s) : null;
            }
        } catch (e) {
            console.error('[IG-BulkTools] loadEnteredGids error:', e);
        }
        enteredGids = {};
        const cutoff = Date.now() - ENTERED_GIDS_TTL_MS;
        if (raw && typeof raw === 'object') {
            Object.keys(raw).forEach(gid => {
                const ts = Number(raw[gid]);
                if (!isNaN(ts) && ts > cutoff) enteredGids[gid] = ts;
            });
        }
        return enteredGids;
    }
    function saveEnteredGids() {
        try {
            const json = JSON.stringify(enteredGids || {});
            if (typeof GM_setValue !== 'undefined') GM_setValue(ENTERED_GIDS_KEY, json);
            localStorage.setItem(ENTERED_GIDS_KEY, json);
        } catch (e) {
            console.error('[IG-BulkTools] saveEnteredGids error:', e);
        }
    }
    // Guarda un gid como participado. Silencioso e idempotente.
    function rememberEnteredGid(gid) {
        if (gid == null || gid === '') return;
        const map = loadEnteredGids();
        const key = String(gid);
        if (map[key]) return;
        map[key] = Date.now();
        saveEnteredGids();
    }
    function isGidRemembered(gid) {
        if (gid == null || gid === '') return false;
        return !!loadEnteredGids()[String(gid)];
    }
    // Extrae el gid de un item del listado. Se lee del href del titulo
    // (/giveaways/card/<slug>/<gid>) y NO del onclick de join, porque un item
    // participado o colgado en `wait` no tiene onclick — que es justo cuando
    // hace falta.
    function getItemGid(item) {
        const a = item && item.querySelector('.items-list-item-title a[href]');
        if (!a) return null;
        const m = (a.getAttribute('href') || '').match(/\/(\d+)\/?$/);
        return m ? m[1] : null;
    }

    // -------- Registro persistente de gids ignorados a mano ("no mostrarme mas") --------
    // Mismo patron de doble persistencia y poda por TTL que enteredGids, pero
    // con semantica distinta: aqui la fuente de verdad es el usuario, no el DOM,
    // asi que nada lo escribe salvo los botones ✕ / ↺ y "limpiar ignorados".
    let ignoredGids = null;
    function loadIgnoredGids() {
        if (ignoredGids) return ignoredGids;
        let raw = null;
        try {
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(IGNORED_GIDS_KEY, null);
                if (v && typeof v === 'object' && !Array.isArray(v)) raw = v;
                else if (typeof v === 'string') { try { raw = JSON.parse(v); } catch (_) { raw = null; } }
            }
            if (!raw) {
                const s = localStorage.getItem(IGNORED_GIDS_KEY);
                raw = s ? JSON.parse(s) : null;
            }
        } catch (e) {
            console.error('[IG-BulkTools] loadIgnoredGids error:', e);
        }
        ignoredGids = {};
        const cutoff = Date.now() - IGNORED_GIDS_TTL_MS;
        if (raw && typeof raw === 'object') {
            Object.keys(raw).forEach(gid => {
                const ts = Number(raw[gid]);
                if (!isNaN(ts) && ts > cutoff) ignoredGids[gid] = ts;
            });
        }
        return ignoredGids;
    }
    function saveIgnoredGids() {
        try {
            const json = JSON.stringify(ignoredGids || {});
            if (typeof GM_setValue !== 'undefined') GM_setValue(IGNORED_GIDS_KEY, json);
            localStorage.setItem(IGNORED_GIDS_KEY, json);
        } catch (e) {
            console.error('[IG-BulkTools] saveIgnoredGids error:', e);
        }
    }
    function isGidIgnored(gid) {
        if (gid == null || gid === '') return false;
        return !!loadIgnoredGids()[String(gid)];
    }
    function ignoredCount() {
        return Object.keys(loadIgnoredGids()).length;
    }
    function addIgnoredGid(gid) {
        if (gid == null || gid === '') return;
        const map = loadIgnoredGids();
        const key = String(gid);
        if (map[key]) return;
        map[key] = Date.now();
        saveIgnoredGids();
    }
    function removeIgnoredGid(gid) {
        if (gid == null || gid === '') return;
        const map = loadIgnoredGids();
        const key = String(gid);
        if (!map[key]) return;
        delete map[key];
        saveIgnoredGids();
    }
    function clearIgnoredGids() {
        ignoredGids = {};
        saveIgnoredGids();
    }

    // -------- Deteccion de items colgados en `wait` --------
    // Un item cargado trae un `.items-list-item-data-cont` (hermano del
    // <figcaption>) con tiempo, vendidos y el control de compra.
    //
    // OJO con `.items-list-item-data-placeholder`: esta VACIO tanto en los
    // cargados como en los colgados, asi que NO sirve para distinguirlos.
    // Comprobado con el HTML real de los dos estados lado a lado.
    function hasLoadedData(item) {
        return !!item.querySelector('.items-list-item-data-cont');
    }
    function hasJoinControl(item) {
        return !!(item.querySelector('.items-list-item-data-button a[data-price]') ||
                  item.querySelector('a.items-list-item-ticket-click[onclick*="joinGiveaway"]'));
    }

    // Primera vez que vemos cada item en `wait`, para medir cuanto lleva sin
    // resolverse. WeakMap: no retiene los items que el sitio reemplaza al
    // paginar. Devuelve true solo cuando se agoto el margen.
    const ITEM_FIRST_SEEN = new WeakMap();
    function isWaitStalled(item) {
        const seen = ITEM_FIRST_SEEN.get(item);
        if (seen == null) { ITEM_FIRST_SEEN.set(item, Date.now()); return false; }
        return (Date.now() - seen) >= CFG.staleWaitMs;
    }
    // true si algun item sigue en `wait` pero aun dentro del margen: hay que
    // volver a mirar mas tarde. Un item colgado no genera mas mutaciones, asi
    // que sin este reintento programado applyHideEntered no se ejecutaria nunca
    // mas y el item se quedaria visible.
    function hasPendingWaitItems() {
        return Array.prototype.some.call(
            document.querySelectorAll('.items-list-item.wait'),
            it => !isWaitStalled(it)
        );
    }

    // Devuelve true si en este item ya tienes boleto (ya participaste/compraste).
    // CLAVE (visto en el sitio): la clase `wait` en .items-list-item marca que el
    // item AUN esta cargando (lazy-load de imagen + datos del ticket). Cuando
    // termina, se le quita `wait` y entonces:
    //   - NO participado -> aparece el control para unirse (boton con precio o
    //     el ancla de ticket con onclick joinGiveaway...).
    //   - participado     -> NO aparece ningun control (el sitio no renderiza el
    //     boton porque ya no puedes volver a entrar): queda sin data-cont/boton.
    function isAlreadyEntered(item) {
        if (!item) return false;
        // Item en `wait` (lazy-load sin terminar). El DOM NO permite distinguir
        // "cargando" de "participado": ninguno de los dos tiene control para
        // unirse, y lo unico que los separa es la propia clase `wait`. Ademas
        // el lazy-load de Indiegala a veces se cuelga y no la quita nunca
        // (imagen ya cargada, .items-list-item-data-placeholder vacio para
        // siempre), con lo que el item se quedaba visible pese a "ocultar ya
        // participados". Se resuelve con dos fuentes, en este orden:
        if (item.classList.contains('wait')) {
            // (a) El registro persistente: certeza, sin esperas.
            if (isGidRemembered(getItemGid(item))) return true;
            // (b) Colgado: lleva mas de CFG.staleWaitMs sin resolverse y no
            //     ofrece ninguna via de compra. El margen de tiempo es el
            //     guardarrail: un item que solo va lento se resuelve en un
            //     segundo, asi que sin el se ocultarian giveaways joineables.
            return isWaitStalled(item) && !hasLoadedData(item);
        }
        // (1) Marcador explicito: boton verde / control de ticket "on".
        for (const sel of ENTERED_SELECTORS) {
            if (item.querySelector(sel)) return true;
        }
        // (2) Check verde visible dentro del area de ticket.
        const check = item.querySelector('.items-list-item-ticket .fa-check, .items-list-item-data-cont .fa-check');
        if (check && (check.offsetWidth > 0 || check.offsetHeight > 0)) return true;
        // (3) Regla principal: ya cargo (sin `wait`) pero NO tiene control para
        //     unirse -> participado. Joineable = boton con precio O ancla de
        //     ticket con onclick de join. Si no hay ninguno, se oculta.
        return !hasJoinControl(item);
    }

    // Aplica la preferencia "Ocultar ya participados": esconde (o restaura) la
    // celda completa (.items-list-col) de cada giveaway en el que ya tienes
    // boleto. Pasada independiente de injectListing porque los items entrados
    // pueden no exponer el trigger de join. Se reejecuta en cada injectAll
    // (disparado por el MutationObserver) para cubrir items cargados por AJAX.
    let hideEnteredRetry = null;
    function applyHideEntered() {
        if (isLibrary()) return;
        const hide = !!settings.hideEntered;
        document.querySelectorAll('.items-list-item').forEach(item => {
            // Aprender de los items que SI cargaron: si consta participado con
            // el DOM completo, se apunta el gid. Asi, la proxima vez que el
            // sitio deje ese mismo item colgado, la rama (a) lo resuelve al
            // instante y sin depender del margen de tiempo.
            if (!item.classList.contains('wait') && hasLoadedData(item) && !hasJoinControl(item)) {
                rememberEnteredGid(getItemGid(item));
            }
            const cell = item.closest('.items-list-col') || item;
            if (hide && isAlreadyEntered(item)) {
                // Si se oculto estando en `wait` fue por la regla de colgado
                // (tardo los segundos del margen, durante los cuales el item se
                // ve). Dejar constancia para que la proxima vez lo resuelva la
                // rama (a) al instante y no vuelva a parpadear.
                if (item.classList.contains('wait')) rememberEnteredGid(getItemGid(item));
                cell.classList.add('ig-entered-hidden');
            } else {
                cell.classList.remove('ig-entered-hidden');
            }
        });

        // Reintento programado: un item colgado deja de generar mutaciones, asi
        // que el MutationObserver no volveria a disparar y nadie reevaluaria.
        if (hide && hasPendingWaitItems() && !hideEnteredRetry) {
            hideEnteredRetry = setTimeout(() => {
                hideEnteredRetry = null;
                try { applyHideEntered(); } catch (e) { console.error('[IG-BulkTools] applyHideEntered retry:', e); }
            }, CFG.staleWaitMs + 250);
        }
    }

    // =============================================
    // OCULTAR A MANO: boton ✕ / ↺ por tarjeta
    // =============================================
    // Pasada propia, independiente de injectListing, y a proposito: injectListing
    // aborta el item si no encuentra `a.items-list-item-ticket-click` (el trigger
    // de join), que es justo lo que le falta a un giveaway ya participado. Si el
    // boton viviera ahi, un giveaway ignorado Y participado se quedaria sin ↺ y
    // no habria forma de sacarlo de ignorados desde el listado.
    function applyIgnored() {
        if (isLibrary()) return;
        const show = !!settings.showIgnored;
        document.querySelectorAll('.items-list-item').forEach(item => {
            const gid = getItemGid(item);
            const cell = item.closest('.items-list-col') || item;
            // Sin gid no hay a que colgar la preferencia (item a medio cargar sin
            // titulo): se deja intacto y la siguiente pasada lo recoge.
            if (!gid) return;

            const host = item.querySelector(':scope > .relative') || item;
            if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';

            const ignored = isGidIgnored(gid);
            let btn = host.querySelector('.' + IGN_BTN_CLASS);
            if (!btn) {
                btn = document.createElement('div');
                btn.className = IGN_BTN_CLASS;
                // El gid NO se captura en el closure: se lee del dataset al
                // pulsar. Si Indiegala reutiliza el nodo del item al paginar (el
                // boton sobrevive con otro giveaway dentro), un gid capturado
                // ocultaria el giveaway equivocado; el dataset lo reescribe cada
                // pasada y siempre corresponde a lo que se ve.
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const g = btn.dataset.gid;
                    if (!g) return;
                    if (isGidIgnored(g)) removeIgnoredGid(g); else addIgnoredGid(g);
                    applyIgnored();
                    refreshIgnoredWidget();
                });
                host.appendChild(btn);
            }
            btn.dataset.gid = gid;
            // Esquina opuesta al control propio de la tarjeta: el badge de Extra
            // Odds ocupa la derecha, el ＋ de Single Ticket la izquierda. Se
            // recalcula cada pasada por el mismo motivo que el gid.
            const typeEl = item.querySelector('.items-list-item-type');
            const typeText = ((typeEl && typeEl.textContent) || '').trim().toLowerCase();
            const isExtraOdds = (typeEl && typeEl.classList.contains('items-list-item-type-indiegala'))
                || /extra\s*odds/i.test(typeText);
            btn.classList.toggle('ig-ign-left', isExtraOdds);
            btn.classList.toggle('ig-ign-right', !isExtraOdds);
            btn.classList.toggle('ig-ign-btn-undo', ignored);
            btn.textContent = ignored ? T.ignoreUndoBtn : T.ignoreBtn;
            btn.title = ignored ? T.ignoreUndoBtnTooltip : T.ignoreBtnTooltip;

            cell.classList.toggle('ig-ignored-hidden', ignored && !show);
            cell.classList.toggle('ig-ignored-shown', ignored && show);
        });
    }

    // Sincroniza el widget con el numero de ignorados: el boton de limpiar solo
    // existe cuando hay algo que limpiar, y el toggle no sirve de nada vacio.
    function refreshIgnoredWidget() {
        const w = document.getElementById(BALANCE_WIDGET_ID);
        if (!w) return;
        const n = ignoredCount();
        const clearBtn = w.querySelector('#ig-bw-clear-ignored');
        if (clearBtn) {
            clearBtn.textContent = fmt(T.widgetClearIgnored, { n });
            clearBtn.style.display = n > 0 ? '' : 'none';
        }
        const showRow = w.querySelector('#ig-bw-show-ignored-row');
        if (showRow) showRow.style.display = n > 0 ? '' : 'none';
        const showChk = w.querySelector('#ig-bw-show-ignored');
        if (showChk) showChk.checked = !!settings.showIgnored;
    }

    function injectListing() {
        const onListingRoot = isListingRoot();

        document.querySelectorAll('.items-list-item').forEach(item => {
            const typeEl = item.querySelector('.items-list-item-type');
            if (!typeEl) return;

            const trigger = item.querySelector('a.items-list-item-ticket-click');
            if (!trigger) return;
            const params = parseJoinOnclick(trigger, 'joinGiveawayOrAuction');
            if (!params) return;
            // En el listado el data-price esta en el boton interno, no en el trigger.
            // Para Single Ticket, el segundo arg del onclick es 0; el precio real solo
            // se obtiene de data-price.
            const dpItem = findDataPrice(item);
            if (dpItem != null) params.price = dpItem;

            const titleA = item.querySelector('.items-list-item-title a');
            const title = titleA ? titleA.textContent.trim() : `#${params.gid}`;
            const timeEl = item.querySelector('.items-list-item-data-left-bottom');
            const timeLeft = timeEl ? timeEl.textContent.trim() : '';

            const host = item.querySelector(':scope > .relative') || item;
            const cs = window.getComputedStyle(host);
            if (cs.position === 'static') host.style.position = 'relative';

            const typeText = (typeEl.textContent || '').trim().toLowerCase();
            const isExtraOdds = typeEl.classList.contains('items-list-item-type-indiegala')
                || /extra\s*odds/i.test(typeText);
            const isSingleTicket = /^single\s*ticket/.test(typeText);

            // Extra Odds: badge de bulk-join (en cualquier listado)
            if (isExtraOdds && params.price >= 1 && !host.querySelector('.' + BULK_BADGE_CLASS)) {
                const maxCount = maxEnqueueCount(params.price);
                const n = maxCount == null ? 0 : maxCount;

                const badge = document.createElement('div');
                badge.className = BULK_BADGE_CLASS;
                badge.dataset.price = String(params.price);
                badge.textContent = fmt(T.bulkBadge, { n });
                badge.title = fmt(T.bulkBadgeTooltip, { n });
                badge.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    enqueueExtraOddsFlow(params, title);
                });
                host.appendChild(badge);

                // El enlace del titulo deja de navegar al card: ahora abre el flujo
                // de Extra Odds (igual que el badge ⚠×N) para que un click "por
                // error" sobre el titulo no abra el giveaway. Guard por dataset para
                // no re-enganchar si injectListing vuelve a correr sobre el card.
                if (titleA && !titleA.dataset.igQBound) {
                    titleA.dataset.igQBound = '1';
                    titleA.style.cursor = 'pointer';
                    titleA.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        enqueueExtraOddsFlow(params, title);
                    });
                }
            }

            // Single Ticket: boton de cola SOLO en /giveaways
            if (isSingleTicket && onListingRoot && !host.querySelector('.' + QBTN_CLASS)) {
                // Toggle compartido entre el boton ＋ y el enlace del titulo:
                // si ya esta en cola lo quita; si no, valida presupuesto y lo encola.
                const toggleQueue = () => {
                    if (isInQueue(params.gid)) {
                        removeFromQueue(params.gid);
                        return;
                    }
                    // El presupuesto disponible ya descuenta lo comprometido en
                    // la cola. Si el cache esta stale (0 o null) forzamos lectura
                    // fresca del DOM: puede haber entrado saldo (ruleta, compra)
                    // y no queremos avisar de espera si ya alcanza.
                    let avail = availableForEnqueue();
                    if (avail == null || avail <= 0) {
                        forceReadBalance();
                        avail = availableForEnqueue();
                    }
                    if (avail == null) { showToast(T.balanceUnknown, 'error'); return; }
                    // Que no alcance ya NO impide encolar: el boleto espera en la
                    // cola y el loop lo salta hasta que haya GalaSilver. Solo se
                    // avisa para que la espera no sea una sorpresa.
                    if (avail < params.price) showToast(T.queueWaitsForBalance, 'warn');
                    addToQueue({
                        gid: params.gid,
                        title: title,
                        timeLeft: timeLeft,
                        fnName: 'joinGiveawayOrAuction',
                        price: params.price,
                        fnArg2: params.fnArg2,
                        token: params.token,
                        count: 1,
                        done: 0,
                        type: 'single',
                        addedAt: Date.now()
                    });
                };

                const btn = document.createElement('div');
                btn.className = QBTN_CLASS;
                btn.dataset.gid = params.gid;
                btn.dataset.price = String(params.price);
                const inQ = isInQueue(params.gid);
                btn.classList.toggle('ig-q-btn-active', inQ);
                btn.textContent = inQ ? T.queueRemoveBtn : T.queueAddBtn;
                btn.title = inQ ? T.queueRemoveBtnTooltip : T.queueAddBtnTooltip;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleQueue();
                });
                host.appendChild(btn);

                // El enlace del titulo deja de navegar al card: ahora funciona como
                // el boton ＋ (añade/quita de la cola) para que un click "por error"
                // sobre el titulo no abra el giveaway. Se marca con dataset para no
                // re-enganchar si injectListing vuelve a correr sobre el mismo card.
                if (titleA && !titleA.dataset.igQBound) {
                    titleA.dataset.igQBound = '1';
                    titleA.style.cursor = 'pointer';
                    titleA.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleQueue();
                    });
                }
            }
        });
    }

    // =============================================
    // FILTROS PERSISTENTES (sort / level / busqueda)
    // =============================================
    // El servidor renderiza /giveaways siempre con los defaults (expiry/asc, todos
    // los niveles, sin busqueda) porque no conoce nuestras preferencias locales.
    // Con "Recordar filtros" activo: captureFilters() guarda lo que el usuario
    // aplica y reapplyFilters() lo vuelve a disparar al cargar, replicando los
    // gestos del propio sitio (setSortOrder/setLevel + keyup en la caja de busqueda)
    // para no depender de nombres internos de funciones de recarga.
    const FILTER_DEFAULTS = { sort: 'expiry', order: 'asc', level: 'all', search: '', page: 1 };

    function uw() { return (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window; }

    // Preferencias guardadas normalizadas (con defaults por si falta alguna clave).
    function getSavedFilters() {
        const f = (settings.filters && typeof settings.filters === 'object') ? settings.filters : {};
        return {
            sort: f.sort || FILTER_DEFAULTS.sort,
            order: f.order || FILTER_DEFAULTS.order,
            level: (f.level != null && f.level !== '') ? String(f.level) : FILTER_DEFAULTS.level,
            search: (typeof f.search === 'string') ? f.search : '',
            page: (parseInt(f.page, 10) > 0) ? parseInt(f.page, 10) : 1
        };
    }

    // Sort/orden desde el DOM (el ancla seleccionada del menu). El caret hacia
    // arriba = asc, hacia abajo = desc. Fallback cuando no hay globales del sitio.
    function readSortFromDom() {
        const sel = document.querySelector('.page-contents-list-menu-sort a.selected');
        if (!sel) return null;
        let sort = sel.getAttribute('data-rel');
        if (!sort) {
            const m = (sel.getAttribute('onclick') || '').match(/setSortOrder\(\s*'([^']+)'/);
            if (m) sort = m[1];
        }
        if (!sort) return null;
        const order = sel.querySelector('i.fa-caret-down') ? 'desc' : 'asc';
        return { sort, order };
    }

    // Nivel desde el DOM (etiqueta del submenu de nivel). Fallback sin globales.
    function readLevelFromDom() {
        const span = document.querySelector('.page-contents-list-submenu-current-level span');
        if (!span) return null;
        const t = (span.textContent || '').trim().toLowerCase();
        if (/all/.test(t)) return 'all';
        const m = t.match(/(\d+)/);
        return m ? m[1] : null;
    }

    // Estado de filtros que el sitio tiene AHORA. Prioriza las globales que el
    // sitio mantiene (sortParam/sortOrderParam/levelParam), cae al DOM, y siempre
    // lee el texto de la caja de busqueda.
    function readSiteFilters() {
        const w = uw();
        const f = Object.assign({}, FILTER_DEFAULTS);
        let gotSort = false, gotOrder = false, gotLevel = false;
        try {
            if (typeof w.sortParam === 'string' && w.sortParam) { f.sort = w.sortParam; gotSort = true; }
            if (typeof w.sortOrderParam === 'string' && w.sortOrderParam) { f.order = w.sortOrderParam; gotOrder = true; }
            if (w.levelParam != null && w.levelParam !== '') { f.level = String(w.levelParam); gotLevel = true; }
        } catch (_) {}
        if (!gotSort || !gotOrder) {
            const d = readSortFromDom();
            if (d) { if (!gotSort) f.sort = d.sort; if (!gotOrder) f.order = d.order; }
        }
        if (!gotLevel) {
            const l = readLevelFromDom();
            if (l != null) f.level = l;
        }
        const box = document.getElementById('search-box');
        if (box) f.search = (box.value || '').trim();
        const pg = readCurrentPage();
        if (pg != null) f.page = pg;
        return f;
    }

    // Pagina actual del listado: el sitio marca la activa con .pagination .current.
    // Fallback a la global pageParam si la barra no esta renderizada.
    function readCurrentPage() {
        const cur = document.querySelector('.pagination .current');
        if (cur) { const n = parseInt((cur.textContent || '').trim(), 10); if (!isNaN(n)) return n; }
        try { const p = parseInt(uw().pageParam, 10); if (!isNaN(p)) return p; } catch (_) {}
        return null;
    }

    // Construye la URL AJAX de una pagina copiando el href de un ancla real de
    // paginacion y sustituyendo SOLO el numero de pagina (no adivina el formato:
    // conserva sort/order/level tal como los tiene el sitio ahora mismo). Devuelve
    // null si no hay barra de paginacion (una sola pagina de resultados).
    function pageUrlFromDom(page) {
        const a = document.querySelector('.pagination a[href*="/giveaways/ajax/"]');
        if (!a) return null;
        const href = a.getAttribute('href') || '';
        if (!/\/giveaways\/ajax\/\d+\//.test(href)) return null;
        return href.replace(/(\/giveaways\/ajax\/)\d+(\/)/, (m, pre, post) => pre + page + post);
    }

    // Navega a la pagina guardada disparando el loader canonico del sitio
    // (loadGiveawaysListContents con la URL AJAX). Si tras cargar la pagina no
    // existe (fuera de rango => sin items o el .current no coincide), vuelve a la 1.
    async function applyPage(page) {
        const url = pageUrlFromDom(page);
        if (!url) return; // una sola pagina: nada que reaplicar
        const w = uw();
        if (typeof w.loadGiveawaysListContents !== 'function') {
            // Fallback: click en el ancla exacta si esta en la ventana visible.
            const exact = Array.from(document.querySelectorAll('.pagination a[href*="/giveaways/ajax/"]'))
                .find(x => (x.getAttribute('href') || '') === url);
            if (exact) { exact.click(); await waitListSettle(); }
            return;
        }
        try { w.loadGiveawaysListContents(url); } catch (_) { return; }
        await waitListSettle();
        const reached = readCurrentPage();
        const hasItems = !!document.querySelector('.page-contents-list .items-list-item');
        if (!hasItems || (reached != null && reached !== page)) {
            const url1 = url.replace(/(\/giveaways\/ajax\/)\d+(\/)/, (m, pre, post) => pre + '1' + post);
            try { w.loadGiveawaysListContents(url1); } catch (_) {}
            await waitListSettle();
        }
    }

    // Guarda el estado actual si difiere del guardado. Silenciada hasta que la
    // reaplicacion inicial termina (para no pisar preferencias con los defaults)
    // salvo que se fuerce (al activar el toggle, cuando ya estamos estables).
    function captureFilters(force) {
        if (!settings.rememberFilters) return;
        if (!isListingRoot()) return;
        if (!force && (!filtersReady || reapplyInProgress)) return;
        const cur = readSiteFilters();
        const saved = getSavedFilters();
        if (cur.sort === saved.sort && cur.order === saved.order &&
            cur.level === saved.level && cur.search === saved.search &&
            cur.page === saved.page) return;
        settings.filters = cur;
        saveSettings();
    }

    function findSortAnchor(sort) {
        const byRel = document.querySelector(`.page-contents-list-menu-sort a[data-rel="${sort}"]`);
        if (byRel) return byRel;
        return Array.from(document.querySelectorAll('.page-contents-list-menu-sort a[onclick*="setSortOrder"]'))
            .find(a => (a.getAttribute('onclick') || '').includes(`setSortOrder('${sort}'`)) || null;
    }

    function findLevelAnchor(level) {
        const want = `setLevel('${level}'`;
        return Array.from(document.querySelectorAll('.page-contents-list-submenu-level a[onclick*="setLevel"]'))
            .find(a => (a.getAttribute('onclick') || '').includes(want)) || null;
    }

    // Evento sintetico minimo para las funciones del sitio (usan preventDefault).
    function synthEvent() {
        return { preventDefault() {}, stopPropagation() {}, target: null, currentTarget: null };
    }

    // Espera a que la recarga AJAX del listado termine: el sitio muestra
    // .page-contents-ajax-list-cover mientras carga. Da un margen inicial para
    // que arranque, luego sondea hasta que la tapa se oculta (con timeout duro).
    function waitListSettle(timeoutMs) {
        const limit = timeoutMs || 6000;
        return new Promise((resolve) => {
            const deadline = Date.now() + limit;
            setTimeout(function tick() {
                const c = document.querySelector('.page-contents-ajax-list-cover');
                const visible = c && window.getComputedStyle(c).display !== 'none';
                if (!visible || Date.now() > deadline) { setTimeout(resolve, 200); return; }
                setTimeout(tick, 150);
            }, 250);
        });
    }

    // Reaplica los filtros guardados replicando los gestos del sitio, en secuencia
    // (nivel -> orden -> busqueda) esperando a que cada recarga AJAX asiente para
    // que la siguiente parta del estado ya aplicado. Marca filtersReady al final
    // para habilitar la captura de cambios posteriores del usuario.
    async function reapplyFilters() {
        try {
            if (!settings.rememberFilters || !isListingRoot()) return;
            const want = getSavedFilters();
            // Nada que hacer si coincide con los defaults del render del servidor.
            const isDefault = want.sort === FILTER_DEFAULTS.sort && want.order === FILTER_DEFAULTS.order &&
                want.level === FILTER_DEFAULTS.level && !want.search && (want.page || 1) <= 1;
            if (isDefault) return;

            await waitForElement('.page-contents-list-menu', 8000);
            reapplyInProgress = true;

            // LEVEL
            if (String(want.level) !== String(readSiteFilters().level)) {
                const lvlA = findLevelAnchor(want.level);
                if (lvlA) { fireSiteAction(lvlA, 'setLevel', [String(want.level), lvlA, synthEvent()]); await waitListSettle(); }
            }

            // SORT (dos pasos: primero fijar el criterio, luego alternar el orden
            // observando el resultado real, porque el orden por defecto de cada
            // criterio lo decide el sitio).
            let st = readSiteFilters();
            if (st.sort !== want.sort) {
                const a = findSortAnchor(want.sort);
                if (a) { fireSiteAction(a, 'setSortOrder', [want.sort, a, synthEvent()]); await waitListSettle(); st = readSiteFilters(); }
            }
            if (st.sort === want.sort && st.order !== want.order) {
                const a = findSortAnchor(want.sort);
                if (a) { fireSiteAction(a, 'setSortOrder', [want.sort, a, synthEvent()]); await waitListSettle(); }
            }

            // PAGE: solo cuando NO hay busqueda (buscar colapsa el listado a la
            // pagina 1, y la URL AJAX de paginacion no lleva termino de busqueda).
            // Se aplica al final de sort/level para que la barra ya refleje esos
            // filtros al copiar el href.
            if (!want.search && (want.page || 1) > 1) {
                await applyPage(want.page);
            }

            // SEARCH: rellena la caja y dispara los eventos que el sitio escucha.
            if (want.search) {
                const box = document.getElementById('search-box');
                if (box) {
                    box.value = want.search;
                    box.dispatchEvent(new Event('input', { bubbles: true }));
                    box.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
                    await waitListSettle();
                }
            }
        } catch (e) {
            console.error('[IG-BulkTools] reapplyFilters:', e);
        } finally {
            reapplyInProgress = false;
            filtersReady = true;
        }
    }

    // Engancha (una vez) la captura del texto de busqueda al teclear, con debounce,
    // porque escribir no siempre muta el listado de inmediato.
    function bindSearchCapture() {
        const box = document.getElementById('search-box');
        if (!box || box.dataset.igFilterBound) return;
        box.dataset.igFilterBound = '1';
        let t = null;
        box.addEventListener('input', () => {
            if (t) clearTimeout(t);
            t = setTimeout(() => { try { captureFilters(); } catch (_) {} }, 500);
        });
    }

    function injectAll() {
        try { injectStyles(); } catch (e) {}
        try { injectCardDetail(); } catch (e) { console.error('[IG-BulkTools] injectCardDetail:', e); }
        try { injectListing(); } catch (e) { console.error('[IG-BulkTools] injectListing:', e); }
        try { applyHideEntered(); } catch (e) { console.error('[IG-BulkTools] applyHideEntered:', e); }
        try { applyIgnored(); } catch (e) { console.error('[IG-BulkTools] applyIgnored:', e); }
        try { bindSearchCapture(); } catch (e) {}
        try { captureFilters(); } catch (e) { console.error('[IG-BulkTools] captureFilters:', e); }
        try { renderQueuePanel(); } catch (e) { console.error('[IG-BulkTools] renderQueuePanel:', e); }
        // Asegurar que botones recien inyectados reflejen el estado de saldo (deshabilitar
        // los ＋ cuando bal=0). Tambien resincroniza con el DOM si Indiegala actualizo iS.
        try { getCurrentBalance(); refreshQueueButtonsState(); refreshBulkBadges(); renderBalanceWidget(); } catch (e) {}
    }

    // =============================================
    // OBSERVADOR DE DOM (los listados se cargan por AJAX/carrusel)
    // =============================================
    function startObserver() {
        // jQuery del sitio puede no estar listo en el primer tick; reintentar.
        setupAjaxBalanceHook();
        if (!setupAjaxBalanceHook._done) {
            let attempts = 0;
            const t = setInterval(() => {
                attempts++;
                setupAjaxBalanceHook();
                if (setupAjaxBalanceHook._done || attempts > 20) clearInterval(t);
            }, 250);
        }
        injectAll();
        const observer = new MutationObserver(() => {
            if (startObserver._t) return;
            startObserver._t = setTimeout(() => {
                startObserver._t = null;
                injectAll();
            }, 250);
        });
        // attributeFilter:['class'] ademas de childList: cuando un item participado
        // termina de cargar, el sitio solo le QUITA la clase `wait` (sin agregar
        // hijos), y applyHideEntered necesita reevaluarlo para ocultarlo. El
        // debounce de 250ms evita que el filtro de atributos sature.
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // =============================================
    // MODULO: TIENDA (/store/game/*, /store/product/*)
    // =============================================
    // Nada de esto tiene que ver con la cola ni con la automatizacion: en una
    // ficha de producto el script solo añade dos enlaces (GG.deals y
    // PCGamingWiki) bajo el boton de compra. Por eso boot() sale por aqui antes
    // de montar el observador, los estilos y el resto del modulo de giveaways.
    //
    // Juegos, DLC y packs comparten plantilla, asi que hay un solo camino de
    // codigo para los tres. Todo lo que vende IndieGala es PC, de modo que no
    // hace falta filtro por plataforma.
    const STORE_PRICE_BOX_SELECTOR = '.store-product-price-box';
    const STORE_ASIDE_SELECTOR = '.store-product-contents-aside-inner';
    // Anclas en orden de preferencia: la caja de precio (debajo de "Add to
    // Cart") y, si la ficha no la tiene (producto retirado), la columna entera.
    const STORE_ANCHOR_SELECTORS = [STORE_PRICE_BOX_SELECTOR, STORE_ASIDE_SELECTOR];

    // El nombre limpio del producto viene en el data-* del propio boton de
    // carrito, y es mejor fuente que el <h1>: el <h1> arrastra el sufijo de DRM
    // ("DOOM VFR <em>Steam Key</em>") y a veces la tienda de destino entre
    // parentesis ("Sid Meier's Civilization VI (Epic)"), que en una busqueda por
    // titulo solo estorban. Hay UN solo elemento con este atributo por ficha.
    const STORE_PROD_TITLE_SELECTOR = '[data-prod-title]';
    const STORE_H1_SELECTOR = '.store-product-header h1, h1';
    // Cola que IndieGala añade en <title> y og:title:
    // "<Nombre> <DRM> | Buy Cheap <Nombre> PC Game - Indiegala". El grupo del
    // medio es el nombre ya sin el sufijo de DRM, y es el ultimo recurso.
    const STORE_DOC_TITLE_REGEX = /\|\s*Buy Cheap\s+(.+?)\s+PC Game\s*-\s*Indiegala\s*$/i;

    const STORE_TRADEMARK_REGEX = /[™®©]/g;
    // Diacriticos combinados, para quitarlos tras normalizar a NFD.
    const STORE_DIACRITICS_REGEX = /[\u0300-\u036f]/g;

    // Busqueda en el catalogo de GG.deals, igual que hace el script de Humble
    // Bundle: /games/ cae en la ficha del juego (con su historico y todas sus
    // ofertas), mientras que /deals/ es la lista de ofertas del momento.
    //
    // Y a diferencia de Steam, GOG, Epic o Microsoft Store, aqui NO se filtra por
    // DRM. Aquellas son tiendas de un solo DRM, asi que su script puede fijar el
    // bitmask (1 Steam, 8 GOG, 16 sin DRM, 1024 Epic…) y acertar siempre;
    // IndieGala revende llaves de varias tiendas y ademas vende juegos sin DRM,
    // asi que no hay un filtro correcto para toda la tienda. Ademas /games/
    // ignora el parametro drm: solo lo acepta /deals/.
    const GGDEALS_SEARCH_URL = 'https://gg.deals/games/?title=';

    const PCGW_SEARCH_URL = 'https://www.pcgamingwiki.com/w/index.php';

    // Icono de GG.deals: favicon remoto (su CDN permite el hotlink). Si el CSP de
    // IndieGala lo bloqueara, el onerror lo quita y queda solo la etiqueta.
    const GGDEALS_ICON_URL = 'https://gg.deals/favicon.ico';
    // Icono de PCGamingWiki: SVG inline. Su favicon.ico responde 403 al hotlink
    // (Cloudflare) desde otros dominios, asi que como <img> remoto no se ve; el
    // SVG inline es markup y siempre pinta, sin depender del CSP ni del hotlink.
    const PCGW_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 827 1158" width="13" height="18" aria-hidden="true" style="vertical-align:middle;flex:0 0 auto"><path d="M0 166.2 448.9-1.1 827.4 56.1l0 1023.9 0.1 28.9L452.1 1158.9 0 1008.4z" fill="#365798"/><path d="M25.3 985.5 24.1 190.5 413 46.8 412 1107.6zM478.1 1108.6 478.3 52.3 788.1 94.3l0 975.8z" fill="#a5b6d9"/><path d="M215.5 737 41.5 727 40.3 420.5 215.9 404.1zm16.7-334.5 156.1-19.4-1.2 359.8-155.2-4.8zM39.3 399.9l0-194.4 176-57.4 1.2 232.1zm350.8-317.2 0.9 274.5-158.7 20.4 0-238zm-253 909.7 0-235.1 141.7 9.3 0 268.4zm247 80.8-17.3-6.4c3.8-22.5-18.9-31.9-19.1-5.7l-18.7-5.5c-0.9-22.1-13.9-31.7-21.2-6.8l-9.7-3-0.6-277.7 12.3 0.9c-4.3 27.5 23.5 28.2 20.3 1.7L350.4 772c-4.4 28.6 23.2 28.9 20.4 1.3l12.7 0.8zM42.8 751.1l82.2 5.9-0.5 108-81.9-11.2zm83.1 129.3-0.9 110.4-82.7-20.2 0-102.4zM494.3 70l278.6 36.6 0 950-278.3 35.1z" fill="#365798"/><path d="m279 507.5c-0.1-5.1 0-10 3.2-14.2 6 0.2 4.9 9.7 5 14.3 10.3 5.1 4.9-10.8 10.2-15.3 7.6-0.8-0.6 16 6.9 15.8 4.9-0.1 3.9-2.4 3.8-6.7-0.1-3.9 0.4-7.8 3.8-10.3 8.2 3.1 0.8 18.2 11.2 15.8 0-6.4-1-14.2 5.8-17.6 2.6 5.2-0.1 14.8 5.4 16.1 7.4 1.7 8.4 3.6 10.2 10.5 0.8 3.1-0.4 4.6 2.8 6.4 3.5 2 7.6 1.4 7.7 6.1 0.1 6.4-2.7 5.5-7.6 5.5-1.8 0-2.4 3.4-2.5 4.7-0.4 4.7 0.4 5.7 5 7 5.9 1.7 4.9 3.3 4.9 8.7 0 2.7 0.5 1.2-3.1 1.9-5.7 1.1-7 0.3-6.7 6.8 0.4 7.8 13.4 1.4 9.7 12.6-1.6 4.8-9.5 1.1-9.5 5.3 0 5.3-1.1 7.7 5.4 8.2 6.4 0.5 6 9.1 0.4 11-3.4 1.2-4.6-0.1-5.8 4-1.2 4.1-1.1 8.4-2.6 12.5-6.1 4.5-11.6-1.7-11.6 8.4 0 2.7-0.6 4.7-1.1 7.3-0.9 5-2.2 0.7-5.8 1.8-1-1.2 0-7.9 0-9.5 0-4.7-1.6-5.8-7-5.4-0.3 5.8-0.2 12-4.9 16.2-2.9-1.9-4-4.8-4.2-8.1-0.3-6.5 0.2-6.7-6.5-8.3-1.2 2.9-2 11.4-1.5 14.5-5.2 2.6-6-5.4-6-8.6 0-2.7 1.1-5.7-2.3-6.7-3.4-0.9-4.6 0.8-4.7 3.9-0.2 6.1-0.5 8.8-5.3 12.2-1.9-5.4-0.3-14.7-6.6-16.4-7-1.8-7.9-6.9-8-13.6-0.1-7.3-8.9-0.3-8.9-8.2 0-0.8-0.6-4.9 0-5.5 2.9-2.1 5.8 1.2 8.5 0.1 1.3-3.6 1.8-9-2.1-9.9-4-0.9-7.8-1.4-6.9-6 1.1-5.7 0.1-5.4 6.3-5.8 4.7-0.3 3-5.2 3.1-8.4-6.2-2.9-8.8 0.8-8.8-7.4 0-5.6-0.4-5.1 5.2-5.1 4.8 0 3.4-1.7 3.4-6.3 0-5.1-9.2-0.6-9.6-7.6-0.2-3 1-5.6 3.9-6.7 5.1-2 5.7-2.3 5.9-7.8 0.3-8 5.6-8.9 12-12.1l0 0 0 0zM88.3 368.3l24.3-92.2-15.7 7.5 21.6-79 25.5-7.3-19.1 53.1 19.2-10.3-55.7 128.3 0 0z" fill="#a5b6d9"/><path d="m278.8 317.9c1.2-3.2 2.5-6.5 3.8-9.9 13.8 5.9 26.4 10.2 40.6 1.9 13.7-8 22.8-24.3 28-38.8 10.2-28.4 10.2-66.8-8.3-91.8-22.5-30.5-54.5-14.5-69.8 13.9-4.7 8.8-11.2 31.3-12.1 45.3-0.5 6.9-0.2 14.1 0.8 21.3 1 8.1 5.2 16.5 4.2 24.7-0.3 2.5-1.8 4.1-4.6 4.6-16.7-28-7.6-72.9 4.9-100.6 12.5-27.6 47.9-55.5 75.9-29 25.7 24.2 28.2 68.1 21.3 100.3-6.2 28.8-26 71.4-61.9 68.2-6.4-0.6-19.1-3.8-22.7-10l0 0zM299.3 272c-3.2-11.6 11.5-19.5 14.8-28.4 1.9-5.2-0.1-9.6-2.2-14-4.9-2.6-9-1.1-10.8 4-3.2 8.9-6.5 14.9-12.6 22.1-3.3-13.7-1.4-29.1 6.6-40.9 4.3-6.3 12.9-9.4 19.4-6.9 20.5 7.8 14.2 42.7 5.3 56.4-4.7 7.3-12.7 7.6-20.5 7.6L299.3 272zm3.4-25.8c0.5 0.7 0.5 1.4 0.2 2-9.4 21.3-18.7 42.6-28.2 64-0.9-0.4-1.4-0.4-1.7-0.7-3.3-3.9-5.6-8.5-7.8-13.1-0.9-1.8 0.1-3.6 1.2-5.1l32.8-43.7c0.9-1.3 2-2.6 3.4-3.4l0 0z" fill="#a5b6d8"/><path d="m188.7 921.7c-6.1 11.9-4.4 25.1-6 38-9.7-2.4-16.7-21.7-18.6-30 1.7-9.9 6.9-17.2 12.9-24.9 2.8-3.6 3.7-7.2 1.9-11.4-0.7-1.6-0.6-3.6-2-4.9-8.7 1.5-13.9 8.2-19.9 14-6.7-7-5.2-33.4 0.2-41.1 8.4-1.5 15.8 1 22.6 5.8 5.3-5.2 5.6-10.3 0.9-15.7-3.6-4.1-14.7-8.9-16.7-13.1-1.6-6.3 10.2-27.5 17.3-27.2 7.8 11.5 12.4 24.5 15 38.1 2.7 1.1 5.1 2.1 8.2 1.5 1.6-15.5-1.9-30.3-6.8-44.8 0.5-0.5 0.8-0.9 1-0.9 8.6 0.6 16.8 2.3 23.4 8.6 14.9 14.2-11.5 41.7 0.4 58.4 10.7-10.3 10.5-23.1 18.6-34 8 10.3 15 31 13.7 44.1-6.9 8.3-12.4 13-28.9 14.2 0.5 3.7-1.8 7.2-0.8 11.5 8.8 9.4 18.5 7.9 30.1 7.2 1.6 8.2-6.7 33.6-12.9 39.7-12.6-5.7-19.1-17.9-26.1-29.1-2.5 1.9-4.6 3.7-6.4 6.1 1.7 12.9 18 29.3 15.9 40.7-5.5 2.6-11.4 4.3-17.7 3.4-6.2-0.9-8.7-4.3-10.2-10.9-3.3-14.7 3.2-32.8-9.2-43.3zm118.5 22.1 0-63.8 67.8 10.9 0 67.4zM307.1 804.2 375 811.3 375 878.1 307.1 868.2zm67.7 165.5 0 66.8-67.6-18.6 0-63.6zm-320.5-31.7 0-28.9 13.7 2 16.5-16.6 0.7 67.6-16.3-20.9z" fill="#a5b6d9"/><path d="m89.1 914.4c1.4-0.6 2.3-0.5 3.4-0.2 2.8 6.5 3.9 13.4 3.6 20.5-0.1 2.7-1.1 5.1-1.7 7.6-0.5 1.9-1.8 3-3.4 3.9-1.3-1.3-0.9-2.5-0.6-3.8 0.8-3.7 1.6-7.3 1.7-11.1 0.2-5.8-1.6-11.2-2.9-16.9l0 0 0 0zm7 42.4c-0.3-3.3 0.9-6.2 1.6-9.1 1-4.4 2.5-8.8 3.1-13.2 0.8-5.6-1-11-2.4-16.4-0.7-2.5-1.5-5-2.2-7.5-0.4-1.6-0.7-3.1 0.2-4.5 1.3-0.1 1.8 0.6 2.1 1.3 2.1 4.3 3.6 8.6 4.5 13.3 1 5.5 0.5 10.9 0.9 16.3 0.3 3.5-0.8 6.9-1.3 10.2-0.6 3.8-2.6 7.4-6.6 9.6l0 0zm7.6 10.4c-1.9-3.7-1.4-6.5-0.1-9.8 3.1-8.1 5.9-16.4 5.3-25.2-0.5-7.7-1.8-15.2-4.6-22.4-1.2-3-2.3-6.1-3.3-9 0.8-1.2 1.7-2 3.4-1.6 1.8 4.1 3.9 8.3 5.1 12.8 5 19 5 37.4-5.7 55.3l0 0z" fill="#a5b6d9"/><path d="m598.7 1047.1-70.3 8.4-0.2-378.8 70.5-3.8zM688.5 533.1c-11 50.3-65.8 45.6-78.3 2.8l-92.4 3.1-0.2-67.9 89.4-3.3c22.8-54 64.5-46.2 81.8 0.2l66.2 0.4 1.6 61.8zm-172.4-237.1 0-24 241.7 7.5 0.1 19.4z" fill="#a5b6d9"/><path d="m52.3 827.5 62.6 9.7-19.2-43.4-8.2 15-13.4-29.3-21.8 48.1zM116.4 788c0 4.4-3.5 7.9-7.9 7.9-4.4 0-7.9-3.5-7.9-7.9 0-4.4 3.5-7.9 7.9-7.9 4.4 0 7.9 3.5 7.9 7.9z" fill="#a5b6d9"/><ellipse cx="649.4" cy="501.8" rx="31" ry="51.8" fill="#365798"/><path d="m177.7 627.1c-1.8 3-1.6 6.7 0.4 9.3l-26.3 40 6.6-0.1 25-36.7c3.2 0.6 6.6-0.9 8.5-3.8 2.4-3.9 1.2-9-2.7-11.4-3.9-2.4-9-1.2-11.5 2.7zm-110.8 29.7-9.7 12.9 4.6 4.3 7.9-11 7.1 0.3c0.4 0.7 0.9 1.4 1.5 2 3.3 3.3 8.6 3.3 11.8 0 3.3-3.3 3.3-8.6 0-11.8-3.3-3.3-8.6-3.3-11.8 0-1 1-1.7 2.3-2.1 3.6zm20.1-68.7c-4.4 0-8 3.6-8 8 0 4.4 3.6 8 8 8 3.7 0 6.8-2.5 7.7-6l44.5 1.3 17.4 21.5c-0.2 0.8-0.4 1.6-0.4 2.4 0 4.6 3.8 8.4 8.4 8.4 4.6 0 8.4-3.8 8.4-8.4 0-4.6-3.8-8.4-8.4-8.4-1.5 0-2.9 0.4-4.1 1.1l-18.9-22.9-48-1.3c-1.4-2.2-3.9-3.7-6.8-3.7zm13.5 27c-4.6 0.1-8.3 4-8.1 8.6 0.1 4.6 4 8.3 8.6 8.1 3.3-0.1 6-2.1 7.3-4.9l22.2-0.5c1.4 2.9 4.4 4.8 7.8 4.7 4.6-0.1 8.3-4 8.1-8.6-0.1-4.6-4-8.3-8.6-8.1-3.6 0.1-6.6 2.5-7.7 5.7l-21.5 0.5c-1.2-3.3-4.4-5.7-8.1-5.6zm-26 16.7c0 4.4-3.6 8-8 8-4.4 0-8-3.6-8-8 0-4.4 3.6-8 8-8 4.4 0 8 3.6 8 8zM87.6 476.5c-3.5 0.2-6.4 2.5-7.5 5.6l-22.6 1 0.3 6.2 22.6-1c1.4 3 4.4 5 7.9 4.9 4.6-0.2 8.1-4.1 7.9-8.7-0.2-4.6-4.1-8.2-8.7-8zm56.3 20c-4.6 0.1-8.3 4-8.1 8.6 0.1 4.6 4 8.3 8.6 8.1 3.3-0.1 6-2.1 7.3-4.9l25.3-0.7c1.4 2.9 4.4 4.8 7.8 4.7 4.6-0.1 8.3-4 8.1-8.6-0.1-4.6-4-8.3-8.6-8.1-3.6 0.1-6.6 2.5-7.7 5.7l-24.6 0.7c-1.2-3.3-4.4-5.7-8.1-5.6zm-44.4-30.4-4.1 4.7 19.8 17.1 80.9-3-0.5-6.2-78.3 2.8zm-41.6 51.7-0.2-6 68.2-4 71.4 103.9-5.3 3.3-70.1-101.1zm132.6 25.4c2.3-2.6 2.6-6.3 1.1-9.3l6.6-9.5 0.4-9-11.7 14.4c-3.1-1.1-6.7-0.2-9 2.4-3 3.5-2.7 8.7 0.8 11.7 3.5 3 8.7 2.7 11.8-0.8zm-32.3 0.4c2 2.9 5.5 4.1 8.7 3.3l30.7 44.3-0.1-9.8-25.5-38c1.8-2.8 1.8-6.4-0.2-9.3-2.6-3.8-7.8-4.7-11.6-2-3.8 2.6-4.7 7.8-2.1 11.6zm-34.8-9.6c-3.5 0.2-6.4 2.5-7.5 5.6l-57.2 2.9 0.3 6.2 57.2-2.9c1.4 3 4.4 5 7.9 4.9 4.6-0.2 8.1-4.1 7.9-8.7-0.2-4.6-4.1-8.2-8.7-8zm17.5 33-81.3 2 0.2 6.3 78.7-2 17.5 22.3c-0.2 0.8-0.4 1.6-0.4 2.4 0 4.6 3.8 8.4 8.4 8.4 4.6 0 8.4-3.8 8.4-8.4 0-4.6-3.8-8.4-8.4-8.4-1.5 0-2.9 0.4-4.1 1.1zM179.2 672.5c1.2 2.6 5 0.2 5.7 3.6-1 4.1-8.9 0.5-11.6 0.9-1.4-4.3 8.4-15.3 10.9-18.8 2.8-1.4 9.4 0 12.6 0 0.3 2.8 0.5 5.3-1.5 7.8-3.4 0.1-6.7-1.4-10.1-1.7-2 2.7-4 5.5-6 8.2zM67.3 604.9l-8.1 0 0-6.7c6.2 0 9.7-1.6 13.2 3.9 6.6 10.3 12.8 20.9 19.1 31.4 3.1 5.2 6.3 10.4 9.5 15.5 4.6 7.4 5.8 8 14.6 8.6 6.3 0.4 12.7 0.4 19.1 0.4 6.6 0 6.4-5.5 12.7-4.9 5.4 5.1 5.4 11.7 0 16.8-6 0.4-5.3-5.8-9.8-5.8l-19.2 0c-9.5 0-12.4 2.1-17.3-5.6-11.2-17.9-22.4-35.7-33.6-53.6z" fill="#a5b6d9"/><path d="m339.3 257.1c0 3.2-2.6 5.9-5.9 5.9-3.2 0-5.9-2.6-5.9-5.9 0-3.2 2.6-5.9 5.9-5.9 3.2 0 5.9 2.6 5.9 5.9zm14.4-13.7c0 3.2-2.6 5.9-5.9 5.9-3.2 0-5.9-2.6-5.9-5.9 0-3.2 2.6-5.9 5.9-5.9 3.2 0 5.9 2.6 5.9 5.9zm23 0c0 3.2-2.6 5.9-5.9 5.9-3.2 0-5.9-2.6-5.9-5.9 0-3.2 2.6-5.9 5.9-5.9 3.2 0 5.9 2.6 5.9 5.9zm-12.9 46.6c0 3.2-2.6 5.9-5.9 5.9-3.2 0-5.9-2.6-5.9-5.9 0-3.2 2.6-5.9 5.9-5.9 3.2 0 5.9 2.6 5.9 5.9zm14.7-11.5c0 3.2-2.6 5.9-5.9 5.9-3.2 0-5.9-2.6-5.9-5.9 0-3.2 2.6-5.9 5.9-5.9 3.2 0 5.9 2.6 5.9 5.9zm7.4-18.3c0 3.2-2.6 5.9-5.9 5.9-3.2 0-5.9-2.6-5.9-5.9 0-3.2 2.6-5.9 5.9-5.9 3.2 0 5.9 2.6 5.9 5.9z" transform="matrix(0.59478444,0,0,0.93466127,95.788817,-7.8295466)" fill="#365798"/></svg>';

    const STORE_LINKS_ID = 'ig-store-links';
    const STORE_LINK_CLASS = 'ig-store-link';
    const STORE_ICON_CLASS = 'ig-store-ico';
    const STORE_STYLES_ID = 'ig-store-styles';

    // Reintentos por si la caja de precio aun no esta en el DOM. Las fichas de
    // IndieGala llegan renderizadas del servidor y no hay navegacion de SPA
    // entre productos, asi que lo normal es acertar a la primera; esto solo
    // cubre el caso de que algun script de la tienda rehaga la columna.
    const STORE_RETRY_INTERVAL_MS = 250;
    const STORE_RETRY_MAX = 40;   // ~10 s

    /**
     * Nombre del producto para las busquedas externas. Prueba el data-* del
     * boton de carrito (el mas limpio), luego el <h1> sin su <em> de DRM y, por
     * ultimo, el <title> de la pagina, del que se extrae el nombre que IndieGala
     * repite ya sin sufijo.
     * @returns {string} Titulo limpio, o cadena vacia si no se pudo leer ninguno.
     */
    function getStoreProductTitle() {
        const fromData = document.querySelector(STORE_PROD_TITLE_SELECTOR)?.getAttribute('data-prod-title');

        let fromH1 = '';
        const h1 = document.querySelector(STORE_H1_SELECTOR);
        if (h1) {
            // Se clona para no tocar la pagina al quitarle el <em> del DRM.
            const copy = h1.cloneNode(true);
            copy.querySelectorAll('em').forEach((em) => em.remove());
            fromH1 = copy.textContent || '';
        }

        const fromDoc = (document.title.match(STORE_DOC_TITLE_REGEX) || [])[1] || '';

        return (fromData || fromH1 || fromDoc || '')
            .replace(STORE_TRADEMARK_REGEX, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Normaliza el titulo para la busqueda de GG.deals quitando los acentos:
     * GG.deals translitera en su indice, asi que "Pokémon" se busca como "Pokemon".
     * PCGamingWiki en cambio los conserva en sus articulos, y alli van tal cual.
     * @param {string} title - Titulo limpio del producto.
     * @returns {string} Titulo sin diacriticos.
     */
    function normalizeForGgDeals(title) {
        return title.normalize('NFD').replace(STORE_DIACRITICS_REGEX, '');
    }

    /**
     * Estilos de la fila de enlaces: dos botones a partes iguales dentro de la
     * caja de precio, con la misma pildora redondeada que usa la tienda para
     * "Add to Cart". El color es el de cada marca, que es lo que los separa del
     * rojo de comprar y evita que parezcan otro boton de la tienda.
     */
    function injectStoreStyles() {
        if (document.getElementById(STORE_STYLES_ID)) return;
        const style = document.createElement('style');
        style.id = STORE_STYLES_ID;
        style.textContent = `
            #${STORE_LINKS_ID} {
                flex: 1 0 100%; align-self: stretch; box-sizing: border-box;
                display: flex; gap: 8px; padding: 0 5px 5px;
            }
            /* Fuera de la caja de precio (ficha sin ella) la fila se alinea con el
               margen interior de la columna, que es mas ancho. */
            #${STORE_LINKS_ID}.ig-store-in-aside { padding: 0 15px 15px; }
            #${STORE_LINKS_ID} .${STORE_LINK_CLASS} {
                flex: 1 1 0; min-width: 0; box-sizing: border-box;
                display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                padding: 10px 12px; border-radius: 25px;
                font-size: 13px; font-weight: 700; line-height: 1.2;
                color: #fff; text-decoration: none; white-space: nowrap; overflow: hidden;
                cursor: pointer; transition: filter .15s ease;
            }
            #${STORE_LINKS_ID} .${STORE_LINK_CLASS}:hover { filter: brightness(1.12); color: #fff; text-decoration: none; }
            #${STORE_LINKS_ID} .ig-store-gg   { background: #12a150; }
            #${STORE_LINKS_ID} .ig-store-pcgw { background: #365798; }
            #${STORE_LINKS_ID} .${STORE_ICON_CLASS} { display: inline-flex; align-items: center; flex: 0 0 auto; }
            #${STORE_LINKS_ID} img.${STORE_ICON_CLASS} { width: 14px; height: 14px; object-fit: contain; }
            /* El logo de PCGamingWiki es mas alto que ancho (viewBox 827x1158): se
               fija el alto y se deja el ancho automatico para no deformarlo. */
            #${STORE_LINKS_ID} .${STORE_ICON_CLASS} svg { height: 15px; width: auto; display: block; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    /**
     * Crea un enlace con el icono a la izquierda de la etiqueta. Es un <a> real,
     * asi que funcionan el clic central y "copiar direccion del enlace".
     * @param {{ cls: string, label: string, url: string, iconSvg?: string, iconUrl?: string, tooltip: string }} opts
     * @returns {HTMLAnchorElement} El enlace listo para insertar.
     */
    function createStoreLinkButton({ cls, label, url, iconSvg, iconUrl, tooltip }) {
        const a = document.createElement('a');
        a.className = `${STORE_LINK_CLASS} ${cls}`;
        a.href = url;
        a.target = '_blank';
        a.rel = 'nofollow noopener external';
        a.title = tooltip;

        if (iconSvg) {
            const box = document.createElement('span');
            box.className = STORE_ICON_CLASS;
            box.innerHTML = iconSvg;
            a.appendChild(box);
        } else if (iconUrl) {
            const img = document.createElement('img');
            img.className = STORE_ICON_CLASS;
            img.src = iconUrl;
            img.alt = '';
            img.addEventListener('error', () => img.remove());  // sin icono si el CSP lo bloquea
            a.appendChild(img);
        }
        a.appendChild(document.createTextNode(label));
        return a;
    }

    /**
     * Fila con los dos enlaces, ya resuelto el titulo de la ficha.
     * @param {string} title - Titulo limpio del producto.
     * @returns {HTMLDivElement} El contenedor con los dos enlaces.
     */
    function createStoreLinks(title) {
        const box = document.createElement('div');
        box.id = STORE_LINKS_ID;

        box.appendChild(createStoreLinkButton({
            cls: 'ig-store-gg',
            label: 'GG.deals',
            url: GGDEALS_SEARCH_URL + encodeURIComponent(normalizeForGgDeals(title)),
            iconUrl: GGDEALS_ICON_URL,
            tooltip: T.storeGgTip
        }));
        box.appendChild(createStoreLinkButton({
            cls: 'ig-store-pcgw',
            label: 'PCGamingWiki',
            url: `${PCGW_SEARCH_URL}?${new URLSearchParams({ search: title })}`,
            iconSvg: PCGW_ICON_SVG,
            tooltip: T.storePcgwTip
        }));
        return box;
    }

    /**
     * Inserta la fila de enlaces. Es idempotente y devuelve true solo cuando los
     * botones quedaron puestos (o ya estaban): el false es lo que mantiene vivo
     * el reintento mientras falte el ancla o el titulo.
     * @returns {boolean} true si ya no hay nada mas que hacer.
     */
    function insertStoreLinks() {
        if (document.getElementById(STORE_LINKS_ID)) return true;

        const title = getStoreProductTitle();
        if (!title) return false;

        let anchor = null;
        for (const selector of STORE_ANCHOR_SELECTORS) {
            anchor = document.querySelector(selector);
            if (anchor) break;
        }
        if (!anchor) return false;

        injectStoreStyles();
        const links = createStoreLinks(title);
        if (!anchor.matches(STORE_PRICE_BOX_SELECTOR)) links.classList.add('ig-store-in-aside');
        anchor.appendChild(links);
        return true;
    }

    /**
     * Arranca el modulo de tienda: intenta insertar y, si algo no esta listo,
     * reintenta hasta ~10 s.
     */
    function initStoreLinks() {
        let tries = 0;
        const timer = setInterval(() => {
            tries++;
            let done = false;
            try {
                done = insertStoreLinks();
            } catch (e) {
                console.error('[IG-BulkTools] store links:', e);
                done = true;
            }
            if (done || tries >= STORE_RETRY_MAX) clearInterval(timer);
        }, STORE_RETRY_INTERVAL_MS);

        try {
            insertStoreLinks();
        } catch (e) {
            console.error('[IG-BulkTools] store links:', e);
        }
    }

    // Punto de entrada. Tres modos segun la ruta:
    //   /store/game|product/*  -> solo los dos enlaces externos. Sale antes de
    //     injectStyles() a proposito: ese CSS es todo del modulo de giveaways y
    //     en una ficha de producto no pinta nada.
    //   /library               -> solo, si venimos del boton "Revisar premios"
    //     (flag en el hash), la secuencia de auto-revision.
    //   /giveaways*            -> el flujo normal (cola, badges, widget de saldo).
    function boot() {
        if (isStoreProduct()) {
            initStoreLinks();
            return;
        }
        try { injectStyles(); } catch (e) {}
        if (isLibrary()) {
            if (location.hash && location.hash.indexOf(AUTOCHECK_HASH) !== -1) {
                runLibraryAutoCheck();
            }
            return;
        }
        startObserver();
        // Reaplicar filtros guardados (sort/level/busqueda) tras el render inicial.
        // Habilita la captura de cambios posteriores (marca filtersReady al terminar).
        reapplyFilters();
        // Vigilante de Wheel of Fortune (se auto-limita a /giveaways listado raiz).
        startWheelWatcher();
        // Detector de giro: recarga tras revelarse el premio (idem, listado raiz).
        watchWheelSpin();
        // Si venimos de esa recarga, reanunciar el premio junto al saldo nuevo.
        announceLastWheelPrize();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
