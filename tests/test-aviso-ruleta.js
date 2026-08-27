// El aviso de "hay ruleta por girar": los TRES canales, y ninguno más.
//
// El alert() dio dos vueltas antes de asentarse, y las dos por datos: se quitó
// en 1.10.1 por bloqueante y volvió en 1.10.2 cuando la consola demostró que el
// sonido no podía sonar (`NotAllowedError: play() failed because the user didn't
// interact with the document first`). En 1.10.5 se probó a quitarlo otra vez,
// apoyándose en el sonido y luego en `GM_notification`, y ninguna de las dos
// sirvió: el beep no suena en una pestaña que no has tocado —que es justo la que
// hay que avisar— y la notificación del sistema no se quería (además cambiaba de
// pestaña). El sonido se quitó entero. Por eso aquí se afirma que el alert() SÍ
// se llama y que la notificación NO: cada caso impide una de las dos vueltas
// atrás que ya se dieron.
//
// Se comprueban EFECTOS OBSERVABLES: el <title>, los toasts en pie, las llamadas
// a alert() —y el título EN EL INSTANTE de esa llamada—, la cuenta atrás del
// widget y las notificaciones del sistema.
//
// El caso "sin ruleta" es el control negativo: sin él, una marca puesta SIEMPRE
// pasaría los mismos asertos que una marca puesta cuando toca.
//
// Control positivo (obligatorio para creerse esto):
//   IG_SCRIPT=/ruta/al/1.10.2/indiegala-bulk-join.user.js node test-aviso-ruleta.js
// tiene que FALLAR: esa versión sí llamaba a alert().
const { run, pageCells } = require('./harness');

const PAGES = { 1: pageCells(1, 4), 2: pageCells(2, 4), 3: pageCells(3, 3) };
const base = { current: 1, last: 3, pages: PAGES };
const MARCA = '🎡';
const TITULO_SITIO = 'IndieGala Giveaways';

const CASOS = [
    {
        nombre: 'ruleta por girar: marca en el titulo antes del alert, toast que se queda',
        opts: { wheel: 'available' },
        // El toast normal dura 4,5 s y el arnés espera 5: si a estas alturas
        // sigue en pie es porque se pidió que no se fuera solo.
        titulo: MARCA + ' ' + TITULO_SITIO,
        toastContiene: 'Wheel of Fortune',
        pegajosos: 1,
        // El alert() congela el hilo: lo que no esté pintado antes no se ve
        // hasta cerrarlo. `marcaAlAlertar` fotografía el <title> en ese instante,
        // que es la única forma de distinguir «la marca se puso antes» de «se
        // puso después» — las dos dejan el mismo título al final.
        alertas: 1,
        marcaAlAlertar: true,
        notificaciones: 0,
        // Con ruleta delante, la línea NO cuenta atrás: dice que está aquí.
        lineaContiene: 'available now',
        lineaAvisando: true
    },
    {
        nombre: 'sin ruleta (control): titulo intacto, ningun aviso, ningun alert y cuenta atras',
        opts: { wheel: 'baseline' },
        titulo: TITULO_SITIO,
        toastContiene: null,
        pegajosos: 0,
        alertas: 0,
        marcaAlAlertar: false,
        notificaciones: 0,
        // El control negativo del contador: sin ruleta cuenta, y cuenta algo
        // —«3h 12m (18:00)»—, no una plantilla con los {v} sin sustituir.
        lineaContiene: 'Next wheel in',
        lineaAvisando: false,
        lineaFormato: /Next wheel in (?:\d+h \d{2}m|\d+m) \(.+\)$/
    },
    {
        nombre: 'el sitio reescribe el titulo: la marca vuelve, sobre el titulo nuevo',
        // 8 s de espera para dar margen al vigilante, que mira cada 3 s.
        opts: { wheel: 'available', retitulo: { ms: 1000, texto: 'Otra cosa' }, waitMs: 8000 },
        titulo: MARCA + ' Otra cosa',
        toastContiene: 'Wheel of Fortune',
        pegajosos: 1,
        alertas: 1,
        marcaAlAlertar: true,
        notificaciones: 0,
        lineaContiene: 'available now',
        lineaAvisando: true
    }
];

(async () => {
    const fallos = [];
    for (const c of CASOS) {
        const r = await run(Object.assign({}, base, c.opts));
        const problemas = [];
        if (r.titulo !== c.titulo) problemas.push(`titulo "${r.titulo}" != "${c.titulo}"`);
        if (r.alertas.length !== c.alertas) problemas.push(`alert() llamado ${r.alertas.length} veces (esperaba ${c.alertas})`);
        if (c.marcaAlAlertar) {
            const t = r.tituloAlAlertar || '';
            if (t.indexOf(MARCA + ' ') !== 0) problemas.push(`al alertar el titulo era "${t}": la marca no estaba puesta todavia`);
        }
        if (c.alertas > 0 && !(r.alertas[0] || '').includes('Wheel of Fortune')) {
            problemas.push(`el alert() dice "${r.alertas[0]}" y no menciona la ruleta`);
        }
        if (r.toastsPegajosos !== c.pegajosos) problemas.push(`toasts que no se van solos: ${r.toastsPegajosos} != ${c.pegajosos}`);
        if (r.notificaciones.length !== c.notificaciones) problemas.push(`notificaciones del sistema: ${r.notificaciones.length} != ${c.notificaciones} (se descartaron a proposito)`);
        if (c.lineaContiene != null) {
            const linea = r.lineaRuleta || '';
            if (!linea.includes(c.lineaContiene)) problemas.push(`la linea de ruleta dice "${linea}" y no menciona "${c.lineaContiene}"`);
            if (r.lineaRuletaAvisando !== c.lineaAvisando) problemas.push(`la linea ${r.lineaRuletaAvisando ? 'avisa' : 'no avisa'} y deberia ser al reves`);
            if (c.lineaFormato && !c.lineaFormato.test(linea)) problemas.push(`la linea "${linea}" no tiene la forma esperada`);
        }
        const texto = r.toasts.join(' | ');
        if (c.toastContiene === null) {
            if (r.toasts.length) problemas.push(`no deberia haber toast y hay: "${texto}"`);
        } else if (!texto.includes(c.toastContiene)) {
            problemas.push(`el toast "${texto}" no menciona "${c.toastContiene}"`);
        }
        console.log(JSON.stringify({
            caso: c.nombre,
            titulo: r.titulo,
            lineaRuleta: r.lineaRuleta,
            toasts: r.toasts,
            toastsPegajosos: r.toastsPegajosos,
            alertas: r.alertas.length,
            tituloAlAlertar: r.tituloAlAlertar,
            notificaciones: r.notificaciones,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
