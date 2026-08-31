// La tarjeta sin portada, y que su hueco se pueda pulsar.
//
// Indiegala pide la cabecera de Steam con SU sufijo,
// .../apps/<appid>_ig/header.jpg, que en el CDN de Steam no existe (404 en los
// siete appids probados el 2026-08-31), asi que muchas tarjetas se quedan con el
// placeholder gris de "no image" que el sitio pinta como background de la
// <figure>. Lo que se reporto no es el placeholder: es que ese hueco NO responde
// al clic, y su CSS explica por que —
//   .items-list-item figure a   { display: block }
//   .items-list-item figure img { width: 100%; height: auto }
// el alto del ancla lo daba la imagen, y con la imagen rota mide 0 px.
//
// Se comprueba lo que hace el script, que es SOLO eso:
//   1. La figura se marca y su enlace recupera el alto, apuntando al detalle.
//   2. El <img> roto se esconde CON !important, o Chrome pinta su texto
//      alternativo encima del placeholder — se vio en pantalla, y una regla
//      normal de hoja no le gana al style.display en linea que escriben
//      revealListingImages() y el asyncImgLoader del sitio.
//   3. Una portada que carga desmarca su figura (la red de seguridad).
//
// Y se comprueba lo que el script NO hace, que es igual de importante porque
// llego a hacerlo y se quito a proposito (ver el comentario de
// handleImageFailure): NO se toca la URL de la imagen. Recuperar la portada se
// descarto el 2026-08-31 — el sufijo se puede quitar pero es mantener una ruta
// ajena, y para los appids nuevos (>~3,9 M) Steam solo sirve la cabecera bajo un
// hash que unicamente conoce su API, que no manda CORS. Este caso es lo que
// impide que vuelva sin querer.
//
// Lo que este arnes NO puede medir: el alto de verdad. jsdom no hace layout.
// Se afirma que las reglas estan en la hoja y con que valor; que 100% de una
// <figure> de alto fijo son 116/120 px es una afirmacion sobre el navegador, no
// algo que jsdom demuestre.
const { run, pageCells } = require('./harness.js');

const fallos = [];
function ok(cond, msg, extra) {
    if (!cond) fallos.push(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
}
const conSufijo = p => /\/apps\/\d+_ig\/header\.jpg$/.test(p || '');

(async () => {
    // ---- Caso 1: portada que falla -> hueco clicable ----
    const r1 = await run({
        current: 1, last: 1, pages: { 1: pageCells(1, 3) },
        loadAllPages: false, imgSuffix: true, revelarPortadas: true,
        erroresPorImagen: 1, waitMs: 2000
    });
    ok(r1.portadas.length === 3, 'esperaba 3 portadas', r1.portadas.length);
    ok(r1.portadas.every(p => p.sinImagen),
        'la figura de una portada que fallo tenia que quedar marcada', r1.portadas);
    ok(r1.portadas.every(p => /^\/giveaways\/card\/[^/]+\/\d+$/.test(p.href || '')),
        'y el enlace del hueco tiene que apuntar al detalle del giveaway',
        r1.portadas.map(p => p.href));
    ok(/height:\s*100%/.test(r1.reglaSinImagen || ''),
        'la hoja tiene que devolverle alto al ancla', r1.reglaSinImagen);
    ok(/display:\s*none\s*!important/.test(r1.reglaImagenRota || ''),
        'y esconder el <img> roto CON !important, o el texto alternativo sale encima '
        + '(el sitio escribe style.display en linea y una regla normal no le gana)',
        r1.reglaImagenRota);

    // ---- Caso 2: la URL NO se toca ----
    // Es lo que pinea la decision de no rescatar portadas: el sufijo `_ig` que
    // manda Indiegala tiene que seguir tal cual, en los dos atributos.
    ok(r1.portadas.every(p => conSufijo(p.src)),
        'el src tiene que quedarse como lo manda Indiegala, sin reescribir',
        r1.portadas.map(p => p.src));
    ok(r1.portadas.every(p => conSufijo(p.dataSrc)),
        'y data-img-src igual', r1.portadas.map(p => p.dataSrc));

    // ---- Caso 3: red de seguridad. Un 'load' desmarca la figura ----
    const r2 = await run({
        current: 1, last: 1, pages: { 1: pageCells(1, 3) },
        loadAllPages: false, imgSuffix: true, revelarPortadas: true,
        erroresPorImagen: 2, cargaPortadasAlFinal: true, waitMs: 2000
    });
    ok(r2.portadas.every(p => !p.sinImagen),
        'la portada acabo cargando: su figura tenia que quedar desmarcada', r2.portadas);

    // ---- Caso 4: idempotencia ----
    // El barrido corre en CADA pasada del observador, y el sitio repone el `src`
    // desde `data-img-src` en cada fragmento. Diez vueltas no deben degradar nada.
    const r3 = await run({
        current: 1, last: 1, pages: { 1: pageCells(1, 2) },
        loadAllPages: false, imgSuffix: true, revelarPortadas: true,
        erroresPorImagen: 10, revelarEnCadaVuelta: true, waitMs: 2000
    });
    ok(r3.portadas.every(p => p.sinImagen && conSufijo(p.src)),
        'ni la marca ni la URL cambian con vueltas de mas', r3.portadas);

    // ---- Caso 5: una portada que carga bien no se toca ----
    const r4 = await run({
        current: 1, last: 1, pages: { 1: pageCells(1, 3) },
        loadAllPages: false, imgSuffix: false, revelarPortadas: true,
        erroresPorImagen: 0, waitMs: 2000
    });
    ok(r4.portadas.every(p => !p.sinImagen),
        'una portada que no fallo no se marca', r4.portadas);

    if (fallos.length) {
        console.log('FALLOS:');
        fallos.forEach(f => console.log(' - ' + f));
        process.exit(1);
    }
    console.log('TODO OK');
})();
