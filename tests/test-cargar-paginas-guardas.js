// Las guardas: los casos en los que NO se pide nada. Son la mitad que importa,
// porque un fallo aquí no se ve —el listado sale igual de bien— y lo que cambia
// es el tráfico y el momento en que sale.
//
// La última pareja es un control positivo/negativo del mismo mecanismo: con la
// casilla puesta, "recordar filtros" NO debe reaplicar la página guardada; con
// la casilla quitada, sí. Sin el segundo caso, el primero pasaría también si la
// reaplicación estuviera rota por cualquier otro motivo.
const { run, pageCells } = require('./harness');

const PAGES = { 1: pageCells(1, 4), 2: pageCells(2, 4), 3: pageCells(3, 3) };
const base = { current: 1, last: 3, pages: PAGES };

const CASOS = [
    {
        nombre: 'ruleta por girar',
        opts: { wheel: 'available' },
        peticiones: 0, estadoContiene: 'wheel'
    },
    {
        nombre: 'cola en curso (overlay de progreso abierto)',
        opts: { busy: true },
        peticiones: 0, estadoContiene: 'queue running'
    },
    {
        nombre: 'resultados de busqueda delante',
        opts: { search: true },
        // Calla a proposito: hablar de "3 paginas en una" sobre unos resultados
        // de busqueda que no se cargaron por paginas seria mentir.
        peticiones: 0, estadoContiene: ''
    },
    {
        nombre: 'casilla apagada',
        opts: { loadAllPages: false },
        peticiones: 0, estadoContiene: ''
    },
    {
        nombre: 'pagina guardada 3 + casilla puesta -> no la reaplica',
        opts: { rememberFilters: true, savedPage: 3 },
        peticiones: 2, estadoContiene: 'pages in one', cargador: 0
    },
    {
        nombre: 'pagina guardada 3 + casilla quitada -> si la reaplica (control)',
        opts: { rememberFilters: true, savedPage: 3, loadAllPages: false },
        // Se mira que INTENTE la 3, no cuantas llamadas hace: el cargador del
        // arnes no repinta el listado, asi que applyPage ve que no llego a la 3
        // y cae a la 1 —comportamiento correcto del script, artefacto del arnes—.
        peticiones: 0, estadoContiene: '', cargadorPrimero: '3'
    }
];

(async () => {
    const fallos = [];
    for (const c of CASOS) {
        const r = await run(Object.assign({}, base, c.opts));
        const problemas = [];
        if (r.peticiones.length !== c.peticiones) problemas.push(`peticiones ${r.peticiones.length} != ${c.peticiones}`);
        const est = r.estado || '';
        if (c.estadoContiene === '') {
            if (est !== '') problemas.push(`estado deberia estar vacio y dice "${est}"`);
        } else if (!est.toLowerCase().includes(c.estadoContiene.toLowerCase())) {
            problemas.push(`estado "${est}" no menciona "${c.estadoContiene}"`);
        }
        if (c.cargador != null && r.cargadorDelSitio.length !== c.cargador) {
            problemas.push(`cargador del sitio ${r.cargadorDelSitio.length} != ${c.cargador}`);
        }
        if (c.cargadorPrimero != null) {
            const primera = r.cargadorDelSitio[0] || '';
            if (!primera.includes('/ajax/' + c.cargadorPrimero + '/')) {
                problemas.push(`la primera llamada del cargador fue "${primera}", se esperaba la pagina ${c.cargadorPrimero}`);
            }
        }
        if (r.duplicados.length) problemas.push('duplicados: ' + r.duplicados.join(','));
        console.log(JSON.stringify({
            caso: c.nombre,
            peticiones: r.peticiones.length,
            tarjetas: r.gids.length,
            cargadorDelSitio: r.cargadorDelSitio,
            estado: r.estado,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
