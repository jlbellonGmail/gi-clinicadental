# Spec: Endpoint de recepción de leads (`POST /api/leads`)

_Revisión intento 3 — corrige el rechazo de `audit-2.md`: una contradicción
entre los criterios 6, 8 y 14 (numeración del intento 2) sobre el código de
error `400` aplicable a `consentimiento_privacidad`, y la falta de un orden
explícito de evaluación de validaciones cuando un mismo body dispara más de
una condición de error a la vez. Los 4 puntos corregidos en el intento 2
(gap de CI, campos opcionales vacíos tras `trim()`, `Content-Type` con
charset, auto-parseo de body en Vercel) fueron confirmados como
correctamente resueltos por el reviewer en `audit-2.md` y **no se
modifican** en esta revisión — solo cambia su numeración, por la inserción
de un criterio nuevo cerca del criterio de método HTTP (ver más abajo)._

## Alcance

Crear la función Serverless de Node.js `POST /api/leads` (Vercel, runtime
Node.js — no Edge), ubicada en `api/leads.js`, que:

- Valida estrictamente el body JSON de la solicitud (campos permitidos,
  obligatorios/opcionales, tipos, formato, longitudes máximas, tamaño
  total del payload).
- Rechaza cualquier propiedad no reconocida en el body (whitelist
  estricta, no solo se ignoran los campos extra: la solicitud entera se
  rechaza).
- Valida `consentimiento_privacidad` como campo booleano obligatorio, y
  solo permite continuar si es exactamente `true`.
- Expone una utilidad de escape HTML reutilizable (`api/_lib/sanitize-html.js`,
  función `escapeHtml`), lista para que las features `05`/`06`
  (Nodemailer) la usen al construir el HTML de los correos. Esta feature
  **no envía ningún email** — Nodemailer todavía no existe en el repo
  (ver "Fuera de alcance").
- Inserta el lead en Supabase Postgres exclusivamente desde el servidor,
  usando `SUPABASE_SERVICE_ROLE_KEY` (nunca en el cliente), mapeando
  campo a columna según la migración real
  (`supabase/migrations/20260819210130_create_leads_table.sql`).
- Devuelve `201` en éxito, sin filtrar detalles internos (ni de Supabase
  ni stack traces), y respuestas controladas para `400`, `405`, `413`,
  `429` y `500`, cada una con un cuerpo JSON consistente y sin
  información técnica sensible.
- Agrega el primer `package.json` del repo (con `@supabase/supabase-js`
  como dependencia) y actualiza `.gitignore` para excluir `node_modules/`.
- **Actualiza `.github/workflows/ci.yml`** para que el pipeline de CI
  instale Node.js e incluya los tests Node de esta feature como parte
  del mismo gate obligatorio que hoy solo corre `pytest -v` (ver
  criterio de aceptación dedicado más abajo — corrige el gap señalado en
  `runs/03-endpoint-recepcion-leads/audit-1.md`).
- Crea `docs/tecnica/arquitectura.md` (no existe todavía) documentando
  la decisión de incorporar backend Node.js + primera dependencia npm al
  repo, tal como exige `AGENTS.md` ("Reglas de dominio": ningún backend,
  base de datos o dependencia de build sin decisión explícita en ese
  archivo). Esta feature es la que dispara esa obligación por primera
  vez en el proyecto.

## Fuera de alcance

- **No se modifican `index.html` ni `script.js`.** El formulario sigue
  simulado (`setTimeout`, comentario `// Simulate API call`). Decisión
  explícita, justificada en dos puntos:
  1. El roadmap ya separa esto en features futuras propias: `07-seguridad-y-politica-privacidad`
     (agrega el checkbox de consentimiento y la política de privacidad
     versionada al formulario) y `08-conexion-frontend-api` (reemplaza
     el `setTimeout` por `fetch()` real).
  2. Conectar el frontend ahora sería prematuro y rompería el contrato:
     el formulario actual **no recolecta** `consentimiento_privacidad`
     ni `version_politica_privacidad` (campos obligatorios del endpoint
     y de la tabla `leads`), porque el checkbox y la política todavía no
     existen. Conectar antes de `07` produciría un `400` sistemático o
     forzaría a inventar un consentimiento falso — ambas cosas violan la
     regla de dominio de `AGENTS.md` sobre no conectar el formulario sin
     que el consentimiento esté resuelto.
- **No se envía ningún correo (Nodemailer/SMTP).** Es la feature `05`
  (notificación a la clínica) y `06` (confirmación al paciente). Esta
  feature solo deja lista la utilidad de escape HTML que esas features
  van a consumir.
- **No se implementa el sistema robusto de antispam/rate limiting**
  (campo trampa, control temporal, CAPTCHA, validación de origen,
  idempotencia/deduplicación) — es la feature `04-proteccion-antispam-y-abuso`
  completa. Esta feature `03` sí debe devolver `429` de forma controlada
  (lo pide el ítem del roadmap explícitamente), así que implementa un
  limitador **best-effort, en memoria, por instancia del proceso**,
  documentado como provisional (ver "Riesgos / supuestos" — punto sobre
  rate limiting).
- No se agrega manejo de CORS más allá del comportamiento por defecto de
  Vercel (mismo origen). Validación de origen queda para la feature `04`.
- No se valida `version_politica_privacidad` contra un catálogo de
  versiones conocidas — ese catálogo no existe todavía (lo crea la
  feature `07`). Se valida solo como string no vacío con longitud
  máxima.
- No se agrega ningún framework de testing nuevo como dependencia: se
  usa el test runner nativo de Node (`node --test`, disponible en Node
  ≥18) para los tests unitarios de esta feature, evitando sumar
  dependencias de build no pedidas por `AGENTS.md`. La integración de
  estos tests a CI (ver criterio dedicado) tampoco agrega un framework
  nuevo: solo instala el runtime Node en el runner y ejecuta `npm test`.
- No se agrega linting, cobertura de código ni `npm audit` al pipeline
  de CI en esta feature — el criterio de CI de esta feature se limita a
  ejecutar los tests Node nuevos junto a los de pytest existentes.

## Contexto

`AGENTS.md` define el backend objetivo: funciones Serverless de Node.js
en Vercel, endpoint principal `POST /api/leads` dentro de `api/`, base
de datos Supabase Postgres con escritura exclusiva desde el backend vía
`service_role`. Las features `01` (variables de entorno) y `02` (tabla
`leads` con RLS) ya dejaron la base lista: la tabla existe con sus
constraints, y las variables `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` están
documentadas en `.env.example`. Esta feature es la primera pieza de
**código de aplicación** del repo: hasta ahora todo era estático
(HTML/CSS/JS sin build) o declarativo (SQL, `.env.example`). Introduce
el primer `package.json`, la primera dependencia npm real
(`@supabase/supabase-js`) y el primer código server-side ejecutable.

Sin este endpoint, ningún lead real llega a Supabase — el gap más
crítico del sitio (formulario simulado) sigue sin resolverse hasta que
además se complete la feature `08`, pero `03` es el primer paso
indispensable: sin el endpoint no hay nada a lo que conectar el
formulario después.

Además, `.github/workflows/ci.yml` (verificado en el repo actual) hoy
solo tiene un job (`test`) que instala Python 3.12 y corre `pytest -v`
sobre `tests/` (los tests del circuito agéntico, no de producto). Como
esta feature introduce el primer código de aplicación real con tests
propios, el mismo pipeline debe correr también esos tests — de lo
contrario "CI verde" (gate obligatorio de `AGENTS.md`, paso 7) certificaría
un pipeline que nunca ejecutó ni una sola vez el código nuevo.

## Criterios de aceptación

### Contrato del endpoint

1. Existe `api/leads.js`, exporta un handler Node.js (`module.exports`)
   que responde a `POST /api/leads`.
2. Cualquier método distinto de `POST` (`GET`, `PUT`, `PATCH`, `DELETE`,
   etc.) devuelve `405` con header `Allow: POST` y cuerpo JSON de error
   sin detalles internos.
3. **Orden de evaluación de validaciones** (resuelve la ambigüedad
   señalada en `audit-2.md` sobre qué código de error responde un body
   que dispara más de una condición de error a la vez): el servidor
   evalúa las validaciones en este orden estricto y responde con el
   primer error que encuentre, sin evaluar los pasos restantes:
   1. Método HTTP (criterio 2) → `405`.
   2. `Content-Type` (criterio 4) → `400 (content_type_invalido)`.
   3. Tamaño del body (criterio 14) → `413`.
   4. Validez del JSON (criterio 5) → `400 (json_invalido)`.
   5. Propiedades desconocidas / whitelist (criterio 6) →
      `400 (propiedad_desconocida)`.
   6. Presencia de campos obligatorios, **sin incluir**
      `consentimiento_privacidad` (`nombre`, `email`,
      `version_politica_privacidad`; criterio 7) →
      `400 (campo_requerido_faltante)`.
   7. Tipos de los campos presentes, **sin incluir**
      `consentimiento_privacidad` (criterio 9) → `400 (tipo_invalido)`.
   8. Formatos (`email`, criterio 10; `telefono`, criterio 11) y
      longitudes máximas (criterio 12) →
      `400 (formato_email_invalido)` / `400 (formato_telefono_invalido)`
      / `400 (longitud_excedida)`.
   9. `consentimiento_privacidad` (criterio 15: ausente, `false`, o tipo
      no-booleano) → `400 (consentimiento_requerido)`. Este paso queda
      deliberadamente al final y fuera de los pasos 6 y 7 (ver la
      excepción explícita en ambos criterios): así, un body con
      `nombre` faltante y `consentimiento_privacidad` faltante a la vez
      responde `400 (campo_requerido_faltante)` por `nombre` (resuelto
      en el paso 6), sin llegar nunca a evaluar el paso 9.

   Ejemplo concreto: un body con una propiedad desconocida `role` y sin
   `nombre` responde `400 (propiedad_desconocida)` (paso 5), no
   `400 (campo_requerido_faltante)`, porque el paso 5 se evalúa antes
   que el paso 6.
4. Validación de `Content-Type`: se acepta la solicitud si el tipo MIME
   del header `Content-Type`, **ignorando cualquier parámetro adicional
   como `charset`** (ej. `application/json; charset=utf-8` es válido,
   igual que `application/json` a secas), es exactamente
   `application/json` tras normalizar a minúsculas y recortar espacios.
   Regla de implementación: tomar la porción del header antes del primer
   `;`, hacer `trim().toLowerCase()`, y comparar por igualdad estricta
   contra `"application/json"`. Cualquier otro valor (incluyendo header
   ausente, `text/plain`, `multipart/form-data`, o `application/json+ld`)
   → `400` con código de error explícito (`content_type_invalido`).
5. Si el body no es JSON válido (parseo falla), devuelve `400`
   (`json_invalido`).
6. El endpoint reconoce exactamente estas claves en el body:
   `nombre`, `email`, `telefono`, `servicio`, `mensaje`,
   `consentimiento_privacidad`, `version_politica_privacidad`.
   Cualquier clave adicional presente en el body → rechazo total de la
   solicitud con `400` (`propiedad_desconocida`), no se ignora ni se
   descarta el campo extra silenciosamente.
7. Campos obligatorios: `nombre`, `email`, `consentimiento_privacidad`,
   `version_politica_privacidad`. Ausencia de cualquiera de estos →
   `400` (`campo_requerido_faltante`, identificando el campo),
   **excepto `consentimiento_privacidad`**: su ausencia no se evalúa en
   este criterio ni produce `campo_requerido_faltante` — sigue
   exclusivamente la regla del criterio 15, que responde siempre
   `400 (consentimiento_requerido)` en cualquier escenario de falla del
   campo (ausente, `false`, o tipo no-booleano). Ver también el orden de
   evaluación del criterio 3.
8. Campos opcionales: `telefono`, `servicio`, `mensaje`. Si están
   ausentes, se insertan como `null` (la tabla los permite `NULL`).
   **Regla explícita para el caso de string vacío tras `trim()`**: si
   alguno de estos tres campos está *presente* en el body pero su valor,
   luego de aplicarle `trim()`, resulta en una cadena vacía (ej.
   `telefono: "   "`, `servicio: ""`, `mensaje: "\n\t"`), se trata
   **exactamente igual que si el campo estuviera ausente**: se inserta
   `null`, nunca la cadena vacía `""`. Esta regla aplica solo a estos
   tres campos opcionales; los campos obligatorios de tipo string
   (`nombre`, `version_politica_privacidad`) siguen la regla del
   criterio 12 (vacío tras `trim()` → `400 campo_requerido_faltante`, no
   se insertan como `null` porque son obligatorios).
9. Validación de tipos: `nombre`, `email`, `telefono`, `servicio`,
   `mensaje`, `version_politica_privacidad` deben ser `string`. Tipo
   incorrecto (ej. número, objeto, array, `null` explícito en un campo
   string obligatorio) → `400` (`tipo_invalido`). **`consentimiento_privacidad`
   queda fuera del alcance de este criterio**: aunque conceptualmente
   debe ser `boolean`, cualquier tipo incorrecto en este campo (ej.
   string `"true"`, número, `null`) no produce `tipo_invalido` — sigue
   exclusivamente la regla del criterio 15, que responde siempre
   `400 (consentimiento_requerido)`. Ver también el orden de evaluación
   del criterio 3.
10. Validación de formato de `email`: debe cumplir un patrón razonable de
    email (usuario@dominio.tld); si no, `400`
    (`formato_email_invalido`).
11. Validación de formato de `telefono` (si está presente y no vacío
    tras `trim()` — ver criterio 8): solo dígitos, espacios, `+`, `-`,
    paréntesis, longitud 6–30 caracteres tras trim; si no cumple, `400`
    (`formato_telefono_invalido`).
12. Longitudes máximas (tras `trim()` en los campos string): `nombre`
    2–150 caracteres, `email` hasta 254 caracteres, `telefono` hasta 30
    caracteres, `servicio` hasta 100 caracteres, `mensaje` hasta 2000
    caracteres, `version_politica_privacidad` 1–50 caracteres.
    Excederlas o, en el caso de `nombre`/`version_politica_privacidad`,
    quedar vacío tras `trim()` → `400` (`longitud_excedida` o
    `campo_requerido_faltante` según corresponda).
13. `servicio` se valida solo por tipo/longitud, **no** contra una lista
    fija de valores — decisión explícita para no acoplar el backend al
    texto exacto de las opciones del `<select>` actual de `index.html`,
    que puede cambiar con el rediseño (ítem `09`).
14. Tamaño total del body: una solicitud cuyo payload supera 10 KB
    (10240 bytes) devuelve `413`, sin necesidad de parsear/validar el
    contenido JSON primero. **Nota de implementación obligatoria**: las
    Serverless Functions de Vercel con runtime Node.js parsean
    automáticamente `req.body` cuando `Content-Type` es
    `application/json`, lo que interferiría con medir el tamaño crudo
    del payload antes de parsear. El handler debe deshabilitar
    explícitamente ese auto-parseo (ej. `export const config = { api: {
    bodyParser: false } }`, o el mecanismo equivalente vigente en la
    versión del runtime de Vercel usada) y leer el stream/buffer crudo
    de la request, acumulando bytes y cortando con `413` en cuanto se
    supere el límite de 10240 bytes, **antes** de invocar `JSON.parse`
    sobre el contenido acumulado.
15. `consentimiento_privacidad` debe ser exactamente `true` para que la
    solicitud continúe. Si es `false`, si falta, o si no es booleano →
    `400` (`consentimiento_requerido`), y el lead **no se inserta**.
    **Este es el único criterio que determina el código de error para
    `consentimiento_privacidad` en cualquier escenario de falla**
    (ausente, `false`, tipo no-booleano): los criterios 7 y 9 excluyen
    explícitamente este campo de sus reglas generales para evitar
    cualquier ambigüedad (ver también el orden de evaluación del
    criterio 3).
16. Con datos válidos y consentimiento `true`: se inserta un registro en
    la tabla `leads` de Supabase (vía `@supabase/supabase-js`,
    inicializado con `NEXT_PUBLIC_SUPABASE_URL` +
    `SUPABASE_SERVICE_ROLE_KEY`, exclusivamente server-side, nunca
    expuesto en el bundle de frontend ni en logs) mapeando:
    `nombre`→`nombre`, `email`→`email`, `telefono`→`telefono` (o
    `null`), `servicio`→`servicio` (o `null`), `mensaje`→`mensaje` (o
    `null`), `consentimiento_privacidad`→`consentimiento_privacidad`,
    `version_politica_privacidad`→`version_politica_privacidad`. No se
    envían `estado`, `origen`, `notificacion_clinica_enviada`,
    `confirmacion_paciente_enviada`, `fecha_creacion` ni
    `fecha_actualizacion`: se dejan los defaults de la migración (`02`).
17. Inserción exitosa → `201` con cuerpo JSON mínimo (ej. `{ "id":
    "<uuid>" }`), sin devolver ninguna otra columna ni metadata de
    Supabase.
18. Rate limiting best-effort: un límite en memoria (a nivel de módulo,
    por proceso/instancia) de máximo 5 solicitudes por IP cada 60
    segundos (IP tomada de `x-forwarded-for`, con fallback documentado
    si no está presente). Al superarse, devuelve `429` con header
    `Retry-After` (segundos restantes) y cuerpo JSON
    (`demasiadas_solicitudes`). Documentado explícitamente como
    provisional (ver "Riesgos / supuestos").
19. Cualquier error no controlado (fallo de conexión a Supabase, excepción
    inesperada) → `500` con cuerpo JSON genérico (`error_interno`), sin
    stack trace, sin mensaje de error de Postgres/Supabase, sin
    filename ni línea de código. El detalle real se loguea solo
    server-side (consola de Vercel), nunca en la respuesta HTTP.
20. Ninguna respuesta (éxito o error) incluye
    `SUPABASE_SERVICE_ROLE_KEY`, credenciales SMTP, ni ningún valor de
    `.env` en el cuerpo, headers o logs accesibles al cliente.
21. Los archivos auxiliares del endpoint (ej. `api/_lib/supabase-client.js`,
    `api/_lib/sanitize-html.js`) viven bajo un subdirectorio con prefijo
    `_` dentro de `api/`, para que Vercel no los exponga como rutas
    públicas adicionales (convención de exclusión de routing).
22. `escapeHtml()` (en `api/_lib/sanitize-html.js`) neutraliza al menos
    `& < > " ' /` y tiene tests unitarios propios que prueban que texto
    con `<script>`, comillas y `&` queda escapado correctamente. No se
    invoca desde ningún flujo de envío de email en esta feature (no
    existe ese flujo todavía).
23. El handler de Supabase permite inyectar un cliente de prueba (patrón
    de fábrica/dependency injection), de forma que los tests unitarios
    puedan simular inserciones exitosas y fallidas sin una conexión real
    a un proyecto Supabase.
24. Existe `package.json` en la raíz del repo con `@supabase/supabase-js`
    como dependencia, y `.gitignore` excluye `node_modules/`.

### Integración con CI (obligatorio — corrige el gap de `audit-1.md`)

25. `.github/workflows/ci.yml` se actualiza para que el mismo workflow
    que hoy ejecuta `pytest -v` (job `test`, verificado en el repo
    actual: instala Python 3.12 con `actions/setup-python`, corre
    `pip install -r requirements-dev.txt` y luego `pytest -v`) también
    instale Node.js y ejecute los tests Node de esta feature, de forma
    que "CI verde" (gate obligatorio de `AGENTS.md`, paso 7) certifique
    ambas suites. Concretamente:
    - Se agrega un paso con `actions/setup-node@v4` (u otra versión
      estable equivalente) fijando `node-version: '20'` (o cualquier
      valor ≥18, coherente con el supuesto de runtime documentado en
      "Riesgos / supuestos"), ya sea dentro del job `test` existente o
      en un job nuevo dentro del mismo archivo `ci.yml` — cualquiera de
      las dos estructuras es aceptable siempre que corra en el mismo
      workflow y bloquee el mismo gate.
    - Se agrega un paso que instale las dependencias Node del repo (ej.
      `npm ci` si se commitea `package-lock.json`, o `npm install` si
      no) antes de correr los tests.
    - `package.json` define un script `"test": "node --test"` (el
      test runner nativo de Node descubre por defecto los archivos que
      matchean el patrón `**/*.test.js`, entre otros). Los tests de esta
      feature deben nombrarse siguiendo ese patrón y ubicarse junto al
      código que prueban, ej. `api/_lib/sanitize-html.test.js` (tests
      del criterio 22) y `api/leads.test.js` (tests del handler con
      cliente Supabase inyectado, criterios 23 y siguientes del
      contrato).
    - Se agrega un paso que ejecute `npm test`.
    - El job/los pasos nuevos deben fallar (exit code distinto de 0) si
      cualquier test Node falla, igual que ya ocurre con `pytest -v` —
      es decir, un test roto en `api/leads.test.js` o en
      `sanitize-html.test.js` debe poner en rojo el mismo check de CI
      que hoy bloquea el merge.
    - No se elimina ni se debilita el paso existente de `pytest`: ambos
      conjuntos de tests (Python del circuito, Node de producto) deben
      correr y aprobar en el mismo pipeline para que el check de CI se
      considere verde.

### Documentación y artefactos del circuito (obligatorios sin excepción)

26. Debe existir `docs/tecnica/endpoint-recepcion-leads.md`, no vacío,
    con: el contrato exacto del endpoint (campos, tipos, límites,
    códigos de error, incluida la regla de `Content-Type` con/sin
    charset, la regla de campos opcionales vacíos tras `trim()`, el
    orden de evaluación de validaciones del criterio 3, y la regla
    especial de `consentimiento_privacidad` del criterio 15), el mapeo
    campo→columna, la explicación del rate limiting best-effort y sus
    limitaciones, por qué `servicio`/`version_politica_privacidad` no se
    validan contra una lista fija, la necesidad de deshabilitar el
    auto-parseo del body para poder medir el tamaño crudo antes de
    `JSON.parse`, y cómo se ejecutan los tests Node en CI (referencia al
    job/paso agregado en `.github/workflows/ci.yml`).
27. Debe existir `docs/usuario/endpoint-recepcion-leads.md`, no vacío,
    explicando qué hace el endpoint, cómo probarlo manualmente (ej.
    `curl`/Postman contra `/api/leads` en local con `vercel dev`), y qué
    respuestas esperar.
28. Debe existir `docs/tecnica/arquitectura.md`, no vacío, documentando
    la decisión de incorporar el primer backend Node.js y la primera
    dependencia npm (`@supabase/supabase-js`) al repo, en cumplimiento
    de la regla de dominio de `AGENTS.md` sobre decisiones explícitas de
    arquitectura.
29. `runs/03-endpoint-recepcion-leads/decision.md` existe, con
    decisiones demostrables desde spec/auditoría/implementación (no
    ornamental).
30. Hay enlaces exactos agregados en `docs/tecnica/index.md` y
    `docs/usuario/index.md` para `endpoint-recepcion-leads.md` (y, si no
    estaba ya enlazado, para `arquitectura.md` en `docs/tecnica/index.md`).

## Casos borde a contemplar

- Campo obligatorio ausente (`nombre`, `email` o
  `version_politica_privacidad` faltante) → `400` (`campo_requerido_faltante`).
  La ausencia de `consentimiento_privacidad` se trata por separado más
  abajo, con código `consentimiento_requerido` (ver criterio 15), **no**
  `campo_requerido_faltante` (ver criterio 7).
- Tipo incorrecto: `nombre` numérico → `400` (`tipo_invalido`);
  `mensaje` como array/objeto → `400` (`tipo_invalido`);
  `consentimiento_privacidad` como string `"true"` en vez de booleano →
  `400` (`consentimiento_requerido`, ver criterio 15, **no**
  `tipo_invalido` — ver criterio 9).
- `email` con formato inválido (`"no-es-un-email"`, sin `@`, sin dominio)
  → `400`.
- `telefono` con letras o formato claramente inválido (si se envía) →
  `400`.
- `consentimiento_privacidad: false` → `400` (`consentimiento_requerido`),
  lead **no** insertado.
- `consentimiento_privacidad` ausente → `400` (`consentimiento_requerido`),
  mismo tratamiento que `false` (nunca se asume `true` por default; ver
  criterio 15, no el criterio 7 de campos obligatorios).
- Propiedad extra desconocida en el body (ej. `role: "admin"`,
  `estado: "confirmado"` inyectado por el cliente) → `400`, solicitud
  rechazada completa (previene que el cliente intente setear columnas
  que solo debe controlar el servidor, como `estado` o los flags de
  notificación).
- Body vacío (`{}`) → `400` por campos requeridos faltantes (`nombre`
  es el primero evaluado según el orden del criterio 3, paso 6; nunca
  llega a evaluarse el paso 9 de `consentimiento_privacidad`).
- Body con una propiedad desconocida (ej. `role`) y además sin `nombre`
  → `400` (`propiedad_desconocida`), no `campo_requerido_faltante` — ver
  el ejemplo del criterio 3 (paso 5 se evalúa antes que el paso 6).
- Body malformado (JSON inválido, ej. una coma de más) → `400`.
- `Content-Type: text/plain` o `multipart/form-data` → `400`.
- `Content-Type: application/json; charset=utf-8` (con parámetro de
  charset) → **aceptado**, se procesa igual que `application/json` a
  secas (ver criterio 4). `Content-Type: application/json-patch+json` u
  otro subtipo distinto → `400`, no matchea la igualdad estricta contra
  `application/json`.
- `telefono: "   "`, `servicio: ""` o `mensaje: "\n"` (presentes pero
  vacíos tras `trim()`) → se insertan como `null`, no como cadena vacía
  (ver criterio 8). Distinto de `nombre: "   "`, que es obligatorio y
  produce `400 campo_requerido_faltante`.
- Payload > 10 KB (ej. un `mensaje` artificialmente gigante o miles de
  propiedades extra) → `413`, medido sobre el tamaño crudo del body
  (bytes recibidos en el stream), no sobre el JSON ya parseado, y
  evaluado antes que la validez del JSON (ver criterio 3, pasos 3 y 4).
- Método `GET`/`PUT`/`PATCH`/`DELETE`/`HEAD` contra `/api/leads` → `405`
  con `Allow: POST`.
- Ráfaga de solicitudes válidas desde la misma IP dentro de la ventana
  configurada → a partir de la 6ª solicitud en 60 segundos, `429` con
  `Retry-After`.
- Fallo simulado de Supabase (cliente inyectado en tests que rechaza el
  insert) → `500`, sin exponer el mensaje de error de Postgres/Supabase
  en la respuesta.
- `nombre`/`mensaje` con contenido tipo `<script>alert(1)</script>` o
  comillas/ampersands: se acepta y se inserta tal cual en Supabase (no
  se sanitiza el dato almacenado — el escape es responsabilidad del
  renderizado futuro en email, no de la persistencia); pero
  `escapeHtml()` sobre ese mismo valor debe neutralizarlo correctamente
  en sus tests unitarios.
- Espacios en blanco al inicio/final de `nombre`/`email`/`version_politica_privacidad`:
  se recortan (`trim()`) antes de validar longitud y antes de insertar.
- Caracteres Unicode/emoji en `nombre`/`mensaje`: no deben romper la
  validación de longitud ni la inserción (se documenta que la longitud
  se mide en unidades UTF-16 de JavaScript, no en grafemas visuales —
  limitación conocida y aceptada).
- Solicitudes concurrentes desde instancias serverless distintas: el
  limitador en memoria de la feature `03` **no** las ve como la misma
  IP/contador de forma confiable entre instancias frías — se documenta
  como limitación conocida, no como bug.
- Un test Node (`node --test`) que falla en `api/leads.test.js` o en
  `api/_lib/sanitize-html.test.js` debe poner en rojo el check de CI de
  la PR (verificable ejecutando `npm test` localmente y confirmando el
  exit code, y verificable en el pipeline de GitHub Actions una vez
  agregado el paso — ver criterio 25).

## Riesgos / supuestos

- **Rate limiting best-effort, no robusto**: el límite en memoria por
  proceso/instancia no persiste entre cold starts de Vercel ni se
  comparte entre instancias concurrentes. Es suficiente para cumplir
  con "implementar respuestas controladas para... 429" (lo que pide el
  ítem `03` del roadmap) y para que sea verificable en tests unitarios
  (llamando al handler repetidamente dentro del mismo proceso), pero
  **no** es la protección real contra abuso — eso es explícitamente el
  alcance completo de la feature `04-proteccion-antispam-y-abuso`
  (almacenamiento persistente/distribuido, validación de origen,
  campo trampa, CAPTCHA, idempotencia). El reviewer puede objetar esta
  división si prefiere que `03` no incluya rate limiting en absoluto y
  quede 100% en `04` — se optó por incluirlo de forma mínima porque el
  ítem `03` del roadmap lo menciona explícitamente como código de
  respuesta a implementar.
- **Límites de longitud y tamaño de payload son un supuesto propio**:
  ningún documento previo especifica límites exactos de caracteres por
  campo ni el tope de 10 KB para el body. Se eligieron valores holgados
  pero conservadores (ej. `nombre` hasta 150, `mensaje` hasta 2000, body
  hasta 10 KB) razonables para un formulario de contacto. El reviewer
  puede ajustar estos números si el negocio real tiene otro requisito.
- **`servicio` sin validación de enum**: se decidió no acoplar el
  backend a los 4 valores actuales del `<select>` de `index.html`
  (`implantes`, `ortodoncia`, `blanqueamiento`, `otro`) porque ese texto
  es contenido de marketing sujeto a cambiar en la feature `09`
  (rediseño). Si el reviewer prefiere validación estricta contra esos 4
  valores, es un cambio menor a este spec.
- **`version_politica_privacidad` sin catálogo de versiones válidas**:
  la política de privacidad todavía no existe (feature `07`). Se valida
  solo como string no vacío con longitud máxima; la validación contra
  versiones conocidas queda para cuando `07` defina el esquema de
  versionado.
- **No hay proyecto Supabase real conectado en este entorno de
  desarrollo/CI** (mismo riesgo que ya documentó la feature `02`). La
  verificación de la inserción real se hace con un cliente Supabase
  inyectable/mockeable en tests unitarios, no contra un proyecto
  Supabase en vivo. Queda como verificación pendiente en Preview/Production
  cuando el humano tenga el proyecto real conectado (ver `docs/usuario/`
  de esta feature y de `02`).
- **Runtime Node.js asumido ≥18** (para `node --test` nativo y sintaxis
  moderna): no hay ninguna declaración previa en el repo del runtime
  exacto de Vercel a usar. Se documenta como supuesto; si Vercel exige
  otra versión, es un ajuste de `package.json#engines`, no del diseño
  del endpoint. El criterio 25 fija `node-version: '20'` en CI como
  valor concreto dentro de ese rango ≥18 — ajustable por el reviewer o
  el builder si Vercel especifica otra versión LTS.
- **No se agrega manejo de CORS explícito**: se asume que el endpoint
  solo se invoca desde el mismo origen del sitio (comportamiento por
  defecto). La validación de origen queda explícitamente para la
  feature `04`.
- **Frontend no tocado en esta feature**: decisión explícita y
  justificada arriba (ver "Fuera de alcance"). Riesgo aceptado: hasta
  que se completen `07` y `08`, el endpoint existe y es funcional pero
  ningún usuario real lo alcanza todavía a través del sitio — es
  intencional, no un olvido.
- **Estructura del job/paso nuevo en `ci.yml` como decisión de
  implementación abierta**: el criterio 25 exige el resultado (Node
  instalado, `npm test` ejecutado, mismo workflow, mismo gate) pero deja
  al builder-agent elegir si lo agrega como pasos adicionales dentro del
  job `test` existente o como un job Node separado dentro del mismo
  archivo. Ambas estructuras cumplen igual el objetivo del circuito («CI
  verde» cubre ambas suites); se documenta como grado de libertad
  intencional, no como ambigüedad sin resolver.
- **`package-lock.json` no existe todavía en el repo**: como esta
  feature introduce el primer `package.json`, no hay lockfile previo. Se
  asume que el builder-agent generará `package-lock.json` al instalar
  `@supabase/supabase-js` y lo commiteará junto con `package.json`, para
  que el paso de CI pueda usar `npm ci` (instalación reproducible) en
  vez de `npm install`. Si el builder decide no commitear el lockfile,
  el paso de CI debe usar `npm install` en su lugar — cualquiera de las
  dos opciones satisface el criterio 25, pero `npm ci` + lockfile
  commiteado es la opción preferida por ser reproducible.
- **Orden de evaluación de validaciones (criterio 3) es una decisión de
  diseño nueva de este intento**: ningún documento previo especificaba
  un orden. Se eligió el orden sugerido por el reviewer en `audit-2.md`
  (método → Content-Type → tamaño → JSON válido → propiedades
  desconocidas → campos obligatorios → tipos → formatos/longitudes →
  consentimiento) por ser el más natural de implementar (valida lo más
  barato/rápido primero: headers antes que parsear, parsear antes que
  inspeccionar campos) y porque resuelve sin ambigüedad el caso de
  `consentimiento_privacidad` descrito en los criterios 7, 9 y 15. El
  reviewer puede objetar el orden específico si prefiere otra secuencia,
  pero cualquier objeción debe mantener la propiedad esencial: un orden
  determinista, documentado, que un test pueda verificar exactamente.
