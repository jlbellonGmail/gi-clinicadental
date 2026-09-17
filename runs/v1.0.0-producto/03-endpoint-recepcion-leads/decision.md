# Decision: 03-endpoint-recepcion-leads - Endpoint de recepción de leads

## Estado

Implementación completa según `runs/03-endpoint-recepcion-leads/spec.md`
(aprobado en `audit-3.md`, intento 3, `status: approved`). Lista para
que QA valide antes de `READY_FOR_PR`.

## Evidencias revisadas

- `runs/03-endpoint-recepcion-leads/spec.md` (30 criterios de aceptación)
- `runs/03-endpoint-recepcion-leads/audit-1.md`, `audit-2.md`, `audit-3.md`
- `api/leads.js`, `api/_lib/supabase-client.js`, `api/_lib/sanitize-html.js`
- `api/leads.test.js` (71 tests), `api/_lib/sanitize-html.test.js` (9 tests)
- `npm test` local: 71 + 9 = 80 tests, 0 fallos

## Decisiones demostrables

- **Orden completo de 9 pasos del criterio 3** implementado literalmente
  en `api/leads.js` (método → Content-Type → tamaño de body → JSON
  válido → whitelist → campos obligatorios → tipos → formatos/longitudes
  → `consentimiento_privacidad`), con un comentario en el código que
  referencia el número de criterio correspondiente a cada bloque.
- **Rate limiting (criterio 18) ubicado fuera de los 9 pasos numerados**:
  el spec no lo incluye en la lista ordenada del criterio 3 (esa lista
  cubre solo validaciones de contenido del body). Se decidió evaluarlo
  inmediatamente después de confirmar el método `POST` y antes de leer
  el body — razón: (a) no gastar ciclos leyendo/parseando contenido de
  un cliente ya limitado, y (b) que una ráfaga de solicitudes con body
  inválido/malicioso también cuente contra el límite (protege igual
  contra "basura" que contra solicitudes bien formadas). Documentado en
  `docs/tecnica/endpoint-recepcion-leads.md`.
- **Sub-orden dentro del paso 8 (formatos/longitudes)**, que `audit-3.md`
  dejó explícitamente abierto como observación no bloqueante: se resolvió
  con longitud evaluada antes que formato dentro de cada campo (siguiendo
  la sugerencia textual del propio reviewer), en el orden de campos
  nombre → email → telefono → version_politica_privacidad → servicio →
  mensaje. Verificado con un test dedicado
  (`api/leads.test.js`, "email invalido y demasiado largo a la vez ->
  gana longitud_excedida").
- **`null` explícito en campos opcionales (telefono/servicio/mensaje)**
  tratado como equivalente a ausente (se inserta `null`, no dispara
  `tipo_invalido`), a diferencia de los campos obligatorios (nombre,
  email, version_politica_privacidad) donde `null` explícito sí dispara
  `tipo_invalido`. El spec no lo aclaraba de forma inequívoca para
  campos opcionales; se documentó la interpretación y su justificación
  (columna nullable en Supabase, convención común en APIs JSON) en
  `docs/tecnica/endpoint-recepcion-leads.md`.
- **Auto-parseo de body deshabilitado** vía
  `module.exports.config = { api: { bodyParser: false } }` (equivalente
  CommonJS de la nota de implementación obligatoria del criterio 14,
  dada en el spec como ejemplo ESM). `readRawBody()` acumula bytes del
  stream crudo y corta con `413` antes de `JSON.parse`, con un atajo
  adicional (no exigido por el spec) que corta de inmediato si
  `Content-Length` ya declara un tamaño mayor al límite.
- **Dependency injection completa para tests** (criterio 23, ampliada más
  allá de lo mínimo pedido): `createHandler({ supabaseClientFactory,
  rateLimitStore, now, maxBodyBytes })` permite testear rate limiting
  (incluyendo el reseteo de la ventana de 60s) sin depender de
  temporizadores reales ni compartir estado entre tests.
- **`escapeHtml()` no se invoca desde ningún flujo real** (criterio 22):
  queda como utilidad standalone en `api/_lib/sanitize-html.js`, testeada
  de forma aislada, para que las features `05`/`06` la consuman cuando
  exista el flujo de Nodemailer.
- **Estructura de CI (criterio 25)**: se optó por agregar los pasos Node
  dentro del job `test` existente (en vez de un job separado), porque
  ambas suites son rápidas y no hay necesidad de paralelizarlas —
  mantiene el pipeline simple y el gate de CI como un único check. Se
  preservó el paso `pytest -v` intacto, sin modificarlo.
- **`docs/tecnica/arquitectura.md` creado por primera vez** (criterio 28,
  regla de dominio de `AGENTS.md`): documenta la decisión de incorporar
  el primer backend Node.js y la primera dependencia npm
  (`@supabase/supabase-js`) al repo, incluyendo por qué no se agregó un
  framework de servidor adicional y por qué se usó el test runner nativo
  de Node en vez de sumar una dependencia de testing.
- **`package-lock.json` commiteado** (generado con `npm install`),
  permitiendo que CI use `npm ci` (instalación reproducible), tal como
  el spec documenta como opción preferida en "Riesgos/supuestos".

## Cobertura de casos borde verificada con tests

Los 80 tests (`api/leads.test.js` + `api/_lib/sanitize-html.test.js`)
cubren explícitamente: método inválido (405 para GET/PUT/PATCH/DELETE/
HEAD), Content-Type ausente/inválido/con charset/con subtipo distinto,
payload >10KB, JSON malformado y JSON válido no-objeto, propiedad
desconocida (sola y combinada con campo faltante), cada campo
obligatorio faltante, tipos incorrectos (número, array, objeto, `null`
en campo obligatorio), `consentimiento_privacidad` en sus 3 variantes de
falla (ausente, `false`, tipo no-booleano) verificando en cada caso que
NO se llama a `insert()`, formato de email/teléfono inválido, longitudes
excedidas en los 6 campos con longitud, campos opcionales vacíos tras
`trim()` → `null`, contenido `<script>`/comillas/`&` aceptado tal cual
en la inserción (sin sanitizar, por diseño), Unicode/emoji sin romper
validación, éxito 201 con solo `{ id }`, columnas server-controladas
(`estado`, `origen`, flags, fechas) nunca enviadas al insert, fallo
simulado de Supabase → 500 sin filtrar el mensaje de error, excepción al
inicializar el cliente Supabase → 500 sin filtrar el nombre de la
variable de entorno, rate limiting (6ta solicitud → 429 con
`Retry-After`, IPs distintas no comparten contador, reseteo tras 60s con
reloj inyectado, fallback a `remoteAddress` sin `x-forwarded-for`), y
ausencia de texto de credenciales en cualquier respuesta.

## Resultado

La feature queda apta para que QA la valide (`npm test`, `pytest -v`,
`Assert-FeatureContract`) antes de pasar a `READY_FOR_PR`.
