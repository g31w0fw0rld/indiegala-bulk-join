// ==UserScript==
// @name         Indiegala Giveaway Bulk Tools (Extra Odds bulk join + Single Ticket queue)
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  Anade a Indiegala Giveaways una cola unificada que mezcla "Single Ticket" (1 boleto) y "Extra Odds" (N boletos del mismo gid, con count por item) ejecutados secuencialmente. Permite añadir/quitar items mientras la cola corre, valida presupuesto restando lo ya comprometido, y usa un Web Worker timer para que las pausas no se inflen cuando la pestaña esta en background. Delays humanizados, control de aborto, boton Continuar tras stop recuperable. Incluye un widget de saldo GalaSilver con boton para abrir tu biblioteca en una pestaña nueva y revisar automaticamente los giveaways completados por ganar (Check all); si "Completed to check" esta vacio lo informa y de todas formas pasa a "Completed won" para detectar premios con fecha de hoy y avisarte (una sola vez por premio). ⚠️ USO BAJO TU PROPIO RIESGO: viola la politica anti-spam de Indiegala y puede causar ban permanente.
// @match        https://www.indiegala.com/giveaways
// @match        https://www.indiegala.com/giveaways/*
// @match        https://www.indiegala.com/library
// @match        https://www.indiegala.com/library/*
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

    const SCRIPT_VERSION = '1.5.0';
    console.log('[IG-BulkTools] cargado. Version:', SCRIPT_VERSION);
    console.warn(
        '[IG-BulkTools] ⚠️ ADVERTENCIA: este script automatiza acciones en Indiegala (bulk join + cola).\n' +
        'La politica de Indiegala prohibe cualquier automatizacion (incluso desde la misma cuenta) y\n' +
        'puede resultar en BAN PERMANENTE. Politica: https://docs.indiegala.com/giveaways_auctions_trades/spam.html\n' +
        'Uso bajo tu propio riesgo.'
    );

    // =============================================
    // INTERNACIONALIZACION (i18n)
    // =============================================

    const userLang = (navigator.language || 'en').split('-')[0];
    const i18n = {
        es: {
            // Bulk join (Extra Odds)
            bulkLabel: '⚠ Bulk JOIN',
            bulkLabelTooltip: '⚠ Riesgo de ban — la política de Indiegala prohíbe la automatización. Uso bajo tu propio riesgo.',
            bulkBadge: '⚠×{n}',
            bulkBadgeTooltip: '⚠ Riesgo de ban — comprar varios boletos (Extra Odds) automáticamente VIOLA la política de Indiegala y puede banear tu cuenta. Máx {n} con tu saldo.',
            modalTitle: 'Compra masiva de boletos',
            modalEnqueueTitle: 'Encolar boletos (Extra Odds)',
            modalGiveaway: 'Giveaway',
            modalPrice: 'Precio por boleto',
            modalBalance: 'Saldo GalaSilver',
            modalAvailable: 'Disponible (saldo − cola)',
            modalAlreadyQueued: 'Ya en cola',
            modalMax: 'Máximo posible',
            modalCount: 'Cantidad a comprar',
            modalCountAdd: 'Cantidad a añadir',
            modalTotalCost: 'Costo total',
            modalDelays: 'Espera entre boletos: 2.5–5 s · pausa larga 10–20 s cada 10',
            modalConfirm: 'Iniciar',
            modalEnqueueConfirm: 'Encolar',
            modalEnqueueAndRunConfirm: 'Encolar y ejecutar',
            modalCancel: 'Cancelar',
            invalidCount: 'Cantidad inválida (1 a {max}).',
            notEnough: 'No tienes GalaSilver suficiente para comprar al menos 1 boleto.',
            enqueueCapped: 'Cantidad recortada a {n} (saldo disponible).',
            enqueueNoBudget: 'Sin saldo disponible (descontando lo ya en cola) para encolar este item.',
            enqueuedAddedRunning: '{n} boletos añadidos a la cola en curso.',
            // Cola (Single Ticket)
            queueAddBtn: '＋',
            queueAddBtnTooltip: '⚠ Riesgo de ban — añadir este giveaway a la cola para entrar automáticamente. Uso bajo tu propio riesgo.',
            queueRemoveBtn: '✓',
            queueRemoveBtnTooltip: 'En cola — clic para quitar',
            queueNoBalance: 'Sin GalaSilver disponible. Recarga para encolar más giveaways.',
            queueNoBalanceTooltip: 'Sin GalaSilver — no puedes encolar este giveaway',
            queuePanelTitle: '⚠ Cola Single Ticket',
            queueTotalCost: '{n} boletos · {cost} iS',
            queueExecuteBtn: '▶ Ejecutar',
            queueClearBtn: '🗑 Vaciar',
            queueClearConfirm: '¿Vaciar toda la cola?',
            queueExecuteConfirmTitle: '⚠️ Confirmar ejecución de cola',
            queueLowBalance: 'Tu saldo ({balance} iS) es menor al costo total ({cost} iS). Algunos joins fallarán. ¿Continuar de todas formas?',
            queueProgressItem: '{title} ({i}/{n})',
            queueDone: 'Listo. {ok} de {n} entradas exitosas.',
            queueModalCount: 'Boletos en cola',
            // Compartido
            warningTitle: '⚠️ RIESGO DE BAN PERMANENTE',
            warningBody: 'La política de Indiegala prohíbe explícitamente cualquier forma de automatización para participar en giveaways, incluso desde la misma cuenta. Indiegala se reserva el derecho de banear permanentemente las cuentas que la violen. Usar este script bajo tu propio riesgo.',
            warningPolicyLink: 'Ver política oficial →',
            warningProgress: '⚠ Automatización en curso — riesgo de ban',
            warningProgressQueue: '⚠ Cola con automatización — riesgo de ban',
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
            widgetCheckBtn: '🎁 Revisar premios',
            widgetCheckBtnTooltip: 'Abre tu biblioteca en una pestaña nueva y revisa automáticamente los giveaways completados por ganar (Check all).',
            widgetBalanceUnknown: '— iS',
            widgetHideEntered: 'Ocultar ya participados',
            widgetHideEnteredTooltip: 'Oculta del listado los giveaways en los que ya tienes boleto. Se recuerda al recargar hasta que lo desmarques.',
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
            libDone: 'Listo: revisión de premios disparada.',
            wheelAvailableAlert: '🎡 ¡La Wheel of Fortune cambió de estado (puede estar disponible para girar)! Atiéndela ahora para que no se te pase.',
        },
        en: {
            // Bulk join (Extra Odds)
            bulkLabel: '⚠ Bulk JOIN',
            bulkLabelTooltip: '⚠ Ban risk — Indiegala policy forbids automation. Use at your own risk.',
            bulkBadge: '⚠×{n}',
            bulkBadgeTooltip: '⚠ Ban risk — buying multiple tickets (Extra Odds) automatically VIOLATES Indiegala policy and may ban your account. Max {n} with your balance.',
            modalTitle: 'Bulk ticket purchase',
            modalEnqueueTitle: 'Queue tickets (Extra Odds)',
            modalGiveaway: 'Giveaway',
            modalPrice: 'Price per ticket',
            modalBalance: 'GalaSilver balance',
            modalAvailable: 'Available (balance − queue)',
            modalAlreadyQueued: 'Already queued',
            modalMax: 'Max possible',
            modalCount: 'Tickets to buy',
            modalCountAdd: 'Tickets to add',
            modalTotalCost: 'Total cost',
            modalDelays: 'Wait between tickets: 2.5–5 s · long pause 10–20 s every 10',
            modalConfirm: 'Start',
            modalEnqueueConfirm: 'Queue',
            modalEnqueueAndRunConfirm: 'Queue & run',
            modalCancel: 'Cancel',
            invalidCount: 'Invalid amount (1 to {max}).',
            notEnough: 'Not enough GalaSilver to buy at least 1 ticket.',
            enqueueCapped: 'Capped to {n} (available budget).',
            enqueueNoBudget: 'No available budget (after subtracting queue) to enqueue this item.',
            enqueuedAddedRunning: '{n} tickets added to the running queue.',
            // Queue (Single Ticket)
            queueAddBtn: '＋',
            queueAddBtnTooltip: '⚠ Ban risk — add this giveaway to the queue for automatic entry. Use at your own risk.',
            queueRemoveBtn: '✓',
            queueRemoveBtnTooltip: 'In queue — click to remove',
            queueNoBalance: 'No GalaSilver available. Top up to queue more giveaways.',
            queueNoBalanceTooltip: 'No GalaSilver — cannot queue this giveaway',
            queuePanelTitle: '⚠ Single Ticket Queue',
            queueTotalCost: '{n} tickets · {cost} iS',
            queueExecuteBtn: '▶ Execute',
            queueClearBtn: '🗑 Clear',
            queueClearConfirm: 'Clear the entire queue?',
            queueExecuteConfirmTitle: '⚠️ Confirm queue execution',
            queueLowBalance: 'Your balance ({balance} iS) is lower than total cost ({cost} iS). Some joins will fail. Continue anyway?',
            queueProgressItem: '{title} ({i}/{n})',
            queueDone: 'Done. {ok} of {n} entries successful.',
            queueModalCount: 'Tickets queued',
            // Shared
            warningTitle: '⚠️ PERMANENT BAN RISK',
            warningBody: 'Indiegala policy explicitly forbids any form of automation to enter giveaways, even from the same account. Indiegala reserves the right to permanently ban accounts that violate it. Use this script at your own risk.',
            warningPolicyLink: 'See official policy →',
            warningProgress: '⚠ Automation running — ban risk',
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
            widgetCheckBtn: '🎁 Check prizes',
            widgetCheckBtnTooltip: 'Opens your library in a new tab and automatically checks completed giveaways to see if you won (Check all).',
            widgetBalanceUnknown: '— iS',
            widgetHideEntered: 'Hide already entered',
            widgetHideEnteredTooltip: 'Hides from the listing the giveaways you already hold a ticket in. Remembered across reloads until you uncheck it.',
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
            libDone: 'Done: prize check triggered.',
            wheelAvailableAlert: '🎡 The Wheel of Fortune changed state (it may be available to spin)! Go attend it now so you don\'t miss it.',
        },
    };
    const T = i18n[userLang] || i18n.en;
    const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));

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
        wheelCheckIntervalMs: 15 * 60 * 1000,
    };

    const STORAGE_KEY = 'ig-st-queue';
    // Preferencias persistentes del usuario (independientes de la cola):
    //   hideEntered  -> ocultar del listado los giveaways en los que ya tienes boleto
    //   balanceMin   -> widget de saldo minimizado
    //   queueMin     -> panel de cola minimizado
    const SETTINGS_KEY = 'ig-bulk-settings';
    // gids de giveaways ganados ya anunciados (premios "vistos"), para no
    // re-notificar el mismo premio cada vez que se pulsa "Revisar premios".
    const SEEN_WINS_KEY = 'ig-bulk-seen-wins';
    const BULK_BTN_CLASS = 'ig-bulk-join-btn';
    const BULK_BADGE_CLASS = 'ig-bulk-join-badge';
    const QBTN_CLASS = 'ig-q-btn';
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

    // =============================================
    // ESTADO
    // =============================================
    let running = false;
    let abortFlag = false;
    let queue = loadQueue();
    let settings = loadSettings();

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
            addedAt: it.addedAt || Date.now(),
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
        const def = { hideEntered: false, balanceMin: false, queueMin: false };
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
            target: null,
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
            acceptNode: (n) => /galasilver/i.test(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
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

    // Decrementa el saldo cacheado tras un join exitoso, sincroniza con el DOM
    // (toma el menor) y refresca badges + estado de los botones de cola.
    function consumeBalance(amount) {
        if (currentBalance == null) {
            currentBalance = getGalaSilver();
        }
        if (currentBalance != null) {
            currentBalance = Math.max(0, currentBalance - (amount || 0));
        }
        // Re-verificar contra el div de info del usuario por si Indiegala ya
        // actualizo el saldo (caso comun: respuesta del servidor llegada antes
        // del siguiente tick) y para protegernos de quedar por encima del real.
        const dom = getGalaSilver();
        if (dom != null) {
            currentBalance = (currentBalance == null) ? dom : Math.min(currentBalance, dom);
        }
        refreshBulkBadges();
        refreshQueueButtonsState();
    }

    // Lee el saldo del DOM y SOBREESCRIBE el cache (puede subir o bajar). A
    // diferencia de getCurrentBalance/consumeBalance, no usa Math.min: aqui se
    // confia en el div del usuario como verdad. Pensado para puntos donde el
    // usuario hace una accion explicita y queremos darle la cifra mas reciente
    // (p.ej. cuando intenta encolar y el cache dice 0).
    function forceReadBalance() {
        const dom = getGalaSilver();
        if (dom != null) {
            currentBalance = dom;
            refreshBulkBadges();
            refreshQueueButtonsState();
        }
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
                            response: r,
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
            'a[data-price]',
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
            .${QBTN_CLASS}.ig-q-btn-disabled {
                opacity: 0.4;
                cursor: not-allowed;
                background: rgba(40, 40, 40, 0.85);
            }
            .${QBTN_CLASS}.ig-q-btn-disabled:hover { transform: none; }

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
            #${PANEL_ID} .ig-q-it-rem {
                width: 22px; height: 22px;
                border: none; border-radius: 50%;
                background: #c62828; color: #fff;
                cursor: pointer; font-weight: bold;
                font-size: 12px; line-height: 1;
            }
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
            #${MODAL_ID} .ig-actions { display: flex; gap: 8px; margin-top: 12px; }
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
                /* Si el overlay de progreso ya muestra el warning, ocultamos
                   la copia del header de la cola para no duplicarlo. */
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
    // Auto-cap: si el usuario tipea > max, al confirmar se recorta silencioso a
    // max y se muestra un toast. Si max=0 (sin presupuesto), devuelve null.
    function openEnqueueCountModal(params, contextLabel, opts) {
        opts = opts || {};
        const isRunning = !!opts.isRunning;
        return new Promise((resolve) => {
            const balance = getCurrentBalance();
            const existing = findQueueItem(params.gid);
            const alreadyPending = existing ? itemPending(existing) : 0;
            const maxAdd = maxEnqueueCount(params.price);
            if (balance == null) { showToast(T.balanceUnknown, 'error'); resolve(null); return; }
            if (maxAdd == null || maxAdd < 1) { showToast(T.enqueueNoBudget, 'warn'); resolve(null); return; }

            const confirmLabel = isRunning ? T.modalEnqueueConfirm : T.modalEnqueueAndRunConfirm;
            const available = availableForEnqueue();
            const defaultVal = Math.min(maxAdd, Math.max(1, opts.suggested || maxAdd));

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
                    <div class="ig-row"><b>${T.modalMax}</b><span>${maxAdd}</span></div>
                    <label style="display:block;margin-top:10px;font-size:12px;color:#555">${T.modalCountAdd}:</label>
                    <input type="number" id="ig-bulk-count" min="1" max="${maxAdd}" value="${defaultVal}">
                    <div class="ig-inline-error" id="ig-bulk-error"></div>
                    <div class="ig-row"><b>${T.modalTotalCost}</b><span id="ig-bulk-total">${defaultVal * params.price} iS</span></div>
                    <div class="ig-note">${T.modalDelays}</div>
                    <div class="ig-actions">
                        <button class="ig-cancel">${T.modalCancel}</button>
                        <button class="ig-confirm">${confirmLabel}</button>
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
            backdrop.querySelector('.ig-confirm').addEventListener('click', () => {
                let v = parseInt(input.value, 10);
                if (isNaN(v) || v < 1) {
                    errorEl.textContent = fmt(T.invalidCount, { max: maxAdd });
                    errorEl.classList.add('ig-visible');
                    input.focus();
                    input.select();
                    return;
                }
                if (v > maxAdd) {
                    showToast(fmt(T.enqueueCapped, { n: maxAdd }), 'warn');
                    v = maxAdd;
                }
                close(v);
            });
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

        try {
            while (true) {
                if (abortFlag) { stopCode = 'aborted'; break; }
                // Toma el primer item con count>done. queue es la fuente viva.
                const it = queue.find(q => itemPending(q) > 0);
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
                    n: totalForBar,
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
                    if (dp != null) price = dp;
                    if (isErrorVisible(triggerEl)) { stopCode = 'error'; break; }
                }

                const balNow = getCurrentBalance();
                if (balNow != null && balNow < price) { stopCode = 'balance_low'; break; }

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
                            n: success + newRem,
                        }));
                    } else if (st === 'silver') { stopCode = 'balance_low'; break; }
                    else if (st === 'too_fast') { stopCode = 'too_fast'; break; }
                    else if (st === 'banned') { stopCode = 'banned'; break; }
                    else if (st === 'duplicate' || st === 'limit_reached' || st === 'not_available' || st === 'level' || st === 'owner') {
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
            const stopReason = stopReasonFromCode(stopCode);
            const finalMsg = stopReason
                ? `${stopReason} (${success}/${finalTotal})`
                : fmt(T.queueDone, { ok: success, n: finalTotal });

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
        const activeGid = running ? (queue.find(q => itemPending(q) > 0) || {}).gid : null;

        // El MutationObserver re-dispara injectAll() (y por ende este render)
        // cada vez que el sitio toca el DOM por AJAX/carrusel. Reescribir
        // innerHTML resetea scrollTop de la lista a 0, asi que el scroll del
        // usuario "rebota" al inicio. Para evitarlo, solo reconstruimos cuando
        // el contenido visible cambio de verdad: firma = items pendientes +
        // totales + item activo + estado running. Si la firma no cambio,
        // salimos sin tocar el DOM y el scroll se preserva.
        const sig = JSON.stringify({
            r: running,
            a: activeGid,
            t: totalTickets,
            c: totalCost,
            items: queue.map(q => [q.gid, q.title, itemPending(q), q.price || 0, q.count || 1, q.done || 0]),
        });
        if (panel.dataset.sig === sig && panel.querySelector('.ig-q-list')) return;
        panel.dataset.sig = sig;

        const items = queue.map(q => {
            const pending = itemPending(q);
            const totalForRow = pending * (q.price || 0);
            const multi = (q.count || 1) > 1;
            const countLabel = multi ? `<span class="ig-q-it-count" title="${q.done || 0}/${q.count}">×${pending}</span>` : '';
            const isActive = q.gid === activeGid;
            return `
                <li class="${isActive ? 'ig-q-li-active' : ''}">
                    <span class="ig-q-it-title" title="${escapeHtml(q.title)} — ${escapeHtml(q.timeLeft || '')}">${escapeHtml(q.title)}</span>
                    ${countLabel}
                    <span class="ig-q-it-price">${totalForRow} iS</span>
                    <button class="ig-q-it-rem" data-gid="${escapeHtml(q.gid)}" title="${T.queueRemoveBtnTooltip}">×</button>
                </li>
            `;
        }).join('');
        panel.innerHTML = `
            <div class="ig-q-warning-bar">${T.warningProgressQueue}</div>
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
        panel.querySelector('#ig-q-min').addEventListener('click', (e) => {
            e.preventDefault();
            settings.queueMin = !settings.queueMin;
            saveSettings();
            applyQueueMinState(panel);
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
        // "Disponible" para singles = saldo - cola pendiente. Si <=0 marcamos
        // el ＋ como deshabilitado (no se puede agregar otro single sin
        // exceder el presupuesto comprometido).
        const avail = availableForEnqueue();
        document.querySelectorAll('.' + QBTN_CLASS).forEach(btn => {
            const gid = btn.dataset.gid;
            const price = parseInt(btn.dataset.price, 10);
            const inQ = isInQueue(gid);
            const noBalance = !inQ && avail != null && (!isNaN(price) ? avail < price : avail <= 0);
            btn.classList.toggle('ig-q-btn-active', inQ);
            btn.classList.toggle('ig-q-btn-disabled', noBalance);
            btn.textContent = inQ ? T.queueRemoveBtn : T.queueAddBtn;
            btn.title = inQ
                ? T.queueRemoveBtnTooltip
                : (noBalance ? T.queueNoBalanceTooltip : T.queueAddBtnTooltip);
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
    function renderBalanceWidget() {
        if (isLibrary()) {
            const ex = document.getElementById(BALANCE_WIDGET_ID);
            if (ex) ex.remove();
            return;
        }
        if (!document.body) return;
        let w = document.getElementById(BALANCE_WIDGET_ID);
        if (!w) {
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
                    <label class="ig-bw-toggle" title="${escapeHtml(T.widgetHideEnteredTooltip)}">
                        <input type="checkbox" id="ig-bw-hide-entered">
                        <span>${T.widgetHideEntered}</span>
                    </label>
                    <button type="button" class="ig-bw-btn" id="ig-bw-check" title="${escapeHtml(T.widgetCheckBtnTooltip)}">${T.widgetCheckBtn}</button>
                </div>
            `;
            document.body.appendChild(w);
            w.querySelector('#ig-bw-check').addEventListener('click', (e) => {
                e.preventDefault();
                window.open(LIBRARY_URL + '#' + AUTOCHECK_HASH, '_blank', 'noopener');
            });
            // Toggle "Ocultar ya participados": persiste y re-aplica al instante.
            const hideChk = w.querySelector('#ig-bw-hide-entered');
            hideChk.addEventListener('change', () => {
                settings.hideEntered = hideChk.checked;
                saveSettings();
                applyHideEntered();
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
        applyBalanceMinState(w);
        const bal = getCurrentBalance();
        const amountEl = w.querySelector('#ig-bw-amount');
        if (amountEl) amountEl.textContent = (bal == null) ? T.widgetBalanceUnknown : (bal + ' iS');
        const availEl = w.querySelector('#ig-bw-avail');
        if (availEl) {
            const pendingCost = pendingQueueCost();
            if (bal != null && pendingCost > 0) {
                availEl.style.display = '';
                availEl.textContent = fmt(T.widgetAvailable, { n: Math.max(0, bal - pendingCost) });
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
        const n = await openEnqueueCountModal(params, contextLabel, { isRunning: wasRunning });
        if (!n || n < 1) return;
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
            addedAt: Date.now(),
        });
        if (wasRunning) {
            showToast(fmt(T.enqueuedAddedRunning, { n }), 'info');
        } else {
            // Atajo "encolar y ejecutar": el usuario ya confirmo la cantidad
            // en el modal, no hace falta el modal de cola otra vez.
            executeQueue({ skipConfirm: true });
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
        const m = /(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/.exec(String(str || ''));
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

    // Chequeo puntual en el load actual: espera a que el .menu-fortune-wheel
    // exista (el submenu de usuario puede renderizarse por AJAX), compara su
    // firma contra la base y, si difiere, dispara un alert() bloqueante.
    async function checkWheelOnce() {
        const el = await waitForElement(WHEEL_SELECTOR, 15000);
        if (!el) {
            console.log('[IG-BulkTools] wheel: elemento no encontrado, omito chequeo.');
            return;
        }
        const sig = normalizeHtmlSig(el.outerHTML);
        const changed = sig !== WHEEL_BASELINE_SIG;
        console.log('[IG-BulkTools] wheel sig:', sig, '| baseline:', WHEEL_BASELINE_SIG, '| changed:', changed);
        if (changed) {
            try { (typeof unsafeWindow !== 'undefined' && unsafeWindow.alert ? unsafeWindow.alert : window.alert)(T.wheelAvailableAlert); }
            catch (_) { try { window.alert(T.wheelAvailableAlert); } catch (__) {} }
        }
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
        '.items-list-item-data-cont.on',
    ];
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
        // Aun cargando (lazy-load): no se puede decidir todavia -> no ocultar.
        if (item.classList.contains('wait')) return false;
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
        const joinBtn = item.querySelector('.items-list-item-data-button a[data-price]');
        const joinClick = item.querySelector('a.items-list-item-ticket-click[onclick*="joinGiveaway"]');
        if (!joinBtn && !joinClick) return true;
        return false;
    }

    // Aplica la preferencia "Ocultar ya participados": esconde (o restaura) la
    // celda completa (.items-list-col) de cada giveaway en el que ya tienes
    // boleto. Pasada independiente de injectListing porque los items entrados
    // pueden no exponer el trigger de join. Se reejecuta en cada injectAll
    // (disparado por el MutationObserver) para cubrir items cargados por AJAX.
    function applyHideEntered() {
        if (isLibrary()) return;
        const hide = !!settings.hideEntered;
        document.querySelectorAll('.items-list-item').forEach(item => {
            const cell = item.closest('.items-list-col') || item;
            if (hide && isAlreadyEntered(item)) cell.classList.add('ig-entered-hidden');
            else cell.classList.remove('ig-entered-hidden');
        });
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
                    // fresca del DOM antes de validar contra el precio.
                    let avail = availableForEnqueue();
                    if (avail == null || avail <= 0) {
                        forceReadBalance();
                        avail = availableForEnqueue();
                    }
                    if (avail == null) { showToast(T.balanceUnknown, 'error'); return; }
                    if (avail < params.price) { showToast(T.enqueueNoBudget, 'warn'); return; }
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
                        addedAt: Date.now(),
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

    function injectAll() {
        try { injectStyles(); } catch (e) {}
        try { injectCardDetail(); } catch (e) { console.error('[IG-BulkTools] injectCardDetail:', e); }
        try { injectListing(); } catch (e) { console.error('[IG-BulkTools] injectListing:', e); }
        try { applyHideEntered(); } catch (e) { console.error('[IG-BulkTools] applyHideEntered:', e); }
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

    // Punto de entrada. En /library NO se monta la cola ni el observador de
    // giveaways: solo, si venimos del boton "Revisar premios" (flag en el hash),
    // se dispara la secuencia de auto-revision. En el resto de paginas (/giveaways*)
    // arranca el flujo normal (cola, badges, widget de saldo).
    function boot() {
        try { injectStyles(); } catch (e) {}
        if (isLibrary()) {
            if (location.hash && location.hash.indexOf(AUTOCHECK_HASH) !== -1) {
                runLibraryAutoCheck();
            }
            return;
        }
        startObserver();
        // Vigilante de Wheel of Fortune (se auto-limita a /giveaways listado raiz).
        startWheelWatcher();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
