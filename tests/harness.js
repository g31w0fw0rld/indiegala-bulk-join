// Arranca EL USERSCRIPT DE VERDAD dentro de jsdom, sobre un DOM de
// /giveaways, y devuelve lo que dejó hecho: qué URLs pidió, en qué orden quedó
// el listado, cuántas tarjetas hay, qué dice la línea de estado del widget.
//
// Se miran EFECTOS OBSERVABLES —el orden de los gid en la fila, los botones ＋
// que aparecen, las peticiones que salen— y no funciones internas: así un
// refactor no rompe los tests y un cambio de comportamiento sí.
//
// El DOM no es inventado: sale de los volcados reales del 2026-08-20, incluido
// el detalle que más importa aquí —el carrusel de arriba viene CUATRO veces
// (las variantes responsive) y repite giveaways del listado—, porque es
// exactamente la trampa en la que cae un `querySelectorAll` sin ámbito.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

// Se puede apuntar a otra copia del script con IG_SCRIPT=... , que es como se
// corren los controles negativos: las mismas pruebas contra la version
// publicada. Una prueba que pasa igual con el codigo viejo no mide lo que dice.
const SCRIPT_PATH = process.env.IG_SCRIPT
    || __dirname + '/../indiegala-bulk-join.user.js';

// Firma exacta que el script lleva hardcodeada como "sin novedad". Escrita
// igual, atributo por atributo: normalizeHtmlSig() colapsa espacios y pasa a
// minúsculas, pero NO reordena atributos, así que el orden importa.
const WHEEL_BASELINE = '<li class="menu-fortune-wheel"><span><i aria-hidden="true" class="fa fa-gift"></i>Wheel of Fortune</span></li>';
// Cualquier cosa distinta = "hay ruleta por girar". Esto es lo que ve el
// usuario cuando le toca girar: el <li> pasa a ser un enlace.
const WHEEL_AVAILABLE = '<li class="menu-fortune-wheel"><a href="#" onclick="openFortuneWheel()"><span><i aria-hidden="true" class="fa fa-gift"></i>Wheel of Fortune</span></a></li>';

// Una tarjeta como las que sirve el sitio. `lev` 0 y tipo single = sin control
// de compra (lo que Indiegala manda para los giveaways de tu nivel en los que
// ya tienes boleto); cualquier otra combinación lo lleva, con su token.
// `imgSuffix` reproduce lo que Indiegala pide de verdad en produccion: la
// cabecera de Steam con SU sufijo, .../apps/<appid>_ig/header.jpg, que en el CDN
// de Steam no existe (404 en los siete appids probados el 2026-08-31). Es opcional
// porque los tests viejos solo cuentan imagenes reveladas y la URL les da igual.
function cell(spec) {
    const { gid, title, lev = 0, type = 'single', price = 12, sold = 100,
            time = '3 days left', imgSuffix = false } = spec;
    const appid = imgSuffix ? `${gid}_ig` : String(gid);
    const extra = type === 'extra';
    const label = extra ? 'extra odds' : 'single ticket';
    const typeClass = extra ? 'items-list-item-type-guaranteed' : 'items-list-item-type-not-guaranteed';
    const levSpan = lev > 0
        ? ` - <span title="Users with level ${lev} or higher can join this giveaway ">Lev. ${lev}</span>`
        : '';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const control = (lev > 0 || extra) ? `<div class="items-list-item-data-cont items-list-item-ticket"><div class="relative"><div class="items-list-item-tooth"></div><a class="items-list-item-ticket-click" href="#" onclick="joinGiveawayOrAuction( this, event, '${gid}', ${extra ? 1 : 0}, 'TOKEN${gid}')"></a><div class="items-list-item-data overflow-auto"><div class="left items-list-item-data-left"><div class="items-list-item-data-top items-list-item-data-left-top">time</div><div class="items-list-item-data-bottom items-list-item-data-left-bottom">${time}</div></div><div class="right items-list-item-data-right"><div class="items-list-item-data-top items-list-item-data-right-top">sold</div><div class="items-list-item-data-bottom items-list-item-data-right-bottom">${sold}</div></div><div class="right items-list-item-data-button bg-gradient-red"><a data-price="${price}" href="#">${price} iS</a></div></div></div></div>` : '';
    return `<div class="col-3 items-list-col"><div class="items-list-item"><div class="relative"><div class="items-list-item-error display-none"><div class="items-list-item-error-inner display-none"><div class="items-list-item-error-text"><span></span><span></span></div></div></div><h5 class="items-list-item-title"><a href="/giveaways/card/${slug}/${gid}">${title}</a></h5><figure><a href="/giveaways/card/${slug}/${gid}" title="${title}"><img alt="${title} product image" class="display-none" data-img-src="https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg"/></a></figure><figcaption><div class="items-list-item-type relative ${typeClass}">${label}${levSpan}</div><div class="items-list-item-data-placeholder"></div></figcaption>${control}</div></div></div>`;
}

// Barra de paginación como la del sitio: el total en la primera celda ("57
// items", que un parseInt descuidado leería como página 57), los números, y la
// doble flecha derecha apuntando a la ÚLTIMA página, que es de donde el script
// saca cuántas hay.
function pagination({ current, last, level, total }) {
    const url = n => `/giveaways/ajax/${n}/expiry/asc/level/${level}`;
    const link = (n, cls, icon) => `<div class="page-link-cont left"><a${cls ? ` class="${cls}"` : ''} href="${url(n)}" onclick="loadGiveawaysListContents('${url(n)}'); return false">${icon || n}</a></div>`;
    let out = `<div class="page-link-cont left">${total} items</div>`;
    if (last > 1) {
        if (current > 1) {
            out += link(1, 'prev-next', '<i aria-hidden="true" class="fa fa-angle-double-left"></i>');
            out += link(current - 1, 'prev-next', '<i aria-hidden="true" class="fa fa-angle-left"></i>');
        }
        for (let n = 1; n <= last; n++) {
            out += n === current
                ? `<div class="page-link-cont left"><span class="current">${n}</span></div>`
                : link(n);
        }
        if (current < last) {
            out += link(current + 1, 'prev-next', '<i aria-hidden="true" class="fa fa-angle-right"></i>');
        }
        // La doble flecha derecha sale también en la última página (apuntándose
        // a sí misma), tal como se vio en el volcado de la página 7.
        out += link(last, 'prev-next', '<i aria-hidden="true" class="fa fa-angle-double-right"></i>');
    } else {
        out += `<div class="page-link-cont left"><span class="current">1</span></div>`;
    }
    return `<div class="overflow-auto"><div class="right"><div class="pagination overflow-auto">${out}</div></div></div>`;
}

function html({ current, last, level, total, cells, wheel, search, busy, carousel,
                saldo = 10, cardJoin = null }) {
    // El carrusel, CUATRO veces, con giveaways que también están en el listado.
    const slider = [1, 2, 3, 4].map(i =>
        `<section class="page-slider-cont"><div class="carousel slide" id="page-slider-${i}"><div class="carousel-inner"><div class="carousel-item active"><div class="row items-list-row">${carousel.join('')}</div></div></div></div></section>`
    ).join('');
    const overlay = busy ? '<div id="ig-bulk-progress-overlay"><div>Ejecutando cola</div></div>' : '';
    // Trigger de FICHA DE DETALLE (.card-join, con onclick joinGiveawayCard)
    // metido a mano en el DOM del listado. Es un DOM que el sitio no sirve, y se
    // usa a proposito: es la unica forma de ejercer el findTrigger que devolvia
    // "el trigger de la ficha en la que estas" SIN comprobar el gid. Con los dos
    // triggers presentes se puede afirmar a cual de los dos giveaways se fue el
    // join, que es el fallo que se estaba arreglando.
    const cardJoinHtml = cardJoin
        ? `<div class="card-join"><a data-price="${cardJoin.price}" href="#" onclick="joinGiveawayCard( this, event, '${cardJoin.gid}', 1, '${cardJoin.token}')">JOIN</a></div>`
        : '';
    const wheelLi = wheel === 'available' ? WHEEL_AVAILABLE : WHEEL_BASELINE;
    return `<!doctype html><html lang="en"><head><title>IndieGala Giveaways</title>
    <style>
      /* Las dos reglas del CSS de IndieGala de las que depende el script: la
         clase utilitaria que esconde cosas, y el ancho de la rejilla. Sin
         ellas, jsdom da display:block a lo que en el sitio está oculto, y
         isSearchActive() cree que hay una busqueda delante SIEMPRE. */
      .display-none { display: none !important; }
      .items-list-row { display: flex; flex-wrap: wrap; }
      .items-list-col { flex: 0 0 25%; }
    </style></head><body>
    <header>
      <nav><ul class="user-menu">${wheelLi}</ul></nav>
      <a href="/account"><span>GalaSilver</span><span id="galasilver-amount">${saldo}</span> iS<span id="galacredits-amount">$ 2.80</span></a>
    </header>
    ${overlay}
    ${cardJoinHtml}
    ${slider}
    <section class="page-contents-list-cont">
      <div class="page-contents-list-menu"><div class="page-contents-list-menu-inner">
        <nav class="page-contents-list-menu-sort"><ul class="page-contents-list-menu-sort-inner">
          <li class="left page-contents-list-menu-value"><a class="selected" data-rel="expiry" href="#" onclick="setSortOrder('expiry', this, event)">Time left<i aria-hidden="true" class="fa fa-caret-up"></i></a></li>
        </ul></nav>
        <nav class="page-contents-list-menu-level"><ul class="page-contents-list-menu-level-inner">
          <li class="left page-contents-list-menu-value relative"><a class="page-contents-list-submenu-current-level" href="#" onclick="toggleLevelSubmenu(this, event)"><span>${level === 'all' ? 'All levels' : 'Level ' + level}</span></a>
          <ul class="page-contents-list-submenu-level display-none" style="display: none;"><li><a href="#" onclick="setLevel('all', this, event)">All levels</a></li><li><a href="#" onclick="setLevel('0', this, event)">Level 0</a></li></ul></li>
        </ul></nav>
        <div class="page-contents-list-menu-search"><input class="right page-contents-list-menu-search-input" id="search-box" type="text"></div>
      </div></div>
      <div class="page-contents-to-hide relative" id="ajax-contents-container"${search ? ' style="display: none;"' : ''}>
        <div class="page-contents-ajax-list-cover display-none" style="display: none;"></div>
        <div class="page-contents-ajax-list" style="opacity: 1;">
          <div class="page-contents-list"><div class="row items-list-row">${cells.join('')}</div></div>
          ${pagination({ current, last, level, total })}
        </div>
      </div>
      <div class="page-contents-ajax-search relative display-none"${search ? ' style="display: block;"' : ''}>
        <div class="page-contents-ajax-inner relative">
          <div class="page-contents-ajax-results display-none"${search ? ' style="display: block;"' : ''}>
            ${search ? `<div class="page-contents-list"><div class="row items-list-row">${cells.join('')}</div></div>` : ''}
          </div>
        </div>
      </div>
    </section>
    </body></html>`;
}

// `pages` es {numero: [spec de tarjeta, ...]}. `serve` permite responder mal a
// una página concreta: {4: 500} devuelve un HTTP 500, y {4: {current_page: 9}}
// sirve la página equivocada.
async function run({
    current = 1, last = 3, level = 'all', pages = {}, carousel = [],
    loadAllPages = true, rememberFilters = false, savedPage = 1,
    wheel = 'baseline', search = false, busy = false, serve = {},
    withAsyncImgLoader = false, waitMs = 5000, retitulo = null, hover = null,
    // Portadas con el sufijo `_ig` que Indiegala pide de verdad.
    imgSuffix = false,
    // Cuantas veces se le dispara 'error' a cada portada ya revelada. El
    // barrido por `complete`/naturalWidth NO se puede ejercer aqui: jsdom no
    // carga imagenes nunca, asi que un <img> CON src se queda en
    // complete:false para siempre (comprobado) y el barrido lo salta, que es
    // justo lo que tiene que hacer. Lo que si es fiel es el evento: un 404
    // dispara 'error' en el <img>, y dispatchEvent recorre la fase de captura
    // hasta el listener de document igual que en el navegador.
    erroresPorImagen = 0,
    // Revela las portadas nativas del fixture como hace el sitio: cada
    // fragmento de listado cierra con un <script> que llama a su asyncImgLoader,
    // y jsdom (runScripts: 'outside-only') no lo ejecuta. Se hace a mano y NO a
    // traves de w.asyncImgLoader, para no ensuciar asyncImgCalls, que es lo que
    // mide otro test.
    revelarPortadas = false,
    // Vuelve a revelar las portadas DESPUES de cada vuelta de 'error', como hace
    // el sitio: su asyncImgLoader rellena `src` desde `data-img-src` en cada
    // fragmento que llega, sin mirar si ya habia uno. Es lo que reproduce la
    // carrera que dejaba tarjetas sin imagen.
    revelarEnCadaVuelta = false,
    // Tras las vueltas de 'error', dispara un 'load' en cada portada: es lo que
    // pasa cuando la URL buena acaba llegando, y prueba la red de seguridad
    // (una portada que carga desmarca su figura).
    cargaPortadasAlFinal = false,
    // Cola sembrada tal como la habria dejado saveQueue().
    queue = null,
    // Pulsa "▶ Ejecutar" y confirma el modal.
    ejecutarCola = false,
    // Respuestas de /giveaways/join, en orden. Por defecto, 'ok'.
    joinResponses = null,
    // Saldo que publica la cabecera.
    saldo = 10,
    // Trigger de ficha de detalle inyectado en el DOM (ver cardJoinHtml).
    cardJoin = null,
    // Que contesta la FICHA de cada giveaway cuando se le pregunta por los
    // boletos ya comprados. Por gid:
    //   'con'   -> «GIVEAWAY <gid> - 4 tickets purchased» (tienes 4)
    //   'sin'   -> «GIVEAWAY <gid> - created Mon 31 Aug 2026» (no tienes ninguno)
    //   'parent'-> la misma con parentesis, «(4) tickets purchased», por si el
    //              sitio los pusiera algun dia
    //   'roto'  -> la ficha llega sin .card-join-info (el sitio cambio el marcado)
    //   500     -> la peticion falla
    //
    // Las cadenas son las REALES, las dos leidas del sitio (la de «sin» sin
    // sesion, la de «con» con ella, el 2026-08-31). Y eso no es un detalle: la
    // primera version de este arnes ponia «(4) TICKETS PURCHASED», copiado de una
    // captura donde la cifra sale en un circulo oscuro. Los parentesis eran CSS.
    // El test pasaba en verde contra esa ficcion mientras en el navegador la fila
    // no aparecia nunca — que es exactamente lo que un fixture inventado hace.
    fichas = {},
    // gid de la tarjeta cuyo badge ⚠×N se pulsa para abrir el modal de encolar.
    abrirModal = null
} = {}) {
    const conCola = !!(queue || ejecutarCola);
    const mkCell = (spec) => cell(imgSuffix ? Object.assign({ imgSuffix: true }, spec) : spec);
    const total = Object.values(pages).reduce((n, p) => n + p.length, 0);
    const cells = (pages[current] || []).map(mkCell);
    const vc = new VirtualConsole();
    const logs = [];
    vc.on('jsdomError', e => logs.push('jsdomError: ' + e.message + (e.stack ? ' | ' + String(e.stack).split('\n').slice(0, 3).join(' / ') : '')));
    vc.on('error', (...a) => logs.push('error: ' + a.map(String).join(' ')));
    vc.on('warn', (...a) => logs.push('warn: ' + a.map(String).join(' ')));

    const dom = new JSDOM(
        html({ current, last, level, total, cells, wheel, search, busy, saldo, cardJoin,
               carousel: carousel.map(mkCell) }),
        {
            url: 'https://www.indiegala.com/giveaways',
            runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
        });
    const w = dom.window;

    // Almacenamiento del gestor de userscripts. Se siembra con los ajustes
    // igual que los escribiría saveSettings(): JSON en una sola clave.
    const store = new Map();
    store.set('ig-bulk-settings', JSON.stringify({
        hideEntered: false, showIgnored: false, balanceMin: false, queueMin: false,
        rememberFilters, loadAllPages,
        filters: { sort: 'expiry', order: 'asc', level: String(level), search: '', page: savedPage }
    }));
    // Misma clave y mismo formato que saveQueue(): JSON en 'ig-st-queue'.
    if (queue) store.set('ig-st-queue', JSON.stringify(queue));
    w.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    w.GM_setValue = (k, v) => store.set(k, v);
    w.unsafeWindow = w;

    // Globales que el sitio deja en la página. `asyncImgLoader` NO se define a
    // propósito en el caso normal: así se prueba el respaldo del script, que es
    // el que tiene que funcionar si el sitio le cambia el nombre.
    w.pageParam = current;
    w.sortParam = 'expiry';
    w.sortOrderParam = 'asc';
    w.levelParam = String(level);
    // Llamadas al cargador del sitio: es como se observa si el script intentó
    // reaplicar la página guardada (applyPage lo usa) o no.
    const loadListCalls = [];
    w.loadGiveawaysListContents = (url) => { loadListCalls.push(String(url)); };
    // Joins que salieron, con TODO lo que viajo: es lo unico que distingue "se
    // refresco el token del trigger vivo" de "viajo el de la otra pagina".
    const joins = [];
    const ajaxCompleteCbs = [];
    const respuestas = (joinResponses || []).slice();
    if (conCola) {
        // jQuery del sitio, lo justo para que setupAjaxBalanceHook enganche su
        // ajaxComplete: es por ahi por donde el loop de la cola se entera del
        // resultado de cada join. Sin esto cada iteracion agota su timeout.
        w.jQuery = () => ({ ajaxComplete: (cb) => { ajaxCompleteCbs.push(cb); } });
    }
    const responder = (payload) => setTimeout(() => {
        const xhr = { responseJSON: payload };
        ajaxCompleteCbs.forEach(cb => { try { cb({}, xhr, { url: '/giveaways/join' }); } catch (_) { } });
    }, 5);
    const grabadora = (fnName) => function (el, ev, gid, arg2, token) {
        joins.push({
            fnName, gid: String(gid), arg2, token,
            // ¿El elemento con el que se invoco esta en la pagina? Un ancla
            // falsa (makeFakeAnchor) dice que no se encontro el trigger vivo.
            anclaViva: !!(el && w.document.contains(el))
        });
        responder(respuestas.length ? respuestas.shift() : { status: 'ok', silver_tot: 100 });
    };
    w.joinGiveawayOrAuction = grabadora('joinGiveawayOrAuction');
    // `joinGiveawayCard` NO se define: en /giveaways el sitio tampoco la define,
    // y ese es justo el contexto en el que se ejecuta una cola llena de items
    // encolados desde fichas.
    // El alert() del vigilante de la ruleta se fue en 1.11.0. Se captura en vez
    // de dejarlo estallar (jsdom no lo implementa) para poder AFIRMAR que no se
    // llama: un aviso bloqueante se ve aqui igual de bien que en el navegador.
    const alertas = [];
    // El título EN EL INSTANTE de cada alert(). Un alert() congela el hilo, así
    // que lo que no estuviera pintado antes no se ve hasta cerrarlo: sin esta
    // foto no hay forma de distinguir «la marca se puso antes» de «se puso
    // después», y las dos dejan el mismo título al final.
    const tituloAlAlertar = [];
    w.alert = (msg) => { alertas.push(String(msg)); tituloAlAlertar.push(w.document.title); };
    // GM_notification se captura para poder afirmar que NO se llama, igual que
    // con alert(). Se probó en 1.10.5 —es el único canal que se salta el
    // autoplay, porque lo lanza el gestor y no la página— y se descartó: no se
    // quiere un aviso del sistema, y su `highlight` además cambia de pestaña.
    // Sin esta captura, volver a añadirla no rompería ninguna prueba.
    const notificaciones = [];
    w.GM_notification = (o) => { notificaciones.push(o); };
    // El revelador de imagenes del sitio, solo cuando el test lo pide: asi el
    // caso normal ejerce el RESPALDO del script (que es el que tiene que
    // funcionar si el sitio le cambia el nombre) y este caso comprueba que,
    // cuando existe, se usa el del sitio y no el nuestro.
    const asyncImgCalls = [];
    if (withAsyncImgLoader) {
        w.asyncImgLoader = (itemClass, parentCont) => {
            asyncImgCalls.push({ itemClass, parentCont });
            w.document.querySelectorAll((parentCont ? parentCont + ' ' : '') + itemClass).forEach(img => {
                const src = img.getAttribute('data-img-src');
                if (src) { img.setAttribute('src', src); img.classList.remove('display-none'); }
            });
        };
    }

    // Las peticiones que salen, en orden. Es la mitad de lo que se comprueba:
    // no basta con que el listado acabe bien, tiene que costar lo que dice.
    const fetched = [];
    w.fetch = async (url, opts) => {
        fetched.push({ url: String(url), headers: (opts && opts.headers) || {}, cred: opts && opts.credentials });
        // Ficha de un giveaway: la pide fetchPurchasedTickets para leer los
        // boletos que ya tienes comprados.
        const card = String(url).match(/\/giveaways\/card\/[^/]+\/(\d+)/);
        if (card) {
            const modo = fichas[card[1]] || 'sin';
            if (modo === 500) return { ok: false, status: 500, text: async () => '' };
            const info = modo === 'con'
                ? `GIVEAWAY <strong>${card[1]}</strong> - <span>4</span> tickets purchased`
                : modo === 'parent'
                    ? `GIVEAWAY <strong>${card[1]}</strong> - (4) tickets purchased`
                    : `GIVEAWAY <strong>${card[1]}</strong> - created Mon 31 Aug 2026`;
            const body = modo === 'roto'
                ? '<div class="card-ticket"><div class="card-join">JOIN</div></div>'
                : `<div class="card-ticket"><div class="card-join">JOIN</div><div class="card-join-info">${info}</div></div>`;
            return { ok: true, status: 200, text: async () => `<!doctype html><html><body>${body}</body></html>` };
        }
        const m = String(url).match(/\/giveaways\/ajax\/(\d+)\//);
        const n = m ? parseInt(m[1], 10) : null;
        const bad = serve[n];
        if (typeof bad === 'number') {
            return { ok: false, status: bad, json: async () => ({}) };
        }
        const body = {
            status: 'ok',
            html: `<div class="page-contents-list"><div class="row items-list-row">${(pages[n] || []).map(cell).join('')}</div></div>`
                + pagination({ current: n, last, level, total }),
            current_page: (bad && bad.current_page != null) ? bad.current_page : n,
            current_sort: 'expiry', current_sort_order: 'asc', current_level: level
        };
        if (bad && bad.status) body.status = bad.status;
        return { ok: true, status: 200, json: async () => body };
    };

    const code = fs.readFileSync(SCRIPT_PATH, 'utf8');
    w.eval(code);

    // Simula que el sitio reescribe el <title> por su cuenta (lo hace en sus
    // navegaciones AJAX). Es la unica forma de ejercer el vigilante del titulo:
    // sin alguien que lo pise, no se distingue de no tenerlo.
    if (retitulo) setTimeout(() => { w.document.title = retitulo.texto; }, retitulo.ms);

    await new Promise(r => setTimeout(r, waitMs));

    // El `src` se copia de `data-img-src` SIN mirar si ya habia uno: asi lo hace
    // el asyncImgLoader del sitio, y de ahi que arreglar solo `src` no baste.
    const revelar = async () => {
        w.document.querySelectorAll('.items-list-item figure img[data-img-src]').forEach(img => {
            img.setAttribute('src', img.getAttribute('data-img-src'));
            img.classList.remove('display-none');
            img.style.display = 'inline';
        });
        await new Promise(r => setTimeout(r, 400));
    };
    if (revelarPortadas) await revelar();

    // Un 404 de portada, tantas veces como pida el test: la primera vuelta
    // ejerce el reintento sin sufijo, la segunda el respaldo de dejar el hueco
    // clicable.
    for (let vuelta = 0; vuelta < erroresPorImagen; vuelta++) {
        w.document.querySelectorAll('.items-list-item figure img[src]').forEach(img => {
            img.dispatchEvent(new w.Event('error'));
        });
        await new Promise(r => setTimeout(r, 400));   // > debounce del observador
        if (revelarEnCadaVuelta) await revelar();
    }
    if (cargaPortadasAlFinal) {
        w.document.querySelectorAll('.items-list-item figure img[src]').forEach(img => {
            img.dispatchEvent(new w.Event('load'));
        });
        await new Promise(r => setTimeout(r, 400));
    }

    // Abre el modal de encolar pulsando el badge ⚠×N de una tarjeta, que es
    // como lo abre el usuario, y espera a que llegue la respuesta de la ficha.
    let modal = null;
    if (abrirModal != null) {
        const badge = Array.from(w.document.querySelectorAll('.items-list-col')).map(col => {
            const a = col.querySelector('.items-list-item-title a');
            const mm = a && (a.getAttribute('href') || '').match(/(\d+)\/?$/);
            return (mm && mm[1] === String(abrirModal)) ? col.querySelector('.ig-bulk-join-badge') : null;
        }).find(Boolean);
        if (!badge) {
            modal = { error: 'no hay badge ⚠×N para el gid ' + abrirModal };
        } else {
            badge.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 600));
            const row = w.document.querySelector('#ig-bulk-owned-row');
            const val = w.document.querySelector('#ig-bulk-owned');
            modal = {
                abierto: !!w.document.querySelector('#ig-bulk-modal'),
                // La fila de "ya comprados": si se ve y con que numero. Oculta
                // es una respuesta valida —"no lo se"—, no un fallo.
                comprados: (row && row.style.display !== 'none') ? (val ? val.textContent : null) : null,
                compradosVisible: !!(row && row.style.display !== 'none'),
                // A que ficha se pregunto. Tiene que ser la del href del titulo,
                // con su slug: construirla a mano no acertaria.
                peticionFicha: fetched.map(f => f.url).filter(u => /\/giveaways\/card\//.test(u)),
                // Y con la sesion, como cualquier peticion del sitio.
                credenciales: (fetched.find(f => /\/giveaways\/card\//.test(f.url)) || {}).cred || null
            };
        }
    }

    // "▶ Ejecutar" y su modal de confirmacion. Se pulsa lo que pulsaria el
    // usuario, no executeQueue(), que ni esta expuesta.
    let ejecucion = null;
    if (ejecutarCola) {
        const exec = w.document.querySelector('#ig-q-exec');
        if (!exec) {
            ejecucion = { error: 'no hay boton #ig-q-exec (¿panel sin pintar?)' };
        } else {
            exec.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
            const ok = w.document.querySelector('#ig-bulk-modal .ig-confirm');
            if (!ok) {
                ejecucion = { error: 'no salio el modal de confirmacion' };
            } else {
                ok.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
                await new Promise(r => setTimeout(r, 4000));
                const st = w.document.querySelector('#ig-prog-status');
                ejecucion = { estado: st ? (st.textContent || '').trim() : null };
            }
        }
    }

    // Tooltip propio: se apunta a un control, se comprueba que la caja sale y que
    // el `title` se guardó, y DESPUÉS se fuerza un repintado del widget para ver
    // si alguien se lo devuelve. Ese es el fallo: con el title de vuelta salen
    // los dos avisos a la vez, el nuestro y el del navegador.
    let tooltip = null;
    if (hover) {
        const target = w.document.querySelector(hover);
        if (target) {
            target.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true }));
            await new Promise(r => setTimeout(r, 600));      // > TIP_DELAY_MS (250)
            const cajaAntes = !!w.document.querySelector('#ig-tip.ig-tip-visible');
            const titleAntes = target.getAttribute('title');
            // Cualquier mutación despierta al observador, que vuelve a pasar por
            // renderBalanceWidget. Es la forma de reproducir el repintado sin
            // esperar a que el sitio mueva algo por su cuenta.
            w.document.body.appendChild(w.document.createElement('span'));
            await new Promise(r => setTimeout(r, 900));      // > debounce de 250 ms
            tooltip = {
                cajaVisible: cajaAntes && !!w.document.querySelector('#ig-tip.ig-tip-visible'),
                titleAntes,
                titleDespues: target.getAttribute('title'),
                textoCaja: ((w.document.querySelector('#ig-tip') || {}).textContent || '').slice(0, 60),
            };
        } else {
            tooltip = { error: 'no existe ' + hover };
        }
    }

    const scope = w.document.querySelector('#ajax-contents-container .page-contents-list');
    const row = scope ? scope.querySelector('.items-list-row') : null;
    const gids = row ? Array.from(row.children).map(c => {
        const a = c.querySelector('.items-list-item-title a');
        const mm = a && (a.getAttribute('href') || '').match(/(\d+)\/?$/);
        return mm ? mm[1] : '?';
    }) : [];
    const statusEl = w.document.querySelector('#ig-bw-load-all-status');
    const out = {
        peticiones: fetched.map(f => f.url.replace('https://www.indiegala.com', '')),
        cabeceras: fetched.length ? fetched[0].headers : null,
        credenciales: fetched.length ? fetched[0].cred : null,
        gids,
        duplicados: gids.filter((g, i) => gids.indexOf(g) !== i),
        // Los ＋ y los badges ⚠×N SOLO del listado: si se contaran del
        // documento entero entrarían los cuatro carruseles.
        masBotones: scope ? scope.querySelectorAll('.ig-q-btn').length : 0,
        badges: scope ? scope.querySelectorAll('.ig-bulk-join-badge').length : 0,
        cruces: scope ? scope.querySelectorAll('.ig-ign-btn').length : 0,
        // Imágenes reveladas. La cuenta que decide es la de las TRAIDAS: las
        // nativas del fixture no tienen src porque en jsdom no corre el
        // <script> con el que el sitio las revela, y contarlas mediria el
        // arnes en vez del script.
        imagenesSinSrc: scope ? Array.from(scope.querySelectorAll('.items-list-item figure img')).filter(i => !i.getAttribute('src')).length : 0,
        imagenesSinSrcTraidas: scope ? Array.from(scope.querySelectorAll(`.items-list-col[data-ig-page]:not([data-ig-page="${current}"]) .items-list-item figure img`)).filter(i => !i.getAttribute('src')).length : 0,
        traidas: scope ? scope.querySelectorAll(`.items-list-col[data-ig-page]:not([data-ig-page="${current}"])`).length : 0,
        asyncImgCalls,
        // Estado de cada portada del listado: la URL con la que acabo, si la
        // <figure> quedo marcada como "sin imagen" y a donde apunta su enlace.
        // El href es la mitad que importa: de nada sirve recuperar el clic si el
        // ancla no lleva al detalle del giveaway.
        portadas: scope ? Array.from(scope.querySelectorAll('.items-list-item figure')).map(f => {
            const img = f.querySelector('img');
            const a = f.querySelector('a');
            return {
                src: img ? (img.getAttribute('src') || null) : null,
                // La fuente de la que el sitio rellena `src` en cada pasada. Si
                // esta se queda con el sufijo muerto, el arreglo no aguanta.
                dataSrc: img ? (img.getAttribute('data-img-src') || null) : null,
                sinImagen: f.classList.contains('ig-figure-noimg'),
                href: a ? a.getAttribute('href') : null
            };
        }) : [],
        // La regla que devuelve el clic: se comprueba que este declarada y con
        // que valor. jsdom no hace layout, asi que el alto real NO se puede
        // medir aqui; lo que se afirma es que la hoja del script la lleva.
        reglaSinImagen: (() => {
            const st = w.document.getElementById('ig-bulk-styles');
            const css = st ? st.textContent : '';
            const m = css.match(/\.items-list-item figure\.ig-figure-noimg > a \{([^}]*)\}/);
            return m ? m[1].trim() : null;
        })(),
        // Regla que esconde el <img> roto. Se comprueba aparte porque tiene que
        // llevar !important: el sitio escribe style.display en linea.
        reglaImagenRota: (() => {
            const st = w.document.getElementById('ig-bulk-styles');
            const css = st ? st.textContent : '';
            const m = css.match(/\.items-list-item figure\.ig-figure-noimg img \{([^}]*)\}/);
            return m ? m[1].trim() : null;
        })(),
        joins,
        modal,
        ejecucion,
        colaRestante: (() => {
            const raw = store.get('ig-st-queue');
            try { return raw ? JSON.parse(raw) : []; } catch (_) { return null; }
        })(),
        cargadorDelSitio: loadListCalls,
        // Paginacion: cuantas celdas-herramienta (numeros y flechas) siguen a
        // la vista, y si la celda del total —que es una afirmacion, no una
        // herramienta— sigue ahi. La cuenta se hace con la clase, que es lo que
        // el script toca; el CSS del fixture la traduce a display:none.
        paginacionHerramientas: (() => {
            const cs = w.document.querySelectorAll('#ajax-contents-container .pagination .page-link-cont');
            let vistas = 0;
            cs.forEach(c => {
                if (!c.querySelector('a, .current')) return;
                if (!c.classList.contains('ig-pag-folded')) vistas++;
            });
            return vistas;
        })(),
        paginacionTotalVisible: (() => {
            const cs = Array.from(w.document.querySelectorAll('#ajax-contents-container .pagination .page-link-cont'));
            const tot = cs.find(c => !c.querySelector('a, .current'));
            return !!(tot && !tot.classList.contains('ig-pag-folded') && /\d+\s*items/.test(tot.textContent || ''));
        })(),
        // Cuenta atras de la ruleta: su texto y si esta en el estado de aviso.
        // Se lee del widget, que es donde la ve el usuario.
        lineaRuleta: (() => {
            const e = w.document.querySelector('#ig-bw-wheel');
            return e ? (e.textContent || '').trim() : null;
        })(),
        lineaRuletaAvisando: (() => {
            const e = w.document.querySelector('#ig-bw-wheel');
            return !!(e && e.classList.contains('ig-bw-wheel-now'));
        })(),
        // Aviso de ruleta: la marca en el titulo (lo unico que se ve desde otra
        // pestaña), los toasts que quedan en pie y las llamadas a alert().
        titulo: w.document.title,
        toasts: Array.from(w.document.querySelectorAll('.ig-toast')).map(t => (t.textContent || '').trim()),
        // Un toast con `title` es de los que no se van solos (ahi se le pone el
        // "clic para cerrar"). Es como se distingue del toast normal, que a los
        // 4,5 s ya no esta.
        toastsPegajosos: Array.from(w.document.querySelectorAll('.ig-toast')).filter(t => t.title).length,
        alertas,
        notificaciones: notificaciones.map(n => ({
            title: n && n.title, text: n && n.text, silent: n && n.silent
        })),
        tooltip,
        tituloAlAlertar: tituloAlAlertar[0] || null,
        estado: statusEl ? (statusEl.textContent || '').trim() : null,
        estadoVisible: statusEl ? statusEl.style.display !== 'none' : false,
        casilla: (() => { const c = w.document.querySelector('#ig-bw-load-all'); return c ? !!c.checked : null; })(),
        logs: logs.slice(0, 4),
        // Solo para depurar el arnes: el HTML de la primera tarjeta tal como
        // quedo, que es donde se ve si el script le puso sus botones.
        primeraTarjeta: (() => {
            const it = scope && scope.querySelector('.items-list-item');
            return it ? it.outerHTML.slice(0, 900) : null;
        })()
    };
    try { w.close(); } catch (_) { }
    return out;
}

// Genera N tarjetas de una página, con gids correlativos por página para que el
// orden final se lea de un vistazo: 1001..1003 la página 1, 2001.. la 2, etc.
function pageCells(pageNo, count, opts = {}) {
    const out = [];
    for (let i = 1; i <= count; i++) {
        out.push(Object.assign({
            gid: String(pageNo * 1000 + i),
            title: `Juego P${pageNo}-${i}`,
            lev: i === 1 ? 0 : 3
        }, opts));
    }
    return out;
}

module.exports = { run, cell, pageCells };
