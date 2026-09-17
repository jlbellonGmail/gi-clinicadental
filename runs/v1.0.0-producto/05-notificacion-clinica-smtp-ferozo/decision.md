# Decisiones — 05-notificacion-clinica-smtp-ferozo

Registro de decisiones demostrables tomadas durante la implementación,
en relación con `spec.md` (aprobado en `audit-2.md`, attempt 2, tras
`audit-1.md` rechazado por ambigüedad en el origen de `fecha_creacion` y
falta de criterio explícito de header injection).

## 1. Origen de `fecha_creacion` e `id` en el email: fila real del `INSERT`, no timestamp local

El spec ya resolvía explícitamente esta ambigüedad (sección "Diseño
propuesto → 1" y "Riesgos / supuestos"), y la implementación la sigue
tal cual: `api/leads.js` cambia `.select('id').single()` por
`.select('id, fecha_creacion').single()` en el `INSERT` existente (paso
12), y el objeto `lead` pasado a `buildClinicNotificationEmail()` usa
`data.id`/`data.fecha_creacion` (la fila real devuelta por Supabase), no
`new Date().toISOString()` generado en Node. Verificable en
`api/leads.js` (comentario explícito sobre el criterio 1/f05 en el
bloque del `INSERT`) y en el test
`'INSERT nuevo exitoso invoca sendMail() ... y usa .select("id, fecha_creacion")'`
de `api/leads.test.js`, que inspecciona `supabaseClient.insertSelectCalls[0]`.

## 2. Estructura de `api/_lib/mailer.js`: dos funciones, mismo patrón que los módulos `_lib/` existentes

`createTransporter()` (cacheado a nivel de módulo, igual que
`getSupabaseClient()`) y `buildClinicNotificationEmail(lead)` (pura, sin
efectos secundarios, consume `escapeHtml()` de `api/_lib/sanitize-html.js`
tal como esa feature ya lo dejaba previsto). Se agregó una tercera
función interna no exportada, `formatFechaCreacion()`, para resolver de
forma defensiva el caso borde "fecha_creacion con formato inesperado"
mencionado en el spec (placeholder `"Fecha no disponible"` en vez de
lanzar), y `sanitizeHeaderValue()` para el saneamiento de `\r`/`\n` del
`subject` (criterio 4). ningún nombre de función cambia el contrato de
comportamiento descrito por el spec.

## 3. Inyección de dependencias: `mailerFactory` en `createHandler(options)`, mismo patrón que `supabaseClientFactory`

`api/leads.js` gana la opción `mailerFactory` (default: `createTransporter`
de `api/_lib/mailer.js`). Los tests inyectan un mailer falso
(`makeFakeMailer()` en `api/leads.test.js`, con `sentMails` para
inspeccionar cada `mailOptions`), sin red real. Se incorporó por defecto
en el helper de test `newHandler()` (un mailer falso que resuelve
exitosamente), de forma que **todos** los tests preexistentes de las
features `03`/`04` ejerciten también el camino feliz de notificación sin
necesitar cambios individuales — decisión de implementación de testing,
no de comportamiento del endpoint (el contrato HTTP no cambia para
ningún test existente).

## 4. La lógica de email queda en `try/catch` explícitos y acotados, nunca delegada al `catch` genérico del handler

Implementado exactamente como exige la "Regla dura verificada por test"
del spec: tres puntos de riesgo (`mailerFactory()`, `transporter.sendMail()`,
el `UPDATE` del flag) tienen cada uno su propio `try/catch` que nunca
relanza la excepción hacia el `catch` genérico de nivel superior de
`leadsHandler`. Verificado por los tests
`'sendMail() rechaza -> igual responde 201...'`,
`'mailerFactory lanza (config SMTP faltante/invalida) -> igual responde 201...'`
y `'UPDATE del flag falla -> igual responde 201...'` de `api/leads.test.js`,
que además confirman `supabaseClient.calls.length === 1` (sin reinserción)
en los tres escenarios.

## 5. Logging de fallos de email: solo `err.message`, nunca el objeto de error completo ni el de configuración

Decisión de implementación, no explícita palabra por palabra en el spec
pero exigida por el criterio 10 ("ningún log... contiene el valor de
`SMTP_PASS`, `SMTP_USER` ni el objeto de configuración completo del
transporter"). Se logueó consistentemente `err.message` (nunca `err`
completo ni `mailOptions`/config), tanto para el fallo de `mailerFactory()`
como para el rechazo de `sendMail()` como para el fallo del `UPDATE`.
Verificado con un test que simula un error de `sendMail()` con
propiedades adicionales (`.response`, `.command`) conteniendo texto
similar a credenciales, y confirma que `console.error` nunca las expone
(`api/leads.test.js`, `'fallo de sendMail() no filtra credenciales SMTP...'`).

## 6. `mailer.js` no valida contra un servidor SMTP real; los tests de `createTransporter()` sí ejercitan la construcción real del transporter

`nodemailer.createTransport()` no abre conexión de red por sí solo (solo
arma el objeto transporter; la conexión ocurre recién en `sendMail()`/
`verify()`). Se aprovechó esto para que `api/_lib/mailer.test.js` invoque
la función real `createTransporter()` (no un mock del módulo `nodemailer`)
y verifique directamente `transporter.options.{host,port,secure,auth,
connectionTimeout,socketTimeout}`, sin necesitar red real ni mocks
adicionales — más fiel al comportamiento real que un mock manual del
paquete `nodemailer` hubiera sido.

## 7. Consistencia con `AGENTS.md`: `nodemailer` documentado como decisión de arquitectura explícita

`docs/tecnica/arquitectura.md` gana una sección nueva ("Decisión: segunda
dependencia npm real (`nodemailer`)"), sin reescribir las secciones
existentes, cumpliendo el criterio 14 del spec y la regla dura de
`AGENTS.md` ("Reglas de dominio": ninguna dependencia se incorpora sin
esa decisión explícita).

## 8. Ninguna suposición grande sin resolver

El spec llegó aprobado sin objeciones bloqueantes en `audit-2.md`. La
implementación no encontró ninguna ambigüedad adicional que ameritara
volver a la etapa 1: los 19 criterios de aceptación son verificables
literalmente, y así se verificaron uno por uno en
`api/_lib/mailer.test.js` y en la sección "Feature 05" de
`api/leads.test.js` (141 tests en total en `npm test`, 0 fallos tras la
implementación completa).

## Nota operativa (no ambigüedad de spec, solo de proceso del circuito)

Al momento de arrancar esta etapa, `runs/05-notificacion-clinica-smtp-ferozo/`
(con `spec.md`, `audit-1.md`, `audit-2.md`) existía únicamente como
directorio **no commiteado** (`??`, untracked) en el checkout principal
del repo (`develop`), no en el historial de `develop` en sí. El worktree
de esta feature se creó desde `develop` (commit `dd126d1`), por lo que
esos tres archivos no llegaron automáticamente al nuevo worktree; se
copiaron manualmente antes de escribir este `decision.md`, para que
queden versionados junto con el resto de la feature en la rama
`feature/05-notificacion-clinica-smtp-ferozo`. No implica ningún cambio
de contenido de spec/auditoría respecto a lo aprobado.
