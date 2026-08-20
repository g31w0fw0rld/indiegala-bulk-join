// La barra de paginación, plegada en dos mitades.
//
// Lo que se vigila no es "se esconde": es que se esconda SOLO cuando ya no falta
// ninguna página, y que la celda del total se quede siempre. Si se plegara al
// pararse a medias, se estaría quitando la única salida —seguir a mano— justo
// en el momento en que hace falta; y si se plegara el total, se estaría
// escondiendo un dato que sigue siendo verdad.
const { run, pageCells } = require('./harness');

const PAGES = { 1: pageCells(1, 4), 2: pageCells(2, 4), 3: pageCells(3, 3) };
const base = { current: 1, last: 3, pages: PAGES };

const CASOS = [
    {
        nombre: 'carga completa -> plegada',
        opts: {},
        herramientas: 0, total: true
    },
    {
        nombre: 'casilla apagada -> intacta',
        opts: { loadAllPages: false },
        // Sin cargar nada, la barra es la única forma de ver el resto: entera.
        herramientas: 'todas', total: true
    },
    {
        nombre: 'se paro por un fallo -> intacta',
        opts: { serve: { 3: 500 } },
        herramientas: 'todas', total: true
    },
    {
        nombre: 'se paro por la ruleta -> intacta',
        opts: { wheel: 'available' },
        herramientas: 'todas', total: true
    },
    {
        nombre: 'una sola pagina -> nada que plegar',
        opts: { current: 1, last: 1, pages: { 1: pageCells(1, 4) } },
        herramientas: 'todas', total: true
    }
];

(async () => {
    const fallos = [];
    for (const c of CASOS) {
        const opts = Object.assign({}, base, c.opts);
        // Cuántas celdas-herramienta pinta el fixture con estos filtros, para
        // poder exigir "todas" sin escribir el número a mano en cada caso.
        const ref = await run(Object.assign({}, opts, { loadAllPages: false }));
        const todas = ref.paginacionHerramientas;

        const r = await run(opts);
        const esperado = c.herramientas === 'todas' ? todas : c.herramientas;
        const problemas = [];
        if (r.paginacionHerramientas !== esperado) {
            problemas.push(`herramientas a la vista ${r.paginacionHerramientas} != ${esperado}`);
        }
        if (r.paginacionTotalVisible !== c.total) {
            problemas.push(`la celda del total ${r.paginacionTotalVisible ? 'se ve' : 'NO se ve'} y deberia ${c.total ? 'verse' : 'no verse'}`);
        }
        console.log(JSON.stringify({
            caso: c.nombre,
            herramientas: r.paginacionHerramientas,
            deReferencia: todas,
            totalVisible: r.paginacionTotalVisible,
            tarjetas: r.gids.length,
            estado: r.estado,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
