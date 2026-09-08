'use strict';

// Generador del sitio: `config/clinic.json` + `templates/` -> HTML de la
// raiz del repositorio.
//
// DECISION DE ARQUITECTURA (ver docs/tecnica/arquitectura.md): el HTML
// generado SE COMMITEA y es lo que Vercel sirve. **No se agrega un paso
// de build al deploy.** Si este script desapareciera manana, el sitio
// seguiria funcionando exactamente igual; lo que se perderia es la
// capacidad de reconfigurarlo sin tocar HTML.
//
// La contrapartida de commitear la salida es que puede quedar
// desincronizada de la configuracion. Eso lo cubre un test que regenera
// en memoria y compara contra el archivo commiteado
// (`build-site.test.js`).
//
//   node scripts/build-site.js            escribe los archivos
//   node scripts/build-site.js --check    no escribe; falla si hay drift

const fs = require('node:fs');
const path = require('node:path');

const {
  leerConfig,
  serviciosVisibles,
  serviciosDelFormulario,
} = require('./lib/clinic-config.js');

const RAIZ = path.resolve(__dirname, '..');
const PLANTILLAS = path.join(RAIZ, 'templates');
const PARCIALES = path.join(PLANTILLAS, 'partials');

/** Paginas a generar: plantilla -> archivo de salida en la raiz. */
const PAGINAS = [
  ['index.html', 'index.html'],
  ['politica-de-privacidad.html', 'politica-de-privacidad.html'],
  ['404.html', '404.html'],
];

/**
 * Compara y escribe siempre con `\n`.
 *
 * En Windows `core.autocrlf` deja CRLF en el arbol de trabajo, mientras
 * que el generador produce LF. Sin normalizar, la verificacion de drift
 * diria que TODO el archivo cambio en Windows y nada en Linux: seria un
 * test que falla segun el sistema operativo, no segun el contenido.
 */
function normalizarSaltos(texto) {
  return texto.replace(/\r\n/g, '\n');
}

function escapar(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function obtener(contexto, ruta) {
  return ruta.split('.').reduce((acc, clave) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[clave];
  }, contexto);
}

/**
 * Sustituye `{{{ ruta }}}` (crudo) y `{{ ruta }}` (escapado).
 *
 * Una ruta que no exista es un ERROR, no una cadena vacia: publicar un
 * `<title>` vacio o un `href` roto en silencio es exactamente lo que
 * este generador tiene que impedir.
 */
function render(plantilla, contexto, origen) {
  const faltantes = [];

  let salida = plantilla.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, ruta) => {
    const valor = obtener(contexto, ruta);
    if (valor === undefined || valor === null) {
      faltantes.push(ruta);
      return '';
    }
    return String(valor);
  });

  salida = salida.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, ruta) => {
    const valor = obtener(contexto, ruta);
    if (valor === undefined || valor === null) {
      faltantes.push(ruta);
      return '';
    }
    return escapar(valor);
  });

  if (faltantes.length > 0) {
    const unicos = Array.from(new Set(faltantes));
    throw new Error(
      `${origen}: hay marcadores sin resolver, la configuracion no los define:\n` +
        unicos.map((r) => `  - {{ ${r} }}`).join('\n')
    );
  }

  // Un `{{` que sobrevive al reemplazo significa que la plantilla tiene
  // una expresion que este renderizador no entiende. Publicarla seria
  // mostrarle llaves al visitante.
  const resto = salida.match(/\{\{[^}]*\}\}/);
  if (resto) {
    throw new Error(`${origen}: quedo un marcador sin interpretar: '${resto[0]}'`);
  }

  return salida;
}

function leerParcial(nombre) {
  return normalizarSaltos(fs.readFileSync(path.join(PARCIALES, nombre), 'utf8'));
}

/** Bloque `<picture>`/`<img>` de una imagen de configuracion. */
function bloqueImagen(imagen, opciones = {}) {
  const atributos = [
    `src="${escapar(imagen.src)}"`,
    `alt="${escapar(imagen.alt)}"`,
    `width="${imagen.width}"`,
    `height="${imagen.height}"`,
    'loading="lazy"',
    'decoding="async"',
  ];
  if (opciones.style) {
    atributos.push(`style="${escapar(opciones.style)}"`);
  }
  return `<img ${atributos.join(' ')}>`;
}

function bloqueServicios(config) {
  return serviciosVisibles(config)
    .map((servicio) => {
      const partes = [
        '                    <div class="service-card" data-servicio="' + escapar(servicio.id) + '">',
        '                        <div class="service-icon"><i class="' + escapar(servicio.icon) + '"></i></div>',
        '                        <h3>' + escapar(servicio.name) + '</h3>',
        '                        <p>' + escapar(servicio.description) + '</p>',
        '                    </div>',
      ];
      return partes.join('\n');
    })
    .join('\n');
}

function bloqueOpcionesServicio(config) {
  const opciones = serviciosDelFormulario(config).map((servicio) => {
    const etiqueta = servicio.formName || servicio.name;
    return (
      '                                    <option value="' +
      escapar(servicio.id) +
      '">' +
      escapar(etiqueta) +
      '</option>'
    );
  });
  // "Otros" no es un servicio de la clinica: es la salida de escape del
  // formulario, y tiene que existir aunque la configuracion no la
  // declare.
  opciones.push('                                    <option value="otro">Otros</option>');
  return opciones.join('\n');
}

function bloqueRedes(config) {
  return config.business.socialNetworks
    .map((red) => {
      return (
        '                        <a href="' +
        escapar(red.url) +
        '" style="color: white; font-size: 1.2rem;" target="_blank" rel="noopener noreferrer" aria-label="' +
        escapar(red.name) +
        '"><i class="' +
        escapar(red.icon) +
        '" aria-hidden="true"></i></a>'
      );
    })
    .join('\n');
}

function bloqueDestinatarioPrincipal(config) {
  const correo = escapar(config.legal.privacyContactEmail);
  if (config.legal.demoMode) {
    return (
      '<li>Quien mantiene esta demostración técnica, a través del buzón ' +
      `<a href="mailto:${correo}">${correo}</a>, que recibe el aviso de cada solicitud enviada.</li>`
    );
  }
  return (
    '<li>El equipo de ' +
    escapar(config.brand.name) +
    ', que recibe el aviso de cada solicitud enviada y es quien se comunica con vos.</li>'
  );
}

function bloqueProveedores(config) {
  return config.legal.providers
    .map((proveedor) => {
      return '<li>' + escapar(proveedor.name) + ', ' + escapar(proveedor.role) + '.</li>';
    })
    .join('\n        ');
}

/**
 * Renderiza el texto legal completo, UNA sola vez.
 *
 * La misma cadena se inserta en la pagina `/politica-de-privacidad` y en
 * el dialogo del formulario. No pueden divergir porque no hay dos
 * fuentes.
 */
function bloquePolitica(config, contextoBase) {
  const contexto = Object.assign({}, contextoBase);
  contexto.bloques = Object.assign({}, contextoBase.bloques);

  contexto.bloques.politicaAvisoDemo = config.legal.demoMode
    ? render(leerParcial('politica-aviso-demo.html'), contexto, 'partials/politica-aviso-demo.html')
    : '';

  // Datos opcionales del responsable: si no estan, la frase se cierra
  // sola en vez de quedar con una coma colgando.
  const controlador = config.legal.controller || {};
  contexto.bloques.politicaResponsableNombreComercial =
    !config.legal.demoMode && controlador.tradeName
      ? ', que opera comercialmente como ' + escapar(controlador.tradeName)
      : '';
  contexto.bloques.politicaResponsableIdentificacion =
    !config.legal.demoMode && controlador.taxId
      ? ', identificación fiscal ' + escapar(controlador.taxId)
      : '';

  const parcialResponsable = config.legal.demoMode
    ? 'politica-responsable-demo.html'
    : 'politica-responsable-real.html';
  contexto.bloques.politicaResponsable = render(
    leerParcial(parcialResponsable),
    contexto,
    'partials/' + parcialResponsable
  );

  contexto.bloques.politicaDestinatarioPrincipal = bloqueDestinatarioPrincipal(config);
  contexto.bloques.politicaProveedores = bloqueProveedores(config);

  return render(leerParcial('politica-cuerpo.html'), contexto, 'partials/politica-cuerpo.html');
}

/** Construye el contexto completo y devuelve `{ archivo: contenido }`. */
function generar(config) {
  const imagenes = config.brand.images;

  const contexto = {
    brand: config.brand,
    contact: config.contact,
    business: config.business,
    legal: config.legal,
    meta: { anio: config.business.copyrightYear },
    bloques: {
      servicios: bloqueServicios(config),
      opcionesServicio: bloqueOpcionesServicio(config),
      redes: bloqueRedes(config),
      imagenHero: bloqueImagen(imagenes.hero),
      imagenEquipo: bloqueImagen(imagenes.team),
      imagenInterior: bloqueImagen(imagenes.interior, { style: 'border-radius: 20px;' }),
      // En el 404 la imagen esta oculta a proposito: la pagina es un
      // mensaje corto y la foto solo agregaria peso.
      imagenHero404: bloqueImagen(imagenes.hero, { style: 'display: none;' }),
      avisoDemoFormulario: config.legal.demoMode
        ? leerParcial('aviso-demo-formulario.html').trimEnd()
        : '',
      consentimientoDemo: config.legal.demoMode
        ? ' y entiendo que este sitio es una demostración técnica'
        : '',
    },
  };

  contexto.bloques.politica = bloquePolitica(config, contexto);

  const salidas = {};
  for (const [plantilla, destino] of PAGINAS) {
    const crudo = normalizarSaltos(fs.readFileSync(path.join(PLANTILLAS, plantilla), 'utf8'));
    salidas[destino] = render(crudo, contexto, 'templates/' + plantilla);
  }
  return salidas;
}

function main(argv) {
  const soloVerificar = argv.includes('--check');
  const config = leerConfig();
  const salidas = generar(config);

  const desincronizados = [];
  for (const [destino, contenido] of Object.entries(salidas)) {
    const ruta = path.join(RAIZ, destino);
    const actual = fs.existsSync(ruta) ? normalizarSaltos(fs.readFileSync(ruta, 'utf8')) : null;

    if (soloVerificar) {
      if (actual !== contenido) desincronizados.push(destino);
      continue;
    }

    if (actual === contenido) {
      console.log(`  = ${destino} (sin cambios)`);
      continue;
    }
    fs.writeFileSync(ruta, contenido, 'utf8');
    console.log(`  > ${destino} generado`);
  }

  if (soloVerificar) {
    if (desincronizados.length > 0) {
      console.error(
        'El HTML commiteado NO coincide con config/clinic.json:\n' +
          desincronizados.map((d) => `  - ${d}`).join('\n') +
          '\nCorrer: npm run build:site'
      );
      process.exitCode = 1;
      return;
    }
    console.log('El HTML commiteado coincide con config/clinic.json.');
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = { generar, render, escapar, PAGINAS };
