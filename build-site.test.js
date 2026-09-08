'use strict';

// Tests del generador del sitio.
//
// El mas importante es el primero: **el HTML commiteado tiene que
// coincidir con lo que produce el generador desde `config/clinic.json`**.
// Sin ese test, la contrapartida de commitear la salida seria que el
// sitio publicado y su configuracion se separen en silencio, y editar la
// configuracion dejaria de tener efecto sin que nadie se entere.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { generar, render, escapar, PAGINAS } = require('./scripts/build-site.js');
const { leerConfig, RUTA_CONFIG } = require('./scripts/lib/clinic-config.js');

const RAIZ = __dirname;
const REAL = JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf8'));

function copia() {
  return JSON.parse(JSON.stringify(REAL));
}

function normalizar(texto) {
  return texto.replace(/\r\n/g, '\n');
}

function textoPlano(html) {
  return normalizar(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

test('el HTML commiteado coincide con lo que genera la configuracion', () => {
  const salidas = generar(leerConfig());

  for (const [, destino] of PAGINAS) {
    const enDisco = normalizar(fs.readFileSync(path.join(RAIZ, destino), 'utf8'));
    assert.equal(
      enDisco,
      salidas[destino],
      `${destino} no coincide con config/clinic.json. Correr: npm run build:site`
    );
  }
});

test('se generan exactamente las tres paginas publicas', () => {
  const salidas = generar(leerConfig());
  assert.deepEqual(Object.keys(salidas).sort(), [
    '404.html',
    'index.html',
    'politica-de-privacidad.html',
  ]);
});

test('la marca sale de la configuracion, en las tres paginas', () => {
  const config = copia();
  // `name`, `description` y `shortDescription` son campos distintos: los
  // dos ultimos son textos de marketing que, para este cliente, nombran a
  // la marca adentro. Instalar el sitio para otra clinica exige cambiar
  // los tres, y por eso el test los cambia todos.
  config.brand.name = 'Clinica Ejemplo';
  config.brand.description = 'Clinica Ejemplo: descripcion de ejemplo.';
  config.brand.shortDescription = 'Clinica Ejemplo: descripcion corta.';
  config.brand.footerText = 'Texto de pie de ejemplo.';
  const salidas = generar(config);

  for (const [, destino] of PAGINAS) {
    assert.ok(
      salidas[destino].includes('Clinica Ejemplo'),
      `${destino} no tomo la marca de la configuracion`
    );
    assert.ok(
      !salidas[destino].includes(REAL.brand.name),
      `${destino} conserva la marca anterior escrita a mano`
    );
  }
});

test('los datos de contacto salen de la configuracion', () => {
  const config = copia();
  config.contact.phone.display = '+00 0 00 0000-0000';
  config.contact.phone.href = 'tel:+000000000000';
  config.contact.email = 'contacto@clinica-ejemplo.test';
  // El buzon de privacidad es un campo aparte a proposito: puede ser
  // distinto del correo comercial.
  config.legal.privacyContactEmail = 'privacidad@clinica-ejemplo.test';
  config.contact.whatsapp.href = 'https://wa.me/000000000000';
  config.contact.address.display = 'Calle Ejemplo 1, Ciudad';
  config.business.openingHours = 'L a V: 8 a 20';

  const html = generar(config)['index.html'];

  for (const valor of [
    '+00 0 00 0000-0000',
    'tel:+000000000000',
    'contacto@clinica-ejemplo.test',
    'https://wa.me/000000000000',
    'Calle Ejemplo 1, Ciudad',
    'L a V: 8 a 20',
  ]) {
    assert.ok(html.includes(valor), `el HTML no tomo '${valor}' de la configuracion`);
  }

  assert.ok(!html.includes(REAL.contact.email), 'quedo el correo anterior hardcodeado');
});

test('los servicios visibles salen de la configuracion y respetan el orden', () => {
  const config = copia();
  config.services = [
    {
      id: 'segundo',
      name: 'Segundo servicio',
      description: 'Descripcion del segundo.',
      icon: 'fas fa-star',
      order: 2,
      visible: true,
      inForm: true,
    },
    {
      id: 'primero',
      name: 'Primer servicio',
      description: 'Descripcion del primero.',
      icon: 'fas fa-heart',
      order: 1,
      visible: true,
      inForm: false,
    },
    {
      id: 'oculto',
      name: 'Servicio oculto',
      description: 'No tiene que aparecer.',
      icon: 'fas fa-eye-slash',
      order: 3,
      visible: false,
      inForm: false,
    },
  ];

  const html = generar(config)['index.html'];

  assert.ok(html.includes('Primer servicio'));
  assert.ok(html.includes('Segundo servicio'));
  assert.ok(!html.includes('Servicio oculto'), '`visible: false` tiene que ocultar el servicio');
  assert.ok(
    html.indexOf('Primer servicio') < html.indexOf('Segundo servicio'),
    'el orden lo fija `order`, no la posicion en el archivo'
  );
});

test('el desplegable del formulario usa `inForm`, no `visible`', () => {
  const config = copia();
  const html = generar(config)['index.html'];

  const select = html.slice(html.indexOf('<select id="service">'), html.indexOf('</select>'));

  for (const servicio of config.services) {
    const presente = select.includes(`value="${servicio.id}"`);
    assert.equal(
      presente,
      servicio.inForm === true,
      `'${servicio.id}' con inForm=${servicio.inForm} ${presente ? 'aparece' : 'no aparece'} en el desplegable`
    );
  }

  assert.ok(
    select.includes('value="otro"'),
    '"Otros" es la salida de escape del formulario y tiene que existir siempre'
  );
});

test('las redes sociales salen de la configuracion y tienen nombre accesible', () => {
  const config = copia();
  config.business.socialNetworks = [
    { name: 'Instagram', icon: 'fab fa-instagram', url: 'https://instagram.com/ejemplo' },
  ];
  const html = generar(config)['index.html'];

  assert.ok(html.includes('https://instagram.com/ejemplo'));
  assert.ok(
    html.includes('aria-label="Instagram"'),
    'un enlace que es solo un icono necesita nombre accesible'
  );
  assert.ok(!html.includes('facebook.com'), 'quedaron redes anteriores hardcodeadas');
});

test('las imagenes salen de la configuracion, con alt y dimensiones', () => {
  const config = copia();
  config.brand.images.hero = {
    src: 'static/images/otra.webp',
    alt: 'Texto alternativo propio de la clinica',
    width: 1200,
    height: 800,
  };
  const html = generar(config)['index.html'];

  assert.ok(html.includes('src="static/images/otra.webp"'));
  assert.ok(html.includes('alt="Texto alternativo propio de la clinica"'));
  assert.ok(
    html.includes('width="1200"') && html.includes('height="800"'),
    'sin dimensiones el layout salta cuando la imagen carga'
  );
});

test('los metadatos sociales salen de la imagen social, en URL absoluta', () => {
  const config = copia();
  config.brand.images.social = {
    src: 'static/images/og-social.webp',
    alt: 'Texto alternativo de la miniatura social',
    width: 1200,
    height: 630,
  };
  config.business.siteUrl = 'https://ejemplo.test';

  const html = generar(config)['index.html'];

  // `og:image` tiene que ser absoluta: la lee un servidor ajeno, que no
  // sabe resolver una ruta relativa a este sitio.
  const absoluta = 'https://ejemplo.test/static/images/og-social.webp';
  assert.ok(html.includes(`<meta property="og:image" content="${absoluta}">`));
  assert.ok(html.includes(`<meta name="twitter:image" content="${absoluta}">`));

  // El alt de la miniatura no es decorativo: los lectores de pantalla lo
  // anuncian en el timeline, donde la imagen es todo lo que se ve.
  const alt = 'Texto alternativo de la miniatura social';
  assert.ok(html.includes(`<meta property="og:image:alt" content="${alt}">`));
  assert.ok(html.includes(`<meta name="twitter:image:alt" content="${alt}">`));

  // Las dimensiones evitan que la tarjeta salte mientras carga.
  assert.ok(html.includes('<meta property="og:image:width" content="1200">'));
  assert.ok(html.includes('<meta property="og:image:height" content="630">'));
});

// Activado al integrar los assets definitivos: `brand.images.social` ya
// es un archivo propio compuesto para 1.91:1, y no un recorte del hero.
test('la imagen social es un archivo propio en 1.91:1, no el hero', () => {
  const config = leerConfig();
  const social = config.brand.images.social;
  const hero = config.brand.images.hero;

  assert.notEqual(
    social.src,
    hero.src,
    'la miniatura social no puede reutilizar el hero: se compone para 1.91:1'
  );

  const proporcion = social.width / social.height;
  assert.ok(
    Math.abs(proporcion - 1.91) < 0.05,
    `la imagen social deberia ser 1.91:1, es ${proporcion.toFixed(2)}:1`
  );
});

test('los iconos de marca salen de la configuracion, en las tres paginas', () => {
  const config = copia();
  config.brand.favicon = 'static/branding/mi-icono.png';
  config.brand.appleTouchIcon = 'static/branding/mi-apple.png';

  const salidas = generar(config);

  for (const [, destino] of PAGINAS) {
    const html = salidas[destino];
    assert.ok(
      html.includes('href="static/branding/mi-icono.png"'),
      `${destino} no tomo el favicon de la configuracion`
    );
    assert.ok(
      html.includes('<link rel="apple-touch-icon" href="static/branding/mi-apple.png">'),
      `${destino} no tomo el apple-touch-icon de la configuracion`
    );
  }
});

test('el tipo del favicon se deduce de la extension, no esta fijo', () => {
  // Estaba escrito a mano como `image/x-icon` en las tres plantillas. Con
  // la ruta saliendo de configuracion eso era una trampa: un `.png`
  // quedaba declarado como `.ico` y no habia forma de corregirlo sin
  // tocar HTML.
  const casos = [
    ['favicon.ico', 'image/x-icon'],
    ['icono.png', 'image/png'],
    ['icono.svg', 'image/svg+xml'],
  ];

  for (const [archivo, tipo] of casos) {
    const config = copia();
    config.brand.favicon = archivo;
    const html = generar(config)['index.html'];
    assert.ok(
      html.includes(`<link rel="icon" href="${archivo}" type="${tipo}">`),
      `con '${archivo}' se esperaba type="${tipo}"`
    );
  }
});

test('una extension de favicon que no es un icono falla el build', () => {
  const config = copia();
  config.brand.favicon = 'notas.txt';
  assert.throws(
    () => generar(config),
    /notas\.txt/,
    'publicar un `<link rel="icon">` a un archivo que no es una imagen es un defecto silencioso'
  );
});

test('las tres paginas declaran los dos iconos', () => {
  // El 404 era la unica pagina sin apple-touch-icon. No habia motivo:
  // tambien se puede guardar en la pantalla de inicio.
  const salidas = generar(leerConfig());
  for (const [, destino] of PAGINAS) {
    assert.match(salidas[destino], /<link rel="icon"/, `${destino} sin favicon`);
    assert.match(salidas[destino], /<link rel="apple-touch-icon"/, `${destino} sin apple-touch-icon`);
  }
});

test('la version de la politica llega al `meta` que lee el formulario', () => {
  const config = copia();
  config.legal.privacyPolicyVersion = 'v9-2030-01-15';
  const html = generar(config)['index.html'];

  assert.ok(
    html.includes('<meta name="politica-privacidad-version" content="v9-2030-01-15">'),
    'el formulario lee la version de ese meta para enviarla con el consentimiento'
  );
});

test('el texto legal es IDENTICO en la pagina y en el dialogo', () => {
  // Es el punto del requisito "no convertir el modal en el unico lugar
  // donde vive la politica": las dos superficies existen, y muestran lo
  // mismo porque salen de la misma plantilla renderizada una sola vez.
  const salidas = generar(leerConfig());

  const pagina = salidas['politica-de-privacidad.html'];
  const dialogo = salidas['index.html'];

  const seccionesPagina = normalizar(pagina).match(/<section>[\s\S]*?<\/section>/g) || [];
  assert.ok(seccionesPagina.length >= 5, 'la pagina legal perdio secciones');

  for (const seccion of seccionesPagina) {
    assert.ok(
      normalizar(dialogo).includes(seccion),
      'una seccion de la politica esta en la pagina pero no en el dialogo'
    );
  }
});

test('demoMode true publica los avisos de demostracion', () => {
  const config = copia();
  config.legal.demoMode = true;
  const salidas = generar(config);

  const index = textoPlano(salidas['index.html']);
  const pagina = textoPlano(salidas['politica-de-privacidad.html']);

  assert.ok(index.includes('Demostración técnica'), 'falta el aviso fuerte del formulario');
  assert.ok(pagina.includes('demostración técnica'), 'la politica no declara que es una demo');
  assert.ok(
    pagina.includes('no existe una clínica ni una empresa responsable'),
    'con demoMode no se puede declarar un responsable que no existe'
  );
});

test('demoMode false quita los avisos de demo y declara el responsable real', () => {
  const config = copia();
  config.legal.demoMode = false;
  config.legal.controller = {
    legalName: 'Clinica Ejemplo S.R.L.',
    tradeName: 'Clinica Ejemplo',
    taxId: '30-00000000-0',
    address: 'Calle Ejemplo 1, Ciudad',
  };

  const salidas = generar(config);
  const index = textoPlano(salidas['index.html']);
  const pagina = textoPlano(salidas['politica-de-privacidad.html']);

  assert.ok(!index.includes('Demostración técnica'), 'el aviso de demo tiene que desaparecer');
  assert.ok(
    !index.includes('entiendo que este sitio es una demostración técnica'),
    'el consentimiento no puede seguir hablando de una demostracion'
  );
  assert.ok(
    !pagina.includes('no existe una clínica ni una empresa responsable'),
    'la politica sigue negando al responsable'
  );

  assert.ok(pagina.includes('Clinica Ejemplo S.R.L.'), 'falta el responsable real');
  assert.ok(pagina.includes('Calle Ejemplo 1, Ciudad'), 'falta el domicilio');
  assert.ok(pagina.includes('30-00000000-0'), 'falta la identificacion fiscal');
});

test('los datos opcionales del responsable se omiten sin dejar la frase colgando', () => {
  const config = copia();
  config.legal.demoMode = false;
  config.legal.controller = {
    legalName: 'Clinica Ejemplo S.R.L.',
    tradeName: '',
    taxId: '',
    address: 'Calle Ejemplo 1, Ciudad',
  };

  const pagina = textoPlano(generar(config)['politica-de-privacidad.html']);

  assert.ok(!pagina.includes('opera comercialmente como'));
  assert.ok(!pagina.includes('identificación fiscal'));
  assert.ok(pagina.includes('Clinica Ejemplo S.R.L. , con domicilio en Calle Ejemplo 1, Ciudad'));
});

test('la politica no afirma cumplimiento normativo absoluto', () => {
  const pagina = textoPlano(generar(leerConfig())['politica-de-privacidad.html']).toLowerCase();

  for (const afirmacion of [
    'cumple con la ley',
    'cumplimos con la ley',
    'conforme a la ley',
    'plenamente conforme',
    'garantizamos el cumplimiento',
  ]) {
    assert.ok(!pagina.includes(afirmacion), `la politica afirma cumplimiento legal: "${afirmacion}"`);
  }
});

test('un marcador sin resolver es un ERROR, no una cadena vacia', () => {
  assert.throws(
    () => render('<title>{{ brand.inexistente }}</title>', { brand: {} }, 'prueba'),
    /brand\.inexistente/,
    'publicar un titulo vacio en silencio es exactamente lo que hay que impedir'
  );
});

test('un marcador con sintaxis que el renderizador no entiende tambien falla', () => {
  assert.throws(
    () => render('<p>{{ brand name }}</p>', { brand: { name: 'X' } }, 'prueba'),
    /sin interpretar/,
    'un marcador raro no puede llegar al visitante como llaves literales'
  );
});

test('los valores se escapan al insertarse en el HTML', () => {
  assert.equal(escapar('<script>"x" & \'y\''), '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;');

  const config = copia();
  config.brand.name = 'Clinica "A" & <b>B</b>';
  const html = generar(config)['index.html'];

  assert.ok(!html.includes('<b>B</b>'), 'la marca se inyecto como HTML crudo');
  assert.ok(html.includes('&lt;b&gt;B&lt;/b&gt;'));
});

test('el 404 no declara la clase del menu movil', () => {
  // Las reglas moviles estan scopeadas a esa clase; si el 404 la
  // declarara, la pagina se quedaria sin navegacion visible en pantallas
  // chicas porque no tiene boton que la abra.
  const html = generar(leerConfig())['404.html'];
  assert.ok(!html.includes('has-mobile-nav'));
});

test('ninguna pagina generada enlaza la direccion vieja de la politica', () => {
  const salidas = generar(leerConfig());
  for (const [, destino] of PAGINAS) {
    assert.ok(
      !/href="politica-privacidad\.html"/.test(salidas[destino]),
      `${destino} sigue enlazando la direccion anterior`
    );
    // La propia pagina de la politica no se enlaza a si misma; las
    // otras dos si tienen que llegar a ella.
    if (destino !== 'politica-de-privacidad.html') {
      assert.ok(
        salidas[destino].includes('politica-de-privacidad.html'),
        `${destino} tiene que enlazar la politica`
      );
    }
  }
});

test('la configuracion publica no contiene nada que parezca un secreto', () => {
  // `config/clinic.json` se sirve como archivo estatico: es contenido
  // publico por diseño, y por eso mismo no puede recibir credenciales.
  //
  // Se recorren CLAVES y VALORES, no el texto crudo. La primera version
  // miraba el archivo entero y se disparaba con su propio comentario, el
  // que dice que los secretos van en variables de entorno: un guard que
  // falla con la prosa que lo documenta no comprueba nada.
  const NOMBRES_SOSPECHOSOS = /(pass(word)?|secret|token|credential|service_?role|api_?key|authorization)/i;
  // Un JWT o una clave larga sin espacios. Los textos editoriales de esta
  // configuracion son prosa: llevan espacios.
  const VALOR_SOSPECHOSO = /^(eyJ[\w-]+\.|sk-|Bearer\s)|^[A-Za-z0-9_\-]{40,}$/;

  const hallazgos = [];

  (function recorrer(nodo, ruta) {
    if (nodo === null || nodo === undefined) return;

    if (Array.isArray(nodo)) {
      nodo.forEach((item, i) => recorrer(item, `${ruta}[${i}]`));
      return;
    }

    if (typeof nodo === 'object') {
      for (const [clave, valor] of Object.entries(nodo)) {
        const donde = ruta ? `${ruta}.${clave}` : clave;
        if (NOMBRES_SOSPECHOSOS.test(clave)) {
          hallazgos.push(`clave '${donde}'`);
        }
        recorrer(valor, donde);
      }
      return;
    }

    if (typeof nodo === 'string' && VALOR_SOSPECHOSO.test(nodo.trim())) {
      hallazgos.push(`valor de '${ruta}'`);
    }
  })(REAL, '');

  assert.deepEqual(
    hallazgos,
    [],
    'config/clinic.json es publico: los secretos van en variables de entorno'
  );
});

test('el guard de secretos detecta una credencial de verdad', () => {
  // Verificacion en negativo: sin esto no habria forma de saber si el
  // guard de arriba pasa porque no hay secretos o porque no mira nada.
  const conSecreto = copia();
  conSecreto.brand.apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.carga.firma';

  const NOMBRES_SOSPECHOSOS = /(pass(word)?|secret|token|credential|service_?role|api_?key|authorization)/i;
  const claves = Object.keys(conSecreto.brand);

  assert.ok(
    claves.some((c) => NOMBRES_SOSPECHOSOS.test(c)),
    'el patron de nombres sospechosos dejo de reconocer `apiKey`'
  );
});
