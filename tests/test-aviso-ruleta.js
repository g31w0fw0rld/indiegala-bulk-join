// El aviso de "hay ruleta por girar": que llegue por los canales que no
// interrumpen, y por NINGUNO que sí.
//
// El alert() dio dos vueltas antes de irse del todo, y las dos por datos: se
// quitó en 1.10.1 por bloqueante, volvió en 1.10.2 cuando la consola demostró
// que el sonido no podía sonar —`NotAllowedError: play() failed because the user
// didn't interact with the document first`—, y se fue definitivamente al quitar
// la recarga del vigilante, que era justo lo que impedía sonar. Por eso el caso
// de «ningún alert()» NO es cosmético: es lo que impide que vuelva sin querer.
//
// Se comprueban EFECTOS OBSERVABLES: el <title>, los toasts en pie, las llamadas
// a alert() y la cuenta atrás del widget. El sonido NO se prueba: jsdom no
// reproduce nada, así que cualquier aserción sobre él mediría el arnés.
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
        nombre: 'ruleta por girar: marca en el titulo, toast que se queda, ningun alert',
        opts: { wheel: 'available' },
        // El toast normal dura 4,5 s y el arnés espera 5: si a estas alturas
        // sigue en pie es porque se pidió que no se fuera solo.
        titulo: MARCA + ' ' + TITULO_SITIO,
        toastContiene: 'Wheel of Fortune',
        pegajosos: 1,
        alertas: 0,
        // Con ruleta delante, la línea NO cuenta atrás: dice que está aquí.
        lineaContiene: 'available now',
        lineaAvisando: true
    },
    {
        nombre: 'sin ruleta (control): titulo intacto, ningun aviso y cuenta atras',
        opts: { wheel: 'baseline' },
        titulo: TITULO_SITIO,
        toastContiene: null,
        pegajosos: 0,
        alertas: 0,
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
        alertas: 0,
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
        if (r.toastsPegajosos !== c.pegajosos) problemas.push(`toasts que no se van solos: ${r.toastsPegajosos} != ${c.pegajosos}`);
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
            alertas: r.alertas,
            veredicto: problemas.length ? 'FALLA' : 'ok',
            problemas
        }, null, 1));
        if (problemas.length) fallos.push(c.nombre + ': ' + problemas.join(' · '));
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO DEL ARNES', e); process.exit(1); });
