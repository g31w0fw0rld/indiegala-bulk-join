// Caso central: con la casilla puesta, el listado acaba con TODAS las páginas
// dentro, una sola petición por página, sin duplicados y en el orden correcto.
//
// El tercer caso es el que de verdad se puede romper: entrando por la página 3,
// las páginas 1 y 2 tienen que quedar POR ENCIMA, no al final. Es lo que se ve
// mal en cuanto pasa, y lo que un "insertar al final" hace mal siempre.
const { run, pageCells } = require('./harness');

const PAGES = { 1: pageCells(1, 4), 2: pageCells(2, 4), 3: pageCells(3, 3) };
// Dos del carrusel repiten giveaways del listado (1001 y 2001), como en el
// sitio: si el ámbito estuviera mal, se colarían duplicados o cuentas infladas.
const CARRUSEL = [
    { gid: '1001', title: 'Juego P1-1', lev: 0 },
    { gid: '2001', title: 'Juego P2-1', lev: 0 },
    { gid: '9001', title: 'Solo en el carrusel', lev: 4 }
];

const ESPERADO_ORDEN = ['1001', '1002', '1003', '1004', '2001', '2002', '2003', '2004', '3001', '3002', '3003'];

const CASOS = [
    { nombre: 'casilla apagada (control negativo)', opts: { current: 1, loadAllPages: false }, esperaPeticiones: 0 },
    { nombre: 'desde la pagina 1', opts: { current: 1 }, esperaPeticiones: 2 },
    { nombre: 'desde la pagina 3 (las de antes van arriba)', opts: { current: 3 }, esperaPeticiones: 2 },
    { nombre: 'desde la pagina 2 (parte por medio)', opts: { current: 2 }, esperaPeticiones: 2 },
    { nombre: 'una sola pagina', opts: { current: 1, last: 1, pages: { 1: pageCells(1, 4) } }, esperaPeticiones: 0 },
    // Con el revelador de imagenes del sitio presente, se usa ESE y no el
    // respaldo del script. Los demas casos corren sin el, o sea que entre los
    // dos queda cubierto el camino con y sin.
    { nombre: 'con el asyncImgLoader del sitio', opts: { current: 1, withAsyncImgLoader: true }, esperaPeticiones: 2, exigeAsyncImg: true }
];

(async () => {
    const fallos = [];
    for (const c of CASOS) {
        const opts = Object.assign({ last: 3, pages: PAGES, carousel: CARRUSEL }, c.opts);
        const r = await run(opts);
        const soloUna = opts.last === 1;
        const apagada = opts.loadAllPages === false;
        const esperado = apagada
            ? (opts.pages[opts.current] || []).map(x => x.gid)
            : (soloUna ? opts.pages[1].map(x => x.gid) : ESPERADO_ORDEN);

        const problemas = [];
        if (r.peticiones.length !== c.esperaPeticiones) problemas.push(`peticiones ${r.peticiones.length} != ${c.esperaPeticiones}`);
        if (r.gids.join(',') !== esperado.join(',')) problemas.push(`orden ${r.gids.join(',')} != ${esperado.join(',')}`);
        if (r.duplicados.length) problemas.push('duplicados: ' + r.duplicados.join(','));
        if (r.imagenesSinSrcTraidas) problemas.push(`${r.imagenesSinSrcTraidas} imagenes traidas sin src`);
        const traidasEsperadas = apagada || soloUna ? 0 : esperado.length - (opts.pages[opts.current] || []).length;
        if (r.traidas !== traidasEsperadas) problemas.push(`traidas ${r.traidas} != ${traidasEsperadas}`);
        // Una ✕ por tarjeta, siempre; el ＋ solo en las que traen control de
        // compra single (lev > 0 en este fixture).
        if (r.cruces !== esperado.length) problemas.push(`cruces ${r.cruces} != ${esperado.length}`);
        const conControl = esperado.length - (apagada || soloUna ? 1 : 3);
        if (r.masBotones !== conControl) problemas.push(`＋ ${r.masBotones} != ${conControl}`);
        if (!apagada && r.casilla !== true) problemas.push('la casilla no sale marcada');
        // La peticion tiene que salir como la hace el sitio: con la sesion y
        // marcada como XHR. Sin sesion, el servidor no sabe quien pregunta.
        if (r.peticiones.length) {
            if (r.credenciales !== 'same-origin') problemas.push('peticion sin credentials same-origin');
            if (!r.cabeceras || r.cabeceras['X-Requested-With'] !== 'XMLHttpRequest') problemas.push('peticion sin cabecera de XHR');
        }
        if (c.exigeAsyncImg && !r.asyncImgCalls.length) problemas.push('no llamo al asyncImgLoader del sitio');
        if (c.exigeAsyncImg && r.asyncImgCalls.length) {
            const amb = r.asyncImgCalls[0].parentCont || '';
            if (!amb.includes('#ajax-contents-container')) problemas.push(`lo llamo con ambito "${amb}", no con el del listado`);
        }

        console.log(JSON.stringify({
            caso: c.nombre,
            peticiones: r.peticiones,
            gids: r.gids.join(','),
            cruces: r.cruces, mas: r.masBotones, traidas: r.traidas, sinSrcTraidas: r.imagenesSinSrcTraidas,
            estado: r.estado,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
