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
    || '/Users/usuario/code/scripts/indiegala-bulk-join/indiegala-bulk-join.user.js';

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
function cell(spec) {
    const { gid, title, lev = 0, type = 'single', price = 12, sold = 100, time = '3 days left' } = spec;
    const extra = type === 'extra';
    const label = extra ? 'extra odds' : 'single ticket';
    const typeClass = extra ? 'items-list-item-type-guaranteed' : 'items-list-item-type-not-guaranteed';
    const levSpan = lev > 0
        ? ` - <span title="Users with level ${lev} or higher can join this giveaway ">Lev. ${lev}</span>`
        : '';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const control = (lev > 0 || extra) ? `<div class="items-list-item-data-cont items-list-item-ticket"><div class="relative"><div class="items-list-item-tooth"></div><a class="items-list-item-ticket-click" href="#" onclick="joinGiveawayOrAuction( this, event, '${gid}', ${extra ? 1 : 0}, 'TOKEN${gid}')"></a><div class="items-list-item-data overflow-auto"><div class="left items-list-item-data-left"><div class="items-list-item-data-top items-list-item-data-left-top">time</div><div class="items-list-item-data-bottom items-list-item-data-left-bottom">${time}</div></div><div class="right items-list-item-data-right"><div class="items-list-item-data-top items-list-item-data-right-top">sold</div><div class="items-list-item-data-bottom items-list-item-data-right-bottom">${sold}</div></div><div class="right items-list-item-data-button bg-gradient-red"><a data-price="${price}" href="#">${price} iS</a></div></div></div></div>` : '';
    return `<div class="col-3 items-list-col"><div class="items-list-item"><div class="relative"><div class="items-list-item-error display-none"><div class="items-list-item-error-inner display-none"><div class="items-list-item-error-text"><span></span><span></span></div></div></div><h5 class="items-list-item-title"><a href="/giveaways/card/${slug}/${gid}">${title}</a></h5><figure><a href="/giveaways/card/${slug}/${gid}" title="${title}"><img alt="${title} product image" class="display-none" data-img-src="https://steamcdn-a.akamaihd.net/steam/apps/${gid}/header.jpg"/></a></figure><figcaption><div class="items-list-item-type relative ${typeClass}">${label}${levSpan}</div><div class="items-list-item-data-placeholder"></div></figcaption>${control}</div></div></div>`;
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

function html({ current, last, level, total, cells, wheel, search, busy, carousel }) {
    // El carrusel, CUATRO veces, con giveaways que también están en el listado.
    const slider = [1, 2, 3, 4].map(i =>
        `<section class="page-slider-cont"><div class="carousel slide" id="page-slider-${i}"><div class="carousel-inner"><div class="carousel-item active"><div class="row items-list-row">${carousel.join('')}</div></div></div></div></section>`
    ).join('');
    const overlay = busy ? '<div id="ig-bulk-progress-overlay"><div>Ejecutando cola</div></div>' : '';
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
      <a href="/account"><span>GalaSilver</span><span id="galasilver-amount">10</span> iS<span id="galacredits-amount">$ 2.80</span></a>
    </header>
    ${overlay}
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
    withAsyncImgLoader = false, waitMs = 5000
} = {}) {
    const total = Object.values(pages).reduce((n, p) => n + p.length, 0);
    const cells = (pages[current] || []).map(cell);
    const vc = new VirtualConsole();
    const logs = [];
    vc.on('jsdomError', e => logs.push('jsdomError: ' + e.message + (e.stack ? ' | ' + String(e.stack).split('\n').slice(0, 3).join(' / ') : '')));
    vc.on('error', (...a) => logs.push('error: ' + a.map(String).join(' ')));
    vc.on('warn', (...a) => logs.push('warn: ' + a.map(String).join(' ')));

    const dom = new JSDOM(
        html({ current, last, level, total, cells, wheel, search, busy, carousel: carousel.map(cell) }),
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
    w.joinGiveawayOrAuction = () => { };
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
                if (src) img.setAttribute('src', src);
            });
        };
    }

    // Las peticiones que salen, en orden. Es la mitad de lo que se comprueba:
    // no basta con que el listado acabe bien, tiene que costar lo que dice.
    const fetched = [];
    w.fetch = async (url, opts) => {
        fetched.push({ url: String(url), headers: (opts && opts.headers) || {}, cred: opts && opts.credentials });
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

    await new Promise(r => setTimeout(r, waitMs));

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
