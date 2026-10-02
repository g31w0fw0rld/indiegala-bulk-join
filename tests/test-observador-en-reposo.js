// Con la pagina quieta, el script no puede mutar nada.
//
// injectAll() corre en cada pasada de un MutationObserver sobre <body> (childList
// + class, con 250 ms de debounce). Si una pasada escribe algo —aunque sea el
// mismo valor—, esa escritura es una mutacion, despierta a la siguiente pasada y
// el bucle no para: hasta 1.11.1 pasaba con la pagina en reposo, unas 40
// mutaciones por segundo, y el script recorria todas las tarjetas cuatro veces
// por segundo para siempre. No se veia en pantalla porque cada pasada escribia
// lo mismo.
//
// Las tres formas de escribir sin cambiar nada que lo provocaban, y que este
// test vigila en sus escenarios:
//   · `el.textContent = x` con x igual al que ya habia (reemplaza el nodo de
//     texto: mutacion childList). Lo hacian el ＋, el ⚠×N, el ✕/↺, la cifra de
//     saldo, el GalaCredit, el disponible, el boton de minimizar y la ruleta.
//   · `el.className = x` (reescribe el atributo class siempre). La ruleta.
//   · `classList.remove(c)` / `add(c)` sin que cambie nada: reescriben el
//     atributo igual. `toggle(c, bool)` no, y por eso se usa ese. Las celdas en
//     "ocultar ya participados" y el disponible del widget.
//
// Cada escenario enciende una parte distinta del repintado: tarjetas con ＋ y
// ⚠×N, ocultos a la vista con su 🚫, participados ocultos, cola con panel y
// disponible, todas las paginas cargadas, ruleta por girar y saldo al tope. Si
// falla, la salida dice que nodo se movio y cuantas veces.
const { run } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}

const cartas = [
    { gid: '201', title: 'Single A', type: 'single', lev: 3 },
    { gid: '202', title: 'Extra B', type: 'extra' },
    { gid: '203', title: 'Single participado', type: 'single', lev: 3, participado: true },
    { gid: '204', title: 'Single en cola', type: 'single', lev: 3 }
];
const cola = [{
    gid: '204', title: 'Single en cola', timeLeft: '3 days left', fnName: 'joinGiveawayOrAuction',
    price: 12, fnArg2: 0, token: 'TOKEN204', count: 1, done: 0, type: 'single', addedAt: Date.now()
}];
const base = { current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, saldo: 500 };

const escenarios = [
    ['tarjetas normales', {}],
    ['ocultos a la vista, con 🚫', { ignoredGids: { '201': { t: Date.now() } }, showIgnored: true }],
    ['juego oculto', { ignoredGames: { 'app:202': { t: Date.now(), n: 'Extra B' } } }],
    ['ocultar ya participados', { hideEntered: true }],
    ['cola con disponible', { queue: cola }],
    ['cola por encima del saldo', { queue: cola, saldo: 5 }],
    ['ruleta por girar', { wheel: 'available' }],
    ['saldo al tope', { saldo: 240 }],
    ['todas las paginas cargadas', {
        current: 1, last: 2, loadAllPages: true,
        pages: { 1: cartas, 2: [{ gid: '2001', title: 'Traida', type: 'single', lev: 3 }] }
    }]
];

(async () => {
    for (const [nombre, extra] of escenarios) {
        const r = await run(Object.assign({}, base, extra));
        ok(r.mutacionesEnReposo === 0, `en reposo no se muta nada: ${nombre}`,
            r.mutacionesPorNodo);
    }

    // Control positivo: la sonda tiene que ver una mutacion cuando la hay. Sin
    // esto, un observador mal enganchado daria 0 en todos los escenarios y el
    // test pasaria sin medir nada.
    const r = await run(Object.assign({}, base, { sondaMutar: true }));
    ok(r.mutacionesEnReposo > 0, 'la sonda ve una mutacion provocada (control positivo)',
        { mutaciones: r.mutacionesEnReposo });

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
