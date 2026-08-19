'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const { createHandler } = require('./leads');

// ---------------------------------------------------------------------
// Helpers de test: req/res falsos que hablan el mismo protocolo que un
// request/response reales de Node (stream + headers + statusCode), sin
// depender de Vercel ni de un servidor HTTP real levantado.
// ---------------------------------------------------------------------

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

function makeFakeSupabaseClient({ fail = false, id = '11111111-1111-1111-1111-111111111111' } = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      return {
        insert(rows) {
          calls.push({ table, rows });
          return {
            select() {
              return {
                async single() {
                  if (fail) {
                    return { data: null, error: { message: 'fallo simulado de Supabase' } };
                  }
                  return { data: { id }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return client;
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
  const handler = createHandler({
    supabaseClientFactory: () => supabaseClient,
    rateLimitStore: opts.rateLimitStore || new Map(),
    now: opts.now || (() => Date.now()),
    maxBodyBytes: opts.maxBodyBytes,
  });
  return { handler, supabaseClient };
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
