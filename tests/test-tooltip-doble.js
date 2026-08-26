// El tooltip propio y el del navegador NO pueden salir a la vez.
//
// El script dibuja su propia caja de aviso en los widgets, y para que no se vea
// además la del sistema le quita el `title` al control mientras la suya está
// arriba (lo guarda en un atributo y se lo devuelve al cerrarla). El fallo
// aparece cuando algo REESCRIBE ese `title` mientras tanto: el widget se repinta
// en cada pasada del observador, y cualquier `el.title = …` a pelo sobre un nodo
// que sobrevive al repintado devuelve el aviso del sistema encima del nuestro.
//
// Ya pasó dos veces —la cifra de saldo primero, la línea de la ruleta después—,
// y las dos se arreglan igual: escribiendo con setTipText(), que si la caja está
// arriba en ese control actualiza el escondite en vez del `title`.
//
// Control positivo: contra una copia con `el.title = …` este test tiene que
// FALLAR en `titleDespues`.
const { run, pageCells } = require('./harness');

const PAGES = { 1: pageCells(1, 4), 2: pageCells(2, 4), 3: pageCells(3, 3) };
const base = { current: 1, last: 3, pages: PAGES, loadAllPages: false };

// Los dos controles del widget que se repintan sin recrearse. El de la ruleta es
// el que se vio en pantalla; el de minimizar llevaba el mismo fallo latente.
const CASOS = [
    { nombre: 'línea de la cuenta atrás de la ruleta', sel: '#ig-bw-wheel' },
    { nombre: 'botón de minimizar el widget', sel: '#ig-bw-min' },
];

(async () => {
    const fallos = [];
    for (const c of CASOS) {
        const r = await run(Object.assign({}, base, { hover: c.sel }));
        const t = r.tooltip || {};
        const problemas = [];
        if (t.error) problemas.push(t.error);
        if (!t.cajaVisible) problemas.push('la caja propia no llegó a verse al apuntar');
        if (t.titleAntes != null) problemas.push(`el title seguía puesto al abrir la caja: "${t.titleAntes}"`);
        if (t.titleDespues != null) problemas.push(`TRAS EL REPINTADO volvió el title: "${t.titleDespues}" — saldrían los dos avisos`);
        if (!(t.textoCaja || '').trim()) problemas.push('la caja salió vacía');
        console.log(JSON.stringify({
            caso: c.nombre,
            cajaVisible: t.cajaVisible,
            titleAntes: t.titleAntes,
            titleDespues: t.titleDespues,
            textoCaja: t.textoCaja,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
