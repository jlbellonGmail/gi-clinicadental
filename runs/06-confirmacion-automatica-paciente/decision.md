# Decisiones — 06-confirmacion-automatica-paciente

Registro de decisiones demostrables tomadas durante la implementación, en
relación con `spec.md` (aprobado en `audit-1.md`, attempt 1, con tres
observaciones no bloqueantes incorporadas explícitamente en esta
implementación, ver secciones 1 a 3 más abajo).

## 1. Nota no bloqueante del reviewer: condición de carrera TOCTOU documentada explícitamente

`audit-1.md` observó que "evitar reenvíos duplicados" no debía sonar
como una garantía completa sin matices, dado que la condición de carrera
(TOCTOU) ya aceptada desde la feature `04` (dos requests casi simultáneos
con el mismo `email`+`nombre` pueden ambos pasar el `SELECT` de
duplicados antes de que cualquiera complete el `INSERT`) puede producir
dos leads y, por lo tanto, dos confirmaciones al paciente. Incorporado
literalmente en `docs/tecnica/confirmacion-automatica-paciente.md`,
sección "Limitación aceptada: condición de carrera (TOCTOU) heredada de
la feature 04", con referencia cruzada a
`docs/tecnica/proteccion-antispam-y-abuso.md`. No se agregó ninguna
mitigación nueva (fuera de alcance de esta feature, mismo riesgo ya
aceptado simétricamente por la notificación a la clínica desde la
feature `05`).

## 2. Nota no bloqueante del reviewer: exclusión de `telefono` distinguida de `servicio`/`mensaje`

`audit-1.md` señaló que el propio spec describe `telefono` como "dato de
contacto personal innecesario", una razón distinta de "dato clínico
sensible" (la categoría real de `servicio`/`mensaje`), pero el spec las
agrupaba bajo una sola decisión. Incorporado explícitamente en
`docs/tecnica/confirmacion-automatica-paciente.md`, sección "Exclusión de
`telefono`/`servicio`/`mensaje`: dos razones distintas, no una sola
categoría": se documentan las dos categorías por separado
(dato clínico sensible vs. dato personal innecesario) en vez de
fusionarlas. El resultado de la implementación no cambia (los tres
campos siguen excluidos de `buildPatientConfirmationEmail()`), solo la
justificación documentada.

## 3. Nota no bloqueante del reviewer: menor superficie de header injection, documentada como fortaleza

`audit-1.md` sugirió dejar registrado explícitamente que ni `to`
(`lead.email`, validado por `EMAIL_PATTERN`) ni `replyTo`
(`LEADS_NOTIFICATION_EMAIL`, variable de entorno) representan superficie
de header injection en este correo, a diferencia del correo a la clínica
que sí necesita `sanitizeHeaderValue()` sobre `nombre` en el `subject`.
Incorporado en `docs/tecnica/confirmacion-automatica-paciente.md`,
sección "Menor superficie de header injection que el correo a la
clínica". Implementación: `buildPatientConfirmationEmail()` no llama a
`sanitizeHeaderValue()` en ningún punto (`subject` es un string literal
fijo, sin interpolación), cubierto por el test
`'buildPatientConfirmationEmail(): subject fijo, no vacio, sin interpolar
el nombre del lead (criterio 5)'` de `api/_lib/mailer.test.js`.

## 4. `buildPatientConfirmationEmail(lead)` en `api/_lib/mailer.js`, mismo patrón que `buildClinicNotificationEmail`

Función nueva exportada desde el módulo ya existente (ningún módulo
nuevo). Firma de entrada idéntica (`{ id, nombre, email, telefono,
servicio, mensaje, fecha_creacion }`), retorno `{ to, from, replyTo,
subject, html, text }`. `to = lead.email`, `from = process.env.SMTP_FROM`,
`replyTo = process.env.LEADS_NOTIFICATION_EMAIL`, `subject` fijo (sin
`sanitizeHeaderValue()`, ver punto 3), `nombre` escapado vía
`escapeHtml()` en el `html`. `telefono`/`servicio`/`mensaje` del lead no
se leen en ningún punto de la función (ni siquiera para descartarlos
explícitamente: simplemente no forman parte del texto construido).

## 5. Integración en `api/leads.js`: un único `mailerFactory()`, dos envíos secuenciales con `try/catch` independientes

El bloque existente de la feature `05` (tras el `INSERT` nuevo exitoso)
se reorganizó para ejecutar, en este orden: (a) `mailerFactory()` una
sola vez, (b) envío a la clínica con su `try/catch` y su `UPDATE`
condicional de `notificacion_clinica_enviada`, (c) envío al paciente con
su propio `try/catch` y su propio `UPDATE` condicional de
`confirmacion_paciente_enviada`. Ningún paso relanza la excepción hacia
el `catch` genérico de nivel superior de `leadsHandler`. Verificado por
los tests de la sección "Feature 06" de `api/leads.test.js`:
`'fallo en el envio a la clinica no impide el intento de envio al
paciente (independencia)'` y `'fallo en el envio al paciente no afecta
el resultado ya decidido del envio a la clinica (independencia)'`, cada
uno con un mailer que falla selectivamente según `mailOptions.to`
(`makeSelectiveFailMailer`, nuevo helper de test).

## 6. Orden secuencial confirmado: clínica primero, paciente después

Implementado exactamente como decide el spec (sección "Diseño propuesto
→ 2", "Orden de ejecución"): sin `Promise.allSettled`, un `await` después
del otro. Verificado indirectamente por los tests que inspeccionan
`mailer.sentMails[0]`/`mailer.sentMails[1]` en ese orden (por ejemplo,
`'INSERT nuevo exitoso invoca sendMail() con to/from/replyTo correctos...'`,
actualizado en esta feature para reflejar que ahora hay dos envíos por
request en vez de uno).

## 7. Regresión de la sección "Feature 05": mismos tests, ajustados a dos envíos por request

Como ambos correos comparten el mismo `mailer` inyectado (mismo
`mailerFactory`, criterio 11 del spec), varios tests preexistentes de la
sección "Feature 05" de `api/leads.test.js` que contaban
`mailer.sentMails.length` o indexaban `supabaseClient.updateCalls[0]`
necesitaron ajustarse (longitud `1` → `2`, o filtrar/buscar el elemento
correspondiente a la clínica) para seguir siendo correctos con el nuevo
comportamiento compartido. La intención original de cada test (qué
verifica sobre el envío a la clínica) no cambió; solo se actualizó la
forma de acceder al dato dentro de un array que ahora tiene un elemento
más. Confirmado con `npm test`: 158 tests, 0 fallos, incluyendo toda la
regresión de las features `03`/`04`/`05`.

## 8. Ninguna suposición grande sin resolver

El spec llegó aprobado sin objeciones bloqueantes en `audit-1.md` (solo
tres notas no bloqueantes, incorporadas en las secciones 1 a 3 de este
documento). La implementación no encontró ninguna ambigüedad adicional
que ameritara volver a la etapa 1: los 26 criterios de aceptación son
verificables literalmente y así se verificaron, uno por uno, en
`api/_lib/mailer.test.js` (nuevos tests de
`buildPatientConfirmationEmail`, criterios 2 a 9) y en la sección
"Feature 06" de `api/leads.test.js` (criterios 11 a 19).

## Nota operativa (no ambigüedad de spec, solo de proceso del circuito)

Al momento de arrancar esta etapa, `runs/06-confirmacion-automatica-paciente/`
(con `spec.md`, `audit-1.md`) existía únicamente como directorio **no
commiteado** (`??`, untracked) en el checkout principal del repo
(`develop`), no en el historial de `develop` en sí. El worktree de esta
feature se creó desde `develop` (commit `dd126d1`), por lo que esos dos
archivos no llegaron automáticamente al nuevo worktree; se copiaron
manualmente antes de escribir este `decision.md`, mismo patrón operativo
ya aplicado en la feature `05`. No implica ningún cambio de contenido de
spec/auditoría respecto a lo aprobado.
