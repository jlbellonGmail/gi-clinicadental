# Notificación a la clínica por email (SMTP Ferozo) — documentación técnica

Extiende `api/leads.js` (features `03-endpoint-recepcion-leads` y
`04-proteccion-antispam-y-abuso`, ya mergeadas) para que, tras un
`INSERT` nuevo exitoso, se envíe una notificación HTML por email a la
clínica usando Nodemailer contra el SMTP de Ferozo. Spec completo:
`runs/05-notificacion-clinica-smtp-ferozo/spec.md` (19 criterios de
aceptación, aprobado en `audit-2.md` tras un intento inicial rechazado en
`audit-1.md` por ambigüedad sobre el origen de `fecha_creacion` y falta
de cobertura explícita de header injection).

## `api/_lib/mailer.js`

Mismo patrón de aislamiento que `api/_lib/supabase-client.js` y
`api/_lib/sanitize-html.js`: prefijo `_` en el directorio, excluido del
routing de Vercel.

- **`createTransporter()`**: crea y cachea a nivel de módulo (mismo
  patrón que `getSupabaseClient()`) un transporter de Nodemailer con
  `host: SMTP_HOST`, `port: Number(SMTP_PORT) || 465`, `secure: true`
  (TLS implícito, puerto 465), `auth: { user: SMTP_USER, pass: SMTP_PASS }`,
  `connectionTimeout: 5000` y `socketTimeout: 5000` (constantes con
  nombre explícito: `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_SOCKET_TIMEOUT_MS`).
  Lanza un `Error` descriptivo (sin incluir ningún valor de variable de
  entorno en el mensaje) si falta `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`,
  `SMTP_FROM` o `LEADS_NOTIFICATION_EMAIL`. Una variable presente pero
  vacía (`''`) se trata igual que ausente (caso borde explícito del
  spec: configuración SMTP parcial).
- **`buildClinicNotificationEmail(lead)`**: dado el lead ya insertado
  (`{ id, nombre, email, telefono, servicio, mensaje, fecha_creacion }`),
  devuelve `{ to, from, replyTo, subject, html, text }`:
  - `to`: `LEADS_NOTIFICATION_EMAIL`. `from`: `SMTP_FROM`. `replyTo`: el
    `email` del lead, sin escapar (es un header, no HTML; conveniencia
    operativa para que la clínica responda directo al paciente —
    `EMAIL_PATTERN` de `api/leads.js` ya excluye whitespace/`\r`/`\n`,
    por lo que `email` no representa riesgo de header injection).
  - `subject`: `"Nuevo lead: {nombre} — Sonríe más"`, con `nombre`
    **saneado contra `\r`/`\n`** (`sanitizeHeaderValue()`, reemplaza
    cualquier salto de línea por un espacio) **antes** de interpolarse,
    independientemente de `escapeHtml()` (que no toca esos caracteres).
    Mitiga header injection SMTP: `nombre` solo se valida por longitud
    (2–150 tras `trim()`, feature `03`), no por caracteres permitidos, así
    que un valor como `"Juan\r\nBcc: attacker@evil.com"` pasa las
    validaciones existentes y llegaría crudo al header sin este
    saneamiento explícito.
  - `html`: cada campo de texto libre (`nombre`, `email`, `telefono`,
    `servicio`, `mensaje`) pasa por `escapeHtml()` de
    `api/_lib/sanitize-html.js` antes de interpolarse. `telefono`/
    `servicio`/`mensaje` ausentes (`null`) se muestran como "No
    proporcionado" / "No especificado" / "Sin mensaje adicional"
    respectivamente — nunca la palabra `null` ni una celda vacía. Los
    saltos de línea de `mensaje` se convierten a `<br>` **después** de
    `escapeHtml()` (si se hiciera antes, el escape de `/` alteraría
    cualquier `<br>` ya insertado). `id` y `fecha_creacion` también pasan
    por `escapeHtml()` por consistencia, aunque son valores generados por
    el sistema (UUID/timestamp) sin riesgo real de inyección.
  - `text`: versión en texto plano equivalente (`mailOptions.text`),
    buena práctica de entregabilidad, sin HTML.
  - `formatFechaCreacion()`: formatea `fecha_creacion` con
    `Date#toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })`.
    Si el valor no es un string parseable como fecha válida (caso borde
    defensivo: fixture de test mal armado, o cualquier valor inesperado),
    devuelve el placeholder `"Fecha no disponible"` en vez de lanzar —
    la construcción del email nunca debe romperse por este campo.

## Cambio en `api/leads.js`: origen de `fecha_creacion`

El `INSERT` existente (paso 12) cambia de `.select('id').single()` a
`.select('id, fecha_creacion').single()`. **Decisión explícita (resuelve
la ambigüedad señalada por `audit-1.md`):** `id` y `fecha_creacion` se
toman directamente de la fila devuelta por el `INSERT` real de Supabase,
**no** se genera ningún `new Date().toISOString()` local en Node. Motivo:
el valor que ve la clínica en el correo debe coincidir exactamente con el
que queda persistido en la fila real de `leads` (generado por el default
`now()` de Postgres), sin una segunda fuente de verdad que pudiera
divergir por el reloj del proceso Node o por latencia de red hacia
Supabase. El resto de columnas del lead (`nombre`, `email`, `telefono`,
`servicio`, `mensaje`) se toman de las variables locales ya
validadas/normalizadas (las mismas que se pasan al `.insert()`), no de la
respuesta de Supabase — esas columnas no cambian entre lo enviado y lo
persistido. La respuesta HTTP `201` sigue devolviendo únicamente
`{ id: data.id }`; `fecha_creacion` no se agrega a la respuesta JSON del
endpoint, solo se usa internamente para construir el email.

## Secuencia tras el `INSERT` exitoso, antes de responder

Disparada **únicamente** en la rama de `INSERT` nuevo (paso 12), nunca en
la rama de duplicado detectado (paso 11, feature `04`): esa rama ya
respondió y retornó antes de llegar a este bloque, y además no ejecuta
ningún `INSERT` (no hay `fecha_creacion` "nueva" que notificar).

1. `mailerFactory()` (por defecto `createTransporter` de
   `api/_lib/mailer.js`, inyectable vía `createHandler({ mailerFactory })`
   — mismo patrón que `supabaseClientFactory`). Si lanza (config SMTP
   faltante/inválida), se loguea `err.message` con `console.error` y se
   continúa directo a responder `201` (no se intenta `sendMail()` ni
   `UPDATE`).
2. Si el transporter se creó, `buildClinicNotificationEmail(lead)` con
   `lead = { id: data.id, nombre, email, telefono, servicio, mensaje,
   fecha_creacion: data.fecha_creacion }`, y `await transporter.sendMail(...)`.
   - Rechazo/excepción → se loguea `err.message` (nunca el objeto de
     error completo ni el objeto de configuración del transporter, para
     no arriesgar filtrar `SMTP_PASS` si algún día viniera embebido en
     una propiedad extendida del error) y se salta el `UPDATE`.
   - Éxito → sigue al paso 3.
3. Solo si `sendMail()` fue exitoso:
   `UPDATE leads SET notificacion_clinica_enviada = true WHERE id = data.id`,
   con el mismo cliente Supabase ya obtenido en este request. Si ese
   `UPDATE` falla, se loguea `error.message` pero **no** cambia la
   respuesta ya decidida — el email sí se envió, solo el flag de
   tracking no se pudo persistir (riesgo aceptado, ver "Riesgos /
   supuestos" del spec).
4. `respond(201, { id: data.id })` — exactamente el mismo contrato de
   éxito preexistente, en los tres escenarios (envío exitoso, fallo de
   envío, config faltante) y también si el `UPDATE` del flag falla.

**Por qué toda esta lógica queda en `try/catch` explícitos y acotados**
(no delegada al `catch` genérico de nivel superior del handler): la
"regla dura" del spec exige que ningún fallo de email pueda, por
accidente, hacer que el `catch` genérico produzca un `500` en vez del
`201` ya decidido, ni vuelva a tocar la lógica de inserción. Cada paso de
riesgo (crear transporter, `sendMail`, `UPDATE`) tiene su propio
`try/catch` que nunca relanza la excepción hacia afuera.

## Por qué síncrono, con timeout, sin reintentos

- **Síncrono dentro del mismo request** (no "fire and forget"): un
  entorno serverless no garantiza que el proceso siga vivo después de
  que la función devuelve la respuesta HTTP — un envío verdaderamente
  no esperado podría no completarse nunca. El costo aceptado es que el
  tiempo de respuesta de `POST /api/leads` crece por el tiempo real de
  envío SMTP, acotado a un máximo de ~5 segundos por los timeouts.
- **`connectionTimeout`/`socketTimeout` de 5000 ms cada uno**: evita que
  un SMTP colgado bloquee la función serverless hasta el límite de
  duración de Vercel.
- **Sin reintentos** (ni inmediatos ni diferidos/cola): un solo intento
  de `sendMail()` por lead insertado. Un lead con
  `notificacion_clinica_enviada = false` tras un fallo queda así hasta
  que alguien lo gestione manualmente vía el panel de Supabase — el
  ítem `15-observabilidad-y-operacion` del roadmap es donde correspondería
  resolver esto de forma sistemática, no esta feature.

## Por qué no se notifica en la rama de duplicado

La feature `04` responde `201` con el `id` existente sin ejecutar ningún
`INSERT` cuando detecta un lead reciente con mismo `email`+`nombre`. No
se dispara `sendMail()` en ese caso: la clínica ya recibió la
notificación original, y además no existe una `fecha_creacion` "nueva"
que mostrar (no hubo `INSERT`).

## Testing

- `api/_lib/mailer.test.js`: unidades de `createTransporter()` (config
  faltante/parcial lanza; config completa arma `host`/`port`/`secure`/
  `auth`/timeouts correctos; `SMTP_PORT` ausente o no numérico cae a
  `465`; cacheado a nivel de módulo) y de `buildClinicNotificationEmail()`
  (escapado HTML, placeholders para campos `null`, saltos de línea →
  `<br>` después de escapar, saneamiento de `\r`/`\n` en `subject`,
  `fecha_creacion` inválida no rompe la construcción, versión `text`).
- `api/leads.test.js` (sección "Feature 05"): inyecta `mailerFactory`
  (análogo a `supabaseClientFactory`) con un mailer falso
  (`makeFakeMailer`, con `sentMails` para inspeccionar cada
  `mailOptions`). Cubre: envío disparado en INSERT nuevo con
  `to`/`from`/`replyTo` correctos y `.select('id, fecha_creacion')`
  verificado sobre el fixture de Supabase falso; HTML con escapado e
  inclusión de `id`/`fecha_creacion`; no-envío en la rama de duplicado;
  `UPDATE` del flag en éxito; contrato `201` preservado ante fallo de
  `sendMail()`, `mailerFactory` y `UPDATE`; ausencia de credenciales en
  `console.error` (incluso si el error simulado trae propiedades
  adicionales con datos sensibles); dos leads independientes disparan
  dos notificaciones independientes.
- El fixture `makeFakeSupabaseClient()` de `api/leads.test.js` se amplió
  para devolver `fecha_creacion` en `.insert().select().single()`
  (parámetro `fechaCreacion`, default `'2026-08-19T12:00:00.000Z'`),
  registrar los argumentos de ese `.select()` (`insertSelectCalls`) y
  soportar `.update(values).eq(column, value)` (`updateCalls`,
  `failOnUpdate`).

## Qué NO cambia / NO incluye esta feature

- El contrato HTTP de éxito de `POST /api/leads` (`201` + `{ id }`) es
  idéntico al de antes de esta feature en todos los escenarios de email.
- El correo de confirmación al **paciente**
  (`confirmacion_paciente_enviada`) se agregó por separado en la feature
  `06` — ver `docs/tecnica/confirmacion-automatica-paciente.md`.
- No se modifican `index.html` ni `script.js` (el formulario sigue
  simulado, feature `08`).
- No se agrega tabla ni columna nueva en Supabase: se reutiliza
  `notificacion_clinica_enviada`, ya creada por la migración de la
  feature `02`.
- No se prueba contra un servidor SMTP real de Ferozo (ni en CI ni
  localmente): toda la cobertura automática usa un transporter
  inyectado/simulado. Verificación de entregabilidad real (SPF/DKIM/DMARC)
  es el ítem `12-entregabilidad-correo-dominio` del roadmap.
