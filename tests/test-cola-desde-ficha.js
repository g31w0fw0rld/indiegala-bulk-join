// Un item encolado desde la FICHA de un giveaway, ejecutado desde el LISTADO.
//
// OJO CON EL ENCUADRE: desde 1.10.7 la ficha ya no encola nada — se le quito el
// boton "Bulk JOIN" (ver el comentario de PAGINA DE CARD en el script). Asi que
// este caso ya no se produce desde la interfaz, pero SIGUE existiendo en las
// colas que la gente ya tiene guardadas en su navegador: ahi hay items con
// `fnName: 'joinGiveawayCard'` que hay que seguir ejecutando bien, y de ahi que
// este test se quede. El segundo caso —el join que se iba al giveaway
// equivocado— nunca dependio de por donde se hubiera encolado.
//
// Al encolar desde la ficha, el item se guarda con fnName 'joinGiveawayCard' y
// con el token de ESA pagina. El token lleva dentro la marca de tiempo del
// render (base64 de "_<n><userid><AAAAMMDDHHMMSS><...><gid>"), o sea que caduca,
// y por eso el loop lo refresca del trigger vivo antes de cada join. Pero
// findTrigger filtraba por el fnName guardado:
//
//   - En el listado, donde el onclick es 'joinGiveawayOrAuction', no encontraba
//     NADA: el join salia con el token rancio de la ficha y con un ancla falsa.
//     Eso es el "no funciona" que se reporto.
//   - Y para 'joinGiveawayCard' devolvia `.card-join a[data-price]` SIN mirar el
//     gid, o sea el trigger de la ficha en la que estuvieras: estando en la
//     ficha de A y ejecutando un item de B, el refresco hacia `gid = live.gid` y
//     el join se iba al giveaway EQUIVOCADO.
//
// Se comprueban las dos cosas sobre los argumentos con los que sale el join, que
// es donde se ve la diferencia.
const { run, pageCells } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}

// Item tal como lo dejaba addToQueue() al encolar desde una ficha de detalle.
// Se sigue construyendo a mano a proposito: hoy la interfaz ya no puede
// producirlo, y es exactamente lo que hay en las colas heredadas.
function itemDeFicha(gid, extra) {
    return Object.assign({
        gid: String(gid), title: 'Juego P1-2', timeLeft: '3 days left',
        fnName: 'joinGiveawayCard', price: 1, fnArg2: 1,
        token: 'TOKEN-RANCIO-DE-LA-FICHA', count: 1, done: 0, type: 'bulk',
        addedAt: Date.now()
    }, extra || {});
}

(async () => {
    // El gid 1002 es una tarjeta del listado con su trigger vivo y su token
    // fresco 'TOKEN1002' (ver cell() en el arnes). price 1 para que el saldo de
    // 10 iS cubra el item y no salte la segunda confirmacion.
    const cartas = pageCells(1, 3, { price: 1 });

    // ---- Caso 1: ejecutar en el listado un item encolado en la ficha ----
    const r1 = await run({
        current: 1, last: 1, pages: { 1: cartas },
        loadAllPages: false, waitMs: 2000,
        queue: [itemDeFicha(1002)], ejecutarCola: true
    });
    ok(!r1.ejecucion || !r1.ejecucion.error, 'la cola no llego a correr', r1.ejecucion);
    ok(r1.joins.length === 1, 'esperaba exactamente un join', r1.joins);
    const j1 = r1.joins[0] || {};
    ok(j1.gid === '1002', 'el join tiene que ir al giveaway encolado', j1);
    ok(j1.token === 'TOKEN1002',
        'el token tenia que refrescarse del trigger vivo del listado, no viajar el de la ficha', j1);
    ok(j1.fnName === 'joinGiveawayOrAuction',
        'en el listado se invoca la funcion del listado', j1);
    ok(j1.anclaViva === true,
        'y con el ancla de verdad de la tarjeta, no con una falsa', j1);
    ok(Array.isArray(r1.colaRestante) && r1.colaRestante.length === 0,
        'un join en ok tiene que vaciar el item de la cola', r1.colaRestante);

    // ---- Caso 2: con un trigger de ficha AJENO presente, no confundirse ----
    // El .card-join del DOM es del gid 9999; el item de la cola es del 1002.
    const r2 = await run({
        current: 1, last: 1, pages: { 1: cartas },
        loadAllPages: false, waitMs: 2000,
        cardJoin: { gid: '9999', price: 1, token: 'TOKEN-DE-OTRO-GIVEAWAY' },
        queue: [itemDeFicha(1002)], ejecutarCola: true
    });
    ok(r2.joins.length === 1, 'esperaba exactamente un join', r2.joins);
    const j2 = r2.joins[0] || {};
    ok(j2.gid === '1002',
        'el join NO puede irse al giveaway de la ficha que hay en pantalla', j2);
    ok(j2.token === 'TOKEN1002',
        'ni llevarse su token', j2);

    // ---- Caso 3: un item normal del listado sigue igual ----
    // Control positivo: lo que no cambio tiene que seguir funcionando.
    const r3 = await run({
        current: 1, last: 1, pages: { 1: cartas },
        loadAllPages: false, waitMs: 2000,
        queue: [Object.assign(itemDeFicha(1003), {
            fnName: 'joinGiveawayOrAuction', token: 'TOKEN1003', type: 'single'
        })],
        ejecutarCola: true
    });
    ok(r3.joins.length === 1, 'esperaba exactamente un join', r3.joins);
    const j3 = r3.joins[0] || {};
    ok(j3.gid === '1003' && j3.token === 'TOKEN1003' && j3.anclaViva === true,
        'el item encolado en el propio listado no tenia que cambiar', j3);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
