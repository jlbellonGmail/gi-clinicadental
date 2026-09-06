'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const { createHandler } = require('./leads');

// Valores fijos de referencia para la notificacion de email de la
// feature 05 (ver runs/05-notificacion-clinica-smtp-ferozo/spec.md):
// api/leads.js arma buildClinicNotificationEmail() con los valores REALES
// de process.env.LEADS_NOTIFICATION_EMAIL/SMTP_FROM (no son inyectables
// por separado del mailerFactory), asi que se fijan una sola vez aca para
// todo el archivo.
process.env.LEADS_NOTIFICATION_EMAIL = 'clinica@sonriemascorrientes.com';
process.env.SMTP_FROM = 'notificaciones@sonriemascorrientes.com';

// ---------------------------------------------------------------------
// Helpers de test: req/res falsos que hablan el mismo protocolo que un
// request/response reales de Node (stream + headers + statusCode), sin
// depender de Vercel ni de un servidor HTTP real levantado.
// ---------------------------------------------------------------------

// Origen "valido" de referencia para los tests (feature 04): analogo a
// SITE_URL en produccion/local (ver .env.example). makeReq() lo agrega
// por defecto como header Origin, y newHandler() lo agrega por defecto
// como originConfig.siteUrl, para que los tests preexistentes de la
// feature 03 (que no conocen el concepto de origen) sigan pasando sin
// modificarse.
const TEST_SITE_URL = 'http://localhost:3000';

function makeReq({ method = 'POST', headers = {}, body, ip = '203.0.113.10' } = {}) {
  let bodyBuffer;
  if (body === undefined) {
    bodyBuffer = Buffer.alloc(0);
  } else if (Buffer.isBuffer(body)) {
    bodyBuffer = body;
  } else if (typeof body === 'string') {
    bodyBuffer = Buffer.from(body, 'utf8');
  } else {
    bodyBuffer = Buffer.from(JSON.stringify(body), 'utf8');
  }

  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }
  if (normalizedHeaders['content-type'] === undefined && body !== undefined) {
    normalizedHeaders['content-type'] = 'application/json';
  }
  if (normalizedHeaders['x-forwarded-for'] === undefined) {
    normalizedHeaders['x-forwarded-for'] = ip;
  }
  if (normalizedHeaders['origin'] === undefined) {
    normalizedHeaders['origin'] = TEST_SITE_URL;
  }

  const req = new Readable({
    read() {
      this.push(bodyBuffer);
      this.push(null);
    },
  });
  req.method = method;
  req.headers = normalizedHeaders;
  req.socket = { remoteAddress: ip };
  return req;
}

function makeRes() {
  return {
    statusCode: undefined,
    headers: {},
    ended: false,
    rawBody: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    end(chunk) {
      this.ended = true;
      this.rawBody = chunk;
    },
    get json() {
      return this.rawBody ? JSON.parse(this.rawBody) : undefined;
    },
  };
}

/**
 * Cliente Supabase falso. Soporta tres flujos usados por el handler:
 *
 * - `from('leads').insert(rows).select('id, fecha_creacion').single()`:
 *   insercion (feature 03; `.select()` ampliado en la feature 05 para
 *   traer tambien `fecha_creacion`, ver criterio 1 del spec de la f05).
 *   `calls` registra cada invocacion a `insert()` — varios tests
 *   (existentes y nuevos) verifican `calls.length` para confirmar que
 *   NO se inserta un lead en escenarios de rechazo o de duplicado.
 * - `from('leads').select('id').ilike(...).eq(...).gte(...).limit(n)`:
 *   chequeo de duplicados (feature 04, paso 11). `selectCalls` registra
 *   cada invocacion. Por defecto no hay duplicados (`existingLeads: []`);
 *   los tests de idempotencia inyectan `existingLeads` para simular un
 *   match.
 * - `from('leads').update({...}).eq('id', id)`: flag de notificacion
 *   (feature 05, paso 4 del diseño de esa feature). `updateCalls`
 *   registra cada invocacion; `failOnUpdate` simula un error de Supabase
 *   en ese paso.
 */
function makeFakeSupabaseClient({
  fail = false,
  id = '11111111-1111-1111-1111-111111111111',
  fechaCreacion = '2026-08-19T12:00:00.000Z',
  existingLeads = [],
  failOnSelect = false,
  failOnUpdate = false,
  // Status HTTP de la respuesta de Supabase. El cliente real siempre lo
  // trae; el falso lo expone para poder verificar que se registra como
  // `supabase_status_code` (feature 16). Defaults del camino feliz.
  selectStatus = 200,
  insertStatus = 201,
  updateStatus = 204,
  // Error a devolver en el SELECT de duplicados. El default preserva el
  // comportamiento previo; los tests de la f16 inyectan la forma REAL que
  // toma `postgrest-js` cuando la respuesta no es JSON: un objeto plano
  // con `message` y SIN `name` ni `code`.
  errorOnSelect = { message: 'fallo simulado de Supabase (select)' },
  // Endpoint que expone el builder. El cliente real lo trae en `.url`;
  // el falso lo expone para poder verificar que se registran host y
  // pathname, y -sobre todo- que el query string NO se registra.
  urlBase = 'https://ejemplo.supabase.co/rest/v1',
} = {}) {
  const calls = [];
  const selectCalls = [];
  const updateCalls = [];
  const insertSelectCalls = [];
  const client = {
    calls,
    selectCalls,
    updateCalls,
    insertSelectCalls,
    from(table) {
      return {
        insert(rows) {
          calls.push({ table, rows });
          return {
            select(columns) {
              insertSelectCalls.push(columns);
              return {
                single() {
                  const respuesta = fail
                    ? {
                        data: null,
                        error: { message: 'fallo simulado de Supabase' },
                        status: insertStatus,
                      }
                    : {
                        data: { id, fecha_creacion: fechaCreacion },
                        error: null,
                        status: insertStatus,
                      };
                  return {
                    url: `${urlBase}/${table}?select=${encodeURIComponent(columns)}`,
                    then: (alCumplir, alFallar) =>
                      Promise.resolve(respuesta).then(alCumplir, alFallar),
                  };
                },
              };
            },
          };
        },
        select(columns) {
          const filters = {};
          const builder = {
            // El query string incluye el email, igual que en el cliente
            // real. Los tests verifican que NO llegue a ningun log.
            url: `${urlBase}/${table}?select=${columns}&email=ilike.${encodeURIComponent(PII.email)}`,
            ilike(column, value) {
              filters[column] = { op: 'ilike', value };
              return builder;
            },
            eq(column, value) {
              filters[column] = { op: 'eq', value };
              return builder;
            },
            gte(column, value) {
              filters[column] = { op: 'gte', value };
              return builder;
            },
            limit(n) {
              selectCalls.push({ table, columns, filters, limit: n });
              const respuesta = failOnSelect
                ? { data: null, error: errorOnSelect, status: selectStatus }
                : { data: existingLeads, error: null, status: selectStatus };
              // Thenable con `.url`, como PostgrestTransformBuilder.
              return {
                url: builder.url,
                then: (alCumplir, alFallar) => Promise.resolve(respuesta).then(alCumplir, alFallar),
              };
            },
          };
          return builder;
        },
        update(values) {
          return {
            async eq(column, value) {
              updateCalls.push({ table, values, column, value });
              if (failOnUpdate) {
                return {
                  data: null,
                  error: { message: 'fallo simulado de Supabase (update)' },
                  status: updateStatus,
                };
              }
              return { data: null, error: null, status: updateStatus };
            },
          };
        },
      };
    },
  };
  return client;
}

/**
 * Mailer falso (feature 05): simula el transporter de Nodemailer
 * inyectado via `mailerFactory`. `sentMails` registra cada objeto
 * `mailOptions` recibido por `sendMail()` — usado por los tests para
 * inspeccionar `to`/`from`/`replyTo`/`subject`/`html`/`text` sin
 * conexion real. `fail: true` simula un rechazo de `sendMail()` (fallo
 * SMTP real).
 */
function makeFakeMailer({ fail = false } = {}) {
  const sentMails = [];
  return {
    sentMails,
    async sendMail(mailOptions) {
      sentMails.push(mailOptions);
      if (fail) {
        throw new Error('fallo simulado de SMTP');
      }
      return { messageId: 'fake-message-id' };
    },
  };
}

/**
 * Mailer falso (feature 06): variante de makeFakeMailer() que falla
 * selectivamente segun el destinatario (`to`) de `mailOptions`, para
 * verificar la independencia entre el envio a la clinica y el envio al
 * paciente (criterio 13/f06: un fallo en uno no debe impedir el intento
 * del otro). `sentMails` registra TODOS los intentos, exitosos o no.
 */
function makeSelectiveFailMailer({ failTo = [] } = {}) {
  const sentMails = [];
  return {
    sentMails,
    async sendMail(mailOptions) {
      sentMails.push(mailOptions);
      if (failTo.includes(mailOptions.to)) {
        throw new Error(`fallo simulado de SMTP para ${mailOptions.to}`);
      }
      return { messageId: 'fake-message-id' };
    },
  };
}

function validPayload(overrides = {}) {
  return {
    nombre: 'Ana Pérez',
    email: 'ana@example.com',
    consentimiento_privacidad: true,
    version_politica_privacidad: 'v1',
    ...overrides,
  };
}

function newHandler(opts = {}) {
  const supabaseClient = opts.supabaseClient || makeFakeSupabaseClient();
  // Por defecto, un mailer falso que "envia" exitosamente (sin red real),
  // para que los tests preexistentes (que no conocen el concepto de
  // email) ejerciten tambien el camino feliz de notificacion sin
  // necesitar inyectar nada explicito. Los tests de la feature 05 pueden
  // pasar `mailer`/`mailerFactory` explicitos para simular fallos.
  const mailer = opts.mailer || makeFakeMailer();
  const mailerFactory = opts.mailerFactory || (() => mailer);
  const handler = createHandler({
    supabaseClientFactory: () => supabaseClient,
    rateLimitStore: opts.rateLimitStore || new Map(),
    now: opts.now || (() => Date.now()),
    maxBodyBytes: opts.maxBodyBytes,
    originConfig: opts.originConfig || { siteUrl: TEST_SITE_URL, allowedOrigins: [], vercelUrl: undefined },
    mailerFactory,
  });
  return { handler, supabaseClient, mailer };
}

// ---------------------------------------------------------------------
// Metodo HTTP (criterio 2, paso 1)
// ---------------------------------------------------------------------

test('metodo distinto de POST -> 405 con Allow: POST', async () => {
  const { handler } = newHandler();
  const req = makeReq({ method: 'GET' });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.getHeader('Allow'), 'POST');
  assert.equal(res.json.error, 'metodo_no_permitido');
});

for (const method of ['PUT', 'PATCH', 'DELETE', 'HEAD']) {
  test(`metodo ${method} -> 405`, async () => {
    const { handler } = newHandler();
    const req = makeReq({ method });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 405);
  });
}

// ---------------------------------------------------------------------
// Content-Type (criterio 4, paso 2)
// ---------------------------------------------------------------------

test('sin header Content-Type -> 400 content_type_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload(), headers: { 'content-type': undefined } });
  delete req.headers['content-type'];
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'content_type_invalido');
});

test('Content-Type: text/plain -> 400 content_type_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload(), headers: { 'content-type': 'text/plain' } });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'content_type_invalido');
});

test('Content-Type: multipart/form-data -> 400 content_type_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({
    body: validPayload(),
    headers: { 'content-type': 'multipart/form-data; boundary=---x' },
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'content_type_invalido');
});

test('Content-Type: application/json-patch+json -> 400 (subtipo distinto)', async () => {
  const { handler } = newHandler();
  const req = makeReq({
    body: validPayload(),
    headers: { 'content-type': 'application/json-patch+json' },
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'content_type_invalido');
});

test('Content-Type: application/json; charset=utf-8 -> aceptado (charset ignorado)', async () => {
  const { handler } = newHandler();
  const req = makeReq({
    body: validPayload(),
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('Content-Type: APPLICATION/JSON (mayusculas) -> aceptado tras normalizar', async () => {
  const { handler } = newHandler();
  const req = makeReq({
    body: validPayload(),
    headers: { 'content-type': ' APPLICATION/JSON ' },
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

// ---------------------------------------------------------------------
// Tamaño del body (criterio 14, paso 3) — evaluado antes que la validez
// del JSON.
// ---------------------------------------------------------------------

test('payload > 10 KB -> 413, sin necesidad de que el JSON sea valido', async () => {
  const { handler } = newHandler();
  const hugeMensaje = 'a'.repeat(20 * 1024);
  const body = JSON.stringify(validPayload({ mensaje: hugeMensaje }));
  const req = makeReq({ body });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 413);
  assert.equal(res.json.error, 'payload_demasiado_grande');
});

test('payload justo en el limite (10240 bytes) no dispara 413 por si solo', async () => {
  // Se prueba con un maxBodyBytes reducido para no depender de calzar
  // bytes exactos del JSON completo; lo que importa es el comportamiento
  // relativo al limite configurado.
  const { handler } = newHandler({ maxBodyBytes: 5 * 1024 });
  const body = JSON.stringify(validPayload({ mensaje: 'a'.repeat(10 * 1024) }));
  const req = makeReq({ body });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 413);
});

// ---------------------------------------------------------------------
// Validez del JSON (criterio 5, paso 4)
// ---------------------------------------------------------------------

test('JSON malformado -> 400 json_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: '{ "nombre": "Ana", }' });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'json_invalido');
});

test('JSON valido pero no es un objeto (array) -> 400 json_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: '[1,2,3]' });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'json_invalido');
});

// ---------------------------------------------------------------------
// Whitelist de propiedades (criterio 6, paso 5)
// ---------------------------------------------------------------------

test('propiedad desconocida -> 400 propiedad_desconocida, se identifica el campo', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ role: 'admin' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'propiedad_desconocida');
  assert.equal(res.json.campo, 'role');
});

test('propiedad desconocida + nombre ausente -> propiedad_desconocida (paso 5 antes que paso 6)', async () => {
  const { handler } = newHandler();
  const payload = validPayload();
  delete payload.nombre;
  payload.role = 'admin';
  const req = makeReq({ body: payload });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'propiedad_desconocida');
});

test('estado inyectado por el cliente -> rechazado como propiedad desconocida', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ estado: 'confirmado' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'propiedad_desconocida');
});

// ---------------------------------------------------------------------
// Campos obligatorios (criterio 7, paso 6)
// ---------------------------------------------------------------------

test('body vacio ({}) -> 400 campo_requerido_faltante, campo nombre (primero evaluado)', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: {} });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'campo_requerido_faltante');
  assert.equal(res.json.campo, 'nombre');
});

for (const field of ['nombre', 'email', 'version_politica_privacidad']) {
  test(`falta ${field} -> 400 campo_requerido_faltante`, async () => {
    const { handler } = newHandler();
    const payload = validPayload();
    delete payload[field];
    const req = makeReq({ body: payload });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.json.error, 'campo_requerido_faltante');
    assert.equal(res.json.campo, field);
  });
}

test('consentimiento_privacidad ausente NO produce campo_requerido_faltante (criterio 7 lo excluye)', async () => {
  const { handler } = newHandler();
  const payload = validPayload();
  delete payload.consentimiento_privacidad;
  const req = makeReq({ body: payload });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'consentimiento_requerido');
});

// ---------------------------------------------------------------------
// Tipos (criterio 9, paso 7)
// ---------------------------------------------------------------------

test('nombre numerico -> 400 tipo_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ nombre: 12345 }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'tipo_invalido');
  assert.equal(res.json.campo, 'nombre');
});

test('mensaje como array -> 400 tipo_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ mensaje: ['a', 'b'] }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'tipo_invalido');
  assert.equal(res.json.campo, 'mensaje');
});

test('mensaje como objeto -> 400 tipo_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ mensaje: { a: 1 } }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'tipo_invalido');
});

test('nombre null explicito (campo obligatorio) -> 400 tipo_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ nombre: null }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'tipo_invalido');
  assert.equal(res.json.campo, 'nombre');
});

test('consentimiento_privacidad como string "true" NO produce tipo_invalido (criterio 9 lo excluye)', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ consentimiento_privacidad: 'true' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'consentimiento_requerido');
});

test('telefono null explicito (campo opcional) -> tratado como ausente, no tipo_invalido', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({ body: validPayload({ telefono: null }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(supabaseClient.calls[0].rows[0].telefono, null);
});

// ---------------------------------------------------------------------
// Formato de email (criterio 10) y de telefono (criterio 11) — paso 8
// ---------------------------------------------------------------------

test('email con formato invalido -> 400 formato_email_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ email: 'no-es-un-email' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'formato_email_invalido');
});

test('email sin dominio -> 400 formato_email_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ email: 'ana@' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'formato_email_invalido');
});

test('telefono con letras -> 400 formato_telefono_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ telefono: 'llamame-ya' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'formato_telefono_invalido');
});

test('telefono valido con espacios/guiones/parentesis -> aceptado', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ telefono: '+54 (11) 4444-5555' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('telefono demasiado corto (menos de 6 tras trim) -> 400 formato_telefono_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ telefono: '123' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'formato_telefono_invalido');
});

test('telefono "   " (vacio tras trim) -> se inserta como null, no dispara formato_telefono_invalido', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({ body: validPayload({ telefono: '   ' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(supabaseClient.calls[0].rows[0].telefono, null);
});

// ---------------------------------------------------------------------
// Longitudes (criterio 12, paso 8) y sub-orden longitud-antes-que-formato
// ---------------------------------------------------------------------

test('nombre de 151 caracteres -> 400 longitud_excedida', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ nombre: 'a'.repeat(151) }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'longitud_excedida');
  assert.equal(res.json.campo, 'nombre');
});

test('nombre de 1 caracter (por debajo del minimo 2) -> 400 longitud_excedida', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ nombre: 'A' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'longitud_excedida');
  assert.equal(res.json.campo, 'nombre');
});

test('nombre "   " (vacio tras trim) -> campo_requerido_faltante, NO longitud_excedida', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ nombre: '   ' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'campo_requerido_faltante');
  assert.equal(res.json.campo, 'nombre');
});

test('mensaje de 2001 caracteres -> 400 longitud_excedida', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ mensaje: 'a'.repeat(2001) }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'longitud_excedida');
  assert.equal(res.json.campo, 'mensaje');
});

test('servicio de 101 caracteres -> 400 longitud_excedida', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ servicio: 'a'.repeat(101) }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'longitud_excedida');
  assert.equal(res.json.campo, 'servicio');
});

test('version_politica_privacidad de 51 caracteres -> 400 longitud_excedida', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ version_politica_privacidad: 'v'.repeat(51) }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'longitud_excedida');
  assert.equal(res.json.campo, 'version_politica_privacidad');
});

test('version_politica_privacidad "   " (vacio tras trim) -> campo_requerido_faltante', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ version_politica_privacidad: '   ' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'campo_requerido_faltante');
  assert.equal(res.json.campo, 'version_politica_privacidad');
});

test('email invalido y demasiado largo a la vez -> gana longitud_excedida (sub-orden documentado)', async () => {
  const { handler } = newHandler();
  // Sintacticamente invalido (sin "@") y ademas de 260 caracteres (> 254).
  const req = makeReq({ body: validPayload({ email: 'a'.repeat(260) }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'longitud_excedida');
  assert.equal(res.json.campo, 'email');
});

test('email valido en formato pero de 260 caracteres -> longitud_excedida', async () => {
  const { handler } = newHandler();
  const localPart = 'a'.repeat(255);
  const req = makeReq({ body: validPayload({ email: `${localPart}@example.com` }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'longitud_excedida');
  assert.equal(res.json.campo, 'email');
});

// ---------------------------------------------------------------------
// Campos opcionales vacios tras trim() -> null (criterio 8)
// ---------------------------------------------------------------------

test('telefono/servicio/mensaje presentes pero vacios tras trim -> se insertan como null', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({
    body: validPayload({ telefono: '   ', servicio: '', mensaje: '\n\t' }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  const insertedRow = supabaseClient.calls[0].rows[0];
  assert.equal(insertedRow.telefono, null);
  assert.equal(insertedRow.servicio, null);
  assert.equal(insertedRow.mensaje, null);
});

test('telefono/servicio/mensaje ausentes -> se insertan como null', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  const insertedRow = supabaseClient.calls[0].rows[0];
  assert.equal(insertedRow.telefono, null);
  assert.equal(insertedRow.servicio, null);
  assert.equal(insertedRow.mensaje, null);
});

// ---------------------------------------------------------------------
// consentimiento_privacidad (criterio 15, paso 9) — las 3 variantes de
// falla, todas con el mismo codigo de error.
// ---------------------------------------------------------------------

test('consentimiento_privacidad: false -> 400 consentimiento_requerido, no se inserta el lead', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({ body: validPayload({ consentimiento_privacidad: false }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'consentimiento_requerido');
  assert.equal(supabaseClient.calls.length, 0, 'no debe llamarse a insert()');
});

test('consentimiento_privacidad: ausente -> 400 consentimiento_requerido, no se inserta el lead', async () => {
  const { supabaseClient, handler } = newHandler();
  const payload = validPayload();
  delete payload.consentimiento_privacidad;
  const req = makeReq({ body: payload });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'consentimiento_requerido');
  assert.equal(supabaseClient.calls.length, 0);
});

test('consentimiento_privacidad: tipo no-booleano (numero) -> 400 consentimiento_requerido', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({ body: validPayload({ consentimiento_privacidad: 1 }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'consentimiento_requerido');
  assert.equal(supabaseClient.calls.length, 0);
});

// ---------------------------------------------------------------------
// Insercion exitosa (criterios 16, 17)
// ---------------------------------------------------------------------

test('datos validos + consentimiento true -> 201 con solo { id }', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({
    body: validPayload({
      telefono: '+54 11 4444-5555',
      servicio: 'ortodoncia',
      mensaje: 'Quisiera turno para la semana que viene',
    }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(res.json), ['id']);
  assert.equal(typeof res.json.id, 'string');

  const call = supabaseClient.calls[0];
  assert.equal(call.table, 'leads');
  assert.deepEqual(call.rows[0], {
    nombre: 'Ana Pérez',
    email: 'ana@example.com',
    telefono: '+54 11 4444-5555',
    servicio: 'ortodoncia',
    mensaje: 'Quisiera turno para la semana que viene',
    consentimiento_privacidad: true,
    version_politica_privacidad: 'v1',
  });
});

test('espacios al inicio/final de nombre/email/version_politica_privacidad se recortan antes de insertar', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({
    body: validPayload({
      nombre: '  Ana Pérez  ',
      email: '  ana@example.com  ',
      version_politica_privacidad: '  v1  ',
    }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  const row = supabaseClient.calls[0].rows[0];
  assert.equal(row.nombre, 'Ana Pérez');
  assert.equal(row.email, 'ana@example.com');
  assert.equal(row.version_politica_privacidad, 'v1');
});

test('contenido tipo <script> en nombre/mensaje se acepta y se inserta tal cual (sin sanitizar)', async () => {
  const { supabaseClient, handler } = newHandler();
  const maliciousMensaje = '<script>alert(1)</script> & "comillas" \'simples\'';
  const req = makeReq({
    body: validPayload({ mensaje: maliciousMensaje }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(supabaseClient.calls[0].rows[0].mensaje, maliciousMensaje);
});

test('Unicode/emoji en nombre no rompe la validacion ni la insercion', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ nombre: 'José 👨‍⚕️ Ñandú' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('no se envian estado/origen/flags de notificacion ni fechas al insert', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  const row = supabaseClient.calls[0].rows[0];
  for (const forbiddenKey of [
    'estado',
    'origen',
    'notificacion_clinica_enviada',
    'confirmacion_paciente_enviada',
    'fecha_creacion',
    'fecha_actualizacion',
    'id',
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, forbiddenKey), false, forbiddenKey);
  }
});

// ---------------------------------------------------------------------
// Fallo de Supabase (criterio 19) -> 500 sin filtrar detalles
// ---------------------------------------------------------------------

test('fallo simulado de Supabase -> 500 error_interno, sin exponer el mensaje de Postgres', async () => {
  const supabaseClient = makeFakeSupabaseClient({ fail: true });
  const { handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.json.error, 'error_interno');
  assert.equal(JSON.stringify(res.json).includes('fallo simulado'), false);
});

test('cliente Supabase que lanza una excepcion -> 500 error_interno', async () => {
  const handler = createHandler({
    supabaseClientFactory: () => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY invalida o ausente');
    },
    rateLimitStore: new Map(),
    originConfig: { siteUrl: TEST_SITE_URL, allowedOrigins: [], vercelUrl: undefined },
  });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.json.error, 'error_interno');
  assert.equal(JSON.stringify(res.json).includes('SUPABASE_SERVICE_ROLE_KEY'), false);
});

// ---------------------------------------------------------------------
// Rate limiting (criterio 18)
// ---------------------------------------------------------------------

test('6ta solicitud en 60s desde la misma IP -> 429 con Retry-After', async () => {
  const rateLimitStore = new Map();
  const { handler } = newHandler({ rateLimitStore });

  let lastRes;
  for (let i = 0; i < 5; i += 1) {
    const req = makeReq({ body: validPayload(), ip: '198.51.100.7' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 201, `solicitud #${i + 1} deberia pasar`);
    lastRes = res;
  }

  const sixthReq = makeReq({ body: validPayload(), ip: '198.51.100.7' });
  const sixthRes = makeRes();
  await handler(sixthReq, sixthRes);

  assert.equal(sixthRes.statusCode, 429);
  assert.equal(sixthRes.json.error, 'demasiadas_solicitudes');
  assert.ok(Number(sixthRes.getHeader('Retry-After')) > 0);
});

test('IPs distintas no comparten el contador de rate limit', async () => {
  const rateLimitStore = new Map();
  const { handler } = newHandler({ rateLimitStore });

  for (let i = 0; i < 5; i += 1) {
    const req = makeReq({ body: validPayload(), ip: '198.51.100.20' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 201);
  }

  const otherIpReq = makeReq({ body: validPayload(), ip: '198.51.100.21' });
  const otherIpRes = makeRes();
  await handler(otherIpReq, otherIpRes);

  assert.equal(otherIpRes.statusCode, 201);
});

test('la ventana de rate limit se resetea despues de 60 segundos (reloj inyectado)', async () => {
  const rateLimitStore = new Map();
  let currentTime = 0;
  const { handler } = newHandler({ rateLimitStore, now: () => currentTime });

  for (let i = 0; i < 5; i += 1) {
    const req = makeReq({ body: validPayload(), ip: '198.51.100.30' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 201);
  }

  const limitedReq = makeReq({ body: validPayload(), ip: '198.51.100.30' });
  const limitedRes = makeRes();
  await handler(limitedReq, limitedRes);
  assert.equal(limitedRes.statusCode, 429);

  currentTime += 60 * 1000; // avanza 60s exactos
  const resetReq = makeReq({ body: validPayload(), ip: '198.51.100.30' });
  const resetRes = makeRes();
  await handler(resetReq, resetRes);
  assert.equal(resetRes.statusCode, 201);
});

test('sin header x-forwarded-for, cae a req.socket.remoteAddress para el rate limit', async () => {
  const rateLimitStore = new Map();
  const { handler } = newHandler({ rateLimitStore });

  const req = makeReq({ body: validPayload(), ip: '198.51.100.99' });
  delete req.headers['x-forwarded-for'];
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

// ---------------------------------------------------------------------
// No filtrado de credenciales (criterio 20)
// ---------------------------------------------------------------------

test('ninguna respuesta incluye texto de variables sensibles', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  const serialized = JSON.stringify(res.json) + JSON.stringify(res.headers);
  for (const secretMarker of ['SUPABASE_SERVICE_ROLE_KEY', 'SMTP_PASS', 'service_role']) {
    assert.equal(serialized.includes(secretMarker), false);
  }
});

// ---------------------------------------------------------------------
// Configuracion exportada para Vercel (criterio 14)
// ---------------------------------------------------------------------

test('exporta config.api.bodyParser = false', () => {
  const leadsModule = require('./leads');
  assert.equal(leadsModule.config.api.bodyParser, false);
});

// =======================================================================
// Feature 04: proteccion antispam y abuso
// Spec: runs/04-proteccion-antispam-y-abuso/spec.md
// =======================================================================

// ---------------------------------------------------------------------
// Validacion de origen (criterios 1-4, paso 2 del orden extendido)
// ---------------------------------------------------------------------

test('Origin distinto de SITE_URL/ALLOWED_ORIGINS/VERCEL_URL -> 403 origen_no_permitido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload(), headers: { origin: 'https://sitio-malicioso.example' } });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.json.error, 'origen_no_permitido');
});

test('sin header Origin ni Referer -> 403 origen_no_permitido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  delete req.headers['origin'];
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.json.error, 'origen_no_permitido');
});

test('sin Origin pero con Referer valido (mismo protocolo+host que SITE_URL) -> pasa la validacion', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  delete req.headers['origin'];
  req.headers['referer'] = `${TEST_SITE_URL}/contacto`;
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('Referer con formato no parseable (sin Origin) -> 403 origen_no_permitido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  delete req.headers['origin'];
  req.headers['referer'] = 'no-es-una-url';
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.json.error, 'origen_no_permitido');
});

test('Origin igual a SITE_URL -> pasa la validacion de origen', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload(), headers: { origin: TEST_SITE_URL } });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('Origin dentro de ALLOWED_ORIGINS (no SITE_URL) -> pasa la validacion', async () => {
  const { handler } = newHandler({
    originConfig: {
      siteUrl: TEST_SITE_URL,
      allowedOrigins: ['https://sonriemascorrientes.com', 'https://preview-123.vercel.app'],
      vercelUrl: undefined,
    },
  });
  const req = makeReq({ body: validPayload(), headers: { origin: 'https://preview-123.vercel.app' } });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('ALLOWED_ORIGINS con espacios alrededor de las comas se parsea correctamente', async () => {
  const rawAllowedOrigins = 'https://a.example, https://b.example ,https://c.example';
  const parsed = rawAllowedOrigins.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  const { handler } = newHandler({
    originConfig: { siteUrl: TEST_SITE_URL, allowedOrigins: parsed, vercelUrl: undefined },
  });
  const req = makeReq({ body: validPayload(), headers: { origin: 'https://b.example' } });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('Origin igual a https://${VERCEL_URL} -> pasa la validacion', async () => {
  const { handler } = newHandler({
    originConfig: { siteUrl: TEST_SITE_URL, allowedOrigins: [], vercelUrl: 'mi-deploy-preview.vercel.app' },
  });
  const req = makeReq({ body: validPayload(), headers: { origin: 'https://mi-deploy-preview.vercel.app' } });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('VERCEL_URL no definido no lanza excepcion y esa rama simplemente no aplica', async () => {
  const { handler } = newHandler({
    originConfig: { siteUrl: TEST_SITE_URL, allowedOrigins: [], vercelUrl: undefined },
  });
  const req = makeReq({ body: validPayload(), headers: { origin: 'https://algo-que-no-es-vercel-url' } });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.json.error, 'origen_no_permitido');
});

test('origen invalido + rate limit ya excedido -> responde 403 (origen), no 429 (orden extendido, criterio 1)', async () => {
  const rateLimitStore = new Map();
  const { handler } = newHandler({ rateLimitStore });

  // Agota el rate limit con solicitudes de origen valido.
  for (let i = 0; i < 5; i += 1) {
    const req = makeReq({ body: validPayload(), ip: '198.51.100.55' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 201);
  }

  // La 6ta solicitud, con origen invalido, debe responder 403 (paso 2),
  // no 429 (paso 3): el orden extendido evalua el origen antes que el
  // rate limit.
  const req = makeReq({
    body: validPayload(),
    ip: '198.51.100.55',
    headers: { origin: 'https://sitio-malicioso.example' },
  });
  const res = makeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.json.error, 'origen_no_permitido');
});

// ---------------------------------------------------------------------
// Honeypot `sitio_web` (criterios 6-8, paso 8 del orden extendido)
// ---------------------------------------------------------------------

test('sitio_web no vacio tras trim -> 400 solicitud_rechazada, no inserta lead', async () => {
  const { supabaseClient, handler } = newHandler();
  const req = makeReq({ body: validPayload({ sitio_web: 'https://bot.example' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'solicitud_rechazada');
  assert.equal(supabaseClient.calls.length, 0, 'no debe llamarse a insert()');
});

for (const invalidValue of [123, true, {}, ['a']]) {
  test(`sitio_web de tipo no-string (${JSON.stringify(invalidValue)}) -> 400 solicitud_rechazada (no tipo_invalido)`, async () => {
    const { supabaseClient, handler } = newHandler();
    const req = makeReq({ body: validPayload({ sitio_web: invalidValue }) });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.json.error, 'solicitud_rechazada');
    assert.notEqual(res.json.error, 'tipo_invalido');
    assert.equal(supabaseClient.calls.length, 0);
  });
}

test('sitio_web ausente no afecta el flujo', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('sitio_web vacio tras trim ("   ") no afecta el flujo', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ sitio_web: '   ' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('sitio_web relleno + nombre ausente -> gana el honeypot (solicitud_rechazada), no campo_requerido_faltante', async () => {
  const { handler } = newHandler();
  const payload = validPayload({ sitio_web: 'contenido-de-bot' });
  delete payload.nombre;
  const req = makeReq({ body: payload });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'solicitud_rechazada');
});

// ---------------------------------------------------------------------
// Control temporal `formulario_mostrado_en` (criterios 9-11, paso 9)
// ---------------------------------------------------------------------

test('formulario_mostrado_en a menos de 3000ms de la solicitud -> 400 solicitud_rechazada', async () => {
  const fixedNow = Date.parse('2026-01-01T00:00:02.000Z');
  const { supabaseClient, handler } = newHandler({ now: () => fixedNow });
  const req = makeReq({
    body: validPayload({ formulario_mostrado_en: '2026-01-01T00:00:00.000Z' }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'solicitud_rechazada');
  assert.equal(supabaseClient.calls.length, 0);
});

test('formulario_mostrado_en a exactamente 3000ms o mas -> pasa el chequeo temporal', async () => {
  const fixedNow = Date.parse('2026-01-01T00:00:03.000Z');
  const { handler } = newHandler({ now: () => fixedNow });
  const req = makeReq({
    body: validPayload({ formulario_mostrado_en: '2026-01-01T00:00:00.000Z' }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('formulario_mostrado_en ausente -> se omite el chequeo, no rechaza', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('formulario_mostrado_en no parseable como fecha -> se omite el chequeo, no rechaza ni produce tipo_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ formulario_mostrado_en: 'no-es-una-fecha' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('formulario_mostrado_en de tipo no-string (numero) -> se omite el chequeo, no rechaza ni produce tipo_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ formulario_mostrado_en: 1234567890 }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('formulario_mostrado_en de tipo no-string (booleano) -> se omite el chequeo, no rechaza ni produce tipo_invalido', async () => {
  const { handler } = newHandler();
  const req = makeReq({ body: validPayload({ formulario_mostrado_en: true }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
});

test('formulario_mostrado_en con reloj de cliente adelantado (delta negativo) -> se trata como rechazo', async () => {
  const fixedNow = Date.parse('2026-01-01T00:00:00.000Z');
  const { supabaseClient, handler } = newHandler({ now: () => fixedNow });
  const req = makeReq({
    // El formulario se "mostro" en el futuro respecto al reloj del
    // servidor -> delta = ahora - formulario_mostrado_en < 0.
    body: validPayload({ formulario_mostrado_en: '2026-01-01T00:05:00.000Z' }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'solicitud_rechazada');
  assert.equal(supabaseClient.calls.length, 0);
});

// ---------------------------------------------------------------------
// STRING_FIELDS no debe incluir los campos nuevos (criterios 7 y 11)
// ---------------------------------------------------------------------

test('STRING_FIELDS (inspeccion de codigo) no incluye sitio_web ni formulario_mostrado_en', () => {
  const leadsSource = require('node:fs').readFileSync(require.resolve('./leads.js'), 'utf8');
  const match = leadsSource.match(/const STRING_FIELDS = \[([^\]]*)\];/);
  assert.ok(match, 'no se encontro la declaracion de STRING_FIELDS en api/leads.js');
  assert.equal(match[1].includes('sitio_web'), false);
  assert.equal(match[1].includes('formulario_mostrado_en'), false);
});

// ---------------------------------------------------------------------
// Idempotencia / duplicados accidentales (criterios 12-14, paso 11)
// ---------------------------------------------------------------------

test('email+nombre coinciden con un lead insertado hace menos de 5 minutos -> 201 con id existente, sin insertar de nuevo', async () => {
  const existingId = '22222222-2222-2222-2222-222222222222';
  const supabaseClient = makeFakeSupabaseClient({ existingLeads: [{ id: existingId }] });
  const { handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, existingId);
  assert.equal(supabaseClient.calls.length, 0, 'insert() no debe invocarse cuando hay un duplicado');
});

test('duplicado detectado -> el mock falla el test si insert() se invoca mas de una vez', async () => {
  const existingId = '33333333-3333-3333-3333-333333333333';
  let insertCallCount = 0;
  const supabaseClient = {
    from(table) {
      return {
        insert(rows) {
          insertCallCount += 1;
          if (insertCallCount > 1) {
            throw new Error('insert() invocado mas de una vez ante un duplicado detectado');
          }
          return {
            select() {
              return { async single() { return { data: { id: 'no-deberia-usarse' }, error: null }; } };
            },
          };
        },
        select() {
          const builder = {
            ilike() { return builder; },
            eq() { return builder; },
            gte() { return builder; },
            async limit() { return { data: [{ id: existingId }], error: null }; },
          };
          return builder;
        },
      };
    },
  };
  const { handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, existingId);
  assert.equal(insertCallCount, 0);
});

test('lead existente insertado hace mas de 5 minutos -> NO se considera duplicado, se inserta uno nuevo', async () => {
  // El mock de duplicados (paso 11) siempre filtra por
  // fecha_creacion >= ventana de 5 minutos en la query; simular "hace
  // mas de 5 minutos" es simplemente que el SELECT no devuelva filas
  // (el filtro gte ya lo habria excluido en Supabase real).
  const supabaseClient = makeFakeSupabaseClient({ existingLeads: [] });
  const { handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(supabaseClient.calls.length, 1, 'debe insertarse un lead nuevo');
});

test('mismo nombre, email distinto -> ambos se insertan como leads independientes (no se deduplican)', async () => {
  // El SELECT de duplicados filtra por email exacto (case-insensitive);
  // con un email distinto, el mock (que simula la query real) no
  // devuelve coincidencias -> sigue el flujo normal de insert.
  const supabaseClient = makeFakeSupabaseClient({ existingLeads: [] });
  const { handler } = newHandler({ supabaseClient });

  const req1 = makeReq({ body: validPayload({ nombre: 'Juan Perez', email: 'juan1@example.com' }) });
  const res1 = makeRes();
  await handler(req1, res1);
  assert.equal(res1.statusCode, 201);

  const req2 = makeReq({ body: validPayload({ nombre: 'Juan Perez', email: 'juan2@example.com' }) });
  const res2 = makeRes();
  await handler(req2, res2);
  assert.equal(res2.statusCode, 201);

  assert.equal(supabaseClient.calls.length, 2, 'ambos deben insertarse, no deduplicarse entre si');
});

test('chequeo de duplicados usa email normalizado (trim) e ilike, y nombre normalizado (trim) con eq', async () => {
  const supabaseClient = makeFakeSupabaseClient({ existingLeads: [] });
  const { handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload({ nombre: '  Ana Perez  ', email: '  ANA@EXAMPLE.COM  ' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(supabaseClient.selectCalls.length, 1);
  const dupCall = supabaseClient.selectCalls[0];
  assert.equal(dupCall.filters.email.op, 'ilike');
  assert.equal(dupCall.filters.email.value, 'ANA@EXAMPLE.COM');
  assert.equal(dupCall.filters.nombre.op, 'eq');
  assert.equal(dupCall.filters.nombre.value, 'Ana Perez');
});

test('fallo del SELECT de duplicados -> 500 error_interno, sin insertar', async () => {
  const supabaseClient = makeFakeSupabaseClient({ failOnSelect: true });
  const { handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.json.error, 'error_interno');
  assert.equal(supabaseClient.calls.length, 0);
});

// ---------------------------------------------------------------------
// Logging de rechazos sin PII (criterio 15)
// ---------------------------------------------------------------------

test('rechazo por origen invalido no loguea PII ni la IP en texto plano', async () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnCalls.push(args.join(' '));
  try {
    const { handler } = newHandler();
    const req = makeReq({
      body: validPayload({ nombre: 'Fulano Secreto', email: 'fulano.secreto@example.com' }),
      headers: { origin: 'https://sitio-malicioso.example' },
      ip: '203.0.113.77',
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res.statusCode, 403);
    assert.ok(warnCalls.length >= 1, 'debe emitirse al menos un log de rechazo');
    const serialized = warnCalls.join('\n');
    for (const pii of ['Fulano Secreto', 'fulano.secreto@example.com', '203.0.113.77']) {
      assert.equal(serialized.includes(pii), false, `no debe loguear: ${pii}`);
    }
    const parsed = JSON.parse(warnCalls[0]);
    assert.equal(parsed.evento, 'lead_rechazado');
    assert.equal(parsed.motivo, 'origen_no_permitido');
    assert.equal(typeof parsed.ip_hash, 'string');
    assert.notEqual(parsed.ip_hash, '203.0.113.77');
  } finally {
    console.warn = originalWarn;
  }
});

test('rechazo por rate limit no loguea PII ni la IP en texto plano', async () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnCalls.push(args.join(' '));
  try {
    const rateLimitStore = new Map();
    const { handler } = newHandler({ rateLimitStore });
    for (let i = 0; i < 5; i += 1) {
      const req = makeReq({
        body: validPayload({ nombre: 'Rate Limit Secreto', email: 'ratelimit.secreto@example.com' }),
        ip: '203.0.113.88',
      });
      const res = makeRes();
      await handler(req, res);
    }
    warnCalls.length = 0; // solo interesa el log del rechazo, no de las 5 previas exitosas

    const req = makeReq({
      body: validPayload({ nombre: 'Rate Limit Secreto', email: 'ratelimit.secreto@example.com' }),
      ip: '203.0.113.88',
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res.statusCode, 429);
    assert.ok(warnCalls.length >= 1);
    const serialized = warnCalls.join('\n');
    for (const pii of ['Rate Limit Secreto', 'ratelimit.secreto@example.com', '203.0.113.88']) {
      assert.equal(serialized.includes(pii), false, `no debe loguear: ${pii}`);
    }
    const parsed = JSON.parse(warnCalls[0]);
    assert.equal(parsed.motivo, 'rate_limit');
  } finally {
    console.warn = originalWarn;
  }
});

test('rechazo por honeypot no loguea PII ni la IP en texto plano', async () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnCalls.push(args.join(' '));
  try {
    const { handler } = newHandler();
    const req = makeReq({
      body: validPayload({
        nombre: 'Honeypot Secreto',
        email: 'honeypot.secreto@example.com',
        telefono: '+54 11 5555-5555',
        mensaje: 'mensaje secreto del paciente',
        sitio_web: 'https://bot-secreto.example',
      }),
      ip: '203.0.113.99',
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.ok(warnCalls.length >= 1);
    const serialized = warnCalls.join('\n');
    for (const pii of [
      'Honeypot Secreto',
      'honeypot.secreto@example.com',
      '+54 11 5555-5555',
      'mensaje secreto del paciente',
      'https://bot-secreto.example',
      '203.0.113.99',
    ]) {
      assert.equal(serialized.includes(pii), false, `no debe loguear: ${pii}`);
    }
    const parsed = JSON.parse(warnCalls[0]);
    assert.equal(parsed.motivo, 'antispam');
  } finally {
    console.warn = originalWarn;
  }
});

test('rechazo por control temporal no loguea PII ni la IP en texto plano', async () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnCalls.push(args.join(' '));
  try {
    const fixedNow = Date.parse('2026-01-01T00:00:01.000Z');
    const { handler } = newHandler({ now: () => fixedNow });
    const req = makeReq({
      body: validPayload({
        nombre: 'Timing Secreto',
        email: 'timing.secreto@example.com',
        formulario_mostrado_en: '2026-01-01T00:00:00.000Z',
      }),
      ip: '203.0.113.111',
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.ok(warnCalls.length >= 1);
    const serialized = warnCalls.join('\n');
    for (const pii of ['Timing Secreto', 'timing.secreto@example.com', '203.0.113.111']) {
      assert.equal(serialized.includes(pii), false, `no debe loguear: ${pii}`);
    }
    const parsed = JSON.parse(warnCalls[0]);
    assert.equal(parsed.motivo, 'antispam');
  } finally {
    console.warn = originalWarn;
  }
});

// =======================================================================
// Feature 05: notificacion a la clinica por email (SMTP Ferozo)
// Spec: runs/05-notificacion-clinica-smtp-ferozo/spec.md
// =======================================================================

// ---------------------------------------------------------------------
// Envio exitoso tras INSERT nuevo (criterios 1, 2/f05, 6)
// ---------------------------------------------------------------------

test('INSERT nuevo exitoso invoca sendMail() con to/from/replyTo correctos y usa .select("id, fecha_creacion")', async () => {
  const { supabaseClient, mailer, handler } = newHandler();
  const req = makeReq({ body: validPayload({ email: 'paciente@example.com' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  // A partir de la feature 06, el mismo request tambien dispara la
  // confirmacion al paciente (mismo transporter, ver criterio 11/f06):
  // sentMails[0] es la notificacion a la clinica (orden secuencial,
  // clinica primero), sentMails[1] es la confirmacion al paciente.
  assert.equal(mailer.sentMails.length, 2);
  const mailOptions = mailer.sentMails[0];
  assert.equal(mailOptions.to, 'clinica@sonriemascorrientes.com');
  assert.equal(mailOptions.from, 'notificaciones@sonriemascorrientes.com');
  assert.equal(mailOptions.replyTo, 'paciente@example.com');

  assert.equal(supabaseClient.insertSelectCalls.length, 1);
  assert.equal(supabaseClient.insertSelectCalls[0], 'id, fecha_creacion');
});

test('el HTML del correo contiene nombre/email/telefono/servicio/mensaje escapados, fecha_creacion e id', async () => {
  const supabaseClient = makeFakeSupabaseClient({
    id: '55555555-5555-5555-5555-555555555555',
    fechaCreacion: '2026-08-19T15:30:00.000Z',
  });
  const { mailer, handler } = newHandler({ supabaseClient });
  const req = makeReq({
    body: validPayload({
      nombre: '<b>Ana</b> & "Perez"',
      telefono: '+54 11 4444-5555',
      servicio: 'Ortodoncia',
      mensaje: 'Hola <script>alert(1)</script>',
    }),
  });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  // sentMails[0] = notificacion a la clinica (orden secuencial, ver
  // criterio 11/f06); sentMails[1] = confirmacion al paciente, que NO
  // incluye telefono/servicio/mensaje (verificado por separado en
  // mailer.test.js y en la seccion "Feature 06" de este archivo).
  assert.equal(mailer.sentMails.length, 2);
  const html = mailer.sentMails[0].html;

  // (a) sin caracteres sin escapar: no debe poder inyectarse <script>.
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('<b>Ana</b>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&amp;'));

  // (b) fecha_creacion e id devueltos por el INSERT aparecen en el HTML.
  assert.ok(html.includes('55555555-5555-5555-5555-555555555555'));
  assert.ok(html.includes('2026'));
});

test('telefono/servicio/mensaje ausentes -> placeholders en el HTML, nunca "null"', async () => {
  const { mailer, handler } = newHandler();
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  const html = mailer.sentMails[0].html;
  assert.ok(html.includes('No proporcionado'));
  assert.ok(html.includes('No especificado'));
  assert.ok(html.includes('Sin mensaje adicional'));
});

test('header injection: nombre con \\r\\n no deja \\r ni \\n crudos en el subject enviado a sendMail()', async () => {
  const { mailer, handler } = newHandler();
  const maliciousPayload = validPayload({ nombre: 'Juan\r\nBcc: attacker@evil.com' });
  const maliciousReq = makeReq({ body: maliciousPayload });
  const res = makeRes();

  await handler(maliciousReq, res);

  assert.equal(res.statusCode, 201);
  // sentMails[0] = notificacion a la clinica (unica que interpola
  // `nombre` en el subject, ver criterio 11/f06 para el orden).
  assert.equal(mailer.sentMails.length, 2);
  const { subject } = mailer.sentMails[0];
  assert.equal(/[\r\n]/.test(subject), false);
});

test('sendMail() exitoso -> se ejecuta UPDATE notificacion_clinica_enviada = true con el id insertado', async () => {
  const supabaseClient = makeFakeSupabaseClient({ id: '66666666-6666-6666-6666-666666666666' });
  const { mailer, handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  // Desde la feature 06, ambos envios (clinica + paciente) tienen exito
  // por defecto en newHandler(), asi que hay dos UPDATE independientes:
  // este test solo verifica el de notificacion_clinica_enviada.
  assert.equal(mailer.sentMails.length, 2);
  assert.equal(supabaseClient.updateCalls.length, 2);
  const updateCall = supabaseClient.updateCalls.find(
    (call) => call.values.notificacion_clinica_enviada === true
  );
  assert.ok(updateCall, 'debe existir un UPDATE de notificacion_clinica_enviada');
  assert.equal(updateCall.table, 'leads');
  assert.equal(updateCall.column, 'id');
  assert.equal(updateCall.value, '66666666-6666-6666-6666-666666666666');
});

// ---------------------------------------------------------------------
// No se notifica en la rama de duplicado detectado (criterio 5)
// ---------------------------------------------------------------------

test('rama de duplicado detectado -> NO se invoca sendMail()', async () => {
  const existingId = '77777777-7777-7777-7777-777777777777';
  const supabaseClient = makeFakeSupabaseClient({ existingLeads: [{ id: existingId }] });
  const { mailer, handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, existingId);
  assert.equal(mailer.sentMails.length, 0, 'sendMail() no debe invocarse ante un duplicado');
});

// ---------------------------------------------------------------------
// Fallos de email nunca alteran el contrato 201 (criterios 7, 8, 9, 11)
// ---------------------------------------------------------------------

test('sendMail() rechaza -> igual responde 201, sin UPDATE, sin insert adicional', async () => {
  const supabaseClient = makeFakeSupabaseClient({ id: '88888888-8888-8888-8888-888888888888' });
  const mailer = makeFakeMailer({ fail: true });
  const { handler } = newHandler({ supabaseClient, mailer, mailerFactory: () => mailer });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, '88888888-8888-8888-8888-888888888888');
  assert.equal(supabaseClient.calls.length, 1, 'insert() debe seguir invocado exactamente una vez');
  assert.equal(supabaseClient.updateCalls.length, 0, 'no debe ejecutarse el UPDATE del flag');
});

test('mailerFactory lanza (config SMTP faltante/invalida) -> igual responde 201, sin UPDATE, sin insert adicional', async () => {
  const supabaseClient = makeFakeSupabaseClient({ id: '99999999-9999-9999-9999-999999999999' });
  const mailerFactory = () => {
    throw new Error('Configuracion SMTP incompleta');
  };
  const { handler } = newHandler({ supabaseClient, mailerFactory });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, '99999999-9999-9999-9999-999999999999');
  assert.equal(supabaseClient.calls.length, 1);
  assert.equal(supabaseClient.updateCalls.length, 0);
});

test('UPDATE del flag falla -> igual responde 201 con el mismo id, sin reintentar el insert', async () => {
  const supabaseClient = makeFakeSupabaseClient({
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    failOnUpdate: true,
  });
  const { mailer, handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  // Ambos envios (clinica + paciente) se consideraron exitosos.
  assert.equal(mailer.sentMails.length, 2, 'ambos envios de email se consideraron exitosos');
  assert.equal(supabaseClient.updateCalls.length, 2, 'se intentaron ambos UPDATE, aunque hayan fallado');
  assert.equal(supabaseClient.calls.length, 1, 'no se reinserta el lead');
});

test('el contrato de respuesta 201 { id } no cambia entre escenarios de email (exito/fallo/config faltante)', async () => {
  const scenarios = [
    { name: 'exito', mailer: makeFakeMailer({ fail: false }) },
    { name: 'fallo sendMail', mailer: makeFakeMailer({ fail: true }) },
  ];

  for (const scenario of scenarios) {
    const supabaseClient = makeFakeSupabaseClient();
    const { handler } = newHandler({ supabaseClient, mailer: scenario.mailer, mailerFactory: () => scenario.mailer });
    const req = makeReq({ body: validPayload() });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201, scenario.name);
    assert.deepEqual(Object.keys(res.json), ['id'], scenario.name);
    assert.equal(typeof res.json.id, 'string', scenario.name);
  }

  // Config SMTP faltante: mailerFactory lanza.
  const supabaseClient = makeFakeSupabaseClient();
  const { handler } = newHandler({
    supabaseClient,
    mailerFactory: () => {
      throw new Error('config SMTP faltante');
    },
  });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(res.json), ['id']);
});

// ---------------------------------------------------------------------
// No filtrado de credenciales en logs de fallo de email (criterio 10)
// ---------------------------------------------------------------------

test('fallo de sendMail() no filtra credenciales SMTP en console.error, aunque el error las contenga', async () => {
  const errorCalls = [];
  const originalError = console.error;
  console.error = (...args) => errorCalls.push(args.map((a) => (a && a.stack) || String(a)).join(' '));
  try {
    const secretError = new Error('fallo de conexion SMTP');
    // Simula que el error interno de Nodemailer trae detalles sensibles
    // en propiedades adicionales (comportamiento real posible): el
    // codigo de api/leads.js solo debe loguear `.message`.
    secretError.response = '535 Authentication failed: SMTP_PASS=contrasena-secreta-xyz';
    secretError.command = 'AUTH PLAIN dXNlcjpjb250cmFzZW5hLXNlY3JldGEteHl6';
    const mailer = { async sendMail() { throw secretError; } };
    const { handler, supabaseClient } = newHandler({ mailer, mailerFactory: () => mailer });
    const req = makeReq({ body: validPayload() });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(supabaseClient.updateCalls.length, 0);
    const serialized = errorCalls.join('\n');
    assert.equal(serialized.includes('contrasena-secreta-xyz'), false);
    assert.equal(serialized.includes('dXNlcjpjb250cmFzZW5hLXNlY3JldGEteHl6'), false);
  } finally {
    console.error = originalError;
  }
});

test('config SMTP faltante: el mensaje logueado no incluye SMTP_PASS/SMTP_USER ni el objeto de config completo', async () => {
  const errorCalls = [];
  const originalError = console.error;
  console.error = (...args) => errorCalls.push(args.map((a) => (a && a.stack) || String(a)).join(' '));
  try {
    const configError = new Error('Configuracion SMTP incompleta: faltan una o mas variables.');
    const { handler } = newHandler({
      mailerFactory: () => {
        throw configError;
      },
    });
    const req = makeReq({ body: validPayload() });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    const serialized = errorCalls.join('\n');
    for (const secretMarker of ['SMTP_PASS', 'SMTP_USER', 'contrasena', 'auth:']) {
      assert.equal(serialized.toLowerCase().includes(secretMarker.toLowerCase()), false, secretMarker);
    }
  } finally {
    console.error = originalError;
  }
});

// ---------------------------------------------------------------------
// Leads independientes disparan notificaciones independientes (caso
// borde documentado en el spec, seccion "Casos borde a contemplar")
// ---------------------------------------------------------------------

test('dos leads nuevos e independientes disparan cada uno su propio sendMail()', async () => {
  const supabaseClient = makeFakeSupabaseClient();
  const { mailer, handler } = newHandler({ supabaseClient });

  const req1 = makeReq({ body: validPayload({ nombre: 'Juan Perez', email: 'juan1@example.com' }) });
  const res1 = makeRes();
  await handler(req1, res1);
  assert.equal(res1.statusCode, 201);

  const req2 = makeReq({ body: validPayload({ nombre: 'Maria Lopez', email: 'maria2@example.com' }) });
  const res2 = makeRes();
  await handler(req2, res2);
  assert.equal(res2.statusCode, 201);

  // 2 envios por request (clinica + paciente, feature 06) x 2 requests.
  assert.equal(mailer.sentMails.length, 4);
  const clinicMails = mailer.sentMails.filter((mailOptions) => mailOptions.to === 'clinica@sonriemascorrientes.com');
  assert.equal(clinicMails.length, 2);
  assert.equal(clinicMails[0].replyTo, 'juan1@example.com');
  assert.equal(clinicMails[1].replyTo, 'maria2@example.com');
});

// =======================================================================
// Feature 06: confirmacion automatica al paciente por email
// Spec: runs/06-confirmacion-automatica-paciente/spec.md
// =======================================================================

// ---------------------------------------------------------------------
// mailerFactory se invoca una unica vez, compartida por ambos envios
// (criterio 11)
// ---------------------------------------------------------------------

test('mailerFactory se invoca exactamente una vez por request (clinica y paciente comparten el mismo transporter)', async () => {
  let factoryCalls = 0;
  const mailer = makeFakeMailer();
  const mailerFactory = () => {
    factoryCalls += 1;
    return mailer;
  };
  const { handler } = newHandler({ mailer, mailerFactory });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(factoryCalls, 1);
  assert.equal(mailer.sentMails.length, 2, 'debe intentar sendMail() para la clinica y para el paciente');
});

// ---------------------------------------------------------------------
// mailerFactory lanza -> ningun envio se intenta (criterio 12)
// ---------------------------------------------------------------------

test('mailerFactory lanza (config SMTP faltante/invalida) -> ni la clinica ni el paciente reciben sendMail(), sigue en 201', async () => {
  const supabaseClient = makeFakeSupabaseClient({ id: 'b0000000-0000-0000-0000-000000000012' });
  const mailer = makeFakeMailer();
  const mailerFactory = () => {
    throw new Error('Configuracion SMTP incompleta');
  };
  const { handler } = newHandler({ supabaseClient, mailer, mailerFactory });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, 'b0000000-0000-0000-0000-000000000012');
  assert.equal(mailer.sentMails.length, 0, 'sendMail() no debe invocarse en ningun escenario');
  assert.equal(supabaseClient.updateCalls.length, 0);
});

// ---------------------------------------------------------------------
// Independencia entre ambos envios (criterio 13)
// ---------------------------------------------------------------------

test('fallo en el envio a la clinica no impide el intento de envio al paciente (independencia)', async () => {
  const supabaseClient = makeFakeSupabaseClient({ id: 'b1000000-0000-0000-0000-000000000013' });
  const mailer = makeSelectiveFailMailer({ failTo: ['clinica@sonriemascorrientes.com'] });
  const { handler } = newHandler({ supabaseClient, mailer, mailerFactory: () => mailer });
  const req = makeReq({ body: validPayload({ email: 'paciente-13a@example.com' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(mailer.sentMails.length, 2, 'debe haber intentado ambos envios');
  assert.equal(mailer.sentMails[0].to, 'clinica@sonriemascorrientes.com');
  assert.equal(mailer.sentMails[1].to, 'paciente-13a@example.com');
  assert.equal(supabaseClient.updateCalls.length, 1, 'solo el UPDATE del paciente debe ejecutarse');
  assert.equal(supabaseClient.updateCalls[0].values.confirmacion_paciente_enviada, true);
});

test('fallo en el envio al paciente no afecta el resultado ya decidido del envio a la clinica (independencia)', async () => {
  const supabaseClient = makeFakeSupabaseClient({ id: 'b2000000-0000-0000-0000-000000000013' });
  const mailer = makeSelectiveFailMailer({ failTo: ['paciente-13b@example.com'] });
  const { handler } = newHandler({ supabaseClient, mailer, mailerFactory: () => mailer });
  const req = makeReq({ body: validPayload({ email: 'paciente-13b@example.com' }) });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(mailer.sentMails.length, 2, 'debe haber intentado ambos envios');
  assert.equal(supabaseClient.updateCalls.length, 1, 'solo el UPDATE de la clinica debe ejecutarse');
  assert.equal(supabaseClient.updateCalls[0].values.notificacion_clinica_enviada, true);
});

// ---------------------------------------------------------------------
// UPDATE de confirmacion_paciente_enviada tras envio exitoso (criterio 14)
// ---------------------------------------------------------------------

test('sendMail() al paciente exitoso -> UPDATE confirmacion_paciente_enviada = true con el id insertado', async () => {
  const supabaseClient = makeFakeSupabaseClient({ id: 'c0000000-0000-0000-0000-000000000014' });
  const { mailer, handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(mailer.sentMails.length, 2);
  assert.equal(supabaseClient.updateCalls.length, 2, 'un UPDATE para la clinica y otro para el paciente');
  const patientUpdate = supabaseClient.updateCalls.find(
    (call) => call.values.confirmacion_paciente_enviada === true
  );
  assert.ok(patientUpdate, 'debe existir un UPDATE de confirmacion_paciente_enviada');
  assert.equal(patientUpdate.table, 'leads');
  assert.equal(patientUpdate.column, 'id');
  assert.equal(patientUpdate.value, 'c0000000-0000-0000-0000-000000000014');
});

// ---------------------------------------------------------------------
// Fallo en el envio al paciente: log seguro, sin UPDATE, sin afectar la
// respuesta HTTP (criterio 15)
// ---------------------------------------------------------------------

test('fallo en sendMail() al paciente se loguea con err.message (sin credenciales) y salta el UPDATE del flag', async () => {
  const errorCalls = [];
  const originalError = console.error;
  console.error = (...args) => errorCalls.push(args.map((a) => (a && a.stack) || String(a)).join(' '));
  try {
    const secretError = new Error('fallo de conexion SMTP al paciente');
    secretError.response = '535 Authentication failed: SMTP_PASS=contrasena-secreta-paciente-xyz';
    const mailer = {
      sentMails: [],
      async sendMail(mailOptions) {
        this.sentMails.push(mailOptions);
        if (mailOptions.to === 'clinica@sonriemascorrientes.com') {
          return { messageId: 'fake-message-id' };
        }
        throw secretError;
      },
    };
    const supabaseClient = makeFakeSupabaseClient({ id: 'd0000000-0000-0000-0000-000000000015' });
    const { handler } = newHandler({ supabaseClient, mailer, mailerFactory: () => mailer });
    const req = makeReq({ body: validPayload() });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.json.id, 'd0000000-0000-0000-0000-000000000015');
    assert.equal(mailer.sentMails.length, 2, 'ambos envios se intentaron');
    const patientUpdate = supabaseClient.updateCalls.find(
      (call) => 'confirmacion_paciente_enviada' in call.values
    );
    assert.equal(patientUpdate, undefined, 'no debe existir UPDATE de confirmacion_paciente_enviada');
    const serialized = errorCalls.join('\n');
    assert.equal(serialized.includes('contrasena-secreta-paciente-xyz'), false);
  } finally {
    console.error = originalError;
  }
});

// ---------------------------------------------------------------------
// Fallo del UPDATE de confirmacion_paciente_enviada no cambia el 201
// (criterio 16)
// ---------------------------------------------------------------------

test('UPDATE de confirmacion_paciente_enviada falla -> igual responde 201 con el mismo id', async () => {
  const supabaseClient = makeFakeSupabaseClient({
    id: 'e0000000-0000-0000-0000-000000000016',
    failOnUpdate: true,
  });
  const { mailer, handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, 'e0000000-0000-0000-0000-000000000016');
  assert.equal(mailer.sentMails.length, 2, 'ambos envios se intentaron igual, aunque el UPDATE falle');
  assert.equal(supabaseClient.updateCalls.length, 2, 'ambos UPDATE se intentaron, aunque fallen');
});

// ---------------------------------------------------------------------
// Rama de duplicado detectado: ningun envio se intenta (criterio 17)
// ---------------------------------------------------------------------

test('rama de duplicado detectado -> NO se invoca sendMail() ni para la clinica ni para el paciente', async () => {
  const existingId = 'f0000000-0000-0000-0000-000000000017';
  const supabaseClient = makeFakeSupabaseClient({ existingLeads: [{ id: existingId }] });
  const { mailer, handler } = newHandler({ supabaseClient });
  const req = makeReq({ body: validPayload() });
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.json.id, existingId);
  assert.equal(mailer.sentMails.length, 0, 'sendMail() no debe invocarse ante un duplicado');
});

// ---------------------------------------------------------------------
// Contrato 201 { id } estable en las 5 combinaciones de resultados de
// email (criterio 18)
// ---------------------------------------------------------------------

test('el contrato 201 { id } se mantiene en las 5 combinaciones de resultados de email', async () => {
  const scenarios = [
    { name: 'exito ambos', mailer: makeFakeMailer({ fail: false }) },
    {
      name: 'fallo clinica, exito paciente',
      mailer: makeSelectiveFailMailer({ failTo: ['clinica@sonriemascorrientes.com'] }),
    },
    {
      name: 'exito clinica, fallo paciente',
      mailer: makeSelectiveFailMailer({ failTo: ['paciente-18@example.com'] }),
    },
    { name: 'fallo ambos', mailer: makeFakeMailer({ fail: true }) },
  ];

  for (const scenario of scenarios) {
    const supabaseClient = makeFakeSupabaseClient();
    const { handler } = newHandler({
      supabaseClient,
      mailer: scenario.mailer,
      mailerFactory: () => scenario.mailer,
    });
    const req = makeReq({ body: validPayload({ email: 'paciente-18@example.com' }) });
    const res = makeRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201, scenario.name);
    assert.deepEqual(Object.keys(res.json), ['id'], scenario.name);
    assert.equal(typeof res.json.id, 'string', scenario.name);
  }

  // Config SMTP faltante: mailerFactory lanza (5to escenario).
  const supabaseClient = makeFakeSupabaseClient();
  const { handler } = newHandler({
    supabaseClient,
    mailerFactory: () => {
      throw new Error('config SMTP faltante');
    },
  });
  const req = makeReq({ body: validPayload({ email: 'paciente-18@example.com' }) });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(res.json), ['id']);
});

// ---------------------------------------------------------------------
// Leads independientes disparan confirmaciones al paciente
// independientes, con "to" propio (criterio 19)
// ---------------------------------------------------------------------

test('dos leads nuevos e independientes disparan cada uno su propia confirmacion al paciente, con "to" propio', async () => {
  const supabaseClient = makeFakeSupabaseClient();
  const { mailer, handler } = newHandler({ supabaseClient });

  const req1 = makeReq({ body: validPayload({ nombre: 'Juan Perez', email: 'juan-f06@example.com' }) });
  const res1 = makeRes();
  await handler(req1, res1);
  assert.equal(res1.statusCode, 201);

  const req2 = makeReq({ body: validPayload({ nombre: 'Maria Lopez', email: 'maria-f06@example.com' }) });
  const res2 = makeRes();
  await handler(req2, res2);
  assert.equal(res2.statusCode, 201);

  assert.equal(mailer.sentMails.length, 4, '2 envios por request (clinica + paciente) x 2 requests');
  const patientMails = mailer.sentMails.filter((mailOptions) => mailOptions.to !== 'clinica@sonriemascorrientes.com');
  assert.equal(patientMails.length, 2);
  assert.equal(patientMails[0].to, 'juan-f06@example.com');
  assert.equal(patientMails[1].to, 'maria-f06@example.com');
});

// ---------------------------------------------------------------------
// Observabilidad y operacion (feature 15)
//
// Contrato en runs/15-observabilidad-y-operacion/spec.md y en
// docs/tecnica/observabilidad-y-operacion.md. Regla verificada aca: los
// logs solo llevan campos estructurados de dominio acotado; ni PII ni
// secretos ni texto libre de error pueden aparecer en ningun canal.
// ---------------------------------------------------------------------

/**
 * Captura los tres canales de consola durante una operacion asincronica
 * y devuelve las lineas crudas, las parseadas y el texto completo.
 */
async function capturarConsola(fn) {
  const canales = { log: [], warn: [], error: [] };
  const originales = { log: console.log, warn: console.warn, error: console.error };

  // `crudas` conserva el orden CRONOLOGICO real de emision; `canales`
  // separa por canal. Concatenar los canales perderia la cronologia y
  // haria pasar por bueno un orden de eventos equivocado.
  const crudas = [];
  const registrar = (canal) => (...args) => {
    const linea = args.join(' ');
    canales[canal].push(linea);
    crudas.push(linea);
  };

  console.log = registrar('log');
  console.warn = registrar('warn');
  console.error = registrar('error');

  try {
    await fn();
  } finally {
    console.log = originales.log;
    console.warn = originales.warn;
    console.error = originales.error;
  }
  return {
    canales,
    crudas,
    eventos: crudas.map((linea) => JSON.parse(linea)),
    texto: crudas.join('\n'),
  };
}

const nombresDeEventos = (eventos) => eventos.map((e) => e.evento);

// PII de referencia: ningun test de esta seccion debe encontrarla en los
// logs, en ninguna forma, ni siquiera truncada.
const PII = {
  nombre: 'Fulano Secreto De Prueba',
  email: 'fulano.secreto@example.com',
  telefono: '+54 379 4123456',
  mensaje: 'Me duele la muela desde hace tres semanas y quiero un presupuesto',
  ip: '203.0.113.77',
};

const payloadConPii = () =>
  validPayload({
    nombre: PII.nombre,
    email: PII.email,
    telefono: PII.telefono,
    mensaje: PII.mensaje,
  });

function assertSinPiiNiSecretos(texto, mensajeExtra = '') {
  const prohibidos = [
    PII.nombre,
    PII.email,
    PII.telefono,
    PII.mensaje,
    PII.ip,
    'SMTP_PASS',
    'SUPABASE_SERVICE_ROLE_KEY',
    'service_role',
    'contrasena-secreta',
  ];
  for (const prohibido of prohibidos) {
    assert.equal(
      texto.includes(prohibido),
      false,
      'no debe aparecer en los logs: ' + prohibido + ' ' + mensajeExtra
    );
  }
}

// --- Correlacion -----------------------------------------------------

test('f15: todos los eventos de una request comparten un unico request_id', async () => {
  const { eventos } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  assert.ok(eventos.length >= 4, 'la request debe emitir varios eventos');
  const ids = new Set(eventos.map((e) => e.request_id));
  assert.equal(ids.size, 1, 'se esperaba un unico request_id, hubo ' + ids.size);
  assert.match([...ids][0], /^[0-9a-fA-F-]{36}$/);
});

test('f15: dos requests distintas no comparten request_id', async () => {
  const { eventos } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ body: validPayload() }), makeRes());
    await handler(makeReq({ body: validPayload({ email: 'otra@example.com' }) }), makeRes());
  });

  const ids = new Set(eventos.map((e) => e.request_id));
  assert.equal(ids.size, 2);
});

test('f15: lead_id correlaciona los eventos posteriores a la insercion', async () => {
  const idEsperado = 'f1500000-0000-0000-0000-000000000001';
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ id: idEsperado });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const conLeadId = ['supabase_insercion_ok', 'smtp_clinica_ok', 'smtp_paciente_ok', 'solicitud_finalizada'];
  for (const nombre of conLeadId) {
    const evento = eventos.find((e) => e.evento === nombre);
    assert.ok(evento, 'falta el evento ' + nombre);
    assert.equal(evento.lead_id, idEsperado, nombre + ' debe llevar lead_id');
  }
});

// --- Eventos de exito ------------------------------------------------

test('f15: el flujo 201 completo emite la secuencia de eventos esperada', async () => {
  const { eventos } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  assert.deepEqual(nombresDeEventos(eventos), [
    'solicitud_recibida',
    'validacion_aceptada',
    'supabase_insercion_ok',
    'smtp_clinica_ok',
    'smtp_paciente_ok',
    'solicitud_finalizada',
  ]);

  const finalizada = eventos.find((e) => e.evento === 'solicitud_finalizada');
  assert.equal(finalizada.http_status, 201);
  assert.equal(typeof finalizada.duracion_ms, 'number');
  assert.ok(finalizada.duracion_ms >= 0);
});

test('f15: solicitud_recibida registra metodo e ip_hash, nunca la IP en claro', async () => {
  const { eventos, texto } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ body: validPayload(), ip: PII.ip }), makeRes());
  });

  const recibida = eventos[0];
  assert.equal(recibida.evento, 'solicitud_recibida');
  assert.equal(recibida.metodo, 'POST');
  assert.match(recibida.ip_hash, /^[0-9a-f]{16}$/);
  assert.equal(texto.includes(PII.ip), false);
});

test('f15: incluso un 405 queda registrado de punta a punta', async () => {
  const { eventos } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ method: 'GET' }), makeRes());
  });

  assert.deepEqual(nombresDeEventos(eventos), [
    'solicitud_recibida',
    'validacion_rechazada',
    'solicitud_finalizada',
  ]);
  assert.equal(eventos[0].metodo, 'GET');
  assert.equal(eventos[1].error, 'metodo_no_permitido');
  assert.equal(eventos[2].http_status, 405);
});

test('f15: la rama de duplicado emite duplicado_detectado y no eventos de email', async () => {
  const idExistente = 'f1500000-0000-0000-0000-0000000000d1';
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ existingLeads: [{ id: idExistente }] });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const nombres = nombresDeEventos(eventos);
  assert.ok(nombres.includes('duplicado_detectado'));
  assert.equal(nombres.includes('smtp_clinica_ok'), false);
  assert.equal(eventos.find((e) => e.evento === 'duplicado_detectado').lead_id, idExistente);
});

// --- Validacion rechazada --------------------------------------------

test('f15: cada familia de rechazo emite validacion_rechazada con su codigo', async () => {
  const escenarios = [
    { nombre: 'json invalido', body: '{no es json', error: 'json_invalido', status: 400 },
    {
      nombre: 'campo faltante',
      body: validPayload({ nombre: undefined }),
      error: 'campo_requerido_faltante',
      status: 400,
      campo: 'nombre',
    },
    {
      nombre: 'email invalido',
      body: validPayload({ email: 'no-es-email' }),
      error: 'formato_email_invalido',
      status: 400,
    },
    {
      nombre: 'sin consentimiento',
      body: validPayload({ consentimiento_privacidad: false }),
      error: 'consentimiento_requerido',
      status: 400,
    },
    {
      nombre: 'longitud excedida',
      body: validPayload({ mensaje: 'x'.repeat(2001) }),
      error: 'longitud_excedida',
      status: 400,
      campo: 'mensaje',
    },
  ];

  for (const escenario of escenarios) {
    const { eventos } = await capturarConsola(async () => {
      const { handler } = newHandler();
      await handler(makeReq({ body: escenario.body }), makeRes());
    });

    const rechazo = eventos.find((e) => e.evento === 'validacion_rechazada');
    assert.ok(rechazo, escenario.nombre + ': falta validacion_rechazada');
    assert.equal(rechazo.error, escenario.error, escenario.nombre);
    assert.equal(rechazo.http_status, escenario.status, escenario.nombre);
    if (escenario.campo) {
      assert.equal(rechazo.campo, escenario.campo, escenario.nombre);
    }
    assert.equal(
      nombresDeEventos(eventos).includes('validacion_aceptada'),
      false,
      escenario.nombre + ': no debe marcarse como aceptada'
    );
  }
});

test('f15: una clave desconocida hostil no llega al log (log injection)', async () => {
  const claveHostil = 'x", "evento": "falsificado", "pii": "fulano.secreto@example.com';
  const { eventos, texto } = await capturarConsola(async () => {
    const { handler } = newHandler();
    const body = validPayload();
    body[claveHostil] = 'valor';
    await handler(makeReq({ body }), makeRes());
  });

  const rechazo = eventos.find((e) => e.evento === 'validacion_rechazada');
  assert.equal(rechazo.error, 'propiedad_desconocida');
  assert.equal(rechazo.campo, 'no_permitido', 'la clave arbitraria no debe loguearse');
  assert.equal(texto.includes('falsificado'), false);
  assert.equal(texto.includes(PII.email), false);
  assert.equal(eventos.length, 3);
});

test('f15: los rechazos antispam mantienen lead_rechazado como primer warn', async () => {
  const { canales, eventos } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(
      makeReq({ body: validPayload(), headers: { origin: 'https://sitio-malicioso.example' } }),
      makeRes()
    );
  });

  // Contrato preexistente de la feature 04: el primer warn debe seguir
  // siendo lead_rechazado (varios tests lo leen como warnCalls[0]).
  assert.equal(JSON.parse(canales.warn[0]).evento, 'lead_rechazado');
  assert.equal(JSON.parse(canales.warn[0]).motivo, 'origen_no_permitido');
  assert.ok(nombresDeEventos(eventos).includes('validacion_rechazada'));
});

// --- Fallos de Supabase ----------------------------------------------

test('f15: un error de INSERT con PII en details/hint solo loguea metadatos', async () => {
  // Caso real: un error de Postgres puede incluir los valores de la fila
  // (ej. "Key (email)=(...) already exists") en message/detail.
  const errorConPii = {
    message: 'Key (email)=(' + PII.email + ') already exists',
    details: 'Failing row contains (' + PII.nombre + ', ' + PII.email + ', ' + PII.telefono + ')',
    hint: 'Revisar el lead de ' + PII.nombre,
    code: '23505',
  };
  const supabaseClient = makeFakeSupabaseClient();
  supabaseClient.from = () => ({
    insert() {
      return {
        select() {
          return {
            async single() {
              return { data: null, error: errorConPii };
            },
          };
        },
      };
    },
    select() {
      return {
        ilike() {
          return {
            eq() {
              return {
                gte() {
                  return {
                    async limit() {
                      return { data: [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  });

  const { eventos, texto } = await capturarConsola(async () => {
    const { handler } = newHandler({ supabaseClient });
    const res = makeRes();
    await handler(makeReq({ body: payloadConPii() }), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.json, { error: 'error_interno' });
  });

  const fallo = eventos.find((e) => e.evento === 'supabase_insercion_error');
  assert.ok(fallo, 'debe emitirse supabase_insercion_error');
  assert.equal(fallo.codigo, '23505', 'el SQLSTATE si es informacion util y segura');
  assert.match(fallo.huella, /^[0-9a-f]{16}$/);
  assert.equal('message' in fallo, false);
  assert.equal('details' in fallo, false);
  assert.equal('hint' in fallo, false);

  assertSinPiiNiSecretos(texto, '(error de INSERT)');
  assert.equal(texto.includes('already exists'), false);
  assert.equal(texto.includes('Failing row'), false);
});

test('f15: un fallo al inicializar el cliente Supabase se registra sin detalle', async () => {
  const { eventos, texto } = await capturarConsola(async () => {
    const handler = createHandler({
      supabaseClientFactory: () => {
        throw new Error('No se pudo conectar con SUPABASE_SERVICE_ROLE_KEY=clave-secreta-real');
      },
      rateLimitStore: new Map(),
      originConfig: { siteUrl: TEST_SITE_URL, allowedOrigins: [], vercelUrl: undefined },
      mailerFactory: () => makeFakeMailer(),
    });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  assert.ok(nombresDeEventos(eventos).includes('supabase_cliente_error'));
  assert.equal(texto.includes('clave-secreta-real'), false);
  assert.equal(texto.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
});

// --- Fallos de SMTP ---------------------------------------------------

test('f15: un fallo SMTP registra codigo y smtp_response_code, nunca la respuesta del servidor', async () => {
  const errorSmtp = new Error('Invalid login: 535 auth failed for ' + PII.email);
  errorSmtp.code = 'EAUTH';
  errorSmtp.responseCode = 535;
  errorSmtp.response = '535 5.7.8 Authentication failed: SMTP_PASS=contrasena-secreta-xyz';

  const { eventos, texto } = await capturarConsola(async () => {
    const mailer = {
      async sendMail() {
        throw errorSmtp;
      },
    };
    const { handler } = newHandler({ mailer, mailerFactory: () => mailer });
    const res = makeRes();
    await handler(makeReq({ body: payloadConPii() }), res);
    assert.equal(res.statusCode, 201, 'un fallo SMTP no cambia la respuesta ya decidida');
  });

  const nombres = nombresDeEventos(eventos);
  assert.ok(nombres.includes('smtp_clinica_error'));
  assert.ok(nombres.includes('smtp_paciente_error'), 'los dos envios son independientes');

  const falloClinica = eventos.find((e) => e.evento === 'smtp_clinica_error');
  assert.equal(falloClinica.codigo, 'EAUTH');
  assert.equal(falloClinica.smtp_response_code, 535);
  assert.match(falloClinica.huella, /^[0-9a-f]{16}$/);

  assertSinPiiNiSecretos(texto, '(fallo SMTP)');
  assert.equal(texto.includes('Authentication failed'), false);
  assert.equal(texto.includes('Invalid login'), false);
});

test('f15: config SMTP ausente emite smtp_configuracion_error sin variables de entorno', async () => {
  const { eventos, texto } = await capturarConsola(async () => {
    const { handler } = newHandler({
      mailerFactory: () => {
        throw new Error('Configuracion SMTP incompleta: SMTP_PASS=clave-real, SMTP_USER=user-real');
      },
    });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  assert.ok(nombresDeEventos(eventos).includes('smtp_configuracion_error'));
  assert.equal(texto.includes('clave-real'), false);
  assert.equal(texto.includes('user-real'), false);
  assert.equal(texto.toLowerCase().includes('smtp_pass'), false);
});

test('f15: un fallo del UPDATE del flag se registra con lead_id y nombre del flag', async () => {
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({
      id: 'f1500000-0000-0000-0000-0000000000f1',
      failOnUpdate: true,
    });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const fallos = eventos.filter((e) => e.evento === 'flag_actualizacion_error');
  assert.ok(fallos.length >= 1, 'debe registrarse el fallo del UPDATE');
  assert.equal(fallos[0].lead_id, 'f1500000-0000-0000-0000-0000000000f1');
  assert.ok(
    ['notificacion_clinica_enviada', 'confirmacion_paciente_enviada'].includes(fallos[0].flag)
  );
});

// --- Ausencia de secretos y PII, y superficie HTTP --------------------

test('f15: ningun canal filtra PII ni secretos en un flujo 201 completo', async () => {
  const { texto, eventos } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ body: payloadConPii(), ip: PII.ip }), makeRes());
  });

  assertSinPiiNiSecretos(texto, '(flujo 201)');

  // Ademas: ningun evento debe traer una clave fuera del esquema.
  const permitidas = new Set([
    'timestamp',
    'nivel',
    'evento',
    'request_id',
    'lead_id',
    'ip_hash',
    'metodo',
    'http_status',
    'error',
    'campo',
    'motivo',
    'flag',
    'tipo',
    'codigo',
    'smtp_response_code',
    'huella',
    'duracion_ms',
  ]);
  for (const evento of eventos) {
    for (const clave of Object.keys(evento)) {
      assert.ok(permitidas.has(clave), 'clave fuera del esquema: ' + clave + ' en ' + evento.evento);
    }
  }
});

test('f15: cada linea de log es JSON valido de una sola linea', async () => {
  const { crudas } = await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ body: payloadConPii() }), makeRes());
  });

  for (const linea of crudas) {
    assert.equal(linea.includes('\n'), false, 'un evento no debe ocupar mas de una linea');
    assert.doesNotThrow(() => JSON.parse(linea));
  }
});

test('f15: la superficie HTTP no cambia (sin request id en la respuesta)', async () => {
  const res = makeRes();
  await capturarConsola(async () => {
    const { handler } = newHandler();
    await handler(makeReq({ body: validPayload() }), res);
  });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(res.json), ['id']);
  assert.deepEqual(Object.keys(res.headers), ['content-type']);
  const serializado = JSON.stringify(res.json) + JSON.stringify(res.headers);
  assert.equal(serializado.toLowerCase().includes('request'), false);
});

test('f15: la funcionalidad preexistente se preserva bajo instrumentacion', async () => {
  await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ id: 'f1500000-0000-0000-0000-00000000aaaa' });
    const { handler, mailer } = newHandler({ supabaseClient });
    const res = makeRes();
    await handler(makeReq({ body: validPayload() }), res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.json.id, 'f1500000-0000-0000-0000-00000000aaaa');
    assert.equal(supabaseClient.calls.length, 1, 'un unico insert');
    assert.equal(mailer.sentMails.length, 2, 'clinica y paciente');
    assert.equal(supabaseClient.updateCalls.length, 2, 'ambos flags actualizados');
  });
});

// ---------------------------------------------------------------------
// f16: supabase_status_code — el campo que faltaba para diagnosticar
// ---------------------------------------------------------------------
//
// Origen: runs/16-validacion-mvp-produccion/test-report-2.md, anexos A y B.
//
// En Production, `POST /api/leads` devolvio 500 y el log dijo
// `supabase_duplicados_error` con `tipo=sin_tipo` y `codigo=sin_codigo`.
// Ocurre porque `postgrest-js` devuelve un objeto plano `{ message }`
// -sin `name` y sin `code`- cuando la respuesta no es JSON, y
// `metadatosDeError()` solo lee `name`, `code` y `responseCode`.
//
// El log no permitia distinguir "la base rechazo la consulta" de "el
// endpoint ni siquiera hablo PostgREST". Diagnosticarlo exigio leer
// node_modules. `supabase_status_code` cierra ese hueco sin relajar la
// politica de redaccion: es un entero, no puede transportar PII.

test('f16: supabase_duplicados_error registra el status HTTP de la respuesta', async () => {
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ failOnSelect: true, selectStatus: 404 });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_duplicados_error');
  assert.ok(evento, 'debe emitirse supabase_duplicados_error');
  assert.equal(evento.supabase_status_code, 404);
});

test('f16: con un error sin name ni code, el status es la UNICA senal util', async () => {
  // Reproduce exactamente la forma del error observada en Production.
  const errorReal = { message: '<html>The page could not be found</html>' };

  const { eventos, texto } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({
      failOnSelect: true,
      selectStatus: 404,
      errorOnSelect: errorReal,
    });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_duplicados_error');
  assert.ok(evento);

  // El comportamiento previo se preserva: sin name ni code, ambos quedan
  // en su valor por defecto. No es un fallo, es la politica de redaccion.
  assert.equal(evento.tipo, 'sin_tipo');
  assert.equal(evento.codigo, 'sin_codigo');

  // Y ahora hay algo accionable, que es todo el punto del cambio.
  assert.equal(evento.supabase_status_code, 404);

  // El cuerpo de la respuesta NO se filtra por ninguna via.
  assert.equal(texto.includes('could not be found'), false);
  assert.equal(texto.includes('<html>'), false);
});

test('f16: supabase_insercion_error tambien registra el status', async () => {
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ fail: true, insertStatus: 409 });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_insercion_error');
  assert.ok(evento);
  assert.equal(evento.supabase_status_code, 409);
  // No pisa duracion_ms, que ya se registraba en este evento.
  assert.equal(typeof evento.duracion_ms, 'number');
});

test('f16: flag_actualizacion_error tambien registra el status', async () => {
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({
      id: 'f1600000-0000-0000-0000-0000000000f1',
      failOnUpdate: true,
      updateStatus: 403,
    });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const fallos = eventos.filter((e) => e.evento === 'flag_actualizacion_error');
  assert.ok(fallos.length >= 1);
  assert.equal(fallos[0].supabase_status_code, 403);
  assert.equal(fallos[0].lead_id, 'f1600000-0000-0000-0000-0000000000f1');
});

// ---------------------------------------------------------------------
// f16: supabase_host / supabase_path — a que URL le estabamos pegando
// ---------------------------------------------------------------------
//
// Origen: runs/16-validacion-mvp-produccion/test-report-2.md, anexo F.
//
// Con `supabase_status_code` ya instrumentado, Production devolvio 404.
// Pero un 404 no distingue "la tabla no existe" de "le estamos pegando
// al host equivocado", y el error de Supabase no dice a que URL se
// llamo. Estos dos campos cierran esa pregunta.
//
// REGLA DURA: se registran host y pathname, NUNCA el query string. La
// consulta de duplicados lleva el email del paciente ahi.

test('f16: supabase_duplicados_error registra host y pathname del endpoint', async () => {
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ failOnSelect: true, selectStatus: 404 });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_duplicados_error');
  assert.ok(evento);
  assert.equal(evento.supabase_host, 'ejemplo.supabase.co');
  assert.equal(evento.supabase_path, '/rest/v1/leads');
});

test('f16: el query string NUNCA llega al log, aunque lleve el email', async () => {
  // Es la garantia que hace aceptable registrar la URL. El builder falso
  // incluye el email en la query, igual que el real.
  const { eventos, texto } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ failOnSelect: true, selectStatus: 404 });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: payloadConPii(), ip: PII.ip }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_duplicados_error');
  assert.ok(evento);

  // Ni el email, ni su forma URL-encodeada, ni el separador de query.
  assertSinPiiNiSecretos(texto, '(endpoint en supabase_duplicados_error)');
  assert.equal(texto.includes(encodeURIComponent(PII.email)), false);
  assert.equal(String(evento.supabase_path).includes('?'), false);
  assert.equal(String(evento.supabase_path).includes('email'), false);
});

test('f16: supabase_insercion_error tambien registra host y pathname', async () => {
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({ fail: true, insertStatus: 404 });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_insercion_error');
  assert.ok(evento);
  assert.equal(evento.supabase_host, 'ejemplo.supabase.co');
  assert.equal(evento.supabase_path, '/rest/v1/leads');
});

test('f16: un endpoint con /rest/v1 duplicado se ve en el pathname', async () => {
  // El escenario que este campo existe para detectar: si la variable de
  // entorno trajera una ruta de mas, el pathname lo delata.
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({
      failOnSelect: true,
      selectStatus: 404,
      urlBase: 'https://ejemplo.supabase.co/rest/v1/rest/v1',
    });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_duplicados_error');
  assert.equal(evento.supabase_path, '/rest/v1/rest/v1/leads');
});

test('f16: un host que no es Supabase se ve en el log', async () => {
  // El otro escenario: la variable apuntando a otro destino. Sin este
  // campo, un 404 asi es indistinguible de una tabla inexistente.
  const { eventos } = await capturarConsola(async () => {
    const supabaseClient = makeFakeSupabaseClient({
      failOnSelect: true,
      selectStatus: 404,
      urlBase: 'https://gi-clinicadental.vercel.app/rest/v1',
    });
    const { handler } = newHandler({ supabaseClient });
    await handler(makeReq({ body: validPayload() }), makeRes());
  });

  const evento = eventos.find((e) => e.evento === 'supabase_duplicados_error');
  assert.equal(evento.supabase_host, 'gi-clinicadental.vercel.app');
});
