// La cola frente a un giveaway que ya no esta disponible: el servidor contesta
// al join con `code: 'e260'`, que el sitio pinta como "[e260]" en la caja de
// error de la tarjeta (handleJoinGiveawayOrAuction, leido del sitio el
// 2026-10-20: el codigo viaja en `responseData.code`, aparte del `status`).
//
// Antes la corrida se paraba ahi: el status no estaba entre los conocidos y
// caia en la rama de desconocidos. Lo que se pide es que lo aparte y siga:
// fuera de la cola, su tarjeta a la categoria "no disponibles" (que no se
// guarda ni se puede deshacer) y el siguiente item comprado.
//
// Se decide por el CODIGO, venga con el status que venga: el sitio no publica
// cual acompaña al e260, asi que se prueban dos (uno desconocido y
// 'not_available'). Y el control: un error desconocido SIN ese codigo tiene que
// seguir parando, que es lo que protege de un bucle contra un servidor raro.
//
// Que la caja de error que deja a la vista no pare el tick siguiente es otro
// asunto, comun a todos los errores que la cola salta: test-cola-caja-de-error.js.
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

const cartas = pageCells(1, 3, { price: 1 });
const base = {
    current: 1, last: 1, pages: { 1: cartas },
    loadAllPages: false, waitMs: 2000, esperaCola: 7000,
    queue: [item(1001), item(1002)], ejecutarCola: true
};

(async () => {
    for (const status of ['error', 'not_available']) {
        const r = await run(Object.assign({}, base, {
            joinResponses: [{ status, code: 'e260' }, { status: 'ok', silver_tot: 9 }]
        }));
        const tag = `[e260 con status '${status}'] `;
        ok(!r.ejecucion || !r.ejecucion.error, tag + 'la cola no llego a correr', r.ejecucion);
        ok(r.joins.map(j => j.gid).join(',') === '1001,1002',
            tag + 'tras el e260 la cola tenia que seguir con el siguiente', r.joins.map(j => j.gid));
        ok(Array.isArray(r.colaRestante) && r.colaRestante.length === 0,
            tag + 'el no disponible sale de la cola y el siguiente se compra', r.colaRestante);
        const t = r.tarjetas;
        ok(t['1001'] && t['1001'].noDisponible === true,
            tag + 'la tarjeta del no disponible tiene que quedar oculta en su categoria', t['1001']);
        ok(t['1002'] && t['1002'].noDisponible === false && t['1003'] && t['1003'].noDisponible === false,
            tag + 'y solo esa', { 1002: t['1002'], 1003: t['1003'] });
        // Categoria aparte: ni entra en la lista de ocultos por el usuario (que
        // se guarda y tiene ↺) ni en la de participados.
        ok(t['1001'] && t['1001'].estado === 'visible',
            tag + 'no puede ir a "ocultos por mi": esa se deshace y se guarda', t['1001']);
        ok(Object.keys(r.almacen.gidsOcultos || {}).length === 0,
            tag + 'nada al almacen de ocultos: la categoria vive en memoria', r.almacen.gidsOcultos);
        ok(!r.widgetOcultos.casillaMostrar && !r.widgetOcultos.limpiar,
            tag + 'sin "Mostrar ocultos" ni "Limpiar": no hay nada que devolver', r.widgetOcultos);
        ok(r.widgetOcultos.noDisponibles && /1/.test(r.widgetOcultos.noDisponibles),
            tag + 'el widget tiene que contar el no disponible', r.widgetOcultos);
        ok(r.ejecucion && /1/.test(r.ejecucion.estado || '') && !/Deteniendo|Stopping/.test(r.ejecucion.estado || ''),
            tag + 'la corrida termina limpia y lo dice', r.ejecucion);
        ok(r.ejecucion && /disponible|available/i.test(r.ejecucion.estado || ''),
            tag + 'el resumen dice que hubo no disponibles', r.ejecucion);
    }

    // ---- Control: un error desconocido SIN e260 sigue parando ----
    const rc = await run(Object.assign({}, base, {
        joinResponses: [{ status: 'error', code: 'e999' }, { status: 'ok', silver_tot: 9 }]
    }));
    ok(rc.joins.length === 1, '[control] sin e260 la corrida tiene que pararse en el primero', rc.joins);
    ok(Array.isArray(rc.colaRestante) && rc.colaRestante.length === 2,
        '[control] y dejar los dos en la cola', rc.colaRestante);
    ok(rc.tarjetas['1001'] && rc.tarjetas['1001'].noDisponible === false,
        '[control] sin ocultar nada', rc.tarjetas['1001']);
    ok(!rc.widgetOcultos.noDisponibles, '[control] ni contar nada en el widget', rc.widgetOcultos);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
