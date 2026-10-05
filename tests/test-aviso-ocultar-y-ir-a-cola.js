// Dos atajos de 1.12.1, los dos para no tener que buscar a mano en el listado:
//
//   · tras el ✕, un aviso que ofrece ocultar el juego entero. Hasta ahora el 🚫
//     solo se veia con "Mostrar ocultos por mi"; el aviso lo trae al momento en
//     que se acaba de descartar uno. Se vigila que salga solo al ocultar (no al
//     deshacer con ↺), que cuente bien los demas del juego —sin el carrusel, que
//     repite giveaways—, que su boton haga lo mismo que el 🚫, y que se cierre
//     con un clic fuera o con Esc dejando el ✕ hecho;
//
//   · un clic en una fila de la cola lleva a su tarjeta: scroll, foco en su
//     titulo y destello. Y si la tarjeta no esta o esta oculta, lo dice.
//
// Lo que este arnes NO puede medir: donde queda el aviso ni que el scroll se
// vea. jsdom no hace layout; scrollIntoView lo registra el arnes por gid.
const { run } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}

// Tres del mismo juego (appid 555), uno de otro, y uno sin portada de Steam.
const cartas = [
    { gid: '201', title: 'Dino running from a FURRY', type: 'single', lev: 3, appid: '555' },
    { gid: '202', title: 'Dino running from a FURRY', type: 'extra', appid: '555' },
    { gid: '203', title: 'Dino running from a FURRY', type: 'single', lev: 3, appid: '555' },
    { gid: '204', title: 'Otro juego', type: 'single', lev: 3, appid: '777' },
    { gid: '205', title: 'Juego sin Steam', type: 'single', lev: 3, appid: null }
];
const base = { current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, saldo: 500 };
const oculto = () => ({ t: Date.now() });
const enCola = (gid, title) => ({
    gid: String(gid), title, timeLeft: '3 days left', fnName: 'joinGiveawayOrAuction',
    price: 1, fnArg2: 0, token: 'T' + gid, count: 1, done: 0, type: 'single', addedAt: Date.now()
});

(async () => {
    // ---- Caso 1: el ✕ de 201 saca el aviso ----
    const r1 = await run(Object.assign({}, base, { pulsar: [{ gid: '201', sel: '.ig-ign-btn' }] }));
    ok(r1.almacen.gidsOcultos && r1.almacen.gidsOcultos['201'], 'el ✕ oculta el giveaway', r1.almacen.gidsOcultos);
    ok(r1.tarjetas['201'].estado === 'oculto', 'y su tarjeta se va', r1.tarjetas['201']);
    ok(r1.avisoOcultar && r1.avisoOcultar.boton, 'sale el aviso con su boton', r1.avisoOcultar);
    ok(r1.avisoOcultar && /Dino running from a FURRY/.test(r1.avisoOcultar.texto), 'el aviso nombra el juego', r1.avisoOcultar);
    // 202 y 203; el carrusel del arnes repite giveaways y no puede sumar.
    ok(r1.avisoOcultar && /\b2\b/.test(r1.avisoOcultar.texto), 'cuenta los otros 2 del juego en la pagina', r1.avisoOcultar);
    ok(Object.keys(r1.almacen.juegosOcultos || {}).length === 0, 'el aviso solo pregunta: no oculta el juego', r1.almacen.juegosOcultos);
    ok(r1.tarjetas['202'].estado === 'visible' && r1.tarjetas['203'].estado === 'visible',
        'los otros del juego siguen a la vista', [r1.tarjetas['202'], r1.tarjetas['203']]);

    // ---- Caso 2: su boton oculta el juego entero, como el 🚫 ----
    const r2 = await run(Object.assign({}, base, { pulsar: [
        { gid: '201', sel: '.ig-ign-btn' },
        { gid: null, sel: '#ig-ign-pop .ig-ign-pop-game' }
    ] }));
    ok(r2.clics[1] && r2.clics[1].encontrado, 'el boton del aviso existe y se pulsa', r2.clics);
    ok(r2.almacen.juegosOcultos && r2.almacen.juegosOcultos['app:555'], 'se guarda el juego por su appid', r2.almacen.juegosOcultos);
    ok((r2.almacen.juegosOcultos['app:555'] || {}).n === 'Dino running from a FURRY', 'con su titulo', r2.almacen.juegosOcultos);
    ok(['201', '202', '203'].every(g => r2.tarjetas[g].estado === 'oculto'), 'todos los del juego se van', r2.tarjetas);
    ok(['204', '205'].every(g => r2.tarjetas[g].estado === 'visible'), 'los de otro juego no', r2.tarjetas);
    ok(r2.avisoOcultar === null, 'y el aviso se cierra', r2.avisoOcultar);
    ok(r2.toasts.some(t => /Dino running from a FURRY/.test(t)), 'con el mismo toast que el 🚫', r2.toasts);

    // ---- Caso 3: un clic fuera lo cierra y deja el ✕ hecho ----
    const r3 = await run(Object.assign({}, base, { pulsar: [
        { gid: '201', sel: '.ig-ign-btn' },
        { gid: null, sel: '#ajax-contents-container' }
    ] }));
    ok(r3.avisoOcultar === null, 'un clic fuera cierra el aviso', r3.avisoOcultar);
    ok(r3.almacen.gidsOcultos && r3.almacen.gidsOcultos['201'], 'el giveaway sigue oculto', r3.almacen.gidsOcultos);
    ok(Object.keys(r3.almacen.juegosOcultos || {}).length === 0, 'y el juego no', r3.almacen.juegosOcultos);

    // ---- Caso 3b: un clic DENTRO (en su texto) no lo cierra ----
    const r3b = await run(Object.assign({}, base, { pulsar: [
        { gid: '201', sel: '.ig-ign-btn' },
        { gid: null, sel: '#ig-ign-pop .ig-ign-pop-ask' }
    ] }));
    ok(r3b.avisoOcultar !== null, 'un clic dentro del aviso no lo cierra', r3b.clics);

    // ---- Caso 4: Esc lo cierra ----
    const r4 = await run(Object.assign({}, base, { pulsar: [
        { gid: '201', sel: '.ig-ign-btn' },
        { tecla: 'Escape' }
    ] }));
    ok(r4.avisoOcultar === null, 'Esc cierra el aviso', r4.avisoOcultar);

    // ---- Caso 5: deshacer con ↺ no lo saca ----
    const r5 = await run(Object.assign({}, base, {
        ignoredGids: { '201': oculto() }, showIgnored: true,
        pulsar: [{ gid: '201', sel: '.ig-ign-btn' }]
    }));
    ok(!r5.almacen.gidsOcultos['201'], 'el ↺ devuelve el giveaway', r5.almacen.gidsOcultos);
    ok(r5.avisoOcultar === null, 'y no ofrece ocultar el juego', r5.avisoOcultar);

    // ---- Caso 6: el unico de su juego en la pagina ----
    const r6 = await run(Object.assign({}, base, { pulsar: [{ gid: '204', sel: '.ig-ign-btn' }] }));
    ok(r6.avisoOcultar && !/\d/.test(r6.avisoOcultar.texto.replace(/Otro juego/, '')),
        'sin otros en la pagina no da cifra, avisa de los que vendran', r6.avisoOcultar);

    // ---- Caso 7: clic en una fila de la cola, tarjeta a la vista ----
    const r7 = await run(Object.assign({}, base, {
        queue: [enCola(204, 'Otro juego'), enCola(203, 'Dino running from a FURRY')],
        pulsar: [{ gid: null, sel: '#ig-q-panel .ig-q-li[data-gid="203"] .ig-q-it-title' }]
    }));
    ok(r7.clics[0] && r7.clics[0].encontrado, 'la fila de la cola existe', r7.clics);
    ok(r7.irA.scrolls.length === 1 && r7.irA.scrolls[0] === '203', 'hace scroll a la tarjeta de 203 y solo a ella', r7.irA);
    ok(r7.irA.foco === '203', 'el foco queda en esa tarjeta', r7.irA);
    ok(r7.irA.destello.length === 1 && r7.irA.destello[0] === '203', 'y lleva el destello', r7.irA);
    ok(r7.colaRestante.length === 2, 'ir a la tarjeta no toca la cola', r7.colaRestante);

    // ---- Caso 8: los botones de la fila no llevan a ningun sitio ----
    const r8 = await run(Object.assign({}, base, {
        queue: [enCola(204, 'Otro juego'), enCola(203, 'Dino running from a FURRY')],
        pulsar: [{ gid: null, sel: '#ig-q-panel .ig-q-li[data-gid="204"] .ig-q-it-mv[data-dir="1"]' }]
    }));
    ok(r8.irA.scrolls.length === 0, 'mover con ▼ no hace scroll', r8.irA);
    ok(r8.colaRestante.map(q => q.gid).join() === '203,204', 'y si mueve', r8.colaRestante.map(q => q.gid));

    // ---- Caso 9: no esta en la pagina, u oculta ----
    const r9 = await run(Object.assign({}, base, {
        queue: [enCola(9999, 'De otra pagina')],
        pulsar: [{ gid: null, sel: '#ig-q-panel .ig-q-li[data-gid="9999"]' }]
    }));
    ok(r9.irA.scrolls.length === 0, 'sin tarjeta no hay scroll', r9.irA);
    ok(r9.toasts.some(t => /not in what the listing shows/.test(t)), 'y lo dice', r9.toasts);
    const r9b = await run(Object.assign({}, base, {
        queue: [enCola(203, 'Dino running from a FURRY')],
        ignoredGids: { '203': oculto() },
        pulsar: [{ gid: null, sel: '#ig-q-panel .ig-q-li[data-gid="203"]' }]
    }));
    ok(r9b.irA.scrolls.length === 0, 'una tarjeta oculta no recibe scroll', r9b.irA);
    ok(r9b.toasts.some(t => /hidden in the listing/.test(t)), 'y dice que esta oculta', r9b.toasts);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
