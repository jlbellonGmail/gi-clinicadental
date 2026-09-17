# Endpoint de recepción de leads (`POST /api/leads`) — documentación técnica

Handler: `api/leads.js`. Módulos auxiliares (prefijo `_` para que Vercel
no los exponga como rutas — criterio 21 del spec):
`api/_lib/supabase-client.js` (cliente Supabase server-side inyectable) y
`api/_lib/sanitize-html.js` (`escapeHtml()`, lista para las features
`05`/`06` de Nodemailer; **no se invoca desde ningún flujo de email en
esta feature**, porque ese flujo todavía no existe).

Spec completo: `runs/v1.0.0-producto/03-endpoint-recepcion-leads/spec.md` (30 criterios
de aceptación, aprobado en `audit-3.md`).

## Orden de evaluación de validaciones

> **Nota (feature `04-proteccion-antispam-y-abuso`):** el orden real que
> ejecuta hoy `api/leads.js` es el "orden de evaluación extendido" de la
> feature `04` (12 pasos: agrega validación de origen, honeypot, control
> temporal y detección de duplicados alrededor de los pasos descritos
> abajo), documentado completo en
> `docs/tecnica/proteccion-antispam-y-abuso.md`. Esta sección se conserva
> tal cual la dejó la feature `03` porque los 10 pasos de validación de
> **contenido del body** que describe siguen vigentes sin cambios de
> comportamiento ni de códigos de error (criterio 16 de la feature `04`);
> lo que cambió es qué se evalúa *antes* y *entre* estos pasos.

El handler evalúa las condiciones en este orden estricto y responde con
el primer error que encuentra, sin evaluar los pasos restantes
(criterio 3 del spec):

1. Método HTTP distinto de `POST` → `405` (`metodo_no_permitido`),
   header `Allow: POST`.
2. **Rate limiting** (ver más abajo) → `429` (`demasiadas_solicitudes`).
   Este paso **no** forma parte de los 9 pasos numerados del criterio 3
   del spec (ese criterio solo ordena las validaciones de contenido del
   body) — es una decisión de implementación de este builder, documentada
   en `runs/v1.0.0-producto/03-endpoint-recepcion-leads/decision.md`: se ubica
   inmediatamente después de confirmar el método `POST` y antes de leer
   el body, para no gastar ciclos parseando contenido de un cliente ya
   limitado y para que una ráfaga con body inválido también cuente
   contra el límite.
3. `Content-Type` inválido → `400` (`content_type_invalido`).
4. Tamaño del body > 10 KB → `413` (`payload_demasiado_grande`).
5. JSON inválido (o JSON válido que no es un objeto plano) → `400`
   (`json_invalido`).
6. Propiedad desconocida en el body (whitelist estricta) → `400`
   (`propiedad_desconocida`, con el campo identificado).
7. Campo obligatorio ausente (`nombre`, `email`,
   `version_politica_privacidad` — **sin** `consentimiento_privacidad`)
   → `400` (`campo_requerido_faltante`, con el campo identificado).
8. Tipo incorrecto en un campo presente (**sin**
   `consentimiento_privacidad`) → `400` (`tipo_invalido`, con el campo
   identificado).
9. Formatos y longitudes (ver sub-orden abajo) → `400`
   (`formato_email_invalido` / `formato_telefono_invalido` /
   `longitud_excedida` / `campo_requerido_faltante` para el caso de
   `nombre`/`version_politica_privacidad` vacíos tras `trim()`).
10. `consentimiento_privacidad` (ver regla especial abajo) → `400`
    (`consentimiento_requerido`).

**Ejemplo del propio spec**: un body con una propiedad desconocida
`role` y sin `nombre` responde `propiedad_desconocida` (paso 6), nunca
`campo_requerido_faltante`, porque el paso 6 se evalúa antes que el
paso 7.

### Sub-orden dentro de "formatos y longitudes" (decisión de este builder)

`audit-3.md` señaló como observación **no bloqueante** que el spec no
fija un sub-orden entre formato y longitud dentro de ese paso (ej. un
`email` sintácticamente inválido que además supera los 254 caracteres).
Siguiendo la sugerencia explícita del propio reviewer ("longitud antes
que formato"), este builder implementó el siguiente sub-orden
determinista, campo por campo, en este orden de campos: `nombre` →
`email` → `telefono` → `version_politica_privacidad` → `servicio` →
`mensaje`. Dentro de cada campo, cuando aplican ambos tipos de chequeo,
se evalúa longitud antes que formato:

- `nombre`: vacío tras `trim()` → `campo_requerido_faltante`; si no,
  longitud fuera de 2–150 → `longitud_excedida`.
- `email`: longitud > 254 → `longitud_excedida`; si no, formato inválido
  → `formato_email_invalido`.
- `telefono` (si está presente y no vacío tras `trim()`): el patrón
  `^[0-9+\-() ]{6,30}$` valida formato y longitud (6–30) en un único
  chequeo (criterio 11 del spec ya los unifica) → `formato_telefono_invalido`.
- `version_politica_privacidad`: vacío tras `trim()` →
  `campo_requerido_faltante`; si no, longitud fuera de 1–50 →
  `longitud_excedida`.
- `servicio` (si está presente y no vacío tras `trim()`): longitud > 100
  → `longitud_excedida`.
- `mensaje` (si está presente y no vacío tras `trim()`): longitud > 2000
  → `longitud_excedida`.

Un test cubre explícitamente el caso ambiguo señalado por el reviewer
(`api/leads.test.js`, "email invalido y demasiado largo a la vez"): con
`email` simultáneamente sin `@` y de más de 254 caracteres, gana
`longitud_excedida`.

### Regla especial de `consentimiento_privacidad`

`consentimiento_privacidad` **queda excluido** de las reglas generales
de campos obligatorios (paso 7) y de tipos (paso 8): su ausencia no
produce `campo_requerido_faltante` y un tipo incorrecto (ej. string
`"true"`, número, `null`) no produce `tipo_invalido`. El **único**
criterio que determina su código de error es el paso 10: si el valor no
es exactamente `true` (ausente, `false`, o cualquier tipo distinto de
`boolean`), responde siempre `400` (`consentimiento_requerido`) y el
lead **no se inserta**. Esto resuelve de forma no ambigua la
contradicción que motivó el rechazo de `audit-2.md` del spec.

## Content-Type: regla de charset

Se acepta la solicitud si la porción del header `Content-Type` antes del
primer `;`, tras `trim()` y `toLowerCase()`, es exactamente
`application/json`. Esto acepta `application/json; charset=utf-8` igual
que `application/json` a secas, pero rechaza `text/plain`,
`multipart/form-data`, `application/json-patch+json` (subtipo distinto)
y el header ausente.

## Auto-parseo de body deshabilitado (Vercel)

Las Serverless Functions de Vercel con runtime Node.js parsean
automáticamente `req.body` cuando `Content-Type: application/json`, lo
que impediría medir el tamaño crudo del payload antes de parsear (paso 4
del orden de evaluación, criterio 14 del spec). `api/leads.js` exporta:

```js
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
```

Con esto, el handler lee el stream crudo (`readRawBody()`), acumulando
bytes y cortando con `413` en cuanto se supera 10240 bytes, **antes** de
invocar `JSON.parse`. Como optimización adicional (no exigida por el
spec), si el header `Content-Length` está presente y declara un tamaño
mayor al límite, se corta de inmediato sin esperar a que llegue el
stream completo; esto es solo un atajo — la fuente de verdad sigue
siendo el conteo de bytes real del stream, porque `Content-Length` puede
faltar o no coincidir con encoding `chunked`.

## Campos opcionales vacíos tras `trim()` (criterio 8)

`telefono`, `servicio` y `mensaje` son opcionales. Si están ausentes, o
si están presentes pero su valor, tras `trim()`, resulta en una cadena
vacía, se insertan como `null` (nunca como `""`). Esta regla **no**
aplica a `nombre` ni a `version_politica_privacidad` (obligatorios): su
caso vacío-tras-trim produce `campo_requerido_faltante`, no `null`.

### Decisión adicional: `null` explícito en campos opcionales

El spec (criterio 9) no aclara qué ocurre si un campo opcional recibe
`null` explícito en el JSON (en vez de estar ausente o ser un string
vacío). Este builder decidió tratar `telefono`/`servicio`/`mensaje` con
valor `null` explícito **igual que ausentes** (se insertan como `null`,
no disparan `tipo_invalido`), porque la columna en Supabase acepta
`NULL` y es una forma común de que un cliente JSON exprese "sin valor".
Para los campos **obligatorios** (`nombre`, `email`,
`version_politica_privacidad`), `null` explícito sí dispara
`tipo_invalido` (ya cubierto por el ejemplo del propio criterio 9 del
spec). Ver `runs/v1.0.0-producto/03-endpoint-recepcion-leads/decision.md` para el
detalle de esta decisión.

## Mapeo campo → columna (criterio 16)

| Campo del body | Columna en `leads` |
|---|---|
| `nombre` | `nombre` |
| `email` | `email` |
| `telefono` | `telefono` (o `null`) |
| `servicio` | `servicio` (o `null`) |
| `mensaje` | `mensaje` (o `null`) |
| `consentimiento_privacidad` | `consentimiento_privacidad` |
| `version_politica_privacidad` | `version_politica_privacidad` |

No se envían `estado`, `origen`, `notificacion_clinica_enviada`,
`confirmacion_paciente_enviada`, `fecha_creacion` ni
`fecha_actualizacion`: quedan los defaults de la migración
`supabase/migrations/20260819210130_create_leads_table.sql` (feature
`02`). Precisamente por eso esos nombres están excluidos de la whitelist
de propiedades permitidas del body: si el cliente intentara enviarlos
(ej. `estado: "confirmado"`), la solicitud se rechaza entera como
`propiedad_desconocida` (paso 6).

## Por qué `servicio` y `version_politica_privacidad` no se validan contra una lista fija

- `servicio` (criterio 13): solo se valida tipo/longitud, no contra los
  4 valores actuales del `<select>` de `index.html`. Acoplar el backend
  a ese texto de marketing lo rompería en cuanto la feature `09`
  (rediseño) cambie las opciones.
- `version_politica_privacidad`: la política de privacidad todavía no
  existe (feature `07`), así que no hay catálogo de versiones válidas
  contra el cual validar. Se valida solo como string no vacío de 1–50
  caracteres.

## Rate limiting best-effort (criterio 18) — limitaciones

Límite en memoria, **a nivel de módulo/proceso**: máximo 5 solicitudes
por IP cada 60 segundos. La IP se toma de `x-forwarded-for` (primer
valor de la lista, si el header viene con varios saltos de proxy); si el
header no está presente, cae a `req.socket.remoteAddress`, y en último
caso a un valor fijo documentado (`'ip-desconocida'`). Al superarse el
límite, responde `429` con header `Retry-After` (segundos restantes) y
cuerpo `{ "error": "demasiadas_solicitudes" }`.

**Limitaciones conocidas, documentadas como aceptadas** (no como bugs):

- No persiste entre *cold starts* de Vercel: una instancia nueva arranca
  el contador en cero.
- No se comparte entre instancias serverless concurrentes: dos
  instancias distintas de la misma función no ven el mismo contador para
  la misma IP.
- No es la protección real contra abuso — eso es el alcance completo de
  la feature `04-proteccion-antispam-y-abuso` (almacenamiento
  persistente/distribuido, validación de origen, campo trampa, CAPTCHA,
  idempotencia). Esta feature `03` solo implementa lo mínimo para poder
  devolver `429` de forma controlada, como pide el ítem `03` del roadmap
  explícitamente.

## Manejo de errores 500 (criterio 19)

Cualquier error no controlado (fallo del cliente Supabase al
inicializarse, `insert()` que devuelve `error`, o cualquier excepción
inesperada) responde `500` con cuerpo genérico
`{ "error": "error_interno" }`. El detalle real (mensaje de
Postgres/Supabase, stack trace) se loguea únicamente server-side vía
`console.error`, nunca en la respuesta HTTP.

## Inyección de dependencias para tests (criterio 23)

`api/leads.js` exporta `createHandler(options)`, que acepta:

- `supabaseClientFactory`: función que devuelve el cliente Supabase a
  usar (por defecto, `getSupabaseClient` de `api/_lib/supabase-client.js`,
  que exige `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en
  variables de entorno reales).
- `rateLimitStore`: `Map` a usar como almacenamiento del rate limiter
  (por defecto, un `Map` compartido a nivel de módulo). Los tests pasan
  un `Map` nuevo por caso para no interferir entre sí.
- `now`: función que devuelve el timestamp actual en ms (por defecto,
  `Date.now`). Los tests la sobreescriben para probar el reseteo de la
  ventana de 60 segundos sin esperar tiempo real.
- `maxBodyBytes`: override del límite de 10240 bytes, usado en tests
  para no tener que generar payloads de exactamente ese tamaño.

`module.exports` es el handler por defecto (construido con
`createHandler()` sin overrides — el que usa Vercel en producción);
`module.exports.createHandler` queda disponible para los tests.

## Cómo se ejecutan los tests Node en CI

`.github/workflows/ci.yml` agrega, dentro del mismo job `test` que ya
corría `pytest -v`, estos pasos adicionales (después de pytest, sin
quitarlo ni debilitarlo):

```yaml
- name: Instalar Node.js 20
  uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: "npm"

- name: Instalar dependencias Node
  run: npm ci

- name: Tests (node --test)
  run: npm test
```

`package.json` define `"test": "node --test"` (test runner nativo de
Node ≥18, sin dependencias de testing adicionales). El test runner
descubre automáticamente los archivos `**/*.test.js`:
`api/leads.test.js` (71 tests, contrato completo del handler) y
`api/_lib/sanitize-html.test.js` (`escapeHtml()`). Un test roto en
cualquiera de los dos pone en rojo el mismo check de CI que hoy bloquea
el merge (mismo job, mismo `exit code` no-cero si algo falla).

## Verificación real vs. mockeada

No hay un proyecto Supabase real conectado en este entorno de
desarrollo/CI (mismo riesgo documentado por la feature `02`). Todos los
tests de inserción usan un cliente Supabase falso inyectado
(`makeFakeSupabaseClient()` en `api/leads.test.js`), que simula tanto el
caso de éxito como el fallo (`error` de Postgres) sin red real. Queda
como verificación pendiente en Preview/Production, igual que la
migración de la feature `02`.

## Ampliación del contrato de respuesta (punto 16)

El `201` pasó de `{ id }` a:

```json
{ "id": "...", "comunicacion_completa": true, "requiere_revision": false }
```

**Por qué.** Un `201` significa que el lead quedó registrado, no que las
dos notificaciones hayan salido. Con solo `id`, el frontend no podía
distinguir un éxito completo de uno parcial, y terminaba diciendo
"Solicitud enviada" también cuando algún correo había fallado.

Los dos campos se derivan **en memoria** de los flags de envío, no se
releen de la base: el contrato no depende de que el `UPDATE` de
`estado_comunicacion` salga bien.

**No se expone** nada de SMTP, ni el proveedor, ni códigos, ni motivos, ni
cuál de los dos envíos falló. El frontend no lo necesita, y hay un test
que verifica que esas palabras no aparezcan en el cuerpo serializado.

El camino de idempotencia devuelve el estado **real del lead que ya
existe**, derivado de sus dos flags: no reenvía correos y no afirma una
comunicación completa que quizá no ocurrió.
