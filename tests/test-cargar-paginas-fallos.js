// Qué pasa cuando el sitio no colabora. Lo que se exige en los tres casos es lo
// mismo: **parar y decirlo**, sin dejar el listado con filas repetidas ni
// fingiendo que se cargó todo. Un fallo silencioso aquí es el peor de todos,
// porque el listado parece completo y no lo está.
const { run, pageCells } = require('./harness');

const PAGES = { 1: pageCells(1, 4), 2: pageCells(2, 4), 3: pageCells(3, 3) };
const base = { current: 1, last: 3, pages: PAGES };
const P1 = PAGES[1].map(x => x.gid);
const P12 = P1.concat(PAGES[2].map(x => x.gid));

const CASOS = [
    {
        nombre: 'la primera que pide devuelve HTTP 500',
        opts: { serve: { 2: 500 } },
        // Para en seco: no sigue con la 3. Pedirla despues de un 500 seria
        // insistirle a un servidor que acaba de fallar.
        peticiones: 1, gids: P1, estadoContiene: 'Page 2 failed'
    },
    {
        nombre: 'falla la segunda que pide (la primera ya entro)',
        opts: { serve: { 3: 500 } },
        peticiones: 2, gids: P12, estadoContiene: 'Page 3 failed'
    },
    {
        nombre: 'el servidor sirve otra pagina de la pedida',
        opts: { serve: { 2: { current_page: 9 } } },
        // Se descarta entera: mejor una pagina de menos que veinte filas de
        // otra pagina colocadas donde no van.
        peticiones: 1, gids: P1, estadoContiene: 'Page 2 failed'
    },
    {
        nombre: 'el servidor contesta status distinto de ok',
        opts: { serve: { 2: { status: 'ko' } } },
        peticiones: 1, gids: P1, estadoContiene: 'Page 2 failed'
    }
];

(async () => {
    const fallos = [];
    for (const c of CASOS) {
        const r = await run(Object.assign({}, base, c.opts));
        const problemas = [];
        if (r.peticiones.length !== c.peticiones) problemas.push(`peticiones ${r.peticiones.length} != ${c.peticiones}`);
        if (r.gids.join(',') !== c.gids.join(',')) problemas.push(`listado ${r.gids.join(',')} != ${c.gids.join(',')}`);
        if (r.duplicados.length) problemas.push('duplicados: ' + r.duplicados.join(','));
        const est = r.estado || '';
        if (!est.includes(c.estadoContiene)) problemas.push(`estado "${est}" no dice "${c.estadoContiene}"`);
        if (!r.estadoVisible) problemas.push('la linea de estado no se ve');
        console.log(JSON.stringify({
            caso: c.nombre,
            peticiones: r.peticiones,
            gids: r.gids.join(','),
            estado: r.estado,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
