# Spec: Confirmación automática al paciente por email

## Alcance

Extender `POST /api/leads` (`api/leads.js`) para que, en la misma rama
de `INSERT` nuevo exitoso donde hoy se dispara la notificación a la
clínica (feature `05-notificacion-clinica-smtp-ferozo`, ya mergeada), se
envíe **además** un segundo correo transaccional al propio paciente
(destinatario = `lead.email`, el email que la persona escribió en el
formulario), confirmando que su solicitud fue recibida. Si ese envío
tiene éxito, se actualiza `confirmacion_paciente_enviada = true` sobre
el lead recién insertado.

Incluye:

1. Nueva función `buildPatientConfirmationEmail(lead)` en el módulo ya
   existente `api/_lib/mailer.js` (mismo archivo que
   `buildClinicNotificationEmail`, mismo patrón de escape HTML vía
   `escapeHtml()` de `api/_lib/sanitize-html.js`). No se crea ningún
   módulo nuevo.
2. Integración en `api/leads.js`: tras un `INSERT` nuevo exitoso, además
   del intento de envío a la clínica ya existente, se intenta un envío
   independiente al paciente, con su propio manejo de éxito/fallo y su
   propia actualización de flag.
3. `UPDATE confirmacion_paciente_enviada = true` sobre el lead
   insertado, solo si ese envío específico fue exitoso — mismo patrón
   exacto que `notificacion_clinica_enviada` en la feature `05`.
4. Extensión de los tests existentes: `api/_lib/mailer.test.js` (nuevos
   tests unitarios de `buildPatientConfirmationEmail`) y
   `api/leads.test.js` (nueva sección "Feature 06", análoga a la sección
   "Feature 05" ya existente).

### Explícitamente NO incluye

- No se crea ninguna tabla ni columna nueva en Supabase: se reutiliza
  `confirmacion_paciente_enviada`, ya creada por la migración de la
  feature `02` (`supabase/migrations/20260819210130_create_leads_table.sql`,
  línea 29).
- No se agrega ninguna variable de entorno nueva a `.env.example` (ver
  "Diseño propuesto → destinatario" y "Riesgos / supuestos"): el
  destinatario es `lead.email`, no una casilla fija configurada por
  variable de entorno.
- No se agrega ninguna dependencia npm nueva: reutiliza `nodemailer`, ya
  incorporado y documentado en `docs/tecnica/arquitectura.md` por la
  feature `05`. No hace falta tocar `docs/tecnica/arquitectura.md` en
  esta feature.
- No se implementa ningún mecanismo de reintento automático (cola,
  backoff, reintento diferido, endpoint de reenvío manual) si el envío al
  paciente falla. Un solo intento por request, igual que la notificación
  a la clínica (mismo riesgo aceptado que la feature `05`, ítem `15
  -observabilidad-y-operacion` del roadmap es donde correspondería
  resolver esto de forma sistemática).
- No se modifican `index.html` ni `script.js`: el formulario sigue
  simulado (feature `08-conexion-formulario-frontend`, fuera de
  alcance).
- No se valida ni se prueba contra un servidor SMTP real de Ferozo (ni en
  CI ni localmente): toda la verificación automática usa un transporter
  Nodemailer simulado/inyectado, mismo patrón que la feature `05`.
- No se agrega contenido médico/clínico, de tratamientos, precios ni
  certificaciones al correo: el mensaje es puramente administrativo
  ("recibimos tu solicitud, todavía no está confirmada, te vamos a
  contactar").
- No se toca el flujo de notificación a la clínica más allá de
  reorganizar el bloque de envío para que ambos correos (clínica y
  paciente) se intenten de forma independiente dentro del mismo
  request — el contenido, destinatario y lógica de
  `buildClinicNotificationEmail`/`notificacion_clinica_enviada` no
  cambian.

## Contexto

El sitio es una landing estática de captación de leads para una clínica
dental (`AGENTS.md`). La feature `03` implementó `POST /api/leads`; la
`04` agregó protección antispam/abuso, incluyendo detección de
duplicados (mismo `email`+`nombre` dentro de una ventana de 5 minutos →
no se inserta un lead nuevo, se responde `201` con el `id` existente sin
ejecutar `INSERT`); la `05` (ya mergeada a `develop`) agregó el primer
envío de email real del proyecto: una notificación HTML a la clínica vía
Nodemailer/SMTP de Ferozo, con el módulo `api/_lib/mailer.js` y la
integración correspondiente en `api/leads.js`, incluyendo inyección de
dependencias (`mailerFactory`) para poder testear sin SMTP real.

Esta feature `06` es la contraparte dirigida al **paciente**: en vez de
avisarle a la clínica que llegó un contacto nuevo, se le confirma al
propio paciente que su mensaje fue recibido, dejando explícito que el
turno **todavía no está confirmado** (la clínica todavía tiene que
contactarlo para coordinar fecha/hora reales) y sin filtrar ningún dato
clínico. Reutiliza exactamente el mismo mecanismo de infraestructura
(mismo módulo `mailer.js`, mismo transporter cacheado, mismo patrón de
try/catch aislado, mismo patrón de flag booleano + `UPDATE`) que la
feature `05` ya estableció y que `reviewer-agent` ya validó una vez —
esta spec no reinventa esa mecánica, la extiende.

La columna `confirmacion_paciente_enviada boolean not null default
false` ya existe en la tabla `leads` desde la migración de la feature
`02`; no requiere ningún cambio de esquema.

## Diseño propuesto

### 1. `buildPatientConfirmationEmail(lead)` en `api/_lib/mailer.js`

Firma idéntica a `buildClinicNotificationEmail(lead)`: recibe el mismo
objeto `lead` que ya se arma hoy en `api/leads.js` tras el `INSERT`
(`{ id, nombre, email, telefono, servicio, mensaje, fecha_creacion }`,
sin agregar ningún campo nuevo a ese objeto), y devuelve
`{ to, from, replyTo, subject, html, text }`, listo para
`transporter.sendMail(...)`.

- **`to`**: `lead.email` — el propio email que la persona escribió en el
  formulario. Ya pasó `EMAIL_PATTERN` en `api/leads.js` antes de llegar
  acá (sin espacios, sin `\r`/`\n`), por lo que no representa riesgo de
  header injection ni requiere sanitización adicional.
- **`from`**: `process.env.SMTP_FROM` — el mismo remitente que ya usa la
  notificación a la clínica. No se introduce ningún remitente nuevo.
- **`replyTo`**: `process.env.LEADS_NOTIFICATION_EMAIL` (la misma
  casilla de la clínica que ya es obligatoria hoy para que
  `createTransporter()` no lance). Decisión explícita: si el paciente
  responde a este correo de confirmación, la respuesta debe llegar a la
  clínica (que es quien va a coordinar el turno), no quedar perdida
  respondiéndose a la propia casilla `SMTP_FROM` ni, mucho menos,
  reenviarse a sí mismo. Ver "Riesgos / supuestos".
- **`subject`**: fijo, sin interpolar ningún dato del lead — por ejemplo
  `"Recibimos tu solicitud — Sonríe más"`. Al no interpolar `nombre` ni
  ningún otro campo, no hace falta aplicar `sanitizeHeaderValue()` en
  este subject (a diferencia del subject de la clínica).
- **`html`**: debe incluir, como mínimo:
  1. Un saludo personalizado con `nombre` (pasado por `escapeHtml()`,
     mismo patrón que el resto del módulo).
  2. Confirmación de que la solicitud/mensaje fue recibido
     correctamente.
  3. **Aclaración explícita y prominente** (no un detalle al pie, sino
     una oración clara en el cuerpo principal) de que el turno
     **todavía NO está confirmado** y que la clínica se va a poner en
     contacto próximamente para coordinarlo. Este es un requisito
     literal del pedido original (ROADMAP), no una decisión del
     analista: el criterio de aceptación 6 exige verificar textualmente
     esta aclaración.
  4. Firma/branding de "Sonríe más", sin agregar ningún dato de contacto
     inventado (el teléfono que aparece hoy en `index.html`,
     `+123456789`, es un placeholder evidente, no un dato real
     provisto por el negocio — no se copia a este correo bajo ninguna
     circunstancia, ver "Riesgos / supuestos" y la regla de dominio de
     `AGENTS.md` sobre no inventar información del negocio real).
  - **NO debe incluir** `telefono`, `servicio` ni `mensaje` del lead
    (decisión explícita, ver "Riesgos / supuestos": interpretación
    conservadora de "no incluir información clínica sensible" del
    pedido original). Tampoco debe incluir ningún dato clínico,
    diagnóstico, de tratamiento, precio o certificación no provisto
    por el negocio real (regla dura de `AGENTS.md`).
- **`text`**: versión en texto plano equivalente al `html`, con el mismo
  mensaje de "recibido, todavía no confirmado, te contactamos" — mismo
  patrón que `buildClinicNotificationEmail`.

### 2. Integración en `api/leads.js`

Se ubica en el mismo bloque donde hoy vive el envío a la clínica (tras el
`INSERT` nuevo exitoso, nunca en la rama de duplicado detectado del paso
11/f04, que ya responde y retorna antes de llegar a este bloque):

1. `mailerFactory()` se sigue llamando **una sola vez** (mismo patrón
   actual, sin duplicar la creación del transporter). Si lanza (config
   SMTP faltante/inválida), se loguea una única vez y **ninguno** de los
   dos envíos (clínica ni paciente) se intenta — comportamiento ya
   establecido en la feature `05`, ahora extendido explícitamente para
   cubrir también el envío al paciente.
2. Si el transporter se creó, se intentan **dos envíos independientes**,
   cada uno con su propio `try/catch` acotado (nunca delegado al `catch`
   genérico de nivel superior del handler, misma regla dura que la
   feature `05`):
   - **Envío a la clínica** (sin cambios de contenido/destinatario
     respecto a la feature `05`): éxito → `UPDATE
     notificacion_clinica_enviada = true`; fallo → se loguea
     `err.message` y se salta ese `UPDATE`.
   - **Envío al paciente** (nuevo): `buildPatientConfirmationEmail(lead)`
     + `await transporter.sendMail(...)`. Éxito → `UPDATE
     confirmacion_paciente_enviada = true` sobre el mismo `data.id`;
     fallo → se loguea `err.message` (nunca el objeto de error completo
     ni credenciales) y se salta ese `UPDATE`.
   - **Independencia explícita**: un fallo en el envío a la clínica NO
     debe impedir el intento de envío al paciente, y un fallo en el
     envío al paciente NO debe afectar el resultado ya decidido del
     envío a la clínica. Cada uno tiene su propio flag, su propio log y
     su propio `UPDATE`.
3. `respond(201, { id: data.id })` — exactamente el mismo contrato de
   éxito preexistente, en **cualquier** combinación de resultados de
   ambos envíos (éxito/éxito, éxito/fallo, fallo/éxito, fallo/fallo,
   config SMTP faltante) y también si alguno de los dos `UPDATE` de flag
   falla.

**Orden de ejecución (secuencial, no paralelo):** se decide ejecutar
primero el intento de envío a la clínica y luego el intento de envío al
paciente, de forma secuencial (`await` uno después del otro), replicando
el estilo de código ya aprobado en la feature `05` con el menor diff
posible, en vez de paralelizar con `Promise.allSettled`. Esto es una
decisión explícita, no un olvido: ver "Riesgos / supuestos" para el
trade-off de latencia aceptado.

### 3. "Evitar reenvíos duplicados"

El pedido original dice literalmente "evitar reenvíos duplicados". Esta
spec decide que ese requisito **ya queda satisfecho por el diseño
existente, sin agregar ninguna lógica nueva de deduplicación**, por dos
razones combinadas:

1. La detección de duplicados de la feature `04` (paso 11) impide una
   segunda inserción para el mismo par `email`+`nombre` dentro de una
   ventana de 5 minutos, respondiendo `201` con el `id` existente **sin**
   ejecutar ningún `INSERT` ni entrar al bloque de envío de emails. Por lo
   tanto, un reenvío accidental del mismo formulario en ese lapso nunca
   llega a intentar un segundo `sendMail()` al paciente — mismo criterio
   ya aplicado y documentado para la notificación a la clínica.
2. Dentro de un mismo request de `INSERT` nuevo, `sendMail()` al paciente
   se invoca como máximo una vez (no hay ningún bucle, reintento
   inmediato ni cola en este endpoint). No existe hoy ningún flujo que
   reprocese un lead ya insertado (no hay endpoint de reenvío manual, no
   hay reintentos automáticos), por lo que no hay ningún escenario real
   en el código actual donde `confirmacion_paciente_enviada` pudiera
   dispararse dos veces para el mismo lead.

Por lo tanto, **no se agrega un chequeo de "¿`confirmacion_paciente_enviada`
ya es `true`?" antes de enviar**: sería código defensivo contra un
escenario que no puede ocurrir con la arquitectura actual, y agregaría
una lectura extra a Supabase sin beneficio verificable. Ver "Riesgos /
supuestos" para la limitación aceptada de esta decisión.

## Criterios de aceptación

1. `api/_lib/mailer.js` exporta una nueva función
   `buildPatientConfirmationEmail(lead)`, con la misma forma de entrada
   (`{ id, nombre, email, telefono, servicio, mensaje, fecha_creacion }`)
   que `buildClinicNotificationEmail(lead)`, sin requerir ningún campo
   adicional en el objeto `lead` que ya arma `api/leads.js`.
2. El objeto devuelto por `buildPatientConfirmationEmail(lead)` tiene
   `to === lead.email`.
3. `from === process.env.SMTP_FROM`.
4. `replyTo === process.env.LEADS_NOTIFICATION_EMAIL`.
5. `subject` es un string fijo, no vacío, que no interpola ningún dato
   del `lead` (verificable: el mismo `subject` se repite igual para dos
   leads con `nombre` distinto).
6. El `html` (y, de forma funcionalmente equivalente, el `text`) contiene
   una aclaración explícita, verificable por test, de que el turno
   todavía NO está confirmado y de que la clínica se comunicará
   posteriormente (test de contenido: el string debe incluir, en algún
   orden razonable, los conceptos "turno"/"cita" + negación de
   confirmación, y una mención a que la clínica se pondrá en contacto).
7. `nombre` aparece en el `html`, escapado mediante `escapeHtml()` de
   `api/_lib/sanitize-html.js` (mismo patrón que
   `buildClinicNotificationEmail`): un `nombre` con `<script>`, `&`, `"`
   o `'` no debe aparecer sin escapar en el HTML resultante.
8. Ni el `html` ni el `text` de `buildPatientConfirmationEmail` incluyen
   `telefono`, `servicio` ni `mensaje` del lead, verificable con un
   fixture donde esos tres campos tengan valores distintivos y ninguno
   de esos valores aparezca en el resultado.
9. Ningún contenido médico/clínico, de tratamiento, precio o
   certificación (inventado o no) aparece en el `html`/`text` — revisión
   manual del contenido literal contra la regla de dominio de
   `AGENTS.md`.
10. `createTransporter()` no cambia su firma ni sus variables de entorno
    requeridas (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`,
    `LEADS_NOTIFICATION_EMAIL`): no se agrega ninguna variable de entorno
    nueva a `.env.example` ni al código para esta feature.
11. En `api/leads.js`, tras un `INSERT` nuevo exitoso, se intenta un
    envío de confirmación al paciente además del envío existente a la
    clínica, ambos usando el mismo `transporter` obtenido de una única
    llamada a `mailerFactory()` (verificable: `mailerFactory` inyectado
    en tests se invoca exactamente una vez por request, no dos).
12. Si `mailerFactory()` lanza, ni el envío a la clínica ni el envío al
    paciente se intentan (`sendMail()` del mailer inyectado no se llama
    ninguna vez), y la respuesta sigue siendo `201` con `{ id }`.
13. Un fallo simulado en el envío a la clínica no impide que se intente
    el envío al paciente en el mismo request (y viceversa): verificable
    inyectando un mailer falso que falla selectivamente según el
    destinatario (`to`) del `mailOptions`.
14. Tras un envío exitoso al paciente, se ejecuta
    `UPDATE leads SET confirmacion_paciente_enviada = true WHERE id =
    <id del lead insertado>`, usando el mismo cliente Supabase ya
    obtenido en el request.
15. Un fallo en el envío al paciente (rechazo/excepción de `sendMail`) se
    loguea vía `console.error` con, como máximo, `err.message` (nunca el
    objeto de error completo, nunca ninguna variable de entorno SMTP), y
    se salta el `UPDATE` de `confirmacion_paciente_enviada` — el lead
    insertado y la respuesta HTTP no se ven afectados.
16. Un fallo en el `UPDATE` de `confirmacion_paciente_enviada` (después de
    un envío exitoso) se loguea pero no cambia la respuesta HTTP ya
    decidida (sigue siendo `201` con `{ id }`).
17. En la rama de duplicado detectado (paso 11/f04, sin `INSERT` nuevo),
    no se intenta ningún envío de email (ni a la clínica ni al
    paciente): `sendMail()` del mailer inyectado no se invoca en ese
    escenario.
18. El contrato de respuesta HTTP de éxito de `POST /api/leads` (`201` +
    body `{ id }` exclusivamente, sin `fecha_creacion` ni ningún otro
    campo) es idéntico, en los 5 escenarios relevantes de email (éxito
    ambos / fallo clínica-éxito paciente / éxito clínica-fallo paciente /
    fallo ambos / `mailerFactory` que lanza), al contrato ya establecido
    por las features `03`/`04`/`05`.
19. Dos leads insertados en requests independientes disparan dos
    confirmaciones al paciente independientes, cada una con `to` igual al
    `email` de su propio lead (no se mezclan destinatarios entre
    requests).
20. `api/_lib/mailer.test.js` incluye tests unitarios que cubren los
    criterios 2 a 9 de esta lista para `buildPatientConfirmationEmail`.
21. `api/leads.test.js` incluye una sección de tests (análoga a la
    sección "Feature 05" ya existente) que cubre los criterios 11 a 19
    de esta lista, usando exclusivamente mailers/clientes Supabase
    simulados/inyectados — ningún test depende de un servidor SMTP real
    ni de red real.
22. Debe existir `docs/tecnica/confirmacion-automatica-paciente.md`, no
    vacío, con las decisiones de diseño/implementación relevantes
    (incluyendo, como mínimo: la decisión de contenido del email sin
    `telefono`/`servicio`/`mensaje`, la decisión de `replyTo`, la
    decisión de "evitar reenvíos duplicados" sin lógica adicional, y la
    decisión de ejecución secuencial vs. paralela de ambos envíos).
23. Debe existir `docs/usuario/confirmacion-automatica-paciente.md`, no
    vacío, con el propósito de la feature y cómo verla/usarla (incluyendo
    qué ve el paciente en su bandeja de entrada y cómo el equipo de la
    clínica puede detectar manualmente, vía el panel de Supabase, un
    lead cuyo `confirmacion_paciente_enviada` haya quedado en `false`).
24. Debe existir `runs/06-confirmacion-automatica-paciente/decision.md`,
    no vacío, con decisiones demostrables desde spec/auditoría/
    implementación.
25. `docs/tecnica/index.md` debe incluir un enlace exacto a
    `confirmacion-automatica-paciente.md` (ej.
    `- [Confirmación automática al paciente](confirmacion-automatica-paciente.md)`,
    formato consistente con las entradas existentes).
26. `docs/usuario/index.md` debe incluir un enlace exacto equivalente a
    `confirmacion-automatica-paciente.md`.

## Casos borde a contemplar

- **`lead.email` con dominio inexistente o buzón lleno** (bounce): fuera
  del control del código; se trata igual que cualquier otro fallo de
  `sendMail()` (criterio 15) — no se reintenta, no se marca el flag.
- **`lead.email` coincide con `LEADS_NOTIFICATION_EMAIL`** (alguien usa la
  casilla de la propia clínica como email de contacto en el formulario):
  no debe romper nada; simplemente la clínica recibiría también la
  confirmación dirigida "al paciente" en su propia casilla — comportamiento
  aceptado, no se agrega ninguna validación especial para este caso.
- **`nombre` con Unicode/emoji** (ya cubierto en `api/leads.test.js` para
  la inserción): debe pasar igual por `escapeHtml()` sin romper la
  construcción del HTML, mismo patrón que `buildClinicNotificationEmail`.
- **`telefono`/`servicio`/`mensaje` con contenido malicioso
  (`<script>`, etc.)**: no aplica ningún riesgo porque esos campos
  directamente no se incluyen en el email al paciente (criterio 8), pero
  el fixture de test debe incluir valores con esos caracteres para
  confirmar que ninguno se filtra al resultado.
- **Ambos envíos (clínica y paciente) fallan en el mismo request**: el
  lead queda insertado con `notificacion_clinica_enviada = false` y
  `confirmacion_paciente_enviada = false`, la respuesta HTTP sigue siendo
  `201`; ambos casos quedan disponibles para revisión manual vía el panel
  de Supabase (mismo mecanismo ya documentado para la feature `05`).
- **Timeout SMTP en el envío a la clínica que consume el `socketTimeout`
  completo (5000 ms) antes de intentar el envío al paciente**: al ser
  secuencial, el tiempo de respuesta de `POST /api/leads` puede crecer
  hasta ~10 segundos en el peor caso (5s clínica + 5s paciente). Riesgo
  aceptado explícitamente, ver "Riesgos / supuestos".
- **`SMTP_PORT` no numérico o variables SMTP vacías (`''`)**: comportamiento
  ya cubierto por `createTransporter()` desde la feature `05`, sin
  cambios; afecta a ambos envíos por igual (criterio 12).
- **Dos requests concurrentes para el mismo `email`+`nombre` fuera de la
  ventana de 5 minutos de duplicados** (o con `nombre` levemente distinto
  que no matchea la detección de duplicados): cada uno es un `INSERT`
  legítimo distinto y dispara su propia confirmación — no es un "reenvío
  duplicado" en el sentido del pedido, es una solicitud nueva.
- **Longitud/formato de `nombre` con saltos de línea crudos** (`\r`/`\n`):
  como `nombre` no se interpola en el `subject` de este correo (a
  diferencia del correo a la clínica), no hace falta aplicar
  `sanitizeHeaderValue()` en `buildPatientConfirmationEmail`; sí se sigue
  aplicando `escapeHtml()` en el cuerpo HTML, que no elimina saltos de
  línea pero tampoco representa riesgo de header injection al no estar
  en un header.

## Riesgos / supuestos

- **Contenido sin `telefono`/`servicio`/`mensaje`**: el pedido dice "No
  deberá incluir información clínica sensible" sin especificar qué
  campos concretos califican como tales. Esta spec decide, de forma
  conservadora, excluir `telefono` (dato de contacto personal
  innecesario para una confirmación), `servicio` (podría reflejar
  intención de tratamiento) y, sobre todo, `mensaje` (campo de texto
  libre donde la persona pudo haber descrito síntomas, dolor u otra
  información de salud). El correo se limita a confirmar recepción y
  aclarar que el turno no está confirmado. Si el reviewer o el negocio
  real prefieren que el correo sí incluya, por ejemplo, el `servicio`
  solicitado (como confirmación de "qué" se pidió, sin ser dato clínico
  per se), es una corrección menor y localizada a
  `buildPatientConfirmationEmail` — no afecta el resto del diseño.
- **`replyTo` apunta a `LEADS_NOTIFICATION_EMAIL`, no a `SMTP_FROM` ni a
  ningún valor vacío**: decisión tomada porque, si el paciente responde
  "gracias" o agrega información a este correo, esa respuesta debe llegar
  a un humano de la clínica que pueda leerla, no perderse en una casilla
  de envío automatizado (`SMTP_FROM`) que puede no revisarse activamente.
  No se introduce ninguna variable de entorno nueva para esto: se
  reutiliza `LEADS_NOTIFICATION_EMAIL`, ya obligatoria hoy.
- **Sin variable de entorno nueva para el destinatario del paciente**: a
  diferencia de la notificación a la clínica (que necesita una casilla
  fija, `LEADS_NOTIFICATION_EMAIL`), el destinatario de esta feature es
  inherentemente dinámico (`lead.email`), por lo que no aplica el mismo
  patrón de variable de entorno. Se documenta explícitamente para que
  quede claro que no es un olvido.
- **"Evitar reenvíos duplicados" resuelto sin lógica nueva**: como se
  explica en "Diseño propuesto → 3", se decide que la combinación
  existente (detección de duplicados de la feature `04` + un único
  intento de envío por `INSERT`) ya cumple el requisito literal del
  pedido, sin agregar una verificación adicional de
  `confirmacion_paciente_enviada` antes de enviar. Limitación aceptada:
  si en el futuro se agrega algún mecanismo de reintento/reprocesamiento
  de leads ya insertados (fuera del alcance actual de este endpoint), esa
  futura feature deberá agregar explícitamente ese chequeo — no está
  cubierto por el diseño actual y quedaría, en ese hipotético escenario,
  fuera de esta spec.
- **Ejecución secuencial, no paralela, de ambos envíos**: se prioriza el
  menor diff posible sobre el patrón ya aprobado por `reviewer-agent` en
  la feature `05` (loguear la ausencia del riesgo de time-outs
  simultáneos) por sobre la optimización de latencia. El costo aceptado
  es que el tiempo de respuesta de `POST /api/leads` puede crecer hasta
  el doble del peor caso ya aceptado en la feature `05` (de ~5s a ~10s en
  el peor escenario de dos timeouts SMTP consecutivos). Si esto resulta
  problemático en producción, es una optimización a evaluar en el ítem
  `15-observabilidad-y-operacion` del roadmap, no una corrección
  requerida de esta feature.
- **No se copia el teléfono placeholder (`+123456789`) de `index.html` al
  correo**: ese valor es evidentemente un dato de ejemplo, no información
  real provista por el negocio (regla dura de `AGENTS.md`: no inventar
  información no provista). El correo de confirmación no incluye ningún
  dato de contacto adicional de la clínica más allá de la aclaración de
  que "la clínica se va a comunicar" — no se inventa un teléfono, horario
  de atención ni dirección.
- **No se valida el dominio/existencia real de `lead.email`** más allá de
  lo que ya hace `EMAIL_PATTERN` en `api/leads.js` (sin cambios en esta
  feature): un email con formato válido pero inexistente generará un
  fallo de `sendMail()` (bounce o rechazo), tratado igual que cualquier
  otro fallo de envío (criterio 15) — no se agrega verificación de
  entregabilidad (MX record, doble opt-in, etc.), fuera de alcance.
