'use strict';

// Tests de la validacion de `config/clinic.json`.
//
// El requisito: una configuracion incompleta no debe producir
// silenciosamente un sitio roto. Estos tests comprueban que **falla**, y
// que el mensaje nombra el campo: un error que dice "configuracion
// invalida" y nada mas obliga a adivinar.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ConfigInvalidaError,
  RUTA_CONFIG,
  leerConfig,
  validarConfig,
  serviciosVisibles,
  serviciosDelFormulario,
} = require('./scripts/lib/clinic-config.js');

const REAL = JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf8'));

/** Copia profunda de la configuracion real, para romperla sin efectos. */
function copia() {
  return JSON.parse(JSON.stringify(REAL));
}

/** Valida y devuelve la lista de problemas; falla si NO hubo error. */
function problemasAlValidar(config) {
  try {
    validarConfig(config);
  } catch (err) {
    assert.ok(err instanceof ConfigInvalidaError, `error inesperado: ${err}`);
    return err.problemas;
  }
  assert.fail('la configuracion invalida paso la validacion');
}

function mencionan(problemas, fragmento) {
  return problemas.some((p) => p.includes(fragmento));
}

test('la configuracion real del repositorio es valida', () => {
  const config = leerConfig();
  assert.equal(typeof config.brand.name, 'string');
});

test('faltar un campo obligatorio falla, y el mensaje lo nombra', () => {
  const rutas = [
    ['brand', 'name'],
    ['brand', 'tagline'],
    ['contact', 'phone', 'display'],
    ['contact', 'email'],
    ['business', 'siteUrl'],
    ['legal', 'privacyPolicyVersion'],
    ['legal', 'privacyContactEmail'],
  ];

  for (const ruta of rutas) {
    const config = copia();
    let nodo = config;
    for (const clave of ruta.slice(0, -1)) nodo = nodo[clave];
    delete nodo[ruta[ruta.length - 1]];

    const problemas = problemasAlValidar(config);
    assert.ok(
      mencionan(problemas, ruta.join('.')),
      `al faltar '${ruta.join('.')}' el error no lo nombra: ${problemas.join(' | ')}`
    );
  }
});

test('un campo obligatorio en blanco cuenta como faltante', () => {
  const config = copia();
  config.brand.name = '   ';
  assert.ok(mencionan(problemasAlValidar(config), 'brand.name'));
});

test('un correo mal formado falla', () => {
  for (const campo of ['contact.email', 'legal.privacyContactEmail']) {
    const config = copia();
    const [grupo, clave] = campo.split('.');
    config[grupo][clave] = 'esto-no-es-un-correo';
    assert.ok(mencionan(problemasAlValidar(config), campo));
  }
});

test('la URL del sitio tiene que ser absoluta y sin barra final', () => {
  const relativa = copia();
  relativa.business.siteUrl = '/mi-clinica';
  assert.ok(mencionan(problemasAlValidar(relativa), 'absoluta'));

  const conBarra = copia();
  conBarra.business.siteUrl = 'https://ejemplo.test/';
  const problemas = problemasAlValidar(conBarra);
  assert.ok(
    mencionan(problemas, "no debe terminar en '/'"),
    'una barra final produce URLs con doble barra en Open Graph'
  );
});

test('la version de la politica tiene que respetar el formato que valida la API', () => {
  const config = copia();
  config.legal.privacyPolicyVersion = '2026-09-08';
  const problemas = problemasAlValidar(config);
  assert.ok(mencionan(problemas, 'privacyPolicyVersion'));
  assert.ok(
    mencionan(problemas, 'version_politica_privacidad'),
    'el mensaje tiene que explicar que ese valor lo envia el formulario'
  );
});

test('demoMode tiene que ser booleano, no una cadena', () => {
  const config = copia();
  config.legal.demoMode = 'true';
  assert.ok(mencionan(problemasAlValidar(config), 'demoMode'));
});

test('con demoMode en false, el responsable real es obligatorio', () => {
  const config = copia();
  config.legal.demoMode = false;
  config.legal.controller = { legalName: '', tradeName: '', taxId: '', address: '' };

  const problemas = problemasAlValidar(config);
  assert.ok(mencionan(problemas, 'legal.controller.legalName'));
  assert.ok(mencionan(problemas, 'legal.controller.address'));
});

test('con demoMode en false y responsable completo, la config es valida', () => {
  const config = copia();
  config.legal.demoMode = false;
  config.legal.controller = {
    legalName: 'Clinica Ejemplo S.R.L.',
    tradeName: 'Clinica Ejemplo',
    taxId: '30-00000000-0',
    address: 'Calle Falsa 123, Ciudad',
  };
  assert.doesNotThrow(() => validarConfig(config));
});

test('una imagen sin texto alternativo falla', () => {
  const config = copia();
  config.brand.images.hero.alt = '';
  const problemas = problemasAlValidar(config);
  assert.ok(mencionan(problemas, 'brand.images.hero.alt'));
  assert.ok(
    mencionan(problemas, 'lector de pantalla'),
    'el mensaje tiene que decir por que importa'
  );
});

test('una imagen sin dimensiones falla', () => {
  const config = copia();
  delete config.brand.images.team.width;
  assert.ok(mencionan(problemasAlValidar(config), 'brand.images.team.width'));
});

test('faltar una imagen obligatoria falla', () => {
  const config = copia();
  delete config.brand.images.interior;
  assert.ok(mencionan(problemasAlValidar(config), 'brand.images.interior'));
});

test('dos servicios con el mismo id fallan', () => {
  const config = copia();
  config.services[1].id = config.services[0].id;
  assert.ok(mencionan(problemasAlValidar(config), 'esta repetido'));
});

test('un servicio sin nombre o sin descripcion falla', () => {
  for (const campo of ['name', 'description', 'icon']) {
    const config = copia();
    config.services[0][campo] = '';
    assert.ok(mencionan(problemasAlValidar(config), `services[0].${campo}`));
  }
});

test('sin servicios visibles la seccion quedaria vacia, y eso falla', () => {
  const config = copia();
  config.services.forEach((s) => {
    s.visible = false;
  });
  assert.ok(mencionan(problemasAlValidar(config), 'visible'));
});

test('sin servicios en el formulario el desplegable quedaria vacio, y eso falla', () => {
  const config = copia();
  config.services.forEach((s) => {
    s.inForm = false;
  });
  assert.ok(mencionan(problemasAlValidar(config), 'inForm'));
});

test('el año del copyright no puede ser una cadena', () => {
  const config = copia();
  config.business.copyrightYear = '2026';
  assert.ok(mencionan(problemasAlValidar(config), 'copyrightYear'));
});

test('una red social incompleta falla', () => {
  const config = copia();
  delete config.business.socialNetworks[0].url;
  assert.ok(mencionan(problemasAlValidar(config), 'socialNetworks[0].url'));
});

test('un JSON invalido falla con un mensaje que lo dice', () => {
  const ruta = path.join(
    fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'clinic-config-')),
    'clinic.json'
  );
  fs.writeFileSync(ruta, '{ esto no es json }', 'utf8');

  try {
    leerConfig(ruta);
    assert.fail('un JSON roto no puede pasar');
  } catch (err) {
    assert.ok(err instanceof ConfigInvalidaError);
    assert.ok(err.problemas.some((p) => p.includes('no es JSON valido')));
  }
});

test('un archivo inexistente falla con un mensaje que lo dice', () => {
  try {
    leerConfig(path.join(__dirname, 'no-existe', 'clinic.json'));
    assert.fail('deberia haber fallado');
  } catch (err) {
    assert.ok(err instanceof ConfigInvalidaError);
    assert.ok(err.problemas.some((p) => p.includes('no se pudo leer')));
  }
});

test('el error acumula TODOS los problemas, no solo el primero', () => {
  const config = copia();
  delete config.brand.name;
  delete config.contact.email;
  config.legal.demoMode = 'si';

  const problemas = problemasAlValidar(config);
  assert.ok(problemas.length >= 3, `esperaba varios problemas, hubo ${problemas.length}`);
  assert.ok(mencionan(problemas, 'brand.name'));
  assert.ok(mencionan(problemas, 'contact.email'));
  assert.ok(mencionan(problemas, 'demoMode'));
});

test('los servicios se ordenan por `order`, no por el orden del archivo', () => {
  const config = copia();
  config.services[0].order = 99;

  const visibles = serviciosVisibles(config);
  assert.equal(visibles[visibles.length - 1].id, config.services[0].id);
});

test('`visible` e `inForm` son independientes', () => {
  const config = copia();
  const enFormulario = serviciosDelFormulario(config).map((s) => s.id);
  const visibles = serviciosVisibles(config).map((s) => s.id);

  assert.notDeepEqual(
    enFormulario,
    visibles,
    'la configuracion de ejemplo tiene que ejercitar la diferencia entre ambos'
  );
});
