'use strict';

const crypto = require('crypto');

// Contrato completo de esta feature en
// runs/15-observabilidad-y-operacion/spec.md y en
// docs/tecnica/observabilidad-y-operacion.md.
//
// REGLA DURA DE ESTE MODULO, no negociable:
//
//   La defensa primaria contra fugas es la LISTA BLANCA de campos de este
//   archivo, no la sanitizacion. `emitir()` descarta toda clave que no
//   este declarada en CAMPOS y todo valor que no pase el validador de su
//   campo. Ningun campo del esquema acepta texto libre.
//
//   Esta explicitamente prohibido que participen de un log — o de un
//   hash — los siguientes: `err.message`, `PostgrestError.details`,
//   `.hint`, la query, el payload, `err.response` (respuesta SMTP
//   completa), objetos `Error` serializados, stack traces, headers,
//   cookies y variables de entorno. `metadatosDeError()` es el UNICO
//   punto que toca un error, y lee exclusivamente tres propiedades
//   acotadas por protocolo: `name`, `code` y `responseCode`.
//
//   Si en el futuro se agrega un campo de texto libre a CAMPOS, esta
//   garantia se degrada. No agregar ninguno.

const NIVEL_A_CANAL = {
  info: 'log',
  warn: 'warn',
  error: 'error',
};

const NIVEL_POR_DEFECTO = 'info';

// Token seguro: solo alfanumericos, `_`, `-` y `.`. Un email nunca
// sobrevive a este patron (contiene `@`), ni una frase (contiene
// espacios): el valor se reemplaza por 'no_valido' en lugar de
// truncarse, para no dejar pasar fragmentos.
const PATRON_TOKEN = /^[A-Za-z0-9_.-]{1,64}$/;
const PATRON_HASH = /^[0-9a-f]{16}$/;
const PATRON_LEAD_ID = /^[0-9a-fA-F-]{1,64}$/;

const VALOR_NO_VALIDO = 'no_valido';
const CAMPO_NO_PERMITIDO = 'no_permitido';

// Campos del lead cuyo NOMBRE puede aparecer en un log. Nunca su valor.
// El caso `propiedad_desconocida` del endpoint devuelve al cliente una
// clave arbitraria tomada del JSON entrante (texto controlado por quien
// llama, y vector de log injection): por eso `campo` se valida contra
// esta lista y cae a 'no_permitido' si no esta.
const CAMPOS_DE_LEAD_PERMITIDOS = [
  'nombre',
  'email',
  'telefono',
  'servicio',
  'mensaje',
  'version_politica_privacidad',
];

// Codigos de error que el endpoint devuelve en el body. Dominio cerrado.
const CODIGOS_DE_ERROR_API = [
  'metodo_no_permitido',
  'origen_no_permitido',
  'demasiadas_solicitudes',
  'content_type_invalido',
  'payload_demasiado_grande',
  'json_invalido',
  'propiedad_desconocida',
  'solicitud_rechazada',
  'campo_requerido_faltante',
  'tipo_invalido',
  'longitud_excedida',
  'formato_email_invalido',
  'formato_telefono_invalido',
  'consentimiento_requerido',
  'error_interno',
];

const MOTIVOS_DE_RECHAZO = ['rate_limit', 'origen_no_permitido', 'antispam'];

const FLAGS_DE_NOTIFICACION = ['notificacion_clinica_enviada', 'confirmacion_paciente_enviada'];

// `req.method` lo controla quien llama. Se valida contra los metodos HTTP
// conocidos para que no entre texto arbitrario por esa via.
const METODOS_HTTP = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
];

function esEnteroNoNegativo(valor) {
  return Number.isInteger(valor) && valor >= 0;
}

function validarEnum(lista, valorNoValido = VALOR_NO_VALIDO) {
  return (valor) => (typeof valor === 'string' && lista.includes(valor) ? valor : valorNoValido);
}

function validarToken(valor) {
  if (typeof valor !== 'string') return VALOR_NO_VALIDO;
  const recortado = valor.trim();
  return PATRON_TOKEN.test(recortado) ? recortado : VALOR_NO_VALIDO;
}

function validarPatron(patron) {
  return (valor) => (typeof valor === 'string' && patron.test(valor) ? valor : VALOR_NO_VALIDO);
}

function validarEntero(valor) {
  if (esEnteroNoNegativo(valor)) return valor;
  const convertido = Number(valor);
  return esEnteroNoNegativo(convertido) ? convertido : null;
}

/**
 * Lista blanca de campos opcionales. El orden de estas claves es el orden
 * de serializacion, para que las lineas de log sean estables y
 * comparables entre eventos.
 *
 * Cada entrada es un validador: recibe el valor crudo y devuelve el valor
 * a loguear, o `null` para descartar el campo por completo.
 */
const CAMPOS = {
  lead_id: validarPatron(PATRON_LEAD_ID),
  ip_hash: validarPatron(PATRON_HASH),
  metodo: validarEnum(METODOS_HTTP),
  http_status: validarEntero,
  error: validarEnum(CODIGOS_DE_ERROR_API),
  campo: validarEnum(CAMPOS_DE_LEAD_PERMITIDOS, CAMPO_NO_PERMITIDO),
  motivo: validarEnum(MOTIVOS_DE_RECHAZO),
  flag: validarEnum(FLAGS_DE_NOTIFICACION),
  tipo: validarToken,
  codigo: validarToken,
  smtp_response_code: validarEntero,
  huella: validarPatron(PATRON_HASH),
  duracion_ms: validarEntero,
};

const NOMBRES_DE_CAMPOS = Object.keys(CAMPOS);

/**
 * Hash opaco de 16 hex (primeros 64 bits de un sha256). Se usa para
 * `ip_hash` y para la huella de agrupacion. No pretende ser una garantia
 * criptografica irreversible frente a un atacante con recursos para
 * probar un espacio de entrada acotado (ej. rangos de IP conocidos) —
 * misma limitacion ya asumida y documentada en la feature 04.
 */
function hashOpaco(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex').slice(0, 16);
}

/**
 * Identificador de correlacion de una invocacion. Se usa en todos los
 * eventos de esa request y NO se expone en la respuesta HTTP (decision
 * explicita del HITL 1: no alterar la superficie HTTP sin una necesidad
 * operativa demostrable).
 */
function crearRequestId() {
  return crypto.randomUUID();
}

/**
 * Huella de agrupacion de errores, construida EXCLUSIVAMENTE con
 * metadatos estructurados y seguros: `evento`, `tipo`, `codigo` y
 * `smtp_response_code`.
 *
 * Deliberadamente NO participa `err.message` ni ningun otro texto
 * potencialmente sensible (restriccion explicita del HITL 1). Sirve para
 * contar y agrupar recurrencias del mismo tipo de fallo, no para
 * reconstruir su contenido.
 */
function calcularHuella({ evento, tipo, codigo, smtp_response_code: smtpResponseCode }) {
  const partes = [
    validarToken(evento),
    typeof tipo === 'string' ? validarToken(tipo) : 'sin_tipo',
    typeof codigo === 'string' ? validarToken(codigo) : 'sin_codigo',
    esEnteroNoNegativo(smtpResponseCode) ? String(smtpResponseCode) : 'sin_response_code',
  ];
  return hashOpaco(partes.join('|'));
}

/**
 * Unico punto del sistema autorizado a mirar un error, y solo para
 * extraer metadatos de dominio acotado:
 *
 * - `tipo`: `err.name` (clase del error).
 * - `codigo`: `err.code` — SQLSTATE de Postgres (ej. '23505') o codigo de
 *   Nodemailer (ej. 'EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'EENVELOPE').
 * - `smtp_response_code`: `err.responseCode` (ej. 535, 550).
 *
 * NUNCA lee `message`, `details`, `hint`, `response`, `stack`, `query` ni
 * ninguna otra propiedad. El objeto de error no sale de esta funcion.
 *
 * @param {string} evento Nombre del evento, para ligar la huella al sitio.
 * @param {unknown} err Error de cualquier forma (puede no ser un Error).
 * @returns {{tipo: string, codigo: string, smtp_response_code?: number, huella: string}}
 */
function metadatosDeError(evento, err) {
  const fuente = err && typeof err === 'object' ? err : {};

  const tipo = typeof fuente.name === 'string' ? validarToken(fuente.name) : 'sin_tipo';
  const codigo = typeof fuente.code === 'string' ? validarToken(fuente.code) : 'sin_codigo';
  const smtpResponseCode = esEnteroNoNegativo(fuente.responseCode) ? fuente.responseCode : undefined;

  const metadatos = {
    tipo,
    codigo,
    huella: calcularHuella({ evento, tipo, codigo, smtp_response_code: smtpResponseCode }),
  };

  if (smtpResponseCode !== undefined) {
    metadatos.smtp_response_code = smtpResponseCode;
  }

  return metadatos;
}

/**
 * Emite una linea JSON estructurada al canal de consola correspondiente
 * al nivel. Vercel captura `stdout`/`stderr` de la funcion serverless
 * como Runtime Logs, de modo que una linea = un evento.
 *
 * Descarta toda clave que no este en CAMPOS y todo valor que su validador
 * rechace. Nunca lanza: un fallo del logger no debe alterar el resultado
 * de una request.
 */
function emitir(nivel, evento, campos = {}) {
  const nivelEfectivo = Object.prototype.hasOwnProperty.call(NIVEL_A_CANAL, nivel)
    ? nivel
    : NIVEL_POR_DEFECTO;

  const entrada = {
    timestamp: new Date().toISOString(),
    nivel: nivelEfectivo,
    evento: validarToken(evento),
    request_id: validarToken(campos && campos.request_id),
  };

  for (const nombre of NOMBRES_DE_CAMPOS) {
    if (!campos || campos[nombre] === undefined || campos[nombre] === null) {
      continue;
    }
    const valor = CAMPOS[nombre](campos[nombre]);
    if (valor !== null) {
      entrada[nombre] = valor;
    }
  }

  // eslint-disable-next-line no-console
  console[NIVEL_A_CANAL[nivelEfectivo]](JSON.stringify(entrada));
}

/**
 * Logger ligado a un `request_id`, para que los call sites no repitan la
 * correlacion en cada evento.
 *
 * @param {string} requestId
 */
function crearLogger(requestId) {
  const conRequestId = (campos) => Object.assign({}, campos, { request_id: requestId });

  return {
    requestId,
    info: (evento, campos) => emitir('info', evento, conRequestId(campos)),
    warn: (evento, campos) => emitir('warn', evento, conRequestId(campos)),
    error: (evento, campos) => emitir('error', evento, conRequestId(campos)),
  };
}

module.exports = {
  crearLogger,
  crearRequestId,
  emitir,
  hashOpaco,
  calcularHuella,
  metadatosDeError,
  // Exportados para los tests y para la documentacion del contrato.
  CAMPOS_DE_LEAD_PERMITIDOS,
  CODIGOS_DE_ERROR_API,
  NOMBRES_DE_CAMPOS,
};
