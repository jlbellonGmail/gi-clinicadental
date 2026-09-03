'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  crearLogger,
  crearRequestId,
  emitir,
  hashOpaco,
  calcularHuella,
  metadatosDeError,
  NOMBRES_DE_CAMPOS,
} = require('./logger');

// ---------------------------------------------------------------------
// Helper: captura los tres canales de consola y devuelve las lineas
// parseadas. Todo evento debe ser una unica linea JSON.
// ---------------------------------------------------------------------
function capturarLogs(fn) {
  const capturado = { log: [], warn: [], error: [] };
  const originales = { log: console.log, warn: console.warn, error: console.error };

  console.log = (...args) => capturado.log.push(args.join(' '));
  console.warn = (...args) => capturado.warn.push(args.join(' '));
  console.error = (...args) => capturado.error.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originales.log;
    console.warn = originales.warn;
    console.error = originales.error;
  }

  const todas = [...capturado.log, ...capturado.warn, ...capturado.error];
  return {
    canales: capturado,
    crudas: todas,
    parseadas: todas.map((linea) => JSON.parse(linea)),
    texto: todas.join('\n'),
  };
}

// ---------------------------------------------------------------------
// Estructura del evento
// ---------------------------------------------------------------------

test('cada evento es una unica linea JSON con los campos base', () => {
  const { crudas, parseadas } = capturarLogs(() => {
    emitir('info', 'solicitud_recibida', { request_id: 'abc-123' });
  });

  assert.equal(crudas.length, 1);
  assert.equal(crudas[0].includes('\n'), false, 'el evento no debe ocupar mas de una linea');

  const evento = parseadas[0];
  assert.deepEqual(Object.keys(evento), ['timestamp', 'nivel', 'evento', 'request_id']);
  assert.equal(evento.nivel, 'info');
  assert.equal(evento.evento, 'solicitud_recibida');
  assert.equal(evento.request_id, 'abc-123');
  assert.ok(!Number.isNaN(Date.parse(evento.timestamp)), 'timestamp debe ser ISO parseable');
});

test('cada nivel escribe en su canal de consola', () => {
  const { canales } = capturarLogs(() => {
    emitir('info', 'evento_info', { request_id: 'r1' });
    emitir('warn', 'evento_warn', { request_id: 'r1' });
    emitir('error', 'evento_error', { request_id: 'r1' });
  });

  assert.equal(canales.log.length, 1);
  assert.equal(canales.warn.length, 1);
  assert.equal(canales.error.length, 1);
  assert.equal(JSON.parse(canales.log[0]).evento, 'evento_info');
  assert.equal(JSON.parse(canales.warn[0]).evento, 'evento_warn');
  assert.equal(JSON.parse(canales.error[0]).evento, 'evento_error');
});

test('un nivel desconocido cae a info en lugar de romper la request', () => {
  const { canales, parseadas } = capturarLogs(() => {
    emitir('critico', 'evento_raro', { request_id: 'r1' });
  });

  assert.equal(canales.log.length, 1);
  assert.equal(parseadas[0].nivel, 'info');
});

test('el orden de los campos es estable entre eventos', () => {
  const { parseadas } = capturarLogs(() => {
    emitir('error', 'a', { request_id: 'r1', duracion_ms: 5, lead_id: 'ab-12', codigo: '23505' });
    emitir('error', 'b', { codigo: '23505', lead_id: 'ab-12', duracion_ms: 5, request_id: 'r1' });
  });

  assert.deepEqual(Object.keys(parseadas[0]), Object.keys(parseadas[1]));
});

// ---------------------------------------------------------------------
// Lista blanca: la defensa primaria
// ---------------------------------------------------------------------

test('descarta toda clave que no este en la lista blanca', () => {
  const { parseadas, texto } = capturarLogs(() => {
    emitir('error', 'evento', {
      request_id: 'r1',
      // Ninguna de estas esta declarada en CAMPOS.
      message: 'Key (email)=(fulano.secreto@example.com) already exists',
      details: 'detalle con PII',
      hint: 'pista con PII',
      response: '535 5.7.8 Authentication failed',
      query: 'select * from leads where email = ...',
      payload: { nombre: 'Fulano Secreto' },
      stack: 'Error: algo\n    at foo',
      headers: { authorization: 'Bearer secreto' },
      cookies: 'session=abc',
      env: { SMTP_PASS: 'clave-real' },
    });
  });

  assert.deepEqual(Object.keys(parseadas[0]), ['timestamp', 'nivel', 'evento', 'request_id']);
  for (const prohibido of [
    'fulano.secreto@example.com',
    'detalle con PII',
    'pista con PII',
    'Authentication failed',
    'select * from leads',
    'Fulano Secreto',
    'Bearer secreto',
    'session=abc',
    'clave-real',
  ]) {
    assert.equal(texto.includes(prohibido), false, `no debe loguearse: ${prohibido}`);
  }
});

test('un objeto Error pasado como campo no se serializa', () => {
  const err = new Error('Key (email)=(fulano.secreto@example.com) already exists');
  err.details = 'detalle sensible';

  const { texto } = capturarLogs(() => {
    emitir('error', 'evento', { request_id: 'r1', err, error_obj: err });
  });

  assert.equal(texto.includes('fulano.secreto@example.com'), false);
  assert.equal(texto.includes('detalle sensible'), false);
  assert.equal(texto.includes('already exists'), false);
});

test('la lista blanca no contiene ningun campo de texto libre', () => {
  // Guardia de mantenimiento: si alguien agrega un campo nuevo, este test
  // obliga a revisarlo conscientemente contra la regla del modulo.
  assert.deepEqual(NOMBRES_DE_CAMPOS, [
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
});

// ---------------------------------------------------------------------
// Validadores por campo
// ---------------------------------------------------------------------

test('campo: acepta nombres de campo conocidos y degrada el resto a no_permitido', () => {
  const { parseadas } = capturarLogs(() => {
    emitir('warn', 'validacion_rechazada', { request_id: 'r1', campo: 'email' });
    // Caso real: `propiedad_desconocida` devuelve una clave arbitraria
    // tomada del JSON entrante — texto controlado por quien llama.
    emitir('warn', 'validacion_rechazada', {
      request_id: 'r1',
      campo: '<script>alert(1)</script>',
    });
    emitir('warn', 'validacion_rechazada', {
      request_id: 'r1',
      campo: 'linea1\nlinea2_inyectada',
    });
  });

  assert.equal(parseadas[0].campo, 'email');
  assert.equal(parseadas[1].campo, 'no_permitido');
  assert.equal(parseadas[2].campo, 'no_permitido');
});

test('error: solo acepta codigos del dominio cerrado de la API', () => {
  const { parseadas } = capturarLogs(() => {
    emitir('warn', 'e', { request_id: 'r1', error: 'consentimiento_requerido' });
    emitir('warn', 'e', { request_id: 'r1', error: 'codigo_inventado' });
  });

  assert.equal(parseadas[0].error, 'consentimiento_requerido');
  assert.equal(parseadas[1].error, 'no_valido');
});

test('metodo: solo acepta metodos HTTP conocidos', () => {
  const { parseadas } = capturarLogs(() => {
    emitir('info', 'e', { request_id: 'r1', metodo: 'POST' });
    emitir('info', 'e', { request_id: 'r1', metodo: 'FULANO SECRETO' });
  });

  assert.equal(parseadas[0].metodo, 'POST');
  assert.equal(parseadas[1].metodo, 'no_valido');
});

test('tipo y codigo: un email o una frase nunca sobreviven al patron de token', () => {
  const { parseadas, texto } = capturarLogs(() => {
    emitir('error', 'e', {
      request_id: 'r1',
      tipo: 'fulano.secreto@example.com',
      codigo: 'Key (email)=(fulano.secreto@example.com) already exists',
    });
  });

  assert.equal(parseadas[0].tipo, 'no_valido');
  assert.equal(parseadas[0].codigo, 'no_valido');
  assert.equal(texto.includes('fulano.secreto'), false);
  assert.equal(texto.includes('example.com'), false);
});

test('tipo y codigo: aceptan los valores reales de Postgres y Nodemailer', () => {
  const { parseadas } = capturarLogs(() => {
    emitir('error', 'e', { request_id: 'r1', tipo: 'TypeError', codigo: '23505' });
    emitir('error', 'e', { request_id: 'r1', tipo: 'Error', codigo: 'EAUTH' });
  });

  assert.equal(parseadas[0].codigo, '23505');
  assert.equal(parseadas[1].codigo, 'EAUTH');
});

test('los campos numericos descartan valores no enteros', () => {
  const { parseadas } = capturarLogs(() => {
    emitir('error', 'e', {
      request_id: 'r1',
      http_status: 500,
      smtp_response_code: 535,
      duracion_ms: 'no-es-un-numero',
    });
  });

  assert.equal(parseadas[0].http_status, 500);
  assert.equal(parseadas[0].smtp_response_code, 535);
  assert.equal('duracion_ms' in parseadas[0], false);
});

test('ip_hash y huella solo aceptan la forma de hash de 16 hex', () => {
  const { parseadas } = capturarLogs(() => {
    emitir('warn', 'e', { request_id: 'r1', ip_hash: hashOpaco('203.0.113.10') });
    emitir('warn', 'e', { request_id: 'r1', ip_hash: '203.0.113.10' });
  });

  assert.match(parseadas[0].ip_hash, /^[0-9a-f]{16}$/);
  assert.equal(parseadas[1].ip_hash, 'no_valido');
});

// ---------------------------------------------------------------------
// Correlacion
// ---------------------------------------------------------------------

test('crearRequestId devuelve identificadores unicos y con forma de token', () => {
  const a = crearRequestId();
  const b = crearRequestId();

  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-fA-F-]{36}$/);
});

test('crearLogger liga el request_id a todos los eventos', () => {
  const { parseadas } = capturarLogs(() => {
    const log = crearLogger('req-fijo-1');
    log.info('solicitud_recibida', { metodo: 'POST' });
    log.warn('validacion_rechazada', { error: 'json_invalido', http_status: 400 });
    log.error('error_no_controlado', { tipo: 'TypeError' });
  });

  assert.equal(parseadas.length, 3);
  for (const evento of parseadas) {
    assert.equal(evento.request_id, 'req-fijo-1');
  }
});

test('crearLogger no deja que un campo suelto pise el request_id', () => {
  const { parseadas } = capturarLogs(() => {
    crearLogger('req-real').info('e', { request_id: 'req-falsificado' });
  });

  assert.equal(parseadas[0].request_id, 'req-real');
});

// ---------------------------------------------------------------------
// Huella de agrupacion
// ---------------------------------------------------------------------

test('la huella agrupa errores equivalentes y separa los distintos', () => {
  const base = { evento: 'supabase_insercion_error', tipo: 'Error', codigo: '23505' };

  assert.equal(calcularHuella(base), calcularHuella({ ...base }));
  assert.notEqual(calcularHuella(base), calcularHuella({ ...base, codigo: '23503' }));
  assert.notEqual(calcularHuella(base), calcularHuella({ ...base, evento: 'otro_evento' }));
  assert.notEqual(calcularHuella(base), calcularHuella({ ...base, smtp_response_code: 535 }));
});

test('la huella NO depende del mensaje del error', () => {
  const evento = 'smtp_clinica_error';

  const errUno = new Error('Invalid login: 535 5.7.8 fulano.secreto@example.com');
  errUno.code = 'EAUTH';
  errUno.responseCode = 535;

  const errOtro = new Error('otro mensaje completamente distinto');
  errOtro.code = 'EAUTH';
  errOtro.responseCode = 535;

  const unoMeta = metadatosDeError(evento, errUno);
  const otroMeta = metadatosDeError(evento, errOtro);

  assert.equal(
    unoMeta.huella,
    otroMeta.huella,
    'dos errores con los mismos metadatos deben agrupar igual, sin importar el mensaje'
  );
});

// ---------------------------------------------------------------------
// metadatosDeError: el unico punto que toca un error
// ---------------------------------------------------------------------

test('metadatosDeError extrae solo name, code y responseCode', () => {
  const err = new Error('Key (email)=(fulano.secreto@example.com) already exists');
  err.code = '23505';
  err.details = 'Detalle con PII del paciente';
  err.hint = 'Pista con PII';
  err.response = '535 5.7.8 Authentication failed for user real@dominio.com';
  err.query = 'insert into leads (nombre, email) values ($1, $2)';

  const metadatos = metadatosDeError('supabase_insercion_error', err);

  assert.deepEqual(Object.keys(metadatos).sort(), ['codigo', 'huella', 'tipo']);
  assert.equal(metadatos.tipo, 'Error');
  assert.equal(metadatos.codigo, '23505');

  const serializado = JSON.stringify(metadatos);
  for (const prohibido of [
    'fulano.secreto@example.com',
    'already exists',
    'Detalle con PII',
    'Pista con PII',
    'Authentication failed',
    'insert into leads',
  ]) {
    assert.equal(serializado.includes(prohibido), false, `no debe filtrarse: ${prohibido}`);
  }
});

test('metadatosDeError incluye smtp_response_code cuando existe', () => {
  const err = new Error('Invalid login');
  err.code = 'EAUTH';
  err.responseCode = 535;

  const metadatos = metadatosDeError('smtp_clinica_error', err);

  assert.equal(metadatos.codigo, 'EAUTH');
  assert.equal(metadatos.smtp_response_code, 535);
});

test('metadatosDeError tolera errores que no son Error', () => {
  for (const raro of [undefined, null, 'una cadena suelta', 42, { sin: 'forma' }]) {
    const metadatos = metadatosDeError('error_no_controlado', raro);
    assert.equal(metadatos.tipo, 'sin_tipo');
    assert.equal(metadatos.codigo, 'sin_codigo');
    assert.match(metadatos.huella, /^[0-9a-f]{16}$/);
  }
});

test('metadatosDeError no deja pasar un name o code con forma de texto libre', () => {
  const err = new Error('x');
  err.name = 'Fulano Secreto <fulano@example.com>';
  err.code = 'mensaje con espacios y @arroba';

  const metadatos = metadatosDeError('e', err);

  assert.equal(metadatos.tipo, 'no_valido');
  assert.equal(metadatos.codigo, 'no_valido');
});

// ---------------------------------------------------------------------
// Robustez
// ---------------------------------------------------------------------

test('emitir nunca lanza, aun con entradas degeneradas', () => {
  capturarLogs(() => {
    assert.doesNotThrow(() => emitir('info', 'e'));
    assert.doesNotThrow(() => emitir('info', 'e', null));
    assert.doesNotThrow(() => emitir(undefined, undefined, undefined));
    assert.doesNotThrow(() => emitir('info', 'e', { lead_id: {} }));
  });
});

test('hashOpaco es estable, corto y no reversible por inspeccion', () => {
  const hash = hashOpaco('203.0.113.10');

  assert.equal(hash, hashOpaco('203.0.113.10'));
  assert.notEqual(hash, hashOpaco('203.0.113.11'));
  assert.match(hash, /^[0-9a-f]{16}$/);
  assert.equal(hash.includes('203.0.113.10'), false);
});
