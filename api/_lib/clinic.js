'use strict';

// Acceso del backend al contenido publico configurable.
//
// Los correos transaccionales son superficie publica: los lee el paciente
// y los lee la clinica. La marca que aparece en ellos tiene que salir del
// mismo lugar que la del sitio, o instalar el proyecto para otra clinica
// dejaria los correos firmados con el nombre de la anterior. Eso ya paso
// con la marca de plantilla.
//
// `config/clinic.json` **no contiene secretos** y se sirve como archivo
// estatico: las credenciales siguen viviendo solo en variables de entorno
// (ver `.env.example`). Este modulo no debe leer ninguna.
//
// Se declara en `vercel.json` con `includeFiles` para que el archivo
// viaje en el bundle de la funcion serverless.

const configuracion = require('../../config/clinic.json');

/** Nombre comercial visible. Es el que firma los correos. */
function marca() {
  return configuracion.brand.name;
}

/** URL base publica del sitio, sin barra final. */
function urlDelSitio() {
  return configuracion.business.siteUrl;
}

module.exports = { configuracion, marca, urlDelSitio };
