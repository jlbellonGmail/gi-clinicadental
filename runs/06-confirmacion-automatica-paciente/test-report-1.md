---
status: approved
attempt: 1
feedback:
  - "Sin hallazgos bloqueantes. No fue necesario escribir ni modificar tests: la cobertura existente (api/_lib/mailer.test.js y la sección 'Feature 06' de api/leads.test.js) ya verifica los 26 criterios de aceptación con asserts reales, no solo pasa 'porque sí'."
---

# Reporte QA — 06-confirmacion-automatica-paciente (intento 1)

## Entorno verificado

- Worktree: `D:\proyectos\worktrees\confirmacion-automatica-paciente`
- Rama confirmada con `git branch --show-current`: `feature/06-confirmacion-automatica-paciente`
- Commit: `0eaad86`, working tree limpio al momento de arrancar QA (confirmado con `git status`).

## 1. Suite completa de tests de producto (`npm test`)

Ejecutado `npm test` (motor `node --test`, ver `package.json`) sobre todo
el proyecto, no solo los archivos nuevos:

```
ℹ tests 158
ℹ suites 0
ℹ pass 158
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

158/158 pasan, consistente con lo reportado por `decision.md`. Incluye
toda la regresión de las features `03` (inserción de leads), `04`
(protección antispam/abuso) y `05` (notificación SMTP a la clínica), más
los tests nuevos de `06`.

## 2. Verificación código-a-criterio (no solo "test verde")

Leí el código real de `api/_lib/mailer.js` y el bloque reorganizado de
`api/leads.js` (líneas 694-811) y los contrasté, uno por uno, contra los
26 criterios del spec y contra los asserts reales de los tests (no
supuse que "test pasa" implicara "criterio cubierto"):

- **Criterios 1-5** (`buildPatientConfirmationEmail`: firma de entrada
  idéntica, `to = lead.email`, `from = process.env.SMTP_FROM`,
  `replyTo = process.env.LEADS_NOTIFICATION_EMAIL`, `subject` fijo sin
  interpolar): confirmado leyendo `api/_lib/mailer.js` líneas 215-246 y
  los asserts de `api/_lib/mailer.test.js` líneas 230-248 (`mailUno.subject
  === mailDos.subject` para dos `nombre` distintos, y
  `subject.includes('Ana') === false`).
- **Criterio 6** (aclaración de turno no confirmado, verificable por
  test): confirmado en `api/_lib/mailer.test.js` líneas 250-261. El test
  no se limita a mencionar la aclaración en prosa: hace asserts reales
  sobre `html` y `text` en minúsculas, exigiendo `/turno|cita/`, la
  negación literal (`no está confirmado` / `no esta confirmado`) y
  `/comunic|contact/`, sobre ambos formatos del correo.
- **Criterio 7** (escapado HTML de `nombre`): probé mentalmente (y
  confirmé que el test lo hace explícitamente) con
  `` `<script>alert(1)</script> & "Ana" 'Pérez'` `` como `nombre`
  (`api/_lib/mailer.test.js` líneas 263-272): el HTML resultante no
  contiene `<script>alert(1)</script>` literal, sí contiene
  `&lt;script&gt;` escapado, y no contiene `& "Ana"` sin escapar. Correcto
  — el `escapeHtml()` importado de `sanitize-html.js` se aplica sobre
  `nombreHtml` antes de interpolarlo (línea 223 de `mailer.js`).
- **Criterio 8** (sin `telefono`/`servicio`/`mensaje`): confirmado con
  fixture de valores distintivos (`DATO-TELEFONO`, `DATO-SERVICIO`,
  `DATO-MENSAJE`) que no aparecen ni en `html` ni en `text`
  (`api/_lib/mailer.test.js` líneas 274-287). Además, `buildPatientConfirmationEmail`
  ni siquiera lee esos tres campos del objeto `lead` (confirmado leyendo
  el cuerpo completo de la función, líneas 215-246 de `mailer.js`): no es
  solo que no se muestren, es que no se tocan.
- **Criterio 9** (sin contenido médico/clínico/precios/certificaciones):
  revisión manual del `html`/`text` literal (líneas 225-243 de
  `mailer.js`): el texto se limita a saludo, confirmación de recepción,
  aclaración de turno no confirmado y firma de "Sonríe más" — ningún
  tratamiento, precio, diagnóstico ni certificación inventados.
- **Criterio 10** (`createTransporter()` sin cambios de firma/env vars):
  confirmado, `createTransporter()` (líneas 38-70 de `mailer.js`) no fue
  tocado por esta feature; sigue exigiendo exactamente `SMTP_HOST`,
  `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `LEADS_NOTIFICATION_EMAIL`.
  `.env.example` no tiene variables nuevas (verificado con `git diff` del
  commit `0eaad86` — sin cambios en `.env.example`).
- **Criterio 11** (`mailerFactory()` una única llamada, compartida por
  ambos envíos): confirmado leyendo `api/leads.js` línea 704
  (`transporter = mailerFactory()`, una sola invocación en todo el bloque)
  y el test explícito `'mailerFactory se invoca exactamente una vez por
  request...'` (`api/leads.test.js` líneas 1991-2007), que cuenta
  `factoryCalls` con un contador propio y verifica `factoryCalls === 1`
  mientras `mailer.sentMails.length === 2`.
- **Criterio 12** (`mailerFactory()` lanza → ningún envío se intenta, sigue
  201): el `try/catch` de la línea 703-711 de `leads.js` envuelve solo la
  llamada a `mailerFactory()`; si lanza, `transporter` queda `null` y todo
  el bloque `if (transporter) { ... }` (que contiene ambos envíos) se
  salta por completo. Confirmado por el test de las líneas 2013-2029:
  `mailer.sentMails.length === 0`, `supabaseClient.updateCalls.length ===
  0`, `res.statusCode === 201`.
- **Criterio 13** (independencia bidireccional): verifiqué especialmente
  este punto por ser el más propenso a errores sutiles de reorganización
  de código. Leí el bloque completo (líneas 713-809 de `leads.js`): el
  envío a la clínica vive en su propio `try/catch` (730-742) seguido de su
  propio `if (clinicSendSucceeded)` (744-766); el envío al paciente es un
  bloque completamente separado y secuencial (773-808) con su propio
  `try/catch` y su propio `if (patientSendSucceeded)`. Ninguna variable de
  control se comparte entre ambos bloques, y ninguno de los dos `catch`
  relanza hacia el `catch` genérico externo. Confirmado con
  `makeSelectiveFailMailer` en ambas direcciones
  (`api/leads.test.js` líneas 2035-2065): fallo en clínica → el paciente
  igual recibe su envío y su `UPDATE`; fallo en paciente → la clínica
  igual recibe su envío y su `UPDATE`, en ambos casos con
  `mailer.sentMails.length === 2` (se intentaron los dos) y exactamente
  un `updateCalls` (el del que sí tuvo éxito).
- **Criterio 14** (`UPDATE confirmacion_paciente_enviada = true` con el
  `id` correcto tras éxito): confirmado en `leads.js` líneas 786-808 y en
  el test de las líneas 2071-2089, que verifica `table === 'leads'`,
  `column === 'id'`, `value === <id insertado>`.
- **Criterio 15** (fallo de `sendMail()` al paciente → solo
  `err.message` en el log, nunca el objeto completo ni credenciales, se
  salta el `UPDATE`, no afecta la respuesta): confirmado en `leads.js`
  línea 783 (`console.error(..., sendMailErr.message)`, no
  `sendMailErr` completo) y en el test de las líneas 2096-2132, que arma
  un error con `secretError.response` conteniendo un string con
  `SMTP_PASS=contrasena-secreta-paciente-xyz` y verifica que ese string
  **no** aparece en ningún `console.error` capturado — prueba real de que
  no se filtra el objeto de error completo, no solo una suposición.
- **Criterio 16** (fallo del `UPDATE` no cambia el `201`): confirmado en
  `leads.js` líneas 791-807 (el `UPDATE` está en su propio `try/catch`
  interno que no puede burbujear) y en el test de las líneas 2139-2154:
  `supabaseClient` configurado con `failOnUpdate: true`, igual responde
  `201` con el mismo `id`, y ambos `sendMail()` se intentaron igual.
- **Criterio 17** (rama de duplicado → ningún envío): confirmado
  estructuralmente (el bloque de envío de emails está después del
  `INSERT`, dentro del `if` que solo se alcanza tras un `INSERT` nuevo
  exitoso — la rama de duplicado detectado responde y hace `return` antes
  de llegar ahí) y por el test de las líneas 2160-2172:
  `mailer.sentMails.length === 0`.
- **Criterio 18** (contrato `201 { id }` estable en las 5 combinaciones):
  confirmado por el test de las líneas 2179-2223, que recorre
  explícitamente los 5 escenarios (éxito ambos, fallo clínica/éxito
  paciente, éxito clínica/fallo paciente, fallo ambos, `mailerFactory`
  que lanza) y en cada uno verifica `Object.keys(res.json)` sea
  exactamente `['id']` — no solo que el `statusCode` sea 201, sino que el
  body no tenga campos extra (`fecha_creacion` u otros).
- **Criterio 19** (dos leads independientes → dos confirmaciones con `to`
  propio, sin mezclar destinatarios): confirmado por el test de las
  líneas 2230-2241 y siguientes (revisado el resto del archivo), que hace
  dos requests con emails distintos y verifica que cada `sendMail()`
  recibió el `to` correspondiente a su propio lead.
- **Criterio 20 y 21** (cobertura de tests en los archivos correctos):
  confirmado — `api/_lib/mailer.test.js` cubre los criterios 2-9 para
  `buildPatientConfirmationEmail`, y la sección "Feature 06" de
  `api/leads.test.js` (líneas 1982 en adelante) cubre los criterios 11-19.
  Ningún test depende de red real ni de un servidor SMTP real (todos usan
  `mailerFactory`/`mailer` inyectados, mismo patrón que la feature 05).
- **Criterios 22-26** (documentación y contrato común): ver secciones 3 y
  4 más abajo.

## 3. Documentación y artefactos obligatorios

- `docs/tecnica/confirmacion-automatica-paciente.md`: existe, 221 líneas,
  no vacío. Incluye explícitamente la decisión de contenido sin
  `telefono`/`servicio`/`mensaje` (con las dos razones distinguidas, nota
  no bloqueante 2 de `audit-1.md` incorporada), la decisión de `replyTo`,
  "evitar reenvíos duplicados" sin lógica adicional, y la ejecución
  secuencial — cumple el contenido mínimo exigido por el criterio 22.
- `docs/usuario/confirmacion-automatica-paciente.md`: existe, 98 líneas,
  no vacío. Explica qué ve el paciente en su bandeja, y cómo el equipo de
  la clínica puede detectar manualmente vía el panel de Supabase un lead
  con `confirmacion_paciente_enviada = false` — cumple el criterio 23.
- `runs/06-confirmacion-automatica-paciente/decision.md`: existe, no
  vacío ni ornamental — documenta decisiones demostrables (secciones 1-8)
  y, en particular, incorpora explícitamente las 3 notas no bloqueantes
  de `audit-1.md` en sus secciones 1, 2 y 3, cada una con referencia
  cruzada al documento técnico y al test correspondiente — cumple el
  criterio 24.
- `docs/tecnica/index.md` línea 13: `- [Confirmación automática al
  paciente](confirmacion-automatica-paciente.md)` — enlace exacto,
  formato consistente con las entradas existentes — cumple el criterio
  25.
- `docs/usuario/index.md` línea 11: `- [Confirmación automática al
  paciente](confirmacion-automatica-paciente.md)` — cumple el criterio
  26.

## 4. Tests del circuito (`pytest` sobre `tests/`)

Mismo problema de entorno reportado en la feature `04` con el directorio
temporal por defecto de pytest en Windows
(`PermissionError` en `pytest-of-jlbellon`); aplicado el mismo workaround
(`--basetemp` alternativo):

```
python -m pytest tests/ -q --basetemp="C:\Users\jlbel\AppData\Local\Temp\claude\qa06basetemp"
........................                                                 [100%]
24 passed in 194.57s (0:03:14)
```

24/24 tests del circuito pasan. Documentado acá el workaround de entorno
para que quede registrado, no es un fallo de la implementación de esta
feature.

## 5. Contrato común (`scripts/feature-contract.ps1`)

```
Import-Module .\scripts\feature-contract.ps1 -Force
Assert-FeatureContract -Slug '06-confirmacion-automatica-paciente' -Title 'Confirmación automática al paciente'
```

Resultado tras agregar este `test-report-1.md`: `Assert-FeatureContract`
pasa sin excepciones — `decision.md`, `spec.md`, `docs/tecnica/*.md`,
`docs/usuario/*.md`, `audit-1.md` y `test-report-1.md` presentes y no
vacíos, y los enlaces exactos en ambos índices verificados
programáticamente por `Assert-IndexLink` (no solo por inspección visual).

(Nota: antes de escribir este reporte, la única falla que devolvía el
script era la esperada — "Falta al menos un test-report-N.md" — porque
QA todavía no había producido su artefacto. No es una falla de la
implementación del builder.)

## 6. Commits nuevos de QA

Ninguno: la cobertura de tests existente ya verifica los 26 criterios de
aceptación con asserts reales (no solo "test pasa"), por lo que no fue
necesario escribir ni modificar tests de producto. Este `test-report-1.md`
es el único artefacto nuevo de esta etapa.

## Veredicto

`approved`. Los 26 criterios de aceptación están verificados contra el
código real (no solo contra la existencia de tests en verde), la
independencia bidireccional entre ambos envíos y la invocación única de
`mailerFactory()` quedaron confirmadas leyendo el código fuente línea por
línea, el contrato `201 { id }` es estable en las 5 combinaciones
relevantes, el HTML/texto al paciente no filtra `telefono`/`servicio`/
`mensaje` ni el teléfono placeholder de `index.html`, el escapado HTML de
`nombre` funciona correctamente contra un payload `<script>` real, la
aclaración de "turno no confirmado" está verificada por un test de
contenido real, la documentación técnica y de usuario existen y no están
vacías, `decision.md` incorpora las 3 notas no bloqueantes del reviewer,
ambos índices tienen el enlace exacto requerido, la suite completa de
producto (158/158) y la suite del circuito (24/24) pasan íntegramente.
