'use strict';

const nodemailer = require('nodemailer');
const { escapeHtml } = require('./sanitize-html');

// Contrato completo en runs/05-notificacion-clinica-smtp-ferozo/spec.md y
// en docs/tecnica/notificacion-clinica-smtp-ferozo.md. Este modulo
// construye el transporter de Nodemailer (SMTP de Ferozo, TLS implicito
// por el puerto 465) y arma el contenido (HTML + texto plano) del correo
// de notificacion a la clinica. Prefijo `_` en el nombre del directorio
// (mismo patron que supabase-client.js y sanitize-html.js): queda
// excluido del routing de Vercel.

const SMTP_CONNECTION_TIMEOUT_MS = 5000; // 5s, criterio 12 del spec
const SMTP_SOCKET_TIMEOUT_MS = 5000; // 5s, criterio 12 del spec
const DEFAULT_SMTP_PORT = 465;

// Transporter cacheado a nivel de modulo, mismo patron que
// getSupabaseClient() en supabase-client.js: se reutiliza entre
// invocaciones de una misma instancia serverless "caliente". Ver "Casos
// borde" del spec: no se prevee activamente la rotacion de credenciales
// dentro de la vida de un mismo proceso (cada despliegue de Vercel
// arranca una instancia nueva).
let cachedTransporter = null;

/**
 * Crea (y cachea) el transporter de Nodemailer contra el SMTP de Ferozo,
 * usando exclusivamente variables de entorno. Lanza un Error descriptivo
 * (sin incluir ningun valor de configuracion) si falta alguna variable
 * requerida para el envio: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM o
 * LEADS_NOTIFICATION_EMAIL. api/leads.js trata esa excepcion como un
 * fallo de envio de email (no como un 500 del endpoint): el lead ya se
 * insertó y esa inserción no debe verse afectada por un entorno de email
 * mal configurado.
 *
 * @returns {import('nodemailer').Transporter}
 */
function createTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  const leadsNotificationEmail = process.env.LEADS_NOTIFICATION_EMAIL;

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom || !leadsNotificationEmail) {
    throw new Error(
      'Configuracion SMTP incompleta: faltan una o mas de SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM o LEADS_NOTIFICATION_EMAIL.'
    );
  }

  const smtpPort = Number(process.env.SMTP_PORT) || DEFAULT_SMTP_PORT;

  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true, // TLS implicito, puerto 465 (criterio no negociable del spec)
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });

  return cachedTransporter;
}

/**
 * Elimina cualquier `\r`/`\n` crudo de un valor de texto que se vaya a
 * interpolar en un header de correo (ej. `subject`), mitigando header
 * injection SMTP (criterio 4 del spec, caso borde documentado). No es
 * `escapeHtml()`: el subject no es HTML, es texto plano de header.
 *
 * @param {string} value
 * @returns {string}
 */
function sanitizeHeaderValue(value) {
  return value.replace(/[\r\n]+/g, ' ');
}

/**
 * Formatea `fecha_creacion` (timestamptz de Postgres, string ISO 8601)
 * de forma legible para el cuerpo del correo. Si el valor no es un
 * string parseable como fecha valida (caso borde defensivo del spec:
 * fixture mal armado, valor null), devuelve un placeholder en vez de
 * romper la construccion del email.
 *
 * @param {unknown} fechaCreacion
 * @returns {string}
 */
function formatFechaCreacion(fechaCreacion) {
  if (typeof fechaCreacion !== 'string') {
    return 'Fecha no disponible';
  }
  const parsed = new Date(fechaCreacion);
  if (Number.isNaN(parsed.getTime())) {
    return 'Fecha no disponible';
  }
  return parsed.toLocaleString('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/**
 * Arma el mensaje de notificacion interna a la clinica a partir del lead
 * ya insertado. Devuelve `{ to, from, replyTo, subject, html, text }`,
 * listo para pasar a `transporter.sendMail(...)`.
 *
 * @param {{
 *   id: string,
 *   nombre: string,
 *   email: string,
 *   telefono: string | null,
 *   servicio: string | null,
 *   mensaje: string | null,
 *   fecha_creacion: string,
 * }} lead
 */
function buildClinicNotificationEmail(lead) {
  const to = process.env.LEADS_NOTIFICATION_EMAIL;
  const from = process.env.SMTP_FROM;
  const replyTo = lead.email;

  // subject: nombre SIN escapar HTML (no es HTML, es texto de header),
  // pero saneado contra \r/\n antes de interpolarse (criterio 4).
  const subjectNombre = sanitizeHeaderValue(lead.nombre);
  const subject = `Nuevo lead: ${subjectNombre} — Sonríe más`;

  const telefonoDisplay = lead.telefono || 'No proporcionado';
  const servicioDisplay = lead.servicio || 'No especificado';
  const mensajeDisplay = lead.mensaje || 'Sin mensaje adicional';
  const fechaDisplay = formatFechaCreacion(lead.fecha_creacion);

  const nombreHtml = escapeHtml(lead.nombre);
  const emailHtml = escapeHtml(lead.email);
  const telefonoHtml = escapeHtml(telefonoDisplay);
  const servicioHtml = escapeHtml(servicioDisplay);
  // Saltos de linea del mensaje convertidos a <br> DESPUES de escapar
  // (criterio de aceptacion / caso borde: si se reemplazara antes, el
  // escape de '/' alteraria cualquier <br> ya insertado).
  const mensajeHtml = escapeHtml(mensajeDisplay).replace(/\n/g, '<br>');
  const fechaHtml = escapeHtml(fechaDisplay);
  const idHtml = escapeHtml(lead.id);

  const html = `
    <div>
      <p>Notificación automática de <strong>Sonríe más</strong>: se recibió un nuevo lead a través del sitio web.</p>
      <table>
        <tbody>
          <tr><td><strong>Nombre</strong></td><td>${nombreHtml}</td></tr>
          <tr><td><strong>Email</strong></td><td>${emailHtml}</td></tr>
          <tr><td><strong>Teléfono</strong></td><td>${telefonoHtml}</td></tr>
          <tr><td><strong>Servicio de interés</strong></td><td>${servicioHtml}</td></tr>
          <tr><td><strong>Mensaje</strong></td><td>${mensajeHtml}</td></tr>
          <tr><td><strong>Fecha de recepción</strong></td><td>${fechaHtml}</td></tr>
          <tr><td><strong>ID del lead</strong></td><td>${idHtml}</td></tr>
        </tbody>
      </table>
    </div>
  `.trim();

  const text = [
    'Notificación automática de Sonríe más: se recibió un nuevo lead a través del sitio web.',
    '',
    `Nombre: ${lead.nombre}`,
    `Email: ${lead.email}`,
    `Teléfono: ${telefonoDisplay}`,
    `Servicio de interés: ${servicioDisplay}`,
    `Mensaje: ${mensajeDisplay}`,
    `Fecha de recepción: ${fechaDisplay}`,
    `ID del lead: ${lead.id}`,
  ].join('\n');

  return { to, from, replyTo, subject, html, text };
}

/**
 * Arma el mensaje de confirmacion de recepcion dirigido al propio
 * paciente (feature 06, contraparte de buildClinicNotificationEmail).
 * Firma de entrada identica (mismo objeto `lead` que ya arma
 * api/leads.js tras el INSERT), pero destinatario y contenido son
 * distintos: confirma al paciente que su solicitud fue recibida y aclara
 * de forma explicita y prominente que el turno TODAVIA NO esta
 * confirmado (la clinica se va a comunicar para coordinarlo).
 *
 * Deliberadamente NO incluye `telefono`, `servicio` ni `mensaje` del
 * lead (ver runs/06-confirmacion-automatica-paciente/spec.md, "Riesgos /
 * supuestos", y docs/tecnica/confirmacion-automatica-paciente.md):
 * `mensaje`/`servicio` son dato clinico sensible (texto libre que puede
 * describir sintomas, o intencion de tratamiento); `telefono` es dato de
 * contacto personal innecesario para esta confirmacion — son dos razones
 * distintas que llevan al mismo resultado de exclusion, no una sola
 * categoria fusionada (nota no bloqueante de audit-1.md).
 *
 * `subject` es fijo, sin interpolar ningun dato del lead: a diferencia
 * de `buildClinicNotificationEmail`, no requiere `sanitizeHeaderValue()`
 * porque no hay nada que sanear (menor superficie de header injection,
 * ver docs/tecnica/confirmacion-automatica-paciente.md).
 *
 * @param {{
 *   id: string,
 *   nombre: string,
 *   email: string,
 *   telefono: string | null,
 *   servicio: string | null,
 *   mensaje: string | null,
 *   fecha_creacion: string,
 * }} lead
 */
function buildPatientConfirmationEmail(lead) {
  const to = lead.email;
  const from = process.env.SMTP_FROM;
  const replyTo = process.env.LEADS_NOTIFICATION_EMAIL;

  // Subject fijo (criterio 5/f06): no interpola ningun dato del lead.
  const subject = 'Recibimos tu solicitud — Sonríe más';

  const nombreHtml = escapeHtml(lead.nombre);

  const html = `
    <div>
      <p>Hola ${nombreHtml},</p>
      <p>Recibimos tu solicitud de contacto a través del sitio web de <strong>Sonríe más</strong>. ¡Gracias por escribirnos!</p>
      <p><strong>Todavía tu turno no está confirmado.</strong> Nuestro equipo se va a comunicar con vos próximamente para coordinar la fecha y el horario.</p>
      <p>Saludos,<br>El equipo de Sonríe más</p>
    </div>
  `.trim();

  const text = [
    `Hola ${lead.nombre},`,
    '',
    'Recibimos tu solicitud de contacto a través del sitio web de Sonríe más. ¡Gracias por escribirnos!',
    '',
    'Todavía tu turno no está confirmado. Nuestro equipo se va a comunicar con vos próximamente para coordinar la fecha y el horario.',
    '',
    'Saludos,',
    'El equipo de Sonríe más',
  ].join('\n');

  return { to, from, replyTo, subject, html, text };
}

module.exports = { createTransporter, buildClinicNotificationEmail, buildPatientConfirmationEmail };
