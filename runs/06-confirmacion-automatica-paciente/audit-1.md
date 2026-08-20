---
status: approved
attempt: 1
feedback:
  - "No bloqueante: la spec no menciona la condición de carrera TOCTOU ya documentada y aceptada en docs/tecnica/proteccion-antispam-y-abuso.md (dos requests casi simultáneos con mismo email+nombre pueden insertar dos leads y disparar dos confirmaciones al paciente). No es una omisión nueva -- ya afecta simétricamente a la notificación de la clínica desde la feature 05 sin que esa spec, ya aprobada, lo repitiera -- pero sería una mejora de honestidad documental que 'Riesgos / supuestos' la referencie explícitamente en vez de dejar que 'evitar reenvíos duplicados' suene como una garantía completa."
  - "No bloqueante: la exclusión de 'telefono' del correo al paciente se justifica como parte de 'información clínica sensible', pero el propio spec la describe como 'dato de contacto personal innecesario', no como dato clínico. Es una decisión razonable igual, pero conviene que decision.md distinga ambas razones (dato personal vs. dato clínico) en vez de fusionarlas bajo una sola etiqueta."
  - "Sugerencia para decision.md: documentar explícitamente que ni 'to' (lead.email, validado por EMAIL_PATTERN) ni 'replyTo' (LEADS_NOTIFICATION_EMAIL, variable de entorno) representan superficie de header injection en este correo, a diferencia del correo a la clínica que sí necesita sanitizeHeaderValue() sobre 'nombre' en el subject -- es una fortaleza de este diseño (subject fijo) que vale la pena dejar registrada."
---

# Auditoría — 06-confirmacion-automatica-paciente (intento 1)

## Alcance y límites

Alcance claro y acotado: extiende `api/leads.js` y `api/_lib/mailer.js`
con un segundo envío de email (al paciente) tras el `INSERT` nuevo
exitoso, reutilizando exactamente la infraestructura ya aprobada en la
feature 05 (mismo `mailerFactory`, mismo patrón de flag + `UPDATE`,
mismo aislamiento de `try/catch`). La sección "Explícitamente NO
incluye" delimita correctamente el alcance: sin tabla/columna nueva, sin
variable de entorno nueva, sin dependencia npm nueva, sin reintentos,
sin tocar `index.html`/`script.js`, sin contenido médico/clínico
inventado, sin modificar el flujo de notificación a la clínica más allá
de reorganizar el bloque de envío.

Verificado contra `ROADMAP.md`: el ítem `06` real coincide exactamente
con lo que el spec cubre (email de confirmación, aclaración de turno no
confirmado, sin datos clínicos, actualización del flag, "evitar
reenvíos duplicados" abordado como decisión de diseño explícita, no
ignorado).

## Verificación de afirmaciones del spec contra el código real

Todas las afirmaciones técnicas del spec fueron confirmadas leyendo el
código real, no asumidas:

- `api/leads.js`: el bloque de envío a la clínica (líneas 689-752, tras
  el `INSERT` nuevo, nunca en la rama de duplicado del paso 11/f04) tiene
  exactamente la forma que el spec describe como punto de extensión:
  `mailerFactory()` invocado una sola vez (línea 698), `try/catch`
  acotado para la creación del transporter y otro para `sendMail()`,
  `UPDATE` condicional al éxito del envío, sin afectar la respuesta `201`
  ya decidida.
- `mailerFactory` inyectable: confirmado en el JSDoc de `createHandler`
  (líneas 351-356) y su uso real (línea 364, 698) -- el criterio 11
  ("mailerFactory inyectado se invoca exactamente una vez por request")
  es verificable tal cual está el código hoy, no una suposición del
  analyst-agent.
- `api/_lib/mailer.js`: `buildClinicNotificationEmail(lead)` (líneas
  124-180) tiene la firma y el patrón (`escapeHtml()`,
  `sanitizeHeaderValue()`, retorno `{to, from, replyTo, subject, html,
  text}`) que el spec toma como plantilla directa para
  `buildPatientConfirmationEmail(lead)`. La firma de entrada del `lead`
  (`{ id, nombre, email, telefono, servicio, mensaje, fecha_creacion }`)
  coincide con la que arma `api/leads.js` en la línea 707-715.
- `api/_lib/sanitize-html.js`: `escapeHtml()` existe con la firma
  esperada (líneas 38-44), sin dependencias nuevas.
- Migración SQL: `confirmacion_paciente_enviada boolean not null default
  false` está efectivamente en la línea 29 de
  `supabase/migrations/20260819210130_create_leads_table.sql` -- el spec
  cita el número de línea correcto, no aproximado.
- `.env.example`: `SMTP_FROM` y `LEADS_NOTIFICATION_EMAIL` ya están
  documentados; no se requiere ninguna variable nueva para esta feature,
  tal como afirma el spec (el destinatario es dinámico, `lead.email`).
- `index.html` línea 26: `<a href="tel:+123456789" ...>+123 456
  789</a>` -- confirmado que es el placeholder de plantilla que el spec
  dice explícitamente no copiar al correo de confirmación.
- `docs/tecnica/index.md` y `docs/usuario/index.md`: formato real de las
  entradas existentes (`- [Título](slug.md)`) coincide con el formato
  que el spec exige en los criterios 25 y 26 para la entrada nueva.
- Patrón de test "Feature 05" confirmado en `api/leads.test.js` (línea
  1648) -- existe un precedente real y directamente análogo para la
  "sección Feature 06" que el spec pide agregar.

No se encontró ninguna afirmación del spec sobre el código existente que
resultara falsa o imprecisa tras la verificación.

## Evaluación de "evitar reenvíos duplicados" (criterio 16 / UPDATE fallido)

Pregunta específica: si `sendMail()` al paciente tiene éxito pero el
`UPDATE` de `confirmacion_paciente_enviada` falla, ¿puede producirse un
reenvío duplicado?

Con la arquitectura actual, no: la detección de duplicados de la
feature 04 (paso 11) filtra por `email`+`nombre`+ventana de 5 minutos,
sin leer nunca el valor de `confirmacion_paciente_enviada`. Una
resolicitud dentro de esa ventana responde `201` con el `id` existente
sin volver a entrar al bloque de envío de emails, sin importar si el
flag quedó en `false` por un `UPDATE` fallido. El razonamiento del spec
sobre este punto específico es correcto y, además, está honestamente
acotado: "Riesgos / supuestos" reconoce que si en el futuro se agrega
algún mecanismo de reprocesamiento de leads ya insertados, ese mecanismo
deberá agregar explícitamente el chequeo -- no se presenta como una
garantía sin condiciones hacia el futuro.

Observación no bloqueante (ver feedback): existe una condición de
carrera TOCTOU ya documentada y aceptada en
`docs/tecnica/proteccion-antispam-y-abuso.md` (dos requests casi
simultáneos con el mismo `email`+`nombre` pueden ambos pasar el `SELECT`
de duplicados antes de que cualquiera complete el `INSERT`, resultando
en dos leads y, por lo tanto, dos confirmaciones al paciente). Esto no
es una omisión nueva de esta spec: ya es un riesgo aceptado desde la
feature 04 que afecta simétricamente a la notificación de la clínica
desde la feature 05 (ya aprobada, sin que esa spec lo repitiera). No
amerita rechazo, pero sería una mejora de honestidad documental que esta
spec lo referencie explícitamente en vez de dejar que "evitar reenvíos
duplicados" suene como una garantía completa sin matices.

## Contenido del correo: exclusión de telefono/servicio/mensaje

Interpretación conservadora y razonable de "no incluir información
clínica sensible" del pedido original. `mensaje` (texto libre, puede
contener síntomas/dolor) y `servicio` (puede reflejar intención de
tratamiento) encajan claramente en la categoría de dato clínico
sensible. `telefono` es, en rigor, un dato de contacto personal, no un
dato clínico -- el propio spec lo etiqueta así ("dato de contacto
personal innecesario para una confirmación"), lo cual es una razón
distinta y también válida, aunque el spec las agrupa bajo una sola
decisión. No amerita rechazo: el resultado (excluir los tres campos) es
razonable, está bien fundamentado campo por campo, y el spec deja
explícitamente abierta la puerta a que el reviewer o el negocio real
prefieran incluir `servicio` sin que eso afecte el resto del diseño.

## replyTo: LEADS_NOTIFICATION_EMAIL

Decisión razonable y bien justificada: si el paciente responde al correo
de confirmación, la respuesta debe llegar a un humano de la clínica que
pueda coordinarla, no a la casilla automatizada `SMTP_FROM`. No introduce
ninguna variable de entorno nueva (reutiliza `LEADS_NOTIFICATION_EMAIL`,
ya obligatoria). No introduce riesgo de header injection: a diferencia
del correo a la clínica (que sí necesita `sanitizeHeaderValue()` sobre
`nombre` interpolado en el subject), este correo tiene un subject fijo
sin interpolación, `to` = `lead.email` ya validado por `EMAIL_PATTERN`
(que excluye espacios y `\r`/`\n`), y `replyTo` proviene de una variable
de entorno, no de input de usuario. Es, de hecho, una superficie de
ataque menor que la del correo a la clínica -- vale la pena que
`decision.md` lo deje registrado como fortaleza del diseño.

## Orden secuencial y latencia

El orden secuencial (clínica primero, paciente después) es coherente con
el estilo de código ya aprobado en la feature 05 y con el objetivo
declarado de "menor diff". El trade-off de latencia (~10s peor caso, dos
timeouts SMTP de 5s consecutivos) está documentado explícitamente tanto
en "Casos borde" como en "Riesgos / supuestos", con referencia al ítem
`15-observabilidad-y-operacion` del roadmap como donde correspondería
revisarlo si resulta problemático en producción -- no es un riesgo
oculto.

## Verificabilidad de los criterios de aceptación

Los 26 criterios son mayormente verificables por test automatizado
(criterios 1-8, 10-21) o por inspección directa de artefactos
(criterios 22-26). El criterio 9 (ausencia de contenido médico/clínico)
es explícitamente de revisión manual, consistente con cómo se abordan
las reglas de dominio de `AGENTS.md` en features anteriores -- razonable
dado que no es un patrón fácilmente testeable de forma automática, y
queda complementado por el criterio 8 (automatizable) que cubre la
exclusión concreta de campos.

## Documentación obligatoria (checklist no negociable)

- `docs/tecnica/confirmacion-automatica-paciente.md`: exigido como
  criterio 22, con contenido mínimo especificado (decisión de contenido,
  replyTo, "evitar reenvíos duplicados", ejecución secuencial). Presente.
- `docs/usuario/confirmacion-automatica-paciente.md`: exigido como
  criterio 23, con contenido mínimo especificado (qué ve el paciente, cómo
  detectar manualmente un flag en `false`). Presente.
- `runs/06-confirmacion-automatica-paciente/decision.md`: exigido como
  criterio 24. Presente.
- Enlace exacto en `docs/tecnica/index.md`: exigido como criterio 25, con
  formato consistente con las entradas existentes. Presente.
- Enlace exacto en `docs/usuario/index.md`: exigido como criterio 26.
  Presente.

Los dos `.md` de documentación, `decision.md` y ambos enlaces de índice
están exigidos explícitamente como criterios de aceptación. No hay
motivo de rechazo automático por este punto.

## Dato personal / formulario de contacto

El spec declara explícitamente a dónde van los datos de este flujo (un
email al propio `lead.email`, ya validado por `EMAIL_PATTERN` en el paso
de inserción existente) y no introduce ninguna validación/consentimiento
nueva no cubierta ya por el flujo de inserción (feature 03: consentimiento
obligatorio antes de insertar). No hay motivo de rechazo por este punto.

## Contenido médico/clínico inventado

No se encontró ninguna invención de contenido médico/clínico, precios,
tratamientos ni certificaciones. La afirmación del spec sobre el teléfono
`+123456789` como placeholder de plantilla (no dato real del negocio) fue
verificada directamente contra `index.html` línea 26 y es correcta. No
hay motivo de rechazo por este punto.

## Veredicto

`approved`. El spec es verificable, tiene alcance acotado y consistente
con el `ROADMAP.md`, verifica correctamente sus propias afirmaciones
contra el código real, cumple los cuatro requisitos no negociables de
documentación/decisión/índices, no introduce riesgo nuevo de datos
personales sin declarar destino/validación, y no inventa contenido
médico/clínico. Los tres puntos de `feedback` son mejoras de precisión
para `decision.md`, no bloqueos -- quedan a criterio de `builder-agent`
incorporarlos al documentar las decisiones finales.

Archivos revisados: `runs/06-confirmacion-automatica-paciente/spec.md`,
`api/leads.js`, `api/_lib/mailer.js`, `api/_lib/sanitize-html.js`,
`api/_lib/mailer.test.js`, `api/leads.test.js`,
`supabase/migrations/20260819210130_create_leads_table.sql`,
`.env.example`, `ROADMAP.md`,
`docs/tecnica/notificacion-clinica-smtp-ferozo.md`,
`docs/tecnica/proteccion-antispam-y-abuso.md`, `docs/tecnica/index.md`,
`docs/usuario/index.md`, `index.html`.
