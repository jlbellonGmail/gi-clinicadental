---
status: approved
attempt: 1
feedback: []
---

# QA Report — 04-proteccion-antispam-y-abuso (intento 1)

## Resumen del veredicto

`approved`. La implementación en `api/leads.js` cumple los 23 criterios
de aceptación de `runs/04-proteccion-antispam-y-abuso/spec.md` (aprobado
en `audit-2.md`), incluyendo el orden de evaluación extendido de 12
pasos, la exclusión de `sitio_web`/`formulario_mostrado_en` de
`STRING_FIELDS`, el logging de rechazos sin PII, y la deduplicación sin
doble `INSERT`. No hay feedback bloqueante.

Verificación hecha de forma independiente (no solo confiando en el
reporte del builder-agent): lectura completa de `api/leads.js` línea por
línea contra cada criterio, ejecución propia de `npm test` y `pytest`, y
ejecución de `Assert-FeatureContract`.

## 1. Rama y estado del worktree

```
git branch --show-current
feature/04-proteccion-antispam-y-abuso
git status --short
(vacío, working tree limpio)
git log --oneline -1
7942a2b feat(api): proteccion antispam y abuso en POST /api/leads
```

## 2. Tests ejecutados por el QA

### `npm test` (Node, `node --test`)

Ejecutado desde `D:\proyectos\worktrees\04-proteccion-antispam-y-abuso`:

```
ℹ tests 107
ℹ suites 0
ℹ pass 107
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Coincide con lo reportado por el builder: 62 tests preexistentes de la
feature `03` (regresión, ninguno modificado en su expectativa de
comportamiento) + 36 nuevos de la feature `04` = 98 en
`api/leads.test.js`, más 9 de `api/_lib/sanitize-html.test.js` = 107
totales. 0 fallos.

Se identificaron explícitamente en el output los tests que cubren los
puntos más delicados exigidos por la sección "Casos de prueba esperados
para qa-agent" del spec:

- `origen invalido + rate limit ya excedido -> responde 403 (origen), no
  429 (orden extendido, criterio 1)` — combinación de dos condiciones de
  rechazo simultáneas, confirma el orden extendido.
- `duplicado detectado -> el mock falla el test si insert() se invoca mas
  de una vez` — verifica que no hay doble `INSERT`.
- `STRING_FIELDS (inspeccion de codigo) no incluye sitio_web ni
  formulario_mostrado_en` — inspección de código automatizada.
- `rechazo por origen invalido no loguea PII ni la IP en texto plano`,
  `rechazo por rate limit no loguea PII ni la IP en texto plano`,
  `rechazo por honeypot no loguea PII ni la IP en texto plano`,
  `rechazo por control temporal no loguea PII ni la IP en texto plano` —
  cuatro tests dedicados, uno por motivo de rechazo, interceptando
  `console.warn`.

### `pytest -v` (circuito agéntico, `tests/`)

Primera corrida con el `basetemp` por defecto falló con `PermissionError`
al crear `C:\Users\jlbel\AppData\Local\Temp\pytest-of-jlbellon` —
problema del entorno local de este QA (residuo de una corrida anterior
con permisos restringidos), no del repositorio ni del código de la
feature; mismo problema documentado y ya visto en
`runs/03-endpoint-recepcion-leads/test-report-1.md`. Se repitió la
corrida con `--basetemp` apuntando a un directorio propio y escribible:

```
pytest -v --basetemp=<scratchpad>/pytest-tmp
...
24 passed in 196.34s (0:03:16)
```

Los 24 tests pasan, incluyendo la suite completa de
`test_close_feature_script.py`, `test_feature_contract_scripts.py`
(incluyendo `test_workflow_yaml_is_valid`) y
`test_local_reconciler_scripts.py`. Coincide con lo reportado por el
builder (24 passed, 0 failed) y sin regresión respecto a la feature `03`.

## 3. Verificación por inspección de código, criterio por criterio

Se leyó `api/leads.js` completo (699 líneas) contra cada uno de los 23
criterios de aceptación del spec, no solo los nombres de los tests.

- **Criterio 1 (orden de evaluación extendido)**: confirmado línea por
  línea en `leadsHandler`: método (405) → origen (`getEffectiveOrigin` +
  `isOriginAllowed`, 403) → rate limit (`checkRateLimit`, 429) →
  Content-Type (400) → tamaño de body vía `readRawBody` (413) →
  `JSON.parse` (400) → whitelist de propiedades incluyendo los dos campos
  nuevos (400) → honeypot `sitio_web` (400 `solicitud_rechazada`) →
  control temporal `formulario_mostrado_en` (400 `solicitud_rechazada`)
  → campos obligatorios/tipos/formatos/longitudes/consentimiento de la
  feature `03` sin cambios → chequeo de duplicados (`.select().ilike()
  .eq().gte().limit(1)`, 201 sin insertar) → `INSERT` normal (201). El
  orden en el código coincide exactamente con los 12 pasos documentados
  en el spec y en `docs/tecnica/proteccion-antispam-y-abuso.md`.
- **Criterios 2-4 (validación de origen)**: `getEffectiveOrigin()` toma
  `Origin`, cae a `Referer` parseado con `new URL()` (protocolo+host),
  trata `Referer` no parseable o ausencia de ambos como origen nulo.
  `isOriginAllowed()` compara por igualdad exacta contra `SITE_URL`,
  cada entrada de `ALLOWED_ORIGINS` (parseada con `trim()` por entrada,
  tolerando espacios alrededor de las comas) y
  `https://${VERCEL_URL}` cuando está definida. Confirmado por 9 tests
  específicos de origen, todos pasando.
- **Criterio 5 (rate limiter sin cambios + logging)**: `checkRateLimit`
  es el mismo mecanismo Map-based de la feature `03` (mismo `count`/
  `windowStart`, misma ventana de 60s, mismo máximo de 5); el único
  cambio es la llamada a `logRejection('rate_limit', ip)` justo antes de
  responder `429`. Tests de rate limit de la feature `03` (6ta solicitud,
  IPs distintas, reseteo de ventana, fallback a `remoteAddress`) siguen
  pasando sin modificar su expectativa.
- **Criterios 6-8 (honeypot)**: `sitioWeb !== undefined` seguido de
  `typeof sitioWeb !== 'string' || sitioWeb.trim().length > 0` produce
  rechazo genérico `solicitud_rechazada` tanto para contenido no vacío
  como para cualquier tipo no-string (número, booleano, objeto, array) —
  nunca `tipo_invalido`. Ausente o vacío tras `trim()` no dispara nada.
  Confirmado por 8 tests dedicados, incluido el caso borde "sitio_web
  relleno + nombre ausente -> gana el honeypot".
- **Criterios 9-11 (control temporal)**: `typeof formularioMostradoEn ===
  'string'` se verifica ANTES de `Date.parse` (nunca se llama
  `Date.parse` sobre un no-string); si el parseo da `NaN`, o el campo no
  es string, o está ausente, el chequeo se omite sin rechazar. Si es
  fecha válida y `now() - parsedTimestamp < 3000`, rechaza con
  `solicitud_rechazada` (incluye delta negativo por reloj de cliente
  adelantado, tratado igual que "menos de 3000ms" — test explícito
  presente). Confirmado por 9 tests dedicados.
- **Criterios 7 y 11 (STRING_FIELDS)**: el arreglo `STRING_FIELDS`
  (línea 50) es exactamente `['nombre', 'email', 'telefono', 'servicio',
  'mensaje', 'version_politica_privacidad']` — **no incluye** `sitio_web`
  ni `formulario_mostrado_en`. Confirmado por inspección directa del
  código y por el test `STRING_FIELDS (inspeccion de codigo) no incluye
  sitio_web ni formulario_mostrado_en`, que además verifica por
  comportamiento que un valor no-string en cualquiera de los dos campos
  nunca produce `tipo_invalido`.
- **Criterios 12-14 (idempotencia)**: el `SELECT` (líneas 623-643) se
  ejecuta con `.ilike('email', escapeIlikeValue(email)).eq('nombre',
  nombre).gte('fecha_creacion', duplicateWindowStartIso).limit(1)`,
  usando `email`/`nombre` ya normalizados (`trim()`) más arriba en el
  flujo. Si hay resultado, responde `201` con el `id` existente y
  **retorna inmediatamente** (línea 646-648) sin llegar nunca al bloque
  de `INSERT` (línea 652 en adelante) — confirmado también por el test
  con contador de invocaciones a `insert()` que falla si se llama más de
  una vez. Ventana de 5 minutos (`DUPLICATE_WINDOW_MINUTES = 5`) y
  comparación solo por `email`+`nombre` (no `telefono`/`servicio`/
  `mensaje`) coinciden con el diseño. Confirmado por 5 tests dedicados,
  incluyendo el caso de ventana expirada (>5 min, no se deduplica) y el
  caso de mismo nombre/email distinto (no se deduplican entre sí).
- **Criterio 15 (logging sin PII)**: `logRejection(motivo, ip)` (líneas
  115-124) construye el log únicamente con `evento`, `motivo`, `ip_hash`
  (`hashIp()`, sha256 truncado a 16 hex, nunca la IP cruda) y
  `timestamp`. Ninguna referencia a `payload`, `nombre`, `email`,
  `telefono`, `mensaje` ni `sitio_web` en la función. Se llama en los
  cuatro puntos de rechazo exigidos (origen, rate limit, honeypot,
  control temporal) con el `motivo` correspondiente (`'antispam'`
  compartido entre honeypot y control temporal, documentado como
  decisión deliberada en `decision.md` punto 5). Los `console.error` de
  errores de Supabase (inserción/consulta fallida) loguean el objeto
  `error` de Postgres/Supabase, no el body de la solicitud — no están
  alcanzados por este criterio (que aplica a rechazos por origen/rate
  limit/antispam), pero se revisaron igual y no contienen PII del
  request. Confirmado por 4 tests dedicados que interceptan
  `console.warn` y hacen assert de ausencia de los valores de PII del
  propio test.
- **Criterio 16 (regresión feature 03)**: los 62 tests preexistentes de
  `api/leads.test.js` (validaciones de campos, `405`, `413`, `500`, etc.)
  siguen presentes y pasando sin modificar su expectativa — confirmado
  en el conteo total de `npm test` (98 en `leads.test.js`, 107 con
  `sanitize-html.test.js`).
- **Criterio 17 (`.env.example`)**: sección "Protección antispam (POST
  /api/leads)" agregada al final del archivo con `ALLOWED_ORIGINS=` vacía
  y comentario explicativo, mismo estilo que las variables existentes
  (`SITE_URL`, Supabase, SMTP).
- **Criterio 18 (desviaciones de arquitectura)**: no aplica — no hubo
  desviaciones que requieran dependencia/tabla/servicio nuevo, tal como
  confirma `decision.md` punto 1. `docs/tecnica/arquitectura.md` no
  requiere una sección nueva.
- **Criterios 19-20 (documentación técnica y de usuario)**: ver sección 4
  más abajo.
- **Criterio 21 (`decision.md`)**: `runs/04-proteccion-antispam-y-abuso/
  decision.md` existe, no vacío, con 7 decisiones demostrables (orden de
  evaluación, `originConfig` inyectable, escape de `ilike`, `motivo`
  compartido, ausencia de límite de longitud explícito para los campos
  nuevos, ubicación del chequeo de duplicados) más evidencia de cierre.
- **Criterios 22-23 (índices)**: confirmado por `grep` directo:
  `docs/tecnica/index.md:11` y `docs/usuario/index.md:9` contienen
  exactamente `- [Protección antispam y abuso](proteccion-antispam-y-abuso.md)`.

## 4. Documentación técnica y de usuario

- `docs/tecnica/proteccion-antispam-y-abuso.md` (332 líneas): no vacía,
  cubre los 5 mecanismos con su implementación real (nombres de función),
  el orden de evaluación extendido, las limitaciones conocidas de
  honeypot/timing/origen, **y dedica una sección explícita
  ("Condición de carrera (TOCTOU) — riesgo aceptado, no mitigado") a la
  condición de carrera del mecanismo de idempotencia**, con la misma
  justificación de tres puntos del spec (por qué no se agrega constraint
  único, impacto bajo, sigue siendo útil para el caso mayoritario).
  También documenta por qué no se implementó CAPTCHA y por qué no se
  reemplazó el rate limiter por almacenamiento persistente/distribuido —
  ambos con secciones dedicadas. Cumple el criterio 19 en su totalidad.
- `docs/usuario/proteccion-antispam-y-abuso.md` (84 líneas): no vacía,
  explica el propósito en lenguaje no técnico ("envíos automatizados",
  "envíos duplicados accidentales"), sin jerga de implementación,
  dirigido a quien administra el sitio/la clínica, incluyendo qué NO hace
  (sin CAPTCHA visible) y qué falta todavía (conexión real del formulario
  en la feature `08`). Cumple el criterio 20.

## 5. Contrato común del circuito (`scripts/feature-contract.ps1`)

Se ejecutó `Assert-FeatureContract -Slug '04-proteccion-antispam-y-abuso'
-Title 'Protección antispam y abuso'` (dot-sourcing
`scripts/feature-contract.ps1` desde un script `.ps1` temporal, para
evitar problemas de escapado de `$_` al invocar PowerShell desde Bash).
Resultado: `CONTRACT_OK`, sin excepciones, validando:

- `runs/04-proteccion-antispam-y-abuso/decision.md` — no vacío.
- `runs/04-proteccion-antispam-y-abuso/spec.md` — no vacío.
- `docs/tecnica/proteccion-antispam-y-abuso.md` — no vacío.
- `docs/usuario/proteccion-antispam-y-abuso.md` — no vacío.
- Al menos un `audit-N.md` — hay 2 (`audit-1.md` rechazado, `audit-2.md`
  aprobado).
- Al menos un `test-report-N.md` — este mismo archivo.
- Enlace exacto `- [Protección antispam y abuso](proteccion-antispam-y-abuso.md)`
  presente y único en `docs/tecnica/index.md` y `docs/usuario/index.md`.

## Hallazgos no bloqueantes (no ameritan rechazo)

- El escape de caracteres especiales de `ilike()` (`escapeIlikeValue()`)
  es una decisión de implementación defensiva no exigida explícitamente
  por ningún criterio del spec, pero está correctamente documentada en
  `decision.md` (punto 4) y en la documentación técnica, y no cambia el
  contrato observable del endpoint. No amerita objeción.
- El mismo `PermissionError` de `pytest` con el `basetemp` por defecto de
  este entorno local de QA (ya visto en la feature `03`) se repitió acá;
  se resolvió de la misma forma (`--basetemp` propio), sin tocar ningún
  archivo del repositorio.

## Conclusión

Los 23 criterios de aceptación del spec están implementados
correctamente, verificados por inspección directa de `api/leads.js` (no
solo por confiar en que los tests pasan), con cobertura de tests
específica para cada uno, incluyendo los casos combinados y de logging
sin PII exigidos por la sección "Casos de prueba esperados para
qa-agent". `npm test` (107/107) y `pytest` (24/24) pasan sin regresiones.
El contrato común del circuito (`Assert-FeatureContract`) pasa sin
excepciones. Documentación técnica y de usuario completas, no
ornamentales, cubriendo explícitamente el TOCTOU aceptado. Feature apta
para pasar a `READY_FOR_PR`.
