// "Ocultar este juego" (🚫): de un giveaway ocultado con ✕ a todos los de su juego.
//
// El juego se reconoce por el appid de la portada de Steam, con el titulo de
// respaldo para las tarjetas que no la traen. La regla vive en una lista aparte
// de la de gids y no caduca, asi que lo que hay que vigilar es justo lo que la
// distingue del ✕:
//
//   · que alcance a giveaways que NO se pulsaron —los del mismo juego en la
//     pagina, y los que llegan despues con "Cargar todas las paginas"—, y a
//     ninguno de otro juego; con el appid, o el subid de los paquetes;
//   · que el ↺ de una tarjeta oculta por su juego deshaga la REGLA y no solo el
//     gid (si no, pulsarlo no devolveria nada y el boton mentiria);
//   · que deshacer el juego no se lleve por delante lo que se oculto uno a uno;
//   · que el 🚫 solo salga donde tiene sentido: en un giveaway ya ocultado con
//     ✕, en la esquina del ＋ / ⚠×N, y no en las tarjetas normales.
//
// Y un caso que no es de la funcion sino de la pasada que la pinta: con la
// pagina en reposo, sus botones no pueden mutar. applyIgnored corre en cada
// pasada del MutationObserver; si reescribe un texto aunque sea igual, esa
// escritura despierta a la siguiente pasada y el bucle no para. Se miran solo
// sus nodos: el resto del script tiene el mismo bucle desde antes (ver el caso).
//
// Lo que este arnes NO puede medir: que la celda se vea o no, ni que el ＋ se
// aparte. jsdom no hace layout. Se afirma la clase que el script pone y que la
// regla esta en su hoja; que eso equivale a display:none lo dice la hoja.
const { run } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}

// Tres giveaways del mismo juego (appid 555), dos tipos distintos; uno de otro
// juego; y tres sin portada de Steam, dos de ellos con el mismo titulo.
const cartas = [
    { gid: '201', title: 'Dino running from a FURRY', type: 'single', lev: 3, appid: '555' },
    { gid: '202', title: 'Dino running from a FURRY', type: 'extra', appid: '555' },
    { gid: '203', title: 'Dino running from a FURRY', type: 'single', lev: 3, appid: '555' },
    { gid: '204', title: 'Otro juego', type: 'single', lev: 3, appid: '777' },
    { gid: '205', title: 'Juego sin Steam', type: 'single', lev: 3, appid: null },
    { gid: '206', title: 'Juego  sin STEAM', type: 'single', lev: 3, appid: null },
    { gid: '207', title: 'Otro sin Steam', type: 'single', lev: 3, appid: null }
];
const base = { current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, saldo: 500 };
const oculto = () => ({ t: Date.now() });

(async () => {
    // ---- Caso 1: dos giveaways ocultados con ✕, vistos con "Mostrar ocultos" ----
    const r1 = await run(Object.assign({}, base, {
        ignoredGids: { '201': oculto(), '202': oculto() }, showIgnored: true
    }));
    const t1 = r1.tarjetas;
    ok(t1['201'].estado === 'atenuado' && t1['202'].estado === 'atenuado',
        'los ocultados con ✕ salen atenuados', [t1['201'], t1['202']]);
    ok(t1['201'].botonJuego && t1['202'].botonJuego, 'un giveaway ocultado con ✕ ofrece el 🚫', [t1['201'], t1['202']]);
    // La esquina es la del control propio, contraria a la del ✕/↺.
    ok(t1['201'].botonJuegoLado === 'izq' && t1['201'].cruzLado === 'der',
        'Single Ticket: el 🚫 en la esquina del ＋ (izquierda)', t1['201']);
    ok(t1['202'].botonJuegoLado === 'der' && t1['202'].cruzLado === 'izq',
        'Extra Odds: el 🚫 en la esquina del ⚠×N (derecha)', t1['202']);
    const sinBoton = ['203', '204', '205', '206', '207'].filter(g => t1[g].botonJuego);
    ok(sinBoton.length === 0, 'una tarjeta no oculta NO lleva 🚫', sinBoton);
    ok(['203', '204', '205', '206', '207'].every(g => t1[g].estado === 'visible'),
        'el ✕ de un giveaway no oculta a los demas de su juego', t1);
    ok(r1.reglaControlesEnOculto, 'la hoja aparta el ＋ y el ⚠×N de un giveaway atenuado');
    // El ＋ sigue en el DOM (lo aparta la hoja), y el resto de tarjetas lo tiene.
    ok(r1.masBotones >= 5, 'los ＋ de las tarjetas normales siguen ahi', { masBotones: r1.masBotones });
    // Solo los nodos de esta funcion: el bucle general (el ＋, el ⚠×N, el widget
    // de saldo, la ruleta) ya estaba en 1.11.1 y no es de aqui.
    const propias = Object.keys(r1.mutacionesPorNodo)
        .filter(k => /ig-ign-btn|ig-ign-game-btn|#ig-bw-clear-ignored/.test(k));
    ok(propias.length === 0,
        'con la pagina en reposo el ✕/↺, el 🚫 y los botones de limpiar no mutan',
        propias.map(k => k + ' ×' + r1.mutacionesPorNodo[k]));

    // ---- Caso 2: pulsar el 🚫 de 201 ----
    const r2 = await run(Object.assign({}, base, {
        ignoredGids: { '201': oculto() }, showIgnored: true,
        pulsar: [{ gid: '201', sel: '.ig-ign-game-btn' }]
    }));
    const t2 = r2.tarjetas;
    ok(r2.clics[0] && r2.clics[0].encontrado, 'el 🚫 de 201 existe y se pulsa', r2.clics);
    ok(r2.almacen.juegosOcultos && r2.almacen.juegosOcultos['app:555'],
        'se guarda el juego por su appid', r2.almacen.juegosOcultos);
    ok((r2.almacen.juegosOcultos['app:555'] || {}).n === 'Dino running from a FURRY',
        'con el titulo con el que se vio', r2.almacen.juegosOcultos);
    ok(Object.keys(r2.almacen.juegosOcultos).length === 1, 'y solo ese juego', r2.almacen.juegosOcultos);
    ok(t2['202'].estado === 'atenuado' && t2['203'].estado === 'atenuado',
        'los otros giveaways del juego quedan ocultos sin haberlos pulsado', [t2['202'], t2['203']]);
    ok(['204', '205', '206', '207'].every(g => t2[g].estado === 'visible'),
        'los de otro juego no se tocan', t2);
    ok(!t2['201'].botonJuego, 'con el juego ya oculto el 🚫 se retira', t2['201']);
    // El ↺ de una oculta por su juego dice otra cosa que el de una oculta por ✕.
    ok(t2['203'].cruz === '↺' && t2['203'].cruzTitle !== t1['201'].cruzTitle
        && t2['203'].cruzTitle !== t2['204'].cruzTitle,
        'el ↺ de una oculta por su juego lleva su propio aviso', [t2['203'].cruzTitle, t1['201'].cruzTitle]);
    ok(r2.almacen.gidsOcultos && r2.almacen.gidsOcultos['201'],
        'el gid ocultado con ✕ se conserva: ocultar el juego no lo absorbe', r2.almacen.gidsOcultos);
    ok(r2.widgetOcultos.limpiarJuegos && /\(1\)/.test(r2.widgetOcultos.limpiarJuegos),
        'el widget ofrece "limpiar juegos ocultos (1)"', r2.widgetOcultos);
    ok(r2.toasts.some(t => /Dino running from a FURRY/.test(t)), 'el toast nombra el juego', r2.toasts);

    // ---- Caso 3: el futuro. Juego ya oculto, casilla apagada, pagina 2 por traer ----
    const r3 = await run({
        current: 1, last: 2, saldo: 500, loadAllPages: true,
        pages: {
            1: [cartas[0], cartas[3]],
            2: [{ gid: '2001', title: 'Dino running from a FURRY', type: 'single', lev: 3, appid: '555' },
                { gid: '2002', title: 'Otro juego mas', type: 'single', lev: 3, appid: '888' }]
        },
        ignoredGames: { 'app:555': { t: Date.now(), n: 'Dino running from a FURRY' } }
    });
    const t3 = r3.tarjetas;
    ok(r3.traidas === 2, 'se trajo la pagina 2', { traidas: r3.traidas, peticiones: r3.peticiones });
    ok(t3['201'] && t3['201'].estado === 'oculto', 'un giveaway del juego en la pagina se oculta', t3['201']);
    ok(t3['2001'] && t3['2001'].estado === 'oculto',
        'y uno que llega despues con "Cargar todas las paginas" tambien', t3['2001']);
    ok(t3['204'].estado === 'visible' && t3['2002'] && t3['2002'].estado === 'visible',
        'los de otros juegos, traidos o no, siguen a la vista', [t3['204'], t3['2002']]);
    ok(r3.widgetOcultos.casillaMostrar,
        'con solo juegos ocultos (ningun gid) la casilla "Mostrar ocultos" aparece', r3.widgetOcultos);
    ok(r3.widgetOcultos.limpiar === null, 'y "limpiar ocultos" no, que no hay gids', r3.widgetOcultos);

    // ---- Caso 4: la portada con el sufijo `_ig` de produccion da la misma clave ----
    const r4 = await run(Object.assign({}, base, {
        imgSuffix: true,
        ignoredGames: { 'app:555': { t: Date.now(), n: 'x' } }
    }));
    ok(['201', '202', '203'].every(g => r4.tarjetas[g].estado === 'oculto'),
        'con .../apps/555_ig/header.jpg el juego se reconoce igual', r4.tarjetas);
    ok(r4.tarjetas['204'].estado === 'visible', 'y el 777_ig no', r4.tarjetas['204']);

    // ---- Caso 5: sin portada de Steam, por titulo normalizado ----
    const r5 = await run(Object.assign({}, base, {
        ignoredGids: { '205': oculto() }, showIgnored: true,
        pulsar: [{ gid: '205', sel: '.ig-ign-game-btn' }]
    }));
    ok(r5.almacen.juegosOcultos && r5.almacen.juegosOcultos['title:juego sin steam'],
        'sin appid la clave es el titulo normalizado', r5.almacen.juegosOcultos);
    ok(r5.tarjetas['206'].estado === 'atenuado',
        'el mismo titulo con otras mayusculas y espacios es el mismo juego', r5.tarjetas['206']);
    ok(r5.tarjetas['207'].estado === 'visible', 'otro titulo sin Steam no se toca', r5.tarjetas['207']);
    ok(['201', '202', '203', '204'].every(g => r5.tarjetas[g].estado === 'visible'),
        'ni los que si tienen appid', r5.tarjetas);

    // ---- Caso 5b: un paquete de Steam (subs/<id>), como Shadow of Mordor GOTY ----
    // Del listado real del 2026-10-01. Tiene que reconocerse por su subid y no
    // caer al titulo; y un appid con el mismo numero es otro producto.
    const r5b = await run({
        current: 1, last: 1, loadAllPages: false, saldo: 500,
        pages: { 1: [
            { gid: '301', title: 'Middle-earth: Shadow of Mordor GOTY', type: 'single', lev: 3, imgPath: 'subs/51209' },
            { gid: '302', title: 'Mordor GOTY (otro nombre)', type: 'single', lev: 3, imgPath: 'subs/51209' },
            { gid: '303', title: 'Un juego con appid 51209', type: 'single', lev: 3, appid: '51209' }
        ] },
        ignoredGids: { '301': oculto() }, showIgnored: true,
        pulsar: [{ gid: '301', sel: '.ig-ign-game-btn' }]
    });
    ok(r5b.almacen.juegosOcultos && r5b.almacen.juegosOcultos['sub:51209'],
        'un paquete se guarda por su subid', r5b.almacen.juegosOcultos);
    ok(r5b.tarjetas['302'].estado === 'atenuado', 'el mismo paquete con otro titulo se oculta', r5b.tarjetas['302']);
    ok(r5b.tarjetas['303'].estado === 'visible', 'un appid con el mismo numero no', r5b.tarjetas['303']);

    // ---- Caso 6: el ↺ de una oculta por su juego deshace la regla ----
    const r6 = await run(Object.assign({}, base, {
        ignoredGids: { '201': oculto() },
        ignoredGames: { 'app:555': { t: Date.now(), n: 'Dino' } },
        showIgnored: true,
        pulsar: [{ gid: '203', sel: '.ig-ign-btn' }]
    }));
    ok(r6.almacen.juegosOcultos && !r6.almacen.juegosOcultos['app:555'],
        'el ↺ de una tarjeta oculta por su juego quita el juego', r6.almacen.juegosOcultos);
    ok(r6.tarjetas['202'].estado === 'visible' && r6.tarjetas['203'].estado === 'visible',
        'y sus giveaways vuelven', [r6.tarjetas['202'], r6.tarjetas['203']]);
    ok(r6.tarjetas['201'].estado === 'atenuado' && r6.tarjetas['201'].botonJuego,
        'el que se oculto uno a uno con ✕ sigue oculto, con su 🚫 de vuelta', r6.tarjetas['201']);
    ok(!r6.almacen.gidsOcultos['203'], 'pulsar ese ↺ no oculta el gid por el camino', r6.almacen.gidsOcultos);

    // ---- Caso 7: "limpiar juegos ocultos" desde el widget ----
    const r7 = await run(Object.assign({}, base, {
        ignoredGames: {
            'app:555': { t: Date.now(), n: 'Dino' },
            'title:juego sin steam': { t: Date.now(), n: 'Juego sin Steam' }
        },
        pulsar: [{ gid: null, sel: '#ig-bw-clear-ignored-games' }],
        confirmar: true
    }));
    ok(r7.clics[0] && r7.clics[0].encontrado, 'el boton del widget existe', r7.clics);
    ok(Object.keys(r7.almacen.juegosOcultos || {}).length === 0, 'la lista de juegos queda vacia', r7.almacen.juegosOcultos);
    ok(Object.values(r7.tarjetas).every(t => t.estado === 'visible'), 'y todas las tarjetas vuelven', r7.tarjetas);
    ok(r7.widgetOcultos.limpiarJuegos === null, 'y el boton se va', r7.widgetOcultos);

    // ---- Caso 8: lo mismo, cancelando ----
    const r8 = await run(Object.assign({}, base, {
        ignoredGames: { 'app:555': { t: Date.now(), n: 'Dino' } },
        pulsar: [{ gid: null, sel: '#ig-bw-clear-ignored-games' }],
        confirmar: false
    }));
    ok(r8.almacen.juegosOcultos && r8.almacen.juegosOcultos['app:555'], 'cancelar no borra nada', r8.almacen.juegosOcultos);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
