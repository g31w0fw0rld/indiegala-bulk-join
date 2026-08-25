// El aviso de "hay ruleta por girar": lo que se ve, lo que se queda y lo que ya
// no bloquea. Hasta 1.10.0 esto era un window.alert(), que congela la página
// —cola y vigilante incluidos— y que con la pestaña en segundo plano ni se ve
// ni suena; justo el momento en el que el vigilante trabaja.
//
// Se comprueban EFECTOS OBSERVABLES: el <title> de la pestaña, los toasts en
// pie y las llamadas a alert(). El sonido NO se prueba aquí: jsdom no tiene
// Web Audio ni reproduce nada, así que cualquier aserción sobre él mediría el
// arnés. Lo que sí se prueba es que el aviso no depende de que suene.
//
// El caso "sin ruleta" es el control negativo: sin él, una marca puesta SIEMPRE
// pasaría los mismos asertos que una marca puesta cuando toca.
//
// Control positivo (obligatorio para creerse esto):
//   IG_SCRIPT=/ruta/al/1.10.0/indiegala-bulk-join.user.js node test-aviso-ruleta.js
// tiene que FALLAR, con alert() llamado y sin marca en el título.
const { run, pageCells } = require('./harness');

const PAGES = { 1: pageCells(1, 4), 2: pageCells(2, 4), 3: pageCells(3, 3) };
const base = { current: 1, last: 3, pages: PAGES };
const MARCA = '🎡';
const TITULO_SITIO = 'IndieGala Giveaways';

const CASOS = [
    {
        nombre: 'ruleta por girar: marca en el titulo, toast que se queda, ningun alert',
        opts: { wheel: 'available' },
        // El toast normal dura 4,5 s y el arnés espera 5: si a estas alturas
        // sigue en pie es porque se pidió que no se fuera solo.
        titulo: MARCA + ' ' + TITULO_SITIO,
        toastContiene: 'Wheel of Fortune',
        pegajosos: 1,
        alertas: 0
    },
    {
        nombre: 'sin ruleta (control): titulo intacto y ningun aviso',
        opts: { wheel: 'baseline' },
        titulo: TITULO_SITIO,
        toastContiene: null,
        pegajosos: 0,
        alertas: 0
    },
    {
        nombre: 'el sitio reescribe el titulo: la marca vuelve, sobre el titulo nuevo',
        // 8 s de espera para dar margen al vigilante, que mira cada 3 s.
        opts: { wheel: 'available', retitulo: { ms: 1000, texto: 'Otra cosa' }, waitMs: 8000 },
        titulo: MARCA + ' Otra cosa',
        toastContiene: 'Wheel of Fortune',
        pegajosos: 1,
        alertas: 0
    }
];

(async () => {
    const fallos = [];
    for (const c of CASOS) {
        const r = await run(Object.assign({}, base, c.opts));
        const problemas = [];
        if (r.titulo !== c.titulo) problemas.push(`titulo "${r.titulo}" != "${c.titulo}"`);
        if (r.alertas.length !== c.alertas) problemas.push(`alert() llamado ${r.alertas.length} veces (esperaba ${c.alertas})`);
        if (r.toastsPegajosos !== c.pegajosos) problemas.push(`toasts que no se van solos: ${r.toastsPegajosos} != ${c.pegajosos}`);
        const texto = r.toasts.join(' | ');
        if (c.toastContiene === null) {
            if (r.toasts.length) problemas.push(`no deberia haber toast y hay: "${texto}"`);
        } else if (!texto.includes(c.toastContiene)) {
            problemas.push(`el toast "${texto}" no menciona "${c.toastContiene}"`);
        }
        console.log(JSON.stringify({
            caso: c.nombre,
            titulo: r.titulo,
            toasts: r.toasts,
            toastsPegajosos: r.toastsPegajosos,
            alertas: r.alertas,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
