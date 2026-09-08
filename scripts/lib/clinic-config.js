'use strict';

// Carga y validacion de `config/clinic.json`.
//
// Por que existe: el sitio pasa a ser white-label, y una configuracion
// incompleta no debe producir un sitio roto en silencio. El caso concreto
// que se quiere evitar es un `{{ contact.phone.href }}` sin resolver
// publicado como enlace muerto, o un `<title>` vacio.
//
// La validacion es explicita y sin dependencias: el stack no tiene
// validador de esquemas y no hace falta agregar uno para veinte campos.

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');
const RUTA_CONFIG = path.join(RAIZ, 'config', 'clinic.json');

class ConfigInvalidaError extends Error {
  constructor(problemas) {
    const detalle = problemas.map((p) => `  - ${p}`).join('\n');
    super(`config/clinic.json no es una configuracion valida:\n${detalle}`);
    this.name = 'ConfigInvalidaError';
    this.problemas = problemas;
  }
}

function esTextoUtil(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function obtener(objeto, ruta) {
  return ruta.split('.').reduce((acc, clave) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[clave];
  }, objeto);
}

// Campos de texto obligatorios. Si falta cualquiera de estos, el sitio
// queda con un hueco visible para el visitante.
const TEXTOS_OBLIGATORIOS = [
  'brand.name',
  'brand.tagline',
  'brand.description',
  'brand.shortDescription',
  'brand.footerText',
  'brand.logoIcon',
  'brand.favicon',
  'brand.appleTouchIcon',
  'contact.phone.display',
  'contact.phone.href',
  'contact.whatsapp.display',
  'contact.whatsapp.href',
  'contact.email',
  'contact.address.display',
  'contact.address.mapsUrl',
  'business.siteUrl',
  'business.locale',
  'business.openingHours',
  'legal.privacyPolicyVersion',
  'legal.updatedAt',
  'legal.privacyContactEmail',
  'legal.purpose',
  'legal.retention',
];

const IMAGENES_OBLIGATORIAS = ['hero', 'team', 'interior', 'social'];

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mismo formato que valida `api/leads.js` para
// `version_politica_privacidad`: cambiarlo aca sin cambiarlo alla
// romperia el envio del formulario.
const PATRON_VERSION = /^v\d+-\d{4}-\d{2}-\d{2}$/;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function validarConfig(config) {
  const problemas = [];

  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new ConfigInvalidaError(['la raiz debe ser un objeto JSON']);
  }

  for (const ruta of TEXTOS_OBLIGATORIOS) {
    if (!esTextoUtil(obtener(config, ruta))) {
      problemas.push(`falta el campo obligatorio '${ruta}' o esta vacio`);
    }
  }

  const email = obtener(config, 'contact.email');
  if (esTextoUtil(email) && !PATRON_EMAIL.test(email)) {
    problemas.push(`'contact.email' no parece una direccion de correo: '${email}'`);
  }

  const emailPrivacidad = obtener(config, 'legal.privacyContactEmail');
  if (esTextoUtil(emailPrivacidad) && !PATRON_EMAIL.test(emailPrivacidad)) {
    problemas.push(
      `'legal.privacyContactEmail' no parece una direccion de correo: '${emailPrivacidad}'`
    );
  }

  const siteUrl = obtener(config, 'business.siteUrl');
  if (esTextoUtil(siteUrl) && !/^https?:\/\/[^\s/]+/.test(siteUrl)) {
    problemas.push(`'business.siteUrl' debe ser una URL absoluta: '${siteUrl}'`);
  }
  if (esTextoUtil(siteUrl) && siteUrl.endsWith('/')) {
    problemas.push(
      `'business.siteUrl' no debe terminar en '/': quedaria una URL con doble barra ('${siteUrl}')`
    );
  }

  const version = obtener(config, 'legal.privacyPolicyVersion');
  if (esTextoUtil(version) && !PATRON_VERSION.test(version)) {
    problemas.push(
      `'legal.privacyPolicyVersion' debe tener la forma vN-AAAA-MM-DD (recibido: '${version}'). ` +
        'Es el valor que el formulario envia como version_politica_privacidad.'
    );
  }

  const actualizado = obtener(config, 'legal.updatedAt');
  if (esTextoUtil(actualizado) && !PATRON_FECHA.test(actualizado)) {
    problemas.push(`'legal.updatedAt' debe tener la forma AAAA-MM-DD (recibido: '${actualizado}')`);
  }

  if (typeof obtener(config, 'legal.demoMode') !== 'boolean') {
    problemas.push("'legal.demoMode' debe ser true o false");
  }

  // Año del aviso de copyright. Es un dato de configuracion y no
  // `new Date()` a proposito: el HTML generado se commitea, y derivarlo
  // del reloj haria que el build dejara de ser reproducible cada 1 de
  // enero.
  const anio = obtener(config, 'business.copyrightYear');
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2200) {
    problemas.push(
      `'business.copyrightYear' debe ser un año (entero entre 2000 y 2200), recibido: '${anio}'`
    );
  }

  // Con demoMode = false se declara publicamente un responsable del
  // tratamiento. Si esos datos faltan, la politica afirmaria tener un
  // responsable sin nombrarlo, que es peor que declararse demo.
  if (obtener(config, 'legal.demoMode') === false) {
    for (const campo of ['legalName', 'address']) {
      if (!esTextoUtil(obtener(config, `legal.controller.${campo}`))) {
        problemas.push(
          `con 'legal.demoMode' en false, 'legal.controller.${campo}' es obligatorio: ` +
            'la politica declara un responsable real y no puede dejarlo en blanco'
        );
      }
    }
  }

  // Iconos de marca: se referencian desde el `<head>` de las tres
  // paginas, y una ruta que no existe es un 404 en cada visita.
  const colores = obtener(config, 'brand.iconColors');
  if (colores === null || typeof colores !== 'object') {
    problemas.push("'brand.iconColors' debe ser un objeto con 'background' y 'foreground'");
  } else {
    for (const campo of ['background', 'foreground']) {
      const valor = colores[campo];
      if (!esTextoUtil(valor) || !/^#[0-9a-fA-F]{6}$/.test(valor)) {
        problemas.push(
          `'brand.iconColors.${campo}' debe ser un color hexadecimal de 6 digitos ` +
            `(recibido: '${valor}'). Lo usa scripts/build-branding-icons.py.`
        );
      }
    }
  }

  const imagenes = obtener(config, 'brand.images');
  if (imagenes === null || typeof imagenes !== 'object') {
    problemas.push("'brand.images' debe ser un objeto");
  } else {
    for (const clave of IMAGENES_OBLIGATORIAS) {
      const imagen = imagenes[clave];
      if (imagen === null || typeof imagen !== 'object') {
        problemas.push(`falta la imagen obligatoria 'brand.images.${clave}'`);
        continue;
      }
      if (!esTextoUtil(imagen.src)) {
        problemas.push(`'brand.images.${clave}.src' es obligatorio`);
      }
      // Un alt vacio es legitimo en una imagen decorativa, pero ninguna
      // de estas lo es: todas aportan informacion.
      if (!esTextoUtil(imagen.alt)) {
        problemas.push(
          `'brand.images.${clave}.alt' es obligatorio: sin texto alternativo la imagen ` +
            'queda inaccesible para quien usa lector de pantalla'
        );
      }
      for (const dimension of ['width', 'height']) {
        if (!Number.isInteger(imagen[dimension]) || imagen[dimension] <= 0) {
          problemas.push(
            `'brand.images.${clave}.${dimension}' debe ser un entero positivo: reserva el ` +
              'espacio de la imagen y evita que el layout salte al cargar'
          );
        }
      }
    }
  }

  const servicios = obtener(config, 'services');
  if (!Array.isArray(servicios) || servicios.length === 0) {
    problemas.push("'services' debe ser un arreglo con al menos un servicio");
  } else {
    const idsVistos = new Set();
    servicios.forEach((servicio, indice) => {
      const donde = `services[${indice}]`;
      if (servicio === null || typeof servicio !== 'object') {
        problemas.push(`${donde} debe ser un objeto`);
        return;
      }
      for (const campo of ['id', 'name', 'description', 'icon']) {
        if (!esTextoUtil(servicio[campo])) {
          problemas.push(`'${donde}.${campo}' es obligatorio`);
        }
      }
      if (esTextoUtil(servicio.id)) {
        if (idsVistos.has(servicio.id)) {
          problemas.push(`'${donde}.id' esta repetido: '${servicio.id}'`);
        }
        idsVistos.add(servicio.id);
      }
      if (!Number.isFinite(servicio.order)) {
        problemas.push(`'${donde}.order' debe ser un numero`);
      }
      for (const campo of ['visible', 'inForm']) {
        if (typeof servicio[campo] !== 'boolean') {
          problemas.push(`'${donde}.${campo}' debe ser true o false`);
        }
      }
    });

    const visibles = servicios.filter((s) => s && s.visible === true);
    if (visibles.length === 0) {
      problemas.push("ningun servicio tiene 'visible' en true: la seccion quedaria vacia");
    }
    const enFormulario = servicios.filter((s) => s && s.inForm === true);
    if (enFormulario.length === 0) {
      problemas.push(
        "ningun servicio tiene 'inForm' en true: el desplegable del formulario quedaria vacio"
      );
    }
  }

  const redes = obtener(config, 'business.socialNetworks');
  if (!Array.isArray(redes)) {
    problemas.push("'business.socialNetworks' debe ser un arreglo (puede estar vacio)");
  } else {
    redes.forEach((red, indice) => {
      const donde = `business.socialNetworks[${indice}]`;
      if (red === null || typeof red !== 'object') {
        problemas.push(`${donde} debe ser un objeto`);
        return;
      }
      for (const campo of ['name', 'icon', 'url']) {
        if (!esTextoUtil(red[campo])) {
          problemas.push(`'${donde}.${campo}' es obligatorio`);
        }
      }
    });
  }

  const proveedores = obtener(config, 'legal.providers');
  if (!Array.isArray(proveedores)) {
    problemas.push("'legal.providers' debe ser un arreglo (puede estar vacio)");
  } else {
    proveedores.forEach((proveedor, indice) => {
      const donde = `legal.providers[${indice}]`;
      if (proveedor === null || typeof proveedor !== 'object') {
        problemas.push(`${donde} debe ser un objeto`);
        return;
      }
      for (const campo of ['name', 'role']) {
        if (!esTextoUtil(proveedor[campo])) {
          problemas.push(`'${donde}.${campo}' es obligatorio`);
        }
      }
    });
  }

  if (problemas.length > 0) {
    throw new ConfigInvalidaError(problemas);
  }

  return config;
}

function leerConfig(ruta = RUTA_CONFIG) {
  let crudo;
  try {
    crudo = fs.readFileSync(ruta, 'utf8');
  } catch (err) {
    throw new ConfigInvalidaError([`no se pudo leer '${ruta}': ${err.message}`]);
  }

  let config;
  try {
    config = JSON.parse(crudo);
  } catch (err) {
    throw new ConfigInvalidaError([`'${ruta}' no es JSON valido: ${err.message}`]);
  }

  return validarConfig(config);
}

/** Servicios visibles, ordenados por `order`. */
function serviciosVisibles(config) {
  return config.services
    .filter((servicio) => servicio.visible === true)
    .slice()
    .sort((a, b) => a.order - b.order);
}

/** Servicios que aparecen en el desplegable del formulario. */
function serviciosDelFormulario(config) {
  return config.services
    .filter((servicio) => servicio.inForm === true)
    .slice()
    .sort((a, b) => a.order - b.order);
}

module.exports = {
  ConfigInvalidaError,
  RUTA_CONFIG,
  leerConfig,
  validarConfig,
  serviciosVisibles,
  serviciosDelFormulario,
};
