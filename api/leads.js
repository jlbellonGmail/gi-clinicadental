'use strict';

const { getSupabaseClient } = require('./_lib/supabase-client');

// Contrato completo en runs/03-endpoint-recepcion-leads/spec.md y en
// docs/tecnica/endpoint-recepcion-leads.md (version legible para
// mantenimiento). Los comentarios de este archivo solo señalan a que
// paso del orden de evaluacion (criterio 3 del spec) corresponde cada
// bloque, no repiten el contrato completo.

const ALLOWED_METHOD = 'POST';
const MAX_BODY_BYTES = 10 * 1024; // 10 KB (10240 bytes) — criterio 14
const RATE_LIMIT_MAX_REQUESTS = 5; // criterio 18
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 segundos — criterio 18

const ALLOWED_KEYS = [
  'nombre',
  'email',
  'telefono',
  'servicio',
  'mensaje',
  'consentimiento_privacidad',
  'version_politica_privacidad',
];

// Campos obligatorios evaluados en el paso 6 (criterio 7). NO incluye
// consentimiento_privacidad: ese campo sigue exclusivamente la regla
// del criterio 15 (paso 9), ver la excepcion explicita en el criterio 7.
const REQUIRED_STRING_FIELDS = ['nombre', 'email', 'version_politica_privacidad'];

// Campos que deben ser `string` cuando estan presentes, evaluados en el
// paso 7 (criterio 9). NO incluye consentimiento_privacidad (criterio 9
// lo excluye explicitamente; ver criterio 15 / paso 9).
const STRING_FIELDS = ['nombre', 'email', 'telefono', 'servicio', 'mensaje', 'version_politica_privacidad'];

// Campos opcionales (criterio 8): ausentes o vacios tras trim() -> null.
const OPTIONAL_STRING_FIELDS = ['telefono', 'servicio', 'mensaje'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digitos, espacios, '+', '-', parentesis; longitud 6-30 ya impuesta por
// el propio patron (criterio 11: format y longitud del telefono estan
// unificados en un unico criterio).
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
// (criterio 18): Map de IP -> { count, windowStart }. Documentado como
// provisional en docs/tecnica/endpoint-recepcion-leads.md — no persiste
// entre cold starts ni se comparte entre instancias serverless
// concurrentes (ver "Riesgos/supuestos" del spec).
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
 * ningun JSON.parse (criterio 14: el auto body-parser de Vercel se
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
 * null o undefined) en el paso 7: si no es un string no vacio tras
 * trim(), se trata como ausente -> null (criterio 8). Se asume que el
 * valor ya paso el chequeo de tipos del paso 7 (cualquier otro tipo,
 * ej. numero/objeto/array, ya respondio tipo_invalido antes de llegar
 * aca).
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
 * dependencias para tests (criterio 23: cliente Supabase inyectable) y
 * para poder testear rate limiting y el limite de tamaño de forma
 * determinista, sin depender de temporizadores reales ni de una
 * instancia de proceso compartida entre tests.
 *
 * @param {object} [options]
 * @param {() => object} [options.supabaseClientFactory]
 * @param {Map} [options.rateLimitStore]
 * @param {() => number} [options.now]
 * @param {number} [options.maxBodyBytes]
 */
function createHandler(options = {}) {
  const {
    supabaseClientFactory = getSupabaseClient,
    rateLimitStore = rateLimitStoreDefault,
    now = () => Date.now(),
    maxBodyBytes = MAX_BODY_BYTES,
  } = options;

  return async function leadsHandler(req, res) {
    let responded = false;
    function respond(statusCode, body, extraHeaders) {
      if (responded) return;
      responded = true;
      sendJson(res, statusCode, body, extraHeaders);
    }

    try {
      // Paso 1 (criterio 2, orden del criterio 3): metodo HTTP.
      if (req.method !== ALLOWED_METHOD) {
        respond(405, { error: 'metodo_no_permitido' }, { Allow: ALLOWED_METHOD });
        return;
      }

      // Rate limiting best-effort (criterio 18). Decision de
      // implementacion (documentada en runs/03-endpoint-recepcion-leads/
      // decision.md): el spec no incluye este chequeo dentro de los 9
      // pasos numerados del criterio 3 (esos 9 pasos cubren solo las
      // validaciones de contenido del body). Se ubica aca, inmediatamente
      // despues de confirmar el metodo POST y antes de leer/validar el
      // body, para no gastar ciclos parseando contenido de un cliente ya
      // limitado, y para que una rafaga de solicitudes con body invalido
      // tambien cuente contra el limite (protege igual contra abuso con
      // basura como con solicitudes bien formadas).
      const ip = getClientIp(req);
      const rateLimitResult = checkRateLimit(rateLimitStore, ip, now());
      if (rateLimitResult.limited) {
        respond(
          429,
          { error: 'demasiadas_solicitudes' },
          { 'Retry-After': String(rateLimitResult.retryAfterSeconds) }
        );
        return;
      }

      // Paso 2 (criterio 4): Content-Type, ignorando parametros como
      // charset. Se toma la porcion antes del primer ';', trim +
      // lowercase, comparacion estricta contra "application/json".
      const contentTypeHeader = req.headers['content-type'] || '';
      const contentType = contentTypeHeader.split(';')[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        respond(400, { error: 'content_type_invalido' });
        return;
      }

      // Paso 3 (criterio 14): tamaño del body, medido crudo, antes de
      // JSON.parse.
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

      // Paso 4 (criterio 5): JSON valido.
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

      // Paso 5 (criterio 6): whitelist estricta de propiedades. Una
      // sola propiedad desconocida rechaza la solicitud entera.
      const unknownKey = Object.keys(payload).find((key) => !ALLOWED_KEYS.includes(key));
      if (unknownKey) {
        respond(400, { error: 'propiedad_desconocida', campo: unknownKey });
        return;
      }

      // Paso 6 (criterio 7): presencia de campos obligatorios, sin
      // incluir consentimiento_privacidad.
      for (const field of REQUIRED_STRING_FIELDS) {
        if (payload[field] === undefined) {
          respond(400, { error: 'campo_requerido_faltante', campo: field });
          return;
        }
      }

      // Paso 7 (criterio 9): tipos de los campos presentes, sin incluir
      // consentimiento_privacidad. Decision de implementacion (ver
      // decision.md): para los campos OPCIONALES (telefono/servicio/
      // mensaje), un valor explicito `null` se trata igual que ausente
      // (no dispara tipo_invalido) porque la columna en Supabase acepta
      // NULL y es una forma razonable/comun de que un cliente JSON
      // exprese "sin valor". Para los campos OBLIGATORIOS (nombre,
      // email, version_politica_privacidad) `null` SI dispara
      // tipo_invalido, ya presente y confirmado como obligatorio en el
      // paso 6.
      for (const field of STRING_FIELDS) {
        const value = payload[field];
        if (value === undefined) continue;
        if (value === null && OPTIONAL_STRING_FIELDS.includes(field)) continue;
        if (typeof value !== 'string') {
          respond(400, { error: 'tipo_invalido', campo: field });
          return;
        }
      }

      // Paso 8 (criterios 10, 11, 12): formatos y longitudes. Sub-orden
      // explicito, campo por campo (longitud antes que formato dentro
      // de cada campo, siguiendo la sugerencia no vinculante de
      // audit-3.md): nombre -> email -> telefono ->
      // version_politica_privacidad -> servicio -> mensaje. Documentado
      // en decision.md y en docs/tecnica/endpoint-recepcion-leads.md.

      // nombre: obligatorio, ya garantizado string por los pasos 6/7.
      const nombre = payload.nombre.trim();
      if (nombre.length === 0) {
        // Vacio tras trim(): tratado como ausente (criterio 12,
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
      // de "vacio tras trim() -> null" (criterio 8).
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

      // servicio: opcional, sin validacion de enum (criterio 13).
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

      // Paso 9 (criterio 15): consentimiento_privacidad. Unico criterio
      // que determina su codigo de error en cualquier escenario de
      // falla (ausente, false, tipo no-booleano) — nunca
      // campo_requerido_faltante ni tipo_invalido (ver criterios 7 y 9).
      if (payload.consentimiento_privacidad !== true) {
        respond(400, { error: 'consentimiento_requerido' });
        return;
      }

      // Insercion en Supabase (criterios 16, 17, 23). El cliente se
      // obtiene recien aca (nunca antes de pasar todas las
      // validaciones) para no inicializar una conexion real en
      // solicitudes que de todas formas van a rechazarse.
      let supabase;
      try {
        supabase = supabaseClientFactory();
      } catch (err) {
        console.error('[api/leads] Error inicializando el cliente Supabase:', err);
        respond(500, { error: 'error_interno' });
        return;
      }

      const { data, error } = await supabase
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
        .select('id')
        .single();

      if (error || !data || !data.id) {
        // El detalle real (mensaje de Postgres/Supabase) se loguea solo
        // server-side (criterio 19): nunca en la respuesta HTTP.
        console.error('[api/leads] Error insertando lead en Supabase:', error);
        respond(500, { error: 'error_interno' });
        return;
      }

      respond(201, { id: data.id });
    } catch (err) {
      // Cualquier error no controlado (criterio 19): 500 generico, sin
      // stack trace ni mensaje interno en la respuesta.
      console.error('[api/leads] Error no controlado:', err);
      respond(500, { error: 'error_interno' });
    }
  };
}

const handler = createHandler();

module.exports = handler;
module.exports.createHandler = createHandler;

// Nota de implementacion obligatoria (criterio 14): deshabilita el
// auto-parseo de body de Vercel para poder leer el stream crudo y medir
// su tamaño antes de JSON.parse (ver readRawBody arriba).
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
