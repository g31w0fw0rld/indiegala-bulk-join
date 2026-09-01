// "Ocultar ya participados" y el Extra Odds.
//
// El toggle nunca decidio por "participado": decide por AUSENCIA de control de
// compra (isAlreadyEntered, regla 3). Esa premisa solo vale para el Single
// Ticket, que se agota al participar y entonces Indiegala deja de renderizar su
// boton. En Extra Odds el control no se va nunca porque puedes comprar MAS
// boletos del mismo giveaway —es el caso de uso del script, tope de 50—, asi que
// ahi "ya tengo boleto" no significa "aqui ya no hay nada que hacer".
//
// El fallo que se arregla: los Extra Odds si acababan ocultos por las dos ramas
// de `wait`. executeQueue apunta el gid en enteredGids tras cada compra, y esa
// es la rama (a); y la (b) esconde cualquier tarjeta colgada en el lazy-load.
// Como las dos dependen de que al sitio se le atasque ESA tarjeta, los Extra
// Odds desaparecian a veces y sin patron, que es justo lo que se reporto.
//
// Se comprueba lo que ahora NO pasa (Extra Odds, en cualquier estado, se queda)
// y lo que TIENE que seguir pasando (Single Ticket participado se oculta, por
// las tres vias: DOM cargado, `wait` recordado y `wait` colgado). Lo segundo es
// la mitad que importa: un guard puesto demasiado arriba apagaria el toggle
// entero y el test seguiria en verde si solo mirase los Extra Odds.
//
// Lo que este arnes NO puede medir: que la celda se vea o no. jsdom no hace
// layout. Se afirma que applyHideEntered puso (o no) su clase .ig-entered-hidden
// en la celda, que es lo unico que el script toca; que esa clase equivale a
// display:none lo dice la hoja, no jsdom.
const { run } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}

// Un listado con los siete estados que importan, en la misma pagina.
const cartas = [
    { gid: '101', title: 'Single joineable',        type: 'single', lev: 3 },
    { gid: '102', title: 'Single participado',      type: 'single', lev: 3, participado: true },
    { gid: '103', title: 'Extra joineable',         type: 'extra' },
    { gid: '104', title: 'Extra wait recordado',    type: 'extra',  wait: true },
    { gid: '105', title: 'Single wait recordado',   type: 'single', lev: 3, wait: true },
    { gid: '106', title: 'Extra wait colgado',      type: 'extra',  wait: true },
    { gid: '107', title: 'Single wait colgado',     type: 'single', lev: 3, wait: true }
];
// Lo que habria dejado executeQueue tras comprar en 104 (Extra Odds) y 105
// (Single Ticket). Los dos estan colgados en `wait`, o sea que el DOM no dice
// nada de ellos y este registro es la unica fuente: es la rama (a).
const recordados = { '104': Date.now(), '105': Date.now() };

(async () => {
    // ---- Caso 1: el toggle encendido, con margen para que salte la rama (b) ----
    // waitMs holgado a proposito: applyHideEntered reprograma su repaso a
    // staleWaitMs + 250 ms (5,25 s), y las ramas de "colgado" no se pueden
    // afirmar antes de que ese repaso haya corrido.
    const r = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false,
        hideEntered: true, enteredGids: recordados, saldo: 500, waitMs: 8000
    });
    const ocultos = r.ocultosParticipados.slice().sort();

    // Extra Odds: ninguno, en ningun estado.
    ok(!ocultos.includes('103'), 'un Extra Odds joineable no se oculta', ocultos);
    ok(!ocultos.includes('104'), 'un Extra Odds ya comprado (en `wait`, con su gid recordado) NO se oculta', ocultos);
    ok(!ocultos.includes('106'), 'un Extra Odds colgado en `wait` NO se oculta', ocultos);

    // Single Ticket: las tres vias siguen vivas.
    ok(ocultos.includes('102'), 'un Single Ticket participado (DOM cargado, sin control) se oculta', ocultos);
    ok(ocultos.includes('105'), 'un Single Ticket recordado se oculta aunque este colgado en `wait`', ocultos);
    ok(ocultos.includes('107'), 'un Single Ticket colgado en `wait` se oculta al agotarse el margen', ocultos);

    // Y el joineable de verdad sigue a la vista.
    ok(!ocultos.includes('101'), 'un Single Ticket joineable no se oculta', ocultos);

    // La lista entera, por si acaso: nada de mas, nada de menos.
    ok(JSON.stringify(ocultos) === JSON.stringify(['102', '105', '107']),
        'se ocultan exactamente los tres Single Ticket participados', ocultos);

    // El Extra Odds que se queda tiene que seguir siendo util: su badge ⚠×N es
    // lo que se pulsa para comprar mas boletos. Dejarlo visible y sin badge
    // seria la mitad del arreglo.
    ok(r.badges >= 1, 'el Extra Odds visible conserva su badge ⚠×N', { badges: r.badges });

    // El ✕ se sigue pintando en todas: es la unica forma de perder de vista un
    // Extra Odds concreto, y ahora es la unica.
    ok(r.cruces === cartas.length, 'cada tarjeta conserva su ✕', { cruces: r.cruces });

    // ---- Caso 2: el toggle apagado no oculta nada ----
    const r2 = await run({
        current: 1, last: 1, pages: { 1: cartas }, loadAllPages: false,
        hideEntered: false, enteredGids: recordados, saldo: 500, waitMs: 8000
    });
    ok(r2.ocultosParticipados.length === 0,
        'con el toggle apagado no se oculta ninguna', r2.ocultosParticipados);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
