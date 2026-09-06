'use strict';

const { getSupabaseClient } = require('./_lib/supabase-client');
const {
  createTransporter,
  buildClinicNotificationEmail,
  buildPatientConfirmationEmail,
  enviarConReintento,
} = require('./_lib/mailer');
const { crearLogger, crearRequestId, hashOpaco, metadatosDeError } = require('./_lib/logger');

// Contrato completo de la feature 03 en runs/03-endpoint-recepcion-leads/
// spec.md y en docs/tecnica/endpoint-recepcion-leads.md. El contrato de
// esta feature (04) en runs/04-proteccion-antispam-y-abuso/spec.md y en
// docs/tecnica/proteccion-antispam-y-abuso.md. El contrato de esta
// feature (05) en runs/05-notificacion-clinica-smtp-ferozo/spec.md y en
// docs/tecnica/notificacion-clinica-smtp-ferozo.md. El contrato de esta
// feature (06) en runs/06-confirmacion-automatica-paciente/spec.md y en
// docs/tecnica/confirmacion-automatica-paciente.md. Los comentarios de
// este archivo solo señalan a que paso del "orden de evaluacion
// extendido" corresponde cada bloque, no repiten el contrato completo.

const ALLOWED_METHOD = 'POST';
const MAX_BODY_BYTES = 10 * 1024; // 10 KB (10240 bytes) — criterio 14 (f03)
const RATE_LIMIT_MAX_REQUESTS = 5; // criterio 18 (f03)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 segundos — criterio 18 (f03)
const MIN_FORM_FILL_MS = 3000; // 3 segundos — control temporal, criterio 9 (f04)
const DUPLICATE_WINDOW_MINUTES = 5; // ventana de idempotencia, criterio 12/13 (f04)

const ALLOWED_KEYS = [
  'nombre',
  'email',
  'telefono',
  'servicio',
  'mensaje',
  'consentimiento_privacidad',
  'version_politica_privacidad',
  // Campos nuevos de la feature 04 (antispam). Ver diseño puntos 2 y 3
  // del spec: ambos quedan FUERA de STRING_FIELDS a proposito (ver mas
  // abajo), su validacion de tipo es exclusiva del honeypot/control
  // temporal, nunca produce tipo_invalido.
  'sitio_web',
  'formulario_mostrado_en',
];

// Campos obligatorios evaluados en el paso 10 (criterio 7, f03). NO
// incluye consentimiento_privacidad (criterio 15/f03) ni los campos
// nuevos de la feature 04 (honeypot/control temporal, ambos opcionales).
const REQUIRED_STRING_FIELDS = ['nombre', 'email', 'version_politica_privacidad'];

// Campos que deben ser `string` cuando estan presentes, evaluados en el
// paso 10 (criterio 9, f03). NO incluye consentimiento_privacidad
// (criterio 9/f03 lo excluye explicitamente) NI `sitio_web` NI
// `formulario_mostrado_en` (criterios 7 y 11 de la feature 04: ambos
// quedan explicitamente excluidos de este arreglo por diseño — un valor
// no-string en cualquiera de los dos NUNCA debe producir `tipo_invalido`,
// su propia validacion vive en los pasos 8 y 9 respectivamente). No
// agregar ninguno de los dos aca bajo ninguna circunstancia.
const STRING_FIELDS = ['nombre', 'email', 'telefono', 'servicio', 'mensaje', 'version_politica_privacidad'];

// Campos opcionales (criterio 8, f03): ausentes o vacios tras trim() -> null.
const OPTIONAL_STRING_FIELDS = ['telefono', 'servicio', 'mensaje'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digitos, espacios, '+', '-', parentesis; longitud 6-30 ya impuesta por
// el propio patron (criterio 11/f03: format y longitud del telefono
// estan unificados en un unico chequeo).
const TELEFONO_PATTERN = /^[0-9+\-() ]{6,30}$/;

const LENGTHS = {
  nombre: { min: 2, max: 150 },
  email: { max: 254 },
  servicio: { max: 100 },
  mensaje: { max: 2000 },
  version_politica_privacidad: { min: 1, max: 50 },
};

class PayloadTooLargeError extends Error {}

// Rate limiter en memoria, best-effort, a nivel de modulo/proceso
// (criterio 18/f03): Map de IP -> { count, windowStart }. Documentado
// como provisional en docs/tecnica/endpoint-recepcion-leads.md — no
// persiste entre cold starts ni se comparte entre instancias serverless
// concurrentes (ver "Riesgos/supuestos" del spec de la f03 y de la f04:
// esta feature 04 decide explicitamente NO reemplazar este mecanismo por
// almacenamiento persistente/distribuido, ver decision.md).
const rateLimitStoreDefault = new Map();

/**
 * Extrae la IP del cliente desde `x-forwarded-for` (puede traer una
 * lista "cliente, proxy1, proxy2"; se toma el primer valor). Si el
 * header no esta presente, cae a `req.socket.remoteAddress` y, en
 * ultimo caso, a un valor fijo documentado.
 */
function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return 'ip-desconocida';
}

/**
 * Hash truncado (16 hex chars, primeros 64 bits de un sha256) de la IP,
 * usado exclusivamente en logs de rechazo (criterio 5/f04). Nunca
 * persiste la IP en texto plano. No pretende ser una garantia
 * criptografica irreversible frente a un atacante con recursos para
 * probar rangos de IP conocidos — ver "Riesgos / supuestos" del spec y
 * docs/tecnica/proteccion-antispam-y-abuso.md.
 */
function hashIp(ip) {
  return hashOpaco(ip);
}

/**
 * Emite un log estructurado de rechazo (criterio 5/15/f04), sin PII:
 * nunca nombre/email/telefono/mensaje/sitio_web ni la IP en texto plano,
 * solo `motivo` (uno de 'rate_limit' | 'origen_no_permitido' |
 * 'antispam') y el hash truncado de la IP.
 */
function logRejection(log, motivo, ip) {
  log.warn('lead_rechazado', { motivo, ip_hash: hashIp(ip) });
}

function checkRateLimit(store, ip, now) {
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    return { limited: false };
  }

  if (entry.count < RATE_LIMIT_MAX_REQUESTS) {
    entry.count += 1;
    return { limited: false };
  }

  const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

/**
 * Parsea `ALLOWED_ORIGINS` (lista separada por comas, criterio 17/f04)
 * en un arreglo de origenes ya recortados (`trim()`), descartando
 * entradas vacias. Tolera espacios alrededor de las comas (caso borde
 * explicito del spec).
 */
function parseAllowedOrigins(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Resuelve la configuracion de origenes permitidos desde `process.env`
 * en el momento de la solicitud (no se cachea a nivel de modulo, para
 * poder reflejar cambios de entorno entre invocaciones sin necesitar
 * reiniciar el proceso). `createHandler` permite inyectar un
 * `originConfig` fijo para tests (ver mas abajo).
 */
function resolveOriginConfigFromEnv() {
  return {
    siteUrl: process.env.SITE_URL,
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
    // VERCEL_URL la provee automaticamente la plataforma Vercel para el
    // propio deployment (Preview/Production); no definida en local/tests.
    vercelUrl: process.env.VERCEL_URL,
  };
}

/**
 * Origen efectivo de la solicitud (criterio 2/f04): el header `Origin`
 * si esta presente; si no, se deriva de `Referer` (protocolo + host); si
 * ninguno esta presente o `Referer` no es una URL parseable, se trata
 * como ausente (-> no permitido).
 */
function getEffectiveOrigin(req) {
  const originHeader = req.headers['origin'];
  if (typeof originHeader === 'string' && originHeader.trim().length > 0) {
    return originHeader.trim();
  }

  const refererHeader = req.headers['referer'];
  if (typeof refererHeader === 'string' && refererHeader.trim().length > 0) {
    try {
      const parsedUrl = new URL(refererHeader.trim());
      return `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch (err) {
      // Referer presente pero no es una URL parseable: tratado como
      // origen ausente (caso borde explicito del spec), no como
      // excepcion no controlada.
      return null;
    }
  }

  return null;
}

/**
 * Un origen se considera permitido si coincide EXACTAMENTE con
 * `SITE_URL`, alguna entrada de `ALLOWED_ORIGINS`, o
 * `https://${VERCEL_URL}` cuando esa variable esta definida (criterios
 * 2/3/4 de la feature 04).
 */
function isOriginAllowed(origin, originConfig) {
  if (!origin) {
    return false;
  }

  const { siteUrl, allowedOrigins, vercelUrl } = originConfig || {};
  const candidates = [];

  if (typeof siteUrl === 'string' && siteUrl.trim().length > 0) {
    candidates.push(siteUrl.trim());
  }
  if (Array.isArray(allowedOrigins)) {
    candidates.push(...allowedOrigins);
  }
  if (typeof vercelUrl === 'string' && vercelUrl.trim().length > 0) {
    candidates.push(`https://${vercelUrl.trim()}`);
  }

  return candidates.includes(origin);
}

/**
 * Escapa los caracteres especiales de un patron `ilike` de PostgREST
 * (`%`, `_`, `\`) antes de usarlos como valor literal en el chequeo de
 * duplicados (paso 11/f04). Sin este escape, un `email` que contuviera
 * `%` o `_` (tecnicamente valido segun EMAIL_PATTERN) actuaria como
 * comodin SQL y podria matchear de mas. No es un criterio de aceptacion
 * explicito del spec; es una decision de implementacion defensiva
 * documentada en docs/tecnica/proteccion-antispam-y-abuso.md.
 */
function escapeIlikeValue(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Extrae del builder de Supabase el endpoint efectivo contra el que se
 * hizo la consulta: SOLO `host` y `pathname`.
 *
 * REGLA DURA: el query string NO se lee nunca. La consulta de duplicados
 * lleva el email del paciente en la query (`email=ilike.…`), asi que
 * `search` es PII y no debe salir de aca bajo ninguna circunstancia. El
 * logger ademas lo rechazaria por patron, pero la defensa empieza aca:
 * lo que no se lee no se puede filtrar.
 *
 * Existe porque un 404 de Supabase no dice a QUE URL se llamo, y sin ese
 * dato no se puede distinguir "la tabla no existe" de "le estamos
 * pegando al host equivocado". Ver anexo F de
 * runs/16-validacion-mvp-produccion/test-report-2.md.
 *
 * Nunca lanza: un fallo aca no debe alterar el resultado de la request.
 */
function metadatosDeEndpoint(builder) {
  try {
    const url = new URL(String(builder.url));
    return { supabase_host: url.host, supabase_path: url.pathname };
  } catch (_) {
    return {};
  }
}

function sendJson(res, statusCode, body, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries(extraHeaders)) {
    res.setHeader(name, value);
  }
  res.end(JSON.stringify(body));
}

/**
 * Lee el body crudo del request como Buffer, cortando con
 * PayloadTooLargeError apenas se superan `maxBytes` — antes de intentar
 * ningun JSON.parse (criterio 14/f03: el auto body-parser de Vercel se
 * deshabilita via `module.exports.config`, ver el final de este
 * archivo, precisamente para que esta funcion pueda medir el tamaño
 * crudo del payload).
 */
function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    // Atajo: si el cliente declara un Content-Length mayor al limite,
    // cortamos sin esperar a que llegue el stream completo. No
    // reemplaza el conteo real (Content-Length puede faltar o mentir
    // con encoding chunked), que sigue siendo la fuente de verdad.
    const contentLengthHeader = req.headers['content-length'];
    if (contentLengthHeader !== undefined) {
      const declared = Number(contentLengthHeader);
      if (Number.isFinite(declared) && declared > maxBytes) {
        reject(new PayloadTooLargeError());
        return;
      }
    }

    let totalBytes = 0;
    const chunks = [];
    let settled = false;

    function cleanup() {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    }

    function onData(chunk) {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        settled = true;
        cleanup();
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(chunk);
    }

    function onEnd() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    }

    function onError(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

/**
 * Normaliza un campo opcional ya validado como tipo correcto (string,
 * null o undefined) en el paso 10: si no es un string no vacio tras
 * trim(), se trata como ausente -> null (criterio 8/f03). Se asume que
 * el valor ya paso el chequeo de tipos (cualquier otro tipo, ej.
 * numero/objeto/array, ya respondio tipo_invalido antes de llegar aca).
 */
function normalizeOptionalString(rawValue) {
  if (typeof rawValue !== 'string') {
    return null;
  }
  const trimmed = rawValue.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Fabrica del handler de `POST /api/leads`. Permite inyectar
 * dependencias para tests (criterio 23/f03: cliente Supabase
 * inyectable) y para poder testear rate limiting, origen y el limite de
 * tamaño de forma determinista, sin depender de temporizadores reales ni
 * de una instancia de proceso compartida entre tests.
 *
 * @param {object} [options]
 * @param {() => object} [options.supabaseClientFactory]
 * @param {Map} [options.rateLimitStore]
 * @param {() => number} [options.now]
 * @param {number} [options.maxBodyBytes]
 * @param {{siteUrl?: string, allowedOrigins?: string[], vercelUrl?: string}} [options.originConfig]
 *   Override de la configuracion de origenes permitidos (criterio 4/f04).
 *   Si se omite, se resuelve desde `process.env` en cada solicitud
 *   (`SITE_URL`, `ALLOWED_ORIGINS`, `VERCEL_URL`).
 * @param {() => { sendMail: (mailOptions: object) => Promise<unknown> }} [options.mailerFactory]
 *   Factory del transporter usado tanto para la notificacion a la
 *   clinica (criterio 5/f05) como para la confirmacion al paciente
 *   (criterio 11/f06: una unica llamada a `mailerFactory()` por request,
 *   nunca duplicada), analogo a `supabaseClientFactory`. Por defecto,
 *   `createTransporter` de `api/_lib/mailer.js`. Los tests inyectan un
 *   objeto con `sendMail(mailOptions)` que devuelve una Promise, sin
 *   conexion real.
 */
function createHandler(options = {}) {
  const {
    supabaseClientFactory = getSupabaseClient,
    rateLimitStore = rateLimitStoreDefault,
    now = () => Date.now(),
    maxBodyBytes = MAX_BODY_BYTES,
    originConfig = null,
    mailerFactory = createTransporter,
  } = options;

  return async function leadsHandler(req, res) {
    // Observabilidad (f15): identificador de correlacion de esta
    // invocacion. Acompaña a TODOS los eventos de esta request y NO se
    // expone en la respuesta HTTP — decision explicita: no se altera la
    // superficie HTTP sin una necesidad operativa demostrable. La
    // correlacion externa se hace por `lead_id` contra la fila de
    // Supabase. Ver docs/tecnica/observabilidad-y-operacion.md.
    const log = crearLogger(crearRequestId());
    const inicioRequest = now();
    let leadId = null;

    function duracionDesde(inicio) {
      return Math.max(0, Math.round(now() - inicio));
    }

    let responded = false;
    function respond(statusCode, body, extraHeaders) {
      if (responded) return;
      responded = true;

      // Unico choke point de todas las respuestas: cubre "validacion
      // rechazada" y "solicitud finalizada" sin instrumentar los ~25
      // call sites de respond() uno por uno. Solo se loguea el CODIGO de
      // error y el NOMBRE del campo, nunca su valor.
      if (statusCode >= 400 && statusCode < 500) {
        log.warn('validacion_rechazada', {
          error: body && body.error,
          campo: body && body.campo,
          http_status: statusCode,
        });
      }

      log.info('solicitud_finalizada', {
        http_status: statusCode,
        lead_id: leadId,
        duracion_ms: duracionDesde(inicioRequest),
      });

      sendJson(res, statusCode, body, extraHeaders);
    }

    try {
      // `getClientIp` solo lee headers/socket, sin efectos: se adelanta
      // al chequeo de metodo para que incluso un 405 quede registrado
      // con su `ip_hash`.
      const ip = getClientIp(req);
      log.info('solicitud_recibida', { metodo: req.method, ip_hash: hashIp(ip) });

      // Paso 1 (criterio 2/f03, orden extendido paso 1/f04): metodo HTTP.
      if (req.method !== ALLOWED_METHOD) {
        respond(405, { error: 'metodo_no_permitido' }, { Allow: ALLOWED_METHOD });
        return;
      }

      // Paso 2 (nuevo, criterios 2/3/4 de la f04): validacion de origen.
      // Se evalua ANTES del rate limiting (orden de evaluacion extendido
      // de la f04, que reemplaza el de la f03) para no gastar cupo del
      // rate limiter con trafico que ya se va a rechazar por origen.
      const effectiveOriginConfig = originConfig || resolveOriginConfigFromEnv();
      const requestOrigin = getEffectiveOrigin(req);
      if (!isOriginAllowed(requestOrigin, effectiveOriginConfig)) {
        logRejection(log, 'origen_no_permitido', ip);
        respond(403, { error: 'origen_no_permitido' });
        return;
      }

      // Rate limiting best-effort (criterio 18/f03; logging agregado por
      // criterio 5/f04). Decision de implementacion (documentada en
      // runs/03-endpoint-recepcion-leads/decision.md, vigente en la
      // f04): se ubica inmediatamente despues de confirmar el metodo
      // POST y el origen, y antes de leer/validar el body, para no
      // gastar ciclos parseando contenido de un cliente ya limitado, y
      // para que una rafaga de solicitudes con body invalido tambien
      // cuente contra el limite.
      const rateLimitResult = checkRateLimit(rateLimitStore, ip, now());
      if (rateLimitResult.limited) {
        logRejection(log, 'rate_limit', ip);
        respond(
          429,
          { error: 'demasiadas_solicitudes' },
          { 'Retry-After': String(rateLimitResult.retryAfterSeconds) }
        );
        return;
      }

      // Paso 4 (criterio 4/f03): Content-Type, ignorando parametros como
      // charset. Se toma la porcion antes del primer ';', trim +
      // lowercase, comparacion estricta contra "application/json".
      const contentTypeHeader = req.headers['content-type'] || '';
      const contentType = contentTypeHeader.split(';')[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        respond(400, { error: 'content_type_invalido' });
        return;
      }

      // Paso 5 (criterio 14/f03): tamaño del body, medido crudo, antes
      // de JSON.parse.
      let rawBody;
      try {
        rawBody = await readRawBody(req, maxBodyBytes);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          respond(413, { error: 'payload_demasiado_grande' });
          return;
        }
        throw err;
      }

      // Paso 6 (criterio 5/f03): JSON valido.
      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (err) {
        respond(400, { error: 'json_invalido' });
        return;
      }

      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        respond(400, { error: 'json_invalido' });
        return;
      }

      // Paso 7 (criterio 6/f03): whitelist estricta de propiedades,
      // ampliada con `sitio_web` y `formulario_mostrado_en` (f04). Una
      // sola propiedad desconocida rechaza la solicitud entera.
      const unknownKey = Object.keys(payload).find((key) => !ALLOWED_KEYS.includes(key));
      if (unknownKey) {
        respond(400, { error: 'propiedad_desconocida', campo: unknownKey });
        return;
      }

      // Paso 8 (nuevo, criterios 6/7/8 de la f04): honeypot `sitio_web`.
      // Presente y, tras trim(), no vacio -> rechazo. Presente pero no
      // string (numero/objeto/array/booleano) -> tambien rechazo, con el
      // MISMO codigo generico (a diferencia del resto de campos de la
      // f03, no se distingue con tipo_invalido: cualquier señal en este
      // campo es sospechosa por definicion). Ausente o vacio tras trim
      // -> no afecta el flujo. Se evalua ANTES de los campos obligatorios
      // (paso 10): un body con sitio_web relleno y sin `nombre` responde
      // solicitud_rechazada, nunca campo_requerido_faltante (caso borde
      // explicito del spec).
      const sitioWeb = payload.sitio_web;
      if (sitioWeb !== undefined) {
        const esHoneypotDisparado = typeof sitioWeb !== 'string' || sitioWeb.trim().length > 0;
        if (esHoneypotDisparado) {
          logRejection(log, 'antispam', ip);
          respond(400, { error: 'solicitud_rechazada' });
          return;
        }
      }

      // Paso 9 (nuevo, criterio 9/f04): control temporal
      // `formulario_mostrado_en`. Solo se evalua si el valor es un
      // string parseable como fecha valida (Date.parse no da NaN); en
      // cualquier otro caso (ausente, no-string, no parseable) se omite
      // el chequeo sin rechazar la solicitud completa. Un delta negativo
      // (reloj de cliente adelantado) se trata igual que "menos de
      // 3000 ms" (caso borde explicito del spec).
      const formularioMostradoEn = payload.formulario_mostrado_en;
      if (typeof formularioMostradoEn === 'string') {
        const parsedTimestamp = Date.parse(formularioMostradoEn);
        if (!Number.isNaN(parsedTimestamp)) {
          const deltaMs = now() - parsedTimestamp;
          if (deltaMs < MIN_FORM_FILL_MS) {
            logRejection(log, 'antispam', ip);
            respond(400, { error: 'solicitud_rechazada' });
            return;
          }
        }
      }

      // Paso 10 (criterios 7/f03): presencia de campos obligatorios, sin
      // incluir consentimiento_privacidad.
      for (const field of REQUIRED_STRING_FIELDS) {
        if (payload[field] === undefined) {
          respond(400, { error: 'campo_requerido_faltante', campo: field });
          return;
        }
      }

      // Paso 10 (criterio 9/f03): tipos de los campos presentes, sin
      // incluir consentimiento_privacidad NI sitio_web/
      // formulario_mostrado_en (ver STRING_FIELDS mas arriba, criterios
      // 7/11 de la f04). Decision de implementacion (ver decision.md):
      // para los campos OPCIONALES (telefono/servicio/mensaje), un valor
      // explicito `null` se trata igual que ausente (no dispara
      // tipo_invalido) porque la columna en Supabase acepta NULL y es
      // una forma razonable/comun de que un cliente JSON exprese "sin
      // valor". Para los campos OBLIGATORIOS (nombre, email,
      // version_politica_privacidad) `null` SI dispara tipo_invalido, ya
      // presente y confirmado como obligatorio en el paso anterior.
      for (const field of STRING_FIELDS) {
        const value = payload[field];
        if (value === undefined) continue;
        if (value === null && OPTIONAL_STRING_FIELDS.includes(field)) continue;
        if (typeof value !== 'string') {
          respond(400, { error: 'tipo_invalido', campo: field });
          return;
        }
      }

      // Paso 10 (criterios 10, 11, 12 de la f03): formatos y longitudes.
      // Sub-orden explicito, campo por campo (longitud antes que formato
      // dentro de cada campo): nombre -> email -> telefono ->
      // version_politica_privacidad -> servicio -> mensaje. Documentado
      // en decision.md y en docs/tecnica/endpoint-recepcion-leads.md.

      // nombre: obligatorio, ya garantizado string por los pasos previos.
      const nombre = payload.nombre.trim();
      if (nombre.length === 0) {
        // Vacio tras trim(): tratado como ausente (criterio 12/f03,
        // "Casos borde"), no como longitud_excedida.
        respond(400, { error: 'campo_requerido_faltante', campo: 'nombre' });
        return;
      }
      if (nombre.length < LENGTHS.nombre.min || nombre.length > LENGTHS.nombre.max) {
        respond(400, { error: 'longitud_excedida', campo: 'nombre' });
        return;
      }

      // email: obligatorio, ya garantizado string.
      const email = payload.email.trim();
      if (email.length > LENGTHS.email.max) {
        respond(400, { error: 'longitud_excedida', campo: 'email' });
        return;
      }
      if (!EMAIL_PATTERN.test(email)) {
        respond(400, { error: 'formato_email_invalido' });
        return;
      }

      // telefono: opcional. normalizeOptionalString ya aplica la regla
      // de "vacio tras trim() -> null" (criterio 8/f03).
      const telefono = normalizeOptionalString(payload.telefono);
      if (telefono !== null && !TELEFONO_PATTERN.test(telefono)) {
        respond(400, { error: 'formato_telefono_invalido' });
        return;
      }

      // version_politica_privacidad: obligatorio, ya garantizado string.
      const versionPoliticaPrivacidad = payload.version_politica_privacidad.trim();
      if (versionPoliticaPrivacidad.length === 0) {
        respond(400, { error: 'campo_requerido_faltante', campo: 'version_politica_privacidad' });
        return;
      }
      if (
        versionPoliticaPrivacidad.length < LENGTHS.version_politica_privacidad.min ||
        versionPoliticaPrivacidad.length > LENGTHS.version_politica_privacidad.max
      ) {
        respond(400, { error: 'longitud_excedida', campo: 'version_politica_privacidad' });
        return;
      }

      // servicio: opcional, sin validacion de enum (criterio 13/f03).
      const servicio = normalizeOptionalString(payload.servicio);
      if (servicio !== null && servicio.length > LENGTHS.servicio.max) {
        respond(400, { error: 'longitud_excedida', campo: 'servicio' });
        return;
      }

      // mensaje: opcional.
      const mensaje = normalizeOptionalString(payload.mensaje);
      if (mensaje !== null && mensaje.length > LENGTHS.mensaje.max) {
        respond(400, { error: 'longitud_excedida', campo: 'mensaje' });
        return;
      }

      // Paso 10 (criterio 15/f03): consentimiento_privacidad. Unico
      // criterio que determina su codigo de error en cualquier escenario
      // de falla (ausente, false, tipo no-booleano) — nunca
      // campo_requerido_faltante ni tipo_invalido.
      if (payload.consentimiento_privacidad !== true) {
        respond(400, { error: 'consentimiento_requerido' });
        return;
      }

      // Observabilidad (f15): todas las validaciones quedaron atras; a
      // partir de aca la solicitud toca sistemas externos.
      log.info('validacion_aceptada');

      // Cliente Supabase (criterios 16, 17, 23 de la f03): se obtiene
      // recien aca (nunca antes de pasar todas las validaciones) para no
      // inicializar una conexion real en solicitudes que de todas formas
      // van a rechazarse. Se reutiliza tanto para el chequeo de
      // duplicados (paso 11) como para el insert (paso 12).
      let supabase;
      try {
        supabase = supabaseClientFactory();
      } catch (err) {
        log.error('supabase_cliente_error', metadatosDeError('supabase_cliente_error', err));
        respond(500, { error: 'error_interno' });
        return;
      }

      // Paso 11 (nuevo, criterios 12/13/14 de la f04): idempotencia /
      // duplicados accidentales. Busca un lead reciente (ventana de
      // DUPLICATE_WINDOW_MINUTES) con el mismo email (case-insensitive,
      // tras trim) y el mismo nombre (case-sensitive, tras trim). Si
      // existe, responde 201 con su id SIN insertar un lead nuevo.
      // Limitacion conocida y aceptada, no mitigada en esta feature:
      // condicion de carrera (TOCTOU) entre este SELECT y el INSERT del
      // paso 12 — ver docs/tecnica/proteccion-antispam-y-abuso.md y el
      // spec ("Riesgos / supuestos") para la justificacion completa.
      const duplicateWindowStartIso = new Date(now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();

      let existingLeads;
      try {
        // La consulta se construye en un paso aparte, sin await, para
        // poder leer del builder el endpoint efectivo si falla. Awaitear
        // la cadena directamente descarta esa informacion.
        const consultaDuplicados = supabase
          .from('leads')
          .select('id')
          .ilike('email', escapeIlikeValue(email))
          .eq('nombre', nombre)
          .gte('fecha_creacion', duplicateWindowStartIso)
          .limit(1);

        const {
          data: dupData,
          error: dupError,
          status: dupStatus,
        } = await consultaDuplicados;

        if (dupError) {
          // `status` viene de la respuesta HTTP, no del objeto de error:
          // es lo unico que distingue "PostgREST rechazo la consulta" de
          // "el endpoint ni siquiera hablo PostgREST" cuando el cuerpo no
          // es JSON y el error llega sin `name` ni `code`. Y host+path
          // distinguen "la tabla no existe" de "le estamos pegando al
          // host equivocado", que el status por si solo no separa.
          log.error(
            'supabase_duplicados_error',
            Object.assign(
              metadatosDeError('supabase_duplicados_error', dupError),
              metadatosDeEndpoint(consultaDuplicados),
              { supabase_status_code: dupStatus }
            )
          );
          respond(500, { error: 'error_interno' });
          return;
        }
        existingLeads = dupData;
      } catch (err) {
        log.error(
          'supabase_duplicados_error',
          metadatosDeError('supabase_duplicados_error', err)
        );
        respond(500, { error: 'error_interno' });
        return;
      }

      if (Array.isArray(existingLeads) && existingLeads.length > 0 && existingLeads[0] && existingLeads[0].id) {
        leadId = existingLeads[0].id;
        log.info('duplicado_detectado', { lead_id: leadId });
        respond(201, { id: existingLeads[0].id });
        return;
      }

      // Paso 12 (criterios 16, 17 de la f03; criterio 1/f05 cambia
      // '.select(\'id\')' a '.select(\'id, fecha_creacion\')' para traer
      // el valor real de fecha_creacion generado por el default now() de
      // Postgres, fuente unica de verdad para el correo de notificacion
      // — ver "Diseño propuesto -> 2" de runs/05-notificacion-clinica-
      // smtp-ferozo/spec.md). Sin cambios en el mapeo campo->columna del
      // insert en si.
      const inicioInsercion = now();
      // Igual que en la consulta de duplicados: se construye aparte para
      // poder leer el endpoint efectivo si falla.
      const consultaInsercion = supabase
        .from('leads')
        .insert([
          {
            nombre,
            email,
            telefono,
            servicio,
            mensaje,
            consentimiento_privacidad: true,
            version_politica_privacidad: versionPoliticaPrivacidad,
          },
        ])
        .select('id, fecha_creacion')
        .single();

      const { data, error, status: insertStatus } = await consultaInsercion;

      const duracionInsercion = duracionDesde(inicioInsercion);

      if (error || !data || !data.id) {
        // Observabilidad (f15): del error de Postgres/Supabase se
        // registran UNICAMENTE metadatos estructurados (SQLSTATE, clase
        // del error y huella de agrupacion). Nunca `message`, `details`
        // ni `hint`: un error de INSERT puede incluir los valores de la
        // fila (ej. "Key (email)=(...)"), es decir PII del paciente.
        log.error(
          'supabase_insercion_error',
          Object.assign(
            metadatosDeError('supabase_insercion_error', error),
            metadatosDeEndpoint(consultaInsercion),
            { supabase_status_code: insertStatus, duracion_ms: duracionInsercion }
          )
        );
        respond(500, { error: 'error_interno' });
        return;
      }

      leadId = data.id;
      log.info('supabase_insercion_ok', { lead_id: leadId, duracion_ms: duracionInsercion });

      // Notificacion a la clinica y confirmacion al paciente por email
      // (features 05 y 06), unicamente tras un INSERT nuevo exitoso
      // (nunca en la rama de duplicado detectado, que ya respondio y
      // retorno mas arriba). Secuencia acotada estrictamente a estos
      // pasos: ningun fallo aca debe alterar la respuesta 201 ya
      // decidida, ni volver a tocar la logica de insercion ni el catch
      // generico de nivel superior (regla dura verificada por test, ver
      // spec de la f05 y criterios 15/16/18 de la f06).
      let transporter = null;
      try {
        transporter = mailerFactory();
      } catch (mailerErr) {
        // Configuracion SMTP faltante/invalida (criterio 8/f05, criterio
        // 12/f06: si esto lanza, NINGUNO de los dos envios se intenta):
        // se trata como fallo de envio, sin credenciales ni objeto de
        // config en el log (criterio 10/f05).
        log.error(
          'smtp_configuracion_error',
          metadatosDeError('smtp_configuracion_error', mailerErr)
        );
      }

      if (transporter) {
        const lead = {
          id: data.id,
          nombre,
          email,
          telefono,
          servicio,
          mensaje,
          fecha_creacion: data.fecha_creacion,
        };

        // Envio a la clinica (feature 05, sin cambios de contenido ni de
        // destinatario respecto a esa feature). Se ejecuta primero,
        // secuencialmente (criterio "orden de ejecucion" del spec de la
        // f06: decision explicita de no paralelizar con
        // Promise.allSettled, ver docs/tecnica/
        // confirmacion-automatica-paciente.md).
        const clinicMailOptions = buildClinicNotificationEmail(lead);
        let clinicSendSucceeded = false;
        const inicioEnvioClinic = now();
        try {
          // Un reintento acotado si el fallo fue transitorio. Ver
          // `enviarConReintento` en _lib/mailer.js.
          await enviarConReintento(transporter, clinicMailOptions);
          clinicSendSucceeded = true;
          log.info('smtp_clinica_ok', {
            lead_id: leadId,
            duracion_ms: duracionDesde(inicioEnvioClinic),
          });
        } catch (sendMailErr) {
          // Rechazo/excepcion de sendMail (criterio 7/f05): saltar el
          // UPDATE del flag. Desde la f15 NO se loguea `err.message` ni
          // `err.response`: solo metadatos estructurados (`codigo`,
          // `smtp_response_code`, huella de agrupacion). Un fallo aca NO
          // impide el intento de envio al paciente que sigue mas abajo
          // (criterio 13/f06, independencia explicita).
          log.error(
            'smtp_clinica_error',
            Object.assign(metadatosDeError('smtp_clinica_error', sendMailErr), {
              lead_id: leadId,
              duracion_ms: duracionDesde(inicioEnvioClinic),
            })
          );
        }

        if (clinicSendSucceeded) {
          // sendMail exitoso (criterio 6/f05): marcar el flag de
          // tracking. Si este UPDATE falla, se loguea pero NO afecta la
          // respuesta ya decidida (criterio 9/f05): el email si se
          // envio, solo el flag de tracking no se pudo persistir.
          try {
            const { error: updateError, status: updateStatus } = await supabase
              .from('leads')
              .update({ notificacion_clinica_enviada: true })
              .eq('id', data.id);
            if (updateError) {
              log.error(
                'flag_actualizacion_error',
                Object.assign(metadatosDeError('flag_actualizacion_error', updateError), {
                  lead_id: leadId,
                  flag: 'notificacion_clinica_enviada',
                  supabase_status_code: updateStatus,
                })
              );
            }
          } catch (updateErr) {
            log.error(
              'flag_actualizacion_error',
              Object.assign(metadatosDeError('flag_actualizacion_error', updateErr), {
                lead_id: leadId,
                flag: 'notificacion_clinica_enviada',
              })
            );
          }
        }

        // Confirmacion al paciente (feature 06, nuevo): intento
        // independiente del anterior, con su propio try/catch acotado y
        // su propio flag/UPDATE. Un fallo en el envio a la clinica NO
        // impidio llegar hasta aca, y un fallo aca no afecta el
        // resultado ya decidido del envio a la clinica (criterio 13/f06).
        const patientMailOptions = buildPatientConfirmationEmail(lead);
        let patientSendSucceeded = false;
        const inicioEnvioPatient = now();
        try {
          // Este es el envio que dio ETIMEDOUT en la validacion real: es
          // el segundo de la misma invocacion.
          await enviarConReintento(transporter, patientMailOptions);
          patientSendSucceeded = true;
          log.info('smtp_paciente_ok', {
            lead_id: leadId,
            duracion_ms: duracionDesde(inicioEnvioPatient),
          });
        } catch (sendMailErr) {
          // Rechazo/excepcion de sendMail (criterio 15/f06): saltar el
          // UPDATE del flag. Desde la f15 solo se registran metadatos
          // estructurados, nunca `err.message`, `err.response` ni el
          // objeto completo. El lead insertado y la respuesta HTTP no se
          // ven afectados.
          log.error(
            'smtp_paciente_error',
            Object.assign(metadatosDeError('smtp_paciente_error', sendMailErr), {
              lead_id: leadId,
              duracion_ms: duracionDesde(inicioEnvioPatient),
            })
          );
        }

        if (patientSendSucceeded) {
          // sendMail exitoso (criterio 14/f06): marcar
          // confirmacion_paciente_enviada. Si este UPDATE falla, se
          // loguea pero NO cambia la respuesta HTTP ya decidida
          // (criterio 16/f06).
          try {
            const { error: updateError, status: updateStatus } = await supabase
              .from('leads')
              .update({ confirmacion_paciente_enviada: true })
              .eq('id', data.id);
            if (updateError) {
              log.error(
                'flag_actualizacion_error',
                Object.assign(metadatosDeError('flag_actualizacion_error', updateError), {
                  lead_id: leadId,
                  flag: 'confirmacion_paciente_enviada',
                  supabase_status_code: updateStatus,
                })
              );
            }
          } catch (updateErr) {
            log.error(
              'flag_actualizacion_error',
              Object.assign(metadatosDeError('flag_actualizacion_error', updateErr), {
                lead_id: leadId,
                flag: 'confirmacion_paciente_enviada',
              })
            );
          }
        }
      }

      respond(201, { id: data.id });
    } catch (err) {
      // Cualquier error no controlado (criterio 19/f03): 500 generico,
      // sin stack trace ni mensaje interno en la respuesta.
      log.error('error_no_controlado', metadatosDeError('error_no_controlado', err));
      respond(500, { error: 'error_interno' });
    }
  };
}

const handler = createHandler();

module.exports = handler;
module.exports.createHandler = createHandler;

// Nota de implementacion obligatoria (criterio 14/f03): deshabilita el
// auto-parseo de body de Vercel para poder leer el stream crudo y medir
// su tamaño antes de JSON.parse (ver readRawBody arriba).
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
