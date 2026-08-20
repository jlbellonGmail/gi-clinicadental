# Confirmación automática al paciente por email — documentación técnica

Extiende `api/leads.js` y `api/_lib/mailer.js` (features `03`, `04` y
`05`, ya mergeadas) para que, en el mismo bloque donde ya se envía la
notificación a la clínica, se envíe **además** un segundo correo
transaccional al propio paciente confirmando que su solicitud fue
recibida. Spec completo: `runs/06-confirmacion-automatica-paciente/spec.md`
(26 criterios de aceptación, aprobado en `audit-1.md` en el primer
intento, con tres observaciones no bloqueantes incorporadas más abajo).

## `buildPatientConfirmationEmail(lead)` en `api/_lib/mailer.js`

Firma de entrada idéntica a `buildClinicNotificationEmail(lead)`: recibe
el mismo objeto `lead` (`{ id, nombre, email, telefono, servicio,
mensaje, fecha_creacion }`) que ya arma `api/leads.js` tras el `INSERT`,
sin agregar ningún campo nuevo. Devuelve `{ to, from, replyTo, subject,
html, text }`.

- **`to`**: `lead.email` — el propio email que la persona escribió en el
  formulario, ya validado por `EMAIL_PATTERN` en `api/leads.js` antes de
  llegar acá (sin espacios, sin `\r`/`\n`).
- **`from`**: `process.env.SMTP_FROM` — el mismo remitente que ya usa la
  notificación a la clínica. No se introduce ningún remitente nuevo.
- **`replyTo`**: `process.env.LEADS_NOTIFICATION_EMAIL`. Decisión
  explícita: si el paciente responde a este correo de confirmación
  ("gracias", una aclaración, una pregunta), esa respuesta debe llegar a
  un humano de la clínica que pueda coordinarla, no perderse en la
  casilla de envío automatizado `SMTP_FROM` (que puede no revisarse
  activamente) ni reenviarse a sí mismo. No se agrega ninguna variable de
  entorno nueva: se reutiliza `LEADS_NOTIFICATION_EMAIL`, ya obligatoria
  desde la feature `05`.
- **`subject`**: string fijo, sin interpolar ningún dato del lead (ej.
  `"Recibimos tu solicitud — Sonríe más"`). Al no interpolar `nombre` ni
  ningún otro campo, **no** hace falta aplicar `sanitizeHeaderValue()` en
  este subject, a diferencia del correo a la clínica.
- **`html`/`text`**: saludo con `nombre` (pasado por `escapeHtml()` en el
  `html`, mismo patrón que `buildClinicNotificationEmail`), confirmación
  de que la solicitud fue recibida, una aclaración **explícita y
  prominente en el cuerpo principal** (no un detalle al pie) de que el
  turno **todavía NO está confirmado** y de que la clínica se va a
  comunicar próximamente, y firma de "Sonríe más". **No** incluye
  `telefono`, `servicio` ni `mensaje` del lead, ni ningún dato de
  contacto inventado (ver "Exclusión de campos" y "Sin datos de contacto
  inventados" más abajo).

### Exclusión de `telefono`/`servicio`/`mensaje`: dos razones distintas, no una sola categoría

El pedido original dice "no incluir información clínica sensible" sin
precisar qué campos califican. El spec excluye los tres campos, pero por
**dos motivos distintos** (observación no bloqueante de `audit-1.md`,
incorporada explícitamente acá en vez de fusionarla bajo una sola
etiqueta):

- **Dato clínico sensible**: `mensaje` (texto libre donde la persona
  pudo haber descrito síntomas, dolor u otra información de salud) y
  `servicio` (puede reflejar intención de tratamiento). Estos dos encajan
  claramente en la categoría de "información clínica sensible" que
  menciona el pedido original.
- **Dato personal innecesario**: `telefono` no es, en rigor, un dato
  clínico — es un dato de contacto personal que simplemente no aporta
  nada a una confirmación de recepción ("recibimos tu solicitud, el
  turno todavía no está confirmado"). Se excluye por minimización de
  datos en el correo, no porque sea sensible en el sentido clínico.

El resultado (excluir los tres campos) es el mismo, pero la
justificación por campo es distinta y queda documentada así para que una
futura revisión (por ejemplo, si el negocio real pide incluir `servicio`
como confirmación de "qué" se pidió) sepa exactamente qué categoría
está reconsiderando.

### Sin datos de contacto inventados

El correo no copia el teléfono placeholder `+123456789` de `index.html`
(evidentemente un dato de ejemplo de plantilla, no información real
provista por el negocio) ni ningún otro dato de contacto adicional de la
clínica. La única referencia a "contacto" en el correo es la aclaración
de que "la clínica se va a comunicar" — sin inventar un teléfono, horario
de atención ni dirección (regla dura de `AGENTS.md`: no inventar
información no provista por el negocio real).

### Menor superficie de header injection que el correo a la clínica

Observación no bloqueante de `audit-1.md`, documentada acá como fortaleza
de diseño: ni `to` (`lead.email`, ya validado por `EMAIL_PATTERN`, que
excluye espacios y `\r`/`\n`) ni `replyTo` (`LEADS_NOTIFICATION_EMAIL`,
variable de entorno, no input de usuario) representan superficie de
header injection en este correo. A diferencia del correo a la clínica —
que sí necesita `sanitizeHeaderValue()` sobre `nombre` interpolado en el
`subject` — este correo tiene un `subject` fijo sin interpolación
alguna, por lo que no hay ningún valor derivado de input de usuario en
ningún header del mensaje.

## Integración en `api/leads.js`

Se ubica en el mismo bloque donde ya vive el envío a la clínica (tras el
`INSERT` nuevo exitoso, nunca en la rama de duplicado detectado del paso
11/f04):

1. `mailerFactory()` se sigue llamando **una sola vez** por request
   (mismo patrón que la feature `05`, ahora compartido explícitamente
   por ambos envíos). Si lanza, ni el envío a la clínica ni el envío al
   paciente se intentan.
2. Si el transporter se creó, se ejecutan **dos envíos independientes,
   en orden secuencial** (clínica primero, paciente después — `await`
   uno después del otro, sin `Promise.allSettled`), cada uno con su
   propio `try/catch` acotado (nunca delegado al `catch` genérico de
   nivel superior del handler):
   - **Clínica** (sin cambios respecto a la feature `05`): éxito →
     `UPDATE notificacion_clinica_enviada = true`; fallo → se loguea
     `err.message` y se salta ese `UPDATE`.
   - **Paciente** (nuevo): `buildPatientConfirmationEmail(lead)` +
     `await transporter.sendMail(...)`. Éxito → `UPDATE
     confirmacion_paciente_enviada = true` sobre el mismo `data.id`;
     fallo → se loguea `err.message` (nunca el objeto de error completo
     ni credenciales) y se salta ese `UPDATE`.
   - **Independencia explícita**: un fallo en el envío a la clínica no
     impide el intento de envío al paciente, y viceversa. Cada uno tiene
     su propio flag, su propio log y su propio `UPDATE`.
3. `respond(201, { id: data.id })` — el mismo contrato de éxito
   preexistente, en cualquier combinación de resultados de ambos envíos
   (éxito/éxito, éxito/fallo, fallo/éxito, fallo/fallo, config SMTP
   faltante) y también si alguno de los dos `UPDATE` de flag falla.

### Por qué secuencial, no paralelo

Decisión explícita (no un olvido): se prioriza el menor diff posible
sobre el patrón ya aprobado por `reviewer-agent` en la feature `05`
(loguear, secuencial, `try/catch` acotado por paso) por sobre la
optimización de latencia con `Promise.allSettled`. El costo aceptado es
que el tiempo de respuesta de `POST /api/leads` puede crecer hasta ~10
segundos en el peor caso (dos timeouts SMTP consecutivos de 5s cada
uno, `connectionTimeout`/`socketTimeout` ya definidos desde la feature
`05`). Si esto resulta problemático en producción, es una optimización a
evaluar en el ítem `15-observabilidad-y-operacion` del roadmap, no una
corrección de esta feature.

## "Evitar reenvíos duplicados": resuelto sin lógica nueva

El pedido original dice literalmente "evitar reenvíos duplicados". Se
decide que ese requisito ya queda satisfecho por el diseño existente, sin
agregar ninguna lógica nueva de deduplicación, por dos razones
combinadas:

1. La detección de duplicados de la feature `04` (paso 11) impide una
   segunda inserción para el mismo par `email`+`nombre` dentro de una
   ventana de 5 minutos, respondiendo `201` con el `id` existente **sin**
   ejecutar `INSERT` ni entrar al bloque de envío de emails. Un reenvío
   accidental del mismo formulario en ese lapso nunca llega a intentar un
   segundo `sendMail()` al paciente.
2. Dentro de un mismo request de `INSERT` nuevo, `sendMail()` al paciente
   se invoca como máximo una vez (no hay bucle, reintento inmediato ni
   cola). No existe hoy ningún flujo que reprocese un lead ya insertado.

Por lo tanto, no se agrega un chequeo de "¿`confirmacion_paciente_enviada`
ya es `true`?" antes de enviar: sería código defensivo contra un
escenario que no puede ocurrir con la arquitectura actual.

### Limitación aceptada: condición de carrera (TOCTOU) heredada de la feature 04

Observación no bloqueante de `audit-1.md`, incorporada acá explícitamente
en vez de dejar que "evitar reenvíos duplicados" suene como una garantía
sin matices: la detección de duplicados de la feature `04` tiene una
condición de carrera TOCTOU ya documentada y aceptada en
`docs/tecnica/proteccion-antispam-y-abuso.md`. Dos requests casi
simultáneos con el mismo `email`+`nombre` pueden ambos pasar el `SELECT`
de duplicados antes de que cualquiera complete el `INSERT`, resultando en
dos leads distintos y, por lo tanto, dos confirmaciones independientes al
mismo paciente. Esto no es una omisión nueva de esta feature: es el mismo
riesgo aceptado desde la feature `04` que ya afecta simétricamente a la
notificación de la clínica desde la feature `05` (sin que esa spec, ya
aprobada, lo repitiera). Si en el futuro se agrega algún mecanismo de
mitigación de esa condición de carrera (por ejemplo, una restricción
`UNIQUE` a nivel de base de datos con ventana temporal), ese cambio
beneficiaría simétricamente a ambos correos (clínica y paciente) sin
requerir tocar esta feature.

## Testing

- `api/_lib/mailer.test.js`: nuevos tests unitarios de
  `buildPatientConfirmationEmail()` — `to`/`from`/`replyTo` correctos;
  `subject` fijo, no vacío, idéntico para dos leads con `nombre`
  distinto; aclaración explícita de turno no confirmado presente en
  `html` y `text`; `nombre` escapado vía `escapeHtml()` (un `nombre` con
  `<script>`, `&`, `"` o `'` no aparece sin escapar); ausencia de
  `telefono`/`servicio`/`mensaje` en el resultado, verificada con un
  fixture de valores distintivos; ausencia del teléfono placeholder de
  `index.html`; versión en texto plano equivalente.
- `api/leads.test.js` (sección "Feature 06", análoga a la sección
  "Feature 05" existente): `mailerFactory` inyectado se invoca
  exactamente una vez por request; si lanza, ningún `sendMail()` se
  invoca (ni clínica ni paciente); un mailer que falla selectivamente
  según el `to` (`makeSelectiveFailMailer`, nuevo helper de test) prueba
  la independencia entre ambos envíos en las dos direcciones; `UPDATE
  confirmacion_paciente_enviada = true` tras envío exitoso al paciente;
  fallo del envío al paciente logueado solo con `err.message`, sin
  `UPDATE`; fallo del `UPDATE` del flag no cambia el `201`; rama de
  duplicado no dispara ningún envío; contrato `201 { id }` estable en las
  5 combinaciones de resultados de email; dos leads independientes
  disparan confirmaciones independientes con `to` propio.
- Los tests preexistentes de la sección "Feature 05" se actualizaron
  (sin cambiar su intención original) para reflejar que, desde esta
  feature, el mismo `mailer` inyectado recibe **dos** `sendMail()` por
  request exitoso (clínica primero, paciente después) en vez de uno
  solo — cambio de infraestructura compartida, no de comportamiento de
  la feature `05` en sí.

## Qué NO cambia / NO incluye esta feature

- No se crea ninguna tabla ni columna nueva: se reutiliza
  `confirmacion_paciente_enviada`, ya creada por la migración de la
  feature `02`.
- No se agrega ninguna variable de entorno nueva: el destinatario
  (`lead.email`) es inherentemente dinámico, a diferencia de la casilla
  fija de la clínica.
- No se agrega ninguna dependencia npm nueva (reutiliza `nodemailer`).
- No se implementa ningún mecanismo de reintento automático.
- No se modifican `index.html` ni `script.js` (el formulario sigue
  simulado, feature `08`).
- No se valida ni se prueba contra un servidor SMTP real de Ferozo.
- No se agrega contenido médico/clínico, de tratamientos, precios ni
  certificaciones al correo.
