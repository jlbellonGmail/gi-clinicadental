# Protección antispam y abuso (`POST /api/leads`) — documentación técnica

Extiende `api/leads.js` (feature `03-endpoint-recepcion-leads`, ya
mergeada) sin romper ninguno de sus criterios ya documentados en
`docs/tecnica/endpoint-recepcion-leads.md`. Spec completo: `runs/04-
proteccion-antispam-y-abuso/spec.md` (23 criterios de aceptación,
aprobado en `audit-2.md` tras un intento inicial rechazado en
`audit-1.md`).

Cinco mecanismos nuevos, todos independientes entre sí (defensa en
profundidad, no un único punto de fallo):

1. Validación de origen (`Origin`/`Referer`).
2. Honeypot (`sitio_web`).
3. Control temporal (`formulario_mostrado_en`).
4. Idempotencia / deduplicación por `email`+`nombre` reciente.
5. Logging de rechazos sin PII.

## Orden de evaluación extendido (reemplaza el de la feature 03)

El handler evalúa en este orden estricto, devolviendo el primer error
que encuentra:

1. Método HTTP distinto de `POST` → `405` (sin cambios).
2. **Origen inválido** (nuevo) → `403` (`origen_no_permitido`), con
   logging de rechazo (`motivo: 'origen_no_permitido'`).
3. Rate limiting (mecanismo sin cambios, feature `03`) → `429`
   (`demasiadas_solicitudes`), ahora con logging de rechazo
   (`motivo: 'rate_limit'`).
4. `Content-Type` inválido → `400` (sin cambios).
5. Tamaño del body > 10 KB → `413` (sin cambios).
6. JSON inválido → `400` (sin cambios).
7. Propiedad desconocida (whitelist ampliada con `sitio_web` y
   `formulario_mostrado_en`) → `400` (sin cambios de mecanismo).
8. **Honeypot disparado** (nuevo) → `400` (`solicitud_rechazada`), con
   logging de rechazo (`motivo: 'antispam'`).
9. **Control temporal disparado** (nuevo, solo si el campo es una fecha
   válida) → `400` (`solicitud_rechazada`), con logging de rechazo
   (`motivo: 'antispam'`, mismo motivo que el honeypot — deliberado, ver
   más abajo).
10. Campos obligatorios/tipos/formatos/longitudes/consentimiento de la
    feature `03`, sin cambios de comportamiento ni de códigos de error.
11. **Duplicado reciente detectado** (nuevo) → no es un error: responde
    `201` con el `id` existente, sin insertar.
12. Inserción normal en Supabase (sin cambios) → `201` con el nuevo `id`.

Un test cubre explícitamente el caso combinado (`api/leads.test.js`,
"origen invalido + rate limit ya excedido -> responde 403 (origen), no
429"): con el rate limit ya agotado y un `Origin` inválido, gana el
rechazo por origen porque se evalúa primero en el orden extendido.

## 1. Validación de origen

- Un origen se considera permitido si coincide **exactamente** con:
  `SITE_URL` (variable ya existente), cualquier entrada de
  `ALLOWED_ORIGINS` (nueva, opcional, lista separada por comas,
  documentada en `.env.example`), o `https://${process.env.VERCEL_URL}`
  cuando esa variable está definida (la provee automáticamente Vercel
  para cada deployment, resolviendo URLs de Preview sin wildcards).
- El origen efectivo se toma del header `Origin` si está presente; si
  no, se deriva de `Referer` (protocolo + host, vía `new URL(...)`); si
  ninguno está presente, o `Referer` no es una URL parseable, se trata
  como no permitido.
- Implementación: `getEffectiveOrigin()`, `isOriginAllowed()`,
  `resolveOriginConfigFromEnv()` y `parseAllowedOrigins()` en
  `api/leads.js`. `createHandler()` acepta un `originConfig` inyectable
  (`{ siteUrl, allowedOrigins, vercelUrl }`) para tests deterministas;
  si se omite, se resuelve desde `process.env` en cada solicitud (no se
  cachea a nivel de módulo).
- **No se implementa manejo de preflight CORS (`OPTIONS`) ni headers
  `Access-Control-Allow-Origin`.** Se asume tráfico same-origin
  (frontend y API en el mismo deployment de Vercel, una vez conectados
  en la feature `08`). Si en el futuro el frontend se sirve desde un
  dominio distinto, este supuesto deja de sostenerse y habría que
  revisar esta decisión.
- **Trade-off aceptado, no un bug:** herramientas sin header
  `Origin`/`Referer` (curl, Postman, scripts de diagnóstico manual)
  quedan bloqueadas por diseño, salvo que se configure el header
  manualmente.
- **Supuesto no verificado end-to-end en esta feature:** se asume que
  los navegadores modernos envían `Origin` en solicitudes `POST`
  (incluidas same-origin). Si algún navegador/configuración de red no lo
  hiciera, solicitudes legítimas podrían bloquearse — a validar en la
  feature `08` o en `16-validacion-mvp-produccion`.

## 2. Honeypot (`sitio_web`)

- Campo opcional en la whitelist del body. Un usuario real nunca lo
  completa (queda oculto en el HTML real, responsabilidad de la feature
  `08`, que debe evitar `display:none` puro para máxima efectividad
  contra autocompletado de navegador).
- Si `sitio_web` está presente y, tras `trim()`, no es una cadena vacía
  → rechazo. Si está presente pero **no es string** → también rechazo
  (mismo código de error, a diferencia del resto de campos de la feature
  `03`: cualquier señal en este campo es sospechosa por definición, y no
  vale la pena filtrar información sobre su existencia a quien lo
  dispara).
- Código de rechazo: `400` con `{ "error": "solicitud_rechazada" }` —
  **deliberadamente genérico y compartido** con el rechazo por control
  temporal (punto 3), para no darle a un bot una forma de distinguir cuál
  de las dos defensas lo detectó ni de calibrar contra ellas por
  separado.
- **`sitio_web` queda explícitamente excluido del arreglo
  `STRING_FIELDS`** de `api/leads.js`. Verificado por test de inspección
  de código (`api/leads.test.js`, "STRING_FIELDS (inspeccion de codigo)
  no incluye sitio_web ni formulario_mostrado_en"). Agregarlo produciría
  `tipo_invalido` para un caso ya cubierto explícitamente arriba, y le
  daría a un bot una señal de calibración adicional.
- Caso borde: un body con `sitio_web` relleno y sin `nombre` responde
  `solicitud_rechazada` (paso 8), nunca `campo_requerido_faltante` (paso
  10) — el honeypot se evalúa antes.
- **Limitación conocida, no un defecto:** no detiene bots dirigidos que
  inspeccionan el contrato real de la API (en vez de rellenar un
  formulario HTML a ciegas) y simplemente omiten `sitio_web`. Tampoco
  aporta nada mientras la feature `08` no exista: hasta entonces, ningún
  cliente legítimo lo va a enviar, así que hoy solo protege contra quien
  llame directamente a la API imitando campos de un formulario típico.

## 3. Control temporal (`formulario_mostrado_en`)

- Campo opcional (timestamp ISO 8601, el momento en que el formulario se
  volvió visible para el usuario, generado client-side por la futura
  feature `08`).
- Implementación: se verifica primero `typeof valor === 'string'`; solo
  si es string se intenta `Date.parse`. Si el campo está ausente, no es
  string, o es un string no parseable (`Date.parse` da `NaN`) → se omite
  el chequeo **sin rechazar la solicitud completa** (asimetría
  deliberada frente al honeypot: un timestamp malformado o de tipo
  inesperado podría ser un bug de reloj/cliente de un paciente real, no
  necesariamente un bot).
- Si es una fecha válida: se calcula `ahora - fecha`. Si ese valor es
  menor a `MIN_FORM_FILL_MS = 3000` (3 segundos, constante en código) →
  rechazo con el mismo código genérico `solicitud_rechazada` (`400`) del
  punto 2.
- **Delta negativo (reloj de cliente adelantado)** se trata igual que
  "menos de 3000 ms" (rechazo), no como caso especial. Cubierto por test
  explícito.
- No se valida un límite superior: formularios abiertos hace mucho
  tiempo se aceptan igual.
- **`formulario_mostrado_en` queda explícitamente excluido de
  `STRING_FIELDS`**, mismo razonamiento que `sitio_web` (ver arriba) —
  si se agregara, un valor no-string sería rechazado con `tipo_invalido`
  en el paso 10, contradiciendo directamente "no se rechaza la solicitud
  completa" de este punto. Verificado por el mismo test de inspección de
  código.
- **Limitación conocida, no un defecto:** trivialmente evadible por un
  bot que falsee `formulario_mostrado_en` con un valor antiguo. Solo
  detiene bots genéricos/no dirigidos que no simulan tiempo de llenado.
  Mientras la feature `08` no exista, es opt-in (ningún cliente legítimo
  lo envía todavía).

## 4. Idempotencia / duplicados accidentales

- Justo antes de insertar (después de pasar todas las validaciones de la
  feature `03` y las nuevas de origen/honeypot/timing), se consulta la
  tabla `leads` (mismo cliente `service_role` ya inyectado) buscando un
  registro con `email` igual (comparación case-insensitive, tras
  `trim()`, vía `.ilike()`) **y** `nombre` igual (tras `trim()`,
  comparación case-sensitive, vía `.eq()`) **y**
  `fecha_creacion >= ahora - 5 minutos` (`DUPLICATE_WINDOW_MINUTES = 5`,
  vía `.gte()` + `.limit(1)`).
- Si existe un registro que matchea → no se inserta un nuevo lead; se
  responde `201` con `{ "id": <id del lead existente> }` (mismo contrato
  de éxito que un insert nuevo).
- Si no existe → sigue el flujo normal de `INSERT`, sin cambios en el
  mapeo campo→columna.
- No se requiere ninguna tabla ni columna nueva: la consulta reutiliza la
  tabla `leads` ya existente.
- No se compara `telefono`/`servicio`/`mensaje`: deliberadamente más
  laxo, para seguir reconociendo como duplicado un reintento donde el
  usuario corrigió un campo secundario — trade-off aceptado: un mismo
  paciente que corrige un error tipográfico en su `mensaje` y reenvía
  dentro de los 5 minutos verá su segunda solicitud "fusionada"
  silenciosamente con la primera (responde `201` pero no guarda el
  mensaje corregido).
- **Decisión de implementación defensiva no exigida explícitamente por
  el spec:** el valor de `email` se escapa (`escapeIlikeValue()`) antes
  de usarse en el filtro `.ilike()`, escapando `%`, `_` y `\`. Sin este
  escape, un `email` que técnicamente contuviera esos caracteres
  (`EMAIL_PATTERN` no los excluye) actuaría como comodín SQL en la
  comparación `ilike` y podría matchear de más. No cambia el contrato
  observable del endpoint, solo hace la comparación case-insensitive más
  correcta.

### Condición de carrera (TOCTOU) — riesgo aceptado, no mitigado

Este es el punto que motivó el rechazo de `audit-1.md` del spec y quedó
resuelto en `audit-2.md`: el diseño consulta la tabla (`SELECT`) y, si no
encuentra un duplicado reciente, inserta (`INSERT`), como **dos
operaciones separadas sin transacción ni constraint único a nivel de base
de datos**. Dos solicitudes casi simultáneas para el mismo
`email`+`nombre` (el caso más realista: un usuario hace doble clic en
"Enviar" antes de que la primera respuesta HTTP vuelva) pueden ambas
ejecutar el `SELECT` antes de que cualquiera complete el `INSERT`, viendo
ambas "no hay duplicado reciente" e insertando dos leads.

Se documenta como **riesgo aceptado, no mitigado en esta feature**, por
las mismas razones que el spec expone en detalle ("Riesgos / supuestos"):

- Mitigarlo de forma robusta requeriría un índice único parcial (o una
  función/trigger equivalente) sobre `leads` — una migración SQL nueva
  sobre una tabla ya existente, fuera del alcance que esta spec define
  explícitamente ("Explícitamente NO incluye": *"no agregar un índice
  único ni constraint nuevo sobre `leads`"*) salvo decisión de
  arquitectura documentada en `docs/tecnica/arquitectura.md`. Esta
  feature no encontró justificación suficiente para tomar esa decisión
  unilateralmente solo por este caso límite.
- El impacto de fallar en este caso es bajo: en el peor caso se insertan
  dos leads casi idénticos del mismo paciente en la misma ventana de
  segundos, visibles y fusionables manualmente por quien gestiona los
  leads de la clínica — no hay pérdida de datos, filtración de PII a
  terceros, ni una vulnerabilidad explotable deliberadamente por un
  atacante (a diferencia de honeypot/origen/rate-limit, este mecanismo
  defiende contra un accidente de UX, no contra abuso intencional).
- El mecanismo sigue siendo correcto y útil para el caso mayoritario real
  ("duplicado accidental" = un reenvío manual del usuario segundos o
  minutos después, no un doble clic en el mismo instante), donde el
  `SELECT` del segundo request sí ve ya completado el `INSERT` del
  primero.

El test correspondiente (`api/leads.test.js`, "duplicado detectado -> el
mock falla el test si insert() se invoca mas de una vez") verifica
**comportamiento secuencial** (una solicitud completa su ciclo antes de
que llegue la siguiente), no concurrencia real simultánea — eso está
fuera de alcance de la suite de tests unitarios con cliente Supabase
mockeado (que por diseño es secuencial, no concurrente). Si en producción
se observa evidencia real de duplicados por esta ventana de carrera,
mitigarlo es candidato concreto para una decisión de arquitectura futura
documentada en `docs/tecnica/arquitectura.md`, no para esta feature.

## 5. Logging de rechazos sin PII

- Cada rechazo por rate limit (`429`), origen inválido (`403`) o
  antispam (`400` honeypot/timing) emite `console.warn(JSON.stringify({
  evento: 'lead_rechazado', motivo, ip_hash, timestamp }))`, con
  `motivo` uno de `'rate_limit' | 'origen_no_permitido' | 'antispam'`
  (honeypot y timing comparten `'antispam'`, igual que comparten el
  mismo código de error HTTP — mismo criterio de no dar información de
  calibración a un bot).
- `ip_hash` = primeros 16 caracteres hexadecimales de
  `sha256(ip)` (`crypto.createHash('sha256')`, módulo nativo de Node, sin
  dependencia nueva). **No es una garantía criptográfica irreversible**
  frente a un atacante con recursos para probar rangos de IP conocidos
  contra el hash — es una mitigación razonable para no persistir la IP en
  texto plano en los logs de la plataforma (Vercel), consistente con el
  nivel de riesgo de este proyecto (landing de captación de leads, no un
  sistema con datos clínicos sensibles en los logs).
- **Prohibido explícitamente y verificado por test:** ningún log de
  rechazo contiene `nombre`, `email`, `telefono`, `mensaje`, `sitio_web`
  ni la IP en texto plano (`api/leads.test.js`, cuatro tests dedicados —
  uno por motivo de rechazo — que interceptan `console.warn` y hacen
  assert sobre el contenido serializado).
- No se persiste esta información en Supabase ni en ninguna tabla nueva:
  vive únicamente en los logs de la plataforma. Observabilidad más
  completa (retención, búsqueda, alertas) es el ítem
  `15-observabilidad-y-operacion` del roadmap, no esta feature.

## Por qué NO se implementó CAPTCHA

No hay proveedor de CAPTCHA (reCAPTCHA/hCaptcha/Turnstile) declarado en
el stack de `AGENTS.md`, y agregarlo introduciría una dependencia/servicio
externo nuevo con su propia clave — decisión de arquitectura que esta
feature no toma unilateralmente (afectaría además la UX del futuro
formulario real de la feature `08`). El ítem `04` de `ROADMAP.md` lo
condiciona explícitamente ("...CAPTCHA cuando resulte necesario"), no lo
exige de entrada. Si el volumen de abuso real en producción supera lo que
las defensas de esta feature mitigan, agregar CAPTCHA queda como
candidato a un ítem de roadmap futuro, con su propia spec y su propia
decisión de arquitectura en `docs/tecnica/arquitectura.md`.

## Por qué NO se reemplazó el rate limiter por almacenamiento persistente/distribuido

`docs/tecnica/endpoint-recepcion-leads.md` (feature `03`) mencionaba
almacenamiento persistente/distribuido (Redis/Upstash, Vercel KV, tabla
Supabase dedicada) como parte del "alcance completo" de esta feature `04`.
Decisión explícita de esta feature: priorizar las defensas nuevas
(origen, honeypot, timing, dedupe) que **no dependen de estado compartido
entre instancias/cold starts de Vercel**, en vez de agregar
infraestructura nueva sin evidencia real de que el rate limiter en
memoria (feature `03`) sea insuficiente en la práctica. El rate limiter
sigue teniendo las mismas limitaciones ya documentadas y aceptadas en la
feature `03` (no persiste entre cold starts, no se comparte entre
instancias concurrentes) — sin cambios de mecanismo en esta feature, solo
se le agregó logging de rechazo.

## Variables de entorno nuevas

- `ALLOWED_ORIGINS` (opcional): lista de orígenes permitidos separados
  por coma, además de `SITE_URL` y `https://${VERCEL_URL}` (implícitos).
  Documentada en `.env.example` con valor vacío y comentario explicativo.
- No se agregó ninguna otra variable de entorno, dependencia npm, tabla
  ni migración SQL nueva — el diseño implementado coincide con el
  propuesto en el spec, sin desvíos que requieran una entrada nueva en
  `docs/tecnica/arquitectura.md`.

## Inyección de dependencias para tests (extiende el patrón de la feature 03)

`createHandler(options)` gana un nuevo parámetro:

- `originConfig`: objeto `{ siteUrl, allowedOrigins, vercelUrl }` que
  reemplaza la resolución desde `process.env` para esa instancia del
  handler. Los tests usan un `originConfig` fijo (`TEST_SITE_URL =
  'http://localhost:3000'`) para no depender de variables de entorno
  reales; `makeReq()` en `api/leads.test.js` agrega por defecto un header
  `Origin` igual a `TEST_SITE_URL`, precisamente para que los 62 tests
  preexistentes de la feature `03` (que no conocían el concepto de
  origen) sigan pasando sin modificar cada test individualmente.

Si `originConfig` no se pasa (caso de producción, `module.exports =
createHandler()`), se resuelve desde `process.env` en cada solicitud
(`resolveOriginConfigFromEnv()`), no se cachea a nivel de módulo — así
refleja cambios de entorno sin necesitar reiniciar el proceso (aunque en
la práctica, en Vercel, las env vars son fijas por deployment).

## Cómo se ejecutan los tests

Sin cambios respecto a la feature `03`: `npm test` (`node --test`,
descubre `**/*.test.js`) y `pytest -v` sobre `tests/` en el mismo job de
CI. `api/leads.test.js` ahora tiene 98 tests (62 de la feature `03` +
36 nuevos de esta feature), todos pasando; `npm test` corre 107 en total
junto con `api/_lib/sanitize-html.test.js`.

## Verificación real vs. mockeada

Igual que en la feature `03`: no hay un proyecto Supabase real conectado
en este entorno de desarrollo/CI. El chequeo de duplicados (`.select()
.ilike().eq().gte().limit()`) se testea contra un cliente Supabase falso
que simula el `SELECT` con distintos resultados (sin duplicados,
duplicado encontrado, fallo de Postgres), no contra Supabase real. Queda
como verificación pendiente en Preview/Production, igual que la
migración de la feature `02` y el resto de la feature `03`.
