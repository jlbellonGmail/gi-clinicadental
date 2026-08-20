'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Contrato: runs/05-notificacion-clinica-smtp-ferozo/spec.md,
// docs/tecnica/notificacion-clinica-smtp-ferozo.md. Tests unitarios del
// modulo api/_lib/mailer.js, sin conexion SMTP real (nodemailer.createTransport
// no abre conexion de red: solo arma el objeto transporter; la conexion
// real recien ocurriria en sendMail()/verify(), que estos tests no
// invocan).

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'LEADS_NOTIFICATION_EMAIL'];
let savedEnv;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  // Modulo con cache a nivel de proceso (mismo patron que getSupabaseClient):
  // se limpia require.cache entre tests para que cada uno arranque con
  // `cachedTransporter = null`.
  delete require.cache[require.resolve('./mailer')];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  delete require.cache[require.resolve('./mailer')];
});

function setFullValidEnv(overrides = {}) {
  process.env.SMTP_HOST = 'smtp.ferozo.com';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_USER = 'notificaciones@sonriemascorrientes.com';
  process.env.SMTP_PASS = 'contrasena-secreta-de-prueba';
  process.env.SMTP_FROM = 'notificaciones@sonriemascorrientes.com';
  process.env.LEADS_NOTIFICATION_EMAIL = 'clinica@sonriemascorrientes.com';
  Object.assign(process.env, overrides);
}

// ---------------------------------------------------------------------
// createTransporter() — criterios 2, 8, 12
// ---------------------------------------------------------------------

test('createTransporter() lanza si falta configuracion SMTP (config faltante -> tratado como fallo de envio)', () => {
  const { createTransporter } = require('./mailer');
  assert.throws(() => createTransporter());
});

// SMTP_PORT queda deliberadamente fuera de este loop: es la unica
// variable opcional (cae al default 465, ver test especifico mas abajo),
// no dispara la excepcion de "configuracion incompleta".
const REQUIRED_ENV_KEYS = ENV_KEYS.filter((key) => key !== 'SMTP_PORT');

for (const missingKey of REQUIRED_ENV_KEYS) {
  test(`createTransporter() lanza si falta ${missingKey}`, () => {
    setFullValidEnv();
    delete process.env[missingKey];
    const { createTransporter } = require('./mailer');
    assert.throws(() => createTransporter());
  });
}

test('SMTP_PASS vacio (config parcial) se trata igual que ausente -> createTransporter() lanza', () => {
  setFullValidEnv({ SMTP_PASS: '' });
  const { createTransporter } = require('./mailer');
  assert.throws(() => createTransporter());
});

test('mensaje de error de createTransporter() no incluye ningun valor de variable de entorno', () => {
  setFullValidEnv();
  delete process.env.SMTP_PASS;
  const { createTransporter } = require('./mailer');
  try {
    createTransporter();
    assert.fail('deberia haber lanzado');
  } catch (err) {
    assert.equal(err.message.includes('contrasena-secreta-de-prueba'), false);
    assert.equal(err.message.includes('smtp.ferozo.com'), false);
  }
});

test('createTransporter() con configuracion completa arma host/port/secure/auth correctos', () => {
  setFullValidEnv();
  const { createTransporter } = require('./mailer');
  const transporter = createTransporter();
  assert.equal(transporter.options.host, 'smtp.ferozo.com');
  assert.equal(transporter.options.port, 465);
  assert.equal(transporter.options.secure, true);
  assert.equal(transporter.options.auth.user, 'notificaciones@sonriemascorrientes.com');
  assert.equal(transporter.options.auth.pass, 'contrasena-secreta-de-prueba');
});

test('createTransporter() define connectionTimeout y socketTimeout en 5000ms', () => {
  setFullValidEnv();
  const { createTransporter } = require('./mailer');
  const transporter = createTransporter();
  assert.equal(transporter.options.connectionTimeout, 5000);
  assert.equal(transporter.options.socketTimeout, 5000);
});

test('SMTP_PORT ausente cae al default 465 sin lanzar excepcion', () => {
  setFullValidEnv({ SMTP_PORT: undefined });
  delete process.env.SMTP_PORT;
  const { createTransporter } = require('./mailer');
  const transporter = createTransporter();
  assert.equal(transporter.options.port, 465);
});

test('SMTP_PORT no numerico cae al default 465 sin lanzar excepcion', () => {
  setFullValidEnv({ SMTP_PORT: 'no-es-un-numero' });
  const { createTransporter } = require('./mailer');
  const transporter = createTransporter();
  assert.equal(transporter.options.port, 465);
});

test('createTransporter() cachea el transporter a nivel de modulo (misma instancia entre llamadas)', () => {
  setFullValidEnv();
  const { createTransporter } = require('./mailer');
  const first = createTransporter();
  const second = createTransporter();
  assert.equal(first, second);
});

// ---------------------------------------------------------------------
// buildClinicNotificationEmail() — criterios 3, 4
// ---------------------------------------------------------------------

function baseLead(overrides = {}) {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    nombre: 'Ana Pérez',
    email: 'ana@example.com',
    telefono: '+54 11 4444-5555',
    servicio: 'Ortodoncia',
    mensaje: 'Quisiera turno para la semana que viene',
    fecha_creacion: '2026-08-19T12:00:00.000Z',
    ...overrides,
  };
}

test('buildClinicNotificationEmail(): to/from/replyTo correctos', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const mail = buildClinicNotificationEmail(baseLead());
  assert.equal(mail.to, 'clinica@sonriemascorrientes.com');
  assert.equal(mail.from, 'notificaciones@sonriemascorrientes.com');
  assert.equal(mail.replyTo, 'ana@example.com');
});

test('buildClinicNotificationEmail(): el HTML contiene id y una representacion legible de fecha_creacion', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const mail = buildClinicNotificationEmail(baseLead());
  assert.ok(mail.html.includes('44444444-4444-4444-4444-444444444444'));
  assert.ok(mail.html.includes('2026'), 'debe incluir alguna representacion legible del año de fecha_creacion');
});

test('buildClinicNotificationEmail(): escapa <, >, &, ", \' en nombre/mensaje (no permite <script> literal)', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const lead = baseLead({
    nombre: '<script>alert(1)</script>',
    mensaje: 'Hola & "gracias" \'doctor\'',
  });
  const mail = buildClinicNotificationEmail(lead);
  assert.equal(mail.html.includes('<script>alert(1)</script>'), false);
  assert.ok(mail.html.includes('&lt;script&gt;'));
  assert.equal(mail.html.includes('Hola & "gracias"'), false);
});

test('buildClinicNotificationEmail(): telefono/servicio/mensaje null -> placeholders, nunca "null" literal', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const mail = buildClinicNotificationEmail(
    baseLead({ telefono: null, servicio: null, mensaje: null })
  );
  assert.ok(mail.html.includes('No proporcionado'));
  assert.ok(mail.html.includes('No especificado'));
  assert.ok(mail.html.includes('Sin mensaje adicional'));
  assert.equal(/>\s*null\s*</.test(mail.html), false);
});

test('buildClinicNotificationEmail(): mensaje multilinea se convierte a <br> despues de escapar', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const mail = buildClinicNotificationEmail(baseLead({ mensaje: 'linea uno\nlinea dos' }));
  assert.ok(mail.html.includes('linea uno<br>linea dos'));
});

test('buildClinicNotificationEmail(): subject saneado contra header injection (\\r\\n en nombre)', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const lead = baseLead({ nombre: 'Juan\r\nBcc: attacker@evil.com' });
  const mail = buildClinicNotificationEmail(lead);
  assert.equal(/[\r\n]/.test(mail.subject), false);
  assert.ok(mail.subject.includes('Juan'));
});

test('buildClinicNotificationEmail(): fecha_creacion invalida/null no rompe la construccion del HTML', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const mail = buildClinicNotificationEmail(baseLead({ fecha_creacion: null }));
  assert.equal(typeof mail.html, 'string');
  assert.ok(mail.html.length > 0);
});

test('buildClinicNotificationEmail(): incluye version en texto plano (mailOptions.text)', () => {
  setFullValidEnv();
  const { buildClinicNotificationEmail } = require('./mailer');
  const mail = buildClinicNotificationEmail(baseLead());
  assert.equal(typeof mail.text, 'string');
  assert.ok(mail.text.includes('Ana Pérez'));
  assert.equal(mail.text.includes('<'), false);
});
