// Los boletos que YA tienes comprados en un giveaway, en el modal de encolar.
//
// El listado no publica ese dato —comprobado contra el HTML real de una tarjeta
// con sesion: solo hay tiempo / sold / precio, y «sold» es el total de todo el
// mundo, no el tuyo—. El unico sitio donde sale es la ficha, en
// `.card-join-info`, donde el servidor escribe «GIVEAWAY <id> - created <fecha>»
// si no tienes ninguno y «GIVEAWAY <id> - 10 tickets purchased» si tienes.
//
// Esa segunda cadena es la REAL, leida con sesion. La primera version de este
// test usaba «(4) TICKETS PURCHASED», sacado de una captura donde la cifra va en
// un circulo oscuro: los parentesis eran CSS. El test pasaba contra ese fixture
// inventado mientras en el navegador la fila no salia NUNCA, y por eso hay un
// caso extra —'parent'— que cubre los parentesis por si alguna vez existen, en
// vez de dar por hecho un formato u otro.
//
// De ahi el diseño que se comprueba aqui:
//   1. Se pide UNA ficha, la del giveaway que estas encolando, y solo al abrir
//      el modal. Con la URL del href del titulo (lleva el slug, que no se
//      adivina) y con la sesion, como cualquier peticion del sitio.
//   2. Sin boletos la fila dice 0, con boletos dice el numero.
//   3. Si no se puede saber —la ficha llega sin `.card-join-info`, o la
//      peticion falla— la fila NO se enseña. Callar es la respuesta correcta:
//      inventarse un 0 seria decirle «no tienes ninguno» a quien tiene cuatro,
//      que es justo el error que este dato existe para evitar.
//   4. Y en ningun caso el modal se queda esperando: se abre al instante.
//
// Se descarto contar los joins del propio script (habria salido gratis, sin
// ninguna peticion) porque solo contaria lo que compro EL SCRIPT en ESTE
// navegador: a quien compro boletos a mano, antes o por error, le daria una
// cifra corta. El caso 3 es el que fija esa decision: preferimos no decir nada
// antes que decir un numero que se queda corto.
const { run, pageCells } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}

// Tres Extra Odds baratos, para que el saldo de 10 iS no estorbe al modal.
const cartas = pageCells(1, 3, { type: 'extra', price: 1 });

(async () => {
    // ---- Caso 1: tienes boletos -> sale el numero ----
    const r1 = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, waitMs: 2000,
        fichas: { 1002: 'con' }, abrirModal: 1002
    });
    ok(!r1.modal || !r1.modal.error, 'no se pudo abrir el modal', r1.modal);
    ok(r1.modal.abierto, 'el modal tenia que estar abierto', r1.modal);
    ok(r1.modal.comprados === '4', 'tenia que leer los 4 boletos de la ficha', r1.modal);
    ok(r1.modal.peticionFicha.length === 1,
        'una sola peticion, y solo a la ficha que se esta encolando', r1.modal.peticionFicha);
    ok(/^\/giveaways\/card\/[^/]+\/1002$/.test(r1.modal.peticionFicha[0] || ''),
        'la URL tiene que ser la del href del titulo, con su slug',
        r1.modal.peticionFicha);
    ok(r1.modal.credenciales === 'same-origin',
        'y va con la sesion, como cualquier peticion del sitio', r1.modal.credenciales);

    // ---- Caso 1b: la variante con parentesis tambien se lee ----
    const r1b = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, waitMs: 2000,
        fichas: { 1002: 'parent' }, abrirModal: 1002
    });
    ok(r1b.modal.comprados === '4',
        'si el sitio pusiera parentesis, tambien tiene que leerse', r1b.modal);

    // ---- Caso 2: no tienes ninguno -> 0, no silencio ----
    // La ficha dice «created <fecha>», que es una respuesta: no tienes boletos.
    const r2 = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, waitMs: 2000,
        fichas: { 1002: 'sin' }, abrirModal: 1002
    });
    ok(r2.modal.comprados === '0',
        'sin boletos la ficha lo dice, y el modal tiene que enseñar el 0', r2.modal);

    // ---- Caso 3a: marcado desconocido -> callar ----
    const r3 = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, waitMs: 2000,
        fichas: { 1002: 'roto' }, abrirModal: 1002
    });
    ok(r3.modal.abierto, 'el modal se abre igual', r3.modal);
    ok(!r3.modal.compradosVisible,
        'sin .card-join-info no se sabe: la fila NO se enseña en vez de poner 0', r3.modal);

    // ---- Caso 3b: la peticion falla -> callar, y el modal sigue vivo ----
    const r4 = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, waitMs: 2000,
        fichas: { 1002: 500 }, abrirModal: 1002
    });
    ok(r4.modal.abierto, 'una ficha que no responde no puede bloquear el modal', r4.modal);
    ok(!r4.modal.compradosVisible, 'y tampoco puede dejar un numero inventado', r4.modal);

    // ---- Caso 4: sin abrir el modal no se pide ninguna ficha ----
    // El coste tiene que ser exactamente el que se prometio: una peticion por
    // apertura del modal, y CERO por cargar el listado.
    const r5 = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false, waitMs: 2000
    });
    ok(!r5.peticiones.some(u => /\/giveaways\/card\//.test(u)),
        'cargar el listado no puede pedir ninguna ficha', r5.peticiones);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
