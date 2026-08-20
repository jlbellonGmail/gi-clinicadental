# Decisiones — `04-proteccion-antispam-y-abuso`

Registro de decisiones demostrables tomadas por el `builder-agent` al
implementar `runs/04-proteccion-antispam-y-abuso/spec.md` (aprobado,
intento 2, `audit-2.md`). No repite el spec: documenta desvíos,
interpretaciones y decisiones de implementación no cerradas al 100% por
el spec, con su justificación y evidencia verificable en el código/tests.

## 1. Sin desvíos de diseño que requieran arquitectura nueva

El diseño implementado coincide con el propuesto en el spec: cinco
mecanismos (origen, honeypot, control temporal, idempotencia, logging),
ninguna dependencia npm nueva, ninguna tabla ni migración Supabase nueva,
ningún servicio externo (CAPTCHA). No fue necesario agregar una sección a
`docs/tecnica/arquitectura.md` — el criterio 18 del spec no aplica en
este caso.

## 2. Orden de evaluación: origen se resuelve ANTES que el rate limit

El "orden de evaluación extendido" del spec (12 pasos) ubica
explícitamente la validación de origen (paso 2) antes del rate limiting
(paso 3). Se implementó exactamente así: `getClientIp(req)` se calcula
una sola vez al principio del handler (se necesita tanto para el log de
rechazo por origen como para el rate limiter), y la validación de origen
corta el flujo antes de tocar `rateLimitStore`. Verificado por el test
"origen invalido + rate limit ya excedido -> responde 403 (origen), no
429 (orden extendido, criterio 1)".

## 3. `originConfig` inyectable, resuelto desde `process.env` por solicitud si no se inyecta

El spec no especifica un mecanismo de inyección de dependencias para la
validación de origen (a diferencia del cliente Supabase, `now`,
`rateLimitStore`, que la feature `03` ya dejaba inyectables). Decisión de
implementación: se agregó `originConfig` (`{ siteUrl, allowedOrigins,
vercelUrl }`) como parámetro opcional de `createHandler(options)`,
consistente con el patrón ya establecido en la feature `03`. Si no se
inyecta, se resuelve desde `process.env.SITE_URL` /
`process.env.ALLOWED_ORIGINS` / `process.env.VERCEL_URL` en cada
solicitud (no se cachea a nivel de módulo, a diferencia del cliente
Supabase, porque el costo de recomputarlo es trivial — un `split(',')` y
unas comparaciones de string — y así se evita cualquier problema de
"env leída una sola vez al importar el módulo, antes de que Vercel la
inyecte").

Consecuencia práctica para los tests: `api/leads.test.js` define
`TEST_SITE_URL = 'http://localhost:3000'` y lo usa por defecto tanto en
`makeReq()` (agrega el header `Origin` si el test no lo especifica) como
en `newHandler()` (agrega `originConfig.siteUrl`). Esto es lo que permite
que los 62 tests preexistentes de la feature `03` — que no conocían el
concepto de origen — sigan pasando sin modificar cada test individual,
cumpliendo el criterio 16 del spec (regresión completa).

## 4. Escape de caracteres especiales de `ilike` en el chequeo de duplicados

El spec (punto 4 del diseño) especifica comparar `email` de forma
case-insensitive, sin entrar en el detalle de qué método de PostgREST/
Supabase usar. Se implementó con `.ilike('email', valor)`. Decisión de
implementación no exigida explícitamente por el spec, pero necesaria para
que el comportamiento sea correcto: `ilike` interpreta `%` y `_` como
comodines SQL, y el patrón de validación de email de la feature `03`
(`EMAIL_PATTERN`) no excluye esos caracteres del username. Sin escapar,
un email que técnicamente los contuviera podría matchear de más contra
otros registros. Se agregó `escapeIlikeValue()` (escapa `%`, `_`, `\` con
`\`) antes de pasar el valor al filtro. No cambia el contrato observable
del endpoint (mismos criterios de aceptación 12-14), solo hace la
comparación más correcta. Documentado también en
`docs/tecnica/proteccion-antispam-y-abuso.md`.

## 5. `motivo: 'antispam'` compartido entre honeypot y control temporal en los logs

El spec da el ejemplo de log con `motivo: 'rate_limit' |
'origen_no_permitido' | 'antispam'` (tres valores posibles, no cuatro),
consistente con que honeypot y timing ya comparten el mismo código de
error HTTP (`solicitud_rechazada`) por la misma razón de seguridad (no
darle a un bot una señal para calibrar contra cada defensa por separado).
Se implementó `logRejection('antispam', ip)` en ambos casos, no
`'honeypot'` / `'timing'` por separado. Verificado por los dos tests
dedicados de logging sin PII (uno por honeypot, otro por timing), que
además comprueban que ninguno de los valores de PII enviados en el body
de ese mismo test aparece en el log emitido.

## 6. Sin validación de longitud máxima explícita para `sitio_web` (200) ni `formulario_mostrado_en` (40)

El punto "Diseño propuesto" del spec menciona longitudes máximas
orientativas para ambos campos nuevos (200 y 40 caracteres
respectivamente) al describirlos como "campo nuevo en la whitelist", pero
ninguno de los 23 criterios de aceptación exige un código de error
específico por exceder esas longitudes. Decisión de implementación: no
se agregó un chequeo de longitud separado para ninguno de los dos,
porque:

- `sitio_web`: cualquier contenido no vacío tras `trim()` ya dispara
  `solicitud_rechazada` (el honeypot rechaza por presencia de contenido,
  no por su longitud) — un valor de 500 caracteres se rechaza igual que
  uno de 10, por la misma regla, sin necesitar un chequeo adicional.
- `formulario_mostrado_en`: un string de más de 40 caracteres que no sea
  una fecha ISO válida ya falla `Date.parse` (retorna `NaN`) y el chequeo
  se omite sin rechazar, tal como exige el criterio 11 del spec. Agregar
  un límite de longitud aparte no cambiaría ningún comportamiento
  observable, porque la validez como fecha ya es la única condición que
  importa.

No es una desviación del contrato de aceptación (ningún criterio lo
exige), solo una simplificación consciente para no agregar código sin un
comportamiento observable diferente que probar.

## 7. Ubicación del chequeo de duplicados: después de obtener el cliente Supabase, antes del `INSERT`

El spec dice "justo antes de insertar en Supabase". Se implementó
reutilizando la misma variable `supabase` (obtenida una sola vez, después
de pasar todas las validaciones de contenido) tanto para el `SELECT` de
duplicados como para el `INSERT` posterior — consistente con la decisión
ya tomada en la feature `03` de no inicializar el cliente Supabase antes
de que la solicitud haya pasado todas las validaciones que no dependen de
la base de datos.

## Evidencia de cierre

- `api/leads.js`: los cinco mecanismos implementados, orden de
  evaluación extendido de 12 pasos, `STRING_FIELDS` sin `sitio_web` ni
  `formulario_mostrado_en` (verificable por inspección directa del
  arreglo en el archivo).
- `api/leads.test.js`: 98 tests (62 preexistentes de la feature `03`,
  todos pasando sin modificar su expectativa de comportamiento + 36
  nuevos de esta feature). `npm test` corre 107 en total junto con
  `api/_lib/sanitize-html.test.js`. Comando: `npm test` (`node --test`).
- `pytest -v` sobre `tests/`: 24 tests del circuito, sin relación con
  esta feature, pasando sin cambios.
- `.env.example`: nueva variable `ALLOWED_ORIGINS`, mismo estilo que las
  existentes.
- `docs/tecnica/proteccion-antispam-y-abuso.md` y
  `docs/usuario/proteccion-antispam-y-abuso.md`: creados, no vacíos.
- Enlaces en `docs/tecnica/index.md` y `docs/usuario/index.md` agregados
  vía `scripts/update-doc-indexes.ps1 04-proteccion-antispam-y-abuso
  "Protección antispam y abuso"`.
