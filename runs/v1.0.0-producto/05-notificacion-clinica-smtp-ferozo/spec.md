# Spec: Notificación a la clínica por email (SMTP Ferozo)

## Alcance

Extender `POST /api/leads` (`api/leads.js`, features `03`/`04` ya
mergeadas) para que, **después** de que un lead se inserta exitosamente
en Supabase (rama de `INSERT` nuevo, ver más abajo qué rama exactamente),
se envíe una notificación HTML por email a la dirección definida en
`LEADS_NOTIFICATION_EMAIL`, usando Nodemailer contra el servidor SMTP de
Ferozo (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`, ya
documentadas en `.env.example` desde la feature `01`), por conexión TLS
implícita en el puerto 465. Si el envío tiene éxito, se actualiza
`notificacion_clinica_enviada = true` en el lead recién insertado.

Incluye:

1. Nuevo módulo `api/_lib/mailer.js` (prefijo `_` para quedar excluido
   del routing de Vercel, mismo patrón que `supabase-client.js` y
   `sanitize-html.js`): construye el transporter de Nodemailer desde
   variables de entorno y arma el contenido (HTML + texto plano) del
   correo de notificación.
2. Integración de ese módulo en `api/leads.js`, invocada únicamente tras
   un `INSERT` nuevo exitoso (no tras la rama de duplicado detectado de
   la feature `04` — ver "Diseño propuesto").
3. `UPDATE` de `notificacion_clinica_enviada = true` sobre el lead
   insertado, solo si el envío fue exitoso.
4. Nueva dependencia npm de producción: `nodemailer`, agregada a
   `package.json`/`package-lock.json`, documentada como decisión
   explícita nueva en `docs/tecnica/arquitectura.md` (regla dura de
   `AGENTS.md`, sección "Reglas de dominio" — ya estaba prevista en el
   stack objetivo, pero la incorporación real de la dependencia igual
   requiere su propia sección en ese archivo).
5. Inyección de dependencias para tests: `api/leads.js` debe aceptar un
   factory de mailer inyectable (mismo patrón que
   `supabaseClientFactory`), de forma que los tests puedan simular envío
   exitoso y fallido sin red real ni servidor SMTP real.
6. Cambio puntual en la consulta de `INSERT` existente (paso 12,
   `api/leads.js`): de `.select('id')` a `.select('id, fecha_creacion')`,
   para traer el valor real de `fecha_creacion` generado por el default
   `now()` de Postgres — ver "Diseño propuesto → 2" para el detalle
   completo de esta decisión, tomada explícitamente para resolver una
   ambigüedad señalada por `audit-1.md`.

### Explícitamente NO incluye

- El correo de confirmación al **paciente** (`confirmacion_paciente_enviada`)
  es la feature `06-confirmacion-automatica-paciente`, fuera de alcance
  total de esta spec: ni el envío ni el contenido de ese segundo correo
  se tocan aquí.
- No se modifican `index.html` ni `script.js`: el formulario sigue
  simulado (feature `08`).
- No se implementa ningún mecanismo de reintento automático (cola,
  backoff, reintento diferido) si el envío SMTP falla. Un solo intento
  por request; el lead queda con `notificacion_clinica_enviada = false`
  y visible para gestión manual vía el panel de Supabase (alcance
  completo de reintentos/observabilidad es el ítem `15` del roadmap, no
  esta feature — ver "Riesgos / supuestos").
- No se agrega ninguna tabla ni columna nueva en Supabase: se reutiliza
  `notificacion_clinica_enviada`, ya creada por la migración de la
  feature `02`. El cambio de `.select('id')` a
  `.select('id, fecha_creacion')` en el `INSERT` de `api/leads.js` NO es
  un cambio de esquema: `fecha_creacion` ya existe en la tabla `leads`
  desde esa misma migración; solo se pide que la consulta la devuelva.
- No se valida ni se prueba contra un servidor SMTP real de Ferozo en
  esta feature (ni en CI ni localmente): toda la verificación automática
  usa un transporter Nodemailer simulado/inyectado. La verificación de
  entregabilidad real (SPF/DKIM/DMARC, recepción efectiva) es el ítem
  `12-entregabilidad-correo-dominio` del roadmap.
- No se agrega manejo de adjuntos, plantillas externas (motor de
  templating, MJML, archivos `.hbs`, etc.) ni internacionalización: el
  HTML se genera con un template literal simple en JavaScript, en
  español, igual que el resto del contenido del sitio.
- No se cambia el contrato de respuesta HTTP de éxito de
  `POST /api/leads`: sigue siendo `201` con `{ "id": <uuid> }` en todos
  los casos donde el lead se insertó (o se detectó como duplicado),
  **incluido cuando el envío del email falla** (ver "Diseño propuesto",
  punto "Manejo de errores SMTP").

## Contexto

`api/leads.js` ya inserta el lead en Supabase (feature `03`) con
protecciones de antispam/idempotencia (feature `04`). La columna
`notificacion_clinica_enviada` existe desde la migración inicial
(feature `02`) con default `false`, pero hoy nada la actualiza nunca a
`true`: no hay ningún flujo de email en el repo todavía.
`api/_lib/sanitize-html.js` (`escapeHtml()`) ya fue dejado listo en la
feature `03` explícitamente para que esta feature (y la `06`) lo
consuman al construir HTML de correo, sin invocarlo hasta ahora.

`AGENTS.md` (sección "Stack") ya declara Nodemailer + SMTP de Ferozo con
TLS por el puerto 465 como el mecanismo de correo transaccional objetivo
del proyecto, y las variables de entorno correspondientes
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`,
`LEADS_NOTIFICATION_EMAIL`) ya están documentadas en `.env.example`
desde la feature `01`. Esta feature es la primera en usarlas realmente.

El sitio sigue sin frontend conectado (`08` es posterior), así que el
único cliente real de `/api/leads` en producción hoy sería quien lo
invoque directamente (o pruebas manuales/QA). El envío de email debe
funcionar de forma autónoma dentro del propio handler, sin depender de
ningún proceso externo (no hay cola de trabajos ni función serverless
separada para esto — se mantiene simple, dentro del mismo request).

## Diseño propuesto

### 1. Nuevo módulo `api/_lib/mailer.js`

Responsabilidades sugeridas (el `builder-agent` puede ajustar nombres
internos, pero debe preservar el comportamiento y la inyectabilidad
descritos):

- `createTransporter()`: crea (y cachea a nivel de módulo, mismo patrón
  que `getSupabaseClient()`) un transporter de Nodemailer con:
  ```js
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true, // TLS implícito, puerto 465 (criterio no negociable del pedido)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000, // 5s — evita que un SMTP colgado bloquee la función serverless
    socketTimeout: 5000,
  });
  ```
  Si falta `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` o
  `LEADS_NOTIFICATION_EMAIL`, la función lanza un error descriptivo (sin
  incluir el valor de ninguna variable en el mensaje). Este caso se trata
  como **fallo de envío** (ver más abajo), no como `500` del endpoint:
  el lead ya se insertó y esa inserción no debe verse afectada por un
  entorno de email mal configurado.
- `buildClinicNotificationEmail(lead)`: dado el lead ya insertado
  (`{ id, nombre, email, telefono, servicio, mensaje, fecha_creacion }`),
  devuelve `{ to, from, subject, html, text }`. **Origen exacto de cada
  campo de `lead` (decisión explícita, resolviendo la ambigüedad
  señalada en `audit-1.md`):**
  - `id` y `fecha_creacion` vienen directamente de la fila devuelta por
    el `INSERT` de Supabase (paso 12 de `api/leads.js`, ver sección "2.
    Integración" más abajo) — **no** se genera ningún timestamp
    localmente en Node (`new Date().toISOString()`) para este propósito.
    Se eligió esta ruta (en vez de generar el timestamp en el propio
    handler) para que el correo muestre exactamente el mismo valor que
    queda persistido en la fila real de `leads`, sin una segunda fuente
    de verdad que pudiera divergir por el reloj del proceso Node o por
    latencia entre "armar el objeto" y "ejecutar el INSERT".
  - `nombre`, `email`, `telefono`, `servicio`, `mensaje` vienen de las
    variables locales ya validadas/normalizadas en el handler (mismas
    que se pasan al `.insert()`), sin volver a leerlas de la respuesta
    de Supabase (esas columnas no cambian entre lo enviado y lo
    persistido, a diferencia de `id`/`fecha_creacion`, que solo existen
    una vez que Postgres los genera).
  - `to`: `process.env.LEADS_NOTIFICATION_EMAIL`.
  - `from`: `process.env.SMTP_FROM`.
  - `replyTo`: el `email` del lead (sin escapar — es un header, no HTML;
    permite que quien gestiona el correo en la clínica responda
    directamente al paciente). Decisión de conveniencia operativa, no
    exigida literalmente por el pedido — documentada en "Riesgos /
    supuestos" para que el reviewer pueda objetarla.
  - `subject`: `"Nuevo lead: {nombre} — Sonríe más"` (nombre SIN escapar
    HTML, porque es texto plano de header de correo, no HTML — pero sí
    debe sanearse eliminando/reemplazando cualquier `\r`/`\n` presente en
    `nombre` **antes** de interpolarlo en el `subject`, independientemente
    de `escapeHtml()`, que no toca esos caracteres — ver "Casos borde" y
    el criterio de aceptación 4, nuevo en este intento).
  - `html`: template literal con los datos del lead, cada valor pasado
    por `escapeHtml()` de `api/_lib/sanitize-html.js` antes de
    interpolarse (aplica a `nombre`, `email`, `telefono`, `servicio`,
    `mensaje`; `id` y `fecha_creacion` son valores generados por el
    sistema —UUID y timestamp—, no texto libre ingresado por el usuario,
    pero igual deben pasar por `escapeHtml()` si se interpolan como
    string, por consistencia y sin costo: no cambian su representación
    visual al escaparse). Contenido mínimo requerido:
    - Nombre, Email, Teléfono (o "No proporcionado" si `null`), Servicio
      de interés (o "No especificado" si `null`), Mensaje (o "Sin
      mensaje adicional" si `null`; saltos de línea del mensaje
      convertidos a `<br>` **después** de escapar, nunca antes),
      Fecha de recepción (`fecha_creacion`, formateada legible, con el
      origen descrito arriba — el valor real devuelto por el `INSERT`),
      e `id` del lead (el mismo `id` devuelto en la respuesta HTTP
      `201`, para que la clínica pueda ubicarlo en Supabase).
    - Encabezado simple indicando que es una notificación automática de
      "Sonríe más" (nombre del negocio ya usado en `.env.example`, no es
      contenido médico/clínico inventado).
    - No incluye ningún texto de marketing, precios, tratamientos ni
      certificaciones (regla de dominio de `AGENTS.md`).
  - `text`: versión en texto plano equivalente, sin HTML, como
    alternativa (`mailOptions.text`), buena práctica de entregabilidad
    (no exigida explícitamente por el pedido, pero de bajo costo y sin
    riesgo — documentada como decisión propia).

### 2. Integración en `api/leads.js`

- **Cambio previo obligatorio en la consulta de `INSERT` existente
  (paso 12):** hoy termina en `.select('id').single()` (línea 665 de
  `api/leads.js` al momento de este análisis). Esta feature lo cambia a
  `.select('id, fecha_creacion').single()`. Es el único cambio en el
  `INSERT` ya existente que esta feature introduce; no se toca ninguna
  otra columna del `.insert([...])` en sí (`nombre`, `email`, `telefono`,
  `servicio`, `mensaje`, `consentimiento_privacidad`,
  `version_politica_privacidad` quedan igual). La respuesta HTTP sigue
  devolviendo únicamente `{ id: data.id }` — `fecha_creacion` no se
  agrega a la respuesta JSON del endpoint, solo se usa internamente para
  construir el email.
- El objeto `lead` que se pasa a `buildClinicNotificationEmail(lead)` se
  arma en el handler, inmediatamente después del `INSERT` exitoso, como:
  `{ id: data.id, nombre, email, telefono, servicio, mensaje, fecha_creacion: data.fecha_creacion }`
  — combinando el resultado real del `INSERT` (`id`, `fecha_creacion`)
  con las variables locales ya validadas usadas para insertar
  (`nombre`, `email`, `telefono`, `servicio`, `mensaje`).
- `createHandler(options)` gana una nueva opción inyectable:
  `mailerFactory` (por defecto, `createTransporter` de
  `api/_lib/mailer.js`), análoga a `supabaseClientFactory`. Los tests
  inyectan un objeto con un método `sendMail(mailOptions)` que devuelve
  una `Promise` (resuelta o rechazada), sin conexión real.
- El envío se dispara **únicamente** en la rama de `INSERT` nuevo
  exitoso (paso 12 del orden de evaluación extendido de la feature `04`),
  **nunca** en la rama de duplicado detectado (paso 11: cuando ya existe
  un lead reciente con mismo `email`+`nombre` y se responde `201` con el
  `id` existente sin insertar). Esto evita reenviar la notificación de un
  lead que la clínica ya recibió, consistente con el propósito de
  deduplicación de la feature `04`. (Nota: en la rama de duplicado no
  existe un `fecha_creacion` "nuevo" que enviar de todas formas, porque
  no se ejecuta ningún `INSERT` — otra razón consistente con no notificar
  ahí.)
- Secuencia exacta tras el `INSERT` exitoso, **antes** de responder al
  cliente:
  1. Armar el transporter (`mailerFactory()`). Si lanza (config
     faltante/inválida) → tratar como fallo de envío, ir al punto 4.
  2. Armar el mensaje (`buildClinicNotificationEmail(lead)`), con `lead`
     compuesto como se describe arriba.
  3. `await transporter.sendMail(mensaje)`.
     - Éxito → continuar al punto siguiente.
     - Rechazo/excepción → loguear el error server-side
       (`console.error`, sin credenciales SMTP ni el detalle interno de
       Nodemailer que pudiera incluir la contraseña; solo mensaje/motivo
       de alto nivel) y saltar directamente al punto 5 sin ejecutar el
       `UPDATE`.
  4. Si el envío fue exitoso: `UPDATE leads SET notificacion_clinica_enviada = true WHERE id = <id>`
     usando el mismo cliente Supabase ya obtenido en este request. Si
     ese `UPDATE` falla (error de Supabase), loguear el error
     server-side, pero **no** cambiar la respuesta HTTP ya decidida (el
     email sí se envió; solo el flag de tracking no se pudo persistir —
     riesgo aceptado, ver "Riesgos / supuestos").
  5. Responder `201` con `{ "id": <id> }` — **exactamente el mismo
     contrato de éxito que ya existía**, sin importar si el email se
     envió, falló, o si el `UPDATE` del flag falló. El cliente de la API
     nunca se entera del resultado del envío de email por esta vía
     (no se agrega ningún campo nuevo a la respuesta JSON, tampoco
     `fecha_creacion`).
- **Regla dura verificada por test**: ningún fallo en `sendMail()` ni en
  el `UPDATE` del flag debe: (a) hacer que el endpoint responda algo
  distinto de `201`, (b) borrar el lead ya insertado, (c) insertar un
  lead adicional. El try/catch del envío de email debe estar acotado
  estrictamente a los pasos de email/update — nunca debe volver a tocar
  la lógica de inserción ni el catch genérico de nivel superior que
  produce `500`.
- Nota para el `builder-agent`: el fixture de cliente Supabase falso ya
  usado en `api/leads.test.js` para la rama de `INSERT` (paso 12) debe
  actualizarse para devolver también `fecha_creacion` (además de `id`)
  en su respuesta simulada de `.select().single()`, dado el cambio de
  consulta descrito arriba — de lo contrario los tests nuevos de esta
  feature (criterio 3) no tendrían un valor de `fecha_creacion` real que
  verificar en el HTML.

### 3. Timeout, sin reintentos

- `connectionTimeout` y `socketTimeout` del transporter en `5000` ms
  cada uno (constantes con nombre explícito en el código, mismo patrón
  que `MIN_FORM_FILL_MS`/`DUPLICATE_WINDOW_MINUTES` de features previas).
  Esto acota cuánto puede demorar el request completo de
  `POST /api/leads` si el SMTP de Ferozo no responde, evitando que la
  función serverless se cuelgue hasta su límite de duración de Vercel.
- No se implementa ningún reintento dentro del mismo request ni diferido
  (sin cola, sin `setTimeout` post-respuesta — que además no es seguro
  en un entorno serverless, donde el proceso puede congelarse/terminar
  apenas se envía la respuesta). Un solo intento de `sendMail()` por
  lead insertado. Ver "Riesgos / supuestos".

### 4. `.env.example`

No se agregan variables nuevas: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_FROM` y `LEADS_NOTIFICATION_EMAIL` ya están
documentadas desde la feature `01`. Si el `builder-agent` detecta que el
comentario existente de esas variables en `.env.example` quedó
desactualizado respecto al comportamiento real (ej. que ahora sí se usan
para SMTP saliente), puede actualizar el comentario sin agregar
variables nuevas.

## Criterios de aceptación

1. Tras un `INSERT` nuevo exitoso en la rama principal de
   `POST /api/leads` (sin duplicado detectado), se invoca `sendMail()`
   del transporter Nodemailer con un mensaje dirigido a
   `LEADS_NOTIFICATION_EMAIL`, remitente `SMTP_FROM`, `replyTo` igual al
   `email` del lead. El `INSERT` real ejecutado contra el cliente
   Supabase (falso, inyectado en el test) usa `.select('id, fecha_creacion')`
   (no solo `.select('id')`) — verificable inspeccionando los argumentos
   con los que el test invoca `.select()` sobre el cliente Supabase falso,
   o por inspección de código de `api/leads.js`.
2. El transporter se construye con `host: SMTP_HOST`,
   `port: Number(SMTP_PORT) || 465`, `secure: true` (TLS implícito) y
   `auth: { user: SMTP_USER, pass: SMTP_PASS }` — verificable inyectando
   un `mailerFactory` falso en los tests y/o por inspección de código de
   `api/_lib/mailer.js`.
3. El HTML del correo contiene el `nombre`, `email`, `telefono` (o "No
   proporcionado"), `servicio` (o "No especificado") y `mensaje` (o "Sin
   mensaje adicional") del lead, cada uno pasado por `escapeHtml()` de
   `api/_lib/sanitize-html.js` antes de interpolarse, **y además
   contiene la `fecha_creacion` del lead (tal como la devolvió el
   `INSERT` de Supabase vía `.select('id, fecha_creacion')`, formateada
   de forma legible) y el `id` del lead (el mismo valor devuelto por ese
   `INSERT` y por la respuesta HTTP `201`)** — verificable con un test
   que: (a) envíe valores con caracteres `<`, `>`, `&`, `"`, `'` en
   `nombre`/`mensaje` y confirme que el HTML resultante NO contiene esos
   caracteres sin escapar (ej. no debe poder inyectarse una etiqueta
   `<script>` literal en el HTML del correo); y (b) inyectando un
   cliente Supabase falso que devuelva un `id` y una `fecha_creacion`
   conocidos en el `INSERT`, confirme que ambos valores aparecen en el
   HTML generado (el `id` tal cual, y alguna representación legible
   derivada de esa `fecha_creacion`).
4. Cuando `nombre` contiene secuencias `\r`/`\n` (simulando un intento de
   header injection, ej. un valor como
   `"Juan\r\nBcc: attacker@evil.com"` — la validación de `nombre` de la
   feature `03` solo exige longitud entre 2 y 150 caracteres tras
   `trim()`, sin restringir caracteres de control internos, por lo que
   este valor pasa las validaciones existentes), el `subject`
   efectivamente pasado a `sendMail()` **no contiene ningún `\r` ni `\n`
   crudo** — verificable con un test que inyecte ese `nombre`, capture
   el objeto `mailOptions` recibido por el mailer falso inyectado, y
   haga `assert` de que `subject` no matchea `/[\r\n]/`.
5. Ante una rama de duplicado detectado (feature `04`: mismo
   `email`+`nombre` dentro de la ventana de 5 minutos), **no** se invoca
   `sendMail()` — verificable con un contador de llamadas en el mailer
   inyectado en el test.
6. Cuando `sendMail()` resuelve exitosamente, se ejecuta un `UPDATE`
   sobre el lead insertado que fija `notificacion_clinica_enviada = true`
   — verificable inyectando un cliente Supabase falso que registre las
   llamadas a `.update()` y confirmando que se invoca con ese id y ese
   valor.
7. Cuando `sendMail()` rechaza (lanza o devuelve una `Promise` rechazada,
   simulando un fallo SMTP real), el endpoint **igual responde `201`**
   con `{ "id": <id del lead insertado> }`, **no** se ejecuta ningún
   `UPDATE` de `notificacion_clinica_enviada`, y el lead insertado sigue
   existiendo sin haberse insertado un segundo lead (verificable
   contando invocaciones a `insert()` del cliente Supabase falso: debe
   seguir siendo exactamente 1).
8. Cuando el `mailerFactory` lanza una excepción (simulando configuración
   SMTP faltante/inválida) en vez de que `sendMail()` rechace, el
   comportamiento es idéntico al criterio 7 (mismo `201`, mismo `id`, sin
   `UPDATE`, sin lead adicional, sin lead borrado).
9. Cuando el `UPDATE` de `notificacion_clinica_enviada` falla (el
   cliente Supabase falso simula un error en `.update()`), el envío de
   email ya se consideró exitoso, la respuesta sigue siendo `201` con el
   mismo `id`, y no se reintenta el `insert()` original ni se altera su
   resultado.
10. Ningún log emitido durante un fallo de envío de email
    (`console.error`) contiene el valor de `SMTP_PASS`, `SMTP_USER` ni
    el objeto de configuración completo del transporter — verificable
    interceptando `console.error` en el test y haciendo assert sobre el
    contenido serializado.
11. El contrato de respuesta HTTP de éxito de `POST /api/leads`
    (`201` + `{ "id": <uuid> }`) no cambia respecto al que documentaba
    `docs/tecnica/endpoint-recepcion-leads.md` antes de esta feature, en
    ninguno de los escenarios de email (éxito, fallo, config faltante) —
    los tests preexistentes de `api/leads.test.js` deben seguir pasando
    (ajustados únicamente en su fixture de cliente Supabase falso para
    incluir `fecha_creacion` en la respuesta simulada del `INSERT`, sin
    modificar su expectativa de respuesta HTTP — regresión).
12. El transporter del mailer define `connectionTimeout: 5000` y
    `socketTimeout: 5000` (o los valores documentados equivalentes si el
    `builder-agent` decide otro número, siempre que quede explícito y
    documentado en `docs/tecnica/notificacion-clinica-smtp-ferozo.md`) —
    verificable por inspección de código de `api/_lib/mailer.js`.
13. `package.json` incluye `nodemailer` como dependencia de producción y
    `package-lock.json` queda actualizado en consecuencia
    (`npm install nodemailer` reproducible con `npm ci`).
14. `docs/tecnica/arquitectura.md` incluye una sección nueva (sin
    reescribir las existentes) documentando la decisión de agregar
    `nodemailer` como dependencia npm.
15. Debe existir `docs/tecnica/notificacion-clinica-smtp-ferozo.md`, no
    vacío, con las decisiones de diseño/implementación relevantes:
    estructura de `api/_lib/mailer.js`, el cambio de
    `.select('id')` a `.select('id, fecha_creacion')` en el `INSERT` de
    `api/leads.js` y por qué (fuente única de verdad para
    `fecha_creacion`, en vez de generarla localmente en Node), por qué
    el envío se hace síncrono dentro del mismo request con timeout corto
    en vez de asíncrono/diferido, por qué no se reintenta, por qué no se
    notifica en la rama de duplicado, la mitigación de header injection
    en el `subject`, y el contenido exacto (campos) del HTML de
    notificación.
16. Debe existir `docs/usuario/notificacion-clinica-smtp-ferozo.md`, no
    vacío, con el propósito de la feature (que la clínica se entere por
    email de cada lead nuevo) explicado en lenguaje no técnico, dirigido
    a quien administra el sitio/la clínica, incluyendo qué hacer si un
    lead quedó con `notificacion_clinica_enviada = false` (verificar
    manualmente en el panel de Supabase, sin panel administrativo propio
    todavía — ver ítem `15` del roadmap).
17. Debe existir `runs/05-notificacion-clinica-smtp-ferozo/decision.md`,
    con las decisiones demostrables desde spec/auditoría/implementación
    (no vacío ni ornamental).
18. `docs/tecnica/index.md` debe contener exactamente el enlace
    `- [Notificación de nuevo lead a la clínica](notificacion-clinica-smtp-ferozo.md)`.
19. `docs/usuario/index.md` debe contener exactamente el enlace
    `- [Notificación de nuevo lead a la clínica](notificacion-clinica-smtp-ferozo.md)`.

Nota sobre el título exacto: se recomienda usar literalmente
`Notificación de nuevo lead a la clínica` en ambos índices (vía
`scripts/update-doc-indexes.ps1 05-notificacion-clinica-smtp-ferozo "Notificación de nuevo lead a la clínica"`),
consistente con el estilo breve ya usado en `docs/tecnica/index.md`.

## Casos borde a contemplar

- `telefono`, `servicio` y `mensaje` en `null` (caso normal, ya
  documentado por la feature `03`): el HTML debe mostrar el placeholder
  correspondiente ("No proporcionado" / "No especificado" / "Sin mensaje
  adicional"), nunca la palabra literal `null` ni una celda vacía sin
  contexto.
- `mensaje` con múltiples líneas (`\n`): deben renderizarse como saltos
  de línea (`<br>`) en el HTML **después** de aplicar `escapeHtml()`, no
  antes (si se reemplazara antes, el escape de `/` alteraría cualquier
  `<br>` ya insertado).
- `nombre` o `mensaje` conteniendo secuencias `\r`/`\n` en el `subject`
  del correo (inyección de headers SMTP / "header injection"): el
  `subject` debe sanearse eliminando o reemplazando saltos de línea antes
  de pasarlo a Nodemailer, independientemente de `escapeHtml()` (que no
  toca `\r`/`\n`) — riesgo de seguridad real en clientes SMTP mal
  configurados, mitigado explícitamente aquí (ver criterio de
  aceptación 4) aunque Nodemailer ya hace cierto saneamiento interno de
  headers.
- `SMTP_PORT` ausente o no numérico en el entorno: cae al default `465`
  (`Number(process.env.SMTP_PORT) || 465`), sin lanzar excepción.
- Variables SMTP parcialmente configuradas (ej. `SMTP_HOST` presente pero
  `SMTP_PASS` vacío): tratado igual que "config faltante" (criterio 8),
  nunca como un `500` del endpoint.
- Dos leads nuevos e independientes insertados en rápida sucesión (sin
  ser duplicados entre sí): cada uno dispara su propio `sendMail()`
  independiente — no hay agrupamiento ni batching de notificaciones en
  esta feature.
- El transporter cacheado a nivel de módulo (mismo patrón que
  `getSupabaseClient`) no debe reutilizar un transporter roto entre
  invocaciones si las credenciales cambiaron (ej. rotación de
  `SMTP_PASS` en Vercel entre despliegues) — como cada despliegue de
  Vercel arranca una instancia de proceso nueva, esto no es un problema
  práctico dentro de la vida de una misma instancia; se documenta como
  supuesto, no como caso a resolver activamente.
- Direcciones de `LEADS_NOTIFICATION_EMAIL` o `SMTP_FROM` mal
  configuradas (no son emails válidos): esta feature no valida su
  formato en tiempo de ejecución — Nodemailer/el servidor SMTP
  reportarán el error de forma indistinguible de cualquier otro fallo de
  envío (mismo camino del criterio 7).
- `fecha_creacion` devuelta por Supabase con un formato distinto al
  esperado (ej. si en algún entorno de test la columna llegara como
  `null` por un fixture mal armado): el `builder-agent` debe decidir un
  fallback razonable (ej. omitir la fecha o mostrar un placeholder) sin
  que eso rompa la construcción del HTML ni el envío del correo; no es
  un escenario esperado en producción (la columna tiene default `now()`
  no nulo), mencionado solo por completitud defensiva.

## Riesgos / supuestos

- **Decisión explícita sobre el origen de `fecha_creacion` (resuelve el
  punto 1 de `audit-1.md`):** se optó por cambiar la consulta del
  `INSERT` existente de `.select('id')` a
  `.select('id, fecha_creacion')`, en vez de generar el timestamp
  localmente en Node (`new Date().toISOString()`). Motivo: el valor que
  ve la clínica en el correo debe coincidir exactamente con el que queda
  persistido en la fila real de `leads` (generado por el default `now()`
  de Postgres), sin una segunda fuente de verdad que pudiera divergir
  por reloj del proceso o latencia de red hacia Supabase. El costo de
  esta decisión es mínimo: un campo adicional en un `.select()` que ya
  se ejecutaba, sin impacto de performance ni de esquema. El
  `reviewer-agent` puede objetar esta elección si prefiere la alternativa
  (timestamp local), pero debe hacerlo explícitamente — no queda como
  ambigüedad abierta en este intento.
- **No se implementa ningún reintento automático de envío SMTP fallido
  en esta feature.** Un lead con `notificacion_clinica_enviada = false`
  después de un fallo queda así hasta que alguien lo detecte/gestione
  manualmente vía el panel de Supabase (`estado` sigue siendo `nuevo`,
  visible igual). Se documenta como riesgo aceptado, consistente con que
  `ROADMAP.md` reserva explícitamente "detección de notificaciones
  fallidas" para el ítem `15-observabilidad-y-operacion`, posterior a
  esta feature. Si el volumen de fallos SMTP en producción resulta
  significativo, un mecanismo de reintento/cola es candidato a una
  decisión de arquitectura futura, no de esta spec.
- **El envío de email se hace de forma síncrona dentro del mismo request
  de `POST /api/leads`, acotado por `connectionTimeout`/`socketTimeout`
  de 5000 ms cada uno.** Se decidió así (en vez de "fire and forget" sin
  esperar la promesa) porque un entorno serverless no garantiza que el
  proceso siga vivo después de que la función devuelve la respuesta HTTP
  — un envío verdaderamente asíncrono/no esperado podría no completarse
  nunca. El costo aceptado es que el tiempo de respuesta de
  `POST /api/leads` crece por el tiempo real de envío SMTP (normalmente
  bajo 1 segundo, acotado a un máximo de ~5 segundos por los timeouts).
  Si en producción esto resulta un problema de UX perceptible, mover el
  envío a una cola/función separada es una decisión de arquitectura
  futura, no de esta feature.
- **`replyTo` con el email del lead sin validación adicional más allá de
  la ya aplicada en la feature `03`** (formato básico de email). Es una
  decisión de conveniencia operativa de este analyst-agent, no un
  requisito literal del pedido de la feature — el `reviewer-agent` puede
  objetarla si prefiere omitirla o si considera que expone al remitente
  a algún riesgo de abuso de "reply-to spoofing" (mitigado en la
  práctica porque el destinatario es la propia clínica, no un tercero;
  además, a diferencia de `nombre`, `EMAIL_PATTERN` ya excluye cualquier
  whitespace incluido `\r`/`\n`, por lo que `email` no representa el
  mismo riesgo de header injection que `nombre` en el `subject`).
- **La notificación no se envía para la rama de duplicado detectado**
  (feature `04`). Si el `reviewer-agent` o el negocio real prefirieran
  que la clínica también reciba una notificación (aunque sea distinta)
  cuando se detecta un posible duplicado, es una decisión que requeriría
  ajustar esta spec — se documenta como supuesto explícito, no como
  hecho consumado.
- **No se prueba contra un servidor SMTP real de Ferozo** en CI ni en
  este ciclo de feature: toda la cobertura automática usa un transporter
  Nodemailer inyectado/simulado. La verificación real de entregabilidad
  (que Ferozo efectivamente entregue el correo, que no caiga en spam,
  SPF/DKIM/DMARC) es explícitamente el ítem `12` del roadmap, posterior.
  Este riesgo ya estaba aceptado por el propio orden del roadmap, no es
  una decisión nueva de esta spec.
- **El `subject` del correo usa el nombre del lead sin `escapeHtml()`**
  (correcto, porque no es HTML — es un header de correo), pero sí
  saneado contra `\r`/`\n` (criterio 4, nuevo en este intento). Si el
  `builder-agent` decide en algún punto reutilizar ese mismo string
  interpolado dentro del `html` del cuerpo, debe aplicar `escapeHtml()`
  en ese contexto por separado — son sanitizaciones distintas para
  contextos distintos (header de email vs. HTML), documentado para
  evitar que se confundan.
- **El fixture de cliente Supabase falso en `api/leads.test.js` debe
  actualizarse** para que la simulación del `INSERT` (paso 12) devuelva
  también `fecha_creacion`, no solo `id`, dado el cambio de
  `.select('id')` a `.select('id, fecha_creacion')`. Esto es un ajuste
  de fixture de test, no un cambio de comportamiento del endpoint —
  documentado aquí para que no se pierda al implementar, ya que varios
  tests existentes de la feature `04` dependen de ese mismo fixture.
