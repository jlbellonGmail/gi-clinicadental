---
status: approved
attempt: 1
feedback: []
---

# QA Report — 03-endpoint-recepcion-leads (intento 1)

## Resumen del veredicto

`approved`. La implementación cumple los 30 criterios de aceptación del
spec (`runs/03-endpoint-recepcion-leads/spec.md`, aprobado en `audit-3.md`),
incluyendo los puntos de mayor riesgo señalados para esta verificación
(orden de evaluación de las 9 validaciones, las 3 variantes de falla de
`consentimiento_privacidad`, medición de tamaño de payload sobre bytes
crudos, mapeo campo→columna, no filtrado de secretos/errores internos,
`escapeHtml()`, y la integración de `npm test` en CI). No hay feedback
bloqueante.

## 1. Tests ejecutados por el QA (no solo confiados del builder)

### `npm test` (Node, `node --test`)

Ejecutado desde `D:\proyectos\worktrees\03-endpoint-recepcion-leads`:

```
node --test
...
ℹ tests 71
ℹ suites 0
ℹ pass 71
ℹ fail 0
```

`api/_lib/sanitize-html.test.js` corrió como parte del mismo `npm test`
(9 tests de `escapeHtml`, visibles al inicio del output real). Total real
observado: **71 (api/leads.test.js) + 9 (sanitize-html.test.js) = 80
tests, 0 fallos** — coincide exactamente con lo reportado por el builder
en `decision.md`.

### `pytest -v`

Primera corrida con la configuración por defecto de `pytest` falló con
`PermissionError` al crear el directorio base temporal
(`C:\Users\jlbel\AppData\Local\Temp\pytest-of-jlbellon`) — **problema del
entorno local de este QA (permisos de un directorio temp de una corrida
anterior), no del código de la feature**. Se repitió la corrida con
`--basetemp` apuntando a un directorio propio y escribible:

```
pytest -v --basetemp=<scratchpad>/pytest-tmp
...
24 passed in 244.45s (0:04:04)
```

Los 24 tests pasan, incluyendo `test_workflow_yaml_is_valid`
(`tests/test_feature_contract_scripts.py`), que confirma que
`.github/workflows/ci.yml` sigue siendo YAML válido después de la edición
del builder. Coincide con lo reportado por el builder (24 passed, 0
failed).

## 2. Verificación del contrato de la feature contra el spec real

Se leyó directamente `api/leads.js`, `api/_lib/sanitize-html.js`,
`api/_lib/supabase-client.js`, la migración SQL real y `.github/workflows/ci.yml`
— no solo los tests ni el resumen del builder.

- **Orden de evaluación (criterio 3, 9 pasos)**: el código de
  `api/leads.js` implementa el orden exacto documentado: método (405) →
  [rate limit, fuera del orden numerado, ver más abajo] → Content-Type
  (400 `content_type_invalido`) → tamaño de body vía `readRawBody` (413)
  → `JSON.parse` (400 `json_invalido`, incluyendo el caso "JSON válido
  pero no es objeto") → whitelist de propiedades (400
  `propiedad_desconocida`) → campos obligatorios sin
  `consentimiento_privacidad` (400 `campo_requerido_faltante`) → tipos
  sin `consentimiento_privacidad` (400 `tipo_invalido`) → formatos y
  longitudes campo por campo, nombre→email→telefono→version_politica_privacidad→servicio→mensaje
  → `consentimiento_privacidad` al final (400 `consentimiento_requerido`).
  Coincide línea por línea con el orden documentado en `docs/tecnica/endpoint-recepcion-leads.md`
  y con los comentarios `// Paso N` del propio código.

- **`consentimiento_privacidad` (criterios 7, 9, 15)**: confirmado en el
  código (línea `if (payload.consentimiento_privacidad !== true)`, único
  punto de evaluación) y en tests dedicados y separados por variante:
  `api/leads.test.js` — "consentimiento_privacidad: false", "...ausente",
  "...tipo no-booleano (numero)" — las 3 responden `400
  consentimiento_requerido` y verifican explícitamente
  `supabaseClient.calls.length === 0` (no se llama a `insert()`). También
  hay tests que confirman que la ausencia/tipo incorrecto de este campo
  específicamente **no** dispara `campo_requerido_faltante` ni
  `tipo_invalido` (los otros dos códigos con los que podría confundirse).
  Cobertura suficiente; no fue necesario escribir un test adicional.

- **Límite de payload de 10 KB (criterio 14)**: `module.exports.config =
  { api: { bodyParser: false } }` está presente al final de
  `api/leads.js`, con un test dedicado
  (`exporta config.api.bodyParser = false`) que lo verifica por
  introspección del módulo exportado — no solo por comportamiento
  indirecto. `readRawBody()` acumula bytes de un stream (`Readable`) real
  en los tests (`makeReq()` construye un `Readable` con un `Buffer`, no
  pasa un objeto JS pre-parseado) y corta con `PayloadTooLargeError` antes
  de llegar a `JSON.parse`. Medición confirmada sobre bytes crudos, no
  sobre JSON parseado.

- **Mapeo campo→columna (criterio 16)**: comparado directamente contra
  `supabase/migrations/20260819210130_create_leads_table.sql`. Las 7
  columnas insertadas (`nombre`, `email`, `telefono`, `servicio`,
  `mensaje`, `consentimiento_privacidad`, `version_politica_privacidad`)
  existen tal cual en la tabla `leads` de la migración real, y el código
  confirma explícitamente que no envía `estado`, `origen`,
  `notificacion_clinica_enviada`, `confirmacion_paciente_enviada`,
  `fecha_creacion` ni `fecha_actualizacion` (quedan los defaults de la
  migración `02`). Correcto.

- **No exposición de secretos/errores internos (criterios 19-20)**: el
  bloque `catch` de inicialización del cliente Supabase y el de `insert()`
  fallido responden siempre `{ error: 'error_interno' }` (500), logueando
  el detalle real solo vía `console.error` server-side. Test dedicado
  ("ninguna respuesta incluye texto de variables sensibles") verifica
  ausencia de los strings `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS` y
  `service_role` en la respuesta serializada (cuerpo + headers). Otro test
  confirma que aunque el cliente Supabase falle al inicializarse lanzando
  un error cuyo mensaje contiene literalmente `SUPABASE_SERVICE_ROLE_KEY`,
  ese texto nunca llega a la respuesta HTTP.

- **`escapeHtml()` (criterio 22)**: `ESCAPE_PATTERN =
  /[&<>"'/]/g` con `ESCAPE_MAP` cubre los 6 caracteres exigidos (`&`
  `<` `>` `"` `'` `/`). 9 tests en `api/_lib/sanitize-html.test.js`
  cubren `<script>`, comillas dobles/simples, `&`, `/`, texto sin
  caracteres especiales, string vacío, Unicode/emoji preservado, valores
  no-string devueltos tal cual, y una combinación de todos los caracteres
  a la vez. No se invoca desde ningún flujo de email en esta feature,
  como exige el criterio (confirmado por grep: no hay ningún `require`
  de `sanitize-html` fuera de `api/leads.test.js` y
  `sanitize-html.test.js`).

- **Rate limiting posicionado antes de Content-Type (criterio 18 y
  decisión del builder)**: confirmado en el código (`api/leads.js`, el
  bloque de rate limit corre inmediatamente después del chequeo de
  método, antes de leer el header `Content-Type`). El spec no incluye
  rate limiting dentro de los 9 pasos numerados del criterio 3 (esos
  pasos cubren solo validaciones de *contenido* del body), así que esta
  ubicación es una decisión de implementación válida y no contradice
  ningún criterio del spec. Está documentada explícitamente tanto en
  `runs/03-endpoint-recepcion-leads/decision.md` (sección "Rate limiting
  (criterio 18) ubicado fuera de los 9 pasos numerados") como en
  `docs/tecnica/endpoint-recepcion-leads.md` (paso 2 de "Orden de
  evaluación de validaciones"), con la misma justificación en ambos
  lugares. No rompe ningún test: los 71 tests de `api/leads.test.js`
  pasan, incluidos los de rate limiting (6ta solicitud → 429, IPs
  distintas no comparten contador, reseteo de ventana con reloj
  inyectado, fallback a `remoteAddress`).

## 3. Contrato común del circuito (`scripts/feature-contract.ps1`)

Se ejecutó `Assert-FeatureContract -Slug 03-endpoint-recepcion-leads
-Title "Endpoint de recepción de leads"` (dot-sourcing
`scripts/feature-contract.ps1`) y terminó sin lanzar excepción, validando:

- `runs/03-endpoint-recepcion-leads/decision.md` — no vacío.
- `runs/03-endpoint-recepcion-leads/spec.md` — no vacío.
- `docs/tecnica/endpoint-recepcion-leads.md` — no vacío (275 líneas).
- `docs/usuario/endpoint-recepcion-leads.md` — no vacío (95 líneas).
- Al menos un `audit-N.md` en `runs/03-endpoint-recepcion-leads/` — hay 3
  (`audit-1.md`, `audit-2.md`, `audit-3.md`), el más reciente `approved`.
- Al menos un `test-report-N.md` — este mismo archivo, creado antes de
  correr la verificación.
- Enlace exacto `- [Endpoint de recepción de leads](endpoint-recepcion-leads.md)`
  presente y único en `docs/tecnica/index.md` y `docs/usuario/index.md`.

Adicionalmente verificado a mano (no cubierto por el script común):

- `docs/tecnica/arquitectura.md` existe y no está vacío (97 líneas),
  documentando la primera dependencia npm y el primer backend Node.js del
  repo, con enlace exacto `- [Arquitectura](arquitectura.md)` en
  `docs/tecnica/index.md`.
- Rama actual: `feature/03-endpoint-recepcion-leads`, working tree limpio
  al momento de iniciar QA, commit `4711cfd` como base.

## 4. `package.json` / `package-lock.json` / `.gitignore`

- `package.json` existe en la raíz, `@supabase/supabase-js` como
  dependencia (`^2.45.4`), script `"test": "node --test"`,
  `engines.node: ">=18"`.
- `package-lock.json` está trackeado por git (`git ls-files
  package-lock.json` lo confirma).
- `.gitignore` excluye `node_modules/` explícitamente (sección "Node.js
  (backend serverless en api/, feature 03-endpoint-recepcion-leads)").

## 5. `.github/workflows/ci.yml`

- El paso `pytest -v` sigue presente sin modificaciones de fondo (mismo
  job `test`, mismos pasos previos de Python 3.12).
- Se agregaron, dentro del **mismo job** `test` y **después** de
  `pytest -v`: instalación de Node 20 (`actions/setup-node@v4`), `npm ci`
  y `npm test`, como pasos secuenciales del mismo job. Al ser pasos
  secuenciales de un único job de GitHub Actions, un fallo en cualquiera
  de ellos (incluyendo un test Node roto) hace fallar el job completo y
  pone en rojo el mismo check que bloquea el merge — no hay forma de que
  un test Node roto pase inadvertido.
- `tests/test_feature_contract_scripts.py::test_workflow_yaml_is_valid`
  (parte de la suite pytest ejecutada arriba) confirma adicionalmente que
  el archivo resultante es YAML válido.

## Hallazgos no bloqueantes (no ameritan rechazo)

- El nombre del test `payload justo en el limite (10240 bytes) no
  dispara 413 por si solo` es levemente engañoso: el test en sí usa un
  `maxBodyBytes` reducido a 5 KB en vez de probar el límite real de 10240
  bytes exacto, según su propio comentario ("no depender de calzar bytes
  exactos"). El comportamiento cubierto (límite relativo, no el valor
  10240 en sí) es válido y suficiente, pero el nombre podría ajustarse en
  una futura iteración para evitar confusión. No bloquea esta feature.
- El problema de `PermissionError` de `pytest` con el directorio temp
  por defecto es un artefacto de este entorno local de QA (residuo de una
  corrida anterior con permisos restringidos), no del repositorio ni del
  código de la feature; se resolvió con `--basetemp` sin tocar ningún
  archivo del repo.

## Conclusión

Los 3 puntos de la corrección del intento 3 (`audit-3.md`: contradicción
de códigos de error de `consentimiento_privacidad`, orden de evaluación
explícito, y la observación no bloqueante del sub-orden dentro del paso
8) están correctamente resueltos e implementados, con tests que los
verifican punto por punto. No se encontró código, test, documentación ni
artefacto del circuito faltante o incorrecto. Feature apta para pasar a
`READY_FOR_PR`.
