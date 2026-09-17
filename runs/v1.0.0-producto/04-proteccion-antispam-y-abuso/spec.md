# Spec: Protección antispam y abuso del endpoint de leads (`POST /api/leads`)

## Alcance

Extender `api/leads.js` (feature `03-endpoint-recepcion-leads`, ya
mergeada a `develop`) para agregar, sin romper ningún comportamiento ya
documentado en `docs/tecnica/endpoint-recepcion-leads.md`:

1. **Validación de origen**: rechazar solicitudes cuyo `Origin` (o, en su
   ausencia, `Referer`) no pertenezca a un origen permitido.
2. **Mecanismo antispam de campo trampa (honeypot)**: campo oculto nuevo
   y opcional en el body, `sitio_web`, que un usuario real nunca completa;
   si llega con contenido, la solicitud se rechaza.
3. **Mecanismo antispam de control temporal**: campo opcional nuevo,
   `formulario_mostrado_en` (timestamp ISO 8601 de cuándo el formulario
   se mostró al usuario); si la solicitud llega antes de un mínimo de
   tiempo razonable desde ese instante, se rechaza.
4. **Idempotencia / detección de duplicados accidentales**: antes de
   insertar, se busca en la propia tabla `leads` un registro reciente con
   el mismo `email` + `nombre` normalizados; si existe, se responde
   `201` con el `id` ya existente en vez de insertar un lead duplicado.
5. **Registro de rechazos sin PII**: cada rechazo por rate limit, origen
   inválido o antispam se registra vía `console.warn`/`console.error`
   con un motivo y un hash truncado de la IP, **nunca** con
   `nombre`/`email`/`telefono`/`mensaje` ni con la IP en texto plano.

El rate limiting en memoria ya implementado en la feature `03` (5
solicitudes/60s por IP) **se mantiene sin cambios de mecanismo**; esta
feature solo le agrega logging de rechazo (punto 5) y ajusta su lugar en
el orden de evaluación junto a la nueva validación de origen (ver más
abajo). La justificación de por qué no se reemplaza por almacenamiento
persistente/distribuido en esta feature está en "Riesgos / supuestos".

CAPTCHA **no se implementa** en esta feature (ver "Riesgos / supuestos").

### Explícitamente NO incluye

- No se agrega ningún proveedor de CAPTCHA (reCAPTCHA/hCaptcha/Turnstile):
  no está declarado en el stack de `AGENTS.md`, y agregarlo requeriría
  una dependencia/servicio externo nuevo con su propia clave — decisión
  de arquitectura que esta spec no toma unilateralmente. Queda como
  escalamiento futuro condicionado a evidencia real de abuso (ver
  "Riesgos / supuestos").
- No se reemplaza el rate limiter en memoria de la feature `03` por un
  almacenamiento persistente/distribuido (tabla Supabase dedicada,
  Redis/Upstash, Vercel KV). Se prioriza en su lugar sumar capas de
  defensa independientes del estado compartido entre instancias
  (origen, honeypot, control temporal, dedupe por consulta a `leads`).
- No se modifican `index.html` ni `script.js`: el formulario sigue
  simulado (`setTimeout`), eso es la feature `08-conexion-frontend-api`.
  Esta feature sí deja definidos y documentados los nombres exactos de
  los dos campos nuevos (`sitio_web`, `formulario_mostrado_en`) para que
  `08` los agregue al formulario real (el segundo como input oculto con
  el timestamp de render, el primero como campo trampa oculto vía CSS,
  nunca `display:none` puro si se quiere máxima efectividad contra
  autocompletado de navegador — decisión de UI que le corresponde a
  `08`, no a esta spec).
- No se agrega ninguna dependencia npm nueva ni tabla/migración nueva en
  Supabase (ver diseño propuesto). Si el `builder-agent` decide que el
  diseño propuesto no es viable y necesita desviarse agregando una
  dependencia, tabla o servicio nuevo, **debe** documentarlo como
  decisión explícita en `docs/tecnica/arquitectura.md`, por regla dura
  de `AGENTS.md` ("Reglas de dominio"). Esto incluye explícitamente no
  agregar un índice único ni constraint nuevo sobre `leads` para mitigar
  la condición de carrera del punto 4 (ver "Riesgos / supuestos").
- No se envía ningún correo (features `05`/`06`, sin cambios).

## Contexto

`api/leads.js` (feature `03`, mergeada) ya valida estrictamente el body,
aplica un rate limiter best-effort en memoria y devuelve `429` de forma
controlada, pero su propia documentación técnica
(`docs/tecnica/endpoint-recepcion-leads.md`, sección "Rate limiting
best-effort — limitaciones") señala explícitamente que "no es la
protección real contra abuso" y delega el resto (validación de origen,
campo trampa, CAPTCHA condicional, idempotencia) a esta feature `04`,
tal como la describe `ROADMAP.md`.

El sitio sigue sin frontend conectado (`08` es posterior), así que hoy
el único cliente real de `/api/leads` en producción sería quien lo
invoque directamente. Esto hace que las defensas de esta feature deban
funcionar de forma autónoma (por header/origen/timing/dedupe), no
dependan de que el frontend ya envíe los campos nuevos, y sean
verificables con tests unitarios/HTTP sin depender de `08`.

## Diseño propuesto

### 1. Validación de origen

- Nueva variable de entorno opcional `ALLOWED_ORIGINS`: lista de
  orígenes permitidos separados por coma (ej.
  `https://sonriemascorrientes.com,http://localhost:3000`). Se documenta
  en `.env.example` con el mismo estilo que las variables existentes
  (comentario explicativo, valor vacío).
- Un origen de la solicitud se considera permitido si coincide
  exactamente con: `SITE_URL` (ya declarada), cualquier entrada de
  `ALLOWED_ORIGINS`, o `https://${process.env.VERCEL_URL}` cuando esa
  variable esté definida (la provee automáticamente la plataforma
  Vercel para el propio deployment — no es infraestructura nueva, ya es
  parte del hosting declarado en `AGENTS.md`; resuelve el caso de URLs
  de Preview, que cambian por PR, sin necesitar wildcards).
- El origen efectivo de la solicitud se toma de: el header `Origin` si
  está presente; si no, se deriva de `Referer` (protocolo + host); si
  ninguno está presente, se trata como origen no permitido.
- Si el origen no es válido → `403` (`{ "error": "origen_no_permitido" }`).
- Fuera de alcance: manejo de preflight CORS (`OPTIONS`) y headers
  `Access-Control-Allow-Origin` — el tráfico esperado es same-origin
  (frontend y API en el mismo deployment de Vercel), ver "Riesgos".

### 2. Honeypot (`sitio_web`)

- Nuevo campo opcional en la whitelist del body: `sitio_web` (string,
  máximo 200 caracteres). Un usuario real nunca lo completa (queda
  oculto en el HTML real, responsabilidad de `08`).
- Si `sitio_web` está presente y, tras `trim()`, no es una cadena vacía
  → la solicitud se rechaza. Si `sitio_web` está presente pero **no es
  string** (número, objeto, array, booleano) → también se rechaza (a
  diferencia del resto de campos de la feature `03`, no se distingue con
  `tipo_invalido`: cualquier señal en este campo es sospechosa por
  definición, y no vale la pena filtrar información sobre su existencia
  a quien lo dispara — ver "Riesgos / supuestos").
- **`sitio_web` queda explícitamente excluido del arreglo `STRING_FIELDS`
  de `api/leads.js` (feature `03`)**: su validación de tipo es
  exclusivamente la descrita en el bullet anterior (cualquier tipo
  no-string dispara `solicitud_rechazada`, nunca `tipo_invalido`). No
  debe agregarse a `STRING_FIELDS` bajo ninguna circunstancia — hacerlo
  produciría un código de error distinto (`tipo_invalido`) para un caso
  ya cubierto explícitamente aquí, y le daría a un bot una señal para
  distinguir el honeypot del resto de las validaciones.
- Código de rechazo: `400` con cuerpo `{ "error": "solicitud_rechazada" }`
  — deliberadamente genérico, compartido con el rechazo por control
  temporal (punto 3), para no darle a un bot una forma de distinguir cuál
  de las dos defensas lo detectó ni de calibrar contra ellas por
  separado. Ver "Riesgos / supuestos" para la justificación completa de
  por qué este código difiere del patrón granular de la feature `03`.

### 3. Control temporal (`formulario_mostrado_en`)

- Nuevo campo opcional en la whitelist del body: `formulario_mostrado_en`
  (string, timestamp ISO 8601, máximo 40 caracteres) — el momento en que
  el formulario se volvió visible para el usuario, generado client-side.
- Si el campo está ausente → se omite este chequeo (soft, no bloqueante
  — necesario porque hasta que la feature `08` no lo envíe, ningún
  cliente real lo va a incluir).
- La implementación debe verificar primero `typeof valor === 'string'`;
  solo si es string se intenta `Date.parse`. Si el campo está presente
  pero **no es un string** (número, booleano, objeto, array), o **es un
  string pero no parseable como fecha válida** (`Date.parse` da `NaN`)
  → en ambos casos se omite este chequeo sin rechazar la solicitud
  completa (no se rechaza por un timestamp malformado o de tipo
  inesperado: podría ser un bug de reloj/cliente de un paciente real, no
  necesariamente un bot — asimetría deliberada frente al honeypot,
  documentada en "Riesgos / supuestos").
- **`formulario_mostrado_en` queda explícitamente excluido del arreglo
  `STRING_FIELDS` de `api/leads.js` (feature `03`)**: su validación de
  tipo/formato es exclusivamente la descrita en este punto, nunca
  produce `tipo_invalido`. No debe agregarse a `STRING_FIELDS` bajo
  ninguna circunstancia — si se agregara, un valor no-string sería
  rechazado con `tipo_invalido` en el paso 10 del orden de evaluación,
  contradiciendo directamente el bullet anterior ("no se rechaza la
  solicitud completa").
- Si el campo es una fecha válida: se calcula
  `ahora - fecha(formulario_mostrado_en)`. Si ese valor es menor a
  `MIN_FORM_FILL_MS = 3000` (3 segundos, constante en código, mismo
  patrón que `RATE_LIMIT_MAX_REQUESTS` de la feature `03`) → se rechaza
  con el mismo código genérico `solicitud_rechazada` (`400`) del punto 2.
- No se valida un límite superior (formularios abiertos hace mucho
  tiempo se aceptan igual) — ver "Casos borde".

### 4. Idempotencia / duplicados accidentales

- Justo antes de insertar en Supabase (después de pasar todas las
  validaciones de la feature `03` y las nuevas de origen/honeypot/timing),
  se consulta la tabla `leads` (mismo cliente `service_role` ya
  inyectado) buscando un registro con `email` igual (comparación
  case-insensitive, tras `trim()`) **y** `nombre` igual (tras `trim()`,
  comparación case-sensitive) **y** `fecha_creacion >= ahora - 5 minutos`
  (`DUPLICATE_WINDOW_MINUTES = 5`, constante en código).
- Si existe un registro que matchea → no se inserta un nuevo lead; se
  responde `201` con `{ "id": <id del lead existente> }` (mismo
  contrato de éxito que un insert nuevo, transparente para quien llame
  al endpoint — incluida la futura feature `08`, que no necesita manejar
  un caso especial).
- Si no existe → sigue el flujo normal de `INSERT` ya implementado en la
  feature `03`, sin cambios en el mapeo campo→columna.
- No se requiere ninguna tabla ni columna nueva: la consulta reutiliza
  la tabla `leads` ya existente y el mismo cliente `service_role` (que
  además ya tiene `BYPASSRLS`, documentado en
  `docs/tecnica/inicializacion-supabase-schema.md`).
- No se compara `telefono`/`servicio`/`mensaje`: matchear solo por
  identidad (`email`+`nombre`) es deliberadamente más laxo, para seguir
  reconociendo como duplicado un reintento donde el usuario corrigió un
  campo secundario (ver "Riesgos / supuestos" sobre el trade-off
  aceptado).
- **Limitación conocida y aceptada, no mitigada en esta feature:** este
  mecanismo de "SELECT y luego INSERT si no hay duplicado" son dos pasos
  separados, sin transacción ni constraint único a nivel de base de
  datos. Ante dos solicitudes casi simultáneas para el mismo
  `email`+`nombre` (ej. doble clic accidental antes de que la primera
  respuesta HTTP vuelva), existe una condición de carrera (TOCTOU) que
  puede resultar en dos leads insertados en vez de uno. Ver el párrafo
  dedicado en "Riesgos / supuestos" para la justificación completa de
  por qué no se mitiga aquí con un índice único ni una transacción.

### 5. Registro de rechazos sin PII

- Cada rechazo por rate limit (`429`), origen inválido (`403`) o
  antispam (`400` honeypot/timing) emite una línea de log estructurada
  (`console.warn`), por ejemplo:
  ```js
  console.warn(JSON.stringify({
    evento: 'lead_rechazado',
    motivo: 'rate_limit' | 'origen_no_permitido' | 'antispam',
    ip_hash: sha256Hex(ip).slice(0, 16),
    timestamp: new Date().toISOString(),
  }));
  ```
- `ip_hash` usa el módulo nativo `crypto` de Node (`createHash('sha256')`,
  sin sal — suficiente para no persistir la IP en texto plano en logs;
  no pretende ser criptográficamente irreversible frente a un atacante
  con recursos, ver "Riesgos / supuestos"), nunca la IP cruda.
- Prohibido explícitamente: loguear `nombre`, `email`, `telefono`,
  `mensaje`, `sitio_web` o el body completo de la solicitud en cualquier
  rechazo. Esto es un criterio de aceptación verificable por inspección
  de código y por test (ver más abajo).
- No se persiste esta información en Supabase ni en ninguna tabla nueva
  — el registro vive únicamente en los logs de la plataforma (Vercel),
  consistente con no introducir infraestructura nueva. Un mecanismo de
  observabilidad más completo (retención, búsqueda, alertas) es el
  ítem `15-observabilidad-y-operacion` del roadmap, no esta feature.

### Orden de evaluación extendido (reemplaza el de la feature `03`)

El handler debe evaluar en este orden estricto, devolviendo el primer
error que encuentre:

1. Método HTTP distinto de `POST` → `405` (sin cambios).
2. **Origen inválido** (nuevo) → `403` (`origen_no_permitido`), con
   logging de rechazo.
3. Rate limiting (sin cambios de mecanismo) → `429`
   (`demasiadas_solicitudes`), ahora con logging de rechazo agregado.
4. `Content-Type` inválido → `400` (sin cambios).
5. Tamaño del body > 10 KB → `413` (sin cambios).
6. JSON inválido → `400` (sin cambios).
7. Propiedad desconocida (whitelist ampliada con `sitio_web` y
   `formulario_mostrado_en`) → `400` (sin cambios de mecanismo).
8. **Honeypot disparado** (nuevo) → `400` (`solicitud_rechazada`), con
   logging de rechazo.
9. **Control temporal disparado** (nuevo, solo si el campo es una fecha
   válida) → `400` (`solicitud_rechazada`), con logging de rechazo.
10. Campos obligatorios/tipos/formatos/longitudes/consentimiento de la
    feature `03`, sin cambios de comportamiento ni de códigos de error.
    **El arreglo `STRING_FIELDS` (chequeo genérico de tipos) no se
    amplía con `sitio_web` ni `formulario_mostrado_en`: ambos quedan
    fuera de este chequeo por diseño (ver puntos 2 y 3), análogo a como
    `consentimiento_privacidad` ya queda excluido en la feature `03`.**
11. **Duplicado reciente detectado** (nuevo) → no es un error: responde
    `201` con el `id` existente, sin insertar.
12. Inserción normal en Supabase (sin cambios) → `201` con el nuevo `id`.

## Variables de entorno nuevas

- `ALLOWED_ORIGINS` (opcional): lista de orígenes permitidos separados
  por coma, además de `SITE_URL` y `https://${VERCEL_URL}` (implícitos).
  Debe agregarse a `.env.example` con valor vacío y comentario
  explicativo, siguiendo el estilo ya usado para las demás variables de
  ese archivo.
- No se agrega ninguna otra variable de entorno, dependencia npm, tabla
  ni migración SQL nueva en el diseño propuesto.

## Criterios de aceptación

1. `api/leads.js` implementa el orden de evaluación extendido descrito
   arriba, verificable con tests que envíen combinaciones de condiciones
   simultáneas (ej. origen inválido + rate limit ya excedido → responde
   `403`, no `429`).
2. Una solicitud con `Origin` (o `Referer`) que no coincide con
   `SITE_URL`, ninguna entrada de `ALLOWED_ORIGINS` ni
   `https://${VERCEL_URL}` responde `403`
   (`{ "error": "origen_no_permitido" }`).
3. Una solicitud sin header `Origin` ni `Referer` responde `403`
   (mismo código que el punto 2).
4. Una solicitud con `Origin` igual a `SITE_URL` (o a una entrada de
   `ALLOWED_ORIGINS`, o a `https://${VERCEL_URL}` cuando esa variable
   está definida) pasa la validación de origen.
5. El rate limiter (5 solicitudes/60s por IP) sigue funcionando
   exactamente como en la feature `03` (regresión: los tests existentes
   de `api/leads.test.js` sobre rate limiting siguen pasando sin
   modificar su expectativa de comportamiento), y además cada rechazo
   `429` emite el log estructurado sin PII descrito arriba.
6. Un body con `sitio_web` no vacío tras `trim()` responde `400`
   (`{ "error": "solicitud_rechazada" }`) y **no** inserta ningún lead
   en Supabase.
7. Un body con `sitio_web` de tipo no-string (ej. número, booleano,
   objeto, array) responde `400` con el mismo código
   `solicitud_rechazada` (no `tipo_invalido`) — verificable también por
   inspección de código: el arreglo `STRING_FIELDS` de `api/leads.js`
   **no** debe incluir `sitio_web`.
8. Un body sin `sitio_web`, o con `sitio_web` ausente/vacío tras
   `trim()`, no se ve afectado por este chequeo.
9. Un body con `formulario_mostrado_en` a menos de 3000 ms de la
   solicitud responde `400` (`solicitud_rechazada`) y no inserta ningún
   lead.
10. Un body con `formulario_mostrado_en` a 3000 ms o más de la solicitud
    (o el mínimo configurado) pasa el chequeo temporal.
11. Un body sin `formulario_mostrado_en`, con un valor no parseable como
    fecha, o con un valor que directamente no es string (ej. número,
    booleano, objeto), pasa el flujo sin ser rechazado por este chequeo
    ni producir `tipo_invalido` (verificado con tests explícitos para
    cada uno de los tres casos) — verificable también por inspección de
    código: el arreglo `STRING_FIELDS` de `api/leads.js` **no** debe
    incluir `formulario_mostrado_en`.
12. Ante un body válido cuyo `email` (normalizado) y `nombre`
    (normalizado) coinciden con un lead insertado hace menos de 5
    minutos, el endpoint responde `201` con el `id` del lead existente y
    **no** ejecuta un segundo `INSERT` (verificable inyectando un
    cliente Supabase falso que falla el test si `insert()` se invoca más
    de una vez para ese escenario). Este criterio verifica el
    comportamiento secuencial (una solicitud completa su ciclo antes de
    que llegue la siguiente), no concurrencia real simultánea; ver
    "Riesgos / supuestos" y "Casos borde" sobre la condición de carrera
    aceptada, que ningún test de esta feature está obligado a cubrir.
13. Ante el mismo escenario pero con el lead existente insertado hace
    más de 5 minutos, se inserta un lead nuevo (no se considera
    duplicado).
14. Ante dos bodies con el mismo `nombre` pero `email` distinto (o
    viceversa) dentro de la ventana de 5 minutos, ambos se insertan como
    leads independientes (no se consideran duplicados entre sí).
15. Ningún log emitido en un escenario de rechazo (origen, rate limit,
    honeypot, control temporal) contiene los valores literales de
    `nombre`, `email`, `telefono`, `mensaje`, `sitio_web` ni la IP en
    texto plano — verificable interceptando `console.warn`/`console.error`
    en los tests y haciendo asserts sobre el contenido serializado.
16. Todos los códigos de error, formatos de respuesta y comportamientos
    ya documentados en `docs/tecnica/endpoint-recepcion-leads.md` para
    la feature `03` (validaciones de campos, `405`, `413`, `500`, etc.)
    siguen funcionando sin cambios — los 71 tests existentes de
    `api/leads.test.js` referenciados en esa documentación deben seguir
    pasando tras esta feature (regresión), extendidos, no reemplazados.
17. `.env.example` documenta `ALLOWED_ORIGINS` con el mismo estilo que
    las demás variables (comentario explicativo, sin valor real).
18. Si la implementación final se desvía del diseño propuesto en algún
    punto que implique agregar una dependencia npm, tabla o migración
    Supabase nueva, o un servicio externo (ej. CAPTCHA), esa desviación
    queda documentada como decisión explícita en
    `docs/tecnica/arquitectura.md`, agregando una sección nueva sin
    reescribir las existentes.
19. Debe existir `docs/tecnica/proteccion-antispam-y-abuso.md`, no
    vacío, con las decisiones de diseño/implementación relevantes
    (incluyendo el orden de evaluación extendido, las limitaciones
    conocidas del honeypot/timing/origen, la condición de carrera
    (TOCTOU) aceptada y no mitigada en el mecanismo de idempotencia del
    punto 4 —y por qué no se agrega un constraint único ni una migración
    nueva en esta feature—, y por qué no se implementó CAPTCHA ni
    almacenamiento persistente/distribuido para el rate limiter en esta
    feature).
20. Debe existir `docs/usuario/proteccion-antispam-y-abuso.md`, no
    vacío, con el propósito de la feature (proteger el formulario de
    contacto de envíos automatizados/duplicados) explicado en lenguaje
    no técnico, dirigido a quien administra el sitio/la clínica.
21. Debe existir `runs/04-proteccion-antispam-y-abuso/decision.md`, con
    las decisiones demostrables desde spec/auditoría/implementación
    (no vacío ni ornamental).
22. `docs/tecnica/index.md` debe contener exactamente el enlace
    `- [Protección antispam y abuso](proteccion-antispam-y-abuso.md)`.
23. `docs/usuario/index.md` debe contener exactamente el enlace
    `- [Protección antispam y abuso](proteccion-antispam-y-abuso.md)`.

Nota sobre el título exacto: se recomienda usar literalmente
`Protección antispam y abuso` como título en ambos índices (vía
`scripts/update-doc-indexes.ps1 04-proteccion-antispam-y-abuso "Protección antispam y abuso"`),
consistente con el estilo breve ya usado en `docs/tecnica/index.md` (ej.
"Arquitectura", "Endpoint de recepción de leads").

## Casos borde a contemplar

- `x-forwarded-for` con múltiples IPs (proxy chain): se sigue usando el
  primer valor, sin cambios respecto a la feature `03`.
- `Origin` presente pero con formato inválido (no es una URL parseable)
  → tratado como no permitido (403), no como excepción no controlada.
- `ALLOWED_ORIGINS` con espacios alrededor de las comas (ej.
  `"https://a.com, https://b.com"`) debe parsearse correctamente tras
  `trim()` de cada entrada.
- `VERCEL_URL` no definido (entorno local/tests) → esa rama del chequeo
  de origen simplemente no aplica, sin lanzar excepción.
- Body con `sitio_web` y con un campo obligatorio faltante (ej. sin
  `nombre`) a la vez: gana el rechazo por honeypot (paso 8), nunca
  `campo_requerido_faltante` (paso 10) — consistente con el principio ya
  establecido en la feature `03` de "el primer error en el orden gana".
- Dos solicitudes legítimas y distintas de dos pacientes distintos con
  el mismo `nombre` común (ej. "Juan Pérez") pero `email` distinto no
  deben deduplicarse entre sí (criterio 14).
- Un mismo paciente que corrige un error tipográfico en su `mensaje` y
  reenvía el formulario dentro de los 5 minutos verá su segunda
  solicitud "fusionada" silenciosamente con la primera (responde `201`
  pero no se guarda el mensaje corregido) — comportamiento aceptado y
  documentado, no un bug (ver "Riesgos / supuestos").
- **Dos solicitudes casi simultáneas para el mismo `email`+`nombre`
  normalizados (ej. doble clic accidental en "Enviar" antes de que la
  primera respuesta HTTP vuelva) pueden ambas pasar el `SELECT` del
  punto 4 antes de que cualquiera complete el `INSERT`, resultando en
  dos leads insertados en vez de uno** — condición de carrera (TOCTOU)
  inherente al diseño de dos pasos sin transacción/constraint único.
  Aceptada como riesgo, no mitigada en esta feature (ver "Riesgos /
  supuestos" para la justificación completa). No es un caso que
  `qa-agent` deba verificar con un test determinístico de concurrencia
  real: está fuera de alcance de la suite de tests unitarios con
  cliente Supabase mockeado (que por diseño es secuencial, no
  concurrente).
- Reloj del servidor vs. reloj del cliente para `formulario_mostrado_en`:
  un cliente con reloj adelantado podría producir un delta negativo
  (`ahora - formulario_mostrado_en < 0`), que debe tratarse igual que
  "menos de 3000 ms" (rechazo), no como caso especial ni excepción.
- Solicitudes de herramientas sin header `Origin`/`Referer` (curl,
  Postman, scripts de diagnóstico manual) quedan bloqueadas por diseño
  salvo que se les configure el header manualmente — documentado como
  trade-off aceptado, no como bug, en "Riesgos / supuestos".

## Riesgos / supuestos

- **El mecanismo de idempotencia (punto 4) tiene una condición de
  carrera (TOCTOU) no mitigada, aceptada explícitamente como riesgo.**
  El diseño consulta la tabla `leads` (`SELECT`) y, si no encuentra un
  duplicado reciente, inserta (`INSERT`), como dos operaciones separadas
  sin transacción ni constraint único a nivel de base de datos. Dos
  solicitudes casi simultáneas para el mismo `email`+`nombre` (el caso
  más realista: un usuario hace doble clic en "Enviar" antes de que la
  primera respuesta HTTP vuelva) pueden ambas ejecutar el `SELECT` antes
  de que cualquiera complete el `INSERT`, viendo ambas "no hay duplicado
  reciente" e insertando dos leads — el propio escenario que este punto
  busca evitar. Se documenta como riesgo aceptado, sin mitigar en esta
  feature, por estas razones: (a) mitigarlo de forma robusta requeriría
  un índice único parcial (o una función/trigger equivalente) sobre
  `leads`, es decir una migración SQL nueva sobre una tabla ya
  existente — que esta spec excluye explícitamente de su alcance salvo
  decisión de arquitectura documentada en `docs/tecnica/arquitectura.md`
  (ver "Explícitamente NO incluye" y la regla dura correspondiente de
  `AGENTS.md`), y esta feature no encuentra justificación suficiente
  para tomar esa decisión unilateralmente solo por este caso; (b) el
  impacto de fallar en este caso límite es bajo: en el peor caso se
  insertan dos leads casi idénticos del mismo paciente en la misma
  ventana de segundos, visibles y fusionables manualmente por quien
  gestiona los leads de la clínica — no hay pérdida de datos, filtración
  de PII a terceros, ni una vulnerabilidad explotable deliberadamente
  por un atacante (a diferencia de honeypot/origen/rate-limit, que sí
  defienden contra abuso intencional, este mecanismo defiende contra un
  accidente de UX); (c) el mecanismo sigue siendo correcto y útil para
  el caso mayoritario real de "duplicado accidental" — un reenvío manual
  del usuario segundos o minutos después, no un doble clic en el mismo
  instante — donde el `SELECT` del segundo request sí ve ya completado
  el `INSERT` del primero. Si en producción se observa evidencia real de
  duplicados por esta ventana de carrera, mitigarlo (ej. con un índice
  único parcial sobre `lower(email)` + `nombre`, combinado con una
  política de purga/archivado) es candidato concreto para una decisión
  de arquitectura futura documentada en `docs/tecnica/arquitectura.md`,
  no para esta feature.
- **No se implementa CAPTCHA en esta feature.** El ítem de `ROADMAP.md`
  lo condiciona explícitamente ("...CAPTCHA cuando resulte necesario");
  no hay proveedor de CAPTCHA declarado en el stack de `AGENTS.md`, y
  agregarlo introduciría una dependencia externa y una clave/servicio
  nuevos que esta spec no está en condiciones de decidir unilateralmente
  (afecta UX del futuro formulario real de la feature `08`). Si el
  volumen de abuso real en producción supera lo que las defensas de
  esta feature mitigan, agregar CAPTCHA es candidato a un ítem de
  roadmap futuro, con su propia spec y su propia decisión de
  arquitectura en `docs/tecnica/arquitectura.md`.
- **No se reemplaza el rate limiter en memoria por almacenamiento
  persistente/distribuido**, aunque `docs/tecnica/endpoint-recepcion-leads.md`
  (feature `03`) lo mencionaba como parte del "alcance completo" de esta
  feature `04`. Decisión de esta spec: priorizar las defensas nuevas
  (origen, honeypot, timing, dedupe) que no dependen de estado
  compartido entre instancias/cold starts de Vercel, y dejar explícito
  que el rate limiter sigue teniendo las mismas limitaciones ya
  documentadas y aceptadas en la feature `03` (no persiste entre cold
  starts, no se comparte entre instancias concurrentes). Si el
  `reviewer-agent` considera que esto no cumple el ítem del roadmap, es
  un punto concreto y explícito para objetar en `audit-N.md`.
- **El honeypot y el control temporal son opt-in mientras el formulario
  real no exista** (feature `08` pendiente): hasta que `08` los agregue
  al HTML, ningún cliente legítimo los va a enviar, así que hoy
  funcionan solo contra quien llame directamente a la API imitando
  campos de un formulario típico. Es una limitación conocida y aceptada,
  no un defecto de esta feature.
- **El honeypot no detiene bots dirigidos** que inspeccionan el
  contrato real de la API (en vez de rellenar un formulario HTML a
  ciegas) y simplemente omiten `sitio_web`. Es una limitación inherente
  a la técnica de campo trampa, documentada como tal.
- **El control temporal es trivialmente evadible por un bot que falsee
  `formulario_mostrado_en`** con un valor antiguo. Solo detiene bots
  genéricos/no dirigidos que no simulan tiempo de llenado. Documentado
  como limitación aceptada, consistente con por qué no se apuesta todo
  a este único mecanismo.
- **La validación de origen asume que el navegador envía el header
  `Origin` en solicitudes `POST`** (comportamiento estándar en
  navegadores modernos, incluidas solicitudes same-origin), con
  `Referer` como respaldo. Si en la práctica algún navegador o
  configuración de red no lo envía, solicitudes legítimas podrían
  bloquearse — riesgo a validar en la feature `08` (verificación real
  end-to-end) o en `16-validacion-mvp-produccion`.
- **El hash de IP en los logs (`sha256` sin sal) es una mitigación
  razonable para no persistir la IP en texto plano en los logs de la
  plataforma, no una garantía criptográfica irreversible** frente a un
  atacante con recursos para probar rangos de IP conocidos contra el
  hash. Se documenta como decisión suficiente para el nivel de riesgo de
  este proyecto (landing de captación de leads, no un sistema con datos
  clínicos sensibles en los logs), no como anonimización fuerte.
- **La deduplicación por `email`+`nombre` (sin `telefono`/`mensaje`)
  puede, en casos raros, fusionar dos solicitudes legítimas y distintas**
  si dos personas distintas comparten exactamente nombre y email dentro
  de la ventana de 5 minutos (extremadamente improbable con un `email`
  real) — riesgo aceptado y documentado, no un caso a resolver con más
  precisión (ej. exigir también `telefono` idéntico reduciría falsos
  positivos pero aumentaría falsos negativos en el caso real de "el
  paciente corrigió su teléfono al reenviar").
- **No se agrega manejo de preflight CORS (`OPTIONS`) ni headers
  `Access-Control-Allow-Origin`.** Se asume tráfico same-origin
  (frontend y API en el mismo deployment de Vercel, una vez conectados
  en la feature `08`). Si en el futuro el frontend se sirve desde un
  dominio distinto al de la API, este supuesto deja de sostenerse y
  requeriría revisar esta decisión.
- **No se agrega ningún cleanup/retención para los datos usados en
  deduplicación**, porque no se crea ninguna tabla nueva: la consulta de
  duplicados lee directamente de `leads`, cuya retención/purga es un
  tema aparte (fuera de alcance, no cubierto todavía por ningún ítem
  del roadmap).

## Casos de prueba esperados para `qa-agent`

Además de correr la suite Node existente (`node --test`, sin
regresiones) y `pytest` sobre `tests/` (circuito), el `qa-agent` debe
verificar con tests nuevos (extendiendo `api/leads.test.js` o un archivo
nuevo `api/leads.antispam.test.js`, a discreción del `builder-agent`):

- Los 23 criterios de aceptación listados arriba, cada uno con al menos
  un test o verificación reproducible.
- Un test que combine dos condiciones de rechazo simultáneas (ej. origen
  inválido + rate limit ya excedido) y confirme que responde con el
  primer error del orden extendido (`403`, no `429`).
- Un test que confirme que, ante un duplicado detectado, el cliente
  Supabase falso inyectado en el test **no** recibe una segunda llamada
  a `insert()` (usando un contador o un mock que falle el test si se
  invoca más de una vez).
- Un test que capture las llamadas a `console.warn`/`console.error`
  durante un rechazo (origen/rate limit/honeypot/timing) y verifique,
  por inspección de string, que ninguno de los valores de PII enviados
  en el body de ese mismo test aparece en el log emitido.
- Verificación por inspección de código de que el arreglo `STRING_FIELDS`
  en `api/leads.js` **no** incluye `sitio_web` ni `formulario_mostrado_en`
  (criterios 7 y 11), y de que un valor no-string en cualquiera de los
  dos campos nunca produce `tipo_invalido`.
- Verificación (por inspección de la documentación, no por un test de
  concurrencia real) de que `docs/tecnica/proteccion-antispam-y-abuso.md`
  documenta explícitamente la condición de carrera (TOCTOU) del
  mecanismo de idempotencia como riesgo aceptado, consistente con el
  párrafo correspondiente de esta spec (criterio 19). No se exige
  reproducir concurrencia simultánea real contra Supabase: está fuera de
  alcance de la suite de tests unitarios con cliente mockeado.
- Verificación manual (o test de integración liviano) de que
  `.env.example` contiene la nueva variable `ALLOWED_ORIGINS` con
  comentario explicativo y sin valor real.
- Verificación del contrato común (`Assert-FeatureContract`): existencia
  y contenido no vacío de `docs/tecnica/proteccion-antispam-y-abuso.md`,
  `docs/usuario/proteccion-antispam-y-abuso.md`,
  `runs/04-proteccion-antispam-y-abuso/decision.md`, al menos un
  `audit-N.md`, al menos un `test-report-N.md`, y los enlaces exactos en
  ambos índices de `docs/`.
