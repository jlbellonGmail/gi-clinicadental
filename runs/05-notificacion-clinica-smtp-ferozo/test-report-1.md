```yaml
status: approved
attempt: 1
feedback:
  - "Sin objeciones bloqueantes. npm test corre 141/141 tests en verde (incluye la regresión completa de las features 03/04, no solo lo nuevo de la 05)."
  - "Los 19 criterios de aceptación del spec se verificaron uno por uno contra el código real de api/_lib/mailer.js y api/leads.js (no solo contra el nombre de los tests) — ver detalle abajo."
  - "pytest sobre tests/ falla en este entorno por PermissionError de Windows sobre C:\\Users\\jlbel\\AppData\\Local\\Temp\\pytest-of-jlbellon, no relacionado con el código de esta feature. Confirmado corriendo pytest con --basetemp en una ruta alternativa: 24/24 tests pasan. Se documenta como limitación de entorno, no como fallo de la feature."
  - "Documentación (docs/tecnica y docs/usuario), decision.md e índices verificados presentes, no vacíos y con el enlace exacto exigido."
```

# Reporte QA — 05-notificacion-clinica-smtp-ferozo (intento 1)

## Contexto de verificación

- Worktree: `D:\proyectos\worktrees\notificacion-clinica-smtp-ferozo`
- Rama confirmada: `feature/05-notificacion-clinica-smtp-ferozo`
  (`git branch --show-current`)
- Commit de entrega: `f333438`, working tree limpio al iniciar QA
  (confirmado con `git status`)

## 1. Tests JS (`npm test`)

Comando real declarado en `package.json` (`"test": "node --test"`),
ejecutado en el worktree:

```
npm test
```

Resultado: **141 tests, 141 pass, 0 fail** (`duration_ms 689.71`). Incluye
tanto los tests preexistentes de las features `03`
(`api/leads.test.js`, validación/inserción básica) y `04`
(antispam/duplicados/rate limit/origen) como los nuevos de esta feature
(`api/_lib/mailer.test.js` y la sección "Feature 05" de
`api/leads.test.js`). No se corrió solo lo nuevo: la suite completa pasó
en un único comando, confirmando la regresión.

## 2. Verificación de los 19 criterios de aceptación, uno por uno

Leí el código real de `api/_lib/mailer.js` y `api/leads.js` (no solo los
nombres de test) y los assert exactos de `api/_lib/mailer.test.js` y la
sección "Feature 05" de `api/leads.test.js`.

1. **INSERT nuevo -> sendMail() con to/from/replyTo y `.select('id, fecha_creacion')`.**
   Confirmado en `api/leads.js:665-679` (`.select('id, fecha_creacion').single()`)
   y en `buildClinicNotificationEmail()` (`to`/`from`/`replyTo` armados
   correctamente). Test: `'INSERT nuevo exitoso invoca sendMail() con
   to/from/replyTo correctos y usa .select("id, fecha_creacion")'`,
   inspecciona `supabaseClient.insertSelectCalls[0] === 'id, fecha_creacion'`.
   PASS.
2. **Transporter con host/port/secure/auth correctos.**
   Confirmado en `api/_lib/mailer.js:57-67` — `secure: true` fijo (no
   condicional), `port: Number(SMTP_PORT) || 465`, `auth.user`/`auth.pass`
   desde env. Test `createTransporter() con configuracion completa arma
   host/port/secure/auth correctos` verifica cada campo directamente
   sobre `transporter.options`, con el transporter real de Nodemailer
   (no un mock manual, decisión documentada en `decision.md` punto 6, y
   verificable: `nodemailer.createTransport()` no abre red). PASS.
3. **HTML contiene nombre/email/telefono/servicio/mensaje escapados +
   fecha_creacion + id.** Confirmado por lectura de
   `buildClinicNotificationEmail()` (cada campo pasa por `escapeHtml()`
   antes de interpolarse; `id`/`fecha_creacion` también). Test con
   `<script>`/`&`/`"`/`'` en `nombre`/`mensaje` confirma que el HTML NO
   contiene `<script>alert(1)</script>` crudo y sí contiene
   `&lt;script&gt;`. Test separado confirma `id` literal y "2026"
   (representación de `fecha_creacion`) en el HTML, inyectando valores
   conocidos vía el fixture de Supabase falso (`api/leads.test.js`) y
   directamente en `mailer.test.js`. PASS.
4. **`subject` saneado contra `\r`/`\n` (header injection).**
   Confirmado: `sanitizeHeaderValue()` (`mailer.js:81-83`) hace
   `value.replace(/[\r\n]+/g, ' ')`, aplicado a `nombre` antes de
   interpolar en `subject` (`mailer.js:131-132`). Test inyecta
   `"Juan\r\nBcc: attacker@evil.com"` y hace
   `assert.equal(/[\r\n]/.test(mail.subject), false)` — vector de ataque
   exacto exigido por el spec. PASS.
5. **Rama de duplicado NO invoca sendMail().**
   Confirmado: el `respond(201, ...)` de la rama de duplicado
   (`api/leads.js:653-656`) hace `return` antes de llegar al bloque de
   `mailerFactory()`/`sendMail()` (que arranca en la línea 696, dentro
   del flujo posterior al `INSERT`, inalcanzable desde ese `return`
   temprano). Test con contador de `sentMails` confirma 0 invocaciones.
   PASS.
6. **sendMail() éxito -> UPDATE notificacion_clinica_enviada = true.**
   Confirmado en `api/leads.js:729-751`. Test verifica
   `updateCalls[0]` con `id`/`values` correctos. PASS.
7. **sendMail() rechaza -> 201 igual, sin UPDATE, sin insert adicional.**
   Confirmado: el `catch` de `sendMail()` (línea 722-727) solo loguea, no
   relanza; `sendMailSucceeded` queda `false`, por lo que el bloque de
   `UPDATE` (condicionado a `if (sendMailSucceeded)`) no se ejecuta.
   Test verifica `201`, mismo `id`, `updateCalls.length === 0`, y cuenta
   invocaciones a `insert()` (vía el fixture) para confirmar que sigue
   siendo exactamente 1. PASS.
8. **mailerFactory() lanza -> mismo comportamiento que 7.**
   Confirmado: `try { transporter = mailerFactory(); } catch { ... }`
   (línea 697-704) deja `transporter = null`, y el bloque completo de
   email/update queda dentro de `if (transporter) { ... }` (línea 706),
   por lo que ni `sendMail()` ni `UPDATE` se ejecutan. `respond(201, ...)`
   se alcanza igual, fuera de ese bloque condicional. Test específico
   confirma `201`, sin `UPDATE`, sin insert adicional. PASS.
9. **UPDATE falla -> 201 igual, sin reintentar insert.**
   Confirmado: el `catch`/chequeo de `updateError` (línea 739-750) solo
   loguea `error.message`, no altera `sendMailSucceeded` (ya `true`) ni
   la respuesta. Test con `failOnUpdate: true` confirma `201`, mismo
   `id`, `updateCalls.length === 1` (se intentó, aunque falló), y sin
   segundo `insert()`. PASS.
10. **Logs de fallo de email nunca contienen SMTP_PASS/SMTP_USER ni el
    objeto de configuración completo.** Confirmado por lectura de las 3
    ramas de `console.error` del bloque de email
    (`mailerErr.message`, `sendMailErr.message`, `updateError.message`/
    `updateErr.message` — nunca el objeto completo). Test intercepta
    `console.error` con un error simulado que incluye propiedades
    adicionales tipo `.response`/`.command` con contenido similar a
    credenciales, y confirma que no aparecen en los args logueados; otro
    test cubre el caso de config SMTP faltante. PASS.
11. **Contrato `201 { id }` sin cambios en ningún escenario de email.**
    Confirmado: `respond(201, { id: data.id })` es el único punto de
    respuesta de éxito tras el `INSERT`, fuera de cualquier rama
    condicional de email — se alcanza sin importar el resultado de los
    pasos de email/update. El fixture de Supabase falso preexistente fue
    ajustado (como exigía el spec) para devolver también
    `fecha_creacion`, sin cambiar la expectativa HTTP de los tests ya
    existentes de las features `03`/`04` (los 141 tests, incluidos los
    preexistentes, pasan). PASS.
12. **`connectionTimeout: 5000` y `socketTimeout: 5000`.**
    Confirmado literal en `mailer.js:65-66` vía constantes con nombre
    explícito (`SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_SOCKET_TIMEOUT_MS`,
    ambas en `5000`), documentado también en
    `docs/tecnica/notificacion-clinica-smtp-ferozo.md`. Test verifica
    `transporter.options.connectionTimeout === 5000` y `socketTimeout`
    ídem. PASS.
13. **`nodemailer` en dependencias de producción + lockfile actualizado.**
    Confirmado: `package.json` línea 14, `"nodemailer": "^9.0.5"` bajo
    `dependencies` (no `devDependencies`); `package-lock.json` contiene
    la entrada correspondiente. PASS.
14. **Sección nueva en `docs/tecnica/arquitectura.md` sobre `nodemailer`.**
    Confirmado: referencias a la feature `05` y a la decisión de
    dependencia en `docs/tecnica/arquitectura.md` (líneas 104-115),
    sección agregada sin evidencia de que se hayan reescrito las
    secciones previas (grep no muestra duplicados ni conflictos). PASS.
15. **`docs/tecnica/notificacion-clinica-smtp-ferozo.md` no vacío, con
    las decisiones de diseño exigidas.** Confirmado: 194 líneas, cubre
    estructura de `mailer.js`, el cambio de `.select()` y su motivo,
    por qué síncrono con timeout, por qué sin reintentos, por qué no se
    notifica en la rama de duplicado, la mitigación de header injection,
    y el contenido exacto del HTML. PASS.
16. **`docs/usuario/notificacion-clinica-smtp-ferozo.md` no vacío, en
    lenguaje no técnico, con qué hacer ante
    `notificacion_clinica_enviada = false`.** Confirmado: 89 líneas,
    explica el propósito, qué pasa si faltan datos opcionales, qué pasa
    con duplicados, y la sección "Qué hacer si un contacto no generó la
    notificación por email" remite explícitamente a revisar la columna
    en el panel de Supabase. PASS.
17. **`decision.md` no vacío ni ornamental.** Confirmado: 8 secciones
    numeradas con decisiones demostrables, cada una remitiendo a código
    y/o tests concretos (líneas de `api/leads.js`, nombres exactos de
    tests). PASS.
18. **Enlace exacto en `docs/tecnica/index.md`.** Confirmado línea 12:
    `- [Notificación de nuevo lead a la clínica](notificacion-clinica-smtp-ferozo.md)`.
    PASS.
19. **Enlace exacto en `docs/usuario/index.md`.** Confirmado línea 10:
    `- [Notificación de nuevo lead a la clínica](notificacion-clinica-smtp-ferozo.md)`.
    PASS.

## 3. Reglas duras (verificación especial)

- **(a) Ningún fallo de sendMail()/mailerFactory/UPDATE cambia el `201`
  ni borra/duplica el lead:** confirmado por lectura de código (los tres
  puntos de riesgo están en `try/catch` propios, ninguno relanza hacia
  el `catch` genérico de nivel superior, línea 755-760, que es el único
  camino hacia un `500` no relacionado con Supabase/validación) y por los
  tests de los criterios 7, 8 y 9 (conteo de `insert()`/`updateCalls`).
- **(b) `escapeHtml()` aplicado correctamente en el HTML del correo:**
  confirmado con un valor `<script>alert(1)</script>` en `nombre` — el
  HTML resultante no contiene la etiqueta cruda, solo su versión
  escapada. Los saltos de línea de `mensaje` se convierten a `<br>`
  **después** de escapar (verificado en código: `escapeHtml(mensajeDisplay).replace(/\n/g, '<br>')`,
  evita que el escape de `/` rompa el propio `<br>` insertado).
- **(c) `subject` saneado contra `\r`/`\n`:** confirmado en el punto 4
  arriba, con el vector de ataque exacto del spec
  (`"Juan\r\nBcc: attacker@evil.com"`).
- **(d) Ningún log contiene `SMTP_PASS`/`SMTP_USER` ni el objeto de
  config completo:** confirmado por lectura de las 3 ramas de
  `console.error` de `api/leads.js` (siempre `.message`, nunca el objeto
  completo) y por el test dedicado que simula un error con propiedades
  adicionales sensibles y confirma que no se filtran.

## 4. `pytest` sobre `tests/` (circuito)

Ejecución directa:

```
python -m pytest tests/ -q
```

Resultado: **1 passed, 23 errors**, todos con el mismo traceback:
`PermissionError: [WinError 5] Acceso denegado:
'C:\Users\jlbel\AppData\Local\Temp\pytest-of-jlbellon'` al intentar
`pytest` crear su directorio base temporal (`tmpdir.py` / `pathlib.py`,
fuera de cualquier código de este repo). El builder-agent ya había
reportado el mismo síntoma.

Verificación adicional (no solo confiar en el reporte del builder):
corrí la misma suite apuntando `pytest` a un `--basetemp` alternativo
para descartar que el problema fuera del código:

```
python -m pytest tests/ -q --basetemp="C:\Users\jlbel\AppData\Local\Temp\claude\pytest-qa-05"
```

Resultado: **24 passed, 0 failed** (187.34s). Confirma que la suite
completa de `tests/` (scripts del circuito: `test_close_feature_script.py`,
`test_feature_contract_scripts.py`, `test_local_reconciler_scripts.py`,
etc.) pasa en verde cuando el entorno no tiene el problema de permisos —
es decir, el `PermissionError` es exclusivamente de la carpeta temporal
de Windows de esta máquina/usuario, no una regresión introducida por esta
feature.

Revisé además si algún test de `tests/` depende de `api/` o de la entrada
de `ROADMAP.md` de esta feature: `grep -rl "api/" tests/` no devolvió
ningún archivo, y la única mención de
`05-notificacion-clinica-smtp-ferozo` en `ROADMAP.md` es la línea de la
propia feature (`[ ]`, pendiente hasta el paso de `ready-for-pr`), sin
que ningún test de `tests/` la lea directamente. **Conclusión: es seguro
documentar el `PermissionError` como limitación de entorno sin bloquear
el veredicto.**

## 5. Contrato común (`scripts/feature-contract.ps1`)

```
Import-Module .\scripts\feature-contract.ps1 -Force
Assert-FeatureContract -Slug '05-notificacion-clinica-smtp-ferozo' -Title 'Notificación de nuevo lead a la clínica'
```

Único fallo reportado, esperable en esta etapa: `Falta al menos un
test-report-N.md en runs/05-notificacion-clinica-smtp-ferozo` — porque
este mismo archivo (`test-report-1.md`) todavía no existía al momento de
correr el chequeo (es el artefacto que esta etapa de QA está produciendo).
No se reportó ningún otro gap: `spec.md`, `decision.md`, `audit-2.md`,
ambos `.md` de documentación, y los enlaces exactos en ambos índices ya
estaban presentes y correctos antes de este chequeo.

## 6. Commits de test escritos por QA

No fue necesario escribir ni modificar ningún test: la cobertura del
builder-agent (`api/_lib/mailer.test.js` y la sección "Feature 05" de
`api/leads.test.js`) ya verifica cada criterio de aceptación con asserts
concretos y vectores de ataque explícitos, verificados uno por uno contra
el código real en este reporte. No se generó ningún commit nuevo en esta
etapa de QA.

## Veredicto

`approved`, intento 1. Los 19 criterios de aceptación están implementados
y verificados con evidencia concreta (lectura de código real + asserts de
test), la suite JS completa pasa en verde (141/141, incluida la
regresión), la documentación técnica y de usuario existe y no está vacía,
`decision.md` es demostrable, los índices tienen el enlace exacto, y el
único fallo de `pytest` es una limitación de entorno documentada, no
atribuible a esta feature.
