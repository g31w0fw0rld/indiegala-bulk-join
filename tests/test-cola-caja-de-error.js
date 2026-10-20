// La caja de error de OTRA tarjeta no puede parar la cola.
//
// Antes de cada join el loop mira si la tarjeta muestra un error
// (isErrorVisible). Subia 8 padres desde el trigger, y eso llega hasta
// .page-contents-ajax-list: recogia las cajas de error de TODO el listado
// (comprobado en el sitio el 2026-10-20, 20 de 20). Como el sitio deja la caja
// de un join fallido a la vista ~5,8 s —mas que la pausa de 2,5-5 s entre
// joins—, cualquier error que la cola salta sin pararse (duplicate,
// not_available, limit_reached…) paraba la corrida en el item SIGUIENTE con
// "Error detectado".
//
// La caja se deja a la vista desde el arnes (errorVisibleEn), con un ancho
// fingido: jsdom no hace layout y sin eso isErrorVisible no veria nada nunca.
const { run, pageCells } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}

function item(gid) {
    return {
        gid: String(gid), title: 'Juego ' + gid, timeLeft: '3 days left',
        fnName: 'joinGiveawayOrAuction', price: 1, fnArg2: 0,
        token: 'TOKEN' + gid, count: 1, done: 0, type: 'single',
        addedAt: Date.now()
    };
}

const base = {
    current: 1, last: 1, pages: { 1: pageCells(1, 3, { price: 1 }) },
    loadAllPages: false, waitMs: 2000,
    queue: [item(1002)], ejecutarCola: true
};

(async () => {
    // ---- La caja visible es de otra tarjeta: la cola sigue ----
    const r1 = await run(Object.assign({}, base, { errorVisibleEn: [1001] }));
    ok(!r1.ejecucion || !r1.ejecucion.error, 'la cola no llego a correr', r1.ejecucion);
    ok(r1.joins.length === 1 && r1.joins[0].gid === '1002',
        'el error de la tarjeta 1001 no puede impedir el join de la 1002', r1.joins);
    ok(Array.isArray(r1.colaRestante) && r1.colaRestante.length === 0,
        'y el item se compra', r1.colaRestante);
    ok(r1.ejecucion && !/Error/.test(r1.ejecucion.estado || ''),
        'sin "Error detectado" en el resumen', r1.ejecucion);

    // ---- Control: la caja visible es la de SU tarjeta: se para ----
    // Es para lo que existe la comprobacion, y tiene que seguir funcionando.
    const r2 = await run(Object.assign({}, base, { errorVisibleEn: [1002] }));
    ok(r2.joins.length === 0, '[control] con el error en su propia tarjeta no tiene que salir el join', r2.joins);
    ok(Array.isArray(r2.colaRestante) && r2.colaRestante.length === 1,
        '[control] y el item se queda en la cola', r2.colaRestante);
    ok(r2.ejecucion && /Error/.test(r2.ejecucion.estado || ''),
        '[control] con "Error detectado" en el resumen', r2.ejecucion);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
